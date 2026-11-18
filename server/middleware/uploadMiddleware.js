/* Middleware upload ảnh sản phẩm và ảnh đại diện. */
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const productUploadDir = path.join(__dirname, "..", "uploads", "products");
const avatarUploadDir = path.join(__dirname, "..", "uploads", "avatars");
fs.mkdirSync(productUploadDir, { recursive: true });
fs.mkdirSync(avatarUploadDir, { recursive: true });

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

function fileFilter(req, file, callback) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (
    !Object.prototype.hasOwnProperty.call(extensionsByMime, file.mimetype) ||
    !allowedExtensions[file.mimetype].includes(extension)
  ) {
    const error = new Error("Chỉ chấp nhận ảnh JPG, PNG hoặc WebP");
    error.code = "INVALID_IMAGE_TYPE";
    return callback(error);
  }
  return callback(null, true);
}

function buildStorage(directory) {
  return multer.diskStorage({
    destination(req, file, callback) {
      callback(null, directory);
    },
    filename(req, file, callback) {
      callback(null, crypto.randomUUID() + extensionsByMime[file.mimetype]);
    },
  });
}

const receiveProducts = multer({
  storage: buildStorage(productUploadDir),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 20, parts: 30 },
}).array("images", 5);

const receiveAvatar = multer({
  storage: buildStorage(avatarUploadDir),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, parts: 12 },
}).single("avatar");

// Kiểm tra chữ ký (magic bytes) của ảnh; chưa thay thế giải mã/kiểm thử ảnh đầy đủ.
async function hasValidImageSignature(file) {
  const handle = await fsp.open(file.path, "r");
  try {
    const bytes = Buffer.alloc(12);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    if (file.mimetype === "image/jpeg") {
      return bytesRead >= 3 &&
        bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (file.mimetype === "image/png") {
      return bytesRead >= 8 &&
        bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
    if (file.mimetype === "image/webp") {
      return bytesRead >= 12 &&
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP";
    }
    return false;
  } finally {
    await handle.close();
  }
}

async function removeUploadedFiles(files) {
  await Promise.all(
    files.map((file) => fsp.unlink(file.path).catch(() => {}))
  );
}

function invalidImageContentError() {
  const error = new Error("Nội dung ảnh không khớp định dạng JPG, PNG hoặc WebP");
  error.code = "INVALID_IMAGE_CONTENT";
  return error;
}

function uploadProducts(req, res, next) {
  receiveProducts(req, res, async function (err) {
    if (err) return next(err);
    const files = req.files || [];
    try {
      for (const file of files) {
        if (!(await hasValidImageSignature(file))) {
          await removeUploadedFiles(files);
          req.files = [];
          return next(invalidImageContentError());
        }
      }
      return next();
    } catch (error) {
      await removeUploadedFiles(files);
      req.files = [];
      return next(error);
    }
  });
}

// Dùng với multipart/form-data, tên trường file phải là "avatar".
// Không bắt buộc có file: người dùng vẫn có thể cập nhật hồ sơ không đổi avatar.
function uploadAvatar(req, res, next) {
  receiveAvatar(req, res, async function (err) {
    if (err) return next(err);
    if (!req.file) return next();

    try {
      if (!(await hasValidImageSignature(req.file))) {
        await removeUploadedFiles([req.file]);
        delete req.file;
        return next(invalidImageContentError());
      }
      return next();
    } catch (error) {
      await removeUploadedFiles([req.file]);
      delete req.file;
      return next(error);
    }
  });
}

module.exports = { uploadProducts, uploadAvatar };
