const express = require('express');
const router = express.Router();
const ShopAppearance = require('../models/ShopAppearance');
const Seller = require('../models/Seller');
const Product = require('../models/product'); // اضافه شده برای گرفتن محصولات
const dailyVisitCtrl = require('../controllers/dailyVisitController');

// گرفتن لیست همه فروشگاه‌ها (برای vitrinNet)
// گرفتن لیست همه فروشگاه‌ها (برای vitrinNet)
router.get('/', async (req, res) => {
  try {
    const { city, limit } = req.query;
    let shops = await ShopAppearance.find({}).populate('sellerId');
    const allProducts = await Product.find({});

    if (city) {
      const regex = new RegExp(city, 'i');
      shops = shops.filter(s =>
        regex.test(s.shopAddress || '') ||
        regex.test(s.sellerId?.address || '')
      );
    }
    if (limit) {
      const n = parseInt(limit, 10);
      if (!isNaN(n)) shops = shops.slice(0, n);
    }

    const shopCards = shops.map(shop => {
      const seller = shop.sellerId;

      let ownerFirstname = (seller && seller.firstname) ? seller.firstname : '';
      let ownerLastname = (seller && seller.lastname) ? seller.lastname : '';
      let ownerName = (ownerFirstname || ownerLastname) ? `${ownerFirstname} ${ownerLastname}`.trim() : 'نامشخص';

      const shopurl = shop.customUrl || (seller && seller.shopurl) || '';
      // شمارش محصولات واقعی بر اساس shopurl
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
        productsCount,  // 👈 اینجا مقدار درست میاد
        createdAt: seller?.createdAt || null

      };
    });

    res.json(shopCards);
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
