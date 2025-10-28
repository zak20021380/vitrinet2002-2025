async function getShopUrlFromLocation() {
  const API_ROOT = window.__API_BASE__ || '';
  const u = new URL(location.href);
  const q = u.searchParams.get('shopurl');
  if (q) return q.trim();

  const sid = u.searchParams.get('sellerId');
  if (!sid) return '';

  try {
    const res = await fetch(`${API_ROOT}/api/shopAppearance/${encodeURIComponent(sid)}`);
    if (!res.ok) throw new Error('appearance not found');
    const data = await res.json();
    return data.customUrl ? data.customUrl.trim() : '';
  } catch (err) {
    console.error('get shopurl by sellerId failed', err);
    return '';
  }
}

(() => {
  const API_ROOT = (window.__API_BASE__ || '').replace(/\/$/, '');
  const overlay = document.getElementById('shop-blocked-overlay');
  const messageEl = document.getElementById('shop-blocked-message');
  const metaEl = document.getElementById('shop-blocked-meta');
  const refreshBtn = document.getElementById('shop-blocked-refresh');
  const banner = document.getElementById('shop-moderation-banner');
  const bannerText = document.getElementById('shop-moderation-banner-text');
  const bannerClose = document.querySelector('[data-dismiss="shop-moderation-banner"]');
  const STORAGE_PREFIX = 'vt:shop-moderation:';
  let identifiers = { slug: '', sellerId: '' };

  const formatDateTime = (value) => {
    if (!value) return '';
    try {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    } catch (err) {
      console.warn('formatDateTime failed', err);
      return '';
    }
  };

  const buildKey = (ids = identifiers) => {
    if (ids.slug) return `${STORAGE_PREFIX}slug:${ids.slug.toLowerCase()}`;
    if (ids.sellerId) return `${STORAGE_PREFIX}seller:${ids.sellerId}`;
    return `${STORAGE_PREFIX}global`;
  };

  const readStored = (ids = identifiers) => {
    try {
      const raw = localStorage.getItem(buildKey(ids));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('readStored moderation failed', err);
      return null;
    }
  };

  const persistState = (state, ids = identifiers) => {
    try {
      localStorage.setItem(buildKey(ids), JSON.stringify({
        isBlocked: !!state?.isBlocked,
        reason: state?.reason || '',
        blockedAt: state?.blockedAt || state?.moderation?.blockedAt || null,
        unblockedAt: state?.unblockedAt || state?.moderation?.unblockedAt || null,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.warn('persist moderation failed', err);
    }
  };

  const renderMeta = (info) => {
    if (!metaEl) return;
    const parts = [];
    const blockedAt = formatDateTime(info?.blockedAt || info?.moderation?.blockedAt);
    if (blockedAt) {
      parts.push(`<span>مسدود شده از ${blockedAt}</span>`);
    }
    const reason = (info?.reason || info?.moderation?.reason || '').trim();
    if (reason) {
      parts.push(`<span>${reason}</span>`);
    } else {
      parts.push('<span>برای پیگیری با پشتیبانی ویترینت تماس بگیرید.</span>');
    }
    const reviewed = formatDateTime(info?.moderation?.unblockedAt || info?.shop?.lastReviewedAt);
    if (reviewed) {
      parts.push(`<span>آخرین بررسی: ${reviewed}</span>`);
    }
    metaEl.innerHTML = parts.join('');
  };

  const showBanner = (info) => {
    if (!banner) return;
    const text = info?.moderation?.unblockedAt
      ? `آخرین بازبینی در ${formatDateTime(info.moderation.unblockedAt)}`
      : info?.unblockedAt
        ? `آخرین بازبینی در ${formatDateTime(info.unblockedAt)}`
        : 'این فروشگاه دوباره فعال شده است.';
    if (bannerText) {
      bannerText.textContent = text;
    }
    banner.removeAttribute('hidden');
  };

  const hideBanner = () => {
    if (banner) {
      banner.setAttribute('hidden', '');
    }
  };

  const applyState = (info) => {
    if (!info) return;
    const previous = readStored();
    if (info.isBlocked) {
      document.body.dataset.shopBlocked = 'true';
      overlay?.removeAttribute('hidden');
      if (messageEl) {
        const reason = (info.reason || '').trim();
        messageEl.textContent = reason
          ? `به دلیل «${reason}» نمایش این فروشگاه موقتاً متوقف شده است.`
          : 'برای حفظ کیفیت خدمات، نمایش این فروشگاه موقتاً متوقف شده است.';
      }
      renderMeta(info);
      hideBanner();
    } else {
      delete document.body.dataset.shopBlocked;
      overlay?.setAttribute('hidden', '');
      if (previous?.isBlocked) {
        showBanner(info);
      } else {
        hideBanner();
      }
    }
    persistState(info);
  };

  const resolveIdentifiers = async () => {
    const slugFromBody = (document.body?.dataset?.shopurl || '').trim();
    const sellerId = (document.body?.dataset?.sellerId || '').trim();
    let slug = slugFromBody;
    if (!slug && typeof getShopUrlFromLocation === 'function') {
      try {
        slug = await getShopUrlFromLocation();
      } catch (err) {
        console.warn('resolve shop url failed', err);
      }
    }
    identifiers = { slug: slug || '', sellerId };
    return identifiers;
  };

  const fetchStatus = async () => {
    try {
      const ids = identifiers.slug || identifiers.sellerId ? identifiers : await resolveIdentifiers();
      let url = '';
      if (ids.slug) {
        url = `${API_ROOT}/api/service-shops/status/by-shopurl/${encodeURIComponent(ids.slug)}`;
      } else if (ids.sellerId && /^[0-9a-fA-F]{24}$/.test(ids.sellerId)) {
        url = `${API_ROOT}/api/service-shops/status/by-seller/${encodeURIComponent(ids.sellerId)}`;
      }
      if (!url) {
        return null;
      }
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`moderation status failed: ${res.status}`);
      }
      const data = await res.json();
      applyState(data);
      return data;
    } catch (err) {
      console.error('fetchPublicModeration error', err);
      return null;
    }
  };

  const handleRefresh = async () => {
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.classList.add('is-loading');
    }
    await fetchStatus();
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove('is-loading');
    }
  };

  if (refreshBtn) {
    refreshBtn.addEventListener('click', (event) => {
      event.preventDefault();
      handleRefresh();
    });
  }

  if (bannerClose) {
    bannerClose.addEventListener('click', () => hideBanner());
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await resolveIdentifiers();
    const cached = readStored();
    if (cached) {
      applyState(cached);
    }
    await fetchStatus();
  });
})();

function showToastDark(message, {type='success', durationMs=2600} = {}) {
  const icons = {
    success: 'fas fa-check',
    info: 'fas fa-info-circle',
    error: 'fas fa-exclamation-circle'
  };
  const existing = document.getElementById('dark-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'dark-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.dir = 'ltr';
  toast.className = 'fixed left-1/2 -translate-x-1/2 bottom-[max(16px,env(safe-area-inset-bottom))] z-[160] bg-black text-white rounded-xl px-4 py-3 shadow-lg ring-1 ring-white/20 flex items-center gap-3 opacity-0 translate-y-2 transition-all duration-200 max-w-[92vw] sm:max-w-md';
  const icon = document.createElement('i');
  icon.className = icons[type] || icons.info;
  const msg = document.createElement('span');
  msg.textContent = message;
  msg.className = 'flex-1';
  msg.dir = 'rtl';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.className = 'text-xl leading-none';
  toast.append(icon, msg, closeBtn);
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
  });
  function removeToast() {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 200);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') removeToast();
  }
  document.addEventListener('keydown', onKey);
  toast.addEventListener('click', removeToast);
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeToast(); });
  setTimeout(removeToast, durationMs);
}

(() => {
  // ====== Sticky header + toast ======
  const header = document.getElementById('main-header');
  const toast  = document.getElementById('headerToast');

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('opacity-0');
    toast.classList.add('opacity-100');
    setTimeout(() => {
      toast.classList.add('opacity-0');
      toast.classList.remove('opacity-100');
    }, 2500);
  }

  // Header shadow on scroll
  window.addEventListener('scroll', () => {
    if (!header) return;
    if (window.scrollY > 10) {
      header.classList.add('shadow-lg');
    } else {
      header.classList.remove('shadow-lg');
    }
  });

  // Mobile top compact/expand
  const mobileTop   = document.getElementById('mobile-top');
  const mobileChips = document.getElementById('mobile-chips');
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    if (!mobileTop || !mobileChips) return;
    if (window.innerWidth > 768) return;
    if (window.scrollY > lastY && window.scrollY > 20) {
      mobileTop.classList.remove('py-3');
      mobileTop.classList.add('py-2');
      mobileChips.classList.add('hidden');
    } else {
      mobileTop.classList.add('py-3');
      mobileTop.classList.remove('py-2');
      mobileChips.classList.remove('hidden');
    }
    lastY = window.scrollY;
  });

  // ====== Unified modal system (for both mobile & desktop) ======
  const modalCache = new Map();

  function setupModal(modal) {
    const card = modal.querySelector('.modal-card');
    const closeEls = modal.querySelectorAll('[data-close]');
    let lastFocused = null;
    let prevOverflow = '';

    const focusableSelector = 'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

    function open() {
      lastFocused = document.activeElement;
      prevOverflow = document.body.style.overflow || '';
      document.body.style.overflow = 'hidden';

      modal.classList.remove('hidden');
      modal.classList.add('flex'); // اگه کلاس flex تو HTML نباشه، اینجا تضمین می‌کنیم
      requestAnimationFrame(() => {
        card.classList.remove('scale-95','opacity-0');
        card.classList.add('scale-100','opacity-100');
        const firstFocusable = card.querySelector(focusableSelector);
        if (firstFocusable) firstFocusable.focus();
      });

      document.addEventListener('keydown', trap);
    }

    function close() {
      card.classList.add('scale-95','opacity-0');
      card.classList.remove('scale-100','opacity-100');

      setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.removeEventListener('keydown', trap);
        document.body.style.overflow = prevOverflow;
        if (lastFocused) lastFocused.focus();
      }, 180);
    }

    function trap(e) {
      if (e.key === 'Escape') return close();
      if (e.key !== 'Tab') return;
      const f = card.querySelectorAll(focusableSelector);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }

    // Close via elements with data-close
    closeEls.forEach(el => el.addEventListener('click', close));
    // Close when clicking outside the card
    modal.addEventListener('click', (e) => {
      if (!card.contains(e.target)) close();
    });

    return { open, close };
  }

  function bindTriggers() {
    document.querySelectorAll('[data-open]').forEach(btn => {
      const id = btn.getAttribute('data-open');
      const modal = document.getElementById(id);
      if (!modal) return;
      if (!modalCache.has(id)) modalCache.set(id, setupModal(modal));
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        modalCache.get(id).open();
      });
    });
  }
  bindTriggers();

  window.openModalById = function(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    const cached = modalCache.get(id) || setupModal(modal);
    modalCache.set(id, cached);
    cached.open();
  };

  // ====== Address copy ======
  const addressCopyBtn = document.getElementById('address-copy-btn');
  const fullAddressEl  = document.getElementById('full-address');
  if (addressCopyBtn && fullAddressEl) {
    addressCopyBtn.addEventListener('click', () => {
      const txt = (fullAddressEl.textContent || '').trim();
      if (!txt) return;
      navigator.clipboard.writeText(txt).then(() => showToastDark('آدرس کپی شد', {type:'success'}));
    });
  }

  // ====== Report form + counter ======
  const reportModal   = document.getElementById('reportModal');
  const reportForm    = document.getElementById('report-form');
  const reportText    = document.getElementById('report-text');
  const reportCounter = document.getElementById('report-counter');

  if (reportText && reportCounter) {
    const updateCounter = () => {
      const len = reportText.value.length;
      reportCounter.textContent = `${len.toLocaleString('fa-IR')}/۵۰۰`;
    };
    reportText.addEventListener('input', updateCounter);
    updateCounter();
  }

  if (reportForm && reportModal) {
    const inst = modalCache.get('reportModal') || setupModal(reportModal);
    modalCache.set('reportModal', inst);
    reportForm.addEventListener('submit', (e) => {
      e.preventDefault();
      inst.close();
      showToastDark('گزارش شما ثبت شد', {type:'success'});
      reportForm.reset();
      if (reportCounter) reportCounter.textContent = '۰/۵۰۰';
    });
  }

  // ================== Booking Gate (prevent booking when previous is pending) ==================
  (function(){
    const KEY_LAST = 'vt:lastBooking';

    function readLast(){
      try { return JSON.parse(localStorage.getItem(KEY_LAST) || 'null'); } catch(e){ return null; }
    }
    function saveLast(obj){ localStorage.setItem(KEY_LAST, JSON.stringify(obj)); }
// نسخهٔ اصلاح‌شدهٔ hasPending با نرمال‌سازی وضعیت‌ها و پارامترهای بیشتر کوئری
async function hasPending(){
  const b = readLast();
  // If no pending booking, exit
  if (!b || b.status !== 'pending') return false;

  const base = window.__API_BASE__ || '';

  // Enhanced status normalization to catch more variations
  const normalize = (s) => {
    s = String(s || '').toLowerCase().trim();
    // Add more confirmed status variations
    if (['confirmed','approve','approved','accept','accepted','done','completed','success','ok','تایید','تایید شده','موفق'].includes(s)) return 'confirmed';
    if (['rejected','declined','canceled','cancelled','failed','no-show','noshow','رد','لغو','لغو شده'].includes(s)) return 'rejected';
    if (['pending','waiting','awaiting','in-review','در انتظار','منتظر'].includes(s)) return 'pending';
    
    // Log unknown statuses for debugging
    console.log('[hasPending] Unknown status:', s);
    return s || 'pending';
  };

  try {
    // Send all available identifiers for better matching
    const params = new URLSearchParams({
      phone: b.phone || '',
      ...(b.id && {id: b.id}),
      ...(b.sellerId && {sellerId: b.sellerId}),
      ...(b.bookingId && {bookingId: b.bookingId}),
      ...(b.date && {date: b.date}),
      ...(b.time && {time: b.time})
    });

    const res = await fetch(`${base}/api/bookings/status?${params.toString()}`, { 
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(window.getToken && window.getToken() ? {'Authorization': 'Bearer ' + window.getToken()} : {})
      }
    });

    if (res.ok) {
      const data = await res.json();
      
      // Try multiple status field names
      const raw = data.status || data.state || data.bookingStatus || data.booking?.status || data.result?.status;
      const norm = normalize(raw);
      
      console.log('[hasPending] Status check:', { raw, normalized: norm, data });

      // If status changed from pending
      if (norm !== 'pending') {
        const next = {
          ...b,
          status: norm,
          resolvedAt: Date.now(),
          bookingId: data.id || data._id || data.bookingId || b.bookingId,
          // Preserve all booking details for loyalty system
          service: b.service,
          date: b.date,
          time: b.time,
          phone: b.phone,
          sellerId: b.sellerId || data.sellerId,
          shopUrl: b.shopUrl
        };
        saveLast(next);

        // Immediately sync loyalty progress for this confirmed booking
        if (typeof syncFromConfirmedBooking === 'function') {
          syncFromConfirmedBooking('status-change', next);
        }

        // Dispatch event for loyalty system
        window.dispatchEvent(new CustomEvent('booking:status', {
          detail: {
            id: next.id,
            status: norm,
            phone: next.phone,
            sellerId: next.sellerId,
            shopUrl: next.shopUrl,
            bookingId: next.bookingId,
            service: next.service
          }
        }));

        console.log('[hasPending] Booking confirmed, event dispatched:', next);
        return false; // No longer pending
      }

      // Still pending
      return true;
    }
  } catch (err) {
    console.warn('[hasPending] Check failed:', err);
  }

  // On network error, conservatively assume still pending
  return true;
}

    function fillBlockedModal(){
      const b = readLast(); if (!b) return;
      const $ = id => document.getElementById(id);
      $('pblk-service') && ( $('pblk-service').textContent = b.service || '' );
      $('pblk-date')    && ( $('pblk-date').textContent    = b.date    || '' );
      $('pblk-time')    && ( $('pblk-time').textContent    = b.time    || '' );
      $('pblk-created') && ( $('pblk-created').textContent = new Date(b.createdAt).toLocaleString('fa-IR') );
    }

    // بازکننده ویزارد با چک «pending»
    async function openBookingWizard(prefill){
      if (await hasPending()) {
        fillBlockedModal();
        if (typeof window.openModalById === 'function') window.openModalById('pendingBlockModal');
        return false;
      }
      const wiz = document.getElementById('booking-wizard');
      if (!wiz) return false;
      if (wiz.classList.contains('hidden')) wiz.classList.remove('hidden');

      // پیش‌انتخاب خدمت اگر از کارت خدمات اومدیم
      if (prefill && prefill.service) {
        document.querySelectorAll('#step-1 .service-option').forEach(opt => {
          const match = opt.dataset.service === prefill.service;
          opt.classList.toggle('bw-selected', match);
          if (match) opt.dispatchEvent(new Event('click'));
        });
      }

      const top = wiz.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
      return true;
    }

    // اکسپورت‌ها
    window.__BOOKING_GUARD__ = { hasPending, readLast, saveLast, openBookingWizard };
    window.hasPendingBooking = hasPending;
    window.openBookingWizard = openBookingWizard;
    window.clearPendingBooking = function(){ localStorage.removeItem(KEY_LAST); };

    // اتصال دکمه‌های صفحه بعد از آماده‌شدن DOM
    document.addEventListener('DOMContentLoaded', () => {
      // CTA هیرو
      const hero = document.getElementById('hero-cta');
      if (hero) hero.addEventListener('click', (e) => { e.preventDefault(); openBookingWizard(); });

      // دکمه‌های «رزرو» روی کارت خدمات
      document.querySelectorAll('.service-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          openBookingWizard({ service: btn.dataset.service, price: btn.dataset.price });
        });
      });
    });
  })();
  // ================== /Booking Gate ==================

})();

