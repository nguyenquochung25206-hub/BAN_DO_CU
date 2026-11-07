/*
 * FILE   : server/middleware/adminMiddleware.js
 * CHỦ FILE: TV6 – Backend/Database/Admin & Tích hợp
 * BRANCH : feature/tv6-admin
 * NHIỆM VỤ: Kiểm tra quyền Admin
 * TODO:
 *   [ ] isAdmin: req.user.role === 'admin' (dùng sau verifyToken)
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

// Dùng SAU verifyToken: router.use(verifyToken, isAdmin)
exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Chỉ quản trị viên được phép" });
  }
  next();
};
