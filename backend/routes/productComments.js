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

// حذف نظر
// DELETE /api/comments/:id
router.delete(
  '/comments/:id',
  authMiddleware('seller'),
  productCommentController.deleteComment
);

// ═══════════════════════════════════════════════════════════════
// روت‌های مدیریت کاربران مسدود شده
// ═══════════════════════════════════════════════════════════════

// مسدود کردن کاربر
// POST /api/seller/block-commenter
router.post(
  '/seller/block-commenter',
  authMiddleware('seller'),
  productCommentController.blockCommenter
);

// رفع مسدودیت کاربر
// DELETE /api/seller/block-commenter/:userId
router.delete(
  '/seller/block-commenter/:userId',
  authMiddleware('seller'),
  productCommentController.unblockCommenter
);

// دریافت لیست کاربران مسدود شده
// GET /api/seller/blocked-commenters
router.get(
  '/seller/blocked-commenters',
  authMiddleware('seller'),
  productCommentController.getBlockedCommenters
);

module.exports = router;
