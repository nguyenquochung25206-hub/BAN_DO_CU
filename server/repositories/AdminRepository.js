'use strict';

// SQL này bám database/schema.sql thực tế của BAN_DO_CU:
// products.user_id, users.password, products.price, product_images.image_url.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function escLike(value) {
  return String(value).replace(/[!%_]/g, (x) => `!${x}`);
}

class AdminRepository {
  constructor(pool) {
    this.pool = pool || require('../config/database');
  }

  async listUsers({ search, status, limit, offset }) {
    const where = [];
    const params = [];
    if (status) { where.push('u.status = ?'); params.push(status); }
    if (search) {
      where.push("(u.full_name LIKE ? ESCAPE '!' OR u.email LIKE ? ESCAPE '!')");
      const q = `%${escLike(search)}%`;
      params.push(q, q);
    }
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[countRow], [rows]] = await Promise.all([
      this.pool.query(`SELECT COUNT(*) AS total FROM users u ${condition}`, params),
      this.pool.query(
        `SELECT u.id, u.full_name, u.email, u.phone, u.avatar, u.role, u.status, u.created_at
         FROM users u ${condition} ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      )
    ]);
    return { rows, total: Number(countRow[0].total) };
  }

  async changeUserStatus(id, actorId, status) {
    if (id === actorId) throw new HttpError(400, 'Không được khóa/mở khóa tài khoản của chính mình');
    const [existing] = await this.pool.query('SELECT id, role FROM users WHERE id = ?', [id]);
    if (!existing.length) throw new HttpError(404, 'Không tìm thấy tài khoản');
    if (existing[0].role === 'admin') throw new HttpError(400, 'Không được thay đổi trạng thái admin khác');

    await this.pool.query("UPDATE users SET status = ? WHERE id = ? AND role = 'user'", [status, id]);
    const [rows] = await this.pool.query(
      'SELECT id, full_name, email, phone, avatar, role, status, created_at FROM users WHERE id = ?', [id]
    );
    return rows[0];
  }

  async listProducts({ status, limit, offset }) {
    const clause = status ? 'WHERE p.status = ?' : '';
    const params = status ? [status] : [];
    const [[countRow], [rows]] = await Promise.all([
      this.pool.query(`SELECT COUNT(*) AS total FROM products p ${clause}`, params),
      this.pool.query(
        `SELECT p.id, p.name, p.price, p.\`condition\`, p.location, p.status,
                p.created_at, p.category_id, c.name AS category_name,
                u.full_name AS seller_name,
                (SELECT pi.image_url FROM product_images pi
                 WHERE pi.product_id = p.id ORDER BY pi.id ASC LIMIT 1) AS thumbnail
         FROM products p
         JOIN categories c ON c.id = p.category_id
         JOIN users u ON u.id = p.user_id
         ${clause} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      )
    ]);
    return { rows: rows.map((p) => ({ ...p, price: Number(p.price) })), total: Number(countRow[0].total) };
  }

  async reviewProduct(id, status) {
    // Atomic compare-and-set: chỉ tin pending mới được duyệt/từ chối.
    const [result] = await this.pool.query(
      "UPDATE products SET status = ? WHERE id = ? AND status = 'pending'", [status, id]
    );
    if (!result.affectedRows) {
      const [rows] = await this.pool.query('SELECT id, status FROM products WHERE id = ?', [id]);
      if (!rows.length) throw new HttpError(404, 'Không tìm thấy sản phẩm');
      throw new HttpError(409, 'Tin đã được xử lý hoặc không còn chờ duyệt');
    }
    return { id, status };
  }

  async deleteProduct(id) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [items] = await conn.query('SELECT id FROM products WHERE id = ? FOR UPDATE', [id]);
      if (!items.length) throw new HttpError(404, 'Không tìm thấy sản phẩm');
      const [images] = await conn.query('SELECT image_url FROM product_images WHERE product_id = ?', [id]);
      // DB cascade dọn product_images / wishlists / reports, theo schema hiện tại.
      await conn.query('DELETE FROM products WHERE id = ?', [id]);
      await conn.commit();
      return images.map((i) => i.image_url);
    } catch (err) {
      try { await conn.rollback(); } catch (_) { /* giữ lỗi gốc */ }
      throw err;
    } finally {
      conn.release();
    }
  }

  async categoryById(id) {
    const [rows] = await this.pool.query('SELECT id, name, description, image FROM categories WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async checkCategoryName(name, exceptId = 0) {
    const [rows] = await this.pool.query(
      'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1', [name, exceptId]
    );
    if (rows.length) throw new HttpError(409, 'Tên danh mục đã tồn tại');
    // Chưa có UNIQUE(categories.name) nên check này KHÔNG đảm bảo chống race hoàn toàn.
  }

  async createCategory({ name, description }) {
    await this.checkCategoryName(name);
    const [result] = await this.pool.query(
      'INSERT INTO categories (name, description) VALUES (?, ?)', [name, description]
    );
    return this.categoryById(result.insertId);
  }

  async updateCategory(id, { name, description }) {
    const existing = await this.categoryById(id);
    if (!existing) throw new HttpError(404, 'Không tìm thấy danh mục');
    await this.checkCategoryName(name, id);
    await this.pool.query('UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [name, description === undefined ? existing.description : description, id]);
    return this.categoryById(id);
  }

  async getStats() {
    const [[usersRows], [categoriesRows], [productRows]] = await Promise.all([
      this.pool.query('SELECT COUNT(*) AS total FROM users'),
      this.pool.query('SELECT COUNT(*) AS total FROM categories'),
      this.pool.query('SELECT status, COUNT(*) AS total FROM products GROUP BY status')
    ]);
    const products = { pending: 0, approved: 0, rejected: 0, sold: 0 };
    for (const row of productRows) {
      if (Object.prototype.hasOwnProperty.call(products, row.status)) {
        products[row.status] = Number(row.total);
      }
    }
    return { users: Number(usersRows[0].total), categories: Number(categoriesRows[0].total), products };
  }
}

module.exports = { AdminRepository, HttpError };
