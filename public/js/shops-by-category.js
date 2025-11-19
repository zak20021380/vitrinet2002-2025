(function () {
  const categoryParam = new URLSearchParams(window.location.search).get('cat') || 'general';
  const state = {
    category: categoryParam,
    isServiceCategory: false,
    search: '',
    sort: 'popular',
    activeSubcategory: 'all',
    shops: [],
  };

  document.addEventListener('DOMContentLoaded', async () => {
    hydrateHero();
    attachFilterEvents();
    await fetchRealShops();
  });

  function hydrateHero() {
    const title = document.getElementById('categoryTitle');
    const pill = document.getElementById('categoryPill');
    if (state.category === 'general') {
      title.textContent = 'ویترین اینترنتی شهر';
      pill.textContent = 'ویترین اینترنتی';
    } else {
      const label = state.category.replace(/-/g, ' ');
      title.textContent = `فروشگاه‌های ${label}`;
      pill.textContent = `دسته ${label}`;
    }
  }

  async function fetchRealShops() {
    try {
      let apiUrl = `/api/shops`;
      if (state.category && state.category !== 'general') {
        apiUrl += `?category=${encodeURIComponent(state.category)}`;
      }

      // Fetch both regular shops and service shops
      const [shopsResponse, serviceShopsResponse] = await Promise.all([
        fetch(apiUrl),
        fetch('/api/service-shops/showcase')
      ]);

      if (!shopsResponse.ok) throw new Error('Server Error');

      const shopsData = await shopsResponse.json();
      const shopList = Array.isArray(shopsData) ? shopsData : (shopsData.shops || []);

      // Parse service shops data
      let serviceShopList = [];
      if (serviceShopsResponse.ok) {
        const serviceData = await serviceShopsResponse.json();
        serviceShopList = (serviceData.items || []).map(item => ({
          id: item._id || item.id,
          storename: item.name || '',
          category: item.categoryName || 'خدمات',
          subcategory: (item.subcategories && item.subcategories[0]) || '',
          shopurl: item.shopUrl || '',
          address: item.address || '',
          city: item.city || '',
          region: '',
          desc: item.description || '',
          isPremium: !!item.isPremium,
          image: item.coverImage || ''
        }));
      }

      // Merge both lists
      state.shops = [...shopList, ...serviceShopList];

      const hasService = state.shops.some(s => s.category && s.category.includes('خدمات'));
      if (hasService || state.category.includes('service') || state.category === 'خدمات' || serviceShopList.length > 0) {
        state.isServiceCategory = true;
        setupServiceView(state.shops);
      }
      document.getElementById('categorySubtitle').textContent = 'لیست فروشگاه‌های اطراف شما';
      applyFiltersAndRender();
    } catch (error) {
      console.error(error);
      const grid = document.getElementById('results-grid');
      grid.innerHTML = `
        <div class="col-span-full text-center py-16 glass">
          <p class="font-black text-xl text-slate-800 mb-2">مشکلی پیش آمده!</p>
          <p class="text-slate-500">نتوانستیم اطلاعات را دریافت کنیم. لطفا دوباره تلاش کنید.</p>
          <button onclick="location.reload()" class="mt-4 btn-grad px-6 py-2 rounded-full font-bold">تلاش مجدد</button>
        </div>
      `;
    }
  }

  function setupServiceView(allShops) {
    const subcats = [...new Set(allShops.map(s => s.subcategory).filter(Boolean))];
    if (subcats.length > 0) {
      const container = document.getElementById('subcatContainer');
      container.classList.remove('hidden');
      subcats.forEach(sub => {
        const btn = document.createElement('button');
        btn.className = 'category-chip';
        btn.textContent = sub;
        btn.onclick = () => {
          container.querySelectorAll('.category-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          state.activeSubcategory = sub;
          applyFiltersAndRender();
        };
        container.appendChild(btn);
      });
      const first = container.querySelector('[data-sub="all"]');
      if (first) {
        first.onclick = () => {
          container.querySelectorAll('.category-chip').forEach(b => b.classList.remove('active'));
          first.classList.add('active');
          state.activeSubcategory = 'all';
          applyFiltersAndRender();
        };
      }
    }
    const portfolioSec = document.getElementById('portfolioSection');
    const portfolioGrid = document.getElementById('portfolioGrid');
    const sampleShops = allShops.slice(0, 5);
    if (sampleShops.length > 0) {
      portfolioSec.classList.remove('hidden');
      portfolioGrid.innerHTML = sampleShops.map(shop => `
        <div class="portfolio-card">
          <img src="${resolveShopImage(shop)}" alt="${shop.storename}" onerror="this.src='https://placehold.co/300?text=Portfolio'"/>
          <div class="portfolio-card__meta">
            <p class="text-sm font-bold">${shop.storename || 'نمونه کار'}</p>
            <span class="text-xs text-emerald-200">${shop.category || 'فروشگاه'}</span>
          </div>
        </div>
      `).join('');
    }
  }

  function attachFilterEvents() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
      state.search = e.target.value;
      applyFiltersAndRender();
    });
    document.getElementById('sortSelect').addEventListener('change', (e) => {
      state.sort = e.target.value;
      applyFiltersAndRender();
    });
  }

  function applyFiltersAndRender() {
    let collection = [...state.shops];
    if (state.activeSubcategory !== 'all') {
      collection = collection.filter(s => s.subcategory === state.activeSubcategory);
    }
    if (state.search) {
      const term = state.search.toLowerCase();
      collection = collection.filter(shop => {
        return (shop.storename && shop.storename.toString().toLowerCase().includes(term)) ||
          (shop.address && shop.address.toString().toLowerCase().includes(term));
      });
    }
    if (state.sort === 'newest') {
      collection = [...collection].reverse();
    }
    document.getElementById('resultsMeta').textContent = collection.length;
    renderCards(collection);
  }

  function renderCards(shops) {
    const grid = document.getElementById('results-grid');
    if (shops.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full glass text-center py-16">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-500 mb-4">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <p class="text-slate-500 font-bold">هیچ فروشگاهی با این مشخصات پیدا نشد.</p>
        </div>`;
      return;
    }
    grid.innerHTML = shops.map(shop => createCard(shop)).join('');
  }

  function createCard(shop) {
    const imageSrc = resolveShopImage(shop);
    const shopName = shop.storename || 'فروشگاه';
    const address = shop.address || 'آدرس ثبت نشده';
    const badge = shop.subcategory || shop.category || 'عمومی';
    const profileLink = `shop.html?id=${shop.id}`;
    return `
      <article class="category-card">
        <div class="category-card__image">
          <img src="${imageSrc}" loading="lazy" alt="${shopName}" />
          <div class="category-card__badge">${badge}</div>
        </div>
        <div class="category-card__body">
          <h3 class="font-black text-lg text-slate-800 line-clamp-1">${shopName}</h3>
          <div class="flex items-center gap-1 text-xs font-semibold text-slate-500">
            <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            <span class="line-clamp-1">${address}</span>
          </div>
          <a href="${profileLink}" class="category-card__cta">مشاهده پروفایل</a>
        </div>
      </article>
    `;
  }

  function resolveShopImage(shop) {
    let candidate = shop.image || shop.coverImage;

    if (!candidate && Array.isArray(shop.gallery) && shop.gallery.length > 0) {
      candidate = shop.gallery[0];
    }

    if (!candidate && shop.logoUrl) {
      candidate = shop.logoUrl;
    }

    if (!candidate || candidate.trim() === '') {
      const text = encodeURIComponent(shop.storename || 'Shop');
      return `https://placehold.co/600x400/f1f5f9/10b981?text=${text}`;
    }

    if (/^(https?:\/\/|\/|data:image\/)/.test(candidate)) {
      return candidate;
    }

    return `/${candidate.replace(/^\/+/, '')}`;
  }
})();
