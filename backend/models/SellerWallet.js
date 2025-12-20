const mongoose = require('mongoose');

/**
 * مدل کیف پول فروشنده
 * سیستم اعتبار فروشگاه برای خرید خدمات داخلی
 * 
 * Source of Truth: balance_cached یک کش است، source of truth واقعی WalletTransaction (ledger) است
 * همه تغییرات اعتبار فقط از طریق ایجاد ledger entry انجام می‌شود
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

  // موجودی کش شده (به تومان) - برای performance
  // این مقدار باید همیشه با مجموع ledger entries برابر باشد
  balance: {
    type: Number,
    default: 0,
    min: 0
  },

  // موجودی در انتظار (hold شده برای تراکنش‌های pending)
  pendingBalance: {
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
  },

  // آخرین بار که balance از ledger بازسازی شد
  lastReconciledAt: {
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

/**
 * متد استاتیک: بازسازی balance از ledger
 * این متد برای audit و reconciliation استفاده می‌شود
 */
sellerWalletSchema.statics.reconcileBalance = async function(sellerId) {
  const WalletTransaction = mongoose.model('WalletTransaction');
  
  // محاسبه مجموع از ledger
  const result = await WalletTransaction.aggregate([
    { $match: { seller: new mongoose.Types.ObjectId(sellerId) } },
    {
      $group: {
        _id: null,
        totalBalance: { $sum: '$amount' },
        totalEarned: {
          $sum: {
            $cond: [{ $gt: ['$amount', 0] }, '$amount', 0]
          }
        },
        totalSpent: {
          $sum: {
            $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0]
          }
        }
      }
    }
  ]);

  const ledgerData = result[0] || { totalBalance: 0, totalEarned: 0, totalSpent: 0 };

  // آپدیت wallet با مقادیر صحیح
  const wallet = await this.findOneAndUpdate(
    { seller: sellerId },
    {
      $set: {
        balance: Math.max(0, ledgerData.totalBalance),
        totalEarned: ledgerData.totalEarned,
        totalSpent: ledgerData.totalSpent,
        lastReconciledAt: new Date()
      }
    },
    { new: true, upsert: true }
  );

  return wallet;
};

/**
 * متد: دریافت موجودی قابل استفاده (balance - pendingBalance)
 */
sellerWalletSchema.methods.getAvailableBalance = function() {
  return Math.max(0, this.balance - this.pendingBalance);
};

module.exports = mongoose.model('SellerWallet', sellerWalletSchema);
