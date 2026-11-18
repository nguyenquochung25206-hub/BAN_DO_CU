/* TV5 – feature/tv5-user. Hàm chung tuần 1: loadWishlistIds, toggleWishlist(id, buttonEl). */
(() => {
  "use strict";
  let ownerToken = null;
  let generation = 0;
  let ids = new Set();
  let loaded = false;
  let loading = null;
  let items = [];
  const pending = new Map();
  const registered = new Map();

  function idOf(value) {
    if (typeof value !== "number" && typeof value !== "string") throw new Error("ID sản phẩm không hợp lệ");
    if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error("ID sản phẩm không hợp lệ");
    return Number(value);
  }
  function session() {
    const current = getToken();
    if (current !== ownerToken) {
      ownerToken = current;
      generation++;
      ids = new Set();
      items = [];
      loaded = false;
      loading = null;
    }
    return current;
  }
  function requireAccount() {
    if (session()) return true;
    if (typeof requireLogin === "function") requireLogin();
    else location.href = "/pages/login.html";
    return false;
  }
  function notify(message, type = "success") {
    const notice = document.getElementById("wishlist-feedback");
    if (notice) { notice.textContent = message; notice.dataset.error = String(type === "error"); }
    if (typeof showToast === "function") showToast(message, type);
    else if (!notice) window.alert(message);
  }
  function buttonId(button) {
    const card = button.closest && button.closest(".product-card");
    const value = button.dataset.wishlistProductId || button.dataset.productId
      || (card && (card.dataset.productId || card.dataset.id));
    return /^[1-9]\d*$/.test(String(value)) ? Number(value) : null;
  }
  function syncButtons() {
    document.querySelectorAll(".btn-wishlist, button[data-wishlist-product-id]").forEach((button) => {
      const id = buttonId(button);
      if (id) registered.set(button, id);
    });
    registered.forEach((id, button) => {
      if (button.isConnected === false) { registered.delete(button); return; }
      button.classList.toggle("active", ids.has(id));
      button.setAttribute("aria-pressed", String(ids.has(id)));
      button.setAttribute("aria-label", ids.has(id) ? "Bỏ yêu thích sản phẩm" : "Thêm sản phẩm vào yêu thích");
      button.disabled = pending.has(generation + ":" + id);
    });
  }

  window.loadWishlistIds = async (force = false) => {
    const current = session();
    if (!current) { syncButtons(); return []; }
    if (loading) return loading;
    if (loaded && !force) { syncButtons(); return Array.from(ids); }
    const version = generation;
    const request = (async () => {
      const response = await apiFetch("/wishlist/ids");
      if (getToken() !== current || generation !== version) throw new Error("Phiên đăng nhập đã thay đổi, vui lòng tải lại trang");
      if (!Array.isArray(response.data) || response.data.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error("Dữ liệu ID yêu thích không hợp lệ");
      ids = new Set(response.data);
      loaded = true;
      syncButtons();
      return Array.from(ids);
    })();
    loading = request;
    try { return await request; }
    finally { if (loading === request) loading = null; }
  };
  // Giữ helper của TV5; TV1/TV3 chỉ cần hai hàm theo hợp đồng ở trên.
  window.isWishlisted = async (productId) => {
    const id = idOf(productId);
    return (await window.loadWishlistIds()).includes(id);
  };
  window.refreshWishlistButtons = async () => { await window.loadWishlistIds(); syncButtons(); };

  window.toggleWishlist = (productId, buttonEl) => {
    let id;
    try { id = idOf(productId); } catch (err) { return Promise.reject(err); }
    if (!requireAccount()) return Promise.resolve(false);
    if (buttonEl) registered.set(buttonEl, id);
    const version = generation;
    const key = version + ":" + id;
    if (pending.has(key)) return pending.get(key);
    const current = ownerToken;
    const operation = (async () => {
      try {
        await window.loadWishlistIds();
        if (getToken() !== current || generation !== version) throw new Error("Phiên đăng nhập đã thay đổi");
        const wasSaved = ids.has(id);
        await apiFetch(wasSaved ? "/wishlist/" + id : "/wishlist", {
          method: wasSaved ? "DELETE" : "POST",
          ...(wasSaved ? {} : { body: { product_id: id } }),
        });
        if (getToken() !== current || generation !== version) throw new Error("Phiên đăng nhập đã thay đổi");
        wasSaved ? ids.delete(id) : ids.add(id);
        if (wasSaved) items = items.filter((item) => Number(item.product.id) !== id);
        window.dispatchEvent(new CustomEvent("wishlist:change", { detail: { productId: id, wishlisted: !wasSaved } }));
        if (document.getElementById("wishlist-page")) {
          if (wasSaved) render(items);
          else await refreshPage();
        }
        notify(wasSaved ? "Đã bỏ yêu thích" : "Đã thêm vào yêu thích");
        return !wasSaved;
      } catch (err) {
        if (getToken() === current && generation === version) {
          loaded = false;
          try { await window.loadWishlistIds(true); } catch (_) { /* Giữ lỗi gốc. */ }
          notify(err.message, "error");
        }
        throw err;
      } finally {
        pending.delete(key);
        syncButtons();
      }
    })();
    pending.set(key, operation);
    syncButtons();
    return operation;
  };

  function render(list) {
    const grid = document.getElementById("wishlist-grid");
    if (!grid) return;
    if (list.length && typeof renderProductCard !== "function") throw new Error("TV1 chưa cung cấp renderProductCard trong main.js");
    grid.replaceChildren();
    document.getElementById("wishlist-count").textContent = list.length + " sản phẩm";
    document.getElementById("wishlist-empty").hidden = list.length !== 0;
    list.forEach((item) => {
      const wrapper = document.createElement("div");
      wrapper.className = "wishlist-item";
      wrapper.dataset.wishlistId = String(item.wishlist_id);
      // HTML thẻ dùng duy nhất renderer của TV1; TV1 chịu trách nhiệm escape dữ liệu.
      wrapper.innerHTML = renderProductCard(item.product);
      wrapper.querySelectorAll(".btn-wishlist").forEach((button) => {
        button.dataset.wishlistProductId = String(item.product.id);
        registered.set(button, Number(item.product.id));
      });
      grid.append(wrapper);
    });
    syncButtons();
  }

  async function refreshPage() {
    const grid = document.getElementById("wishlist-grid");
    if (!grid || !requireAccount()) return;
    const state = document.getElementById("wishlist-state");
    const retry = document.getElementById("wishlist-retry");
    const current = ownerToken;
    const version = generation;
    state.hidden = false;
    state.textContent = "Đang tải danh sách yêu thích…";
    retry.hidden = true;
    grid.setAttribute("aria-busy", "true");
    try {
      const [response] = await Promise.all([apiFetch("/wishlist"), window.loadWishlistIds(true)]);
      if (getToken() !== current || generation !== version) return;
      if (!Array.isArray(response.data)) throw new Error("Dữ liệu yêu thích không hợp lệ");
      items = response.data;
      render(items);
      state.hidden = true;
    } catch (err) {
      if (getToken() !== current || generation !== version) return;
      state.textContent = err.message;
      retry.hidden = false;
    } finally {
      if (getToken() === current && generation === version) grid.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".btn-wishlist, button[data-wishlist-product-id]");
    // Renderer TV1 có thể dùng onclick="toggleWishlist(id, this)".
    // Khi đã có inline handler, không xử lý thêm một lần bằng delegation.
    if (!button || button.disabled || button.hasAttribute("onclick")) return;
    const id = buttonId(button);
    if (!id) return;
    event.preventDefault();
    window.toggleWishlist(id, button).catch(() => {});
  });
  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("wishlist-page")) {
      document.getElementById("wishlist-retry").addEventListener("click", refreshPage);
      refreshPage();
    } else if (getToken()) window.loadWishlistIds().catch(() => {});
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "token" || event.key === null) {
      session();
      syncButtons();
      if (document.getElementById("wishlist-page")) refreshPage();
      else if (getToken()) window.loadWishlistIds(true).catch(() => {});
    }
  });
})();
