const API = window.VITRINET_API || {
  buildUrl: path => path,
  ensureCredentials(init = {}) {
    if (init.credentials === undefined) {
      return { ...init, credentials: 'include' };
    }
    return init;
  }
};

// --- المان‌های صفحه ---
const phoneInput = document.getElementById('phone');
const form = document.getElementById('login-form');
const errorBox = document.getElementById('error-message');
const forgotBtn = document.getElementById('forgot-btn');
const modalBg = document.getElementById('modal-bg');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');
const forgotForm = document.getElementById('forgot-form');
const forgotPhone = document.getElementById('forgot-phone');
const forgotError = document.getElementById('forgot-error');
const forgotDescription = document.getElementById('forgot-description');
const forgotSubmit = document.getElementById('forgot-submit');
const forgotInfo = document.getElementById('forgot-info');
const forgotSuccess = document.getElementById('forgot-success');
const stepPhone = document.getElementById('forgot-step-phone');
const stepOtp = document.getElementById('forgot-step-otp');
const stepReset = document.getElementById('forgot-step-reset');
const otpPhone = document.getElementById('otp-phone');
const otpInput = document.getElementById('forgot-otp');
const otpEdit = document.getElementById('otp-edit');
const otpResend = document.getElementById('otp-resend');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('toggle-password');
const eyeOpen = document.getElementById('eye-open');
const eyeClosed = document.getElementById('eye-closed');

togglePassword.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  eyeOpen.classList.toggle('hidden', isHidden);
  eyeClosed.classList.toggle('hidden', !isHidden);
  passwordInput.focus();
});

// --- محدود کردن شماره موبایل به 11 رقم ---
phoneInput.addEventListener('input', () => {
  phoneInput.value = phoneInput.value.replace(/[^0-9]/g, '').slice(0, 11);
});

// --- ارسال فرم لاگین ---
form.addEventListener('submit', async e => {
  e.preventDefault();
  errorBox.textContent = '';

  const phone = phoneInput.value.trim();
  const password = passwordInput.value;

  if (phone.length !== 11 || !phone.startsWith('09')) {
    errorBox.textContent = 'شماره موبایل معتبر وارد کنید.';
    return;
  }

  try {
    const res = await fetch(API.buildUrl('/api/auth/login'), {
      method: 'POST',
      ...API.ensureCredentials({
        headers: { 'Content-Type': 'application/json' },
      }),
      body: JSON.stringify({ phone, password })
    });
    const data = await res.json();

    if (!res.ok) {
      errorBox.textContent = data.message || 'ورود ناموفق بود.';
    } else {
      if (data?.token) {
        localStorage.setItem('seller_token', data.token);
        localStorage.setItem('token', data.token);
      }
      if (data?.seller) {
        localStorage.setItem('seller', JSON.stringify(data.seller));
      }
      // موفقیت: تصمیم‌گیری برای پنل مناسب
      const SERVICE_CATEGORY = 'خدمات';

      const catRaw = (data?.seller?.category ?? '').trim();
      const category = catRaw.normalize('NFC');
      const isServiceSeller = category === SERVICE_CATEGORY;

      const panel = isServiceSeller
        ? "../service-seller-panel/s-seller-panel.html"
        : "dashboard.html";

      const shopurl = (data?.seller?.shopurl ?? "").trim();
      const target = shopurl
        ? `${panel}?shopurl=${encodeURIComponent(shopurl)}`
        : panel;

      window.location.href = target;
    }
  } catch (err) {
    console.error('خطا در ورود:', err);
    errorBox.textContent = 'خطا در ارتباط با سرور.';
  }
});

// --- مدال فراموشی رمز ---
const OTP_CODE = '1234';
let forgotStep = 1;
let storedPhone = '';

const setInfoMessage = msg => {
  if (msg) {
    forgotInfo.textContent = msg;
    forgotInfo.classList.remove('hidden');
  } else {
    forgotInfo.textContent = '';
    forgotInfo.classList.add('hidden');
  }
};

const setSuccessMessage = msg => {
  if (msg) {
    forgotSuccess.textContent = msg;
    forgotSuccess.classList.remove('hidden');
  } else {
    forgotSuccess.textContent = '';
    forgotSuccess.classList.add('hidden');
  }
};

const maskPhone = phone => phone.replace(/(\d{4})(\d{3})(\d{4})/, '$1-$2-$3');

