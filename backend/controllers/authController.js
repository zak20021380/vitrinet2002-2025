const Seller = require('../models/Seller');
const ShopAppearance = require('../models/ShopAppearance');
const Category = require('../models/Category');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'vitrinet_secret_key';
const User = require('../models/user');
const Admin = require('../models/admin'); // اگه مدل جدا داری
const BannedPhone = require('../models/BannedPhone');     // ⬅︎ مدل لیست سیاه
const { buildPhoneCandidates } = require('../utils/phone');

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const OTP_LENGTH = 5;
const OTP_TTL_MS = 3 * 60 * 1000;
const USER_OTP_REQUEST_SUCCESS_MESSAGE = 'کد تایید پیامک شد.';
const USER_OTP_VERIFY_FAILURE_MESSAGE = 'کد تایید اشتباه است یا منقضی شده.';
const OTP_HASH_SECRET = process.env.OTP_HASH_SECRET || JWT_SECRET;
const USER_ACCESS_TOKEN_TTL = '15m';
const USER_ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const USER_REFRESH_TOKEN_TTL = '7d';
const USER_REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SELLER_ACCESS_TOKEN_TTL = '7d';
const SELLER_ACCESS_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SELLER_REFRESH_TOKEN_TTL = '14d';
const SELLER_REFRESH_TOKEN_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const USER_SESSION_MARKER = 'cookie-session';
const OTP_REQUEST_WINDOW_MS = 10 * 60 * 1000;
const OTP_REQUEST_MAX_PER_WINDOW = 5;
const OTP_REQUEST_MIN_INTERVAL_MS = 30 * 1000;
const OTP_VERIFY_LOCKOUT_THRESHOLD = 5;
const OTP_VERIFY_LOCKOUT_MS = 10 * 60 * 1000;
const OTP_VERIFY_BACKOFF_BASE_MS = 1000;
const OTP_VERIFY_BACKOFF_MAX_MS = 60 * 1000;
const otpRequestState = new Map();
const otpVerifyState = new Map();
const DEV_STATIC_OTP = '12345';

function getSecureCookieFlag(req) {
  if (process.env.NODE_ENV === 'production') return true;
  if (req?.secure) return true;
  return false;
}

function getCookieBaseOptions(req) {
  return {
    httpOnly: true,
    secure: getSecureCookieFlag(req),
    sameSite: 'strict',
    path: '/'
  };
}

function issueUserSession(req, res, user) {
  const sessionId = crypto.randomBytes(24).toString('hex');

  const accessToken = jwt.sign(
    {
      id: user._id,
      role: 'user',
      userType: user.userType || 'both',
      sid: sessionId,
      type: 'access'
    },
    JWT_SECRET,
    { expiresIn: USER_ACCESS_TOKEN_TTL }
  );

  const refreshToken = jwt.sign(
    {
      id: user._id,
      role: 'user',
      userType: user.userType || 'both',
      sid: sessionId,
      type: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: USER_REFRESH_TOKEN_TTL }
  );

  const cookieBase = getCookieBaseOptions(req);

  res.cookie('user_token', accessToken, {
    ...cookieBase,
    maxAge: USER_ACCESS_TOKEN_MAX_AGE_MS
  });
  res.cookie('user_refresh_token', refreshToken, {
    ...cookieBase,
    maxAge: USER_REFRESH_TOKEN_MAX_AGE_MS
  });
  res.cookie('user_session_id', sessionId, {
    ...cookieBase,
    maxAge: USER_REFRESH_TOKEN_MAX_AGE_MS
  });

  return USER_SESSION_MARKER;
}

function issueSellerSession(req, res, seller) {
  const sessionId = crypto.randomBytes(24).toString('hex');

  const accessToken = jwt.sign(
    {
      id: seller._id.toString(),
      role: 'seller',
      userType: seller.userType || 'both',
      sid: sessionId,
      type: 'access'
    },
    JWT_SECRET,
    { expiresIn: SELLER_ACCESS_TOKEN_TTL }
  );

  const refreshToken = jwt.sign(
    {
      id: seller._id.toString(),
      role: 'seller',
      userType: seller.userType || 'both',
      sid: sessionId,
      type: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: SELLER_REFRESH_TOKEN_TTL }
  );

  const cookieBase = getCookieBaseOptions(req);

  res.cookie('seller_token', accessToken, {
    ...cookieBase,
    maxAge: SELLER_ACCESS_TOKEN_MAX_AGE_MS
  });
  res.cookie('seller_refresh_token', refreshToken, {
    ...cookieBase,
    maxAge: SELLER_REFRESH_TOKEN_MAX_AGE_MS
  });
  res.cookie('seller_session_id', sessionId, {
    ...cookieBase,
    maxAge: SELLER_REFRESH_TOKEN_MAX_AGE_MS
  });

  return USER_SESSION_MARKER;
}

function toEnglishDigits(value = '') {
  return String(value || '')
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

function normalizeIranianPhone(value) {
  const digits = toEnglishDigits(value).replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 11 && digits.startsWith('0')) return digits;
  if (digits.length === 10 && digits.startsWith('9')) return `0${digits}`;
  if (digits.length === 12 && digits.startsWith('98')) return `0${digits.slice(2)}`;
  if (digits.length === 14 && digits.startsWith('0098')) return `0${digits.slice(4)}`;

  return '';
}

