// backend/routes/productComments.js
// روت‌های مدیریت نظرات محصولات

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const productCommentController = require('../controllers/productCommentController');

// ═══════════════════════════════════════════════════════════════
// روت‌های عمومی
// ═══════════════════════════════════════════════════════════════

// دریافت نظرات منتشر شده یک محصول (عمومی)
// GET /api/public/comments/:productId
router.get(
  '/public/comments/:productId',
  productCommentController.getPublishedComments
);

// ═══════════════════════════════════════════════════════════════
// روت‌های کاربر
// ═══════════════════════════════════════════════════════════════

// ثبت نظر جدید (کاربر لاگین شده)
// POST /api/comments
router.post(
  '/comments',
  authMiddleware('user'),
  productCommentController.submitComment
);

// ═══════════════════════════════════════════════════════════════
// روت‌های فروشنده
// ═══════════════════════════════════════════════════════════════

// دریافت نظرات در انتظار تأیید
// GET /api/seller/pending-comments
router.get(
  '/seller/pending-comments',
  authMiddleware('seller'),
  productCommentController.getPendingComments
);

// دریافت تعداد نظرات در انتظار
// GET /api/seller/pending-comments/count
router.get(
  '/seller/pending-comments/count',
  authMiddleware('seller'),
  productCommentController.getPendingCount
);

// دریافت همه نظرات فروشنده (با فیلتر)
// GET /api/seller/comments
router.get(
  '/seller/comments',
  authMiddleware('seller'),
  productCommentController.getSellerComments
);

// تغییر وضعیت نظر (تأیید یا رد)
// PATCH /api/comments/:id/status
router.patch(
  '/comments/:id/status',
  authMiddleware('seller'),
  productCommentController.updateCommentStatus
);

module.exports = router;
