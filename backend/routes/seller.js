const express = require('express');
const router = express.Router();
const { getCurrentSeller } = require('../controllers/authController');

const {
  registerSeller,
  deleteSeller,
  upgradeSeller,
  updateAdminScore,
  clearAdminScore,
  listSellerPerformance,
  getCurrentSellerPerformanceStatus,
  getDashboardStats,
  getMonthlyBookingInsights,
  getTopServicePeers,
  blockSeller,
  unblockSeller
} = require('../controllers/sellerController');
const Seller = require('../models/Seller');
const authMiddleware = require('../middlewares/authMiddleware');
const mongoose = require('mongoose');   
const Chat = require('../models/chat');
// ثبت‌نام فروشنده
router.post('/register', registerSeller);

// ثبت‌نام فروشنده (مسیر RESTful)
router.post('/', registerSeller);

// گرفتن اطلاعات فروشنده‌ی جاری
router.get('/me', authMiddleware('seller'), async (req, res) => {
  try {
    const seller = await Seller.findById(req.user.id)
      .select('-password -otp -otpExpire')
      .lean();
    if (!seller) return res.status(404).json({ message: 'فروشنده پیدا نشد!' });
    seller.id = seller._id;
    res.json(seller);
  } catch (err) {
    console.error('get /me error', err);
    res.status(500).json({ message: 'خطای سرور.' });
  }
});

// به‌روزرسانی اطلاعات فروشنده (شماره تلفن و آدرس)
router.put('/me', authMiddleware('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id || req.user._id;
    const { phone, address, storename } = req.body;
    
    // اعتبارسنجی نام کسب‌وکار
    if (storename !== undefined) {
      const trimmedName = String(storename).trim();
      if (trimmedName.length < 2) {
        return res.status(400).json({ 
          success: false, 
          message: 'نام کسب‌وکار باید حداقل ۲ کاراکتر باشد.' 
        });
      }
      if (trimmedName.length > 50) {
        return res.status(400).json({ 
          success: false, 
          message: 'نام کسب‌وکار نباید بیشتر از ۵۰ کاراکتر باشد.' 
        });
      }
    }
    
    // اعتبارسنجی شماره تلفن
    if (phone !== undefined) {
      const phoneRegex = /^09[0-9]{9}$/;
      const normalizedPhone = String(phone).replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]);
      if (!phoneRegex.test(normalizedPhone)) {
        return res.status(400).json({ 
          success: false, 
          message: 'شماره تلفن نامعتبر است. لطفاً شماره موبایل ۱۱ رقمی وارد کنید.' 
        });
      }
    }
    
    // ساخت آبجکت به‌روزرسانی
    const updateData = {};
    if (phone !== undefined) {
      updateData.phone = String(phone).replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]);
    }
    if (address !== undefined) {
      updateData.address = String(address).trim();
    }
    if (storename !== undefined) {
      updateData.storename = String(storename).trim();
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'هیچ فیلدی برای به‌روزرسانی ارسال نشده است.' 
      });
    }
    
    updateData.updatedAt = new Date();
    
    const seller = await Seller.findByIdAndUpdate(
      sellerId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpire');
    
    if (!seller) {
      return res.status(404).json({ 
        success: false, 
        message: 'فروشنده پیدا نشد!' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'اطلاعات با موفقیت به‌روزرسانی شد.',
      seller: {
        id: seller._id,
        phone: seller.phone,
        address: seller.address,
        storename: seller.storename
      }
    });
  } catch (err) {
    console.error('update /me error', err);
    res.status(500).json({ 
      success: false, 
      message: 'خطا در به‌روزرسانی اطلاعات.' 
    });
  }
});

