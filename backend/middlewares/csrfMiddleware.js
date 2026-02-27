// backend/middlewares/csrfMiddleware.js
// میدل‌ور CSRF Protection - Double Submit Cookie Pattern
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');

// Environment check
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev = NODE_ENV === 'development';

// Secret key for HMAC signing (should be in env vars in production)
const CSRF_SECRET = process.env.CSRF_SECRET || 'vitrinet_csrf_secret_key_2024';
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const COOKIE_NAME = 'csrf_token';

/**
 * Generate a signed CSRF token
 * @returns {object} - { token, signature }
 */
function generateCsrfToken() {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(16).toString('hex');
  const token = `${timestamp}.${randomPart}`;
  
  // Create HMAC signature
  const signature = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(token)
    .digest('hex');
  
  return {
    token,
    signature,
    full: `${token}.${signature}`
  };
}

/**
 * Validate a CSRF token
 * @param {string} fullToken - The full token (token.signature)
 * @returns {object} - { valid: boolean, reason?: string }
 */
function validateCsrfToken(fullToken) {
  if (!fullToken || typeof fullToken !== 'string') {
    return { valid: false, reason: 'MISSING_TOKEN' };
  }
  
  const parts = fullToken.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'INVALID_FORMAT' };
  }
  
  const [timestamp, randomPart, signature] = parts;
  const token = `${timestamp}.${randomPart}`;
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(token)
    .digest('hex');
  
  // Timing-safe comparison
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }
  
  // Check expiry
  const tokenTime = parseInt(timestamp, 36);
  if (Date.now() - tokenTime > TOKEN_EXPIRY_MS) {
    return { valid: false, reason: 'EXPIRED' };
  }
  
  return { valid: true };
}

function timingSafeTokenMatch(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * CSRF Protection Middleware
 * Uses Double Submit Cookie pattern
 */
function csrfProtection(options = {}) {
  const {
    skipMethods = ['GET', 'HEAD', 'OPTIONS'],
    headerName = 'x-csrf-token',
    strictMode = false
  } = options;

  return (req, res, next) => {
    // Safe methods don't need CSRF check
    if (skipMethods.includes(req.method.toUpperCase())) {
      return next();
    }

    // Get token from header
    const headerToken = req.headers[headerName];
    
    // Get token from cookie
    const cookieToken = req.cookies?.[COOKIE_NAME];

    // Check X-Requested-With header (additional protection)
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
    // In strict mode, both tokens must exist and match
    if (strictMode) {
      if (!headerToken || !cookieToken) {
        if (isDev) console.warn('[CSRF] Missing CSRF token:', req.method, req.originalUrl);
        return res.status(403).json({
          success: false,
          message: 'Missing CSRF token. Please refresh the page.',
          code: 'CSRF_TOKEN_MISSING'
        });
      }

      if (!timingSafeTokenMatch(headerToken, cookieToken)) {
        if (isDev) console.warn('[CSRF] Header/Cookie mismatch:', req.method, req.originalUrl);
        return res.status(403).json({
          success: false,
          message: 'Invalid CSRF token. Please refresh the page.',
          code: 'CSRF_TOKEN_MISMATCH'
        });
      }

      if (!isAjax) {
        if (isDev) console.warn('[CSRF] Missing X-Requested-With header:', req.method, req.originalUrl);
        return res.status(403).json({
          success: false,
          message: 'Invalid security request.',
          code: 'CSRF_AJAX_REQUIRED'
        });
      }
    }

    // Validate header token
    if (headerToken) {
      const headerValidation = validateCsrfToken(headerToken);
      if (!headerValidation.valid && strictMode) {
        if (isDev) console.warn('[CSRF] Invalid header token:', headerValidation.reason, req.originalUrl);
        return res.status(403).json({
          success: false,
          message: 'Invalid CSRF token. Please refresh the page.',
          code: 'CSRF_TOKEN_INVALID'
        });
      }
    }

    // Validate cookie token in strict mode
    if (cookieToken) {
      const cookieValidation = validateCsrfToken(cookieToken);
      if (!cookieValidation.valid && strictMode) {
        if (isDev) console.warn('[CSRF] Invalid cookie token:', cookieValidation.reason, req.originalUrl);
        return res.status(403).json({
          success: false,
          message: 'Invalid CSRF token. Please refresh the page.',
          code: 'CSRF_COOKIE_INVALID'
        });
      }
    }
    // Origin/Referer check for additional security
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const host = req.headers.host;

    if (origin || referer) {
      try {
        const sourceHost = origin 
          ? new URL(origin).host 
          : (referer ? new URL(referer).host : null);
        
        if (sourceHost && sourceHost !== host) {
          if (isDev) console.warn('[CSRF] Origin mismatch:', { sourceHost, host });
          if (strictMode) {
            return res.status(403).json({
              success: false,
              message: 'درخواست از منبع نامعتبر.',
              code: 'CSRF_ORIGIN_MISMATCH'
            });
          }
        }
      } catch (e) {
        // Invalid URL, ignore
      }
    }

    next();
  };
}

/**
 * Middleware to provide CSRF token to client
 * Sets cookie and provides token in response
 */
function csrfTokenProvider(req, res, next) {
  // Generate new token
  const { full } = generateCsrfToken();
  
  // Set cookie (httpOnly: false so JS can read it)
  res.cookie(COOKIE_NAME, full, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_EXPIRY_MS
  });
  
  // Attach to response for easy access
  res.csrfToken = full;
  
  // Add helper function
  res.getCsrfToken = () => full;
  
  next();
}

/**
 * Endpoint handler to get CSRF token
 * GET /api/csrf-token
 */
function getCsrfTokenHandler(req, res) {
  const { full } = generateCsrfToken();
  
  // Set cookie
  res.cookie(COOKIE_NAME, full, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_EXPIRY_MS
  });
  
  res.json({
    success: true,
    csrfToken: full
  });
}

module.exports = {
  csrfProtection,
  csrfTokenProvider,
  getCsrfTokenHandler,
  generateCsrfToken,
  validateCsrfToken,
  COOKIE_NAME
};

