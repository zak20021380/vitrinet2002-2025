// SafeSS
const SafeSS = { // SafeSS
  setJSON(key, value, opts = {}) { // SafeSS
    const str = JSON.stringify(value); // SafeSS
    if (str.length > 500 * 1024) return false; // SafeSS
    try { sessionStorage.setItem(key, str); return true; } // SafeSS
    catch (e) { // SafeSS
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) { // SafeSS
        const prefix = /^vt:(?:cache|logs|tmp):/; // SafeSS
        const items = []; // SafeSS
        for (let i = 0; i < sessionStorage.length; i++) { // SafeSS
          const k = sessionStorage.key(i); // SafeSS
          if (prefix.test(k)) { // SafeSS
            const v = sessionStorage.getItem(k) || ''; // SafeSS
            items.push({ key: k, size: v.length }); // SafeSS
          } // SafeSS
        } // SafeSS
        items.sort((a, b) => b.size - a.size); // SafeSS
        for (const it of items) sessionStorage.removeItem(it.key); // SafeSS
        try { sessionStorage.setItem(key, str); return true; } // SafeSS
        catch (e2) { console.warn('SafeSS quota exceeded', e2); return false; } // SafeSS
      } // SafeSS
      console.warn('SafeSS setJSON failed', e); // SafeSS
      return false; // SafeSS
    } // SafeSS
  }, // SafeSS
  getJSON(key, fallback = null) { // SafeSS
    try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } // SafeSS
    catch { return fallback; } // SafeSS
  } // SafeSS
}; // SafeSS
function auditSessionStorage() { // SafeSS
  const rows = []; // SafeSS
  for (let i = 0; i < sessionStorage.length; i++) { // SafeSS
    const k = sessionStorage.key(i); // SafeSS
    const v = sessionStorage.getItem(k) || ''; // SafeSS
    rows.push({ key: k, bytes: v.length }); // SafeSS
  } // SafeSS
  rows.sort((a, b) => b.bytes - a.bytes); // SafeSS
  console.table(rows); // SafeSS
} // SafeSS
window.SafeSS = SafeSS; // SafeSS
window.auditSessionStorage = auditSessionStorage; // SafeSS
// SafeSS end
document.addEventListener('DOMContentLoaded', async () => {

// === STEP 1 — API client (READ services only) ===
// اگر آدرس سرور فرق دارد، مقدار زیر را عوض کن
// Use same-origin API by default; fall back to provided base
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

  // --- Bottom sheet: wallet & streak ---
  const bottomSheet = {
    root: document.getElementById('dashboard-bottom-sheet'),
    overlay: document.getElementById('bottom-sheet-overlay'),
    panel: document.querySelector('#dashboard-bottom-sheet .bottom-sheet__panel'),
    title: document.getElementById('bottom-sheet-title'),
    content: document.getElementById('bottom-sheet-content'),
    closeBtn: document.getElementById('bottom-sheet-close'),
    activeType: null
  };

  const toMidnight = (dateLike) => {
    const date = new Date(dateLike);
    if (Number.isNaN(date)) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  };

  /**
   * Checkpoint & Cycle logic (decouples status count from weekly cycle)
   * Input: lastLoginDate, currentStreak, userPoints (plus optional freeze)
   * Output: { currentStreak, visualCycle, weekProgress, isFrozen, message, softPenalty }
   */
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

  const streakSnapshot = evaluateCheckpointStreak({
    lastLoginDate: new Date(Date.now() - 26 * 60 * 60 * 1000), // دیروز - نمایش رشد استریک
    currentStreak: 105,
    userPoints: 940,
    pendingWeekPoints: 35,
    freezeUsed: false
  });

  const levelSnapshot = calculateUserLevel(streakSnapshot.totalDays);

  const daysToNextCheckpoint = streakSnapshot.checkpointReached ? 7 : 7 - streakSnapshot.weekProgress;
  const nextRewardCopy = streakSnapshot.checkpointReached
    ? 'چک‌پوینت فعال شد؛ چرخه جدید شروع شده است'
    : `${daysToNextCheckpoint} روز تا چک‌پوینت بعدی`;

  // --- Header: hamburger navigation ---
  const hamburgerToggle = document.getElementById('hamburger-toggle');
  const hamburgerMenu = document.getElementById('hamburger-menu');
  const hamburgerBackdrop = document.getElementById('hamburger-backdrop');

  const setHamburgerState = (isOpen) => {
    if (!hamburgerToggle || !hamburgerMenu || !hamburgerBackdrop) return;

    const completeClose = () => {
      hamburgerMenu.hidden = true;
      hamburgerBackdrop.hidden = true;
      hamburgerMenu.removeEventListener('transitionend', completeClose);
    };

    if (isOpen) {
      hamburgerMenu.hidden = false;
      hamburgerBackdrop.hidden = false;

      requestAnimationFrame(() => {
        hamburgerMenu.classList.add('is-open');
        hamburgerBackdrop.classList.add('is-visible');
      });

      const firstMenuItem = hamburgerMenu.querySelector('.hamburger-menu__item');
      if (firstMenuItem) {
        firstMenuItem.focus({ preventScroll: true });
      }
    } else {
      hamburgerMenu.classList.remove('is-open');
      hamburgerBackdrop.classList.remove('is-visible');

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        completeClose();
      } else {
        hamburgerMenu.addEventListener('transitionend', completeClose, { once: true });
        setTimeout(completeClose, 240);
      }
    }

    hamburgerToggle.classList.toggle('is-open', isOpen);
    hamburgerToggle.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('no-scroll', isOpen && window.innerWidth < 768);
  };

  const closeHamburger = () => setHamburgerState(false);

  if (hamburgerToggle && hamburgerMenu && hamburgerBackdrop) {
    hamburgerToggle.addEventListener('click', () => {
      const isOpen = hamburgerToggle.getAttribute('aria-expanded') === 'true';
      setHamburgerState(!isOpen);
    });

    hamburgerBackdrop.addEventListener('click', closeHamburger);

    hamburgerMenu.querySelectorAll('.hamburger-menu__item').forEach((item) => {
      item.addEventListener('click', closeHamburger);
    });

    document.addEventListener('click', (event) => {
      const clickTarget = event.target;
      const isMenuOpen = hamburgerToggle.getAttribute('aria-expanded') === 'true';

      if (!isMenuOpen) return;

      const clickedInsideMenu = hamburgerMenu.contains(clickTarget);
      const clickedToggle = hamburgerToggle.contains(clickTarget);
      const clickedBackdrop = hamburgerBackdrop.contains(clickTarget);

      if (!clickedInsideMenu && !clickedToggle && !clickedBackdrop) {
        closeHamburger();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeHamburger();
      }
    });
  }

  const sheetData = {
    wallet: {
      balance: '۳٬۵۰۰٬۰۰۰',
      currency: 'تومان',
      tagline: 'اعتبارت را به ابزارهای بازدید و اعتماد تبدیل کن.',
      highlight: 'اعتبار بازاریابی',
      useCases: [
        { icon: '🚀', title: 'نردبان آگهی' },
        { icon: '🎫', title: 'کوپن تخفیف پلن' },
        { icon: '⭐', title: 'نشان VIP' }
      ],
      serviceCards: [
        {
          icon: '🚀',
          title: 'نردبان آگهی',
          price: '۲۰,۰۰۰ اعتبار',
          description: 'پروفایل و آگهی‌ات به بالای لیست می‌رود.',
          theme: 'boost'
        },
        {
          icon: '🎫',
          title: 'تخفیف روی پلن',
          price: '۵۰,۰۰۰ اعتبار',
          description: 'اعتبار را به کوپن ۳۰٪ برای خرید نقدی پلن تبدیل کن.',
          theme: 'discount'
        },
        {
          icon: '⭐',
          title: 'نشان VIP',
          price: '۸۰,۰۰۰ اعتبار',
          description: 'نشان اعتماد ۲۴ ساعته برای جلب مشتری بیشتر.',
          theme: 'vip'
        }
      ],
      activities: [
        { title: 'پاداش استریک', amount: '+۵۰,۰۰۰ ت', type: 'earn', time: '۵ دقیقه پیش' },
        { title: 'خرید پلن', amount: '-۱۰۰,۰۰۰ ت', type: 'spend', time: '۲ ساعت پیش' },
        { title: 'نردبان آگهی', amount: '-۲۰,۰۰۰ ت', type: 'spend', time: 'دیروز' }
      ]
    },
    streak: {
      totalDays: streakSnapshot.totalDays,
      weekProgress: streakSnapshot.weekProgress,
      visualCycle: streakSnapshot.visualCycle,
      checkpointReached: streakSnapshot.checkpointReached,
      progress: Math.round((streakSnapshot.weekProgress / 7) * 100),
      nextReward: nextRewardCopy,
      level: levelSnapshot,
      dailyReward: '+۱۰ امتیاز وفاداری',
      weeklyReward: `${formatTomans(5_000)} اعتبار فروشگاه`,
      monthlyReward: formatTomans(50_000),
      rules: 'هر ۷ روز یک چک‌پوینت ذخیره می‌شود. با از دست دادن روز، زنجیره به آخرین چک‌پوینت برمی‌گردد.',
      days: createWeeklyDayState(streakSnapshot.weekProgress),
      message: streakSnapshot.message,
      softPenalty: streakSnapshot.softPenalty,
      isFrozen: streakSnapshot.isFrozen
    }
  };

  const updateStreakCard = () => {
    const streakEl = document.getElementById('daily-streak');
    if (!streakEl) return;
    streakEl.textContent = `${sheetData.streak.totalDays} روز متوالی`;
    const streakCard = streakEl.closest('.streak-card');
    if (streakCard && sheetData.streak.checkpointReached) {
      streakCard.classList.add('has-checkpoint');
    }
  };

  updateStreakCard();

  const closeBottomSheet = () => {
    if (!bottomSheet.root) return;
    bottomSheet.root.classList.remove('is-active');
    bottomSheet.root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-bottom-sheet-open');
    bottomSheet.activeType = null;
  };

  const renderWalletSheet = () => {
    if (!bottomSheet.title || !bottomSheet.content) return;
    const data = sheetData.wallet;
    bottomSheet.title.textContent = 'مرکز اعتبار و خرید خدمات';
    bottomSheet.content.innerHTML = `
      <section class="wallet-sheet" aria-label="اعتبار فروشگاه">
        <div class="wallet-sheet__hero">
          <div class="wallet-sheet__hero-head">
            <span class="wallet-sheet__eyebrow">${data.highlight}</span>
            <p class="wallet-sheet__headline">${data.balance} <span>${data.currency}</span></p>
            <p class="wallet-sheet__tagline">${data.tagline}</p>
          </div>
          <div class="wallet-sheet__tags" aria-hidden="true">
            ${data.useCases.map((item) => `<span class="wallet-sheet__tag">${item.icon} ${item.title}</span>`).join('')}
          </div>
        </div>

        <div class="wallet-sheet__section wallet-sheet__shop" aria-label="خدمات پیشنهادی برای هزینه اعتبار">
          <div class="wallet-sheet__section-header">
            <div>
              <p class="wallet-sheet__section-eyebrow">اقتصاد افزونه</p>
              <h4 class="wallet-sheet__section-title">افزایش بازدید و اعتماد</h4>
            </div>
            <span class="wallet-sheet__section-chip">پرداخت با اعتبار</span>
          </div>
          <div class="wallet-sheet__carousel" role="list">
            ${data.serviceCards.map((card) => `
              <article class="wallet-sheet__card wallet-sheet__card--${card.theme}" role="listitem" tabindex="0">
                <div class="wallet-sheet__card-icon" aria-hidden="true">${card.icon}</div>
                <div class="wallet-sheet__card-body">
                  <h5 class="wallet-sheet__card-title">${card.title}</h5>
                  <p class="wallet-sheet__card-price">${card.price}</p>
                  <p class="wallet-sheet__card-meta">${card.description}</p>
                </div>
                <span class="wallet-sheet__card-chip">اعتبار → ابزار رشد</span>
              </article>
            `).join('')}
          </div>
        </div>

        <div class="wallet-sheet__section wallet-sheet__activity" aria-label="فعالیت‌های اخیر اعتبار">
          <div class="wallet-sheet__section-header">
            <div>
              <p class="wallet-sheet__section-eyebrow">جریان حساب</p>
              <h4 class="wallet-sheet__section-title">تراکنش‌های اخیر</h4>
            </div>
            <span class="wallet-sheet__section-chip wallet-sheet__section-chip--muted">+ / -</span>
          </div>
          <ul class="wallet-sheet__activity-list">
            ${data.activities.map((item) => {
              const amountClass = item.type === 'earn' ? 'is-positive' : 'is-negative';
              return `
                <li class="wallet-sheet__activity-item">
                  <div>
                    <div class="wallet-sheet__activity-title">${item.title}</div>
                    <p class="wallet-sheet__activity-meta">${item.time}</p>
                  </div>
                  <span class="wallet-sheet__activity-amount ${amountClass}">${item.amount}</span>
                </li>
              `;
            }).join('')}
          </ul>
        </div>

        <div class="wallet-sheet__footer">
          <button type="button" class="wallet-sheet__cta">افزایش بازدید و فروش 🚀</button>
        </div>
      </section>
    `;
  };

  const renderStreakSheet = () => {
    if (!bottomSheet.title || !bottomSheet.content) return;
    const data = sheetData.streak;
    bottomSheet.title.textContent = 'ماموریت استریک و ارتقای سطح';

    const dayMarkup = data.days.map((day) => {
      const statusClass = day.status === 'hit' ? 'is-hit' : day.status === 'missed' ? 'is-missed' : 'is-pending';
      const baseSymbol = day.status === 'hit' ? '✔' : day.status === 'missed' ? '✕' : '•';
      const symbol = day.isGift ? '🎁' : baseSymbol;
      const stateLabel = day.status === 'hit' ? 'فعال' : day.status === 'missed' ? 'از دست رفته' : 'در انتظار';
      return `
        <div class="streak-day ${statusClass}" aria-label="${day.label} ${stateLabel}">
          <div class="streak-day__circle${day.isGift ? ' streak-day__circle--gift' : ''}">${symbol}</div>
          <span>${day.label}</span>
        </div>
      `;
    }).join('');

    const missionLabel = 'مأموریت سطح الماسی 💎';
    const nextGoalText = `${faNumber(data.level.daysToNextLevel)} روز تا دریافت تیک آبی + ${formatTomans(300_000)} پاداش`;
    const tierStyle = data.level.color ? ` style="color: ${data.level.color}"` : '';
    const nextGlowClass = ' streak-sheet__next-goal--diamond';

    bottomSheet.content.innerHTML = `
      <section class="streak-sheet" aria-label="جزئیات استریک">
        <div class="streak-sheet__hero">
          <span class="streak-sheet__icon" aria-hidden="true">${data.level.icon}</span>
          <div class="streak-sheet__tier"${tierStyle}>فروشنده ${data.level.name}</div>
          <div class="streak-sheet__count">${faNumber(data.totalDays)} روز در اوج!</div>
          ${data.checkpointReached ? '<span class="streak-sheet__badge" role="status">چک‌پوینت فعال</span>' : ''}
        </div>

        <div class="streak-sheet__progress" aria-label="پیشرفت سطح بعدی">
          <div class="streak-sheet__progress-meta">
            <span class="streak-sheet__progress-label">${missionLabel}</span>
            <span class="streak-sheet__progress-value">${faNumber(data.level.daysToNextLevel)} روز تا الماس</span>
          </div>
          <div class="streak-sheet__progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${data.level.progressPercent}" aria-valuetext="${data.level.progressPercent} درصد">
            <span style="inline-size: ${data.level.progressPercent}%"></span>
          </div>
          <p class="streak-sheet__next-goal${nextGlowClass}">${nextGoalText}</p>
        </div>

        <div class="streak-sheet__weekly" aria-label="پیشرفت هفتگی">
          <div class="streak-sheet__weekly-header">
            <div>
              <p class="streak-sheet__week-label">مسیر جایزه این هفته</p>
              <p class="streak-sheet__week-hint">پاداش هفتگی: ${formatTomans(5_000)} شارژ قطعی</p>
            </div>
            <div class="streak-sheet__week-value">${data.weekProgress}/7</div>
          </div>
          <div class="streak-sheet__calendar" role="list">${dayMarkup}</div>
        </div>

        <div class="streak-sheet__notes">
          <p class="streak-sheet__note streak-sheet__note--accent">${data.message}</p>
          ${data.softPenalty ? `<p class="streak-sheet__note streak-sheet__note--warning">${data.softPenalty} امتیاز وفاداری این هفته سوزانده شد.</p>` : ''}
          ${data.isFrozen ? '<p class="streak-sheet__note">استریک فریز فعال است و زنجیره حفظ می‌شود.</p>' : ''}
        </div>

        <div class="streak-sheet__actions">
          <p class="streak-sheet__meta">${data.dailyReward} | پاداش هفتگی: ${data.weeklyReward} | پاداش ماهانه: ${data.monthlyReward} + ارتقای سطح</p>
          <p class="streak-sheet__meta">${data.rules}</p>
          <p class="streak-sheet__quote">تداوم شما، اعتبار شماست.</p>
        </div>
      </section>
    `;
  };

  const openBottomSheet = (type = 'wallet') => {
    if (!bottomSheet.root || !bottomSheet.overlay || !bottomSheet.panel) return;
    bottomSheet.activeType = type;
    if (type === 'wallet') {
      renderWalletSheet();
    } else {
      renderStreakSheet();
    }
    bottomSheet.root.classList.add('is-active');
    bottomSheet.root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-bottom-sheet-open');
    requestAnimationFrame(() => bottomSheet.panel?.focus({ preventScroll: true }));
  };

  const handleSheetKeydown = (event) => {
    if (event.key === 'Escape' && bottomSheet.root?.classList.contains('is-active')) {
      closeBottomSheet();
    }
  };

  const bindSheetTriggers = () => {
    if (bottomSheet.root) {
      bottomSheet.root.setAttribute('aria-hidden', 'true');
    }
    const targets = [
      { selector: '.wallet-card', type: 'wallet' },
      { selector: '.streak-card', type: 'streak' }
    ];

    targets.forEach(({ selector, type }) => {
      document.querySelectorAll(selector).forEach((card) => {
        const open = () => openBottomSheet(type);
        card.addEventListener('click', open);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        });
      });
    });

    bottomSheet.overlay?.addEventListener('click', closeBottomSheet);
    bottomSheet.closeBtn?.addEventListener('click', closeBottomSheet);
    document.addEventListener('keydown', handleSheetKeydown);
  };

  bindSheetTriggers();

const MODERATION_STORAGE_KEY = 'vt:service-seller:moderation';
const moderationElements = {
  overlay: document.getElementById('moderation-overlay'),
  message: document.getElementById('moderation-overlay-message'),
  meta: document.getElementById('moderation-overlay-meta'),
  refresh: document.getElementById('moderation-overlay-refresh'),
  banner: document.getElementById('moderation-banner'),
  bannerText: document.getElementById('moderation-banner-text'),
  bannerClose: document.querySelector('[data-dismiss="moderation-banner"]')
};
let moderationSnapshot = null;

const formatModerationDateTime = (value) => {
  if (!value) return '';
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  } catch (err) {
    console.warn('formatModerationDateTime failed', err);
    return '';
  }
};

const readStoredModeration = () => {
  try {
    const raw = localStorage.getItem(MODERATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('readStoredModeration failed', err);
    return null;
  }
};

const persistModeration = (state) => {
  try {
    localStorage.setItem(MODERATION_STORAGE_KEY, JSON.stringify({
      isBlocked: !!state?.isBlocked,
      reason: state?.reason || '',
      blockedAt: state?.blockedAt || null,
      unblockedAt: state?.unblockedAt || state?.moderation?.unblockedAt || null,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.warn('persistModeration failed', err);
  }
};

const hideModerationBanner = () => {
  if (moderationElements.banner) {
    moderationElements.banner.setAttribute('hidden', '');
  }
};

const showModerationBanner = (info) => {
  if (!moderationElements.banner) return;
  const text = info?.moderation?.unblockedAt
    ? `آخرین بازبینی در ${formatModerationDateTime(info.moderation.unblockedAt)}`
    : (info?.unblockedAt ? `آخرین بازبینی در ${formatModerationDateTime(info.unblockedAt)}` : 'تمام امکانات پنل دوباره فعال است.');
  if (moderationElements.bannerText) {
    moderationElements.bannerText.textContent = text;
  }
  moderationElements.banner.removeAttribute('hidden');
};

const renderModerationMeta = (info) => {
  if (!moderationElements.meta) return;
  const parts = [];
  const blockedAtText = formatModerationDateTime(info?.blockedAt || info?.moderation?.blockedAt);
  if (blockedAtText) {
    parts.push(`<span>مسدود شده از ${escapeHtml(blockedAtText)}</span>`);
  }
  const reasonText = (info?.reason || info?.moderation?.reason || '').trim();
  if (reasonText) {
    parts.push(`<span>${escapeHtml(reasonText)}</span>`);
  } else {
    parts.push('<span>برای پیگیری با پشتیبانی ویترینت در ارتباط باشید.</span>');
  }
  const reviewedAtText = formatModerationDateTime(info?.moderation?.unblockedAt || info?.shop?.lastReviewedAt);
  if (reviewedAtText) {
    parts.push(`<span>آخرین بررسی: ${escapeHtml(reviewedAtText)}</span>`);
  }
  moderationElements.meta.innerHTML = parts.join('');
};

const applyModerationState = (info) => {
  if (!info) return;
  moderationSnapshot = info;
  const prev = readStoredModeration();
  const isBlocked = !!info.isBlocked;

  if (isBlocked) {
    document.body.dataset.shopBlocked = 'true';
    if (moderationElements.overlay) {
      moderationElements.overlay.removeAttribute('hidden');
    }
    if (moderationElements.message) {
      const reasonText = (info.reason || '').trim();
      moderationElements.message.textContent = reasonText
        ? `دلیل مسدودسازی: ${reasonText}`
        : 'برای حفظ کیفیت خدمات، دسترسی این فروشگاه موقتاً غیرفعال شده است.';
    }
    renderModerationMeta(info);
    hideModerationBanner();
  } else {
    delete document.body.dataset.shopBlocked;
    if (moderationElements.overlay) {
      moderationElements.overlay.setAttribute('hidden', '');
    }
    if (prev?.isBlocked) {
      showModerationBanner(info);
      const toast = window.UIComponents?.showToast;
      if (typeof toast === 'function') {
        toast('دسترسی فروشگاه دوباره فعال شد.', 'success');
      }
    } else {
      hideModerationBanner();
    }
  }

  persistModeration(info);
};

const fetchModerationStatus = async () => {
  try {
    const res = await fetch(bust(`${API_BASE}/api/service-shops/my/moderation`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (!res.ok) {
      throw new Error('MODERATION_STATUS_FAILED');
    }
    const data = await res.json();
    applyModerationState(data);
    return data;
  } catch (err) {
    console.error('fetchModerationStatus error', err);
    return null;
  }
};

if (moderationElements.refresh) {
  moderationElements.refresh.addEventListener('click', async () => {
    moderationElements.refresh.disabled = true;
    moderationElements.refresh.classList.add('is-loading');
    await fetchModerationStatus();
    moderationElements.refresh.classList.remove('is-loading');
    moderationElements.refresh.disabled = false;
  });
}

if (moderationElements.bannerClose) {
  moderationElements.bannerClose.addEventListener('click', () => hideModerationBanner());
}

applyModerationState(readStoredModeration());
await fetchModerationStatus();

const DEFAULT_FEATURE_FLAGS = Object.freeze({ sellerPlansEnabled: false });
const TRUE_FLAG_VALUES = new Set(['1', 'true', 'yes', 'on', 'enable', 'enabled', 'فعال', 'روشن', 'active']);
const FALSE_FLAG_VALUES = new Set(['0', 'false', 'no', 'off', 'disable', 'disabled', 'غیرفعال', 'خاموش', 'inactive']);

const parseFlagBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (TRUE_FLAG_VALUES.has(normalized)) return true;
    if (FALSE_FLAG_VALUES.has(normalized)) return false;
    return fallback;
  }
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'enabled')) {
      return parseFlagBoolean(value.enabled, fallback);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'value')) {
      return parseFlagBoolean(value.value, fallback);
    }
  }
  return fallback;
};

const normalizeFeatureFlags = (raw = {}) => ({
  sellerPlansEnabled: parseFlagBoolean(raw.sellerPlansEnabled, DEFAULT_FEATURE_FLAGS.sellerPlansEnabled)
});

function applySellerPlanFeatureFlags(flags = DEFAULT_FEATURE_FLAGS) {
  const normalized = normalizeFeatureFlags(flags);
  const planHero = document.getElementById('plan-hero');
  const plansView = document.getElementById('plans-view');
  const planNav = document.querySelector('.app-nav [data-page="plans"]');
  const overlay = plansView?.querySelector('.plan-disabled-overlay');
  const overlayTitle = overlay?.querySelector('.plan-disabled-title');
  const overlayText = overlay?.querySelector('.plan-disabled-text');
  const overlaySubtext = overlay?.querySelector('.plan-disabled-subtext');
  const viewContainer = plansView?.querySelector('.view-container');

  const rememberDefaultText = (element) => {
    if (!element || !element.dataset) return;
    if (!element.dataset.defaultText) {
      element.dataset.defaultText = element.textContent.trim();
    }
  };

  const restoreDefaultText = (element) => {
    if (!element || !element.dataset?.defaultText) return;
    element.textContent = element.dataset.defaultText;
  };

  rememberDefaultText(overlayTitle);
  rememberDefaultText(overlayText);
  rememberDefaultText(overlaySubtext);

  if (normalized.sellerPlansEnabled) {
    planHero?.removeAttribute('hidden');
    planHero?.removeAttribute('aria-hidden');
    planHero?.classList.remove('is-hidden');
    if (plansView) {
      plansView.classList.remove('plans-disabled');
      plansView.removeAttribute('aria-disabled');
      plansView.removeAttribute('aria-hidden');
    }
    overlay?.setAttribute('hidden', '');
    restoreDefaultText(overlayTitle);
    restoreDefaultText(overlayText);
    restoreDefaultText(overlaySubtext);
    viewContainer?.removeAttribute('aria-hidden');
    if (planNav) {
      planNav.classList.remove('is-hidden');
      planNav.removeAttribute('hidden');
      planNav.removeAttribute('aria-hidden');
      planNav.removeAttribute('tabindex');
    }
    if (document.body) {
      document.body.dataset.sellerPlans = 'enabled';
    }
  } else {
    planHero?.setAttribute('hidden', '');
    planHero?.setAttribute('aria-hidden', 'true');
    planHero?.classList.add('is-hidden');
    if (plansView) {
      plansView.classList.add('plans-disabled');
      plansView.setAttribute('aria-disabled', 'true');
      plansView.setAttribute('aria-hidden', 'true');
    }
    overlay?.removeAttribute('hidden');
    viewContainer?.setAttribute('aria-hidden', 'true');
    if (planNav) {
      planNav.classList.add('is-hidden');
      planNav.setAttribute('hidden', '');
      planNav.setAttribute('aria-hidden', 'true');
      planNav.setAttribute('tabindex', '-1');
    }
    if (document.body) {
      document.body.dataset.sellerPlans = 'disabled';
    }
    if (overlayTitle) {
      overlayTitle.textContent = 'پلن رایگان غیرفعال است';
    }
    if (overlayText) {
      overlayText.textContent = 'در حال حاضر مدیریت ویترینت دسترسی به پلن رایگان را متوقف کرده است.';
    }
    if (overlaySubtext) {
      overlaySubtext.textContent = 'برای اطلاع از زمان فعال‌سازی دوباره، اعلان‌ها یا پیام‌های پشتیبانی را دنبال کنید.';
    }
    if (window.location.hash === '#/plans') {
      window.location.hash = '#/dashboard';
    }
  }

  return normalized;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PLAN_PERKS_DEFAULT = Object.freeze([
  'نمایش ویژه در نتایج ویترینت',
  'پشتیبانی راه‌اندازی رایگان',
  'دسترسی به ابزارهای فروش حرفه‌ای'
]);

const faNumber = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '۰';
  try {
    return new Intl.NumberFormat('fa-IR').format(Math.max(0, Math.round(num)));
  } catch {
    return String(Math.max(0, Math.round(num)));
  }
};

const describePlanDuration = (days) => {
  const duration = Number(days);
  const result = {
    label: 'بدون محدودیت',
    status: 'بدون محدودیت',
    rawDays: null
  };

  if (!Number.isFinite(duration) || duration <= 0) {
    return result;
  }

  const suffixStatus = (label) => {
    if (!label) return '';
    if (label.endsWith('روز') || label.endsWith('ماه') || label.endsWith('سال')) {
      return `${label}ه`;
    }
    if (label.endsWith('هفته')) {
      return `${label}‌ای`;
    }
    return label;
  };

  if (duration % 365 === 0) {
    const years = duration / 365;
    const label = years === 1 ? '۱ سال' : `${faNumber(years)} سال`;
    return { label, status: suffixStatus(label), rawDays: duration };
  }

  if (duration % 30 === 0) {
    const months = duration / 30;
    const label = months === 1 ? '۱ ماه' : `${faNumber(months)} ماه`;
    return { label, status: suffixStatus(label), rawDays: duration };
  }

  if (duration % 7 === 0) {
    const weeks = duration / 7;
    const label = weeks === 1 ? '۱ هفته' : `${faNumber(weeks)} هفته`;
    return { label, status: suffixStatus(label), rawDays: duration };
  }

  const label = `${faNumber(duration)} روز`;
  return { label, status: suffixStatus(label), rawDays: duration };
};

const PlanCheckoutController = (() => {
  const state = {
    selectedPlanKey: null,
    couponPct: 0,
    coupon: null,
    couponRedeemed: false,
    couponLoading: false,
    dismissed: false
  };

  let plansView = null;
  let checkoutBar = null;
  let cbPlan = null;
  let cbDuration = null;
  let cbSaving = null;
  let cbTotal = null;
  let couponToggle = null;
  let couponRow = null;
  let couponInput = null;
  let couponApply = null;
  let cbClose = null;
  let couponStatus = null;
  let checkoutCTA = null;

  const ensureElements = () => {
    plansView = document.getElementById('plans-view');
    if (!plansView) return false;

    checkoutBar = plansView.querySelector('#checkout-bar');
    if (!checkoutBar) return false;

    cbPlan = checkoutBar.querySelector('.cb-plan');
    cbDuration = checkoutBar.querySelector('.cb-duration');
    cbSaving = checkoutBar.querySelector('.cb-saving');
    cbTotal = checkoutBar.querySelector('.cb-total');
    couponToggle = checkoutBar.querySelector('.cb-coupon-toggle');
    couponRow = checkoutBar.querySelector('.cb-coupon');
    couponInput = checkoutBar.querySelector('#coupon-input');
    couponApply = checkoutBar.querySelector('.cb-apply');
    cbClose = checkoutBar.querySelector('.cb-close');
    couponStatus = checkoutBar.querySelector('#cb-coupon-status');
    checkoutCTA = checkoutBar.querySelector('.cb-cta');
    return true;
  };

  const getCards = () => (plansView ? Array.from(plansView.querySelectorAll('.plan-modern')) : []);

  const getSelectedCard = () => {
    if (!plansView) return null;
    if (state.selectedPlanKey) {
      return (
        plansView.querySelector(`.plan-modern[data-plan="${state.selectedPlanKey}"]`) ||
        plansView.querySelector(`.plan-modern[data-id="${state.selectedPlanKey}"]`)
      );
    }
    return null;
  };

  const setCouponStatus = (message, type = 'info') => {
    if (!couponStatus) return;
    couponStatus.classList.remove('success', 'error', 'info');
    if (!message) {
      couponStatus.hidden = true;
      couponStatus.textContent = '';
      return;
    }
    couponStatus.hidden = false;
    couponStatus.textContent = message;
    couponStatus.classList.add(type);
  };

  const basePriceOf = (card) => {
    const priceEl = card?.querySelector('.price-value');
    const value = Number(priceEl?.dataset?.basePrice ?? priceEl?.dataset?.['1']);
    return Number.isFinite(value) ? value : 0;
  };

  const durationLabelOf = (card) => card?.dataset?.durationLabel || 'بدون محدودیت';
  const durationStatusOf = (card) => card?.dataset?.durationStatus || durationLabelOf(card);

  const formatPrice = (value) => {
    const amount = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    return `${faNumber(amount)} تومان`;
  };

  const updateCard = (card) => {
    if (!card) return;
    const priceEl = card.querySelector('.price-value');
    const periodValue = card.querySelector('.period-value');
    const savingsWrap = card.querySelector('.price-savings');
    const savingsAmount = card.querySelector('.savings-amount');

    if (priceEl) {
      priceEl.textContent = faNumber(basePriceOf(card));
    }
    if (periodValue) {
      periodValue.textContent = durationLabelOf(card);
    }
    if (savingsWrap) {
      savingsWrap.classList.add('hidden');
    }
    if (savingsAmount) {
      savingsAmount.textContent = '';
    }
  };

  const updateCards = () => {
    getCards().forEach(updateCard);
  };

  const hideCheckout = () => {
    if (!checkoutBar) return;
    checkoutBar.classList.remove('visible');
    checkoutBar.setAttribute('aria-hidden', 'true');
    if (cbPlan) cbPlan.textContent = '—';
    if (cbDuration) cbDuration.textContent = '—';
    if (cbSaving) {
      cbSaving.textContent = '';
      cbSaving.style.display = 'none';
    }
    if (cbTotal) cbTotal.textContent = '—';
    setCouponStatus('');
  };

  const showCheckout = (card) => {
    if (!checkoutBar || !card) return;

    const base = basePriceOf(card);
    const coupon = state.coupon;
    const discountPercent = Number(coupon?.discountPercent ?? state.couponPct ?? 0);
    const finalPrice = Math.max(0, base * (1 - discountPercent / 100));

    if (cbPlan) {
      cbPlan.textContent = card.querySelector('.plan-title-card')?.textContent?.trim() || '—';
    }
    if (cbDuration) {
      cbDuration.textContent = durationStatusOf(card);
    }
    if (cbSaving) {
      if (discountPercent > 0) {
        const codeLabel = coupon?.code ? ` با کد ${escapeHtml(coupon.code)}` : '';
        cbSaving.innerHTML = `تخفیف ${faNumber(discountPercent)}٪${codeLabel}`;
        cbSaving.style.display = 'inline-block';
      } else {
        cbSaving.textContent = '';
        cbSaving.style.display = 'none';
      }
    }
    if (cbTotal) {
      cbTotal.textContent = formatPrice(finalPrice);
    }

    checkoutBar.classList.add('visible');
    checkoutBar.setAttribute('aria-hidden', 'false');
  };

  const updateCheckout = () => {
    const selected = getSelectedCard();
    if (!selected || state.dismissed) {
      hideCheckout();
      return;
    }
    state.couponPct = Number(state.coupon?.discountPercent || 0);
    showCheckout(selected);
  };

  const selectPlan = (card) => {
    if (!card) return;
    getCards().forEach((c) => {
      if (c === card) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
      }
    });
    state.selectedPlanKey = card.dataset.plan || card.dataset.id || card.dataset.slug || null;
    state.couponRedeemed = false;
    state.dismissed = false;
    updateCheckout();
  };

  const handlePlansClick = (event) => {
    if (!plansView) return;
    const card = event.target.closest('.plan-modern');
    if (!card || !plansView.contains(card)) return;
    event.stopPropagation();
    selectPlan(card);
  };

  const handleCouponToggle = () => {
    if (!couponRow || !couponToggle) return;
    const willShow = couponRow.hasAttribute('hidden');
    couponRow.toggleAttribute('hidden');
    couponToggle.setAttribute('aria-expanded', String(willShow));
  };

  const handleCouponApply = async () => {
    if (state.couponLoading) return;
    const raw = couponInput?.value?.trim() || '';

    if (!raw) {
      state.coupon = null;
      state.couponPct = 0;
      state.couponRedeemed = false;
      setCouponStatus('کد تخفیف غیرفعال شد.', 'info');
      updateCheckout();
      window.UIComponents?.showToast?.('کد تخفیف حذف شد.', 'info');
      return;
    }

    if (!state.selectedPlanKey) {
      setCouponStatus('برای اعمال کد، ابتدا یک پلن را انتخاب کنید.', 'info');
      window.UIComponents?.showToast?.('ابتدا پلن مورد نظر را انتخاب کنید.', 'info');
      return;
    }

    const code = raw.toUpperCase().replace(/[^A-Z0-9-_]/g, '');
    if (couponInput) {
      couponInput.value = code;
    }

    if (!code) {
      setCouponStatus('کد وارد شده معتبر نیست.', 'error');
      window.UIComponents?.showToast?.('کد وارد شده معتبر نیست.', 'error');
      return;
    }

    const originalLabel = couponApply?.textContent ?? '';

    try {
      state.couponLoading = true;
      setCouponStatus('در حال بررسی کد...', 'info');
      if (couponApply) {
        couponApply.disabled = true;
        couponApply.dataset.originalLabel = originalLabel;
        couponApply.textContent = 'در حال بررسی...';
      }

      const result = await API.validatePlanDiscountCode({ code, planKey: state.selectedPlanKey });
      if (!result) {
        throw new Error('کد تخفیف نامعتبر است.');
      }

      state.coupon = result;
      state.couponPct = Number(result.discountPercent || 0);
      state.couponRedeemed = false;
      setCouponStatus(`کد ${result.code} فعال شد.`, 'success');
      updateCheckout();
      window.UIComponents?.showToast?.(`کد ${result.code} اعمال شد.`, 'success');
    } catch (err) {
      state.coupon = null;
      state.couponPct = 0;
      state.couponRedeemed = false;
      const message = err?.message || 'کد تخفیف نامعتبر است.';
      setCouponStatus(message, 'error');
      updateCheckout();
      window.UIComponents?.showToast?.(message, 'error');
    } finally {
      state.couponLoading = false;
      if (couponApply) {
        couponApply.disabled = false;
        if (couponApply.dataset.originalLabel != null) {
          couponApply.textContent = couponApply.dataset.originalLabel;
          delete couponApply.dataset.originalLabel;
        } else {
          couponApply.textContent = originalLabel;
        }
      }
    }
  };

  const handleCheckoutCTA = async () => {
    if (!checkoutCTA) return;
    if (!state.selectedPlanKey) {
      window.UIComponents?.showToast?.('ابتدا پلن مورد نظر را انتخاب کنید.', 'info');
      return;
    }

    const originalLabel = checkoutCTA.textContent ?? '';
    checkoutCTA.disabled = true;
    checkoutCTA.setAttribute('aria-busy', 'true');
    checkoutCTA.textContent = 'در حال پردازش...';

    try {
      if (state.coupon?.code && !state.couponRedeemed) {
        setCouponStatus(`در حال ثبت کد ${state.coupon.code}...`, 'info');
        const updated = await API.redeemPlanDiscountCode(state.coupon.code, {});
        if (updated) {
          state.coupon = updated;
          state.couponPct = Number(updated.discountPercent || 0);
        }
        state.couponRedeemed = true;
        setCouponStatus(`ثبت کد ${state.coupon.code} انجام شد.`, 'success');
        updateCheckout();
      }

      window.UIComponents?.showToast?.('درگاه پرداخت به‌زودی متصل می‌شود.', 'success');
    } catch (err) {
      const message = err?.message || 'ثبت استفاده از کد تخفیف ناموفق بود.';
      setCouponStatus(message, 'error');
      window.UIComponents?.showToast?.(message, 'error');
      state.couponRedeemed = false;
    } finally {
      checkoutCTA.disabled = false;
      checkoutCTA.removeAttribute('aria-busy');
      checkoutCTA.textContent = originalLabel;
    }
  };

  const handleClose = (event) => {
    event?.stopPropagation();
    state.dismissed = true;
    updateCheckout();
  };

  const handleDocumentClick = (event) => {
    if (!checkoutBar?.classList.contains('visible')) return;
    if (checkoutBar.contains(event.target)) return;
    if (event.target.closest('.plan-modern')) return;
    state.dismissed = true;
    updateCheckout();
  };

  const handleHashChange = () => {
    if (window.location.hash === '#/plans') {
      if (!state.dismissed) {
        updateCheckout();
      }
    } else {
      hideCheckout();
    }
  };

  const init = () => {
    if (!ensureElements()) return;

    if (checkoutBar.dataset.controllerBound === 'true') {
      updateCards();
      updateCheckout();
      return;
    }

    checkoutBar.dataset.controllerBound = 'true';

    plansView.addEventListener('click', handlePlansClick);
    couponToggle?.addEventListener('click', handleCouponToggle);
    couponApply?.addEventListener('click', handleCouponApply);
    cbClose?.addEventListener('click', handleClose);
    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('hashchange', handleHashChange);
    checkoutCTA?.addEventListener('click', handleCheckoutCTA);

    updateCards();
    updateCheckout();
  };

  const refresh = () => {
    if (!ensureElements()) return;
    updateCards();
    if (state.selectedPlanKey) {
      const selected = getSelectedCard();
      if (!selected) {
        state.selectedPlanKey = null;
        state.dismissed = false;
      }
    }
    updateCheckout();
  };

  return { init, refresh, state };
})();

