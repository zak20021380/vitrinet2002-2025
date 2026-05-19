(() => {
  'use strict';

  if (document.getElementById('similar-sponsored-seller-root')) return;

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
    csrfPromise: null
  };

  const tierLabels = {
    normal: 'پلن استاندارد',
    priority: 'پلن اولویت‌دار'
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
        .finally(() => {
          state.csrfPromise = null;
        });
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

  function injectStyles() {
    if (document.getElementById('similar-sponsored-seller-styles')) return;
    const style = document.createElement('style');
    style.id = 'similar-sponsored-seller-styles';
    style.textContent = `
      .similar-sponsored-widget{direction:rtl;margin:1.25rem 0 0;font-family:inherit}
      .similar-sponsored-card{position:relative;overflow:hidden;border:1px solid rgba(16,185,129,.14);border-radius:24px;background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);box-shadow:0 16px 42px rgba(15,23,42,.08);color:#0f172a;padding:1rem}
      .similar-sponsored-card::before{content:'';position:absolute;inset:0 0 auto 0;height:5px;background:linear-gradient(90deg,#10b981,#0ea5e9)}
      .similar-sponsored-card::after{content:'';position:absolute;inset:auto -80px -90px auto;width:210px;height:210px;border-radius:999px;background:radial-gradient(circle,rgba(16,185,129,.12),rgba(14,165,233,0));pointer-events:none}
      .similar-sponsored-card>*{position:relative;z-index:1}
      .similar-sponsored-widget__header{display:flex;gap:.85rem;align-items:flex-start;margin-bottom:.9rem}
      .similar-sponsored-head-icon{display:grid;place-items:center;width:48px;height:48px;min-width:48px;border-radius:16px;background:linear-gradient(145deg,#dcfce7,#e0f2fe);color:#059669;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 8px 18px rgba(16,185,129,.14);font-size:1.35rem}
      .similar-sponsored-kicker{display:inline-flex;align-items:center;gap:.35rem;border-radius:999px;background:#ecfdf5;border:1px solid #bbf7d0;padding:.22rem .65rem;color:#047857;font-size:.7rem;font-weight:900;margin-bottom:.5rem}
      .similar-sponsored-widget h3{margin:0 0 .28rem;color:#0f172a;font-size:1.14rem;font-weight:900;line-height:1.55}
      .similar-sponsored-widget p{margin:0;color:#64748b;line-height:1.85;font-size:.84rem}
      .similar-sponsored-alert{display:flex;gap:.55rem;align-items:flex-start;margin:.85rem 0;padding:.72rem;border:1px solid #bae6fd;border-radius:16px;background:linear-gradient(135deg,#f0f9ff,#ecfdf5);color:#0369a1;font-size:.79rem;line-height:1.75;font-weight:700}
      .similar-sponsored-widget__plans{display:grid;grid-template-columns:1fr;gap:.75rem;margin-top:.8rem}
      .similar-sponsored-plan{position:relative;overflow:hidden;border:1px solid #e2e8f0;border-radius:18px;background:#fff;color:#0f172a;padding:.95rem;box-shadow:0 10px 28px rgba(15,23,42,.06);transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}
      .similar-sponsored-plan:hover{transform:translateY(-2px);border-color:rgba(14,165,233,.35);box-shadow:0 16px 34px rgba(15,23,42,.1)}
      .similar-sponsored-plan::before{content:'';position:absolute;inset:0 0 auto 0;height:3px;background:linear-gradient(90deg,#10b981,#0ea5e9)}
      .similar-sponsored-plan.priority{border-color:#fde68a;background:linear-gradient(145deg,#ffffff 0%,#fffdf3 100%)}
      .similar-sponsored-plan.priority::before{background:linear-gradient(90deg,#f59e0b,#10b981,#0ea5e9)}
      .similar-sponsored-plan__top,.similar-sponsored-request__top{display:flex;align-items:flex-start;justify-content:space-between;gap:.7rem;margin-bottom:.55rem}
      .similar-sponsored-plan strong,.similar-sponsored-request strong{display:block;color:#0f172a;font-size:.94rem;line-height:1.65}
      .similar-sponsored-pill{display:inline-flex;align-items:center;border-radius:999px;padding:.22rem .62rem;background:#e0f2fe;color:#0369a1;font-size:.7rem;font-weight:900;white-space:nowrap}
      .similar-sponsored-pill.priority{background:#fffbeb;color:#b45309;border:1px solid #fde68a}
      .similar-sponsored-pill.approved{background:#dcfce7;color:#166534}
      .similar-sponsored-pill.pending,.similar-sponsored-pill.paused{background:#fef9c3;color:#854d0e}
      .similar-sponsored-pill.rejected,.similar-sponsored-pill.removed,.similar-sponsored-pill.expired{background:#fee2e2;color:#991b1b}
      .similar-sponsored-plan__meta{display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem;margin:.75rem 0}
      .similar-sponsored-plan__meta div{border-radius:14px;background:linear-gradient(180deg,#f8fafc,#f1f5f9);border:1px solid #eef2f7;padding:.52rem;text-align:center}
      .similar-sponsored-plan__meta span{display:block;color:#64748b;font-size:.68rem;font-weight:800}
      .similar-sponsored-plan__meta b{display:block;color:#0f172a;font-size:.78rem;margin-top:.18rem}
      .similar-sponsored-price{display:inline-flex;align-items:center;gap:.35rem;font-size:1.2rem;font-weight:900;color:#059669;margin:.35rem 0}
      .similar-sponsored-price::before{content:'قیمت پلن';font-size:.68rem;font-weight:900;color:#64748b;background:#f1f5f9;border-radius:999px;padding:.18rem .5rem}
      .similar-sponsored-btn{border:0;border-radius:14px;padding:.78rem .95rem;font-weight:900;cursor:pointer;background:linear-gradient(135deg,#10b981,#0ea5e9);color:#fff;display:inline-flex;align-items:center;justify-content:center;gap:.38rem;transition:transform .2s ease,box-shadow .2s ease;box-shadow:0 10px 22px rgba(14,165,233,.22)}
      .similar-sponsored-btn:hover{transform:translateY(-1px);box-shadow:0 14px 28px rgba(14,165,233,.28)}
      .similar-sponsored-btn.secondary{background:#e0f2fe;color:#0369a1}
      .similar-sponsored-btn:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
      .similar-sponsored-msg{min-height:1.2rem;margin:.65rem 0;color:#64748b;font-weight:800;font-size:.84rem}
      .similar-sponsored-msg.error{color:#b91c1c}
      .similar-sponsored-msg.success{color:#047857}
      .similar-sponsored-requests-panel{margin-top:1rem;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;padding:.85rem;color:#0f172a}
      .similar-sponsored-requests-panel h4{margin:0 0 .65rem;color:#0f172a;font-size:.95rem;font-weight:900}
      .similar-sponsored-widget__requests{display:grid;grid-template-columns:1fr;gap:.65rem}
      .similar-sponsored-request{border:1px solid #e2e8f0;border-radius:16px;background:#fff;padding:.82rem;box-shadow:0 8px 20px rgba(15,23,42,.04)}
      .similar-sponsored-request p,.similar-sponsored-plan p{color:#64748b;line-height:1.75;font-size:.8rem}
      .similar-sponsored-request__grid{display:grid;grid-template-columns:1fr 1fr;gap:.45rem;margin-top:.6rem}
      .similar-sponsored-request__grid div{border-radius:10px;background:#fff;padding:.45rem}
      .similar-sponsored-request__grid span{display:block;color:#64748b;font-size:.68rem;font-weight:800}
      .similar-sponsored-request__grid b{display:block;color:#0f172a;font-size:.78rem;margin-top:.12rem}
      .similar-sponsored-empty{border:1px dashed #bae6fd;border-radius:14px;background:#f0f9ff;color:#0369a1;padding:.75rem;font-weight:800;font-size:.82rem;line-height:1.8}
      .similar-sponsored-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.52);padding:1rem}
      .similar-sponsored-modal[hidden]{display:none}
      .similar-sponsored-modal__dialog{width:min(520px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:1rem;box-shadow:0 24px 70px rgba(15,23,42,.28)}
      .similar-sponsored-modal__header{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem}
      .similar-sponsored-modal h3{color:#0f172a}
      .similar-sponsored-modal p{color:#64748b}
      .similar-sponsored-modal label{display:grid;gap:.38rem;color:#475569;font-weight:800;font-size:.82rem;margin-bottom:.75rem}
      .similar-sponsored-modal textarea,.similar-sponsored-modal input{border:1px solid #cbd5e1;border-radius:12px;padding:.72rem;font:inherit}
      .similar-sponsored-modal textarea{min-height:6rem;resize:vertical}
      .similar-sponsored-payment-note{display:grid;gap:.35rem;margin:.85rem 0 1rem;padding:.85rem;border-radius:16px;border:1px solid #bae6fd;background:linear-gradient(135deg,#f0f9ff,#ecfdf5);color:#0f172a}
      .similar-sponsored-payment-note strong{font-size:.9rem;font-weight:900;color:#0369a1}
      .similar-sponsored-payment-note span{font-size:.82rem;line-height:1.9;color:#475569}
      .similar-sponsored-modal__actions{display:flex;gap:.6rem;flex-wrap:wrap}
      @media(min-width:720px){.similar-sponsored-widget__plans{grid-template-columns:repeat(2,minmax(0,1fr))}.similar-sponsored-plan.featured{grid-column:span 2}.similar-sponsored-card{padding:1.15rem}.similar-sponsored-request__grid{grid-template-columns:repeat(4,1fr)}}
      @media(max-width:640px){.similar-sponsored-widget__header{align-items:flex-start}.similar-sponsored-btn{width:100%}.similar-sponsored-plan__meta{grid-template-columns:1fr}.similar-sponsored-modal{align-items:flex-end;padding:.75rem}.similar-sponsored-modal__dialog{border-radius:18px 18px 10px 10px}.similar-sponsored-modal__actions{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function renderShell() {
    injectStyles();
    const root = document.createElement('section');
    root.id = 'similar-sponsored-seller-root';
    root.className = 'similar-sponsored-widget';
    root.dataset.adSlot = 'similar_promotions';
    root.style.scrollMarginTop = '12px';
    root.setAttribute('aria-expanded', 'false');
    root.innerHTML = `
      <article class="similar-sponsored-card" aria-labelledby="similar-sponsored-title">
        <header class="similar-sponsored-widget__header">
          <div class="similar-sponsored-head-icon" aria-hidden="true">🚀</div>
          <div>
            <span class="similar-sponsored-kicker">تبلیغ پرمیوم فروشگاه‌های مشابه</span>
            <h3 id="similar-sponsored-title">نمایش در فروشگاه‌های مشابه</h3>
            <p>فروشگاه شما در بخش مغازه‌های مشابه بالاتر دیده می‌شود. قیمت، مدت نمایش و فعال‌سازی فقط توسط مدیر تنظیم و تایید می‌شود.</p>
          </div>
        </header>
        <div class="similar-sponsored-alert">
          <span aria-hidden="true">✓</span>
          <span>درخواست را از همین بخش ثبت کنید؛ مدیر در «مدیریت تبلیغات» آن را بررسی می‌کند و پس از تایید، زمان شروع و پایان را فعال می‌کند.</span>
        </div>
        <div id="similar-sponsored-message" class="similar-sponsored-msg" role="status" aria-live="polite"></div>
        <div class="similar-sponsored-widget__plans" id="similar-sponsored-plans"></div>
        <div class="similar-sponsored-requests-panel">
          <h4>وضعیت درخواست‌های شما</h4>
          <div class="similar-sponsored-widget__requests" id="similar-sponsored-requests"></div>
        </div>
      </article>
      <div class="similar-sponsored-modal" id="similar-sponsored-modal" hidden>
        <form class="similar-sponsored-modal__dialog" id="similar-sponsored-form">
          <div class="similar-sponsored-modal__header">
            <div>
              <h3 id="similar-sponsored-modal-title">ثبت درخواست تبلیغ</h3>
              <p id="similar-sponsored-modal-plan"></p>
            </div>
            <button type="button" class="similar-sponsored-btn secondary" data-similar-sponsored-close>بستن</button>
          </div>
          <div class="similar-sponsored-payment-note">
            <strong>پرداخت فقط آنلاین انجام می‌شود</strong>
            <span>بعد از ثبت درخواست، به درگاه پرداخت هدایت می‌شوید. نمایش تبلیغ پس از پرداخت موفق و تایید مدیر فعال خواهد شد.</span>
          </div>
          <div class="similar-sponsored-modal__actions">
            <button type="submit" class="similar-sponsored-btn">ثبت درخواست و پرداخت آنلاین</button>
            <button type="button" class="similar-sponsored-btn secondary" data-similar-sponsored-close>انصراف</button>
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
    el.className = `similar-sponsored-msg ${type || ''}`.trim();
  }

  async function apiJson(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...options,
      headers: authHeaders(options.headers || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.message || 'خطا در ارتباط با سرور');
    return data;
  }

  async function loadData() {
    setMessage('در حال بارگذاری...');
    try {
      const [plansData, requestsData] = await Promise.all([
        apiJson('/similar-shop-promotions/plans'),
        apiJson('/similar-shop-promotions/seller')
      ]);
      state.plans = Array.isArray(plansData.plans) ? plansData.plans : [];
      state.requests = Array.isArray(requestsData.promotions) ? requestsData.promotions : [];
      renderPlans();
      renderRequests();
      setMessage('');
    } catch (err) {
      console.error('similar sponsored loadData failed:', err);
      setMessage(err.message || 'خطا در بارگذاری تبلیغات فروشگاه‌های مشابه', 'error');
    }
  }

  function renderPlans() {
    const container = document.getElementById('similar-sponsored-plans');
    if (!container) return;
    const plans = sortPlans(state.plans);
    if (!plans.length) {
      container.innerHTML = '<div class="similar-sponsored-empty">فعلا پلن فعالی برای این جایگاه تعریف نشده است. قیمت و فعال بودن پلن از سمت مدیر کنترل می‌شود.</div>';
      return;
    }

    container.innerHTML = plans.map((plan, index) => {
      const isPriority = plan.tier === 'priority';
      const planTitle = plan.title || tierLabels[plan.tier] || 'پلن تبلیغ مشابه';
      return `
        <article class="similar-sponsored-plan ${isPriority ? 'priority' : ''} ${index === 0 ? 'featured' : ''}">
          <div class="similar-sponsored-plan__top">
            <div>
              <strong>${escapeHtml(planTitle)}</strong>
              <p>${escapeHtml(plan.description || 'نمایش ویژه فروشگاه در بخش فروشگاه‌های مشابه پس از تایید مدیر')}</p>
            </div>
            <span class="similar-sponsored-pill ${isPriority ? 'priority' : ''}">${escapeHtml(tierLabels[plan.tier] || plan.tier || '')}</span>
          </div>
          <div class="similar-sponsored-price">${formatMoney(plan.price)} تومان</div>
          <div class="similar-sponsored-plan__meta">
            <div><span>مدت</span><b>${escapeHtml(String(plan.durationDays || ''))} روز</b></div>
            <div><span>دوره</span><b>${escapeHtml(durationLabels[plan.durationUnit] || plan.durationUnit || '')}</b></div>
            <div><span>جایگاه</span><b>${escapeHtml(String(plan.slotLimit || 1))}</b></div>
          </div>
          <button type="button" class="similar-sponsored-btn" data-plan-tier="${escapeHtml(plan.tier)}" data-plan-duration="${escapeHtml(plan.durationUnit)}">ثبت درخواست تبلیغ</button>
        </article>
      `;
    }).join('');
  }

  function renderRequests() {
    const container = document.getElementById('similar-sponsored-requests');
    if (!container) return;
    if (!state.requests.length) {
      container.innerHTML = '<div class="similar-sponsored-empty">هنوز درخواستی ثبت نکرده‌اید. بعد از ثبت، وضعیت بررسی مدیر همین‌جا نمایش داده می‌شود.</div>';
      return;
    }

    container.innerHTML = state.requests.map((item) => {
      const status = item.status || 'pending';
      const paymentStatus = item.paymentStatus || 'pending';
      return `
        <article class="similar-sponsored-request">
          <div class="similar-sponsored-request__top">
            <strong>${escapeHtml(item.planTitle || tierLabels[item.planTier] || 'نمایش در فروشگاه‌های مشابه')}</strong>
            <span class="similar-sponsored-pill ${escapeHtml(status)}">${escapeHtml(statusLabels[status] || status)}</span>
          </div>
          <p>${escapeHtml(tierLabels[item.planTier] || item.planTier || '')} / ${escapeHtml(durationLabels[item.durationUnit] || item.durationUnit || '')}</p>
          <div class="similar-sponsored-request__grid">
            <div><span>قیمت</span><b>${formatMoney(item.price)} تومان</b></div>
            <div><span>پرداخت</span><b>${escapeHtml(paymentLabels[paymentStatus] || paymentStatus)}</b></div>
            <div><span>شروع</span><b>${escapeHtml(formatDate(item.startAt))}</b></div>
            <div><span>پایان</span><b>${escapeHtml(formatDate(item.endAt))}</b></div>
          </div>
          ${item.adminNote ? `<p>یادداشت مدیر: ${escapeHtml(item.adminNote)}</p>` : ''}
        </article>
      `;
    }).join('');
  }

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
    const plan = state.selectedPlan;
    if (!plan) return;
    const formData = new FormData();
    formData.set('planTier', plan.tier);
    formData.set('durationUnit', plan.durationUnit);
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
    }
  }

  function bindEvents() {
    document.getElementById('similar-sponsored-plans')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-plan-tier]');
      if (!button) return;
      const plan = state.plans.find((item) => item.tier === button.dataset.planTier && item.durationUnit === button.dataset.planDuration);
      if (plan) openModal(plan);
    });
    document.querySelectorAll('[data-similar-sponsored-close]').forEach((button) => {
      button.addEventListener('click', closeModal);
    });
    document.getElementById('similar-sponsored-form')?.addEventListener('submit', submitRequest);
    document.getElementById('similar-sponsored-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'similar-sponsored-modal') closeModal();
    });
  }

  renderShell();
  bindEvents();
  loadData();
})();
