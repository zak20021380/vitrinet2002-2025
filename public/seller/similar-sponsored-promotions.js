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
    availableProducts: [],
    selectedProduct: null,
    lastSubmittedProduct: null,
    lastSubmissionPayload: null,
    planVersion: null,
    lastLoadedAt: 0,
    loadPromise: null,
    productsLoadPromise: null,
    csrfPromise: null,
    submitting: false,
    guidePlan: null
  };

  const tierLabels = {
    normal: 'نمایش عادی',
    priority: 'نمایش ویژه'
  };

  const tierDescriptions = {
    normal: 'فروشگاه شما قبل از فروشگاه‌های عادی در بخش فروشگاه‌های مشابه نمایش داده می‌شود.',
    priority: 'فروشگاه شما در بالاترین جایگاه تبلیغاتی بخش فروشگاه‌های مشابه نمایش داده می‌شود.'
  };

  const tierFeatures = {
    normal: [
      'فروشگاه شما در بخش فروشگاه‌های مشابه دیده می‌شود.',
      'بازدیدکنندگان فروشگاه‌های هم‌حوزه راحت‌تر شما را پیدا می‌کنند.',
      'پس از بررسی مدیر، نمایش شما فعال می‌شود.'
    ],
    priority: [
      'فروشگاه شما در بالاترین جایگاه تبلیغاتی دیده می‌شود.',
      'برای جذب بازدیدکننده بیشتر نسبت به نمایش عادی ساخته شده است.',
      'پس از بررسی مدیر، نمایش ویژه شما فعال می‌شود.'
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

  async function refreshSellerAdvertisingPlans(promotion) {
    const detail = {
      source: 'similar_shop_promotion',
      id: promotion?.id || promotion?._id || ''
    };
    try {
      if (typeof window.refreshSellerAdvertisingPlans === 'function') {
        return await window.refreshSellerAdvertisingPlans(detail);
      }
      window.dispatchEvent(new CustomEvent('seller:advertising-requests-updated', { detail }));
    } catch (err) {
      console.warn('Failed to refresh My Plans after similar promotion submit:', err);
    }
    return null;
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

  function normaliseProduct(product, index = 0) {
    if (!product) return null;
    const id = product._id || product.id || `modal-product-${index + 1}`;
    const images = Array.isArray(product.images) ? product.images : [];
    const mainImageIndex = Number.isInteger(product.mainImageIndex) ? product.mainImageIndex : 0;
    const image = product.image || images[mainImageIndex] || images[0] || '/assets/images/placeholder-product.svg';
    const status = product.status
      || (product.inStock === false ? 'ناموجود' : '')
      || (product.active === false ? 'غیرفعال' : '')
      || (product.inStock === true ? 'موجود' : '');

    return {
      id: String(id),
      title: String(product.title || product.name || 'کالای بدون نام'),
      price: Number(product.price) || 0,
      image: String(image),
      status: String(status || '')
    };
  }

  function parseProducts(products) {
    if (Array.isArray(products)) return products;
    if (Array.isArray(products?.products)) return products.products;
    if (typeof products === 'string') {
      try {
        return parseProducts(JSON.parse(products));
      } catch {
        return [];
      }
    }
    return [];
  }

  function getAvailableProducts(products) {
    const source = products == null
      ? parseProducts(window._allProducts)
      : parseProducts(products);
    return source.map(normaliseProduct).filter(Boolean);
  }

  function getCurrentSellerId() {
    const seller = window.seller || (() => {
      try {
        return JSON.parse(localStorage.getItem('seller') || 'null');
      } catch {
        return null;
      }
    })();
    return seller?.id || seller?._id || seller?.sellerId || '';
  }

  function formatDate(value) {
    if (!value) return 'پس از تایید مدیر';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'پس از تایید مدیر';
    return date.toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function getMarketingDurationLabel(plan = {}) {
    const labels = {
      daily: '۱ روزه',
      weekly: '۷ روزه',
      monthly: '۳۰ روزه'
    };
    if (labels[plan.durationUnit]) return labels[plan.durationUnit];
    if (plan.durationDays) return `${Number(plan.durationDays).toLocaleString('fa-IR')} روزه`;
    return durationLabels[plan.durationUnit] || 'دوره‌ای';
  }

  function getMarketingPlanTitle(plan = {}) {
    const prefix = plan.tier === 'priority' ? 'نمایش ویژه' : 'نمایش عادی';
    return `${prefix} ${getMarketingDurationLabel(plan)}`;
  }

  function getMarketingBadgeLabel(plan = {}) {
    if (plan.tier === 'priority') {
      const badges = {
        daily: 'جایگاه شماره ۱',
        weekly: 'بیشترین بازدید',
        monthly: 'پیشنهاد ویژه'
      };
      return badges[plan.durationUnit] || 'پیشنهاد ویژه';
    }
    return 'شروع ساده';
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
  background: rgba(7,10,22,.74);
  backdrop-filter: blur(14px) saturate(1.1);
  -webkit-backdrop-filter: blur(14px) saturate(1.1);
}
.ssw-modal[hidden] { display: none; }
.ssw-modal__dialog {
  position: relative;
  width: min(460px, 100%);
  max-height: 92vh;
  max-height: 92dvh;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  background: linear-gradient(180deg, #1e1b2e 0%, #13111c 100%);
  border-radius: 28px 28px 0 0;
  padding: 1.5rem 1.4rem calc(1.85rem + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -16px 50px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04);
  border-top: 1px solid rgba(255,255,255,.08);
}
@media (min-width:640px) {
  .ssw-modal { align-items: center; padding: 1.5rem; }
  .ssw-modal__dialog {
    border-radius: 24px;
    padding: 1.65rem 1.6rem 1.85rem;
    box-shadow: 0 24px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.05);
  }
}

/* When the payment modal is open, suppress competing UI for premium focus */
body.ssw-modal-open { overflow: hidden; }
body.ssw-modal-open .seller-mobile-bottom-nav {
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  transform: translateY(28px);
}
body.ssw-modal-open .notif-btn,
body.ssw-modal-open #notificationFab,
body.ssw-modal-open .notification-fab,
body.ssw-modal-open .product-floating-add,
body.ssw-modal-open #productAddFloatingBtn,
body.ssw-modal-open .home-btn,
body.ssw-modal-open #sidebarHamburger,
body.ssw-modal-open .sidebar-hamburger,
body.ssw-modal-open .hamburger-menu {
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  transform: translateY(-12px) scale(0.96);
  transition: opacity .2s ease, transform .2s ease, visibility .2s ease;
}
.ssw-modal__handle {
  width: 40px; height: 4px;
  background: rgba(255,255,255,.18);
  border-radius: 3px;
  margin: 0 auto 1.1rem;
  display: block;
}
@media (min-width:640px) { .ssw-modal__handle { display: none; } }

.ssw-modal__close-btn {
  position: absolute;
  top: .9rem;
  inset-inline-end: .9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px; height: 34px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,.06);
  color: rgba(226,232,240,.65);
  cursor: pointer;
  transition: background .25s ease, color .25s ease, transform .2s ease;
  z-index: 2;
  -webkit-tap-highlight-color: transparent;
}
.ssw-modal__close-btn:hover {
  background: rgba(239,68,68,.18);
  color: #fca5a5;
}
.ssw-modal__close-btn:active { transform: scale(.94); }
.ssw-modal__close-btn svg { width: 15px; height: 15px; }
@media (min-width:640px) {
  .ssw-modal__close-btn { top: 1.1rem; inset-inline-end: 1.1rem; }
}

.ssw-modal__header {
  text-align: center;
  padding: 0 2.5rem;
  margin-bottom: 1.25rem;
}
.ssw-modal__title {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--ssw-text-dark);
  margin: 0 0 .35rem;
  letter-spacing: -.01em;
}
.ssw-modal__plan-label {
  font-size: .78rem;
  color: rgba(203,213,225,.7);
  margin: 0;
  font-weight: 600;
}
.ssw-modal__plan-label:empty { display: none; }

/* Price card */
.ssw-modal__price-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .35rem;
  padding: 1.1rem 1rem;
  background: linear-gradient(145deg, rgba(167,139,250,.14), rgba(99,102,241,.06));
  border: 1px solid var(--ssw-accent-border);
  border-radius: 18px;
  margin-bottom: 1.1rem;
}
.ssw-modal__price-label {
  font-size: .72rem;
  font-weight: 700;
  color: rgba(196,181,253,.85);
  letter-spacing: .01em;
}
.ssw-modal__price-row {
  display: flex;
  align-items: baseline;
  gap: .35rem;
  direction: ltr;
}
.ssw-modal__price-value {
  font-size: 1.55rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -.02em;
  font-variant-numeric: tabular-nums;
}
.ssw-modal__price-currency {
  font-size: .78rem;
  font-weight: 700;
  color: rgba(226,232,240,.7);
}

/* Section wrapper */
.ssw-modal__section {
  margin-bottom: 1rem;
}
.ssw-modal__section-title {
  display: block;
  font-size: .72rem;
  font-weight: 700;
  color: rgba(203,213,225,.55);
  margin-bottom: .5rem;
  padding-inline-start: .15rem;
  letter-spacing: .02em;
}

/* Payment method card */
.ssw-modal__pay-method {
  display: flex;
  align-items: center;
  gap: .85rem;
  padding: .95rem 1.05rem;
  background: linear-gradient(150deg, rgba(40,33,72,.85), rgba(28,24,52,.78));
  border: 1.5px solid rgba(167,139,250,.32);
  border-radius: 16px;
  position: relative;
  transition: border-color .25s ease, background .25s ease;
  box-shadow: 0 6px 18px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.05);
}
.ssw-modal__pay-method::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(167,139,250,.10), rgba(99,102,241,.03));
  pointer-events: none;
}
.ssw-modal__pay-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px; height: 40px;
  min-width: 40px;
  border-radius: 12px;
  background: linear-gradient(145deg, rgba(167,139,250,.25), rgba(99,102,241,.14));
  color: #c4b5fd;
  flex-shrink: 0;
}
.ssw-modal__pay-icon svg { width: 18px; height: 18px; }
.ssw-modal__pay-text {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: .15rem;
  flex: 1;
  min-width: 0;
}
.ssw-modal__pay-text strong {
  font-size: .9rem;
  font-weight: 800;
  color: #f8fafc;
  line-height: 1.3;
}
.ssw-modal__pay-text span {
  font-size: .73rem;
  color: rgba(203,213,225,.7);
  font-weight: 600;
  line-height: 1.4;
}
.ssw-modal__pay-check {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px; height: 22px;
  min-width: 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--ssw-accent), var(--ssw-accent-dark));
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(139,92,246,.4);
}
.ssw-modal__pay-check svg { width: 11px; height: 11px; }

/* Important note */
.ssw-modal__note {
  display: flex;
  align-items: flex-start;
  gap: .55rem;
  padding: .8rem .95rem;
  background: linear-gradient(150deg, rgba(40,33,72,.55), rgba(28,24,52,.45));
  border-radius: 14px;
  margin-bottom: 1.35rem;
  border: 1px solid rgba(167,139,250,.14);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
}
.ssw-modal__note-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: rgba(167,139,250,.85);
  margin-top: 2px;
}
.ssw-modal__note-icon svg { width: 14px; height: 14px; }
.ssw-modal__note-text {
  margin: 0;
  font-size: .76rem;
  line-height: 1.7;
  color: rgba(203,213,225,.78);
  font-weight: 600;
}
.ssw-modal__result {
  display: grid;
  gap: .75rem;
  justify-items: center;
  text-align: center;
  padding: 1.05rem .95rem;
  margin: 0 0 1rem;
  border-radius: 18px;
  border: 1px solid rgba(16,185,129,.24);
  background: linear-gradient(150deg, rgba(16,185,129,.13), rgba(20,184,166,.06));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 12px 34px rgba(2,6,23,.18);
}
.ssw-modal__result[hidden] { display: none; }
.ssw-modal__result-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 16px;
  color: #d1fae5;
  background: linear-gradient(135deg, #10b981, #0f766e);
  box-shadow: 0 10px 26px rgba(16,185,129,.24);
}
.ssw-modal__result-icon svg {
  width: 22px;
  height: 22px;
}
.ssw-modal__result-title {
  margin: 0;
  color: #f8fafc;
  font-size: .98rem;
  line-height: 1.55;
  font-weight: 900;
}
.ssw-modal__result-text {
  margin: 0;
  color: rgba(226,232,240,.78);
  font-size: .78rem;
  line-height: 1.85;
  font-weight: 650;
}
.ssw-modal__result-meta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .35rem;
  max-width: 100%;
  padding: .5rem .7rem;
  border-radius: 999px;
  color: #bbf7d0;
  background: rgba(16,185,129,.1);
  border: 1px solid rgba(16,185,129,.2);
  font-size: .7rem;
  font-weight: 800;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.ssw-modal__dialog.is-result .ssw-modal__confirm {
  display: none;
}
.ssw-modal__dialog.is-result .ssw-modal__result {
  margin-top: .35rem;
}
.ssw-modal__dialog.is-result .ssw-modal__cancel {
  display: none;
}
.ssw-modal__dialog.is-error .ssw-modal__result {
  border-color: rgba(248,113,113,.26);
  background: linear-gradient(150deg, rgba(248,113,113,.14), rgba(124,45,18,.07));
}
.ssw-modal__dialog.is-error .ssw-modal__result-icon {
  color: #fee2e2;
  background: linear-gradient(135deg, #f97316, #dc2626);
  box-shadow: 0 10px 26px rgba(248,113,113,.18);
}
.ssw-modal__dialog.is-error .ssw-modal__result-meta {
  color: #fecaca;
  background: rgba(248,113,113,.1);
  border-color: rgba(248,113,113,.18);
}

/* Actions */
.ssw-modal__actions {
  display: flex;
  flex-direction: column;
  gap: .55rem;
  margin-top: .35rem;
  padding-top: .25rem;
  padding-bottom: .35rem;
}
.ssw-modal__submit {
  width: 100%;
  padding: .95rem 1.1rem;
  border-radius: 14px;
  border: 1px solid rgba(167,139,250,.35);
  font-family: inherit;
  font-size: .9rem;
  font-weight: 700;
  color: #f5f3ff;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  cursor: pointer;
  transition: transform .2s ease, box-shadow .25s ease, opacity .2s ease, background .25s ease;
  box-shadow: 0 4px 14px rgba(124,58,237,.22), inset 0 1px 0 rgba(255,255,255,.10);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .5rem;
  -webkit-tap-highlight-color: transparent;
  letter-spacing: -.005em;
}
.ssw-modal__submit:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(124,58,237,.30), inset 0 1px 0 rgba(255,255,255,.12);
}
.ssw-modal__submit:active { transform: translateY(0); }
.ssw-modal__submit:disabled { opacity: .55; cursor: not-allowed; transform: none; }
.ssw-modal__submit svg { width: 16px; height: 16px; }
.ssw-modal__cancel {
  width: 100%;
  padding: .8rem 1.1rem;
  border-radius: 14px;
  border: none;
  font-family: inherit;
  font-size: .85rem;
  font-weight: 700;
  color: rgba(203,213,225,.7);
  background: transparent;
  cursor: pointer;
  transition: color .2s ease, background .2s ease;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}