const formatPersianDate = (value) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-nu-latn-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch {
    return date.toLocaleDateString('fa-IR');
  }
};

const planUI = {
  grid: document.getElementById('seller-plans-grid'),
  feedback: document.getElementById('seller-plans-feedback'),
  states: {
    loading: document.getElementById('seller-plans-loading'),
    empty: document.getElementById('seller-plans-empty'),
    error: document.getElementById('seller-plans-error')
  },
  socialProof: document.getElementById('plans-social-proof')
};

const PLAN_CARD_ICONS = Object.freeze([
  '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m4 0v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>'
]);

const PLAN_FEATURE_CHECK_ICON = '<svg class="feature-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
const PLAN_CTA_ARROW_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14m-7-7l7 7-7 7"/></svg>';

const normalizePlanSlugForDisplay = (value, fallback) => {
  const raw = (value || '').toString().trim().toLowerCase();
  if (!raw) return fallback;
  return raw.replace(/[^a-z0-9-\s]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
};

const setPlansState = (state) => {
  const states = planUI.states || {};
  let matchedState = false;

  Object.entries(states).forEach(([key, el]) => {
    if (!el) return;
    const isActive = state === key;
    if (isActive) matchedState = true;
    el.hidden = !isActive;
    if (isActive) {
      el.setAttribute('aria-hidden', 'false');
      el.classList.add('is-active');
    } else {
      el.setAttribute('aria-hidden', 'true');
      el.classList.remove('is-active');
    }
  });

  if (planUI.feedback) {
    const shouldHideFeedback = state === 'ready' || !matchedState;
    planUI.feedback.dataset.state = state;
    planUI.feedback.setAttribute('aria-hidden', shouldHideFeedback ? 'true' : 'false');
    if (shouldHideFeedback) {
      planUI.feedback.setAttribute('hidden', '');
    } else {
      planUI.feedback.removeAttribute('hidden');
    }
  }

  if (planUI.grid) {
    if (state === 'ready') {
      planUI.grid.removeAttribute('hidden');
    } else {
      planUI.grid.setAttribute('hidden', '');
    }
  }

  if (planUI.socialProof && state !== 'ready') {
    planUI.socialProof.textContent = '';
  }
};

const resolvePlanStatus = (plan, meta) => {
  if (meta.featured) return 'پیشنهاد ویژه';
  if (plan.durationInfo?.rawDays != null) {
    return plan.durationInfo.status;
  }
  if (plan.durationInfo?.label) {
    return plan.durationInfo.label;
  }
  if (meta.index === 0 && meta.total > 1) return 'اقتصادی';
  if (meta.index === meta.total - 1 && meta.total > 1) return 'پیشرفته';
  return 'پلن فعال';
};

const pickPlanIcon = (index = 0) => PLAN_CARD_ICONS[index % PLAN_CARD_ICONS.length];

const normalisePlanForDisplay = (plan, index) => {
  const fallbackId = `plan-${index}`;
  const rawFeatures = Array.isArray(plan?.features) ? plan.features : [];
  const features = rawFeatures
    .map((feature) => (typeof feature === 'string' ? feature : feature?.value))
    .filter(Boolean);

  const price = Number(plan?.price);
  const durationRaw = Number(plan?.durationDays);
  const durationDays = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : null;
  const durationInfo = describePlanDuration(durationDays);

  const title = (plan?.title || '').toString().trim();
  const description = (plan?.description || '').toString().trim();
  const slug = normalizePlanSlugForDisplay(plan?.slug, fallbackId);

  return {
    id: plan?.id || plan?._id || slug || fallbackId,
    slug: slug || fallbackId,
    title: title || 'پلن خدماتی',
    description: description || 'جزئیات این پلن به‌زودی تکمیل می‌شود.',
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    durationDays,
    durationInfo,
    durationLabel: durationInfo.label,
    durationStatus: durationInfo.status,
    features: features.length ? features : PLAN_PERKS_DEFAULT.slice()
  };
};

const createPlanCard = (plan, meta) => {
  const article = document.createElement('article');
  article.className = 'plan-modern';
  article.dataset.plan = plan.slug || plan.id;
  article.dataset.price = String(Math.max(0, plan.price));
  if (plan.durationDays != null) {
    article.dataset.durationDays = String(plan.durationDays);
  }
  if (plan.durationInfo) {
    article.dataset.durationLabel = plan.durationInfo.label || '';
    article.dataset.durationStatus = plan.durationInfo.status || '';
  }
  article.setAttribute('role', 'listitem');

  if (meta.featured) {
    article.classList.add('featured');
  }

  const status = document.createElement('div');
  status.className = 'plan-status';
  if (meta.featured) {
    status.classList.add('featured');
  }
  status.textContent = meta.status;
  article.appendChild(status);

  if (meta.featured) {
    const glow = document.createElement('div');
    glow.className = 'plan-featured-glow';
    glow.setAttribute('aria-hidden', 'true');
    article.appendChild(glow);
  }

  const content = document.createElement('div');
  content.className = 'plan-content-modern';
  article.appendChild(content);

  const icon = document.createElement('div');
  icon.className = 'plan-icon-modern';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = pickPlanIcon(meta.index);
  content.appendChild(icon);

  const titleEl = document.createElement('h3');
  titleEl.className = 'plan-title-card';
  titleEl.textContent = plan.title;
  content.appendChild(titleEl);

  const descEl = document.createElement('p');
  descEl.className = 'plan-desc';
  descEl.textContent = plan.description;
  content.appendChild(descEl);

  const priceWrap = document.createElement('div');
  priceWrap.className = 'plan-price-modern';
  content.appendChild(priceWrap);

  const priceMain = document.createElement('div');
  priceMain.className = 'price-main';
  priceWrap.appendChild(priceMain);

  const priceValue = document.createElement('span');
  priceValue.className = 'price-value';
  priceValue.dataset['1'] = String(Math.max(0, plan.price));
  priceValue.dataset.basePrice = String(Math.max(0, plan.price));
  priceValue.textContent = faNumber(plan.price);
  priceMain.appendChild(priceValue);

  const currency = document.createElement('span');
  currency.className = 'price-currency';
  currency.textContent = 'تومان';
  priceMain.appendChild(currency);

  const period = document.createElement('div');
  period.className = 'price-period';
  const hasFiniteDuration = plan.durationInfo?.rawDays != null;
  period.textContent = hasFiniteDuration ? 'برای ' : 'مدت پلن: ';
  const periodValue = document.createElement('span');
  periodValue.className = 'period-value';
  periodValue.textContent = plan.durationInfo?.label || 'بدون محدودیت';
  period.appendChild(periodValue);
  priceWrap.appendChild(period);

  const savings = document.createElement('div');
  savings.className = 'price-savings hidden';
  const savingsAmount = document.createElement('span');
  savingsAmount.className = 'savings-amount';
  savings.appendChild(savingsAmount);
  priceWrap.appendChild(savings);

  const featuresWrap = document.createElement('div');
  featuresWrap.className = 'plan-features-modern';
  content.appendChild(featuresWrap);

  plan.features.forEach((text) => {
    const item = document.createElement('div');
    item.className = 'feature-modern';
    item.innerHTML = PLAN_FEATURE_CHECK_ICON;
    const span = document.createElement('span');
    span.textContent = text;
    item.appendChild(span);
    featuresWrap.appendChild(item);
  });

  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = meta.featured ? 'plan-cta-modern primary' : 'plan-cta-modern';
  cta.setAttribute('aria-label', `انتخاب پلن ${plan.title}`);
  if (meta.featured) {
    cta.innerHTML = `<span>انتخاب پلن</span>${PLAN_CTA_ARROW_ICON}`;
  } else {
    cta.textContent = 'انتخاب پلن';
  }
  content.appendChild(cta);

  return article;
};

const renderSellerPlans = (plansRaw = []) => {
  if (!planUI.grid) return [];

  const activePlans = Array.isArray(plansRaw)
    ? plansRaw.filter((plan) => plan && plan.isActive !== false)
    : [];

  if (!activePlans.length) {
    planUI.grid.innerHTML = '';
    setPlansState('empty');
    window.__SELLER_SERVICE_PLANS__ = [];
    PlanCheckoutController.refresh();
    PlanCheckoutController.init();
    return [];
  }

  const normalised = activePlans.map((plan, index) => normalisePlanForDisplay(plan, index));
  normalised.sort((a, b) => a.price - b.price || a.title.localeCompare(b.title, 'fa-IR'));

  const featuredIndex = normalised.length > 1 ? Math.min(1, normalised.length - 1) : 0;

  planUI.grid.innerHTML = '';
  normalised.forEach((plan, index) => {
    const card = createPlanCard(plan, {
      index,
      total: normalised.length,
      featured: index === featuredIndex,
      status: resolvePlanStatus(plan, { index, total: normalised.length, featured: index === featuredIndex })
    });
    planUI.grid.appendChild(card);
  });

  setPlansState('ready');

  if (planUI.socialProof) {
    planUI.socialProof.textContent = `${faNumber(normalised.length)} پلن فعال برای انتخاب آماده است.`;
  }

  window.__SELLER_SERVICE_PLANS__ = normalised;
  PlanCheckoutController.refresh();
  PlanCheckoutController.init();
  return normalised;
};

async function loadSellerPlans() {
  if (!planUI.grid) return [];
  try {
    setPlansState('loading');
    const plans = await API.getServicePlans();
    return renderSellerPlans(plans);
  } catch (err) {
    console.error('loadSellerPlans failed', err);
    planUI.grid.innerHTML = '';
    setPlansState('error');
    window.__SELLER_SERVICE_PLANS__ = [];
    PlanCheckoutController.refresh();
    PlanCheckoutController.init();
    return [];
  }
}

const ensureDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizePlanForUI = (raw = {}) => {
  const plan = {
    isActive: !!raw.isActive,
    note: raw.note || '',
    startDate: ensureDate(raw.startDate),
    endDate: ensureDate(raw.endDate),
    durationDays: null,
    usedDays: null,
    remainingDays: raw.remainingDays ?? null,
    totalDays: raw.totalDays ?? null,
    activeNow: !!raw.activeNow,
    hasExpired: !!raw.hasExpired,
    perks: Array.isArray(raw.perks) && raw.perks.length ? raw.perks : PLAN_PERKS_DEFAULT,
    title: raw.planTitle || raw.title || '',
    slug: raw.planSlug || raw.slug || ''
  };

  const durationInput = Number(raw.durationDays);
  if (Number.isFinite(durationInput) && durationInput > 0) {
    plan.durationDays = Math.round(durationInput);
  }

  if (plan.startDate && plan.endDate && plan.durationDays == null) {
    const diff = Math.round((plan.endDate - plan.startDate) / MS_PER_DAY);
    plan.durationDays = diff > 0 ? diff : 1;
  }

  if (plan.totalDays == null && plan.durationDays != null) {
    plan.totalDays = plan.durationDays;
  }

  const now = new Date();
  const effectiveEnd = plan.endDate && plan.endDate < now ? plan.endDate : now;

  if (plan.startDate) {
    const used = Math.max(0, Math.round((effectiveEnd - plan.startDate) / MS_PER_DAY));
    if (plan.totalDays != null) {
      plan.usedDays = Math.min(used, Math.max(0, plan.totalDays));
    } else if (plan.endDate) {
      const diff = Math.max(0, Math.round((plan.endDate - plan.startDate) / MS_PER_DAY));
      plan.totalDays = diff;
      plan.usedDays = Math.min(used, diff);
    } else {
      plan.usedDays = used;
    }
  }

  if (plan.remainingDays == null) {
    if (plan.endDate) {
      plan.remainingDays = Math.max(0, Math.ceil((plan.endDate - now) / MS_PER_DAY));
    } else if (plan.totalDays != null && plan.usedDays != null) {
      plan.remainingDays = Math.max(0, plan.totalDays - plan.usedDays);
    }
  }

  plan.activeNow = plan.activeNow || (plan.isActive && (!plan.endDate || plan.endDate >= now));
  plan.hasExpired = plan.hasExpired || (plan.isActive && !!plan.endDate && plan.endDate < now);

  return plan;
};

const bindPlanHeroActions = (() => {
  let bound = false;
  return () => {
    if (bound) return;
    bound = true;
    const goPlans = () => { window.location.hash = '#/plans'; };
    document.getElementById('plan-renew-btn')?.addEventListener('click', goPlans);
  };
})();

function renderComplimentaryPlan(planRaw) {
  const planHero = document.getElementById('plan-hero');
  if (!planHero) return;

  planHero.removeAttribute('hidden');
  planHero.setAttribute('aria-hidden', 'false');
  planHero.classList.remove('is-hidden');

  const plan = normalizePlanForUI(planRaw || {});
  const tierEl = document.getElementById('plan-tier');
  const daysLeftEl = document.getElementById('plan-days-left');
  const expiryEl = document.getElementById('plan-expiry');
  const progressBar = document.getElementById('plan-progress-bar');
  const usedEl = document.getElementById('plan-used');
  const leftEl = document.getElementById('plan-left');
  const messageEl = document.getElementById('plan-hero-message');
  const perksList = document.getElementById('plan-hero-perks');
  const statusChip = document.getElementById('plan-status-chip');
  const subtextEl = document.getElementById('plan-hero-subtext');
  const plansDisabled = document.body?.dataset?.sellerPlans === 'disabled';
  const planCtaBtn = document.getElementById('plan-renew-btn');
  const planNameEl = document.getElementById('plan-name');
  const progressTrack = document.getElementById('plan-progress');

  const hasAnyPlanLifecycle = plan.activeNow || plan.isActive || plan.hasExpired || plan.startDate || plan.endDate;
  const planlessNudge = !plansDisabled && !hasAnyPlanLifecycle;

  const planState = plan.activeNow
    ? 'active'
    : plan.hasExpired
      ? 'expired'
      : plan.isActive
        ? 'scheduled'
        : 'inactive';

  if (planHero.dataset) {
    planHero.dataset.planState = planState;
    planHero.dataset.planDisabled = plansDisabled ? 'true' : 'false';
  }

  planHero.classList.toggle('plan-hero--empty', planlessNudge);

  bindPlanHeroActions();

  if (tierEl) {
    const tierLabel = planlessNudge
      ? 'نیاز به انتخاب پلن'
      : (plan.title ? `پلن «${plan.title}» غیرفعال است` : 'پلن رایگان غیرفعال شده است');
    tierEl.textContent = tierLabel;
  }

  if (planNameEl) {
    planNameEl.textContent = planlessNudge ? 'در انتظار انتخاب پلن' : (plan.title || 'پلن هدیه غیرفعال شده');
  }

  if (planCtaBtn) {
    if (planlessNudge) {
      planCtaBtn.textContent = 'مشاهده و خرید پلن';
      planCtaBtn.setAttribute('aria-label', 'مشاهده و خرید پلن مناسب کسب‌وکار');
    } else {
      planCtaBtn.textContent = 'فعالسازی مجدد / ارتقا';
      planCtaBtn.setAttribute('aria-label', 'فعالسازی مجدد یا ارتقای پلن متوقف‌شده');
    }
  }

  const remainingDays = plan.remainingDays != null ? Math.max(0, plan.remainingDays) : null;
  if (daysLeftEl) {
    daysLeftEl.textContent = remainingDays != null ? `${faNumber(remainingDays)} روز` : '—';
  }

  const expiryDate = plan.endDate || (plan.startDate && plan.totalDays != null
    ? new Date(plan.startDate.getTime() + plan.totalDays * MS_PER_DAY)
    : null);
  const expiryLabel = expiryDate ? formatPersianDate(expiryDate) : 'نامشخص';
  if (expiryEl) {
    expiryEl.textContent = expiryLabel;
  }
  const startLabel = plan.startDate ? formatPersianDate(plan.startDate) : null;

  const progress = plan.totalDays
    ? Math.min(100, Math.max(0, Math.round(((plan.usedDays || 0) / plan.totalDays) * 100)))
    : 0;
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
    progressBar.setAttribute('aria-valuemin', '0');
    progressBar.setAttribute('aria-valuemax', '100');
    progressBar.setAttribute('aria-valuenow', String(progress));
  }
  const usedDays = plan.usedDays != null ? Math.max(0, plan.usedDays) : 0;
  const leftDays = remainingDays != null && plan.totalDays != null
    ? Math.max(0, plan.totalDays - usedDays)
    : remainingDays ?? 0;
  const progressText = `${faNumber(progress)}٪ استفاده شده`;

  if (progressTrack) {
    progressTrack.setAttribute('aria-valuenow', String(progress));
    progressTrack.setAttribute('aria-valuetext', progressText);
  }

  if (usedEl) usedEl.textContent = `${faNumber(usedDays)} روز (${faNumber(progress)}٪)`;
  if (leftEl) leftEl.textContent = `${faNumber(leftDays)} روز`;

  if (statusChip) {
    statusChip.classList.remove('chip-live');
    if (planlessNudge) {
      statusChip.textContent = 'پلن انتخاب نشده است';
    } else if (plan.activeNow) {
      statusChip.textContent = 'دسترسی پلن متوقف شده است';
    } else if (plan.hasExpired) {
      statusChip.textContent = 'پلن رایگان منقضی شده';
    } else if (plan.isActive) {
      statusChip.textContent = 'پلن رایگان در انتظار شروع (غیرفعال)';
    } else {
      statusChip.textContent = 'پلن رایگان غیرفعال';
    }
  }

  if (perksList) {
    perksList.innerHTML = '';
    const perks = planlessNudge
      ? [
          'مقایسه پلن‌ها و انتخاب سریع',
          'پشتیبانی تلفنی ۹۱۰۰-۹۹۰۰ برای راهنمایی',
          'فعال‌سازی فوری پس از پرداخت'
        ]
      : plan.perks;
    perks.forEach((perk) => {
      const li = document.createElement('li');
      li.textContent = perk;
      perksList.appendChild(li);
    });
  }

  if (messageEl) {
    if (plan.note) {
      messageEl.textContent = plan.note;
    } else if (planlessNudge) {
      messageEl.innerHTML = 'هیچ پلنی برای فروشگاه فعال نیست و دسترسی‌ها متوقف شده‌اند. برای فعال شدن همه قابلیت‌ها، از بخش «<a href="#/plans" class="plan-link">پلن‌ها</a>» یکی از گزینه‌ها را انتخاب کنید.';
    } else if (plan.activeNow) {
      messageEl.textContent = 'پلن رایگان شما از سمت مدیریت غیرفعال شده است. برای فعال‌سازی مجدد از بخش «پلن‌ها» اقدام کنید یا با پشتیبانی در ارتباط باشید.';
    } else if (plan.hasExpired) {
      messageEl.textContent = 'دوره پلن به پایان رسیده است. برای ادامه از بخش «پلن‌ها» پلن جدیدی انتخاب و فعال کنید.';
    } else if (plan.isActive) {
      const startText = startLabel ? `از ${startLabel}` : 'به‌زودی';
      messageEl.textContent = `پلن رایگان شما ${startText} فعال می‌شود اما در حال حاضر غیرفعال است. هنگام شروع، همینجا اطلاع‌رسانی خواهد شد.`;
    } else if (plansDisabled) {
      messageEl.textContent = 'پلن رایگان موقتاً از سمت مدیریت غیرفعال است. با تغییر وضعیت، اطلاع‌رسانی می‌شود.';
    } else {
      messageEl.textContent = 'هنوز پلن رایگان برای فروشگاه شما فعال نشده است. در صورت فعال‌سازی، جزئیات همینجا نمایش داده می‌شود.';
    }
  }

  let subtext = 'وضعیت پلن رایگان توسط تیم مدیریت ویترینت کنترل می‌شود و فعلاً غیرفعال است. برای پیگیری با پشتیبانی در ارتباط باشید.';
  if (plan.activeNow) {
    subtext = 'دسترسی پلن متوقف شده است و تا فعال‌سازی مجدد امکان استفاده کامل وجود ندارد.';
  } else if (plan.hasExpired) {
    subtext = 'پلن قبلی منقضی شده است. از بخش «پلن‌ها» یکی از گزینه‌ها را انتخاب کنید تا دسترسی کامل دوباره فعال شود.';
  } else if (plan.isActive) {
    subtext = startLabel
      ? `پلن رایگان شما از ${startLabel} فعال می‌شود و تا آن زمان غیرفعال باقی می‌ماند.`
      : 'پلن رایگان شما زمان‌بندی شده است و تا شروع دوره غیرفعال خواهد بود.';
  } else if (plansDisabled) {
    subtext = 'دسترسی رایگان به صورت سراسری غیرفعال شده است؛ با تغییر وضعیت، اطلاع‌رسانی می‌شود.';
  }
  if (subtextEl) {
    if (planlessNudge) {
      subtextEl.innerHTML = 'برای شروع فروش حرفه‌ای، وارد بخش <a href="#/plans" class="plan-link">پلن‌ها</a> شوید، پلن مناسب را انتخاب کنید و در کمتر از یک دقیقه فعال‌سازی را انجام دهید.';
    } else {
      subtextEl.textContent = subtext;
    }
  }

  window.__COMPLIMENTARY_PLAN_NORMALIZED__ = plan;
}

const PlanAccessGuard = (() => {
  // نگهداری آخرین وضعیت پلن
  let currentPlan = null;

  const overlays = {
    settings: document.getElementById('plan-lock-settings'),
    bookings: document.getElementById('plan-lock-bookings')
  };

  const lockableButtons = [
    document.getElementById('add-service-btn'),
    document.getElementById('add-portfolio-btn'),
    document.getElementById('vip-settings-btn'),
    document.getElementById('vip-toggle-btn'),
    document.getElementById('vip-toggle-confirm'),
    document.getElementById('service-image-btn'),
    document.getElementById('portfolio-image-btn'),
    document.getElementById('footer-pick-btn'),
    document.getElementById('footer-remove-btn')
  ];

  const lockableForms = [
    document.getElementById('settings-form'),
    document.getElementById('service-form'),
    document.getElementById('portfolio-form'),
    document.getElementById('vip-form')
  ];

  const goPlans = () => { window.location.hash = '#/plans'; };

  const ensureOverlayActions = () => {
    Object.values(overlays).forEach((overlay) => {
      if (!overlay || overlay.dataset.bind === 'true') return;
      overlay.dataset.bind = 'true';
      overlay.querySelectorAll('[data-go-plans]').forEach((btn) => {
        btn.addEventListener('click', goPlans);
      });
    });
  };

  // تابع اصلی اعمال قفل یا باز کردن
  const setLockedState = (isLocked) => {
    ensureOverlayActions();
    
    // 1. مدیریت پرده‌های قفل (Overlays)
    Object.values(overlays).forEach((overlay) => {
      if (!overlay) return;
      overlay.hidden = !isLocked;
      overlay.setAttribute('aria-hidden', isLocked ? 'false' : 'true');
      // اگر باز شد، مطمئن شو دیسپلی none نباشه
      if (!isLocked) overlay.style.display = 'none'; 
      else overlay.style.display = '';
    });

    // 2. مدیریت دکمه‌ها
    lockableButtons.forEach((btn) => {
      if (!btn) return;
      btn.disabled = isLocked;
      if (isLocked) {
        btn.setAttribute('aria-disabled', 'true');
        btn.classList.add('is-disabled');
      } else {
        btn.removeAttribute('aria-disabled');
        btn.classList.remove('is-disabled');
        delete btn.dataset.prevDisabled;
      }
    });

    // 3. مدیریت فرم‌ها
    lockableForms.forEach((form) => {
      if (!form) return;
      form.classList.toggle('is-disabled', isLocked);
      form.setAttribute('aria-disabled', isLocked ? 'true' : 'false');
      form.querySelectorAll('input, select, textarea, button').forEach((ctrl) => {
        ctrl.disabled = isLocked;
        if (!isLocked) ctrl.removeAttribute('aria-disabled');
      });
    });
  };

  // === منطق هوشمند تشخیص فعال بودن ===
  const hasActivePlan = (plan) => {
    // 1. اگر آبجکت پلن معتبر از سمت سرور اومده باشه
    if (plan) {
      if (plan.hasExpired) return false;
      if (plan.activeNow || plan.isActive) return true;
    }

    // 2. [مهم] چک کردن اطلاعات فروشنده در LocalStorage
    // اگر API پلن null داد، شاید در اطلاعات فروشنده (api/sellers/me) چیزی باشه
    try {
        const seller = JSON.parse(localStorage.getItem('seller') || '{}');
        // اگر فروشنده "ویژه" باشه یا فلگ خاصی داشته باشه (اینجا فرضی چک می‌کنیم)
        // اگر ادمین هستید یا دیتای خاصی دارید، اینجا رو میشه شرط گذاشت
        if (seller && seller.hasActivePlan === true) return true; 
    } catch(e) {}

    return false; // در غیر این صورت قفل شود
  };

  return {
    refresh: (rawPlan) => {
      // تبدیل دیتای خام به فرمت استاندارد UI
      const normalizedPlan = rawPlan ? normalizePlanForUI(rawPlan) : null;
      currentPlan = normalizedPlan;
      
      // تصمیم‌گیری: قفل باشه یا باز؟
      const shouldBeLocked = !hasActivePlan(normalizedPlan);
      
      setLockedState(shouldBeLocked);
      
      // ذخیره وضعیت برای دسترسی گلوبال
      window.__COMPLIMENTARY_PLAN_NORMALIZED__ = normalizedPlan;
      
      console.log('PlanGuard Updated:', shouldBeLocked ? 'LOCKED 🔒' : 'UNLOCKED 🔓');
    },
    
    isActive: () => hasActivePlan(currentPlan)
  };
})();

