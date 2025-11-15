function slugify(value = '') {
  return value
    .toString()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[‌‏‪-‮]/g, '')
    .toLowerCase();
}

function normaliseText(value = '') {
  return value.toString().replace(/\s+/g, ' ').trim();
}

function normaliseCategoryItem(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    const name = normaliseText(item);
    if (!name) return null;
    return { name, slug: slugify(name), parentName: '' };
  }

  const rawName = item.name || item.title || item.label || '';
  const name = normaliseText(rawName);
  if (!name) return null;

  const rawSlug = item.slug || '';
  const slug = normaliseText(rawSlug) || slugify(name);

  const rawParent = item.parentName
    || (item.parentCategory && (item.parentCategory.name || item.parentCategory.title))
    || '';
  const parentName = normaliseText(rawParent);

  return { name, slug, parentName };
}

function normaliseCategoryList(list = []) {
  const unique = new Map();
  list.forEach(entry => {
    const record = normaliseCategoryItem(entry);
    if (!record || !record.slug) return;
    if (!unique.has(record.slug)) {
      unique.set(record.slug, record);
    }
  });
  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, 'fa-IR', { sensitivity: 'base' }));
}

function cloneCategoryList(list = []) {
  return Array.isArray(list) ? list.map(item => ({ ...item })) : [];
}

function debounce(fn, delay = 250) {
  let timer = null;
  return (...args) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn.apply(null, args), delay);
  };
}

const API_ORIGIN = window.location.origin.includes('localhost') ? 'http://localhost:5000' : window.location.origin;
const CATEGORY_API_URL = `${API_ORIGIN}/api/categories`;
const SHOWCASE_API_URL = `${API_ORIGIN}/api/service-shops/showcase`;

const categoryState = {
  serviceSubcategories: [],
  lookup: {},
  authoritative: []
};

const defaultCategoryContent = {
  title: 'مراکز خدماتی برتر سنندج',
  subtitle: 'بهترین سالن‌های زیبایی، کارواش‌ها و ارائه‌دهندگان خدمات شهری با امکان رزرو آنلاین، مشاهده نظرات کاربران و مقایسه قیمت.',
  resultsSubtitle: 'مراکز ارائه‌دهنده خدمات مطابق با معیارهای شما',
  pageTitle: 'مراکز خدماتی شهر | Vitreenet'
};

const state = {
  category: 'all',
  sort: 'best',
  minRating: 0,
  search: '',
  items: [],
  portfolios: [],
  portfolioCategory: 'all',
  portfolioSort: 'likes',
  viewMode: 'all',
  visiblePortfolioCount: 0,
  meta: { categories: [] },
  loading: false
};

const elements = {
  pageTitle: document.getElementById('page-title'),
  heroTitle: document.getElementById('hero-title'),
  heroSubtitle: document.getElementById('hero-subtitle'),
  resultsSubtitle: document.getElementById('results-subtitle'),
  resultsGrid: document.getElementById('results-grid'),
  resultsCount: document.getElementById('results-count'),
  statsCount: document.getElementById('stats-count'),
  statsRating: document.getElementById('stats-rating'),
  emptyState: document.getElementById('empty-state'),
  resetFilters: document.getElementById('reset-filters'),
  searchInput: document.getElementById('search-input'),
  categorySelect: document.getElementById('category-select'),
  sortSelect: document.getElementById('sort-select'),
  ratingSelect: document.getElementById('rating-select'),
  resultsLoading: document.getElementById('results-loading'),
  portfolioGrid: document.getElementById('portfolio-grid'),
  portfolioEmpty: document.getElementById('portfolio-empty'),
  portfolioChips: document.getElementById('portfolio-chip-container'),
  portfolioSortContainer: document.getElementById('portfolio-sort-container'),
  viewModeToggle: document.getElementById('view-mode-toggle'),
  shopsContent: document.getElementById('shops-content'),
  portfolioSection: document.getElementById('portfolio-section'),
  portfolioModal: document.getElementById('portfolio-modal'),
  portfolioModalImage: document.getElementById('portfolio-modal-image'),
  portfolioModalTitle: document.getElementById('portfolio-modal-title'),
  portfolioModalShop: document.getElementById('portfolio-modal-shop'),
  portfolioModalDescription: document.getElementById('portfolio-modal-description'),
  portfolioModalRating: document.getElementById('portfolio-modal-rating'),
  portfolioModalCategory: document.getElementById('portfolio-modal-category'),
  portfolioModalLikes: document.getElementById('portfolio-modal-likes'),
  portfolioModalViews: document.getElementById('portfolio-modal-views'),
  portfolioModalLink: document.getElementById('portfolio-modal-link')
};

