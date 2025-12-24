const mongoose = require('mongoose');

/**
 * مدل تراکنش‌های کیف پول کاربر
 * ثبت تمام واریز و برداشت‌های اعتبار
 */
const userWalletTransactionSchema = new mongoose.Schema({
  // شناسه کاربر
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // نوع تراکنش
  type: {
    type: String,
    enum: ['earn', 'spend', 'refund', 'bonus', 'admin_add', 'admin_deduct'],
    required: true
  },

  // مبلغ (مثبت برای واریز، منفی برای برداشت)
  amount: {
    type: Number,
    required: true
  },

  // موجودی قبل از تراکنش
  balanceBefore: {
    type: Number,
    required: true
  },

  // موجودی بعد از تراکنش
  balanceAfter: {
    type: Number,
    required: true
  },

  // دسته‌بندی فعالیت
  category: {
    type: String,
    enum: [
      'streak_daily',      // پاداش روزانه استریک
      'streak_weekly',     // پاداش هفتگی استریک
      'streak_checkpoint', // پاداش چک‌پوینت
      'booking_complete',  // تکمیل رزرو
      'review_given',      // ثبت نظر
      'browse_stores',     // گردش در بازار
      'referral',          // دعوت دوستان
      'first_booking',     // اولین رزرو
      'profile_complete',  // تکمیل پروفایل
      'birthday',          // ثبت تاریخ تولد
      'discount_used',     // استفاده از تخفیف
      'admin_bonus',       // پاداش ادمین
      'admin_penalty',     // جریمه ادمین
      'other'
    ],
    default: 'other'
  },

  // عنوان تراکنش
  title: {
    type: String,
    required: true
  },

  // توضیحات
  description: {
    type: String,
    default: ''
  },

  // شناسه مرتبط (مثلاً bookingId, reviewId)
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  // نوع موجودیت مرتبط
  relatedType: {
    type: String,
    enum: ['booking', 'review', 'streak', 'referral', 'discount', null],
    default: null
  },

  // متادیتا اضافی
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // آیا توسط ادمین انجام شده
  byAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  }

}, {
  timestamps: true
});

// ایندکس‌های کارآمد
userWalletTransactionSchema.index({ user: 1, createdAt: -1 });
userWalletTransactionSchema.index({ type: 1 });
userWalletTransactionSchema.index({ category: 1 });

module.exports = mongoose.model('UserWalletTransaction', userWalletTransactionSchema);