// دریافت فروشنده بر اساس shopurl (عمومی)
router.get('/by-shopurl/:shopurl', async (req, res) => {
  try {
    const seller = await Seller.findOne({ shopurl: req.params.shopurl })
      .select('-password -otp -otpExpire')
      .lean();
    if (!seller) return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    seller.id = seller._id;
    res.json(seller);
  } catch (err) {
    console.error('get by-shopurl error', err);
    res.status(500).json({ message: 'خطای سرور.' });
  }
});

// آپلود یا تغییر لوگوی فروشگاه (تابلو)
router.post('/:sellerId/logo', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { logo } = req.body;
    if (!logo) return res.status(400).json({ message: "لوگو ارسال نشده!" });

    const seller = await Seller.findByIdAndUpdate(
      sellerId,
      { boardImage: logo },
      { new: true }
    );
    if (!seller) return res.status(404).json({ message: "فروشنده پیدا نشد!" });

    res.json({ message: "تابلو ثبت شد!", boardImage: seller.boardImage });
  } catch (err) {
    console.error("خطا در ثبت لوگو:", err);
    res.status(500).json({ message: "خطای سرور!" });
  }
});

// گرفتن لیست همهٔ فروشنده‌ها (فقط ادمین)
router.get('/', authMiddleware('admin'), async (req, res) => {
  try {
    const sellers = await Seller.find({}, {
      _id: 1,
      firstname: 1,
      lastname: 1,
      storename: 1,
      shopurl: 1,
      phone: 1,
      createdAt: 1,
      productsCount: 1,
      visits: 1,
      blockedByAdmin: 1,
      blockedAt: 1,
      blockedBy: 1,
      blockedReason: 1,
      address: 1,
      category: 1,
      desc: 1,
      subscriptionStart: 1,
      subscriptionEnd: 1,
      isPremium: 1
    }).lean();

    const sellersWithId = sellers.map(seller => {
      const ownerFirstname = seller.firstname || '';
      const ownerLastname = seller.lastname || '';
      const ownerName = [ownerFirstname, ownerLastname].filter(Boolean).join(' ').trim();

      return {
        ...seller,
        sellerId: seller._id.toString(),
        ownerFirstname,
        ownerLastname,
        ownerName,
        shopAddress: seller.address || '',
        shopLogoText: seller.storename || '',
        subscriptionType: seller.isPremium ? 'premium' : '',
        mobile: seller.phone || ''
      };
    });

    res.json(sellersWithId);
  } catch (err) {
    console.error('❌ خطا در دریافت لیست فروشنده‌ها:', err);
    res.status(500).json({ message: 'خطا در دریافت فروشنده‌ها.' });
  }
});

// بروزرسانی ساعت کاری فروشنده
router.put('/working-hours', authMiddleware('seller'), async (req, res) => {
  try {
    const { startTime, endTime } = req.body || {};
    const sellerId = req.user && (req.user.id || req.user._id);
    const seller = await Seller.findByIdAndUpdate(
      sellerId,
      { startTime, endTime },
      { new: true }
    );
    if (!seller) return res.status(404).json({ message: 'فروشنده پیدا نشد!' });
    res.json({ startTime: seller.startTime, endTime: seller.endTime });
  } catch (err) {
    console.error('update working hours error', err);
    res.status(500).json({ message: 'خطای سرور.' });
  }
});

router.get('/profile', authMiddleware('seller'), getCurrentSeller);
router.get('/dashboard/stats', authMiddleware('seller'), getDashboardStats);
router.get('/dashboard/bookings/monthly', authMiddleware('seller'), getMonthlyBookingInsights);
router.get('/top-peers', authMiddleware('seller'), getTopServicePeers);