function validateIranianPhone(phone) {
  return /^09\d{9}$/.test(normalizeIranianPhone(phone));
}

function normalizeStrictIranianPhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^[0-9۰-۹٠-٩+\-\s()]+$/.test(raw)) return '';
  return normalizeIranianPhone(raw);
}

const SELLER_NAME_ALLOWED_REGEX = /^[\u0621-\u063A\u0641-\u064A\u066E-\u06D3\u06D5\u06E5-\u06E6\u06EE-\u06EF\u06FA-\u06FC\u06FF\s]+$/;
const SELLER_STORE_ALLOWED_REGEX = /^[\u0621-\u063A\u0641-\u064A\u066E-\u06D3\u06D5\u06E5-\u06E6\u06EE-\u06EF\u06FA-\u06FC\u06FF0-9\u06F0-\u06F9\u0660-\u0669\s]+$/;
const SELLER_CATEGORY_ALLOWED_REGEX = /^[\u0600-\u06FF0-9\u06F0-\u06F9\u0660-\u0669\s()\-،,.]{2,60}$/;
const SELLER_ADDRESS_ALLOWED_REGEX = /^[\u0600-\u06FF0-9\u06F0-\u06F9\u0660-\u0669\s.,،\-\/]{5,200}$/;
const SELLER_DESCRIPTION_ALLOWED_REGEX = /^[\u0600-\u06FF0-9\u06F0-\u06F9\u0660-\u0669\s.,،\-!?()]{0,500}$/;
const REFERRAL_CODE_ALLOWED_REGEX = /^[A-Za-z0-9_-]{4,32}$/;
const PASSWORD_POLICY_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])[^\s]{8,64}$/;
const PASSWORD_BCRYPT_MAX_LENGTH = 64;

function normalizeSellerText(value, { maxLength = 0 } = {}) {
  const raw = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  let normalized = raw
    .normalize('NFKC')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (maxLength > 0) {
    normalized = normalized.slice(0, maxLength);
  }

  return normalized;
}

function isValidSellerName(value) {
  const normalized = normalizeSellerText(value, { maxLength: 50 });
  return normalized.length >= 2
    && normalized.length <= 50
    && SELLER_NAME_ALLOWED_REGEX.test(normalized);
}

function isValidSellerStoreName(value) {
  const normalized = normalizeSellerText(value, { maxLength: 80 });
  return normalized.length >= 2
    && normalized.length <= 80
    && SELLER_STORE_ALLOWED_REGEX.test(normalized);
}

function normalizeSellerCategory(value) {
  return normalizeSellerText(value, { maxLength: 60 });
}

function isValidSellerCategory(value) {
  const normalized = normalizeSellerCategory(value);
  return SELLER_CATEGORY_ALLOWED_REGEX.test(normalized);
}

function normalizeSellerAddress(value) {
  return normalizeSellerText(value, { maxLength: 200 });
}

function isValidSellerAddress(value) {
  const normalized = normalizeSellerAddress(value);
  return SELLER_ADDRESS_ALLOWED_REGEX.test(normalized);
}

function normalizeSellerDescription(value) {
  return normalizeSellerText(value, { maxLength: 500 });
}

function isValidSellerDescription(value) {
  const normalized = normalizeSellerDescription(value);
  return SELLER_DESCRIPTION_ALLOWED_REGEX.test(normalized);
}

function normalizeReferralCode(value) {
  const normalized = normalizeSellerText(value, { maxLength: 32 });
  return normalized.replace(/\s+/g, '');
}

function isValidReferralCode(value) {
  if (!value) return true;
  return REFERRAL_CODE_ALLOWED_REGEX.test(value);
}

function isStrongPassword(value) {
  if (typeof value !== 'string') return false;
  if (value.length > PASSWORD_BCRYPT_MAX_LENGTH) return false;
  return PASSWORD_POLICY_REGEX.test(value);
}

function slugifyCategoryName(value = '') {
  return normalizeSellerCategory(value)
    .replace(/\s+/g, '-')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
    .toLowerCase();
}

async function validateCategoryAndSubcategoryPair(category, subcategory) {
  const hasCategories = await Category.exists({ type: 'category' });
  if (!hasCategories) {
    return {
      valid: true,
      normalizedCategory: category,
      normalizedSubcategory: subcategory || ''
    };
  }

  const categorySlug = slugifyCategoryName(category);
  const matchedCategory = await Category.findOne({
    type: 'category',
    slug: categorySlug
  }).select('name _id').lean();

  if (!matchedCategory) {
    return { valid: false, message: 'دسته‌بندی انتخابی معتبر نیست.' };
  }

  const serviceSubcategories = await Category.find({
    type: 'service-subcategory',
    $or: [
      { parentCategory: matchedCategory._id },
      { parentName: matchedCategory.name }
    ]
  }).select('name slug').lean();

  if (!serviceSubcategories.length) {
    if (subcategory) {
      return { valid: false, message: 'برای این دسته‌بندی نیازی به زیرگروه نیست.' };
    }
    return {
      valid: true,
      normalizedCategory: matchedCategory.name,
      normalizedSubcategory: ''
    };
  }

  if (!subcategory) {
    return { valid: false, message: 'انتخاب زیرگروه الزامی است.' };
  }

  const subcategorySlug = slugifyCategoryName(subcategory);
  const matchedSubcategory = serviceSubcategories.find((item) => item.slug === subcategorySlug);

  if (!matchedSubcategory) {
    return { valid: false, message: 'زیرگروه انتخابی معتبر نیست.' };
  }

  return {
    valid: true,
    normalizedCategory: matchedCategory.name,
    normalizedSubcategory: matchedSubcategory.name
  };
}

