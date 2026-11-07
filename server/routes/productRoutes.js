/*
 * FILE   : server/routes/productRoutes.js
 * CHỦ FILE: TV3 – Product (Danh sách/Tìm kiếm/Chi tiết sản phẩm)
 * BRANCH : feature/tv3-products
 * NHIỆM VỤ: Route /api/products/* (TV3 SỞ HỮU)
 * TODO:
 *   [ ] GET /, GET /search (đặt TRƯỚC /:id), GET /:id
 *   [ ] POST /, PUT /:id, DELETE /:id, PATCH /:id/sold -> dùng authMiddleware (TV2) + uploadMiddleware (TV4); TV4 là người dùng các API này
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const express = require("express");
const router = express.Router();

router.get("/", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: GET /" }));
router.get("/search", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: GET /search" }));
router.get("/:id", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: GET /:id" }));
router.post("/", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: POST /" }));
router.put("/:id", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: PUT /:id" }));
router.delete("/:id", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: DELETE /:id" }));

module.exports = router;
