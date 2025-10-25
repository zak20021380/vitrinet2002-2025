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
    perks: Array.isArray(raw.perks) && raw.perks.length ? raw.perks : PLAN_PERKS_DEFAULT
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

  bindPlanHeroActions();

  if (tierEl) tierEl.textContent = '🎖 پلن مهمان (رایگان)';

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
  if (progressBar) progressBar.style.width = `${progress}%`;
  if (usedEl) usedEl.textContent = `${progress}%`;
  if (leftEl) leftEl.textContent = `${Math.max(0, 100 - progress)}%`;

  if (statusChip) {
    statusChip.classList.remove('chip-live');
    if (plan.activeNow) {
      statusChip.textContent = 'دسترسی رایگان فعال';
      statusChip.classList.add('chip-live');
    } else if (plan.hasExpired) {
      statusChip.textContent = 'پلن رایگان منقضی شده';
    } else if (plan.isActive) {
      statusChip.textContent = 'پلن رایگان در انتظار شروع';
    } else {
      statusChip.textContent = 'پلن رایگان غیرفعال';
    }
  }

  if (perksList) {
    perksList.innerHTML = '';
    plan.perks.forEach((perk) => {
      const li = document.createElement('li');
      li.textContent = perk;
      perksList.appendChild(li);
    });
  }

  if (messageEl) {
    if (plan.note) {
      messageEl.textContent = plan.note;
    } else if (plan.activeNow) {
      const urgency = remainingDays != null
        ? (remainingDays <= 1
            ? 'امروز آخرین فرصت رایگان شماست،'
            : `هنوز ${faNumber(remainingDays)} روز از دوره رایگان باقی مانده،`)
        : '';
      const urgencyText = urgency ? `${urgency} ` : '';
      messageEl.textContent = `فعلاً از پلن رایگان ویترینت لذت ببرید! ${urgencyText}بدون دغدغه هزینه از ابزارهای ما استفاده کنید و هر زمان آماده بودید، از بخش پلن‌ها به نسخه‌های حرفه‌ای ارتقا دهید.`;
    } else if (plan.hasExpired) {
      messageEl.textContent = 'دوره رایگان شما به پایان رسیده است. برای ادامه استفاده از امکانات، پلن مناسب را انتخاب کنید یا با پشتیبانی جهت تمدید رایگان هماهنگ شوید.';
    } else if (plan.isActive) {
      const startText = startLabel ? `از ${startLabel}` : 'به‌زودی';
      messageEl.textContent = `پلن رایگان فروشگاه شما توسط مدیریت زمان‌بندی شده و ${startText} فعال خواهد شد. تا شروع دوره رایگان، اطلاعات از همینجا اعلام می‌شود.`;
    } else if (plansDisabled) {
      messageEl.textContent = 'پلن رایگان به‌طور سراسری توسط مدیریت غیرفعال شده است. به محض فعال‌سازی دوباره، جزئیات از همین بخش اطلاع‌رسانی می‌شود.';
    } else {
      messageEl.textContent = 'در حال حاضر پلن رایگان برای فروشگاه شما فعال نشده است. به محض اعطای دسترسی توسط مدیریت، جزئیات و زمان‌بندی از همین بخش نمایش داده خواهد شد.';
    }
  }

  let subtext = 'پلن‌های رایگان توسط تیم مدیریت ویترینت کنترل می‌شوند. برای پیگیری وضعیت، با پشتیبانی در ارتباط باشید.';
  if (plan.activeNow) {
    subtext = `این دسترسی رایگان توسط مدیریت ویترینت فعال شده${expiryLabel ? ` و تا ${expiryLabel} معتبر است` : ''}.`;
  } else if (plan.hasExpired) {
    subtext = 'دوره رایگان قبلی پایان یافته است. برای تمدید یا دریافت مجدد، با تیم پشتیبانی ویترینت هماهنگ کنید.';
  } else if (plan.isActive) {
    subtext = startLabel
      ? `پلن رایگان شما از ${startLabel} توسط مدیریت فعال خواهد شد و در همین صفحه وضعیت آن بروزرسانی می‌شود.`
      : 'پلن رایگان شما توسط مدیریت زمان‌بندی شده است و پس از شروع در همین صفحه به‌روزرسانی خواهد شد.';
  } else if (plansDisabled) {
    subtext = 'تیم مدیریت به طور موقت دسترسی به پلن‌های رایگان را غیرفعال کرده است؛ به محض تغییر وضعیت، اطلاع‌رسانی می‌شود.';
  }
  if (subtextEl) {
    subtextEl.textContent = subtext;
  }
}

