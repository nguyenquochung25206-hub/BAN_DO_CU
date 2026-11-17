/*
 * FILE   : client/js/products.js
 * CHỦ FILE: TV3 – Product (Danh sách/Tìm kiếm/Chi tiết sản phẩm)
 * BRANCH : feature/tv3-products
 * NHIỆM VỤ: Đọc tham số URL, gọi GET /api/products với bộ lọc, hiển thị danh sách + phân trang
 *
 * PHỤ THUỘC (theo Biên bản tuần 1):
 *   api.js      (TV6) apiFetch(path, options)
 *   main.js     (TV1) renderProductCard(product)  <- BẮT BUỘC, không tự vẽ thẻ riêng
 *   wishlist.js (TV5) loadWishlistIds()           <- tùy chọn, thiếu thì bỏ qua
 *
 * Toàn bộ code nằm trong IIFE để không đụng tên biến toàn cục của file khác.
 * LƯU Ý  : Chỉ chủ file được sửa. Cần đổi -> báo nhóm trước (xem docs/task-assignment.md).
 */

(function () {
  "use strict";

  var PAGE_LIMIT = 12;
  var CONDITIONS = ["new", "like_new", "good", "fair"];
  var SORTS = ["newest", "price_asc", "price_desc"];
  var DEFAULT_TITLE = "Danh sách sản phẩm | REUSE";

  var els = {
    form: document.getElementById("filter-form"),
    search: document.getElementById("f-search"),
    category: document.getElementById("f-category"),
    min: document.getElementById("f-min"),
    max: document.getElementById("f-max"),
    condition: document.getElementById("f-condition"),
    sort: document.getElementById("f-sort"),
    reset: document.getElementById("btn-reset"),
    priceError: document.getElementById("price-error"),
    summary: document.getElementById("result-summary"),
    list: document.getElementById("product-list"),
    stateBox: document.getElementById("state-box"),
    pagination: document.getElementById("pagination"),
    results: document.getElementById("results"),
    panel: document.getElementById("filter-panel"),
    toggle: document.getElementById("filter-toggle"),
  };

  var state = defaultState();
  var requestSeq = 0; // mỗi lần tải tăng 1; chỉ kết quả của lần mới nhất được hiển thị
  var firstRender = true;
  var wishlistReady = Promise.resolve();

  // ------------------------------------------------------------------ Tiện ích
  function defaultState() {
    return { search: "", category_id: "", min_price: "", max_price: "", condition: "", sort: "newest", page: 1 };
  }

  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function digitsOnly(text) {
    return String(text == null ? "" : text).replace(/\D/g, "");
  }

  function hasToken() {
    try { return !!localStorage.getItem("token"); } catch (e) { return false; }
  }

  // ------------------------------------------------------------------ Trạng thái <-> URL
  /** Đọc URL và làm sạch: giá trị rác bị bỏ để không gửi lên API (tránh 400 do sửa tay URL). */
  function readStateFromUrl() {
    var p = new URLSearchParams(location.search);
    var s = defaultState();

    s.search = (p.get("search") || "").trim().slice(0, 100);
    var cat = p.get("category_id") || "";
    if (/^\d{1,10}$/.test(cat) && Number(cat) > 0) s.category_id = String(Number(cat));
    var min = p.get("min_price") || "";
    var max = p.get("max_price") || "";
    if (/^\d{1,10}$/.test(min)) s.min_price = String(Number(min));
    if (/^\d{1,10}$/.test(max)) s.max_price = String(Number(max));
    if (s.min_price && s.max_price && Number(s.min_price) > Number(s.max_price)) {
      var tmp = s.min_price; s.min_price = s.max_price; s.max_price = tmp; // hiểu là khoảng giá bị đảo
    }
    var cond = p.get("condition") || "";
    if (CONDITIONS.indexOf(cond) !== -1) s.condition = cond;
    var sort = p.get("sort") || "";
    if (SORTS.indexOf(sort) !== -1) s.sort = sort;
    var page = p.get("page") || "";
    if (/^\d{1,7}$/.test(page) && Number(page) >= 1) s.page = Number(page);
    return s;
  }

  /** Chuỗi query từ state; bỏ qua giá trị mặc định cho URL gọn. forApi = thêm limit. */
  function buildQuery(s, forApi) {
    var p = new URLSearchParams();
    if (s.search) p.set("search", s.search);
    if (s.category_id) p.set("category_id", s.category_id);
    if (s.min_price) p.set("min_price", s.min_price);
    if (s.max_price) p.set("max_price", s.max_price);
    if (s.condition) p.set("condition", s.condition);
    if (s.sort && s.sort !== "newest") p.set("sort", s.sort);
    if (s.page > 1) p.set("page", String(s.page));
    if (forApi) p.set("limit", String(PAGE_LIMIT));
    return p.toString();
  }

  function syncUrl(mode) {
    var qs = buildQuery(state, false);
    var url = location.pathname + (qs ? "?" + qs : "");
    if (url === location.pathname + location.search) return;
    if (mode === "replace") history.replaceState(null, "", url);
    else history.pushState(null, "", url);
  }

  // ------------------------------------------------------------------ Form <-> state
  function fillForm() {
    els.search.value = state.search;
    els.category.value = state.category_id; // nếu danh mục chưa tải xong, được gán lại trong loadCategories()
    els.min.value = state.min_price;
    els.max.value = state.max_price;
    els.condition.value = state.condition;
    els.sort.value = state.sort;
    hidePriceError();
  }

  function showPriceError(message) {
    els.priceError.textContent = message;
    els.priceError.hidden = false;
  }

  function hidePriceError() {
    els.priceError.textContent = "";
    els.priceError.hidden = true;
  }

  /** Đọc form vào state. Trả false (và hiện lỗi) nếu khoảng giá sai. */
  function readForm() {
    var min = digitsOnly(els.min.value);
    var max = digitsOnly(els.max.value);
    if (min.length > 10 || max.length > 10) {
      showPriceError("Giá quá lớn");
      return false;
    }
    if (min && max && Number(min) > Number(max)) {
      showPriceError("Giá tối thiểu không được lớn hơn giá tối đa");
      return false;
    }
    hidePriceError();
    state.search = els.search.value.trim().slice(0, 100);
    state.category_id = els.category.value;
    state.min_price = min ? String(Number(min)) : "";
    state.max_price = max ? String(Number(max)) : "";
    state.condition = els.condition.value;
    state.sort = els.sort.value;
    els.min.value = state.min_price; // chuẩn hóa "1.000.000" -> "1000000"
    els.max.value = state.max_price;
    return true;
  }

  // ------------------------------------------------------------------ Hiển thị
  function showStateBox(html) {
    els.stateBox.innerHTML = html;
    els.stateBox.hidden = false;
  }

  function hideStateBox() {
    els.stateBox.innerHTML = "";
    els.stateBox.hidden = true;
  }

  function showSkeleton() {
    var html = "";
    for (var i = 0; i < 8; i++) html += '<div class="product-skeleton" aria-hidden="true"></div>';
    els.list.innerHTML = html;
  }

  function showFatal(message) {
    els.summary.textContent = "";
    els.list.innerHTML = "";
    els.pagination.hidden = true;
    showStateBox('<div class="empty-state"><p>' + esc(message) + "</p></div>");
  }

  function showError(err) {
    els.list.innerHTML = "";
    els.pagination.hidden = true;
    els.summary.textContent = "";
    var message = err instanceof TypeError
      ? "Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại."
      : (err && err.message) || "Không tải được danh sách sản phẩm.";
    showStateBox(
      '<div class="empty-state"><p>' + esc(message) + '</p>' +
      '<button type="button" class="btn btn-primary" data-action="retry">Thử lại</button></div>'
    );
  }

  function renderCards(items) {
    var html = "";
    for (var i = 0; i < items.length; i++) {
      try {
        html += renderProductCard(items[i]);
      } catch (e) {
        console.error("[products.js] renderProductCard lỗi với sản phẩm", items[i] && items[i].id, e);
      }
    }
    els.list.innerHTML = html;
  }

  function renderSummary(total, pg) {
    var text;
    if (total === 0) {
      text = "Không tìm thấy sản phẩm nào";
    } else {
      text = "Tìm thấy " + total + " sản phẩm";
    }
    if (state.search) text += " cho “" + state.search + "”";
    if (total > 0 && pg.total_pages > 1) text += " – Trang " + pg.page + "/" + pg.total_pages;
    els.summary.textContent = text; // textContent: an toàn với mọi ký tự trong từ khóa
    document.title = state.search ? "“" + state.search + "” – Sản phẩm | REUSE" : DEFAULT_TITLE;
  }

  /** Dãy số trang: 1 … (page-1) page (page+1) … last, kèm Trước/Sau. */
  function renderPagination(page, totalPages) {
    if (totalPages <= 1) {
      els.pagination.innerHTML = "";
      els.pagination.hidden = true;
      return;
    }
    var numbers = [1];
    for (var i = page - 1; i <= page + 1; i++) if (i > 1 && i < totalPages) numbers.push(i);
    numbers.push(totalPages);

    var html = '<button type="button" class="page-btn" data-page="' + (page - 1) + '"' +
      (page <= 1 ? " disabled" : "") + ' aria-label="Trang trước">‹ Trước</button>';
    var prev = 0;
    for (var k = 0; k < numbers.length; k++) {
      var n = numbers[k];
      if (n - prev > 1) html += '<span class="page-gap" aria-hidden="true">…</span>';
      html += '<button type="button" class="page-btn' + (n === page ? " is-active" : "") + '" data-page="' + n + '"' +
        (n === page ? ' aria-current="page"' : "") + ' aria-label="Trang ' + n + '">' + n + "</button>";
      prev = n;
    }
    html += '<button type="button" class="page-btn" data-page="' + (page + 1) + '"' +
      (page >= totalPages ? " disabled" : "") + ' aria-label="Trang sau">Sau ›</button>';
    els.pagination.innerHTML = html;
    els.pagination.hidden = false;
  }

  function renderEmpty() {
    els.list.innerHTML = "";
    els.pagination.hidden = true;
    showStateBox(
      '<div class="empty-state"><p>Không có sản phẩm nào phù hợp với bộ lọc của bạn.</p>' +
      '<button type="button" class="btn btn-outline" data-action="reset">Xóa bộ lọc</button></div>'
    );
  }

  // ------------------------------------------------------------------ Tải dữ liệu
  async function load() {
    var seq = ++requestSeq;
    hideStateBox();
    els.list.setAttribute("aria-busy", "true");
    if (firstRender) showSkeleton();
    else els.list.classList.add("is-loading");

    try {
      await wishlistReady; // nạp danh sách tim trước để thẻ hiển thị đúng trạng thái yêu thích
      var res = await apiFetch("/products?" + buildQuery(state, true));
      if (seq !== requestSeq) return; // đã có yêu cầu mới hơn

      var items = Array.isArray(res.data) ? res.data : [];
      var pg = res.pagination || { page: state.page, limit: PAGE_LIMIT, total: items.length, total_pages: 1 };

      // Trang yêu cầu vượt quá tổng số trang (VD: sau khi lọc, hoặc sửa tay URL) -> về trang cuối
      if (items.length === 0 && pg.total > 0 && state.page > pg.total_pages) {
        state.page = pg.total_pages;
        syncUrl("replace");
        return load();
      }

      firstRender = false;
      renderSummary(pg.total, pg);
      if (items.length === 0) {
        renderEmpty();
      } else {
        renderCards(items);
        renderPagination(pg.page, pg.total_pages);
      }
    } catch (err) {
      if (seq !== requestSeq) return;
      firstRender = false;
      showError(err);
    } finally {
      if (seq === requestSeq) {
        els.list.classList.remove("is-loading");
        els.list.removeAttribute("aria-busy");
      }
    }
  }

  async function loadCategories() {
    try {
      var res = await apiFetch("/categories");
      var cats = Array.isArray(res.data) ? res.data : [];
      for (var i = 0; i < cats.length; i++) {
        var opt = document.createElement("option");
        opt.value = String(cats[i].id);
        opt.textContent = cats[i].name; // textContent: tên danh mục không thể chèn HTML
        els.category.appendChild(opt);
      }
      els.category.value = state.category_id;
    } catch (err) {
      console.error("[products.js] không tải được danh mục", err); // danh sách sản phẩm vẫn hoạt động
    }
  }

  async function initWishlist() {
    if (!hasToken() || typeof loadWishlistIds !== "function") return;
    try { await loadWishlistIds(); } catch (e) { /* tim là tính năng phụ, bỏ qua lỗi */ }
  }

  // ------------------------------------------------------------------ Điều hướng
  function goTo(mode) {
    syncUrl(mode);
    load();
  }

  function applyForm() {
    if (!readForm()) return;
    state.page = 1;
    closePanel();
    goTo("push");
  }

  function resetAll() {
    state = defaultState();
    fillForm();
    closePanel();
    goTo("push");
  }

  function closePanel() {
    els.panel.classList.remove("is-open");
    els.toggle.setAttribute("aria-expanded", "false");
  }

  function bindEvents() {
    els.form.addEventListener("submit", function (e) {
      e.preventDefault();
      applyForm();
    });
    els.category.addEventListener("change", applyForm);
    els.condition.addEventListener("change", applyForm);
    els.reset.addEventListener("click", resetAll);

    els.sort.addEventListener("change", function () {
      if (!readForm()) { els.sort.value = state.sort; return; }
      state.page = 1;
      goTo("push");
    });

    els.pagination.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("button[data-page]") : null;
      if (!btn || btn.disabled) return;
      var page = Number(btn.getAttribute("data-page"));
      if (!(page >= 1) || page === state.page) return;
      state.page = page;
      goTo("push");
      els.results.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    els.stateBox.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("button[data-action]") : null;
      if (!btn) return;
      if (btn.getAttribute("data-action") === "retry") load();
      else if (btn.getAttribute("data-action") === "reset") resetAll();
    });

    els.toggle.addEventListener("click", function () {
      var open = els.panel.classList.toggle("is-open");
      els.toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    window.addEventListener("popstate", function () {
      state = readStateFromUrl();
      fillForm();
      load();
    });
  }

  // ------------------------------------------------------------------ Khởi động
  function init() {
    if (typeof renderProductCard !== "function") {
      showFatal("Không thể hiển thị sản phẩm: thiếu hàm renderProductCard trong main.js (TV1). Hãy kiểm tra main.js đã được nhúng.");
      return;
    }
    state = readStateFromUrl();
    fillForm();
    syncUrl("replace"); // chuẩn hóa URL (bỏ tham số rác)
    bindEvents();
    wishlistReady = initWishlist();
    loadCategories();
    load();
  }

  init();
})();
