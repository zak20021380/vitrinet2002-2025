const UserStreak = require('../models/UserStreak');
const UserWallet = require('../models/UserWallet');
const UserWalletTransaction = require('../models/UserWalletTransaction');
const MissionSetting = require('../models/MissionSettings');

const DAILY_LOGIN_MISSION_ID = 'user-daily-login';
const DEFAULT_DAILY_LOGIN_REWARD = 100;

const STREAK_REWARDS = {
  daily: DEFAULT_DAILY_LOGIN_REWARD,
  weekly: 500,
  checkpoint_7: 1000,
  checkpoint_30: 5000,
  checkpoint_60: 10000,
  checkpoint_90: 20000
};

function normaliseRewardAmount(input, fallback = 0) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed);
}

async function getDailyLoginRewardConfig() {
  try {
    const mission = await MissionSetting.findOne({ missionId: DAILY_LOGIN_MISSION_ID })
      .select('amount isActive')
      .lean();

    if (!mission) {
      return {
        amount: STREAK_REWARDS.daily,
        isActive: true
      };
    }

    return {
      amount: normaliseRewardAmount(mission.amount, STREAK_REWARDS.daily),
      isActive: mission.isActive !== false
    };
  } catch (error) {
    console.warn('getDailyLoginRewardConfig fallback:', error.message);
    return {
      amount: STREAK_REWARDS.daily,
      isActive: true
    };
  }
}

function buildStreakRewardTable(dailyConfig = { amount: STREAK_REWARDS.daily, isActive: true }) {
  return {
    ...STREAK_REWARDS,
    daily: dailyConfig.isActive
      ? normaliseRewardAmount(dailyConfig.amount, STREAK_REWARDS.daily)
      : 0
  };
}

/**
 * دریافت وضعیت استریک کاربر
 * GET /api/user/streak
 */
exports.getStreak = async (req, res) => {
  try {
    const userId = req.user.id;
    const streak = await UserStreak.getOrCreate(userId);
    const level = streak.calculateLevel();
    const dailyLoginReward = await getDailyLoginRewardConfig();
    const rewardTable = buildStreakRewardTable(dailyLoginReward);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekHistory = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const historyEntry = streak.weekHistory.find((h) => {
        const hDate = new Date(h.date);
        hDate.setHours(0, 0, 0, 0);
        return hDate.getTime() === date.getTime();
      });

      weekHistory.push({
        date: date.toISOString().split('T')[0],
        dayName: getDayName(date),
        status: historyEntry ? historyEntry.status : (date < today ? 'missed' : 'pending')
      });
    }

    const lastLogin = streak.lastLoginDate ? new Date(streak.lastLoginDate) : null;
    let checkedInToday = false;
    if (lastLogin) {
      lastLogin.setHours(0, 0, 0, 0);
      checkedInToday = lastLogin.getTime() === today.getTime();
    }

    res.json({
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      totalLoginDays: streak.totalLoginDays,
      loyaltyPoints: streak.loyaltyPoints,
      level,
      weekHistory,
      checkedInToday,
      lastLoginDate: streak.lastLoginDate,
      streakStartDate: streak.streakStartDate,
      rewards: rewardTable
    });
  } catch (error) {
    console.error('getStreak error:', error);
    res.status(500).json({ message: 'خطا در دریافت اطلاعات استریک' });
  }
};

/**
 * ثبت ورود روزانه (چک‌این)
 * POST /api/user/streak/checkin
 */
