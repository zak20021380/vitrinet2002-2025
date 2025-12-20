const SellerWallet = require('../models/SellerWallet');
const WalletTransaction = require('../models/WalletTransaction');
const mongoose = require('mongoose');

/**
 * کنترلر کیف پول فروشنده
 * 
 * قوانین:
 * - Source of Truth: WalletTransaction (ledger)
 * - همه تغییرات اعتبار فقط از طریق ایجاد ledger entry انجام می‌شود
 * - balance در SellerWallet یک کش است
 * - تمام عملیات با transaction انجام می‌شود
 * - از optimistic locking برای جلوگیری از race condition استفاده می‌شود
 */

/**
 * تبدیل عدد به فارسی
 */
const toPersianNumber = (num) => {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/\d/g, d => persianDigits[d]);
};

/**
 * فرمت مبلغ به تومان
 */
const formatTomans = (amount) => {
  return toPersianNumber(Number(amount || 0).toLocaleString('fa-IR'));
};

/**
 * پاداش‌های پیش‌فرض برای فعالیت‌ها
 */
const REWARD_CONFIG = {
  streak_daily: 1000,        // پاداش روزانه استریک
  streak_weekly: 5000,       // پاداش هفتگی (چک‌پوینت)
  streak_checkpoint: 5000,   // پاداش چک‌پوینت
  booking_complete: 2000,    // تکمیل نوبت
  review_received: 3000,     // دریافت نظر مثبت
  referral: 10000,           // دعوت دوستان
  first_booking: 5000,       // اولین نوبت
  profile_complete: 3000     // تکمیل پروفایل
};

/**
 * هزینه خدمات
 */
const SERVICE_COSTS = {
  boost_purchase: 20000,     // نردبان آگهی
  vip_badge: 80000,          // نشان VIP
  plan_discount: 50000       // تخفیف پلن
};

/**
 * دریافت کیف پول فروشنده
 * GET /api/wallet
 */
exports.getWallet = async (req, res) => {
  try {
    const sellerId = req.user.id || req.user._id;
    const wallet = await SellerWallet.getOrCreate(sellerId);

    // دریافت 10 تراکنش اخیر
    const recentTransactions = await WalletTransaction.find({ 
      seller: sellerId,
      status: 'completed'
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        balance: wallet.balance,
        availableBalance: wallet.getAvailableBalance(),
        pendingBalance: wallet.pendingBalance,
        totalEarned: wallet.totalEarned,
        totalSpent: wallet.totalSpent,
        lastTransactionAt: wallet.lastTransactionAt,
        formattedBalance: formatTomans(wallet.balance),
        formattedAvailableBalance: formatTomans(wallet.getAvailableBalance()),
        recentTransactions: recentTransactions.map(formatTransaction)
      }
    });

  } catch (err) {
    console.error('❌ خطا در دریافت کیف پول:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت اطلاعات کیف پول'
    });
  }
};

/**
 * دریافت تاریخچه تراکنش‌ها (Ledger)
 * GET /api/wallet/transactions
 */
