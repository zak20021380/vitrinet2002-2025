const express = require('express');
const router = express.Router();
const adOrderController = require('../controllers/adOrderController');
const authMiddleware = require('../middlewares/authMiddleware');
const formidable = require('express-formidable');

// ── ثبت سفارش تبلیغ (POST) ──
router.post(
  '/',
  authMiddleware('seller'),
  formidable({ multiples: false }),
  adOrderController.createAdOrder
);

// ── دریافت همه سفارش‌های تبلیغ (ادمین) ──
router.get(
  '/',
  authMiddleware('admin'),
  adOrderController.getAllAdOrders
);

// ── گرفتن لیست سفارش‌های تبلیغ یک فروشنده (GET) ──
router.get(
  '/seller',
  authMiddleware('seller'),
  adOrderController.getSellerAdOrders
);

// ── گرفتن لیست سفارش‌های تبلیغ با اطلاعات زمان‌بندی (GET) ──
router.get(
  '/seller/scheduled',
  authMiddleware('seller'),
  adOrderController.getSellerAdOrdersWithScheduling
);

// ── دریافت وضعیت ظرفیت اسلات‌ها (برای UI) ──
router.get(
  '/slots/availability',
  adOrderController.getSlotAvailability
);

// ── بروزرسانی وضعیت سفارش تبلیغ توسط ادمین ──
router.patch(
  '/:id/status',
  authMiddleware('admin'),
  adOrderController.updateAdOrderStatus
);

// ── گرفتن تبلیغات فعال (حتماً قبل از :id) ──
router.get('/active', adOrderController.getActiveAds);

// ── گرفتن جزئیات یک سفارش تبلیغ با آیدی (GET) ──
router.get(
  '/:id',
  authMiddleware('seller'),
  adOrderController.getAdOrderById
);

// ── حذف کامل سفارش تبلیغ ──
router.delete(
  '/:id',
  authMiddleware('admin'),
  adOrderController.deleteAdOrder
);

// ── ویرایش جزئیات سفارش تبلیغ ──
router.put(
  '/:id',
  authMiddleware('admin'),
  adOrderController.updateAdOrder
);

module.exports = router;