function showPlanPromptModal() {
  let backdrop = document.getElementById('plan-prompt-modal');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'plan-prompt-modal';
    backdrop.className = 'plan-prompt-backdrop';
    backdrop.innerHTML = `
      <div class="plan-prompt" role="dialog" aria-modal="true" aria-labelledby="plan-prompt-title">
        <header>
          <h3 id="plan-prompt-title">برای افزودن خدمات باید پلن بخرید</h3>
          <button type="button" class="close-btn" aria-label="بستن" data-close>✕</button>
        </header>
        <p>هیچ پلنی برای فروشگاه فعال نیست. برای اضافه کردن خدمات، نمونه‌کار و استفاده از نوبت‌دهی، یکی از پلن‌های پنل فروشنده را فعال کنید.</p>
        <div class="actions">
          <button type="button" class="btn-primary" data-go-plans>مشاهده پلن‌ها</button>
          <button type="button" class="btn-secondary" data-close>بعداً</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const close = () => backdrop.setAttribute('hidden', '');
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
    backdrop.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', close));
    backdrop.querySelectorAll('[data-go-plans]').forEach((btn) => btn.addEventListener('click', () => {
      window.location.hash = '#/plans';
      close();
    }));
  }

  backdrop.removeAttribute('hidden');
}

async function loadComplimentaryPlan() {
  try {
    const response = await API.getComplimentaryPlan();
    const plan = response?.plan || null;
    renderComplimentaryPlan(plan);
    window.__COMPLIMENTARY_PLAN__ = plan;
    PlanAccessGuard.refresh(plan);

    // اگر پلن هدیه واقعاً فعال باشد، حتی در صورت شکست در دریافت فلگ‌ها
    // باید دسترسی پلن برای فروشنده آزاد شود.
    try {
      const normalizedPlan = plan ? normalizePlanForUI(plan) : null;
      const hasActivePlan = normalizedPlan && (
        normalizedPlan.activeNow
          || (normalizedPlan.isActive && !normalizedPlan.hasExpired)
          || (normalizedPlan.endDate instanceof Date && normalizedPlan.endDate > new Date())
      );

      if (hasActivePlan) {
        featureFlags = applySellerPlanFeatureFlags({
          ...featureFlags,
          sellerPlansEnabled: true
        });
        window.__FEATURE_FLAGS__ = featureFlags;
      }
    } catch (planErr) {
      console.warn('normalize complimentary plan failed', planErr);
    }
  } catch (err) {
    console.warn('loadComplimentaryPlan failed', err);
    renderComplimentaryPlan(null);
    PlanAccessGuard.refresh(null);
  }
}

const EMPTY_DASHBOARD_STATS = {
  todayBookings: 0,
  yesterdayBookings: 0,
  pendingBookings: 0,
  activeCustomers: 0,
  previousActiveCustomers: 0,
  newCustomers30d: 0,
  ratingAverage: 0,
  ratingCount: 0
};

const ACTIVE_BOOKING_STATUSES = new Set(['pending', 'confirmed', 'completed']);

const toISODateString = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

const parseBookingDate = (booking) => {
  const raw = booking?.dateISO || booking?.bookingDate || booking?.date;
  if (!raw) return null;

  const cleaned = String(raw).split('T')[0].replace(/\//g, '-').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const [year, month, day] = cleaned.split('-').map(Number);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  const parsed = Date.parse(cleaned);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
};

const computeFallbackDashboardStats = () => {
  try {
    const data = window.MOCK_DATA || {};
    const bookings = Array.isArray(data.bookings) ? data.bookings : [];
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const prevNinetyStart = new Date(ninetyDaysAgo);
    prevNinetyStart.setDate(prevNinetyStart.getDate() - 90);

    const todayISO = toISODateString(today);
    const yesterdayISO = toISODateString(yesterday);

    const activeCustomers = new Set();
    const previousActiveCustomers = new Set();
    const newCustomers30d = new Set();

    const stats = { ...EMPTY_DASHBOARD_STATS };

    bookings.forEach((booking) => {
      const status = String(booking?.status || '').toLowerCase();
      const bookingDate = parseBookingDate(booking);
      const bookingISO = toISODateString(bookingDate);
      const customerKey = booking?.customerPhone || booking?.customerId || booking?.customerName || booking?._id || booking?.id;

      if (status === 'pending') {
        stats.pendingBookings += 1;
      }

      if (!bookingDate || !customerKey) {
        return;
      }

      if (bookingISO === todayISO && ACTIVE_BOOKING_STATUSES.has(status)) {
        stats.todayBookings += 1;
      }

      if (bookingISO === yesterdayISO && ACTIVE_BOOKING_STATUSES.has(status)) {
        stats.yesterdayBookings += 1;
      }

      if (!ACTIVE_BOOKING_STATUSES.has(status)) {
        return;
      }

      if (bookingDate >= ninetyDaysAgo) {
        activeCustomers.add(customerKey);
        if (bookingDate >= thirtyDaysAgo) {
          newCustomers30d.add(customerKey);
        }
      } else if (bookingDate >= prevNinetyStart && bookingDate < ninetyDaysAgo) {
        previousActiveCustomers.add(customerKey);
      }
    });

    stats.activeCustomers = activeCustomers.size;
    stats.previousActiveCustomers = previousActiveCustomers.size;
    stats.newCustomers30d = newCustomers30d.size;

    const approvedReviews = reviews.filter((review) => {
      if (!review) return false;
      if (typeof review.approved === 'boolean') return review.approved;
      if (typeof review.status === 'string') {
        return review.status.toLowerCase() === 'approved';
      }
      return Number.isFinite(Number(review.rating ?? review.score));
    });

    if (approvedReviews.length > 0) {
      const sum = approvedReviews.reduce((acc, review) => {
        const value = Number(review.rating ?? review.score ?? 0);
        return Number.isFinite(value) ? acc + value : acc;
      }, 0);
      stats.ratingCount = approvedReviews.length;
      stats.ratingAverage = stats.ratingCount ? Math.round((sum / stats.ratingCount) * 10) / 10 : 0;
    }

    return stats;
  } catch (err) {
    console.error('computeFallbackDashboardStats failed', err);
    return { ...EMPTY_DASHBOARD_STATS };
  }
};

// Convert Persian/Arabic digits to English digits
const toEn = (s) => (s || '')
  .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
  .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);

// Cache of booked time slots keyed by ISO date
const bookedCache = {};

const toFaDigits = (value) => {
  if (value == null) return '';
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
};

const normalizeKeyPart = (value) => toEn(String(value || '').trim().toLowerCase());

const createBookingKey = (booking) => {
  if (!booking) return '';
  const id = booking._id || booking.id;
  if (id) return `id:${id}`;
  const name = normalizeKeyPart(booking.customerName || booking.name || '');
  const date = normalizeKeyPart(booking.dateISO || booking.date || '');
  const time = normalizeKeyPart(booking.time || booking.startTime || '');
  if (!name && !date && !time) return '';
  return `fallback:${name}|${date}|${time}`;
};

const collectBookingKeys = (list) => {
  const set = new Set();
  if (!list) return set;
  const source = Array.isArray(list)
    ? list
    : (list instanceof Set ? Array.from(list) : []);
  source.forEach((item) => {
    if (!item) return;
    if (typeof item === 'string') {
      set.add(item);
      return;
    }
    const key = createBookingKey(item);
    if (key) set.add(key);
  });
  return set;
};

const API = {
  async _json(res) {
    const txt = await res.text();
    if (!txt) return null;
    try { return JSON.parse(txt); } catch { return null; }
  },

  _unwrap(res) {
    const o = res || {};
    if (Array.isArray(o)) return o;
    // Allow different backend response shapes (items, data, bookings, etc.)
    // so that newer booking endpoints returning `{ bookings: [...] }`
    // are parsed correctly.
    return o.items || o.data || o.services || o.service || o.bookings || [];
  },

  // فقط دریافت خدمات فروشنده‌ی لاگین‌شده
  async getServices() {
    const r = await fetch(bust(`${API_BASE}/api/seller-services/me/services`), {
      credentials: 'include', // مهم: برای ارسال کوکی/توکن
      ...NO_CACHE
    });
    if (!r.ok && r.status !== 304) throw new Error('FETCH_SERVICES_FAILED');
    const raw = this._unwrap(await this._json(r));
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map(s => ({
      id:    s._id || s.id,
      title: s.title,
      price: s.price,
      image: s.image || ''
    }));
  },

  async getComplimentaryPlan() {
    const url = bust(`${API_BASE}/api/service-shops/my/complimentary-plan`);
    const res = await fetch(url, { credentials: 'include', ...NO_CACHE });
    if (res.status === 404) return null;
    if (res.status === 403) {
      console.info('Complimentary plan endpoint forbidden; treating as no complimentary plan');
      return null;
    }
    if (res.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (!res.ok) {
      throw new Error(`COMPLIMENTARY_PLAN_HTTP_${res.status}`);
    }
    return await this._json(res);
  },

  async getServicePlans() {
    const res = await fetch(bust(`${API_BASE}/api/service-plans`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (!res.ok) {
      throw new Error(`SERVICE_PLANS_HTTP_${res.status}`);
    }
    const data = await this._json(res);
    if (Array.isArray(data?.plans)) {
      return data.plans;
    }
    const fallback = this._unwrap(data);
    return Array.isArray(fallback) ? fallback : [];
  },

  async validatePlanDiscountCode(payload = {}) {
    const body = {
      code: payload.code,
      planKey: payload.planKey || null
    };
    const res = await fetch(bust(`${API_BASE}/api/service-plans/discount-codes/validate`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await this._json(res);
    if (!res.ok) {
      const message = data?.message || 'کد تخفیف نامعتبر است.';
      throw new Error(message);
    }
    return data?.discountCode || null;
  },

  async redeemPlanDiscountCode(code, payload = {}) {
    if (!code) throw new Error('کد تخفیف نامعتبر است.');
    const res = await fetch(bust(`${API_BASE}/api/service-plans/discount-codes/${encodeURIComponent(code)}/redeem`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: payload.planId || null })
    });
    const data = await this._json(res);
    if (!res.ok) {
      const message = data?.message || 'ثبت استفاده از کد تخفیف با خطا مواجه شد.';
      throw new Error(message);
    }
    return data?.discountCode || null;
  },

  async getFeatureFlags() {
    try {
      const res = await fetch(bust(`${API_BASE}/api/settings/public/feature-flags`), {
        credentials: 'include',
        ...NO_CACHE
      });
      if (!res.ok) {
        throw new Error(`FEATURE_FLAGS_HTTP_${res.status}`);
      }
      const data = await this._json(res);
      return data?.flags || {};
    } catch (err) {
      console.warn('API.getFeatureFlags failed', err);
      throw err;
    }
  },

  async getTopPeers(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit);
    if (options.scope) params.set('scope', options.scope);
    const query = params.toString();
    const url = bust(`${API_BASE}/api/sellers/top-peers${query ? `?${query}` : ''}`);
    const res = await fetch(url, { credentials: 'include', ...NO_CACHE });
    if (res.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (res.status === 403) {
      console.info('Top peers endpoint forbidden; returning fallback data');
      return {
        top: [],
        mine: null,
        total: 0,
        category: '',
        scope: options.scope || 'category',
        updatedAt: null,
        isRestricted: true
      };
    }
    if (!res.ok) {
      throw new Error(`TOP_PEERS_HTTP_${res.status}`);
    }
    const data = await this._json(res);
    const total = Number(data?.total);

    return {
      top: Array.isArray(data?.top) ? data.top : [],
      mine: data?.mine || null,
      total: Number.isFinite(total) ? total : 0,
      category: data?.category || '',
      scope: data?.scope || 'category',
      updatedAt: data?.updatedAt || null
    };
  },

  // ایجاد خدمت جدید
// ایجاد خدمت جدید
async createService(payload) {
  console.log('Sending service data to server:', payload); // Debug log
  
  const r = await fetch(`${API_BASE}/api/seller-services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  
  if (!r.ok) {
    // Get more detailed error information
    let errorMessage = 'CREATE_SERVICE_FAILED';
    try {
      const errorData = await r.json();
      console.error('Server error details:', errorData);
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch (e) {
      console.error('Failed to parse error response:', e);
    }
    throw new Error(errorMessage);
  }
  
  const data = this._unwrap(await this._json(r));
  return {
    id:    data._id || data.id,
    title: data.title,
    price: data.price,
    image: data.image || ''
  };
},

  // ویرایش خدمت
  async updateService({ id, ...payload }) {
    const r = await fetch(`${API_BASE}/api/seller-services/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('UPDATE_SERVICE_FAILED');
    const data = this._unwrap(await this._json(r));
    return {
      id:    data._id || data.id || id,
      title: data.title,
      price: data.price,
      image: data.image || payload.image || ''
    };
  },

  // حذف خدمت
  async deleteService(id) {
    const r = await fetch(`${API_BASE}/api/seller-services/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!r.ok) throw new Error('DELETE_SERVICE_FAILED');
    return true;
  },

  // Bookings API methods
  async getBookings() {
    console.log('Fetching bookings from:', `${API_BASE}/api/seller-bookings/me`);
    
    const url = bust(`${API_BASE}/api/seller-bookings/me`);
    console.log('Full URL with cache busting:', url);
    
    const r = await fetch(url, {
      credentials: 'include',
      ...NO_CACHE
    });
    
    console.log('Bookings API response status:', r.status);
    console.log('Bookings API response headers:', [...r.headers.entries()]);
    
    if (r.status === 401) {
      console.error('Unauthorized access to bookings API');
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    
    if (r.status === 403) {
      console.warn('Bookings API access returned 403; continuing with empty list.');
      return [];
    }

    if (!r.ok && r.status !== 304) {
      console.error('Failed to fetch bookings, status:', r.status);
      throw { status: r.status, message: 'FETCH_BOOKINGS_FAILED' };
    }
    
    const raw = this._unwrap(await this._json(r));
    console.log('Raw bookings response:', raw);
    
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map(b => {
      const rawDate = b.dateISO || b.bookingDate || b.date || '';
      const dateStr = toEn((rawDate || '').split(' ')[0]).replace(/\//g, '-');
      const dateISO = dateStr.split('T')[0];
      const time = normalizeTime(toEn(b.startTime || b.time || '')) || '';
      return {
        id: b._id || b.id,
        customerId: b.customerId || b.userId || '',
        customerName: b.customerName || '',
        service: b.service || '',
        date: dateISO,
        dateISO,
        time,
        customerPhone: b.customerPhone || '',
        status: b.status || 'pending',
        cancelledBy: b.cancelledBy || b.canceledBy
      };
    });
  },

  async getDashboardStats() {
    const url = bust(`${API_BASE}/api/sellers/dashboard/stats`);
    try {
      const r = await fetch(url, {
        credentials: 'include',
        ...NO_CACHE
      });

      if (r.status === 401) {
        throw { status: 401, message: 'UNAUTHORIZED' };
      }

      if (!r.ok && r.status !== 304) {
        console.warn('Dashboard stats endpoint unavailable, falling back to local data', r.status);
        return computeFallbackDashboardStats();
      }

      const parsed = await this._json(r);
      if (!parsed || typeof parsed !== 'object') {
        return computeFallbackDashboardStats();
      }
      return parsed;
    } catch (err) {
      if (err?.status === 401) {
        throw err;
      }
      console.error('getDashboardStats failed, using fallback data', err);
      return computeFallbackDashboardStats();
    }
  },

  async getMonthlyBookingInsights() {
    const url = bust(`${API_BASE}/api/sellers/dashboard/bookings/monthly`);
    const r = await fetch(url, {
      credentials: 'include',
      ...NO_CACHE
    });
    if (r.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (!r.ok && r.status !== 304) {
      throw new Error('FETCH_MONTHLY_BOOKING_INSIGHTS_FAILED');
    }
    const parsed = await this._json(r);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('INVALID_MONTHLY_BOOKING_INSIGHTS');
    }
    return parsed;
  },

  // Portfolio API methods
  async getPortfolio() {
    const r = await fetch(bust(`${API_BASE}/api/seller-portfolio/me`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (!r.ok && r.status !== 304) throw new Error('FETCH_PORTFOLIO_FAILED');
    const data = await this._json(r);
    const items = data.items || data.data || data || [];
    return Array.isArray(items) ? items : [];
  },

  async createPortfolioItem(payload) {
    console.log('Creating portfolio item:', payload);
    const r = await fetch(`${API_BASE}/api/seller-portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      let errorMessage = 'CREATE_PORTFOLIO_FAILED';
      try {
        const errorData = await r.json();
        console.error('Portfolio create error:', errorData);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        console.error('Failed to parse error response:', e);
      }
      throw new Error(errorMessage);
    }
    const data = await this._json(r);
    return data.item || data;
  },

  async updatePortfolioItem(id, payload) {
    const r = await fetch(`${API_BASE}/api/seller-portfolio/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('UPDATE_PORTFOLIO_FAILED');
    const data = await this._json(r);
    return data.item || data;
  },

async deletePortfolioItem(id) {
        if (!confirm('آیا از حذف این نمونه‌کار مطمئن هستید؟')) return;

        const before = StorageManager.get('vit_portfolio') || [];
        const item = before.find(p => p.id === id);
        const dbId = item?._id || item?.id;
        const after = before.filter(p => p.id !== id && p._id !== dbId);

        // Optimistic update
        StorageManager.set('vit_portfolio', after);
        this.renderPortfolioList();

        try {
            if (!API || typeof API.deletePortfolioItem !== 'function') {
                throw new Error('API adapter missing');
            }
            await API.deletePortfolioItem(dbId);
            UIComponents.showToast('نمونه‌کار حذف شد.', 'success');
        } catch (err) {
            console.error('deletePortfolioItem failed', err);
            // Rollback on error
            StorageManager.set('vit_portfolio', before);
            this.renderPortfolioList();
            UIComponents.showToast('حذف در سرور انجام نشد؛ تغییرات برگشت داده شد.', 'error');
        }
    },


  // Notifications API methods
  async getNotifications() {
    const r = await fetch(bust(`${API_BASE}/api/notifications`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (!r.ok && r.status !== 304) throw new Error('FETCH_NOTIFICATIONS_FAILED');
    const raw = this._unwrap(await this._json(r));
    const arr = Array.isArray(raw) ? raw : [];
    const fmt = (d) => {
      const diff = (Date.now() - new Date(d).getTime()) / 1000;
      if (diff < 3600) return `${Math.floor(diff/60)} دقیقه پیش`;
      if (diff < 86400) return `${Math.floor(diff/3600)} ساعت پیش`;
      return `${Math.floor(diff/86400)} روز پیش`;
    };
    return arr.map(n => ({
      id: n._id || n.id,
      text: n.message || '',
      time: n.createdAt ? fmt(n.createdAt) : '',
      read: !!n.read
    }));
  },

  async markNotificationRead(id) {
    const r = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: 'PUT',
      credentials: 'include'
    });
    if (!r.ok) throw new Error('MARK_NOTIFICATION_READ_FAILED');
    return true;
  },

  async deleteNotification(id) {
    const r = await fetch(`${API_BASE}/api/notifications/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!r.ok) throw new Error('DELETE_NOTIFICATION_FAILED');
    return true;
  }


};

// === END STEP 1 ===

async function fetchInitialData() {
  try {
    console.log('Starting fetchInitialData...');
    
    console.log('Making parallel API requests...');

    const bookingsPromise = API.getBookings();

    const [sellerRes, servicesRes] = await Promise.all([
      fetch(bust(`${API_BASE}/api/sellers/me`), { credentials: 'include', ...NO_CACHE }),
      fetch(bust(`${API_BASE}/api/seller-services/me/services`), { credentials: 'include', ...NO_CACHE })
    ]);

    let bookings = [];
    let bookingsError = null;
    try {
      bookings = await bookingsPromise;
      console.log('Bookings fetched successfully:', bookings);
    } catch (err) {
      bookingsError = err;
      console.error('Bookings promise rejected:', err);
    }

    const bookingsLength = Array.isArray(bookings) ? bookings.length : 0;

    console.log('API responses received:', {
      sellerResStatus: sellerRes.status,
      servicesResStatus: servicesRes.status,
      bookingsStatus: bookingsError ? 'error' : 'ok',
      bookingsLength
    });

    if (bookingsError?.status === 401) {
      console.error('Unauthorized bookings access - redirecting to login');
      throw bookingsError;
    }

    if (sellerRes.status === 401 || servicesRes.status === 401) {
      console.log('Authentication failed - redirecting to login');
      window.location.href = 'login.html';
      return;
    }

    if (sellerRes.status === 403) {
      console.warn('Seller info request returned 403; falling back to local data.');
    }

    if (servicesRes.status === 403) {
      console.warn('Service list request returned 403; falling back to cached services.');
    }

    if (bookingsError) {
      console.error('FETCH_BOOKINGS_FAILED', bookingsError);
      bookings = [];
    }

    const localBookings = JSON.parse(localStorage.getItem('vitreenet-bookings') || '[]');
    const previousBookingKeys = collectBookingKeys(localBookings);
    console.log('Local bookings count:', localBookings.length);

    // Enhanced booking data handling with better error logging
    const serverBookings = Array.isArray(bookings) ? bookings : [];

    if (serverBookings.length) {
      console.log('Successfully fetched bookings from server:', serverBookings);
      const statusMap = new Map(localBookings.map(b => [(b._id || b.id), b.status]));
      MOCK_DATA.bookings = serverBookings.map(b => {
        const id = b._id || b.id;
        const serverStatus = b.status || 'pending';
        const localStatus = statusMap.get(id);
        const status = serverStatus === 'cancelled' ? 'cancelled' : (localStatus || serverStatus);
        const cancelledBy = b.cancelledBy || (serverStatus === 'cancelled' && localStatus !== 'cancelled' ? 'customer' : undefined);
        if (cancelledBy === 'customer') {
          UIComponents?.showToast?.(`رزرو ${b.customerName || ''} توسط مشتری لغو شد`, 'error');
        }
        return {
          ...b,
          date: b.bookingDate || b.date || '',
          dateISO: b.dateISO || b.bookingDate || b.date || '',
          status,
          cancelledBy
        };
      });
      console.log('MOCK_DATA.bookings after server data:', MOCK_DATA.bookings);
    } else if (localBookings.length) {
      console.log('Using local bookings as fallback:', localBookings);
      MOCK_DATA.bookings = localBookings.map(b => ({
        id: b.id || Date.now() + Math.random(),
        customerName: b.name || b.customerName || '',
        service: b.service || '',
        date: b.date || '',
        dateISO: b.dateISO || '',
        time: b.time || '',
        status: b.status || 'pending'
      }));
      console.log('MOCK_DATA.bookings after local data:', MOCK_DATA.bookings);
    } else {
      console.log('No bookings found from server or local storage');
      MOCK_DATA.bookings = [];
    }

    const currentBookings = Array.isArray(MOCK_DATA.bookings) ? MOCK_DATA.bookings : [];
    const candidateNewBookings = serverBookings.length
      ? currentBookings.filter((b) => {
          const key = createBookingKey(b);
          return key && !previousBookingKeys.has(key);
        })
      : [];

    persistBookings();

    BookingPopup.ensureBaseline(previousBookingKeys);
    BookingPopup.notifyNew(candidateNewBookings);
    BookingPopup.markKnown(currentBookings);
    BookingPopup.hasBaseline = true;

    if (sellerRes.ok) {
      const data = await sellerRes.json();
      const seller = data.seller || data;
        const store = {
          id: seller.id || seller._id,
          storename: seller.storename,
          shopurl: seller.shopurl,
          firstname: seller.firstname || '',
          lastname: seller.lastname || '',
          category: seller.category,
          phone: seller.phone,
          address: seller.address,
          startTime: seller.startTime || '',
          endTime: seller.endTime || ''
        };
      localStorage.setItem('seller', JSON.stringify(store));
      const fullName = `${seller.firstname || ''} ${seller.lastname || ''}`.trim();

      const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
      };
      setText('seller-name', fullName);
      setText('seller-shop-name', seller.storename || '');
      setText('seller-category', seller.category || '');
      setText('seller-phone', seller.phone || '');
      setText('seller-address', seller.address || '');
      // Fill settings form with fetched data
      populateSettingsForm({ ...store, startTime: seller.startTime, endTime: seller.endTime });
    }

    if (servicesRes.ok) {
      const svcJson = await servicesRes.json();
      const svcs = svcJson.items || svcJson.services || (Array.isArray(svcJson) ? svcJson : []);

      const normalizedServices = svcs.map((svc, index) => {
        const fallbackId = `svc-${index}`;
        const normalizedId = svc?.id ?? svc?._id ?? svc?.serviceId ?? fallbackId;
        const rawPrice = typeof svc?.price === 'string'
          ? Number(svc.price.replace(/[^\d.-]/g, ''))
          : svc?.price;
        const normalizedPrice = Number.isFinite(rawPrice) ? rawPrice : 0;
        const primaryImage = svc?.image || (Array.isArray(svc?.images) ? svc.images[0] : '');

        return {
          ...svc,
          id: normalizedId,
          price: normalizedPrice,
          image: primaryImage
        };
      });

      StorageManager.set('vit_services', normalizedServices);

      const listEl = document.getElementById('services-list');
      if (listEl) {
        listEl.innerHTML = normalizedServices.map(s => `
          <div class="item-card" data-id="${s.id}">
            <div class="item-card-header">
              <h4 class="item-title">${s.title}</h4>
            </div>
            <div class="item-details"><span>قیمت: ${s.price}</span></div>
          </div>
        `).join('');
      }
    }

  } catch (err) {
    if (err && err.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    console.error('Error loading initial data', err);

    // Fallback seller info when API is unreachable
      const defaultSeller = {
        id: 1,
        storename: 'فروشگاه آزمایشی',
        shopurl: '',
        firstname: 'فروشنده',
        lastname: '',
        category: 'سرویس',
        phone: '۰۹۱۲۳۴۵۶۷۸۹',
        address: 'آدرس نامشخص',
        startTime: '09:00',
        endTime: '18:00'
      };
    const storedSeller = JSON.parse(localStorage.getItem('seller') || 'null') || defaultSeller;
    localStorage.setItem('seller', JSON.stringify(storedSeller));

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    setText('seller-name', 'فروشنده عزیز');
    setText('seller-shop-name', storedSeller.storename || '');
    setText('seller-category', storedSeller.category || '');
    setText('seller-phone', storedSeller.phone || '');
    setText('seller-address', storedSeller.address || '');

    // Ensure settings form uses the same fallback data
    populateSettingsForm(storedSeller);

    if (typeof UIComponents !== 'undefined' && UIComponents.showToast) {
      UIComponents.showToast('اتصال به سرور برقرار نشد؛ دادهٔ محلی نمایش داده شد.', 'error');
    }
  }
}





  /**
   * ==============================
   * Mock Data
   * ==============================
  */
  const MOCK_DATA = {
    recentActivity: [],
    bookings: [],
    customers: [],
    reviews: []
  };

window.MOCK_DATA = MOCK_DATA;

function buildSampleCustomers() {
  const baseDate = new Date();
  const daysAgo = (d) => {
    const copy = new Date(baseDate);
    copy.setDate(copy.getDate() - d);
    return copy.toISOString();
  };

  return [
    { id: 'c-101', name: 'امیر محمدی', phone: '۰۹۱۲۳۴۵۶۷۸۹', bookingsCount: 12, reviewCount: 4, joinedAt: daysAgo(320), lastReservation: daysAgo(3) },
    { id: 'c-102', name: 'نسترن حیدری', phone: '۰۹۳۵۴۳۲۱۵۴۵', bookingsCount: 7, reviewCount: 2, joinedAt: daysAgo(45), lastReservation: daysAgo(9), vipCurrent: 2 },
    { id: 'c-103', name: 'حسین مرادی', phone: '۰۹۱۳۳۳۳۳۳۳۳', bookingsCount: 3, reviewCount: 1, joinedAt: daysAgo(18), lastReservation: daysAgo(2) },
    { id: 'c-104', name: 'شیما مقدم', phone: '۰۹۱۲۴۴۴۴۳۳۳', bookingsCount: 15, reviewCount: 6, joinedAt: daysAgo(600), lastReservation: daysAgo(40), rewardCount: 3 },
    { id: 'c-105', name: 'سینا احدی', phone: '۰۹۰۱۱۲۲۲۳۳۴', bookingsCount: 1, reviewCount: 0, joinedAt: daysAgo(10), lastReservation: daysAgo(8) },
    { id: 'c-106', name: 'الهام کاظمی', phone: '۰۹۱۹۸۷۶۵۴۳۲', bookingsCount: 9, reviewCount: 5, joinedAt: daysAgo(120), lastReservation: daysAgo(14) }
  ];
}

// دریافت مشتریان واقعی فروشنده
async function loadCustomers() {
  const applyCustomers = (list) => {
    MOCK_DATA.customers = list;
    window.customersData = list.map(c => ({
      id: c.id,
      name: c.name,
      vipCurrent: c.vipCurrent,
      rewardCount: c.reviewCount ?? c.rewardCount,
      lastReservationAt: c.lastReservation,
      joinedAt: c.joinedAt,
      bookingsCount: c.bookingsCount,
      reviewCount: c.reviewCount
    }));

    if (typeof app !== 'undefined' && app.renderCustomers) {
      app.renderCustomers();
    }

    if (typeof app !== 'undefined' && app.refreshDiscountCustomers) {
      app.refreshDiscountCustomers();
      app.renderDiscounts?.();
    }

    document.dispatchEvent(new CustomEvent('customers:loaded', { detail: list }));
    document.dispatchEvent(new Event('vip:refresh'));
  };

  try {
    const res = await fetch(`${API_BASE}/api/loyalty/customers`, { credentials: 'include' });
    const data = res.ok ? await res.json() : [];

    let mapped = data.map(c => {
      const bookingsCount = Number(c.totalBookings ?? c.bookingsCount ?? c.completedBookings ?? 0);
      const reviewCount = Number(c.reviewCount ?? c.feedbackCount ?? c.reviews ?? c.rewardCount ?? 0);
      const joinedAt = c.joinedAt || c.memberSince || c.createdAt || c.lastReservation || new Date().toISOString();

      return {
      id: String(c.id || c.userId || c._id),
      name: c.name || '-',
      phone: c.phone || '-',
      lastReservation: c.lastReservation || c.lastReservationAt || '',
      joinedAt,
      bookingsCount,
      reviewCount,
      vipCurrent: c.completed || 0,
      rewardCount: c.claimed || 0
      };
    });

    if (!mapped.length) {
      mapped = buildSampleCustomers();
    }

    applyCustomers(mapped);
  } catch (err) {
    console.error('loadCustomers', err);
    applyCustomers(buildSampleCustomers());
  }
}


  /**
   * ==============================
   * Storage Manager
   * ==============================
   */
  class StorageManager {
    static get(key) {
      try {
        const lsItem = localStorage.getItem(key);
        if (lsItem !== null) return JSON.parse(lsItem);
        return SafeSS.getJSON(key, null); // SafeSS
      } catch (e) {
        console.error("Error getting from storage", e);
        return null;
      }
    }
    static set(key, value) {
      const data = JSON.stringify(value);
      try {
        localStorage.setItem(key, data);
      } catch (e) {
        if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
          console.warn('localStorage quota exceeded, using sessionStorage instead');
          SafeSS.setJSON(key, value); // SafeSS
        } else {
          console.error("Error setting to localStorage", e);
        }
      }
    }
  }

  // Persist current booking list to localStorage
  function persistBookings() {
    try {
      StorageManager.set('vitreenet-bookings', MOCK_DATA.bookings);
    } catch (e) {
      console.error('Error persisting bookings', e);
    }
  }



// === Customer Preferences Store (keyed by normalized customer name) ===
const normalizeKey = (s) => (s || '').toString().trim().toLowerCase();

const CustomerPrefs = {
  _KEY: 'vit_customer_prefs',
  load() { return StorageManager.get(this._KEY) || {}; },
  save(data) { StorageManager.set(this._KEY, data); },
  getByName(name) {
    const all = this.load();
    return all[normalizeKey(name)] || { autoAccept: false, blocked: false };
  },
  setByName(name, patch) {
    const k = normalizeKey(name);
    const all = this.load();
    all[k] = { ...(all[k] || { autoAccept: false, blocked: false }), ...patch };
    this.save(all);
  }
};

class DiscountStore {
  constructor(key = 'vit_seller_discounts') {
    this._KEY = key;
  }

  load() { return StorageManager.get(this._KEY) || []; }
  save(list) { StorageManager.set(this._KEY, list); }

  purgeExpired(now = new Date()) {
    const active = this.load().filter(item => new Date(item.expiresAt) > now);
    this.save(active);
    return active;
  }

  getActive(now = new Date()) {
    return this.purgeExpired(now).sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));
  }

  upsert(discount) {
    const items = this.getActive().filter(d => d.id !== discount.id && d.customerId !== discount.customerId);
    items.push(discount);
    this.save(items);
  }

  remove(id) {
    const filtered = this.load().filter(item => item.id !== id);
    this.save(filtered);
    return filtered;
  }
}



// (اختیاری اما مفید): استفاده در فرانت رزرو سمت کاربر
window.VitreenetRules = {
  isBlockedByName: (name) => !!CustomerPrefs.getByName(name).blocked,
  shouldAutoAcceptByName: (name) => !!CustomerPrefs.getByName(name).autoAccept
};




  /**
   * ==============================
   * State Manager
   * ==============================
   */
  const StateManager = {
    currentTheme: 'dark',
    currentRoute: '',
    isModalOpen: false,
    focusedElementBeforeModal: null,
  };
  /**
   * ==============================
   * UI Components & Helpers
   * ==============================
   */
class UIComponents {
  static formatPersianNumber(num) {
    if (typeof num !== 'number') return num;
    return new Intl.NumberFormat('fa-IR').format(num);
  }

  static formatPersianDate() {
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    return new Intl.DateTimeFormat('fa-IR-u-nu-latn', options).format(new Date());
  }

  // ⬇️ متد جدید: خروجی به فرم «شنبه ۲۳ شهریور»
static formatPersianDayMonth(dateInput) {
  if (!dateInput) return '';

  // ارقام فارسی/لاتین + ابزارهای کمکی
  const fa = '۰۱۲۳۴۵۶۷۸۹', en = '0123456789';
  const toEn = (s) => (s + '').replace(/[۰-۹]/g, d => en[fa.indexOf(d)]);
  const toFa = (s) => (s + '').replace(/[0-9]/g, d => fa[d]);
  const pad2 = (n) => String(n).padStart(2, '0');
  const faMonths = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

  let d = null;

  if (dateInput instanceof Date) {
    d = dateInput;
  } else {
    const s = toEn(String(dateInput).trim());

    // حالت ISO یا با زمان: 2025-09-02 یا 2025-09-02T10:00
    if (/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(s)) {
      d = new Date(s);
    } else {
      // yyyy/mm/dd یا yyyy-mm-dd یا yyyy.mm.dd
      const m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
      if (m) {
        const y = +m[1], mo = +m[2], da = +m[3];

        // اگر میلادی بود، مستقیم تاریخ بساز
        if (y >= 1700) {
          d = new Date(`${y}-${pad2(mo)}-${pad2(da)}`);
        } else if (y >= 1200 && y < 1700 && faMonths[mo - 1]) {
          // اگر جلالیِ متنی بود و کتابخانه‌ای برای تبدیل نداریم،
          // حداقل «روز + نام ماه» را برگردان (بدون نام روز هفته)
          return `${toFa(String(da))} ${faMonths[mo - 1]}`;
        }
      }
    }
  }

  // اگر نتونستیم Date معتبر بسازیم، ورودی را با ارقام فارسی برگردان
  if (!d || isNaN(d.getTime())) return toFa(String(dateInput));

  // خروجی استاندارد: «شنبه ۲۳ شهریور»
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(d);
}

static formatRelativeDate(dateStr) {
  if (!dateStr) return '';

  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const latinDigits = '0123456789';
  const toEnglish = (s) => s.replace(/[۰-۹]/g, (d) => latinDigits[persianDigits.indexOf(d)]);
  const toPersian = (s) => s.replace(/[0-9]/g, (d) => persianDigits[d]);
  const pad2 = (n) => String(n).padStart(2, '0');

  const normalizeInput = typeof dateStr === 'string' ? toEnglish(dateStr.trim()) : dateStr;

  let parsedDate;
  if (normalizeInput instanceof Date) {
    parsedDate = normalizeInput;
  } else if (typeof normalizeInput === 'number') {
    parsedDate = new Date(normalizeInput);
  } else {
    const candidate = String(normalizeInput || '');
    if (/^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/.test(candidate)) {
      // Normalize separators for reliable parsing
      parsedDate = new Date(candidate.replace(/-/g, '/'));
    } else {
      parsedDate = new Date(candidate);
    }
  }

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    const match = String(normalizeInput || '').match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (match) {
      const [, y, m, d] = match;
      return toPersian(`${y}/${pad2(m)}/${pad2(d)}`);
    }
    return toPersian(String(dateStr));
  }

  const tehranDayParts = (d) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  const startOfTehranDay = (d) => {
    const parts = tehranDayParts(d);
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  };

  const today = startOfTehranDay(new Date());
  const target = startOfTehranDay(parsedDate);
  const diffDays = Math.round((target - today) / 86400000);

  if (diffDays === 0) return 'امروز';
  if (diffDays === -1) return 'دیروز';
  if (diffDays === 1) return 'فردا';

  const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return toPersian(formatter.format(parsedDate));
}

static animateCountUp(el) {
  if (!el || !el.dataset || el.dataset.value == null) return;

  const raw = String(el.dataset.value);
  const isDecimal = raw.includes('.');
  const target = isDecimal ? parseFloat(raw) : parseInt(raw, 10);
  if (!Number.isFinite(target)) return;

  let frame = 0;
  const duration = 50; // frames
  const step = target / duration;

  function counter() {
    frame++;
    const current = step * frame;

    if (isDecimal) {
      const val = Math.min(current, target);
      el.textContent = UIComponents.formatPersianNumber(parseFloat(val.toFixed(1)));
    } else {
      el.textContent = UIComponents.formatPersianNumber(Math.min(Math.ceil(current), target));
    }

    if (frame < duration) {
      requestAnimationFrame(counter);
    } else {
      el.textContent = UIComponents.formatPersianNumber(target);
    }
  }

  requestAnimationFrame(counter);
}

static showToast(message, type = 'info', duration = 4000) {
  const toastRoot = document.getElementById('toast-root');
  if (!toastRoot) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
  toast.style.animation = `slideInUp 0.4s ease forwards, fadeOut 0.4s ease ${duration - 400}ms forwards`;
  toastRoot.appendChild(toast);
  setTimeout(() => { toast.remove(); }, duration);
}

// Modal & Drawer Logic
static _handleOverlay(overlay, trigger, isOpen) {
  const body = document.body;
  const mainContent = document.getElementById('app');
  if (isOpen) {
    StateManager.isModalOpen = true;
    StateManager.focusedElementBeforeModal = document.activeElement;
    overlay.classList.add('is-open');
    body.classList.add('has-overlay');
    mainContent.setAttribute('aria-hidden', 'true');
    const focusableElements = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    overlay.addEventListener('keydown', (e) => this._trapFocus(e, firstFocusable, lastFocusable));
    if (firstFocusable) firstFocusable.focus();
  } else {
    StateManager.isModalOpen = false;
    overlay.classList.remove('is-open');
    body.classList.remove('has-overlay');
    mainContent.removeAttribute('aria-hidden');
    if (StateManager.focusedElementBeforeModal) {
      StateManager.focusedElementBeforeModal.focus();
    }
  }
}

static _trapFocus(e, firstFocusable, lastFocusable) {
  if (e.key !== 'Tab') return;
  if (e.shiftKey) { /* shift + tab */
    if (document.activeElement === firstFocusable) {
      lastFocusable.focus();
      e.preventDefault();
    }
  } else { /* tab */
    if (document.activeElement === lastFocusable) {
      firstFocusable.focus();
      e.preventDefault();
    }
  }
}

static openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.hidden = false;
  this._handleOverlay(modal, null, true);
}

static closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.hidden = true;
  this._handleOverlay(modal, null, false);
}

static openDrawer(drawerId) {
  const drawer = document.getElementById(drawerId);
  if (!drawer) return;
  drawer.hidden = false;
  this._handleOverlay(drawer, null, true);
}

static closeDrawer(drawerId) {
  const drawer = document.getElementById(drawerId);
  if (!drawer) return;
  drawer.hidden = true;
  this._handleOverlay(drawer, null, false);
}
}





  /* === STEP — Notifications (پنل اعلان‌ها) === */
const Notifications = {
  _KEY: 'vit_notifications',
  _els: {},

  load() { return StorageManager.get(this._KEY) || []; },
  save(list) { StorageManager.set(this._KEY, list); },

  async fetchFromServer() {
    try {
      const items = await API.getNotifications();
      this.save(items);
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  },

  async init() {
    this._els = {
      btn: document.getElementById('notification-btn'),
      panel: document.getElementById('notification-panel'),
      list: document.getElementById('notification-list'),
      badge: document.getElementById('notification-badge'),
      clearAll: document.getElementById('notif-clear-all'),
      empty: document.getElementById('notif-empty'),
      markRead: document.getElementById('notif-mark-read')
    };
    if (!this._els.btn || !this._els.panel) return;

    // آماده‌سازی اولیه
    await this.fetchFromServer();
    this.render();

    // باز/بستن پنل
    this._els.btn.addEventListener('click', () => this.toggle());
    document.addEventListener('click', (e) => {
      const insidePanel = e.target.closest('#notification-panel');
      const onButton = e.target.closest('#notification-btn');
      if (!insidePanel && !onButton) this.close();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });

    // اکشن‌ها
    this._els.clearAll?.addEventListener('click', async () => {
      const items = this.load();
      await Promise.all(items.map(n => API.deleteNotification(n.id).catch(() => {})));
      this.save([]);
      this.render();
      UIComponents.showToast('همه اعلان‌ها حذف شد.', 'info');
    });

    this._els.markRead?.addEventListener('click', async () => {
      const items = this.load();
      await Promise.all(items.filter(n => !n.read).map(n => API.markNotificationRead(n.id).catch(() => {})));
      const all = items.map(n => ({ ...n, read: true }));
      this.save(all);
      this.render();
      UIComponents.showToast('همه اعلان‌ها خوانده شد.', 'success');
    });

    // دلیگیشن برای آیتم‌ها (حذف/خواندن)
    this._els.list?.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      if (e.target.closest('.notif-delete')) {
        this.remove(li.dataset.id);
      } else if (e.target.closest('.notif-view-more')) {
        const btn = e.target.closest('.notif-view-more');
        const fullText = btn?.dataset?.fulltext || '';
        this.showFullComment(fullText);
        this.markRead(li.dataset.id);
      } else {
        this.markRead(li.dataset.id);
      }
    });
  },

  open() {
    this._els.panel.hidden = false;
    this._els.panel.classList.add('active');
    this._els.btn.setAttribute('aria-expanded', 'true');
  },
  close() {
    this._els.panel.classList.remove('active');
    this._els.panel.hidden = true;
    this._els.btn.setAttribute('aria-expanded', 'false');
  },
  toggle(){
    this._els.panel.classList.contains('active') ? this.close() : this.open();
  },

  async remove(id) {
    try { await API.deleteNotification(id); } catch (e) {}
    const items = this.load().filter(n => n.id !== id);
    this.save(items);
    this.render();
  },

  async markRead(id) {
    try { await API.markNotificationRead(id); } catch (e) {}
    const items = this.load().map(n => n.id === id ? ({ ...n, read: true }) : n);
    this.save(items);
    this.render();
  },

  add(payload, fallbackType = 'info') {
    const items = this.load();
    const nowLabel = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const normalized = typeof payload === 'string'
      ? { text: payload, type: fallbackType }
      : payload || {};

    items.unshift({
      id: 'n' + Date.now(),
      type: normalized.type || fallbackType,
      text: normalized.text || '—',
      title: normalized.title || '',
      time: normalized.time || nowLabel,
      read: false
    });
    this.save(items.slice(0, 30));
    this.render();
  },

  render() {
    const items = this.load();
    const unread = items.filter(n => !n.read).length;
    const LONG_BODY_LIMIT = 90;

    // badge
    if (this._els.badge) {
      if (unread > 0) {
        this._els.badge.textContent = unread > 99 ? '99+' : unread.toString();
        this._els.badge.dataset.count = unread > 99 ? 'max' : unread > 9 ? 'high' : 'normal';
        this._els.badge.hidden = false;
      } else {
        this._els.badge.textContent = '';
        this._els.badge.hidden = true;
        delete this._els.badge.dataset.count;
      }
    }

    if (this._els.btn) {
      this._els.btn.classList.toggle('has-unread', unread > 0);
    }

    // لیست / حالت خالی
    if (!this._els.list) return;
    if (items.length === 0) {
      this._els.list.innerHTML = '';
      this._els.empty?.removeAttribute('hidden');
      return;
    }
    this._els.empty?.setAttribute('hidden', '');

    this._els.list.innerHTML = items.map(n => {
      const { label, body } = this._splitMessage(n.text);
      const fullBody = body || n.text;
      const isLong = (fullBody || '').length > LONG_BODY_LIMIT;
      const previewText = isLong ? `${fullBody.slice(0, LONG_BODY_LIMIT)}…` : fullBody;
      const safePreview = this._escapeHtml(previewText);
      const safeFull = this._escapeHtml(fullBody);

      return `
      <li class="notification-item ${n.read ? 'is-read' : 'is-unread'}" data-id="${n.id}" role="listitem" tabindex="0">
        <div class="notif-row">
          <div class="notif-icon ${n.type || 'info'}" aria-hidden="true"></div>
          <div class="notif-content">
            <div class="notif-text">
              ${label ? `<span class="notif-label">${label}</span>` : ''}
              ${n.title ? `<strong class="notif-title">${n.title}</strong>` : ''}
              <span class="notif-body">${safePreview}</span>
              ${isLong ? `<button class="notif-view-more" data-fulltext="${safeFull}" aria-label="نمایش کامل نظر">مشاهده</button>` : ''}
            </div>
            <time class="notif-time">${n.time || ''}</time>
          </div>
          <button class="notif-delete" aria-label="حذف اعلان">×</button>
        </div>
      </li>
    `;
    }).join('');
  }
};

// Helpers for notification presentation
Notifications._splitMessage = function(text = '') {
  const normalized = text.trim();
  if (!normalized) return { label: '', body: '' };

  const LABEL_KEY = 'نظر یا کامنت';
  if (!normalized.startsWith(LABEL_KEY)) {
    return { label: '', body: normalized };
  }

  const body = normalized.slice(LABEL_KEY.length).trim();
  return {
    label: LABEL_KEY,
    body: body || normalized
  };
};

Notifications._escapeHtml = function(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

Notifications.showFullComment = function(text = '') {
  if (!text) return;

  if (!this._els.fullView) {
    const overlay = document.createElement('div');
    overlay.className = 'notif-view-overlay';
    overlay.innerHTML = `
      <div class="notif-view-modal" role="dialog" aria-modal="true" aria-label="نمایش کامل نظر">
        <div class="notif-view-header">
          <span>متن کامل نظر</span>
          <button type="button" class="notif-view-close" aria-label="بستن">×</button>
        </div>
        <div class="notif-view-body"></div>
        <div class="notif-view-footer">
          <button type="button" class="notif-view-close btn-close">بستن</button>
        </div>
      </div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target.classList.contains('notif-view-overlay') || e.target.closest('.notif-view-close')) {
        overlay.classList.remove('active');
        overlay.setAttribute('hidden', '');
      }
    });
    overlay.setAttribute('hidden', '');
    this._els.panel.appendChild(overlay);
    this._els.fullView = overlay;
  }

  const bodyEl = this._els.fullView.querySelector('.notif-view-body');
  if (bodyEl) {
    bodyEl.textContent = text;
  }
  this._els.fullView.removeAttribute('hidden');
  requestAnimationFrame(() => this._els.fullView.classList.add('active'));
};

/* === Live Activity Stream (comments / likes / follows) === */
const LiveActivity = {
  container: null,
  timer: null,
  _portfolioTitles: [],

  init() {
    this.container = document.getElementById('live-alerts');
    if (!this.container) return;
    this._portfolioTitles = (StorageManager.get('vit_portfolio') || []).map(p => p.title).filter(Boolean);

    document.addEventListener('live:activity', (event) => {
      if (event.detail) this.push(event.detail);
    });
  },

  push(detail) {
    if (!detail) return;
    const normalized = this.normalize(detail);
    if (!normalized) return;
    this.renderToast(normalized);
    Notifications.add({
      text: normalized.panelText || normalized.message,
      title: normalized.title,
      type: normalized.type,
      time: normalized.timeLabel
    });
  },

  normalize(detail) {
    const type = detail.type || 'info';
    const iconMap = { comment: '💬', like: '❤', follow: '⭐' };
    const titleMap = {
      comment: 'نظر یا کامنت',
      like: 'پسند جدید',
      follow: 'دنبال‌کننده تازه'
    };

    const timeLabel = detail.timeLabel || new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    return {
      type,
      icon: detail.icon || iconMap[type] || '•',
      title: detail.title || titleMap[type] || 'اعلان جدید',
      message: detail.message || detail.text || '—',
      pill: detail.pill || null,
      accentClass: detail.accentClass || (type === 'like' ? 'live-alert__accent--like' : type === 'follow' ? 'live-alert__accent--follow' : ''),
      meta: detail.meta || 'همین حالا',
      panelText: detail.panelText,
      timeLabel
    };
  },

  createRandomEvent() {
    const names = ['نیلوفر محمدی', 'امیرحسین پارسا', 'آرزو مقدم', 'مهیار کیانی', 'سارا نوری', 'محمدرضا شکیبا'];
    const commentSnippets = [
      'از دقت و نظم کار راضی‌ام و برای همکاری بعدی مشتاقم.',
      'تحویل به‌موقع بود و ارتباط حرفه‌ای برقرار شد، سپاس.',
      'کیفیت کار مطابق انتظار و استانداردهای حرفه‌ای بود.'
    ];
    const portfolioFallbacks = ['طراحی لوگو مینیمال', 'عکاسی صنعتی', 'طراحی منو رستوران'];
    const portfolioPool = [...this._portfolioTitles, ...portfolioFallbacks];
    const portfolioTitle = portfolioPool[Math.floor(Math.random() * portfolioPool.length)] || 'نمونه‌کار شما';
    const actor = names[Math.floor(Math.random() * names.length)];
    const timeLabel = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    const variants = [
      {
        type: 'comment',
        message: `${actor} نظر جدیدی ثبت کرد: «${commentSnippets[Math.floor(Math.random() * commentSnippets.length)]}»`,
        pill: 'نظر یا کامنت',
        meta: 'تعامل حرفه‌ای',
        panelText: `${actor} یک نظر رسمی برای فروشگاه ثبت کرد`,
        accentClass: '',
        timeLabel
      },
      {
        type: 'like',
        message: `${actor} «${portfolioTitle}» را پسندید و به دیده شدن برند شما کمک کرد.`,
        pill: portfolioTitle,
        meta: 'تعامل مثبت',
        panelText: `نمونه‌کار «${portfolioTitle}» یک پسند جدید دریافت کرد`,
        accentClass: 'live-alert__accent--like',
        timeLabel
      },
      {
        type: 'follow',
        message: `${actor} فروشگاه شما را دنبال کرد.`,
        pill: 'دنبال‌کننده جدید',
        meta: 'رشد جامعه مشتریان',
        panelText: `${actor} به فهرست دنبال‌کنندگان شما اضافه شد`,
        accentClass: 'live-alert__accent--follow',
        timeLabel
      }
    ];

    return variants[Math.floor(Math.random() * variants.length)];
  },

  renderToast(event) {
    if (!this.container) return;
    const card = document.createElement('article');
    card.className = 'live-alert';
    card.innerHTML = `
      <div class="live-alert__icon live-alert__icon--${event.type}" aria-hidden="true">${event.icon}</div>
      <div class="live-alert__content">
        <div class="live-alert__title">${event.title}</div>
        <p class="live-alert__text">${event.message}</p>
        <div class="live-alert__meta">
          <span class="live-alert__accent ${event.accentClass || ''}">${event.meta}</span>
          ${event.pill ? `<span class="live-alert__pill">${event.pill}</span>` : ''}
          <span aria-hidden="true">•</span>
          <span>${event.timeLabel}</span>
        </div>
      </div>
    `;

    this.container.prepend(card);
    setTimeout(() => {
      card.classList.add('is-leaving');
      setTimeout(() => card.remove(), 220);
    }, 5400);

    if (this.container.children.length > 3) {
      const last = this.container.lastElementChild;
      if (last) last.remove();
    }
  }
};

const BookingPopup = {
  STORAGE_KEY: 'vit_seen_bookings',
  modal: null,
  elements: {},
  hasBaseline: false,

  init() {
    this.modal = document.getElementById('new-booking-modal');
    if (!this.modal) return;

    this.elements = {
      customer: this.modal.querySelector('[data-customer-name]'),
      service: this.modal.querySelector('[data-service-name]'),
      date: this.modal.querySelector('[data-booking-date]'),
      time: this.modal.querySelector('[data-booking-time]'),
      extra: this.modal.querySelector('[data-extra-count]'),
      viewBtn: this.modal.querySelector('[data-view-bookings]')
    };

    this.elements.viewBtn?.addEventListener('click', () => {
      UIComponents.closeModal('new-booking-modal');
      if (window.location.hash !== '#/bookings') {
        window.location.hash = '/bookings';
      } else {
        document.getElementById('bookings-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    if (this.getSeenKeys().size) {
      this.hasBaseline = true;
    }
  },

  getSeenKeys() {
    const stored = StorageManager.get(this.STORAGE_KEY);
    if (Array.isArray(stored)) {
      return new Set(stored);
    }
    return new Set();
  },

  setSeenKeys(keys) {
    if (!(keys instanceof Set)) return;
    StorageManager.set(this.STORAGE_KEY, Array.from(keys));
  },

  ensureBaseline(previousKeys) {
    const seen = this.getSeenKeys();
    const prev = previousKeys instanceof Set
      ? previousKeys
      : collectBookingKeys(previousKeys);

    if (prev.size) {
      const combined = new Set([...seen, ...prev]);
      this.setSeenKeys(combined);
      this.hasBaseline = true;
    } else if (seen.size) {
      this.hasBaseline = true;
    }
  },

  markKnown(bookingsOrKeys) {
    const keys = bookingsOrKeys instanceof Set
      ? bookingsOrKeys
      : collectBookingKeys(bookingsOrKeys);
    if (keys.size) {
      const seen = this.getSeenKeys();
      const combined = new Set([...seen, ...keys]);
      this.setSeenKeys(combined);
      if (combined.size) {
        this.hasBaseline = true;
      }
    }
    if (!this.hasBaseline) {
      this.hasBaseline = true;
    }
  },

  notifyNew(bookings) {
    if (!Array.isArray(bookings) || !bookings.length) return;
    const seen = this.getSeenKeys();
    if (!this.hasBaseline && !seen.size) return;

    const fresh = bookings.filter((booking) => {
      const key = createBookingKey(booking);
      return key && !seen.has(key);
    });

    if (!fresh.length) return;

    this.show(fresh[0], fresh.length - 1);
    const updated = new Set([...seen, ...fresh.map(createBookingKey).filter(Boolean)]);
    this.setSeenKeys(updated);
    this.hasBaseline = true;
  },

  show(booking, extraCount = 0) {
    if (!this.modal) return;

    const customerName = booking.customerName || booking.name || 'مشتری جدید';
    const serviceRaw = booking.service;
    const serviceName = typeof serviceRaw === 'string'
      ? serviceRaw
      : (serviceRaw?.title || serviceRaw?.name || '—');
    const rawDate = booking.date || booking.dateISO || '';
    let dateLabel = UIComponents?.formatPersianDayMonth?.(rawDate);
    if (!dateLabel && rawDate) {
      dateLabel = toFaDigits(rawDate.replace(/-/g, '/'));
    }
    const timeLabel = booking.time ? toFaDigits(booking.time) : '—';

    if (this.elements.customer) this.elements.customer.textContent = customerName;
    if (this.elements.service) this.elements.service.textContent = serviceName || '—';
    if (this.elements.date) this.elements.date.textContent = dateLabel || '—';
    if (this.elements.time) this.elements.time.textContent = timeLabel || '—';

    if (this.elements.extra) {
      if (extraCount > 0) {
        const formatted = (typeof UIComponents?.formatPersianNumber === 'function')
          ? UIComponents.formatPersianNumber(extraCount)
          : toFaDigits(extraCount);
        this.elements.extra.textContent = `+ ${formatted} نوبت جدید دیگر`;
        this.elements.extra.hidden = false;
      } else {
        this.elements.extra.hidden = true;
      }
    }

    UIComponents.openModal('new-booking-modal');
  },

  handleExternalUpdate(bookings) {
    if (!Array.isArray(bookings)) return;
    this.ensureBaseline();
    this.notifyNew(bookings);
    this.markKnown(bookings);
  }
};

// اجرا
Notifications.init();
LiveActivity.init();
BookingPopup.init();

  window.addEventListener('storage', (event) => {
    if (event.key === 'vitreenet-bookings' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        BookingPopup.handleExternalUpdate(Array.isArray(parsed) ? parsed : []);
      } catch (err) {
        console.warn('Failed to process booking storage event', err);
      }
    }
  });

  // Utility: normalize a time string to HH:MM (24h) or return null
  const normalizeTime = (t) => {
    const faDigits = '۰۱۲۳۴۵۶۷۸۹', enDigits = '0123456789';
    const toEn = (s) => (s + '').replace(/[۰-۹]/g, d => enDigits[faDigits.indexOf(d)]);
  const pad2 = (n) => String(n).padStart(2, '0');
    const m = /^(\d{1,2}):(\d{2})$/.exec(toEn((t || '').trim()));
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
    return `${pad2(h)}:${pad2(mi)}`;
  };

  /**
   * ==============================
   * Main Application Logic
   * ==============================
   */

// ثبت یک‌باره‌ی لیسنرِ بستن مودال مشتری
let _closeModalBound = false;
function bindFloatingCloseOnce() {
  if (_closeModalBound) return;
  _closeModalBound = true;

  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('.modal-close-floating');
    if (!closeBtn) return;

    const modalId = closeBtn.dataset.targetModal || closeBtn.closest('.modal')?.id;
    if (!modalId) return;

    e.preventDefault();
    e.stopPropagation();
    UIComponents.closeModal(modalId);
  }, true);
}




  class SellerPanelApp {
    constructor(flags = {}) {
      this.root = document.documentElement;
      this.body = document.body;
      this.appNav = document.querySelector('.app-nav');
      this.debouncedSearch = this.debounce(this.filterCustomers, 300);
      this.currentBookingFilter = 'all';
      this.currentServiceImage = '';
      this.currentPortfolioImage = '';
      this.dashboardStats = null;
      this._dashboardStatsPromise = null;
      this.bookingInsights = null;
      this._bookingInsightsPromise = null;
      this.bookingInsightsFetchedAt = 0;
      this.topPeersData = null;
      this._topPeersPromise = null;
      this.topPeersAutoRefreshInterval = null;
      this.topPeersAutoRefreshMs = 30 * 60 * 1000;

      this.currentCustomerFilter = 'all';
      this.currentCustomerQuery = '';

      this.discountStore = new DiscountStore();
      this.discountStore.purgeExpired();
      this.GLOBAL_CUSTOMER_ID = 'ALL_CUSTOMERS';
      this.GLOBAL_DISCOUNT_ID = 'global-discount';

      this.setFeatureFlags(flags);

      // Initialize Services, Portfolio, VIP & customer features
      this.initServices();
      this.initPortfolio();
      this.initVipSettings();
      this.initCustomerFeatures();
      this.initDiscountFeature();

    }

    setFeatureFlags(flags = {}) {
      this.featureFlags = normalizeFeatureFlags(flags);
    }

    isSellerPlansEnabled() {
      return !!(this.featureFlags && this.featureFlags.sellerPlansEnabled);
    }

    formatNumber(value, { fractionDigits = 0, fallback = '۰' } = {}) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return fallback;
      }
      const formatted = fractionDigits > 0
        ? numeric.toFixed(fractionDigits)
        : Math.round(numeric).toString();
      if (typeof UIComponents?.formatPersianNumber === 'function') {
        return UIComponents.formatPersianNumber(formatted);
      }
      return formatted;
    }

    setText(id, value) {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value;
      }
    }

    formatDateTime(value) {
      if (!value) return '';
      try {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat('fa-IR', {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(date);
      } catch (err) {
        console.warn('formatDateTime failed', err);
        return '';
      }
    }

// --- FIX: back-compat for old call in init() ---
applyCustomerRules() {
  // قوانین مشتری الان در renderBookings اعمال می‌شود؛
  // این متد فقط برای سازگاری قدیمی، یک بار رندر را فراخوانی می‌کند.
  if (typeof this.renderBookings === 'function') {
    try { this.renderBookings(); } catch (_) {}
  }
}


    init() {
      this.setupEventListeners();
      bindFloatingCloseOnce();

      this.handleRouteChange();
      this.initSidebarObserver();
      this.renderWelcomeDate();
      this.applyCustomerRules();

    }
setupEventListeners() {
  // Cache frequently used elements
    const elements = {
      body: this.body,
      notificationBtn: document.getElementById('notification-btn'),
      notificationPanel: document.getElementById('notification-panel'),
      viewStoreBtn: document.getElementById('view-store-btn'),
      openReservationsBtn: document.getElementById('open-reservations-btn'),
      bookingHistoryBtn: document.getElementById('booking-history-btn'),
      bookingHistoryRefresh: document.getElementById('booking-history-refresh'),

      plansView: document.getElementById('plans-view'),
      customerSearch: document.getElementById('customer-search'),
      customerFilters: document.querySelector('.customer-filters'),
      bookingsFilter: document.querySelector('#bookings-view .filter-chips'),
      reviewsFilter: document.querySelector('#reviews-view .filter-chips'),
      settingsForm: document.getElementById('settings-form'),
      rankCard: document.getElementById('rank-card'),
      rankCtaBtn: document.getElementById('rank-cta-btn'),
      topViewAllBtn: document.getElementById('top-view-all'),
      topLeaderboardList: document.getElementById('top-leaderboard-list'),
      addCustomerBtn: document.getElementById('add-customer-btn'),
      addServiceBtn: document.getElementById('add-service-btn'),
      addPortfolioBtn: document.getElementById('add-portfolio-btn'),
    serviceForm: document.getElementById('service-form'),
    portfolioForm: document.getElementById('portfolio-form'),
    serviceImageBtn: document.getElementById('service-image-btn'),
    serviceImageInput: document.getElementById('service-image'),
    portfolioImageBtn: document.getElementById('portfolio-image-btn'),
    portfolioImageInput: document.getElementById('portfolio-image'),
    portfolioImagePreview: document.getElementById('portfolio-image-preview'),
    vipSettingsBtn: document.getElementById('vip-settings-btn'),
    vipForm: document.getElementById('vip-form'),
    vipToggleBtn: document.getElementById('vip-toggle-btn'),
    vipToggleConfirm: document.getElementById('vip-toggle-confirm'),
    vipToggleMessage: document.getElementById('vip-toggle-message')
  };

  // Map for drawer/modal management
  const overlays = {
    modals: {
      'rank': 'rank-modal',
      'vip': 'vip-modal'
    },
    drawers: {
      'customer': 'customer-drawer',
      'service': 'service-drawer',
      'portfolio': 'portfolio-drawer'
    }
  };

  // Bind class methods once
  this.boundHandleRouteChange = this.handleRouteChange.bind(this);
  this.boundHandlePlanDurationChange = this.handlePlanDurationChange.bind(this);
  this.boundHandleBookingFilterChange = this.handleBookingFilterChange.bind(this);
  this.boundHandleReviewFilterChange = this.handleReviewFilterChange.bind(this);
  this.boundHandleSettingsFormSubmit = this.handleSettingsFormSubmit.bind(this);
  this.boundHandleServiceFormSubmit = this.handleServiceFormSubmit.bind(this);
  this.boundHandlePortfolioFormSubmit = this.handlePortfolioFormSubmit.bind(this);
  this.boundHandleVipFormSubmit = this.handleVipFormSubmit.bind(this);

  // 1. Route change listener
  window.addEventListener('hashchange', this.boundHandleRouteChange);

  // 2. Centralized body click delegation
elements.body.addEventListener('click', (e) => {
  const target = e.target;

  // Handle route navigation
  const routeTarget = target.closest('[data-route]');
  if (routeTarget) {
    const route = routeTarget.dataset.route;
    if (route === 'ranking') {
      UIComponents.openModal('rank-modal');
    } else {
      window.location.hash = `/${route}`;
    }
    return;
  }

  // ✅ Close the overlay you clicked inside (modal/drawer)
// ✅ FIXED: Close button handler
const dismissTarget = target.closest('[data-dismiss]');
if (dismissTarget) {
  e.preventDefault();
  e.stopPropagation();

  // Find the parent modal or drawer first
  let container = dismissTarget.closest('.modal, .drawer');

  // If the button sits outside the modal card (floating buttons), fall back to the currently open overlay
  if (!container) {
    if (dismissTarget.dataset.dismiss === 'modal') {
      container = document.querySelector('.modal.is-open');
    } else if (dismissTarget.dataset.dismiss === 'drawer') {
      container = document.querySelector('.drawer.is-open');
    }
  }

  if (container) {
    if (container.classList.contains('modal')) {
      UIComponents.closeModal(container.id);
    } else if (container.classList.contains('drawer')) {
      UIComponents.closeDrawer(container.id);
    }
  }
  return;
}



}, { passive: true });





  // 4. View Store button
// 4. View Store button
// 4. View Store button
if (elements.viewStoreBtn) {
  elements.viewStoreBtn.addEventListener('click', () => {
    if (!PlanAccessGuard.isActive()) {
      showPlanPromptModal();
      return;
    }
    try {
      const sellerData = JSON.parse(localStorage.getItem('seller') || '{}');
      if (sellerData.shopurl) {
        window.open(`/service-shops.html?shopurl=${sellerData.shopurl}`, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Error reading seller data', err);
    }
  });
}

  // 5. Plans view - Updated selector
  if (elements.plansView) {
    const billingToggle = elements.plansView.querySelector('.billing-toggle');
    if (billingToggle) {
      billingToggle.addEventListener('click', this.boundHandlePlanDurationChange);
    }
  }

  // 5. Search and Filters with optimized event handling
  if (elements.customerSearch) {
    elements.customerSearch.addEventListener('input',
      (e) => this.debouncedSearch(e.target.value),
      { passive: true }
    );
  }

  if (elements.customerFilters) {
    elements.customerFilters.addEventListener('click', (e) => this.handleCustomerFilterChange(e));
  }

  if (elements.bookingsFilter) {
    elements.bookingsFilter.addEventListener('click', this.boundHandleBookingFilterChange);
  }

  if (elements.reviewsFilter) {
    elements.reviewsFilter.addEventListener('click', this.boundHandleReviewFilterChange);
  }

  // 6. Form submissions
  if (elements.settingsForm) {
    elements.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.boundHandleSettingsFormSubmit();
    });
  }

  if (elements.serviceForm) {
    elements.serviceForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.boundHandleServiceFormSubmit();
    });
  }

  if (elements.portfolioForm) {
    elements.portfolioForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.boundHandlePortfolioFormSubmit();
    });
  }

  if (elements.serviceImageBtn && elements.serviceImageInput) {
    elements.serviceImageBtn.addEventListener('click', () => elements.serviceImageInput.click());
  }

  if (elements.portfolioImageBtn && elements.portfolioImageInput) {
    elements.portfolioImageBtn.addEventListener('click', () => elements.portfolioImageInput.click());
  }

  if (elements.portfolioImageInput) {
    elements.portfolioImageInput.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        try {
          const dataUrl = await this.fileToDataURL(file);
          this.currentPortfolioImage = dataUrl;
          this.updatePortfolioPreview(dataUrl);
        } catch (err) {
          console.error('portfolio image preview failed', err);
          this.currentPortfolioImage = '';
          this.updatePortfolioPreview('');
        }
      } else {
        this.currentPortfolioImage = '';
        this.updatePortfolioPreview('');
      }
    });
  }

  if (elements.vipForm) {
    elements.vipForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.boundHandleVipFormSubmit();
    });
  }

  // 7. Button click handlers with null checks
  const buttonHandlers = [
    {
      element: elements.rankCard,
      handler: () => UIComponents.openModal('rank-modal')
    },
    {
      element: elements.bookingHistoryBtn,
      handler: () => this.openBookingHistoryModal()
    },
    {
      element: elements.addCustomerBtn,
      handler: () => UIComponents.openDrawer('customer-drawer')
    },
    { 
      element: elements.addServiceBtn, 
      handler: () => {
        this.populateServiceForm(null);
        UIComponents.openDrawer('service-drawer');
      } 
    },
    {
      element: elements.addPortfolioBtn,
      handler: () => {
        this.populatePortfolioForm(null);
        UIComponents.openDrawer('portfolio-drawer');
      }
    },
    {
      element: elements.vipSettingsBtn,
      handler: () => UIComponents.openModal('vip-modal')
    },
    {
      element: elements.vipToggleBtn,
      handler: () => {
        const disabled = localStorage.getItem('vit_vip_rewards_disabled') === '1';
        if (elements.vipToggleMessage && elements.vipToggleConfirm) {
          elements.vipToggleMessage.textContent = disabled ? 'آیا می‌خواهید بخش جایزه دادن را فعال کنید؟' : 'آیا از غیر فعال کردن بخش جایزه دادن مطمئن هستید؟';
          elements.vipToggleConfirm.textContent = disabled ? 'فعال کردن' : 'غیرفعال کردن';
          elements.vipToggleConfirm.classList.toggle('btn-danger', !disabled);
          elements.vipToggleConfirm.classList.toggle('btn-success', disabled);
        }
        UIComponents.openModal('vip-toggle-modal');
      }
    }
  ];

  buttonHandlers.forEach(({ element, handler }) => {
    if (element) {
      element.addEventListener('click', handler);
    }
  });

  if (elements.rankCtaBtn) {
    elements.rankCtaBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.hash = '/top';
    });
  }

  if (elements.bookingHistoryRefresh) {
    elements.bookingHistoryRefresh.addEventListener('click', () => {
      this.renderBookingHistory(true).catch((err) => {
        console.error('bookingHistoryRefresh error', err);
      });
    });
  }

  if (elements.topLeaderboardList) {
    elements.topLeaderboardList.addEventListener('click', (e) => {
      if (e.target.closest('button, a')) {
        return;
      }
      const item = e.target.closest('li[data-shop-url]');
      if (!item) return;
      const slug = item.dataset.shopUrl;
      if (!slug) return;
      window.open(`/service-shops.html?shopurl=${encodeURIComponent(slug)}`, '_blank', 'noopener,noreferrer');
    });
  }

  function updateVipToggleBtn() {
    if (!elements.vipToggleBtn) return;
    const disabled = localStorage.getItem('vit_vip_rewards_disabled') === '1';
    elements.vipToggleBtn.textContent = disabled ? 'فعال‌سازی جایزه' : 'غیرفعال کردن جایزه';
    elements.vipToggleBtn.classList.toggle('btn-danger', !disabled);
    elements.vipToggleBtn.classList.toggle('btn-success', disabled);
  }

  updateVipToggleBtn();

  if (elements.vipToggleConfirm) {
    elements.vipToggleConfirm.addEventListener('click', () => {
      const disabled = localStorage.getItem('vit_vip_rewards_disabled') === '1';
      if (disabled) {
        localStorage.removeItem('vit_vip_rewards_disabled');
        UIComponents.showToast('باشگاه مشتریان ویژه فعال شد.', 'success');
      } else {
        localStorage.setItem('vit_vip_rewards_disabled', '1');
        UIComponents.showToast('باشگاه مشتریان ویژه غیرفعال شد.', 'info');
      }
      updateVipToggleBtn();
      UIComponents.closeModal('vip-toggle-modal');
    });
  }

  // 8. Optimized Escape key handler - only closes active overlay
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && StateManager.isModalOpen) {
      // Find and close only the currently open overlay
      const activeModal = document.querySelector('.modal.is-open');
      const activeDrawer = document.querySelector('.drawer.is-open');

      if (activeModal) {
        UIComponents.closeModal(activeModal.id);
      } else if (activeDrawer) {
        UIComponents.closeDrawer(activeDrawer.id);
      }
    }
  });

  // 9. Cleanup method for memory management (optional)
  this.cleanup = () => {
    window.removeEventListener('hashchange', this.boundHandleRouteChange);
    this.clearTopPeersAutoRefresh();
    // Remove other event listeners if needed when app is destroyed
  };
}

