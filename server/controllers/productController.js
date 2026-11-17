/*
 * FILE   : server/controllers/productController.js
 * CHỦ FILE: TV3 – Product (Danh sách/Tìm kiếm/Chi tiết sản phẩm)
 * BRANCH : feature/tv3-products
 * NHIỆM VỤ: Nghiệp vụ sản phẩm
 *   - list / search : chỉ tin 'approved'; lọc, sắp xếp, phân trang
 *   - getById       : khách chỉ thấy approved/sold; chủ tin & admin thấy mọi trạng thái
 *   - create        : status = 'pending'
 *   - update        : chủ tin; sửa xong về 'pending'; không sửa được tin đã bán
 *   - markSold      : chủ tin; chỉ approved -> sold
 *   - remove        : chủ tin; xóa cả file ảnh
 *   - getMyProducts : cho GET /api/users/my-products (TV5 gắn route)
 *
 * Định dạng phản hồi theo Biên bản tuần 1:
 *   thành công { success:true, message?, data, pagination? }
 *   lỗi        { success:false, message, errors?: { tên_trường: 'lỗi' } }
 *
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const Product = require("../models/Product");
const Category = require("../models/Category");

// ---------------------------------------------------------------- Hằng số (khớp Biên bản tuần 1)
const CONDITIONS = ["new", "like_new", "good", "fair"];
const STATUSES = ["pending", "approved", "rejected", "sold"];
const SORTS = ["newest", "price_asc", "price_desc"];
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const MAX_PAGE = 1000000;
const MAX_IMAGES = 5;
const MAX_PRICE = 9999999999; // trần của DECIMAL(12,2)
const MAX_INT_ID = 2147483647; // trần của INT
const MAX_SEARCH_LENGTH = 100;

const UPLOAD_URL_PREFIX = "/uploads/products/";
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "products");

// ---------------------------------------------------------------- Tiện ích phản hồi
function fail(res, status, message, errors) {
  const body = { success: false, message };
  if (errors && Object.keys(errors).length) body.errors = errors;
  return res.status(status).json(body);
}

/** Kết quả chưa gửi đi (để còn dọn file xong rồi mới phản hồi). */
function failReply(status, message, errors) {
  const body = { success: false, message };
  if (errors && Object.keys(errors).length) body.errors = errors;
  return { status, body };
}

/**
 * Chạy 1 thao tác có upload ảnh. work(files) trả về { status, body }.
 * Nếu thao tác không thành công (status >= 400) hoặc ném lỗi -> xóa các file vừa upload TRƯỚC khi
 * phản hồi, để không còn file rác và để test/client thấy trạng thái đã sạch.
 */
async function withUploadCleanup(req, res, work) {
  const files = req.files || [];
  let result;
  try {
    result = await work(files);
  } catch (err) {
    await cleanupUploaded(files);
    throw err; // handle() sẽ trả 500
  }
  if (result.status >= 400) await cleanupUploaded(files);
  return res.status(result.status).json(result.body);
}

/** Bọc handler async: lỗi bất ngờ -> log + 500 (không lộ chi tiết SQL ra client). */
function handle(name, fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      console.error(`[productController.${name}]`, err);
      if (!res.headersSent) fail(res, 500, "Lỗi máy chủ, vui lòng thử lại sau");
    }
  };
}

