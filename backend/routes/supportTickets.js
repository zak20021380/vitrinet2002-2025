const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const controller = require('../controllers/supportTicketController');

// فروشنده: ثبت تیکت
router.post('/', authMiddleware('seller'), controller.createTicket);

// ادمین: مشاهده لیست تیکت‌ها
router.get('/', authMiddleware('admin'), controller.listTickets);

// ادمین: بروزرسانی وضعیت
router.patch('/:id/status', authMiddleware('admin'), controller.updateStatus);

module.exports = router;