function normalizeSellerRegistrationPhone(value) {
  const raw = String(value || '').trim();
  if (!raw || !/^[0-9۰-۹٠-٩]{11}$/.test(raw)) return '';
  const normalized = toEnglishDigits(raw);
  return /^09\d{9}$/.test(normalized) ? normalized : '';
}

function normalizeStrictOtp(value) {
  const raw = normalizeSellerText(value, { maxLength: OTP_LENGTH + 4 });
  if (!raw || !/^[0-9۰-۹٠-٩\s]+$/.test(raw)) return '';
  const digits = toEnglishDigits(raw).replace(/\s+/g, '');
  return /^\d{5}$/.test(digits) ? digits : '';
}

function generateOtpCode() {
  // Dev-only shortcut for local testing. Do not use in production.
  if (process.env.NODE_ENV !== 'production') {
    return DEV_STATIC_OTP;
  }
  const max = 10 ** OTP_LENGTH;
  return crypto.randomInt(0, max).toString().padStart(OTP_LENGTH, '0');
}

function hashOtp(code) {
  return crypto
    .createHmac('sha256', OTP_HASH_SECRET)
    .update(String(code))
    .digest('hex');
}

const DUMMY_OTP_HASH = hashOtp('00000');

function timingSafeStringEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  const len = Math.max(leftBuffer.length, rightBuffer.length, 1);
  const leftPadded = Buffer.alloc(len);
  const rightPadded = Buffer.alloc(len);
  leftBuffer.copy(leftPadded);
  rightBuffer.copy(rightPadded);
  const equal = crypto.timingSafeEqual(leftPadded, rightPadded);
  return equal && leftBuffer.length === rightBuffer.length;
}

function isOtpHashMatch(storedHash, otpCode) {
  const expectedHash = typeof storedHash === 'string' && storedHash ? storedHash : DUMMY_OTP_HASH;
  const incomingHash = hashOtp(otpCode);
  const equal = timingSafeStringEqual(expectedHash, incomingHash);
  return Boolean(storedHash) && equal;
}

function consumeOtpRequestAllowance(phone) {
  const now = Date.now();
  const state = otpRequestState.get(phone) || {
    count: 0,
    windowStart: now,
    nextAllowedAt: 0
  };

  if (now - state.windowStart > OTP_REQUEST_WINDOW_MS) {
    state.count = 0;
    state.windowStart = now;
    state.nextAllowedAt = 0;
  }

  if (state.nextAllowedAt > now) {
    otpRequestState.set(phone, state);
    return false;
  }

  if (state.count >= OTP_REQUEST_MAX_PER_WINDOW) {
    state.nextAllowedAt = now + OTP_REQUEST_MIN_INTERVAL_MS;
    otpRequestState.set(phone, state);
    return false;
  }

  state.count += 1;
  state.nextAllowedAt = now + OTP_REQUEST_MIN_INTERVAL_MS;
  otpRequestState.set(phone, state);
  return true;
}

function isOtpVerifyAllowed(key) {
  const state = otpVerifyState.get(key);
  if (!state) return true;

  const now = Date.now();
  if (state.lockUntil > now) return false;
  if (state.nextAllowedAt > now) return false;
  return true;
}

function registerOtpVerifyFailure(key) {
  const now = Date.now();
  const state = otpVerifyState.get(key) || {
    failedAttempts: 0,
    nextAllowedAt: 0,
    lockUntil: 0
  };

  state.failedAttempts += 1;
  const backoff = Math.min(
    OTP_VERIFY_BACKOFF_BASE_MS * (2 ** (state.failedAttempts - 1)),
    OTP_VERIFY_BACKOFF_MAX_MS
  );
  state.nextAllowedAt = now + backoff;

  if (state.failedAttempts >= OTP_VERIFY_LOCKOUT_THRESHOLD) {
    state.lockUntil = now + OTP_VERIFY_LOCKOUT_MS;
    state.failedAttempts = 0;
    state.nextAllowedAt = state.lockUntil;
  }

  otpVerifyState.set(key, state);
}

function clearOtpVerifyState(key) {
  otpVerifyState.delete(key);
}

function buildUserPhoneCandidates(rawPhone) {
  const normalized = normalizeIranianPhone(rawPhone);
  const set = new Set(buildPhoneCandidates(rawPhone));

  if (normalized) {
    const stripped = normalized.slice(1);
    set.add(normalized);
    set.add(stripped);
    set.add(`+98${stripped}`);
    set.add(`98${stripped}`);
  }

  return Array.from(set).filter(Boolean);
}

