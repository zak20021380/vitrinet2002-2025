const SellerStreak = require('../models/SellerStreak');
const { addCredit, REWARD_CONFIG } = require('./walletController');
const { triggerRankUpdate } = require('./rankController');

/**
 * تبدیل تاریخ به فرمت فقط روز (بدون ساعت) برای مقایسه
 */
const getDateOnly = (date) => {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/**
 * تبدیل عدد به فارسی
 */
const toPersianNumber = (num) => {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/\d/g, d => persianDigits[d]);
};

/**
 * محاسبه تفاوت روزها
 */
const getDaysDiff = (date1, date2) => {
  const d1 = getDateOnly(date1);
  const d2 = getDateOnly(date2);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
};

/**
 * ثبت ورود روزانه و آپدیت استریک
 * POST /api/streak/checkin
 */
exports.checkIn = async (req, res) => {
  try {
    const sellerId = req.user.id || req.user._id;
    const today = getDateOnly(new Date());

    // دریافت یا ایجاد رکورد استریک
    let streak = await SellerStreak.getOrCreate(sellerId);

    // بررسی آیا امروز قبلاً ثبت شده
    if (streak.lastLoginDate) {
      const lastLogin = getDateOnly(streak.lastLoginDate);
      const daysDiff = getDaysDiff(lastLogin, today);

      if (daysDiff === 0) {
        // امروز قبلاً ثبت شده
        return res.json({
          success: true,
          alreadyCheckedIn: true,
          message: 'امروز قبلاً ثبت شده است',
          data: formatStreakResponse(streak)
        });
      }

      if (daysDiff === 1) {
        // روز متوالی - افزایش استریک
        streak.currentStreak += 1;
        streak.totalLoginDays += 1;
        streak.loyaltyPoints += 10; // 10 امتیاز برای هر روز

        // اضافه کردن پاداش روزانه به کیف پول
        try {
          await addCredit(sellerId, {
            amount: REWARD_CONFIG.streak_daily || 1000,
            category: 'streak_daily',
            title: 'پاداش استریک روزانه',
            description: `روز ${streak.currentStreak} استریک`,
            relatedType: 'streak'
          });
        } catch (walletErr) {
          console.warn('Failed to add daily streak reward to wallet:', walletErr.message);
        }

        // بررسی چک‌پوینت (هر 7 روز)
        if (streak.currentStreak % 7 === 0) {
          streak.lastCheckpoint = streak.currentStreak;
          streak.loyaltyPoints += 50; // پاداش چک‌پوینت

          // اضافه کردن پاداش چک‌پوینت به کیف پول
          try {
            await addCredit(sellerId, {
              amount: REWARD_CONFIG.streak_checkpoint || 5000,
              category: 'streak_checkpoint',
              title: 'پاداش چک‌پوینت استریک',
              description: `چک‌پوینت ${streak.currentStreak} روزه`,
              relatedType: 'streak'
            });
          } catch (walletErr) {
            console.warn('Failed to add checkpoint reward to wallet:', walletErr.message);
          }
        }

        // آپدیت رکورد
        if (streak.currentStreak > streak.longestStreak) {
          streak.longestStreak = streak.currentStreak;
        }

      } else if (daysDiff > 1) {
        // زنجیره شکسته شد
        const previousStreak = streak.currentStreak;
        const checkpoint = Math.floor(previousStreak / 7) * 7;
        
        // برگشت به آخرین چک‌پوینت
        streak.currentStreak = checkpoint > 0 ? checkpoint : 1;
        streak.streakStartDate = today;
        streak.totalLoginDays += 1;
        streak.loyaltyPoints += 5; // امتیاز کمتر برای شروع مجدد

        // اگر چک‌پوینت نداشت، از 1 شروع کن
        if (checkpoint === 0) {
          streak.currentStreak = 1;
        }
      }
    } else {
      // اولین ورود
      streak.currentStreak = 1;
      streak.totalLoginDays = 1;
      streak.streakStartDate = today;
      streak.loyaltyPoints = 10;

      // پاداش اولین ورود
      try {
        await addCredit(sellerId, {
          amount: REWARD_CONFIG.streak_daily || 1000,
          category: 'streak_daily',
          title: 'پاداش اولین ورود',
          description: 'خوش آمدید! اولین روز استریک شما',
          relatedType: 'streak'
        });
      } catch (walletErr) {
        console.warn('Failed to add first login reward to wallet:', walletErr.message);
      }
    }

    // آپدیت تاریخ آخرین ورود
    streak.lastLoginDate = today;

    // آپدیت تاریخچه هفتگی
    streak.weekHistory = updateWeekHistory(streak.weekHistory, today);

    await streak.save();

    // آپدیت رتبه فروشنده
    triggerRankUpdate(sellerId).catch(err => console.warn('Rank update failed:', err));

    res.json({
      success: true,
      alreadyCheckedIn: false,
      message: getStreakMessage(streak),
      data: formatStreakResponse(streak)
    });

  } catch (err) {
    console.error('❌ خطا در ثبت استریک:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در ثبت ورود روزانه'
    });
  }
};

