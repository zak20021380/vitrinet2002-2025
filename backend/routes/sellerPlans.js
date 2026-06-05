// routes/sellerPlans.js
const express = require('express');
const router = express.Router();
const SellerPlan = require('../models/sellerPlan'); // مدل پلن خریداری‌شده فروشنده
const AdOrder = require('../models/AdOrder');       // مدل سفارش تبلیغ
const SimilarShopPromotion = require('../models/SimilarShopPromotion');
const auth = require('../middlewares/authMiddleware');

function objectIdString(value) {
  if (!value) return '';
  return String(value._id || value.id || value);
}

function mapAdOrder(ad) {
  const id = objectIdString(ad._id);
  const product = ad.productId && typeof ad.productId === 'object' ? ad.productId : null;
  const productId = objectIdString(product || ad.productId);
  const status = ad.status || 'pending';
  const submittedAt = ad.createdAt || null;
  const rejectionReason = status === 'rejected' ? (ad.adminNote || '') : '';
  const active = ['approved', 'paid'].includes(status)
    && (!ad.expiresAt || new Date(ad.expiresAt) > new Date());

  return {
    _id: id,
    id,
    source: 'ad_order',
    type: 'ad',
    adType: ad.planSlug || 'special_ad',
    title: ad.planTitle || ad.adTitle || 'تبلیغ ویژه',
    planTitle: ad.planTitle || '',
    adTitle: ad.adTitle || '',
    price: ad.price,
    submittedAt,
    createdAt: submittedAt,
    startDate: submittedAt,
    endDate: ad.expiresAt || ad.scheduledEndDate || null,
    active,
    description: ad.adText || '',
    slug: ad.planSlug || ad.slug || '',
    planSlug: ad.planSlug || ad.slug || '',
    bannerImage: ad.bannerImage || ad.image || '',
    productId,
    relatedProductTitle: product?.title || '',
    relatedStoreTitle: ad.shopTitle || '',
    sellerId: objectIdString(ad.sellerId),
    status,
    originalStatus: status,
    paymentStatus: ad.paymentStatus || '',
    reviewedAt: ad.reviewedAt || null,
    approvedAt: ad.approvedAt || null,
    rejectedAt: status === 'rejected' ? (ad.reviewedAt || null) : null,
    statusDate: status === 'rejected'
      ? (ad.reviewedAt || null)
      : (ad.approvedAt || ad.reviewedAt || ad.expiredAt || null),
    rejectionReason,
    scheduledStartDate: ad.scheduledStartDate || null,
    scheduledEndDate: ad.scheduledEndDate || null,
    displayedAt: ad.displayedAt || null,
    displayDurationHours: ad.displayDurationHours || null,
    expiresAt: ad.expiresAt || null,
    expiredAt: ad.expiredAt || null,
    detailsUrl: `/seller/dashboard.html#upgrade-special-ads?focus=my_plans&ad_id=${id}`
  };
}

