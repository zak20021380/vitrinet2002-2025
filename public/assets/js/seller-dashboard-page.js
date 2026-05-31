const API = window.VITRINET_API || {
  buildUrl: path => path,
  ensureCredentials(init = {}) {
    if (init.credentials === undefined) {
      return { ...init, credentials: 'include' };
    }
    return init;
  }
};
const apiFetch = (path, options = {}) => {
  const url = API.buildUrl(path);
  const opts = API.ensureCredentials(options);
  return fetch(url, opts);
};

const SUBSCRIPTION_MODAL_DISMISSED_KEY = 'seller-subscription-expired-dismissed';

function readBodySubscriptionFlag() {
  const flag = document.body?.dataset?.subscriptionExpired;
  if (flag === undefined) return null;
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return null;
}

function shouldShowSubscriptionExpiryModal(seller) {
  try {
    if (sessionStorage.getItem(SUBSCRIPTION_MODAL_DISMISSED_KEY) === '1') {
      return false;
    }
  } catch (err) {
    console.warn('Unable to read subscription modal preference:', err);
  }

  const bodyFlag = readBodySubscriptionFlag();
  if (bodyFlag !== null) {
    return bodyFlag;
  }

  if (!seller) return false;

  if (seller.subscriptionExpired === true) return true;

  const status = (seller.subscriptionStatus || seller.planStatus || seller.plan_state || '')
    .toString()
    .toLowerCase();
  if (status) {
    const expiredStatuses = ['expired', 'inactive', 'ended', 'past_due', 'canceled', 'cancelled'];
    if (expiredStatuses.some(state => status.includes(state))) {
      return true;
    }
  }

  const expiryField =
    seller.subscriptionExpiresAt ||
    seller.subscriptionExpiry ||
    seller.planExpiresAt ||
    seller.planExpiryDate ||
    seller.planExpiration;

  if (expiryField) {
    const expiryDate = new Date(expiryField);
    if (!Number.isNaN(expiryDate.getTime())) {
      return expiryDate.getTime() < Date.now();
    }
  }

  return false;
}

function openSubscriptionExpiryModal() {
  const modal = document.getElementById('subscriptionExpiredModal');
  if (!modal) return;
  modal.classList.add('active');
  const focusTarget = modal.querySelector('[data-focus-default]') || modal;
  requestAnimationFrame(() => {
    focusTarget.focus?.({ preventScroll: true });
  });
}

function closeSubscriptionExpiryModal({ persistDismissal = true } = {}) {
  const modal = document.getElementById('subscriptionExpiredModal');
  if (!modal) return;
  modal.classList.remove('active');
  if (persistDismissal) {
    try {
      sessionStorage.setItem(SUBSCRIPTION_MODAL_DISMISSED_KEY, '1');
    } catch (err) {
      console.warn('Unable to persist subscription modal dismissal:', err);
    }
  }
}

function setupSubscriptionExpiryModal() {
  const modal = document.getElementById('subscriptionExpiredModal');
  if (!modal || modal.dataset.bound === '1') return;

  const dismissBtn = modal.querySelector('[data-action="dismiss"]');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => closeSubscriptionExpiryModal({ persistDismissal: true }));
  }

  const upgradeBtn = modal.querySelector('[data-action="upgrade"]');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => {
      closeSubscriptionExpiryModal({ persistDismissal: true });
      window.location.href = 'dashboard-upgrade.html';
    });
  }

  const closeBtn = modal.querySelector('[data-action="close"]');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeSubscriptionExpiryModal({ persistDismissal: false }));
  }

  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeSubscriptionExpiryModal({ persistDismissal: false });
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('active')) {
      closeSubscriptionExpiryModal({ persistDismissal: false });
    }
  });

  modal.dataset.bound = '1';
}




// ۱) فانکشن برای گرفتن اطلاعات فروشنده
// ۱) فانکشن برای گرفتن اطلاعات فروشنده‌ی جاری
// === dashboard.html (یا هر جا که این تابع هست) ===
// تابع دریافت تعداد پیام‌های خوانده نشده
 // گرفتن فروشنده جاری
async function fetchCurrentSeller() {
  try {
    const res = await apiFetch('/api/auth/getCurrentSeller', {
      method: 'GET'
    });
    if (!res.ok) {
      window.location.href = 'login.html';
      throw new Error('Not authenticated');
    }
    const { seller } = await res.json();
    
    // ذخیره اطلاعات فروشنده در localStorage برای استفاده در سایر بخش‌ها
    if (seller) {
      localStorage.setItem('seller', JSON.stringify(seller));
    }
    
    return seller;
  } catch (err) {
    console.error('Error fetching seller:', err);
    window.location.href = 'login.html';
    return null;
  }
}

// ————————— تابع دریافت تعداد پیام‌های خوانده‌نشده —————————
const SELLER_SHOP_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SELLER_SHOP_SLUG_MIN_LENGTH = 3;
const SELLER_SHOP_SLUG_MAX_LENGTH = 40;
const SELLER_SHOP_DOMAIN = 'vitrinet.ir';

function normalizeSellerShopSlug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function validateSellerShopSlug(slug = '') {
  if (!slug) {
    return 'آدرس فروشگاه الزامی است.';
  }
  if (slug.length < SELLER_SHOP_SLUG_MIN_LENGTH || slug.length > SELLER_SHOP_SLUG_MAX_LENGTH) {
    return `آدرس فروشگاه باید بین ${SELLER_SHOP_SLUG_MIN_LENGTH} تا ${SELLER_SHOP_SLUG_MAX_LENGTH} کاراکتر باشد.`;
  }
  if (!SELLER_SHOP_SLUG_REGEX.test(slug)) {
    return 'آدرس فروشگاه فقط می‌تواند شامل حروف انگلیسی کوچک، عدد و خط تیره باشد.';
  }
  return '';
}

function initSellerSettingsSection() {
  const form = document.getElementById('sellerSettingsForm');
  const slugInput = document.getElementById('sellerSettingsShopurl');
  const previewEl = document.getElementById('sellerSettingsPreview');
  const errorEl = document.getElementById('sellerSettingsError');
  const successEl = document.getElementById('sellerSettingsSuccess');
  const saveBtn = document.getElementById('sellerSettingsSaveBtn');

  if (!form || !slugInput || !previewEl || !saveBtn || form.dataset.bound === '1') {
    return;
  }

  const defaultBtnText = saveBtn.textContent;
  let currentSlug = normalizeSellerShopSlug(window.seller?.shopurl || window.seller?.shopUrl || '');

  const updatePreview = (slug = '') => {
    previewEl.textContent = `${SELLER_SHOP_DOMAIN}/${slug || ''}`;
  };
  const clearMessages = () => {
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
    if (successEl) {
      successEl.textContent = '';
      successEl.classList.add('hidden');
    }
  };
  const showError = (message) => {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  };
  const showSuccess = (message) => {
    if (!successEl) return;
    successEl.textContent = message;
    successEl.classList.remove('hidden');
  };
  const setSaving = (isSaving) => {
    saveBtn.disabled = isSaving;
    saveBtn.textContent = isSaving ? 'در حال ذخیره...' : defaultBtnText;
  };

  slugInput.value = currentSlug;
  updatePreview(currentSlug);

  slugInput.addEventListener('input', () => {
    const normalized = normalizeSellerShopSlug(slugInput.value);
    if (slugInput.value !== normalized) {
      slugInput.value = normalized;
    }
    updatePreview(normalized);
    clearMessages();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessages();

    const slug = normalizeSellerShopSlug(slugInput.value);
    slugInput.value = slug;
    updatePreview(slug);

    const validationError = validateSellerShopSlug(slug);
    if (validationError) {
      showError(validationError);
      slugInput.focus();
      return;
    }

    if (!window.seller?.id && !window.seller?._id) {
      showError('شناسه فروشنده پیدا نشد. لطفاً دوباره وارد شوید.');
      return;
    }

    if (slug === currentSlug) {
      showSuccess('آدرس فروشگاه تغییری نکرده است.');
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch('/api/seller/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopurl: slug })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'ذخیره آدرس فروشگاه انجام نشد.');
      }

      const updatedSlug = normalizeSellerShopSlug(result?.seller?.shopurl || slug);
      currentSlug = updatedSlug;
      slugInput.value = updatedSlug;
      updatePreview(updatedSlug);

      const nextSeller = {
        ...(window.seller || {}),
        ...(result?.seller || {}),
        shopurl: updatedSlug,
        shopUrl: updatedSlug
      };
      if (!nextSeller.id && nextSeller._id) {
        nextSeller.id = nextSeller._id;
      }

      window.seller = nextSeller;
      localStorage.setItem('seller', JSON.stringify(nextSeller));

      showSuccess('آدرس فروشگاه با موفقیت ذخیره شد.');
    } catch (error) {
      showError(error?.message || 'خطا در ذخیره آدرس فروشگاه.');
    } finally {
      setSaving(false);
    }
  });

  form.dataset.bound = '1';
}

async function fetchUnreadCount() {
  try {
    if (!window.seller?.id) return 0;
    const res = await apiFetch(`/api/chats?sellerId=${window.seller.id}`);
    if (!res.ok) return 0;
    const chats = await res.json();
    return getUnreadTotal(chats);
  } catch (err) {
    console.error('Error fetching unread count:', err);
    return 0;
  }
}

// ————————— تابع به‌روزرسانی نمای بج —————————
function updateBadge(count) {
  const badge = document.getElementById('msgBadge');
  const sticky = document.getElementById('unreadSticky');
  const stickyCount = document.getElementById('unreadStickyCount');

  if (badge) {
    if (count > 0) {
      badge.innerText = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
      badge.animate([
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(1.18)', opacity: .85 },
        { transform: 'scale(1)', opacity: 1 }
      ], { duration: 280 });
    } else {
      badge.style.display = 'none';
    }
  }

  if (sticky && stickyCount) {
    if (count > 0) {
      sticky.style.display = 'inline-flex';
      stickyCount.textContent = count > 99 ? '99+' : count;
    } else {
      sticky.style.display = 'none';
    }
  }

  window.updateBadge = updateBadge;
}
window.updateBadge = updateBadge;

// ————————— شروع پولینگ بج —————————
function startBadgePolling() {
  if (window.badgeInterval) clearInterval(window.badgeInterval);
  // بار اول فوری
  fetchNewMsgCount().then(updateBadge);
  // سپس هر ۱۵ ثانیه
  window.badgeInterval = setInterval(() => {
    fetchNewMsgCount().then(updateBadge);
  }, 15000);
}

// ————————— علامت‌گذاری همه پیام‌ها به‌عنوان خوانده‌شده —————————
 // ————————— علامت‌گذاری همه‌ی پیام‌های خوانده‌نشده به‌عنوان خوانده‌شده —————————
// جایگزین تابع قبلی markAllRead
async function markAllRead() {
  try {
    if (!window.seller?.id) return;

    const res = await apiFetch('/api/chats/markAllRead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sellerId: window.seller.id })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to mark all read');
    }

    // پس از موفقیت، نشانگر (badge) صفر می‌شود
    updateBadge(0);

  } catch (err) {
    console.error('Error marking all as read:', err);
  }
}


// ————————— هندل کلیک روی منوی پیام‌ها —————————
(function setupMessagesHandler() {
  const btn = document.getElementById('menu-msg');
  if (!btn || btn.dataset.listener === '1') return;
  btn.dataset.listener = '1';

  btn.addEventListener('click', async () => {
    // هایلایت منو
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');

    // بارگذاری بخش پیام‌ها (تابع شما)
    if (typeof loadDashboardMessages === 'function') {
      await loadDashboardMessages();
    }

    // بستن سایدبار در موبایل
    const sidebar = document.getElementById('sidebar');
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (sidebar && sidebar.classList.contains('expanded') && isMobile) {
      toggleSidebar();
    }
  });
})();



function getUnreadTotal(chats){
return chats.reduce((sum , chat)=>
  sum + (chat.messages||[])
          .filter(m => m.from !== 'seller' && !m.readBySeller)
          .length
,0);
}

// نگهداری تعداد آخرین پیام‌ها
let lastMsgCount = 0;

// --- مانیتور کردن لایک محصولات ---
const productLikeSnapshot = new Map();
let likePollingInitialized = false;
let likeNotificationsPrimed = false;

