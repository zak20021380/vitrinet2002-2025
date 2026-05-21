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
    submitting: false
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
     PREMIUM CSS — matches upgrade-ad-card design language
     Purple/Violet accent for Similar Shops identity
     ───────────────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('similar-sponsored-seller-styles')) return;
    const style = document.createElement('style');
    style.id = 'similar-sponsored-seller-styles';
    style.textContent = `
/* ── Widget Container — Dark Theme (matches ads-modal dark surface) ── */
.ssw-widget {
  direction: rtl;
  margin: 1.5rem 0 0;
  font-family: inherit;
  --ssw-accent: #a78bfa;
  --ssw-accent-dark: #8b5cf6;
  --ssw-accent-deeper: #7c3aed;
  --ssw-accent-border: rgba(139,92,246,.35);
  --ssw-text-primary: #ffffff;
  --ssw-text-secondary: rgba(255,255,255,.5);
  --ssw-text-muted: rgba(255,255,255,.3);
  --ssw-card-bg: linear-gradient(165deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,.02) 100%);
  --ssw-card-border: rgba(255,255,255,.08);
  --ssw-inner-bg: rgba(255,255,255,.05);
  --ssw-inner-border: rgba(255,255,255,.08);
  --ssw-radius-card: 20px;
  --ssw-radius-btn: 12px;
}

/* ── Section Header ── */
.ssw-section-header {
  display: flex;
  align-items: flex-start;
  gap: .85rem;
  margin-bottom: 1rem;
  padding: 0 .1rem;
}
.ssw-section-header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  min-width: 52px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(139,92,246,.2) 0%, rgba(99,102,241,.12) 100%);
  border: 1px solid rgba(139,92,246,.35);
  box-shadow: 0 8px 24px rgba(139,92,246,.2);
  color: var(--ssw-accent);
}
.ssw-section-header-icon svg { width: 26px; height: 26px; }
.ssw-section-header-meta { flex: 1; min-width: 0; }
.ssw-section-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  padding: .22rem .65rem;
  background: rgba(139,92,246,.15);
  border: 1px solid rgba(139,92,246,.3);
  border-radius: 999px;
  color: var(--ssw-accent);
  font-size: .68rem;
  font-weight: 800;
  letter-spacing: .02em;
  margin-bottom: .38rem;
}
.ssw-section-eyebrow svg { width: 11px; height: 11px; }
.ssw-section-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--ssw-text-primary);
  margin: 0 0 .22rem;
  letter-spacing: -.01em;
  line-height: 1.3;
}
.ssw-section-subtitle {
  font-size: .78rem;
  color: var(--ssw-text-secondary);
  margin: 0;
  line-height: 1.6;
  font-weight: 500;
}

/* ── Info Banner ── */
.ssw-info-banner {
  display: flex;
  gap: .65rem;
  align-items: flex-start;
  padding: .78rem .92rem;
  background: rgba(139,92,246,.1);
  border: 1px solid rgba(139,92,246,.25);
  border-radius: 14px;
  margin-bottom: 1rem;
}
.ssw-info-banner-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  border-radius: 8px;
  background: rgba(139,92,246,.2);
  color: var(--ssw-accent);
  flex-shrink: 0;
}
.ssw-info-banner-icon svg { width: 14px; height: 14px; }
.ssw-info-banner-text {
  font-size: .78rem;
  font-weight: 600;
  color: rgba(255,255,255,.75);
  line-height: 1.75;
}

/* ── Status Message ── */
.ssw-message {
  min-height: 1.1rem;
  margin: .45rem 0;
  color: var(--ssw-text-secondary);
  font-weight: 700;
  font-size: .82rem;
}
.ssw-message--error { color: #f87171; }
.ssw-message--success { color: #4ade80; }

/* ── Plans Grid ── */
.ssw-plans-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
@media (min-width:640px) {
  .ssw-plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px,1fr));
    gap: 1rem;
  }
}

/* ── Plan Card — matches ads-plan-card dark style ── */
.ssw-plan-card {
  position: relative;
  background: var(--ssw-card-bg);
  border: 1px solid var(--ssw-card-border);
  border-radius: var(--ssw-radius-card);
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: all .3s cubic-bezier(.4,0,.2,1);
  overflow: hidden;
}
.ssw-plan-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 0%, rgba(255,255,255,.08) 0%, transparent 60%);
  opacity: 0;
  transition: opacity .3s ease;
  pointer-events: none;
}
.ssw-plan-card:hover {
  transform: translateY(-6px);
  border-color: rgba(255,255,255,.15);
  box-shadow: 0 20px 40px rgba(0,0,0,.4);
}
.ssw-plan-card:hover::after { opacity: 1; }

/* Normal tier — subtle purple tint like ads-plan-card--premium */
.ssw-plan-card--normal {
  background: linear-gradient(165deg, rgba(139,92,246,.1) 0%, rgba(109,40,217,.04) 100%);
  border-color: rgba(139,92,246,.25);
}
.ssw-plan-card--normal:hover {
  border-color: rgba(139,92,246,.45);
  box-shadow: 0 20px 40px rgba(139,92,246,.2);
}

/* Priority tier — golden glow like ads-plan-card--featured */
.ssw-plan-card--priority {
  background: linear-gradient(165deg, rgba(251,191,36,.1) 0%, rgba(245,158,11,.04) 100%);
  border-color: rgba(251,191,36,.28);
  box-shadow: 0 8px 32px rgba(251,191,36,.12);
}
.ssw-plan-card--priority:hover {
  border-color: rgba(251,191,36,.48);
  box-shadow: 0 24px 48px rgba(251,191,36,.2);
}
.ssw-plan-card--priority .ssw-plan-card-glow {
  display: block;
  position: absolute;
  top: -50%; left: 50%;
  transform: translateX(-50%);
  width: 200%; height: 100%;
  background: radial-gradient(ellipse at center, rgba(251,191,36,.14) 0%, transparent 70%);
  pointer-events: none;
}

/* ── Badge ── */
.ssw-plan-badge {
  position: absolute;
  top: 14px;
  right: -6px;
  padding: 5px 14px 5px 10px;
  font-size: .68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: #fff;
  background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
  border-radius: 6px 0 0 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,.3);
  z-index: 2;
}
.ssw-plan-badge--recommended {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

/* ── Card Header ── */
.ssw-plan-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding-top: 10px;
}
.ssw-plan-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  min-width: 52px;
  border-radius: 16px;
  transition: transform .3s ease;
}
/* Normal icon — purple/diamond style */
.ssw-plan-card--normal .ssw-plan-icon {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  border: 1px solid rgba(139,92,246,.5);
  box-shadow: 0 8px 24px rgba(139,92,246,.3);
  color: #fff;
}
/* Priority icon — gold style */
.ssw-plan-card--priority .ssw-plan-icon {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: 1px solid rgba(251,191,36,.5);
  box-shadow: 0 8px 24px rgba(245,158,11,.3);
  color: #fff;
}
.ssw-plan-icon svg { width: 24px; height: 24px; }
.ssw-plan-card:hover .ssw-plan-icon { transform: scale(1.08) rotate(-4deg); }
.ssw-plan-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
  line-height: 1.3;
}
.ssw-plan-desc {
  font-size: .8rem;
  color: var(--ssw-text-secondary);
  margin: 0;
  line-height: 1.45;
}

/* ── Pricing Block ── */
.ssw-plan-pricing {
  text-align: center;
  padding: 12px 0;
}
.ssw-plan-price {
  font-size: 2.1rem;
  font-weight: 900;
  color: #fff;
  letter-spacing: -.03em;
  line-height: 1;
}
/* Priority gets gold gradient */
.ssw-plan-card--priority .ssw-plan-price {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
/* Normal gets purple gradient */
.ssw-plan-card--normal .ssw-plan-price {
  background: linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.ssw-plan-unit {
  display: block;
  font-size: .78rem;
  font-weight: 500;
  color: var(--ssw-text-secondary);
  margin-top: 6px;
}

/* ── Features ── */
.ssw-plan-features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}
.ssw-plan-feature {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: .84rem;
  color: rgba(255,255,255,.75);
  line-height: 1.4;
}
.ssw-plan-feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  min-width: 18px;
  flex-shrink: 0;
  color: #10b981;
}
.ssw-plan-feature-icon svg { width: 13px; height: 13px; }

/* ── Meta Chips ── */
.ssw-plan-meta {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: .5rem;
}
.ssw-plan-meta-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .18rem;
  padding: .55rem .4rem;
  background: var(--ssw-inner-bg);
  border: 1px solid var(--ssw-inner-border);
  border-radius: 12px;
  text-align: center;
}
.ssw-plan-meta-chip__label {
  font-size: .62rem;
  font-weight: 700;
  color: var(--ssw-text-muted);
  text-transform: uppercase;
  letter-spacing: .03em;
}
.ssw-plan-meta-chip__value {
  font-size: .8rem;
  font-weight: 800;
  color: rgba(255,255,255,.85);
}

/* ── Admin Note ── */
.ssw-plan-admin-note {
  display: flex;
  align-items: flex-start;
  gap: .45rem;
  padding: .55rem .7rem;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 10px;
  font-size: .72rem;
  color: var(--ssw-text-secondary);
  line-height: 1.65;
  font-weight: 600;
}
.ssw-plan-admin-note svg {
  width: 13px; height: 13px;
  min-width: 13px;
  margin-top: .15rem;
  color: #10b981;
  flex-shrink: 0;
}

/* ── CTA Button — matches ads-plan-card__btn styles ── */
.ssw-plan-cta {
  margin-top: auto;
  width: 100%;
  padding: 14px 20px;
  border-radius: var(--ssw-radius-btn);
  border: 1px solid rgba(255,255,255,.15);
  font-family: inherit;
  font-size: .9rem;
  font-weight: 700;
  color: #fff;
  background: rgba(255,255,255,.08);
  cursor: pointer;
  transition: all .25s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .45rem;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.ssw-plan-cta span, .ssw-plan-cta svg { position: relative; z-index: 1; }
.ssw-plan-cta svg { width: 16px; height: 16px; flex-shrink: 0; }
.ssw-plan-cta:hover {
  background: rgba(255,255,255,.15);
  border-color: rgba(255,255,255,.25);
  transform: translateY(-2px);
}
/* Normal card CTA — purple premium */
.ssw-plan-card--normal .ssw-plan-cta {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  border-color: transparent;
  box-shadow: 0 8px 20px rgba(139,92,246,.35);
}
.ssw-plan-card--normal .ssw-plan-cta:hover {
  box-shadow: 0 12px 28px rgba(139,92,246,.45);
  transform: translateY(-3px);
}
/* Priority card CTA — gold */
.ssw-plan-card--priority .ssw-plan-cta {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border-color: transparent;
  box-shadow: 0 8px 20px rgba(245,158,11,.35);
}
.ssw-plan-card--priority .ssw-plan-cta:hover {
  box-shadow: 0 12px 28px rgba(245,158,11,.45);
  transform: translateY(-3px);
}
.ssw-plan-cta:active { transform: translateY(0) !important; }
.ssw-plan-cta:disabled {
  opacity: .45;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none;
}

/* ── Empty State ── */
.ssw-empty {
  display: flex;
  align-items: center;
  gap: .6rem;
  padding: 1rem;
  background: rgba(139,92,246,.08);
  border: 1px dashed rgba(139,92,246,.25);
  border-radius: 14px;
  color: rgba(255,255,255,.5);
  font-size: .8rem;
  font-weight: 600;
  line-height: 1.65;
}
.ssw-empty svg { width: 18px; height: 18px; min-width: 18px; opacity: .5; }

/* ── Requests Panel ── */
.ssw-requests-panel {
  margin-top: 1.25rem;
  border-radius: var(--ssw-radius-card);
  background: var(--ssw-card-bg);
  border: 1px solid var(--ssw-card-border);
  padding: 18px 20px;
  overflow: hidden;
}
.ssw-requests-panel-header {
  display: flex;
  align-items: center;
  gap: .55rem;
  margin-bottom: .85rem;
  padding-bottom: .75rem;
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.ssw-requests-panel-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: rgba(139,92,246,.2);
  color: var(--ssw-accent);
  flex-shrink: 0;
}
.ssw-requests-panel-icon svg { width: 15px; height: 15px; }
.ssw-requests-panel-title {
  font-size: .92rem;
  font-weight: 800;
  color: #fff;
  margin: 0;
}
.ssw-requests-grid {
  display: flex;
  flex-direction: column;
  gap: .65rem;
}

/* ── Request Item ── */
.ssw-request-item {
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  background: rgba(255,255,255,.04);
  padding: 14px 16px;
  transition: border-color .2s ease, background .2s ease;
}
.ssw-request-item:hover {
  border-color: rgba(139,92,246,.3);
  background: rgba(139,92,246,.06);
}
.ssw-request-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .65rem;
  margin-bottom: .4rem;
}
.ssw-request-title {
  font-size: .88rem;
  font-weight: 700;
  color: rgba(255,255,255,.9);
  margin: 0;
  line-height: 1.4;
}
.ssw-request-subtitle {
  color: var(--ssw-text-secondary);
  font-size: .74rem;
  line-height: 1.5;
  margin: 0;
}
/* Status Pill */
.ssw-status-pill {
  display: inline-flex;
  align-items: center;
  gap: .28rem;
  border-radius: 999px;
  padding: .25rem .65rem;
  font-size: .67rem;
  font-weight: 800;
  white-space: nowrap;
  flex-shrink: 0;
}
.ssw-status-pill::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
.ssw-status-pill--pending, .ssw-status-pill--paused {
  background: rgba(251,191,36,.15);
  color: #fbbf24;
  border: 1px solid rgba(251,191,36,.25);
}
.ssw-status-pill--approved {
  background: rgba(16,185,129,.15);
  color: #34d399;
  border: 1px solid rgba(16,185,129,.25);
}
.ssw-status-pill--rejected, .ssw-status-pill--removed, .ssw-status-pill--expired {
  background: rgba(239,68,68,.15);
  color: #f87171;
  border: 1px solid rgba(239,68,68,.25);
}
/* Request Grid */
.ssw-request-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .45rem;
  margin-top: .65rem;
}
@media (min-width:480px) { .ssw-request-grid { grid-template-columns: repeat(4,1fr); } }
.ssw-request-cell {
  background: var(--ssw-inner-bg);
  border: 1px solid var(--ssw-inner-border);
  border-radius: 10px;
  padding: .48rem;
  text-align: center;
}
.ssw-request-cell__label {
  display: block;
  font-size: .62rem;
  font-weight: 700;
  color: var(--ssw-text-muted);
  margin-bottom: .14rem;
  text-transform: uppercase;
  letter-spacing: .02em;
}
.ssw-request-cell__value {
  display: block;
  font-size: .77rem;
  font-weight: 700;
  color: rgba(255,255,255,.8);
}
.ssw-request-admin-note {
  margin-top: .52rem;
  padding: .45rem .65rem;
  background: rgba(251,191,36,.1);
  border: 1px solid rgba(251,191,36,.2);
  border-radius: 9px;
  font-size: .72rem;
  color: #fbbf24;
  font-weight: 600;
  line-height: 1.5;
}

/* ── Modal — dark surface ── */
.ssw-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: linear-gradient(180deg, rgba(0,0,0,.4) 0%, rgba(0,0,0,.85) 100%);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.ssw-modal[hidden] { display: none; }
.ssw-modal__dialog {
  width: min(520px, 100%);
  max-height: 92vh;
  overflow: auto;
  background: linear-gradient(180deg, #1a1a1f 0%, #0f0f12 100%);
  border: 1px solid rgba(255,255,255,.08);
  border-bottom: none;
  border-radius: 28px 28px 0 0;
  padding: 1.25rem 1.35rem 1.5rem;
  box-shadow: 0 -20px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.05) inset;
}
@media (min-width:640px) {
  .ssw-modal { align-items: center; padding: 1.5rem; }
  .ssw-modal__dialog { border-radius: 24px; border-bottom: 1px solid rgba(255,255,255,.08); }
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
  color: #fff;
  margin: 0 0 .28rem;
}
.ssw-modal__plan-label { font-size: .8rem; color: var(--ssw-text-secondary); margin: 0; }
.ssw-modal__close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px; height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.05);
  color: rgba(255,255,255,.6);
  cursor: pointer;
  transition: all .2s ease;
  flex-shrink: 0;
}
.ssw-modal__close-btn:hover {
  background: rgba(255,59,48,.15);
  border-color: rgba(255,59,48,.3);
  color: #ff3b30;
  transform: rotate(90deg);
}
.ssw-modal__close-btn svg { width: 16px; height: 16px; }
.ssw-modal__payment-note {
  display: flex;
  gap: .72rem;
  align-items: flex-start;
  padding: .88rem 1rem;
  background: rgba(139,92,246,.1);
  border: 1px solid rgba(139,92,246,.25);
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
  background: rgba(139,92,246,.2);
  color: var(--ssw-accent);
  flex-shrink: 0;
}
.ssw-modal__note-icon svg { width: 18px; height: 18px; }
.ssw-modal__note-strong {
  display: block;
  font-size: .88rem;
  font-weight: 800;
  color: var(--ssw-accent);
  margin-bottom: .28rem;
}
.ssw-modal__note-span {
  display: block;
  font-size: .77rem;
  line-height: 1.75;
  color: rgba(255,255,255,.55);
  font-weight: 500;
}
.ssw-modal__actions { display: flex; gap: .65rem; flex-wrap: wrap; }
.ssw-modal__submit {
  flex: 1;
  min-width: 180px;
  padding: 14px 20px;
  border-radius: var(--ssw-radius-btn);
  border: none;
  font-family: inherit;
  font-size: .92rem;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  cursor: pointer;
  transition: all .3s ease;
  box-shadow: 0 8px 20px rgba(139,92,246,.35);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .45rem;
  -webkit-tap-highlight-color: transparent;
}
.ssw-modal__submit:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(139,92,246,.45); }
.ssw-modal__submit:disabled { opacity: .45; cursor: not-allowed; transform: none; }
.ssw-modal__submit svg { width: 16px; height: 16px; }
.ssw-modal__cancel {
  padding: 14px 20px;
  border-radius: var(--ssw-radius-btn);
  border: 1px solid rgba(255,255,255,.15);
  font-family: inherit;
  font-size: .88rem;
  font-weight: 600;
  color: rgba(255,255,255,.65);
  background: rgba(255,255,255,.06);
  cursor: pointer;
  transition: all .2s ease;
  white-space: nowrap;
}
.ssw-modal__cancel:hover {
  border-color: rgba(255,255,255,.25);
  background: rgba(255,255,255,.1);
  color: #fff;
}
@media (max-width:480px) {
  .ssw-modal__actions { flex-direction: column; }
  .ssw-modal__submit { min-width: 0; }
}

/* Mobile compacting */
@media (max-width:639px) {
  .ssw-widget { margin-top: 1rem; }
  .ssw-plan-card { border-radius: 18px; padding: 20px 16px; }
  .ssw-plan-meta, .ssw-plan-features, .ssw-plan-admin-note { display: none; }
  .ssw-plans-grid { gap: .75rem; }
  .ssw-plan-price { font-size: 1.8rem; }
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
          <p class="ssw-section-subtitle">فروشگاه شما در بخش فروشگاه‌های هم‌حوزه مشتریان هدف نمایش داده می‌شود</p>
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

      <!-- Requests Panel -->
      <div class="ssw-requests-panel">
        <header class="ssw-requests-panel-header">
          <div class="ssw-requests-panel-icon" aria-hidden="true">${icons.list}</div>
          <h4 class="ssw-requests-panel-title">وضعیت درخواست‌های شما</h4>
        </header>
        <div class="ssw-requests-grid" id="similar-sponsored-requests"></div>
      </div>

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
    `;
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
        const [plansData, requestsData] = await Promise.all([
          apiJson('/similar-shop-promotions/plans'),
          apiJson('/similar-shop-promotions/seller')
        ]);
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

    container.innerHTML = plans.map((plan, index) => {
      const isPriority = plan.tier === 'priority';
      const isFirst = index === 0;
      const planTitle = plan.title || tierLabels[plan.tier] || 'پلن تبلیغ مشابه';
      const planDesc = plan.description || tierDescriptions[plan.tier] || 'نمایش ویژه فروشگاه در بخش فروشگاه‌های مشابه';
      const features = tierFeatures[plan.tier] || ['نمایش در فروشگاه‌های مشابه', 'فعال‌سازی پس از تأیید مدیر'];
      const badgeLabel = isPriority ? 'پیشنهادی' : 'استاندارد';
      const iconSvg = isPriority ? icons.trendUp : icons.store;

      const metaChips = [
        { label: 'مدت', value: plan.durationDays ? `${escapeHtml(String(plan.durationDays))} روز` : '—' },
        { label: 'دوره', value: escapeHtml(durationLabels[plan.durationUnit] || plan.durationUnit || '—') },
        { label: 'جایگاه', value: escapeHtml(String(plan.slotLimit || '۱')) }
      ];

      const tierClass = isPriority ? 'ssw-plan-card--priority' : 'ssw-plan-card--normal';
      return `
        <article class="ssw-plan-card ${tierClass}" role="listitem" aria-labelledby="ssw-plan-title-${index}">
          ${isPriority ? '<div class="ssw-plan-card-glow" aria-hidden="true"></div>' : ''}
          <div class="ssw-plan-badge${isPriority ? ' ssw-plan-badge--recommended' : ''}" aria-label="${badgeLabel}">${badgeLabel}</div>

          <div class="ssw-plan-header">
            <div class="ssw-plan-icon" aria-hidden="true">${iconSvg}</div>
            <h4 id="ssw-plan-title-${index}" class="ssw-plan-title">${escapeHtml(planTitle)}</h4>
            <p class="ssw-plan-desc">${escapeHtml(planDesc)}</p>
          </div>

          <div class="ssw-plan-pricing" aria-label="قیمت پلن">
            <span class="ssw-plan-price">${formatMoney(plan.price)}</span>
            <span class="ssw-plan-unit">تومان / دوره</span>
          </div>

          <ul class="ssw-plan-features" aria-label="امکانات پلن">
            ${features.map(f => `
              <li class="ssw-plan-feature">
                <span class="ssw-plan-feature-icon" aria-hidden="true">${icons.check}</span>
                ${escapeHtml(f)}
              </li>`).join('')}
          </ul>

          <div class="ssw-plan-meta" aria-label="مشخصات پلن">
            ${metaChips.map(chip => `
              <div class="ssw-plan-meta-chip">
                <span class="ssw-plan-meta-chip__label">${chip.label}</span>
                <span class="ssw-plan-meta-chip__value">${chip.value}</span>
              </div>`).join('')}
          </div>

          <div class="ssw-plan-admin-note">
            ${icons.shield}
            <span>زمان‌بندی توسط مدیر تعیین می‌شود. پس از ثبت درخواست و پرداخت، تیم ما آن را فعال خواهد کرد.</span>
          </div>

          <button type="button" class="ssw-plan-cta"
            data-plan-tier="${escapeHtml(plan.tier)}"
            data-plan-duration="${escapeHtml(plan.durationUnit)}"
            aria-label="ثبت درخواست برای ${escapeHtml(planTitle)}">
            ${icons.arrowLeft}
            <span>ثبت درخواست تبلیغ</span>
          </button>
        </article>
      `;
    }).join('');
  }

  /* ─────────────────────────────────────────────────────
     RENDER REQUESTS
     ───────────────────────────────────────────────────── */
  function renderRequests() {
    const container = document.getElementById('similar-sponsored-requests');
    if (!container) return;

    if (!state.requests.length) {
      container.innerHTML = `
        <div class="ssw-empty">
          ${icons.emptyBox}
          <span>هنوز درخواستی ثبت نکرده‌اید. بعد از ثبت، وضعیت بررسی مدیر همین‌جا نمایش داده می‌شود.</span>
        </div>`;
      return;
    }

    container.innerHTML = state.requests.map((item) => {
      const status = item.status || 'pending';
      const paymentStatus = item.paymentStatus || 'pending';
      const statusClass = ['approved', 'rejected', 'removed', 'expired', 'pending', 'paused'].includes(status)
        ? `ssw-status-pill--${status}` : 'ssw-status-pill--pending';

      return `
        <article class="ssw-request-item">
          <div class="ssw-request-top">
            <strong class="ssw-request-title">${escapeHtml(item.planTitle || tierLabels[item.planTier] || 'نمایش در فروشگاه‌های مشابه')}</strong>
            <span class="ssw-status-pill ${statusClass}" role="status">${escapeHtml(statusLabels[status] || status)}</span>
          </div>
          <p class="ssw-request-subtitle">${escapeHtml(tierLabels[item.planTier] || item.planTier || '')} / ${escapeHtml(durationLabels[item.durationUnit] || item.durationUnit || '')}</p>
          <div class="ssw-request-grid">
            <div class="ssw-request-cell">
              <span class="ssw-request-cell__label">قیمت</span>
              <span class="ssw-request-cell__value">${formatMoney(item.price)} تومان</span>
            </div>
            <div class="ssw-request-cell">
              <span class="ssw-request-cell__label">پرداخت</span>
              <span class="ssw-request-cell__value">${escapeHtml(paymentLabels[paymentStatus] || paymentStatus)}</span>
            </div>
            <div class="ssw-request-cell">
              <span class="ssw-request-cell__label">شروع</span>
              <span class="ssw-request-cell__value">${escapeHtml(formatDate(item.startAt))}</span>
            </div>
            <div class="ssw-request-cell">
              <span class="ssw-request-cell__label">پایان</span>
              <span class="ssw-request-cell__value">${escapeHtml(formatDate(item.endAt))}</span>
            </div>
          </div>
          ${item.adminNote ? `<p class="ssw-request-admin-note">یادداشت مدیر: ${escapeHtml(item.adminNote)}</p>` : ''}
        </article>
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

    document.getElementById('similar-sponsored-form')?.addEventListener('submit', submitRequest);

    document.getElementById('similar-sponsored-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'similar-sponsored-modal') closeModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const modal = document.getElementById('similar-sponsored-modal');
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
