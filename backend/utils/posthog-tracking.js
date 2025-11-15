/**
 * TODO: فعال‌سازی PostHog سمت سرور پس از پیکربندی کلید و میزبان.
 * TODO: Enable server-side PostHog tracking after configuring the key and host.
 */

// const { PostHog } = require('posthog-node');
//
// const POSTHOG_ENABLED = process.env.POSTHOG_ENABLED === 'true';
// const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY || 'phc_YOUR_KEY_HERE';
// const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://analytics.vitreenet.ir';
//
// const posthogClient = POSTHOG_ENABLED
//   ? new PostHog(POSTHOG_API_KEY, {
//       host: POSTHOG_HOST,
//       flushAt: 1,
//       flushInterval: 1000,
//     })
//   : null;
//
// const safeCapture = async (payload) => {
//   if (!POSTHOG_ENABLED || !posthogClient) {
//     return; // در حالت غیرفعال هیچ رویدادی ارسال نمی‌شود | No events are sent while disabled
//   }
//
//   try {
//     await posthogClient.capture(payload);
//   } catch (error) {
//     console.warn('PostHog capture failed (server preview):', error);
//   }
// };
//
// const trackUserRegistered = async (user) => {
//   await safeCapture({
//     distinctId: user?._id?.toString() || 'anonymous-user',
//     event: 'user_registered',
//     properties: {
//       email: user?.email,
//       role: user?.role,
//       city: user?.city,
//     },
//   });
// };
//
// const trackSellerApproved = async (seller) => {
//   await safeCapture({
//     distinctId: seller?._id?.toString() || 'seller',
//     event: 'seller_approved',
//     properties: {
//       shopId: seller?.shopId,
//       approvedBy: seller?.approvedBy,
//     },
//   });
// };
//
// const trackOrderCreated = async (order) => {
//   await safeCapture({
//     distinctId: order?.userId?.toString() || 'order',
//     event: 'order_created',
//     properties: {
//       orderId: order?._id?.toString(),
//       total: order?.total,
//       currency: order?.currency || 'IRR',
//       items: order?.items?.length,
//     },
//   });
// };
//
// const trackPaymentProcessed = async (payment) => {
//   await safeCapture({
//     distinctId: payment?.orderId?.toString() || 'payment',
//     event: 'payment_processed',
//     properties: {
//       orderId: payment?.orderId,
//       status: payment?.status,
//       amount: payment?.amount,
//     },
//   });
// };
//
// const trackProductPublished = async (product) => {
//   await safeCapture({
//     distinctId: product?.sellerId?.toString() || 'product',
//     event: 'product_published',
//     properties: {
//       productId: product?._id?.toString(),
//       category: product?.category,
//       price: product?.price,
//     },
//   });
// };
//
// const shutdownPosthog = async () => {
//   if (posthogClient) {
//     await posthogClient.shutdown();
//   }
// };
//
// module.exports = {
//   POSTHOG_ENABLED,
//   posthogClient,
//   trackUserRegistered,
//   trackSellerApproved,
//   trackOrderCreated,
//   trackPaymentProcessed,
//   trackProductPublished,
//   shutdownPosthog,
// };

// نمونه استفاده (پس از فعال‌سازی):
// const { trackUserRegistered } = require('../utils/posthog-tracking');
// await trackUserRegistered(savedUser);
