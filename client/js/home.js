document.addEventListener('DOMContentLoaded', () => {
  loadHomeCategories();
  loadHomeProducts();
});

async function loadHomeCategories() {
  const container = document.getElementById('category-container');
  if (!container) return;

  try {
    // Gọi API thật đã chốt ở Mục 5.2 (apiFetch tự thêm /api)
    const res = typeof apiFetch === 'function'
      ? await apiFetch('/categories')
      : await fetch('/api/categories').then(r => r.json());

    if (res && res.success && Array.isArray(res.data)) {
      container.innerHTML = res.data.slice(0, 6).map(cat => `
        <a href="/pages/products.html?category_id=${cat.id}" class="category-card">
          <div class="category-icon"><i class="fa-solid fa-layer-group"></i></div>
          <div class="category-name">${cat.name}</div>
        </a>
      `).join('');
      return;
    }
  } catch (err) {
    console.warn('Chưa kết nối được API categories, dùng dữ liệu mẫu:', err);
  }

  // Fallback dữ liệu mẫu theo cấu trúc Category (Mục 4)
  const fallbackCategories = [
    { id: 1, name: 'Công nghệ' },
    { id: 2, name: 'Thời trang' },
    { id: 3, name: 'Gia dụng' },
    { id: 4, name: 'Xe cộ' },
    { id: 5, name: 'Sách vở' },
    { id: 6, name: 'Giải trí' }
  ];

  container.innerHTML = fallbackCategories.map(cat => `
    <a href="/pages/products.html?category_id=${cat.id}" class="category-card">
      <div class="category-icon"><i class="fa-solid fa-layer-group"></i></div>
      <div class="category-name">${cat.name}</div>
    </a>
  `).join('');
}

async function loadHomeProducts() {
  const grid = document.getElementById('home-products-grid');
  if (!grid) return;

  // Hiệu ứng Skeleton khi đang tải
  grid.innerHTML = Array(4).fill(0).map(() => `
    <div class="product-card">
      <div class="product-card__img-wrap skeleton"></div>
      <div class="product-card__body">
        <div class="skeleton" style="height: 18px; margin-bottom: 10px;"></div>
        <div class="skeleton" style="height: 22px; width: 60%;"></div>
      </div>
    </div>
  `).join('');

  try {
    // Lấy danh sách ID yêu thích từ wishlist.js (TV5) nếu đã đăng nhập
    let wishlistIds = [];
    if (localStorage.getItem('token') && typeof loadWishlistIds === 'function') {
      wishlistIds = (await loadWishlistIds()) || [];
    }

    // Gọi API thật GET /api/products?sort=newest&limit=8 (apiFetch tự thêm /api)
    const res = typeof apiFetch === 'function'
      ? await apiFetch('/products?sort=newest&limit=8')
      : await fetch('/api/products?sort=newest&limit=8').then(r => r.json());

    if (res && res.success && Array.isArray(res.data)) {
      if (res.data.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">Chưa có sản phẩm nào được đăng bán.</div>`;
        return;
      }
      grid.innerHTML = res.data
        .map(prod => renderProductCard(prod, wishlistIds.includes(prod.id)))
        .join('');
      return;
    }
  } catch (err) {
    console.warn('Chưa kết nối được API products, dùng dữ liệu mẫu:', err);
  }

  // Fallback dữ liệu mẫu chuẩn cấu trúc ProductCard (Mục 4)
  const fallbackProducts = [
    {
      id: 1,
      name: 'Tai nghe Sony WH-1000XM4',
      price: 3850000,
      condition: 'like_new',
      location: 'TP. Hồ Chí Minh',
      category_name: 'Công nghệ',
      thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 2,
      name: 'Áo khoác Denim Vintage Unisex Size L',
      price: 250000,
      condition: 'good',
      location: 'Hà Nội',
      category_name: 'Thời trang',
      thumbnail: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 3,
      name: 'Bàn làm việc gỗ Sồi tự nhiên bo góc',
      price: 1200000,
      condition: 'good',
      location: 'Đà Nẵng',
      category_name: 'Gia dụng',
      thumbnail: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 4,
      name: 'Máy ảnh Film Canon AE-1 kèm Lens 50mm f1.8',
      price: 2900000,
      condition: 'fair',
      location: 'TP. Hồ Chí Minh',
      category_name: 'Công nghệ',
      thumbnail: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80'
    }
  ];

  grid.innerHTML = fallbackProducts.map(prod => renderProductCard(prod, false)).join('');
}