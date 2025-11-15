(function configureSellerDashboardEnv(window) {
  if (!window) {
    return;
  }

  window.__ENV__ = Object.assign({
    isProd: window.location.hostname.endsWith("{{DOMAIN}}"),
    analyticsEnabled: true
  }, window.__ENV__ || {});

  window.__CONSENT__ = Object.assign({ analytics: true }, window.__CONSENT__ || {});

  window.__ANALYTICS_CONFIG__ = Object.assign({
    PRODUCTION_DOMAIN: "{{DOMAIN}}",
    GTM_ID: "{{GTM_ID}}",
    GA4_ID: "{{GA4_ID}}",
    POSTHOG_HOST: "{{POSTHOG_HOST}}",
    POSTHOG_KEY: "{{POSTHOG_KEY}}",
    PLAUSIBLE_DOMAIN: "{{PLAUSIBLE_DOMAIN}}"
  }, window.__ANALYTICS_CONFIG__ || {});
})(window);