function updateProductLikeSnapshot(products, { notify = false } = {}) {
  if (!Array.isArray(products) || !products.length) return;

  const canShowNotification = typeof window.showProductLikeNotification === 'function';

  const seenIds = new Set();
  products.forEach((prod) => {
    const productId = prod?._id || prod?.id;
    if (!productId) return;

    seenIds.add(productId);
    const currentLikes = Number.isFinite(prod.likesCount) ? Number(prod.likesCount) : 0;
    const previousLikes = productLikeSnapshot.get(productId);

    if (notify && canShowNotification && Number.isFinite(previousLikes) && currentLikes > previousLikes) {
      window.showProductLikeNotification({
        productTitle: prod.title,
        totalLikes: currentLikes
      });
    }

    productLikeSnapshot.set(productId, currentLikes);
  });

  // حذف محصولات قدیمی از عکس فوری
  Array.from(productLikeSnapshot.keys()).forEach((id) => {
    if (!seenIds.has(id)) {
      productLikeSnapshot.delete(id);
    }
  });

  likeNotificationsPrimed = true;
}

function startProductLikePolling() {
  if (likePollingInitialized) return;
  likePollingInitialized = true;

  const pollLikes = async (shouldNotify) => {
    if (!window.seller?.id) return;
    try {
      const res = await apiFetch(`/api/products?sellerId=${window.seller.id}`);
      if (!res.ok) return;
      const products = await res.json();
      updateProductLikeSnapshot(products, { notify: shouldNotify && likeNotificationsPrimed });
    } catch (err) {
      console.warn('Unable to poll product likes:', err);
    }
  };

  // اولین بار فقط عکس فوری می‌گیریم
  pollLikes(false);
  setInterval(() => pollLikes(true), 20000);
}

// فراخوانی تعداد پیام‌های خوانده‌نشده جدید (می‌توانید همان fetchUnreadCount را مجدداً استفاده کنید)
async function fetchNewMsgCount(){
  try{
    if(!window.seller?.id) return 0;
    const res = await apiFetch(`/api/chats?sellerId=${window.seller.id}`);
    if(!res.ok) return 0;
    const chats = await res.json();
    return getUnreadTotal(chats);    // ← همان محاسبه‌ی عمومی
  }catch{
    return 0;
  }
}

// نمایش پاپ‌اپ پیام جدید
function showMessagePopup(count) {
  const popup = document.getElementById('messagePopup');
  const span = document.getElementById('newMsgCount');
  span.innerText = count > 99 ? '99+' : count;
  popup.classList.add('show');
  setTimeout(() => popup.classList.remove('show'), 4000);
}

// شروع پولینگ برای دریاف پیام جدید
function startMessagePolling() {
  // بار اول مقدار اولیه بگیریم
  fetchNewMsgCount().then(c => lastMsgCount = c);
  // هر ۲۰ ثانیه چک کن
  setInterval(async () => {
    const c = await fetchNewMsgCount();
    if (c > lastMsgCount) {
      showMessagePopup(c - lastMsgCount);
    }
    lastMsgCount = c;
    updateBadge(c);          // هم بج را آپدیت کن
  }, 20000);
}


// ————————— راه‌اندازی اولیه —————————
  document.addEventListener('DOMContentLoaded', async () => {
    setupSubscriptionExpiryModal();

    // ۱) دریافت فروشنده
    window.seller = await fetchCurrentSeller();
    initSellerSettingsSection();
    console.log('🚀 seller object:', window.seller);
    document.dispatchEvent(new CustomEvent('seller:ready', { detail: { seller: window.seller } }));

    startProductLikePolling();

    if (shouldShowSubscriptionExpiryModal(window.seller)) {
      setTimeout(() => openSubscriptionExpiryModal(), 160);
    }

  const accountantShortcut = document.getElementById('accountantShortcut');
  if (accountantShortcut) {
    accountantShortcut.addEventListener('click', () => {
      try {
        sessionStorage.setItem('vitrinet-accountant-access', 'granted');
      } catch (error) {
        console.warn('Unable to persist accountant access flag:', error);
      }
      const target = accountantShortcut.dataset.target;
      if (target) {
        window.location.href = target;
      }
    });
  }

  const homeBtn = document.getElementById('dashboardHome');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      window.location.href = '/';
    });
  }

  const hamburger = document.getElementById('sidebarHamburger');
  if (hamburger) hamburger.addEventListener('click', toggleSidebar);
  const overlay = document.getElementById('sidebarOverlay');
  if (overlay) overlay.addEventListener('click', toggleSidebar);
  const toggleBtn = document.getElementById('sidebarToggle');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleSidebar);

  const manualSections = new Set(['content', 'msg', 'performance', 'notif']);
  document.querySelectorAll('.sidebar-link[data-section]').forEach((button) => {
    const section = button.dataset.section;
    if (!section || manualSections.has(section)) {
      return;
    }
    button.addEventListener('click', () => {
      showSection(section);
      // بستن سایدبار در موبایل
      const sidebar = document.getElementById('sidebar');
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (sidebar && sidebar.classList.contains('expanded') && isMobile) {
        toggleSidebar();
      }
    });
  });

  document.querySelectorAll('.chart-tab[data-chart]').forEach((button) => {
    button.addEventListener('click', () => switchChart(button.dataset.chart));
  });

  if (window.seller?.id) {
    // ۲) شروع پولینگ‌ها
    startBadgePolling();
    startMessagePolling();

    // ۳) بارگذاری تعداد نظرات در انتظار
    loadPendingReviewsCount();

    // ۴) نمایش نام و نام‌خانوادگی فروشنده
    const welcomeEl = document.getElementById('seller-welcome');
    if (welcomeEl) {
      const first = window.seller.firstname || '';
      const last  = window.seller.lastname  || '';
      // اگر هر دو موجود باشد "firstname lastname"
      const fullName = `${first}${last ? ' ' + last : ''}`;
      welcomeEl.textContent = `${fullName} عزیز`;
    }
  }
});

// ————————— بارگذاری تعداد نظرات در انتظار —————————
async function loadPendingReviewsCount() {
  try {
    const response = await apiFetch('/api/seller/pending-comments/count');
    if (response.ok) {
      const data = await response.json();
      const count = data.count || 0;
      
      // Update mobile sidebar badge
      const sidebarBadge = document.getElementById('sidebarReviewsBadge');
      if (sidebarBadge) {
        sidebarBadge.textContent = count;
        sidebarBadge.style.display = count === 0 ? 'none' : 'grid';
      }
      
      // Update desktop sidebar badge
      const desktopBadge = document.getElementById('desktopReviewsBadge');
      if (desktopBadge) {
        desktopBadge.textContent = count;
        desktopBadge.style.display = count === 0 ? 'none' : 'inline-flex';
      }
    }
  } catch (err) {
    console.warn('Failed to load pending reviews count:', err);
  }
}

// ————————— توقف پولینگ هنگام خروج —————————
window.addEventListener('beforeunload', () => {
  if (window.badgeInterval) {
    clearInterval(window.badgeInterval);
  }
});




// ۳) باقی کدها (مثل پیش‌نمایش، ارسال محصول جدید) بدون تغییر باقی می‌مانند


// ۳) استفاده در دکمه‌ی پیش‌نمایش:
const shopPreviewButton = document.getElementById('btn-shop-preview');
if (shopPreviewButton) {
  shopPreviewButton.addEventListener('click', () => {
    if (!window.seller?.shopurl) {
      alert('آدرس فروشگاه شما ثبت نشده.');
      return;
    }
    const url = new URL('/shop.html', window.location.origin);
    url.searchParams.set('shopurl', window.seller.shopurl);
    window.open(url.href, '_blank');
    
    // بستن سایدبار در موبایل
    const sidebar = document.getElementById('sidebar');
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (sidebar && sidebar.classList.contains('expanded') && isMobile) {
      toggleSidebar();
    }
  });
}










function closeSidebarIfMobile() {
  const sidebar = document.getElementById('sidebar');
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (sidebar && sidebar.classList.contains('expanded') && isMobile) {
    toggleSidebar();
  }
}

function getSellerShopSlug() {
  const seller = window.seller || {};
  return (seller.shopurl || seller.shopUrl || seller.slug || '').toString().trim();
}

function openSellerShopPage() {
  const shopSlug = getSellerShopSlug();
  if (!shopSlug) {
    alert('آدرس فروشگاه شما هنوز ثبت نشده است.');
    return;
  }

  const url = new URL('/shop.html', window.location.origin);
  url.searchParams.set('shopurl', shopSlug);
  window.open(url.href, '_blank', 'noopener');
  closeSidebarIfMobile();
}

document.querySelectorAll('[data-seller-shop-link]').forEach((button) => {
  if (button.dataset.sellerShopBound === '1') return;
  button.dataset.sellerShopBound = '1';
  button.addEventListener('click', openSellerShopPage);
});

document.querySelectorAll('[data-vitrinet-home-link]').forEach((button) => {
  if (button.dataset.vitrinetHomeBound === '1') return;
  button.dataset.vitrinetHomeBound = '1';
  button.addEventListener('click', () => {
    closeSidebarIfMobile();
    window.location.href = '/';
  });
});

function showProductSuccessPopup() {
  console.log("✅ تابع showProductSuccessPopup صدا زده شد");
  const popup = document.getElementById('productSuccessPopup');
  if (!popup) return console.error("❌ popup not found");
  popup.style.display = "flex";
  popup.style.opacity = "1";
  console.log("Opacity set to 1:", popup.style.opacity);
  setTimeout(() => {
    popup.style.opacity = "0";
    setTimeout(() => popup.style.display = "none", 300);
  }, 2000);
}
  

// ----------- سایدبار سایت ----------
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const hamburger = document.querySelector('.sidebar-hamburger');
  const toggleBtn = document.querySelector('.sidebar-toggle');
  if (!sidebar || !overlay) return;

  const isExpanded = sidebar.classList.toggle('expanded');
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  overlay.classList.toggle('active', isExpanded && isMobile);
  document.body.classList.toggle('sidebar-expanded', isExpanded && !isMobile);

  if (hamburger) {
    hamburger.setAttribute('aria-expanded', isExpanded);
  }

  if (toggleBtn) {
    toggleBtn.setAttribute('aria-expanded', isExpanded);
    if (isExpanded) {
      toggleBtn.focus();
    } else if (hamburger && isMobile) {
      hamburger.focus();
    }
  }
}

function handleSidebarOnResize() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar || !overlay) return;

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const isExpanded = sidebar.classList.contains('expanded');

  if (isMobile) {
    document.body.classList.remove('sidebar-expanded');
    overlay.classList.toggle('active', isExpanded);
  } else {
    overlay.classList.remove('active');
    document.body.classList.toggle('sidebar-expanded', isExpanded);
  }
}

window.addEventListener('resize', handleSidebarOnResize);
window.addEventListener('orientationchange', handleSidebarOnResize);
handleSidebarOnResize();

// ----------- Mobile Sidebar Menu Handlers ----------
(function initMobileSidebar() {
  // Mobile close button
  const mobileClose = document.getElementById('mobileMenuClose');
  if (mobileClose) {
    mobileClose.addEventListener('click', toggleSidebar);
  }

  // Mobile accounting button
  const mobileAccountingBtn = document.getElementById('mobileAccountingBtn');
  if (mobileAccountingBtn) {
    mobileAccountingBtn.addEventListener('click', () => {
      toggleSidebar();
      window.location.href = '../hesabketab/accountant.html';
    });
  }

  // Mobile stats button
  const mobileStatsBtn = document.getElementById('mobileStatsBtn');
  if (mobileStatsBtn) {
    mobileStatsBtn.addEventListener('click', () => {
      showSection('visit');
      toggleSidebar();
    });
  }

  // Mobile performance button
  const mobilePerformanceBtn = document.getElementById('mobilePerformanceBtn');
  if (mobilePerformanceBtn) {
    mobilePerformanceBtn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
      document.getElementById('menu-performance')?.classList.add('active');
      document.querySelectorAll("section[id^='section-']").forEach(sec => sec.style.display = 'none');
      document.getElementById('main-content').innerHTML = '';
      if (typeof loadPerformanceStatus === 'function') loadPerformanceStatus();
      toggleSidebar();
    });
  }

  // Mobile preview button
  const mobilePreviewBtn = document.getElementById('mobilePreviewBtn');
  if (mobilePreviewBtn) {
    mobilePreviewBtn.addEventListener('click', () => {
      document.getElementById('btn-shop-preview')?.click();
      toggleSidebar();
    });
  }

  // Mobile upgrade button
  const mobileUpgradeBtn = document.getElementById('mobileUpgradeBtn');
  if (mobileUpgradeBtn) {
    mobileUpgradeBtn.addEventListener('click', () => {
      // فقط click روی menu-upgrade صدا زده میشه
      // چون menu-upgrade خودش toggleSidebar رو صدا میزنه، نیازی به صدا زدن مجدد نیست
      document.getElementById('menu-upgrade')?.click();
    });
  }

  // Mobile install button
  const mobileInstallBtn = document.getElementById('mobileInstallBtn');
  if (mobileInstallBtn) {
    mobileInstallBtn.addEventListener('click', () => {
      toggleSidebar();
      document.getElementById('installAppCta')?.click();
    });
  }

  // Mobile menu items with data-section
  document.querySelectorAll('.sidebar-menu-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (section) {
        // Update active state for desktop sidebar
        document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
        const desktopBtn = document.querySelector(`.sidebar-link[data-section="${section}"]`);
        if (desktopBtn) desktopBtn.classList.add('active');
        
        // Update active state for mobile menu
        document.querySelectorAll('.sidebar-menu-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        
        showSection(section);
        toggleSidebar();
      }
    });
  });

  // Sync message badge with mobile
  const observer = new MutationObserver(() => {
    const desktopBadge = document.getElementById('msgBadge');
    const mobileBadge = document.getElementById('mobileMsgBadge');
    if (desktopBadge && mobileBadge) {
      const count = desktopBadge.textContent || '0';
      mobileBadge.textContent = count;
      mobileBadge.style.display = desktopBadge.style.display;
    }
  });

  const msgBadge = document.getElementById('msgBadge');
  if (msgBadge) {
    observer.observe(msgBadge, { attributes: true, childList: true, characterData: true });
  }
})();