// Optional: Add this method to properly clean up event listeners
destroy() {
  if (this.cleanup) {
    this.cleanup();
  }
  
  // Clear any intervals or timeouts
  if (this.debouncedSearchTimeout) {
    clearTimeout(this.debouncedSearchTimeout);
  }
}
    // --- Routing ---
    handleRouteChange() {
      const hash = window.location.hash || '#/dashboard';
      const page = hash.substring(2) || 'dashboard';
      this.clearTopPeersAutoRefresh();
      if (page === 'plans' && !this.isSellerPlansEnabled()) {
        if (window.location.hash !== '#/dashboard') {
          window.location.hash = '#/dashboard';
        }
        UIComponents?.showToast?.('بخش پلن‌ها به‌زودی فعال می‌شود.', 'info');
        return;
      }
      document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.removeAttribute('aria-current'));
      const activeSection = document.getElementById(`${page}-view`);
      const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
      const appHeader = document.querySelector('.app-header');
      if (activeSection) {
        activeSection.classList.add('active');
        document.title = `پنل فروشنده - ${activeNav?.textContent.trim() || 'داشبورد'}`;
        this.renderPageContent(page);
      } else {
        const dashboardView = document.getElementById('dashboard-view');
        if (dashboardView) {
          dashboardView.classList.add('active');
        }
      }
      if (activeNav) {
        activeNav.classList.add('active');
        activeNav.setAttribute('aria-current', 'page');
      }
      if (appHeader) {
        appHeader.classList.remove('is-hidden');
        appHeader.removeAttribute('aria-hidden');
      }
    }
    renderPageContent(page) {
      switch(page) {
        case 'dashboard': this.renderDashboard(); break;
        case 'bookings': this.renderBookings(); break;
        case 'customers': this.renderCustomers(); break;
        case 'discounts': this.renderDiscounts(); break;
        case 'reviews': this.renderReviews(); break;
        case 'top':
          this.renderTopPeers();
          this.scheduleTopPeersAutoRefresh(true);
          break;
        case 'plans':
          if (this.isSellerPlansEnabled()) {
            this.renderPlans();
          }
          break;
        case 'settings': this.renderSettings(); break; // New call for settings
      }
    }
    clearTopPeersAutoRefresh() {
      if (this.topPeersAutoRefreshInterval) {
        clearInterval(this.topPeersAutoRefreshInterval);
        this.topPeersAutoRefreshInterval = null;
      }
    }

    scheduleTopPeersAutoRefresh(reset = false) {
      if (reset) {
        this.clearTopPeersAutoRefresh();
      } else if (this.topPeersAutoRefreshInterval) {
        return;
      }

      const topView = document.getElementById('top-view');
      if (!topView || !topView.classList.contains('active')) {
        return;
      }

      const intervalMs = Math.max(15000, Number(this.topPeersAutoRefreshMs) || (30 * 60 * 1000));
      this.topPeersAutoRefreshInterval = window.setInterval(() => {
        const topView = document.getElementById('top-view');
        if (!topView || !topView.classList.contains('active')) {
          this.clearTopPeersAutoRefresh();
          return;
        }
        this.refreshTopPeersSilently();
      }, intervalMs);
    }

    restartTopPeersAutoRefresh() {
      this.scheduleTopPeersAutoRefresh(true);
    }

    async refreshTopPeersSilently() {
      if (this._topPeersPromise) {
        return;
      }
      try {
        const data = await this.loadTopPeers(true);
        this.applyTopPeers(data);
      } catch (err) {
        console.warn('Auto refresh top peers failed', err);
      }
    }

    async loadTopPeers(force = false) {
      if (this._topPeersPromise && !force) {
        return this._topPeersPromise;
      }

      if (force) {
        this.topPeersData = null;
      }

      this._topPeersPromise = (async () => {
        try {
          const data = await API.getTopPeers({ scope: 'subcategory' });
          this.topPeersData = data || {};
          this.applyRankCard(this.topPeersData);
          this.applyTopSummary(this.topPeersData);
          return this.topPeersData;
        } catch (err) {
          console.error('loadTopPeers failed', err);
          if (force) {
            UIComponents?.showToast?.('خطا در بروزرسانی رتبه‌بندی', 'error');
          }
          throw err;
        } finally {
          this._topPeersPromise = null;
        }
      })();

      return this._topPeersPromise;
    }

    applyRankCard(data = this.topPeersData || {}) {
      const mine = data?.mine || {};
      const metrics = mine.metrics || {};
      const total = Number(data?.total) || 0;
      const categoryLabel = data?.category || 'حوزه شما';

      this.setText('rank-category', categoryLabel);
      this.setText('total-sellers', this.formatNumber(total));
      this.setText('current-rank', mine.rank ? this.formatNumber(mine.rank) : '—');
      this.setText('ucw30', this.formatNumber(metrics.uniqueCustomers ?? metrics.completedBookings ?? 0));
      this.setText('bookingsTotal', this.formatNumber(metrics.totalBookings ?? 0));
      this.setText('rating30', this.formatNumber(metrics.ratingAverage ?? 0, { fractionDigits: 1, fallback: '۰٫۰' }));

      const modalCurrent = document.getElementById('rank-modal-current');
      if (modalCurrent) {
        if (mine.rank) {
          modalCurrent.textContent = `رتبه فعلی شما: ${this.formatNumber(mine.rank)} از ${this.formatNumber(total)} فروشگاه فعال در ${categoryLabel}.`;
        } else {
          modalCurrent.textContent = 'هنوز رتبه‌ای برای فروشگاه شما ثبت نشده است. با افزایش فعالیت می‌توانید وارد فهرست برترین‌ها شوید.';
        }
      }
    }

    calculateAggregateScore(metrics = {}) {
      const rating = Number(metrics.ratingAverage ?? 0) || 0;
      const bookings = Number(metrics.totalBookings ?? 0) || 0;
      const customers = Number(metrics.uniqueCustomers ?? metrics.completedBookings ?? 0) || 0;
      return rating + bookings + customers;
    }

    applyTopSummary(data = this.topPeersData || {}) {
      const mine = data?.mine || {};
      const metrics = mine.metrics || {};
      const total = Number(data?.total) || 0;

      this.setText('top-my-rank', mine.rank ? this.formatNumber(mine.rank) : '—');
      this.setText('top-total-peers', this.formatNumber(total));

      const aggregateScore = this.calculateAggregateScore(metrics);
      const scoreText = this.formatNumber(aggregateScore, { fractionDigits: 1, fallback: '۰٫۰' });
      this.setText('top-my-score', scoreText);
      this.setText('top-my-rating', this.formatNumber(metrics.ratingAverage ?? 0, { fractionDigits: 1, fallback: '۰٫۰' }));
      this.setText('top-my-bookings', this.formatNumber(metrics.totalBookings ?? 0));
      this.setText('top-my-customers', this.formatNumber(metrics.uniqueCustomers ?? metrics.completedBookings ?? 0));

      const badgesEl = document.getElementById('top-my-badges');
      if (badgesEl) {
        const badges = [];
        if (mine.badges?.isPremium) {
          badges.push('<span class="badge-pill badge-premium">پریمیوم</span>');
        }
        if (mine.badges?.isFeatured) {
          badges.push('<span class="badge-pill badge-featured">ویژه</span>');
        }
        badgesEl.innerHTML = badges.length ? badges.join('') : '<span class="badge-pill">بدون نشان ویژه</span>';
      }

      const updatedAtEl = document.getElementById('top-updated-at');
      if (updatedAtEl) {
        const formatted = this.formatDateTime(data?.updatedAt);
        updatedAtEl.textContent = formatted ? `آخرین بروزرسانی: ${formatted}` : '';
      }

      const subtitle = document.getElementById('top-subtitle');
      if (subtitle) {
        const scopeLabel = data?.scope === 'subcategory' ? 'زیرگروه' : 'حوزه';
        const groupLabel = data?.category ? `${scopeLabel} «${data.category}»` : 'همه حوزه‌ها';
        subtitle.textContent = `رتبه‌بندی برترین فروشگاه‌های ${groupLabel}`;
      }
    }

    buildLeaderboardItem(entry, mine = {}) {
      const metrics = entry.metrics || {};
      const isMine = entry.isMine || (mine?.shopUrl && entry.shopUrl && mine.shopUrl === entry.shopUrl);
      const rank = this.formatNumber(entry.rank);
      const aggregateScore = this.calculateAggregateScore(metrics);
      const score = this.formatNumber(aggregateScore, { fractionDigits: 1, fallback: '۰٫۰' });
      const rating = this.formatNumber(metrics.ratingAverage ?? 0, { fractionDigits: 1, fallback: '۰٫۰' });
      const ratingCount = this.formatNumber(metrics.ratingCount ?? 0);
      const bookings = this.formatNumber(metrics.totalBookings ?? 0);
      const customers = this.formatNumber(metrics.uniqueCustomers ?? metrics.completedBookings ?? 0);

      const badges = [];
      if (entry.badges?.isPremium) {
        badges.push('<span class="badge-pill badge-premium">پریمیوم</span>');
      }
      if (entry.badges?.isFeatured) {
        badges.push('<span class="badge-pill badge-featured">ویژه</span>');
      }

      const nameMarkup = entry.shopUrl
        ? `<a href="/service-shops.html?shopurl=${encodeURIComponent(entry.shopUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.name)}</a>`
        : escapeHtml(entry.name);

      const metaParts = [];
      if (entry.city) {
        metaParts.push(`<span>📍 ${escapeHtml(entry.city)}</span>`);
      }
      metaParts.push(`<span>⭐ ${rating} (${ratingCount})</span>`);
      metaParts.push(`<span>📆 ${bookings} نوبت</span>`);
      metaParts.push(`<span>👥 ${customers} مشتری فعال</span>`);

      const dataAttr = entry.shopUrl ? ` data-shop-url="${escapeHtml(entry.shopUrl)}"` : '';

      return `
        <li class="leaderboard-item${isMine ? ' is-mine' : ''}" data-rank="${entry.rank || ''}"${dataAttr}>
          <div class="leaderboard-rank">${rank}</div>
          <div class="leaderboard-main">
            <div class="leaderboard-title">
              ${nameMarkup}
              ${badges.join('')}
            </div>
            <div class="leaderboard-meta">${metaParts.join('')}</div>
          </div>
          <div class="leaderboard-score">
            <span>${score}</span>
            <span>مجموع امتیاز</span>
          </div>
        </li>
      `;
    }

    applyTopPeers(data = this.topPeersData || {}) {
      const list = document.getElementById('top-leaderboard-list');
      const loadingEl = document.getElementById('top-leaderboard-loading');
      const errorEl = document.getElementById('top-error');
      const emptyEl = document.getElementById('top-leaderboard-empty');
      if (!list) return;

      if (loadingEl) loadingEl.hidden = true;
      if (errorEl) errorEl.hidden = true;

      const top = Array.isArray(data?.top) ? data.top : [];
      if (!top.length) {
        list.innerHTML = '';
        if (emptyEl) emptyEl.hidden = false;
      } else {
        if (emptyEl) emptyEl.hidden = true;
        list.innerHTML = top.map(entry => this.buildLeaderboardItem(entry, data?.mine)).join('');
      }

      this.applyRankCard(data);
      this.applyTopSummary(data);
    }

    async renderTopPeers(force = false) {
      const list = document.getElementById('top-leaderboard-list');
      const loadingEl = document.getElementById('top-leaderboard-loading');
      const errorEl = document.getElementById('top-error');
      const emptyEl = document.getElementById('top-leaderboard-empty');
      if (!list) return;

      if (!force && this.topPeersData) {
        this.applyTopPeers(this.topPeersData);
        return;
      }

      if (loadingEl) loadingEl.hidden = false;
      if (errorEl) errorEl.hidden = true;
      if (emptyEl) emptyEl.hidden = true;
      list.innerHTML = '';
      list.setAttribute('aria-busy', 'true');

      try {
        const data = await this.loadTopPeers(force);
        this.applyTopPeers(data);
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = 'خطا در دریافت اطلاعات رتبه‌بندی. لطفاً دوباره تلاش کنید.';
          errorEl.hidden = false;
        }
      } finally {
        if (loadingEl) loadingEl.hidden = true;
        list.removeAttribute('aria-busy');
      }
    }

    // --- Page Rendering ---
    renderWelcomeDate() {
      const el = document.getElementById('welcome-date');
      if (el) {
        const dateTarget = el.querySelector('.dashboard-hero__date-text') || el;
        dateTarget.textContent = UIComponents.formatPersianNumber(new Date().toLocaleDateString('fa-IR'));
      }
    }
    async loadDashboardStats(force = false) {
      if (this._dashboardStatsPromise && !force) {
        return this._dashboardStatsPromise;
      }

      this._dashboardStatsPromise = (async () => {
        try {
          const stats = await API.getDashboardStats();
          this.dashboardStats = stats || {};
          this.applyDashboardStats(this.dashboardStats);
          return this.dashboardStats;
        } catch (err) {
          console.error('loadDashboardStats failed', err);
          if (this.dashboardStats) {
            this.applyDashboardStats(this.dashboardStats);
          } else {
            this.applyDashboardStats({});
          }
          if (force) {
            UIComponents?.showToast?.('خطا در بروزرسانی آمار داشبورد', 'error');
          }
          throw err;
        } finally {
          this._dashboardStatsPromise = null;
        }
      })();

      return this._dashboardStatsPromise;
    }

    shouldRefreshBookingInsights(maxAgeMs = 5 * 60 * 1000) {
      if (!this.bookingInsights || !this.bookingInsightsFetchedAt) {
        return true;
      }
      return (Date.now() - this.bookingInsightsFetchedAt) > maxAgeMs;
    }

    async loadBookingInsights(force = false) {
      if (this._bookingInsightsPromise && !force) {
        return this._bookingInsightsPromise;
      }

      if (!force && !this.shouldRefreshBookingInsights()) {
        return this.bookingInsights;
      }

      this._bookingInsightsPromise = (async () => {
        try {
          const data = await API.getMonthlyBookingInsights();
          this.bookingInsights = data || {};
          this.bookingInsightsFetchedAt = Date.now();
          return this.bookingInsights;
        } finally {
          this._bookingInsightsPromise = null;
        }
      })();

      return this._bookingInsightsPromise;
    }

    async renderBookingHistory(force = false) {
      const content = document.getElementById('booking-history-content');
      const loadingEl = document.getElementById('booking-history-loading');
      const errorEl = document.getElementById('booking-history-error');
      const refreshBtn = document.getElementById('booking-history-refresh');

      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = '';
      }

      const hasCachedData = !!this.bookingInsights;
      const willFetchFresh = force || this.shouldRefreshBookingInsights();
      if (content && hasCachedData && !force) {
        this.applyBookingInsights(this.bookingInsights);
        content.hidden = false;
      }

      if (loadingEl) {
        loadingEl.hidden = hasCachedData && !willFetchFresh;
      }
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.setAttribute('aria-busy', 'true');
      }

      try {
        const data = await this.loadBookingInsights(force);
        if (data) {
          this.applyBookingInsights(data);
          if (content) {
            content.hidden = false;
          }
        }
      } catch (err) {
        console.error('renderBookingHistory failed', err);
        if (this.bookingInsights && content) {
          this.applyBookingInsights(this.bookingInsights);
          content.hidden = false;
        }
        if (errorEl) {
          const message = err?.status === 401
            ? 'برای مشاهده آمار رزرو لازم است دوباره وارد شوید.'
            : 'خطا در دریافت آمار ماهانه رزرو. لطفاً دوباره تلاش کنید.';
          errorEl.textContent = message;
          errorEl.hidden = false;
        }
      } finally {
        if (loadingEl) {
          loadingEl.hidden = true;
        }
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.removeAttribute('aria-busy');
        }
      }
    }

    applyBookingInsights(data = {}) {
      const totals = data?.totals || {};
      const averages = data?.averages || {};
      const trend = data?.trend || {};
      const todayTrend = trend?.today || {};
      const weekTrend = trend?.weekOverWeek || {};
      const bestDay = data?.bestDay || null;
      const range = data?.range || {};
      const daily = Array.isArray(data?.daily) ? data.daily : [];
      const services = Array.isArray(data?.serviceLeaders) ? data.serviceLeaders : [];

      const formatNumber = (value, fractionDigits = 0, fallback = '۰') => {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        const fixed = Number(num.toFixed(fractionDigits));
        return UIComponents.formatPersianNumber(fixed);
      };

      const formatPercent = (ratio) => {
        const num = Number(ratio);
        if (!Number.isFinite(num)) return '—';
        const percent = num * 100;
        const digits = Math.abs(percent) < 10 ? 1 : 0;
        return `${formatNumber(percent, digits, '—')}٪`;
      };

      const formatAbsolutePercent = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return '—';
        const digits = Math.abs(num) < 10 ? 1 : 0;
        return `${formatNumber(Math.abs(num), digits, '—')}٪`;
      };

      const formatDelta = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num) || num === 0) return 'بدون تغییر';
        const sign = num > 0 ? '+' : '−';
        return `${sign}${formatNumber(Math.abs(num), 0, '۰')}`;
      };

      const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = value;
        }
      };

      const rangeEl = document.getElementById('bh-range');
      if (rangeEl) {
        const startLabel = UIComponents?.formatPersianDayMonth?.(range.start) || '';
        const endLabel = UIComponents?.formatPersianDayMonth?.(range.end) || '';
        rangeEl.textContent = startLabel && endLabel
          ? `${startLabel} تا ${endLabel}`
          : '۳۰ روز اخیر';
      }

      const updatedEl = document.getElementById('bh-last-updated');
      if (updatedEl) {
        const label = data?.lastUpdated
          ? UIComponents?.formatRelativeDate?.(data.lastUpdated)
          : '';
        updatedEl.textContent = label ? `آخرین بروزرسانی: ${label}` : '—';
      }

      setText('bh-total', formatNumber(totals.total || 0));
      setText('bh-completed', formatNumber(totals.completed || 0));
      setText('bh-confirmed', formatNumber(totals.confirmed || 0));
      setText('bh-pending', formatNumber(totals.pending || 0));
      setText('bh-cancelled', formatNumber(totals.cancelled || 0));

      setText('bh-average-per-day', formatNumber(averages.perDay || 0, 1, '۰'));
      setText('bh-fulfillment-rate', formatPercent(averages.fulfillmentRate));
      setText('bh-cancellation-rate', formatPercent(averages.cancellationRate));
      setText('bh-active-days', formatNumber(totals.activeDays || 0));

      const bestDayEl = document.getElementById('bh-best-day');
      if (bestDayEl) {
        if (bestDay && bestDay.date) {
          const dateLabel = UIComponents?.formatPersianDayMonth?.(bestDay.date) || '';
          const countLabel = formatNumber(bestDay.total || 0);
          bestDayEl.textContent = dateLabel
            ? `${dateLabel} (${countLabel})`
            : countLabel;
        } else {
          bestDayEl.textContent = '—';
        }
      }

      const applyTrendCard = (id, dataPoint, percentSuffix) => {
        const card = document.getElementById(id);
        if (!card) return;
        const direction = dataPoint?.direction || 'flat';
        card.dataset.direction = direction;
        const totalEl = card.querySelector('[data-role="total"]');
        if (totalEl) {
          totalEl.textContent = formatNumber(dataPoint?.total || 0);
        }
        const deltaEl = card.querySelector('[data-role="delta"]');
        if (deltaEl) {
          deltaEl.textContent = formatDelta(dataPoint?.delta || 0);
        }
        const percentEl = card.querySelector('[data-role="percent"]');
        if (percentEl) {
          const percent = dataPoint?.percent;
          if (percent == null || !Number.isFinite(Number(percent))) {
            percentEl.textContent = '—';
          } else {
            const percentText = formatAbsolutePercent(percent);
            percentEl.textContent = percentSuffix ? `${percentText} ${percentSuffix}` : percentText;
          }
        }
      };

      applyTrendCard('bh-today-trend', todayTrend, 'نسبت به دیروز');
      applyTrendCard('bh-week-trend', weekTrend, 'نسبت به هفته قبل');

      const chartEl = document.getElementById('bh-chart');
      const emptyEl = document.getElementById('booking-history-empty');
      if (chartEl) {
        const maxTotal = daily.reduce((max, item) => Math.max(max, Number(item?.total) || 0), 0);
        if (!daily.length || maxTotal === 0) {
          chartEl.innerHTML = '';
          if (emptyEl) emptyEl.hidden = false;
        } else {
          if (emptyEl) emptyEl.hidden = true;
          chartEl.innerHTML = daily.map((day) => {
            const total = Number(day?.total) || 0;
            const iso = day?.date || '';
            const dayNumber = iso ? Number(iso.split('-')[2] || iso.split('/')[2] || 0) : 0;
            const percentage = maxTotal ? Math.max((total / maxTotal) * 100, total > 0 ? 6 : 0) : 0;
            const tooltip = `${UIComponents?.formatPersianDayMonth?.(iso) || ''} • ${formatNumber(total)} رزرو`;
            const isToday = iso && iso === (range?.end || '');
            const dayLabel = Number.isFinite(dayNumber) && dayNumber > 0
              ? UIComponents.formatPersianNumber(dayNumber)
              : '—';
            return `
              <li class="bh-bar" data-value="${total}" data-today="${isToday ? 'true' : 'false'}" aria-label="${escapeHtml(tooltip)}">
                <div class="bh-bar-track"><span class="bh-bar-fill" style="height:${percentage.toFixed(1)}%"></span></div>
                <span class="bh-bar-day">${dayLabel}</span>
              </li>
            `;
          }).join('');
        }
      }

      const serviceList = document.getElementById('bh-service-list');
      if (serviceList) {
        if (!services.length) {
          serviceList.innerHTML = '<li>هنوز خدمتی ثبت نشده است.</li>';
        } else {
          serviceList.innerHTML = services.map((service) => {
            const name = service?.service ? escapeHtml(service.service) : '—';
            const count = formatNumber(service?.total || 0);
            return `<li><span>${name}</span><span>${count}</span></li>`;
          }).join('');
        }
      }
    }

    async openBookingHistoryModal(force = false) {
      UIComponents.openModal('booking-history-modal');
      try {
        await this.renderBookingHistory(force);
      } catch (err) {
        // renderBookingHistory already logs and surfaces the error state.
      }
    }

    getRatingBadgeConfig(rating, count) {
      if (!count) return { label: 'بدون نظر', className: 'badge-warning' };
      if (rating >= 4.5) return { label: 'عالی', className: 'badge-premium' };
      if (rating >= 4) return { label: 'خیلی خوب', className: 'badge-success' };
      if (rating >= 3) return { label: 'خوب', className: 'badge-warning' };
      return { label: 'نیاز به بهبود', className: 'badge-warning' };
    }

    applyDashboardStats(stats = {}) {
      const toNumber = (value, fallback = 0) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
      };

      const setValue = (selector, value, { fractionDigits = 0 } = {}) => {
        const el = document.querySelector(selector);
        if (!el) return;
        const numeric = toNumber(value, 0);
        el.dataset.value = numeric;
        const formatted = fractionDigits > 0
          ? UIComponents.formatPersianNumber(numeric.toFixed(fractionDigits))
          : UIComponents.formatPersianNumber(numeric);
        el.textContent = formatted;
      };

      const applyTrend = (selector, direction, text) => {
        const trendEl = document.querySelector(selector);
        if (!trendEl) return;
        trendEl.classList.remove('trend-up', 'trend-down', 'trend-flat');
        const dir = direction === 'down' ? 'trend-down' : direction === 'flat' ? 'trend-flat' : 'trend-up';
        trendEl.classList.add(dir);
        const span = trendEl.querySelector('span');
        if (span) span.textContent = text;
        trendEl.setAttribute('aria-label', text);
      };

      const todayBookings = toNumber(stats.todayBookings);
      const yesterdayBookings = toNumber(stats.yesterdayBookings);
      const pendingBookings = toNumber(stats.pendingBookings);
      const activeCustomers = toNumber(stats.activeCustomers);
      const previousActiveCustomers = toNumber(stats.previousActiveCustomers);
      const newCustomers30d = toNumber(stats.newCustomers30d);
      const ratingAverage = toNumber(stats.ratingAverage);
      const ratingCount = toNumber(stats.ratingCount);

      setValue('.stat-bookings .stat-value', todayBookings);
      setValue('.stat-pending .stat-value', pendingBookings);
      setValue('.stat-customers .stat-value', activeCustomers);
      setValue('.stat-rating .stat-value', ratingAverage, { fractionDigits: 1 });
      setValue('#rating30', ratingAverage, { fractionDigits: 1 });

      const bookingsDiff = todayBookings - yesterdayBookings;
      let bookingsText = 'بدون تغییر';
      if (bookingsDiff !== 0) {
        if (yesterdayBookings === 0) {
          bookingsText = `${UIComponents.formatPersianNumber(Math.abs(bookingsDiff))} نوبت جدید`;
        } else {
          const percent = Math.round((Math.abs(bookingsDiff) / Math.max(yesterdayBookings, 1)) * 100);
          bookingsText = `${UIComponents.formatPersianNumber(percent)}٪ ${bookingsDiff > 0 ? 'افزایش' : 'کاهش'}`;
        }
      }
      const bookingsDirection = bookingsDiff > 0 ? 'up' : bookingsDiff < 0 ? 'down' : 'flat';
      applyTrend('.stat-bookings .stat-trend', bookingsDirection, bookingsText);

      const customersDiff = activeCustomers - previousActiveCustomers;
      const customersDirection = customersDiff > 0 ? 'up' : customersDiff < 0 ? 'down' : 'flat';
      const customersText = newCustomers30d > 0
        ? `${UIComponents.formatPersianNumber(newCustomers30d)} مشتری جدید`
        : 'مشتری جدیدی ثبت نشد';
      applyTrend('.stat-customers .stat-trend', customersDirection, customersText);

      const badgeConfig = this.getRatingBadgeConfig(ratingAverage, ratingCount);
      const badgeEl = document.querySelector('.stat-rating .stat-badge');
      if (badgeEl) {
        badgeEl.textContent = badgeConfig.label;
        badgeEl.classList.remove('badge-premium', 'badge-success', 'badge-warning');
        badgeEl.classList.add(badgeConfig.className);
      }

      const starsEl = document.querySelector('.stat-rating .stars-filled');
      const starsWrap = document.querySelector('.stat-rating .stat-stars');
      const clampedRating = Math.max(0, Math.min(5, ratingAverage || 0));
      if (starsEl) {
        starsEl.style.setProperty('--rating', clampedRating.toFixed(1));
      }
      if (starsWrap) {
        const label = ratingCount
          ? `${UIComponents.formatPersianNumber(clampedRating.toFixed(1))} از ۵ بر اساس ${UIComponents.formatPersianNumber(ratingCount)} نظر`
          : 'هنوز نظری ثبت نشده است';
        starsWrap.setAttribute('aria-label', label);
      }

      const ratingLabel = document.querySelector('.stat-rating .stat-label');
      if (ratingLabel) {
        ratingLabel.textContent = ratingCount
          ? `امتیاز کلی (${UIComponents.formatPersianNumber(ratingCount)} نظر)`
          : 'امتیاز کلی';
      }

      document.querySelectorAll('.stat-value').forEach(UIComponents.animateCountUp);
    }

    async renderDashboard() {
      try {
        await this.loadDashboardStats();
      } catch (err) {
        console.error('renderDashboard failed', err);
      }
      try {
        await this.loadTopPeers();
      } catch (err) {
        console.error('loadTopPeers dashboard failed', err);
      }
    }
 renderBookings(filter = 'all') {
  this.currentBookingFilter = filter;
  const listEl = document.getElementById('bookings-list');
  const prefs = CustomerPrefs.load();

  // قوانین مشتری (مسدود = لغو شده، خودکار تایید = از pending به confirmed)
  const effective = MOCK_DATA.bookings.map(b => {
    const p = prefs[normalizeKey(b.customerName)];
    const blocked = !!p?.blocked;
    if (blocked) return { ...b, status: 'cancelled', blocked };
    if (p?.autoAccept && b.status === 'pending') return { ...b, status: 'confirmed', blocked };
    return { ...b, blocked };
  });

  const filtered = (filter === 'all') ? effective : effective.filter(b => b.status === filter);

  if (!filtered.length) {
    listEl.innerHTML = `<p>موردی برای نمایش یافت نشد.</p>`;
  } else {
    const baseStatusLabel = {
      pending: 'در انتظار تایید',
      confirmed: 'تایید شده',
      completed: 'انجام شده'
    };
    listEl.innerHTML = filtered.map(b => {
      const statusText = b.status === 'cancelled'
        ? (b.cancelledBy === 'customer' ? 'لغو شده توسط مشتری' : 'لغو شده')
        : (baseStatusLabel[b.status] || b.status);
      return `
      <article class="booking-card card" role="listitem" tabindex="0" data-status="${b.status}" ${b.cancelledBy ? `data-cancelled-by="${b.cancelledBy}"` : ''} data-customer-name="${b.customerName}">
        <div class="booking-card-content">
          <strong class="booking-customer">${b.customerName}</strong>
          <span class="booking-service">
  ${b.service}
  ${UIComponents.formatPersianDayMonth(b.date) ? ' - ' + UIComponents.formatPersianDayMonth(b.date) : ''}
  - ساعت ${UIComponents.formatPersianNumber(b.time)}
</span>
          ${b.cancelledBy === 'customer' ? '<span class="cancel-note">این نوبت توسط مشتری لغو شده است</span>' : ''}
        </div>
        <div class="booking-actions">
          <span class="status-badge status-${b.status}">${statusText}</span>
          ${!['completed','cancelled'].includes(b.status) ? `
          <div class="status-wrapper">
            <button type="button" class="btn-secondary btn-icon-text status-change-btn" data-id="${b._id || b.id}" aria-haspopup="true" aria-expanded="false">تغییر وضعیت</button>
            <div class="status-menu" role="menu">
              <button type="button" class="status-option" data-status="confirmed">تایید نوبت</button>
              <button type="button" class="status-option" data-status="completed">انجام شده</button>
              <button type="button" class="status-option" data-status="cancelled">لغو نوبت</button>
            </div>
          </div>
          ` : ''}
          <button type="button" class="btn-icon-text ${b.blocked ? 'btn-secondary' : 'btn-danger'} block-customer-btn" data-name="${b.customerName}" data-user-id="${b.customerId || ''}" data-blocked="${b.blocked}" aria-label="${b.blocked ? 'آزادسازی مشتری' : 'مسدودسازی مشتری'}">${b.blocked ? 'آزادسازی' : 'مسدود'}</button>
          <button type="button" class="btn-icon btn-danger delete-booking-btn" data-id="${b._id || b.id}" aria-label="حذف نوبت">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </article>
      `;
    }).join('');
  }

  if (!listEl.dataset.statusBound) {
    const self = this;
    listEl.addEventListener('click', async function(e) {
      const delBtn = e.target.closest('.delete-booking-btn');
      const btn = e.target.closest('.status-change-btn');
      const option = e.target.closest('.status-option');
      const blockBtn = e.target.closest('.block-customer-btn');
      if (blockBtn) {
        const name = blockBtn.dataset.name;
        const userId = blockBtn.dataset.userId;
        if (!userId) {
          UIComponents.showToast('شناسه مشتری یافت نشد', 'error');
          e.stopPropagation();
          return;
        }
        const currentlyBlocked = blockBtn.dataset.blocked === 'true';
        try {
          const res = await fetch(`${API_BASE}/api/user/block/${userId}`, {
            method: currentlyBlocked ? 'DELETE' : 'POST',
            credentials: 'include',
            headers: currentlyBlocked ? undefined : { 'Content-Type': 'application/json' },
            body: currentlyBlocked ? undefined : JSON.stringify({})
          });
          if (!res.ok) throw new Error('BLOCK_FAILED');
          CustomerPrefs.setByName(name, { blocked: !currentlyBlocked });
          blockBtn.dataset.blocked = (!currentlyBlocked).toString();
          UIComponents.showToast(
            currentlyBlocked ? 'مسدودسازی برداشته شد' : '🚫 این مشتری مسدود شد',
            currentlyBlocked ? 'success' : 'error'
          );
          self.renderBookings(self.currentBookingFilter || 'all');
          self.renderPlans && self.renderPlans();
        } catch (_) {
          UIComponents.showToast('خطا در ارتباط با سرور', 'error');
        }
        e.stopPropagation();
        return;
      } else if (delBtn) {
        const id = delBtn.dataset.id;
        if (!confirm('آیا از حذف این نوبت مطمئن هستید؟')) return;
        const idx = MOCK_DATA.bookings.findIndex(b => (b._id || b.id) == id);
        if (idx > -1) {
          const booking = MOCK_DATA.bookings[idx];
          const dateISO = booking?.dateISO;
          MOCK_DATA.bookings.splice(idx, 1);
          persistBookings();
          const validId = /^[0-9a-fA-F]{24}$/.test(id);
          if (validId) {
            fetch(`${API_BASE}/api/seller-bookings/${id}`, { method: 'DELETE', credentials: 'include' })
              .catch(err => console.error('DELETE_BOOKING_FAILED', err));
          }
          self.renderBookings(self.currentBookingFilter || 'all');
          self.renderPlans && self.renderPlans();
          delete bookedCache[dateISO];
          const modal = document.getElementById('resv-modal');
          if (modal && !modal.hidden) renderTimes();
          UIComponents?.showToast?.('نوبت حذف شد', 'success');
        }
        e.stopPropagation();
        return;
      }
      if (btn) {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        listEl.querySelectorAll('.status-menu').forEach(m => m.classList.remove('open'));
        listEl.querySelectorAll('.status-change-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
        if (!expanded) {
          btn.setAttribute('aria-expanded', 'true');
          btn.parentElement.querySelector('.status-menu').classList.add('open');
        }
        e.stopPropagation();
        return;
      }
      if (option) {
        const id = option.closest('.status-wrapper').querySelector('.status-change-btn').dataset.id;
        const newStatus = option.dataset.status;
        const booking = MOCK_DATA.bookings.find(b => (b._id || b.id) == id);
        if (!booking || ['completed','cancelled'].includes(booking.status)) {
          UIComponents?.showToast?.('نوبت انجام‌شده یا لغو شده قابل تغییر نیست', 'warning');
          e.stopPropagation();
          return;
        }
        const prev = booking.status;
        booking.status = newStatus;
        booking.cancelledBy = (newStatus === 'cancelled') ? 'seller' : undefined;
        persistBookings();
        delete bookedCache[booking.dateISO];
        const modal = document.getElementById('resv-modal');
        if (modal && !modal.hidden) renderTimes();

        const validId = /^[0-9a-fA-F]{24}$/.test(id);
        if (validId) {
          fetch(`${API_BASE}/api/seller-bookings/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: newStatus })
          })
            .then(r => {
              if (!r.ok) throw new Error('STATUS_UPDATE_FAILED');
              const faStatus = { confirmed: 'تایید شد', completed: 'انجام شد', cancelled: 'لغو شد' };
              UIComponents?.showToast?.(`وضعیت نوبت ${faStatus[newStatus] || newStatus}`, 'success');
              Notifications?.add(`نوبت ${booking.customerName} ${faStatus[newStatus] || newStatus}`, 'booking');
            })
            .catch(err => {
              console.error('UPDATE_BOOKING_STATUS_FAILED', err);
              booking.status = prev;
              persistBookings();
              UIComponents?.showToast?.('خطا در به‌روزرسانی وضعیت نوبت', 'error');
            });
        }
        self.renderBookings(self.currentBookingFilter || 'all');
        self.renderPlans && self.renderPlans();
        e.stopPropagation();
        return;
      }

      const card = e.target.closest('.booking-card');
      if (card && !e.target.closest('.booking-actions')) {
        const name = card.dataset.customerName;
        const customer = MOCK_DATA.customers.find(c => c.name === name);
        if (customer) {
          self.openCustomerModal(customer);
        }
      }

      listEl.querySelectorAll('.status-menu').forEach(m => m.classList.remove('open'));
      listEl.querySelectorAll('.status-change-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
    });

    listEl.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      const card = e.target.closest('.booking-card');
      if (!card) return;
      const name = card.dataset.customerName;
      const customer = MOCK_DATA.customers.find(c => c.name === name);
      if (customer) self.openCustomerModal(customer);
    });
    listEl.dataset.statusBound = 'true';
  }

  // آپدیت چیپ‌ها براساس وضعیت‌های effective
  const allCount = effective.length;
  const counts = {
    pending:   effective.filter(b => b.status === 'pending').length,
    confirmed: effective.filter(b => b.status === 'confirmed').length,
    completed: effective.filter(b => b.status === 'completed').length,
    cancelled: effective.filter(b => b.status === 'cancelled').length
  };
  const setText = (sel, val) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = UIComponents.formatPersianNumber(val);
  };
  setText('.filter-chip[data-filter="all"] .chip-badge', allCount);
  setText('.filter-chip[data-filter="pending"] .chip-badge', counts.pending);
  setText('.filter-chip[data-filter="confirmed"] .chip-badge', counts.confirmed);
  setText('.filter-chip[data-filter="completed"] .chip-badge', counts.completed);
  setText('.filter-chip[data-filter="cancelled"] .chip-badge', counts.cancelled);
  this.updateDashboardStats();
  window.updateResvDayIndicators && window.updateResvDayIndicators();
}

  




    async renderReviews(filter = 'all') {
  const listEl = document.getElementById('reviews-list');

  if (!this._reviewsLoaded) {
    try {
      const seller = JSON.parse(localStorage.getItem('seller') || '{}');
      const sellerId = seller.id || seller._id;

      const pendingReq = fetch(bust(`${API_BASE}/api/shopAppearance/reviews/pending`), { credentials: 'include', ...NO_CACHE });
      const approvedReq = sellerId
        ? fetch(bust(`${API_BASE}/api/shopAppearance/${sellerId}/reviews`), { credentials: 'include', ...NO_CACHE })
        : null;

      const [pendingRes, approvedRes] = await Promise.all([pendingReq, approvedReq]);

      const pending = pendingRes?.ok ? await pendingRes.json() : [];
      const approved = approvedRes?.ok ? await approvedRes.json() : [];

      const mapReview = rv => ({
        id: rv._id,
        customerName: rv.userName || 'کاربر',
        rating: rv.score,
        date: new Date(rv.createdAt).toLocaleDateString('fa-IR'),
        comment: rv.comment,
        status: rv.approved ? 'approved' : 'pending'
      });

      const mappedPending = Array.isArray(pending) ? pending.map(mapReview) : [];
      const mappedApproved = Array.isArray(approved)
        ? approved.map(rv => ({ ...mapReview(rv), status: 'approved' }))
        : [];

      MOCK_DATA.reviews = [...mappedPending, ...mappedApproved];
    } catch (err) {
      console.error('load reviews failed', err);
      MOCK_DATA.reviews = [];
    }
    this._reviewsLoaded = true;
  }

  let filteredReviews = MOCK_DATA.reviews;

  if (filter !== 'all') {
    if (filter === '1') {
      filteredReviews = MOCK_DATA.reviews.filter(r => r.rating <= 2);
    } else {
      const rating = parseInt(filter);
      filteredReviews = MOCK_DATA.reviews.filter(r => r.rating === rating);
    }
  }

  if (filteredReviews.length === 0) {
    listEl.innerHTML = `<p>نظری با این امتیاز یافت نشد.</p>`;
    return;
  }

  listEl.innerHTML = filteredReviews.map(review => {
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    return `
      <article class="review-card card" role="listitem" data-id="${review.id}">
        <div class="review-header">
          <div>
            <div class="review-customer">${review.customerName}</div>
            <time class="review-date">${review.date}</time>
          </div>
          <div class="review-rating" aria-label="${review.rating} از 5 ستاره">
            ${stars}
          </div>
        </div>
        ${review.comment ? `<p class="review-comment">${review.comment}</p>` : ''}
        ${review.status === 'approved'
          ? `<div class="review-actions">
              <div class="review-status">تایید شده</div>
              <button type="button" class="btn-danger btn-icon-text delete-review">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m3-3h8a1 1 0 011 1v2H8V4a1 1 0 011-1z"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                حذف
              </button>
            </div>`
          : `<div class="review-actions">
              <button type="button" class="btn-success btn-icon-text approve-review">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                تایید
              </button>
              <button type="button" class="btn-danger btn-icon-text delete-review">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m3-3h8a1 1 0 011 1v2H8V4a1 1 0 011-1z"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                حذف
              </button>
            </div>`}
      </article>
    `;
  }).join('');

  if (!listEl.dataset.reviewBound) {
    listEl.addEventListener('click', async (e) => {
      const approveBtn = e.target.closest('.approve-review');
      const deleteBtn = e.target.closest('.delete-review');
      if (approveBtn) {
        const card = approveBtn.closest('.review-card');
        const id = card.dataset.id;
        try {
          const res = await fetch(`${API_BASE}/api/shopAppearance/reviews/${id}/approve`, { method: 'PATCH', credentials: 'include' });
          if (!res.ok) throw new Error();
          const review = MOCK_DATA.reviews.find(r => r.id === id);
          if (review) review.status = 'approved';
          const actions = card.querySelector('.review-actions');
          if (actions) { actions.outerHTML = '<div class="review-status">تایید شده</div>'; }
          UIComponents.showToast('نظر تایید شد و در صفحه شما به نمایش در میاد', 'success');
        } catch (err) {
          UIComponents.showToast('تایید نظر ناموفق بود', 'error');
        }
        return;
      }
      if (deleteBtn) {
        const card = deleteBtn.closest('.review-card');
        const id = card.dataset.id;
        try {
          const res = await fetch(`${API_BASE}/api/shopAppearance/reviews/${id}`, { method: 'DELETE', credentials: 'include' });
          if (!res.ok) throw new Error();
          card.remove();
          MOCK_DATA.reviews = MOCK_DATA.reviews.filter(r => r.id !== id);
          UIComponents.showToast('نظر حذف شد', 'success');
        } catch (err) {
          UIComponents.showToast('حذف نظر ناموفق بود', 'error');
        }
        return;
      }
    });
    listEl.dataset.reviewBound = 'true';
  }
}


    renderPlans() {
      if (!this.isSellerPlansEnabled()) return;
      // Logic is handled by handlePlanDurationChange on load
    }
    // --- NEW: Settings Rendering Logic ---
    renderSettings() {
        // This function is now called when the settings view is active
        // It can be used to refresh data if needed, but initial render is done by initServices/initPortfolio
        this.renderServicesList();
        this.renderPortfolioList();
    }
    // --- Event Handlers ---

handlePlanDurationChange() {
    PlanCheckoutController.refresh();
}







    
    handleBookingFilterChange(e) {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      document.querySelectorAll('#bookings-view .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      this.renderBookings(chip.dataset.filter);
    }
    handleReviewFilterChange(e) {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      document.querySelectorAll('#reviews-view .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      this.renderReviews(chip.dataset.filter);
    }
    handleCustomerFilterChange(e) {
      const btn = e.target.closest('.customer-filter');
      if (!btn) return;
      this.currentCustomerFilter = btn.dataset.filter || 'all';
      btn.parentElement?.querySelectorAll('.customer-filter').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      this.renderCustomers(this.currentCustomerQuery);
    }
    filterCustomers(query) {
      this.currentCustomerQuery = query;
      this.renderCustomers(query);
    }
    initSidebarObserver() {
      if (window.innerWidth < 1024 || !this.appNav) return;
      this.appNav.addEventListener('mouseenter', () => this.body.classList.add('sidebar-expanded'));
      this.appNav.addEventListener('mouseleave', () => this.body.classList.remove('sidebar-expanded'));
    }
    // --- Utilities ---
    debounce(func, delay) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
      };
    }

    // === NEW: Service Management Methods ===
// ==== REPLACE: initServices (fetch from API, fallback to local) ====
// ==== REPLACE: initServices (fetch from API, fallback to local) ====
async initServices() {
  const container = document.getElementById('services-list');
  if (container) {
    container.innerHTML = `
      <div class="loading-inline" style="opacity:.8; font-size:.9rem; padding:.75rem;">
        در حال بارگذاری خدمات…
      </div>`;
  }

  try {
    // 1) تلاش برای دریافت از سرور
    const services = await API.getServices();

    // 2) کش محلی تا بخش‌های دیگر هم کار کنند
    StorageManager.set('vit_services', services);
  } catch (err) {
    console.warn('getServices failed; using local fallback', err);

    // اگر دیتای محلی نداریم، مقدار پیش‌فرض بذار
    if (!StorageManager.get('vit_services')) {
      const defaultServices = [
        { id: 1, title: 'اصلاح سر',   price: 150000, image: 'https://images.unsplash.com/photo-1598289222863-24d9027b1c39?w=300' },
        { id: 2, title: 'رنگ مو',     price: 450000, image: 'https://images.unsplash.com/photo-1562259949-b21f254d3a0d?w=300' },
        { id: 3, title: 'اصلاح ریش',  price: 80000,  image: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=300' }
      ];
      StorageManager.set('vit_services', defaultServices);
    }

    UIComponents.showToast('اتصال به سرور برقرار نشد؛ دادهٔ محلی نمایش داده شد.', 'error');
  }

  // 3) رندر لیست
  this.renderServicesList();
}
// ==== END REPLACE ====
    renderServicesList() {
        const services = StorageManager.get('vit_services') || [];
        const container = document.getElementById('services-list');
        if (!container) {
            return;
        }
        container.innerHTML = services.length === 0 ? '<p>هیچ خدمتی تعریف نشده است.</p>' : services.map(service => `
            <div class="item-card" data-id="${service.id}">
                <div class="item-card-header">
                    <h4 class="item-title">${service.title}</h4>
                </div>
                <div class="item-image-preview">
                    ${service.image ? `<img src="${service.image}" alt="${service.title}" onerror="this.parentElement.innerHTML='<span>تصویر نامعتبر</span>'">` : '<span>بدون تصویر</span>'}
                </div>
                <div class="item-details">
                    <span>قیمت: ${UIComponents.formatPersianNumber(service.price)} تومان</span>
                </div>
                <div class="item-actions">
                    <button type="button" class="btn-text-sm edit-service-btn" data-id="${service.id}" aria-label="ویرایش ${service.title}">ویرایش</button>
                    <button type="button" class="btn-text-sm delete-service-btn" data-id="${service.id}" aria-label="حذف ${service.title}">حذف</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners to the new buttons
        container.querySelectorAll('.edit-service-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const services = StorageManager.get('vit_services') || [];
                const service = services.find(s => String(s.id) === String(id));
                if (service) {
                    this.populateServiceForm(service);
                    UIComponents.openDrawer('service-drawer');
                }
            });
        });
        container.querySelectorAll('.delete-service-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.deleteService(id);
            });
        });
    }

    async handleSettingsFormSubmit() {
        const nameEl = document.getElementById('business-name');
        const phoneEl = document.getElementById('business-phone');
        const addressEl = document.getElementById('business-address');
        const startEl = document.getElementById('work-start');
        const endEl = document.getElementById('work-end');
        const data = JSON.parse(localStorage.getItem('seller') || '{}');

        if (nameEl) data.storename = nameEl.value.trim();
        if (phoneEl) data.phone = phoneEl.value.trim();
        if (addressEl) data.address = addressEl.value.trim();

        const start = normalizeTime(startEl?.value);
        const end = normalizeTime(endEl?.value);

        if (!start) {
            UIComponents.showToast('فرمت ساعت شروع نادرست است', 'error');
            return;
        }
        if (!end) {
            UIComponents.showToast('فرمت ساعت پایان نادرست است', 'error');
            return;
        }
        if (start >= end) {
            UIComponents.showToast('ساعت پایان باید بعد از شروع باشد', 'error');
            return;
        }

        data.startTime = start;
        data.endTime = end;

        localStorage.setItem('seller', JSON.stringify(data));

        const payload = {
            startTime: start || '',
            endTime: end || ''
        };

        try {
            const res = await fetch(`${API_BASE}/api/sellers/working-hours`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('FAILED');
        } catch (err) {
            UIComponents.showToast('خطا در ذخیره تنظیمات', 'error');
            return;
        }

        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setText('seller-shop-name', data.storename || '');
        setText('seller-phone', data.phone || '');
        setText('seller-address', data.address || '');

        UIComponents.showToast('تنظیمات ذخیره شد.', 'success');
    }

  populateServiceForm(service) {
        const form = document.getElementById('service-form');
        const titleEl = document.getElementById('service-drawer-title');
        if (service && service.id != null) {
            form.dataset.editingId = service.id;
            document.getElementById('service-id').value = service.id;
            document.getElementById('service-title').value = service.title;
            document.getElementById('service-price').value = service.price;
            this.currentServiceImage = service.image || '';
            document.getElementById('service-image').value = '';
            titleEl.textContent = 'ویرایش خدمت';
        } else {
            delete form.dataset.editingId;
            form.reset();
            document.getElementById('service-id').value = '';
            this.currentServiceImage = '';
            titleEl.textContent = 'افزودن خدمت جدید';
        }
    }
// ==== REPLACE: handleServiceFormSubmit (write-through to API) ====
// ==== REPLACE: handleServiceFormSubmit (write-through to API) ====
async handleServiceFormSubmit() {
  const form = document.getElementById('service-form');
  const rawId = form.dataset.editingId;
  const id = rawId && rawId !== 'undefined' && rawId !== 'null' && rawId !== '' ? rawId : null;

  const title = document.getElementById('service-title').value.trim();
  const price = parseFloat(document.getElementById('service-price').value);

  const fileInput = document.getElementById('service-image');
  let imageData = this.currentServiceImage;
  const file = fileInput.files && fileInput.files[0];
  if (file) {
    imageData = await this.fileToDataURL(file);
  }

  if (!title || Number.isNaN(price)) {
    UIComponents.showToast('لطفاً عنوان و قیمت معتبر وارد کنید.', 'error');
    return;
  }

  // Get seller data for additional required fields
  const sellerData = JSON.parse(localStorage.getItem('seller') || '{}');
  
  // Build payload matching backend expectations
  const payload = {
    title: title,
    price: price,
    images: imageData ? [imageData] : [], // Backend expects array
    desc: title, // Backend expects 'desc' not 'description'
    category: sellerData.category || 'خدمات',
    durationMinutes: 60, // Backend expects 'durationMinutes' not 'duration'
    isActive: true
  };

  console.log('Service payload being sent:', payload); // Debug log

  let services = StorageManager.get('vit_services') || [];
  UIComponents.showToast(id ? 'در حال ذخیره تغییرات…' : 'در حال افزودن خدمت…', 'info', 2500);

  try {
    if (!API || typeof API.getServices !== 'function') {
      throw new Error('API adapter missing');
    }

    let saved;
    if (id) {
      saved = await API.updateService({ id, ...payload });
      const idx = services.findIndex(s => String(s.id) === String(id));
      if (idx !== -1) services[idx] = { ...services[idx], ...saved };
    } else {
      saved = await API.createService(payload);
      services.push(saved);
    }

    StorageManager.set('vit_services', services);
    this.renderServicesList();
    UIComponents.closeDrawer('service-drawer');
    UIComponents.showToast('با موفقیت ذخیره شد.', 'success');

  } catch (err) {
    console.error('service save failed', err);
    
    // More detailed error handling
    let errorMessage = 'خطا در ذخیره روی سرور';
    if (err.message.includes('عنوان')) {
      errorMessage = 'عنوان خدمت الزامی است';
    } else if (err.message.includes('قیمت')) {
      errorMessage = 'قیمت معتبر وارد کنید';
    }
    UIComponents.showToast(errorMessage + '. دوباره تلاش کنید.', 'error');
  }
}

// ==== REPLACE: deleteService (API + optimistic rollback) ====
// ==== REPLACE: deleteService (API + optimistic rollback) ====
async deleteService(id) {
  if (!confirm('آیا از حذف این خدمت مطمئن هستید؟')) return;

  // وضعیت فعلی (برای رول‌بک در صورت خطا)
  const before = StorageManager.get('vit_services') || [];
  const after  = before.filter(s => String(s.id) !== String(id));

  // حذف خوش‌بینانه از UI
  StorageManager.set('vit_services', after);
  this.renderServicesList();

  try {
    if (!API || typeof API.deleteService !== 'function') {
      throw new Error('API adapter missing');
    }
    await API.deleteService(id);
    UIComponents.showToast('خدمت حذف شد.', 'success');
  } catch (err) {
    console.error('deleteService failed', err);
    // بازگشت در صورت خطا
    StorageManager.set('vit_services', before);
    this.renderServicesList();
    UIComponents.showToast('حذف در سرور انجام نشد؛ تغییرات برگشت داده شد.', 'error');
  }
}

    // === NEW: Portfolio Management Methods ===
async initPortfolio() {
        const container = document.getElementById('portfolio-list');
        if (container) {
            container.innerHTML = `
                <div class="loading-inline" style="opacity:.8; font-size:.9rem; padding:.75rem;">
                    در حال بارگذاری نمونه‌کارها…
                </div>`;
        }

        try {
            // Try to fetch from server
            const items = await API.getPortfolio();
            StorageManager.set('vit_portfolio', items);
        } catch (err) {
            console.warn('getPortfolio failed; using local fallback:', err?.message);

            // Fallback to local storage
            if (!StorageManager.get('vit_portfolio')) {
                const defaultPortfolio = [
                    { id: 1, title: 'موی کوتاه', image: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=300', description: 'اصلاح سر مدرن' },
                    { id: 2, title: 'رنگ موی طبیعی', image: 'https://images.unsplash.com/photo-1564460576323-2f03bbfbfe2d?w=300', description: 'رنگ طبیعی و درخشان' },
                    { id: 3, title: 'اصلاح ریش فانتزی', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300', description: 'طراحی ریش متنوع' }
                ];
                StorageManager.set('vit_portfolio', defaultPortfolio);
            }

            if (container) {
                UIComponents.showToast('اتصال به سرور برقرار نشد؛ دادهٔ محلی نمایش داده شد.', 'error');
            }
        }

        this.renderPortfolioList();
    }
    renderPortfolioList() {
        const portfolio = StorageManager.get('vit_portfolio') || [];
        const container = document.getElementById('portfolio-list');
        if (!container) return;
        container.innerHTML = portfolio.length === 0 ? '<p>هیچ نمونه‌کاری ثبت نشده است.</p>' : portfolio.map(item => `
            <div class="item-card" data-id="${item.id}">
                <div class="item-card-header">
                    <h4 class="item-title">${item.title}</h4>
                </div>
                <div class="item-image-preview">
                    ${item.image ? `<img src="${item.image}" alt="${item.title}" onerror="this.parentElement.innerHTML='<span>تصویر نامعتبر</span>'">` : '<span>تصویر ناموجود</span>'}
                </div>
                <div class="item-details">
                    <p>${item.description || '-'}</p>
                </div>
                <div class="item-actions">
                    <button type="button" class="btn-text-sm edit-portfolio-btn" data-id="${item.id}" aria-label="ویرایش ${item.title}">ویرایش</button>
                    <button type="button" class="btn-text-sm delete-portfolio-btn" data-id="${item.id}" aria-label="حذف ${item.title}">حذف</button>
                </div>
            </div>
        `).join('');

        // Add event listeners to the new buttons
        container.querySelectorAll('.edit-portfolio-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id, 10);
                const portfolio = StorageManager.get('vit_portfolio') || [];
                const item = portfolio.find(p => p.id === id);
                if (item) {
                    this.populatePortfolioForm(item);
                    UIComponents.openDrawer('portfolio-drawer');
                }
            });
        });
        container.querySelectorAll('.delete-portfolio-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id, 10);
                this.deletePortfolioItem(id);
            });
        });
    }
    updatePortfolioPreview(imageSrc) {
        const preview = document.getElementById('portfolio-image-preview');
        if (!preview) return;

        preview.innerHTML = '';

        if (imageSrc) {
            const img = document.createElement('img');
            img.src = imageSrc;
            img.alt = 'پیش‌نمایش تصویر نمونه‌کار';
            preview.appendChild(img);
            preview.classList.remove('is-empty');
        } else {
            const placeholder = document.createElement('span');
            placeholder.textContent = 'پس از انتخاب، پیش‌نمایش تصویر اینجا نمایش داده می‌شود.';
            preview.appendChild(placeholder);
            preview.classList.add('is-empty');
        }
    }
    populatePortfolioForm(item) {
        const form = document.getElementById('portfolio-form');
        const titleEl = document.getElementById('portfolio-drawer-title');
        if (item) {
            form.dataset.editingId = item.id;
            document.getElementById('portfolio-id').value = item.id;
            document.getElementById('portfolio-title').value = item.title;
            this.currentPortfolioImage = item.image || '';
            document.getElementById('portfolio-image').value = '';
            document.getElementById('portfolio-description').value = item.description || '';
            titleEl.textContent = 'ویرایش نمونه‌کار';
        } else {
            delete form.dataset.editingId;
            form.reset();
            document.getElementById('portfolio-id').value = '';
            this.currentPortfolioImage = '';
            titleEl.textContent = 'افزودن نمونه‌کار جدید';
        }
        this.updatePortfolioPreview(this.currentPortfolioImage);
    }
