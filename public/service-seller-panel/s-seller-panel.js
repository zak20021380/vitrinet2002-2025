document.addEventListener('DOMContentLoaded', async () => {

// === STEP 1 — API client (READ services only) ===
// اگر آدرس سرور فرق دارد، مقدار زیر را عوض کن
const API_BASE = (window.__API_BASE__ || 'http://localhost:5000');
const NO_CACHE = { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } };
const bust = (url) => `${url}${url.includes('?') ? '&' : '?'}__=${Date.now()}`;

const API = {
  async _json(res) {
    const txt = await res.text();
    if (!txt) return null;
    try { return JSON.parse(txt); } catch { return null; }
  },

  _unwrap(res) {
    const o = res || {};
    if (Array.isArray(o)) return o;
    return o.items || o.data || o.services || o.service || [];
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

  // ایجاد خدمت جدید
  async createService(payload) {
    const r = await fetch(`${API_BASE}/api/seller-services/me/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('CREATE_SERVICE_FAILED');
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
    const r = await fetch(`${API_BASE}/api/seller-services/me/services/${id}`, {
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
    const r = await fetch(`${API_BASE}/api/seller-services/me/services/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!r.ok) throw new Error('DELETE_SERVICE_FAILED');
    return true;
  }
};

// === END STEP 1 ===

async function fetchInitialData() {
  try {
    const [sellerRes, servicesRes] = await Promise.all([
      fetch(bust(`${API_BASE}/api/sellers/me`), { credentials: 'include', ...NO_CACHE }),
      fetch(bust(`${API_BASE}/api/seller-services/me/services`), { credentials: 'include', ...NO_CACHE })
    ]);

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
      populateSettingsForm(store);
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
    recentActivity: [
      { type: 'review', text: 'نظر جدید از <strong>علی رضایی</strong>', time: '۲ دقیقه پیش' },
      { type: 'booking', text: 'نوبت جدید برای <strong>سارا محمدی</strong> تایید شد.', time: '۱ ساعت پیش' },
      { type: 'customer', text: '<strong>رضا حسینی</strong> به مشتریان شما اضافه شد.', time: '۳ ساعت پیش' },
      { type: 'booking', text: 'نوبت <strong>مریم اکبری</strong> برای فردا لغو شد.', time: '۵ ساعت پیش' },
    ],
   bookings: [
  // ===== CONFIRMED BOOKINGS (green booked status) =====
  { id: 1, customerName: 'علی رضایی', service: 'اصلاح سر', time: '۱۴:۳۰', status: 'confirmed' },
  { id: 4, customerName: 'مریم اکبری', service: 'کوتاهی مو', time: '۱۷:۳۰', status: 'confirmed' },
  { id: 8, customerName: 'محمد کریمی', service: 'اصلاح ریش', time: '۰۹:۰۰', status: 'confirmed' },
  { id: 12, customerName: 'فاطمه احمدی', service: 'رنگ مو', time: '۱۵:۰۰', status: 'confirmed' },

  // ===== PENDING BOOKINGS (blue pending status) =====
  { id: 2, customerName: 'سارا محمدی', service: 'رنگ مو', time: '۱۶:۰۰', status: 'pending' },
  { id: 3, customerName: 'رضا حسینی', service: 'اصلاح ریش', time: '۱۱:۰۰', status: 'pending' },
  { id: 6, customerName: 'زهرا قاسمی', service: 'کراتینه', time: '۱۸:۰۰', status: 'pending' },
  { id: 9, customerName: 'حسن مولایی', service: 'اصلاح سر', time: '۱۰:۳۰', status: 'pending' },

  // ===== COMPLETED BOOKINGS (gray completed status) =====
  { id: 5, customerName: 'نیما افشار', service: 'اصلاح سر', time: '۱۰:۰۰', status: 'completed' },
  { id: 10, customerName: 'لیلا رضایی', service: 'کوتاهی مو', time: '۰۸:۳۰', status: 'completed' },
  { id: 13, customerName: 'احمد صادقی', service: 'اصلاح ریش', time: '۱۳:۰۰', status: 'completed' },

  // ===== CANCELLED BOOKINGS (dashed green - available again) =====
  { id: 7, customerName: 'مینا جعفری', service: 'رنگ مو', time: '۱۲:۰۰', status: 'cancelled' },
  { id: 11, customerName: 'پیمان نوری', service: 'اصلاح سر', time: '۱۶:۳۰', status: 'cancelled' },
  { id: 14, customerName: 'شیدا کاظمی', service: 'کراتینه', time: '۱۹:۰۰', status: 'cancelled' },

  // ===== BLOCKED CUSTOMER CANCELLATIONS (red blocked status) =====
  { id: 15, customerName: 'مهدی بلوکی', service: 'اصلاح سر', time: '۱۴:۰۰', status: 'cancelled' },
  { id: 16, customerName: 'نرگس مسدودی', service: 'رنگ مو', time: '۱۷:۰۰', status: 'cancelled' },
],
    customers: [
      { id: 1, name: 'علی رضایی', phone: '۰۹۱۲۳۴۵۶۷۸۹', lastReservation: '۱۴۰۳/۰۵/۲۰' },
      { id: 2, name: 'سارا محمدی', phone: '۰۹۳۵۱۲۳۴۵۶۷', lastReservation: '۱۴۰۳/۰۵/۱۸' },
      { id: 3, name: 'رضا حسینی', phone: '۰۹۱۸۹۸۷۶۵۴۳', lastReservation: '۱۴۰۳/۰۵/۱۵' },
      { id: 4, name: 'مریم اکبری', phone: '۰۹۱۰۱۱۰۲۲۰۳', lastReservation: '۱۴۰۳/۰۴/۳۰' },
    ],
    reviews: [
      { id: 1, customerName: 'علی رضایی', rating: 5, date: '۱ روز پیش', comment: 'کارشون عالی و حرفه‌ای بود. بسیار راضی بودم.', status: 'pending' },
      { id: 2, customerName: 'سارا محمدی', rating: 4, date: '۳ روز پیش', comment: 'محیط تمیز و برخورد پرسنل خوب بود. فقط کمی معطل شدم.', status: 'pending' },
      { id: 3, customerName: 'رضا حسینی', rating: 5, date: '۱ هفته پیش', comment: 'بهترین آرایشگاهی که تا حالا رفتم.', status: 'pending' },
      { id: 4, customerName: 'مریم اکبری', rating: 3, date: '۲ هفته پیش', comment: 'کیفیت کار متوسط بود.', status: 'pending' },
    ]
  };

window.MOCK_DATA = MOCK_DATA;

  
  /**
   * ==============================
   * Storage Manager
   * ==============================
   */
  class StorageManager {
    static get(key) {
      try {
        return JSON.parse(localStorage.getItem(key));
      } catch (e) {
        console.error("Error getting from localStorage", e);
        return null;
      }
    }
    static set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error("Error setting to localStorage", e);
      }
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
    static formatRelativeDate(dateStr) {
      if (!dateStr) return '';
      const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
      const latinDigits = '0123456789';
      const toEnglish = s => s.replace(/[۰-۹]/g, d => latinDigits[persianDigits.indexOf(d)]);
      const toPersian = s => s.replace(/[0-9]/g, d => persianDigits[d]);
      const target = toEnglish(dateStr.trim());
      const fmt = d => new Intl.DateTimeFormat('fa-IR-u-nu-latn-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
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
      const target = parseInt(el.dataset.value, 10);
      const isDecimal = el.dataset.value.includes('.');
      const targetDecimal = isDecimal ? parseFloat(el.dataset.value) : target;
      let frame = 0;
      const duration = 50; // frames
      const step = targetDecimal / duration;
      function counter() {
        frame++;
        const current = step * frame;
        if (isDecimal) {
            el.textContent = UIComponents.formatPersianNumber(parseFloat(Math.min(current, targetDecimal).toFixed(1)));
        } else {
            el.textContent = UIComponents.formatPersianNumber(Math.min(Math.ceil(current), target));
        }
        if (frame < duration) {
          requestAnimationFrame(counter);
        } else {
            el.textContent = UIComponents.formatPersianNumber(targetDecimal);
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
      setTimeout(() => {
        toast.remove();
      }, duration);
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
        if(firstFocusable) firstFocusable.focus();
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
  _SEEDED_KEY: 'vit_notifications_seeded_v1',
  _els: {},

  load() { return StorageManager.get(this._KEY) || []; },
  save(list) { StorageManager.set(this._KEY, list); },

  seedFromMock() {
    if (StorageManager.get(this._SEEDED_KEY)) return;
    const now = Date.now();
    const items = (window.MOCK_DATA?.recentActivity || []).map((a, i) => ({
      id: 'n' + (now + i),
      type: a.type || 'info',
      text: a.text || '',
      time: a.time || '',
      read: false
    }));
    this.save(items);
    StorageManager.set(this._SEEDED_KEY, true);
  },

  init() {
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
    this.seedFromMock();
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
    this._els.clearAll?.addEventListener('click', () => {
      this.save([]);
      this.render();
      UIComponents.showToast('همه اعلان‌ها حذف شد.', 'info');
    });

    this._els.markRead?.addEventListener('click', () => {
      const items = this.load().map(n => ({ ...n, read: true }));
      this.save(items);
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

  open()  { this._els.panel.hidden = false; this._els.btn.setAttribute('aria-expanded', 'true'); },
  close() { this._els.panel.hidden = true;  this._els.btn.setAttribute('aria-expanded', 'false'); },
  toggle(){ this._els.panel.hidden ? this.open() : this.close(); },

  remove(id) {
    const items = this.load().filter(n => n.id !== id);
    this.save(items);
    this.render();
  },

  markRead(id) {
    const items = this.load().map(n => n.id === id ? ({ ...n, read: true }) : n);
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

// اجرا
Notifications.init();

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
    constructor() {
      this.root = document.documentElement;
      this.body = document.body;
      this.appNav = document.querySelector('.app-nav');
      this.debouncedSearch = this.debounce(this.filterCustomers, 300);
      this.currentBookingFilter = 'all';
      this.currentServiceImage = '';
      this.currentPortfolioImage = '';

      // Initialize Services, Portfolio, VIP & Brand images
      this.initServices();
      this.initPortfolio();
      this.initVipSettings();
      this.initCustomerFeatures();
      this.initBrandImages();

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
    vipForm: document.getElementById('vip-form')
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
    }
  ];

  buttonHandlers.forEach(({ element, handler }) => {
    if (element) {
      element.addEventListener('click', handler);
    }
  });

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
        document.getElementById('dashboard-view').classList.add('active'); // Fallback
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
        case 'plans': this.renderPlans(); break;
        case 'settings': this.renderSettings(); break; // New call for settings
      }
    }
    // --- Page Rendering ---
    renderWelcomeDate() {
      document.getElementById('welcome-date').textContent = UIComponents.formatPersianNumber(new Date().toLocaleDateString('fa-IR'));
    }
    renderDashboard() {
        document.querySelectorAll('.stat-value').forEach(UIComponents.animateCountUp);
  
    }
 renderBookings(filter = 'all') {
  this.currentBookingFilter = filter;
  const listEl = document.getElementById('bookings-list');
  const prefs = CustomerPrefs.load();

  // قوانین مشتری (مسدود = لغو شده، خودکار تایید = از pending به confirmed)
  const effective = MOCK_DATA.bookings.map(b => {
    const p = prefs[normalizeKey(b.customerName)];
    if (p?.blocked) return { ...b, status: 'cancelled' };
    if (p?.autoAccept && b.status === 'pending') return { ...b, status: 'confirmed' };
    return b;
  });

  const filtered = (filter === 'all') ? effective : effective.filter(b => b.status === filter);

  if (!filtered.length) {
    listEl.innerHTML = `<p>موردی برای نمایش یافت نشد.</p>`;
  } else {
    const statusLabel = {
      pending: 'در انتظار',
      confirmed: 'تایید نوبت',
      completed: 'انجام شده',
      cancelled: 'لغو نوبت'
    };
    listEl.innerHTML = filtered.map(b => `
      <article class="booking-card card" role="listitem" tabindex="0" data-status="${b.status}" data-customer-name="${b.customerName}">
        <div class="booking-card-content">
          <strong class="booking-customer">${b.customerName}</strong>
          <span class="booking-service">${b.service} - ساعت ${UIComponents.formatPersianNumber(b.time)}</span>
        </div>
        <div class="booking-actions">
          <span class="status-badge status-${b.status}">${statusLabel[b.status] || b.status}</span>
          <button type="button" class="btn-secondary btn-icon-text status-change-btn" data-id="${b.id}" aria-haspopup="true" aria-expanded="false">تغییر وضعیت</button>
          <div class="status-menu" role="menu">
            <button type="button" class="status-option" data-status="confirmed">تایید نوبت</button>
            <button type="button" class="status-option" data-status="completed">انجام شده</button>
            <button type="button" class="status-option" data-status="cancelled">لغو نوبت</button>
          </div>
        </div>
      </article>
    `).join('');
  }

  if (!listEl.dataset.statusBound) {
    const self = this;
    listEl.addEventListener('click', function(e) {
      const btn = e.target.closest('.status-change-btn');
      const option = e.target.closest('.status-option');
      if (btn) {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        listEl.querySelectorAll('.status-menu').forEach(m => m.classList.remove('open'));
        listEl.querySelectorAll('.status-change-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
        if (!expanded) {
          btn.setAttribute('aria-expanded', 'true');
          btn.nextElementSibling.classList.add('open');
        }
        e.stopPropagation();
        return;
      }
      if (option) {
        const id = parseInt(option.closest('.booking-actions').querySelector('.status-change-btn').dataset.id, 10);
        const newStatus = option.dataset.status;
        const booking = MOCK_DATA.bookings.find(b => b.id === id);
        if (booking) booking.status = newStatus;
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
    completed: effective.filter(b => b.status === 'completed').length
  };
  const setText = (sel, val) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = UIComponents.formatPersianNumber(val);
  };
  setText('.filter-chip[data-filter="all"] .chip-badge', allCount);
  setText('.filter-chip[data-filter="pending"] .chip-badge', counts.pending);
  setText('.filter-chip[data-filter="confirmed"] .chip-badge', counts.confirmed);
  setText('.filter-chip[data-filter="completed"] .chip-badge', counts.completed);
}

  




    renderReviews(filter = 'all') {
  const listEl = document.getElementById('reviews-list');
  
  let filteredReviews = MOCK_DATA.reviews;
  
  if (filter !== 'all') {
    if (filter === '1') {
      // 1-2 stars
      filteredReviews = MOCK_DATA.reviews.filter(r => r.rating <= 2);
    } else {
      // Filter by exact rating
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
          ? `<div class="review-status">تایید شده</div>`
          : `<div class="review-actions">
              <button type="button" class="btn-success btn-icon-text approve-review">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                تایید
              </button>
              <button type="button" class="btn-danger btn-icon-text reject-review">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                رد
              </button>
            </div>`}
      </article>
    `;
  }).join('');

  if (!listEl.dataset.reviewBound) {
    listEl.addEventListener('click', (e) => {
      const approveBtn = e.target.closest('.approve-review');
      const rejectBtn = e.target.closest('.reject-review');
      if (approveBtn) {
        const card = approveBtn.closest('.review-card');
        const id = parseInt(card.dataset.id, 10);
        const review = MOCK_DATA.reviews.find(r => r.id === id);
        if (review) review.status = 'approved';
        const actions = card.querySelector('.review-actions');
        if (actions) {
          actions.outerHTML = '<div class="review-status">تایید شده</div>';
        }
        UIComponents.showToast('نظر تایید شد و در صفحه شما به نمایش در میاد', 'success');
        return;
      }
      if (rejectBtn) {
        const card = rejectBtn.closest('.review-card');
        const id = parseInt(card.dataset.id, 10);
        card.remove();
        MOCK_DATA.reviews = MOCK_DATA.reviews.filter(r => r.id !== id);
        UIComponents.showToast('نظر حذف شد', 'error');
        return;
      }
    });
    listEl.dataset.reviewBound = 'true';
  }
}


    renderPlans() {
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
      if(window.innerWidth < 1024) return;
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
                const id = parseInt(e.target.dataset.id);
                const services = StorageManager.get('vit_services') || [];
                const service = services.find(s => s.id === id);
                if (service) {
                    this.populateServiceForm(service);
                    UIComponents.openDrawer('service-drawer');
                }
            });
        });
        container.querySelectorAll('.delete-service-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.deleteService(id);
            });
        });
    }

    handleSettingsFormSubmit() {
        const nameEl = document.getElementById('business-name');
        const phoneEl = document.getElementById('business-phone');
        const addressEl = document.getElementById('business-address');
        const data = JSON.parse(localStorage.getItem('seller') || '{}');

        if (nameEl) data.storename = nameEl.value.trim();
        if (phoneEl) data.phone = phoneEl.value.trim();
        if (addressEl) data.address = addressEl.value.trim();

        localStorage.setItem('seller', JSON.stringify(data));

        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setText('seller-shop-name', data.storename || '');
        setText('seller-phone', data.phone || '');
        setText('seller-address', data.address || '');

        UIComponents.showToast('تنظیمات با موفقیت ذخیره شد!', 'success');
    }

  populateServiceForm(service) {
        const form = document.getElementById('service-form');
        const titleEl = document.getElementById('service-drawer-title');
        if (service) {
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
  const form  = document.getElementById('service-form');
  const id    = form.dataset.editingId ? parseInt(form.dataset.editingId, 10) : null;

  const title = document.getElementById('service-title').value.trim();
  const price = parseFloat(document.getElementById('service-price').value);

  const fileInput = document.getElementById('service-image');
  let imageData   = this.currentServiceImage;
  const file      = fileInput.files && fileInput.files[0];
  if (file) {
    imageData = await this.fileToDataURL(file);
  }

  if (!title || Number.isNaN(price)) {
    UIComponents.showToast('لطفاً عنوان و قیمت معتبر وارد کنید.', 'error');
    return;
  }

  // کش محلی فعلی
  let services = StorageManager.get('vit_services') || [];

  // پیام وضعیت
  UIComponents.showToast(id ? 'در حال ذخیره تغییرات…' : 'در حال افزودن خدمت…', 'info', 2500);

  try {
    // اطمینان از وجود آداپتر
    if (!API || typeof API.getServices !== 'function') {
      throw new Error('API adapter missing');
    }

    let saved;
    if (id) {
      // ویرایش
      saved = await API.updateService({ id, title, price, image: imageData || null });
      const idx = services.findIndex(s => String(s.id) === String(id));
      if (idx !== -1) services[idx] = { ...services[idx], ...saved };
    } else {
      // افزودن
      saved = await API.createService({ title, price, image: imageData || null });
      services.push(saved);
    }

    // بروزرسانی کش و لیست
    StorageManager.set('vit_services', services);
    this.renderServicesList();

    // بستن فرم
    UIComponents.closeDrawer('service-drawer');
    UIComponents.showToast('با موفقیت ذخیره شد.', 'success');
  } catch (err) {
    console.error('service save failed', err);
    UIComponents.showToast('خطا در ذخیره روی سرور. دوباره تلاش کنید.', 'error');
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
    initPortfolio() {
        const portfolio = StorageManager.get('vit_portfolio');
        if (!portfolio || portfolio.length === 0) {
            const defaultPortfolio = [
                { id: 1, title: 'موی کوتاه', image: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=300', description: 'اصلاح سر مدرن' },
                { id: 2, title: 'رنگ موی طبیعی', image: 'https://images.unsplash.com/photo-1564460576323-2f03bbfbfe2d?w=300', description: 'رنگ طبیعی و درخشان' },
                { id: 3, title: 'اصلاح ریش فانتزی', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300', description: 'طراحی ریش متنوع' }
            ];
            StorageManager.set('vit_portfolio', defaultPortfolio);
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
        const id = form.dataset.editingId ? parseInt(form.dataset.editingId, 10) : null;
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
        if (id) {
            // Edit existing
            const index = portfolio.findIndex(p => p.id === id);
            if (index !== -1) {
                portfolio[index] = { id, title, image: imageData, description };
                UIComponents.showToast('نمونه‌کار با موفقیت ویرایش شد.', 'success');
            }
        } else {
            // Add new
            const newId = portfolio.length > 0 ? Math.max(...portfolio.map(p => p.id)) + 1 : 1;
            portfolio.push({ id: newId, title, image: imageData, description });
            UIComponents.showToast('نمونه‌کار جدید اضافه شد.', 'success');
        }
        StorageManager.set('vit_portfolio', portfolio);
        this.renderPortfolioList();
        UIComponents.closeDrawer('portfolio-drawer');
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



// === BRAND IMAGES (hero/footer) ===
initBrandImages(){
  // خواندن از localStorage
  const saved = StorageManager.get('vit_brand_images') || {};
  this.brandImages = {
    hero: saved.hero || '',
    footer: saved.footer || ''
  };
  this.applyBrandImages();
  this.bindBrandImageEvents();
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
    'cancelled': 'لغو شده'
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
               data-name="${c.name}" data-phone="${c.phone}">
        <div class="customer-avatar" aria-hidden="true">${c.name.charAt(0)}</div>
        <div class="customer-info">
          <div class="customer-name">${c.name}</div>
          <div class="customer-phone">${UIComponents.formatPersianNumber(c.phone)}</div>
          <div class="customer-last-reservation">آخرین رزرو نوبت: ${UIComponents.formatRelativeDate(c.lastReservation)}</div>
        </div>
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
      cancelled: 'لغو شده'
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
updateDashboardStats() {
  // Count pending bookings
  const pendingCount = MOCK_DATA.bookings.filter(b => b.status === 'pending').length;
  const todayCount = MOCK_DATA.bookings.filter(b => b.status === 'confirmed').length;
  
  // Update pending stat card
  const pendingValue = document.querySelector('.stat-pending .stat-value');
  if (pendingValue) {
    pendingValue.dataset.value = pendingCount;
    pendingValue.textContent = UIComponents.formatPersianNumber(pendingCount);
  }
  
  // Update today's bookings stat card
  const todayValue = document.querySelector('.stat-bookings .stat-value');
  if (todayValue) {
    todayValue.dataset.value = todayCount;
    todayValue.textContent = UIComponents.formatPersianNumber(todayCount);
  }
}





applyBrandImages(){
  // ست کردن CSS custom properties برای استفاده در UI/صفحه عمومی
  const root = document.documentElement;
  root.style.setProperty('--hero-image',  this.brandImages.hero  ? `url("${this.brandImages.hero}")`   : 'none');
  root.style.setProperty('--footer-image',this.brandImages.footer? `url("${this.brandImages.footer}")` : 'none');

  // پیش‌نمایش‌ها داخل تنظیمات
  const heroImg   = document.getElementById('hero-preview');
  const footerImg = document.getElementById('footer-preview');

  if (heroImg) {
    if (this.brandImages.hero) heroImg.src = this.brandImages.hero;
    else heroImg.removeAttribute('src');
  }
  if (footerImg) {
    if (this.brandImages.footer) footerImg.src = this.brandImages.footer;
    else footerImg.removeAttribute('src');
  }
}

bindBrandImageEvents(){
  // دکمه‌ها و ورودی‌ها
  const heroPick   = document.getElementById('hero-pick-btn');
  const heroFile   = document.getElementById('hero-file');
  const heroRemove = document.getElementById('hero-remove-btn');

  const footerPick   = document.getElementById('footer-pick-btn');
  const footerFile   = document.getElementById('footer-file');
  const footerRemove = document.getElementById('footer-remove-btn');

  if (heroPick && heroFile){
    heroPick.addEventListener('click', () => heroFile.click());
    heroFile.addEventListener('change', (e) => this._readFileToDataURL(e, 'hero'));
  }
  if (footerPick && footerFile){
    footerPick.addEventListener('click', () => footerFile.click());
    footerFile.addEventListener('change', (e) => this._readFileToDataURL(e, 'footer'));
  }

  if (heroRemove){
    heroRemove.addEventListener('click', () => this._removeBrandImage('hero'));
  }
  if (footerRemove){
    footerRemove.addEventListener('click', () => this._removeBrandImage('footer'));
  }
}

// Helpers
// Helpers (Brand Images)
_readFileToDataURL(evt, type) {
  const file = evt.target.files && evt.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataURL = reader.result; // base64
    this._storeBrandImage(type, dataURL);
    // اجازه انتخاب دوباره همان فایل
    try { evt.target.value = ''; } catch (_) {}
  };
  reader.onerror = () => {
    UIComponents.showToast('خطا در خواندن فایل تصویر.', 'error');
  };
  reader.readAsDataURL(file);
}

_storeBrandImage(type, dataURL) {
  if (!['hero', 'footer'].includes(type)) return;

  // به‌روزرسانی حالت داخلی
  this.brandImages = {
    ...(this.brandImages || {}),
    [type]: dataURL || ''
  };

  // ذخیره در localStorage
  StorageManager.set('vit_brand_images', { ...this.brandImages });

  // اعمال در UI + پیش‌نمایش
  this.applyBrandImages();

  // پیام موفقیت
  const label = type === 'hero' ? 'هدر' : 'فوتر';
  UIComponents.showToast(`تصویر ${label} ذخیره شد.`, 'success');
}

_removeBrandImage(type) {
  if (!['hero', 'footer'].includes(type)) return;

  this.brandImages = {
    ...(this.brandImages || {}),
    [type]: ''
  };

  StorageManager.set('vit_brand_images', { ...this.brandImages });
  this.applyBrandImages();

  const label = type === 'hero' ? 'هدر' : 'فوتر';
  UIComponents.showToast(`تصویر ${label} حذف شد.`, 'info');
}

  // === END OF NEW METHODS ===
  }

function renderNotifications() {
  const list = document.getElementById('notification-list');
  const badge = document.getElementById('notification-badge');
  const btn = document.getElementById('notification-btn');
  const panel = document.getElementById('notification-panel');
  
  if (!list || !badge || !btn || !panel) return;
  
  const notifications = MOCK_DATA.recentActivity || [];
  
  const icons = {
    review: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    booking: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    customer: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>'
  };
  
  // Render notifications
  if (notifications.length === 0) {
    list.innerHTML = `
      <div class="notification-empty">
        <svg class="notification-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <div>هیچ اعلان جدیدی ندارید</div>
      </div>
    `;
  } else {
    list.innerHTML = notifications.map((item, index) => `
      <li class="notification-item" role="button" tabindex="0" data-index="${index}">
        <div class="notification-icon" aria-hidden="true">${icons[item.type] || icons.booking}</div>
        <div class="notification-content">
          <p class="notification-text">${item.text}</p>
          <time class="notification-time">${item.time}</time>
        </div>
        <button class="notification-delete-btn" aria-label="حذف اعلان" data-index="${index}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </li>
    `).join('');
  }
  
  // Update badge with animation
  updateNotificationBadge(notifications.length);
  
  // Enhanced click handler with badge reset
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    const isOpen = panel.classList.contains('active');
    
    if (isOpen) {
      closeNotificationPanel();
    } else {
      openNotificationPanel();
    }
  });
  
  // Close panel when clicking outside
  document.addEventListener('click', function(e) {
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      closeNotificationPanel();
    }
  });
  
  // Close panel on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && panel.classList.contains('active')) {
      closeNotificationPanel();
      btn.focus();
    }
  });
  
  // Make notification items clickable and handle delete button
  list.addEventListener('click', function(e) {
    const deleteBtn = e.target.closest('.notification-delete-btn');
    const item = e.target.closest('.notification-item');
    
    if (deleteBtn) {
      // Handle delete button click
      e.stopPropagation();
      const index = parseInt(deleteBtn.dataset.index, 10);
      
      // Remove notification from data
      if (index >= 0 && index < MOCK_DATA.recentActivity.length) {
        MOCK_DATA.recentActivity.splice(index, 1);
        
        // Re-render notifications
        renderNotifications();
        
        // Show success message
        if (typeof UIComponents !== 'undefined' && UIComponents.showToast) {
          UIComponents.showToast('اعلان حذف شد', 'success');
        }
      }
    } else if (item) {
      // Handle notification item click
      // Add a subtle click animation
      item.style.transform = 'scale(0.98)';
      setTimeout(() => {
        item.style.transform = '';
      }, 150);
      
      // Here you can add navigation logic based on notification type
      console.log('Notification clicked:', item);
    }
  });
}

function updateNotificationBadge(count) {
  const badge = document.getElementById('notification-badge');
  const btn = document.getElementById('notification-btn');
  
  if (!badge || !btn) return;
  
  if (count > 0) {
    let displayCount;
    let countType = 'normal';
    
    // Smart count display
    if (count > 99) {
      displayCount = '۹۹+';
      countType = 'max';
    } else if (count > 9) {
      displayCount = new Intl.NumberFormat('fa-IR').format(count);
      countType = 'high';
    } else {
      displayCount = new Intl.NumberFormat('fa-IR').format(count);
      countType = 'normal';
    }
    
    // Update badge content and styling
    if (badge.textContent !== displayCount) {
      badge.classList.remove('animate-in');
      badge.textContent = displayCount;
      badge.setAttribute('data-count', countType);
      
      // Trigger entrance animation
      setTimeout(() => {
        badge.classList.add('animate-in');
      }, 10);
    }
    
    btn.classList.add('has-unread');
  } else {
    // Animate badge disappearance
    badge.classList.add('animate-out');
    setTimeout(() => {
      badge.textContent = '';
      badge.removeAttribute('data-count');
      badge.classList.remove('animate-out', 'animate-in');
    }, 400);
    
    btn.classList.remove('has-unread');
  }
}

function openNotificationPanel() {
  const panel = document.getElementById('notification-panel');
  const btn = document.getElementById('notification-btn');
  
  if (!panel || !btn) return;
  
  panel.classList.add('active');
  btn.setAttribute('aria-expanded', 'true');
  
  // Reset badge count when panel opens
  setTimeout(() => {
    updateNotificationBadge(0);
    // Mark notifications as read in your data store here
    // MOCK_DATA.recentActivity = [];
  }, 500);
  
  // Focus management for accessibility
  const firstFocusable = panel.querySelector('.notification-item');
  if (firstFocusable) {
    firstFocusable.focus();
  }
}

function closeNotificationPanel() {
  const panel = document.getElementById('notification-panel');
  const btn = document.getElementById('notification-btn');
  
  if (!panel || !btn) return;
  
  panel.classList.remove('active');
  btn.setAttribute('aria-expanded', 'false');
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

  // Run the App
  const app = new SellerPanelApp();
  app.init();
  if (typeof app.initBrandImages === 'function') app.initBrandImages();
  renderNotifications();


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
  const KEY = 'vit_resv_schedule';



  

  const faDigits = '۰۱۲۳۴۵۶۷۸۹', enDigits = '0123456789';
  const toFa = (s) => (s + '').replace(/[0-9]/g, (d) => faDigits[d]);
  const toEn = (s) => (s + '').replace(/[۰-۹]/g, (d) => enDigits[faDigits.indexOf(d)]);
  const pad2 = (n) => String(n).padStart(2, '0');
  const normalizeTime = (t) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(toEn((t || '').trim()));
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
    return `${pad2(h)}:${pad2(mi)}`;
  };
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


  // state + storage
 const state = { selectedIdx: 0, schedule: load() };
// Clean any old data format on load
  function load() {
    const def = { '6': [], '0': [], '1': [], '2': [], '3': [], '4': [], '5': [] };
    try { return Object.assign(def, StorageManager.get(KEY) || {}); } catch { return def; }
  }
  function save() { StorageManager.set(KEY, state.schedule); }

  // open modal
  function openModal() {
    UIComponents.openModal('resv-modal');
    updateTodayBanner();
    scheduleMidnightTick();
    // Select today's weekday by default
    const todayJS = new Date().getDay();
    const idx = PERSIAN_WEEKDAYS.findIndex((w) => w.js === todayJS);
    selectDay(Math.max(0, idx));
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


  // compute slot status from MOCK_DATA + CustomerPrefs (فقط برای نمایش؛ در ذخیره‌سازی وضعیت نداریم)
  function getTimeSlotStatus(time) {
    const bookings = (window.MOCK_DATA?.bookings || []);
    const prefs = window.CustomerPrefs ? CustomerPrefs.load() : {};
    const keyFor = (name) => (window.normalizeKey ? normalizeKey(name) : (name||'').toLowerCase());

    const sameTime = bookings.filter(b => normalizeTime(toEn(b.time)) === normalizeTime(time));
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
  function renderTimes() {
    const wrap = el('resv-times');
    const dayKey = String(PERSIAN_WEEKDAYS[state.selectedIdx].js);
    const times = [...(state.schedule[dayKey] || [])].sort();

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
      const st = getTimeSlotStatus(t);
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

    const st = getTimeSlotStatus(t);
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

// Call the cleaning function once after state is loaded (add this line after state = { ... })
setTimeout(() => cleanScheduleData(), 100);


  // --- Force 24h input if environment is 12h (AM/PM)
  function enforce24hTimeInput() {
    const input = el('resv-time-input');
    if (!input) return;

    const sample = new Date().toLocaleTimeString(undefined, { hour: 'numeric' });
    const is12h = /AM|PM|am|pm|قبل|بعد|ظهر|عصر/.test(sample);

    if (is12h) {
      input.type = 'text';
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('pattern', '^([01]\\d|2[0-3]):([0-5]\\d)$');
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
    }
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
    el('resv-save')?.addEventListener('click', () => { save(); UIComponents.showToast('ذخیره شد.', 'success'); });

    // ورودی ۲۴ساعته
    enforce24hTimeInput();
  })();
})();





  // === Plan Hero: data + wiring ===
  (function(){
    // نمونه داده — هر وقت لازم شد از سرور پرش کن
    const plan = {
      tier: 'پرمیوم',          // پایه / حرفه‌ای / پرمیوم
      start: '2025-08-01',     // ISO
      end:   '2025-09-12',     // ISO
      perks: ['نمایش ویژه','ابزارهای حرفه‌ای','پشتیبانی سریع']
    };

    const el = (id)=>document.getElementById(id);
    const days = (a,b)=> Math.round((b-a)/86400000);
    const now   = new Date();
    const start = new Date(plan.start);
    const end   = new Date(plan.end);

    const totalDays = Math.max(days(start, end), 0);
    const usedDays  = Math.min(Math.max(days(start, now), 0), totalDays);
    const leftDays  = Math.max(totalDays - usedDays, 0);
    const progress  = totalDays ? Math.round((usedDays/totalDays)*100) : 0;

    const faNum = (n)=> new Intl.NumberFormat('fa-IR').format(n);
    const faDate= (d)=> new Intl.DateTimeFormat('fa-IR-u-nu-latn-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit'}).format(d);

    // پر کردن UI
    if (el('plan-tier')) el('plan-tier').textContent = `🎖 ${plan.tier}`;
    if (el('plan-days-left')) el('plan-days-left').textContent = `${faNum(leftDays)} روز`;
    if (el('plan-expiry')) el('plan-expiry').textContent = faDate(end);
    if (el('plan-progress-bar')) el('plan-progress-bar').style.width = progress + '%';
    if (el('plan-used')) el('plan-used').textContent = progress + '%';
    if (el('plan-left')) el('plan-left').textContent = (100 - progress) + '%';

    // دکمه‌ها
    const goPlans = ()=>{ window.location.hash = '/plans'; };

    el('plan-renew-btn')?.addEventListener('click', goPlans);
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


window.customersData = window.customersData || [
  { id: 'demo-eligible', name: 'علی', reservations: 3, vipCurrent: 3, vipRequired: 3, rewardCount: 0 },
  { id: 'demo-oneaway', name: 'مریم', reservations: 2, vipCurrent: 2, vipRequired: 3, rewardCount: 0 },
  { id: 'demo-claimed', name: 'رضا', reservations: 4, vipCurrent: 3, vipRequired: 3, rewardCount: 1 }
];

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

    const all = collectCustomers();
    const buckets = computeBuckets(all);
    renderCounts(buckets);

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

    // اگر دیتایی نداریم، پنل را غیرفعال نکن—اما نوار را نگه دار
  }

  document.addEventListener('DOMContentLoaded', initVipUI);
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





document.addEventListener('DOMContentLoaded', function() {
  const clearAllBtn = document.getElementById('notif-clear-all');
  const notificationList = document.getElementById('notification-list');
  const notificationBadge = document.getElementById('notification-badge');
  
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', function() {
      // Clear all notifications from the UI
      if (notificationList) {
        // Check if there are notifications to clear
        const hasNotifications = notificationList.children.length > 0 && 
                               !notificationList.querySelector('.notification-empty');
        
        if (hasNotifications) {
          // Create empty state
          notificationList.innerHTML = `
            <div class="notification-empty">
              <svg class="notification-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <div>هیچ اعلان جدیدی ندارید</div>
            </div>
          `;
          
          // Update notification badge
          if (notificationBadge) {
            notificationBadge.textContent = '';
            notificationBadge.classList.remove('animate-in');
            notificationBadge.setAttribute('data-count', '0');
            
            // Add animation effect
            setTimeout(() => {
              notificationBadge.classList.add('animate-out');
              setTimeout(() => {
                notificationBadge.classList.remove('animate-out');
              }, 400);
            }, 10);
          }
          
          // Show success message
          if (typeof UIComponents !== 'undefined' && UIComponents.showToast) {
            UIComponents.showToast('تمام اعلان‌ها حذف شدند', 'success');
          }
        } else {
          // Show message that there are no notifications to clear
          if (typeof UIComponents !== 'undefined' && UIComponents.showToast) {
            UIComponents.showToast('هیچ اعلانی برای حذف وجود ندارد', 'info');
          }
        }
      }
    });
  }
});
