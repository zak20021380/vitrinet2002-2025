const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/bookingController');

// ایجاد نوبت جدید (عمومی)
router.post('/bookings', ctrl.createBooking);

// دریافت نوبت‌های فروشنده لاگین شده
router.get('/seller-bookings/me', auth('seller'), ctrl.getSellerBookings);

// تغییر وضعیت نوبت
router.patch('/seller-bookings/:id/status', auth('seller'), ctrl.updateBookingStatus);

// بررسی وضعیت نوبت بر اساس شماره تلفن مشتری
router.get('/bookings/status', ctrl.checkBookingStatus);

module.exports = router;
