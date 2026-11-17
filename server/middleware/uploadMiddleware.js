/* Upload middleware used by TV3 product create/update routes. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const productUploadDir = path.join(__dirname, "..", "uploads", "products");
fs.mkdirSync(productUploadDir, { recursive: true });

const extensionsByMime = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const allowedExtensions = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, productUploadDir);
  },
  filename: function (req, file, callback) {
    const extension = extensionsByMime[file.mimetype];
    callback(null, crypto.randomUUID() + extension);
  },
});

function fileFilter(req, file, callback) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(extensionsByMime, file.mimetype) ||
      !allowedExtensions[file.mimetype].includes(extension)) {
    const error = new Error("Chỉ chấp nhận ảnh JPG, PNG hoặc WebP");
    error.code = "INVALID_IMAGE_TYPE";
    return callback(error);
  }
  callback(null, true);
}

const uploadProducts = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
    fields: 20,
    parts: 30,
  },
}).array("images", 5);

module.exports = {
  uploadProducts: uploadProducts,
};
