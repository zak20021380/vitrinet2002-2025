// backend/routes/users.js
// ────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const User    = require('../models/user');
const userController = require('../controllers/userController');
const userCtrl = require('../controllers/userController');
const isAdmin = require('../middlewares/authMiddleware')('admin');

// کنترلرهای استریک و کیف پول
const userStreakController = require('../controllers/userStreakController');
const userWalletController = require('../controllers/userWalletController');

// ✳️ به‌جای خودِ تابع، خروجی فراخوانی‌اش را می‌دهیم
const auth = require('../middlewares/authMiddleware');
const { protect } = require('../middlewares/authMiddleware');

// ───────────────────────────────
// GET /api/user/profile
// ───────────────────────────────
router.get('/profile', auth('user'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('firstname lastname city phone mobile favorites lastVisit referralCode birthDate birthDateRewardClaimed createdAt')
      .populate({
        path: 'favorites',
        select: 'title images price sellerId'
      });

    if (!user)
      return res.status(404).json({ message: 'کاربر پیدا نشد' });

    res.json({
      _id: user._id,
      firstname:      user.firstname,
      lastname:       user.lastname,
      city:           user.city,
      // اگر phone خالی بود، mobile را برگردان
      phone:          user.phone || user.mobile || '',
      favorites:      user.favorites,
      favoritesCount: user.favorites ? user.favorites.length : 0,
      lastVisit:      user.lastVisit || '',
      referralCode:   user.referralCode || '',
      birthDate:      user.birthDate || '',
      birthDateRewardClaimed: user.birthDateRewardClaimed || false,
      createdAt:      user.createdAt,
      name:           `${user.firstname || ''} ${user.lastname || ''}`.trim()
    });
  } catch (err) {
    res.status(500).json({ message: 'خطا در دریافت پروفایل کاربر' });
  }
});

// ───────────────────────────────
// POST/PUT /api/user/profile
// ذخیره یا به‌روزرسانی اطلاعات پروفایل کاربر
// ───────────────────────────────
async function saveProfile(req, res) {
  try {
    const { name, phone } = req.body || {};

    if (!name || !phone) {
      return res.status(400).json({ message: 'نام و شماره تماس الزامی است' });
    }

    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ message: 'احراز هویت انجام نشده' });
    }

    // بررسی عدم تکراری بودن شماره
    const exists = await User.findOne({ phone, _id: { $ne: userId } });
    if (exists) {
      return res.status(409).json({ message: 'این شماره قبلاً استفاده شده است' });
    }

    const parts = name.trim().split(/\s+/);
    const firstname = parts.shift();
    const lastname = parts.length ? parts.join(' ') : firstname;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'کاربر پیدا نشد' });
    }

    user.firstname = firstname;
    user.lastname  = lastname;
    user.phone     = phone;
    user.lastVisit = new Date();

    user.activityLog = user.activityLog || [];
    user.activityLog.push({ action: 'PROFILE_UPDATE', meta: { name, phone } });
    if (user.activityLog.length > 20) {
      user.activityLog = user.activityLog.slice(-20);
    }

    await user.save();

    res.json({
      message: 'پروفایل با موفقیت ذخیره شد',
      name: `${user.firstname} ${user.lastname}`.trim(),
      phone: user.phone
    });
  } catch (err) {
    console.error('profile save error:', err);
    res.status(500).json({ message: 'خطا در ذخیره پروفایل کاربر' });
  }
}

router.post('/profile', auth('user'), saveProfile);
router.put('/profile', auth('user'), saveProfile);

// ───────────────────────────────
// POST /api/user/favorites
// ───────────────────────────────
router.post('/favorites', auth(), async (req, res) => {
  try {
    const userId      = req.user.id;
    const { productId } = req.body;

    if (!productId)
      return res.status(400).json({ message: 'شناسه محصول ارسال نشده!' });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: 'کاربر پیدا نشد!' });

    if (user.favorites?.includes(productId))
      return res.status(409).json({ message: 'قبلاً افزوده شده!' });

    user.favorites = user.favorites || [];
    user.favorites.push(productId);
    await user.save();

    res.json({ message: 'به علاقه‌مندی‌ها افزوده شد!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطا در افزودن به علاقه‌مندی‌ها' });
  }
});

// ───────────────────────────────
// GET /api/user/favorites
// ───────────────────────────────
router.get('/favorites', auth(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('favorites');
    if (!user)
      return res.status(404).json({ message: 'کاربر پیدا نشد!' });

    res.json({ favorites: user.favorites });
  } catch (err) {
    res.status(500).json({ message: 'خطا در دریافت علاقه‌مندی‌ها' });
  }
});

// ───────────────────────────────
// DELETE /api/user/favorites
// ───────────────────────────────
router.delete('/favorites', auth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId)
      return res.status(400).json({ message: 'شناسه محصول ارسال نشده!' });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: 'کاربر پیدا نشد!' });

    const favorites = user.favorites || [];
    const index = favorites.findIndex((favId) => favId.toString() === productId);

    if (index === -1) {
      return res.json({ message: 'محصولی در علاقه‌مندی‌ها نبود', removed: false });
    }

    favorites.splice(index, 1);
    user.favorites = favorites;
    await user.save();

    res.json({ message: 'از علاقه‌مندی‌ها حذف شد', removed: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطا در حذف از علاقه‌مندی‌ها' });
  }
});