// ----------- بخش سوییچ بین بخش‌ها و چارت بازدید ----------
function showSection(section) {
  document.body.dataset.activeSellerSection = section;
  document.body.classList.toggle('seller-section-upgrade', section === 'upgrade');
  if (section === 'msg') {
    const perf = document.getElementById('performance-container');
    if (perf) perf.style.display = 'none';
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar-menu-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll("section[id^='section-']").forEach(sec => {
      sec.style.display = 'none';
    });
    const btnActive = document.getElementById('menu-msg');
    if (btnActive) btnActive.classList.add('active');
    const mobileActive = document.querySelector('.sidebar-menu-item[data-section="msg"]');
    if (mobileActive) mobileActive.classList.add('active');
    if (typeof loadDashboardMessages === 'function') {
      loadDashboardMessages();
    }
    if (typeof updateBadge === 'function') {
      updateBadge(0);
    }
    return;
  }
  // اگر بخش انتخابی "content" (یعنی مدیریت ظاهر فروشگاه) نیست،
  // محتوای main-content رو پاک کن که چیزی زیر بخش جدید نمونه
  if (section !== "content" && document.getElementById('main-content')) {
    document.getElementById('main-content').innerHTML = '';
  }
  const perf = document.getElementById('performance-container');
  if (perf) perf.style.display = 'none';

  const allSections = [
    "visit", "notif", "msg", "profile", "settings", "add", "upgrade",
    "products", "content", "seo", "guide", "register-visit", "performance",
    "discounts", "reviews", "stories"
  ];
  allSections.forEach(s => {
    const btn = document.getElementById('menu-' + s);
    if (btn) btn.classList.remove('active');
    const sec = document.getElementById('section-' + s);
    if (sec) sec.style.display = 'none';
  });
  const btnActive = document.getElementById('menu-' + section);
  if (btnActive) btnActive.classList.add('active');
  const secActive = document.getElementById('section-' + section);
  if (secActive) secActive.style.display = 'block';

  if (section === 'visit' && document.getElementById('visitChart')) {
    setTimeout(() => renderChart(currentChart), 80);
  }
  if (section === 'register-visit') {
    loadDailyVisits();
  }
  if (section === 'notif') {
    if (typeof window.loadDashboardLogo === 'function') {
      window.loadDashboardLogo();
    }
  }
  if (section === 'performance') {
    loadPerformanceStatus();
  }
  if (section === 'reviews' && window.ReviewsManagement) {
    window.ReviewsManagement.init();
  }
  if (section === "products") setupProductSection();
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest(
    '#menu-upgrade, .sidebar-link[data-section], .sidebar-menu-item[data-section], .seller-mobile-bottom-nav__item[data-section], .seller-mobile-bottom-nav__item[data-action="upgrade"]'
  );
  if (!trigger) return;
  const section = trigger.id === 'menu-upgrade' || trigger.dataset.action === 'upgrade'
    ? 'upgrade'
    : (trigger.dataset.section || '');
  if (!section) return;
  document.body.dataset.activeSellerSection = section;
  document.body.classList.toggle('seller-section-upgrade', section === 'upgrade');
}, true);

function switchChart(type) {
  if (currentChart === type) return;
  currentChart = type;
  renderChart(type);
  document.getElementById('tab-week').classList.toggle('active', type === 'week');
  document.getElementById('tab-month').classList.toggle('active', type === 'month');
  document.getElementById('chartTitle').innerText = type === 'week' ? 'نمودار بازدید هفتگی' : 'نمودار بازدید ماهانه';
}


// ----------- چارت بازدید (نمونه) ----------
let chartData = {
  week: { labels: ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'], data: [112,131,123,148,156,166,140] },
  month: { labels: ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'], data: [880,970,1050,1254,1411,1393,1522,1610,1733,1652,1567,1295] }
};
let currentChart = 'week', visitChart;
function renderChart(type = 'week') {
  const ctx = document.getElementById('visitChart').getContext('2d');
  if (visitChart) visitChart.destroy();
  visitChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData[type].labels,
      datasets: [{
        label: 'بازدیدها', data: chartData[type].data, fill: true, tension: 0.38,
        borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.09)', pointBackgroundColor: '#10b981', pointRadius: 5, pointHoverRadius: 7,
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#e5e7eb44', borderDash: [4,4] }, ticks: { color: '#888', font: { size: 13, weight: 'bold' } } },
        x: { grid: { display: false }, ticks: { color: '#666', font: { size: 13, weight: 'bold' } } }
      }
    }
  });
}

// ----------- پاپ‌آپ موفقیت ----------
  

// ----------- آپلود و پیش‌نمایش عکس محصول (چندگانه) ----------
window._productFiles = [];
const imgInput = document.getElementById("productImagesInput");
const previewBox = document.getElementById("imagePreview");
const imgErrorMsg = document.getElementById("imgErrorMsg");

// ----------- سقف تخفیف (Discount Ceiling) ----------
const discountCeilingInput = document.getElementById("discountCeilingInput");
const discountCeilingPreview = document.getElementById("discountCeilingPreview");
const discountCeilingError = document.getElementById("discountCeilingError");
const discountFinalPrice = document.getElementById("discountFinalPrice");
const discountOriginalPrice = document.getElementById("discountOriginalPrice");
const priceInput = document.querySelector('#addProductForm input[name="price"]');
const editDiscountCeilingInput = document.getElementById("editDiscountCeilingInput");
const editDiscountCeilingPreview = document.getElementById("editDiscountCeilingPreview");
const editDiscountCeilingError = document.getElementById("editDiscountCeilingError");
const editDiscountFinalPrice = document.getElementById("editDiscountFinalPrice");
const editDiscountOriginalPrice = document.getElementById("editDiscountOriginalPrice");
const editProductPriceInput = document.querySelector('#editProductForm input[name="price"]');

function formatPersianNumber(num) {
  if (!num && num !== 0) return '—';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().replace(/\d/g, d => persianDigits[d]).replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
}

function parseInputNumber(value) {
  if (!value) return 0;
  // Convert Persian digits to English and remove separators
  const persianToEnglish = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
  const cleaned = value.replace(/[۰-۹]/g, d => persianToEnglish[d]).replace(/[٬,\s]/g, '');
  return parseInt(cleaned, 10) || 0;
}

function normalizeProductPriceInput(value) {
  return String(value || '')
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[^\d]/g, '');
}

function parseProductPrice(value) {
  return Number.parseInt(normalizeProductPriceInput(value), 10) || 0;
}

function formatProductPrice(value) {
  return `${new Intl.NumberFormat('fa-IR').format(Number(value) || 0)} تومان`;
}

const PRODUCT_IMAGE_PLACEHOLDER = '/assets/images/placeholder-product.svg';
const productManagementState = {
  products: [],
  query: '',
  status: 'all',
  category: 'all',
  sort: 'newest',
  bound: false,
  activeProductId: null
};

function getProductId(prod) {
  return prod?._id || prod?.id || '';
}

function escapeProductText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getProductCover(prod) {
  const images = Array.isArray(prod?.images) ? prod.images : [];
  if (images.length) {
    const mainIndex = Number.isInteger(prod.mainImageIndex) ? prod.mainImageIndex : 0;
    return images[mainIndex] || images[0] || PRODUCT_IMAGE_PLACEHOLDER;
  }
  return prod?.image || PRODUCT_IMAGE_PLACEHOLDER;
}

function getProductTimestamp(prod) {
  const raw = prod?.updatedAt || prod?.createdAt || prod?._id || '';
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return parsed;

  const id = String(prod?._id || prod?.id || '');
  if (/^[a-f0-9]{24}$/i.test(id)) {
    return Number.parseInt(id.slice(0, 8), 16) * 1000;
  }
  return 0;
}

function getProductCategory(prod) {
  const category = String(prod?.category || '').trim();
  return category || 'بدون دسته';
}

function getProductTags(prod) {
  if (Array.isArray(prod?.tags)) return prod.tags.filter(Boolean);
  if (prod?.tag) return [prod.tag];
  return [];
}

function getVisibleManagedProducts() {
  const query = productManagementState.query.trim().toLowerCase();
  const status = productManagementState.status;
  const category = productManagementState.category;
  const sort = productManagementState.sort;

  return [...productManagementState.products]
    .filter((prod) => {
      const isInStock = prod?.inStock !== false;
      if (status === 'in-stock' && !isInStock) return false;
      if (status === 'out-of-stock' && isInStock) return false;
      if (category !== 'all' && getProductCategory(prod) !== category) return false;
      if (!query) return true;

      const haystack = [
        prod?.title,
        prod?.category,
        prod?.desc,
        prod?.description,
        ...getProductTags(prod)
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (sort === 'oldest') return getProductTimestamp(a) - getProductTimestamp(b);
      if (sort === 'price-desc') return (Number(b?.price) || 0) - (Number(a?.price) || 0);
      if (sort === 'price-asc') return (Number(a?.price) || 0) - (Number(b?.price) || 0);
      if (sort === 'name') return String(a?.title || '').localeCompare(String(b?.title || ''), 'fa');
      return getProductTimestamp(b) - getProductTimestamp(a);
    });
}

function syncProductCategoryFilter() {
  const categorySelect = document.getElementById('productManagementCategoryFilter');
  if (!categorySelect) return;

  const categories = [...new Set(productManagementState.products
    .map((prod) => getProductCategory(prod).trim())
    .filter((category) => category && category !== 'بدون دسته'))]
    .sort((a, b) => a.localeCompare(b, 'fa'));

  const selected = categories.includes(productManagementState.category)
    ? productManagementState.category
    : 'all';
  productManagementState.category = selected;

  categorySelect.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'همه دسته‌بندی‌ها';
  categorySelect.appendChild(allOption);

  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });

  categorySelect.value = selected;
}

function ensureProductManagementControls() {
  if (productManagementState.bound) return;
  productManagementState.bound = true;

  const search = document.getElementById('productManagementSearch');
  const status = document.getElementById('productManagementStatusFilter');
  const category = document.getElementById('productManagementCategoryFilter');
  const sort = document.getElementById('productManagementSort');
  const floatingAdd = document.getElementById('productAddFloatingBtn');
  const sheet = document.getElementById('productDetailSheet');

  search?.addEventListener('input', (event) => {
    productManagementState.query = event.target.value || '';
    renderProductManagementList();
  });

  status?.addEventListener('change', (event) => {
    productManagementState.status = event.target.value || 'all';
    renderProductManagementList();
  });

  category?.addEventListener('change', (event) => {
    productManagementState.category = event.target.value || 'all';
    renderProductManagementList();
  });

  sort?.addEventListener('change', (event) => {
    productManagementState.sort = event.target.value || 'newest';
    renderProductManagementList();
  });

  floatingAdd?.addEventListener('click', () => {
    const addMenuBtn = document.getElementById('menu-add');
    if (addMenuBtn) addMenuBtn.click();
  });

  sheet?.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-product-sheet]')) {
      closeProductDetailSheet();
      return;
    }

    const action = event.target.closest('[data-sheet-action]')?.dataset.sheetAction;
    if (!action) return;

    const productId = productManagementState.activeProductId;
    if (!productId) return;
    if (action === 'view') {
      window.open(`/product.html?id=${encodeURIComponent(productId)}`, '_blank', 'noopener,noreferrer');
    } else if (action === 'edit') {
      closeProductDetailSheet();
      showEditModal(productId);
    } else if (action === 'delete') {
      closeProductDetailSheet();
      deleteProduct(productId);
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.product-actions')) {
      closeProductActionMenus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeProductActionMenus();
      closeProductDetailSheet();
    }
  });
}

