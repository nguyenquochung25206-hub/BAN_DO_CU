/*
 * FILE   : client/js/profile.js
 * CHỦ FILE: TV5 – User Interaction (Yêu thích & Hồ sơ)
 * BRANCH : feature/tv5-user
 * NHIỆM VỤ: Xử lý hồ sơ
 * IMPLEMENTED:
 *   [x] GET/PUT /api/users/profile
 *   [x] Upload avatar
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

(() => {
  "use strict";
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("profile-form");
    if (!form) return;
    if (!getToken()) {
      if (typeof requireLogin === "function") requireLogin();
      else location.href = "/pages/login.html";
      return;
    }
    const ownerToken = getToken();
    const fields = document.getElementById("profile-fields");
    const avatar = document.getElementById("avatar");
    const image = document.getElementById("profile-avatar");
    const initial = document.getElementById("profile-initial");
    const filename = document.getElementById("avatar-filename");
    const state = document.getElementById("profile-state");
    const retry = document.getElementById("profile-retry");
    const save = document.getElementById("profile-save");
    let profile = null;
    let previewUrl = null;

    function feedback(message, error = false) {
      const notice = document.getElementById("profile-feedback");
      notice.textContent = message;
      notice.dataset.error = String(error);
    }

    function releasePreview() {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }

    function showAvatar(url) {
      image.hidden = true;
      initial.hidden = false;
      initial.textContent = (profile && profile.full_name ? profile.full_name.trim().charAt(0) : "R").toUpperCase();
      image.removeAttribute("src");
      if (!url) return;
      try {
        const parsed = new URL(url, location.origin);
        if (url !== previewUrl && parsed.protocol !== "https:"
          && !(parsed.origin === location.origin && parsed.pathname.startsWith("/uploads/"))) return;
      } catch (_) { return; }
      image.onload = () => { image.hidden = false; initial.hidden = true; };
      image.onerror = () => { image.hidden = true; initial.hidden = false; };
      image.src = url;
    }

    function fillForm() {
      releasePreview();
      for (const key of ["full_name", "email", "phone"]) form.elements.namedItem(key).value = profile[key] || "";
      avatar.value = "";
      filename.textContent = "Chưa chọn ảnh mới";
      showAvatar(profile.avatar);
      const joined = new Date(profile.created_at);
      document.getElementById("profile-joined").textContent = Number.isNaN(joined.getTime()) ? ""
        : `Tham gia REUSE từ ${new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(joined)}`;
    }

    async function loadProfile() {
      state.hidden = false;
      state.textContent = "Đang tải hồ sơ…";
      retry.hidden = true;
      try {
        const response = await apiFetch("/users/profile");
        if (getToken() !== ownerToken) return;
        profile = response.data.user;
        fillForm();
        form.hidden = false;
        state.hidden = true;
      } catch (err) {
        state.textContent = err.message;
        retry.hidden = false;
      }
    }

    avatar.addEventListener("change", () => {
      releasePreview();
      const file = avatar.files[0];
      if (!file) { filename.textContent = "Chưa chọn ảnh mới"; showAvatar(profile.avatar); return; }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
        avatar.value = "";
        filename.textContent = "Chưa chọn ảnh mới";
        showAvatar(profile.avatar);
        feedback("Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB.", true);
        return;
      }
      filename.textContent = file.name;
      previewUrl = URL.createObjectURL(file);
      showAvatar(previewUrl);
      feedback("Ảnh mới sẽ được cập nhật khi bạn lưu thay đổi.");
    });

    document.getElementById("profile-reset").addEventListener("click", () => {
      fillForm();
      feedback("Đã hủy các thay đổi chưa lưu.");
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (fields.disabled) return;
      const fullName = form.elements.namedItem("full_name");
      fullName.value = fullName.value.trim();
      if (!form.reportValidity()) return;
      const phone = form.elements.namedItem("phone").value.trim();
      if (phone && (!/^\+?[\d\s().-]{6,20}$/.test(phone) || phone.replace(/\D/g, "").length < 6)) {
        feedback("Số điện thoại không hợp lệ.", true);
        form.elements.namedItem("phone").focus();
        return;
      }
      const data = new FormData();
      data.append("full_name", fullName.value);
      data.append("phone", phone);
      if (avatar.files[0]) data.append("avatar", avatar.files[0]);
      fields.disabled = true;
      form.setAttribute("aria-busy", "true");
      save.textContent = "Đang lưu…";
      try {
        const response = await apiFetch("/users/profile", { method: "PUT", body: data });
        if (getToken() !== ownerToken) return;
        profile = response.data.user;
        fillForm();
        // Chỉ đồng bộ các trường công khai cho header của TV1.
        const user = {};
        for (const key of ["id", "full_name", "email", "phone", "avatar", "role", "status", "created_at"]) user[key] = profile[key];
        try { localStorage.setItem("user", JSON.stringify(user)); } catch (_) { /* Hồ sơ vẫn đã lưu trên server. */ }
        window.dispatchEvent(new CustomEvent("profile:updated", { detail: user }));
        feedback("Đã lưu hồ sơ của bạn.");
      } catch (err) { feedback(err.message, true); }
      finally {
        fields.disabled = false;
        form.setAttribute("aria-busy", "false");
        save.textContent = "Lưu thay đổi";
      }
    });
    retry.addEventListener("click", loadProfile);
    window.addEventListener("beforeunload", releasePreview);
    window.addEventListener("storage", (event) => {
      if ((event.key === "token" || event.key === null) && getToken() !== ownerToken) {
        releasePreview();
        location.href = getToken() ? "/pages/profile.html" : "/pages/login.html";
      }
    });
    loadProfile();
  });
})();
