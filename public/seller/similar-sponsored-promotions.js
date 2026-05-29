(() => {
  'use strict';

  if (document.getElementById('similar-sponsored-seller-root')) {
    if (window.SimilarSponsoredPromotions?.refresh) {
      window.SimilarSponsoredPromotions.refresh({ force: true, reason: 'script-reload' });
    }
    return;
  }
  window.SimilarSponsoredPromotions?.destroy?.();

  const target = document.getElementById('content-ads') || document.getElementById('ads-content');
  if (!target) return;

  const API_BASE = (() => {
    const configured = window.VITRINET_API || window.__API_BASE__ || '';
    const raw = String(configured?.backendOrigin || configured || (location?.origin || 'http://localhost:5000')).replace(/\/$/, '');
    return raw.endsWith('/api') ? raw : `${raw}/api`;
  })();

  const TOKEN_KEYS = ['seller_token', 'access_token', 'auth_token', 'token', 'jwt'];
  const state = {
    plans: [],
    requests: [],
    selectedPlan: null,
    planVersion: null,
    lastLoadedAt: 0,
    loadPromise: null,
    csrfPromise: null,
    submitting: false,
    guidePlan: null
  };

  const tierLabels = {
    normal: 'پلن استاندارد',
    priority: 'پلن اولویت‌دار'
  };

  const tierDescriptions = {
    normal: 'نمایش هدفمند در کنار فروشگاه‌های هم‌حوزه شما',
    priority: 'جایگاه برتر و دیده‌شدن بیشتر نسبت به پلن عادی'
  };

  const tierFeatures = {
    normal: [
      'نمایش در بخش فروشگاه‌های مشابه',
      'هدف‌گیری هم‌حوزه و رقبای هم‌نوع',
      'فعال‌سازی پس از تأیید مدیر',
      'تعریف مدت نمایش توسط مدیر'
    ],
    priority: [
      'نمایش اولویت‌دار بالاتر از پلن عادی',
      'هدف‌گیری دقیق‌تر هم‌حوزه',
      'جایگاه ممتاز در فروشگاه‌های مشابه',
      'فعال‌سازی سریع‌تر پس از تأیید',
      'دیده‌شدن بیشتر توسط مشتریان هدف'
    ]
  };

  const durationLabels = {
    daily: 'روزانه',
    weekly: 'هفتگی',
    monthly: 'ماهانه'
  };

  const statusLabels = {
    pending: 'در انتظار بررسی',
    approved: 'تایید شده',
    paused: 'متوقف',
    rejected: 'رد شده',
    expired: 'منقضی',
    removed: 'حذف شده'
  };

  const paymentLabels = {
    pending: 'در انتظار پرداخت آنلاین',
    submitted: 'در انتظار تایید پرداخت',
    verified: 'پرداخت تایید شد',
    rejected: 'پرداخت ناموفق',
    waived: 'رایگان'
  };

  function readCookie(name) {
    const cookies = document.cookie ? document.cookie.split(';') : [];
    for (const cookie of cookies) {
      const [rawName, ...rawValue] = cookie.trim().split('=');
      if (rawName === name) return decodeURIComponent(rawValue.join('=') || '');
    }
    return '';
  }

  function getToken() {
    for (const key of TOKEN_KEYS) {
      const value = localStorage.getItem(key);
      if (value) return value;
    }
    return readCookie('seller_token') || readCookie('access_token') || '';
  }

  function authHeaders(extra = {}) {
    const token = getToken();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra
    };
  }

  async function csrfToken() {
    const cookieToken = readCookie('csrf_token');
    if (cookieToken) return cookieToken;
    if (!state.csrfPromise) {
      state.csrfPromise = fetch(`${API_BASE}/csrf-token`, { credentials: 'include' })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => data?.csrfToken || readCookie('csrf_token') || '')
        .catch(() => '')
        .finally(() => { state.csrfPromise = null; });
    }
    return state.csrfPromise;
  }

  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '۰';
    return num.toLocaleString('fa-IR');
  }

  function formatDate(value) {
    if (!value) return 'پس از تایید مدیر';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'پس از تایید مدیر';
    return date.toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function sortPlans(plans) {
    const tierOrder = { priority: 0, normal: 1 };
    const durationOrder = { monthly: 0, weekly: 1, daily: 2 };
    return [...plans].sort((a, b) => {
      const tierDiff = (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99);
      if (tierDiff) return tierDiff;
      return (durationOrder[a.durationUnit] ?? 99) - (durationOrder[b.durationUnit] ?? 99);
    });
  }

  /* ─────────────────────────────────────────────────────
     PREMIUM CSS — mobile-first similar shops pricing cards
     ───────────────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('similar-sponsored-seller-styles')) return;
    const style = document.createElement('style');
    style.id = 'similar-sponsored-seller-styles';
    style.textContent = `
/* ── Widget Container ── */
.ssw-widget,
.ssw-requests-panel {
  font-family: inherit;
  --ad-card-radius: 18px;
  --ad-card-pad: 1rem;
  --ad-card-gap: 0.65rem;
  --ad-card-shadow: 0 1px 2px rgba(15, 23, 42, 0.04),
                    0 6px 18px rgba(15, 23, 42, 0.05);
  --ad-card-shadow-hover: 0 10px 28px rgba(15, 23, 42, 0.09),
                          0 2px 6px rgba(15, 23, 42, 0.04);
  --ad-card-border: rgba(226, 232, 240, 0.85);
  --ad-c-search: #10b981;
  --ad-c-search-2: #059669;
  --ad-c-search-soft: rgba(16, 185, 129, 0.09);
  --ad-c-search-line: rgba(16, 185, 129, 0.18);
  --card-accent: var(--ad-c-search);
  --card-accent-2: var(--ad-c-search-2);
  --card-accent-soft: var(--ad-c-search-soft);
  --card-accent-line: var(--ad-c-search-line);
  --ssw-accent: #0f766e;
  --ssw-accent-dark: #115e59;
  --ssw-accent-deeper: #134e4a;
  --ssw-accent-soft: rgba(15,118,110,.08);
  --ssw-accent-border: rgba(15,118,110,.2);
  --ssw-accent-glow: rgba(15,118,110,.16);
  --ssw-violet: #6d28d9;
  --ssw-text-dark: #0f172a;
  --ssw-text-secondary: #475569;
  --ssw-surface: #ffffff;
  --ssw-surface-alt: #f8fafc;
  --ssw-border: rgba(15,23,42,.1);
  --ssw-radius-card: 18px;
  --ssw-radius-btn: 13px;
}
.ssw-widget,
.ssw-widget *,
.ssw-widget *::before,
.ssw-widget *::after {
  box-sizing: border-box;
}
.ssw-widget {
  position: relative;
  direction: rtl;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  isolation: isolate;
}
.ssw-widget::before {
  content: none;
}

/* ── Section Header ── */
.ssw-section-header {
  display: flex;
  align-items: center;
  gap: .68rem;
  margin: 0 0 .55rem;
  padding: 0 .1rem;
  position: relative;
  z-index: 2;
}
.ssw-section-header-icon {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 13px;
  background: rgba(15,118,110,.08);
  border: 1px solid rgba(15,118,110,.16);
  color: var(--ssw-accent);
}
.ssw-section-header-icon svg { width: 21px; height: 21px; }
.ssw-section-header-meta { flex: 1; min-width: 0; }
.ssw-section-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  padding: 0;
  background: transparent;
  border: 0;
  color: #94a3b8;
  font-size: .66rem;
  font-weight: 800;
  letter-spacing: 0;
  margin-bottom: .18rem;
}
.ssw-section-eyebrow svg { width: 11px; height: 11px; }
.ssw-section-title {
  font-size: 1rem;
  font-weight: 900;
  color: var(--ssw-text-dark);
  margin: 0 0 .12rem;
  letter-spacing: 0;
  line-height: 1.3;
}
.ssw-section-subtitle {
  font-size: .74rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
  font-weight: 650;
}

/* ── Info Banner ── */
.ssw-info-banner {
  display: none;
  gap: .42rem;
  align-items: center;
  padding: 0 .12rem;
  background: transparent;
  border: 0;
  border-radius: 0;
  margin: 0 0 .68rem;
}
.ssw-info-banner-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  min-width: 16px;
  border-radius: 999px;
  background: rgba(15,118,110,.1);
  color: var(--ssw-accent-dark);
  flex-shrink: 0;
}
.ssw-info-banner-icon svg { width: 10px; height: 10px; }
.ssw-info-banner-text {
  font-size: .69rem;
  font-weight: 750;
  color: #64748b;
  line-height: 1.55;
}

/* ── Status Message ── */
.ssw-message {
  min-height: 0;
  margin: .2rem 0;
  color: var(--ssw-text-secondary);
  font-weight: 700;
  font-size: .76rem;
}
.ssw-message--error { color: #f87171; }
.ssw-message--success { color: #4ade80; }

/* ── Plans Grid ── */
.ssw-plans-grid {
  display: flex;
  flex-direction: column;
  gap: .8rem;
}
@media (min-width:640px) {
  .ssw-plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px,1fr));
    gap: 1rem;
  }
}

/* ── Plan Card ── */
.ssw-plan-card {
  position: relative;
}
.ssw-plan-card::before {
  content: none;
}
.ssw-plan-card:hover {
  transform: translateY(-2px);
}

/* Priority variant */
.ssw-plan-card--priority {
  border-color: var(--card-accent-line);
}
.ssw-plan-card--priority::before {
  content: none;
}
.ssw-plan-card--priority:hover {
  box-shadow: var(--ad-card-shadow-hover);
}

/* ── Badge ── */
.ssw-plan-badge {
  display: none;
  align-items: center;
  flex-shrink: 0;
  width: fit-content;
  padding: .2rem .55rem;
  border-radius: 999px;
  font-size: .62rem;
  font-weight: 800;
  letter-spacing: 0;
  color: #475569;
  background: #f8fafc;
  border: 1px solid rgba(15,23,42,.08);
}
.ssw-plan-badge--recommended {
  color: var(--ssw-accent-deeper);
  background: rgba(15,118,110,.08);
  border-color: rgba(15,118,110,.16);
}

/* ── Card Header ── */
.ssw-plan-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0;
  text-align: center;
}
.ssw-plan-icon {
  display: none;
}
.ssw-plan-copy { min-width: 0; }
.ssw-plan-title {
  font-size: .98rem;
  font-weight: 800;
  color: var(--ssw-text-dark);
  margin: 0;
  letter-spacing: 0;
  line-height: 1.3;
}
.ssw-plan-desc {
  margin: .18rem 0 0;
  color: var(--ssw-text-secondary);
  font-size: .73rem;
  font-weight: 500;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Pricing Block ── */
.ssw-plan-pricing {
  direction: rtl;
}
.ssw-plan-price {
  font-size: clamp(1.45rem, 7vw, 1.75rem);
  direction: ltr;
  unicode-bidi: isolate;
}
.ssw-plan-unit {
  white-space: nowrap;
}

/* ── Features ── */
.ssw-plan-features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: none;
  flex-direction: row;
  flex-wrap: wrap;
  gap: .3rem .5rem;
  border-top: 0;
}
.ssw-plan-feature {
  display: flex;
  align-items: center;
  gap: .3rem;
  font-size: .68rem;
  color: #475569;
  line-height: 1.4;
}
.ssw-plan-feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  min-width: 14px;
  border-radius: 5px;
  background: rgba(15,118,110,.09);
  color: var(--ssw-accent-dark);
  flex-shrink: 0;
}
.ssw-plan-feature-icon svg { width: 9px; height: 9px; }