function closeProductActionMenus() {
  document.querySelectorAll('#section-products .product-actions.is-open').forEach((menu) => {
    menu.classList.remove('is-open');
  });
}

function createProductActionsMarkup(prod) {
  const productId = escapeProductText(getProductId(prod));
  return `
    <div class="product-actions">
      <button type="button" class="product-actions__trigger" data-action="toggle-product-menu" data-product-id="${productId}" aria-label="عملیات محصول" aria-haspopup="menu">
        <i class="ri-more-2-fill" aria-hidden="true"></i>
      </button>
      <div class="product-actions__menu" role="menu">
        <button type="button" data-action="details-product" data-product-id="${productId}" role="menuitem">
          <i class="ri-information-line" aria-hidden="true"></i>
          جزئیات
        </button>
        <button type="button" data-action="edit-product" data-product-id="${productId}" role="menuitem">
          <i class="ri-edit-2-line" aria-hidden="true"></i>
          ویرایش
        </button>
        <a href="/product.html?id=${encodeURIComponent(getProductId(prod))}" target="_blank" rel="noopener noreferrer" role="menuitem">
          <i class="ri-external-link-line" aria-hidden="true"></i>
          مشاهده
        </a>
        <button type="button" data-action="delete-product" data-product-id="${productId}" role="menuitem">
          <i class="ri-delete-bin-6-line" aria-hidden="true"></i>
          حذف
        </button>
      </div>
    </div>
  `;
}

function bindProductRowEvents(row, prod) {
  const productId = getProductId(prod);
  if (!row || !productId) return;

  row.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, label, .product-actions')) return;
    openProductDetailSheet(prod);
  });

  row.querySelector('[data-action="toggle-product-menu"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    const wrapper = event.currentTarget.closest('.product-actions');
    const willOpen = !wrapper?.classList.contains('is-open');
    closeProductActionMenus();
    wrapper?.classList.toggle('is-open', willOpen);
  });

  row.querySelector('[data-action="details-product"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    closeProductActionMenus();
    openProductDetailSheet(prod);
  });

  row.querySelector('[data-action="edit-product"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    closeProductActionMenus();
    showEditModal(productId);
  });

  row.querySelector('[data-action="delete-product"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    closeProductActionMenus();
    deleteProduct(productId);
  });

  row.querySelector('.stock-toggle__input')?.addEventListener('change', async (event) => {
    event.stopPropagation();
    const nextValue = event.target.checked;
    await handleStockToggle(productId, nextValue, row);
    prod.inStock = event.target.checked;
    if (productManagementState.status !== 'all') {
      renderProductManagementList();
    } else {
      updateProductManagementCount();
    }
  });
}

function createDesktopProductRow(prod) {
  const productId = escapeProductText(getProductId(prod));
  const isInStock = prod.inStock !== false;
  const tr = document.createElement('tr');
  tr.className = 'product-desktop-row';
  tr.dataset.productId = productId;
  tr.innerHTML = `
    <td><img src="${escapeProductText(getProductCover(prod))}" alt="" class="product-row-thumb" onerror="this.src='${PRODUCT_IMAGE_PLACEHOLDER}'"></td>
    <td>
      <div class="product-row-title">
        <strong>${escapeProductText(prod.title || 'بدون نام')}</strong>
        <span>${escapeProductText(getProductCategory(prod))}</span>
      </div>
    </td>
    <td><span class="product-row-price ${!isInStock ? 'line-through opacity-60' : ''}">${formatProductPrice(prod.price)}</span></td>
    <td class="text-center">
      <label class="stock-toggle" data-product-id="${productId}">
        <input type="checkbox" class="stock-toggle__input" ${isInStock ? 'checked' : ''} />
        <span class="stock-toggle__slider"></span>
        <span class="stock-toggle__label">${isInStock ? 'موجود' : 'ناموجود'}</span>
      </label>
    </td>
    <td class="text-center">${createProductActionsMarkup(prod)}</td>
  `;
  bindProductRowEvents(tr, prod);
  return tr;
}

function createMobileProductRow(prod) {
  const productId = escapeProductText(getProductId(prod));
  const isInStock = prod.inStock !== false;
  const row = document.createElement('article');
  row.className = `seller-product-row ${!isInStock ? 'product-card--out-of-stock' : ''}`;
  row.dataset.productId = productId;
  row.setAttribute('role', 'listitem');
  row.innerHTML = `
    <img class="seller-product-row__thumb ${!isInStock ? 'grayscale opacity-60' : ''}" src="${escapeProductText(getProductCover(prod))}" alt="${escapeProductText(prod.title || '')}" onerror="this.src='${PRODUCT_IMAGE_PLACEHOLDER}'">
    <div class="seller-product-row__main">
      <h3 class="seller-product-row__name">${escapeProductText(prod.title || 'بدون نام')}</h3>
      <div class="seller-product-row__meta">
        <span class="seller-product-row__price ${!isInStock ? 'line-through opacity-60' : ''}">${formatProductPrice(prod.price)}</span>
        <span class="seller-product-row__category">${escapeProductText(getProductCategory(prod))}</span>
      </div>
    </div>
    <div class="seller-product-row__side">
      <span class="product-status-pill ${!isInStock ? 'product-status-pill--off' : ''}">
        <i class="${isInStock ? 'ri-checkbox-circle-fill' : 'ri-close-circle-line'}" aria-hidden="true"></i>
        ${isInStock ? 'موجود' : 'ناموجود'}
      </span>
    </div>
  `;
  bindProductRowEvents(row, prod);
  return row;
}

function updateProductManagementCount(filteredCount = null) {
  const countEl = document.getElementById('productManagementCount');
  if (!countEl) return;
  const total = productManagementState.products.length;
  const visible = filteredCount ?? getVisibleManagedProducts().length;
  countEl.textContent = visible === total
    ? `${total.toLocaleString('fa-IR')} محصول`
    : `${visible.toLocaleString('fa-IR')} از ${total.toLocaleString('fa-IR')} محصول`;
}

