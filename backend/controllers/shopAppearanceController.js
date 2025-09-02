const mongoose = require('mongoose');
const ShopAppearance = require('../models/ShopAppearance');
const Review = require('../models/Review');

// تابع کمکی برای تبدیل URL نسبی به مطلق
function makeFullUrl(req, path) {
  if (!path) return '';
  // اگر آدرس کامل (http/https) یا data URI بود همان را برگردان
  if (/^(https?:|data:)/i.test(path)) return path;
  return `${req.protocol}://${req.headers.host}/${path.replace(/^\//, '')}`;
}


// تابع escapeRegex (از مدل کپی شده برای consistency)
function escapeRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

// ================== دریافت ظاهر فروشگاه بر اساس sellerId ==================
exports.getShopAppearance = async (req, res) => {
  try {
    const { sellerId } = req.params;
    if (!sellerId) {
      return res.status(400).json({ message: "شناسه فروشنده ارسال نشده!" });
    }

    // دنبال فیلد sellerId (نه _id)
    let query = {};
    if (mongoose.Types.ObjectId.isValid(sellerId)) {
      query = { sellerId: new mongoose.Types.ObjectId(sellerId) };
    } else {
      query = { sellerId: sellerId };
    }

    const shop = await ShopAppearance.findOne(query);
    if (!shop) {
      return res.status(404).json({ message: "ظاهر فروشگاه یافت نشد!" });
    }

    // تبدیل URLهای نسبی به مطلق برای shopLogo و slides
    shop.shopLogo = makeFullUrl(req, shop.shopLogo);
    shop.slides = shop.slides.map(slide => ({
      ...slide._doc,
      img: makeFullUrl(req, slide.img)
    }));

    res.json(shop);
  } catch (err) {
    console.error("خطا در دریافت اطلاعات ظاهر فروشگاه:", err);
    res.status(500).json({ message: "خطا در دریافت اطلاعات ظاهر فروشگاه!" });
  }
};

// ================== ساخت یا آپدیت ظاهر فروشگاه بر اساس sellerId ==================
exports.saveShopAppearance = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { shopurl } = req.body;

    if (!sellerId || !shopurl) {
      return res.status(400).json({ message: "شناسه فروشنده و آدرس فروشگاه الزامی است." });
    }

    // حالت ObjectId معتبر
    let objectId = null;
    if (mongoose.Types.ObjectId.isValid(sellerId)) {
      objectId = new mongoose.Types.ObjectId(sellerId);
    }

    // دیتای جدید برای ذخیره/آپدیت
    const data = {
      _id: objectId || sellerId,
      sellerId: objectId || sellerId,
      customUrl: shopurl,
      shopPhone: req.body.shopPhone || '',
      shopAddress: req.body.shopAddress || '',
      shopLogoText: req.body.shopLogoText || '',
      shopStatus: req.body.shopStatus || 'open',
      slides: req.body.slides || [],
      shopLogo: req.body.shopLogo || ''
    };

    // شرط جستجو (هم بر اساس _id هم sellerId)
    let query = { $or: [] };
    if (objectId) {
      query.$or.push({ _id: objectId });
      query.$or.push({ sellerId: objectId });
    }
    query.$or.push({ _id: sellerId });
    query.$or.push({ sellerId: sellerId });

    // جلوگیری از duplicate customUrl
    let shop = await ShopAppearance.findOne(query);

    if (shop) {
      if (shop.customUrl !== shopurl) {
        let sameUrl = await ShopAppearance.findOne({ customUrl: shopurl });
        if (sameUrl && sameUrl._id.toString() !== shop._id.toString()) {
          return res.status(400).json({ message: "این آدرس فروشگاه قبلاً برای فروشنده دیگری ثبت شده است." });
        }
      }
      await ShopAppearance.updateOne({ _id: shop._id }, data);
    } else {
      let sameUrl = await ShopAppearance.findOne({ customUrl: shopurl });
      if (sameUrl) {
        return res.status(400).json({ message: "این آدرس فروشگاه قبلاً ثبت شده است." });
      }
      shop = await ShopAppearance.create(data);
    }

    res.json({ message: "تغییرات ظاهر فروشگاه با موفقیت ذخیره شد." });
  } catch (err) {
    console.error("خطا در ذخیره ظاهر فروشگاه:", err);
    res.status(500).json({ message: "خطا در ذخیره ظاهر فروشگاه!" });
  }
};

// ================== دریافت ظاهر فروشگاه بر اساس customUrl ==================
exports.getAppearanceByUrl = async (req, res) => {
  try {
    const { shopurl } = req.params;
    if (!shopurl) {
      return res.status(400).json({ message: "آدرس فروشگاه وارد نشده است." });
    }
    const shop = await ShopAppearance.findOne({ customUrl: shopurl });
    if (!shop) {
      return res.status(404).json({ message: "ظاهر فروشگاه با این آدرس یافت نشد!" });
    }

    // تبدیل URLهای نسبی به مطلق برای shopLogo و slides
    shop.shopLogo = makeFullUrl(req, shop.shopLogo);
    shop.slides = shop.slides.map(slide => ({
      ...slide._doc,
      img: makeFullUrl(req, slide.img)
    }));

    res.json(shop);
  } catch (err) {
    console.error("خطا در دریافت ظاهر فروشگاه بر اساس url:", err);
    res.status(500).json({ message: "خطا در دریافت ظاهر فروشگاه!" });
  }
};

