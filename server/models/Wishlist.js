/* TV5 – feature/tv5-user. Hợp đồng tuần 1: WishlistItem chứa ProductCard. */
const pool = require("../config/database");
const { toIso } = require("../utils/tv5Data");

exports.findByUser = async (userId) => {
  const [rows] = await pool.query(`
    SELECT w.id AS wishlist_id, w.created_at AS wishlist_created_at,
      p.id, p.name, p.price, p.\`condition\`, p.location, p.status, p.created_at,
      p.category_id, c.name AS category_name, u.full_name AS seller_name,
      (SELECT pi.image_url FROM product_images pi
       WHERE pi.product_id = p.id ORDER BY pi.id LIMIT 1) AS thumbnail
    FROM wishlists w
    JOIN products p ON p.id = w.product_id
    JOIN categories c ON c.id = p.category_id
    JOIN users u ON u.id = p.user_id
    WHERE w.user_id = ? AND p.status IN ('approved', 'sold')
    ORDER BY w.created_at DESC, w.id DESC`, [userId]);
  return rows.map((row) => ({
    wishlist_id: Number(row.wishlist_id), created_at: toIso(row.wishlist_created_at),
    product: {
      id: Number(row.id), name: row.name, price: Number(row.price), condition: row.condition,
      location: row.location, status: row.status, created_at: toIso(row.created_at),
      category_id: Number(row.category_id), category_name: row.category_name,
      thumbnail: row.thumbnail, seller_name: row.seller_name,
    },
  }));
};

exports.findIdsByUser = async (userId) => {
  const [rows] = await pool.query(
    "SELECT product_id FROM wishlists WHERE user_id = ? ORDER BY id DESC", [userId]);
  return rows.map((row) => Number(row.product_id));
};

exports.add = async (userId, productId) => {
  const [result] = await pool.query(`
    INSERT INTO wishlists (user_id, product_id)
    SELECT ?, id FROM products WHERE id = ? AND status IN ('approved', 'sold')`, [userId, productId]);
  return result;
};
exports.remove = async (userId, productId) => {
  const [result] = await pool.query(
    "DELETE FROM wishlists WHERE user_id = ? AND product_id = ?", [userId, productId]);
  return result.affectedRows > 0;
};
exports.exists = async (userId, productId) => {
  const [rows] = await pool.query(
    "SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?", [userId, productId]);
  return rows.length > 0;
};