.ssw-modal__cancel:hover {
  color: #f8fafc;
  background: rgba(255,255,255,.04);
}
@media (min-width:640px) {
  .ssw-modal__actions { flex-direction: row-reverse; gap: .65rem; }
  .ssw-modal__submit { flex: 1.6; }
  .ssw-modal__cancel { width: auto; flex: 1; }
}

/* ── Request modal — light teal marketplace theme ── */
.ssw-modal {
  --ssw-accent: #10b981;
  --ssw-accent-dark: #059669;
  --ssw-accent-deeper: #0f766e;
  --ssw-accent-border: rgba(16,185,129,.2);
  --ssw-text-dark: #134e4a;
  --ssw-text-secondary: #64748b;
  background: rgba(2,44,43,.54);
  backdrop-filter: blur(12px) saturate(1.04);
  -webkit-backdrop-filter: blur(12px) saturate(1.04);
}
.ssw-modal__dialog {
  color: var(--ssw-text-dark);
  background:
    radial-gradient(circle at 90% 0%, rgba(16,185,129,.12), transparent 32%),
    linear-gradient(160deg, #ffffff 0%, #f6fffc 58%, #ecfdf5 100%);
  border: 1px solid rgba(255,255,255,.76);
  border-bottom: 0;
  box-shadow: 0 -18px 54px rgba(2,44,43,.24), inset 0 1px 0 rgba(255,255,255,.9);
}
@media (min-width:640px) {
  .ssw-modal__dialog {
    border-bottom: 1px solid rgba(255,255,255,.76);
    box-shadow: 0 24px 60px rgba(2,44,43,.22), inset 0 1px 0 rgba(255,255,255,.9);
  }
}
.ssw-modal__handle {
  background: rgba(13,148,136,.24);
}
.ssw-modal__close-btn {
  border: 1px solid rgba(13,148,136,.12);
  background: rgba(255,255,255,.78);
  color: #64748b;
  box-shadow: 0 4px 12px rgba(15,118,110,.06);
}
.ssw-modal__close-btn:hover {
  border-color: rgba(239,68,68,.18);
  background: #fff1f2;
  color: #e11d48;
}
.ssw-modal__header {
  margin-bottom: 1rem;
}
.ssw-modal__title {
  color: #134e4a;
  font-size: 1.12rem;
  font-weight: 900;
}
.ssw-modal__plan-label {
  color: #64748b;
  font-weight: 700;
  line-height: 1.7;
}
.ssw-modal__price-card {
  gap: .3rem;
  margin-bottom: 1rem;
  padding: 1rem;
  border-color: rgba(16,185,129,.18);
  background: linear-gradient(135deg, rgba(209,250,229,.76), rgba(240,253,250,.9));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 8px 20px rgba(5,150,105,.07);
  text-align: center;
}
.ssw-modal__price-label {
  color: #0f766e;
  font-weight: 800;
}
.ssw-modal__price-row {
  justify-content: center;
}
.ssw-modal__price-value {
  color: #134e4a;
  font-size: 1.62rem;
  font-weight: 900;
}
.ssw-modal__price-currency {
  color: #0f766e;
  font-weight: 800;
}
.ssw-modal__validation-notice {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  margin: -4px 0 14px;
  padding: 11px 12px;
  border: 1px solid rgba(244,63,94,.18);
  border-radius: 16px;
  color: #9f1239;
  background:
    radial-gradient(circle at 8% 15%, rgba(255,255,255,.92), transparent 34%),
    linear-gradient(135deg, #fff1f2 0%, #fff7ed 100%);
  box-shadow: 0 12px 28px rgba(244,63,94,.08), inset 0 1px 0 rgba(255,255,255,.92);
  animation: sswValidationNoticeIn .2s ease both;
}
.ssw-modal__validation-notice[hidden] {
  display: none;
}
.ssw-modal__validation-notice-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  color: #e11d48;
  background: rgba(255,228,230,.9);
  border: 1px solid rgba(244,63,94,.16);
}
.ssw-modal__validation-notice-icon svg {
  width: 17px;
  height: 17px;
}
.ssw-modal__validation-notice-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.ssw-modal__validation-notice-title {
  color: #9f1239;
  font-size: .78rem;
  font-weight: 950;
  line-height: 1.55;
}
.ssw-modal__validation-notice-text {
  color: #be123c;
  font-size: .68rem;
  font-weight: 750;
  line-height: 1.65;
}
@keyframes sswValidationNoticeIn {
  from { opacity: 0; transform: translateY(-6px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.ssw-modal__product-picker {
  margin-bottom: 1.05rem;
  padding: .78rem;
  border: 1px solid rgba(13,148,136,.12);
  border-radius: 18px;
  background: linear-gradient(145deg, rgba(240,253,250,.72), rgba(255,255,255,.78));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 8px 20px rgba(15,118,110,.045);
}
.ssw-modal__product-picker.has-error {
  border-color: rgba(244,63,94,.34);
  background: linear-gradient(145deg, rgba(255,241,242,.78), rgba(255,255,255,.88));
  box-shadow: 0 12px 24px rgba(244,63,94,.08), 0 0 0 3px rgba(244,63,94,.07), inset 0 1px 0 rgba(255,255,255,.92);
}
.ssw-modal__product-picker-head {
  display: flex;
  align-items: center;
  gap: .58rem;
  margin-bottom: .7rem;
}
.ssw-modal__product-picker-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  min-width: 34px;
  border-radius: 11px;
  color: #047857;
  background: linear-gradient(145deg, #d1fae5, #ccfbf1);
  border: 1px solid rgba(16,185,129,.16);
  box-shadow: 0 4px 10px rgba(5,150,105,.08);
}
.ssw-modal__product-picker-icon svg {
  width: 17px;
  height: 17px;
}
.ssw-modal__product-picker-copy {
  display: grid;
  gap: .12rem;
  min-width: 0;
}
.ssw-modal__product-picker-title {
  margin: 0;
  color: #134e4a;
  font-size: .88rem;
  font-weight: 900;
  line-height: 1.5;
}
.ssw-modal__product-picker-hint {
  color: #64748b;
  font-size: .69rem;
  font-weight: 700;
  line-height: 1.65;
}
.ssw-modal__product-list {
  display: grid;
  gap: .58rem;
  max-height: min(43vh, 296px);
  overflow-y: auto;
  padding: .08rem .02rem .12rem .2rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(13,148,136,.26) transparent;
  overscroll-behavior: contain;
}
.ssw-modal__product-list::-webkit-scrollbar { width: 5px; }
.ssw-modal__product-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(13,148,136,.26);
}
.ssw-modal__product-card {
  display: flex;
  align-items: center;
  direction: rtl;
  gap: .7rem;
  width: 100%;
  min-height: 82px;
  padding: .68rem .64rem;
  border: 1.5px solid rgba(15,118,110,.12);
  border-radius: 16px;
  background: rgba(255,255,255,.9);
  color: #134e4a;
  font: inherit;
  text-align: start;
  cursor: pointer;
  touch-action: pan-y;
  transition: border-color .2s ease, background .2s ease, box-shadow .2s ease, transform .18s ease;
  -webkit-tap-highlight-color: transparent;
}
.ssw-modal__product-card:hover {
  border-color: rgba(13,148,136,.34);
  background: rgba(248,255,253,.98);
}
.ssw-modal__product-card:focus-visible {
  outline: 3px solid rgba(45,212,191,.3);
  outline-offset: 2px;
}
.ssw-modal__product-card:active { transform: scale(.985); }
.ssw-modal__product-card.is-selected {
  border-color: rgba(5,150,105,.9);
  background: linear-gradient(135deg, rgba(209,250,229,.94), rgba(240,253,250,.99));
  box-shadow: 0 9px 20px rgba(5,150,105,.14), 0 0 0 2px rgba(16,185,129,.08);
}
.ssw-modal__product-media {
  order: 1;
  position: relative;
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  min-width: 58px;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid rgba(13,148,136,.14);
  background: linear-gradient(145deg, #ecfdf5, #ccfbf1);
  box-shadow: 0 4px 11px rgba(15,118,110,.09), inset 0 1px 0 rgba(255,255,255,.82);
}
.ssw-modal__product-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ssw-modal__product-placeholder {
  display: none;
  place-items: center;
  width: 100%;
  height: 100%;
  color: #0f766e;
  background: linear-gradient(145deg, #ecfdf5, #ccfbf1);
}
.ssw-modal__product-placeholder svg {
  width: 23px;
  height: 23px;
}
.ssw-modal__product-media.is-placeholder .ssw-modal__product-thumb { display: none; }
.ssw-modal__product-media.is-placeholder .ssw-modal__product-placeholder { display: grid; }
.ssw-modal__product-card.is-selected .ssw-modal__product-media {
  border-color: rgba(5,150,105,.36);
  box-shadow: 0 5px 13px rgba(5,150,105,.13), inset 0 1px 0 rgba(255,255,255,.86);
}
.ssw-modal__product-copy {
  order: 2;
  display: grid;
  min-width: 0;
  flex: 1;
  gap: .34rem;
}
.ssw-modal__product-title {
  overflow: hidden;
  color: #134e4a;
  font-size: .85rem;
  font-weight: 900;
  line-height: 1.55;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ssw-modal__product-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: .28rem .44rem;
  color: #64748b;
  font-size: .72rem;
  font-weight: 800;
  line-height: 1.5;
}
.ssw-modal__product-price {
  color: #047857;
  font-size: .75rem;
  font-weight: 900;
  white-space: nowrap;
}
.ssw-modal__product-status {
  display: inline-flex;
  align-items: center;
  gap: .22rem;
  padding: .13rem .4rem;
  border-radius: 999px;
  color: #0f766e;
  background: rgba(204,251,241,.92);
  border: 1px solid rgba(13,148,136,.1);
  font-size: .67rem;
  font-weight: 850;
  line-height: 1.4;
  white-space: nowrap;
}
.ssw-modal__product-status::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 2px rgba(16,185,129,.12);
}
.ssw-modal__product-check {
  order: 3;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  border: 1.5px solid rgba(13,148,136,.2);
  border-radius: 50%;
  color: transparent;
  background: rgba(255,255,255,.9);
  transition: border-color .2s ease, color .2s ease, background .2s ease, box-shadow .2s ease;
}
.ssw-modal__product-check svg { width: 14px; height: 14px; }
.ssw-modal__product-card.is-selected .ssw-modal__product-check {
  border-color: #059669;
  color: #ffffff;
  background: linear-gradient(135deg, #10b981, #059669);
  box-shadow: 0 4px 10px rgba(5,150,105,.26);
}
.ssw-modal__product-empty {
  display: grid;
  justify-items: center;
  gap: .42rem;
  padding: .9rem .75rem;
  border: 1px dashed rgba(13,148,136,.25);
  border-radius: 14px;
  color: #475569;
  background: rgba(240,253,250,.72);
  text-align: center;
}
.ssw-modal__product-empty svg {
  width: 22px;
  height: 22px;
  color: #0f766e;
}
.ssw-modal__product-empty strong {
  color: #134e4a;
  font-size: .75rem;
}
.ssw-modal__product-error {
  margin: .42rem .1rem 0;
  color: #dc2626;
  font-size: .69rem;
  font-weight: 800;
}
.ssw-modal__product-error[hidden] { display: none; }
.ssw-modal__section-title {
  padding-inline: 0;
  color: #64748b;
  font-weight: 800;
  text-align: center;
}
.ssw-modal__pay-method {
  justify-content: center;
  gap: .72rem;
  padding: .9rem .95rem;
  border-color: rgba(16,185,129,.2);
  background: rgba(255,255,255,.78);
  box-shadow: 0 8px 20px rgba(15,118,110,.07), inset 0 1px 0 rgba(255,255,255,.92);
}
.ssw-modal__pay-method::before {
  background: linear-gradient(135deg, rgba(209,250,229,.44), rgba(240,253,250,.2));
}
.ssw-modal__pay-icon {
  background: linear-gradient(145deg, #d1fae5, #ccfbf1);
  color: #0f766e;
}
.ssw-modal__pay-text {
  text-align: center;
}
.ssw-modal__pay-text strong {
  color: #134e4a;
  font-weight: 900;
}
.ssw-modal__pay-text span {
  color: #64748b;
  line-height: 1.6;
}
.ssw-modal__pay-check {
  background: linear-gradient(135deg, #10b981, #059669);
  box-shadow: 0 3px 9px rgba(5,150,105,.24);
}
.ssw-modal__note {
  border-color: rgba(14,165,233,.12);
  background: rgba(240,249,255,.7);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.88);
}
.ssw-modal__note-icon {
  color: #0f766e;
}
.ssw-modal__note-text {
  color: #475569;
}
.ssw-modal__result {
  border-color: rgba(16,185,129,.2);
  background: linear-gradient(150deg, rgba(209,250,229,.72), rgba(240,253,250,.88));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 12px 28px rgba(15,118,110,.08);
}
.ssw-modal__result-icon {
  color: #ffffff;
}
.ssw-modal__result-title {
  color: #134e4a;
}
.ssw-modal__result-text {
  color: #475569;
}
.ssw-modal__result-meta {
  color: #047857;
  background: rgba(209,250,229,.72);
  border-color: rgba(16,185,129,.2);
}
.ssw-modal__dialog.is-error .ssw-modal__result {
  border-color: rgba(248,113,113,.22);
  background: linear-gradient(150deg, rgba(254,226,226,.72), rgba(255,247,237,.82));
}
.ssw-modal__dialog.is-error .ssw-modal__result-meta {
  color: #b91c1c;
  background: rgba(254,226,226,.75);
  border-color: rgba(248,113,113,.22);
}
.ssw-modal__submit {
  min-height: 54px;
  border-radius: 15px;
  border-color: rgba(5,150,105,.3);
  color: #ffffff;
  font-size: .94rem;
  font-weight: 900;
  background:
    linear-gradient(135deg, rgba(255,255,255,.14), transparent 42%),
    linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow: 0 10px 21px rgba(5,150,105,.25), inset 0 1px 0 rgba(255,255,255,.2);
}
.ssw-modal__submit:hover {
  background:
    linear-gradient(135deg, rgba(255,255,255,.13), transparent 42%),
    linear-gradient(135deg, #059669 0%, #047857 100%);
  box-shadow: 0 13px 27px rgba(5,150,105,.3), inset 0 1px 0 rgba(255,255,255,.22);
}
.ssw-modal__cancel {
  color: #64748b;
}
.ssw-modal__cancel:hover {
  color: #0f766e;
  background: rgba(15,118,110,.06);
}

@media (max-width:639px) {
  .ssw-modal__product-list {
    max-height: none;
    overflow: visible;
  }
}

/* Checkout experience */
.ssw-modal__dialog {
  display: flex;
  flex-direction: column;
  padding: 18px 0 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 84% 2%, rgba(45,212,191,.2), transparent 24%),
    radial-gradient(circle at 5% 58%, rgba(16,185,129,.08), transparent 23%),
    linear-gradient(180deg, #fbfffe 0%, #f4fffb 54%, #ecfdf5 100%);
}
.ssw-modal__scroll-area {
  min-height: 0;
  padding: 0 16px 12px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
}
.ssw-modal__handle {
  flex: 0 0 auto;
  margin-bottom: 13px;
}
.ssw-modal__header {
  position: relative;
  margin-bottom: 16px;
}
.ssw-modal__header::before {
  content: '';
  display: block;
  width: 32px;
  height: 3px;
  margin: 0 auto 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, #5eead4, #10b981);
  box-shadow: 0 3px 8px rgba(16,185,129,.2);
}
.ssw-modal__title {
  font-size: 1.16rem;
  letter-spacing: -.025em;
}
.ssw-modal__plan-label {
  color: #64817d;
  font-size: .72rem;
}
.ssw-modal__price-card {
  isolation: isolate;
  position: relative;
  gap: 4px;
  margin-bottom: 16px;
  padding: 17px 16px 18px;
  overflow: hidden;
  border-radius: 18px;
  border-color: rgba(16,185,129,.2);
  background:
    radial-gradient(circle at 12% 0%, rgba(255,255,255,.92), transparent 31%),
    linear-gradient(135deg, rgba(209,250,229,.94), rgba(240,253,250,.98));
  box-shadow: 0 12px 26px rgba(5,150,105,.09), inset 0 1px 0 rgba(255,255,255,.95);
}
.ssw-modal__price-card::before,
.ssw-modal__price-card::after {
  content: '';
  position: absolute;
  z-index: -1;
  border-radius: 50%;
  background: rgba(16,185,129,.09);
}
.ssw-modal__price-card::before {
  width: 76px;
  height: 76px;
  inset-inline-start: -27px;
  top: -38px;
}
.ssw-modal__price-card::after {
  width: 48px;
  height: 48px;
  inset-inline-end: -18px;
  bottom: -27px;
}
.ssw-modal__price-label {
  color: #0f766e;
  font-size: .67rem;
  letter-spacing: .01em;
}
.ssw-modal__price-value {
  color: #115e59;
  font-size: 2rem;
  line-height: 1.2;
  letter-spacing: -.055em;
  text-shadow: 0 2px 0 rgba(255,255,255,.65);
}
.ssw-modal__price-currency {
  color: #557a75;
  font-size: .68rem;
}
.ssw-modal__product-picker {
  margin-bottom: 18px;
  padding: 12px;
  border-radius: 18px;
  border-color: rgba(15,118,110,.12);
  background: rgba(255,255,255,.7);
  box-shadow: 0 12px 30px rgba(15,118,110,.06), inset 0 1px 0 #fff;
}
.ssw-modal__product-picker-head {
  gap: 9px;
  margin-bottom: 12px;
}
.ssw-modal__product-picker-icon {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 12px;
  color: #047857;
  background: linear-gradient(145deg, #d1fae5, #99f6e4);
  box-shadow: 0 7px 16px rgba(5,150,105,.13), inset 0 1px 0 rgba(255,255,255,.75);
}
.ssw-modal__product-picker-title {
  font-size: .91rem;
}
.ssw-modal__product-picker-hint {
  color: #718096;
  font-size: .67rem;
}
.ssw-modal__product-list {
  gap: 9px;
}
.ssw-modal__product-card {
  isolation: isolate;
  position: relative;
  min-height: 76px;
  gap: 9px;
  overflow: hidden;
  padding: 9px;
  border-color: rgba(15,118,110,.1);
  background: rgba(255,255,255,.95);
  box-shadow: 0 5px 14px rgba(15,23,42,.035);
  transition:
    border-color .28s ease,
    background .28s ease,
    box-shadow .28s ease,
    transform .18s ease;
}
.ssw-modal__product-card::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  background: radial-gradient(circle at center, rgba(16,185,129,.2), transparent 65%);
  opacity: 0;
  transform: scale(.55);
  transition: opacity .18s ease, transform .3s ease;
  pointer-events: none;
}
.ssw-modal__product-card:active::after {
  opacity: 1;
  transform: scale(1.2);
}
.ssw-modal__product-card > * {
  position: relative;
  z-index: 1;
}
.ssw-modal__product-card.is-selected {
  border-color: #10b981;
  background: linear-gradient(135deg, rgba(236,253,245,.98), rgba(240,253,250,.99));
  box-shadow: 0 10px 18px rgba(5,150,105,.12), 0 0 0 2px rgba(16,185,129,.07);
}
.ssw-modal__product-media {
  width: 50px;
  height: 50px;
  min-width: 50px;
  border-radius: 15px;
  border-color: rgba(13,148,136,.12);
  background: linear-gradient(145deg, #ecfdf5, #ccfbf1);
}
.ssw-modal__product-placeholder {
  color: #0f766e;
  background:
    radial-gradient(circle at 35% 25%, rgba(255,255,255,.95), transparent 36%),
    linear-gradient(145deg, #ecfdf5, #ccfbf1);
}
.ssw-modal__product-placeholder svg {
  width: 21px;
  height: 21px;
}
.ssw-modal__product-copy {
  gap: 3px;
}
.ssw-modal__product-title {
  font-size: .82rem;
}
.ssw-modal__product-price {
  color: #64748b;
  font-size: .7rem;
}
.ssw-modal__product-status {
  padding: 2px 6px;
  color: #047857;
  font-size: .62rem;
  background: #d1fae5;
}
.ssw-modal__product-check {
  width: 26px;
  height: 26px;
  min-width: 26px;
  transition:
    border-color .25s ease,
    color .25s ease,
    background .25s ease,
    box-shadow .25s ease,
    transform .25s ease;
}
.ssw-modal__product-card.is-selected .ssw-modal__product-check {
  transform: scale(1.06);
}
.ssw-modal__section {
  margin-bottom: 18px;
}
.ssw-modal__section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
  color: #71908b;
  font-size: .69rem;
}
.ssw-modal__section-title::before,
.ssw-modal__section-title::after {
  content: '';
  height: 1px;
  flex: 1;
  background: linear-gradient(90deg, transparent, rgba(15,118,110,.16));
}
.ssw-modal__section-title::after {
  background: linear-gradient(90deg, rgba(15,118,110,.16), transparent);
}
.ssw-modal__pay-method {
  gap: 10px;
  padding: 13px;
  border-color: rgba(16,185,129,.18);
  border-radius: 18px;
  background:
    radial-gradient(circle at 92% 18%, rgba(153,246,228,.42), transparent 24%),
    rgba(255,255,255,.88);
  box-shadow: 0 10px 22px rgba(15,118,110,.075), inset 0 1px 0 #fff;
}
.ssw-modal__pay-icon {
  width: 42px;
  height: 42px;
  min-width: 42px;
  border-radius: 13px;
  background: linear-gradient(145deg, #ccfbf1, #a7f3d0);
  box-shadow: 0 6px 14px rgba(5,150,105,.11);
}
.ssw-modal__pay-text {
  text-align: start;
}
.ssw-modal__pay-text strong {
  font-size: .86rem;
}
.ssw-modal__pay-text span {
  color: #64748b;
  font-size: .68rem;
}
.ssw-modal__note {
  gap: 10px;
  margin-bottom: 4px;
  padding: 12px;
  border-radius: 16px;
  border-color: rgba(14,165,233,.16);
  background: linear-gradient(135deg, rgba(240,249,255,.96), rgba(236,253,245,.82));
}
.ssw-modal__note-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  min-width: 32px;
  margin-top: 0;
  border-radius: 11px;
  color: #0284c7;
  background: rgba(224,242,254,.9);
  border: 1px solid rgba(14,165,233,.12);
}
.ssw-modal__note-text {
  color: #526579;
  font-size: .7rem;
  line-height: 1.85;
}
.ssw-modal__actions {
  position: relative;
  z-index: 3;
  flex: 0 0 auto;
  gap: 5px;
  margin: 0;
  padding: 11px 16px calc(11px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgba(15,118,110,.1);
  background: rgba(255,255,255,.9);
  box-shadow: 0 -10px 28px rgba(15,118,110,.08);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.ssw-modal__submit {
  min-height: 56px;
  border-radius: 16px;
  font-size: .93rem;
  box-shadow: 0 10px 20px rgba(5,150,105,.24), inset 0 1px 0 rgba(255,255,255,.24);
}
.ssw-modal__submit:active {
  transform: scale(.985);
}
.ssw-modal__cancel {
  padding: 6px 12px 2px;
  font-size: .74rem;
}
@media (min-width:640px) {
  .ssw-modal__dialog {
    padding-top: 20px;
  }
  .ssw-modal__scroll-area {
    padding-inline: 20px;
  }
  .ssw-modal__actions {
    padding: 13px 20px 16px;
  }
}

/* Compact selected product + mobile product picker sheet */
.ssw-modal__product-summary {
  min-width: 0;
}
.ssw-modal__product-summary-empty {
  display: grid;
  justify-items: center;
  gap: 7px;
  padding: 15px 12px 13px;
  border: 1px dashed rgba(13,148,136,.24);
  border-radius: 15px;
  color: #64748b;
  background: linear-gradient(145deg, rgba(240,253,250,.82), rgba(255,255,255,.86));
  text-align: center;
}
.ssw-modal__product-summary-empty-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  color: #0f766e;
  background: #ccfbf1;
}
.ssw-modal__product-summary-empty-icon svg {
  width: 18px;
  height: 18px;
}
.ssw-modal__product-summary-empty strong {
  color: #355e59;
  font-size: .78rem;
  font-weight: 900;
}
.ssw-modal__product-summary-empty span:not(.ssw-modal__product-summary-empty-icon) {
  color: #718096;
  font-size: .68rem;
  font-weight: 700;
}
.ssw-modal__product-summary-action,
.ssw-modal__product-summary-change {
  min-height: 36px;
  border: 1px solid rgba(5,150,105,.2);
  border-radius: 11px;
  color: #047857;
  background: rgba(209,250,229,.86);
  font: inherit;
  font-size: .73rem;
  font-weight: 900;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform .18s ease, background .2s ease, border-color .2s ease;
}
.ssw-modal__product-summary-action {
  min-width: 112px;
  margin-top: 2px;
  padding: 7px 16px;
}
.ssw-modal__product-summary-change {
  flex: 0 0 auto;
  min-width: 76px;
  padding: 7px 9px;
}
.ssw-modal__product-summary-action:hover,
.ssw-modal__product-summary-change:hover {
  border-color: rgba(5,150,105,.36);
  background: #d1fae5;
}
.ssw-modal__product-summary-action:active,
.ssw-modal__product-summary-change:active {
  transform: scale(.97);
}
.ssw-modal__product-summary-card {
  display: flex;
  align-items: center;
  direction: rtl;
  gap: 11px;
  min-height: 94px;
  padding: 10px;
  border: 1px solid rgba(5,150,105,.2);
  border-radius: 15px;
  background: linear-gradient(135deg, rgba(236,253,245,.98), rgba(255,255,255,.95));
  box-shadow: 0 8px 18px rgba(5,150,105,.08), inset 0 1px 0 #fff;
}
.ssw-modal__product-summary-card .ssw-modal__product-media {
  width: 74px;
  height: 74px;
  min-width: 74px;
  border-radius: 14px;
  border-color: rgba(5,150,105,.24);
  background: #fff;
  box-shadow: 0 7px 16px rgba(15,118,110,.14), inset 0 1px 0 rgba(255,255,255,.9);
}
.ssw-modal__product-summary-card .ssw-modal__product-copy {
  gap: 4px;
}
.ssw-modal__product-summary-card .ssw-modal__product-title {
  font-size: .79rem;
}
.ssw-modal__product-summary-card .ssw-modal__product-thumb {
  object-fit: cover;
}
.ssw-modal__product-image-label {
  position: absolute;
  inset-inline: 5px;
  bottom: 5px;
  z-index: 2;
  padding: 2px 5px;
  border-radius: 6px;
  color: #fff;
  background: rgba(6,78,59,.76);
  font-size: .56rem;
  font-weight: 800;
  line-height: 1.45;
  text-align: center;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}
.ssw-modal__product-media.is-placeholder .ssw-modal__product-image-label {
  display: none;
}

.ssw-product-sheet {
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-top: 18px;
  background: rgba(2,44,43,.42);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.ssw-product-sheet[hidden] {
  display: none;
}
.ssw-product-sheet__dialog {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(460px, 100%);
  max-height: min(82vh, 720px);
  max-height: min(82dvh, 720px);
  min-height: 0;
  padding: 11px 14px calc(14px + env(safe-area-inset-bottom, 0px));
  border: 1px solid rgba(255,255,255,.78);
  border-bottom: 0;
  border-radius: 25px 25px 0 0;
  background:
    radial-gradient(circle at 88% 0%, rgba(45,212,191,.18), transparent 28%),
    linear-gradient(180deg, #fbfffe 0%, #f1fdf9 100%);
  box-shadow: 0 -18px 46px rgba(2,44,43,.2), inset 0 1px 0 #fff;
}
.ssw-product-sheet__handle {
  width: 40px;
  height: 4px;
  margin: 0 auto 11px;
  border-radius: 999px;
  background: rgba(13,148,136,.24);
}
.ssw-product-sheet__close {
  position: absolute;
  top: 14px;
  inset-inline-end: 14px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(13,148,136,.12);
  border-radius: 50%;
  color: #64748b;
  background: rgba(255,255,255,.82);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.ssw-product-sheet__close:active {
  transform: scale(.94);
}
.ssw-product-sheet__header {
  padding: 0 44px 0 4px;
  margin-bottom: 12px;
}
.ssw-product-sheet__title {
  margin: 0 0 3px;
  color: #134e4a;
  font-size: 1.02rem;
  font-weight: 900;
}
.ssw-product-sheet__hint {
  margin: 0;
  color: #64748b;
  font-size: .7rem;
  font-weight: 700;
}
.ssw-product-sheet__search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
.ssw-product-sheet__search-icon {
  position: absolute;
  inset-inline-start: 12px;
  display: grid;
  place-items: center;
  color: #0f766e;
  pointer-events: none;
}
.ssw-product-sheet__search-icon svg {
  width: 17px;
  height: 17px;
}
.ssw-product-sheet__search {
  width: 100%;
  min-height: 46px;
  padding: 10px 40px 10px 12px;
  border: 1px solid rgba(13,148,136,.16);
  border-radius: 14px;
  outline: none;
  color: #134e4a;
  background: rgba(255,255,255,.92);
  font: inherit;
  font-size: .8rem;
  font-weight: 700;
  box-shadow: inset 0 1px 0 #fff, 0 5px 14px rgba(15,118,110,.05);
}
.ssw-product-sheet__search::placeholder {
  color: #94a3b8;
}
.ssw-product-sheet__search:focus {
  border-color: rgba(5,150,105,.5);
  box-shadow: 0 0 0 3px rgba(16,185,129,.11);
}
.ssw-product-sheet__list {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
  overflow-y: auto;
  padding: 1px 1px 2px 5px;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.ssw-product-sheet__list .ssw-modal__product-card {
  min-height: 72px;
}
@media (min-width:640px) {
  .ssw-product-sheet {
    align-items: center;
    padding: 24px;
  }
  .ssw-product-sheet__dialog {
    max-height: min(76vh, 720px);
    border-bottom: 1px solid rgba(255,255,255,.78);
    border-radius: 24px;
  }
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
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  gap: .95rem;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-padding-inline-start: .5rem;
  -webkit-overflow-scrolling: touch;
  padding: .5rem .5rem .25rem;
  margin: 0;
  direction: rtl;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
#similar-sponsored-seller-root .ssw-plans-grid::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  display: none !important;
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
  padding-block: 0;
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
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  justify-content: flex-start;
  gap: .75rem !important;
  width: 100%;
  max-width: 100%;
  padding: .45rem 1rem .2rem !important;
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
  width: 0 !important;
  height: 0 !important;
  display: none !important;
  -webkit-appearance: none;
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
  padding: .3rem 0 0;
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
    padding: .45rem 1rem .25rem !important;
    scroll-padding-inline: 1rem;
  }

  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card {
    flex-basis: 310px !important;
    width: 310px !important;
  }

  #similar-sponsored-seller-root .ssw-carousel-dots {
    display: flex;
    gap: 7px;
    padding-top: .35rem;
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

/* Mobile carousel polish: intentional peek, premium focus, refined rhythm */
@media (max-width: 759px) {
  #similar-sponsored-seller-root .ssw-carousel-shell {
    margin-inline: 0;
    padding-block: 0;
    overflow: hidden;
  }

  /* Side fades — softer and intentional, not harsh cut-offs */
  #similar-sponsored-seller-root .ssw-carousel-shell::before,
  #similar-sponsored-seller-root .ssw-carousel-shell::after {
    inset-block: 0 .25rem;
    width: 24px;
  }
  #similar-sponsored-seller-root .ssw-carousel-shell::before {
    background: linear-gradient(to right, rgba(248, 250, 252, .98) 0%, rgba(248, 250, 252, .55) 60%, transparent 100%);
  }
  #similar-sponsored-seller-root .ssw-carousel-shell::after {
    background: linear-gradient(to left, rgba(248, 250, 252, .98) 0%, rgba(248, 250, 252, .55) 60%, transparent 100%);
  }

  /* Track: balanced horizontal padding + tighter gap, smooth swipe */
  #similar-sponsored-seller-root .ssw-plans-grid {
    gap: .68rem !important;
    padding: .4rem 1rem .15rem !important;
    scroll-padding-inline: 1rem;
    scroll-snap-type: x mandatory !important;
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }

  #similar-sponsored-seller-root .ssw-plans-grid::-webkit-scrollbar {
    width: 0 !important;
    height: 0 !important;
    display: none !important;
  }

  /* Cards: ~78% width => ~15% peek of next card visible */
  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card {
    grid-template-columns: 42px minmax(0, 1fr);
    column-gap: .62rem;
    row-gap: .3rem;
    flex: 0 0 min(78%, 282px) !important;
    width: min(78%, 282px) !important;
    max-width: 282px !important;
    min-height: 158px;
    padding: .76rem .82rem .72rem;
    border-radius: 17px;
    border-color: rgba(203, 213, 225, .78);
    background:
      radial-gradient(circle at 16% 12%, rgba(255,255,255,.94) 0 18%, transparent 42%),
      linear-gradient(145deg, #ffffff 0%, #f8fafc 54%, #eef2ff 100%);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, .98) inset,
      0 4px 10px rgba(15, 23, 42, .05),
      0 12px 24px rgba(15, 23, 42, .07);
    scroll-snap-align: start;
    scroll-snap-stop: always;
    /* Subtle de-emphasis for non-active cards: layering effect */
    transform: scale(.97);
    opacity: .78;
    transition:
      transform .35s cubic-bezier(.4,0,.2,1),
      box-shadow .35s cubic-bezier(.4,0,.2,1),
      opacity .35s ease,
      border-color .3s ease;
  }

  /* Active card: premium focus state — scale, opacity, prominent shadow */
  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card.is-active {
    transform: scale(1);
    opacity: 1;
    z-index: 2;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, .98) inset,
      0 8px 18px rgba(15, 23, 42, .09),
      0 22px 40px rgba(15, 23, 42, .12);
  }

  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card.ssw-plan-card--priority {
    border-color: rgba(129, 140, 248, .42);
  }

  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card.ssw-plan-card--priority.is-active {
    border-color: rgba(129, 140, 248, .55);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, .98) inset,
      0 10px 22px rgba(79, 70, 229, .14),
      0 22px 40px rgba(15, 23, 42, .12);
  }

  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card::after {
    inset-block-start: .55rem;
    inset-inline-end: .58rem;
    width: 46px;
    height: 46px;
    opacity: .55;
  }

  #similar-sponsored-seller-root .ssw-plan-visual {
    gap: .34rem;
  }

  #similar-sponsored-seller-root .ssw-plan-visual__icon {
    width: 38px;
    height: 38px;
    border-radius: 13px;
    box-shadow:
      0 1px 0 rgba(255,255,255,.9) inset,
      0 6px 14px var(--plan-card-shadow);
  }

  #similar-sponsored-seller-root .ssw-plan-visual__icon svg {
    width: 18px;
    height: 18px;
  }

  #similar-sponsored-seller-root .ssw-plan-visual__line {
    min-height: 26px;
  }

  #similar-sponsored-seller-root .ssw-plan-header {
    gap: .22rem;
  }

  #similar-sponsored-seller-root .ssw-plan-title {
    margin: 0;
    font-size: .88rem;
    line-height: 1.4;
    letter-spacing: 0;
  }

  #similar-sponsored-seller-root .ssw-plan-desc {
    margin-top: .1rem;
    font-size: .66rem;
    line-height: 1.45;
    -webkit-line-clamp: 1;
  }

  #similar-sponsored-seller-root .ssw-plan-badge {
    min-height: 20px;
    padding: .16rem .48rem;
    border-radius: 7px;
    font-size: .57rem;
    box-shadow: 0 2px 5px rgba(15, 23, 42, .05);
  }

  #similar-sponsored-seller-root .upgrade-ad-pricing.ssw-plan-pricing {
    min-height: 44px;
    padding: .42rem .58rem;
    margin-top: .04rem;
    border-radius: 12px;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, .92), rgba(248, 250, 252, .76));
    box-shadow: 0 1px 0 rgba(255,255,255,.9) inset;
  }

  #similar-sponsored-seller-root .upgrade-ad-price.ssw-plan-price {
    font-size: clamp(1.22rem, 5.4vw, 1.5rem);
  }

  #similar-sponsored-seller-root .upgrade-ad-unit.ssw-plan-unit {
    font-size: .61rem;
  }

  /* CTA — give breathing room so it doesn't feel cramped */
  #similar-sponsored-seller-root .ssw-plan-actions {
    margin-top: .12rem;
  }

  #similar-sponsored-seller-root .upgrade-ad-cta.ssw-plan-cta {
    min-height: 42px;
    padding: .55rem .7rem;
    border-radius: 12px;
    font-size: .82rem;
    font-weight: 900;
    background:
      linear-gradient(135deg, rgba(255,255,255,.24), transparent 38%),
      linear-gradient(135deg, var(--plan-accent) 0%, var(--plan-accent-deep) 100%);
    box-shadow:
      0 1px 0 rgba(255,255,255,.22) inset,
      0 8px 16px var(--plan-card-shadow),
      0 12px 24px rgba(15, 23, 42, .11);
  }

  /* Pagination dots: aligned, breathable, premium active state */
  #similar-sponsored-seller-root .ssw-carousel-dots {
    display: flex !important;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: .25rem 0 0;
    margin: 0;
  }

  #similar-sponsored-seller-root .ssw-carousel-dot {
    width: 6px;
    height: 6px;
    min-width: 6px;
    min-height: 6px;
    max-width: 22px;
    max-height: 6px;
    flex: 0 0 auto;
    appearance: none;
    line-height: 0;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(148, 163, 184, .32);
    transition:
      width .35s cubic-bezier(.4,0,.2,1),
      background .3s ease,
      box-shadow .3s ease;
  }

  #similar-sponsored-seller-root .ssw-carousel-dot.is-active {
    width: 22px;
    height: 6px;
    background: linear-gradient(135deg, #0f766e, #2563eb);
    box-shadow: 0 2px 6px rgba(15, 118, 110, .3);
  }
}