function renderProductManagementList() {
  ensureProductManagementControls();
  syncProductCategoryFilter();

  const tbody = document.getElementById('productsTableBody');
  const mobileList = document.getElementById('productsMobileList');
  const noProductMsg = document.getElementById('noProductMsg');
  const products = getVisibleManagedProducts();

  if (tbody) tbody.innerHTML = '';
  if (mobileList) mobileList.innerHTML = '';
  updateProductManagementCount(products.length);

  if (!productManagementState.products.length) {
    noProductMsg?.classList.remove('hidden');
    return;
  }

  noProductMsg?.classList.add('hidden');

  if (!products.length) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="product-empty-inline">محصولی با این فیلتر پیدا نشد.</td></tr>`;
    }
    if (mobileList) {
      mobileList.innerHTML = `<div class="product-empty-inline">محصولی با این فیلتر پیدا نشد.</div>`;
    }
    return;
  }

  products.forEach((prod) => {
    tbody?.appendChild(createDesktopProductRow(prod));
    mobileList?.appendChild(createMobileProductRow(prod));
  });
}

function openProductDetailSheet(prod) {
  const sheet = document.getElementById('productDetailSheet');
  if (!sheet || !prod) return;

  const productId = getProductId(prod);
  productManagementState.activeProductId = productId;

  const image = document.getElementById('productDetailSheetImage');
  const title = document.getElementById('productDetailSheetTitle');
  const subtitle = document.getElementById('productDetailSheetSubtitle');
  const body = document.getElementById('productDetailSheetBody');
  const tags = getProductTags(prod);
  const likeCount = Number(prod.likesCount || 0).toLocaleString('fa-IR');
  const inventory = prod.inventory ?? prod.stock ?? '';
  const isInStock = prod.inStock !== false;
  const description = prod.desc || prod.description || 'توضیحی ثبت نشده است.';

  if (image) {
    image.src = getProductCover(prod);
    image.onerror = () => { image.src = PRODUCT_IMAGE_PLACEHOLDER; };
  }
  if (title) title.textContent = prod.title || 'بدون نام';
  if (subtitle) subtitle.textContent = isInStock ? 'محصول موجود در فروشگاه' : 'محصول ناموجود';
  if (body) {
    body.innerHTML = `
      <div class="product-detail-sheet__grid">
        <div class="product-detail-sheet__item">
          <span class="product-detail-sheet__label">قیمت</span>
          <strong class="product-detail-sheet__value">${formatProductPrice(prod.price)}</strong>
        </div>
        <div class="product-detail-sheet__item">
          <span class="product-detail-sheet__label">وضعیت</span>
          <strong class="product-detail-sheet__value">${isInStock ? 'موجود' : 'ناموجود'}</strong>
        </div>
        <div class="product-detail-sheet__item">
          <span class="product-detail-sheet__label">دسته‌بندی</span>
          <strong class="product-detail-sheet__value">${escapeProductText(getProductCategory(prod))}</strong>
        </div>
        <div class="product-detail-sheet__item">
          <span class="product-detail-sheet__label">موجودی</span>
          <strong class="product-detail-sheet__value">${inventory !== '' ? escapeProductText(inventory) : 'ثبت نشده'}</strong>
        </div>
        <div class="product-detail-sheet__item">
          <span class="product-detail-sheet__label">پسندیده‌شده</span>
          <strong class="product-detail-sheet__value">${likeCount} نفر</strong>
        </div>
        <div class="product-detail-sheet__item">
          <span class="product-detail-sheet__label">برچسب‌ها</span>
          <strong class="product-detail-sheet__value">${tags.length ? escapeProductText(tags.join('، ')) : 'بدون برچسب'}</strong>
        </div>
      </div>
      <div class="product-detail-sheet__desc">${escapeProductText(description)}</div>
    `;
  }

  sheet.classList.add('active');
  sheet.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeProductDetailSheet() {
  const sheet = document.getElementById('productDetailSheet');
  if (!sheet) return;
  sheet.classList.remove('active');
  sheet.setAttribute('aria-hidden', 'true');
  productManagementState.activeProductId = null;
  document.body.style.overflow = '';
}

function updateDiscountCeilingPreview() {
  if (!discountCeilingInput || !discountCeilingPreview || !discountCeilingError) return;
  
  const price = priceInput ? Number(priceInput.value) || 0 : 0;
  const ceiling = parseInputNumber(discountCeilingInput.value);
  
  // Hide both initially
  discountCeilingPreview.classList.add('hidden');
  discountCeilingError.classList.add('hidden');
  
  if (!ceiling || ceiling <= 0) return;
  
  // Validation: ceiling cannot be greater than price
  if (price > 0 && ceiling > price) {
    discountCeilingError.classList.remove('hidden');
    return;
  }
  
  // Show preview
  if (price > 0) {
    const finalPrice = price - ceiling;
    discountFinalPrice.textContent = formatPersianNumber(finalPrice);
    discountOriginalPrice.textContent = formatPersianNumber(price);
    discountCeilingPreview.classList.remove('hidden');
  }
}

function formatDiscountCeilingInput() {
  if (!discountCeilingInput) return;
  const value = parseInputNumber(discountCeilingInput.value);
  if (value > 0) {
    discountCeilingInput.value = formatPersianNumber(value);
  }
}

function updateEditDiscountCeilingPreview() {
  if (!editDiscountCeilingInput || !editDiscountCeilingPreview || !editDiscountCeilingError) return true;

  const price = editProductPriceInput ? parseInputNumber(editProductPriceInput.value) : 0;
  const ceiling = parseInputNumber(editDiscountCeilingInput.value);

  editDiscountCeilingPreview.classList.add('hidden');
  editDiscountCeilingError.classList.add('hidden');

  if (!ceiling || ceiling <= 0) return true;

  if (price > 0 && ceiling > price) {
    editDiscountCeilingError.classList.remove('hidden');
    return false;
  }

  if (price > 0) {
    const finalPrice = Math.max(0, price - ceiling);
    if (editDiscountFinalPrice) editDiscountFinalPrice.textContent = formatPersianNumber(finalPrice);
    if (editDiscountOriginalPrice) editDiscountOriginalPrice.textContent = formatPersianNumber(price);
    editDiscountCeilingPreview.classList.remove('hidden');
  }

  return true;
}

function formatEditDiscountCeilingInput() {
  if (!editDiscountCeilingInput) return;
  const value = parseInputNumber(editDiscountCeilingInput.value);
  editDiscountCeilingInput.value = value > 0 ? formatPersianNumber(value) : '';
  updateEditDiscountCeilingPreview();
}

if (discountCeilingInput) {
  discountCeilingInput.addEventListener('input', () => {
    updateDiscountCeilingPreview();
  });
  
  discountCeilingInput.addEventListener('blur', () => {
    formatDiscountCeilingInput();
    updateDiscountCeilingPreview();
  });
}

if (priceInput) {
  priceInput.addEventListener('input', updateDiscountCeilingPreview);
  priceInput.addEventListener('change', updateDiscountCeilingPreview);
}

if (editDiscountCeilingInput) {
  editDiscountCeilingInput.addEventListener('input', () => {
    editDiscountCeilingInput.value = editDiscountCeilingInput.value
      .replace(/[^\d۰-۹٠-٩٬,\s]/g, '');
    updateEditDiscountCeilingPreview();
  });
  editDiscountCeilingInput.addEventListener('blur', formatEditDiscountCeilingInput);
}

if (editProductPriceInput) {
  editProductPriceInput.addEventListener('input', updateEditDiscountCeilingPreview);
  editProductPriceInput.addEventListener('change', updateEditDiscountCeilingPreview);
}

function renderNewImages(files) {
  if (!previewBox) return;
  previewBox.innerHTML = "";
  files.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = e => {
      const wrapper = document.createElement("div");
      wrapper.className = "relative";

      const img = document.createElement("img");
      img.src = e.target.result;
      img.alt = "عکس محصول";
      img.className = "w-20 h-20 object-cover rounded-xl border shadow";

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "absolute top-1 right-1 bg-white rounded-full shadow p-1 text-gray-500 hover:bg-red-100 hover:text-red-500";
      removeBtn.title = "حذف عکس";
      removeBtn.addEventListener("click", () => removeImage(idx));
      removeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/></svg>';

      wrapper.appendChild(img);
      wrapper.appendChild(removeBtn);
      previewBox.appendChild(wrapper);
    };
    reader.readAsDataURL(file);
  });
}

if (imgInput && previewBox && imgErrorMsg) {
  imgInput.addEventListener("change", function (event) {
    const files = Array.from(event.target.files || []);
    window._productFiles = files;
    imgErrorMsg.classList.add("hidden");
    if (files.length === 0) {
      previewBox.innerHTML = "";
      return;
    }
    renderNewImages(files);
    if (files.length < 3) {
      imgErrorMsg.classList.remove("hidden");
      imgErrorMsg.innerText = "حداقل ۳ عکس الزامی است.";
    } else {
      imgErrorMsg.classList.add("hidden");
    }
  });
}

function removeImage(index) {
  if (!imgInput || !previewBox || !imgErrorMsg) return;
  const files = Array.from(window._productFiles || []);
  files.splice(index, 1);
  window._productFiles = files;

  const dataTransfer = new DataTransfer();
  files.forEach(f => dataTransfer.items.add(f));
  imgInput.files = dataTransfer.files;

  previewBox.innerHTML = "";
  if (files.length) {
    renderNewImages(files);
  }

  if (files.length < 3) {
    imgErrorMsg.classList.remove("hidden");
  } else {
    imgErrorMsg.classList.add("hidden");
  }
}

// ----------- افزودن محصول جدید (متصل به دیتابیس) ----------
const addProductFormEl = document.getElementById("addProductForm");
if (addProductFormEl) addProductFormEl.addEventListener("submit", async function (e) {
  e.preventDefault();

  // چک کردن seller و id از window.seller به جای localStorage
  if (!window.seller?.id) {
    alert("اطلاعات فروشنده ناقص است. لطفاً دوباره وارد شوید.");
    window.location.href = "login.html";
    return;
  }

  const form = e.target;
  const files = imgInput ? Array.from(imgInput.files || []) : [];
  if (files.length < 3) {
    imgErrorMsg.classList.remove("hidden");
    imgErrorMsg.innerText = "حداقل ۳ عکس الزامی است.";
    imgInput.focus();
    return;
  }

  // درست کردن برچسب‌ها (tags)
  let tags = [];
  if (form.tags) {
    tags = form.tags.value.split(',').map(t => t.trim()).filter(Boolean);
  } else if (form.tag) {
    tags = [form.tag.value.trim()];
  }

  // سقف تخفیف
  const discountCeilingValue = form.discountCeiling ? parseInputNumber(form.discountCeiling.value) : 0;
  const priceValue = Number(form.price.value);
  
  // Validation: discount ceiling cannot exceed price
  if (discountCeilingValue > 0 && discountCeilingValue > priceValue) {
    if (discountCeilingError) discountCeilingError.classList.remove('hidden');
    return;
  }

  const formData = new FormData();
  formData.append('sellerId', window.seller.id);
  formData.append('title', form.title.value.trim());
  formData.append('price', priceValue);
  formData.append('category', form.category.value.trim());
  formData.append('tags', tags.join(','));
  formData.append('desc', form.desc.value.trim());
  
  // Add discount ceiling if provided
  if (discountCeilingValue > 0) {
    formData.append('discountCeiling', discountCeilingValue);
    formData.append('isNegotiable', 'true');
  }
  
  files.forEach((file) => formData.append('images', file));

  try {
    const res = await apiFetch('/api/products', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (res.ok) {
      form.reset();
      window._productFiles = [];
      previewBox.innerHTML = "";
      imgErrorMsg.classList.add("hidden");
      // Reset discount ceiling preview
      if (discountCeilingPreview) discountCeilingPreview.classList.add('hidden');
      if (discountCeilingError) discountCeilingError.classList.add('hidden');
      showProductSuccessPopup(); // پاپ‌آپ شیک و جدید نمایش داده میشه
      if (typeof renderProducts === "function") renderProducts();
    } else {
      alert(result.message || "خطا در ثبت محصول!");
    }
  } catch (err) {
    alert("خطا در اتصال به سرور.");
    console.error(err);
  }
});
// ----------- نمایش محصولات (دریافت از سرور) ----------
async function renderProducts() {
  if (!window.seller?.id) {
    alert("اطلاعات فروشنده ناقص است. لطفاً دوباره وارد شوید.");
    window.location.href = "login.html";
    return;
  }

  ensureProductManagementControls();

  const tbody = document.getElementById('productsTableBody');
  const mobileList = document.getElementById('productsMobileList');
  const noProductMsg = document.getElementById('noProductMsg');
  if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="product-empty-inline">در حال بارگذاری محصولات...</td></tr>`;
  if (mobileList) mobileList.innerHTML = `<div class="product-empty-inline">در حال بارگذاری محصولات...</div>`;
  noProductMsg?.classList.add('hidden');

  try {
    const res = await apiFetch(`/api/products?sellerId=${window.seller.id}`);
    if (!res.ok) throw new Error("مشکل در دریافت محصولات");
    const products = await res.json();

    productManagementState.products = Array.isArray(products) ? products : [];
    window._allProducts = productManagementState.products;
    document.dispatchEvent(new CustomEvent('products:updated', { detail: { products: productManagementState.products } }));

    if (productManagementState.products.length) {
      updateProductLikeSnapshot(productManagementState.products, { notify: likeNotificationsPrimed });
    }

    renderProductManagementList();
  } catch (err) {
    productManagementState.products = [];
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-6">خطا در دریافت محصولات!</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<div class="text-center text-red-500 py-6">خطا در دریافت محصولات!</div>`;
    noProductMsg?.classList.add('hidden');
  }
}


// ----------- حذف محصول (دیتابیس) ----------
function setupMobileProductCard(card, prod) {
  if (!card || !prod) return;

  const shell = card.firstElementChild;
  const media = shell?.firstElementChild;
  const body = media?.nextElementSibling;
  const title = body?.querySelector('h3');
  const oldPrice = body?.querySelector('.text-\\[\\#0ea5e9\\]');
  const categoryRow = oldPrice?.closest('.flex.items-center.justify-between');
  const stockRow = body?.querySelector('.stock-toggle-mobile');
  const likesRow = body?.querySelector('.like-chip__mobile')?.closest('.flex');
  const actionsRow = body?.querySelector('[data-action="edit-product"]')?.parentElement;

  if (media) media.className = 'seller-product-card__media';
  if (body) body.className = 'seller-product-card__body';
  if (title) title.className = 'seller-product-card__title line-clamp-2';
  if (stockRow) stockRow.classList.add('seller-product-card__status-row');
  if (likesRow) likesRow.classList.add('seller-product-card__likes');

  if (categoryRow) {
    categoryRow.className = 'seller-product-card__meta';
    const oldPriceWrap = oldPrice?.closest('.flex.items-center.gap-2');
    if (oldPriceWrap) oldPriceWrap.remove();
  }

  if (actionsRow) {
    actionsRow.className = 'seller-product-card__actions';
    const editBtn = actionsRow.querySelector('[data-action="edit-product"]');
    const deleteBtn = actionsRow.querySelector('[data-action="delete-product"]');
    if (editBtn) editBtn.className = 'seller-product-card__action seller-product-card__action--edit';
    if (deleteBtn) deleteBtn.className = 'seller-product-card__action seller-product-card__action--delete';
  }

  setupProductCardImageTools(media, prod);

  const quickPrice = document.createElement('div');
  quickPrice.className = 'seller-product-price';
  quickPrice.dataset.productId = prod._id;
  quickPrice.innerHTML = `
    <div class="seller-product-price__row">
      <div>
        <span class="seller-product-price__label">قیمت فروش</span>
        <strong class="seller-product-card__price-value ${prod.inStock === false ? 'line-through opacity-60' : ''}" data-price-display>${formatProductPrice(prod.price)}</strong>
      </div>
      <button type="button" class="seller-product-price__edit" data-action="quick-price">
        <i class="ri-edit-2-line" aria-hidden="true"></i>
        تغییر قیمت
      </button>
    </div>
    <div class="seller-product-price__form" data-price-form>
      <input class="seller-product-price__input" data-price-input inputmode="numeric" pattern="[0-9]*" value="${prod.price || ''}" aria-label="قیمت جدید">
      <button type="button" class="seller-product-price__save" data-action="save-price" aria-label="ذخیره قیمت">
        <i class="ri-check-line" aria-hidden="true"></i>
      </button>
      <button type="button" class="seller-product-price__cancel" data-action="cancel-price" aria-label="لغو تغییر قیمت">
        <i class="ri-close-line" aria-hidden="true"></i>
      </button>
      <span class="seller-product-price__error" data-price-error>قیمت باید عددی بزرگ‌تر از صفر باشد.</span>
    </div>
  `;
  title?.insertAdjacentElement('afterend', quickPrice);

  quickPrice.querySelector('[data-action="quick-price"]')?.addEventListener('click', () => openQuickPriceEditor(quickPrice));
  quickPrice.querySelector('[data-action="cancel-price"]')?.addEventListener('click', () => closeQuickPriceEditor(quickPrice, prod.price));
  quickPrice.querySelector('[data-action="save-price"]')?.addEventListener('click', () => saveQuickProductPrice(quickPrice, prod._id));
  const priceInput = quickPrice.querySelector('[data-price-input]');
  priceInput?.addEventListener('input', (event) => {
    const numericValue = normalizeProductPriceInput(event.target.value);
    if (event.target.value !== numericValue) {
      event.target.value = numericValue;
    }
    quickPrice.classList.remove('has-error');
  });
  priceInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') saveQuickProductPrice(quickPrice, prod._id);
    if (event.key === 'Escape') closeQuickPriceEditor(quickPrice, prod.price);
  });
}

function getProductCardImages(media, prod) {
  const images = Array.isArray(prod?.images)
    ? prod.images.filter((src) => typeof src === 'string' && src.trim())
    : [];
  if (images.length) return images;

  const fallback = media?.querySelector('img')?.getAttribute('src');
  return fallback ? [fallback] : [];
}

function setupProductCardImageTools(media, prod) {
  if (!media || media.querySelector('.seller-product-card__image-tools')) return;

  const img = media.querySelector('img');
  const images = getProductCardImages(media, prod);
  if (!img || !images.length) return;

  const initialIndex = Number.isInteger(prod?.mainImageIndex) && images[prod.mainImageIndex]
    ? prod.mainImageIndex
    : Math.max(0, images.indexOf(img.getAttribute('src')));
  media.dataset.imageIndex = String(initialIndex);
  img.src = images[initialIndex] || images[0];
  if (images.length <= 1) return;

  const tools = document.createElement('div');
  tools.className = 'seller-product-card__image-tools';
  tools.innerHTML = `
    <button type="button" class="seller-product-card__image-btn seller-product-card__image-btn--prev" data-card-image-prev aria-label="عکس قبلی">
      <i class="ri-arrow-left-s-line" aria-hidden="true"></i>
    </button>
    <button type="button" class="seller-product-card__image-btn seller-product-card__image-btn--next" data-card-image-next aria-label="عکس بعدی">
      <i class="ri-arrow-right-s-line" aria-hidden="true"></i>
    </button>
  `;

  media.appendChild(tools);
  const zoomBtn = document.createElement('button');
  zoomBtn.type = 'button';
  zoomBtn.className = 'seller-product-card__image-zoom';
  zoomBtn.setAttribute('aria-label', 'بزرگ‌نمایی عکس محصول');
  zoomBtn.innerHTML = '<i class="ri-fullscreen-line" aria-hidden="true"></i>';
  media.appendChild(zoomBtn);

  const sync = (index) => {
    const safeIndex = ((index % images.length) + images.length) % images.length;
    media.dataset.imageIndex = String(safeIndex);
    img.src = images[safeIndex];
  };

  sync(initialIndex);

  tools.querySelector('[data-card-image-prev]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    sync((Number(media.dataset.imageIndex) || 0) - 1);
  });

  tools.querySelector('[data-card-image-next]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    sync((Number(media.dataset.imageIndex) || 0) + 1);
  });

  zoomBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    openProductCardImageViewer({
      images,
      index: Number(media.dataset.imageIndex) || 0,
      title: prod?.title || 'عکس محصول'
    });
  });
}

