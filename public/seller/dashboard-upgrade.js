/*  ────────────────────────────────────────────────
    dashboard-upgrade.js  –  vitrinNet seller panel
    ──────────────────────────────────────────────── */
console.log('dashboard-upgrade.js loaded ✅');

const API_CFG = window.VITRINET_API || null;
const API_BASE = `${API_CFG ? API_CFG.backendOrigin : 'http://localhost:5000'}/api`;
const withCreds = (init = {}) => {
  if (API_CFG) return API_CFG.ensureCredentials(init);
  if (init.credentials === undefined) {
    return { ...init, credentials: 'include' };
  }
  return init;
};

/* span های قیمت تبلیغ در صفحه */
const adPriceElems = {
  search   : document.getElementById("price-ad_search"),
  home     : document.getElementById("price-ad_home"),
  products : document.getElementById("price-ad_products"),
};

let adPlanPriceCache = null;
let adPlanPricePromise = null;

const AD_PLAN_TITLES = {
  ad_search: 'تبلیغ ویژه در جستجو',
  ad_home: 'تبلیغ ویژه صفحه اول',
  ad_products: 'تبلیغ لیست محصولات'
};

const AD_PLAN_BENEFITS = {
  ad_search: [
    "نمایش تبلیغ شما در نتایج جستجوی محصولات",
    "افزایش شانس دیده‌شدن توسط مشتریان واقعی",
    "بازگشت سرمایه سریع"
  ],
  ad_home: [
    "نمایش بنر شما در صفحه اول سایت",
    "بالاترین نرخ بازدید از کل کاربران سایت",
    "برندسازی سریع و هدفمند"
  ],
  ad_products: [
    "نمایش تبلیغ در لیست محصولات منتخب",
    "جذب خریدار با کمترین هزینه",
    "افزایش فروش فوری"
  ]
};

const AD_PLAN_LOCATIONS = {
  ad_search: 'نتایج جستجوی محصولات',
  ad_home: 'صفحه اصلی ویترینت',
  ad_products: 'لیست محصولات پیشنهادی'
};

const AD_APPROVAL_SUCCESS_STATUSES = new Set(['approved', 'paid']);

let sellerProfileCache = null;
let sellerProfilePromise = null;

async function fetchSellerProfile(forceRefresh = false) {
  if (!forceRefresh && sellerProfileCache) return sellerProfileCache;
  if (!forceRefresh && sellerProfilePromise) return sellerProfilePromise;

  sellerProfilePromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, withCreds());
      if (!res.ok) {
        sellerProfileCache = null;
        return null;
      }
      const data = await res.json();
      sellerProfileCache = data;
      return data;
    } catch (err) {
      console.error('fetchSellerProfile error', err);
      sellerProfileCache = null;
      return null;
    } finally {
      sellerProfilePromise = null;
    }
  })();

  return sellerProfilePromise;
}

async function getSellerPhone() {
  const profile = await fetchSellerProfile();
  return profile?.seller?.phone || null;
}

async function getSellerId() {
  const profile = await fetchSellerProfile();
  return profile?.seller?.id || profile?.seller?._id || null;
}

let adApprovalStatusCache = new Map();
let adApprovalWatcherTimer = null;

// نمایش پیغام به‌صورت توست
function getAdStatusLabel(status) {
  switch (status) {
    case 'approved': return 'تایید شده';
    case 'paid': return 'پرداخت شده';
    case 'pending': return 'در انتظار';
    case 'expired': return 'منقضی';
    case 'rejected': return 'رد شده';
    default: return status || '-';
  }
}

function showToast(message, isError = false) {
  let toast = document.getElementById('toast') || document.getElementById('planSuccessMsg');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'upgrade-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('is-visible');
  toast.classList.toggle('upgrade-toast--error', isError);
  toast.classList.toggle('text-red-600', isError);
  toast.classList.toggle('text-green-600', !isError);
  setTimeout(() => {
    toast.classList.add('hidden');
    toast.classList.remove('is-visible');
  }, 3000);
}

function showSuccessPopup(options = {}) {
  const {
    title = 'عملیات موفق',
    message = '',
    details = [],
    autoCloseMs = 0,
    highlight = ''
  } = options;

  const detailItems = Array.isArray(details)
    ? details.filter(Boolean)
    : (typeof details === 'string' && details.length ? [details] : []);

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[120] flex items-center justify-center px-4 py-6 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200';

  const card = document.createElement('div');
  card.className = 'success-popup-card relative w-full max-w-md rounded-3xl bg-white px-6 py-8 text-center shadow-2xl';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'absolute left-4 top-4 text-slate-300 hover:text-rose-400 transition-colors';
  closeBtn.innerHTML = '<span class="sr-only">بستن</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-6 h-6"><path fill="currentColor" d="M6.4 5.1 5 6.5 10.5 12 5 17.5l1.4 1.4L12 13.4l5.6 5.5 1.4-1.4L13.4 12 19 6.5 17.6 5.1 12 10.6z"/></svg>';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'success-popup-icon mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 shadow-[0_12px_40px_-20px_rgba(16,185,129,0.8)]';
  iconWrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-10 w-10"><path fill="currentColor" d="M9.55 16.7 5.3 12.45l1.4-1.4 2.85 2.85 7.8-7.8 1.4 1.4z"/></svg>';

  if (highlight) {
    const badge = document.createElement('span');
    badge.className = 'mb-3 inline-flex items-center justify-center rounded-full bg-emerald-100 px-4 py-1 text-xs font-extrabold text-emerald-600';
    badge.textContent = highlight;
    card.appendChild(badge);
  }

  const titleEl = document.createElement('h3');
  titleEl.className = 'text-xl font-extrabold text-emerald-600';
  titleEl.textContent = title;

  const messageEl = document.createElement('p');
  messageEl.className = 'mt-2 text-sm leading-7 text-slate-600';
  messageEl.textContent = message;

  card.appendChild(closeBtn);
  card.appendChild(iconWrap);
  card.appendChild(titleEl);
  card.appendChild(messageEl);

  if (detailItems.length) {
    const list = document.createElement('ul');
    list.className = 'mt-4 space-y-2 text-right text-sm leading-7 text-slate-600';
    detailItems.forEach(item => {
      const li = document.createElement('li');
      li.className = 'flex items-start gap-2';
      li.innerHTML = `<span class="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-emerald-400"></span><span>${item}</span>`;
      list.appendChild(li);
    });
    card.appendChild(list);
  }

  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.className = 'btn-grad mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-black text-white shadow-lg hover:shadow-xl transition';
  actionBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-5 w-5"><path fill="currentColor" d="m12 17 5-5-1.4-1.4-2.6 2.6V6h-2v7.2L8.4 10.6 7 12z"/></svg><span>باشه، متوجه شدم</span>';

  card.appendChild(actionBtn);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  document.body.classList.add('overflow-hidden');

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    overlay.classList.add('opacity-0');
    card.classList.add('scale-95');
    setTimeout(() => {
      overlay.remove();
    }, 220);
    document.body.classList.remove('overflow-hidden');
    document.removeEventListener('keydown', onKeydown);
  };

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      cleanup();
    }
  };

  closeBtn.addEventListener('click', cleanup);
  actionBtn.addEventListener('click', cleanup);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) cleanup();
  });
  document.addEventListener('keydown', onKeydown);

  if (autoCloseMs && Number.isFinite(autoCloseMs) && autoCloseMs > 0) {
    setTimeout(() => cleanup(), autoCloseMs);
  }

  return cleanup;
}

async function pollSellerAdApprovals(isInitial = false) {
  try {
    const sellerId = await getSellerId();
    if (!sellerId) return;

    const res = await fetch(`${API_BASE}/adOrder/seller?sellerId=${encodeURIComponent(sellerId)}`, withCreds());

    if (res.status === 401 || res.status === 403) {
      if (adApprovalWatcherTimer) {
        clearInterval(adApprovalWatcherTimer);
        adApprovalWatcherTimer = null;
      }
      return;
    }

    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const data = await res.json();
    const orders = Array.isArray(data.adOrders) ? data.adOrders : [];
    const nextCache = new Map();

    orders.forEach(order => {
      const orderId = order?._id || order?.id;
      if (!orderId) return;

      const status = order.status || 'pending';
      const prevStatus = adApprovalStatusCache.get(orderId);
      nextCache.set(orderId, status);

      if (!isInitial && AD_APPROVAL_SUCCESS_STATUSES.has(status) && prevStatus && prevStatus !== status) {
        const planSlug = order.planSlug || '';
        const planTitle = order.planTitle || AD_PLAN_TITLES[planSlug] || 'تبلیغ ویژه';
        const location = AD_PLAN_LOCATIONS[planSlug] || '';
        const approvedTitle = order.adTitle || planTitle;
        const detailList = [
          `پلن: ${planTitle}`,
          location ? `محل نمایش: ${location}` : '',
          order.displayedAt ? `زمان نمایش: ${toJalaliDate(order.displayedAt)}` : '',
          `وضعیت جدید: ${getAdStatusLabel(status)}`
        ].filter(Boolean);

        showSuccessPopup({
          title: 'تبلیغ شما تایید شد! ✨',
          message: `تبلیغ «${approvedTitle}» توسط تیم ویترینت تایید و فعال شد.`,
          details: detailList,
          highlight: 'اعلان تایید تبلیغ',
          autoCloseMs: 9000
        });
      }
    });

    adApprovalStatusCache = nextCache;
  } catch (err) {
    if (!isInitial) {
      console.error('pollSellerAdApprovals error', err);
    }
  }
}

