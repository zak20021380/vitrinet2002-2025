const mongoose = require('mongoose');

/**
 * مدل استریک فروشنده
 * هر فروشنده یک رکورد استریک دارد که روزانه آپدیت می‌شود
 * 
 * Source of Truth: این مدل تنها منبع معتبر برای داده‌های استریک است
 * Timezone: تمام محاسبات بر اساس Asia/Tehran انجام می‌شود
 */
const sellerStreakSchema = new mongoose.Schema({
  // شناسه فروشنده
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    unique: true,
    index: true
  },

  // تعداد روزهای متوالی فعلی
  currentStreak: {
    type: Number,
    default: 0,
    min: 0
  },

  // بیشترین استریک تاریخی (رکورد)
  longestStreak: {
    type: Number,
    default: 0,
    min: 0
  },

  // آخرین تاریخ فعالیت معتبر (فرمت: YYYY-MM-DD در timezone تهران)
  lastActiveDate: {
    type: String,
    default: null,
    index: true
  },

  // آخرین تاریخ ورود (برای سازگاری با کد قبلی)
  lastLoginDate: {
    type: Date,
    default: null
  },

  // تاریخ شروع استریک فعلی
  streakStartDate: {
    type: Date,
    default: null
  },

  // مجموع روزهای ورود از ابتدا
  totalLoginDays: {
    type: Number,
    default: 0,
    min: 0
  },

  // آخرین چک‌پوینت رسیده (هر 7 روز)
  lastCheckpoint: {
    type: Number,
    default: 0,
    min: 0
  },

  // امتیاز وفاداری کسب شده از استریک
  loyaltyPoints: {
    type: Number,
    default: 0,
    min: 0
  },

  // تعداد فریز استفاده شده (برای آینده)
  freezesUsed: {
    type: Number,
    default: 0,
    min: 0
  },

  // تعداد فریز موجود
  freezesAvailable: {
    type: Number,
    default: 0,
    min: 0
  },

  // تاریخچه هفتگی (7 روز اخیر)
  weekHistory: [{
    date: Date,
    dateStr: String, // YYYY-MM-DD
    status: {
      type: String,
      enum: ['hit', 'missed', 'frozen'],
      default: 'hit'
    }
  }],

  // آخرین بار که پاداش هفتگی دریافت شد
  lastWeeklyRewardAt: {
    type: Date,
    default: null
  },

  // آخرین بار که پاداش ماهانه دریافت شد
  lastMonthlyRewardAt: {
    type: Date,
    default: null
  },

  // نسخه برای optimistic locking
  __v: {
    type: Number,
    default: 0
  }

}, {
  timestamps: true,
  optimisticConcurrency: true
});

// ایندکس‌های کارآمد
sellerStreakSchema.index({ currentStreak: -1 });
sellerStreakSchema.index({ lastActiveDate: -1 });
sellerStreakSchema.index({ lastLoginDate: -1 });

/**
 * متد استاتیک: دریافت یا ایجاد استریک برای فروشنده
 */
sellerStreakSchema.statics.getOrCreate = async function(sellerId) {
  let streak = await this.findOne({ seller: sellerId });
  if (!streak) {
    streak = await this.create({ seller: sellerId });
  }
  return streak;
};

/**
 * متد استاتیک: دریافت تاریخ امروز در timezone تهران
 * @returns {string} YYYY-MM-DD
 */
sellerStreakSchema.statics.getTehranDateString = function() {
  const now = new Date();
  // تبدیل به timezone تهران
  const tehranTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
  const year = tehranTime.getFullYear();
  const month = String(tehranTime.getMonth() + 1).padStart(2, '0');
  const day = String(tehranTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * متد استاتیک: دریافت تاریخ دیروز در timezone تهران
 * @returns {string} YYYY-MM-DD
 */
sellerStreakSchema.statics.getTehranYesterdayString = function() {
  const now = new Date();
  const tehranTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
  tehranTime.setDate(tehranTime.getDate() - 1);
  const year = tehranTime.getFullYear();
  const month = String(tehranTime.getMonth() + 1).padStart(2, '0');
  const day = String(tehranTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * متد استاتیک: محاسبه تفاوت روزها بین دو تاریخ
 * @param {string} date1 YYYY-MM-DD
 * @param {string} date2 YYYY-MM-DD
 * @returns {number}
 */
sellerStreakSchema.statics.getDaysDiff = function(date1, date2) {
  if (!date1 || !date2) return Infinity;
  const d1 = new Date(date1 + 'T00:00:00');
  const d2 = new Date(date2 + 'T00:00:00');
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
};

/**
 * متد: محاسبه سطح فروشنده بر اساس استریک
 */
sellerStreakSchema.methods.calculateLevel = function() {
  const days = this.currentStreak;
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
    ...tier,
    currentDays: days,
    daysToNext: nextTier ? nextTier.min - days : 0,
    nextTierName: nextTier ? nextTier.name : null
  };
};

/**
 * متد: محاسبه پیشرفت هفتگی
 */
sellerStreakSchema.methods.getWeekProgress = function() {
  return this.currentStreak % 7;
};

/**
 * متد: آیا به چک‌پوینت رسیده؟
 */
sellerStreakSchema.methods.hasReachedCheckpoint = function() {
  return this.currentStreak > 0 && this.currentStreak % 7 === 0;
};

module.exports = mongoose.model('SellerStreak', sellerStreakSchema);
