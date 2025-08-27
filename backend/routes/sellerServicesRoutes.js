const express = require('express');
const router = express.Router();

const auth = require('../middlewares/authMiddleware');           // احراز هویت
const ctrl = require('../controllers/sellerServicesController'); // کنترلر سرویس‌ها

/** ---------- Public (بدون احراز هویت) ---------- */
// سرویس‌های فعال یک فروشگاه خدماتی با shopurl (برای صفحه عمومی)
router.get('/public/:shopurl', ctrl.getActiveServicesByShopUrl);

/** ---------- Private Seller (نیازمند role: seller) ---------- */
// لیست سرویس‌های من (با سرچ/فیلتر/صفحه‌بندی)
router.get('/me', auth('seller'), ctrl.getMyServices);

// ساخت سرویس جدید
router.post('/', auth('seller'), ctrl.createService);

// دریافت یک سرویس (فقط مالک)
router.get('/:id', auth('seller'), ctrl.getServiceById);

// ویرایش سرویس (فقط مالک)
router.put('/:id', auth('seller'), ctrl.updateService);

// تغییر سریع وضعیت فعال/غیرفعال
router.patch('/:id/toggle', auth('seller'), ctrl.toggleActive);

// حذف سرویس
router.delete('/:id', auth('seller'), ctrl.deleteService);

module.exports = router;
