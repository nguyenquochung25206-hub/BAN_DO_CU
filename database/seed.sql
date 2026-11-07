-- FILE   : database/seed.sql
-- CHỦ FILE: TV6 – Backend/Database/Admin & Tích hợp
-- BRANCH : feature/tv6-admin
-- NHIỆM VỤ: Dữ liệu mẫu để trình bày
-- TODO:
--   [ ] Thêm dữ liệu khi cần demo
-- LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).

USE reuse_marketplace;

-- Mật khẩu là placeholder. Chạy `npm run seed:passwords` để đặt mật khẩu thật (bcrypt):
--   admin@reuse.vn -> Admin@123 | các user khác -> 123456
INSERT INTO users (full_name, email, password, phone, role) VALUES
('Quản trị viên', 'admin@reuse.vn', 'PLACEHOLDER', '0900000000', 'admin'),
('Nguyễn Văn An', 'an@reuse.vn', 'PLACEHOLDER', '0911111111', 'user'),
('Trần Thị Bình', 'binh@reuse.vn', 'PLACEHOLDER', '0922222222', 'user'),
('Lê Minh Châu', 'chau@reuse.vn', 'PLACEHOLDER', '0933333333', 'user');

INSERT INTO categories (name, description) VALUES
('Điện thoại', 'Điện thoại cũ các hãng'),
('Laptop & Máy tính', 'Laptop, PC, linh kiện'),
('Thời trang', 'Quần áo, giày dép, túi xách'),
('Đồ gia dụng', 'Đồ dùng trong nhà'),
('Xe cộ', 'Xe máy, xe đạp'),
('Sách & Văn phòng phẩm', 'Sách, giáo trình, dụng cụ học tập'),
('Đồ chơi & Thể thao', 'Đồ chơi, dụng cụ thể thao');

INSERT INTO products (user_id, category_id, name, description, price, `condition`, location, status) VALUES
(2, 1, 'iPhone 12 64GB', 'Máy đẹp, pin 87%, đủ phụ kiện', 7500000, 'Đã qua sử dụng', 'TP. Hồ Chí Minh', 'approved'),
(2, 2, 'Laptop Dell Latitude 7490', 'Core i5, RAM 8GB, SSD 256GB', 6200000, 'Đã qua sử dụng', 'TP. Hồ Chí Minh', 'approved'),
(3, 3, 'Áo khoác jean nam size L', 'Mặc 2 lần, như mới', 180000, 'Mới 99%', 'Hà Nội', 'approved'),
(3, 4, 'Nồi chiên không dầu 5L', 'Dùng 3 tháng, còn bảo hành', 850000, 'Mới 95%', 'Đà Nẵng', 'approved'),
(4, 5, 'Xe đạp địa hình Giant', 'Khung nhôm, còn tốt', 2500000, 'Đã qua sử dụng', 'TP. Hồ Chí Minh', 'approved'),
(4, 6, 'Bộ giáo trình Lập trình Web', 'Sách còn mới, có ghi chú nhẹ', 120000, 'Mới 90%', 'Cần Thơ', 'pending'),
(2, 7, 'Vợt cầu lông Yonex', 'Kèm bao vợt', 400000, 'Mới 90%', 'TP. Hồ Chí Minh', 'approved');

-- Ảnh mẫu: copy file vào server/uploads/products/ rồi sửa đường dẫn tương ứng
INSERT INTO product_images (product_id, image_url) VALUES
(1, '/uploads/products/sample-1.jpg'), (2, '/uploads/products/sample-2.jpg'),
(3, '/uploads/products/sample-3.jpg'), (4, '/uploads/products/sample-4.jpg'),
(5, '/uploads/products/sample-5.jpg'), (6, '/uploads/products/sample-6.jpg'),
(7, '/uploads/products/sample-7.jpg');

INSERT INTO wishlists (user_id, product_id) VALUES (3, 1), (3, 2), (4, 1);
