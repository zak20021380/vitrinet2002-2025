(function vitreenetProductAnalytics(window, document) {
  'use strict';

  if (!window || !document) {
    return;
  }

  const DEFAULT_CURRENCY = 'IRR';

  function getProductAnalyticsState() {
    return window.__PRODUCT_ANALYTICS__ || {};
  }

  function updateProductAnalyticsState(partial) {
    const current = getProductAnalyticsState();
    window.__PRODUCT_ANALYTICS__ = Object.assign({}, current, partial);
    return window.__PRODUCT_ANALYTICS__;
  }

  function observeRelatedItems(analytics) {
    const seenItems = new Set();
    const itemObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        const el = entry.target;
        const itemId = el.getAttribute('data-product-id') || el.dataset.productId;
        if (!itemId || seenItems.has(itemId)) {
          itemObserver.unobserve(el);
          return;
        }
        seenItems.add(itemId);
        analytics.trackViewItem({
          item_id: itemId,
          item_name: el.getAttribute('data-product-name') || el.dataset.productName,
          category: el.getAttribute('data-product-category') || el.dataset.productCategory,
          price: el.dataset.productPrice ? Number(el.dataset.productPrice) : undefined,
          currency: el.getAttribute('data-product-currency') || el.dataset.productCurrency || DEFAULT_CURRENCY,
          shop_id: el.getAttribute('data-shop-id') || el.dataset.shopId,
          seller_id: el.getAttribute('data-seller-id') || el.dataset.sellerId
        });
        itemObserver.unobserve(el);
      });
    }, { threshold: 0.45 });

    const bind = (root) => {
      root.querySelectorAll('[data-product-id]').forEach((node) => itemObserver.observe(node));
    };

    bind(document);

    const mo = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return;
          }
          bind(node);
        });
      });
    });

    mo.observe(document.body, { childList: true, subtree: true });
  }

  function bindSellerCtas(analytics) {
    const addressButton = document.getElementById('sellerAddressButton');
    if (addressButton) {
      addressButton.addEventListener('click', () => {
        if (addressButton.disabled) {
          return;
        }
        const state = getProductAnalyticsState();
        if (!state.item_id) {
          return;
        }
        analytics.trackAddToCart({
          item_id: state.item_id,
          item_name: state.item_name,
          category: state.category,
          price: state.price,
          currency: state.currency || DEFAULT_CURRENCY,
          quantity: 1
        });
      });
    }

    const sellerLink = document.getElementById('sellerLink');
    if (sellerLink) {
      sellerLink.addEventListener('click', () => {
        const state = getProductAnalyticsState();
        if (!state.item_id || !state.sellerLinkReady) {
          return;
        }
        analytics.trackBeginCheckout({
          value: state.price,
          currency: state.currency || DEFAULT_CURRENCY,
          items: [
            {
              item_id: state.item_id,
              item_name: state.item_name,
              category: state.category,
              price: state.price,
              quantity: 1
            }
          ]
        });
        if (state.shop_id || state.shop_name) {
          analytics.trackViewShop({
            shop_id: state.shop_id,
            shop_name: state.shop_name,
            shop_type: state.shop_type || state.category
          });
        }
      });
    }

    const copyAddressButton = document.getElementById('addressModalCopy');
    if (copyAddressButton) {
      copyAddressButton.addEventListener('click', () => {
        const state = getProductAnalyticsState();
        if (!state.item_id) {
          return;
        }
        analytics.trackPurchase({
          transaction_id: state.transaction_id,
          value: state.price,
          currency: state.currency || DEFAULT_CURRENCY,
          items: [
            {
              item_id: state.item_id,
              item_name: state.item_name,
              quantity: 1,
              price: state.price
            }
          ]
        });
      });
    }
  }

  document.addEventListener('product:updated', (event) => {
    const detail = event?.detail || {};
    const analytics = window.analytics;
    if (!analytics) {
      updateProductAnalyticsState(detail.state || {});
      return;
    }

    const newState = updateProductAnalyticsState(detail.state || {});

    if (detail.viewItem) {
      analytics.trackViewItem(detail.viewItem);
    }

    if (detail.viewShop) {
      analytics.trackViewShop(detail.viewShop);
    }

    if (detail.events && Array.isArray(detail.events)) {
      detail.events.forEach((evt) => {
        if (!evt || typeof evt !== 'object') {
          return;
        }
        analytics.trackEvent(evt.name, evt.payload);
      });
    }

    if (detail.state && typeof detail.state === 'object') {
      const sellerLink = document.getElementById('sellerLink');
      if (sellerLink && newState.item_id && !sellerLink.dataset.analytics) {
        try {
          sellerLink.setAttribute('data-analytics', JSON.stringify({
            item_id: newState.item_id,
            seller_id: newState.seller_id,
            shop_id: newState.shop_id,
            item_name: newState.item_name
          }));
        } catch (error) {
          // ignore
        }
        sellerLink.setAttribute('data-analytics-event', 'product_seller_link_click');
      }
      const addressBtn = document.getElementById('sellerAddressButton');
      if (addressBtn && newState.item_id) {
        try {
          addressBtn.setAttribute('data-analytics', JSON.stringify({
            item_id: newState.item_id,
            seller_id: newState.seller_id,
            shop_id: newState.shop_id
          }));
        } catch (error) {
          // ignore
        }
        addressBtn.setAttribute('data-analytics-event', 'product_view_address');
      }
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    const analytics = window.analytics;
    if (!analytics) {
      return;
    }

    observeRelatedItems(analytics);
    bindSellerCtas(analytics);
  });
})(window, document);
