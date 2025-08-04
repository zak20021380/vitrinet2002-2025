// utils/premium.js
// Helper utilities for premium seller (VitriPlus) features.
// Handles duration calculation for each plan in a single trusted place.

const PLAN_MONTHS = {
  '1month': 1,
  '3month': 3,
  '12month': 12
};

/**
 * Calculate the premium expiry date based on plan slug.
 * @param {String} slug - plan slug like '1month'.
 * @param {Date} [from=new Date()] - start date.
 * @returns {Date} expiry date in future.
 * @throws if plan slug is invalid.
 */
function calcPremiumUntil(slug, from = new Date()) {
  const months = PLAN_MONTHS[slug];
  if (!months) throw new Error('Invalid plan slug');
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

module.exports = { calcPremiumUntil };
