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
// {
//   "plans": {
//     "1month": { "price": 59000, "durationDays": 30, "description": "...", "features": ["..."] }
//   }
// }
// { "sellerPhone": "09121234567", "plans": { "1month": { "price": 69000 } } } ← قیمت ویژهٔ یک فروشنده
router.put('/admin', auth('admin'), planCtl.updatePlans);

module.exports = router;