async function findUserByPhone(rawPhone, { includeDeleted = false } = {}) {
  const candidates = buildUserPhoneCandidates(rawPhone);
  if (!candidates.length) return null;

  const query = { phone: { $in: candidates } };
  if (!includeDeleted) {
    query.deleted = { $ne: true };
  }
  return User.findOne(query);
}

// ⬇︎ تابع کمکی؛ بیرون از هر متد export باشد تا همه بتوانند استفاده کنند
async function ensurePhoneAllowed(phone) {
  const phoneCandidates = buildUserPhoneCandidates(phone);

  if (phoneCandidates.length) {
    /* اگر در لیست سیاه باشد */
    if (await BannedPhone.findOne({ phone: { $in: phoneCandidates } })) {
      throw new Error('این شماره مسدود شده است.');
    }

    /* یا کاربری قبلاً حذف شده باشد */
    if (await User.findOne({ phone: { $in: phoneCandidates }, deleted: true })) {
      throw new Error('این حساب کاربری حذف و مسدود شده است.');
    }
  }
}

async function linkLegacyBookingsToUser(user, phone) {
  const Booking = require('../models/booking');

  const phoneCandidates = buildUserPhoneCandidates(phone);
  if (!phoneCandidates.length) return;

  const oldBookings = await Booking.find({
    customerPhone: { $in: phoneCandidates },
    $or: [
      { userId: { $exists: false } },
      { userId: null }
    ]
  });

  if (!oldBookings.length) return;

  await Booking.updateMany(
    {
      customerPhone: { $in: phoneCandidates },
      $or: [
        { userId: { $exists: false } },
        { userId: null }
      ]
    },
    {
      $set: { userId: user._id }
    }
  );

  const bookingIds = oldBookings.map((booking) => booking._id);
  user.bookings = bookingIds;

  if (oldBookings.length > 0 && (!user.userType || user.userType === 'product')) {
    user.userType = user.userType === 'product' ? 'both' : 'service';
  }

  await user.save();
}





exports.adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    // ۱) پیدا کردن ادمین
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'ادمین یافت نشد.' });
    }

    // ۲) بررسی رمز
    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'رمز اشتباه است.' });
    }

    // ۳) ساخت توکن با نقشِ admin
    const token = jwt.sign(
      {
        id: admin._id,
        role: 'admin',
        userType: admin.userType || 'both',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );



    const cookieBase = getCookieBaseOptions(req);
    res.cookie('admin_token', token, {
      ...cookieBase,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });



    // ۵) پاسخ JSON
    return res.json({
      success: true,
      message: 'ورود ادمین موفق بود.'
    });

  } catch (err) {
    console.error('❌ adminLogin error:', err);
    return res.status(500).json({ success: false, message: 'خطای سرور.' });
  }
};

const AUTO_SHOP_MIN = 1000;
const AUTO_SHOP_MAX = 10000; // crypto.randomInt upper bound is exclusive
const AUTO_SHOP_PREFIX = 'shop';
const AUTO_SHOP_MAX_ATTEMPTS = 120;

function buildAutoShopSlug() {
  return `${AUTO_SHOP_PREFIX}-${crypto.randomInt(AUTO_SHOP_MIN, AUTO_SHOP_MAX)}`;
}

async function isShopSlugAvailable(slug) {
  const [sellerExists, appearanceExists] = await Promise.all([
    Seller.exists({ shopurl: slug }),
    ShopAppearance.exists({ customUrl: slug })
  ]);
  return !sellerExists && !appearanceExists;
}

async function generateUniqueAutoShopSlug() {
  for (let attempt = 0; attempt < AUTO_SHOP_MAX_ATTEMPTS; attempt += 1) {
    const slug = buildAutoShopSlug();
    if (await isShopSlugAvailable(slug)) {
      return slug;
    }
  }
  throw new Error('AUTO_SHOPURL_GENERATION_FAILED');
}

