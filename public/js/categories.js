(() => {
  const categories = [
    { name: "خوراک", color: "from-[#22d3ee] to-[#43e97b]", desc: "مواد غذایی، سوپرمارکت، رستوران، فست‌فود، کافه", catId: "food" },
    { name: "پوشاک", color: "from-[#36d1c4] to-[#49e7b7]", desc: "لباس مردانه، زنانه، بچگانه، کفش و کیف", catId: "clothing" },
    { name: "زیبایی", color: "from-[#15e6c8] to-[#0ea5e9]", desc: "آرایشی، بهداشتی، سالن زیبایی و سلامت", catId: "beauty" },
    { name: "خدمات", color: "from-[#0ea5e9] to-[#0bd6b3]", desc: "تعمیرات، آموزشی، رفاهی، خدمات شهری", catId: "service" },
    { name: "دیجیتال", color: "from-[#22d3ee] to-[#16e387]", desc: "موبایل، لپ‌تاپ، کالای دیجیتال، لوازم جانبی", catId: "digital" },
    { name: "کتاب و تحریر", color: "from-[#c4b5fd] to-[#8b5cf6]", desc: "کتاب، لوازم تحریر، لوازم اداری", catId: "book" },
    { name: "خودرو", color: "from-[#21d4fd] to-[#2152ff]", desc: "قطعات یدکی، خدمات خودرو، لوازم جانبی", catId: "auto" },
    { name: "قنادی و شیرینی", color: "from-[#fbbf24] to-[#f59e0b]", desc: "قنادی، شیرینی فروشی، نان فانتزی", catId: "sweets" },
    { name: "گل و گیاه", color: "from-[#bbf7d0] to-[#10b981]", desc: "گل فروشی، گیاهان آپارتمانی", catId: "flower" },
    { name: "لوازم خانگی", color: "from-[#fee2e2] to-[#fecdd3]", desc: "لوازم منزل، برقی، آشپزخانه", catId: "home" },
    { name: "ورزشی", color: "from-[#21d4fd] to-[#43e97b]", desc: "پوشاک ورزشی، باشگاه، لوازم ورزش", catId: "sport" },
    { name: "تالار و مجالس", color: "from-[#fecdd3] to-[#fef9c3]", desc: "تالار پذیرایی، خدمات مجالس", catId: "talar" }
  ];

  let activeCategories = [];
  let allShops = [];

  const escapeHtml = (value = "") =>
    value
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const getCategoryIcon = (id) => `
    <svg viewBox="0 0 48 48" fill="none">
      <rect x="4" y="7" width="40" height="27" rx="7" fill="url(#g${id})"/>
      <defs>
        <linearGradient id="g${id}" x1="0" y1="0" x2="48" y2="44" gradientUnits="userSpaceOnUse">
          <stop stop-color="#10b981"/>
          <stop offset="1" stop-color="#0ea5e9"/>
        </linearGradient>
      </defs>
      <rect x="13" y="17" width="22" height="6" rx="2.3" fill="#fff" opacity=".6"/>
      <rect x="17" y="26" width="14" height="3" rx="1.2" fill="#fff" opacity=".4"/>
    </svg>
  `;

  const renderCategories = (list) => {
    const grid = document.getElementById("categoriesGrid");
    const noResult = document.getElementById("noResult");

    if (!grid || !noResult) {
      return;
    }

    if (!Array.isArray(list) || list.length === 0) {
      grid.innerHTML = "";
      noResult.classList.remove("hidden");
      return;
    }

    noResult.classList.add("hidden");

    const cards = list
      .map((cat) => {
        const count = Array.isArray(cat.shops) ? cat.shops.length : 0;
        const sampleShop = count > 0 ? cat.shops[0] : null;
        const sampleShopName = sampleShop
          ? escapeHtml(sampleShop.storename || sampleShop.shopName || sampleShop.title || "")
          : "";
        const sampleShopUrl = sampleShop
          ? encodeURIComponent(sampleShop.shopurl || sampleShop.shopUrl || "")
          : "";

        const info = count
          ? `
              <span class="shop-badge"><i class="ri-store-2-line"></i>${count} فروشگاه</span>
              ${sampleShop && sampleShopUrl ? `<a href="shop.html?shopurl=${sampleShopUrl}" target="_blank" rel="noopener noreferrer" class="sample-link" aria-label="نمونه فروشگاه ${sampleShopName}">نمونه: ${sampleShopName}</a>` : ""}
            `
          : '<span class="no-shop-text">بدون فروشگاه</span>';

        const categoryId = escapeHtml(cat.catId);
        const categoryName = escapeHtml(cat.name);
        const categoryDesc = escapeHtml(cat.desc);

        return `
          <article class="category-card group" data-slug="${categoryId}">
            <div class="category-card__top bg-gradient-to-br ${cat.color}">
              <div class="cat-icon">${getCategoryIcon(categoryId)}</div>
              <div class="category-card__headline">
                <span class="category-chip">#${categoryId}</span>
                <h3 class="category-title">${categoryName}</h3>
              </div>
            </div>
            <div class="category-card__content">
              <p class="category-desc">${categoryDesc}</p>
            </div>
            <div class="category-meta">
              ${info}
            </div>
            <a href="shops-by-category.html?cat=${encodeURIComponent(cat.catId)}" class="btn-grad category-card__cta" aria-label="مشاهده فروشگاه‌های ${categoryName}">
              <span>
                مشاهده فروشگاه‌ها
                <i class="ri-arrow-left-down-line text-lg"></i>
              </span>
            </a>
          </article>
        `;
      })
      .join("");

    grid.innerHTML = cards;
  };

  const getCategoryNameById = (catId) => {
    const cat = categories.find((c) => c.catId === catId || c.name === catId);
    return cat ? cat.name : null;
  };

  const displaySearchResults = (matchedCategories, matchedShops, query) => {
    const searchResults = document.getElementById("searchResults");
    if (!searchResults) {
      return;
    }

    if (matchedCategories.length === 0 && matchedShops.length === 0) {
      const safeQuery = escapeHtml(query);
      searchResults.innerHTML = `
        <div class="search-empty">
          <i class="ri-search-line"></i>
          <div class="search-empty-text">نتیجه‌ای برای "${safeQuery}" یافت نشد</div>
        </div>
      `;
      searchResults.classList.add("active");
      return;
    }

    let html = "";

    if (matchedCategories.length > 0) {
      html += matchedCategories
        .map((cat) => {
          const shopCount = Array.isArray(cat.shops) ? cat.shops.length : 0;
          const safeName = escapeHtml(cat.name);
          const safeDesc = escapeHtml(cat.desc);
          const categoryLink = `shops-by-category.html?cat=${encodeURIComponent(cat.catId)}`;

          return `
            <a class="search-result-item" href="${categoryLink}">
              <div class="search-result-icon">
                <i class="ri-layout-grid-line"></i>
              </div>
              <div class="search-result-content">
                <div class="search-result-title">${safeName}</div>
                <div class="search-result-desc">${safeDesc}</div>
              </div>
              <span class="search-result-badge category">${shopCount} فروشگاه</span>
            </a>
          `;
        })
        .join("");
    }

    if (matchedShops.length > 0) {
      html += matchedShops
        .map((shop) => {
          const shopName = escapeHtml(shop.storename || shop.shopName || "بدون نام");
          const shopDesc = escapeHtml(shop.description || shop.desc || "بدون توضیحات");
          const baseUrl = shop.shopurl || shop.shopUrl || "";
          const encodedUrl = encodeURIComponent(baseUrl);
          const categoryName = escapeHtml(getCategoryNameById(shop.category) || shop.category || "عمومی");
          const linkHref = encodedUrl ? `shop.html?shopurl=${encodedUrl}` : "#";

          return `
            <a class="search-result-item" href="${linkHref}">
              <div class="search-result-icon">
                <i class="ri-store-2-line"></i>
              </div>
              <div class="search-result-content">
                <div class="search-result-title">${shopName}</div>
                <div class="search-result-desc">${categoryName} • ${shopDesc}</div>
              </div>
              <span class="search-result-badge shop">فروشگاه</span>
            </a>
          `;
        })
        .join("");
    }

    searchResults.innerHTML = html;
    searchResults.classList.add("active");
  };

  const performSearch = () => {
    const searchInput = document.getElementById("searchInput");
    const searchResults = document.getElementById("searchResults");

    if (!searchInput || !searchResults) {
      return;
    }

    const query = searchInput.value.trim().toLowerCase();

    if (!query) {
      searchResults.classList.remove("active");
      searchResults.innerHTML = "";
      return;
    }

    const matchedCategories = activeCategories
      .filter((cat) => {
        const name = (cat.name || "").toLowerCase();
        const desc = (cat.desc || "").toLowerCase();
        return name.includes(query) || desc.includes(query);
      })
      .slice(0, 3);

    const matchedShops = allShops
      .filter((shop) => {
        const shopName = (shop.storename || shop.shopName || "").toLowerCase();
        const shopDesc = (shop.description || shop.desc || "").toLowerCase();
        const shopCategory = (shop.category || "").toLowerCase();
        return (
          shopName.includes(query) ||
          shopDesc.includes(query) ||
          shopCategory.includes(query)
        );
      })
      .slice(0, 8);

    displaySearchResults(matchedCategories, matchedShops, query);
  };

  const setupSearchInteractions = () => {
    const searchWrapper = document.querySelector(".search-wrapper");
    const searchResults = document.getElementById("searchResults");
    const searchInput = document.getElementById("searchInput");

    if (!searchWrapper || !searchResults || !searchInput) {
      return;
    }

    const searchForm = searchWrapper.querySelector("form");
    if (searchForm) {
      searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        performSearch();
      });
    }

    let searchTimeout;
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = window.setTimeout(() => {
        performSearch();
      }, 300);
    });

    searchInput.addEventListener("keyup", (event) => {
      if (event.key === "Enter") {
        clearTimeout(searchTimeout);
        performSearch();
      }
    });

    document.addEventListener("click", (event) => {
      if (!searchWrapper.contains(event.target)) {
        searchResults.classList.remove("active");
      }
    });
  };

  const initCategoriesPage = async () => {
    const errorBox = document.getElementById("errorMessage");
    if (errorBox) {
      errorBox.textContent = "";
      errorBox.classList.add("hidden");
    }

    try {
      const response = await fetch("/api/shops");
      const shops = response.ok ? await response.json() : [];
      allShops = Array.isArray(shops) ? shops : [];
      activeCategories = categories.map((category) => ({
        ...category,
        shops: allShops.filter((shop) =>
          shop.category === category.catId ||
          shop.category === category.name ||
          shop.categorySlug === category.catId
        )
      }));
    } catch (error) {
      allShops = [];
      activeCategories = categories.map((category) => ({ ...category, shops: [] }));
      if (errorBox) {
        errorBox.textContent = "خطا در دریافت اطلاعات. لطفا بعدا تلاش کنید.";
        errorBox.classList.remove("hidden");
      }
    }

    activeCategories.sort((a, b) => {
      const aCount = Array.isArray(a.shops) ? a.shops.length : 0;
      const bCount = Array.isArray(b.shops) ? b.shops.length : 0;
      return bCount - aCount;
    });

    renderCategories(activeCategories);
    setupSearchInteractions();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCategoriesPage);
  } else {
    initCategoriesPage();
  }
})();
