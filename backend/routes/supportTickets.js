const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const controller = require('../controllers/supportTicketController');

// فروشنده: مشاهده تیکت‌های خود (باید قبل از route های با پارامتر باشد)
router.get('/my-tickets', authMiddleware('seller'), controller.getMyTickets);

// فروشنده: ثبت تیکت
router.post('/', authMiddleware('seller'), controller.createTicket);

// ادمین: ثبت تیکت اختصاصی برای فروشنده
router.post('/admin', authMiddleware('admin'), controller.adminCreateTicket);

// ادمین: مشاهده لیست تیکت‌ها
router.get('/', authMiddleware('admin'), controller.listTickets);

// فروشنده: پاسخ به تیکت خود
router.post('/:id/seller-reply', authMiddleware('seller'), controller.sellerReplyToTicket);

// ادمین: بروزرسانی وضعیت
router.patch('/:id/status', authMiddleware('admin'), controller.updateStatus);

// ادمین: پاسخ به تیکت + ارسال اعلان
router.post('/:id/admin-reply', authMiddleware('admin'), controller.replyToTicket);

// ادمین: حذف تیکت
router.delete('/:id', authMiddleware('admin'), controller.deleteTicket);

module.exports = router;