function ensureProductCardImageViewer() {
  let viewer = document.getElementById('productCardImageViewer');
  if (viewer) return viewer;

  viewer = document.createElement('div');
  viewer.id = 'productCardImageViewer';
  viewer.className = 'edit-image-viewer product-card-image-viewer';
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-hidden', 'true');
  viewer.innerHTML = `
    <div class="edit-image-viewer__card">
      <div class="edit-image-viewer__header">
        <div>
          <h3 class="edit-image-viewer__title" id="productCardImageViewerTitle">مشاهده عکس محصول</h3>
          <span class="edit-image-viewer__count" id="productCardImageViewerCount">۱ از ۱</span>
        </div>
        <button type="button" class="edit-image-viewer__close" data-close-product-card-viewer aria-label="بستن نمایش عکس">
          <i class="ri-close-line" aria-hidden="true"></i>
        </button>
      </div>
      <div class="edit-image-viewer__media">
        <button type="button" class="edit-image-viewer__nav edit-image-viewer__nav--prev" id="productCardImageViewerPrev" aria-label="عکس قبلی">
          <i class="ri-arrow-left-s-line" aria-hidden="true"></i>
        </button>
        <img class="edit-image-viewer__img" id="productCardImageViewerImg" src="" alt="عکس محصول">
        <button type="button" class="edit-image-viewer__nav edit-image-viewer__nav--next" id="productCardImageViewerNext" aria-label="عکس بعدی">
          <i class="ri-arrow-right-s-line" aria-hidden="true"></i>
        </button>
      </div>
      <div class="edit-image-viewer__footer">
        <p class="edit-image-viewer__hint">با دکمه‌های کناری بین عکس‌های محصول جابه‌جا شوید.</p>
      </div>
    </div>
  `;
  document.body.appendChild(viewer);

  viewer.addEventListener('click', (event) => {
    if (event.target === viewer || event.target.closest('[data-close-product-card-viewer]')) {
      closeProductCardImageViewer();
    }
  });
  viewer.querySelector('#productCardImageViewerPrev')?.addEventListener('click', () => moveProductCardImageViewer(-1));
  viewer.querySelector('#productCardImageViewerNext')?.addEventListener('click', () => moveProductCardImageViewer(1));

  return viewer;
}

function openProductCardImageViewer({ images, index = 0, title = 'عکس محصول' }) {
  const viewer = ensureProductCardImageViewer();
  window._productCardImageViewerState = {
    images: Array.isArray(images) ? images : [],
    index,
    title
  };
  viewer.classList.add('active');
  viewer.setAttribute('aria-hidden', 'false');
  syncProductCardImageViewer();
}

function closeProductCardImageViewer() {
  const viewer = document.getElementById('productCardImageViewer');
  if (!viewer) return;
  viewer.classList.remove('active');
  viewer.setAttribute('aria-hidden', 'true');
}

function moveProductCardImageViewer(delta) {
  const state = window._productCardImageViewerState;
  if (!state || !state.images?.length) return;
  state.index = ((state.index + delta) % state.images.length + state.images.length) % state.images.length;
  syncProductCardImageViewer();
}

function syncProductCardImageViewer() {
  const viewer = ensureProductCardImageViewer();
  const state = window._productCardImageViewerState;
  if (!state || !state.images?.length) {
    closeProductCardImageViewer();
    return;
  }

  state.index = Math.max(0, Math.min(state.index || 0, state.images.length - 1));
  const img = viewer.querySelector('#productCardImageViewerImg');
  const title = viewer.querySelector('#productCardImageViewerTitle');
  const count = viewer.querySelector('#productCardImageViewerCount');
  const prev = viewer.querySelector('#productCardImageViewerPrev');
  const next = viewer.querySelector('#productCardImageViewerNext');

  if (img) img.src = state.images[state.index];
  if (title) title.textContent = state.title || 'مشاهده عکس محصول';
  if (count) count.textContent = `${(state.index + 1).toLocaleString('fa-IR')} از ${state.images.length.toLocaleString('fa-IR')}`;
  if (prev) prev.disabled = state.images.length <= 1;
  if (next) next.disabled = state.images.length <= 1;
}

function openQuickPriceEditor(container) {
  const input = container?.querySelector('[data-price-input]');
  if (!container || !input) return;
  container.classList.add('is-editing');
  container.classList.remove('has-error');
  input.value = normalizeProductPriceInput(input.value);
  input.focus();
  input.select();
}

function closeQuickPriceEditor(container, fallbackPrice) {
  const input = container?.querySelector('[data-price-input]');
  if (!container || !input) return;
  container.classList.remove('is-editing', 'has-error');
  input.value = fallbackPrice || '';
}

