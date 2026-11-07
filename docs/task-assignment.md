# Phân công nhiệm vụ – REUSE Marketplace

Mỗi file đều có **comment đầu file** ghi chủ file + danh sách TODO. Chỉ chủ file được sửa.


## TV1 – Frontend UI/UX (Giao diện tổng thể)

Branch: `feature/tv1-ui`

| File | Nhiệm vụ |
|---|---|
| `client/index.html` | Trang chủ |
| `client/css/reset.css` | Reset CSS |
| `client/css/variables.css` | Biến CSS dùng chung |
| `client/css/global.css` | CSS chung |
| `client/css/header.css` | Thanh điều hướng |
| `client/css/footer.css` | Chân trang |
| `client/css/home.css` | Giao diện trang chủ |
| `client/js/main.js` | JS giao diện chung |
| `client/pages/404.html` | Trang lỗi 404 |

## TV2 – Authentication (Đăng ký/Đăng nhập/Xác thực)

Branch: `feature/tv2-auth`

| File | Nhiệm vụ |
|---|---|
| `client/pages/login.html` | Trang đăng nhập |
| `client/pages/register.html` | Trang đăng ký |
| `client/css/auth.css` | Giao diện xác thực |
| `client/js/auth.js` | JS đăng nhập/đăng ký/đăng xuất |
| `server/routes/authRoutes.js` | Route /api/auth/* |
| `server/controllers/authController.js` | Nghiệp vụ tài khoản |
| `server/middleware/authMiddleware.js` | Kiểm tra đăng nhập |
| `server/models/User.js` | Truy vấn bảng users |

## TV3 – Product (Danh sách/Tìm kiếm/Chi tiết sản phẩm)

Branch: `feature/tv3-products`

| File | Nhiệm vụ |
|---|---|
| `client/pages/products.html` | Danh sách sản phẩm |
| `client/pages/product-detail.html` | Chi tiết sản phẩm |
| `client/css/products.css` | Giao diện danh sách |
| `client/css/product-detail.css` | Giao diện chi tiết |
| `client/js/products.js` | Xử lý tìm kiếm/lọc/phân trang |
| `client/js/product-detail.js` | Xử lý chi tiết |
| `server/routes/productRoutes.js` | Route /api/products/* (TV3 SỞ HỮU) |
| `server/controllers/productController.js` | Nghiệp vụ sản phẩm |
| `server/routes/categoryRoutes.js` | Route /api/categories |
| `server/controllers/categoryController.js` | Nghiệp vụ danh mục |
| `server/models/Product.js` | Truy vấn products + product_images |
| `server/models/Category.js` | Truy vấn categories |

## TV4 – Seller (Đăng bán & quản lý tin)

Branch: `feature/tv4-seller`

| File | Nhiệm vụ |
|---|---|
| `client/pages/sell.html` | Trang đăng bán |
| `client/pages/my-products.html` | Quản lý tin đăng |
| `client/css/sell.css` | Giao diện đăng bán |
| `client/css/my-products.css` | Giao diện quản lý tin |
| `client/js/sell.js` | Xử lý đăng/sửa sản phẩm |
| `client/js/my-products.js` | Xử lý quản lý tin |
| `server/middleware/uploadMiddleware.js` | Upload ảnh bằng multer |

## TV5 – User Interaction (Yêu thích & Hồ sơ)

Branch: `feature/tv5-user`

| File | Nhiệm vụ |
|---|---|
| `client/pages/wishlist.html` | Danh sách yêu thích |
| `client/pages/profile.html` | Hồ sơ cá nhân |
| `client/css/wishlist.css` | Giao diện yêu thích |
| `client/css/profile.css` | Giao diện hồ sơ |
| `client/js/wishlist.js` | Xử lý yêu thích |
| `client/js/profile.js` | Xử lý hồ sơ |
| `server/routes/wishlistRoutes.js` | Route /api/wishlist |
| `server/controllers/wishlistController.js` | Nghiệp vụ yêu thích |
| `server/models/Wishlist.js` | Truy vấn wishlists |
| `server/routes/userRoutes.js` | Route /api/users/* |
| `server/controllers/userController.js` | Nghiệp vụ người dùng |

## TV6 – Backend/Database/Admin & Tích hợp

Branch: `feature/tv6-admin`

| File | Nhiệm vụ |
|---|---|
| `client/pages/admin.html` | Trang quản trị |
| `client/css/admin.css` | Giao diện quản trị |
| `client/js/admin.js` | Xử lý quản trị |
| `server/middleware/adminMiddleware.js` | Kiểm tra quyền Admin |
| `server/routes/adminRoutes.js` | Route /api/admin/* |
| `server/controllers/adminController.js` | Nghiệp vụ Admin |
| `client/js/api.js` | Hàm gọi API dùng chung (file chung, TV6 quản lý) |
| `server/server.js` | Khởi tạo Express |
| `server/config/database.js` | Kết nối MySQL |
| `database/schema.sql` | Tạo database |
| `database/seed.sql` | Dữ liệu mẫu |
| `database/set-seed-passwords.js` | Đặt mật khẩu seed |
| `package.json` | Thư viện |
| `.env.example` | Mẫu cấu hình |
| `.gitignore` | Cấu hình Git |
| `README.md` | Hướng dẫn |
| `docs/*` | Tài liệu nhóm |

## Điểm giao nhau giữa các thành viên (đọc kỹ)

1. **API sản phẩm**: TV3 viết toàn bộ `productRoutes/productController/Product.js` (kể cả POST/PUT/DELETE). TV4 chỉ gọi các API này từ `sell.js`, `my-products.js` và cung cấp `uploadMiddleware.js` để TV3 gắn vào route POST/PUT.
2. **`GET /api/users/my-products`**: route đặt trong `userRoutes.js` (TV5) nhưng gọi `productController.getMyProducts` (TV3). TV4 chỉ dùng.
3. **User model**: `User.js` thuộc TV2. TV5 cần thêm hàm cập nhật hồ sơ -> nhờ TV2 thêm hoặc viết query trực tiếp trong `userController.js`.
4. **Nút yêu thích** ở card sản phẩm (TV1) và chi tiết (TV3): gọi hàm trong `wishlist.js` của TV5.
5. **Header/Footer**: TV1 viết trong `main.js`; mọi trang có `#site-header` và `#site-footer`.
6. **`condition`** là từ khóa MySQL -> luôn viết `` `condition` `` trong SQL.
7. Route `/api/products/search` phải khai báo trước `/api/products/:id`.
8. Chỉ sản phẩm `approved` hiện ở danh sách công khai; sản phẩm mới tạo là `pending` chờ TV6 duyệt.

## Quy ước chung
- Phản hồi JSON: `{ success: true/false, message, data }`.
- Token gửi qua header `Authorization: Bearer <token>`; lưu `token`, `user` ở localStorage.
- Commit: `feat:`, `fix:`, `style:`, `docs:`. Mỗi người làm trên branch riêng, tạo Pull Request cho TV6.
