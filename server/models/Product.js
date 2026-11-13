/*
 * FILE   : server/models/Product.js
 * CHỦ FILE: TV3 – Product (Danh sách/Tìm kiếm/Chi tiết sản phẩm)
 * BRANCH : feature/tv3-products
 * NHIỆM VỤ: Truy vấn products + product_images (JOIN users, categories)
 * HÀM    : findAll, findByUser, findById, findImages, create, update, markSold, remove,
 *          toCard, toDetail
 *          (TV5/TV6 có thể dùng lại findAll / toCard để trả đúng hình dạng ProductCard)
 *
 * GHI NHỚ:
 *   - `condition` là từ khóa MySQL -> luôn viết có dấu backtick.
 *   - Mọi giá trị đi vào SQL đều qua tham số (?). Tên cột/ORDER BY lấy từ bảng tra cố định.
 *   - MySQL trả DECIMAL dạng CHUỖI ("7500000.00") -> toCard() ép về số theo Biên bản tuần 1.
 *   - Dùng pool.query (không dùng execute) vì LIMIT ? / OFFSET ? lỗi với prepared statement
 *     trên một số bản MySQL 8.
 *
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const pool = require("../config/database");

// ORDER BY chỉ lấy từ bảng này (không bao giờ nối chuỗi từ người dùng). id DESC để ổn định khi trùng.
const SORT_SQL = {
  newest: "p.created_at DESC, p.id DESC",
  price_asc: "p.price ASC, p.id DESC",
  price_desc: "p.price DESC, p.id DESC",
};

// Các cột được phép sửa -> tên cột thật trong SQL
const UPDATABLE_COLUMNS = {
  name: "name",
  description: "description",
  price: "price",
  condition: "`condition`", // từ khóa MySQL -> backtick
  location: "location",
  category_id: "category_id",
};

const CARD_SELECT = `
  p.id, p.name, p.price, p.\`condition\`, p.location, p.status, p.created_at,
  p.category_id, c.name AS category_name,
  (SELECT pi.image_url FROM product_images pi
     WHERE pi.product_id = p.id ORDER BY pi.id ASC LIMIT 1) AS thumbnail,
  u.full_name AS seller_name`;

const CARD_FROM = `
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN users u ON u.id = p.user_id`;

const MAX_SEARCH_WORDS = 6;

// Tra bảng an toàn: tránh các khóa kế thừa như "constructor", "__proto__"
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** Escape ký tự đặc biệt của LIKE (dùng cùng ESCAPE '!'): ! % _ */
function escapeLike(text) {
  return String(text).replace(/[!%_]/g, (ch) => "!" + ch);
}

/** Chuẩn hóa 1 dòng SQL thành ProductCard (chỉ giữ đúng các trường đã chốt). */
function toCard(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    condition: row.condition,
    location: row.location,
    status: row.status,
    created_at: row.created_at,
    category_id: row.category_id,
    category_name: row.category_name,
    thumbnail: row.thumbnail || null,
    seller_name: row.seller_name,
  };
}

/** Ghép dòng sản phẩm (từ findById) + danh sách ảnh thành ProductDetail. */
function toDetail(row, images) {
  const imgs = images.map((img) => ({ id: img.id, image_url: img.image_url }));
  return {
    ...toCard({ ...row, thumbnail: imgs.length ? imgs[0].image_url : null }),
    description: row.description || "",
    images: imgs,
    seller: {
      id: row.user_id,
      full_name: row.seller_name,
      phone: row.seller_phone || null,
      avatar: row.seller_avatar || null,
    },
  };
}

/**
 * Danh sách sản phẩm có lọc + phân trang.
 * filters: { status, userId, search, categoryId, minPrice, maxPrice, condition, sort, page, limit }
 * Mọi trường đều tùy chọn. Trả về { rows: ProductCard[], total }.
 * (Controller công khai luôn truyền status = 'approved'.)
 */
async function findAll(filters = {}) {
  const where = [];
  const params = [];

  if (filters.status) { where.push("p.status = ?"); params.push(filters.status); }
  if (filters.userId) { where.push("p.user_id = ?"); params.push(filters.userId); }
  if (filters.categoryId) { where.push("p.category_id = ?"); params.push(filters.categoryId); }
  if (filters.minPrice !== undefined && filters.minPrice !== null) {
    where.push("p.price >= ?"); params.push(filters.minPrice);
  }
  if (filters.maxPrice !== undefined && filters.maxPrice !== null) {
    where.push("p.price <= ?"); params.push(filters.maxPrice);
  }
  if (filters.condition) { where.push("p.`condition` = ?"); params.push(filters.condition); }

  // Tìm theo tên: mỗi từ phải xuất hiện trong tên (AND), không phân biệt thứ tự
  if (filters.search) {
    const words = String(filters.search).split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_WORDS);
    for (const word of words) {
      where.push("p.name LIKE ? ESCAPE '!'");
      params.push("%" + escapeLike(word) + "%");
    }
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const orderSql = hasOwn(SORT_SQL, filters.sort) ? SORT_SQL[filters.sort] : SORT_SQL.newest;
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 12, 1), 100);
  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const offset = (page - 1) * limit;

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM products p ${whereSql}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT ${CARD_SELECT} ${CARD_FROM} ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { rows: rows.map(toCard), total: Number(countRows[0].total) };
}

