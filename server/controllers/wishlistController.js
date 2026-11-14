/*
 * FILE   : server/controllers/wishlistController.js
 * CHỦ FILE: TV5 – User Interaction (Yêu thích & Hồ sơ)
 * BRANCH : feature/tv5-user
 * NHIỆM VỤ: Nghiệp vụ yêu thích
 * IMPLEMENTED:
 *   [x] Chống trùng (UNIQUE user_id+product_id)
 *   [x] Chỉ xóa mục của chính mình
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const Wishlist = require("../models/Wishlist");

function productId(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  return /^(?:[1-9]\d*)$/.test(String(value)) && Number.isSafeInteger(Number(value))
    ? Number(value) : null;
}

exports.getWishlist = async (req, res, next) => {
  try {
    const data = await Wishlist.findByUser(req.user.id);
    res.json({ success: true, message: "Danh sách yêu thích", data });
  } catch (err) { next(err); }
};

exports.getWishlistIds = async (req, res, next) => {
  try {
    const data = await Wishlist.findIdsByUser(req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.addWishlist = async (req, res, next) => {
  const id = productId(req.body && req.body.product_id);
  if (!id) return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
  try {
    const result = await Wishlist.add(req.user.id, id);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Sản phẩm không còn được đăng bán" });
    }
    res.status(201).json({ success: true, message: "Đã thêm vào yêu thích",
      data: { product_id: id } });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Sản phẩm đã có trong danh sách yêu thích" });
    }
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(404).json({ success: false, message: "Tài khoản hoặc sản phẩm không còn tồn tại" });
    }
    next(err);
  }
};

exports.removeWishlist = async (req, res, next) => {
  const id = productId(req.params.product_id);
  if (!id) return res.status(400).json({ success: false, message: "ID sản phẩm không hợp lệ" });
  try {
    const removed = await Wishlist.remove(req.user.id, id);
    if (!removed) return res.status(404).json({ success: false, message: "Sản phẩm không có trong yêu thích của bạn" });
    res.json({ success: true, message: "Đã bỏ yêu thích", data: { product_id: id } });
  } catch (err) { next(err); }
};