function startAdApprovalWatcher() {
  if (adApprovalWatcherTimer) return;
  pollSellerAdApprovals(true);
  adApprovalWatcherTimer = setInterval(() => pollSellerAdApprovals(false), 20000);
}

// به‌روزرسانی نشان پرمیوم در رابط کاربری
function updatePremiumBadge(isPremium) {
  const badge = document.getElementById('premiumBadge');
  if (!badge) return;
  if (isPremium) {
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}


const SUBSCRIPTION_PLAN_SLUGS = ['1month', '3month', '12month'];
const PLAN_DEFAULTS = {
  '1month': {
    title: 'اشتراک ۱ ماهه',
    durationDays: 30,
    description: 'شروع سریع فروشگاه در ویترینت طی یک ماه کامل حضور.',
    features: [
      'نمایش فروشگاه در نتایج جستجو و دسته‌بندی‌ها',
      'پشتیبانی استاندارد تیم ویترینت',
      'امکان فعالسازی سرویس‌های پرمیوم (VitriPlus)'
    ],
    badge: {
      label: 'پیشنهاد اقتصادی',
      variant: 'emerald',
      visible: true
    }
  },
  '3month': {
    title: 'اشتراک ۳ ماهه',
    durationDays: 90,
    description: 'پوشش یک فصل کامل با تمرکز بر جذب مشتریان وفادار.',
    features: [
      'همه امکانات پلن یک‌ماهه',
      'اولویت نمایش در لیست فروشگاه‌ها',
      'دسترسی سریع‌تر به تیم پشتیبانی'
    ],
    badge: {
      label: 'پیشنهاد محبوب',
      variant: 'amber',
      visible: true
    }
  },
  '12month': {
    title: 'اشتراک ۱ ساله',
    durationDays: 365,
    description: 'راهکاری پایدار برای یک سال حضور مستمر و رشد پیوسته.',
    features: [
      'همه امکانات پلن‌های قبلی',
      'برندسازی و نمایش ویژه در کمپین‌های ویترینت',
      'پشتیبانی اختصاصی و گزارش‌های تحلیلی دوره‌ای'
    ],
    badge: {
      label: 'بیشترین صرفه‌جویی',
      variant: 'sky',
      visible: true
    }
  }
};

const BADGE_VARIANTS = ['emerald', 'amber', 'sky', 'violet', 'rose', 'slate'];
const PLAN_BADGE_STYLE_MAP = {
  emerald: { background: 'linear-gradient(90deg,#10b981 10%,#0ea5e9 100%)', color: '#ffffff' },
  amber:   { background: 'linear-gradient(90deg,#f59e0b 10%,#f97316 100%)', color: '#ffffff' },
  sky:     { background: 'linear-gradient(90deg,#0ea5e9 10%,#38bdf8 100%)', color: '#ffffff' },
  violet:  { background: 'linear-gradient(90deg,#6366f1 10%,#8b5cf6 100%)', color: '#ffffff' },
  rose:    { background: 'linear-gradient(90deg,#f43f5e 10%,#ec4899 100%)', color: '#ffffff' },
  slate:   { background: 'linear-gradient(90deg,#1e293b 0%,#0f172a 100%)', color: '#e2e8f0' }
};

const normalizeBadgeVariant = (value) => {
  const variant = (value || '').toString().trim();
  return BADGE_VARIANTS.includes(variant) ? variant : BADGE_VARIANTS[0];
};

const applyBadgeStyle = (el, variant) => {
  if (!el) return;
  const style = PLAN_BADGE_STYLE_MAP[variant] || PLAN_BADGE_STYLE_MAP[BADGE_VARIANTS[0]];
  el.style.background = style.background;
  el.style.color = style.color;
};

let planCardRegistry = {};
let subscriptionPlanStore = {};
let planPricePromise = null;
let lastPlanFetchTimestamp = 0;
const PLAN_FETCH_TTL = 60 * 1000; // هر ۶۰ ثانیه حداقل یکبار از سرور بخوان

window.addEventListener('storage', (event) => {
  if (event.key !== 'admin-plans-updated') return;
  lastPlanFetchTimestamp = 0;
  fetchPlanPrices(true);
  fetchAdPrices(true);
});

function refreshPlanCardRegistry() {
  planCardRegistry = {};
  SUBSCRIPTION_PLAN_SLUGS.forEach(slug => {
    const root = document.querySelector(`[data-plan-card="${slug}"]`);
    if (!root) return;
    planCardRegistry[slug] = {
      root,
      title: root.querySelector(`[data-plan-title="${slug}"]`) || root.querySelector('.upgrade-plan-title, .plan-card__title'),
      price: document.getElementById(`price-${slug}`) || root.querySelector(`[data-plan-price="${slug}"]`) || root.querySelector('.upgrade-plan-price__amount'),
      duration: root.querySelector(`[data-plan-duration="${slug}"]`) || root.querySelector('.upgrade-plan-duration'),
      description: root.querySelector(`[data-plan-description="${slug}"]`) || root.querySelector('.upgrade-plan-desc'),
      features: root.querySelector(`[data-plan-features="${slug}"]`) || root.querySelector('.upgrade-plan-features'),
      badge: root.querySelector(`[data-plan-badge="${slug}"]`) || root.querySelector('.upgrade-plan-badge'),
      cta: root.querySelector(`[data-plan-select="${slug}"]`) || root.querySelector('.upgrade-plan-cta')
    };
  });
}

function applyPlanCardDescriptor(plan) {
  const refs = planCardRegistry[plan.slug];
  if (!refs) return;
  const defaults = PLAN_DEFAULTS[plan.slug] || {};
  const fallbackBadge = defaults.badge || {};
  const badge = plan.badge || fallbackBadge;

  if (refs.title) refs.title.textContent = plan.title ?? defaults.title ?? plan.slug;

  if (refs.price) {
    if (plan.price != null) {
      refs.price.textContent = toFaPrice(plan.price);
    } else if (!refs.price.textContent) {
      refs.price.textContent = '—';
    }
  }

  if (refs.duration) {
    const duration = plan.durationDays ?? defaults.durationDays;
    const durationText = duration ? `اعتبار: ${toFaDigits(duration)} روز` : 'اعتبار: —';
    // پشتیبانی از نسخه جدید با span داخلی
    const spanEl = refs.duration.querySelector('span');
    if (spanEl) {
      spanEl.textContent = durationText;
    } else if (refs.duration.querySelector('svg')) {
      // نسخه قدیم با آیکون SVG
      const textNode = refs.duration.childNodes[refs.duration.childNodes.length - 1];
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        textNode.textContent = durationText;
      } else {
        // اگر text node نبود، یک span اضافه کن
        const newSpan = document.createElement('span');
        newSpan.textContent = durationText;
        refs.duration.appendChild(newSpan);
      }
    } else {
      refs.duration.textContent = durationText;
    }
  }

  if (refs.description) {
    const description = plan.description !== undefined
      ? plan.description
      : (defaults.description || '');
    refs.description.textContent = description || '';
    // اطمینان از نمایش توضیحات
    refs.description.style.display = '';
    refs.description.classList.remove('hidden');
  }

  if (refs.features) {
    refs.features.innerHTML = '';
    const list = (Array.isArray(plan.features) && plan.features.length > 0)
      ? plan.features
      : (Array.isArray(defaults.features) ? defaults.features : []);
    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'upgrade-plan-feature';
      li.textContent = 'جزئیاتی برای این پلن ثبت نشده است.';
      refs.features.appendChild(li);
    } else {
      list.forEach(item => {
        const li = document.createElement('li');
        li.className = 'upgrade-plan-feature';
        const icon = document.createElement('span');
        icon.className = 'upgrade-plan-feature__icon';
        // استفاده از آیکون SVG حرفه‌ای
        icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
        const span = document.createElement('span');
        span.textContent = item;
        li.appendChild(icon);
        li.appendChild(span);
        refs.features.appendChild(li);
      });
    }
    // اطمینان از نمایش لیست ویژگی‌ها
    refs.features.style.display = '';
    refs.features.classList.remove('hidden');
  }

  if (refs.badge) {
    const label = badge.label || fallbackBadge.label || '';
    const variant = normalizeBadgeVariant(badge.variant || fallbackBadge.variant);
    const visible = badge.visible !== false && !!label;
    if (visible) {
      refs.badge.textContent = label;
      applyBadgeStyle(refs.badge, variant);
      refs.badge.classList.remove('hidden');
      refs.badge.style.display = '';
    } else {
      refs.badge.classList.add('hidden');
    }
  }
}

