(function (global) {
  if (global.__vitrinetApiInitialized) {
    return;
  }

  const backendOrigins = ['http://localhost:5000', 'http://127.0.0.1:5000'];
  const currentOrigin = global.location && global.location.origin ? global.location.origin : '';
  const defaultBackend = currentOrigin || backendOrigins[0];
  const isServedFromBackend = backendOrigins.includes(currentOrigin);

  function normalizePath(path) {
    if (typeof path !== 'string' || !path.length) {
      return '';
    }
    return path.startsWith('/') ? path : `/${path}`;
  }

  function buildUrl(path) {
    const normalized = normalizePath(path || '');
    if (!normalized) {
      return isServedFromBackend ? '' : defaultBackend;
    }
    return isServedFromBackend ? normalized : `${defaultBackend}${normalized}`;
  }

  const originalFetch = global.fetch ? global.fetch.bind(global) : null;
  let csrfTokenPromise = null;

  function readCookie(name) {
    const cookies = global.document?.cookie ? global.document.cookie.split(';') : [];
    for (const cookie of cookies) {
      const [rawName, ...rawValue] = cookie.trim().split('=');
      if (rawName === name) {
        return decodeURIComponent(rawValue.join('=') || '');
      }
    }
    return '';
  }

  function isUnsafeMethod(method) {
    return !['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());
  }

  function getRequestUrl(resource) {
    if (typeof resource === 'string') return resource;
    if (resource && typeof resource.url === 'string') return resource.url;
    return '';
  }

  function getRequestMethod(resource, init) {
    return init?.method || (resource && typeof resource.method === 'string' ? resource.method : 'GET');
  }

  function isApiRequest(url) {
    if (!url) return false;
    if (url.startsWith('/api/')) return true;
    try {
      const parsed = new URL(url, global.location?.href || defaultBackend);
      return parsed.pathname.startsWith('/api/');
    } catch {
      return url.includes('/api/');
    }
  }

  async function getCsrfToken() {
    const cookieToken = readCookie('csrf_token');
    if (cookieToken) return cookieToken;

    if (!csrfTokenPromise) {
      csrfTokenPromise = originalFetch(buildUrl('/api/csrf-token'), {
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
  }

  if (originalFetch) {
    global.fetch = async function (resource, init) {
      let resolvedResource = resource;
      let shouldAttachCredentials = false;
      const url = getRequestUrl(resource);
      const method = getRequestMethod(resource, init);

      if (typeof url === 'string') {
        if (url.startsWith('/api/')) {
          resolvedResource = typeof resource === 'string' ? buildUrl(resource) : resource;
          shouldAttachCredentials = true;
        } else {
          const absoluteMatch = url.match(/^https?:\/\//i);
          if (absoluteMatch && isApiRequest(url)) {
            shouldAttachCredentials = true;
          }
        }
      }

      let options = init;
      if (shouldAttachCredentials || (isApiRequest(url) && isUnsafeMethod(method))) {
        options = init ? { ...init } : {};
        if (options.credentials === undefined) {
          options.credentials = 'include';
        }
      }

      if (isApiRequest(url) && isUnsafeMethod(method)) {
        options = options ? { ...options } : {};
        const headers = new Headers(options.headers || resource?.headers || {});
        if (!headers.has('X-CSRF-Token')) {
          const token = await getCsrfToken();
          if (token) headers.set('X-CSRF-Token', token);
        }
        if (!headers.has('X-Requested-With')) {
          headers.set('X-Requested-With', 'XMLHttpRequest');
        }
        options.headers = headers;
        options.method = method;
      }

      return originalFetch(resolvedResource, options);
    };
  }

  global.VITRINET_API = {
    backendOrigin: isServedFromBackend ? currentOrigin : defaultBackend,
    buildUrl,
    ensureCredentials(init = {}) {
      if (init.credentials === undefined) {
        return { ...init, credentials: 'include' };
      }
      return init;
    },
  };

  global.__vitrinetApiInitialized = true;
})(window);