async handlePortfolioFormSubmit() {
        const form = document.getElementById('portfolio-form');
        const id = form.dataset.editingId ? form.dataset.editingId : null;
        const title = document.getElementById('portfolio-title').value.trim();
        const description = document.getElementById('portfolio-description').value.trim();
        const fileInput = document.getElementById('portfolio-image');
        let imageData = this.currentPortfolioImage;
        const file = fileInput.files[0];
        if (file) {
            imageData = await this.fileToDataURL(file);
        }

        if (!title || !imageData) {
            UIComponents.showToast('لطفاً عنوان و تصویر را وارد کنید.', 'error');
            return;
        }

        let portfolio = StorageManager.get('vit_portfolio') || [];
        UIComponents.showToast(id ? 'در حال ذخیره تغییرات…' : 'در حال افزودن نمونه‌کار…', 'info', 2500);

        try {
            if (!API || typeof API.getPortfolio !== 'function') {
                throw new Error('API adapter missing');
            }

            let saved;
            const payload = { title, description, image: imageData };
            
            if (id) {
                // Find if this is a real DB id or local id
                const existing = portfolio.find(p => p.id === id);
                const dbId = existing?._id || existing?.id;
                
                saved = await API.updatePortfolioItem(dbId, payload);
                const index = portfolio.findIndex(p => p.id === id || p._id === dbId);
                if (index !== -1) {
                    portfolio[index] = { ...portfolio[index], ...saved };
                }
            } else {
                saved = await API.createPortfolioItem(payload);
                portfolio.push(saved);
            }

            StorageManager.set('vit_portfolio', portfolio);
            this.renderPortfolioList();
            UIComponents.closeDrawer('portfolio-drawer');
            UIComponents.showToast('نمونه‌کار با موفقیت ذخیره شد.', 'success');

        } catch (err) {
            console.error('portfolio save failed', err);
            
            // Fallback to local storage only
            if (id) {
                const index = portfolio.findIndex(p => p.id === id);
                if (index !== -1) {
                    portfolio[index] = { id, title, image: imageData, description };
                    UIComponents.showToast('نمونه‌کار ویرایش شد (محلی).', 'success');
                }
            } else {
                const newId = portfolio.length > 0 ? Math.max(...portfolio.map(p => p.id || 0)) + 1 : 1;
                portfolio.push({ id: newId, title, image: imageData, description });
                UIComponents.showToast('نمونه‌کار اضافه شد (محلی).', 'success');
            }
            
            StorageManager.set('vit_portfolio', portfolio);
            this.renderPortfolioList();
            UIComponents.closeDrawer('portfolio-drawer');
        }
    }
    deletePortfolioItem(id) {
        if (!confirm('آیا از حذف این نمونه‌کار مطمئن هستید؟')) return;
        let portfolio = StorageManager.get('vit_portfolio') || [];
        portfolio = portfolio.filter(p => p.id !== id);
        StorageManager.set('vit_portfolio', portfolio);
        this.renderPortfolioList();
        UIComponents.showToast('نمونه‌کار حذف شد.', 'success');
    }

    fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject();
            reader.readAsDataURL(file);
        });
    }

    // === NEW: VIP Settings Methods ===
    initVipSettings() {
        const data = StorageManager.get('vit_vip_settings') || {};
        const requiredEl = document.getElementById('vip-required');
        const rewardEl = document.getElementById('vip-reward');
        if (requiredEl) requiredEl.value = data.required || '';
        if (rewardEl) rewardEl.value = data.reward || '';
    }
    handleVipFormSubmit() {
        const required = parseInt(document.getElementById('vip-required').value, 10) || 0;
        const reward = document.getElementById('vip-reward').value.trim();
        StorageManager.set('vit_vip_settings', { required, reward });
        UIComponents.showToast('تنظیمات ذخیره شد.', 'success');
        UIComponents.closeModal('vip-modal');
    }



