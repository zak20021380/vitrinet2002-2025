const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middlewares/authMiddleware');

// درخواست پرداخت (برای اشتراک یا تبلیغ ویژه)
// ⚠️ فقط فروشندهٔ احراز هویت‌شده می‌تواند درخواست پرداخت بدهد
router.post('/request', auth('seller'), paymentController.createPaymentRequest);

// کال‌بک از سمت درگاه پرداخت (مثلاً زرین‌پال)
router.get('/callback', paymentController.handlePaymentCallback);

// [اختیاری] نمایش لیست پرداخت‌ها برای ادمین/فروشنده
// router.get('/list', paymentController.listPayments);

module.exports = router;
