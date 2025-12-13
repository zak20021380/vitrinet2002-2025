const API_BASE = window.__API_BASE__ || '';
const NO_CACHE = { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } };
const bust = (url) => `${url}${url.includes('?') ? '&' : '?'}__=${Date.now()}`;
const escapeHtml = (str = '') => String(str).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char] || char));

const toMidnight = (dateLike) => {
  const date = new Date(dateLike);
  if (Number.isNaN(date)) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const evaluateCheckpointStreak = ({
  lastLoginDate,
  currentStreak = 0,
  userPoints = 0,
  pendingWeekPoints = 0,
  freezeUsed = false,
  now = new Date()
}) => {
  const today = toMidnight(now);
  const lastLogin = lastLoginDate ? toMidnight(lastLoginDate) : null;
  const daysDiff = lastLogin ? Math.floor((today - lastLogin) / 86_400_000) : Infinity;

  let nextStreak = currentStreak;
  let message = 'امروز ثبت شد و زنجیره فعال ماند.';
  let softPenalty = 0;
  let isFrozen = false;

  if (daysDiff === 1) {
    nextStreak = currentStreak + 1;
    message = 'یک قدم دیگر به جایزه هفتگی نزدیک شدی!';
  } else if (daysDiff > 1) {
    if (freezeUsed) {
      isFrozen = true;
      message = 'آیتم استریک فریز استفاده شد و زنجیره حفظ گردید.';
    } else {
      const checkpoint = Math.floor(currentStreak / 7) * 7;
      nextStreak = checkpoint;
      if (pendingWeekPoints > 0 && checkpoint < currentStreak) {
        softPenalty = pendingWeekPoints;
        userPoints = Math.max(0, userPoints - pendingWeekPoints);
      }
      message = checkpoint
        ? `استریک به آخرین چک‌پوینت ${checkpoint} روزه برگشت. ${softPenalty ? 'امتیازهای در انتظار این هفته سوزانده شد.' : ''}`
        : 'هنوز به چک‌پوینت نرسیدی؛ استریک از صفر شروع می‌شود.';
    }
  }

  const visualCycle = nextStreak % 7;
  const weekProgress = visualCycle;
  const checkpointReached = nextStreak > 0 && nextStreak % 7 === 0;

  return {
    currentStreak: nextStreak,
    totalDays: nextStreak,
    visualCycle,
    weekProgress,
    checkpointReached,
    isFrozen,
    message,
    softPenalty,
    userPoints
  };
};

const createWeeklyDayState = (progress) => {
  const labels = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  return labels.map((label, idx) => {
    const status = idx < progress ? 'hit' : 'pending';
    return { label, status, isGift: idx === labels.length - 1 };
  });
};

const formatTomans = (amount) => `${Number(amount || 0).toLocaleString('fa-IR')} تومان`;

const calculateUserLevel = (streakDays = 0) => {
  const tiers = [
    { min: 0, max: 30, name: 'نوآموز', icon: '🌱', color: '#22d3ee', reward: 50_000 },
    { min: 30, max: 60, name: 'برنزی', icon: '🥉', color: '#f97316', reward: 100_000 },
    { min: 60, max: 90, name: 'نقره‌ای', icon: '🛡️', color: '#cbd5e1', reward: 150_000 },
    { min: 90, max: 120, name: 'طلایی', icon: '🏆', color: '#fbbf24', reward: 200_000 },
    { min: 120, max: Infinity, name: 'الماسی', icon: '💎', color: '#67e8f9', reward: 300_000 }
  ];

  const activeTier = tiers.find((tier) => streakDays >= tier.min && streakDays < tier.max) || tiers[tiers.length - 1];
  const tierIndex = tiers.indexOf(activeTier);
  const span = Number.isFinite(activeTier.max) ? activeTier.max - activeTier.min : 30;
  const completedCycles = Math.floor((streakDays - activeTier.min) / span);
  const progressDays = Math.max(0, Math.min(span, streakDays - (activeTier.min + completedCycles * span)));
  const nextMilestoneDay = activeTier.min + (completedCycles + 1) * span;
  const daysToNextLevel = Math.max(0, nextMilestoneDay - streakDays);
  const progressPercent = Math.min(100, Math.round((progressDays / span) * 100));
  const milestoneIndex = Math.ceil(nextMilestoneDay / 30);
  const nextLevel = tiers[tierIndex + 1] || activeTier;
  const rewardForNextLevel = nextLevel.reward ?? milestoneIndex * 50_000;

  return {
    name: activeTier.name,
    icon: activeTier.icon,
    color: activeTier.color,
    label: `${activeTier.icon} فروشنده ${activeTier.name}`,
    progressDays,
    span,
    progressPercent,
    daysToNextLevel,
    nextMilestoneDay,
    nextLevelName: nextLevel.name,
    nextLevelIcon: nextLevel.icon,
    nextLevelColor: nextLevel.color,
    nextRewardAmount: formatTomans(rewardForNextLevel)
  };
};

export {
  API_BASE,
  NO_CACHE,
  bust,
  escapeHtml,
  evaluateCheckpointStreak,
  createWeeklyDayState,
  formatTomans,
  calculateUserLevel
};
