# Vitreenet Analytics Guide

This document explains how to configure the privacy-aware analytics abstraction that now powers Vitreenet and how to work with the marketplace events collected for buyers, sellers, and administrators.

## 1. Environment configuration

Each HTML entry-point now injects a lightweight configuration block **before** `/js/analytics.js` is loaded:

```html
<script>
  window.__ENV__ = Object.assign({
    isProd: location.hostname.endsWith("{{DOMAIN}}"),
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
</script>
```

Replace the template placeholders (`{{DOMAIN}}`, `{{GTM_ID}}`, etc.) with the correct values during deployment. If you deploy multiple environments you can serve alternate values (or leave an ID empty to disable that vendor).

### Vendor toggles

* **Google Tag Manager / GA4** – set `GTM_ID` (preferred). If absent, provide `GA4_ID` to load `gtag.js` directly. Leave both empty to disable Google Analytics entirely.
* **PostHog** – provide both `POSTHOG_HOST` (e.g. `https://app.posthog.com` or your self-hosted origin) and `POSTHOG_KEY`. Leaving either empty disables PostHog.
* **Plausible** – set `PLAUSIBLE_DOMAIN` to your reporting domain (e.g. `vitreenet.ir`). You may also add `window.__ANALYTICS_CONFIG__.PLAUSIBLE_SCRIPT_SRC` if you serve the script from a self-hosted endpoint.

The abstraction only loads vendor scripts when **all** of the following are true:

1. `window.__ENV__.analyticsEnabled` is `true`.
2. `window.__CONSENT__.analytics` is `true` (consent granted).
3. `window.__ENV__.isProd` resolves to `true` (hostname ends with your production domain).

In local development (`localhost`) the API simply `console.log`s the events and never injects third-party scripts.

### Consent handling

To temporarily opt-out of analytics (for testing or to honour consent), set `window.__CONSENT__.analytics = false` before `/js/analytics.js` runs. You can also set `window.__ENV__.analyticsEnabled = false` to disable the feature globally.

## 2. Public Analytics API

The abstraction exposes a single `window.analytics` object that normalises calls to the underlying vendors:

* `trackEvent(name, data)`
* `trackViewItem({ item_id, item_name, category, price, currency, shop_id, seller_id })`
* `trackAddToCart({ item_id, item_name, category, price, currency, quantity })`
* `trackBeginCheckout({ value, currency, items })`
* `trackPurchase({ transaction_id, value, currency, items })`
* `trackViewShop({ shop_id, shop_name, shop_type })`
* `trackSearch({ query, filters })`
* `trackSellerLogin({ seller_id, shop_id, plan, status })`
* `trackSellerCreateItem({ seller_id, item_id, item_name })`
* `trackSellerUpdatePlan({ seller_id, plan_id, plan_name })`
* `trackSellerBeginCheckout({ ... })` *(reserved for future seller flows)*
* `trackAdminMetric(name, data)` – emits events prefixed with `admin_` for dashboards.

These methods always log to the console for verification and, in production, fan out to any enabled providers.

## 3. Event coverage

### Buyer-facing pages

* **Home (`index.html`)** – exposes section impressions (`view_section`), hero/search CTAs, category clicks, and search queries via `/js/main-index.js`. Product/shop cards that include `data-product-id` / `data-shop-id` automatically generate `view_item` / `view_shop` events when they scroll into view.
* **Product (`product.html`)** – `/js/product.js` tracks:
  * `view_item` on load (with product metadata and price).
  * `view_shop` when a seller page exists.
  * `add_to_cart` when the user opens the address modal (intent).
  * `begin_checkout` when the “مشاهده صفحه مغازه” CTA is activated.
  * `purchase` when the user copies the seller’s address (completion intent).
  * Recommended items with `data-product-id` automatically emit `view_item`.

### Seller dashboards (`seller/dashboard.html`)

* Dispatches `seller_login` as soon as the authenticated seller profile loads.
* Tracks “create product” form submissions (`seller_create_item`).
* Any plan/upgrade CTA or dynamically injected button triggers `seller_update_plan`.
* Dashboard navigation and CTA elements expose `data-analytics-event` for ad-hoc tracking (visible via DevTools).

### Admin dashboard (`admin/dashboard.html`)

* Emits `admin_loaded` on entry.
* Sidebar navigation clicks report `admin_section_selected`.
* Metric counters (visits, registrations, totals) emit `admin_metric_update` with the new value when they change.
* Search inputs on user, seller, or shopping-centre panels emit `admin_search` / `admin_search_change` events.
* Buttons marked for export receive `data-analytics-event="admin_export_click"` and will log via the shared click handler.

## 4. Adding new events

1. **Use `data-analytics-event`** – attach the attribute to any clickable element and provide an optional JSON payload via `data-analytics`. The global listener in `/js/analytics.js` will forward it to `trackEvent`.
2. **Call `window.analytics` directly** – for more complex flows (e.g., cart, checkout, onboarding) import the relevant helper and supply a structured payload.
3. **Remember consent/perf constraints** – never inject additional vendor scripts directly; extend `/js/analytics.js` instead so performance gates remain intact.

## 5. CSP considerations

If you enforce a Content-Security-Policy, include the following (update hosts for self-managed stacks):

```
script-src 'self' https://www.googletagmanager.com https://www.googletagmanager.com/gtag/js https://www.googletagmanager.com/ns.html https://plausible.io https://cdn.posthog.com {{POSTHOG_HOST}}
```

Add any additional hosts you integrate in the future. For Plausible self-hosting, replace `https://plausible.io` with your origin. For PostHog self-hosting, include your domain.

## 6. Debugging tips

* **Local dev** – use the browser console to inspect `[Analytics] ...` logs.
* **Production smoke test** – temporarily run `window.__ENV__.isProd = true` and supply fake IDs in DevTools; the abstraction will try to initialise each provider without error (network requests will fail silently).
* **Prevent duplicate inits** – all vendor loaders set idempotent flags; you can safely re-import `/js/analytics.js` in other bundles if needed.

## 7. Extensibility checklist

* Extend `window.__ANALYTICS_CONFIG__` for new providers and add matching `safeInit*` helpers.
* Use the shared helpers in `/js/analytics.js` to maintain consent/performance guarantees.
* Document any new high-level events in this file so future contributors understand the payload contract.

