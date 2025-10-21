const express = require('express');
const router = express.Router();
const ShopAppearance = require('../models/ShopAppearance');
const Seller = require('../models/Seller');
const Product = require('../models/product'); // اضافه شده برای گرفتن محصولات
const dailyVisitCtrl = require('../controllers/dailyVisitController');

// دریافت لیست همه فروشگاه‌ها از مدل Seller
router.get('/', async (req, res) => {
  try {
    const sellers = await Seller.find({},
      'storename category shopurl address desc isPremium boardImage'
    ).lean();

    const result = sellers.map(seller => {
      const ownerFirstname = seller.firstname || '';
      const ownerLastname  = seller.lastname  || '';
      const ownerName = (ownerFirstname || ownerLastname)
        ? `${ownerFirstname} ${ownerLastname}`.trim()
        : '';

      return {
        id: seller._id,
        storename: seller.storename || '',
        category: seller.category || '',
        shopurl: seller.shopurl || '',
        address: seller.address || '',
        desc: seller.desc || '',
        isPremium: !!seller.isPremium,
        image: seller.boardImage || '',
        ownerName,
        ownerFirstname,
        ownerLastname,
        ownerPhone: seller.phone || ''
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
