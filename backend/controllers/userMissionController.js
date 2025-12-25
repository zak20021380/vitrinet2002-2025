const UserMissionProgress = require('../models/UserMissionProgress');
const UserWallet = require('../models/UserWallet');
const UserWalletTransaction = require('../models/UserWalletTransaction');
const MissionSetting = require('../models/MissionSettings');
const mongoose = require('mongoose');

// تنظیمات ماموریت گردش در بازار
const BROWSE_MISSION_ID = 'user-review'; // شناسه ماموریت در MissionSettings
const REQUIRED_STORE_VISITS = 3;
const MIN_TIME_SECONDS = 5; // حداقل زمان برای ثبت بازدید

/**
 * ثبت بازدید از فروشگاه
 * POST /api/missions/track-visit
 */
exports.trackStoreVisit = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storeId, timeSpent = 0 } = req.body;

    // اعتبارسنجی storeId
    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({
        success: false,
        message: 'شناسه فروشگاه نامعتبر است'
      });
    }

    // اعتبارسنجی زمان صرف شده
    if (timeSpent < MIN_TIME_SECONDS) {
      return res.status(400).json({
        success: false,
        message: 'زمان کافی در صفحه سپری نشده است'
      });
    }

    // بررسی فعال بودن ماموریت
    const missionSetting = await MissionSetting.findOne({
      missionId: BROWSE_MISSION_ID,
      isActive: true
    });

    if (!missionSetting) {
      return res.status(400).json({
        success: false,
        message: 'این ماموریت در حال حاضر فعال نیست'
      });
    }

    // دریافت یا ایجاد پیشرفت ماموریت
    let progress = await UserMissionProgress.getOrCreate(
      userId,
      BROWSE_MISSION_ID,
      REQUIRED_STORE_VISITS
    );

    // بررسی آیا ماموریت قبلاً تکمیل شده
    if (progress.status === 'completed' || progress.status === 'claimed') {
      return res.json({
        success: true,
        alreadyCompleted: true,
        message: 'این ماموریت قبلاً تکمیل شده است',
        progress: progress.currentCount,
        required: progress.requiredCount
      });
    }

    // بررسی تکراری نبودن فروشگاه
    if (progress.hasVisitedStore(storeId)) {
      return res.json({
        success: true,
        duplicate: true,
        message: 'این فروشگاه قبلاً بازدید شده است',
        progress: progress.currentCount,
        required: progress.requiredCount
      });
    }

    // افزودن بازدید
    progress.addStoreVisit(storeId, timeSpent);

    // بررسی تکمیل ماموریت
    const isCompleted = progress.checkCompletion();

    let rewardGiven = false;
    let newBalance = 0;

    // اگر تکمیل شد، پاداش بده
    if (isCompleted) {
      const rewardAmount = missionSetting.amount || 500;
      progress.rewardAmount = rewardAmount;

      // دریافت کیف پول
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
        title: 'جایزه گردش در بازار',
        description: `بازدید از ${REQUIRED_STORE_VISITS} فروشگاه مختلف`,
        relatedType: null,
        metadata: {
          missionId: BROWSE_MISSION_ID,
          visitedStores: progress.visitedStores.map(v => v.storeId)
        }
      });

      progress.rewardPaid = true;
      progress.status = 'claimed';
      rewardGiven = true;
      newBalance = wallet.balance;
    }

    await progress.save();

    res.json({
      success: true,
      message: isCompleted
        ? 'تبریک! ماموریت تکمیل شد و جایزه به کیف پول اضافه شد!'
        : 'بازدید ثبت شد!',
      progress: progress.currentCount,
      required: progress.requiredCount,
      isCompleted,
      rewardGiven,
      rewardAmount: rewardGiven ? progress.rewardAmount : 0,
      newBalance: rewardGiven ? newBalance : undefined
    });

  } catch (error) {
    console.error('trackStoreVisit error:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در ثبت بازدید'
    });
  }
};

/**
 * دریافت وضعیت ماموریت گردش در بازار
 * GET /api/missions/browse-status
 */
exports.getBrowseMissionStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    // بررسی فعال بودن ماموریت
    const missionSetting = await MissionSetting.findOne({
      missionId: BROWSE_MISSION_ID,
      isActive: true
    });

    if (!missionSetting) {
      return res.json({
        success: true,
        isActive: false,
        message: 'این ماموریت در حال حاضر فعال نیست'
      });
    }

    // دریافت پیشرفت
    const progress = await UserMissionProgress.findOne({
      user: userId,
      missionId: BROWSE_MISSION_ID
    });

    if (!progress) {
      return res.json({
        success: true,
        isActive: true,
        status: 'not_started',
        progress: 0,
        required: REQUIRED_STORE_VISITS,
        rewardAmount: missionSetting.amount,
        visitedStores: []
      });
    }

    res.json({
      success: true,
      isActive: true,
      status: progress.status,
      progress: progress.currentCount,
      required: progress.requiredCount,
      rewardAmount: missionSetting.amount,
      visitedStores: progress.visitedStores.map(v => ({
        storeId: v.storeId,
        visitedAt: v.visitedAt
      })),
      completedAt: progress.completedAt,
      rewardPaid: progress.rewardPaid
    });

  } catch (error) {
    console.error('getBrowseMissionStatus error:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت وضعیت ماموریت'
    });
  }
};

