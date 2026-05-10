const SellerStreak = require('../models/SellerStreak');

/**
 * کنترلر استریک فروشنده
 * 
 * قوانین استریک:
 * - تعریف streak: تعداد روزهای متوالی که فروشنده حداقل یک event معتبر داشته
 * - event معتبر: login به پنل فروشنده (چک‌این)
 * - محاسبه بر اساس timezone Asia/Tehran
 * - چند event در یک روز فقط یک روز حساب می‌شود (idempotent)
 * - اگر امروز event ثبت شد، streak ادامه پیدا می‌کند
 * - اگر دیروز event ثبت شده و امروز هنوز چیزی ثبت نشده، streak موقتاً حفظ می‌شود
 * - اگر یک روز کامل بدون event معتبر گذشت، streak reset می‌شود
 */

/**
 * تبدیل عدد به فارسی
 */
const toPersianNumber = (num) => {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/\d/g, d => persianDigits[d]);
};

/**
 * ثبت ورود روزانه و آپدیت استریک
 * POST /api/streak/checkin
 * 
 * این عملیات idempotent است - اگر همان روز دوبار فراخوانی شود، streak خراب نمی‌شود
 */
exports.checkIn = async (req, res) => {
  try {
    const sellerId = req.user?.sellerId;
    
    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: 'لطفاً وارد حساب کاربری شوید'
      });
    }

    const todayStr = SellerStreak.getTehranDateString();
    const yesterdayStr = SellerStreak.getTehranYesterdayString();

    // دریافت یا ایجاد رکورد استریک
    let streak = await SellerStreak.findOne({ seller: sellerId });
    
    if (!streak) {
      // ایجاد رکورد جدید برای فروشنده
      streak = new SellerStreak({
        seller: sellerId,
        currentStreak: 0,
        longestStreak: 0,
        totalLoginDays: 0,
        loyaltyPoints: 0,
        lastCheckpoint: 0,
        weekHistory: []
      });
    }

    // بررسی آیا امروز قبلاً ثبت شده (idempotency)
    if (streak.lastActiveDate === todayStr) {
      return res.json({
        success: true,
        alreadyCheckedIn: true,
        message: 'امروز قبلاً ثبت شده است',
        data: formatStreakResponse(streak, todayStr)
      });
    }

    // محاسبه وضعیت استریک
    const lastActiveDate = streak.lastActiveDate;
    let newStreak = streak.currentStreak;
    let isNewStreak = false;
    let checkpointReached = false;
    let streakBroken = false;

    if (!lastActiveDate) {
      // اولین ورود
      newStreak = 1;
      isNewStreak = true;
      streak.streakStartDate = new Date();
    } else if (lastActiveDate === yesterdayStr) {
      // روز متوالی - افزایش استریک
      newStreak = streak.currentStreak + 1;
    } else {
      // زنجیره شکسته شد
      const daysDiff = SellerStreak.getDaysDiff(lastActiveDate, todayStr);
      
      if (daysDiff > 1) {
        // بیش از یک روز گذشته - برگشت به آخرین چک‌پوینت
        const checkpoint = Math.floor(streak.currentStreak / 7) * 7;
        newStreak = checkpoint > 0 ? checkpoint : 1;
        streak.streakStartDate = new Date();
        streakBroken = true;
      } else {
        // این نباید اتفاق بیفتد، ولی برای safety
        newStreak = streak.currentStreak + 1;
      }
    }

    // بررسی چک‌پوینت (هر 7 روز)
    if (newStreak > 0 && newStreak % 7 === 0 && newStreak > streak.lastCheckpoint) {
      checkpointReached = true;
      streak.lastCheckpoint = newStreak;
      streak.loyaltyPoints += 50; // پاداش چک‌پوینت
    }

    // آپدیت فیلدها
    streak.currentStreak = newStreak;
    streak.lastActiveDate = todayStr;
    streak.lastLoginDate = new Date();
    streak.totalLoginDays += 1;
    streak.loyaltyPoints += 10; // پاداش روزانه

    // آپدیت رکورد
    if (newStreak > streak.longestStreak) {
      streak.longestStreak = newStreak;
    }

    // آپدیت تاریخچه هفتگی
    streak.weekHistory = updateWeekHistory(streak.weekHistory, todayStr);

    await streak.save();

    // اضافه کردن پاداش به کیف پول (خارج از transaction اصلی)
    try {
      const { addCredit, REWARD_CONFIG } = require('./walletController');
      
      console.log(`🎁 در حال اضافه کردن پاداش استریک برای فروشنده ${sellerId}...`);
      
      // پاداش روزانه
      const dailyReward = await addCredit(sellerId, {
        amount: REWARD_CONFIG.streak_daily || 1000,
        category: 'streak_daily',
        title: isNewStreak ? 'پاداش اولین ورود' : 'پاداش استریک روزانه',
        description: `روز ${newStreak} استریک`,
        relatedType: 'streak'
      });
      
      console.log(`✅ پاداش روزانه ${REWARD_CONFIG.streak_daily || 1000} تومان اضافه شد. موجودی جدید: ${dailyReward.wallet.balance}`);

      // پاداش چک‌پوینت
      if (checkpointReached) {
        const checkpointReward = await addCredit(sellerId, {
          amount: REWARD_CONFIG.streak_checkpoint || 5000,
          category: 'streak_checkpoint',
          title: 'پاداش چک‌پوینت استریک',
          description: `چک‌پوینت ${newStreak} روزه`,
          relatedType: 'streak'
        });
        console.log(`🏆 پاداش چک‌پوینت ${REWARD_CONFIG.streak_checkpoint || 5000} تومان اضافه شد. موجودی جدید: ${checkpointReward.wallet.balance}`);
      }
    } catch (walletErr) {
      console.error('❌ Failed to add streak reward to wallet:', walletErr.message, walletErr.stack);
    }

    // آپدیت رتبه فروشنده
    try {
      const { triggerRankUpdate } = require('./rankController');
      triggerRankUpdate(sellerId).catch(err => console.warn('Rank update failed:', err));
    } catch (rankErr) {
      console.warn('Rank controller not available:', rankErr.message);
    }

    res.json({
      success: true,
      alreadyCheckedIn: false,
      message: getStreakMessage(streak, checkpointReached, streakBroken),
      data: formatStreakResponse(streak, todayStr)
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
 * Query params: days (optional, default: 14) - تعداد روزهای تقویم
 */
exports.getStreak = async (req, res) => {
  try {
    const sellerId = req.user.sellerId;
    const todayStr = SellerStreak.getTehranDateString();
    const yesterdayStr = SellerStreak.getTehranYesterdayString();
    const calendarDays = parseInt(req.query.days) || 14;
    
    let streak = await SellerStreak.findOne({ seller: sellerId });
    
    // ساخت تقویم ۱۴ روز اخیر
    const calendar = generateCalendarDays(calendarDays, streak?.weekHistory || []);
    
    if (!streak) {
      // فروشنده هنوز استریکی ندارد - همه مقادیر صفر
      return res.json({
        success: true,
        data: {
          timezone: 'Asia/Tehran',
          currentStreak: 0,
          longestStreak: 0,
          totalLoginDays: 0,
          lastActiveDate: null,
          streakStartDate: null,
          lastCheckpoint: 0,
          loyaltyPoints: 0,
          weekProgress: 0,
          checkpointReached: false,
          level: calculateLevel(0),
          days: getEmptyWeekDays(),
          calendarDays: calendar,
          activeDaysInLast14: 0,
          dailyReward: '+۱۰ امتیاز وفاداری',
          weeklyReward: '۵,۰۰۰ تومان اعتبار',
          checkpointReward: '+۵۰ امتیاز وفاداری',
          needsCheckIn: true,
          streakAtRisk: false
        }
      });
    }

    // بررسی وضعیت استریک
    const lastActiveDate = streak.lastActiveDate;
    let displayStreak = streak.currentStreak;
    let needsCheckIn = true;
    let streakAtRisk = false;

    if (lastActiveDate === todayStr) {
      // امروز چک‌این شده
      needsCheckIn = false;
    } else if (lastActiveDate === yesterdayStr) {
      // دیروز چک‌این شده - استریک در خطر است
      streakAtRisk = true;
    } else if (lastActiveDate) {
      // بیش از یک روز گذشته - استریک باید reset شود
      const daysDiff = SellerStreak.getDaysDiff(lastActiveDate, todayStr);
      if (daysDiff > 1) {
        const checkpoint = Math.floor(streak.currentStreak / 7) * 7;
        displayStreak = checkpoint > 0 ? checkpoint : 0;
      }
    }

    // محاسبه تعداد روزهای فعال در ۱۴ روز اخیر
    const activeDaysInLast14 = calendar.filter(d => d.active).length;

    res.json({
      success: true,
      data: formatStreakResponse(streak, todayStr, displayStreak, needsCheckIn, streakAtRisk, calendar, activeDaysInLast14)
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

// ===== توابع کمکی =====

/**
 * تولید تقویم روزهای اخیر با داده‌های واقعی
 * @param {number} numDays - تعداد روزها (پیش‌فرض ۱۴)
 * @param {Array} weekHistory - تاریخچه فعالیت‌ها
 * @returns {Array} آرایه روزها با وضعیت فعالیت
 */
function generateCalendarDays(numDays = 14, weekHistory = []) {
  const today = new Date();
  const todayStr = SellerStreak.getTehranDateString();
  const days = [];
  
  // ساخت Set از تاریخ‌های فعال
  const activeDates = new Set();
  if (weekHistory && weekHistory.length > 0) {
    weekHistory.forEach(h => {
      if (h.dateStr && h.status === 'hit') {
        activeDates.add(h.dateStr);
      }
    });
  }
  
  // تولید روزهای تقویم
  for (let i = numDays - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    
    // تبدیل به timezone تهران
    const tehranTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
    const year = tehranTime.getFullYear();
    const month = String(tehranTime.getMonth() + 1).padStart(2, '0');
    const day = String(tehranTime.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const isActive = activeDates.has(dateStr);
    const isToday = dateStr === todayStr;
    
    days.push({
      date: dateStr,
      day: tehranTime.getDate(),
      active: isActive,
      today: isToday
    });
  }
  
  return days;
}

/**
 * آپدیت تاریخچه هفتگی
 */
function updateWeekHistory(history, todayStr) {
  const newHistory = [...(history || [])];
  
  // اضافه کردن امروز
  newHistory.push({
    date: new Date(),
    dateStr: todayStr,
    status: 'hit'
  });

  // فقط 14 روز اخیر رو نگه دار (برای تقویم)
  if (newHistory.length > 14) {
    return newHistory.slice(-14);
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
function getStreakMessage(streak, checkpointReached, streakBroken) {
  const days = streak.currentStreak;
  
  if (streakBroken) {
    return `زنجیره شکست! به چک‌پوینت ${toPersianNumber(streak.lastCheckpoint || 0)} برگشتی`;
  }
  if (days === 1) return 'شروع عالی! اولین روز استریک ثبت شد 🎉';
  if (checkpointReached) return `تبریک! به چک‌پوینت ${toPersianNumber(days)} روزه رسیدی! 🏆`;
  if (days % 30 === 0) return `فوق‌العاده! ${toPersianNumber(days)} روز متوالی! 💎`;
  if (days < 7) return `${toPersianNumber(7 - (days % 7))} روز تا چک‌پوینت بعدی`;
  
  return `ادامه بده! ${toPersianNumber(days)} روز متوالی 🔥`;
}

/**
 * روزهای خالی هفته
 */
function getEmptyWeekDays() {
  const dayLabels = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  return dayLabels.map((label, i) => ({
    label,
    status: 'pending',
    isGift: i === 6
  }));
}

/**
 * فرمت پاسخ استریک
 */
function formatStreakResponse(streak, todayStr, displayStreak = null, needsCheckIn = null, streakAtRisk = null, calendarDays = null, activeDaysInLast14 = null) {
  const currentStreak = displayStreak !== null ? displayStreak : streak.currentStreak;
  const level = calculateLevel(currentStreak);
  const weekProgress = currentStreak % 7;
  const checkpointReached = currentStreak > 0 && currentStreak % 7 === 0;

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

  // اگر تقویم ارسال نشده، تولید کن
  if (!calendarDays) {
    calendarDays = generateCalendarDays(14, streak.weekHistory || []);
  }
  
  // محاسبه روزهای فعال
  if (activeDaysInLast14 === null) {
    activeDaysInLast14 = calendarDays.filter(d => d.active).length;
  }

  return {
    timezone: 'Asia/Tehran',
    currentStreak,
    longestStreak: streak.longestStreak,
    totalLoginDays: streak.totalLoginDays,
    lastActiveDate: streak.lastActiveDate,
    lastLoginDate: streak.lastLoginDate,
    streakStartDate: streak.streakStartDate,
    lastCheckpoint: streak.lastCheckpoint,
    loyaltyPoints: streak.loyaltyPoints,
    weekProgress,
    checkpointReached,
    level,
    days,
    calendarDays,
    activeDaysInLast14,
    needsCheckIn: needsCheckIn !== null ? needsCheckIn : (streak.lastActiveDate !== todayStr),
    streakAtRisk: streakAtRisk !== null ? streakAtRisk : false,
    // پاداش‌ها
    dailyReward: '+۱۰ امتیاز وفاداری',
    weeklyReward: '۵,۰۰۰ تومان اعتبار',
    checkpointReward: '+۵۰ امتیاز وفاداری'
  };
}