// ثبت‌نام فروشنده با ذخیره OTP در دیتابیس
exports.register = async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      storename,
      phone: rawPhone,
      category,
      subcategory,
      address,
      desc,
      referralCode,
      password,
    } = req.body;

    const normalizedFirstname = normalizeSellerText(firstname, { maxLength: 50 });
    const normalizedLastname = normalizeSellerText(lastname, { maxLength: 50 });
    const normalizedStorename = normalizeSellerText(storename, { maxLength: 80 });
    const normalizedCategoryInput = normalizeSellerCategory(category);
    const normalizedSubcategoryInput = normalizeSellerCategory(subcategory);
    const normalizedAddress = normalizeSellerAddress(address);
    const normalizedDesc = normalizeSellerDescription(desc);
    const normalizedReferralCode = normalizeReferralCode(referralCode);

    if (!isValidSellerName(normalizedFirstname) || !isValidSellerName(normalizedLastname)) {
      return res.status(400).json({
        success: false,
        message: 'نام و نام خانوادگی باید فقط شامل حروف فارسی و بین ۲ تا ۵۰ کاراکتر باشد.'
      });
    }

    if (!isValidSellerStoreName(normalizedStorename)) {
      return res.status(400).json({
        success: false,
        message: 'نام فروشگاه باید شامل حروف فارسی، عدد و فاصله و بین ۲ تا ۸۰ کاراکتر باشد.'
      });
    }

    if (!isValidSellerCategory(normalizedCategoryInput)) {
      return res.status(400).json({
        success: false,
        message: 'دسته‌بندی معتبر وارد کنید.'
      });
    }

    if (normalizedSubcategoryInput && !isValidSellerCategory(normalizedSubcategoryInput)) {
      return res.status(400).json({
        success: false,
        message: 'زیرگروه واردشده معتبر نیست.'
      });
    }

    if (!isValidSellerAddress(normalizedAddress)) {
      return res.status(400).json({
        success: false,
        message: 'آدرس معتبر و حداقل ۵ کاراکتر وارد کنید.'
      });
    }

    if (!isValidSellerDescription(normalizedDesc)) {
      return res.status(400).json({
        success: false,
        message: 'توضیحات واردشده معتبر نیست.'
      });
    }

    if (!isValidReferralCode(normalizedReferralCode)) {
      return res.status(400).json({
        success: false,
        message: 'کد معرف معتبر نیست.'
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'رمز عبور باید حداقل ۸ کاراکتر و شامل حرف انگلیسی، عدد و نماد باشد.'
      });
    }

    const phone = normalizeSellerRegistrationPhone(rawPhone);
    if (!phone || !validateIranianPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'شماره موبایل معتبر وارد کنید.'
      });
    }

    const categoryValidation = await validateCategoryAndSubcategoryPair(
      normalizedCategoryInput,
      normalizedSubcategoryInput
    );
    if (!categoryValidation.valid) {
      return res.status(400).json({
        success: false,
        message: categoryValidation.message
      });
    }

    const normalizedCategory = categoryValidation.normalizedCategory;
    const normalizedSubcategory = categoryValidation.normalizedSubcategory;

    if (!consumeOtpRequestAllowance(`seller:${phone}`)) {
      return res.status(429).json({
        success: false,
        message: 'درخواست بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.'
      });
    }

    await ensurePhoneAllowed(phone);

    // چک تکراری نبودن فروشنده
    const phoneCandidates = buildPhoneCandidates(phone);
    const exists = await Seller.findOne({ phone: { $in: phoneCandidates } });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'این شماره تلفن قبلاً ثبت شده.',
      });
    }

    // هش کردن رمز عبور
    const hashedPassword = await bcrypt.hash(password, 10);

    // ساخت OTP و زمان انقضا (۳ دقیقه)
    const otp = hashOtp(generateOtpCode());
    const otpExpire = new Date(Date.now() + OTP_TTL_MS);

    // ساخت و ذخیره فروشنده جدید با آدرس خودکار فروشگاه
    let seller = null;
    let generatedShopurl = '';
    let lastShopurlError = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      generatedShopurl = await generateUniqueAutoShopSlug();
      const candidateSeller = new Seller({
        firstname: normalizedFirstname,
        lastname: normalizedLastname,
        storename: normalizedStorename,
        shopurl: generatedShopurl,
        phone,
        category: normalizedCategory,
        subcategory: normalizedSubcategory,
        address: normalizedAddress,
        desc: normalizedDesc,
        referralCode: normalizedReferralCode,
        password: hashedPassword,
        otp,
        otpExpire,
      });

      try {
        seller = await candidateSeller.save();
        lastShopurlError = null;
        break;
      } catch (saveErr) {
        if (saveErr?.code === 11000 && saveErr?.keyPattern?.shopurl) {
          lastShopurlError = saveErr;
          continue;
        }
        throw saveErr;
      }
    }

    if (!seller) {
      throw lastShopurlError || new Error('AUTO_SHOPURL_SAVE_FAILED');
    }

    // ساخت ظاهر فروشگاه (ShopAppearance)
    try {
      await ShopAppearance.create({
        sellerId: seller._id,
        customUrl: generatedShopurl,
        shopPhone: phone,
        shopAddress: normalizedAddress,
        shopLogoText: normalizedStorename,
        shopStatus: 'open',
        slides: [],
      });
    } catch (err) {
      console.error('❌ خطا در ساخت ShopAppearance:', err);
      // حتی اگر ظاهر ساخته نشد، فروشنده ثبت میشه
    }

    // OTP sent to user via SMS (not logged for security)

    res.status(201).json({
      success: true,
      message: 'ثبت‌نام انجام شد! کد تایید پیامک شد.',
      id: seller._id,
    });

  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'این شماره تلفن قبلاً ثبت شده.',
      });
    }
    console.error('❌ Error in register:', err);
    res.status(500).json({
      success: false,
      message: 'خطای سرور. لطفاً بعداً دوباره تلاش کنید.',
    });
  }
};

// ورود فروشنده (بر اساس شماره موبایل)
// ورود فروشنده (بر اساس شماره موبایل)
// controllers/authController.js

// … بقیه ایمپورت‌ها …


