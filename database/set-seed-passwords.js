/*
 * FILE   : database/set-seed-passwords.js
 * CHỦ FILE: TV6 – Backend/Database/Admin & Tích hợp
 * BRANCH : feature/tv6-admin
 * NHIỆM VỤ: Đặt mật khẩu bcrypt cho tài khoản mẫu
 * TODO:
 *   [ ] Chạy sau khi import seed.sql
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

// Chạy sau khi import seed.sql:  npm run seed:passwords
require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("../server/config/database");

(async () => {
  const admin = await bcrypt.hash("Admin@123", 10);
  const user = await bcrypt.hash("123456", 10);
  await pool.query("UPDATE users SET password = ? WHERE role = 'admin'", [admin]);
  await pool.query("UPDATE users SET password = ? WHERE role = 'user'", [user]);
  console.log("Đã đặt mật khẩu: admin@reuse.vn / Admin@123, user: 123456");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
