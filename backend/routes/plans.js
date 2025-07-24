// ------------------------------------------------------------
// این فایل فقط مسیرها را به کنترلر متصل می‌کند. منطق کامل
// GET و PUT داخل controllers/planController.js قرار دارد.
// ------------------------------------------------------------
const express  = require('express');
const router   = express.Router();

const planCtl  = require('../controllers/planController');   // کنترلر اصلی پلن‌ها
const auth     = require('../middlewares/authMiddleware');   // احراز هویت (ادمین)

// -------- GET /api/plans -----------------------------------
// ?sellerPhone=09... ← اگر شماره بدهید ابتدا قیمت اختصاصی، در غیر این صورت قیمت عمومی
router.get('/', planCtl.getPlans);

// -------- PUT /api/plans/admin -----------------------------
// بدنهٔ نمونه:
// { "1month": 59000, "3month": 179000 }         ← قیمت عمومی
// { "sellerPhone": "09121234567", "1month": 69000 } ← قیمت ویژهٔ یک فروشنده
router.put('/admin', auth('admin'), planCtl.updatePlans);

module.exports = router;