// Vitreenet mobile bottom navigation
(function() {
  const NAV_STYLE_ID = 'vitreenet-mobile-nav-style';
  const BODY_READY_CLASS = 'has-mobile-nav';
  const NAV_READY_CLASS = 'vitreenet-mobile-nav';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;

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
      href: '/service-directory.html',
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
        '/user',
        'user/',
        '/user-panel.html',
        'user-panel.html',
        '/seller',
        'seller/',
        '/seller-paneel.html',
        'seller-paneel.html'
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
          padding-bottom: calc(92px + env(safe-area-inset-bottom, 0px));
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
          height: calc(82px + env(safe-area-inset-bottom, 0px));
          padding: 10px 18px calc(12px + env(safe-area-inset-bottom, 0px));
          background: linear-gradient(180deg, rgba(255,250,245,0.96), rgba(241,226,210,0.96));
          backdrop-filter: blur(16px);
          border-radius: 28px 28px 0 0;
          border-top: 1px solid rgba(250, 204, 170, 0.45);
          box-shadow: 0 -12px 35px rgba(15, 23, 42, 0.12);
          justify-content: space-between;
          gap: 6px;
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
          gap: 6px;
          padding: 8px 6px;
          border-radius: 18px;
          transition: transform 0.2s ease, color 0.2s ease, background 0.25s ease, box-shadow 0.25s ease;
        }

        .mobile-nav .nav-item:active {
          transform: scale(0.94);
        }

        .mobile-nav .nav-item svg {
          width: 24px;
          height: 24px;
          color: inherit;
        }

        .mobile-nav .nav-item .nav-label {
          font-size: 12px;
          line-height: 1;
        }

        .mobile-nav .nav-item.active {
          color: #047857;
          background: rgba(16, 185, 129, 0.15);
          box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.2);
          transform: translateY(-3px);
        }

        .mobile-nav .nav-item.active svg {
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

  function matchesCurrent(config, currentPath) {
    if (!Array.isArray(config.matches)) return false;
    return config.matches.some(match => {
      if (!match) return false;
      if (match === '/') {
        return currentPath === '/' || currentPath.endsWith('/index.html');
      }
      if (match.endsWith('/')) {
        return currentPath.startsWith(match.slice(0, -1));
      }
      if (match.startsWith('/')) {
        return currentPath === match || currentPath.endsWith(match);
      }
      return currentPath.endsWith(`/${match}`) || currentPath === `/${match}` || currentPath === match;
    });
  }

  function setActiveState(nav) {
    if (!nav) return;
    const currentPath = getCurrentPath();
    const items = nav.querySelectorAll('.nav-item');

    items.forEach((item) => {
      const config = NAV_ITEMS.find(entry => entry.id === item.id);
      const isActive = config ? matchesCurrent(config, currentPath) : false;
      if (isActive) {
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

    document.dispatchEvent(new CustomEvent('mobileNavReady', { detail: { nav } }));

    return nav;
  }

  let navElement = null;

  window.addEventListener('DOMContentLoaded', () => {
    navElement = initialiseNav();
  });

  window.addEventListener('hashchange', () => setActiveState(navElement));
  window.addEventListener('popstate', () => setActiveState(navElement));
})();
