/**
 * ═══════════════════════════════════════════════════════════════
 * Dashboard Logic - Vitrinet User Dashboard
 * Extracted from dashboard.html for modular architecture
 * ═══════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// Global State & Configuration
// ═══════════════════════════════════════════════════════════════

const API_BASE = '/api';
let chatsList = [];
let currentCid = null;
let blockedSellers = [];
let currentMsgFilter = 'all';
let msgPollingInterval = null;

// Profile State
const profileState = {
  isAuthenticated: false,
  user: {
    firstName: '',
    lastName: '',
    city: '',
    phone: ''
  }
};

// Mission System
let currentMissionType = null;
let userReferralCode = null;
window.completedMissions = new Set();

// Explore Mission
const EXPLORE_STORAGE_KEY = 'vitrint_explore_mission';
const EXPLORE_REQUIRED_VISITS = 3;
let cachedExploreProgress = null;

// Streak & Wallet
let streakData = null;
let walletData = null;

// Notifications
let notificationsData = [];
let unreadCount = 0;
const LAST_NOTIF_KEY = 'userDashboard.lastNotificationsViewedAt';

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return 'همین الان';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} دقیقه پیش`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ساعت پیش`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} روز پیش`;
  } else {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} ماه پیش`;
  }
}

function showToast(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
}

function showStreakToast(message, type = 'success') {
  const existing = document.querySelector('.streak-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `streak-toast ${type === 'error' ? 'error' : ''}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ═══════════════════════════════════════════════════════════════
// Quick Actions Setup
// ═══════════════════════════════════════════════════════════════

function setupQuickActions() {
  document.querySelectorAll('.quick-action[data-section]').forEach(action => {
    action.addEventListener('click', (event) => {
      event.preventDefault();
      const target = action.getAttribute('data-section');
      if (target) {
        showSection(target);
      }
    });
  });

  const moreBtn = document.getElementById('moreActionsBtn');
  const modal = document.getElementById('moreActionsModal');
  const closeBtn = document.getElementById('closeMoreActions');

  if (moreBtn && modal) {
    moreBtn.addEventListener('click', () => {
      modal.classList.add('active');
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  }

  document.querySelectorAll('.more-action-item[data-section]').forEach(item => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      const target = item.getAttribute('data-section');
      if (target) {
        modal.classList.remove('active');
        showSection(target);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      modal.classList.remove('active');
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Section Navigation (SPA)
// ═══════════════════════════════════════════════════════════════

function showSection(section) {
  const mainContent = document.getElementById('mainContent');
  
  document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.classList.remove('tab-active', 'active');
  });
  
  document.querySelectorAll(`.menu-btn[data-section="${section}"]`).forEach(btn => {
    btn.classList.add('tab-active', 'active');
  });
  
  if (section === 'dashboard') {
    mainContent.innerHTML = dashboardSection;
    setupQuickActions();
    renderRecentFavorites();
    updateDashboardFavCount();
    initStreakAndWallet();
  }
  else if (section === 'profile') loadProfileSection();
  else if (section === 'favorites') loadFavoritesSection();
  else if (section === 'favshops') loadFavShopsSection();
  else if (section === 'bookings') loadBookingsSection();
  else if (section === 'messages') loadMessagesSection();

  if (section === 'messages') startMsgPolling(); else stopMsgPolling();

  mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ═══════════════════════════════════════════════════════════════
// Favorites Functions
// ═══════════════════════════════════════════════════════════════

async function renderRecentFavorites() {
  const container = document.getElementById('recentFavsContainer');
  if (!container) return;
  
  container.innerHTML = `
    <div class="glass px-6 py-5 fadein">
      <div class="flex items-center justify-between mb-4">
        <span id="recentFavsTitle" class="text-lg font-bold primary-text cursor-pointer">علاقه‌مندی‌های اخیر شما</span>
        <a href="#" id="recentFavsShowAll" class="text-[#0ea5e9] hover:underline font-bold text-sm menu-btn">مشاهده همه</a>
      </div>
      <div class="flex flex-wrap gap-3 scrollbar-hide overflow-x-auto" id="recentFavsList">
        <div class="text-gray-400 text-center w-full py-3">در حال دریافت ...</div>
      </div>
    </div>
  `;

  try {
    const res = await fetch('/api/user/profile', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) throw new Error();

    const user = await res.json();
    const favs = Array.isArray(user.favorites) ? user.favorites : [];

    const favsList = container.querySelector("#recentFavsList");
    if (favs.length === 0) {
      favsList.innerHTML = `<div class="text-gray-400 text-center w-full py-3">هنوز علاقه‌مندی ثبت نکردی!</div>`;
    } else {
      favsList.innerHTML = favs.slice(-3).reverse().map(p => {
        const shop = (p.sellerId && typeof p.sellerId === 'object') ? p.sellerId : {};
        return `
          <div class="min-w-[170px] max-w-xs bg-[#e0fdfa] rounded-xl p-3 flex flex-col items-center text-center">
            <img src="${(p.images && p.images[0]) ? p.images[0] : '/assets/images/noimage.png'}" class="w-20 h-20 object-cover rounded-xl mb-2 shadow" alt="${p.title || ''}"/>
            <span class="text-[#10b981] text-base font-bold mb-1">${p.title || '-'}</span>
            <span class="text-xs text-gray-500 mb-1">${shop.storename ? `فروشگاه ${shop.storename}` : ''}</span>
            <span class="text-xs text-gray-600 mb-1">قیمت: ${p.price ? p.price.toLocaleString('fa-IR') + ' تومان' : '-'}</span>
            <a href="/product.html?id=${p._id}" class="mt-2 px-4 py-1.5 rounded-lg brand-btn text-xs font-bold inline-block" target="_blank" rel="noopener noreferrer">مشاهده محصول</a>
          </div>
        `;
      }).join('');
    }
  } catch (e) {
    const favsList = container.querySelector("#recentFavsList");
    if (favsList) {
      favsList.innerHTML = `<div class="text-red-400 text-center w-full py-3">دریافت لیست علاقه‌مندی‌ها ناموفق بود.</div>`;
    }
  }
}

async function updateDashboardFavCount() {
  const favCountEl = document.getElementById('favCountDashboard');
  try {
    const res = await fetch('/api/user/profile', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      if (favCountEl) favCountEl.textContent = '-';
      return;
    }
    const user = await res.json();
    if (favCountEl) {
      favCountEl.textContent = Array.isArray(user.favorites) ? user.favorites.length : '0';
    }
  } catch (e) {
    if (favCountEl) favCountEl.textContent = '-';
  }
}

async function loadFavoritesSection() {
  let html = `<div class="glass px-6 py-7 fadein"><div class="text-center text-gray-400 py-12">در حال دریافت...</div></div>`;
  document.getElementById('mainContent').innerHTML = html;

  try {
    const res = await fetch('/api/user/profile', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (!res.ok) throw new Error('دریافت پروفایل کاربر ناموفق بود!');
    const user = await res.json();
    const favs = user.favorites;

    if (!Array.isArray(favs) || favs.length === 0) {
      html = `<div class="glass px-6 py-7 fadein text-center text-gray-400">هیچ محصولی در علاقه‌مندی‌ها نیست.</div>`;
    } else {
      html = `
        <div class="glass px-6 py-7 fadein">
          <div class="text-xl font-black primary-text mb-5">علاقه‌مندی‌های من</div>
          <div class="flex flex-wrap gap-4">
            ${favs.map(p => {
              const shop = (p.sellerId && typeof p.sellerId === 'object') ? p.sellerId : {};
              return `
                <div class="min-w-[170px] max-w-xs bg-[#e0fdfa] rounded-xl p-3 flex flex-col items-center text-center">
                  <img src="${(p.images && p.images[0]) ? p.images[0] : '/assets/images/noimage.png'}" class="w-24 h-24 object-cover rounded-xl mb-2 shadow" alt="${p.title || ''}"/>
                  <span class="text-[#10b981] text-lg font-bold mb-1">${p.title || '-'}</span>
                  <span class="text-xs text-gray-500 mb-1">${shop.storename ? `فروشگاه ${shop.storename}` : ''}</span>
                  <span class="text-xs text-gray-600 mb-1">قیمت: ${p.price ? p.price.toLocaleString('fa-IR') + ' تومان' : '-'}</span>
                  <a href="/product.html?id=${p._id}" class="mt-2 px-4 py-1.5 rounded-lg brand-btn text-xs font-bold inline-block" target="_blank" rel="noopener noreferrer">مشاهده محصول</a>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
  } catch (e) {
    html = `<div class="glass px-6 py-7 fadein text-center text-red-400">${e.message}</div>`;
  }

  document.getElementById('mainContent').innerHTML = html;
}


// ═══════════════════════════════════════════════════════════════
// Sidebar Functions
// ═══════════════════════════════════════════════════════════════

function openSidebar() {
  markNotificationsViewed();
  document.getElementById('mobileSidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('mobileSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function updateSidebarUser() {
  try {
    const res = await fetch('/api/user/profile', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error();

    const user = await res.json();
    window.currentUserId = user._id;

    const first = user.firstname || user.firstName || 'کاربر';
    const last = user.lastname || user.lastName || 'ویترینت';
    const phone = user.phone || user.mobile || '';
    
    profileState.isAuthenticated = true;
    profileState.user = {
      ...profileState.user,
      firstName: first,
      lastName: last,
      phone
    };
    applyProfileStateToUI();

    window.currentUserPhone = phone;
    refreshBookingsBadge();

    const hasBirthday = user.birthDate || user.birthday || user.dateOfBirth;
    if (hasBirthday) {
      window.completedMissions.add('user-profile-complete');
    }
  } catch (_) {
    profileState.isAuthenticated = false;
    profileState.user = {
      firstName: '',
      lastName: '',
      city: '',
      phone: ''
    };
    applyProfileStateToUI();
  }
}

// ═══════════════════════════════════════════════════════════════
// Streak & Wallet System
// ═══════════════════════════════════════════════════════════════

async function initStreakAndWallet() {
  await Promise.all([
    loadStreakData(),
    loadWalletData()
  ]);
  setupStreakWalletEvents();
}

async function loadStreakData() {
  try {
    const res = await fetch('/api/user/streak', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      if (res.status === 401) {
        renderStreakNotLoggedIn();
        return;
      }
      throw new Error('خطا در دریافت استریک');
    }

    streakData = await res.json();
    renderStreakCard();
  } catch (error) {
    console.error('loadStreakData error:', error);
    renderStreakError();
  }
}

async function loadWalletData() {
  try {
    const res = await fetch('/api/user/wallet/summary', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      if (res.status === 401) {
        renderWalletNotLoggedIn();
        return;
      }
      throw new Error('خطا در دریافت کیف پول');
    }

    walletData = await res.json();
    renderWalletCard();
  } catch (error) {
    console.error('loadWalletData error:', error);
    renderWalletError();
  }
}

function renderStreakCard() {
  if (!streakData) return;

  const streakNumber = document.getElementById('streakNumber');
  const streakMiniNumber = document.getElementById('streakMiniNumber');
  const streakMiniSubtitle = document.getElementById('streakMiniSubtitle');
  const streakCheckinBtn = document.getElementById('streakCheckinBtn');
  const streakCheckinText = document.getElementById('streakCheckinText');
  const streakPopupDismiss = document.getElementById('streakPopupDismiss');
  const longestStreak = document.getElementById('longestStreak');
  const totalLoginDays = document.getElementById('totalLoginDays');
  const streakWeek = document.getElementById('streakWeek');

  if (streakNumber) streakNumber.textContent = streakData.currentStreak || 0;
  if (streakMiniNumber) streakMiniNumber.textContent = streakData.currentStreak || 0;
  
  const streakLevelText = document.getElementById('streakLevelText');
  if (streakLevelText && streakData.level) {
    streakLevelText.textContent = streakData.level.name || 'تازه‌کار';
  }
  if (longestStreak) longestStreak.textContent = streakData.longestStreak || 0;
  if (totalLoginDays) totalLoginDays.textContent = streakData.totalLoginDays || 0;

  // Render weekly history
  if (streakWeek && streakData.weekHistory) {
    const today = new Date().toISOString().split('T')[0];
    streakWeek.innerHTML = streakData.weekHistory.map(day => {
      const isToday = day.date === today;
      let dotClass = 'pending';
      let dotContent = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1"></circle></svg>`;
      
      if (day.status === 'hit') {
        dotClass = 'hit';
        dotContent = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      } else if (day.status === 'missed') {
        dotClass = 'missed';
        dotContent = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      }
      
      return `
        <div class="streak-popup-day">
          <span class="streak-popup-day-name">${day.dayName || ''}</span>
          <div class="streak-popup-day-dot ${dotClass} ${isToday ? 'today' : ''}">${dotContent}</div>
        </div>
      `;
    }).join('');
  }

  // Check-in button state
  if (streakCheckinBtn && streakCheckinText) {
    if (streakData.checkedInToday) {
      streakCheckinBtn.classList.remove('active');
      streakCheckinBtn.classList.add('done');
      streakCheckinText.textContent = 'امروز ثبت شده';
      streakCheckinBtn.disabled = true;
      if (streakMiniSubtitle) {
        streakMiniSubtitle.textContent = 'امروز ثبت شده';
        streakMiniSubtitle.classList.add('checked');
      }
      if (streakPopupDismiss) streakPopupDismiss.textContent = 'بستن';
    } else {
      streakCheckinBtn.classList.add('active');
      streakCheckinBtn.classList.remove('done');
      streakCheckinText.textContent = 'ثبت ورود امروز';
      streakCheckinBtn.disabled = false;
      if (streakMiniSubtitle) {
        streakMiniSubtitle.textContent = 'برای دریافت امتیاز کلیک کنید';
        streakMiniSubtitle.classList.remove('checked');
      }
      if (streakPopupDismiss) streakPopupDismiss.textContent = 'بعداً یادآوری کن';
    }
  }

  checkAndShowStreakPopup();
}

function renderWalletCard() {
  if (!walletData) return;

  const walletBalance = document.getElementById('walletBalance');
  const totalEarned = document.getElementById('totalEarned');
  const totalSpent = document.getElementById('totalSpent');
  const recentTransactions = document.getElementById('recentTransactions');

  if (walletBalance) walletBalance.textContent = (walletData.balance || 0).toLocaleString('fa-IR');
  if (totalEarned) totalEarned.textContent = (walletData.totalEarned || 0).toLocaleString('fa-IR');
  if (totalSpent) totalSpent.textContent = (walletData.totalSpent || 0).toLocaleString('fa-IR');

  if (recentTransactions && walletData.recentTransactions) {
    if (walletData.recentTransactions.length === 0) {
      recentTransactions.innerHTML = `
        <div class="text-center text-gray-400 py-4 text-sm">
          هنوز تراکنشی ثبت نشده
        </div>
      `;
    } else {
      recentTransactions.innerHTML = walletData.recentTransactions.map(t => `
        <div class="wallet-transaction">
          <div class="wallet-transaction-info">
            <span class="wallet-transaction-icon">${t.isPositive ? '📈' : '📉'}</span>
            <span class="wallet-transaction-title">${t.title || 'تراکنش'}</span>
          </div>
          <span class="wallet-transaction-amount ${t.isPositive ? 'positive' : 'negative'}">
            ${t.formattedAmount || t.amount}
          </span>
        </div>
      `).join('');
    }
  }
}

function checkAndShowStreakPopup() {
  const today = new Date().toISOString().split('T')[0];
  const dismissedDate = localStorage.getItem('streakPopupDismissed');
  const miniBanner = document.getElementById('streakMiniBanner');
  
  if (streakData && streakData.checkedInToday) {
    hideStreakPopup();
    if (miniBanner) miniBanner.classList.add('visible');
    return;
  }

  if (dismissedDate === today) {
    if (miniBanner) miniBanner.classList.add('visible');
    return;
  }

  showStreakPopup();
}

function showStreakPopup() {
  const overlay = document.getElementById('streakPopupOverlay');
  const miniBanner = document.getElementById('streakMiniBanner');
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  if (miniBanner) miniBanner.classList.remove('visible');
}

function hideStreakPopup() {
  const overlay = document.getElementById('streakPopupOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function dismissStreakPopup() {
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem('streakPopupDismissed', today);
  hideStreakPopup();
  
  const miniBanner = document.getElementById('streakMiniBanner');
  if (miniBanner) miniBanner.classList.add('visible');
}

function showConfetti() {
  const container = document.createElement('div');
  container.className = 'streak-confetti';
  document.body.appendChild(container);

  const colors = ['#f97316', '#22c55e', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6'];
  
  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('div');
    piece.className = 'streak-confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 0.5 + 's';
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 4000);
}

async function doCheckIn() {
  const btn = document.getElementById('streakCheckinBtn');
  const text = document.getElementById('streakCheckinText');
  
  if (!btn || btn.disabled) return;
  
  btn.disabled = true;
  text.textContent = 'در حال ثبت...';

  try {
    const res = await fetch('/api/user/streak/checkin', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.alreadyCheckedIn) {
        showStreakToast('امروز قبلاً ورود ثبت شده است', 'info');
        btn.classList.remove('active');
        btn.classList.add('done');
        text.textContent = '✓ امروز ثبت شده';
        return;
      }
      throw new Error(data.message || 'خطا در ثبت ورود');
    }

    streakData = {
      ...streakData,
      currentStreak: data.currentStreak,
      longestStreak: data.longestStreak,
      totalLoginDays: data.totalLoginDays,
      loyaltyPoints: data.loyaltyPoints,
      level: data.level,
      checkedInToday: true
    };

    if (walletData) {
      walletData.balance = data.newBalance;
    }

    renderStreakCard();
    renderWalletCard();

    const rewardText = data.rewards && data.rewards.length > 0
      ? `+${data.totalReward.toLocaleString('fa-IR')} تومان پاداش!`
      : 'ورود ثبت شد!';
    
    showStreakToast(`🎉 ${rewardText}`, 'success');

    const streakPopup = document.getElementById('streakPopup');
    if (streakPopup) {
      streakPopup.classList.add('success-animation');
      setTimeout(() => streakPopup.classList.remove('success-animation'), 500);
    }
    
    showConfetti();

    setTimeout(() => {
      hideStreakPopup();
      const miniBanner = document.getElementById('streakMiniBanner');
      if (miniBanner) miniBanner.classList.add('visible');
    }, 2500);

  } catch (error) {
    console.error('doCheckIn error:', error);
    showStreakToast(error.message || 'خطا در ثبت ورود', 'error');
    btn.disabled = false;
    text.textContent = 'ثبت ورود امروز';
  }
}

function setupStreakWalletEvents() {
  const checkinBtn = document.getElementById('streakCheckinBtn');
  if (checkinBtn) {
    checkinBtn.addEventListener('click', doCheckIn);
  }

  const viewAllBtn = document.getElementById('viewAllTransactions');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', showAllTransactions);
  }

  const closeModalBtn = document.getElementById('closeTransactionsModal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeTransactionsModal);
  }

  const modal = document.getElementById('transactionsModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeTransactionsModal();
    });
  }
}

async function showAllTransactions() {
  const modal = document.getElementById('transactionsModal');
  const list = document.getElementById('allTransactionsList');
  
  if (!modal || !list) return;

  modal.classList.add('active');
  list.innerHTML = `
    <div class="text-center py-8">
      <div class="loading-spinner mx-auto mb-3"></div>
      <p class="text-gray-500">در حال بارگذاری...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/user/wallet/transactions?limit=50', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) throw new Error('خطا در دریافت تراکنش‌ها');

    const data = await res.json();
    const transactions = data.transactions || [];

    if (transactions.length === 0) {
      list.innerHTML = `
        <div class="text-center py-8">
          <div class="text-4xl mb-3">💳</div>
          <p class="text-gray-500">هنوز تراکنشی ثبت نشده</p>
        </div>
      `;
      return;
    }

    list.innerHTML = transactions.map(t => `
      <div class="transaction-item">
        <div class="transaction-icon-wrapper ${t.isPositive ? 'earn' : 'spend'}">
          ${t.categoryIcon || (t.isPositive ? '📈' : '📉')}
        </div>
        <div class="transaction-details">
          <p class="transaction-title">${t.title || 'تراکنش'}</p>
          <span class="transaction-date">${formatDate(t.createdAt)} • ${t.categoryLabel || ''}</span>
        </div>
        <span class="transaction-amount ${t.isPositive ? 'positive' : 'negative'}">
          ${t.formattedAmount || t.amount}
        </span>
      </div>
    `).join('');

  } catch (error) {
    console.error('showAllTransactions error:', error);
    list.innerHTML = `
      <div class="text-center py-8 text-red-500">
        خطا در بارگذاری تراکنش‌ها
      </div>
    `;
  }
}

function closeTransactionsModal() {
  const modal = document.getElementById('transactionsModal');
  if (modal) modal.classList.remove('active');
}

// Error/Not Logged In States
function renderStreakError() {
  const card = document.getElementById('streakCard');
  if (card) {
    card.innerHTML = `
      <div class="text-center py-6">
        <div class="text-3xl mb-2">⚠️</div>
        <p class="text-orange-700 font-bold">خطا در بارگذاری استریک</p>
        <button onclick="loadStreakData()" class="mt-3 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold">
          تلاش مجدد
        </button>
      </div>
    `;
  }
}

function renderWalletError() {
  const card = document.getElementById('walletCard');
  if (card) {
    card.innerHTML = `
      <div class="text-center py-6">
        <div class="text-3xl mb-2">⚠️</div>
        <p class="text-emerald-700 font-bold">خطا در بارگذاری کیف پول</p>
        <button onclick="loadWalletData()" class="mt-3 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold">
          تلاش مجدد
        </button>
      </div>
    `;
  }
}

function renderStreakNotLoggedIn() {
  const card = document.getElementById('streakCard');
  if (card) {
    card.innerHTML = `
      <div class="text-center py-6">
        <div class="text-3xl mb-2">🔒</div>
        <p class="text-orange-700 font-bold mb-2">برای استفاده از استریک وارد شوید</p>
        <a href="/login.html" class="inline-block px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold">
          ورود به حساب
        </a>
      </div>
    `;
  }
}

function renderWalletNotLoggedIn() {
  const card = document.getElementById('walletCard');
  if (card) {
    card.innerHTML = `
      <div class="wallet-login-prompt">
        <div class="wallet-login-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/>
            <path d="M5 20c0-3.5 3.5-6 7-6s7 2.5 7 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M15 11l2 2 4-4" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="wallet-login-content">
          <h4 class="wallet-login-title">ورود به حساب کاربری</h4>
          <p class="wallet-login-desc">برای مشاهده موجودی کیف پول و دریافت پاداش‌ها، وارد حساب کاربری خود شوید</p>
        </div>
        <a href="/login.html" class="wallet-login-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          <span>ورود به حساب</span>
        </a>
      </div>
    `;
  }
}


// ═══════════════════════════════════════════════════════════════
// Explore Mission System
// ═══════════════════════════════════════════════════════════════

async function fetchExploreProgressFromAPI() {
  try {
    const res = await fetch('/api/missions/browse-status', {
      credentials: 'include'
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    if (data.success) {
      cachedExploreProgress = {
        count: data.progress || 0,
        required: data.required || 3,
        status: data.status,
        visitedShops: data.visitedStores?.map(v => v.storeId) || [],
        completed: data.status === 'completed' || data.status === 'claimed',
        rewarded: data.rewardPaid || false,
        isActive: data.isActive
      };
      return cachedExploreProgress;
    }
  } catch (e) {
    console.log('Could not fetch explore progress from API');
  }
  return null;
}

function getExploreProgress() {
  if (cachedExploreProgress) return cachedExploreProgress;
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(EXPLORE_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.date !== today) {
        return { date: today, visitedShops: [], count: 0, completed: false, rewarded: false };
      }
      return data;
    }
  } catch (e) {
    console.error('Error reading explore progress:', e);
  }
  return { date: new Date().toISOString().split('T')[0], visitedShops: [], count: 0, completed: false, rewarded: false };
}

function saveExploreProgress(progress) {
  try {
    localStorage.setItem(EXPLORE_STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('Error saving explore progress:', e);
  }
}

function trackShopVisit(shopId) {
  if (!shopId) return;
  
  const progress = getExploreProgress();
  
  if (progress.completed && progress.rewarded) return;
  if (progress.visitedShops.includes(shopId)) return;
  
  progress.visitedShops.push(shopId);
  progress.count = progress.visitedShops.length;
  
  showExploreProgressToast(progress.count);
  
  if (progress.count >= EXPLORE_REQUIRED_VISITS && !progress.completed) {
    progress.completed = true;
    setTimeout(() => {
      showExploreCompleteToast();
      progress.rewarded = true;
      saveExploreProgress(progress);
    }, 1500);
  }
  
  saveExploreProgress(progress);
}

function showExploreProgressToast(count) {
  const toast = document.getElementById('exploreProgressToast');
  const text = document.getElementById('exploreProgressText');
  if (!toast || !text) return;
  
  const persianCount = count.toString().replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  text.textContent = `فروشگاه بازدید شد! (${persianCount}/۳)`;
  toast.classList.remove('complete');
  toast.classList.add('show');
  
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function showExploreCompleteToast() {
  const toast = document.getElementById('exploreProgressToast');
  const text = document.getElementById('exploreProgressText');
  if (!toast || !text) return;
  
  text.textContent = '🎉 تبریک! ۵۰۰ تومان جایزه گرفتی!';
  toast.classList.add('complete', 'show');
  
  setTimeout(() => toast.classList.remove('show', 'complete'), 4000);
}

// Global export for other pages
window.trackShopVisit = trackShopVisit;