(() => {
  const API_ROOT = (window.__API_BASE__ || '').replace(/\/$/, '');
  const DIGITS_FA = '۰۱۲۳۴۵۶۷۸۹';

  const qAll = (selector) => Array.from(document.querySelectorAll(selector));
  const toFa = (value) => String(value ?? 0).replace(/\d/g, d => DIGITS_FA[d]);

  const toEn = (value = '') => String(value || '')
    .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 1632));

  const normalisePhone = (value = '') => {
    let raw = toEn(value).replace(/[\s\-()]/g, '');
    if (!raw) return '';

    if (raw.startsWith('+')) {
      raw = raw.slice(1);
    }

    raw = raw.replace(/[^0-9]/g, '');
    if (!raw) return '';

    if (raw.startsWith('0098')) {
      raw = raw.slice(4);
    }

    if (raw.startsWith('98') && raw.length === 12) {
      raw = raw.slice(2);
    }

    if (raw.length === 10 && raw.startsWith('9')) {
      raw = `0${raw}`;
    }

    if (raw.length === 11 && !raw.startsWith('0')) {
      raw = `0${raw.slice(-10)}`;
    }

    return raw;
  };

  const showToast = (message, type = 'info') => {
    if (typeof window.showToastDark === 'function') {
      window.showToastDark(message, { type, durationMs: 2800 });
    } else {
      console[type === 'error' ? 'error' : 'log'](message);
    }
  };

  const state = {
    sellerId: null,
    count: 0,
    isFollower: false,
    hasBooking: false,
    loading: false,
    bookingPhone: ''
  };

  const sectionEls = qAll('[data-customer-section]');
  const countEls = qAll('[data-customer-count]');
  const followButtons = qAll('[data-customer-follow]');
  const bookingModal = document.getElementById('booking-reminder-modal');
  const bookingModalBackdrop = bookingModal?.querySelector('[data-modal-backdrop]') || null;
  const bookingModalCard = bookingModal?.querySelector('[data-modal-card]') || null;
  const bookingModalCTA = bookingModal?.querySelector('[data-booking-cta]') || null;
  const bookingModalCloseEls = bookingModal ? Array.from(bookingModal.querySelectorAll('[data-modal-close]')) : [];
  let bookingModalTimer = null;

  const isBookingModalOpen = () => !!(bookingModal && !bookingModal.classList.contains('hidden'));

  const openBookingReminder = () => {
    if (!bookingModal) {
      showToast('برای دنبال کردن، ابتدا یک نوبت رزرو کنید.', 'info');
      return;
    }

    if (bookingModalTimer) {
      clearTimeout(bookingModalTimer);
      bookingModalTimer = null;
    }

    bookingModal.classList.remove('hidden');
    bookingModal.classList.add('flex');

    requestAnimationFrame(() => {
      if (bookingModalBackdrop) {
        bookingModalBackdrop.classList.add('opacity-100');
        bookingModalBackdrop.classList.remove('opacity-0');
      }
      if (bookingModalCard) {
        bookingModalCard.classList.remove('opacity-0', 'translate-y-4', 'scale-95');
        bookingModalCard.classList.add('opacity-100', 'translate-y-0', 'scale-100');
      }
    });
  };

  const closeBookingReminder = () => {
    if (!bookingModal || bookingModal.classList.contains('hidden')) return;

    if (bookingModalBackdrop) {
      bookingModalBackdrop.classList.add('opacity-0');
      bookingModalBackdrop.classList.remove('opacity-100');
    }

    if (bookingModalCard) {
      bookingModalCard.classList.add('opacity-0', 'translate-y-4', 'scale-95');
      bookingModalCard.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
    }

    if (bookingModalTimer) {
      clearTimeout(bookingModalTimer);
    }

    bookingModalTimer = window.setTimeout(() => {
      bookingModal.classList.add('hidden');
      bookingModal.classList.remove('flex');
      bookingModalTimer = null;
    }, 220);
  };

  const handleModalKeydown = (event) => {
    if (event.key === 'Escape' && isBookingModalOpen()) {
      closeBookingReminder();
    }
  };

  const ensureBaseClasses = (btn) => {
    if (!btn.dataset.baseClasses) {
      btn.dataset.baseClasses = btn.className;
    }
  };

  const applyButtonVariant = (btn, variant) => {
    ensureBaseClasses(btn);
    const base = btn.dataset.baseClasses || '';
    const variants = {
      follow: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100',
      following: 'bg-emerald-500 text-white hover:bg-emerald-600 border border-emerald-500',
      booking: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200',
      loading: 'bg-slate-200 text-slate-500 border border-slate-200 cursor-wait'
    };
    btn.className = `${base} ${variants[variant] || ''}`.trim();
  };

  const getSellerId = () => {
    const id = document.body?.dataset?.sellerId || window.LAST_PUBLIC?.sellerId || '';
    return /^[0-9a-fA-F]{24}$/.test(id) ? id : '';
  };

  const readLastBooking = () => {
    try {
      return JSON.parse(localStorage.getItem('vt:lastBooking') || 'null');
    } catch (_) {
      return null;
    }
  };

  const getBookingForSeller = (sellerId) => {
    if (!sellerId) return null;
    const booking = readLastBooking();
    if (!booking) return null;
    if (booking.sellerId && booking.sellerId !== sellerId) return null;
    return booking;
  };

  const updateUI = () => {
    countEls.forEach(el => {
      el.textContent = toFa(state.count);
    });

    sectionEls.forEach(section => {
      if (!section) return;
      section.classList.toggle('opacity-60', !state.isFollower && !state.hasBooking);
    });

    followButtons.forEach(btn => {
      if (!btn) return;
      const variant = state.loading
        ? 'loading'
        : state.isFollower
          ? 'following'
          : state.hasBooking
            ? 'follow'
            : 'booking';
      applyButtonVariant(btn, variant);

      const label = state.loading
        ? 'در حال پردازش...'
        : state.isFollower
          ? 'دنبال شد'
          : 'دنبال کردن';
      btn.textContent = label;
      btn.disabled = state.loading || state.isFollower;
      btn.setAttribute('aria-pressed', state.isFollower ? 'true' : 'false');
      btn.dataset.needsBooking = (!state.hasBooking && !state.isFollower) ? '1' : '0';
    });
  };

  const buildStatsUrl = (sellerId, phone) => {
    const params = new URLSearchParams();
    if (phone) params.set('phone', phone);
    const qs = params.toString();
    return `${API_ROOT}/api/service-shops/${encodeURIComponent(sellerId)}/customers${qs ? `?${qs}` : ''}`;
  };

  const fetchStats = async () => {
    if (!state.sellerId) return;
    const booking = getBookingForSeller(state.sellerId);
    const phone = booking?.phone ? normalisePhone(booking.phone) : '';

    try {
      const res = await fetch(buildStatsUrl(state.sellerId, phone), { credentials: 'include' });
      if (!res.ok) {
        throw new Error('خطا در دریافت اطلاعات مشتریان.');
      }
      const data = await res.json();
      state.count = Number(data.totalCustomers || 0);
      state.isFollower = !!data.isFollower;
      state.hasBooking = !!data.hasBooking || state.isFollower || !!phone;
      if (phone) state.bookingPhone = phone;
    } catch (err) {
      console.warn('fetchStats error:', err);
    } finally {
      updateUI();
    }
  };

  const syncBookingState = (options = {}) => {
    if (!state.sellerId) return;
    const booking = getBookingForSeller(state.sellerId);
    const phone = booking?.phone ? normalisePhone(booking.phone) : '';
    const phoneChanged = phone && phone !== state.bookingPhone;

    state.hasBooking = !!phone || state.isFollower;
    if (phone) {
      state.bookingPhone = phone;
    }
    updateUI();

    if (!options.skipFetch && (phoneChanged || options.forceRefresh)) {
      fetchStats();
    }
  };

  const attemptInit = () => {
    const sellerId = getSellerId();
    if (!sellerId) {
      updateUI();
      return;
    }

    const sellerChanged = sellerId !== state.sellerId;
    if (sellerChanged) {
      state.sellerId = sellerId;
      state.count = 0;
      state.isFollower = false;
      state.hasBooking = false;
      state.bookingPhone = '';
      updateUI();
    }

    fetchStats();
  };

  const handleFollow = async (event) => {
    event.preventDefault();
    if (!state.sellerId || state.loading) return;

    const booking = getBookingForSeller(state.sellerId);
    const phone = booking?.phone ? normalisePhone(booking.phone) : state.bookingPhone;

    if (!state.isFollower && !phone) {
      openBookingReminder();
      return;
    }

    if (state.isFollower) {
      showToast('شما قبلاً به مشتریان این مغازه اضافه شده‌اید.', 'info');
      return;
    }

    state.loading = true;
    updateUI();

    try {
      const payload = {
        customerPhone: phone,
        customerName: booking?.name || booking?.customerName || ''
      };

      const res = await fetch(`${API_ROOT}/api/service-shops/${encodeURIComponent(state.sellerId)}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'ثبت دنبال کردن با خطا مواجه شد.');
      }

      state.count = Number(data.totalCustomers || state.count);
      state.isFollower = true;
      state.hasBooking = true;
      state.loading = false;
      updateUI();
      showToast('شما به مشتریان این مغازه اضافه شدید.', 'success');
    } catch (err) {
      state.loading = false;
      updateUI();
      showToast(err.message || 'خطا در ثبت درخواست.', 'error');
    }
  };

  const watchBookingChanges = () => {
    window.addEventListener('storage', (event) => {
      if (event.key === 'vt:lastBooking') {
        syncBookingState({ forceRefresh: true });
      }
    });

    window.addEventListener('booking:status', () => {
      syncBookingState({ forceRefresh: true });
    });
  };

  const init = () => {
    followButtons.forEach(btn => {
      if (!btn) return;
      ensureBaseClasses(btn);
      btn.addEventListener('click', handleFollow);
    });

    if (bookingModal) {
      bookingModal.addEventListener('click', (event) => {
        if (event.target === bookingModal) {
          closeBookingReminder();
        }
      });
    }

    bookingModalCloseEls.forEach(el => {
      el.addEventListener('click', (event) => {
        event.preventDefault();
        closeBookingReminder();
      });
    });

    if (bookingModalCTA) {
      bookingModalCTA.addEventListener('click', (event) => {
        event.preventDefault();
        closeBookingReminder();
        if (typeof window.openBookingWizard === 'function') {
          window.openBookingWizard();
        } else {
          showToast('برای رزرو نوبت لطفاً با فروشگاه تماس بگیرید.', 'info');
        }
      });
    }

    document.addEventListener('keydown', handleModalKeydown);

    updateUI();
    attemptInit();
    syncBookingState({ skipFetch: true });
    watchBookingChanges();
  };

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('services:loaded', () => {
    attemptInit();
    syncBookingState();
  });
})();

var HAS_BOOKED_BEFORE = false;

(() => {
  'use strict';

  const SafeSS = {
    setJSON(key, value, opts = {}) {
      const str = JSON.stringify(value);
      if (str.length > 500 * 1024) return false;
      try { sessionStorage.setItem(key, str); return true; }
      catch (e) {
        if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
          const prefix = /^vt:(?:cache|logs|tmp):/;
          const items = [];
          for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (prefix.test(k)) {
              const v = sessionStorage.getItem(k) || '';
              items.push({ key: k, size: v.length });
            }
          }
          items.sort((a, b) => b.size - a.size);
          for (const it of items) sessionStorage.removeItem(it.key);
          try { sessionStorage.setItem(key, str); return true; }
          catch (e2) { console.warn('SafeSS quota exceeded', e2); return false; }
        }
        console.warn('SafeSS setJSON failed', e);
        return false;
      }
    },
    getJSON(key, fallback = null) {
      try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
      catch { return fallback; }
    }
  };
  function auditSessionStorage() {
    const rows = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      const v = sessionStorage.getItem(k) || '';
      rows.push({ key: k, bytes: v.length });
    }
    rows.sort((a, b) => b.bytes - a.bytes);
    console.table(rows);
  }
  window.SafeSS = SafeSS;
  window.auditSessionStorage = auditSessionStorage;

  // ===== Helpers
  const API_ROOT = window.__API_BASE__ || '';
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const toEn = s => (s||'')
    .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
    .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
  const toFa = s => (s||'').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d,10)]);
  const normalizeTime = t => {
    const [h='00', m='00'] = toEn(String(t||'')).split(':');
    return `${h.padStart(2,'0')}:${m.padStart(2,'0')}`;
  };
  const scrollInto = el => { if(!el) return; const top = el.getBoundingClientRect().top + scrollY - 80; window.scrollTo({top,behavior:'smooth'}); };
  const genId = () => 'c_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
  const getCookie = name => document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1] || '';
  const setCookie = (name, value) => { document.cookie = name + '=' + encodeURIComponent(value) + ';path=/'; };
  const TOKEN_KEYS = ['access_token', 'auth_token', 'jwt_token'];
  const clearToken = () => {
    TOKEN_KEYS.forEach(k => localStorage.removeItem(k));
    document.cookie = 'auth_token=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
  };
  function getToken() {
    let t = null;
    for (const k of TOKEN_KEYS) {
      const val = localStorage.getItem(k);
      if (val) { t = val; break; }
    }
    if (!t) t = getCookie('auth_token');
    if (!t) return null;
    try {
      const payload = JSON.parse(atob(t.split('.')[1] || ''));
      if (payload.exp * 1000 < Date.now()) {
        clearToken();
        return null;
      }
    } catch (_) {
      clearToken();
      return null;
    }
    return t;
  }

  let bookedTimes = new Set();
async function fetchBookedSlots(dateISO){
  const sid = document.body?.dataset?.sellerId;
  console.log('fetchBookedSlots called with:', { sellerId: sid, date: dateISO });
  
  if (!sid || !dateISO) {
    console.warn('Missing sellerId or date for fetchBookedSlots');
    return new Set();
  }
  
  try {
    const url = `${API_ROOT}/api/booked-slots/${encodeURIComponent(sid)}?date=${encodeURIComponent(dateISO)}`;
    console.log('Fetching from:', url);
    
    const res = await fetch(url);
    if(!res.ok) {
      console.error('API returned error:', res.status, res.statusText);
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await res.json();
    console.log('Raw API response:', data);
    
    const times = (data.times || data.bookedSlots || data.slots || []).map(normalizeTime);
    console.log('Normalized booked times:', times);
    
    return new Set(times);
  } catch(err) {
    console.error('fetch booked slots failed:', err);
    return new Set();
  }
}



  // کد مادر برای محیط توسعه
  const MASTER_OTP = '0000';

  // ===== Persistent selection (FIX: name & phone هم ذخیره شوند)
  const SS_KEY = 'vt:booking.sel';
  function saveSel() {
    const payload = {
      service:   st.service || null,
      serviceId: st.serviceId || null,
      price:     Number.isFinite(st.price) ? st.price : (parseInt(st.price||'0',10)||0),
      date:      st.date || null,
      time:      st.time || null,
      // NEW
      name:  (st.name || nameInp?.value || '').trim(),
      phone: toEn(st.phone || phoneInp?.value || '')
    };
    SafeSS.setJSON(SS_KEY, payload); // SafeSS
  }
  function loadSel() {
    try {
      const obj = SafeSS.getJSON(SS_KEY, null); // SafeSS
      if (!obj) return; // SafeSS
      if (obj.service)   st.service = obj.service;
      if (obj.serviceId) st.serviceId = obj.serviceId;
      if (obj.price != null) st.price = parseInt(obj.price,10) || 0;
      if (obj.date)      st.date = obj.date;
      if (obj.time)      st.time = obj.time;
      // NEW: rehydrate name/phone و داخل input هم بریز
      if (obj.name)  { st.name = obj.name;   if (nameInp)  nameInp.value  = obj.name; }
      if (obj.phone) { st.phone = toEn(obj.phone); if (phoneInp) phoneInp.value = obj.phone; }
    } catch(e){}
  }

  // اگر از روی کارت‌های «رزرو» وارد شدیم، همون لحظه prefill ذخیره بشه
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.service-button');
    if (!btn) return;
    try {
      const pre = {
        service:   btn.dataset.service || btn.closest('.service-card')?.querySelector('h4')?.textContent?.trim() || '',
        price:     parseInt(btn.dataset.price||'0',10)||0,
        serviceId: btn.dataset.serviceId || btn.dataset.id || null
      };
      const existing = SafeSS.getJSON(SS_KEY, {}); // SafeSS
      SafeSS.setJSON(SS_KEY, { ...existing, ...pre }); // SafeSS
    } catch(_) {}
  });

  // ===== State
  const st = {
    step:1, customerId:null,
    service:null, serviceId:null, price:0, duration:60,
    date:null, time:null,
    name:'', phone:'', otp:'', otpTimer:0, otpInt:null, otpTo:''
  };

  // ===== Elements
  const wizard = $('#booking-wizard');
  const steps = {1:$('#step-1'),2:$('#step-2'),3:$('#step-3'),4:$('#step-4'),5:$('#step-5')};
  const dots = $$('.step-dot'); const curLbl = $('#current-step'); const pbar = $('#progress-bar');
  const totalLbl = $('#total-steps');
  const TOTAL_STEPS = HAS_BOOKED_BEFORE ? 3 : 5;
  const STEP_PERCENT = 100 / TOTAL_STEPS;
  if (totalLbl) totalLbl.textContent = TOTAL_STEPS.toString();
  if (HAS_BOOKED_BEFORE) {
    dots.forEach(d => { const k = +d.dataset.step; if (k===3 || k===4) d.style.display = 'none'; });
  }

  // step1
  const servicesWrap = $('#booking-services'); 
  let   svcOpts = $$('.service-option');
  const next1 = $('#next-to-step-2');

  // step2
  let dateOpts = []; let timeOpts = [];
  let sellerSchedule = {};
  const WEEKDAY_NAMES = { '6':'شنبه','0':'یکشنبه','1':'دوشنبه','2':'سه‌شنبه','3':'چهارشنبه','4':'پنج‌شنبه','5':'جمعه' };

  async function loadSellerSchedule(){
    const sid = document.body?.dataset?.sellerId;
    if(!sid) return;
    try{
      const res = await fetch(`${API_ROOT}/api/booking-slots/${encodeURIComponent(sid)}`);
      if(!res.ok) throw new Error('fail');
      sellerSchedule = await res.json() || {};
      renderSchedule();
    }catch(err){ console.error('load seller schedule failed', err); }
  }

  function renderSchedule(){
    const daysWrap = document.getElementById('booking-days');
    const timesWrap = document.getElementById('booking-times');
    if(!daysWrap || !timesWrap) return;
    daysWrap.innerHTML='';
    timesWrap.innerHTML='';
    const order=['6','0','1','2','3','4','5'];
    order.forEach(k=>{
      const times=sellerSchedule[k];
      if(!Array.isArray(times) || !times.length) return;
      const d=document.createElement('div');
      d.className='date-option border border-gray-300 rounded-lg p-2 text-center cursor-pointer hover:border-blue-500 bw-tap';
      d.textContent=WEEKDAY_NAMES[k];
      d.dataset.day=k;
      daysWrap.appendChild(d);
    });
    dateOpts=$$('.date-option');
    dateOpts.forEach(el=>el.addEventListener('click', ()=>{ pick(dateOpts, el); st.date=el.innerText.trim(); st.time=''; renderTimes(el.dataset.day); saveSel(); chk2(); }));
    if(dateOpts[0]) dateOpts[0].click();
  }

async function renderTimes(dayIdx){
  const timesWrap = document.getElementById('booking-times');
  if (!timesWrap) return;
  
  timesWrap.innerHTML = '';
  const times = (sellerSchedule[String(dayIdx)] || []).map(normalizeTime);
  const dayName = WEEKDAY_NAMES[String(dayIdx)];
  
  // Fix: Get the actual selected date from the date option that was clicked
  const selectedDateElement = document.querySelector('.date-option.bw-selected');
  let dateStr = '';
  
  if (selectedDateElement) {
    // Extract the Persian date and convert it to ISO format
    const dateText = selectedDateElement.innerText.trim();
    // For now, use today's date + day offset as a simple solution
    const today = new Date();
    const currentDayIdx = today.getDay();
    const targetDayIdx = parseInt(dayIdx);
    let daysToAdd = targetDayIdx - currentDayIdx;
    if (daysToAdd < 0) daysToAdd += 7;
    if (daysToAdd === 0 && today.getHours() >= 18) daysToAdd = 7; // If today but late, go to next week
    
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysToAdd);
    dateStr = formatLocalDate(targetDate);
  } else {
    // Fallback to the original logic
    const start = nextDateFor(dayName, '00:00');
    dateStr = formatLocalDate(start);
  }
  
  console.log('Fetching booked slots for date:', dateStr, 'dayIdx:', dayIdx, 'dayName:', dayName);
  
  // Show loading state
  timesWrap.innerHTML = '<div class="col-span-3 text-center py-4 text-gray-500">در حال بررسی ساعات موجود...</div>';
  
  try {
    bookedTimes = await fetchBookedSlots(dateStr);
    console.log('Booked times received:', Array.from(bookedTimes));
  } catch (error) {
    console.error('Error fetching booked slots:', error);
    bookedTimes = new Set();
  }
  
  // Clear loading
  timesWrap.innerHTML = '';
  
  if (times.length === 0) {
    const noTimesDiv = document.createElement('div');
    noTimesDiv.className = 'col-span-3 text-center py-8 text-gray-500';
    noTimesDiv.innerHTML = `
      <i class="fas fa-calendar-times text-3xl mb-2 text-gray-400"></i>
      <p>برای این روز ساعت کاری تعریف نشده است</p>
    `;
    timesWrap.appendChild(noTimesDiv);
    return;
  }
  
  times.forEach(time => {
    const norm = normalizeTime(time);
    const button = document.createElement('button');
    const isBooked = bookedTimes.has(norm);
    const timeDisplay = toFa(norm);

    button.type = 'button';
    button.className = 'time-slot';
    button.textContent = timeDisplay;
    button.dataset.time = norm;

    if (isBooked) {
      // CRITICAL FIX: Set both the property AND the attribute
      button.disabled = true;  // This is the key fix!
      button.classList.add('slot--booked');
      button.setAttribute('title', 'این ساعت رزرو شده است');
      button.setAttribute('disabled', 'disabled');
      button.setAttribute('aria-disabled', 'true');
      button.dataset.status = 'booked';
      
      // Apply inline styles to ensure visibility
      button.style.opacity = '0.5';
      button.style.cursor = 'not-allowed';
      button.style.backgroundColor = '#fee2e2';
      button.style.color = '#991b1b';
      button.style.borderColor = '#fecaca';
      button.style.pointerEvents = 'none'; // Extra protection
    } else {
      // Make sure it's enabled
      button.disabled = false;
      button.setAttribute('title', 'کلیک کنید تا این ساعت را انتخاب کنید');
      button.setAttribute('aria-disabled', 'false');
      
      // Only add click handler to enabled buttons
      button.addEventListener('click', () => {
        // Remove previous selections
        timeOpts.forEach(opt => opt.classList.remove('selected'));
        // Select current time
        button.classList.add('selected');
        st.time = timeDisplay;
        saveSel();
        chk2();
      });
    }

    timesWrap.appendChild(button);
  });
  
  // Update timeOpts array for other functions - only get enabled buttons
  timeOpts = Array.from(timesWrap.querySelectorAll('.time-slot:not([disabled])'));

  // Reset previously selected time if it is no longer available
  if (!timeOpts.some(opt => opt.textContent.trim() === st.time)) {
    st.time = '';
  }

  // Ensure next button is disabled until a valid time is chosen
  chk2();
}





  document.addEventListener('services:loaded', loadSellerSchedule);
  const back2 = $('#back-to-step-1'); const next2 = $('#next-to-step-3');

  // step3
  const nameInp = $('#customer-name'); const phoneInp = $('#phone-number');
  const phoneErr = $('#phone-error'); const back3 = $('#back-to-step-2'); const next3 = $('#next-to-step-4');

  // step4 (otp)
  const otpPhone = $('#otp-phone'); const otpInputs = () => $$('.bw-otp');
  const otpErr = $('#otp-error'); const otpTimerLbl = $('#otp-timer'); const resendBtn = $('#resend-otp');
  const editPhone = $('#edit-phone'); const back4 = $('#back-to-step-3-otp'); const verifyBtn = $('#verify-otp');

  // step5
  const back5 = $('#back-to-step-3'); const confirmBtn = $('#confirm-booking');
  const cSvc = $('#confirm-service'), cDate = $('#confirm-date'), cTime = $('#confirm-time'), cName = $('#confirm-name'), cPhone = $('#confirm-phone'), cPrice = $('#confirm-price');

  // success
  const successBox = $('#booking-success'); const closeSuccess = $('#close-booking');

  // ===== Validations & Button state
  const validPhone = raw => {
    const v = toEn(raw).trim();
    return /^0\d{10}$/.test(v) && v.startsWith('09');
  };

  function rebuildFromDOMIfMissing() {
    if (!st.service) {
      const sel = document.querySelector('#booking-services .service-option.bw-selected');
      if (sel) {
        st.service   = sel.dataset.service || sel.textContent.trim();
        st.price     = parseInt(sel.dataset.price || '0', 10) || st.price || 0;
        st.serviceId = sel.dataset.serviceId || st.serviceId || null;
      }
    }
    if (!st.date) {
      const dSel = document.querySelector('.date-option.bw-selected');
      if (dSel) st.date = dSel.innerText.trim();
    }
    if (!st.time) {
      const tSel = document.querySelector('.time-option.bw-selected');
      if (tSel) st.time = tSel.innerText.trim();
    }
  }


// چک‌لیست خطاها برای مرحله ۵
function getStep5Errors() {
  const errs = [];
  const nm = (st.name || nameInp?.value || '').trim();
  const ph = toEn(st.phone || phoneInp?.value || '');

  if (!st.service) errs.push('خدمت را انتخاب کنید.');
  if (!st.date)   errs.push('روز را انتخاب کنید.');
  if (!st.time)   errs.push('ساعت را انتخاب کنید.');
  if (nm.length < 2) errs.push('نام را کامل بنویسید.');
  if (!/^0\d{10}$/.test(ph)) errs.push('شماره موبایل نامعتبر است (مثال: 09123456789).');

  return errs;
}






// نسخه تقویت‌شده: فعال/غیرفعال + نمایش دلیل
function updateConfirmState(reason = '') {
  // از DOM بخوانیم تا چیزی از state جا نماند
  const svcSel  = document.querySelector('#booking-services .service-option.bw-selected, #step-1 .service-option.border-blue-500');
  const dateSel = document.querySelector('.date-option.bw-selected, .date-option.border-blue-500');
  const timeSel = document.querySelector('.time-option.bw-selected, .time-option.border-blue-500');

  if (svcSel) {
    st.service   = svcSel.dataset.service || svcSel.textContent.trim();
    st.price     = parseInt(svcSel.dataset.price || '0', 10) || 0;
    st.serviceId = svcSel.dataset.serviceId || null;
  }
  if (dateSel) st.date = dateSel.innerText.trim();
  if (timeSel) st.time = timeSel.innerText.trim();
  if (nameInp)  st.name  = (nameInp.value || '').trim();
  if (phoneInp) st.phone = toEn(phoneInp.value || '');

  const errs = getStep5Errors();
  const box  = document.getElementById('confirm-errors');

  if (!confirmBtn) return;

  if (errs.length) {
    // غیرفعال + نشان‌دادن دلیل‌ها
    confirmBtn.disabled = true;
    confirmBtn.setAttribute('disabled', 'disabled');
    confirmBtn.setAttribute('aria-disabled', 'true');
    confirmBtn.classList.add('cursor-not-allowed', 'opacity-50');
    confirmBtn.classList.remove('bg-blue-600','hover:bg-blue-700');

    if (box) {
      box.innerHTML = 'نمی‌تونم تایید کنم چون:' +
        '<ul class="list-disc pr-5 mt-2">' +
        errs.map(e => `<li>${e}</li>`).join('') +
        '</ul>';
      box.classList.remove('hidden');
    }
  } else {
    // فعال
    confirmBtn.disabled = false;
    confirmBtn.removeAttribute('disabled');
    confirmBtn.setAttribute('aria-disabled', 'false');
    confirmBtn.classList.remove('cursor-not-allowed', 'opacity-50');
    confirmBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');

    if (box) {
      box.classList.add('hidden');
      box.textContent = '';
    }
  }

  // لاگ برای دیباگ سریع
  console.debug('[confirm-state]', reason, {
    service: st.service, date: st.date, time: st.time,
    name: st.name, phone: st.phone, ok: errs.length === 0
  });
}


  // ===== PATCH: نوع دکمه و نگهبان ضد-disabled
  if (confirmBtn) {
    confirmBtn.type = 'button'; // از هر submit-handler عمومی در امان
    const confirmGuard = new MutationObserver(() => {
      const ready = !!(st.service && st.date && st.time && (nameInp?.value||'').trim() && /^0\d{10}$/.test(toEn(phoneInp?.value||'')));
      if (ready && confirmBtn.hasAttribute('disabled')) {
        confirmBtn.disabled = false;
        confirmBtn.removeAttribute('disabled');
        confirmBtn.setAttribute('aria-disabled', 'false');
        confirmBtn.classList.remove('cursor-not-allowed', 'opacity-50');
        confirmBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
      }
    });
    confirmGuard.observe(confirmBtn, { attributes: true, attributeFilter: ['disabled'] });
    // اختیاری: روی unload قطعش نکنیم هم مشکلی نیست
  }

  // ===== Navigation
  function showStep(n){
    st.step = n;
    // Safely hide all steps in case some aren't present in the DOM
    Object.values(steps).forEach(s => s && s.classList.add('hidden'));
    const cur = steps[n];
    if (cur) cur.classList.remove('hidden');
    const dispStep = HAS_BOOKED_BEFORE ? (n >= 5 ? 3 : n) : n;
    curLbl.textContent = dispStep.toString();
    pbar.style.width = (dispStep * STEP_PERCENT) + '%';
    dots.forEach(d => {
      const k = +d.dataset.step;
      const dk = HAS_BOOKED_BEFORE ? (k === 5 ? 3 : k) : k;
      d.classList.toggle('bg-blue-600', dk <= dispStep);
      d.classList.toggle('bg-gray-300', dk > dispStep);
    });
    scrollInto(wizard);
    if (n === 3) {
      // Ensure contact info validations run when entering step 3
      chk3();
    }
    if (n === 5) {
      updateConfirmState('enter-step5');
      // PATCH: دوبار فراخوانی برای حذف race با رندر/transition
      requestAnimationFrame(() => updateConfirmState('enter-step5:raf'));
      setTimeout(() => updateConfirmState('enter-step5:timeout'), 0);
    }
  }

  // ===== Validators
  function chk1(){ next1.disabled = !(st.service && st.price); saveSel(); updateConfirmState('chk1'); }
  function chk2(){
    const booked = st.time && bookedTimes.has(normalizeTime(st.time));
    if (booked) st.time = '';
    next2.disabled = !(st.date && st.time);
    saveSel();
    updateConfirmState('chk2');
  }
  function chk3(){
    const ok = nameInp.value.trim().length >= 2 && validPhone(phoneInp.value);
    next3.disabled = !ok;
    phoneErr.classList.toggle('hidden', validPhone(phoneInp.value));
    st.name  = nameInp.value.trim();
    st.phone = toEn(phoneInp.value);
    saveSel();
    updateConfirmState('chk3');
  }
  function chkOTP(){
    const code = toEn(otpInputs().map(i=>i.value).join('')).replace(/\D/g,'');
    verifyBtn.disabled = (code.length!==4);
    if (!verifyBtn.disabled) otpErr.classList.add('hidden');
  }

  // ===== Step 1: build service options from real services
  async function buildServiceOptionsFromCards(){
    if (!servicesWrap) return;
    servicesWrap.innerHTML = '';

    let items = [];
    if (window.LAST_PUBLIC && Array.isArray(window.LAST_PUBLIC.items) && window.LAST_PUBLIC.items.length) {
      items = window.LAST_PUBLIC.items;
    } else {
      try {
        const shopurl = document.body?.dataset?.shopurl || (typeof getShopUrlFromLocation === 'function' ? await getShopUrlFromLocation() : '');
        if (shopurl) {
          const res = await fetch(`${API_ROOT}/api/seller-services/by-shopurl/${encodeURIComponent(shopurl)}` , { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            items = Array.isArray(data.items) ? data.items : [];
          }
        }
      } catch(err){
        console.error('load services failed', err);
      }
    }

    if (!items.length) return;

    items.forEach((svc, idx) => {
      const title = svc.title || `خدمت ${idx+1}`;
      const price = parseInt(toEn(String(svc.price || '0')), 10) || 0;
      const serviceId = svc._id || svc.id || '';

      const opt = document.createElement('div');
      opt.className = 'service-option border border-gray-300 rounded-lg p-3 cursor-pointer hover:border-blue-500 flex items-center justify-between';
      opt.dataset.service = title;
      opt.dataset.price = String(price);
      if (serviceId) opt.dataset.serviceId = serviceId;

      opt.innerHTML = `
        <div class="font-bold text-gray-800">${title}</div>
        <div class="text-sm text-gray-600">${price ? toFa(price.toLocaleString()) + ' تومان' : '—'}</div>
      `;

      opt.addEventListener('click', () => {
        svcOpts.forEach(x => x.classList.remove('bw-selected'));
        opt.classList.add('bw-selected');
        st.service   = title;
        st.price     = price;
        st.serviceId = serviceId || null;
        saveSel();
        chk1();
      });

      servicesWrap.appendChild(opt);
    });

    svcOpts = $$('#booking-services .service-option');

    // اگر از قبل prefill داشتیم، همین‌جا اعمال کنیم
    loadSel();
    if (st.service) {
      const match = Array.from(svcOpts).find(o => (o.dataset.service||'').trim() === st.service);
      if (match) {
        match.classList.add('bw-selected');
        st.price = parseInt(match.dataset.price||'0',10)||st.price||0;
        st.serviceId = match.dataset.serviceId || st.serviceId || null;
      } else {
        st.service = '';
        st.price = 0;
        st.serviceId = null;
      }
    }
    chk1();
  }

  function wireExistingServiceOptions(){
    if (!svcOpts.length) return;
    svcOpts.forEach(o=>{
      o.addEventListener('click', ()=>{
        svcOpts.forEach(x=>x.classList.remove('bw-selected'));
        o.classList.add('bw-selected');
        st.service   = o.dataset.service || o.textContent.trim();
        st.price     = parseInt(o.dataset.price||'0',10)||0;
        st.serviceId = o.dataset.serviceId || null;
        saveSel();
        chk1();
      });
    });
  }

  // step1 next
  next1?.addEventListener('click', ()=>showStep(2));

  // ===== Step 2
  function pick(list, el){ list.forEach(x=>x.classList.remove('bw-selected')); el.classList.add('bw-selected'); }
  back2.addEventListener('click', ()=>showStep(1));
  next2.addEventListener('click', ()=>{
    if (HAS_BOOKED_BEFORE) {
      saveSel();
      fillConfirm();
      showStep(5);
    } else {
      showStep(3);
    }
  });

  // ===== Step 3
  function onStep3(){
    st.name  = nameInp.value.trim();
    st.phone = toEn(phoneInp.value);
    saveSel();
    chk3();
  }
  nameInp.addEventListener('input', onStep3);
  nameInp.addEventListener('change', onStep3);
  phoneInp.addEventListener('input', (e)=>{
    let value = e.target.value;
    value = value.replace(/[^\u06F0-\u06F9\u0660-\u06690-9]/g, '');
    value = value.slice(0, 11);
    e.target.value = value;
    st.phone = toEn(value);
    onStep3();
  });
  phoneInp.addEventListener('change', onStep3);
  back3.addEventListener('click', ()=>showStep(2));
  next3.addEventListener('click', ()=>{
    if (next3.disabled) return;
    st.phone = toEn(phoneInp.value); st.name = nameInp.value.trim();

    if (HAS_BOOKED_BEFORE) {
      fillConfirm();
      showStep(5);
      return;
    }

    // ارسال کد (دمو) — ۴ رقمی
    st.otp   = String(Math.floor(1000 + Math.random()*9000));
    st.otpTo = st.phone;

    // ماسک شماره
    const v = toEn(st.phone).replace(/\D/g,'');
    otpPhone.textContent = (v.length<8) ? v : (v.slice(0,4)+'*****'+v.slice(-4));

    startOtpTimer();
    clearOtp();
    otpErr.classList.add('hidden');
    chkOTP();
    showStep(4);
  });

  // ===== Step 4 (OTP)
  function clearOtp(){ otpInputs().forEach((i,idx)=>{ i.value=''; if(idx===0) i.focus(); }); }
  function startOtpTimer(){
    stopOtpTimer(); st.otpTimer = 60; resendBtn.disabled = true; updateOtpTimer();
    st.otpInt = setInterval(()=>{ st.otpTimer--; updateOtpTimer(); if(st.otpTimer<=0){ stopOtpTimer(); resendBtn.disabled=false; } }, 1000);
  }
  function stopOtpTimer(){ if(st.otpInt){ clearInterval(st.otpInt); st.otpInt=null; } }
  function updateOtpTimer(){ otpTimerLbl.textContent = st.otpTimer.toString(); }

  document.addEventListener('input', (e)=>{
    const t = e.target; if(!(t instanceof HTMLInputElement)) return;
    if(!t.classList.contains('bw-otp')) return;
    t.value = toEn(t.value).replace(/\D/g,'').slice(0,1);
    const arr = otpInputs(); const idx = arr.indexOf(t);
    if(t.value && idx < arr.length-1){ arr[idx+1].focus(); }
    chkOTP();
  });
  document.addEventListener('keydown', (e)=>{
    const t = e.target; if(!(t instanceof HTMLInputElement)) return;
    if(!t.classList.contains('bw-otp')) return;
    if(e.key==='Backspace' && !t.value){
      const arr = otpInputs(); const idx = arr.indexOf(t);
      if(idx>0) arr[idx-1].focus();
    }
  });

  const resendOtp = ()=>{ st.otp = String(Math.floor(1000 + Math.random()*9000)); startOtpTimer(); };
  resendBtn.addEventListener('click', ()=>{ if(!resendBtn.disabled) resendOtp(); });

  // ذخیره مشتری
function persistCustomer(){
    const existing = getCookie('customerId');
    const cid = st.customerId || existing || genId();
    st.customerId = cid;
    setCookie('customerId', cid);
    setCookie('customerName', st.name);
    setCookie('customerPhone', st.phone);

    // Also save to localStorage for better persistence
    localStorage.setItem('vt_user_id', cid);
    if (st.name) localStorage.setItem('vt_user_name', st.name);
    if (st.phone) localStorage.setItem('vt_user_phone', st.phone);
  }

  // تایید OTP
  verifyBtn.addEventListener('click', async ()=>{
    const code = toEn(otpInputs().map(i=>i.value.trim()).join('')).replace(/\D/g,'');
    if (code.length !== 4) { otpErr.classList.remove('hidden'); return; }
    if (code !== st.otp && code !== MASTER_OTP) { otpErr.classList.remove('hidden'); return; }
    stopOtpTimer();

    verifyBtn.disabled = true;
    const originalHTML = verifyBtn.innerHTML;
    verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>در حال تایید...';

    try {
      // Only attempt to save profile on the server if a user token exists.
      // The service flow works for anonymous customers as well, so skip the
      // request entirely when the user is not authenticated to avoid noisy
      // console errors ("Profile save failed").
      if (getToken()) {
        const profilePayload = { name: st.name, phone: st.phone, customerId: st.customerId };
        const response = await fetch(`${API_ROOT}/api/user/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
          },
          credentials: 'include',
          body: JSON.stringify(profilePayload)
        });
        if (!response.ok) throw new Error('Profile save failed');
      }

      persistCustomer();
    } catch (error) {
      console.error('Profile save failed:', error);
      if (typeof showToastDark === 'function') showToastDark('خطا در ثبت اطلاعات کاربری', {type: 'error'});
      persistCustomer(); // ادامه محلی
    } finally {
      // رفتن به مرحله تایید
      fillConfirm();
      saveSel(); // اطمینان از ذخیره name/phone قبل از Step 5
      showStep(5);
      requestAnimationFrame(() => updateConfirmState('after-otp'));
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = originalHTML;
    }
  });

  editPhone.addEventListener('click', ()=>showStep(3));
  back4.addEventListener('click',  ()=>showStep(3));

  // ===== Step 5 (Confirm)
  function fillConfirm(){
    loadSel();
    rebuildFromDOMIfMissing();
    // تضمین اینکه name/phone گم نشه
    st.name  = st.name  || nameInp?.value.trim() || '';
    st.phone = st.phone || toEn(phoneInp?.value || '') || '';

    cSvc.textContent   = st.service || '';
    cDate.textContent  = st.date   || '';
    cTime.textContent  = st.time   || '';
    cName.textContent  = st.name   || '';
    cPhone.textContent = st.phone  || '';
    cPrice.textContent = (st.price? st.price.toLocaleString('fa-IR'):'۰') + ' تومان';

    saveSel();
    updateConfirmState('fillConfirm');
  }

  back5.addEventListener('click', ()=>showStep(HAS_BOOKED_BEFORE ? 2 : 3));