/* Respect users who prefer reduced motion: drop transform/opacity de-emphasis */
@media (max-width: 759px) and (prefers-reduced-motion: reduce) {
  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card,
  #similar-sponsored-seller-root .ssw-carousel-dot {
    transition: none;
  }
  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card {
    transform: none;
    opacity: 1;
  }
}

/* Mobile-first plan comparison: stacked preview + all plans sheet */
body.ssw-all-plans-open {
  overflow: hidden;
}

#similar-sponsored-seller-root .ssw-carousel-shell {
  margin-inline: 0 !important;
  overflow: visible !important;
}

#similar-sponsored-seller-root .ssw-carousel-shell::before,
#similar-sponsored-seller-root .ssw-carousel-shell::after,
#similar-sponsored-seller-root .ssw-carousel-dots {
  display: none !important;
}

#similar-sponsored-seller-root .ssw-plans-grid {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) !important;
  gap: .78rem !important;
  width: 100%;
  padding: .35rem .1rem .25rem !important;
  overflow: visible !important;
  scroll-snap-type: none !important;
  touch-action: auto;
}

#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card.ssw-plan-card--preview,
#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card.ssw-plan-card--full {
  flex: none !important;
  width: 100% !important;
  max-width: none !important;
  transform: none !important;
  opacity: 1 !important;
  scroll-snap-align: none;
}

