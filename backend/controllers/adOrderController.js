const AdOrder = require('../models/AdOrder');
const Product = require('../models/product');
const Seller = require('../models/Seller');
const AdPlan = require('../models/adPlan');
const fs = require('fs');
const path = require('path');
// ثبت سفارش تبلیغ ویژه
exports.createAdOrder = async (req, res) => {
  try {
    console.log("🔎 req.user:", req.user);
    console.log("🔎 req.fields:", req.fields);
    console.log("🔎 req.files:", req.files);

    const sellerId = req.user.id || req.user.sellerId;

    // داده‌های فرم
    const planSlug   = req.fields.adType || req.fields.planSlug;
    const productId  = req.fields.productId;
    const adTitle    = req.fields.title || req.fields.adTitle;
    const adText     = req.fields.text  || req.fields.adText;
    const image      = req.files?.image;

    // چک مقادیر اولیه
    if (!sellerId || !planSlug) {
      return res.status(400).json({ success: false, message: 'sellerId و planSlug الزامی است.' });
    }

    const plan = await AdPlan.findOne({ slug: planSlug });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'پلن تبلیغ پیدا نشد.' });
    }

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'فروشنده پیدا نشد.' });
    }

    let product = null;
    if (productId) {
      product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'محصول انتخاب‌شده پیدا نشد.' });
      }
    }

    // --- ذخیره عکس در uploads ---
    let bannerImage = undefined;
    if (image && image.size > 0) {
      const ext = path.extname(image.name);
      const fileName = Date.now() + '-' + Math.floor(Math.random() * 10000) + ext;
      const newPath = path.join(__dirname, '..', 'uploads', fileName);
      fs.copyFileSync(image.path, newPath);
      bannerImage = fileName;
      console.log('✅ عکس تبلیغ ذخیره شد:', bannerImage);
    }

    const adOrder = new AdOrder({
      sellerId,
      planSlug,
      planTitle: plan.title,
      price: plan.price,
      productId: productId || undefined,
      shopTitle: seller.storename,
      bannerImage: bannerImage,
      adTitle: adTitle ? adTitle.trim() : undefined,
      adText: adText ? adText.trim() : undefined,
      status: 'pending',
      createdAt: new Date(),
    });

    await adOrder.save();

    res.status(201).json({
      success: true,
      message: 'سفارش تبلیغ ثبت شد.',
      adOrder
    });
  } catch (err) {
    console.error('❌ خطا در ثبت سفارش تبلیغ:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در ثبت سفارش تبلیغ!',
      error: err.message
    });
  }
};

// گرفتن سفارشات تبلیغ یک فروشنده (مثلا برای پنل فروشنده)
exports.getSellerAdOrders = async (req, res) => {
  try {
    const { sellerId } = req.query;
    if (!sellerId)
      return res.status(400).json({ success: false, message: 'sellerId الزامی است.' });

    const adOrders = await AdOrder.find({ sellerId }).sort({ createdAt: -1 });
    res.json({ success: true, adOrders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در دریافت سفارشات تبلیغ', error: err.message });
  }
};

// گرفتن سفارش تبلیغ با آیدی (برای ادمین یا مشاهده جزئیات)
exports.getAdOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const adOrder = await AdOrder.findById(id)
      .populate('sellerId', 'storename shopurl phone')    // فقط اطلاعات مهم فروشنده
      .populate('productId', 'title price');              // فقط اطلاعات مهم محصول

    if (!adOrder) return res.status(404).json({ success: false, message: 'سفارش تبلیغ پیدا نشد.' });
    res.json({ success: true, adOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در دریافت سفارش تبلیغ', error: err.message });
  }
};

// (در صورت نیاز: ویرایش یا حذف سفارش تبلیغ...)

// گرفتن تبلیغ‌های فعال (مثلاً برای صفحه اصلی یا جستجو)
exports.getActiveAds = async (req, res) => {
  try {
    // planSlug رو از query بگیر (مثلاً ad_home یا ad_search)
    const { planSlug } = req.query;

    // وضعیت تبلیغ رو هم می‌تونی فیلتر کنی (مثلاً فقط تایید شده/فعال)
    // فرض می‌کنیم status باید 'pending' باشه یا اگه ادمین داری 'accepted'
    const status = 'pending'; // یا accepted اگه مرحله تایید ادمین داری

    // فیلتر داینامیک: اگر planSlug نبود همه تبلیغ‌های فعال رو بده
    const query = { status };
    if (planSlug) query.planSlug = planSlug;

    // فقط جدیدترین تبلیغ رو بفرست (می‌تونی چندتا هم بدی، ولی معمولاً یکی کافیه)
    const ads = await AdOrder.find(query)
      .sort({ createdAt: -1 })
      .limit(1);

    res.json({ success: true, ads });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در دریافت تبلیغات فعال', error: err.message });
  }
};

