const mongoose = require('mongoose');
const ShopAppearance = require('../models/ShopAppearance');

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
// ================== ثبت امتیاز فروشگاه ==================
exports.rateShop = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const userId = req.user.id;           // از authMiddleware گرفته می‌شود
    const { rating, comment } = req.body;

    // ۱) اعتبارسنجی امتیاز
    const score = parseInt(rating, 10);
    if (isNaN(score) || score < 1 || score > 5) {
      return res.status(400).json({ message: 'امتیاز باید عددی بین ۱ تا ۵ باشد.' });
    }

    // ۲) پیدا کردن سند ShopAppearance
    const shop = await ShopAppearance.findOne({ sellerId });
    if (!shop) {
      return res.status(404).json({ message: 'فروشگاه یافت نشد.' });
    }

    // ۳) استفاده از متد مدل برای افزودن امتیاز و جلوگیری از تکرار
    await shop.addRating(userId, score, comment);

    // ۴) پاسخ با داده‌های به‌روز
    res.json({
      averageRating: shop.averageRating,
      ratingCount:  shop.ratingCount
    });
  } catch (err) {
    console.error('❌ rateShop error:', err.message);
    if (err.message.includes('قبلاً امتیاز داده')) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'خطای سرور در ثبت امتیاز.' });
  }
};