// ===== Dashboard Metrics API =====
// GET /api/sellers/me/dashboard-metrics
// دریافت متریک‌های داشبورد شامل streak و wallet
router.get('/me/dashboard-metrics', authMiddleware('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id || req.user._id;
    
    // Import models
    const SellerStreak = require('../models/SellerStreak');
    const SellerWallet = require('../models/SellerWallet');
    
    // دریافت داده‌ها به صورت موازی
    const [streak, wallet] = await Promise.all([
      SellerStreak.findOne({ seller: sellerId }).lean(),
      SellerWallet.findOne({ seller: sellerId }).lean()
    ]);
    
    // محاسبه وضعیت استریک
    const todayStr = SellerStreak.getTehranDateString();
    const yesterdayStr = SellerStreak.getTehranYesterdayString();
    
    let currentStreakDays = 0;
    let longestStreakDays = 0;
    let lastActiveDate = null;
    let streakAtRisk = false;
    
    if (streak) {
      currentStreakDays = streak.currentStreak || 0;
      longestStreakDays = streak.longestStreak || 0;
      lastActiveDate = streak.lastActiveDate;
      
      // بررسی وضعیت استریک
      if (lastActiveDate === yesterdayStr) {
        streakAtRisk = true;
      } else if (lastActiveDate && lastActiveDate !== todayStr) {
        const daysDiff = SellerStreak.getDaysDiff(lastActiveDate, todayStr);
        if (daysDiff > 1) {
          const checkpoint = Math.floor(currentStreakDays / 7) * 7;
          currentStreakDays = checkpoint > 0 ? checkpoint : 0;
        }
      }
    }
    
    // محاسبه موجودی کیف پول
    const storeBalanceIrr = wallet?.balance || 0;
    const availableBalance = wallet ? Math.max(0, wallet.balance - (wallet.pendingBalance || 0)) : 0;
    const pendingBalance = wallet?.pendingBalance || 0;
    
    res.json({
      success: true,
      data: {
        // Streak metrics
        current_streak_days: currentStreakDays,
        longest_streak_days: longestStreakDays,
        last_active_date: lastActiveDate,
        streak_at_risk: streakAtRisk,
        
        // Wallet metrics
        store_balance_irr: storeBalanceIrr,
        available_balance_irr: availableBalance,
        pending_balance_irr: pendingBalance,
        
        // Timestamps
        fetched_at: new Date().toISOString()
      }
    });
    
  } catch (err) {
    console.error('❌ خطا در دریافت متریک‌های داشبورد:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت متریک‌های داشبورد'
    });
  }
});

// ارتقا حساب فروشنده (خرید اشتراک/پرمیوم)
router.post('/upgrade', authMiddleware('seller'), upgradeSeller);


// وضعیت عملکرد فروشنده (ادمین)
router.get('/performance', authMiddleware('admin'), listSellerPerformance);
router.put('/performance/:sellerId', authMiddleware('admin'), updateAdminScore);
router.delete('/performance/:sellerId', authMiddleware('admin'), clearAdminScore);

router.patch('/:sellerId/block', authMiddleware('admin'), blockSeller);
router.patch('/:sellerId/unblock', authMiddleware('admin'), unblockSeller);

// وضعیت عملکرد برای خود فروشنده
router.get('/performance/status', authMiddleware('seller'), getCurrentSellerPerformanceStatus);

// ═══════════════════════════════════════════════════════════════
// Routes نظرات محصولات فروشنده
// ═══════════════════════════════════════════════════════════════
const productCommentController = require('../controllers/productCommentController');

// دریافت نظرات در انتظار تأیید
router.get('/pending-comments', authMiddleware('seller'), productCommentController.getPendingComments);

// دریافت تعداد نظرات در انتظار
router.get('/pending-comments/count', authMiddleware('seller'), productCommentController.getPendingCount);

// دریافت همه نظرات فروشنده (با فیلتر)
router.get('/comments', authMiddleware('seller'), productCommentController.getSellerComments);

// ═══════════════════════════════════════════════════════════════
// Routes اعلان‌های فروشنده
// ═══════════════════════════════════════════════════════════════
const sellerNotificationController = require('../controllers/sellerNotificationController');

// دریافت لیست اعلان‌ها
router.get('/notifications', authMiddleware('seller'), sellerNotificationController.getNotifications);