// controllers/authController.js
exports.login = async (req, res) => {
  try {
    const { phone: rawPhone, password } = req.body || {};
    const phone = normalizeStrictIranianPhone(rawPhone);
    const normalizedPassword = typeof password === 'string' ? password : '';
    if (!phone || !normalizedPassword || normalizedPassword.length > PASSWORD_BCRYPT_MAX_LENGTH || !validateIranianPhone(phone)) {
      return res.status(400).json({ success: false, message: 'شماره و رمز الزامی است.' });
    }

    await ensurePhoneAllowed(phone);

    // بارگذاری صریح password
    const phoneCandidates = buildPhoneCandidates(phone);
    const seller = await Seller.findOne({ phone: { $in: phoneCandidates } }).select('+password');
    if (!seller) return res.status(404).json({ success: false, message: 'فروشنده‌ای با این شماره یافت نشد.' });

    // مقایسه رمز
    const isMatch = await bcrypt.compare(normalizedPassword, seller.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'رمز اشتباه است.' });

    // صدور نشست امن (توکن فقط در کوکی HttpOnly)
    issueSellerSession(req, res, seller);

    // آماده‌سازی پاسخ بدون password
    seller.password = undefined;

    return res.json({
      success: true,
      message: 'ورود با موفقیت انجام شد.',
      token: USER_SESSION_MARKER,
      seller: {
        id: seller._id,
        firstname: seller.firstname,
        lastname: seller.lastname,
        storename: seller.storename,
        shopurl: seller.shopurl,
        phone: seller.phone,
        category: seller.category,
        address: seller.address,
        desc: seller.desc,
        createdAt: seller.createdAt,
      }
    });

  } catch (err) {
    if (/مسدود/.test(err.message)) {
      return res
        .status(403)
        .json({ success: false, message: 'شما مسدود شده‌اید و امکان ورود ندارید.' });
    }
    console.error('❌ Error in login:', err);
    return res
      .status(500)
      .json({ success: false, message: 'خطای سرور در ورود فروشنده.' });
  }
};



// تایید کد پیامک (OTP واقعی)
exports.verifyCode = async (req, res) => {
  try {
    const rawShopurl = typeof req.body.shopurl === 'string' ? req.body.shopurl.trim().toLowerCase() : '';
    const hasPhoneInput = req.body?.phone !== undefined && req.body?.phone !== null && String(req.body?.phone).trim() !== '';
    const phone = hasPhoneInput ? normalizeStrictIranianPhone(req.body.phone) : '';
    const code = normalizeStrictOtp(req.body?.code);

    if (!code) {
      return res.status(400).json({ success: false, message: 'کد وارد شده معتبر نیست!' });
    }

    if (hasPhoneInput && !phone) {
      return res.status(400).json({ success: false, message: 'شماره موبایل معتبر وارد کنید.' });
    }

    const query = {};
    if (rawShopurl) query.shopurl = rawShopurl;
    if (phone) query.phone = phone;

    if (!Object.keys(query).length) {
      return res.status(400).json({ success: false, message: 'اطلاعات ناقص ارسال شده.' });
    }

    const verifyKey = phone ? `seller:${phone}` : `seller:shopurl:${rawShopurl}`;
    if (!isOtpVerifyAllowed(verifyKey)) {
      return res.status(400).json({ success: false, message: USER_OTP_VERIFY_FAILURE_MESSAGE });
    }

    // پیدا کردن فروشنده با توجه به اطلاعات موجود
    const seller = await Seller.findOne(query);
    const otpMatches = isOtpHashMatch(seller?.otp, code);
    const otpNotExpired = Boolean(seller?.otpExpire && seller.otpExpire >= new Date());

    // anti-enumeration: پاسخ خطا برای تمام شکست‌ها یکسان است
    if (!seller || !otpMatches || !otpNotExpired) {
      registerOtpVerifyFailure(verifyKey);
      return res.status(400).json({ success: false, message: USER_OTP_VERIFY_FAILURE_MESSAGE });
    }

    // بعد از تایید، otp رو حذف کن (امن‌تره)
    clearOtpVerifyState(verifyKey);
    seller.otp = undefined;
    seller.otpExpire = undefined;
    await seller.save();

    res.json({ success: true, message: 'کد تایید صحیح است.' });

  } catch (err) {
    console.error('❌ Error in verifyCode:', err);
    res.status(500).json({ success: false, message: 'خطای سرور در تایید.' });
  }
};

// ----------- تولید کد معرف یکتا -----------
async function generateUniqueReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بدون حروف مشابه (O, 0, I, 1)
  const codeLength = 8;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    let code = 'VT'; // پیشوند ویترینت
    for (let i = 0; i < codeLength - 2; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // چک یکتا بودن
    const exists = await User.findOne({ referralCode: code });
    if (!exists) {
      return code;
    }
    attempts++;
  }

  // اگر بعد از چند تلاش یکتا نبود، از timestamp استفاده کن
  const timestamp = Date.now().toString(36).toUpperCase();
  return `VT${timestamp}`.slice(0, 8);
}

function applyUserOtpChallenge(user) {
  user.otp = hashOtp(generateOtpCode());
  user.otpExpire = new Date(Date.now() + OTP_TTL_MS);
}

function hydrateExistingUserForOtp(user, phone, { termsAccepted } = {}) {
  user.phone = phone;
  user.mobile = user.mobile || phone;

  if (termsAccepted === true && !user.termsAcceptedAt) {
    user.termsAcceptedAt = new Date();
  }
}

