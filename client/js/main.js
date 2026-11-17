/* ==========================================================================
   HẰNG SỐ DÙNG CHUNG (Mục 3 & Mục 6.3)
   ========================================================================== */
const CONDITION_LABELS = {
  new: 'Mới 100%',
  like_new: 'Như mới (~99%)',
  good: 'Tốt (~90%)',
  fair: 'Khá (~70%)'
};

const LOCATIONS = [
  'TP. Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Cần Thơ',
  'Hải Phòng',
  'Khác'
];

/* ==========================================================================
   HÀM TIỆN ÍCH DÙNG CHUNG (Mục 6.3)
   ========================================================================== */

/**
 * Định dạng số tiền sang chuẩn VND: 7500000 -> '7.500.000 ₫'
 */
function formatPrice(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('vi-VN') + ' ₫';
}

/**
 * Hiển thị thông báo góc màn hình
 * @param {string} message - Nội dung thông báo
 * @param {'success'|'error'} type - Loại thông báo
 */
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toastType = type === 'error' ? 'toast-error' : 'toast-success';
  const iconClass = type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check';

  const toast = document.createElement('div');
  toast.className = `toast ${toastType}`;
  toast.innerHTML = `
    <i class="fa-solid ${iconClass}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/**
 * Trả về chuỗi HTML của 1 thẻ sản phẩm chuẩn (TV3, TV4, TV5 tái sử dụng)
 * @param {Object} product - Đối tượng ProductCard theo Mục 4
 * @param {boolean} isWishlisted - Trạng thái đã yêu thích hay chưa
 */
function renderProductCard(product, isWishlisted = false) {
  const conditionText = CONDITION_LABELS[product.condition] || product.condition || '';
  const imageSrc = product.thumbnail || 'https://placehold.co/400x400?text=REUSE';
  const activeClass = isWishlisted ? 'active' : '';

  return `
    <div class="product-card">
      <div class="product-card__img-wrap">
        <a href="product-detail.html?id=${product.id}">
          <img src="${imageSrc}" alt="${product.name}" class="product-card__img" loading="lazy">
        </a>
        <button 
          type="button" 
          class="btn-wishlist ${activeClass}" 
          data-product-id="${product.id}"
          onclick="if (typeof toggleWishlist === 'function') toggleWishlist(${product.id}, this)"
          title="Yêu thích"
        >
          <i class="fa-solid fa-heart"></i>
        </button>
      </div>
      <div class="product-card__body">
        <span class="badge">${conditionText}</span>
        <a href="product-detail.html?id=${product.id}" class="product-card__name" title="${product.name}">
          ${product.name}
        </a>
        <div class="product-card__price">${formatPrice(product.price)}</div>
        <div class="product-card__meta">
          <span><i class="fa-solid fa-location-dot"></i> ${product.location || 'Toàn quốc'}</span>
          <span>${product.category_name || ''}</span>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   HEADER & FOOTER DÙNG CHUNG (Mục 6.4 - đọc trực tiếp localStorage)
   ========================================================================== */
function renderHeader() {
  const headerContainer = document.getElementById('site-header');
  if (!headerContainer) return;

  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');
  let user = null;
  try {
    user = token && userJson ? JSON.parse(userJson) : null;
  } catch (e) {
    user = null;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const currentSearch = urlParams.get('search') || '';

  headerContainer.innerHTML = `
    <div class="container header-inner">
      <a href="index.html" class="brand-logo">
        <i class="fa-solid fa-recycle"></i> RE<span>USE</span>
      </a>

      <form class="search-box" onsubmit="handleHeaderSearch(event)">
        <input 
          type="text" 
          id="header-search-input" 
          class="search-input" 
          value="${currentSearch.replace(/"/g, '&quot;')}"
          placeholder="Tìm kiếm đồ cũ chất lượng..."
        >
        <span class="search-shortcut">Ctrl K</span>
        <button type="submit" class="search-btn" title="Tìm kiếm">
          <i class="fa-solid fa-magnifying-glass"></i>
        </button>
      </form>

      <div class="header-actions">
        ${user ? `
          <a href="sell.html" class="btn btn-primary btn-sm">
            <i class="fa-solid fa-plus"></i> Đăng tin
          </a>
          <a href="wishlist.html" class="nav-link" title="Danh sách yêu thích">
            <i class="fa-regular fa-heart fa-lg"></i>
          </a>
          <a href="profile.html" class="user-profile-menu" title="Trang cá nhân">
            <img 
              src="${user.avatar || 'https://ui-avatars.com/api/?background=2E7D32&color=fff&name=' + encodeURIComponent(user.full_name)}" 
              alt="${user.full_name}" 
              class="user-avatar"
            >
            <span style="font-weight: 600;">${user.full_name}</span>
          </a>
          ${user.role === 'admin' ? `<a href="admin.html" class="btn btn-outline btn-sm">Quản trị</a>` : ''}
          <button type="button" onclick="handleHeaderLogout()" class="btn btn-outline btn-sm" title="Đăng xuất">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        ` : `
          <a href="login.html" class="btn btn-outline btn-sm">Đăng nhập</a>
          <a href="register.html" class="btn btn-primary btn-sm">Đăng ký</a>
        `}
      </div>
    </div>
  `;
}

function renderFooter() {
  const footerContainer = document.getElementById('site-footer');
  if (!footerContainer) return;

  footerContainer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a href="index.html" class="brand-logo">
            <i class="fa-solid fa-recycle"></i> RE<span>USE</span>
          </a>
          <p style="margin-top: 0.75rem;">Nền tảng mua bán đồ cũ trực tuyến uy tín. Hướng tới tiêu dùng bền vững và bảo vệ môi trường.</p>
        </div>
        <div>
          <h4 class="footer-title">Khám Phá</h4>
          <div class="footer-links">
            <a href="products.html">Tất cả sản phẩm</a>
            <a href="products.html?sort=newest">Mới đăng gần đây</a>
            <a href="sell.html">Đăng bán đồ cũ</a>
          </div>
        </div>
        <div>
          <h4 class="footer-title">Tài Khoản</h4>
          <div class="footer-links">
            <a href="profile.html">Trang cá nhân</a>
            <a href="wishlist.html">Danh sách yêu thích</a>
            <a href="login.html">Đăng nhập / Đăng ký</a>
          </div>
        </div>
        <div>
          <h4 class="footer-title">Liên Hệ</h4>
          <p style="font-size: 0.9rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-envelope"></i> support@reuse.vn</p>
          <p style="font-size: 0.9rem;"><i class="fa-solid fa-phone"></i> 1900 6868</p>
        </div>
      </div>
      <div class="footer-bottom flex" style="justify-content: space-between;">
        <p>&copy; 2026 REUSE Marketplace. Đồ án nhóm 6 thành viên.</p>
      </div>
    </div>
  `;
}

function handleHeaderSearch(e) {
  e.preventDefault();
  const keyword = document.getElementById('header-search-input').value.trim();
  window.location.href = `products.html?search=${encodeURIComponent(keyword)}`;
}

function handleHeaderLogout() {
  if (typeof logout === 'function') {
    logout(); // Gọi hàm của TV2 nếu trang có nhúng auth.js
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  }
}

function setupSearchShortcut() {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const input = document.getElementById('header-search-input');
      if (input) input.focus();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderFooter();
  setupSearchShortcut();
});