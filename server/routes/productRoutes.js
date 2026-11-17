/*
 * FILE   : server/routes/productRoutes.js
 * CHỦ FILE: TV3 – Product (Danh sách/Tìm kiếm/Chi tiết sản phẩm)
 * BRANCH : feature/tv3-products
 * NHIỆM VỤ: Route /api/products/* (TV3 SỞ HỮU; TV4 là người gọi các route ghi dữ liệu)
 *
 *   GET    /                công khai     danh sách (chỉ approved)
 *   GET    /search          công khai     bí danh của danh sách (tham số q hoặc search)
 *   GET    /:id             công khai*    chi tiết (*chủ tin/admin xem được mọi trạng thái)
 *   POST   /                đăng nhập     đăng tin (multipart, field images, 1–5 ảnh)
 *   PUT    /:id/sold        chủ tin       đánh dấu đã bán
 *   PUT    /:id             chủ tin       sửa tin (multipart hoặc JSON)
 *   DELETE /:id             chủ tin       xóa tin
 *
 * THỨ TỰ QUAN TRỌNG: "/search" phải khai báo TRƯỚC "/:id", nếu không Express hiểu "search" là một id.
 *
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { verifyToken } = require("../middleware/authMiddleware"); // TV2
const uploadMiddleware = require("../middleware/uploadMiddleware"); // TV4: { uploadProducts, uploadAvatar }

const UPLOAD_ERROR_MESSAGES = {
  LIMIT_FILE_SIZE: "Mỗi ảnh tối đa 5 MB",
  LIMIT_FILE_COUNT: "Tối đa 5 ảnh",
  LIMIT_UNEXPECTED_FILE: "Tối đa 5 ảnh và tên trường ảnh phải là 'images'",
  LIMIT_PART_COUNT: "Dữ liệu gửi lên quá nhiều phần",
  LIMIT_FIELD_COUNT: "Dữ liệu gửi lên quá nhiều trường",
};

/**
 * Gắn uploadProducts của TV4 và chuyển lỗi upload thành phản hồi 400 đúng định dạng chung.
 * Nếu TV4 chưa viết xong uploadMiddleware (module rỗng) -> trả 501 thay vì làm sập server lúc khởi động.
 */
function uploadImages(req, res, next) {
  if (typeof uploadMiddleware.uploadProducts !== "function") {
    return res.status(501).json({ success: false, message: "TV4 chưa triển khai uploadMiddleware.uploadProducts" });
  }
  uploadMiddleware.uploadProducts(req, res, (err) => {
    if (!err) return next();

    // Lỗi hệ thống (đĩa, quyền ghi...) -> 500 chung; lỗi do người dùng (multer, loại file) -> 400
    const isSystemError = err.code && /^(E[A-Z]+)$/.test(err.code);
    if (isSystemError) {
      console.error("[productRoutes] lỗi upload", err);
      return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lưu ảnh" });
    }
    const message = UPLOAD_ERROR_MESSAGES[err.code] || err.message || "Ảnh tải lên không hợp lệ";
    return res.status(400).json({ success: false, message, errors: { images: message } });
  });
}

// ----- Công khai
router.get("/", productController.list);
router.get("/search", productController.list); // phải đứng TRƯỚC "/:id"
router.get("/:id", productController.getById);

// ----- Cần đăng nhập (verifyToken của TV2 gán req.user = { id, role })
router.post("/", verifyToken, uploadImages, productController.create);
router.put("/:id/sold", verifyToken, productController.markSold);
router.put("/:id", verifyToken, uploadImages, productController.update);
router.delete("/:id", verifyToken, productController.remove);

module.exports = router;