function mapSimilarShopPromotion(promotion) {
  const id = objectIdString(promotion._id);
  const originalStatus = promotion.status || 'pending';
  const status = originalStatus === 'removed' ? 'cancelled' : originalStatus;
  const submittedAt = promotion.createdAt || null;
  const productId = objectIdString(promotion.productId);
  const rejectionReason = originalStatus === 'rejected' ? (promotion.adminNote || '') : '';
  const now = new Date();
  const active = originalStatus === 'approved'
    && promotion.startAt && new Date(promotion.startAt) <= now
    && promotion.endAt && new Date(promotion.endAt) > now;

  return {
    _id: id,
    id,
    source: 'similar_shop_promotion',
    type: 'ad',
    adType: 'similar_stores',
    title: promotion.planTitle || 'تبلیغ در فروشگاه‌های مشابه',
    planTitle: promotion.planTitle || '',
    price: promotion.price,
    submittedAt,
    createdAt: submittedAt,
    startDate: submittedAt,
    endDate: promotion.endAt || null,
    active,
    description: '',
    slug: 'similar_stores',
    planSlug: 'similar_stores',
    productId,
    relatedProductTitle: promotion.productSnapshot?.title || '',
    relatedStoreTitle: promotion.shopSnapshot?.name || '',
    sellerId: objectIdString(promotion.sellerId),
    serviceShopId: objectIdString(promotion.serviceShopId),
    status,
    originalStatus,
    paymentStatus: promotion.paymentStatus || '',
    reviewedAt: promotion.reviewedAt || null,
    approvedAt: promotion.approvedAt || null,
    rejectedAt: promotion.rejectedAt || null,
    statusDate: promotion.rejectedAt
      || promotion.approvedAt
      || promotion.removedAt
      || promotion.expiredAt
      || promotion.reviewedAt
      || null,
    rejectionReason,
    startAt: promotion.startAt || null,
    endAt: promotion.endAt || null,
    expiresAt: promotion.endAt || null,
    expiredAt: promotion.expiredAt || null,
    detailsUrl: `/seller/dashboard.html#upgrade-special-ads?focus=similar_promotions&promotion_id=${id}`
  };
}

// GET /api/sellerPlans/subscription-status
// Returns the seller's current subscription status with server-calculated remaining days
router.get('/subscription-status', auth('seller'), async (req, res) => {
  try {
    const sellerId = req.user.sellerId;
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
    const sellerId = req.user.sellerId;
    res.set('Cache-Control', 'no-store');

    // همه اشتراک‌ها و تمام تاریخچه درخواست‌های تبلیغاتی فروشنده را برگردان.
    const [plans, ads, similarPromotions] = await Promise.all([
      SellerPlan.find({ sellerId }).sort({ startDate: -1 }).lean(),
      AdOrder.find({ sellerId })
        .populate({ path: 'productId', select: 'title price slug' })
        .sort({ createdAt: -1 })
        .lean(),
      SimilarShopPromotion.find({ sellerId }).sort({ createdAt: -1 }).lean()
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
      slug: plan.planSlug || plan.slug || '',
      status: plan.status || 'pending'
    }));

    const adsMapped = ads.map(mapAdOrder);
    const similarPromotionsMapped = similarPromotions.map(mapSimilarShopPromotion);

    // ادغام و مرتب‌سازی بر اساس جدیدترین
    const allPlans = [...plansMapped, ...adsMapped, ...similarPromotionsMapped]
      .sort((a, b) => new Date(b.submittedAt || b.startDate || 0) - new Date(a.submittedAt || a.startDate || 0));

    res.json({ plans: allPlans });
  } catch (err) {
    console.error('sellerPlans/my error:', err);
    res.status(500).json({ message: 'خطا در دریافت پلن‌ها' });
  }
});

// GET /api/sellerPlans/summary
// Returns a compact summary for the "پلن‌های من" dashboard block
// Includes subscription info and active ads count with server-calculated remaining days
router.get('/summary', auth('seller'), async (req, res) => {
  try {
    const sellerId = req.user.sellerId;
    const serverNow = new Date();

    // Find the most recent active subscription plan
    const activePlan = await SellerPlan.findOne({
      sellerId,
      status: 'active',
      endDate: { $gte: serverNow }
    }).sort({ endDate: -1 }).lean();

    const [activeAdOrdersCount, activeSimilarPromotionsCount] = await Promise.all([
      AdOrder.countDocuments({
        sellerId,
        status: { $in: ['approved', 'paid'] },
        $or: [
          { expiresAt: { $gte: serverNow } },
          { expiresAt: { $exists: false } }
        ]
      }),
      SimilarShopPromotion.countDocuments({
        sellerId,
        status: 'approved',
        startAt: { $lte: serverNow },
        endAt: { $gt: serverNow }
      })
    ]);
    const activeAdsCount = activeAdOrdersCount + activeSimilarPromotionsCount;

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
