/*
 * FILE   : server/middleware/uploadMiddleware.js
 * CHỦ FILE: TV4 – Seller (Đăng bán & quản lý tin)
 * BRANCH : feature/tv4-seller
 * NHIỆM VỤ: Upload ảnh bằng multer
 * TODO:
 *   [ ] Lưu vào server/uploads/products
 *   [ ] Giới hạn loại file (jpg/png/webp) và dung lượng
 *   [ ] Tối đa ~5 ảnh/sản phẩm, đặt tên file duy nhất
 *   [ ] Export upload.array('images', 5) để TV3 gắn vào route
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

// TODO (TV4): cấu hình multer. Khung gợi ý:
// const multer = require("multer");
// const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
// module.exports = upload; // dùng: upload.array("images", 5)
module.exports = {};