exports.getTransactions = async (req, res) => {
  try {
    const sellerId = req.user.id || req.user._id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      WalletTransaction.find({ seller: sellerId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WalletTransaction.countDocuments({ seller: sellerId })
    ]);

    res.json({
      success: true,
      data: {
        transactions: transactions.map(formatTransaction),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (err) {
    console.error('❌ خطا در دریافت تراکنش‌ها:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت تاریخچه تراکنش‌ها'
    });
  }
};

/**
 * اضافه کردن اعتبار (پاداش فعالیت)
 * POST /api/wallet/earn
 */
exports.earnCredit = async (req, res) => {
  try {
    const sellerId = req.user.id || req.user._id;
    const { category, relatedId, relatedType, metadata, idempotencyKey } = req.body;

    // بررسی دسته‌بندی معتبر
    if (!REWARD_CONFIG[category]) {
      return res.status(400).json({
        success: false,
        message: 'دسته‌بندی پاداش نامعتبر است'
      });
    }

    const amount = REWARD_CONFIG[category];
    const result = await addCredit(sellerId, {
      amount,
      category,
      title: getRewardTitle(category),
      description: getRewardDescription(category),
      relatedId,
      relatedType,
      metadata,
      idempotencyKey
    });

    res.json({
      success: true,
      message: result.message,
      data: {
        earnedAmount: amount,
        newBalance: result.wallet.balance,
        formattedBalance: formatTomans(result.wallet.balance),
        transaction: formatTransaction(result.transaction)
      }
    });

  } catch (err) {
    console.error('❌ خطا در افزودن اعتبار:', err);
    
    if (err.message === 'DUPLICATE_TRANSACTION') {
      return res.status(409).json({
        success: false,
        message: 'این تراکنش قبلاً ثبت شده است'
      });
    }
    
    res.status(500).json({
      success: false,
      message: err.message || 'خطا در افزودن اعتبار'
    });
  }
};

/**
 * خرج کردن اعتبار (خرید خدمات)
 * POST /api/wallet/spend
 */
exports.spendCredit = async (req, res) => {
  try {
    const sellerId = req.user.id || req.user._id;
    const { serviceType, metadata, idempotencyKey } = req.body;

    // بررسی نوع خدمت معتبر
    if (!SERVICE_COSTS[serviceType]) {
      return res.status(400).json({
        success: false,
        message: 'نوع خدمت نامعتبر است'
      });
    }

    const amount = SERVICE_COSTS[serviceType];
    const wallet = await SellerWallet.getOrCreate(sellerId);
    const availableBalance = wallet.getAvailableBalance();

    // بررسی موجودی کافی
    if (availableBalance < amount) {
      return res.status(400).json({
        success: false,
        message: 'موجودی کافی نیست',
        data: {
          required: amount,
          available: availableBalance,
          shortage: amount - availableBalance
        }
      });
    }

    const result = await deductCredit(sellerId, {
      amount,
      category: serviceType,
      title: getServiceTitle(serviceType),
      description: getServiceDescription(serviceType),
      metadata,
      idempotencyKey
    });

    res.json({
      success: true,
      message: `خدمت "${getServiceTitle(serviceType)}" با موفقیت فعال شد`,
      data: {
        spentAmount: amount,
        newBalance: result.wallet.balance,
        formattedBalance: formatTomans(result.wallet.balance),
        transaction: formatTransaction(result.transaction)
      }
    });

  } catch (err) {
    console.error('❌ خطا در خرج اعتبار:', err);
    
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({
        success: false,
        message: 'موجودی کافی نیست'
      });
    }
    
    if (err.message === 'DUPLICATE_TRANSACTION') {
      return res.status(409).json({
        success: false,
        message: 'این تراکنش قبلاً ثبت شده است'
      });
    }
    
    res.status(500).json({
      success: false,
      message: err.message || 'خطا در خرید خدمت'
    });
  }
};

/**
 * افزودن اعتبار توسط ادمین
 * POST /api/wallet/admin/add
 */
exports.adminAddCredit = async (req, res) => {
  try {
    const { sellerId, amount, reason } = req.body;
    const adminId = req.user.id || req.user._id;

    if (!sellerId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'اطلاعات نامعتبر است'
      });
    }

    const result = await addCredit(sellerId, {
      amount,
      category: 'admin_bonus',
      title: 'پاداش مدیریت',
      description: reason || 'اعتبار اضافه شده توسط مدیریت',
      byAdmin: adminId
    });

    res.json({
      success: true,
      message: `${formatTomans(amount)} تومان به کیف پول فروشنده اضافه شد`,
      data: {
        newBalance: result.wallet.balance
      }
    });

  } catch (err) {
    console.error('❌ خطا در افزودن اعتبار توسط ادمین:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در افزودن اعتبار'
    });
  }
};

/**
 * کسر اعتبار توسط ادمین
 * POST /api/wallet/admin/deduct
 */
