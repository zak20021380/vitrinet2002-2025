(function vitreenetHomeAnalytics(window, document) {
  'use strict';

  if (!window || !document) {
    return;
  }

  function setAnalyticsPayload(element, eventName, payload) {
    if (!element) {
      return;
    }
    if (eventName) {
      element.setAttribute('data-analytics-event', eventName);
    }
    if (payload && typeof payload === 'object') {
      try {
        element.setAttribute('data-analytics', JSON.stringify(payload));
      } catch (error) {
        // ignore payload serialisation issues
      }
    }
  }

  function observeSections(sections, analytics) {
    if (!sections.length) {
      return;
    }
    const seen = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        const name = entry.target.getAttribute('data-analytics-section');
        if (!name || seen.has(name)) {
          observer.unobserve(entry.target);
          return;
        }
        seen.add(name);
        analytics.trackEvent('view_section', { section: name, path: window.location.pathname });
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    sections.forEach((section) => {
      section.setAttribute('data-analytics-section', section.getAttribute('data-analytics-section') || section.dataset.sectionName);
      observer.observe(section);
    });
  }

  function observeDynamicMarketplaceItems(analytics) {
    const productObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        const target = entry.target;
        const payload = {
          item_id: target.getAttribute('data-product-id') || target.dataset.productId,
          item_name: target.getAttribute('data-product-name') || target.dataset.productName,
          category: target.getAttribute('data-product-category') || target.dataset.productCategory,
          price: target.dataset.productPrice ? Number(target.dataset.productPrice) : undefined,
          currency: target.getAttribute('data-product-currency') || target.dataset.productCurrency || 'IRR',
          shop_id: target.getAttribute('data-shop-id') || target.dataset.shopId,
          seller_id: target.getAttribute('data-seller-id') || target.dataset.sellerId
        };
        if (payload.item_id) {
          analytics.trackViewItem(payload);
        }
        productObserver.unobserve(target);
      });
    }, { threshold: 0.45 });

    const shopObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        const target = entry.target;
        const payload = {
          shop_id: target.getAttribute('data-shop-id') || target.dataset.shopId,
          shop_name: target.getAttribute('data-shop-name') || target.dataset.shopName,
          shop_type: target.getAttribute('data-shop-type') || target.dataset.shopType || target.getAttribute('data-product-category')
        };
        if (payload.shop_id || payload.shop_name) {
          analytics.trackViewShop(payload);
        }
        shopObserver.unobserve(target);
      });
    }, { threshold: 0.45 });

    const bindTargets = (root) => {
      root.querySelectorAll('[data-product-id]').forEach((el) => productObserver.observe(el));
      root.querySelectorAll('[data-shop-id]').forEach((el) => shopObserver.observe(el));
    };

    bindTargets(document);

    const mo = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return;
          }
          bindTargets(node);
        });
      });
    });

    mo.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const analytics = window.analytics;
    if (!analytics) {
      return;
    }

    const registerBtn = document.getElementById('registerShopBtn');
    setAnalyticsPayload(registerBtn, 'home_cta_register_shop', { location: 'header', path: window.location.pathname });

    const loginLink = document.getElementById('loginNavLink');
    setAnalyticsPayload(loginLink, 'home_login_click', { location: 'header_nav' });

    const cityButton = document.getElementById('cityBtn');
    if (cityButton) {
      cityButton.addEventListener('click', () => {
        const city = document.getElementById('cityName');
        analytics.trackEvent('city_selector_opened', {
          city: city ? city.textContent?.trim() : undefined
        });
      });
    }

    const heroSection = document.querySelector('section.flex.flex-col.items-center');
    if (heroSection) {
      heroSection.dataset.sectionName = 'home_hero';
    }
    const categoriesSection = document.querySelector('section.w-full.mt-14');
    if (categoriesSection) {
      categoriesSection.dataset.sectionName = 'home_popular_categories';
      categoriesSection.querySelectorAll('a[href*="categories.html"]').forEach((link) => {
        if (link.dataset.analyticsEvent) {
          return;
        }
        const name = link.textContent?.trim() || 'category';
        setAnalyticsPayload(link, 'home_category_click', { category: name });
      });
    }

    const barberSection = document.getElementById('hair-salon-slider')?.closest('section');
    if (barberSection) {
      barberSection.dataset.sectionName = 'home_featured_barbers';
    }
    const carwashSection = document.getElementById('carwash-slider')?.closest('section');
    if (carwashSection) {
      carwashSection.dataset.sectionName = 'home_featured_carwash';
    }
    const popularProductsSection = document.getElementById('popular-products-slider')?.closest('section');
    if (popularProductsSection) {
      popularProductsSection.dataset.sectionName = 'home_popular_products';
    }

    const sectionsToWatch = Array.from(document.querySelectorAll('section[data-section-name]'));
    observeSections(sectionsToWatch, analytics);

    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
      searchForm.addEventListener('submit', () => {
        const input = searchForm.querySelector('input[name="q"], input#mainSearchInput');
        const cityLabel = document.getElementById('cityName');
        analytics.trackSearch({
          query: input ? input.value.trim() : '',
          filters: {
            city: cityLabel ? cityLabel.textContent?.trim() : undefined
          }
        });
      });
    }

    const searchResultsPanel = document.getElementById('searchResultsPanel');
    if (searchResultsPanel) {
      const observer = new MutationObserver(() => {
        const isHidden = searchResultsPanel.classList.contains('hidden') || searchResultsPanel.hasAttribute('hidden');
        if (!isHidden) {
          analytics.trackEvent('home_search_results_visible', {
            totalResults: searchResultsPanel.querySelectorAll('[data-product-id], [data-shop-id]').length || undefined
          });
        }
      });
      observer.observe(searchResultsPanel, { attributes: true, attributeFilter: ['class', 'hidden'] });
    }

    const heroCtas = document.querySelectorAll('.btn-grad');
    heroCtas.forEach((btn) => {
      if (btn.dataset.analyticsEvent) {
        return;
      }
      setAnalyticsPayload(btn, 'home_cta_click', {
        text: btn.textContent?.trim(),
        href: btn.getAttribute('href')
      });
    });

    observeDynamicMarketplaceItems(analytics);
  });
})(window, document);
