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
