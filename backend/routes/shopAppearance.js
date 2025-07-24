// routes/shopAppearance.js

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');    // اضافه شد
const shopAppearanceController = require('../controllers/shopAppearanceController');

// =========== GET ظاهر پیش‌فرض برای تست (بدون پارامتر) یا مغازه‌ها بر اساس centerTitle ===========
router.get('/', (req, res) => {
  if (req.query.centerTitle) {
    return shopAppearanceController.getShopsByCenterTitle(req, res);
  }
  res.json({
    theme: "modern",
    color: "#7C83FD",
    logo: "/uploads/logo.png"
  });
});

// گرفتن ظاهر فروشگاه بر اساس customUrl (shopurl) [این روت مهمه!]
router.get('/url/:shopurl', shopAppearanceController.getAppearanceByUrl);

// GET ظاهر فروشگاه برای یک فروشنده (بر اساس sellerId)
router.get('/:sellerId', shopAppearanceController.getShopAppearance);

// POST ذخیره/ویرایش ظاهر فروشگاه (sellerId از پارامتر!)
router.post(
  '/:sellerId/save',
  auth('seller'),    // فقط فروشنده خودش اجازه ویرایش دارد
  shopAppearanceController.saveShopAppearance
);

// POST ثبت امتیاز فروشگاه – فقط کاربران لاگین‌شده
router.post(
  '/:sellerId/rate',
  auth(),           // تضمین می‌کند که کاربر لاگین باشد
  shopAppearanceController.rateShop
);

module.exports = router;
