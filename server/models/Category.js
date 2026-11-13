/*
 * FILE   : server/models/Category.js
 * CHỦ FILE: TV3 – Product (Danh sách/Tìm kiếm/Chi tiết sản phẩm)
 * BRANCH : feature/tv3-products
 * NHIỆM VỤ: Truy vấn bảng categories
 * HÀM    : findAll, findById, create, update  (TV6 dùng create/update cho trang quản trị)
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const pool = require("../config/database");

// Hình dạng Category chuẩn (Biên bản tuần 1, mục 4): id, name, description, image
const COLUMNS = "id, name, description, image";

/** Lấy toàn bộ danh mục, sắp xếp theo id tăng dần. */
async function findAll() {
  const [rows] = await pool.query(`SELECT ${COLUMNS} FROM categories ORDER BY id ASC`);
  return rows;
}

/** Lấy 1 danh mục theo id; không có thì trả về null. */
async function findById(id) {
  const [rows] = await pool.query(`SELECT ${COLUMNS} FROM categories WHERE id = ?`, [id]);
  return rows[0] || null;
}

/** Tạo danh mục mới (TV6 gọi). Trả về danh mục vừa tạo. */
async function create({ name, description = null, image = null }) {
  const [result] = await pool.query(
    "INSERT INTO categories (name, description, image) VALUES (?, ?, ?)",
    [name, description, image]
  );
  return findById(result.insertId);
}

/**
 * Cập nhật danh mục (TV6 gọi). Chỉ cập nhật các trường được truyền vào.
 * Trả về danh mục sau khi cập nhật, hoặc null nếu id không tồn tại.
 */
async function update(id, { name, description, image } = {}) {
  const sets = [];
  const params = [];
  if (name !== undefined) { sets.push("name = ?"); params.push(name); }
  if (description !== undefined) { sets.push("description = ?"); params.push(description); }
  if (image !== undefined) { sets.push("image = ?"); params.push(image); }

  if (sets.length > 0) {
    params.push(id);
    await pool.query(`UPDATE categories SET ${sets.join(", ")} WHERE id = ?`, params);
  }
  return findById(id);
}

module.exports = { findAll, findById, create, update };