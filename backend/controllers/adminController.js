// controllers/adminController.js

const Admin    = require('../models/admin');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

// کلید سری JWT از .env خوانده می‌شود وگرنه مقدار پیش‌فرض
const JWT_SECRET = "vitrinet_secret_key";
/**
 * ثبت‌نام ادمین جدید
 */
exports.register = async (req, res) => {
  try {
    const { phone, password, name } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: 'شماره موبایل و رمز عبور الزامی است.' });
    }

    const exists = await Admin.findOne({ phone });
    if (exists) {
      return res.status(400).json({ message: 'این شماره قبلاً ثبت شده.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = new Admin({ phone, password: hashedPassword, name });
    await admin.save();

    res.status(201).json({ message: 'ادمین با موفقیت ثبت شد.' });
  } catch (err) {
    console.error('❌ register admin error:', err);
    res.status(500).json({ message: 'خطا در ثبت ادمین.', error: err.message });
  }
};

/**
 * لاگین ادمین
 */

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: 'شماره موبایل و رمز عبور الزامی است.' });
    }

    const admin = await Admin.findOne({ phone });
    if (!admin) {
      return res.status(401).json({ message: 'ادمینی با این شماره یافت نشد.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'رمز عبور اشتباه است.' });
    }

    // ساخت توکن JWT با payload شامل id و نقش
    const token = jwt.sign(
      { id: admin._id, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '3d' }
    );

    // ست کردن کوکی HttpOnly (اختیاری اگر فقط با LocalStorage کار می‌کنید)
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3 * 24 * 60 * 60 * 1000
    });

    // برگرداندن توکن و اطلاعات ادمین
    return res.json({
      token,
      admin: {
        id:    admin._id,
        phone: admin.phone,
        name:  admin.name
      }
    });

  } catch (err) {
    console.error('❌ login admin error:', err);
    res.status(500).json({ message: 'ورود ناموفق.', error: err.message });
  }
};
/**
 * پروفایل ادمین (با middleware احراز هویت باید req.user.id ست شده باشد)
 */
exports.profile = async (req, res) => {
  try {
    // در authMiddleware ما req.user.id را ست می‌کنیم
    const adminId = req.user && req.user.id;
    if (!adminId) {
      return res.status(401).json({ message: 'عدم احراز هویت.' });
    }

    const admin = await Admin.findById(adminId).select('-password');
    if (!admin) {
      return res.status(404).json({ message: 'ادمین یافت نشد.' });
    }

    res.json({ 
      id:    admin._id,
      phone: admin.phone,
      name:  admin.name,
      createdAt: admin.createdAt
    });
  } catch (err) {
    console.error('❌ get admin profile error:', err);
    res.status(500).json({ message: 'خطا در دریافت پروفایل.', error: err.message });
  }
};
