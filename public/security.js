(function(){
  'use strict';

  const isProd = !/localhost|127\.0\.0\.1/.test(window.location.hostname);
  if (isProd) {
    const noop = function(){};
    const suppressed = ['log','debug','info'];
    suppressed.forEach(fn => {
      if (typeof console[fn] === 'function') {
        console[fn] = noop;
      }
    });
  }

  const CSP_REPORT_ONLY = false;
  if (CSP_REPORT_ONLY && document.querySelector('meta[http-equiv="Content-Security-Policy"][data-runtime="1"]')) {
    document.querySelector('meta[http-equiv="Content-Security-Policy"][data-runtime="1"]').setAttribute('content', "default-src 'self'");
  }

  // Token storage is necessary for authentication - only block plaintext passwords and secrets
  const SENSITIVE_KEYS = ['password','secret'];
  const storageGuard = (storage) => {
    if (!storage) return;
    const originalSet = storage.setItem;
    storage.setItem = function(key, value){
      if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
        console.warn('Prevented storing sensitive key in storage:', key);
        return;
      }
      try {
        return originalSet.call(this, key, value);
      } catch(err) {
        console.error('Storage setItem blocked:', err);
      }
    };
  };
  storageGuard(window.localStorage);
  storageGuard(window.sessionStorage);

  const TrustedSanitizer = {
    sanitize(html){
      if (!html) return '';
      if (typeof html !== 'string') {
        html = String(html);
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
      const walker = (node) => {
        [...node.querySelectorAll('script, iframe, object, embed, link')].forEach(el => el.remove());
        [...node.querySelectorAll('*')].forEach(el => {
          [...el.attributes].forEach(attr => {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on') || /javascript:/i.test(attr.value)) {
              el.removeAttribute(attr.name);
            }
          });
        });
      };
      walker(doc);
      return doc.body ? doc.body.innerHTML : '';
    },
    sanitizePlain(value){
      if (value == null) return '';
      return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));
    }
  };

  window.TrustedSanitizer = TrustedSanitizer;

  const protectInnerHTML = () => {
    const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!desc || !desc.set) return;
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set(value){
        return desc.set.call(this, TrustedSanitizer.sanitize(value));
      }
    });

    const insertDesc = Element.prototype.insertAdjacentHTML;
    Element.prototype.insertAdjacentHTML = function(position, text){
      return insertDesc.call(this, position, TrustedSanitizer.sanitize(text));
    };
  };

  const sanitizeInputValue = (input) => {
    if (!input || !('value' in input)) return;
    const original = input.value;
    const sanitized = TrustedSanitizer.sanitizePlain(original);
    if (original !== sanitized) {
      input.value = sanitized;
    }
  };

  const sanitizeForm = (form) => {
    if (!form || form.dataset.secured === '1') return;
    form.dataset.secured = '1';
    form.addEventListener('submit', (event) => {
      const controls = form.querySelectorAll('input, textarea, select');
      controls.forEach(sanitizeInputValue);
    }, { passive: true });
  };

  const sanitizeSearchParams = () => {
    if (!window.location.search) return;
    const usp = new URLSearchParams(window.location.search);
    let changed = false;
    for (const [key, value] of usp.entries()) {
      const sanitized = TrustedSanitizer.sanitizePlain(value);
      if (sanitized !== value) {
        usp.set(key, sanitized);
        changed = true;
      }
    }
    if (changed) {
      const url = `${window.location.pathname}?${usp.toString()}${window.location.hash}`;
      history.replaceState(null, document.title, url);
    }
  };

  const secureLinks = () => {
    document.querySelectorAll('a[target="_blank"]').forEach(anchor => {
      const rel = (anchor.getAttribute('rel') || '').split(/\s+/);
      if (!rel.includes('noopener')) rel.push('noopener');
      if (!rel.includes('noreferrer')) rel.push('noreferrer');
      anchor.setAttribute('rel', rel.join(' ').trim());
    });
  };

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          if (node.matches && node.matches('form')) {
            sanitizeForm(node);
          }
          if (node.querySelectorAll) {
            node.querySelectorAll('form').forEach(sanitizeForm);
            node.querySelectorAll('[data-unsafe-html]').forEach(el => {
              el.innerHTML = TrustedSanitizer.sanitize(el.innerHTML);
            });
          }
        }
      });
    });
  });

  const secureFetch = () => {
    const originalFetch = window.fetch;
    let csrfToken = null;
    let csrfPromise = null;

    async function loadToken(){
      if (csrfToken) return csrfToken;
      if (!csrfPromise) {
        csrfPromise = originalFetch('/api/security/csrf', {
          credentials: 'include',
          cache: 'no-store'
        }).then(res => {
          if (!res.ok) throw new Error('Failed to load CSRF token');
          return res.text();
        }).then(token => {
          csrfToken = token.trim();
          return csrfToken;
        }).catch(err => {
          console.warn('CSRF token fetch failed', err);
          csrfPromise = null;
          return null;
        });
      }
      return csrfPromise;
    }

    window.fetch = async function(resource, init = {}){
      const request = typeof resource === 'string' ? new Request(resource, init) : resource;
      const url = new URL(request.url, window.location.origin);

      if (url.protocol !== 'https:' && url.origin !== window.location.origin) {
        throw new Error('Blocked insecure fetch request to non-HTTPS resource.');
      }

      const method = (request.method || (init && init.method) || 'GET').toUpperCase();
      if (!['GET','HEAD','OPTIONS','TRACE'].includes(method) && url.origin === window.location.origin) {
        const token = await loadToken();
        if (token) {
          const headers = new Headers(request.headers || init.headers || {});
          headers.set('X-CSRF-Token', token);
          init = Object.assign({}, init, { headers, credentials: 'include' });
        }
      }
      return originalFetch.call(this, resource, init);
    };
  };

  const blockInsecureXHR = () => {
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url){
      const absolute = new URL(url, window.location.origin);
      if (absolute.protocol !== 'https:' && absolute.origin !== window.location.origin) {
        throw new Error('Blocked insecure XMLHttpRequest.');
      }
      return open.apply(this, arguments);
    };
  };

  const init = () => {
    sanitizeSearchParams();
    secureLinks();
    document.querySelectorAll('form').forEach(sanitizeForm);
    document.querySelectorAll('[data-unsafe-html]').forEach(el => {
      el.innerHTML = TrustedSanitizer.sanitize(el.innerHTML);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    secureFetch();
    blockInsecureXHR();
    protectInnerHTML();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
