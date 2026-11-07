/*
 * FILE   : server/middleware/authMiddleware.js
 * CHỦ FILE: TV2 – Authentication (Đăng ký/Đăng nhập/Xác thực)
 * BRANCH : feature/tv2-auth
 * NHIỆM VỤ: Kiểm tra đăng nhập
 * TODO:
 *   [ ] verifyToken: đọc header Authorization: Bearer <token>, gán req.user
 *   [ ] Từ chối tài khoản bị khóa
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

// TODO (TV2): hiện tại là bản khung để server chạy được.
// const jwt = require("jsonwebtoken");
exports.verifyToken = (req, res, next) => {
  return res.status(501).json({ success: false, message: "TV2 chưa triển khai verifyToken" });
};
