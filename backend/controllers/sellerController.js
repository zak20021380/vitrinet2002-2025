const mongoose = require('mongoose');
const Seller = require('../models/Seller');
const bcrypt = require('bcryptjs');
const Product = require('../models/product');
const ShopAppearance = require('../models/ShopAppearance');
const ServiceShop = require('../models/serviceShop');
const SellerPlan = require('../models/sellerPlan');
const AdOrder = require('../models/AdOrder');
const Payment = require('../models/payment');
const Chat = require('../models/chat');
const Report = require('../models/Report');
const BannedPhone = require('../models/BannedPhone');
const Plan = require('../models/plan');
const Booking = require('../models/booking');
const Review = require('../models/Review');
const { calcPremiumUntil } = require('../utils/premium');
const { clampAdminScore, evaluatePerformance } = require('../utils/performanceStatus');

const escapeRegExp = (str = '') => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeString = (value) => (value || '').toString().trim().toLowerCase();

function buildPerformancePayload(seller, options = {}) {
  const { includeNote = false } = options;
  const performance = evaluatePerformance(seller?.adminScore ?? null);
  const displayName = (
    seller?.storename ||
    [seller?.firstname, seller?.lastname].filter(Boolean).join(' ').trim() ||
    seller?.shopurl ||
    ''
  );

  const payload = {
    sellerId: seller?._id ? seller._id.toString() : null,
    shopurl: seller?.shopurl || null,
    storename: seller?.storename || null,
    displayName,
    adminScore: seller?.adminScore ?? null,
    updatedAt: seller?.adminScoreUpdatedAt || null,
    status: performance.status,
    statusLabel: performance.label,
    statusMessage: performance.message,
    severity: performance.severity,
    canStay: performance.canStay,
    adminScoreMessage: seller?.adminScoreMessage || ''
  };

  if (includeNote) {
    payload.adminScoreNote = seller?.adminScoreNote || '';
  }

  return payload;
}

async function findSellerByFlexibleId(identifier) {
  if (!identifier) return null;

  if (typeof identifier === 'string' && identifier.startsWith('shopurl:')) {
    const shopurl = identifier.replace(/^shopurl:/, '');
    return Seller.findOne({ shopurl });
  }

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const byId = await Seller.findById(identifier);
    if (byId) return byId;
  }

  return Seller.findOne({ shopurl: identifier });
}