// ---------------------------------------------------------------- Đọc & kiểm tra tham số
/** Id dương hợp lệ (chuỗi toàn chữ số, 1..INT max) -> số; ngược lại null. */
function parseId(value) {
  if (typeof value !== "string" || !/^\d{1,10}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= MAX_INT_ID ? n : null;
}

/** Giá trị query dạng chuỗi (đã trim). Mảng (?a=1&a=2) lấy phần tử đầu; object (?a[b]=1) bị bỏ qua. */
function qstr(value) {
  if (Array.isArray(value)) value = value[0];
  return typeof value === "string" ? value.trim() : "";
}

function parsePaging(query, errors) {
  let page = 1;
  let limit = DEFAULT_LIMIT;

  const rawPage = qstr(query.page);
  if (rawPage !== "") {
    if (!/^\d{1,7}$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > MAX_PAGE) {
      errors.page = "Số trang không hợp lệ";
    } else {
      page = Number(rawPage);
    }
  }
  const rawLimit = qstr(query.limit);
  if (rawLimit !== "") {
    if (!/^\d{1,4}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > MAX_LIMIT) {
      errors.limit = `limit phải từ 1 đến ${MAX_LIMIT}`;
    } else {
      limit = Number(rawLimit);
    }
  }
  return { page, limit };
}

function parsePriceParam(raw, field, errors) {
  if (raw === "") return null;
  if (!/^\d{1,10}$/.test(raw) || Number(raw) > MAX_PRICE) {
    errors[field] = "Giá phải là số nguyên không âm (VND)";
    return null;
  }
  return Number(raw);
}

/** Query của danh sách công khai. Trả { errors, filters }. */
function parseListQuery(query) {
  const errors = {};
  const { page, limit } = parsePaging(query, errors);
  const filters = { page, limit };

  // search ưu tiên hơn q (q là bí danh cho /api/products/search)
  const search = (qstr(query.search) || qstr(query.q)).slice(0, MAX_SEARCH_LENGTH);
  if (search) filters.search = search;

  const rawCategory = qstr(query.category_id);
  if (rawCategory !== "") {
    const id = parseId(rawCategory);
    if (id === null) errors.category_id = "Danh mục không hợp lệ";
    else filters.categoryId = id;
  }

  const minPrice = parsePriceParam(qstr(query.min_price), "min_price", errors);
  const maxPrice = parsePriceParam(qstr(query.max_price), "max_price", errors);
  if (minPrice !== null) filters.minPrice = minPrice;
  if (maxPrice !== null) filters.maxPrice = maxPrice;
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    errors.min_price = "Giá tối thiểu không được lớn hơn giá tối đa";
  }

  const condition = qstr(query.condition);
  if (condition !== "") {
    if (!CONDITIONS.includes(condition)) errors.condition = "Tình trạng không hợp lệ";
    else filters.condition = condition;
  }

  const sort = qstr(query.sort);
  if (sort !== "") {
    if (!SORTS.includes(sort)) errors.sort = "Kiểu sắp xếp không hợp lệ";
    else filters.sort = sort;
  }
  return { errors, filters };
}

function pagination(page, limit, total) {
  return { page, limit, total, total_pages: Math.ceil(total / limit) };
}

// ---------------------------------------------------------------- Người dùng & quyền
/**
 * Đọc người dùng từ header Authorization MÀ KHÔNG bắt buộc đăng nhập (dùng cho route công khai).
 * Token thiếu/sai/hết hạn -> coi như khách (null). Route cần đăng nhập vẫn dùng verifyToken của TV2.
 */
function getOptionalUser(req) {
  const header = (req.headers && req.headers.authorization) || "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return null;
  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET);
    const id = payload && Number(payload.id);
    return id ? { id, role: payload.role } : null;
  } catch (err) {
    return null;
  }
}

/** Ai được xem tin này? approved/sold: mọi người. Trạng thái khác: chủ tin và admin. */
function canView(product, user) {
  if (product.status === "approved" || product.status === "sold") return true;
  return !!user && (user.id === product.user_id || user.role === "admin");
}

// ---------------------------------------------------------------- File ảnh
function fileUrl(file) {
  return UPLOAD_URL_PREFIX + (file.filename || path.basename(file.path));
}

function filePath(file) {
  return file.path || path.join(UPLOAD_DIR, file.filename);
}

async function unlinkQuiet(diskPath) {
  try {
    await fs.promises.unlink(diskPath);
  } catch (err) {
    if (err.code !== "ENOENT") console.error("[productController] không xóa được file", diskPath, err.message);
  }
}

