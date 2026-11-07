# Thiết kế database `reuse_marketplace`

Bảng: users, categories, products, product_images, wishlists, reports.
Chi tiết xem `database/schema.sql`.

Trạng thái sản phẩm: `pending`, `approved`, `rejected`, `sold`.
Wishlist có UNIQUE(user_id, product_id).
