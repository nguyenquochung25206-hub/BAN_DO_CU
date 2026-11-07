/*
 * FILE   : server/server.js
 * CHỦ FILE: TV6 – Backend/Database/Admin & Tích hợp
 * BRANCH : feature/tv6-admin
 * NHIỆM VỤ: Khởi tạo Express, gắn routes
 * TODO:
 *   [ ] Gắn đủ route, middleware chung, xử lý lỗi
 *   [ ] Tích hợp code 5 thành viên
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const pool = require("./config/database");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File tĩnh
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "..", "client")));

// API routes (mỗi route do 1 thành viên sở hữu)
app.use("/api/auth", require("./routes/authRoutes"));           // TV2
app.use("/api/products", require("./routes/productRoutes"));    // TV3 (+TV4 dùng)
app.use("/api/categories", require("./routes/categoryRoutes")); // TV3
app.use("/api/wishlist", require("./routes/wishlistRoutes"));   // TV5
app.use("/api/users", require("./routes/userRoutes"));          // TV5
app.use("/api/admin", require("./routes/adminRoutes"));         // TV6

app.get("/api/health", async (req, res) => {
  try { await pool.query("SELECT 1"); res.json({ success: true, db: "ok" }); }
  catch (e) { res.status(500).json({ success: false, db: e.message }); }
});

// 404
app.use("/api", (req, res) => res.status(404).json({ success: false, message: "API không tồn tại" }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, "..", "client", "pages", "404.html")));

// Xử lý lỗi chung
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ success: false, message: err.message || "Lỗi máy chủ" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`REUSE chạy tại http://localhost:${PORT}`));