/** Xóa các file vừa upload (khi yêu cầu bị từ chối hoặc lỗi) để không để lại file rác. Chờ xóa xong mới trả về. */
async function cleanupUploaded(files) {
  await Promise.all(
    (files || []).map((file) => {
      try { return unlinkQuiet(filePath(file)); } catch (e) { return null; } // file thiếu path/filename: bỏ qua
    })
  );
}

/** Xóa file ảnh theo đường dẫn lưu trong DB. Chỉ xóa trong thư mục uploads/products (chống path traversal). */
async function deleteImageFiles(urls) {
  await Promise.all(
    urls
      .filter((url) => typeof url === "string" && url.startsWith(UPLOAD_URL_PREFIX))
      .map((url) => unlinkQuiet(path.join(UPLOAD_DIR, path.basename(url))))
  );
}

// ---------------------------------------------------------------- Kiểm tra dữ liệu tạo/sửa
/** Giá trị trường form -> chuỗi đã trim; undefined nếu không gửi; null nếu kiểu không hợp lệ. */
function fieldText(body, key) {
  const v = body[key];
  if (v === undefined) return undefined;
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

/**
 * Kiểm tra các trường văn bản của sản phẩm.
 * partial = false (tạo): mọi trường bắt buộc. partial = true (sửa): chỉ kiểm tra trường nào có gửi.
 * Trả { errors, values }.
 */
async function validateFields(body, partial) {
  const errors = {};
  const values = {};

  const name = fieldText(body, "name");
  if (name !== undefined || !partial) {
    if (!name) errors.name = "Vui lòng nhập tên sản phẩm";
    else if (name.length < 3) errors.name = "Tên sản phẩm tối thiểu 3 ký tự";
    else if (name.length > 200) errors.name = "Tên sản phẩm tối đa 200 ký tự";
    else values.name = name;
  }

  const description = fieldText(body, "description");
  if (description !== undefined || !partial) {
    if (!description) errors.description = "Vui lòng nhập mô tả";
    else if (description.length > 5000) errors.description = "Mô tả tối đa 5000 ký tự";
    else values.description = description;
  }

  const price = fieldText(body, "price");
  if (price !== undefined || !partial) {
    if (price === undefined || price === null || price === "") {
      errors.price = "Vui lòng nhập giá";
    } else if (!/^\d{1,11}$/.test(price)) {
      errors.price = "Giá phải là số nguyên dương (VND), không có dấu chấm hoặc chữ";
    } else if (Number(price) < 1 || Number(price) > MAX_PRICE) {
      errors.price = `Giá phải từ 1 đến ${MAX_PRICE}`;
    } else {
      values.price = Number(price);
    }
  }

  const condition = fieldText(body, "condition");
  if (condition !== undefined || !partial) {
    if (!condition) errors.condition = "Vui lòng chọn tình trạng";
    else if (!CONDITIONS.includes(condition)) errors.condition = "Tình trạng không hợp lệ";
    else values.condition = condition;
  }

  const location = fieldText(body, "location");
  if (location !== undefined || !partial) {
    if (!location) errors.location = "Vui lòng chọn khu vực";
    else if (location.length > 255) errors.location = "Khu vực tối đa 255 ký tự";
    else values.location = location;
  }

  const categoryRaw = fieldText(body, "category_id");
  if (categoryRaw !== undefined || !partial) {
    const categoryId = categoryRaw ? parseId(categoryRaw) : null;
    if (!categoryRaw) {
      errors.category_id = "Vui lòng chọn danh mục";
    } else if (categoryId === null) {
      errors.category_id = "Danh mục không hợp lệ";
    } else if (!(await Category.findById(categoryId))) {
      errors.category_id = "Danh mục không tồn tại";
    } else {
      values.category_id = categoryId;
    }
  }

  return { errors, values };
}

/**
 * remove_image_ids: chuỗi JSON mảng id (multipart) hoặc mảng thật (JSON body).
 * Trả { ids } hoặc { error }.
 */
function parseRemoveImageIds(raw) {
  if (raw === undefined || raw === null || raw === "") return { ids: [] };
  let list = raw;
  if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch (e) { return { error: "remove_image_ids phải là mảng JSON các id ảnh" }; }
  }
  if (!Array.isArray(list)) return { error: "remove_image_ids phải là mảng JSON các id ảnh" };

  const ids = [];
  for (const item of list) {
    const id = parseId(typeof item === "number" ? String(item) : item);
    if (id === null) return { error: "remove_image_ids chứa id ảnh không hợp lệ" };
    if (!ids.includes(id)) ids.push(id);
  }
  return { ids };
}

