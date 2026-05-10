const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');
const Admin = require('../models/admin');
const userWalletController = require('../controllers/userWalletController');

const authCsrfProtection = csrfProtection({ strictMode: true });

const adminLoginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: {
    message: 'Too many admin login attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const adminBootstrapLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    message: 'Too many admin bootstrap attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const firstAdminOnlyBootstrap = async (req, res, next) => {
  try {
    const adminExists = await Admin.exists({});
    if (adminExists) {
      return res.status(403).json({
        message: 'Admin registration is disabled after initial bootstrap.'
      });
    }

    return next();
  } catch (err) {
    console.error('admin bootstrap guard error:', err);
    return res.status(500).json({ message: 'Failed to check admin bootstrap state.' });
  }
};

// ثبت‌نام ادمین (برای اولین‌بار یا اگر می‌خوای محدودیت بذاری)
router.post('/register', authCsrfProtection, adminBootstrapLimiter, firstAdminOnlyBootstrap, adminController.register);

// لاگین ادمین
router.post('/login', authCsrfProtection, adminLoginLimiter, adminController.login);

// پروفایل ادمین (فقط با نقش ادمین و توکن معتبر)
router.get('/profile', authMiddleware('admin'), adminController.profile);

// آمار داشبورد ادمین
router.get('/dashboard/stats', authMiddleware('admin'), adminController.getDashboardStats);
router.get('/dashboard/income', authMiddleware('admin'), adminController.getIncomeInsights);

// حذف تراکنش‌های قدیمی کیف پول کاربران
// DELETE /api/admin/wallet/cleanup?days=90
router.delete('/wallet/cleanup', authMiddleware('admin'), userWalletController.adminCleanupTransactions);

// اگر بخوای روت‌های بیشتر مخصوص ادمین اضافه کنی (مثال)
// router.get('/dashboard', authMiddleware('admin'), adminController.dashboard);

module.exports = router;
