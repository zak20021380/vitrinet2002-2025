(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const categoryParam = (urlParams.get('cat') || 'service').toLowerCase();

  const state = {
    category: categoryParam,
    subcategory: 'all',
    viewMode: 'all',
    sort: 'rating',
    rating: 'all',
    search: ''
  };

  const elements = {
    heroTitle: document.getElementById('categoryTitle'),
    heroDescription: document.getElementById('categoryDescription'),
    heroPill: document.getElementById('categoryPill'),
    serviceIntro: document.getElementById('serviceIntro'),
    standardIntro: document.getElementById('standardIntro'),
    serviceFilters: document.getElementById('serviceFilters'),
    standardFilters: document.getElementById('standardFilters'),
    subcategoryChips: document.getElementById('subcategoryChips'),
    viewToggle: document.getElementById('viewToggle'),
    resultsGrid: document.getElementById('results-grid'),
    resultsCount: document.getElementById('resultsCount'),
    resultsContext: document.getElementById('resultsContext'),
    resultsEmpty: document.getElementById('resultsEmpty'),
    viewHint: document.getElementById('viewHint'),
    statShops: document.getElementById('statShops'),
    statPortfolios: document.getElementById('statPortfolios'),
    statFollowers: document.getElementById('statFollowers'),
    resetBtn: document.getElementById('resetFiltersBtn'),
    emptyResetBtn: document.getElementById('emptyResetBtn')
  };

  const categoryCopy = {
    service: {
      pill: 'دسته‌بندی: خدمات',
      title: 'خدمات تخصصی شهر',
      description: 'مرتب‌سازی و مرور حرفه‌ای‌ترین سرویس‌ها و نمونه‌کارهای شهر.'
    },
    beauty: {
      pill: 'دسته‌بندی: زیبایی',
      title: 'سالن‌ها و کلینیک‌های زیبایی',
      description: 'سالن‌های منتخب و سرویس‌های مرتبط با زیبایی و مراقبت شخصی.'
    },
    carwash: {
      pill: 'دسته‌بندی: کارواش',
      title: 'کارواش و دیتیلینگ خودرو',
      description: 'سرویس‌های شستشو و نگهداری خودرو با بهترین امتیازها.'
    },
    gym: {
      pill: 'دسته‌بندی: باشگاه',
      title: 'باشگاه‌ها و مراکز تناسب اندام',
      description: 'برترین باشگاه‌های شهر با برنامه‌های حرفه‌ای.'
    }
  };

  const fallbackSubcategories = [
    { slug: 'gym', name: 'باشگاه' },
    { slug: 'salon', name: 'سالن زیبایی' },
    { slug: 'nail', name: 'ناخنکار' },
    { slug: 'cleaning', name: 'نظافت و خدمات منزل' },
    { slug: 'carpet', name: 'قالیشویی' }
  ];
  let cachedSubcategories = [...fallbackSubcategories];

  const placeholder = (text, startColor, endColor) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360"><defs><linearGradient id="g" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="${startColor}"/><stop offset="100%" stop-color="${endColor}"/></linearGradient></defs><rect width="600" height="360" rx="36" fill="url(#g)"/><text x="50%" y="52%" text-anchor="middle" fill="rgba(255,255,255,0.92)" font-family="Vazirmatn" font-size="42" font-weight="800">${text}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  };

  const fallbackServiceShops = [
    {
      id: 'svc-1',
      name: 'ویترلند فیتنس',
      categoryLabel: 'باشگاه ورزشی',
      subcategory: 'gym',
      rating: 4.8,
      reviews: 142,
      description: 'برنامه‌های تمرینی شخصی‌سازی‌شده با مربیان بین‌المللی و سالن مجهز.',
      followers: 2380,
      bookings: 620,
      portfolioCount: 12,
      cover: placeholder('Vitreenet', '#10b981', '#0ea5e9'),
      createdAt: '2025-01-05'
    },
    {
      id: 'svc-2',
      name: 'استودیو رویال بیوتی',
      categoryLabel: 'سالن زیبایی',
      subcategory: 'salon',
      rating: 4.7,
      reviews: 210,
      description: 'میکاپ آرتیست‌های برجسته و پکیج کامل گریم عروس با آخرین ترندها.',
      followers: 4120,
      bookings: 980,
      portfolioCount: 28,
      cover: placeholder('Royal Beauty', '#f472b6', '#0ea5e9'),
      createdAt: '2025-02-10'
    },
    {
      id: 'svc-3',
      name: 'نگار آرت ناخن',
      categoryLabel: 'ناخنکار حرفه‌ای',
      subcategory: 'nail',
      rating: 4.9,
      reviews: 96,
      description: 'طراحی‌های خاص و خدمات کاشت با ضمانت ماندگاری بالا.',
      followers: 1890,
      bookings: 430,
      portfolioCount: 34,
      cover: placeholder('Nail Art', '#0ea5e9', '#6366f1'),
      createdAt: '2025-02-25'
    },
    {
      id: 'svc-4',
      name: 'پاکان سرویس',
      categoryLabel: 'نظافت و خدمات منزل',
      subcategory: 'cleaning',
      rating: 4.6,
      reviews: 178,
      description: 'نظافت حرفه‌ای با تضمین کیفیت و پشتیبانی آنلاین.',
      followers: 950,
      bookings: 760,
      portfolioCount: 5,
      cover: placeholder('Cleaning', '#34d399', '#0ea5e9'),
      createdAt: '2024-12-17'
    },
    {
      id: 'svc-5',
      name: 'شهر فرش',
      categoryLabel: 'قالیشویی هوشمند',
      subcategory: 'carpet',
      rating: 4.75,
      reviews: 134,
      description: 'دریافت و تحویل ۲۴ ساعته با سیستم خشک‌کن بخار کم‌مصرف.',
      followers: 1430,
      bookings: 520,
      portfolioCount: 8,
      cover: placeholder('Carpet Care', '#0ea5e9', '#14b8a6'),
      createdAt: '2025-01-28'
    }
  ];

  const fallbackServicePortfolios = [
    {
      id: 'prt-1',
      title: 'پروژه فیتنس TransformX',
      shopName: 'ویترلند فیتنس',
      categoryLabel: 'برنامه تمرینی',
      subcategory: 'gym',
      likes: 420,
      views: 5200,
      rating: 4.9,
      cover: placeholder('Workout', '#0ea5e9', '#10b981'),
      createdAt: '2025-02-05'
    },
    {
      id: 'prt-2',
      title: 'ست گریم عروس کلاسیک',
      shopName: 'استودیو رویال بیوتی',
      categoryLabel: 'میکاپ',
      subcategory: 'salon',
      likes: 690,
      views: 8100,
      rating: 4.8,
      cover: placeholder('Bridal', '#ec4899', '#6366f1'),
      createdAt: '2025-02-18'
    },
    {
      id: 'prt-3',
      title: 'طراحی ناخن مرمری',
      shopName: 'نگار آرت ناخن',
      categoryLabel: 'ناخنکار',
      subcategory: 'nail',
      likes: 310,
      views: 4700,
      rating: 4.7,
      cover: placeholder('Marble', '#0ea5e9', '#8b5cf6'),
      createdAt: '2025-02-27'
    },
    {
      id: 'prt-4',
      title: 'پاکسازی مبلمان VIP',
      shopName: 'پاکان سرویس',
      categoryLabel: 'نظافت تخصصی',
      subcategory: 'cleaning',
      likes: 220,
      views: 2800,
      rating: 4.6,
      cover: placeholder('Cleaning', '#14b8a6', '#0ea5e9'),
      createdAt: '2024-12-20'
    }
  ];

  const standardCategoryData = {
    beauty: [
      {
        id: 'beauty-1',
        name: 'سالن گلاره',
        neighborhood: 'بلوار کردستان',
        rating: 4.6,
        reviews: 82,
        description: 'خدمات رنگ و کراتین با مواد ارگانیک و تضمین کیفیت.',
        followers: 1200,
        cover: placeholder('Golara', '#f472b6', '#f97316'),
        createdAt: '2025-01-19'
      },
      {
        id: 'beauty-2',
        name: 'کلینیک مانا',
        neighborhood: 'فرجه',
        rating: 4.8,
        reviews: 64,
        description: 'لیزر و خدمات پوستی با تجهیزات روز دنیا.',
        followers: 1580,
        cover: placeholder('Mana', '#0ea5e9', '#a855f7'),
        createdAt: '2025-02-01'
      },
      {
        id: 'beauty-3',
        name: 'سالن لاوین',
        neighborhood: 'حسن‌آباد',
        rating: 4.5,
        reviews: 44,
        description: 'پکیج میکاپ، شینیون و خدمات ناخن در یک محیط مدرن.',
        followers: 930,
        cover: placeholder('Lavin', '#ec4899', '#0ea5e9'),
        createdAt: '2024-12-09'
      }
    ],
    carwash: [
      {
        id: 'car-1',
        name: 'کارواش آکوآ',
        neighborhood: 'شهرک بهاران',
        rating: 4.4,
        reviews: 51,
        description: 'شست‌وشوی بدون آب و واکس نانو با زمان انتظار کوتاه.',
        followers: 640,
        cover: placeholder('Aqua', '#0ea5e9', '#38bdf8'),
        createdAt: '2024-11-17'
      },
      {
        id: 'car-2',
        name: 'دیتیلینگ نووا',
        neighborhood: 'شورا',
        rating: 4.7,
        reviews: 70,
        description: 'سرامیک بدنه، احیای رنگ و صفرشویی VIP.',
        followers: 980,
        cover: placeholder('Nova', '#0ea5e9', '#10b981'),
        createdAt: '2025-02-14'
      }
    ],
    default: [
      {
        id: 'std-1',
        name: 'سوپرمارکت مرکزی',
        neighborhood: 'نظام وفا',
        rating: 4.5,
        reviews: 105,
        description: 'ارسال فوری و تخفیف‌های روزانه در محصولات تازه.',
        followers: 3200,
        cover: placeholder('Market', '#22d3ee', '#0ea5e9'),
        createdAt: '2024-11-02'
      }
    ]
  };

  const serviceDataCache = {};

  document.addEventListener('DOMContentLoaded', initPage);

  function initPage() {
    applyCategoryCopy();
    bindSharedControls();
    elements.resetBtn?.addEventListener('click', resetFilters);
    elements.emptyResetBtn?.addEventListener('click', resetFilters);

    if (state.category === 'service') {
      showServiceLayout();
      fetchServiceSubcategories()
        .then(renderSubcategoryChips)
        .catch(() => renderSubcategoryChips(fallbackSubcategories))
        .finally(() => {
          updateResults();
          loadServiceShowcase();
        });
    } else {
      showStandardLayout();
      updateResults();
    }
  }

  function applyCategoryCopy() {
    const localized = categoryDisplayName(state.category);
    const copy = categoryCopy[state.category] || {
      pill: `دسته‌بندی: ${localized}`,
      title: `${localized}‌های شهر`,
      description: `لیست فروشگاه‌های مرتبط با ${localized}.`
    };
    if (elements.heroPill) elements.heroPill.textContent = copy.pill;
    if (elements.heroTitle) elements.heroTitle.textContent = copy.title;
    if (elements.heroDescription) elements.heroDescription.textContent = copy.description;
  }

  function bindSharedControls() {
    document.querySelectorAll('[data-filter="search"]').forEach((input) => {
      input.addEventListener('input', (event) => {
        state.search = event.target.value || '';
        updateResults();
      });
    });

    document.querySelectorAll('[data-filter="sort"]').forEach((select) => {
      select.addEventListener('change', (event) => {
        state.sort = event.target.value;
        updateResults();
      });
    });

    document.querySelectorAll('[data-filter="rating"]').forEach((select) => {
      select.addEventListener('change', (event) => {
        state.rating = event.target.value;
        updateResults();
      });
    });

    elements.viewToggle?.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.view;
        if (!mode || state.viewMode === mode) return;
        state.viewMode = mode;
        updateViewToggle();
        updateResults();
      });
    });
    updateViewToggle();
  }

  function showServiceLayout() {
    elements.serviceFilters?.classList.remove('hidden');
    elements.standardFilters?.classList.add('hidden');
    elements.serviceIntro?.classList.remove('hidden');
    elements.standardIntro?.classList.add('hidden');
    elements.viewHint?.classList.remove('hidden');
  }

  function showStandardLayout() {
    elements.standardFilters?.classList.remove('hidden');
    elements.serviceFilters?.classList.add('hidden');
    elements.standardIntro?.classList.remove('hidden');
    elements.serviceIntro?.classList.add('hidden');
    elements.viewHint?.classList.add('hidden');
  }

  async function fetchServiceSubcategories() {
    try {
      const response = await fetch('/api/categories?parent=service');
      if (!response.ok) throw new Error('bad response');
      const payload = await response.json();
      if (Array.isArray(payload) && payload.length) {
        return payload;
      }
      return fallbackSubcategories;
    } catch (error) {
      console.warn('service subcategories fallback', error);
      return fallbackSubcategories;
    }
  }

  function renderSubcategoryChips(subcategories) {
    if (!elements.subcategoryChips) return;
    cachedSubcategories = subcategories && subcategories.length ? subcategories : fallbackSubcategories;
    elements.subcategoryChips.innerHTML = '';
    const items = [{ slug: 'all', name: 'همه خدمات' }, ...cachedSubcategories];
    items.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.name;
      button.className = 'filter-chip';
      button.dataset.slug = item.slug;
      if (state.subcategory === item.slug) button.classList.add('active');
      button.addEventListener('click', () => {
        state.subcategory = item.slug;
        updateChipActiveState();
        loadServiceShowcase();
      });
      elements.subcategoryChips.appendChild(button);
    });
    updateChipActiveState();
  }

  function updateChipActiveState() {
    if (!elements.subcategoryChips) return;
    elements.subcategoryChips.querySelectorAll('.filter-chip').forEach((chip) => {
      const slug = chip.dataset.slug || 'all';
      chip.classList.toggle('active', slug === state.subcategory);
    });
  }

  function loadServiceShowcase() {
    const cacheKey = state.subcategory;
    if (serviceDataCache[cacheKey]) {
      updateResults();
      return;
    }
    const params = new URLSearchParams({ category: 'service' });
    if (state.subcategory && state.subcategory !== 'all') {
      params.set('subcategory', state.subcategory);
    }
    const endpoint = `/api/service-shops/showcase?${params.toString()}`;
    fetch(endpoint)
      .then((response) => {
        if (!response.ok) throw new Error('bad showcase response');
        return response.json();
      })
      .then((payload) => {
        serviceDataCache[cacheKey] = normalizeShowcasePayload(payload);
        updateResults();
      })
      .catch((error) => {
        console.warn('showcase fallback', error);
        serviceDataCache[cacheKey] = buildFallbackShowcase(cacheKey);
        updateResults();
      });
  }

  function normalizeShowcasePayload(payload = {}) {
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      portfolios: Array.isArray(payload.portfolios) ? payload.portfolios : []
    };
  }

  function buildFallbackShowcase(subcategory) {
    const slug = !subcategory || subcategory === 'all' ? null : subcategory;
    const shops = fallbackServiceShops.filter((shop) => (slug ? shop.subcategory === slug : true));
    const portfolios = fallbackServicePortfolios.filter((portfolio) => (slug ? portfolio.subcategory === slug : true));
    return { items: shops, portfolios };
  }

  function getStandardDataset() {
    return standardCategoryData[state.category] || standardCategoryData.default;
  }

  function updateResults() {
    if (!elements.resultsGrid) return;
    let cardsHTML = '';
    let summary = { shops: 0, portfolios: 0, followers: 0 };

    if (state.category === 'service') {
      const dataset = serviceDataCache[state.subcategory] || buildFallbackShowcase(state.subcategory);
      const threshold = parseFloat(state.rating) || null;
      const search = state.search.trim().toLowerCase();
      let shops = dataset.items || [];
      let portfolios = dataset.portfolios || [];
      if (threshold) {
        shops = shops.filter((shop) => Number(shop.rating || 0) >= threshold);
        portfolios = portfolios.filter((portfolio) => Number(portfolio.rating || 0) >= threshold);
      }
      if (search) {
        shops = shops.filter((shop) => includesText(shop.name, search) || includesText(shop.description, search));
        portfolios = portfolios.filter((portfolio) => includesText(portfolio.title, search) || includesText(portfolio.shopName, search));
      }
      shops = sortShops(shops);
      portfolios = sortPortfolios(portfolios);
      const renderResult = renderServiceCards(shops, portfolios);
      cardsHTML = renderResult.html;
      summary = renderResult.summary;
      elements.viewHint?.classList.remove('hidden');
    } else {
      const threshold = parseFloat(state.rating) || null;
      const search = state.search.trim().toLowerCase();
      let shops = [...getStandardDataset()];
      if (threshold) {
        shops = shops.filter((shop) => Number(shop.rating || 0) >= threshold);
      }
      if (search) {
        shops = shops.filter((shop) => includesText(shop.name, search) || includesText(shop.neighborhood, search) || includesText(shop.description, search));
      }
      shops = sortShops(shops);
      const renderResult = renderStandardCards(shops);
      cardsHTML = renderResult.html;
      summary = renderResult.summary;
      elements.viewHint?.classList.add('hidden');
    }

    renderCards(cardsHTML);
    const isEmpty = summary.shops + summary.portfolios === 0;
    elements.resultsEmpty?.classList.toggle('hidden', !isEmpty);
    elements.resultsCount.textContent = `${formatNumber(summary.shops + summary.portfolios)} نتیجه`;
    if (state.category === 'service') {
      elements.resultsContext.textContent = `(${formatNumber(summary.shops)} مغازه، ${formatNumber(summary.portfolios)} نمونه‌کار)`;
    } else {
      elements.resultsContext.textContent = `فروشگاه‌های ${categoryDisplayName(state.category)}`;
    }
    updateStats(summary);
  }

  function renderServiceCards(shops, portfolios) {
    let html = '';
    let shopsCount = 0;
    let portfolioCount = 0;
    let followers = 0;
    if (state.viewMode === 'all' || state.viewMode === 'shops') {
      shops.forEach((shop) => {
        followers += Number(shop.followers || 0);
        shopsCount += 1;
        html += createServiceShopCard(shop);
      });
    }
    if (state.viewMode === 'all' || state.viewMode === 'portfolios') {
      portfolios.forEach((portfolio) => {
        portfolioCount += 1;
        html += createPortfolioCard(portfolio);
      });
    }
    return {
      html,
      summary: {
        shops: shopsCount,
        portfolios: portfolioCount,
        followers
      }
    };
  }

  function renderStandardCards(shops) {
    let html = '';
    let followers = 0;
    shops.forEach((shop) => {
      followers += Number(shop.followers || 0);
      html += createStandardCard(shop);
    });
    return {
      html,
      summary: {
        shops: shops.length,
        portfolios: 0,
        followers
      }
    };
  }

  function createServiceShopCard(shop) {
    const rating = Number(shop.rating || 0).toFixed(1);
    const reviews = formatNumber(shop.reviews || 0);
    const followers = formatNumber(shop.followers || 0);
    const bookings = formatNumber(shop.bookings || 0);
    const portfolioCount = formatNumber(shop.portfolioCount || 0);
    const cover = shop.cover || placeholder(shop.name || 'Service', '#10b981', '#0ea5e9');
    return `
      <article class="service-card" data-type="shop">
        <div class="service-card__cover">
          <img src="${cover}" alt="${shop.name}" loading="lazy" />
        </div>
        <div class="service-card__body">
          <span class="category-badge">${shop.categoryLabel || ''}</span>
          <h3 class="card-title">${shop.name}</h3>
          <div class="rating-pill">⭐ ${rating} · ${reviews} نظر</div>
          <p class="card-description">${shop.description || ''}</p>
          <div class="service-stats">
            <span>👥 ${followers} دنبال‌کننده</span>
            <span>📅 ${bookings} رزرو</span>
            <span>🎨 ${portfolioCount} نمونه‌کار</span>
          </div>
          <div class="card-actions">
            <a class="btn-grad" href="#" aria-label="مشاهده پروفایل ${shop.name}">مشاهده پروفایل</a>
          </div>
        </div>
      </article>
    `;
  }

  function createPortfolioCard(portfolio) {
    const likes = formatNumber(portfolio.likes || 0);
    const views = formatNumber(portfolio.views || 0);
    const cover = portfolio.cover || placeholder(portfolio.title || 'Portfolio', '#0ea5e9', '#10b981');
    return `
      <article class="portfolio-card" data-type="portfolio">
        <div class="portfolio-card__cover">
          <img src="${cover}" alt="${portfolio.title}" loading="lazy" />
        </div>
        <div class="portfolio-card__body">
          <span class="category-badge">${portfolio.categoryLabel || ''}</span>
          <h3 class="card-title">${portfolio.title}</h3>
          <p class="card-description">${portfolio.shopName || ''}</p>
          <div class="portfolio-stats">
            <span>❤️ ${likes}</span>
            <span>👁️ ${views}</span>
          </div>
          <div class="card-actions">
            <a class="btn-grad" href="#" aria-label="مشاهده دقیق‌تر ${portfolio.title}">مشاهده دقیق‌تر</a>
          </div>
        </div>
      </article>
    `;
  }

  function createStandardCard(shop) {
    const rating = Number(shop.rating || 0).toFixed(1);
    const reviews = formatNumber(shop.reviews || 0);
    const followers = formatNumber(shop.followers || 0);
    const cover = shop.cover || placeholder(shop.name || 'Shop', '#10b981', '#0ea5e9');
    return `
      <article class="standard-card">
        <div class="standard-card__cover">
          <img src="${cover}" alt="${shop.name}" loading="lazy" />
        </div>
        <div class="standard-card__body">
          <h3 class="card-title">${shop.name}</h3>
          <div class="rating-pill">⭐ ${rating} · ${reviews} نظر</div>
          <p class="card-description">${shop.description || ''}</p>
          <div class="standard-stats">
            <span>📍 ${shop.neighborhood || ''}</span>
            <span>👥 ${followers}</span>
          </div>
          <div class="card-actions">
            <a class="btn-grad" href="#" aria-label="مشاهده فروشگاه ${shop.name}">ورود به صفحه</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderCards(cardsHTML) {
    if (!elements.resultsGrid) return;
    elements.resultsGrid.innerHTML = '';
    const temp = document.createElement('div');
    temp.innerHTML = (cardsHTML || '').trim();
    while (temp.firstChild) {
      elements.resultsGrid.appendChild(temp.firstChild);
    }
  }

  function resetFilters() {
    state.search = '';
    state.sort = 'rating';
    state.rating = 'all';
    state.viewMode = 'all';
    state.subcategory = 'all';
    syncControls();
    if (state.category === 'service') {
      if (!serviceDataCache.all) {
        serviceDataCache.all = buildFallbackShowcase('all');
      }
      updateViewToggle();
      renderSubcategoryChips(cachedSubcategories.length ? cachedSubcategories : fallbackSubcategories);
      updateResults();
      loadServiceShowcase();
    } else {
      updateResults();
    }
  }

  function syncControls() {
    document.querySelectorAll('[data-filter="search"]').forEach((input) => {
      input.value = state.search;
    });
    document.querySelectorAll('[data-filter="sort"]').forEach((select) => {
      select.value = state.sort;
    });
    document.querySelectorAll('[data-filter="rating"]').forEach((select) => {
      select.value = state.rating;
    });
    updateViewToggle();
    updateChipActiveState();
  }

  function updateViewToggle() {
    elements.viewToggle?.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === state.viewMode);
    });
  }

  function sortShops(shops) {
    const list = [...shops];
    switch (state.sort) {
      case 'popular':
        return list.sort((a, b) => (Number(b.followers || 0) + Number(b.bookings || 0)) - (Number(a.followers || 0) + Number(a.bookings || 0)));
      case 'newest':
        return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      case 'rating':
      default:
        return list.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    }
  }

  function sortPortfolios(portfolios) {
    const list = [...portfolios];
    switch (state.sort) {
      case 'popular':
        return list.sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0));
      case 'newest':
        return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      case 'rating':
      default:
        return list.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    }
  }

  function updateStats(summary) {
    if (!summary) return;
    if (elements.statShops) elements.statShops.textContent = formatNumber(summary.shops);
    if (elements.statPortfolios) elements.statPortfolios.textContent = formatNumber(summary.portfolios);
    if (elements.statFollowers) elements.statFollowers.textContent = formatNumber(summary.followers);
  }

  function includesText(value, query) {
    if (!value) return false;
    return value.toString().toLowerCase().includes(query);
  }

  function formatNumber(value) {
    const number = Number(value) || 0;
    return number.toLocaleString('fa-IR');
  }

  function categoryDisplayName(slug) {
    const map = {
      service: 'خدمات',
      beauty: 'زیبایی',
      carwash: 'کارواش',
      gym: 'باشگاه'
    };
    return map[slug] || slug;
  }
})();
