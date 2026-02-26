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

const API_ORIGIN = window.location.origin.includes('localhost')
  ? 'http://localhost:5000'
  : window.location.origin;
const SESSION_MARKER = 'cookie-session';
let csrfTokenCache = '';

const loginForm = document.getElementById('loginForm');
const errorMsg = document.getElementById('error-message');
const forgotLink = document.getElementById('forgot-link');

function clearInlineLoginError() {
  if (!errorMsg) return;
  errorMsg.innerText = '';
  errorMsg.classList.add('hidden');
}

function normalizeInlineLoginError(rawMessage) {
  const message = String(rawMessage || '').trim();

  const isOtpLoginNotice = /برای\s*این\s*شماره.*ورود\s*با\s*کد\s*تایید\s*انجام\s*می.?شود/.test(message);
  if (isOtpLoginNotice) return '';

  const wrongPasswordPatterns = [
    /رمز\s*عبور\s*(اشتباه|نادرست|غلط)/,
    /رمز\s*(اشتباه|نادرست|غلط)/,
    /wrong\s*password/i,
    /incorrect\s*password/i,
    /invalid\s*password/i,
    /password.*(wrong|incorrect|invalid)/i,
    /(wrong|incorrect|invalid).*(password)/i
  ];

  const wrongOtpPatterns = [
    /کد\s*(تایید|تأیید|یکبارمصرف|یک[\s‌-]*بار[\s‌-]*مصرف)\s*(اشتباه|نادرست|غلط)/,
    /otp.*(wrong|incorrect|invalid|expired)/i,
    /(wrong|incorrect|invalid|expired).*(otp|verification\s*code)/i,
    /(verification\s*code|code).*(wrong|incorrect|invalid|expired)/i
  ];

  if (wrongPasswordPatterns.some((pattern) => pattern.test(message))) {
    return 'رمز عبور اشتباه است';
  }

  if (wrongOtpPatterns.some((pattern) => pattern.test(message))) {
    return 'کد تایید اشتباه است';
  }

  return message || 'خطا در ورود!';
}

async function getAuthCsrfToken() {
  if (csrfTokenCache) return csrfTokenCache;

  const response = await fetch(`${API_ORIGIN}/api/auth/csrf-token`, {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.csrfToken) {
    throw new Error('CSRF_TOKEN_MISSING');
  }

  csrfTokenCache = data.csrfToken;
  return csrfTokenCache;
}

loginForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  const phone = document.getElementById('mobile').value.trim();
  const password = document.getElementById('password').value.trim();

  try {
    const csrfToken = await getAuthCsrfToken();
    const res = await fetch(`${API_ORIGIN}/api/auth/login-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'include',
      body: JSON.stringify({ phone, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'خطا در ورود!');

    // Clear old data
    localStorage.clear();

    // Session is maintained in HttpOnly cookie. Keep a marker for legacy checks.
    localStorage.setItem('token', data.token || SESSION_MARKER);
    localStorage.setItem('user', JSON.stringify(data.user));

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
    const message = normalizeInlineLoginError(err.message);
    if (!message) {
      clearInlineLoginError();
    } else {
      errorMsg.innerText = message;
      errorMsg.classList.remove('hidden');
    }
    forgotLink.classList.remove('hidden');
  }
});

loginForm.addEventListener('input', clearInlineLoginError);

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
