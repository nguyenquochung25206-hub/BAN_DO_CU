/*
 * FILE   : server/routes/wishlistRoutes.js
 * CHỦ FILE: TV5 – User Interaction (Yêu thích & Hồ sơ)
 * BRANCH : feature/tv5-user
 * NHIỆM VỤ: Route /api/wishlist
 * IMPLEMENTED:
 *   [x] GET /, GET /ids, POST /, DELETE /:product_id (cần verifyToken)
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const controller = require("../controllers/wishlistController");

router.use(verifyToken);
router.get("/", controller.getWishlist);
router.get("/ids", controller.getWishlistIds);
router.post("/", controller.addWishlist);
router.delete("/:product_id", controller.removeWishlist);

module.exports = router;
