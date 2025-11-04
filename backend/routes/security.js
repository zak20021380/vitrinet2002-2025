const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const TOKEN_COOKIE = 'csrf_token';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

router.get('/csrf', (req, res) => {
  let token = req.cookies?.[TOKEN_COOKIE];

  if (!token) {
    token = generateToken();
    res.cookie(TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 2 * 60 * 60 * 1000
    });
  }

  res.type('text/plain').send(token);
});

module.exports = router;
