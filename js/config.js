/* Cấu hình chung: vai trò, trạng thái vận đơn, menu theo quyền (RBAC) */
window.WMS = { pages: {}, actions: {}, changes: {}, state: { filters: {} } };

WMS.ROLES = {
  admin: 'Admin',
  wm: 'Quản lý kho',
  staff: 'Nhân viên kho',
  dispatcher: 'Điều phối vận chuyển',
  driver: 'Tài xế',
  customer: 'Khách hàng'
};

// Nhãn + màu badge cho từng trạng thái vận đơn
WMS.STATUS = {
  pending: { label: 'Chờ duyệt', tone: 'warn' },
  approved: { label: 'Đã duyệt', tone: 'info' },
  packed: { label: 'Đã đóng gói', tone: 'info' },
  assigned: { label: 'Đã phân công', tone: 'primary' },
  delivering: { label: 'Đang giao', tone: 'primary' },
  delivered: { label: 'Giao thành công', tone: 'success' },
  failed: { label: 'Giao thất bại', tone: 'danger' },
  returned: { label: 'Hoàn hàng', tone: 'muted' },
  cancelled: { label: 'Đã hủy', tone: 'muted' }
};

// Nội dung mặc định ghi vào hành trình khi đổi trạng thái
WMS.NOTES = {
  pending: 'Đơn hàng được tạo', approved: 'Điều phối đã duyệt đơn', packed: 'Đã soạn hàng và đóng gói tại kho',
  assigned: 'Đã giao cho tài xế', delivering: 'Tài xế đang giao hàng', delivered: 'Giao hàng thành công',
  failed: 'Giao hàng thất bại', returned: 'Đơn được hoàn về kho', cancelled: 'Đơn hàng đã bị hủy'
};

// Máy trạng thái: từ trạng thái nào được chuyển sang trạng thái nào
WMS.TRANSITIONS = {
  pending: ['approved', 'cancelled'],
  approved: ['packed', 'cancelled'],
  packed: ['assigned'],
  assigned: ['delivering'],
  delivering: ['delivered', 'failed'],
  failed: ['delivering', 'returned'],
  delivered: [], returned: [], cancelled: []
};

// Menu bên trái: mỗi mục có danh sách vai trò được xem
WMS.NAV = [
  { path: '/dashboard', label: 'Tổng quan', icon: 'chart', roles: ['admin', 'wm', 'staff', 'dispatcher'] },
  { path: '/my-shipments', label: 'Đơn của tôi', icon: 'box', roles: ['customer'] },
  { path: '/driver', label: 'Chuyến giao hàng', icon: 'truck', roles: ['driver'] },
  { group: 'Kho hàng' },
  { path: '/inventory', label: 'Tồn kho', icon: 'box', roles: ['admin', 'wm', 'staff'] },
  { path: '/receipts', label: 'Phiếu nhập/xuất', icon: 'file', roles: ['admin', 'wm', 'staff'] },
  { path: '/stocktake', label: 'Kiểm kê', icon: 'check', roles: ['admin', 'wm', 'staff'] },
  { path: '/packing', label: 'Soạn hàng & in tem', icon: 'tag', roles: ['admin', 'wm', 'staff'] },
  { path: '/catalog', label: 'Danh mục', icon: 'list', roles: ['admin', 'wm', 'dispatcher'] },
  { group: 'Vận chuyển' },
  { path: '/shipments', label: 'Quản lý vận đơn', icon: 'truck', roles: ['admin', 'dispatcher'] },
  { path: '/routes', label: 'Tuyến & tài xế', icon: 'map', roles: ['admin', 'dispatcher'] },
  { group: 'Hệ thống' },
  { path: '/reports', label: 'Báo cáo', icon: 'chart', roles: ['admin', 'wm', 'dispatcher'] },
  { path: '/users', label: 'Người dùng & phân quyền', icon: 'users', roles: ['admin'] },
  { path: '/audit', label: 'Nhật ký hoạt động', icon: 'file', roles: ['admin'] }
];

// Trang đích sau khi đăng nhập theo vai trò
WMS.HOME = { admin: '/dashboard', wm: '/dashboard', staff: '/dashboard', dispatcher: '/dashboard', driver: '/driver', customer: '/my-shipments' };
