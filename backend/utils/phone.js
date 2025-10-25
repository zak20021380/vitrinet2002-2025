const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const DIGIT_VARIANTS = new Map();
for (let i = 0; i <= 9; i += 1) {
  const en = String(i);
  DIGIT_VARIANTS.set(en, [en, PERSIAN_DIGITS[i], ARABIC_DIGITS[i]]);
}

const DIGIT_ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

function normalizePhone(value) {
  if (value == null) return '';
  return String(value)
    .trim()
    .replace(/[۰-۹]/g, d => PERSIAN_DIGITS.indexOf(d) >= 0 ? String(PERSIAN_DIGITS.indexOf(d)) : d)
    .replace(/[٠-٩]/g, d => ARABIC_DIGITS.indexOf(d) >= 0 ? String(ARABIC_DIGITS.indexOf(d)) : d);
}

function buildPhoneCandidates(value) {
  const set = new Set();
  const raw = value == null ? '' : String(value).trim();
  const normalized = normalizePhone(value);
  if (raw) set.add(raw);
  if (normalized) set.add(normalized);
  return Array.from(set);
}

function buildDigitInsensitiveRegex(value) {
  const normalized = normalizePhone(value);
  if (!normalized) return null;
  const pattern = normalized.replace(DIGIT_ESCAPE_REGEX, '\\$&').replace(/\d/g, (d) => {
    const variants = DIGIT_VARIANTS.get(d) || [d];
    return `[${variants.join('')}]`;
  });
  try {
    return new RegExp(`^${pattern}$`);
  } catch {
    return null;
  }
}

module.exports = {
  normalizePhone,
  buildPhoneCandidates,
  buildDigitInsensitiveRegex
};
