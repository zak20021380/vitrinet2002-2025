const User        = require('../models/user');
const Block       = require('../models/Block');          // قبلاً خواسته شده بود
const BannedPhone = require('../models/BannedPhone');    // لیست دائمی شماره‌های مسدود
const Seller      = require('../models/Seller');
const Report      = require('../models/Report');

// ────────────────────────────────────────────────────────────
// گرفتن پروفایل کاربر همراه با علاقه‌مندی‌ها پس از احراز هویت
// ────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user && req.user.id;

    if (!userId) {
      return res.status(401).json({ message: 'شما وارد نشده‌اید.' });
    }

    const user = await User.findById(userId)
      .select('firstname lastname phone favorites')
      .populate({
        path: 'favorites',
        select: 'title images price sellerId'
      });

    if (!user) {
      return res.status(404).json({ message: 'کاربر پیدا نشد.' });
    }

    res.json({
      firstname : user.firstname || '',
      lastname  : user.lastname  || '',
      phone     : user.phone     || '',
      favorites : user.favorites || []
    });

  } catch (err) {
    console.error('خطای گرفتن پروفایل:', err);
    res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

// ────────────────────────────────────────────────────────────
// مسدودسازی مشتری توسط فروشنده (قبلی)
// ────────────────────────────────────────────────────────────
exports.blockCustomer = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason = '' } = req.body || {};
    if (!userId) return res.status(400).json({ message: 'شناسه کاربر ارسال نشده!' });

    const sellerId = req.user && req.user.id;
    if (!sellerId) return res.status(401).json({ message: 'فروشنده احراز هویت نشد.' });

    const seller = await Seller.findById(sellerId);
    if (!seller) return res.status(404).json({ message: 'فروشنده پیدا نشد.' });

    if (seller.blockedUsers && seller.blockedUsers.some(id => id.toString() === userId)) {
      return res.status(400).json({ message: 'این کاربر قبلاً مسدود شده.' });
    }

    seller.blockedUsers = seller.blockedUsers || [];
    seller.blockedUsers.push(userId);
    await seller.save();

    const sanitized = (reason || '').replace(/<[^>]*>?/g, '');

    await Block.create({ sellerId, customerId: userId, reason: sanitized });

    await Report.create({
      sellerId,
      userId,
      type: 'block',
      description: sanitized,
      ip: req.ip
    });

    res.json({ message: 'کاربر با موفقیت مسدود شد.' });
  } catch (err) {
    res.status(500).json({ message: 'خطا در مسدودسازی', error: err.message });
  }
};

// ────────────────────────────────────────────────────────────
// آزادسازی مشتری مسدود شده توسط فروشنده
// ────────────────────────────────────────────────────────────
exports.unblockCustomer = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: 'شناسه کاربر ارسال نشده!' });

    const sellerId = req.user && req.user.id;
    if (!sellerId) return res.status(401).json({ message: 'فروشنده احراز هویت نشد.' });

    const seller = await Seller.findById(sellerId);
    if (!seller) return res.status(404).json({ message: 'فروشنده پیدا نشد.' });

    seller.blockedUsers = seller.blockedUsers || [];
    const idx = seller.blockedUsers.findIndex(id => id.toString() === userId);
    if (idx === -1) {
      return res.status(404).json({ message: 'این کاربر در لیست مسدود نیست.' });
    }

    seller.blockedUsers.splice(idx, 1);
    await seller.save();

    await Block.deleteOne({ sellerId, customerId: userId });

    res.json({ message: 'کاربر با موفقیت آزاد شد.' });
  } catch (err) {
    res.status(500).json({ message: 'خطا در آزادسازی', error: err.message });
  }
};

// ────────────────────────────────────────────────────────────
// حذف نرمِ کاربر توسط ادمین  ➜  /user/:id   [DELETE]
// ────────────────────────────────────────────────────────────
exports.softDelete = async (req, res) => {
  try {
    const { id } = req.params;                // شناسه کاربر از URL
    const user   = await User.findById(id);

    if (!user)
      return res.status(404).json({ message: 'کاربر پیدا نشد.' });

    if (user.deleted)
      return res.status(400).json({ message: 'این کاربر قبلاً حذف شده است.' });

    // نشانه‌گذاری حذف نرم
    user.deleted   = true;
    user.deletedAt = new Date();
    await user.save();

    // ثبت یا به‌روزرسانی شماره در لیست ممنوعه
    // Only add to BannedPhone if phone exists and is not empty
    if (user.phone && String(user.phone).trim()) {
      await BannedPhone.updateOne(
        { phone: user.phone },
        { $set: { phone: user.phone } },
        { upsert: true }
      );
    }

    res.json({ message: 'کاربر با موفقیت حذف و مسدود شد.' });
  } catch (err) {
    console.error('softDelete error:', err);
    res.status(500).json({ message: 'خطا در حذف کاربر.', error: err.message });
  }
};
