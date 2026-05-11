(function configureRuntime(window, location) {
  'use strict';

  if (!window) {
    return;
  }

  const defaultEnv = {
    isProd: Boolean(location && location.hostname && location.hostname.endsWith('{{DOMAIN}}')),
    analyticsEnabled: true
  };

  const defaultConsent = {
    analytics: true
  };

  const defaultAnalyticsConfig = {
    PRODUCTION_DOMAIN: '{{DOMAIN}}',
    GTM_ID: '{{GTM_ID}}',
    GA4_ID: '{{GA4_ID}}',
    POSTHOG_HOST: '{{POSTHOG_HOST}}',
    POSTHOG_KEY: '{{POSTHOG_KEY}}',
    PLAUSIBLE_DOMAIN: '{{PLAUSIBLE_DOMAIN}}'
  };

  window.__ENV__ = Object.assign({}, defaultEnv, window.__ENV__ || {});
  window.__CONSENT__ = Object.assign({}, defaultConsent, window.__CONSENT__ || {});
  window.__ANALYTICS_CONFIG__ = Object.assign({}, defaultAnalyticsConfig, window.__ANALYTICS_CONFIG__ || {});

  if (!window.__vitrinetCsrfFetchInitialized && typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
    let csrfTokenPromise = null;

    const readCookie = (name) => {
      const cookies = window.document?.cookie ? window.document.cookie.split(';') : [];
      for (const cookie of cookies) {
        const [rawName, ...rawValue] = cookie.trim().split('=');
        if (rawName === name) {
          return decodeURIComponent(rawValue.join('=') || '');
        }
      }
      return '';
    };

    const getRequestUrl = (resource) => {
      if (typeof resource === 'string') return resource;
      if (resource && typeof resource.url === 'string') return resource.url;
      return '';
    };

    const getRequestMethod = (resource, init) => String(init?.method || resource?.method || 'GET').toUpperCase();

    const isApiRequest = (url) => {
      if (!url) return false;
      try {
        return new URL(url, location.href).pathname.startsWith('/api/');
      } catch {
        return String(url).includes('/api/');
      }
    };

    const getCsrfToken = () => {
      const cookieToken = readCookie('csrf_token');
      if (cookieToken) return Promise.resolve(cookieToken);

      if (!csrfTokenPromise) {
        csrfTokenPromise = originalFetch('/api/csrf-token', {
          method: 'GET',
          credentials: 'include'
        })
          .then((response) => response.ok ? response.json() : null)
          .then((data) => data?.csrfToken || readCookie('csrf_token') || '')
          .finally(() => {
            csrfTokenPromise = null;
          });
      }

      return csrfTokenPromise;
    };

    window.fetch = async function csrfFetch(resource, init) {
      const url = getRequestUrl(resource);
      const method = getRequestMethod(resource, init);

      if (!isApiRequest(url) || !unsafeMethods.has(method)) {
        return originalFetch(resource, init);
      }

      const options = init ? { ...init } : {};
      const headers = new Headers(options.headers || resource?.headers || {});
      if (!headers.has('X-CSRF-Token')) {
        const token = await getCsrfToken();
        if (token) headers.set('X-CSRF-Token', token);
      }
      if (!headers.has('X-Requested-With')) {
        headers.set('X-Requested-With', 'XMLHttpRequest');
      }
      if (options.credentials === undefined) {
        options.credentials = 'include';
      }

      options.headers = headers;
      options.method = method;
      return originalFetch(resource, options);
    };

    window.__vitrinetCsrfFetchInitialized = true;
  }
})(window, window.location);
