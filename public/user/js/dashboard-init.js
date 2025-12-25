/**
 * ═══════════════════════════════════════════════════════════════
 * Dashboard Initialization
 * Main entry point for the modular dashboard
 * ═══════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  /**
   * Initialize the dashboard application
   */
  async function initDashboard() {
    console.log('🚀 Initializing Vitrinet Dashboard...');
    
    try {
      // 1. Load essential components
      await loadEssentialComponents();
      
      // 2. Initialize user session
      await initUserSession();
      
      // 3. Setup event listeners
      setupGlobalEventListeners();
      
      // 4. Load dashboard section
      showSection('dashboard');
      
      // 5. Initialize notifications
      initNotifications();
      
      // 6. Load missions
      loadMissions();
      
      console.log('✅ Dashboard initialized successfully');
      
    } catch (error) {
      console.error('❌ Dashboard initialization failed:', error);
      showInitError();
    }
  }

  /**
   * Load essential UI components
   */
  async function loadEssentialComponents() {
    // For now, components are inline in the HTML
    // In production, these would be loaded from separate files
    
    // Initialize Toast system
    if (window.Toast) {
      Toast.init();
    }
  }

  /**
   * Initialize user session and load profile
   */
  async function initUserSession() {
    try {
      const res = await fetch('/api/user/profile', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) {
        // User not logged in - redirect to login
        if (res.status === 401) {
          window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
          return;
        }
        throw new Error('Failed to load user profile');
      }
      
      const user = await res.json();
      window.currentUserId = user._id;
      window.currentUserPhone = user.phone || user.mobile || '';
      
      // Update profile state
      if (typeof profileState !== 'undefined') {
        profileState.isAuthenticated = true;
        profileState.user = {
          firstName: user.firstname || user.firstName || 'کاربر',
          lastName: user.lastname || user.lastName || 'ویترینت',
          phone: user.phone || user.mobile || '',
          city: user.city || ''
        };
      }
      
      // Check completed missions
      if (user.birthDate || user.birthday || user.dateOfBirth) {
        window.completedMissions?.add('user-profile-complete');
      }
      
      // Update UI
      updateUserUI(user);
      
    } catch (error) {
      console.error('Session init error:', error);
    }
  }

  /**
   * Update UI with user data
   */
  function updateUserUI(user) {
    // Update hero avatar
    const heroAvatar = document.getElementById('heroAvatar');
    if (heroAvatar) {
      const initial = (user.firstname || user.firstName || 'ک').charAt(0);
      heroAvatar.textContent = initial;
    }
    
    // Update sidebar user info
    const sidebarName = document.getElementById('sidebarUserName');
    if (sidebarName) {
      const fullName = `${user.firstname || user.firstName || ''} ${user.lastname || user.lastName || ''}`.trim();
      sidebarName.textContent = fullName || 'کاربر ویترینت';
    }
    
    const sidebarPhone = document.getElementById('sidebarUserPhone');
    if (sidebarPhone) {
      sidebarPhone.textContent = user.phone || user.mobile || '';
    }
  }

  /**
   * Setup global event listeners
   */
  function setupGlobalEventListeners() {
    // Menu button clicks
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.menu-btn');
      if (!btn) return;
      
      e.preventDefault();
      const section = btn.dataset.section;
      if (section) {
        showSection(section);
        if (window.innerWidth < 1024) {
          closeSidebar();
        }
      }
    });
    
    // Hamburger menu
    const hamBtn = document.getElementById('hamBtn');
    if (hamBtn) {
      hamBtn.addEventListener('click', openSidebar);
    }
    
    // Close sidebar
    const closeSidebarBtn = document.getElementById('closeSidebar');
    if (closeSidebarBtn) {
      closeSidebarBtn.addEventListener('click', closeSidebar);
    }
    
    // Sidebar overlay
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    // Hero avatar click
    const heroAvatarBtn = document.getElementById('heroAvatar');
    if (heroAvatarBtn) {
      heroAvatarBtn.addEventListener('click', () => {
        showSection('profile');
      });
    }
    
    // Escape key handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSidebar();
        if (window.ModalManager) {
          ModalManager.hideAll();
        }
      }
    });
    
    // Streak popup events
    setupStreakPopupEvents();
  }

  /**
   * Setup streak popup event listeners
   */
  function setupStreakPopupEvents() {
    const closeBtn = document.getElementById('streakPopupClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', dismissStreakPopup);
    }

    const dismissBtn = document.getElementById('streakPopupDismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', dismissStreakPopup);
    }

    const overlay = document.getElementById('streakPopupOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          dismissStreakPopup();
        }
      });
    }

    const miniBanner = document.getElementById('streakMiniBanner');
    if (miniBanner) {
      miniBanner.addEventListener('click', () => {
        localStorage.removeItem('streakPopupDismissed');
        showStreakPopup();
      });
    }
  }

  /**
   * Initialize notification system
   */
  function initNotifications() {
    if (typeof loadNotifications === 'function') {
      loadNotifications();
      
      // Refresh notifications every 30 seconds
      setInterval(loadNotifications, 30000);
    }
  }

  /**
   * Load missions
   */
  function loadMissions() {
    if (typeof renderMissionCards === 'function') {
      renderMissionCards();
    }
  }

  /**
   * Show initialization error
   */
  function showInitError() {
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
      mainContent.innerHTML = `
        <div class="glass p-8 text-center">
          <div class="text-4xl mb-4">⚠️</div>
          <h2 class="text-xl font-bold text-gray-800 mb-2">خطا در بارگذاری</h2>
          <p class="text-gray-600 mb-4">متأسفانه در بارگذاری داشبورد مشکلی پیش آمد.</p>
          <button onclick="location.reload()" class="brand-btn px-6 py-2 rounded-lg font-bold">
            تلاش مجدد
          </button>
        </div>
      `;
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
  } else {
    initDashboard();
  }

})();