#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card.ssw-plan-card--preview {
  min-height: 154px;
}

#similar-sponsored-seller-root .ssw-all-plans-trigger-wrap {
  display: flex;
  justify-content: center;
  padding: .65rem .1rem .15rem;
}

#similar-sponsored-seller-root .ssw-all-plans-trigger-wrap[hidden] {
  display: none !important;
}

#similar-sponsored-seller-root .ssw-all-plans-trigger {
  width: 100%;
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .45rem;
  border: 1px solid rgba(15, 118, 110, .18);
  border-radius: 14px;
  color: #0f766e;
  background:
    linear-gradient(135deg, rgba(255,255,255,.96), rgba(240, 253, 250, .78));
  box-shadow:
    0 1px 0 rgba(255,255,255,.95) inset,
    0 8px 18px rgba(15, 118, 110, .08);
  font: inherit;
  font-size: .88rem;
  font-weight: 900;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
}

#similar-sponsored-seller-root .ssw-all-plans-trigger:hover {
  transform: translateY(-1px);
  border-color: rgba(15, 118, 110, .3);
  box-shadow:
    0 1px 0 rgba(255,255,255,.98) inset,
    0 12px 24px rgba(15, 118, 110, .12);
}

#similar-sponsored-seller-root .ssw-all-plans-trigger svg {
  width: 16px;
  height: 16px;
}