function setCategoryState(list = [], options = {}) {
  categoryState.serviceSubcategories = cloneCategoryList(list);
  categoryState.lookup = categoryState.serviceSubcategories.reduce((acc, item) => {
    if (item.slug) acc[item.slug] = { ...item };
    return acc;
  }, {});
  if (options.updateAuthoritative) {
    categoryState.authoritative = cloneCategoryList(categoryState.serviceSubcategories);
  }
}

function populateCategoryOptions(list = []) {
  if (!elements.categorySelect) return;
  Array.from(elements.categorySelect.querySelectorAll('option[data-dynamic="true"]')).forEach(option => option.remove());
  list.forEach(item => {
    if (!item.slug || !item.name) return;
    const option = document.createElement('option');
    option.value = item.slug;
    option.textContent = item.name;
    option.dataset.dynamic = 'true';
    option.dataset.name = item.name;
    option.dataset.slug = item.slug;
    elements.categorySelect.appendChild(option);
  });
}

function mergeCategoryOptions(list = []) {
  if (!Array.isArray(list) || !list.length) return;
  const metaList = normaliseCategoryList(list);
  if (!metaList.length) return;

  const allowedSlugs = Array.isArray(categoryState.authoritative) && categoryState.authoritative.length
    ? new Set(categoryState.authoritative.filter(item => item?.slug).map(item => item.slug))
    : null;

  const combined = normaliseCategoryList([
    ...categoryState.serviceSubcategories,
    ...metaList
  ]);
  const filtered = allowedSlugs
    ? combined.filter(item => allowedSlugs.has(item.slug))
    : combined;
  const previous = state.category;
  setCategoryState(filtered);
  populateCategoryOptions(categoryState.serviceSubcategories);
  if (elements.categorySelect) {
    if (previous && categoryState.lookup[previous]) {
      elements.categorySelect.value = previous;
    } else {
      state.category = 'all';
      elements.categorySelect.value = 'all';
      applyCategoryConfig('all');
    }
  }
}

function syncCategoryUrlParam() {
  const params = new URLSearchParams(window.location.search);
  if (state.category && state.category !== 'all') {
    params.set('category', state.category);
  } else {
    params.delete('category');
  }
  if (state.search) {
    params.set('q', state.search);
  } else {
    params.delete('q');
  }
  const newSearch = params.toString();
  const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
}

function getSelectedCategoryName() {
  if (!elements.categorySelect) return '';
  const option = elements.categorySelect.selectedOptions && elements.categorySelect.selectedOptions[0];
  if (!option || option.value === 'all') return '';
  return normaliseText(option.dataset.name || option.textContent || '');
}

function getCategoryContent(categoryKey) {
  if (!categoryKey || categoryKey === 'all') {
    return { ...defaultCategoryContent };
  }
  const category = categoryState.lookup[categoryKey];
  const displayName = category?.name || normaliseText(categoryKey.replace(/-/g, ' ')) || 'خدمات';
  const title = `مراکز ${displayName} برتر سنندج`;
  return {
    title,
    subtitle: `بهترین ${displayName} در شهر سنندج بر اساس امتیاز و نظرات کاربران.`,
    resultsSubtitle: `${displayName} مطابق با فیلترهای شما`,
    pageTitle: `${title} | Vitreenet`
  };
}

function applyCategoryConfig(categoryKey) {
  const config = getCategoryContent(categoryKey);
  if (elements.heroTitle) elements.heroTitle.textContent = config.title;
  if (elements.heroSubtitle) elements.heroSubtitle.textContent = config.subtitle;
  if (elements.resultsSubtitle) elements.resultsSubtitle.textContent = config.resultsSubtitle;
  if (elements.pageTitle) elements.pageTitle.textContent = config.pageTitle;
}

function updateStats(items = []) {
  const total = items.length;
  if (elements.statsCount) {
    elements.statsCount.textContent = total.toLocaleString('fa-IR');
  }
  if (elements.statsRating) {
    const average = total ? items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / total : 0;
    elements.statsRating.textContent = total
      ? average.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : '۰';
  }
}