/* ── Meta Chips ── */
.ssw-plan-meta {
  display: none;
  align-items: center;
  flex-wrap: wrap;
  gap: .28rem .52rem;
  color: #64748b;
  font-size: .68rem;
  font-weight: 800;
}
.ssw-plan-meta-chip {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: .22rem;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  text-align: start;
}
.ssw-plan-meta-chip + .ssw-plan-meta-chip::before {
  content: '';
  width: 3px;
  height: 3px;
  margin-left: .24rem;
  border-radius: 999px;
  background: #cbd5e1;
}
.ssw-plan-meta-chip__label {
  font-size: .68rem;
  font-weight: 800;
  color: #64748b;
  letter-spacing: 0;
}
.ssw-plan-meta-chip__value {
  font-size: .7rem;
  font-weight: 900;
  color: var(--ssw-text-dark);
}

/* ── Admin Note ── */
.ssw-plan-admin-note {
  display: none;
  align-items: center;
  gap: .34rem;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  font-size: .68rem;
  color: #64748b;
  line-height: 1.45;
  font-weight: 750;
}
.ssw-plan-admin-note svg {
  width: 12px; height: 12px;
  min-width: 12px;
  margin-top: 0;
  color: var(--ssw-accent-dark);
  flex-shrink: 0;
}

.ssw-plan-actions {
  display: block;
  margin-top: .1rem;
}

/* ── CTA Button ── */
.ssw-plan-guide-btn {
  display: none;
}

.ssw-plan-cta {
  width: 100%;
}
.ssw-plan-cta svg { display: none; }
.ssw-plan-cta:disabled {
  opacity: .55;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* ── Empty State ── */
.ssw-empty {
  display: flex;
  align-items: center;
  gap: .6rem;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(167,139,250,.08), rgba(99,102,241,.04));
  border: 1px dashed rgba(167,139,250,.3);
  border-radius: 14px;
  color: var(--ssw-accent);
  font-size: .8rem;
  font-weight: 700;
  line-height: 1.65;
}
.ssw-empty svg { width: 18px; height: 18px; min-width: 18px; opacity: .6; }

/* ══════════════════════════════════════════════════
   REQUESTS PANEL — Premium Dark Glass (matches ads-plan-card)
   ══════════════════════════════════════════════════ */
.ssw-requests-panel {
  position: relative;
  direction: rtl;
  border-radius: 22px;
  background: linear-gradient(165deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,.02) 100%);
  border: 1px solid rgba(255,255,255,.08);
  padding: 1.1rem 1.1rem 1.15rem;
  margin: 0 0 1.25rem;
  overflow: hidden;
  box-shadow:
    0 8px 28px rgba(0,0,0,.28),
    inset 0 1px 0 rgba(255,255,255,.05);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.ssw-requests-panel::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, var(--ssw-accent-deeper, #7c3aed), var(--ssw-accent, #a78bfa), #6366f1);
  border-radius: 22px 22px 0 0;
  opacity: .9;
}
.ssw-requests-panel::after {
  content: '';
  position: absolute;
  top: -40%; left: -10%;
  width: 60%;
  height: 80%;
  background: radial-gradient(closest-side, rgba(167,139,250,.12), transparent 70%);
  pointer-events: none;
  z-index: 0;
}
.ssw-requests-panel > * { position: relative; z-index: 1; }

