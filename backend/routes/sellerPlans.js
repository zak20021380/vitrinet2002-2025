// routes/sellerPlans.js
const express = require('express');
const router = express.Router();
const SellerPlan = require('../models/sellerPlan'); // مدل پلن خریداری‌شده فروشنده
const AdOrder = require('../models/AdOrder');       // مدل سفارش تبلیغ
const auth = require('../middlewares/authMiddleware');

// GET /api/sellerPlans/subscription-status
// Returns the seller's current subscription status with server-calculated remaining days
router.get('/subscription-status', auth('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const serverNow = new Date();

    // Find the most recent active subscription plan
    const activePlan = await SellerPlan.findOne({
      sellerId,
      status: 'active',
      endDate: { $gte: serverNow }
    }).sort({ endDate: -1 }).lean();

    // If no active plan, check for most recent expired plan
    const latestPlan = activePlan || await SellerPlan.findOne({
      sellerId
    }).sort({ endDate: -1 }).lean();

    if (!latestPlan) {
      return res.json({
        hasSubscription: false,
        planName: null,
        isActive: false,
        startDate: null,
        endDate: null,
        remainingDays: 0,
        serverNow: serverNow.toISOString()
      });
    }

    const endDate = new Date(latestPlan.endDate);
    const startDate = new Date(latestPlan.startDate);
    const isActive = latestPlan.status === 'active' && endDate >= serverNow;
    
    // Calculate remaining days using server time
    const msPerDay = 24 * 60 * 60 * 1000;
    let remainingDays = 0;
    if (isActive) {
      remainingDays = Math.ceil((endDate - serverNow) / msPerDay);
      // If ends today but still active, show 0 but mark as "ends today"
      if (remainingDays < 0) remainingDays = 0;
    }

    // Calculate total duration and progress
    const totalDays = Math.ceil((endDate - startDate) / msPerDay);
    const elapsedDays = Math.ceil((serverNow - startDate) / msPerDay);
    const progress = totalDays > 0 ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 0;

    // Map plan slug to friendly name
    const planNameMap = {
      '1month': 'اشتراک ۱ ماهه',
      '3month': 'اشتراک ۳ ماهه',
      '12month': 'اشتراک ۱ ساله'
    };
    const planName = latestPlan.planTitle || planNameMap[latestPlan.planSlug] || 'اشتراک فروشگاه';

    res.json({
      hasSubscription: true,
      planName,
      planSlug: latestPlan.planSlug,
      isActive,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      remainingDays,
      totalDays,
      progress: Math.round(progress),
      endsToday: isActive && remainingDays === 0,
      serverNow: serverNow.toISOString()
    });
  } catch (err) {
    console.error('subscription-status error:', err);
    res.status(500).json({ message: 'خطا در دریافت وضعیت اشتراک' });
  }
});

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
      productId: ad.productId ? String(ad.productId) : '',          // اگر تبلیغ محصوله
      sellerId: ad.sellerId ? String(ad.sellerId) : '',             // برای لینک به فروشگاه
      status: ad.status || ''                 // وضعیت تبلیغ
    }));

    // ادغام و مرتب‌سازی بر اساس جدیدترین
    const allPlans = [...plansMapped, ...adsMapped].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    res.json({ plans: allPlans });
  } catch (err) {
    res.status(500).json({ message: 'خطا در دریافت پلن‌ها' });
  }
});

// GET /api/sellerPlans/summary
// Returns a compact summary for the "پلن‌های من" dashboard block
// Includes subscription info and active ads count with server-calculated remaining days
router.get('/summary', auth('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const serverNow = new Date();

    // Find the most recent active subscription plan
    const activePlan = await SellerPlan.findOne({
      sellerId,
      status: 'active',
      endDate: { $gte: serverNow }
    }).sort({ endDate: -1 }).lean();

    // Count active ads (status = 'approved' or 'paid' and not expired)
    const activeAdsCount = await AdOrder.countDocuments({
      sellerId,
      status: { $in: ['approved', 'paid'] },
      $or: [
        { expiresAt: { $gte: serverNow } },
        { expiresAt: { $exists: false } }
      ]
    });

    // Build subscription response
    let subscription = null;
    if (activePlan) {
      const endDate = new Date(activePlan.endDate);
      const msPerDay = 24 * 60 * 60 * 1000;
      let remainingDays = Math.ceil((endDate - serverNow) / msPerDay);
      if (remainingDays < 0) remainingDays = 0;

      // Map plan slug to friendly name
      const planNameMap = {
        '1month': 'اشتراک ۱ ماهه',
        '3month': 'اشتراک ۳ ماهه',
        '12month': 'اشتراک ۱ ساله'
      };
      const planName = activePlan.planTitle || planNameMap[activePlan.planSlug] || 'اشتراک فروشگاه';

      subscription = {
        isActive: true,
        planName,
        remainingDays,
        endDate: endDate.toISOString()
      };
    }

    res.json({
      subscription,
      activeAdsCount,
      serverNow: serverNow.toISOString()
    });
  } catch (err) {
    console.error('plans/summary error:', err);
    res.status(500).json({ message: 'خطا در دریافت اطلاعات' });
  }
});

module.exports = router;