// --- Final submit: send booking to backend & then show pending modal ---
(function hookConfirmToServerBooking(){
  const btn = document.getElementById('confirm-booking');
  if (!btn) return;

  // در صورت نیاز، مسیر API خودت رو اینجا تنظیم کن
  const BOOKING_ENDPOINT = (window.__API_BASE__ || '') + '/api/bookings';

  // اطلاعات فروشنده برای استفاده در ذخیره محلی نوبت
  const seller = (() => {
    try { return JSON.parse(localStorage.getItem('seller') || 'null'); }
    catch (_) { return null; }
  })();

  btn.type = 'button'; // جلوگیری از submit فرم‌های عمومی

  btn.addEventListener('click', async (e) => {
    // جلوِ هر لیسنر قدیمی را بگیر
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (btn.disabled) return;

    // بازسازی/برداشت مقادیر نهایی از DOM
    const name  = (document.getElementById('customer-name')?.value || (st.name||'')).trim();
    const phone = toEn(document.getElementById('phone-number')?.value || (st.phone||''));

    // خدمت/روز/ساعت از DOM اگر توی st نباشه
    const svcSel  = document.querySelector('#booking-services .service-option.bw-selected');
    if (svcSel) {
      st.service   = svcSel.dataset.service || svcSel.textContent.trim();
      st.price     = parseInt(svcSel.dataset.price || '0', 10) || 0;
      st.serviceId = svcSel.dataset.serviceId || null;
    }
    const dateSel = document.querySelector('.date-option.bw-selected');
    if (dateSel) st.date = dateSel.innerText.trim();
    const timeSel = document.querySelector('.time-option.bw-selected');
    if (timeSel) st.time = timeSel.innerText.trim();

    // اعتبارسنجی اولیه (همون‌هایی که بک‌اند می‌خواد)
    if (!st.service || !st.date || !st.time || !name || !/^0\d{10}$/.test(phone)) {
      const msg = 'اطلاعات نوبت ناقص است.';
      (typeof showToastDark==='function') ? showToastDark(msg, {type:'error'}) : alert(msg);
      console.error('submit booking failed', new Error(msg), {st, name, phone});
      return;
    }

    // نرمال‌سازی تاریخ/ساعت به فرمت مورد انتظار بک‌اند
    const { dateLocal } = composeSlotISO(st.date, st.time, st.duration || 60);
    const date = dateLocal;              // YYYY-MM-DD in local time
    const time = normalizeTime(st.time); // HH:mm بدون تغییر منطقه زمانی

    const sellerId =
      document.body?.dataset?.sellerId ||
      window.LAST_PUBLIC?.sellerId ||
      (window.LAST_PUBLIC?.items?.find(it => it._id === st.serviceId)?.sellerId) ||
      null;

    // re-check availability just before submit to avoid stale selections
    try {
      const latest = await fetchBookedSlots(date);
      if (latest.has(normalizeTime(time))) {
        const warn = 'این بازه زمانی قبلاً رزرو شده است. لطفاً زمان دیگری را انتخاب کنید.';
        (typeof showToastDark==='function') ? showToastDark(warn, {type:'error'}) : alert(warn);
        st.time = '';
        const dayIdx = WEEKDAY_MAP[st.date.split(/\s+/)[0]];
        if (typeof dayIdx === 'number') await renderTimes(dayIdx);
        showStep(2);
        chk2();
        return;
      }
    } catch (err) {
      console.error('revalidate slot failed', err);
    }

    // ساخت payload با ارسال صریح شناسه فروشنده و سرویس
    const payload = {
      customerName:  name,
      customerPhone: phone,
      date,
      time,
      serviceId: st.serviceId || undefined,
      sellerId,
      service: st.service
    };

    // دکمه در حال پردازش
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>در حال ثبت...';

    try {
      const res = await fetch(BOOKING_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type':'application/json',
          ...(getToken() ? {'Authorization':'Bearer ' + getToken()} : {})
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let serverMsg = 'خطا در ثبت نوبت';
        try {
          const data = await res.json();
          serverMsg = data?.message || data?.error || serverMsg;
        } catch(_) {}
        throw new Error(serverMsg);
      }

      const data = await res.json(); // انتظار: id/bookingId/status ...

      // ذخیره «pending» محلی (برای بلاک رزرو بعدی و همگام‌سازی)
      const last = {
        id:        genId(),
        bookingId: data.id || data._id || data.bookingId || null,
        service:   st.service,
        date:      st.date,  // برای نمایش
        time:      st.time,  // برای نمایش
        phone,
        status:    data.status || 'pending',
        createdAt: Date.now(),
        sellerId,
        shopUrl:   document.body?.dataset?.shopurl || null,
        storeName: seller?.storeName || seller?.displayName || seller?.title || seller?.name || 'فروشگاه'
      };
      try { localStorage.setItem('vt:lastBooking', JSON.stringify(last)); } catch(_){}

      // پر کردن و نمایش مودال «ثبت شد / در انتظار تأیید»
      const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
      setText('pb-service', st.service);
      setText('pb-date',    st.date);
      setText('pb-time',    st.time);
      setText('pb-phone',   phone);

      if (typeof window.openModalById === 'function') {
        window.openModalById('pendingBookingModal');
      } else if (typeof showToastDark === 'function') {
        showToastDark('درخواست ثبت شد و در انتظار تأیید فروشنده است.', { type: 'success' });
      } else {
        alert('درخواست ثبت شد و در انتظار تأیید فروشنده است.');
      }

      // ریست ویزارد
      resetWizardState();

    } catch (err) {
      const msg = err?.message || 'ثبت نوبت ناموفق بود';
      (typeof showToastDark==='function') ? showToastDark(msg, {type:'error'}) : alert(msg);
      console.error('submit booking failed', err, {payload});
      if (msg.includes('بازه زمانی قبلاً رزرو شده') && st.date) {
        st.time = '';
        const dayIdx = WEEKDAY_MAP[st.date.split(/\s+/)[0]];
        if (typeof dayIdx === 'number') await renderTimes(dayIdx);
        showStep(2);
        chk2();
      }
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }, true); // capture=true تا هر لیسنر قدیمی قبلش خنثی بشه
})();
// --- /Final submit ---

  // --- /built-in success popup ---

  // Helper: reset
  function resetWizardState() {
    ['service','date','time'].forEach(k => st[k] = null);
    try { sessionStorage.removeItem(SS_KEY); } catch(e){}
    svcOpts.forEach(x => x.classList.remove('bw-selected'));
    dateOpts.forEach(x => x.classList.remove('bw-selected'));
    timeOpts.forEach(x => x.classList.remove('bw-selected'));
    if (next1) next1.disabled = true;
    if (next2) next2.disabled = true;
    confirmBtn.disabled = true;
    confirmBtn.setAttribute('disabled','disabled');
    showStep(1);
  }

  // ===== Compose slot
  const WEEKDAY_MAP = {
    'یکشنبه':0,'دوشنبه':1,'سه‌شنبه':2,'سه شنبه':2,'چهارشنبه':3,'پنج‌شنبه':4,'پنجشنبه':4,'جمعه':5,'شنبه':6
  };
  function nextDateFor(dayName, hhmm){
    const targetDow = WEEKDAY_MAP[(dayName||'').trim()];
    const now = new Date(); let d = new Date(); let add = 0;
    if (typeof targetDow === 'number'){
      const diff = (targetDow - now.getDay() + 7) % 7;
      add = diff;
    }
    d.setDate(now.getDate() + add);
    const parts = toEn(hhmm||'12:00').split(':');
    const h = parseInt(parts[0]||'12',10), m = parseInt(parts[1]||'0',10);
    d.setHours(h||0, m||0, 0, 0);
    if (add===0 && d.getTime() <= now.getTime()) d.setDate(d.getDate()+7);
    return d;
  }
  function formatLocalDate(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function composeSlotISO(dateText, timeText, durationMin=60){
    const dayName = (dateText||'').trim().split(/\s+/)[0];
    let start = nextDateFor(dayName, timeText||'12:00');
    if (!(start instanceof Date) || isNaN(+start)) start = new Date(Date.now() + 60*60*1000);
    const end = new Date(start.getTime() + durationMin*60*1000);
    const pad2 = n => String(n).padStart(2,'0');
    const dateLocal = `${start.getFullYear()}-${pad2(start.getMonth()+1)}-${pad2(start.getDate())}`;
    return { startISO: start.toISOString(), endISO: end.toISOString(), dateLocal };
  }

  // ===== Submit booking (legacy handler removed; handled by modern wizard)

  closeSuccess.addEventListener('click', ()=>{
    successBox.classList.add('hidden');
    showStep(1);
  });

  // ===== Init from cookies
// ===== Init from localStorage first, then cookies as fallback
  const saved = {
    cid: localStorage.getItem('vt_user_id') || getCookie('customerId'),
    name: localStorage.getItem('vt_user_name') || decodeURIComponent(getCookie('customerName') || ''),
    phone: localStorage.getItem('vt_user_phone') || getCookie('customerPhone')
  };
if (saved.cid)  st.customerId = saved.cid;
  if (saved.name) {
    nameInp.value = saved.name;
    st.name = saved.name;
  }
  if (saved.phone) {
    phoneInp.value = saved.phone;
    st.phone = saved.phone;
  }
  // Build & wire
  buildServiceOptionsFromCards();
  document.addEventListener('services:loaded', buildServiceOptionsFromCards);
  wireExistingServiceOptions();

  // Initial validation
  (function initButtons(){
    next1.disabled = true; next2.disabled = true; next3.disabled = true; confirmBtn.disabled = true;
    confirmBtn.setAttribute('disabled','disabled');
    if (confirmBtn) confirmBtn.type = 'button';
  })();

  // اگر prefill در session هست، از همون شروع کن
  loadSel();
  if (st.service) {
    const match = document.querySelector(`#booking-services .service-option[data-service="${CSS.escape(st.service)}"]`);
    if (match) { match.classList.add('bw-selected'); next1.disabled = false; }
  }
  if (st.date) {
    const dMatch = Array.from(dateOpts).find(d => d.innerText.trim() === st.date);
    if (dMatch) dMatch.classList.add('bw-selected');
  }
  if (st.time) {
    const tMatch = Array.from(timeOpts).find(t => t.innerText.trim() === st.time);
    if (tMatch) tMatch.classList.add('bw-selected');
  }

  // نام/شماره از کوکی‌ها یا session
  st.name  = (nameInp.value||'').trim();
  st.phone = toEn(phoneInp.value||'');
  updateConfirmState('init');
  showStep(1);

  // ابزار تست
  window.forceEnableConfirm = function() {
    const btn = document.getElementById('confirm-booking');
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('disabled');
      console.log('دکمه تایید نهایی به صورت دستی فعال شد');
    }
  };

  // Update date options to future dates (دمویی)
  const dateOptions = $$('.date-option');
  const persianDates = ['22 شهریور', '23 شهریور', '24 شهریور', '25 شهریور', '26 شهریور', '27 شهریور'];
  dateOptions.forEach((opt, i) => {
    const boldDiv = opt.querySelector('.font-bold');
    if (boldDiv) { boldDiv.textContent = persianDates[i]; }
  });
})();