.ssw-requests-panel--overview {
  scroll-margin-top: 12px;
}
.ssw-requests-panel-header {
  display: flex;
  align-items: center;
  gap: .8rem;
  margin-bottom: 1rem;
  padding: .1rem 0 .9rem;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.ssw-requests-panel-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(145deg, rgba(167,139,250,.18), rgba(99,102,241,.1));
  border: 1px solid rgba(167,139,250,.28);
  color: var(--ssw-accent, #a78bfa);
  flex-shrink: 0;
  box-shadow:
    0 4px 14px rgba(167,139,250,.22),
    inset 0 1px 0 rgba(255,255,255,.08);
}
.ssw-requests-panel-icon svg { width: 20px; height: 20px; }
.ssw-requests-panel-copy { flex: 1; min-width: 0; }
.ssw-requests-panel-title {
  font-size: 1rem;
  font-weight: 800;
  color: var(--ssw-text-dark, #f2f2f7);
  margin: 0;
  line-height: 1.3;
  letter-spacing: -.01em;
}
.ssw-requests-panel-subtitle {
  margin: .22rem 0 0;
  color: rgba(226,232,240,.62);
  font-size: .75rem;
  font-weight: 600;
  line-height: 1.55;
}

/* ── Summary Stats ── */
.ssw-requests-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: .65rem;
  margin-bottom: .95rem;
}
.ssw-requests-summary[hidden] { display: none; }
.ssw-request-stat {
  position: relative;
  min-width: 0;
  border-radius: 14px;
  padding: .85rem .8rem .8rem;
  background: linear-gradient(155deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
  border: 1px solid rgba(255,255,255,.08);
  display: flex;
  flex-direction: column;
  gap: .25rem;
  align-items: flex-start;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
  transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
  overflow: hidden;
}
.ssw-request-stat:hover {
  transform: translateY(-2px);
  border-color: rgba(255,255,255,.14);
  box-shadow: 0 8px 22px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.06);
}
.ssw-request-stat::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, rgba(167,139,250,.35), rgba(99,102,241,.55));
}
.ssw-request-stat span {
  color: rgba(226,232,240,.55);
  font-size: .68rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: .01em;
  order: 1;
}
.ssw-request-stat strong {
  color: var(--ssw-text-dark, #f2f2f7);
  font-size: 1.5rem;
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: -.02em;
  order: 0;
  background: linear-gradient(135deg, #f2f2f7, #c7d2fe);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.ssw-request-stat--live {
  background: linear-gradient(155deg, rgba(34,197,94,.14), rgba(34,197,94,.04));
  border-color: rgba(34,197,94,.28);
}
.ssw-request-stat--live::after { background: linear-gradient(90deg, #22c55e, #16a34a); }
.ssw-request-stat--live strong {
  background: linear-gradient(135deg, #86efac, #4ade80);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.ssw-request-stat--live span { color: rgba(134,239,172,.85); }
.ssw-request-stat--queue {
  background: linear-gradient(155deg, rgba(245,158,11,.14), rgba(245,158,11,.04));
  border-color: rgba(245,158,11,.28);
}
.ssw-request-stat--queue::after { background: linear-gradient(90deg, #f59e0b, #d97706); }
.ssw-request-stat--queue strong {
  background: linear-gradient(135deg, #fcd34d, #f59e0b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.ssw-request-stat--queue span { color: rgba(252,211,77,.85); }

/* ── Requests Grid ── */
.ssw-requests-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: .7rem;
  min-width: 0;
}

/* ── Request Item Card — Dark Glass ── */
.ssw-request-item {
  position: relative;
  min-width: 0;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 16px;
  background: linear-gradient(165deg, rgba(255,255,255,.05) 0%, rgba(255,255,255,.015) 100%);
  padding: .9rem .95rem .9rem 1.15rem;
  display: grid;
  gap: .6rem;
  overflow: hidden;
  isolation: isolate;
  box-shadow:
    0 4px 14px rgba(0,0,0,.22),
    inset 0 1px 0 rgba(255,255,255,.04);
  transition: border-color .22s ease, box-shadow .22s ease, transform .22s ease, background .22s ease;
}
.ssw-request-item::before {
  content: '';
  position: absolute;
  inset-block: .8rem;
  inset-inline-start: 0;
  width: 3px;
  border-radius: 0 4px 4px 0;
  background: linear-gradient(180deg, var(--ssw-accent, #a78bfa), #6366f1);
  box-shadow: 0 0 12px rgba(167,139,250,.35);
}
.ssw-request-item:hover {
  border-color: rgba(167,139,250,.32);
  box-shadow: 0 10px 26px rgba(0,0,0,.32), 0 4px 12px rgba(167,139,250,.12);
  transform: translateY(-2px);
}
.ssw-request-item[open] {
  border-color: rgba(167,139,250,.42);
  box-shadow: 0 12px 32px rgba(0,0,0,.38), 0 4px 14px rgba(167,139,250,.18);
  background: linear-gradient(165deg, rgba(167,139,250,.07) 0%, rgba(255,255,255,.02) 100%);
}
.ssw-request-item[data-request-state="approved"] { border-color: rgba(34,197,94,.22); }
.ssw-request-item[data-request-state="approved"]::before {
  background: linear-gradient(180deg, #4ade80, #16a34a);
  box-shadow: 0 0 12px rgba(34,197,94,.4);
}
.ssw-request-item[data-request-state="approved"]:hover {
  border-color: rgba(34,197,94,.45);
  box-shadow: 0 10px 26px rgba(0,0,0,.32), 0 4px 12px rgba(34,197,94,.18);
}
.ssw-request-item[data-request-state="rejected"]::before,
.ssw-request-item[data-request-state="removed"]::before,
.ssw-request-item[data-request-state="expired"]::before {
  background: linear-gradient(180deg, #f87171, #dc2626);
  box-shadow: 0 0 12px rgba(239,68,68,.35);
}
.ssw-request-item[data-request-state="rejected"],
.ssw-request-item[data-request-state="removed"],
.ssw-request-item[data-request-state="expired"] { border-color: rgba(239,68,68,.18); }

/* ── Summary element inside <details> ── */
.ssw-request-summary {
  display: grid;
  gap: .5rem;
  min-width: 0;
  cursor: pointer;
  list-style: none;
  -webkit-tap-highlight-color: transparent;
}
.ssw-request-summary::-webkit-details-marker { display: none; }
.ssw-request-summary::marker { content: ''; }
.ssw-request-summary:focus-visible {
  border-radius: 12px;
  outline: 2px solid rgba(167,139,250,.7);
  outline-offset: 3px;
}
.ssw-request-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .65rem;
  min-width: 0;
}
.ssw-request-identity {
  display: flex;
  align-items: center;
  gap: .65rem;
  min-width: 0;
  flex: 1;
}
.ssw-request-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 12px;
  color: var(--ssw-accent, #a78bfa);
  background: linear-gradient(145deg, rgba(167,139,250,.16), rgba(99,102,241,.08));
  border: 1px solid rgba(167,139,250,.22);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
  flex-shrink: 0;
  transition: transform .25s ease;
}
.ssw-request-item:hover .ssw-request-icon { transform: scale(1.05); }
.ssw-request-icon svg { width: 18px; height: 18px; }
.ssw-request-copy { min-width: 0; flex: 1; }
.ssw-request-title {
  min-width: 0;
  font-size: .9rem;
  font-weight: 800;
  color: var(--ssw-text-dark, #f2f2f7);
  margin: 0 0 .12rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  letter-spacing: -.005em;
}
.ssw-request-subtitle {
  color: rgba(226,232,240,.55);
  font-size: .72rem;
  font-weight: 600;
  line-height: 1.4;
  margin: 0;
}

/* ── Status Pill — Dark Glass ── */
.ssw-status-pill {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  border-radius: 999px;
  max-width: min(50%, 150px);
  min-height: 28px;
  justify-content: center;
  padding: .3rem .7rem;
  font-size: .7rem;
  font-weight: 800;
  line-height: 1.3;
  text-align: center;
  flex-shrink: 0;
  border: 1px solid transparent;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.ssw-status-pill::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
  animation: sswPillPulse 2s ease-in-out infinite;
}
@keyframes sswPillPulse {
  0%,100% { opacity: 1; transform: scale(1); }
  50% { opacity: .55; transform: scale(.85); }
}
.ssw-status-pill--pending,
.ssw-status-pill--paused {
  background: rgba(245,158,11,.14);
  border-color: rgba(245,158,11,.32);
  color: #fcd34d;
}
.ssw-status-pill--approved {
  background: rgba(34,197,94,.14);
  border-color: rgba(34,197,94,.32);
  color: #86efac;
}
.ssw-status-pill--rejected,
.ssw-status-pill--removed,
.ssw-status-pill--expired {
  background: rgba(239,68,68,.12);
  border-color: rgba(239,68,68,.3);
  color: #fca5a5;
}

/* ── Preview Row (chips) ── */
.ssw-request-preview {
  display: flex;
  align-items: center;
  gap: .42rem;
  flex-wrap: wrap;
  min-width: 0;
  padding-top: .45rem;
  border-top: 1px dashed rgba(255,255,255,.08);
}
.ssw-request-preview-chip {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  border: 1px solid rgba(167,139,250,.24);
  border-radius: 999px;
  background: rgba(167,139,250,.08);
  color: #c4b5fd;
  padding: .24rem .58rem;
  font-size: .68rem;
  font-weight: 700;
  line-height: 1.35;
}
.ssw-request-expand {
  display: inline-flex;
  align-items: center;
  gap: .22rem;
  margin-inline-start: auto;
  color: #c4b5fd;
  font-size: .68rem;
  font-weight: 700;
  white-space: nowrap;
  background: rgba(167,139,250,.1);
  border-radius: 8px;
  padding: .22rem .55rem;
  border: 1px solid rgba(167,139,250,.22);
  transition: background .2s ease, border-color .2s ease, color .2s ease;
}
.ssw-request-item:hover .ssw-request-expand {
  background: rgba(167,139,250,.18);
  border-color: rgba(167,139,250,.38);
  color: #ddd6fe;
}
.ssw-request-expand svg {
  width: 13px;
  height: 13px;
  transition: transform .22s ease;
}
.ssw-request-item[open] .ssw-request-expand svg { transform: rotate(180deg); }

/* ── Request Details (expanded) ── */
.ssw-request-details {
  display: grid;
  gap: .65rem;
  padding-top: .65rem;
  border-top: 1px solid rgba(255,255,255,.08);
  animation: sswRequestDetailsIn .22s ease;
}
@keyframes sswRequestDetailsIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.ssw-request-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .5rem;
}
.ssw-request-meta-card {
  min-width: 0;
  padding: .65rem .72rem;
  border-radius: 12px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  display: grid;
  align-content: start;
  gap: .25rem;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
}
.ssw-request-meta-label {
  color: rgba(226,232,240,.45);
  font-size: .64rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.ssw-request-meta-value {
  color: var(--ssw-text-dark, #f2f2f7);
  font-size: .8rem;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

/* ── Payment Pill — Dark Glass ── */
.ssw-payment-pill {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-width: 0;
  border-radius: 999px;
  padding: .26rem .58rem;
  font-size: .68rem;
  font-weight: 700;
  line-height: 1.35;
  border: 1px solid transparent;
  background: rgba(59,130,246,.12);
  border-color: rgba(59,130,246,.28);
  color: #93c5fd;
}
.ssw-payment-pill--verified,
.ssw-payment-pill--waived {
  background: rgba(34,197,94,.12);
  border-color: rgba(34,197,94,.3);
  color: #86efac;
}
.ssw-payment-pill--rejected {
  background: rgba(239,68,68,.12);
  border-color: rgba(239,68,68,.28);
  color: #fca5a5;
}
.ssw-payment-pill--pending,
.ssw-payment-pill--submitted {
  background: rgba(245,158,11,.12);
  border-color: rgba(245,158,11,.3);
  color: #fcd34d;
}

/* ── Timeline (dates) — Dark Glass ── */
.ssw-request-timeline {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .5rem;
}
.ssw-request-moment {
  position: relative;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px;
  padding: .58rem .68rem;
  min-width: 0;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
}
.ssw-request-moment:first-child::after {
  content: '';
  position: absolute;
  inset-inline-end: -.5rem;
  top: 50%;
  width: .42rem;
  height: .42rem;
  border-radius: 50%;
  background: rgba(167,139,250,.7);
  box-shadow: 0 0 8px rgba(167,139,250,.5);
  transform: translateY(-50%);
}
.ssw-request-moment__label {
  display: block;
  font-size: .64rem;
  font-weight: 800;
  color: rgba(226,232,240,.45);
  margin-bottom: .2rem;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.ssw-request-moment__value {
  display: block;
  font-size: .78rem;
  font-weight: 700;
  color: var(--ssw-text-dark, #f2f2f7);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

/* ── Admin Note — Dark Glass ── */
.ssw-request-admin-note {
  margin: 0;
  padding: .65rem .8rem .65rem .9rem;
  background: linear-gradient(135deg, rgba(245,158,11,.1), rgba(245,158,11,.04));
  border: 1px solid rgba(245,158,11,.25);
  border-radius: 12px;
  font-size: .75rem;
  color: #fde68a;
  font-weight: 600;
  line-height: 1.65;
  display: flex;
  align-items: flex-start;
  gap: .5rem;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
}
.ssw-request-admin-note::before {
  content: '';
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: .15rem;
  background-color: #fcd34d;
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/></svg>") center / contain no-repeat;
  mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/></svg>") center / contain no-repeat;
}

/* ── Empty state ── */
.ssw-request-empty {
  min-height: 70px;
  width: 100%;
  grid-column: 1 / -1;
  justify-content: center;
  background: linear-gradient(135deg, rgba(167,139,250,.06), rgba(99,102,241,.03));
  border: 1px dashed rgba(167,139,250,.28);
  color: rgba(221,214,254,.85);
}

/* ── Responsive — requests section ── */
@media (min-width:640px) {
  .ssw-requests-panel {
    padding: 1.25rem 1.35rem 1.35rem;
    margin-bottom: 1.25rem;
  }
  .ssw-requests-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: .8rem;
  }
  .ssw-request-stat {
    padding: 1rem .95rem;
  }
  .ssw-request-stat strong {
    font-size: 1.7rem;
  }
}
@media (max-width:420px) {
  .ssw-requests-panel { padding: .95rem .9rem 1rem; }
  .ssw-request-head {
    align-items: flex-start;
    flex-direction: column;
    gap: .45rem;
  }
  .ssw-status-pill {
    max-width: 100%;
    align-self: flex-start;
  }
  .ssw-request-meta,
  .ssw-request-timeline {
    grid-template-columns: minmax(0, 1fr);
  }
  .ssw-request-moment:first-child::after {
    display: none;
  }
  .ssw-requests-summary {
    gap: .45rem;
  }
  .ssw-request-stat {
    padding: .75rem .65rem;
  }
  .ssw-request-stat strong {
    font-size: 1.2rem;
  }
  .ssw-request-stat span {
    font-size: .62rem;
  }
}

/* ── Modal ── */
.ssw-modal {
  --ssw-accent: #a78bfa;
  --ssw-accent-dark: #8b5cf6;
  --ssw-accent-deeper: #7c3aed;
  --ssw-accent-border: rgba(167,139,250,.25);
  --ssw-text-dark: #f8fafc;
  --ssw-text-secondary: #cbd5e1;
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(15,23,42,.52);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.ssw-modal[hidden] { display: none; }
.ssw-modal__dialog {
  width: min(520px, 100%);
  max-height: 92vh;
  overflow: auto;
  background: linear-gradient(180deg, #1e1b2e 0%, #13111c 100%);
  border-radius: 28px 28px 0 0;
  padding: 1.25rem 1.35rem 1.5rem;
  box-shadow: 0 -8px 40px rgba(0,0,0,.5);
  border-top: 1px solid rgba(255,255,255,.1);
}
@media (min-width:640px) {
  .ssw-modal { align-items: center; padding: 1.5rem; }
  .ssw-modal__dialog { border-radius: 24px; }
}
.ssw-modal__handle {
  width: 36px; height: 4px;
  background: rgba(255,255,255,.15);
  border-radius: 3px;
  margin: 0 auto 1.15rem;
  display: block;
}
@media (min-width:640px) { .ssw-modal__handle { display: none; } }
.ssw-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}
.ssw-modal__title {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--ssw-text-dark);
  margin: 0 0 .28rem;
}
.ssw-modal__plan-label { font-size: .8rem; color: var(--ssw-text-secondary); margin: 0; }
.ssw-modal__close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px; height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,.08);
  color: rgba(255,255,255,.5);
  cursor: pointer;
  transition: all .25s ease;
  flex-shrink: 0;
}
.ssw-modal__close-btn:hover { background: rgba(239,68,68,.2); color: #f87171; }
.ssw-modal__close-btn svg { width: 16px; height: 16px; }
.ssw-modal__payment-note {
  display: flex;
  gap: .72rem;
  align-items: flex-start;
  padding: .88rem 1rem;
  background: linear-gradient(135deg, rgba(167,139,250,.1), rgba(99,102,241,.06));
  border: 1px solid var(--ssw-accent-border);
  border-radius: 16px;
  margin-bottom: 1rem;
}
.ssw-modal__note-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px; height: 36px;
  min-width: 36px;
  border-radius: 10px;
  background: linear-gradient(145deg, rgba(167,139,250,.2), rgba(99,102,241,.12));
  color: var(--ssw-accent);
  flex-shrink: 0;
}
.ssw-modal__note-icon svg { width: 18px; height: 18px; }
.ssw-modal__note-strong {
  display: block;
  font-size: .88rem;
  font-weight: 800;
  color: #c4b5fd;
  margin-bottom: .28rem;
}
.ssw-modal__note-span {
  display: block;
  font-size: .77rem;
  line-height: 1.75;
  color: rgba(226,232,240,.75);
  font-weight: 600;
}
.ssw-modal__actions { display: flex; gap: .65rem; flex-wrap: wrap; }
.ssw-modal__submit {
  flex: 1;
  min-width: 180px;
  padding: .84rem 1rem;
  border-radius: var(--ssw-radius-btn);
  border: none;
  font-family: inherit;
  font-size: .92rem;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, var(--ssw-accent) 0%, var(--ssw-accent-dark) 100%);
  cursor: pointer;
  transition: all .3s ease;
  box-shadow: 0 4px 14px rgba(139,92,246,.3);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .45rem;
  -webkit-tap-highlight-color: transparent;
}
.ssw-modal__submit:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(139,92,246,.4); }
.ssw-modal__submit:disabled { opacity: .55; cursor: not-allowed; transform: none; }
.ssw-modal__submit svg { width: 16px; height: 16px; }
.ssw-modal__cancel {
  padding: .84rem 1.25rem;
  border-radius: var(--ssw-radius-btn);
  border: 1.5px solid rgba(255,255,255,.12);
  font-family: inherit;
  font-size: .88rem;
  font-weight: 700;
  color: var(--ssw-text-secondary);
  background: rgba(255,255,255,.06);
  cursor: pointer;
  transition: all .25s ease;
  white-space: nowrap;
}
.ssw-modal__cancel:hover { border-color: rgba(255,255,255,.2); background: rgba(255,255,255,.1); }
@media (max-width:480px) {
  .ssw-modal__actions { flex-direction: column; }
  .ssw-modal__submit { min-width: 0; }
}

.ssw-guide-modal {
  --ssw-accent: #a78bfa;
  --ssw-accent-dark: #8b5cf6;
  --ssw-accent-deeper: #7c3aed;
  --ssw-accent-border: rgba(167,139,250,.25);
  --ssw-text-dark: #f8fafc;
  --ssw-text-secondary: #cbd5e1;
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: end center;
  padding: 1rem 0 0;
  background: rgba(7,9,20,.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.ssw-guide-modal[hidden] { display: none; }
.ssw-guide-modal__dialog {
  width: min(620px, 100%);
  max-height: min(92vh, 860px);
  overflow: auto;
  border: 1px solid rgba(196,181,253,.22);
  border-radius: 28px 28px 0 0;
  background:
    linear-gradient(155deg, rgba(39,31,68,.98), rgba(15,17,28,.99)),
    linear-gradient(135deg, rgba(167,139,250,.14), transparent);
  box-shadow: 0 -18px 60px rgba(0,0,0,.52), inset 0 1px 0 rgba(255,255,255,.1);
  color: var(--ssw-text-dark);
  padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
}
.ssw-guide-modal__handle {
  display: block;
  width: 42px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255,255,255,.2);
  margin: 0 auto .85rem;
}
.ssw-guide-modal__close {
  position: sticky;
  top: 0;
  z-index: 2;
  margin-inline-start: auto;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.11);
  background: rgba(255,255,255,.08);
  color: rgba(255,255,255,.66);
  cursor: pointer;
}
.ssw-guide-modal__close svg { width: 16px; height: 16px; }
.ssw-guide-modal__hero {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: .72rem;
  align-items: start;
  margin-top: -.2rem;
}
.ssw-guide-modal__icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  color: #c4b5fd;
  border: 1px solid rgba(167,139,250,.28);
  background: linear-gradient(145deg, rgba(167,139,250,.24), rgba(14,165,233,.1));
  box-shadow: 0 10px 28px rgba(124,58,237,.2);
}
.ssw-guide-modal__icon svg { width: 24px; height: 24px; }
.ssw-guide-badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 24px;
  margin-bottom: .34rem;
  border-radius: 999px;
  padding: .16rem .56rem;
  color: #ddd6fe;
  background: rgba(167,139,250,.15);
  border: 1px solid rgba(167,139,250,.24);
  font-size: .66rem;
  font-weight: 900;
}
.ssw-guide-badge--priority {
  color: #f5f3ff;
  background: linear-gradient(135deg, rgba(124,58,237,.5), rgba(167,139,250,.22));
}
.ssw-guide-modal__title {
  margin: 0 0 .22rem;
  color: #fff;
  font-size: 1.04rem;
  font-weight: 950;
  line-height: 1.45;
}
.ssw-guide-modal__desc {
  margin: 0;
  color: rgba(226,232,240,.72);
  font-size: .78rem;
  font-weight: 650;
  line-height: 1.75;
}
.ssw-guide-price {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .65rem;
  margin: .92rem 0 .72rem;
  padding: .8rem;
  border: 1px solid rgba(167,139,250,.24);
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(167,139,250,.16), rgba(14,165,233,.08));
}
.ssw-guide-price span {
  color: rgba(226,232,240,.62);
  font-size: .72rem;
  font-weight: 800;
}
.ssw-guide-price strong {
  color: #fff;
  font-size: 1.08rem;
  font-weight: 950;
  text-align: end;
}
.ssw-guide-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: .48rem;
  margin-bottom: .72rem;
}
.ssw-guide-fact {
  min-width: 0;
  padding: .62rem .5rem;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.055);
  text-align: center;
}
.ssw-guide-fact span {
  display: block;
  color: rgba(226,232,240,.48);
  font-size: .61rem;
  font-weight: 850;
  margin-bottom: .14rem;
}
.ssw-guide-fact strong {
  display: block;
  color: #ede9fe;
  font-size: .76rem;
  font-weight: 900;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.ssw-guide-grid {
  display: grid;
  gap: .62rem;
}
.ssw-guide-panel {
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 18px;
  background: rgba(255,255,255,.045);
  padding: .82rem;
}
.ssw-guide-panel__title {
  margin: 0 0 .62rem;
  color: #fff;
  font-size: .82rem;
  font-weight: 950;
}
.ssw-guide-features,
.ssw-guide-steps {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: .48rem;
}
.ssw-guide-features li,
.ssw-guide-steps li {
  display: flex;
  align-items: flex-start;
  gap: .48rem;
  color: rgba(226,232,240,.8);
  font-size: .74rem;
  font-weight: 700;
  line-height: 1.65;
}
.ssw-guide-features span,
.ssw-guide-steps span {
  display: grid;
  place-items: center;
  width: 19px;
  height: 19px;
  min-width: 19px;
  border-radius: 7px;
  color: #c4b5fd;
  background: rgba(167,139,250,.16);
  border: 1px solid rgba(167,139,250,.18);
  font-size: .64rem;
  font-weight: 950;
  margin-top: .08rem;
}
.ssw-guide-note {
  display: flex;
  gap: .48rem;
  align-items: flex-start;
  margin-top: .62rem;
  padding: .62rem .72rem;
  border-radius: 14px;
  border: 1px solid rgba(245,158,11,.2);
  background: rgba(245,158,11,.09);
  color: #fde68a;
  font-size: .72rem;
  font-weight: 750;
  line-height: 1.65;
}
.ssw-guide-note svg {
  width: 15px;
  height: 15px;
  min-width: 15px;
  margin-top: .14rem;
}
.ssw-guide-actions {
  display: grid;
  gap: .5rem;
  margin-top: .82rem;
}
.ssw-guide-actions .ssw-plan-cta {
  min-height: 48px;
}
.ssw-guide-actions__close {
  min-height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  color: rgba(226,232,240,.76);
  font: inherit;
  font-size: .82rem;
  font-weight: 850;
  cursor: pointer;
}
@media (min-width:640px) {
  .ssw-guide-modal {
    place-items: center;
    padding: 1.5rem;
  }
  .ssw-guide-modal__dialog {
    border-radius: 28px;
    padding: 1.25rem;
  }
  .ssw-guide-modal__handle {
    display: none;
  }
  .ssw-guide-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ssw-guide-actions {
    grid-template-columns: minmax(0, 1fr) 132px;
  }
}

@media (max-width:639px) {
  .ssw-widget { margin-top: 0; padding: 0; border-radius: 0; }
  .ssw-widget::before { display: none; }
  .ssw-plan-features { display: none !important; }
  .ssw-plan-admin-note { display: none !important; }
  .ssw-plan-meta { display: none !important; }
  .ssw-plan-guide-btn { display: none !important; }
  .ssw-plans-grid { gap: .85rem; }
  .ssw-requests-panel {
    border-radius: 20px;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  .ssw-requests-panel-header {
    margin-bottom: .85rem;
    padding-bottom: .85rem;
  }
  .ssw-requests-summary {
    gap: .55rem;
    margin-bottom: .85rem;
  }
  .ssw-request-stat strong {
    font-size: 1.3rem;
  }
  .ssw-request-item {
    padding: .85rem .85rem .85rem 1.1rem;
    border-radius: 16px;
  }
  .ssw-status-pill {
    min-height: 26px;
    font-size: .67rem;
    padding: .26rem .55rem;
  }
  .ssw-request-meta,
  .ssw-request-timeline {
    grid-template-columns: minmax(0, 1fr);
  }
  .ssw-request-moment:first-child::after { display: none; }
}

/* ══════════════════════════════════════════════════════════════
   PREMIUM SIMILAR SHOPS HORIZONTAL CARDS — Green/White Design
   Refined premium feel: layered shadows, glass surface, micro-details
   ══════════════════════════════════════════════════════════════ */
#similar-sponsored-seller-root.ssw-widget {
  width: 100%;
  margin: 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
#similar-sponsored-seller-root.ssw-widget::before,
#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card::before {
  content: none;
  display: none;
}
#similar-sponsored-seller-root .ssw-section-header,
#similar-sponsored-seller-root .ssw-info-banner {
  display: none;
}
#similar-sponsored-seller-root .ssw-message:empty {
  display: none;
}

/* ── Horizontal scroll rail ── */
#similar-sponsored-seller-root .ssw-plans-grid {
  display: flex !important;
  flex-direction: row-reverse !important;
  flex-wrap: nowrap !important;
  gap: .95rem;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-padding-inline-start: .5rem;
  -webkit-overflow-scrolling: touch;
  padding: .5rem .5rem 1.2rem;
  margin: 0;
  direction: rtl;
  scrollbar-width: none;
}
#similar-sponsored-seller-root .ssw-plans-grid::-webkit-scrollbar {
  display: none;
}

/* ── Card shell — overridden by v2 below ── */
#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  -webkit-tap-highlight-color: transparent;
}
/* Subtle inner highlight — glass-like top edge */
#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 8%;
  right: 8%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.9) 30%, rgba(255,255,255,.95) 50%, rgba(255,255,255,.9) 70%, transparent);
  border-radius: 0 0 50% 50%;
  pointer-events: none;
  z-index: 1;
}
/* Hover/touch — stronger elevation feedback */
#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card:hover {
  transform: translateY(-3px);
  border-color: rgba(226, 232, 240, .5);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, .95) inset,
    0 4px 8px rgba(15, 23, 42, .04),
    0 10px 24px rgba(15, 23, 42, .08),
    0 20px 44px rgba(15, 23, 42, .1);
}
#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card:active {
  transform: translateY(-1px);
  transition-duration: .12s;
}

