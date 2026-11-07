/*
 * FILE   : server/routes/wishlistRoutes.js
 * CHỦ FILE: TV5 – User Interaction (Yêu thích & Hồ sơ)
 * BRANCH : feature/tv5-user
 * NHIỆM VỤ: Route /api/wishlist
 * TODO:
 *   [ ] GET /, POST /, DELETE /:id (cần verifyToken)
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const express = require("express");
const router = express.Router();

router.get("/", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: GET /" }));
router.post("/", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: POST /" }));
router.delete("/:id", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: DELETE /:id" }));

module.exports = router;
