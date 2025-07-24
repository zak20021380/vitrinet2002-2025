// routes/dailyVisitRoutes.js
const express = require('express');
const router  = express.Router();

const ctrl  = require('../controllers/dailyVisitController');
const auth  = require('../middlewares/authMiddleware');

/*─────────────────────────────────────────────
  GET   /api/daily-visits          → فقط «ادمین»
  POST  /api/daily-visits          → فقط «فروشنده» (ثبت یا آپدیت آمار روزانهٔ خودش)
  GET   /api/daily-visits/sellers  → فقط «ادمین» (برای جدول رتبه‌بندی)
  DEL   /api/daily-visits/:id      → فقط «ادمین»  (حذف رکورد دلخواه)
─────────────────────────────────────────────*/

// مشاهدهٔ آمار (ادمین)
router.get('/', auth('admin'), ctrl.getVisits);

// لیست فروشنده‌ها برای رتبه‌بندی (ادمین)
// ⚠️ حتماً قبل از '/:id' تعریف شود
router.get('/sellers', auth('admin'), ctrl.getSellers);

// ثبت یا ویرایش آمار روزانه (فروشنده)
router.post('/', auth('seller'), ctrl.createOrUpdateVisit);

// حذف رکورد دلخواه (ادمین)
router.delete('/:id', auth('admin'), ctrl.deleteVisit);

module.exports = router;
