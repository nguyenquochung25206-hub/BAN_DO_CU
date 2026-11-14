/* TV5: kiểm tra client gửi đúng full_name/phone/avatar và đọc data.user. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require.resolve("../client/js/profile.js"), "utf8");
const html = fs.readFileSync(require.resolve("../client/pages/profile.html"), "utf8");
function node() {
  return { value: "", hidden: false, disabled: false, textContent: "", dataset: {}, listeners: {},
    addEventListener(name, fn) { this.listeners[name] = fn; },
    setAttribute() {}, removeAttribute() {}, focus() {},
  };
}
function setup() {
  const nodes = {};
  for (const id of ["profile-form", "profile-fields", "avatar", "profile-avatar", "profile-initial", "avatar-filename", "profile-state", "profile-retry", "profile-save", "profile-feedback", "profile-joined", "profile-reset"]) nodes[id] = node();
  const inputs = { full_name: node(), email: node(), phone: node(), avatar: nodes.avatar };
  nodes.avatar.files = [];
  nodes["profile-form"].elements = { namedItem(name) { return inputs[name]; } };
  nodes["profile-form"].reportValidity = () => true;
  const calls = [];
  const events = [];
  const storage = new Map([["token", "test-token"]]);
  const document = {
    listeners: {},
    getElementById(id) { return nodes[id]; },
    addEventListener(name, fn) { this.listeners[name] = fn; },
  };
  const user = { id: 2, full_name: "Nguyễn Văn An", email: "an@reuse.vn", phone: "0911111111", avatar: null, role: "user", status: "active", created_at: "2026-11-01T00:00:00.000Z" };
  let profile = { ...user };
  const window = { addEventListener() {}, dispatchEvent(event) { events.push(event); } };
  vm.runInNewContext(source, {
    document, window, FormData, URL, Intl, Date,
    location: { href: "", origin: "http://localhost:3000" },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    getToken() { return storage.get("token"); },
    localStorage: { setItem(k, v) { storage.set(k, v); } },
    async apiFetch(url, options = {}) {
      calls.push({ url, ...options });
      if (options.method === "PUT") {
        profile = { ...profile, full_name: options.body.get("full_name"), phone: options.body.get("phone") || null };
      }
      return { success: true, data: { user: { ...profile } } };
    },
  });
  document.listeners.DOMContentLoaded();
  return { nodes, inputs, calls, storage, events, user };
}
test("profile HTML makes email read-only and uses shared form classes", () => {
  assert.match(html, /<input[^>]*id="email"[^>]*readonly/);
  assert.match(html, /class="form-input" id="full_name"/);
  assert.match(html, /class="form-input" id="phone"/);
});
test("profile reads data.user and displays saved fields", async () => {
  const s = setup();
  await new Promise(setImmediate);
  assert.equal(s.inputs.full_name.value, s.user.full_name);
  assert.equal(s.inputs.email.value, s.user.email);
  assert.equal(s.nodes["profile-form"].hidden, false);
  assert.equal(s.nodes["profile-state"].hidden, true);
});
test("profile PUT omits email and forbidden fields, then synchronizes public User", async () => {
  const s = setup();
  await new Promise(setImmediate);
  s.inputs.full_name.value = " An Mới ";
  s.inputs.phone.value = "0987654321";
  s.inputs.email.value = "tampered@reuse.vn";
  await s.nodes["profile-form"].listeners.submit({ preventDefault() {} });
  const request = s.calls.find((call) => call.method === "PUT");
  assert.equal(request.url, "/users/profile");
  assert.deepEqual(Array.from(request.body.keys()).sort(), ["full_name", "phone"]);
  assert.equal(request.body.get("full_name"), "An Mới");
  const saved = JSON.parse(s.storage.get("user"));
  assert.equal(saved.full_name, "An Mới");
  assert.equal(saved.email, "an@reuse.vn");
  assert.equal(saved.password, undefined);
  assert.equal(s.events[0].type, "profile:updated");
  assert.equal(s.nodes["profile-fields"].disabled, false);
});
test("reset restores the persisted profile without sending PUT", async () => {
  const s = setup();
  await new Promise(setImmediate);
  s.inputs.full_name.value = "Chưa lưu";
  s.nodes["profile-reset"].listeners.click();
  assert.equal(s.inputs.full_name.value, s.user.full_name);
  assert.equal(s.calls.filter((call) => call.method === "PUT").length, 0);
});
