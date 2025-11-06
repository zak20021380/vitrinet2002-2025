(function () {
  const existingEnv = window.__ENV__ || {};
  const existingConsent = window.__CONSENT__ || {};
  const existingAnalytics = window.__ANALYTICS_CONFIG__ || {};

  const defaultEnv = {
    isProd: location.hostname.endsWith("{{DOMAIN}}"),
    analyticsEnabled: true
  };

  const defaultAnalytics = {
    PRODUCTION_DOMAIN: "{{DOMAIN}}",
    GTM_ID: "{{GTM_ID}}",
    GA4_ID: "{{GA4_ID}}",
    POSTHOG_HOST: "{{POSTHOG_HOST}}",
    POSTHOG_KEY: "{{POSTHOG_KEY}}",
    PLAUSIBLE_DOMAIN: "{{PLAUSIBLE_DOMAIN}}"
  };

  window.__ENV__ = Object.assign({}, defaultEnv, existingEnv);
  window.__CONSENT__ = Object.assign({ analytics: true }, existingConsent);
  window.__ANALYTICS_CONFIG__ = Object.assign({}, defaultAnalytics, existingAnalytics);
})();