exports.adminDeductCredit = async (req, res) => {
  try {
    const { sellerId, amount, reason } = req.body;
    const adminId = req.user.id || req.user._id;

    if (!sellerId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'اطلاعات نامعتبر است'
      });
    }

    const wallet = await SellerWallet.getOrCreate(sellerId);
    if (wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'موجودی فروشنده کافی نیست'
      });
    }

    const result = await deductCredit(sellerId, {
      amount,
      category: 'admin_penalty',
      title: 'کسر توسط مدیریت',
      description: reason || 'اعتبار کسر شده توسط مدیریت',
      byAdmin: adminId
    });

    res.json({
      success: true,
      message: `${formatTomans(amount)} تومان از کیف پول فروشنده کسر شد`,
      data: {
        newBalance: result.wallet.balance
      }
    });

  } catch (err) {
    console.error('❌ خطا در کسر اعتبار توسط ادمین:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در کسر اعتبار'
    });
  }
};


// ===== توابع کمکی با Transaction Support =====

/**
 * افزودن اعتبار به کیف پول (Transaction-Safe)
 * این تابع از MongoDB transaction استفاده می‌کند
 */
async function addCredit(sellerId, options) {
  const { amount, category, title, description, relatedId, relatedType, metadata, byAdmin, idempotencyKey } = options;

  // بررسی idempotency
  if (idempotencyKey) {
    const exists = await WalletTransaction.existsByIdempotencyKey(idempotencyKey);
    if (exists) {
      throw new Error('DUPLICATE_TRANSACTION');
    }
  }

  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    // دریافت wallet با lock
    const wallet = await SellerWallet.findOneAndUpdate(
      { seller: sellerId },
      { $setOnInsert: { seller: sellerId } },
      { upsert: true, new: true, session }
    );

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    // ایجاد تراکنش در ledger
    const transaction = await WalletTransaction.create([{
      seller: sellerId,
      type: byAdmin ? 'admin_add' : 'credit',
      amount,
      balanceBefore,
      balanceAfter,
      category,
      title,
      description,
      relatedId,
      relatedType,
      referenceId: relatedId,
      referenceType: relatedType,
      metadata,
      byAdmin,
      status: 'completed',
      idempotencyKey
    }], { session });

    // آپدیت کیف پول
    wallet.balance = balanceAfter;
    wallet.totalEarned += amount;
    wallet.lastTransactionAt = new Date();
    await wallet.save({ session });

    await session.commitTransaction();

    // آپدیت رتبه فروشنده (خارج از transaction)
    try {
      const { triggerRankUpdate } = require('./rankController');
      triggerRankUpdate(sellerId).catch(err => console.warn('Rank update failed:', err));
    } catch (rankErr) {
      // Rank controller might not be available
    }

    return {
      wallet,
      transaction: transaction[0],
      message: `${formatTomans(amount)} تومان به کیف پول شما اضافه شد`
    };

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * کسر اعتبار از کیف پول (Transaction-Safe)
 * این تابع از MongoDB transaction استفاده می‌کند
 */
async function deductCredit(sellerId, options) {
  const { amount, category, title, description, relatedId, relatedType, metadata, byAdmin, idempotencyKey } = options;

  // بررسی idempotency
  if (idempotencyKey) {
    const exists = await WalletTransaction.existsByIdempotencyKey(idempotencyKey);
    if (exists) {
      throw new Error('DUPLICATE_TRANSACTION');
    }
  }

  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    // دریافت wallet با lock
    const wallet = await SellerWallet.findOne({ seller: sellerId }).session(session);
    
    if (!wallet) {
      throw new Error('WALLET_NOT_FOUND');
    }

    const balanceBefore = wallet.balance;
    const availableBalance = wallet.getAvailableBalance();
    
    if (availableBalance < amount) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    const balanceAfter = balanceBefore - amount;

    // ایجاد تراکنش در ledger
    const transaction = await WalletTransaction.create([{
      seller: sellerId,
      type: byAdmin ? 'admin_deduct' : 'debit',
      amount: -amount,
      balanceBefore,
      balanceAfter,
      category,
      title,
      description,
      relatedId,
      relatedType,
      referenceId: relatedId,
      referenceType: relatedType,
      metadata,
      byAdmin,
      status: 'completed',
      idempotencyKey
    }], { session });

    // آپدیت کیف پول
    wallet.balance = balanceAfter;
    wallet.totalSpent += amount;
    wallet.lastTransactionAt = new Date();
    await wallet.save({ session });

    await session.commitTransaction();

    // آپدیت رتبه فروشنده (خارج از transaction)
    try {
      const { triggerRankUpdate } = require('./rankController');
      triggerRankUpdate(sellerId).catch(err => console.warn('Rank update failed:', err));
    } catch (rankErr) {
      // Rank controller might not be available
    }

    return {
      wallet,
      transaction: transaction[0],
      message: `${formatTomans(amount)} تومان از کیف پول شما کسر شد`
    };

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * فرمت تراکنش برای نمایش
 */
function formatTransaction(tx) {
  const timeAgo = getTimeAgo(tx.createdAt);
  const isPositive = tx.amount > 0;

  return {
    id: tx._id,
    type: tx.type,
    category: tx.category,
    title: tx.title,
    description: tx.description,
    amount: tx.amount,
    formattedAmount: `${isPositive ? '+' : ''}${formatTomans(Math.abs(tx.amount))}`,
    isPositive,
    balanceBefore: tx.balanceBefore,
    balanceAfter: tx.balanceAfter,
    status: tx.status,
    timeAgo,
    createdAt: tx.createdAt
  };
}

/**
 * محاسبه زمان گذشته
 */
function getTimeAgo(date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'همین الان';
  if (diff < 3600) return `${toPersianNumber(Math.floor(diff / 60))} دقیقه پیش`;
  if (diff < 86400) return `${toPersianNumber(Math.floor(diff / 3600))} ساعت پیش`;
  if (diff < 604800) return `${toPersianNumber(Math.floor(diff / 86400))} روز پیش`;
  return `${toPersianNumber(Math.floor(diff / 604800))} هفته پیش`;
}

/**
 * عنوان پاداش
 */
function getRewardTitle(category) {
  const titles = {
    streak_daily: 'پاداش استریک روزانه',
    streak_weekly: 'پاداش هفتگی استریک',
    streak_checkpoint: 'پاداش چک‌پوینت',
    booking_complete: 'تکمیل نوبت',
    review_received: 'دریافت نظر مثبت',
    referral: 'دعوت دوستان',
    first_booking: 'اولین نوبت',
    profile_complete: 'تکمیل پروفایل'
  };
  return titles[category] || 'پاداش';
}

/**
 * توضیح پاداش
 */
function getRewardDescription(category) {
  const descriptions = {
    streak_daily: 'پاداش ورود روزانه به پنل',
    streak_weekly: 'پاداش تکمیل یک هفته استریک',
    streak_checkpoint: 'پاداش رسیدن به چک‌پوینت',
    booking_complete: 'پاداش تکمیل موفق یک نوبت',
    review_received: 'پاداش دریافت نظر مثبت از مشتری',
    referral: 'پاداش دعوت فروشنده جدید',
    first_booking: 'پاداش ثبت اولین نوبت',
    profile_complete: 'پاداش تکمیل اطلاعات پروفایل'
  };
  return descriptions[category] || '';
}

/**
 * عنوان خدمت
 */
function getServiceTitle(serviceType) {
  const titles = {
    boost_purchase: 'نردبان آگهی',
    vip_badge: 'نشان VIP',
    plan_discount: 'تخفیف پلن'
  };
  return titles[serviceType] || 'خدمت';
}

/**
 * توضیح خدمت
 */
function getServiceDescription(serviceType) {
  const descriptions = {
    boost_purchase: 'پروفایل شما به بالای لیست منتقل شد',
    vip_badge: 'نشان VIP برای ۲۴ ساعت فعال شد',
    plan_discount: 'کوپن ۳۰٪ تخفیف پلن دریافت شد'
  };
  return descriptions[serviceType] || '';
}

// Export توابع کمکی برای استفاده در سایر ماژول‌ها
exports.addCredit = addCredit;
exports.deductCredit = deductCredit;
exports.REWARD_CONFIG = REWARD_CONFIG;
exports.SERVICE_COSTS = SERVICE_COSTS;
exports.formatTomans = formatTomans;
