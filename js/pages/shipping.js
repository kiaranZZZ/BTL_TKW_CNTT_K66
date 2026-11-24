/* Module vận đơn: khách tạo đơn, điều phối duyệt/phân công, tài xế giao hàng (POD, COD) */
(function () {
  const { esc, badge, tone, dt, date, money, toast, table, form, modal, confirmDialog, pageHead, filterBar, bindFilters, fv, icon, kpi } = WMS.ui;
  const store = WMS.store;
  const routeName = (id) => (store.byId('routes', id) || {}).name || '';
  const userName = (id) => (store.byId('users', id) || {}).name || '—';
  const code = (s) => `<span class="mono">${s.code}</span>`;
  const statusOptions = () => Object.keys(WMS.STATUS).map(k => [k, WMS.STATUS[k].label]);

  // ---------- Chi tiết vận đơn (dùng cho mọi vai trò) ----------
  WMS.actions['ship.view'] = (el) => {
    const s = store.track(el.dataset.code);
    const pod = s.pod ? `<h3>Xác nhận giao hàng (POD)</h3><p>Người nhận: <strong>${esc(s.pod.receiver)}</strong> · ${dt(s.pod.time)}${s.pod.note ? ' · ' + esc(s.pod.note) : ''}</p>
      ${s.pod.signature ? `<img class="pod-sig" src="${s.pod.signature}" alt="Chữ ký người nhận" width="260">` : ''}` : '';
    modal({
      title: 'Vận đơn ' + s.code, size: 'lg',
      body: `<p>${badge(s.status)} <span class="muted">${esc(routeName(s.routeId))}</span></p>
        <dl class="info-list">
          <div><dt>Người gửi</dt><dd>${esc(s.sender.name)} · ${esc(s.sender.phone)}<br><span class="muted">${esc(s.sender.address)}</span></dd></div>
          <div><dt>Người nhận</dt><dd>${esc(s.receiver.name)} · ${esc(s.receiver.phone)}<br><span class="muted">${esc(s.receiver.address)}</span></dd></div>
          <div><dt>Hàng hóa</dt><dd>${esc(s.desc)} · ${s.weight} kg</dd></div>
          <div><dt>Cước phí</dt><dd>${money(s.fee)}</dd></div><div><dt>Thu hộ COD</dt><dd>${s.cod ? money(s.cod) : 'Không'}</dd></div>
          <div><dt>Tài xế</dt><dd>${esc(userName(s.driverId))}</dd></div><div><dt>Hạn giao</dt><dd>${date(s.dueAt)}</dd></div></dl>${pod}
        <h3>Hành trình</h3><ol class="timeline">${s.history.slice().reverse().map(h => `<li class="timeline__item"><strong>${WMS.STATUS[h.status].label}</strong><div>${esc(h.note)}${h.by ? ` <span class="muted">· ${esc(h.by)}</span>` : ''}</div><div class="timeline__time">${dt(h.time)}</div></li>`).join('')}</ol>`,
      footer: `<a class="btn btn--ghost" href="#/track?code=${s.code}">Trang tra cứu công khai</a><button class="btn" data-action="label.view" data-code="${s.code}">${icon('qr')} Xem tem</button>`
    });
  };

  // Đổi trạng thái đơn giản có xác nhận (duyệt, hủy…)
  function transition(el, to, msg, opts) {
    confirmDialog(msg, () => {
      const r = store.changeStatus(el.dataset.code, to);
      if (r.error) toast(r.error, 'error'); else toast('Đã cập nhật ' + el.dataset.code, 'success');
      WMS.router.refresh();
    }, opts);
  }
  WMS.actions['ship.approve'] = (el) => transition(el, 'approved', 'Duyệt đơn ' + el.dataset.code + '?', { yesText: 'Duyệt' });
  WMS.actions['ship.cancel'] = (el) => transition(el, 'cancelled', 'Hủy đơn ' + el.dataset.code + '? Thao tác này không hoàn tác được.', { danger: true, yesText: 'Hủy đơn' });

  // ---------- Khách hàng: tạo đơn & đơn của tôi ----------
  WMS.actions['ship.new'] = () => {
    const user = store.currentUser();
    const fields = [
      { name: 'sName', label: 'Người gửi', required: true },
      { name: 'sPhone', label: 'SĐT người gửi', type: 'tel', required: true, pattern: WMS.RE.phone, patternMsg: 'Số điện thoại không hợp lệ' },
      { name: 'sAddr', label: 'Địa chỉ lấy hàng', required: true, wide: true },
      { name: 'rName', label: 'Người nhận', required: true },
      { name: 'rPhone', label: 'SĐT người nhận', type: 'tel', required: true, pattern: WMS.RE.phone, patternMsg: 'Số điện thoại không hợp lệ' },
      { name: 'rAddr', label: 'Địa chỉ giao hàng', required: true, wide: true },
      { name: 'routeId', label: 'Tuyến vận chuyển', type: 'select', required: true, options: () => store.all('routes').map(r => [r.id, r.name]) },
      { name: 'rateId', label: 'Dịch vụ', type: 'select', required: true, options: () => store.all('rates').map(r => [r.id, r.name]) },
      { name: 'desc', label: 'Mô tả hàng hóa', required: true, wide: true },
      { name: 'weight', label: 'Khối lượng (kg)', type: 'number', required: true, min: 0.1, max: 50, step: '0.1' },
      { name: 'cod', label: 'Tiền thu hộ COD (₫)', type: 'number', required: true, min: 0, max: 50000000 },
      { type: 'custom', html: '<div class="card card--compact"><strong>Cước phí tạm tính: <span id="fee-preview">—</span></strong></div>' }
    ];
    form({
      title: 'Tạo đơn gửi hàng', fields, size: 'lg', submitText: 'Tạo đơn',
      values: { sName: user.name, sPhone: user.phone, weight: 1, cod: 0, desc: '' },
      onMount(el) {
        const f = el.querySelector('form');
        const upd = () => { el.querySelector('#fee-preview').textContent = WMS.ui.money(store.calcFee(f.elements.rateId.value, parseFloat(f.elements.weight.value))); };
        ['rateId', 'weight'].forEach(n => f.elements[n].addEventListener('input', upd));
        upd();
      },
      onSubmit(v) {
        const r = store.createShipment({
          routeId: v.routeId, rateId: v.rateId, desc: v.desc, weight: v.weight, cod: v.cod,
          sender: { name: v.sName, phone: v.sPhone, address: v.sAddr }, receiver: { name: v.rName, phone: v.rPhone, address: v.rAddr }
        });
        toast('Đã tạo vận đơn ' + r.code, 'success'); WMS.router.refresh();
      }
    });
  };

  // Bảng vận đơn dùng chung cho khách hàng và điều phối
  function shipmentCols(user, withSelect) {
    const cols = [];
    if (withSelect) cols.push({ label: 'Chọn', render: (s) => s.status === 'packed' ? `<input type="checkbox" class="sel" value="${s.code}" aria-label="Chọn ${s.code}">` : '' });
    cols.push(
      { label: 'Mã vận đơn', render: code },
      { label: 'Người nhận', render: (s) => esc(s.receiver.name) },
      { label: 'Tuyến', render: (s) => esc(routeName(s.routeId)) },
      { label: 'Trạng thái', render: (s) => badge(s.status) },
      { label: 'Tài xế', render: (s) => esc(userName(s.driverId)) },
      { label: 'Cước / COD', render: (s) => `${money(s.fee)}<br><span class="muted">COD ${s.cod ? money(s.cod) : '0 ₫'}</span>`, cls: 'text-right' },
      {
        label: '', render: (s) => {
          let a = `<button class="btn btn--ghost btn--sm" data-action="ship.view" data-code="${s.code}">Chi tiết</button>`;
          if (user.role !== 'customer' && s.status === 'pending') a += `<button class="btn btn--sm" data-action="ship.approve" data-code="${s.code}">Duyệt</button>`;
          const canCancel = user.role === 'customer' ? s.status === 'pending' : (s.status === 'pending' || s.status === 'approved');
          if (canCancel) a += `<button class="btn btn--ghost btn--sm" data-action="ship.cancel" data-code="${s.code}">Hủy</button>`;
          return `<div class="table__actions">${a}</div>`;
        }
      });
    return cols;
  }

  WMS.pages['/my-shipments'] = {
    title: 'Đơn của tôi', roles: ['customer'],
    render(root, params, user) {
      const key = 'myship';
      root.innerHTML = pageHead('Đơn của tôi', 'Tạo đơn gửi hàng và theo dõi tiến trình', '<button class="btn btn--accent" data-action="ship.new">+ Tạo đơn mới</button>') +
        `<div class="card card--flush">${filterBar(key, [{ name: 'q', label: 'Tìm theo mã đơn hoặc người nhận' }, { name: 'status', kind: 'select', label: 'Mọi trạng thái', options: statusOptions() }])}<div id="results"></div></div>`;
      bindFilters(root, key, () => {
        const q = fv(key, 'q').toLowerCase(), st = fv(key, 'status');
        const rows = store.db.shipments.filter(s => s.customerId === user.id && (!st || s.status === st) && (!q || (s.code + ' ' + s.receiver.name).toLowerCase().includes(q)));
        root.querySelector('#results').innerHTML = table(shipmentCols(user, false), rows, 'Bạn chưa có đơn nào');
      });
    }
  };

  // ---------- Điều phối: quản lý vận đơn, gom chuyến ----------
  const drivers = () => store.db.users.filter(u => u.role === 'driver' && u.active);
  const activeLoad = (id) => store.db.shipments.filter(s => s.driverId === id && ['assigned', 'delivering', 'failed'].includes(s.status)).length;

  WMS.actions['trip.assign'] = () => {
    const codes = [...document.querySelectorAll('.sel:checked')].map(c => c.value);
    if (!codes.length) { toast('Hãy chọn ít nhất một đơn "Đã đóng gói" để gom chuyến', 'error'); return; }
    form({
      title: `Gom chuyến (${codes.length} đơn) & phân công`, submitText: 'Phân công',
      fields: [
        { type: 'custom', html: `<p>Các đơn: <span class="mono">${codes.join(', ')}</span></p>` },
        { name: 'driverId', label: 'Tài xế', type: 'select', required: true, placeholder: '-- Chọn tài xế --', wide: true, options: () => drivers().map(d => [d.id, `${d.name} (đang giữ ${activeLoad(d.id)} đơn)`]) }
      ],
      onSubmit(v) {
        const r = store.assignTrip(codes, v.driverId);
        if (r.error) return r.error;
        toast('Đã tạo chuyến ' + r.id, 'success'); WMS.router.refresh();
      }
    });
  };
  WMS.pages['/shipments'] = {
    title: 'Quản lý vận đơn', roles: ['admin', 'dispatcher'],
    render(root, params, user) {
      const key = 'shipments';
      root.innerHTML = pageHead('Quản lý vận đơn', 'Duyệt đơn, gom chuyến và phân công tài xế', '<button class="btn btn--accent" data-action="trip.assign">Gom chuyến & phân công</button>') +
        `<div class="card card--flush">${filterBar(key, [
          { name: 'q', label: 'Tìm theo mã, người nhận, tài xế' },
          { name: 'status', kind: 'select', label: 'Mọi trạng thái', options: statusOptions() },
          { name: 'route', kind: 'select', label: 'Mọi tuyến', options: store.all('routes').map(r => [r.id, r.name]) }
        ])}<div id="results"></div></div>`;
      bindFilters(root, key, () => {
        const q = fv(key, 'q').toLowerCase(), st = fv(key, 'status'), rt = fv(key, 'route');
        const rows = store.db.shipments.filter(s => (!st || s.status === st) && (!rt || s.routeId === rt) && (!q || (s.code + ' ' + s.receiver.name + ' ' + userName(s.driverId)).toLowerCase().includes(q)));
        root.querySelector('#results').innerHTML = table(shipmentCols(user, true), rows, 'Không có vận đơn phù hợp');
      });
    }
  };

  // ---------- Tuyến & tài xế ----------
  WMS.pages['/routes'] = {
    title: 'Tuyến & tài xế', roles: ['admin', 'dispatcher'],
    render(root) {
      const tab = WMS.ui.getTab('routes', 'routes');
      let body;
      if (tab === 'routes') body = WMS.crudHtml('routes');
      else {
        body = '<div class="card card--flush">' + table([
          { label: 'Tài xế', render: (d) => esc(d.name) }, { label: 'Điện thoại', render: (d) => esc(d.phone) },
          { label: 'Đơn đang giữ', render: (d) => activeLoad(d.id), cls: 'text-right' },
          { label: 'Số chuyến', render: (d) => store.db.trips.filter(t => t.driverId === d.id).length, cls: 'text-right' },
          { label: 'Tình trạng', render: (d) => activeLoad(d.id) ? tone('Đang bận', 'warn') : tone('Sẵn sàng', 'success') }
        ], drivers(), 'Chưa có tài xế') + '</div>';
      }
      root.innerHTML = pageHead('Tuyến & tài xế', 'Quản lý tuyến vận chuyển và theo dõi tải của tài xế') + WMS.ui.tabs('routes', [['routes', 'Tuyến vận chuyển'], ['drivers', 'Tài xế']], tab) + body;
    }
  };

  // ---------- Tài xế ----------
  function setupSignature(canvas) {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth; canvas.height = 150;
    const clear = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); canvas.dataset.drawn = ''; };
    clear();
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#0f172a';
    let drawing = false;
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', (e) => { drawing = true; canvas.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); canvas.dataset.drawn = '1'; });
    canvas.addEventListener('pointermove', (e) => { if (drawing) { ctx.lineTo(...pos(e)); ctx.stroke(); } });
    ['pointerup', 'pointercancel'].forEach(ev => canvas.addEventListener(ev, () => { drawing = false; }));
    canvas.clear = clear;
  }
  WMS.actions['sig.clear'] = (el) => el.closest('.modal').querySelector('canvas').clear();

  function driverAction(el, to, note) {
    const r = store.changeStatus(el.dataset.code, to, { note });
    if (r.error) toast(r.error, 'error'); else toast('Đã cập nhật ' + el.dataset.code, 'success');
    WMS.router.refresh();
  }
  WMS.actions['drv.start'] = (el) => driverAction(el, 'delivering');
  WMS.actions['drv.retry'] = (el) => { const s = store.track(el.dataset.code); driverAction(el, 'delivering', 'Giao lại lần ' + (s.attempts + 1)); };
  WMS.actions['drv.return'] = (el) => confirmDialog('Hoàn đơn ' + el.dataset.code + ' về kho?', () => driverAction(el, 'returned'), { danger: true, yesText: 'Hoàn hàng' });

  WMS.actions['drv.done'] = (el) => {
    const s = store.track(el.dataset.code);
    const fields = [
      { name: 'receiver', label: 'Người nhận hàng', required: true, wide: true },
      { type: 'custom', html: '<div class="field__label">Chữ ký người nhận (POD) <span class="field__req">*</span></div><canvas class="signature" aria-label="Khung ký tên"></canvas><button type="button" class="btn btn--ghost btn--sm sig-clear" data-action="sig.clear">Xóa chữ ký</button>' }
    ];
    if (s.cod) fields.push({ name: 'codOk', label: 'Đã thu đủ tiền COD: ' + money(s.cod), type: 'checkbox', required: true, wide: true });
    fields.push({ name: 'note', label: 'Ghi chú', type: 'textarea', wide: true });
    form({
      title: 'Xác nhận giao thành công ' + s.code, fields, values: { receiver: s.receiver.name }, submitText: 'Hoàn tất giao hàng',
      onMount: (m) => setupSignature(m.querySelector('canvas')),
      onSubmit(v, m) {
        const canvas = m.querySelector('canvas');
        if (!canvas.dataset.drawn) return 'Người nhận cần ký xác nhận (POD)';
        const r = store.changeStatus(s.code, 'delivered', { note: 'Giao hàng thành công, người nhận: ' + v.receiver, patch: { pod: { receiver: v.receiver, note: v.note, time: Date.now(), signature: canvas.toDataURL('image/png') }, codCollected: s.cod } });
        if (r.error) return r.error;
        toast('Giao thành công' + (s.cod ? ', đã thu COD ' + money(s.cod) : ''), 'success'); WMS.router.refresh();
      }
    });
  };
  WMS.actions['drv.fail'] = (el) => {
    const s = store.track(el.dataset.code);
    form({
      title: 'Giao thất bại ' + s.code, submitText: 'Xác nhận thất bại',
      fields: [
        { name: 'reason', label: 'Lý do', type: 'select', required: true, placeholder: '-- Chọn lý do --', wide: true, options: [['Không liên lạc được người nhận', 'Không liên lạc được người nhận'], ['Khách từ chối nhận', 'Khách từ chối nhận'], ['Sai/thiếu địa chỉ', 'Sai/thiếu địa chỉ'], ['Khách hẹn giao lại', 'Khách hẹn giao lại']] },
        { name: 'note', label: 'Ghi chú thêm', type: 'textarea', wide: true }
      ],
      onSubmit(v) {
        const r = store.changeStatus(s.code, 'failed', { note: 'Giao hàng thất bại: ' + v.reason + (v.note ? ' (' + v.note + ')' : ''), patch: { attempts: s.attempts + 1, failReason: v.reason } });
        if (r.error) return r.error;
        toast('Đã ghi nhận giao thất bại', 'success'); WMS.router.refresh();
      }
    });
  };

  WMS.pages['/driver'] = {
    title: 'Chuyến giao hàng', roles: ['driver'],
    render(root, params, user) {
      const mine = store.db.shipments.filter(s => s.driverId === user.id);
      const active = mine.filter(s => ['assigned', 'delivering', 'failed'].includes(s.status));
      const done = mine.filter(s => ['delivered', 'returned'].includes(s.status));
      const tab = WMS.ui.getTab('driver', 'active');
      const cod = active.filter(s => s.status !== 'failed').reduce((a, s) => a + s.cod, 0);
      const card = (s) => {
        let acts = '';
        if (s.status === 'assigned') acts = `<button class="btn" data-action="drv.start" data-code="${s.code}">Bắt đầu giao</button>`;
        if (s.status === 'delivering') acts = `<button class="btn" data-action="drv.done" data-code="${s.code}">Giao thành công</button><button class="btn btn--ghost" data-action="drv.fail" data-code="${s.code}">Thất bại</button>`;
        if (s.status === 'failed') acts = `<button class="btn" data-action="drv.retry" data-code="${s.code}">Giao lại</button><button class="btn btn--ghost" data-action="drv.return" data-code="${s.code}">Hoàn hàng</button>`;
        return `<article class="card job"><div class="page-head page-head--flush"><strong class="mono">${s.code}</strong>${badge(s.status)}</div>
          <div><strong>${esc(s.receiver.name)}</strong> · <a href="tel:${esc(s.receiver.phone)}">${esc(s.receiver.phone)}</a></div>
          <div class="muted">${esc(s.receiver.address)}</div><div>${esc(s.desc)} · ${s.weight} kg</div>
          <div>${s.cod ? `Thu hộ COD: <strong>${money(s.cod)}</strong>` : 'Không thu COD'}</div>
          ${s.failReason && s.status === 'failed' ? `<div class="form-alert">Lý do thất bại: ${esc(s.failReason)} (lần ${s.attempts})</div>` : ''}
          <div class="job__actions">${acts}<button class="btn btn--ghost" data-action="ship.view" data-code="${s.code}">Chi tiết</button></div></article>`;
      };
      const list = tab === 'active' ? active : done;
      root.innerHTML = pageHead('Chuyến giao hàng', 'Xin chào ' + user.name) +
        `<div class="grid grid--kpi mb-4">${kpi('Đơn cần xử lý', active.length, 'accent')}${kpi('COD sắp thu', money(cod))}${kpi('Đã hoàn tất', done.length, 'success')}</div>` +
        WMS.ui.tabs('driver', [['active', `Cần giao (${active.length})`], ['done', `Đã xong (${done.length})`]], tab) +
        (list.length ? `<div class="card-list">${list.map(card).join('')}</div>` : '<div class="card table__empty">Không có đơn nào</div>');
    }
  };
})();