// ================== دریافت مغازه‌ها بر اساس عنوان مرکز خرید ==================
exports.getShopsByCenterTitle = async (req, res) => {
  try {
    const { centerTitle } = req.query;
    if (!centerTitle) {
      return res.status(400).json({ message: "عنوان مرکز خرید ارسال نشده!" });
    }

    const words = centerTitle.trim().split(/\s+/).filter(word => word.length > 0);
    const escapedWords = words.map(word => escapeRegex(word));
    const regexPattern = escapedWords.join('|');

    console.log('Received centerTitle:', centerTitle);
    console.log('Regex pattern:', regexPattern);

    const shops = await ShopAppearance.find({
      shopAddress: { $regex: regexPattern, $options: 'i' }
    })
      .populate({
        path: 'sellerId',
        select: 'boardImage storename' // استفاده از boardImage
      })
      .lean();

    console.log('Shops found:', shops);

    if (!shops.length) {
      console.warn('No shops found for centerTitle:', centerTitle);
      return res.json([]);
    }

    const updatedShops = shops.map(shop => ({
      ...shop,
      shopLogo: makeFullUrl(req, shop.sellerId?.boardImage || ''), // از boardImage استفاده کن
      slides: shop.slides.map(slide => ({
        ...slide,
        img: makeFullUrl(req, slide.img || '')
      }))
    }));

    res.json(updatedShops);
  } catch (err) {
    console.error("خطا در دریافت مغازه‌ها:", err);
    res.status(500).json({ message: "خطا در دریافت مغازه‌ها!" });
  }
};


// ================== ثبت امتیاز فروشگاه ==================
exports.addReview = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const userId = req.user.id;           // از authMiddleware گرفته می‌شود
    const { rating, comment } = req.body;

    // ۱) اعتبارسنجی امتیاز
    const score = parseInt(rating, 10);
    if (isNaN(score) || score < 1 || score > 5) {
      return res.status(400).json({ message: 'امتیاز باید عددی بین ۱ تا ۵ باشد.' });
    }

    // ۲) بررسی وجود فروشگاه
    const shop = await ShopAppearance.findOne({ sellerId });
    if (!shop) {
      return res.status(404).json({ message: 'فروشگاه یافت نشد.' });
    }

    // ۳) اگر کاربر قبلاً نظری داده باشد، همان را به‌روزرسانی کن
    //     به جای برگرداندن خطای ۴۰۰ که باعث اختلال در تجربهٔ کاربری می‌شد
    const existing = await Review.findOne({ sellerId, userId });
    if (existing) {
      existing.score = score;
      existing.comment = comment;
      // در صورت ویرایش مجدد نظر، دوباره نیاز به تایید دارد
      existing.approved = false;
      await existing.save();
    } else {
      // ۴) ثبت نظر جدید
      await Review.create({ sellerId, userId, score, comment });
    }

    // ۵) محاسبه مجدد میانگین و تعداد از روی مجموعه Review
    const agg = await Review.aggregate([
      { $match: { sellerId: new mongoose.Types.ObjectId(sellerId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$score' },
          ratingCount: { $sum: 1 }
        }
      }
    ]);

    const averageRating = agg[0]?.averageRating || 0;
    const ratingCount = agg[0]?.ratingCount || 0;

    shop.averageRating = averageRating;
    shop.ratingCount = ratingCount;
    await shop.save();

    res.json({ averageRating, ratingCount });
  } catch (err) {
    console.error('❌ addReview error:', err.message);
    res.status(500).json({ message: 'خطای سرور در ثبت امتیاز.' });
  }
};

// ================== دریافت نظرات ==================
exports.getReviews = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const reviews = await Review.find({ sellerId, approved: true })
      .sort({ createdAt: -1 })
      .populate('userId', 'firstname lastname')
      .lean();

    const formatted = reviews.map(r => ({
      _id: r._id,
      userId: r.userId?._id,
      userName: r.userId ? `${r.userId.firstname} ${r.userId.lastname}`.trim() : undefined,
      score: r.score,
      comment: r.comment,
      createdAt: r.createdAt
    }));

    res.json(formatted);
  } catch (err) {
    console.error('❌ getReviews error:', err.message);
    res.status(500).json({ message: 'خطای سرور در دریافت نظرات.' });
  }
};

// ================== دریافت نظرات تایید نشده ==================
exports.getPendingReviews = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const reviews = await Review.find({ sellerId, approved: false })
      .sort({ createdAt: -1 })
      .populate('userId', 'firstname lastname')
      .lean();

    const formatted = reviews.map(r => ({
      _id: r._id,
      userId: r.userId?._id,
      userName: r.userId ? `${r.userId.firstname} ${r.userId.lastname}`.trim() : undefined,
      score: r.score,
      comment: r.comment,
      createdAt: r.createdAt,
      approved: r.approved
    }));

    res.json(formatted);
  } catch (err) {
    console.error('❌ getPendingReviews error:', err.message);
    res.status(500).json({ message: 'خطای سرور در دریافت نظرات تایید نشده.' });
  }
};

// ================== تایید نظر ==================
exports.approveReview = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { reviewId } = req.params;
    const review = await Review.findOneAndUpdate(
      { _id: reviewId, sellerId },
      { approved: true },
      { new: true }
    );
    if (!review) {
      return res.status(404).json({ message: 'نظر یافت نشد.' });
    }
    res.json({ message: 'نظر تایید شد.' });
  } catch (err) {
    console.error('❌ approveReview error:', err.message);
    res.status(500).json({ message: 'خطای سرور در تایید نظر.' });
  }
};

// ================== حذف/رد نظر ==================
exports.rejectReview = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { reviewId } = req.params;
    const review = await Review.findOneAndDelete({ _id: reviewId, sellerId });
    if (!review) {
      return res.status(404).json({ message: 'نظر یافت نشد.' });
    }
    res.json({ message: 'نظر حذف شد.' });
  } catch (err) {
    console.error('❌ rejectReview error:', err.message);
    res.status(500).json({ message: 'خطای سرور در حذف نظر.' });
  }
};
