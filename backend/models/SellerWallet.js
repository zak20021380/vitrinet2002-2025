const mongoose = require('mongoose');

/**
 * مدل کیف پول فروشنده
 * سیستم اعتبار فروشگاه برای خرید خدمات داخلی
 */
const sellerWalletSchema = new mongoose.Schema({
  // شناسه فروشنده
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    unique: true,
    index: true
  },

  // موجودی فعلی (به تومان)
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
sellerWalletSchema.index({ balance: -1 });

/**
 * متد استاتیک: دریافت یا ایجاد کیف پول
 */
sellerWalletSchema.statics.getOrCreate = async function(sellerId) {
  let wallet = await this.findOne({ seller: sellerId });
  if (!wallet) {
    wallet = await this.create({ seller: sellerId });
  }
  return wallet;
};

module.exports = mongoose.model('SellerWallet', sellerWalletSchema);
