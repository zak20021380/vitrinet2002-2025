const AdOrder = require('../models/AdOrder');
const Product = require('../models/product');
const Seller = require('../models/Seller');
const AdPlan = require('../models/adPlan');
const fs = require('fs');
const path = require('path');

const ALLOWED_STATUSES = ['pending', 'approved', 'paid', 'rejected', 'expired'];
const POPULATE_SPEC = [
  { path: 'sellerId', select: 'storename shopurl phone city address ownerName ownerLastname' },
  { path: 'productId', select: 'title price slug' },
  { path: 'reviewedBy', select: 'name phone' }
];

function normaliseNote(note) {
  if (note === undefined) return undefined;
  if (note === null) return undefined;
  const trimmed = String(note).trim();
  return trimmed.length ? trimmed : undefined;
}

async function populateAdOrder(doc) {
  if (!doc) return doc;
  await doc.populate(POPULATE_SPEC);
  return doc;
}
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

// دریافت همه سفارش‌های تبلیغ برای مدیریت ادمین
exports.getAllAdOrders = async (req, res) => {
  try {
    const { status, planSlug, sellerId } = req.query;

    const filter = {};
    if (status && ALLOWED_STATUSES.includes(status)) {
      filter.status = status;
    }
    if (planSlug) {
      filter.planSlug = planSlug;
    }
    if (sellerId) {
      filter.sellerId = sellerId;
    }

    const adOrders = await AdOrder.find(filter)
      .sort({ createdAt: -1 })
      .populate(POPULATE_SPEC);

    res.json({ success: true, adOrders });
  } catch (err) {
    console.error('❌ خطا در دریافت سفارش‌های تبلیغ برای ادمین:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت سفارش‌های تبلیغ.',
      error: err.message
    });
  }
};

// گرفتن سفارش تبلیغ با آیدی (برای ادمین یا مشاهده جزئیات)
exports.getAdOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const adOrder = await AdOrder.findById(id);

    if (!adOrder) return res.status(404).json({ success: false, message: 'سفارش تبلیغ پیدا نشد.' });

    await populateAdOrder(adOrder);
    res.json({ success: true, adOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در دریافت سفارش تبلیغ', error: err.message });
  }
};

// (در صورت نیاز: ویرایش یا حذف سفارش تبلیغ...)

// بروزرسانی وضعیت سفارش تبلیغ توسط ادمین
exports.updateAdOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body || {};

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'وضعیت ارسالی معتبر نیست.'
      });
    }

    const adOrder = await AdOrder.findById(id);
    if (!adOrder) {
      return res.status(404).json({ success: false, message: 'سفارش تبلیغ پیدا نشد.' });
    }

    adOrder.status = status;

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'adminNote')) {
      adOrder.adminNote = normaliseNote(adminNote);
    }

    adOrder.reviewedAt = new Date();
    if (req.user?.id || req.user?._id) {
      adOrder.reviewedBy = req.user.id || req.user._id;
    }

    if (status === 'approved') {
      adOrder.approvedAt = new Date();
    } else if (status !== 'approved') {
      adOrder.approvedAt = undefined;
    }

    await adOrder.save();
    await populateAdOrder(adOrder);

    res.json({
      success: true,
      message: 'وضعیت تبلیغ بروزرسانی شد.',
      adOrder
    });
  } catch (err) {
    console.error('❌ خطا در بروزرسانی وضعیت تبلیغ:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در بروزرسانی وضعیت تبلیغ.',
      error: err.message
    });
  }
};

// گرفتن تبلیغ‌های فعال (مثلاً برای صفحه اصلی یا جستجو)
exports.getActiveAds = async (req, res) => {
  try {
    // planSlug رو از query بگیر (مثلاً ad_home یا ad_search)
    const { planSlug } = req.query;

    // فیلتر داینامیک: اگر planSlug نبود همه تبلیغ‌های فعال رو بده
    const query = { status: 'approved' };
    if (planSlug) query.planSlug = planSlug;

    // فقط جدیدترین تبلیغ رو بفرست (می‌تونی چندتا هم بدی، ولی معمولاً یکی کافیه)
    const ads = await AdOrder.find(query)
      .sort({ approvedAt: -1, createdAt: -1 })
      .limit(1);

    res.json({ success: true, ads });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در دریافت تبلیغات فعال', error: err.message });
  }
};