/* ── Priority card — overridden by v2 below ── */
#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card.ssw-plan-card--priority {
  border-color: rgba(165, 180, 252, .5);
}
#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card.ssw-plan-card--priority:hover {
  border-color: rgba(165, 180, 252, .6);
}

/* ── Header row — title + single small badge (overridden by v2) ── */
#similar-sponsored-seller-root .ssw-plan-header {
  order: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .55rem;
  padding: 0;
  text-align: right;
}
#similar-sponsored-seller-root .ssw-plan-title {
  font-size: .93rem;
  font-weight: 850;
  line-height: 1.4;
  color: #1e293b;
  margin: 0;
  letter-spacing: -.01em;
}
#similar-sponsored-seller-root .ssw-plan-desc {
  margin: .18rem 0 0;
  color: #64748b;
  font-size: .68rem;
  font-weight: 650;
  line-height: 1.5;
  opacity: .88;
  -webkit-line-clamp: 1;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Single badge — refined subtle (overridden by v2) ── */
#similar-sponsored-seller-root .ssw-plan-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 21px;
  max-width: 82px;
  padding: .16rem .52rem;
  border-radius: 8px;
  border: 1px solid rgba(226, 232, 240, .7);
  background: rgba(248, 250, 252, .9);
  color: #475569;
  font-size: .59rem;
  font-weight: 850;
  line-height: 1;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .03);
}
#similar-sponsored-seller-root .ssw-plan-badge--recommended {
  background: rgba(245, 243, 255, .9);
  border-color: rgba(165, 180, 252, .4);
  color: #4338ca;
  box-shadow: 0 1px 3px rgba(79, 70, 229, .08);
}