// دریافت تعداد اعلان‌های خوانده نشده
router.get('/notifications/unread-count', authMiddleware('seller'), sellerNotificationController.getUnreadCount);

// علامت‌گذاری همه اعلان‌ها به عنوان خوانده شده
router.put('/notifications/mark-all-read', authMiddleware('seller'), sellerNotificationController.markAllAsRead);

// حذف همه اعلان‌ها
router.delete('/notifications/clear-all', authMiddleware('seller'), sellerNotificationController.clearAll);

// علامت‌گذاری یک اعلان به عنوان خوانده شده
router.put('/notifications/:id/read', authMiddleware('seller'), sellerNotificationController.markAsRead);

// حذف یک اعلان
router.delete('/notifications/:id', authMiddleware('seller'), sellerNotificationController.deleteNotification);

// ایجاد اعلان تست (فقط برای تست)
router.post('/notifications/test', authMiddleware('seller'), sellerNotificationController.createTestNotification);

// ——— ارسال پیام از فروشنده به مدیر سایت ———
router.post(
  '/contact-admin',
  authMiddleware('seller'),
  async (req, res) => {
    try {
      const sellerId = req.user && (req.user.id || req.user._id);
      const { message } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'متن پیام لازم است.' });
      }
      console.log(`پیام از فروشنده ${sellerId}: ${message}`);
      return res.json({ message: 'پیام شما با موفقیت ارسال شد.' });
    } catch (err) {
      console.error('❌ خطا در ارسال پیام به مدیر:', err);
      return res.status(500).json({ error: 'خطای سرور، لطفاً مجدداً تلاش کنید.' });
    }
  }
);

// حذف فروشنده - فقط ادمین
router.delete('/:sellerId', authMiddleware('admin'), deleteSeller);



// ‹‹— ‹ Route جدید برای گرفتن یک فروشندهٔ خاص —››
// گرفتن یک فروشندهٔ خاص به همراه پسورد (فقط برای ادمین یا خود فروشنده)
// ================================================
// GET  /api/sellers/:sellerId
// دسترسی: ادمین ‑ یا همان فروشنده
// ================================================
// ‹‹— Route جدید برای گرفتن یک فروشندهٔ خاص به همراه پسورد —››
// دسترسی: فقط ادمین
router.get(
  '/:sellerId',
  authMiddleware('admin'),    // ← اینجا تغییر کرد: فقط نقش 'admin' پذیرفته می‌شود
  async (req, res) => {
    try {
      let { sellerId } = req.params;              // shopurl:... یا شناسه
      let query;

      // 1) اگر shopurl:slug بود
      if (sellerId.startsWith('shopurl:')) {
        query = { shopurl: sellerId.replace(/^shopurl:/, '') };
      }
      // 2) اگر یک ObjectId معتبر بود
      else if (mongoose.Types.ObjectId.isValid(sellerId)) {
        query = { _id: sellerId };
      }
      // 3) در غیر این صورت همان اسلاگ فروشگاه
      else {
        query = { shopurl: sellerId };
      }

      // ─── واکشی فروشنده + پسورد ───
      const seller = await Seller.findOne(query).select(
        '+password firstname lastname storename shopurl phone address ' +
        'createdAt productsCount visits blockedByAdmin blockedAt blockedBy blockedReason ' +
        'subscriptionStart subscriptionEnd isPremium category desc'
      ).lean();

      if (!seller)
        return res.status(404).json({ message: 'فروشنده پیدا نشد!' });

      // برای ادمین دیگه نیازی به کنترل isOwner نیست
      seller.sellerId = seller._id.toString();     // برای فرانت
      res.json(seller);

    } catch (err) {
      console.error('❌ خطا در دریافت فروشنده:', err);
      res.status(500).json({ message: 'خطای سرور.' });
    }
  }
);






module.exports = router;