function updateResultsBadge() {
  if (!elements.resultsCount) return;
  const shopCount = Array.isArray(state.items) ? state.items.length : 0;
  const portfolioCount = Number.isFinite(state.visiblePortfolioCount) ? state.visiblePortfolioCount : 0;
  let label = 'نتیجه';
  let count = shopCount;

  if (state.viewMode === 'portfolios') {
    label = 'نمونه‌کار';
    count = portfolioCount;
  } else if (state.viewMode === 'all') {
    label = 'مورد';
    count = shopCount + portfolioCount;
  }

  elements.resultsCount.textContent = `${count.toLocaleString('fa-IR')} ${label}`;
}

function applyViewMode(mode = 'all') {
  const allowed = ['all', 'shops', 'portfolios'];
  const next = allowed.includes(mode) ? mode : 'all';
  state.viewMode = next;

  if (elements.viewModeToggle) {
    elements.viewModeToggle.querySelectorAll('button[data-mode]').forEach(btn => {
      btn.dataset.active = btn.dataset.mode === next ? 'true' : 'false';
    });
  }

  if (elements.shopsContent) {
    if (next === 'portfolios') {
      elements.shopsContent.classList.add('hidden');
    } else {
      elements.shopsContent.classList.remove('hidden');
    }
  }

  if (elements.portfolioSection) {
    if (next === 'shops') {
      elements.portfolioSection.classList.add('hidden');
    } else {
      elements.portfolioSection.classList.remove('hidden');
    }
  }

  updateResultsBadge();
}

function renderHighlightChips(services = []) {
  if (!Array.isArray(services) || !services.length) return '';
  const limited = services.slice(0, 4);
  return `<div class="flex flex-wrap gap-2">${limited.map(service => `<span class="chip"><i class="ri-sparkling-2-line"></i>${service}</span>`).join('')}</div>`;
}

function renderFeatureBadges(shop = {}) {
  const badges = [];
  if (shop.isPremium) badges.push('<span class="badge-emerald badge">پریمیوم</span>');
  if (shop.instantConfirmation) badges.push('<span class="badge bg-sky-100 text-sky-600">تایید فوری</span>');
  if (shop.isBookable) badges.push('<span class="badge bg-emerald-100 text-emerald-600">رزرو آنلاین</span>');
  return badges.length ? `<div class="flex flex-wrap gap-2">${badges.join('')}</div>` : '';
}

