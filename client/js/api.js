/*
 * FILE   : client/js/api.js
 * CHỦ FILE: TV6 – Backend/Database/Admin & Tích hợp
 * BRANCH : feature/tv6-admin
 * NHIỆM VỤ: Hàm gọi API dùng chung (file chung, TV6 quản lý)
 * TODO:
 *   [ ] apiFetch(path, options) tự gắn token
 *   [ ] Xử lý 401 -> chuyển về login
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

const API_BASE = "/api";

function getToken() { return localStorage.getItem("token"); }

async function apiFetch(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  const isForm = options.body instanceof FormData;
  if (!isForm && options.body && typeof options.body !== "string") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(API_BASE + path, { ...options, headers });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (!location.pathname.endsWith("login.html")) location.href = "/pages/login.html";
  }
  if (!res.ok) throw new Error(data.message || "Có lỗi xảy ra");
  return data;
}