// Get user's bookings
router.get('/bookings', protect, async (req, res) => {
  try {
    const Booking = require('../models/booking');

    const bookings = await Booking.find({
      userId: req.user.id
    })
      .populate('sellerId', '_id storename shopurl')
      .sort({ bookingDate: -1, startTime: -1 });

    // Format for frontend
    const formatted = bookings.map(b => ({
      _id: b._id,
      service: b.service,
      sellerName: b.sellerId?.storename || 'فروشگاه',
      sellerUrl: b.sellerId?.shopurl,
      sellerId: b.sellerId?._id?.toString() || undefined,
      bookingDate: b.bookingDate,
      startTime: b.startTime,
      status: b.status,
      createdAt: b.createdAt
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ message: 'خطا در بارگذاری رزروها' });
  }
});

// ───────────────────────────────
// GET /api/user/   – فقط ادمین
// با پشتیبانی از فیلتر تاریخ تولد
// ───────────────────────────────
router.get('/', auth('admin'), async (req, res) => {
  try {
    const { birthdayToday, birthdayMonth } = req.query;
    
    let users = await User.find(
      {},
      'firstname lastname email city phone mobile createdAt blockedByAdmin birthDate'
    );
    
    // فیلتر متولدین امروز (بر اساس ماه و روز شمسی)
    if (birthdayToday === 'true') {
      const today = new Date();
      // تبدیل به تاریخ شمسی
      const persianDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(today);
      
      // استخراج ماه و روز (فرمت: ۱۴۰۳/۰۹/۲۸)
      const parts = persianDate.split('/');
      const todayMonth = parts[1];
      const todayDay = parts[2];
      
      // تبدیل اعداد فارسی به انگلیسی
      const toEnglishNum = (str) => str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
      const monthEn = toEnglishNum(todayMonth).padStart(2, '0');
      const dayEn = toEnglishNum(todayDay).padStart(2, '0');
      
      users = users.filter(user => {
        if (!user.birthDate) return false;
        // فرمت birthDate: "1375/06/21"
        const userParts = user.birthDate.split('/');
        if (userParts.length !== 3) return false;
        const userMonth = userParts[1].padStart(2, '0');
        const userDay = userParts[2].padStart(2, '0');
        return userMonth === monthEn && userDay === dayEn;
      });
    }
    
    // فیلتر بر اساس ماه تولد
    if (birthdayMonth && birthdayMonth !== '') {
      const targetMonth = birthdayMonth.padStart(2, '0');
      users = users.filter(user => {
        if (!user.birthDate) return false;
        const userParts = user.birthDate.split('/');
        if (userParts.length !== 3) return false;
        const userMonth = userParts[1].padStart(2, '0');
        return userMonth === targetMonth;
      });
    }
    
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'خطا در دریافت کاربران.' });
  }
});

// ───────────────────────────────
// PUT /api/user/:id/birthdate – ویرایش تاریخ تولد توسط ادمین
// ───────────────────────────────
router.put('/:id/birthdate', auth('admin'), async (req, res) => {
  try {
    const { birthDate } = req.body;
    
    // اعتبارسنجی فرمت تاریخ شمسی (YYYY/MM/DD)
    if (birthDate && !/^\d{4}\/\d{2}\/\d{2}$/.test(birthDate)) {
      return res.status(400).json({ message: 'فرمت تاریخ تولد نامعتبر است. فرمت صحیح: 1375/06/21' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { birthDate: birthDate || null },
      { new: true, select: 'firstname lastname birthDate' }
    );
    
    if (!user) {
      return res.status(404).json({ message: 'کاربر یافت نشد' });
    }
    
    res.json({ message: 'تاریخ تولد با موفقیت به‌روزرسانی شد', user });
  } catch (err) {
    console.error('Error updating birthdate:', err);
    res.status(500).json({ message: 'خطا در به‌روزرسانی تاریخ تولد' });
  }
});



router.delete('/:id', isAdmin, userCtrl.softDelete);   // ← اضافه شود

// ───────────────────────────────
// مدیریت مسدودسازی مشتری توسط فروشنده
// ───────────────────────────────
router.post('/block/:userId',  auth('seller'), userController.blockCustomer);
router.delete('/block/:userId', auth('seller'), userController.unblockCustomer);

// ───────────────────────────────
// روت‌های استریک کاربر
// ───────────────────────────────
router.get('/streak', auth('user'), userStreakController.getStreak);
router.post('/streak/checkin', auth('user'), userStreakController.checkIn);
router.get('/streak/leaderboard', auth('user'), userStreakController.getLeaderboard);

// ───────────────────────────────
// روت‌های کیف پول کاربر
// ───────────────────────────────
router.get('/wallet', auth('user'), userWalletController.getWallet);
router.get('/wallet/transactions', auth('user'), userWalletController.getTransactions);
router.get('/wallet/summary', auth('user'), userWalletController.getWalletSummary);
router.post('/wallet/mission-reward', auth('user'), userWalletController.claimBrowseMissionReward);

// ───────────────────────────────
// ثبت تاریخ تولد و دریافت جایزه
// ───────────────────────────────
router.post('/birthday', auth('user'), userWalletController.setBirthDate);

module.exports = router;
