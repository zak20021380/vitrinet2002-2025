const test = require('node:test');
const assert = require('node:assert/strict');

const User = require('../models/user');

test('user schema allows phone-only signup payload', () => {
  const user = new User({
    phone: '09121234567'
  });

  const validation = user.validateSync();
  assert.ok(!validation, 'phone-only user should be valid');
});

test('user schema keeps optional profile and otp fields', () => {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const acceptedAt = new Date();
  const user = new User({
    phone: '09121234567',
    firstname: 'علی',
    lastname: 'رضایی',
    city: 'سنندج',
    otp: '12345',
    otpExpire: expiresAt,
    termsAcceptedAt: acceptedAt
  });

  const validation = user.validateSync();
  assert.ok(!validation, 'optional profile fields should be valid');
  assert.equal(user.otp, '12345');
  assert.equal(user.city, 'سنندج');
});