document.addEventListener('DOMContentLoaded', function () {
const btns = document.querySelectorAll(
  'button[type="submit"]:not([data-no-loader]), .service-button'
);


    btns.forEach(btn => {
      btn.addEventListener('click', function () {
        if (this.disabled || this.classList.contains('loading')) return;

        const original = this.innerHTML;

        // Allow the submit event to fire first
        setTimeout(() => {
          this.classList.add('loading');
          this.disabled = true;
          this.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>در حال پردازش...';
        }, 0);

        // Safety revert after 2s (UI-only fallback)
        setTimeout(() => {
          this.classList.remove('loading');
          this.disabled = false;
          this.innerHTML = original;
        }, 2000);
      });
    });
  });

(() => {
  'use strict';

  const rewardsDisabled = localStorage.getItem('vit_vip_rewards_disabled') === '1';
  if (rewardsDisabled) {
    document.getElementById('loyalty-card')?.classList.add('hidden');
    document.getElementById('loyalty-disabled')?.classList.remove('hidden');
    return;
  }

  // ------- KEYS & HELPERS -------
  const KEY_PROGRESS = 'vitreenet_loyalty_current';   // پیشرفت فعلی تا جایزه
  const KEY_TOTAL    = 'vitreenet_booking_total';     // تعداد کل رزروها (برای تشخیص «اولین نوبت»)
  const AUTH_LS_KEY  = 'auth_user';                   // فقط حالت تست/دِمو

  const toFa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function toast(msg, type = 'info') {
    if (typeof showToastDark === 'function') showToastDark(msg, { type });
  }

  // ------- ADAPTERS (قابل تعویض با بک‌اند) -------
  const adapters = {
    async getAuth() {
      if (window.__APP_USER__ && window.__APP_USER__.id) return { loggedIn: true, user: window.__APP_USER__ };
      try {
        const raw = localStorage.getItem(AUTH_LS_KEY);
        if (raw) return { loggedIn: true, user: JSON.parse(raw) };
      } catch (e) {}
      return { loggedIn: false, user: null };
    },
    async getBookingSummary(userId) {
      if (window.__BOOKING_SUMMARY__ && typeof window.__BOOKING_SUMMARY__.total === 'number') {
        return { total: window.__BOOKING_SUMMARY__.total };
      }
      const total = parseInt(localStorage.getItem(KEY_TOTAL) || '0', 10) || 0;
      return { total };
    },
    async getLoyaltyProgress(storeId) {
      try {
        const res = await fetch(`/api/loyalty/progress/${storeId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('fail');
        return await res.json();
      } catch (_) {
        return { completed: 0 };
      }
    }
  };

  // ------- MODAL -------
  function openModal(root) {
    root.classList.remove('hidden');
    const card = root.querySelector('.modal-card');
    requestAnimationFrame(() => { card.classList.remove('scale-95','opacity-0'); card.classList.add('scale-100','opacity-100'); });
  }
  function closeModal(root) {
    const card = root.querySelector('.modal-card');
    card.classList.add('scale-95','opacity-0'); card.classList.remove('scale-100','opacity-100');
    setTimeout(() => root.classList.add('hidden'), reduce()?0:200);
  }

  // ------- COPY (صمیمی/متعادل) -------
  function copyFor(progress, current, target, reward) {
    const left = Math.max(0, target - current);
    const pick = (arr) => arr[(current + left) % arr.length];

    if (current >= target) {
      return pick([
        { h: 'جایزه‌ت آماده‌ست 🎁', sub: 'بزن بگیریمش.',            help: 'روی رزرو بعدی اعمالش می‌کنیم.', cta: 'دریافت جایزه' },
        { h: 'حله! رسیدی به جایزه', sub: 'فقط فعالش کنیم و تمام.',  help: 'تو رزرو بعدی استفاده میشه.',    cta: 'دریافت جایزه' },
        { h: 'به هدف خوردی ✨',     sub: 'وقتِ نقد کردنشه.',         help: 'بعدی که رزرو کنی می‌افته.',      cta: 'دریافت جایزه' },
      ]);
    }
    if (current * 2 === target) {
      return pick([
        { h: 'نصفش رفت ✅',      sub: 'چند تا دیگه مونده.',  help: `${left} نوبت مونده.`, cta: 'رزرو بعدی' },
        { h: 'نصف راهی! 👌',     sub: 'با همین فرمون برو.',  help: `${left} نوبت مونده.`, cta: 'رزرو بعدی' },
      ]);
    }
    if (progress >= 90) {
      return pick([
        { h: 'یه قدم تا جایزه',  sub: 'همین یکی دیگه.',      help: left <= 1 ? 'با نوبت بعدی می‌رسی.' : `${left} نوبت مونده.`, cta: 'رزرو بعدی' },
        { h: 'تقریباً رسیدی ⏳', sub: 'کم مونده، بزن بریم.', help: left <= 1 ? 'نوبت بعدی کافیه.'    : `${left} نوبت مونده.`, cta: 'رزرو بعدی' },
      ]);
    }
    if (progress >= 60) {
      return pick([
        { h: 'خوب داری میری 🚀', sub: 'همینو نگه دار.',      help: `${left} نوبت تا جایزه.`, cta: 'رزرو بعدی' },
        { h: 'مسیر رو گرفتی',   sub: 'یکی‌یکی جلو برو.',    help: `${left} نوبت تا جایزه.`, cta: 'رزرو بعدی' },
      ]);
    }
    if (current > 0) {
      return pick([
        { h: 'شروع خوبی زدی',   sub: 'نذار فاصله بیفته.',   help: `${left} نوبت مونده.`,    cta: 'رزرو بعدی' },
        { h: 'اوله راهی ولی رو غلتکی', sub: 'قدم بعدی رو بردار.', help: `${left} نوبت مونده.`, cta: 'رزرو بعدی' },
      ]);
    }
    return pick([
      { h: 'به باشگاه خوش اومدی 👋', sub: 'اولین نوبت رو بگیر و بریم.', help: `با ${target} نوبت، ${reward}.`, cta: 'رزرو اولین نوبت' },
      { h: 'از همین‌جا شروع کن',     sub: 'اولین رزرو = یه قدم جلو.',   help: `با ${target} نوبت، ${reward}.`, cta: 'رزرو اولین نوبت' },
    ]);
  }

  // ------- AUTH / HISTORY -------
  let AUTH = { loggedIn: false, user: null };
  HAS_BOOKED_BEFORE = false;

  function chooseCtaText(current, target) {
    if (current >= target) return 'دریافت جایزه';
    return HAS_BOOKED_BEFORE ? 'رزرو بعدی' : 'رزرو اولین نوبت';
  }

  function applyCtaText(text) {
    const l1 = document.getElementById('lr-cta-label');
    if (l1) l1.textContent = text;
    const l2 = document.getElementById('lr-cta-mobile-label');
    if (l2) l2.textContent = (text === 'دریافت جایزه') ? 'دریافت' : (text === 'رزرو اولین نوبت' ? 'شروع' : 'رزرو');
  }

  function updateSticky(current, target) {
    const pct = Math.min(100, Math.max(0, (current/target)*100));
    const stickyTxt = document.getElementById('lr-sticky-progress');
    const bar = document.getElementById('lr-sticky-bar');
    if (stickyTxt) stickyTxt.textContent = `${toFa(current)} از ${toFa(target)}`;
    if (bar) bar.style.width = pct + '%';
  }

  function redirectToLogin() {
    const data = document.getElementById('lr-data');
    const loginUrl = data.dataset.loginUrl || '/login';
    const redirect = encodeURIComponent(window.location.href);
    window.location.href = `${loginUrl}?redirect=${redirect}`;
  }

  function requireLogin() {
    toast('اول یه ورود کوچیک لازم داریم؛ سریع برمی‌گردیم همین‌جا 🙂');
    setTimeout(redirectToLogin, 900);
  }

  // ------- INIT CARD -------
  function initCard() {
    const data = document.getElementById('lr-data');
    const target = parseInt(data.dataset.goal || '10', 10);
    const reward = data.dataset.reward || '';

    // مقدار خام (ممکنه از سرور یا لوکال بیاد)
    const raw = parseInt(localStorage.getItem(KEY_PROGRESS) ?? data.dataset.current ?? '0', 10) || 0;

    // اگر هرگز رزرو نکرده ⇒ صفر نمایش داده می‌شود
    const current = (!HAS_BOOKED_BEFORE) ? 0 : raw;

    document.getElementById('reward-target').textContent = toFa(target);
    document.getElementById('reward-text').textContent   = reward;

    const pct = Math.min(100, Math.max(0, Math.round((current/target)*100)));
    const {h, sub, help} = copyFor(pct, current, target, reward);

    document.getElementById('lr-headline').textContent = h;
    document.getElementById('lr-sub').textContent      = sub;
    document.getElementById('lr-helper').textContent   = help;

    document.getElementById('lr-counts').textContent   = `${toFa(current)} از ${toFa(target)}`;
    document.getElementById('lr-bar').style.width      = pct + '%';

    const left = Math.max(0, target - current);
    const mCur = document.getElementById('lr-m-current');
    const mLeft = document.getElementById('lr-m-left');
    if (mCur)  mCur.textContent  = toFa(current);
    if (mLeft) mLeft.textContent = toFa(left);

    const ri = document.getElementById('lr-reward-inline');
    if (ri) ri.textContent = reward;
    const rc = document.getElementById('lr-redeem-counts');
    if (rc) rc.textContent = `${toFa(current)} از ${toFa(target)}`;

    applyCtaText(chooseCtaText(current, target));
    updateSticky(current, target);

    // برای هندلرها
    data.dataset.current = String(current);
  }

  // ------- EVENTS -------
  function bindEvents() {
    const data = document.getElementById('lr-data');

    document.getElementById('lr-rules')?.addEventListener('click', () => {
      document.getElementById('lr-rules-content').textContent = data.dataset.rules || '';
      openModal(document.getElementById('lrRulesModal'));
    });

    document.querySelectorAll('#lrRulesModal [data-close], #lrRedeemModal [data-close]').forEach(b=>{
      b.addEventListener('click', e => closeModal(e.target.closest('[role="dialog"]')));
    });
    ['lrRulesModal','lrRedeemModal'].forEach(id=>{
      const m = document.getElementById(id);
      if (m) m.addEventListener('click', e => { if (e.target.hasAttribute('data-close')) closeModal(m); });
    });
    document.addEventListener('keydown', e => {
      if (e.key==='Escape') ['lrRulesModal','lrRedeemModal'].forEach(id=>{
        const m=document.getElementById(id); if(m && !m.classList.contains('hidden')) closeModal(m);
      });
    });

    // --- CTA ---
    async function goCTA() {
      const data = document.getElementById('lr-data');
      if (!data) return;

      // اطمینان از وضعیت به‌روز احراز هویت قبل از ادامه
      if (AUTH.user === null) {
        try {
          AUTH = await adapters.getAuth();
        } catch (_) {}
      }

      const target  = parseInt(data.dataset.goal  || '10', 10);
      const current = parseInt(data.dataset.current || '0', 10);

      // اگر کاربر لاگین نیست ولی CTA «رزرو اولین نوبت» است، مستقیم وارد ویزارد شو
      const ctaText    = document.getElementById('lr-cta-label')?.textContent?.trim();
      const isFirstCTA = (ctaText === 'رزرو اولین نوبت') || (!AUTH.loggedIn && !HAS_BOOKED_BEFORE);

      // در حالت میهمان، مستقیماً ویزارد رزرو باز شود و دیگر کاربر مجبور به ورود نباشد
      if (!AUTH.loggedIn && !isFirstCTA) {
        toast('برای ذخیره امتیازات، ورود پیشنهاد می‌شود');
      }

      if (current >= target && AUTH.loggedIn) {
        openModal(document.getElementById('lrRedeemModal'));
        return;
      }

      // قفل رزرو تا تایید قبلی
      const lsHasPending = () => {
        try {
          const b = JSON.parse(localStorage.getItem('vt:lastBooking') || 'null');
          return !!(b && b.status === 'pending');
        } catch(e){ return false; }
      };
      const hasPending =
        typeof window.hasPendingBooking === 'function'
          ? await window.hasPendingBooking()
          : lsHasPending();

      if (hasPending) {
        if (typeof window.openModalById === 'function' && document.getElementById('pendingBlockModal')) {
          window.openModalById('pendingBlockModal');
        } else if (typeof showToastDark === 'function') {
          showToastDark('نوبت قبلی‌ت هنوز تایید نشده. لطفاً صبر کنی تا تأیید بشه ✋', { type: 'info' });
        } else {
          alert('نوبت قبلی هنوز تایید نشده است.');
        }
        return;
      }

      // باز کردن ویزارد رزرو
      if (typeof window.openBookingWizard === 'function') {
        window.openBookingWizard();
        return;
      }

      const ids = ['booking-wizard', 'booking', 'reserve', 'reservation'];
      let el = null;
      for (const id of ids) { const t = document.getElementById(id); if (t) { el = t; break; } }
      if (el) {
        if (el.classList.contains('hidden')) el.classList.remove('hidden');
        const top = el.getBoundingClientRect().top + window.scrollY - 80;
        (reduce() ? window.scrollTo(0, top) : window.scrollTo({ top, behavior:'smooth' }));
      } else {
        const url = data.dataset.bookingUrl;
        if (url) window.location.href = url; else toast('بخش رزرو هنوز بالا نیومده');
      }
    }

    document.getElementById('lr-cta')?.addEventListener('click', goCTA);
    document.getElementById('lr-cta-mobile')?.addEventListener('click', goCTA);

    // تأیید دریافت جایزه -> ارسال درخواست به فروشنده و ریست پیشرفت
    document.getElementById('lr-redeem-confirm')?.addEventListener('click', async () => {
      if (!AUTH.loggedIn) { requireLogin(); return; }
      const storeId = document.body?.dataset?.storeId || document.body?.dataset?.sellerId;
      document.getElementById('lr-redeem-body').classList.add('hidden');
      document.getElementById('lr-redeem-done').classList.remove('hidden');
      try {
        await fetch('/api/loyalty/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ storeId })
        });
        await fetch('/api/loyalty', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ storeId, completed: 0 })
        });
      } catch (_) {}
      setTimeout(() => {
        localStorage.setItem(KEY_PROGRESS, '0');
        data.dataset.current = '0';
        closeModal(document.getElementById('lrRedeemModal'));
        document.getElementById('lr-redeem-done').classList.add('hidden');
        document.getElementById('lr-redeem-body').classList.remove('hidden');
        toast('درخواست جایزه ثبت شد', 'success');
        initCard();
      }, 250);
    });

    // ====== شمارشِ امن رزروهای تایید شده (Patch) ======
    const KEY_COUNTED = 'vit_loyalty_counted_ids'; // لیست رزروهایی که شمرده‌ایم

    const _getCounted = () => {
      try { return new Set(JSON.parse(localStorage.getItem(KEY_COUNTED) || '[]')); }
      catch { return new Set(); }
    };
    const _setCounted = (set) => {
      try { localStorage.setItem(KEY_COUNTED, JSON.stringify([...set])); } catch {}
    };
    const _extractBookingId = (b) => {
      if (!b) return null;
      return (
        b.bookingId || b.id || b._id ||
        // fallback اگر بک‌اند id نده
        [b.sellerId||'', b.phone||'', b.date||'', b.time||''].join('|')
      );
    };

    // وضعیت‌های مختلف برگشتی را به شکل یکسان نرمال می‌کند
    const normalizeStatus = (s = '') => {
      s = String(s).toLowerCase().trim();
      if ([
        'confirmed','approve','approved','accept','accepted','done',
        'completed','success','ok','تایید','تایید شده','موفق'
      ].includes(s)) return 'confirmed';
      if ([
        'rejected','declined','canceled','cancelled','failed',
        'no-show','noshow','رد','لغو','لغو شده'
      ].includes(s)) return 'rejected';
      return 'pending';
    };

    function syncFromConfirmedBooking(source = 'event', booking = null) {
      const data = document.getElementById('lr-data');
      if (!data) return;

      // Allow passing the booking object directly to avoid re-reading from storage
      let b = booking;
      if (!b) {
        try { b = JSON.parse(localStorage.getItem('vt:lastBooking') || 'null'); } catch {}
      }

      // Only proceed if seller has approved the booking
      if (!b || normalizeStatus(b.status) !== 'confirmed') return;

      // Prevent counting the same booking multiple times (e.g. when no id is provided)
      if (b._countedForLoyalty) return;

      const bookingId = _extractBookingId(b);
      const counted = _getCounted();

      // اگر قبلاً این رزرو شمرده شده، خروج
      if (bookingId && counted.has(bookingId)) return;

      // افزایش‌ها
      const cur   = parseInt(localStorage.getItem(KEY_PROGRESS) ?? data.dataset.current ?? '0', 10) || 0;
      const next  = cur + 1;
      localStorage.setItem(KEY_PROGRESS, String(next));

      const total = parseInt(localStorage.getItem(KEY_TOTAL) || '0', 10) || 0;
      localStorage.setItem(KEY_TOTAL, String(total + 1));

      // علامت‌گذاری این رزرو
      if (bookingId) { counted.add(bookingId); _setCounted(counted); }
      b._countedForLoyalty = true;
      try { localStorage.setItem('vt:lastBooking', JSON.stringify(b)); } catch {}

      HAS_BOOKED_BEFORE = true;

      if (AUTH.loggedIn) {
        const storeId = document.body?.dataset?.storeId || document.body?.dataset?.sellerId;
        fetch('/api/loyalty', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ storeId, completed: next })
        }).catch(() => {});
      }

      // نوتیف/رفرش UI
      const target = parseInt(data.dataset.goal || '10', 10);
      if (cur < target && next >= target) toast('تبریک! به جایزه رسیدی 🎉', 'success');

      data.dataset.current = String(next);
      initCard();
    }


    // Enhanced booking status checker with retry logic
function setupEnhancedStatusCheck() {
  let retryCount = 0;
  const maxRetries = 3;
  
  // Check on page load
  setTimeout(async () => {
    const b = JSON.parse(localStorage.getItem('vt:lastBooking') || 'null');
    if (b && normalizeStatus(b.status) === 'pending') {
      console.log('[Loyalty] Checking pending booking on load:', b);
      
      // Retry logic for better reliability
      while (retryCount < maxRetries) {
        const stillPending = await window.hasPendingBooking();
        if (!stillPending) {
          console.log('[Loyalty] Booking confirmed after retry', retryCount + 1);
          syncFromConfirmedBooking('enhanced-check');
          break;
        }
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between retries
      }
    }
  }, 1000);

  // Also check when page becomes visible (user returns to tab)
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      const b = JSON.parse(localStorage.getItem('vt:lastBooking') || 'null');
      if (b && normalizeStatus(b.status) === 'pending') {
        console.log('[Loyalty] Checking booking on visibility change');
        const stillPending = await window.hasPendingBooking();
        if (!stillPending) {
          syncFromConfirmedBooking('visibility-change');
        }
      }
    }
  });
}

// Call this function right after the loyalty system initialization
setupEnhancedStatusCheck();

    // وقتی وضعیت از بخش Booking Gate می‌آید
    window.addEventListener('booking:status', (e) => {
      if (normalizeStatus(e?.detail?.status) === 'confirmed') {
        syncFromConfirmedBooking('booking:status');
      }
    });

    // همگام‌سازی بین تب‌ها
    window.addEventListener('storage', (e) => {
      if (e.key === 'vt:lastBooking') {
        try {
          const v = JSON.parse(e.newValue || 'null');
          if (normalizeStatus(v?.status) === 'confirmed') {
            syncFromConfirmedBooking('storage');
          }
        } catch {}
      }
    });

    // چک دوره‌ای سبک (وقتی pending است)
// Change the interval from 30000 (30 seconds) to 10000 (10 seconds)
setInterval(async () => {
  try {
    const b = JSON.parse(localStorage.getItem('vt:lastBooking') || 'null');
    if (b && normalizeStatus(b.status) === 'pending' && typeof window.hasPendingBooking === 'function') {
      console.log('[Loyalty] Periodic check for pending booking');
      const stillPending = await window.hasPendingBooking();
      if (!stillPending) {
        syncFromConfirmedBooking('poll');
      }
    }
  } catch (err) {
    console.error('[Loyalty] Periodic check error:', err);
  }
}, 10000); // Changed from 30000 to 10000

    // یک‌بار روی لود صفحه
    // چون این تابع پس از DOMContentLoaded فراخوانی می‌شود،
    // اضافه کردن لیسنر به این رویداد مؤثر نبود و شمارش اولیه انجام نمی‌شد.
    // بنابراین مستقیماً آن را اجرا می‌کنیم تا در صورت وجود رزرو تایید شده
    // پیشرفت باشگاه به‌روزرسانی شود.
    syncFromConfirmedBooking('boot');

    // مخفی‌کردن استیکی وقتی CTA داخل ویو
    const stickyWrap = document.getElementById('lr-sticky');
    const cta = document.getElementById('lr-cta');
    if (stickyWrap && cta && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          stickyWrap.style.transform = entry.isIntersecting ? 'translateY(100%)' : 'translateY(0)';
        });
      }, { threshold: 0.5 });
      io.observe(cta);
    }
  }

  // ------- BOOTSTRAP -------
  async function initAuthAndHistory() {
    AUTH = await adapters.getAuth();
    const sum = await adapters.getBookingSummary(AUTH.user?.id);
    HAS_BOOKED_BEFORE = (sum?.total || 0) > 0;
    if (AUTH.loggedIn) {
      const storeId = document.body?.dataset?.storeId || document.body?.dataset?.sellerId;
      if (storeId) {
        const prog = await adapters.getLoyaltyProgress(storeId);
        const val = parseInt(prog?.completed, 10) || 0;
        const data = document.getElementById('lr-data');
        if (data) {
          data.dataset.current = String(val);
          try { localStorage.setItem(KEY_PROGRESS, String(val)); } catch {}
        }
      }
    }
    initCard();
  }

  // با هر تغییر لاگین/کاربر، کارت دوباره محاسبه می‌شود
  document.addEventListener('auth:changed', initAuthAndHistory);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bindEvents(); initAuthAndHistory(); });
  } else {
    bindEvents();
    initAuthAndHistory();
  }
})();

document.addEventListener('DOMContentLoaded', async function() {
  // ====== Elements ======
  const reviewsModal = document.getElementById('reviewsModal');
  const reviewsModalContent = document.getElementById('reviews-modal-content');
  const showAllBtn = document.getElementById('show-all-reviews');
  const closeReviewsBtn = document.getElementById('close-reviews-modal');
  const reviewsBackdrop = document.getElementById('reviews-backdrop');

  const reviewFormModal = document.getElementById('reviewFormModal');
  const reviewFormContent = document.getElementById('review-form-content');
  const writeReviewBtn = document.getElementById('write-review-btn');
  const writeReviewModalBtn = document.getElementById('write-review-modal-btn');
  const closeReviewFormBtn = document.getElementById('close-review-form');
  const reviewFormBackdrop = document.getElementById('review-form-backdrop');
  const cancelReviewBtn = document.getElementById('cancel-review');

  const rateNowChip = document.getElementById('rate-now-chip');
  if (rateNowChip) rateNowChip.addEventListener('click', () => writeReviewBtn?.click());

  function setReviewActions(enabled) {
    [showAllBtn, writeReviewBtn, writeReviewModalBtn, rateNowChip].forEach(btn => {
      if (!btn) return;
      btn.disabled = !enabled;
      btn.classList.toggle('hidden', !enabled);
    });
  }

  // ====== Form refs ======
  const reviewForm = document.getElementById('review-form');
  const ratingStars = document.querySelectorAll('.rating-star');
  const ratingText = document.getElementById('rating-text');
  const reviewTextarea = document.getElementById('review-text');
  const charCounter = document.getElementById('char-counter');
  const submitBtn = document.getElementById('submit-review');
  const serviceSelect = document.getElementById('service-used');

  // Populate service dropdown when services are loaded
  document.addEventListener('services:loaded', e => {
    if (!serviceSelect) return;
    const items = Array.isArray(e.detail) ? e.detail.filter(it => it.isActive) : [];
    serviceSelect.innerHTML = '<option value="">انتخاب کنید...</option>';
    items.forEach(it => {
      const title = it.title || '';
      const opt = document.createElement('option');
      opt.value = title;
      opt.textContent = title;
      serviceSelect.appendChild(opt);
    });
  });

  // ====== Helpers ======
  const toFa = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const toFaNum = n => toFa(String(n));
  const escapeHTML = (str='') => str
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  // آپدیت همه المان‌هایی که id تکراری دارند
  const qAllId = (id) => Array.from(document.querySelectorAll(`[id="${id}"]`));
  const setTextAllById = (id, text) => qAllId(id).forEach(el => el && (el.textContent = text));
  const setHTMLAllById = (id, html) => qAllId(id).forEach(el => el && (el.innerHTML = html));

  function showToast(msg, type='info'){ try { showToastDark(msg, {type}); } catch(_) { console.log(type.toUpperCase()+':', msg); } }

  const TOKEN_KEYS = ['access_token', 'token', 'jwt'];
  function getToken() {
    let t = null;
    for (const k of TOKEN_KEYS) {
      const val = localStorage.getItem(k);
      if (val) { t = val; break; }
    }
    if (!t) return null;
    try {
      const payload = JSON.parse(atob(t.split('.')[1] || ''));
      if (payload.exp * 1000 < Date.now()) {
        TOKEN_KEYS.forEach(k => localStorage.removeItem(k));
        return null;
      }
    } catch (_) {
      return null;
    }
    return t;
  }
  function clearToken() {
    TOKEN_KEYS.forEach(k => localStorage.removeItem(k));
  }
  const authHeaders = () => {
    const t = getToken();
    return t ? { 'Authorization': 'Bearer ' + t } : {};
  };

  // ====== Identity / Scope ======
  const body = document.body;
  const storeId = body?.dataset?.storeId || 'default';
  // مقادیر shopurl و sellerId بعداً تعیین می‌شن
  let shopurl = '';
  let sellerId = null;
  let reviewsData = [];

  const userId = window.__APP_USER__?.id;
  const isAdmin = window.__APP_USER__?.isAdmin || window.__APP_USER__?.role === 'admin';

  const reviewKey = userId ? `review:last:${storeId}:${userId}` : `review:last:${storeId}`;
  const ratingKey = userId ? `review:rated:${storeId}:${userId}` : `review:rated:${storeId}`;
  function canSubmitReview() {
    if (isAdmin) return true;
    const last = localStorage.getItem(reviewKey);
    return !last || (Date.now() - parseInt(last || '0', 10)) > 86400000; // 24h
  }
  function markReviewSubmitted() {
    localStorage.setItem(reviewKey, Date.now().toString());
  }
  function getStoredRating() {
    const r = parseInt(localStorage.getItem(ratingKey) || '0', 10);
    return isNaN(r) ? 0 : r;
  }
  function hasRated() {
    return getStoredRating() > 0;
  }
  function markRated(rating) {
    localStorage.setItem(ratingKey, String(rating || 1));
  }
  function updateSubmitState() {
    if (!submitBtn) return;
    if (canSubmitReview()) {
      submitBtn.disabled = false;
      submitBtn.removeAttribute('title');
    } else {
      submitBtn.disabled = true;
      submitBtn.title = 'روزانه یک نظر می‌تونی ثبت کنی.';
      showToast('روزانه یک نظر می‌تونی ثبت کنی.', 'info');
    }
  }

  // ====== Stars ======
  function starHtml(score, size='text-xs') {
    let html = '';
    for (let i=1;i<=5;i++){
      if (score >= i) html += `<i class="fas fa-star text-yellow-400 ${size}"></i>`;
      else if (score >= i-0.5) html += `<i class="fas fa-star-half-alt text-yellow-400 ${size}"></i>`;
      else html += `<i class="far fa-star text-gray-300 ${size}"></i>`;
    }
    return html;
  }
  function setStars(el, score, size='text-sm'){ if(el) el.innerHTML = starHtml(score, size); }
  function setStarsAllById(id, score, size='text-sm'){ qAllId(id).forEach(el => setStars(el, score, size)); }

  // ====== Data I/O ======
  async function fetchByUrl(url) {
    const res = await fetch(url, { credentials: 'include' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('HTTP '+res.status);
    return res.json();
  }

  async function loadReviews() {
    try {
      // Ensure we have the latest identifiers in case other scripts set them later
      if (!shopurl) {
        shopurl = document.body?.dataset?.shopurl || '';
      }
      if (!sellerId) {
        sellerId = document.body?.dataset?.sellerId || window.LAST_PUBLIC?.sellerId || null;
      }

      let data = null;

      if (shopurl) {
        // حالت معمول: از URL شاپ می‌گیریم
        data = await fetchByUrl(`/api/shopAppearance/url/${encodeURIComponent(shopurl)}`);
        sellerId = data?.sellerId || sellerId;
      } else if (sellerId) {
        // fallback اگر shopurl نبود ولی sellerId داریم
        data = await fetchByUrl(`/api/shopAppearance/${encodeURIComponent(sellerId)}`);
      }

      if (!sellerId) {
        showToast('sellerId یا shopurl مشخص نیست؛ ثبت نظر غیرممکنه.', 'error');
        renderReviews([]); // خالی
        updateSummary(0, 0, []);
        setReviewActions(false);
        return;
      }

      if (!/^[0-9a-fA-F]{24}$/.test(sellerId)) {
        showToast('شناسه فروشنده نامعتبر است', 'error');
        renderReviews([]);
        updateSummary(0, 0, []);
        setReviewActions(false);
        return;
      }

      const reviewsRes = await fetchByUrl(`/api/shopAppearance/${encodeURIComponent(sellerId)}/reviews`);
      reviewsData = Array.isArray(reviewsRes) ? reviewsRes : (reviewsRes?.reviews || []);
      const avg = typeof data?.averageRating === 'number'
                    ? data.averageRating
                    : (reviewsData.length ? (reviewsData.reduce((s,r)=>s+(+r.score||0),0) / reviewsData.length) : 0);
      const cnt = typeof data?.ratingCount === 'number'
                    ? data.ratingCount
                    : reviewsData.length;

      updateSummary(avg, cnt, reviewsData);
      renderReviews(reviewsData);
      setReviewActions(true);
    } catch (err) {
      console.error('load reviews failed', err);
      showToast('لود نظرات ناموفق بود.', 'error');
      renderReviews([]);
      updateSummary(0, 0, []);
      setReviewActions(false);
    }
  }

  // ====== Render ======
  function renderReviews(list) {
    const reviews = Array.isArray(list) ? list : (list?.reviews || []);
    const container = document.getElementById('reviews-container');
    const modalList = document.getElementById('reviews-list');
    if (container) container.innerHTML = '';
    if (modalList) modalList.innerHTML = '';
    const sellerLocal = (() => {
      try { return JSON.parse(localStorage.getItem('seller') || 'null'); }
      catch (_) { return null; }
    })();
    const isOwner = sellerLocal && (sellerLocal._id === document.body.dataset.sellerId || sellerLocal.id === document.body.dataset.sellerId);

    if (!reviews.length) {
      container && (container.innerHTML = '<div class="w-full text-center text-gray-500 py-8">هنوز نظری ثبت نشده است.</div>');
      modalList && (modalList.innerHTML = '<div class="w-full text-center text-gray-500 py-4">هنوز نظری ثبت نشده است.</div>');
      return;
    }

    reviews.forEach(r => {
      const id = r._id || r.id;
      const rawName =
        r.userName ||
        (r.userId && typeof r.userId === 'object'
          ? [r.userId.firstname, r.userId.lastname].filter(Boolean).join(' ')
          : '');
      const name = escapeHTML(rawName || 'کاربر');
      // Ensure the review date is displayed correctly in Tehran timezone
      const date = r.createdAt
        ? new Date(r.createdAt).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })
        : '';
      const comment = escapeHTML(r.comment || '');
      const score = Math.max(1, Math.min(5, Number(r.score) || 0));
      const stars = starHtml(score);

      container && container.insertAdjacentHTML('beforeend', `
        <div class="review-card flex-shrink-0 w-80 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 p-5" data-id="${id}">
          <div class="flex items-start justify-between mb-3">
            <div>
              <h4 class="font-bold text-gray-900 mb-1">${name}</h4>
              <div class="flex items-center gap-1">${stars}</div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">${escapeHTML(date)}</span>
              ${isOwner ? `<button class="delete-review text-gray-400 hover:text-red-500 transition-colors" title="حذف نظر"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
          </div>
          <p class="text-sm text-gray-700 leading-6">${comment}</p>
        </div>
      `);

      modalList && modalList.insertAdjacentHTML('beforeend', `
        <div class="review-item bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-shadow" data-rating="${score}" data-id="${id}">
          <div class="flex items-start justify-between mb-3">
            <div>
              <h4 class="font-bold text-gray-900 mb-1">${name}</h4>
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-1">${stars}</div>
                <span class="text-xs text-gray-400">•</span>
                <span class="text-xs text-gray-500">${escapeHTML(date)}</span>
              </div>
            </div>
            ${isOwner ? `<button class="delete-review text-gray-400 hover:text-red-500 transition-colors" title="حذف نظر"><i class="fa-solid fa-trash"></i></button>` : ''}
          </div>
          <div class="review-text-container">
            <p class="text-sm text-gray-700 leading-7 review-text">${comment}</p>
          </div>
        </div>
      `);
    });
  }

  const reviewEls = [document.getElementById('reviews-container'), document.getElementById('reviews-list')];
  reviewEls.forEach(el => {
    el?.addEventListener('click', async e => {
      const btn = e.target.closest('.delete-review');
      if (!btn) return;
      const card = btn.closest('[data-id]');
      const id = card?.dataset?.id;
      if (!id) return;
      try {
        const res = await fetch(`${API_ROOT}/api/shopAppearance/reviews/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (!res.ok) throw new Error();
        reviewsData = reviewsData.filter(r => String(r._id || r.id) !== String(id));
        card.remove();
        const avg = reviewsData.length ? (reviewsData.reduce((s,r)=>s+(+r.score||0),0) / reviewsData.length) : 0;
        updateSummary(avg, reviewsData.length, reviewsData);
        showToast('نظر حذف شد', 'success');
      } catch(err) {
        showToast('حذف نظر ناموفق بود', 'error');
      }
    });
  });

function updateSummary(avg, count, ratings) {
  // ستاره‌ها
  setStarsAllById('review-stars', avg, 'text-xs');
  setStars(document.getElementById('modal-stars'), avg, 'text-xs');
  setStars(document.getElementById('summary-stars'), avg, 'text-sm');

  // میانگین
  const avgStr = toFa((Number(avg)||0).toFixed(1).replace('.', '٫'));
  setTextAllById('review-average', avgStr);
  setTextAllById('avg-rating', avgStr);
  
  // Update header ratings
  const avgEn = (Number(avg)||0).toFixed(1);
  const headerRatingMobile = document.getElementById('header-rating-mobile');
  if (headerRatingMobile) headerRatingMobile.textContent = avgStr;
  const headerRatingLg = document.getElementById('header-rating-lg');
  if (headerRatingLg) headerRatingLg.textContent = avgStr;
  
  const modalAvg = document.getElementById('modal-average');
  if (modalAvg) modalAvg.textContent = avgStr;
  const bigAvg = document.getElementById('summary-average');
  if (bigAvg) bigAvg.textContent = avgStr;

  // تعداد
  const cntStr = toFaNum(count || 0);
  setTextAllById('review-count', cntStr);
  setTextAllById('review-count-text', `(${cntStr} نظر)`);
  
  // Update header counts
  const headerCountMobile = document.getElementById('header-count-mobile');
  if (headerCountMobile) headerCountMobile.textContent = cntStr;
  const headerCountLg = document.getElementById('header-count-lg');
  if (headerCountLg) headerCountLg.textContent = cntStr;
  
  const modalCount = document.getElementById('modal-count');
  if (modalCount) modalCount.textContent = `بر اساس ${cntStr} نظر`;
  const bigCount = document.getElementById('summary-count');
  if (bigCount) bigCount.textContent = `${cntStr} نظر ثبت شده`;

  // توزیع 1..5
  const totals = [0,0,0,0,0];
  (ratings||[]).forEach(r => {
    const s = Math.max(1, Math.min(5, Number(r.score)||0));
    totals[s-1] += 1;
  });
  for (let s=1; s<=5; s++){
    const bar = document.getElementById(`bar-${s}`);
    const span = document.getElementById(`count-${s}`);
    const c = totals[s-1];
    const pct = count ? (c / count) * 100 : 0;
    if (bar) bar.style.width = `${pct}%`;
    if (span) span.textContent = toFaNum(c);
  }
}

  // ====== Modals ======
  function openReviewsModal(){
    if (!reviewsModal) return;
    reviewsModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => reviewsModal.classList.add('show'), 10);
  }
  function closeReviewsModal() {
    if (!reviewsModal) return;
    reviewsModal.classList.remove('show');
    setTimeout(() => {
      reviewsModal.classList.add('hidden');
      document.body.style.overflow = '';
    }, 300);
  }
  function openReviewForm() {
    if (!reviewFormModal) return;
    reviewFormModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => reviewFormModal.classList.add('show'), 10);
    updateSubmitState();
    updateRatingState();
  }
  function closeReviewFormModal() {
    if (!reviewFormModal) return;
    reviewFormModal.classList.remove('show');
    setTimeout(() => {
      reviewFormModal.classList.add('hidden');
      document.body.style.overflow = '';
      // reset
      reviewForm?.reset();
      selectedRating = 0;
      ratingStars.forEach(star => {
        star.classList.remove('fas','filled');
        star.classList.add('far');
      });
      if (ratingText) ratingText.textContent = '';
      if (charCounter) charCounter.textContent = toFaNum('0/50');
    }, 300);
  }

  showAllBtn?.addEventListener('click', openReviewsModal);
  closeReviewsBtn?.addEventListener('click', closeReviewsModal);
  reviewsBackdrop?.addEventListener('click', closeReviewsModal);

  writeReviewBtn?.addEventListener('click', openReviewForm);
  writeReviewModalBtn?.addEventListener('click', openReviewForm);
  closeReviewFormBtn?.addEventListener('click', closeReviewFormModal);
  reviewFormBackdrop?.addEventListener('click', closeReviewFormModal);
  cancelReviewBtn?.addEventListener('click', closeReviewFormModal);

  // ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (reviewsModal && !reviewsModal.classList.contains('hidden')) closeReviewsModal();
      if (reviewFormModal && !reviewFormModal.classList.contains('hidden')) closeReviewFormModal();
    }
  });

  // Swipe close (mobile)
  function setupSwipeToClose(modalContent, closeFn){
    if (!modalContent) return;
    let startY=0, currentY=0, dragging=false;
    modalContent.addEventListener('touchstart', (e)=>{ if (innerWidth<=640){ startY=e.touches[0].clientY; dragging=true; }});
    modalContent.addEventListener('touchmove', (e)=>{ if(!dragging||innerWidth>640)return; currentY=e.touches[0].clientY; const dy=Math.max(0,currentY-startY); if(dy>0) modalContent.style.transform=`translateY(${dy}px)`; });
    modalContent.addEventListener('touchend', ()=>{ if(!dragging||innerWidth>640)return; const dy=currentY-startY; if(dy>100) closeFn(); else modalContent.style.transform=''; dragging=false; });
  }
  setupSwipeToClose(reviewsModalContent, closeReviewsModal);
  setupSwipeToClose(reviewFormContent, closeReviewFormModal);

  // ====== Filters ======
  const filterChips = document.querySelectorAll('.review-filter-chip');
  filterChips.forEach(chip=>{
    chip.addEventListener('click', function(){
      filterChips.forEach(c=>c.classList.remove('active'));
      this.classList.add('active');
      const filter = this.dataset.filter;
      document.querySelectorAll('.review-item').forEach(review=>{
        review.style.display = (filter==='all' || String(review.dataset.rating)===String(filter)) ? '' : 'none';
      });
    });
  });

  // ====== Rating UI ======
  const ratingMessages = ['', 'ضعیف', 'متوسط', 'خوب', 'عالی', 'فوق‌العاده'];
  let selectedRating = 0;

  function updateStars(rating){
    ratingStars.forEach((star, idx) => {
      if (idx < rating) {
        star.classList.remove('far');
        star.classList.add('fas','filled');
      } else {
        star.classList.remove('fas','filled');
        star.classList.add('far');
      }
    });
  }

  ratingStars.forEach(star=>{
    star.addEventListener('click', function(){
      selectedRating = parseInt(this.dataset.rating, 10) || 0;
      updateStars(selectedRating);
      if (ratingText) ratingText.textContent = ratingMessages[selectedRating] || '';
    });
    star.addEventListener('mouseenter', function(){
      const hover = parseInt(this.dataset.rating, 10) || 0;
      updateStars(hover);
      if (ratingText) ratingText.textContent = ratingMessages[hover] || '';
    });
  });
  document.querySelector('.rating-stars')?.addEventListener('mouseleave', function(){
    updateStars(selectedRating);
    if (ratingText) ratingText.textContent = selectedRating ? (ratingMessages[selectedRating]||'') : '';
  });

  function updateRatingState(){
    const stored = getStoredRating();
    if (stored > 0) {
      selectedRating = stored;
      updateStars(selectedRating);
      if (ratingText) ratingText.textContent = ratingMessages[selectedRating] || '';
      ratingStars.forEach(star => star.style.pointerEvents = 'none');
    } else {
      ratingStars.forEach(star => star.style.pointerEvents = '');
    }
  }

  // ====== Char counter ======
  reviewTextarea?.addEventListener('input', function(){
    let val = this.value;
    if (val.length > 50) { val = val.slice(0,50); this.value = val; }
    if (charCounter) charCounter.textContent = toFa(`${val.length}/50`);
  });
  if (charCounter) charCounter.textContent = toFa('0/50');

  // ====== Submit ======
  const POST_ENDPOINT = (sid) => `/api/shopAppearance/${encodeURIComponent(sid)}/rate`;

  reviewForm?.addEventListener('submit', async function(e){
    e.preventDefault();

    const storedRating = getStoredRating();
    const alreadyRated = storedRating > 0;
    if (alreadyRated && selectedRating !== storedRating) {
      showToast('امکان تغییر امتیاز وجود ندارد.', 'info');
      return;
    }
    if (!canSubmitReview()) { showToast('روزانه یک نظر می‌تونی ثبت کنی.', 'info'); return; }
    if (alreadyRated) {
      selectedRating = storedRating;
    }
    if (!selectedRating) { showToast('لطفاً امتیاز بده 🙂', 'info'); return; }
    if (!reviewTextarea || reviewTextarea.value.trim().length < 5) { showToast('متن نظر حداقل ۵ کاراکتر باشه.', 'error'); return; }

    // مطمئن شو sellerId داریم و معتبره
    if (!sellerId) {
      // تلاش آخر: دوباره از سرور بگیر
      try { await loadReviews(); } catch {}
    }
    if (!sellerId || !/^[0-9a-fA-F]{24}$/.test(sellerId)) {
      showToast(sellerId ? 'شناسه فروشنده نامعتبر است' : 'sellerId نامشخصه؛ ثبت نظر ممکن نیست.', 'error');
      return;
    }

      const firstReview = !localStorage.getItem(reviewKey);
      if (firstReview) {
        const bookings = JSON.parse(localStorage.getItem('vitreenet-bookings') || '[]');
        const hasApproved = bookings.some(b => ['confirmed','completed'].includes(b.status));
        if (!hasApproved) {
          showToast('برای ثبت نظر باید حداقل یک نوبت تایید شده داشته باشید.', 'error');
          return;
        }
      }
      const token = getToken();

    const payload = {
      rating: selectedRating,
      comment: reviewTextarea.value.trim()
    };

    // Loading state
    const old = submitBtn?.innerHTML;
    if (submitBtn){
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>در حال ارسال...';
    }

    // می‌بندیم که UX روون بشه، ولی اگر خطا بود توست می‌دیم
    closeReviewFormModal();

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = 'Bearer ' + token;
        const res = await fetch(POST_ENDPOINT(sellerId), {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      if (res.status === 401) {
        clearToken();
        showToast('نشست شما منقضی شده؛ لطفاً دوباره وارد شوید.', 'error');
        return;
      }
      if (!res.ok) throw new Error('HTTP '+res.status);

      markReviewSubmitted();
      if (!alreadyRated) markRated(selectedRating);
      showToast('نظر ثبت شد و پس از تایید نمایش داده می‌شود 🙌', 'success');
      await loadReviews();
    } catch (err) {
      console.error('submit review failed', err);
      showToast('خطا در ثبت نظر', 'error');
    } finally {
      if (submitBtn){
        submitBtn.disabled = false;
        submitBtn.innerHTML = old || 'ارسال نظر';
      }
    }
  });

  // ====== Boot ======
  const loc = await getShopUrlFromLocation();
  if (typeof loc === 'object') {
    shopurl = loc.shopurl || '';
    if (loc.sellerId) sellerId = loc.sellerId;
  } else {
    shopurl = loc || '';
  }
  if (!shopurl && !sellerId) {
    shopurl = body?.dataset?.shopurl || '';
    sellerId = body?.dataset?.sellerId || null;
  }
  async function handleServicesLoaded() {
    sellerId = document.body?.dataset?.sellerId || null;
    await loadReviews();
  }

  document.addEventListener('services:loaded', handleServicesLoaded);

  if (document.body?.dataset?.sellerId) {
    await handleServicesLoaded();
  }
});

(function () {
    // سال شمسی با ارقام فارسی
    const yearEl = document.getElementById('footer-year');
    if (yearEl) {
      yearEl.textContent = new Intl.DateTimeFormat('fa-IR', { year: 'numeric' }).format(new Date());
    }

    // بازگشت به بالا با اسکرول نرم (رعایت Reduce Motion)
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const up = document.getElementById('back-to-top');
    if (up) {
      up.addEventListener('click', () => {
        if (prefersReduced) {
          window.scrollTo(0, 0);
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    // اسکرول نرم برای لینک‌های داخلی داخل فوتر (#anchor)
    document.querySelectorAll('#site-footer a[href^="#"]').forEach(a => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();

        if (prefersReduced) {
          target.scrollIntoView();
        } else {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // بهبود دسترس‌پذیری: فوکوس پس از اسکرول
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
    });
  })();

(() => {
  const nav = document.getElementById('mobile-bottom-nav');
  if (!nav) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = nav.querySelectorAll('.nav-item');

  const setActive = (key) => {
    items.forEach(btn => {
      const isActive = btn.dataset.nav === key;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  };

  const smoothGo = (target) => {
    if (!target) return;
    if (prefersReduced) target.scrollIntoView();
    else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const byId = (id) => document.getElementById(id);
  const bySel = (sel) => document.querySelector(sel);

  const findByHeading = (keyword) => {
    const hs = [...document.querySelectorAll('h1,h2,h3,h4')];
    const hit = hs.find(h => (h.textContent || '').includes(keyword));
    return hit ? (hit.closest('section') || hit) : null;
  };

  // Targets (with robust fallbacks)
  const targets = {
    home: () => document.documentElement,
    services: () => byId('services') || findByHeading('خدمات'),
    booking: () => byId('booking-wizard'),
    portfolio: () => byId('portfolio') || bySel('.portfolio-section') || findByHeading('نمونه کار'),
    profile: () => byId('profile') || findByHeading('پروفایل'),
  };

  // Click handlers
  items.forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.nav;

      if (key === 'home') {
        // لینک مستقیم به صفحه اصلی ویترینت
        window.location.href = 'local***index.html';
        return;
      }

      if (key === 'booking') {
        const wizard = byId('booking-wizard');
        const heroCta = byId('hero-cta');
        if (wizard && wizard.classList.contains('hidden')) {
          if (heroCta) heroCta.click();
          else wizard.classList.remove('hidden');
        }
        const t = targets.booking();
        if (t) {
          const top = t.getBoundingClientRect().top + window.scrollY - 80;
          if (prefersReduced) window.scrollTo(0, top);
          else window.scrollTo({ top, behavior: 'smooth' });
          setActive('booking');
        }
        return;
      }

      if (key === 'profile') {
        // انتقال به صفحه پروفایل کاربر
        window.location.href = 'service-seller-panel/s-profile.html';
        return;
      }

      const t = targets[key] && targets[key]();
      if (t) smoothGo(t);
      setActive(key);
    });
  });

  // Scroll spy (if supported)
  const spySections = [
    { key: 'services', el: targets.services() },
    { key: 'portfolio', el: targets.portfolio() },
    { key: 'profile',  el: targets.profile() },
  ].filter(s => s.el);

  if ('IntersectionObserver' in window && spySections.length) {
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter(e => e.isIntersecting)
                         .sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!vis) return;
      const hit = spySections.find(s => s.el === vis.target);
      if (hit) setActive(hit.key);
    }, { threshold: [0.35, 0.6], rootMargin: '-20% 0px -50% 0px' });
    spySections.forEach(s => io.observe(s.el));

    // Top of page = خانه
    window.addEventListener('scroll', () => {
      if (window.scrollY < 80) setActive('home');
    }, { passive: true });
  }

  // Initial state
  setActive('home');
})();

(function () {
    var badge = document.getElementById('vip-badge');
    var out   = document.getElementById('vip-count');
    if (!badge || !out) return;
    var n = Number(badge.getAttribute('data-count') || 0);
    out.textContent = new Intl.NumberFormat('fa-IR').format(n) + ' نفر';
  })();

/* پاپ‌اپ شیشه‌ای وسط صفحه + ترجمه پیام‌ها (Drop-in Replacement) */
(() => {
  const translate = (txt) => {
    if (!txt) return "";
    if (/You can submit one review per day/i.test(txt)) {
      return "روزانه فقط یک نظر می‌توانید ثبت کنید.";
    }
    return txt;
  };

  // همان امضای قبلی: showToastDark(message, {type, durationMs})
  window.showToastDark = function (message, { type = "info", durationMs = 2600 } = {}) {
    const palette = {
      success: { ring: "ring-emerald-200", icon: "text-emerald-600", ico: "fas fa-check" },
      info:    { ring: "ring-blue-200",    icon: "text-blue-600",    ico: "fas fa-info-circle" },
      error:   { ring: "ring-rose-200",    icon: "text-rose-600",    ico: "fas fa-exclamation-circle" }
    };
    const p = palette[type] || palette.info;

    // اگر قبلاً بازه، حذف کن
    const existing = document.getElementById("dark-toast");
    if (existing) existing.remove();

    // لایه‌ی پس‌زمینه (برای کلیک برای بستن)
    const overlay = document.createElement("div");
    overlay.id = "dark-toast";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.dir = "rtl";
    overlay.className =
      "fixed inset-0 z-[160] flex items-center justify-center p-4 " +
      "bg-black/30 backdrop-blur-sm opacity-0 transition-opacity duration-200";

    // کارت وسط صفحه
    const card = document.createElement("div");
    card.className =
      `relative w-full max-w-sm sm:max-w-md rounded-2xl bg-white/95 backdrop-blur-md ` +
      `shadow-2xl ring-1 ${p.ring} transform scale-95 opacity-0 transition-all duration-200`;

    // محتوای کارت
    const inner = document.createElement("div");
    inner.className = "px-5 py-4 flex items-start gap-3 text-slate-900";

    const icon = document.createElement("i");
    icon.className = `${p.ico} ${p.icon} text-xl mt-0.5`;

    const msg = document.createElement("div");
    msg.className = "text-[14px] leading-7 font-bold";
    msg.textContent = translate(message);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "بستن");
    closeBtn.className =
      "absolute top-2 left-2 w-9 h-9 rounded-full text-slate-500 " +
      "hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center";
    closeBtn.innerHTML = "&times;";

    inner.append(icon, msg);
    card.append(closeBtn, inner);
    overlay.append(card);
    document.body.appendChild(overlay);

    // انیمیشن نمایش
    requestAnimationFrame(() => {
      overlay.classList.remove("opacity-0");
      card.classList.remove("scale-95", "opacity-0");
    });

    // بستن با انیمیشن
    const remove = () => {
      overlay.classList.add("opacity-0");
      card.classList.add("scale-95", "opacity-0");
      setTimeout(() => overlay.remove(), 200);
      document.removeEventListener("keydown", onKey);
    };
    const onKey = (e) => { if (e.key === "Escape") remove(); };

    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) remove(); });
    closeBtn.addEventListener("click", (e) => { e.stopPropagation(); remove(); });

    // زمان‌بندی خودکار + توقف با Hover
    let timer = setTimeout(remove, durationMs);
    overlay.addEventListener("mouseenter", () => clearTimeout(timer));
    overlay.addEventListener("mouseleave", () => {
      timer = setTimeout(remove, 1200);
    });
  };

  // فارسی‌سازی Tooltip دکمه‌ی ارسال نظر در حالت محدودیت روزانه
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("submit-review");
    if (!btn) return;
    const apply = () => {
      if (/You can submit one review per day/i.test(btn.title || "")) {
        btn.title = "روزانه فقط یک نظر می‌توانید ثبت کنید.";
      }
    };
    apply();
    new MutationObserver(apply).observe(btn, { attributes: true, attributeFilter: ["title"] });
  });
})();

/* ===== Portfolio Likes (server-based) ===== */
(function(){
  'use strict';
  const API_BASE = (window.API_BASE || '').replace(/\/+$/, '');
  const toFa = n => String(n ?? 0).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

  const likeCache = new Map(); // id -> {liked, count}
  const guestLikes = (() => {
    const KEY = 'vit_portfolio_guest_likes';
    let cache = null;

    function load() {
      if (cache) return cache;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          cache = (parsed && typeof parsed === 'object') ? parsed : {};
        } else {
          cache = {};
        }
      } catch (_) {
        cache = {};
      }
      return cache;
    }

    function persist() {
      try {
        localStorage.setItem(KEY, JSON.stringify(cache || {}));
      } catch (_) {}
    }

    return {
      isLiked(id) {
        const store = load();
        return !!store[id];
      },
      toggle(id) {
        const store = load();
        const next = !store[id];
        if (next) store[id] = 1; else delete store[id];
        persist();
        return next;
      },
      set(id, liked) {
        const store = load();
        if (liked) {
          store[id] = 1;
        } else {
          delete store[id];
        }
        persist();
      },
      clear() {
        cache = {};
        persist();
      }
    };
  })();
  const pendingLikes = new Set();
  let authPromise = null;
  let lastAuthCheckedAt = 0;
  let lastAuthResult = window.__APP_USER__?.id ? true : null;

  async function ensureLoggedIn(){
    if (window.__APP_USER__?.id) {
      lastAuthResult = true;
      return true;
    }
    if (authPromise) return authPromise;
    const now = Date.now();
    if (lastAuthResult === false && now - lastAuthCheckedAt < 3000) {
      return false;
    }
    lastAuthCheckedAt = now;
    authPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/getCurrentUser`, {
          credentials: 'include'
        });
        if (!res.ok) return false;
        const data = await res.json().catch(() => null);
        if (data?.success && data.user) {
          window.__APP_USER__ = Object.assign({}, window.__APP_USER__ || {}, data.user);
          return true;
        }
      } catch (_) {}
      return false;
    })();
    const ok = await authPromise;
    authPromise = null;
    lastAuthResult = ok;
    return ok;
  }

  function updateWrapState(wrap, state, busy, counterEl){
    if (!wrap) return;
    const icon = wrap.querySelector('.fa-heart');
    if (icon) {
      icon.classList.toggle('far', !state.liked);
      icon.classList.toggle('fas', state.liked);
    }
    const counter = counterEl || wrap.querySelector('.js-likes');
    if (counter) counter.textContent = toFa(state.count);
    wrap.classList.toggle('text-red-500', state.liked);
    wrap.classList.toggle('text-rose-500', state.liked);
    if (wrap.tagName !== 'BUTTON') {
      wrap.setAttribute('role','button');
      wrap.setAttribute('tabindex','0');
    }
    wrap.setAttribute('aria-pressed', state.liked ? 'true' : 'false');
    wrap.title = state.liked ? 'لغو لایک' : 'پسندیدن';
    if ('disabled' in wrap) {
      wrap.disabled = busy;
    }
    wrap.classList.toggle('opacity-70', busy);
    wrap.classList.toggle('pointer-events-none', busy && wrap.tagName !== 'BUTTON');
    wrap.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function updateUI(id){
    const state = likeCache.get(id) || { liked:false, count:0 };
    const busy = pendingLikes.has(id);
    document.querySelectorAll(`.portfolio-card[data-item-id="${id}"]`).forEach(card => {
      const wrap = card.querySelector('[data-portfolio-like]') || card.querySelector('.fa-heart')?.parentElement;
      updateWrapState(wrap, state, busy);
    });

    if (window.__PF_ACTIVE_ID === id) {
      const mWrap = document.querySelector('#imageModal [data-portfolio-like]') || document.querySelector('#imageModal .fa-heart')?.parentElement;
      const mLikes = document.getElementById('modalLikes');
      updateWrapState(mWrap, state, busy, mLikes);
    }
  }

  function applyGuestToggle(id, baseState){
    const prev = baseState || likeCache.get(id) || { liked:false, count:0 };
    const nextLiked = guestLikes.toggle(id);
    let nextCount = prev.count;
    if (nextLiked !== prev.liked) {
      nextCount = Math.max(0, prev.count + (nextLiked ? 1 : -1));
    }
    likeCache.set(id, { liked: nextLiked, count: nextCount });
    updateUI(id);
  }

  async function toggle(id){
    if (!id || pendingLikes.has(id)) return;
    const prev = likeCache.get(id) || { liked:false, count:0 };
    const loggedIn = await ensureLoggedIn();
    if (!loggedIn) {
      applyGuestToggle(id, prev);
      return;
    }
    const optimistic = { liked: !prev.liked, count: Math.max(0, prev.count + (prev.liked ? -1 : 1)) };
    likeCache.set(id, optimistic);
    pendingLikes.add(id);
    updateUI(id);
    try {
      const res = await fetch(`${API_BASE}/api/portfolio/${id}/like`, {
        method:'POST',
        credentials:'include'
      });
      let data = null;
      try { data = await res.json(); } catch (_) {}
      if (res.status === 401) {
        lastAuthResult = false;
        lastAuthCheckedAt = Date.now();
        window.__APP_USER__ = null;
        likeCache.set(id, prev);
        applyGuestToggle(id, prev);
        return;
      }
      if (res.ok && data && typeof data.likeCount === 'number') {
        likeCache.set(id, { liked: !!data.liked, count: Math.max(0, data.likeCount) });
      } else {
        likeCache.set(id, prev);
        if (typeof window.showToastDark === 'function') {
          const msg = data?.message || 'ثبت پسند انجام نشد. دوباره تلاش کنید.';
          showToastDark(msg, { type:'danger' });
        }
      }
    } catch (_) {
      likeCache.set(id, prev);
      if (typeof window.showToastDark === 'function') {
        showToastDark('ثبت پسند انجام نشد. ارتباط برقرار نشد.', { type:'danger' });
      }
    } finally {
      pendingLikes.delete(id);
      updateUI(id);
    }
  }

  function bind(card){
    const id = card.dataset.itemId;
    if (!id || card.dataset.likeBound) return;
    card.dataset.likeBound = '1';
    const wrap = card.querySelector('[data-portfolio-like]') || card.querySelector('.fa-heart')?.parentElement;
    if (!wrap) return;
    wrap.addEventListener('click', e => { e.preventDefault(); toggle(id); });
    if (wrap.tagName !== 'BUTTON') {
      wrap.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle(id);
        }
      });
    }
  }

  function init(ev){
    const items = ev?.detail?.items || [];
    const isGuestUser = !(window.__APP_USER__ && window.__APP_USER__.id);
    items.forEach(it => {
      const rawCount = Number(it.likes);
      const count = Number.isFinite(rawCount) ? rawCount : 0;
      let state = { liked: !!it.liked, count };
      if (isGuestUser && !state.liked && guestLikes.isLiked(it.id)) {
        state = { liked: true, count: Math.max(0, count + 1) };
      }
      likeCache.set(it.id, state);
    });
    document.querySelectorAll('.portfolio-card').forEach(card => {
      bind(card);
      const id = card.dataset.itemId;
      if (id && likeCache.has(id)) updateUI(id);
    });
    const mWrap = document.querySelector('#imageModal [data-portfolio-like]') || document.querySelector('#imageModal .fa-heart')?.parentElement;
    if (mWrap && !mWrap.dataset.likeBound) {
      mWrap.dataset.likeBound = '1';
      mWrap.addEventListener('click', e => { e.preventDefault(); if (window.__PF_ACTIVE_ID) toggle(window.__PF_ACTIVE_ID); });
      if (mWrap.tagName !== 'BUTTON') {
        mWrap.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && window.__PF_ACTIVE_ID) { e.preventDefault(); toggle(window.__PF_ACTIVE_ID); }});
      }
    }
  }

  window.__PF_SET_ACTIVE_ID = function(id){
    window.__PF_ACTIVE_ID = id;
    if(id) updateUI(id);
  };
  window.__getPortfolioLikes = id => (likeCache.get(id)?.count ?? 0);

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('portfolio:rendered', init);
})();

