/**
 * TODO: فایل تنظیمات PostHog را تنها در زمان انتشار فعال کنید.
 * TODO: Activate the PostHog config only when you are ready for production.
 */

// const POSTHOG_ENABLED = false; // تغییر به true برای فعال‌سازی | Toggle to true to enable tracking
//
// window.POSTHOG_CONFIG = {
//   enabled: POSTHOG_ENABLED,
//   apiKey: 'phc_YOUR_KEY_HERE',
//   apiHost: 'https://analytics.vitreenet.ir'
// };
//
// window.safePosthogCapture = function safePosthogCapture(eventName, properties = {}) {
//   if (!window.POSTHOG_CONFIG?.enabled) {
//     return; // در حالت غیرفعال هیچ رویدادی ارسال نمی‌شود | No events are sent while disabled
//   }
//
//   if (!window.posthog || typeof window.posthog.capture !== 'function') {
//     console.warn('PostHog capture skipped (preview mode).');
//     return;
//   }
//
//   try {
//     window.posthog.capture(eventName, properties);
//   } catch (error) {
//     console.warn('PostHog capture failed (preview mode):', error);
//   }
// };
//
// window.safePosthogIdentify = function safePosthogIdentify(distinctId, properties = {}) {
//   if (!window.POSTHOG_CONFIG?.enabled || !window.posthog) {
//     return;
//   }
//
//   try {
//     window.posthog.identify(distinctId, properties);
//   } catch (error) {
//     console.warn('PostHog identify failed (preview mode):', error);
//   }
// };
//
// document.addEventListener('posthog:config-ready', function () {
//   // این رویداد سفارشی می‌تواند برای هماهنگی اسکریپت‌های دیگر استفاده شود |
//   // Use this custom event to coordinate other scripts after enabling PostHog.
// });
