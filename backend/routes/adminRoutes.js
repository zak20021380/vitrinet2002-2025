const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const userWalletController = require('../controllers/userWalletController');

// ثبت‌نام ادمین (برای اولین‌بار یا اگر می‌خوای محدودیت بذاری)
router.post('/register', adminController.register);

// لاگین ادمین
router.post('/login', adminController.login);

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
