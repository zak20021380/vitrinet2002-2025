  document.addEventListener('DOMContentLoaded', function() {
    // تنظیمات API
    const SHOPS_API = '/api/shop-appearances';
    const PRODUCTS_API = '/api/products';

    const urlParams = new URLSearchParams(window.location.search);
    const centerId = urlParams.get('centerId');
    let centerTitle = urlParams.get('title');
    const fallbackTitle = centerTitle || 'مرکز خرید';

    if (!centerId) {
      // در صورت نبود شناسه، کاربر به صفحه مراکز خرید هدایت می‌شود
      window.location.href = 'all-shopping-centers.html';
      return;
    }

    const centerTitleElement = document.getElementById('center-title');
    const listDiv = document.getElementById('items-list');
    const searchInput = document.getElementById('searchInput'); // اصلاح typo از "searchInput"
    const priceFilter = document.getElementById('priceFilter');
    const categoryFilter = document.getElementById('categoryFilter'); // اصلاح typo از "categoryFilter"
    const filterTabs = document.querySelectorAll('.filter-tab');

    let currentType = 'shops';
    let allItems = [];

    // لود اولیه با اسکلتون
    function showSkeleton() {
      listDiv.innerHTML = '';
      for (let i = 0; i < 6; i++) {
        listDiv.innerHTML += `
          <div class="item-card fade-in delay-${i % 3}">
            <div class="item-card-inner">
              <div class="skeleton skeleton-img"></div>
              <div class="item-info">
                <div class="skeleton skeleton-line" style="height: 26px; width: 70%;"></div>
                <div class="skeleton skeleton-line medium" style="margin-bottom: 6px;"></div>
                <div class="item-meta-grid">
                  <div class="skeleton" style="height: 42px; border-radius: 14px;"></div>
                  <div class="skeleton" style="height: 42px; border-radius: 14px;"></div>
                </div>
              </div>
              <div class="item-actions">
                <div class="skeleton" style="height: 46px; flex: 1; border-radius: 14px;"></div>
              </div>
            </div>
          </div>
        `;
      }
    }

    // فیلتر کردن آیتم‌ها
    function filterItems(items) {
      let filtered = items;
      const term = searchInput.value.trim().toLowerCase();
      if (term) {
        filtered = filtered.filter(item => (item.customUrl || item.title || '').toLowerCase().includes(term));
      }

      if (currentType === 'products') {
        const priceRange = priceFilter.value;
        if (priceRange) {
          const [min, max] = priceRange.split('-').map(v => v ? parseInt(v) : Infinity);
          filtered = filtered.filter(item => {
            const price = parseInt(item.price) || 0;
            return price >= (min || 0) && price < (max || Infinity);
          });
        }

        const category = categoryFilter.value;
        if (category) {
          filtered = filtered.filter(item => (item.category || '').toLowerCase() === category.toLowerCase());
        }
      }

      return filtered;
    }

    // رندر آیتم‌ها
    function renderItems(items) {
      const filtered = filterItems(items);
      listDiv.innerHTML = '';

      if (!filtered.length) {
        listDiv.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px;">
            <i class="fas fa-store-slash" style="font-size: 4rem; color: #cbd5e1; margin-bottom: 20px;"></i>
            <h3 style="color: #64748b; font-size: 1.5rem;">آیتمی یافت نشد!</h3>
          </div>
        `;
        return;
      }

      filtered.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `item-card fade-in delay-${index % 3}`;

        const title = (item.customUrl || item.title || 'بدون عنوان').toString();
        const image = item.shopLogo || item.image || 'https://via.placeholder.com/800x600?text=تصویر';
        const rawPhone = (item.shopPhone || '').toString().trim();
        const phoneLink = rawPhone ? rawPhone.replace(/[^0-9+]/g, '') : '';
        const badgeLabel = currentType === 'shops' ? 'فروشگاه' : 'محصول';
        const badgeClass = currentType === 'shops' ? 'item-badge--shops' : 'item-badge--products';
        const badgeIcon = currentType === 'shops' ? 'fa-bag-shopping' : 'fa-cubes';
        const description = (currentType === 'shops'
          ? (item.shopDescription || item.shopAddress || '')
          : (item.description || item.shopAddress || '')).toString().trim();

        const metaRows = [];
        if (currentType === 'shops') {
          if (rawPhone) {
            metaRows.push(`<div class="item-meta-chip"><i class="fas fa-phone"></i><span>${rawPhone}</span></div>`);
          }
          if (item.shopAddress) {
            metaRows.push(`<div class="item-meta-chip"><i class="fas fa-location-dot"></i><span>${item.shopAddress}</span></div>`);
          }
          if (item.centerTitle || item.centerName) {
            metaRows.push(`<div class="item-meta-chip"><i class="fas fa-building"></i><span>${item.centerTitle || item.centerName}</span></div>`);
          }
        } else {
          if (item.price) {
            metaRows.push(`<div class="item-meta-chip"><i class="fas fa-tag"></i><span>${item.price}</span></div>`);
          }
          if (item.shopName) {
            metaRows.push(`<div class="item-meta-chip"><i class="fas fa-store"></i><span>${item.shopName}</span></div>`);
          }
          if (item.category) {
            metaRows.push(`<div class="item-meta-chip"><i class="fas fa-layer-group"></i><span>${item.category}</span></div>`);
          }
        }

        if (!metaRows.length) {
          metaRows.push(`<div class="item-meta-chip"><i class="fas fa-circle-info"></i><span>اطلاعات تکمیلی ثبت نشده</span></div>`);
        }

        let actionsHtml = '';
        if (currentType === 'shops') {
          if (phoneLink) {
            actionsHtml += `<a class="action-btn btn-ghost" href="tel:${phoneLink}" aria-label="تماس با ${title}"><i class="fas fa-phone"></i> تماس سریع</a>`;
          }
          actionsHtml += `<a class="action-btn btn-primary" href="/shop.html?id=${item._id}" target="_blank" rel="noopener" aria-label="مشاهده ${title}"><i class="fas fa-eye"></i> مشاهده فروشگاه</a>`;
        } else {
          if (item.shopId) {
            actionsHtml += `<a class="action-btn btn-ghost" href="/shop.html?id=${item.shopId}" target="_blank" rel="noopener" aria-label="مشاهده فروشگاه ${item.shopName || ''}"><i class="fas fa-store"></i> صفحه فروشگاه</a>`;
          }
          actionsHtml += `<a class="action-btn btn-primary" href="/product.html?id=${item._id}" target="_blank" rel="noopener" aria-label="مشاهده ${title}"><i class="fas fa-eye"></i> مشاهده محصول</a>`;
        }

        card.innerHTML = `
          <div class="item-card-inner">
            <div class="item-img-container">
              <img class="item-img" loading="lazy" src="${image}" alt="${title}">
              <span class="item-badge ${badgeClass}"><i class="fas ${badgeIcon}"></i>${badgeLabel}</span>
            </div>
            <div class="item-info">
              <h3 class="item-title">${title}</h3>
              ${description ? `<p class="item-desc">${description}</p>` : '<p class="item-desc">اطلاعاتی ثبت نشده است</p>'}
              <div class="item-meta-grid">
                ${metaRows.join('')}
              </div>
            </div>
            <div class="item-actions">
              ${actionsHtml}
            </div>
          </div>
        `;
        listDiv.appendChild(card);
      });
    }

    // لو داده‌ها
    async function loadData(type) {
      showSkeleton();
      currentType = type;
      const params = new URLSearchParams();
      if (centerTitle) {
        params.set('centerTitle', centerTitle);
      }
      if (centerId) {
        params.set('centerId', centerId);
      }
      const queryString = params.toString();
      const baseUrl = type === 'shops' ? SHOPS_API : PRODUCTS_API;
      const api = queryString ? `${baseUrl}?${queryString}` : baseUrl;

      try {
        const res = await fetch(api);
        if (!res.ok) throw new Error('API error');
        allItems = await res.json();
        renderItems(allItems);
      } catch (err) {
        console.error(err);
        listDiv.innerHTML = `<div style="text-align: center; padding: 50px;">خطا در بارگذاری داده‌ها! لطفاً دوباره امتحان کنید.</div>`;
      }
    }

    // سوئیچ تب
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadData(tab.dataset.type);
      });
    });

    // جستجو و فیلترها
    searchInput.addEventListener('input', () => renderItems(allItems));
    priceFilter.addEventListener('change', () => renderItems(allItems));
    categoryFilter.addEventListener('change', () => renderItems(allItems));

    async function loadCenterInfo() {
      try {
        const response = await fetch(`/api/shopping-centers/${centerId}`);
        if (response.ok) {
          const centerData = await response.json();
          if (centerData?.title) {
            centerTitle = centerData.title;
          }
        }
      } catch (error) {
        console.error('خطا در دریافت اطلاعات مرکز خرید:', error);
      }

      if (!centerTitle) {
        centerTitle = fallbackTitle;
      }

      centerTitleElement.textContent = `مغازه‌ها و محصولات ${centerTitle}`;
    }

    // لود اولیه
    (async () => {
      await loadCenterInfo();
      loadData('shops');
    })();
  });