async function saveQuickProductPrice(container, productId) {
  const input = container?.querySelector('[data-price-input]');
  const display = container?.querySelector('[data-price-display]');
  const saveBtn = container?.querySelector('[data-action="save-price"]');
  if (!container || !input || !display || !productId) return;

  const price = parseProductPrice(input.value);
  if (price <= 0) {
    container.classList.add('has-error');
    input.focus();
    return;
  }

  container.classList.remove('has-error');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="ri-loader-4-line" style="animation: spin 0.8s linear infinite;" aria-hidden="true"></i>';
  }

  try {
    const res = await apiFetch(`/api/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || 'price-update-failed');

    display.textContent = formatProductPrice(price);
    input.value = price;
    container.classList.remove('is-editing');

    const product = (window._allProducts || []).find((item) => item._id === productId);
    if (product) product.price = price;
    showStockToast('قیمت محصول به‌روزرسانی شد ✓', 'success');
  } catch (err) {
    container.classList.add('has-error');
    const error = container.querySelector('[data-price-error]');
    if (error) error.textContent = 'قیمت ذخیره نشد. دوباره تلاش کنید.';
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="ri-check-line" aria-hidden="true"></i>';
    }
  }
}

async function deleteProduct(productId) {
  if (!confirm("آیا از حذف این محصول مطمئن هستید؟")) return;
  try {
    const res = await apiFetch(`/api/products/${productId}`, { method: 'DELETE' });
    const result = await res.json();
    if (res.ok) {
      renderProducts();
    } else {
      alert(result.message || "خطا در حذف محصول!");
    }
  } catch (err) {
    alert("خطا در ارتباط با سرور!");
  }
}

// ----------- مدال و فرم ویرایش محصول (دیتابیس) ----------
  // ----------- مدال و فرم ویرایش محصول (دیتابیس) با مدیریت تا ۳ عکس ----------

  function showEditModal(productId) {
    const products = window._allProducts || [];
    const prod = products.find(p => p._id === productId);
    if (!prod) return alert("محصول پیدا نشد!");

    const modal = document.getElementById("editProductModal");
    modal.style.display = "flex";
    setEditModalUiState(true);
    closeEditImageLimitPopup();
    toggleInstallCtaVisibility(true);
    const form = document.getElementById("editProductForm");

    // مقداردهی input مخفی productId
    form.productId.value = prod._id || "";
    form.title.value = prod.title || "";
    form.price.value = prod.price || "";
    form.category.value = prod.category || "";
    form.desc.value = prod.desc || "";
    if (form.discountCeiling) {
      form.discountCeiling.value = prod.discountCeiling ? formatPersianNumber(Number(prod.discountCeiling) || 0) : "";
      updateEditDiscountCeilingPreview();
    }

    // مقداردهی تگ (فقط یکی)
    const tagValue = (prod.tags && prod.tags.length) ? prod.tags[0] : "";
    const radios = form.querySelectorAll('input[name="tag"]');
    radios.forEach(radio => {
      radio.checked = (radio.value === tagValue);
    });

    // مقداردهی عکس‌های قبلی
    window._editOldImages = Array.isArray(prod.images) ? [...prod.images] : [];
    // مقداردهی ایندکس عکس شاخص (اگر در محصول وجود داشت، مقدارش رو ست کن، وگرنه ۰)
    window._editMainIndex =
      typeof prod.mainImageIndex === "number" &&
      prod.mainImageIndex < (prod.images || []).length
        ? prod.mainImageIndex
        : 0;
    // عکس‌های جدیدی که موقع ویرایش اضافه می‌شوند
    window._editNewImages = [];
    renderEditImagePreview();

    // ریست input فایل برای اضافه‌کردن عکس جدید
    const input = document.getElementById("editProductImagesInput");
    if (input) input.value = "";
  }
  
  // Expose showEditModal globally for stale products modal
  window.showEditModal = showEditModal;

  function setEditModalUiState(isOpen) {
    document.body.classList.toggle('edit-product-modal-open', !!isOpen);
  }

  function showEditImageLimitPopup() {
    const popup = document.getElementById('editImageLimitPopup');
    if (!popup) return;
    const input = document.getElementById("editProductImagesInput");
    if (input) input.blur();
    popup.classList.add('active');
    popup.setAttribute('aria-hidden', 'false');
  }

  function closeEditImageLimitPopup() {
    const popup = document.getElementById('editImageLimitPopup');
    if (!popup) return;
    popup.classList.remove('active');
    popup.setAttribute('aria-hidden', 'true');
  }

  function getEditImageCount() {
    return (window._editOldImages || []).length + (window._editNewImages || []).length;
  }

  function getEditImages() {
    return [...(window._editOldImages || []), ...(window._editNewImages || [])];
  }

  window._editImageViewerIndex = 0;


  // پیش‌نمایش عکس‌های ویرایش (قبلی + جدید)
  // فرض می‌کنیم متغیر window._editMainIndex شماره عکس شاخصه (ایندکس در مجموع عکس‌های فعلی)
  function renderEditImagePreview() {
    const preview = document.getElementById("editImagePreview");
    preview.innerHTML = "";
    const images = getEditImages();
    // اگه شاخص از محدوده خارج شده بود، صفر کن
    if (typeof window._editMainIndex !== "number" || window._editMainIndex >= images.length) {
      window._editMainIndex = 0;
    }
    images.forEach((img, idx) => {
      const isMain = idx === window._editMainIndex;
      const div = document.createElement("div");
      div.className = "edit-image-thumb";

      const imageEl = document.createElement("img");
      imageEl.src = img;
      imageEl.alt = "عکس محصول";
      imageEl.className = isMain ? 'is-main' : '';
      imageEl.title = isMain ? 'عکس شاخص - برای مشاهده بزرگ‌تر کلیک کنید' : 'برای مشاهده بزرگ‌تر کلیک کنید';
      imageEl.addEventListener('click', () => openEditImageViewer(idx));

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "edit-image-thumb__remove";
      removeBtn.title = "حذف عکس";
      removeBtn.setAttribute('aria-label', 'حذف عکس');
      const isOld = idx < window._editOldImages.length;
      removeBtn.addEventListener('click', () => removeEditImage(isOld ? 'old' : 'new', isOld ? idx : idx - window._editOldImages.length));
      removeBtn.innerHTML = '<i class="ri-close-line" aria-hidden="true"></i>';

      div.appendChild(imageEl);
      div.appendChild(removeBtn);
      if (isMain) {
        const badge = document.createElement('span');
        badge.className = 'edit-image-thumb__main';
        badge.textContent = 'شاخص';
        div.appendChild(badge);
      }

      preview.appendChild(div);
    });
  }



  // حذف عکس (قدیمی یا جدید)
  function syncEditImageViewer() {
    const viewer = document.getElementById('editImageViewer');
    const imageEl = document.getElementById('editImageViewerImg');
    const countEl = document.getElementById('editImageViewerCount');
    const setMainBtn = document.getElementById('editImageViewerSetMain');
    const prevBtn = document.getElementById('editImageViewerPrev');
    const nextBtn = document.getElementById('editImageViewerNext');
    const images = getEditImages();
    if (!viewer || !imageEl || !countEl || !setMainBtn || !images.length) {
      closeEditImageViewer();
      return;
    }

    window._editImageViewerIndex = Math.max(0, Math.min(window._editImageViewerIndex || 0, images.length - 1));
    const index = window._editImageViewerIndex;
    imageEl.src = images[index];
    countEl.textContent = `${(index + 1).toLocaleString('fa-IR')} از ${images.length.toLocaleString('fa-IR')}`;

    const isMain = index === window._editMainIndex;
    setMainBtn.classList.toggle('is-main', isMain);
    setMainBtn.disabled = isMain;
    setMainBtn.innerHTML = isMain
      ? '<i class="ri-checkbox-circle-line" aria-hidden="true"></i> عکس شاخص فعلی'
      : '<i class="ri-star-smile-line" aria-hidden="true"></i> انتخاب به عنوان عکس شاخص';

    if (prevBtn) prevBtn.disabled = index <= 0;
    if (nextBtn) nextBtn.disabled = index >= images.length - 1;
  }

  function openEditImageViewer(index) {
    const viewer = document.getElementById('editImageViewer');
    if (!viewer) return;
    window._editImageViewerIndex = index || 0;
    viewer.classList.add('active');
    viewer.setAttribute('aria-hidden', 'false');
    syncEditImageViewer();
  }

  function closeEditImageViewer() {
    const viewer = document.getElementById('editImageViewer');
    if (!viewer) return;
    viewer.classList.remove('active');
    viewer.setAttribute('aria-hidden', 'true');
  }

  function moveEditImageViewer(delta) {
    window._editImageViewerIndex = (window._editImageViewerIndex || 0) + delta;
    syncEditImageViewer();
  }

  function removeEditImage(type, idx) {
    if (type === "old") window._editOldImages.splice(idx, 1);
    if (type === "new") window._editNewImages.splice(idx, 1);
    renderEditImagePreview();
  }

  // وقتی عکس جدید انتخاب شد
  function previewEditImages(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    // بیشتر از ۳ تا نشه
    let remain = 3 - getEditImageCount();
    if (remain <= 0) {
      event.target.value = "";
      showEditImageLimitPopup();
      return;
    }
    if (files.length > remain) {
      showEditImageLimitPopup();
    }
    for (let i = 0; i < Math.min(remain, files.length); i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = e => {
        window._editNewImages.push(e.target.result);
        renderEditImagePreview();
      };
      reader.readAsDataURL(file);
    }
    // ریست input برای آپلود دوباره
    event.target.value = "";
  }

  // بستن مدال ویرایش
  function closeEditModal() {
    const modal = document.getElementById("editProductModal");
    if (modal) modal.style.display = "none";
    setEditModalUiState(false);
    closeEditImageViewer();
    closeEditImageLimitPopup();
    toggleInstallCtaVisibility(false);
  }

  function toggleInstallCtaVisibility(hidden) {
    const cta = document.getElementById('installAppCta');
    if (!cta) return;
    cta.classList.toggle('hidden', !!hidden);
  }

  const editImagesInputEl = document.getElementById("editProductImagesInput");
  const editAddImageActionEl = document.querySelector('.edit-add-image-action');
  if (editAddImageActionEl) {
    editAddImageActionEl.addEventListener("click", (event) => {
      if (getEditImageCount() >= 3) {
        event.preventDefault();
        event.stopPropagation();
        if (editImagesInputEl) editImagesInputEl.value = "";
        showEditImageLimitPopup();
      }
    });
  }

  if (editImagesInputEl) {
    editImagesInputEl.addEventListener("click", (event) => {
      if (getEditImageCount() >= 3) {
        event.preventDefault();
        event.stopPropagation();
        editImagesInputEl.value = "";
        showEditImageLimitPopup();
      }
    });
    editImagesInputEl.addEventListener("change", previewEditImages);
  }

  const editModalCloseBtn = document.getElementById('editModalClose');
  if (editModalCloseBtn) {
    editModalCloseBtn.addEventListener('click', () => closeEditModal());
  }

  document.querySelectorAll('[data-close-edit-product]').forEach((button) => {
    button.addEventListener('click', () => closeEditModal());
  });

  const editImageViewer = document.getElementById('editImageViewer');
  if (editImageViewer) {
    editImageViewer.addEventListener('click', (event) => {
      if (event.target === editImageViewer || event.target.closest('[data-close-edit-image-viewer]')) {
        closeEditImageViewer();
      }
    });
  }

  document.getElementById('editImageViewerPrev')?.addEventListener('click', () => moveEditImageViewer(-1));
  document.getElementById('editImageViewerNext')?.addEventListener('click', () => moveEditImageViewer(1));
  document.getElementById('editImageViewerSetMain')?.addEventListener('click', () => {
    setMainImageIndex(window._editImageViewerIndex || 0);
    syncEditImageViewer();
  });

  document.addEventListener('keydown', (event) => {
    const cardViewer = document.getElementById('productCardImageViewer');
    if (cardViewer && cardViewer.classList.contains('active')) {
      if (event.key === 'Escape') closeProductCardImageViewer();
      if (event.key === 'ArrowLeft') moveProductCardImageViewer(-1);
      if (event.key === 'ArrowRight') moveProductCardImageViewer(1);
      return;
    }

    const viewer = document.getElementById('editImageViewer');
    if (!viewer || !viewer.classList.contains('active')) return;
    if (event.key === 'Escape') closeEditImageViewer();
    if (event.key === 'ArrowLeft') moveEditImageViewer(-1);
    if (event.key === 'ArrowRight') moveEditImageViewer(1);
  });

  // ارسال فرم ویرایش محصول
  const editImageLimitPopup = document.getElementById('editImageLimitPopup');
  if (editImageLimitPopup) {
    editImageLimitPopup.addEventListener('click', (event) => {
      if (event.target === editImageLimitPopup || event.target.closest('[data-close-edit-image-limit]')) {
        closeEditImageLimitPopup();
      }
    });
  }

  const editForm = document.getElementById("editProductForm");
  if (editForm) editForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    const productId = this.productId.value;
    const priceValue = parseInputNumber(this.price.value);
    const discountCeilingValue = this.discountCeiling ? parseInputNumber(this.discountCeiling.value) : 0;

    if (discountCeilingValue > 0 && discountCeilingValue > priceValue) {
      updateEditDiscountCeilingPreview();
      this.discountCeiling?.focus();
      return;
    }

    // مقدار برچسب (تگ) فقط از رادیو
    let tagValue = "";
    const tagRadio = this.querySelector('input[name="tag"]:checked');
    if (tagRadio) tagValue = tagRadio.value.trim();

    // ترکیب عکس‌های قبلی و جدید، حداکثر ۳ تا
    const allImages = [...(window._editOldImages || []), ...(window._editNewImages || [])].slice(0, 3);

    // افزودن mainImageIndex برای ذخیره عکس شاخص
    let updatedFields = {
      title: this.title.value.trim(),
      price: priceValue,
      category: this.category.value.trim(),
      tags: tagValue ? [tagValue] : [],
      desc: this.desc.value.trim(),
      images: allImages,
      mainImageIndex: typeof window._editMainIndex === "number" ? window._editMainIndex : 0,
      discountCeiling: discountCeilingValue > 0 ? discountCeilingValue : null,
      isNegotiable: discountCeilingValue > 0,
    };

    try {
      const res = await apiFetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
      const result = await res.json();
      if (res.ok) {
        closeEditModal();
        renderProducts();
        
        // Mark product as edited for stale products reward tracking
        if (typeof window.markStaleProductAsEdited === 'function') {
          window.markStaleProductAsEdited(productId);
        }
      } else {
        alert(result.message || "خطا در ویرایش محصول!");
      }
    } catch (err) {
      alert("خطا در ارتباط با سرور!");
    }
  });



  // ----------- هر بار وارد مدیریت محصولات شد ----------
  function setupProductSection() {
    renderProducts();
  }







function setMainImageIndex(idx) {
  window._editMainIndex = idx;
  renderEditImagePreview();
}



  // --- لود کردن محتوای dashboard-content.html و اجرای اسکریپت‌های داخل آن ---
  // لود کردن محتوای dashboard-content.html و اجرای اسکریپت‌ها
  async function loadDashboardContent() {
    const mainContent = document.getElementById("main-content");
    mainContent.innerHTML = '<div class="text-gray-400 text-center py-8">در حال بارگذاری ...</div>';
    try {
      const res = await fetch("dashboard-content.html");
      if (!res.ok) throw new Error("خطا در دریافت محتوا");
      const html = await res.text();

      // 1. اسکریپت‌ها رو جدا کن
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const scripts = tempDiv.querySelectorAll("script");
      scripts.forEach(script => script.remove());

      // 2. فقط HTML بدون اسکریپت رو بریز
      mainContent.innerHTML = tempDiv.innerHTML;

      // 3. هر اسکریپت جداگانه اضافه کن (تا اجرا بشه)
      scripts.forEach(script => {
        const newScript = document.createElement("script");
        if (script.src) {
          newScript.src = script.src;
        } else {
          newScript.textContent = script.textContent;
        }
        document.body.appendChild(newScript);
      });

      // 4. در صورت وجود تابع initContentDashboard، اجراش کن
      setTimeout(() => {
        if (typeof initContentDashboard === "function") {
          initContentDashboard();
        }
      }, 0);

    } catch (err) {
      mainContent.innerHTML = `<div class="text-red-500 text-center py-8">بارگذاری محتوا با مشکل مواجه شد!</div>`;
    }
  }

  // رویداد کلیک منوی مدیریت ظاهر فروشگاه
  const menuContentBtn = document.getElementById("menu-content");
  if (menuContentBtn) {
    menuContentBtn.addEventListener("click", function() {
      showSection('content');
      loadDashboardContent();
      // بستن سایدبار در موبایل
      const sidebar = document.getElementById('sidebar');
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (sidebar && sidebar.classList.contains('expanded') && isMobile) {
        toggleSidebar();
      }
    });
  }





  /// --- لود کردن محتوای dashboard-logo.html و اجرای اسکریپت‌های لازم ---
  window.loadDashboardLogo = async function loadDashboardLogo() {
    const mainContent = document.getElementById("main-content");
    mainContent.innerHTML = '<div class="text-gray-400 text-center py-8">در حال بارگذاری ...</div>';
    
    // مخفی کردن سایر سکشن‌ها
    document.querySelectorAll("section[id^='section-']").forEach(sec => sec.style.display = 'none');
    
    // هایلایت منوی تابلو فروشگاه
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
    const notifBtn = document.getElementById('menu-notif');
    if (notifBtn) notifBtn.classList.add('active');
    
    try {
      const res = await fetch("dashboard-logo.html");
      if (!res.ok) throw new Error("خطا در دریافت محتوا");
      const html = await res.text();

      // تزریق HTML
      mainContent.innerHTML = html;

      // لود و اجرای اسکریپت
      loadDashboardLogoScript(function() {
        // بعد از لود شدن اسکریپت، اجرای تابع مقداردهی
        if (typeof initLogoDashboard === "function") {
          initLogoDashboard().catch(err => {
            console.error('Error initializing logo dashboard:', err);
          });
        }
      });
    } catch (err) {
      console.error('Error loading logo dashboard:', err);
      mainContent.innerHTML = `<div class="text-red-500 text-center py-8">بارگذاری محتوا با مشکل مواجه شد!</div>`;
    }
  }

  // رویداد کلیک منوی تابلو فروشگاه
  const menuNotifBtn = document.getElementById("menu-notif");
  if (menuNotifBtn && !menuNotifBtn.dataset.listener) {
    menuNotifBtn.addEventListener("click", function() {
      window.loadDashboardLogo();
      // بستن سایدبار در موبایل
      const sidebar = document.getElementById('sidebar');
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (sidebar && sidebar.classList.contains('expanded') && isMobile) {
        toggleSidebar();
      }
    });
    menuNotifBtn.dataset.listener = '1';
  }

  // تابع برای لود اسکریپت
  function loadDashboardLogoScript(callback) {
    // حذف اسکریپت قبلی برای اجازه اجرای مجدد
    const oldScript = document.getElementById('dashboard-logo-script');
    if (oldScript) oldScript.remove();
    
    // ریست کردن flag
    window._logoDashboardInited = false;
    
    var script = document.createElement("script");
    script.id = 'dashboard-logo-script';
    script.src = "dashboard-logo.js";
    script.onload = function() {
      if (typeof callback === "function") callback();
    };
    script.onerror = function() {
      console.error('Failed to load dashboard-logo.js');
    };
    document.body.appendChild(script);
  }






  // --- loader بخش ارتقا (کاملاً تضمینی برای اجرای صحیح اسکریپت) ---
  /* -------------------------------------------------
   ❶ لودِ صفحه و اسکریپت ارتقا
   ------------------------------------------------- */
  async function loadDashboardUpgrade () {
    const main = document.getElementById('main-content');
    main.innerHTML =
      '<div class="text-gray-400 text-center py-8">در حال بارگذاری …</div>';

    try {
      /* 1) دریافت و تزریق HTML */
      const res = await fetch('dashboard-upgrade.html');
      if (!res.ok) throw new Error('خطا در دریافت محتوا');
      const htmlText = await res.text();
      
      // استخراج فقط محتوای داخل body یا main
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      const mainContent = doc.querySelector('main') || doc.querySelector('.upgrade-section') || doc.body;
      main.innerHTML = mainContent ? mainContent.innerHTML : htmlText;

      const makeQueuedUpgradeAction = (actionName) => {
        const queuedAction = (...args) => {
          const runWhenReady = () => {
            const action = window[actionName];
            if (typeof action === 'function' && action !== queuedAction) {
              action(...args);
              return;
            }
            setTimeout(runWhenReady, 150);
          };
          runWhenReady();
        };
        return queuedAction;
      };

      if (typeof window.selectPlan !== 'function') {
        window.selectPlan = makeQueuedUpgradeAction('selectPlan');
      }
      if (typeof window.selectedPlan !== 'function') {
        window.selectedPlan = (...args) => window.selectPlan(...args);
      }
      if (typeof window.openAdModal !== 'function') {
        window.openAdModal = makeQueuedUpgradeAction('openAdModal');
      }

      /* 2) اگر اسکریپت قبلاً وجود دارد (ریفرشِ گرم)، حذفش کن تا کش نشود */
      ['upgrade-js-script', 'similar-sponsored-js-script'].forEach((id) => {
        const old = document.getElementById(id);
        if (old) old.remove();
      });

      /* 3) افزودن اسکریپت و اجرای تابع init - با تأخیر برای اطمینان از رندر کامل */
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const s = document.createElement('script');
      s.id  = 'upgrade-js-script';
      s.src = 'dashboard-upgrade.js';
      s.onload = () => {
        if (typeof bootstrapUpgradeDashboard === 'function') {
          bootstrapUpgradeDashboard();
        } else if (typeof initUpgradeDashboard === 'function') {
          initUpgradeDashboard();
        }
        const similarScript = document.createElement('script');
        similarScript.id = 'similar-sponsored-js-script';
        similarScript.src = 'similar-sponsored-promotions.js';
        document.body.appendChild(similarScript);
      };
      document.body.appendChild(s);
    } catch (err) {
      console.error(err);
      main.innerHTML =
        '<div class="text-red-500 text-center py-8">⚠️ بارگذاری بخش ارتقا شکست خورد</div>';
    }
  }

  /* -------------------------------------------------
   ❷ هندلِ کلیکِ منوی «ارتقا»
   ------------------------------------------------- */
  (function () {
    const btn = document.getElementById('menu-upgrade');
    if (!btn || btn.dataset.listener) return;      // دوبار ثبت نشود

    btn.addEventListener('click', () => {
      document.body.dataset.activeSellerSection = 'upgrade';
      document.body.classList.add('seller-section-upgrade');
      /* هایلایت منو و مخفی‌کردن سایر سکشن‌ها */
      document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll("section[id^='section-']").forEach(sec => sec.style.display = 'none');

      /* لودِ محتواى ارتقا */
      loadDashboardUpgrade();

      /* بستن سایدبار در موبایل */
      const sidebar = document.getElementById('sidebar');
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (sidebar && sidebar.classList.contains('expanded') && isMobile) {
        toggleSidebar();
      }
    });

    btn.dataset.listener = '1';
  })();







async function loadDailyVisits () {
  const main = document.getElementById('main-content');
  main.innerHTML =
    '<div class="text-gray-400 text-center py-8">در حال بارگذاری آمار …</div>';

  try {
    /* 1) دریافت و تزریق HTML */
    const res = await fetch('daily-visits.html');
    if (!res.ok) throw new Error('خطا در دریافت محتوا');
    main.innerHTML = await res.text();

    /* 2) جلوگیری از کشِ اسکریپت در رفرش گرم */
    const old = document.getElementById('daily-visits-js');
    if (old) old.remove();

    /* 3) افزودن اسکریپت و اجرای منطق */
    const s   = document.createElement('script');
    s.id  = 'daily-visits-js';
    s.src = 'daily-visits.js';
    document.body.appendChild(s);
  } catch (err) {
    console.error(err);
    main.innerHTML =
      '<div class="text-red-500 text-center py-8">⚠️ بارگذاری آمار شکست خورد</div>';
  }
}





// ─── تابع بارگذاری بخش پیام‌ها ─────────────────────────────────
let messagesLoaded = false;
let messagesChatHandled = false;
async function loadDashboardMessages() {
  const main = document.getElementById('main-content');
  const chatIdFromUrl = new URLSearchParams(window.location.search).get('chat');

  main.innerHTML = '<div class="text-gray-400 text-center py-8">در حال بارگذاری پیام‌ها …</div>';
  try {
    // ۱) دریافت HTML بخش پیام‌ها
    const res = await fetch('dashboard-messages.html');
    if (!res.ok) throw new Error('خطا در دریافت پیام‌ها');
    main.innerHTML = await res.text();

    if (!messagesLoaded) {
      // در اولین بار، اسکریپت را لود کن
      const old = document.getElementById('messages-js-script');
      if (old) old.remove();
      const s = document.createElement('script');
      s.id = 'messages-js-script';
      s.src = 'dashboard-messages.js';
      s.onload = () => {
        typeof window.initMessaging === 'function' && window.initMessaging();
        typeof window.fetchChats === 'function' && window.fetchChats();
        if (chatIdFromUrl && !messagesChatHandled && typeof window.openChatById === 'function') {
          messagesChatHandled = true;
          window.openChatById(chatIdFromUrl);
        }
      };
      document.body.appendChild(s);
      messagesLoaded = true;
    } else {
      // اگر اسکریپت قبلاً لود شده، فقط دوباره مقداردهی کن
      typeof window.initMessaging === 'function' && window.initMessaging();
      typeof window.fetchChats === 'function' && window.fetchChats();
      if (chatIdFromUrl && !messagesChatHandled && typeof window.openChatById === 'function') {
        messagesChatHandled = true;
        window.openChatById(chatIdFromUrl);
      }
    }
  } catch (err) {
    console.error(err);
    main.innerHTML = '<div class="text-red-500 text-center py-8">⚠️ بارگذاری پیام‌ها شکست خورد</div>';
  }
}


// ─── هندل کلیک روی منوی پیام‌ها ─────────────────────────────────
(function () {
const btn = document.getElementById('menu-msg');
if (!btn || btn.dataset.listener) return;
btn.addEventListener('click', () => {
  // هایلایت منو
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');
  // مخفی کردن سایر سکشن‌ها
  document.querySelectorAll("section[id^='section-']").forEach(sec => sec.style.display = 'none');
  // بارگذاری بخش پیام‌ها
  loadDashboardMessages();
  // علامت‌گذاری همه‌ی پیام‌های خوانده‌نشده
updateBadge(0);
  // بستن سایدبار در موبایل
  const sidebar = document.getElementById('sidebar');
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (sidebar && sidebar.classList.contains('expanded') && isMobile) {
    toggleSidebar();
  }
});
btn.dataset.listener = '1';
})();

// ========== Stock Toggle Handler ==========
function showStockToast(message, type = 'success') {
  // Remove existing toast
  const existingToast = document.querySelector('.stock-toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `stock-toast stock-toast--${type}`;
  toast.innerHTML = `
    <i class="ri-${type === 'success' ? 'checkbox-circle-fill' : 'error-warning-fill'}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

async function handleStockToggle(productId, inStock, containerEl) {
  try {
    const res = await apiFetch(`/api/products/${productId}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inStock })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'خطا در تغییر وضعیت موجودی');
    }

    const data = await res.json();

    // Update UI without page reload
    if (containerEl) {
      // Update label text
      const labels = containerEl.querySelectorAll('.stock-toggle__label, .stock-toggle__text');
      labels.forEach(label => {
        label.textContent = inStock ? 'موجود' : 'ناموجود';
      });

      // Update card styles for mobile
      if (containerEl.classList.contains('bg-white') || containerEl.classList.contains('seller-product-card')) {
        containerEl.classList.toggle('product-card--out-of-stock', !inStock);
        
        // Update image
        const img = containerEl.querySelector('img');
        if (img) {
          img.classList.toggle('grayscale', !inStock);
          img.classList.toggle('opacity-60', !inStock);
        }

        // Update price
        const priceEl = containerEl.querySelector('.text-\\[\\#0ea5e9\\], .seller-product-card__price-value');
        if (priceEl) {
          priceEl.classList.toggle('line-through', !inStock);
          priceEl.classList.toggle('opacity-60', !inStock);
        }

        // Update out-of-stock badge overlay
        const imageContainer = containerEl.querySelector('.relative.w-full.h-48, .seller-product-card__media');
        if (imageContainer) {
          let badge = imageContainer.querySelector('.out-of-stock-badge, .seller-product-card__stock-badge');
          if (!inStock && !badge) {
            badge = document.createElement('div');
            const isModernCard = containerEl.classList.contains('seller-product-card');
            badge.className = isModernCard
              ? 'seller-product-card__stock-badge'
              : 'out-of-stock-badge absolute inset-0 flex items-center justify-center bg-black/20';
            badge.innerHTML = '<span class="bg-gray-700 text-white text-sm font-bold px-4 py-2 rounded-full">ناموجود</span>';
            imageContainer.appendChild(badge);
          } else if (inStock && badge) {
            badge.remove();
          }
        }
      }
    }

    // Show toast notification
    showStockToast(
      inStock ? 'محصول موجود شد ✓' : 'محصول ناموجود شد',
      inStock ? 'success' : 'warning'
    );

  } catch (err) {
    console.error('Stock toggle error:', err);
    showStockToast('خطا در تغییر وضعیت موجودی', 'warning');
    
    // Revert checkbox state
    if (containerEl) {
      const checkbox = containerEl.querySelector('.stock-toggle__input');
      if (checkbox) checkbox.checked = !inStock;
    }
  }
}
// ========== End Stock Toggle Handler ==========

// گرفتن همه پیام‌ها و ذخیره در window.chats
async function fetchSellerMessages() {
  if (!window.seller?.id) return [];
  try {
    const res = await apiFetch(`/api/chats?sellerId=${window.seller.id}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    return [];
  }
}

// ─── بارگذاری وضعیت عملکرد ────────────────────────────────
async function loadPerformanceStatus() {
  const container = document.getElementById('performance-container');
  if (!container) return;
  container.style.display = 'block';
  container.innerHTML = '<div class="text-gray-400 text-center py-8">در حال بارگذاری …</div>';
  try {
    const res = await fetch('performance-status.html');
    if (!res.ok) throw new Error('خطا در دریافت محتوا');
    const html = await res.text();
    container.innerHTML = html;

    const initPerformance = window.initSellerPerformanceStatus;
    if (typeof initPerformance === 'function') {
      const rootEl = container.querySelector('#performance-root');
      initPerformance(rootEl || undefined);
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="text-red-500 text-center py-8">مشکلی در بارگذاری وضعیت عملکرد پیش آمده.</div>';
  }
}

// ─── هندل کلیک روی منوی وضعیت عملکرد ───────────────────────
(function () {
  const btn = document.getElementById('menu-performance');
  if (!btn || btn.dataset.listener) return;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll("section[id^='section-']").forEach(sec => sec.style.display = 'none');
    document.getElementById('main-content').innerHTML = '';
    loadPerformanceStatus();
    // بستن سایدبار در موبایل
    const sidebar = document.getElementById('sidebar');
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (sidebar && sidebar.classList.contains('expanded') && isMobile) {
      toggleSidebar();
    }
  });
  btn.dataset.listener = '1';
})();







// ─── Deep-link handler for upgrade section ───────────────────────
function hasUpgradeDeepLink() {
  const hash = window.location.hash || '';
  return hash.startsWith('#upgrade-special-ads');
}

function handleUpgradeDeepLinkNavigation() {
  if (!hasUpgradeDeepLink()) return;
  const upgradeSectionLoaded = document.querySelector('.upgrade-section');
  if (upgradeSectionLoaded) return;
  document.getElementById('menu-upgrade')?.click();
}

window.addEventListener('hashchange', handleUpgradeDeepLinkNavigation);
window.addEventListener('popstate', handleUpgradeDeepLinkNavigation);
document.addEventListener('DOMContentLoaded', handleUpgradeDeepLinkNavigation);
