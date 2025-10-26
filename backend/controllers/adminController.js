// controllers/adminController.js

const Admin      = require('../models/admin');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const User       = require('../models/user');
const Seller     = require('../models/Seller');
const Product    = require('../models/product');
const DailyVisit = require('../models/DailyVisit');
const ServiceShop = require('../models/serviceShop');
const Payment = require('../models/payment');

// کلید سری JWT از .env خوانده می‌شود وگرنه مقدار پیش‌فرض
const JWT_SECRET = "vitrinet_secret_key";
/**
 * ثبت‌نام ادمین جدید
 */
exports.register = async (req, res) => {
  try {
    const { phone, password, name } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: 'شماره موبایل و رمز عبور الزامی است.' });
    }

    const exists = await Admin.findOne({ phone });
    if (exists) {
      return res.status(400).json({ message: 'این شماره قبلاً ثبت شده.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = new Admin({ phone, password: hashedPassword, name });
    await admin.save();

    res.status(201).json({ message: 'ادمین با موفقیت ثبت شد.' });
  } catch (err) {
    console.error('❌ register admin error:', err);
    res.status(500).json({ message: 'خطا در ثبت ادمین.', error: err.message });
  }
};

/**
 * لاگین ادمین
 */

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: 'شماره موبایل و رمز عبور الزامی است.' });
    }

    const admin = await Admin.findOne({ phone });
    if (!admin) {
      return res.status(401).json({ message: 'ادمینی با این شماره یافت نشد.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'رمز عبور اشتباه است.' });
    }

    // ساخت توکن JWT با payload شامل id و نقش
    const token = jwt.sign(
      { id: admin._id, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '3d' }
    );

    // ست کردن کوکی HttpOnly (اختیاری اگر فقط با LocalStorage کار می‌کنید)
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3 * 24 * 60 * 60 * 1000
    });

    // برگرداندن توکن و اطلاعات ادمین
    return res.json({
      token,
      admin: {
        id:    admin._id,
        phone: admin.phone,
        name:  admin.name
      }
    });

  } catch (err) {
    console.error('❌ login admin error:', err);
    res.status(500).json({ message: 'ورود ناموفق.', error: err.message });
  }
};
/**
 * پروفایل ادمین (با middleware احراز هویت باید req.user.id ست شده باشد)
 */
exports.profile = async (req, res) => {
  try {
    // در authMiddleware ما req.user.id را ست می‌کنیم
    const adminId = req.user && req.user.id;
    if (!adminId) {
      return res.status(401).json({ message: 'عدم احراز هویت.' });
    }

    const admin = await Admin.findById(adminId).select('-password');
    if (!admin) {
      return res.status(404).json({ message: 'ادمین یافت نشد.' });
    }

    res.json({ 
      id:    admin._id,
      phone: admin.phone,
      name:  admin.name,
      createdAt: admin.createdAt
    });
  } catch (err) {
    console.error('❌ get admin profile error:', err);
    res.status(500).json({ message: 'خطا در دریافت پروفایل.', error: err.message });
  }
};

