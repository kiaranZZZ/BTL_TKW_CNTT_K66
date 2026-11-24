/* Module kho: tồn kho, phiếu nhập/xuất/điều chuyển, kiểm kê, soạn hàng & in tem QR */
(function () {
  const { esc, badge, tone, dt, date, money, toast, table, form, modal, confirmDialog, pageHead, filterBar, bindFilters, fv, icon } = WMS.ui;
  const store = WMS.store;
  const whName = (id) => (store.byId('warehouses', id) || {}).name || '';
  const userName = (id) => (store.byId('users', id) || {}).name || '';
  const prod = (id) => store.byId('products', id) || { name: '?', sku: '?', unit: '' };
  const manage = ['admin', 'wm']; // vai trò được duyệt phiếu

  // ---------- Tồn kho ----------
  WMS.pages['/inventory'] = {
    title: 'Tồn kho', roles: ['admin', 'wm', 'staff'],
    render(root) {
      const key = 'inventory';
      const low = (s) => s.qty < prod(s.productId).minStock;
      const lowCount = store.db.stock.filter(low).length;
      root.innerHTML = pageHead('Tồn kho', 'Theo dõi số lượng từng mặt hàng theo kho và vị trí') +
        (lowCount ? `<div class="form-alert" role="alert"><strong>Cảnh báo:</strong> có ${lowCount} mặt hàng dưới mức tồn tối thiểu.</div>` : '') +
        `<div class="card card--flush">${filterBar(key, [
          { name: 'q', label: 'Tìm theo SKU hoặc tên sản phẩm' },
          { name: 'wh', kind: 'select', label: 'Tất cả kho', options: store.all('warehouses').map(w => [w.id, w.name]) },
          { name: 'low', kind: 'select', label: 'Mọi mức tồn', options: [['low', 'Chỉ tồn thấp']] }
        ])}<div id="results"></div></div>`;
      bindFilters(root, key, () => {
        const q = fv(key, 'q').toLowerCase(), wh = fv(key, 'wh'), onlyLow = fv(key, 'low');
        const rows = store.db.stock.filter(s => {
          const p = prod(s.productId);
          return (!q || (p.sku + ' ' + p.name).toLowerCase().includes(q)) && (!wh || s.warehouseId === wh) && (!onlyLow || low(s));
        });
        root.querySelector('#results').innerHTML = table([
          { label: 'Hình', render: (s) => WMS.productThumb(store.byId('products', s.productId)) },
          { label: 'SKU', render: (s) => esc(prod(s.productId).sku) },
          { label: 'Sản phẩm', render: (s) => esc(prod(s.productId).name) },
          { label: 'Kho', render: (s) => esc(whName(s.warehouseId)) },
          { label: 'Vị trí', render: (s) => esc((store.byId('locations', s.locationId) || {}).code || '—') },
          { label: 'Tồn', render: (s) => `<strong>${s.qty}</strong> ${esc(prod(s.productId).unit)}`, cls: 'text-right' },
          { label: 'Tối thiểu', render: (s) => prod(s.productId).minStock, cls: 'text-right' },
          { label: 'Tình trạng', render: (s) => low(s) ? tone('Tồn thấp', 'danger') : tone('Đủ hàng', 'success') }
        ], rows, 'Không có mặt hàng phù hợp');
      });
    }
  };

  // ---------- Phiếu nhập / xuất / điều chuyển ----------
  const TYPE = { in: ['Nhập kho', 'success'], out: ['Xuất kho', 'warn'], transfer: ['Điều chuyển', 'info'] };
  const RSTATUS = { pending: ['Chờ duyệt', 'warn'], approved: ['Đã duyệt', 'success'], rejected: ['Từ chối', 'danger'] };

  function lineRow() {
    const opts = store.all('products').map(p => `<option value="${p.id}">${esc(p.sku)} – ${esc(p.name)}</option>`).join('');
    return `<div class="lines__row"><select class="field__input" aria-label="Sản phẩm"><option value="">-- Chọn sản phẩm --</option>${opts}</select>
      <input class="field__input" type="number" min="1" step="1" placeholder="SL" aria-label="Số lượng"><button type="button" class="btn btn--ghost btn--sm" data-action="line.del" aria-label="Xóa dòng">${icon('x')}</button></div>`;
  }
  WMS.actions['line.add'] = (el) => el.closest('.modal').querySelector('.lines').insertAdjacentHTML('beforeend', lineRow());
  WMS.actions['line.del'] = (el) => { const box = el.closest('.lines'); if (box.children.length > 1) el.closest('.lines__row').remove(); };

  WMS.actions['receipt.new'] = (el) => {
    const type = el.dataset.type;
    const wh = () => store.all('warehouses').map(w => [w.id, w.name]);
    const fields = [{ name: 'warehouseId', label: type === 'in' ? 'Kho nhập' : (type === 'out' ? 'Kho xuất' : 'Kho nguồn'), type: 'select', options: wh, required: true }];
    if (type === 'transfer') fields.push({ name: 'toWarehouseId', label: 'Kho đích', type: 'select', options: wh, required: true, validate: (x, v) => x === v.warehouseId ? 'Kho đích phải khác kho nguồn' : '' });
    if (type === 'in') fields.push({ name: 'supplierId', label: 'Nhà cung cấp', type: 'select', required: true, placeholder: '-- Chọn --', options: () => store.all('suppliers').map(s => [s.id, s.name]) });
    fields.push({ name: 'note', label: 'Ghi chú', type: 'textarea', wide: true });
    fields.push({ type: 'custom', html: `<div class="field__label">Danh sách sản phẩm <span class="field__req">*</span></div><div class="lines">${lineRow()}</div><button type="button" class="btn btn--ghost btn--sm" data-action="line.add">+ Thêm dòng</button>` });
    form({
      title: 'Tạo phiếu ' + TYPE[type][0].toLowerCase(), fields, size: 'lg', submitText: 'Gửi duyệt',
      onSubmit(v, el) {
        const lines = [...el.querySelectorAll('.lines__row')].map(r => ({ productId: r.querySelector('select').value, qty: parseFloat(r.querySelector('input').value) }));
        if (lines.some(l => !l.productId || !(l.qty > 0) || !Number.isInteger(l.qty))) return 'Mỗi dòng cần chọn sản phẩm và nhập số lượng là số nguyên dương';
        const r = store.createReceipt({ type, warehouseId: v.warehouseId, toWarehouseId: v.toWarehouseId, supplierId: v.supplierId, note: v.note, lines });
        if (r.error) return r.error;
        toast('Đã tạo phiếu ' + r.id + ', chờ quản lý kho duyệt', 'success'); WMS.router.refresh();
      }
    });
  };
  WMS.actions['receipt.view'] = (el) => {
    const r = store.byId('receipts', el.dataset.id);
    const lines = table([{ label: 'Sản phẩm', render: (l) => esc(prod(l.productId).name) }, { label: 'SL', render: (l) => `${l.qty} ${esc(prod(l.productId).unit)}`, cls: 'text-right' }], r.lines);
    modal({
      title: 'Phiếu ' + r.id,
      body: `<dl class="info-list"><div><dt>Loại</dt><dd>${TYPE[r.type][0]}</dd></div><div><dt>Trạng thái</dt><dd>${RSTATUS[r.status][0]}</dd></div>
        <div><dt>Kho</dt><dd>${esc(whName(r.warehouseId))}${r.toWarehouseId ? ' → ' + esc(whName(r.toWarehouseId)) : ''}</dd></div>
        ${r.supplierId ? `<div><dt>Nhà cung cấp</dt><dd>${esc(store.byId('suppliers', r.supplierId).name)}</dd></div>` : ''}
        <div><dt>Người tạo</dt><dd>${esc(userName(r.createdBy))} · ${dt(r.createdAt)}</dd></div>
        ${r.approvedBy ? `<div><dt>Người duyệt</dt><dd>${esc(userName(r.approvedBy))} · ${dt(r.approvedAt)}</dd></div>` : ''}
        <div><dt>Ghi chú</dt><dd>${esc(r.note) || '—'}</dd></div></dl>${lines}`
    });
  };
  WMS.actions['receipt.approve'] = (el) => confirmDialog('Duyệt phiếu ' + el.dataset.id + '? Tồn kho sẽ được cập nhật.', () => {
    const r = store.approveReceipt(el.dataset.id);
    if (r.error) toast(r.error, 'error'); else toast('Đã duyệt phiếu, tồn kho đã cập nhật', 'success');
    WMS.router.refresh();
  }, { yesText: 'Duyệt' });
  WMS.actions['receipt.reject'] = (el) => confirmDialog('Từ chối phiếu ' + el.dataset.id + '?', () => { store.rejectReceipt(el.dataset.id); toast('Đã từ chối phiếu'); WMS.router.refresh(); }, { danger: true, yesText: 'Từ chối' });

  WMS.pages['/receipts'] = {
    title: 'Phiếu nhập/xuất', roles: ['admin', 'wm', 'staff'],
    render(root, params, user) {
      const key = 'receipts';
      const btn = (t) => `<button class="btn btn--sm ${t === 'in' ? '' : 'btn--ghost'}" data-action="receipt.new" data-type="${t}">+ ${TYPE[t][0]}</button>`;
      root.innerHTML = pageHead('Phiếu nhập / xuất / điều chuyển', manage.includes(user.role) ? 'Quản lý kho duyệt phiếu do nhân viên tạo' : 'Tạo phiếu và chờ quản lý kho duyệt', btn('in') + btn('out') + btn('transfer')) +
        `<div class="card card--flush">${filterBar(key, [
          { name: 'q', label: 'Tìm theo mã phiếu' },
          { name: 'type', kind: 'select', label: 'Mọi loại', options: Object.keys(TYPE).map(k => [k, TYPE[k][0]]) },
          { name: 'status', kind: 'select', label: 'Mọi trạng thái', options: Object.keys(RSTATUS).map(k => [k, RSTATUS[k][0]]) }
        ])}<div id="results"></div></div>`;
      bindFilters(root, key, () => {
        const q = fv(key, 'q').toLowerCase(), type = fv(key, 'type'), st = fv(key, 'status');
        const rows = store.db.receipts.filter(r => (!q || r.id.toLowerCase().includes(q)) && (!type || r.type === type) && (!st || r.status === st));
        root.querySelector('#results').innerHTML = table([
          { label: 'Mã phiếu', render: (r) => `<span class="mono">${r.id}</span>` },
          { label: 'Loại', render: (r) => tone(TYPE[r.type][0], TYPE[r.type][1]) },
          { label: 'Kho', render: (r) => esc(whName(r.warehouseId)) + (r.toWarehouseId ? ' → ' + esc(whName(r.toWarehouseId)) : '') },
          { label: 'Số dòng', render: (r) => r.lines.length, cls: 'text-right' },
          { label: 'Người tạo', render: (r) => esc(userName(r.createdBy)) },
          { label: 'Ngày tạo', render: (r) => dt(r.createdAt) },
          { label: 'Trạng thái', render: (r) => tone(RSTATUS[r.status][0], RSTATUS[r.status][1]) },
          {
            label: '', render: (r) => `<div class="table__actions"><button class="btn btn--ghost btn--sm" data-action="receipt.view" data-id="${r.id}">Xem</button>` +
              (r.status === 'pending' && manage.includes(user.role) ? `<button class="btn btn--sm" data-action="receipt.approve" data-id="${r.id}">Duyệt</button><button class="btn btn--ghost btn--sm" data-action="receipt.reject" data-id="${r.id}">Từ chối</button>` : '') + '</div>'
          }
        ], rows, 'Chưa có phiếu nào');
      });
    }
  };

  // ---------- Kiểm kê ----------
  WMS.pages['/stocktake'] = {
    title: 'Kiểm kê', roles: ['admin', 'wm', 'staff'],
    render(root) {
      const warehouses = store.all('warehouses');
      const wid = WMS.ui.getTab('stocktake', warehouses[0].id);
      const rows = store.db.stock.filter(s => s.warehouseId === wid);
      const history = store.db.stocktakes.slice(0, 6);
      root.innerHTML = pageHead('Kiểm kê kho', 'Nhập số lượng đếm thực tế, hệ thống tự tính chênh lệch và điều chỉnh tồn') +
        `<div class="card card--flush"><div class="toolbar"><label>Kho <select class="field__input" data-change="stocktake.wh">${warehouses.map(w => `<option value="${w.id}" ${w.id === wid ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></label></div>
        ${table([
          { label: 'SKU', render: (s) => esc(prod(s.productId).sku) },
          { label: 'Sản phẩm', render: (s) => esc(prod(s.productId).name) },
          { label: 'Tồn hệ thống', render: (s) => s.qty, cls: 'text-right' },
          { label: 'Số đếm thực tế', render: (s) => `<input class="field__input count-input" type="number" min="0" step="1" value="${s.qty}" data-pid="${s.productId}" data-sys="${s.qty}" aria-label="Đếm ${esc(prod(s.productId).name)}">`, cls: 'text-right' },
          { label: 'Chênh lệch', render: (s) => `<strong class="diff" data-for="${s.productId}">0</strong>`, cls: 'text-right' }
        ], rows, 'Kho chưa có hàng để kiểm kê')}
        <div class="toolbar"><button class="btn" data-action="stocktake.save" data-wid="${wid}" ${rows.length ? '' : 'disabled'}>Lưu kết quả kiểm kê</button></div></div>
        <h2 class="mt-4">Lịch sử kiểm kê gần đây</h2><div class="card card--flush">${table([
          { label: 'Mã', render: (k) => `<span class="mono">${k.id}</span>` }, { label: 'Kho', render: (k) => esc(whName(k.warehouseId)) },
          { label: 'Thời gian', render: (k) => dt(k.createdAt) }, { label: 'Người kiểm', render: (k) => esc(userName(k.createdBy)) },
          { label: 'Chênh lệch', render: (k) => { const d = k.lines.filter(l => l.system !== l.counted); return d.length ? esc(d.map(l => `${prod(l.productId).name}: ${l.system}→${l.counted}`).join('; ')) : tone('Khớp', 'success'); } }
        ], history, 'Chưa có lần kiểm kê nào')}</div>`;
      // Cập nhật cột chênh lệch ngay khi gõ
      root.querySelectorAll('.count-input').forEach(inp => inp.addEventListener('input', () => {
        const d = parseFloat(inp.value) - Number(inp.dataset.sys);
        const cell = root.querySelector(`.diff[data-for="${inp.dataset.pid}"]`);
        cell.textContent = isNaN(d) ? '?' : (d > 0 ? '+' + d : d);
        cell.style.color = d === 0 ? '' : 'var(--c-danger)';
      }));
    }
  };
  WMS.changes['stocktake.wh'] = (el) => { WMS.state.tabs.stocktake = el.value; WMS.router.refresh(); };
  WMS.actions['stocktake.save'] = (el) => {
    const counts = {};
    for (const inp of document.querySelectorAll('.count-input')) {
      const n = parseFloat(inp.value);
      if (isNaN(n) || n < 0 || !Number.isInteger(n)) { toast('Số đếm phải là số nguyên không âm', 'error'); inp.focus(); return; }
      counts[inp.dataset.pid] = n;
    }
    confirmDialog('Lưu kiểm kê và điều chỉnh tồn kho theo số đếm thực tế?', () => {
      const r = store.applyStocktake(el.dataset.wid, counts);
      toast(r.diff ? `Đã điều chỉnh ${r.diff} mặt hàng chênh lệch` : 'Kiểm kê khớp hoàn toàn', 'success'); WMS.router.refresh();
    }, { yesText: 'Lưu kiểm kê' });
  };

  // ---------- Tem vận đơn có mã QR (dùng chung cho kho và điều phối) ----------
  WMS.showLabel = function (code) {
    const s = store.track(code), route = store.byId('routes', s.routeId);
    let qrSvg = '';
    try {
      const qr = qrcode(0, 'M');
      qr.addData(location.origin + location.pathname + '#/track?code=' + s.code); // quét QR để tra cứu hành trình
      qr.make();
      qrSvg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (e) { qrSvg = '<span class="muted">Không tạo được QR</span>'; }
    modal({
      title: 'Tem vận đơn ' + s.code,
      body: `<div class="label"><div><div class="label__code mono">${esc(s.code)}</div>
          <div><strong>Người nhận:</strong> ${esc(s.receiver.name)} – ${esc(s.receiver.phone)}</div>
          <div>${esc(s.receiver.address)}</div><div><strong>Người gửi:</strong> ${esc(s.sender.name)}</div>
          <div><strong>Tuyến:</strong> ${esc(route.name)} · ${s.weight} kg</div>
          <div><strong>Thu hộ COD:</strong> ${s.cod ? money(s.cod) : 'Không thu'}</div></div>
          <div class="label__qr" role="img" aria-label="Mã QR vận đơn">${qrSvg}</div></div>`,
      footer: '<button class="btn btn--ghost" data-action="modal.close">Đóng</button><button class="btn" data-action="label.print">In tem</button>'
    });
  };
  WMS.actions['label.view'] = (el) => WMS.showLabel(el.dataset.code);
  WMS.actions['label.print'] = () => window.print();

  // ---------- Soạn hàng & đóng gói ----------
  WMS.actions['pack.do'] = (el) => {
    const s = store.track(el.dataset.code);
    form({
      title: 'Soạn hàng & đóng gói ' + s.code, submitText: 'Hoàn tất đóng gói',
      fields: [
        { type: 'custom', html: `<p><strong>Hàng cần soạn:</strong> ${esc(s.desc)} (${s.weight} kg)</p><p class="muted">Giao đến: ${esc(s.receiver.name)}</p>` },
        { name: 'picked', label: 'Đã lấy đủ hàng từ vị trí kệ', type: 'checkbox', required: true, wide: true },
        { name: 'packed', label: 'Đã đóng gói và dán tem vận đơn', type: 'checkbox', required: true, wide: true }
      ],
      onSubmit() {
        const r = store.changeStatus(s.code, 'packed', { note: 'Đã soạn hàng và đóng gói tại ' + whName(s.warehouseId) });
        if (r.error) return r.error;
        toast('Đã đóng gói ' + s.code + ', sẵn sàng phân công', 'success'); WMS.router.refresh();
        setTimeout(() => WMS.showLabel(s.code), 50); // mở luôn tem để in
      }
    });
  };
  WMS.pages['/packing'] = {
    title: 'Soạn hàng & in tem', roles: ['admin', 'wm', 'staff'],
    render(root) {
      const list = (st) => store.db.shipments.filter(s => s.status === st);
      const cols = (withPack) => [
        { label: 'Mã vận đơn', render: (s) => `<span class="mono">${s.code}</span>` },
        { label: 'Hàng hóa', render: (s) => esc(s.desc) + ` <span class="muted">(${s.weight} kg)</span>` },
        { label: 'Kho', render: (s) => esc(whName(s.warehouseId)) },
        { label: 'Người nhận', render: (s) => esc(s.receiver.name) },
        { label: '', render: (s) => `<div class="table__actions">${withPack ? `<button class="btn btn--sm" data-action="pack.do" data-code="${s.code}">Soạn & đóng gói</button>` : ''}<button class="btn btn--ghost btn--sm" data-action="label.view" data-code="${s.code}">${icon('qr')} Tem</button></div>` }
      ];
      root.innerHTML = pageHead('Soạn hàng, đóng gói & in tem', 'Đơn đã duyệt cần được soạn hàng; sau khi đóng gói, in tem QR dán lên kiện') +
        `<h2>Cần soạn hàng (${list('approved').length})</h2><div class="card card--flush mb-4">${table(cols(true), list('approved'), 'Không có đơn nào cần soạn')}</div>
        <h2>Đã đóng gói, chờ điều phối phân công (${list('packed').length})</h2><div class="card card--flush">${table(cols(false), list('packed'), 'Chưa có đơn nào')}</div>`;
    }
  };
})();
