/* Admin & thống kê: tổng quan (dashboard), báo cáo, người dùng/phân quyền, nhật ký hoạt động */
(function () {
  const { esc, tone, dt, date, money, toast, table, form, pageHead, filterBar, bindFilters, fv, kpi, bars, tabs, getTab } = WMS.ui;
  const store = WMS.store;
  const prod = (id) => store.byId('products', id) || { name: '?', sku: '?', minStock: 0 };
  const userName = (id) => (store.byId('users', id) || {}).name || 'Hệ thống / khách';
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

  // Thời điểm giao thành công của đơn (hoặc null) và đơn đó có đúng hạn không
  const deliveredAt = (s) => { const h = s.history.find(x => x.status === 'delivered'); return h ? h.time : null; };
  const isOnTime = (s) => deliveredAt(s) <= s.dueAt;
  const delivered = () => store.db.shipments.filter(s => s.status === 'delivered');
  const totalStock = () => store.db.stock.reduce((a, s) => a + s.qty, 0);
  const lowRows = () => store.db.stock.filter(s => s.qty < prod(s.productId).minStock);

  // ---------- Tổng quan ----------
  WMS.pages['/dashboard'] = {
    title: 'Tổng quan', roles: ['admin', 'wm', 'staff', 'dispatcher'],
    render(root, params, user) {
      const ships = store.db.shipments, role = user.role;
      const showWh = ['admin', 'wm', 'staff'].includes(role), showShip = ['admin', 'dispatcher'].includes(role);
      let tiles = '';
      if (showWh) tiles += kpi('Tổng số lượng tồn', totalStock().toLocaleString('vi-VN')) + kpi('Mặt hàng tồn thấp', lowRows().length, lowRows().length ? 'danger' : 'success') +
        kpi('Phiếu chờ duyệt', store.db.receipts.filter(r => r.status === 'pending').length, 'accent');
      if (showShip) tiles += kpi('Đơn chờ duyệt', ships.filter(s => s.status === 'pending').length, 'accent') +
        kpi('Đang vận chuyển', ships.filter(s => ['assigned', 'delivering'].includes(s.status)).length) +
        kpi('Giao thành công', delivered().length, 'success') + kpi('Tỷ lệ đúng hạn', pct(delivered().filter(isOnTime).length, delivered().length) + '%', 'success');
      if (role === 'staff' || role === 'wm') tiles += kpi('Đơn cần soạn hàng', ships.filter(s => s.status === 'approved').length, 'accent');

      const counts = Object.keys(WMS.STATUS).map(k => ({ label: WMS.STATUS[k].label, value: ships.filter(s => s.status === k).length, tone: k === 'failed' ? 'danger' : (k === 'delivered' ? 'success' : (k === 'pending' ? 'accent' : '')) }));
      const lowList = lowRows().slice(0, 6).map(s => `<li>${esc(prod(s.productId).name)} – còn <strong>${s.qty}</strong> (tối thiểu ${prod(s.productId).minStock})</li>`).join('');
      root.innerHTML = pageHead('Tổng quan', 'Xin chào ' + user.name + ' · ' + WMS.ROLES[role]) + `<div class="grid grid--kpi mb-4">${tiles}</div>
        <div class="grid grid--2">
          <section class="card"><h2 class="card__title">Vận đơn theo trạng thái</h2>${bars(counts)}</section>
          ${showWh ? `<section class="card"><h2 class="card__title">Cảnh báo tồn thấp</h2>${lowList ? `<ul>${lowList}</ul><a href="#/inventory">Xem tồn kho</a>` : '<p class="muted">Tất cả mặt hàng đều đủ tồn.</p>'}</section>` : ''}
          ${role === 'admin' ? `<section class="card"><h2 class="card__title">Hoạt động gần đây</h2><ul>${store.db.audit.slice(0, 6).map(a => `<li>${esc(a.detail)} <span class="muted">· ${dt(a.time)}</span></li>`).join('')}</ul><a href="#/audit">Xem toàn bộ nhật ký</a></section>` : ''}
        </div>`;
    }
  };

  // ---------- Báo cáo ----------
  const REPORT_TABS = {
    admin: [['stock', 'Tồn kho'], ['nxt', 'Nhập – xuất – tồn'], ['ontime', 'Giao đúng hạn'], ['drivers', 'Hiệu suất tài xế']],
    wm: [['stock', 'Tồn kho'], ['nxt', 'Nhập – xuất – tồn']],
    dispatcher: [['ontime', 'Giao đúng hạn'], ['drivers', 'Hiệu suất tài xế']]
  };

  function stockReport() {
    const rows = store.all('products').map(p => ({ p, qty: store.db.stock.filter(s => s.productId === p.id).reduce((a, s) => a + s.qty, 0) }));
    return `<div class="grid grid--2"><section class="card"><h2 class="card__title">Tồn theo sản phẩm</h2>${bars(rows.map(r => ({ label: r.p.name, value: r.qty, tone: r.qty < r.p.minStock ? 'danger' : '' })))}</section>
      <section class="card card--flush">${table([
        { label: 'SKU', render: (r) => esc(r.p.sku) }, { label: 'Sản phẩm', render: (r) => esc(r.p.name) },
        { label: 'Tồn', render: (r) => r.qty, cls: 'text-right' }, { label: 'Tối thiểu', render: (r) => r.p.minStock, cls: 'text-right' },
        { label: 'Tình trạng', render: (r) => r.qty < r.p.minStock ? tone('Tồn thấp', 'danger') : tone('Đủ', 'success') }
      ], rows)}</section></div>`;
  }

  // Tính nhập – xuất – tồn trong khoảng [from, to]. Tồn cuối kỳ = tồn hiện tại trừ biến động xảy ra SAU kỳ.
  function nxtRows(fromStr, toStr) {
    const from = fromStr ? new Date(fromStr + 'T00:00:00').getTime() : 0;
    const to = toStr ? new Date(toStr + 'T23:59:59').getTime() : Infinity;
    return store.all('products').map(p => {
      const cur = store.db.stock.filter(s => s.productId === p.id).reduce((a, s) => a + s.qty, 0);
      let inQ = 0, outQ = 0, after = 0;
      store.db.receipts.filter(r => r.status === 'approved' && r.type !== 'transfer').forEach(r => {
        const l = r.lines.find(x => x.productId === p.id);
        if (!l) return;
        const sign = r.type === 'in' ? 1 : -1;
        if (r.approvedAt > to) after += sign * l.qty;
        else if (r.approvedAt >= from) { if (sign > 0) inQ += l.qty; else outQ += l.qty; }
      });
      const closing = cur - after;
      return { p, opening: closing - inQ + outQ, inQ, outQ, closing };
    });
  }

  function driverRows() {
    return store.db.users.filter(u => u.role === 'driver').map(d => {
      const mine = store.db.shipments.filter(s => s.driverId === d.id);
      const ok = mine.filter(s => s.status === 'delivered');
      return {
        d, total: mine.length, ok: ok.length, failed: mine.filter(s => s.attempts > 0).length,
        onTime: pct(ok.filter(isOnTime).length, ok.length), cod: ok.reduce((a, s) => a + (s.codCollected != null ? s.codCollected : s.cod), 0)
      };
    });
  }

  WMS.pages['/reports'] = {
    title: 'Báo cáo', roles: ['admin', 'wm', 'dispatcher'],
    render(root, params, user) {
      const items = REPORT_TABS[user.role];
      let tab = getTab('reports', items[0][0]);
      if (!items.some(i => i[0] === tab)) tab = items[0][0];
      root.innerHTML = pageHead('Báo cáo thống kê') + tabs('reports', items, tab) + '<div id="report"></div>';
      const box = root.querySelector('#report');
      if (tab === 'stock') box.innerHTML = stockReport();
      if (tab === 'nxt') {
        box.innerHTML = `<div class="card card--flush">${filterBar('nxt', [{ name: 'from', kind: 'date', label: 'Từ ngày' }, { name: 'to', kind: 'date', label: 'Đến ngày' }])}<div id="results"></div></div>
          <p class="muted mt-4">Tồn đầu = tồn cuối − nhập + xuất trong kỳ. Phiếu điều chuyển nội bộ không tính vào nhập/xuất.</p>`;
        bindFilters(box, 'nxt', () => {
          const from = fv('nxt', 'from'), to = fv('nxt', 'to');
          if (from && to && from > to) { box.querySelector('#results').innerHTML = '<div class="form-alert" role="alert">"Từ ngày" phải trước "Đến ngày"</div>'; return; }
          box.querySelector('#results').innerHTML = table([
            { label: 'SKU', render: (r) => esc(r.p.sku) }, { label: 'Sản phẩm', render: (r) => esc(r.p.name) },
            { label: 'Tồn đầu', render: (r) => r.opening, cls: 'text-right' }, { label: 'Nhập', render: (r) => r.inQ, cls: 'text-right' },
            { label: 'Xuất', render: (r) => r.outQ, cls: 'text-right' }, { label: 'Tồn cuối', render: (r) => `<strong>${r.closing}</strong>`, cls: 'text-right' }
          ], nxtRows(from, to));
        });
      }
      if (tab === 'ontime') {
        const del = delivered(), on = del.filter(isOnTime).length;
        const byRoute = store.all('routes').map(r => { const l = del.filter(s => s.routeId === r.id); return { label: r.name, value: pct(l.filter(isOnTime).length, l.length), text: pct(l.filter(isOnTime).length, l.length) + '%', tone: 'success' }; });
        box.innerHTML = `<div class="grid grid--kpi mb-4">${kpi('Đơn giao thành công', del.length)}${kpi('Đúng hạn', on, 'success')}${kpi('Trễ hạn', del.length - on, 'danger')}${kpi('Tỷ lệ đúng hạn', pct(on, del.length) + '%', 'success')}</div>
          <div class="grid grid--2"><section class="card"><h2 class="card__title">Tỷ lệ đúng hạn theo tuyến</h2>${bars(byRoute)}</section>
          <section class="card card--flush">${table([
            { label: 'Mã đơn', render: (s) => `<span class="mono">${s.code}</span>` }, { label: 'Hạn giao', render: (s) => date(s.dueAt) },
            { label: 'Giao lúc', render: (s) => dt(deliveredAt(s)) }, { label: 'Kết quả', render: (s) => isOnTime(s) ? tone('Đúng hạn', 'success') : tone('Trễ hạn', 'danger') }
          ], del)}</section></div>`;
      }
      if (tab === 'drivers') {
        const rows = driverRows();
        box.innerHTML = `<div class="grid grid--2"><section class="card"><h2 class="card__title">Tỷ lệ giao đúng hạn</h2>${bars(rows.map(r => ({ label: r.d.name, value: r.onTime, text: r.onTime + '%', tone: 'success' })))}</section>
          <section class="card card--flush">${table([
            { label: 'Tài xế', render: (r) => esc(r.d.name) }, { label: 'Tổng đơn', render: (r) => r.total, cls: 'text-right' },
            { label: 'Thành công', render: (r) => r.ok, cls: 'text-right' }, { label: 'Từng thất bại', render: (r) => r.failed, cls: 'text-right' },
            { label: 'Đúng hạn', render: (r) => r.onTime + '%', cls: 'text-right' }, { label: 'COD đã thu', render: (r) => money(r.cod), cls: 'text-right' }
          ], rows)}</section></div>`;
      }
    }
  };

  // ---------- Người dùng & phân quyền (RBAC) ----------
  WMS.changes['user.role'] = (el) => {
    store.updateUser(el.dataset.id, { role: el.value });
    store.audit('Phân quyền', `Đổi vai trò ${userName(el.dataset.id)} thành ${WMS.ROLES[el.value]}`);
    toast('Đã đổi vai trò', 'success'); WMS.router.refresh();
  };
  WMS.actions['user.toggle'] = (el) => {
    const u = store.byId('users', el.dataset.id);
    store.updateUser(u.id, { active: !u.active });
    store.audit(u.active ? 'Mở khóa' : 'Khóa tài khoản', u.name);
    WMS.router.refresh();
  };
  WMS.actions['user.new'] = () => {
    form({
      title: 'Tạo tài khoản nhân sự', submitText: 'Tạo tài khoản',
      fields: [
        { name: 'name', label: 'Họ và tên', required: true, wide: true, minlength: 2 },
        { name: 'username', label: 'Tên đăng nhập', required: true, pattern: WMS.RE.username, patternMsg: '4-20 ký tự: chữ thường, số hoặc _' },
        { name: 'role', label: 'Vai trò', type: 'select', required: true, options: Object.keys(WMS.ROLES).map(k => [k, WMS.ROLES[k]]) },
        { name: 'phone', label: 'Số điện thoại', type: 'tel', required: true, pattern: WMS.RE.phone, patternMsg: 'Số điện thoại không hợp lệ' },
        { name: 'email', label: 'Email', type: 'email', required: true, pattern: WMS.RE.email, patternMsg: 'Email không hợp lệ' },
        { name: 'password', label: 'Mật khẩu', type: 'password', required: true, minlength: 6, wide: true }
      ],
      onSubmit(v) {
        const r = store.register(v);
        if (r.error) return r.error;
        store.updateUser(r.user.id, { role: v.role });
        toast('Đã tạo tài khoản ' + v.username, 'success'); WMS.router.refresh();
      }
    });
  };
  WMS.pages['/users'] = {
    title: 'Người dùng & phân quyền', roles: ['admin'],
    render(root, params, me) {
      root.innerHTML = pageHead('Người dùng & phân quyền', 'Gán vai trò, khóa/mở khóa tài khoản', '<button class="btn" data-action="user.new">+ Tạo tài khoản</button>') +
        `<div class="card card--flush">${table([
          { label: 'Họ tên', render: (u) => esc(u.name) }, { label: 'Tài khoản', render: (u) => `<span class="mono">${esc(u.username)}</span>` },
          { label: 'Liên hệ', render: (u) => esc(u.phone) },
          {
            label: 'Vai trò', render: (u) => `<select class="field__input select--role" data-change="user.role" data-id="${u.id}" aria-label="Vai trò của ${esc(u.name)}" ${u.id === me.id ? 'disabled' : ''}>${Object.keys(WMS.ROLES).map(k => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${WMS.ROLES[k]}</option>`).join('')}</select>`
          },
          { label: 'Trạng thái', render: (u) => u.active ? tone('Hoạt động', 'success') : tone('Đã khóa', 'danger') },
          { label: '', render: (u) => u.id === me.id ? '<span class="muted">Tài khoản của bạn</span>' : `<button class="btn btn--ghost btn--sm" data-action="user.toggle" data-id="${u.id}">${u.active ? 'Khóa' : 'Mở khóa'}</button>` }
        ], store.all('users'))}</div>`;
    }
  };

  // ---------- Nhật ký hoạt động (audit log) ----------
  WMS.pages['/audit'] = {
    title: 'Nhật ký hoạt động', roles: ['admin'],
    render(root) {
      const key = 'audit';
      root.innerHTML = pageHead('Nhật ký hoạt động', 'Mọi thao tác quan trọng đều được ghi lại') +
        `<div class="card card--flush">${filterBar(key, [{ name: 'q', label: 'Tìm theo nội dung hoặc hành động' }, { name: 'user', kind: 'select', label: 'Mọi người dùng', options: store.all('users').map(u => [u.id, u.name]) }])}<div id="results"></div></div>`;
      bindFilters(root, key, () => {
        const q = fv(key, 'q').toLowerCase(), u = fv(key, 'user');
        const rows = store.db.audit.filter(a => (!u || a.userId === u) && (!q || (a.action + ' ' + a.detail).toLowerCase().includes(q))).slice(0, 100);
        root.querySelector('#results').innerHTML = table([
          { label: 'Thời gian', render: (a) => dt(a.time), cls: 'nowrap' }, { label: 'Người thực hiện', render: (a) => esc(userName(a.userId)) },
          { label: 'Hành động', render: (a) => tone(a.action, 'primary') }, { label: 'Chi tiết', render: (a) => esc(a.detail) }
        ], rows, 'Không có bản ghi phù hợp');
      });
    }
  };
})();
