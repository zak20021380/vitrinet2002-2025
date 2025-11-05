(function vitreenetAdminAnalytics(window, document) {
  'use strict';

  if (!window || !document) {
    return;
  }

  function toNumber(value) {
    if (value == null) {
      return undefined;
    }
    const normalised = String(value).replace(/[^0-9.-]+/g, '');
    if (!normalised) {
      return undefined;
    }
    const num = Number(normalised);
    return Number.isFinite(num) ? num : undefined;
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

  function observeMetric(element, metricName, analytics) {
    if (!element) {
      return;
    }
    let lastValue = undefined;
    const emit = () => {
      const value = toNumber(element.textContent);
      if (value === undefined || value === lastValue) {
        return;
      }
      lastValue = value;
      analytics.trackAdminMetric('metric_update', {
        metric: metricName,
        value,
        path: window.location.pathname
      });
    };
    emit();
    const observer = new MutationObserver(emit);
    observer.observe(element, { childList: true, characterData: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const analytics = window.analytics;
    if (!analytics) {
      return;
    }

    analytics.trackAdminMetric('loaded', { path: window.location.pathname });

    const navLinks = document.querySelectorAll('.sidebar-menu a[data-section]');
    navLinks.forEach((link) => {
      const section = link.getAttribute('data-section');
      setAnalyticsPayload(link, 'admin_section_click', { section });
      link.addEventListener('click', () => {
        analytics.trackAdminMetric('section_selected', {
          section: link.getAttribute('data-section'),
          path: window.location.pathname
        });
      });
    });

    const metricMap = [
      { id: 'visit-today', name: 'visits_today' },
      { id: 'register-user-today', name: 'users_registered_today' },
      { id: 'register-seller-today', name: 'sellers_registered_today' },
      { id: 'service-shops-total', name: 'service_shops_total' },
      { id: 'products-total', name: 'products_total' },
      { id: 'count-users', name: 'users_total' },
      { id: 'count-sellers', name: 'sellers_total' },
      { id: 'count-service-shops', name: 'service_shops_sidebar' },
      { id: 'count-products', name: 'products_sidebar' }
    ];

    metricMap.forEach(({ id, name }) => {
      const el = document.getElementById(id);
      observeMetric(el, name, analytics);
    });

    const searchInputs = [
      { selector: '#userSearch', scope: 'users' },
      { selector: '#sellerSearch', scope: 'sellers' },
      { selector: '#centerSearch', scope: 'shopping_centers' }
    ];

    searchInputs.forEach(({ selector, scope }) => {
      const input = document.querySelector(selector);
      if (!input) {
        return;
      }
      input.addEventListener('search', () => {
        analytics.trackAdminMetric('search', {
          scope,
          query: input.value.trim() || undefined
        });
      });
      input.addEventListener('change', () => {
        analytics.trackAdminMetric('search_change', {
          scope,
          query: input.value.trim() || undefined
        });
      });
    });

    const exportButtons = document.querySelectorAll('[data-action="export"], .export-button');
    exportButtons.forEach((btn) => {
      setAnalyticsPayload(btn, 'admin_export_click', { label: btn.textContent?.trim() });
    });
  });
})(window, document);