const setForgotStep = step => {
  forgotStep = step;
  stepPhone.classList.toggle('hidden', step !== 1);
  stepOtp.classList.toggle('hidden', step !== 2);
  stepReset.classList.toggle('hidden', step !== 3);
  const isDone = step === 4;
  forgotError.textContent = '';
  if (!isDone) setSuccessMessage('');

  if (step === 1) {
    forgotDescription.textContent = 'شماره موبایل ثبت‌شده در ویترینت را وارد کنید تا کد تأیید برای شما پیامک شود.';
    forgotSubmit.textContent = 'ارسال کد تأیید';
    setInfoMessage('برای نسخهٔ نمایشی، کد تأیید «1234» است.');
    setTimeout(() => forgotPhone.focus(), 0);
  } else if (step === 2) {
    forgotDescription.textContent = 'کد ۴ رقمی ارسال‌شده به شمارهٔ زیر را وارد کنید.';
    forgotSubmit.textContent = 'تأیید کد';
    otpPhone.textContent = storedPhone ? maskPhone(storedPhone) : '';
    otpInput.value = '';
    setInfoMessage(`کد نمایشی: ${OTP_CODE}`);
    setTimeout(() => otpInput.focus(), 0);
  } else if (step === 3) {
    forgotDescription.textContent = 'رمز عبور جدیدی تعیین کنید.';
    forgotSubmit.textContent = 'ثبت رمز جدید';
    newPasswordInput.value = '';
    confirmPasswordInput.value = '';
    setInfoMessage('رمز عبور باید حداقل ۶ کاراکتر باشد.');
    setTimeout(() => newPasswordInput.focus(), 0);
  } else if (step === 4) {
    forgotDescription.textContent = 'رمز عبور جدید با موفقیت ثبت شد.';
    forgotSubmit.textContent = 'بازگشت به ورود';
    setInfoMessage('');
    setSuccessMessage('اکنون می‌توانید با رمز جدید وارد شوید.');
  }
};

const resetForgotFlow = () => {
  storedPhone = '';
  forgotForm.reset();
  setForgotStep(1);
};

forgotBtn.addEventListener('click', () => {
  modalBg.classList.remove('hidden');
  resetForgotFlow();
});
modalClose.addEventListener('click', () => {
  modalBg.classList.add('hidden');
  resetForgotFlow();
});
modalCancel.addEventListener('click', () => {
  modalBg.classList.add('hidden');
  resetForgotFlow();
});
modalBg.addEventListener('click', e => {
  if (e.target === modalBg) {
    modalBg.classList.add('hidden');
    resetForgotFlow();
  }
});

// --- محدود کردن شماره در فراموشی رمز ---
forgotPhone.addEventListener('input', () => {
  forgotPhone.value = forgotPhone.value.replace(/[^0-9]/g, '').slice(0, 11);
  forgotError.textContent = '';
});

otpInput?.addEventListener('input', () => {
  otpInput.value = otpInput.value.replace(/[^0-9]/g, '').slice(0, 4);
});

otpEdit?.addEventListener('click', () => {
  setForgotStep(1);
  if (storedPhone) {
    forgotPhone.value = storedPhone;
    setTimeout(() => forgotPhone.setSelectionRange(0, forgotPhone.value.length), 0);
  }
});

otpResend?.addEventListener('click', () => {
  setSuccessMessage(`کد جدید ارسال شد (کد نمایشی: ${OTP_CODE}).`);
});

// --- ارسال فرم فراموشی رمز ---
forgotForm.addEventListener('submit', e => {
  e.preventDefault();

  if (forgotStep === 1) {
    const p = forgotPhone.value.trim();
    if (p.length !== 11 || !p.startsWith('09')) {
      forgotError.textContent = 'شماره موبایل معتبر وارد کنید.';
      return;
    }
    storedPhone = p;
    setForgotStep(2);
    setSuccessMessage(`کد تأیید برای شمارهٔ شما ارسال شد (کد نمایشی: ${OTP_CODE}).`);
    return;
  }

  if (forgotStep === 2) {
    const code = otpInput.value.trim();
    if (code.length !== 4) {
      forgotError.textContent = 'کد تأیید ۴ رقمی را کامل وارد کنید.';
      return;
    }
    if (code !== OTP_CODE) {
      forgotError.textContent = 'کد واردشده صحیح نیست.';
      return;
    }
    setForgotStep(3);
    return;
  }

  if (forgotStep === 3) {
    const newPass = newPasswordInput.value.trim();
    const confirmPass = confirmPasswordInput.value.trim();

    if (newPass.length < 6) {
      forgotError.textContent = 'رمز عبور باید حداقل ۶ کاراکتر باشد.';
      return;
    }
    if (newPass !== confirmPass) {
      forgotError.textContent = 'رمز و تکرار آن یکسان نیست.';
      return;
    }

    phoneInput.value = storedPhone;
    passwordInput.value = newPass;
    setForgotStep(4);
    return;
  }

  if (forgotStep === 4) {
    modalBg.classList.add('hidden');
    resetForgotFlow();
  }
});
