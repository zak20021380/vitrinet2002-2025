const loadMainModule = () => import('./main-index-deferred.js');

const scheduleLoad = () => {
  if (window.__mainIndexLoaded) return;
  window.__mainIndexLoaded = true;
  loadMainModule().catch(err => {
    console.error('Failed to load main index module', err);
  });
};

if ('requestIdleCallback' in window) {
  requestIdleCallback(scheduleLoad, { timeout: 2000 });
} else {
  if (document.readyState === 'complete') {
    setTimeout(scheduleLoad, 0);
  } else {
    window.addEventListener('load', scheduleLoad, { once: true });
  }
  setTimeout(scheduleLoad, 2000);
}
