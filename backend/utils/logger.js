/**
 * Secure Logger Utility
 * Environment-based logging that prevents sensitive data leakage
 * 
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('User logged in', { userId: '123' });
 *   logger.debug('Processing request', { endpoint: '/api/users' });
 *   logger.warn('Rate limit approaching', { ip: '***' });
 *   logger.error('Database error', error);
 */

const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev = NODE_ENV === 'development';
const isProd = NODE_ENV === 'production';

// Patterns to detect sensitive data
const SENSITIVE_PATTERNS = [
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,  // JWT tokens
  /^Bearer\s+eyJ/i,                                        // Bearer tokens
  /^data:image\/[a-z]+;base64,/i,                         // Base64 images
  /^[A-Za-z0-9+/]{100,}={0,2}$/,                          // Long base64 strings
  /^[0-9a-f]{64}$/i,                                       // Hex hashes (64 chars)
];

// Keys that should never be logged
const SENSITIVE_KEYS = new Set([
  'password', 'token', 'jwt', 'secret', 'authorization',
  'cookie', 'cookies', 'accesstoken', 'refreshtoken',
  'apikey', 'api_key', 'privatekey', 'private_key',
  'bannerimage', 'image', 'photo', 'logo', 'avatar',
  'base64', 'data', 'body', 'rawbody', 'buffer'
]);

/**
 * Check if a value looks like sensitive data
 */
function isSensitiveValue(value) {
  if (typeof value !== 'string') return false;
  if (value.length > 200) return true; // Long strings are likely binary/encoded
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * Check if a key name suggests sensitive data
 */
function isSensitiveKey(key) {
  if (typeof key !== 'string') return false;
  const lowerKey = key.toLowerCase().replace(/[_-]/g, '');
  return SENSITIVE_KEYS.has(lowerKey);
}

/**
 * Sanitize an object for safe logging
 * Replaces sensitive values with placeholders
 */
function sanitize(obj, depth = 0) {
  if (depth > 5) return '[MAX_DEPTH]';
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    if (isSensitiveValue(obj)) {
      if (obj.startsWith('eyJ')) return '[JWT_TOKEN]';
      if (obj.startsWith('data:image')) return '[BASE64_IMAGE]';
      if (obj.length > 200) return `[BINARY_DATA:${obj.length}chars]`;
      return '[REDACTED]';
    }
    // Truncate long strings
    if (obj.length > 100) {
      return obj.substring(0, 50) + '...[truncated]';
    }
    return obj;
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length > 10) {
      return `[Array:${obj.length} items]`;
    }
    return obj.slice(0, 5).map(item => sanitize(item, depth + 1));
  }
  
  if (typeof obj === 'object') {
    // Handle Error objects
    if (obj instanceof Error) {
      return {
        name: obj.name,
        message: obj.message,
        code: obj.code
      };
    }
    
    const sanitized = {};
    const keys = Object.keys(obj);
    
    if (keys.length > 20) {
      return `[Object:${keys.length} keys]`;
    }
    
    for (const key of keys) {
      if (isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitize(obj[key], depth + 1);
      }
    }
    return sanitized;
  }
  
  return '[UNKNOWN_TYPE]';
}

/**
 * Format log message with timestamp
 */
function formatMessage(level, message, data) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (data !== undefined) {
    const safeData = sanitize(data);
    return `${prefix} ${message} ${JSON.stringify(safeData)}`;
  }
  return `${prefix} ${message}`;
}

/**
 * Logger object with environment-aware methods
 */
const logger = {
  /**
   * Debug level - only in development
   */
  debug(message, data) {
    if (isDev) {
      console.log(formatMessage('debug', message, data));
    }
  },

  /**
   * Info level - only in development
   */
  info(message, data) {
    if (isDev) {
      console.log(formatMessage('info', message, data));
    }
  },

  /**
   * Warn level - all environments
   */
  warn(message, data) {
    console.warn(formatMessage('warn', message, data));
  },

  /**
   * Error level - all environments
   */
  error(message, error) {
    const safeError = error instanceof Error 
      ? { name: error.name, message: error.message, code: error.code }
      : sanitize(error);
    console.error(formatMessage('error', message, safeError));
  },

  /**
   * Request logging helper - minimal structured output
   */
  request(req, extra = {}) {
    if (!isDev) return;
    
    const info = {
      method: req.method,
      path: req.originalUrl || req.url,
      userId: req.user?.id ? `${String(req.user.id).slice(0, 8)}...` : undefined,
      role: req.user?.role,
      ...extra
    };
    
    // Remove undefined values
    Object.keys(info).forEach(key => {
      if (info[key] === undefined) delete info[key];
    });
    
    console.log(formatMessage('request', `${req.method} ${req.originalUrl || req.url}`, info));
  },

  /**
   * Security event logging
   */
  security(event, details) {
    const safeDetails = sanitize(details);
    console.warn(formatMessage('security', event, safeDetails));
  }
};

module.exports = logger;
module.exports.sanitize = sanitize;
module.exports.isDev = isDev;
module.exports.isProd = isProd;