// === BRAND IMAGE (footer only) ===
initBrandImages(){
  this.brandImages = { footer: '' };
  this.loadFooterImage();
  this.bindFooterImageEvents();
}

async loadFooterImage(){
  try {
    const res = await fetch(bust(`${API_BASE}/api/branding/footer`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (!res.ok) return;
    const data = await res.json();
    this.brandImages.footer = data.url || '';
    this.applyBrandImages();
  } catch (err) {
    console.error('load footer image failed', err);
  }
}




// === CUSTOMER MODAL FEATURES ===
initCustomerFeatures() {
  // Binds click/keyboard handlers for customer cards
  this.initCustomerClickHandlers();
}




// Initialize customer click handlers
  initCustomerClickHandlers() {
    // Use event delegation for customer cards
    const customersList = document.getElementById('customers-list');
    if (customersList) {
      customersList.addEventListener('click', (e) => {
        const cancelBtn = e.target.closest('[data-action="cancel-discount"]');
        if (cancelBtn) {
          this.handleDiscountCancellation(cancelBtn.dataset.id, {
            analyticsContext: false,
            customerContext: true
          });
          e.stopPropagation();
          return;
        }

        const excludeGlobalBtn = e.target.closest('[data-action="exclude-global-discount"]');
        if (excludeGlobalBtn) {
          this.excludeCustomerFromGlobal(excludeGlobalBtn.dataset.customerId);
          e.stopPropagation();
          return;
        }

        const restoreGlobalBtn = e.target.closest('[data-action="restore-global-discount"]');
        if (restoreGlobalBtn) {
          this.restoreCustomerGlobalDiscount(restoreGlobalBtn.dataset.customerId);
          e.stopPropagation();
          return;
        }

        const discountModalBtn = e.target.closest('[data-action="open-discount-modal"]');
        if (discountModalBtn) {
          this.openCustomerDiscountModal({
            id: discountModalBtn.dataset.customerId,
            name: discountModalBtn.dataset.customerName,
          phone: discountModalBtn.dataset.customerPhone
        });
        e.stopPropagation();
        return;
      }
      const card = e.target.closest('.customer-card');
      if (card) {
        this.showCustomerDetails(card);
      }
    });
  }
}

matchesCustomerFilter(customer = {}) {
  const bookings = Number(customer.bookingsCount ?? customer.vipCurrent ?? 0);
  const joinedAt = new Date(customer.joinedAt || customer.createdAt || customer.lastReservation || Date.now());
  const now = new Date();
  const daysSinceJoin = Math.floor((now - joinedAt) / 86400000);

  switch (this.currentCustomerFilter) {
    case 'recent':
      return daysSinceJoin <= 45;
    case 'loyal':
      return bookings >= 5;
    case 'most-bookings':
    case 'least-bookings':
      return true;
    default:
      return true;
  }
}

sortCustomersByFilter(customers = []) {
  if (this.currentCustomerFilter === 'most-bookings') {
    return [...customers].sort((a, b) => (Number(b.bookingsCount) || 0) - (Number(a.bookingsCount) || 0));
  }
  if (this.currentCustomerFilter === 'least-bookings') {
    return [...customers].sort((a, b) => (Number(a.bookingsCount) || 0) - (Number(b.bookingsCount) || 0));
  }
  return customers;
}

updateCustomerStats(customers = []) {
  const totalCustomers = customers.length;
  const totalBookings = customers.reduce((sum, c) => sum + (Number(c.bookingsCount) || 0), 0);
  const totalReviews = customers.reduce((sum, c) => sum + (Number(c.reviewCount ?? c.rewardCount) || 0), 0);
  const newThisMonth = customers.filter(c => {
    const joined = new Date(c.joinedAt || c.createdAt || c.lastReservation);
    if (Number.isNaN(joined.getTime())) return false;
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    return joined >= oneMonthAgo;
  }).length;

  this.setText('customer-total-count', this.formatNumber(totalCustomers));
  this.setText('customer-visit-count', this.formatNumber(totalBookings));
  this.setText('customer-review-count', this.formatNumber(totalReviews));
  this.setText('customer-new-month', this.formatNumber(newThisMonth));
}

// Show customer details modal
showCustomerDetails(card) {
  // Extract customer data from card
  const customerName = card.querySelector('.customer-name').textContent;
  const customerPhone = card.querySelector('.customer-phone').textContent;
  const lastReservationText = card.querySelector('.customer-last-reservation').textContent;
  
  // Get customer ID (would come from data attribute in real app)
  const customerId = parseInt(card.dataset.customerId || Math.floor(Math.random() * 100));
  
  // Generate mock data for this customer
  const customerData = this.getCustomerData(customerId, customerName, customerPhone, lastReservationText);
  
  // Populate modal
  this.populateCustomerModal(customerData);
  
  // Show modal
  UIComponents.openModal('customer-details-modal');
}

// Get customer data (mock)
getCustomerData(id, name, phone, lastReservationText) {
  // In real app, this would fetch from API
  const totalReservations = Math.floor(Math.random() * 50) + 5;
  const completedReservations = Math.floor(totalReservations * 0.8);
  const cancellationCount = Math.floor(Math.random() * 5);

  // Mock last reservation
  const services = ['اصلاح سر', 'اصلاح ریش', 'رنگ مو', 'کراتینه', 'اصلاح ابرو'];
  const statuses = ['completed', 'confirmed', 'pending'];
  const rawDate = lastReservationText.replace('آخرین رزرو نوبت: ', '');
  const lastReservation = {
    date: UIComponents.formatRelativeDate(rawDate),
    service: services[Math.floor(Math.random() * services.length)],
    time: `${Math.floor(Math.random() * 8) + 10}:${Math.random() > 0.5 ? '00' : '30'}`,
    status: statuses[Math.floor(Math.random() * statuses.length)]
  };

  return {
    id,
    name,
    phone,
    totalReservations,
    completedReservations,
    cancellationCount,
    lastReservation
  };
}

// Populate customer modal with data
populateCustomerModal(data) {
  // Avatar
  const avatar = document.getElementById('customer-modal-avatar');
  avatar.textContent = data.name.charAt(0);
  
  // Header info
  document.getElementById('customer-modal-name').textContent = data.name;
  document.getElementById('customer-modal-phone').querySelector('span').textContent = data.phone;
  
  // Stats
  document.getElementById('customer-total-reservations').textContent = 
    UIComponents.formatPersianNumber(data.totalReservations);
  document.getElementById('customer-completed-reservations').textContent = 
    UIComponents.formatPersianNumber(data.completedReservations);
  document.getElementById('customer-cancel-count').textContent =
    UIComponents.formatPersianNumber(data.cancellationCount);
  
  // Last reservation
  document.getElementById('last-reservation-date').textContent = data.lastReservation.date;
  document.getElementById('last-reservation-service').textContent = data.lastReservation.service;
  document.getElementById('last-reservation-time').textContent = 
    `ساعت ${UIComponents.formatPersianNumber(data.lastReservation.time)}`;
  
  // Status badge
  const statusBadge = document.getElementById('last-reservation-status');
  statusBadge.className = `status-badge status-${data.lastReservation.status}`;
  const statusTexts = {
    'completed': 'انجام شده',
    'confirmed': 'تایید شده',
    'pending': 'در انتظار',
    'cancelled': data.lastReservation.cancelledBy === 'customer' ? 'لغو شده توسط مشتری' : 'لغو شده'
  };
  statusBadge.textContent = statusTexts[data.lastReservation.status];
  const actions = document.getElementById('last-reservation-actions');
  const confirmBtn = document.getElementById('confirm-reservation-btn');
  const cancelBtn = document.getElementById('cancel-reservation-btn');
  if (data.lastReservation.status === 'pending') {
    actions.hidden = false;
    confirmBtn.onclick = () => {
      data.lastReservation.status = 'confirmed';
      statusBadge.className = 'status-badge status-confirmed';
      statusBadge.textContent = statusTexts['confirmed'];
      actions.hidden = true;
      UIComponents.showToast('رزرو تایید شد', 'success');
      this.renderBookings && this.renderBookings();
    };
    cancelBtn.onclick = () => {
      data.lastReservation.status = 'cancelled';
      statusBadge.className = 'status-badge status-cancelled';
      statusBadge.textContent = statusTexts['cancelled'];
      actions.hidden = true;
      UIComponents.showToast('رزرو لغو شد', 'error');
      this.renderBookings && this.renderBookings();
    };
  } else {
    actions.hidden = true;
  }
}

// Override renderCustomers to add customer IDs
renderCustomers(query = '') {
  const listEl = document.getElementById('customers-list');
  if (!listEl) {
    console.warn('renderCustomers: element with id "customers-list" not found');
    return;
  }
  this.currentCustomerQuery = query;
  const normalizedQuery = (query || '').trim().toLowerCase();

  const filteredCustomers = MOCK_DATA.customers
    .filter(c =>
      c.name.toLowerCase().includes(normalizedQuery) ||
      (c.phone || '').includes(normalizedQuery)
    )
    .filter(c => this.matchesCustomerFilter(c));

  const orderedCustomers = this.sortCustomersByFilter(filteredCustomers);

  this.updateCustomerStats(MOCK_DATA.customers);

  if (orderedCustomers.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><p class="muted">مشتری با این مشخصات یافت نشد.</p></div>`;
    return;
  }

  const activeDiscounts = (this.discountStore?.getActive?.() || []).reduce((map, d) => {
    map.set(String(d.customerId), d);
    return map;
  }, new Map());

  const globalDiscount = activeDiscounts.get(this.GLOBAL_CUSTOMER_ID);

  listEl.innerHTML = orderedCustomers.map(c => {
    const lastReservation = UIComponents.formatRelativeDate(c.lastReservation);
    const joinedLabel = UIComponents.formatRelativeDate(c.joinedAt || c.lastReservation);
    const bookingsCount = this.formatNumber(c.bookingsCount ?? c.vipCurrent ?? 0);
    const reviewCount = this.formatNumber(c.reviewCount ?? c.rewardCount ?? 0);
    const tier = (c.bookingsCount ?? 0) >= 10 ? 'وفادار' : 'فعال';
    const personalDiscount = activeDiscounts.get(String(c.id));
    const isGlobalExcluded = this.isGlobalDiscountExcludedForCustomer(globalDiscount, c.id);
    const appliedGlobalDiscount = globalDiscount && !isGlobalExcluded ? globalDiscount : null;
    const discount = personalDiscount || appliedGlobalDiscount;
    const isGlobalDiscount = !!discount && (discount.isGlobal || discount.customerId === this.GLOBAL_CUSTOMER_ID);
    const hasDiscount = !!discount;
    const discountLabel = hasDiscount
      ? (isGlobalDiscount ? 'تخفیف همگانی' : 'تخفیف فعال')
      : (isGlobalExcluded ? 'تخفیف همگانی غیرفعال' : 'بدون تخفیف');
    const discountValue = hasDiscount
      ? (discount.type === 'percent'
        ? `${this.formatNumber(discount.amount)}٪`
        : `${this.formatNumber(discount.amount)} تومان`)
      : (isGlobalExcluded ? 'اعمال تخفیف همگانی برای این مشتری لغو شده است.' : 'بدون تخفیف فعال');
    const discountExpiry = hasDiscount
      ? (isGlobalDiscount
        ? `تخفیف همگانی${discount.expiresAt ? ` • ${UIComponents.formatRelativeDate(discount.expiresAt)}` : ''}`
        : `این کاربر تخفیف فعال دارد • ${UIComponents.formatRelativeDate(discount.expiresAt)}`)
      : (isGlobalExcluded ? 'تخفیف همگانی برای این مشتری غیرفعال است.' : 'تخفیفی برای این مشتری فعال نیست.');

    let discountCancelBlock = '';
    if (personalDiscount) {
      discountCancelBlock = `
        <div class="discount-control">
          <div>
            <p class="discount-control__title">لغو سریع تخفیف</p>
            <p class="discount-control__subtitle">اعتبار تا ${UIComponents.formatRelativeDate(discount.expiresAt)}</p>
          </div>
          <div class="discount-control__actions">
            <button type=\"button\" class=\"btn-ghost-sm btn-ghost-sm--danger\" data-action=\"cancel-discount\" data-id=\"${escapeHtml(discount.id)}\">لغو تخفیف</button>
          </div>
        </div>`;
    } else if (globalDiscount) {
      const actionBtn = isGlobalExcluded
        ? `<button type=\"button\" class=\"btn-ghost-sm\" data-action=\"restore-global-discount\" data-customer-id=\"${escapeHtml(c.id)}\">فعال‌سازی مجدد</button>`
        : `<button type=\"button\" class=\"btn-ghost-sm btn-ghost-sm--danger\" data-action=\"exclude-global-discount\" data-customer-id=\"${escapeHtml(c.id)}\">لغو برای این مشتری</button>`;
      const subtitle = isGlobalExcluded
        ? 'با فعال‌سازی مجدد، این مشتری هم تخفیف را دریافت می‌کند.'
        : `اعتبار تا ${UIComponents.formatRelativeDate(globalDiscount.expiresAt)}`;
      const title = isGlobalExcluded ? 'تخفیف همگانی متوقف شده' : 'تخفیف همگانی فعال است';

      discountCancelBlock = `
        <div class="discount-control ${isGlobalExcluded ? 'discount-control--muted' : ''}">
          <div>
            <p class="discount-control__title">${title}</p>
            <p class="discount-control__subtitle">${subtitle}</p>
          </div>
          <div class="discount-control__actions">
            ${actionBtn}
          </div>
        </div>`;
    }

    return `
      <article class="customer-card card"
               role="listitem" tabindex="0"
               data-name="${escapeHtml(c.name)}" data-phone="${escapeHtml(c.phone)}" data-user-id="${escapeHtml(c.id)}">
        <div class="customer-card__top">
          <div class="customer-avatar" aria-hidden="true">${escapeHtml(c.name.charAt(0))}</div>
          <div class="customer-info">
            <div class="customer-name-row">
              <div class="customer-name">${escapeHtml(c.name)}</div>
              <span class="customer-tier ${tier === 'وفادار' ? 'customer-tier--loyal' : 'customer-tier--active'}">${tier}</span>
            </div>
            <div class="customer-phone">${UIComponents.formatPersianNumber(c.phone)}</div>
            <div class="customer-tags">
              <span class="customer-chip customer-chip--join"><span class="chip-dot"></span>عضویت از ${joinedLabel || '—'}</span>
              <span class="customer-chip customer-chip--recent"><span class="chip-dot"></span>آخرین رزرو: ${lastReservation || '—'}</span>
            </div>
          </div>
          <div class="customer-actions">
            <button type="button" class="btn-secondary btn-exclusive-discount" data-action="open-discount-modal" data-customer-id="${escapeHtml(c.id)}" data-customer-name="${escapeHtml(c.name)}" data-customer-phone="${escapeHtml(c.phone)}">اهدای تخفیف اختصاصی</button>
          </div>
        </div>
        <div class="customer-card__stats">
          <div class="stat-chip">
            <span>رزرو</span>
            <strong>${bookingsCount}</strong>
          </div>
          <div class="stat-chip">
            <span>نظرات</span>
            <strong>${reviewCount}</strong>
          </div>
          <div class="stat-chip stat-chip--accent stat-chip--discount">
            <div class="discount-state">
              <span class="discount-pill ${hasDiscount ? 'is-active' : 'is-empty'}">${discountLabel}</span>
              <strong class="discount-value">${discountValue}</strong>
            </div>
            <p class="discount-meta">${discountExpiry}</p>
            <div class="discount-actions">
              <button type="button" class="link-btn" data-action="open-discount-modal" data-customer-id="${escapeHtml(c.id)}" data-customer-name="${escapeHtml(c.name)}" data-customer-phone="${escapeHtml(c.phone)}">${hasDiscount ? 'مدیریت تخفیف' : 'اهدای تخفیف'}</button>
            </div>
            ${discountCancelBlock}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

  initDiscountFeature() {
    this.discountForm = document.getElementById('discount-form');
    this.discountCustomerSelect = document.getElementById('discount-customer');
    this.discountAmountInput = document.getElementById('discount-amount');
    this.discountNoteInput = document.getElementById('discount-note');
    this.discountTypeInputs = this.discountForm?.querySelectorAll('input[name="discount-type"]') || [];
    this.discountExpiryInput = document.getElementById('discount-expiry');
    this.discountSuggestions = document.getElementById('discount-suggestions');
    this.discountListEl = document.getElementById('discounts-list');
    this.discountEmptyEl = document.getElementById('discounts-empty');

    this.discountModal = document.getElementById('discount-modal');
    this.discountModalForm = document.getElementById('discount-modal-form');
    this.discountModalName = document.getElementById('discount-modal-name');
    this.discountModalPhone = document.getElementById('discount-modal-phone');
    this.discountModalAvatar = document.getElementById('discount-modal-avatar');
    this.discountModalStatus = document.getElementById('discount-modal-status');
    this.discountModalSummary = document.getElementById('discount-modal-summary');
    this.discountModalAmount = document.getElementById('discount-modal-amount');
    this.discountModalNote = document.getElementById('discount-modal-note');
    this.discountModalHint = document.getElementById('discount-modal-hint');
    this.discountModalTypeInputs = this.discountModal?.querySelectorAll('input[name="discount-modal-type"]') || [];
    this.discountModalDurationInputs = this.discountModal?.querySelectorAll('input[name="discount-modal-duration"]') || [];
    this.discountModalCustomDateWrap = document.getElementById('discount-modal-custom-date');
    this.discountModalExpiryInput = document.getElementById('discount-modal-expiry');
    this.discountModalCustomerId = '';
    this.discountModalCustomerName = '';
    this.discountModalCustomerPhone = '';

    this.discountInsightsOpen = document.getElementById('discount-insights-open');
    this.discountInsightsUsage = document.getElementById('discount-insights-usage');
    this.discountInsightsNextExpiry = document.getElementById('discount-insights-next-expiry');

    this.discountAnalyticsModal = document.getElementById('discount-analytics-modal');
    this.discountAnalyticsList = document.getElementById('discount-analytics-list');
    this.discountAnalyticsEmpty = document.getElementById('discount-analytics-empty');
    this.discountAnalyticsUsage = document.getElementById('discount-analytics-usage');
    this.discountAnalyticsNextExpiry = document.getElementById('discount-analytics-next-expiry');
    this.discountAnalyticsExpiring = document.getElementById('discount-analytics-expiring');
    this.discountAnalyticsIssued = document.getElementById('discount-analytics-issued');
    this.discountAnalyticsActive = document.getElementById('discount-analytics-active');
    this.discountAnalyticsGlobal = document.getElementById('discount-analytics-global');
    this.discountAnalyticsPersonal = document.getElementById('discount-analytics-personal');

    this.discountQuickSearch = document.getElementById('discount-quick-search');
    this.discountQuickResults = document.getElementById('discount-quick-results');

    this.globalDiscountForm = document.getElementById('global-discount-form');
    this.globalDiscountAmount = document.getElementById('global-discount-amount');
    this.globalDiscountAmountField = document.getElementById('global-discount-amount-field');
    this.globalDiscountNoteInput = document.getElementById('global-discount-note');
    this.globalDiscountTypeInputs = this.globalDiscountForm?.querySelectorAll('input[name="global-discount-type"]') || [];
    this.globalDiscountDurationInputs = this.globalDiscountForm?.querySelectorAll('input[name="global-discount-duration"]') || [];
    this.globalDiscountStatus = document.getElementById('global-discount-status');
    this.globalDiscountClear = document.getElementById('global-discount-clear');
    this.globalDiscountCustomDate = document.getElementById('global-discount-custom-date');
    this.globalDiscountCustomDateWrap = document.getElementById('global-discount-custom-date-wrap');
    this.globalDiscountCouponInput = document.getElementById('global-discount-coupon');
    this.globalDiscountConfirmModal = document.getElementById('global-discount-confirm-modal');
    this.globalDiscountConfirmTitle = document.getElementById('global-discount-confirm-title');
    this.globalDiscountConfirmSubtitle = document.getElementById('global-discount-confirm-subtitle');
    this.globalDiscountConfirmDetails = document.getElementById('global-discount-confirm-details');
    this.globalDiscountConfirmAccept = document.getElementById('global-discount-confirm-accept');
    this.globalDiscountSuccess = document.getElementById('global-discount-success');
    this.globalDiscountSuccessAmount = document.getElementById('global-discount-success-amount');
    this.globalDiscountSuccessExpiry = document.getElementById('global-discount-success-expiry');
    this.globalDiscountSuccessNote = document.getElementById('global-discount-success-note');
    this.globalDiscountSuccessDescription = document.getElementById('global-discount-success-description');
    this.discountGuardModal = document.getElementById('discount-guard-modal');
    this.discountGuardAmount = document.getElementById('discount-guard-amount');
    this.discountGuardExpiry = document.getElementById('discount-guard-expiry');
    this.discountGuardNote = document.getElementById('discount-guard-note');
    this.discountGuardDescription = document.getElementById('discount-guard-description');
    this.discountGuardTitle = document.getElementById('discount-guard-title');
    this.discountGuardRemove = document.getElementById('discount-guard-remove');

    if (this.discountModalTypeInputs?.length) {
      this.discountModalTypeInputs.forEach(input => {
        input.addEventListener('change', () => {
          this.updateDiscountModalType(input.value);
        });
      });
    }

    if (this.discountModalDurationInputs?.length) {
      this.discountModalDurationInputs.forEach(input => {
        input.addEventListener('change', () => this.updateDiscountModalDuration(input.value));
      });
      const initialModalDuration = Array.from(this.discountModalDurationInputs).find(input => input.checked)?.value || 'week';
      this.updateDiscountModalDuration(initialModalDuration);
    }

    if (this.discountInsightsOpen) {
      this.discountInsightsOpen.addEventListener('click', () => this.openDiscountAnalyticsModal());
    }

    document.querySelectorAll('[data-dismiss="discount-analytics-modal"]').forEach(btn => {
      btn.addEventListener('click', () => UIComponents.closeModal('discount-analytics-modal'));
    });

    if (this.discountModalForm) {
      this.discountModalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitQuickDiscount();
      });
    }

    if (this.discountModalExpiryInput) {
      this.discountModalExpiryInput.addEventListener('input', (e) => {
        const input = e.target;
        const formatted = this.formatPersianDateMask(input.value);
        if (formatted !== input.value) {
          input.value = formatted;
          const cursorPos = formatted.length;
          input.setSelectionRange(cursorPos, cursorPos);
        }
      });
    }

    if (this.discountForm) {
      this.discountForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleDiscountSubmit();
      });
    }

    if (this.discountSuggestions) {
      this.discountSuggestions.addEventListener('click', (e) => {
        const btn = e.target.closest('.quick-customer');
        if (!btn) return;
        const customerId = btn.dataset.customerId;
        if (this.discountCustomerSelect) {
          this.discountCustomerSelect.value = customerId;
          this.discountCustomerSelect.dispatchEvent(new Event('change'));
        }
        const preset = btn.dataset.presetAmount;
        if (preset && this.discountAmountInput) {
          this.discountAmountInput.value = preset;
        }
      });
    }

    if (this.discountListEl) {
      this.discountListEl.addEventListener('click', (e) => {
        const cancelBtn = e.target.closest('[data-action="cancel-discount"]');
        if (cancelBtn) {
          this.handleDiscountCancellation(cancelBtn.dataset.id);
          this.renderCustomers(this.currentCustomerQuery || '');
        }
      });
    }

    if (this.discountAnalyticsList) {
      this.discountAnalyticsList.addEventListener('click', (e) => {
        const cancelBtn = e.target.closest('[data-action="cancel-discount"]');
        if (cancelBtn) {
          this.handleDiscountCancellation(cancelBtn.dataset.id, { analyticsContext: true });
          return;
        }

        const searchBtn = e.target.closest('[data-action="open-discount-modal"]');
        if (searchBtn) {
          this.openCustomerDiscountModal({
            id: searchBtn.dataset.customerId,
            name: searchBtn.dataset.customerName,
            phone: searchBtn.dataset.customerPhone
          });
        }

        const openGlobalConfirm = e.target.closest('[data-action="open-global-discount-confirm"]');
        if (openGlobalConfirm) {
          this.openGlobalDiscountConfirm();
        }
      });
    }

    if (this.discountQuickSearch) {
      this.discountQuickSearch.addEventListener('input', (e) => {
        this.renderQuickDiscountResults(e.target.value);
      });
    }

    if (this.discountQuickResults) {
      this.discountQuickResults.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="quick-discount"]');
        if (btn) {
          this.openCustomerDiscountModal({
            id: btn.dataset.customerId,
            name: btn.dataset.customerName,
            phone: btn.dataset.customerPhone
          });
        }
      });
    }

    if (this.globalDiscountForm) {
      this.globalDiscountForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleGlobalDiscountSubmit();
      });
    }

    if (this.globalDiscountClear) {
      this.globalDiscountClear.addEventListener('click', () => this.openGlobalDiscountConfirm());
    }

    if (this.globalDiscountSuccess) {
      this.globalDiscountSuccess.querySelectorAll('[data-dismiss="global-discount-success"]').forEach(btn => {
        btn.addEventListener('click', () => this.hideGlobalDiscountSuccess());
      });
    }

    if (this.discountGuardRemove) {
      this.discountGuardRemove.addEventListener('click', () => {
        UIComponents.closeModal('discount-guard-modal');
        this.openGlobalDiscountConfirm();
      });
    }

    if (this.globalDiscountConfirmAccept) {
      this.globalDiscountConfirmAccept.addEventListener('click', () => this.confirmClearGlobalDiscount());
    }

    if (this.globalDiscountTypeInputs?.length) {
      this.globalDiscountTypeInputs.forEach(input => {
        input.addEventListener('change', () => this.updateGlobalDiscountType(input.value));
      });
      const initialGlobalType = Array.from(this.globalDiscountTypeInputs).find(input => input.checked)?.value || 'amount';
      this.updateGlobalDiscountType(initialGlobalType);
    }

    if (this.globalDiscountDurationInputs?.length) {
      this.globalDiscountDurationInputs.forEach(input => {
        input.addEventListener('change', () => this.updateGlobalDurationState(input.value));
      });
      const initialDuration = Array.from(this.globalDiscountDurationInputs).find(input => input.checked)?.value || 'today';
      this.updateGlobalDurationState(initialDuration);
    }

    if (this.globalDiscountCustomDate) {
      this.globalDiscountCustomDate.addEventListener('input', (e) => {
        const input = e.target;
        const formatted = this.formatPersianDateMask(input.value);
        if (formatted !== input.value) {
          input.value = formatted;
          const cursorPos = formatted.length;
          input.setSelectionRange(cursorPos, cursorPos);
        }
      });
    }

    if (this.globalDiscountDurationInputs?.length) {
      this.globalDiscountDurationInputs.forEach(input => {
        input.addEventListener('change', () => this.updateGlobalDiscountStatus());
      });
    }

    document.addEventListener('customers:loaded', () => {
      this.refreshDiscountCustomers();
      this.renderDiscounts();
      this.renderQuickDiscountResults(this.discountQuickSearch?.value || '');
      this.updateGlobalDiscountStatus();
      this.updateDiscountAnalytics();
    });

    if (this.discountTypeInputs?.length) {
      this.discountTypeInputs.forEach(input => {
        input.addEventListener('change', () => {
          this.updateDiscountFieldType(input.value);
        });
      });
      const initialType = Array.from(this.discountTypeInputs).find(input => input.checked)?.value || 'amount';
      this.updateDiscountFieldType(initialType);
    }

    this.refreshDiscountCustomers();
    this.renderDiscounts();
    this.renderQuickDiscountResults('');
    this.updateGlobalDiscountStatus();
    this.updateDiscountAnalytics();
  }

  openCustomerDiscountModal(customer = {}) {
    if (this.getGlobalDiscount()) {
      this.showDiscountGuardModal('personal');
      return;
    }

    const fallback = this.getDiscountCustomers().find(c => String(c.id) === String(customer.id)) || {};
    const id = customer.id || fallback.id;
    if (!id) return;

    const name = customer.name || fallback.name || 'مشتری';
    const phone = customer.phone || fallback.phone || '';
    const activeDiscount = this.getActiveDiscountForCustomer(id);
    const typeToSelect = activeDiscount?.type || 'amount';
    const defaultDuration = 'week';

    this.discountModalCustomerId = id;
    this.discountModalCustomerName = name;
    this.discountModalCustomerPhone = phone;

    if (this.discountModalName) this.discountModalName.textContent = name;
    if (this.discountModalPhone) this.discountModalPhone.textContent = UIComponents.formatPersianNumber(phone || '');
    if (this.discountModalAvatar) this.discountModalAvatar.textContent = name.charAt(0);

    if (this.discountModalAmount) {
      this.discountModalAmount.value = activeDiscount?.amount || 5000;
      this.discountModalAmount.focus({ preventScroll: true });
    }

    const setChecked = (inputs, value) => {
      if (!inputs) return;
      inputs.forEach(input => {
        input.checked = input.value === value;
      });
    };
    const expiryInputValue = this.formatDateInputValue(activeDiscount?.expiresAt);
    const durationToSelect = activeDiscount?.expiresAt ? 'custom' : defaultDuration;

    setChecked(this.discountModalTypeInputs, typeToSelect);
    setChecked(this.discountModalDurationInputs, durationToSelect);

    if (this.discountModalExpiryInput) {
      this.discountModalExpiryInput.value = expiryInputValue;
    }

    this.updateDiscountModalType(typeToSelect);
    this.updateDiscountModalDuration(durationToSelect);

    if (this.discountModalNote) {
      this.discountModalNote.value = activeDiscount?.note || '';
    }

    if (this.discountModalStatus) {
      this.discountModalStatus.textContent = activeDiscount ? 'این مشتری تخفیف فعال دارد' : 'بدون تخفیف فعال';
      this.discountModalStatus.className = `discount-modal__badge ${activeDiscount ? 'is-active' : 'is-empty'}`;
    }

    if (this.discountModalSummary) {
      const summary = activeDiscount
        ? `${activeDiscount.type === 'percent' ? `${this.formatNumber(activeDiscount.amount)}٪` : `${this.formatNumber(activeDiscount.amount)} تومان`} • تا ${UIComponents.formatRelativeDate(activeDiscount.expiresAt)}`
        : 'هنوز هیچ تخفیفی به این مشتری اختصاص داده نشده است. با چند کلیک یک پیشنهاد جذاب بدهید.';
      this.discountModalSummary.textContent = summary;
    }

    if (this.discountModalHint) {
      this.discountModalHint.textContent = activeDiscount
        ? 'ثبت تخفیف جدید، تخفیف فعال فعلی را جایگزین می‌کند.'
        : 'پس از ثبت، مشتری یک تخفیف اختصاصی دریافت می‌کند.';
    }

    UIComponents.openModal('discount-modal');
  }

  updateDiscountModalType(type = 'amount') {
    const field = this.discountModal?.querySelector('.discount-modal__amount-field');
    const isPercent = type === 'percent';
    if (field) {
      field.dataset.icon = isPercent ? 'percent' : 'amount';
    }
    if (this.discountModalAmount) {
      this.discountModalAmount.placeholder = isPercent ? 'مثلاً ۲۰' : 'مثلاً ۵۰۰۰۰';
      this.discountModalAmount.step = isPercent ? '1' : '500';
      if (isPercent) {
        this.discountModalAmount.max = '90';
      } else {
        this.discountModalAmount.removeAttribute('max');
      }
    }
  }

  updateDiscountModalDuration(mode = 'week') {
    const showCustom = mode === 'custom';
    if (this.discountModalCustomDateWrap) {
      this.discountModalCustomDateWrap.hidden = !showCustom;
    }
    if (!showCustom && this.discountModalExpiryInput) {
      this.discountModalExpiryInput.value = '';
    }
  }

  updateDiscountFieldType(type = 'amount') {
    const field = this.discountForm?.querySelector('.discount-amount-field');
    const isPercent = type === 'percent';
    if (field) {
      field.dataset.icon = isPercent ? 'percent' : 'amount';
    }
    if (this.discountAmountInput) {
      this.discountAmountInput.placeholder = isPercent ? 'مثلاً ۲۰' : 'مثلاً ۵۰۰۰۰';
      this.discountAmountInput.step = isPercent ? '1' : '500';
      if (isPercent) {
        this.discountAmountInput.max = '90';
      } else {
        this.discountAmountInput.removeAttribute('max');
      }
    }
  }

  submitQuickDiscount() {
    if (this.getGlobalDiscount()) {
      this.showDiscountGuardModal('personal');
      return;
    }

    if (!this.discountModalCustomerId) {
      UIComponents.showToast('مشتری انتخاب نشده است.', 'error');
      return;
    }

    const type = Array.from(this.discountModalTypeInputs || []).find(input => input.checked)?.value || 'amount';
    const amount = Number(this.discountModalAmount?.value || 0);

    if (type === 'percent') {
      if (!Number.isFinite(amount) || amount <= 0 || amount > 90) {
        UIComponents.showToast('درصد تخفیف باید بین ۱ تا ۹۰ باشد.', 'error');
        return;
      }
    } else {
      if (!Number.isFinite(amount) || amount < 1000) {
        UIComponents.showToast('مبلغ تخفیف را حداقل با ۱۰۰۰ تومان وارد کنید.', 'error');
        return;
      }
    }

    const duration = Array.from(this.discountModalDurationInputs || []).find(input => input.checked)?.value || 'today';
    const manualExpiry = duration === 'custom' ? (this.discountModalExpiryInput?.value || '') : '';
    if (duration === 'custom' && !manualExpiry) {
      UIComponents.showToast('تاریخ انقضا را وارد کنید.', 'error');
      return;
    }
    const parsedCustomExpiry = duration === 'custom' ? this.parseDiscountDateInput(manualExpiry) : null;
    if (duration === 'custom' && !parsedCustomExpiry) {
      UIComponents.showToast('تاریخ واردشده معتبر نیست. لطفاً یک تاریخ شمسی مانند ۱۴۰۴/۰۸/۲۵ وارد کنید.', 'error');
      return;
    }
    const note = (this.discountModalNote?.value || '').trim();
    const expiresAt = duration === 'custom'
      ? (() => { const d = parsedCustomExpiry; d.setHours(23, 59, 0, 0); return d.toISOString(); })()
      : this.calculateDiscountExpiry(duration);

    const discount = {
      id: crypto.randomUUID ? crypto.randomUUID() : `disc-${Date.now()}`,
      customerId: this.discountModalCustomerId,
      customerName: this.discountModalCustomerName || 'مشتری',
      customerPhone: this.discountModalCustomerPhone || '',
      amount,
      type,
      createdAt: new Date().toISOString(),
      expiresAt,
      note: note || (manualExpiry ? this.formatCustomExpiryLabel(manualExpiry) : this.getDiscountDurationLabel(duration))
    };

    this.discountStore.upsert(discount);
    UIComponents.showToast('تخفیف برای مشتری ثبت شد.', 'success');
    UIComponents.closeModal('discount-modal');
    this.renderDiscounts();
    this.renderCustomers(this.currentCustomerQuery || '');
  }

  getActiveDiscountForCustomer(customerId) {
    if (!customerId) return null;
    const personal = (this.discountStore?.getActive() || []).find(d => String(d.customerId) === String(customerId));
    if (personal) return personal;
    const globalDiscount = this.getGlobalDiscount();
    if (this.isGlobalDiscountExcludedForCustomer(globalDiscount, customerId)) return null;
    return globalDiscount;
  }

  getDiscountCustomers() {
    const primarySource = Array.isArray(window.MOCK_DATA?.customers) && window.MOCK_DATA.customers.length
      ? window.MOCK_DATA.customers
      : (Array.isArray(window.customersData) ? window.customersData : []);

    if (primarySource.length) {
      return primarySource.map(c => ({
        id: String(c.id || c.userId || c._id),
        name: c.name || 'مشتری',
        phone: c.phone || c.phoneNumber || '',
        lastReservation: c.lastReservation || c.lastReservationAt || ''
      }));
    }

    return [
      { id: 'demo-1', name: 'مشتری وفادار', phone: '۰۹۱۲۱۲۳۴۵۶۷', lastReservation: '۱۴۰۳/۰۴/۲۲' },
      { id: 'demo-2', name: 'مشتری جدید', phone: '۰۹۳۵۴۴۴۴۴۴۴', lastReservation: 'دیروز' },
      { id: 'demo-3', name: 'مشتری نزدیک', phone: '۰۹۱۳۳۳۳۳۳۳۳', lastReservation: 'هفته جاری' }
    ];
  }

  refreshDiscountCustomers(selectedId = '') {
    if (!this.discountCustomerSelect) return;
    const customers = this.getDiscountCustomers();
    const placeholder = '<option value="" disabled selected>یک مشتری را انتخاب کنید</option>';
    this.discountCustomerSelect.innerHTML = placeholder + customers.map(c => `
      <option value="${c.id}">${escapeHtml(c.name)} • ${UIComponents.formatPersianNumber(c.phone || '')}</option>
    `).join('');

    if (selectedId) {
      this.discountCustomerSelect.value = selectedId;
    } else {
      this.discountCustomerSelect.selectedIndex = 0;
    }

    this.renderDiscountSuggestions(customers);
  }

  renderDiscountSuggestions(customers = []) {
    if (!this.discountSuggestions) return;
    const top = customers.slice(0, 3);
    if (!top.length) {
      this.discountSuggestions.innerHTML = '';
      return;
    }

    this.discountSuggestions.innerHTML = top.map(c => `
      <button type="button" class="quick-customer" data-customer-id="${c.id}" data-preset-amount="10000">
        <div class="avatar">${escapeHtml(c.name?.charAt(0) || 'م')}</div>
        <div>
          <strong>${escapeHtml(c.name || 'مشتری')}</strong>
          <small>${UIComponents.formatPersianNumber(c.phone || '')}</small>
        </div>
      </button>
    `).join('');
  }

  getSelectedDiscountDuration() {
    const selected = document.querySelector('input[name="discount-duration"]:checked');
    return selected ? selected.value : 'today';
  }

  getDiscountDurationLabel(mode) {
    switch (mode) {
      case 'custom': return 'انقضای دلخواه فروشنده';
      case '3d': return 'مهلت استفاده تا ۳ روز آینده';
      case 'week': return 'مهلت استفاده تا یک هفته';
      default: return 'مهلت تا پایان امروز';
    }
  }

  toPersianDigits(value = '') {
    const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(value).replace(/[0-9]/g, d => digits[Number(d)] ?? d);
  }

  normalizePersianDigits(value = '') {
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    return String(value)
      .replace(/[۰-۹]/g, d => persianDigits.indexOf(d))
      .replace(/[٠-٩]/g, d => arabicDigits.indexOf(d));
  }

  formatPersianDateMask(value = '') {
    const digitsOnly = this.normalizePersianDigits(value).replace(/\D/g, '').slice(0, 8);
    const year = digitsOnly.slice(0, 4);
    const month = digitsOnly.slice(4, 6);
    const day = digitsOnly.slice(6, 8);
    const parts = [];

    if (year) parts.push(year);
    if (month) parts.push(month);
    if (day) parts.push(day);

    return this.toPersianDigits(parts.join('/'));
  }

  jalaliToGregorian(jy, jm, jd) {
    jy += 1595;
    let days = -355668 + (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    let gy = 400 * Math.floor(days / 146097);
    days %= 146097;

    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524);
      days %= 36524;
      if (days >= 365) days++;
    }

    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      gy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }

    days += 1;
    const leap = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
    const monthDays = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm = 1;
    while (gm <= 12 && days > monthDays[gm]) {
      days -= monthDays[gm];
      gm++;
    }

    return { gy, gm, gd: days };
  }

  gregorianToJalali(gy, gm, gd) {
    const gDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let gy2 = gy - 1600;
    let gm2 = gm - 1;
    let gd2 = gd - 1;

    let gDayNo = 365 * gy2 + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400);
    gDayNo += gDays[gm2] + gd2;
    if (gm2 > 1 && ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0))) {
      gDayNo += 1;
    }

    let jDayNo = gDayNo - 79;
    const jNp = Math.floor(jDayNo / 12053);
    jDayNo %= 12053;

    let jy = 979 + 33 * jNp + 4 * Math.floor(jDayNo / 1461);
    jDayNo %= 1461;

    if (jDayNo >= 366) {
      jy += Math.floor((jDayNo - 1) / 365);
      jDayNo = (jDayNo - 1) % 365;
    }

    const jMonthDays = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
    let jm = 0;
    while (jm < 11 && jDayNo >= jMonthDays[jm]) {
      jDayNo -= jMonthDays[jm];
      jm += 1;
    }

    const jd = jDayNo + 1;
    return { jy, jm: jm + 1, jd };
  }

  isValidJalaliDate(jy, jm, jd) {
    if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return false;
    if (jy < 1300 || jy > 1499) return false;
    if (jm < 1 || jm > 12) return false;
    if (jd < 1 || jd > 31) return false;

    const gregorian = this.jalaliToGregorian(jy, jm, jd);
    const backToJalali = this.gregorianToJalali(gregorian.gy, gregorian.gm, gregorian.gd);
    return backToJalali.jy === jy && backToJalali.jm === jm && backToJalali.jd === jd;
  }

  parseDiscountDateInput(dateValue) {
    const normalized = this.normalizePersianDigits(dateValue).replace(/\s+/g, '');
    if (!normalized) return null;

    const jalaliMatch = normalized.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (!jalaliMatch) return null;

    const [, yearStr, monthStr, dayStr] = jalaliMatch;
    const y = Number(yearStr);
    const m = Number(monthStr);
    const d = Number(dayStr);
    const pad = (n) => String(n).padStart(2, '0');

    if (!this.isValidJalaliDate(y, m, d)) return null;

    const { gy, gm, gd } = this.jalaliToGregorian(y, m, d);
    const greg = new Date(`${gy}-${pad(gm)}-${pad(gd)}`);
    return Number.isNaN(greg.getTime()) ? null : greg;
  }

  formatCustomExpiryLabel(dateValue) {
    const parsed = this.parseDiscountDateInput(dateValue);
    if (!parsed) return 'انقضا بر اساس تاریخ واردشده';
    const fa = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed);
    return `انقضا تا ${fa}`;
  }

  calculateDiscountExpiry(duration) {
    const end = new Date();
    if (duration === '3d') {
      end.setDate(end.getDate() + 3);
    } else if (duration === 'week') {
      end.setDate(end.getDate() + 7);
    }
    end.setHours(23, 59, 0, 0);
    return end.toISOString();
  }

  normalizeExpiry(dateValue, fallbackDuration = 'today') {
    const parsed = this.parseDiscountDateInput(dateValue);
    if (!parsed) {
      return this.calculateDiscountExpiry(fallbackDuration);
    }
    parsed.setHours(23, 59, 0, 0);
    return parsed.toISOString();
  }

  formatDateInputValue(dateValue) {
    const parsed = dateValue ? new Date(dateValue) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return '';
    const offsetDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = formatter.formatToParts(offsetDate).reduce((acc, part) => {
      if (part.type === 'day') acc.day = part.value;
      if (part.type === 'month') acc.month = part.value;
      if (part.type === 'year') acc.year = part.value;
      return acc;
    }, { day: '', month: '', year: '' });
    const dayFirst = [parts.day, parts.month, parts.year].filter(Boolean).join('/');
    return dayFirst.replace(/\u200f/g, '');
  }

  formatToman(value) {
    const numeric = Math.max(0, Number(value) || 0);
    return `${new Intl.NumberFormat('fa-IR').format(numeric)} تومان`;
  }

  formatRemainingTime(expiresAt) {
    const end = new Date(expiresAt);
    if (!expiresAt || Number.isNaN(end.getTime())) return '';
    const diff = end.getTime() - Date.now();
    if (diff <= 0) return 'منقضی شده';
    const minutes = Math.round(diff / 60000);
    if (minutes < 60) {
      return `${UIComponents.formatPersianNumber(Math.max(1, minutes))} دقیقه باقی‌مانده`;
    }
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) {
      return `${UIComponents.formatPersianNumber(hours)} ساعت آینده`;
    }
    const days = Math.ceil(hours / 24);
    return `${UIComponents.formatPersianNumber(days)} روز آینده`;
  }

  renderQuickDiscountResults(query = '') {
    if (!this.discountQuickResults) return;
    const customers = this.getDiscountCustomers();
    const cleaned = normalizeKeyPart(query);
    const matches = cleaned
      ? customers.filter(c => {
          const nameKey = normalizeKeyPart(c.name || '');
          const phoneKey = normalizeKeyPart(c.phone || '');
          return nameKey.includes(cleaned) || phoneKey.includes(cleaned.replace(/[^\d]/g, ''));
        })
      : customers.slice(0, 4);

    if (!matches.length) {
      this.discountQuickResults.innerHTML = '<div class="discount-quick-empty">مشتری با این مشخصات پیدا نشد.</div>';
      return;
    }

    const maxItems = 5;
    this.discountQuickResults.innerHTML = matches.slice(0, maxItems).map((c) => `
      <div class="discount-quick-result" role="listitem">
        <div class="discount-quick-result__meta">
          <strong>${escapeHtml(c.name || 'مشتری')}</strong>
          <small>${UIComponents.formatPersianNumber(c.phone || '')}</small>
          <small>${c.lastReservation ? `آخرین مراجعه: ${UIComponents.formatRelativeDate(c.lastReservation)}` : 'بدون تاریخ رزرو'}</small>
        </div>
        <button type="button" class="btn-secondary" data-action="quick-discount" data-customer-id="${escapeHtml(c.id)}" data-customer-name="${escapeHtml(c.name)}" data-customer-phone="${escapeHtml(c.phone)}">
          تخفیف فوری
        </button>
      </div>
    `).join('');
  }

  updateGlobalDiscountType(type = 'amount') {
    if (this.globalDiscountAmountField) {
      this.globalDiscountAmountField.dataset.icon = type === 'percent' ? 'percent' : 'amount';
    }
    if (this.globalDiscountAmount) {
      this.globalDiscountAmount.placeholder = type === 'percent' ? 'مثلاً ۱۰' : 'مثلاً ۲۰٬۰۰۰';
    }
  }

  updateGlobalDurationState(duration = 'today') {
    if (!this.globalDiscountCustomDateWrap) return;
    const isCustom = duration === 'custom';
    this.globalDiscountCustomDateWrap.classList.toggle('is-active', isCustom);
    if (isCustom && this.globalDiscountCustomDate && !this.globalDiscountCustomDate.value) {
      const base = new Date();
      base.setDate(base.getDate() + 3);
      const faDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(base);
      this.globalDiscountCustomDate.placeholder = faDate;
    }
  }

  isGlobalDiscountExcludedForCustomer(globalDiscount, customerId) {
    if (!globalDiscount || !customerId) return false;
    const exclusions = Array.isArray(globalDiscount.excludedCustomerIds) ? globalDiscount.excludedCustomerIds : [];
    return exclusions.map(String).includes(String(customerId));
  }

  getGlobalDiscount() {
    return (this.discountStore?.getActive() || []).find(d =>
      d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID || d.id === this.GLOBAL_DISCOUNT_ID
    ) || null;
  }

  showDiscountGuardModal(mode = 'personal') {
    const active = this.getGlobalDiscount();
    if (!active) return false;

    const amountLabel = active.type === 'percent'
      ? `${this.formatNumber(active.amount, { fractionDigits: 0 })}٪`
      : `${this.formatNumber(active.amount, { fractionDigits: 0 })} تومان`;
    const expiryRelative = active.expiresAt ? this.formatRemainingTime(active.expiresAt) : '';
    const expiryLabel = active.expiresAt
      ? (expiryRelative || `اعتبار تا ${UIComponents.formatRelativeDate(active.expiresAt)}`)
      : 'بدون زمان انقضا';

    if (this.discountGuardAmount) {
      this.discountGuardAmount.textContent = `تخفیف فعال: ${amountLabel}`;
    }
    if (this.discountGuardExpiry) {
      this.discountGuardExpiry.textContent = expiryRelative ? `انقضا: ${expiryRelative}` : expiryLabel;
    }
    if (this.discountGuardNote) {
      this.discountGuardNote.textContent = 'برای ثبت تخفیف جدید، ابتدا تخفیف همگانی فعلی را حذف کنید.';
    }

    const description = mode === 'global'
      ? 'تا زمانی که تخفیف همگانی فعلی فعال است نمی‌توانید تخفیف همگانی جدیدی ثبت کنید.'
      : 'تا زمانی که تخفیف همگانی فعال است امکان ثبت تخفیف اختصاصی برای مشتریان وجود ندارد.';
    const title = 'تخفیف همگانی فعال است';

    if (this.discountGuardDescription) this.discountGuardDescription.textContent = description;
    if (this.discountGuardTitle) this.discountGuardTitle.textContent = title;

    UIComponents.openModal('discount-guard-modal');
    return true;
  }

  updateGlobalDiscountStatus() {
    if (!this.globalDiscountStatus) return;
    const active = this.getGlobalDiscount();
    if (!active) {
      this.globalDiscountStatus.textContent = '';
      this.globalDiscountStatus.classList.remove('is-active', 'is-visible');
      return;
    }

    const value = active.type === 'percent'
      ? `${this.formatNumber(active.amount, { fractionDigits: 0 })}٪`
      : `${this.formatNumber(active.amount, { fractionDigits: 0 })} تومان`;
    const time = this.formatRemainingTime(active.expiresAt);
    const excludedCount = Array.isArray(active.excludedCustomerIds) ? active.excludedCustomerIds.length : 0;
    const excludedLabel = excludedCount ? ` • لغو برای ${this.formatNumber(excludedCount)} مشتری` : '';
    this.globalDiscountStatus.textContent = `فعال (${value}${time ? ` • ${time}` : ''}${excludedLabel})`;
    this.globalDiscountStatus.classList.add('is-active', 'is-visible');
  }

  excludeCustomerFromGlobal(customerId) {
    const active = this.getGlobalDiscount();
    if (!active || !customerId) {
      UIComponents.showToast('تخفیف همگانی فعالی یافت نشد.', 'warning');
      return;
    }

    const exclusions = new Set((active.excludedCustomerIds || []).map(String));
    exclusions.add(String(customerId));

    this.discountStore.upsert({ ...active, excludedCustomerIds: Array.from(exclusions) });
    UIComponents.showToast('تخفیف همگانی برای این مشتری غیرفعال شد.', 'info');
    this.updateGlobalDiscountStatus();
    this.renderCustomers(this.currentCustomerQuery || '');
    this.renderDiscounts();
    this.updateDiscountAnalytics();
  }

  restoreCustomerGlobalDiscount(customerId) {
    const active = this.getGlobalDiscount();
    if (!active || !customerId) {
      UIComponents.showToast('تخفیف همگانی فعالی یافت نشد.', 'warning');
      return;
    }

    const exclusions = new Set((active.excludedCustomerIds || []).map(String));
    exclusions.delete(String(customerId));

    this.discountStore.upsert({ ...active, excludedCustomerIds: Array.from(exclusions) });
    UIComponents.showToast('تخفیف همگانی برای این مشتری دوباره فعال شد.', 'success');
    this.updateGlobalDiscountStatus();
    this.renderCustomers(this.currentCustomerQuery || '');
    this.renderDiscounts();
    this.updateDiscountAnalytics();
  }

  hideGlobalDiscountSuccess() {
    if (!this.globalDiscountSuccess) return;
    this.globalDiscountSuccess.classList.remove('is-visible');
    clearTimeout(this.globalDiscountSuccessTimer);
    this.globalDiscountSuccessTimer = setTimeout(() => {
      if (this.globalDiscountSuccess) this.globalDiscountSuccess.hidden = true;
    }, 200);
  }

  showGlobalDiscountSuccess(discount) {
    if (!this.globalDiscountSuccess) return;
    const amountLabel = discount.type === 'percent'
      ? `${this.formatNumber(discount.amount, { fractionDigits: 0 })}٪`
      : `${this.formatNumber(discount.amount, { fractionDigits: 0 })} تومان`;
    const expiryRelative = discount.expiresAt ? this.formatRemainingTime(discount.expiresAt) : '';
    const expiryLabel = expiryRelative
      ? `اعتبار: ${expiryRelative}`
      : (discount.expiresAt ? `اعتبار تا ${UIComponents.formatRelativeDate(discount.expiresAt)}` : 'بدون زمان انقضا');
    const noteLabel = discount.note || 'پیشنهاد فعال برای همه مشتریان ثبت شد.';
    const descLabel = discount.couponCode
      ? `کد ${discount.couponCode} برای همه مشتریان فعال شد.`
      : 'پیشنهاد شما برای همه مشتریان ثبت شد.';

    if (this.globalDiscountSuccessAmount) this.globalDiscountSuccessAmount.textContent = amountLabel;
    if (this.globalDiscountSuccessExpiry) this.globalDiscountSuccessExpiry.textContent = expiryLabel;
    if (this.globalDiscountSuccessNote) this.globalDiscountSuccessNote.textContent = noteLabel;
    if (this.globalDiscountSuccessDescription) this.globalDiscountSuccessDescription.textContent = descLabel;

    this.globalDiscountSuccess.hidden = false;
    requestAnimationFrame(() => this.globalDiscountSuccess?.classList.add('is-visible'));
    clearTimeout(this.globalDiscountSuccessTimer);
    this.globalDiscountSuccessTimer = null;
  }

  openGlobalDiscountConfirm() {
    const active = this.getGlobalDiscount();
    const hasActive = Boolean(active);
    const amountLabel = active
      ? (active.type === 'percent'
        ? `${this.formatNumber(active.amount)}٪`
        : `${this.formatNumber(active.amount)} تومان`)
      : '';
    const expiryLabel = active?.expiresAt ? UIComponents.formatRelativeDate(active.expiresAt) : '';

    if (this.globalDiscountConfirmTitle) {
      this.globalDiscountConfirmTitle.textContent = hasActive ? 'حذف تخفیف همگانی فعال؟' : 'تخفیف همگانی فعال نیست';
    }

    if (this.globalDiscountConfirmSubtitle) {
      this.globalDiscountConfirmSubtitle.textContent = hasActive
        ? 'تخفیف همگانی برای همه مشتریان فعال است. از حذف آن مطمئن هستید؟'
        : 'در حال حاضر هیچ تخفیف همگانی فعالی ثبت نشده است.';
    }

    if (this.globalDiscountConfirmDetails) {
      this.globalDiscountConfirmDetails.innerHTML = hasActive
        ? `تخفیف <strong>${amountLabel}</strong> برای تمام مشتریان شما فعال است ${expiryLabel ? `• تا ${expiryLabel}` : ''}. با حذف این مورد، همه مشتریان به حالت بدون تخفیف برمی‌گردند.`
        : 'برای حذف، ابتدا باید یک تخفیف همگانی فعال داشته باشید.';
    }

    if (this.globalDiscountConfirmAccept) {
      this.globalDiscountConfirmAccept.disabled = !hasActive;
      this.globalDiscountConfirmAccept.setAttribute('aria-disabled', (!hasActive).toString());
      this.globalDiscountConfirmAccept.textContent = hasActive ? 'بله، حذف شود' : 'باشه';
    }

    if (!hasActive) {
      UIComponents.showToast('هیچ تخفیف همگانی فعال نیست.', 'info');
    }

    UIComponents.openModal('global-discount-confirm-modal');
  }

  handleGlobalDiscountSubmit() {
    if (!this.globalDiscountForm) return;
    if (this.getGlobalDiscount()) {
      this.showDiscountGuardModal('global');
      return;
    }
    const type = Array.from(this.globalDiscountTypeInputs || []).find(input => input.checked)?.value || 'amount';
    const amount = Number(this.globalDiscountAmount?.value || 0);
    const note = (this.globalDiscountNoteInput?.value || '').trim();
    const customDate = this.globalDiscountCustomDate?.value || '';
    const couponCode = (this.globalDiscountCouponInput?.value || '').trim();

    if (type === 'percent') {
      if (!Number.isFinite(amount) || amount <= 0 || amount > 90) {
        UIComponents.showToast('درصد تخفیف باید بین ۱ تا ۹۰ باشد.', 'error');
        return;
      }
    } else if (!Number.isFinite(amount) || amount < 500) {
      UIComponents.showToast('مبلغ تخفیف همگانی باید حداقل ۵۰۰ تومان باشد.', 'error');
      return;
    }

    const duration = Array.from(this.globalDiscountDurationInputs || []).find(input => input.checked)?.value || 'week';
    if (duration === 'custom' && !customDate) {
      UIComponents.showToast('تاریخ انقضای تخفیف همگانی را وارد کنید.', 'error');
      return;
    }

    const parsedCustomDate = duration === 'custom' ? this.parseDiscountDateInput(customDate) : null;
    if (duration === 'custom' && !parsedCustomDate) {
      UIComponents.showToast('تاریخ شمسی واردشده برای تخفیف همگانی معتبر نیست.', 'error');
      return;
    }

    const expiresAt = duration === 'custom'
      ? (() => { const d = parsedCustomDate; d.setHours(23, 59, 0, 0); return d.toISOString(); })()
      : this.calculateDiscountExpiry(duration);
    const noteLabel = duration === 'custom'
      ? this.formatCustomExpiryLabel(customDate)
      : this.getDiscountDurationLabel(duration);

    const discount = {
      id: this.GLOBAL_DISCOUNT_ID,
      customerId: this.GLOBAL_CUSTOMER_ID,
      customerName: 'تمام مشتریان',
      customerPhone: '',
      amount,
      type,
      createdAt: new Date().toISOString(),
      expiresAt,
      note: note || noteLabel,
      couponCode: couponCode || undefined,
      isGlobal: true,
      excludedCustomerIds: []
    };

    this.discountStore.upsert(discount);
    this.showGlobalDiscountSuccess(discount);
    this.globalDiscountForm.reset();
    const today = this.globalDiscountForm.querySelector('input[name="global-discount-duration"][value="today"]');
    if (today) today.checked = true;
    if (this.globalDiscountCustomDate) this.globalDiscountCustomDate.value = '';
    this.updateGlobalDurationState('today');
    if (this.globalDiscountCouponInput) this.globalDiscountCouponInput.value = '';
    this.updateGlobalDiscountType(type);
    this.updateGlobalDiscountStatus();
    this.renderDiscounts();
    this.renderCustomers(this.currentCustomerQuery || '');
  }

  clearGlobalDiscount() {
    this.discountStore.remove(this.GLOBAL_DISCOUNT_ID);
    this.updateGlobalDiscountStatus();
    this.renderDiscounts();
    this.renderCustomers(this.currentCustomerQuery || '');
    UIComponents.showToast('تخفیف همگانی حذف شد.', 'info');
  }

  confirmClearGlobalDiscount() {
    const active = this.getGlobalDiscount();
    if (!active) {
      UIComponents.showToast('هیچ تخفیف همگانی فعال نیست.', 'info');
      UIComponents.closeModal('global-discount-confirm-modal');
      return;
    }

    this.clearGlobalDiscount();
    UIComponents.closeModal('global-discount-confirm-modal');
  }

  handleDiscountSubmit() {
    if (!this.discountForm || !this.discountCustomerSelect) return;
    if (this.getGlobalDiscount()) {
      this.showDiscountGuardModal('personal');
      return;
    }
    const customerId = this.discountCustomerSelect.value;
    if (!customerId) {
      UIComponents.showToast('لطفاً یک مشتری را انتخاب کنید.', 'error');
      return;
    }

    const selectedType = Array.from(this.discountTypeInputs || []).find(input => input.checked)?.value || 'amount';
    const amount = Number(this.discountAmountInput?.value || 0);
    if (selectedType === 'percent') {
      if (!Number.isFinite(amount) || amount <= 0 || amount > 90) {
        UIComponents.showToast('درصد تخفیف باید بین ۱ تا ۹۰ باشد.', 'error');
        return;
      }
    } else {
      if (!Number.isFinite(amount) || amount < 1000) {
        UIComponents.showToast('مبلغ تخفیف را حداقل با ۱۰۰۰ تومان وارد کنید.', 'error');
        return;
      }
    }

    const duration = this.getSelectedDiscountDuration();
    const customer = this.getDiscountCustomers().find(c => String(c.id) === String(customerId)) || {};
    const note = (this.discountNoteInput?.value || '').trim();
    const manualExpiry = (this.discountExpiryInput?.value || '').trim();
    const parsedManualExpiry = manualExpiry ? this.parseDiscountDateInput(manualExpiry) : null;

    if (duration === 'custom' && !manualExpiry) {
      UIComponents.showToast('تاریخ انقضا را وارد کنید.', 'error');
      return;
    }

    if (manualExpiry && !parsedManualExpiry) {
      UIComponents.showToast('تاریخ واردشده معتبر نیست. لطفاً یک تاریخ شمسی مانند ۱۴۰۴/۰۸/۲۵ وارد کنید.', 'error');
      return;
    }

    const expiresAt = manualExpiry
      ? (() => { const d = parsedManualExpiry; d.setHours(23, 59, 0, 0); return d.toISOString(); })()
      : this.calculateDiscountExpiry(duration);
    const noteLabel = manualExpiry ? this.formatCustomExpiryLabel(manualExpiry) : this.getDiscountDurationLabel(duration);

    const discount = {
      id: crypto.randomUUID ? crypto.randomUUID() : `disc-${Date.now()}`,
      customerId,
      customerName: customer.name || 'مشتری',
      customerPhone: customer.phone || '',
      amount,
      type: selectedType,
      createdAt: new Date().toISOString(),
      expiresAt,
      note: note || noteLabel
    };

    this.discountStore.upsert(discount);
    UIComponents.showToast('تخفیف برای مشتری ثبت شد.', 'success');
    this.discountForm.reset();
    const todayOption = this.discountForm.querySelector('input[name="discount-duration"][value="today"]');
    if (todayOption) todayOption.checked = true;
    this.refreshDiscountCustomers(customerId);
    this.renderDiscounts();
  }

  updateDiscountStats(active = []) {
    const today = new Date().toDateString();
    const expiringToday = active.filter(d => new Date(d.expiresAt).toDateString() === today).length;
    const amountOnly = active.filter(d => d.type !== 'percent');
    const totalValue = amountOnly.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const average = amountOnly.length ? totalValue / amountOnly.length : 0;
    const activeGlobal = active.filter(d => d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID).length;
    const personalCount = Math.max(0, active.length - activeGlobal);
    const upcoming = active
      .map(d => ({
        date: new Date(d.expiresAt),
        isGlobal: d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID
      }))
      .filter(item => !Number.isNaN(item.date?.getTime?.()))
      .sort((a, b) => a.date - b.date)[0];
    const nextExpiry = upcoming?.date;
    const nextExpiryText = nextExpiry
      ? `${UIComponents.formatRelativeDate(nextExpiry)}${upcoming.isGlobal ? ' • تخفیف همگانی' : ''}`
      : 'بدون موعد فعال';

    const setStat = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        el.dataset.value = value;
        el.textContent = this.formatNumber(value, { fractionDigits: 0, fallback: '۰' });
        UIComponents.animateCountUp?.(el);
      }
    };

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value;
      }
    };

    setStat('discount-active-count', active.length);
    setStat('discount-active-count-inline', active.length);
    setStat('discount-expiring-today', expiringToday);
    setStat('discount-expiring-inline', expiringToday);
    setStat('discount-total-value', totalValue);
    setStat('discount-average', average);
    setStat('discount-summary-active', active.length);
    setStat('discount-summary-expiring', expiringToday);
    setStat('discount-summary-total', totalValue);
    setStat('discount-summary-average', average);
    setStat('discount-summary-global', activeGlobal);
    setStat('discount-summary-personal', personalCount);

    setText('discount-summary-next-expiry', nextExpiryText);
    setText('discount-summary-status', active.length
      ? `${this.formatNumber(active.length)} تخفیف فعال ${activeGlobal ? ' • شامل تخفیف همگانی' : ''}`.trim()
      : 'بدون تخفیف فعال');
  }

  renderDiscounts() {
    const listEl = document.getElementById('discounts-list');
    const emptyEl = document.getElementById('discounts-empty');
    if (!listEl || !emptyEl) return;

    const customers = this.getDiscountCustomers();
    const customerMap = new Map(customers.map(c => [String(c.id), c]));
    const active = this.discountStore.getActive().map(item => {
      if (item.isGlobal || item.customerId === this.GLOBAL_CUSTOMER_ID) {
        return {
          ...item,
          customerName: 'تخفیف همگانی',
          customerPhone: 'روی همه مشتریان',
          isGlobal: true
        };
      }
      const info = customerMap.get(String(item.customerId));
      if (info) {
        return {
          ...item,
          customerName: item.customerName || info.name,
          customerPhone: item.customerPhone || info.phone,
          lastReservation: item.lastReservation || info.lastReservation
        };
      }
      return item;
    }).sort((a, b) => (a.isGlobal ? -1 : 1));

    this.updateDiscountStats(active);

    if (!active.length) {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    listEl.innerHTML = active.map(d => {
      const remaining = this.formatRemainingTime(d.expiresAt);
      const note = d.note ? `<div class="meta">${escapeHtml(d.note)}</div>` : '';
      const coupon = d.couponCode ? `<div class="meta meta-highlight">کد تخفیف: ${escapeHtml(d.couponCode)}</div>` : '';
      const lastVisit = d.lastReservation && !d.isGlobal ? ` • آخرین مراجعه: ${UIComponents.formatRelativeDate(d.lastReservation)}` : '';
      const valueText = d.type === 'percent'
        ? `${UIComponents.formatPersianNumber(d.amount)}٪`
        : this.formatToman(d.amount);
      const valueLabel = d.isGlobal ? 'تخفیف همگانی' : (d.type === 'percent' ? 'درصدی' : 'مبلغ');
      const metaLine = d.isGlobal
        ? (() => {
          const excludedCount = Array.isArray(d.excludedCustomerIds) ? d.excludedCustomerIds.length : 0;
          const appliedCount = Math.max((customers?.length || 0) - excludedCount, 0);
          const appliedLabel = appliedCount ? `${this.formatNumber(appliedCount)} مشتری` : 'بدون مشتری فعال';
          const excludedLabel = excludedCount ? ` • لغو برای ${this.formatNumber(excludedCount)} نفر` : '';
          return `اعمال شده روی ${appliedLabel}${excludedLabel}`;
        })()
        : `${UIComponents.formatPersianNumber(d.customerPhone || '')}${lastVisit}`;
      const badge = d.isGlobal ? '<span class="status-badge status-active">همگانی</span>' : '';

      return `
        <article class="discount-card" role="listitem">
          <div class="discount-card__avatar" aria-hidden="true">${escapeHtml((d.isGlobal ? '٪' : d.customerName?.charAt(0)) || 'م')}</div>
          <div class="discount-card__body">
            <div class="name">${escapeHtml(d.customerName || 'مشتری')} ${badge}</div>
            <div class="meta">${metaLine}</div>
            ${coupon}
            ${note}
          </div>
          <div class="discount-card__amount">
            <span class="label">${valueLabel}</span>
            <span class="value">${valueText}</span>
            <span class="expires">${this.formatDateTime(d.expiresAt)} • ${remaining}</span>
          </div>
          <div class="discount-card__actions">
            <button type="button" class="btn-text" data-action="cancel-discount" data-id="${d.id}">${d.isGlobal ? 'لغو همگانی' : 'لغو'}</button>
          </div>
        </article>
      `;
    }).join('');

    this.updateDiscountAnalytics();
  }

  openDiscountAnalyticsModal() {
    this.updateDiscountAnalytics();
    UIComponents.openModal('discount-analytics-modal');
  }

  updateDiscountAnalytics() {
    const updateNumber = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.dataset.value = value;
      el.textContent = this.formatNumber(value, { fallback: '۰' });
      UIComponents.animateCountUp?.(el);
    };

    const allDiscounts = this.discountStore?.load?.() || [];
    const active = this.discountStore?.getActive?.() || [];
    const personal = active.filter(d => !(d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID));
    const global = active.filter(d => d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID);
    const now = new Date();
    const expiringSoon = active.filter(d => {
      const expiry = new Date(d.expiresAt);
      const diff = expiry - now;
      return diff > 0 && diff <= 72 * 60 * 60 * 1000;
    }).length;

    const sortedByExpiry = [...active].sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));
    const nextExpiry = sortedByExpiry[0];
    const nextExpiryLabel = nextExpiry ? UIComponents.formatRelativeDate(nextExpiry.expiresAt) : 'بدون تخفیف فعال';

    const usageNames = personal.map(d => d.customerName || 'مشتری').filter(Boolean);
    const usagePreview = usageNames.length
      ? `${usageNames.slice(0, 3).join('، ')}${usageNames.length > 3 ? ' و سایر مشتریان' : ''}`
      : 'فعلاً مشتری از تخفیف استفاده نکرده است.';

    updateNumber('discount-insights-total', allDiscounts.length);
    updateNumber('discount-insights-active', active.length);
    updateNumber('discount-insights-expiring', expiringSoon);
    if (this.discountInsightsNextExpiry) this.discountInsightsNextExpiry.textContent = nextExpiryLabel;
    if (this.discountInsightsUsage) this.discountInsightsUsage.textContent = usagePreview;

    updateNumber('discount-analytics-issued', allDiscounts.length);
    updateNumber('discount-analytics-active', active.length);
    updateNumber('discount-analytics-global', global.length);
    updateNumber('discount-analytics-personal', personal.length);
    updateNumber('discount-analytics-expiring', expiringSoon);
    if (this.discountAnalyticsNextExpiry) this.discountAnalyticsNextExpiry.textContent = nextExpiryLabel;
    if (this.discountAnalyticsUsage) this.discountAnalyticsUsage.textContent = usagePreview;

    if (!this.discountAnalyticsList || !this.discountAnalyticsEmpty) return;

    if (!active.length) {
      this.discountAnalyticsList.innerHTML = '';
      this.discountAnalyticsEmpty.hidden = false;
      return;
    }

    this.discountAnalyticsEmpty.hidden = true;
    this.discountAnalyticsList.innerHTML = sortedByExpiry.map((d) => {
      const amountLabel = d.type === 'percent'
        ? `${this.formatNumber(d.amount)}٪`
        : `${this.formatNumber(d.amount)} تومان`;
      const expiryLabel = UIComponents.formatRelativeDate(d.expiresAt);
      const createdLabel = UIComponents.formatRelativeDate(d.createdAt);
      const target = d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID
        ? 'تخفیف همگانی'
        : escapeHtml(d.customerName || 'مشتری');
      const badge = d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID ? 'همگانی' : 'اختصاصی';
      const note = d.note ? escapeHtml(d.note) : 'بدون یادداشت';
      const canCancel = !(d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID);
      const cancelAction = canCancel
        ? `<button type="button" class="btn-ghost-sm btn-ghost-sm--danger" data-action="cancel-discount" data-id="${escapeHtml(d.id)}">لغو تخفیف</button>`
        : '<span class="pill pill--muted">غیرفعال‌سازی فردی امکان‌پذیر نیست</span>';
      const manageAction = canCancel
        ? `<button type="button" class="btn-ghost-sm" data-action="open-discount-modal" data-customer-id="${escapeHtml(d.customerId)}" data-customer-name="${escapeHtml(d.customerName || 'مشتری')}" data-customer-phone="${escapeHtml(d.customerPhone || '')}">مدیریت</button>`
        : `<button type="button" class="btn-ghost-sm" data-action="open-global-discount-confirm">حذف همگانی</button>`;

      return `
        <article class="discount-analytics-item" role="listitem">
          <div class="discount-analytics-item__avatar" aria-hidden="true">${escapeHtml((d.isGlobal ? '٪' : (d.customerName || 'م')[0]))}</div>
          <div class="discount-analytics-item__body">
            <div class="discount-analytics-item__header">
              <div>
                <h4 class="discount-analytics-item__title">${target}</h4>
                <p class="discount-analytics-item__meta">${badge} • ثبت ${createdLabel}</p>
              </div>
              <div class="discount-analytics-item__amount">${amountLabel}</div>
            </div>
            <div class="discount-analytics-item__footer">
              <span class="pill">انقضا: ${expiryLabel}</span>
              <span class="pill pill--muted">${note}</span>
              <div class="discount-analytics-item__actions">
                ${manageAction}
                ${cancelAction}
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  handleDiscountCancellation(discountId, { analyticsContext = false, customerContext = false } = {}) {
    if (!discountId) return;
    const active = this.discountStore.getActive();
    const target = active.find(d => d.id === discountId);
    if (!target) {
      UIComponents.showToast('تخفیفی برای لغو یافت نشد.', 'warning');
      return;
    }

    this.discountStore.remove(discountId);

    const toastContext = analyticsContext
      ? 'از آمار تخفیف‌ها حذف شد.'
      : (customerContext ? 'برای این مشتری غیرفعال شد.' : 'لغو شد.');
    UIComponents.showToast(`تخفیف ${toastContext}`, 'info');

    this.renderDiscounts();
    this.renderCustomers(this.currentCustomerQuery || '');
    if (analyticsContext) {
      this.updateDiscountAnalytics();
    }
  }








openCustomerModal(customer) {
  // Header
  document.getElementById('customer-modal-name').textContent = customer.name;
  document.getElementById('customer-modal-avatar').textContent = customer.name?.charAt(0) || '؟';
  const phoneWrap = document.getElementById('customer-modal-phone');
  phoneWrap.querySelector('span').textContent = customer.phone || '-';

  // Bookings and last reservation
  const bookingsFor = (MOCK_DATA.bookings || []).filter(b => b.customerName === customer.name);
  document.getElementById('customer-total-reservations').textContent =
    UIComponents.formatPersianNumber(bookingsFor.length);

  // Calculate completed and cancelled counts
  const completedCount = bookingsFor.filter(b => b.status === 'completed').length;
  const cancelledCount = bookingsFor.filter(b => b.status === 'cancelled').length;
  
  document.getElementById('customer-completed-reservations').textContent = 
    UIComponents.formatPersianNumber(completedCount);
  document.getElementById('customer-cancel-count').textContent = 
    UIComponents.formatPersianNumber(cancelledCount);

  const last = bookingsFor[bookingsFor.length - 1];
  if (last) {
    document.getElementById('last-reservation-date').textContent =
      UIComponents.formatRelativeDate(customer.lastReservation || '۱۴۰۳/۰۵/۱۵');
    document.getElementById('last-reservation-service').textContent = last.service || '-';
    document.getElementById('last-reservation-time').textContent =
      `ساعت ${UIComponents.formatPersianNumber(last.time || '')}`;
    
    const st = document.getElementById('last-reservation-status');
    const actions = document.getElementById('last-reservation-actions');
    const confirmBtn = document.getElementById('confirm-reservation-btn');
    const cancelBtn = document.getElementById('cancel-reservation-btn');
    
    // Status mapping
    const faMap = {
      pending: 'در انتظار',
      confirmed: 'تایید شده',
      completed: 'انجام شده',
      cancelled: last && last.cancelledBy === 'customer' ? 'لغو شده توسط مشتری' : 'لغو شده'
    };
    
    // Update status display
    const updateStatusDisplay = (status) => {
      st.textContent = faMap[status] || status;
      st.className = `status-badge status-${status}`;
      
      // Show/hide action buttons based on status
      if (status === 'pending') {
        actions.hidden = false;
      } else {
        actions.hidden = true;
      }
    };
    
    // Initial status display
    updateStatusDisplay(last.status);
    
    // Confirm button handler
    confirmBtn.onclick = () => {
      // Update the booking status in the data
      last.status = 'confirmed';
      persistBookings();
      delete bookedCache[last.dateISO];
      const modal = document.getElementById('resv-modal');
      if (modal && !modal.hidden) renderTimes();
      Notifications?.add(`نوبت ${customer.name} تایید شد`, 'booking');

      // Update UI with animation
      st.style.transform = 'scale(0.95)';
      setTimeout(() => {
        updateStatusDisplay('confirmed');
        st.style.transform = 'scale(1)';
      }, 150);
      
      // Show success message
      UIComponents.showToast('✅ رزرو با موفقیت تایید شد', 'success');
      
      // Update bookings list if it's visible
      if (document.getElementById('bookings-view').classList.contains('active')) {
        this.renderBookings();
      }

      // Update dashboard stats
      this.updateDashboardStats();
      this.renderPlans && this.renderPlans();
    };
    
    // Cancel button handler
    cancelBtn.onclick = () => {
      // Confirm cancellation
      if (!confirm('آیا از لغو این رزرو مطمئن هستید؟')) return;

      // Update the booking status in the data
      last.status = 'cancelled';
      persistBookings();
      delete bookedCache[last.dateISO];
      const modal = document.getElementById('resv-modal');
      if (modal && !modal.hidden) renderTimes();
      Notifications?.add(`نوبت ${customer.name} لغو شد`, 'booking');

      // Update UI with animation
      st.style.transform = 'scale(0.95)';
      setTimeout(() => {
        updateStatusDisplay('cancelled');
        st.style.transform = 'scale(1)';
      }, 150);
      
      // Show error message
      UIComponents.showToast('❌ رزرو لغو شد', 'error');
      
      // Update bookings list if it's visible
      if (document.getElementById('bookings-view').classList.contains('active')) {
        this.renderBookings();
      }

      // Update dashboard stats
      this.updateDashboardStats();
      this.renderPlans && this.renderPlans();
    };
  } else {
    document.getElementById('last-reservation-actions').hidden = true;
  }

  // Customer preferences (auto-accept and blocked switches)
  const prefs = CustomerPrefs.getByName(customer.name);
  const autoEl = document.getElementById('toggle-auto-accept');
  const blockEl = document.getElementById('toggle-blocked');

  autoEl.checked = !!prefs.autoAccept;
  blockEl.checked = !!prefs.blocked;

  autoEl.closest('.toggle-switch').classList.toggle('active', autoEl.checked);
  blockEl.closest('.toggle-switch').classList.toggle('active', blockEl.checked);

  // Handle preference changes
    autoEl.onchange = () => {
      CustomerPrefs.setByName(customer.name, { autoAccept: autoEl.checked });
      autoEl.closest('.toggle-switch').classList.toggle('active', autoEl.checked);
      UIComponents.showToast(
        autoEl.checked ? '✅ تایید خودکار برای این مشتری فعال شد' : 'تایید خودکار غیرفعال شد',
        'success'
      );
      this.renderBookings();
      this.renderPlans && this.renderPlans();
    };

    blockEl.onchange = () => {
      CustomerPrefs.setByName(customer.name, { blocked: blockEl.checked });
      blockEl.closest('.toggle-switch').classList.toggle('active', blockEl.checked);
      UIComponents.showToast(
        blockEl.checked ? '🚫 این مشتری مسدود شد' : 'مسدودسازی برداشته شد',
        blockEl.checked ? 'error' : 'success'
      );
      this.renderBookings();
      this.renderPlans && this.renderPlans();
    };

  UIComponents.openModal('customer-details-modal');
}

// ADD this new method to update dashboard stats after status changes
async updateDashboardStats() {
  try {
    await this.loadDashboardStats(true);
  } catch (err) {
    console.error('updateDashboardStats failed', err);
  }
}





applyBrandImages(){
  const root = document.documentElement;
  root.style.setProperty('--footer-image', this.brandImages.footer ? `url("${this.brandImages.footer}")` : 'none');

  const footerImg = document.getElementById('footer-preview');
  if (footerImg) {
    if (this.brandImages.footer) footerImg.src = this.brandImages.footer;
    else footerImg.removeAttribute('src');
  }
}

bindFooterImageEvents(){
  const footerPick   = document.getElementById('footer-pick-btn');
  const footerFile   = document.getElementById('footer-file');
  const footerRemove = document.getElementById('footer-remove-btn');

  if (footerPick && footerFile){
    footerPick.addEventListener('click', () => footerFile.click());
    footerFile.addEventListener('change', (e) => this._handleFooterUpload(e));
  }
  if (footerRemove){
    footerRemove.addEventListener('click', () => this._removeFooterImage());
  }
}

_handleFooterUpload(evt) {
    const file = evt.target.files && evt.target.files[0];
    if (!file) return;

    const previousFooter = this.brandImages.footer;
    // Use a temporary object URL for instant preview
    const tempPreviewUrl = URL.createObjectURL(file);
    this.brandImages.footer = tempPreviewUrl;
    this.applyBrandImages();

    const formData = new FormData();
    formData.append('image', file);

    // FIX: Use XHR instead of fetch to bypass __security.js interceptors
    // that might be corrupting the Content-Type header or FormData.
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/branding/footer`, true);
    xhr.withCredentials = true; // Important for cookies/sessions

    xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const data = JSON.parse(xhr.responseText);
                this.brandImages.footer = data.url || '';
                this.applyBrandImages();
                UIComponents.showToast('تصویر فوتر ذخیره شد.', 'success');
            } catch (e) {
                console.error('JSON Parse Error:', e);
                revert();
            }
        } else {
            console.error('Upload failed with status:', xhr.status);
            revert();
        }
        URL.revokeObjectURL(tempPreviewUrl);
    };

    xhr.onerror = () => {
        console.error('XHR Network Error');
        revert();
        URL.revokeObjectURL(tempPreviewUrl);
    };

    const revert = () => {
        this.brandImages.footer = previousFooter;
        this.applyBrandImages();
        UIComponents.showToast('خطا در آپلود تصویر.', 'error');
    };

    xhr.send(formData);
}

_removeFooterImage(){
  fetch(`${API_BASE}/api/branding/footer`, {
    method:'DELETE',
    credentials:'include'
  }).catch(()=>{});
  this.brandImages.footer = '';
  this.applyBrandImages();
  UIComponents.showToast('تصویر فوتر حذف شد.', 'info');
}

  // === END OF NEW METHODS ===
  }




// === PERSONALIZATION: Load and Display Seller Data ===
// === PERSONALIZATION: Load and Display Seller Data ===
function initSellerPersonalization() {
  try {
    // Get seller data from localStorage
    const sellerData = JSON.parse(localStorage.getItem('seller') || '{}');
    
    if (!sellerData || !sellerData.firstname) {
      console.warn('No seller data found in localStorage');
      return;
    }

    // Update welcome message
    const sellerNameEl = document.getElementById('seller-name');
    if (sellerNameEl) {
      sellerNameEl.textContent = `${sellerData.firstname} ${sellerData.lastname || ''}`.trim();
    }

    // Update seller info card
    const fullName = `${sellerData.firstname || ''} ${sellerData.lastname || ''}`.trim();
    const avatar = document.getElementById('seller-avatar');
    const fullNameEl = document.getElementById('seller-full-name');
    const shopNameEl = document.getElementById('seller-shop-name');
    const categoryEl = document.getElementById('seller-category');
    const phoneEl = document.getElementById('seller-phone');
    const addressEl = document.getElementById('seller-address');
    const urlEl = document.getElementById('seller-url');

    if (avatar && fullName) {
      avatar.textContent = fullName.charAt(0).toUpperCase();
    }

    if (fullNameEl) {
      fullNameEl.textContent = fullName || 'نام فروشنده';
    }

    if (shopNameEl && sellerData.storename) {
      shopNameEl.textContent = sellerData.storename;
    }

    if (categoryEl && sellerData.category) {
      categoryEl.textContent = sellerData.category;
    }

    if (phoneEl && sellerData.phone) {
      phoneEl.textContent = sellerData.phone;
    }

    if (addressEl && sellerData.address) {
      addressEl.textContent = sellerData.address;
    }

    if (urlEl && sellerData.shopurl) {
      const url = `https://vitreenet.ir/${sellerData.shopurl}`;
      urlEl.href = url;
      urlEl.textContent = `vitreenet.ir/${sellerData.shopurl}`;
    }

    // ✅ AUTO-FILL SETTINGS FORM
    populateSettingsForm(sellerData);

    // Update page title with shop name
    if (sellerData.storename) {
      document.title = `پنل ${sellerData.storename} - داشبورد مدیریت`;
    }

    // Custom greeting based on time of day and service type
    setTimeout(() => {
      showPersonalizedWelcome(sellerData);
    }, 1000);

  } catch (error) {
    console.error('Error loading seller data:', error);
  }
}

// ✅ NEW: Auto-populate settings form
function populateSettingsForm(sellerData) {
  // Business name
  const businessNameEl = document.getElementById('business-name');
  if (businessNameEl && sellerData.storename) {
    businessNameEl.value = sellerData.storename;
  }

  // Business phone
  const businessPhoneEl = document.getElementById('business-phone');
  if (businessPhoneEl && sellerData.phone) {
    businessPhoneEl.value = sellerData.phone;
  }

  // Business address
  const businessAddressEl = document.getElementById('business-address');
  if (businessAddressEl && sellerData.address) {
    businessAddressEl.value = sellerData.address;
  }

  // Working hours
  const startEl = document.getElementById('work-start');
  if (startEl && sellerData.startTime) {
    startEl.value = sellerData.startTime;
  }
  const endEl = document.getElementById('work-end');
  if (endEl && sellerData.endTime) {
    endEl.value = sellerData.endTime;
  }

  // Business category dropdown
  const categoryEl = document.getElementById('business-category');
  if (categoryEl && sellerData.category) {
    // Map Persian categories to option values
    const categoryMap = {
      'آرایشگاه مردانه': 'barbershop',
      'آرایشگاه زنانه': 'salon', 
      'سالن زیبایی زنانه': 'salon',
      'کلینیک زیبایی': 'clinic',
      'زیبایی': 'clinic',
      'خدمات': 'barbershop', // default for service
      'تالار و مجالس': 'barbershop',
      'خودرو': 'barbershop',
      'ورزشی': 'barbershop'
    };
    
    const mappedValue = categoryMap[sellerData.category] || 'barbershop';
    categoryEl.value = mappedValue;
    
    // Update the display text
    const selectedOption = categoryEl.querySelector(`option[value="${mappedValue}"]`);
    if (selectedOption) {
      selectedOption.selected = true;
    }
  }
}

function showPersonalizedWelcome(sellerData) {
  const hour = new Date().getHours();
  let greeting = '';
  
  if (hour < 6) greeting = '🌙 شب بخیر';
  else if (hour < 12) greeting = '🌅 صبح بخیر';
  else if (hour < 17) greeting = '☀️ ظهر بخیر';
  else if (hour < 20) greeting = '🌆 عصر بخیر';
  else greeting = '🌃 شب بخیر';

  const serviceType = sellerData.category || '';
  let serviceMessage = '';
  
  if (serviceType.includes('آرایشگاه')) {
    serviceMessage = 'آماده ارائه بهترین خدمات زیبایی! ';
  } else if (serviceType.includes('خدمات')) {
    serviceMessage = 'آماده خدمت‌رسانی به مشتریان عزیز! ';
  } else if (serviceType.includes('زیبایی')) {
    serviceMessage = 'روز پر از زیبایی داشته باشید! ';
  }

  const message = `${greeting} ${sellerData.firstname}! ${serviceMessage}امروز روز موفقیت شماست! 🎯`;
  
  if (typeof UIComponents !== 'undefined' && UIComponents.showToast) {
    UIComponents.showToast(message, 'success', 5000);
  }
}

await fetchInitialData();

initSellerPersonalization();

let featureFlags = { ...DEFAULT_FEATURE_FLAGS };
try {
  const rawFlags = await API.getFeatureFlags();
  featureFlags = normalizeFeatureFlags(rawFlags || {});
} catch (err) {
  console.warn('feature flags fetch failed', err);
  featureFlags = { ...DEFAULT_FEATURE_FLAGS };
}

featureFlags = applySellerPlanFeatureFlags(featureFlags);
window.__FEATURE_FLAGS__ = featureFlags;

await loadSellerPlans();

await loadComplimentaryPlan();

const app = new SellerPanelApp(featureFlags);
app.init();
if (typeof app.initBrandImages === 'function') app.initBrandImages();

app.loadTopPeers().catch(err => console.warn('initial top peers load failed', err));

loadCustomers();



// === Reservations (Jalali, 24h, RTL, mobile-first) ===
(function () {
  const PERSIAN_WEEKDAYS = [
    { label: 'شنبه', js: 6 },
    { label: 'یکشنبه', js: 0 },
    { label: 'دوشنبه', js: 1 },
    { label: 'سه‌شنبه', js: 2 },
    { label: 'چهارشنبه', js: 3 },
    { label: 'پنجشنبه', js: 4 },
    { label: 'جمعه', js: 5 }
  ];
  const el = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const KEY = 'vit_resv_schedule'; // legacy key, no localStorage usage

  const faDigits = '۰۱۲۳۴۵۶۷۸۹', enDigits = '0123456789';
  const toFa = (s) => (s + '').replace(/[0-9]/g, (d) => faDigits[d]);
  const toEn = (s) => (s + '').replace(/[۰-۹]/g, (d) => enDigits[faDigits.indexOf(d)]);
    const pad2 = (n) => String(n).padStart(2, '0');
  const faDateShort = (d) =>
    new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

  // --- Today banner + auto refresh at midnight
  let _resvMidnightTimer = null;

  function updateTodayBanner() {
    const now = new Date();
    const dayStr  = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long' }).format(now);
    const dateStr = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const box = document.getElementById('resv-today');
    if (box) box.textContent = `امروز ${dayStr} — ${dateStr}`;
  }

  function scheduleMidnightTick() {
    clearTimeout(_resvMidnightTimer);
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 20);
    _resvMidnightTimer = setTimeout(() => {
      updateTodayBanner();
      updateDateHint();
      scheduleMidnightTick();
    }, next - now);
  }

  // قطع تایمر وقتی مودال بسته می‌شود
  (function watchResvModalClose(){
    const modal = document.getElementById('resv-modal');
    if (!modal) return;
    const mo = new MutationObserver(() => {
      if (modal.hidden) clearTimeout(_resvMidnightTimer);
    });
    mo.observe(modal, { attributes: true });
  })();


  // state + storage from server
  const state = {
    selectedIdx: 0,
    schedule: { '6': [], '0': [], '1': [], '2': [], '3': [], '4': [], '5': [] }
  };

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/api/booking-slots/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        state.schedule = Object.assign(state.schedule, data || {});
        cleanScheduleData();
      }
    } catch (e) {
      console.error('load schedule failed', e);
    }
  }

  async function save() {
    try {
      const res = await fetch(`${API_BASE}/api/booking-slots/me`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.schedule)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.message || 'خطا در ذخیره برنامه نوبت‌دهی';
        UIComponents?.showToast?.(msg, 'error');
        return false;
      }
      UIComponents?.showToast?.('نوبت‌ها با موفقیت ذخیره شد.', 'success');
      return true;
    } catch (e) {
      console.error('save schedule failed', e);
      UIComponents?.showToast?.('خطا در ذخیره برنامه نوبت‌دهی', 'error');
      return false;
    }
  }

  function updateDayIndicators() {
    const bookings = window.MOCK_DATA?.bookings || [];
    const chips = document.querySelectorAll('#resv-week .resv-day-chip');
    chips.forEach(chip => {
      const day = parseInt(chip.dataset.day, 10);
      chip.classList.remove('has-pending', 'has-cancelled');
      const dayBookings = bookings.filter(b => {
        const raw = b.dateISO || toEn((b.date || '').split(' ')[0]).replace(/\//g, '-');
        const d = new Date(raw);
        return !isNaN(d) && d.getDay() === day;
      });
      if (dayBookings.some(b => b.status === 'pending')) {
        chip.classList.add('has-pending');
      } else if (dayBookings.some(b => b.status === 'cancelled')) {
        chip.classList.add('has-cancelled');
      }
    });
  }
  window.updateResvDayIndicators = updateDayIndicators;

  // open modal
  async function openModal() {
    await load();
    try {
      const bookings = await API.getBookings();
      const localBookings = JSON.parse(localStorage.getItem('vitreenet-bookings') || '[]');
      if (Array.isArray(bookings) && bookings.length) {
        const statusMap = new Map(localBookings.map(b => [(b._id || b.id), b.status]));
        MOCK_DATA.bookings = bookings.map(b => ({
          ...b,
          date: b.bookingDate || b.date || '',
          dateISO: b.dateISO || b.bookingDate || b.date || '',
          status: statusMap.get(b._id || b.id) || b.status || 'pending'
        }));
      } else if (localBookings.length) {
        MOCK_DATA.bookings = localBookings.map(b => ({
          id: b.id || Date.now() + Math.random(),
          customerName: b.name || b.customerName || '',
          service: b.service || '',
          date: b.date || '',
          dateISO: b.dateISO || '',
          time: b.time || '',
          status: b.status || 'pending'
        }));
      }
      persistBookings();
    } catch (err) {
      if (err?.status === 401) {
        window.location.href = 'login.html';
        return;
      }
      if (err?.status === 403) {
        markSellerBlocked([{ source: 'bookings', message: err.uiMessage || err.message }]);
        return;
      }
      console.error('FETCH_BOOKINGS_FAILED', err);
    }

    Object.keys(bookedCache).forEach(k => delete bookedCache[k]);

    UIComponents.openModal('resv-modal');
    updateTodayBanner();
    scheduleMidnightTick();
    // Select today's weekday by default
    const todayJS = new Date().getDay();
    const idx = PERSIAN_WEEKDAYS.findIndex((w) => w.js === todayJS);
    selectDay(Math.max(0, idx));
    updateDayIndicators();
  }

  // tabs (weekdays)
  function selectDay(idx) {
    state.selectedIdx = idx;
    $$('#resv-week .resv-day-chip').forEach((b, i) => b.classList.toggle('active', i === idx));
    updateDateHint();
    renderTimes();
  }



  // === FIX: ابتدای هفته‌ی جاری (شنبه‌مبنا) را بده ===
function getWeekStartSaturday(base = new Date()) {
  const d = new Date(base);
  const js = d.getDay();                  // 0=یکشنبهٔ میلادی ... 6=شنبهٔ میلادی
  const sinceSaturday = (js - 6 + 7) % 7; // چند روز از "شنبه" گذشته؟
  d.setDate(d.getDate() - sinceSaturday);
  d.setHours(0, 0, 0, 0);
  return d;
}


// === FIX: تاریخ هر روز، در همان هفتهٔ جاری ===
function updateDateHint() {
  const weekStart = getWeekStartSaturday(new Date()); // شنبه همین هفته
  const target = new Date(weekStart);
  // ترتیب دکمه‌ها از "شنبه" تا "جمعه" است؛ پس همان index می‌شود آفست
  target.setDate(weekStart.getDate() + state.selectedIdx);

  el('resv-date-hint').textContent =
    `${PERSIAN_WEEKDAYS[state.selectedIdx].label} (${faDateShort(target)})`;
}

function currentDayISO() {
  const weekStart = getWeekStartSaturday(new Date());
  const d = new Date(weekStart);
  d.setDate(weekStart.getDate() + state.selectedIdx);
  const pad2 = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

  async function fetchBookedTimes(dateISO) {
    if (bookedCache[dateISO]) return bookedCache[dateISO];

    const seller = JSON.parse(localStorage.getItem('seller') || '{}');
    const sid = seller.id || seller._id;
    if (!sid) {
      bookedCache[dateISO] = new Set();
      return bookedCache[dateISO];
    }

    try {
      const res = await fetch(`${API_BASE}/api/booked-slots/${encodeURIComponent(sid)}?date=${encodeURIComponent(dateISO)}`, { credentials: 'include' });
      if (!res.ok) throw new Error('fail');
      const data = await res.json();
      bookedCache[dateISO] = new Set((data.times || []).map(normalizeTime));
    } catch (e) {
      console.error('fetch booked times failed', e);
      bookedCache[dateISO] = new Set();
    }
    return bookedCache[dateISO];
  }

  // compute slot status from MOCK_DATA + CustomerPrefs (فقط برای نمایش؛ در ذخیره‌سازی وضعیت نداریم)
  function getTimeSlotStatus(time, dateISO) {
    const bookings = (window.MOCK_DATA?.bookings || []);
    const prefs = window.CustomerPrefs ? CustomerPrefs.load() : {};
    const keyFor = (name) => (window.normalizeKey ? normalizeKey(name) : (name||'').toLowerCase());

    const sameTime = bookings.filter(b => {
      const bTime = normalizeTime(toEn(b.time));
      const tMatch = bTime === normalizeTime(time);
      const rawDate = b.dateISO || toEn((b.date || '').split(' ')[0]).replace(/\//g, '-');
      const bDate = rawDate.split('T')[0];
      return tMatch && (!dateISO || bDate === dateISO);
    });
    if (!sameTime.length) return 'available';

    const has = (st) => sameTime.some(b => b.status === st);
    const blockedCancel = sameTime.some(b => (prefs[keyFor(b.customerName)]?.blocked) && b.status === 'cancelled');

    if (blockedCancel)                           return 'blocked-cancelled';
    if (has('confirmed') || has('completed'))    return 'booked';
    if (has('pending'))                          return 'pending';
    if (has('cancelled'))                        return 'cancelled-available';
    return 'available';
  }

  // render time chips for selected day
  async function renderTimes() {
    const wrap = el('resv-times');
    const dayKey = String(PERSIAN_WEEKDAYS[state.selectedIdx].js);
    const times = [...(state.schedule[dayKey] || [])].sort();
    const dateISO = currentDayISO();
    const booked = await fetchBookedTimes(dateISO);

    if (!times.length) {
      wrap.innerHTML = `<div class="resv-empty">ساعتی ثبت نشده.</div>`;
      return;
    }

    const label = {
      booked: 'رزرو شده',
      pending: 'در انتظار تایید',
      'cancelled-available': 'لغو شده',
      'blocked-cancelled': 'لغو (مشتری مسدود)'
    };

    wrap.innerHTML = times.map((t) => {
      let st = getTimeSlotStatus(t, dateISO);
      if (booked.has(normalizeTime(t))) st = 'booked';
      const deletable = (st === 'available' || st === 'cancelled-available');
      return `
        <button type="button"
                class="time-chip${deletable ? '' : ' is-locked'} ${st}"
                data-time="${t}"
                data-status="${st}"
                ${deletable ? '' : 'aria-disabled="true"'}
                title="${deletable ? 'دوبار کلیک/تاچ = حذف' : (label[st] || '')}">
          <span class="time">${toFa(t)}</span>
          ${st !== 'available' ? `<span class="badge">${label[st] || ''}</span>` : ''}
        </button>
      `;
    }).join('');
  }

  // حذف با دابل‌کلیک/دابل‌تاچ
  function bindTimeDeleteHandlersOnce() {
    const wrap = el('resv-times');
    if (!wrap || wrap.dataset.dblBound) return;
    wrap.dataset.dblBound = '1';

    // دسکتاپ: دابل‌کلیک
    wrap.addEventListener('dblclick', handleTimeDelete);

    // موبایل: دابل‌تاچ (<= 300ms)
    let lastTap = 0;
    wrap.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        handleTimeDelete(e);
        lastTap = 0;
      } else {
        lastTap = now;
      }
    }, { passive: true });
  }

  function handleTimeDelete(e) {
    const chip = e.target.closest('.time-chip');
    if (!chip) return;

    const status = chip.dataset.status;
    if (status === 'booked' || status === 'pending') {
      UIComponents.showToast('این ساعت رزرو شده/در انتظار است و قابل حذف نیست.', 'error');
      return;
    }

    const t = chip.dataset.time;
    const dayKey = String(PERSIAN_WEEKDAYS[state.selectedIdx].js);
    const arr = state.schedule[dayKey] || [];
    const idx = arr.indexOf(t);
    if (idx === -1) return;

    chip.classList.add('removing');
    setTimeout(() => {
      arr.splice(idx, 1);
      state.schedule[dayKey] = arr;
      save();
      renderTimes();
      UIComponents.showToast(`ساعت ${toFa(t)} حذف شد.`, 'success');
    }, 160);
  }

  // یک‌بار در زمان لود اسکریپت
  bindTimeDeleteHandlersOnce();

  // add time
  function addTime() {
    const v = normalizeTime(el('resv-time-input')?.value);
    if (!v) { UIComponents.showToast('فرمت ساعت درست نیست.', 'error'); return; }
    const key = String(PERSIAN_WEEKDAYS[state.selectedIdx].js);
    const arr = state.schedule[key] || (state.schedule[key] = []);
    if (arr.includes(v)) { UIComponents.showToast('این ساعت از قبل ثبت شده.', 'info'); return; }
    arr.push(v);
    state.schedule[key] = arr.sort();
    save();
    el('resv-time-input').value = '';
    renderTimes();
  }

  // (اختیاری) حذف با کلیک روی ایکس اگر دکمه‌ای داشتید
  function handleDeleteClick(e) {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    const chip = del.closest('.time-chip');
    const t = chip?.dataset.time;
    if (!t) return;

    const dateISO = currentDayISO();
    const st = getTimeSlotStatus(t, dateISO);
    if (st === 'booked')  return UIComponents.showToast('این ساعت رزرو شده است.', 'info');
    if (st === 'pending') return UIComponents.showToast('این ساعت در انتظار تایید است.', 'info');

    const dayKey = String(PERSIAN_WEEKDAYS[state.selectedIdx].js);
    state.schedule[dayKey] = (state.schedule[dayKey] || []).filter(x => x !== t);
    save();
    renderTimes();
    UIComponents.showToast(`ساعت ${toFa(t)} حذف شد.`, 'success');
  }

  // copy sheet
  function openCopy() {
    const host = el('resv-copy'); const list = host.querySelector('.resv-copy-days');
    const fromIdx = state.selectedIdx;
    list.innerHTML = PERSIAN_WEEKDAYS.map((w, i) => `
      <label class="copy-chip">
        <input type="checkbox" value="${w.js}" ${i === fromIdx ? 'disabled' : ''}>
        <span>${w.label}</span>
      </label>
    `).join('');
    host.hidden = false;
  }
  function cancelCopy() { el('resv-copy').hidden = true; }

