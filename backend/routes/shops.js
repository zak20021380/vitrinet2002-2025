const express = require('express');
const router = express.Router();
const ShopAppearance = require('../models/ShopAppearance');
const Seller = require('../models/Seller');
const Product = require('../models/product'); // اضافه شده برای گرفتن محصولات
const dailyVisitCtrl = require('../controllers/dailyVisitController');

// دریافت لیست همه فروشگاه‌ها از مدل Seller
router.get('/', async (req, res) => {
  try {
    const sellers = await Seller.find({}, {
      _id: 1,
      storename: 1,
      category: 1,
      shopurl: 1,
      address: 1,
      desc: 1,
      isPremium: 1,
      boardImage: 1,
      firstname: 1,
      lastname: 1,
      phone: 1,
      createdAt: 1,
      subscriptionStart: 1,
      subscriptionEnd: 1,
      visits: 1,
      blockedByAdmin: 1,
      updatedAt: 1
    }).lean();

    const sellerIds = sellers.map(seller => seller._id).filter(Boolean);
    const appearances = await ShopAppearance.find({
      sellerId: { $in: sellerIds }
    }, {
      sellerId: 1,
      customUrl: 1,
      shopLogoText: 1,
      shopAddress: 1,
      shopPhone: 1,
      shopStatus: 1,
      shopVisits: 1,
      shopRating: 1,
      averageRating: 1,
      ratingCount: 1,
      slides: 1,
      updatedAt: 1
    }).lean();

    const appearanceMap = new Map();
    appearances.forEach(app => {
      const key = app.sellerId ? app.sellerId.toString() : null;
      if (key) {
        appearanceMap.set(key, app);
      }
    });

    const result = sellers.map(seller => {
      const sellerId = seller._id ? seller._id.toString() : '';
      const appearance = sellerId ? appearanceMap.get(sellerId) : null;

      const ownerFirstname = seller.firstname || '';
      const ownerLastname = seller.lastname || '';
      const ownerName = (ownerFirstname || ownerLastname)
        ? `${ownerFirstname} ${ownerLastname}`.trim()
        : '';
      const phone = seller.phone || '';

      const resolvedShopUrl = seller.shopurl || (appearance && appearance.customUrl) || '';

      return {
        id: seller._id,
        _id: seller._id,
        sellerId,
        storename: seller.storename || '',
        category: seller.category || '',
        shopurl: resolvedShopUrl,
        customUrl: (appearance && appearance.customUrl) || '',
        address: seller.address || '',
        shopAddress: (appearance && appearance.shopAddress) || seller.address || '',
        desc: seller.desc || '',
        isPremium: !!seller.isPremium,
        image: seller.boardImage || '',
        boardImage: seller.boardImage || '',
        shopLogoText: (appearance && appearance.shopLogoText) || seller.storename || '',
        shopStatus: (appearance && appearance.shopStatus) || '',
        ownerFirstname,
        ownerLastname,
        ownerName,
        ownerPhone: phone,
        ownerMobile: phone,
        phone,
        shopPhone: (appearance && appearance.shopPhone) || '',
        visits: seller.visits || 0,
        shopVisits: (appearance && appearance.shopVisits) || seller.visits || 0,
        averageRating: (appearance && (appearance.averageRating ?? appearance.shopRating)) || 0,
        ratingCount: (appearance && appearance.ratingCount) || 0,
        createdAt: seller.createdAt || null,
        subscriptionStart: seller.subscriptionStart || null,
        subscriptionEnd: seller.subscriptionEnd || null,
        blockedByAdmin: !!seller.blockedByAdmin,
        updatedAt: seller.updatedAt || null,
        appearanceUpdatedAt: (appearance && appearance.updatedAt) || null,
        slides: (appearance && appearance.slides) || []
      };
    });

    res.json(result);
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
