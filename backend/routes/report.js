// routes/report.js
// -----------------------------------------------------------------------------
//  End‑points «گزارش تخلف»
//
//  • POST   /api/reports         →  createReport               (همهٔ کاربران لاگین‌شده)
//  • GET    /api/reports         →  getReportsWithSellerInfo   (فقط ادمین)
//  • PATCH  /api/reports/:id     →  updateReport               (فقط ادمین)
//  • DELETE /api/reports/:id     →  deleteReport               (فقط ادمین)
//
//  نکته‌ٔ امنیتی: چون توکنی در LocalStorage ذخیره نمی‌کنیم،
//  تنها روش احراز هویتِ مجاز ← کوکی Http‑Only یا هدر «Authorization» است.
//
// -----------------------------------------------------------------------------

const express      = require('express');
const router       = express.Router();
const rateLimit    = require('express-rate-limit');

const reportCtrl   = require('../controllers/reportController');
const auth         = require('../middlewares/authMiddleware');

/*─────────────────────────────────────────────────────────────────────────────┐
│  1)  محدودیتِ ضد Spam برای ارسال گزارش                                       │
└──────────────────────────────────────────────────────────────────────────────*/
const reportLimiter = rateLimit({
  windowMs       : 60 * 1000,    // هر ۶۰ ثانیه
  max            : 3,            // حداکثر ۳ گزارش
  message        : { message: 'لطفاً کمی صبر کنید و دوباره امتحان کنید.' },
  standardHeaders: true,
  legacyHeaders  : false
});

/*─────────────────────────────────────────────────────────────────────────────┐
│  2)  ثبت گزارش – همهٔ کاربران لاگین‌شده                                    │
└──────────────────────────────────────────────────────────────────────────────*/
router.post(
  '/',
  auth(),              // فقط «توکن معتبر» کافی است
  reportLimiter,       // ضد Flood / Spam
  reportCtrl.createReport
);

/*─────────────────────────────────────────────────────────────────────────────┐
│  3)  دریافت فهرست گزارش‌ها – فقط ادمین                                       │
│     (populate می‌کند: firstname, lastname, phone, address)                 │
└──────────────────────────────────────────────────────────────────────────────*/
router.get(
  '/',
  auth('admin'),                       // باید role === 'admin' باشد
  reportCtrl.getReportsWithSellerInfo
);

/*─────────────────────────────────────────────────────────────────────────────┐
│  4)  به‌روزرسانی یک گزارش – فقط ادمین                                        │
└──────────────────────────────────────────────────────────────────────────────*/
router.patch(
  '/:id',
  auth('admin'),
  reportCtrl.updateReport
);

/*─────────────────────────────────────────────────────────────────────────────┐
│  5)  حذف کامل یک گزارش – فقط ادمین                                           │
└──────────────────────────────────────────────────────────────────────────────*/
router.delete(
  '/:id',
  auth('admin'),
  reportCtrl.deleteReport
);

module.exports = router;
