/**
 * ═══════════════════════════════════════════════════════════════
 * Dashboard Initialization
 * Main entry point for the modular dashboard
 * ═══════════════════════════════════════════════════════════════
 */

// Global state
window.completedMissions = window.completedMissions || new Set();
window.currentUserId = null;
window.currentUserPhone = '';

/**
 * Initialize the dashboard application (called from inline script)
 */
async function initDashboardAsync() {
  console.log('🚀 Initializing Vitrinet Dashboard...');
  
  try {
    // Initialize user session
    await initUserSession();
    
    // Initialize notifications if available
    if (typeof loadNotifications === 'function') {
      loadNotifications();
      setInterval(loadNotifications, 30000);
    }
    
    // Load missions if available
    if (typeof renderMissionCards === 'function') {
      renderMissionCards();
    }
    
    console.log('✅ Dashboard initialized successfully');
    
  } catch (error) {
    console.error('❌ Dashboard initialization failed:', error);
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
      if (res.status === 401) {
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return;
      }
      throw new Error('Failed to load user profile');
    }
    
    const user = await res.json();
    window.currentUserId = user._id;
    window.currentUserPhone = user.phone || user.mobile || '';
    
    // Update profile state if available
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
      window.completedMissions.add('user-profile-complete');
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
  const firstName = user.firstname || user.firstName || 'کاربر';
  const lastName = user.lastname || user.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'کاربر ویترینت';
  const initials = (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase() || 'VN';
  const phone = user.phone || user.mobile || '';
  const maskedPhone = phone ? phone.toString().slice(0, 4) + '***' + phone.toString().slice(-3) : '';
  
  // Update hero greeting
  const heroUserName = document.getElementById('heroUserName');
  if (heroUserName) {
    heroUserName.textContent = firstName ? `سلام ${firstName} جان` : 'سلام کاربر عزیز';
  }
  
  // Update sidebar user info
  document.querySelectorAll('.sidebar-user-name').forEach(el => {
    el.textContent = fullName;
  });
  
  document.querySelectorAll('.sidebar-user-mobile').forEach(el => {
    el.textContent = maskedPhone;
  });
  
  document.querySelectorAll('.sidebar-user-initials').forEach(el => {
    el.textContent = initials;
  });
}

// Auto-initialize when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboardAsync);
} else {
  initDashboardAsync();
}
