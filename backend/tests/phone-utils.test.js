const test = require('node:test');
const assert = require('node:assert/strict');

const { buildDigitInsensitiveRegex } = require('../utils/phone');

test('digit insensitive regex respects separators option', () => {
  const strict = buildDigitInsensitiveRegex('0912 123 4567');
  assert.ok(strict.test('0912 123 4567'));
  assert.ok(!strict.test('09121234567'));

  const loose = buildDigitInsensitiveRegex('0912 123 4567', { allowSeparators: true });
  assert.ok(loose.test('09121234567'));
  assert.ok(loose.test('۰۹۱۲-۱۲۳-۴۵۶۷'));
});

