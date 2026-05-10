const express = require('express');
const router = express.Router();
const shoppingCenterController = require('../controllers/shoppingCenterController');
const authMiddleware = require('../middlewares/authMiddleware');
const { createImageUpload } = require('../utils/uploadHelper');

// مسیر ذخیره عکس‌ها
const upload = createImageUpload({
  subdirectory: 'shopping-centers',
  filenamePrefix: 'shopping-center'
});

// middlewares (مثلاً احراز هویت ادمین) رو خودت اضافه کن
// const { adminAuth } = require('../middlewares/auth');

// لیست مراکز خرید
router.get('/', shoppingCenterController.getAll);

// دریافت یک مرکز خرید خاص
router.get('/:id', shoppingCenterController.getById);

// افزودن مرکز خرید جدید
router.post('/', authMiddleware('admin'), upload.single('image'), shoppingCenterController.create);

// ویرایش مرکز خرید
router.put('/:id', authMiddleware('admin'), upload.single('image'), shoppingCenterController.update);

// حذف مرکز خرید
router.delete('/:id', authMiddleware('admin'), shoppingCenterController.remove);

module.exports = router;