async function loadComplimentaryPlan() {
  try {
    const response = await API.getComplimentaryPlan();
    const plan = response?.plan || null;
    renderComplimentaryPlan(plan);
    window.__COMPLIMENTARY_PLAN__ = plan;
  } catch (err) {
    console.warn('loadComplimentaryPlan failed', err);
    renderComplimentaryPlan(null);
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
    if (!res.ok) {
      throw new Error(`COMPLIMENTARY_PLAN_HTTP_${res.status}`);
    }
    return await this._json(res);
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
    
    const bookingsPromise = API.getBookings().catch(err => {
      console.error('Bookings promise rejected:', err);
      if (err && err.status === 401) {
        console.error('Unauthorized - redirecting to login');
        throw err;
      }
      console.error('FETCH_BOOKINGS_FAILED', err);
      return [];
    });

    console.log('Making parallel API requests...');
    
    const [sellerRes, servicesRes, bookings] = await Promise.all([
      fetch(bust(`${API_BASE}/api/sellers/me`), { credentials: 'include', ...NO_CACHE }),
      fetch(bust(`${API_BASE}/api/seller-services/me/services`), { credentials: 'include', ...NO_CACHE }),
      bookingsPromise
    ]);

    console.log('API responses received:', {
      sellerResStatus: sellerRes.status,
      servicesResStatus: servicesRes.status,
      bookingsLength: Array.isArray(bookings) ? bookings.length : 'not array'
    });

    if (sellerRes.status === 401 || servicesRes.status === 401) {
      console.log('Authentication failed - redirecting to login');
      window.location.href = 'login.html';
      return;
    }

    const localBookings = JSON.parse(localStorage.getItem('vitreenet-bookings') || '[]');
    const previousBookingKeys = collectBookingKeys(localBookings);
    console.log('Local bookings count:', localBookings.length);

    // Enhanced booking data handling with better error logging
    if (Array.isArray(bookings) && bookings.length) {
      console.log('Successfully fetched bookings from server:', bookings);
      const statusMap = new Map(localBookings.map(b => [(b._id || b.id), b.status]));
      MOCK_DATA.bookings = bookings.map(b => {
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
    const candidateNewBookings = (Array.isArray(bookings) && bookings.length)
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
        category: seller.category,
        phone: seller.phone,
        address: seller.address
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
      StorageManager.set('vit_services', svcs);
      const listEl = document.getElementById('services-list');
      if (listEl) {
        listEl.innerHTML = svcs.map(s => `
          <div class="item-card" data-id="${s._id || s.id}">
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
      category: 'سرویس',
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
      address: 'آدرس نامشخص'
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

// دریافت مشتریان واقعی فروشنده
async function loadCustomers() {
  try {
    const res = await fetch(`${API_BASE}/api/loyalty/customers`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();

    const mapped = data.map(c => ({
      id: String(c.id || c.userId || c._id),
      name: c.name || '-',
      phone: c.phone || '-',
      lastReservation: c.lastReservation || '',
      pendingRewards: c.pending || 0,
      vipCurrent: c.completed || 0,
      rewardCount: c.claimed || 0
    }));

    MOCK_DATA.customers = mapped;
    window.customersData = mapped.map(c => ({
      id: c.id,
      name: c.name,
      vipCurrent: c.vipCurrent,
      rewardCount: c.rewardCount,
      lastReservationAt: c.lastReservation
    }));

    if (typeof app !== 'undefined' && app.renderCustomers) {
      app.renderCustomers();
    }

    // اطلاع‌رسانی به رابط VIP برای بروزرسانی آمار پس از بارگذاری مشتریان
    document.dispatchEvent(new Event('vip:refresh'));
  } catch (err) {
    console.error('loadCustomers', err);
  }
}

// Handle approve/reject reward actions
async function handleRewardAction(userId, action) {
  try {
    await fetch(`${API_BASE}/api/loyalty/requests/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, action })
    });
    if (typeof UIComponents !== 'undefined' && UIComponents.showToast) {
      UIComponents.showToast(action === 'approve' ? 'جایزه تایید شد' : 'درخواست رد شد', action === 'approve' ? 'success' : 'error');
    }
    await loadCustomers();
  } catch (err) {
    console.error('handleRewardAction', err);
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
  const toEnglish = s => s.replace(/[۰-۹]/g, d => latinDigits[persianDigits.indexOf(d)]);
  const toPersian = s => s.replace(/[0-9]/g, d => persianDigits[d]);

  const target = toEnglish(String(dateStr).trim());
  const fmt = d => new Intl.DateTimeFormat(
    'fa-IR-u-nu-latn-ca-persian',
    { year: 'numeric', month: '2-digit', day: '2-digit' }
  ).format(d);

  const today = new Date();
  const todayStr = fmt(today);
  const yesterdayStr = fmt(new Date(today.getTime() - 86400000));
  const tomorrowStr = fmt(new Date(today.getTime() + 86400000));

  if (target === todayStr) return 'امروز';
  if (target === yesterdayStr) return 'دیروز';
  if (target === tomorrowStr) return 'فردا';
  return toPersian(target);
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

  add(text, type = 'info') {
    const items = this.load();
    items.push({
      id: 'n' + Date.now(),
      type,
      text,
      time: new Date().toLocaleTimeString('fa-IR'),
      read: false
    });
    this.save(items);
    this.render();
  },

  render() {
    const items = this.load();
    const unread = items.filter(n => !n.read).length;

    // badge
    if (this._els.badge) {
      if (unread > 0) {
        this._els.badge.textContent = unread.toString();
        this._els.badge.hidden = false;
      } else {
        this._els.badge.textContent = '';
        this._els.badge.hidden = true;
      }
    }

    // لیست / حالت خالی
    if (!this._els.list) return;
    if (items.length === 0) {
      this._els.list.innerHTML = '';
      this._els.empty?.removeAttribute('hidden');
      return;
    }
    this._els.empty?.setAttribute('hidden', '');

    this._els.list.innerHTML = items.map(n => `
      <li class="notification-item ${n.read ? 'is-read' : 'is-unread'}" data-id="${n.id}" role="listitem" tabindex="0">
        <div class="notif-row">
          <div class="notif-icon ${n.type || 'info'}" aria-hidden="true"></div>
          <div class="notif-content">
            <div class="notif-text">${n.text}</div>
            <time class="notif-time">${n.time || ''}</time>
          </div>
          <button class="notif-delete" aria-label="حذف اعلان">×</button>
        </div>
      </li>
    `).join('');
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
    if (e.target.closest('.modal-close-floating')) {
      e.preventDefault();
      e.stopPropagation();
      UIComponents.closeModal('customer-details-modal');
    }
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
      this.topPeersData = null;
      this._topPeersPromise = null;
      this.topPeersAutoRefreshInterval = null;
      this.topPeersAutoRefreshMs = 60000;

      this.setFeatureFlags(flags);

      // Initialize Services, Portfolio, VIP & customer features
      this.initServices();
      this.initPortfolio();
      this.initVipSettings();
      this.initCustomerFeatures();

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

      plansView: document.getElementById('plans-view'),
      customerSearch: document.getElementById('customer-search'),
      bookingsFilter: document.querySelector('#bookings-view .filter-chips'),
      reviewsFilter: document.querySelector('#reviews-view .filter-chips'),
      settingsForm: document.getElementById('settings-form'),
      rankCard: document.getElementById('rank-card'),
      topRefreshBtn: document.getElementById('top-refresh-btn'),
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
  
  // Find the parent modal or drawer
  let container = dismissTarget.closest('.modal, .drawer');
  
  // Special handling for customer modal close button
  if (dismissTarget.classList.contains('modal-close-floating')) {
    container = document.getElementById('customer-details-modal');
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
      element: elements.topRefreshBtn,
      handler: () => {
        this.renderTopPeers(true);
        this.restartTopPeersAutoRefresh();
      }
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

  // === PATCH: checkout bar close/open (plans) — DO NOT TOUCH ANYTHING ELSE ===
  const checkoutBar = document.getElementById('checkout-bar');
  if (checkoutBar) {
    // close (X) on sticky checkout bar
    checkoutBar.querySelector('.cb-close')?.addEventListener('click', () => {
      checkoutBar.classList.remove('visible');
      checkoutBar.setAttribute('aria-hidden', 'true');
    });

    // open the bar when any plan CTA is clicked
    document.querySelectorAll('.plan-cta-modern').forEach(btn => {
      btn.addEventListener('click', () => {
        checkoutBar.classList.add('visible');
        checkoutBar.setAttribute('aria-hidden', 'false');
      });
    });
  }

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
    }
    renderPageContent(page) {
      switch(page) {
        case 'dashboard': this.renderDashboard(); break;
        case 'bookings': this.renderBookings(); break;
        case 'customers': this.renderCustomers(); break;
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

      const intervalMs = Math.max(15000, Number(this.topPeersAutoRefreshMs) || 60000);
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
        el.textContent = UIComponents.formatPersianNumber(new Date().toLocaleDateString('fa-IR'));
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

handlePlanDurationChange(e) {
    const selector = document.querySelector('.duration-selector-modern');
    if (!selector) return;
    
    let selectedTab;
    if (e && e.target) {
        selectedTab = e.target.closest('.duration-tab');
        if (!selectedTab) return;
    } else {
        selectedTab = selector.querySelector('.duration-tab.active');
    }
    
    // Update active states
    selector.querySelectorAll('.duration-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    selectedTab.classList.add('active');
    
    // Move indicator
    const tabs = Array.from(selector.querySelectorAll('.duration-tab'));
    const index = tabs.indexOf(selectedTab);
    const indicator = selector.querySelector('.duration-indicator');
    if (indicator) {
        indicator.style.left = `${4 + (index * 33.333)}%`;
    }
    
    // Get duration
    const duration = parseInt(selectedTab.dataset.duration);
    
    // Update all plan cards
    document.querySelectorAll('.plan-modern').forEach(card => {
        const priceEl = card.querySelector('.price-value');
        const periodEl = card.querySelector('.period-value');
        const savingsEl = card.querySelector('.price-savings');
        const savingsAmountEl = card.querySelector('.savings-amount');
        
        if (!priceEl) return;
        
        const basePrice = parseInt(priceEl.dataset['1']);
        let totalPrice, periodText, discount = 0;
        
        switch(duration) {
            case 1:
                totalPrice = basePrice;
                periodText = '۱ ماه';
                break;
            case 2:
                totalPrice = basePrice * 2 * 0.9; // 10% discount
                periodText = '۲ ماه';
                discount = 10;
                break;
            case 3:
                totalPrice = basePrice * 3 * 0.8; // 20% discount
                periodText = '۳ ماه';
                discount = 20;
                break;
        }
        
        // Update price display with animation
        priceEl.style.transform = 'scale(0.9)';
        setTimeout(() => {
            priceEl.textContent = new Intl.NumberFormat('fa-IR').format(Math.round(totalPrice));
            priceEl.style.transform = 'scale(1)';
        }, 150);
        
        if (periodEl) periodEl.textContent = periodText;
        
        // Show/hide savings
        if (discount > 0 && savingsEl) {
            savingsEl.classList.remove('hidden');
            const saved = (basePrice * duration) - totalPrice;
            savingsAmountEl.textContent = `${new Intl.NumberFormat('fa-IR').format(Math.round(saved))} تومان صرفه‌جویی`;
        } else if (savingsEl) {
            savingsEl.classList.add('hidden');
        }
    });
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
    filterCustomers(query) {
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
      const approveBtn = e.target.closest('.reward-approve');
      const rejectBtn  = e.target.closest('.reward-reject');
      if (approveBtn) {
        handleRewardAction(approveBtn.dataset.userId, 'approve');
        e.stopPropagation();
        return;
      }
      if (rejectBtn) {
        handleRewardAction(rejectBtn.dataset.userId, 'reject');
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
  const normalizedQuery = query.trim().toLowerCase();

  const filteredCustomers = MOCK_DATA.customers.filter(c =>
    c.name.toLowerCase().includes(normalizedQuery) ||
    c.phone.includes(normalizedQuery)
  );

  if (filteredCustomers.length === 0) {
    listEl.innerHTML = `<p>مشتری با این مشخصات یافت نشد.</p>`;
    return;
  }

  listEl.innerHTML = filteredCustomers.map(c => {
    return `
      <article class="customer-card card"
               role="listitem" tabindex="0"
               data-name="${c.name}" data-phone="${c.phone}" data-user-id="${c.id}">
        <div class="customer-avatar" aria-hidden="true">${c.name.charAt(0)}</div>
        <div class="customer-info">
          <div class="customer-name">${c.name}</div>
          <div class="customer-phone">${UIComponents.formatPersianNumber(c.phone)}</div>
          <div class="customer-last-reservation">آخرین رزرو نوبت: ${UIComponents.formatRelativeDate(c.lastReservation)}</div>
        </div>
        ${c.pendingRewards ? `
        <div class="customer-reward" style="margin-top:8px;">
          <span class="status-badge status-pending" style="margin-left:8px;">درخواست جایزه (${c.pendingRewards})</span>
          <button type="button" class="btn-success reward-approve" data-user-id="${c.id}">تایید</button>
          <button type="button" class="btn-danger reward-reject" data-user-id="${c.id}">رد</button>
        </div>` : ''}
      </article>
    `;
  }).join('');
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

_handleFooterUpload(evt){
  const file = evt.target.files && evt.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    this.brandImages.footer = reader.result;
    this.applyBrandImages();
  };
  reader.readAsDataURL(file);

  const formData = new FormData();
  formData.append('image', file);

  fetch(`${API_BASE}/api/branding/footer`, {
    method:'POST',
    body: formData,
    credentials:'include'
  })
    .then(res => {
      if(!res.ok) throw new Error();
      UIComponents.showToast('تصویر فوتر ذخیره شد.', 'success');
    })
    .catch(() => UIComponents.showToast('خطا در آپلود تصویر.', 'error'));
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


(() => {
  const root = document;
  const plansView = root.getElementById('plans-view');
  if (!plansView) return;

  const nf = (n) => new Intl.NumberFormat('fa-IR').format(Math.round(n));

  // State
  const state = {
    duration: 3,          // پیش‌فرض: فقط مدت، نه انتخاب پلن
    selectedPlanKey: null,
    couponPct: 0
  };

  // Elements
  const tabs = Array.from(plansView.querySelectorAll('.duration-tab'));
  const indicator = plansView.querySelector('.duration-indicator');
  const cards = Array.from(plansView.querySelectorAll('.plan-modern'));
  const checkoutBar = plansView.querySelector('#checkout-bar');
  if (!checkoutBar) { window.__PLANS_CHECKOUT_CONTROLLER_INITIALIZED__ = true; return; }
  const cbPlan = checkoutBar.querySelector('.cb-plan');
  const cbDuration = checkoutBar.querySelector('.cb-duration');
  const cbSaving = checkoutBar.querySelector('.cb-saving');
  const cbTotal = checkoutBar.querySelector('.cb-total');
  const couponToggle = checkoutBar.querySelector('.cb-coupon-toggle');
  const couponRow = checkoutBar.querySelector('.cb-coupon');
  const couponInput = checkoutBar.querySelector('#coupon-input');
  const couponApply = checkoutBar.querySelector('.cb-apply');

  // Helpers
  const getBasePrice = (card) => {
    const el = card.querySelector('.price-value');
    return el ? parseInt(el.dataset['1'], 10) : 0;
  };
  const getDiscountPct = (duration) => (duration === 2 ? 10 : duration === 3 ? 20 : 0);
  const calcTotal = (base, duration) => {
    const disc = getDiscountPct(duration);
    const gross = base * duration * (1 - disc/100);
    const afterCoupon = gross * (1 - state.couponPct/100);
    return { gross, afterCoupon, disc };
  };
  const updateIndicator = () => {
    if (!indicator) return;
    const activeIndex = Math.max(0, tabs.findIndex(t => t.classList.contains('active')));
    indicator.style.transform = `translateX(${activeIndex * 100}%)`;
  };

  const updateCard = (card) => {
    const priceEl = card.querySelector('.price-value');
    const periodEl = card.querySelector('.period-value');
    const savingsWrap = card.querySelector('.price-savings');
    const savingsAmountEl = card.querySelector('.savings-amount');
    if (!priceEl || !periodEl) return;

    const base = getBasePrice(card);
    const { gross, disc } = calcTotal(base, state.duration);

    periodEl.textContent = state.duration === 1 ? '۱ ماه' : (state.duration === 2 ? '۲ ماه' : '۳ ماه');

    priceEl.style.transform = 'scale(0.92)';
    setTimeout(() => {
      priceEl.textContent = nf(gross);
      priceEl.style.transform = 'scale(1)';
    }, 130);

    if (savingsWrap && savingsAmountEl) {
      if (disc > 0) {
        const saved = base * state.duration - gross;
        savingsWrap.classList.remove('hidden');
        savingsAmountEl.textContent = `${nf(saved)} تومان صرفه‌جویی`;
      } else {
        savingsWrap.classList.add('hidden');
      }
    }
  };

  const updateAllCards = () => cards.forEach(updateCard);

  // فقط وقتی پلنی انتخاب شده باشه نوار رو نشون بده
  const updateCheckout = () => {
    const selected = plansView.querySelector('.plan-modern.selected');

    if (!selected) {
      checkoutBar.classList.remove('visible');
      checkoutBar.setAttribute('aria-hidden', 'true');
      cbPlan.textContent = '—';
      cbDuration.textContent = state.duration === 1 ? '۱ ماهه' : (state.duration === 2 ? '۲ ماهه' : '۳ ماهه');
      cbSaving.textContent = '';
      cbSaving.style.display = 'none';
      cbTotal.textContent = '—';
      return;
    }

    const name = selected.querySelector('.plan-title-card')?.textContent?.trim() || '-';
    const base = getBasePrice(selected);
    const { afterCoupon, disc } = calcTotal(base, state.duration);

    cbPlan.textContent = name;
    cbDuration.textContent = state.duration === 1 ? '۱ ماهه' : (state.duration === 2 ? '۲ ماهه' : '۳ ماهه');

    const parts = [];
    if (disc > 0) parts.push(`${disc}%`);
    if (state.couponPct > 0) parts.push(`+ ${state.couponPct}% کد`);
    cbSaving.textContent = parts.length ? `تخفیف: ${parts.join(' ')}` : '';
    cbSaving.style.display = parts.length ? 'inline-block' : 'none';

    cbTotal.textContent = nf(afterCoupon) + ' تومان';

    checkoutBar.classList.add('visible');
    checkoutBar.setAttribute('aria-hidden', 'false');
  };

  const selectPlan = (card) => {
    cards.forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.selectedPlanKey = card.dataset.plan || null;
    updateCheckout();
  };

  // Tabs (مدت اشتراک)
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.duration = parseInt(tab.dataset.duration, 10) || 1;
      updateIndicator();
      updateAllCards();
      updateCheckout(); // اگر پلنی انتخاب نشده باشه مخفی می‌مونه
    });
  });

  // انتخاب/لغو انتخاب پلن (toggle)
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      const actionable = e.target.closest('.plan-cta-modern') || e.currentTarget === card;
      if (!actionable) return;

      if (card.classList.contains('selected')) {
        // دسیلکت → نوار بسته شود
        card.classList.remove('selected');
        state.selectedPlanKey = null;
        updateCheckout();
      } else {
        selectPlan(card);
      }
    });
  });

  // Coupon
  couponToggle.addEventListener('click', () => {
    const open = !couponRow.hasAttribute('hidden');
    if (open) {
      couponRow.setAttribute('hidden', '');
      couponToggle.setAttribute('aria-expanded', 'false');
    } else {
      couponRow.removeAttribute('hidden');
      couponToggle.setAttribute('aria-expanded', 'true');
      couponInput.focus();
    }
  });

  couponApply.addEventListener('click', () => {
    const code = (couponInput.value || '').trim().toUpperCase();
    const map = { 'OFF10': 10, 'VIP15': 15 }; // دموی تست
    state.couponPct = map[code] || 0;
    (window.UIComponents?.showToast) && UIComponents.showToast(
      map[code] ? 'کد تخفیف اعمال شد.' : 'کد معتبر نیست.',
      map[code] ? 'success' : 'error'
    );
    updateAllCards();
    updateCheckout();
  });

  // CTA Demo
  checkoutBar.querySelector('.cb-cta')?.addEventListener('click', () => {
    (window.UIComponents?.showToast) && UIComponents.showToast('درگاه پرداخت به‌زودی متصل می‌شود.', 'success');
  });

  // === Init ===
  // فقط مدت را تنظیم کن؛ هیچ پلنی را پیش‌فرض انتخاب نکن
  const defaultTab = tabs.find(t => t.classList.contains('active')) || tabs[2] || tabs[0];
defaultTab?.click();
  updateCheckout();             // چون چیزی انتخاب نشده، نوار مخفی می‌ماند

  window.__PLANS_CHECKOUT_CONTROLLER_INITIALIZED__ = true;
})();

(function(){
  if (window.__PLANS_CHECKOUT_CONTROLLER_INITIALIZED__) return;

  const plansView   = document.getElementById('plans-view');
  const checkoutBar = document.getElementById('checkout-bar');
  if (!plansView || !checkoutBar) return;

  // عناصر نوار پرداخت
  const cbPlan        = checkoutBar.querySelector('.cb-plan');
  const cbDuration    = checkoutBar.querySelector('.cb-duration');
  const cbSaving      = checkoutBar.querySelector('.cb-saving');
  const cbTotal       = checkoutBar.querySelector('.cb-total');
  const cbClose       = checkoutBar.querySelector('.cb-close');
  const couponToggle  = checkoutBar.querySelector('.cb-coupon-toggle');
  const couponRow     = checkoutBar.querySelector('.cb-coupon');
  const couponInput   = document.getElementById('coupon-input');
  const couponApply   = checkoutBar.querySelector('.cb-apply');

  // کارت‌ها و تب‌های مدت
  const cards         = Array.from(plansView.querySelectorAll('.plan-modern'));
  const durationRoot  = plansView.querySelector('.duration-selector-modern');
  const durationTabs  = Array.from(plansView.querySelectorAll('.duration-tab'));

  // ابزارک‌ها
  const nf = (n) => new Intl.NumberFormat('fa-IR').format(Math.round(n));

  // وضعیت داخلی صفحه پلن‌ها
  const state = {
    duration: parseInt(plansView.querySelector('.duration-tab.active')?.dataset.duration || '3', 10),
    selectedPlanKey: null,   // 'professional' | 'essential' | 'enterprise' | null
    couponPct: 0,            // درصد تخفیف کد
    dismissed: false         // کاربر دستی بسته؟ (بله = true)
  };

  // قیمت پایه هر کارت از data-1
  const getBasePrice = (card) => {
    const el = card.querySelector('.price-value');
    return parseInt(el?.dataset['1'] || '0', 10) || 0;
  };

  // محاسبه مجموع با تخفیف مدت و کوپن
  const calcTotal = (base, months) => {
    let gross = base * months;
    let disc = months === 2 ? 10 : months === 3 ? 20 : 0; // 2 ماه =10% ، 3 ماه =20%
    let afterDuration = gross * (1 - disc / 100);
    let afterCoupon   = afterDuration * (1 - state.couponPct / 100);
    return { gross, disc, afterDuration, afterCoupon };
  };

  // به‌روزرسانی نمایش قیمت روی خودِ کارت‌ها هم (برای وقتی مدت عوض میشه)
  const updateCardsForDuration = (months) => {
    plansView.querySelectorAll('.plan-modern').forEach(card => {
      const priceEl        = card.querySelector('.price-value');
      const periodEl       = card.querySelector('.period-value');
      const savingsWrap    = card.querySelector('.price-savings');
      const savingsAmount  = card.querySelector('.savings-amount');
      if (!priceEl) return;

      const base = getBasePrice(card);
      const disc = months === 2 ? 10 : months === 3 ? 20 : 0;
      const total = base * months * (1 - disc/100);
      priceEl.style.transform = 'scale(0.9)';
      setTimeout(() => {
        priceEl.textContent = nf(total);
        priceEl.style.transform = 'scale(1)';
      }, 120);

      if (periodEl) periodEl.textContent = (months===1?'۱ ماه': months===2?'۲ ماه':'۳ ماه');
      if (savingsWrap) {
        if (disc > 0) {
          const saved = (base * months) - total;
          savingsWrap.classList.remove('hidden');
          if (savingsAmount) savingsAmount.textContent = `${nf(saved)} تومان صرفه‌جویی`;
        } else {
          savingsWrap.classList.add('hidden');
        }
      }
    });
  };

  // باز/بسته کردن نوار پرداخت بر اساس state
  const updateCheckout = () => {
    const selected = state.selectedPlanKey
      ? plansView.querySelector(`.plan-modern[data-plan="${state.selectedPlanKey}"]`)
      : null;

    if (state.dismissed || !selected) {
      checkoutBar.classList.remove('visible');
      checkoutBar.setAttribute('aria-hidden','true');
      return;
    }

    const name = selected.querySelector('.plan-title-card')?.textContent?.trim() || '—';
    const base = getBasePrice(selected);
    const { afterCoupon, disc } = calcTotal(base, state.duration);

    cbPlan.textContent = name;
    cbDuration.textContent = (state.duration===1?'۱ ماهه': state.duration===2?'۲ ماهه':'۳ ماهه');

    const tags = [];
    if (disc > 0) tags.push(`${disc}%`);
    if (state.couponPct > 0) tags.push(`+ ${state.couponPct}% کد`);
    cbSaving.textContent = tags.length ? `تخفیف: ${tags.join(' ')}` : '';
    cbSaving.style.display = tags.length ? 'inline-block' : 'none';

    cbTotal.textContent = `${nf(afterCoupon)} تومان`;

    checkoutBar.classList.add('visible');
    checkoutBar.setAttribute('aria-hidden','false');
  };

  // انتخاب یک کارت پلن
  const selectPlan = (card) => {
    cards.forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.selectedPlanKey = card.dataset.plan || null;
    state.dismissed = false; // انتخابِ پلن = اجازه بده نوار باز شه
    updateCheckout();
  };

  // کلیک روی کارت‌ها/CTA → انتخاب پلن
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      // فقط وقتی روی خود کارت یا CTA کلیک شد
      if (!(e.target.closest('.plan-cta-modern') || e.currentTarget === card)) return;
      e.stopPropagation(); // نذار کلیک بیرون، همون لحظه ببندتش
      selectPlan(card);
    });
  });

  // تغییر مدت (۱/۲/۳)
  if (durationRoot) {
    durationRoot.addEventListener('click', (e) => {
      const tab = e.target.closest('.duration-tab');
      if (!tab) return;

      // Active state تب‌ها
      durationTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // حرکت اسلایدر مدت
      const tabs = Array.from(durationTabs);
      const index = tabs.indexOf(tab);
      const indicator = durationRoot.querySelector('.duration-indicator');
      if (indicator) indicator.style.left = `${4 + (index * 33.333)}%`;

      // آپدیت وضعیت و UI
      state.duration = parseInt(tab.dataset.duration, 10) || 3;
      updateCardsForDuration(state.duration);
      updateCheckout(); // اگر نوار باز است، مبلغش هم عوض شود
    });
  }

  // باز/بستن فُرم کد تخفیف
  couponToggle?.addEventListener('click', () => {
    const isOpen = !couponRow?.hasAttribute('hidden');
    if (couponRow) couponRow.toggleAttribute('hidden');
    couponToggle.setAttribute('aria-expanded', String(!isOpen));
  });

  // اعمال کد تخفیف (دموی ساده: هر متنی = ۱۰٪)
  couponApply?.addEventListener('click', () => {
    const code = couponInput?.value?.trim();
    state.couponPct = code ? 10 : 0;
    updateCheckout();
    if (window.UIComponents?.showToast) {
      UIComponents.showToast(
        state.couponPct ? 'کد تخفیف ۱۰٪ اعمال شد.' : 'کد نامعتبر بود.',
        state.couponPct ? 'success' : 'error'
      );
    }
  });

  // دکمه ضربدر
  cbClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.dismissed = true;
    updateCheckout();
  });

  // کلیک بیرون از نوار → ببند
  document.addEventListener('click', (e) => {
    if (!checkoutBar.classList.contains('visible')) return;
    if (checkoutBar.contains(e.target)) return;      // کلیک داخل خود نوار
    if (e.target.closest('.plan-modern')) return;    // کلیک روی کارت‌ها (اون‌ها خودشون مدیریت می‌کنن)
    state.dismissed = true;
    updateCheckout();
  }, true); // useCapture برای جلوگیری از تداخل با bubbling

  // جابه‌جایی سکشن‌ها (hashchange)
  window.addEventListener('hashchange', () => {
    const onPlans = location.hash === '#/plans';
    if (!onPlans) {
      // از صفحه پلن‌ها رفتی بیرون → بسته باشه
      checkoutBar.classList.remove('visible');
      checkoutBar.setAttribute('aria-hidden','true');
    } else {
      // برگشتی به پلن‌ها → اگر قبلاً دستی بسته بودی، بسته می‌مونه
      updateCheckout();
    }
  });

  // مقداردهی اولیه: کارت‌ها/قیمت‌ها برای مدت پیش‌فرض
  updateCardsForDuration(state.duration);
  updateCheckout(); // خودکار باز نمی‌کنیم تا کاربر انتخاب کند
})();