/** Nạp ProductDetail đầy đủ theo id (hoặc null). */
async function loadDetail(id) {
  const row = await Product.findById(id);
  if (!row) return null;
  return Product.toDetail(row, await Product.findImages(id));
}

// ---------------------------------------------------------------- Handler công khai
// GET /api/products   và   GET /api/products/search  (q hoặc search)
exports.list = handle("list", async (req, res) => {
  const { errors, filters } = parseListQuery(req.query || {});
  if (Object.keys(errors).length) return fail(res, 400, "Tham số tìm kiếm không hợp lệ", errors);

  const { rows, total } = await Product.findAll({ ...filters, status: "approved" });
  return res.json({
    success: true,
    data: rows,
    pagination: pagination(filters.page, filters.limit, total),
  });
});

// GET /api/products/:id
exports.getById = handle("getById", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, "ID sản phẩm không hợp lệ");

  const row = await Product.findById(id);
  // Tin chưa duyệt với người không có quyền -> 404 (không để lộ là tin có tồn tại)
  if (!row || !canView(row, getOptionalUser(req))) return fail(res, 404, "Không tìm thấy sản phẩm");

  return res.json({ success: true, data: Product.toDetail(row, await Product.findImages(id)) });
});

// ---------------------------------------------------------------- Handler cần đăng nhập
// POST /api/products   (verifyToken -> uploadProducts -> create)
exports.create = handle("create", (req, res) =>
  withUploadCleanup(req, res, async (files) => {
    if (!req.user) return failReply(401, "Bạn cần đăng nhập");

    const { errors, values } = await validateFields(req.body || {}, false);
    if (files.length < 1) errors.images = "Cần ít nhất 1 ảnh";
    else if (files.length > MAX_IMAGES) errors.images = `Tối đa ${MAX_IMAGES} ảnh`;
    if (Object.keys(errors).length) return failReply(400, "Dữ liệu không hợp lệ", errors);

    // user_id luôn lấy từ token; status luôn là 'pending' (do model đặt) – bỏ qua mọi giá trị client gửi
    const id = await Product.create({ ...values, user_id: req.user.id }, files.map(fileUrl));
    return {
      status: 201,
      body: {
        success: true,
        message: "Đăng tin thành công, tin đang chờ quản trị viên duyệt",
        data: await loadDetail(id),
      },
    };
  })
);

