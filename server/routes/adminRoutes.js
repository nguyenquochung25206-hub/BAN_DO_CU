/*
 * FILE   : server/routes/adminRoutes.js
 * CHỦ FILE: TV6 – Backend/Database/Admin & Tích hợp
 * BRANCH : feature/tv6-admin
 * NHIỆM VỤ: Route /api/admin/*
 * TODO:
 *   [ ] verifyToken + isAdmin cho mọi route
 *   [ ] users, products (approve/reject/delete), categories, stats
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const express = require("express");
const router = express.Router();

router.get("/users", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: GET /users" }));
router.put("/users/:id", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: PUT /users/:id" }));
router.get("/products", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: GET /products" }));
router.put("/products/:id/approve", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: PUT /products/:id/approve" }));
router.put("/products/:id/reject", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: PUT /products/:id/reject" }));
router.delete("/products/:id", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: DELETE /products/:id" }));
router.post("/categories", (req, res) => res.status(501).json({ success: false, message: "Chưa triển khai: POST /categories" }));

module.exports = router;
