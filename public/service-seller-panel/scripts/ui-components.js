class UIComponents {
  static formatPersianNumber(num) {
    if (typeof num !== 'number') return num;
    return new Intl.NumberFormat('fa-IR').format(num);
  }

  static formatPersianDate() {
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    return new Intl.DateTimeFormat('fa-IR-u-nu-latn', options).format(new Date());
  }

  // ⬇️ متد جدید: خروجی به فرم «شنبه ۲۳ شهریور»
static formatPersianDayMonth(dateInput) {
  if (!dateInput) return '';

  // ارقام فارسی/لاتین + ابزارهای کمکی
  const fa = '۰۱۲۳۴۵۶۷۸۹', en = '0123456789';
  const toEn = (s) => (s + '').replace(/[۰-۹]/g, d => en[fa.indexOf(d)]);
  const toFa = (s) => (s + '').replace(/[0-9]/g, d => fa[d]);
  const pad2 = (n) => String(n).padStart(2, '0');
  const faMonths = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

  let d = null;

  if (dateInput instanceof Date) {
    d = dateInput;
  } else {
    const s = toEn(String(dateInput).trim());

    // حالت ISO یا با زمان: 2025-09-02 یا 2025-09-02T10:00
    if (/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(s)) {
      d = new Date(s);
    } else {
      // yyyy/mm/dd یا yyyy-mm-dd یا yyyy.mm.dd
      const m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
      if (m) {
        const y = +m[1], mo = +m[2], da = +m[3];

        // اگر میلادی بود، مستقیم تاریخ بساز
        if (y >= 1700) {
          d = new Date(`${y}-${pad2(mo)}-${pad2(da)}`);
        } else if (y >= 1200 && y < 1700 && faMonths[mo - 1]) {
          // اگر جلالیِ متنی بود و کتابخانه‌ای برای تبدیل نداریم،
          // حداقل «روز + نام ماه» را برگردان (بدون نام روز هفته)
          return `${toFa(String(da))} ${faMonths[mo - 1]}`;
        }
      }
    }
  }

  // اگر نتونستیم Date معتبر بسازیم، ورودی را با ارقام فارسی برگردان
  if (!d || isNaN(d.getTime())) return toFa(String(dateInput));

  // خروجی استاندارد: «شنبه ۲۳ شهریور»
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(d);
}

static formatRelativeDate(dateStr) {
  if (!dateStr) return '';

  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const latinDigits = '0123456789';
  const toEnglish = (s) => s.replace(/[۰-۹]/g, (d) => latinDigits[persianDigits.indexOf(d)]);
  const toPersian = (s) => s.replace(/[0-9]/g, (d) => persianDigits[d]);
  const pad2 = (n) => String(n).padStart(2, '0');

  const normalizeInput = typeof dateStr === 'string' ? toEnglish(dateStr.trim()) : dateStr;

  let parsedDate;
  if (normalizeInput instanceof Date) {
    parsedDate = normalizeInput;
  } else if (typeof normalizeInput === 'number') {
    parsedDate = new Date(normalizeInput);
  } else {
    const candidate = String(normalizeInput || '');
    if (/^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/.test(candidate)) {
      // Normalize separators for reliable parsing
      parsedDate = new Date(candidate.replace(/-/g, '/'));
    } else {
      parsedDate = new Date(candidate);
    }
  }

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    const match = String(normalizeInput || '').match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (match) {
      const [, y, m, d] = match;
      return toPersian(`${y}/${pad2(m)}/${pad2(d)}`);
    }
    return toPersian(String(dateStr));
  }

  const tehranDayParts = (d) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  const startOfTehranDay = (d) => {
    const parts = tehranDayParts(d);
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  };

  const today = startOfTehranDay(new Date());
  const target = startOfTehranDay(parsedDate);
  const diffDays = Math.round((target - today) / 86400000);

  if (diffDays === 0) return 'امروز';
  if (diffDays === -1) return 'دیروز';
  if (diffDays === 1) return 'فردا';

  const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return toPersian(formatter.format(parsedDate));
}

static animateCountUp(el) {
  if (!el || !el.dataset || el.dataset.value == null) return;

  const raw = String(el.dataset.value);
  const isDecimal = raw.includes('.');
  const target = isDecimal ? parseFloat(raw) : parseInt(raw, 10);
  if (!Number.isFinite(target)) return;

  let frame = 0;
  const duration = 50; // frames
  const step = target / duration;

  function counter() {
    frame++;
    const current = step * frame;

    if (isDecimal) {
      const val = Math.min(current, target);
      el.textContent = UIComponents.formatPersianNumber(parseFloat(val.toFixed(1)));
    } else {
      el.textContent = UIComponents.formatPersianNumber(Math.min(Math.ceil(current), target));
    }

    if (frame < duration) {
      requestAnimationFrame(counter);
    } else {
      el.textContent = UIComponents.formatPersianNumber(target);
    }
  }

  requestAnimationFrame(counter);
}

static showToast(message, type = 'info', duration = 4000) {
  const toastRoot = document.getElementById('toast-root');
  if (!toastRoot) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
  toast.style.animation = `slideInUp 0.4s ease forwards, fadeOut 0.4s ease ${duration - 400}ms forwards`;
  toastRoot.appendChild(toast);
  setTimeout(() => { toast.remove(); }, duration);
}

// Modal & Drawer Logic
static _handleOverlay(overlay, trigger, isOpen) {
  const body = document.body;
  const mainContent = document.getElementById('app');
  if (isOpen) {
    StateManager.isModalOpen = true;
    StateManager.focusedElementBeforeModal = document.activeElement;
    overlay.classList.add('is-open');
    body.classList.add('has-overlay');
    mainContent.setAttribute('aria-hidden', 'true');
    const focusableElements = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    overlay.addEventListener('keydown', (e) => this._trapFocus(e, firstFocusable, lastFocusable));
    if (firstFocusable) firstFocusable.focus();
  } else {
    StateManager.isModalOpen = false;
    overlay.classList.remove('is-open');
    body.classList.remove('has-overlay');
    mainContent.removeAttribute('aria-hidden');
    if (StateManager.focusedElementBeforeModal) {
      StateManager.focusedElementBeforeModal.focus();
    }
  }
}

static _trapFocus(e, firstFocusable, lastFocusable) {
  if (e.key !== 'Tab') return;
  if (e.shiftKey) { /* shift + tab */
    if (document.activeElement === firstFocusable) {
      lastFocusable.focus();
      e.preventDefault();
    }
  } else { /* tab */
    if (document.activeElement === lastFocusable) {
      firstFocusable.focus();
      e.preventDefault();
    }
  }
}

static openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.hidden = false;
  this._handleOverlay(modal, null, true);
}

static closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.hidden = true;
  this._handleOverlay(modal, null, false);
}

static openDrawer(drawerId) {
  const drawer = document.getElementById(drawerId);
  if (!drawer) return;
  drawer.hidden = false;
  this._handleOverlay(drawer, null, true);
}

static closeDrawer(drawerId) {
  const drawer = document.getElementById(drawerId);
  if (!drawer) return;
  drawer.hidden = true;
  this._handleOverlay(drawer, null, false);
}
}

export default UIComponents;
