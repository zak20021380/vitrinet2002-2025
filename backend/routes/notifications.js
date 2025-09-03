const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notificationController');
const auth = require('../middlewares/authMiddleware');

// لیست اعلان‌ها
router.get('/', auth(), ctrl.list);
// خوانده شدن اعلان
router.put('/:id/read', auth(), ctrl.markAsRead);
// حذف اعلان
router.delete('/:id', auth(), ctrl.remove);

module.exports = router;
