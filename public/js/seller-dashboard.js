(function vitreenetSellerAnalytics(window, document) {
  'use strict';

  if (!window || !document) {
    return;
  }

  function normaliseId(raw) {
    if (!raw) {
      return undefined;
    }
    if (typeof raw === 'string') {
      return raw;
    }
    if (typeof raw === 'object') {
      if (raw.$oid) return raw.$oid;
      if (raw._id) return raw._id;
      if (raw.id) return raw.id;
    }
    return String(raw);
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
        // ignore serialisation issues
      }
    }
  }

  function bindPlanButtons(root, analytics) {
    const selector = 'button, a';
    root.querySelectorAll(selector).forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      if (node.dataset.analyticsPlanBound === 'true') {
        return;
      }
      const planId = node.getAttribute('data-plan-id') || node.getAttribute('data-plan') || node.dataset.planId;
      const text = (node.textContent || '').trim();
      const matchesPlan = planId || /پلن|plan|ارتقا|upgrade|تبلیغ/i.test(text);
      if (!matchesPlan) {
        return;
      }
      node.dataset.analyticsPlanBound = 'true';
      node.addEventListener('click', () => {
        const seller = window.seller || {};
        analytics.trackSellerUpdatePlan({
          seller_id: normaliseId(seller.id || seller._id || seller.sellerId),
          plan_id: planId || text.toLowerCase().replace(/\s+/g, '-'),
          plan_name: text || planId || 'unknown'
        });
      });
      setAnalyticsPayload(node, node.getAttribute('data-analytics-event') || 'seller_plan_cta', {
        plan_id: planId || undefined,
        label: text || undefined
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const analytics = window.analytics;
    if (!analytics) {
      return;
    }

    analytics.trackEvent('seller_dashboard_loaded', {
      path: window.location.pathname
    });

    const createButtons = document.querySelectorAll('[data-action="create-product"], #openAddProduct, #addProductButton');
    createButtons.forEach((btn) => {
      setAnalyticsPayload(btn, 'seller_open_create_item', { location: 'dashboard' });
    });

    const addProductForm = document.getElementById('addProductForm');
    if (addProductForm) {
      addProductForm.addEventListener('submit', () => {
        const seller = window.seller || {};
        const titleInput = addProductForm.querySelector('input[name="title"], input[name="productTitle"], input#productTitle');
        analytics.trackSellerCreateItem({
          seller_id: normaliseId(seller.id || seller._id || seller.sellerId),
          item_id: undefined,
          item_name: titleInput ? titleInput.value.trim() : undefined
        });
      });
    }

    const navLinks = document.querySelectorAll('.sidebar-menu a[data-section], .section-tabs [data-section]');
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        analytics.trackEvent('seller_dashboard_section', {
          section: link.getAttribute('data-section') || link.hash || link.href,
          path: window.location.pathname
        });
      });
    });

    const planObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return;
          }
          bindPlanButtons(node, analytics);
        });
      });
    });

    planObserver.observe(document.body, { childList: true, subtree: true });
    bindPlanButtons(document, analytics);
  });

  document.addEventListener('seller:ready', (event) => {
    const analytics = window.analytics;
    if (!analytics) {
      return;
    }
    const seller = event?.detail?.seller || window.seller || {};
    analytics.trackSellerLogin({
      seller_id: normaliseId(seller.id || seller._id || seller.sellerId),
      shop_id: normaliseId(seller.shopId || seller.shop_id || seller.shopurl || seller.shopUrl),
      plan: seller.plan || seller.planType || seller.subscriptionStatus,
      status: seller.status || seller.accountStatus
    });
  });
})(window, document);
