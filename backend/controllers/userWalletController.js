const UserWallet = require('../models/UserWallet');
const UserWalletTransaction = require('../models/UserWalletTransaction');
const User = require('../models/user');

const BIRTHDAY_REWARD_AMOUNT = 500; // مبلغ جایزه ثبت تاریخ تولد (تومان)
const BROWSE_PRODUCTS_REWARD_AMOUNT = 200; // مبلغ جایزه گردش در بازار (تومان)

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
    browse_stores: 'گردش در بازار',
    referral: 'دعوت دوستان',
    first_booking: 'اولین رزرو',
    profile_complete: 'تکمیل پروفایل',
    birthday: 'ثبت تاریخ تولد',
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
    browse_stores: '🧭',
    referral: '👥',
    first_booking: '🎉',
    profile_complete: '📝',
    birthday: '🎂',
    discount_used: '🏷️',
    admin_bonus: '🎁',
    admin_penalty: '⚠️',
    other: '💰'
  };
  return icons[category] || '💰';
}


/**
 * ثبت تاریخ تولد و دریافت جایزه
 * POST /api/user/birthday
 */
exports.setBirthDate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { birthDate } = req.body;

    // اعتبارسنجی فرمت تاریخ (مثلاً "1375/06/20")
    if (!birthDate || !/^\d{4}\/\d{2}\/\d{2}$/.test(birthDate)) {
      return res.status(400).json({ 
        message: 'فرمت تاریخ تولد نامعتبر است. فرمت صحیح: 1375/06/20' 
      });
    }

    // دریافت کاربر
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'کاربر یافت نشد' });
    }

    // بررسی آیا قبلاً تاریخ تولد ثبت شده و جایزه گرفته
    const isFirstTime = !user.birthDateRewardClaimed;

    // ذخیره تاریخ تولد
    user.birthDate = birthDate;

    let rewardGiven = false;
    let newBalance = 0;

    // اگر اولین بار است، جایزه بده
    if (isFirstTime) {
      // دریافت یا ایجاد کیف پول
      const wallet = await UserWallet.getOrCreate(userId);
      const balanceBefore = wallet.balance;
      
      // افزایش موجودی
      wallet.balance += BIRTHDAY_REWARD_AMOUNT;
      wallet.totalEarned += BIRTHDAY_REWARD_AMOUNT;
      wallet.lastTransactionAt = new Date();
      await wallet.save();

      // ثبت تراکنش
      await UserWalletTransaction.create({
        user: userId,
        type: 'bonus',
        amount: BIRTHDAY_REWARD_AMOUNT,
        balanceBefore: balanceBefore,
        balanceAfter: wallet.balance,
        category: 'birthday',
        title: 'جایزه ثبت تاریخ تولد',
        description: `تاریخ تولد: ${birthDate}`
      });

      // علامت‌گذاری دریافت جایزه
      user.birthDateRewardClaimed = true;
      rewardGiven = true;
      newBalance = wallet.balance;
    } else {
      // فقط آپدیت تاریخ تولد بدون جایزه
      const wallet = await UserWallet.getOrCreate(userId);
      newBalance = wallet.balance;
    }

    await user.save();

    res.json({
      success: true,
      message: rewardGiven 
        ? 'تاریخ تولد ثبت شد و جایزه به کیف پول اضافه شد!' 
        : 'تاریخ تولد به‌روزرسانی شد',
      birthDate: user.birthDate,
      rewardGiven,
      rewardAmount: rewardGiven ? BIRTHDAY_REWARD_AMOUNT : 0,
      newBalance,
      formattedBalance: newBalance.toLocaleString('fa-IR')
    });

  } catch (error) {
    console.error('setBirthDate error:', error);
    res.status(500).json({ message: 'خطا در ثبت تاریخ تولد' });
  }
};