/**
 * دریافت وضعیت استریک فروشنده
 * GET /api/streak
 */
exports.getStreak = async (req, res) => {
  try {
    const sellerId = req.user.id || req.user._id;
    const streak = await SellerStreak.getOrCreate(sellerId);

    res.json({
      success: true,
      data: formatStreakResponse(streak)
    });

  } catch (err) {
    console.error('❌ خطا در دریافت استریک:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت اطلاعات استریک'
    });
  }
};

/**
 * دریافت لیدربورد استریک (برترین‌ها)
 * GET /api/streak/leaderboard
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const leaderboard = await SellerStreak.find({ currentStreak: { $gt: 0 } })
      .sort({ currentStreak: -1, longestStreak: -1 })
      .limit(limit)
      .populate('seller', 'storename shopurl boardImage')
      .lean();

    const formatted = leaderboard.map((item, index) => ({
      rank: index + 1,
      sellerId: item.seller?._id,
      storeName: item.seller?.storename || 'فروشگاه',
      shopUrl: item.seller?.shopurl,
      avatar: item.seller?.boardImage,
      currentStreak: item.currentStreak,
      longestStreak: item.longestStreak,
      level: calculateLevel(item.currentStreak)
    }));

    res.json({
      success: true,
      data: formatted
    });

  } catch (err) {
    console.error('❌ خطا در دریافت لیدربورد:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت لیدربورد'
    });
  }
};

/**
 * آپدیت تاریخچه هفتگی
 */
function updateWeekHistory(history, today) {
  const newHistory = [...(history || [])];
  
  // اضافه کردن امروز
  newHistory.push({
    date: today,
    status: 'hit'
  });

  // فقط 7 روز اخیر رو نگه دار
  if (newHistory.length > 7) {
    return newHistory.slice(-7);
  }

  return newHistory;
}

/**
 * محاسبه سطح فروشنده
 */
function calculateLevel(days) {
  const tiers = [
    { min: 0, max: 7, name: 'تازه‌کار', icon: '🌱', color: '#22d3ee' },
    { min: 7, max: 30, name: 'فعال', icon: '⭐', color: '#fbbf24' },
    { min: 30, max: 60, name: 'نقره‌ای', icon: '🥈', color: '#94a3b8' },
    { min: 60, max: 90, name: 'طلایی', icon: '🏆', color: '#f59e0b' },
    { min: 90, max: Infinity, name: 'الماس', icon: '💎', color: '#8b5cf6' }
  ];

  const tier = tiers.find(t => days >= t.min && days < t.max) || tiers[tiers.length - 1];
  const nextTier = tiers[tiers.indexOf(tier) + 1];

  return {
    name: tier.name,
    icon: tier.icon,
    color: tier.color,
    daysToNext: nextTier ? Math.max(0, nextTier.min - days) : 0,
    nextTierName: nextTier ? nextTier.name : null,
    progress: nextTier 
      ? Math.round(((days - tier.min) / (nextTier.min - tier.min)) * 100)
      : 100
  };
}

/**
 * پیام مناسب برای استریک
 */
function getStreakMessage(streak) {
  const days = streak.currentStreak;
  
  if (days === 1) return 'شروع عالی! اولین روز استریک ثبت شد 🎉';
  if (days % 7 === 0) return `تبریک! به چک‌پوینت ${toPersianNumber(days)} روزه رسیدی! 🏆`;
  if (days % 30 === 0) return `فوق‌العاده! ${toPersianNumber(days)} روز متوالی! 💎`;
  if (days < 7) return `${toPersianNumber(7 - (days % 7))} روز تا چک‌پوینت بعدی`;
  
  return `ادامه بده! ${toPersianNumber(days)} روز متوالی 🔥`;
}

/**
 * فرمت پاسخ استریک
 */
function formatStreakResponse(streak) {
  const level = calculateLevel(streak.currentStreak);
  const weekProgress = streak.currentStreak % 7;
  const checkpointReached = streak.currentStreak > 0 && streak.currentStreak % 7 === 0;

  // ساخت وضعیت روزهای هفته
  const days = [];
  const dayLabels = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  
  for (let i = 0; i < 7; i++) {
    let status = 'pending';
    if (i < weekProgress) {
      status = 'hit';
    } else if (checkpointReached && i === 0) {
      status = 'hit';
    }
    
    days.push({
      label: dayLabels[i],
      status,
      isGift: i === 6
    });
  }

  return {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    totalLoginDays: streak.totalLoginDays,
    lastLoginDate: streak.lastLoginDate,
    streakStartDate: streak.streakStartDate,
    lastCheckpoint: streak.lastCheckpoint,
    loyaltyPoints: streak.loyaltyPoints,
    weekProgress,
    checkpointReached,
    level,
    days,
    // پاداش‌ها
    dailyReward: '+۱۰ امتیاز وفاداری',
    weeklyReward: '۵,۰۰۰ تومان اعتبار',
    checkpointReward: '+۵۰ امتیاز وفاداری'
  };
}