/*──────────────── Hero Content Data for Dynamic Switching ────────────────*/
const HERO_CONTENT = {
  sub: {
    title: 'اشتراک فروشگاه',
    desc: 'فروشگاهت رو فعال کن و به هزاران مشتری معرفی شو',
    stats: [
      { value: '+۳۰۰٪', label: 'بازدید' },
      { value: '+۱۵۰٪', label: 'فروش' },
      { value: '۲۴/۷', label: 'نمایش' }
    ],
    icon: `<svg viewBox="0 0 24 24" fill="none" class="upgrade-hero__icon-svg">
      <defs>
        <linearGradient id="heroGrad" x1="6" y1="20" x2="18" y2="4">
          <stop offset="0%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#0ea5e9"/>
        </linearGradient>
        <linearGradient id="heroGradBg" x1="2" y1="22" x2="22" y2="2">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.08"/>
        </linearGradient>
      </defs>
      <path d="M4 7l2-4h12l2 4" stroke="url(#heroGrad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M4 7v13a1 1 0 001 1h14a1 1 0 001-1V7" stroke="url(#heroGrad)" stroke-width="1.8" fill="none"/>
      <path d="M4 7c0 1.5 1.5 3 3 3s3-1.5 3-3c0 1.5 1.5 3 3 3s3-1.5 3-3c0 1.5 1.5 3 3 3" stroke="url(#heroGrad)" stroke-width="1.6" fill="none"/>
      <rect x="9" y="14" width="6" height="7" rx="0.5" stroke="url(#heroGrad)" stroke-width="1.4" fill="url(#heroGradBg)"/>
      <circle cx="17" cy="12" r="1.5" stroke="url(#heroGrad)" stroke-width="1.4" fill="none"/>
      <path d="M17 13.5v2.5M16.5 15h1" stroke="url(#heroGrad)" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  },
  ads: {
    title: 'تبلیغات ویژه',
    desc: 'محصولاتت رو در صدر نتایج نمایش بده و فروش رو چند برابر کن',
    stats: [
      { value: '+۵۰۰٪', label: 'نمایش' },
      { value: '+۲۵۰٪', label: 'کلیک' },
      { value: 'فوری', label: 'فعال‌سازی' }
    ],
    icon: `<svg viewBox="0 0 24 24" fill="none" class="upgrade-hero__icon-svg">
      <defs>
        <linearGradient id="heroGrad" x1="6" y1="20" x2="18" y2="4">
          <stop offset="0%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#ef4444"/>
        </linearGradient>
        <linearGradient id="beamGrad" x1="12" y1="6" x2="12" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.05"/>
        </linearGradient>
      </defs>
      <path d="M9 8L6 20h12l-3-12H9z" fill="url(#beamGrad)"/>
      <rect x="8" y="3" width="8" height="4" rx="1" stroke="url(#heroGrad)" stroke-width="1.8" fill="none"/>
      <circle cx="12" cy="5" r="1.2" fill="url(#heroGrad)"/>
      <path d="M12 1v2" stroke="url(#heroGrad)" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M8 20v1.5a.5.5 0 00.5.5h7a.5.5 0 00.5-.5V20" stroke="url(#heroGrad)" stroke-width="1.4" fill="none"/>
      <path d="M10 16h4M11 18h2" stroke="url(#heroGrad)" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
    </svg>`
  },
  myplans: {
    title: 'پلن‌های من',
    desc: 'وضعیت اشتراک و تبلیغات فعال خودت رو مدیریت کن',
    stats: [
      { value: '—', label: 'اشتراک فعال' },
      { value: '—', label: 'تبلیغ فعال' },
      { value: '—', label: 'روز باقیمانده' }
    ],
    icon: `<svg viewBox="0 0 24 24" fill="none" class="upgrade-hero__icon-svg">
      <defs>
        <linearGradient id="heroGrad" x1="6" y1="20" x2="18" y2="4">
          <stop offset="0%" stop-color="#8b5cf6"/>
          <stop offset="100%" stop-color="#6366f1"/>
        </linearGradient>
        <linearGradient id="heroGradBg" x1="4" y1="22" x2="20" y2="2">
          <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="#6366f1" stop-opacity="0.06"/>
        </linearGradient>
      </defs>
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="url(#heroGrad)" stroke-width="1.8" fill="url(#heroGradBg)"/>
      <path d="M4 9h16" stroke="url(#heroGrad)" stroke-width="1.4"/>
      <path d="M8 6h2M14 6h2" stroke="url(#heroGrad)" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M8 13h8M8 16h5" stroke="url(#heroGrad)" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="16" cy="16" r="3" stroke="url(#heroGrad)" stroke-width="1.4" fill="none"/>
      <path d="M15 16l1 1 2-2" stroke="url(#heroGrad)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  }
};

function updateHeroContent(tab) {
  const content = HERO_CONTENT[tab];
  if (!content) return;

  const heroIcon = document.getElementById('heroIconContainer');
  const heroTitle = document.getElementById('heroTitle');
  const heroDesc = document.getElementById('heroDesc');
  const heroStat1Value = document.getElementById('heroStat1Value');
  const heroStat1Label = document.getElementById('heroStat1Label');
  const heroStat2Value = document.getElementById('heroStat2Value');
  const heroStat2Label = document.getElementById('heroStat2Label');
  const heroStat3Value = document.getElementById('heroStat3Value');
  const heroStat3Label = document.getElementById('heroStat3Label');
  const heroGlow = document.getElementById('heroGlow');

  // Add transition class for smooth animation
  const hero = document.getElementById('upgradeHero');
  if (hero) {
    hero.classList.add('hero-transitioning');
    setTimeout(() => hero.classList.remove('hero-transitioning'), 350);
  }

  // Update icon with fade effect
  if (heroIcon) {
    heroIcon.style.opacity = '0';
    heroIcon.style.transform = 'scale(0.9)';
    setTimeout(() => {
      heroIcon.innerHTML = content.icon;
      heroIcon.style.opacity = '1';
      heroIcon.style.transform = 'scale(1)';
    }, 150);
  }

  // Update text content
  if (heroTitle) heroTitle.textContent = content.title;
  if (heroDesc) heroDesc.textContent = content.desc;

  // Update stats
  if (content.stats && content.stats.length >= 3) {
    if (heroStat1Value) heroStat1Value.textContent = content.stats[0].value;
    if (heroStat1Label) heroStat1Label.textContent = content.stats[0].label;
    if (heroStat2Value) heroStat2Value.textContent = content.stats[1].value;
    if (heroStat2Label) heroStat2Label.textContent = content.stats[1].label;
    if (heroStat3Value) heroStat3Value.textContent = content.stats[2].value;
    if (heroStat3Label) heroStat3Label.textContent = content.stats[2].label;
  }

  // Update glow color based on tab
  if (heroGlow) {
    const glowColors = {
      sub: 'rgba(16, 185, 129, 0.2)',
      ads: 'rgba(245, 158, 11, 0.2)',
      myplans: 'rgba(139, 92, 246, 0.2)'
    };
    heroGlow.style.background = `radial-gradient(ellipse, ${glowColors[tab] || glowColors.sub} 0%, transparent 70%)`;
  }
}

/*──────────────── ۱) تب‌بندی و مقداردهی اولیه ────────────────*/
function initUpgradeDashboard () {
  // پشتیبانی از هر دو نسخه قدیم و جدید
  const tabButtons = document.querySelectorAll('.upgrade-tab, #tab-sub, #tab-ads, #tab-myplans');
  const contentSub = document.getElementById('content-sub');
  const contentAds = document.getElementById('content-ads');
  const contentMy  = document.getElementById('content-myplans');

  if (!contentSub || !contentAds || !contentMy) return;

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab || btn.id?.replace('tab-', '');
      if (tab) toggleTabs(tab);
    });
  });

  // پیش‌فرض نمایش اشتراک فروشگاه
  refreshPlanCardRegistry();
  toggleTabs('sub');

  fetchPlanPrices(true);
  fetchAdPrices();
}

