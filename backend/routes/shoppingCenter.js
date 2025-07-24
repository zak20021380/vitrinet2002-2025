const express = require('express');
const router = express.Router();
const shoppingCenterController = require('../controllers/shoppingCenterController');
const multer = require('multer');

// مسیر ذخیره عکس‌ها
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/shopping-centers');
  },
  filename: function (req, file, cb) {
    const ext = file.originalname.split('.').pop();
    cb(null, Date.now() + '-' + Math.floor(Math.random() * 1000) + '.' + ext);
  }
});
const upload = multer({ storage });

// middlewares (مثلاً احراز هویت ادمین) رو خودت اضافه کن
// const { adminAuth } = require('../middlewares/auth');

// لیست مراکز خرید
router.get('/', shoppingCenterController.getAll);

// دریافت یک مرکز خرید خاص
router.get('/:id', shoppingCenterController.getById);

// افزودن مرکز خرید جدید
router.post('/', /*adminAuth,*/ upload.single('image'), shoppingCenterController.create);

// ویرایش مرکز خرید
router.put('/:id', /*adminAuth,*/ upload.single('image'), shoppingCenterController.update);

// حذف مرکز خرید
router.delete('/:id', /*adminAuth,*/ shoppingCenterController.remove);

module.exports = router;
