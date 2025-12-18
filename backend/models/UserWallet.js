const mongoose = require('mongoose');

/**
 * مدل کیف پول کاربر
 * سیستم اعتبار کاربر برای تخفیف و خدمات
 */
const userWalletSchema = new mongoose.Schema({
  // شناسه کاربر
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  // موجودی فعلی (تومان)
  balance: {
    type: Number,
    default: 0,
    min: 0
  },

  // مجموع اعتبار کسب شده از ابتدا
  totalEarned: {
    type: Number,
    default: 0,
    min: 0
  },

  // مجموع اعتبار مصرف شده
  totalSpent: {
    type: Number,
    default: 0,
    min: 0
  },

  // آخرین تراکنش
  lastTransactionAt: {
    type: Date,
    default: null
  }

}, {
  timestamps: true
});

// ایندکس‌ها
userWalletSchema.index({ balance: -1 });

/**
 * متد استاتیک: دریافت یا ایجاد کیف پول
 */
userWalletSchema.statics.getOrCreate = async function(userId) {
  let wallet = await this.findOne({ user: userId });
  if (!wallet) {
    wallet = await this.create({ user: userId });
  }
  return wallet;
};

module.exports = mongoose.model('UserWallet', userWalletSchema);
