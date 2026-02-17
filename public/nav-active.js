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
      iconOutline: '<path d="M3 10.75 12 3l9 7.75V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-9.25Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.5 21.5v-5.25A1.25 1.25 0 0 1 10.75 15h2.5A1.25 1.25 0 0 1 14.5 16.25V21.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      iconFilled: '<path d="M3 10.75 12 3l9 7.75V20a1.5 1.5 0 0 1-1.5 1.5H15a1.5 1.5 0 0 1-1.5-1.5v-4.25h-3V20A1.5 1.5 0 0 1 9 21.5H4.5A1.5 1.5 0 0 1 3 20v-9.25Z" fill="currentColor"/><path d="M9.5 21.5v-5.25A1.25 1.25 0 0 1 10.75 15h2.5A1.25 1.25 0 0 1 14.5 16.25V21.5" stroke="white" stroke-width="1.2" stroke-linecap="round"/>',
      matches: ['/', '/index.html', 'index.html']
    },
    {
      id: 'mobileNavCategories',
      href: '/categories.html',
      label: 'دسته‌بندی',
      icon: '<path d="M4 4.5h6a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 10 13.5H4A1.5 1.5 0 0 1 2.5 12V6A1.5 1.5 0 0 1 4 4.5Z" fill="currentColor"/><path d="M14 4.5h6a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 20 13.5h-6a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 14 4.5Z" fill="currentColor"/><path d="M4 14.5h6A1.5 1.5 0 0 1 11.5 16v4A1.5 1.5 0 0 1 10 21.5H4A1.5 1.5 0 0 1 2.5 20v-4A1.5 1.5 0 0 1 4 14.5Z" fill="currentColor"/><path d="M14 14.5h6a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 20 21.5h-6a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5Z" fill="currentColor"/>',
      iconOutline: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/>',
      iconFilled: '<path d="M4 4.5h6a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 10 13.5H4A1.5 1.5 0 0 1 2.5 12V6A1.5 1.5 0 0 1 4 4.5Z" fill="currentColor"/><path d="M14 4.5h6a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 20 13.5h-6a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 14 4.5Z" fill="currentColor"/><path d="M4 14.5h6A1.5 1.5 0 0 1 11.5 16v4A1.5 1.5 0 0 1 10 21.5H4A1.5 1.5 0 0 1 2.5 20v-4A1.5 1.5 0 0 1 4 14.5Z" fill="currentColor"/><path d="M14 14.5h6a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 20 21.5h-6a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5Z" fill="currentColor"/>',
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
      iconOutline: '<path d="M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 8.25v7.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M8.25 12h7.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      iconFilled: '<path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z" fill="currentColor"/><path d="M12 8.25v7.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/><path d="M8.25 12h7.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/>',
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
      iconOutline: '<path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 19v-.5c0-2.96 3.5-4.5 6.5-4.5s6.5 1.54 6.5 4.5v.5A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19Z" fill="none" stroke="currentColor" stroke-width="1.7"/>',
      iconFilled: '<path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 1.5c-3 0-6.5 1.54-6.5 4.5v.5A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5v-.5c0-2.96-3.5-4.5-6.5-4.5Z" fill="currentColor"/>',
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
          padding-bottom: calc(112px + env(safe-area-inset-bottom, 0px));
        }

        body.${BODY_READY_CLASS}.hide-mobile-nav {
          padding-bottom: 0 !important;
        }

        footer:not(.mobile-nav) {
          display: none !important;
        }

        .mobile-nav,
        .mobile-bottom-nav {
          display: flex !important;
          position: fixed;
          left: 16px;
          right: 16px;
          bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          z-index: 1000;
          height: 76px;
          padding: 8px;
          background: #fff;
          border-radius: 26px;
          border: 1px solid rgba(15, 23, 42, 0.06);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          backdrop-filter: saturate(1.1) blur(14px);
          -webkit-backdrop-filter: saturate(1.1) blur(14px);
          justify-content: space-between;
          align-items: center;
          gap: 6px;
          overflow: hidden;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .mobile-nav-indicator {
          position: absolute;
          top: 0;
          left: 0;
          width: 72px;
          height: 52px;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.1);
          opacity: 0;
          pointer-events: none;
          transform: translate3d(0, 12px, 0);
          transition: transform 0.2s ease, width 0.2s ease, opacity 0.2s ease;
          z-index: 0;
        }

        .mobile-bottom-nav ul {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          height: 100%;
          gap: 6px;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .mobile-bottom-nav li {
          flex: 1;
          min-width: 0;
        }

        body.hide-mobile-nav .mobile-nav {
          transform: translateY(140%);
          opacity: 0;
          pointer-events: none;
          visibility: hidden;
        }

        body.hide-mobile-nav .mobile-bottom-nav {
          transform: translateY(140%);
          opacity: 0;
          pointer-events: none;
          visibility: hidden;
        }

        .mobile-nav .nav-item,
        .mobile-bottom-nav .nav-item {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          min-width: 44px;
          height: 100%;
          color: #64748b;
          text-decoration: none;
          font-weight: 400;
          gap: 4px;
          padding: 6px 4px;
          border-radius: 16px;
          transition: transform 0.2s ease, color 0.2s ease, background-color 0.2s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .mobile-nav .nav-item:focus-visible,
        .mobile-bottom-nav .nav-item:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.24);
        }

        .mobile-nav .nav-item:active,
        .mobile-bottom-nav .nav-item:active {
          transform: scale(1.05);
        }

        .mobile-nav .nav-icon-wrap,
        .mobile-bottom-nav .nav-icon-wrap {
          position: relative;
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }

        .mobile-nav .nav-item svg,
        .mobile-bottom-nav .nav-item svg {
          width: 24px;
          height: 24px;
          color: inherit;
          position: absolute;
          inset: 0;
          transform-origin: center;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .mobile-nav .nav-item .nav-icon-outline,
        .mobile-bottom-nav .nav-item .nav-icon-outline {
          opacity: 1;
          transform: scale(1);
        }

        .mobile-nav .nav-item .nav-icon-filled,
        .mobile-bottom-nav .nav-item .nav-icon-filled {
          opacity: 0;
          transform: scale(0.84);
        }

        .mobile-nav .nav-item .nav-label,
        .mobile-bottom-nav .nav-item .nav-label,
        .mobile-bottom-nav .nav-item span {
          font-size: 11.5px;
          font-weight: inherit;
          line-height: 1.1;
          white-space: nowrap;
        }

        .mobile-nav .nav-item.active,
        .mobile-bottom-nav .nav-item.active {
          color: #0f766e;
          background: transparent;
          font-weight: 600;
        }

        .mobile-nav .nav-item.active .nav-icon-outline,
        .mobile-bottom-nav .nav-item.active .nav-icon-outline {
          opacity: 0;
          transform: scale(0.84);
        }

        .mobile-nav .nav-item.active .nav-icon-filled,
        .mobile-bottom-nav .nav-item.active .nav-icon-filled {
          opacity: 1;
          transform: scale(1);
        }

        .mobile-nav .nav-item.active .nav-label,
        .mobile-bottom-nav .nav-item.active .nav-label,
        .mobile-bottom-nav .nav-item.active span {
          font-weight: 600;
        }

        body.${BODY_READY_CLASS} .mobile-bottom-nav {
          display: none !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .mobile-nav,
        .mobile-bottom-nav,
        .mobile-nav-indicator,
        .mobile-nav .nav-item,
        .mobile-bottom-nav .nav-item,
        .mobile-nav .nav-item svg,
        .mobile-bottom-nav .nav-item svg {
          transition: none !important;
          animation: none !important;
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
    link.setAttribute('aria-label', config.label);

    if (config.extraClass) {
      link.classList.add(config.extraClass);
    }

    const iconWrap = document.createElement('span');
    iconWrap.className = 'nav-icon-wrap';

    const outlineIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    outlineIcon.setAttribute('viewBox', '0 0 24 24');
    outlineIcon.setAttribute('fill', 'none');
    outlineIcon.setAttribute('aria-hidden', 'true');
    outlineIcon.classList.add('nav-icon', 'nav-icon-outline');
    appendSvgContent(outlineIcon, config.iconOutline || config.icon || '');

    const filledIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    filledIcon.setAttribute('viewBox', '0 0 24 24');
    filledIcon.setAttribute('fill', 'none');
    filledIcon.setAttribute('aria-hidden', 'true');
    filledIcon.classList.add('nav-icon', 'nav-icon-filled');
    appendSvgContent(filledIcon, config.iconFilled || config.iconOutline || config.icon || '');

    const label = document.createElement('span');
    label.className = 'nav-label';
    if (config.labelClass) {
      label.classList.add(config.labelClass);
    }
    label.textContent = config.label;

    iconWrap.appendChild(outlineIcon);
    iconWrap.appendChild(filledIcon);
    link.appendChild(iconWrap);
    link.appendChild(label);

    return link;
  }

  function ensureNavIndicator(nav) {
    if (!nav) return null;

    let indicator = nav.querySelector('.mobile-nav-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'mobile-nav-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      nav.insertBefore(indicator, nav.firstChild);
    }

    nav.classList.add('has-indicator');
    return indicator;
  }

  function updateNavIndicator(nav, activeItem) {
    if (!nav) return;
    const indicator = ensureNavIndicator(nav);
    if (!indicator) return;

    if (!activeItem) {
      indicator.style.opacity = '0';
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const activeRect = activeItem.getBoundingClientRect();
    if (!navRect.width || !activeRect.width) {
      indicator.style.opacity = '0';
      return;
    }

    const width = Math.max(60, Math.min(activeRect.width - 10, 88));
    const height = Math.max(46, Math.min(navRect.height - 12, 54));
    const left = activeRect.left - navRect.left + ((activeRect.width - width) / 2);
    const top = (navRect.height - height) / 2;
    const clampedLeft = Math.max(6, Math.min(left, navRect.width - width - 6));

    indicator.style.width = `${width}px`;
    indicator.style.height = `${height}px`;
    indicator.style.transform = `translate3d(${clampedLeft}px, ${top}px, 0)`;
    indicator.style.opacity = '1';
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

    updateNavIndicator(nav, activeItem);
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
  let navLayoutRaf = null;

  function queueNavLayoutUpdate() {
    if (navLayoutRaf !== null) {
      cancelAnimationFrame(navLayoutRaf);
    }

    navLayoutRaf = requestAnimationFrame(() => {
      navLayoutRaf = null;
      setActiveState(navElement);
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    navElement = initialiseNav();
  });

  window.addEventListener('storage', (event) => {
    if (!event.key || ['token', 'seller', 'user'].includes(event.key)) {
      updateAuthNavigationState();
      queueNavLayoutUpdate();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateAuthNavigationState();
      queueNavLayoutUpdate();
    }
  });

  document.addEventListener('mobileNavReady', () => {
    updateAuthNavigationState();
    queueNavLayoutUpdate();
  });

  window.addEventListener('hashchange', () => setActiveState(navElement));
  window.addEventListener('popstate', () => setActiveState(navElement));
  window.addEventListener('resize', queueNavLayoutUpdate);
  window.addEventListener('orientationchange', queueNavLayoutUpdate);
})();
