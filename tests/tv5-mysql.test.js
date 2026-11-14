/* TV5: opt-in test SQL thật, dùng database tạm riêng; không import/drop database của nhóm. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const enabled = process.env.TV5_TEST_MYSQL === "1";
test("TV5 SQL runs against the existing schema and seed in an isolated MySQL database",
  { skip: !enabled }, async () => {
  require("dotenv").config();
  const mysql = require("mysql2/promise");
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost", port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "",
    multipleStatements: true, timezone: "+07:00",
  });
  const databaseName = "tmp_reuse_tv5_" + Date.now() + "_" + randomBytes(4).toString("hex");
  assert.match(databaseName, /^tmp_reuse_tv5_\d+_[a-f0-9]+$/);
  let created = false;
  try {
    await connection.query("CREATE DATABASE `" + databaseName + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    created = true;
    await connection.changeUser({ database: databaseName });
    const [[selected]] = await connection.query("SELECT DATABASE() AS name");
    assert.equal(selected.name, databaseName);
    const schema = (await fs.readFile(path.join(__dirname, "../database/schema.sql"), "utf8"))
      .replace(/^CREATE DATABASE IF NOT EXISTS reuse_marketplace[^;]*;/m, "")
      .replace(/^USE reuse_marketplace;/m, "");
    const seed = (await fs.readFile(path.join(__dirname, "../database/seed.sql"), "utf8"))
      .replace(/^USE reuse_marketplace;/m, "");
    assert.doesNotMatch(schema + seed, /(?:CREATE DATABASE|USE\s+reuse_marketplace|DROP DATABASE)/i);
    await connection.query(schema);
    await connection.query(seed);
    const [[counts]] = await connection.query("SELECT (SELECT COUNT(*) FROM users) users, (SELECT COUNT(*) FROM categories) categories, (SELECT COUNT(*) FROM products) products");
    assert.deepEqual({ ...counts }, { users: 4, categories: 7, products: 7 });

    // Chỉ nối module TV5 vào DB tạm trong tiến trình test này.
    const databasePath = require.resolve("../server/config/database");
    require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: connection };
    const Wishlist = require("../server/models/Wishlist");
    const userController = require("../server/controllers/userController");
    const [insert] = await connection.query("INSERT INTO products (user_id, category_id, name, price, `condition`, location, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [2, 1, "TV5 contract product", 123456.78, "good", "Hà Nội", "approved"]);
    const productId = insert.insertId;
    await connection.query("INSERT INTO product_images (product_id, image_url) VALUES (?, ?), (?, ?)",
      [productId, "/uploads/products/first.jpg", productId, "/uploads/products/second.jpg"]);
    assert.equal((await Wishlist.add(2, productId)).affectedRows, 1);
    await assert.rejects(Wishlist.add(2, productId), { code: "ER_DUP_ENTRY" });
    const [item] = await Wishlist.findByUser(2);
    assert.equal(item.product.id, productId);
    assert.equal(item.product.price, 123456.78);
    assert.equal(item.product.condition, "good");
    assert.equal(item.product.thumbnail, "/uploads/products/first.jpg");
    assert.equal(item.product.seller_name, "Nguyễn Văn An");
    assert.match(item.created_at, /Z$/);
    assert.match(item.product.created_at, /Z$/);
    assert.deepEqual(await Wishlist.findIdsByUser(2), [productId]);
    assert.equal(await Wishlist.remove(3, productId), false);
    assert.equal(await Wishlist.exists(2, productId), true);
    await connection.query("UPDATE products SET status = 'pending' WHERE id = ?", [productId]);
    assert.deepEqual(await Wishlist.findByUser(2), []);
    assert.deepEqual(await Wishlist.findIdsByUser(2), [productId]);
    assert.equal((await Wishlist.add(3, productId)).affectedRows, 0);
    await connection.query("UPDATE products SET status = 'sold' WHERE id = ?", [productId]);
    assert.equal((await Wishlist.findByUser(2))[0].product.status, "sold");
    assert.equal(await Wishlist.remove(2, productId), true);

    async function call(handler, body) {
      let code = 200;
      let payload;
      await handler({ user: { id: 2 }, body }, {
        status(value) { code = value; return this; },
        json(value) { payload = value; },
      }, (err) => { throw err; });
      return { code, payload };
    }
    const before = await call(userController.getProfile);
    assert.equal(before.payload.data.user.email, "an@reuse.vn");
    assert.equal(before.payload.data.user.password, undefined);
    const changed = await call(userController.updateProfile, { full_name: "Tên kiểm thử TV5", phone: "0987654321" });
    assert.equal(changed.code, 200);
    assert.equal(changed.payload.data.user.full_name, "Tên kiểm thử TV5");
    assert.equal(changed.payload.data.user.email, "an@reuse.vn");
    assert.equal((await call(userController.updateProfile, { email: "forbidden@reuse.vn" })).code, 400);
    assert.equal((await call(userController.getProfile)).payload.data.user.email, "an@reuse.vn");
  } finally {
    if (created) {
      assert.match(databaseName, /^tmp_reuse_tv5_\d+_[a-f0-9]+$/);
      await connection.query("DROP DATABASE `" + databaseName + "`");
    }
    await connection.end();
  }
});
