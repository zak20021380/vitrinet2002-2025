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
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'fixed top-5 left-1/2 -translate-x-1/2 bg-white font-bold shadow-lg rounded-xl px-5 py-3 z-50 hidden';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.toggle('text-red-600', isError);
  toast.classList.toggle('text-green-600', !isError);
  setTimeout(() => toast.classList.add('hidden'), 3000);
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


/*──────────────── ۱) تب‌بندی و مقداردهی اولیه ────────────────*/
function initUpgradeDashboard () {
  const tabSub     = document.getElementById('tab-sub');
  const tabAds     = document.getElementById('tab-ads');
  const tabMyPlans = document.getElementById('tab-myplans');
  const contentSub = document.getElementById('content-sub');
  const contentAds = document.getElementById('content-ads');
  const contentMy  = document.getElementById('content-myplans');

  if (!tabSub || !tabAds || !tabMyPlans || !contentSub || !contentAds || !contentMy) return;

  tabSub.addEventListener('click',   () => toggleTabs('sub'));
  tabAds.addEventListener('click',   () => toggleTabs('ads'));
  tabMyPlans.addEventListener('click',() => toggleTabs('myplans'));

  // پیش‌فرض نمایش اشتراک فروشگاه
  toggleTabs('sub');

  fetchPlanPrices();
  fetchAdPrices();
}

function toggleTabs(tab) {
  const tabs = [
    { btn: 'tab-sub', content: 'content-sub' },
    { btn: 'tab-ads', content: 'content-ads' },
    { btn: 'tab-myplans', content: 'content-myplans' }
  ];
  tabs.forEach(t => {
    document.getElementById(t.btn)?.classList.remove('tab-active');
    document.getElementById(t.content)?.classList.add('hidden');
  });
  switch (tab) {
    case 'sub':
      document.getElementById('tab-sub').classList.add('tab-active');
      document.getElementById('content-sub').classList.remove('hidden');
      break;
    case 'ads':
      document.getElementById('tab-ads').classList.add('tab-active');
      document.getElementById('content-ads').classList.remove('hidden');
      break;
    case 'myplans':
      document.getElementById('tab-myplans').classList.add('tab-active');
      document.getElementById('content-myplans').classList.remove('hidden');
      // فراخوانی پلن‌های من
      fetchMyPlans();
      break;
  }
}


