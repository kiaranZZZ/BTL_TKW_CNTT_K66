/* Dữ liệu mẫu nạp vào localStorage lần đầu (và khi bấm "Reset dữ liệu demo") */
WMS.seed = function () {
  const now = Date.now(), H = 3600e3, D = 24 * H;
  const pass = '123456'; // chỉ là demo, không dùng mật khẩu thật

  const users = [
    { id: 'U1', username: 'admin', password: pass, name: 'Nguyễn Quản Trị', role: 'admin', phone: '0900000001', email: 'admin@wms.vn', active: true },
    { id: 'U2', username: 'qlkho', password: pass, name: 'Trần Thị Kho', role: 'wm', phone: '0900000002', email: 'qlkho@wms.vn', active: true },
    { id: 'U3', username: 'nvkho', password: pass, name: 'Lê Văn Kệ', role: 'staff', phone: '0900000003', email: 'nvkho@wms.vn', active: true },
    { id: 'U4', username: 'dieuphoi', password: pass, name: 'Phạm Điều Phối', role: 'dispatcher', phone: '0900000004', email: 'dieuphoi@wms.vn', active: true },
    { id: 'U5', username: 'taixe1', password: pass, name: 'Hoàng Văn Tài', role: 'driver', phone: '0900000005', email: 'taixe1@wms.vn', active: true },
    { id: 'U6', username: 'taixe2', password: pass, name: 'Đỗ Minh Xế', role: 'driver', phone: '0900000006', email: 'taixe2@wms.vn', active: true },
    { id: 'U7', username: 'khach1', password: pass, name: 'Nguyễn Thu Hà (Shop Hoa Sen)', role: 'customer', phone: '0912345678', email: 'khach1@mail.com', active: true }
  ];

  const warehouses = [
    { id: 'W1', name: 'Kho Hà Nội', address: 'KCN Đông Anh, Hà Nội' },
    { id: 'W2', name: 'Kho TP.HCM', address: 'Thủ Đức, TP.HCM' }
  ];
  const locations = [
    { id: 'L1', warehouseId: 'W1', code: 'A1-01' }, { id: 'L2', warehouseId: 'W1', code: 'A1-02' },
    { id: 'L3', warehouseId: 'W1', code: 'B2-01' }, { id: 'L4', warehouseId: 'W2', code: 'A1-01' },
    { id: 'L5', warehouseId: 'W2', code: 'C3-02' }
  ];
  const products = [
    { id: 'P1', sku: 'ATC-01', name: 'Áo thun cotton', unit: 'cái', minStock: 50, price: 120000 },
    { id: 'P2', sku: 'QJ-02', name: 'Quần jean nam', unit: 'cái', minStock: 30, price: 350000 },
    { id: 'P3', sku: 'GSN-03', name: 'Giày sneaker', unit: 'đôi', minStock: 20, price: 650000 },
    { id: 'P4', sku: 'BL-04', name: 'Balo laptop', unit: 'cái', minStock: 15, price: 420000 },
    { id: 'P5', sku: 'MLT-05', name: 'Mũ lưỡi trai', unit: 'cái', minStock: 40, price: 80000 },
    { id: 'P6', sku: 'TN-06', name: 'Tai nghe bluetooth', unit: 'cái', minStock: 25, price: 290000 },
    { id: 'P7', sku: 'SDP-07', name: 'Sạc dự phòng 10000mAh', unit: 'cái', minStock: 30, price: 250000 },
    { id: 'P8', sku: 'OL-08', name: 'Ốp lưng điện thoại', unit: 'cái', minStock: 60, price: 45000 }
  ];
  const stock = [
    { warehouseId: 'W1', productId: 'P1', locationId: 'L1', qty: 180 }, { warehouseId: 'W1', productId: 'P2', locationId: 'L2', qty: 75 },
    { warehouseId: 'W1', productId: 'P3', locationId: 'L3', qty: 14 }, { warehouseId: 'W1', productId: 'P5', locationId: 'L1', qty: 120 },
    { warehouseId: 'W1', productId: 'P8', locationId: 'L2', qty: 40 }, { warehouseId: 'W2', productId: 'P4', locationId: 'L4', qty: 60 },
    { warehouseId: 'W2', productId: 'P6', locationId: 'L5', qty: 22 }, { warehouseId: 'W2', productId: 'P7', locationId: 'L5', qty: 90 },
    { warehouseId: 'W2', productId: 'P1', locationId: 'L4', qty: 65 }
  ];
  const suppliers = [
    { id: 'S1', name: 'Công ty May Việt Tiến', phone: '0281111222', address: 'Quận Tân Bình, TP.HCM' },
    { id: 'S2', name: 'Xưởng giày Thăng Long', phone: '0243333444', address: 'Hà Đông, Hà Nội' },
    { id: 'S3', name: 'Điện tử Hoàng Gia', phone: '0245556677', address: 'Cầu Giấy, Hà Nội' }
  ];
  const rates = [
    { id: 'R1', name: 'Tiêu chuẩn (3 ngày)', base: 20000, perKg: 5000, sla: 3 },
    { id: 'R2', name: 'Nhanh (1 ngày)', base: 35000, perKg: 8000, sla: 1 }
  ];
  const routes = [
    { id: 'T1', name: 'Nội thành Hà Nội', warehouseId: 'W1' },
    { id: 'T2', name: 'Nội thành TP.HCM', warehouseId: 'W2' },
    { id: 'T3', name: 'Liên tỉnh Hà Nội – TP.HCM', warehouseId: 'W1' }
  ];

  const receipts = [
    { id: 'PN0001', type: 'in', status: 'approved', warehouseId: 'W1', supplierId: 'S1', lines: [{ productId: 'P1', qty: 100 }, { productId: 'P2', qty: 40 }], createdBy: 'U3', createdAt: now - 6 * D, approvedBy: 'U2', approvedAt: now - 5.9 * D, note: 'Nhập hàng đầu tháng' },
    { id: 'PN0002', type: 'in', status: 'approved', warehouseId: 'W2', supplierId: 'S3', lines: [{ productId: 'P6', qty: 30 }, { productId: 'P7', qty: 50 }], createdBy: 'U3', createdAt: now - 4 * D, approvedBy: 'U2', approvedAt: now - 3.9 * D, note: '' },
    { id: 'PX0001', type: 'out', status: 'approved', warehouseId: 'W1', lines: [{ productId: 'P1', qty: 20 }, { productId: 'P5', qty: 15 }], createdBy: 'U3', createdAt: now - 3 * D, approvedBy: 'U2', approvedAt: now - 2.9 * D, note: 'Xuất cho đơn sỉ' },
    { id: 'PX0002', type: 'out', status: 'pending', warehouseId: 'W1', lines: [{ productId: 'P3', qty: 4 }], createdBy: 'U3', createdAt: now - 3 * H, note: 'Chờ duyệt' },
    { id: 'DC0001', type: 'transfer', status: 'pending', warehouseId: 'W1', toWarehouseId: 'W2', lines: [{ productId: 'P1', qty: 30 }], createdBy: 'U3', createdAt: now - 2 * H, note: 'Bổ sung hàng cho kho HCM' }
  ];

  const addr = {
    a: '25 Phố Huế, Hai Bà Trưng, Hà Nội', b: '12 Nguyễn Huệ, Quận 1, TP.HCM', c: '88 Cầu Giấy, Hà Nội',
    d: '5 Lê Văn Việt, Thủ Đức, TP.HCM', e: '102 Trần Phú, Hà Đông, Hà Nội'
  };
  const notes = WMS.NOTES;
  const FULL = ['pending', 'approved', 'packed', 'assigned', 'delivering'];

  // Tạo một vận đơn mẫu cùng lịch sử trạng thái
  function ship(n, o) {
    const rate = rates.find(r => r.id === (o.rate || 'R1'));
    const route = routes.find(r => r.id === o.route);
    const created = now - o.days * D;
    const path = o.path;
    const history = path.map((st, i) => {
      let t = created + i * 5 * H;
      if (o.late && st === 'delivered') t = created + (rate.sla + 1.5) * D; // giao trễ hạn
      const extra = st === 'failed' ? ': ' + (o.reason || '') : '';
      return { status: st, time: t, note: notes[st] + extra };
    });
    const weight = o.weight || 1.5;
    return {
      code: 'VD' + String(n).padStart(4, '0'), customerId: 'U7', routeId: o.route, warehouseId: route.warehouseId, rateId: rate.id,
      sender: { name: 'Shop Hoa Sen', phone: '0912345678', address: addr[o.from || 'a'] },
      receiver: { name: o.to, phone: o.phone || '0987654321', address: addr[o.addr || 'b'] },
      desc: o.desc, weight, fee: rate.base + Math.ceil(Math.max(0, weight - 1)) * rate.perKg, cod: o.cod || 0,
      status: path[path.length - 1], createdAt: created, dueAt: created + rate.sla * D, history,
      driverId: o.driver || null, tripId: o.trip || null, pod: o.pod || null, attempts: o.attempts || 0, failReason: o.reason || ''
    };
  }
  const del = ['pending', 'approved', 'packed', 'assigned', 'delivering', 'delivered'];
  const pod = (name) => ({ receiver: name, time: now, signature: '' });
  const shipments = [
    ship(1, { days: 6, route: 'T1', to: 'Trần Văn An', addr: 'c', desc: '2 áo thun', cod: 240000, path: del, driver: 'U5', trip: 'CH001', pod: pod('Trần Văn An'), rate: 'R2' }),
    ship(2, { days: 5, route: 'T2', from: 'b', to: 'Lê Thị Bình', addr: 'd', desc: 'Giày sneaker', cod: 650000, path: del, driver: 'U6', trip: 'CH002', pod: pod('Lê Thị Bình') }),
    ship(3, { days: 9, route: 'T3', to: 'Phạm Quốc Cường', desc: 'Balo laptop', cod: 420000, weight: 2, path: del, driver: 'U5', trip: 'CH001', late: true, pod: pod('Phạm Quốc Cường') }),
    ship(4, { days: 4, route: 'T2', from: 'b', to: 'Võ Thanh Dũng', addr: 'd', desc: 'Tai nghe bluetooth', cod: 350000, path: del, driver: 'U6', trip: 'CH002', pod: pod('Võ Thanh Dũng') }),
    ship(5, { days: 2, route: 'T1', to: 'Đặng Thu Em', addr: 'e', desc: 'Mũ lưỡi trai x3', cod: 240000, path: FULL.concat('failed'), driver: 'U5', trip: 'CH001', attempts: 1, reason: 'Không liên lạc được người nhận' }),
    ship(6, { days: 1, route: 'T2', from: 'b', to: 'Hồ Minh Giang', addr: 'd', desc: 'Sạc dự phòng', cod: 250000, path: FULL, driver: 'U6', trip: 'CH002', rate: 'R2' }),
    ship(7, { days: 1, route: 'T1', to: 'Ngô Bảo Hân', addr: 'c', desc: 'Quần jean', cod: 0, path: FULL.slice(0, 4), driver: 'U5', trip: 'CH003' }),
    ship(8, { days: 1, route: 'T1', to: 'Đinh Gia Khang', addr: 'e', desc: 'Ốp lưng x5', cod: 150000, path: FULL.slice(0, 3) }),
    ship(9, { days: 0.5, route: 'T3', to: 'Bùi Lan Hương', desc: 'Áo thun x4', cod: 480000, weight: 2.5, path: FULL.slice(0, 2) }),
    ship(10, { days: 0.2, route: 'T2', from: 'b', to: 'Trương Quang Huy', addr: 'd', desc: 'Giày sneaker', cod: 650000, path: ['pending'], rate: 'R2' }),
    ship(11, { days: 5, route: 'T1', to: 'Lý Mỹ Linh', addr: 'c', desc: 'Balo laptop', cod: 420000, path: FULL.concat('failed', 'returned'), driver: 'U6', trip: 'CH002', attempts: 2, reason: 'Khách từ chối nhận' }),
    ship(12, { days: 3, route: 'T2', from: 'b', to: 'Mai Anh Tuấn', addr: 'd', desc: 'Mũ lưỡi trai', cod: 80000, path: ['pending', 'cancelled'] })
  ];
  const trips = [
    { id: 'CH001', driverId: 'U5', routeId: 'T1', createdAt: now - 6 * D, codes: ['VD0001', 'VD0003', 'VD0005'] },
    { id: 'CH002', driverId: 'U6', routeId: 'T2', createdAt: now - 5 * D, codes: ['VD0002', 'VD0004', 'VD0006', 'VD0011'] },
    { id: 'CH003', driverId: 'U5', routeId: 'T1', createdAt: now - 1 * D, codes: ['VD0007'] }
  ];
  const notifications = [
    { id: 'N1', to: { user: 'U7' }, text: 'Đơn VD0005 giao thất bại: Không liên lạc được người nhận', code: 'VD0005', time: now - 1 * D, read: false },
    { id: 'N2', to: { user: 'U7' }, text: 'Đơn VD0004 đã giao thành công', code: 'VD0004', time: now - 4 * D, read: true }
  ];
  const audit = [
    { id: 'A1', time: now - 2 * H, userId: 'U3', action: 'Tạo phiếu', detail: 'Tạo phiếu điều chuyển DC0001' },
    { id: 'A2', time: now - 1 * D, userId: 'U4', action: 'Phân công', detail: 'Tạo chuyến CH003 cho tài xế Hoàng Văn Tài' }
  ];

  return {
    users, warehouses, locations, products, stock, suppliers, rates, routes, receipts, shipments, trips, notifications, audit,
    seq: { PN: 3, PX: 3, DC: 2, VD: 13, CH: 4, N: 3, A: 3, U: 8, W: 3, L: 6, P: 9, S: 4, R: 3, T: 4 }
  };
};
