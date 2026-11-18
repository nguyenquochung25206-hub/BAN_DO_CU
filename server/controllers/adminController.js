'use strict';

const { AdminRepository, HttpError } = require('../repositories/AdminRepository');
const { cleanupProductImages } = require('../services/adminProductFileCleanup');
const repository = new AdminRepository();

const VALID_USER_STATUSES = ['active', 'locked'];
const VALID_PRODUCT_STATUSES = ['pending', 'approved', 'rejected', 'sold'];

function parseId(raw) {
  if (!/^[1-9]\d*$/.test(String(raw))) throw new HttpError(400, 'ID phải là số nguyên dương');
  const id = Number(raw);
  if (!Number.isSafeInteger(id)) throw new HttpError(400, 'ID không hợp lệ');
  return id;
}

function pageArgs(query) {
  const read = (raw, defaultValue, max, name) => {
    if (raw === undefined) return defaultValue;
    if (!/^[1-9]\d*$/.test(String(raw))) throw new HttpError(400, `${name} phải là số nguyên dương`);
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n > max) throw new HttpError(400, `${name} vượt giới hạn cho phép`);
    return n;
  };
  const page = read(query.page, 1, 1000000, 'page');
  const limit = read(query.limit, 12, 50, 'limit');
  return { page, limit, offset: (page - 1) * limit };
}

function filterStatus(raw, allowed, fallback) {
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'all') return null;
  if (!allowed.includes(raw)) throw new HttpError(400, 'Giá trị status không hợp lệ');
  return raw;
}

function categoryInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Body phải là JSON object');
  }
  const name = body.name;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    throw new HttpError(400, 'Tên danh mục phải dài từ 2 đến 100 ký tự');
  }
  if (body.description !== undefined && body.description !== null &&
      (typeof body.description !== 'string' || body.description.length > 2000)) {
    throw new HttpError(400, 'Mô tả danh mục không hợp lệ');
  }
  return { name: name.trim(), description: body.description === undefined
    ? undefined : (body.description?.trim() || null) };
}

function paged(res, rows, total, page, limit) {
  return res.json({ success: true, data: rows,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
}
const handle = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);

exports.listUsers = handle(async (req, res) => {
  const { page, limit, offset } = pageArgs(req.query);
  const status = filterStatus(req.query.status, VALID_USER_STATUSES, null);
  const search = req.query.search === undefined ? '' : req.query.search;
  if (typeof search !== 'string' || search.trim().length > 100) {
    throw new HttpError(400, 'Từ khóa tìm kiếm không hợp lệ');
  }
  const { rows, total } = await repository.listUsers({ search: search.trim(), status, limit, offset });
  return paged(res, rows, total, page, limit);
});

exports.changeUserStatus = handle(async (req, res) => {
  const id = parseId(req.params.id);
  const status = req.body?.status;
  if (!VALID_USER_STATUSES.includes(status)) throw new HttpError(400, 'status phải là active hoặc locked');
  const user = await repository.changeUserStatus(id, req.admin.id, status);
  return res.json({ success: true, message: 'Đã cập nhật trạng thái tài khoản', data: { user } });
});

exports.listProducts = handle(async (req, res) => {
  const { page, limit, offset } = pageArgs(req.query);
  const status = filterStatus(req.query.status, VALID_PRODUCT_STATUSES, 'pending');
  const { rows, total } = await repository.listProducts({ status, limit, offset });
  return paged(res, rows, total, page, limit);
});

exports.approveProduct = handle(async (req, res) => {
  const data = await repository.reviewProduct(parseId(req.params.id), 'approved');
  return res.json({ success: true, message: 'Đã duyệt sản phẩm', data });
});

exports.rejectProduct = handle(async (req, res) => {
  // schema hiện tại KHÔNG có review_note, chỉ thay status thành rejected.
  const data = await repository.reviewProduct(parseId(req.params.id), 'rejected');
  return res.json({ success: true, message: 'Đã từ chối sản phẩm', data });
});

exports.deleteProduct = handle(async (req, res) => {
  const urls = await repository.deleteProduct(parseId(req.params.id));
  const cleanupFailures = await cleanupProductImages(urls);
  if (cleanupFailures.length) {
    console.error('[TV6] Cần kiểm tra ảnh chưa được dọn sau khi xóa sản phẩm:', cleanupFailures.length);
  }
  return res.json({ success: true, message: cleanupFailures.length
    ? 'Đã xóa dữ liệu sản phẩm; một số ảnh cần dọn thủ công'
    : 'Đã xóa sản phẩm' });
});

exports.createCategory = handle(async (req, res) => {
  const { name, description } = categoryInput(req.body);
  const data = await repository.createCategory({ name, description: description ?? null });
  return res.status(201).json({ success: true, data });
});

exports.updateCategory = handle(async (req, res) => {
  const data = await repository.updateCategory(parseId(req.params.id), categoryInput(req.body));
  return res.json({ success: true, data });
});

exports.getStats = handle(async (_req, res) => {
  return res.json({ success: true, data: await repository.getStats() });
});
