import {
  API_BASE,
  NO_CACHE,
  bust,
  escapeHtml,
  evaluateCheckpointStreak,
  createWeeklyDayState,
  formatTomans,
  calculateUserLevel
} from './scripts/core-utils.js';
import {
  SafeSS,
  auditSessionStorage,
  StorageManager,
  CustomerPrefs,
  DiscountStore
} from './scripts/storage.js';
import API, {
  bookedCache,
  collectBookingKeys,
  createBookingKey,
  normalizeKeyPart,
  toEn,
  toFaDigits
} from './scripts/api-client.js';
import UIComponents from './scripts/ui-components.js';
import {
  MOCK_DATA,
  buildSampleCustomers,
  loadCustomers,
  persistBookings
} from './scripts/data-store.js';

window.SafeSS = SafeSS;
window.auditSessionStorage = auditSessionStorage;
window.StorageManager = StorageManager;
window.CustomerPrefs = CustomerPrefs;
window.DiscountStore = DiscountStore;
window.API = API;
window.MOCK_DATA = MOCK_DATA;
window.UIComponents = UIComponents;
window.toEn = toEn;
window.toFaDigits = toFaDigits;
window.normalizeKeyPart = normalizeKeyPart;
window.VitreenetRules = {
  isBlockedByName: (name) => !!CustomerPrefs.getByName(name).blocked,
  shouldAutoAcceptByName: (name) => !!CustomerPrefs.getByName(name).autoAccept
};
document.addEventListener('DOMContentLoaded', async () => {

  // --- Bottom sheet: wallet & streak ---
  const bottomSheet = {
    root: document.getElementById('dashboard-bottom-sheet'),
    overlay: document.getElementById('bottom-sheet-overlay'),
    panel: document.querySelector('#dashboard-bottom-sheet .bottom-sheet__panel'),
    title: document.getElementById('bottom-sheet-title'),
    content: document.getElementById('bottom-sheet-content'),
    closeBtn: document.getElementById('bottom-sheet-close'),
    activeType: null
  };

  // ===== استریک از سرور - بدون داده فیک =====
  let streakData = null;
  let streakLoading = true;
  let streakError = null;

  // تابع برای بارگذاری و چک‌این استریک از سرور
  const loadAndCheckInStreak = async () => {
    try {
      streakLoading = true;
      streakError = null;
      
      // ابتدا چک‌این کن (ثبت ورود روزانه)
      const checkInResult = await API.checkInStreak();
      console.log('Streak check-in result:', checkInResult);
      
      if (checkInResult?.success) {
        streakData = checkInResult.data;
        
        // نمایش پیام مناسب
        if (!checkInResult.alreadyCheckedIn) {
          UIComponents.showToast(checkInResult.message || 'ورود امروز ثبت شد!', 'success');
        }
      } else {
        // اگر چک‌این موفق نبود، فقط داده‌ها رو بگیر
        streakData = await API.getStreak();
      }
      
      streakLoading = false;
      updateStreakUI();
      
    } catch (err) {
      console.error('Failed to load/checkin streak:', err);
      streakError = err;
      streakLoading = false;
      
      // نمایش وضعیت پیش‌فرض در صورت خطا
      streakData = {
        currentStreak: 0,
        longestStreak: 0,
        totalLoginDays: 0,
        weekProgress: 0,
        checkpointReached: false,
        level: { name: 'تازه‌کار', icon: '🌱', color: '#22d3ee', progress: 0 },
        days: [
          { label: 'ش', status: 'pending', isGift: false },
          { label: 'ی', status: 'pending', isGift: false },
          { label: 'د', status: 'pending', isGift: false },
          { label: 'س', status: 'pending', isGift: false },
          { label: 'چ', status: 'pending', isGift: false },
          { label: 'پ', status: 'pending', isGift: false },
          { label: 'ج', status: 'pending', isGift: true }
        ],
        dailyReward: '+۱۰ امتیاز وفاداری',
        weeklyReward: '۵,۰۰۰ تومان اعتبار'
      };
      updateStreakUI();
    }
  };

  // تابع آپدیت UI استریک
  const updateStreakUI = () => {
    if (!streakData) return;
    
    // آپدیت کارت استریک در داشبورد
    const streakEl = document.getElementById('daily-streak');
    if (streakEl) {
      const days = streakData.currentStreak || 0;
      streakEl.textContent = `${toFaDigits(days)} روز متوالی`;
      
      const streakCard = streakEl.closest('.streak-card');
      if (streakCard) {
        if (streakData.checkpointReached) {
          streakCard.classList.add('has-checkpoint');
        } else {
          streakCard.classList.remove('has-checkpoint');
        }
      }
    }
    
    // آپدیت sheetData برای bottom sheet
    if (sheetData) {
      sheetData.streak = {
        totalDays: streakData.currentStreak || 0,
        weekProgress: streakData.weekProgress || 0,
        visualCycle: streakData.weekProgress || 0,
        checkpointReached: streakData.checkpointReached || false,
        progress: Math.round(((streakData.weekProgress || 0) / 7) * 100),
        nextReward: streakData.checkpointReached 
          ? 'چک‌پوینت فعال شد؛ چرخه جدید شروع شده است'
          : `${7 - (streakData.weekProgress || 0)} روز تا چک‌پوینت بعدی`,
        level: streakData.level || { name: 'تازه‌کار', icon: '🌱', color: '#22d3ee' },
        dailyReward: streakData.dailyReward || '+۱۰ امتیاز وفاداری',
        weeklyReward: streakData.weeklyReward || '۵,۰۰۰ تومان اعتبار',
        monthlyReward: formatTomans(50_000),
        rules: 'هر ۷ روز یک چک‌پوینت ذخیره می‌شود. با از دست دادن روز، زنجیره به آخرین چک‌پوینت برمی‌گردد.',
        days: streakData.days || [],
        message: '',
        softPenalty: 0,
        isFrozen: false,
        longestStreak: streakData.longestStreak || 0,
        loyaltyPoints: streakData.loyaltyPoints || 0
      };
    }
  };

  // بارگذاری استریک در شروع
  loadAndCheckInStreak();

  // --- Header: hamburger navigation ---
  const hamburgerToggle = document.getElementById('hamburger-toggle');
  const hamburgerMenu = document.getElementById('hamburger-menu');
  const hamburgerBackdrop = document.getElementById('hamburger-backdrop');
  const notificationFab = document.querySelector('.notification-fab');

  const setHamburgerState = (isOpen) => {
    if (!hamburgerToggle || !hamburgerMenu || !hamburgerBackdrop) return;

    const completeClose = () => {
      hamburgerMenu.hidden = true;
      hamburgerBackdrop.hidden = true;
      hamburgerMenu.removeEventListener('transitionend', completeClose);
    };

    if (isOpen) {
      hamburgerMenu.hidden = false;
      hamburgerBackdrop.hidden = false;

      requestAnimationFrame(() => {
        hamburgerMenu.classList.add('is-open');
        hamburgerBackdrop.classList.add('is-visible');
      });

      const firstMenuItem = hamburgerMenu.querySelector('.hamburger-menu__item');
      if (firstMenuItem) {
        firstMenuItem.focus({ preventScroll: true });
      }
    } else {
      hamburgerMenu.classList.remove('is-open');
      hamburgerBackdrop.classList.remove('is-visible');

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        completeClose();
      } else {
        hamburgerMenu.addEventListener('transitionend', completeClose, { once: true });
        setTimeout(completeClose, 240);
      }
    }

    hamburgerToggle.classList.toggle('is-open', isOpen);
    hamburgerToggle.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('no-scroll', isOpen && window.innerWidth < 768);
    if (notificationFab) {
      notificationFab.classList.toggle('is-hidden-by-menu', isOpen);
    }
  };

  const closeHamburger = () => setHamburgerState(false);

  if (hamburgerToggle && hamburgerMenu && hamburgerBackdrop) {
    hamburgerToggle.addEventListener('click', () => {
      const isOpen = hamburgerToggle.getAttribute('aria-expanded') === 'true';
      setHamburgerState(!isOpen);
    });

    hamburgerBackdrop.addEventListener('click', closeHamburger);

    hamburgerMenu.querySelectorAll('.hamburger-menu__item').forEach((item) => {
      item.addEventListener('click', closeHamburger);
    });

    document.addEventListener('click', (event) => {
      const clickTarget = event.target;
      const isMenuOpen = hamburgerToggle.getAttribute('aria-expanded') === 'true';

      if (!isMenuOpen) return;

      const clickedInsideMenu = hamburgerMenu.contains(clickTarget);
      const clickedToggle = hamburgerToggle.contains(clickTarget);
      const clickedBackdrop = hamburgerBackdrop.contains(clickTarget);

      if (!clickedInsideMenu && !clickedToggle && !clickedBackdrop) {
        closeHamburger();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeHamburger();
      }
    });
  }

  // --- Referral Modal (دعوت دوستان) ---
  const referralModal = document.getElementById('referral-modal');
  const referralOpenBtn = document.getElementById('open-referral-modal-btn');
  const referralCloseEls = referralModal ? referralModal.querySelectorAll('[data-referral-close]') : [];

  const openReferralModal = () => {
    if (!referralModal) return;
    referralModal.hidden = false;
    closeHamburger();
    
    // Generate referral codes based on seller info
    const sellerData = JSON.parse(localStorage.getItem('seller') || '{}');
    const sellerId = sellerData._id || sellerData.id || 'XXXXX';
    const shortId = String(sellerId).slice(-5).toUpperCase();
    
    const userCodeEl = document.getElementById('user-referral-code');
    const sellerCodeEl = document.getElementById('seller-referral-code');
    if (userCodeEl) userCodeEl.value = `USR-${shortId}`;
    if (sellerCodeEl) sellerCodeEl.value = `SLR-${shortId}`;
  };

  const closeReferralModal = () => {
    if (!referralModal || referralModal.hidden) return;
    referralModal.hidden = true;
  };

  referralOpenBtn?.addEventListener('click', openReferralModal);
  
  referralCloseEls.forEach((el) => {
    el.addEventListener('click', closeReferralModal);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && referralModal && !referralModal.hidden) {
      closeReferralModal();
    }
  });

  // Copy Toast Helper
  const showCopyToast = () => {
    const copyToast = document.getElementById('copy-toast');
    if (!copyToast) return;
    
    copyToast.hidden = false;
    
    // Auto-hide after 2.5 seconds
    clearTimeout(copyToast._hideTimer);
    copyToast._hideTimer = setTimeout(() => {
      copyToast.hidden = true;
    }, 2500);
  };

  // Copy referral code
  referralModal?.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('[data-copy-target]');
    if (!copyBtn) return;
    
    const targetId = copyBtn.dataset.copyTarget;
    const input = document.getElementById(targetId);
    if (!input) return;
    
    try {
      await navigator.clipboard.writeText(input.value);
      showCopyToast();
    } catch (err) {
      // Fallback
      input.select();
      document.execCommand('copy');
      showCopyToast();
    }
  });

  // Share referral link
  referralModal?.addEventListener('click', async (e) => {
    const shareBtn = e.target.closest('[data-share-type]');
    if (!shareBtn) return;
    
    const shareType = shareBtn.dataset.shareType;
    const sellerData = JSON.parse(localStorage.getItem('seller') || '{}');
    const sellerId = sellerData._id || sellerData.id || 'XXXXX';
    const shortId = String(sellerId).slice(-5).toUpperCase();
    
    const code = shareType === 'seller' ? `SLR-${shortId}` : `USR-${shortId}`;
    const baseUrl = window.location.origin;
    const shareUrl = shareType === 'seller' 
      ? `${baseUrl}/register.html?ref=${code}`
      : `${baseUrl}/login.html?ref=${code}`;
    
    const shareText = shareType === 'seller'
      ? `🎁 با کد دعوت من در ویترینت ثبت‌نام کن و فروشگاهت رو راه‌اندازی کن!\n\nکد دعوت: ${code}\n${shareUrl}`
      : `🎁 با کد دعوت من در ویترینت ثبت‌نام کن!\n\nکد دعوت: ${code}\n${shareUrl}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'دعوت به ویترینت',
          text: shareText,
          url: shareUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          await navigator.clipboard.writeText(shareText);
          UIComponents.showToast('لینک دعوت کپی شد!', 'success');
        }
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      UIComponents.showToast('لینک دعوت کپی شد!', 'success');
    }
  });

  // --- Support modal ---
  const supportModal = document.getElementById('support-modal');
  const supportSheet = supportModal?.querySelector('.support-sheet');
  const supportTriggers = document.querySelectorAll('[data-support-trigger]');
  const supportCloseEls = supportModal ? supportModal.querySelectorAll('[data-support-close]') : [];
  const supportForm = supportModal?.querySelector('.support-ticket__form');
  const supportTicketDetails = supportModal?.querySelector('.support-ticket');
  const supportTicketSummary = supportTicketDetails?.querySelector('summary');
  const telegramModal = document.getElementById('telegram-modal');
  const telegramTriggers = document.querySelectorAll('[data-telegram-trigger]');
  const telegramCloseEls = telegramModal ? telegramModal.querySelectorAll('[data-telegram-close]') : [];

  const isSupportOpen = () => supportModal && !supportModal.hidden;

  const openSupportModal = () => {
    if (!supportModal) return;
    supportModal.hidden = false;
    requestAnimationFrame(() => {
      supportModal.classList.add('is-visible');
      supportSheet?.focus({ preventScroll: true });
    });
    document.body.classList.add('is-support-open');
    closeHamburger();
  };

  const closeSupportModal = () => {
    if (!isSupportOpen()) return;

    const finish = () => {
      if (supportModal) supportModal.hidden = true;
    };

    supportModal.classList.remove('is-visible');
    document.body.classList.remove('is-support-open');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
    } else {
      supportModal.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 260);
    }
  };

  supportTriggers.forEach((trigger) => {
    trigger.addEventListener('click', openSupportModal);
  });

  supportCloseEls.forEach((el) => {
    el.addEventListener('click', closeSupportModal);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isSupportOpen()) {
      closeSupportModal();
    }
  });

  supportModal?.addEventListener('click', (event) => {
    if ((event.target)?.classList?.contains('support-modal__backdrop')) {
      closeSupportModal();
    }
  });

  supportTicketSummary?.addEventListener('click', () => {
    if (!supportTicketDetails) return;
    setTimeout(() => {
      supportTicketDetails.setAttribute('open', '');
      supportForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      supportForm?.querySelector('select')?.focus({ preventScroll: true });
    }, 0);
  });

  supportForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitBtn = supportForm.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'در حال ارسال…';
    }

    const categoryField = supportForm.querySelector('select');
    const messageField = supportForm.querySelector('textarea');
    const category = categoryField?.value || '';
    const message = (messageField?.value || '').trim();

    const sellerData = JSON.parse(localStorage.getItem('seller') || '{}');
    const payload = {
      subject: category || 'پشتیبانی',
      category: category || 'عمومی',
      message,
      priority: 'normal',
      phone: sellerData.phone || '',
      shopurl: sellerData.shopurl || ''
    };

    try {
      const res = await fetch(`${API_BASE}/api/support-tickets`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'ارسال تیکت انجام نشد.');
      }

      if (window.UIComponents?.showToast) {
        window.UIComponents.showToast('درخواست شما ثبت شد؛ به‌زودی پاسخ می‌دهیم.', 'success');
      }
      supportForm.reset();
      closeSupportModal();
    } catch (error) {
      console.error('support ticket error:', error);
      if (window.UIComponents?.showToast) {
        window.UIComponents.showToast(error.message || 'خطا در ارسال تیکت', 'error');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText || 'ارسال درخواست';
      }
    }
  });

  // Telegram modal
  const openTelegramModal = () => {
    if (!telegramModal) return;
    telegramModal.hidden = false;
    requestAnimationFrame(() => {
      telegramModal.classList.add('is-visible');
    });
  };

  const closeTelegramModal = () => {
    if (!telegramModal || telegramModal.hidden) return;
    const finish = () => { telegramModal.hidden = true; };
    telegramModal.classList.remove('is-visible');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
    } else {
      telegramModal.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 260);
    }
  };

  telegramTriggers.forEach((trigger) => {
    trigger.addEventListener('click', openTelegramModal);
  });

  telegramCloseEls.forEach((el) => {
    el.addEventListener('click', closeTelegramModal);
  });

  telegramModal?.addEventListener('click', (event) => {
    if ((event.target)?.classList?.contains('telegram-modal__backdrop')) {
      closeTelegramModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && telegramModal && !telegramModal.hidden) {
      closeTelegramModal();
    }
  });

  // --- My Tickets Section ---
  const myTicketsSection = document.getElementById('my-tickets-section');
  const myTicketsToggle = document.getElementById('my-tickets-toggle');
  const myTicketsBody = document.getElementById('my-tickets-body');
  const myTicketsList = document.getElementById('my-tickets-list');
  const myTicketsCount = document.getElementById('my-tickets-count');
  const myTicketsLoading = document.getElementById('my-tickets-loading');
  const myTicketsEmpty = document.getElementById('my-tickets-empty');
  const myTicketsError = document.getElementById('my-tickets-error');
  const myTicketsRetry = document.getElementById('my-tickets-retry');
  const ticketDetailModal = document.getElementById('ticket-detail-modal');
  const ticketDetailContent = document.getElementById('ticket-detail-content');
  const ticketDetailCloseEls = ticketDetailModal ? ticketDetailModal.querySelectorAll('[data-ticket-detail-close]') : [];

  let myTicketsData = [];
  let currentFilter = 'all';
  let ticketsLoaded = false;

  const statusLabels = {
    pending: 'در انتظار پاسخ',
    answered: 'پاسخ داده شده',
    closed: 'بسته شده',
    'in-progress': 'در حال بررسی'
  };

  const categoryLabels = {
    'مالی': '💰 مالی',
    'فنی': '🔧 فنی',
    'نوبت‌دهی': '📅 نوبت‌دهی',
    'عمومی': '📋 عمومی'
  };

  const formatTicketDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'همین الان';
      if (diffMins < 60) return `${toFaDigits(diffMins)} دقیقه پیش`;
      if (diffHours < 24) return `${toFaDigits(diffHours)} ساعت پیش`;
      if (diffDays < 7) return `${toFaDigits(diffDays)} روز پیش`;
      return formatTicketDate(dateStr);
    } catch {
      return '';
    }
  };

  const toggleMyTicketsSection = () => {
    if (!myTicketsSection) return;
    const isOpen = myTicketsSection.hasAttribute('open');
    
    if (isOpen) {
      myTicketsSection.removeAttribute('open');
      myTicketsToggle?.setAttribute('aria-expanded', 'false');
    } else {
      myTicketsSection.setAttribute('open', '');
      myTicketsToggle?.setAttribute('aria-expanded', 'true');
      if (!ticketsLoaded) {
        loadMyTickets();
      }
    }
  };

  const loadMyTickets = async () => {
    if (!myTicketsList) return;

    // Show loading
    if (myTicketsLoading) myTicketsLoading.hidden = false;
    if (myTicketsEmpty) myTicketsEmpty.hidden = true;
    if (myTicketsError) myTicketsError.hidden = true;

    // Clear existing tickets
    const existingItems = myTicketsList.querySelectorAll('.my-ticket-item');
    existingItems.forEach(item => item.remove());

    try {
      const res = await fetch(`${API_BASE}/api/support-tickets/my-tickets`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        throw new Error('خطا در دریافت تیکت‌ها');
      }

      const data = await res.json();
      myTicketsData = data.tickets || [];
      ticketsLoaded = true;

      updateTicketCounts();
      renderTickets();

    } catch (error) {
      console.error('Error loading tickets:', error);
      if (myTicketsLoading) myTicketsLoading.hidden = true;
      if (myTicketsError) myTicketsError.hidden = false;
    }
  };

  const updateTicketCounts = () => {
    const counts = {
      all: myTicketsData.length,
      pending: myTicketsData.filter(t => t.status === 'pending' || t.status === 'in-progress').length,
      answered: myTicketsData.filter(t => t.status === 'answered').length,
      closed: myTicketsData.filter(t => t.status === 'closed').length
    };

    if (myTicketsCount) {
      myTicketsCount.textContent = toFaDigits(counts.all);
      myTicketsCount.dataset.count = counts.all;
    }

    document.getElementById('filter-count-all')?.textContent && (document.getElementById('filter-count-all').textContent = toFaDigits(counts.all));
    document.getElementById('filter-count-pending')?.textContent && (document.getElementById('filter-count-pending').textContent = toFaDigits(counts.pending));
    document.getElementById('filter-count-answered')?.textContent && (document.getElementById('filter-count-answered').textContent = toFaDigits(counts.answered));
    document.getElementById('filter-count-closed')?.textContent && (document.getElementById('filter-count-closed').textContent = toFaDigits(counts.closed));
  };

  const getFilteredTickets = () => {
    if (currentFilter === 'all') return myTicketsData;
    if (currentFilter === 'pending') return myTicketsData.filter(t => t.status === 'pending' || t.status === 'in-progress');
    return myTicketsData.filter(t => t.status === currentFilter);
  };

  const renderTickets = () => {
    if (!myTicketsList) return;

    // Hide all states first
    if (myTicketsLoading) myTicketsLoading.hidden = true;
    if (myTicketsEmpty) myTicketsEmpty.hidden = true;
    if (myTicketsError) myTicketsError.hidden = true;

    // Clear existing tickets
    const existingItems = myTicketsList.querySelectorAll('.my-ticket-item');
    existingItems.forEach(item => item.remove());

    const filteredTickets = getFilteredTickets();

    if (filteredTickets.length === 0) {
      if (myTicketsEmpty) myTicketsEmpty.hidden = false;
      return;
    }

    filteredTickets.forEach(ticket => {
      const ticketEl = createTicketElement(ticket);
      myTicketsList.appendChild(ticketEl);
    });
  };

  const createTicketElement = (ticket) => {
    const statusClass = ticket.status || 'pending';
    const statusLabel = statusLabels[statusClass] || 'نامشخص';
    const categoryLabel = categoryLabels[ticket.category] || `📋 ${ticket.category || 'عمومی'}`;
    const repliesCount = ticket.replies?.length || 0;
    const ticketId = ticket._id || ticket.id || '—';
    const shortId = String(ticketId).slice(-6).toUpperCase();

    const article = document.createElement('article');
    article.className = 'my-ticket-item';
    article.dataset.ticketId = ticketId;

    article.innerHTML = `
      <div class="my-ticket-item__header">
        <span class="my-ticket-item__status my-ticket-item__status--${statusClass}">
          <span class="my-ticket-item__status-dot"></span>
          ${escapeHtml(statusLabel)}
        </span>
        <span class="my-ticket-item__id">#${escapeHtml(shortId)}</span>
      </div>
      <div class="my-ticket-item__body">
        <span class="my-ticket-item__category">${categoryLabel}</span>
        <h4 class="my-ticket-item__subject">${escapeHtml(ticket.subject || 'بدون موضوع')}</h4>
        <p class="my-ticket-item__message">${escapeHtml(ticket.message || '')}</p>
      </div>
      <div class="my-ticket-item__footer">
        <div class="my-ticket-item__meta">
          <span class="my-ticket-item__date">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            ${formatRelativeTime(ticket.createdAt)}
          </span>
          ${repliesCount > 0 ? `
            <span class="my-ticket-item__replies">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              ${toFaDigits(repliesCount)} پاسخ
            </span>
          ` : ''}
        </div>
        <button type="button" class="my-ticket-item__view-btn" data-view-ticket="${ticketId}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          مشاهده
        </button>
      </div>
    `;

    return article;
  };

  const openTicketDetail = async (ticketId) => {
    if (!ticketDetailModal || !ticketDetailContent) return;

    const ticket = myTicketsData.find(t => (t._id || t.id) === ticketId);
    if (!ticket) return;

    const shortId = String(ticketId).slice(-6).toUpperCase();
    const ticketIdEl = document.getElementById('ticket-detail-id');
    if (ticketIdEl) ticketIdEl.textContent = `#${shortId}`;

    const statusClass = ticket.status || 'pending';
    const statusLabel = statusLabels[statusClass] || 'نامشخص';
    const categoryLabel = categoryLabels[ticket.category] || ticket.category || 'عمومی';
    const repliesCount = ticket.replies?.length || 0;
    const isClosed = ticket.status === 'closed';

    let threadHtml = '';
    if (ticket.replies && ticket.replies.length > 0) {
      threadHtml = `
        <div class="ticket-detail-thread">
          <h3 class="ticket-detail-thread__title">
            گفتگو
            <span class="ticket-detail-thread__count">${toFaDigits(repliesCount)}</span>
          </h3>
          <div class="ticket-detail-thread__list">
            ${ticket.replies.map(reply => {
              const isAdmin = reply.from === 'admin' || reply.isAdmin;
              return `
                <div class="ticket-thread-msg ticket-thread-msg--${isAdmin ? 'admin' : 'user'}">
                  <div class="ticket-thread-msg__header">
                    <span class="ticket-thread-msg__sender">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${isAdmin ? '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' : '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'}
                      </svg>
                      ${isAdmin ? 'پشتیبانی' : 'شما'}
                    </span>
                    <span class="ticket-thread-msg__time">${formatRelativeTime(reply.createdAt)}</span>
                  </div>
                  <p class="ticket-thread-msg__text">${escapeHtml(reply.message || '')}</p>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    let replyFormHtml = '';
    if (isClosed) {
      replyFormHtml = `
        <div class="ticket-detail-closed">
          <div class="ticket-detail-closed__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div class="ticket-detail-closed__text">
            <h4 class="ticket-detail-closed__title">این تیکت بسته شده است</h4>
            <p class="ticket-detail-closed__subtitle">برای ارسال درخواست جدید، تیکت جدیدی ایجاد کنید</p>
          </div>
        </div>
      `;
    } else {
      replyFormHtml = `
        <div class="ticket-detail-reply">
          <label class="ticket-detail-reply__label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            ارسال پاسخ
          </label>
          <textarea class="ticket-detail-reply__textarea" id="ticket-reply-textarea" placeholder="پیام خود را بنویسید..." rows="3"></textarea>
          <div class="ticket-detail-reply__actions">
            <button type="button" class="ticket-detail-reply__submit" id="ticket-reply-submit" data-ticket-id="${ticketId}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              ارسال پاسخ
            </button>
          </div>
        </div>
      `;
    }

    ticketDetailContent.innerHTML = `
      <div class="ticket-detail-info">
        <div class="ticket-detail-info__item">
          <span class="ticket-detail-info__label">وضعیت:</span>
          <span class="ticket-detail-info__value">${escapeHtml(statusLabel)}</span>
        </div>
        <div class="ticket-detail-info__item">
          <span class="ticket-detail-info__label">دسته‌بندی:</span>
          <span class="ticket-detail-info__value">${categoryLabel}</span>
        </div>
        <div class="ticket-detail-info__item">
          <span class="ticket-detail-info__label">تاریخ:</span>
          <span class="ticket-detail-info__value">${formatTicketDate(ticket.createdAt)}</span>
        </div>
      </div>

      <div class="ticket-detail-original">
        <span class="ticket-detail-original__label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          پیام اصلی
        </span>
        <h3 class="ticket-detail-original__subject">${escapeHtml(ticket.subject || 'بدون موضوع')}</h3>
        <p class="ticket-detail-original__message">${escapeHtml(ticket.message || '')}</p>
      </div>

      ${threadHtml}
      ${replyFormHtml}
    `;

    // Show modal
    ticketDetailModal.hidden = false;
    requestAnimationFrame(() => {
      ticketDetailModal.classList.add('is-visible');
    });

    // Bind reply submit
    const replySubmitBtn = document.getElementById('ticket-reply-submit');
    const replyTextarea = document.getElementById('ticket-reply-textarea');
    
    replySubmitBtn?.addEventListener('click', async () => {
      const message = replyTextarea?.value?.trim();
      if (!message) {
        UIComponents?.showToast?.('لطفاً پیام خود را وارد کنید', 'error');
        return;
      }

      replySubmitBtn.disabled = true;
      replySubmitBtn.classList.add('is-loading');

      try {
        const res = await fetch(`${API_BASE}/api/support-tickets/${ticketId}/seller-reply`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });

        if (!res.ok) {
          throw new Error('خطا در ارسال پاسخ');
        }

        UIComponents?.showToast?.('پاسخ شما ارسال شد', 'success');
        closeTicketDetail();
        loadMyTickets(); // Refresh tickets
      } catch (error) {
        console.error('Error sending reply:', error);
        UIComponents?.showToast?.(error.message || 'خطا در ارسال پاسخ', 'error');
      } finally {
        replySubmitBtn.disabled = false;
        replySubmitBtn.classList.remove('is-loading');
      }
    });
  };

  const closeTicketDetail = () => {
    if (!ticketDetailModal || ticketDetailModal.hidden) return;

    const finish = () => {
      ticketDetailModal.hidden = true;
    };

    ticketDetailModal.classList.remove('is-visible');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
    } else {
      ticketDetailModal.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 350);
    }
  };

  // Event Listeners for My Tickets
  myTicketsToggle?.addEventListener('click', toggleMyTicketsSection);
  myTicketsToggle?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleMyTicketsSection();
    }
  });

  myTicketsRetry?.addEventListener('click', loadMyTickets);

  // Filter buttons
  document.querySelectorAll('.my-tickets-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.my-tickets-filter-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      currentFilter = btn.dataset.filter || 'all';
      renderTickets();
    });
  });

  // View ticket detail
  myTicketsList?.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-view-ticket]');
    if (viewBtn) {
      const ticketId = viewBtn.dataset.viewTicket;
      openTicketDetail(ticketId);
    }
  });

  // Close ticket detail modal
  ticketDetailCloseEls.forEach(el => {
    el.addEventListener('click', closeTicketDetail);
  });

  ticketDetailModal?.addEventListener('click', (e) => {
    if (e.target?.classList?.contains('ticket-detail-modal__backdrop')) {
      closeTicketDetail();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ticketDetailModal && !ticketDetailModal.hidden) {
      closeTicketDetail();
    }
  });

  // Refresh tickets after submitting new ticket
  const originalSupportFormSubmit = supportForm?.onsubmit;
  supportForm?.addEventListener('submit', () => {
    setTimeout(() => {
      if (ticketsLoaded) {
        loadMyTickets();
      }
    }, 1500);
  });

  // ===== Admin Notifications Section =====
  const adminNotificationsSection = document.getElementById('admin-notifications-section');
  const adminNotificationsToggle = document.getElementById('admin-notifications-toggle');
  const adminNotificationsBody = document.getElementById('admin-notifications-body');
  const adminNotificationsList = document.getElementById('admin-notifications-list');
  const adminNotificationsCount = document.getElementById('admin-notifications-count');
  const adminNotificationsLoading = document.getElementById('admin-notifications-loading');
  const adminNotificationsEmpty = document.getElementById('admin-notifications-empty');

  let adminNotificationsData = [];
  let adminNotificationsLoaded = false;

  const notificationTypeLabels = {
    info: 'اطلاع‌رسانی',
    warning: 'هشدار',
    success: 'تبریک',
    urgent: 'فوری'
  };

  const formatNotificationDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'همین الان';
      if (diffMins < 60) return `${toFaDigits(diffMins)} دقیقه پیش`;
      if (diffHours < 24) return `${toFaDigits(diffHours)} ساعت پیش`;
      if (diffDays < 7) return `${toFaDigits(diffDays)} روز پیش`;
      
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(date);
    } catch {
      return '—';
    }
  };

  const toggleAdminNotificationsSection = () => {
    if (!adminNotificationsSection) return;
    const isExpanded = adminNotificationsToggle?.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
      adminNotificationsToggle?.setAttribute('aria-expanded', 'false');
      if (adminNotificationsBody) adminNotificationsBody.hidden = true;
    } else {
      adminNotificationsToggle?.setAttribute('aria-expanded', 'true');
      if (adminNotificationsBody) adminNotificationsBody.hidden = false;
      if (!adminNotificationsLoaded) {
        loadAdminNotifications();
      }
    }
  };

  const loadAdminNotifications = async () => {
    if (!adminNotificationsList) return;

    // Show loading
    if (adminNotificationsLoading) adminNotificationsLoading.hidden = false;
    if (adminNotificationsEmpty) adminNotificationsEmpty.hidden = true;

    // Clear existing notifications
    const existingItems = adminNotificationsList.querySelectorAll('.admin-notification-item');
    existingItems.forEach(item => item.remove());

    try {
      // استفاده از endpoint /my که نیازی به sellerId ندارد
      // API از توکن فروشنده برای شناسایی استفاده می‌کند
      const data = await API.getAdminNotifications();
      // API returns array directly with mapped fields
      adminNotificationsData = Array.isArray(data) ? data : (data.notifications || []);
      adminNotificationsLoaded = true;

      updateAdminNotificationsCount();
      renderAdminNotifications();

    } catch (error) {
      console.error('Error loading admin notifications:', error);
      if (adminNotificationsLoading) adminNotificationsLoading.hidden = true;
      if (adminNotificationsEmpty) {
        adminNotificationsEmpty.hidden = false;
        const emptyTitle = adminNotificationsEmpty.querySelector('.admin-notifications-empty__title');
        if (emptyTitle) emptyTitle.textContent = 'خطا در بارگذاری';
      }
    }
  };

  const updateAdminNotificationsCount = () => {
    const unreadCount = adminNotificationsData.filter(n => !n.read).length;
    if (adminNotificationsCount) {
      adminNotificationsCount.textContent = toFaDigits(unreadCount);
      adminNotificationsCount.dataset.count = String(unreadCount);
    }
  };

  const renderAdminNotifications = () => {
    if (!adminNotificationsList) return;

    if (adminNotificationsLoading) adminNotificationsLoading.hidden = true;

    if (!adminNotificationsData.length) {
      if (adminNotificationsEmpty) adminNotificationsEmpty.hidden = false;
      return;
    }

    if (adminNotificationsEmpty) adminNotificationsEmpty.hidden = true;

    adminNotificationsData.forEach(notification => {
      const item = document.createElement('div');
      const notificationId = notification.id || notification._id;
      item.className = `admin-notification-item${notification.read ? '' : ' is-unread'}`;
      item.dataset.id = notificationId;

      const typeLabel = notificationTypeLabels[notification.type] || 'اطلاع‌رسانی';
      const dateStr = notification.time || formatNotificationDate(notification.createdAt);

      item.innerHTML = `
        <div class="admin-notification-item__header">
          <span class="admin-notification-item__type is-${notification.type || 'info'}">${typeLabel}</span>
          <span class="admin-notification-item__date">${dateStr}</span>
        </div>
        <h4 class="admin-notification-item__title">${escapeHtml(notification.title || '')}</h4>
        <p class="admin-notification-item__content">${escapeHtml(notification.text || notification.content || '')}</p>
        <div class="admin-notification-item__actions">
          ${!notification.read ? `
            <button type="button" class="admin-notification-item__btn admin-notification-item__btn--read" data-action="mark-read" data-id="${notificationId}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              خوانده شد
            </button>
          ` : ''}
          <button type="button" class="admin-notification-item__btn admin-notification-item__btn--delete" data-action="delete" data-id="${notificationId}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            حذف
          </button>
        </div>
      `;

      adminNotificationsList.appendChild(item);
    });
  };

  const handleAdminNotificationAction = async (action, id) => {
    try {
      if (action === 'mark-read') {
        await API.markAdminNotificationRead(id);
        const notification = adminNotificationsData.find(n => (n.id || n._id) === id);
        if (notification) notification.read = true;
        
        // Update UI
        const item = adminNotificationsList?.querySelector(`[data-id="${id}"]`);
        if (item) {
          item.classList.remove('is-unread');
          const readBtn = item.querySelector('[data-action="mark-read"]');
          if (readBtn) readBtn.remove();
        }
        updateAdminNotificationsCount();
        
      } else if (action === 'delete') {
        if (!confirm('آیا از حذف این پیام مطمئن هستید؟')) return;
        
        await API.deleteAdminNotification(id);
        adminNotificationsData = adminNotificationsData.filter(n => (n.id || n._id) !== id);
        
        // Remove from UI
        const item = adminNotificationsList?.querySelector(`[data-id="${id}"]`);
        if (item) item.remove();
        
        updateAdminNotificationsCount();
        
        if (!adminNotificationsData.length && adminNotificationsEmpty) {
          adminNotificationsEmpty.hidden = false;
        }
      }
    } catch (error) {
      console.error('Admin notification action error:', error);
      alert('خطا در انجام عملیات');
    }
  };

  // Event listeners for admin notifications
  adminNotificationsToggle?.addEventListener('click', toggleAdminNotificationsSection);
  adminNotificationsToggle?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleAdminNotificationsSection();
    }
  });

  adminNotificationsList?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action && id) {
      handleAdminNotificationAction(action, id);
    }
  });

  // Load admin notifications count on page load
  (async () => {
    try {
      // استفاده از endpoint /my/unread-count که نیازی به sellerId ندارد
      const data = await API.getAdminNotificationsUnreadCount();
      if (adminNotificationsCount && data.count !== undefined) {
        adminNotificationsCount.textContent = toFaDigits(data.count);
        adminNotificationsCount.dataset.count = String(data.count);
      }
    } catch (err) {
      console.error('Failed to load admin notifications count:', err);
    }
  })();

  // ===== کیف پول از سرور - بدون داده فیک =====
  let walletData = null;
  let walletLoading = true;

  // تابع بارگذاری کیف پول از سرور
  const loadWallet = async () => {
    try {
      walletLoading = true;
      walletData = await API.getWallet();
      console.log('Wallet loaded:', walletData);
      updateWalletUI();
    } catch (err) {
      console.error('Failed to load wallet:', err);
      // مقادیر پیش‌فرض در صورت خطا
      walletData = {
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        formattedBalance: '۰',
        recentTransactions: []
      };
      updateWalletUI();
    } finally {
      walletLoading = false;
    }
  };

  // تابع آپدیت UI کیف پول
  const updateWalletUI = () => {
    if (!walletData) return;
    
    // آپدیت کارت کیف پول در داشبورد
    const walletBalanceEl = document.getElementById('wallet-balance');
    if (walletBalanceEl) {
      walletBalanceEl.textContent = `${walletData.formattedBalance || '۰'} تومان`;
    }
    
    // آپدیت sheetData
    if (sheetData) {
      sheetData.wallet.balance = walletData.formattedBalance || '۰';
      sheetData.wallet.activities = (walletData.recentTransactions || []).map(tx => ({
        title: tx.title,
        amount: tx.formattedAmount,
        type: tx.isPositive ? 'earn' : 'spend',
        time: tx.timeAgo
      }));
    }
  };

  // بارگذاری کیف پول در شروع
  loadWallet();

  const sheetData = {
    // کیف پول از سرور بارگذاری می‌شود - مقادیر پیش‌فرض
    wallet: {
      balance: '۰',
      currency: 'تومان',
      tagline: 'اعتبارت را به ابزارهای بازدید و اعتماد تبدیل کن.',
      highlight: 'اعتبار فروشگاه',
      useCases: [
        { icon: '🚀', title: 'نردبان آگهی' },
        { icon: '🎫', title: 'کوپن تخفیف پلن' },
        { icon: '⭐', title: 'نشان VIP' }
      ],
      serviceCards: [
        {
          icon: '🚀',
          title: 'نردبان آگهی',
          price: '۲۰,۰۰۰ تومان',
          cost: 20000,
          serviceType: 'boost_purchase',
          description: 'پروفایل و آگهی‌ات به بالای لیست می‌رود.',
          theme: 'boost'
        },
        {
          icon: '🎫',
          title: 'تخفیف روی پلن',
          price: '۵۰,۰۰۰ تومان',
          cost: 50000,
          serviceType: 'plan_discount',
          description: 'اعتبار را به کوپن ۳۰٪ برای خرید نقدی پلن تبدیل کن.',
          theme: 'discount'
        },
        {
          icon: '⭐',
          title: 'نشان VIP',
          price: '۸۰,۰۰۰ تومان',
          cost: 80000,
          serviceType: 'vip_badge',
          description: 'نشان اعتماد ۲۴ ساعته برای جلب مشتری بیشتر.',
          theme: 'vip'
        }
      ],
      activities: []
    },
    // استریک از سرور بارگذاری می‌شود - مقادیر پیش‌فرض
    streak: {
      totalDays: 0,
      weekProgress: 0,
      visualCycle: 0,
      checkpointReached: false,
      progress: 0,
      nextReward: '۷ روز تا چک‌پوینت بعدی',
      level: { name: 'تازه‌کار', icon: '🌱', color: '#22d3ee', progress: 0 },
      dailyReward: '+۱۰ امتیاز وفاداری',
      weeklyReward: '۵,۰۰۰ تومان اعتبار',
      monthlyReward: formatTomans(50_000),
      rules: 'هر ۷ روز یک چک‌پوینت ذخیره می‌شود. با از دست دادن روز، زنجیره به آخرین چک‌پوینت برمی‌گردد.',
      days: [
        { label: 'ش', status: 'pending', isGift: false },
        { label: 'ی', status: 'pending', isGift: false },
        { label: 'د', status: 'pending', isGift: false },
        { label: 'س', status: 'pending', isGift: false },
        { label: 'چ', status: 'pending', isGift: false },
        { label: 'پ', status: 'pending', isGift: false },
        { label: 'ج', status: 'pending', isGift: true }
      ],
      message: '',
      softPenalty: 0,
      isFrozen: false,
      longestStreak: 0,
      loyaltyPoints: 0
    }
  };

  // توجه: updateStreakCard حذف شد چون در loadAndCheckInStreak انجام می‌شود

  const closeBottomSheet = () => {
    if (!bottomSheet.root) return;
    bottomSheet.root.classList.remove('is-active');
    bottomSheet.root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-bottom-sheet-open');
    bottomSheet.activeType = null;
  };

  const renderWalletSheet = () => {
    if (!bottomSheet.title || !bottomSheet.content) return;
    const data = sheetData.wallet;
    const currentBalance = walletData?.balance || 0;
    bottomSheet.title.textContent = 'مرکز اعتبار و خرید خدمات';
    
    // نمایش تراکنش‌ها یا پیام خالی
    const activitiesMarkup = data.activities.length > 0 
      ? data.activities.map((item) => {
          const amountClass = item.type === 'earn' ? 'is-positive' : 'is-negative';
          return `
            <li class="wallet-sheet__activity-item">
              <div>
                <div class="wallet-sheet__activity-title">${item.title}</div>
                <p class="wallet-sheet__activity-meta">${item.time}</p>
              </div>
              <span class="wallet-sheet__activity-amount ${amountClass}">${item.amount}</span>
            </li>
          `;
        }).join('')
      : '<li class="wallet-sheet__activity-empty">هنوز تراکنشی ثبت نشده است</li>';

    bottomSheet.content.innerHTML = `
      <section class="wallet-sheet" aria-label="اعتبار فروشگاه">
        <div class="wallet-sheet__hero">
          <div class="wallet-sheet__hero-head">
            <span class="wallet-sheet__eyebrow">${data.highlight}</span>
            <p class="wallet-sheet__headline">${data.balance} <span>${data.currency}</span></p>
            <p class="wallet-sheet__tagline">${data.tagline}</p>
          </div>
          <div class="wallet-sheet__tags" aria-hidden="true">
            ${data.useCases.map((item) => `<span class="wallet-sheet__tag">${item.icon} ${item.title}</span>`).join('')}
          </div>
        </div>

        <div class="wallet-sheet__section wallet-sheet__shop" aria-label="خدمات پیشنهادی برای هزینه اعتبار">
          <div class="wallet-sheet__section-header">
            <div>
              <p class="wallet-sheet__section-eyebrow">اقتصاد افزونه</p>
              <h4 class="wallet-sheet__section-title">افزایش بازدید و اعتماد</h4>
            </div>
            <span class="wallet-sheet__section-chip">پرداخت با اعتبار</span>
          </div>
          <div class="wallet-sheet__carousel" role="list">
            ${data.serviceCards.map((card) => {
              const canAfford = currentBalance >= card.cost;
              const disabledClass = canAfford ? '' : 'is-disabled';
              return `
              <article class="wallet-sheet__card wallet-sheet__card--${card.theme} ${disabledClass}" 
                       role="listitem" tabindex="0" 
                       data-service-type="${card.serviceType}"
                       data-cost="${card.cost}">
                <div class="wallet-sheet__card-icon" aria-hidden="true">${card.icon}</div>
                <div class="wallet-sheet__card-body">
                  <h5 class="wallet-sheet__card-title">${card.title}</h5>
                  <p class="wallet-sheet__card-price">${card.price}</p>
                  <p class="wallet-sheet__card-meta">${card.description}</p>
                </div>
                <button type="button" class="wallet-sheet__card-btn" ${canAfford ? '' : 'disabled'}>
                  ${canAfford ? 'خرید' : 'موجودی کافی نیست'}
                </button>
              </article>
            `}).join('')}
          </div>
        </div>

        <!-- بخش راه‌های کسب اعتبار -->
        <div class="wallet-sheet__section wallet-sheet__earn" aria-label="راه‌های کسب اعتبار">
          <div class="wallet-sheet__section-header">
            <div>
              <p class="wallet-sheet__section-eyebrow">💰 کسب درآمد</p>
              <h4 class="wallet-sheet__section-title">چطور اعتبار کسب کنم؟</h4>
            </div>
            <span class="wallet-sheet__section-chip wallet-sheet__section-chip--earn">رایگان</span>
          </div>
          
          <div class="wallet-earn-grid">
            <div class="wallet-earn-card wallet-earn-card--streak">
              <div class="wallet-earn-card__icon">🔥</div>
              <div class="wallet-earn-card__content">
                <h5 class="wallet-earn-card__title">ورود روزانه</h5>
                <p class="wallet-earn-card__desc">هر روز وارد پنل شو</p>
              </div>
              <span class="wallet-earn-card__reward">+۱,۰۰۰ ت</span>
            </div>
            
            <div class="wallet-earn-card wallet-earn-card--checkpoint">
              <div class="wallet-earn-card__icon">🎯</div>
              <div class="wallet-earn-card__content">
                <h5 class="wallet-earn-card__title">چک‌پوینت هفتگی</h5>
                <p class="wallet-earn-card__desc">۷ روز متوالی ورود</p>
              </div>
              <span class="wallet-earn-card__reward">+۵,۰۰۰ ت</span>
            </div>
            
            <div class="wallet-earn-card wallet-earn-card--booking">
              <div class="wallet-earn-card__icon">📅</div>
              <div class="wallet-earn-card__content">
                <h5 class="wallet-earn-card__title">تکمیل نوبت</h5>
                <p class="wallet-earn-card__desc">هر نوبت موفق</p>
              </div>
              <span class="wallet-earn-card__reward">+۲,۰۰۰ ت</span>
            </div>
            
            <div class="wallet-earn-card wallet-earn-card--review">
              <div class="wallet-earn-card__icon">⭐</div>
              <div class="wallet-earn-card__content">
                <h5 class="wallet-earn-card__title">نظر مثبت</h5>
                <p class="wallet-earn-card__desc">دریافت نظر از مشتری</p>
              </div>
              <span class="wallet-earn-card__reward">+۳,۰۰۰ ت</span>
            </div>
            
            <div class="wallet-earn-card wallet-earn-card--referral">
              <div class="wallet-earn-card__icon">🎁</div>
              <div class="wallet-earn-card__content">
                <h5 class="wallet-earn-card__title">دعوت دوستان</h5>
                <p class="wallet-earn-card__desc">معرفی فروشنده جدید</p>
              </div>
              <span class="wallet-earn-card__reward">+۱۰,۰۰۰ ت</span>
            </div>
            
            <div class="wallet-earn-card wallet-earn-card--profile">
              <div class="wallet-earn-card__icon">✅</div>
              <div class="wallet-earn-card__content">
                <h5 class="wallet-earn-card__title">تکمیل پروفایل</h5>
                <p class="wallet-earn-card__desc">اطلاعات کامل فروشگاه</p>
              </div>
              <span class="wallet-earn-card__reward">+۳,۰۰۰ ت</span>
            </div>
          </div>
          
          <p class="wallet-earn-tip">
            <span class="wallet-earn-tip__icon">💡</span>
            <span>با فعالیت مداوم در پنل، اعتبار رایگان کسب کنید و از خدمات ویژه استفاده کنید!</span>
          </p>
        </div>

        <div class="wallet-sheet__section wallet-sheet__activity" aria-label="فعالیت‌های اخیر اعتبار">
          <div class="wallet-sheet__section-header">
            <div>
              <p class="wallet-sheet__section-eyebrow">جریان حساب</p>
              <h4 class="wallet-sheet__section-title">تراکنش‌های اخیر</h4>
            </div>
            <span class="wallet-sheet__section-chip wallet-sheet__section-chip--muted">+ / -</span>
          </div>
          <ul class="wallet-sheet__activity-list">
            ${activitiesMarkup}
          </ul>
        </div>

        <button type="button" class="wallet-sheet__close-btn" aria-label="بستن مدال اعتبار">
          متوجه شدم
        </button>
      </section>
    `;

    // اضافه کردن event listener برای دکمه‌های خرید
    bottomSheet.content.querySelectorAll('.wallet-sheet__card-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const card = btn.closest('.wallet-sheet__card');
        const serviceType = card?.dataset?.serviceType;
        if (!serviceType) return;

        btn.disabled = true;
        btn.textContent = 'در حال پردازش...';

        try {
          const result = await API.spendWalletCredit(serviceType);
          UIComponents.showToast(result.message || 'خدمت با موفقیت فعال شد', 'success');
          
          // بروزرسانی کیف پول
          await loadWallet();
          renderWalletSheet();
        } catch (err) {
          console.error('Spend credit failed:', err);
          UIComponents.showToast(err.message || 'خطا در خرید خدمت', 'error');
          btn.disabled = false;
          btn.textContent = 'خرید';
        }
      });
    });

    // اضافه کردن event listener برای دکمه بستن مدال
    const closeWalletBtn = bottomSheet.content.querySelector('.wallet-sheet__close-btn');
    if (closeWalletBtn) {
      closeWalletBtn.addEventListener('click', closeBottomSheet);
    }
  };

  const renderStreakSheet = () => {
    if (!bottomSheet.title || !bottomSheet.content) return;
    const data = sheetData.streak;
    bottomSheet.title.textContent = 'استریک و پاداش‌ها';

    // ساخت روزهای هفته
    const dayMarkup = (data.days || []).map((day, index) => {
      const statusClass = day.status === 'hit' ? 'is-hit' : day.status === 'missed' ? 'is-missed' : 'is-pending';
      const isToday = index === (data.weekProgress || 0) - 1 && day.status === 'hit';
      const stateLabel = day.status === 'hit' ? 'انجام شده' : day.status === 'missed' ? 'از دست رفته' : 'در انتظار';
      return `
        <div class="streak-day ${statusClass}${isToday ? ' is-today' : ''}" aria-label="${day.label} ${stateLabel}">
          <div class="streak-day__circle">
            ${day.status === 'hit' ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
            ${day.status === 'missed' ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>` : ''}
          </div>
          <span class="streak-day__label">${day.label}</span>
          ${day.isGift ? '<span class="streak-day__gift">🎁</span>' : ''}
        </div>
      `;
    }).join('');

    const level = data.level || { name: 'تازه‌کار', icon: '🌱', color: '#22d3ee', progress: 0, daysToNext: 7 };
    const tierStyle = level.color ? ` style="--tier-color: ${level.color}"` : '';
    const progressPercent = level.progress || 0;
    const daysToNext = level.daysToNext || 0;
    const nextTierName = level.nextTierName || 'فعال';

    bottomSheet.content.innerHTML = `
      <section class="streak-sheet-v2" aria-label="جزئیات استریک"${tierStyle}>
        <!-- Hero Section -->
        <div class="streak-hero">
          <div class="streak-hero__glow"></div>
          <div class="streak-hero__icon-wrapper">
            <span class="streak-hero__icon">${level.icon || '🌱'}</span>
            <div class="streak-hero__ring"></div>
          </div>
          <div class="streak-hero__content">
            <span class="streak-hero__tier">فروشنده ${level.name || 'تازه‌کار'}</span>
            <div class="streak-hero__count">
              <span class="streak-hero__number">${toFaDigits(data.totalDays || 0)}</span>
              <span class="streak-hero__unit">روز متوالی</span>
            </div>
            ${data.checkpointReached ? '<span class="streak-hero__checkpoint"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>چک‌پوینت فعال</span>' : ''}
          </div>
        </div>

        <!-- Stats Row -->
        <div class="streak-stats-row">
          <div class="streak-stat">
            <span class="streak-stat__value">${toFaDigits(data.longestStreak || 0)}</span>
            <span class="streak-stat__label">بیشترین رکورد</span>
          </div>
          <div class="streak-stat">
            <span class="streak-stat__value">${toFaDigits(data.loyaltyPoints || 0)}</span>
            <span class="streak-stat__label">امتیاز وفاداری</span>
          </div>
        </div>

        <!-- Level Progress -->
        <div class="streak-level">
          <div class="streak-level__header">
            <div class="streak-level__info">
              <span class="streak-level__label">مسیر ارتقا به ${nextTierName}</span>
              <span class="streak-level__badge">${level.icon || '⭐'} ${toFaDigits(daysToNext)} روز مانده</span>
            </div>
            <span class="streak-level__percent">${toFaDigits(progressPercent)}٪</span>
          </div>
          <div class="streak-level__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent}">
            <div class="streak-level__fill" style="width: ${progressPercent}%"></div>
            <div class="streak-level__glow" style="width: ${progressPercent}%"></div>
          </div>
          <p class="streak-level__reward">🏆 با ارتقا به سطح بعدی پاداش ویژه دریافت کنید</p>
        </div>

        <!-- Weekly Calendar -->
        <div class="streak-weekly">
          <div class="streak-weekly__header">
            <div>
              <h4 class="streak-weekly__title">پیشرفت این هفته</h4>
              <p class="streak-weekly__subtitle">پاداش: ${data.weeklyReward || '۵,۰۰۰ تومان'}</p>
            </div>
            <div class="streak-weekly__counter">
              <span class="streak-weekly__current">${toFaDigits(data.weekProgress || 0)}</span>
              <span class="streak-weekly__divider">/</span>
              <span class="streak-weekly__total">۷</span>
            </div>
          </div>
          <div class="streak-weekly__calendar">${dayMarkup}</div>
        </div>

        <!-- Rewards Grid -->
        <div class="streak-rewards">
          <h4 class="streak-rewards__title">پاداش‌های شما</h4>
          <div class="streak-rewards__grid">
            <div class="streak-reward-card streak-reward-card--daily">
              <div class="streak-reward-card__icon">📅</div>
              <div class="streak-reward-card__content">
                <span class="streak-reward-card__label">روزانه</span>
                <span class="streak-reward-card__value">${data.dailyReward || '+۱۰ امتیاز'}</span>
              </div>
            </div>
            <div class="streak-reward-card streak-reward-card--weekly">
              <div class="streak-reward-card__icon">🎯</div>
              <div class="streak-reward-card__content">
                <span class="streak-reward-card__label">هفتگی</span>
                <span class="streak-reward-card__value">${data.weeklyReward || '۵,۰۰۰ تومان'}</span>
              </div>
            </div>
            <div class="streak-reward-card streak-reward-card--monthly">
              <div class="streak-reward-card__icon">🏅</div>
              <div class="streak-reward-card__content">
                <span class="streak-reward-card__label">ماهانه</span>
                <span class="streak-reward-card__value">${data.monthlyReward || '۵۰,۰۰۰ تومان'}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Status Messages -->
        ${data.message || data.softPenalty || data.isFrozen ? `
        <div class="streak-status">
          ${data.message ? `<div class="streak-status__item streak-status__item--info"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span>${data.message}</span></div>` : ''}
          ${data.softPenalty ? `<div class="streak-status__item streak-status__item--warning"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>${data.softPenalty} امتیاز سوخته</span></div>` : ''}
          ${data.isFrozen ? `<div class="streak-status__item streak-status__item--frozen"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg><span>استریک فریز فعال</span></div>` : ''}
        </div>
        ` : ''}

        <!-- Footer -->
        <div class="streak-footer">
          <p class="streak-footer__quote">🔥 تداوم شما، اعتبار شماست</p>
          <p class="streak-footer__rule">${data.rules}</p>
        </div>
      </section>
    `;
  };

  const openBottomSheet = (type = 'wallet') => {
    if (!bottomSheet.root || !bottomSheet.overlay || !bottomSheet.panel) return;
    bottomSheet.activeType = type;
    if (type === 'wallet') {
      renderWalletSheet();
    } else {
      renderStreakSheet();
    }
    bottomSheet.root.classList.add('is-active');
    bottomSheet.root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-bottom-sheet-open');
    requestAnimationFrame(() => bottomSheet.panel?.focus({ preventScroll: true }));
  };

  const handleSheetKeydown = (event) => {
    if (event.key === 'Escape' && bottomSheet.root?.classList.contains('is-active')) {
      closeBottomSheet();
    }
  };

  const bindSheetTriggers = () => {
    if (bottomSheet.root) {
      bottomSheet.root.setAttribute('aria-hidden', 'true');
    }
    const targets = [
      { selector: '.wallet-card', type: 'wallet' },
      { selector: '.streak-card', type: 'streak' }
    ];

    targets.forEach(({ selector, type }) => {
      document.querySelectorAll(selector).forEach((card) => {
        const open = () => openBottomSheet(type);
        card.addEventListener('click', open);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        });
      });
    });

    bottomSheet.overlay?.addEventListener('click', closeBottomSheet);
    bottomSheet.closeBtn?.addEventListener('click', closeBottomSheet);
    document.addEventListener('keydown', handleSheetKeydown);
  };

  bindSheetTriggers();

  // --- Seller Identity Header ---
  const initSellerIdentity = () => {
    const nameEl = document.getElementById('seller-identity-name');
    const dateEl = document.getElementById('seller-identity-date');
    const avatarEl = document.getElementById('seller-identity-avatar');
    const greetingEl = document.getElementById('seller-greeting-text');
    const badgeEl = document.getElementById('seller-identity-badge');
    
    if (!nameEl || !dateEl) return;
    
    // Get seller data
    const sellerData = JSON.parse(localStorage.getItem('seller') || '{}');
    const firstName = sellerData.firstname || sellerData.firstName || '';
    const lastName = sellerData.lastname || sellerData.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'فروشنده عزیز';
    
    // Set seller name
    nameEl.textContent = fullName;
    
    // Set avatar initial
    if (avatarEl) {
      const initial = firstName.charAt(0) || lastName.charAt(0) || 'ف';
      const avatarText = avatarEl.querySelector('.seller-identity__avatar-text');
      if (avatarText) avatarText.textContent = initial;
    }
    
    // Set greeting based on time of day
    if (greetingEl) {
      const hour = new Date().getHours();
      let greeting = 'سلام';
      if (hour >= 5 && hour < 12) greeting = 'صبح بخیر';
      else if (hour >= 12 && hour < 17) greeting = 'ظهر بخیر';
      else if (hour >= 17 && hour < 21) greeting = 'عصر بخیر';
      else greeting = 'شب بخیر';
      greetingEl.textContent = greeting;
    }
    
    // Show badge if seller has active plan
    if (badgeEl && sellerData.plan && sellerData.plan !== 'none') {
      badgeEl.hidden = false;
    }
    
    // Update Jalali date
    const updateJalaliDate = () => {
      const now = new Date();
      
      // Persian weekday names
      const persianWeekdays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
      // Persian month names
      const persianMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
      
      // Convert to Jalali
      const toJalali = (gy, gm, gd) => {
        const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        let jy = (gy <= 1600) ? 0 : 979;
        gy -= (gy <= 1600) ? 621 : 1600;
        const gy2 = (gm > 2) ? (gy + 1) : gy;
        let days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) + (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
        jy += 33 * (Math.floor(days / 12053));
        days %= 12053;
        jy += 4 * (Math.floor(days / 1461));
        days %= 1461;
        jy += Math.floor((days - 1) / 365);
        if (days > 365) days = (days - 1) % 365;
        const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
        const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
        return { year: jy, month: jm, day: jd };
      };
      
      const jalali = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
      const weekdayIndex = now.getDay() === 0 ? 0 : now.getDay();
      const persianWeekday = persianWeekdays[weekdayIndex];
      const persianMonth = persianMonths[jalali.month - 1];
      
      // Convert numbers to Persian
      const toPersianNum = (num) => {
        const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
        return String(num).replace(/[0-9]/g, d => persianDigits[parseInt(d)]);
      };
      
      const formattedDate = `${persianWeekday}، ${toPersianNum(jalali.day)} ${persianMonth} ${toPersianNum(jalali.year)}`;
      dateEl.textContent = formattedDate;
      dateEl.setAttribute('datetime', now.toISOString().split('T')[0]);
    };
    
    // Initial update
    updateJalaliDate();
    
    // Update date at midnight
    const scheduleNextUpdate = () => {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const msUntilMidnight = tomorrow - now;
      setTimeout(() => {
        updateJalaliDate();
        scheduleNextUpdate();
      }, msUntilMidnight);
    };
    scheduleNextUpdate();
  };
  
  initSellerIdentity();
  
  // Expose globally for updates after profile changes
  window.updateSellerIdentity = initSellerIdentity;

  // --- Seller Profile Modal ---
  const sellerProfileModal = {
    modal: document.getElementById('seller-profile-modal'),
    backdrop: document.querySelector('.seller-profile-modal__backdrop'),
    closeBtn: document.querySelector('.seller-profile-modal__close'),
    dismissBtns: document.querySelectorAll('[data-dismiss="seller-profile-modal"]'),
    viewShopBtn: document.getElementById('profile-modal-view-shop'),
    identitySection: document.querySelector('.seller-identity')
  };

  const openSellerProfileModal = () => {
    if (!sellerProfileModal.modal) return;
    
    // Populate modal with seller data
    populateSellerProfileModal();
    
    sellerProfileModal.modal.hidden = false;
    document.body.classList.add('is-profile-modal-open');
    
    // Focus trap
    requestAnimationFrame(() => {
      sellerProfileModal.modal.querySelector('.seller-profile-modal__close')?.focus({ preventScroll: true });
    });
  };

  const closeSellerProfileModal = () => {
    if (!sellerProfileModal.modal || sellerProfileModal.modal.hidden) return;
    
    sellerProfileModal.modal.hidden = true;
    document.body.classList.remove('is-profile-modal-open');
    
    // Return focus to trigger
    sellerProfileModal.identitySection?.focus({ preventScroll: true });
  };

  const populateSellerProfileModal = () => {
    const sellerData = JSON.parse(localStorage.getItem('seller') || '{}');
    const firstName = sellerData.firstname || sellerData.firstName || '';
    const lastName = sellerData.lastname || sellerData.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'فروشنده عزیز';
    
    // Helper: Get store name from multiple possible fields
    const getStoreName = (data) => {
      return (
        data?.storename ||        // Primary field used in localStorage (most common)
        data?.shopname || 
        data?.shopName || 
        data?.storeName ||
        data?.title ||            // Sometimes used as store name
        data?.displayName ||      // Alternative field
        data?.branchName ||       // Alternative field
        data?.name ||             // Fallback
        ''
      ).toString().trim();
    };
    
    // Helper: Convert to Persian numbers
    const toPersianNum = (num) => {
      const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
      return String(num).replace(/[0-9]/g, d => persianDigits[parseInt(d)]);
    };
    
    // Helper: Get join date from multiple possible fields
    const getJoinDate = (data) => {
      return (
        data?.createdAt ||
        data?.created_at ||
        data?.joinDate ||
        data?.join_date ||
        data?.membershipDate ||
        data?.memberSince ||
        data?.registeredAt ||
        data?.registered_at ||
        null
      );
    };
    
    // Helper: Format date to Jalali
    const formatJalaliDate = (dateStr) => {
      if (!dateStr) return '—';
      
      // Handle different date formats
      let date;
      if (typeof dateStr === 'string') {
        // Try parsing as ISO string or other formats
        date = new Date(dateStr);
      } else if (dateStr instanceof Date) {
        date = dateStr;
      } else if (typeof dateStr === 'number') {
        date = new Date(dateStr);
      } else {
        return '—';
      }
      
      if (isNaN(date.getTime())) return '—';
      
      const persianMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
      
      const toJalali = (gy, gm, gd) => {
        const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        let jy = (gy <= 1600) ? 0 : 979;
        gy -= (gy <= 1600) ? 621 : 1600;
        const gy2 = (gm > 2) ? (gy + 1) : gy;
        let days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) + (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
        jy += 33 * (Math.floor(days / 12053));
        days %= 12053;
        jy += 4 * (Math.floor(days / 1461));
        days %= 1461;
        jy += Math.floor((days - 1) / 365);
        if (days > 365) days = (days - 1) % 365;
        const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
        const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
        return { year: jy, month: jm, day: jd };
      };
      
      const jalali = toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
      return `${toPersianNum(jalali.day)} ${persianMonths[jalali.month - 1]} ${toPersianNum(jalali.year)}`;
    };
    
    // Header
    const avatarText = document.querySelector('#profile-modal-avatar .seller-profile-modal__avatar-text');
    const nameEl = document.getElementById('seller-profile-title');
    const shopEl = document.getElementById('profile-modal-shop');
    const statusBadge = document.getElementById('profile-modal-status');
    const planBadge = document.getElementById('profile-modal-plan');
    
    if (avatarText) avatarText.textContent = firstName.charAt(0) || lastName.charAt(0) || 'ف';
    if (nameEl) nameEl.textContent = fullName;
    // Shop label - use storename if available, otherwise show default
    if (shopEl) {
      const shopName = getStoreName(sellerData);
      shopEl.textContent = shopName || 'فروشگاه شما';
    }
    
    // Plan badge
    if (planBadge) {
      const planNames = {
        'free': 'پلن رایگان',
        'basic': 'پلن پایه',
        'pro': 'پلن حرفه‌ای',
        'premium': 'پلن ویژه'
      };
      const planName = planNames[sellerData.plan] || sellerData.plan;
      if (sellerData.plan && sellerData.plan !== 'none') {
        planBadge.textContent = planName;
        planBadge.hidden = false;
      } else {
        planBadge.hidden = true;
      }
    }
    
    // Stats
    const joinDateEl = document.getElementById('profile-modal-join-date');
    const totalBookingsEl = document.getElementById('profile-modal-total-bookings');
    const totalCustomersEl = document.getElementById('profile-modal-total-customers');
    const ratingEl = document.getElementById('profile-modal-rating');
    
    if (joinDateEl) {
      const joinDate = getJoinDate(sellerData);
      joinDateEl.textContent = formatJalaliDate(joinDate);
    }
    if (totalBookingsEl) totalBookingsEl.textContent = toPersianNum(sellerData.totalBookings || sellerData.bookingsTotal || 0);
    if (totalCustomersEl) totalCustomersEl.textContent = toPersianNum(sellerData.totalCustomers || sellerData.ucw30 || 0);
    if (ratingEl) ratingEl.textContent = toPersianNum((sellerData.rating || sellerData.avgRating || 0).toFixed(1));
    
    // Details
    const storeNameEl = document.getElementById('profile-modal-store-name');
    const phoneEl = document.getElementById('profile-modal-phone');
    const categoryEl = document.getElementById('profile-modal-category');
    const cityEl = document.getElementById('profile-modal-city');
    const shopurlEl = document.getElementById('profile-modal-shopurl');
    
    // Store Name - Use helper function to get store name
    if (storeNameEl) {
      const storeName = getStoreName(sellerData);
      storeNameEl.textContent = storeName || '—';
    }
    
    if (phoneEl) {
      const phone = sellerData.phone || '—';
      phoneEl.textContent = phone !== '—' ? toPersianNum(phone) : phone;
    }
    if (categoryEl) categoryEl.textContent = sellerData.category || sellerData.serviceCategory || '—';
    if (cityEl) cityEl.textContent = sellerData.city || '—';
    if (shopurlEl) {
      const shopurl = sellerData.shopurl || sellerData.shopUrl || '';
      shopurlEl.textContent = shopurl || '—';
      if (shopurl) {
        shopurlEl.onclick = () => window.open(`/service-shops.html?shop=${shopurl}`, '_blank');
      }
    }
    
    // Activity
    const todayBookingsEl = document.getElementById('profile-modal-today-bookings');
    const pendingEl = document.getElementById('profile-modal-pending');
    const streakEl = document.getElementById('profile-modal-streak');
    const walletEl = document.getElementById('profile-modal-wallet');
    
    // Get today's bookings from stat card
    const todayStatValue = document.querySelector('.stat-bookings .stat-value');
    if (todayBookingsEl) todayBookingsEl.textContent = todayStatValue?.textContent || '۰';
    
    // Get pending from stat card
    const pendingStatValue = document.querySelector('.stat-pending .stat-value');
    if (pendingEl) pendingEl.textContent = pendingStatValue?.textContent || '۰';
    
    // Get streak from streak card
    const streakValue = document.getElementById('daily-streak');
    if (streakEl) streakEl.textContent = streakValue?.textContent || '۰ روز';
    
    // Get wallet from wallet card
    const walletValue = document.getElementById('wallet-balance');
    if (walletEl) walletEl.textContent = walletValue?.textContent || '۰ تومان';
  };

  // Event listeners for seller profile modal
  if (sellerProfileModal.identitySection) {
    sellerProfileModal.identitySection.setAttribute('role', 'button');
    sellerProfileModal.identitySection.setAttribute('tabindex', '0');
    sellerProfileModal.identitySection.setAttribute('aria-haspopup', 'dialog');
    sellerProfileModal.identitySection.setAttribute('aria-controls', 'seller-profile-modal');
    
    sellerProfileModal.identitySection.addEventListener('click', openSellerProfileModal);
    sellerProfileModal.identitySection.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSellerProfileModal();
      }
    });
  }

  // Close modal handlers
  sellerProfileModal.backdrop?.addEventListener('click', closeSellerProfileModal);
  sellerProfileModal.closeBtn?.addEventListener('click', closeSellerProfileModal);
  sellerProfileModal.dismissBtns?.forEach(btn => {
    btn.addEventListener('click', closeSellerProfileModal);
  });

  // View shop button
  sellerProfileModal.viewShopBtn?.addEventListener('click', () => {
    const sellerData = JSON.parse(localStorage.getItem('seller') || '{}');
    const shopurl = sellerData.shopurl || sellerData.shopUrl || '';
    if (shopurl) {
      window.open(`/service-shops.html?shop=${shopurl}`, '_blank');
    }
    closeSellerProfileModal();
  });

  // Escape key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sellerProfileModal.modal && !sellerProfileModal.modal.hidden) {
      closeSellerProfileModal();
    }
  });

  // Expose globally
  window.openSellerProfileModal = openSellerProfileModal;
  window.closeSellerProfileModal = closeSellerProfileModal;

  // --- Profile Modal Button (پروفایل کاربری) ---
  const profileOpenBtn = document.getElementById('open-profile-modal-btn');
  if (profileOpenBtn) {
    profileOpenBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Close hamburger menu first
      closeHamburger();
      // Open seller profile modal
      openSellerProfileModal();
    });
  }

const MODERATION_STORAGE_KEY = 'vt:service-seller:moderation';
const moderationElements = {
  overlay: document.getElementById('moderation-overlay'),
  message: document.getElementById('moderation-overlay-message'),
  meta: document.getElementById('moderation-overlay-meta'),
  refresh: document.getElementById('moderation-overlay-refresh'),
  banner: document.getElementById('moderation-banner'),
  bannerText: document.getElementById('moderation-banner-text'),
  bannerClose: document.querySelector('[data-dismiss="moderation-banner"]')
};
let moderationSnapshot = null;

const formatModerationDateTime = (value) => {
  if (!value) return '';
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  } catch (err) {
    console.warn('formatModerationDateTime failed', err);
    return '';
  }
};

const readStoredModeration = () => {
  try {
    const raw = localStorage.getItem(MODERATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('readStoredModeration failed', err);
    return null;
  }
};

const persistModeration = (state) => {
  try {
    localStorage.setItem(MODERATION_STORAGE_KEY, JSON.stringify({
      isBlocked: !!state?.isBlocked,
      reason: state?.reason || '',
      blockedAt: state?.blockedAt || null,
      unblockedAt: state?.unblockedAt || state?.moderation?.unblockedAt || null,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.warn('persistModeration failed', err);
  }
};

const hideModerationBanner = () => {
  if (moderationElements.banner) {
    moderationElements.banner.setAttribute('hidden', '');
  }
};

const showModerationBanner = (info) => {
  if (!moderationElements.banner) return;
  const text = info?.moderation?.unblockedAt
    ? `آخرین بازبینی در ${formatModerationDateTime(info.moderation.unblockedAt)}`
    : (info?.unblockedAt ? `آخرین بازبینی در ${formatModerationDateTime(info.unblockedAt)}` : 'تمام امکانات پنل دوباره فعال است.');
  if (moderationElements.bannerText) {
    moderationElements.bannerText.textContent = text;
  }
  moderationElements.banner.removeAttribute('hidden');
};

const renderModerationMeta = (info) => {
  if (!moderationElements.meta) return;
  const parts = [];
  const blockedAtText = formatModerationDateTime(info?.blockedAt || info?.moderation?.blockedAt);
  if (blockedAtText) {
    parts.push(`<span>مسدود شده از ${escapeHtml(blockedAtText)}</span>`);
  }
  const reasonText = (info?.reason || info?.moderation?.reason || '').trim();
  if (reasonText) {
    parts.push(`<span>${escapeHtml(reasonText)}</span>`);
  } else {
    parts.push('<span>برای پیگیری با پشتیبانی ویترینت در ارتباط باشید.</span>');
  }
  const reviewedAtText = formatModerationDateTime(info?.moderation?.unblockedAt || info?.shop?.lastReviewedAt);
  if (reviewedAtText) {
    parts.push(`<span>آخرین بررسی: ${escapeHtml(reviewedAtText)}</span>`);
  }
  moderationElements.meta.innerHTML = parts.join('');
};

const applyModerationState = (info) => {
  if (!info) return;
  moderationSnapshot = info;
  const prev = readStoredModeration();
  const isBlocked = !!info.isBlocked;

  if (isBlocked) {
    document.body.dataset.shopBlocked = 'true';
    if (moderationElements.overlay) {
      moderationElements.overlay.removeAttribute('hidden');
    }
    if (moderationElements.message) {
      const reasonText = (info.reason || '').trim();
      moderationElements.message.textContent = reasonText
        ? `دلیل مسدودسازی: ${reasonText}`
        : 'برای حفظ کیفیت خدمات، دسترسی این فروشگاه موقتاً غیرفعال شده است.';
    }
    renderModerationMeta(info);
    hideModerationBanner();
  } else {
    delete document.body.dataset.shopBlocked;
    if (moderationElements.overlay) {
      moderationElements.overlay.setAttribute('hidden', '');
    }
    if (prev?.isBlocked) {
      showModerationBanner(info);
      const toast = window.UIComponents?.showToast;
      if (typeof toast === 'function') {
        toast('دسترسی فروشگاه دوباره فعال شد.', 'success');
      }
    } else {
      hideModerationBanner();
    }
  }

  persistModeration(info);
};

const fetchModerationStatus = async () => {
  try {
    const res = await fetch(bust(`${API_BASE}/api/service-shops/my/moderation`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (!res.ok) {
      throw new Error('MODERATION_STATUS_FAILED');
    }
    const data = await res.json();
    applyModerationState(data);
    return data;
  } catch (err) {
    console.error('fetchModerationStatus error', err);
    return null;
  }
};

if (moderationElements.refresh) {
  moderationElements.refresh.addEventListener('click', async () => {
    moderationElements.refresh.disabled = true;
    moderationElements.refresh.classList.add('is-loading');
    await fetchModerationStatus();
    moderationElements.refresh.classList.remove('is-loading');
    moderationElements.refresh.disabled = false;
  });
}

if (moderationElements.bannerClose) {
  moderationElements.bannerClose.addEventListener('click', () => hideModerationBanner());
}

applyModerationState(readStoredModeration());
await fetchModerationStatus();

const DEFAULT_FEATURE_FLAGS = Object.freeze({ sellerPlansEnabled: false });
const TRUE_FLAG_VALUES = new Set(['1', 'true', 'yes', 'on', 'enable', 'enabled', 'فعال', 'روشن', 'active']);
const FALSE_FLAG_VALUES = new Set(['0', 'false', 'no', 'off', 'disable', 'disabled', 'غیرفعال', 'خاموش', 'inactive']);

const parseFlagBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (TRUE_FLAG_VALUES.has(normalized)) return true;
    if (FALSE_FLAG_VALUES.has(normalized)) return false;
    return fallback;
  }
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'enabled')) {
      return parseFlagBoolean(value.enabled, fallback);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'value')) {
      return parseFlagBoolean(value.value, fallback);
    }
  }
  return fallback;
};

const normalizeFeatureFlags = (raw = {}) => ({
  sellerPlansEnabled: parseFlagBoolean(raw.sellerPlansEnabled, DEFAULT_FEATURE_FLAGS.sellerPlansEnabled)
});

function applySellerPlanFeatureFlags(flags = DEFAULT_FEATURE_FLAGS) {
  const normalized = normalizeFeatureFlags(flags);
  const planHero = document.getElementById('plan-hero');
  const plansView = document.getElementById('plans-view');
  const planNav = document.querySelector('.app-nav [data-page="plans"]');
  const overlay = plansView?.querySelector('.plan-disabled-overlay');
  const overlayTitle = overlay?.querySelector('.plan-disabled-title');
  const overlayText = overlay?.querySelector('.plan-disabled-text');
  const overlaySubtext = overlay?.querySelector('.plan-disabled-subtext');
  const viewContainer = plansView?.querySelector('.view-container');

  const rememberDefaultText = (element) => {
    if (!element || !element.dataset) return;
    if (!element.dataset.defaultText) {
      element.dataset.defaultText = element.textContent.trim();
    }
  };

  const restoreDefaultText = (element) => {
    if (!element || !element.dataset?.defaultText) return;
    element.textContent = element.dataset.defaultText;
  };

  rememberDefaultText(overlayTitle);
  rememberDefaultText(overlayText);
  rememberDefaultText(overlaySubtext);

  if (normalized.sellerPlansEnabled) {
    planHero?.removeAttribute('hidden');
    planHero?.removeAttribute('aria-hidden');
    planHero?.classList.remove('is-hidden');
    if (plansView) {
      plansView.classList.remove('plans-disabled');
      plansView.removeAttribute('aria-disabled');
      plansView.removeAttribute('aria-hidden');
    }
    overlay?.setAttribute('hidden', '');
    restoreDefaultText(overlayTitle);
    restoreDefaultText(overlayText);
    restoreDefaultText(overlaySubtext);
    viewContainer?.removeAttribute('aria-hidden');
    if (planNav) {
      planNav.classList.remove('is-hidden');
      planNav.removeAttribute('hidden');
      planNav.removeAttribute('aria-hidden');
      planNav.removeAttribute('tabindex');
    }
    if (document.body) {
      document.body.dataset.sellerPlans = 'enabled';
    }
  } else {
    planHero?.setAttribute('hidden', '');
    planHero?.setAttribute('aria-hidden', 'true');
    planHero?.classList.add('is-hidden');
    if (plansView) {
      plansView.classList.add('plans-disabled');
      plansView.setAttribute('aria-disabled', 'true');
      plansView.setAttribute('aria-hidden', 'true');
    }
    overlay?.removeAttribute('hidden');
    viewContainer?.setAttribute('aria-hidden', 'true');
    if (planNav) {
      planNav.classList.add('is-hidden');
      planNav.setAttribute('hidden', '');
      planNav.setAttribute('aria-hidden', 'true');
      planNav.setAttribute('tabindex', '-1');
    }
    if (document.body) {
      document.body.dataset.sellerPlans = 'disabled';
    }
    if (overlayTitle) {
      overlayTitle.textContent = 'پلن رایگان غیرفعال است';
    }
    if (overlayText) {
      overlayText.textContent = 'در حال حاضر مدیریت ویترینت دسترسی به پلن رایگان را متوقف کرده است.';
    }
    if (overlaySubtext) {
      overlaySubtext.textContent = 'برای اطلاع از زمان فعال‌سازی دوباره، اعلان‌ها یا پیام‌های پشتیبانی را دنبال کنید.';
    }
    if (window.location.hash === '#/plans') {
      window.location.hash = '#/dashboard';
    }
  }

  return normalized;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PLAN_PERKS_DEFAULT = Object.freeze([
  'نمایش ویژه در نتایج ویترینت',
  'پشتیبانی راه‌اندازی رایگان',
  'دسترسی به ابزارهای فروش حرفه‌ای'
]);

const faNumber = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '۰';
  try {
    return new Intl.NumberFormat('fa-IR').format(Math.max(0, Math.round(num)));
  } catch {
    return String(Math.max(0, Math.round(num)));
  }
};

const describePlanDuration = (days) => {
  const duration = Number(days);
  const result = {
    label: 'بدون محدودیت',
    status: 'بدون محدودیت',
    rawDays: null
  };

  if (!Number.isFinite(duration) || duration <= 0) {
    return result;
  }

  const suffixStatus = (label) => {
    if (!label) return '';
    if (label.endsWith('روز') || label.endsWith('ماه') || label.endsWith('سال')) {
      return `${label}ه`;
    }
    if (label.endsWith('هفته')) {
      return `${label}‌ای`;
    }
    return label;
  };

  if (duration % 365 === 0) {
    const years = duration / 365;
    const label = years === 1 ? '۱ سال' : `${faNumber(years)} سال`;
    return { label, status: suffixStatus(label), rawDays: duration };
  }

  if (duration % 30 === 0) {
    const months = duration / 30;
    const label = months === 1 ? '۱ ماه' : `${faNumber(months)} ماه`;
    return { label, status: suffixStatus(label), rawDays: duration };
  }

  if (duration % 7 === 0) {
    const weeks = duration / 7;
    const label = weeks === 1 ? '۱ هفته' : `${faNumber(weeks)} هفته`;
    return { label, status: suffixStatus(label), rawDays: duration };
  }

  const label = `${faNumber(duration)} روز`;
  return { label, status: suffixStatus(label), rawDays: duration };
};

const PlanCheckoutController = (() => {
  const state = {
    selectedPlanKey: null,
    couponPct: 0,
    coupon: null,
    couponRedeemed: false,
    couponLoading: false,
    dismissed: false
  };

  let plansView = null;
  let checkoutBar = null;
  let cbPlan = null;
  let cbDuration = null;
  let cbSaving = null;
  let cbTotal = null;
  let couponToggle = null;
  let couponRow = null;
  let couponInput = null;
  let couponApply = null;
  let cbClose = null;
  let couponStatus = null;
  let checkoutCTA = null;

  const ensureElements = () => {
    plansView = document.getElementById('plans-view');
    if (!plansView) return false;

    checkoutBar = plansView.querySelector('#checkout-bar');
    if (!checkoutBar) return false;

    cbPlan = checkoutBar.querySelector('.cb-plan');
    cbDuration = checkoutBar.querySelector('.cb-duration');
    cbSaving = checkoutBar.querySelector('.cb-saving');
    cbTotal = checkoutBar.querySelector('.cb-total');
    couponToggle = checkoutBar.querySelector('.cb-coupon-toggle');
    couponRow = checkoutBar.querySelector('.cb-coupon');
    couponInput = checkoutBar.querySelector('#coupon-input');
    couponApply = checkoutBar.querySelector('.cb-apply');
    cbClose = checkoutBar.querySelector('.cb-close');
    couponStatus = checkoutBar.querySelector('#cb-coupon-status');
    checkoutCTA = checkoutBar.querySelector('.cb-cta');
    return true;
  };

  const getCards = () => (plansView ? Array.from(plansView.querySelectorAll('.plan-modern')) : []);

  const getSelectedCard = () => {
    if (!plansView) return null;
    if (state.selectedPlanKey) {
      return (
        plansView.querySelector(`.plan-modern[data-plan="${state.selectedPlanKey}"]`) ||
        plansView.querySelector(`.plan-modern[data-id="${state.selectedPlanKey}"]`)
      );
    }
    return null;
  };

  const setCouponStatus = (message, type = 'info') => {
    if (!couponStatus) return;
    couponStatus.classList.remove('success', 'error', 'info');
    if (!message) {
      couponStatus.hidden = true;
      couponStatus.textContent = '';
      return;
    }
    couponStatus.hidden = false;
    couponStatus.textContent = message;
    couponStatus.classList.add(type);
  };

  const basePriceOf = (card) => {
    const priceEl = card?.querySelector('.price-value');
    const value = Number(priceEl?.dataset?.basePrice ?? priceEl?.dataset?.['1']);
    return Number.isFinite(value) ? value : 0;
  };

  const durationLabelOf = (card) => card?.dataset?.durationLabel || 'بدون محدودیت';
  const durationStatusOf = (card) => card?.dataset?.durationStatus || durationLabelOf(card);

  const formatPrice = (value) => {
    const amount = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    return `${faNumber(amount)} تومان`;
  };

  const updateCard = (card) => {
    if (!card) return;
    const priceEl = card.querySelector('.price-value');
    const periodValue = card.querySelector('.period-value');
    const savingsWrap = card.querySelector('.price-savings');
    const savingsAmount = card.querySelector('.savings-amount');

    if (priceEl) {
      priceEl.textContent = faNumber(basePriceOf(card));
    }
    if (periodValue) {
      periodValue.textContent = durationLabelOf(card);
    }
    if (savingsWrap) {
      savingsWrap.classList.add('hidden');
    }
    if (savingsAmount) {
      savingsAmount.textContent = '';
    }
  };

  const updateCards = () => {
    getCards().forEach(updateCard);
  };

  const hideCheckout = () => {
    if (!checkoutBar) return;
    checkoutBar.classList.remove('visible');
    checkoutBar.setAttribute('aria-hidden', 'true');
    if (cbPlan) cbPlan.textContent = '—';
    if (cbDuration) cbDuration.textContent = '—';
    if (cbSaving) {
      cbSaving.textContent = '';
      cbSaving.style.display = 'none';
    }
    if (cbTotal) cbTotal.textContent = '—';
    setCouponStatus('');
  };

  const showCheckout = (card) => {
    if (!checkoutBar || !card) return;

    const base = basePriceOf(card);
    const coupon = state.coupon;
    const discountPercent = Number(coupon?.discountPercent ?? state.couponPct ?? 0);
    const finalPrice = Math.max(0, base * (1 - discountPercent / 100));

    if (cbPlan) {
      cbPlan.textContent = card.querySelector('.plan-title-card')?.textContent?.trim() || '—';
    }
    if (cbDuration) {
      cbDuration.textContent = durationStatusOf(card);
    }
    if (cbSaving) {
      if (discountPercent > 0) {
        const codeLabel = coupon?.code ? ` با کد ${escapeHtml(coupon.code)}` : '';
        cbSaving.innerHTML = `تخفیف ${faNumber(discountPercent)}٪${codeLabel}`;
        cbSaving.style.display = 'inline-block';
      } else {
        cbSaving.textContent = '';
        cbSaving.style.display = 'none';
      }
    }
    if (cbTotal) {
      cbTotal.textContent = formatPrice(finalPrice);
    }

    checkoutBar.classList.add('visible');
    checkoutBar.setAttribute('aria-hidden', 'false');
  };

  const updateCheckout = () => {
    const selected = getSelectedCard();
    if (!selected || state.dismissed) {
      hideCheckout();
      return;
    }
    state.couponPct = Number(state.coupon?.discountPercent || 0);
    showCheckout(selected);
  };

  const selectPlan = (card) => {
    if (!card) return;
    getCards().forEach((c) => {
      if (c === card) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
      }
    });
    state.selectedPlanKey = card.dataset.plan || card.dataset.id || card.dataset.slug || null;
    state.couponRedeemed = false;
    state.dismissed = false;
    updateCheckout();
  };

  const handlePlansClick = (event) => {
    if (!plansView) return;
    const card = event.target.closest('.plan-modern');
    if (!card || !plansView.contains(card)) return;
    event.stopPropagation();
    selectPlan(card);
  };

  const handleCouponToggle = () => {
    if (!couponRow || !couponToggle) return;
    const willShow = couponRow.hasAttribute('hidden');
    couponRow.toggleAttribute('hidden');
    couponToggle.setAttribute('aria-expanded', String(willShow));
  };

  const handleCouponApply = async () => {
    if (state.couponLoading) return;
    const raw = couponInput?.value?.trim() || '';

    if (!raw) {
      state.coupon = null;
      state.couponPct = 0;
      state.couponRedeemed = false;
      setCouponStatus('کد تخفیف غیرفعال شد.', 'info');
      updateCheckout();
      window.UIComponents?.showToast?.('کد تخفیف حذف شد.', 'info');
      return;
    }

    if (!state.selectedPlanKey) {
      setCouponStatus('برای اعمال کد، ابتدا یک پلن را انتخاب کنید.', 'info');
      window.UIComponents?.showToast?.('ابتدا پلن مورد نظر را انتخاب کنید.', 'info');
      return;
    }

    const code = raw.toUpperCase().replace(/[^A-Z0-9-_]/g, '');
    if (couponInput) {
      couponInput.value = code;
    }

    if (!code) {
      setCouponStatus('کد وارد شده معتبر نیست.', 'error');
      window.UIComponents?.showToast?.('کد وارد شده معتبر نیست.', 'error');
      return;
    }

    const originalLabel = couponApply?.textContent ?? '';

    try {
      state.couponLoading = true;
      setCouponStatus('در حال بررسی کد...', 'info');
      if (couponApply) {
        couponApply.disabled = true;
        couponApply.dataset.originalLabel = originalLabel;
        couponApply.textContent = 'در حال بررسی...';
      }

      const result = await API.validatePlanDiscountCode({ code, planKey: state.selectedPlanKey });
      if (!result) {
        throw new Error('کد تخفیف نامعتبر است.');
      }

      state.coupon = result;
      state.couponPct = Number(result.discountPercent || 0);
      state.couponRedeemed = false;
      setCouponStatus(`کد ${result.code} فعال شد.`, 'success');
      updateCheckout();
      window.UIComponents?.showToast?.(`کد ${result.code} اعمال شد.`, 'success');
    } catch (err) {
      state.coupon = null;
      state.couponPct = 0;
      state.couponRedeemed = false;
      const message = err?.message || 'کد تخفیف نامعتبر است.';
      setCouponStatus(message, 'error');
      updateCheckout();
      window.UIComponents?.showToast?.(message, 'error');
    } finally {
      state.couponLoading = false;
      if (couponApply) {
        couponApply.disabled = false;
        if (couponApply.dataset.originalLabel != null) {
          couponApply.textContent = couponApply.dataset.originalLabel;
          delete couponApply.dataset.originalLabel;
        } else {
          couponApply.textContent = originalLabel;
        }
      }
    }
  };

  const handleCheckoutCTA = async () => {
    if (!checkoutCTA) return;
    if (!state.selectedPlanKey) {
      window.UIComponents?.showToast?.('ابتدا پلن مورد نظر را انتخاب کنید.', 'info');
      return;
    }

    const originalLabel = checkoutCTA.textContent ?? '';
    checkoutCTA.disabled = true;
    checkoutCTA.setAttribute('aria-busy', 'true');
    checkoutCTA.textContent = 'در حال پردازش...';

    try {
      if (state.coupon?.code && !state.couponRedeemed) {
        setCouponStatus(`در حال ثبت کد ${state.coupon.code}...`, 'info');
        const updated = await API.redeemPlanDiscountCode(state.coupon.code, {});
        if (updated) {
          state.coupon = updated;
          state.couponPct = Number(updated.discountPercent || 0);
        }
        state.couponRedeemed = true;
        setCouponStatus(`ثبت کد ${state.coupon.code} انجام شد.`, 'success');
        updateCheckout();
      }

      window.UIComponents?.showToast?.('درگاه پرداخت به‌زودی متصل می‌شود.', 'success');
    } catch (err) {
      const message = err?.message || 'ثبت استفاده از کد تخفیف ناموفق بود.';
      setCouponStatus(message, 'error');
      window.UIComponents?.showToast?.(message, 'error');
      state.couponRedeemed = false;
    } finally {
      checkoutCTA.disabled = false;
      checkoutCTA.removeAttribute('aria-busy');
      checkoutCTA.textContent = originalLabel;
    }
  };

  const handleClose = (event) => {
    event?.stopPropagation();
    state.dismissed = true;
    updateCheckout();
  };

  const handleDocumentClick = (event) => {
    if (!checkoutBar?.classList.contains('visible')) return;
    if (checkoutBar.contains(event.target)) return;
    if (event.target.closest('.plan-modern')) return;
    state.dismissed = true;
    updateCheckout();
  };

  const handleHashChange = () => {
    if (window.location.hash === '#/plans') {
      if (!state.dismissed) {
        updateCheckout();
      }
    } else {
      hideCheckout();
    }
  };

  const init = () => {
    if (!ensureElements()) return;

    if (checkoutBar.dataset.controllerBound === 'true') {
      updateCards();
      updateCheckout();
      return;
    }

    checkoutBar.dataset.controllerBound = 'true';

    plansView.addEventListener('click', handlePlansClick);
    couponToggle?.addEventListener('click', handleCouponToggle);
    couponApply?.addEventListener('click', handleCouponApply);
    cbClose?.addEventListener('click', handleClose);
    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('hashchange', handleHashChange);
    checkoutCTA?.addEventListener('click', handleCheckoutCTA);

    updateCards();
    updateCheckout();
  };

  const refresh = () => {
    if (!ensureElements()) return;
    updateCards();
    if (state.selectedPlanKey) {
      const selected = getSelectedCard();
      if (!selected) {
        state.selectedPlanKey = null;
        state.dismissed = false;
      }
    }
    updateCheckout();
  };

  return { init, refresh, state };
})();

const formatPersianDate = (value) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-nu-latn-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch {
    return date.toLocaleDateString('fa-IR');
  }
};

const planUI = {
  grid: document.getElementById('seller-plans-grid'),
  feedback: document.getElementById('seller-plans-feedback'),
  states: {
    loading: document.getElementById('seller-plans-loading'),
    empty: document.getElementById('seller-plans-empty'),
    error: document.getElementById('seller-plans-error')
  },
  socialProof: document.getElementById('plans-social-proof')
};

const PLAN_CARD_ICONS = Object.freeze([
  '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m4 0v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>'
]);

const PLAN_FEATURE_CHECK_ICON = '<svg class="feature-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
const PLAN_CTA_ARROW_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14m-7-7l7 7-7 7"/></svg>';

const normalizePlanSlugForDisplay = (value, fallback) => {
  const raw = (value || '').toString().trim().toLowerCase();
  if (!raw) return fallback;
  return raw.replace(/[^a-z0-9-\s]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
};

const setPlansState = (state) => {
  const states = planUI.states || {};
  let matchedState = false;

  Object.entries(states).forEach(([key, el]) => {
    if (!el) return;
    const isActive = state === key;
    if (isActive) matchedState = true;
    el.hidden = !isActive;
    if (isActive) {
      el.setAttribute('aria-hidden', 'false');
      el.classList.add('is-active');
    } else {
      el.setAttribute('aria-hidden', 'true');
      el.classList.remove('is-active');
    }
  });

  if (planUI.feedback) {
    const shouldHideFeedback = state === 'ready' || !matchedState;
    planUI.feedback.dataset.state = state;
    planUI.feedback.setAttribute('aria-hidden', shouldHideFeedback ? 'true' : 'false');
    if (shouldHideFeedback) {
      planUI.feedback.setAttribute('hidden', '');
    } else {
      planUI.feedback.removeAttribute('hidden');
    }
  }

  if (planUI.grid) {
    if (state === 'ready') {
      planUI.grid.removeAttribute('hidden');
    } else {
      planUI.grid.setAttribute('hidden', '');
    }
  }

  if (planUI.socialProof && state !== 'ready') {
    planUI.socialProof.textContent = '';
  }
};

const resolvePlanStatus = (plan, meta) => {
  if (meta.featured) return 'پیشنهاد ویژه';
  if (plan.durationInfo?.rawDays != null) {
    return plan.durationInfo.status;
  }
  if (plan.durationInfo?.label) {
    return plan.durationInfo.label;
  }
  if (meta.index === 0 && meta.total > 1) return 'اقتصادی';
  if (meta.index === meta.total - 1 && meta.total > 1) return 'پیشرفته';
  return 'پلن فعال';
};

const pickPlanIcon = (index = 0) => PLAN_CARD_ICONS[index % PLAN_CARD_ICONS.length];

const normalisePlanForDisplay = (plan, index) => {
  const fallbackId = `plan-${index}`;
  const rawFeatures = Array.isArray(plan?.features) ? plan.features : [];
  const features = rawFeatures
    .map((feature) => (typeof feature === 'string' ? feature : feature?.value))
    .filter(Boolean);

  const price = Number(plan?.price);
  const durationRaw = Number(plan?.durationDays);
  const durationDays = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : null;
  const durationInfo = describePlanDuration(durationDays);

  const title = (plan?.title || '').toString().trim();
  const description = (plan?.description || '').toString().trim();
  const slug = normalizePlanSlugForDisplay(plan?.slug, fallbackId);

  return {
    id: plan?.id || plan?._id || slug || fallbackId,
    slug: slug || fallbackId,
    title: title || 'پلن خدماتی',
    description: description || 'جزئیات این پلن به‌زودی تکمیل می‌شود.',
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    durationDays,
    durationInfo,
    durationLabel: durationInfo.label,
    durationStatus: durationInfo.status,
    features: features.length ? features : PLAN_PERKS_DEFAULT.slice()
  };
};

const createPlanCard = (plan, meta) => {
  const article = document.createElement('article');
  article.className = 'plan-modern';
  article.dataset.plan = plan.slug || plan.id;
  article.dataset.price = String(Math.max(0, plan.price));
  if (plan.durationDays != null) {
    article.dataset.durationDays = String(plan.durationDays);
  }
  if (plan.durationInfo) {
    article.dataset.durationLabel = plan.durationInfo.label || '';
    article.dataset.durationStatus = plan.durationInfo.status || '';
  }
  article.setAttribute('role', 'listitem');

  if (meta.featured) {
    article.classList.add('featured');
  }

  const status = document.createElement('div');
  status.className = 'plan-status';
  if (meta.featured) {
    status.classList.add('featured');
  }
  status.textContent = meta.status;
  article.appendChild(status);

  if (meta.featured) {
    const glow = document.createElement('div');
    glow.className = 'plan-featured-glow';
    glow.setAttribute('aria-hidden', 'true');
    article.appendChild(glow);
  }

  const content = document.createElement('div');
  content.className = 'plan-content-modern';
  article.appendChild(content);

  const icon = document.createElement('div');
  icon.className = 'plan-icon-modern';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = pickPlanIcon(meta.index);
  content.appendChild(icon);

  const titleEl = document.createElement('h3');
  titleEl.className = 'plan-title-card';
  titleEl.textContent = plan.title;
  content.appendChild(titleEl);

  const descEl = document.createElement('p');
  descEl.className = 'plan-desc';
  descEl.textContent = plan.description;
  content.appendChild(descEl);

  const priceWrap = document.createElement('div');
  priceWrap.className = 'plan-price-modern';
  content.appendChild(priceWrap);

  const priceMain = document.createElement('div');
  priceMain.className = 'price-main';
  priceWrap.appendChild(priceMain);

  const priceValue = document.createElement('span');
  priceValue.className = 'price-value';
  priceValue.dataset['1'] = String(Math.max(0, plan.price));
  priceValue.dataset.basePrice = String(Math.max(0, plan.price));
  priceValue.textContent = faNumber(plan.price);
  priceMain.appendChild(priceValue);

  const currency = document.createElement('span');
  currency.className = 'price-currency';
  currency.textContent = 'تومان';
  priceMain.appendChild(currency);

  const period = document.createElement('div');
  period.className = 'price-period';
  const hasFiniteDuration = plan.durationInfo?.rawDays != null;
  period.textContent = hasFiniteDuration ? 'برای ' : 'مدت پلن: ';
  const periodValue = document.createElement('span');
  periodValue.className = 'period-value';
  periodValue.textContent = plan.durationInfo?.label || 'بدون محدودیت';
  period.appendChild(periodValue);
  priceWrap.appendChild(period);

  const savings = document.createElement('div');
  savings.className = 'price-savings hidden';
  const savingsAmount = document.createElement('span');
  savingsAmount.className = 'savings-amount';
  savings.appendChild(savingsAmount);
  priceWrap.appendChild(savings);

  const featuresWrap = document.createElement('div');
  featuresWrap.className = 'plan-features-modern';
  content.appendChild(featuresWrap);

  plan.features.forEach((text) => {
    const item = document.createElement('div');
    item.className = 'feature-modern';
    item.innerHTML = PLAN_FEATURE_CHECK_ICON;
    const span = document.createElement('span');
    span.textContent = text;
    item.appendChild(span);
    featuresWrap.appendChild(item);
  });

  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = meta.featured ? 'plan-cta-modern primary' : 'plan-cta-modern';
  cta.setAttribute('aria-label', `انتخاب پلن ${plan.title}`);
  if (meta.featured) {
    cta.innerHTML = `<span>انتخاب پلن</span>${PLAN_CTA_ARROW_ICON}`;
  } else {
    cta.textContent = 'انتخاب پلن';
  }
  content.appendChild(cta);

  return article;
};

const renderSellerPlans = (plansRaw = []) => {
  if (!planUI.grid) return [];

  const activePlans = Array.isArray(plansRaw)
    ? plansRaw.filter((plan) => plan && plan.isActive !== false)
    : [];

  if (!activePlans.length) {
    planUI.grid.innerHTML = '';
    setPlansState('empty');
    window.__SELLER_SERVICE_PLANS__ = [];
    PlanCheckoutController.refresh();
    PlanCheckoutController.init();
    return [];
  }

  const normalised = activePlans.map((plan, index) => normalisePlanForDisplay(plan, index));
  normalised.sort((a, b) => a.price - b.price || a.title.localeCompare(b.title, 'fa-IR'));

  const featuredIndex = normalised.length > 1 ? Math.min(1, normalised.length - 1) : 0;

  planUI.grid.innerHTML = '';
  normalised.forEach((plan, index) => {
    const card = createPlanCard(plan, {
      index,
      total: normalised.length,
      featured: index === featuredIndex,
      status: resolvePlanStatus(plan, { index, total: normalised.length, featured: index === featuredIndex })
    });
    planUI.grid.appendChild(card);
  });

  setPlansState('ready');

  if (planUI.socialProof) {
    planUI.socialProof.textContent = `${faNumber(normalised.length)} پلن فعال برای انتخاب آماده است.`;
  }

  window.__SELLER_SERVICE_PLANS__ = normalised;
  PlanCheckoutController.refresh();
  PlanCheckoutController.init();
  return normalised;
};

async function loadSellerPlans() {
  if (!planUI.grid) return [];
  try {
    setPlansState('loading');
    const plans = await API.getServicePlans();
    return renderSellerPlans(plans);
  } catch (err) {
    console.error('loadSellerPlans failed', err);
    planUI.grid.innerHTML = '';
    setPlansState('error');
    window.__SELLER_SERVICE_PLANS__ = [];
    PlanCheckoutController.refresh();
    PlanCheckoutController.init();
    return [];
  }
}

const ensureDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizePlanForUI = (raw = {}) => {
  const plan = {
    isActive: !!raw.isActive,
    note: raw.note || '',
    startDate: ensureDate(raw.startDate),
    endDate: ensureDate(raw.endDate),
    durationDays: null,
    usedDays: null,
    remainingDays: raw.remainingDays ?? null,
    totalDays: raw.totalDays ?? null,
    activeNow: !!raw.activeNow,
    hasExpired: !!raw.hasExpired,
    perks: Array.isArray(raw.perks) && raw.perks.length ? raw.perks : PLAN_PERKS_DEFAULT,
    title: raw.planTitle || raw.title || '',
    slug: raw.planSlug || raw.slug || ''
  };

  const durationInput = Number(raw.durationDays);
  if (Number.isFinite(durationInput) && durationInput > 0) {
    plan.durationDays = Math.round(durationInput);
  }

  if (plan.startDate && plan.endDate && plan.durationDays == null) {
    const diff = Math.round((plan.endDate - plan.startDate) / MS_PER_DAY);
    plan.durationDays = diff > 0 ? diff : 1;
  }

  if (plan.totalDays == null && plan.durationDays != null) {
    plan.totalDays = plan.durationDays;
  }

  const now = new Date();
  const effectiveEnd = plan.endDate && plan.endDate < now ? plan.endDate : now;

  if (plan.startDate) {
    const used = Math.max(0, Math.round((effectiveEnd - plan.startDate) / MS_PER_DAY));
    if (plan.totalDays != null) {
      plan.usedDays = Math.min(used, Math.max(0, plan.totalDays));
    } else if (plan.endDate) {
      const diff = Math.max(0, Math.round((plan.endDate - plan.startDate) / MS_PER_DAY));
      plan.totalDays = diff;
      plan.usedDays = Math.min(used, diff);
    } else {
      plan.usedDays = used;
    }
  }

  if (plan.remainingDays == null) {
    if (plan.endDate) {
      plan.remainingDays = Math.max(0, Math.ceil((plan.endDate - now) / MS_PER_DAY));
    } else if (plan.totalDays != null && plan.usedDays != null) {
      plan.remainingDays = Math.max(0, plan.totalDays - plan.usedDays);
    }
  }

  plan.activeNow = plan.activeNow || (plan.isActive && (!plan.endDate || plan.endDate >= now));
  plan.hasExpired = plan.hasExpired || (plan.isActive && !!plan.endDate && plan.endDate < now);

  return plan;
};

const bindPlanHeroActions = (() => {
  let bound = false;
  return () => {
    if (bound) return;
    bound = true;
    const goPlans = () => { window.location.hash = '#/plans'; };
    document.getElementById('plan-renew-btn')?.addEventListener('click', goPlans);
  };
})();

function renderComplimentaryPlan(planRaw) {
  const planHero = document.getElementById('plan-hero');
  if (!planHero) return;

  planHero.removeAttribute('hidden');
  planHero.setAttribute('aria-hidden', 'false');
  planHero.classList.remove('is-hidden');

  const plan = normalizePlanForUI(planRaw || {});
  const tierEl = document.getElementById('plan-tier');
  const daysLeftEl = document.getElementById('plan-days-left');
  const expiryEl = document.getElementById('plan-expiry');
  const progressBar = document.getElementById('plan-progress-bar');
  const usedEl = document.getElementById('plan-used');
  const leftEl = document.getElementById('plan-left');
  const messageEl = document.getElementById('plan-hero-message');
  const perksList = document.getElementById('plan-hero-perks');
  const statusChip = document.getElementById('plan-status-chip');
  const subtextEl = document.getElementById('plan-hero-subtext');
  const plansDisabled = document.body?.dataset?.sellerPlans === 'disabled';
  const planCtaBtn = document.getElementById('plan-renew-btn');
  const planNameEl = document.getElementById('plan-name');
  const progressTrack = document.getElementById('plan-progress');
  const giftNoteEl = document.getElementById('plan-gift-note');

  const hasAnyPlanLifecycle = plan.activeNow || plan.isActive || plan.hasExpired || plan.startDate || plan.endDate;
  const planlessNudge = !plansDisabled && !hasAnyPlanLifecycle;

  const planState = plan.activeNow
    ? 'active'
    : plan.hasExpired
      ? 'expired'
      : plan.isActive
        ? 'scheduled'
        : 'inactive';

  if (planHero.dataset) {
    planHero.dataset.planState = planState;
    planHero.dataset.planDisabled = plansDisabled ? 'true' : 'false';
  }

  planHero.classList.toggle('plan-hero--empty', planlessNudge);

  bindPlanHeroActions();

  if (tierEl) {
    let tierLabel;
    if (planlessNudge) {
      tierLabel = 'نیاز به انتخاب پلن';
    } else if (plan.activeNow) {
      tierLabel = plan.title ? `پلن «${plan.title}» فعال است` : 'پلن رایگان فعال است';
    } else if (plan.hasExpired) {
      tierLabel = plan.title ? `پلن «${plan.title}» منقضی شده` : 'پلن رایگان منقضی شده است';
    } else if (plan.isActive) {
      tierLabel = plan.title ? `پلن «${plan.title}» در انتظار شروع` : 'پلن رایگان در انتظار شروع';
    } else {
      tierLabel = plan.title ? `پلن «${plan.title}» غیرفعال است` : 'پلن رایگان غیرفعال شده است';
    }
    tierEl.textContent = tierLabel;
  }

  if (planNameEl) {
    let planNameLabel;
    if (planlessNudge) {
      planNameLabel = 'در انتظار انتخاب پلن';
    } else if (plan.activeNow) {
      planNameLabel = plan.title || 'پلن هدیه فعال';
    } else {
      planNameLabel = plan.title || 'پلن هدیه غیرفعال شده';
    }
    planNameEl.textContent = planNameLabel;
  }

  if (planCtaBtn) {
    if (planlessNudge) {
      planCtaBtn.textContent = 'مشاهده و خرید پلن';
      planCtaBtn.setAttribute('aria-label', 'مشاهده و خرید پلن مناسب کسب‌وکار');
    } else if (plan.activeNow) {
    planCtaBtn.textContent = 'فعالسازی پلن';
    planCtaBtn.setAttribute('aria-label', 'فعالسازی پلن');
    } else {
      planCtaBtn.textContent = 'فعالسازی مجدد / ارتقا';
      planCtaBtn.setAttribute('aria-label', 'فعالسازی مجدد یا ارتقای پلن متوقف‌شده');
    }
  }

  const remainingDays = plan.remainingDays != null ? Math.max(0, plan.remainingDays) : null;
  if (daysLeftEl) {
    daysLeftEl.textContent = remainingDays != null ? `${faNumber(remainingDays)} روز` : '—';
  }

  const expiryDate = plan.endDate || (plan.startDate && plan.totalDays != null
    ? new Date(plan.startDate.getTime() + plan.totalDays * MS_PER_DAY)
    : null);
  const expiryLabel = expiryDate ? formatPersianDate(expiryDate) : 'نامشخص';
  if (expiryEl) {
    expiryEl.textContent = expiryLabel;
  }
  const startLabel = plan.startDate ? formatPersianDate(plan.startDate) : null;

  const progress = plan.totalDays
    ? Math.min(100, Math.max(0, Math.round(((plan.usedDays || 0) / plan.totalDays) * 100)))
    : 0;
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
    progressBar.setAttribute('aria-valuemin', '0');
    progressBar.setAttribute('aria-valuemax', '100');
    progressBar.setAttribute('aria-valuenow', String(progress));
  }
  const usedDays = plan.usedDays != null ? Math.max(0, plan.usedDays) : 0;
  const leftDays = remainingDays != null && plan.totalDays != null
    ? Math.max(0, plan.totalDays - usedDays)
    : remainingDays ?? 0;
  const progressText = `${faNumber(progress)}٪ استفاده شده`;

  if (progressTrack) {
    progressTrack.setAttribute('aria-valuenow', String(progress));
    progressTrack.setAttribute('aria-valuetext', progressText);
  }

  if (usedEl) usedEl.textContent = `${faNumber(usedDays)} روز (${faNumber(progress)}٪)`;
  if (leftEl) leftEl.textContent = `${faNumber(leftDays)} روز`;

  if (statusChip) {
    statusChip.classList.remove('chip-live');
    if (planlessNudge) {
      statusChip.textContent = 'پلن انتخاب نشده است';
    } else if (plan.activeNow) {
      statusChip.classList.add('chip-live');
      statusChip.textContent = 'تایید شده';
    } else if (plan.hasExpired) {
      statusChip.textContent = 'پلن رایگان منقضی شده';
    } else if (plan.isActive) {
      statusChip.textContent = 'پلن رایگان در انتظار شروع';
    } else {
      statusChip.textContent = 'پلن رایگان غیرفعال';
    }
  }

  if (perksList) {
    perksList.innerHTML = '';
    const perks = planlessNudge
      ? [
          'مقایسه پلن‌ها و انتخاب سریع',
          'پشتیبانی تلفنی ۹۱۰۰-۹۹۰۰ برای راهنمایی',
          'فعال‌سازی فوری پس از پرداخت'
        ]
      : plan.perks;
    perks.forEach((perk) => {
      const li = document.createElement('li');
      li.textContent = perk;
      perksList.appendChild(li);
    });
  }

  // تاریخ فعالسازی پلن
  const planStartDateEl = document.getElementById('plan-start-date');
  if (planStartDateEl) {
    planStartDateEl.textContent = startLabel || '—';
  }

  if (messageEl) {
    if (plan.note) {
      messageEl.textContent = plan.note;
    } else if (planlessNudge) {
      messageEl.innerHTML = 'هیچ پلنی برای فروشگاه فعال نیست و دسترسی‌ها متوقف شده‌اند. برای فعال شدن همه قابلیت‌ها، از بخش «<a href="#/plans" class="plan-link">پلن‌ها</a>» یکی از گزینه‌ها را انتخاب کنید.';
    } else if (plan.activeNow) {
      const remainingText = remainingDays != null ? `${faNumber(remainingDays)} روز` : '';
      messageEl.innerHTML = `🎉 این پلن رایگان به عنوان هدیه مدیریت ویترینت فعال شده است.${remainingText ? ` <strong>${remainingText}</strong> از دوره پلن باقی مانده است.` : ''}`;
    } else if (plan.hasExpired) {
      messageEl.textContent = 'دوره پلن به پایان رسیده است. برای ادامه از بخش «پلن‌ها» پلن جدیدی انتخاب و فعال کنید.';
    } else if (plan.isActive) {
      const startText = startLabel ? `از ${startLabel}` : 'به‌زودی';
      messageEl.textContent = `پلن رایگان شما ${startText} فعال می‌شود. هنگام شروع، همینجا اطلاع‌رسانی خواهد شد.`;
    } else if (plansDisabled) {
      messageEl.textContent = 'پلن رایگان موقتاً از سمت مدیریت غیرفعال است. با تغییر وضعیت، اطلاع‌رسانی می‌شود.';
    } else {
      messageEl.textContent = 'هنوز پلن رایگان برای فروشگاه شما فعال نشده است. در صورت فعال‌سازی، جزئیات همینجا نمایش داده می‌شود.';
    }
  }

  let subtext = 'وضعیت پلن رایگان توسط تیم مدیریت ویترینت کنترل می‌شود و فعلاً غیرفعال است. برای پیگیری با پشتیبانی در ارتباط باشید.';
  if (plan.activeNow) {
    subtext = 'شما به تمام امکانات پلن دسترسی دارید. از خدمات و نوبت‌دهی استفاده کنید.';
  } else if (plan.hasExpired) {
    subtext = 'پلن قبلی منقضی شده است. از بخش «پلن‌ها» یکی از گزینه‌ها را انتخاب کنید تا دسترسی کامل دوباره فعال شود.';
  } else if (plan.isActive) {
    subtext = startLabel
      ? `پلن رایگان شما از ${startLabel} فعال می‌شود.`
      : 'پلن رایگان شما زمان‌بندی شده است و به‌زودی فعال خواهد شد.';
  } else if (plansDisabled) {
    subtext = 'دسترسی رایگان به صورت سراسری غیرفعال شده است؛ با تغییر وضعیت، اطلاع‌رسانی می‌شود.';
  }
  if (subtextEl) {
    if (planlessNudge) {
      subtextEl.innerHTML = 'برای شروع فروش حرفه‌ای، وارد بخش <a href="#/plans" class="plan-link">پلن‌ها</a> شوید، پلن مناسب را انتخاب کنید و در کمتر از یک دقیقه فعال‌سازی را انجام دهید.';
    } else {
      subtextEl.textContent = subtext;
    }
  }

  // نمایش یادداشت هدیه برای پلن‌ها با وضعیت‌های مختلف
  if (giftNoteEl) {
    // حذف کلاس‌های قبلی
    giftNoteEl.classList.remove('is-visible', 'is-active', 'is-expired', 'is-inactive', 'is-scheduled');
    
    if (planlessNudge) {
      // هیچ پلنی انتخاب نشده
      giftNoteEl.innerHTML = '<span class="gift-note-icon">📋</span> هنوز پلنی برای فروشگاه شما فعال نشده است.';
      giftNoteEl.hidden = false;
      giftNoteEl.classList.add('is-visible', 'is-inactive');
    } else if (plan.activeNow) {
      // پلن فعال است
      giftNoteEl.innerHTML = '<span class="gift-note-icon">🎁</span> این پلن رایگان به عنوان هدیه مدیریت ویترینت فعال شده است.';
      giftNoteEl.hidden = false;
      giftNoteEl.classList.add('is-visible', 'is-active');
    } else if (plan.hasExpired) {
      // پلن منقضی شده
      giftNoteEl.innerHTML = '<span class="gift-note-icon">⏰</span> دوره پلن رایگان به پایان رسیده است. برای ادامه فعالیت، پلن جدیدی تهیه کنید.';
      giftNoteEl.hidden = false;
      giftNoteEl.classList.add('is-visible', 'is-expired');
    } else if (plan.isActive) {
      // پلن در انتظار شروع
      const startText = startLabel ? `از تاریخ ${startLabel}` : 'به‌زودی';
      giftNoteEl.innerHTML = `<span class="gift-note-icon">📅</span> پلن رایگان شما ${startText} فعال خواهد شد.`;
      giftNoteEl.hidden = false;
      giftNoteEl.classList.add('is-visible', 'is-scheduled');
    } else {
      // پلن غیرفعال شده توسط ادمین
      giftNoteEl.innerHTML = '<span class="gift-note-icon">🚫</span> پلن رایگان توسط مدیریت غیرفعال شده است. برای پیگیری با پشتیبانی تماس بگیرید.';
      giftNoteEl.hidden = false;
      giftNoteEl.classList.add('is-visible', 'is-inactive');
    }
  }

  window.__COMPLIMENTARY_PLAN_NORMALIZED__ = plan;
}

const PlanAccessGuard = (() => {
  // نگهداری آخرین وضعیت پلن
  let currentPlan = null;

  const overlays = {
    settings: document.getElementById('plan-lock-settings'),
    bookings: document.getElementById('plan-lock-bookings')
  };

  const lockableButtons = [
    document.getElementById('add-service-btn'),
    document.getElementById('add-portfolio-btn'),
    document.getElementById('vip-settings-btn'),
    document.getElementById('vip-toggle-btn'),
    document.getElementById('vip-toggle-confirm'),
    document.getElementById('service-image-btn'),
    document.getElementById('portfolio-image-btn'),
    document.getElementById('footer-pick-btn'),
    document.getElementById('footer-remove-btn')
  ];

  const lockableForms = [
    document.getElementById('settings-form'),
    document.getElementById('service-form'),
    document.getElementById('portfolio-form'),
    document.getElementById('vip-form')
  ];

  const goPlans = () => { window.location.hash = '#/plans'; };

  const ensureOverlayActions = () => {
    Object.values(overlays).forEach((overlay) => {
      if (!overlay || overlay.dataset.bind === 'true') return;
      overlay.dataset.bind = 'true';
      overlay.querySelectorAll('[data-go-plans]').forEach((btn) => {
        btn.addEventListener('click', goPlans);
      });
    });
  };

  // تابع اصلی اعمال قفل یا باز کردن
  const setLockedState = (isLocked) => {
    ensureOverlayActions();
    
    // 1. مدیریت پرده‌های قفل (Overlays)
    Object.values(overlays).forEach((overlay) => {
      if (!overlay) return;
      overlay.hidden = !isLocked;
      overlay.setAttribute('aria-hidden', isLocked ? 'false' : 'true');
      // اگر باز شد، مطمئن شو دیسپلی none نباشه
      if (!isLocked) overlay.style.display = 'none'; 
      else overlay.style.display = '';
    });

    // 2. مدیریت دکمه‌ها
    lockableButtons.forEach((btn) => {
      if (!btn) return;
      btn.disabled = isLocked;
      if (isLocked) {
        btn.setAttribute('aria-disabled', 'true');
        btn.classList.add('is-disabled');
      } else {
        btn.removeAttribute('aria-disabled');
        btn.classList.remove('is-disabled');
        delete btn.dataset.prevDisabled;
      }
    });

    // 3. مدیریت فرم‌ها
    lockableForms.forEach((form) => {
      if (!form) return;
      form.classList.toggle('is-disabled', isLocked);
      form.setAttribute('aria-disabled', isLocked ? 'true' : 'false');
      form.querySelectorAll('input, select, textarea, button').forEach((ctrl) => {
        ctrl.disabled = isLocked;
        if (!isLocked) ctrl.removeAttribute('aria-disabled');
      });
    });
  };

  // === منطق هوشمند تشخیص فعال بودن ===
  const hasActivePlan = (plan) => {
    // 1. اگر آبجکت پلن معتبر از سمت سرور اومده باشه
    if (plan) {
      if (plan.hasExpired) return false;
      if (plan.activeNow || plan.isActive) return true;
    }

    // 2. [مهم] چک کردن اطلاعات فروشنده در LocalStorage
    // اگر API پلن null داد، شاید در اطلاعات فروشنده (api/sellers/me) چیزی باشه
    try {
        const seller = JSON.parse(localStorage.getItem('seller') || '{}');
        // اگر فروشنده "ویژه" باشه یا فلگ خاصی داشته باشه (اینجا فرضی چک می‌کنیم)
        // اگر ادمین هستید یا دیتای خاصی دارید، اینجا رو میشه شرط گذاشت
        if (seller && seller.hasActivePlan === true) return true; 
    } catch(e) {}

    return false; // در غیر این صورت قفل شود
  };

  return {
    refresh: (rawPlan) => {
      // تبدیل دیتای خام به فرمت استاندارد UI
      const normalizedPlan = rawPlan ? normalizePlanForUI(rawPlan) : null;
      currentPlan = normalizedPlan;
      
      // تصمیم‌گیری: قفل باشه یا باز؟
      const shouldBeLocked = !hasActivePlan(normalizedPlan);
      
      setLockedState(shouldBeLocked);
      
      // ذخیره وضعیت برای دسترسی گلوبال
      window.__COMPLIMENTARY_PLAN_NORMALIZED__ = normalizedPlan;
      
      console.log('PlanGuard Updated:', shouldBeLocked ? 'LOCKED 🔒' : 'UNLOCKED 🔓');
    },
    
    isActive: () => hasActivePlan(currentPlan)
  };
})();

function showPlanPromptModal() {
  let backdrop = document.getElementById('plan-prompt-modal');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'plan-prompt-modal';
    backdrop.className = 'plan-prompt-backdrop';
    backdrop.innerHTML = `
      <div class="plan-prompt" role="dialog" aria-modal="true" aria-labelledby="plan-prompt-title">
        <header>
          <h3 id="plan-prompt-title">برای افزودن خدمات باید پلن بخرید</h3>
          <button type="button" class="close-btn" aria-label="بستن" data-close>✕</button>
        </header>
        <p>هیچ پلنی برای فروشگاه فعال نیست. برای اضافه کردن خدمات، نمونه‌کار و استفاده از نوبت‌دهی، یکی از پلن‌های پنل فروشنده را فعال کنید.</p>
        <div class="actions">
          <button type="button" class="btn-primary" data-go-plans>مشاهده پلن‌ها</button>
          <button type="button" class="btn-secondary" data-close>بعداً</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const close = () => backdrop.setAttribute('hidden', '');
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
    backdrop.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', close));
    backdrop.querySelectorAll('[data-go-plans]').forEach((btn) => btn.addEventListener('click', () => {
      window.location.hash = '#/plans';
      close();
    }));
  }

  backdrop.removeAttribute('hidden');
}

async function loadComplimentaryPlan() {
  try {
    const response = await API.getComplimentaryPlan();
    const plan = response?.plan || null;
    renderComplimentaryPlan(plan);
    window.__COMPLIMENTARY_PLAN__ = plan;
    PlanAccessGuard.refresh(plan);

    // اگر پلن هدیه واقعاً فعال باشد، حتی در صورت شکست در دریافت فلگ‌ها
    // باید دسترسی پلن برای فروشنده آزاد شود.
    try {
      const normalizedPlan = plan ? normalizePlanForUI(plan) : null;
      const hasActivePlan = normalizedPlan && (
        normalizedPlan.activeNow
          || (normalizedPlan.isActive && !normalizedPlan.hasExpired)
          || (normalizedPlan.endDate instanceof Date && normalizedPlan.endDate > new Date())
      );

      if (hasActivePlan) {
        featureFlags = applySellerPlanFeatureFlags({
          ...featureFlags,
          sellerPlansEnabled: true
        });
        window.__FEATURE_FLAGS__ = featureFlags;
      }
    } catch (planErr) {
      console.warn('normalize complimentary plan failed', planErr);
    }
  } catch (err) {
    console.warn('loadComplimentaryPlan failed', err);
    renderComplimentaryPlan(null);
    PlanAccessGuard.refresh(null);
  }
}

const EMPTY_DASHBOARD_STATS = {
  todayBookings: 0,
  yesterdayBookings: 0,
  pendingBookings: 0,
  activeCustomers: 0,
  previousActiveCustomers: 0,
  newCustomers30d: 0,
  ratingAverage: 0,
  ratingCount: 0
};

const ACTIVE_BOOKING_STATUSES = new Set(['pending', 'confirmed', 'completed']);

const toISODateString = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

const parseBookingDate = (booking) => {
  const raw = booking?.dateISO || booking?.bookingDate || booking?.date;
  if (!raw) return null;

  const cleaned = String(raw).split('T')[0].replace(/\//g, '-').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const [year, month, day] = cleaned.split('-').map(Number);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  const parsed = Date.parse(cleaned);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
};

const computeFallbackDashboardStats = () => {
  try {
    const data = window.MOCK_DATA || {};
    const bookings = Array.isArray(data.bookings) ? data.bookings : [];
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const prevNinetyStart = new Date(ninetyDaysAgo);
    prevNinetyStart.setDate(prevNinetyStart.getDate() - 90);

    const todayISO = toISODateString(today);
    const yesterdayISO = toISODateString(yesterday);

    const activeCustomers = new Set();
    const previousActiveCustomers = new Set();
    const newCustomers30d = new Set();

    const stats = { ...EMPTY_DASHBOARD_STATS };

    bookings.forEach((booking) => {
      const status = String(booking?.status || '').toLowerCase();
      const bookingDate = parseBookingDate(booking);
      const bookingISO = toISODateString(bookingDate);
      const customerKey = booking?.customerPhone || booking?.customerId || booking?.customerName || booking?._id || booking?.id;

      if (status === 'pending') {
        stats.pendingBookings += 1;
      }

      if (!bookingDate || !customerKey) {
        return;
      }

      if (bookingISO === todayISO && ACTIVE_BOOKING_STATUSES.has(status)) {
        stats.todayBookings += 1;
      }

      if (bookingISO === yesterdayISO && ACTIVE_BOOKING_STATUSES.has(status)) {
        stats.yesterdayBookings += 1;
      }

      if (!ACTIVE_BOOKING_STATUSES.has(status)) {
        return;
      }

      if (bookingDate >= ninetyDaysAgo) {
        activeCustomers.add(customerKey);
        if (bookingDate >= thirtyDaysAgo) {
          newCustomers30d.add(customerKey);
        }
      } else if (bookingDate >= prevNinetyStart && bookingDate < ninetyDaysAgo) {
        previousActiveCustomers.add(customerKey);
      }
    });

    stats.activeCustomers = activeCustomers.size;
    stats.previousActiveCustomers = previousActiveCustomers.size;
    stats.newCustomers30d = newCustomers30d.size;

    const approvedReviews = reviews.filter((review) => {
      if (!review) return false;
      if (typeof review.approved === 'boolean') return review.approved;
      if (typeof review.status === 'string') {
        return review.status.toLowerCase() === 'approved';
      }
      return Number.isFinite(Number(review.rating ?? review.score));
    });

    if (approvedReviews.length > 0) {
      const sum = approvedReviews.reduce((acc, review) => {
        const value = Number(review.rating ?? review.score ?? 0);
        return Number.isFinite(value) ? acc + value : acc;
      }, 0);
      stats.ratingCount = approvedReviews.length;
      stats.ratingAverage = stats.ratingCount ? Math.round((sum / stats.ratingCount) * 10) / 10 : 0;
    }

    return stats;
  } catch (err) {
    console.error('computeFallbackDashboardStats failed', err);
    return { ...EMPTY_DASHBOARD_STATS };
  }
};

// === END STEP 1 ===

async function fetchInitialData() {
  try {
    console.log('Starting fetchInitialData...');
    
    console.log('Making parallel API requests...');

    const bookingsPromise = API.getBookings();

    const [sellerRes, servicesRes] = await Promise.all([
      fetch(bust(`${API_BASE}/api/sellers/me`), { credentials: 'include', ...NO_CACHE }),
      fetch(bust(`${API_BASE}/api/seller-services/me/services`), { credentials: 'include', ...NO_CACHE })
    ]);

    let bookings = [];
    let bookingsError = null;
    try {
      bookings = await bookingsPromise;
      console.log('Bookings fetched successfully:', bookings);
    } catch (err) {
      bookingsError = err;
      console.error('Bookings promise rejected:', err);
    }

    const bookingsLength = Array.isArray(bookings) ? bookings.length : 0;

    console.log('API responses received:', {
      sellerResStatus: sellerRes.status,
      servicesResStatus: servicesRes.status,
      bookingsStatus: bookingsError ? 'error' : 'ok',
      bookingsLength
    });

    if (bookingsError?.status === 401) {
      console.error('Unauthorized bookings access - redirecting to login');
      throw bookingsError;
    }

    if (sellerRes.status === 401 || servicesRes.status === 401) {
      console.log('Authentication failed - redirecting to login');
      window.location.href = 'login.html';
      return;
    }

    if (sellerRes.status === 403) {
      console.warn('Seller info request returned 403; falling back to local data.');
    }

    if (servicesRes.status === 403) {
      console.warn('Service list request returned 403; falling back to cached services.');
    }

    if (bookingsError) {
      console.error('FETCH_BOOKINGS_FAILED', bookingsError);
      bookings = [];
    }

    const localBookings = JSON.parse(localStorage.getItem('vitreenet-bookings') || '[]');
    const previousBookingKeys = collectBookingKeys(localBookings);
    console.log('Local bookings count:', localBookings.length);

    // Enhanced booking data handling with better error logging
    const serverBookings = Array.isArray(bookings) ? bookings : [];

    if (serverBookings.length) {
      console.log('Successfully fetched bookings from server:', serverBookings);
      const statusMap = new Map(localBookings.map(b => [(b._id || b.id), b.status]));
      MOCK_DATA.bookings = serverBookings.map(b => {
        const id = b._id || b.id;
        const serverStatus = b.status || 'pending';
        const localStatus = statusMap.get(id);
        const status = serverStatus === 'cancelled' ? 'cancelled' : (localStatus || serverStatus);
        const cancelledBy = b.cancelledBy || (serverStatus === 'cancelled' && localStatus !== 'cancelled' ? 'customer' : undefined);
        if (cancelledBy === 'customer') {
          UIComponents?.showToast?.(`رزرو ${b.customerName || ''} توسط مشتری لغو شد`, 'error');
        }
        return {
          ...b,
          date: b.bookingDate || b.date || '',
          dateISO: b.dateISO || b.bookingDate || b.date || '',
          status,
          cancelledBy
        };
      });
      console.log('MOCK_DATA.bookings after server data:', MOCK_DATA.bookings);
    } else if (localBookings.length) {
      console.log('Using local bookings as fallback:', localBookings);
      MOCK_DATA.bookings = localBookings.map(b => ({
        id: b.id || Date.now() + Math.random(),
        customerName: b.name || b.customerName || '',
        service: b.service || '',
        date: b.date || '',
        dateISO: b.dateISO || '',
        time: b.time || '',
        status: b.status || 'pending'
      }));
      console.log('MOCK_DATA.bookings after local data:', MOCK_DATA.bookings);
    } else {
      console.log('No bookings found from server or local storage');
      MOCK_DATA.bookings = [];
    }

    const currentBookings = Array.isArray(MOCK_DATA.bookings) ? MOCK_DATA.bookings : [];
    const candidateNewBookings = serverBookings.length
      ? currentBookings.filter((b) => {
          const key = createBookingKey(b);
          return key && !previousBookingKeys.has(key);
        })
      : [];

    persistBookings();

    BookingPopup.ensureBaseline(previousBookingKeys);
    BookingPopup.notifyNew(candidateNewBookings);
    BookingPopup.markKnown(currentBookings);
    BookingPopup.hasBaseline = true;

    if (sellerRes.ok) {
      const data = await sellerRes.json();
      const seller = data.seller || data;
        const store = {
          id: seller.id || seller._id,
          storename: seller.storename,
          shopurl: seller.shopurl,
          firstname: seller.firstname || '',
          lastname: seller.lastname || '',
          category: seller.category,
          phone: seller.phone,
          address: seller.address,
          startTime: seller.startTime || '',
          endTime: seller.endTime || '',
          createdAt: seller.createdAt || seller.created_at || seller.joinDate || seller.join_date || seller.membershipDate || null,
          rating: seller.rating || seller.avgRating || 0,
          totalBookings: seller.totalBookings || seller.bookingsTotal || 0,
          totalCustomers: seller.totalCustomers || seller.ucw30 || 0
        };
      localStorage.setItem('seller', JSON.stringify(store));
      
      // Update seller identity header
      if (typeof window.updateSellerIdentity === 'function') {
        window.updateSellerIdentity();
      }
      
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
      populateSettingsForm({ ...store, startTime: seller.startTime, endTime: seller.endTime });
    }

    if (servicesRes.ok) {
      const svcJson = await servicesRes.json();
      const svcs = svcJson.items || svcJson.services || (Array.isArray(svcJson) ? svcJson : []);

      const normalizedServices = svcs.map((svc, index) => {
        const fallbackId = `svc-${index}`;
        const normalizedId = svc?.id ?? svc?._id ?? svc?.serviceId ?? fallbackId;
        const rawPrice = typeof svc?.price === 'string'
          ? Number(svc.price.replace(/[^\d.-]/g, ''))
          : svc?.price;
        const normalizedPrice = Number.isFinite(rawPrice) ? rawPrice : 0;
        const primaryImage = svc?.image || (Array.isArray(svc?.images) ? svc.images[0] : '');

        return {
          ...svc,
          id: normalizedId,
          price: normalizedPrice,
          image: primaryImage
        };
      });

      StorageManager.set('vit_services', normalizedServices);

      const listEl = document.getElementById('services-list');
      if (listEl) {
        listEl.innerHTML = normalizedServices.map(s => `
          <div class="item-card" data-id="${s.id}">
            <div class="item-card-header">
              <h4 class="item-title">${s.title}</h4>
            </div>
            <div class="item-details"><span>قیمت: ${s.price}</span></div>
          </div>
        `).join('');
      }
    }

  } catch (err) {
    if (err && err.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    console.error('Error loading initial data', err);

    // Fallback seller info when API is unreachable
      const defaultSeller = {
        id: 1,
        storename: 'فروشگاه آزمایشی',
        shopurl: '',
        firstname: 'فروشنده',
        lastname: '',
        category: 'سرویس',
        phone: '۰۹۱۲۳۴۵۶۷۸۹',
        address: 'آدرس نامشخص',
        startTime: '09:00',
        endTime: '18:00',
        createdAt: new Date().toISOString(), // Use current date as fallback
        rating: 0,
        totalBookings: 0,
        totalCustomers: 0
      };
    const storedSeller = JSON.parse(localStorage.getItem('seller') || 'null') || defaultSeller;
    // Preserve existing createdAt if available, otherwise use default
    if (!storedSeller.createdAt && !storedSeller.created_at) {
      storedSeller.createdAt = defaultSeller.createdAt;
    }
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
    /**
   * ==============================
   * State Manager
   * ==============================
   */
  const StateManager = Object.assign(
    window.StateManager || {},
    {
      currentTheme: (window.StateManager && window.StateManager.currentTheme) || 'dark',
      currentRoute: (window.StateManager && window.StateManager.currentRoute) || '',
      isModalOpen: (window.StateManager && window.StateManager.isModalOpen) || false,
      focusedElementBeforeModal: (window.StateManager && window.StateManager.focusedElementBeforeModal) || null,
    }
  );
  window.StateManager = StateManager;
  /**
   * ==============================
   * UI Components & Helpers
   * ==============================
   */
/* === STEP — Notifications (پنل اعلان‌ها) === */
const Notifications = {
  _KEY: 'vit_notifications',
  _els: {},

  load() { return StorageManager.get(this._KEY) || []; },
  save(list) { StorageManager.set(this._KEY, list); },

  async fetchFromServer() {
    try {
      // دریافت نوتیفیکیشن‌های عادی
      const items = await API.getNotifications();
      const existing = this.load();
      
      // دریافت پیام‌های ادمین (بدون نیاز به sellerId - از توکن استفاده می‌شود)
      let adminNotifications = [];
      try {
        // استفاده از endpoint /my که نیازی به sellerId ندارد
        adminNotifications = await API.getAdminNotifications();
        // تبدیل پیام‌های ادمین به فرمت نوتیفیکیشن
        adminNotifications = adminNotifications.map(n => ({
          ...n,
          type: 'admin_message',
          isAdminMessage: true
        }));
      } catch (adminErr) {
        console.warn('Failed to load admin notifications', adminErr);
      }
      
      // ترکیب همه نوتیفیکیشن‌ها
      const allItems = [...items, ...adminNotifications];
      
      // اگر سرور نوتیفیکیشن جدید برگرداند، آن‌ها را با موجودی‌ها ادغام کن
      if (allItems && allItems.length > 0) {
        // ایجاد Map از نوتیفیکیشن‌های موجود برای دسترسی سریع
        const existingMap = new Map(existing.map(n => [n.id, n]));
        
        // ادغام نوتیفیکیشن‌های جدید با حفظ userReplies
        const merged = allItems.map((item) => {
          const prev = existingMap.get(item.id);
          // ادغام userReplies از سرور و محلی
          const serverReplies = Array.isArray(item.userReplies) ? item.userReplies : [];
          const localReplies = Array.isArray(prev?.userReplies) ? prev.userReplies : [];
          // ترکیب پاسخ‌ها (اولویت با سرور)
          const combinedReplies = serverReplies.length > 0 ? serverReplies : localReplies;
          return { ...item, userReplies: combinedReplies };
        });
        
        // اضافه کردن نوتیفیکیشن‌های محلی که در سرور نیستند (مثل live activity)
        const serverIds = new Set(allItems.map(n => n.id));
        const localOnly = existing.filter(n => !serverIds.has(n.id) && n.id?.startsWith('n'));
        
        // مرتب‌سازی بر اساس زمان (جدیدترین اول)
        const finalList = [...merged, ...localOnly].slice(0, 50);
        this.save(finalList);
      } else if (existing.length > 0) {
        // اگر سرور خالی برگرداند ولی نوتیفیکیشن‌های محلی داریم، آن‌ها را حفظ کن
        // همه نوتیفیکیشن‌های موجود را نگه دار
        // فقط اگر سرور واقعاً پاسخ داد (نه خطا)
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
      // در صورت خطا، نوتیفیکیشن‌های محلی را حفظ کن و هیچ تغییری نده
    }
  },

  async init() {
    this._els = {
      btn: document.getElementById('notification-btn'),
      panel: document.getElementById('notification-panel'),
      backdrop: document.getElementById('notification-backdrop'),
      list: document.getElementById('notification-list'),
      badge: document.getElementById('notification-badge'),
      clearAll: document.getElementById('notif-clear-all'),
      empty: document.getElementById('notif-empty'),
      markRead: document.getElementById('notif-mark-read'),
      unreadCount: document.getElementById('notif-unread-count'),
      unreadCountNumber: document.querySelector('#notif-unread-count .notif-unread-count__number'),
      closeBtn: document.getElementById('notif-close-btn')
    };
    if (!this._els.btn || !this._els.panel) return;

    // آماده‌سازی اولیه
    await this.fetchFromServer();
    this.render();

    // باز/بستن پنل
    this._els.btn.addEventListener('click', () => this.toggle());
    
    // بستن با کلیک روی backdrop
    this._els.backdrop?.addEventListener('click', () => this.close());
    
    // بستن با دکمه بستن
    this._els.closeBtn?.addEventListener('click', () => this.close());
    
    // بستن با کلیک خارج از پنل
    document.addEventListener('click', (e) => {
      const insidePanel = e.target.closest('#notification-panel');
      const onButton = e.target.closest('#notification-btn');
      const onBackdrop = e.target.closest('#notification-backdrop');
      if (!insidePanel && !onButton && !onBackdrop) this.close();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });

    // اکشن‌ها
    this._els.clearAll?.addEventListener('click', async () => {
      const items = this.load();
      await Promise.all(items.map(n => API.deleteNotification(n.id).catch(() => {})));
      this.save([]);
      this.render();
      UIComponents.showToast('همه اعلان‌ها حذف شد.', 'info');
    });

    this._els.markRead?.addEventListener('click', async () => {
      const items = this.load();
      await Promise.all(items.filter(n => !n.read).map(n => API.markNotificationRead(n.id).catch(() => {})));
      const all = items.map(n => ({ ...n, read: true }));
      this.save(all);
      this.render();
      UIComponents.showToast('همه اعلان‌ها خوانده شد.', 'success');
    });

    // دلیگیشن برای آیتم‌ها (حذف/خواندن)
    this._els.list?.addEventListener('click', async (e) => {
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      
      const isAdminMessage = li.classList.contains('is-admin-message');
      
      if (e.target.closest('.notif-delete')) {
        // حذف پیام (برای پیام‌های ادمین از API مخصوص استفاده می‌شود)
        if (isAdminMessage) {
          await this.removeAdminMessage(li.dataset.id);
        } else {
          this.remove(li.dataset.id);
        }
      } else if (e.target.closest('.notif-mark-read-single')) {
        // علامت‌گذاری پیام ادمین به عنوان خوانده شده
        e.preventDefault();
        await this.markAdminMessageRead(li.dataset.id);
      } else if (e.target.closest('.notif-view-more')) {
        const btn = e.target.closest('.notif-view-more');
        const fullText = btn?.dataset?.fulltext || '';
        this.showFullComment(fullText);
        this.markRead(li.dataset.id);
      } else if (e.target.closest('.notif-reply-btn')) {
        e.preventDefault();
        this.toggleReplyForm(li);
      } else if (e.target.closest('.notif-reply-cancel')) {
        e.preventDefault();
        this.toggleReplyForm(li);
      } else {
        // کلیک روی آیتم - علامت‌گذاری به عنوان خوانده شده
        if (isAdminMessage) {
          await this.markAdminMessageRead(li.dataset.id);
        } else {
          this.markRead(li.dataset.id);
        }
      }
    });

    this._els.list?.addEventListener('submit', async (e) => {
      const form = e.target.closest('.notif-reply-form');
      if (!form) return;
      e.preventDefault();
      const li = form.closest('li[data-id]');
      const message = form.querySelector('textarea')?.value || '';
      await this.submitReply(li?.dataset?.id, message, form);
    });

    // Character counter for reply textarea
    this._els.list?.addEventListener('input', (e) => {
      if (!e.target.matches('.notif-reply-form textarea, .ticket-reply-form textarea, .ticket-reply-form__textarea')) return;
      const textarea = e.target;
      const form = textarea.closest('.notif-reply-form, .ticket-reply-form');
      const counter = form?.querySelector('.notif-reply-char-count, .ticket-reply-form__counter');
      const currentSpan = counter?.querySelector('.notif-reply-char-current');
      if (!currentSpan) return;
      
      const len = textarea.value.length;
      currentSpan.textContent = len.toLocaleString('fa-IR');
      
      counter.classList.remove('is-warning', 'is-error');
      if (len > 1800) {
        counter.classList.add('is-error');
      } else if (len > 1500) {
        counter.classList.add('is-warning');
      }
    });
  },

  open() {
    // نمایش backdrop
    if (this._els.backdrop) {
      this._els.backdrop.hidden = false;
      requestAnimationFrame(() => {
        this._els.backdrop.classList.add('active');
      });
    }
    // نمایش پنل
    this._els.panel.hidden = false;
    requestAnimationFrame(() => {
      this._els.panel.classList.add('active');
    });
    this._els.btn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('notification-open');
  },
  close() {
    // مخفی کردن پنل
    this._els.panel.classList.remove('active');
    // مخفی کردن backdrop
    if (this._els.backdrop) {
      this._els.backdrop.classList.remove('active');
    }
    this._els.btn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('notification-open');
    
    // بعد از انیمیشن، hidden کن
    const hideAfterTransition = () => {
      this._els.panel.hidden = true;
      if (this._els.backdrop) {
        this._els.backdrop.hidden = true;
      }
    };
    
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      hideAfterTransition();
    } else {
      setTimeout(hideAfterTransition, 280);
    }
  },
  toggle(){
    this._els.panel.classList.contains('active') ? this.close() : this.open();
  },

  async remove(id) {
    try { await API.deleteNotification(id); } catch (e) {}
    const items = this.load().filter(n => n.id !== id);
    this.save(items);
    this.render();
  },

  async markRead(id) {
    try { await API.markNotificationRead(id); } catch (e) {}
    const items = this.load().map(n => n.id === id ? ({ ...n, read: true }) : n);
    this.save(items);
    this.render();
  },

  // علامت‌گذاری پیام ادمین به عنوان خوانده شده
  async markAdminMessageRead(id) {
    try {
      await API.markAdminNotificationRead(id);
      const items = this.load().map(n => n.id === id ? ({ ...n, read: true }) : n);
      this.save(items);
      this.render();
      UIComponents.showToast('پیام خوانده شد', 'success');
    } catch (e) {
      console.error('Failed to mark admin message as read:', e);
    }
  },

  // حذف پیام ادمین
  async removeAdminMessage(id) {
    try {
      await API.deleteAdminNotification(id);
      const items = this.load().filter(n => n.id !== id);
      this.save(items);
      this.render();
      UIComponents.showToast('پیام حذف شد', 'info');
    } catch (e) {
      console.error('Failed to delete admin message:', e);
      UIComponents.showToast('خطا در حذف پیام', 'error');
    }
  },

  add(payload, fallbackType = 'info') {
    const items = this.load();
    const nowLabel = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const normalized = typeof payload === 'string'
      ? { text: payload, type: fallbackType }
      : payload || {};

    items.unshift({
      id: 'n' + Date.now(),
      type: normalized.type || fallbackType,
      text: normalized.text || '—',
      title: normalized.title || '',
      time: normalized.time || nowLabel,
      read: false
    });
    this.save(items.slice(0, 30));
    this.render();
  },

  render() {
    const items = this.load();
    const unread = items.filter(n => !n.read).length;
    const LONG_BODY_LIMIT = 90;

    // FAB badge
    if (this._els.badge) {
      if (unread > 0) {
        this._els.badge.textContent = unread > 99 ? '99+' : unread.toString();
        this._els.badge.dataset.count = unread > 99 ? 'max' : unread > 9 ? 'high' : 'normal';
        this._els.badge.hidden = false;
      } else {
        this._els.badge.textContent = '';
        this._els.badge.hidden = true;
        delete this._els.badge.dataset.count;
      }
    }

    if (this._els.btn) {
      this._els.btn.classList.toggle('has-unread', unread > 0);
    }

    // Header unread count badge
    if (this._els.unreadCount && this._els.unreadCountNumber) {
      if (unread > 0) {
        const displayCount = unread > 99 ? '۹۹+' : unread.toLocaleString('fa-IR');
        this._els.unreadCountNumber.textContent = displayCount;
        this._els.unreadCount.hidden = false;
      } else {
        this._els.unreadCount.hidden = true;
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

    this._els.list.innerHTML = items.map(n => {
      const { label, body } = this._splitMessage(n.text);

      // Check if this is a ticket-related notification (must happen before preview logic)
      const notifType = (n.type || '').toLowerCase();
      const notifText = (n.text || '').toLowerCase();
      const notifTitle = (n.title || '').toLowerCase();

      // بررسی پیام ادمین
      const isAdminMessage = n.isAdminMessage === true || 
                             notifType === 'admin_message' ||
                             notifType === 'admin';

      const isTicket = !isAdminMessage && (
                       notifType === 'ticket' ||
                       notifType === 'ticket_reply' ||
                       notifType === 'support' ||
                       notifType === 'support_ticket' ||
                       notifType === 'admin_reply' ||
                       notifText.includes('تیکت') ||
                       notifText.includes('پاسخ جدید برای تیکت') ||
                       notifText.includes('پاسخ جدید') ||
                       notifTitle.includes('تیکت') ||
                       notifTitle.includes('پشتیبانی') ||
                       n.ticketId != null ||
                       n.relatedTicketId != null);

      const fullBody = body || n.text;
      const isLong = !isTicket && (fullBody || '').length > LONG_BODY_LIMIT;
      const previewText = isTicket ? fullBody : (isLong ? `${fullBody.slice(0, LONG_BODY_LIMIT)}…` : fullBody);
      const safePreview = this._escapeHtml(previewText);
      const safeFull = this._escapeHtml(fullBody);

      const titleText = n.title || (isTicket ? 'پیام پشتیبانی' : '');
      const replies = Array.isArray(n.userReplies) ? n.userReplies : [];
      
      // Build reply thread HTML
      const replyThread = replies.length ? `
        <div class="ticket-replies" aria-label="پاسخ‌های شما">
          <div class="ticket-replies__header">
            <span class="ticket-replies__title">پاسخ‌های شما</span>
            <span class="ticket-replies__count">${replies.length}</span>
          </div>
          ${replies.map((reply, idx) => `
            <div class="ticket-reply-item">
              <div class="ticket-reply-item__badge">شما</div>
              <div class="ticket-reply-item__content">
                <p class="ticket-reply-item__text">${this._escapeHtml(reply.message || reply.text || '')}</p>
                <span class="ticket-reply-item__time">${reply.time || ''}</span>
              </div>
            </div>
          `).join('')}
        </div>
      ` : '';

      // Admin message notification layout
      if (isAdminMessage) {
        const adminTypeLabel = {
          info: 'اطلاع‌رسانی',
          warning: 'هشدار',
          success: 'تبریک',
          urgent: 'فوری'
        }[n.type] || 'پیام مدیریت';
        
        const adminTypeClass = n.type || 'info';
        
        return `
        <li class="notification-item is-admin-message ${n.read ? 'is-read' : 'is-unread'}" data-id="${n.id}" role="listitem">
          <article class="admin-message-card">
            <header class="admin-message-card__header">
              <div class="admin-message-card__badge admin-message-card__badge--${adminTypeClass}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                ${adminTypeLabel}
              </div>
              <button class="admin-message-card__delete notif-delete" type="button" aria-label="حذف پیام">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </header>
            
            <div class="admin-message-card__body">
              <h4 class="admin-message-card__title">${this._escapeHtml(n.title || 'پیام از مدیریت')}</h4>
              <p class="admin-message-card__content">${this._escapeHtml(n.text || n.content || '')}</p>
            </div>
            
            <footer class="admin-message-card__footer">
              <div class="admin-message-card__meta">
                <span class="admin-message-card__source">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  مدیریت ویترینت
                </span>
                <time class="admin-message-card__time">${n.time || ''}</time>
              </div>
              ${!n.read ? `
                <button class="admin-message-card__mark-read notif-mark-read-single" type="button" data-id="${n.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  خوانده شد
                </button>
              ` : ''}
            </footer>
          </article>
        </li>
        `;
      }

      // Ticket notification layout
      if (isTicket) {
        return `
        <li class="notification-item is-ticket ${n.read ? 'is-read' : 'is-unread'}" data-id="${n.id}"${n.ticketId ? ` data-ticket-id="${n.ticketId}"` : ''} role="listitem">
          <article class="ticket-card">
            <header class="ticket-card__header">
              <div class="ticket-card__badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                پاسخ پشتیبانی
              </div>
              <button class="ticket-card__delete notif-delete" type="button" aria-label="حذف اعلان">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </header>
            
            <div class="ticket-card__body">
              <h4 class="ticket-card__title">${this._escapeHtml(titleText)}</h4>
              <p class="ticket-card__message">${safePreview}</p>
              ${isLong ? `<button class="ticket-card__more notif-view-more" data-fulltext="${safeFull}">مشاهده کامل</button>` : ''}
            </div>
            
            <footer class="ticket-card__footer">
              <div class="ticket-card__meta">
                <span class="ticket-card__source">از مدیریت سایت</span>
                <time class="ticket-card__time">${n.time || ''}</time>
              </div>
              <button class="ticket-card__reply-btn notif-reply-btn" type="button" aria-expanded="false">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h10a8 8 0 0 1 8 8v4M3 10l6 6M3 10l6-6"/></svg>
                پاسخ دادن
              </button>
            </footer>
            
            ${replyThread}
            
            <form class="ticket-reply-form notif-reply-form" hidden>
              <div class="ticket-reply-form__header">
                <span class="ticket-reply-form__title">پاسخ به پشتیبانی</span>
                <button type="button" class="ticket-reply-form__close notif-reply-cancel" aria-label="بستن">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div class="ticket-reply-form__body">
                <label class="sr-only" for="reply-${n.id}">پاسخ شما</label>
                <textarea id="reply-${n.id}" class="ticket-reply-form__textarea" rows="4" placeholder="پاسخ خود را اینجا بنویسید..." maxlength="2000" required></textarea>
                <div class="ticket-reply-form__counter">
                  <span class="notif-reply-char-current">۰</span>
                  <span>/ ۲۰۰۰ کاراکتر</span>
                </div>
              </div>
              <div class="ticket-reply-form__actions">
                <button type="button" class="ticket-reply-form__cancel notif-reply-cancel" aria-label="انصراف از پاسخ">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <span>انصراف</span>
                </button>
                <button type="submit" class="ticket-reply-form__submit notif-reply-submit">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  ارسال پاسخ
                </button>
              </div>
            </form>
          </article>
        </li>
        `;
      }

      // Regular notification layout
      return `
      <li class="notification-item ${n.read ? 'is-read' : 'is-unread'}" data-id="${n.id}" role="listitem" tabindex="0">
        <div class="notif-row">
          <div class="notif-icon ${n.type || 'info'}" aria-hidden="true"></div>
          <div class="notif-content">
            <div class="notif-text">
              ${label ? `<span class="notif-label">${label}</span>` : ''}
              ${titleText ? `<strong class="notif-title">${this._escapeHtml(titleText)}</strong>` : ''}
              <span class="notif-body">${safePreview}</span>
              ${isLong ? `<button class="notif-view-more" data-fulltext="${safeFull}" aria-label="نمایش کامل">مشاهده</button>` : ''}
            </div>
            <time class="notif-time">${n.time || ''}</time>
          </div>
          <button class="notif-delete" aria-label="حذف اعلان">×</button>
        </div>
      </li>
    `;
    }).join('');
  }
};

// Helpers for notification presentation
Notifications._splitMessage = function(text = '') {
  const normalized = text.trim();
  if (!normalized) return { label: '', body: '' };

  const LABEL_KEY = 'نظر یا کامنت';
  if (!normalized.startsWith(LABEL_KEY)) {
    return { label: '', body: normalized };
  }

  const body = normalized.slice(LABEL_KEY.length).trim();
  return {
    label: LABEL_KEY,
    body: body || normalized
  };
};

Notifications._escapeHtml = function(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

Notifications.toggleReplyForm = function(li) {
  if (!li) return;
  const form = li.querySelector('.notif-reply-form');
  const toggleBtn = li.querySelector('.notif-reply-btn');
  if (!form || !toggleBtn) return;

  // close other open forms
  this._els.list?.querySelectorAll('.notif-reply-form').forEach(f => {
    if (f !== form) {
      f.setAttribute('hidden', '');
      const parentLi = f.closest('li');
      parentLi?.querySelector('.notif-reply-btn')?.setAttribute('aria-expanded', 'false');
    }
  });

  const isHidden = form.hasAttribute('hidden');
  if (isHidden) {
    form.removeAttribute('hidden');
    toggleBtn.setAttribute('aria-expanded', 'true');
    form.querySelector('textarea')?.focus();
  } else {
    form.setAttribute('hidden', '');
    toggleBtn.setAttribute('aria-expanded', 'false');
  }
};

Notifications.submitReply = async function(id, message, form) {
  if (!id || !form) return;
  const trimmed = (message || '').trim();
  const submitBtn = form.querySelector('.notif-reply-submit');
  const cancelBtn = form.querySelector('.notif-reply-cancel');
  const textarea = form.querySelector('textarea');

  // Validation
  if (!trimmed) {
    UIComponents.showToast('متن پاسخ را وارد کنید.', 'error');
    textarea?.focus();
    return;
  }

  if (trimmed.length < 10) {
    UIComponents.showToast('پاسخ باید حداقل ۱۰ کاراکتر باشد.', 'error');
    textarea?.focus();
    return;
  }

  if (trimmed.length > 2000) {
    UIComponents.showToast('پاسخ نباید بیشتر از ۲۰۰۰ کاراکتر باشد.', 'error');
    return;
  }

  // Set loading state
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    submitBtn.setAttribute('aria-busy', 'true');
  }
  if (cancelBtn) cancelBtn.disabled = true;
  if (textarea) textarea.disabled = true;

  try {
    await API.sendNotificationReply(id, trimmed);
    await API.markNotificationRead(id);

    const nowLabel = new Date().toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const items = this.load().map((n) => {
      if (n.id !== id) return n;
      const replies = Array.isArray(n.userReplies) ? n.userReplies : [];
      return {
        ...n,
        read: true,
        userReplies: [...replies, { message: trimmed, time: nowLabel }]
      };
    });

    this.save(items);
    this.render();

    UIComponents.showToast('پاسخ شما با موفقیت ارسال شد.', 'success');
    form.reset();
    form.setAttribute('hidden', '');
    form.closest('li')?.querySelector('.notif-reply-btn')?.setAttribute('aria-expanded', 'false');

  } catch (error) {
    console.error('notif reply failed', error);
    const errorMsg = error?.message || 'ارسال پاسخ با خطا مواجه شد. لطفاً دوباره امتحان کنید.';
    UIComponents.showToast(errorMsg, 'error');

    // Reset loading state on error
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
      submitBtn.removeAttribute('aria-busy');
    }
    if (cancelBtn) cancelBtn.disabled = false;
    if (textarea) {
      textarea.disabled = false;
      textarea.focus();
    }
  }
};

Notifications.showFullComment = function(text = '') {
  if (!text) return;

  if (!this._els.fullView) {
    const overlay = document.createElement('div');
    overlay.className = 'notif-view-overlay';
    overlay.innerHTML = `
      <div class="notif-view-modal" role="dialog" aria-modal="true" aria-label="نمایش کامل نظر">
        <div class="notif-view-header">
          <span>متن کامل نظر</span>
          <button type="button" class="notif-view-close" aria-label="بستن">×</button>
        </div>
        <div class="notif-view-body"></div>
        <div class="notif-view-footer">
          <button type="button" class="notif-view-close btn-close">بستن</button>
        </div>
      </div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target.classList.contains('notif-view-overlay') || e.target.closest('.notif-view-close')) {
        overlay.classList.remove('active');
        overlay.setAttribute('hidden', '');
      }
    });
    overlay.setAttribute('hidden', '');
    this._els.panel.appendChild(overlay);
    this._els.fullView = overlay;
  }

  const bodyEl = this._els.fullView.querySelector('.notif-view-body');
  if (bodyEl) {
    bodyEl.textContent = text;
  }
  this._els.fullView.removeAttribute('hidden');
  requestAnimationFrame(() => this._els.fullView.classList.add('active'));
};

/* === Live Activity Stream (comments / likes / follows) === */
const LiveActivity = {
  container: null,
  timer: null,
  _portfolioTitles: [],

  init() {
    this.container = document.getElementById('live-alerts');
    if (!this.container) return;
    this._portfolioTitles = (StorageManager.get('vit_portfolio') || []).map(p => p.title).filter(Boolean);

    document.addEventListener('live:activity', (event) => {
      if (event.detail) this.push(event.detail);
    });
  },

  push(detail) {
    if (!detail) return;
    const normalized = this.normalize(detail);
    if (!normalized) return;
    this.renderToast(normalized);
    Notifications.add({
      text: normalized.panelText || normalized.message,
      title: normalized.title,
      type: normalized.type,
      time: normalized.timeLabel
    });
  },

  normalize(detail) {
    const type = detail.type || 'info';
    const iconMap = { comment: '💬', like: '❤', follow: '⭐' };
    const titleMap = {
      comment: 'نظر یا کامنت',
      like: 'پسند جدید',
      follow: 'دنبال‌کننده تازه'
    };

    const timeLabel = detail.timeLabel || new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    return {
      type,
      icon: detail.icon || iconMap[type] || '•',
      title: detail.title || titleMap[type] || 'اعلان جدید',
      message: detail.message || detail.text || '—',
      pill: detail.pill || null,
      accentClass: detail.accentClass || (type === 'like' ? 'live-alert__accent--like' : type === 'follow' ? 'live-alert__accent--follow' : ''),
      meta: detail.meta || 'همین حالا',
      panelText: detail.panelText,
      timeLabel
    };
  },

  createRandomEvent() {
    const names = ['نیلوفر محمدی', 'امیرحسین پارسا', 'آرزو مقدم', 'مهیار کیانی', 'سارا نوری', 'محمدرضا شکیبا'];
    const commentSnippets = [
      'از دقت و نظم کار راضی‌ام و برای همکاری بعدی مشتاقم.',
      'تحویل به‌موقع بود و ارتباط حرفه‌ای برقرار شد، سپاس.',
      'کیفیت کار مطابق انتظار و استانداردهای حرفه‌ای بود.'
    ];
    const portfolioFallbacks = ['طراحی لوگو مینیمال', 'عکاسی صنعتی', 'طراحی منو رستوران'];
    const portfolioPool = [...this._portfolioTitles, ...portfolioFallbacks];
    const portfolioTitle = portfolioPool[Math.floor(Math.random() * portfolioPool.length)] || 'نمونه‌کار شما';
    const actor = names[Math.floor(Math.random() * names.length)];
    const timeLabel = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    const variants = [
      {
        type: 'comment',
        message: `${actor} نظر جدیدی ثبت کرد: «${commentSnippets[Math.floor(Math.random() * commentSnippets.length)]}»`,
        pill: 'نظر یا کامنت',
        meta: 'تعامل حرفه‌ای',
        panelText: `${actor} یک نظر رسمی برای فروشگاه ثبت کرد`,
        accentClass: '',
        timeLabel
      },
      {
        type: 'like',
        message: `${actor} «${portfolioTitle}» را پسندید و به دیده شدن برند شما کمک کرد.`,
        pill: portfolioTitle,
        meta: 'تعامل مثبت',
        panelText: `نمونه‌کار «${portfolioTitle}» یک پسند جدید دریافت کرد`,
        accentClass: 'live-alert__accent--like',
        timeLabel
      },
      {
        type: 'follow',
        message: `${actor} فروشگاه شما را دنبال کرد.`,
        pill: 'دنبال‌کننده جدید',
        meta: 'رشد جامعه مشتریان',
        panelText: `${actor} به فهرست دنبال‌کنندگان شما اضافه شد`,
        accentClass: 'live-alert__accent--follow',
        timeLabel
      }
    ];

    return variants[Math.floor(Math.random() * variants.length)];
  },

  renderToast(event) {
    if (!this.container) return;
    const card = document.createElement('article');
    card.className = 'live-alert';
    card.innerHTML = `
      <div class="live-alert__icon live-alert__icon--${event.type}" aria-hidden="true">${event.icon}</div>
      <div class="live-alert__content">
        <div class="live-alert__title">${event.title}</div>
        <p class="live-alert__text">${event.message}</p>
        <div class="live-alert__meta">
          <span class="live-alert__accent ${event.accentClass || ''}">${event.meta}</span>
          ${event.pill ? `<span class="live-alert__pill">${event.pill}</span>` : ''}
          <span aria-hidden="true">•</span>
          <span>${event.timeLabel}</span>
        </div>
      </div>
    `;

    this.container.prepend(card);
    setTimeout(() => {
      card.classList.add('is-leaving');
      setTimeout(() => card.remove(), 220);
    }, 5400);

    if (this.container.children.length > 3) {
      const last = this.container.lastElementChild;
      if (last) last.remove();
    }
  }
};

const BookingPopup = {
  STORAGE_KEY: 'vit_seen_bookings',
  modal: null,
  elements: {},
  hasBaseline: false,

  init() {
    this.modal = document.getElementById('new-booking-modal');
    if (!this.modal) return;

    this.elements = {
      customer: this.modal.querySelector('[data-customer-name]'),
      service: this.modal.querySelector('[data-service-name]'),
      date: this.modal.querySelector('[data-booking-date]'),
      time: this.modal.querySelector('[data-booking-time]'),
      extra: this.modal.querySelector('[data-extra-count]'),
      viewBtn: this.modal.querySelector('[data-view-bookings]')
    };

    this.elements.viewBtn?.addEventListener('click', () => {
      UIComponents.closeModal('new-booking-modal');
      if (window.location.hash !== '#/bookings') {
        window.location.hash = '/bookings';
      } else {
        document.getElementById('bookings-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    if (this.getSeenKeys().size) {
      this.hasBaseline = true;
    }
  },

  getSeenKeys() {
    const stored = StorageManager.get(this.STORAGE_KEY);
    if (Array.isArray(stored)) {
      return new Set(stored);
    }
    return new Set();
  },

  setSeenKeys(keys) {
    if (!(keys instanceof Set)) return;
    StorageManager.set(this.STORAGE_KEY, Array.from(keys));
  },

  ensureBaseline(previousKeys) {
    const seen = this.getSeenKeys();
    const prev = previousKeys instanceof Set
      ? previousKeys
      : collectBookingKeys(previousKeys);

    if (prev.size) {
      const combined = new Set([...seen, ...prev]);
      this.setSeenKeys(combined);
      this.hasBaseline = true;
    } else if (seen.size) {
      this.hasBaseline = true;
    }
  },

  markKnown(bookingsOrKeys) {
    const keys = bookingsOrKeys instanceof Set
      ? bookingsOrKeys
      : collectBookingKeys(bookingsOrKeys);
    if (keys.size) {
      const seen = this.getSeenKeys();
      const combined = new Set([...seen, ...keys]);
      this.setSeenKeys(combined);
      if (combined.size) {
        this.hasBaseline = true;
      }
    }
    if (!this.hasBaseline) {
      this.hasBaseline = true;
    }
  },

  notifyNew(bookings) {
    if (!Array.isArray(bookings) || !bookings.length) return;
    const seen = this.getSeenKeys();
    if (!this.hasBaseline && !seen.size) return;

    const fresh = bookings.filter((booking) => {
      const key = createBookingKey(booking);
      return key && !seen.has(key);
    });

    if (!fresh.length) return;

    this.show(fresh[0], fresh.length - 1);
    const updated = new Set([...seen, ...fresh.map(createBookingKey).filter(Boolean)]);
    this.setSeenKeys(updated);
    this.hasBaseline = true;
  },

  show(booking, extraCount = 0) {
    if (!this.modal) return;

    const customerName = booking.customerName || booking.name || 'مشتری جدید';
    const serviceRaw = booking.service;
    const serviceName = typeof serviceRaw === 'string'
      ? serviceRaw
      : (serviceRaw?.title || serviceRaw?.name || '—');
    const rawDate = booking.date || booking.dateISO || '';
    let dateLabel = UIComponents?.formatPersianDayMonth?.(rawDate);
    if (!dateLabel && rawDate) {
      dateLabel = toFaDigits(rawDate.replace(/-/g, '/'));
    }
    const timeLabel = booking.time ? toFaDigits(booking.time) : '—';

    if (this.elements.customer) this.elements.customer.textContent = customerName;
    if (this.elements.service) this.elements.service.textContent = serviceName || '—';
    if (this.elements.date) this.elements.date.textContent = dateLabel || '—';
    if (this.elements.time) this.elements.time.textContent = timeLabel || '—';

    if (this.elements.extra) {
      if (extraCount > 0) {
        const formatted = (typeof UIComponents?.formatPersianNumber === 'function')
          ? UIComponents.formatPersianNumber(extraCount)
          : toFaDigits(extraCount);
        this.elements.extra.textContent = `+ ${formatted} نوبت جدید دیگر`;
        this.elements.extra.hidden = false;
      } else {
        this.elements.extra.hidden = true;
      }
    }

    UIComponents.openModal('new-booking-modal');
  },

  handleExternalUpdate(bookings) {
    if (!Array.isArray(bookings)) return;
    this.ensureBaseline();
    this.notifyNew(bookings);
    this.markKnown(bookings);
  }
};

// اجرا
Notifications.init();
LiveActivity.init();
BookingPopup.init();

  window.addEventListener('storage', (event) => {
    if (event.key === 'vitreenet-bookings' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        BookingPopup.handleExternalUpdate(Array.isArray(parsed) ? parsed : []);
      } catch (err) {
        console.warn('Failed to process booking storage event', err);
      }
    }
  });

  // Utility: normalize a time string to HH:MM (24h) or return null
  const normalizeTime = (t) => {
    const faDigits = '۰۱۲۳۴۵۶۷۸۹', enDigits = '0123456789';
    const toEn = (s) => (s + '').replace(/[۰-۹]/g, d => enDigits[faDigits.indexOf(d)]);
  const pad2 = (n) => String(n).padStart(2, '0');
    const m = /^(\d{1,2}):(\d{2})$/.exec(toEn((t || '').trim()));
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
    return `${pad2(h)}:${pad2(mi)}`;
  };

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
    const closeBtn = e.target.closest('.modal-close-floating');
    if (!closeBtn) return;

    const modalId = closeBtn.dataset.targetModal || closeBtn.closest('.modal')?.id;
    if (!modalId) return;

    e.preventDefault();
    e.stopPropagation();
    UIComponents.closeModal(modalId);
  }, true);
}




  class SellerPanelApp {
    constructor(flags = {}) {
      this.root = document.documentElement;
      this.body = document.body;
      this.appNav = document.querySelector('.app-nav');
      this.debouncedSearch = this.debounce(this.filterCustomers, 300);
      this.currentBookingFilter = 'all';
      this.currentServiceImage = '';
      this.currentPortfolioImage = '';
      this.dashboardStats = null;
      this._dashboardStatsPromise = null;
      this.bookingInsights = null;
      this._bookingInsightsPromise = null;
      this.bookingInsightsFetchedAt = 0;
      this.topPeersData = null;
      this._topPeersPromise = null;
      this.topPeersAutoRefreshInterval = null;
      this.topPeersAutoRefreshMs = 30 * 60 * 1000;

      this.currentCustomerFilter = 'all';
      this.currentCustomerQuery = '';

      this.discountStore = new DiscountStore();
      this.discountStore.purgeExpired();
      this.GLOBAL_CUSTOMER_ID = 'ALL_CUSTOMERS';
      this.GLOBAL_DISCOUNT_ID = 'global-discount';

      this.setFeatureFlags(flags);

      // Initialize Services, Portfolio, VIP & customer features
      this.initServices();
      this.initPortfolio();
      this.initVipSettings();
      this.initCustomerFeatures();
      this.initDiscountFeature();

    }

    setFeatureFlags(flags = {}) {
      this.featureFlags = normalizeFeatureFlags(flags);
    }

    isSellerPlansEnabled() {
      return !!(this.featureFlags && this.featureFlags.sellerPlansEnabled);
    }

    formatNumber(value, { fractionDigits = 0, fallback = '۰' } = {}) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return fallback;
      }
      const formatted = fractionDigits > 0
        ? numeric.toFixed(fractionDigits)
        : Math.round(numeric).toString();
      if (typeof UIComponents?.formatPersianNumber === 'function') {
        return UIComponents.formatPersianNumber(formatted);
      }
      return formatted;
    }

    setText(id, value) {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value;
      }
    }

    formatDateTime(value) {
      if (!value) return '';
      try {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat('fa-IR', {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(date);
      } catch (err) {
        console.warn('formatDateTime failed', err);
        return '';
      }
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
      bookingHistoryBtn: document.getElementById('booking-history-btn'),
      bookingHistoryRefresh: document.getElementById('booking-history-refresh'),

      plansView: document.getElementById('plans-view'),
      customerSearch: document.getElementById('customer-search'),
      customerFilters: document.querySelector('.customer-filters'),
      bookingsFilter: document.querySelector('#bookings-view .filter-chips'),
      reviewsFilter: document.querySelector('#reviews-view .filter-chips'),
      settingsForm: document.getElementById('settings-form'),
      rankCard: document.getElementById('rank-card'),
      rankCtaBtn: document.getElementById('rank-cta-btn'),
      topViewAllBtn: document.getElementById('top-view-all'),
      topLeaderboardList: document.getElementById('top-leaderboard-list'),
      addCustomerBtn: document.getElementById('add-customer-btn'),
      addServiceBtn: document.getElementById('add-service-btn'),
      addPortfolioBtn: document.getElementById('add-portfolio-btn'),
    serviceForm: document.getElementById('service-form'),
    portfolioForm: document.getElementById('portfolio-form'),
    serviceImageBtn: document.getElementById('service-image-btn'),
    serviceImageInput: document.getElementById('service-image'),
    portfolioImageBtn: document.getElementById('portfolio-image-btn'),
    portfolioImageInput: document.getElementById('portfolio-image'),
    portfolioImagePreview: document.getElementById('portfolio-image-preview'),
    vipSettingsBtn: document.getElementById('vip-settings-btn'),
    vipForm: document.getElementById('vip-form'),
    vipToggleBtn: document.getElementById('vip-toggle-btn'),
    vipToggleConfirm: document.getElementById('vip-toggle-confirm'),
    vipToggleMessage: document.getElementById('vip-toggle-message')
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

  // Find the parent modal or drawer first
  let container = dismissTarget.closest('.modal, .drawer');

  // If the button sits outside the modal card (floating buttons), fall back to the currently open overlay
  if (!container) {
    if (dismissTarget.dataset.dismiss === 'modal') {
      container = document.querySelector('.modal.is-open');
    } else if (dismissTarget.dataset.dismiss === 'drawer') {
      container = document.querySelector('.drawer.is-open');
    }
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



}, { passive: false });





  // 4. View Store button
// 4. View Store button
// 4. View Store button
if (elements.viewStoreBtn) {
  elements.viewStoreBtn.addEventListener('click', () => {
    if (!PlanAccessGuard.isActive()) {
      showPlanPromptModal();
      return;
    }
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

  if (elements.customerFilters) {
    elements.customerFilters.addEventListener('click', (e) => this.handleCustomerFilterChange(e));
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

  // Service image preview handler
  if (elements.serviceImageInput) {
    elements.serviceImageInput.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      const previewEl = document.getElementById('service-image-preview');
      
      if (file && previewEl) {
        try {
          const dataUrl = await this.fileToDataURL(file);
          this.currentServiceImage = dataUrl;
          
          // Update preview
          previewEl.classList.remove('is-empty');
          previewEl.innerHTML = `
            <img src="${dataUrl}" alt="پیش‌نمایش تصویر خدمت" />
            <div class="image-preview__actions">
              <button type="button" class="image-preview__action-btn image-preview__action-btn--delete" id="service-image-remove" aria-label="حذف تصویر">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            </div>
            <div class="image-preview__info">
              <span class="image-preview__info-text">${file.name}</span>
              <span class="image-preview__info-size">${this.formatFileSize(file.size)}</span>
            </div>
          `;
          
          // Add remove button handler
          const removeBtn = document.getElementById('service-image-remove');
          if (removeBtn) {
            removeBtn.addEventListener('click', () => {
              this.currentServiceImage = '';
              elements.serviceImageInput.value = '';
              previewEl.classList.add('is-empty');
              previewEl.innerHTML = `
                <div class="image-preview__placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span>پس از انتخاب، پیش‌نمایش تصویر اینجا نمایش داده می‌شود</span>
                </div>
              `;
            });
          }
        } catch (err) {
          console.error('service image preview failed', err);
          this.currentServiceImage = '';
        }
      } else if (previewEl) {
        this.currentServiceImage = '';
        previewEl.classList.add('is-empty');
        previewEl.innerHTML = `
          <div class="image-preview__placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>پس از انتخاب، پیش‌نمایش تصویر اینجا نمایش داده می‌شود</span>
          </div>
        `;
      }
    });
  }

  if (elements.portfolioImageBtn && elements.portfolioImageInput) {
    elements.portfolioImageBtn.addEventListener('click', () => elements.portfolioImageInput.click());
  }

  if (elements.portfolioImageInput) {
    elements.portfolioImageInput.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        try {
          const dataUrl = await this.fileToDataURL(file);
          this.currentPortfolioImage = dataUrl;
          this.updatePortfolioPreview(dataUrl);
        } catch (err) {
          console.error('portfolio image preview failed', err);
          this.currentPortfolioImage = '';
          this.updatePortfolioPreview('');
        }
      } else {
        this.currentPortfolioImage = '';
        this.updatePortfolioPreview('');
      }
    });
  }

  if (elements.vipForm) {
    elements.vipForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.boundHandleVipFormSubmit();
    });
  }

  // 7. Button click handlers with null checks
  const rankHelpBtn = document.getElementById('rank-help-btn');
  const buttonHandlers = [
    {
      element: elements.rankCard,
      handler: () => UIComponents.openModal('rank-modal')
    },
    {
      element: rankHelpBtn,
      handler: (e) => {
        e.stopPropagation(); // Prevent rank-card click
        UIComponents.openModal('rank-modal');
      }
    },
    {
      element: elements.bookingHistoryBtn,
      handler: () => this.openBookingHistoryModal()
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
    },
    {
      element: elements.vipToggleBtn,
      handler: () => {
        const disabled = localStorage.getItem('vit_vip_rewards_disabled') === '1';
        if (elements.vipToggleMessage && elements.vipToggleConfirm) {
          elements.vipToggleMessage.textContent = disabled ? 'آیا می‌خواهید بخش جایزه دادن را فعال کنید؟' : 'آیا از غیر فعال کردن بخش جایزه دادن مطمئن هستید؟';
          elements.vipToggleConfirm.textContent = disabled ? 'فعال کردن' : 'غیرفعال کردن';
          elements.vipToggleConfirm.classList.toggle('btn-danger', !disabled);
          elements.vipToggleConfirm.classList.toggle('btn-success', disabled);
        }
        UIComponents.openModal('vip-toggle-modal');
      }
    }
  ];

  buttonHandlers.forEach(({ element, handler }) => {
    if (element) {
      element.addEventListener('click', handler);
    }
  });

  if (elements.rankCtaBtn) {
    elements.rankCtaBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.hash = '/top';
    });
  }

  if (elements.bookingHistoryRefresh) {
    elements.bookingHistoryRefresh.addEventListener('click', () => {
      this.renderBookingHistory(true).catch((err) => {
        console.error('bookingHistoryRefresh error', err);
      });
    });
  }

  if (elements.topLeaderboardList) {
    elements.topLeaderboardList.addEventListener('click', (e) => {
      if (e.target.closest('button, a')) {
        return;
      }
      const item = e.target.closest('li[data-shop-url]');
      if (!item) return;
      const slug = item.dataset.shopUrl;
      if (!slug) return;
      window.open(`/service-shops.html?shopurl=${encodeURIComponent(slug)}`, '_blank', 'noopener,noreferrer');
    });
  }

  // Event listeners برای فیلترهای لیدربورد
  const leaderboardFilterBtns = document.querySelectorAll('[data-leaderboard-limit]');
  leaderboardFilterBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const limit = parseInt(btn.dataset.leaderboardLimit) || 10;
      
      // آپدیت کلاس active
      leaderboardFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // بارگذاری مجدد با limit جدید
      try {
        await app.loadTopPeers(true, limit);
        app.applyTopPeers(app.topPeersData);
      } catch (err) {
        console.error('Failed to reload leaderboard with new limit:', err);
      }
    });
  });

  // Event listener برای دکمه نمایش اطلاعات امتیازدهی
  const leaderboardInfoBtn = document.getElementById('leaderboard-info-btn');
  const scoreInfoCard = document.getElementById('score-info-card');
  const scoreInfoClose = document.getElementById('score-info-close');

  if (leaderboardInfoBtn && scoreInfoCard) {
    leaderboardInfoBtn.addEventListener('click', () => {
      const isHidden = scoreInfoCard.hidden;
      scoreInfoCard.hidden = !isHidden;
      leaderboardInfoBtn.setAttribute('aria-expanded', String(!isHidden));
    });
  }

  if (scoreInfoClose && scoreInfoCard) {
    scoreInfoClose.addEventListener('click', () => {
      scoreInfoCard.hidden = true;
      leaderboardInfoBtn?.setAttribute('aria-expanded', 'false');
    });
  }

  // Event listener برای دکمه بروزرسانی لیدربورد
  const leaderboardRefreshBtn = document.getElementById('leaderboard-refresh-btn');
  if (leaderboardRefreshBtn) {
    leaderboardRefreshBtn.addEventListener('click', async () => {
      leaderboardRefreshBtn.classList.add('is-loading');
      leaderboardRefreshBtn.disabled = true;
      
      try {
        const activeFilter = document.querySelector('[data-leaderboard-limit].active');
        const limit = parseInt(activeFilter?.dataset.leaderboardLimit) || 10;
        await app.loadTopPeers(true, limit);
        app.applyTopPeers(app.topPeersData);
        UIComponents?.showToast?.('رتبه‌بندی بروزرسانی شد', 'success');
      } catch (err) {
        console.error('Failed to refresh leaderboard:', err);
        UIComponents?.showToast?.('خطا در بروزرسانی', 'error');
      } finally {
        leaderboardRefreshBtn.classList.remove('is-loading');
        leaderboardRefreshBtn.disabled = false;
      }
    });
  }

  function updateVipToggleBtn() {
    if (!elements.vipToggleBtn) return;
    const disabled = localStorage.getItem('vit_vip_rewards_disabled') === '1';
    elements.vipToggleBtn.textContent = disabled ? 'فعال‌سازی جایزه' : 'غیرفعال کردن جایزه';
    elements.vipToggleBtn.classList.toggle('btn-danger', !disabled);
    elements.vipToggleBtn.classList.toggle('btn-success', disabled);
  }

  updateVipToggleBtn();

  if (elements.vipToggleConfirm) {
    elements.vipToggleConfirm.addEventListener('click', () => {
      const disabled = localStorage.getItem('vit_vip_rewards_disabled') === '1';
      if (disabled) {
        localStorage.removeItem('vit_vip_rewards_disabled');
        UIComponents.showToast('باشگاه مشتریان ویژه فعال شد.', 'success');
      } else {
        localStorage.setItem('vit_vip_rewards_disabled', '1');
        UIComponents.showToast('باشگاه مشتریان ویژه غیرفعال شد.', 'info');
      }
      updateVipToggleBtn();
      UIComponents.closeModal('vip-toggle-modal');
    });
  }

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

  // 9. Cleanup method for memory management (optional)
  this.cleanup = () => {
    window.removeEventListener('hashchange', this.boundHandleRouteChange);
    this.clearTopPeersAutoRefresh();
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
      this.clearTopPeersAutoRefresh();
      if (page === 'plans' && !this.isSellerPlansEnabled()) {
        if (window.location.hash !== '#/dashboard') {
          window.location.hash = '#/dashboard';
        }
        UIComponents?.showToast?.('بخش پلن‌ها به‌زودی فعال می‌شود.', 'info');
        return;
      }
      document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.removeAttribute('aria-current'));
      const activeSection = document.getElementById(`${page}-view`);
      const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
      const appHeader = document.querySelector('.app-header');
      if (activeSection) {
        activeSection.classList.add('active');
        document.title = `پنل فروشنده - ${activeNav?.textContent.trim() || 'داشبورد'}`;
        this.renderPageContent(page);
      } else {
        const dashboardView = document.getElementById('dashboard-view');
        if (dashboardView) {
          dashboardView.classList.add('active');
        }
      }
      if (activeNav) {
        activeNav.classList.add('active');
        activeNav.setAttribute('aria-current', 'page');
      }
      if (appHeader) {
        appHeader.classList.remove('is-hidden');
        appHeader.removeAttribute('aria-hidden');
      }
    }
    renderPageContent(page) {
      switch(page) {
        case 'dashboard': this.renderDashboard(); break;
        case 'bookings': this.renderBookings(); break;
        case 'customers': this.renderCustomers(); break;
        case 'discounts': this.renderDiscounts(); break;
        case 'reviews': this.renderReviews(); break;
        case 'top':
          this.renderTopPeers();
          this.scheduleTopPeersAutoRefresh(true);
          break;
        case 'plans':
          if (this.isSellerPlansEnabled()) {
            this.renderPlans();
          }
          break;
        case 'settings': this.renderSettings(); break; // New call for settings
      }
    }
    clearTopPeersAutoRefresh() {
      if (this.topPeersAutoRefreshInterval) {
        clearInterval(this.topPeersAutoRefreshInterval);
        this.topPeersAutoRefreshInterval = null;
      }
    }

    scheduleTopPeersAutoRefresh(reset = false) {
      if (reset) {
        this.clearTopPeersAutoRefresh();
      } else if (this.topPeersAutoRefreshInterval) {
        return;
      }

      const topView = document.getElementById('top-view');
      if (!topView || !topView.classList.contains('active')) {
        return;
      }

      const intervalMs = Math.max(15000, Number(this.topPeersAutoRefreshMs) || (30 * 60 * 1000));
      this.topPeersAutoRefreshInterval = window.setInterval(() => {
        const topView = document.getElementById('top-view');
        if (!topView || !topView.classList.contains('active')) {
          this.clearTopPeersAutoRefresh();
          return;
        }
        this.refreshTopPeersSilently();
      }, intervalMs);
    }

    restartTopPeersAutoRefresh() {
      this.scheduleTopPeersAutoRefresh(true);
    }

    async refreshTopPeersSilently() {
      if (this._topPeersPromise) {
        return;
      }
      try {
        const data = await this.loadTopPeers(true);
        this.applyTopPeers(data);
      } catch (err) {
        console.warn('Auto refresh top peers failed', err);
      }
    }

    async loadTopPeers(force = false, limit = 10) {
      if (this._topPeersPromise && !force) {
        return this._topPeersPromise;
      }

      if (force) {
        this.topPeersData = null;
      }

      this._topPeersPromise = (async () => {
        try {
          // استفاده از API لیدربورد برای دریافت همه فروشندگان هم‌دسته و هم‌زیرگروه
          const leaderboardData = await API.getRankLeaderboard(limit);
          
          // ذخیره داده‌های لیدربورد
          this.topPeersData = {
            top: leaderboardData.top || [],
            mine: leaderboardData.mine || null,
            total: leaderboardData.total || 0,
            category: leaderboardData.category || 'خدمات',
            subcategory: leaderboardData.subcategory || '',
            scope: leaderboardData.scope || 'category',
            scoreExplanation: leaderboardData.scoreExplanation || null,
            updatedAt: leaderboardData.updatedAt || new Date().toISOString()
          };
          
          this.applyRankCard(this.topPeersData);
          this.applyTopSummary(this.topPeersData);
          return this.topPeersData;
        } catch (err) {
          console.error('loadTopPeers failed', err);
          if (force) {
            UIComponents?.showToast?.('خطا در بروزرسانی رتبه‌بندی', 'error');
          }
          throw err;
        } finally {
          this._topPeersPromise = null;
        }
      })();

      return this._topPeersPromise;
    }

    applyRankCard(data = this.topPeersData || {}) {
      const mine = data?.mine || {};
      const metrics = mine.metrics || {};
      const total = Number(data?.total) || 0;
      const categoryLabel = data?.category || 'حوزه شما';

      this.setText('rank-category', categoryLabel);
      this.setText('total-sellers', this.formatNumber(total));
      this.setText('current-rank', mine.rank ? this.formatNumber(mine.rank) : '—');
      
      // آپدیت معیارهای واقعی از بک‌اند
      this.setText('ucw30', this.formatNumber(metrics.uniqueCustomers || 0));
      this.setText('bookingsTotal', this.formatNumber(metrics.totalBookings || 0));
      this.setText('rating30', this.formatNumber(metrics.ratingAverage || 0, { fractionDigits: 1, fallback: '۰٫۰' }));
      
      // آپدیت اعتبار از معیارهای واقعی
      const walletRankEl = document.getElementById('walletRank');
      if (walletRankEl) {
        const walletBalance = metrics.walletBalance || 0;
        if (walletBalance >= 1000000) {
          walletRankEl.textContent = this.formatNumber(Math.round(walletBalance / 100000) / 10) + 'M';
        } else if (walletBalance >= 1000) {
          walletRankEl.textContent = this.formatNumber(Math.round(walletBalance / 100) / 10) + 'K';
        } else {
          walletRankEl.textContent = this.formatNumber(walletBalance);
        }
      }

      const modalCurrent = document.getElementById('rank-modal-current');
      if (modalCurrent) {
        if (mine.rank) {
          modalCurrent.textContent = `رتبه فعلی شما: ${this.formatNumber(mine.rank)} از ${this.formatNumber(total)} فروشگاه فعال در ${categoryLabel}.`;
        } else {
          modalCurrent.textContent = 'هنوز رتبه‌ای برای فروشگاه شما ثبت نشده است. با افزایش فعالیت می‌توانید وارد فهرست برترین‌ها شوید.';
        }
      }
    }

    calculateAggregateScore(metrics = {}) {
      const rating = Number(metrics.ratingAverage ?? 0) || 0;
      const bookings = Number(metrics.totalBookings ?? 0) || 0;
      const customers = Number(metrics.uniqueCustomers ?? metrics.completedBookings ?? 0) || 0;
      return rating + bookings + customers;
    }

    applyTopSummary(data = this.topPeersData || {}) {
      const mine = data?.mine || {};
      const metrics = mine.metrics || {};
      const total = Number(data?.total) || 0;

      this.setText('top-my-rank', mine.rank ? this.formatNumber(mine.rank) : '—');
      this.setText('top-total-peers', this.formatNumber(total));

      // استفاده از امتیاز کل محاسبه‌شده از بک‌اند
      const totalScore = mine.score || 0;
      const scoreText = this.formatNumber(totalScore, { fractionDigits: 1, fallback: '۰٫۰' });
      this.setText('top-my-score', scoreText);
      this.setText('top-my-rating', this.formatNumber(metrics.ratingAverage || 0, { fractionDigits: 1, fallback: '۰٫۰' }));
      this.setText('top-my-bookings', this.formatNumber(metrics.totalBookings || 0));
      this.setText('top-my-customers', this.formatNumber(metrics.uniqueCustomers || 0));
      
      // نمایش اعتبار فروشگاه
      const walletBalance = metrics.walletBalance || 0;
      const walletFormatted = formatTomans(walletBalance);
      this.setText('top-my-wallet', walletFormatted);

      const badgesEl = document.getElementById('top-my-badges');
      if (badgesEl) {
        const badges = [];
        if (mine.badges?.isPremium) {
          badges.push('<span class="badge-pill badge-premium" title="اعتبار بالای ۱ میلیون تومان">💎 پریمیوم</span>');
        }
        if (mine.badges?.isFeatured) {
          badges.push('<span class="badge-pill badge-featured" title="امتیاز بالای ۴.۵ با بیش از ۱۰ نظر">⭐ ویژه</span>');
        }
        if (mine.badges?.isTopRated) {
          badges.push('<span class="badge-pill badge-top-rated" title="امتیاز بالای ۴.۸">🏆 برتر</span>');
        }
        if (mine.badges?.isActive) {
          badges.push('<span class="badge-pill badge-active" title="استریک بیش از ۷ روز">🔥 فعال</span>');
        }
        badgesEl.innerHTML = badges.length ? badges.join('') : '<span class="badge-pill badge-none">بدون نشان ویژه</span>';
      }

      const updatedAtEl = document.getElementById('top-updated-at');
      if (updatedAtEl) {
        const formatted = this.formatDateTime(data?.updatedAt);
        updatedAtEl.textContent = formatted ? `آخرین بروزرسانی: ${formatted}` : '';
      }

      const subtitle = document.getElementById('top-subtitle');
      if (subtitle) {
        const categoryLabel = data?.subcategory || data?.category || '';
        const scopeLabel = data?.scope === 'subcategory' ? 'زیرگروه' : 'دسته';
        const groupLabel = categoryLabel ? `${scopeLabel} «${categoryLabel}»` : 'همه حوزه‌ها';
        subtitle.textContent = `رتبه‌بندی برترین فروشگاه‌های ${groupLabel}`;
      }

    }

    buildLeaderboardItem(entry, mine = {}) {
      const metrics = entry.metrics || {};
      const isMine = entry.isMine || (mine?.shopUrl && entry.shopUrl && mine.shopUrl === entry.shopUrl);
      const rank = this.formatNumber(entry.rank);
      // استفاده از امتیاز محاسبه‌شده از سرور
      const score = this.formatNumber(entry.score ?? 0, { fractionDigits: 1, fallback: '۰٫۰' });
      const rating = this.formatNumber(metrics.ratingAverage ?? 0, { fractionDigits: 1, fallback: '۰٫۰' });
      const ratingCount = this.formatNumber(metrics.ratingCount ?? 0);
      const bookings = this.formatNumber(metrics.totalBookings ?? 0);
      const customers = this.formatNumber(metrics.uniqueCustomers ?? 0);
      const walletBalance = metrics.walletBalance ?? 0;
      const walletFormatted = this.formatWalletShort(walletBalance);

      const badges = [];
      if (entry.badges?.isPremium) {
        badges.push('<span class="badge-pill badge-premium" title="اعتبار بالای ۱ میلیون تومان">💎 پریمیوم</span>');
      }
      if (entry.badges?.isFeatured) {
        badges.push('<span class="badge-pill badge-featured" title="امتیاز بالای ۴.۵ با بیش از ۱۰ نظر">⭐ ویژه</span>');
      }
      if (entry.badges?.isTopRated) {
        badges.push('<span class="badge-pill badge-top-rated" title="امتیاز بالای ۴.۸">🏆 برتر</span>');
      }
      if (entry.badges?.isActive) {
        badges.push('<span class="badge-pill badge-active" title="استریک بیش از ۷ روز">🔥 فعال</span>');
      }

      const nameMarkup = entry.shopUrl
        ? `<a href="/service-shops.html?shopurl=${encodeURIComponent(entry.shopUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.name)}</a>`
        : escapeHtml(entry.name);

      const metaParts = [];
      if (entry.city) {
        metaParts.push(`<span class="meta-city">📍 ${escapeHtml(entry.city)}</span>`);
      }
      metaParts.push(`<span class="meta-rating">⭐ ${rating} (${ratingCount})</span>`);
      metaParts.push(`<span class="meta-bookings">📆 ${bookings} نوبت</span>`);
      metaParts.push(`<span class="meta-customers">👥 ${customers} مشتری</span>`);
      metaParts.push(`<span class="meta-wallet">💰 ${walletFormatted}</span>`);

      const dataAttr = entry.shopUrl ? ` data-shop-url="${escapeHtml(entry.shopUrl)}"` : '';
      const rankClass = entry.rank <= 3 ? ` rank-${entry.rank}` : '';

      return `
        <li class="leaderboard-item${isMine ? ' is-mine' : ''}${rankClass}" data-rank="${entry.rank || ''}"${dataAttr}>
          <div class="leaderboard-rank">
            ${entry.rank <= 3 ? this.getRankMedal(entry.rank) : rank}
          </div>
          <div class="leaderboard-main">
            <div class="leaderboard-title">
              ${nameMarkup}
              ${badges.length ? `<div class="leaderboard-badges">${badges.join('')}</div>` : ''}
            </div>
            <div class="leaderboard-meta">${metaParts.join('')}</div>
          </div>
          <div class="leaderboard-score">
            <span class="score-value">${score}</span>
            <span class="score-label">امتیاز کل</span>
          </div>
        </li>
      `;
    }

    formatWalletShort(amount) {
      if (amount >= 1000000000) {
        return this.formatNumber(Math.round(amount / 100000000) / 10) + 'B';
      } else if (amount >= 1000000) {
        return this.formatNumber(Math.round(amount / 100000) / 10) + 'M';
      } else if (amount >= 1000) {
        return this.formatNumber(Math.round(amount / 100) / 10) + 'K';
      }
      return this.formatNumber(amount);
    }

    getRankMedal(rank) {
      const medals = {
        1: '<span class="rank-medal rank-gold" title="رتبه اول">🥇</span>',
        2: '<span class="rank-medal rank-silver" title="رتبه دوم">🥈</span>',
        3: '<span class="rank-medal rank-bronze" title="رتبه سوم">🥉</span>'
      };
      return medals[rank] || this.formatNumber(rank);
    }

    applyTopPeers(data = this.topPeersData || {}) {
      const list = document.getElementById('top-leaderboard-list');
      const loadingEl = document.getElementById('top-leaderboard-loading');
      const errorEl = document.getElementById('top-error');
      const emptyEl = document.getElementById('top-leaderboard-empty');
      if (!list) return;

      if (loadingEl) loadingEl.hidden = true;
      if (errorEl) errorEl.hidden = true;

      const top = Array.isArray(data?.top) ? data.top : [];
      if (!top.length) {
        list.innerHTML = '';
        if (emptyEl) emptyEl.hidden = false;
      } else {
        if (emptyEl) emptyEl.hidden = true;
        list.innerHTML = top.map(entry => this.buildLeaderboardItem(entry, data?.mine)).join('');
      }

      this.applyRankCard(data);
      this.applyTopSummary(data);
    }

    async renderTopPeers(force = false) {
      const list = document.getElementById('top-leaderboard-list');
      const loadingEl = document.getElementById('top-leaderboard-loading');
      const errorEl = document.getElementById('top-error');
      const emptyEl = document.getElementById('top-leaderboard-empty');
      if (!list) return;

      if (!force && this.topPeersData) {
        this.applyTopPeers(this.topPeersData);
        return;
      }

      if (loadingEl) loadingEl.hidden = false;
      if (errorEl) errorEl.hidden = true;
      if (emptyEl) emptyEl.hidden = true;
      list.innerHTML = '';
      list.setAttribute('aria-busy', 'true');

      try {
        const data = await this.loadTopPeers(force);
        this.applyTopPeers(data);
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = 'خطا در دریافت اطلاعات رتبه‌بندی. لطفاً دوباره تلاش کنید.';
          errorEl.hidden = false;
        }
      } finally {
        if (loadingEl) loadingEl.hidden = true;
        list.removeAttribute('aria-busy');
      }
    }

    // --- Page Rendering ---
    renderWelcomeDate() {
      const el = document.getElementById('welcome-date');
      if (el) {
        const dateTarget = el.querySelector('.dashboard-hero__date-text') || el;
        dateTarget.textContent = UIComponents.formatPersianNumber(new Date().toLocaleDateString('fa-IR'));
      }
    }
    async loadDashboardStats(force = false) {
      if (this._dashboardStatsPromise && !force) {
        return this._dashboardStatsPromise;
      }

      this._dashboardStatsPromise = (async () => {
        try {
          const stats = await API.getDashboardStats();
          this.dashboardStats = stats || {};
          this.applyDashboardStats(this.dashboardStats);
          return this.dashboardStats;
        } catch (err) {
          console.error('loadDashboardStats failed', err);
          if (this.dashboardStats) {
            this.applyDashboardStats(this.dashboardStats);
          } else {
            this.applyDashboardStats({});
          }
          if (force) {
            UIComponents?.showToast?.('خطا در بروزرسانی آمار داشبورد', 'error');
          }
          throw err;
        } finally {
          this._dashboardStatsPromise = null;
        }
      })();

      return this._dashboardStatsPromise;
    }

    shouldRefreshBookingInsights(maxAgeMs = 5 * 60 * 1000) {
      if (!this.bookingInsights || !this.bookingInsightsFetchedAt) {
        return true;
      }
      return (Date.now() - this.bookingInsightsFetchedAt) > maxAgeMs;
    }

    async loadBookingInsights(force = false) {
      if (this._bookingInsightsPromise && !force) {
        return this._bookingInsightsPromise;
      }

      if (!force && !this.shouldRefreshBookingInsights()) {
        return this.bookingInsights;
      }

      this._bookingInsightsPromise = (async () => {
        try {
          const data = await API.getMonthlyBookingInsights();
          this.bookingInsights = data || {};
          this.bookingInsightsFetchedAt = Date.now();
          return this.bookingInsights;
        } finally {
          this._bookingInsightsPromise = null;
        }
      })();

      return this._bookingInsightsPromise;
    }

    async renderBookingHistory(force = false) {
      const content = document.getElementById('booking-history-content');
      const loadingEl = document.getElementById('booking-history-loading');
      const errorEl = document.getElementById('booking-history-error');
      const refreshBtn = document.getElementById('booking-history-refresh');

      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = '';
      }

      const hasCachedData = !!this.bookingInsights;
      const willFetchFresh = force || this.shouldRefreshBookingInsights();
      if (content && hasCachedData && !force) {
        this.applyBookingInsights(this.bookingInsights);
        content.hidden = false;
      }

      if (loadingEl) {
        loadingEl.hidden = hasCachedData && !willFetchFresh;
      }
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.setAttribute('aria-busy', 'true');
      }

      try {
        const data = await this.loadBookingInsights(force);
        if (data) {
          this.applyBookingInsights(data);
          if (content) {
            content.hidden = false;
          }
        }
      } catch (err) {
        console.error('renderBookingHistory failed', err);
        if (this.bookingInsights && content) {
          this.applyBookingInsights(this.bookingInsights);
          content.hidden = false;
        }
        if (errorEl) {
          const message = err?.status === 401
            ? 'برای مشاهده آمار رزرو لازم است دوباره وارد شوید.'
            : 'خطا در دریافت آمار ماهانه رزرو. لطفاً دوباره تلاش کنید.';
          errorEl.textContent = message;
          errorEl.hidden = false;
        }
      } finally {
        if (loadingEl) {
          loadingEl.hidden = true;
        }
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.removeAttribute('aria-busy');
        }
      }
    }

    applyBookingInsights(data = {}) {
      const totals = data?.totals || {};
      const averages = data?.averages || {};
      const trend = data?.trend || {};
      const todayTrend = trend?.today || {};
      const weekTrend = trend?.weekOverWeek || {};
      const bestDay = data?.bestDay || null;
      const range = data?.range || {};
      const daily = Array.isArray(data?.daily) ? data.daily : [];
      const services = Array.isArray(data?.serviceLeaders) ? data.serviceLeaders : [];

      const formatNumber = (value, fractionDigits = 0, fallback = '۰') => {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        const fixed = Number(num.toFixed(fractionDigits));
        return UIComponents.formatPersianNumber(fixed);
      };

      const formatPercent = (ratio) => {
        const num = Number(ratio);
        if (!Number.isFinite(num)) return '—';
        const percent = num * 100;
        const digits = Math.abs(percent) < 10 ? 1 : 0;
        return `${formatNumber(percent, digits, '—')}٪`;
      };

      const formatAbsolutePercent = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return '—';
        const digits = Math.abs(num) < 10 ? 1 : 0;
        return `${formatNumber(Math.abs(num), digits, '—')}٪`;
      };

      const formatDelta = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num) || num === 0) return 'بدون تغییر';
        const sign = num > 0 ? '+' : '−';
        return `${sign}${formatNumber(Math.abs(num), 0, '۰')}`;
      };

      const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = value;
        }
      };

      const rangeEl = document.getElementById('bh-range');
      if (rangeEl) {
        const startLabel = UIComponents?.formatPersianDayMonth?.(range.start) || '';
        const endLabel = UIComponents?.formatPersianDayMonth?.(range.end) || '';
        rangeEl.textContent = startLabel && endLabel
          ? `${startLabel} تا ${endLabel}`
          : '۳۰ روز اخیر';
      }

      const updatedEl = document.getElementById('bh-last-updated');
      if (updatedEl) {
        const label = data?.lastUpdated
          ? UIComponents?.formatRelativeDate?.(data.lastUpdated)
          : '';
        updatedEl.textContent = label ? `آخرین بروزرسانی: ${label}` : '—';
      }

      setText('bh-total', formatNumber(totals.total || 0));
      setText('bh-completed', formatNumber(totals.completed || 0));
      setText('bh-confirmed', formatNumber(totals.confirmed || 0));
      setText('bh-pending', formatNumber(totals.pending || 0));
      setText('bh-cancelled', formatNumber(totals.cancelled || 0));

      setText('bh-average-per-day', formatNumber(averages.perDay || 0, 1, '۰'));
      setText('bh-fulfillment-rate', formatPercent(averages.fulfillmentRate));
      setText('bh-cancellation-rate', formatPercent(averages.cancellationRate));
      setText('bh-active-days', formatNumber(totals.activeDays || 0));

      const bestDayEl = document.getElementById('bh-best-day');
      if (bestDayEl) {
        if (bestDay && bestDay.date) {
          const dateLabel = UIComponents?.formatPersianDayMonth?.(bestDay.date) || '';
          const countLabel = formatNumber(bestDay.total || 0);
          bestDayEl.textContent = dateLabel
            ? `${dateLabel} (${countLabel})`
            : countLabel;
        } else {
          bestDayEl.textContent = '—';
        }
      }

      const applyTrendCard = (id, dataPoint, percentSuffix) => {
        const card = document.getElementById(id);
        if (!card) return;
        const direction = dataPoint?.direction || 'flat';
        card.dataset.direction = direction;
        const totalEl = card.querySelector('[data-role="total"]');
        if (totalEl) {
          totalEl.textContent = formatNumber(dataPoint?.total || 0);
        }
        const deltaEl = card.querySelector('[data-role="delta"]');
        if (deltaEl) {
          deltaEl.textContent = formatDelta(dataPoint?.delta || 0);
        }
        const percentEl = card.querySelector('[data-role="percent"]');
        if (percentEl) {
          const percent = dataPoint?.percent;
          if (percent == null || !Number.isFinite(Number(percent))) {
            percentEl.textContent = '—';
          } else {
            const percentText = formatAbsolutePercent(percent);
            percentEl.textContent = percentSuffix ? `${percentText} ${percentSuffix}` : percentText;
          }
        }
      };

      applyTrendCard('bh-today-trend', todayTrend, 'نسبت به دیروز');
      applyTrendCard('bh-week-trend', weekTrend, 'نسبت به هفته قبل');

      const chartEl = document.getElementById('bh-chart');
      const emptyEl = document.getElementById('booking-history-empty');
      if (chartEl) {
        const maxTotal = daily.reduce((max, item) => Math.max(max, Number(item?.total) || 0), 0);
        if (!daily.length || maxTotal === 0) {
          chartEl.innerHTML = '';
          if (emptyEl) emptyEl.hidden = false;
        } else {
          if (emptyEl) emptyEl.hidden = true;
          chartEl.innerHTML = daily.map((day) => {
            const total = Number(day?.total) || 0;
            const iso = day?.date || '';
            const dayNumber = iso ? Number(iso.split('-')[2] || iso.split('/')[2] || 0) : 0;
            const percentage = maxTotal ? Math.max((total / maxTotal) * 100, total > 0 ? 6 : 0) : 0;
            const tooltip = `${UIComponents?.formatPersianDayMonth?.(iso) || ''} • ${formatNumber(total)} رزرو`;
            const isToday = iso && iso === (range?.end || '');
            const dayLabel = Number.isFinite(dayNumber) && dayNumber > 0
              ? UIComponents.formatPersianNumber(dayNumber)
              : '—';
            return `
              <li class="bh-bar" data-value="${total}" data-today="${isToday ? 'true' : 'false'}" aria-label="${escapeHtml(tooltip)}">
                <div class="bh-bar-track"><span class="bh-bar-fill" style="height:${percentage.toFixed(1)}%"></span></div>
                <span class="bh-bar-day">${dayLabel}</span>
              </li>
            `;
          }).join('');
        }
      }

      const serviceList = document.getElementById('bh-service-list');
      if (serviceList) {
        if (!services.length) {
          serviceList.innerHTML = '<li>هنوز خدمتی ثبت نشده است.</li>';
        } else {
          serviceList.innerHTML = services.map((service) => {
            const name = service?.service ? escapeHtml(service.service) : '—';
            const count = formatNumber(service?.total || 0);
            return `<li><span>${name}</span><span>${count}</span></li>`;
          }).join('');
        }
      }
    }

    async openBookingHistoryModal(force = false) {
      UIComponents.openModal('booking-history-modal');
      try {
        await this.renderBookingHistory(force);
      } catch (err) {
        // renderBookingHistory already logs and surfaces the error state.
      }
    }

    getRatingBadgeConfig(rating, count) {
      if (!count) return { label: 'بدون نظر', className: 'badge-warning' };
      if (rating >= 4.5) return { label: 'عالی', className: 'badge-premium' };
      if (rating >= 4) return { label: 'خیلی خوب', className: 'badge-success' };
      if (rating >= 3) return { label: 'خوب', className: 'badge-warning' };
      return { label: 'نیاز به بهبود', className: 'badge-warning' };
    }

    applyDashboardStats(stats = {}) {
      const toNumber = (value, fallback = 0) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
      };

      const setValue = (selector, value, { fractionDigits = 0 } = {}) => {
        const el = document.querySelector(selector);
        if (!el) return;
        const numeric = toNumber(value, 0);
        el.dataset.value = numeric;
        const formatted = fractionDigits > 0
          ? UIComponents.formatPersianNumber(numeric.toFixed(fractionDigits))
          : UIComponents.formatPersianNumber(numeric);
        el.textContent = formatted;
      };

      const applyTrend = (selector, direction, text) => {
        const trendEl = document.querySelector(selector);
        if (!trendEl) return;
        trendEl.classList.remove('trend-up', 'trend-down', 'trend-flat');
        const dir = direction === 'down' ? 'trend-down' : direction === 'flat' ? 'trend-flat' : 'trend-up';
        trendEl.classList.add(dir);
        const span = trendEl.querySelector('span');
        if (span) span.textContent = text;
        trendEl.setAttribute('aria-label', text);
      };

      const todayBookings = toNumber(stats.todayBookings);
      const yesterdayBookings = toNumber(stats.yesterdayBookings);
      const pendingBookings = toNumber(stats.pendingBookings);
      const activeCustomers = toNumber(stats.activeCustomers);
      const previousActiveCustomers = toNumber(stats.previousActiveCustomers);
      const newCustomers30d = toNumber(stats.newCustomers30d);
      const ratingAverage = toNumber(stats.ratingAverage);
      const ratingCount = toNumber(stats.ratingCount);

      setValue('.stat-bookings .stat-value', todayBookings);
      setValue('.stat-pending .stat-value', pendingBookings);
      setValue('.stat-customers .stat-value', activeCustomers);
      setValue('.stat-rating .stat-value', ratingAverage, { fractionDigits: 1 });
      setValue('#rating30', ratingAverage, { fractionDigits: 1 });

      const bookingsDiff = todayBookings - yesterdayBookings;
      let bookingsText = 'بدون تغییر';
      if (bookingsDiff !== 0) {
        if (yesterdayBookings === 0) {
          bookingsText = `${UIComponents.formatPersianNumber(Math.abs(bookingsDiff))} نوبت جدید`;
        } else {
          const percent = Math.round((Math.abs(bookingsDiff) / Math.max(yesterdayBookings, 1)) * 100);
          bookingsText = `${UIComponents.formatPersianNumber(percent)}٪ ${bookingsDiff > 0 ? 'افزایش' : 'کاهش'}`;
        }
      }
      const bookingsDirection = bookingsDiff > 0 ? 'up' : bookingsDiff < 0 ? 'down' : 'flat';
      applyTrend('.stat-bookings .stat-trend', bookingsDirection, bookingsText);

      const customersDiff = activeCustomers - previousActiveCustomers;
      const customersDirection = customersDiff > 0 ? 'up' : customersDiff < 0 ? 'down' : 'flat';
      const customersText = newCustomers30d > 0
        ? `${UIComponents.formatPersianNumber(newCustomers30d)} مشتری جدید`
        : 'مشتری جدیدی ثبت نشد';
      applyTrend('.stat-customers .stat-trend', customersDirection, customersText);

      const badgeConfig = this.getRatingBadgeConfig(ratingAverage, ratingCount);
      const badgeEl = document.querySelector('.stat-rating .stat-badge');
      if (badgeEl) {
        badgeEl.textContent = badgeConfig.label;
        badgeEl.classList.remove('badge-premium', 'badge-success', 'badge-warning');
        badgeEl.classList.add(badgeConfig.className);
      }

      const starsEl = document.querySelector('.stat-rating .stars-filled');
      const starsWrap = document.querySelector('.stat-rating .stat-stars');
      const clampedRating = Math.max(0, Math.min(5, ratingAverage || 0));
      if (starsEl) {
        starsEl.style.setProperty('--rating', clampedRating.toFixed(1));
      }
      if (starsWrap) {
        const label = ratingCount
          ? `${UIComponents.formatPersianNumber(clampedRating.toFixed(1))} از ۵ بر اساس ${UIComponents.formatPersianNumber(ratingCount)} نظر`
          : 'هنوز نظری ثبت نشده است';
        starsWrap.setAttribute('aria-label', label);
      }

      const ratingLabel = document.querySelector('.stat-rating .stat-label');
      if (ratingLabel) {
        ratingLabel.textContent = ratingCount
          ? `امتیاز کلی (${UIComponents.formatPersianNumber(ratingCount)} نظر)`
          : 'امتیاز کلی';
      }

      document.querySelectorAll('.stat-value').forEach(UIComponents.animateCountUp);
    }

    async renderDashboard() {
      try {
        await this.loadDashboardStats();
      } catch (err) {
        console.error('renderDashboard failed', err);
      }
      try {
        await this.loadTopPeers();
      } catch (err) {
        console.error('loadTopPeers dashboard failed', err);
      }
    }
 renderBookings(filter = 'all') {
  this.currentBookingFilter = filter;
  const listEl = document.getElementById('bookings-list');
  const prefs = CustomerPrefs.load();

  // قوانین مشتری (مسدود = لغو شده، خودکار تایید = از pending به confirmed)
  const effective = MOCK_DATA.bookings.map(b => {
    const p = prefs[normalizeKey(b.customerName)];
    const blocked = !!p?.blocked;
    if (blocked) return { ...b, status: 'cancelled', blocked };
    if (p?.autoAccept && b.status === 'pending') return { ...b, status: 'confirmed', blocked };
    return { ...b, blocked };
  });

  const filtered = (filter === 'all') ? effective : effective.filter(b => b.status === filter);

  if (!filtered.length) {
    listEl.innerHTML = `<p>موردی برای نمایش یافت نشد.</p>`;
  } else {
    const baseStatusLabel = {
      pending: 'در انتظار تایید',
      confirmed: 'تایید شده',
      completed: 'انجام شده'
    };
    listEl.innerHTML = filtered.map(b => {
      const statusText = b.status === 'cancelled'
        ? (b.cancelledBy === 'customer' ? 'لغو شده توسط مشتری' : 'لغو شده')
        : (baseStatusLabel[b.status] || b.status);
      return `
      <article class="booking-card card" role="listitem" tabindex="0" data-status="${b.status}" ${b.cancelledBy ? `data-cancelled-by="${b.cancelledBy}"` : ''} data-customer-name="${b.customerName}">
        <div class="booking-card-content">
          <strong class="booking-customer">${b.customerName}</strong>
          <span class="booking-service">
  ${b.service}
  ${UIComponents.formatPersianDayMonth(b.date) ? ' - ' + UIComponents.formatPersianDayMonth(b.date) : ''}
  - ساعت ${UIComponents.formatPersianNumber(b.time)}
</span>
          ${b.cancelledBy === 'customer' ? '<span class="cancel-note">این نوبت توسط مشتری لغو شده است</span>' : ''}
        </div>
        <div class="booking-actions">
          <span class="status-badge status-${b.status}">${statusText}</span>
          ${!['completed','cancelled'].includes(b.status) ? `
          <div class="status-wrapper">
            <button type="button" class="btn-secondary btn-icon-text status-change-btn" data-id="${b._id || b.id}" aria-haspopup="true" aria-expanded="false">تغییر وضعیت</button>
            <div class="status-menu" role="menu">
              <button type="button" class="status-option" data-status="confirmed">تایید نوبت</button>
              <button type="button" class="status-option" data-status="completed">انجام شده</button>
              <button type="button" class="status-option" data-status="cancelled">لغو نوبت</button>
            </div>
          </div>
          ` : ''}
          <button type="button" class="btn-icon-text ${b.blocked ? 'btn-secondary' : 'btn-danger'} block-customer-btn" data-name="${b.customerName}" data-user-id="${b.customerId || ''}" data-blocked="${b.blocked}" aria-label="${b.blocked ? 'آزادسازی مشتری' : 'مسدودسازی مشتری'}">${b.blocked ? 'آزادسازی' : 'مسدود'}</button>
          <button type="button" class="btn-icon btn-danger delete-booking-btn" data-id="${b._id || b.id}" aria-label="حذف نوبت">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </article>
      `;
    }).join('');
  }

  if (!listEl.dataset.statusBound) {
    const self = this;
    listEl.addEventListener('click', async function(e) {
      const delBtn = e.target.closest('.delete-booking-btn');
      const btn = e.target.closest('.status-change-btn');
      const option = e.target.closest('.status-option');
      const blockBtn = e.target.closest('.block-customer-btn');
      if (blockBtn) {
        const name = blockBtn.dataset.name;
        const userId = blockBtn.dataset.userId;
        if (!userId) {
          UIComponents.showToast('شناسه مشتری یافت نشد', 'error');
          e.stopPropagation();
          return;
        }
        const currentlyBlocked = blockBtn.dataset.blocked === 'true';
        try {
          const res = await fetch(`${API_BASE}/api/user/block/${userId}`, {
            method: currentlyBlocked ? 'DELETE' : 'POST',
            credentials: 'include',
            headers: currentlyBlocked ? undefined : { 'Content-Type': 'application/json' },
            body: currentlyBlocked ? undefined : JSON.stringify({})
          });
          if (!res.ok) throw new Error('BLOCK_FAILED');
          CustomerPrefs.setByName(name, { blocked: !currentlyBlocked });
          blockBtn.dataset.blocked = (!currentlyBlocked).toString();
          UIComponents.showToast(
            currentlyBlocked ? 'مسدودسازی برداشته شد' : '🚫 این مشتری مسدود شد',
            currentlyBlocked ? 'success' : 'error'
          );
          self.renderBookings(self.currentBookingFilter || 'all');
          self.renderPlans && self.renderPlans();
        } catch (_) {
          UIComponents.showToast('خطا در ارتباط با سرور', 'error');
        }
        e.stopPropagation();
        return;
      } else if (delBtn) {
        const id = delBtn.dataset.id;
        if (!confirm('آیا از حذف این نوبت مطمئن هستید؟')) return;
        const idx = MOCK_DATA.bookings.findIndex(b => (b._id || b.id) == id);
        if (idx > -1) {
          const booking = MOCK_DATA.bookings[idx];
          const dateISO = booking?.dateISO;
          MOCK_DATA.bookings.splice(idx, 1);
          persistBookings();
          const validId = /^[0-9a-fA-F]{24}$/.test(id);
          if (validId) {
            fetch(`${API_BASE}/api/seller-bookings/${id}`, { method: 'DELETE', credentials: 'include' })
              .catch(err => console.error('DELETE_BOOKING_FAILED', err));
          }
          self.renderBookings(self.currentBookingFilter || 'all');
          self.renderPlans && self.renderPlans();
          delete bookedCache[dateISO];
          const modal = document.getElementById('resv-modal');
          if (modal && !modal.hidden) renderTimes();
          UIComponents?.showToast?.('نوبت حذف شد', 'success');
        }
        e.stopPropagation();
        return;
      }
      if (btn) {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        listEl.querySelectorAll('.status-menu').forEach(m => m.classList.remove('open'));
        listEl.querySelectorAll('.status-change-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
        if (!expanded) {
          btn.setAttribute('aria-expanded', 'true');
          btn.parentElement.querySelector('.status-menu').classList.add('open');
        }
        e.stopPropagation();
        return;
      }
      if (option) {
        const id = option.closest('.status-wrapper').querySelector('.status-change-btn').dataset.id;
        const newStatus = option.dataset.status;
        const booking = MOCK_DATA.bookings.find(b => (b._id || b.id) == id);
        if (!booking || ['completed','cancelled'].includes(booking.status)) {
          UIComponents?.showToast?.('نوبت انجام‌شده یا لغو شده قابل تغییر نیست', 'warning');
          e.stopPropagation();
          return;
        }
        const prev = booking.status;
        booking.status = newStatus;
        booking.cancelledBy = (newStatus === 'cancelled') ? 'seller' : undefined;
        persistBookings();
        delete bookedCache[booking.dateISO];
        const modal = document.getElementById('resv-modal');
        if (modal && !modal.hidden) renderTimes();

        const validId = /^[0-9a-fA-F]{24}$/.test(id);
        if (validId) {
          fetch(`${API_BASE}/api/seller-bookings/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: newStatus })
          })
            .then(r => {
              if (!r.ok) throw new Error('STATUS_UPDATE_FAILED');
              const faStatus = { confirmed: 'تایید شد', completed: 'انجام شد', cancelled: 'لغو شد' };
              UIComponents?.showToast?.(`وضعیت نوبت ${faStatus[newStatus] || newStatus}`, 'success');
              Notifications?.add(`نوبت ${booking.customerName} ${faStatus[newStatus] || newStatus}`, 'booking');
            })
            .catch(err => {
              console.error('UPDATE_BOOKING_STATUS_FAILED', err);
              booking.status = prev;
              persistBookings();
              UIComponents?.showToast?.('خطا در به‌روزرسانی وضعیت نوبت', 'error');
            });
        }
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
    completed: effective.filter(b => b.status === 'completed').length,
    cancelled: effective.filter(b => b.status === 'cancelled').length
  };
  const setText = (sel, val) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = UIComponents.formatPersianNumber(val);
  };
  setText('.filter-chip[data-filter="all"] .chip-badge', allCount);
  setText('.filter-chip[data-filter="pending"] .chip-badge', counts.pending);
  setText('.filter-chip[data-filter="confirmed"] .chip-badge', counts.confirmed);
  setText('.filter-chip[data-filter="completed"] .chip-badge', counts.completed);
  setText('.filter-chip[data-filter="cancelled"] .chip-badge', counts.cancelled);
  this.updateDashboardStats();
  window.updateResvDayIndicators && window.updateResvDayIndicators();
}

  




    async renderReviews(filter = 'all') {
  const listEl = document.getElementById('reviews-list');

  if (!this._reviewsLoaded) {
    try {
      const seller = JSON.parse(localStorage.getItem('seller') || '{}');
      const sellerId = seller.id || seller._id;

      const pendingReq = fetch(bust(`${API_BASE}/api/shopAppearance/reviews/pending`), { credentials: 'include', ...NO_CACHE });
      const approvedReq = sellerId
        ? fetch(bust(`${API_BASE}/api/shopAppearance/${sellerId}/reviews`), { credentials: 'include', ...NO_CACHE })
        : null;

      const [pendingRes, approvedRes] = await Promise.all([pendingReq, approvedReq]);

      const pending = pendingRes?.ok ? await pendingRes.json() : [];
      const approved = approvedRes?.ok ? await approvedRes.json() : [];

      const mapReview = rv => ({
        id: rv._id,
        customerName: rv.userName || 'کاربر',
        rating: rv.score,
        date: new Date(rv.createdAt).toLocaleDateString('fa-IR'),
        comment: rv.comment,
        status: rv.approved ? 'approved' : 'pending'
      });

      const mappedPending = Array.isArray(pending) ? pending.map(mapReview) : [];
      const mappedApproved = Array.isArray(approved)
        ? approved.map(rv => ({ ...mapReview(rv), status: 'approved' }))
        : [];

      MOCK_DATA.reviews = [...mappedPending, ...mappedApproved];
    } catch (err) {
      console.error('load reviews failed', err);
      MOCK_DATA.reviews = [];
    }
    this._reviewsLoaded = true;
  }

  let filteredReviews = MOCK_DATA.reviews;

  if (filter !== 'all') {
    if (filter === '1') {
      filteredReviews = MOCK_DATA.reviews.filter(r => r.rating <= 2);
    } else {
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
          ? `<div class="review-actions">
              <div class="review-status">تایید شده</div>
              <button type="button" class="btn-danger btn-icon-text delete-review">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m3-3h8a1 1 0 011 1v2H8V4a1 1 0 011-1z"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                حذف
              </button>
            </div>`
          : `<div class="review-actions">
              <button type="button" class="btn-success btn-icon-text approve-review">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                تایید
              </button>
              <button type="button" class="btn-danger btn-icon-text delete-review">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m3-3h8a1 1 0 011 1v2H8V4a1 1 0 011-1z"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                حذف
              </button>
            </div>`}
      </article>
    `;
  }).join('');

  if (!listEl.dataset.reviewBound) {
    listEl.addEventListener('click', async (e) => {
      const approveBtn = e.target.closest('.approve-review');
      const deleteBtn = e.target.closest('.delete-review');
      if (approveBtn) {
        const card = approveBtn.closest('.review-card');
        const id = card.dataset.id;
        try {
          const res = await fetch(`${API_BASE}/api/shopAppearance/reviews/${id}/approve`, { method: 'PATCH', credentials: 'include' });
          if (!res.ok) throw new Error();
          const review = MOCK_DATA.reviews.find(r => r.id === id);
          if (review) review.status = 'approved';
          const actions = card.querySelector('.review-actions');
          if (actions) { actions.outerHTML = '<div class="review-status">تایید شده</div>'; }
          UIComponents.showToast('نظر تایید شد و در صفحه شما به نمایش در میاد', 'success');
        } catch (err) {
          UIComponents.showToast('تایید نظر ناموفق بود', 'error');
        }
        return;
      }
      if (deleteBtn) {
        const card = deleteBtn.closest('.review-card');
        const id = card.dataset.id;
        try {
          const res = await fetch(`${API_BASE}/api/shopAppearance/reviews/${id}`, { method: 'DELETE', credentials: 'include' });
          if (!res.ok) throw new Error();
          card.remove();
          MOCK_DATA.reviews = MOCK_DATA.reviews.filter(r => r.id !== id);
          UIComponents.showToast('نظر حذف شد', 'success');
        } catch (err) {
          UIComponents.showToast('حذف نظر ناموفق بود', 'error');
        }
        return;
      }
    });
    listEl.dataset.reviewBound = 'true';
  }
}


    renderPlans() {
      if (!this.isSellerPlansEnabled()) return;
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

handlePlanDurationChange() {
    PlanCheckoutController.refresh();
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
    handleCustomerFilterChange(e) {
      const btn = e.target.closest('.customer-filter');
      if (!btn) return;
      this.currentCustomerFilter = btn.dataset.filter || 'all';
      btn.parentElement?.querySelectorAll('.customer-filter').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      this.renderCustomers(this.currentCustomerQuery);
    }
    filterCustomers(query) {
      this.currentCustomerQuery = query;
      this.renderCustomers(query);
    }
    initSidebarObserver() {
      if (window.innerWidth < 1024 || !this.appNav) return;
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
        if (!container) {
            return;
        }
        
        // Helper to resolve service image URL (supports multiple backend shapes)
        const getServiceImage = (service) => {
            // 1) Direct field returned by backend
            if (service.image) return normalizeImagePath(service.image);
            if (service.imageUrl) return normalizeImagePath(service.imageUrl);

            // 2) Array-based responses
            if (Array.isArray(service.images) && service.images.length > 0) {
                const mainIdx = service.mainImageIndex || 0;
                return normalizeImagePath(service.images[mainIdx] || service.images[0] || '');
            }

            // 3) Nothing available
            return '';
        };

        const normalizeImagePath = (path) => {
            if (!path) return '';

            // If backend returns a relative path, prefix with API_BASE for proper loading
            if (path.startsWith('/')) {
                return `${API_BASE}${path}`;
            }

            return path;
        };
        
        container.innerHTML = services.length === 0 ? '<p class="no-services-msg">هیچ خدمتی تعریف نشده است.</p>' : services.map(service => {
            const imageUrl = getServiceImage(service);
            return `
            <div class="service-item-card" data-id="${service.id}">
                <div class="service-item-image">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${service.title}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="service-item-no-image" style="display:none;"><i class="fas fa-image"></i><span>تصویر نامعتبر</span></div>` : 
                    `<div class="service-item-no-image"><i class="fas fa-image"></i><span>بدون تصویر</span></div>`}
                </div>
                <div class="service-item-content">
                    <h4 class="service-item-title">${service.title}</h4>
                    <div class="service-item-price">
                        <i class="fas fa-tag"></i>
                        <span>${UIComponents.formatPersianNumber(service.price)} تومان</span>
                    </div>
                </div>
                <div class="service-item-actions">
                    <button type="button" class="service-btn-edit edit-service-btn" data-id="${service.id}" aria-label="ویرایش ${service.title}">
                        <i class="fas fa-edit"></i>
                        <span>ویرایش</span>
                    </button>
                    <button type="button" class="service-btn-delete delete-service-btn" data-id="${service.id}" aria-label="حذف ${service.title}">
                        <i class="fas fa-trash-alt"></i>
                        <span>حذف</span>
                    </button>
                </div>
            </div>
        `}).join('');
        
        // Add event listeners to the new buttons
        container.querySelectorAll('.edit-service-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // استفاده از closest برای پیدا کردن دکمه حتی اگر روی آیکون یا span کلیک شده باشد
                const button = e.target.closest('.edit-service-btn');
                const id = button?.dataset?.id;
                if (!id) return;
                
                const services = StorageManager.get('vit_services') || [];
                const service = services.find(s => String(s.id) === String(id));
                if (service) {
                    this.populateServiceForm(service);
                    UIComponents.openDrawer('service-drawer');
                }
            });
        });
        container.querySelectorAll('.delete-service-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // استفاده از closest برای پیدا کردن دکمه حتی اگر روی آیکون یا span کلیک شده باشد
                const button = e.target.closest('.delete-service-btn');
                const id = button?.dataset?.id;
                if (!id) return;
                
                this.deleteService(id);
            });
        });
    }

    async handleSettingsFormSubmit() {
        const nameEl = document.getElementById('business-name');
        const phoneEl = document.getElementById('business-phone');
        const addressEl = document.getElementById('business-address');
        const startEl = document.getElementById('work-start');
        const endEl = document.getElementById('work-end');
        const data = JSON.parse(localStorage.getItem('seller') || '{}');

        if (nameEl) data.storename = nameEl.value.trim();
        if (phoneEl) data.phone = phoneEl.value.trim();
        if (addressEl) data.address = addressEl.value.trim();

        const start = normalizeTime(startEl?.value);
        const end = normalizeTime(endEl?.value);

        if (!start) {
            UIComponents.showToast('فرمت ساعت شروع نادرست است', 'error');
            return;
        }
        if (!end) {
            UIComponents.showToast('فرمت ساعت پایان نادرست است', 'error');
            return;
        }
        if (start >= end) {
            UIComponents.showToast('ساعت پایان باید بعد از شروع باشد', 'error');
            return;
        }

        data.startTime = start;
        data.endTime = end;

        localStorage.setItem('seller', JSON.stringify(data));
        
        // Update seller identity header
        if (typeof window.updateSellerIdentity === 'function') {
          window.updateSellerIdentity();
        }

        const payload = {
            startTime: start || '',
            endTime: end || ''
        };

        try {
            const res = await fetch(`${API_BASE}/api/sellers/working-hours`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('FAILED');
        } catch (err) {
            UIComponents.showToast('خطا در ذخیره تنظیمات', 'error');
            return;
        }

        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setText('seller-shop-name', data.storename || '');
        setText('seller-phone', data.phone || '');
        setText('seller-address', data.address || '');

        UIComponents.showToast('تنظیمات ذخیره شد.', 'success');
    }

  populateServiceForm(service) {
        const form = document.getElementById('service-form');
        const titleEl = document.getElementById('service-drawer-title');
        const previewContainer = document.getElementById('service-image-preview');
        
        if (service && service.id != null) {
            form.dataset.editingId = service.id;
            document.getElementById('service-id').value = service.id;
            document.getElementById('service-title').value = service.title;
            document.getElementById('service-price').value = service.price;
            
            // Handle both 'image' string and 'images' array
            let imageUrl = '';
            if (service.image) {
                imageUrl = service.image;
            } else if (Array.isArray(service.images) && service.images.length > 0) {
                const mainIdx = service.mainImageIndex || 0;
                imageUrl = service.images[mainIdx] || service.images[0] || '';
            }
            this.currentServiceImage = imageUrl;
            document.getElementById('service-image').value = '';
            titleEl.textContent = 'ویرایش خدمت';
            
            // Show existing image preview if available
            if (previewContainer && imageUrl) {
                previewContainer.innerHTML = `
                    <div class="image-preview__content">
                        <img src="${imageUrl}" alt="پیش‌نمایش تصویر" class="image-preview__img">
                        <div class="image-preview__overlay">
                            <button type="button" class="image-preview__remove" onclick="window.sellerPanelApp?.clearServiceImagePreview()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="image-preview__info">
                            <span class="image-preview__name">تصویر فعلی</span>
                        </div>
                    </div>
                `;
                previewContainer.classList.remove('is-empty');
                previewContainer.classList.add('has-image');
            }
        } else {
            delete form.dataset.editingId;
            form.reset();
            document.getElementById('service-id').value = '';
            this.currentServiceImage = '';
            titleEl.textContent = 'افزودن خدمت جدید';
            
            // Clear image preview
            if (previewContainer) {
                previewContainer.innerHTML = `
                    <div class="image-preview__placeholder">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <span>تصویری انتخاب نشده</span>
                    </div>
                `;
                previewContainer.classList.add('is-empty');
                previewContainer.classList.remove('has-image');
            }
        }
    }
// ==== REPLACE: handleServiceFormSubmit (write-through to API) ====
// ==== REPLACE: handleServiceFormSubmit (write-through to API) ====
async handleServiceFormSubmit() {
  const form = document.getElementById('service-form');
  const rawId = form.dataset.editingId;
  const id = rawId && rawId !== 'undefined' && rawId !== 'null' && rawId !== '' ? rawId : null;

  const title = document.getElementById('service-title').value.trim();
  const price = parseFloat(document.getElementById('service-price').value);

  const fileInput = document.getElementById('service-image');
  let imageData = this.currentServiceImage;
  const file = fileInput.files && fileInput.files[0];
  if (file) {
    imageData = await this.fileToDataURL(file);
  }

  if (!title || Number.isNaN(price)) {
    UIComponents.showToast('لطفاً عنوان و قیمت معتبر وارد کنید.', 'error');
    return;
  }

  // Get seller data for additional required fields
  const sellerData = JSON.parse(localStorage.getItem('seller') || '{}');
  
  // Build payload matching backend expectations
  const payload = {
    title: title,
    price: price,
    images: imageData ? [imageData] : [], // Backend expects array
    desc: title, // Backend expects 'desc' not 'description'
    category: sellerData.category || 'خدمات',
    durationMinutes: 60, // Backend expects 'durationMinutes' not 'duration'
    isActive: true
  };

  console.log('Service payload being sent:', payload); // Debug log

  let services = StorageManager.get('vit_services') || [];
  UIComponents.showToast(id ? 'در حال ذخیره تغییرات…' : 'در حال افزودن خدمت…', 'info', 2500);

  try {
    if (!API || typeof API.getServices !== 'function') {
      throw new Error('API adapter missing');
    }

    let saved;
    if (id) {
      saved = await API.updateService({ id, ...payload });
      const idx = services.findIndex(s => String(s.id) === String(id));
      if (idx !== -1) services[idx] = { ...services[idx], ...saved };
    } else {
      saved = await API.createService(payload);
      services.push(saved);
    }

    StorageManager.set('vit_services', services);
    window.sellerServices = services;
    if (typeof window.loadServicesDropdown === 'function') {
      await window.loadServicesDropdown();
    }
    this.renderServicesList();
    UIComponents.closeDrawer('service-drawer');
    UIComponents.showToast('با موفقیت ذخیره شد.', 'success');

  } catch (err) {
    console.error('service save failed', err);
    
    // More detailed error handling
    let errorMessage = 'خطا در ذخیره روی سرور';
    if (err.message.includes('عنوان')) {
      errorMessage = 'عنوان خدمت الزامی است';
    } else if (err.message.includes('قیمت')) {
      errorMessage = 'قیمت معتبر وارد کنید';
    }
    UIComponents.showToast(errorMessage + '. دوباره تلاش کنید.', 'error');
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
async initPortfolio() {
        const container = document.getElementById('portfolio-list');
        if (container) {
            container.innerHTML = `
                <div class="loading-inline" style="opacity:.8; font-size:.9rem; padding:.75rem;">
                    در حال بارگذاری نمونه‌کارها…
                </div>`;
        }

        try {
            // Try to fetch from server
            const items = await API.getPortfolio();
            StorageManager.set('vit_portfolio', items);
        } catch (err) {
            console.warn('getPortfolio failed; using local fallback:', err?.message);

            // Fallback to local storage
            if (!StorageManager.get('vit_portfolio')) {
                const defaultPortfolio = [
                    { id: 1, title: 'موی کوتاه', image: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=300', description: 'اصلاح سر مدرن' },
                    { id: 2, title: 'رنگ موی طبیعی', image: 'https://images.unsplash.com/photo-1564460576323-2f03bbfbfe2d?w=300', description: 'رنگ طبیعی و درخشان' },
                    { id: 3, title: 'اصلاح ریش فانتزی', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300', description: 'طراحی ریش متنوع' }
                ];
                StorageManager.set('vit_portfolio', defaultPortfolio);
            }

            if (container) {
                UIComponents.showToast('اتصال به سرور برقرار نشد؛ دادهٔ محلی نمایش داده شد.', 'error');
            }
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
    updatePortfolioPreview(imageSrc) {
        const preview = document.getElementById('portfolio-image-preview');
        if (!preview) return;

        preview.innerHTML = '';

        if (imageSrc) {
            const img = document.createElement('img');
            img.src = imageSrc;
            img.alt = 'پیش‌نمایش تصویر نمونه‌کار';
            preview.appendChild(img);
            preview.classList.remove('is-empty');
        } else {
            const placeholder = document.createElement('span');
            placeholder.textContent = 'پس از انتخاب، پیش‌نمایش تصویر اینجا نمایش داده می‌شود.';
            preview.appendChild(placeholder);
            preview.classList.add('is-empty');
        }
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
        this.updatePortfolioPreview(this.currentPortfolioImage);
    }
async handlePortfolioFormSubmit() {
        const form = document.getElementById('portfolio-form');
        const id = form.dataset.editingId ? form.dataset.editingId : null;
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
        UIComponents.showToast(id ? 'در حال ذخیره تغییرات…' : 'در حال افزودن نمونه‌کار…', 'info', 2500);

        try {
            if (!API || typeof API.getPortfolio !== 'function') {
                throw new Error('API adapter missing');
            }

            let saved;
            const payload = { title, description, image: imageData };
            
            if (id) {
                // Find if this is a real DB id or local id
                const existing = portfolio.find(p => p.id === id);
                const dbId = existing?._id || existing?.id;
                
                saved = await API.updatePortfolioItem(dbId, payload);
                const index = portfolio.findIndex(p => p.id === id || p._id === dbId);
                if (index !== -1) {
                    portfolio[index] = { ...portfolio[index], ...saved };
                }
            } else {
                saved = await API.createPortfolioItem(payload);
                portfolio.push(saved);
            }

            StorageManager.set('vit_portfolio', portfolio);
            this.renderPortfolioList();
            UIComponents.closeDrawer('portfolio-drawer');
            UIComponents.showToast('نمونه‌کار با موفقیت ذخیره شد.', 'success');

        } catch (err) {
            console.error('portfolio save failed', err);
            
            // Fallback to local storage only
            if (id) {
                const index = portfolio.findIndex(p => p.id === id);
                if (index !== -1) {
                    portfolio[index] = { id, title, image: imageData, description };
                    UIComponents.showToast('نمونه‌کار ویرایش شد (محلی).', 'success');
                }
            } else {
                const newId = portfolio.length > 0 ? Math.max(...portfolio.map(p => p.id || 0)) + 1 : 1;
                portfolio.push({ id: newId, title, image: imageData, description });
                UIComponents.showToast('نمونه‌کار اضافه شد (محلی).', 'success');
            }
            
            StorageManager.set('vit_portfolio', portfolio);
            this.renderPortfolioList();
            UIComponents.closeDrawer('portfolio-drawer');
        }
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

    formatFileSize(bytes) {
        if (bytes === 0) return '0 بایت';
        const k = 1024;
        const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    clearServiceImagePreview() {
        this.currentServiceImage = '';
        const fileInput = document.getElementById('service-image');
        if (fileInput) fileInput.value = '';
        
        const previewContainer = document.getElementById('service-image-preview');
        if (previewContainer) {
            previewContainer.innerHTML = `
                <div class="image-preview__placeholder">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <span>تصویری انتخاب نشده</span>
                </div>
            `;
            previewContainer.classList.add('is-empty');
            previewContainer.classList.remove('has-image');
        }
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



// === BRAND IMAGE (footer only) ===
initBrandImages(){
  this.brandImages = { footer: '' };
  this.loadFooterImage();
  this.bindFooterImageEvents();
}

async loadFooterImage(){
  try {
    const res = await fetch(bust(`${API_BASE}/api/branding/footer`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (!res.ok) return;
    const data = await res.json();
    this.brandImages.footer = data.url || '';
    this.applyBrandImages();
  } catch (err) {
    console.error('load footer image failed', err);
  }
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
        const cancelBtn = e.target.closest('[data-action="cancel-discount"]');
        if (cancelBtn) {
          this.handleDiscountCancellation(cancelBtn.dataset.id, {
            analyticsContext: false,
            customerContext: true
          });
          e.stopPropagation();
          return;
        }

        const excludeGlobalBtn = e.target.closest('[data-action="exclude-global-discount"]');
        if (excludeGlobalBtn) {
          this.excludeCustomerFromGlobal(excludeGlobalBtn.dataset.customerId);
          e.stopPropagation();
          return;
        }

        const restoreGlobalBtn = e.target.closest('[data-action="restore-global-discount"]');
        if (restoreGlobalBtn) {
          this.restoreCustomerGlobalDiscount(restoreGlobalBtn.dataset.customerId);
          e.stopPropagation();
          return;
        }

        const discountModalBtn = e.target.closest('[data-action="open-discount-modal"]');
        if (discountModalBtn) {
          this.openCustomerDiscountModal({
            id: discountModalBtn.dataset.customerId,
            name: discountModalBtn.dataset.customerName,
          phone: discountModalBtn.dataset.customerPhone
        });
        e.stopPropagation();
        return;
      }
      const card = e.target.closest('.customer-card');
      if (card) {
        this.showCustomerDetails(card);
      }
    });
  }
}

matchesCustomerFilter(customer = {}) {
  const bookings = Number(customer.bookingsCount ?? customer.vipCurrent ?? 0);
  const joinedAt = new Date(customer.joinedAt || customer.createdAt || customer.lastReservation || Date.now());
  const now = new Date();
  const daysSinceJoin = Math.floor((now - joinedAt) / 86400000);

  switch (this.currentCustomerFilter) {
    case 'recent':
      return daysSinceJoin <= 45;
    case 'loyal':
      return bookings >= 5;
    case 'most-bookings':
    case 'least-bookings':
      return true;
    default:
      return true;
  }
}

sortCustomersByFilter(customers = []) {
  if (this.currentCustomerFilter === 'most-bookings') {
    return [...customers].sort((a, b) => (Number(b.bookingsCount) || 0) - (Number(a.bookingsCount) || 0));
  }
  if (this.currentCustomerFilter === 'least-bookings') {
    return [...customers].sort((a, b) => (Number(a.bookingsCount) || 0) - (Number(b.bookingsCount) || 0));
  }
  return customers;
}

updateCustomerStats(customers = []) {
  const totalCustomers = customers.length;
  const totalBookings = customers.reduce((sum, c) => sum + (Number(c.bookingsCount) || 0), 0);
  const totalReviews = customers.reduce((sum, c) => sum + (Number(c.reviewCount ?? c.rewardCount) || 0), 0);
  const newThisMonth = customers.filter(c => {
    const joined = new Date(c.joinedAt || c.createdAt || c.lastReservation);
    if (Number.isNaN(joined.getTime())) return false;
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    return joined >= oneMonthAgo;
  }).length;

  this.setText('customer-total-count', this.formatNumber(totalCustomers));
  this.setText('customer-visit-count', this.formatNumber(totalBookings));
  this.setText('customer-review-count', this.formatNumber(totalReviews));
  this.setText('customer-new-month', this.formatNumber(newThisMonth));
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
    'cancelled': data.lastReservation.cancelledBy === 'customer' ? 'لغو شده توسط مشتری' : 'لغو شده'
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
  if (!listEl) {
    console.warn('renderCustomers: element with id "customers-list" not found');
    return;
  }
  this.currentCustomerQuery = query;
  const normalizedQuery = (query || '').trim().toLowerCase();

  const filteredCustomers = MOCK_DATA.customers
    .filter(c =>
      c.name.toLowerCase().includes(normalizedQuery) ||
      (c.phone || '').includes(normalizedQuery)
    )
    .filter(c => this.matchesCustomerFilter(c));

  const orderedCustomers = this.sortCustomersByFilter(filteredCustomers);

  this.updateCustomerStats(MOCK_DATA.customers);

  if (orderedCustomers.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><p class="muted">مشتری با این مشخصات یافت نشد.</p></div>`;
    return;
  }

  const activeDiscounts = (this.discountStore?.getActive?.() || []).reduce((map, d) => {
    map.set(String(d.customerId), d);
    return map;
  }, new Map());

  const globalDiscount = activeDiscounts.get(this.GLOBAL_CUSTOMER_ID);

  listEl.innerHTML = orderedCustomers.map(c => {
    const lastReservation = UIComponents.formatRelativeDate(c.lastReservation);
    const joinedLabel = UIComponents.formatRelativeDate(c.joinedAt || c.lastReservation);
    const bookingsCount = this.formatNumber(c.bookingsCount ?? c.vipCurrent ?? 0);
    const reviewCount = this.formatNumber(c.reviewCount ?? c.rewardCount ?? 0);
    const tier = (c.bookingsCount ?? 0) >= 10 ? 'وفادار' : 'فعال';
    const personalDiscount = activeDiscounts.get(String(c.id));
    const isGlobalExcluded = this.isGlobalDiscountExcludedForCustomer(globalDiscount, c.id);
    const appliedGlobalDiscount = globalDiscount && !isGlobalExcluded ? globalDiscount : null;
    const discount = personalDiscount || appliedGlobalDiscount;
    const isGlobalDiscount = !!discount && (discount.isGlobal || discount.customerId === this.GLOBAL_CUSTOMER_ID);
    const hasDiscount = !!discount;
    const discountLabel = hasDiscount
      ? (isGlobalDiscount ? 'تخفیف همگانی' : 'تخفیف فعال')
      : (isGlobalExcluded ? 'تخفیف همگانی غیرفعال' : 'بدون تخفیف');
    const discountValue = hasDiscount
      ? (discount.type === 'percent'
        ? `${this.formatNumber(discount.amount)}٪`
        : `${this.formatNumber(discount.amount)} تومان`)
      : (isGlobalExcluded ? 'اعمال تخفیف همگانی برای این مشتری لغو شده است.' : 'بدون تخفیف فعال');
    const discountExpiry = hasDiscount
      ? (isGlobalDiscount
        ? `تخفیف همگانی${discount.expiresAt ? ` • ${UIComponents.formatRelativeDate(discount.expiresAt)}` : ''}`
        : `این کاربر تخفیف فعال دارد • ${UIComponents.formatRelativeDate(discount.expiresAt)}`)
      : (isGlobalExcluded ? 'تخفیف همگانی برای این مشتری غیرفعال است.' : 'تخفیفی برای این مشتری فعال نیست.');

    let discountCancelBlock = '';
    if (personalDiscount) {
      discountCancelBlock = `
        <div class="discount-control">
          <div>
            <p class="discount-control__title">لغو سریع تخفیف</p>
            <p class="discount-control__subtitle">اعتبار تا ${UIComponents.formatRelativeDate(discount.expiresAt)}</p>
          </div>
          <div class="discount-control__actions">
            <button type=\"button\" class=\"btn-ghost-sm btn-ghost-sm--danger\" data-action=\"cancel-discount\" data-id=\"${escapeHtml(discount.id)}\">لغو تخفیف</button>
          </div>
        </div>`;
    } else if (globalDiscount) {
      const actionBtn = isGlobalExcluded
        ? `<button type=\"button\" class=\"btn-ghost-sm\" data-action=\"restore-global-discount\" data-customer-id=\"${escapeHtml(c.id)}\">فعال‌سازی مجدد</button>`
        : `<button type=\"button\" class=\"btn-ghost-sm btn-ghost-sm--danger\" data-action=\"exclude-global-discount\" data-customer-id=\"${escapeHtml(c.id)}\">لغو برای این مشتری</button>`;
      const subtitle = isGlobalExcluded
        ? 'با فعال‌سازی مجدد، این مشتری هم تخفیف را دریافت می‌کند.'
        : `اعتبار تا ${UIComponents.formatRelativeDate(globalDiscount.expiresAt)}`;
      const title = isGlobalExcluded ? 'تخفیف همگانی متوقف شده' : 'تخفیف همگانی فعال است';

      discountCancelBlock = `
        <div class="discount-control ${isGlobalExcluded ? 'discount-control--muted' : ''}">
          <div>
            <p class="discount-control__title">${title}</p>
            <p class="discount-control__subtitle">${subtitle}</p>
          </div>
          <div class="discount-control__actions">
            ${actionBtn}
          </div>
        </div>`;
    }

    return `
      <article class="customer-card card"
               role="listitem" tabindex="0"
               data-name="${escapeHtml(c.name)}" data-phone="${escapeHtml(c.phone)}" data-user-id="${escapeHtml(c.id)}">
        <div class="customer-card__top">
          <div class="customer-avatar" aria-hidden="true">${escapeHtml(c.name.charAt(0))}</div>
          <div class="customer-info">
            <div class="customer-name-row">
              <div class="customer-name">${escapeHtml(c.name)}</div>
              <span class="customer-tier ${tier === 'وفادار' ? 'customer-tier--loyal' : 'customer-tier--active'}">${tier}</span>
            </div>
            <div class="customer-phone">${UIComponents.formatPersianNumber(c.phone)}</div>
            <div class="customer-tags">
              <span class="customer-chip customer-chip--join"><span class="chip-dot"></span>عضویت از ${joinedLabel || '—'}</span>
              <span class="customer-chip customer-chip--recent"><span class="chip-dot"></span>آخرین رزرو: ${lastReservation || '—'}</span>
            </div>
          </div>
          <div class="customer-actions">
            <button type="button" class="btn-secondary btn-exclusive-discount" data-action="open-discount-modal" data-customer-id="${escapeHtml(c.id)}" data-customer-name="${escapeHtml(c.name)}" data-customer-phone="${escapeHtml(c.phone)}">اهدای تخفیف اختصاصی</button>
          </div>
        </div>
        <div class="customer-card__stats">
          <div class="stat-chip">
            <span>رزرو</span>
            <strong>${bookingsCount}</strong>
          </div>
          <div class="stat-chip">
            <span>نظرات</span>
            <strong>${reviewCount}</strong>
          </div>
          <div class="stat-chip stat-chip--accent stat-chip--discount">
            <div class="discount-state">
              <span class="discount-pill ${hasDiscount ? 'is-active' : 'is-empty'}">${discountLabel}</span>
              <strong class="discount-value">${discountValue}</strong>
            </div>
            <p class="discount-meta">${discountExpiry}</p>
            <div class="discount-actions">
              <button type="button" class="link-btn" data-action="open-discount-modal" data-customer-id="${escapeHtml(c.id)}" data-customer-name="${escapeHtml(c.name)}" data-customer-phone="${escapeHtml(c.phone)}">${hasDiscount ? 'مدیریت تخفیف' : 'اهدای تخفیف'}</button>
            </div>
            ${discountCancelBlock}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

  initDiscountFeature() {
    this.discountForm = document.getElementById('discount-form');
    this.discountCustomerSelect = document.getElementById('discount-customer');
    this.discountAmountInput = document.getElementById('discount-amount');
    this.discountNoteInput = document.getElementById('discount-note');
    this.discountTypeInputs = this.discountForm?.querySelectorAll('input[name="discount-type"]') || [];
    this.discountExpiryInput = document.getElementById('discount-expiry');
    this.discountSuggestions = document.getElementById('discount-suggestions');
    this.discountListEl = document.getElementById('discounts-list');
    this.discountEmptyEl = document.getElementById('discounts-empty');

    this.discountModal = document.getElementById('discount-modal');
    this.discountModalForm = document.getElementById('discount-modal-form');
    this.discountModalName = document.getElementById('discount-modal-name');
    this.discountModalPhone = document.getElementById('discount-modal-phone');
    this.discountModalAvatar = document.getElementById('discount-modal-avatar');
    this.discountModalStatus = document.getElementById('discount-modal-status');
    this.discountModalSummary = document.getElementById('discount-modal-summary');
    this.discountModalAmount = document.getElementById('discount-modal-amount');
    this.discountModalNote = document.getElementById('discount-modal-note');
    this.discountModalHint = document.getElementById('discount-modal-hint');
    this.discountModalTypeInputs = this.discountModal?.querySelectorAll('input[name="discount-modal-type"]') || [];
    this.discountModalDurationInputs = this.discountModal?.querySelectorAll('input[name="discount-modal-duration"]') || [];
    this.discountModalCustomDateWrap = document.getElementById('discount-modal-custom-date');
    this.discountModalExpiryInput = document.getElementById('discount-modal-expiry');
    this.discountModalCustomerId = '';
    this.discountModalCustomerName = '';
    this.discountModalCustomerPhone = '';

    this.discountInsightsOpen = document.getElementById('discount-insights-open');
    this.discountInsightsUsage = document.getElementById('discount-insights-usage');
    this.discountInsightsNextExpiry = document.getElementById('discount-insights-next-expiry');

    this.discountAnalyticsModal = document.getElementById('discount-analytics-modal');
    this.discountAnalyticsList = document.getElementById('discount-analytics-list');
    this.discountAnalyticsEmpty = document.getElementById('discount-analytics-empty');
    this.discountAnalyticsUsage = document.getElementById('discount-analytics-usage');
    this.discountAnalyticsNextExpiry = document.getElementById('discount-analytics-next-expiry');
    this.discountAnalyticsExpiring = document.getElementById('discount-analytics-expiring');
    this.discountAnalyticsIssued = document.getElementById('discount-analytics-issued');
    this.discountAnalyticsActive = document.getElementById('discount-analytics-active');
    this.discountAnalyticsGlobal = document.getElementById('discount-analytics-global');
    this.discountAnalyticsPersonal = document.getElementById('discount-analytics-personal');

    this.discountQuickSearch = document.getElementById('discount-quick-search');
    this.discountQuickResults = document.getElementById('discount-quick-results');

    this.globalDiscountForm = document.getElementById('global-discount-form');
    this.globalDiscountAmount = document.getElementById('global-discount-amount');
    this.globalDiscountAmountField = document.getElementById('global-discount-amount-field');
    this.globalDiscountNoteInput = document.getElementById('global-discount-note');
    this.globalDiscountTypeInputs = this.globalDiscountForm?.querySelectorAll('input[name="global-discount-type"]') || [];
    this.globalDiscountDurationInputs = this.globalDiscountForm?.querySelectorAll('input[name="global-discount-duration"]') || [];
    this.globalDiscountStatus = document.getElementById('global-discount-status');
    this.globalDiscountClear = document.getElementById('global-discount-clear');
    this.globalDiscountCustomDate = document.getElementById('global-discount-custom-date');
    this.globalDiscountCustomDateWrap = document.getElementById('global-discount-custom-date-wrap');
    this.globalDiscountCouponInput = document.getElementById('global-discount-coupon');
    this.globalDiscountConfirmModal = document.getElementById('global-discount-confirm-modal');
    this.globalDiscountConfirmTitle = document.getElementById('global-discount-confirm-title');
    this.globalDiscountConfirmSubtitle = document.getElementById('global-discount-confirm-subtitle');
    this.globalDiscountConfirmDetails = document.getElementById('global-discount-confirm-details');
    this.globalDiscountConfirmAccept = document.getElementById('global-discount-confirm-accept');
    this.globalDiscountSuccess = document.getElementById('global-discount-success');
    this.globalDiscountSuccessAmount = document.getElementById('global-discount-success-amount');
    this.globalDiscountSuccessExpiry = document.getElementById('global-discount-success-expiry');
    this.globalDiscountSuccessNote = document.getElementById('global-discount-success-note');
    this.globalDiscountSuccessDescription = document.getElementById('global-discount-success-description');
    this.discountGuardModal = document.getElementById('discount-guard-modal');
    this.discountGuardAmount = document.getElementById('discount-guard-amount');
    this.discountGuardExpiry = document.getElementById('discount-guard-expiry');
    this.discountGuardNote = document.getElementById('discount-guard-note');
    this.discountGuardDescription = document.getElementById('discount-guard-description');
    this.discountGuardTitle = document.getElementById('discount-guard-title');
    this.discountGuardRemove = document.getElementById('discount-guard-remove');

    if (this.discountModalTypeInputs?.length) {
      this.discountModalTypeInputs.forEach(input => {
        input.addEventListener('change', () => {
          this.updateDiscountModalType(input.value);
        });
      });
    }

    if (this.discountModalDurationInputs?.length) {
      this.discountModalDurationInputs.forEach(input => {
        input.addEventListener('change', () => this.updateDiscountModalDuration(input.value));
      });
      const initialModalDuration = Array.from(this.discountModalDurationInputs).find(input => input.checked)?.value || 'week';
      this.updateDiscountModalDuration(initialModalDuration);
    }

    if (this.discountInsightsOpen) {
      this.discountInsightsOpen.addEventListener('click', () => this.openDiscountAnalyticsModal());
    }

    document.querySelectorAll('[data-dismiss="discount-analytics-modal"]').forEach(btn => {
      btn.addEventListener('click', () => UIComponents.closeModal('discount-analytics-modal'));
    });

    if (this.discountModalForm) {
      this.discountModalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitQuickDiscount();
      });
    }

    if (this.discountModalExpiryInput) {
      this.discountModalExpiryInput.addEventListener('input', (e) => {
        const input = e.target;
        const formatted = this.formatPersianDateMask(input.value);
        if (formatted !== input.value) {
          input.value = formatted;
          const cursorPos = formatted.length;
          input.setSelectionRange(cursorPos, cursorPos);
        }
      });
    }

    if (this.discountForm) {
      this.discountForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleDiscountSubmit();
      });
    }

    if (this.discountSuggestions) {
      this.discountSuggestions.addEventListener('click', (e) => {
        const btn = e.target.closest('.quick-customer');
        if (!btn) return;
        const customerId = btn.dataset.customerId;
        if (this.discountCustomerSelect) {
          this.discountCustomerSelect.value = customerId;
          this.discountCustomerSelect.dispatchEvent(new Event('change'));
        }
        const preset = btn.dataset.presetAmount;
        if (preset && this.discountAmountInput) {
          this.discountAmountInput.value = preset;
        }
      });
    }

    if (this.discountListEl) {
      this.discountListEl.addEventListener('click', (e) => {
        const cancelBtn = e.target.closest('[data-action="cancel-discount"]');
        if (cancelBtn) {
          this.handleDiscountCancellation(cancelBtn.dataset.id);
          this.renderCustomers(this.currentCustomerQuery || '');
        }
      });
    }

    if (this.discountAnalyticsList) {
      this.discountAnalyticsList.addEventListener('click', (e) => {
        const cancelBtn = e.target.closest('[data-action="cancel-discount"]');
        if (cancelBtn) {
          this.handleDiscountCancellation(cancelBtn.dataset.id, { analyticsContext: true });
          return;
        }

        const searchBtn = e.target.closest('[data-action="open-discount-modal"]');
        if (searchBtn) {
          this.openCustomerDiscountModal({
            id: searchBtn.dataset.customerId,
            name: searchBtn.dataset.customerName,
            phone: searchBtn.dataset.customerPhone
          });
        }

        const openGlobalConfirm = e.target.closest('[data-action="open-global-discount-confirm"]');
        if (openGlobalConfirm) {
          this.openGlobalDiscountConfirm();
        }
      });
    }

    if (this.discountQuickSearch) {
      this.discountQuickSearch.addEventListener('input', (e) => {
        this.renderQuickDiscountResults(e.target.value);
      });
    }

    if (this.discountQuickResults) {
      this.discountQuickResults.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="quick-discount"]');
        if (btn) {
          this.openCustomerDiscountModal({
            id: btn.dataset.customerId,
            name: btn.dataset.customerName,
            phone: btn.dataset.customerPhone
          });
        }
      });
    }

    if (this.globalDiscountForm) {
      this.globalDiscountForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleGlobalDiscountSubmit();
      });
    }

    if (this.globalDiscountClear) {
      this.globalDiscountClear.addEventListener('click', () => this.openGlobalDiscountConfirm());
    }

    if (this.globalDiscountSuccess) {
      this.globalDiscountSuccess.querySelectorAll('[data-dismiss="global-discount-success"]').forEach(btn => {
        btn.addEventListener('click', () => this.hideGlobalDiscountSuccess());
      });
    }

    if (this.discountGuardRemove) {
      this.discountGuardRemove.addEventListener('click', () => {
        UIComponents.closeModal('discount-guard-modal');
        this.openGlobalDiscountConfirm();
      });
    }

    if (this.globalDiscountConfirmAccept) {
      this.globalDiscountConfirmAccept.addEventListener('click', () => this.confirmClearGlobalDiscount());
    }

    if (this.globalDiscountTypeInputs?.length) {
      this.globalDiscountTypeInputs.forEach(input => {
        input.addEventListener('change', () => this.updateGlobalDiscountType(input.value));
      });
      const initialGlobalType = Array.from(this.globalDiscountTypeInputs).find(input => input.checked)?.value || 'amount';
      this.updateGlobalDiscountType(initialGlobalType);
    }

    if (this.globalDiscountDurationInputs?.length) {
      this.globalDiscountDurationInputs.forEach(input => {
        input.addEventListener('change', () => this.updateGlobalDurationState(input.value));
      });
      const initialDuration = Array.from(this.globalDiscountDurationInputs).find(input => input.checked)?.value || 'today';
      this.updateGlobalDurationState(initialDuration);
    }

    if (this.globalDiscountCustomDate) {
      this.globalDiscountCustomDate.addEventListener('input', (e) => {
        const input = e.target;
        const formatted = this.formatPersianDateMask(input.value);
        if (formatted !== input.value) {
          input.value = formatted;
          const cursorPos = formatted.length;
          input.setSelectionRange(cursorPos, cursorPos);
        }
      });
    }

    if (this.globalDiscountDurationInputs?.length) {
      this.globalDiscountDurationInputs.forEach(input => {
        input.addEventListener('change', () => this.updateGlobalDiscountStatus());
      });
    }

    document.addEventListener('customers:loaded', () => {
      this.refreshDiscountCustomers();
      this.renderDiscounts();
      this.renderQuickDiscountResults(this.discountQuickSearch?.value || '');
      this.updateGlobalDiscountStatus();
      this.updateDiscountAnalytics();
    });

    if (this.discountTypeInputs?.length) {
      this.discountTypeInputs.forEach(input => {
        input.addEventListener('change', () => {
          this.updateDiscountFieldType(input.value);
        });
      });
      const initialType = Array.from(this.discountTypeInputs).find(input => input.checked)?.value || 'amount';
      this.updateDiscountFieldType(initialType);
    }

    this.refreshDiscountCustomers();
    this.renderDiscounts();
    this.renderQuickDiscountResults('');
    this.updateGlobalDiscountStatus();
    this.updateDiscountAnalytics();
  }

  openCustomerDiscountModal(customer = {}) {
    if (this.getGlobalDiscount()) {
      this.showDiscountGuardModal('personal');
      return;
    }

    const fallback = this.getDiscountCustomers().find(c => String(c.id) === String(customer.id)) || {};
    const id = customer.id || fallback.id;
    if (!id) return;

    const name = customer.name || fallback.name || 'مشتری';
    const phone = customer.phone || fallback.phone || '';
    const activeDiscount = this.getActiveDiscountForCustomer(id);
    const typeToSelect = activeDiscount?.type || 'amount';
    const defaultDuration = 'week';

    this.discountModalCustomerId = id;
    this.discountModalCustomerName = name;
    this.discountModalCustomerPhone = phone;

    if (this.discountModalName) this.discountModalName.textContent = name;
    if (this.discountModalPhone) this.discountModalPhone.textContent = UIComponents.formatPersianNumber(phone || '');
    if (this.discountModalAvatar) this.discountModalAvatar.textContent = name.charAt(0);

    if (this.discountModalAmount) {
      this.discountModalAmount.value = activeDiscount?.amount || 5000;
      this.discountModalAmount.focus({ preventScroll: true });
    }

    const setChecked = (inputs, value) => {
      if (!inputs) return;
      inputs.forEach(input => {
        input.checked = input.value === value;
      });
    };
    const expiryInputValue = this.formatDateInputValue(activeDiscount?.expiresAt);
    const durationToSelect = activeDiscount?.expiresAt ? 'custom' : defaultDuration;

    setChecked(this.discountModalTypeInputs, typeToSelect);
    setChecked(this.discountModalDurationInputs, durationToSelect);

    if (this.discountModalExpiryInput) {
      this.discountModalExpiryInput.value = expiryInputValue;
    }

    this.updateDiscountModalType(typeToSelect);
    this.updateDiscountModalDuration(durationToSelect);

    if (this.discountModalNote) {
      this.discountModalNote.value = activeDiscount?.note || '';
    }

    if (this.discountModalStatus) {
      this.discountModalStatus.textContent = activeDiscount ? 'این مشتری تخفیف فعال دارد' : 'بدون تخفیف فعال';
      this.discountModalStatus.className = `discount-modal__badge ${activeDiscount ? 'is-active' : 'is-empty'}`;
    }

    if (this.discountModalSummary) {
      const summary = activeDiscount
        ? `${activeDiscount.type === 'percent' ? `${this.formatNumber(activeDiscount.amount)}٪` : `${this.formatNumber(activeDiscount.amount)} تومان`} • تا ${UIComponents.formatRelativeDate(activeDiscount.expiresAt)}`
        : 'هنوز هیچ تخفیفی به این مشتری اختصاص داده نشده است. با چند کلیک یک پیشنهاد جذاب بدهید.';
      this.discountModalSummary.textContent = summary;
    }

    if (this.discountModalHint) {
      this.discountModalHint.textContent = activeDiscount
        ? 'ثبت تخفیف جدید، تخفیف فعال فعلی را جایگزین می‌کند.'
        : 'پس از ثبت، مشتری یک تخفیف اختصاصی دریافت می‌کند.';
    }

    UIComponents.openModal('discount-modal');
  }

  updateDiscountModalType(type = 'amount') {
    const field = this.discountModal?.querySelector('.discount-modal__amount-field');
    const isPercent = type === 'percent';
    if (field) {
      field.dataset.icon = isPercent ? 'percent' : 'amount';
    }
    if (this.discountModalAmount) {
      this.discountModalAmount.placeholder = isPercent ? 'مثلاً ۲۰' : 'مثلاً ۵۰۰۰۰';
      this.discountModalAmount.step = isPercent ? '1' : '500';
      if (isPercent) {
        this.discountModalAmount.max = '90';
      } else {
        this.discountModalAmount.removeAttribute('max');
      }
    }
  }

  updateDiscountModalDuration(mode = 'week') {
    const showCustom = mode === 'custom';
    if (this.discountModalCustomDateWrap) {
      this.discountModalCustomDateWrap.hidden = !showCustom;
    }
    if (!showCustom && this.discountModalExpiryInput) {
      this.discountModalExpiryInput.value = '';
    }
  }

  updateDiscountFieldType(type = 'amount') {
    const field = this.discountForm?.querySelector('.discount-amount-field');
    const isPercent = type === 'percent';
    if (field) {
      field.dataset.icon = isPercent ? 'percent' : 'amount';
    }
    if (this.discountAmountInput) {
      this.discountAmountInput.placeholder = isPercent ? 'مثلاً ۲۰' : 'مثلاً ۵۰۰۰۰';
      this.discountAmountInput.step = isPercent ? '1' : '500';
      if (isPercent) {
        this.discountAmountInput.max = '90';
      } else {
        this.discountAmountInput.removeAttribute('max');
      }
    }
  }

  submitQuickDiscount() {
    if (this.getGlobalDiscount()) {
      this.showDiscountGuardModal('personal');
      return;
    }

    if (!this.discountModalCustomerId) {
      UIComponents.showToast('مشتری انتخاب نشده است.', 'error');
      return;
    }

    const type = Array.from(this.discountModalTypeInputs || []).find(input => input.checked)?.value || 'amount';
    const amount = Number(this.discountModalAmount?.value || 0);

    if (type === 'percent') {
      if (!Number.isFinite(amount) || amount <= 0 || amount > 90) {
        UIComponents.showToast('درصد تخفیف باید بین ۱ تا ۹۰ باشد.', 'error');
        return;
      }
    } else {
      if (!Number.isFinite(amount) || amount < 1000) {
        UIComponents.showToast('مبلغ تخفیف را حداقل با ۱۰۰۰ تومان وارد کنید.', 'error');
        return;
      }
    }

    const duration = Array.from(this.discountModalDurationInputs || []).find(input => input.checked)?.value || 'today';
    const manualExpiry = duration === 'custom' ? (this.discountModalExpiryInput?.value || '') : '';
    if (duration === 'custom' && !manualExpiry) {
      UIComponents.showToast('تاریخ انقضا را وارد کنید.', 'error');
      return;
    }
    const parsedCustomExpiry = duration === 'custom' ? this.parseDiscountDateInput(manualExpiry) : null;
    if (duration === 'custom' && !parsedCustomExpiry) {
      UIComponents.showToast('تاریخ واردشده معتبر نیست. لطفاً یک تاریخ شمسی مانند ۱۴۰۴/۰۸/۲۵ وارد کنید.', 'error');
      return;
    }
    const note = (this.discountModalNote?.value || '').trim();
    const expiresAt = duration === 'custom'
      ? (() => { const d = parsedCustomExpiry; d.setHours(23, 59, 0, 0); return d.toISOString(); })()
      : this.calculateDiscountExpiry(duration);

    const discount = {
      id: crypto.randomUUID ? crypto.randomUUID() : `disc-${Date.now()}`,
      customerId: this.discountModalCustomerId,
      customerName: this.discountModalCustomerName || 'مشتری',
      customerPhone: this.discountModalCustomerPhone || '',
      amount,
      type,
      createdAt: new Date().toISOString(),
      expiresAt,
      note: note || (manualExpiry ? this.formatCustomExpiryLabel(manualExpiry) : this.getDiscountDurationLabel(duration))
    };

    this.discountStore.upsert(discount);
    UIComponents.showToast('تخفیف برای مشتری ثبت شد.', 'success');
    UIComponents.closeModal('discount-modal');
    this.renderDiscounts();
    this.renderCustomers(this.currentCustomerQuery || '');
  }

  getActiveDiscountForCustomer(customerId) {
    if (!customerId) return null;
    const personal = (this.discountStore?.getActive() || []).find(d => String(d.customerId) === String(customerId));
    if (personal) return personal;
    const globalDiscount = this.getGlobalDiscount();
    if (this.isGlobalDiscountExcludedForCustomer(globalDiscount, customerId)) return null;
    return globalDiscount;
  }

  getDiscountCustomers() {
    const primarySource = Array.isArray(window.MOCK_DATA?.customers) && window.MOCK_DATA.customers.length
      ? window.MOCK_DATA.customers
      : (Array.isArray(window.customersData) ? window.customersData : []);

    if (primarySource.length) {
      return primarySource.map(c => ({
        id: String(c.id || c.userId || c._id),
        name: c.name || 'مشتری',
        phone: c.phone || c.phoneNumber || '',
        lastReservation: c.lastReservation || c.lastReservationAt || ''
      }));
    }

    return [
      { id: 'demo-1', name: 'مشتری وفادار', phone: '۰۹۱۲۱۲۳۴۵۶۷', lastReservation: '۱۴۰۳/۰۴/۲۲' },
      { id: 'demo-2', name: 'مشتری جدید', phone: '۰۹۳۵۴۴۴۴۴۴۴', lastReservation: 'دیروز' },
      { id: 'demo-3', name: 'مشتری نزدیک', phone: '۰۹۱۳۳۳۳۳۳۳۳', lastReservation: 'هفته جاری' }
    ];
  }

  refreshDiscountCustomers(selectedId = '') {
    if (!this.discountCustomerSelect) return;
    const customers = this.getDiscountCustomers();
    const placeholder = '<option value="" disabled selected>یک مشتری را انتخاب کنید</option>';
    this.discountCustomerSelect.innerHTML = placeholder + customers.map(c => `
      <option value="${c.id}">${escapeHtml(c.name)} • ${UIComponents.formatPersianNumber(c.phone || '')}</option>
    `).join('');

    if (selectedId) {
      this.discountCustomerSelect.value = selectedId;
    } else {
      this.discountCustomerSelect.selectedIndex = 0;
    }

    this.renderDiscountSuggestions(customers);
  }

  renderDiscountSuggestions(customers = []) {
    if (!this.discountSuggestions) return;
    const top = customers.slice(0, 3);
    if (!top.length) {
      this.discountSuggestions.innerHTML = '';
      return;
    }

    this.discountSuggestions.innerHTML = top.map(c => `
      <button type="button" class="quick-customer" data-customer-id="${c.id}" data-preset-amount="10000">
        <div class="avatar">${escapeHtml(c.name?.charAt(0) || 'م')}</div>
        <div>
          <strong>${escapeHtml(c.name || 'مشتری')}</strong>
          <small>${UIComponents.formatPersianNumber(c.phone || '')}</small>
        </div>
      </button>
    `).join('');
  }

  getSelectedDiscountDuration() {
    const selected = document.querySelector('input[name="discount-duration"]:checked');
    return selected ? selected.value : 'today';
  }

  getDiscountDurationLabel(mode) {
    switch (mode) {
      case 'custom': return 'انقضای دلخواه فروشنده';
      case '3d': return 'مهلت استفاده تا ۳ روز آینده';
      case 'week': return 'مهلت استفاده تا یک هفته';
      default: return 'مهلت تا پایان امروز';
    }
  }

  toPersianDigits(value = '') {
    const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(value).replace(/[0-9]/g, d => digits[Number(d)] ?? d);
  }

  normalizePersianDigits(value = '') {
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    return String(value)
      .replace(/[۰-۹]/g, d => persianDigits.indexOf(d))
      .replace(/[٠-٩]/g, d => arabicDigits.indexOf(d));
  }

  formatPersianDateMask(value = '') {
    const digitsOnly = this.normalizePersianDigits(value).replace(/\D/g, '').slice(0, 8);
    const year = digitsOnly.slice(0, 4);
    const month = digitsOnly.slice(4, 6);
    const day = digitsOnly.slice(6, 8);
    const parts = [];

    if (year) parts.push(year);
    if (month) parts.push(month);
    if (day) parts.push(day);

    return this.toPersianDigits(parts.join('/'));
  }

  jalaliToGregorian(jy, jm, jd) {
    jy += 1595;
    let days = -355668 + (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    let gy = 400 * Math.floor(days / 146097);
    days %= 146097;

    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524);
      days %= 36524;
      if (days >= 365) days++;
    }

    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      gy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }

    days += 1;
    const leap = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
    const monthDays = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm = 1;
    while (gm <= 12 && days > monthDays[gm]) {
      days -= monthDays[gm];
      gm++;
    }

    return { gy, gm, gd: days };
  }

  gregorianToJalali(gy, gm, gd) {
    const gDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let gy2 = gy - 1600;
    let gm2 = gm - 1;
    let gd2 = gd - 1;

    let gDayNo = 365 * gy2 + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400);
    gDayNo += gDays[gm2] + gd2;
    if (gm2 > 1 && ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0))) {
      gDayNo += 1;
    }

    let jDayNo = gDayNo - 79;
    const jNp = Math.floor(jDayNo / 12053);
    jDayNo %= 12053;

    let jy = 979 + 33 * jNp + 4 * Math.floor(jDayNo / 1461);
    jDayNo %= 1461;

    if (jDayNo >= 366) {
      jy += Math.floor((jDayNo - 1) / 365);
      jDayNo = (jDayNo - 1) % 365;
    }

    const jMonthDays = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
    let jm = 0;
    while (jm < 11 && jDayNo >= jMonthDays[jm]) {
      jDayNo -= jMonthDays[jm];
      jm += 1;
    }

    const jd = jDayNo + 1;
    return { jy, jm: jm + 1, jd };
  }

  isValidJalaliDate(jy, jm, jd) {
    if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return false;
    if (jy < 1300 || jy > 1499) return false;
    if (jm < 1 || jm > 12) return false;
    if (jd < 1 || jd > 31) return false;

    const gregorian = this.jalaliToGregorian(jy, jm, jd);
    const backToJalali = this.gregorianToJalali(gregorian.gy, gregorian.gm, gregorian.gd);
    return backToJalali.jy === jy && backToJalali.jm === jm && backToJalali.jd === jd;
  }

  parseDiscountDateInput(dateValue) {
    const normalized = this.normalizePersianDigits(dateValue).replace(/\s+/g, '');
    if (!normalized) return null;

    const jalaliMatch = normalized.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (!jalaliMatch) return null;

    const [, yearStr, monthStr, dayStr] = jalaliMatch;
    const y = Number(yearStr);
    const m = Number(monthStr);
    const d = Number(dayStr);
    const pad = (n) => String(n).padStart(2, '0');

    if (!this.isValidJalaliDate(y, m, d)) return null;

    const { gy, gm, gd } = this.jalaliToGregorian(y, m, d);
    const greg = new Date(`${gy}-${pad(gm)}-${pad(gd)}`);
    return Number.isNaN(greg.getTime()) ? null : greg;
  }

  formatCustomExpiryLabel(dateValue) {
    const parsed = this.parseDiscountDateInput(dateValue);
    if (!parsed) return 'انقضا بر اساس تاریخ واردشده';
    const fa = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed);
    return `انقضا تا ${fa}`;
  }

  calculateDiscountExpiry(duration) {
    const end = new Date();
    if (duration === '3d') {
      end.setDate(end.getDate() + 3);
    } else if (duration === 'week') {
      end.setDate(end.getDate() + 7);
    }
    end.setHours(23, 59, 0, 0);
    return end.toISOString();
  }

  normalizeExpiry(dateValue, fallbackDuration = 'today') {
    const parsed = this.parseDiscountDateInput(dateValue);
    if (!parsed) {
      return this.calculateDiscountExpiry(fallbackDuration);
    }
    parsed.setHours(23, 59, 0, 0);
    return parsed.toISOString();
  }

  formatDateInputValue(dateValue) {
    const parsed = dateValue ? new Date(dateValue) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return '';
    const offsetDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = formatter.formatToParts(offsetDate).reduce((acc, part) => {
      if (part.type === 'day') acc.day = part.value;
      if (part.type === 'month') acc.month = part.value;
      if (part.type === 'year') acc.year = part.value;
      return acc;
    }, { day: '', month: '', year: '' });
    const dayFirst = [parts.day, parts.month, parts.year].filter(Boolean).join('/');
    return dayFirst.replace(/\u200f/g, '');
  }

  formatToman(value) {
    const numeric = Math.max(0, Number(value) || 0);
    return `${new Intl.NumberFormat('fa-IR').format(numeric)} تومان`;
  }

  formatRemainingTime(expiresAt) {
    const end = new Date(expiresAt);
    if (!expiresAt || Number.isNaN(end.getTime())) return '';
    const diff = end.getTime() - Date.now();
    if (diff <= 0) return 'منقضی شده';
    const minutes = Math.round(diff / 60000);
    if (minutes < 60) {
      return `${UIComponents.formatPersianNumber(Math.max(1, minutes))} دقیقه باقی‌مانده`;
    }
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) {
      return `${UIComponents.formatPersianNumber(hours)} ساعت آینده`;
    }
    const days = Math.ceil(hours / 24);
    return `${UIComponents.formatPersianNumber(days)} روز آینده`;
  }

  renderQuickDiscountResults(query = '') {
    if (!this.discountQuickResults) return;
    const customers = this.getDiscountCustomers();
    const cleaned = normalizeKeyPart(query);
    const matches = cleaned
      ? customers.filter(c => {
          const nameKey = normalizeKeyPart(c.name || '');
          const phoneKey = normalizeKeyPart(c.phone || '');
          return nameKey.includes(cleaned) || phoneKey.includes(cleaned.replace(/[^\d]/g, ''));
        })
      : customers.slice(0, 4);

    if (!matches.length) {
      this.discountQuickResults.innerHTML = '<div class="discount-quick-empty">مشتری با این مشخصات پیدا نشد.</div>';
      return;
    }

    const maxItems = 5;
    this.discountQuickResults.innerHTML = matches.slice(0, maxItems).map((c) => `
      <div class="discount-quick-result" role="listitem">
        <div class="discount-quick-result__meta">
          <strong>${escapeHtml(c.name || 'مشتری')}</strong>
          <small>${UIComponents.formatPersianNumber(c.phone || '')}</small>
          <small>${c.lastReservation ? `آخرین مراجعه: ${UIComponents.formatRelativeDate(c.lastReservation)}` : 'بدون تاریخ رزرو'}</small>
        </div>
        <button type="button" class="btn-secondary" data-action="quick-discount" data-customer-id="${escapeHtml(c.id)}" data-customer-name="${escapeHtml(c.name)}" data-customer-phone="${escapeHtml(c.phone)}">
          تخفیف فوری
        </button>
      </div>
    `).join('');
  }

  updateGlobalDiscountType(type = 'amount') {
    if (this.globalDiscountAmountField) {
      this.globalDiscountAmountField.dataset.icon = type === 'percent' ? 'percent' : 'amount';
    }
    if (this.globalDiscountAmount) {
      this.globalDiscountAmount.placeholder = type === 'percent' ? 'مثلاً ۱۰' : 'مثلاً ۲۰٬۰۰۰';
    }
  }

  updateGlobalDurationState(duration = 'today') {
    if (!this.globalDiscountCustomDateWrap) return;
    const isCustom = duration === 'custom';
    this.globalDiscountCustomDateWrap.classList.toggle('is-active', isCustom);
    if (isCustom && this.globalDiscountCustomDate && !this.globalDiscountCustomDate.value) {
      const base = new Date();
      base.setDate(base.getDate() + 3);
      const faDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(base);
      this.globalDiscountCustomDate.placeholder = faDate;
    }
  }

  isGlobalDiscountExcludedForCustomer(globalDiscount, customerId) {
    if (!globalDiscount || !customerId) return false;
    const exclusions = Array.isArray(globalDiscount.excludedCustomerIds) ? globalDiscount.excludedCustomerIds : [];
    return exclusions.map(String).includes(String(customerId));
  }

  getGlobalDiscount() {
    return (this.discountStore?.getActive() || []).find(d =>
      d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID || d.id === this.GLOBAL_DISCOUNT_ID
    ) || null;
  }

  showDiscountGuardModal(mode = 'personal') {
    const active = this.getGlobalDiscount();
    if (!active) return false;

    const amountLabel = active.type === 'percent'
      ? `${this.formatNumber(active.amount, { fractionDigits: 0 })}٪`
      : `${this.formatNumber(active.amount, { fractionDigits: 0 })} تومان`;
    const expiryRelative = active.expiresAt ? this.formatRemainingTime(active.expiresAt) : '';
    const expiryLabel = active.expiresAt
      ? (expiryRelative || `اعتبار تا ${UIComponents.formatRelativeDate(active.expiresAt)}`)
      : 'بدون زمان انقضا';

    if (this.discountGuardAmount) {
      this.discountGuardAmount.textContent = `تخفیف فعال: ${amountLabel}`;
    }
    if (this.discountGuardExpiry) {
      this.discountGuardExpiry.textContent = expiryRelative ? `انقضا: ${expiryRelative}` : expiryLabel;
    }
    if (this.discountGuardNote) {
      this.discountGuardNote.textContent = 'برای ثبت تخفیف جدید، ابتدا تخفیف همگانی فعلی را حذف کنید.';
    }

    const description = mode === 'global'
      ? 'تا زمانی که تخفیف همگانی فعلی فعال است نمی‌توانید تخفیف همگانی جدیدی ثبت کنید.'
      : 'تا زمانی که تخفیف همگانی فعال است امکان ثبت تخفیف اختصاصی برای مشتریان وجود ندارد.';
    const title = 'تخفیف همگانی فعال است';

    if (this.discountGuardDescription) this.discountGuardDescription.textContent = description;
    if (this.discountGuardTitle) this.discountGuardTitle.textContent = title;

    UIComponents.openModal('discount-guard-modal');
    return true;
  }

  updateGlobalDiscountStatus() {
    if (!this.globalDiscountStatus) return;
    const active = this.getGlobalDiscount();
    if (!active) {
      this.globalDiscountStatus.textContent = '';
      this.globalDiscountStatus.classList.remove('is-active', 'is-visible');
      return;
    }

    const value = active.type === 'percent'
      ? `${this.formatNumber(active.amount, { fractionDigits: 0 })}٪`
      : `${this.formatNumber(active.amount, { fractionDigits: 0 })} تومان`;
    const time = this.formatRemainingTime(active.expiresAt);
    const excludedCount = Array.isArray(active.excludedCustomerIds) ? active.excludedCustomerIds.length : 0;
    const excludedLabel = excludedCount ? ` • لغو برای ${this.formatNumber(excludedCount)} مشتری` : '';
    this.globalDiscountStatus.textContent = `فعال (${value}${time ? ` • ${time}` : ''}${excludedLabel})`;
    this.globalDiscountStatus.classList.add('is-active', 'is-visible');
  }

  excludeCustomerFromGlobal(customerId) {
    const active = this.getGlobalDiscount();
    if (!active || !customerId) {
      UIComponents.showToast('تخفیف همگانی فعالی یافت نشد.', 'warning');
      return;
    }

    const exclusions = new Set((active.excludedCustomerIds || []).map(String));
    exclusions.add(String(customerId));

    this.discountStore.upsert({ ...active, excludedCustomerIds: Array.from(exclusions) });
    UIComponents.showToast('تخفیف همگانی برای این مشتری غیرفعال شد.', 'info');
    this.updateGlobalDiscountStatus();
    this.renderCustomers(this.currentCustomerQuery || '');
    this.renderDiscounts();
    this.updateDiscountAnalytics();
  }

  restoreCustomerGlobalDiscount(customerId) {
    const active = this.getGlobalDiscount();
    if (!active || !customerId) {
      UIComponents.showToast('تخفیف همگانی فعالی یافت نشد.', 'warning');
      return;
    }

    const exclusions = new Set((active.excludedCustomerIds || []).map(String));
    exclusions.delete(String(customerId));

    this.discountStore.upsert({ ...active, excludedCustomerIds: Array.from(exclusions) });
    UIComponents.showToast('تخفیف همگانی برای این مشتری دوباره فعال شد.', 'success');
    this.updateGlobalDiscountStatus();
    this.renderCustomers(this.currentCustomerQuery || '');
    this.renderDiscounts();
    this.updateDiscountAnalytics();
  }

  hideGlobalDiscountSuccess() {
    if (!this.globalDiscountSuccess) return;
    this.globalDiscountSuccess.classList.remove('is-visible');
    clearTimeout(this.globalDiscountSuccessTimer);
    this.globalDiscountSuccessTimer = setTimeout(() => {
      if (this.globalDiscountSuccess) this.globalDiscountSuccess.hidden = true;
    }, 200);
  }

  showGlobalDiscountSuccess(discount) {
    if (!this.globalDiscountSuccess) return;
    const amountLabel = discount.type === 'percent'
      ? `${this.formatNumber(discount.amount, { fractionDigits: 0 })}٪`
      : `${this.formatNumber(discount.amount, { fractionDigits: 0 })} تومان`;
    const expiryRelative = discount.expiresAt ? this.formatRemainingTime(discount.expiresAt) : '';
    const expiryLabel = expiryRelative
      ? `اعتبار: ${expiryRelative}`
      : (discount.expiresAt ? `اعتبار تا ${UIComponents.formatRelativeDate(discount.expiresAt)}` : 'بدون زمان انقضا');
    const noteLabel = discount.note || 'پیشنهاد فعال برای همه مشتریان ثبت شد.';
    const descLabel = discount.couponCode
      ? `کد ${discount.couponCode} برای همه مشتریان فعال شد.`
      : 'پیشنهاد شما برای همه مشتریان ثبت شد.';

    if (this.globalDiscountSuccessAmount) this.globalDiscountSuccessAmount.textContent = amountLabel;
    if (this.globalDiscountSuccessExpiry) this.globalDiscountSuccessExpiry.textContent = expiryLabel;
    if (this.globalDiscountSuccessNote) this.globalDiscountSuccessNote.textContent = noteLabel;
    if (this.globalDiscountSuccessDescription) this.globalDiscountSuccessDescription.textContent = descLabel;

    this.globalDiscountSuccess.hidden = false;
    requestAnimationFrame(() => this.globalDiscountSuccess?.classList.add('is-visible'));
    clearTimeout(this.globalDiscountSuccessTimer);
    this.globalDiscountSuccessTimer = null;
  }

  openGlobalDiscountConfirm() {
    const active = this.getGlobalDiscount();
    const hasActive = Boolean(active);
    const amountLabel = active
      ? (active.type === 'percent'
        ? `${this.formatNumber(active.amount)}٪`
        : `${this.formatNumber(active.amount)} تومان`)
      : '';
    const expiryLabel = active?.expiresAt ? UIComponents.formatRelativeDate(active.expiresAt) : '';

    if (this.globalDiscountConfirmTitle) {
      this.globalDiscountConfirmTitle.textContent = hasActive ? 'حذف تخفیف همگانی فعال؟' : 'تخفیف همگانی فعال نیست';
    }

    if (this.globalDiscountConfirmSubtitle) {
      this.globalDiscountConfirmSubtitle.textContent = hasActive
        ? 'تخفیف همگانی برای همه مشتریان فعال است. از حذف آن مطمئن هستید؟'
        : 'در حال حاضر هیچ تخفیف همگانی فعالی ثبت نشده است.';
    }

    if (this.globalDiscountConfirmDetails) {
      this.globalDiscountConfirmDetails.innerHTML = hasActive
        ? `تخفیف <strong>${amountLabel}</strong> برای تمام مشتریان شما فعال است ${expiryLabel ? `• تا ${expiryLabel}` : ''}. با حذف این مورد، همه مشتریان به حالت بدون تخفیف برمی‌گردند.`
        : 'برای حذف، ابتدا باید یک تخفیف همگانی فعال داشته باشید.';
    }

    if (this.globalDiscountConfirmAccept) {
      this.globalDiscountConfirmAccept.disabled = !hasActive;
      this.globalDiscountConfirmAccept.setAttribute('aria-disabled', (!hasActive).toString());
      this.globalDiscountConfirmAccept.textContent = hasActive ? 'بله، حذف شود' : 'باشه';
    }

    if (!hasActive) {
      UIComponents.showToast('هیچ تخفیف همگانی فعال نیست.', 'info');
    }

    UIComponents.openModal('global-discount-confirm-modal');
  }

  handleGlobalDiscountSubmit() {
    if (!this.globalDiscountForm) return;
    if (this.getGlobalDiscount()) {
      this.showDiscountGuardModal('global');
      return;
    }
    const type = Array.from(this.globalDiscountTypeInputs || []).find(input => input.checked)?.value || 'amount';
    const amount = Number(this.globalDiscountAmount?.value || 0);
    const note = (this.globalDiscountNoteInput?.value || '').trim();
    const customDate = this.globalDiscountCustomDate?.value || '';
    const couponCode = (this.globalDiscountCouponInput?.value || '').trim();

    if (type === 'percent') {
      if (!Number.isFinite(amount) || amount <= 0 || amount > 90) {
        UIComponents.showToast('درصد تخفیف باید بین ۱ تا ۹۰ باشد.', 'error');
        return;
      }
    } else if (!Number.isFinite(amount) || amount < 500) {
      UIComponents.showToast('مبلغ تخفیف همگانی باید حداقل ۵۰۰ تومان باشد.', 'error');
      return;
    }

    const duration = Array.from(this.globalDiscountDurationInputs || []).find(input => input.checked)?.value || 'week';
    if (duration === 'custom' && !customDate) {
      UIComponents.showToast('تاریخ انقضای تخفیف همگانی را وارد کنید.', 'error');
      return;
    }

    const parsedCustomDate = duration === 'custom' ? this.parseDiscountDateInput(customDate) : null;
    if (duration === 'custom' && !parsedCustomDate) {
      UIComponents.showToast('تاریخ شمسی واردشده برای تخفیف همگانی معتبر نیست.', 'error');
      return;
    }

    const expiresAt = duration === 'custom'
      ? (() => { const d = parsedCustomDate; d.setHours(23, 59, 0, 0); return d.toISOString(); })()
      : this.calculateDiscountExpiry(duration);
    const noteLabel = duration === 'custom'
      ? this.formatCustomExpiryLabel(customDate)
      : this.getDiscountDurationLabel(duration);

    const discount = {
      id: this.GLOBAL_DISCOUNT_ID,
      customerId: this.GLOBAL_CUSTOMER_ID,
      customerName: 'تمام مشتریان',
      customerPhone: '',
      amount,
      type,
      createdAt: new Date().toISOString(),
      expiresAt,
      note: note || noteLabel,
      couponCode: couponCode || undefined,
      isGlobal: true,
      excludedCustomerIds: []
    };

    this.discountStore.upsert(discount);
    this.showGlobalDiscountSuccess(discount);
    this.globalDiscountForm.reset();
    const today = this.globalDiscountForm.querySelector('input[name="global-discount-duration"][value="today"]');
    if (today) today.checked = true;
    if (this.globalDiscountCustomDate) this.globalDiscountCustomDate.value = '';
    this.updateGlobalDurationState('today');
    if (this.globalDiscountCouponInput) this.globalDiscountCouponInput.value = '';
    this.updateGlobalDiscountType(type);
    this.updateGlobalDiscountStatus();
    this.renderDiscounts();
    this.renderCustomers(this.currentCustomerQuery || '');
  }

  clearGlobalDiscount() {
    this.discountStore.remove(this.GLOBAL_DISCOUNT_ID);
    this.updateGlobalDiscountStatus();
    this.renderDiscounts();
    this.renderCustomers(this.currentCustomerQuery || '');
    UIComponents.showToast('تخفیف همگانی حذف شد.', 'info');
  }

  confirmClearGlobalDiscount() {
    const active = this.getGlobalDiscount();
    if (!active) {
      UIComponents.showToast('هیچ تخفیف همگانی فعال نیست.', 'info');
      UIComponents.closeModal('global-discount-confirm-modal');
      return;
    }

    this.clearGlobalDiscount();
    UIComponents.closeModal('global-discount-confirm-modal');
  }

  handleDiscountSubmit() {
    if (!this.discountForm || !this.discountCustomerSelect) return;
    if (this.getGlobalDiscount()) {
      this.showDiscountGuardModal('personal');
      return;
    }
    const customerId = this.discountCustomerSelect.value;
    if (!customerId) {
      UIComponents.showToast('لطفاً یک مشتری را انتخاب کنید.', 'error');
      return;
    }

    const selectedType = Array.from(this.discountTypeInputs || []).find(input => input.checked)?.value || 'amount';
    const amount = Number(this.discountAmountInput?.value || 0);
    if (selectedType === 'percent') {
      if (!Number.isFinite(amount) || amount <= 0 || amount > 90) {
        UIComponents.showToast('درصد تخفیف باید بین ۱ تا ۹۰ باشد.', 'error');
        return;
      }
    } else {
      if (!Number.isFinite(amount) || amount < 1000) {
        UIComponents.showToast('مبلغ تخفیف را حداقل با ۱۰۰۰ تومان وارد کنید.', 'error');
        return;
      }
    }

    const duration = this.getSelectedDiscountDuration();
    const customer = this.getDiscountCustomers().find(c => String(c.id) === String(customerId)) || {};
    const note = (this.discountNoteInput?.value || '').trim();
    const manualExpiry = (this.discountExpiryInput?.value || '').trim();
    const parsedManualExpiry = manualExpiry ? this.parseDiscountDateInput(manualExpiry) : null;

    if (duration === 'custom' && !manualExpiry) {
      UIComponents.showToast('تاریخ انقضا را وارد کنید.', 'error');
      return;
    }

    if (manualExpiry && !parsedManualExpiry) {
      UIComponents.showToast('تاریخ واردشده معتبر نیست. لطفاً یک تاریخ شمسی مانند ۱۴۰۴/۰۸/۲۵ وارد کنید.', 'error');
      return;
    }

    const expiresAt = manualExpiry
      ? (() => { const d = parsedManualExpiry; d.setHours(23, 59, 0, 0); return d.toISOString(); })()
      : this.calculateDiscountExpiry(duration);
    const noteLabel = manualExpiry ? this.formatCustomExpiryLabel(manualExpiry) : this.getDiscountDurationLabel(duration);

    const discount = {
      id: crypto.randomUUID ? crypto.randomUUID() : `disc-${Date.now()}`,
      customerId,
      customerName: customer.name || 'مشتری',
      customerPhone: customer.phone || '',
      amount,
      type: selectedType,
      createdAt: new Date().toISOString(),
      expiresAt,
      note: note || noteLabel
    };

    this.discountStore.upsert(discount);
    UIComponents.showToast('تخفیف برای مشتری ثبت شد.', 'success');
    this.discountForm.reset();
    const todayOption = this.discountForm.querySelector('input[name="discount-duration"][value="today"]');
    if (todayOption) todayOption.checked = true;
    this.refreshDiscountCustomers(customerId);
    this.renderDiscounts();
  }

  updateDiscountStats(active = []) {
    const today = new Date().toDateString();
    const expiringToday = active.filter(d => new Date(d.expiresAt).toDateString() === today).length;
    const amountOnly = active.filter(d => d.type !== 'percent');
    const totalValue = amountOnly.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const average = amountOnly.length ? totalValue / amountOnly.length : 0;
    const activeGlobal = active.filter(d => d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID).length;
    const personalCount = Math.max(0, active.length - activeGlobal);
    const upcoming = active
      .map(d => ({
        date: new Date(d.expiresAt),
        isGlobal: d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID
      }))
      .filter(item => !Number.isNaN(item.date?.getTime?.()))
      .sort((a, b) => a.date - b.date)[0];
    const nextExpiry = upcoming?.date;
    const nextExpiryText = nextExpiry
      ? `${UIComponents.formatRelativeDate(nextExpiry)}${upcoming.isGlobal ? ' • تخفیف همگانی' : ''}`
      : 'بدون موعد فعال';

    const setStat = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        el.dataset.value = value;
        el.textContent = this.formatNumber(value, { fractionDigits: 0, fallback: '۰' });
        UIComponents.animateCountUp?.(el);
      }
    };

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value;
      }
    };

    setStat('discount-active-count', active.length);
    setStat('discount-active-count-inline', active.length);
    setStat('discount-expiring-today', expiringToday);
    setStat('discount-expiring-inline', expiringToday);
    setStat('discount-total-value', totalValue);
    setStat('discount-average', average);
    setStat('discount-summary-active', active.length);
    setStat('discount-summary-expiring', expiringToday);
    setStat('discount-summary-total', totalValue);
    setStat('discount-summary-average', average);
    setStat('discount-summary-global', activeGlobal);
    setStat('discount-summary-personal', personalCount);

    setText('discount-summary-next-expiry', nextExpiryText);
    setText('discount-summary-status', active.length
      ? `${this.formatNumber(active.length)} تخفیف فعال ${activeGlobal ? ' • شامل تخفیف همگانی' : ''}`.trim()
      : 'بدون تخفیف فعال');
  }

  renderDiscounts() {
    const listEl = document.getElementById('discounts-list');
    const emptyEl = document.getElementById('discounts-empty');
    if (!listEl || !emptyEl) return;

    const customers = this.getDiscountCustomers();
    const customerMap = new Map(customers.map(c => [String(c.id), c]));
    const active = this.discountStore.getActive().map(item => {
      if (item.isGlobal || item.customerId === this.GLOBAL_CUSTOMER_ID) {
        return {
          ...item,
          customerName: 'تخفیف همگانی',
          customerPhone: 'روی همه مشتریان',
          isGlobal: true
        };
      }
      const info = customerMap.get(String(item.customerId));
      if (info) {
        return {
          ...item,
          customerName: item.customerName || info.name,
          customerPhone: item.customerPhone || info.phone,
          lastReservation: item.lastReservation || info.lastReservation
        };
      }
      return item;
    }).sort((a, b) => (a.isGlobal ? -1 : 1));

    this.updateDiscountStats(active);

    if (!active.length) {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    listEl.innerHTML = active.map(d => {
      const remaining = this.formatRemainingTime(d.expiresAt);
      const note = d.note ? `<div class="meta">${escapeHtml(d.note)}</div>` : '';
      const coupon = d.couponCode ? `<div class="meta meta-highlight">کد تخفیف: ${escapeHtml(d.couponCode)}</div>` : '';
      const lastVisit = d.lastReservation && !d.isGlobal ? ` • آخرین مراجعه: ${UIComponents.formatRelativeDate(d.lastReservation)}` : '';
      const valueText = d.type === 'percent'
        ? `${UIComponents.formatPersianNumber(d.amount)}٪`
        : this.formatToman(d.amount);
      const valueLabel = d.isGlobal ? 'تخفیف همگانی' : (d.type === 'percent' ? 'درصدی' : 'مبلغ');
      const metaLine = d.isGlobal
        ? (() => {
          const excludedCount = Array.isArray(d.excludedCustomerIds) ? d.excludedCustomerIds.length : 0;
          const appliedCount = Math.max((customers?.length || 0) - excludedCount, 0);
          const appliedLabel = appliedCount ? `${this.formatNumber(appliedCount)} مشتری` : 'بدون مشتری فعال';
          const excludedLabel = excludedCount ? ` • لغو برای ${this.formatNumber(excludedCount)} نفر` : '';
          return `اعمال شده روی ${appliedLabel}${excludedLabel}`;
        })()
        : `${UIComponents.formatPersianNumber(d.customerPhone || '')}${lastVisit}`;
      const badge = d.isGlobal ? '<span class="status-badge status-active">همگانی</span>' : '';

      return `
        <article class="discount-card" role="listitem">
          <div class="discount-card__avatar" aria-hidden="true">${escapeHtml((d.isGlobal ? '٪' : d.customerName?.charAt(0)) || 'م')}</div>
          <div class="discount-card__body">
            <div class="name">${escapeHtml(d.customerName || 'مشتری')} ${badge}</div>
            <div class="meta">${metaLine}</div>
            ${coupon}
            ${note}
          </div>
          <div class="discount-card__amount">
            <span class="label">${valueLabel}</span>
            <span class="value">${valueText}</span>
            <span class="expires">${this.formatDateTime(d.expiresAt)} • ${remaining}</span>
          </div>
          <div class="discount-card__actions">
            <button type="button" class="btn-text" data-action="cancel-discount" data-id="${d.id}">${d.isGlobal ? 'لغو همگانی' : 'لغو'}</button>
          </div>
        </article>
      `;
    }).join('');

    this.updateDiscountAnalytics();
  }

  openDiscountAnalyticsModal() {
    this.updateDiscountAnalytics();
    UIComponents.openModal('discount-analytics-modal');
  }

  updateDiscountAnalytics() {
    const updateNumber = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.dataset.value = value;
      el.textContent = this.formatNumber(value, { fallback: '۰' });
      UIComponents.animateCountUp?.(el);
    };

    const allDiscounts = this.discountStore?.load?.() || [];
    const active = this.discountStore?.getActive?.() || [];
    const personal = active.filter(d => !(d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID));
    const global = active.filter(d => d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID);
    const now = new Date();
    const expiringSoon = active.filter(d => {
      const expiry = new Date(d.expiresAt);
      const diff = expiry - now;
      return diff > 0 && diff <= 72 * 60 * 60 * 1000;
    }).length;

    const sortedByExpiry = [...active].sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));
    const nextExpiry = sortedByExpiry[0];
    const nextExpiryLabel = nextExpiry ? UIComponents.formatRelativeDate(nextExpiry.expiresAt) : 'بدون تخفیف فعال';

    const usageNames = personal.map(d => d.customerName || 'مشتری').filter(Boolean);
    const usagePreview = usageNames.length
      ? `${usageNames.slice(0, 3).join('، ')}${usageNames.length > 3 ? ' و سایر مشتریان' : ''}`
      : 'فعلاً مشتری از تخفیف استفاده نکرده است.';

    updateNumber('discount-insights-total', allDiscounts.length);
    updateNumber('discount-insights-active', active.length);
    updateNumber('discount-insights-expiring', expiringSoon);
    if (this.discountInsightsNextExpiry) this.discountInsightsNextExpiry.textContent = nextExpiryLabel;
    if (this.discountInsightsUsage) this.discountInsightsUsage.textContent = usagePreview;

    updateNumber('discount-analytics-issued', allDiscounts.length);
    updateNumber('discount-analytics-active', active.length);
    updateNumber('discount-analytics-global', global.length);
    updateNumber('discount-analytics-personal', personal.length);
    updateNumber('discount-analytics-expiring', expiringSoon);
    if (this.discountAnalyticsNextExpiry) this.discountAnalyticsNextExpiry.textContent = nextExpiryLabel;
    if (this.discountAnalyticsUsage) this.discountAnalyticsUsage.textContent = usagePreview;

    if (!this.discountAnalyticsList || !this.discountAnalyticsEmpty) return;

    if (!active.length) {
      this.discountAnalyticsList.innerHTML = '';
      this.discountAnalyticsEmpty.hidden = false;
      return;
    }

    this.discountAnalyticsEmpty.hidden = true;
    this.discountAnalyticsList.innerHTML = sortedByExpiry.map((d) => {
      const amountLabel = d.type === 'percent'
        ? `${this.formatNumber(d.amount)}٪`
        : `${this.formatNumber(d.amount)} تومان`;
      const expiryLabel = UIComponents.formatRelativeDate(d.expiresAt);
      const createdLabel = UIComponents.formatRelativeDate(d.createdAt);
      const target = d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID
        ? 'تخفیف همگانی'
        : escapeHtml(d.customerName || 'مشتری');
      const badge = d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID ? 'همگانی' : 'اختصاصی';
      const note = d.note ? escapeHtml(d.note) : 'بدون یادداشت';
      const canCancel = !(d.isGlobal || d.customerId === this.GLOBAL_CUSTOMER_ID);
      const cancelAction = canCancel
        ? `<button type="button" class="btn-ghost-sm btn-ghost-sm--danger" data-action="cancel-discount" data-id="${escapeHtml(d.id)}">لغو تخفیف</button>`
        : '<span class="pill pill--muted">غیرفعال‌سازی فردی امکان‌پذیر نیست</span>';
      const manageAction = canCancel
        ? `<button type="button" class="btn-ghost-sm" data-action="open-discount-modal" data-customer-id="${escapeHtml(d.customerId)}" data-customer-name="${escapeHtml(d.customerName || 'مشتری')}" data-customer-phone="${escapeHtml(d.customerPhone || '')}">مدیریت</button>`
        : `<button type="button" class="btn-ghost-sm" data-action="open-global-discount-confirm">حذف همگانی</button>`;

      return `
        <article class="discount-analytics-item" role="listitem">
          <div class="discount-analytics-item__avatar" aria-hidden="true">${escapeHtml((d.isGlobal ? '٪' : (d.customerName || 'م')[0]))}</div>
          <div class="discount-analytics-item__body">
            <div class="discount-analytics-item__header">
              <div>
                <h4 class="discount-analytics-item__title">${target}</h4>
                <p class="discount-analytics-item__meta">${badge} • ثبت ${createdLabel}</p>
              </div>
              <div class="discount-analytics-item__amount">${amountLabel}</div>
            </div>
            <div class="discount-analytics-item__footer">
              <span class="pill">انقضا: ${expiryLabel}</span>
              <span class="pill pill--muted">${note}</span>
              <div class="discount-analytics-item__actions">
                ${manageAction}
                ${cancelAction}
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  handleDiscountCancellation(discountId, { analyticsContext = false, customerContext = false } = {}) {
    if (!discountId) return;
    const active = this.discountStore.getActive();
    const target = active.find(d => d.id === discountId);
    if (!target) {
      UIComponents.showToast('تخفیفی برای لغو یافت نشد.', 'warning');
      return;
    }

    this.discountStore.remove(discountId);

    const toastContext = analyticsContext
      ? 'از آمار تخفیف‌ها حذف شد.'
      : (customerContext ? 'برای این مشتری غیرفعال شد.' : 'لغو شد.');
    UIComponents.showToast(`تخفیف ${toastContext}`, 'info');

    this.renderDiscounts();
    this.renderCustomers(this.currentCustomerQuery || '');
    if (analyticsContext) {
      this.updateDiscountAnalytics();
    }
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
      cancelled: last && last.cancelledBy === 'customer' ? 'لغو شده توسط مشتری' : 'لغو شده'
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
      persistBookings();
      delete bookedCache[last.dateISO];
      const modal = document.getElementById('resv-modal');
      if (modal && !modal.hidden) renderTimes();
      Notifications?.add(`نوبت ${customer.name} تایید شد`, 'booking');

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
      persistBookings();
      delete bookedCache[last.dateISO];
      const modal = document.getElementById('resv-modal');
      if (modal && !modal.hidden) renderTimes();
      Notifications?.add(`نوبت ${customer.name} لغو شد`, 'booking');

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
async updateDashboardStats() {
  try {
    await this.loadDashboardStats(true);
  } catch (err) {
    console.error('updateDashboardStats failed', err);
  }
}





applyBrandImages(){
  const root = document.documentElement;
  root.style.setProperty('--footer-image', this.brandImages.footer ? `url("${this.brandImages.footer}")` : 'none');

  const footerImg = document.getElementById('footer-preview');
  if (footerImg) {
    if (this.brandImages.footer) footerImg.src = this.brandImages.footer;
    else footerImg.removeAttribute('src');
  }
}

bindFooterImageEvents(){
  const footerPick   = document.getElementById('footer-pick-btn');
  const footerFile   = document.getElementById('footer-file');
  const footerRemove = document.getElementById('footer-remove-btn');

  if (footerPick && footerFile){
    footerPick.addEventListener('click', () => footerFile.click());
    footerFile.addEventListener('change', (e) => this._handleFooterUpload(e));
  }
  if (footerRemove){
    footerRemove.addEventListener('click', () => this._removeFooterImage());
  }
}

_handleFooterUpload(evt) {
    const file = evt.target.files && evt.target.files[0];
    if (!file) return;

    const previousFooter = this.brandImages.footer;
    // Use a temporary object URL for instant preview
    const tempPreviewUrl = URL.createObjectURL(file);
    this.brandImages.footer = tempPreviewUrl;
    this.applyBrandImages();

    const formData = new FormData();
    formData.append('image', file);

    // FIX: Use XHR instead of fetch to bypass __security.js interceptors
    // that might be corrupting the Content-Type header or FormData.
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/branding/footer`, true);
    xhr.withCredentials = true; // Important for cookies/sessions

    xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const data = JSON.parse(xhr.responseText);
                this.brandImages.footer = data.url || '';
                this.applyBrandImages();
                UIComponents.showToast('تصویر فوتر ذخیره شد.', 'success');
            } catch (e) {
                console.error('JSON Parse Error:', e);
                revert();
            }
        } else {
            console.error('Upload failed with status:', xhr.status);
            revert();
        }
        URL.revokeObjectURL(tempPreviewUrl);
    };

    xhr.onerror = () => {
        console.error('XHR Network Error');
        revert();
        URL.revokeObjectURL(tempPreviewUrl);
    };

    const revert = () => {
        this.brandImages.footer = previousFooter;
        this.applyBrandImages();
        UIComponents.showToast('خطا در آپلود تصویر.', 'error');
    };

    xhr.send(formData);
}

_removeFooterImage(){
  fetch(`${API_BASE}/api/branding/footer`, {
    method:'DELETE',
    credentials:'include'
  }).catch(()=>{});
  this.brandImages.footer = '';
  this.applyBrandImages();
  UIComponents.showToast('تصویر فوتر حذف شد.', 'info');
}

  // === END OF NEW METHODS ===
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

  // Working hours
  const startEl = document.getElementById('work-start');
  if (startEl && sellerData.startTime) {
    startEl.value = sellerData.startTime;
  }
  const endEl = document.getElementById('work-end');
  if (endEl && sellerData.endTime) {
    endEl.value = sellerData.endTime;
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

let featureFlags = { ...DEFAULT_FEATURE_FLAGS };
try {
  const rawFlags = await API.getFeatureFlags();
  featureFlags = normalizeFeatureFlags(rawFlags || {});
} catch (err) {
  console.warn('feature flags fetch failed', err);
  featureFlags = { ...DEFAULT_FEATURE_FLAGS };
}

featureFlags = applySellerPlanFeatureFlags(featureFlags);
window.__FEATURE_FLAGS__ = featureFlags;

await loadSellerPlans();

await loadComplimentaryPlan();

const app = new SellerPanelApp(featureFlags);
window.sellerPanelApp = app; // Expose to window for global access
app.init();
if (typeof app.initBrandImages === 'function') app.initBrandImages();

app.loadTopPeers().catch(err => console.warn('initial top peers load failed', err));

loadCustomers();



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
  const KEY = 'vit_resv_schedule'; // legacy key, no localStorage usage

  const faDigits = '۰۱۲۳۴۵۶۷۸۹', enDigits = '0123456789';
  const toFa = (s) => (s + '').replace(/[0-9]/g, (d) => faDigits[d]);
  const toEn = (s) => (s + '').replace(/[۰-۹]/g, (d) => enDigits[faDigits.indexOf(d)]);
    const pad2 = (n) => String(n).padStart(2, '0');
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


  // state + storage from server
  const state = {
    selectedIdx: 0,
    selectedService: '',
    schedule: { '6': [], '0': [], '1': [], '2': [], '3': [], '4': [], '5': [] }
  };

  // Load seller services into dropdown
  window.loadServicesDropdown = async function loadServicesDropdown() {
    const dropdown = el('resv-service-dropdown');
    if (!dropdown) return;

    try {
      // Try to get services from cache, API, then local storage fallback
      let services = [];

      if (Array.isArray(window.sellerServices) && window.sellerServices.length) {
        services = window.sellerServices;
      } else {
        try {
          const res = await fetch(`${API_BASE}/api/seller-services/me/services`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            services = Array.isArray(data) ? data : (data.services || []);
          }
        } catch (networkErr) {
          console.warn('Service dropdown API failed, using cached data if available', networkErr);
        }

        if (!services.length) {
          const cachedServices = StorageManager.get('vit_services');
          if (Array.isArray(cachedServices) && cachedServices.length) {
            services = cachedServices;
          }
        }

        window.sellerServices = services;
      }

      // Clear existing options except first
      dropdown.innerHTML = '<option value="">همه خدمات</option>';

      const uniqueServices = new Map();

      // Add service options
      services.forEach((service, idx) => {
        const name = service.name || service.title || service.serviceName || service.service || '';
        const id = service._id || service.id || service.serviceId || `svc-${idx}`;
        if (name && !uniqueServices.has(id)) {
          uniqueServices.set(id, name);
          const option = document.createElement('option');
          option.value = id;
          option.textContent = name;
          dropdown.appendChild(option);
        }
      });

      if (uniqueServices.size === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'هیچ خدمتی ثبت نشده است';
        option.disabled = true;
        dropdown.appendChild(option);
      }

      // Restore selected service if any
      if (state.selectedService) {
        dropdown.value = state.selectedService;
      }
    } catch (err) {
      console.error('Failed to load services for dropdown', err);
    }
  }

  // Handle service selection change
  function initServiceDropdown() {
    const dropdown = el('resv-service-dropdown');
    if (!dropdown) return;

    dropdown.addEventListener('change', (e) => {
      state.selectedService = e.target.value;
      // Optionally filter times by service
      renderTimes();
    });
  }

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/api/booking-slots/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        state.schedule = Object.assign(state.schedule, data || {});
        cleanScheduleData();
      }
    } catch (e) {
      console.error('load schedule failed', e);
    }
  }

  async function save() {
    try {
      const res = await fetch(`${API_BASE}/api/booking-slots/me`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.schedule)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.message || 'خطا در ذخیره برنامه نوبت‌دهی';
        UIComponents?.showToast?.(msg, 'error');
        return false;
      }
      UIComponents?.showToast?.('نوبت‌ها با موفقیت ذخیره شد.', 'success');
      return true;
    } catch (e) {
      console.error('save schedule failed', e);
      UIComponents?.showToast?.('خطا در ذخیره برنامه نوبت‌دهی', 'error');
      return false;
    }
  }

  function updateDayIndicators() {
    const bookings = window.MOCK_DATA?.bookings || [];
    // Support both old (.resv-day-chip) and new (.resv-day-btn) selectors
    const chips = document.querySelectorAll('#resv-week .resv-day-btn, #resv-week .resv-day-chip');
    chips.forEach(chip => {
      const day = parseInt(chip.dataset.day, 10);
      chip.classList.remove('has-pending', 'has-cancelled');
      const dayBookings = bookings.filter(b => {
        const raw = b.dateISO || toEn((b.date || '').split(' ')[0]).replace(/\//g, '-');
        const d = new Date(raw);
        return !isNaN(d) && d.getDay() === day;
      });
      if (dayBookings.some(b => b.status === 'pending')) {
        chip.classList.add('has-pending');
      } else if (dayBookings.some(b => b.status === 'cancelled')) {
        chip.classList.add('has-cancelled');
      }
    });
  }
  window.updateResvDayIndicators = updateDayIndicators;

  // open modal
  async function openModal() {
    await load();
    try {
      const bookings = await API.getBookings();
      const localBookings = JSON.parse(localStorage.getItem('vitreenet-bookings') || '[]');
      if (Array.isArray(bookings) && bookings.length) {
        const statusMap = new Map(localBookings.map(b => [(b._id || b.id), b.status]));
        MOCK_DATA.bookings = bookings.map(b => ({
          ...b,
          date: b.bookingDate || b.date || '',
          dateISO: b.dateISO || b.bookingDate || b.date || '',
          status: statusMap.get(b._id || b.id) || b.status || 'pending'
        }));
      } else if (localBookings.length) {
        MOCK_DATA.bookings = localBookings.map(b => ({
          id: b.id || Date.now() + Math.random(),
          customerName: b.name || b.customerName || '',
          service: b.service || '',
          date: b.date || '',
          dateISO: b.dateISO || '',
          time: b.time || '',
          status: b.status || 'pending'
        }));
      }
      persistBookings();
    } catch (err) {
      if (err?.status === 401) {
        window.location.href = 'login.html';
        return;
      }
      if (err?.status === 403) {
        markSellerBlocked([{ source: 'bookings', message: err.uiMessage || err.message }]);
        return;
      }
      console.error('FETCH_BOOKINGS_FAILED', err);
    }

    Object.keys(bookedCache).forEach(k => delete bookedCache[k]);

    // Load seller services into dropdown
    await loadServicesDropdown();

    UIComponents.openModal('resv-modal');
    updateTodayBanner();
    scheduleMidnightTick();
    // Select today's weekday by default
    const todayJS = new Date().getDay();
    const idx = PERSIAN_WEEKDAYS.findIndex((w) => w.js === todayJS);
    selectDay(Math.max(0, idx));
    updateDayIndicators();
  }

  // tabs (weekdays)
  function selectDay(idx) {
    state.selectedIdx = idx;
    $$('#resv-week .resv-day-btn, #resv-week .resv-day-chip').forEach((b, i) => b.classList.toggle('active', i === idx));
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

function currentDayISO() {
  const weekStart = getWeekStartSaturday(new Date());
  const d = new Date(weekStart);
  d.setDate(weekStart.getDate() + state.selectedIdx);
  const pad2 = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

  async function fetchBookedTimes(dateISO) {
    if (bookedCache[dateISO]) return bookedCache[dateISO];

    const seller = JSON.parse(localStorage.getItem('seller') || '{}');
    const sid = seller.id || seller._id;
    if (!sid) {
      bookedCache[dateISO] = new Set();
      return bookedCache[dateISO];
    }

    try {
      const res = await fetch(`${API_BASE}/api/booked-slots/${encodeURIComponent(sid)}?date=${encodeURIComponent(dateISO)}`, { credentials: 'include' });
      if (!res.ok) throw new Error('fail');
      const data = await res.json();
      bookedCache[dateISO] = new Set((data.times || []).map(normalizeTime));
    } catch (e) {
      console.error('fetch booked times failed', e);
      bookedCache[dateISO] = new Set();
    }
    return bookedCache[dateISO];
  }

  // compute slot status from MOCK_DATA + CustomerPrefs (فقط برای نمایش؛ در ذخیره‌سازی وضعیت نداریم)
  function getTimeSlotStatus(time, dateISO) {
    const bookings = (window.MOCK_DATA?.bookings || []);
    const prefs = window.CustomerPrefs ? CustomerPrefs.load() : {};
    const keyFor = (name) => (window.normalizeKey ? normalizeKey(name) : (name||'').toLowerCase());

    const sameTime = bookings.filter(b => {
      const bTime = normalizeTime(toEn(b.time));
      const tMatch = bTime === normalizeTime(time);
      const rawDate = b.dateISO || toEn((b.date || '').split(' ')[0]).replace(/\//g, '-');
      const bDate = rawDate.split('T')[0];
      return tMatch && (!dateISO || bDate === dateISO);
    });
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
  async function renderTimes() {
    const wrap = el('resv-times');
    const dayKey = String(PERSIAN_WEEKDAYS[state.selectedIdx].js);
    const times = [...(state.schedule[dayKey] || [])].sort();
    const dateISO = currentDayISO();
    const booked = await fetchBookedTimes(dateISO);

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
      let st = getTimeSlotStatus(t, dateISO);
      if (booked.has(normalizeTime(t))) st = 'booked';
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

    const dateISO = currentDayISO();
    const st = getTimeSlotStatus(t, dateISO);
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

// cleaning is triggered after schedule load


// --- Force 24h input and allow flexible hour format
  function enforce24hTimeInput(id) {
    const input = document.getElementById(id);
    if (!input) return;

    input.type = 'text';
    input.setAttribute('inputmode', 'numeric');
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

    const initVal = normalizeTime(input.value);
    if (initVal) input.value = toFa(initVal);
  }

  // wire up
  (function initReservationUI() {
    // بازکردن مودال
    window.openResvModal = openModal;
    el('open-reservations-btn')?.addEventListener('click', openModal);

    // تب‌های روزهای هفته
    $$('#resv-week .resv-day-btn, #resv-week .resv-day-chip').forEach((b, i) => b.addEventListener('click', () => selectDay(i)));

    // انتخاب خدمت
    initServiceDropdown();

    // افزودن/حذف ساعت
    el('resv-add-btn')?.addEventListener('click', addTime);
    el('resv-time-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTime(); } });
    el('resv-times')?.addEventListener('click', handleDeleteClick);

    // کپی برنامه
    el('resv-copy-open')?.addEventListener('click', openCopy);
    el('resv-copy-cancel')?.addEventListener('click', cancelCopy);
    el('resv-copy-apply')?.addEventListener('click', applyCopy);

    // ذخیره
    el('resv-save')?.addEventListener('click', () => { save(); });

    // ورودی ۲۴ساعته
    enforce24hTimeInput('resv-time-input');
    enforce24hTimeInput('work-start');
    enforce24hTimeInput('work-end');
  })();
})();


});





window.customersData = window.customersData || [];

/* =========================================
   Advertising Plans Modal & Checkout
   ========================================= */
(function initAdsModal() {
  const modal = document.getElementById('ads-modal');
  const checkoutModal = document.getElementById('ads-checkout-modal');
  const openBtn = document.getElementById('open-ads-modal-btn');
  const notificationFab = document.querySelector('.notification-fab');

  if (!modal || !checkoutModal || !openBtn) return;

  // Get wallet balance from dashboard (synced with main wallet card)
  const getWalletBalance = () => {
    const walletEl = document.getElementById('wallet-balance');
    if (!walletEl) return 3500000; // Default value
    
    // Extract numeric value from Persian text like "۳٬۵۰۰٬۰۰۰ تومان"
    const text = walletEl.textContent.trim();
    const numericText = text.replace(/[^۰-۹0-9]/g, '');
    
    // Convert Persian digits to English
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    const englishDigits = '0123456789';
    let englishNumeric = '';
    for (let char of numericText) {
      const index = persianDigits.indexOf(char);
      englishNumeric += index !== -1 ? englishDigits[index] : char;
    }
    
    return parseInt(englishNumeric, 10) || 3500000;
  };

  // Format number to Persian with comma separator
  const formatPersianNumber = (num) => {
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return formatted.split('').map(char => {
      if (char >= '0' && char <= '9') {
        return persianDigits[parseInt(char)];
      }
      return char;
    }).join('');
  };

  // Update wallet balance displays
  const updateWalletDisplays = () => {
    const balance = getWalletBalance();
    const formattedBalance = formatPersianNumber(balance) + ' تومان';
    
    // Update in ads modal
    const adsWalletEl = document.getElementById('ads-wallet-balance');
    if (adsWalletEl) {
      adsWalletEl.textContent = formattedBalance;
    }
    
    // Update in checkout modal
    const checkoutWalletEl = document.getElementById('checkout-wallet-balance');
    if (checkoutWalletEl) {
      checkoutWalletEl.textContent = formattedBalance;
    }
  };

  // Handle ad plan selection - open checkout modal
  const handleSelectAdPlan = (planData) => {
    const { title, price, duration } = planData;
    const balance = getWalletBalance();
    const priceNum = parseInt(price, 10);
    
    // Update checkout modal content
    document.getElementById('checkout-plan-title').textContent = title;
    document.getElementById('checkout-daily-price').textContent = formatPersianNumber(priceNum) + ' تومان';
    document.getElementById('checkout-duration').textContent = '۱ روز'; // Default 1 day
    document.getElementById('checkout-total').textContent = formatPersianNumber(priceNum) + ' تومان';
    
    // Calculate remaining balance
    const remainingBalance = balance - priceNum;
    const remainingEl = document.getElementById('checkout-remaining');
    const remainingAmountEl = remainingEl?.querySelector('.ads-checkout-wallet__amount');
    
    if (remainingAmountEl) {
      if (remainingBalance < 0) {
        remainingAmountEl.textContent = 'موجودی ناکافی';
        remainingAmountEl.style.color = '#ef4444';
      } else {
        remainingAmountEl.textContent = formatPersianNumber(remainingBalance) + ' تومان';
        remainingAmountEl.style.color = '';
      }
    }
    
    // Close ads modal and open checkout modal
    modal.hidden = true;
    checkoutModal.hidden = false;
    
    // Store plan data for confirmation
    checkoutModal.dataset.planSlug = planData.slug;
    checkoutModal.dataset.planPrice = price;
  };

  // Handle checkout confirmation
  const handleCheckoutConfirm = () => {
    const balance = getWalletBalance();
    const price = parseInt(checkoutModal.dataset.planPrice, 10);
    const slug = checkoutModal.dataset.planSlug;
    
    if (balance < price) {
      showToast('موجودی کیف پول شما کافی نیست', 'error');
      return;
    }
    
    // Close checkout modal
    closeCheckoutModal();
    
    // Check if openAdModal exists (from dashboard-upgrade.js)
    if (typeof window.openAdModal === 'function') {
      window.openAdModal(slug);
    } else {
      // Show success toast
      showToast('درخواست شما با موفقیت ثبت شد. پشتیبانی به زودی با شما تماس خواهد گرفت.', 'success');
    }
  };

  // Show toast notification
  const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = 'ads-toast ads-toast--' + type;
    
    const icon = type === 'success' 
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    
    toast.innerHTML = `${icon}<span>${message}</span>`;
    document.body.appendChild(toast);
    
    // Add styles dynamically if not exists
    if (!document.getElementById('ads-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'ads-toast-styles';
      style.textContent = `
        .ads-toast {
          position: fixed;
          bottom: 100px;
          left: 50%;
          transform: translateX(-50%) translateY(20px);
          color: white;
          padding: 14px 24px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.9rem;
          font-weight: 600;
          z-index: 99999;
          opacity: 0;
          animation: toastIn 0.4s ease forwards, toastOut 0.4s ease 3s forwards;
          max-width: 90vw;
        }
        .ads-toast--success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 10px 40px rgba(16, 185, 129, 0.4);
        }
        .ads-toast--error {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          box-shadow: 0 10px 40px rgba(239, 68, 68, 0.4);
        }
        @keyframes toastIn {
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes toastOut {
          to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
      `;
      document.head.appendChild(style);
    }
    
    setTimeout(() => toast.remove(), 3500);
  };

  // Open ads modal
  const openModal = () => {
    updateWalletDisplays();
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    
    // Hide notification FAB
    if (notificationFab) {
      notificationFab.style.opacity = '0';
      notificationFab.style.pointerEvents = 'none';
      notificationFab.style.transform = 'translateY(20px)';
    }
  };

  // Close ads modal
  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    
    // Show notification FAB
    if (notificationFab) {
      notificationFab.style.opacity = '';
      notificationFab.style.pointerEvents = '';
      notificationFab.style.transform = '';
    }
  };

  // Close checkout modal
  const closeCheckoutModal = () => {
    checkoutModal.hidden = true;
    document.body.classList.remove('no-scroll');
    
    // Show notification FAB
    if (notificationFab) {
      notificationFab.style.opacity = '';
      notificationFab.style.pointerEvents = '';
      notificationFab.style.transform = '';
    }
  };

  // Event listeners - Open ads modal
  openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
  });
  
  // Close ads modal
  modal.querySelectorAll('[data-ads-close]').forEach(el => {
    el.addEventListener('click', closeModal);
  });

  // Close checkout modal
  checkoutModal.querySelectorAll('[data-checkout-close]').forEach(el => {
    el.addEventListener('click', closeCheckoutModal);
  });

  // Checkout confirm button
  const confirmBtn = document.getElementById('ads-checkout-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', handleCheckoutConfirm);
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!checkoutModal.hidden) {
        closeCheckoutModal();
      } else if (!modal.hidden) {
        closeModal();
      }
    }
  });

  // Add click handlers to plan buttons
  modal.querySelectorAll('.ads-plan-card__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const planData = {
        slug: btn.dataset.adSlug,
        title: btn.dataset.adTitle,
        price: btn.dataset.adPrice,
        duration: btn.dataset.adDuration
      };
      handleSelectAdPlan(planData);
    });
  });

  // Expose functions globally if needed
  window.openAdsModal = openModal;
  window.closeAdsModal = closeModal;
})();

/* =========================================
   Notification FAB Hide on Rank Card Visibility
   Hide FAB when user scrolls to rank card section on mobile
   ========================================= */
(function initRankCardFabVisibility() {
  const rankCard = document.getElementById('rank-card');
  const notificationFab = document.querySelector('.notification-fab');
  const dashboardView = document.getElementById('dashboard-view');

  if (!rankCard || !notificationFab) return;

  // Only apply on mobile/tablet screens
  const isMobileViewport = () => window.innerWidth <= 768;

  // Check if dashboard is the active view
  const isDashboardActive = () => {
    if (!dashboardView) return true;
    return !dashboardView.hidden && dashboardView.offsetParent !== null;
  };

  let fabHiddenByRankCard = false;

  // Create intersection observer
  const observerOptions = {
    root: null, // viewport
    rootMargin: '-10% 0px -20% 0px', // Trigger when card is in center of viewport
    threshold: [0.3, 0.6] // Trigger at different visibility levels
  };

  const handleIntersection = (entries) => {
    if (!isMobileViewport()) {
      // On larger screens, always show FAB
      if (fabHiddenByRankCard) {
        notificationFab.classList.remove('is-hidden-by-rank');
        fabHiddenByRankCard = false;
      }
      return;
    }

    if (!isDashboardActive()) {
      // If not on dashboard, show FAB
      if (fabHiddenByRankCard) {
        notificationFab.classList.remove('is-hidden-by-rank');
        fabHiddenByRankCard = false;
      }
      return;
    }

    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
        // Rank card is visible - hide FAB
        if (!fabHiddenByRankCard) {
          notificationFab.classList.add('is-hidden-by-rank');
          fabHiddenByRankCard = true;
        }
      } else {
        // Rank card is not visible - show FAB
        if (fabHiddenByRankCard) {
          notificationFab.classList.remove('is-hidden-by-rank');
          fabHiddenByRankCard = false;
        }
      }
    });
  };

  const observer = new IntersectionObserver(handleIntersection, observerOptions);
  observer.observe(rankCard);

  // Also listen for navigation/page changes
  const handlePageChange = () => {
    if (!isDashboardActive() && fabHiddenByRankCard) {
      notificationFab.classList.remove('is-hidden-by-rank');
      fabHiddenByRankCard = false;
    }
  };

  // Listen for hash changes (page navigation)
  window.addEventListener('hashchange', handlePageChange);

  // Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', handlePageChange);

  // Re-check on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!isMobileViewport() && fabHiddenByRankCard) {
        notificationFab.classList.remove('is-hidden-by-rank');
        fabHiddenByRankCard = false;
      }
    }, 150);
  });

  // MutationObserver to watch for view changes (class or hidden attribute changes)
  const viewObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        handlePageChange();
        break;
      }
    }
  });

  if (dashboardView) {
    viewObserver.observe(dashboardView, {
      attributes: true,
      attributeFilter: ['hidden', 'class', 'aria-hidden']
    });
  }
})();
