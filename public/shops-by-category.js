(function () {
  const categoryParam = new URLSearchParams(window.location.search).get('cat') || 'general';
  const DEFAULT_SERVICE_CATEGORY_NAME = 'خدمات';
  const FALLBACK_SERVICE_SUBCATEGORIES = [
    { slug: 'gym', name: 'باشگاه' },
    { slug: 'decor', name: 'دکوراسیون' },
    { slug: 'repair', name: 'تعمیرات' },
  ];

  const state = {
    category: categoryParam,
    search: '',
    sort: 'popular',
    rating: 'all',
    subcategory: 'all',
    serviceCategoryName: DEFAULT_SERVICE_CATEGORY_NAME,
    serviceCategorySlug: 'service',
    serviceSubcategoryMap: new Map(),
    serviceData: { items: [], portfolios: [] },
    standardData: getStandardFallbackData(),
  };

  const slugifyClient = (value = '') => {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9\u0600-\u06FF-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const texts = {
    service: {
      badge: 'خدمات شهری',
      title: 'کسب‌وکارهای خدماتی سنندج',
      subtitle: 'لیست کامل مغازه‌های خدماتی همراه با تصویر و اطلاعات دقیق.',
      results: 'لیست مغازه‌های خدماتی',
    },
  };

  document.addEventListener('DOMContentLoaded', async () => {
    hydrateHero();
    if (state.category === 'service') {
      const serviceCategoryData = await fetchServiceCategoryData();
      state.serviceCategoryName = serviceCategoryData.categoryName || DEFAULT_SERVICE_CATEGORY_NAME;
      state.serviceCategorySlug = serviceCategoryData.categorySlug || slugifyClient(state.serviceCategoryName);
      state.serviceSubcategoryMap = new Map(
        serviceCategoryData.subcategories.map((item) => [item.slug, item])
      );
      renderServiceFilters(serviceCategoryData.subcategories);
      attachServiceFilterEvents();
      await loadServiceContent();
    } else {
      renderStandardFilters();
      attachStandardFilterEvents();
      applyStandardFilters();
    }
  });

  function hydrateHero() {
    const badge = document.getElementById('categoryBadge');
    const title = document.getElementById('categoryTitle');
    const subtitle = document.getElementById('categorySubtitle');
    const resultsTitle = document.getElementById('resultsTitle');

    if (state.category === 'service') {
      badge.textContent = texts.service.badge;
      title.textContent = texts.service.title;
      subtitle.textContent = texts.service.subtitle;
      resultsTitle.textContent = texts.service.results;
      document.title = 'خدمات شهری | ویترینت';
    } else {
      const formatted = formatCategory(state.category);
      badge.textContent = formatted.badge;
      title.textContent = formatted.title;
      subtitle.textContent = formatted.subtitle;
      resultsTitle.textContent = formatted.results;
      document.title = `${formatted.title} | ویترینت`;
    }
  }

  function formatCategory(slug) {
    const label = slug && slug !== 'general' ? slug : 'محلی';
    const readable = label.replace(/-/g, ' ');
    const title = `مغازه‌های ${readable}`;
    return {
      badge: `دسته ${readable}`,
      title,
      subtitle: 'لیست فروشگاه‌ها و مراکز منتخب این دسته.',
      results: `فروشگاه‌های ${readable}`,
    };
  }

  async function fetchServiceCategoryData() {
    try {
      const response = await fetch('/api/categories');
      if (!response.ok) throw new Error('categories failed');
      const data = await response.json();
      const serviceSubcategories = Array.isArray(data?.serviceSubcategories)
        ? data.serviceSubcategories
        : [];

      const normalisedSubs = serviceSubcategories
        .map((item) => ({
          id: item.id || item._id,
          name: item.name,
          parentName: item.parentName || '',
          slug: slugifyClient(item.slug || item.name),
        }))
        .filter((item) => item.name && item.slug);

      const resolvedParentName = normalisedSubs.find((sub) => sub.parentName)?.parentName
        || (Array.isArray(data?.categories)
          ? (data.categories.find((cat) => slugifyClient(cat.slug || cat.name) === slugifyClient(DEFAULT_SERVICE_CATEGORY_NAME))?.name
            || data.categories.find((cat) => cat.name?.includes('خدمات'))?.name)
          : null)
        || DEFAULT_SERVICE_CATEGORY_NAME;

      return {
        subcategories: normalisedSubs,
        categoryName: resolvedParentName,
        categorySlug: slugifyClient(resolvedParentName),
      };
    } catch (error) {
      console.warn('Failed to load service subcategories, using fallback.', error);
      return {
        subcategories: FALLBACK_SERVICE_SUBCATEGORIES,
        categoryName: DEFAULT_SERVICE_CATEGORY_NAME,
        categorySlug: slugifyClient(DEFAULT_SERVICE_CATEGORY_NAME),
      };
    }
  }

  function renderServiceFilters(subcategories) {
    const wrapper = document.getElementById('filtersWrapper');
    if (!wrapper) return;

    wrapper.innerHTML = `
      <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <label for="searchInput">جستجو در مغازه‌ها</label>
          <input type="text" id="searchInput" placeholder="نام مغازه، تگ یا محله..." autocomplete="off" />
        </div>
        <div>
          <label for="sortSelect">مرتب‌سازی</label>
          <select id="sortSelect">
            <option value="popular">محبوب‌ترین</option>
            <option value="rating_desc">بیشترین امتیاز</option>
            <option value="newest">جدیدترین</option>
          </select>
        </div>
        <div>
          <label for="ratingSelect">حداقل امتیاز</label>
          <select id="ratingSelect">
            <option value="all">بدون فیلتر</option>
            <option value="4">۴ ستاره به بالا</option>
            <option value="3">۳ ستاره به بالا</option>
          </select>
        </div>
      </div>
      <div class="mt-6">
        <p class="text-xs font-black text-slate-500 tracking-wide uppercase">زیردسته‌ها</p>
        <div class="flex flex-wrap gap-3 mt-3" id="subcategoryChips"></div>
      </div>
    `;

    const chipsContainer = document.getElementById('subcategoryChips');
    chipsContainer.innerHTML = '';
    const uniqueSubs = [];
    const seenSubs = new Set();
    subcategories.forEach((item) => {
      const slug = item.slug || slugifyClient(item.name);
      if (!slug || seenSubs.has(slug)) return;
      seenSubs.add(slug);
      uniqueSubs.push({ slug, name: item.name || slug });
    });

    uniqueSubs.sort((a, b) => a.name.localeCompare(b.name, 'fa')); 

    const list = [{ slug: 'all', name: 'همه' }, ...uniqueSubs];
    list.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `filter-chip${state.subcategory === item.slug ? ' active' : ''}`;
      button.dataset.slug = item.slug;
      button.textContent = item.name;
      chipsContainer.appendChild(button);
    });
  }

  function attachServiceFilterEvents() {
    const wrapper = document.getElementById('filtersWrapper');
    if (!wrapper) return;

    const searchInput = wrapper.querySelector('#searchInput');
    const sortSelect = wrapper.querySelector('#sortSelect');
    const ratingSelect = wrapper.querySelector('#ratingSelect');
    const chipsContainer = wrapper.querySelector('#subcategoryChips');

    searchInput.addEventListener('input', (event) => {
      state.search = event.target.value.trim();
      scheduleServiceFilter();
    });

    sortSelect.addEventListener('change', (event) => {
      state.sort = event.target.value;
      applyServiceFilters();
    });

    ratingSelect.addEventListener('change', (event) => {
      state.rating = event.target.value;
      applyServiceFilters();
    });

    chipsContainer.addEventListener('click', async (event) => {
      if (event.target.matches('button[data-slug]')) {
        const selected = event.target.dataset.slug;
        if (selected === state.subcategory) return;
        state.subcategory = selected;
        chipsContainer.querySelectorAll('button').forEach((btn) => btn.classList.toggle('active', btn === event.target));
        await loadServiceContent();
      }
    });

  }

  let serviceFilterTimeout;
  function scheduleServiceFilter() {
    clearTimeout(serviceFilterTimeout);
    serviceFilterTimeout = setTimeout(applyServiceFilters, 200);
  }

  async function loadServiceContent() {
    setResultsMeta('در حال بارگذاری...');
    showLoadingState();
    state.serviceData = await fetchServiceShowcase();
    applyServiceFilters();
  }

  async function fetchServiceShowcase() {
    const params = new URLSearchParams();
    const selectedSubcategory = state.subcategory && state.subcategory !== 'all'
      ? state.subcategory
      : '';

    const categorySlug = selectedSubcategory || state.serviceCategorySlug || slugifyClient(state.category);
    if (categorySlug) {
      params.append('category', categorySlug);
    }

    const categoryName = selectedSubcategory
      ? (state.serviceSubcategoryMap.get(selectedSubcategory)?.name || selectedSubcategory.replace(/-/g, ' '))
      : state.serviceCategoryName;
    if (categoryName) {
      params.append('categoryName', categoryName);
    }

    try {
      const response = await fetch(`/api/service-shops/showcase?${params.toString()}`);
      if (!response.ok) throw new Error('service showcase failed');
      const data = await response.json();
      return {
        items: Array.isArray(data.items) ? data.items : [],
        portfolios: Array.isArray(data.portfolios) ? data.portfolios : [],
      };
    } catch (error) {
      console.warn('Failed to load service showcase, using fallback.', error);
      return getServiceFallback(state.subcategory);
    }
  }

  function applyServiceFilters() {
    const { items } = state.serviceData;
    if (!Array.isArray(items)) {
      showEmptyState('اطلاعاتی برای نمایش وجود ندارد.');
      return;
    }

    let filteredShops = [...items];

    if (state.search) {
      const term = state.search.toLowerCase();
      filteredShops = filteredShops.filter((shop) => {
        return [shop.name, shop.address, ...(shop.tags || [])]
          .filter(Boolean)
          .some((field) => field.toString().toLowerCase().includes(term));
      });
    }

    if (state.rating !== 'all') {
      const threshold = Number(state.rating);
      filteredShops = filteredShops.filter((shop) => Number(shop.rating || 0) >= threshold);
    }

    filteredShops = sortCollection(filteredShops, state.sort);

    if (!filteredShops.length) {
      showEmptyState('هیچ موردی مطابق فیلترها پیدا نشد.');
      setResultsMeta('بدون نتیجه');
      return;
    }

    const cards = filteredShops.map((shop) => createShopCard(shop).trim());
    renderCards(cards.join(''));
    setResultsMeta(`${filteredShops.length} مغازه`);
  }

  function renderStandardFilters() {
    const wrapper = document.getElementById('filtersWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = `
      <div class="grid gap-5 md:grid-cols-3">
        <div class="md:col-span-1">
          <label for="searchInput">جستجوی سریع</label>
          <input type="text" id="searchInput" placeholder="نام مغازه یا محله..." autocomplete="off" />
        </div>
        <div>
          <label for="sortSelect">مرتب‌سازی</label>
          <select id="sortSelect">
            <option value="popular">محبوب‌ترین</option>
            <option value="rating_desc">بیشترین امتیاز</option>
            <option value="newest">جدیدترین</option>
          </select>
        </div>
        <div>
          <label for="ratingSelect">حداقل امتیاز</label>
          <select id="ratingSelect">
            <option value="all">بدون فیلتر</option>
            <option value="4">۴ ستاره به بالا</option>
            <option value="3">۳ ستاره به بالا</option>
          </select>
        </div>
      </div>
    `;
  }

  function attachStandardFilterEvents() {
    const wrapper = document.getElementById('filtersWrapper');
    if (!wrapper) return;
    const searchInput = wrapper.querySelector('#searchInput');
    const sortSelect = wrapper.querySelector('#sortSelect');
    const ratingSelect = wrapper.querySelector('#ratingSelect');

    searchInput.addEventListener('input', (event) => {
      state.search = event.target.value.trim();
      scheduleStandardFilter();
    });

    sortSelect.addEventListener('change', (event) => {
      state.sort = event.target.value;
      applyStandardFilters();
    });

    ratingSelect.addEventListener('change', (event) => {
      state.rating = event.target.value;
      applyStandardFilters();
    });
  }

  let standardFilterTimeout;
  function scheduleStandardFilter() {
    clearTimeout(standardFilterTimeout);
    standardFilterTimeout = setTimeout(applyStandardFilters, 200);
  }

  function applyStandardFilters() {
    let collection = [...state.standardData];

    if (state.category && state.category !== 'general') {
      collection = collection.filter((item) => item.category === state.category || !item.category);
    }

    if (state.search) {
      const term = state.search.toLowerCase();
      collection = collection.filter((shop) => {
        return [shop.name, shop.address, ...(shop.tags || [])]
          .filter(Boolean)
          .some((field) => field.toString().toLowerCase().includes(term));
      });
    }

    if (state.rating !== 'all') {
      const threshold = Number(state.rating);
      collection = collection.filter((shop) => Number(shop.rating || 0) >= threshold);
    }

    collection = sortCollection(collection, state.sort);

    if (!collection.length) {
      showEmptyState('فروشی مطابق جستجو پیدا نشد.');
      setResultsMeta('بدون نتیجه');
      return;
    }

    const cards = collection.map((shop) => createShopCard(shop).trim());
    renderCards(cards.join(''));
    setResultsMeta(`${collection.length} مغازه`);
  }

  function sortCollection(collection, mode) {
    const arr = [...collection];
    switch (mode) {
      case 'rating_desc':
        return arr.sort((a, b) => (Number(b.rating || 0) - Number(a.rating || 0)));
      case 'newest':
        return arr.sort((a, b) => (new Date(b.updatedAt || Date.now()) - new Date(a.updatedAt || Date.now())));
      default:
        return arr;
    }
  }

  function createShopCard(shop) {
    const rating = Number(shop.rating || 0).toFixed(1);
    const address = shop.address || 'آدرس ثبت نشده';
    const phone = shop.phone || 'شماره ثبت نشده';
    const tags = (shop.tags || []).slice(0, 3).map((tag) => `<span class="card-badge bg-emerald-50 text-emerald-600">${tag}</span>`).join('');
    const imageSrc = resolveShopImage(shop);
    const altText = shop.name ? `نمایی از ${shop.name}` : 'تصویر مغازه';
    return `<article class="card-shell" data-type="shop">
      <div class="shop-card-image">
        <img src="${imageSrc}" alt="${altText}" loading="lazy" decoding="async" />
      </div>
      <div class="flex items-center justify-between">
        <span class="card-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"></path></svg>
          مغازه خدماتی
        </span>
        <span class="card-meta">
          ⭐ ${rating}
        </span>
      </div>
      <h3 class="card-title">${shop.name}</h3>
      <p class="text-sm text-slate-500 font-semibold leading-relaxed">${address}</p>
      <p class="text-sm text-slate-500 font-semibold">${phone}</p>
      <div class="flex flex-wrap gap-2">${tags}</div>
      <div class="card-actions mt-auto">
        <a href="shop.html?id=${encodeURIComponent(shop.id || shop.slug || shop.name)}">مشاهده پروفایل</a>
      </div>
    </article>`;
  }

  function resolveShopImage(shop) {
    const candidate = shop?.coverImage
      || shop?.image
      || (Array.isArray(shop?.gallery) ? shop.gallery[0] : null)
      || (Array.isArray(shop?.portfolioPreview) && shop.portfolioPreview[0]?.image)
      || 'assets/images/shop-placeholder.svg';
    if (!candidate) {
      return 'assets/images/shop-placeholder.svg';
    }
    if (/^(https?:|data:|\/\/)/i.test(candidate)) {
      return candidate;
    }
    if (candidate.startsWith('/')) {
      return candidate;
    }
    return `/${candidate.replace(/^\/+/, '')}`;
  }

  function renderCards(cardsHTML) {
    const grid = document.getElementById('results-grid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!cardsHTML) return;
    const temp = document.createElement('div');
    temp.innerHTML = cardsHTML;
    while (temp.firstChild) {
      grid.appendChild(temp.firstChild);
    }
  }

  function showLoadingState() {
    renderCards(`<div class="loading-state card-shell">در حال بارگذاری...</div>`);
  }

  function showEmptyState(message) {
    renderCards(`<div class="empty-state card-shell">${message}</div>`);
  }

  function setResultsMeta(text) {
    const el = document.getElementById('resultsMeta');
    if (el) {
      el.textContent = text;
    }
  }

  function getServiceFallback(selectedSubcategory) {
    const allItems = [
      {
        id: 'srv-1',
        name: 'باشگاه موج سبز',
        address: 'سنندج، خیابان شاپور جدید، روبروی پارک دیدگاه',
        phone: '087-3123456',
        rating: 4.8,
        tags: ['برنامه بدنسازی', 'مشاوره تغذیه'],
        subcategory: 'gym',
        updatedAt: '2025-01-15',
        coverImage: 'assets/images/shop-placeholder.svg',
      },
      {
        id: 'srv-2',
        name: 'کارگاه دکوراسیون چوب آرا',
        address: 'سنندج، بلوار آزادی، نبش کوچه ۲۳',
        phone: '0918-2223456',
        rating: 4.6,
        tags: ['طراحی سه‌بعدی', 'اجرای سریع'],
        subcategory: 'decor',
        updatedAt: '2025-02-01',
        coverImage: 'assets/images/shop-placeholder.svg',
      },
      {
        id: 'srv-3',
        name: 'تعمیرات لوازم خانگی آریا',
        address: 'سنندج، میدان فردوسی، پاساژ آریا',
        phone: '087-3344556',
        rating: 4.2,
        tags: ['خدمات در محل', 'گارانتی سه‌ماهه'],
        subcategory: 'repair',
        updatedAt: '2025-02-12',
        coverImage: 'assets/images/shop-placeholder.svg',
      },
    ];

    const allPortfolios = [
      {
        id: 'prt-1',
        title: 'طراحی باشگاه ویژه بانوان',
        shopName: 'استودیو انرژی مثبت',
        shopId: 'srv-2',
        rating: 4.9,
        previewText: 'بازسازی کامل + نورپردازی هوشمند',
        tags: ['طراحی داخلی', 'نورپردازی'],
        subcategory: 'decor',
        updatedAt: '2025-01-10',
      },
      {
        id: 'prt-2',
        title: 'نمونه تعمیر یخچال اسمگ',
        shopName: 'تعمیرات آریا',
        shopId: 'srv-3',
        rating: 4.5,
        previewText: 'عیب‌یابی و تعویض برد اصلی در محل مشتری',
        tags: ['تعمیر تخصصی', 'گارانتی'],
        subcategory: 'repair',
        updatedAt: '2025-02-08',
      },
    ];

    const filterBySubcategory = (collection) => {
      if (!selectedSubcategory || selectedSubcategory === 'all') return collection;
      const selectedSlug = slugifyClient(selectedSubcategory);
      return collection.filter((item) => slugifyClient(item.subcategory) === selectedSlug);
    };

    return {
      items: filterBySubcategory(allItems),
      portfolios: filterBySubcategory(allPortfolios),
    };
  }

  function getStandardFallbackData() {
    return [
      {
        id: 'std-1',
        name: 'سوپرمارکت امید',
        address: 'سنندج، محله پارک آبیدر، کوچه سرو',
        phone: '087-3123123',
        rating: 4.7,
        tags: ['تحویل سریع', 'محصولات تازه'],
        category: 'grocery',
        updatedAt: '2025-02-11',
      },
      {
        id: 'std-2',
        name: 'آرایشگاه مردانه آریاس',
        address: 'سنندج، خیابان کشاورز، پاساژ نگین',
        phone: '0918-1239876',
        rating: 4.4,
        tags: ['گریم عروس', 'پکیج ویژه'],
        category: 'beauty',
        updatedAt: '2025-02-03',
      },
      {
        id: 'std-3',
        name: 'کارواش موج آبی',
        address: 'سنندج، خروجی جاده همدان، کنارگذر غربی',
        phone: '087-3310202',
        rating: 4.1,
        tags: ['واکس بدنه', 'کارواش نانو'],
        category: 'carwash',
        updatedAt: '2025-01-26',
      },
      {
        id: 'std-4',
        name: 'بوتیک رویال',
        address: 'سنندج، پاساژ کوروش، طبقه ۲',
        phone: '087-3334455',
        rating: 4.6,
        tags: ['لباس مجلسی', 'فروش آنلاین'],
        category: 'fashion',
        updatedAt: '2025-02-09',
      },
    ];
  }
})();
