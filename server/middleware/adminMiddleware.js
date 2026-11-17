'use strict';

// Sử dụng SAU verifyToken của TV2; kiểm tra DB mỗi request để role/locked còn hiệu lực.
function createIsAdmin(pool) {
  return async function isAdminMiddleware(req, res, next) {
    try {
      const id = Number(req.user?.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
      }

      const [rows] = await pool.query(
        'SELECT id, role, status FROM users WHERE id = ? LIMIT 1', [id]
      );
      const user = rows[0];
      if (!user || user.status !== 'active') {
        return res.status(403).json({ success: false, message: 'Tài khoản không được phép truy cập' });
      }
      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Chỉ quản trị viên được phép' });
      }
      req.admin = { id: user.id, role: user.role };
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

// Lazy-load pool để hàm có thể unit-test với pool giả.
function isAdmin(req, res, next) {
  const pool = require('../config/database');
  return createIsAdmin(pool)(req, res, next);
}

module.exports = { isAdmin, createIsAdmin };
