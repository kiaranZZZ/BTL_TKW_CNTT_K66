# WMS Logistics – Web quản lý kho và theo dõi vận đơn (mini logistics)

Web tĩnh (HTML/CSS/JavaScript thuần), không cần backend. Dữ liệu lưu trong `localStorage` của trình duyệt, có dữ liệu mẫu sẵn.

## Tài khoản demo (mật khẩu: 123456)
| Vai trò | Tên đăng nhập |
|---|---|
| Admin | admin |
| Quản lý kho | qlkho |
| Nhân viên kho | nvkho |
| Điều phối vận chuyển | dieuphoi |
| Tài xế | taixe1, taixe2 |
| Khách hàng | khach1 |
| Khách vãng lai | không cần đăng nhập – tra cứu mã `VD0001`, `VD0005`, `VD0006` ở trang chủ |

## Chạy thử
Mở `index.html` bằng trình duyệt, hoặc chạy `python -m http.server` trong thư mục này.

## Deploy GitHub Pages
1. Tạo repo mới, đưa toàn bộ nội dung thư mục này lên nhánh `main`.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)` → Save.
3. Sau 1–2 phút truy cập `https://<tên-user>.github.io/<tên-repo>/`.

## Cấu trúc
- `css/` tokens (màu, font, spacing), base, layout, components
- `js/` store (dữ liệu), router (hash routing + phân quyền), ui, `pages/` theo nhóm chức năng
- `assets/` logo, favicon

Đặt lại dữ liệu mẫu: xóa localStorage của trang (DevTools → Application) rồi tải lại.
