(function(){
  'use strict';

  const API_ORIGIN = window.location.origin.includes('localhost')
    ? 'http://localhost:5000'
    : window.location.origin;

  const SafeSS = window.SafeSS || {
    setJSON(key, value) {
      try {
        sessionStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        console.warn('SafeSS setJSON failed', err);
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

  function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name) || '';
  }

  const shopurl = getQueryParam('shopurl');
  const phone = getQueryParam('phone');

  if (!shopurl) {
    window.location.href = 'post.html';
    return;
  }

  const digits = Array.from(document.querySelectorAll('.input-digit'));
  const btn = document.getElementById('verifyBtn');
  const form = document.getElementById('verifyForm');
  const errorText = document.getElementById('errorText');
  const timerEl = document.getElementById('timer');
  const goDashboardBtn = document.getElementById('go-dashboard-btn');

  if (!form || !btn || digits.length === 0 || !timerEl) {
    return;
  }

  digits.forEach((input, idx) => {
    input.addEventListener('input', () => {
      if (input.value.length > 1) {
        input.value = input.value.slice(0, 1);
      }
      if (input.value && idx < digits.length - 1) {
        digits[idx + 1].focus();
      }
      updateButtonState();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !input.value && idx > 0) {
        digits[idx - 1].focus();
      }
    });

    input.addEventListener('paste', (event) => {
      event.preventDefault();
      const data = (event.clipboardData || window.clipboardData)
        .getData('text')
        .replace(/\D/g, '')
        .slice(0, 5);

      data.split('').forEach((num, index) => {
        if (digits[index]) {
          digits[index].value = num;
        }
      });

      if (data.length > 0 && digits[data.length - 1]) {
        digits[data.length - 1].focus();
      }
      updateButtonState();
    });
  });

  function updateButtonState() {
    const filled = digits.every((digit) => digit.value && digit.value.length === 1);
    btn.disabled = !filled;
    if (!filled) {
      errorText?.classList.add('hidden');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = digits.map((digit) => digit.value).join('');

    if (!/^\d{5}$/.test(code)) {
      showError('کد وارد شده معتبر نیست!');
      return;
    }

    try {
      const verifyResponse = await fetch(`${API_ORIGIN}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopurl, phone, code })
      });

      const verifyResult = await verifyResponse.json();
      if (!verifyResult.success) {
        showError(verifyResult.message || 'کد تایید اشتباه است!');
        return;
      }
    } catch (err) {
      showError('مشکل ارتباط با سرور!');
      return;
    }

    const password = SafeSS.getJSON('signup_pwd');
    if (!password) {
      showError('خطای ورود: رمز ثبت‌نام پیدا نشد. لطفا مجدد وارد شوید.');
      return;
    }

    try {
      const loginResponse = await fetch(`${API_ORIGIN}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      const loginResult = await loginResponse.json();
      if (loginResult.success && loginResult.seller) {
        handleSuccessfulLogin(loginResult);
        return;
      }

      showError(loginResult.message || 'ورود ناموفق!');
    } catch (err) {
      showError('خطای ورود به اکانت!');
    }
  });

  function handleSuccessfulLogin(loginResult) {
    localStorage.setItem('token', loginResult.token);
    localStorage.setItem('seller', JSON.stringify(loginResult.seller));

    sessionStorage.removeItem('signup_pwd');
    sessionStorage.removeItem('signup_phone');

    const SERVICE_CATEGORIES = ['خدمات', 'زیبایی', 'تالار و مجالس', 'خودرو', 'ورزشی'];
    const categoryFromServer = loginResult?.seller?.category || '';
    const roleFromSignup = SafeSS.getJSON('signup_role');

    const isServiceSeller = categoryFromServer
      ? SERVICE_CATEGORIES.includes(categoryFromServer)
      : roleFromSignup === 'service';

    const SERVICE_PANEL_URL = 'service-seller-panel/s-seller-panel.html';
    const DEFAULT_SELLER_PANEL_URL = 'seller/dashboard.html';

    const targetPanel = isServiceSeller ? SERVICE_PANEL_URL : DEFAULT_SELLER_PANEL_URL;
    const redirectUrl = `${targetPanel}?shopurl=${encodeURIComponent(loginResult.seller.shopurl)}`;

    window.location.href = redirectUrl;
  }

  function showError(message) {
    if (!errorText) {
      return;
    }
    errorText.innerText = message;
    errorText.classList.remove('hidden');
  }

  let timerSeconds = 60;
  let timerId = null;

  function startTimer() {
    clearTimer();
    timerSeconds = 60;
    updateTimerDisplay();

    timerId = window.setInterval(() => {
      timerSeconds -= 1;

      if (timerSeconds <= 0) {
        clearTimer();
        showResendLink();
        return;
      }

      updateTimerDisplay();
    }, 1000);
  }

  function clearTimer() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function updateTimerDisplay() {
    if (!timerEl) {
      return;
    }
    timerEl.textContent = String(timerSeconds);
  }

  function showResendLink() {
    if (!timerEl) {
      return;
    }
    timerEl.textContent = '';

    const link = document.createElement('a');
    link.href = '#';
    link.className = 'text-[#0ea5e9] font-extrabold underline';
    link.textContent = 'ارسال مجدد';
    link.addEventListener('click', handleResendClick);

    timerEl.appendChild(link);
  }

  function handleResendClick(event) {
    event.preventDefault();
    digits.forEach((digit) => {
      digit.value = '';
    });
    digits[0]?.focus();
    updateButtonState();
    errorText?.classList.add('hidden');
    startTimer();
  }

  if (goDashboardBtn) {
    goDashboardBtn.addEventListener('click', () => {
      // مسیر پس از ورود تعیین می‌شود؛ نیازی به پیاده‌سازی دستی نیست.
    });
  }

  startTimer();
})();
