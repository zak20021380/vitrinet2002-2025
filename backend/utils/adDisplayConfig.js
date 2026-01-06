const DEFAULT_FALLBACK_HOURS = 24;

function normaliseSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_');
}

function parseDurationHours(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
  }

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const match = trimmed.toLowerCase().match(/^(\d+(?:\.\d+)?)([hd]?)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = match[2];
  if (unit === 'd') {
    return amount * 24;
  }
  return amount;
}

function parsePositiveNumber(value) {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function buildDurationMap(raw) {
  const map = new Map();
  if (!raw) return map;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return map;

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        Object.entries(parsed).forEach(([key, value]) => {
          const hours = parseDurationHours(value);
          if (hours) {
            map.set(normaliseSlug(key), hours);
          }
        });
        return map;
      } catch (err) {
        console.warn('⚠️  Failed to parse AD_DISPLAY_DURATION_MAP as JSON:', err.message || err);
      }
    }

    trimmed.split(',').forEach(segment => {
      if (!segment) return;
      const [keyPart, valuePart] = segment.split(':');
      if (!keyPart || valuePart === undefined) return;
      const hours = parseDurationHours(valuePart);
      if (!hours) return;
      map.set(normaliseSlug(keyPart), hours);
    });
    return map;
  }

  if (typeof raw === 'object') {
    Object.entries(raw).forEach(([key, value]) => {
      const hours = parseDurationHours(value);
      if (hours) {
        map.set(normaliseSlug(key), hours);
      }
    });
  }

  return map;
}

const envDefaultRaw = process.env.AD_DISPLAY_DEFAULT_HOURS;
const parsedDefault = parseDurationHours(envDefaultRaw);
const DEFAULT_DURATION_HOURS = envDefaultRaw !== undefined ? parsedDefault : DEFAULT_FALLBACK_HOURS;

const durationMap = buildDurationMap(process.env.AD_DISPLAY_DURATION_MAP);

function getAdDisplayDurationHours(planSlug) {
  const slug = normaliseSlug(planSlug);
  if (slug && durationMap.has(slug)) {
    return durationMap.get(slug);
  }
  return DEFAULT_DURATION_HOURS || null;
}

function computeExpiresAt(planSlug, displayedAt, overrideHours) {
  const baseDate = displayedAt instanceof Date
    ? displayedAt
    : displayedAt
      ? new Date(displayedAt)
      : null;

  if (!baseDate || Number.isNaN(baseDate.getTime())) {
    return null;
  }

  let hours = overrideHours != null ? parseDurationHours(overrideHours) : null;
  if (!hours) {
    hours = getAdDisplayDurationHours(planSlug);
  }
  if (!hours) return null;

  // Convert hours to days (round up to ensure full days)
  const durationDays = Math.ceil(hours / 24);
  
  // Business rule: Start day counts as a full active day
  // expire_date = start_date + (N - 1) days, at 23:59:59
  // Example: Start 1404/01/17, Duration 1 day → Expire 1404/01/17 23:59:59
  // Example: Start 1404/01/17, Duration 3 days → Expire 1404/01/19 23:59:59
  
  // Get the start of the display day (midnight)
  const startOfDay = new Date(baseDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  // Add (durationDays - 1) days to get the expiration date
  const expirationDate = new Date(startOfDay);
  expirationDate.setDate(expirationDate.getDate() + (durationDays - 1));
  
  // Set time to end of day (23:59:59.999)
  expirationDate.setHours(23, 59, 59, 999);
  
  return expirationDate;
}

function getCleanupIntervalMs() {
  const raw = process.env.AD_DISPLAY_CLEANUP_INTERVAL_MINUTES;
  const minutes = parsePositiveNumber(raw) || 15;
  return minutes * 60 * 1000;
}

module.exports = {
  normaliseSlug,
  parseDurationHours,
  getAdDisplayDurationHours,
  computeExpiresAt,
  getCleanupIntervalMs
};