// Lazy load background images with better error handling
document.addEventListener('DOMContentLoaded', () => {
  const lazyBackgrounds = document.querySelectorAll('.lazy-bg');
  
  if ('IntersectionObserver' in window) {
    const bgObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const bg = entry.target;
          const bgUrl = bg.dataset.bg;
          
          // Preload image first
          const img = new Image();
          img.onload = () => {
            bg.style.backgroundImage = `url(${bgUrl})`;
            bg.classList.remove('lazy-bg');
            bg.classList.add('loaded');
          };
          img.onerror = () => {
            console.error('Failed to load background image:', bgUrl);
            bg.classList.add('load-error');
          };
          img.src = bgUrl;
          
          bgObserver.unobserve(bg);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });
    
    lazyBackgrounds.forEach(bg => bgObserver.observe(bg));
  } else {
    // Fallback for older browsers
    lazyBackgrounds.forEach(bg => {
      bg.style.backgroundImage = `url(${bg.dataset.bg})`;
    });
  }
});

// Performance monitoring
window.addEventListener('load', () => {
  if ('performance' in window && 'measureUserAgentSpecificMemory' in performance) {
    const perfData = performance.getEntriesByType('navigation')[0];
    
    // Log performance metrics
    console.log('Performance Metrics:', {
      domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
      loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
      domInteractive: perfData.domInteractive,
      firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime
    });
    
    // Warn if page load is slow
    if (perfData.loadEventEnd - perfData.fetchStart > 3000) {
      console.warn('Page load time exceeds 3 seconds. Consider optimizing resources.');
    }
  }
});

