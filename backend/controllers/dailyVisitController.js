const DailyVisit = require('../models/DailyVisit');
const mongoose = require('mongoose');
const Seller = require('../models/Seller');

/*  POST /api/daily-visits
 *  اگر برای date و seller رکوردی باشد مقدارش به‌روز می‌شود (upsert) */
exports.createOrUpdateVisit = async (req, res) => {
  try {
    // بررسی احراز هویت عمومی (از middleware req.user استفاده می‌کنه)
    if (!req.user) {
      return res.status(403).json({ message: 'دسترسی غیرمجاز.' });
    }

    const sellerId = req.user.id;  // استفاده از req.user.id (برای سازگاری با middleware)
    let { date, count } = req.body;

    // پیش‌فرض: امروز
    if (!date) date = new Date().toISOString().split('T')[0];

    // نرمال‌سازی و اعتبارسنجی
    count = Number(count);
    if (isNaN(count) || count < 0) {
      return res.status(400).json({ message: 'count نامعتبر است' });
    }

    // تاریخ بدون ساعت برای یکتا بودن
    const onlyDate = new Date(date);
    onlyDate.setHours(0, 0, 0, 0);

    // دریافت مشخصات فروشنده
    const sellerDoc = await Seller.findById(sellerId).select('firstname lastname phone address storename');
    if (!sellerDoc) {
      return res.status(404).json({ message: 'فروشنده یافت نشد' });
    }

    const sellerInfo = {
      firstName: sellerDoc.firstname,
      lastName: sellerDoc.lastname,
      phone: sellerDoc.phone,
      address: sellerDoc.address,
      storeName: sellerDoc.storename
    };

    const doc = await DailyVisit.findOneAndUpdate(
      { date: onlyDate, seller: sellerId },
      { count, sellerInfo },
      { upsert: true, new: true, runValidators: true }
    );

    // اصلاح برای بازگرداندن sellerId و sellerInfo
    const result = {
      id: doc._id,
      date: doc.date,
      count: doc.count,
      sellerId: doc.seller,
      sellerInfo: doc.sellerInfo,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطا در ذخیره آمار بازدید' });
  }
};

/*  GET /api/daily-visits?from=2024-05-01&to=2024-05-07&sellerId=someId */
exports.getVisits = async (req, res) => {
  try {
    // چک عمومی احراز هویت (از middleware req.user استفاده می‌کنه)
    if (!req.user) {
      return res.status(401).json({ message: 'دسترسی غیرمجاز' });
    }

    const { from, to, sellerId } = req.query;
    const filter = {};

    // بررسی تاریخ‌ها
    if (from || to) filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);

    // بررسی اینکه sellerId معتبر باشد و سپس به فیلتر اضافه کنیم
    if (sellerId) {
      if (!mongoose.Types.ObjectId.isValid(sellerId)) {
        return res.status(400).json({ message: 'شناسه فروشنده نامعتبر است' });
      }
      filter.seller = sellerId;
    }

    // اگر ادمین باشه، دسترسی کامل (بدون فیلتر seller اجباری)
    if (req.user.role !== 'admin') {
      // اگر فروشنده عادی باشه، فقط آمار خودش رو ببینه
      const currentSellerId = req.user.id;
      filter.seller = currentSellerId;
      if (sellerId && sellerId !== currentSellerId.toString()) {
        return res.status(403).json({ message: 'مجوز دیدن آمار دیگران ندارید' });
      }
    }

    // دریافت لیست آمار
    const list = await DailyVisit.find(filter)
      .sort({ date: -1 });

    const result = list.map(v => ({
      id: v._id,
      date: v.date,
      count: v.count,
      sellerId: v.seller ? v.seller.toString() : null,  // اصلاح: چک وجود v.seller قبل از toString
      sellerInfo: v.sellerInfo,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطا در دریافت آمار بازدید' });
  }
};

/*  DELETE /api/daily-visits/:id  */
exports.deleteVisit = async (req, res) => {
  try {
    const visit = await DailyVisit.findById(req.params.id);
    if (!visit) {
      return res.status(404).json({ message: 'رکورد یافت نشد' });
    }

    // چک auth: ادمین همیشه اجازه داره، فروشنده فقط اگر صاحب رکورد باشه
    if (req.user.role !== 'admin') {
      if (visit.seller.toString() !== req.user.id.toString()) {
        return res.status(403).json({ message: 'مجوز حذف ندارید' });
      }
    }

    await DailyVisit.findByIdAndDelete(req.params.id);
    res.json({ message: 'آمار روز موردنظر حذف شد.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطا در حذف آمار' });
  }
};

/*  GET /api/daily-visits/sellers – لیست فروشندگان (فقط برای ادمین) */
exports.getSellers = async (req, res) => {
  try {
    // چک نقش ادمین
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'دسترسی غیرمجاز' });
    }

    const sellers = await Seller.find({})
      .select('_id firstname lastname storename phone address');
    res.json(sellers.map(s => ({
      id: s._id,
      name: `${s.firstname || ''} ${s.lastname || ''}`.trim() || 'نامشخص',
      storeName: s.storename || 'نامشخص',
      phone: s.phone || 'نامشخص',
      address: s.address || 'نامشخص'
    })));  // نام رو از firstname + lastname بساز و فیلدهای اضافی
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطا در دریافت لیست فروشندگان' });
  }
};

// -------------------------------
// پربازدیدترین مغازه‌ها در ۳۰ روز اخیر
// GET /api/shops/top-visited?city=سنندج&limit=8
exports.getTopVisitedShops = async (req, res) => {
  try {
    const { city = '', limit = '8' } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const sellerFilter = city
      ? { address: { $regex: city, $options: 'i' } }
      : {};

    const sellers = await Seller.find(sellerFilter).select(
      '_id storename shopurl address category boardImage'
    );

    if (!sellers.length) return res.json([]);

    const sellerIds = sellers.map((s) => s._id);

    const stats = await DailyVisit.aggregate([
      { $match: { seller: { $in: sellerIds }, date: { $gte: since } } },
      { $group: { _id: '$seller', visits: { $sum: '$count' } } },
      { $sort: { visits: -1 } },
      { $limit: parseInt(limit, 10) || 8 }
    ]);

    const visitMap = new Map(stats.map((s) => [s._id.toString(), s.visits]));

    const result = stats.map((s, idx) => {
      const seller = sellers.find(
        (sl) => sl._id.toString() === s._id.toString()
      );
      if (!seller) return null;
      return {
        shopId: seller._id,
        name: seller.storename || 'بدون نام',
        city: city || '',
        address: seller.address || '',
        category: seller.category || '',
        image: seller.boardImage || '',
        shopurl: seller.shopurl || '',
        visits: visitMap.get(seller._id.toString()) || 0,
        rank: idx + 1
      };
    }).filter(Boolean);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطا در دریافت پربازدیدترین فروشگاه‌ها' });
  }
};
