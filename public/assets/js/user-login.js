// --- Safe sessionStorage helper (SafeSS) ---
// Ensures SafeSS is available even if shared utilities are not loaded
const SafeSS = window.SafeSS || {
  setJSON(key, value) {
    try {
      const str = JSON.stringify(value);
      sessionStorage.setItem(key, str);
      return true;
    } catch (err) {
      console.warn('SafeSS setJSON failed', err);
      return false;
    }
  },
  getJSON(key, fallback = null) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.warn('SafeSS getJSON failed', err);
      return fallback;
    }
  }
};

if (!window.SafeSS) {
  window.SafeSS = SafeSS;
}

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const phone = document.getElementById('mobile').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorMsg = document.getElementById('error-message');
  const forgotLink = document.getElementById('forgot-link');

  try {
    const res = await fetch('/api/auth/login-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ phone, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'خطا در ورود!');

    console.log('✅ Login response received:', data);
    console.log('Token from server:', data.token ? 'EXISTS' : 'MISSING');
    console.log('User from server:', data.user);

    // Clear old data
    localStorage.clear();

    // Save new token and user
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    console.log('💾 Token saved to localStorage');
    console.log('Saved token:', localStorage.getItem('token') ? 'SUCCESS' : 'FAILED');

    const back = SafeSS.getJSON('afterLoginReturn');
    if (back) {
      sessionStorage.removeItem('afterLoginReturn');
      window.location.href = back;
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get('redirect');
      window.location.href = redirectUrl || '/user/dashboard.html';
    }
  } catch (err) {
    errorMsg.innerText = err.message || 'خطا در ورود!';
    errorMsg.classList.remove('hidden');
    forgotLink.classList.remove('hidden');
  }
});

// 👁 نمایش/مخفی‌کردن رمز عبور
document.getElementById('togglePassword').addEventListener('click', function () {
  const passwordInput = document.getElementById('password');
  const eyeOpen = document.getElementById('eyeOpen');
  const eyeClosed = document.getElementById('eyeClosed');

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    eyeOpen.classList.add('hidden');
    eyeClosed.classList.remove('hidden');
  } else {
    passwordInput.type = 'password';
    eyeOpen.classList.remove('hidden');
    eyeClosed.classList.add('hidden');
  }
});