(() => {
  'use strict';

  /** ================== Config & Helpers ================== **/
  const API_ROOT = window.__API_BASE__ || '';
  const TOKEN_KEYS = ['access_token', 'token', 'jwt'];
  const clearToken = () => TOKEN_KEYS.forEach(k => localStorage.removeItem(k));
  // اگر توکن رو جای دیگه می‌ذاری، این تابع رو تغییر بده
  function getToken() {
    let t = null;
    for (const k of TOKEN_KEYS) {
      const val = localStorage.getItem(k);
      if (val) { t = val; break; }
    }
    if (!t) return null;
    try {
      const payload = JSON.parse(atob(t.split('.')[1] || ''));
      if (payload.exp * 1000 < Date.now()) {
        clearToken();
        return null;
      }
    } catch (_) {
      clearToken();
      return null;
    }
    return t;
  }
  const authHeaders = () => {
    const t = getToken();
    return t ? { 'Authorization': 'Bearer ' + t } : {};
  };
  const toFa = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const priceFa = n => (Number(n)||0).toLocaleString('fa-IR');
  const clamp = (x,min,max)=>Math.max(min,Math.min(max,x));

  const bookingSummaryCard = document.querySelector('[data-booking-summary]');
  const bookingCountEl = bookingSummaryCard?.querySelector('[data-booking-count]') || null;
  const bookingStatusEl = bookingSummaryCard?.querySelector('[data-booking-status]') || null;

  const formatFaDateTime = (value) => {
    if (!value) return '';
    try {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    } catch (err) {
      console.warn('formatFaDateTime failed:', err);
      return '';
    }
  };

  const setBookingSummaryLoading = () => {
    if (!bookingSummaryCard) return;
    bookingSummaryCard.classList.add('animate-pulse');
    bookingSummaryCard.setAttribute('aria-busy', 'true');
    if (bookingStatusEl) {
      bookingStatusEl.textContent = 'در حال دریافت اطلاعات...';
    }
  };

  const setBookingSummaryData = (payload = {}) => {
    if (!bookingSummaryCard) return;
    bookingSummaryCard.classList.remove('animate-pulse');
    bookingSummaryCard.setAttribute('aria-busy', 'false');

    const total = Math.max(0, Number(payload.totalBookings ?? payload.total ?? 0) || 0);
    if (bookingCountEl) {
      bookingCountEl.textContent = toFa(total);
    }

    const lastBookingText = formatFaDateTime(payload.lastBookingAt);
    if (bookingStatusEl) {
      if (total > 0 && lastBookingText) {
        bookingStatusEl.textContent = `آخرین نوبت ثبت شده: ${lastBookingText}`;
      } else if (total > 0) {
        bookingStatusEl.textContent = 'نوبت‌های این فروشگاه در حال مدیریت هستند.';
      } else {
        bookingStatusEl.textContent = 'هنوز نوبتی ثبت نشده است.';
      }
    }
  };

  const setBookingSummaryError = () => {
    if (!bookingSummaryCard) return;
    bookingSummaryCard.classList.remove('animate-pulse');
    bookingSummaryCard.setAttribute('aria-busy', 'false');
    if (bookingStatusEl) {
      bookingStatusEl.textContent = 'امکان دریافت اطلاعات نوبت‌ها وجود ندارد.';
    }
  };

  async function loadBookingSummary(sellerId) {
    if (!bookingSummaryCard || !sellerId) return;
    setBookingSummaryLoading();
    try {
      const res = await fetch(`${API_ROOT}/api/service-shops/${encodeURIComponent(sellerId)}/bookings/summary`, {
        credentials: 'include'
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      setBookingSummaryData(data || {});
    } catch (err) {
      console.warn('loadBookingSummary error:', err);
      setBookingSummaryError();
    }
  }

  if (bookingSummaryCard) {
    bookingSummaryCard.setAttribute('aria-busy', 'true');
  }

  window.refreshBookingSummary = (sellerId) => {
    const targetId = sellerId || document.body?.dataset?.sellerId || '';
    if (targetId) {
      loadBookingSummary(targetId);
    }
  };

  function toast(msg, type='info') {
    if (typeof showToastDark === 'function') showToastDark(msg, {type});
    else alert(msg);
  }

  // دریافت shopurl از پارامترها؛ تابع به‌صورت سراسری تعریف شده است

  function show404() {
    document.body.innerHTML = '<h1 class="text-center mt-10 text-2xl">404 - فروشگاه یافت نشد</h1>';
  }

  // نزدیک‌ترین کانتینر «خدمات ما»
  function findServicesContainer() {
    const headings = Array.from(document.querySelectorAll('section h3'));
    const h = headings.find(el => (el.textContent || '').trim().includes('خدمات ما'));
    if (!h) return null;
    const sec = h.closest('section');
    if (!sec) return null;
    // کانتینر اسکرولی که قبلاً داشتی
    const c = sec.querySelector('.scroll-container');
    return c || null;
  }

  // باز کردن ویزارد رزرو
  function bindReserveClicks(container) {
    if (!container) return;
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.service-button');
      if (!btn) return;
      e.preventDefault();
      const prefill = { service: btn.dataset.service, price: btn.dataset.price };
      if (typeof window.openBookingWizard === 'function') {
        window.openBookingWizard(prefill);
      } else {
        toast('بخش رزرو در این صفحه پیدا نشد', 'info');
      }
    });
  }

  /** ================== API calls ================== **/
  async function apiGetPublic(shopurl) {
    const res = await fetch(`${API_ROOT}/api/seller-services/by-shopurl/${encodeURIComponent(shopurl)}`, {
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json(); // { items, sellerId }
  }

  async function apiGetSeller(shopurl) {
    const res = await fetch(`${API_ROOT}/api/sellers/by-shopurl/${encodeURIComponent(shopurl)}`, { credentials: 'include' });
    if (!res.ok) throw new Error('seller not found');
    return res.json();
  }

function updateSellerProfile(seller) {
  // Helper function to create brief address
  const getBriefAddress = (fullAddress) => {
    if (!fullAddress) return 'آدرس کسب‌وکار';
    // Split address by common delimiters
    const parts = fullAddress.split(/[،,-]/);
    if (parts.length >= 2) {
      // Return first two parts (usually street and area)
      return parts.slice(0, 2).join('، ').trim();
    } else if (fullAddress.length > 30) {
      // If address is too long, truncate it
      return fullAddress.substring(0, 30) + '...';
    }
    return fullAddress;
  };

  const mapping = {
    'page-title':   `${seller.storename || ''} | Vitreenet`,
    'seller-name':  seller.storename || '',
    'seller-category': seller.category || '',
    'seller-phone': seller.phone || '',
    'seller-address': seller.address || '',
    'store-phone':  seller.phone || '',
    'store-address': seller.address || '',
    'store-hours': seller.startTime && seller.endTime
      ? `از ${toFa(seller.startTime)} تا ${toFa(seller.endTime)}`
      : 'ساعات کاری ثبت نشده است',
    'biz-name':     seller.storename || '',
    'biz-tagline':  seller.desc || '',
    'full-address': seller.address || '',
    'modal-phone':  seller.phone || '',
    // Add header shop names
    'header-shop-name-mobile': seller.storename || '',
    'header-shop-name-md1': seller.storename || '',
    'header-shop-name-md2': seller.storename || '',
    'header-shop-name-lg': seller.storename || '',
    'footer-shop-name': seller.storename || '',
    // Add brief address for hero
    'hero-brief-address': getBriefAddress(seller.address)
  };
  
  for (const [id, text] of Object.entries(mapping)) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (id === 'modal-phone') {
      el.textContent = text;
      el.href = text ? `tel:${text}` : '#';
    } else if (id === 'header-shop-name-mobile' || id === 'header-shop-name-lg') {
      // Also update the title attribute for these elements
      el.textContent = text;
      el.setAttribute('title', text);
    } else {
      el.textContent = text;
    }
  }

  // Handle footer image from seller data
  if (seller.footerImage || seller.brandingImage || seller.coverImage) {
    const imageUrl = seller.footerImage || seller.brandingImage || seller.coverImage;
    document.documentElement.style.setProperty('--footer-image', `url("${imageUrl}")`);

    // Apply to map container immediately if available
    const mapContainer = document.getElementById('map-container');
    if (mapContainer && imageUrl) {
      mapContainer.classList.add('footer-image-map');
      mapContainer.classList.remove('min-h-[200px]', 'bg-gray-200');
      mapContainer.innerHTML = `<img src="${imageUrl}" alt="تصویر برند فروشگاه">`;
    }
    
    const footerEl = document.getElementById('shop-footer-image');
    if (footerEl) footerEl.hidden = false;
  }

  const heroCall = document.getElementById('hero-call');
  if (heroCall) {
    // Remove old event listeners if any
    const newHeroCall = heroCall.cloneNode(true);
    heroCall.parentNode.replaceChild(newHeroCall, heroCall);

    // Add click event to open popup instead of direct tel: link
    newHeroCall.addEventListener('click', (e) => {
      e.preventDefault();
      if (seller.phone) {
        openContactPopup(seller.phone);
      } else {
        alert('شماره تماس در دسترس نیست');
      }
    });

    // Also set href for accessibility
    newHeroCall.href = seller.phone ? `tel:${seller.phone}` : '#';
  }
}



// Fetch footer image from branding API
// Fetch footer image from branding API with better error handling
async function loadFooterImage(sellerId) {
  if (!sellerId) {
    console.log('No sellerId provided for footer image');
    return;
  }
  
  const mapContainer = document.getElementById('map-container');
  if (!mapContainer) {
    console.log('Map container not found');
    return;
  }
  
  try {
    console.log('Fetching footer image for seller:', sellerId);
    
    // Try the branding endpoint first
    const res = await fetch(`${API_ROOT}/api/branding/footer/${encodeURIComponent(sellerId)}`, {
      credentials: 'include'
    });
    
    let imageUrl = null;
    
    if (res.ok) {
      const data = await res.json();
      imageUrl = data.url || data.imageUrl || data.image;
      console.log('Footer image from branding API:', imageUrl);
    }
    
    // If no image from branding API, try to get it from seller data
    if (!imageUrl) {
      console.log('No image from branding API, trying seller data...');
      // Check if we already have footerImage from seller data
      const footerImageVar = getComputedStyle(document.documentElement).getPropertyValue('--footer-image');
      if (footerImageVar && footerImageVar !== 'none') {
        // Extract URL from CSS variable
        const match = footerImageVar.match(/url\(["']?(.+?)["']?\)/);
        if (match && match[1]) {
          imageUrl = match[1];
          console.log('Using footer image from seller data:', imageUrl);
        }
      }
    }
    
    // Apply the image if we have one
    if (imageUrl) {
      // Update CSS variable
      document.documentElement.style.setProperty('--footer-image', `url("${imageUrl}")`);

      // Update map container with the footer image
      mapContainer.classList.add('footer-image-map');
      mapContainer.classList.remove('min-h-[200px]', 'bg-gray-200');
      mapContainer.innerHTML = `<img src="${imageUrl}" alt="تصویر برند فروشگاه">`;

      // Show footer image element if exists
      const footerEl = document.getElementById('shop-footer-image');
      if (footerEl) footerEl.hidden = false;
      
      console.log('Footer image applied successfully');
    } else {
      console.log('No footer image available');
      // Show a nice placeholder
      mapContainer.innerHTML = `
        <div class="text-center">
          <i class="fas fa-store text-4xl text-gray-400 mb-2"></i>
          <p class="text-sm text-gray-500">تصویر برند فروشگاه</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Failed to load footer image:', err);
    // Show error state
    mapContainer.innerHTML = `
      <div class="text-center">
        <i class="fas fa-image text-3xl text-gray-400 mb-2"></i>
        <p class="text-sm text-gray-500">در حال بارگذاری تصویر...</p>
      </div>
    `;
  }
}


// Debug function to check what's happening
window.debugFooterImage = function() {
  const mapContainer = document.getElementById('map-container');
  const footerImageVar = getComputedStyle(document.documentElement).getPropertyValue('--footer-image');
  const sellerId = document.body.dataset.sellerId;
  
  console.log('Debug Info:');
  console.log('- Map container exists:', !!mapContainer);
  console.log('- Map container classes:', mapContainer?.className);
  console.log('- Map container style:', mapContainer?.style.backgroundImage);
  console.log('- CSS variable --footer-image:', footerImageVar);
  console.log('- Seller ID:', sellerId);
  console.log('- API_ROOT:', window.__API_BASE__ || '');
}


  /** ================== Render ================== **/
function cardTemplate(item) {
  const img = Array.isArray(item.images) && item.images.length
    ? item.images[Math.max(0, Math.min(item.mainImageIndex || 0, item.images.length - 1))]
    : `https://picsum.photos/seed/${encodeURIComponent(item.title || 'svc')}/800/600.jpg`;

  // قیمت/تخفیف
  const offPct     = Number(item.discountPercent ?? item.offPercent ?? item.discount ?? 0) || 0;
  const hasOff     = offPct > 0 && Number(item.price) > 0;
  const basePrice  = Number(item.finalPrice ?? item.price ?? 0);
  const finalPrice = hasOff ? Math.max(0, Math.round((item.price || 0) * (100 - offPct) / 100)) : basePrice;

  // امتیاز
  const rating      = Number(item.ratingAvg ?? item.rating ?? 0) || null;
  const ratingCount = Number(item.reviewCount ?? item.ratingCount ?? 0) || 0;

  // کپشن بدون تکرار
  const title   = (item.title || '').trim();
  const descRaw = (item.desc  || '').trim();
  const norm    = s => s.toString().trim().replace(/\s+/g, ' ').toLowerCase();
  const showDesc = !!descRaw && norm(descRaw) !== norm(title) && descRaw.length >= 12;

  return `
  <article
    class="service-card group relative flex-shrink-0 w-[90vw] xs:w-[86vw] sm:w-72 md:w-80 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 snap-start"
    data-svc-id="${item._id}"
  >
    <!-- تصویر + اورلی تخفیف -->
    <div class="relative overflow-hidden">
      <img src="${img}" alt="${title}" loading="lazy" decoding="async"
           class="w-full aspect-[4/3] object-cover transition-transform duration-500 group-hover:scale-105" />
      <div class="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent pointer-events-none"></div>

      <div class="absolute top-2 left-2 flex gap-2">
        ${hasOff ? `<span class="rounded-full bg-rose-600/95 text-white text-[11px] px-2 py-1">${toFa(offPct)}٪ تخفیف</span>` : ``}
        ${item.badge ? `<span class="rounded-full bg-emerald-600/95 text-white text-[11px] px-2 py-1">${item.badge}</span>` : ``}
      </div>
      <!-- ⛔️ عنوان روی تصویر حذف شد تا تکرار نشه -->
    </div>

    <!-- کپشن -->
    <div class="p-4 flex flex-col gap-3">
      <!-- ردیف عنوان + امتیاز -->
      <div class="flex items-center justify-between gap-3">
        <h4 class="font-extrabold text-[16px] sm:text-[17px] md:text-lg text-gray-900 line-clamp-1">${title || '—'}</h4>
        <div class="flex items-center gap-1 text-[12px] ${rating ? '' : 'hidden'}" aria-label="امتیاز ${rating || 0}">
          <svg class="w-[14px] h-[14px] text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
          <span class="text-gray-700">${(rating || 0).toFixed(1).replace('.', '٫')}</span>
          <span class="text-gray-500">(${toFa(ratingCount)})</span>
        </div>
      </div>

      ${showDesc ? `<p class="text-[13px] sm:text-[14px] text-gray-600 leading-6 line-clamp-2">${descRaw}</p>` : ''}

      <!-- ردیف قیمت / رزرو -->
      <div class="mt-1 grid grid-cols-[1fr_auto] items-center gap-4">
        <div class="min-w-0">
          <div class="flex items-baseline gap-1">
            <span class="service-price text-[19px] sm:text-[20px] font-extrabold tracking-tight text-gray-900">
              <span class="price-view">${priceFa(finalPrice)}</span>
            </span>
            <span class="service-currency text-[12px] sm:text-[13px] text-gray-500">تومان</span>
          </div>
          <div class="text-[11px] sm:text-[12px] text-rose-600 ${hasOff ? '' : 'hidden'}">
            <s class="text-gray-400">${priceFa(item.price || 0)}</s><span class="ml-1">– ${toFa(offPct)}٪</span>
          </div>
        </div>

        <!-- دکمه رزرو (بدون آیکن، سایز لمسی) -->
        <button
          class="service-button cta-button inline-flex items-center justify-center text-white font-bold py-3 sm:py-3.5 px-6 sm:px-7 rounded-full text-[14px] sm:text-[15px] leading-none whitespace-nowrap transition-all ${item.isActive ? '' : 'opacity-40 pointer-events-none'}"
          data-service="${title}" data-price="${finalPrice || 0}" aria-label="رزرو ${title}"
        >
          رزرو
        </button>
      </div>
    </div>
  </article>`;
}






  /** ================== Bootstrap ================== **/
  const servicesContainer = findServicesContainer();
  bindReserveClicks(servicesContainer);

  let LAST_PUBLIC = { items: [], sellerId: null };
  // expose to global scope for booking scripts
  window.LAST_PUBLIC = LAST_PUBLIC;

  function renderList() {
    if (!servicesContainer) return;
    servicesContainer.innerHTML = '';
    if (!LAST_PUBLIC.items || LAST_PUBLIC.items.length === 0) {
      servicesContainer.innerHTML = `
        <div class="w-full text-center text-gray-500 py-8">
          فعلاً سرویسی ثبت نشده است.
        </div>`;
      return;
    }

    // مرتب‌سازی: فعال‌ها اول، بعد قیمت صعودی
    const sorted = [...LAST_PUBLIC.items].sort((a,b) => {
      if (!!b.isActive - !!a.isActive) return (!!b.isActive - !!a.isActive);
      if ((a.price||0) !== (b.price||0)) return (a.price||0) - (b.price||0);
      return (a.createdAt||'') < (b.createdAt||'') ? 1 : -1;
    });

    sorted.forEach(item => {
      if (!item.isActive) return;
      servicesContainer.insertAdjacentHTML('beforeend', cardTemplate(item));
    });
  }

async function renderAll() {
  const shopurl = await getShopUrlFromLocation();
  if (!shopurl) { show404(); return; }

  try {
    const [data, seller] = await Promise.all([
      apiGetPublic(shopurl),
      apiGetSeller(shopurl)
    ]);

    LAST_PUBLIC = data; // { items, sellerId }
    window.LAST_PUBLIC = LAST_PUBLIC; // keep global in sync
    updateSellerProfile(seller);

    const resolvedSellerId = data.sellerId || seller._id || seller.id || '';
    if (resolvedSellerId) {
      document.body.dataset.sellerId = resolvedSellerId;
    } else {
      delete document.body.dataset.sellerId;
    }

    // Store seller data for s-profile.html navigation
    localStorage.setItem('seller', JSON.stringify({
      ...seller,
      sellerId: resolvedSellerId
    }));

    if (resolvedSellerId) {
      loadBookingSummary(resolvedSellerId);
      await loadFooterImage(resolvedSellerId);
    }
    
    renderList();
    document.dispatchEvent(new CustomEvent('services:loaded', { detail: data.items || [] }));
  } catch (err) {
    console.error('Load public services failed', err);
    show404();
  }
}

  document.addEventListener('DOMContentLoaded', renderAll);
})();

(() => {
  'use strict';

  // ---------- Helpers ----------
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const toFa = n => String(n ?? 0).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

  // shop slug from URL (?shopurl=, ?shop=, ?seller=)
  function getShopSlug() {
    const u = new URL(location.href);
    return (u.searchParams.get('shopurl') || u.searchParams.get('shop') || u.searchParams.get('seller') || '').trim();
  }

  // API base (optional global). Falls back to same origin.
  const API_BASE = (window.API_BASE || '').replace(/\/+$/, '');
  const SLUG = getShopSlug();

  // Candidate endpoints to be compatible with new backend & s-seller-panel.js
  // The first "ok & non-empty" wins. You can prune once your final route is fixed.
  const CANDIDATES = [
    `${API_BASE}/api/portfolio/public/${encodeURIComponent(SLUG)}`,
    `${API_BASE}/api/portfolio?shopurl=${encodeURIComponent(SLUG)}`,
    `${API_BASE}/api/service-portfolio/public/${encodeURIComponent(SLUG)}`,
    `${API_BASE}/api/seller-portfolio/public/${encodeURIComponent(SLUG)}`,
    `${API_BASE}/api/portfolios/public/${encodeURIComponent(SLUG)}`,
  ];

  // Normalize backend item to UI model
  function normalize(item) {
    const img = item.image || item.cover || (item.images?.[0]?.url || item.images?.[0]) || '';
    return {
      id:      item._id || item.id || crypto.randomUUID?.() || ('pf_' + Math.random().toString(36).slice(2)),
      title:   item.title || item.name || '—',
      desc:    item.description || item.desc || '',
      image:   img,
      views:   item.views ?? item.viewCount ?? 0,
      likes:   item.likeCount ?? item.likes ?? 0,
      liked:   !!item.liked,
      created: item.createdAt || item.updatedAt || null
    };
  }

  async function tryFetch(url) {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) return null;
    const data = await r.json().catch(()=>null);
    const list = Array.isArray(data) ? data : (data?.items || data?.data || data?.results || []);
    return Array.isArray(list) ? list : null;
  }

  function getLocalPortfolio() {
    try {
      const raw = localStorage.getItem('vit_portfolio');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map(normalize) : [];
    } catch (_) {
      return [];
    }
  }

  async function loadPortfolio() {
    if (!SLUG) return getLocalPortfolio();
    for (const url of CANDIDATES) {
      try {
        const items = await tryFetch(url);
        if (items && items.length) return items.map(normalize);
      } catch (_) {}
    }
    return getLocalPortfolio();
  }

  // ---------- Rendering ----------
  const grid = $('#portfolio-grid');
  const row  = $('#portfolio-row');
  const emptyMsg = $('#portfolio-empty');
  const loading  = $('#portfolio-loading');
  const tpl = $('#tpl-portfolio-card');

  function createCard(it) {
    const node = tpl.content.firstElementChild.cloneNode(true);

    const imgEl   = node.querySelector('.portfolio-img');
    const titleEl = node.querySelector('.portfolio-name');
    const descEl  = node.querySelector('.portfolio-description');
    const vEl     = node.querySelector('.js-views');
    const lEl     = node.querySelector('.js-likes');
    const btn     = node.querySelector('.js-open');

    titleEl.textContent = it.title || '—';
    descEl.textContent  = it.desc || '';
    vEl.textContent     = toFa(it.views);
    lEl.textContent     = toFa(it.likes);

    // Lazy: use data-src; real load by IntersectionObserver
    imgEl.alt = it.title || '';
    imgEl.dataset.src = it.image || '';
    imgEl.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='; // 1x1
    node.dataset.itemId = it.id;
    const hWrap = node.querySelector('.fa-heart')?.parentElement;
    const hIcon = hWrap?.querySelector('.fa-heart');
    if(hWrap && hIcon && it.liked){
      hIcon.classList.remove('far');
      hIcon.classList.add('fas');
      hWrap.classList.add('text-red-500');
    }

    btn.addEventListener('click', () => openImageModal(it));

    return node;
  }

function render(items) {
  // clear
  row.innerHTML = '';
  grid.innerHTML = '';
  if (!items.length) {
    emptyMsg.classList.remove('hidden');
    return;
  }
  emptyMsg.classList.add('hidden');
  // mobile row
  items.forEach(it => row.appendChild(createCard(it)));
  // desktop grid - create separate cards for desktop to avoid duplication
  items.forEach(it => grid.appendChild(createCard(it)));
  // DON'T show grid here - let CSS handle it
  // grid.classList.remove('hidden'); // Remove this line
  // start lazy load
  lazyLoadImages();
}

  // ---------- Lazy Loading ----------
  function lazyLoadImages() {
    const imgs = $$('#portfolio .portfolio-img');
    if (!('IntersectionObserver' in window)) {
      imgs.forEach(img => { if (img.dataset.src) img.src = img.dataset.src; });
      return;
    }
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const img = e.target;
          const src = img.dataset.src;
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
          }
          obs.unobserve(img);
        }
      });
    }, { rootMargin: '120px' });
    imgs.forEach(img => io.observe(img));
  }

  // ---------- Image Modal ----------
  const imageModal = $('#imageModal');
  const imageEl    = $('#modalImage');
  const titleEl    = $('#modalTitle');
  const modalDescEl = $('#modalDescription');
  const mViews     = $('#modalViews');
  const mLikes     = $('#modalLikes');
  const closeBtn   = $('#imageModalClose');
  const modalContent = imageModal?.querySelector('.relative');

  function openImageModal(it) {
    if (!imageModal) return;
    titleEl.textContent = it.title || '';
    if (modalDescEl) {
      const desc = (it.desc || '').trim();
      modalDescEl.textContent = desc;
      modalDescEl.classList.toggle('hidden', !desc);
    }
    imageEl.src = it.image || '';
    imageEl.alt = it.title || '';
    mViews.textContent = toFa(it.views ?? 0);
    const curLikes = typeof window.__getPortfolioLikes === 'function' ? window.__getPortfolioLikes(it.id) : (it.likes ?? 0);
    mLikes.textContent = toFa(curLikes);
    window.__PF_SET_ACTIVE_ID?.(it.id);
    imageModal.classList.remove('hidden');
    imageModal.classList.add('flex');
    modalContent?.classList.remove('scale-95','opacity-0');
    modalContent?.classList.add('scale-100','opacity-100');
    document.body.classList.add('image-modal-open');
    document.addEventListener('keydown', onEsc);
  }

  function closeImageModal() {
    modalContent?.classList.add('scale-95','opacity-0');
    modalContent?.classList.remove('scale-100','opacity-100');
    imageModal.classList.add('hidden');
    imageModal.classList.remove('flex');
    imageEl.src = '';
    if (modalDescEl) {
      modalDescEl.textContent = '';
      modalDescEl.classList.remove('hidden');
    }
    document.body.classList.remove('image-modal-open');
    document.removeEventListener('keydown', onEsc);
  }

  function onEsc(e) { if (e.key === 'Escape') closeImageModal(); }

  closeBtn?.addEventListener('click', closeImageModal);
  imageModal?.addEventListener('click', e => { 
    if (e.target === imageModal) closeImageModal();
  });

  // ---------- Public refresh hook (optional) ----------
  // اگر پنل فروشنده بعد از ثبت نمونه‌کار event بزنه، این صفحه رفرش می‌شود:
  // document.dispatchEvent(new Event('portfolio:refresh'))
  document.addEventListener('portfolio:refresh', async () => {
    loading?.classList.remove('hidden');
    const items = await loadPortfolio();
    render(items);
    document.dispatchEvent(new CustomEvent('portfolio:rendered', { detail: { items } }));
    loading?.classList.add('hidden');
  });

  // ---------- Boot ----------
  (async () => {
    try {
      const items = await loadPortfolio();
      render(items);
      document.dispatchEvent(new CustomEvent('portfolio:rendered', { detail: { items } }));
    } finally {
      loading?.classList.add('hidden');
    }
})();
})();