#similar-sponsored-seller-root .ssw-all-plans-modal[hidden] {
  display: none !important;
}

#similar-sponsored-seller-root .ssw-all-plans-modal {
  position: fixed;
  inset: 0;
  z-index: 10040;
  display: grid;
  align-items: end;
  justify-items: center;
  padding: 0;
  background: rgba(15, 23, 42, .46);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

#similar-sponsored-seller-root .ssw-all-plans-dialog {
  width: 100%;
  height: min(94dvh, 760px);
  max-height: 94dvh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  direction: rtl;
  background:
    linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(226, 232, 240, .88);
  border-radius: 24px 24px 0 0;
  box-shadow:
    0 -1px 0 rgba(255,255,255,.9) inset,
    0 -24px 55px rgba(15, 23, 42, .2);
  overflow: hidden;
  animation: sswAllPlansSlideUp .32s cubic-bezier(.22,1,.36,1);
}

#similar-sponsored-seller-root .ssw-all-plans-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .8rem;
  padding: .88rem 1rem .8rem;
  border-bottom: 1px solid rgba(226, 232, 240, .78);
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

#similar-sponsored-seller-root .ssw-all-plans-header::before {
  content: '';
  position: absolute;
  top: .42rem;
  left: 50%;
  width: 42px;
  height: 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, .42);
  transform: translateX(-50%);
}

#similar-sponsored-seller-root .ssw-all-plans-title {
  margin: .45rem 0 0;
  color: #0f172a;
  font-size: .98rem;
  font-weight: 950;
  line-height: 1.55;
}

#similar-sponsored-seller-root .ssw-all-plans-close {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(226, 232, 240, .86);
  border-radius: 12px;
  color: #334155;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(15, 23, 42, .06);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

#similar-sponsored-seller-root .ssw-all-plans-content {
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: .92rem 1rem max(1rem, env(safe-area-inset-bottom));
}

#similar-sponsored-seller-root .ssw-all-plans-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: .88rem;
  width: 100%;
}

#similar-sponsored-seller-root .ssw-all-plans-list .ssw-plan-card.upgrade-ad-card {
  min-height: auto;
  grid-template-columns: 46px minmax(0, 1fr);
  grid-template-areas:
    "visual head"
    "visual price"
    "features features"
    "actions actions";
  row-gap: .72rem;
  padding: 1rem;
  border-radius: 20px;
  box-shadow:
    0 1px 0 rgba(255,255,255,.96) inset,
    0 10px 28px rgba(15, 23, 42, .08);
}

#similar-sponsored-seller-root .ssw-all-plans-list .ssw-plan-title {
  font-size: 1rem;
  -webkit-line-clamp: 3;
}

#similar-sponsored-seller-root .ssw-all-plans-list .ssw-plan-desc {
  font-size: .75rem;
  -webkit-line-clamp: 3;
}

#similar-sponsored-seller-root .ssw-all-plans-list .upgrade-ad-pricing.ssw-plan-pricing {
  min-height: 58px;
  padding: .62rem .75rem;
}

#similar-sponsored-seller-root .ssw-all-plans-list .upgrade-ad-price.ssw-plan-price {
  font-size: clamp(1.7rem, 8vw, 2.1rem);
}

#similar-sponsored-seller-root .ssw-all-plans-list .ssw-plan-features {
  grid-area: features;
  display: grid !important;
  gap: .46rem;
  margin: 0;
  padding: .05rem 0 0;
  list-style: none;
}

#similar-sponsored-seller-root .ssw-all-plans-list .ssw-plan-features li {
  display: flex;
  align-items: flex-start;
  gap: .42rem;
  color: #475569;
  font-size: .76rem;
  font-weight: 700;
  line-height: 1.75;
}

#similar-sponsored-seller-root .ssw-all-plans-list .ssw-plan-features span {
  width: 19px;
  height: 19px;
  flex: 0 0 19px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: .15rem;
  border-radius: 7px;
  color: var(--plan-accent-deep);
  background: var(--plan-accent-soft);
}

#similar-sponsored-seller-root .ssw-all-plans-list .upgrade-ad-cta.ssw-plan-cta {
  min-height: 46px;
}

@media (min-width: 760px) {
  #similar-sponsored-seller-root .ssw-plans-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: .9rem !important;
  }

  #similar-sponsored-seller-root .ssw-all-plans-trigger {
    max-width: 360px;
  }

  #similar-sponsored-seller-root .ssw-all-plans-modal {
    align-items: center;
    padding: 2rem;
  }

  #similar-sponsored-seller-root .ssw-all-plans-dialog {
    max-width: 720px;
    height: auto;
    max-height: 88vh;
    border-radius: 24px;
    box-shadow:
      0 1px 0 rgba(255,255,255,.95) inset,
      0 28px 80px rgba(15, 23, 42, .28);
    animation: sswAllPlansScaleIn .24s ease-out;
  }

  #similar-sponsored-seller-root .ssw-all-plans-content {
    padding: 1rem 1.1rem 1.15rem;
  }
}

@media (min-width: 1120px) {
  #similar-sponsored-seller-root .ssw-plans-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  #similar-sponsored-seller-root .ssw-all-plans-dialog,
  #similar-sponsored-seller-root .ssw-all-plans-trigger {
    animation: none;
    transition: none;
  }
}

@keyframes sswAllPlansSlideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes sswAllPlansScaleIn {
  from { opacity: .75; transform: translateY(14px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* Seller-friendly similar store display offers */
#similar-sponsored-seller-root .ssw-section-subtitle {
  max-width: 44rem;
  color: #475569;
  font-size: .84rem;
  line-height: 1.9;
}

#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card {
  min-height: 188px !important;
  grid-template-columns: 42px minmax(0, 1fr);
  border-color: rgba(20, 184, 166, .24) !important;
  background:
    radial-gradient(circle at 16% 12%, rgba(255,255,255,.96) 0 18%, transparent 42%),
    linear-gradient(145deg, #ffffff 0%, #f8fafc 58%, rgba(240, 253, 250, .92) 100%) !important;
}

#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card.ssw-plan-card--priority {
  border-width: 1.5px;
  border-color: rgba(79, 70, 229, .42) !important;
  background:
    radial-gradient(circle at 14% 10%, rgba(255,255,255,.98) 0 17%, transparent 42%),
    linear-gradient(145deg, #ffffff 0%, #f8f7ff 50%, rgba(238, 242, 255, .96) 100%) !important;
  box-shadow:
    0 1px 0 rgba(255,255,255,.98) inset,
    0 10px 28px rgba(79, 70, 229, .12),
    0 3px 10px rgba(15, 23, 42, .06) !important;
}

#similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card.ssw-plan-card--priority::after {
  opacity: .82;
}

#similar-sponsored-seller-root .ssw-plan-card--priority .ssw-plan-visual__icon {
  color: #ffffff !important;
  background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%) !important;
  box-shadow:
    0 1px 0 rgba(255,255,255,.28) inset,
    0 10px 20px rgba(79, 70, 229, .24) !important;
}

#similar-sponsored-seller-root .ssw-plan-title {
  font-size: .96rem !important;
  line-height: 1.55 !important;
  -webkit-line-clamp: 2 !important;
}

#similar-sponsored-seller-root .ssw-plan-desc {
  color: #475569 !important;
  font-size: .72rem !important;
  font-weight: 750 !important;
  line-height: 1.75 !important;
  -webkit-line-clamp: 3 !important;
}

#similar-sponsored-seller-root .ssw-plan-badge {
  width: fit-content;
  max-width: 100%;
  align-self: flex-start;
  white-space: normal;
  text-align: center;
  line-height: 1.55;
  color: #0f766e;
  background: rgba(240, 253, 250, .96);
  border-color: rgba(20, 184, 166, .2);
}

#similar-sponsored-seller-root .ssw-plan-card--priority .ssw-plan-badge,
#similar-sponsored-seller-root .ssw-plan-badge--recommended {
  color: #7c2d12 !important;
  border-color: rgba(245, 158, 11, .42) !important;
  background: linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%) !important;
  box-shadow:
    0 1px 0 rgba(255,255,255,.8) inset,
    0 6px 14px rgba(245, 158, 11, .14) !important;
}

#similar-sponsored-seller-root .ssw-plan-card--priority .upgrade-ad-cta.ssw-plan-cta {
  background:
    linear-gradient(135deg, rgba(255,255,255,.2), transparent 38%),
    linear-gradient(135deg, #4f46e5 0%, #312e81 100%) !important;
}

@media (max-width: 420px) {
  #similar-sponsored-seller-root .ssw-section-subtitle {
    font-size: .78rem;
  }

  #similar-sponsored-seller-root .ssw-plan-card.upgrade-ad-card {
    min-height: 196px !important;
    padding: .84rem .78rem .78rem !important;
  }

  #similar-sponsored-seller-root .ssw-plan-title {
    font-size: .9rem !important;
  }

  #similar-sponsored-seller-root .ssw-plan-desc {
    font-size: .69rem !important;
  }
}