/* ── Pricing — the visual anchor (overridden by v2) ── */
#similar-sponsored-seller-root .upgrade-ad-pricing.ssw-plan-pricing {
  order: 2;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: .4rem;
  padding: .35rem 0 .2rem;
  margin: .15rem 0 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  text-align: center;
  direction: ltr;
  overflow: visible;
  position: relative;
}
/* Subtle separator line above pricing */
#similar-sponsored-seller-root .upgrade-ad-pricing.ssw-plan-pricing::before {
  content: '';
  position: absolute;
  top: 0;
  left: 15%;
  right: 15%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(226, 232, 240, .5) 30%, rgba(226, 232, 240, .6) 50%, rgba(226, 232, 240, .5) 70%, transparent);
}
#similar-sponsored-seller-root .upgrade-ad-price.ssw-plan-price {
  display: inline;
  width: auto;
  font-size: 1.95rem;
  font-weight: 950;
  line-height: 1;
  color: #1e293b;
  -webkit-text-fill-color: currentColor;
  background: none;
  direction: ltr;
  unicode-bidi: isolate;
  letter-spacing: -.02em;
  white-space: nowrap;
}
#similar-sponsored-seller-root .upgrade-ad-unit.ssw-plan-unit {
  display: inline;
  margin: 0;
  font-size: .71rem;
  color: #64748b;
  font-weight: 800;
  white-space: nowrap;
  direction: rtl;
}

/* ── Hide extraneous elements ── */
#similar-sponsored-seller-root .ssw-plan-features,
#similar-sponsored-seller-root .ssw-plan-meta,
#similar-sponsored-seller-root .ssw-plan-admin-note,
#similar-sponsored-seller-root .ssw-plan-guide-btn {
  display: none !important;
}

/* ── CTA — overridden by v2 below ── */
#similar-sponsored-seller-root .ssw-plan-actions {
  order: 3;
  display: block;
  margin-top: auto;
  padding-top: .25rem;
}
#similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta::after {
  content: '';
  width: 12px;
  height: 12px;
  background-color: currentColor;
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='15 18 9 12 15 6'/></svg>") no-repeat center / contain;
          mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='15 18 9 12 15 6'/></svg>") no-repeat center / contain;
  flex-shrink: 0;
  transition: transform .25s ease;
}
#similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta:hover::after {
  transform: translateX(-3px);
}
#similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta svg {
  display: none;
}
#similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta span {
  position: static;
}
#similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta:disabled {
  opacity: .5;
  cursor: not-allowed;
  transform: none;
  filter: none;
  box-shadow: none;
}

/* ── Desktop: slightly larger cards (overridden by v2) ── */
@media (min-width:640px) {
  #similar-sponsored-seller-root .ssw-plans-grid {
    gap: 1rem;
    scroll-padding-inline-start: .75rem;
    padding: .45rem .75rem 1rem;
  }
  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card {
    flex: 0 0 265px;
    width: 265px;
    max-width: 310px;
    padding: 1rem 1rem .9rem;
    border-radius: 18px;
  }
  #similar-sponsored-seller-root .ssw-plan-title {
    font-size: .97rem;
  }
  #similar-sponsored-seller-root .upgrade-ad-price.ssw-plan-price {
    font-size: 1.75rem;
  }
  #similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta {
    min-height: 38px;
    padding: .48rem .5rem;
    font-size: .84rem;
    border-radius: 13px;
  }
}

/* ── Very small screens (overridden by v2) ── */
@media (max-width:380px) {
  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card {
    flex: 0 0 82%;
    width: 82%;
    padding: .8rem .75rem .7rem;
    border-radius: 16px;
    gap: .6rem;
  }
  #similar-sponsored-seller-root .upgrade-ad-price.ssw-plan-price {
    font-size: 1.5rem;
  }
  #similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta {
    min-height: 34px;
    font-size: .78rem;
  }
}

/* ========================================================================
   v2 Similar shops cards - editorial pricing surface
   ======================================================================== */
#similar-sponsored-seller-root.ssw-widget {
  --ssw-standard: #0f766e;
  --ssw-standard-deep: #115e59;
  --ssw-standard-soft: rgba(20, 184, 166, .08);
  --ssw-priority: #4f46e5;
  --ssw-priority-deep: #3730a3;
  --ssw-priority-warm: #f59e0b;
  --ssw-priority-soft: rgba(79, 70, 229, .08);
}

#similar-sponsored-seller-root .ssw-carousel-shell {
  position: relative;
  max-width: 100%;
  margin-inline: -.5rem;
  padding-block: 0 .08rem;
  overflow: hidden;
}

#similar-sponsored-seller-root .ssw-carousel-shell::before,
#similar-sponsored-seller-root .ssw-carousel-shell::after {
  content: '';
  position: absolute;
  inset-block: 0 .5rem;
  width: 20px;
  z-index: 3;
  pointer-events: none;
  transition: opacity .3s ease;
}

#similar-sponsored-seller-root .ssw-carousel-shell::before {
  inset-inline-start: 0;
  background: linear-gradient(to right, rgba(248, 250, 252, .92) 0%, rgba(248, 250, 252, .4) 50%, transparent 100%);
}

#similar-sponsored-seller-root .ssw-carousel-shell::after {
  inset-inline-end: 0;
  background: linear-gradient(to left, rgba(248, 250, 252, .92) 0%, rgba(248, 250, 252, .4) 50%, transparent 100%);
}

#similar-sponsored-seller-root.ssw-carousel-static .ssw-carousel-shell::before,
#similar-sponsored-seller-root.ssw-carousel-static .ssw-carousel-shell::after,
#similar-sponsored-seller-root.ssw-carousel-at-start .ssw-carousel-shell::before,
#similar-sponsored-seller-root.ssw-carousel-at-end .ssw-carousel-shell::after {
  opacity: 0;
}

#similar-sponsored-seller-root .ssw-plans-grid {
  display: flex !important;
  flex-direction: row-reverse !important;
  flex-wrap: nowrap !important;
  justify-content: flex-start;
  gap: .75rem !important;
  width: 100%;
  max-width: 100%;
  padding: .45rem 1rem .6rem !important;
  margin-inline: 0;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  scroll-snap-type: x proximity !important;
  scroll-padding-inline: 1rem;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none !important;
  -ms-overflow-style: none;
  direction: rtl;
  overscroll-behavior-inline: contain;
  touch-action: pan-x pan-y;
}

#similar-sponsored-seller-root .ssw-plans-grid::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card {
  --plan-accent: var(--ssw-standard);
  --plan-accent-deep: var(--ssw-standard-deep);
  --plan-accent-soft: var(--ssw-standard-soft);
  --plan-card-shadow: rgba(15, 118, 110, .10);
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr);
  grid-template-areas:
    "visual head"
    "visual price"
    "visual actions";
  column-gap: .74rem;
  row-gap: .42rem;
  flex: 0 0 clamp(260px, calc(100vw - 90px), 296px) !important;
  width: clamp(260px, calc(100vw - 90px), 296px) !important;
  max-width: 296px !important;
  min-height: 172px;
  padding: .88rem .92rem;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, .7);
  background:
    linear-gradient(145deg, #ffffff 0%, #f8fafb 60%, #f1f5f9 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, .95) inset,
    0 2px 4px rgba(15, 23, 42, .03),
    0 6px 16px rgba(15, 23, 42, .06),
    0 16px 36px rgba(15, 23, 42, .08);
  transform: none;
  direction: rtl;
  scroll-snap-align: center;
  scroll-snap-stop: normal;
  transition:
    transform .3s cubic-bezier(.4,0,.2,1),
    box-shadow .3s cubic-bezier(.4,0,.2,1),
    border-color .3s ease;
  -webkit-tap-highlight-color: transparent;
}

#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card::before {
  content: '';
  display: block;
  position: absolute;
  inset-block: .95rem;
  inset-inline-start: 0;
  width: 3.5px;
  border-radius: 0 999px 999px 0;
  background: linear-gradient(180deg, var(--plan-accent), var(--plan-accent-deep));
  opacity: .85;
}

#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card::after {
  content: '';
  position: absolute;
  inset-block-start: .7rem;
  inset-inline-end: .7rem;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: var(--plan-accent-soft);
  opacity: .5;
  transform: rotate(-9deg);
  z-index: -1;
}

#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card.ssw-plan-card--priority {
  --plan-accent: var(--ssw-priority);
  --plan-accent-deep: var(--ssw-priority-deep);
  --plan-accent-soft: var(--ssw-priority-soft);
  --plan-card-shadow: rgba(79, 70, 229, .10);
  border-color: rgba(165, 180, 252, .5);
  background:
    linear-gradient(145deg, #ffffff 0%, #fafaff 60%, #f5f3ff 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, .95) inset,
    0 2px 4px rgba(15, 23, 42, .03),
    0 6px 16px rgba(79, 70, 229, .05),
    0 16px 36px rgba(15, 23, 42, .08);
}

#similar-sponsored-seller-root .ssw-plan-visual {
  grid-area: visual;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .5rem;
  align-self: stretch;
}

#similar-sponsored-seller-root .ssw-plan-visual__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  color: var(--plan-accent-deep);
  background:
    linear-gradient(145deg, rgba(255,255,255,.95), rgba(248, 250, 252, .7)),
    var(--plan-accent-soft);
  border: 1px solid rgba(226, 232, 240, .6);
  box-shadow:
    0 2px 6px rgba(15, 23, 42, .04),
    0 6px 14px var(--plan-card-shadow);
}

#similar-sponsored-seller-root .ssw-plan-card--priority .ssw-plan-visual__icon {
  border-color: rgba(165, 180, 252, .4);
}

#similar-sponsored-seller-root .ssw-plan-visual__icon svg {
  width: 20px;
  height: 20px;
}

#similar-sponsored-seller-root .ssw-plan-visual__line {
  width: 1.5px;
  flex: 1;
  min-height: 38px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(226, 232, 240, .6), rgba(226, 232, 240, .2));
}

#similar-sponsored-seller-root .ssw-plan-header {
  grid-area: head;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: .34rem;
  min-width: 0;
}

#similar-sponsored-seller-root .ssw-plan-copy {
  min-width: 0;
}

#similar-sponsored-seller-root .ssw-plan-title {
  font-size: .94rem;
  font-weight: 950;
  line-height: 1.45;
  color: #1e293b;
  text-align: right;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

#similar-sponsored-seller-root .ssw-plan-desc {
  margin-top: .2rem;
  color: #64748b;
  font-size: .7rem;
  font-weight: 650;
  line-height: 1.6;
  -webkit-line-clamp: 2;
}

#similar-sponsored-seller-root .ssw-plan-badge {
  justify-self: start;
  min-height: 24px;
  max-width: none;
  padding: .22rem .55rem;
  border-color: rgba(226, 232, 240, .7);
  background: rgba(248, 250, 252, .9);
  color: var(--plan-accent-deep);
  font-size: .6rem;
  font-weight: 850;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, .04);
}

#similar-sponsored-seller-root .ssw-plan-card--priority .ssw-plan-badge {
  border-color: rgba(165, 180, 252, .45);
  background: rgba(245, 243, 255, .9);
  color: #4338ca;
}

#similar-sponsored-seller-root .upgrade-ad-pricing.ssw-plan-pricing {
  grid-area: price;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  justify-content: stretch;
  gap: .36rem;
  width: 100%;
  min-height: 50px;
  margin: 0;
  padding: .52rem .68rem;
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, .65);
  background:
    linear-gradient(135deg, rgba(248, 250, 252, .9), rgba(241, 245, 249, .7));
}

#similar-sponsored-seller-root .upgrade-ad-pricing.ssw-plan-pricing::before {
  content: none;
}

