const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// درخواست پرداخت (برای اشتراک یا تبلیغ ویژه)
router.post('/request', paymentController.createPaymentRequest);

// کال‌بک از سمت درگاه پرداخت (مثلاً زرین‌پال)
router.get('/callback', paymentController.handlePaymentCallback);

// [اختیاری] نمایش لیست پرداخت‌ها برای ادمین/فروشنده
// router.get('/list', paymentController.listPayments);

module.exports = router;
