document.addEventListener('DOMContentLoaded', function() {
  const API_URL = '/api/shopping-centers';

  const listDiv = document.getElementById('all-centers-list');
  const searchInput = document.getElementById('searchInput');
  const activeFiltersContainer = document.getElementById('activeFilters');

  const mainFilterBtn = document.getElementById('mainFilterBtn');
  const filterDropdown = document.getElementById('filterDropdown');
  const shopsBtn = document.getElementById('shopsBtn');
  const shopsDropdown = document.getElementById('shopsDropdown');
  const sortCheapBtn = document.getElementById('sort-cheap');
  const sortExpensiveBtn = document.getElementById('sort-expensive');

  const mobileFilterBtn = document.getElementById('mobileFilterBtn');
  const mobileFiltersOverlay = document.getElementById('mobileFiltersOverlay');
  const mobileFiltersPanel = document.getElementById('mobileFilters');
  const closeFiltersBtn = document.getElementById('closeFilters');
  const mainFilterBtnMobile = document.getElementById('mainFilterBtnMobile');
  const filterDropdownMobile = document.getElementById('filterDropdownMobile');
  const shopsBtnMobile = document.getElementById('shopsBtnMobile');
  const shopsDropdownMobile = document.getElementById('shopsDropdownMobile');
  const sortCheapMobileBtn = document.getElementById('sort-cheap-mobile');
  const sortExpensiveMobileBtn = document.getElementById('sort-expensive-mobile');
  const applyFiltersMobileBtn = document.getElementById('applyFiltersMobile');

  let centersData = [];
  let filteredCenters = [];
  let centerCategories = [];
  let locations = [];

  let currentCategory = 'همه مراکز خرید';
  let currentLocation = 'همه مناطق';
  let currentSort = null;
  let searchTerm = '';

  showSkeleton();

  setTimeout(() => {
    fetch(API_URL)
      .then(res => {
        if (!res.ok) throw new Error('centers');
        return res.json();
      })
      .then((centersResponse) => {
        centersData = (Array.isArray(centersResponse) ? centersResponse : []).map((center, index) => ({
          ...center,
          __index: index
        }));
        centerCategories = buildCategories(centersData);
        locations = buildLocations(centersData);
        populateDropdowns();
        updateCategorySelection('همه مراکز خرید', { skipFilter: true });
        updateLocationSelection('همه مناطق', { skipFilter: true });
        filterAndRender();
      })
      .catch(() => {
        showError('خطا در بارگذاری مراکز خرید!');
      });
  }, 800);

  function showSkeleton() {
    if (!listDiv) return;
    listDiv.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      listDiv.innerHTML += `
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
        </div>
      `;
    }
  }

  function showError(message) {
    if (!listDiv) return;
    listDiv.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px;">
        <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #cbd5e1; margin-bottom: 20px;"></i>
        <h3 style="color: #64748b; font-size: 1.5rem;">${message}</h3>
      </div>
    `;
  }

  function buildCategories(data) {
    const tags = data
      .map(item => (item.tag || '').trim())
      .filter(tag => tag.length);
    const unique = Array.from(new Set(tags));
    return ['همه مراکز خرید', ...unique];
  }

  function buildLocations(data) {
    const locs = data
      .map(item => (item.location || '').trim())
      .map(loc => loc || 'نامشخص');
    const unique = Array.from(new Set(locs));
    return ['همه مناطق', ...unique];
  }

  function populateDropdowns() {
    populateCategoryDropdown(filterDropdown, false);
    populateCategoryDropdown(filterDropdownMobile, true);
    populateLocationDropdown(shopsDropdown, false);
    populateLocationDropdown(shopsDropdownMobile, true);
  }

  function populateCategoryDropdown(container, isMobile) {
    if (!container) return;
    container.innerHTML = '';
    centerCategories.forEach(category => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'dropdown-item';
      option.dataset.value = category;
      option.textContent = category;
      option.addEventListener('click', () => {
        updateCategorySelection(category);
        if (isMobile) {
          container.style.display = 'none';
          if (mainFilterBtnMobile) {
            mainFilterBtnMobile.setAttribute('aria-expanded', 'false');
          }
        } else {
          closeDesktopDropdowns();
        }
      });
      container.appendChild(option);
    });

    if (!container.children.length) {
      const empty = document.createElement('div');
      empty.textContent = 'گزینه‌ای موجود نیست';
      empty.style.padding = '12px 20px';
      empty.style.color = '#64748b';
      container.appendChild(empty);
    }
  }


  function populateLocationDropdown(container, isMobile) {
    if (!container) return;
    container.innerHTML = '';
    locations.forEach(location => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'dropdown-item';
      option.dataset.value = location;
      option.textContent = location;
      option.addEventListener('click', () => {
        updateLocationSelection(location);
        if (isMobile) {
          container.style.display = 'none';
          if (shopsBtnMobile) {
            shopsBtnMobile.setAttribute('aria-expanded', 'false');
          }
        } else {
          closeDesktopDropdowns();
        }
      });
      container.appendChild(option);
    });

    if (!container.children.length) {
      const empty = document.createElement('div');
      empty.textContent = 'گزینه‌ای موجود نیست';
      empty.style.padding = '12px 20px';
      empty.style.color = '#64748b';
      container.appendChild(empty);
    }
  }

  function getStoresValue(center) {
    const raw = center && typeof center.stores !== 'undefined' ? center.stores : 0;
    const numeric = typeof raw === 'number' ? raw : parseInt(raw, 10);
    return Number.isNaN(numeric) ? 0 : numeric;
  }

  function getOrderValue(center) {
    if (!center) return 0;
    if (typeof center.order === 'number') return center.order;
    const parsed = parseInt(center.order, 10);
    if (!Number.isNaN(parsed)) return parsed;
    return typeof center.__index === 'number' ? center.__index : 0;
  }

  function filterAndRender() {
    if (!Array.isArray(centersData)) {
      renderCenters([]);
      return;
    }

    const normalizedCategory = (currentCategory || '').toLowerCase();
    const normalizedLocation = (currentLocation || '').toLowerCase();
    filteredCenters = centersData.filter(center => {
      const title = (center.title || '').toLowerCase();
      const description = (center.description || '').toLowerCase();
      const location = (center.location || '').toLowerCase();

      const searchMatch = !searchTerm ||
        title.includes(searchTerm) ||
        description.includes(searchTerm) ||
        location.includes(searchTerm);

      const categoryMatch = normalizedCategory === 'همه مراکز خرید'.toLowerCase() ||
        ((center.tag || '').toLowerCase() === normalizedCategory);

      const locationMatch = normalizedLocation === 'همه مناطق'.toLowerCase() ||
        (normalizedLocation === 'نامشخص' && !location) ||
        location.includes(normalizedLocation);

      return searchMatch && categoryMatch && locationMatch;
    });

    if (currentSort === 'cheap') {
      filteredCenters.sort((a, b) => getStoresValue(a) - getStoresValue(b));
    } else if (currentSort === 'expensive') {
      filteredCenters.sort((a, b) => getStoresValue(b) - getStoresValue(a));
    } else {
      filteredCenters.sort((a, b) => getOrderValue(a) - getOrderValue(b));
    }

    renderCenters(filteredCenters);
    updateSortButtons();
    updateActiveFilters();
  }

  function renderCenters(centers) {
    if (!listDiv) return;
    listDiv.innerHTML = '';

    if (!centers || !centers.length) {
      listDiv.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px;">
          <i class="fas fa-store-slash" style="font-size: 4rem; color: #cbd5e1; margin-bottom: 20px;"></i>
          <h3 style="color: #64748b; font-size: 1.5rem;">مرکز خریدی مطابق فیلترها یافت نشد!</h3>
          <p style="color: #94a3b8; margin-top: 10px;">لطفاً فیلترها یا عبارت جستجو را تغییر دهید</p>
        </div>
      `;
      return;
    }

    centers.forEach((center, index) => {
      const card = document.createElement('div');
      card.className = `center-card fade-in delay-${index % 3}`;
      const imageSrc = center.image || 'https://via.placeholder.com/800x600?text=تصویر+مرکز+خرید';
      const stores = getStoresValue(center);
      const locationText = center.location ? center.location : 'نامشخص';
      const hours = center.hours ? center.hours : 'نامشخص';
      const rawTitle = center.title || '';
      const safeTitle = rawTitle.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      card.innerHTML = `
        <div class="center-img-container">
          <img class="center-img" src="${imageSrc}" alt="${rawTitle}">
          ${center.tag ? `<div class="center-tag">${center.tag}</div>` : ''}
        </div>
        <div class="center-info">
          <h3 class="center-title">${rawTitle}</h3>
          <div class="center-address">
            <i class="fas fa-map-marker-alt"></i> ${locationText}
          </div>
          <p class="center-desc">${center.description || ''}</p>
          <div class="center-meta">
            <span><i class="fas fa-store"></i> ${stores.toLocaleString('fa-IR')} مغازه</span>
            <span><i class="fas fa-clock"></i> ساعات کاری: ${hours}</span>
          </div>
          <div class="center-actions">
            <div class="action-btn btn-primary" onclick="goToShops('${center._id}', '${safeTitle}')">
              <i class="fas fa-list"></i> مشاهده فروشگاه‌ها
            </div>
          </div>
        </div>
      `;
      listDiv.appendChild(card);
    });
  }

  window.goToShops = function(id, title) {
    window.location.href = `shopping-centers-shops.html?centerId=${id}&title=${encodeURIComponent(title)}`;
  };

  function updateCategorySelection(category, options = {}) {
    currentCategory = category || 'همه مراکز خرید';
    const label = currentCategory;
    if (mainFilterBtn) {
      mainFilterBtn.innerHTML = `
        <i class="fas fa-building"></i>
        ${label}
        <i class="fas fa-chevron-down" style="margin-right:7px;font-size:0.95em"></i>
      `;
      mainFilterBtn.classList.toggle('active', currentCategory !== 'همه مراکز خرید');
    }
    if (mainFilterBtnMobile) {
      mainFilterBtnMobile.innerHTML = `
        <i class="fas fa-building"></i>
        <span>${label}</span>
        <i class="fas fa-chevron-down"></i>
      `;
    }
    if (!options.skipFilter) {
      filterAndRender();
    }
  }

  function updateLocationSelection(location, options = {}) {
    currentLocation = location || 'همه مناطق';
    const label = currentLocation;
    if (shopsBtn) {
      shopsBtn.innerHTML = `
        <i class="fas fa-map-marker-alt"></i>
        ${label}
        <i class="fas fa-chevron-down" style="margin-right:7px;font-size:0.95em"></i>
      `;
      shopsBtn.classList.toggle('active', currentLocation !== 'همه مناطق');
    }
    if (shopsBtnMobile) {
      shopsBtnMobile.innerHTML = `
        <i class="fas fa-map-marker-alt"></i>
        <span>${label}</span>
        <i class="fas fa-chevron-down"></i>
      `;
    }
    if (!options.skipFilter) {
      filterAndRender();
    }
  }

  function updateSortButtons() {
    const cheapActive = currentSort === 'cheap';
    const expensiveActive = currentSort === 'expensive';
    if (sortCheapBtn) sortCheapBtn.classList.toggle('active', cheapActive);
    if (sortExpensiveBtn) sortExpensiveBtn.classList.toggle('active', expensiveActive);
    if (sortCheapMobileBtn) sortCheapMobileBtn.classList.toggle('active', cheapActive);
    if (sortExpensiveMobileBtn) sortExpensiveMobileBtn.classList.toggle('active', expensiveActive);
  }

  function updateActiveFilters() {
    if (!activeFiltersContainer) return;
    activeFiltersContainer.innerHTML = '';

    const chips = [];

    if (searchTerm) {
      chips.push({
        label: `جستجو: ${searchInput.value.trim()}`,
        remove: () => {
          searchTerm = '';
          if (searchInput) searchInput.value = '';
          filterAndRender();
        }
      });
    }

    if (currentCategory && currentCategory !== 'همه مراکز خرید') {
      chips.push({
        label: `دسته‌بندی: ${currentCategory}`,
        remove: () => updateCategorySelection('همه مراکز خرید')
      });
    }

    if (currentLocation && currentLocation !== 'همه مناطق') {
      chips.push({
        label: `منطقه: ${currentLocation}`,
        remove: () => updateLocationSelection('همه مناطق')
      });
    }

    if (currentSort) {
      const sortLabel = currentSort === 'cheap' ? 'کمترین تعداد مغازه' : 'بیشترین تعداد مغازه';
      chips.push({
        label: `مرتب‌سازی: ${sortLabel}`,
        remove: () => {
          currentSort = null;
          updateSortButtons();
          filterAndRender();
        }
      });
    }

    if (!chips.length) {
      activeFiltersContainer.style.display = 'none';
      return;
    }

    activeFiltersContainer.style.display = 'flex';
    chips.forEach(chip => {
      const chipElement = document.createElement('div');
      chipElement.className = 'active-filter';
      const textSpan = document.createElement('span');
      textSpan.textContent = chip.label;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', chip.remove);
      chipElement.appendChild(textSpan);
      chipElement.appendChild(removeBtn);
      activeFiltersContainer.appendChild(chipElement);
    });
  }

  function closeDesktopDropdowns() {
    if (filterDropdown) filterDropdown.style.display = 'none';
    if (shopsDropdown) shopsDropdown.style.display = 'none';
  }

  function closeMobileDropdowns() {
    if (filterDropdownMobile) {
      filterDropdownMobile.style.display = 'none';
      filterDropdownMobile.scrollTop = 0;
    }
    if (shopsDropdownMobile) {
      shopsDropdownMobile.style.display = 'none';
      shopsDropdownMobile.scrollTop = 0;
    }
    if (mainFilterBtnMobile) mainFilterBtnMobile.setAttribute('aria-expanded', 'false');
    if (shopsBtnMobile) shopsBtnMobile.setAttribute('aria-expanded', 'false');
  }

  function openMobileFilters() {
    if (!mobileFiltersOverlay || !mobileFiltersPanel) return;
    mobileFiltersOverlay.style.display = 'flex';
    requestAnimationFrame(() => {
      mobileFiltersPanel.classList.add('active');
    });
    if (mobileFilterBtn) mobileFilterBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileFilters() {
    if (!mobileFiltersOverlay || !mobileFiltersPanel) return;
    mobileFiltersPanel.classList.remove('active');
    setTimeout(() => {
      mobileFiltersOverlay.style.display = 'none';
    }, 250);
    if (mobileFilterBtn) mobileFilterBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    closeMobileDropdowns();
  }

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      searchTerm = event.target.value.trim().toLowerCase();
      filterAndRender();
    });
  }

  if (mainFilterBtn) {
    mainFilterBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = filterDropdown && filterDropdown.style.display === 'block';
      closeDesktopDropdowns();
      if (filterDropdown) {
        filterDropdown.style.display = isOpen ? 'none' : 'block';
      }
    });
  }

  if (shopsBtn) {
    shopsBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = shopsDropdown && shopsDropdown.style.display === 'block';
      closeDesktopDropdowns();
      if (shopsDropdown) {
        shopsDropdown.style.display = isOpen ? 'none' : 'block';
      }
    });
  }

  if (sortCheapBtn) {
    sortCheapBtn.addEventListener('click', () => {
      currentSort = currentSort === 'cheap' ? null : 'cheap';
      updateSortButtons();
      filterAndRender();
    });
  }

  if (sortExpensiveBtn) {
    sortExpensiveBtn.addEventListener('click', () => {
      currentSort = currentSort === 'expensive' ? null : 'expensive';
      updateSortButtons();
      filterAndRender();
    });
  }

  if (mobileFilterBtn) {
    mobileFilterBtn.addEventListener('click', openMobileFilters);
  }

  if (closeFiltersBtn) {
    closeFiltersBtn.addEventListener('click', closeMobileFilters);
  }

  if (mobileFiltersOverlay) {
    mobileFiltersOverlay.addEventListener('click', (event) => {
      if (event.target === mobileFiltersOverlay) {
        closeMobileFilters();
      }
    });
  }

  if (mainFilterBtnMobile) {
    mainFilterBtnMobile.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = filterDropdownMobile && filterDropdownMobile.style.display === 'block';
      closeMobileDropdowns();
      if (filterDropdownMobile) {
        filterDropdownMobile.style.display = isOpen ? 'none' : 'block';
        mainFilterBtnMobile.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      }
    });
  }

  if (shopsBtnMobile) {
    shopsBtnMobile.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = shopsDropdownMobile && shopsDropdownMobile.style.display === 'block';
      closeMobileDropdowns();
      if (shopsDropdownMobile) {
        shopsDropdownMobile.style.display = isOpen ? 'none' : 'block';
        shopsBtnMobile.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      }
    });
  }

  if (sortCheapMobileBtn) {
    sortCheapMobileBtn.addEventListener('click', () => {
      currentSort = currentSort === 'cheap' ? null : 'cheap';
      updateSortButtons();
      filterAndRender();
    });
  }

  if (sortExpensiveMobileBtn) {
    sortExpensiveMobileBtn.addEventListener('click', () => {
      currentSort = currentSort === 'expensive' ? null : 'expensive';
      updateSortButtons();
      filterAndRender();
    });
  }

  if (applyFiltersMobileBtn) {
    applyFiltersMobileBtn.addEventListener('click', () => {
      filterAndRender();
      closeMobileFilters();
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.filters-section.desktop')) {
      closeDesktopDropdowns();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDesktopDropdowns();
      closeMobileFilters();
    }
  });
});
