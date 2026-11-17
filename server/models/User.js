const pool = require('../config/database');

const User = {
  findByEmail: async (email) => {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  },

  findById: async (id) => {
    const [rows] = await pool.query(
      'SELECT id, full_name, email, phone, avatar, role, status, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0];
  },

  create: async ({ full_name, email, password, phone }) => {
    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, password, phone, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [full_name, email, password, phone || null, 'user', 'active']
    );
    return result.insertId;
  },

  updateProfile: async (id, { full_name, phone, avatar }) => {
    const [result] = await pool.query(
      'UPDATE users SET full_name = ?, phone = ?, avatar = COALESCE(?, avatar) WHERE id = ?',
      [full_name, phone || null, avatar || null, id]
    );
    return result.affectedRows > 0;
  }
};

module.exports = User;