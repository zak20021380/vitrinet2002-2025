/*
 * Vitreenet Analytics Abstraction
 * Provides a privacy-aware analytics layer with vendor fan-out.
 */
(function initAnalytics(window, document) {
  'use strict';

  if (!window || !document) {
    return;
  }

  const defaultEnv = {
    isProd: false,
    analyticsEnabled: true
  };

  const defaultConsent = {
    analytics: true
  };

  const existingEnv = window.__ENV__ || {};
  const existingConsent = window.__CONSENT__ || {};
  const config = window.__ANALYTICS_CONFIG__ || {};

  const productionDomain = String(config.PRODUCTION_DOMAIN || '').replace(/^https?:\/\//, '');
  const hostname = window.location && window.location.hostname ? window.location.hostname : '';

  const env = window.__ENV__ = Object.assign({}, defaultEnv, existingEnv);
  if (typeof env.isProd !== 'boolean') {
    env.isProd = Boolean(productionDomain) ? hostname.endsWith(productionDomain) : !/localhost|127\.0\.0\.1/.test(hostname);
  }

  const consent = window.__CONSENT__ = Object.assign({}, defaultConsent, existingConsent);
  const analyticsNamespace = window.__ANALYTICS__ = window.__ANALYTICS__ || {};

  const state = Object.assign(analyticsNamespace, {
    gtmLoaded: analyticsNamespace.gtmLoaded || false,
    ga4Loaded: analyticsNamespace.ga4Loaded || false,
    posthogLoaded: analyticsNamespace.posthogLoaded || false,
    plausibleLoaded: analyticsNamespace.plausibleLoaded || false,
    boundAutoListeners: analyticsNamespace.boundAutoListeners || false,
    queuedEvents: analyticsNamespace.queuedEvents || []
  });

  function logDebug(name, payload) {
    if (!env.analyticsEnabled) {
      return;
    }
    try {
      // eslint-disable-next-line no-console
      console.log(`[Analytics] ${name}`, payload || {});
    } catch (error) {
      // ignore console failures
    }
  }

  function shouldLoadVendors() {
    return Boolean(env.analyticsEnabled) && Boolean(env.isProd) && consent.analytics !== false;
  }

  function safeInitGTM(gtmId) {
    if (!gtmId || state.gtmLoaded || window.dataLayer?.__gtmInitialized) {
      return;
    }
    window.dataLayer = window.dataLayer || [];
    if (!window.dataLayer.__gtmInitialized) {
      window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      window.dataLayer.__gtmInitialized = true;
    }

    const scriptId = 'vt-gtm-loader';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }
    state.gtmLoaded = true;
  }

  function safeInitGA4(measurementId) {
    if (!measurementId || state.ga4Loaded) {
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, { anonymize_ip: true });

    const scriptId = 'vt-ga4-loader';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }
    state.ga4Loaded = true;
  }

  function safeInitPostHog(key, apiHost) {
    if (!key || state.posthogLoaded) {
      return;
    }
    const host = apiHost || 'https://app.posthog.com';
    window.posthog = window.posthog || [];
    if (window.posthog.__loaded) {
      state.posthogLoaded = true;
      return;
    }
    window.posthog.__loaded = true;

    window.posthog.init = function initPH(apiKey, options, name) {
      const instanceName = name || 'posthog';
      if (window[instanceName] && window[instanceName].__initialized) {
        return window[instanceName];
      }
      const posthogInstance = window[instanceName] = window[instanceName] || [];
      posthogInstance.__initialized = true;
      posthogInstance.people = posthogInstance.people || [];
      posthogInstance.toString = function toString(noStub) {
        const str = 'posthog';
        if (instanceName !== 'posthog') {
          return `${str}.${instanceName}`;
        }
        return str;
      };
      posthogInstance.people.toString = function peopleToString() {
        return `${posthogInstance.toString()}.people`;
      };

      posthogInstance._i = posthogInstance._i || [];
      posthogInstance._i.push([apiKey, options, instanceName]);

      const scriptId = `vt-posthog-${instanceName}`;
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.async = true;
        script.defer = true;
        script.src = `${host.replace(/\/$/, '')}/static/array.js`;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }
      return posthogInstance;
    };

    window.posthog.init(key, {
      api_host: host,
      autocapture: true
    });

    state.posthogLoaded = true;
  }

  function parsePlausibleConfig(rawDomain, explicitSrc) {
    if (!rawDomain) {
      return null;
    }
    const defaultSrc = 'https://plausible.io/js/script.js';
    if (explicitSrc) {
      return {
        domain: rawDomain,
        src: explicitSrc
      };
    }
    if (/^https?:\/\//i.test(rawDomain)) {
      try {
        const url = new URL(rawDomain);
        return {
          domain: url.hostname,
          src: `${url.origin.replace(/\/$/, '')}/js/script.js`
        };
      } catch (error) {
        return {
          domain: rawDomain,
          src: defaultSrc
        };
      }
    }
    return {
      domain: rawDomain,
      src: defaultSrc
    };
  }

  function safeInitPlausible(rawDomain, explicitSrc) {
    if (state.plausibleLoaded) {
      return;
    }
    const settings = parsePlausibleConfig(rawDomain, explicitSrc || config.PLAUSIBLE_SCRIPT_SRC);
    if (!settings) {
      return;
    }

    const scriptId = 'vt-plausible-loader';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.defer = true;
      script.setAttribute('data-domain', settings.domain);
      script.src = settings.src;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }
    state.plausibleLoaded = true;
  }

  function lazyBootstrapProviders() {
    if (!shouldLoadVendors()) {
      return;
    }
    if (state.gtmLoaded || state.ga4Loaded || state.posthogLoaded || state.plausibleLoaded) {
      return;
    }

    if (config.GTM_ID) {
      safeInitGTM(config.GTM_ID);
    } else if (config.GA4_ID) {
      safeInitGA4(config.GA4_ID);
    }

    if (config.POSTHOG_KEY) {
      safeInitPostHog(config.POSTHOG_KEY, config.POSTHOG_HOST);
    }

    if (config.PLAUSIBLE_DOMAIN) {
      safeInitPlausible(config.PLAUSIBLE_DOMAIN, config.PLAUSIBLE_SCRIPT_SRC);
    }
  }

  function fanOut(name, payload) {
    const data = payload && typeof payload === 'object' ? payload : {};
    logDebug(name, data);

    if (!shouldLoadVendors()) {
      return;
    }

    lazyBootstrapProviders();

    if (config.GTM_ID && window.dataLayer && Array.isArray(window.dataLayer)) {
      window.dataLayer.push(Object.assign({ event: name }, data));
    }

    if (!config.GTM_ID && (config.GA4_ID && typeof window.gtag === 'function')) {
      window.gtag('event', name, data);
    }

    if (window.posthog && typeof window.posthog.capture === 'function') {
      window.posthog.capture(name, data);
    }

    if (typeof window.plausible === 'function') {
      try {
        window.plausible(name, { props: data });
      } catch (error) {
        // plausible might throw if not loaded yet
      }
    }
  }

  window._ga = window._ga || function safeGa(eventName, eventPayload) {
    fanOut(eventName, eventPayload);
  };

  window._ph = window._ph || function safePosthog(eventName, eventPayload) {
    if (window.posthog && typeof window.posthog.capture === 'function') {
      window.posthog.capture(eventName, eventPayload || {});
    }
  };

  window._pl = window._pl || function safePlausible(eventName, eventPayload) {
    if (typeof window.plausible === 'function') {
      try {
        window.plausible(eventName, { props: eventPayload || {} });
      } catch (error) {
        // ignore
      }
    }
  };

  function trackEvent(name, data) {
    fanOut(name, data);
  }

  function normalisePrice(value) {
    if (value == null) {
      return undefined;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  function trackViewItem(item) {
    if (!item || typeof item !== 'object') {
      return;
    }
    fanOut('view_item', item);
  }

  function trackAddToCart(item) {
    if (!item || typeof item !== 'object') {
      return;
    }
    const payload = Object.assign({}, item);
    payload.value = normalisePrice(payload.value || payload.price);
    fanOut('add_to_cart', payload);
  }

  function trackBeginCheckout(checkout) {
    if (!checkout || typeof checkout !== 'object') {
      return;
    }
    const payload = Object.assign({}, checkout);
    payload.value = normalisePrice(payload.value);
    fanOut('begin_checkout', payload);
  }

  function trackPurchase(purchase) {
    if (!purchase || typeof purchase !== 'object') {
      return;
    }
    const payload = Object.assign({}, purchase);
    payload.value = normalisePrice(payload.value);
    fanOut('purchase', payload);
  }

  function trackViewShop(shop) {
    if (!shop || typeof shop !== 'object') {
      return;
    }
    fanOut('view_shop', shop);
  }

  function trackSearch(search) {
    if (!search || typeof search !== 'object') {
      return;
    }
    fanOut('search', search);
  }

  function trackSellerLogin(data) {
    fanOut('seller_login', data || {});
  }

  function trackSellerCreateItem(data) {
    fanOut('seller_create_item', data || {});
  }

  function trackSellerUpdatePlan(data) {
    fanOut('seller_update_plan', data || {});
  }

  function trackSellerBeginCheckout(data) {
    fanOut('seller_begin_checkout', data || {});
  }

  function trackAdminMetric(name, data) {
    fanOut(`admin_${name}`, data || {});
  }

  function setupAutoEventBinding() {
    if (state.boundAutoListeners) {
      return;
    }
    state.boundAutoListeners = true;

    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-analytics-event]') : null;
      if (!target) {
        return;
      }
      const eventName = target.getAttribute('data-analytics-event');
      if (!eventName) {
        return;
      }
      const payloadAttr = target.getAttribute('data-analytics');
      let payload = {};
      if (payloadAttr) {
        try {
          payload = JSON.parse(payloadAttr);
        } catch (error) {
          logDebug('analytics_payload_parse_error', { error: error?.message, payload: payloadAttr });
        }
      }
      trackEvent(eventName, payload);
    }, true);
  }

  setupAutoEventBinding();

  const api = {
    trackEvent,
    trackViewItem,
    trackAddToCart,
    trackBeginCheckout,
    trackPurchase,
    trackViewShop,
    trackSearch,
    trackSellerLogin,
    trackSellerCreateItem,
    trackSellerUpdatePlan,
    trackSellerBeginCheckout,
    trackAdminMetric
  };

  window.analytics = Object.assign(window.analytics || {}, api);

  if (shouldLoadVendors()) {
    lazyBootstrapProviders();
  }

  // Content Security Policy reference (update server configuration accordingly):
  // script-src 'self' https://www.googletagmanager.com https://www.googletagmanager.com/gtag/js https://www.googletagmanager.com/ns.html https://plausible.io https://cdn.posthog.com {{POSTHOG_HOST}};
})(window, document);
