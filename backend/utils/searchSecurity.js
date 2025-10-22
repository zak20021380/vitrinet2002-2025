const { Types } = require('mongoose');

const MAX_QUERY_LENGTH = 200;
const MAX_RESULTS = 50;
const DEFAULT_OMIT_KEYS = new Set(['__v']);
const SUSPICIOUS_PATTERN = /(\.\*){2,}|(\{[^}]*\}){2,}|(\[[^\]]*\]){2,}|[|]{2,}|\(\?[:=!]/;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function coerceSearchTerm(value, { maxLength = MAX_QUERY_LENGTH } = {}) {
  if (value == null) return '';
  const str = typeof value === 'string' ? value : String(value);
  const trimmed = str.trim();
  if (!trimmed) return '';
  return trimmed.slice(0, maxLength);
}

function escapeRegex(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSafeRegex(term) {
  const safe = coerceSearchTerm(term);
  if (!safe) return null;
  return new RegExp(escapeRegex(safe), 'i');
}

function hasSuspiciousPattern(term) {
  if (!term) return false;
  return CONTROL_CHARS.test(term) || SUSPICIOUS_PATTERN.test(term);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizePayload(payload, options = {}) {
  const { omitKeys = [] } = options;
  const omitSet = new Set([...DEFAULT_OMIT_KEYS, ...omitKeys]);

  const walker = (value) => {
    if (value == null) return value;
    if (typeof value === 'string') return escapeHtml(value);
    if (value instanceof Date) return value.toISOString();
    if (Types.ObjectId.isValid?.(value) && value instanceof Types.ObjectId) {
      return value.toString();
    }
    if (Array.isArray(value)) return value.map((item) => walker(item));
    if (typeof value === 'object') {
      const entries = Object.entries(value)
        .filter(([key]) => !omitSet.has(key));
      return entries.reduce((acc, [key, val]) => {
        acc[key] = walker(val);
        return acc;
      }, {});
    }
    return value;
  };

  return walker(payload);
}

function logSuspiciousQuery(req, term, reason = 'suspected-pattern') {
  const details = {
    reason,
    term,
    ip: req?.ip,
    path: req?.originalUrl,
    user: req?.user?.id || null,
  };
  console.warn('[security] Suspicious search activity detected:', details);
  if (req?.app?.emit) {
    req.app.emit('security:search-anomaly', details);
  }
}

module.exports = {
  MAX_QUERY_LENGTH,
  MAX_RESULTS,
  coerceSearchTerm,
  escapeRegex,
  buildSafeRegex,
  hasSuspiciousPattern,
  sanitizePayload,
  escapeHtml,
  logSuspiciousQuery,
};
