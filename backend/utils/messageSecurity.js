/**
 * Message Security Utilities
 * ابزارهای امنیتی برای پیام‌ها - جلوگیری از XSS، SQL Injection، و حملات دیگر
 */

const validator = require('validator');

// الگوهای خطرناک که باید شناسایی شوند
const DANGEROUS_PATTERNS = [
  // XSS Patterns
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^>]*>/gi,
  /<link\b[^>]*>/gi,
  /<meta\b[^>]*>/gi,
  /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /data\s*:\s*text\/html/gi,
  /on\w+\s*=/gi, // onclick, onerror, onload, etc.
  
  // SQL Injection Patterns
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b)/gi,
  /('|"|;|--|\*|\/\*|\*\/)/g,
  
  // NoSQL Injection Patterns
  /\$where\s*:/gi,
  /\$gt\s*:/gi,
  /\$lt\s*:/gi,
  /\$ne\s*:/gi,
  /\$regex\s*:/gi,
  /\$or\s*:/gi,
  /\$and\s*:/gi,
  
  // Path Traversal
  /\.\.\//g,
  /\.\.\\+/g,
  
  // Command Injection
  /[;&|`$]/g,
  
  // LDAP Injection
  /[()\\*]/g
];

// کلمات کلیدی مشکوک
const SUSPICIOUS_KEYWORDS = [
  'eval', 'function', 'constructor', 'prototype', '__proto__',
  'innerHTML', 'outerHTML', 'document.write', 'document.cookie',
  'localStorage', 'sessionStorage', 'XMLHttpRequest', 'fetch',
  'window.location', 'document.location', 'alert(', 'confirm(',
  'prompt(', 'console.', 'debugger'
];

// لیست سفید کاراکترهای مجاز برای پیام فارسی
const ALLOWED_CHARS_REGEX = /^[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u200C\u200D\u200E\u200Fa-zA-Z0-9\s.,!?؟،؛:()«»\-_@#%&*+=\[\]{}'"\/\\<>\n\r\t]+$/;

/**
 * پاکسازی متن از کاراکترهای خطرناک
 * @param {string} text - متن ورودی
 * @returns {string} - متن پاکسازی شده
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  
  let sanitized = text;
  
  // حذف کاراکترهای کنترلی به جز newline و tab
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Escape HTML entities
  sanitized = validator.escape(sanitized);
  
  // حذف null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // نرمال‌سازی فضاهای خالی
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

/**
 * بررسی وجود الگوهای خطرناک در متن
 * @param {string} text - متن ورودی
 * @returns {object} - نتیجه بررسی
 */
function detectDangerousPatterns(text) {
  if (!text || typeof text !== 'string') {
    return { safe: true, threats: [] };
  }
  
  const threats = [];
  const lowerText = text.toLowerCase();
  
  // بررسی الگوهای خطرناک
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(text)) {
      threats.push({
        type: 'dangerous_pattern',
        pattern: pattern.toString()
      });
    }
    // Reset regex lastIndex
    pattern.lastIndex = 0;
  }
  
  // بررسی کلمات کلیدی مشکوک
  for (const keyword of SUSPICIOUS_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      threats.push({
        type: 'suspicious_keyword',
        keyword
      });
    }
  }
  
  return {
    safe: threats.length === 0,
    threats
  };
}

/**
 * اعتبارسنجی طول پیام
 * @param {string} text - متن ورودی
 * @param {number} minLength - حداقل طول
 * @param {number} maxLength - حداکثر طول
 * @returns {object} - نتیجه اعتبارسنجی
 */
function validateMessageLength(text, minLength = 1, maxLength = 2000) {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: 'متن پیام الزامی است.' };
  }
  
  const trimmed = text.trim();
  
  if (trimmed.length < minLength) {
    return { valid: false, error: `پیام باید حداقل ${minLength} کاراکتر باشد.` };
  }
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: `پیام نمی‌تواند بیشتر از ${maxLength} کاراکتر باشد.` };
  }
  
  return { valid: true };
}

/**
 * بررسی نرخ ارسال پیام (Rate Limiting)
 * @param {Map} rateLimitMap - نقشه ذخیره‌سازی نرخ
 * @param {string} userId - شناسه کاربر
 * @param {number} maxMessages - حداکثر پیام در بازه زمانی
 * @param {number} windowMs - بازه زمانی به میلی‌ثانیه
 * @returns {object} - نتیجه بررسی
 */
function checkRateLimit(rateLimitMap, userId, maxMessages = 10, windowMs = 60000) {
  const now = Date.now();
  const userKey = `msg_${userId}`;
  
  if (!rateLimitMap.has(userKey)) {
    rateLimitMap.set(userKey, { count: 1, firstRequest: now });
    return { allowed: true, remaining: maxMessages - 1 };
  }
  
  const userData = rateLimitMap.get(userKey);
  
  // اگر بازه زمانی گذشته، ریست کن
  if (now - userData.firstRequest > windowMs) {
    rateLimitMap.set(userKey, { count: 1, firstRequest: now });
    return { allowed: true, remaining: maxMessages - 1 };
  }
  
  // بررسی تعداد پیام‌ها
  if (userData.count >= maxMessages) {
    const resetTime = Math.ceil((userData.firstRequest + windowMs - now) / 1000);
    return { 
      allowed: false, 
      remaining: 0,
      resetInSeconds: resetTime,
      error: `تعداد پیام‌های شما بیش از حد مجاز است. لطفاً ${resetTime} ثانیه صبر کنید.`
    };
  }
  
  userData.count++;
  return { allowed: true, remaining: maxMessages - userData.count };
}

/**
 * پاکسازی و اعتبارسنجی کامل پیام
 * @param {string} text - متن ورودی
 * @param {object} options - تنظیمات
 * @returns {object} - نتیجه پردازش
 */
function processMessage(text, options = {}) {
  const {
    minLength = 1,
    maxLength = 2000,
    allowHtml = false,
    strictMode = true
  } = options;
  
  // اعتبارسنجی نوع
  if (typeof text !== 'string') {
    return { 
      success: false, 
      error: 'فرمت پیام نامعتبر است.',
      code: 'INVALID_FORMAT'
    };
  }
  
  // اعتبارسنجی طول
  const lengthCheck = validateMessageLength(text, minLength, maxLength);
  if (!lengthCheck.valid) {
    return { 
      success: false, 
      error: lengthCheck.error,
      code: 'INVALID_LENGTH'
    };
  }
  
  // بررسی الگوهای خطرناک
  if (strictMode) {
    const dangerCheck = detectDangerousPatterns(text);
    if (!dangerCheck.safe) {
      console.warn('⚠️ Dangerous pattern detected:', dangerCheck.threats);
      return { 
        success: false, 
        error: 'محتوای پیام مجاز نیست.',
        code: 'DANGEROUS_CONTENT',
        threats: dangerCheck.threats
      };
    }
  }
  
  // پاکسازی متن
  let sanitized = allowHtml ? text.trim() : sanitizeText(text);
  
  // بررسی نهایی
  if (!sanitized || sanitized.length === 0) {
    return { 
      success: false, 
      error: 'پیام نمی‌تواند خالی باشد.',
      code: 'EMPTY_MESSAGE'
    };
  }
  
  return {
    success: true,
    sanitizedText: sanitized,
    originalLength: text.length,
    sanitizedLength: sanitized.length
  };
}

/**
 * اعتبارسنجی ObjectId
 * @param {string} id - شناسه
 * @returns {boolean}
 */
function isValidObjectId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[a-fA-F0-9]{24}$/.test(id);
}

/**
 * پاکسازی آرایه از مقادیر نامعتبر
 * @param {Array} arr - آرایه ورودی
 * @returns {Array}
 */
function sanitizeArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => item !== null && item !== undefined);
}

/**
 * لاگ امنیتی
 * @param {string} event - نوع رویداد
 * @param {object} details - جزئیات
 */
function securityLog(event, details) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...details
  };
  
  // در محیط production می‌توان به سرویس لاگ ارسال کرد
  console.log('🔒 Security Log:', JSON.stringify(logEntry));
}

module.exports = {
  sanitizeText,
  detectDangerousPatterns,
  validateMessageLength,
  checkRateLimit,
  processMessage,
  isValidObjectId,
  sanitizeArray,
  securityLog,
  DANGEROUS_PATTERNS,
  SUSPICIOUS_KEYWORDS
};