exports.registerSeller = async (req, res) => {
  try {
    const { firstname, lastname, storename, shopurl, phone, category, address, desc, password } = req.body;

    // بررسی تکراری نبودن
    const exists = await Seller.findOne({ $or: [{ phone }, { shopurl }] });
    if (exists) return res.status(400).json({ message: 'این شماره یا آدرس فروشگاه قبلاً ثبت شده است.' });

    // رمزنگاری رمز عبور
    const hashedPassword = await bcrypt.hash(password, 10);

    const seller = new Seller({
      firstname,
      lastname,
      storename,
      shopurl,
      phone,
      category,
      address,
      desc,
      password: hashedPassword,
    });

    await seller.save();
    res.status(201).json({ message: 'ثبت‌نام فروشنده با موفقیت انجام شد.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطا در ثبت‌نام فروشنده' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const sellerId = req.user && (req.user.id || req.user._id);
    if (!sellerId) {
      return res.status(401).json({ message: 'احراز هویت نامعتبر است.' });
    }

    const sellerObjectId = new mongoose.Types.ObjectId(sellerId);
    const now = new Date();

    const toISODate = (date) => {
      const tzOffset = date.getTimezoneOffset();
      const local = new Date(date.getTime() - tzOffset * 60000);
      return local.toISOString().slice(0, 10);
    };

    const todayStr = toISODate(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toISODate(yesterday);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const prevNinetyStart = new Date(ninetyDaysAgo);
    prevNinetyStart.setDate(prevNinetyStart.getDate() - 90);

    const activeStatuses = ['pending', 'confirmed', 'completed'];

    const [
      todayBookings,
      yesterdayBookings,
      pendingBookings,
      activeCustomersAgg,
      previousActiveCustomersAgg,
      newCustomersAgg,
      ratingAgg
    ] = await Promise.all([
      Booking.countDocuments({
        sellerId: sellerObjectId,
        bookingDate: todayStr,
        status: { $in: activeStatuses }
      }),
      Booking.countDocuments({
        sellerId: sellerObjectId,
        bookingDate: yesterdayStr,
        status: { $in: activeStatuses }
      }),
      Booking.countDocuments({ sellerId: sellerObjectId, status: 'pending' }),
      Booking.aggregate([
        {
          $match: {
            sellerId: sellerObjectId,
            status: { $in: activeStatuses },
            createdAt: { $gte: ninetyDaysAgo }
          }
        },
        { $group: { _id: '$customerPhone' } },
        { $count: 'count' }
      ]),
      Booking.aggregate([
        {
          $match: {
            sellerId: sellerObjectId,
            status: { $in: activeStatuses },
            createdAt: { $gte: prevNinetyStart, $lt: ninetyDaysAgo }
          }
        },
        { $group: { _id: '$customerPhone' } },
        { $count: 'count' }
      ]),
      Booking.aggregate([
        {
          $match: {
            sellerId: sellerObjectId,
            status: { $in: activeStatuses }
          }
        },
        {
          $group: {
            _id: '$customerPhone',
            firstBooking: { $min: '$createdAt' }
          }
        },
        { $match: { firstBooking: { $gte: thirtyDaysAgo } } },
        { $count: 'count' }
      ]),
      Review.aggregate([
        { $match: { sellerId: sellerObjectId, approved: true } },
        {
          $group: {
            _id: null,
            average: { $avg: '$score' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const activeCustomers = Array.isArray(activeCustomersAgg) && activeCustomersAgg.length
      ? activeCustomersAgg[0].count
      : 0;
    const previousActiveCustomers = Array.isArray(previousActiveCustomersAgg) && previousActiveCustomersAgg.length
      ? previousActiveCustomersAgg[0].count
      : 0;
    const newCustomers30d = Array.isArray(newCustomersAgg) && newCustomersAgg.length
      ? newCustomersAgg[0].count
      : 0;
    const ratingStats = Array.isArray(ratingAgg) && ratingAgg.length ? ratingAgg[0] : null;

    const avgRating = ratingStats?.average || 0;
    const ratingCount = ratingStats?.count || 0;
    const ratingAverage = ratingCount ? Math.round(avgRating * 10) / 10 : 0;

    return res.json({
      todayBookings,
      yesterdayBookings,
      pendingBookings,
      activeCustomers,
      previousActiveCustomers,
      newCustomers30d,
      ratingAverage,
      ratingCount
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    return res.status(500).json({ message: 'خطا در دریافت آمار داشبورد.' });
  }
};

// حذف کامل فروشنده و تمام داده‌های مرتبط
exports.deleteSeller = async (req, res) => {
  try {
    const { sellerId } = req.params;

    let seller;
    if (typeof sellerId === 'string' && sellerId.startsWith('shopurl:')) {
      const shopurl = sellerId.replace(/^shopurl:/, '');
      seller = await Seller.findOne({ shopurl });
    } else {
      seller = await Seller.findById(sellerId);
    }

    if (!seller) {
      return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    }

    const phone = seller.phone;

    await Promise.all([
      Product.deleteMany({ sellerId: seller._id }),
      ShopAppearance.deleteMany({ sellerId: seller._id }),
      SellerPlan.deleteMany({ sellerId: seller._id }),
      AdOrder.deleteMany({ sellerId: seller._id }),
      Payment.deleteMany({ sellerId: seller._id }),
      Chat.deleteMany({ sellerId: seller._id }),
      Report.deleteMany({ sellerId: seller._id }),
      Seller.deleteOne({ _id: seller._id })
    ]);

    if (phone) {
      await BannedPhone.updateOne(
        { phone },
        { $set: { phone } },
        { upsert: true }
      );
    }

    res.json({ message: 'فروشنده با موفقیت حذف شد.' });
  } catch (err) {
    console.error('deleteSeller error:', err);
    res.status(500).json({ message: 'خطا در حذف فروشنده.', error: err.message });
  }
};

// ارتقای فروشنده به پلن انتخابی (معمولی یا پرمیوم)
exports.upgradeSeller = async (req, res) => {
  try {
    const sellerId = req.user && (req.user.id || req.user._id);
    const { planSlug, premium } = req.body || {};

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'احراز هویت نامعتبر است.' });
    }

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'فروشنده پیدا نشد.' });
    }

    if (premium) {
      const plan = await Plan.findOne({ slug: planSlug });
      if (!plan) {
        return res.status(404).json({ success: false, message: 'پلن موردنظر یافت نشد.' });
      }
      const now = new Date();
      const premiumUntil = calcPremiumUntil(plan.slug, now);
      seller.isPremium = true;
      seller.premiumUntil = premiumUntil;
      await SellerPlan.create({
        sellerId: seller._id,
        planSlug: plan.slug,
        planTitle: plan.title,
        price: plan.price,
        startDate: now,
        endDate: premiumUntil,
        status: 'active'
      });
    } else {
      seller.isPremium = false;
      seller.premiumUntil = null;
    }

    await seller.save();

    return res.json({ success: true, seller: { id: seller._id, isPremium: seller.isPremium, premiumUntil: seller.premiumUntil } });
  } catch (err) {
    console.error('upgradeSeller error:', err);
    res.status(500).json({ success: false, message: 'خطا در ارتقا حساب.' });
  }
};

exports.updateAdminScore = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const score = clampAdminScore(req.body?.score);
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (score === null) {
      return res.status(400).json({ message: 'نمره معتبر نیست. مقدار باید بین ۰ تا ۱۰۰ باشد.' });
    }

    const seller = await findSellerByFlexibleId(sellerId);
    if (!seller) {
      return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    }

    seller.adminScore = score;
    seller.adminScoreUpdatedAt = new Date();
    seller.adminScoreNote = note;
    seller.adminScoreMessage = message;
    const performance = evaluatePerformance(score);
    seller.performanceStatus = performance.status;

    await seller.save();

    const payload = buildPerformancePayload(seller, { includeNote: true });
    return res.json({
      message: 'نمره فروشنده با موفقیت ذخیره شد.',
      ...payload,
      sellerKey: payload.sellerId || (payload.shopurl ? `shopurl:${payload.shopurl}` : null)
    });
  } catch (err) {
    console.error('updateAdminScore error:', err);
    return res.status(500).json({ message: 'خطا در ثبت نمره فروشنده.' });
  }
};

exports.clearAdminScore = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const seller = await findSellerByFlexibleId(sellerId);

    if (!seller) {
      return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    }

    seller.adminScore = null;
    seller.adminScoreUpdatedAt = null;
    seller.adminScoreNote = '';
    seller.adminScoreMessage = '';
    seller.performanceStatus = 'unset';

    await seller.save();

    const payload = buildPerformancePayload(seller, { includeNote: true });
    return res.json({
      message: 'نمره فروشنده حذف شد.',
      ...payload,
      sellerKey: payload.sellerId || (payload.shopurl ? `shopurl:${payload.shopurl}` : null)
    });
  } catch (err) {
    console.error('clearAdminScore error:', err);
    return res.status(500).json({ message: 'خطا در حذف نمره فروشنده.' });
  }
};

exports.listSellerPerformance = async (req, res) => {
  try {
    const sellers = await Seller.find({}, 'storename shopurl adminScore adminScoreUpdatedAt performanceStatus adminScoreNote adminScoreMessage');

    const payload = sellers.map(seller => {
      const data = buildPerformancePayload(seller, { includeNote: true });
      return {
        ...data,
        sellerKey: data.sellerId || (data.shopurl ? `shopurl:${data.shopurl}` : null)
      };
    });

    return res.json(payload);
  } catch (err) {
    console.error('listSellerPerformance error:', err);
    return res.status(500).json({ message: 'خطا در دریافت وضعیت عملکرد فروشنده‌ها.' });
  }
};

exports.getCurrentSellerPerformanceStatus = async (req, res) => {
  try {
    const sellerId = req.user && (req.user.id || req.user._id);
    if (!sellerId) {
      return res.status(401).json({ message: 'برای مشاهده وضعیت عملکرد ابتدا وارد شوید.' });
    }

    const seller = await Seller.findById(sellerId)
      .select('storename firstname lastname shopurl adminScore adminScoreUpdatedAt performanceStatus adminScoreMessage');

    if (!seller) {
      return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    }

    const payload = buildPerformancePayload(seller);
    return res.json({
      ...payload,
      message: payload.adminScore == null
        ? 'هنوز نمره‌ای برای شما ثبت نشده است.'
        : 'آخرین وضعیت عملکرد شما با موفقیت بارگذاری شد.',
      sellerKey: payload.sellerId || (payload.shopurl ? `shopurl:${payload.shopurl}` : null)
    });
  } catch (err) {
    console.error('getCurrentSellerPerformanceStatus error:', err);
    return res.status(500).json({ message: 'خطا در دریافت وضعیت عملکرد.' });
  }
};

exports.getTopServicePeers = async (req, res) => {
  try {
    const sellerId = req.user && (req.user.id || req.user._id);
    if (!sellerId) {
      return res.status(401).json({ message: 'احراز هویت نامعتبر است.' });
    }

    const seller = await Seller.findById(sellerId)
      .select('storename shopurl category subcategory phone firstname lastname')
      .lean();

    if (!seller) {
      return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    }

    const rawLimit = String(req.query.limit ?? '').trim().toLowerCase();
    let limit = Number.parseInt(rawLimit, 10);
    if (!Number.isFinite(limit)) {
      limit = 10;
    }
    limit = Math.min(20, Math.max(3, limit));

    const scope = String(req.query.scope || '').trim().toLowerCase();

    const category = (seller.category || '').trim();
    const subcategory = (seller.subcategory || '').trim();

    const match = {
      status: 'approved',
      isVisible: true
    };

    let scopeApplied = 'category';
    if ((scope === 'subcategory' || !scope) && subcategory) {
      scopeApplied = 'subcategory';
      match.$or = [
        { subcategories: { $in: [subcategory] } },
        { tags: { $regex: new RegExp(escapeRegExp(subcategory), 'i') } }
      ];
    } else if (category) {
      match.category = category;
    }

    const projection = 'name shopUrl city category subcategories tags analytics isPremium isFeatured coverImage ownerPhone ownerName updatedAt createdAt';

    let query = ServiceShop.find(match)
      .sort({
        'analytics.ratingAverage': -1,
        'analytics.ratingCount': -1,
        'analytics.totalBookings': -1,
        createdAt: -1
      })
      .select(projection);

    if (scopeApplied !== 'subcategory') {
      query = query.limit(200);
    }

    const shops = await query.lean();

    const sellerSlug = normalizeString(seller.shopurl);
    const sellerPhone = normalizeString(seller.phone);

    const computeMetrics = (shop = {}) => {
      const analytics = shop.analytics || {};
      const ratingAverage = Number(analytics.ratingAverage) || 0;
      const ratingCount = Number(analytics.ratingCount) || 0;
      const totalBookings = Number(analytics.totalBookings) || 0;
      const completedBookings = Number(analytics.completedBookings) || 0;
      const uniqueCustomers = Number(analytics.uniqueCustomers) || Math.max(completedBookings, Math.round(totalBookings * 0.6)) || 0;

      const score = ratingAverage + totalBookings + uniqueCustomers;

      return {
        ratingAverage,
        ratingCount,
        totalBookings,
        completedBookings,
        uniqueCustomers,
        score
      };
    };

    const leaderboard = shops.map(shop => {
      const metrics = computeMetrics(shop);
      const slug = normalizeString(shop.shopUrl);
      const phone = normalizeString(shop.ownerPhone);
      const isMine = (slug && sellerSlug && slug === sellerSlug) || (phone && sellerPhone && phone === sellerPhone);

      return {
        id: shop._id ? shop._id.toString() : null,
        name: shop.name || shop.ownerName || shop.shopUrl || 'فروشگاه بدون نام',
        shopUrl: shop.shopUrl || null,
        city: shop.city || '',
        category: shop.category || category || '',
        badges: {
          isPremium: !!shop.isPremium,
          isFeatured: !!shop.isFeatured
        },
        metrics,
        score: Number(metrics.score.toFixed(2)),
        updatedAt: shop.updatedAt || shop.createdAt || null,
        isMine
      };
    });

    if (!leaderboard.some(entry => entry.isMine)) {
      leaderboard.push({
        id: sellerId.toString(),
        name: seller.storename || seller.shopurl || `${seller.firstname || ''} ${seller.lastname || ''}`.trim() || 'فروشگاه شما',
        shopUrl: seller.shopurl || null,
        city: '',
        category: category || '',
        badges: { isPremium: false, isFeatured: false },
        metrics: {
          ratingAverage: 0,
          ratingCount: 0,
          totalBookings: 0,
          completedBookings: 0,
          uniqueCustomers: 0
        },
        score: 0,
        updatedAt: null,
        isMine: true
      });
    }

    leaderboard.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.metrics.ratingAverage !== a.metrics.ratingAverage) {
        return b.metrics.ratingAverage - a.metrics.ratingAverage;
      }
      if (b.metrics.ratingCount !== a.metrics.ratingCount) {
        return b.metrics.ratingCount - a.metrics.ratingCount;
      }
      if (b.metrics.totalBookings !== a.metrics.totalBookings) {
        return b.metrics.totalBookings - a.metrics.totalBookings;
      }
      return (a.name || '').localeCompare(b.name || '', 'fa');
    });

    const total = leaderboard.length;
    const mine = leaderboard.find(entry => entry.isMine) || null;

    const ranked = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));

    const mineIndex = mine && mine.id ? ranked.findIndex(entry => entry.id === mine.id) : -1;
    const mineWithRank = mine
      ? { ...mine, rank: mineIndex >= 0 ? mineIndex + 1 : ranked.length }
      : null;

    const shouldReturnAll = scopeApplied === 'subcategory' && (!rawLimit || rawLimit === 'all');
    const effectiveLimit = shouldReturnAll ? ranked.length : limit;

    const top = ranked.slice(0, effectiveLimit).map(entry => ({
      rank: entry.rank,
      name: entry.name,
      shopUrl: entry.shopUrl,
      city: entry.city,
      score: entry.score,
      badges: entry.badges,
      metrics: entry.metrics,
      updatedAt: entry.updatedAt,
      isMine: entry.isMine
    }));

    const response = {
      top,
      mine: mineWithRank,
      total,
      category: scopeApplied === 'subcategory' && subcategory ? subcategory : (category || 'خدمات'),
      scope: scopeApplied,
      updatedAt: new Date().toISOString()
    };

    return res.json(response);
  } catch (err) {
    console.error('getTopServicePeers error:', err);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};
