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
})(window, window.location);