window.customersData = window.customersData || [];

(function(){
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  // 1) منبع داده‌ها
  function getVipRequired(){
    const fromInput = document.getElementById('vip-required');
    const v = parseInt(fromInput?.value, 10);
    return Number.isFinite(v) && v > 0 ? v : 5; // پیش‌فرض ۵
  }

  function normalizeCustomers(raw){
    // خروجی استاندارد:
    // { id, name, reservations, rewardCount, lastReservationAt, vipCurrent, vipRequired }
    return raw.map(c => ({
      id: c.id ?? c._id ?? c.phone ?? c.name,
      name: c.name ?? c.fullName ?? 'بدون‌نام',
      reservations: c.reservations ?? c.totalReservations ?? c.stats?.reservations ?? 0,
      rewardCount: c.rewardCount ?? c.vip?.rewards ?? c.rewards ?? 0,
      vipCurrent: c.vipCurrent ?? c.vip?.current ?? c.stats?.vipCurrent ?? c.reservations ?? 0,
      vipRequired: c.vipRequired ?? c.vip?.required ?? c.stats?.vipRequired ?? getVipRequired(),
      lastReservationAt: c.lastReservationAt ?? c.lastAt ?? null,
    }));
  }

  function collectCustomers(){
    try{
      if (window.CUSTOMERS_STORE?.getAll){
        return normalizeCustomers(window.CUSTOMERS_STORE.getAll());
      }
      if (Array.isArray(window.customersData)){
        return normalizeCustomers(window.customersData);
      }
    }catch(e){}

    // از DOM (اگر کارت‌ها data-* داشته باشند)
    const cards = $$('#customers-list .customer-card');
    if(cards.length){
      return cards.map(el => ({
        id: el.dataset.id || el.querySelector('.customer-phone')?.textContent?.trim() || el.querySelector('.customer-name')?.textContent?.trim(),
        name: el.querySelector('.customer-name')?.textContent?.trim() || 'بدون‌نام',
        reservations: parseInt(el.dataset.reservations || '0', 10),
        rewardCount: parseInt(el.dataset.rewards || '0', 10),
        vipCurrent: parseInt(el.dataset.vipCurrent || el.dataset.reservations || '0', 10),
        vipRequired: parseInt(el.dataset.vipRequired || getVipRequired(), 10),
        lastReservationAt: el.dataset.lastReservationAt || null
      }));
    }
    return [];
  }

  // 2) باکت‌ها
  let buckets = { eligible: [], oneaway: [], claimed: [] };

  function computeBuckets(list){
    // معیارها:
    // eligible: به حد نصاب رسیده ولی هنوز claim نشده (rewardCount == 0)
    // oneaway: یک رزرو تا حد نصاب فاصله دارد
    // claimed: حداقل یک بار جایزه گرفته‌اند
    const eligible = [];
    const oneaway = [];
    const claimed  = [];
    list.forEach(c => {
      const req = c.vipRequired ?? getVipRequired();
      const cur = c.vipCurrent ?? 0;
      const hasClaim = (c.rewardCount ?? 0) > 0;

      if (hasClaim){
        claimed.push(c);
      }
      if (cur >= req && !hasClaim){
        eligible.push(c);
      }else if (cur === req - 1){
        oneaway.push(c);
      }
    });
    return { eligible, oneaway, claimed };
  }

  // 3) رندر شمارنده‌ها
  function renderCounts(b){
    $('#vip-count-eligible').textContent = b.eligible.length.toLocaleString('fa-IR');
    $('#vip-count-oneaway').textContent  = b.oneaway.length.toLocaleString('fa-IR');
    $('#vip-count-claimed').textContent  = b.claimed.length.toLocaleString('fa-IR');
  }

  // بروزرسانی باکت‌ها و شمارنده‌ها از داده‌های فعلی
  function updateBuckets(){
    buckets = computeBuckets(collectCustomers());
    renderCounts(buckets);
  }

  // 4) رندر لیست نام‌ها
  function renderNames(title, arr){
    $('#vip-panel-title').textContent = title;
    const list = $('#vip-list');
    list.innerHTML = '';
    if(!arr.length){
      $('#vip-empty').hidden = false;
      return;
    }
    $('#vip-empty').hidden = true;
    const frag = document.createDocumentFragment();
    arr.forEach(c => {
      const pill = document.createElement('span');
      pill.className = 'vip-pill';
      pill.textContent = c.name;
      pill.title = `${c.name} — رزروها: ${c.reservations ?? 0}`;
      pill.dataset.id = c.id;
      frag.appendChild(pill);
    });
    list.appendChild(frag);
  }

  // 5) فیلتر لیست (در صورت وجود data-id روی کارت‌ها)
  function filterListByIds(ids){
    const cards = $$('#customers-list .customer-card');
    if(!cards.length) return; // رندر خارجی؛ صرفاً پنل را نشان بده
    if(!ids || !ids.length){
      cards.forEach(el => el.hidden = false);
      return;
    }
    const set = new Set(ids);
    cards.forEach(el => {
      const id = el.dataset.id || el.querySelector('.customer-name')?.textContent?.trim();
      el.hidden = !set.has(id);
    });
  }

  // 6) راه‌اندازی
  function initVipUI(){
    const root = $('#vip-stats');
    if(!root) return;

    const panel = $('#vip-stats-panel');
    const closeBtn = $('#vip-close-panel');

    function openPanel(kind){
      const map = {
        eligible: { title: 'واجد جایزه', arr: buckets.eligible },
        oneaway:  { title: 'یک‌قدم تا جایزه', arr: buckets.oneaway },
        claimed:  { title: 'جایزه‌گرفته‌اند', arr: buckets.claimed },
      };
      const { title, arr } = map[kind] || map.eligible;
      renderNames(title, arr);
      panel.hidden = false;
    }
    function closePanel(){
      panel.hidden = true;
    }

    root.addEventListener('click', (ev)=>{
      const chip = ev.target.closest('.vip-chip');
      if(!chip) return;
      const active = chip.getAttribute('aria-pressed') === 'true';
      // reset chips
      $$('.vip-chip').forEach(c => c.setAttribute('aria-pressed','false'));
      if(active){
        // خاموش کردن و لغو فیلتر
        filterListByIds(null);
        closePanel();
        return;
      }
      chip.setAttribute('aria-pressed','true');
      const kind = chip.dataset.target;
      const arr  = kind === 'eligible' ? buckets.eligible : kind === 'oneaway' ? buckets.oneaway : buckets.claimed;

      // بازکردن پنل اسامی
      openPanel(kind);

      // فیلتر مستقیم لیست در صورت وجود data-id
      filterListByIds(arr.map(c => c.id));

      // رویداد سفارشی برای رندرهای خارجی
      const evt = new CustomEvent('vip:filter', { detail: { kind, ids: arr.map(c => c.id) }});
      document.getElementById('customers-list')?.dispatchEvent(evt);
    });

    closeBtn.addEventListener('click', closePanel);

    // ابتدا باکت‌ها را بر اساس داده‌های فعلی محاسبه کن
    updateBuckets();

    // اگر دیتایی نداریم، پنل را غیرفعال نکن—اما نوار را نگه دار
  }

  document.addEventListener('DOMContentLoaded', initVipUI);
  document.addEventListener('vip:refresh', updateBuckets);
})();


