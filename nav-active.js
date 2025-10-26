(function() {
  const SHIM_ATTRIBUTE = 'data-vitreenet-nav-shim';
  if (document.currentScript && document.currentScript.hasAttribute(SHIM_ATTRIBUTE)) {
    return;
  }

  const existing = document.querySelector(`script[${SHIM_ATTRIBUTE}]`);
  if (existing) {
    return;
  }

  const script = document.createElement('script');
  script.src = '/public/nav-active.js';
  script.defer = true;
  script.setAttribute(SHIM_ATTRIBUTE, '');
  script.onerror = function() {
    console.warn('[Vitreenet] Failed to load /public/nav-active.js');
  };

  const current = document.currentScript;
  if (current && current.parentNode) {
    current.parentNode.insertBefore(script, current.nextSibling);
  } else {
    document.head.appendChild(script);
  }
})();
