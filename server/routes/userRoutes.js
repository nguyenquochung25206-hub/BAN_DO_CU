/*
 * FILE   : server/routes/userRoutes.js
 * CHỦ FILE: TV5 – User Interaction (Yêu thích & Hồ sơ)
 * BRANCH : feature/tv5-user
 * NHIỆM VỤ: Route /api/users/*
 * IMPLEMENTED:
 *   [x] GET/PUT /profile
 *   [x] GET /my-products -> gọi productController.getMyProducts của TV3 (TV4 chỉ dùng)
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const controller = require("../controllers/userController");
const productController = require("../controllers/productController");

router.use(verifyToken);
router.get("/profile", controller.getProfile);
router.put("/profile", controller.uploadAvatar, controller.updateProfile);
router.get("/my-products", (req, res, next) => {
  if (typeof productController.getMyProducts !== "function") {
    return res.status(501).json({ success: false, message: "Đang chờ TV3 cung cấp getMyProducts" });
  }
  Promise.resolve().then(() => productController.getMyProducts(req, res, next)).catch(next);
});

module.exports = router;