document.addEventListener('DOMContentLoaded', function(){
  const panel   = document.getElementById('vip-stats-panel');
  const titleEl = document.getElementById('vip-panel-title');
  const subEl   = document.getElementById('vip-panel-sub');
  const listEl  = document.getElementById('vip-list');
  const emptyEl = document.getElementById('vip-empty');
  const chipsBar = document.getElementById('vip-stats'); // همان سه دکمه بالای صفحه مشتریان (eligible/oneaway/claimed)

  if (!panel || !titleEl || !subEl || !listEl || !emptyEl) return;

  const faNum = (n) => new Intl.NumberFormat('fa-IR').format(n);

  // متن هر تب
  const PANEL_TEXT = {
    eligible: { title:'واجد جایزه',     sub:'مشتری‌هایی که به حد نصاب رسیده‌اند' },
    oneaway:  { title:'یک‌قدم تا جایزه', sub:'مشتری‌هایی که یک رزرو تا جایزه فاصله دارند' },
    claimed:  { title:'جایزه‌گرفته‌اند', sub:'مشتری‌هایی که جایزه‌شان را دریافت کرده‌اند' }
  };

  // نام کامل بساز (اگر فقط اسم کوچک باشد)
  function fullNameOf(rec){
    const raw = (rec.name || [rec.firstName, rec.lastName].filter(Boolean).join(' ')).trim();
    if (raw.includes(' ')) return raw;
    const all = (window.MOCK_DATA?.customers || []);
    const m = all.find(x => x.name.startsWith(raw + ' '));
    return (m?.name || raw || '—').trim();
  }

  // داده‌ها را فیلتر کن
  function getRows(kind){
    const base = (window.customersData || []);
    return base.filter(c=>{
      const need = c.vipRequired ?? 0, cur=c.vipCurrent ?? 0, rew=c.rewardCount ?? 0;
      if (kind==='eligible') return cur>=need && rew===0;
      if (kind==='oneaway')  return need>0 && cur===need-1;
      if (kind==='claimed')  return rew>0;
      return false;
    }).map(c=>{
      const fn = fullNameOf(c);
      const m  = (window.MOCK_DATA?.customers || []).find(x=>x.name===fn) || {};
      return { ...c, name: fn, phone: c.phone || m.phone || '' };
    });
  }

  function renderList(rows){
    listEl.innerHTML = rows.map(c => {
      const full = fullNameOf(c);
      return `
        <button type="button" class="vipc-chip"
                role="button"
                aria-label="مشاهده جزئیات ${full}"
                title="برای مشاهده جزئیات کلیک کنید"
                data-name="${full}"
                data-phone="${c.phone || ''}"
                data-reservations="${c.reservations ?? c.vipCurrent ?? 0}"
                data-rewards="${c.rewardCount ?? 0}"
                data-last-reservation="${c.lastReservationAt || ''}">
          <span class="vipc-chip-text">${full}</span>
          <svg class="vipc-chip-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>`;
    }).join('');
    emptyEl.hidden = rows.length > 0;
  }

  function openPanel(kind){
    const t = PANEL_TEXT[kind] || PANEL_TEXT.eligible;
    titleEl.textContent = t.title;
    subEl.textContent   = t.sub;
    renderList(getRows(kind));
    panel.hidden = false;
    panel.focus();
  }

  // دکمه‌های سه‌گانه‌ی بالای صفحه مشتریان
  chipsBar?.addEventListener('click', (e)=>{
    const chip = e.target.closest('.vip-chip');
    if (!chip) return;
    const kind = chip.dataset.target || 'eligible';
    chipsBar.querySelectorAll('.vip-chip').forEach(b => b.classList.toggle('active', b===chip));
    openPanel(kind);
  });

  // بستن پنل
  document.getElementById('vip-close-panel')?.addEventListener('click', ()=> panel.hidden = true);

  // باز کردن مودال با کلیک روی نام
  (function attachVipModal(){
    const modal = document.getElementById('vip-customer-modal');
    if (!modal) return;

    function fill(d){
      document.getElementById('vipc-avatar').textContent = (d.name||'—').charAt(0);
      document.getElementById('vipc-modal-title').textContent = d.name || '—';
      document.getElementById('vipc-phone').textContent = d.phone || '—';
      document.getElementById('vipc-res-count').textContent = faNum(d.reservations ?? 0);
      document.getElementById('vipc-reward-count').textContent = faNum(d.rewardCount ?? 0);
      document.getElementById('vipc-last-date').textContent = d.lastReservation || d.lastReservationAt || '—';
    }

    // delegation روی خودِ لیست
    listEl.addEventListener('click', (e)=>{
      const btn = e.target.closest('.vipc-chip');
      if (!btn) return;
      fill({
        name: btn.dataset.name,
        phone: btn.dataset.phone,
        reservations: +btn.dataset.reservations || 0,
        rewardCount: +btn.dataset.rewards || 0,
        lastReservation: btn.dataset.lastReservation
      });
      modal.hidden = false;
    });

    modal.addEventListener('click', (e)=>{
      if (e.target.hasAttribute('data-close') || e.target.closest('[data-close]')) modal.hidden = true;
    });

    document.getElementById('vipc-open-customer')?.addEventListener('click', ()=>{
      window.location.hash = '/customers';
      modal.hidden = true;
    });
  })();
});





