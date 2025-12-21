// backend/middlewares/authMiddleware.js
// ------------------------------------
// Middleware احراز هویت با پشتیبانی از سه نقشِ user / seller / admin
// اگر   requiredRole = null   باشد، هرکدام از توکن‌های معتبر را می‌پذیرد.
// ------------------------------------

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "vitrinet_secret_key";

const User        = require('../models/user');          // ← مدل کاربر
const BannedPhone = require('../models/BannedPhone');   // ← لیست سیاه شماره‌ها
const Seller      = require('../models/Seller');        // ← مدل فروشنده
const { buildPhoneCandidates } = require('../utils/phone');

const normalizeRole = (role) => {
  if (role == null) return '';
  const value = String(role).trim().toLowerCase();
  if (!value) return '';
  if (value === 'service-seller' || value === 'serviceseller') return 'seller';
  if (value === 'service-user' || value === 'serviceuser' || value === 'service-customer') return 'user';
  if (value === 'seller' || value === 'user' || value === 'admin') return value;
  return value;
};

/**
 * Check if user has seller access based on role and userType
 * userType: 'both' means the user is also a seller
 */
const hasSellerAccess = (payload) => {
  const role = normalizeRole(payload.role);
  const userType = String(payload.userType || '').trim().toLowerCase();
  
  // Direct seller role
  if (role === 'seller') return true;
  
  // User with userType 'both' or 'seller' has seller access
  if (userType === 'both' || userType === 'seller') return true;
  
  return false;
};

/**
 * @param {'admin'|'seller'|'user'|null} requiredRole
 *  └─ اگر null باشد، فقط اعتبارِ توکن بررسی می‌شود؛
 *     در غیر این صورت، علاوه بر اعتبار، نقش هم باید منطبق باشد.
 */
