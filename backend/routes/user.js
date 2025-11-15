// backend/routes/users.js
// ────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const User    = require('../models/user');
const userController = require('../controllers/userController');
const userCtrl = require('../controllers/userController');
const isAdmin = require('../middlewares/authMiddleware')('admin');


// ✳️ به‌جای خودِ تابع، خروجی فراخوانی‌اش را می‌دهیم
const auth = require('../middlewares/authMiddleware');
const { protect } = require('../middlewares/authMiddleware');

// ───────────────────────────────
// GET /api/user/profile
// ───────────────────────────────
router.get('/profile', auth('user'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('firstname lastname city phone mobile favorites lastVisit')
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

// Get user's bookings
router.get('/bookings', protect, async (req, res) => {
  console.log('📅 Bookings endpoint hit');
  console.log('User from token:', req.user);
  try {
    const Booking = require('../models/booking');

    const bookings = await Booking.find({
      userId: req.user.id
    })
      .populate('sellerId', '_id shopName shopUrl')
      .sort({ bookingDate: -1, startTime: -1 });

    // Format for frontend
    const formatted = bookings.map(b => ({
      _id: b._id,
      service: b.service,
      sellerName: b.sellerId?.shopName || 'فروشگاه',
      sellerUrl: b.sellerId?.shopUrl,
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
// ───────────────────────────────
router.get('/', auth('admin'), async (req, res) => {
  try {
    const users = await User.find(
      {},
      'firstname lastname email city phone mobile createdAt blockedByAdmin'
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'خطا در دریافت کاربران.' });
  }
});



router.delete('/:id', isAdmin, userCtrl.softDelete);   // ← اضافه شود

// ───────────────────────────────
// مدیریت مسدودسازی مشتری توسط فروشنده
// ───────────────────────────────
router.post('/block/:userId',  auth('seller'), userController.blockCustomer);
router.delete('/block/:userId', auth('seller'), userController.unblockCustomer);

module.exports = router;