function toggleTabs(tab) {
  // پشتیبانی از هر دو نسخه قدیم و جدید
  const tabButtons = document.querySelectorAll('.upgrade-tab, .tab-btn');
  const tabContents = document.querySelectorAll('.upgrade-content, #content-sub, #content-ads, #content-myplans');
  
  tabButtons.forEach(btn => {
    btn.classList.remove('tab-active', 'is-active');
    btn.setAttribute('aria-selected', 'false');
  });
  
  tabContents.forEach(content => {
    content.hidden = true;
    content.classList.add('hidden');
  });
  
  const activeBtn = document.querySelector(`[data-tab="${tab}"], #tab-${tab}`);
  const activeContent = document.getElementById(`content-${tab}`);
  
  if (activeBtn) {
    activeBtn.classList.add('tab-active', 'is-active');
    activeBtn.setAttribute('aria-selected', 'true');
  }
  
  if (activeContent) {
    activeContent.hidden = false;
    activeContent.classList.remove('hidden');
  }

  // Update hero content dynamically
  updateHeroContent(tab);
  
  switch (tab) {
    case 'sub':
      fetchPlanPrices();
      break;
    case 'ads':
      fetchAdPrices();
      break;
    case 'myplans':
      fetchMyPlans();
      break;
  }
}


async function fetchPlanPrices (force = false) {
  const now = Date.now();
  if (!force && lastPlanFetchTimestamp && now - lastPlanFetchTimestamp < PLAN_FETCH_TTL) {
    return subscriptionPlanStore;
  }
  if (!force && planPricePromise) {
    return planPricePromise;
  }

  planPricePromise = (async () => {
    try {
      if (!Object.keys(planCardRegistry).length) {
        refreshPlanCardRegistry();
      }

      const phoneRes = await getSellerPhone();
      let url = `${API_BASE}/plans`;
      if (phoneRes) {
        url += `?sellerPhone=${encodeURIComponent(phoneRes)}`;
      }
      const res = await fetch(url, withCreds());
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      const plans = json.plans || {};

      subscriptionPlanStore = {};
      SUBSCRIPTION_PLAN_SLUGS.forEach(slug => {
        const defaults = PLAN_DEFAULTS[slug] || {};
        const plan = plans[slug] || {};
        const descriptor = {
          slug,
          title: plan.title !== undefined ? plan.title : (defaults.title || slug),
          price: plan.price ?? (defaults.price ?? null),
          durationDays: plan.durationDays ?? defaults.durationDays ?? null,
          description: plan.description !== undefined ? plan.description : (defaults.description || ''),
          features: (Array.isArray(plan.features) && plan.features.length > 0)
            ? plan.features
            : (Array.isArray(defaults.features) ? defaults.features : [])
        };
        const badgeLabel = (plan.badgeLabel ?? plan.badge?.label ?? defaults.badge?.label ?? '').toString().trim();
        const badgeVariant = normalizeBadgeVariant(plan.badgeVariant ?? plan.badge?.variant ?? defaults.badge?.variant);
        const badgeVisibleRaw = plan.badgeVisible ?? plan.badge?.visible ?? defaults.badge?.visible;
        const badgeVisible = badgeVisibleRaw === undefined ? !!badgeLabel : !!badgeVisibleRaw;
        descriptor.badge = {
          label: badgeLabel,
          variant: badgeVariant,
          visible: badgeVisible && !!badgeLabel
        };
        subscriptionPlanStore[slug] = descriptor;
        applyPlanCardDescriptor(descriptor);
      });

      lastPlanFetchTimestamp = Date.now();
      return subscriptionPlanStore;
    } catch (err) {
      console.error('❌ خطا در دریافت پلن‌های اشتراک:', err);
      lastPlanFetchTimestamp = 0;
      return subscriptionPlanStore;
    } finally {
      planPricePromise = null;
    }
  })();

  return planPricePromise;
}

/*──────────────── ۳) گرفتن قیمت تبلیغات ویژه ────────────────*/
/*──────────────── ۳) گرفتن قیمت تبلیغات ویژه ────────────────*/
/*──────────────── ۳) گرفتن قیمت تبلیغات ویژه ────────────────*/
/*──────────────── ۳) گرفتن قیمت تبلیغات ویژه ────────────────*/
/*──────────────── ۳) گرفتن قیمت تبلیغات ویژه ────────────────*/
/*──────────────── ۳) گرفتن قیمت تبلیغات ویژه ────────────────*/
async function fetchAdPrices (force = false) {
  if (!force && adPlanPriceCache) return adPlanPriceCache;
  if (!force && adPlanPricePromise) return adPlanPricePromise;

  adPlanPricePromise = (async () => {
    try {
      const phone = await getSellerPhone();
      let url = `${API_BASE}/adPlans`;
      if (phone) url += `?sellerPhone=${encodeURIComponent(phone)}`;
      const res = await fetch(url, withCreds());
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      const plansObj = json.adplans || {};

      adPlanPriceCache = plansObj;

      const map = {
        ad_search: 'price-ad_search',
        ad_home: 'price-ad_home',
        ad_products: 'price-ad_products',
      };

      Object.keys(map).forEach(slug => {
        const id = map[slug];
        const el = document.getElementById(id);
        if (el && plansObj[slug] != null) {
          el.textContent = toFaPrice(plansObj[slug]);
        }
      });

      return adPlanPriceCache;
    } catch (err) {
      console.error('❌ خطا در دریافت قیمت تبلیغات:', err);
      adPlanPriceCache = null;
      return null;
    } finally {
      adPlanPricePromise = null;
    }
  })();

  return adPlanPricePromise;
}






/* فرمت عدد به قیمت فارسی */
function toFaPrice (num) {
  return (+num || 0).toLocaleString('fa-IR');
}

function toFaDigits(num) {
  if (num === null || num === undefined) return '';
  const parsed = Number(num);
  if (Number.isNaN(parsed)) return '';
  return parsed.toLocaleString('fa-IR');
}