(function () {
  // 1) تزریق shopurl / sellerId از URL به دیتاستِ بدنه
  const params   = new URLSearchParams(location.search);
  const shopurl  = params.get('shopurl');
  const sellerId = params.get('sellerId');

  if (shopurl)  document.body.dataset.shopurl  = shopurl;
  if (sellerId) {
    document.body.dataset.sellerId = sellerId;
    document.body.dataset.storeId  = sellerId;
  }

  // 2) پری‌فیل سرویس برای ویزارد (اختیاری: اگر در URL بود)
  //     این کلید همونه که خود ویزارد داخلش انتخاب‌ها رو نگه می‌داره
  const SS_KEY    = 'vt:booking.sel';
  const service   = params.get('service');     // مثلا "اصلاح سر و صورت"
  const price     = params.get('price');       // مثلا 150000
  const serviceId = params.get('serviceId');   // اگر داری

  if (service || price || serviceId) {
    let cur = SafeSS.getJSON(SS_KEY, {}); // SafeSS
    if (service)   cur.service   = decodeURIComponent(service);
    if (price)     cur.price     = parseInt(price, 10) || 0;
    if (serviceId) cur.serviceId = serviceId;
    SafeSS.setJSON(SS_KEY, cur); // SafeSS
  }

  // 3) اگر با #booking-wizard اومدیم، به‌صورت ایمن ویزارد رو باز کن
  function bootWizardFromHash() {
    if (location.hash !== '#booking-wizard') return;

    const fallback = () => {
      const el = document.getElementById('booking-wizard');
      if (el) {
        el.classList.remove('hidden');
        const top = el.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    };

    // اولویت: از گارد داخلی استفاده کن (جلوگیری از رزرو در حالت pending)
    if (typeof window.openBookingWizard === 'function') {
      const result = window.openBookingWizard(
        service ? { service: decodeURIComponent(service), price: parseInt(price || '0', 10) || undefined } : undefined
      );
      if (result && typeof result.then === 'function') {
        result.then(opened => { if (!opened) fallback(); });
      } else if (!result) {
        fallback();
      }
      return;
    }

    fallback();
  }

  document.addEventListener('DOMContentLoaded', bootWizardFromHash);
  window.addEventListener('hashchange', bootWizardFromHash);
})();

// Global variable to store seller phone number
  let currentSellerPhone = '';

  // Function to open contact popup
  function openContactPopup(phoneNumber) {
    if (!phoneNumber) {
      alert('شماره تماس در دسترس نیست');
      return;
    }

    currentSellerPhone = phoneNumber;
    const modal = document.getElementById('contact-popup-modal');
    const phoneDisplay = document.getElementById('popup-phone-number');
    const callButton = document.getElementById('popup-call-button');

    if (modal && phoneDisplay && callButton) {
      phoneDisplay.textContent = phoneNumber;
      callButton.href = `tel:${phoneNumber}`;
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
  }

  // Function to close contact popup
  function closeContactPopup() {
    const modal = document.getElementById('contact-popup-modal');
    const successMessage = document.getElementById('copy-success-message');

    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = ''; // Restore scrolling
    }

    if (successMessage) {
      successMessage.classList.add('hidden');
    }
  }

  // Function to copy phone number to clipboard
  function copyPhoneNumber() {
    if (!currentSellerPhone) return;

    navigator.clipboard.writeText(currentSellerPhone).then(() => {
      const successMessage = document.getElementById('copy-success-message');
      if (successMessage) {
        successMessage.classList.remove('hidden');
        setTimeout(() => {
          successMessage.classList.add('hidden');
        }, 3000);
      }
    }).catch(err => {
      console.error('Failed to copy phone number:', err);
      alert('خطا در کپی کردن شماره تماس');
    });
  }

  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeContactPopup();
    }
  });
