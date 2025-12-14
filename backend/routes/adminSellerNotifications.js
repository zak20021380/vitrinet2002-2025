const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminSellerNotificationController');
const auth = require('../middlewares/authMiddleware');

// ارسال پیام از ادمین به فروشنده
router.post('/', auth('admin'), ctrl.sendNotification);

// دریافت پیام‌های فروشنده (برای داشبورد فروشنده)
router.get('/seller/:sellerId', auth('seller'), ctrl.getSellerNotifications);

// دریافت پیام‌های فروشنده (برای داشبورد ادمین)
router.get('/admin/seller/:sellerId', auth('admin'), ctrl.getSellerNotifications);

// علامت‌گذاری پیام به عنوان خوانده شده
router.put('/:id/read', auth('seller'), ctrl.markAsRead);

// علامت‌گذاری همه پیام‌ها به عنوان خوانده شده
router.put('/seller/:sellerId/read-all', auth('seller'), ctrl.markAllAsRead);

// حذف پیام
router.delete('/:id', auth('seller'), ctrl.deleteNotification);

// دریافت تعداد پیام‌های خوانده نشده
router.get('/seller/:sellerId/unread-count', auth('seller'), ctrl.getUnreadCount);

module.exports = router;