function faToEn(str) {
  return (str || '').replace(/[۰-۹]/g, d => '0123456789'.charAt('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

function getEffectivePlanPrice(plan, adPriceMap) {
  const map = adPriceMap || adPlanPriceCache || {};
  const slug = plan?.slug || plan?.planSlug || '';
  if (slug && map[slug] != null) {
    return map[slug];
  }
  return plan?.price || 0;
}

/*──────────────── ۴) انتخاب پلن ────────────────*/
// --- جایگزین تابع قبلی selectPlan کن ---
// زکی – نسخه نهایی با پاپ‌آپ تأیید پرداخت پلن اشتراک و تبلیغ
// زکی – نسخه نهایی selectPlan با تشخیص تبلیغ و بازکردن مدال تبلیغ ویژه

window.selectPlan = async function (slug) {
  if (slug === 'ad_search' || slug === 'ad_home' || slug === 'ad_products') {
    window.openAdModal(slug);
    return;
  }

  // Check if this is a subscription plan (cash-only)
  const isSubscriptionPlan = SUBSCRIPTION_PLAN_SLUGS.includes(slug);

  const defaults = PLAN_DEFAULTS[slug] || {};
  const fallbackBadge = defaults.badge ? {
    label: defaults.badge.label || '',
    variant: normalizeBadgeVariant(defaults.badge.variant),
    visible: defaults.badge.visible !== false && !!defaults.badge.label
  } : { label: '', variant: BADGE_VARIANTS[0], visible: false };
  const planData = subscriptionPlanStore[slug] || {};

  const title = planData.title !== undefined ? planData.title : (defaults.title || slug);
  const featureList = (Array.isArray(planData.features) && planData.features.length > 0)
    ? planData.features
    : (Array.isArray(defaults.features) ? defaults.features : []);
  const description = planData.description !== undefined ? planData.description : (defaults.description || '');
  const badgeInfo = planData.badge ? {
    label: planData.badge.label || '',
    variant: normalizeBadgeVariant(planData.badge.variant || fallbackBadge.variant),
    visible: planData.badge.visible !== false && !!planData.badge.label
  } : fallbackBadge;

  const modal = document.getElementById('upgradeModal');
  if (!modal) return;
  
  // Store the plan type in modal dataset for reference
  modal.dataset.planSlug = slug;
  modal.dataset.isSubscription = isSubscriptionPlan ? 'true' : 'false';
  
  modal.querySelector('#upgrade-title').textContent = title;
  const featuresUl = modal.querySelector('#featureList');
  if (featuresUl) {
    featuresUl.innerHTML = '';
    const details = description ? [description, ...featureList] : featureList;
    if (!details.length) {
      const li = document.createElement('li');
      li.textContent = 'جزئیاتی برای این پلن ثبت نشده است.';
      featuresUl.appendChild(li);
    } else {
      details.forEach(item => {
        const li = document.createElement('li');
        const icon = document.createElement('span');
        icon.className = 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold';
        icon.textContent = '✔';
        const span = document.createElement('span');
        span.textContent = item;
        li.appendChild(icon);
        li.appendChild(span);
        featuresUl.appendChild(li);
      });
    }
  }
  const priceEl = modal.querySelector('#upgrade-price');
  const oldPriceEl = modal.querySelector('#old-price');
  const badge = modal.querySelector('#planBadge');
  const saveBadge = modal.querySelector('#saveBadge');

  let priceNum = planData.price != null ? Number(planData.price) : Number(defaults.price ?? 0);
  if (!priceNum) {
    const fallbackPrice = document.querySelector(`[data-plan-price="${slug}"]`)?.textContent
      || document.getElementById(`price-${slug}`)?.textContent
      || '';
    priceNum = +faToEn(fallbackPrice).replace(/,/g, '') || 0;
  }

  if (priceEl) {
    priceEl.dataset.base = priceNum;
    priceEl.textContent = priceNum ? `${toFaPrice(priceNum)} تومان` : '';
  }

  if (slug === '3month' || slug === '12month') {
    const months = slug === '3month' ? 3 : 12;
    const basePrice = (subscriptionPlanStore['1month']?.price ?? Number(faToEn(document.getElementById('price-1month')?.textContent || '').replace(/,/g, ''))) || 0;
    if (basePrice && oldPriceEl) {
      const oldNum = basePrice * months;
      oldPriceEl.textContent = toFaPrice(oldNum) + ' تومان';
      oldPriceEl.classList.remove('hidden');
      if (saveBadge) {
        const percent = Math.round((1 - priceNum / oldNum) * 100);
        if (percent > 0) {
          saveBadge.textContent = `صرفه‌جویی ${percent.toLocaleString('fa-IR')}٪`;
          saveBadge.classList.remove('hidden');
        } else {
          saveBadge.classList.add('hidden');
        }
      }
    }
  } else {
    oldPriceEl?.classList.add('hidden');
    saveBadge?.classList.add('hidden');
  }

  if (badge) {
    if (badgeInfo.visible && badgeInfo.label) {
      badge.textContent = badgeInfo.label;
      applyBadgeStyle(badge, badgeInfo.variant || fallbackBadge.variant);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  // Handle subscription-specific UI (cash-only)
  const creditToggle = modal.querySelector('#upgradeCreditToggle');
  const creditAllocation = modal.querySelector('#upgradeCreditAllocation');
  const creditSwitch = modal.querySelector('#upgradeCreditSwitch');
  const creditRow = modal.querySelector('#upgradeCreditRow');
  const cashRow = modal.querySelector('#upgradeCashRow');
  const orderTotal = modal.querySelector('#upgradeOrderTotal');
  const cashAmount = modal.querySelector('#upgradeCashAmount');
  
  if (isSubscriptionPlan) {
    // Subscription: CASH-ONLY mode
    // Hide credit toggle and allocation
    if (creditToggle) creditToggle.style.display = 'none';
    if (creditAllocation) creditAllocation.hidden = true;
    if (creditSwitch) creditSwitch.checked = false;
    
    // Hide credit row, show only cash payment
    if (creditRow) creditRow.style.display = 'none';
    if (cashRow) cashRow.style.display = 'flex';
    
    // Set amounts
    if (orderTotal) orderTotal.textContent = `${toFaPrice(priceNum)} تومان`;
    if (cashAmount) cashAmount.textContent = `${toFaPrice(priceNum)} تومان`;
    
    // Add cash-only notice
    let cashOnlyNotice = modal.querySelector('#subscriptionCashOnlyNotice');
    if (!cashOnlyNotice) {
      cashOnlyNotice = document.createElement('div');
      cashOnlyNotice.id = 'subscriptionCashOnlyNotice';
      cashOnlyNotice.className = 'subscription-cash-only-notice';
      cashOnlyNotice.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; flex-shrink: 0;">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
        <span>پرداخت اشتراک فقط به‌صورت نقدی امکان‌پذیر است.</span>
      `;
      const checkoutSection = modal.querySelector('.upgrade-checkout');
      if (checkoutSection) {
        checkoutSection.insertBefore(cashOnlyNotice, checkoutSection.firstChild);
      }
    }
    cashOnlyNotice.style.display = 'flex';
  } else {
    // Other plans: credit is allowed
    if (creditToggle) creditToggle.style.display = '';
    
    // Hide cash-only notice if it exists
    const cashOnlyNotice = modal.querySelector('#subscriptionCashOnlyNotice');
    if (cashOnlyNotice) cashOnlyNotice.style.display = 'none';
    
    // Reset credit state
    if (creditSwitch) creditSwitch.checked = false;
    if (creditAllocation) creditAllocation.hidden = true;
    if (creditRow) creditRow.style.display = 'none';
    if (cashRow) cashRow.style.display = 'flex';
    
    // Set amounts
    if (orderTotal) orderTotal.textContent = `${toFaPrice(priceNum)} تومان`;
    if (cashAmount) cashAmount.textContent = `${toFaPrice(priceNum)} تومان`;
  }

  modal.classList.remove('hidden');
  modal.classList.add('is-open');
  modal.scrollTop = 0;
  document.body.classList.add('overflow-hidden', 'no-scroll');

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('is-open');
    document.body.classList.remove('overflow-hidden', 'no-scroll');
  };
  modal.querySelector('#closePaymentModalBtn').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };

  modal.querySelector('#goToPaymentBtn').onclick = async function() {
    closeModal();
    try {
      const res = await fetch(`${API_BASE}/seller/upgrade`, withCreds({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug: slug })
      }));
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('اشتراک شما با موفقیت فعال شد.');
        updatePremiumBadge(data.seller?.isPremium);
      } else {
        showToast(data.message || 'خطا در پرداخت', true);
      }
    } catch (err) {
      showToast('خطا در ارتباط با سرور', true);
    }
  };
};




/*──────────────── ۵) اجرا بعد از لود ────────────────*/
document.addEventListener('DOMContentLoaded', async () => {
  if (document.getElementById('tab-sub')) {
    initUpgradeDashboard();
  }
  startAdApprovalWatcher();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      fetchPlanPrices();
      fetchAdPrices();
      pollSellerAdApprovals(false);
    }
  });
  try {
    const res = await fetch(`${API_BASE}/auth/me`, withCreds());
    if (res.ok) {
      const data = await res.json();
      updatePremiumBadge(data?.seller?.isPremium);
    }
  } catch {}
});


/*  ─────── مدیریت مدال تبلیغ ویژه ─────── */

// باز شدن مدال موقع کلیک روی هر دکمه درخواست تبلیغ
// ───── مدیریت مدال تبلیغ ویژه با انتخاب نوع تبلیغ ─────

window.openAdModal = function(adType) {
  // Use the new premium Special Ad Modal
  if (typeof window.openSpecialAdModal === 'function') {
    window.openSpecialAdModal(adType);
    return;
  }
  
  // Fallback to old modal if new one not loaded
  const backdrop = document.getElementById('adModalBackdrop');
  if (!backdrop) return;

  // ثبت نوع تبلیغ (planSlug) در window
  window.__selectedAdType = adType;

  document.getElementById('adForm')?.reset();
  const targetType = document.getElementById('adTargetType');
  if (targetType) targetType.value = "product";
  const productWrap = document.getElementById('adProductSelectWrap');
  if (productWrap) productWrap.style.display = "block";
  const productSelect = document.getElementById('adProductSelect');
  if (productSelect) productSelect.innerHTML = `<option value="">در حال بارگذاری…</option>`;
  const adTitle = document.getElementById('adTitle');
  if (adTitle) adTitle.value = "";
  const adText = document.getElementById('adText');
  if (adText) adText.value = "";

  // نمایش مدال با کلاس‌های جدید
  backdrop.classList.remove('hidden');
  backdrop.classList.add('is-open');
  backdrop.scrollTop = 0;
  document.body.classList.add('overflow-hidden', 'no-scroll');

  // مقدار اولیه: نمایش محصولات
  fetchMyProducts();

  // کنترل تغییر نوع تبلیغ
  const targetTypeEl = document.getElementById('adTargetType');
  if (targetTypeEl) {
    targetTypeEl.onchange = function() {
      const productWrap = document.getElementById('adProductSelectWrap');
      if (this.value === 'product') {
        if (productWrap) productWrap.style.display = "block";
        fetchMyProducts();
      } else {
        if (productWrap) productWrap.style.display = "none";
      }
    };
  }
};


// بستن مدال
window.closeAdModal = function() {
  // Close new modal if exists
  if (typeof window.SpecialAdModal?.close === 'function') {
    window.SpecialAdModal.close();
  }
  
  // Also close old modal for backward compatibility
  const backdrop = document.getElementById('adModalBackdrop');
  if (backdrop) {
    backdrop.classList.add('hidden');
    backdrop.classList.remove('is-open', '!opacity-100');
  }
  document.body.classList.remove('overflow-hidden', 'no-scroll');
};

// بستن با کلیک روی بک‌دراپ (only if old modal exists)
const oldAdBackdrop = document.getElementById('adModalBackdrop');
if (oldAdBackdrop) {
  oldAdBackdrop.onclick = function(e) {
    if (e.target === this) closeAdModal();
  };
}

// گرفتن لیست محصولات فروشنده و نمایش در فرم تبلیغ
async function fetchMyProducts() {
  const select = document.getElementById('adProductSelect');
  if (!select) return;
  try {
    const sellerId = await getSellerId();
    if (!sellerId) throw new Error('seller-id-missing');

    const res = await fetch(`${API_BASE}/products?sellerId=${sellerId}`, withCreds());
    const products = await res.json();

    if (!products.length) {
      select.innerHTML = `<option value="">محصولی برای انتخاب نیست</option>`;
      return;
    }
    select.innerHTML = `<option value="">یک مورد را انتخاب کنید…</option>`;
    products.forEach(item => {
      select.innerHTML += `<option value="${item._id}">${item.title}</option>`;
    });
  } catch (err) {
    console.error('fetchMyProducts error', err);
    select.innerHTML = `<option value="">خطا در دریافت لیست!</option>`;
  }
}

// ثبت فرم تبلیغ ویژه (ارسال به سرور)
// ثبت فرم تبلیغ ویژه (ارسال به سرور و پرداخت)
// ثبت فرم تبلیغ ویژه (با نمایش پاپ‌آپ تایید قبل از پرداخت)
// ثبت فرم تبلیغ ویژه (با نمایش پاپ‌آپ تایید فقط با مزایا)
// ثبت فرم تبلیغ ویژه (فیک: بدون پرداخت واقعی)
window.submitAdForm = async function(e) {
  e.preventDefault();

  const targetType = document.getElementById('adTargetType').value;
  const select = document.getElementById('adProductSelect');
  const title = document.getElementById('adTitle').value.trim();
  const text  = document.getElementById('adText').value.trim();
  const file  = document.getElementById('adImage').files[0];
  const planSlug = window.__selectedAdType || '';

  if (targetType === "product" && !file) {
    alert("بارگذاری عکس برای تبلیغ محصول اجباری است.");
    return false;
  }

  if (targetType === "product" && !select.value) {
    alert("انتخاب محصول الزامی است.");
    return false;
  }
  if (!title) {
    alert("عنوان تبلیغ الزامی است.");
    return false;
  }
  if (!planSlug) {
    alert('نوع تبلیغ انتخاب نشده!');
    return false;
  }

  const sellerId = await getSellerId();
  if (!sellerId) {
    alert('خطا در دریافت اطلاعات فروشنده!');
    return false;
  }

  // خلاصه مزایا برای نمایش پاپ‌آپ تایید
  const adTitle = AD_PLAN_TITLES[planSlug] || "تبلیغ ویژه";
  const benefits = AD_PLAN_BENEFITS[planSlug] || ["جذب مشتری و افزایش فروش فروشگاه شما"];
  const locationHint = AD_PLAN_LOCATIONS[planSlug] || '';
  const benefitHtml = benefits.map(b => `<li>${b}</li>`).join('');

  // ---------- ساخت و نمایش پاپ‌آپ تایید ----------
  let confirmModal = document.getElementById('confirmAdPaymentModal');
  if (!confirmModal) {
    confirmModal = document.createElement('div');
    confirmModal.id = 'confirmAdPaymentModal';
    confirmModal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-black/25 flex items-center justify-center">
        <div class="bg-white rounded-2xl shadow-2xl max-w-xs w-full p-7 text-center relative animate-fadein">
          <button id="closeAdPaymentModalBtn" class="absolute left-2 top-2 text-gray-400 text-xl font-bold px-2 hover:text-red-500 transition">&#10006;</button>
          <h3 class="font-extrabold text-lg sm:text-xl mb-3 text-[#f59e42]">${adTitle}</h3>
          <ul class="text-gray-700 mb-3 text-sm font-medium text-right pr-3 list-disc" style="margin-right:12px">
            ${benefitHtml}
          </ul>
          <button id="submitAdAndPayBtn"
            class="btn-grad px-7 py-3 rounded-full text-white font-black shadow hover:scale-105 transition-all duration-200 text-base mt-2 w-full">
            تایید و ثبت نهایی
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmModal);
  } else {
    confirmModal.querySelector('h3').textContent = adTitle;
    confirmModal.querySelector('ul').innerHTML = benefitHtml;
  }
  confirmModal.style.display = 'block';

  // بستن با دکمه
  confirmModal.querySelector('#closeAdPaymentModalBtn').onclick = () => confirmModal.style.display = 'none';
  // بستن با کلیک بیرون
  confirmModal.onclick = (e) => { if (e.target === confirmModal) confirmModal.style.display = 'none'; };

  // عملکرد دکمه تایید و ثبت نهایی (فیک)
  confirmModal.querySelector('#submitAdAndPayBtn').onclick = async function() {
    confirmModal.style.display = 'none';

    try {
      // فقط ثبت سفارش تبلیغ (بدون پرداخت واقعی)
      const formData = new FormData();
      formData.append('sellerId', sellerId);
      formData.append('planSlug', planSlug);
      if (targetType === "product") {
        formData.append('productId', select.value);
      }
      formData.append('title', title);
      formData.append('text', text);
      if (file) formData.append('image', file);

      const res = await fetch(`${API_BASE}/adOrder`, withCreds({
        method: 'POST',
        body: formData
      }));
      const result = await res.json();

      if (!res.ok || !result.success || !result.adOrder) {
        showToast(result.message || 'ثبت تبلیغ ناموفق بود.', true);
        return false;
      }

      if (typeof window.closeAdModal === 'function') {
        window.closeAdModal();
      }

      const order = result.adOrder;
      const orderId = order?._id || order?.id;
      if (orderId) {
        adApprovalStatusCache.set(orderId, order?.status || 'pending');
      }

      const successDetails = [
        `پلن انتخابی: ${adTitle}`,
        locationHint ? `محل نمایش: ${locationHint}` : '',
        'وضعیت فعلی: در انتظار تایید ادمین'
      ].filter(Boolean);

      showSuccessPopup({
        title: 'تبلیغ شما با موفقیت ثبت شد',
        message: `تبلیغ «${title || adTitle}» ثبت شد و پس از تایید ادمین نمایش داده خواهد شد.`,
        details: successDetails,
        highlight: 'ثبت تبلیغ جدید',
        autoCloseMs: 9000
      });

      const adForm = document.getElementById('adForm');
      if (adForm) {
        adForm.reset();
        const targetSelect = document.getElementById('adTargetType');
        if (targetSelect) targetSelect.value = 'product';
        const productWrap = document.getElementById('adProductSelectWrap');
        if (productWrap) productWrap.style.display = 'block';
      }

      const myPlansSection = document.getElementById('content-myplans');
      if (myPlansSection && !myPlansSection.classList.contains('hidden')) {
        fetchMyPlans();
      }

    } catch (err) {
      console.error('submitAdForm error', err);
      alert('خطا در ثبت تبلیغ!');
    }
    return false;
  };
};




async function fetchMyPlans() {
  const box = document.getElementById('myPlansBox');
  box.innerHTML = `<div class="upgrade-loading"><div class="upgrade-loading__spinner"></div><span>در حال بارگذاری پلن‌ها…</span></div>`;
  const UPLOADS_BASE = `${API_BASE.replace('/api','')}/uploads/`;

  // تشخیص نوع تبلیغ براساس slug
  function getAdTypeLabel(plan) {
    const slug = plan.slug || plan.planSlug || '';
    switch (slug) {
      case "ad_home":     return "تبلیغ در صفحه اول";
      case "ad_search":   return "تبلیغ در جستجو";
      case "ad_products": return "تبلیغ لیست محصولات";
      default:            return "تبلیغ ویژه";
    }
  }

  // تاریخ پایان = یک روز بعد از شروع
  function getAdEndDate(plan) {
    if (!plan.startDate) return "-";
    try {
      const d = new Date(plan.startDate);
      d.setDate(d.getDate() + 1);
      return toJalaliDate(d.toISOString());
    } catch {
      return "-";
    }
  }

  // وضعیت پلن (active, expired, ...)
  function statusBadge(plan) {
    if (!plan.status) return "";
    let background = "#94a3b8";
    let textColor = "#fff";
    let label = "";
    switch (plan.status) {
      case "active":
        background = "#10B981";
        label = "فعال";
        break;
      case "approved":
        background = "#14b8a6";
        label = "تایید شده";
        break;
      case "expired":
        background = "#ef4444";
        label = "منقضی";
        break;
      case "pending":
        background = "#f59e0b";
        label = "در انتظار";
        break;
      case "paid":
        background = "#3b82f6";
        label = "پرداخت شده";
        break;
      case "review":
      case "under_review":
        background = "#e2e8f0";
        textColor = "#475569";
        label = "زیر نظر";
        break;
      default:
        label = plan.status;
    }
    return `<span class="plan-status-badge" style="--badge-bg:${background}; --badge-text:${textColor};">${label}</span>`;
  }

  function subStatusBadge(plan) {
    const status = plan.status || (plan.active ? 'active' : '');
    if (!status) return '';
    let background = '#3B82F6';
    let textColor = '#fff';
    let label = 'فعال';
    switch (status) {
      case 'expired':
        background = '#EF4444';
        label = 'منقضی';
        break;
      case 'approved':
        background = '#10B981';
        label = 'تایید شده';
        break;
      case 'pending':
        background = '#F59E0B';
        label = 'در انتظار';
        break;
      case 'active':
      default:
        background = '#3B82F6';
        label = 'فعال';
    }
    return `<span class="plan-status-badge" style="--badge-bg:${background}; --badge-text:${textColor};">${label}</span>`;
  }

  function getAdLocationHint(plan) {
    const slug = plan.slug || plan.planSlug || '';
    const map = {
      ad_home: 'محل نمایش: صفحه اصلی ویترینت',
      ad_search: 'محل نمایش: پنجره جستجوی سریع',
      ad_products: 'محل نمایش: صفحه لیست محصولات'
    };
    if (map[slug]) return map[slug];
    if (plan.productId) return 'محل نمایش: صفحه محصول تبلیغ‌شده';
    if (plan.sellerId) return 'محل نمایش: صفحه فروشگاه شما';
    return '';
  }

  function resolveAdViewLink(plan) {
    const slug = plan.slug || plan.planSlug || '';
    const directRoutes = {
      ad_home: '/index.html?highlightAd=ad_home#drag-scroll-cards',
      ad_search: '/index.html?highlightAd=ad_search#adPopup',
      ad_products: '/all-products.html?highlightAd=ad_products#productsList'
    };
    if (directRoutes[slug]) return directRoutes[slug];

    const productId = plan.productId ? String(plan.productId).trim() : '';
    if (productId) return `/product.html?id=${encodeURIComponent(productId)}`;

    const sellerId = plan.sellerId ? String(plan.sellerId).trim() : '';
    if (sellerId) return `/shop.html?id=${encodeURIComponent(sellerId)}`;

    return '';
  }

  const DAY_IN_MS = 24 * 60 * 60 * 1000;

  function calculateSubscriptionProgress(plan) {
    if (!plan?.startDate || !plan?.endDate) return null;
    const start = new Date(plan.startDate).getTime();
    const end = new Date(plan.endDate).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

    const now = Date.now();
    const started = now >= start;
    const elapsed = started ? now - start : 0;
    const duration = end - start;
    const progress = duration > 0 ? (elapsed / duration) * 100 : 0;
    const remainingDays = Math.ceil((end - now) / DAY_IN_MS);
    const daysToStart = started ? 0 : Math.ceil((start - now) / DAY_IN_MS);
    const graceDeadline = new Date(end + (3 * DAY_IN_MS));
    const graceRemainingDays = Math.ceil((graceDeadline.getTime() - now) / DAY_IN_MS);
    const expiredSinceDays = Math.ceil((now - end) / DAY_IN_MS);

    return {
      progress: Math.min(100, Math.max(0, progress)),
      remainingDays,
      started,
      daysToStart: Math.max(0, daysToStart),
      endedAt: new Date(end),
      gracePeriodDays: 3,
      graceDeadline,
      graceRemainingDays: remainingDays > 0 ? null : Math.max(0, graceRemainingDays),
      expiredSinceDays: remainingDays > 0 ? 0 : Math.max(0, expiredSinceDays)
    };
  }

  function buildTimelineMeta(info) {
    if (!info) return '';
    if (!info.started) {
      if (info.daysToStart <= 0) {
        return 'این اشتراک از امروز فعال می‌شود';
      }
      const value = info.daysToStart === 1 ? '۱' : toFaDigits(info.daysToStart);
      return `<strong>${value}</strong> روز تا شروع اشتراک`;
    }

    if (info.remainingDays <= 0) {
      if (info.graceRemainingDays != null && info.graceRemainingDays > 0) {
        const value = info.graceRemainingDays === 1 ? '۱' : toFaDigits(info.graceRemainingDays);
        return `این اشتراک منقضی شده است • <strong>${value}</strong> روز تا حذف کامل`;
      }
      return 'این اشتراک به پایان رسیده است';
    }

    const value = info.remainingDays === 1 ? '۱' : toFaDigits(info.remainingDays);
    return `<strong>${value}</strong> روز تا پایان اشتراک`;
  }

  function buildExpiryWarning(plan, info) {
    if (!plan || !info || info.remainingDays > 0) return '';

    const graceDaysLeft = info.graceRemainingDays != null
      ? Math.max(0, info.graceRemainingDays)
      : 0;
    const expiryDateText = toJalaliDate(plan.endDate) || '';
    const deadlineText = info.graceDeadline ? toJalaliDate(info.graceDeadline) : '';

    const countdownText = graceDaysLeft > 0
      ? `تنها ${graceDaysLeft === 1 ? '۱ روز' : `${toFaDigits(graceDaysLeft)} روز`} تا حذف کامل باقی مانده است`
      : 'امروز آخرین فرصت شما برای جلوگیری از حذف کامل است';

    const deadlineBadge = deadlineText
      ? `<div class="plan-expiry-warning__deadline">مهلت نهایی: ${deadlineText}</div>`
      : '';

    return `
      <div class="plan-expiry-warning" role="alert">
        <div class="plan-expiry-warning__header">
          <span class="plan-expiry-warning__icon" aria-hidden="true">⚠️</span>
          <span>هشدار تمدید اشتراک</span>
        </div>
        <p class="plan-expiry-warning__body">
          پلن اشتراک فروشگاه شما در تاریخ <strong>${expiryDateText || '-'}</strong> منقضی شده است. ${countdownText}.
        </p>
        <p class="plan-expiry-warning__cta">
          اگر طی ۳ روز آینده تمدید انجام نشود، پنل و صفحه فروشگاه شما به طور کامل حذف خواهد شد.
        </p>
        <div class="plan-expiry-warning__actions">
          <a class="plan-expiry-warning__btn" href="#content-sub">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14"></path>
              <path d="m18 11-6-6-6 6"></path>
            </svg>
            <span>تمدید اشتراک فروشگاه</span>
          </a>
          ${deadlineBadge}
        </div>
      </div>
    `;
  }

  try {
    const adPriceMapPromise = fetchAdPrices();
    const res = await fetch(`${API_BASE}/sellerPlans/my`, withCreds());
    const json = await res.json();
    const adPriceMap = (await adPriceMapPromise) || {};

    if (!res.ok || !json.plans || !json.plans.length) {
      box.innerHTML = `<div class="upgrade-empty"><div class="upgrade-empty__icon">📋</div><h3 class="upgrade-empty__title">پلن فعالی یافت نشد</h3><p class="upgrade-empty__desc">هنوز هیچ پلن اشتراک یا تبلیغاتی خریداری نکرده‌اید.</p></div>`;
      return;
    }

    // دسته‌بندی پلن‌ها
    const subPlans = [];
    const adPlans = [];
    json.plans.forEach(plan => {
      if (
        (plan.title && plan.title.includes('اشتراک')) ||
        ['1month', '3month', '12month'].includes(plan.slug)
      ) {
        subPlans.push(plan);
      } else {
        adPlans.push(plan);
      }
    });

    // شمارنده پلن‌ها
    const total = json.plans.length;
    const subCount = subPlans.length;
    const adCount = adPlans.length;

    // باکس شمارنده‌ها بالا
    const statsBox = `
      <div class="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
        <div class="bg-blue-50 border border-blue-100 rounded-xl py-4 flex flex-col items-center shadow-sm">
          <span class="text-blue-600 text-2xl font-bold">${subCount}</span>
          <span class="text-xs text-blue-700 mt-1">پلن اشتراک</span>
        </div>
        <div class="bg-orange-50 border border-orange-100 rounded-xl py-4 flex flex-col items-center shadow-sm">
          <span class="text-orange-500 text-2xl font-bold">${adCount}</span>
          <span class="text-xs text-orange-700 mt-1">پلن تبلیغاتی</span>
        </div>
        <div class="bg-gray-50 border border-gray-100 rounded-xl py-4 flex flex-col items-center shadow-sm">
          <span class="text-gray-800 text-2xl font-bold">${total}</span>
          <span class="text-xs text-gray-700 mt-1">جمع کل پلن‌ها</span>
        </div>
      </div>
    `;

    // کارت‌های پلن اشتراک
    let expiryWarningRendered = false;

    const subCards = subPlans.length
      ? subPlans.map(plan => {
          const statusMarkup = subStatusBadge(plan);
          const price = toFaPrice(getEffectivePlanPrice(plan, adPriceMap));
          const startDate = toJalaliDate(plan.startDate) || '-';
          const endDate = toJalaliDate(plan.endDate) || '-';
          const progressInfo = calculateSubscriptionProgress(plan);
          const timelineMeta = buildTimelineMeta(progressInfo);
          const progressValue = progressInfo ? Math.max(0, Math.min(100, Math.round(progressInfo.progress))) : 0;
          const progressSection = progressInfo
            ? `<div class="my-plan-card__progress" style="--progress:${progressValue}%">
                <div class="plan-progress-track">
                  <span class="plan-progress-bar"></span>
                </div>
                ${timelineMeta ? `<div class="progress-meta">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="8"></circle>
                    <path d="M12 8v4l2.5 1.5"></path>
                  </svg>
                  ${timelineMeta}
                </div>` : ''}
              </div>`
            : '';
          let expiryWarning = '';
          if (!expiryWarningRendered && progressInfo && progressInfo.remainingDays <= 0) {
            expiryWarning = buildExpiryWarning(plan, progressInfo);
            if (expiryWarning) {
              expiryWarningRendered = true;
            }
          }

          const description = plan.description
            ? `<p class="my-plan-card__description">${plan.description}</p>`
            : '';

          return `
            <article class="my-plan-card plan-card-surface subscription-card mb-4">
              <div class="my-plan-card__header">
                <div class="plan-pill">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="17" rx="2" fill="none"></rect>
                    <path d="M8 2v4"></path>
                    <path d="M16 2v4"></path>
                    <path d="M3 9h18"></path>
                    <path d="M9 15l2 2 4-4"></path>
                  </svg>
                  پلن اشتراک فروشگاه
                </div>
                ${statusMarkup || ''}
              </div>
              <div>
                <h3 class="my-plan-card__title">${plan.title || '-'}</h3>
                <div class="my-plan-card__price">
                  <span class="price-amount">${price}</span>
                  <span class="price-unit">تومان</span>
                </div>
              </div>
              <div class="my-plan-card__dates">
                <div class="info-row">
                  <span class="info-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="4" y="5" width="16" height="15" rx="2" fill="none"></rect>
                      <path d="M8 3v4"></path>
                      <path d="M16 3v4"></path>
                      <path d="M4 9h16"></path>
                      <path d="M9 14h2"></path>
                    </svg>
                  </span>
                  <div>
                    <div class="info-label">تاریخ شروع</div>
                    <div class="info-value" dir="ltr">${startDate}</div>
                  </div>
                </div>
                <div class="info-row info-row--end">
                  <span class="info-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M6 4v16"></path>
                      <path d="M6 5h10l-2.5 3L16 11H6"></path>
                    </svg>
                  </span>
                  <div>
                    <div class="info-label">تاریخ پایان</div>
                    <div class="info-value" dir="ltr">${endDate}</div>
                  </div>
                </div>
              </div>
              ${progressSection}
              ${expiryWarning}
              ${description}
            </article>
          `;
        }).join('')
      : `<div class="text-xs text-gray-400 py-5 text-center">هیچ پلن اشتراکی نداری!</div>`;

    // کارت تبلیغات (با نوع، عکس، تاریخ شروع و پایان وسط‌چین)
    const adCards = adPlans.length
      ? adPlans.map(plan => {
          let mediaMarkup = '';
          if (plan.bannerImage) {
            let imgSrc = plan.bannerImage.startsWith('http')
              ? plan.bannerImage
              : UPLOADS_BASE + plan.bannerImage.replace(/^\/?uploads\//, '');
            mediaMarkup = `<div class="plan-card__media-wrapper"><img src="${imgSrc}" alt="بنر تبلیغ"></div>`;
          }
          const status = statusBadge(plan);
          const adType = getAdTypeLabel(plan);
          const locationHint = getAdLocationHint(plan);
          const viewLink = plan.status === 'approved' ? resolveAdViewLink(plan) : '';
          const productLink = plan.productId
            ? `/product.html?id=${encodeURIComponent(String(plan.productId))}`
            : '';
          const shopLink = !productLink && plan.sellerId
            ? `/shop.html?id=${encodeURIComponent(String(plan.sellerId))}`
            : '';

          const actions = [
            viewLink
              ? `<a href="${viewLink}" target="_blank" rel="noopener" class="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-sm transition w-full sm:w-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5h11m0 0v11m0-11L5 21" />
                  </svg>
                  مشاهده تبلیغ
                </a>`
              : '',
            productLink
              ? `<a href="${productLink}" target="_blank" rel="noopener" class="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition w-full sm:w-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 5l7 7-7 7M5 12h14" />
                  </svg>
                  صفحه محصول
                </a>`
              : '',
            shopLink
              ? `<a href="${shopLink}" target="_blank" rel="noopener" class="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition w-full sm:w-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 7l9-4 9 4-9 4-9-4zm0 6l9 4 9-4" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 13l9 4 9-4" />
                  </svg>
                  صفحه فروشگاه
                </a>`
              : ''
          ].filter(Boolean);

          const actionsMarkup = actions.length
            ? `<div class="plan-card__actions">${actions.join('')}</div>`
            : '';

          const locationMarkup = locationHint
            ? `<div class="plan-card__hint">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 21s6-5.25 6-10.5A6 6 0 0 0 6 10.5C6 15.75 12 21 12 21z"></path>
                  <circle cx="12" cy="10.5" r="1.8"></circle>
                </svg>
                ${locationHint}
              </div>`
            : '';

          const description = plan.description
            ? `<p class="my-plan-card__description my-plan-card__description--ad">${plan.description}</p>`
            : '';

          return `
            <article class="plan-card plan-card-surface plan-card--ad mb-4">
              <div class="my-plan-card__header">
                <div class="plan-pill plan-pill--ad">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 7v6l3 2"></path>
                  </svg>
                  ${adType}
                </div>
                ${status || ''}
              </div>
              <div>
                <h3 class="my-plan-card__title">${plan.title || '-'}</h3>
                <div class="my-plan-card__price">
                  <span class="price-amount">${toFaPrice(getEffectivePlanPrice(plan, adPriceMap))}</span>
                  <span class="price-unit">تومان</span>
                </div>
              </div>
              ${mediaMarkup}
              <div class="my-plan-card__dates">
                <div class="info-row">
                  <span class="info-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="4" y="5" width="16" height="15" rx="2" fill="none"></rect>
                      <path d="M8 3v4"></path>
                      <path d="M16 3v4"></path>
                      <path d="M4 9h16"></path>
                      <path d="M9 14h2"></path>
                    </svg>
                  </span>
                  <div>
                    <div class="info-label">تاریخ شروع</div>
                    <div class="info-value" dir="ltr">${toJalaliDate(plan.startDate) || '-'}</div>
                  </div>
                </div>
                <div class="info-row info-row--end">
                  <span class="info-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M6 4v16"></path>
                      <path d="M6 5h10l-2.5 3L16 11H6"></path>
                    </svg>
                  </span>
                  <div>
                    <div class="info-label">تاریخ پایان</div>
                    <div class="info-value" dir="ltr">${getAdEndDate(plan)}</div>
                  </div>
                </div>
              </div>
              ${locationMarkup}
              ${description}
              ${actionsMarkup}
            </article>
          `;
        }).join('')
      : `<div class="text-xs text-gray-400 py-5 text-center">هنوز پلن تبلیغی نخریدی!</div>`;

    // خروجی نهایی صفحه
    box.innerHTML = `
      ${statsBox}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div class="flex items-center gap-2 mb-3">
            <span class="text-2xl">🏷️</span>
            <span class="text-lg font-bold text-blue-700">پلن‌های اشتراک فروشگاه</span>
          </div>
          ${subCards}
        </div>
        <div>
          <div class="flex items-center gap-2 mb-3">
            <span class="text-2xl">🎯</span>
            <span class="text-lg font-bold text-orange-700">پلن‌های تبلیغات ویژه</span>
          </div>
          ${adCards}
        </div>
      </div>
    `;
  } catch (err) {
    box.innerHTML = `<div class="upgrade-empty"><div class="upgrade-empty__icon">⚠️</div><h3 class="upgrade-empty__title">خطا در دریافت پلن‌ها</h3><p class="upgrade-empty__desc">لطفاً دوباره تلاش کنید.</p></div>`;
  }
}




// تبدیل تاریخ میلادی به جلالی (در صورت نیاز)
function toJalaliDate(isoStr) {
  if (!isoStr) return '';
  try {
    // اگر پروژه کتابخونه جلالی (مثلا moment-jalaali یا dayjs) داره، اونجا استفاده کن
    // در غیر این صورت، فقط تاریخ میلادی کوتاه نشون بده
    return new Date(isoStr).toLocaleDateString('fa-IR');
  } catch {
    return isoStr.split('T')[0];
  }
}
