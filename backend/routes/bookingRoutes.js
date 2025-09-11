const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/bookingController');

// ایجاد نوبت جدید (عمومی)
router.post('/bookings', ctrl.createBooking);

// دریافت نوبت‌های کاربر بر اساس شماره تلفن
router.get('/bookings', ctrl.getCustomerBookings);

// حذف نوبت توسط کاربر
router.delete('/bookings/:id', ctrl.deleteBookingById);

// لغو نوبت توسط کاربر
router.put('/bookings/:id/cancel', ctrl.cancelBookingById);

// دریافت نوبت‌های فروشنده لاگین شده
router.get('/seller-bookings/me', auth('seller'), ctrl.getSellerBookings);

// تغییر وضعیت نوبت
router.patch('/seller-bookings/:id/status', auth('seller'), ctrl.updateBookingStatus);

// حذف نوبت فروشنده
router.delete('/seller-bookings/:id', auth('seller'), ctrl.deleteBooking);

// بررسی وضعیت نوبت بر اساس شماره تلفن مشتری
router.get('/bookings/status', ctrl.checkBookingStatus);

// دریافت زمان‌های رزرو شده برای نمایش به کاربر
router.get('/booked-slots/:sellerId', ctrl.getBookedSlots);

module.exports = router;
