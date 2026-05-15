(() => {
  'use strict';

  if (document.getElementById('similar-sponsored-seller-root')) return;

  const target = document.getElementById('content-ads') || document.getElementById('ads-content');
  if (!target) return;

  const API_BASE = (() => {
    const configured = window.VITRINET_API || window.__API_BASE__ || '';
    const raw = String(configured || (location?.origin || 'http://localhost:5000')).replace(/\/$/, '');
    return raw.endsWith('/api') ? raw : `${raw}/api`;
  })();

  const TOKEN_KEYS = ['seller_token', 'access_token', 'auth_token', 'token', 'jwt'];
  const state = {
    plans: [],
    requests: [],
    selectedPlan: null,
    csrfPromise: null
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
    if (!Number.isFinite(num)) return '0';
    return num.toLocaleString('fa-IR');
  }

  function formatDate(value) {
    if (!value) return 'تنظیم نشده';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'تنظیم نشده';
    return date.toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
  }

  const tierLabels = {
    normal: 'اسپانسری معمولی',
    priority: 'اسپانسری اولویت‌دار'
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
    pending: 'در انتظار پرداخت',
    submitted: 'رسید ارسال شده',
    verified: 'پرداخت تایید شد',
    rejected: 'پرداخت رد شد',
    waived: 'رایگان'
  };

  function injectStyles() {
    if (document.getElementById('similar-sponsored-seller-styles')) return;
    const style = document.createElement('style');
    style.id = 'similar-sponsored-seller-styles';
    style.textContent = `
      .similar-sponsored-widget{direction:rtl;margin:1.25rem 0;padding:1rem;border:1px solid #e2e8f0;border-radius:14px;background:#fff;box-shadow:0 14px 34px rgba(15,23,42,.06);font-family:inherit}
      .similar-sponsored-widget__header{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem}
      .similar-sponsored-widget h3{margin:0 0 .3rem;color:#0f172a;font-size:1.05rem}
      .similar-sponsored-widget p{margin:0;color:#64748b;line-height:1.8;font-size:.88rem}
      .similar-sponsored-widget__plans,.similar-sponsored-widget__requests{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.8rem}
      .similar-sponsored-plan,.similar-sponsored-request{border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;padding:.85rem}
      .similar-sponsored-plan.priority{border-color:#fed7aa;background:#fff7ed}
      .similar-sponsored-plan__top,.similar-sponsored-request__top{display:flex;align-items:center;justify-content:space-between;gap:.6rem;margin-bottom:.55rem}
      .similar-sponsored-pill{display:inline-flex;border-radius:999px;padding:.18rem .55rem;background:#e0f2fe;color:#0369a1;font-size:.72rem;font-weight:900}
      .similar-sponsored-pill.priority{background:#fed7aa;color:#c2410c}
      .similar-sponsored-pill.approved{background:#dcfce7;color:#166534}
      .similar-sponsored-pill.pending,.similar-sponsored-pill.paused{background:#fef9c3;color:#854d0e}
      .similar-sponsored-pill.rejected,.similar-sponsored-pill.removed{background:#fee2e2;color:#991b1b}
      .similar-sponsored-price{font-size:1.1rem;font-weight:900;color:#0f172a;margin:.35rem 0}
      .similar-sponsored-btn{border:0;border-radius:10px;padding:.65rem .9rem;font-weight:900;cursor:pointer;background:#0ea5e9;color:#fff;display:inline-flex;align-items:center;justify-content:center;gap:.35rem}
      .similar-sponsored-btn.secondary{background:#e0f2fe;color:#0369a1}
      .similar-sponsored-btn:disabled{opacity:.55;cursor:not-allowed}
      .similar-sponsored-msg{min-height:1.2rem;margin:.75rem 0;color:#64748b;font-weight:700;font-size:.84rem}
      .similar-sponsored-msg.error{color:#b91c1c}
      .similar-sponsored-msg.success{color:#047857}
      .similar-sponsored-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.45);padding:1rem}
      .similar-sponsored-modal[hidden]{display:none}
      .similar-sponsored-modal__dialog{width:min(520px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:16px;padding:1rem;box-shadow:0 24px 70px rgba(15,23,42,.25)}
      .similar-sponsored-modal__header{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem}
      .similar-sponsored-modal label{display:grid;gap:.35rem;color:#475569;font-weight:800;font-size:.82rem;margin-bottom:.75rem}
      .similar-sponsored-modal textarea,.similar-sponsored-modal input{border:1px solid #cbd5e1;border-radius:10px;padding:.7rem;font:inherit}
      .similar-sponsored-modal textarea{min-height:6rem;resize:vertical}
      .similar-sponsored-modal__actions{display:flex;gap:.6rem;flex-wrap:wrap}
      @media(max-width:640px){.similar-sponsored-widget__header{flex-direction:column}.similar-sponsored-widget__plans,.similar-sponsored-widget__requests{grid-template-columns:1fr}.similar-sponsored-btn{width:100%}.similar-sponsored-modal{align-items:flex-end;padding:.75rem}.similar-sponsored-modal__dialog{border-radius:16px 16px 10px 10px}}
    `;
    document.head.appendChild(style);
  }

  function renderShell() {
    injectStyles();
    const root = document.createElement('section');
    root.id = 'similar-sponsored-seller-root';
    root.className = 'similar-sponsored-widget';
    root.innerHTML = `
      <header class="similar-sponsored-widget__header">
        <div>
          <h3>اسپانسر شدن در مغازه‌های مشابه</h3>
          <p>بعد از ارسال درخواست و تایید مدیر، فروشگاه شما بالاتر از مغازه‌های مشابه نمایش داده می‌شود.</p>
        </div>
        <button type="button" class="similar-sponsored-btn secondary" data-similar-sponsored-refresh>بروزرسانی</button>
      </header>
      <div id="similar-sponsored-message" class="similar-sponsored-msg" role="status" aria-live="polite"></div>
      <div class="similar-sponsored-widget__plans" id="similar-sponsored-plans"></div>
      <h3 style="margin-top:1.25rem;">درخواست‌های من</h3>
      <div class="similar-sponsored-widget__requests" id="similar-sponsored-requests"></div>
      <div class="similar-sponsored-modal" id="similar-sponsored-modal" hidden>
        <form class="similar-sponsored-modal__dialog" id="similar-sponsored-form">
          <div class="similar-sponsored-modal__header">
            <div>
              <h3 id="similar-sponsored-modal-title">ثبت درخواست تبلیغ</h3>
              <p id="similar-sponsored-modal-plan"></p>
            </div>
            <button type="button" class="similar-sponsored-btn secondary" data-similar-sponsored-close>بستن</button>
          </div>
          <label>
            <span>توضیح یا کد پیگیری پرداخت</span>
            <textarea name="paymentProofText" placeholder="شماره پیگیری، توضیح پرداخت یا لینک رسید را وارد کنید"></textarea>
          </label>
          <label>
            <span>فایل رسید پرداخت (jpg, png, webp, pdf)</span>
            <input type="file" name="paymentProof" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf">
          </label>
          <div class="similar-sponsored-modal__actions">
            <button type="submit" class="similar-sponsored-btn">ارسال برای بررسی مدیر</button>
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
      setMessage(err.message || 'خطا در بارگذاری تبلیغات مشابه', 'error');
    }
  }

  function renderPlans() {
    const container = document.getElementById('similar-sponsored-plans');
    if (!container) return;
    if (!state.plans.length) {
      container.innerHTML = '<p>در حال حاضر پلن فعالی برای این جایگاه تعریف نشده است.</p>';
      return;
    }
    container.innerHTML = state.plans.map((plan) => `
      <article class="similar-sponsored-plan ${plan.tier === 'priority' ? 'priority' : ''}">
        <div class="similar-sponsored-plan__top">
          <strong>${escapeHtml(plan.title || tierLabels[plan.tier] || '')}</strong>
          <span class="similar-sponsored-pill ${plan.tier === 'priority' ? 'priority' : ''}">${escapeHtml(durationLabels[plan.durationUnit] || '')}</span>
        </div>
        <p>${escapeHtml(plan.description || 'نمایش در بخش مغازه‌های مشابه بعد از تایید مدیر')}</p>
        <div class="similar-sponsored-price">${formatMoney(plan.price)} تومان</div>
        <p>مدت: ${escapeHtml(String(plan.durationDays || ''))} روز | سقف جایگاه: ${escapeHtml(String(plan.slotLimit || 1))}</p>
        <button type="button" class="similar-sponsored-btn" data-plan-tier="${escapeHtml(plan.tier)}" data-plan-duration="${escapeHtml(plan.durationUnit)}">درخواست این پلن</button>
      </article>
    `).join('');
  }

  function renderRequests() {
    const container = document.getElementById('similar-sponsored-requests');
    if (!container) return;
    if (!state.requests.length) {
      container.innerHTML = '<p>هنوز درخواستی ثبت نکرده‌اید.</p>';
      return;
    }
    container.innerHTML = state.requests.map((item) => {
      const status = item.status || 'pending';
      const paymentStatus = item.paymentStatus || 'pending';
      const metrics = item.metrics || {};
      return `
        <article class="similar-sponsored-request">
          <div class="similar-sponsored-request__top">
            <strong>${escapeHtml(item.planTitle || tierLabels[item.planTier] || 'تبلیغ مشابه‌ها')}</strong>
            <span class="similar-sponsored-pill ${escapeHtml(status)}">${escapeHtml(statusLabels[status] || status)}</span>
          </div>
          <p>${escapeHtml(tierLabels[item.planTier] || '')} / ${escapeHtml(durationLabels[item.durationUnit] || '')}</p>
          <p>پرداخت: ${escapeHtml(paymentLabels[paymentStatus] || paymentStatus)}</p>
          <p>شروع: ${escapeHtml(formatDate(item.startAt))}</p>
          <p>پایان: ${escapeHtml(formatDate(item.endAt))}</p>
          <p>نمایش: ${escapeHtml(String(metrics.impressions || 0))} | کلیک: ${escapeHtml(String(metrics.clicks || 0))}</p>
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
      label.textContent = `${plan.title || tierLabels[plan.tier] || ''} - ${formatMoney(plan.price)} تومان`;
    }
    modal.hidden = false;
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
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('planTier', plan.tier);
    formData.set('durationUnit', plan.durationUnit);
    setMessage('در حال ارسال درخواست...');
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
      closeModal();
      await loadData();
      setMessage(data.message || 'درخواست برای بررسی مدیر ارسال شد.', 'success');
    } catch (err) {
      console.error('similar sponsored submitRequest failed:', err);
      setMessage(err.message || 'خطا در ثبت درخواست', 'error');
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
    document.querySelector('[data-similar-sponsored-refresh]')?.addEventListener('click', loadData);
    document.getElementById('similar-sponsored-form')?.addEventListener('submit', submitRequest);
    document.getElementById('similar-sponsored-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'similar-sponsored-modal') closeModal();
    });
  }

  renderShell();
  bindEvents();
  loadData();
})();
