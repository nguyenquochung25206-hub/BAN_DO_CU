/* TV5: test HTTP theo hợp đồng tuần 1. Chỉ mock DB/auth/upload của các TV khác trong tiến trình test. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
let queries = [];
const databasePath = require.resolve("../server/config/database");
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: {
  async query(sql, values) {
    const expected = queries.shift();
    assert.ok(expected, "Unexpected SQL: " + sql);
    assert.match(sql, expected.sql);
    if (expected.values) assert.deepEqual(values, expected.values);
    if (expected.check) expected.check(sql, values);
    if (expected.error) throw expected.error;
    return [expected.result];
  },
} };
const authPath = require.resolve("../server/middleware/authMiddleware");
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: {
  verifyToken(req, res, next) {
    const id = Number(req.get("x-test-user-id"));
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(401).json({ success: false, message: "Test: login required" });
    req.user = { id };
    next();
  },
} };
// Fixture TV4 dùng multer thật với đúng export uploadAvatar và thư mục theo hợp đồng.
const multer = require("multer");
const avatarDirectory = path.resolve(__dirname, "../server/uploads/avatars");
const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) { fs.mkdir(avatarDirectory, { recursive: true }).then(() => cb(null, avatarDirectory), cb); },
    filename(req, file, cb) { cb(null, "tv5-contract-" + randomUUID() + ({ "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" }[file.mimetype] || ".bad")); },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 6 },
  fileFilter(req, file, cb) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)) return cb(Object.assign(new Error("Sai định dạng ảnh"), { status: 400 }));
    cb(null, true);
  },
}).single("avatar");
const uploadPath = require.resolve("../server/middleware/uploadMiddleware");
const uploadExports = { uploadAvatar };
require.cache[uploadPath] = { id: uploadPath, filename: uploadPath, loaded: true, exports: uploadExports };

const express = require("express");
const app = express();
app.use(express.json());
app.use("/api/wishlist", require("../server/routes/wishlistRoutes"));
app.use("/api/users", require("../server/routes/userRoutes"));
const errors = [];
app.use((err, req, res, next) => { errors.push(err); res.status(500).json({ success: false, message: "Test server error" }); });
let server;
let origin;
const user = { id: 2, full_name: "Nguyễn An", email: "an@reuse.vn", phone: "0911111111", avatar: null, role: "user", status: "active", created_at: "2026-11-01T00:00:00.000Z" };
const profileSelect = /SELECT id, full_name, email, phone, avatar, role, status, created_at FROM users WHERE id = \?/;
before(async () => {
  server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  origin = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  for (const name of await fs.readdir(avatarDirectory)) {
    if (/^tv5-contract-[a-f0-9-]+\.(png|jpg|webp|bad)$/.test(name)) await fs.unlink(path.join(avatarDirectory, name));
  }
  assert.equal(queries.length, 0);
});
async function request(url, { method = "GET", body, loggedIn = true, json = false } = {}) {
  const headers = loggedIn ? { "x-test-user-id": "2" } : {};
  if (body && !(body instanceof FormData)) {
    if (method === "PUT" && !json) {
      const form = new FormData();
      for (const [key, value] of Object.entries(body)) form.append(key, value);
      body = form;
    } else { headers["Content-Type"] = "application/json"; body = JSON.stringify(body); }
  }
  const response = await fetch(origin + url, { method, body, headers });
  const data = await response.json();
  assert.equal(queries.length, 0, "All expected queries should execute");
  return { status: response.status, ...data };
}
test("every TV5 endpoint is protected, including /wishlist/ids", async () => {
  for (const [url, method] of [["/api/wishlist", "GET"], ["/api/wishlist/ids", "GET"], ["/api/wishlist", "POST"], ["/api/wishlist/1", "DELETE"], ["/api/users/profile", "GET"], ["/api/users/profile", "PUT"], ["/api/users/my-products", "GET"]]) {
    assert.equal((await request(url, { method, loggedIn: false })).status, 401);
  }
});
test("wishlist rejects invalid IDs without SQL", async () => {
  for (const id of [0, -1, "1 OR 1=1", "1.2", {}, [7], true, "9007199254740993"]) {
    assert.equal((await request("/api/wishlist", { method: "POST", body: { product_id: id } })).status, 400);
  }
  assert.equal((await request("/api/wishlist/nope", { method: "DELETE" })).status, 400);
});
test("add uses authenticated user; duplicate and unavailable products have standard status codes", async () => {
  queries.push({ sql: /INSERT INTO wishlists[\s\S]*status IN \('approved', 'sold'\)/, values: [2, 7], result: { affectedRows: 1, insertId: 8 } });
  assert.equal((await request("/api/wishlist", { method: "POST", body: { product_id: 7, user_id: 999 } })).status, 201);
  queries.push({ sql: /INSERT INTO wishlists/, error: { code: "ER_DUP_ENTRY" } });
  assert.equal((await request("/api/wishlist", { method: "POST", body: { product_id: 7 } })).status, 409);
  queries.push({ sql: /INSERT INTO wishlists/, result: { affectedRows: 0 } });
  assert.equal((await request("/api/wishlist", { method: "POST", body: { product_id: 7 } })).status, 404);
});
test("DELETE takes product_id and never deletes another user's row", async () => {
  queries.push({ sql: /DELETE FROM wishlists WHERE user_id = \? AND product_id = \?/, values: [2, 7], result: { affectedRows: 0 } });
  assert.equal((await request("/api/wishlist/7", { method: "DELETE" })).status, 404);
  queries.push({ sql: /DELETE FROM wishlists WHERE user_id = \? AND product_id = \?/, values: [2, 7], result: { affectedRows: 1 } });
  assert.equal((await request("/api/wishlist/7", { method: "DELETE" })).status, 200);
});
test("GET wishlist returns exact WishlistItem/ProductCard fields, numeric price, ISO dates", async () => {
  queries.push({
    sql: /FROM wishlists w[\s\S]*JOIN categories[\s\S]*JOIN users[\s\S]*WHERE w.user_id = \?/,
    values: [2],
    result: [{ wishlist_id: 9, wishlist_created_at: "2026-11-10 12:00:00", id: 7, name: "Vợt", price: "400000.00", condition: "good", location: "Hà Nội", status: "approved", created_at: new Date("2026-11-01T00:00:00Z"), category_id: 7, category_name: "Thể thao", thumbnail: "/uploads/products/7.jpg", seller_name: "Bình" }],
    check(sql) { assert.match(sql, /p\.\x60condition\x60/); assert.match(sql, /status IN \('approved', 'sold'\)/); },
  });
  const response = await request("/api/wishlist");
  const item = response.data[0];
  assert.deepEqual(Object.keys(item).sort(), ["created_at", "product", "wishlist_id"]);
  assert.equal(item.created_at, "2026-11-10T05:00:00.000Z");
  assert.equal(item.product.price, 400000);
  assert.equal(typeof item.product.price, "number");
  assert.deepEqual(Object.keys(item.product).sort(), ["id", "name", "price", "condition", "location", "status", "created_at", "category_id", "category_name", "thumbnail", "seller_name"].sort());
  assert.equal(item.product.created_at, "2026-11-01T00:00:00.000Z");
});
test("GET /wishlist/ids returns numeric product IDs only, with ownership filter", async () => {
  queries.push({ sql: /SELECT product_id FROM wishlists WHERE user_id = \?/, values: [2], result: [{ product_id: 7 }, { product_id: 8 }] });
  assert.deepEqual((await request("/api/wishlist/ids")).data, [7, 8]);
});
test("GET profile wraps User in data.user and excludes password even if a DB row contains it", async () => {
  queries.push({ sql: profileSelect, values: [2], result: [{ ...user, password: "must-not-leak" }], check(sql) { assert.doesNotMatch(sql, /password|SELECT \*/); } });
  const response = await request("/api/users/profile");
  assert.deepEqual(response.data, { user });
});
test("profile rejects email, role, status, password, id and avatar strings", async () => {
  for (const [key, value] of Object.entries({ email: "new@reuse.vn", role: "admin", status: "active", password: "new", id: 99, avatar: "/fake" })) {
    const response = await request("/api/users/profile", { method: "PUT", body: { [key]: value } });
    assert.equal(response.status, 400);
    assert.ok(response.errors[key]);
  }
});
test("profile enforces multipart and validates name, phone and duplicate fields", async () => {
  assert.equal((await request("/api/users/profile", { method: "PUT", body: { full_name: "An" }, json: true })).status, 400);
  for (const body of [{ full_name: "   " }, { full_name: "A".repeat(101) }, { phone: "abc123" }, { phone: "1".repeat(21) }]) {
    assert.equal((await request("/api/users/profile", { method: "PUT", body })).status, 400);
  }
  const form = new FormData(); form.append("full_name", "A"); form.append("full_name", "B");
  assert.equal((await request("/api/users/profile", { method: "PUT", body: form })).status, 400);
});
test("profile persists only full_name/phone and keeps email unchanged", async () => {
  const updated = { ...user, full_name: "An Mới", phone: null };
  queries.push(
    { sql: profileSelect, values: [2], result: [user] },
    { sql: /UPDATE users SET full_name = \?, phone = \? WHERE id = \? AND status = 'active'/, values: ["An Mới", null, 2], result: { affectedRows: 1 } },
    { sql: profileSelect, values: [2], result: [updated] },
  );
  assert.deepEqual((await request("/api/users/profile", { method: "PUT", body: { full_name: " An Mới ", phone: "" } })).data, { user: updated });
});
test("locked/deleted accounts cannot read or update profile", async () => {
  queries.push({ sql: profileSelect, result: [{ ...user, status: "locked" }] });
  assert.equal((await request("/api/users/profile")).status, 403);
  queries.push({ sql: profileSelect, result: [] });
  assert.equal((await request("/api/users/profile")).status, 404);
  queries.push({ sql: profileSelect, result: [{ ...user, status: "locked" }] });
  assert.equal((await request("/api/users/profile", { method: "PUT", body: { full_name: "An" } })).status, 403);
});
test("avatar rejects wrong MIME, forged content, wrong field, too many files and oversized images", async () => {
  for (const [field, type, bytes] of [["avatar", "text/html", "<script>"], ["avatar", "image/png", "not png"], ["images", "image/png", "data"], ["avatar", "image/png", Buffer.alloc(5 * 1024 * 1024 + 1)]]) {
    const form = new FormData(); form.append(field, new Blob([bytes], { type }), "image.png");
    assert.equal((await request("/api/users/profile", { method: "PUT", body: form })).status, 400);
  }
  const form = new FormData();
  for (let i = 0; i < 2; i++) form.append("avatar", new Blob(["png"], { type: "image/png" }), "a.png");
  assert.equal((await request("/api/users/profile", { method: "PUT", body: form })).status, 400);
});
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=", "base64");
test("avatar is taken from TV4 disk middleware, persisted, and old image removed", async () => {
  const oldName = "tv5-contract-" + randomUUID() + ".png";
  await fs.writeFile(path.join(avatarDirectory, oldName), png);
  let avatarUrl;
  queries.push(
    { sql: profileSelect, result: [{ ...user, avatar: "/uploads/avatars/" + oldName }] },
    { sql: /UPDATE users SET avatar = \?/, result: { affectedRows: 1 }, check(sql, values) { avatarUrl = values[0]; assert.match(avatarUrl, /^\/uploads\/avatars\/tv5-contract-[a-f0-9-]+\.png$/); } },
    { sql: profileSelect, get result() { return [{ ...user, avatar: avatarUrl }]; } },
  );
  const form = new FormData(); form.append("avatar", new Blob([png], { type: "image/png" }), "../../untrusted.png");
  const response = await request("/api/users/profile", { method: "PUT", body: form });
  assert.equal(response.status, 200);
  assert.equal(response.data.user.avatar, avatarUrl);
  assert.deepEqual(await fs.readFile(path.join(avatarDirectory, path.basename(avatarUrl))), png);
  await assert.rejects(fs.access(path.join(avatarDirectory, oldName)), { code: "ENOENT" });
});
test("validation and database failures clean uploaded files", async () => {
  const beforeFiles = (await fs.readdir(avatarDirectory)).sort();
  const invalid = new FormData(); invalid.append("email", "forbidden@reuse.vn"); invalid.append("avatar", new Blob([png], { type: "image/png" }), "a.png");
  assert.equal((await request("/api/users/profile", { method: "PUT", body: invalid })).status, 400);
  assert.deepEqual((await fs.readdir(avatarDirectory)).sort(), beforeFiles);
  queries.push({ sql: profileSelect, result: [user] }, { sql: /UPDATE users SET avatar/, error: new Error("DB unavailable") });
  const form = new FormData(); form.append("avatar", new Blob([png], { type: "image/png" }), "a.png");
  assert.equal((await request("/api/users/profile", { method: "PUT", body: form })).status, 500);
  assert.deepEqual((await fs.readdir(avatarDirectory)).sort(), beforeFiles);
});
test("missing TV4 middleware returns a clear 501 instead of a private upload implementation", async () => {
  delete uploadExports.uploadAvatar;
  try { assert.equal((await request("/api/users/profile", { method: "PUT", body: { full_name: "An" } })).status, 501); }
  finally { uploadExports.uploadAvatar = uploadAvatar; }
});
test("my-products delegates page/limit/status unchanged to TV3", async () => {
  assert.equal((await request("/api/users/my-products")).status, 501);
  const productController = require("../server/controllers/productController");
  productController.getMyProducts = (req, res) => res.json({ success: true, data: [], pagination: { page: Number(req.query.page), limit: Number(req.query.limit), total: 0, total_pages: 0 } });
  const response = await request("/api/users/my-products?status=pending&page=2&limit=5");
  assert.equal(response.pagination.page, 2);
  assert.equal(response.pagination.limit, 5);
  delete productController.getMyProducts;
});
test("database failures propagate through Express", async () => {
  const error = new Error("DB unavailable");
  queries.push({ sql: /FROM wishlists/, error });
  assert.equal((await request("/api/wishlist")).status, 500);
  assert.equal(errors.at(-1), error);
});
