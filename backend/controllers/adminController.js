// controllers/adminController.js

const Admin      = require('../models/admin');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const User       = require('../models/user');
const Seller     = require('../models/Seller');
const Product    = require('../models/product');
const DailyVisit = require('../models/DailyVisit');
const ServiceShop = require('../models/serviceShop');

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
