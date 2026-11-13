/*
 * FILE   : server/controllers/categoryController.js
 * CHỦ FILE: TV3 – Product (Danh sách/Tìm kiếm/Chi tiết sản phẩm)
 * BRANCH : feature/tv3-products
 * NHIỆM VỤ: Nghiệp vụ danh mục
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const Category = require("../models/Category");

// GET /api/categories  (công khai)
exports.getAll = async (req, res) => {
  try {
    const categories = await Category.findAll();
    return res.json({ success: true, data: categories });
  } catch (err) {
    console.error("[categoryController.getAll]", err);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ, vui lòng thử lại sau" });
  }
};