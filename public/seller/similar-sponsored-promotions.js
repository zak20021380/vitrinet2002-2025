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
   PREMIUM SIMILAR SHOPS HORIZONTAL CARDS — Final Design
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
#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card::before,
#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card::after {
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
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  gap: .85rem;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-padding-inline-start: .5rem;
  -webkit-overflow-scrolling: touch;
  padding: .35rem .5rem 1rem;
  margin: 0;
  direction: rtl;
  scrollbar-width: none;
}
#similar-sponsored-seller-root .ssw-plans-grid::-webkit-scrollbar {
  display: none;
}

/* ── Card shell — premium gradient + elegant shadow ── */
#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card {
  flex: 0 0 78%;
  width: 78%;
  min-width: 0;
  max-width: 300px;
  align-self: stretch;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  display: flex;
  flex-direction: column;
  gap: .72rem;
  padding: 1.1rem 1rem 1rem;
  border-radius: 20px;
  border: 1.5px solid rgba(99, 102, 241, .14);
  background: linear-gradient(160deg, #ffffff 0%, #f5f3ff 48%, #ede9fe 100%);
  box-shadow:
    0 2px 6px rgba(99, 102, 241, .06),
    0 12px 32px rgba(99, 102, 241, .1);
  transform: none;
  direction: rtl;
  position: relative;
  transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
}
#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card:hover {
  transform: translateY(-3px);
  border-color: rgba(99, 102, 241, .24);
  box-shadow:
    0 4px 10px rgba(99, 102, 241, .08),
    0 18px 40px rgba(99, 102, 241, .14);
}

/* ── Header row — title + single small badge ── */
#similar-sponsored-seller-root .ssw-plan-header {
  order: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .5rem;
  padding: 0;
  text-align: right;
}
#similar-sponsored-seller-root .ssw-plan-title {
  font-size: .92rem;
  font-weight: 850;
  line-height: 1.4;
  color: #1e1b4b;
  margin: 0;
}
#similar-sponsored-seller-root .ssw-plan-desc {
  margin: .15rem 0 0;
  color: #6366f1;
  font-size: .67rem;
  font-weight: 650;
  line-height: 1.5;
  opacity: .8;
  -webkit-line-clamp: 1;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Single badge — small, clean ── */
#similar-sponsored-seller-root .ssw-plan-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  max-width: 72px;
  padding: .14rem .48rem;
  border-radius: 999px;
  border: 1px solid rgba(99, 102, 241, .2);
  background: rgba(99, 102, 241, .08);
  color: #4f46e5;
  font-size: .58rem;
  font-weight: 850;
  line-height: 1;
  white-space: nowrap;
  flex-shrink: 0;
}
#similar-sponsored-seller-root .ssw-plan-badge--recommended {
  background: rgba(99, 102, 241, .12);
  border-color: rgba(99, 102, 241, .28);
  color: #4338ca;
}

/* ── Pricing — the visual anchor ── */
#similar-sponsored-seller-root .upgrade-ad-pricing.ssw-plan-pricing {
  order: 2;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: .38rem;
  padding: .62rem .6rem;
  margin: .1rem 0 0;
  border: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, .75);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  text-align: center;
  box-shadow: inset 0 0 0 1px rgba(99, 102, 241, .08);
}
#similar-sponsored-seller-root .upgrade-ad-price.ssw-plan-price {
  display: inline;
  width: auto;
  font-size: clamp(1.55rem, 7vw, 1.85rem);
  font-weight: 950;
  line-height: 1;
  color: #4338ca;
  -webkit-text-fill-color: currentColor;
  background: none;
  direction: ltr;
  unicode-bidi: isolate;
}
#similar-sponsored-seller-root .upgrade-ad-unit.ssw-plan-unit {
  display: inline;
  margin: 0;
  font-size: .68rem;
  color: #6366f1;
  font-weight: 700;
  white-space: nowrap;
  opacity: .85;
}

/* ── Hide extraneous elements ── */
#similar-sponsored-seller-root .ssw-plan-features,
#similar-sponsored-seller-root .ssw-plan-meta,
#similar-sponsored-seller-root .ssw-plan-admin-note,
#similar-sponsored-seller-root .ssw-plan-guide-btn {
  display: none !important;
}

/* ── CTA — compact pill button (no dark green!) ── */
#similar-sponsored-seller-root .ssw-plan-actions {
  order: 3;
  display: block;
  margin-top: auto;
  padding-top: .15rem;
}
#similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta {
  min-height: 38px;
  width: 100%;
  margin: 0;
  padding: .52rem .6rem;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  box-shadow:
    0 3px 12px rgba(99, 102, 241, .28),
    inset 0 1px 0 rgba(255, 255, 255, .18);
  color: #fff;
  font-size: .8rem;
  font-weight: 800;
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease, filter .2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .35rem;
  letter-spacing: .005em;
}
#similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta::after {
  content: '';
  width: 12px;
  height: 12px;
  background-color: currentColor;
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='15 18 9 12 15 6'/></svg>") no-repeat center / contain;
          mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='15 18 9 12 15 6'/></svg>") no-repeat center / contain;
  flex-shrink: 0;
  transition: transform .2s ease;
}
#similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta:hover {
  transform: translateY(-1px);
  filter: brightness(1.06);
  box-shadow:
    0 6px 18px rgba(99, 102, 241, .32),
    inset 0 1px 0 rgba(255, 255, 255, .22);
}
#similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta:hover::after {
  transform: translateX(-2px);
}
#similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta:active {
  transform: translateY(0);
  filter: brightness(.97);
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
}

/* ── Desktop: slightly larger cards in grid ── */
@media (min-width:640px) {
  #similar-sponsored-seller-root .ssw-plans-grid {
    gap: 1rem;
    scroll-padding-inline-start: .75rem;
    padding: .35rem .75rem 1.1rem;
  }
  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card {
    flex: 0 0 260px;
    width: 260px;
    max-width: 300px;
    padding: 1.15rem 1.05rem 1.05rem;
  }
  #similar-sponsored-seller-root .ssw-plan-title {
    font-size: .96rem;
  }
  #similar-sponsored-seller-root .upgrade-ad-price.ssw-plan-price {
    font-size: 1.85rem;
  }
  #similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta {
    min-height: 40px;
    padding: .56rem .7rem;
    font-size: .84rem;
  }
}

/* ── Very small screens ── */
@media (max-width:380px) {
  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card {
    flex: 0 0 82%;
    width: 82%;
    padding: .92rem .82rem .85rem;
    border-radius: 18px;
  }
  #similar-sponsored-seller-root .upgrade-ad-price.ssw-plan-price {
    font-size: 1.4rem;
  }
  #similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta {
    min-height: 36px;
    font-size: .76rem;
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
      <div class="ssw-plans-grid" id="similar-sponsored-plans" aria-label="پلن‌های تبلیغاتی فروشگاه‌های مشابه"></div>

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
        <article class="upgrade-ad-card upgrade-ad-card--search ssw-plan-card${isPriority ? ' ssw-plan-card--priority' : ''}" role="listitem" aria-labelledby="ssw-plan-title-${index}">
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
    document.getElementById('similar-sponsored-plans')?.addEventListener('click', (event) => {
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
