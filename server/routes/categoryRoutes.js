/*
 * FILE   : server/routes/categoryRoutes.js
 * CHỦ FILE: TV3 – Product (Danh sách/Tìm kiếm/Chi tiết sản phẩm)
 * BRANCH : feature/tv3-products
 * NHIỆM VỤ: Route /api/categories
 * TODO:
 *   [ ] GET /
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const express = require("express");
const router = express.Router();

router.get("/", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: GET /" }));

module.exports = router;
