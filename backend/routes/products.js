// backend/routes/products.js

const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const Seller = require('../models/Seller');
const Product = require('../models/product');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// پیکربندی آپلود تصاویر محصول
const uploadDir = path.join(__dirname, '..', 'uploads', 'products');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeName = (file.originalname || 'file').replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${safeName || 'product'}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ storage });

// اگر middleware احراز هویت داری، این خط را فعال کن:
// const authMiddleware = require('../middlewares/authMiddleware');

// -----------------------------
// افزودن محصول جدید
// -----------------------------
router.post('/', upload.array('images', 10), /* authMiddleware */ productController.addProduct);

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
// ساخت/ویرایش تخفیف محصول
// -----------------------------
router.put('/:id/discount', /* authMiddleware */ productController.upsertDiscount);

// -----------------------------
// حذف تخفیف محصول
// -----------------------------
router.delete('/:id/discount', /* authMiddleware */ productController.removeDiscount);

// -----------------------------
// تغییر وضعیت موجودی محصول
// PATCH /api/products/:id/stock
// -----------------------------
router.patch('/:id/stock', /* authMiddleware */ productController.updateStock);

// -----------------------------
// دریافت محصول تکی با آیدی
// GET /api/products/:id
// -----------------------------
router.get('/:id/like-status', productController.getLikeStatus);
router.post('/:id/like', productController.toggleLike);

// دریافت نظرات منتشر شده محصول (برای سازگاری با فرانت قدیمی)
router.get('/:id/reviews', async (req, res) => {
  try {
    const ProductComment = require('../models/ProductComment');
    const productId = req.params.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'شناسه محصول نامعتبر است.' });
    }

    const [comments, totalCount, ratingStats] = await Promise.all([
      ProductComment.find({ productId, status: 'published' })
        .populate('userId', 'firstname lastname')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductComment.countDocuments({ productId, status: 'published' }),
      ProductComment.getProductRating(productId)
    ]);

    const formattedComments = comments.map(c => ({
      id: c._id,
      content: c.content,
      rating: c.rating,
      createdAt: c.createdAt,
      userName: c.userId ? [c.userId.firstname, c.userId.lastname].filter(Boolean).join(' ') || 'کاربر' : 'کاربر',
      user: { name: c.userId ? [c.userId.firstname, c.userId.lastname].filter(Boolean).join(' ') || 'کاربر' : 'کاربر' }
    }));

    res.json({
      success: true,
      reviews: formattedComments,
      avgRating: ratingStats.avgRating,
      averageRating: ratingStats.avgRating,
      totalCount: ratingStats.totalCount,
      total: ratingStats.totalCount,
      hasMore: skip + comments.length < totalCount
    });
  } catch (err) {
    console.error('خطا در دریافت نظرات محصول:', err);
    res.status(500).json({ success: false, message: 'خطا در دریافت نظرات.' });
  }
});

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