async function prepareUserForOtp(phone, { termsAccepted } = {}) {
  let user = await findUserByPhone(phone);

  if (!user) {
    user = new User({
      phone,
      mobile: phone,
      referralCode: await generateUniqueReferralCode(),
      termsAcceptedAt: termsAccepted === true ? new Date() : null
    });
  } else {
    hydrateExistingUserForOtp(user, phone, { termsAccepted });
    if (!user.referralCode) {
      user.referralCode = await generateUniqueReferralCode();
    }
  }

  applyUserOtpChallenge(user);

  try {
    await user.save();
    return user;
  } catch (err) {
    if (err?.code !== 11000) {
      throw err;
    }

    const existingUser = await findUserByPhone(phone);
    if (!existingUser) {
      throw err;
    }

    hydrateExistingUserForOtp(existingUser, phone, { termsAccepted });
    if (!existingUser.referralCode) {
      existingUser.referralCode = await generateUniqueReferralCode();
    }
    applyUserOtpChallenge(existingUser);
    await existingUser.save();
    return existingUser;
  }
}

// ----------- ثبت‌نام کاربر ----------- 
// ----------- ثبت‌نام کاربر -----------
exports.registerUser = async (req, res) => {
  try {
    const { phone: rawPhone, termsAccepted } = req.body || {};
    const phone = normalizeStrictIranianPhone(rawPhone);

    if (!phone || !validateIranianPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'شماره موبایل معتبر وارد کنید.'
      });
    }

    if (termsAccepted !== undefined && termsAccepted !== true) {
      return res.status(400).json({
        success: false,
        message: 'لطفا قوانین و مقررات را بپذیرید.'
      });
    }

    const canIssueOtp = consumeOtpRequestAllowance(`user:${phone}`);
    if (canIssueOtp) {
      try {
        await ensurePhoneAllowed(phone);
        await prepareUserForOtp(phone, { termsAccepted });
      } catch (err) {
        // Anti-enumeration: پاسخ همیشه یکسان بماند
        if (!/مسدود/.test(err?.message || '')) {
          console.error('registerUser OTP issue error:', err);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: USER_OTP_REQUEST_SUCCESS_MESSAGE
    });
  } catch (err) {
    console.error('registerUser ERROR:', err);
    return res.status(200).json({
      success: true,
      message: USER_OTP_REQUEST_SUCCESS_MESSAGE
    });
  }
};


// ----------- ورود حرفه‌ای کاربر ----------- 
// ----------- ورود کاربر فقط با JWT در JSON (بدون کوکی) ----------- 
// ----------- ورود کاربر و ست‌کردن کوکی Http-Only -----------
// ----------- ورود کاربر -----------
// controllers/authController.js
// controllers/authController.js
exports.verifyUserOtp = async (req, res) => {
  try {
    const { phone: rawPhone, code: rawCode } = req.body || {};
    const phone = normalizeStrictIranianPhone(rawPhone);
    const code = normalizeStrictOtp(rawCode);

    if (!phone || !validateIranianPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'شماره موبایل معتبر وارد کنید.'
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'کد وارد شده معتبر نیست!'
      });
    }

    const verifyKey = `user:${phone}`;

    if (!isOtpVerifyAllowed(verifyKey)) {
      return res.status(400).json({
        success: false,
        message: USER_OTP_VERIFY_FAILURE_MESSAGE
      });
    }

    let isPhoneAllowed = true;
    try {
      await ensurePhoneAllowed(phone);
    } catch {
      isPhoneAllowed = false;
    }

    const user = await findUserByPhone(phone);
    const otpMatches = isOtpHashMatch(user?.otp, code);
    const otpNotExpired = Boolean(user?.otpExpire && user.otpExpire >= new Date());

    if (!isPhoneAllowed || !user || !otpMatches || !otpNotExpired) {
      registerOtpVerifyFailure(verifyKey);
      return res.status(400).json({
        success: false,
        message: USER_OTP_VERIFY_FAILURE_MESSAGE
      });
    }

    clearOtpVerifyState(verifyKey);
    user.phone = phone;
    user.mobile = user.mobile || phone;
    user.otp = undefined;
    user.otpExpire = undefined;
    if (!user.referralCode) {
      user.referralCode = await generateUniqueReferralCode();
    }
    await user.save();

    try {
      await linkLegacyBookingsToUser(user, phone);
    } catch {
      // Non-critical error - silently continue
    }

    issueUserSession(req, res, user);

    return res.status(200).json({
      success: true,
      message: 'ورود با موفقیت انجام شد.',
      token: USER_SESSION_MARKER,
      user: {
        id: user._id,
        firstname: user.firstname || '',
        lastname: user.lastname || '',
        city: user.city || '',
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('verifyUserOtp ERROR:', err);
    return res.status(500).json({
      success: false,
      message: 'خطای سرور در تایید.'
    });
  }
};
exports.loginUser = async (req, res) => {
  try {
    const { phone: rawPhone, password } = req.body || {};
    const phone = normalizeStrictIranianPhone(rawPhone);
    const normalizedPassword = typeof password === 'string' ? password : '';

    /* ۱) ولیدیشن اولیه */
    if (!phone || !normalizedPassword || normalizedPassword.length > PASSWORD_BCRYPT_MAX_LENGTH || !validateIranianPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'شماره و رمز الزامی است.'
      });
    }

    /* ۲) ردِ شماره‌های مسدود یا حساب‌های حذف‌شده */
    await ensurePhoneAllowed(phone);

    /* ۳) پیدا کردن کاربری که حذف نشده باشد */
    const user = await findUserByPhone(phone);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربری با این شماره یافت نشد.'
      });
    }

    /* ۴) تطابق رمز عبور */
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'برای این شماره، ورود با کد تایید انجام می‌شود.'
      });
    }

    const isMatch = await bcrypt.compare(normalizedPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'شماره موبایل یا رمز عبور اشتباه است'
      });
    }

    /* ۵) تولید JWT و ست کوکی */
    issueUserSession(req, res, user);

    /* ۷) پاسخ نهایی */
    return res.status(200).json({
      success: true,
      message: 'ورود با موفقیت انجام شد.',
      token: USER_SESSION_MARKER,
      user: {
        id: user._id,
        firstname: user.firstname || '',
        lastname: user.lastname || '',
        phone: user.phone
      }
    });

  } catch (err) {
    if (/مسدود/.test(err.message)) {
      return res
        .status(403)
        .json({ success: false, message: 'شما مسدود شده‌اید و امکان ورود ندارید.' });
    }
    console.error('Error in user login:', err);
    return res.status(500).json({
      success: false,
      message: 'خطای سرور در ورود کاربر.'
    });
  }
};