#similar-sponsored-seller-root .upgrade-ad-price.ssw-plan-price {
  color: var(--plan-accent-deep);
  font-size: clamp(1.38rem, 6.2vw, 1.68rem);
  font-weight: 950;
  letter-spacing: -.01em;
  text-align: left;
}

#similar-sponsored-seller-root .upgrade-ad-unit.ssw-plan-unit {
  color: #64748b;
  font-size: .66rem;
  font-weight: 800;
  line-height: 1.5;
  white-space: normal;
}

#similar-sponsored-seller-root .ssw-plan-actions {
  grid-area: actions;
  margin: 0;
  padding: 0;
}

#similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta {
  min-height: 40px;
  margin: 0;
  border: 0;
  border-radius: 12px;
  color: #ffffff;
  font-weight: 800;
  font-size: .82rem;
  letter-spacing: .01em;
  background:
    linear-gradient(135deg, rgba(255,255,255,.15), transparent 40%),
    linear-gradient(135deg, var(--plan-accent), var(--plan-accent-deep));
  box-shadow:
    0 2px 6px var(--plan-card-shadow),
    0 8px 18px var(--plan-card-shadow),
    inset 0 1px 0 rgba(255,255,255,.18);
  transition:
    transform .25s cubic-bezier(.4,0,.2,1),
    box-shadow .25s ease,
    filter .25s ease;
}

#similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta:hover {
  color: #ffffff;
  transform: translateY(-1px);
  filter: brightness(1.06);
  background:
    linear-gradient(135deg, rgba(255,255,255,.2), transparent 40%),
    linear-gradient(135deg, var(--plan-accent), var(--plan-accent-deep));
  box-shadow:
    0 4px 10px var(--plan-card-shadow),
    0 12px 24px var(--plan-card-shadow),
    inset 0 1px 0 rgba(255,255,255,.22);
}

#similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta:active {
  transform: translateY(0);
  filter: brightness(.97);
  box-shadow:
    0 1px 3px var(--plan-card-shadow),
    inset 0 1px 0 rgba(255,255,255,.12);
}

#similar-sponsored-seller-root .ssw-carousel-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: .45rem 0 .1rem;
  margin: 0;
}

#similar-sponsored-seller-root .ssw-carousel-dots[hidden] {
  display: none !important;
}

#similar-sponsored-seller-root .ssw-carousel-dot {
  display: block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: rgba(148, 163, 184, .28);
  cursor: pointer;
  transition: all .3s cubic-bezier(.4,0,.2,1);
  -webkit-tap-highlight-color: transparent;
}

#similar-sponsored-seller-root .ssw-carousel-dot.is-active {
  display: block;
  width: 20px;
  height: 7px;
  border-radius: 99px;
  background: linear-gradient(135deg, #0f766e, #0ea5e9);
  box-shadow: 0 2px 8px rgba(15, 118, 110, .3);
}

@media (min-width: 760px) {
  #similar-sponsored-seller-root .ssw-carousel-shell {
    margin-inline: -.6rem;
  }

  #similar-sponsored-seller-root .ssw-carousel-shell::before,
  #similar-sponsored-seller-root .ssw-carousel-shell::after {
    width: 18px;
  }

  #similar-sponsored-seller-root .ssw-plans-grid {
    gap: .85rem !important;
    padding: .45rem 1rem .5rem !important;
    scroll-padding-inline: 1rem;
  }

  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card {
    flex-basis: 310px !important;
    width: 310px !important;
  }

  #similar-sponsored-seller-root .ssw-carousel-dots {
    display: flex;
    gap: 7px;
    padding-top: .5rem;
  }
}

