const rateLimit = require('express-rate-limit');
const { sanitizeSearchInput } = require('../utils/searchSecurity');

const DEFAULT_SEARCH_LIMIT_MESSAGE = { message: 'درخواست‌های جستجو بیش از حد انجام شد. لطفاً کمی بعد دوباره تلاش کنید.' };
const DEFAULT_AUTOCOMPLETE_MESSAGE = { message: 'درخواست‌ها خیلی سریع ارسال می‌شوند. چند لحظه صبر کنید.' };

const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: DEFAULT_SEARCH_LIMIT_MESSAGE
});

const autocompleteRateLimiter = rateLimit({
  windowMs: 30 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const { value } = sanitizeSearchInput(req.query?.q ?? req.query?.search ?? req.query?.city ?? '');
    return `${req.ip}:${value}`;
  },
  message: DEFAULT_AUTOCOMPLETE_MESSAGE
});

function createAutocompleteDebounce(delayMs = 250) {
  const recentRequests = new Map();

  return function autocompleteDebounce(req, res, next) {
    const { value } = sanitizeSearchInput(req.query?.q ?? req.query?.search ?? req.query?.city ?? '');
    const key = `${req.ip}:${req.baseUrl || ''}:${req.path}:${value}`;
    const now = Date.now();
    const lastCall = recentRequests.get(key);

    if (lastCall && now - lastCall < delayMs) {
      return res.status(429).json(DEFAULT_AUTOCOMPLETE_MESSAGE);
    }

    recentRequests.set(key, now);
    setTimeout(() => {
      const stored = recentRequests.get(key);
      if (stored && stored <= now) {
        recentRequests.delete(key);
      }
    }, delayMs * 4);

    return next();
  };
}

module.exports = {
  searchRateLimiter,
  autocompleteRateLimiter,
  createAutocompleteDebounce
};