const createAuthMiddleware = (requiredRole = null) => {
  return async (req, res, next) => {
  
    let token = null;

    // DEBUG: Log incoming request details
    console.log(`\n🔐 [AuthMiddleware] ═══════════════════════════════════════`);
    console.log(`🔐 [AuthMiddleware] Request: ${req.method} ${req.originalUrl}`);
    console.log(`🔐 [AuthMiddleware] Required Role: ${requiredRole || 'any'}`);
    console.log(`🔐 [AuthMiddleware] Authorization Header: ${req.headers.authorization ? 'Present' : 'Missing'}`);
    
    // 1) اولویت با هدر Authorization
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
      console.log(`🔐 [AuthMiddleware] Token source: Authorization Header`);
      console.log(`🔐 [AuthMiddleware] Token preview: ${token.substring(0, 20)}...`);
    }

    // 2) سپس بر اساس نقش کوکی را چک کن
    if (!token && req.cookies) {
      console.log(`🔐 [AuthMiddleware] No header token, checking cookies...`);
      console.log(`🔐 [AuthMiddleware] Available cookies: ${Object.keys(req.cookies || {}).join(', ') || 'none'}`);
      
      if (requiredRole === 'admin') {
        token = req.cookies.admin_token || req.cookies.access_token;
      } else if (requiredRole === 'seller') {
        token = req.cookies.seller_token;
      } else if (requiredRole === 'user') {
        token = req.cookies.user_token;
      }
      // اگر نقش مشخص نبود (requiredRole = null)، همهٔ کوکی‌های ممکن را امتحان کن
      if (!token && !requiredRole) {
        token =
          req.cookies.user_token   ||
          req.cookies.seller_token ||
          req.cookies.admin_token  ||
          req.cookies.access_token ||
          null;
      }
      if (token) {
        console.log(`🔐 [AuthMiddleware] Token source: Cookie`);
      }
    }

    // 3) اگر هنوز توکن نداریم → 401
    if (!token) {
      console.warn('🔐 [AuthMiddleware] ⛔ No token found. Rejecting with 401.');
      return res.status(401).json({ message: 'شما لاگین نکرده‌اید.' });
    }


    // ۵) اعتبارسنجی و بررسی نقش
   try {
  /* ۱) اعتبارسنجی JWT */
  const payload = jwt.verify(token, JWT_SECRET);
  console.log(`🔐 [AuthMiddleware] Token decoded successfully`);
  console.log(`🔐 [AuthMiddleware] Payload ID: ${payload.id}`);
  console.log(`🔐 [AuthMiddleware] Payload Role: ${payload.role}`);
  console.log(`🔐 [AuthMiddleware] Payload userType: ${payload.userType || 'not set'}`);
  
  const payloadRole = normalizeRole(payload.role);
  const requiredRoleNormalized = normalizeRole(requiredRole);
  
  console.log(`🔐 [AuthMiddleware] Normalized payload role: ${payloadRole}`);
  console.log(`🔐 [AuthMiddleware] Normalized required role: ${requiredRoleNormalized}`);

  /* ۲) بررسی نقش - با پشتیبانی از userType: 'both' */
  let roleMatches = false;
  
  if (!requiredRole) {
    // No specific role required
    roleMatches = true;
  } else if (requiredRoleNormalized === 'seller') {
    // For seller routes, check both role AND userType
    roleMatches = hasSellerAccess(payload);
    console.log(`🔐 [AuthMiddleware] Seller access check: ${roleMatches}`);
  } else {
    // For other roles (admin, user), strict match
    roleMatches = payloadRole === requiredRoleNormalized;
  }
  
  if (!roleMatches) {
    console.warn(`🔐 [AuthMiddleware] ⛔ Role mismatch! Expected: ${requiredRoleNormalized}, Got: ${payloadRole}, userType: ${payload.userType}`);
    return res.status(403).json({ message: 'دسترسی غیرمجاز.' });
  }

  /* ۳) ردِ فوری کاربر یا شمارهٔ مسدود */
  if (payloadRole === 'user' && requiredRoleNormalized !== 'seller') {
    // Only check user ban if not accessing seller routes with userType: 'both'
    const u = await User.findById(payload.id).select('deleted phone');
    const phoneVariants = buildPhoneCandidates(u?.phone);
    const isBannedPhone = phoneVariants.length
      ? await BannedPhone.findOne({ phone: { $in: phoneVariants } })
      : null;
    if (!u || u.deleted || isBannedPhone) {
      console.warn(`🔐 [AuthMiddleware] ⛔ User blocked or deleted`);
      return res.status(403).json({ message: 'دسترسی شما مسدود شده است.' });
    }
  }
  
  // For seller routes, verify seller exists in database
  if (requiredRoleNormalized === 'seller' && hasSellerAccess(payload)) {
    const s = await Seller.findById(payload.id).select('_id');
    if (!s) {
      console.warn(`🔐 [AuthMiddleware] ⛔ Seller not found in database: ${payload.id}`);
      return res.status(403).json({ message: 'حساب فروشنده یافت نشد.' });
    }
    console.log(`🔐 [AuthMiddleware] ✅ Seller verified in database`);
  }

  /* ۴) تزریق اطلاعات کاربر و ادامهٔ زنجیره */
  // For seller routes with userType: 'both', treat as seller
  const effectiveRole = (requiredRoleNormalized === 'seller' && hasSellerAccess(payload)) 
    ? 'seller' 
    : (payloadRole || (typeof payload.role === 'string' ? payload.role.trim().toLowerCase() : payload.role));
  
  req.user = { id: payload.id, _id: payload.id, role: effectiveRole, userType: payload.userType };
  console.log(`🔐 [AuthMiddleware] ✅ Auth successful - effective role: ${effectiveRole}`);
  console.log(`🔐 [AuthMiddleware] ═══════════════════════════════════════\n`);
  next();

} catch (err) {
  console.error('🔐 [AuthMiddleware] ❌ Token verification failed:', err.message || err);
  return res.status(401).json({ message: 'توکن نامعتبر یا منقضی‌شده است.' });
}

  };
};

const authMiddleware = createAuthMiddleware;
authMiddleware.protect = createAuthMiddleware('user');

module.exports = authMiddleware;
