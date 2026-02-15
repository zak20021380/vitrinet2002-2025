// backend/middlewares/authMiddleware.js
// ------------------------------------
// Middleware احراز هویت با پشتیبانی از User / Seller / Admin / Dual-Role
// نسخه تمیز و نهایی (بدون کدهای تعمیر اضطراری)
// ------------------------------------

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "vitrinet_secret_key";

const User = require('../models/user');           // مدل کاربر
const BannedPhone = require('../models/BannedPhone'); // لیست سیاه
const Seller = require('../models/Seller');       // مدل فروشنده

// --- توابع کمکی داخلی ---

// ۱. نرمال‌سازی نقش‌ها
const normalizeRole = (role) => {
  if (role == null) return '';
  const value = String(role).trim().toLowerCase();
  if (!value) return '';
  if (value === 'service-seller' || value === 'serviceseller') return 'seller';
  if (value === 'service-user' || value === 'serviceuser' || value === 'service-customer') return 'user';
  return value;
};

// ۲. ساخت حالت‌های مختلف شماره موبایل
const buildPhoneCandidates = (rawPhone) => {
  if (!rawPhone) return [];
  const p = String(rawPhone).trim();
  const candidates = new Set();
  candidates.add(p); 

  if (p.startsWith('0')) {
    const noZero = p.substring(1);
    candidates.add(noZero);
    candidates.add('+98' + noZero);
    candidates.add('98' + noZero);
  } else if (p.startsWith('+98')) {
    const core = p.substring(3);
    candidates.add('0' + core);
    candidates.add(core);
  } else if (p.startsWith('98')) {
    const core = p.substring(2);
    candidates.add('0' + core);
    candidates.add('+98' + core);
  } else {
    candidates.add('0' + p);
    candidates.add('+98' + p);
  }
  return Array.from(candidates);
};

// ۳. بررسی دسترسی فروشنده
const hasSellerAccess = (payload) => {
  const role = normalizeRole(payload.role);
  const userType = String(payload.userType || '').trim().toLowerCase();
  
  // Admin has unrestricted access
  if (role === 'admin') return true;
  if (role === 'seller') return true;
  if (userType === 'both' || userType === 'seller') return true;
  
  return false;
};

/**
 * تابع اصلی میدل‌ور
 */
const createAuthMiddleware = (requiredRole = null) => {
  return async (req, res, next) => {
    let token = null;

    // ۱) دریافت توکن از هدر
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // ۲) دریافت توکن از کوکی
    if (!token && req.cookies) {
      if (requiredRole === 'admin') {
        token = req.cookies.admin_token || req.cookies.access_token;
      } else if (requiredRole === 'seller') {
        // برای مسیرهای فروشنده، هم seller_token و هم user_token رو چک کن
        // چون کاربران با userType=both میتونن از هر دو توکن استفاده کنن
        token = req.cookies.seller_token || req.cookies.user_token;
      } else if (requiredRole === 'user') {
        token = req.cookies.user_token;
      }
      if (!token && !requiredRole) {
        token = req.cookies.seller_token || req.cookies.user_token || req.cookies.admin_token;
      }
    }

    // ۳) اگر توکن نیست -> 401
    if (!token) {
      return res.status(401).json({ message: 'لطفا وارد حساب خود شوید.' });
    }

    try {
      // ۴) اعتبارسنجی توکن
      const payload = jwt.verify(token, JWT_SECRET);
      
      const payloadRole = normalizeRole(payload.role);
      const requiredRoleNormalized = normalizeRole(requiredRole);
      
      // ۵) گارد امنیتی مسیرهای فروشنده
      if (req.originalUrl.includes('/api/seller')) {
        // Admin has unrestricted access to all endpoints
        if (payloadRole === 'admin') {
          // Allow admin to proceed
        } else if (!hasSellerAccess(payload)) {
          // console.warn(`🔐 [AuthCheck] Blocked non-seller accessing seller route: ${payloadRole}`);
          return res.status(403).json({ message: 'دسترسی فروشنده مورد نیاز است.' });
        }
      }

      // ۶) بررسی انطباق نقش
      if (requiredRoleNormalized) {
        // Admin has unrestricted access to all endpoints
        if (payloadRole === 'admin') {
          // Allow admin to proceed
        } else {
          let isAuthorized = false;
          if (requiredRoleNormalized === 'seller') {
            isAuthorized = hasSellerAccess(payload);
          } else {
            isAuthorized = payloadRole === requiredRoleNormalized;
          }

          if (!isAuthorized) {
            return res.status(403).json({ message: 'سطح دسترسی شما کافی نیست.' });
          }
        }
      }

      // ۷) چک کردن لیست سیاه
      if (payloadRole === 'user' && !hasSellerAccess(payload)) {
        const u = await User.findById(payload.id).select('deleted phone');
        if (u) {
           const phones = buildPhoneCandidates(u.phone);
           const isBanned = await BannedPhone.findOne({ phone: { $in: phones } });
           if (u.deleted || isBanned) {
             return res.status(403).json({ message: 'حساب کاربری شما مسدود شده است.' });
           }
        }
      }

      // =========================================================
      // ۸) حل‌وفصل آیدی فروشنده (بدون تعمیر خودکار)
      // =========================================================
      let resolvedSellerId = null;

      if (requiredRoleNormalized === 'seller' && hasSellerAccess(payload)) {
        
        // Admin bypass: skip seller resolution for admin users
        if (payloadRole === 'admin') {
          // Admin doesn't need seller ID resolution
        } else {
          // الف) تلاش اول: جستجو با آیدی مستقیم
          let sellerDoc = await Seller.findById(payload.id).select('_id phone');

          // ب) تلاش دوم: جستجو با شماره موبایل کاربر
          if (!sellerDoc && payloadRole !== 'seller') {
            const u = await User.findById(payload.id).select('phone deleted');
            if (u && u.phone && !u.deleted) {
               const phones = buildPhoneCandidates(u.phone);
               sellerDoc = await Seller.findOne({ phone: { $in: phones } }).select('_id phone');
            }
          }

          if (!sellerDoc) {
            console.warn(`🔐 [AuthMiddleware] ⛔ CRITICAL: Seller not found for payload.id=${payload.id}`);
            return res.status(403).json({ message: 'فروشگاهی برای این حساب کاربری یافت نشد.' });
          }
          
          resolvedSellerId = sellerDoc._id;
        }
      }

      // ۹) تزریق اطلاعات به req.user
      const finalId = resolvedSellerId || payload.id;
      const finalRole = (requiredRoleNormalized === 'seller') ? 'seller' : payloadRole;

      req.user = {
        id: finalId,           // آیدی نهایی
        _id: finalId,          
        role: finalRole,       
        userType: payload.userType,
        authId: payload.id,    
        phone: payload.phone
      };

      next();

    } catch (err) {
      console.error('🔐 [AuthMiddleware] Token Error:', err.message);
      return res.status(401).json({ message: 'توکن نامعتبر است.' });
    }
  };
};

const authMiddleware = createAuthMiddleware;
authMiddleware.protect = createAuthMiddleware('user');

module.exports = authMiddleware;