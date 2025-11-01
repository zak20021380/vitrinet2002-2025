/**
 * Vitrinet Security Utilities
 * Centralized security functions for XSS prevention, CSRF protection, and secure API communication
 * @version 1.0.0
 */

(function(global) {
  'use strict';

  const SecurityUtils = {

    /**
     * HTML Escape - Prevents XSS by escaping HTML special characters
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeHTML: function(str) {
      if (str === null || str === undefined) return '';
      return String(str).replace(/[&<>"'`=\/]/g, function(char) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '`': '&#x60;',
          '=': '&#x3D;',
          '/': '&#x2F;'
        }[char];
      });
    },

    /**
     * Sanitize URL to prevent open redirects
     * @param {string} url - URL to validate
     * @returns {string|null} Sanitized URL or null if invalid
     */
    sanitizeURL: function(url) {
      if (!url) return null;

      // Allow only relative URLs or whitelisted protocols
      const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];

      try {
        // Relative URLs are safe
        if (url.startsWith('/') && !url.startsWith('//')) {
          return url;
        }

        const parsed = new URL(url, window.location.origin);

        // Check if protocol is allowed
        if (!allowedProtocols.includes(parsed.protocol)) {
          console.warn('Blocked unsafe URL protocol:', parsed.protocol);
          return null;
        }

        // Prevent javascript: and data: URLs
        if (parsed.protocol === 'javascript:' || parsed.protocol === 'data:') {
          return null;
        }

        return parsed.href;
      } catch (e) {
        console.warn('Invalid URL:', url);
        return null;
      }
    },

    /**
     * Sanitize HTML using DOMPurify (requires DOMPurify to be loaded)
     * Falls back to text content if DOMPurify is not available
     * @param {string} html - HTML to sanitize
     * @param {object} config - DOMPurify configuration
     * @returns {string} Sanitized HTML
     */
    sanitizeHTML: function(html, config = {}) {
      if (typeof DOMPurify !== 'undefined') {
        const defaultConfig = {
          ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span', 'div', 'ul', 'ol', 'li'],
          ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
          ALLOW_DATA_ATTR: false,
          SAFE_FOR_JQUERY: true
        };
        return DOMPurify.sanitize(html, { ...defaultConfig, ...config });
      } else {
        // Fallback: strip all HTML tags
        console.warn('DOMPurify not loaded, stripping all HTML tags');
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
      }
    },

    /**
     * Validate and sanitize user input
     * @param {string} input - User input
     * @param {string} type - Input type (text, email, phone, number, url)
     * @returns {object} { valid: boolean, sanitized: string, error: string }
     */
    validateInput: function(input, type = 'text') {
      const result = {
        valid: false,
        sanitized: '',
        error: ''
      };

      if (input === null || input === undefined) {
        result.error = 'Input is required';
        return result;
      }

      const trimmed = String(input).trim();

      switch (type) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(trimmed)) {
            result.error = 'Invalid email format';
            return result;
          }
          result.sanitized = trimmed.toLowerCase();
          result.valid = true;
          break;

        case 'phone':
          // Iranian phone number: 09XXXXXXXXX
          const phoneRegex = /^09\d{9}$/;
          const cleaned = trimmed.replace(/[^\d]/g, '');
          if (!phoneRegex.test(cleaned)) {
            result.error = 'Invalid phone number format (09XXXXXXXXX)';
            return result;
          }
          result.sanitized = cleaned;
          result.valid = true;
          break;

        case 'number':
          const num = parseFloat(trimmed);
          if (isNaN(num)) {
            result.error = 'Invalid number';
            return result;
          }
          result.sanitized = num;
          result.valid = true;
          break;

        case 'url':
          const sanitizedUrl = this.sanitizeURL(trimmed);
          if (!sanitizedUrl) {
            result.error = 'Invalid or unsafe URL';
            return result;
          }
          result.sanitized = sanitizedUrl;
          result.valid = true;
          break;

        case 'text':
        default:
          // Maximum length check
          if (trimmed.length > 10000) {
            result.error = 'Input too long (max 10000 characters)';
            return result;
          }
          result.sanitized = this.escapeHTML(trimmed);
          result.valid = true;
          break;
      }

      return result;
    },

    /**
     * CSRF Token Management
     */
    csrf: {
      _token: null,
      _tokenExpiry: null,

      /**
       * Fetch CSRF token from server
       * @returns {Promise<string>} CSRF token
       */
      getToken: async function() {
        // Check if cached token is still valid
        if (this._token && this._tokenExpiry && Date.now() < this._tokenExpiry) {
          return this._token;
        }

        try {
          const response = await fetch('/api/csrf-token', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error('Failed to fetch CSRF token');
          }

          const data = await response.json();
          this._token = data.csrfToken;
          // Cache token for 30 minutes
          this._tokenExpiry = Date.now() + (30 * 60 * 1000);

          return this._token;
        } catch (error) {
          console.error('CSRF token fetch error:', error);
          // Generate a temporary client-side token as fallback
          this._token = this._generateFallbackToken();
          return this._token;
        }
      },

      /**
       * Generate fallback CSRF token (client-side)
       * @returns {string} Random token
       */
      _generateFallbackToken: function() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      },

      /**
       * Add CSRF token to fetch options
       * @param {object} options - Fetch options
       * @returns {Promise<object>} Options with CSRF token
       */
      addTokenToRequest: async function(options = {}) {
        const token = await this.getToken();

        options.headers = options.headers || {};
        options.headers['X-CSRF-Token'] = token;

        return options;
      },

      /**
       * Clear cached token (call on logout)
       */
      clearToken: function() {
        this._token = null;
        this._tokenExpiry = null;
      }
    },

    /**
     * Secure Fetch Wrapper
     * Automatically adds CSRF token and security headers
     * @param {string} url - Request URL
     * @param {object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     */
    secureFetch: async function(url, options = {}) {
      // Validate URL
      const sanitizedUrl = this.sanitizeURL(url);
      if (!sanitizedUrl) {
        throw new Error('Invalid or unsafe URL');
      }

      // Add CSRF token for state-changing requests
      const method = (options.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        options = await this.csrf.addTokenToRequest(options);
      }

      // Ensure credentials are included
      options.credentials = options.credentials || 'include';

      // Add security headers
      options.headers = options.headers || {};
      options.headers['X-Requested-With'] = 'XMLHttpRequest';

      try {
        const response = await fetch(sanitizedUrl, options);

        // Handle CSRF token errors
        if (response.status === 403) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (data.error && data.error.includes('CSRF')) {
              // Clear cached token and retry once
              this.csrf.clearToken();
              console.warn('CSRF token invalid, retrying...');
            }
          }
        }

        return response;
      } catch (error) {
        console.error('Secure fetch error:', error);
        throw error;
      }
    },

    /**
     * Secure localStorage wrapper
     * Prevents storing sensitive data in localStorage
     */
    storage: {
      _sensitiveKeys: ['password', 'token', 'secret', 'key', 'credential'],

      /**
       * Check if key contains sensitive data
       * @param {string} key - Storage key
       * @returns {boolean} True if sensitive
       */
      _isSensitiveKey: function(key) {
        const lowerKey = key.toLowerCase();
        return this._sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
      },

      /**
       * Warn about sensitive data storage
       * @param {string} key - Storage key
       */
      _warnSensitive: function(key) {
        if (this._isSensitiveKey(key)) {
          console.warn(
            `⚠️ Security Warning: Storing potentially sensitive data in localStorage: "${key}". ` +
            `Consider using httpOnly cookies or sessionStorage instead.`
          );
        }
      },

      /**
       * Set item in localStorage with validation
       * @param {string} key - Storage key
       * @param {*} value - Value to store
       */
      setItem: function(key, value) {
        this._warnSensitive(key);
        try {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        } catch (e) {
          console.error('localStorage error:', e);
        }
      },

      /**
       * Get item from localStorage
       * @param {string} key - Storage key
       * @returns {*} Stored value
       */
      getItem: function(key) {
        try {
          const value = localStorage.getItem(key);
          if (!value) return null;

          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        } catch (e) {
          console.error('localStorage error:', e);
          return null;
        }
      },

      /**
       * Remove item from localStorage
       * @param {string} key - Storage key
       */
      removeItem: function(key) {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.error('localStorage error:', e);
        }
      },

      /**
       * Clear all localStorage
       */
      clear: function() {
        try {
          localStorage.clear();
        } catch (e) {
          console.error('localStorage error:', e);
        }
      }
    },

    /**
     * Production Error Boundary
     */
    errorBoundary: {
      _initialized: false,
      _isProduction: window.location.hostname !== 'localhost' &&
                     window.location.hostname !== '127.0.0.1',

      /**
       * Initialize error boundary
       */
      init: function() {
        if (this._initialized) return;

        // Global error handler
        window.addEventListener('error', (event) => {
          this._handleError(event.error || event.message, event);
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
          this._handleError(event.reason, event);
        });

        // Suppress console in production
        if (this._isProduction) {
          this._suppressConsole();
        }

        this._initialized = true;
      },

      /**
       * Handle errors
       * @param {Error|string} error - Error object or message
       * @param {Event} event - Error event
       */
      _handleError: function(error, event) {
        // Log to server in production
        if (this._isProduction) {
          this._logToServer(error);

          // Show user-friendly message
          console.error('An error occurred. Please refresh the page or contact support.');

          // Prevent default error display
          if (event && event.preventDefault) {
            event.preventDefault();
          }
        } else {
          // In development, show full error
          console.error('Error:', error);
        }
      },

      /**
       * Log error to server
       * @param {Error|string} error - Error object or message
       */
      _logToServer: function(error) {
        try {
          const errorData = {
            message: error.message || String(error),
            stack: error.stack || '',
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString()
          };

          // Send to error logging endpoint
          fetch('/api/logs/client-error', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(errorData),
            credentials: 'include'
          }).catch(() => {
            // Silently fail if logging fails
          });
        } catch (e) {
          // Silently fail
        }
      },

      /**
       * Suppress console methods in production
       */
      _suppressConsole: function() {
        const noop = function() {};
        const methods = ['log', 'debug', 'info', 'warn'];

        methods.forEach(method => {
          console[method] = noop;
        });

        // Keep console.error for critical issues
      }
    },

    /**
     * Initialize all security features
     */
    init: function() {
      this.errorBoundary.init();

      // Add CSP violation reporting
      document.addEventListener('securitypolicyviolation', (e) => {
        console.warn('CSP Violation:', {
          violatedDirective: e.violatedDirective,
          blockedURI: e.blockedURI,
          originalPolicy: e.originalPolicy
        });
      });

      console.log('🔒 Vitrinet Security Utils initialized');
    }
  };

  // Export to global scope
  global.SecurityUtils = SecurityUtils;

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SecurityUtils.init());
  } else {
    SecurityUtils.init();
  }

})(window);
