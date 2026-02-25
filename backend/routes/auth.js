// routes/auth.js

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  register,
  login,
  getCurrentSeller,  // ← این تابع را از کنترلر ایمپورت کرده‌اید
  verifyCode,
  getCurrentUser,
  registerUser,
  verifyUserOtp,
  loginUser
} = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware'); // ← اضافه شد!

// ⚠️ جلوگیری از Brute-force روی لاگین کاربر
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 دقیقه
  max: 5,
  message: {
    message: 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً بعداً دوباره امتحان کنید.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ۱) ثبت‌نام فروشنده
router.post('/register', register);

// ۲) ورود فروشنده
//    — توصیه می‌شود داخل کنترلر پس از تولید JWT، آن را در کوکی httpOnly ست کنید.
//      اما خودِ route اینجا بدون تغییر می‌ماند:
router.post('/login', login);

router.get(
  '/getCurrentUser',       // آدرس:  /api/auth/getCurrentUser
  authMiddleware('user'),  // فقط اگر نقش user باشد
  getCurrentUser
);

// 🆕 ۳) برگرداندن اطلاعات فروشنده‌ی جاری (برای dashboard)
//      این route جدید را دقیقاً بعد از login اضافه کنید:
router.get('/getCurrentSeller', authMiddleware('seller'), getCurrentSeller);
// ۴) تایید کد پیامک
router.post('/verify', verifyCode);

// ۵) درخواست کد تایید برای ثبت‌نام/ورود کاربر عادی (فقط با شماره موبایل)
router.post('/register-user', registerUser);

// ۶) تایید کد کاربر عادی و ایجاد سشن
router.post('/verify-user', verifyUserOtp);

// ۷) ورود کاربر عادی با رمز (برای حساب‌های قدیمی) با محدودیت ضد Brute-Force
router.post('/login-user', loginLimiter, loginUser);
// در routes/auth.js قبل از module.exports
router.get('/me', authMiddleware('seller'), getCurrentSeller);


router.post('/admin-login', loginLimiter, (req, res, next) => {
  // می‌تونید rateLimit رو هم روی این روت اعمال کنید یا نه
  next();
}, async (req, res) => {
  // مستقیماً تابع کنترلر رو صدا بزن
  const { adminLogin } = require('../controllers/authController');
  return adminLogin(req, res);
});

module.exports = router;
