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

  if (originalFetch) {
    global.fetch = function (resource, init) {
      let resolvedResource = resource;
      let shouldAttachCredentials = false;

      if (typeof resource === 'string') {
        if (resource.startsWith('/api/')) {
          resolvedResource = buildUrl(resource);
          shouldAttachCredentials = true;
        } else {
          const absoluteMatch = resource.match(/^https?:\/\//i);
          if (absoluteMatch && resource.includes('/api/')) {
            shouldAttachCredentials = true;
          }
        }
      }

      let options = init;
      if (shouldAttachCredentials) {
        options = init ? { ...init } : {};
        if (options.credentials === undefined) {
          options.credentials = 'include';
        }
      }

      return originalFetch(resolvedResource, options).then((response) => {
        return response;
      });
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
