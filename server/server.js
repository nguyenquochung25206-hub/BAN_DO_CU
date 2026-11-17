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
  try {
    await pool.query("SELECT 1");

    return res.status(200).json({
      success: true,
      data: {
        status: "ok",
        database: "connected"
      }
    });
  } catch (error) {
    console.error("[HEALTH] Database unavailable:", error);

    return res.status(503).json({
      success: false,
      message: "Không thể kết nối cơ sở dữ liệu"
    });
  }
});


// 404
app.use("/api", (req, res) => res.status(404).json({ success: false, message: "API không tồn tại" }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, "..", "client", "pages", "404.html")));

// Xử lý lỗi chung

app.use((err, req, res, next) => {
  console.error("[SERVER ERROR]", err);

  const status =
    Number.isInteger(err.status) &&
    err.status >= 400 &&
    err.status <= 599
      ? err.status
      : 500;

  return res.status(status).json({
    success: false,
    message:
      status >= 500
        ? "Lỗi máy chủ"
        : err.message || "Yêu cầu không hợp lệ"
  });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`REUSE chạy tại http://localhost:${PORT}`));
