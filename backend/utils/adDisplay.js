const {
  parseDurationHours,
  getAdDisplayDurationHours,
  computeExpiresAt
} = require('./adDisplayConfig');

function toDate(value) {
  if (value instanceof Date) return value;
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function resolveDurationHours(rawDuration, planSlug) {
  const parsed = parseDurationHours(rawDuration);
  if (parsed) return parsed;
  return getAdDisplayDurationHours(planSlug);
}

function calculateExpiry(info) {
  if (!info) {
    return { durationHours: null, expiresAt: null };
  }

  const displayedAt = toDate(info.displayedAt);
  if (!displayedAt) {
    return { durationHours: null, expiresAt: null };
  }

  const durationHours = resolveDurationHours(info.displayDurationHours, info.planSlug);
  if (!durationHours) {
    return { durationHours: null, expiresAt: null };
  }

  const expiresAt = computeExpiresAt(info.planSlug, displayedAt, durationHours);
  if (!expiresAt) {
    return { durationHours: null, expiresAt: null };
  }

  return { durationHours, expiresAt };
}

module.exports = {
  toDate,
  resolveDurationHours,
  calculateExpiry
};
