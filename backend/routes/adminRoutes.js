const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');

// ثبت‌نام ادمین (برای اولین‌بار یا اگر می‌خوای محدودیت بذاری)
router.post('/register', adminController.register);

// لاگین ادمین
router.post('/login', adminController.login);

// پروفایل ادمین (فقط با نقش ادمین و توکن معتبر)
router.get('/profile', authMiddleware('admin'), adminController.profile);

// اگر بخوای روت‌های بیشتر مخصوص ادمین اضافه کنی (مثال)
// router.get('/dashboard', authMiddleware('admin'), adminController.dashboard);

module.exports = router;