async function fetchPlanPrices () {
  try {
    const phoneRes = await getSellerPhone();
    let url = `${API_BASE}/plans`;
    if (phoneRes) {
      url += `?sellerPhone=${encodeURIComponent(phoneRes)}`;
    }
    const res   = await fetch(url, withCreds());
    const json  = await res.json();
    const plans = json.plans || {};

    const p1 = document.getElementById('price-1month');
    const p3 = document.getElementById('price-3month');
    const p12 = document.getElementById('price-12month');

    if (p1 && plans['1month'] != null) p1.textContent = toFaPrice(plans['1month']);
    if (p3 && plans['3month'] != null) p3.textContent = toFaPrice(plans['3month']);
    if (p12 && plans['12month'] != null) p12.textContent = toFaPrice(plans['12month']);
  } catch (err) {
    console.error('❌ خطا در دریافت پلن‌های اشتراک:', err);
  }
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

let offerTimer;
function startOfferCountdown(seconds = 45) {
  const el = document.getElementById('limitedOffer');
  if (!el) return;
  clearInterval(offerTimer);
  let remain = seconds;
  const tick = () => {
    const m = String(Math.floor(remain / 60)).padStart(2, '0');
    const s = String(remain % 60).padStart(2, '0');
    el.textContent = `پیشنهاد محدود - ${m}:${s}`;
    remain--;
    if (remain < 0) {
      clearInterval(offerTimer);
      el.textContent = '';
    }
  };
  tick();
  offerTimer = setInterval(tick, 1000);
}

/*──────────────── ۴) انتخاب پلن ────────────────*/
// --- جایگزین تابع قبلی selectPlan کن ---
// زکی – نسخه نهایی با پاپ‌آپ تأیید پرداخت پلن اشتراک و تبلیغ
// زکی – نسخه نهایی selectPlan با تشخیص تبلیغ و بازکردن مدال تبلیغ ویژه

window.selectPlan = async function (slug) {
  // اگر نوع پلن تبلیغ ویژه بود، مستقیم مدال تبلیغ رو باز کن و ادامه نده
  if (slug === 'ad_search' || slug === 'ad_home' || slug === 'ad_products') {
    window.openAdModal(slug); // مدال تبلیغ ویژه باز شود
    return;
  }

  // بقیه کد مخصوص پلن‌های اشتراک
  const PLAN_BENEFITS = {
    '1month':  [
      "قرار گرفتن فروشگاه شما در نتایج جستجو", 
      "ساخت ویترین اختصاصی", 
      "<span class='text-amber-300 font-bold'>امکان فعالسازی VitriPlus</span>"
    ],
    '3month': [
      "همه امکانات پلن ۱ ماهه +", 
      "۳ ماه حضور فعال", 
      "<span class='text-amber-300 font-bold'>تخفیف ویژه VitriPlus</span>"
    ],
    '12month': [
      "همه امکانات پلن‌های قبلی +",
      "نمایش بیشتر فروشگاه",
      "<span class='text-amber-300 font-bold'>ویژگی‌های اختصاصی VitriPlus</span>"
    ],
  };

  const PLAN_TITLE = {
    '1month'     : 'اشتراک ۱ ماهه',
    '3month'     : 'اشتراک ۳ ماهه',
    '12month'    : 'اشتراک ۱ ساله',
  };

  // مزایای پلن
  const title = PLAN_TITLE[slug] || slug;
  const benefits = PLAN_BENEFITS[slug] || [];
  let price = document.querySelector(`[data-plan-price="${slug}"]`)?.textContent
           || document.getElementById(`price-${slug}`)?.textContent
           || "";

  // استفاده از مدال موجود در صفحه
  const modal = document.getElementById('upgradeModal');
  if (!modal) return;
  modal.querySelector('#upgrade-title').textContent = title;
  const featuresUl = modal.querySelector('#featureList');
  if (featuresUl) {
    featuresUl.innerHTML = benefits.map(b => `\
      <li>\
        <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>\
        <span>${b}</span>\
      </li>`).join('');
  }
  const priceEl = modal.querySelector('#upgrade-price');
  const oldPriceEl = modal.querySelector('#old-price');
  const badge = modal.querySelector('#planBadge');
  const saveBadge = modal.querySelector('#saveBadge');
  const premiumToggle = modal.querySelector('#premiumToggle');

  const priceNum = +faToEn(price).replace(/,/g, '');
  if (priceEl) {
    priceEl.dataset.base = priceNum;
    priceEl.textContent = price ? `${price} تومان` : '';
  }

  // نمایش قیمت قدیم و برچسب‌ها برای پلن‌های چندماهه
  if (slug === '3month' || slug === '12month') {
    const months = slug === '3month' ? 3 : 12;
    const oneMonthEl = document.getElementById('price-1month');
    const oneMonthPrice = oneMonthEl ? +faToEn(oneMonthEl.textContent).replace(/,/g, '') : 0;
    if (oneMonthPrice && oldPriceEl) {
      const oldNum = oneMonthPrice * months;
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
    if (badge) {
      badge.textContent = slug === '3month' ? 'پرفروش‌ترین' : 'پیشنهاد طلایی';
      badge.classList.remove('hidden');
    }
  } else {
    oldPriceEl?.classList.add('hidden');
    badge?.classList.add('hidden');
    saveBadge?.classList.add('hidden');
  }

  if (premiumToggle) {
    premiumToggle.checked = false;
    premiumToggle.dispatchEvent(new Event('change'));
  }
  modal.classList.remove('hidden');
  modal.scrollTop = 0;
  document.body.classList.add('overflow-hidden');
  startOfferCountdown();

  const closeModal = () => {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    clearInterval(offerTimer);
  };
  modal.querySelector('#closePaymentModalBtn').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };

  modal.querySelector('#goToPaymentBtn').onclick = async function() {
    closeModal();
    const premium = premiumToggle && premiumToggle.checked;
    try {
      const res = await fetch(`${API_BASE}/seller/upgrade`, withCreds({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug: slug, premium })
      }));
      const data = await res.json();
      if (res.ok && data.success) {
        const msg = premium ? 'حساب شما با موفقیت پرمیوم شد.' : 'اشتراک شما با موفقیت فعال شد.';
        showToast(msg);
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
  const backdrop = document.getElementById('adModalBackdrop');
  if (!backdrop) return;

  // ثبت نوع تبلیغ (planSlug) در window
  window.__selectedAdType = adType;

  document.getElementById('adForm').reset();
  document.getElementById('adTargetType').value = "product";
  document.getElementById('adProductSelectWrap').style.display = "block";
  document.getElementById('adProductSelect').innerHTML = `<option value="">در حال بارگذاری…</option>`;
  document.getElementById('adTitle').value = "";
  document.getElementById('adText').value = "";

  // نمایش مدال
  backdrop.classList.remove('hidden');
  backdrop.scrollTop = 0;
  document.body.classList.add('overflow-hidden');
  setTimeout(() => { backdrop.classList.add('!opacity-100'); }, 10);

  // مقدار اولیه: نمایش محصولات
  fetchMyProducts();

  // کنترل تغییر نوع تبلیغ
  document.getElementById('adTargetType').onchange = function() {
    if (this.value === 'product') {
      document.getElementById('adProductSelectWrap').style.display = "block";
      fetchMyProducts();
    } else {
      document.getElementById('adProductSelectWrap').style.display = "none";
    }
  };
};


// بستن مدال
window.closeAdModal = function() {
  const backdrop = document.getElementById('adModalBackdrop');
  if (backdrop) {
    backdrop.classList.add('hidden');
    backdrop.classList.remove('!opacity-100');
  }
  document.body.classList.remove('overflow-hidden');
};

// بستن با کلیک روی بک‌دراپ
document.getElementById('adModalBackdrop').onclick = function(e) {
  if (e.target === this) closeAdModal();
};

// گرفتن لیست محصولات فروشنده و نمایش در فرم تبلیغ
async function fetchMyProducts() {
  const select = document.getElementById('adProductSelect');
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
  box.innerHTML = `<div class="text-center text-gray-400 py-8">در حال بارگذاری پلن‌ها…</div>`;
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
    let bg = "bg-gray-400", text = "text-white", txt = "";
    switch (plan.status) {
      case "active":
        bg = "bg-green-500";
        txt = "فعال";
        break;
      case "approved":
        bg = "bg-emerald-500";
        txt = "تایید شده";
        break;
      case "expired":
        bg = "bg-red-400";
        txt = "منقضی";
        break;
      case "pending":
        bg = "bg-[#F59E0B]";
        text = "text-white";
        txt = "در انتظار";
        break;
      case "paid":
        bg = "bg-blue-500";
        txt = "پرداخت شده";
        break;
      case "review":
      case "under_review":
        bg = "bg-gray-200";
        text = "text-gray-600";
        txt = "زیر نظر";
        break;
      default:
        txt = plan.status;
    }
    return `<div class="absolute left-3 top-3 text-xs ${bg} ${text} rounded-full px-3 py-0.5 shadow status-badge">${txt}</div>`;
  }

  function subStatusBadge(plan) {
    let status = plan.status || (plan.active ? 'active' : '');
    if (!status) return '';
    let color = '#3B82F6', label = 'فعال';
    switch (status) {
      case 'expired': color = '#EF4444'; label = 'منقضی'; break;
      case 'approved': color = '#10B981'; label = 'تایید شده'; break;
      case 'pending': color = '#F59E0B'; label = 'در انتظار'; break;
      case 'active':
      default: color = '#3B82F6'; label = 'فعال';
    }
    return `<span class="my-plan-status" style="background:${color}">${label}</span>`;
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

  try {
    const adPriceMapPromise = fetchAdPrices();
    const res = await fetch(`${API_BASE}/sellerPlans/my`, withCreds());
    const json = await res.json();
    const adPriceMap = (await adPriceMapPromise) || {};

    if (!res.ok || !json.plans || !json.plans.length) {
      box.innerHTML = `<div class="text-center text-gray-400 py-8">پلن فعالی یافت نشد!</div>`;
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
    const subCards = subPlans.length
      ? subPlans.map(plan => `
        <div class="my-plan-card mb-4">
          ${subStatusBadge(plan)}
          <div class="text-lg font-bold mb-1">${plan.title || '-'}</div>
          <div class="text-2xl font-extrabold text-[#10B981] mb-3">${toFaPrice(getEffectivePlanPrice(plan, adPriceMap))} <span class="text-sm font-normal text-gray-300">تومان</span></div>
          <div class="flex flex-col items-end gap-1 text-gray-300 text-xs sm:text-sm">
            <div>شروع: <span dir="ltr">${toJalaliDate(plan.startDate) || '-'}</span></div>
            <div>پایان: <span dir="ltr">${toJalaliDate(plan.endDate) || '-'}</span></div>
          </div>
          ${plan.description ? `<div class="text-xs text-gray-400 mt-3 text-right">${plan.description}</div>` : ''}
        </div>
      `).join('')
      : `<div class="text-xs text-gray-400 py-5 text-center">هیچ پلن اشتراکی نداری!</div>`;

    // کارت تبلیغات (با نوع، عکس، تاریخ شروع و پایان وسط‌چین)
    const adCards = adPlans.length
      ? adPlans.map(plan => {
          let img = '';
          if (plan.bannerImage) {
            let imgSrc = plan.bannerImage.startsWith('http')
              ? plan.bannerImage
              : UPLOADS_BASE + plan.bannerImage.replace(/^\/?uploads\//, '');
            img = `<img src="${imgSrc}" alt="بنر تبلیغ" class="w-full h-32 sm:h-36 object-cover rounded-xl mb-2 border shadow-sm">`;
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
            ? `<div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mt-3">${actions.join('')}</div>`
            : '';

          return `
            <div class="plan-card border border-orange-200 rounded-xl bg-white p-4 sm:p-5 shadow-sm mb-4 hover:shadow-lg hover:border-orange-400 transition-all relative">
              ${status}
              <div class="flex items-center gap-2 mb-2">
                <span class="inline-block px-2 py-0.5 rounded bg-orange-100 text-orange-600 text-xs font-bold">${adType}</span>
              </div>
              ${img}
              <div class="font-bold text-orange-700 text-base mb-1">${plan.title || '-'}</div>
              <div class="text-base text-orange-800 font-extrabold mb-2">${toFaPrice(getEffectivePlanPrice(plan, adPriceMap))} <span class="text-xs font-normal">تومان</span></div>
              <div class="flex flex-col items-center gap-1 text-gray-500 text-xs sm:text-sm mb-2">
                <div>شروع: <span dir="ltr">${toJalaliDate(plan.startDate) || '-'}</span></div>
                <div>پایان: <span dir="ltr">${getAdEndDate(plan)}</span></div>
              </div>
              ${plan.description ? `<div class="text-xs text-gray-400 mt-1 text-center">${plan.description}</div>` : ''}
              ${locationHint ? `<div class="text-[11px] text-gray-400 mt-2 text-center">${locationHint}</div>` : ''}
              ${actionsMarkup}
            </div>
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
    box.innerHTML = `<div class="text-center text-red-400 py-8">خطا در دریافت پلن‌ها!</div>`;
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

document.addEventListener("DOMContentLoaded", () => {
  const premiumPrice = 30000;
  const toggle = document.getElementById("premiumToggle");
  const display = document.getElementById("upgrade-price");

  if (toggle && display) {
    toggle.addEventListener("change", () => {
      const base = parseInt(display.dataset.base || '0', 10);
      const final = base + (toggle.checked ? premiumPrice : 0);
      display.textContent = toFaPrice(final) + ' تومان';
    });
  }
});


