// Vitreenet mobile bottom navigation
(function() {
  const NAV_STYLE_ID = 'vitreenet-mobile-nav-style';
  const BODY_READY_CLASS = 'has-mobile-nav';
  const NAV_READY_CLASS = 'vitreenet-mobile-nav';
  const SERVICE_PANEL_KEYWORDS = ['خدمات'];

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;

  function safeParseLocalStorage(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('[Vitreenet] Failed to parse localStorage item:', key, error);
      return null;
    }
  }

  function isServiceSellerAccount(seller) {
    if (!seller || typeof seller !== 'object') return false;
    const category = (seller.category || seller.sellerCategory || '').toString().trim();
    const normalizedCategory = category.normalize('NFC');

    return SERVICE_PANEL_KEYWORDS.some(keyword => normalizedCategory === keyword);
  }

  function buildSellerPanelLink(seller) {
    const baseUrl = isServiceSellerAccount(seller)
      ? 'service-seller-panel/s-seller-panel.html'
      : 'seller/dashboard.html';
    const shopurl = seller?.shopurl || seller?.shopUrl || seller?.slug || '';
    const query = shopurl ? `?shopurl=${encodeURIComponent(shopurl)}` : '';
    return `${baseUrl}${query}`;
  }

  function hasValidSellerProfile(seller) {
    if (!seller || typeof seller !== 'object') return false;

    const sellerId = seller._id || seller.id || seller.sellerId;
    const sellerSlug = seller.shopurl || seller.shopUrl || seller.slug;

    return Boolean(sellerId || (typeof sellerSlug === 'string' && sellerSlug.trim())) || isServiceSellerAccount(seller);
  }

  function updateAuthNavigationState() {
    const loginLink = document.getElementById('loginNavLink');
    const loginMobile = document.getElementById('loginMobileLink');
    const desktopLabel = loginLink?.querySelector('.login-link-label');
    const mobileLabel = loginMobile?.querySelector('.login-mobile-label');

    if (!loginLink && !loginMobile) return;

    const token = localStorage.getItem('token');
    const seller = safeParseLocalStorage('seller');
    const user = safeParseLocalStorage('user');

    let targetUrl = 'login.html';
    let labelText = 'ورود';
    let accountType = '';

    if (token && user && typeof user === 'object') {
      targetUrl = 'user/dashboard.html';
      labelText = 'پنل من';
      accountType = 'customer';
    } else if (token && hasValidSellerProfile(seller)) {
      targetUrl = buildSellerPanelLink(seller);
      labelText = 'پنل فروشنده';
      accountType = 'seller';
    }

    if (loginLink) {
      loginLink.href = targetUrl;
      if (accountType) {
        loginLink.classList.add('logged-in');
        loginLink.setAttribute('data-account-type', accountType);
      } else {
        loginLink.classList.remove('logged-in');
        loginLink.removeAttribute('data-account-type');
      }
      if (desktopLabel) desktopLabel.textContent = labelText;
    }

    if (loginMobile) {
      loginMobile.href = targetUrl;
      if (accountType) {
        loginMobile.classList.add('logged-in');
        loginMobile.setAttribute('data-account-type', accountType);
      } else {
        loginMobile.classList.remove('logged-in');
        loginMobile.removeAttribute('data-account-type');
      }
      if (mobileLabel) mobileLabel.textContent = labelText;
    }
  }

  function appendSvgContent(svgElement, markup) {
    if (!svgElement || !markup) return;

    if (!parser) {
      // Fallback: attempt to set innerHTML for environments without DOMParser support
      svgElement.innerHTML = markup;
      return;
    }

    try {
      const doc = parser.parseFromString(`<svg xmlns="${SVG_NS}">${markup}</svg>`, 'image/svg+xml');
      const parserError = doc.getElementsByTagName('parsererror');
      if (parserError && parserError.length > 0) {
        console.warn('[Vitreenet] Failed to parse SVG markup for mobile nav icon.');
        return;
      }

      const nodes = doc.documentElement ? Array.from(doc.documentElement.childNodes) : [];
      nodes.forEach((node) => {
        if (typeof Node === 'undefined' || node.nodeType === Node.ELEMENT_NODE) {
          svgElement.appendChild(document.importNode(node, true));
        }
      });
    } catch (error) {
      console.warn('[Vitreenet] Error while parsing SVG markup for mobile nav icon.', error);
    }
  }

  const NAV_ITEMS = [
    {
      id: 'mobileNavHome',
      href: '/index.html',
      label: 'خانه',
      icon: '<path d="M3 10.75 12 3l9 7.75V20a1.5 1.5 0 0 1-1.5 1.5H15a1.5 1.5 0 0 1-1.5-1.5v-4.25h-3V20A1.5 1.5 0 0 1 9 21.5H4.5A1.5 1.5 0 0 1 3 20v-9.25Z" fill="currentColor"/><path d="M9.5 21.5v-5.25A1.25 1.25 0 0 1 10.75 15h2.5A1.25 1.25 0 0 1 14.5 16.25V21.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      matches: ['/', '/index.html', 'index.html']
    },
    {
      id: 'mobileNavCategories',
      href: '/categories.html',
      label: 'دسته‌بندی',
      icon: '<path d="M4 4.5h6a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 10 13.5H4A1.5 1.5 0 0 1 2.5 12V6A1.5 1.5 0 0 1 4 4.5Z" fill="currentColor"/><path d="M14 4.5h6a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 20 13.5h-6a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 14 4.5Z" fill="currentColor"/><path d="M4 14.5h6A1.5 1.5 0 0 1 11.5 16v4A1.5 1.5 0 0 1 10 21.5H4A1.5 1.5 0 0 1 2.5 20v-4A1.5 1.5 0 0 1 4 14.5Z" fill="currentColor"/><path d="M14 14.5h6a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 20 21.5h-6a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5Z" fill="currentColor"/>',
      matches: [
        '/categories.html',
        'categories.html',
        '/shops-by-category.html',
        'shops-by-category.html',
        '/all-products.html',
        'all-products.html',
        '/all-shops.html',
        'all-shops.html',
        '/all-shopping-centers.html',
        'all-shopping-centers.html',
        '/shopping-centers-shops.html',
        'shopping-centers-shops.html',
        '/shop.html',
        'shop.html',
        '/product.html',
        'product.html',
        '/pad-shops.html',
        'pad-shops.html',
        '/city-explore.html',
        'city-explore.html'
      ]
    },
    {
      id: 'mobileNavServices',
      href: '/shops-by-category.html?cat=service',
      label: 'خدمات',
      icon: '<path d="M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8.25v7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M8.25 12h7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      matches: [
        '/service-directory.html',
        'service-directory.html',
        '/service-shops.html',
        'service-shops.html',
        '/service-seller-panel',
        'service-seller-panel',
        '/service-seller-panel/',
        'service-seller-panel/',
        '/seller-paneel.html',
        'seller-paneel.html'
      ]
    },
    {
      id: 'loginMobileLink',
      href: '/login.html',
      label: 'ورود',
      icon: '<path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 1.5c-3 0-6.5 1.54-6.5 4.5v.5A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5v-.5c0-2.96-3.5-4.5-6.5-4.5Z" fill="currentColor"/>',
      labelClass: 'login-mobile-label',
      extraClass: 'nav-item-account',
      matches: [
        '/login.html',
        'login.html',
        '/register.html',
        'register.html',
        '/verify.html',
        'verify.html',
        '/verify-user.html',
        'verify-user.html',
        '/user/dashboard.html',
        'user/dashboard.html',
        '/user-panel.html',
        'user-panel.html',
        '/seller/dashboard.html',
        'seller/dashboard.html',
        '/service-seller-panel/s-seller-panel.html',
        'service-seller-panel/s-seller-panel.html'
      ]
    }
  ];

  function normalisePath(pathname) {
    if (!pathname) return 'index.html';
    let cleaned = pathname;
    if (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1) || '/';
    return cleaned || '/';
  }

  function ensureStyle() {
    if (document.getElementById(NAV_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = NAV_STYLE_ID;
    style.textContent = `
      @media (max-width: 1024px) {
        body.${BODY_READY_CLASS} {
          padding-bottom: calc(110px + env(safe-area-inset-bottom, 0px));
        }

        body.${BODY_READY_CLASS}.hide-mobile-nav {
          padding-bottom: 0 !important;
        }

        footer:not(.mobile-nav) {
          display: none !important;
        }

        .mobile-nav {
          display: flex !important;
          position: fixed;
          inset-inline: 0;
          bottom: 0;
          z-index: 1000;
          height: calc(100px + env(safe-area-inset-bottom, 0px));
          padding: 14px 20px calc(16px + env(safe-area-inset-bottom, 0px));
          background: linear-gradient(180deg, rgba(255,250,245,0.98), rgba(241,226,210,0.98));
          backdrop-filter: blur(20px);
          border-radius: 32px 32px 0 0;
          border-top: 1.5px solid rgba(250, 204, 170, 0.5);
          box-shadow: 0 -16px 45px rgba(15, 23, 42, 0.14);
          justify-content: space-between;
          gap: 8px;
          transition: transform 0.3s ease, opacity 0.3s ease;
        }

        body.hide-mobile-nav .mobile-nav {
          transform: translateY(110%);
          opacity: 0;
          pointer-events: none;
          visibility: hidden;
        }

        .mobile-nav .nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #64748b;
          text-decoration: none;
          font-weight: 600;
          gap: 8px;
          padding: 12px 10px;
          border-radius: 22px;
          transition: transform 0.2s ease, color 0.2s ease, background 0.25s ease, box-shadow 0.25s ease;
        }

        .mobile-nav .nav-item:active {
          transform: scale(0.94);
        }

        .mobile-nav .nav-item svg {
          width: 30px;
          height: 30px;
          color: inherit;
        }

        .mobile-nav .nav-item .nav-label {
          font-size: 13px;
          font-weight: 700;
          line-height: 1.2;
        }

        .mobile-nav .nav-item.active {
          color: #047857;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(14, 165, 233, 0.14) 100%);
          box-shadow: 
            inset 0 0 0 2px rgba(16, 185, 129, 0.35),
            0 6px 16px rgba(16, 185, 129, 0.18);
          transform: translateY(-5px);
          border-radius: 24px;
        }

        .mobile-nav .nav-item.active svg {
          color: #047857;
          filter: drop-shadow(0 3px 6px rgba(16, 185, 129, 0.35));
          transform: scale(1.15);
        }

        .mobile-nav .nav-item.active .nav-label {
          font-weight: 800;
          color: #047857;
        }
      }

      @media (min-width: 1025px) {
        .mobile-nav {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createNavItem(config) {
    const link = document.createElement('a');
    link.className = 'nav-item';
    link.href = config.href;
    link.setAttribute('id', config.id);

    if (config.extraClass) {
      link.classList.add(config.extraClass);
    }

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('aria-hidden', 'true');
    appendSvgContent(icon, config.icon);
    icon.classList.add('nav-icon');

    const label = document.createElement('span');
    label.className = 'nav-label';
    if (config.labelClass) {
      label.classList.add(config.labelClass);
    }
    label.textContent = config.label;

    link.appendChild(icon);
    link.appendChild(label);

    return link;
  }

  function getCurrentPath() {
    const { pathname } = window.location;
    return normalisePath(pathname);
  }

  function getCurrentSearch() {
    return window.location.search || '';
  }

  function isServiceCategoryPage() {
    const pathname = getCurrentPath();
    const search = getCurrentSearch();
    const params = new URLSearchParams(search);
    const cat = params.get('cat');
    
    // Check if we're on shops-by-category.html with cat=service
    const isShopsByCategoryPage = pathname.includes('shops-by-category.html');
    const isServiceCategory = cat === 'service';
    
    return isShopsByCategoryPage && isServiceCategory;
  }

  function matchesCurrent(config, currentPath) {
    if (!Array.isArray(config.matches)) return false;
    
    // Special handling for service category page
    // If we're on shops-by-category.html?cat=service, only mobileNavServices should match
    if (isServiceCategoryPage()) {
      if (config.id === 'mobileNavServices') return true;
      if (config.id === 'mobileNavCategories') return false;
    }
    
    return config.matches.some(match => {
      if (!match) return false;
      
      // Normalize the match pattern
      const normalizedMatch = match.startsWith('/') ? match : `/${match}`;
      const normalizedCurrent = currentPath.startsWith('/') ? currentPath : `/${currentPath}`;
      
      // Exact match check
      if (normalizedCurrent === normalizedMatch) return true;
      
      // Handle root/index page
      if (match === '/' || match === '/index.html' || match === 'index.html') {
        return normalizedCurrent === '/' || 
               normalizedCurrent === '/index.html' || 
               normalizedCurrent.endsWith('/index.html');
      }
      
      // For file paths (ending with .html), require exact match
      if (match.endsWith('.html')) {
        return normalizedCurrent === normalizedMatch || 
               normalizedCurrent.endsWith(normalizedMatch);
      }
      
      // For directory-style paths, check if current path starts with it
      // but only if the match doesn't end with .html
      if (match.endsWith('/')) {
        return normalizedCurrent.startsWith(normalizedMatch.slice(0, -1) + '/') ||
               normalizedCurrent.startsWith(normalizedMatch);
      }
      
      return false;
    });
  }

  function setActiveState(nav) {
    if (!nav) return;
    const currentPath = getCurrentPath();
    const items = nav.querySelectorAll('.nav-item');

    // First pass: find all matching items
    const matchingItems = [];
    items.forEach((item) => {
      const config = NAV_ITEMS.find(entry => entry.id === item.id);
      if (config && matchesCurrent(config, currentPath)) {
        matchingItems.push({ item, config });
      }
    });

    // Determine which item should be active (most specific match wins)
    // Priority: exact match > longer path match > first match
    let activeItem = null;
    if (matchingItems.length === 1) {
      activeItem = matchingItems[0].item;
    } else if (matchingItems.length > 1) {
      // Find the most specific match
      // Home page should only be active on exact index.html match
      const isHomePage = currentPath === '/' || currentPath === '/index.html' || currentPath.endsWith('/index.html');
      
      if (isHomePage) {
        // On home page, only home nav should be active
        const homeItem = matchingItems.find(m => m.config.id === 'mobileNavHome');
        activeItem = homeItem ? homeItem.item : matchingItems[0].item;
      } else {
        // For other pages, prefer non-home items and find most specific match
        const nonHomeItems = matchingItems.filter(m => m.config.id !== 'mobileNavHome');
        if (nonHomeItems.length > 0) {
          // Sort by specificity (longer match paths are more specific)
          nonHomeItems.sort((a, b) => {
            const aMaxLen = Math.max(...(a.config.matches || []).filter(m => currentPath.includes(m.replace(/^\//, ''))).map(m => m.length));
            const bMaxLen = Math.max(...(b.config.matches || []).filter(m => currentPath.includes(m.replace(/^\//, ''))).map(m => m.length));
            return bMaxLen - aMaxLen;
          });
          activeItem = nonHomeItems[0].item;
        } else {
          activeItem = matchingItems[0].item;
        }
      }
    }

    // Apply active state
    items.forEach((item) => {
      if (item === activeItem) {
        item.classList.add('active');
        item.setAttribute('aria-current', 'page');
      } else {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
      }
    });
  }

  function initialiseNav() {
    const body = document.body;
    if (!body) return null;

    const currentPath = getCurrentPath();
    const disableNav =
      currentPath.startsWith('/seller/') ||
      currentPath.startsWith('/hesabketab/');

    if (disableNav) {
      const existingNav = document.querySelector('footer.mobile-nav');
      if (existingNav) {
        existingNav.remove();
      }
      body.classList.remove(BODY_READY_CLASS);
      body.classList.add('hide-mobile-nav');
      return null;
    }

    ensureStyle();

    let nav = document.querySelector('footer.mobile-nav');
    if (!nav) {
      nav = document.createElement('footer');
      nav.className = 'mobile-nav hidden';
      nav.setAttribute('role', 'navigation');
      nav.setAttribute('aria-label', 'ناوبری موبایل');
      body.appendChild(nav);
    } else {
      nav.innerHTML = '';
    }

    NAV_ITEMS.forEach(config => {
      const item = createNavItem(config);
      nav.appendChild(item);
    });

    nav.classList.remove('hidden');
    nav.classList.add(NAV_READY_CLASS);
    body.classList.add(BODY_READY_CLASS);

    setActiveState(nav);

    updateAuthNavigationState();

    document.dispatchEvent(new CustomEvent('mobileNavReady', { detail: { nav } }));

    return nav;
  }

  let navElement = null;

  window.addEventListener('DOMContentLoaded', () => {
    navElement = initialiseNav();
  });

  window.addEventListener('storage', (event) => {
    if (!event.key || ['token', 'seller', 'user'].includes(event.key)) {
      updateAuthNavigationState();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateAuthNavigationState();
    }
  });

  document.addEventListener('mobileNavReady', () => {
    updateAuthNavigationState();
  });

  window.addEventListener('hashchange', () => setActiveState(navElement));
  window.addEventListener('popstate', () => setActiveState(navElement));
})();
