// utils/premium.js
// Helper utilities for premium seller (VitriPlus) features.
// Handles duration calculation for each plan in a single trusted place.

const {
  getDefaultDurationDays
} = require('../config/subscriptionPlans');

function resolveDurationDays(plan) {
  if (!plan) return null;

  if (typeof plan === 'object') {
    const duration = Number(plan.durationDays);
    if (Number.isFinite(duration) && duration > 0) {
      return duration;
    }
    if (plan.slug) {
      const fallback = getDefaultDurationDays(plan.slug);
      if (fallback) return fallback;
    }
    return null;
  }

  if (typeof plan === 'string') {
    return getDefaultDurationDays(plan) ?? null;
  }

  return null;
}

/**
 * Calculate the premium expiry date based on plan definition or slug.
 * @param {String|Object} plan - plan slug or plan document containing slug/durationDays.
 * @param {Date} [from=new Date()] - start date.
 * @returns {Date} expiry date in future.
 * @throws if plan information is invalid.
 */
function calcPremiumUntil(plan, from = new Date()) {
  const durationDays = resolveDurationDays(plan);
  if (!durationDays) {
    throw new Error('Invalid plan definition for premium duration');
  }

  const d = new Date(from);
  d.setDate(d.getDate() + durationDays);
  return d;
}

module.exports = { calcPremiumUntil };
