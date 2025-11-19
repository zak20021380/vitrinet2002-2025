const express = require('express');
const router = express.Router();
const ShopAppearance = require('../models/ShopAppearance');
const Seller = require('../models/Seller');
const Product = require('../models/product'); // اضافه شده برای گرفتن محصولات
const dailyVisitCtrl = require('../controllers/dailyVisitController');

const normaliseText = (value = '') => value.toString().replace(/\s+/g, ' ').trim();

const slugifyCategory = (value = '') =>
  normaliseText(value)
    .replace(/[._]/g, '-')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
    .replace(/[^-\w\u0600-\u06FF]/g, '')
    .replace(/-+/g, '-')
    .toLowerCase();

const CATEGORY_DEFINITIONS = {
  general: { aliases: ['general', 'all', 'همه'], label: 'عمومی' },
  food: { aliases: ['food', 'خوراک', 'مواد غذایی', 'سوپرمارکت', 'رستوران', 'فست فود', 'کافه'], label: 'خوراک' },
  clothing: { aliases: ['clothing', 'پوشاک', 'لباس', 'کفش', 'مد و پوشاک'], label: 'پوشاک' },
  beauty: { aliases: ['beauty', 'زیبایی', 'آرایشی', 'بهداشتی', 'سالن زیبایی'], label: 'زیبایی' },
  service: { aliases: ['service', 'services', 'خدمات', 'سرویس', 'تعمیرات'], label: 'خدمات' },
  digital: { aliases: ['digital', 'دیجیتال', 'موبایل', 'کالای دیجیتال', 'لوازم جانبی'], label: 'دیجیتال' },
  book: { aliases: ['book', 'کتاب', 'کتاب و تحریر', 'تحریر'], label: 'کتاب و تحریر' },
  auto: { aliases: ['auto', 'car', 'خودرو', 'ماشین'], label: 'خودرو' },
  sweets: { aliases: ['sweets', 'قنادی', 'شیرینی', 'نان فانتزی'], label: 'قنادی و شیرینی' },
  flower: { aliases: ['flower', 'گل و گیاه', 'گل', 'گیاه'], label: 'گل و گیاه' },
  home: { aliases: ['home', 'خانه', 'لوازم خانگی', 'وسایل منزل'], label: 'لوازم خانگی' },
  sport: { aliases: ['sport', 'ورزشی', 'ورزش', 'باشگاه'], label: 'ورزشی' },
  talar: { aliases: ['talar', 'تالار', 'تالار و مجالس', 'مجالس'], label: 'تالار و مجالس' }
};

const aliasSlugCache = new Map();
const aliasToCanonical = new Map();

Object.entries(CATEGORY_DEFINITIONS).forEach(([key, definition]) => {
  const canonicalSlug = slugifyCategory(key);
  if (canonicalSlug) {
    aliasToCanonical.set(canonicalSlug, canonicalSlug);
  }

  (definition.aliases || []).forEach((alias) => {
    const aliasSlug = slugifyCategory(alias);
    if (aliasSlug) {
      aliasToCanonical.set(aliasSlug, canonicalSlug || aliasSlug);
    }
  });
});

const resolveCategorySlug = (value = '') => {
  const slug = slugifyCategory(value);
  if (!slug) {
    return '';
  }

  return aliasToCanonical.get(slug) || slug;
};

const getAliasSlugSet = (slug = '') => {
  const canonicalSlug = resolveCategorySlug(slug);
  if (!canonicalSlug) {
    return new Set();
  }

  if (aliasSlugCache.has(canonicalSlug)) {
    return aliasSlugCache.get(canonicalSlug);
  }

  const definition = CATEGORY_DEFINITIONS[canonicalSlug];
  const aliases = definition?.aliases || [];
  const candidates = new Set([
    canonicalSlug,
    ...aliases.map((alias) => resolveCategorySlug(alias)).filter(Boolean)
  ]);

  aliasSlugCache.set(canonicalSlug, candidates);
  return candidates;
};

const matchesCategorySlug = (shop = {}, targetSlug = '') => {
  const allowedSlugs = getAliasSlugSet(targetSlug);

  if (!allowedSlugs.size) {
    return false;
  }

  const mainSlug = slugifyCategory(shop.categorySlug || shop.category || '');
  if (mainSlug && allowedSlugs.has(mainSlug)) {
    return true;
  }

  const subSlug = slugifyCategory(shop.subcategory || '');
  if (subSlug && allowedSlugs.has(subSlug)) {
    return true;
  }

  return false;
};

