(function () {
  "use strict";

  var form = document.getElementById("sell-form");
  if (!form) return;

  var params = new URLSearchParams(location.search);
  var editId = params.get("edit");
  if (editId && !/^\d+$/.test(editId)) editId = null;
  var fields = {
    name: document.getElementById("sell-name"),
    price: document.getElementById("sell-price"),
    category_id: document.getElementById("sell-category"),
    condition: document.getElementById("sell-condition"),
    location: document.getElementById("sell-location"),
    description: document.getElementById("sell-description"),
    images: document.getElementById("sell-images"),
  };
  var existingPhotos = document.getElementById("existing-photos");
  var preview = document.getElementById("photo-preview");
  var message = document.getElementById("sell-message");
  var submit = document.getElementById("sell-submit");
  var submitLabel = document.getElementById("submit-label");
  var removedImageIds = [];
  var productImages = [];
  var isEditing = Boolean(editId);

  function hasSession() {
    return Boolean(localStorage.getItem("token"));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function fieldError(name, text) {
    var el = document.querySelector('[data-error-for="' + name + '"]');
    if (el) el.textContent = text || "";
    if (fields[name]) fields[name].setAttribute("aria-invalid", text ? "true" : "false");
  }

  function clearErrors() {
    Object.keys(fields).forEach(function (name) { fieldError(name, ""); });
    message.hidden = true;
    message.textContent = "";
    message.className = "sell-message";
  }

  function showMessage(text, type) {
    message.textContent = text;
    message.className = "sell-message sell-message--" + (type || "error");
    message.hidden = false;
    message.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setLoading(loading) {
    submit.disabled = loading;
    submit.classList.toggle("is-loading", loading);
    submit.querySelector(".sell-spinner").hidden = !loading;
    submitLabel.textContent = loading ? "Đang gửi…" : (isEditing ? "Lưu thay đổi" : "Đăng sản phẩm");
  }

  function absoluteImageUrl(url) {
    if (!url) return "";
    try { return new URL(url, location.origin).href; } catch (err) { return ""; }
  }

  function getSelectedFiles() { return Array.from(fields.images.files || []); }

  function renderPreviews() {
    preview.innerHTML = "";
    getSelectedFiles().forEach(function (file, index) {
      var tile = document.createElement("div");
      tile.className = "sell-photo sell-photo--new";
      var image = document.createElement("img");
      image.alt = "Ảnh mới " + (index + 1) + ": " + file.name;
      image.src = URL.createObjectURL(file);
      image.onload = function () { URL.revokeObjectURL(image.src); };
      var badge = document.createElement("span");
      badge.className = "sell-photo__badge";
      badge.textContent = "Ảnh mới";
      tile.append(image, badge);
      preview.appendChild(tile);
    });
    var keptCount = productImages.filter(function (img) { return removedImageIds.indexOf(Number(img.id)) === -1; }).length;
    var count = keptCount + getSelectedFiles().length;
    fieldError("images", count > 5 ? "Tổng số ảnh tối đa là 5." : "");
  }

  function renderExistingPhotos(images) {
    productImages = Array.isArray(images) ? images : [];
    existingPhotos.innerHTML = "";
    productImages.forEach(function (item, index) {
      var tile = document.createElement("div");
      tile.className = "sell-photo";
      tile.dataset.imageId = item.id;
      tile.innerHTML = '<img src="' + escapeHtml(absoluteImageUrl(item.image_url)) + '" alt="Ảnh sản phẩm ' + (index + 1) + '">' +
        '<button class="sell-photo__remove" type="button" aria-label="Xóa ảnh này" title="Xóa ảnh">×</button>';
      existingPhotos.appendChild(tile);
    });
    existingPhotos.hidden = productImages.length === 0;
    renderPreviews();
  }

  async function loadCategories() {
    var result = await apiFetch("/categories");
    var categories = Array.isArray(result.data) ? result.data : [];
    fields.category_id.innerHTML = '<option value="">Chọn danh mục</option>' + categories.map(function (category) {
      return '<option value="' + Number(category.id) + '">' + escapeHtml(category.name) + "</option>";
    }).join("");
    if (!categories.length) throw new Error("Chưa có danh mục sản phẩm.");
  }

  async function loadProduct() {
    var result = await apiFetch("/products/" + encodeURIComponent(editId));
    var product = result.data;
    if (!product || !product.id) throw new Error("Không tìm thấy tin đăng.");
    var currentUser;
    try { currentUser = JSON.parse(localStorage.getItem("user") || "null"); } catch (err) { currentUser = null; }
    if (currentUser && product.seller && Number(currentUser.id) !== Number(product.seller.id)) {
      throw new Error("Bạn không có quyền chỉnh sửa tin đăng này.");
    }
    if (product.status === "sold") throw new Error("Tin đã bán không thể chỉnh sửa.");
    ["name", "price", "category_id", "condition", "location", "description"].forEach(function (key) {
      if (product[key] != null) fields[key].value = product[key];
    });
    renderExistingPhotos(product.images);
  }

  function validate() {
    clearErrors();
    var valid = true;
    ["name", "price", "category_id", "condition", "location", "description"].forEach(function (key) {
      if (!String(fields[key].value || "").trim()) {
        fieldError(key, "Vui lòng điền thông tin này.");
        valid = false;
      }
    });
    if (fields.name.value.trim().length < 3) { fieldError("name", "Tên sản phẩm cần ít nhất 3 ký tự."); valid = false; }
    if (fields.name.value.trim().length > 200) { fieldError("name", "Tên sản phẩm tối đa 200 ký tự."); valid = false; }
    var price = Number(fields.price.value);
    if (!Number.isSafeInteger(price) || price < 1 || price > 9999999999) {
      fieldError("price", "Giá phải là số nguyên từ 1 đến 9.999.999.999 ₫."); valid = false;
    }
    if (fields.description.value.trim().length > 5000) { fieldError("description", "Mô tả tối đa 5.000 ký tự."); valid = false; }
    if (fields.location.value.trim().length > 255) { fieldError("location", "Khu vực tối đa 255 ký tự."); valid = false; }
    var allowed = ["image/jpeg", "image/png", "image/webp"];
    var files = getSelectedFiles();
    if (files.some(function (file) { return allowed.indexOf(file.type) === -1; })) {
      fieldError("images", "Chỉ nhận ảnh JPG, PNG hoặc WebP."); valid = false;
    } else if (files.some(function (file) { return file.size > 5 * 1024 * 1024; })) {
      fieldError("images", "Mỗi ảnh có dung lượng tối đa 5 MB."); valid = false;
    }
    var keptCount = productImages.filter(function (img) { return removedImageIds.indexOf(Number(img.id)) === -1; }).length;
    var imageCount = keptCount + files.length;
    if (imageCount < 1) { fieldError("images", "Vui lòng thêm ít nhất một ảnh sản phẩm."); valid = false; }
    if (imageCount > 5) { fieldError("images", "Tổng số ảnh tối đa là 5."); valid = false; }
    return valid;
  }

  async function init() {
    if (!hasSession()) { location.href = "login.html?next=" + encodeURIComponent("sell.html" + location.search); return; }
    if (isEditing) {
      document.getElementById("sell-title").textContent = "Chỉnh sửa tin đăng";
      document.getElementById("page-context").textContent = "Chỉnh sửa";
    }
    try {
      await loadCategories();
      if (isEditing) await loadProduct();
    } catch (err) {
      showMessage(err.message || "Không thể tải dữ liệu trang.", "error");
      submit.disabled = true;
    }
  }

  fields.images.addEventListener("change", renderPreviews);
  existingPhotos.addEventListener("click", function (event) {
    var button = event.target.closest(".sell-photo__remove");
    if (!button) return;
    var tile = button.closest(".sell-photo");
    var imageId = Number(tile.dataset.imageId);
    if (imageId && removedImageIds.indexOf(imageId) === -1) removedImageIds.push(imageId);
    tile.classList.add("is-removed");
    button.textContent = "↶";
    button.title = "Khôi phục ảnh";
    button.setAttribute("aria-label", "Khôi phục ảnh này");
    button.classList.add("sell-photo__restore");
    button.classList.remove("sell-photo__remove");
    renderPreviews();
  });
  existingPhotos.addEventListener("click", function (event) {
    var button = event.target.closest(".sell-photo__restore");
    if (!button) return;
    var tile = button.closest(".sell-photo");
    var imageId = Number(tile.dataset.imageId);
    removedImageIds = removedImageIds.filter(function (id) { return id !== imageId; });
    tile.classList.remove("is-removed");
    button.textContent = "×";
    button.title = "Xóa ảnh";
    button.setAttribute("aria-label", "Xóa ảnh này");
    button.classList.add("sell-photo__remove");
    button.classList.remove("sell-photo__restore");
    renderPreviews();
  });
  fields.description.addEventListener("input", function () {
    document.getElementById("description-count").textContent = fields.description.value.length + " / 5000";
  });
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!validate()) {
      var firstError = form.querySelector('[aria-invalid="true"]');
      if (firstError) firstError.focus();
      return;
    }
    var body = new FormData();
    ["name", "price", "category_id", "description", "condition", "location"].forEach(function (key) {
      body.append(key, fields[key].value.trim());
    });
    getSelectedFiles().forEach(function (file) { body.append("images", file); });
    if (isEditing) body.append("remove_image_ids", JSON.stringify(removedImageIds));
    setLoading(true);
    clearErrors();
    try {
      await apiFetch(isEditing ? "/products/" + encodeURIComponent(editId) : "/products", {
        method: isEditing ? "PUT" : "POST",
        body: body,
      });
      showMessage(isEditing ? "Đã lưu thay đổi. Tin đang chờ quản trị viên duyệt lại." : "Đăng tin thành công. Tin đang chờ quản trị viên duyệt.", "success");
      setTimeout(function () { location.href = "my-products.html"; }, 1200);
    } catch (err) {
      var errors = err.errors || {};
      Object.keys(errors).forEach(function (key) { if (fields[key]) fieldError(key, errors[key]); });
      showMessage(err.message || "Không thể gửi tin đăng. Vui lòng thử lại.", "error");
      setLoading(false);
    }
  });

  init();
})();