/**
 * ریست کردن ماموریت (برای تست یا دوره جدید)
 * POST /api/missions/browse-reset
 */
exports.resetBrowseMission = async (req, res) => {
  try {
    const userId = req.user.id;

    const progress = await UserMissionProgress.findOne({
      user: userId,
      missionId: BROWSE_MISSION_ID
    });

    if (!progress) {
      return res.json({
        success: true,
        message: 'ماموریتی برای ریست وجود ندارد'
      });
    }

    progress.resetForNewCycle();
    await progress.save();

    res.json({
      success: true,
      message: 'ماموریت ریست شد',
      progress: 0,
      required: progress.requiredCount
    });

  } catch (error) {
    console.error('resetBrowseMission error:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در ریست ماموریت'
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// ماموریت رزرو نوبت - Book Appointment Mission
// ═══════════════════════════════════════════════════════════════

const BOOK_APPOINTMENT_MISSION_ID = 'user-book-appointment';

/**
 * تکمیل ماموریت رزرو نوبت
 * این تابع باید بعد از تکمیل موفق یک رزرو فراخوانی شود
 * @param {string} userId - شناسه کاربر
 * @param {string} bookingId - شناسه رزرو
 * @returns {Object} نتیجه عملیات
 */
exports.completeBookAppointmentMission = async (userId, bookingId) => {
  try {
    // بررسی فعال بودن ماموریت
    const missionSetting = await MissionSetting.findOne({
      missionId: BOOK_APPOINTMENT_MISSION_ID,
      isActive: true
    });

    if (!missionSetting) {
      return {
        success: false,
        message: 'ماموریت رزرو نوبت فعال نیست'
      };
    }

    // بررسی آیا قبلاً این ماموریت تکمیل شده
    let progress = await UserMissionProgress.findOne({
      user: userId,
      missionId: BOOK_APPOINTMENT_MISSION_ID
    });

    if (progress && (progress.status === 'completed' || progress.status === 'claimed')) {
      return {
        success: true,
        alreadyCompleted: true,
        message: 'ماموریت رزرو نوبت قبلاً تکمیل شده است'
      };
    }

    // ایجاد یا آپدیت پیشرفت
    if (!progress) {
      progress = new UserMissionProgress({
        user: userId,
        missionId: BOOK_APPOINTMENT_MISSION_ID,
        status: 'completed',
        currentCount: 1,
        requiredCount: 1,
        completedAt: new Date()
      });
    } else {
      progress.status = 'completed';
      progress.currentCount = 1;
      progress.completedAt = new Date();
    }

    // پرداخت پاداش
    const rewardAmount = missionSetting.amount || 5000;
    progress.rewardAmount = rewardAmount;

    // دریافت کیف پول
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
      category: 'book_appointment',
      title: 'جایزه رزرو نوبت',
      description: 'پاداش اولین رزرو نوبت آنلاین',
      relatedId: bookingId ? mongoose.Types.ObjectId(bookingId) : null,
      relatedType: 'booking',
      metadata: {
        missionId: BOOK_APPOINTMENT_MISSION_ID,
        bookingId: bookingId
      }
    });

    progress.rewardPaid = true;
    progress.status = 'claimed';
    await progress.save();

    return {
      success: true,
      message: 'تبریک! ماموریت رزرو نوبت تکمیل شد!',
      rewardAmount: rewardAmount,
      newBalance: wallet.balance
    };

  } catch (error) {
    console.error('completeBookAppointmentMission error:', error);
    return {
      success: false,
      message: 'خطا در تکمیل ماموریت رزرو نوبت'
    };
  }
};

/**
 * دریافت وضعیت ماموریت رزرو نوبت
 * GET /api/missions/book-appointment-status
 */
exports.getBookAppointmentStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    // بررسی فعال بودن ماموریت
    const missionSetting = await MissionSetting.findOne({
      missionId: BOOK_APPOINTMENT_MISSION_ID,
      isActive: true
    });

    if (!missionSetting) {
      return res.json({
        success: true,
        isActive: false,
        message: 'ماموریت رزرو نوبت فعال نیست'
      });
    }

    // دریافت پیشرفت
    const progress = await UserMissionProgress.findOne({
      user: userId,
      missionId: BOOK_APPOINTMENT_MISSION_ID
    });

    if (!progress) {
      return res.json({
        success: true,
        isActive: true,
        status: 'not_started',
        progress: 0,
        required: 1,
        rewardAmount: missionSetting.amount
      });
    }

    res.json({
      success: true,
      isActive: true,
      status: progress.status,
      progress: progress.currentCount,
      required: 1,
      rewardAmount: missionSetting.amount,
      completedAt: progress.completedAt,
      rewardPaid: progress.rewardPaid
    });

  } catch (error) {
    console.error('getBookAppointmentStatus error:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت وضعیت ماموریت'
    });
  }
};
