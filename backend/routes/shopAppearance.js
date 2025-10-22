// routes/shopAppearance.js

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middlewares/authMiddleware');    // اضافه شد
const shopAppearanceController = require('../controllers/shopAppearanceController');
const searchDebounceStore = new Map();
const SEARCH_DEBOUNCE_MS = 300;

const searchLimiter = rateLimit({
  windowMs: 15 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'درخواست‌های جستجو بیش از حد است. لطفاً کمی صبر کنید.' },
  keyGenerator: (req) => `shop-search:${req.ip}`,
  skip: (req) => !req.query.centerTitle && !req.query.centerId
});

function debounceSearch(req, res, next) {
  if (!req.query.centerTitle && !req.query.centerId) {
    return next();
  }
  const key = `${req.ip}:shop-search`;
  const now = Date.now();
  const last = searchDebounceStore.get(key) || 0;
  if (now - last < SEARCH_DEBOUNCE_MS) {
    return res.status(429).json({ message: 'درخواست‌های جستجو بسیار سریع ارسال می‌شوند. لطفاً کمی صبر کنید.' });
  }
  searchDebounceStore.set(key, now);
  setTimeout(() => {
    if (searchDebounceStore.get(key) === now) {
      searchDebounceStore.delete(key);
    }
  }, SEARCH_DEBOUNCE_MS * 4);
  next();
}

// =========== GET ظاهر پیش‌فرض برای تست (بدون پارامتر) یا مغازه‌ها بر اساس centerTitle ===========
router.get('/', searchLimiter, debounceSearch, (req, res) => {
  if (req.query.centerTitle) {
    return shopAppearanceController.getShopsByCenterTitle(req, res);
  }
  res.json({
    theme: "modern",
    color: "#7C83FD",
    logo: "/uploads/logo.png"
  });
});

// گرفتن ظاهر فروشگاه بر اساس customUrl (shopurl) [این روت مهمه!]
router.get('/url/:shopurl', shopAppearanceController.getAppearanceByUrl);

// مدیریت نظرات توسط فروشنده
router.get('/reviews/pending', auth('seller'), shopAppearanceController.getPendingReviews);
router.patch('/reviews/:reviewId/approve', auth('seller'), shopAppearanceController.approveReview);
router.delete('/reviews/:reviewId', auth('seller'), shopAppearanceController.rejectReview);

// GET ظاهر فروشگاه برای یک فروشنده (بر اساس sellerId)
router.get('/:sellerId', shopAppearanceController.getShopAppearance);

// POST ذخیره/ویرایش ظاهر فروشگاه (sellerId از پارامتر!)
router.post(
  '/:sellerId/save',
  auth('seller'),    // فقط فروشنده خودش اجازه ویرایش دارد
  shopAppearanceController.saveShopAppearance
);

// دریافت نظرات فروشگاه
router.get(
  '/:sellerId/reviews',
  shopAppearanceController.getReviews
);

// POST ثبت امتیاز فروشگاه – فقط کاربران لاگین‌شده
router.post(
  '/:sellerId/rate',
  auth(),           // تضمین می‌کند که کاربر لاگین باشد
  shopAppearanceController.addReview
);

// POST همگام‌سازی امتیازات به ServiceShops – فقط ادمین
router.post(
  '/admin/sync-ratings',
  auth('admin'),
  shopAppearanceController.syncRatingsToServiceShops
);

module.exports = router;
