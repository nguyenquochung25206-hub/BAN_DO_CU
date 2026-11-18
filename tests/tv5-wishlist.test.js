/* TV5: client behavior tests in a minimal DOM harness, not a real browser. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require.resolve("../client/js/wishlist.js"), "utf8");

function setup(initialItems = []) {
  let currentToken = "account-2";
  let rows = initialItems.map((item) => ({ ...item }));
  let failNext = null;
  const calls = [];
  const documentListeners = {};
  const windowListeners = {};
  const events = [];
  const buttons = [];
  const notifications = [];
  const document = {
    getElementById() { return null; },
    querySelectorAll() { return buttons; },
    addEventListener(name, fn) { documentListeners[name] = fn; },
  };
  const window = {
    addEventListener(name, fn) { windowListeners[name] = fn; },
    dispatchEvent(event) { events.push(event); },
    alert(message) { notifications.push(message); },
  };
  const location = { href: "", origin: "http://localhost:3000" };
  const context = vm.createContext({
    document, window, location, URL, Intl, console,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    showToast(message, type) { notifications.push({ message, type }); },
    getToken() { return currentToken; },
    async apiFetch(url, options = {}) {
      calls.push({ url, method: options.method || "GET", body: options.body });
      if (failNext) { const err = failNext; failNext = null; throw err; }
      if (url === "/wishlist/ids" && !options.method) return { success: true, data: rows.map((item) => item.product_id) };
      if (options.method === "POST") {
        const item = { id: 99, product_id: options.body.product_id };
        rows.push(item);
        return { success: true }; // Hợp đồng POST không yêu cầu data trả về.
      }
      if (options.method === "DELETE") {
        rows = rows.filter((item) => item.product_id !== Number(url.split("/").pop()));
        return { success: true };
      }
      throw new Error("Unexpected endpoint");
    },
  });
  vm.runInContext(source, context);
  return {
    window, location, calls, events, notifications, documentListeners, windowListeners, document, context,
    token(value) { currentToken = value; },
    rows(value) { rows = value; },
    fail(error) { failNext = error; },
    button(id) {
      const classes = new Set();
      const attrs = {};
      const button = {
        dataset: { wishlistProductId: String(id) }, disabled: false,
        closest() { return null; },
        hasAttribute() { return false; },
        classList: { toggle(name, value) { value ? classes.add(name) : classes.delete(name); } },
        setAttribute(name, value) { attrs[name] = value; },
        classes, attrs,
      };
      buttons.push(button);
      return button;
    },
  };
}

test("isWishlisted batches product state into one list request", async () => {
  const s = setup([{ product_id: 7 }]);
  const states = await Promise.all([s.window.isWishlisted(7), s.window.isWishlisted(8), s.window.isWishlisted("7")]);
  assert.deepEqual(states, [true, false, true]);
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].url, "/wishlist/ids");
});

test("loadWishlistIds returns the agreed numeric ID array", async () => {
  const s = setup([{ product_id: 7 }, { product_id: 8 }]);
  assert.deepEqual(Array.from(await s.window.loadWishlistIds()), [7, 8]);
  assert.equal(s.calls.length, 1);
});

test("toggleWishlist(productId, buttonEl) updates a button without a data attribute", async () => {
  const s = setup();
  const button = s.button(123);
  button.dataset = {};
  assert.equal(await s.window.toggleWishlist(7, button), true);
  assert.equal(button.classes.has("active"), true);
  assert.equal(button.attrs["aria-pressed"], "true");
  assert.equal(button.disabled, false);
  assert.equal(s.notifications.at(-1).type, "success");
});

test("delegated clicks do not repeat an inline TV1 handler", async () => {
  const s = setup();
  const button = s.button(7);
  button.hasAttribute = (name) => name === "onclick";
  await s.window.toggleWishlist(7, button);
  s.documentListeners.click({ target: { closest() { return button; } }, preventDefault() {} });
  await new Promise(setImmediate);
  assert.equal(s.calls.filter((call) => call.method !== "GET").length, 1);
});

test("toggle removes using product ID and updates every matching heart", async () => {
  const s = setup([{ id: 99, product_id: 7 }]);
  const first = s.button(7);
  const second = s.button(7);
  await s.window.refreshWishlistButtons();
  assert.equal(first.attrs["aria-pressed"], "true");
  assert.equal(await s.window.toggleWishlist(7), false);
  assert.equal(s.calls.at(-1).url, "/wishlist/7");
  assert.equal(s.calls.at(-1).method, "DELETE");
  assert.equal(first.attrs["aria-pressed"], "false");
  assert.equal(second.attrs["aria-pressed"], "false");
  assert.equal(first.disabled, false);
  assert.equal(s.events[0].type, "wishlist:change");
  assert.equal(s.events[0].detail.wishlisted, false);
});

test("double clicking one product sends only one mutation", async () => {
  const s = setup();
  const button = s.button(7);
  const first = s.window.toggleWishlist(7);
  const second = s.window.toggleWishlist(7);
  assert.equal(first, second);
  assert.equal(button.disabled, true);
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(s.calls.filter((call) => call.method === "POST").length, 1);
  assert.equal(button.disabled, false);
  assert.equal(button.classes.has("active"), true);
});

test("newly rendered cards can refresh hearts from the shared cache", async () => {
  const s = setup([{ product_id: 7 }]);
  await s.window.isWishlisted(7);
  const button = s.button(7);
  await s.window.refreshWishlistButtons();
  assert.equal(button.attrs["aria-pressed"], "true");
  assert.equal(s.calls.length, 1);
});

test("anonymous toggle redirects to login without calling API", async () => {
  const s = setup();
  s.token(null);
  assert.equal(await s.window.toggleWishlist(7), false);
  assert.equal(s.location.href, "/pages/login.html");
  assert.equal(s.calls.length, 0);
  assert.equal(await s.window.isWishlisted(7), false);
});

test("account switch clears cached wishlist", async () => {
  const s = setup([{ product_id: 7 }]);
  assert.equal(await s.window.isWishlisted(7), true);
  s.token("account-3");
  s.rows([{ product_id: 8 }]);
  assert.equal(await s.window.isWishlisted(7), false);
  assert.equal(await s.window.isWishlisted(8), true);
  assert.equal(s.calls.length, 2);
});

test("failed mutation restores button and refreshes server state", async () => {
  const s = setup([{ product_id: 7 }]);
  const button = s.button(7);
  await s.window.refreshWishlistButtons();
  s.fail(new Error("Network failed"));
  await assert.rejects(s.window.toggleWishlist(7), /Network failed/);
  assert.equal(button.disabled, false);
  assert.equal(button.attrs["aria-pressed"], "true");
  assert.equal(s.calls.at(-1).method, "GET");
});

test("client rejects invalid IDs without API calls", async () => {
  const s = setup();
  for (const id of [0, -1, [7], true, "7 OR 1=1", "9007199254740993"]) {
    await assert.rejects(s.window.toggleWishlist(id), /ID sản phẩm/);
    await assert.rejects(s.window.isWishlisted(id), /ID sản phẩm/);
  }
  assert.equal(s.calls.length, 0);
});

function pageSetup(withRenderer) {
  const s = setup([{ product_id: 7 }]);
  const nodes = {};
  for (const id of ["wishlist-page", "wishlist-state", "wishlist-retry", "wishlist-count", "wishlist-empty", "wishlist-grid", "wishlist-feedback"]) {
    nodes[id] = { hidden: false, textContent: "", dataset: {}, attrs: {}, children: [],
      setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {},
      replaceChildren() { this.children = []; }, append(child) { this.children.push(child); },
    };
  }
  s.document.getElementById = (id) => nodes[id] || null;
  s.document.createElement = () => ({ dataset: {}, querySelectorAll() { return []; } });
  const originalFetch = s.context.apiFetch;
  const product = { id: 7, name: "Vợt", price: 400000, condition: "good", location: "Hà Nội", status: "approved", created_at: "2026-11-01T00:00:00.000Z", category_id: 7, category_name: "Thể thao", thumbnail: null, seller_name: "An" };
  s.context.apiFetch = async (url, options) => url === "/wishlist" && !options
    ? { success: true, data: [{ wishlist_id: 99, created_at: "2026-11-10T00:00:00.000Z", product }] }
    : originalFetch(url, options);
  const rendered = [];
  if (withRenderer) s.context.renderProductCard = (value) => { rendered.push(value); return "<article>TV1 shared card</article>"; };
  return { ...s, nodes, product, rendered };
}

test("wishlist page passes nested ProductCard to TV1 renderer without building a separate card", async () => {
  const s = pageSetup(true);
  s.documentListeners.DOMContentLoaded();
  await new Promise(setImmediate);
  assert.equal(s.rendered[0], s.product);
  assert.equal(s.nodes["wishlist-grid"].children[0].innerHTML, "<article>TV1 shared card</article>");
  assert.equal(s.nodes["wishlist-count"].textContent, "1 sản phẩm");
  assert.equal(s.nodes["wishlist-state"].hidden, true);
});

test("wishlist page explains missing TV1 renderer and offers retry", async () => {
  const s = pageSetup(false);
  s.documentListeners.DOMContentLoaded();
  await new Promise(setImmediate);
  assert.match(s.nodes["wishlist-state"].textContent, /TV1.*renderProductCard/);
  assert.equal(s.nodes["wishlist-retry"].hidden, false);
  assert.equal(s.nodes["wishlist-grid"].attrs["aria-busy"], "false");
});