@media (max-width: 380px) {
  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card {
    grid-template-columns: 40px minmax(0, 1fr);
    column-gap: .52rem;
    flex-basis: clamp(242px, calc(100vw - 72px), 280px) !important;
    width: clamp(242px, calc(100vw - 72px), 280px) !important;
    min-height: 160px;
    padding: .72rem .76rem;
    border-radius: 16px;
  }

  #similar-sponsored-seller-root .ssw-plan-visual__icon {
    width: 36px;
    height: 36px;
    border-radius: 11px;
  }

  #similar-sponsored-seller-root .ssw-plan-title {
    font-size: .86rem;
  }

  #similar-sponsored-seller-root .upgrade-ad-pricing.ssw-plan-pricing {
    grid-template-columns: minmax(0, 1fr);
    gap: .1rem;
    text-align: center;
    min-height: 48px;
    padding: .44rem .58rem;
  }

  #similar-sponsored-seller-root .upgrade-ad-price.ssw-plan-price {
    text-align: center;
  }

  #similar-sponsored-seller-root .ssw-carousel-dots {
    gap: 5px;
  }

  #similar-sponsored-seller-root .ssw-carousel-dot {
    width: 6px;
    height: 6px;
  }

  #similar-sponsored-seller-root .ssw-carousel-dot.is-active {
    width: 16px;
    height: 6px;
  }
}
    `;
    document.head.appendChild(style);
  }

  /* ─────────────────────────────────────────────────────
     SVG ICONS
     ───────────────────────────────────────────────────── */
  const icons = {
    store: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    storeSmall: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    trendUp: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
    zap: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    zapSmall: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    check: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    info: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    shield: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    list: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    chevronDown: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
    arrowLeft: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
    creditCard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    emptyBox: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`
  };

  /* ─────────────────────────────────────────────────────
     RENDER SHELL — premium section layout
     ───────────────────────────────────────────────────── */
  function renderShell() {
    injectStyles();
    const root = document.createElement('section');
    root.id = 'similar-sponsored-seller-root';
    root.className = 'ssw-widget';
    root.dataset.adSlot = 'similar_promotions';
    root.style.scrollMarginTop = '12px';
    root.setAttribute('aria-expanded', 'false');
    root.innerHTML = `
      <!-- Section Header -->
      <header class="ssw-section-header">
        <div class="ssw-section-header-icon" aria-hidden="true">${icons.storeSmall}</div>
        <div class="ssw-section-header-meta">
          <span class="ssw-section-eyebrow" aria-label="پیشنهادی">
            ${icons.zapSmall}
            پیشنهادی
          </span>
          <h3 id="ssw-title" class="ssw-section-title">نمایش در فروشگاه‌های مشابه</h3>
          <p class="ssw-section-subtitle">دیده‌شدن هدفمند کنار رقبای هم‌حوزه شما</p>
        </div>
      </header>

      <!-- Info Banner -->
      <div class="ssw-info-banner" role="note">
        <div class="ssw-info-banner-icon" aria-hidden="true">${icons.shield}</div>
        <p class="ssw-info-banner-text">درخواست را همین‌جا ثبت کنید؛ مدیر آن را بررسی و پس از تأیید، زمان شروع و پایان تبلیغ را تعیین می‌کند.</p>
      </div>

      <!-- Status Message -->
      <div id="similar-sponsored-message" class="ssw-message" role="status" aria-live="polite"></div>

      <!-- Plans Grid (filled dynamically) -->
      <div class="ssw-carousel-shell">
        <div class="ssw-plans-grid" id="similar-sponsored-plans" role="list" tabindex="0" aria-label="پلن‌های تبلیغاتی فروشگاه‌های مشابه"></div>
      </div>
      <div class="ssw-carousel-dots" id="similar-sponsored-dots" aria-label="نشانگر اسلایدهای پلن‌ها" hidden></div>

      <!-- Confirm/Submit Modal -->
      <div class="ssw-modal" id="similar-sponsored-modal" hidden aria-modal="true" role="dialog" aria-labelledby="ssw-modal-title">
        <form class="ssw-modal__dialog" id="similar-sponsored-form" novalidate>
          <span class="ssw-modal__handle" aria-hidden="true"></span>

          <div class="ssw-modal__header">
            <div>
              <h3 id="ssw-modal-title" class="ssw-modal__title">ثبت درخواست تبلیغ</h3>
              <p id="similar-sponsored-modal-plan" class="ssw-modal__plan-label"></p>
            </div>
            <button type="button" class="ssw-modal__close-btn" data-similar-sponsored-close aria-label="بستن">
              ${icons.close}
            </button>
          </div>

          <div class="ssw-modal__payment-note">
            <div class="ssw-modal__note-icon" aria-hidden="true">${icons.creditCard}</div>
            <div>
              <strong class="ssw-modal__note-strong">پرداخت فقط آنلاین انجام می‌شود</strong>
              <span class="ssw-modal__note-span">بعد از ثبت درخواست، به درگاه پرداخت هدایت می‌شوید. نمایش تبلیغ پس از پرداخت موفق و تأیید مدیر فعال خواهد شد.</span>
            </div>
          </div>

          <div class="ssw-modal__actions">
            <button type="submit" class="ssw-modal__submit">
              ${icons.arrowLeft}
              <span>ثبت درخواست و پرداخت آنلاین</span>
            </button>
            <button type="button" class="ssw-modal__cancel" data-similar-sponsored-close>انصراف</button>
          </div>
        </form>
      </div>

      <div class="ssw-guide-modal" id="similar-sponsored-guide-modal" hidden aria-modal="true" role="dialog" aria-labelledby="similar-sponsored-guide-title">
        <section class="ssw-guide-modal__dialog" role="document">
          <span class="ssw-guide-modal__handle" aria-hidden="true"></span>
          <button type="button" class="ssw-guide-modal__close" data-similar-sponsored-guide-close aria-label="بستن راهنمای پلن">
            ${icons.close}
          </button>

          <header class="ssw-guide-modal__hero">
            <div class="ssw-guide-modal__icon" aria-hidden="true">${icons.storeSmall}</div>
            <div>
              <span class="ssw-guide-badge" id="similar-sponsored-guide-badge"></span>
              <h3 id="similar-sponsored-guide-title" class="ssw-guide-modal__title"></h3>
              <p id="similar-sponsored-guide-desc" class="ssw-guide-modal__desc"></p>
            </div>
          </header>

          <div class="ssw-guide-price">
            <span>هزینه این پلن</span>
            <strong id="similar-sponsored-guide-price"></strong>
          </div>
          <div class="ssw-guide-facts" id="similar-sponsored-guide-facts"></div>

          <div class="ssw-guide-grid">
            <section class="ssw-guide-panel" aria-labelledby="similar-sponsored-guide-benefits-title">
              <h4 class="ssw-guide-panel__title" id="similar-sponsored-guide-benefits-title">چه چیزی دریافت می‌کنید؟</h4>
              <ul class="ssw-guide-features" id="similar-sponsored-guide-features"></ul>
            </section>
            <section class="ssw-guide-panel" aria-labelledby="similar-sponsored-guide-flow-title">
              <h4 class="ssw-guide-panel__title" id="similar-sponsored-guide-flow-title">مسیر فعال‌سازی تبلیغ</h4>
              <ol class="ssw-guide-steps">
                <li><span>۱</span>پلن را انتخاب می‌کنید و پرداخت آنلاین انجام می‌شود.</li>
                <li><span>۲</span>مدیر درخواست را بررسی و زمان نمایش را تعیین می‌کند.</li>
                <li><span>۳</span>پس از تایید، فروشگاه در بخش فروشگاه‌های مشابه نمایش داده می‌شود.</li>
              </ol>
            </section>
          </div>

          <p class="ssw-guide-note">
            ${icons.shield}
            <span>زمان شروع و پایان تبلیغ پس از بررسی مدیر مشخص می‌شود؛ قبل از پرداخت، وضعیت درخواست‌های قبلی خود را هم بررسی کنید.</span>
          </p>

          <div class="ssw-guide-actions">
            <button type="button" class="ssw-plan-cta" data-similar-sponsored-guide-select>
              ${icons.arrowLeft}
              <span>ثبت درخواست این پلن</span>
            </button>
            <button type="button" class="ssw-guide-actions__close" data-similar-sponsored-guide-close>بستن</button>
          </div>
        </section>
      </div>
    `;
    // Note: The "وضعیت درخواست‌های شما" (requests status) panel was intentionally
    // removed from the upgrade page. If a legacy anchor exists in the DOM, clear
    // it so nothing is displayed above the tabs.
    const requestsAnchor = document.getElementById('similar-sponsored-requests-anchor');
    if (requestsAnchor) {
      requestsAnchor.replaceChildren();
      requestsAnchor.hidden = true;
    }

    target.appendChild(root);
  }

  function setMessage(message = '', type = '') {
    const el = document.getElementById('similar-sponsored-message');
    if (!el) return;
    el.textContent = message;
    el.className = `ssw-message ${type ? `ssw-message--${type}` : ''}`.trim();
  }

  function freshPath(path) {
    const separator = String(path).includes('?') ? '&' : '?';
    return `${path}${separator}_=${Date.now()}`;
  }

  async function apiJson(path, options = {}) {
    const { fresh = true, ...fetchOptions } = options;
    const method = String(fetchOptions.method || 'GET').toUpperCase();
    const requestPath = method === 'GET' && fresh ? freshPath(path) : path;
    const res = await fetch(`${API_BASE}${requestPath}`, {
      credentials: 'include',
      cache: method === 'GET' ? 'no-store' : 'no-cache',
      ...fetchOptions,
      headers: authHeaders(fetchOptions.headers || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.message || 'خطا در ارتباط با سرور');
    return data;
  }

  async function loadData(options = {}) {
    const { force = false, silent = false } = options;
    if (!force && state.loadPromise) return state.loadPromise;

    state.loadPromise = (async () => {
      if (!silent) setMessage('در حال بارگذاری...');
      try {
        const [plansResult, requestsResult] = await Promise.allSettled([
          apiJson('/similar-shop-promotions/plans'),
          apiJson('/similar-shop-promotions/seller')
        ]);

        if (plansResult.status === 'rejected') {
          throw plansResult.reason;
        }

        const plansData = plansResult.value || {};
        const requestsData = requestsResult.status === 'fulfilled'
          ? (requestsResult.value || {})
          : { promotions: [] };

        if (requestsResult.status === 'rejected') {
          console.warn('similar sponsored requests unavailable:', requestsResult.reason);
        }

        state.plans = Array.isArray(plansData.plans) ? plansData.plans : [];
        state.requests = Array.isArray(requestsData.promotions) ? requestsData.promotions : [];
        state.planVersion = plansData.meta?.version || plansData.meta?.plansUpdatedAt || null;
        state.lastLoadedAt = Date.now();
        renderPlans();
        renderRequests();
        setMessage('');
        return { plans: state.plans, requests: state.requests, version: state.planVersion };
      } catch (err) {
        console.error('similar sponsored loadData failed:', err);
        if (!silent) setMessage(err.message || 'خطا در بارگذاری تبلیغات فروشگاه‌های مشابه', 'error');
        throw err;
      } finally {
        state.loadPromise = null;
      }
    })();

    return state.loadPromise;
  }

  function getCarouselParts() {
    const container = document.getElementById('similar-sponsored-plans');
    const dots = document.getElementById('similar-sponsored-dots');
    const cards = container ? [...container.querySelectorAll('.ssw-plan-card')] : [];
    return { container, dots, cards };
  }

  function getActiveCarouselIndex(container, cards) {
    if (!container || !cards.length) return 0;
    const railRect = container.getBoundingClientRect();
    const railCenter = railRect.left + (railRect.width / 2);
    return cards.reduce((bestIndex, card, index) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + (cardRect.width / 2);
      const distance = Math.abs(cardCenter - railCenter);
      const bestCard = cards[bestIndex];
      const bestRect = bestCard.getBoundingClientRect();
      const bestDistance = Math.abs((bestRect.left + (bestRect.width / 2)) - railCenter);
      return distance < bestDistance ? index : bestIndex;
    }, 0);
  }

  function updateCarouselHints(activeIndex) {
    const { container, dots, cards } = getCarouselParts();
    const root = document.getElementById('similar-sponsored-seller-root');
    if (!container || !root) return;

    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    const scrollLeft = Math.max(0, container.scrollLeft);
    const isStatic = cards.length <= 1 || maxScroll <= 2;
    const resolvedIndex = Number.isInteger(activeIndex)
      ? activeIndex
      : getActiveCarouselIndex(container, cards);

    root.classList.toggle('ssw-carousel-static', isStatic);
    root.classList.toggle('ssw-carousel-at-start', scrollLeft <= 2);
    root.classList.toggle('ssw-carousel-at-end', scrollLeft >= maxScroll - 2);

    if (dots) {
      dots.hidden = cards.length <= 1;
      dots.querySelectorAll('.ssw-carousel-dot').forEach((dot, index) => {
        const active = index === resolvedIndex;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
    }
  }

  function renderCarouselDots(count) {
    const dots = document.getElementById('similar-sponsored-dots');
    if (!dots) return;
    dots.hidden = count <= 1;
    dots.innerHTML = Array.from({ length: count }, (_, index) => `
      <button type="button" class="ssw-carousel-dot${index === 0 ? ' is-active' : ''}"
        data-carousel-index="${index}"
        aria-label="اسلاید ${index + 1}"
        aria-current="${index === 0 ? 'true' : 'false'}"></button>
    `).join('');
  }

  /* ─────────────────────────────────────────────────────
     RENDER PLANS — premium upgrade-ad-card style
     ───────────────────────────────────────────────────── */
  function renderPlans() {
    const container = document.getElementById('similar-sponsored-plans');
    if (!container) return;
    const plans = sortPlans(state.plans);

    if (!plans.length) {
      container.innerHTML = `
        <div class="ssw-empty">
          ${icons.emptyBox}
          <span>فعلاً پلن فعالی برای این جایگاه تعریف نشده است. قیمت و وضعیت پلن‌ها از سمت مدیر کنترل می‌شود.</span>
        </div>`;
      renderCarouselDots(0);
      updateCarouselHints(0);
      return;
    }

    const compactDescriptions = {
      priority: 'جایگاه برتر · دیده‌شدن بیشتر',
      normal: 'نمایش در بخش مشابه‌ها'
    };

    container.innerHTML = plans.map((plan, index) => {
      const isPriority = plan.tier === 'priority';
      const planTitle = plan.title || `${tierLabels[plan.tier] || 'پلن تبلیغ'} - ${durationLabels[plan.durationUnit] || ''}`;
      const planDesc = compactDescriptions[plan.tier] || 'نمایش هدفمند در مشابه‌ها';
      const badgeLabel = isPriority ? 'پیشنهادی' : 'استاندارد';
      const unitLabel = durationLabels[plan.durationUnit] || 'دوره';

      return `
        <article class="upgrade-ad-card upgrade-ad-card--search ssw-plan-card${isPriority ? ' ssw-plan-card--priority' : ' ssw-plan-card--standard'}" role="listitem" aria-labelledby="ssw-plan-title-${index}">
          <div class="ssw-plan-visual" aria-hidden="true">
            <div class="ssw-plan-visual__icon">${isPriority ? icons.trendUp : icons.storeSmall}</div>
            <span class="ssw-plan-visual__line"></span>
          </div>
          <div class="ssw-plan-header">
            <div class="ssw-plan-copy">
              <h4 id="ssw-plan-title-${index}" class="ssw-plan-title">${escapeHtml(planTitle)}</h4>
              <p class="ssw-plan-desc">${escapeHtml(planDesc)}</p>
            </div>
            <div class="ssw-plan-badge${isPriority ? ' ssw-plan-badge--recommended' : ''}" aria-label="${badgeLabel}">${badgeLabel}</div>
          </div>

          <div class="upgrade-ad-pricing ssw-plan-pricing" aria-label="قیمت پلن">
            <span class="upgrade-ad-price ssw-plan-price">${formatMoney(plan.price)}</span>
            <span class="upgrade-ad-unit ssw-plan-unit">تومان / ${escapeHtml(unitLabel)}</span>
          </div>

          <div class="ssw-plan-actions">
            <button type="button" class="upgrade-ad-cta ssw-plan-cta"
              data-plan-tier="${escapeHtml(plan.tier)}"
              data-plan-duration="${escapeHtml(plan.durationUnit)}"
              aria-label="ثبت درخواست برای ${escapeHtml(planTitle)}">
              <span>ثبت درخواست</span>
            </button>
          </div>
        </article>
      `;
    }).join('');

    container.dir = 'rtl';
    container.setAttribute('aria-orientation', 'horizontal');
    renderCarouselDots(plans.length);
    requestAnimationFrame(() => {
      // In RTL, scrollLeft = 0 is already at the right edge (start)
      container.scrollLeft = 0;
      updateCarouselHints(0);
    });
  }

  /* ─────────────────────────────────────────────────────
     RENDER REQUESTS
     ───────────────────────────────────────────────────── */
  function renderRequests() {
    const container = document.getElementById('similar-sponsored-requests');
    const summary = document.getElementById('similar-sponsored-requests-summary');
    if (!container) return;

    if (!state.requests.length) {
      if (summary) {
        summary.hidden = true;
        summary.innerHTML = '';
      }
      container.innerHTML = `
        <div class="ssw-empty ssw-request-empty">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <span>هنوز درخواستی ثبت نکرده‌اید.</span>
        </div>`;
      return;
    }

    if (summary) {
      const approvedCount = state.requests.filter((item) => item.status === 'approved').length;
      const queueCount   = state.requests.filter((item) => ['pending', 'paused'].includes(item.status || 'pending')).length;
      summary.hidden = false;
      summary.innerHTML = `
        <div class="ssw-request-stat ssw-request-stat--queue">
          <strong>${formatMoney(queueCount)}</strong>
          <span>در صف بررسی</span>
        </div>
        <div class="ssw-request-stat ssw-request-stat--live">
          <strong>${formatMoney(approvedCount)}</strong>
          <span>تایید شده</span>
        </div>
        <div class="ssw-request-stat">
          <strong>${formatMoney(state.requests.length)}</strong>
          <span>کل درخواست‌ها</span>
        </div>
      `;
    }

    container.innerHTML = state.requests.map((item) => {
      const status = item.status || 'pending';
      const paymentStatus = item.paymentStatus || 'pending';
      const statusClass = ['approved', 'rejected', 'removed', 'expired', 'pending', 'paused'].includes(status)
        ? `ssw-status-pill--${status}` : 'ssw-status-pill--pending';
      const paymentClass = ['pending', 'submitted', 'verified', 'rejected', 'waived'].includes(paymentStatus)
        ? `ssw-payment-pill--${paymentStatus}` : 'ssw-payment-pill--pending';

      const planTitle   = escapeHtml(item.planTitle || tierLabels[item.planTier] || 'نمایش در فروشگاه‌های مشابه');
      const tierLabel   = escapeHtml(tierLabels[item.planTier] || item.planTier || 'تبلیغ ویژه');
      const durLabel    = escapeHtml(durationLabels[item.durationUnit] || item.durationUnit || '');
      const statusLabel = escapeHtml(statusLabels[status] || status);
      const payLabel    = escapeHtml(paymentLabels[paymentStatus] || paymentStatus);

      const startVal = escapeHtml(formatDate(item.startAt));
      const endVal   = escapeHtml(formatDate(item.endAt));

      return `
        <details class="ssw-request-item" data-request-state="${escapeHtml(status)}">
          <summary class="ssw-request-summary">
            <div class="ssw-request-head">
              <div class="ssw-request-identity">
                <div class="ssw-request-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <div class="ssw-request-copy">
                  <strong class="ssw-request-title">${planTitle}</strong>
                  <p class="ssw-request-subtitle">${tierLabel}${durLabel ? ' · ' + durLabel : ''}</p>
                </div>
              </div>
              <span class="ssw-status-pill ${statusClass}" role="status">${statusLabel}</span>
            </div>
            <div class="ssw-request-preview">
              <span class="ssw-payment-pill ${paymentClass}">${payLabel}</span>
              <span class="ssw-request-expand">جزئیات
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </span>
            </div>
          </summary>
          <div class="ssw-request-details">
            <div class="ssw-request-meta">
              <div class="ssw-request-meta-card">
                <span class="ssw-request-meta-label">نوع پلن</span>
                <strong class="ssw-request-meta-value">${tierLabel}</strong>
              </div>
              <div class="ssw-request-meta-card">
                <span class="ssw-request-meta-label">وضعیت پرداخت</span>
                <span class="ssw-payment-pill ${paymentClass}">${payLabel}</span>
              </div>
            </div>
            <div class="ssw-request-timeline">
              <div class="ssw-request-moment">
                <span class="ssw-request-moment__label">شروع نمایش</span>
                <span class="ssw-request-moment__value">${startVal}</span>
              </div>
              <div class="ssw-request-moment">
                <span class="ssw-request-moment__label">پایان نمایش</span>
                <span class="ssw-request-moment__value">${endVal}</span>
              </div>
            </div>
            ${item.adminNote ? `<p class="ssw-request-admin-note">${escapeHtml(item.adminNote)}</p>` : ''}
          </div>
        </details>
      `;
    }).join('');
  }

  /* ─────────────────────────────────────────────────────
     MODAL LOGIC
     ───────────────────────────────────────────────────── */
  function openModal(plan) {
    state.selectedPlan = plan;
    const modal = document.getElementById('similar-sponsored-modal');
    const label = document.getElementById('similar-sponsored-modal-plan');
    if (label) {
      label.textContent = `${plan.title || tierLabels[plan.tier] || ''} | ${durationLabels[plan.durationUnit] || ''} | ${formatMoney(plan.price)} تومان`;
    }
    if (modal) modal.hidden = false;
  }

  function closeModal() {
    const modal = document.getElementById('similar-sponsored-modal');
    const form = document.getElementById('similar-sponsored-form');
    if (form) form.reset();
    if (modal) modal.hidden = true;
    state.selectedPlan = null;
  }

  function getPlanGuideFeatures(plan) {
    return tierFeatures[plan?.tier] || [
      'نمایش فروشگاه در بخش فروشگاه‌های مشابه',
      'بررسی درخواست و فعال‌سازی پس از تایید مدیر'
    ];
  }

  function openGuideModal(plan) {
    const modal = document.getElementById('similar-sponsored-guide-modal');
    if (!modal || !plan) return;

    state.guidePlan = plan;

    const title = plan.title || tierLabels[plan.tier] || 'پلن تبلیغ فروشگاه‌های مشابه';
    const desc = plan.description || tierDescriptions[plan.tier] || 'نمایش ویژه فروشگاه شما کنار فروشگاه‌های هم‌حوزه.';
    const periodLabel = durationLabels[plan.durationUnit] || plan.durationUnit || 'دوره';
    const durationValue = plan.durationDays ? `${escapeHtml(String(plan.durationDays))} روز` : escapeHtml(periodLabel);
    const slotValue = plan.slotLimit ? `${escapeHtml(String(plan.slotLimit))} جایگاه` : 'طبق ظرفیت';
    const features = getPlanGuideFeatures(plan);
    const badge = document.getElementById('similar-sponsored-guide-badge');
    const titleEl = document.getElementById('similar-sponsored-guide-title');
    const descEl = document.getElementById('similar-sponsored-guide-desc');
    const priceEl = document.getElementById('similar-sponsored-guide-price');
    const factsEl = document.getElementById('similar-sponsored-guide-facts');
    const featuresEl = document.getElementById('similar-sponsored-guide-features');

    if (badge) {
      badge.textContent = plan.tier === 'priority' ? 'پلن پیشنهادی' : 'پلن استاندارد';
      badge.className = `ssw-guide-badge${plan.tier === 'priority' ? ' ssw-guide-badge--priority' : ''}`;
    }
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;
    if (priceEl) priceEl.textContent = `${formatMoney(plan.price)} تومان / ${periodLabel}`;
    if (factsEl) {
      factsEl.innerHTML = `
        <div class="ssw-guide-fact">
          <span>مدت نمایش</span>
          <strong>${durationValue}</strong>
        </div>
        <div class="ssw-guide-fact">
          <span>دوره پلن</span>
          <strong>${escapeHtml(periodLabel)}</strong>
        </div>
        <div class="ssw-guide-fact">
          <span>ظرفیت</span>
          <strong>${slotValue}</strong>
        </div>
      `;
    }
    if (featuresEl) {
      featuresEl.innerHTML = features.map((feature) => `
        <li><span aria-hidden="true">${icons.check}</span>${escapeHtml(feature)}</li>
      `).join('');
    }

    modal.hidden = false;
  }

  function closeGuideModal() {
    const modal = document.getElementById('similar-sponsored-guide-modal');
    if (modal) modal.hidden = true;
    state.guidePlan = null;
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (state.submitting) return;
    const plan = state.selectedPlan;
    if (!plan) return;
    const submitButton = event.currentTarget?.querySelector('[type="submit"]');
    const formData = new FormData();
    formData.set('planTier', plan.tier);
    formData.set('durationUnit', plan.durationUnit);
    state.submitting = true;
    if (submitButton) submitButton.disabled = true;
    setMessage('در حال ثبت درخواست و آماده‌سازی درگاه پرداخت...');
    try {
      const token = await csrfToken();
      const res = await fetch(`${API_BASE}/similar-shop-promotions/requests`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders({
          'X-Requested-With': 'XMLHttpRequest',
          ...(token ? { 'X-CSRF-Token': token } : {})
        }),
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || 'خطا در ثبت درخواست');
      const promotionId = data.promotion?.id || data.promotion?._id;
      if (!promotionId) throw new Error('شناسه درخواست تبلیغ دریافت نشد.');

      const paymentRes = await fetch(`${API_BASE}/payment/request`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders({
          'Content-Type': 'application/json',
          ...(token ? { 'X-CSRF-Token': token } : {})
        }),
        body: JSON.stringify({ similarPromotionId: promotionId })
      });
      const paymentData = await paymentRes.json().catch(() => ({}));
      if (!paymentRes.ok || paymentData.success === false) {
        throw new Error(paymentData.message || 'خطا در اتصال به درگاه پرداخت');
      }

      closeModal();
      await loadData();
      if (paymentData.url) {
        setMessage(paymentData.message || 'در حال انتقال به درگاه پرداخت...', 'success');
        window.location.assign(paymentData.url);
        return;
      }
      setMessage(paymentData.message || 'درخواست ثبت شد، اما لینک درگاه دریافت نشد.', 'success');
    } catch (err) {
      console.error('similar sponsored submitRequest failed:', err);
      setMessage(err.message || 'خطا در ثبت درخواست یا اتصال به درگاه', 'error');
    } finally {
      state.submitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  }

  /* ─────────────────────────────────────────────────────
     EVENT BINDING
     ───────────────────────────────────────────────────── */
  function bindEvents() {
    const plansRail = document.getElementById('similar-sponsored-plans');
    const dots = document.getElementById('similar-sponsored-dots');
    let carouselRaf = 0;
    const scheduleCarouselUpdate = () => {
      if (carouselRaf) return;
      carouselRaf = requestAnimationFrame(() => {
        carouselRaf = 0;
        updateCarouselHints();
      });
    };

    plansRail?.addEventListener('scroll', scheduleCarouselUpdate, { passive: true });
    window.addEventListener('resize', scheduleCarouselUpdate, { passive: true });

    dots?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-carousel-index]');
      if (!button) return;
      const index = Number(button.dataset.carouselIndex);
      const card = plansRail?.querySelectorAll('.ssw-plan-card')[index];
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      updateCarouselHints(index);
    });

    plansRail?.addEventListener('click', (event) => {
      const guideButton = event.target.closest('[data-plan-guide-tier]');
      if (guideButton) {
        const guidePlan = state.plans.find(
          (item) => item.tier === guideButton.dataset.planGuideTier && item.durationUnit === guideButton.dataset.planGuideDuration
        );
        if (guidePlan) openGuideModal(guidePlan);
        return;
      }

      const button = event.target.closest('[data-plan-tier]');
      if (!button) return;
      const plan = state.plans.find(
        (item) => item.tier === button.dataset.planTier && item.durationUnit === button.dataset.planDuration
      );
      if (plan) openModal(plan);
    });

    document.querySelectorAll('[data-similar-sponsored-close]').forEach((button) => {
      button.addEventListener('click', closeModal);
    });
    document.querySelectorAll('[data-similar-sponsored-guide-close]').forEach((button) => {
      button.addEventListener('click', closeGuideModal);
    });

    document.getElementById('similar-sponsored-form')?.addEventListener('submit', submitRequest);
    document.querySelector('[data-similar-sponsored-guide-select]')?.addEventListener('click', () => {
      const plan = state.guidePlan;
      closeGuideModal();
      if (plan) openModal(plan);
    });

    document.getElementById('similar-sponsored-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'similar-sponsored-modal') closeModal();
    });
    document.getElementById('similar-sponsored-guide-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'similar-sponsored-guide-modal') closeGuideModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const modal = document.getElementById('similar-sponsored-modal');
        const guideModal = document.getElementById('similar-sponsored-guide-modal');
        if (guideModal && !guideModal.hidden) {
          closeGuideModal();
          return;
        }
        if (modal && !modal.hidden) closeModal();
      }
    });
  }

  /* ─────────────────────────────────────────────────────
     PLAN SYNC & LIFECYCLE
     ───────────────────────────────────────────────────── */
  function setupPlanSync() {
    const refresh = (options = {}) => loadData({ force: true, silent: !!options.silent }).catch(() => null);
    const handleVisibility = () => {
      if (!document.hidden && Date.now() - state.lastLoadedAt > 5000) refresh({ silent: true });
    };
    const handleFocus = () => refresh({ silent: true });
    const handleStorage = (event) => {
      if (event.key === 'similar-promotions-plans-updated') refresh({ silent: false });
    };
    const handleAdminSignal = () => refresh({ silent: false });
    const intervalId = window.setInterval(() => refresh({ silent: true }), 60000);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('similar-promotions:plans-updated', handleAdminSignal);

    window.SimilarSponsoredPromotions = {
      refresh,
      getState: () => ({
        plans: [...state.plans],
        requests: [...state.requests],
        version: state.planVersion,
        lastLoadedAt: state.lastLoadedAt
      }),
      destroy: () => {
        window.clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('similar-promotions:plans-updated', handleAdminSignal);
      }
    };
  }

  /* ─────────────────────────────────────────────────────
     BOOT
     ───────────────────────────────────────────────────── */
  renderShell();
  bindEvents();
  setupPlanSync();
  loadData({ force: true }).catch(() => null);
})();
