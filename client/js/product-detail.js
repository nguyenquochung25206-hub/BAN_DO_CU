/*
 * FILE   : client/js/product-detail.js
 * CHỦ FILE: TV3 – Product (Danh sách/Tìm kiếm/Chi tiết sản phẩm)
 * BRANCH : feature/tv3-products
 * NHIỆM VỤ: Đọc ?id= từ URL, gọi GET /api/products/:id, hiển thị chi tiết + thư viện ảnh +
 *           người bán + nút liên hệ/yêu thích + sản phẩm cùng danh mục
 *
 * PHỤ THUỘC (theo Biên bản tuần 1):
 *   api.js      (TV6) apiFetch(path, options)
 *   main.js     (TV1) formatPrice, showToast, renderProductCard, CONDITION_LABELS  <- thiếu thì dùng bản dự phòng
 *   wishlist.js (TV5) loadWishlistIds, toggleWishlist                               <- thiếu thì ẩn tính năng tim
 *   localStorage: khóa "token" và "user" (đọc trực tiếp, không cần auth.js)
 *
 * Toàn bộ code nằm trong IIFE để không đụng tên biến toàn cục của file khác.
 * Dữ liệu từ server (tên, mô tả, tên người bán...) luôn được escape trước khi chèn vào HTML.
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

(function () {
  "use strict";

  var root = document.getElementById("detail-root");
  var COND_FALLBACK = { new: "Mới 100%", like_new: "Như mới (~99%)", good: "Tốt (~90%)", fair: "Khá (~70%)" };
  var STATUS_BADGE = { pending: "Chờ duyệt", rejected: "Bị từ chối", sold: "Đã bán" };
  var loadSeq = 0; // chống kết quả cũ ghi đè khi bấm "Thử lại"

  // ------------------------------------------------------------------ Tiện ích
  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /** Chỉ cho phép đường dẫn ảnh nội bộ (/uploads/...) hoặc http(s); mọi thứ khác (javascript:, data:...) bị loại. */
  function safeUrl(url) {
    if (typeof url !== "string") return "";
    return /^\/uploads\/[^\s"'<>]+$/.test(url) || /^https?:\/\/[^\s"'<>]+$/i.test(url) ? url : "";
  }

  function getToken() {
    try { return localStorage.getItem("token"); } catch (e) { return null; }
  }

  function currentUser() {
    try {
      var raw = localStorage.getItem("user");
      var user = raw ? JSON.parse(raw) : null;
      return user && typeof user === "object" ? user : null;
    } catch (e) { return null; }
  }

  function toast(message, type) {
    if (typeof showToast === "function") showToast(message, type);
    else console.warn("[product-detail.js]", message);
  }

  function money(n) {
    if (typeof formatPrice === "function") return formatPrice(n);
    return Number(n).toLocaleString("vi-VN") + " ₫";
  }

  function condLabel(code) {
    var map = typeof CONDITION_LABELS !== "undefined" && CONDITION_LABELS ? CONDITION_LABELS : null;
    return (map && map[code]) || COND_FALLBACK[code] || code || "";
  }

  /** Giờ Việt Nam theo Biên bản tuần 1. Ngày lỗi -> chuỗi rỗng. */
  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try {
      return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium", timeStyle: "short" }).format(d);
    } catch (e) {
      return d.toLocaleString("vi-VN");
    }
  }

  function parseId() {
    var raw = new URLSearchParams(location.search).get("id") || "";
    return /^\d{1,10}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
  }

  // ------------------------------------------------------------------ Trạng thái trang
  function showLoading() {
    root.innerHTML = '<p class="detail-loading">Đang tải sản phẩm...</p>';
  }

  function showError(title, message, canRetry) {
    root.innerHTML =
      '<div class="detail-error empty-state">' +
      "<h1>" + esc(title) + "</h1><p>" + esc(message) + "</p>" +
      '<div class="detail-error__actions">' +
      (canRetry ? '<button type="button" class="btn btn-primary" data-action="retry">Thử lại</button>' : "") +
      '<a class="btn btn-outline" href="products.html">← Xem danh sách sản phẩm</a>' +
      "</div></div>";
    var retry = root.querySelector('[data-action="retry"]');
    if (retry) retry.addEventListener("click", load);
    document.title = title + " | REUSE";
  }

  // ------------------------------------------------------------------ Dựng HTML
  function galleryHtml(p, images) {
    var html = '<div class="gallery" tabindex="0" aria-label="Thư viện ảnh sản phẩm">' +
      '<div class="gallery__stage">';
    html += '<img id="gallery-main" class="gallery__main" alt="' + esc(p.name) + '"' +
      (images.length ? ' src="' + esc(images[0]) + '"' : " hidden") + ">";
    html += '<div id="gallery-placeholder" class="gallery__placeholder"' + (images.length ? " hidden" : "") + ">Chưa có ảnh</div>";
    if (p.status === "sold") html += '<span class="gallery__sold">ĐÃ BÁN</span>';
    if (images.length > 1) {
      html += '<button type="button" class="gallery__nav gallery__nav--prev" aria-label="Ảnh trước">‹</button>' +
        '<button type="button" class="gallery__nav gallery__nav--next" aria-label="Ảnh sau">›</button>' +
        '<span id="gallery-counter" class="gallery__counter"></span>';
    }
    html += "</div>";
    if (images.length > 1) {
      html += '<div class="gallery__thumbs">';
      for (var i = 0; i < images.length; i++) {
        html += '<button type="button" class="gallery__thumb" data-index="' + i + '" aria-label="Xem ảnh ' + (i + 1) + '">' +
          '<img src="' + esc(images[i]) + '" alt=""></button>';
      }
      html += "</div>";
    }
    return html + "</div>";
  }

  function noticeHtml(p, isOwner) {
    var text = "";
    if (p.status === "pending") {
      text = isOwner
        ? "Tin của bạn đang chờ quản trị viên duyệt. Hiện chỉ bạn và quản trị viên xem được tin này."
        : "Tin này đang chờ duyệt (chỉ quản trị viên xem được).";
    } else if (p.status === "rejected") {
      text = isOwner
        ? "Tin của bạn đã bị từ chối. Hãy chỉnh sửa nội dung rồi gửi lại để được duyệt."
        : "Tin này đã bị từ chối.";
    } else if (p.status === "sold") {
      text = "Sản phẩm này đã được bán.";
    }
    return text ? '<p class="detail__notice detail__notice--' + esc(p.status) + '">' + esc(text) + "</p>" : "";
  }

  function actionsHtml(p, isOwner) {
    var seller = p.seller || {};
    if (isOwner) {
      return '<div class="detail__actions">' +
        '<p class="detail__owner">Đây là tin đăng của bạn.</p>' +
        (p.status !== "sold"
          ? '<a class="btn btn-primary" href="sell.html?edit=' + encodeURIComponent(p.id) + '">Sửa tin</a>'
          : "") +
        '<a class="btn btn-outline" href="my-products.html">Quản lý tin đăng</a></div>';
    }
    if (p.status !== "approved") return ""; // sold / pending / rejected: không liên hệ, không yêu thích

    var tel = String(seller.phone || "").replace(/[^\d+]/g, "");
    var contact = tel
      ? '<a class="btn btn-primary detail__call" href="tel:' + esc(tel) + '">Gọi người bán: ' + esc(seller.phone) + "</a>"
      : '<p class="detail__nophone">Người bán chưa cung cấp số điện thoại.</p>';
    var canWish = typeof toggleWishlist === "function";
    return '<div class="detail__actions">' + contact +
      (canWish ? '<button type="button" id="detail-wishlist" class="btn btn-outline btn-wishlist" aria-pressed="false"></button>' : "") +
      "</div>";
  }

  function sellerHtml(seller) {
    var name = seller.full_name || "Người bán";
    var avatar = safeUrl(seller.avatar);
    var initial = esc(name.trim().charAt(0).toUpperCase() || "?");
    return '<section class="detail__seller" aria-label="Người bán">' +
      '<div class="seller__avatar">' +
      (avatar ? '<img src="' + esc(avatar) + '" alt="">' : "<span>" + initial + "</span>") + "</div>" +
      '<div class="seller__info"><p class="seller__label">Người bán</p>' +
      '<p class="seller__name">' + esc(name) + "</p>" +
      (seller.phone ? '<p class="seller__phone">' + esc(seller.phone) + "</p>" : "") + "</div></section>";
  }

  function render(p) {
    var user = currentUser();
    var seller = p.seller || {};
    var isOwner = !!user && Number(user.id) === Number(seller.id);
    var images = (Array.isArray(p.images) ? p.images : [])
      .map(function (img) { return safeUrl(img && img.image_url); })
      .filter(Boolean);

    var badge = STATUS_BADGE[p.status]
      ? '<span class="badge badge-' + esc(p.status) + '">' + esc(STATUS_BADGE[p.status]) + "</span>"
      : "";
    var date = formatDate(p.created_at);

    root.innerHTML =
      '<nav class="breadcrumb" aria-label="Đường dẫn">' +
        '<a href="../index.html">Trang chủ</a><span aria-hidden="true">›</span>' +
        '<a href="products.html">Sản phẩm</a><span aria-hidden="true">›</span>' +
        '<a href="products.html?category_id=' + encodeURIComponent(p.category_id) + '">' + esc(p.category_name) + "</a>" +
        '<span aria-hidden="true">›</span><span class="breadcrumb__current">' + esc(p.name) + "</span></nav>" +
      '<article class="detail">' +
        galleryHtml(p, images) +
        '<div class="detail__info">' +
          (badge ? '<div class="detail__badges">' + badge + "</div>" : "") +
          '<h1 class="detail__title">' + esc(p.name) + "</h1>" +
          '<p class="detail__price">' + esc(money(p.price)) + "</p>" +
          noticeHtml(p, isOwner) +
          '<dl class="detail__meta">' +
            "<div><dt>Tình trạng</dt><dd>" + esc(condLabel(p.condition)) + "</dd></div>" +
            "<div><dt>Khu vực</dt><dd>" + esc(p.location || "Chưa cập nhật") + "</dd></div>" +
            "<div><dt>Danh mục</dt><dd>" + esc(p.category_name) + "</dd></div>" +
            (date ? "<div><dt>Đăng lúc</dt><dd>" + esc(date) + "</dd></div>" : "") +
          "</dl>" +
          actionsHtml(p, isOwner) +
          sellerHtml(seller) +
        "</div>" +
        '<section class="detail__desc"><h2>Mô tả sản phẩm</h2>' +
          '<div class="detail__desc-text">' + (p.description ? esc(p.description) : "Người bán chưa nhập mô tả.") + "</div>" +
        "</section>" +
      "</article>";

    document.title = p.name + " | REUSE";
    setupGallery(images);
    setupWishlist(p);
  }

  // ------------------------------------------------------------------ Thư viện ảnh
  function setupGallery(images) {
    if (!images.length) return;
    var box = root.querySelector(".gallery");
    var main = document.getElementById("gallery-main");
    var placeholder = document.getElementById("gallery-placeholder");
    var counter = document.getElementById("gallery-counter");
    var thumbs = root.querySelectorAll(".gallery__thumb");
    var index = 0;

    function show(i) {
      index = (i + images.length) % images.length;
      main.hidden = false;
      placeholder.hidden = true;
      main.src = images[index];
      if (counter) counter.textContent = index + 1 + " / " + images.length;
      for (var k = 0; k < thumbs.length; k++) {
        var on = k === index;
        thumbs[k].classList.toggle("is-active", on);
        if (on) thumbs[k].setAttribute("aria-current", "true");
        else thumbs[k].removeAttribute("aria-current");
      }
    }

    // Ảnh lỗi 404: sự kiện error không nổi bọt nên bắt ở pha capture
    box.addEventListener("error", function (e) {
      var target = e.target;
      if (!target || target.tagName !== "IMG") return;
      if (target === main) {
        main.hidden = true;
        placeholder.textContent = "Không tải được ảnh";
        placeholder.hidden = false;
      } else {
        target.classList.add("is-broken");
      }
    }, true);

    var prev = root.querySelector(".gallery__nav--prev");
    var next = root.querySelector(".gallery__nav--next");
    if (prev) prev.addEventListener("click", function () { show(index - 1); });
    if (next) next.addEventListener("click", function () { show(index + 1); });
    for (var t = 0; t < thumbs.length; t++) {
      thumbs[t].addEventListener("click", function () { show(Number(this.getAttribute("data-index"))); });
    }
    box.addEventListener("keydown", function (e) {
      if (images.length < 2) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
    });
    show(0);
  }

  // ------------------------------------------------------------------ Yêu thích
  function setWishState(btn, on) {
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.innerHTML = '<span class="wish__heart" aria-hidden="true">' + (on ? "♥" : "♡") + "</span> " + (on ? "Đã yêu thích" : "Yêu thích");
  }

  function setupWishlist(p) {
    var btn = document.getElementById("detail-wishlist");
    if (!btn) return;
    setWishState(btn, false);

    btn.addEventListener("click", function () {
      if (!getToken()) {
        toast("Vui lòng đăng nhập để lưu sản phẩm yêu thích", "error");
        location.href = "login.html";
        return;
      }
      var result;
      try {
        result = toggleWishlist(p.id, btn); // TV5: tự gọi API và đổi class .active của nút
      } catch (err) {
        console.error("[product-detail.js] toggleWishlist lỗi", err);
        return;
      }
      Promise.resolve(result).then(
        function () { setWishState(btn, btn.classList.contains("active")); },
        function (err) { console.error("[product-detail.js] toggleWishlist lỗi", err); }
      );
    });

    // Trạng thái ban đầu: hỏi TV5 xem sản phẩm này đã được tim chưa
    if (!getToken()) return;
    (async function () {
      try {
        var ids = typeof loadWishlistIds === "function" ? await loadWishlistIds() : null;
        var on = false;
        if (typeof isWishlisted === "function") on = !!isWishlisted(p.id);
        else if (Array.isArray(ids)) on = ids.map(Number).indexOf(p.id) !== -1;
        else if (ids && typeof ids.has === "function") on = ids.has(p.id) || ids.has(String(p.id));
        if (btn.isConnected) setWishState(btn, on);
      } catch (err) { /* tim là tính năng phụ */ }
    })();
  }

  // ------------------------------------------------------------------ Sản phẩm cùng danh mục
  async function loadRelated(p, seq) {
    if (typeof renderProductCard !== "function") return;
    try {
      var res = await apiFetch("/products?category_id=" + encodeURIComponent(p.category_id) + "&limit=5");
      if (seq !== loadSeq) return;
      var items = (Array.isArray(res.data) ? res.data : []).filter(function (x) { return x.id !== p.id; }).slice(0, 4);
      if (!items.length) return;
      var cards = "";
      for (var i = 0; i < items.length; i++) {
        try { cards += renderProductCard(items[i]); } catch (e) { console.error("[product-detail.js] renderProductCard lỗi", e); }
      }
      if (!cards) return;
      var section = document.createElement("section");
      section.className = "detail__related";
      section.innerHTML = '<h2>Sản phẩm cùng danh mục</h2><div class="grid grid-4">' + cards + "</div>";
      root.appendChild(section);
    } catch (err) {
      console.error("[product-detail.js] không tải được sản phẩm liên quan", err); // không làm hỏng trang chính
    }
  }

  // ------------------------------------------------------------------ Tải dữ liệu
  async function load() {
    var seq = ++loadSeq;
    var id = parseId();
    if (!id) {
      showError("Không tìm thấy sản phẩm", "Đường dẫn không hợp lệ: thiếu hoặc sai mã sản phẩm.", false);
      return;
    }
    showLoading();
    try {
      var res = await apiFetch("/products/" + id);
      if (seq !== loadSeq) return;
      if (!res || !res.data) throw new Error("Dữ liệu sản phẩm không hợp lệ");
      render(res.data);
      loadRelated(res.data, seq);
    } catch (err) {
      if (seq !== loadSeq) return;
      if (err instanceof TypeError) {
        showError("Không kết nối được máy chủ", "Vui lòng kiểm tra mạng và thử lại.", true);
      } else {
        // apiFetch chỉ cho biết thông báo của server (VD "Không tìm thấy sản phẩm"), không có mã HTTP
        showError("Không thể xem sản phẩm này", (err && err.message) || "Sản phẩm không tồn tại hoặc đã bị gỡ.", true);
      }
    }
  }

  load();
})();
