// routes/auth.js

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { csrfProtection, getCsrfTokenHandler } = require('../middlewares/csrfMiddleware');
const {
  register,
  login,
  getCurrentSeller,  // ← این تابع را از کنترلر ایمپورت کرده‌اید
  verifyCode,
  getCurrentUser,
  registerUser,
  verifyUserOtp,
  loginUser,
  refreshUserSession
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

const signupSubmissionIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'تعداد تلاش ثبت‌نام بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const otpRequestIpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'درخواست بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const otpVerifyIpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'درخواست بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const authCsrfProtection = csrfProtection({ strictMode: true });

router.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

router.get('/csrf-token', getCsrfTokenHandler);

// ۱) ثبت‌نام فروشنده
router.post('/register', authCsrfProtection, signupSubmissionIpLimiter, otpRequestIpLimiter, register);

// ۲) ورود فروشنده
//    — توصیه می‌شود داخل کنترلر پس از تولید JWT، آن را در کوکی httpOnly ست کنید.
//      اما خودِ route اینجا بدون تغییر می‌ماند:
router.post('/login', authCsrfProtection, loginLimiter, login);

router.get(
  '/getCurrentUser',       // آدرس:  /api/auth/getCurrentUser
  authMiddleware('user'),  // فقط اگر نقش user باشد
  getCurrentUser
);

// 🆕 ۳) برگرداندن اطلاعات فروشنده‌ی جاری (برای dashboard)
//      این route جدید را دقیقاً بعد از login اضافه کنید:
router.get('/getCurrentSeller', authMiddleware('seller'), getCurrentSeller);
// ۴) تایید کد پیامک
router.post('/verify', authCsrfProtection, otpVerifyIpLimiter, verifyCode);

// ۵) درخواست کد تایید برای ثبت‌نام/ورود کاربر عادی (فقط با شماره موبایل)
router.post('/register-user', authCsrfProtection, otpRequestIpLimiter, registerUser);

// ۶) تایید کد کاربر عادی و ایجاد سشن
router.post('/verify-user', authCsrfProtection, otpVerifyIpLimiter, verifyUserOtp);

// ۷) ورود کاربر عادی با رمز (برای حساب‌های قدیمی) با محدودیت ضد Brute-Force
router.post('/login-user', authCsrfProtection, loginLimiter, loginUser);
router.post('/refresh-user', authCsrfProtection, refreshUserSession);
// در routes/auth.js قبل از module.exports
router.get('/me', authMiddleware('seller'), getCurrentSeller);


router.post('/admin-login', authCsrfProtection, loginLimiter, (req, res, next) => {
  // می‌تونید rateLimit رو هم روی این روت اعمال کنید یا نه
  next();
}, async (req, res) => {
  // مستقیماً تابع کنترلر رو صدا بزن
  const { adminLogin } = require('../controllers/authController');
  return adminLogin(req, res);
});

module.exports = router;
