// routes/sellerPlans.js
const express = require('express');
const router = express.Router();
const SellerPlan = require('../models/sellerPlan'); // مدل پلن خریداری‌شده فروشنده
const AdOrder = require('../models/AdOrder');       // مدل سفارش تبلیغ
const auth = require('../middlewares/authMiddleware');

// GET /api/sellerPlans/my
router.get('/my', auth('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;

    // هردو نوع پلن رو از دیتابیس بیار
    const [plans, ads] = await Promise.all([
      SellerPlan.find({ sellerId }).sort({ startDate: -1 }).lean(),
      AdOrder.find({ sellerId }).sort({ createdAt: -1 }).lean()
    ]);

    // تبدیل پلن‌های اشتراک فروشگاه به خروجی استاندارد
    const plansMapped = plans.map(plan => ({
      title: plan.planTitle,
      price: plan.price,
      startDate: plan.startDate,
      endDate: plan.endDate,
      active: plan.status === 'active',
      description: plan.description || '',
      type: 'subscription',
      slug: plan.planSlug || plan.slug || '' // اضافه برای شناسایی نوع پلن
    }));

    // تبدیل تبلیغات خریداری شده به خروجی استاندارد
    const adsMapped = ads.map(ad => ({
      title: ad.planTitle || ad.adTitle || 'تبلیغ ویژه',
      price: ad.price,
      startDate: ad.createdAt,
      endDate: ad.endDate || null,
      active: ad.status === 'paid',
      description: ad.adText || '',
      type: 'ad',
      slug: ad.planSlug || ad.slug || '',     // *** این خط اضافه شد ***
      bannerImage: ad.bannerImage || ad.image || '', // اگه داری برای عکس
      productId: ad.productId || '',          // اگر تبلیغ محصوله
      status: ad.status || ''                 // وضعیت تبلیغ
    }));

    // ادغام و مرتب‌سازی بر اساس جدیدترین
    const allPlans = [...plansMapped, ...adsMapped].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    res.json({ plans: allPlans });
  } catch (err) {
    res.status(500).json({ message: 'خطا در دریافت پلن‌ها' });
  }
});

module.exports = router;
