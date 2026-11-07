# Tài liệu API

| Thành viên | Method | Endpoint | Chức năng | Quyền |
|---|---|---|---|---|
| TV2 | POST | /api/auth/register | Đăng ký | Công khai |
| TV2 | POST | /api/auth/login | Đăng nhập | Công khai |
| TV2 | POST | /api/auth/logout | Đăng xuất | Đăng nhập |
| TV2 | GET | /api/auth/me | Tài khoản hiện tại | Đăng nhập |
| TV3 | GET | /api/products | Danh sách (search, category, minPrice, maxPrice, condition, sort, page) | Công khai |
| TV3 | GET | /api/products/search | Tìm kiếm | Công khai |
| TV3 | GET | /api/products/:id | Chi tiết | Công khai |
| TV3 | GET | /api/categories | Danh mục | Công khai |
| TV3/TV4 | POST | /api/products | Đăng sản phẩm (multipart, field images) | Đăng nhập |
| TV3/TV4 | PUT | /api/products/:id | Sửa | Chủ sản phẩm |
| TV3/TV4 | DELETE | /api/products/:id | Xóa | Chủ sản phẩm |
| TV5 | GET | /api/users/my-products | Tin của tôi | Đăng nhập |
| TV5 | GET | /api/wishlist | Danh sách yêu thích | Đăng nhập |
| TV5 | POST | /api/wishlist | Thêm (body: product_id) | Đăng nhập |
| TV5 | DELETE | /api/wishlist/:id | Xóa | Đăng nhập |
| TV5 | GET | /api/users/profile | Xem hồ sơ | Đăng nhập |
| TV5 | PUT | /api/users/profile | Cập nhật hồ sơ | Đăng nhập |
| TV6 | GET | /api/admin/users | Danh sách user | Admin |
| TV6 | PUT | /api/admin/users/:id | Khóa/mở tài khoản | Admin |
| TV6 | GET | /api/admin/products | Danh sách sản phẩm | Admin |
| TV6 | PUT | /api/admin/products/:id/approve | Duyệt | Admin |
| TV6 | PUT | /api/admin/products/:id/reject | Từ chối | Admin |
| TV6 | DELETE | /api/admin/products/:id | Xóa | Admin |
| TV6 | POST | /api/admin/categories | Tạo danh mục | Admin |
