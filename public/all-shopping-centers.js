/* فیلتر پیشرفته مراکز خرید */
(function() {
  const FEATURE_ICONS = { parking: 'fa-parking', food: 'fa-utensils', family: 'fa-children', discount: 'fa-percent' };
  const FEATURE_LABELS = { parking: 'پارکینگ', food: 'فودکورت', family: 'خانواده', discount: 'تخفیف' };
  const FEATURE_KEYWORDS = {
    parking: ['پارکینگ', 'پاركينگ', 'parking'],
    food: ['فود', 'رستوران', 'کافی شاپ', 'کافه', 'غذا'],
    family: ['خانواده', 'کودک', 'تفریح', 'سرگرمی', 'سینما', 'بازی'],
    discount: ['تخفیف', 'جشنواره', 'حراج', 'پیشنهاد ویژه', 'economy']
  };
  const CATEGORY_KEYWORDS = [
    { label: 'پوشاک و مد', keys: ['پوشاک', 'لباس', 'بوتیک', 'مد', 'فشن'] },
    { label: 'زیورآلات و ساعت', keys: ['زیور', 'طلا', 'جواهر', 'ساعت', 'بدلیجات'] },
    { label: 'آرایشی و زیبایی', keys: ['آرایشی', 'بهداشتی', 'زیبایی', 'عطر', 'ادکلن'] },
    { label: 'خانه و دکوراسیون', keys: ['خانه', 'لوازم خانگی', 'دکور', 'مبلمان', 'منزل'] },
    { label: 'کودک و سرگرمی', keys: ['کودک', 'سیسمونی', 'اسباب بازی', 'سرگرمی'] },
    { label: 'خوراک و سوغات', keys: ['غذا', 'فود', 'کافه', 'رستوران', 'سوغات', 'شیرینی'] },
    { label: 'دیجیتال و موبایل', keys: ['موبایل', 'دیجیتال', 'الکترونیک', 'گوشی', 'لپ تاپ'] }
  ];
  const refs = {};
  const state = {
    allCenters: [],
    filters: {
      search: '',
      categories: new Set(),
      price: null,
      features: new Set(),
      minStores: 0,
      sort: 'recommended'
    },
    priceBounds: { min: 0, max: 1500000 }
  };
  const API_URL = '/api/shopping-centers';

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheDom();
    showSkeleton();
    fetchCenters();
    bindEvents();
  }

  function cacheDom() {
    refs.list = document.getElementById('all-centers-list');
    refs.searchInput = document.getElementById('searchInput');
    refs.resultsCount = document.getElementById('resultsCount');
    refs.activeFilters = document.getElementById('activeFilters');
    refs.resetButtons = [document.getElementById('resetFilters'), document.getElementById('resetFiltersMobile')].filter(Boolean);
    refs.categoryContainers = [document.getElementById('categoryChips'), document.getElementById('categoryChipsMobile')].filter(Boolean);
    refs.price = {
      min: document.getElementById('priceMin'),
      max: document.getElementById('priceMax'),
      minMobile: document.getElementById('priceMinMobile'),
      maxMobile: document.getElementById('priceMaxMobile'),
      minValue: document.getElementById('priceMinValue'),
      maxValue: document.getElementById('priceMaxValue'),
      minValueMobile: document.getElementById('priceMinValueMobile'),
      maxValueMobile: document.getElementById('priceMaxValueMobile')
    };
    refs.stores = {
      desktop: document.getElementById('storesRange'),
      mobile: document.getElementById('storesRangeMobile'),
      displayDesktop: document.getElementById('storesValue'),
      displayMobile: document.getElementById('storesValueMobile')
    };
    refs.featureContainers = [document.getElementById('featureOptions'), document.getElementById('featureOptionsMobile')].filter(Boolean);
    refs.sortSelects = [document.getElementById('sortSelect'), document.getElementById('sortSelectMobile')].filter(Boolean);
    refs.mobile = {
      trigger: document.getElementById('mobileFilterTrigger'),
      overlay: document.getElementById('mobileFilterOverlay'),
      backdrop: document.getElementById('mobileFilterBackdrop'),
      close: document.getElementById('mobileFilterClose'),
      apply: document.getElementById('mobileApplyFilters')
    };
  }

  function showSkeleton() {
    if (!refs.list) return;
    refs.list.innerHTML = '';
    for (let i = 0; i < 6; i += 1) {
      refs.list.innerHTML += `
        <div class="center-card fade-in delay-${i % 3}">
          <div class="skeleton skeleton-img"></div>
          <div class="center-info">
            <div class="skeleton skeleton-line" style="height: 28px; margin-bottom: 15px;"></div>
            <div class="skeleton skeleton-line short" style="height: 22px; margin-bottom: 10px;"></div>
            <div class="skeleton skeleton-line" style="height: 18px; margin-bottom: 8px;"></div>
            <div class="skeleton skeleton-line" style="height: 18px; margin-bottom: 8px;"></div>
            <div class="skeleton skeleton-line medium" style="height: 18px; margin-bottom: 20px;"></div>
            <div style="display: flex; gap: 10px; margin-top: auto;">
              <div class="skeleton" style="height: 40px; flex: 1; border-radius: 12px;"></div>
            </div>
          </div>
        </div>`;
    }
  }

  async function fetchCenters() {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('API error');
      const centers = await response.json();
      initialise(centers);
    } catch (error) {
      console.error('خطا در دریافت مراکز خرید:', error);
      showError();
    }
  }

  function showError() {
    if (!refs.list) return;
    refs.list.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px;">
        <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #cbd5e1; margin-bottom: 20px;"></i>
        <h3 style="color: #64748b; font-size: 1.5rem;">خطا در بارگذاری مراکز خرید!</h3>
        <p style="color: #94a3b8; margin-top: 10px;">لطفاً اتصال اینترنت یا وضعیت سرور را بررسی کنید.</p>
      </div>`;
  }

  function initialise(rawCenters) {
    state.allCenters = Array.isArray(rawCenters) ? rawCenters.map(enrichCenter) : [];
    if (!state.allCenters.length) {
      renderCenters([]);
      updateResultsCount(0);
      return;
    }

    computePriceBounds();
    renderCategoryChips(collectCategories(state.allCenters));
    configurePriceInputs();
    configureStoresRange();
    syncFeatureCheckboxes();
    syncSortSelects();
    setPriceRange(state.priceBounds.min, state.priceBounds.max, { silent: true });
    setMinStores(0, { silent: true });
    applyFilters();
  }

  function enrichCenter(center) {
    const categories = inferCategories(center);
    const priceRange = inferPriceRange(center);
    const features = inferFeatures(center);
    const searchIndex = `${(center.title || '')} ${(center.location || '')} ${(center.description || '')}`.toLowerCase();
    const stores = Number(center.stores) || 0;

    return {
      ...center,
      categories,
      priceRange,
      priceAverage: Math.round((priceRange.min + priceRange.max) / 2),
      priceLabel: priceRange.label,
      features,
      searchIndex,
      stores,
      location: center.location || 'نامشخص'
    };
  }

  function inferCategories(center) {
    if (Array.isArray(center.categories) && center.categories.length) {
      return center.categories.map(normalizeCategory).filter(Boolean);
    }
    const result = new Set();
    const base = [
      center.category,
      center.tag,
      Array.isArray(center.facilities) ? center.facilities.join(',') : '',
      center.description
    ].filter(Boolean).join('،');

    splitCategories(base).forEach(cat => result.add(normalizeCategory(cat)));

    const text = base.toLowerCase();
    CATEGORY_KEYWORDS.forEach(item => {
      if (item.keys.some(key => text.includes(key))) result.add(item.label);
    });

    if (!result.size) result.add('عمومی');
    return Array.from(result).filter(Boolean);
  }

  function normalizeCategory(value = '') {
    return value.replace(/[،,]/g, ' ').trim().replace(/\s+/g, ' ');
  }

  function splitCategories(value = '') {
    return value.split(/[,،\/\|]/).map(part => part.trim()).filter(Boolean);
  }

  function inferPriceRange(center) {
    if (center.priceRange && Number.isFinite(center.priceRange.min) && Number.isFinite(center.priceRange.max)) {
      return {
        min: center.priceRange.min,
        max: center.priceRange.max,
        label: center.priceRange.label || classifyPrice(center.priceRange.min, center.priceRange.max)
      };
    }

    const numericValues = [center.minPrice, center.maxPrice, center.averagePrice]
      .map(Number)
      .filter(value => Number.isFinite(value) && value > 0);

    let min = numericValues.length ? Math.min(...numericValues) : 250000;
    let max = numericValues.length ? Math.max(...numericValues) : 1200000;
    let label = classifyPrice(min, max);
    const description = `${center.description || ''} ${center.tag || ''}`.toLowerCase();

    if (/لوکس|لاکچری|برند|پریمیوم/.test(description)) {
      min = Math.max(min, 900000);
      max = Math.max(max, 2000000);
      label = 'لاکچری';
    } else if (/اقتصادی|تخفیف|حراج|مقرون/.test(description)) {
      min = Math.min(min, 80000);
      max = Math.min(max, 450000);
      label = 'اقتصادی';
    }

    if (min > max) {
      const temp = min;
      min = max;
      max = temp;
    }

    return { min, max, label };
  }

  function classifyPrice(min, max) {
    const average = (Number(min) + Number(max)) / 2;
    if (average >= 900000) return 'لاکچری';
    if (average <= 300000) return 'اقتصادی';
    return 'میان‌رده';
  }

  function inferFeatures(center) {
    const normalized = new Set();
    const rawValues = [];

    if (Array.isArray(center.features)) rawValues.push(...center.features);
    if (Array.isArray(center.facilities)) rawValues.push(...center.facilities);
    if (typeof center.featuresText === 'string') rawValues.push(center.featuresText);

    const description = `${center.description || ''} ${center.tag || ''} ${rawValues.join(' ')}`.toLowerCase();

    Object.keys(FEATURE_KEYWORDS).forEach(feature => {
      if (FEATURE_KEYWORDS[feature].some(keyword => description.includes(keyword.toLowerCase()))) {
        normalized.add(feature);
      }
    });

    rawValues.forEach(value => {
      const lower = String(value).toLowerCase();
      if (lower.includes('پارک')) normalized.add('parking');
      if (lower.includes('فود') || lower.includes('رستوران') || lower.includes('کافی') || lower.includes('غذا')) normalized.add('food');
      if (lower.includes('خانواده') || lower.includes('کودک') || lower.includes('تفریح') || lower.includes('سرگرمی') || lower.includes('سینما')) normalized.add('family');
      if (lower.includes('تخفیف') || lower.includes('حراج') || lower.includes('جشنواره')) normalized.add('discount');
    });

    return Array.from(normalized);
  }

  function computePriceBounds() {
    const mins = state.allCenters.map(center => center.priceRange.min).filter(Number.isFinite);
    const maxs = state.allCenters.map(center => center.priceRange.max).filter(Number.isFinite);
    const min = mins.length ? Math.min(...mins) : 0;
    const max = maxs.length ? Math.max(...maxs) : min + 1000000;

    state.priceBounds.min = Math.max(0, Math.floor(min / 50000) * 50000);
    state.priceBounds.max = Math.ceil(max / 50000) * 50000;

    if (state.priceBounds.max <= state.priceBounds.min) {
      state.priceBounds.max = state.priceBounds.min + 500000;
    }
  }

  function collectCategories(centers) {
    const set = new Set();
    centers.forEach(center => center.categories.forEach(cat => set.add(cat)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fa'));
  }

  function renderCategoryChips(categories) {
    refs.categoryContainers.forEach(container => {
      container.innerHTML = '';
      if (!categories.length) {
        container.innerHTML = '<span style="color:#94a3b8; font-size:0.9rem;">دسته‌بندی ثبت نشده است.</span>';
        return;
      }
      categories.forEach(category => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'filter-chip';
        chip.dataset.category = category;
        chip.innerHTML = `<i class="fas fa-tag"></i> ${category}`;
        chip.addEventListener('click', () => toggleCategory(category));
        container.appendChild(chip);
      });
    });
    syncCategoryChips();
  }

  function toggleCategory(category) {
    if (state.filters.categories.has(category)) {
      state.filters.categories.delete(category);
    } else {
      state.filters.categories.add(category);
    }
    syncCategoryChips();
    applyFilters();
  }

  function syncCategoryChips() {
    refs.categoryContainers.forEach(container => {
      container.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.toggle('active', state.filters.categories.has(chip.dataset.category));
      });
    });
  }

  function configurePriceInputs() {
    const step = Math.max(50000, Math.round((state.priceBounds.max - state.priceBounds.min) / 40 / 10000) * 10000 || 50000);
    [refs.price.min, refs.price.max, refs.price.minMobile, refs.price.maxMobile].forEach(input => {
      if (!input) return;
      input.min = state.priceBounds.min;
      input.max = state.priceBounds.max;
      input.step = step;
    });
    updatePriceTrack();
    syncPriceDisplay();
  }

  function setPriceRange(min, max, options = {}) {
    const clampedMin = clamp(Number.isFinite(min) ? min : state.priceBounds.min, state.priceBounds.min, state.priceBounds.max);
    const clampedMax = clamp(Number.isFinite(max) ? max : state.priceBounds.max, state.priceBounds.min, state.priceBounds.max);
    const finalMin = Math.min(clampedMin, clampedMax);
    const finalMax = Math.max(clampedMin, clampedMax);

    state.filters.price = { min: finalMin, max: finalMax };
    syncPriceInputs();
    if (!options.silent) applyFilters();
  }

  function syncPriceInputs() {
    const { min, max } = state.filters.price || state.priceBounds;
    if (refs.price.min) refs.price.min.value = min;
    if (refs.price.max) refs.price.max.value = max;
    if (refs.price.minMobile) refs.price.minMobile.value = min;
    if (refs.price.maxMobile) refs.price.maxMobile.value = max;
    syncPriceDisplay();
    updatePriceTrack();
  }

  function syncPriceDisplay() {
    const { min, max } = state.filters.price || state.priceBounds;
    if (refs.price.minValue) refs.price.minValue.textContent = formatCurrency(min);
    if (refs.price.maxValue) refs.price.maxValue.textContent = formatCurrency(max);
    if (refs.price.minValueMobile) refs.price.minValueMobile.textContent = formatCurrency(min);
    if (refs.price.maxValueMobile) refs.price.maxValueMobile.textContent = formatCurrency(max);
  }

  function updatePriceTrack() {
    const { min, max } = state.filters.price || state.priceBounds;
    const range = state.priceBounds.max - state.priceBounds.min || 1;
    const minPercent = ((min - state.priceBounds.min) / range) * 100;
    const maxPercent = ((max - state.priceBounds.min) / range) * 100;
    document.querySelectorAll('.price-range-track').forEach(track => {
      track.style.setProperty('--track-min', `${Math.min(minPercent, maxPercent)}%`);
      track.style.setProperty('--track-max', `${Math.max(minPercent, maxPercent)}%`);
    });
  }

  function configureStoresRange() {
    const maxStores = Math.max(...state.allCenters.map(center => center.stores || 0), 0);
    [refs.stores.desktop, refs.stores.mobile].forEach(input => {
      if (!input) return;
      input.min = 0;
      input.max = Math.max(5, maxStores);
      input.step = 1;
    });
    updateStoresDisplay();
  }

  function setMinStores(value, options = {}) {
    state.filters.minStores = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    updateStoresInputs();
    if (!options.silent) applyFilters();
  }

  function updateStoresInputs() {
    if (refs.stores.desktop) refs.stores.desktop.value = state.filters.minStores;
    if (refs.stores.mobile) refs.stores.mobile.value = state.filters.minStores;
    updateStoresDisplay();
  }

  function updateStoresDisplay() {
    const value = state.filters.minStores;
    const label = value <= 0 ? 'همه' : `${toFaDigits(value)}+ فروشگاه`;
    if (refs.stores.displayDesktop) refs.stores.displayDesktop.textContent = label;
    if (refs.stores.displayMobile) refs.stores.displayMobile.textContent = label;
  }

  function toggleFeature(feature, active) {
    if (active) {
      state.filters.features.add(feature);
    } else {
      state.filters.features.delete(feature);
    }
    syncFeatureCheckboxes();
    applyFilters();
  }

  function syncFeatureCheckboxes() {
    refs.featureContainers.forEach(container => {
      container.querySelectorAll('label.feature-pill').forEach(label => {
        const input = label.querySelector('input[type="checkbox"]');
        if (!input) return;
        const isActive = state.filters.features.has(input.value);
        input.checked = isActive;
        label.classList.toggle('active', isActive);
      });
    });
  }

  function setSort(value, options = {}) {
    state.filters.sort = value || 'recommended';
    syncSortSelects();
    if (!options.silent) applyFilters();
  }

  function syncSortSelects() {
    refs.sortSelects.forEach(select => {
      select.value = state.filters.sort;
    });
  }

  function applyFilters() {
    if (!state.allCenters.length) return;
    let filtered = [...state.allCenters];

    if (state.filters.search) {
      filtered = filtered.filter(center => center.searchIndex.includes(state.filters.search));
    }

    if (state.filters.categories.size) {
      filtered = filtered.filter(center => center.categories.some(cat => state.filters.categories.has(cat)));
    }

    if (state.filters.price) {
      const { min, max } = state.filters.price;
      filtered = filtered.filter(center => center.priceRange.max >= min && center.priceRange.min <= max);
    }

    if (state.filters.features.size) {
      filtered = filtered.filter(center => Array.from(state.filters.features).every(feature => center.features.includes(feature)));
    }

    if (state.filters.minStores > 0) {
      filtered = filtered.filter(center => center.stores >= state.filters.minStores);
    }

    switch (state.filters.sort) {
      case 'mostStores':
        filtered.sort((a, b) => b.stores - a.stores);
        break;
      case 'leastStores':
        filtered.sort((a, b) => a.stores - b.stores);
        break;
      case 'priceLow':
        filtered.sort((a, b) => a.priceAverage - b.priceAverage);
        break;
      case 'priceHigh':
        filtered.sort((a, b) => b.priceAverage - a.priceAverage);
        break;
      case 'alphabetical':
        filtered.sort((a, b) => a.title.localeCompare(b.title, 'fa'));
        break;
      default:
        filtered.sort((a, b) => {
          if (b.features.length !== a.features.length) return b.features.length - a.features.length;
          if (b.stores !== a.stores) return b.stores - a.stores;
          return a.title.localeCompare(b.title, 'fa');
        });
    }

    renderCenters(filtered);
    updateActiveFilters();
    updateResultsCount(filtered.length);
  }

  function renderCenters(centers) {
    if (!refs.list) return;
    refs.list.innerHTML = '';
    if (!centers.length) {
      refs.list.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px;">
          <i class="fas fa-store-slash" style="font-size: 4rem; color: #cbd5e1; margin-bottom: 20px;"></i>
          <h3 style="color: #64748b; font-size: 1.5rem;">مرکز خریدی یافت نشد!</h3>
          <p style="color: #94a3b8; margin-top: 10px;">شرایط فیلتر را تغییر دهید و دوباره تلاش کنید.</p>
        </div>`;
      return;
    }

    centers.forEach((center, index) => {
      const categoriesHtml = center.categories.map(cat => `<span class="center-category">${cat}</span>`).join('');
      const priceHtml = `
        <div class="center-price-badge">
          <i class="fas fa-coins"></i>
          <span class="price-label">${center.priceLabel}</span>
          <span class="price-range-text">${formatPriceRange(center.priceRange.min, center.priceRange.max)}</span>
        </div>`;
      const featuresHtml = center.features.length
        ? `<div class="center-feature-icons">${center.features.map(feature => {
            const icon = FEATURE_ICONS[feature] || 'fa-check';
            const label = FEATURE_LABELS[feature] || feature;
            return `<span><i class="fas ${icon}"></i>${label}</span>`;
          }).join('')}</div>`
        : '';
      const safeTitle = (center.title || '').replace(/'/g, "\\'");

      const card = document.createElement('div');
      card.className = `center-card fade-in delay-${index % 3}`;
      card.innerHTML = `
        <div class="center-img-container">
          <img class="center-img" loading="lazy" src="${center.image || 'https://via.placeholder.com/800x600?text=تصویر+مرکز+خرید'}" alt="${center.title}">
          ${center.tag ? `<div class="center-tag">${center.tag}</div>` : ''}
        </div>
        <div class="center-info">
          <h3 class="center-title">${center.title}</h3>
          <div class="center-address">
            <i class="fas fa-map-marker-alt"></i> ${center.location}
          </div>
          <div class="center-categories">${categoriesHtml}</div>
          ${priceHtml}
          <p class="center-desc">${center.description || ''}</p>
          <div class="center-meta">
            <span><i class="fas fa-store"></i> ${toFaDigits(center.stores)} مغازه</span>
            ${center.hours ? `<span><i class="fas fa-clock"></i> ${center.hours}</span>` : ''}
            ${center.holidays ? `<span><i class="fas fa-calendar-times"></i> تعطیلی: ${center.holidays}</span>` : ''}
          </div>
          ${featuresHtml}
          <div class="center-actions">
            <div class="action-btn btn-primary" onclick="goToShops('${center._id}', '${safeTitle}')">
              <i class="fas fa-list"></i> مشاهده فروشگاه‌ها
            </div>
          </div>
        </div>`;
      refs.list.appendChild(card);
    });
  }

  function updateActiveFilters() {
    if (!refs.activeFilters) return;
    refs.activeFilters.innerHTML = '';

    const addChip = (label, onRemove) => {
      const chip = document.createElement('span');
      chip.className = 'active-filter-chip';
      chip.innerHTML = `${label} <button type="button" aria-label="حذف فیلتر"><i class="fas fa-times"></i></button>`;
      chip.querySelector('button').addEventListener('click', onRemove);
      refs.activeFilters.appendChild(chip);
    };

    if (state.filters.search) {
      addChip(`جستجو: ${state.filters.search}`, () => {
        state.filters.search = '';
        if (refs.searchInput) refs.searchInput.value = '';
        applyFilters();
      });
    }

    state.filters.categories.forEach(category => {
      addChip(`دسته: ${category}`, () => {
        state.filters.categories.delete(category);
        syncCategoryChips();
        applyFilters();
      });
    });

    if (state.filters.price) {
      const { min, max } = state.filters.price;
      if (min > state.priceBounds.min || max < state.priceBounds.max) {
        addChip(`قیمت: ${formatPriceRange(min, max)}`, () => setPriceRange(state.priceBounds.min, state.priceBounds.max));
      }
    }

    state.filters.features.forEach(feature => {
      const label = FEATURE_LABELS[feature] || feature;
      addChip(`ویژگی: ${label}`, () => {
        state.filters.features.delete(feature);
        syncFeatureCheckboxes();
        applyFilters();
      });
    });

    if (state.filters.minStores > 0) {
      addChip(`حداقل ${toFaDigits(state.filters.minStores)} فروشگاه`, () => setMinStores(0));
    }
  }

  function updateResultsCount(count) {
    if (!refs.resultsCount) return;
    const total = state.allCenters.length;
    refs.resultsCount.textContent = `${toFaDigits(count)} مرکز از ${toFaDigits(total)} نمایش داده شد`;
  }

  function resetFilters() {
    state.filters.search = '';
    state.filters.categories.clear();
    state.filters.features.clear();
    if (refs.searchInput) refs.searchInput.value = '';
    setPriceRange(state.priceBounds.min, state.priceBounds.max, { silent: true });
    setMinStores(0, { silent: true });
    setSort('recommended', { silent: true });
    syncCategoryChips();
    syncFeatureCheckboxes();
    applyFilters();
  }

  function openMobileFilters() {
    if (!refs.mobile.overlay) return;
    refs.mobile.overlay.classList.add('open');
    refs.mobile.overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileFilters() {
    if (!refs.mobile.overlay) return;
    refs.mobile.overlay.classList.remove('open');
    refs.mobile.overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function formatCurrency(value) {
    if (!Number.isFinite(value)) return 'نامحدود';
    return `${value.toLocaleString('fa-IR')} تومان`;
  }

  function formatPriceRange(min, max) {
    if (min <= state.priceBounds.min && max >= state.priceBounds.max) {
      return 'تمام محدوده‌ها';
    }
    if (!Number.isFinite(max) || max >= state.priceBounds.max) {
      return `${formatCurrency(min)} به بالا`;
    }
    return `${formatCurrency(min)} تا ${formatCurrency(max)}`;
  }

  function toFaDigits(value) {
    const digits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
    return String(value).replace(/\d/g, d => digits[d]);
  }

  function normalizeSearch(value) {
    return value.trim().toLowerCase();
  }

  function bindEvents() {
    if (refs.searchInput) {
      refs.searchInput.addEventListener('input', () => {
        state.filters.search = normalizeSearch(refs.searchInput.value);
        applyFilters();
      });
    }

    [refs.price.min, refs.price.minMobile].forEach(input => {
      if (!input) return;
      input.addEventListener('input', event => {
        const value = Number(event.target.value);
        if (!Number.isFinite(value)) return;
        const current = state.filters.price || state.priceBounds;
        setPriceRange(value, current.max);
      });
    });

    [refs.price.max, refs.price.maxMobile].forEach(input => {
      if (!input) return;
      input.addEventListener('input', event => {
        const value = Number(event.target.value);
        if (!Number.isFinite(value)) return;
        const current = state.filters.price || state.priceBounds;
        setPriceRange(current.min, value);
      });
    });

    [refs.stores.desktop, refs.stores.mobile].forEach(input => {
      if (!input) return;
      input.addEventListener('input', () => setMinStores(Number(input.value)));
    });

    refs.featureContainers.forEach(container => {
      container.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => toggleFeature(input.value, input.checked));
      });
    });

    refs.sortSelects.forEach(select => {
      select.addEventListener('change', () => setSort(select.value));
    });

    refs.resetButtons.forEach(button => button.addEventListener('click', resetFilters));

    if (refs.mobile.trigger) refs.mobile.trigger.addEventListener('click', openMobileFilters);
    if (refs.mobile.close) refs.mobile.close.addEventListener('click', closeMobileFilters);
    if (refs.mobile.backdrop) refs.mobile.backdrop.addEventListener('click', closeMobileFilters);
    if (refs.mobile.apply) refs.mobile.apply.addEventListener('click', () => {
      applyFilters();
      closeMobileFilters();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeMobileFilters();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) {
        closeMobileFilters();
      }
    });
  }

  window.goToShops = function(id, title) {
    window.location.href = `shopping-centers-shops.html?centerId=${id}&title=${encodeURIComponent(title)}`;
  };
})();

