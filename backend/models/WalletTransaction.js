const mongoose = require('mongoose');

/**
 * مدل تراکنش‌های کیف پول (Ledger)
 * 
 * این مدل Source of Truth برای تمام تغییرات اعتبار است
 * همه تغییرات اعتبار فقط از طریق ایجاد entry در این ledger انجام می‌شود
 * balance در SellerWallet یک کش است که از این ledger محاسبه می‌شود
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
    enum: ['credit', 'debit', 'hold', 'release', 'admin_add', 'admin_deduct'],
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
      'hold',              // نگهداری موقت
      'release',           // آزادسازی نگهداری
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

  // شناسه مرتبط (مثلاً bookingId, reviewId, orderId)
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  // نوع موجودیت مرتبط
  referenceType: {
    type: String,
    enum: ['booking', 'review', 'streak', 'referral', 'service', 'plan', 'order', 'invoice', null],
    default: null
  },

  // برای سازگاری با کد قبلی
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
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
  },

  // وضعیت تراکنش
  status: {
    type: String,
    enum: ['completed', 'pending', 'cancelled', 'reversed'],
    default: 'completed'
  },

  // شناسه تراکنش معکوس (اگر این تراکنش reverse شده باشد)
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WalletTransaction',
    default: null
  },

  // شناسه تراکنش اصلی (اگر این یک reversal باشد)
  reversalOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WalletTransaction',
    default: null
  },

  // idempotency key برای جلوگیری از تراکنش‌های تکراری
  idempotencyKey: {
    type: String,
    sparse: true,
    index: true
  }

}, {
  timestamps: true
});

// ایندکس‌های کارآمد
walletTransactionSchema.index({ seller: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1 });
walletTransactionSchema.index({ category: 1 });
walletTransactionSchema.index({ status: 1 });
walletTransactionSchema.index({ referenceId: 1, referenceType: 1 });

/**
 * متد استاتیک: بررسی وجود تراکنش با idempotency key
 */
walletTransactionSchema.statics.existsByIdempotencyKey = async function(key) {
  if (!key) return false;
  const existing = await this.findOne({ idempotencyKey: key });
  return !!existing;
};

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
