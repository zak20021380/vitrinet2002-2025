const express = require('express');
const router = express.Router();
const { getCurrentSeller } = require('../controllers/authController');

const { registerSeller } = require('../controllers/sellerController');
const { deleteSeller } = require('../controllers/sellerController');
const Seller = require('../models/Seller');
const authMiddleware = require('../middlewares/authMiddleware');
const mongoose = require('mongoose');   
const Chat = require('../models/chat');
// ثبت‌نام فروشنده
router.post('/register', registerSeller);

// آپلود یا تغییر لوگوی فروشگاه (تابلو)
router.post('/:sellerId/logo', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { logo } = req.body;
    if (!logo) return res.status(400).json({ message: "لوگو ارسال نشده!" });

    const seller = await Seller.findByIdAndUpdate(
      sellerId,
      { boardImage: logo },
      { new: true }
    );
    if (!seller) return res.status(404).json({ message: "فروشنده پیدا نشد!" });

    res.json({ message: "تابلو ثبت شد!", boardImage: seller.boardImage });
  } catch (err) {
    console.error("خطا در ثبت لوگو:", err);
    res.status(500).json({ message: "خطای سرور!" });
  }
});

// گرفتن لیست همهٔ فروشنده‌ها (فقط ادمین)
router.get('/', authMiddleware('admin'), async (req, res) => {
  try {
    const sellers = await Seller.find({}, {
      _id: 1,
      firstname: 1,
      lastname: 1,
      storename: 1,
      shopurl: 1,
      phone: 1,
      createdAt: 1,
      productsCount: 1,
      visits: 1,
      blockedByAdmin: 1
    }).lean();

    const sellersWithId = sellers.map(seller => ({
      ...seller,
      sellerId: seller._id.toString()
    }));

    res.json(sellersWithId);
  } catch (err) {
    console.error('❌ خطا در دریافت لیست فروشنده‌ها:', err);
    res.status(500).json({ message: 'خطا در دریافت فروشنده‌ها.' });
  }
});


router.get('/profile', authMiddleware('seller'), getCurrentSeller);

// حذف فروشنده - فقط ادمین
router.delete('/:sellerId', authMiddleware('admin'), deleteSeller);



// ‹‹— ‹ Route جدید برای گرفتن یک فروشندهٔ خاص —››
// گرفتن یک فروشندهٔ خاص به همراه پسورد (فقط برای ادمین یا خود فروشنده)
// ================================================
// GET  /api/sellers/:sellerId
// دسترسی: ادمین ‑ یا همان فروشنده
// ================================================
// ‹‹— Route جدید برای گرفتن یک فروشندهٔ خاص به همراه پسورد —››
// دسترسی: فقط ادمین
router.get(
  '/:sellerId',
  authMiddleware('admin'),    // ← اینجا تغییر کرد: فقط نقش 'admin' پذیرفته می‌شود
  async (req, res) => {
    try {
      let { sellerId } = req.params;              // shopurl:... یا شناسه
      let query;

      // 1) اگر shopurl:slug بود
      if (sellerId.startsWith('shopurl:')) {
        query = { shopurl: sellerId.replace(/^shopurl:/, '') };
      }
      // 2) اگر یک ObjectId معتبر بود
      else if (mongoose.Types.ObjectId.isValid(sellerId)) {
        query = { _id: sellerId };
      }
      // 3) در غیر این صورت همان اسلاگ فروشگاه
      else {
        query = { shopurl: sellerId };
      }

      // ─── واکشی فروشنده + پسورد ───
      const seller = await Seller.findOne(query).select(
        '+password firstname lastname storename shopurl phone ' +
        'createdAt productsCount visits'
      ).lean();

      if (!seller)
        return res.status(404).json({ message: 'فروشنده پیدا نشد!' });

      // برای ادمین دیگه نیازی به کنترل isOwner نیست
      seller.sellerId = seller._id.toString();     // برای فرانت
      res.json(seller);

    } catch (err) {
      console.error('❌ خطا در دریافت فروشنده:', err);
      res.status(500).json({ message: 'خطای سرور.' });
    }
  }
);






// ——— ارسال پیام از فروشنده به مدیر سایت ———
router.post(
  '/contact-admin',
  authMiddleware('seller'),
  async (req, res) => {
    try {
      const sellerId = req.user && (req.user.id || req.user._id);
      const { message } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'متن پیام لازم است.' });
      }
      // اینجا می‌توانید پیام را در دیتابیس ذخیره کنید یا به ادمین ایمیل بزنید
      console.log(`پیام از فروشنده ${sellerId}: ${message}`);
      
      // پاسخ موفق
      return res.json({ message: 'پیام شما با موفقیت ارسال شد.' });
    } catch (err) {
      console.error('❌ خطا در ارسال پیام به مدیر:', err);
      return res.status(500).json({ error: 'خطای سرور، لطفاً مجدداً تلاش کنید.' });
    }
  }
);




module.exports = router;
