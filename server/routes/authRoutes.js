/*
 * FILE   : server/routes/authRoutes.js
 * CHỦ FILE: TV2 – Authentication (Đăng ký/Đăng nhập/Xác thực)
 * BRANCH : feature/tv2-auth
 * NHIỆM VỤ: Route /api/auth/*
 * TODO:
 *   [ ] POST /register, POST /login, POST /logout, GET /me (có authMiddleware)
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const express = require("express");
const router = express.Router();

router.post("/register", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: POST /register" }));
router.post("/login", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: POST /login" }));
router.post("/logout", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: POST /logout" }));
router.get("/me", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: GET /me" }));

module.exports = router;
