const mongoose = require('mongoose');

/**
 * مدل تراکنش‌های کیف پول
 * ثبت تمام واریز و برداشت‌های اعتبار
 */
const walletTransactionSchema = new mongoose.Schema({
  // شناسه فروشنده
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
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
      'booking_complete',  // تکمیل نوبت
      'review_received',   // دریافت نظر مثبت
      'referral',          // دعوت دوستان
      'first_booking',     // اولین نوبت
      'profile_complete',  // تکمیل پروفایل
      'boost_purchase',    // خرید نردبان آگهی
      'vip_badge',         // خرید نشان VIP
      'plan_discount',     // تخفیف پلن
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
    enum: ['booking', 'review', 'streak', 'referral', 'service', 'plan', null],
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
walletTransactionSchema.index({ seller: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1 });
walletTransactionSchema.index({ category: 1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
