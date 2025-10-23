const SUSPICIOUS_REGEX = /(?:\.{2,}|\*{2,}|\|{2,}|\{\d{3,}|\(\?:|\(\?=|\(\?!|\[\^|\$\{|\^\$)/;
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const SCRIPT_TAG_REGEX = /<\/?\s*script[^>]*>/gi;
const EVENT_HANDLER_REGEX = /\son\w+\s*=\s*("[^"]*"|'[^']*')/gi;
const JS_PROTOCOL_REGEX = /javascript:/gi;

const DEFAULT_ALLOWED_CHARS = "\p{L}\p{N}\s@._,'+\-#";

/**
 * Normalises a free text search query by trimming, removing control characters and
 * whitelisting acceptable characters. Suspicious patterns are flagged so callers
 * can raise security signals without blocking legitimate usage.
 */
function sanitizeSearchInput(rawValue, {
  maxLength = 200,
  allowedChars = DEFAULT_ALLOWED_CHARS
} = {}) {
  if (rawValue === undefined || rawValue === null) {
    return { value: '', suspicious: false };
  }

  let value = typeof rawValue === 'string' ? rawValue : String(rawValue);
  const original = value;
  let suspicious = false;

  value = value.normalize('NFKC').trim();
  if (!value) {
    return { value: '', suspicious: false };
  }

  if (CONTROL_CHARS_REGEX.test(value)) {
    suspicious = true;
    value = value.replace(CONTROL_CHARS_REGEX, ' ');
  }

  value = value.replace(/\s+/g, ' ');

  const safeAllowed = allowedChars.replace(/[\\\]\[\-^]/g, (ch) => `\\${ch}`);
  const allowPattern = new RegExp(`[^${safeAllowed}]`, 'gu');
  if (allowPattern.test(value)) {
    suspicious = true;
    value = value.replace(allowPattern, '');
  }

  if (value.length > maxLength) {
    suspicious = true;
    value = value.slice(0, maxLength);
  }

  if (SUSPICIOUS_REGEX.test(original)) {
    suspicious = true;
  }

  return { value, suspicious };
}

const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

function escapeRegExp(str = '') {
  return str.replace(ESCAPE_REGEX, '\\$&');
}

function buildSafeRegex(query) {
  const safeQuery = typeof query === 'string' ? query : '';
  if (!safeQuery) return null;
  return new RegExp(escapeRegExp(safeQuery), 'i');
}

function flagSuspiciousQuery(req, rawValue, reason = 'unknown') {
  if (!req || typeof req !== 'object') return;
  const payload = {
    ip: req.ip,
    path: req.originalUrl,
    reason,
    value: rawValue,
    timestamp: new Date().toISOString()
  };
  if (req.app && typeof req.app.emit === 'function') {
    req.app.emit('security:search-query', payload);
  }
  if (!req.app || !req.app.listenerCount || req.app.listenerCount('security:search-query') === 0) {
    // Fallback logging when no listeners are registered.
    console.warn('[security] suspicious search query detected', payload); // eslint-disable-line no-console
  }
}

function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  let sanitized = value;
  if (CONTROL_CHARS_REGEX.test(sanitized)) {
    sanitized = sanitized.replace(CONTROL_CHARS_REGEX, ' ');
  }
  sanitized = sanitized.replace(SCRIPT_TAG_REGEX, '');
  sanitized = sanitized.replace(EVENT_HANDLER_REGEX, '');
  sanitized = sanitized.replace(JS_PROTOCOL_REGEX, '');
  return sanitized.trim();
}

function sanitizeForOutput(payload) {
  if (payload === null || payload === undefined) return payload;
  if (payload instanceof Date) return payload;
  if (Array.isArray(payload)) {
    return payload.map(item => sanitizeForOutput(item));
  }
  if (typeof payload === 'object') {
    return Object.keys(payload).reduce((acc, key) => {
      acc[key] = sanitizeForOutput(payload[key]);
      return acc;
    }, {});
  }
  if (typeof payload === 'string') {
    return sanitizeString(payload);
  }
  return payload;
}

module.exports = {
  sanitizeSearchInput,
  escapeRegExp,
  buildSafeRegex,
  flagSuspiciousQuery,
  sanitizeForOutput
};