/** Tin của một người dùng (mọi trạng thái, hoặc lọc theo filters.status). */
function findByUser(userId, filters = {}) {
  return findAll({ ...filters, userId });
}

/**
 * Một sản phẩm theo id (kèm thông tin người bán) – CHƯA gồm ảnh. Không có thì trả null.
 * Dòng trả về có thêm user_id (chủ tin) để controller kiểm tra quyền; toDetail() đưa nó vào seller.id.
 */
async function findById(id) {
  const [rows] = await pool.query(
    `SELECT p.id, p.user_id, p.name, p.description, p.price, p.\`condition\`, p.location,
            p.status, p.created_at, p.category_id, c.name AS category_name,
            u.full_name AS seller_name, u.phone AS seller_phone, u.avatar AS seller_avatar
       ${CARD_FROM}
      WHERE p.id = ?`,
    [id]
  );
  return rows[0] || null;
}

/** Ảnh của sản phẩm, theo thứ tự thêm vào (id tăng dần). */
async function findImages(productId) {
  const [rows] = await pool.query(
    "SELECT id, image_url FROM product_images WHERE product_id = ? ORDER BY id ASC",
    [productId]
  );
  return rows;
}

/**
 * Tạo sản phẩm + ảnh trong 1 transaction. status luôn là 'pending'.
 * data: { user_id, category_id, name, description, price, condition, location }
 * Trả về id sản phẩm mới. Lỗi -> rollback rồi ném lại lỗi.
 */
async function create(data, imageUrls) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO products (user_id, category_id, name, description, price, \`condition\`, location, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [data.user_id, data.category_id, data.name, data.description, data.price, data.condition, data.location]
    );
    const productId = result.insertId;
    for (const url of imageUrls) {
      await conn.query("INSERT INTO product_images (product_id, image_url) VALUES (?, ?)", [productId, url]);
    }
    await conn.commit();
    return productId;
  } catch (err) {
    try { await conn.rollback(); } catch (e) { /* bỏ qua lỗi rollback, ném lỗi gốc */ }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Sửa sản phẩm trong 1 transaction. Sửa nội dung LUÔN đưa tin về 'pending' (chờ admin duyệt lại).
 * fields: chỉ gồm các khóa trong UPDATABLE_COLUMNS (khóa khác bị bỏ qua).
 * removeImageIds: id ảnh cần xóa (đã được controller kiểm tra thuộc sản phẩm).
 * addImageUrls: đường dẫn ảnh mới.
 */
async function update(id, fields, removeImageIds = [], addImageUrls = []) {
  const sets = [];
  const params = [];
  for (const key of Object.keys(fields)) {
    if (hasOwn(UPDATABLE_COLUMNS, key)) {
      sets.push(UPDATABLE_COLUMNS[key] + " = ?");
      params.push(fields[key]);
    }
  }
  sets.push("status = 'pending'");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
    if (removeImageIds.length) {
      const marks = removeImageIds.map(() => "?").join(", ");
      await conn.query(
        `DELETE FROM product_images WHERE product_id = ? AND id IN (${marks})`,
        [id, ...removeImageIds]
      );
    }
    for (const url of addImageUrls) {
      await conn.query("INSERT INTO product_images (product_id, image_url) VALUES (?, ?)", [id, url]);
    }
    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch (e) { /* bỏ qua */ }
    throw err;
  } finally {
    conn.release();
  }
}

/** approved -> sold. Trả true nếu đổi được, false nếu tin không ở trạng thái approved. */
async function markSold(id) {
  const [result] = await pool.query(
    "UPDATE products SET status = 'sold' WHERE id = ? AND status = 'approved'",
    [id]
  );
  return result.affectedRows > 0;
}

/** Xóa sản phẩm (ảnh + yêu thích bị xóa theo nhờ ON DELETE CASCADE). Trả true nếu có xóa. */
async function remove(id) {
  const [result] = await pool.query("DELETE FROM products WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

module.exports = {
  findAll,
  findByUser,
  findById,
  findImages,
  create,
  update,
  markSold,
  remove,
  toCard,
  toDetail,
};