// Reform the applyCopy function to only copy time strings, ignoring statuses
function applyCopy() {
  const checks = Array.from(el('resv-copy').querySelectorAll('input[type="checkbox"]:checked'));
  const targets = checks.map(c => String(c.value));
  const srcKey = String(PERSIAN_WEEKDAYS[state.selectedIdx].js);
  // ✅ FIXED: Extract ONLY time strings, ignore any status
  const srcData = state.schedule[srcKey] || [];
  const srcTimes = [];
  srcData.forEach(item => {
    let timeStr = null;
    // Handle both string times and object formats
    if (typeof item === 'string') {
      timeStr = item;
    } else if (item && typeof item === 'object') {
      // If it's an object, extract just the time
      timeStr = item.time || item.value || null;
    }
    // Normalize and add only valid times
    const normalized = normalizeTime(timeStr);
    if (normalized && !srcTimes.includes(normalized)) {
      srcTimes.push(normalized);
    }
  });
  srcTimes.sort();
  if (!targets.length) {
    UIComponents.showToast('هیچ روزی انتخاب نشده.', 'info');
    return;
  }
  // ✅ Copy ONLY time strings to target days
  targets.forEach(k => {
    state.schedule[k] = [...srcTimes];
  });
  save();
  cancelCopy();
  UIComponents.showToast('✅ فقط ساعت‌ها کپی شد (بدون وضعیت)', 'success');
  // Refresh current view if needed
  if (targets.includes(srcKey)) renderTimes();
}