exports.checkIn = async (req, res) => {
  try {
    const userId = req.user.id;
    const streak = await UserStreak.getOrCreate(userId);
    const wallet = await UserWallet.getOrCreate(userId);
    const dailyLoginReward = await getDailyLoginRewardConfig();
    const rewardTable = buildStreakRewardTable(dailyLoginReward);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastLogin = streak.lastLoginDate ? new Date(streak.lastLoginDate) : null;
    if (lastLogin) {
      lastLogin.setHours(0, 0, 0, 0);
      if (lastLogin.getTime() === today.getTime()) {
        return res.status(400).json({
          message: 'امروز قبلاً ورود ثبت شده است',
          alreadyCheckedIn: true
        });
      }
    }

    let newStreak = 1;
    let streakBroken = false;

    if (lastLogin) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastLogin.getTime() === yesterday.getTime()) {
        newStreak = streak.currentStreak + 1;
      } else {
        streakBroken = streak.currentStreak > 0;
        newStreak = 1;
      }
    }

    streak.currentStreak = newStreak;
    streak.lastLoginDate = today;
    streak.totalLoginDays += 1;

    if (newStreak === 1) {
      streak.streakStartDate = today;
    }

    if (newStreak > streak.longestStreak) {
      streak.longestStreak = newStreak;
    }

    streak.weekHistory = streak.weekHistory.filter((h) => {
      const hDate = new Date(h.date);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return hDate >= weekAgo;
    });
    streak.weekHistory.push({ date: today, status: 'hit' });

    let totalReward = 0;
    const rewards = [];

    if (rewardTable.daily > 0) {
      totalReward += rewardTable.daily;
      rewards.push({
        type: 'daily',
        amount: rewardTable.daily,
        title: 'پاداش ورود روزانه'
      });
    }

    if (newStreak % 7 === 0 && rewardTable.weekly > 0) {
      totalReward += rewardTable.weekly;
      rewards.push({
        type: 'weekly',
        amount: rewardTable.weekly,
        title: `پاداش هفته ${newStreak / 7}`
      });
      streak.lastWeeklyRewardAt = new Date();
    }

    const checkpoints = [7, 30, 60, 90];
    for (const cp of checkpoints) {
      if (newStreak === cp && streak.lastCheckpoint < cp) {
        const rewardKey = `checkpoint_${cp}`;
        const cpReward = rewardTable[rewardKey] || 0;
        if (cpReward > 0) {
          totalReward += cpReward;
          rewards.push({
            type: rewardKey,
            amount: cpReward,
            title: `چک‌پوینت ${cp} روزه`
          });
          streak.lastCheckpoint = cp;
        }
      }
    }

    if (totalReward > 0) {
      streak.loyaltyPoints += Math.floor(totalReward / 10);
    }

    await streak.save();

    if (totalReward > 0) {
      const balanceBefore = wallet.balance;
      wallet.balance += totalReward;
      wallet.totalEarned += totalReward;
      wallet.lastTransactionAt = new Date();

      await UserWalletTransaction.create({
        user: userId,
        type: 'earn',
        amount: totalReward,
        balanceBefore,
        balanceAfter: wallet.balance,
        category: 'streak_daily',
        title: 'پاداش استریک روزانه',
        description: `ورود روز ${newStreak} - ${rewards.map((r) => r.title).join(' + ')}`,
        relatedType: 'streak',
        metadata: { streak: newStreak, rewards }
      });

      await wallet.save();
    }

    const level = streak.calculateLevel();

    res.json({
      success: true,
      message: 'ورود روزانه ثبت شد!',
      currentStreak: newStreak,
      longestStreak: streak.longestStreak,
      totalLoginDays: streak.totalLoginDays,
      loyaltyPoints: streak.loyaltyPoints,
      level,
      rewards,
      totalReward,
      newBalance: wallet.balance,
      dailyRewardAmount: rewardTable.daily,
      dailyRewardActive: dailyLoginReward.isActive,
      streakBroken
    });
  } catch (error) {
    console.error('checkIn error:', error);
    res.status(500).json({ message: 'خطا در ثبت ورود روزانه' });
  }
};

/**
 * دریافت لیدربورد استریک کاربران
 * GET /api/user/streak/leaderboard
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    const leaderboard = await UserStreak.find({ currentStreak: { $gt: 0 } })
      .sort({ currentStreak: -1, longestStreak: -1 })
      .limit(limit)
      .populate('user', 'firstname lastname')
      .lean();

    const formatted = leaderboard.map((s, index) => ({
      rank: index + 1,
      name: s.user ? `${s.user.firstname || ''} ${s.user.lastname || ''}`.trim() || 'کاربر' : 'کاربر',
      currentStreak: s.currentStreak,
      longestStreak: s.longestStreak,
      totalLoginDays: s.totalLoginDays
    }));

    res.json(formatted);
  } catch (error) {
    console.error('getLeaderboard error:', error);
    res.status(500).json({ message: 'خطا در دریافت لیدربورد' });
  }
};

function getDayName(date) {
  const days = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
  return days[date.getDay()];
}