/* Mobile carousel override: single-row snap cards with compact density */
@media (max-width: 639px) {
  #similar-sponsored-seller-root .ssw-carousel-shell {
    margin-inline: -.25rem !important;
    overflow: hidden !important;
  }

  #similar-sponsored-seller-root .ssw-carousel-shell::before,
  #similar-sponsored-seller-root .ssw-carousel-shell::after {
    display: block !important;
  }

  #similar-sponsored-seller-root .ssw-plans-grid#similar-sponsored-plans {
    display: flex !important;
    grid-template-columns: none !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    gap: .58rem !important;
    width: 100%;
    padding: .28rem .72rem .18rem !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    scroll-snap-type: x mandatory !important;
    scroll-padding-inline: .72rem;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x pan-y;
    overscroll-behavior-inline: contain;
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }

  #similar-sponsored-seller-root .ssw-plans-grid#similar-sponsored-plans::-webkit-scrollbar {
    width: 0 !important;
    height: 0 !important;
    display: none !important;
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .ssw-plan-card.upgrade-ad-card.ssw-plan-card--preview {
    grid-template-columns: 36px minmax(0, 1fr);
    column-gap: .52rem;
    row-gap: .24rem;
    flex: 0 0 min(84vw, 330px) !important;
    width: min(84vw, 330px) !important;
    max-width: min(84vw, 330px) !important;
    min-height: 142px !important;
    padding: .64rem .68rem .62rem !important;
    border-radius: 14px;
    scroll-snap-align: start;
    scroll-snap-stop: always;
    transform: none !important;
    opacity: 1 !important;
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .ssw-plan-visual {
    gap: .24rem;
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .ssw-plan-visual__icon {
    width: 34px;
    height: 34px;
    border-radius: 10px;
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .ssw-plan-visual__icon svg {
    width: 16px;
    height: 16px;
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .ssw-plan-visual__line {
    min-height: 20px;
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .ssw-plan-title {
    font-size: .76rem !important;
    line-height: 1.38;
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .ssw-plan-desc {
    font-size: .56rem !important;
    line-height: 1.42;
    -webkit-line-clamp: 1;
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .ssw-plan-badge {
    display: inline-flex !important;
    align-items: center;
    gap: .24rem;
    min-height: 18px;
    padding: .12rem .38rem;
    border-radius: 7px;
    font-size: .5rem !important;
    line-height: 1.2;
    box-shadow: none !important;
  }

  #similar-sponsored-seller-root .ssw-plan-badge-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }

  #similar-sponsored-seller-root .ssw-plan-badge-icon svg {
    width: 10px;
    height: 10px;
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .upgrade-ad-pricing.ssw-plan-pricing {
    min-height: 38px;
    padding: .34rem .48rem;
    border-radius: 10px;
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .upgrade-ad-price.ssw-plan-price {
    font-size: clamp(1.05rem, 4.7vw, 1.34rem);
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .upgrade-ad-unit.ssw-plan-unit {
    font-size: .52rem;
    line-height: 1.35;
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .ssw-plan-actions {
    margin-top: .06rem;
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .upgrade-ad-cta.ssw-plan-cta,
  #similar-sponsored-seller-root #similar-sponsored-plans .ssw-plan-card--priority .upgrade-ad-cta.ssw-plan-cta {
    width: 100%;
    min-height: 36px;
    padding: .42rem .6rem;
    border-radius: 10px;
    font-size: .68rem;
    font-weight: 900;
    background: #0f766e !important;
    color: #ffffff !important;
    box-shadow: none !important;
    filter: none !important;
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .upgrade-ad-cta.ssw-plan-cta:hover,
  #similar-sponsored-seller-root #similar-sponsored-plans .upgrade-ad-cta.ssw-plan-cta:active {
    transform: none;
    background: #115e59 !important;
    box-shadow: none !important;
  }

  #similar-sponsored-seller-root #similar-sponsored-plans .upgrade-ad-cta.ssw-plan-cta::after {
    width: 10px;
    height: 10px;
  }

  #similar-sponsored-seller-root .ssw-carousel-dots {
    display: flex !important;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: .32rem 0 0;
    margin: 0;
  }

  #similar-sponsored-seller-root .ssw-carousel-dots[hidden] {
    display: none !important;
  }

  #similar-sponsored-seller-root .ssw-carousel-dot {
    width: 6px;
    height: 6px;
    min-width: 6px;
    min-height: 6px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: rgba(100, 116, 139, .32);
    box-shadow: none;
  }

  #similar-sponsored-seller-root .ssw-carousel-dot.is-active {
    width: 22px;
    height: 6px;
    background: #0f766e;
    box-shadow: none;
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
    mapPin: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1116 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    check: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    info: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    shield: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    list: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    chevronDown: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
    arrowLeft: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
    creditCard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`,
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
            جذب بازدیدکننده جدید
          </span>
          <h3 id="ssw-title" class="ssw-section-title">نمایش در فروشگاه‌های مشابه</h3>
          <p class="ssw-section-subtitle">فروشگاه خود را در بخش فروشگاه‌های مشابه سایر فروشندگان نمایش دهید و بازدیدکنندگان جدید جذب کنید.</p>
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
        <div class="ssw-plans-grid" id="similar-sponsored-plans" role="list" tabindex="0" aria-label="گزینه‌های نمایش در فروشگاه‌های مشابه"></div>
      </div>
      <div class="ssw-carousel-dots" id="similar-sponsored-dots" aria-label="نشانگر گزینه‌های نمایش" hidden></div>

      <div class="ssw-all-plans-trigger-wrap" id="similar-sponsored-all-plans-trigger-wrap" hidden>
        <button type="button" class="ssw-all-plans-trigger" data-similar-sponsored-all-plans-open>
          <span>مشاهده همه گزینه‌ها</span>
          ${icons.arrowLeft}
        </button>
      </div>

      <!-- All Plans Modal -->
      <div class="ssw-all-plans-modal" id="similar-sponsored-all-plans-modal" hidden aria-modal="true" role="dialog" aria-labelledby="similar-sponsored-all-plans-title">
        <section class="ssw-all-plans-dialog" role="document">
          <header class="ssw-all-plans-header">
            <h3 class="ssw-all-plans-title" id="similar-sponsored-all-plans-title">گزینه‌های نمایش در فروشگاه‌های مشابه</h3>
            <button type="button" class="ssw-all-plans-close" data-similar-sponsored-all-plans-close aria-label="بستن">
              ${icons.close}
            </button>
          </header>
          <div class="ssw-all-plans-content">
            <div class="ssw-all-plans-list" id="similar-sponsored-all-plans-list" role="list" aria-label="گزینه‌های نمایش در فروشگاه‌های مشابه"></div>
          </div>
        </section>
      </div>

      <!-- Confirm/Submit Modal -->
      <div class="ssw-modal" id="similar-sponsored-modal" hidden aria-modal="true" role="dialog" aria-labelledby="ssw-modal-title">
        <form class="ssw-modal__dialog" id="similar-sponsored-form" novalidate>
          <span class="ssw-modal__handle" aria-hidden="true"></span>

          <button type="button" class="ssw-modal__close-btn" data-similar-sponsored-close aria-label="بستن">
            ${icons.close}
          </button>

          <div class="ssw-modal__scroll-area">
          <header class="ssw-modal__header">
            <h3 id="ssw-modal-title" class="ssw-modal__title">ثبت درخواست تبلیغ</h3>
            <p id="similar-sponsored-modal-plan" class="ssw-modal__plan-label"></p>
          </header>

          <!-- Price Display -->
          <div class="ssw-modal__price-card ssw-modal__confirm" aria-live="polite">
            <span class="ssw-modal__price-label">مبلغ قابل پرداخت</span>
            <div class="ssw-modal__price-row">
              <strong class="ssw-modal__price-value" id="similar-sponsored-modal-price">۰</strong>
              <span class="ssw-modal__price-currency">تومان</span>
            </div>
          </div>

          <div class="ssw-modal__validation-notice" id="similar-sponsored-validation-notice" role="alert" hidden>
            <span class="ssw-modal__validation-notice-icon" aria-hidden="true">${icons.info}</span>
            <span class="ssw-modal__validation-notice-copy">
              <strong class="ssw-modal__validation-notice-title">انتخاب کالا لازم است</strong>
              <span class="ssw-modal__validation-notice-text">برای ثبت درخواست، ابتدا کالایی را که می‌خواهید تبلیغ شود انتخاب کنید.</span>
            </span>
          </div>

          <!-- Product / Listing Picker -->
          <section class="ssw-modal__product-picker ssw-modal__confirm" aria-labelledby="similar-sponsored-product-picker-title">
            <div class="ssw-modal__product-picker-head">
              <span class="ssw-modal__product-picker-icon" aria-hidden="true">${icons.emptyBox}</span>
              <div class="ssw-modal__product-picker-copy">
                <h4 class="ssw-modal__product-picker-title" id="similar-sponsored-product-picker-title">انتخاب کالا برای تبلیغ</h4>
                <span class="ssw-modal__product-picker-hint">کالای انتخابی شما برای این درخواست</span>
              </div>
            </div>
            <div class="ssw-modal__product-summary" id="similar-sponsored-product-summary" aria-live="polite"></div>
            <p class="ssw-modal__product-error" id="similar-sponsored-product-error" role="alert" hidden>لطفاً یک کالا را برای تبلیغ انتخاب کنید.</p>
          </section>

          <!-- Payment Method -->
          <div class="ssw-modal__section ssw-modal__confirm" role="group" aria-label="ثبت درخواست">
            <span class="ssw-modal__section-title">فرایند ثبت</span>
            <div class="ssw-modal__pay-method" aria-pressed="true">
              <div class="ssw-modal__pay-icon" aria-hidden="true">${icons.creditCard}</div>
              <div class="ssw-modal__pay-text">
                <strong>ثبت امن داخل داشبورد</strong>
                <span>بدون خروج از صفحه، درخواست برای بررسی ارسال می‌شود</span>
              </div>
              <div class="ssw-modal__pay-check" aria-hidden="true">${icons.check}</div>
            </div>
          </div>

          <!-- Important Note -->
          <div class="ssw-modal__note ssw-modal__confirm" role="note">
            <span class="ssw-modal__note-icon" aria-hidden="true">${icons.shield}</span>
            <p class="ssw-modal__note-text">پس از ثبت موفق، درخواست در وضعیت در انتظار بررسی مدیر قرار می‌گیرد و زمان نمایش پس از تأیید مشخص می‌شود.</p>
          </div>

          <div id="similar-sponsored-result" class="ssw-modal__result" role="status" aria-live="polite" hidden></div>
          </div>

          <!-- CTA -->
          <div class="ssw-modal__actions">
            <button type="button" class="ssw-modal__submit" data-similar-sponsored-submit>
              <span>ثبت درخواست</span>
              ${icons.arrowLeft}
            </button>
            <button type="button" class="ssw-modal__cancel" data-similar-sponsored-close>انصراف</button>
          </div>
        </form>
      </div>

      <div class="ssw-product-sheet" id="similar-sponsored-product-sheet" hidden aria-modal="true" role="dialog" aria-labelledby="similar-sponsored-product-sheet-title">
        <section class="ssw-product-sheet__dialog" role="document">
          <span class="ssw-product-sheet__handle" aria-hidden="true"></span>
          <button type="button" class="ssw-product-sheet__close" data-similar-sponsored-product-picker-close aria-label="بستن انتخاب کالا">
            ${icons.close}
          </button>
          <header class="ssw-product-sheet__header">
            <h3 class="ssw-product-sheet__title" id="similar-sponsored-product-sheet-title">انتخاب کالا</h3>
            <p class="ssw-product-sheet__hint">کالای موردنظر را برای تبلیغ انتخاب کنید</p>
          </header>
          <label class="ssw-product-sheet__search-wrap">
            <span class="ssw-product-sheet__search-icon" aria-hidden="true">${icons.search}</span>
            <input type="search" class="ssw-product-sheet__search" id="similar-sponsored-product-search" placeholder="جستجوی کالا..." autocomplete="off">
          </label>
          <div class="ssw-modal__product-list ssw-product-sheet__list" id="similar-sponsored-product-list" role="listbox" tabindex="-1" aria-labelledby="similar-sponsored-product-sheet-title"></div>
        </section>
      </div>

      <div class="ssw-guide-modal" id="similar-sponsored-guide-modal" hidden aria-modal="true" role="dialog" aria-labelledby="similar-sponsored-guide-title">
        <section class="ssw-guide-modal__dialog" role="document">
          <span class="ssw-guide-modal__handle" aria-hidden="true"></span>
          <button type="button" class="ssw-guide-modal__close" data-similar-sponsored-guide-close aria-label="بستن راهنما">
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
            <span>هزینه این گزینه</span>
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
                <li><span>۱</span>گزینه موردنظر را انتخاب می‌کنید و پرداخت آنلاین انجام می‌شود.</li>
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
              <span>ثبت درخواست این گزینه</span>
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

  async function loadAvailableProducts(options = {}) {
    const { force = false } = options;
    if (!force && Array.isArray(window._allProducts)) {
      renderProductPicker(window._allProducts);
      return window._allProducts;
    }
    if (!force && state.productsLoadPromise) return state.productsLoadPromise;

    const sellerId = getCurrentSellerId();
    if (!sellerId) {
      renderProductPicker([]);
      return [];
    }

    state.productsLoadPromise = apiJson(`/products?sellerId=${encodeURIComponent(sellerId)}`)
      .then((products) => {
        const safeProducts = parseProducts(products);
        window._allProducts = safeProducts;
        renderProductPicker(safeProducts);
        return safeProducts;
      })
      .catch((err) => {
        console.warn('similar sponsored products unavailable:', err);
        renderProductPicker([]);
        return [];
      })
      .finally(() => {
        state.productsLoadPromise = null;
      });

    return state.productsLoadPromise;
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

    // Mark the centered card as active so we can give it premium prominence
    cards.forEach((card, index) => {
      const active = index === resolvedIndex;
      card.classList.toggle('is-active', active);
      if (active) {
        card.setAttribute('aria-current', 'true');
      } else {
        card.removeAttribute('aria-current');
      }
    });
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
  function renderPlansLegacyCarousel() {
    const container = document.getElementById('similar-sponsored-plans');
    if (!container) return;
    const plans = sortPlans(state.plans);

    if (!plans.length) {
      container.innerHTML = `
        <div class="ssw-empty">
          ${icons.emptyBox}
          <span>فعلاً گزینه فعالی برای نمایش در فروشگاه‌های مشابه تعریف نشده است.</span>
        </div>`;
      renderCarouselDots(0);
      updateCarouselHints(0);
      return;
    }

    container.innerHTML = plans.map((plan, index) => {
      const isPriority = plan.tier === 'priority';
      const planTitle = getMarketingPlanTitle(plan);
      const planDesc = tierDescriptions[plan.tier] || 'فروشگاه شما در بخش فروشگاه‌های مشابه نمایش داده می‌شود.';
      const badgeLabel = getMarketingBadgeLabel(plan);
      const unitLabel = getMarketingDurationLabel(plan);

      return `
        <article class="upgrade-ad-card upgrade-ad-card--search ssw-plan-card${isPriority ? ' ssw-plan-card--priority' : ' ssw-plan-card--standard'}" data-plan-tier="${escapeHtml(plan.tier)}" data-plan-duration="${escapeHtml(plan.durationUnit)}" role="listitem" aria-labelledby="ssw-plan-title-${index}">
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

          <div class="upgrade-ad-pricing ssw-plan-pricing" aria-label="قیمت گزینه نمایش">
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
  function getPlanCardDetails(plan) {
    const isPriority = plan.tier === 'priority';
    const unitLabel = getMarketingDurationLabel(plan);
    const planTitle = getMarketingPlanTitle(plan);
    const planDesc = tierDescriptions[plan.tier] || 'فروشگاه شما در بخش فروشگاه‌های مشابه نمایش داده می‌شود.';
    const badgeLabel = getMarketingBadgeLabel(plan);
    const features = getPlanGuideFeatures(plan);
    return { isPriority, unitLabel, planTitle, planDesc, badgeLabel, features };
  }

  function getMarketingBadgeIcon(plan = {}, badgeLabel = '') {
    const label = String(badgeLabel || '');
    if (plan.durationUnit === 'weekly' || label.includes('بازدید')) return icons.trendUp;
    if (plan.durationUnit === 'daily' || label.includes('جایگاه')) return icons.mapPin;
    if (plan.tier === 'priority' || label.includes('ویژه')) return icons.zap;
    return icons.mapPin;
  }

  function renderPlanCard(plan, index, options = {}) {
    const { mode = 'preview' } = options;
    const { isPriority, unitLabel, planTitle, planDesc, badgeLabel, features } = getPlanCardDetails(plan);
    const badgeIcon = getMarketingBadgeIcon(plan, badgeLabel);
    const titleId = `ssw-plan-title-${mode}-${index}`;
    const featureMarkup = mode === 'full'
      ? `<ul class="ssw-plan-features">
          ${features.map((feature) => `<li><span aria-hidden="true">${icons.check}</span>${escapeHtml(feature)}</li>`).join('')}
        </ul>`
      : '';

    return `
      <article class="upgrade-ad-card upgrade-ad-card--search ssw-plan-card ssw-plan-card--${mode}${isPriority ? ' ssw-plan-card--priority' : ' ssw-plan-card--standard'}" data-plan-tier="${escapeHtml(plan.tier)}" data-plan-duration="${escapeHtml(plan.durationUnit)}" role="listitem" aria-labelledby="${titleId}">
        <div class="ssw-plan-visual" aria-hidden="true">
          <div class="ssw-plan-visual__icon">${isPriority ? icons.trendUp : icons.storeSmall}</div>
          <span class="ssw-plan-visual__line"></span>
        </div>
        <div class="ssw-plan-header">
          <div class="ssw-plan-copy">
            <h4 id="${titleId}" class="ssw-plan-title">${escapeHtml(planTitle)}</h4>
            <p class="ssw-plan-desc">${escapeHtml(planDesc)}</p>
          </div>
          <div class="ssw-plan-badge${isPriority ? ' ssw-plan-badge--recommended' : ''}" aria-label="${escapeHtml(badgeLabel)}"><span class="ssw-plan-badge-icon" aria-hidden="true">${badgeIcon}</span><span>${escapeHtml(badgeLabel)}</span></div>
        </div>

        <div class="upgrade-ad-pricing ssw-plan-pricing" aria-label="قیمت گزینه نمایش">
          <span class="upgrade-ad-price ssw-plan-price">${formatMoney(plan.price)}</span>
          <span class="upgrade-ad-unit ssw-plan-unit">تومان / ${escapeHtml(unitLabel)}</span>
        </div>

        ${featureMarkup}

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
  }

  function renderAllPlans(plans) {
    const list = document.getElementById('similar-sponsored-all-plans-list');
    const triggerWrap = document.getElementById('similar-sponsored-all-plans-trigger-wrap');
    if (triggerWrap) triggerWrap.hidden = true;
    if (!list) return;
    list.innerHTML = plans.map((plan, index) => renderPlanCard(plan, index, { mode: 'full' })).join('');
  }

  function renderPlans() {
    const container = document.getElementById('similar-sponsored-plans');
    if (!container) return;
    const plans = sortPlans(state.plans);

    if (!plans.length) {
      container.innerHTML = `
        <div class="ssw-empty">
          ${icons.emptyBox}
          <span>فعلاً گزینه فعالی برای نمایش در فروشگاه‌های مشابه تعریف نشده است.</span>
        </div>`;
      renderAllPlans([]);
      renderCarouselDots(0);
      updateCarouselHints(0);
      return;
    }

    container.innerHTML = plans.map((plan, index) => renderPlanCard(plan, index, { mode: 'preview' })).join('');
    container.dir = 'rtl';
    container.setAttribute('aria-orientation', 'horizontal');
    renderAllPlans(plans);
    renderCarouselDots(plans.length);
    requestAnimationFrame(() => {
      container.scrollLeft = 0;
      updateCarouselHints(0);
    });
  }

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

      const displayPlan = { tier: item.planTier, durationUnit: item.durationUnit, durationDays: item.durationDays };
      const planTitle   = escapeHtml(getMarketingPlanTitle(displayPlan));
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
                <span class="ssw-request-meta-label">نوع نمایش</span>
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
  function setModalSubmitLabel(label) {
    const submitButton = document.querySelector('[data-similar-sponsored-submit]');
    const submitText = submitButton?.querySelector('span');
    if (submitText) submitText.textContent = label;
  }

  function setProductError(message = '') {
    const error = document.getElementById('similar-sponsored-product-error');
    const picker = document.querySelector('.ssw-modal__product-picker');
    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
    picker?.classList.toggle('has-error', Boolean(message));
  }

  function setValidationNotice(isVisible) {
    const notice = document.getElementById('similar-sponsored-validation-notice');
    if (!notice) return;
    notice.hidden = !isVisible;
    if (isVisible) {
      notice.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function updateModalSubmitAvailability() {
    const submitButton = document.querySelector('[data-similar-sponsored-submit]');
    if (!submitButton) return;
    submitButton.disabled = state.submitting;
  }

  function productMediaMarkup(product, options = {}) {
    const { featured = false } = options;
    const hasImage = product.image && product.image !== '/assets/images/placeholder-product.svg';
    return `
      <span class="ssw-modal__product-media${hasImage ? '' : ' is-placeholder'}">
        <img
          class="ssw-modal__product-thumb"
          src="${escapeHtml(product.image)}"
          alt="${escapeHtml(product.title)}"
          loading="${featured ? 'eager' : 'lazy'}"
          decoding="async"
          onerror="this.parentElement.classList.add('is-placeholder')">
        <span class="ssw-modal__product-placeholder" aria-hidden="true">${icons.emptyBox}</span>
        ${featured && hasImage ? '<span class="ssw-modal__product-image-label">تصویر کالا</span>' : ''}
      </span>
    `;
  }

  function renderProductSummary() {
    const summary = document.getElementById('similar-sponsored-product-summary');
    if (!summary) return;

    if (!state.availableProducts.length) {
      summary.innerHTML = `
        <div class="ssw-modal__product-summary-empty">
          <span class="ssw-modal__product-summary-empty-icon" aria-hidden="true">${icons.emptyBox}</span>
          <strong>کالایی برای انتخاب وجود ندارد</strong>
          <span>ابتدا یک کالای فعال در فروشگاه ثبت کنید</span>
        </div>
      `;
      return;
    }

    if (!state.selectedProduct) {
      summary.innerHTML = `
        <div class="ssw-modal__product-summary-empty">
          <span class="ssw-modal__product-summary-empty-icon" aria-hidden="true">${icons.emptyBox}</span>
          <strong>هنوز کالایی انتخاب نشده</strong>
          <button type="button" class="ssw-modal__product-summary-action" data-similar-sponsored-product-picker-open>
            انتخاب کالا
          </button>
        </div>
      `;
      return;
    }

    const product = state.selectedProduct;
    summary.innerHTML = `
      <div class="ssw-modal__product-summary-card">
        ${productMediaMarkup(product, { featured: true })}
        <span class="ssw-modal__product-copy">
          <strong class="ssw-modal__product-title">${escapeHtml(product.title)}</strong>
          <span class="ssw-modal__product-meta">
            <span class="ssw-modal__product-price">${formatMoney(product.price)} تومان</span>
            ${product.status ? `<span class="ssw-modal__product-status">${escapeHtml(product.status)}</span>` : ''}
          </span>
        </span>
        <button type="button" class="ssw-modal__product-summary-change" data-similar-sponsored-product-picker-open>
          تغییر کالا
        </button>
      </div>
    `;
  }

  function renderProductPickerList(query = '') {
    const list = document.getElementById('similar-sponsored-product-list');
    if (!list) return;
    const normalizedQuery = String(query).trim().toLocaleLowerCase('fa-IR');
    const products = normalizedQuery
      ? state.availableProducts.filter((product) => product.title.toLocaleLowerCase('fa-IR').includes(normalizedQuery))
      : state.availableProducts;

    if (!state.availableProducts.length) {
      list.innerHTML = `
        <div class="ssw-modal__product-empty" role="status">
          ${icons.emptyBox}
          <strong>برای ثبت تبلیغ ابتدا یک کالا ثبت کنید</strong>
        </div>
      `;
      return;
    }

    if (!products.length) {
      list.innerHTML = `
        <div class="ssw-modal__product-empty" role="status">
          ${icons.search}
          <strong>کالایی با این عبارت پیدا نشد</strong>
        </div>
      `;
      return;
    }

    list.innerHTML = products.map((product) => {
      const selected = state.selectedProduct?.id === product.id;
      return `
        <button
          type="button"
          class="ssw-modal__product-card${selected ? ' is-selected' : ''}"
          data-similar-sponsored-product="${escapeHtml(product.id)}"
          role="option"
          aria-selected="${selected ? 'true' : 'false'}">
          ${productMediaMarkup(product)}
          <span class="ssw-modal__product-copy">
            <strong class="ssw-modal__product-title">${escapeHtml(product.title)}</strong>
            <span class="ssw-modal__product-meta">
              <span class="ssw-modal__product-price">${formatMoney(product.price)} تومان</span>
              ${product.status ? `<span class="ssw-modal__product-status">${escapeHtml(product.status)}</span>` : ''}
            </span>
          </span>
          <span class="ssw-modal__product-check" aria-hidden="true">${icons.check}</span>
        </button>
      `;
    }).join('');
  }

  function renderProductPicker(products) {
    state.availableProducts = getAvailableProducts(products);
    if (state.selectedProduct && !state.availableProducts.some((item) => item.id === state.selectedProduct.id)) {
      state.selectedProduct = null;
    }
    const searchInput = document.getElementById('similar-sponsored-product-search');
    renderProductSummary();
    renderProductPickerList(searchInput?.value || '');
    setProductError('');
    setValidationNotice(false);
    updateModalSubmitAvailability();
  }

  function selectProduct(productId) {
    state.selectedProduct = state.availableProducts.find((item) => item.id === productId) || null;
    setProductError('');
    setValidationNotice(false);
    renderProductSummary();
    renderProductPickerList(document.getElementById('similar-sponsored-product-search')?.value || '');
    updateModalSubmitAvailability();
    closeProductPicker();
  }

  function openProductPicker() {
    if (!state.availableProducts.length) return;
    const sheet = document.getElementById('similar-sponsored-product-sheet');
    const modal = document.getElementById('similar-sponsored-modal');
    const searchInput = document.getElementById('similar-sponsored-product-search');
    if (!sheet) return;
    if (searchInput) searchInput.value = '';
    renderProductPickerList();
    sheet.hidden = false;
    modal?.setAttribute('aria-hidden', 'true');
    document.body?.classList.add('ssw-product-sheet-open');
  }

  function closeProductPicker({ restoreFocus = true } = {}) {
    const sheet = document.getElementById('similar-sponsored-product-sheet');
    const modal = document.getElementById('similar-sponsored-modal');
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    modal?.removeAttribute('aria-hidden');
    document.body?.classList.remove('ssw-product-sheet-open');
    if (restoreFocus) {
      window.setTimeout(() => document.querySelector('[data-similar-sponsored-product-picker-open]')?.focus(), 0);
    }
  }

  function resetModalState() {
    const dialog = document.getElementById('similar-sponsored-form');
    const result = document.getElementById('similar-sponsored-result');
    const title = document.getElementById('ssw-modal-title');
    const cancelButton = document.querySelector('#similar-sponsored-form .ssw-modal__cancel');

    if (dialog) dialog.classList.remove('is-result', 'is-success', 'is-error');
    if (result) {
      result.hidden = true;
      result.replaceChildren();
    }
    state.selectedProduct = null;
    setProductError('');
    setValidationNotice(false);
    renderProductPicker();
    if (title) title.textContent = 'ثبت درخواست تبلیغ';
    if (cancelButton) cancelButton.textContent = 'انصراف';
    setModalSubmitLabel('ثبت درخواست');
    updateModalSubmitAvailability();
  }

  function setModalBusy(isBusy) {
    const dialog = document.getElementById('similar-sponsored-form');
    if (isBusy) {
      setModalSubmitLabel('در حال ثبت درخواست...');
    } else if (dialog?.classList.contains('is-success')) {
      setModalSubmitLabel('متوجه شدم');
    } else if (dialog?.classList.contains('is-error')) {
      setModalSubmitLabel('تلاش دوباره');
    } else {
      setModalSubmitLabel('ثبت درخواست');
    }
    updateModalSubmitAvailability();
  }

  function getPromotionId(promotion) {
    return promotion?.id || promotion?._id || '';
  }

  function findReusablePlanRequest(plan) {
    return state.requests.find((item) => (
      item.status === 'pending'
      && item.paymentStatus !== 'rejected'
      && item.planTier === plan.tier
      && item.durationUnit === plan.durationUnit
    )) || null;
  }

  function findActivePromotion() {
    return state.requests.find((item) => item.isActive) || null;
  }

  function showExistingPromotionResult(promotion, options = {}) {
    const isActive = options.isActive || promotion?.isActive;
    showModalResult('success', {
      title: isActive ? 'تبلیغ شما در حال نمایش است' : 'درخواست تبلیغ قبلاً ثبت شده است',
      message: isActive
        ? 'فروشگاه شما در حال حاضر در بخش فروشگاه‌های مشابه نمایش داده می‌شود و نیازی به ثبت درخواست جدید نیست.'
        : 'این درخواست قبلاً ثبت و پرداخت آن تأیید شده است. اکنون درخواست شما در انتظار بررسی مدیر قرار دارد.',
      meta: isActive ? 'وضعیت: تبلیغ فعال' : 'وضعیت: در انتظار بررسی مدیر'
    });
  }

  function showModalResult(type, options = {}) {
    const dialog = document.getElementById('similar-sponsored-form');
    const result = document.getElementById('similar-sponsored-result');
    const titleEl = document.getElementById('ssw-modal-title');
    const cancelButton = document.querySelector('#similar-sponsored-form .ssw-modal__cancel');
    const isSuccess = type === 'success';

    if (dialog) {
      dialog.classList.toggle('is-result', isSuccess);
      dialog.classList.toggle('is-success', isSuccess);
      dialog.classList.toggle('is-error', !isSuccess);
    }
    if (titleEl) titleEl.textContent = isSuccess ? 'درخواست ثبت شد' : 'ثبت درخواست انجام نشد';
    if (cancelButton) cancelButton.textContent = isSuccess ? 'بستن' : 'بستن';
    setModalSubmitLabel(isSuccess ? 'متوجه شدم' : 'تلاش دوباره');

    if (!result) return;
    const resultTitle = options.title || (isSuccess ? 'درخواست تبلیغ با موفقیت ثبت شد' : 'خطا در ثبت درخواست');
    const resultText = options.message || (isSuccess
      ? 'درخواست شما ثبت شد و اکنون در انتظار بررسی مدیر است. پس از تأیید، زمان نمایش تبلیغ مشخص می‌شود.'
      : 'لطفاً چند لحظه بعد دوباره تلاش کنید.');
    const meta = options.meta || (isSuccess ? 'وضعیت: در انتظار بررسی مدیر' : 'خطا داخل همین صفحه نمایش داده شد');

    result.innerHTML = `
      <span class="ssw-modal__result-icon" aria-hidden="true">${isSuccess ? icons.check : icons.info}</span>
      <strong class="ssw-modal__result-title">${escapeHtml(resultTitle)}</strong>
      <p class="ssw-modal__result-text">${escapeHtml(resultText)}</p>
      <span class="ssw-modal__result-meta">${escapeHtml(meta)}</span>
    `;
    result.hidden = false;
  }

  function openAllPlansModal() {
    const modal = document.getElementById('similar-sponsored-all-plans-modal');
    if (!modal) return;
    modal.hidden = false;
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.add('ssw-modal-open', 'ssw-all-plans-open');
    }
    window.setTimeout(() => {
      modal.querySelector('[data-similar-sponsored-all-plans-close]')?.focus?.({ preventScroll: true });
    }, 0);
  }

  function closeAllPlansModal({ restoreFocus = true } = {}) {
    const modal = document.getElementById('similar-sponsored-all-plans-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('ssw-all-plans-open');
      const requestModal = document.getElementById('similar-sponsored-modal');
      const guideModal = document.getElementById('similar-sponsored-guide-modal');
      if ((!requestModal || requestModal.hidden) && (!guideModal || guideModal.hidden)) {
        document.body.classList.remove('ssw-modal-open');
      }
    }
    if (restoreFocus) {
      window.setTimeout(() => document.querySelector('[data-similar-sponsored-all-plans-open]')?.focus?.({ preventScroll: true }), 0);
    }
  }

  function openModal(plan) {
    state.selectedPlan = plan;
    const modal = document.getElementById('similar-sponsored-modal');
    const label = document.getElementById('similar-sponsored-modal-plan');
    const price = document.getElementById('similar-sponsored-modal-price');
    resetModalState();
    if (label) {
      label.textContent = getMarketingPlanTitle(plan);
    }
    if (price) {
      price.textContent = formatMoney(plan.price);
    }
    if (modal) modal.hidden = false;
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.add('ssw-modal-open');
    }
    loadAvailableProducts().catch(() => null);
  }

  function closeModal() {
    const modal = document.getElementById('similar-sponsored-modal');
    const form = document.getElementById('similar-sponsored-form');
    closeProductPicker({ restoreFocus: false });
    if (form) form.reset();
    if (modal) modal.hidden = true;
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('ssw-modal-open');
    }
    state.selectedPlan = null;
    resetModalState();
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

    const title = getMarketingPlanTitle(plan);
    const desc = tierDescriptions[plan.tier] || 'فروشگاه شما در بخش فروشگاه‌های مشابه نمایش داده می‌شود.';
    const periodLabel = getMarketingDurationLabel(plan);
    const durationValue = plan.durationDays ? `${escapeHtml(String(plan.durationDays))} روز` : escapeHtml(periodLabel);
    const features = getPlanGuideFeatures(plan);
    const badge = document.getElementById('similar-sponsored-guide-badge');
    const titleEl = document.getElementById('similar-sponsored-guide-title');
    const descEl = document.getElementById('similar-sponsored-guide-desc');
    const priceEl = document.getElementById('similar-sponsored-guide-price');
    const factsEl = document.getElementById('similar-sponsored-guide-facts');
    const featuresEl = document.getElementById('similar-sponsored-guide-features');

    if (badge) {
      badge.textContent = getMarketingBadgeLabel(plan);
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
          <span>محل نمایش</span>
          <strong>بخش فروشگاه‌های مشابه</strong>
        </div>
        <div class="ssw-guide-fact">
          <span>مزیت اصلی</span>
          <strong>${plan.tier === 'priority' ? 'بالاترین جایگاه تبلیغاتی' : 'نمایش قبل از فروشگاه‌های عادی'}</strong>
        </div>
        <div class="ssw-guide-fact">
          <span>مدل نمایش</span>
          <strong>${escapeHtml(periodLabel)}</strong>
        </div>
      `;
    }
    if (featuresEl) {
      featuresEl.innerHTML = features.map((feature) => `
        <li><span aria-hidden="true">${icons.check}</span>${escapeHtml(feature)}</li>
      `).join('');
    }

    modal.hidden = false;
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.add('ssw-modal-open');
    }
  }

  function closeGuideModal() {
    const modal = document.getElementById('similar-sponsored-guide-modal');
    if (modal) modal.hidden = true;
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('ssw-modal-open');
    }
    state.guidePlan = null;
  }

  async function submitRequest(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const dialog = document.getElementById('similar-sponsored-form');
    if (dialog?.classList.contains('is-success')) {
      closeModal();
      return;
    }
    if (state.submitting) return;
    const plan = state.selectedPlan;
    if (!plan) return;
    const result = document.getElementById('similar-sponsored-result');
    const title = document.getElementById('ssw-modal-title');
    dialog?.classList.remove('is-error');
    if (result) {
      result.hidden = true;
      result.replaceChildren();
    }
    if (title) title.textContent = 'ثبت درخواست تبلیغ';
    if (!state.selectedProduct) {
      setProductError('لطفاً یک کالا را برای تبلیغ انتخاب کنید.');
      setValidationNotice(true);
      const pickerButton = document.querySelector('[data-similar-sponsored-product-picker-open]');
      pickerButton?.focus?.({ preventScroll: true });
      updateModalSubmitAvailability();
      return;
    }
    setProductError('');
    setValidationNotice(false);
    const formData = new FormData();
    formData.set('planTier', plan.tier);
    formData.set('durationUnit', plan.durationUnit);
    formData.set('productId', state.selectedProduct.id);
    formData.set('productTitle', state.selectedProduct.title);
    formData.set('productPrice', String(state.selectedProduct.price));
    state.lastSubmittedProduct = { ...state.selectedProduct };
    state.lastSubmissionPayload = {
      planTier: plan.tier,
      durationUnit: plan.durationUnit,
      selectedProduct: { ...state.selectedProduct }
    };
    state.submitting = true;
    setModalBusy(true);
    setMessage('');
    try {
      const token = await csrfToken();
      const activePromotion = findActivePromotion();
      if (activePromotion) {
        await refreshSellerAdvertisingPlans(activePromotion);
        showExistingPromotionResult(activePromotion, { isActive: true });
        return;
      }

      let promotion = findReusablePlanRequest(plan);
      if (!promotion) {
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
        if (!res.ok || data.success === false) {
          const requestError = new Error(data.message || 'خطا در ثبت درخواست');
          requestError.status = res.status;
          throw requestError;
        }
        promotion = data.promotion;
        if (data.alreadyActive) {
          await refreshSellerAdvertisingPlans(promotion);
          await loadData({ force: true, silent: true });
          showExistingPromotionResult(promotion, { isActive: true });
          return;
        }
      }

      await refreshSellerAdvertisingPlans(promotion);
      const promotionId = getPromotionId(promotion);
      if (!promotionId) throw new Error('شناسه درخواست تبلیغ دریافت نشد.');
      if (['verified', 'waived'].includes(promotion.paymentStatus)) {
        await loadData({ force: true, silent: true });
        showExistingPromotionResult(promotion);
        return;
      }

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

      if (paymentData.url) {
        const paymentCallbackUrl = new URL(paymentData.url, API_BASE.replace(/\/api$/, '') + '/');
        const callbackRes = await fetch(paymentCallbackUrl.toString(), {
          method: 'GET',
          credentials: 'include',
          cache: 'no-cache',
          headers: authHeaders({
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
            ...(token ? { 'X-CSRF-Token': token } : {})
          })
        });
        const callbackData = await callbackRes.json().catch(() => ({}));
        if (!callbackRes.ok || callbackData.success === false) {
          throw new Error(callbackData.message || 'پرداخت تستی یا ثبت نهایی درخواست کامل نشد.');
        }
      }

      await loadData({ force: true, silent: true });
      showModalResult('success', {
        title: 'درخواست تبلیغ با موفقیت ثبت شد',
        message: 'درخواست شما داخل داشبورد ثبت شد و اکنون در انتظار بررسی مدیر است. پس از تأیید، زمان شروع و پایان نمایش مشخص می‌شود.',
        meta: 'وضعیت: در انتظار بررسی مدیر'
      });
    } catch (err) {
      const expectedConflict = err.status === 409;
      if (expectedConflict) {
        console.warn('similar sponsored request already exists:', err.message);
      } else {
        console.error('similar sponsored submitRequest failed:', err);
      }
      showModalResult('error', {
        title: expectedConflict ? 'درخواست تکراری است' : 'ثبت درخواست ناموفق بود',
        message: err.message || 'خطا در ثبت درخواست یا اتصال به سرور. لطفاً دوباره تلاش کنید.',
        meta: expectedConflict ? 'وضعیت درخواست‌های قبلی خود را بررسی کنید' : 'در همین صفحه بمانید و دوباره تلاش کنید'
      });
    } finally {
      state.submitting = false;
      setModalBusy(false);
    }
  }

  function handleSubmitAction(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const dialog = document.getElementById('similar-sponsored-form');
    if (dialog?.classList.contains('is-success')) {
      closeModal();
      return;
    }
    submitRequest(event);
  }

  /* ─────────────────────────────────────────────────────
     EVENT BINDING
     ───────────────────────────────────────────────────── */
  function bindEvents() {
    const plansRail = document.getElementById('similar-sponsored-plans');
    const dots = document.getElementById('similar-sponsored-dots');
    const allPlansList = document.getElementById('similar-sponsored-all-plans-list');
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
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      updateCarouselHints(index);
    });

    const selectPlanFromButton = (button, options = {}) => {
      if (!button) return false;
      const plan = state.plans.find(
        (item) => item.tier === button.dataset.planTier && item.durationUnit === button.dataset.planDuration
      );
      if (!plan) return false;
      if (options.closeAllPlans) closeAllPlansModal({ restoreFocus: false });
      openModal(plan);
      return true;
    };

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
      event.preventDefault();
      event.stopPropagation();
      selectPlanFromButton(button);
    });

    document.querySelector('[data-similar-sponsored-all-plans-open]')?.addEventListener('click', openAllPlansModal);
    document.querySelectorAll('[data-similar-sponsored-all-plans-close]').forEach((button) => {
      button.addEventListener('click', () => closeAllPlansModal());
    });

    allPlansList?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-plan-tier]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      selectPlanFromButton(button, { closeAllPlans: true });
    });

    document.querySelectorAll('[data-similar-sponsored-close]').forEach((button) => {
      button.addEventListener('click', closeModal);
    });
    document.querySelectorAll('[data-similar-sponsored-guide-close]').forEach((button) => {
      button.addEventListener('click', closeGuideModal);
    });

    document.getElementById('similar-sponsored-form')?.addEventListener('submit', submitRequest);
    document.querySelector('[data-similar-sponsored-submit]')?.addEventListener('click', handleSubmitAction);
    document.getElementById('similar-sponsored-product-list')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-similar-sponsored-product]');
      if (!button) return;
      selectProduct(button.dataset.similarSponsoredProduct);
    });
    document.getElementById('similar-sponsored-product-summary')?.addEventListener('click', (event) => {
      if (event.target.closest('[data-similar-sponsored-product-picker-open]')) openProductPicker();
    });
    document.getElementById('similar-sponsored-product-search')?.addEventListener('input', (event) => {
      renderProductPickerList(event.target.value);
    });
    document.querySelectorAll('[data-similar-sponsored-product-picker-close]').forEach((button) => {
      button.addEventListener('click', () => closeProductPicker());
    });
    document.addEventListener('products:updated', (event) => {
      renderProductPicker(event.detail?.products);
    });
    document.addEventListener('seller:ready', () => {
      loadAvailableProducts().catch(() => null);
    });
    document.querySelector('[data-similar-sponsored-guide-select]')?.addEventListener('click', () => {
      const plan = state.guidePlan;
      closeGuideModal();
      if (plan) openModal(plan);
    });

    document.getElementById('similar-sponsored-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'similar-sponsored-modal') closeModal();
    });
    document.getElementById('similar-sponsored-product-sheet')?.addEventListener('click', (event) => {
      if (event.target.id === 'similar-sponsored-product-sheet') closeProductPicker();
    });
    document.getElementById('similar-sponsored-guide-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'similar-sponsored-guide-modal') closeGuideModal();
    });
    document.getElementById('similar-sponsored-all-plans-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'similar-sponsored-all-plans-modal') closeAllPlansModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const modal = document.getElementById('similar-sponsored-modal');
        const productSheet = document.getElementById('similar-sponsored-product-sheet');
        const guideModal = document.getElementById('similar-sponsored-guide-modal');
        const allPlansModal = document.getElementById('similar-sponsored-all-plans-modal');
        if (productSheet && !productSheet.hidden) {
          closeProductPicker();
          return;
        }
        if (allPlansModal && !allPlansModal.hidden) {
          closeAllPlansModal();
          return;
        }
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
  async function focusRequest(options = {}) {
    await loadData({ force: true, silent: true }).catch(() => null);

    const promotionId = String(options.promotionId || '');
    const request = state.requests.find((item) => String(item._id || item.id || '') === promotionId);
    const planTier = request?.planTier || options.planTier || '';
    const durationUnit = request?.durationUnit || options.durationUnit || '';
    let cards = [...document.querySelectorAll('#similar-sponsored-plans .ssw-plan-card')];
    let card = cards.find((item) => (
      item.dataset.planTier === planTier
      && item.dataset.planDuration === durationUnit
    ));
    if (!card && planTier && durationUnit) {
      openAllPlansModal();
      cards = [...document.querySelectorAll('#similar-sponsored-all-plans-list .ssw-plan-card')];
      card = cards.find((item) => (
        item.dataset.planTier === planTier
        && item.dataset.planDuration === durationUnit
      ));
    }
    const target = card || document.getElementById('similar-sponsored-seller-root');

    target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    if (!card) return false;

    card.classList.add('is-active');
    card.style.setProperty('outline', '3px solid rgba(14, 165, 233, .65)');
    card.style.setProperty('outline-offset', '4px');
    card.querySelector('[data-plan-tier]')?.focus({ preventScroll: true });
    window.setTimeout(() => {
      card.style.removeProperty('outline');
      card.style.removeProperty('outline-offset');
    }, 3500);
    return true;
  }

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
      focusRequest,
      getState: () => ({
        plans: [...state.plans],
        requests: [...state.requests],
        availableProducts: [...state.availableProducts],
        selectedProduct: state.selectedProduct ? { ...state.selectedProduct } : null,
        lastSubmittedProduct: state.lastSubmittedProduct ? { ...state.lastSubmittedProduct } : null,
        lastSubmissionPayload: state.lastSubmissionPayload
          ? { ...state.lastSubmissionPayload, selectedProduct: { ...state.lastSubmissionPayload.selectedProduct } }
          : null,
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
  loadAvailableProducts().catch(() => null);
})();