function renderResults() {
  const grid = elements.resultsGrid;
  if (!grid) return;

  const items = Array.isArray(state.items) ? state.items : [];

  if (state.loading && items.length) {
    if (elements.resultsLoading) elements.resultsLoading.classList.remove('hidden');
    updateResultsBadge();
    return;
  }

  if (state.loading && !items.length) {
    if (elements.resultsLoading) elements.resultsLoading.classList.remove('hidden');
    grid.innerHTML = '';
    if (elements.emptyState) elements.emptyState.classList.add('hidden');
    updateStats([]);
    updateResultsBadge();
    return;
  }

  if (elements.resultsLoading) elements.resultsLoading.classList.add('hidden');

  if (!items.length) {
    grid.innerHTML = '';
    if (elements.emptyState) elements.emptyState.classList.remove('hidden');
    updateStats([]);
    updateResultsBadge();
    return;
  }

  if (elements.emptyState) elements.emptyState.classList.add('hidden');

  grid.innerHTML = items.map(shop => {
    const ratingText = Number(shop.rating || 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const reviewText = Number(shop.reviewCount || 0).toLocaleString('fa-IR');
    const followers = Number(shop?.stats?.followers || 0).toLocaleString('fa-IR');
    const bookings = Number(shop?.stats?.totalBookings || 0).toLocaleString('fa-IR');
    const featureBadges = renderFeatureBadges(shop);
    const highlights = renderHighlightChips(shop.highlightServices);
    const coverMedia = shop.coverImage
      ? `<img src="${shop.coverImage}" alt="${shop.name}" loading="lazy" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />`
      : '<div class="w-full h-full bg-gradient-to-br from-emerald-100 via-sky-100 to-white flex items-center justify-center text-emerald-500 text-sm font-extrabold">Vitreenet</div>';

    return `
      <article class="service-card rounded-3xl border border-slate-100 bg-white overflow-hidden shadow-sm flex flex-col group">
        <div class="service-card-cover">
          ${coverMedia}
          <div class="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-emerald-600 text-sm font-semibold shadow-sm">
            <i class="ri-star-fill text-amber-400"></i>
            <span>${ratingText}</span>
            <span class="text-xs text-slate-400">(${reviewText})</span>
          </div>
        </div>
        <div class="p-5 sm:p-6 flex flex-col gap-4 flex-1">
          <div class="space-y-2">
            ${featureBadges}
            <h3 class="text-lg sm:text-xl font-extrabold text-slate-800">${shop.name}</h3>
            <div class="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
              <i class="ri-map-pin-line text-slate-300"></i>
              <span>${shop.address || shop.city || 'سنندج'}</span>
            </div>
          </div>
          <p class="text-sm text-slate-500 leading-relaxed">${shop.description || 'معرفی این مرکز به زودی به‌روزرسانی می‌شود.'}</p>
          ${highlights}
          <div class="mt-auto flex flex-col sm:flex-row sm:justify-between gap-3 pt-4 border-t border-slate-100 text-xs text-slate-400">
            <div class="flex items-center gap-3">
              <span class="flex items-center gap-1"><i class="ri-user-follow-line text-slate-300"></i>${followers} دنبال‌کننده</span>
              <span class="hidden sm:inline text-slate-300">•</span>
              <span class="flex items-center gap-1"><i class="ri-calendar-check-line text-slate-300"></i>${bookings} نوبت ثبت‌شده</span>
            </div>
            <a href="service-shops.html?shopurl=${shop.shopUrl}" class="inline-flex justify-center w-full sm:w-auto px-5 py-2.5 rounded-full bg-gradient-to-l from-emerald-500 to-sky-500 text-white text-sm font-semibold shadow-md hover:shadow-lg transition" aria-label="مشاهده صفحه ${shop.name}">
              مشاهده پروفایل
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  updateStats(items);
  updateResultsBadge();
}

function isAllPortfolioCategory(category = {}) {
  const slug = normaliseText(category.slug || '').toLowerCase();
  const name = normaliseText(category.name || '').toLowerCase();
  const allSlugMatches = ['all', 'services', 'service'];
  const allNameMatches = ['همه', 'همه خدمات', 'خدمات', 'همه نمونه‌کارها'];
  return allSlugMatches.includes(slug) || allNameMatches.includes(name);
}

function renderPortfolioChips() {
  const container = elements.portfolioChips;
  if (!container) return;
  const categories = Array.isArray(state.meta?.categories) ? state.meta.categories : [];
  const unique = categories.filter(cat => cat && cat.slug && cat.name);
  const hasAllEquivalent = unique.some(isAllPortfolioCategory);
  const fallbackCategory = hasAllEquivalent
    ? (unique.find(isAllPortfolioCategory)?.slug || unique[0]?.slug || 'all')
    : 'all';
  const active = unique.some(cat => cat.slug === state.portfolioCategory)
    ? state.portfolioCategory
    : fallbackCategory;
  state.portfolioCategory = active;

  const chipsSource = hasAllEquivalent && fallbackCategory !== 'all'
    ? unique
    : [{ slug: 'all', name: 'همه نمونه‌کارها' }, ...unique];

  const seen = new Set();
  const chips = chipsSource.filter(cat => {
    if (!cat || !cat.slug) return false;
    if (seen.has(cat.slug)) return false;
    seen.add(cat.slug);
    return true;
  });

  container.innerHTML = chips.map(cat => `
    <button type="button" class="filter-chip" data-slug="${cat.slug}" data-active="${state.portfolioCategory === cat.slug}">
      ${cat.name}
    </button>
  `).join('');

  container.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.portfolioCategory = btn.dataset.slug;
      renderPortfolioChips();
      renderPortfolioShowcase();
    });
  });
}

function normalisePortfolioItems(items = []) {
  const source = Array.isArray(items) ? items : [];
  const shopLookup = new Map(
    (Array.isArray(state.items) ? state.items : [])
      .filter(shop => shop && shop.id)
      .map(shop => [String(shop.id), shop])
  );

  return source.map(item => {
    if (!item || typeof item !== 'object') return null;

    const shopId = item.shop?.id || item.shopId || item.sellerId || '';
    const shopSource = shopId ? shopLookup.get(String(shopId)) : null;
    const statsSource = (item.shop && item.shop.stats) || (shopSource && shopSource.stats) || {};
    const likeCount = Number(item.likeCount || 0);
    const viewSource = item.viewCount ?? statsSource.totalBookings ?? 0;
    const ratingSource = item.shop?.rating ?? shopSource?.rating ?? 0;
    const reviewSource = item.shop?.reviewCount ?? shopSource?.reviewCount ?? 0;

    return {
      ...item,
      likeCount,
      viewCount: Number(viewSource || 0),
      categoryName: item.categoryName || shopSource?.categoryName || '',
      shop: {
        ...item.shop,
        id: item.shop?.id || shopSource?.id || String(shopId || ''),
        name: item.shop?.name || shopSource?.name || '',
        shopUrl: item.shop?.shopUrl || shopSource?.shopUrl || '',
        rating: Number(ratingSource || 0),
        reviewCount: Number(reviewSource || 0),
        stats: {
          followers: Number((statsSource && statsSource.followers) || 0),
          totalBookings: Number((statsSource && statsSource.totalBookings) || 0)
        }
      }
    };
  }).filter(Boolean);
}

function renderPortfolioSortControls() {
  if (!elements.portfolioSortContainer) return;
  elements.portfolioSortContainer.querySelectorAll('button[data-sort]').forEach(btn => {
    const sortValue = btn.dataset.sort;
    const isActive = sortValue === state.portfolioSort;
    btn.dataset.active = isActive ? 'true' : 'false';
  });
}

function formatPortfolioNumber(value = 0) {
  return Number(value || 0).toLocaleString('fa-IR');
}

let activePortfolioModalTrigger = null;

function closePortfolioModal() {
  if (!elements.portfolioModal) return;
  elements.portfolioModal.classList.add('hidden');
  if (elements.portfolioModalImage) {
    elements.portfolioModalImage.src = '';
    elements.portfolioModalImage.alt = 'نمونه‌کار';
  }
  document.body.style.overflow = '';
  if (document.body?.classList) {
    document.body.classList.remove('hide-mobile-nav');
  }
  if (activePortfolioModalTrigger && typeof activePortfolioModalTrigger.focus === 'function') {
    activePortfolioModalTrigger.focus();
  }
  activePortfolioModalTrigger = null;
}

function openPortfolioModalById(id) {
  if (!id) return;
  const item = (Array.isArray(state.portfolios) ? state.portfolios : []).find(entry => String(entry.id) === String(id));
  if (!item) return;

  if (elements.portfolioModalImage) {
    elements.portfolioModalImage.src = item.image || '';
    elements.portfolioModalImage.alt = item.title || item.shop?.name || 'نمونه‌کار';
  }
  if (elements.portfolioModalTitle) {
    elements.portfolioModalTitle.textContent = item.title || 'نمونه‌کار انتخابی';
  }
  if (elements.portfolioModalShop) {
    elements.portfolioModalShop.textContent = item.shop?.name ? `از ${item.shop.name}` : '';
  }
  if (elements.portfolioModalDescription) {
    elements.portfolioModalDescription.textContent = item.description || 'توضیحاتی برای این نمونه‌کار ثبت نشده است.';
  }
  if (elements.portfolioModalRating) {
    const ratingText = Number(item.shop?.rating || 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const reviewsText = formatPortfolioNumber(item.shop?.reviewCount || 0);
    elements.portfolioModalRating.innerHTML = `<i class="ri-star-fill text-amber-400"></i><span>${ratingText}</span><span>(${reviewsText})</span>`;
  }
  if (elements.portfolioModalCategory) {
    elements.portfolioModalCategory.innerHTML = `<i class="ri-price-tag-3-line"></i><span>${item.categoryName || 'خدمات'}</span>`;
  }
  if (elements.portfolioModalLikes) {
    elements.portfolioModalLikes.textContent = formatPortfolioNumber(item.likeCount);
  }
  if (elements.portfolioModalViews) {
    elements.portfolioModalViews.textContent = formatPortfolioNumber(item.viewCount);
  }
  if (elements.portfolioModalLink) {
    elements.portfolioModalLink.href = item.shop?.shopUrl ? `service-shops.html?shopurl=${item.shop.shopUrl}` : '#';
  }

  activePortfolioModalTrigger = document.activeElement;
  if (elements.portfolioModal) {
    elements.portfolioModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (document.body?.classList) {
      document.body.classList.add('hide-mobile-nav');
    }
    const focusable = elements.portfolioModal.querySelector('a, button');
    if (focusable && typeof focusable.focus === 'function') {
      focusable.focus();
    }
  }
}

function renderPortfolioShowcase() {
  const grid = elements.portfolioGrid;
  if (!grid) return;

  renderPortfolioSortControls();

  const items = Array.isArray(state.portfolios) ? state.portfolios : [];

  if (state.loading && !items.length) {
    state.visiblePortfolioCount = 0;
    updateResultsBadge();
    grid.innerHTML = '<div class="col-span-full flex justify-center py-12"><div class="loading-spinner" role="status" aria-label="در حال بارگذاری نمونه‌کارها"></div></div>';
    if (elements.portfolioEmpty) elements.portfolioEmpty.classList.add('hidden');
    return;
  }

  const filtered = state.portfolioCategory && state.portfolioCategory !== 'all'
    ? items.filter(item => item.categorySlug === state.portfolioCategory)
    : items;

  if (state.loading && items.length) {
    state.visiblePortfolioCount = filtered.length;
    updateResultsBadge();
    return;
  }

  const sorted = [...filtered].sort((a, b) => {
    const likesA = Number(a.likeCount || 0);
    const likesB = Number(b.likeCount || 0);
    const viewsA = Number(a.viewCount || 0);
    const viewsB = Number(b.viewCount || 0);
    if (state.portfolioSort === 'views') {
      if (viewsB !== viewsA) return viewsB - viewsA;
      if (likesB !== likesA) return likesB - likesA;
    } else {
      if (likesB !== likesA) return likesB - likesA;
      if (viewsB !== viewsA) return viewsB - viewsA;
    }
    const ratingA = Number(a.shop?.rating || 0);
    const ratingB = Number(b.shop?.rating || 0);
    return ratingB - ratingA;
  });

  state.visiblePortfolioCount = sorted.length;

  if (!sorted.length) {
    grid.innerHTML = '';
    if (elements.portfolioEmpty) elements.portfolioEmpty.classList.remove('hidden');
    updateResultsBadge();
    return;
  }

  if (elements.portfolioEmpty) elements.portfolioEmpty.classList.add('hidden');

  grid.innerHTML = sorted.map(item => {
    const likes = formatPortfolioNumber(item.likeCount);
    const views = formatPortfolioNumber(item.viewCount);
    const ratingText = Number(item.shop?.rating || 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const reviews = Number(item.shop?.reviewCount || 0).toLocaleString('fa-IR');
    return `
      <article class="portfolio-card overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm flex flex-col">
        <div class="relative overflow-hidden group portfolio-card-media">
          <img src="${item.image}" alt="${item.title || item.shop?.name || 'نمونه کار'}" loading="lazy" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition"></div>
          <div class="absolute bottom-0 left-0 right-0 p-4 text-white opacity-0 group-hover:opacity-100 transition">
            <p class="text-sm font-semibold">${item.title || 'نمونه‌کار انتخابی'}</p>
            <p class="text-xs text-white/70 mt-1">${item.description || ''}</p>
          </div>
          <div class="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-emerald-600 shadow-md">
            <i class="ri-heart-3-fill text-emerald-500"></i>
            <span>${likes}</span>
          </div>
          <div class="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-sky-600 shadow-md">
            <i class="ri-bar-chart-fill text-sky-500"></i>
            <span>${views}</span>
          </div>
        </div>
        <div class="p-4 flex flex-col gap-3 mt-auto">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <p class="text-sm font-bold text-slate-800">${item.shop?.name || ''}</p>
              <div class="flex items-center gap-2 text-xs text-slate-400">
                <span class="inline-flex items-center gap-1"><i class="ri-star-fill text-amber-400"></i>${ratingText}</span>
                <span>(${reviews})</span>
              </div>
              <p class="text-xs text-slate-500">${item.categoryName || 'خدمات'}</p>
            </div>
          </div>
          <div class="portfolio-card-actions">
            <button type="button" class="portfolio-action-button" data-variant="secondary" data-portfolio-id="${item.id}" aria-label="مشاهده دقیق‌تر ${item.title || item.shop?.name || 'نمونه‌کار'}">
              <i class="ri-eye-line"></i>
              <span>مشاهده دقیق‌تر</span>
            </button>
            <a href="service-shops.html?shopurl=${item.shop?.shopUrl || ''}" class="portfolio-action-button" data-variant="primary" aria-label="مشاهده صفحه ${item.shop?.name || ''}">
              <span>مشاهده صفحه</span>
              <i class="ri-arrow-left-line text-sm"></i>
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  updateResultsBadge();
}

async function fetchShowcase() {
  state.loading = true;
  if (!state.items.length) {
    renderResults();
  } else if (elements.resultsLoading) {
    elements.resultsLoading.classList.remove('hidden');
  }
  if (!state.portfolios.length) {
    renderPortfolioShowcase();
  }

  try {
    const params = new URLSearchParams();
    params.set('limit', '18');
    params.set('sort', state.sort || 'best');
    if (state.search) params.set('search', state.search);
    if (state.category && state.category !== 'all') {
      params.set('category', state.category);
      const categoryName = getSelectedCategoryName();
      if (categoryName) params.set('categoryName', categoryName);
    }
    if (state.minRating > 0) params.set('minRating', String(state.minRating));

    const response = await fetch(`${SHOWCASE_API_URL}?${params.toString()}`, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`showcase request failed: ${response.status}`);
    }
    const payload = await response.json();
    state.items = Array.isArray(payload?.items) ? payload.items : [];
    state.meta = payload?.meta || {};
    let portfolios = Array.isArray(payload?.portfolios) ? payload.portfolios : [];
    if (!portfolios.length && state.items.length) {
      portfolios = state.items.flatMap(shop => Array.isArray(shop.portfolioPreview)
        ? shop.portfolioPreview.map(item => ({
            id: item.id,
            title: item.title,
            description: item.description,
            image: item.image,
            likeCount: item.likeCount,
            viewCount: Number(shop.stats?.totalBookings || 0),
            categorySlug: shop.categorySlug,
            categoryName: shop.categoryName,
            shop: {
              id: shop.id,
              name: shop.name,
              shopUrl: shop.shopUrl,
              rating: shop.rating,
              reviewCount: shop.reviewCount,
              stats: { ...(shop.stats || {}) }
            }
          }))
        : []);
    }
    state.portfolios = normalisePortfolioItems(portfolios);
    mergeCategoryOptions(Array.isArray(state.meta?.categories) ? state.meta.categories : []);
    if (!Array.isArray(state.meta?.categories) || !state.meta.categories.some(cat => cat.slug === state.portfolioCategory)) {
      state.portfolioCategory = 'all';
    }
  } catch (error) {
    console.error('load showcase failed:', error);
    state.items = [];
    state.portfolios = [];
    state.meta = state.meta || {};
  } finally {
    state.loading = false;
    renderResults();
    renderPortfolioChips();
    renderPortfolioShowcase();
  }
}

async function loadCategoryOptions(preferredSlug = null) {
  if (elements.categorySelect) {
    elements.categorySelect.disabled = true;
  }

  let resolvedList = [];
  try {
    const response = await fetch(CATEGORY_API_URL);
    if (response.ok) {
      const payload = await response.json();
      const serviceList = normaliseCategoryList(payload?.serviceSubcategories || []);
      if (serviceList.length) {
        resolvedList = serviceList;
      }
    } else {
      console.warn('دریافت دسته‌بندی خدمات موفق نبود:', response.status);
    }
  } catch (error) {
    console.error('خطا در دریافت دسته‌بندی خدمات:', error);
  }

  setCategoryState(resolvedList, { updateAuthoritative: true });
  populateCategoryOptions(categoryState.serviceSubcategories);

  const desired = preferredSlug && categoryState.lookup[preferredSlug]
    ? preferredSlug
    : (state.category !== 'all' && categoryState.lookup[state.category] ? state.category : 'all');

  state.category = desired;
  if (elements.categorySelect) {
    elements.categorySelect.value = desired;
    elements.categorySelect.disabled = false;
  }

  applyCategoryConfig(state.category);
  syncCategoryUrlParam();
  await fetchShowcase();
}

function attachEventListeners() {
  if (elements.searchInput) {
    const debouncedSearch = debounce((value) => {
      state.search = value;
      syncCategoryUrlParam();
      fetchShowcase();
    }, 350);
    elements.searchInput.addEventListener('input', (event) => {
      debouncedSearch(normaliseText(event.target.value));
    });
  }

  if (elements.categorySelect) {
    elements.categorySelect.addEventListener('change', (event) => {
      state.category = event.target.value || 'all';
      applyCategoryConfig(state.category);
      syncCategoryUrlParam();
      fetchShowcase();
    });
  }

  if (elements.sortSelect) {
    elements.sortSelect.addEventListener('change', (event) => {
      state.sort = event.target.value || 'best';
      fetchShowcase();
    });
  }

  if (elements.ratingSelect) {
    elements.ratingSelect.addEventListener('change', (event) => {
      state.minRating = Number(event.target.value) || 0;
      fetchShowcase();
    });
  }

  if (elements.resetFilters) {
    elements.resetFilters.addEventListener('click', () => {
      state.category = 'all';
      state.sort = 'best';
      state.minRating = 0;
      state.search = '';
      state.portfolioCategory = 'all';
      state.portfolioSort = 'likes';

      if (elements.searchInput) elements.searchInput.value = '';
      if (elements.categorySelect) elements.categorySelect.value = 'all';
      if (elements.sortSelect) elements.sortSelect.value = 'best';
      if (elements.ratingSelect) elements.ratingSelect.value = '0';

      applyViewMode('all');
      applyCategoryConfig('all');
      syncCategoryUrlParam();
      renderPortfolioSortControls();
      fetchShowcase();
    });
  }

  if (elements.viewModeToggle) {
    elements.viewModeToggle.querySelectorAll('button[data-mode]').forEach(button => {
      button.addEventListener('click', () => {
        applyViewMode(button.dataset.mode || 'all');
      });
    });
  }

  if (elements.portfolioSortContainer) {
    elements.portfolioSortContainer.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-sort]');
      if (!button) return;
      const sortValue = button.dataset.sort;
      if (!['likes', 'views'].includes(sortValue)) return;
      if (state.portfolioSort === sortValue) return;
      state.portfolioSort = sortValue;
      renderPortfolioSortControls();
      renderPortfolioShowcase();
    });
  }

  if (elements.portfolioGrid) {
    elements.portfolioGrid.addEventListener('click', (event) => {
      const trigger = event.target.closest('button[data-portfolio-id]');
      if (!trigger) return;
      const portfolioId = trigger.dataset.portfolioId;
      openPortfolioModalById(portfolioId);
    });
  }

  if (elements.portfolioModal) {
    elements.portfolioModal.addEventListener('click', (event) => {
      if (event.target.matches('[data-portfolio-modal-backdrop]')) {
        closePortfolioModal();
        return;
      }
      const closer = event.target.closest('[data-portfolio-modal-close]');
      if (closer) {
        event.preventDefault();
        closePortfolioModal();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && elements.portfolioModal && !elements.portfolioModal.classList.contains('hidden')) {
      closePortfolioModal();
    }
  });
}

const urlParams = new URLSearchParams(window.location.search);
const pendingCategoryFromUrl = (() => {
  const param = urlParams.get('category');
  if (param && param !== 'all') {
    state.category = param;
    return param;
  }
  return null;
})();

const searchFromUrl = urlParams.get('q') || urlParams.get('search');
if (searchFromUrl) {
  state.search = normaliseText(searchFromUrl);
  if (elements.searchInput) elements.searchInput.value = state.search;
}

const ratingFromUrl = urlParams.get('rating');
if (ratingFromUrl) {
  const ratingValue = Number(ratingFromUrl) || 0;
  state.minRating = ratingValue;
  if (elements.ratingSelect) elements.ratingSelect.value = String(ratingValue);
}

const sortFromUrl = urlParams.get('sort');
if (sortFromUrl && ['best', 'popular', 'recent', 'featured'].includes(sortFromUrl)) {
  state.sort = sortFromUrl;
}
if (elements.sortSelect) elements.sortSelect.value = state.sort;

applyCategoryConfig(state.category);
applyViewMode(state.viewMode);
attachEventListeners();
loadCategoryOptions(pendingCategoryFromUrl);
