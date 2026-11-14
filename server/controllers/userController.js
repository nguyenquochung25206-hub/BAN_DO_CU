/* TV5 – feature/tv5-user. Chỉ sửa full_name, phone, avatar theo biên bản tuần 1. */
const pool = require("../config/database");
const uploadMiddleware = require("../middleware/uploadMiddleware");
const { toUser } = require("../utils/tv5Data");
const fs = require("node:fs/promises");
const path = require("node:path");

const avatarDirectory = path.resolve(__dirname, "..", "uploads", "avatars");
const profileColumns = "id, full_name, email, phone, avatar, role, status, created_at";

// TV4 cung cấp multer middleware .single('avatar') với diskStorage.
// Không cài upload riêng hay bỏ qua xác thực khi source nhóm còn là khung.
exports.uploadAvatar = (req, res, next) => {
  if (!req.is("multipart/form-data")) {
    return res.status(400).json({ success: false, message: "Hồ sơ cần gửi bằng multipart/form-data" });
  }
  if (typeof uploadMiddleware.uploadAvatar !== "function") {
    return res.status(501).json({ success: false, message: "TV4 chưa cung cấp uploadAvatar trong uploadMiddleware.js" });
  }
  uploadMiddleware.uploadAvatar(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, message: "Ảnh đại diện tối đa 5 MB", errors: { avatar: "Ảnh tối đa 5 MB" } });
    }
    if (err.name === "MulterError" || err.status === 400) {
      return res.status(400).json({ success: false, message: "Ảnh đại diện không hợp lệ", errors: { avatar: err.message } });
    }
    next(err);
  });
};

async function findProfile(id) {
  const [rows] = await pool.query(`SELECT ${profileColumns} FROM users WHERE id = ?`, [id]);
  return rows[0] ? toUser(rows[0]) : null;
}
function checkAccount(user, res) {
  if (!user) {
    res.status(404).json({ success: false, message: "Tài khoản không tồn tại" });
    return false;
  }
  if (user.status !== "active") {
    res.status(403).json({ success: false, message: "Tài khoản đã bị khóa" });
    return false;
  }
  return true;
}
exports.getProfile = async (req, res, next) => {
  try {
    const user = await findProfile(req.user.id);
    if (checkAccount(user, res)) res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

function uploadedPath(file) {
  if (!file || typeof file.path !== "string") return null;
  const resolved = path.resolve(file.path);
  return path.dirname(resolved) === avatarDirectory ? resolved : null;
}
async function removeFile(filePath) {
  if (!filePath || path.dirname(filePath) !== avatarDirectory) return;
  await fs.unlink(filePath).catch((err) => {
    if (err.code !== "ENOENT") console.error("Không dọn được avatar:", err.code);
  });
}
function oldAvatarPath(url) {
  if (typeof url !== "string" || !/^\/uploads\/avatars\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(url)) return null;
  return path.join(avatarDirectory, path.basename(url));
}
async function validImage(filePath, mime) {
  const handle = await fs.open(filePath, "r");
  try {
    const bytes = Buffer.alloc(12);
    const { bytesRead } = await handle.read(bytes, 0, 12, 0);
    if (mime === "image/jpeg") return bytesRead >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (mime === "image/png") return bytesRead >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if (mime === "image/webp") return bytesRead >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    return false;
  } finally { await handle.close(); }
}

exports.updateProfile = async (req, res, next) => {
  const newFile = uploadedPath(req.file);
  let saved = false;
  try {
    const body = req.body || {};
    const errors = {};
    const fields = {};
    for (const key of Object.keys(body)) {
      if (!["full_name", "phone"].includes(key)) errors[key] = "Không được thay đổi trường này";
      else if (typeof body[key] !== "string") errors[key] = "Thông tin phải là chuỗi văn bản";
      else fields[key] = body[key].trim();
    }
    if ("full_name" in fields && (!fields.full_name || fields.full_name.length > 100)) errors.full_name = "Họ tên cần từ 1 đến 100 ký tự";
    if ("phone" in fields) {
      if (fields.phone && (!/^\+?[\d\s().-]{6,20}$/.test(fields.phone) || fields.phone.replace(/\D/g, "").length < 6)) errors.phone = "Số điện thoại không hợp lệ";
      fields.phone = fields.phone || null;
    }
    if (req.file) {
      if (!newFile || !/\.(jpg|jpeg|png|webp)$/i.test(newFile) || req.file.size > 5 * 1024 * 1024
        || !(await validImage(newFile, req.file.mimetype))) errors.avatar = "Chọn ảnh JPG, PNG hoặc WebP hợp lệ, tối đa 5 MB";
      else fields.avatar = `/uploads/avatars/${path.basename(newFile)}`;
    }
    if (Object.keys(errors).length) {
      await removeFile(newFile);
      return res.status(400).json({ success: false, message: "Thông tin hồ sơ không hợp lệ", errors });
    }
    if (!Object.keys(fields).length) return res.status(400).json({ success: false, message: "Chưa có thông tin cần cập nhật" });
    const current = await findProfile(req.user.id);
    if (!checkAccount(current, res)) { await removeFile(newFile); return; }
    const keys = Object.keys(fields); // Chỉ full_name, phone, avatar.
    const [result] = await pool.query(
      `UPDATE users SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE id = ? AND status = 'active'`,
      [...keys.map((key) => fields[key]), req.user.id]);
    if (!result.affectedRows) {
      await removeFile(newFile);
      return res.status(409).json({ success: false, message: "Tài khoản đã thay đổi, vui lòng tải lại trang" });
    }
    saved = true;
    if (newFile && current.avatar !== fields.avatar) await removeFile(oldAvatarPath(current.avatar));
    const user = await findProfile(req.user.id);
    res.json({ success: true, message: "Đã cập nhật hồ sơ", data: { user } });
  } catch (err) {
    if (!saved) await removeFile(newFile);
    next(err);
  }
};
