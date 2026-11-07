/*
 * FILE   : server/config/database.js
 * CHỦ FILE: TV6 – Backend/Database/Admin & Tích hợp
 * BRANCH : feature/tv6-admin
 * NHIỆM VỤ: Kết nối MySQL (pool)
 * TODO:
 *   [ ] Đọc cấu hình từ .env
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "reuse_marketplace",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});

// Dùng: const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
module.exports = pool;
