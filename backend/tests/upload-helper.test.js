const assert = require('node:assert/strict');
const test = require('node:test');
const { detectImageType, ALLOWED_EXTENSIONS, ALLOWED_MIMES, SCRIPTABLE_EXTENSIONS } = require('../utils/uploadHelper');

test('detectImageType recognizes allowed raster image signatures', () => {
  assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.key, 'jpeg');
  assert.equal(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.key, 'png');
  assert.equal(detectImageType(Buffer.from('GIF89a', 'ascii'))?.key, 'gif');
  assert.equal(detectImageType(Buffer.from('RIFF0000WEBP', 'ascii'))?.key, 'webp');
});

test('upload allowlists exclude scriptable formats', () => {
  assert.equal(detectImageType(Buffer.from('<svg><script>alert(1)</script></svg>', 'utf8')), null);
  assert.equal(detectImageType(Buffer.from('<html><script>alert(1)</script></html>', 'utf8')), null);
  assert.equal(SCRIPTABLE_EXTENSIONS.has('.svg'), true);
  assert.equal(SCRIPTABLE_EXTENSIONS.has('.html'), true);
  assert.equal(ALLOWED_EXTENSIONS.has('.svg'), false);
  assert.equal(ALLOWED_MIMES.has('image/svg+xml'), false);
  assert.equal(ALLOWED_MIMES.has('text/html'), false);
});
