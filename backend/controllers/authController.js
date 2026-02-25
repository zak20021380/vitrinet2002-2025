const Seller = require('../models/Seller');
const ShopAppearance = require('../models/ShopAppearance');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'vitrinet_secret_key';
const User = require('../models/user');
const Admin = require('../models/admin'); // اگه مدل جدا داری
const BannedPhone = require('../models/BannedPhone');     // ⬅︎ مدل لیست سیاه
const { buildPhoneCandidates } = require('../utils/phone');

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

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

function issueUserSession(res, user) {
  const token = jwt.sign(
    {
      id: user._id,
      role: 'user',
      userType: user.userType || 'both',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('user_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return token;
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



    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',                          // فقط تو پروداکشن Secure=true باشه
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',      // در توسعه Lax باشه تا cookie ذخیره شود
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });



    // ۵) پاسخ JSON
    return res.json({
      success: true,
      message: 'ورود ادمین موفق بود.',
      token
    });

  } catch (err) {
    console.error('❌ adminLogin error:', err);
    return res.status(500).json({ success: false, message: 'خطای سرور.' });
  }
};

// ثبت‌نام فروشنده با ذخیره OTP در دیتابیس
exports.register = async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      storename,
      shopurl,
      phone,
      category,
      subcategory,
      address,
      desc,
      referralCode,
      password,
    } = req.body;

    await ensurePhoneAllowed(phone);

    // چک تکراری نبودن فروشنده
    const exists = await Seller.findOne({
      $or: [{ shopurl }, { phone }],
    });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'این شماره تلفن یا آدرس فروشگاه قبلاً ثبت شده.',
      });
    }

    // هش کردن رمز عبور
    const hashedPassword = await bcrypt.hash(password, 10);

    // ساخت OTP و زمان انقضا (۵ دقیقه)
    const otp = "12345"; // فقط برای تست! هر بار ثبت‌نام همین رو بزنه
    const otpExpire = new Date(Date.now() + 5 * 60 * 1000);

    // ساخت و ذخیره فروشنده جدید
    const seller = new Seller({
      firstname,
      lastname,
      storename,
      shopurl,
      phone,
      category,
      subcategory,
      address,
      address,
      desc,
      referralCode,
      password: hashedPassword,
      otp,
      otpExpire,
    });

    await seller.save();

    // ساخت ظاهر فروشگاه (ShopAppearance)
    try {
      await ShopAppearance.create({
        sellerId: seller._id,
        customUrl: shopurl,
        shopPhone: phone,
        shopAddress: address,
        shopLogoText: storename,
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
    const { phone, password } = req.body;
    await ensurePhoneAllowed(phone);

    // بارگذاری صریح password
    const seller = await Seller.findOne({ phone }).select('+password');
    if (!seller) return res.status(404).json({ success: false, message: 'فروشنده‌ای با این شماره یافت نشد.' });

    // مقایسه رمز
    const isMatch = await bcrypt.compare(password, seller.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'رمز اشتباه است.' });

    // JWT
    const token = jwt.sign(
      {
        id: seller._id.toString(),
        role: 'seller',
        userType: seller.userType || 'both',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // کوکی HttpOnly — همین‌جا تغییر می‌دهیم:
    res.cookie('seller_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // آماده‌سازی پاسخ بدون password
    seller.password = undefined;

    return res.json({
      success: true,
      message: 'ورود با موفقیت انجام شد.',
      token,
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
    const rawPhone = typeof req.body.phone === 'string' ? req.body.phone.replace(/\s+/g, '').trim() : '';
    const rawCode = typeof req.body.code === 'string' ? req.body.code.trim() : '';

    if (!rawCode) {
      return res.status(400).json({ success: false, message: 'کد تایید ارسال نشده است.' });
    }

    const query = {};
    if (rawShopurl) query.shopurl = rawShopurl;
    if (rawPhone) query.phone = rawPhone;

    if (!Object.keys(query).length) {
      return res.status(400).json({ success: false, message: 'اطلاعات ناقص ارسال شده.' });
    }

    // پیدا کردن فروشنده با توجه به اطلاعات موجود
    const seller = await Seller.findOne(query);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'فروشنده یافت نشد.' });
    }

    const sellerOtp = typeof seller.otp === 'string' ? seller.otp.trim() : '';

    // چک کد تایید و انقضا
    if (
      sellerOtp !== rawCode ||
      !seller.otpExpire ||
      seller.otpExpire < new Date()
    ) {
      return res.status(400).json({ success: false, message: 'کد تایید اشتباه است یا منقضی شده.' });
    }

    // بعد از تایید، otp رو حذف کن (امن‌تره)
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

const USER_OTP_CODE = '12345';
const USER_OTP_TTL_MS = 5 * 60 * 1000;
const USER_OTP_REQUEST_SUCCESS_MESSAGE = 'کد تایید پیامک شد.';

function applyUserOtpChallenge(user) {
  user.otp = USER_OTP_CODE;
  user.otpExpire = new Date(Date.now() + USER_OTP_TTL_MS);
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
    const phone = normalizeIranianPhone(rawPhone);

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

    await ensurePhoneAllowed(phone);

    const user = await prepareUserForOtp(phone, { termsAccepted });

    return res.status(200).json({
      success: true,
      message: USER_OTP_REQUEST_SUCCESS_MESSAGE,
      phone: user.phone
    });
  } catch (err) {
    console.error('registerUser ERROR:', err);
    const code = /مسدود/.test(err.message) ? 403 : 500;
    return res.status(code).json({
      success: false,
      message: err.message || 'خطای سرور. لطفا بعدا تلاش کنید.'
    });
  }
};

exports.verifyUserOtp = async (req, res) => {
  try {
    const { phone: rawPhone, code: rawCode } = req.body || {};
    const phone = normalizeIranianPhone(rawPhone);
    const code = toEnglishDigits(rawCode || '').replace(/\D/g, '');

    if (!phone || !validateIranianPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'شماره موبایل معتبر وارد کنید.'
      });
    }

    if (!/^\d{5}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'کد وارد شده معتبر نیست!'
      });
    }

    await ensurePhoneAllowed(phone);

    let user = await findUserByPhone(phone);
    if (!user) {
      user = await prepareUserForOtp(phone);
    }

    const storedOtp = typeof user.otp === 'string' ? user.otp.trim() : '';
    if (
      storedOtp !== code ||
      !user.otpExpire ||
      user.otpExpire < new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: 'کد تایید اشتباه است یا منقضی شده.'
      });
    }

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

    const token = issueUserSession(res, user);

    return res.status(200).json({
      success: true,
      message: 'ورود با موفقیت انجام شد.',
      token,
      user: {
        id: user._id,
        firstname: user.firstname || '',
        lastname: user.lastname || '',
        city: user.city || '',
        phone: user.phone
      }
    });
  } catch (err) {
    if (/مسدود/.test(err.message)) {
      return res
        .status(403)
        .json({ success: false, message: 'شما مسدود شده‌اید و امکان ورود ندارید.' });
    }
    console.error('verifyUserOtp ERROR:', err);
    return res.status(500).json({
      success: false,
      message: 'خطای سرور در تایید.'
    });
  }
};


// ----------- ورود حرفه‌ای کاربر ----------- 
// ----------- ورود کاربر فقط با JWT در JSON (بدون کوکی) ----------- 
// ----------- ورود کاربر و ست‌کردن کوکی Http-Only -----------
// ----------- ورود کاربر -----------
// controllers/authController.js
// controllers/authController.js
exports.loginUser = async (req, res) => {
  try {
    const { phone: rawPhone, password } = req.body || {};
    const phone = normalizeIranianPhone(rawPhone);

    /* ۱) ولیدیشن اولیه */
    if (!phone || !password || !validateIranianPhone(phone)) {
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

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'رمز عبور اشتباه است.'
      });
    }

    /* ۵) تولید JWT و ست کوکی */
    const token = issueUserSession(res, user);

    /* ۷) پاسخ نهایی */
    return res.status(200).json({
      success: true,
      message: 'ورود با موفقیت انجام شد.',
      token,
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

