// backend/routes/products.js

const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const Seller = require('../models/Seller');
const Product = require('../models/product');

// اگر middleware احراز هویت داری، این خط را فعال کن:
// const authMiddleware = require('../middlewares/authMiddleware');

// -----------------------------
// افزودن محصول جدید
// -----------------------------
router.post('/', /* authMiddleware */ productController.addProduct);

// -----------------------------
// دریافت همه محصولات (مثلاً با ?sellerId=...)
// -----------------------------
router.get('/', productController.getProducts);



// اضافه کردن مسیر جدید برای دریافت جدیدترین محصولات
router.get('/latest-products', productController.getLatestProducts);


// -----------------------------
// گرفتن محصولات از طریق shopurl فروشگاه
// GET /api/products/shop/:shopurl
// -----------------------------
router.get('/shop/:shopurl', async (req, res) => {
  try {
    const { shopurl } = req.params;

    // پیدا کردن فروشنده با استفاده از shopurl
    const seller = await Seller.findOne({ shopurl });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'فروشگاه پیدا نشد.' });
    }

    // دریافت محصولات مربوط به sellerId این فروشنده
    const products = await Product.find({ sellerId: seller._id }).sort({ createdAt: -1 });

    res.json(products);
  } catch (err) {
    console.error('خطا در دریافت محصولات فروشگاه:', err);
    res.status(500).json({ success: false, message: 'خطای سرور در دریافت محصولات فروشگاه.' });
  }
});

// -----------------------------
// دریافت محصول تکی با آیدی
// GET /api/products/:id
// -----------------------------
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate({
        path: 'sellerId',
        select: 'storename firstname lastname ownerName ownerFirstname ownerLastname shopurl phone category subcategory address city desc boardImage'
      })
      .lean();

    if (!product) {
      return res.status(404).json({ message: 'محصول پیدا نشد!' });
    }

    // برای سازگاری با فرانت قدیمی، نسخه‌ی ترکیبی seller را نیز برمی‌گردانیم
    const responsePayload = {
      ...product,
      seller: product.sellerId
    };

    res.json(responsePayload);
  } catch (err) {
    console.error('خطا در دریافت محصول:', err);
    res.status(500).json({ message: 'خطای سرور در دریافت محصول.' });
  }
});

// -----------------------------
// ویرایش محصول
// -----------------------------
router.put('/:id', /* authMiddleware */ productController.editProduct);

// -----------------------------
// حذف محصول
// -----------------------------
router.delete('/:id', /* authMiddleware */ productController.deleteProduct);

module.exports = router;
