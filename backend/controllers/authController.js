  const Seller = require('../models/Seller');
  const ShopAppearance = require('../models/ShopAppearance');
  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = 'vitrinet_secret_key';
  const User = require('../models/user');
  const Admin = require('../models/admin'); // اگه مدل جدا داری
const BannedPhone = require('../models/BannedPhone');     // ⬅︎ مدل لیست سیاه

// ⬇︎ تابع کمکی؛ بیرون از هر متد export باشد تا همه بتوانند استفاده کنند
async function ensurePhoneAllowed (phone) {
  /* اگر در لیست سیاه باشد */
  if (await BannedPhone.findOne({ phone }))
    throw new Error('این شماره مسدود شده است.');

  /* یا کاربری قبلاً حذف شده باشد */
  if (await User.findOne({ phone, deleted: true }))
    throw new Error('این حساب کاربری حذف و مسدود شده است.');
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
  { id: admin._id, role: 'admin' },
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
        desc,
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

      // --- در حالت واقعی باید این OTP پیامک شود ---
      console.log(`کد تایید ارسال شده به کاربر: ${otp}`);

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
      { id: seller._id.toString(), role: 'seller' },
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
        id:        seller._id,
        firstname: seller.firstname,
        lastname:  seller.lastname,
        storename: seller.storename,
        shopurl:   seller.shopurl,
        phone:     seller.phone,
        category:  seller.category,
        address:   seller.address,
        desc:      seller.desc,
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
      const { shopurl, phone, code } = req.body;

      if (!shopurl || !phone || !code) {
        return res.status(400).json({ success: false, message: 'اطلاعات ناقص ارسال شده.' });
      }

      // پیدا کردن فروشنده با shopurl و phone
      const seller = await Seller.findOne({ shopurl, phone });
      if (!seller) {
        return res.status(404).json({ success: false, message: 'فروشنده یافت نشد.' });
      }

      // چک کد تایید و انقضا
      if (
        seller.otp !== code ||
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

  function validateIranianPhone(phone) {
    return /^(\+98|0)?9\d{9}$/.test(phone);
  }

  // ----------- ثبت‌نام کاربر ----------- 
// ----------- ثبت‌نام کاربر -----------
exports.registerUser = async (req, res) => {
  try {
    const { firstname, lastname, phone, password } = req.body;

    /* اعتبارسنجى اولیه */
    if (
      !firstname || !lastname || !phone || !password ||
      firstname.length < 2   || lastname.length  < 2 ||
      password.length  < 5   || !validateIranianPhone(phone)
    ) {
      return res.status(400).json({
        success: false,
        message: 'اطلاعات وارد شده معتبر نیست.'
      });
    }

    /* ⬅︎ جلوگیرى از ثبت‌نام شماره‌هاى مسدود یا حسابِ حذف‌شده */
    await ensurePhoneAllowed(phone);

    /* جلوگیرى از تکرار شماره در میان کاربران فعال */
    const exists = await User.findOne({ phone, deleted: { $ne: true } });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'این شماره قبلاً ثبت شده.'
      });
    }

    /* هش کردن رمز عبور */
    const salt           = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    /* ایجاد و ذخیره کاربر */
    const user = new User({
      firstname: firstname.trim(),
      lastname : lastname.trim(),
      phone,
      password : hashedPassword
    });
    await user.save();

    return res.status(201).json({
      success: true,
      message: 'ثبت‌نام با موفقیت انجام شد.',
      user: {
        id        : user._id,
        firstname : user.firstname,
        lastname  : user.lastname,
        phone     : user.phone
      }
    });

  } catch (err) {
    console.error('registerUser ERROR:', err);
    /* اگر پیام خطا مربوط به مسدود بودن شماره است → 403 */
    const code = /مسدود/.test(err.message) ? 403 : 500;
    return res.status(code).json({
      success: false,
      message: err.message || 'خطای سرور. لطفا بعدا تلاش کنید.'
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
    const { phone, password } = req.body;

    /* ۱) ولیدیشن اولیه */
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'شماره و رمز الزامی است.'
      });
    }

    /* ۲) ردِ شماره‌های مسدود یا حساب‌های حذف‌شده */
    await ensurePhoneAllowed(phone);

    /* ۳) پیدا کردن کاربری که حذف نشده باشد */
    const user = await User.findOne({ phone, deleted: { $ne: true } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربری با این شماره یافت نشد.'
      });
    }

    /* ۴) تطابق رمز عبور */
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'رمز عبور اشتباه است.'
      });
    }

    /* ۵) تولید JWT */
    const token = jwt.sign(
      { id: user._id, role: 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    /* ۶) ست‌کردن کوکی Http‑Only برای کاربر
          در محیط توسعه (HTTP) →  secure=false , sameSite='lax'
          در محیط Production (HTTPS) → secure=true , sameSite='none' برای کراس‌سایت */
    res.cookie('user_token', token, {
      httpOnly : true,
      secure   : process.env.NODE_ENV === 'production',  // روی HTTPS باید true باشد
      sameSite : process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path     : '/',
      maxAge   : 7 * 24 * 60 * 60 * 1000                // ۷ روز
    });

    /* ۷) پاسخ نهایی */
    return res.status(200).json({
      success: true,
      message: 'ورود با موفقیت انجام شد.',
      token,
      user: {
        id        : user._id,
        firstname : user.firstname,
        lastname  : user.lastname,
        phone     : user.phone
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
      // ۱) خواندن توکن از کوکی
      const token = req.cookies.seller_token;
      if (!token) {
        return res.status(401).json({ success: false, message: 'عدم احراز هویت' });
      }

      // ۲) اعتبارسنجی توکن
const decoded = jwt.verify(token, JWT_SECRET);

      // ۳) دریافت فروشنده (بدون فیلدهای حساس)
      const seller = await Seller.findById(decoded.id).select('-password -otp -otpExpire');
      if (!seller) {
        return res.status(404).json({ success: false, message: 'فروشنده یافت نشد.' });
      }

      // اگر اشتراک پریمیوم منقضی شده باشد، آن را غیرفعال کن
      if (seller.isPremium && (!seller.premiumUntil || seller.premiumUntil < new Date())) {
        seller.isPremium = false;
        seller.premiumUntil = null;
        await seller.save();
        console.log(`⚠️ Premium expired for seller ${seller._id}`);
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