exports.refreshUserSession = async (req, res) => {
  try {
    const refreshToken = req.cookies?.user_refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'نشست کاربر نامعتبر است.' });
    }

    const payload = jwt.verify(refreshToken, JWT_SECRET);
    if (payload?.role !== 'user' || payload?.type !== 'refresh' || !payload?.id) {
      return res.status(401).json({ success: false, message: 'نشست کاربر نامعتبر است.' });
    }

    const user = await User.findById(payload.id);
    if (!user || user.deleted) {
      return res.status(401).json({ success: false, message: 'نشست کاربر نامعتبر است.' });
    }

    issueUserSession(req, res, user);

    return res.status(200).json({
      success: true,
      message: 'نشست کاربر تمدید شد.',
      token: USER_SESSION_MARKER
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'نشست کاربر نامعتبر است.' });
  }
};





// ─── قبل از خط «exports.getCurrentSeller = …» این کد را اضافه کنید
exports.getCurrentUser = async (req, res) => {
  try {
    /* 1) خواندن کوکی */
    const token = req.cookies.user_token;
    if (!token)
      return res.status(401).json({ success: false, message: 'عدم احراز هویت' });

    /* 2) اعتبارسنجی */
    const decoded = jwt.verify(token, JWT_SECRET);


    /* 3) واکشی کاربر (بدون فیلدهای حساس) */
    const user = await User.findById(decoded.id).select('-password');
    if (!user)
      return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' });

    /* 4) آماده‌سازی پاسخ برای فرانت */
    const userObj = user.toObject();
    userObj.id = userObj._id; // برای هماهنگی با فرانت
    delete userObj.password;
    delete userObj.otp;
    delete userObj.otpExpire;

    return res.json({ success: true, user: userObj });
  } catch (err) {
    console.error('Error in getCurrentUser:', err);
    return res
      .status(403)
      .json({ success: false, message: 'توکن نامعتبر یا منقضی شده.' });
  }
};






// این را بالای بقیه exports در authController.js اضافه کن
exports.getCurrentSeller = async (req, res) => {
  try {
    // استفاده از req.user که توسط authMiddleware ست شده
    // این روش از خواندن مستقیم کوکی بهتره چون middleware همه توکن‌ها رو چک میکنه
    const sellerId = req.user?.id || req.user?._id;
    
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'عدم احراز هویت' });
    }

    // دریافت فروشنده (بدون فیلدهای حساس)
    const seller = await Seller.findById(sellerId).select('-password -otp -otpExpire');
    if (!seller) {
      return res.status(404).json({ success: false, message: 'فروشنده یافت نشد.' });
    }

    // اگر اشتراک پریمیوم منقضی شده باشد، آن را غیرفعال کن
    if (seller.isPremium && (!seller.premiumUntil || seller.premiumUntil < new Date())) {
      seller.isPremium = false;
      seller.premiumUntil = null;
      await seller.save();
    }

    // ۴) تبدیل به آبجکت و اضافه کردن id برای فرانت
    const sellerObj = seller.toObject();
    sellerObj.id = sellerObj._id; // این خط مهمه
    delete sellerObj.password;
    delete sellerObj.otp;
    delete sellerObj.otpExpire;

    // ۵) ارسال پاسخ کامل به فرانت
    res.json({ success: true, seller: sellerObj });

  } catch (err) {
    console.error('Error in getCurrentSeller:', err);
    res.status(403).json({ success: false, message: 'دسترسی غیرمجاز یا توکن منقضی شده.' });
  }
};
