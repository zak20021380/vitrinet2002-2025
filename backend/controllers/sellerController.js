const Seller = require('../models/Seller');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Product = require('../models/product');
const ShopAppearance = require('../models/ShopAppearance');
const SellerPlan = require('../models/sellerPlan');
const AdOrder = require('../models/AdOrder');
const Payment = require('../models/payment');
const Chat = require('../models/chat');
const Report = require('../models/Report');
const BannedPhone = require('../models/BannedPhone');

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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { sellerId } = req.params;
    const seller = await Seller.findById(sellerId).session(session);
    if (!seller) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    }

    const phone = seller.phone;

    await Promise.all([
      Product.deleteMany({ sellerId: seller._id }).session(session),
      ShopAppearance.deleteMany({ sellerId: seller._id }).session(session),
      SellerPlan.deleteMany({ sellerId: seller._id }).session(session),
      AdOrder.deleteMany({ sellerId: seller._id }).session(session),
      Payment.deleteMany({ sellerId: seller._id }).session(session),
      Chat.deleteMany({ sellerId: seller._id }).session(session),
      Report.deleteMany({ sellerId: seller._id }).session(session),
    ]);

    await Seller.deleteOne({ _id: seller._id }).session(session);

    if (phone) {
      await BannedPhone.updateOne(
        { phone },
        { $set: { phone } },
        { upsert: true, session }
      );
    }

    await session.commitTransaction();
    session.endSession();
    res.json({ message: 'فروشنده با موفقیت حذف شد.' });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('deleteSeller error:', err);
    res.status(500).json({ message: 'خطا در حذف فروشنده.', error: err.message });
  }
};
