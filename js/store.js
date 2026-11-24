/* Lớp dữ liệu: lưu trong localStorage (web tĩnh nên không có server).
   Mọi hàm nghiệp vụ trả về { ok: true, ... } hoặc { error: 'thông báo' }. */
WMS.store = (function () {
  const KEY = 'wms_db_v1', SESSION = 'wms_session';
  let db;

  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !db.users) { db = WMS.seed(); save(); }
    db.stocktakes = db.stocktakes || [];
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* hết dung lượng: bỏ qua */ }
  }
  function reset() { db = WMS.seed(); db.stocktakes = []; save(); localStorage.removeItem(SESSION); }
  function nextId(prefix, pad) {
    const n = db.seq[prefix] || 1;
    db.seq[prefix] = n + 1;
    return prefix + (pad ? String(n).padStart(pad, '0') : n);
  }
  const all = (col) => db[col];
  const byId = (col, id) => db[col].find(x => x.id === id);

  // ---------- Phiên đăng nhập ----------
  function currentUser() {
    const id = localStorage.getItem(SESSION);
    const u = id && db.users.find(x => x.id === id);
    return u && u.active ? u : null;
  }
  function login(username, password) {
    const u = db.users.find(x => x.username === username.trim().toLowerCase());
    if (!u || u.password !== password) return { error: 'Sai tên đăng nhập hoặc mật khẩu' };
    if (!u.active) return { error: 'Tài khoản đã bị khóa, hãy liên hệ Admin' };
    localStorage.setItem(SESSION, u.id);
    audit('Đăng nhập', u.name + ' đăng nhập', u.id);
    return { ok: true, user: u };
  }
  function logout() { localStorage.removeItem(SESSION); }

  // ---------- Audit log & thông báo ----------
  function audit(action, detail, userId) {
    const u = userId || (currentUser() && currentUser().id) || null;
    db.audit.unshift({ id: nextId('A'), time: Date.now(), userId: u, action, detail });
    db.audit = db.audit.slice(0, 300);
    save();
  }
  // to = { user: id } hoặc { role: 'dispatcher' }
  function notify(to, text, code) {
    db.notifications.unshift({ id: nextId('N'), to, text, code: code || '', time: Date.now(), read: false });
    db.notifications = db.notifications.slice(0, 200);
  }
  function myNotifications(user) {
    return db.notifications.filter(n => n.to.user === user.id || n.to.role === user.role);
  }

  // ---------- CRUD chung cho danh mục ----------
  function insert(col, prefix, obj, label) {
    obj.id = nextId(prefix);
    db[col].push(obj);
    audit('Thêm danh mục', `Thêm ${label}: ${obj.name || obj.code || obj.sku}`);
    save();
    return { ok: true, id: obj.id };
  }
  function update(col, id, patch, label) {
    const o = byId(col, id);
    if (!o) return { error: 'Không tìm thấy bản ghi' };
    Object.assign(o, patch);
    audit('Sửa danh mục', `Sửa ${label}: ${o.name || o.code || o.sku}`);
    save();
    return { ok: true };
  }
  function remove(col, id, label) {
    const o = byId(col, id);
    if (!o) return { error: 'Không tìm thấy bản ghi' };
    db[col] = db[col].filter(x => x.id !== id);
    audit('Xóa danh mục', `Xóa ${label}: ${o.name || o.code || o.sku}`);
    save();
    return { ok: true };
  }

  // ---------- Tài khoản ----------
  function register(d) {
    const username = d.username.trim().toLowerCase();
    if (db.users.some(u => u.username === username)) return { error: 'Tên đăng nhập đã tồn tại' };
    const u = { id: nextId('U'), username, password: d.password, name: d.name.trim(), role: 'customer', phone: d.phone, email: d.email, active: true };
    db.users.push(u);
    audit('Đăng ký', 'Khách hàng mới: ' + u.name, u.id);
    save();
    return { ok: true, user: u };
  }
  function updateUser(id, patch) {
    Object.assign(byId('users', id), patch);
    save();
  }

  // ---------- Kho ----------
  const stockRow = (wid, pid) => db.stock.find(s => s.warehouseId === wid && s.productId === pid);
  const qty = (wid, pid) => (stockRow(wid, pid) || { qty: 0 }).qty;
  function adjust(wid, pid, delta) {
    let r = stockRow(wid, pid);
    if (!r) {
      const loc = db.locations.find(l => l.warehouseId === wid);
      r = { warehouseId: wid, productId: pid, locationId: loc ? loc.id : '', qty: 0 };
      db.stock.push(r);
    }
    r.qty += delta;
  }
  const RECEIPT_PREFIX = { in: 'PN', out: 'PX', transfer: 'DC' };

  // Kiểm tra đủ tồn cho phiếu xuất / điều chuyển
  function checkEnough(r) {
    if (r.type === 'in') return null;
    for (const l of r.lines) {
      const have = qty(r.warehouseId, l.productId);
      if (l.qty > have) return `${byId('products', l.productId).name}: chỉ còn ${have}, không đủ ${l.qty}`;
    }
    return null;
  }
  function createReceipt(d) {
    // Gộp các dòng trùng sản phẩm
    const merged = {};
    d.lines.forEach(l => { if (l.productId && l.qty > 0) merged[l.productId] = (merged[l.productId] || 0) + l.qty; });
    const lines = Object.keys(merged).map(productId => ({ productId, qty: merged[productId] }));
    if (!lines.length) return { error: 'Cần ít nhất một dòng sản phẩm với số lượng > 0' };
    if (d.type === 'in' && !d.supplierId) return { error: 'Phiếu nhập cần chọn nhà cung cấp' };
    if (d.type === 'transfer' && d.warehouseId === d.toWarehouseId) return { error: 'Kho nguồn và kho đích phải khác nhau' };
    const r = {
      id: nextId(RECEIPT_PREFIX[d.type], 4), type: d.type, status: 'pending', warehouseId: d.warehouseId,
      toWarehouseId: d.toWarehouseId || '', supplierId: d.supplierId || '', lines, note: d.note || '',
      createdBy: currentUser().id, createdAt: Date.now()
    };
    const lack = checkEnough(r);
    if (lack) return { error: 'Không đủ tồn kho – ' + lack };
    db.receipts.unshift(r);
    audit('Tạo phiếu', 'Tạo phiếu ' + r.id);
    save();
    return { ok: true, id: r.id };
  }
  function approveReceipt(id) {
    const r = byId('receipts', id);
    if (!r || r.status !== 'pending') return { error: 'Phiếu không ở trạng thái chờ duyệt' };
    const lack = checkEnough(r); // kiểm tra lại vì tồn kho có thể đã thay đổi
    if (lack) return { error: 'Không đủ tồn kho – ' + lack };
    r.lines.forEach(l => {
      if (r.type === 'in') adjust(r.warehouseId, l.productId, l.qty);
      if (r.type === 'out') adjust(r.warehouseId, l.productId, -l.qty);
      if (r.type === 'transfer') { adjust(r.warehouseId, l.productId, -l.qty); adjust(r.toWarehouseId, l.productId, l.qty); }
    });
    r.status = 'approved'; r.approvedBy = currentUser().id; r.approvedAt = Date.now();
    audit('Duyệt phiếu', 'Duyệt phiếu ' + r.id);
    save();
    return { ok: true };
  }
  function rejectReceipt(id) {
    const r = byId('receipts', id);
    if (!r || r.status !== 'pending') return { error: 'Phiếu không ở trạng thái chờ duyệt' };
    r.status = 'rejected'; r.approvedBy = currentUser().id; r.approvedAt = Date.now();
    audit('Từ chối phiếu', 'Từ chối phiếu ' + r.id);
    save();
    return { ok: true };
  }
  // counts: { productId: số đếm thực tế }
  function applyStocktake(warehouseId, counts) {
    const lines = [];
    Object.keys(counts).forEach(pid => {
      const system = qty(warehouseId, pid), counted = counts[pid];
      if (counted !== system) adjust(warehouseId, pid, counted - system);
      lines.push({ productId: pid, system, counted });
    });
    const diff = lines.filter(l => l.system !== l.counted).length;
    db.stocktakes.unshift({ id: nextId('KK', 4), warehouseId, lines, createdBy: currentUser().id, createdAt: Date.now() });
    audit('Kiểm kê', `Kiểm kê ${byId('warehouses', warehouseId).name}: ${diff} mặt hàng chênh lệch`);
    save();
    return { ok: true, diff };
  }

  // ---------- Vận đơn ----------
  function calcFee(rateId, weight) {
    const r = byId('rates', rateId);
    if (!r || !(weight > 0)) return 0;
    return r.base + Math.ceil(Math.max(0, weight - 1)) * r.perKg; // 1kg đầu tính giá gốc, mỗi kg tiếp theo cộng thêm
  }
  function createShipment(d) {
    const user = currentUser(), route = byId('routes', d.routeId), rate = byId('rates', d.rateId);
    const now = Date.now();
    const s = {
      code: nextId('VD', 4), customerId: user.id, routeId: route.id, warehouseId: route.warehouseId, rateId: rate.id,
      sender: d.sender, receiver: d.receiver, desc: d.desc, weight: d.weight, fee: calcFee(rate.id, d.weight), cod: d.cod,
      status: 'pending', createdAt: now, dueAt: now + rate.sla * 864e5,
      history: [{ status: 'pending', time: now, note: WMS.NOTES.pending, by: user.name }],
      driverId: null, tripId: null, pod: null, attempts: 0, failReason: ''
    };
    db.shipments.unshift(s);
    notify({ role: 'dispatcher' }, `Đơn mới ${s.code} đang chờ duyệt`, s.code);
    audit('Tạo vận đơn', 'Tạo vận đơn ' + s.code);
    save();
    return { ok: true, code: s.code };
  }
  // Đổi trạng thái có kiểm tra hợp lệ theo máy trạng thái WMS.TRANSITIONS
  function changeStatus(code, to, opts) {
    opts = opts || {};
    const s = byId2(code), user = currentUser();
    if (!s) return { error: 'Không tìm thấy vận đơn' };
    if (!WMS.TRANSITIONS[s.status].includes(to)) {
      return { error: `Không thể chuyển từ "${WMS.STATUS[s.status].label}" sang "${WMS.STATUS[to].label}"` };
    }
    s.status = to;
    Object.assign(s, opts.patch || {});
    s.history.push({ status: to, time: Date.now(), note: opts.note || WMS.NOTES[to], by: user ? user.name : '' });
    notify({ user: s.customerId }, `Đơn ${s.code}: ${WMS.STATUS[to].label}`, s.code);
    if (to === 'failed' || to === 'delivered') notify({ role: 'dispatcher' }, `Đơn ${s.code}: ${WMS.STATUS[to].label}`, s.code);
    audit('Đổi trạng thái', `${s.code} → ${WMS.STATUS[to].label}`);
    save();
    return { ok: true };
  }
  const byId2 = (code) => db.shipments.find(s => s.code === code);
  // Gom nhiều đơn đã đóng gói thành một chuyến và giao cho tài xế
  function assignTrip(codes, driverId) {
    const list = codes.map(byId2);
    if (!list.length) return { error: 'Chưa chọn đơn nào' };
    if (list.some(s => !s || s.status !== 'packed')) return { error: 'Chỉ gom được các đơn ở trạng thái "Đã đóng gói"' };
    const driver = byId('users', driverId);
    const trip = { id: nextId('CH', 3), driverId, routeId: list[0].routeId, createdAt: Date.now(), codes: codes.slice() };
    db.trips.push(trip);
    list.forEach(s => changeStatus(s.code, 'assigned', { note: 'Đã giao cho tài xế ' + driver.name, patch: { driverId, tripId: trip.id } }));
    audit('Phân công', `Tạo chuyến ${trip.id} cho tài xế ${driver.name} (${codes.length} đơn)`);
    return { ok: true, id: trip.id };
  }
  function track(code) {
    return db.shipments.find(s => s.code === String(code).trim().toUpperCase()) || null;
  }

  load();
  return {
    all, byId, nextId, save, reset, login, logout, currentUser, audit, notify, myNotifications,
    insert, update, remove, register, updateUser, qty, adjust, createReceipt, approveReceipt, rejectReceipt,
    applyStocktake, calcFee, createShipment, changeStatus, assignTrip, track,
    get db() { return db; }
  };
})();