// PUT /api/products/:id   (chủ tin)
exports.update = handle("update", (req, res) =>
  withUploadCleanup(req, res, async (files) => {
    if (!req.user) return failReply(401, "Bạn cần đăng nhập");
    const id = parseId(req.params.id);
    if (id === null) return failReply(400, "ID sản phẩm không hợp lệ");

    const product = await Product.findById(id);
    if (!product) return failReply(404, "Không tìm thấy sản phẩm");
    if (product.user_id !== req.user.id) return failReply(403, "Bạn không phải chủ của tin này");
    if (product.status === "sold") return failReply(400, "Tin đã bán không thể chỉnh sửa");

    const body = req.body || {};
    const { errors, values } = await validateFields(body, true);
    const removal = parseRemoveImageIds(body.remove_image_ids);
    if (removal.error) errors.remove_image_ids = removal.error;

    const currentImages = await Product.findImages(id);
    let removedUrls = [];
    if (!removal.error) {
      const currentIds = currentImages.map((img) => img.id);
      if (removal.ids.some((imageId) => !currentIds.includes(imageId))) {
        errors.remove_image_ids = "Có ảnh không thuộc sản phẩm này";
      } else {
        const remaining = currentImages.length - removal.ids.length + files.length;
        if (remaining < 1) errors.images = "Sản phẩm cần ít nhất 1 ảnh";
        else if (remaining > MAX_IMAGES) errors.images = `Tối đa ${MAX_IMAGES} ảnh`;
        removedUrls = currentImages.filter((img) => removal.ids.includes(img.id)).map((img) => img.image_url);
      }
    }
    if (Object.keys(errors).length) return failReply(400, "Dữ liệu không hợp lệ", errors);

    if (!Object.keys(values).length && !removal.ids.length && !files.length) {
      return failReply(400, "Không có dữ liệu nào để cập nhật");
    }

    await Product.update(id, values, removal.ids, files.map(fileUrl));
    await deleteImageFiles(removedUrls); // DB đã cập nhật xong mới xóa file cũ

    return {
      status: 200,
      body: {
        success: true,
        message: "Đã cập nhật, tin đang chờ quản trị viên duyệt lại",
        data: await loadDetail(id),
      },
    };
  })
);

// PUT /api/products/:id/sold   (chủ tin)
exports.markSold = handle("markSold", async (req, res) => {
  if (!req.user) return fail(res, 401, "Bạn cần đăng nhập");
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, "ID sản phẩm không hợp lệ");

  const product = await Product.findById(id);
  if (!product) return fail(res, 404, "Không tìm thấy sản phẩm");
  if (product.user_id !== req.user.id) return fail(res, 403, "Bạn không phải chủ của tin này");
  if (product.status === "sold") return fail(res, 400, "Tin này đã được đánh dấu đã bán");
  if (product.status !== "approved") return fail(res, 400, "Chỉ tin đã được duyệt mới đánh dấu đã bán được");

  if (!(await Product.markSold(id))) return fail(res, 400, "Không thể đánh dấu đã bán, vui lòng tải lại trang");
  return res.json({ success: true, message: "Đã đánh dấu đã bán", data: await loadDetail(id) });
});

// DELETE /api/products/:id   (chủ tin)
exports.remove = handle("remove", async (req, res) => {
  if (!req.user) return fail(res, 401, "Bạn cần đăng nhập");
  const id = parseId(req.params.id);
  if (id === null) return fail(res, 400, "ID sản phẩm không hợp lệ");

  const product = await Product.findById(id);
  if (!product) return fail(res, 404, "Không tìm thấy sản phẩm");
  if (product.user_id !== req.user.id) return fail(res, 403, "Bạn không phải chủ của tin này");

  const images = await Product.findImages(id);
  if (!(await Product.remove(id))) return fail(res, 404, "Không tìm thấy sản phẩm");
  await deleteImageFiles(images.map((img) => img.image_url)); // DB đã xóa xong mới xóa file
  return res.json({ success: true, message: "Đã xóa sản phẩm" });
});

// GET /api/users/my-products   (TV5 gắn route + verifyToken; hàm xử lý là của TV3)
exports.getMyProducts = handle("getMyProducts", async (req, res) => {
  if (!req.user) return fail(res, 401, "Bạn cần đăng nhập");

  const query = req.query || {};
  const errors = {};
  const { page, limit } = parsePaging(query, errors);
  const filters = { page, limit, sort: "newest" };

  const status = qstr(query.status);
  if (status !== "") {
    if (!STATUSES.includes(status)) errors.status = "Trạng thái không hợp lệ";
    else filters.status = status;
  }
  if (Object.keys(errors).length) return fail(res, 400, "Tham số không hợp lệ", errors);

  const { rows, total } = await Product.findByUser(req.user.id, filters);
  return res.json({ success: true, data: rows, pagination: pagination(page, limit, total) });
});
