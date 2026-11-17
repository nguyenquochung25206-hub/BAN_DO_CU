(function () {
  "use strict";

  var list = document.getElementById("my-products-list");
  if (!list) return;
  var tabs = document.getElementById("seller-status-tabs");
  var feedback = document.getElementById("seller-feedback");
  var empty = document.getElementById("seller-empty");
  var loading = document.getElementById("seller-loading");
  var pagination = document.getElementById("seller-pagination");
  var searchInput = document.getElementById("seller-search-input");
  var state = { status: "", page: 1, totalPages: 1, products: [], query: "" };
  var labels = {
    pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Bị từ chối", sold: "Đã bán",
  };
  var conditions = { new: "Mới 100%", like_new: "Như mới", good: "Tốt", fair: "Khá" };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function price(value) {
    var amount = Number(value);
    return Number.isFinite(amount) ? new Intl.NumberFormat("vi-VN").format(amount) + " ₫" : "Liên hệ";
  }
  function imageUrl(value) {
    if (!value) return "";
    try { return new URL(value, location.origin).href; } catch (err) { return ""; }
  }
  function setFeedback(text, type) {
    feedback.textContent = text || "";
    feedback.className = "seller-feedback" + (type ? " seller-feedback--" + type : "");
    feedback.hidden = !text;
  }
  function setCounts(products) {
    var counts = { all: products.length, pending: 0, approved: 0, rejected: 0, sold: 0 };
    products.forEach(function (product) { if (counts[product.status] !== undefined) counts[product.status] += 1; });
    Object.keys(counts).forEach(function (key) {
      var node = document.querySelector('[data-count="' + key + '"]');
      if (node) node.textContent = counts[key];
    });
  }
  function makeCard(product) {
    var status = labels[product.status] || "Không rõ trạng thái";
    var card = document.createElement("article");
    card.className = "seller-product";
    card.dataset.productId = product.id;
    var thumb = imageUrl(product.thumbnail);
    card.innerHTML = '<a class="seller-product__image" href="product-detail.html?id=' + encodeURIComponent(product.id) + '" aria-label="Xem ' + esc(product.name) + '">' +
      (thumb ? '<img src="' + esc(thumb) + '" alt="' + esc(product.name) + '" loading="lazy">' : '<span aria-hidden="true">▧</span>') + '</a>' +
      '<div class="seller-product__content"><div class="seller-product__top"><span class="seller-badge seller-badge--' + esc(product.status) + '">' + esc(status) + '</span><span class="seller-product__date">' + esc(product.created_at ? new Date(product.created_at).toLocaleDateString("vi-VN") : "") + '</span></div>' +
      '<h2><a href="product-detail.html?id=' + encodeURIComponent(product.id) + '">' + esc(product.name) + '</a></h2>' +
      '<p class="seller-product__meta">' + esc(product.category_name || "Danh mục") + ' <span>·</span> ' + esc(conditions[product.condition] || product.condition || "") + ' <span>·</span> ' + esc(product.location || "") + '</p>' +
      '<p class="seller-product__price">' + esc(price(product.price)) + '</p>' +
      (product.status === "rejected" && product.rejection_reason ? '<p class="seller-product__reason">Lý do từ chối: ' + esc(product.rejection_reason) + '</p>' : '') +
      '<div class="seller-product__actions">' +
      (product.status !== "sold" ? '<a class="btn btn-outline btn-sm" href="sell.html?edit=' + encodeURIComponent(product.id) + '">Chỉnh sửa</a>' : '') +
      (product.status === "approved" ? '<button type="button" class="btn btn-outline btn-sm" data-action="sold">Đánh dấu đã bán</button>' : '') +
      '<button type="button" class="btn btn-danger-outline btn-sm" data-action="delete">Xóa tin</button></div></div>';
    return card;
  }
  function render(products) {
    var query = state.query.trim().toLocaleLowerCase("vi");
    var visible = query ? products.filter(function (product) {
      return [product.name, product.category_name, product.location].join(" ").toLocaleLowerCase("vi").includes(query);
    }) : products;
    list.replaceChildren.apply(list, visible.map(makeCard));
    empty.hidden = visible.length > 0;
    if (!products.length && state.status) {
      empty.querySelector("h2").textContent = "Chưa có tin ở trạng thái này";
      empty.querySelector("p").textContent = "Bạn có thể chọn trạng thái khác để xem các tin đăng.";
    } else {
      empty.querySelector("h2").textContent = "Chưa có tin đăng nào";
      empty.querySelector("p").textContent = "Hãy đăng món đồ đầu tiên của bạn lên REUSE.";
    }
    renderPagination();
  }
  function renderPagination() {
    pagination.replaceChildren();
    pagination.hidden = state.totalPages <= 1;
    if (pagination.hidden) return;
    var previous = document.createElement("button");
    previous.type = "button"; previous.textContent = "‹ Trước"; previous.disabled = state.page <= 1;
    previous.addEventListener("click", function () { load(state.page - 1); });
    var label = document.createElement("span"); label.textContent = "Trang " + state.page + " / " + state.totalPages;
    var next = document.createElement("button");
    next.type = "button"; next.textContent = "Tiếp ›"; next.disabled = state.page >= state.totalPages;
    next.addEventListener("click", function () { load(state.page + 1); });
    pagination.append(previous, label, next);
  }
  async function load(page) {
    if (!localStorage.getItem("token")) {
      location.href = "login.html?next=" + encodeURIComponent("my-products.html");
      return;
    }
    state.page = page || 1;
    loading.hidden = false;
    list.hidden = true;
    empty.hidden = true;
    pagination.hidden = true;
    setFeedback("");
    var query = new URLSearchParams({ page: String(state.page), limit: "50" });
    if (state.status) query.set("status", state.status);
    try {
      var result = await apiFetch("/users/my-products?" + query.toString());
      state.products = Array.isArray(result.data) ? result.data : [];
      state.totalPages = result.pagination && result.pagination.total_pages || 1;
      setCounts(state.products);
      render(state.products);
      list.hidden = false;
    } catch (err) {
      setFeedback(err.message || "Không thể tải tin đăng của bạn.", "error");
    } finally {
      loading.hidden = true;
    }
  }

  tabs.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-status]");
    if (!button) return;
    tabs.querySelectorAll("button").forEach(function (tab) {
      tab.classList.toggle("is-active", tab === button);
      tab.setAttribute("aria-selected", tab === button ? "true" : "false");
    });
    state.status = button.dataset.status;
    load(1);
  });
  searchInput.addEventListener("input", function () {
    state.query = searchInput.value;
    render(state.products);
  });
  list.addEventListener("click", async function (event) {
    var button = event.target.closest("button[data-action]");
    if (!button) return;
    var card = button.closest("[data-product-id]");
    if (!card) return;
    var id = card.dataset.productId;
    if (button.dataset.action === "delete") {
      if (!window.confirm("Bạn có chắc muốn xóa tin đăng này? Thao tác này không thể hoàn tác.")) return;
      button.disabled = true;
      try {
        var deletion = await apiFetch("/products/" + encodeURIComponent(id), { method: "DELETE" });
        setFeedback(deletion.message || "Đã xóa tin đăng.", "success");
        await load(state.page);
      } catch (err) {
        setFeedback(err.message || "Không thể xóa tin đăng.", "error");
        button.disabled = false;
      }
    }
    if (button.dataset.action === "sold") {
      if (!window.confirm("Xác nhận sản phẩm này đã bán?")) return;
      button.disabled = true;
      try {
        var update = await apiFetch("/products/" + encodeURIComponent(id) + "/sold", { method: "PUT" });
        setFeedback(update.message || "Đã đánh dấu sản phẩm đã bán.", "success");
        await load(state.page);
      } catch (err) {
        setFeedback(err.message || "Không thể cập nhật trạng thái tin.", "error");
        button.disabled = false;
      }
    }
  });
  load(1);
})();
