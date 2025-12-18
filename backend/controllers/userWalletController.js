const UserWallet = require('../models/UserWallet');
const UserWalletTransaction = require('../models/UserWalletTransaction');

/**
 * دریافت اطلاعات کیف پول کاربر
 * GET /api/user/wallet
 */
exports.getWallet = async (req, res) => {
  try {
    const userId = req.user.id;
    const wallet = await UserWallet.getOrCreate(userId);

    res.json({
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
      lastTransactionAt: wallet.lastTransactionAt,
      formattedBalance: wallet.balance.toLocaleString('fa-IR')
    });
  } catch (error) {
    console.error('getWallet error:', error);
    res.status(500).json({ message: 'خطا در دریافت اطلاعات کیف پول' });
  }
};

/**
 * دریافت تاریخچه تراکنش‌ها
 * GET /api/user/wallet/transactions
 */
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      UserWalletTransaction.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserWalletTransaction.countDocuments({ user: userId })
    ]);

    const formatted = transactions.map(t => ({
      _id: t._id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      category: t.category,
      title: t.title,
      description: t.description,
      createdAt: t.createdAt,
      isPositive: t.amount > 0,
      formattedAmount: (t.amount > 0 ? '+' : '') + t.amount.toLocaleString('fa-IR'),
      categoryLabel: getCategoryLabel(t.category),
      categoryIcon: getCategoryIcon(t.category)
    }));

    res.json({
      transactions: formatted,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('getTransactions error:', error);
    res.status(500).json({ message: 'خطا در دریافت تراکنش‌ها' });
  }
};

/**
 * دریافت خلاصه کیف پول (برای داشبورد)
 * GET /api/user/wallet/summary
 */
exports.getWalletSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const wallet = await UserWallet.getOrCreate(userId);

    // آخرین 5 تراکنش
    const recentTransactions = await UserWalletTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // آمار این ماه
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyStats = await UserWalletTransaction.aggregate([
      {
        $match: {
          user: wallet.user,
          createdAt: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          earned: { $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] } },
          spent: { $sum: { $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0] } },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = monthlyStats[0] || { earned: 0, spent: 0, count: 0 };

    res.json({
      balance: wallet.balance,
      formattedBalance: wallet.balance.toLocaleString('fa-IR'),
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
      monthlyEarned: stats.earned,
      monthlySpent: stats.spent,
      monthlyTransactions: stats.count,
      recentTransactions: recentTransactions.map(t => ({
        _id: t._id,
        type: t.type,
        amount: t.amount,
        title: t.title,
        createdAt: t.createdAt,
        isPositive: t.amount > 0,
        formattedAmount: (t.amount > 0 ? '+' : '') + t.amount.toLocaleString('fa-IR')
      }))
    });
  } catch (error) {
    console.error('getWalletSummary error:', error);
    res.status(500).json({ message: 'خطا در دریافت خلاصه کیف پول' });
  }
};

/**
 * تابع کمکی: برچسب دسته‌بندی
 */
function getCategoryLabel(category) {
  const labels = {
    streak_daily: 'پاداش روزانه',
    streak_weekly: 'پاداش هفتگی',
    streak_checkpoint: 'چک‌پوینت استریک',
    booking_complete: 'تکمیل رزرو',
    review_given: 'ثبت نظر',
    referral: 'دعوت دوستان',
    first_booking: 'اولین رزرو',
    profile_complete: 'تکمیل پروفایل',
    discount_used: 'استفاده از تخفیف',
    admin_bonus: 'پاداش ویژه',
    admin_penalty: 'کسر اعتبار',
    other: 'سایر'
  };
  return labels[category] || 'سایر';
}

/**
 * تابع کمکی: آیکون دسته‌بندی
 */
function getCategoryIcon(category) {
  const icons = {
    streak_daily: '🔥',
    streak_weekly: '🎯',
    streak_checkpoint: '🏆',
    booking_complete: '✅',
    review_given: '⭐',
    referral: '👥',
    first_booking: '🎉',
    profile_complete: '📝',
    discount_used: '🏷️',
    admin_bonus: '🎁',
    admin_penalty: '⚠️',
    other: '💰'
  };
  return icons[category] || '💰';
}
