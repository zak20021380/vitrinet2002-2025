const mongoose = require('mongoose');
const Seller = require('../models/Seller');
const bcrypt = require('bcryptjs');
const Product = require('../models/product');
const ShopAppearance = require('../models/ShopAppearance');
const SellerPlan = require('../models/sellerPlan');
const AdOrder = require('../models/AdOrder');
const Payment = require('../models/payment');
const Chat = require('../models/chat');
const Report = require('../models/Report');
const BannedPhone = require('../models/BannedPhone');
const Plan = require('../models/plan');
const { calcPremiumUntil } = require('../utils/premium');
const { clampAdminScore, evaluatePerformance } = require('../utils/performanceStatus');

function buildPerformancePayload(seller, options = {}) {
  const { includeNote = false } = options;
  const performance = evaluatePerformance(seller?.adminScore ?? null);
  const displayName = (
    seller?.storename ||
    [seller?.firstname, seller?.lastname].filter(Boolean).join(' ').trim() ||
    seller?.shopurl ||
    ''
  );

  const payload = {
    sellerId: seller?._id ? seller._id.toString() : null,
    shopurl: seller?.shopurl || null,
    storename: seller?.storename || null,
    displayName,
    adminScore: seller?.adminScore ?? null,
    updatedAt: seller?.adminScoreUpdatedAt || null,
    status: performance.status,
    statusLabel: performance.label,
    statusMessage: performance.message,
    severity: performance.severity,
    canStay: performance.canStay,
    adminScoreMessage: seller?.adminScoreMessage || ''
  };

  if (includeNote) {
    payload.adminScoreNote = seller?.adminScoreNote || '';
  }

  return payload;
}

async function findSellerByFlexibleId(identifier) {
  if (!identifier) return null;

  if (typeof identifier === 'string' && identifier.startsWith('shopurl:')) {
    const shopurl = identifier.replace(/^shopurl:/, '');
    return Seller.findOne({ shopurl });
  }

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const byId = await Seller.findById(identifier);
    if (byId) return byId;
  }

  return Seller.findOne({ shopurl: identifier });
}

exports.registerSeller = async (req, res) => {
  try {
    const { firstname, lastname, storename, shopurl, phone, category, address, desc, password } = req.body;

    // بررسی تکراری نبودن
    const exists = await Seller.findOne({ $or: [{ phone }, { shopurl }] });
    if (exists) return res.status(400).json({ message: 'این شماره یا آدرس فروشگاه قبلاً ثبت شده است.' });

    // رمزنگاری رمز عبور
    const hashedPassword = await bcrypt.hash(password, 10);

    const seller = new Seller({
      firstname,
      lastname,
      storename,
      shopurl,
      phone,
      category,
      address,
      desc,
      password: hashedPassword,
    });

    await seller.save();
    res.status(201).json({ message: 'ثبت‌نام فروشنده با موفقیت انجام شد.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطا در ثبت‌نام فروشنده' });
  }
};

// حذف کامل فروشنده و تمام داده‌های مرتبط
exports.deleteSeller = async (req, res) => {
  try {
    const { sellerId } = req.params;

    let seller;
    if (typeof sellerId === 'string' && sellerId.startsWith('shopurl:')) {
      const shopurl = sellerId.replace(/^shopurl:/, '');
      seller = await Seller.findOne({ shopurl });
    } else {
      seller = await Seller.findById(sellerId);
    }

    if (!seller) {
      return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    }

    const phone = seller.phone;

    await Promise.all([
      Product.deleteMany({ sellerId: seller._id }),
      ShopAppearance.deleteMany({ sellerId: seller._id }),
      SellerPlan.deleteMany({ sellerId: seller._id }),
      AdOrder.deleteMany({ sellerId: seller._id }),
      Payment.deleteMany({ sellerId: seller._id }),
      Chat.deleteMany({ sellerId: seller._id }),
      Report.deleteMany({ sellerId: seller._id }),
      Seller.deleteOne({ _id: seller._id })
    ]);

    if (phone) {
      await BannedPhone.updateOne(
        { phone },
        { $set: { phone } },
        { upsert: true }
      );
    }

    res.json({ message: 'فروشنده با موفقیت حذف شد.' });
  } catch (err) {
    console.error('deleteSeller error:', err);
    res.status(500).json({ message: 'خطا در حذف فروشنده.', error: err.message });
  }
};