/**
 * آمار تجمیعی داشبورد ادمین
 * GET /api/admin/dashboard/stats
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const daysParam = parseInt(req.query.days, 10);
    const rangeDays = Number.isFinite(daysParam) ? daysParam : 30;
    const days = Math.min(Math.max(rangeDays, 7), 180);

    let timeZone = req.query.tz || 'Asia/Tehran';

    const now = new Date();
    let tzFormatter;
    try {
      tzFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (err) {
      timeZone = 'UTC';
      tzFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    }

    const tzNow = new Date(now.toLocaleString('en-US', { timeZone }));
    const offsetMs = tzNow.getTime() - now.getTime();

    const startOfTodayLocal = new Date(now.getTime() + offsetMs);
    startOfTodayLocal.setHours(0, 0, 0, 0);
    const startOfToday = new Date(startOfTodayLocal.getTime() - offsetMs);

    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

    const rangeStart = new Date(startOfToday);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - (days - 1));

    const formatDateKey = (date) => tzFormatter.format(date);

    const todayKey = formatDateKey(startOfToday);
    const rangeStartKey = formatDateKey(rangeStart);

    const dailyVisitRangeStart = new Date(`${rangeStartKey}T00:00:00.000Z`);
    const dailyVisitRangeEnd = new Date(`${todayKey}T23:59:59.999Z`);

    const baseUserFilter = { $or: [{ deleted: { $exists: false } }, { deleted: false }] };

    const [
      totalUsers,
      totalSellers,
      totalProducts,
      totalServiceShops,
      activeServiceShops,
      pendingServiceShops,
      premiumServiceShops,
      visitsAggregation,
      usersAggregation,
      sellersAggregation,
      productsAggregation,
      serviceShopsAggregation,
      newUsersToday,
      newSellersToday,
      newProductsToday,
      newServiceShopsToday
    ] = await Promise.all([
      User.countDocuments(baseUserFilter),
      Seller.countDocuments(),
      Product.countDocuments(),
      ServiceShop.countDocuments(),
      ServiceShop.countDocuments({ status: 'approved', isVisible: true }),
      ServiceShop.countDocuments({ status: 'pending' }),
      ServiceShop.countDocuments({ isPremium: true, premiumUntil: { $gt: now } }),
      DailyVisit.aggregate([
        { $match: { date: { $gte: dailyVisitRangeStart, $lte: dailyVisitRangeEnd } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' }
            },
            count: { $sum: '$count' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      User.aggregate([
        {
          $match: {
            ...baseUserFilter,
            createdAt: { $gte: rangeStart, $lt: startOfTomorrow }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: timeZone }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Seller.aggregate([
        {
          $match: {
            createdAt: { $gte: rangeStart, $lt: startOfTomorrow }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: timeZone }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Product.aggregate([
        {
          $match: {
            createdAt: { $gte: rangeStart, $lt: startOfTomorrow }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: timeZone }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      ServiceShop.aggregate([
        {
          $match: {
            createdAt: { $gte: rangeStart, $lt: startOfTomorrow }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: timeZone }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      User.countDocuments({ ...baseUserFilter, createdAt: { $gte: startOfToday, $lt: startOfTomorrow } }),
      Seller.countDocuments({ createdAt: { $gte: startOfToday, $lt: startOfTomorrow } }),
      Product.countDocuments({ createdAt: { $gte: startOfToday, $lt: startOfTomorrow } }),
      ServiceShop.countDocuments({ createdAt: { $gte: startOfToday, $lt: startOfTomorrow } })
    ]);

    const visitsMap = new Map(visitsAggregation.map((item) => [item._id, item.count]));
    const usersMap = new Map(usersAggregation.map((item) => [item._id, item.count]));
    const sellersMap = new Map(sellersAggregation.map((item) => [item._id, item.count]));
    const productsMap = new Map(productsAggregation.map((item) => [item._id, item.count]));
    const serviceShopsMap = new Map(serviceShopsAggregation.map((item) => [item._id, item.count]));

    const trends = [];
    const cursor = new Date(rangeStart);

    while (cursor < startOfTomorrow) {
      const key = formatDateKey(cursor);
      trends.push({
        date: key,
        visits: visitsMap.get(key) || 0,
        newUsers: usersMap.get(key) || 0,
        newSellers: sellersMap.get(key) || 0,
        newProducts: productsMap.get(key) || 0,
        newServiceShops: serviceShopsMap.get(key) || 0
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const visitsToday = visitsMap.get(todayKey) || 0;

    res.json({
      summary: {
        visitsToday,
        newUsersToday,
        newSellersToday,
        newProductsToday,
        newServiceShopsToday,
        totalUsers,
        totalSellers,
        totalProducts,
        totalServiceShops,
        activeServiceShops,
        pendingServiceShops,
        premiumServiceShops
      },
      trends,
      range: {
        start: trends[0]?.date || rangeStartKey,
        end: trends[trends.length - 1]?.date || todayKey,
        days: trends.length,
        timeZone
      },
      generatedAt: now.toISOString()
    });
  } catch (err) {
    console.error('❌ dashboard stats error:', err);
    res.status(500).json({ message: 'خطا در دریافت آمار داشبورد.', error: err.message });
  }
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const SUBSCRIPTION_TITLES = {
  '1month': 'پلن ۱ ماهه',
  '3month': 'پلن ۳ ماهه',
  '12month': 'پلن ۱۲ ماهه'
};

const parseDateParam = (value, { endOfDay = false } = {}) => {
  if (!value) return null;
  let date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    date = new Date(Date.UTC(year, month - 1, day));
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date?.getTime())) return null;
  if (endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  } else {
    date.setUTCHours(0, 0, 0, 0);
  }
  return date;
};

const humanizeSlug = (slug, map = {}) => {
  if (!slug) return 'سایر';
  if (map[slug]) return map[slug];
  const cleaned = String(slug).replace(/[\-_]+/g, ' ').trim();
  return cleaned.length ? cleaned : 'سایر';
};

const buildChangeMetric = (currentValue = 0, previousValue = 0) => {
  const current = Number.isFinite(currentValue) ? currentValue : 0;
  const previous = Number.isFinite(previousValue) ? previousValue : 0;
  const delta = current - previous;
  let change = 0;
  if (previous > 0) {
    change = delta / previous;
  } else if (current > 0) {
    change = 1;
  }
  return { value: current, change, delta };
};

const aggregateIncome = async (start, end) => {
  const match = { paymentStatus: 'completed' };
  if (start || end) {
    match.createdAt = {};
    if (start) match.createdAt.$gte = start;
    if (end) match.createdAt.$lte = end;
  }

  const [facet] = await Payment.aggregate([
    { $match: match },
    {
      $facet: {
        byType: [
          {
            $group: {
              _id: '$type',
              totalAmount: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ],
        plans: [
          { $match: { type: 'sub', planSlug: { $ne: null } } },
          {
            $group: {
              _id: '$planSlug',
              totalAmount: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          },
          { $sort: { totalAmount: -1 } }
        ],
        byDay: [
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
              },
              plans: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'sub'] }, '$amount', 0]
                }
              },
              ads: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'ad'] }, '$amount', 0]
                }
              },
              total: { $sum: '$amount' }
            }
          },
          { $sort: { _id: 1 } }
        ],
        sellers: [
          { $match: { sellerId: { $ne: null } } },
          {
            $group: {
              _id: '$sellerId',
              plans: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'sub'] }, '$amount', 0]
                }
              },
              ads: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'ad'] }, '$amount', 0]
                }
              },
              plan1: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$type', 'sub'] },
                        { $eq: ['$planSlug', '1month'] }
                      ]
                    },
                    '$amount',
                    0
                  ]
                }
              },
              plan3: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$type', 'sub'] },
                        { $eq: ['$planSlug', '3month'] }
                      ]
                    },
                    '$amount',
                    0
                  ]
                }
              },
              plan12: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$type', 'sub'] },
                        { $eq: ['$planSlug', '12month'] }
                      ]
                    },
                    '$amount',
                    0
                  ]
                }
              },
              payments: { $sum: 1 }
            }
          },
          {
            $addFields: {
              total: { $add: ['$plans', '$ads'] }
            }
          },
          { $sort: { total: -1 } },
          { $limit: 10 }
        ],
        stats: [
          {
            $group: {
              _id: null,
              totalAmount: { $sum: '$amount' },
              paymentCount: { $sum: 1 },
              plansAmount: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'sub'] }, '$amount', 0]
                }
              },
              adsAmount: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'ad'] }, '$amount', 0]
                }
              },
              plansCount: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'sub'] }, 1, 0]
                }
              },
              adsCount: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'ad'] }, 1, 0]
                }
              },
              sellers: { $addToSet: '$sellerId' }
            }
          },
          {
            $addFields: {
              sellerCount: {
                $size: {
                  $filter: {
                    input: '$sellers',
                    as: 'sellerId',
                    cond: { $ne: ['$$sellerId', null] }
                  }
                }
              }
            }
          },
          {
            $project: {
              sellers: 0
            }
          }
        ]
      }
    }
  ]);

  const safeFacet = facet || {};
  const statsDoc = (safeFacet.stats && safeFacet.stats[0]) || {};

  const stats = {
    totalAmount: statsDoc.totalAmount || 0,
    paymentCount: statsDoc.paymentCount || 0,
    plansAmount: statsDoc.plansAmount || 0,
    adsAmount: statsDoc.adsAmount || 0,
    plansCount: statsDoc.plansCount || 0,
    adsCount: statsDoc.adsCount || 0,
    sellerCount: statsDoc.sellerCount || 0
  };

  const planTotals = new Map();
  (safeFacet.plans || []).forEach((item) => {
    if (!item) return;
    planTotals.set(String(item._id || 'unknown'), item.totalAmount || 0);
  });

  const daily = (safeFacet.byDay || []).map((item) => ({
    date: item?._id,
    plans: item?.plans || 0,
    ads: item?.ads || 0,
    total: item?.total || ((item?.plans || 0) + (item?.ads || 0))
  }));

  const sellerEntries = (safeFacet.sellers || []).map((item) => ({
    sellerId: item?._id || null,
    plans: item?.plans || 0,
    ads: item?.ads || 0,
    plan1: item?.plan1 || 0,
    plan3: item?.plan3 || 0,
    plan12: item?.plan12 || 0,
    total: item?.total || ((item?.plans || 0) + (item?.ads || 0))
  }));

  return { stats, planTotals, daily, sellers: sellerEntries };
};

exports.getIncomeInsights = async (req, res) => {
  try {
    const now = new Date();
    let endDate = parseDateParam(req.query.end || req.query.endDate, { endOfDay: true }) || new Date(now);
    endDate.setUTCHours(23, 59, 59, 999);

    let startDate = parseDateParam(req.query.start || req.query.startDate, { endOfDay: false });
    if (!startDate) {
      startDate = new Date(endDate);
      startDate.setUTCDate(startDate.getUTCDate() - 29);
    }
    startDate.setUTCHours(0, 0, 0, 0);

    if (startDate > endDate) {
      const temp = startDate;
      startDate = endDate;
      endDate = temp;
    }

    const rangeDays = Math.max(1, Math.round((endDate - startDate) / MS_PER_DAY) + 1);

    const prevEnd = new Date(startDate);
    prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
    prevEnd.setUTCHours(23, 59, 59, 999);
    const prevStart = new Date(prevEnd);
    prevStart.setUTCDate(prevStart.getUTCDate() - (rangeDays - 1));
    prevStart.setUTCHours(0, 0, 0, 0);

    const [currentAggregation, previousAggregation] = await Promise.all([
      aggregateIncome(startDate, endDate),
      aggregateIncome(prevStart, prevEnd)
    ]);

    const sellerIds = currentAggregation.sellers
      .map((item) => item.sellerId)
      .filter(Boolean);

    let sellersMap = new Map();
    if (sellerIds.length) {
      // فیلتر کردن فروشنده‌های خدماتی - آنها فقط باید در بخش مغازه‌های خدماتی نمایش داده شوند
      const sellers = await Seller.find({
        _id: { $in: sellerIds },
        category: { $ne: 'خدمات' }  // حذف فروشنده‌های با دسته "خدمات"
      })
        .select('storename firstname lastname phone')
        .lean();
      sellersMap = new Map(
        sellers.map((seller) => [String(seller._id), seller])
      );
    }

    const resolveSellerName = (seller) => {
      if (!seller) return '—';
      if (seller.storename) return seller.storename;
      const name = [seller.firstname, seller.lastname]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (name) return name;
      if (seller.phone) return seller.phone;
      return '—';
    };

    const sellers = currentAggregation.sellers.map((entry) => {
      const sellerDoc = sellersMap.get(String(entry.sellerId));
      return {
        name: resolveSellerName(sellerDoc),
        plans: entry.plans,
        ads: entry.ads,
        total: entry.total,
        plan1: entry.plan1,
        plan3: entry.plan3,
        plan12: entry.plan12
      };
    });

    const planBreakdown = [];
    const trackedSlugs = ['1month', '3month', '12month'];
    trackedSlugs.forEach((slug) => {
      const value = currentAggregation.planTotals.get(slug) || 0;
      const previousValue = previousAggregation.planTotals.get(slug) || 0;
      planBreakdown.push({
        key: slug,
        name: humanizeSlug(slug, SUBSCRIPTION_TITLES),
        value,
        change: previousValue > 0 ? (value - previousValue) / previousValue : (value > 0 ? 1 : 0)
      });
    });

    const otherPlansCurrent = Array.from(currentAggregation.planTotals.entries())
      .filter(([slug]) => !trackedSlugs.includes(slug));
    if (otherPlansCurrent.length) {
      const otherValue = otherPlansCurrent.reduce((sum, [, amount]) => sum + amount, 0);
      const otherPrevious = Array.from(previousAggregation.planTotals.entries())
        .filter(([slug]) => !trackedSlugs.includes(slug))
        .reduce((sum, [, amount]) => sum + amount, 0);
      planBreakdown.push({
        key: 'other-plans',
        name: 'سایر اشتراک‌ها',
        value: otherValue,
        change: otherPrevious > 0 ? (otherValue - otherPrevious) / otherPrevious : (otherValue > 0 ? 1 : 0)
      });
    }

    const adsValue = currentAggregation.stats.adsAmount;
    const adsPrevious = previousAggregation.stats.adsAmount;
    planBreakdown.push({
      key: 'ads',
      name: 'تبلیغات ویژه',
      value: adsValue,
      change: adsPrevious > 0 ? (adsValue - adsPrevious) / adsPrevious : (adsValue > 0 ? 1 : 0)
    });

    const dailyMap = new Map(
      currentAggregation.daily.map((item) => [item.date, item])
    );

    const dateFormatter = new Intl.DateTimeFormat('fa-IR', {
      month: '2-digit',
      day: '2-digit'
    });

    const labels = [];
    const plansSeries = [];
    const adsSeries = [];
    let bestDay = null;

    const cursor = new Date(startDate);
    cursor.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < rangeDays; i += 1) {
      const key = cursor.toISOString().slice(0, 10);
      const entry = dailyMap.get(key) || { plans: 0, ads: 0, total: 0 };
      labels.push(dateFormatter.format(cursor));
      plansSeries.push(entry.plans || 0);
      adsSeries.push(entry.ads || 0);
      if (!bestDay || (entry.total || 0) > (bestDay.total || 0)) {
        bestDay = { date: key, total: entry.total || 0 };
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    if (bestDay && (bestDay.total || 0) <= 0) {
      bestDay = null;
    }

    const summary = {
      total: buildChangeMetric(
        currentAggregation.stats.totalAmount,
        previousAggregation.stats.totalAmount
      ),
      plans: buildChangeMetric(
        currentAggregation.stats.plansAmount,
        previousAggregation.stats.plansAmount
      ),
      ads: buildChangeMetric(
        currentAggregation.stats.adsAmount,
        previousAggregation.stats.adsAmount
      ),
      topSeller: sellers[0]?.name || '—'
    };

    const distribution = {
      labels: ['اشتراک فروشندگان', 'تبلیغات اختصاصی'],
      values: [currentAggregation.stats.plansAmount, currentAggregation.stats.adsAmount]
    };

    res.json({
      data: {
        generatedAt: new Date().toISOString(),
        range: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        summary,
        planBreakdown,
        trend: {
          labels,
          plans: plansSeries,
          ads: adsSeries
        },
        distribution,
        sellers,
        meta: {
          totalPayments: currentAggregation.stats.paymentCount,
          plansCount: currentAggregation.stats.plansCount,
          adsCount: currentAggregation.stats.adsCount,
          sellerCount: currentAggregation.stats.sellerCount,
          rangeDays,
          bestDay
        }
      }
    });
  } catch (err) {
    console.error('❌ getIncomeInsights error:', err);
    res.status(500).json({ message: 'خطا در دریافت داشبورد درآمد.', error: err.message });
  }
};
