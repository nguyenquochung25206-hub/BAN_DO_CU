# REUSE – Second-hand Marketplace

Website mua bán đồ cũ (HTML, CSS, JS, Node.js, Express, MySQL).

## Cài đặt
1. Cài Node.js (>= 18) và MySQL.
2. `npm install`
3. Sao chép `.env.example` thành `.env`, điền thông tin MySQL.
4. Import database trong MySQL Workbench hoặc CLI:
   ```
   mysql -u root -p < database/schema.sql
   mysql -u root -p < database/seed.sql
   ```
5. `npm run seed:passwords` (đặt mật khẩu bcrypt cho tài khoản mẫu).
6. `npm run dev` rồi mở http://localhost:3000
7. Kiểm tra kết nối DB: http://localhost:3000/api/health

## Tài khoản mẫu
- Admin: `admin@reuse.vn` / `Admin@123`
- User: `an@reuse.vn`, `binh@reuse.vn`, `chau@reuse.vn` / `123456`

## Làm việc nhóm
- Đọc `docs/task-assignment.md` (phân công từng file) và `docs/api-documentation.md`.
- Mỗi người một branch: `feature/tv1-ui`, `feature/tv2-auth`, `feature/tv3-products`, `feature/tv4-seller`, `feature/tv5-user`, `feature/tv6-admin`.
- Chỉ sửa file được giao. Tạo Pull Request vào `main`, TV6 kiểm tra và tích hợp.
- Không commit `.env`.

## Cấu trúc
Xem `docs/project-overview.md` và comment ở đầu mỗi file.
