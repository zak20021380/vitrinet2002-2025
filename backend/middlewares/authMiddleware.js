// backend/middlewares/authMiddleware.js
// ------------------------------------
// Middleware احراز هویت با پشتیبانی از سه نقشِ user / seller / admin
// اگر   requiredRole = null   باشد، هرکدام از توکن‌های معتبر را می‌پذیرد.
// ------------------------------------

const jwt = require('jsonwebtoken');
const JWT_SECRET = "vitrinet_secret_key";

const User        = require('../models/user');          // ← مدل کاربر
const BannedPhone = require('../models/BannedPhone');   // ← لیست سیاه شماره‌ها
const Seller      = require('../models/Seller');        // ← مدل فروشنده

/**
 * @param {'admin'|'seller'|'user'|null} requiredRole
 *  └─ اگر null باشد، فقط اعتبارِ توکن بررسی می‌شود؛
 *     در غیر این صورت، علاوه بر اعتبار، نقش هم باید منطبق باشد.
 */
module.exports = (requiredRole = null) => {
  return async (req, res, next) => {
  
    let token = null;

    // 1) اولویت با هدر Authorization
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // 2) سپس بر اساس نقش کوکی را چک کن
    if (!token && req.cookies) {
      if (requiredRole === 'admin') {
        token = req.cookies.admin_token || req.cookies.access_token;
      } else if (requiredRole === 'seller') {
        token = req.cookies.seller_token;
      } else if (requiredRole === 'user') {
        token = req.cookies.user_token;
      }
      // اگر نقش مشخص نبود (requiredRole = null)، همهٔ کوکی‌های ممکن را امتحان کن
      if (!token && !requiredRole) {
        // در حالت بدون نقش، اگر کاربر هم‌زمان چند توکن داشته باشد
        // اولویت با نقش‌های بالاتر است تا ادمین به اشتباه کاربر عادی
        // شناسایی نشود
        token =
          req.cookies.user_token   ||
          req.cookies.seller_token ||
          req.cookies.admin_token  ||
          req.cookies.access_token ||
          null;
      }
    }

    // 3) اگر هنوز توکن نداریم → 401
    if (!token) {
      console.warn('⛔ No token found. Rejecting request.');
      return res.status(401).json({ message: 'شما لاگین نکرده‌اید.' });
    }


    // ۵) اعتبارسنجی و بررسی نقش
   try {
  /* ۱) اعتبارسنجی JWT */
  const payload = jwt.verify(token, JWT_SECRET);

  /* ۲) عدم تطابق نقش ـ اگر route نقش خاصی بخواهد */
  if (requiredRole && payload.role !== requiredRole) {
    console.warn(`⛔ Role mismatch. Expected: ${requiredRole}, Got: ${payload.role}`);
    return res.status(403).json({ message: 'دسترسی غیرمجاز.' });
  }

  /* ۳) ردِ فوری کاربر یا شمارهٔ مسدود */
  if (payload.role === 'user') {
    const u = await User.findById(payload.id).select('deleted phone');
    if (!u || u.deleted || await BannedPhone.findOne({ phone: u.phone })) {
      return res.status(403).json({ message: 'دسترسی شما مسدود شده است.' });
    }
  }
  if (payload.role === 'seller') {
    const s = await Seller.findById(payload.id).select('phone blockedByAdmin');
    if (!s || s.blockedByAdmin || await BannedPhone.findOne({ phone: s.phone })) {
      return res.status(403).json({ message: 'دسترسی شما مسدود شده است.' });
    }
  }

  /* ۴) تزریق اطلاعات کاربر و ادامهٔ زنجیره */
  req.user = { id: payload.id, _id: payload.id, role: payload.role };
  next();

} catch (err) {
  console.error('❌ Token verification failed:', err.message || err);
  return res.status(401).json({ message: 'توکن نامعتبر یا منقضی‌شده است.' });
}

  };
};