/**
 * حذف تراکنش‌های قدیمی‌تر از X روز
 * این تابع می‌تواند توسط یک cron job یا به صورت دستی فراخوانی شود
 * @param {number} daysOld - تعداد روزهایی که تراکنش‌های قدیمی‌تر از آن حذف شوند (پیش‌فرض: 90 روز)
 */
exports.cleanupOldTransactions = async (daysOld = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await UserWalletTransaction.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    console.log(`[Cleanup] حذف ${result.deletedCount} تراکنش قدیمی‌تر از ${daysOld} روز`);
    return { deletedCount: result.deletedCount, cutoffDate };
  } catch (error) {
    console.error('cleanupOldTransactions error:', error);
    throw error;
  }
};

/**
 * API برای حذف تراکنش‌های قدیمی (فقط ادمین)
 * DELETE /api/admin/wallet/cleanup
 */
exports.adminCleanupTransactions = async (req, res) => {
  try {
    const daysOld = parseInt(req.query.days) || 90;
    
    // حداقل 30 روز
    if (daysOld < 30) {
      return res.status(400).json({ 
        message: 'حداقل مدت زمان نگهداری تراکنش‌ها 30 روز است' 
      });
    }

    const result = await exports.cleanupOldTransactions(daysOld);
    
    res.json({
      success: true,
      message: `${result.deletedCount} تراکنش قدیمی حذف شد`,
      deletedCount: result.deletedCount,
      cutoffDate: result.cutoffDate
    });
  } catch (error) {
    console.error('adminCleanupTransactions error:', error);
    res.status(500).json({ message: 'خطا در حذف تراکنش‌های قدیمی' });
  }
};

/**
 * جایزه ماموریت گردش در بازار (مشاهده محصولات)
 * POST /api/user/wallet/mission-reward
 */
exports.claimBrowseMissionReward = async (req, res) => {
  try {
    const userId = req.user.id;
    const { missionType, amount } = req.body;

    // فقط ماموریت browse_products پشتیبانی می‌شود
    if (missionType !== 'browse_products') {
      return res.status(400).json({ 
        success: false,
        message: 'نوع ماموریت نامعتبر است' 
      });
    }

    // بررسی مبلغ (باید با مقدار تعریف شده مطابقت داشته باشد)
    const rewardAmount = BROWSE_PRODUCTS_REWARD_AMOUNT;
    if (amount && amount !== rewardAmount) {
      return res.status(400).json({ 
        success: false,
        message: 'مبلغ جایزه نامعتبر است' 
      });
    }

    // دریافت کاربر
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'کاربر یافت نشد' 
      });
    }

    // بررسی آیا امروز قبلاً جایزه گرفته
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingReward = await UserWalletTransaction.findOne({
      user: userId,
      category: 'browse_stores',
      createdAt: { $gte: today }
    });

    if (existingReward) {
      return res.status(409).json({ 
        success: false,
        message: 'شما امروز قبلاً این جایزه را دریافت کرده‌اید' 
      });
    }

    // دریافت یا ایجاد کیف پول
    const wallet = await UserWallet.getOrCreate(userId);
    const balanceBefore = wallet.balance;
    
    // افزایش موجودی
    wallet.balance += rewardAmount;
    wallet.totalEarned += rewardAmount;
    wallet.lastTransactionAt = new Date();
    await wallet.save();

    // ثبت تراکنش
    await UserWalletTransaction.create({
      user: userId,
      type: 'bonus',
      amount: rewardAmount,
      balanceBefore: balanceBefore,
      balanceAfter: wallet.balance,
      category: 'browse_stores',
      title: 'جایزه پاساژگردی آنلاین',
      description: 'مشاهده محصولات به مدت ۹۰ ثانیه'
    });

    res.json({
      success: true,
      message: 'جایزه با موفقیت به کیف پول اضافه شد!',
      rewardAmount,
      newBalance: wallet.balance,
      formattedBalance: wallet.balance.toLocaleString('fa-IR')
    });

  } catch (error) {
    console.error('claimBrowseMissionReward error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطا در ثبت جایزه' 
    });
  }
};