// دریافت لیست همه فروشگاه‌ها از مدل Seller
router.get('/', async (req, res) => {
  try {
    const categoryParam = req.query?.category || '';
    const categorySlug = resolveCategorySlug(categoryParam);
    const shouldFilterByCategory = Boolean(categorySlug && categorySlug !== 'general');

    const sellers = await Seller.find({},
      'storename category subcategory shopurl address city region desc isPremium boardImage'
    ).lean();

    const result = sellers.map((seller) => {
      const categoryName = normaliseText(seller.category || '');
      const subcategoryName = normaliseText(seller.subcategory || '');
      const canonicalSlug = resolveCategorySlug(categoryName) || resolveCategorySlug(subcategoryName);
      const fallbackSlug = canonicalSlug
        || slugifyCategory(categoryName)
        || slugifyCategory(subcategoryName);

      return {
        id: seller._id,
        storename: seller.storename || '',
        category: categoryName,
        subcategory: subcategoryName,
        shopurl: seller.shopurl || '',
        address: seller.address || '',
        city: seller.city || '',
        region: seller.region || '',
        desc: seller.desc || '',
        isPremium: !!seller.isPremium,
        image: seller.boardImage || '',
        categorySlug: fallbackSlug
      };
    });

    const payload = shouldFilterByCategory
      ? result.filter((shop) => matchesCategorySlug(shop, categorySlug))
      : result;

    res.json(payload);
  } catch (err) {
    console.error('خطا در دریافت لیست فروشگاه‌ها:', err);
    res.status(500).json({ success: false, message: 'خطای سرور!' });
  }
});

// پربازدیدترین مغازه‌های شهر
router.get('/top-visited', dailyVisitCtrl.getTopVisitedShops);


// لیست فروشگاه‌های پریمیوم (فقط فروشندگانی که اشتراک فعال دارند)
router.get('/premium', async (req, res) => {
  try {
    const now = new Date();
    // فقط فروشنده‌هایی که پریمیوم فعال دارند
    const premiumSellers = await Seller.find({
      isPremium: true,
      premiumUntil: { $gt: now }
    }).lean();

    const sellerIds = premiumSellers.map(s => s._id);
    if (sellerIds.length === 0) return res.json([]);

    const shops = await ShopAppearance.find({ sellerId: { $in: sellerIds } }).populate('sellerId');
    const allProducts = await Product.find({ sellerId: { $in: sellerIds } });

    const shopCards = shops.map(shop => {
      const seller = shop.sellerId;

      let ownerFirstname = (seller && seller.firstname) ? seller.firstname : '';
      let ownerLastname = (seller && seller.lastname) ? seller.lastname : '';
      let ownerName = (ownerFirstname || ownerLastname) ? `${ownerFirstname} ${ownerLastname}`.trim() : 'نامشخص';

      const shopurl = shop.customUrl || (seller && seller.shopurl) || '';
      const productsCount = allProducts.filter(
        p => String(p.sellerId) === String(seller._id)
      ).length;

      return {
        shopurl,
        storename: shop.shopLogoText || (seller && seller.storename) || 'بدون نام',
        address: shop.shopAddress || (seller && seller.address) || 'نامشخص',
        banner: (shop.slides && shop.slides.length > 0 && shop.slides[0].img) ? shop.slides[0].img : '',
        category: shop.shopCategory || (seller && seller.category) || '',
        rating: shop.shopRating || '',
        visits: shop.shopVisits || 0,
        boardImage:
          (shop.boardImage && shop.boardImage.trim().length > 0)
            ? shop.boardImage
            : ((seller && seller.boardImage && seller.boardImage.trim().length > 0)
                ? seller.boardImage
                : ""),
        ownerName,
        ownerFirstname,
        ownerLastname,
        ownerPhone: (seller && seller.phone) || '',
        productsCount,
        createdAt: seller?.createdAt || null
      };
    });

    res.json(shopCards);
  } catch (err) {
    console.error('خطا در دریافت لیست فروشگاه‌های پریمیوم:', err);
    res.status(500).json({ success: false, message: 'خطای سرور!' });
  }
});

// گرفتن اطلاعات فروشگاه با customUrl
router.get('/:shopurl', async (req, res) => {
  try {
    const shopurl = req.params.shopurl;
    const shop = await ShopAppearance.findOne({ customUrl: shopurl }).populate('sellerId');
    if (!shop) {
      return res.status(404).json({ success: false, message: 'آدرس موردنظر یافت نشد!' });
    }
    const seller = shop.sellerId;

    let ownerFirstname = (seller && seller.firstname) ? seller.firstname : '';
    let ownerLastname = (seller && seller.lastname) ? seller.lastname : '';
    let ownerName = (ownerFirstname || ownerLastname) ? `${ownerFirstname} ${ownerLastname}`.trim() : 'نامشخص';

    res.json({
      shopLogoText: shop.shopLogoText || (seller && seller.storename) || '',
      shopName: shop.shopName || (seller && seller.storename) || '',
      shopStatus: shop.shopStatus || '',
      shopAddress: shop.shopAddress || (seller && seller.address) || '',
      shopPhone: shop.shopPhone || (seller && seller.phone) || '',
      shopRating: shop.shopRating || '',
      shopVisits: shop.shopVisits || 0,
      shopCategory: shop.shopCategory || (seller && seller.category) || '',
      slides: shop.slides || [],
      boardImage:
        (shop.boardImage && shop.boardImage.trim().length > 0)
          ? shop.boardImage
          : ((seller && seller.boardImage && seller.boardImage.trim().length > 0)
              ? seller.boardImage
              : ""),
      ownerName,
      ownerFirstname,
      ownerLastname,
      ownerPhone: (seller && seller.phone) || ''
    });
  } catch (err) {
    console.error('خطا در دریافت اطلاعات فروشگاه:', err);
    res.status(500).json({ success: false, message: 'خطای سرور!' });
  }
});

module.exports = router;
