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
      lastVisit:      user.lastVisit || ''
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
    const { name, phone, customerId } = req.body || {};

    if (!name || !phone) {
      return res.status(400).json({ message: 'نام و شماره تماس الزامی است' });
    }

    // در این نسخهٔ ساده فقط موفقیت را برمی‌گردانیم
    // می‌توان در آینده ذخیره‌سازی در پایگاه‌داده را نیز افزود
    res.json({ message: 'پروفایل با موفقیت ذخیره شد', name, phone, customerId });
  } catch (err) {
    console.error('profile save error:', err);
    res.status(500).json({ message: 'خطا در ذخیره پروفایل کاربر' });
  }
}

router.post('/profile', saveProfile);
router.put('/profile', saveProfile);

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
module.exports = router;

// ───────────────────────────────
// POST /api/user/block/:userId    (فروشنده باید لاگین باشد)
// ───────────────────────────────
router.post('/block/:userId', auth('seller'), userController.blockCustomer);


module.exports = router;
