const mongoose = require('mongoose');

/**
 * مدل استریک کاربر
 * هر کاربر یک رکورد استریک دارد که روزانه آپدیت می‌شود
 */
const userStreakSchema = new mongoose.Schema({
  // شناسه کاربر
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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

  // آخرین تاریخ ورود (فقط تاریخ، بدون ساعت)
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

  // تاریخچه هفتگی (7 روز اخیر)
  weekHistory: [{
    date: Date,
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
  }

}, {
  timestamps: true
});

// ایندکس‌های کارآمد
userStreakSchema.index({ currentStreak: -1 });
userStreakSchema.index({ lastLoginDate: -1 });

/**
 * متد استاتیک: دریافت یا ایجاد استریک برای کاربر
 */
userStreakSchema.statics.getOrCreate = async function(userId) {
  let streak = await this.findOne({ user: userId });
  if (!streak) {
    streak = await this.create({ user: userId });
  }
  return streak;
};

/**
 * متد: محاسبه سطح کاربر بر اساس استریک
 */
userStreakSchema.methods.calculateLevel = function() {
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
userStreakSchema.methods.getWeekProgress = function() {
  return this.currentStreak % 7;
};

/**
 * متد: آیا به چک‌پوینت رسیده؟
 */
userStreakSchema.methods.hasReachedCheckpoint = function() {
  return this.currentStreak > 0 && this.currentStreak % 7 === 0;
};

module.exports = mongoose.model('UserStreak', userStreakSchema);