// ارتقای فروشنده به پلن انتخابی (معمولی یا پرمیوم)
exports.upgradeSeller = async (req, res) => {
  try {
    const sellerId = req.user && (req.user.id || req.user._id);
    const { planSlug, premium } = req.body || {};

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'احراز هویت نامعتبر است.' });
    }

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'فروشنده پیدا نشد.' });
    }

    if (premium) {
      const plan = await Plan.findOne({ slug: planSlug });
      if (!plan) {
        return res.status(404).json({ success: false, message: 'پلن موردنظر یافت نشد.' });
      }
      const now = new Date();
      const premiumUntil = calcPremiumUntil(plan.slug, now);
      seller.isPremium = true;
      seller.premiumUntil = premiumUntil;
      await SellerPlan.create({
        sellerId: seller._id,
        planSlug: plan.slug,
        planTitle: plan.title,
        price: plan.price,
        startDate: now,
        endDate: premiumUntil,
        status: 'active'
      });
    } else {
      seller.isPremium = false;
      seller.premiumUntil = null;
    }

    await seller.save();

    return res.json({ success: true, seller: { id: seller._id, isPremium: seller.isPremium, premiumUntil: seller.premiumUntil } });
  } catch (err) {
    console.error('upgradeSeller error:', err);
    res.status(500).json({ success: false, message: 'خطا در ارتقا حساب.' });
  }
};

exports.updateAdminScore = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const score = clampAdminScore(req.body?.score);
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (score === null) {
      return res.status(400).json({ message: 'نمره معتبر نیست. مقدار باید بین ۰ تا ۱۰۰ باشد.' });
    }

    const seller = await findSellerByFlexibleId(sellerId);
    if (!seller) {
      return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    }

    seller.adminScore = score;
    seller.adminScoreUpdatedAt = new Date();
    seller.adminScoreNote = note;
    seller.adminScoreMessage = message;
    const performance = evaluatePerformance(score);
    seller.performanceStatus = performance.status;

    await seller.save();

    const payload = buildPerformancePayload(seller, { includeNote: true });
    return res.json({
      message: 'نمره فروشنده با موفقیت ذخیره شد.',
      ...payload,
      sellerKey: payload.sellerId || (payload.shopurl ? `shopurl:${payload.shopurl}` : null)
    });
  } catch (err) {
    console.error('updateAdminScore error:', err);
    return res.status(500).json({ message: 'خطا در ثبت نمره فروشنده.' });
  }
};

exports.clearAdminScore = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const seller = await findSellerByFlexibleId(sellerId);

    if (!seller) {
      return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    }

    seller.adminScore = null;
    seller.adminScoreUpdatedAt = null;
    seller.adminScoreNote = '';
    seller.adminScoreMessage = '';
    seller.performanceStatus = 'unset';

    await seller.save();

    const payload = buildPerformancePayload(seller, { includeNote: true });
    return res.json({
      message: 'نمره فروشنده حذف شد.',
      ...payload,
      sellerKey: payload.sellerId || (payload.shopurl ? `shopurl:${payload.shopurl}` : null)
    });
  } catch (err) {
    console.error('clearAdminScore error:', err);
    return res.status(500).json({ message: 'خطا در حذف نمره فروشنده.' });
  }
};

exports.listSellerPerformance = async (req, res) => {
  try {
    const sellers = await Seller.find({}, 'storename shopurl adminScore adminScoreUpdatedAt performanceStatus adminScoreNote adminScoreMessage');

    const payload = sellers.map(seller => {
      const data = buildPerformancePayload(seller, { includeNote: true });
      return {
        ...data,
        sellerKey: data.sellerId || (data.shopurl ? `shopurl:${data.shopurl}` : null)
      };
    });

    return res.json(payload);
  } catch (err) {
    console.error('listSellerPerformance error:', err);
    return res.status(500).json({ message: 'خطا در دریافت وضعیت عملکرد فروشنده‌ها.' });
  }
};

exports.getCurrentSellerPerformanceStatus = async (req, res) => {
  try {
    const sellerId = req.user && (req.user.id || req.user._id);
    if (!sellerId) {
      return res.status(401).json({ message: 'برای مشاهده وضعیت عملکرد ابتدا وارد شوید.' });
    }

    const seller = await Seller.findById(sellerId)
      .select('storename firstname lastname shopurl adminScore adminScoreUpdatedAt performanceStatus adminScoreMessage');

    if (!seller) {
      return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    }

    const payload = buildPerformancePayload(seller);
    return res.json({
      ...payload,
      message: payload.adminScore == null
        ? 'هنوز نمره‌ای برای شما ثبت نشده است.'
        : 'آخرین وضعیت عملکرد شما با موفقیت بارگذاری شد.',
      sellerKey: payload.sellerId || (payload.shopurl ? `shopurl:${payload.shopurl}` : null)
    });
  } catch (err) {
    console.error('getCurrentSellerPerformanceStatus error:', err);
    return res.status(500).json({ message: 'خطا در دریافت وضعیت عملکرد.' });
  }
};
