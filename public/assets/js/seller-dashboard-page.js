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
    return seller;
  } catch (err) {
    console.error('Error fetching seller:', err);
    window.location.href = 'login.html';
    return null;
  }
}

// ————————— تابع دریافت تعداد پیام‌های خوانده‌نشده —————————
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
    if (window.innerWidth <= 768) {
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
  console.log('🚀 seller object:', window.seller);
  document.dispatchEvent(new CustomEvent('seller:ready', { detail: { seller: window.seller } }));

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

  const manualSections = new Set(['content', 'msg', 'performance']);
  document.querySelectorAll('.sidebar-link[data-section]').forEach((button) => {
    const section = button.dataset.section;
    if (!section || manualSections.has(section)) {
      return;
    }
    button.addEventListener('click', () => showSection(section));
  });

  document.querySelectorAll('.chart-tab[data-chart]').forEach((button) => {
    button.addEventListener('click', () => switchChart(button.dataset.chart));
  });

  if (window.seller?.id) {
    // ۲) شروع پولینگ‌ها
    startBadgePolling();
    startMessagePolling();

    // ۳) نمایش نام و نام‌خانوادگی فروشنده
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
  });
}










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

// ----------- بخش سوییچ بین بخش‌ها و چارت بازدید ----------
function showSection(section) {
  // اگر بخش انتخابی "content" (یعنی مدیریت ظاهر فروشگاه) نیست،
  // محتوای main-content رو پاک کن که چیزی زیر بخش جدید نمونه
  if (section !== "content" && document.getElementById('main-content')) {
    document.getElementById('main-content').innerHTML = '';
  }
  const perf = document.getElementById('performance-container');
  if (perf) perf.style.display = 'none';

  const allSections = [
    "visit", "notif", "msg", "profile", "settings", "add", "upgrade",
    "products", "content", "seo", "guide", "register-visit", "performance"
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
  if (section === 'performance') {
    loadPerformanceStatus();
  }
  if (window.innerWidth <= 768) toggleSidebar();
  if (section === "products") setupProductSection();
}

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

  const formData = new FormData();
  formData.append('sellerId', window.seller.id);
  formData.append('title', form.title.value.trim());
  formData.append('price', Number(form.price.value));
  formData.append('category', form.category.value.trim());
  formData.append('tags', tags.join(','));
  formData.append('desc', form.desc.value.trim());
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
  // seller رو اینجا از localStorage بخون تا همیشه مقدار درست داشته باشی
// اگر seller در حافظه لود نشده یا id ندارد، ریدایرکت به لاگین
if (!window.seller?.id) {
  alert("اطلاعات فروشنده ناقص است. لطفاً دوباره وارد شوید.");
  window.location.href = "login.html";
  return;
}


  // المنت‌های جدول و کارت موبایل
  const tbody = document.getElementById('productsTableBody');
  const mobileList = document.getElementById('productsMobileList');
  const noProductMsg = document.getElementById('noProductMsg');
  if (tbody) tbody.innerHTML = "";
  if (mobileList) mobileList.innerHTML = "";

  try {
    // دریافت محصولات فروشنده
  const res = await apiFetch(`/api/products?sellerId=${window.seller.id}`);
    if (!res.ok) throw new Error("مشکل در دریافت محصولات");
    const products = await res.json();

    // اگر هیچ محصولی نیست
    if (!products.length) {
      noProductMsg.classList.remove('hidden');
      document.dispatchEvent(new CustomEvent('products:updated', { detail: { products } }));
      return;
    }
    noProductMsg.classList.add('hidden');
    window._allProducts = products;
    document.dispatchEvent(new CustomEvent('products:updated', { detail: { products } }));

    // ---- رندر جدول (دسکتاپ) ----
    products.forEach((prod) => {
      const likeCountDisplay = Number(prod.likesCount || 0).toLocaleString('fa-IR');
      // تعیین عکس شاخص بر اساس mainImageIndex یا اولین عکس
      let cover = "";
      if (prod.images && prod.images.length) {
        if (typeof prod.mainImageIndex === "number" && prod.images[prod.mainImageIndex]) {
          cover = prod.images[prod.mainImageIndex];
        } else {
          cover = prod.images[0];
        }
      }
      if (tbody) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><img src="${cover}" alt="" class="w-12 h-12 object-cover rounded-lg border shadow mx-auto"/></td>
          <td>${prod.title}</td>
          <td>${prod.price ? prod.price.toLocaleString('fa-IR') : "-"}</td>
          <td>${prod.category || '-'}</td>
          <td>${prod.tags && prod.tags.length ? prod.tags.join('، ') : '-'}</td>
          <td class="text-center">
            <span class="like-chip" title="تعداد مشتری‌هایی که این محصول را پسندیده‌اند">
              <i class="ri-heart-3-fill" aria-hidden="true"></i>
              <span>${likeCountDisplay}</span>
            </span>
          </td>
          <td>
            <button class="bg-[#10b981] hover:bg-[#0ea5e9] text-white rounded-lg px-3 py-1 text-[14px] transition" data-action="edit-product" data-product-id="${prod._id}">ویرایش</button>
          </td>
          <td>
            <button class="bg-red-500 hover:bg-red-600 text-white rounded-lg px-3 py-1 text-[14px] transition" data-action="delete-product" data-product-id="${prod._id}">حذف</button>
          </td>
        `;
        tbody.appendChild(tr);
        const desktopEdit = tr.querySelector('[data-action="edit-product"]');
        const desktopDelete = tr.querySelector('[data-action="delete-product"]');
        if (desktopEdit) desktopEdit.addEventListener('click', () => showEditModal(prod._id));
        if (desktopDelete) desktopDelete.addEventListener('click', () => deleteProduct(prod._id));
      }

      // ---- رندر کارت موبایل (فقط نمایش در md و پایین‌تر) ----
      if (mobileList) {
        const card = document.createElement('div');
        card.className = "bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden transition-all hover:shadow-xl";
        card.innerHTML = `
          <div class="flex flex-col">
            <!-- تصویر محصول -->
            <div class="relative w-full h-48 bg-gradient-to-br from-gray-50 to-gray-100">
              <img src="${cover}" alt="${prod.title}" class="w-full h-full object-cover" />
              ${prod.tags && prod.tags.length ? `
                <div class="absolute top-3 right-3 bg-[#10b981] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  ${prod.tags[0]}
                </div>
              ` : ''}
            </div>

            <!-- اطلاعات محصول -->
            <div class="p-4 space-y-3">
              <!-- عنوان -->
              <h3 class="font-bold text-gray-800 text-lg leading-tight line-clamp-2">${prod.title}</h3>

              <!-- دسته‌بندی و قیمت -->
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2 text-sm text-gray-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <span class="font-medium">${prod.category || 'بدون دسته'}</span>
                </div>
                <div class="flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#0ea5e9"/>
                    <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" fill="#0ea5e9"/>
                  </svg>
                  <span class="text-[#0ea5e9] font-bold text-lg">${prod.price ? prod.price.toLocaleString('fa-IR') : '0'} تومان</span>
                </div>
              </div>

              <div class="flex items-center justify-between gap-2 flex-wrap bg-[#f8fafc] border border-gray-100 rounded-xl px-3 py-2">
                <div class="flex items-center gap-2 text-sm text-gray-500 flex-1 min-w-[200px] leading-6">
                  <i class="ri-heart-3-line text-[#e11d48] text-lg" aria-hidden="true"></i>
                  <span class="font-bold text-gray-700 text-sm leading-6">تعداد مشتری‌هایی که این محصول را پسندیده‌اند</span>
                </div>
                <div class="like-chip like-chip__mobile shadow-none">
                  <i class="ri-heart-3-fill text-[#e11d48]" aria-hidden="true"></i>
                  <span class="text-[#9f1239]">${likeCountDisplay}</span>
                </div>
              </div>

              <!-- دکمه‌های عملیات -->
              <div class="flex gap-2 pt-2 border-t border-gray-100">
                <button class="flex-1 bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white rounded-xl px-4 py-2.5 font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2" data-action="edit-product" data-product-id="${prod._id}">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  ویرایش
                </button>
                <button class="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl px-4 py-2.5 font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2" data-action="delete-product" data-product-id="${prod._id}">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  حذف
                </button>
              </div>
            </div>
          </div>
        `;
        mobileList.appendChild(card);
        const mobileEdit = card.querySelector('[data-action="edit-product"]');
        const mobileDelete = card.querySelector('[data-action="delete-product"]');
        if (mobileEdit) mobileEdit.addEventListener('click', () => showEditModal(prod._id));
        if (mobileDelete) mobileDelete.addEventListener('click', () => deleteProduct(prod._id));
      }
    });
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-6">خطا در دریافت محصولات!</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<div class="text-center text-red-500 py-6">خطا در دریافت محصولات!</div>`;
    noProductMsg.classList.add('hidden');
  }
}


// ----------- حذف محصول (دیتابیس) ----------
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
    toggleInstallCtaVisibility(true);
    const form = document.getElementById("editProductForm");

    // مقداردهی input مخفی productId
    form.productId.value = prod._id || "";
    form.title.value = prod.title || "";
    form.price.value = prod.price || "";
    form.category.value = prod.category || "";
    form.desc.value = prod.desc || "";

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


  // پیش‌نمایش عکس‌های ویرایش (قبلی + جدید)
  // فرض می‌کنیم متغیر window._editMainIndex شماره عکس شاخصه (ایندکس در مجموع عکس‌های فعلی)
  function renderEditImagePreview() {
    const preview = document.getElementById("editImagePreview");
    preview.innerHTML = "";
    const images = [...window._editOldImages, ...window._editNewImages];
    // اگه شاخص از محدوده خارج شده بود، صفر کن
    if (typeof window._editMainIndex !== "number" || window._editMainIndex >= images.length) {
      window._editMainIndex = 0;
    }
    images.forEach((img, idx) => {
      const isMain = idx === window._editMainIndex;
      const div = document.createElement("div");
      div.className = "relative group inline-block m-1";

      const imageEl = document.createElement("img");
      imageEl.src = img;
      imageEl.alt = "عکس محصول";
      imageEl.className = `w-16 h-16 object-cover rounded-xl border shadow ring-2 ${isMain ? 'ring-[#10b981]' : 'ring-transparent'} cursor-pointer`;
      imageEl.title = isMain ? 'عکس شاخص' : 'برای انتخاب عکس شاخص کلیک کنید';
      imageEl.style.transition = 'ring 0.15s';
      imageEl.addEventListener('click', () => setMainImageIndex(idx));

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "absolute top-1 right-1 bg-white rounded-full shadow p-1 text-gray-500 hover:bg-red-100 hover:text-red-500";
      removeBtn.title = "حذف عکس";
      const isOld = idx < window._editOldImages.length;
      removeBtn.addEventListener('click', () => removeEditImage(isOld ? 'old' : 'new', isOld ? idx : idx - window._editOldImages.length));
      removeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/></svg>';

      div.appendChild(imageEl);
      div.appendChild(removeBtn);
      if (isMain) {
        const badge = document.createElement('span');
        badge.className = 'absolute bottom-1 left-1 bg-[#10b981] text-white text-xs px-2 py-1 rounded-lg shadow';
        badge.textContent = 'شاخص';
        div.appendChild(badge);
      }

      preview.appendChild(div);
    });
  }



  // حذف عکس (قدیمی یا جدید)
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
    let remain = 3 - (window._editOldImages.length + window._editNewImages.length);
    if (remain <= 0) return; // ظرفیت پر
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
    document.getElementById("editProductModal").style.display = "none";
    toggleInstallCtaVisibility(false);
  }

  function toggleInstallCtaVisibility(hidden) {
    const cta = document.getElementById('installAppCta');
    if (!cta) return;
    cta.classList.toggle('hidden', !!hidden);
  }

  const editImagesInputEl = document.getElementById("editProductImagesInput");
  if (editImagesInputEl) {
    editImagesInputEl.addEventListener("change", previewEditImages);
  }

  const editModalCloseBtn = document.getElementById('editModalClose');
  if (editModalCloseBtn) {
    editModalCloseBtn.addEventListener('click', () => closeEditModal());
  }

  // ارسال فرم ویرایش محصول
  const editForm = document.getElementById("editProductForm");
  if (editForm) editForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    const productId = this.productId.value;

    // مقدار برچسب (تگ) فقط از رادیو
    let tagValue = "";
    const tagRadio = this.querySelector('input[name="tag"]:checked');
    if (tagRadio) tagValue = tagRadio.value.trim();

    // ترکیب عکس‌های قبلی و جدید، حداکثر ۳ تا
    const allImages = [...(window._editOldImages || []), ...(window._editNewImages || [])].slice(0, 3);

    // افزودن mainImageIndex برای ذخیره عکس شاخص
    let updatedFields = {
      title: this.title.value.trim(),
      price: +this.price.value,
      category: this.category.value.trim(),
      tags: tagValue ? [tagValue] : [],
      desc: this.desc.value.trim(),
      images: allImages,
      mainImageIndex: typeof window._editMainIndex === "number" ? window._editMainIndex : 0,
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
    });
  }





  /// --- لود کردن محتوای dashboard-logo.html و اجرای اسکریپت‌های لازم ---
  async function loadDashboardLogo() {
    const mainContent = document.getElementById("main-content");
    mainContent.innerHTML = '<div class="text-gray-400 text-center py-8">در حال بارگذاری ...</div>';
    try {
      const res = await fetch("dashboard-logo.html");
      if (!res.ok) throw new Error("خطا در دریافت محتوا");
      const html = await res.text();

      // فقط HTML رو بریز (اسکریپت‌ها رو جدا جدا لود می‌کنیم)
      mainContent.innerHTML = html;

      // بعدش اسکریپت مربوط به لوگو رو لود کن (اگه قبلاً لود نشده)
      loadDashboardLogoScript(function() {
        // بعد از لود شدن اسکریپت و تعریف شدن فانکشن، اجراش کن
        if (typeof initLogoDashboard === "function") {
          initLogoDashboard();
        }
      });
    } catch (err) {
      mainContent.innerHTML = `<div class="text-red-500 text-center py-8">بارگذاری محتوا با مشکل مواجه شد!</div>`;
    }
  }

  // رویداد کلیک منوی تابلو فروشگاه
  document.getElementById("menu-notif").addEventListener("click", function() {
    loadDashboardLogo();
  });

  // تابع برای لود اسکریپت فقط یک بار
  function loadDashboardLogoScript(callback) {
    if (window._logoScriptLoaded) {
      if (typeof callback === "function") callback();
      return;
    }
    var script = document.createElement("script");
    script.src = "dashboard-logo.js";
    script.onload = function() {
      window._logoScriptLoaded = true;
      if (typeof callback === "function") callback();
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
      main.innerHTML = await res.text();

      /* 2) اگر اسکریپت قبلاً وجود دارد (ریفرشِ گرم)، حذفش کن تا کش نشود */
      const old = document.getElementById('upgrade-js-script');
      if (old) old.remove();

      /* 3) افزودن اسکریپت و اجرای تابع init */
      const s = document.createElement('script');
      s.id  = 'upgrade-js-script';
      s.src = 'dashboard-upgrade.js';
      s.onload = () =>
        typeof initUpgradeDashboard === 'function' && initUpgradeDashboard();
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
      /* هایلایت منو و مخفی‌کردن سایر سکشن‌ها */
      document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll("section[id^='section-']").forEach(sec => sec.style.display = 'none');

      /* لودِ محتواى ارتقا */
      loadDashboardUpgrade();

      /* بستن سایدبار در موبایل */
      if (innerWidth <= 768) toggleSidebar();
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
async function loadDashboardMessages() {
  const main = document.getElementById('main-content');

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
      };
      document.body.appendChild(s);
      messagesLoaded = true;
    } else {
      // اگر اسکریپت قبلاً لود شده، فقط دوباره مقداردهی کن
      typeof window.initMessaging === 'function' && window.initMessaging();
      typeof window.fetchChats === 'function' && window.fetchChats();
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
  if (window.innerWidth <= 768) toggleSidebar();
});
btn.dataset.listener = '1';
})();

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
    if (window.innerWidth <= 768) toggleSidebar();
  });
  btn.dataset.listener = '1';
})();













