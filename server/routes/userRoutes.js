/*
 * FILE   : server/routes/userRoutes.js
 * CHỦ FILE: TV5 – User Interaction (Yêu thích & Hồ sơ)
 * BRANCH : feature/tv5-user
 * NHIỆM VỤ: Route /api/users/*
 * TODO:
 *   [ ] GET/PUT /profile
 *   [ ] GET /my-products -> gọi productController.getMyProducts của TV3 (TV4 chỉ dùng)
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const express = require("express");
const router = express.Router();

router.get("/profile", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: GET /profile" }));
router.put("/profile", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: PUT /profile" }));
router.get("/my-products", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: GET /my-products" }));

module.exports = router;