// Add this new function to clean existing data on load
function cleanScheduleData() {
  Object.keys(state.schedule).forEach(dayKey => {
    const cleaned = [];
    const dayData = state.schedule[dayKey] || [];
    dayData.forEach(item => {
      let timeStr = null;
      if (typeof item === 'string') {
        timeStr = item;
      } else if (item && typeof item === 'object') {
        timeStr = item.time || item.value || null;
      }
      const normalized = normalizeTime(timeStr);
      if (normalized && !cleaned.includes(normalized)) {
        cleaned.push(normalized);
      }
    });
    state.schedule[dayKey] = cleaned.sort();
  });
  save();
}

// cleaning is triggered after schedule load


// --- Force 24h input and allow flexible hour format
  function enforce24hTimeInput(id) {
    const input = document.getElementById(id);
    if (!input) return;

    input.type = 'text';
    input.setAttribute('inputmode', 'numeric');
    input.placeholder = 'HH:MM';

    input.addEventListener('input', (e) => {
      let v = toEn(e.target.value).replace(/[^\d]/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + ':' + v.slice(2);
      e.target.value = toFa(v);
    });

    input.addEventListener('blur', () => {
      const ok = normalizeTime(input.value);
      if (!ok) {
        input.value = '';
        UIComponents.showToast('فرمت ساعت باید HH:MM باشد.', 'info');
      } else {
        input.value = toFa(ok);
      }
    });

    const initVal = normalizeTime(input.value);
    if (initVal) input.value = toFa(initVal);
  }

  // wire up
  (function initReservationUI() {
    // بازکردن مودال
    window.openResvModal = openModal;
    el('open-reservations-btn')?.addEventListener('click', openModal);

    // تب‌های روزهای هفته
    $$('#resv-week .resv-day-chip').forEach((b, i) => b.addEventListener('click', () => selectDay(i)));

    // افزودن/حذف ساعت
    el('resv-add-btn')?.addEventListener('click', addTime);
    el('resv-time-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTime(); } });
    el('resv-times')?.addEventListener('click', handleDeleteClick);

    // کپی برنامه
    el('resv-copy-open')?.addEventListener('click', openCopy);
    el('resv-copy-cancel')?.addEventListener('click', cancelCopy);
    el('resv-copy-apply')?.addEventListener('click', applyCopy);

    // ذخیره
    el('resv-save')?.addEventListener('click', () => { save(); });

    // ورودی ۲۴ساعته
    enforce24hTimeInput('resv-time-input');
    enforce24hTimeInput('work-start');
    enforce24hTimeInput('work-end');
  })();
})();


});





window.customersData = window.customersData || [];





