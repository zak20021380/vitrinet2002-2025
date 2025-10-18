(function () {
  'use strict';

  function formatDateTime(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('fa-IR', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch (err) {
      return '';
    }
  }

  function applyState(refs, state) {
    const severity = state && state.severity ? state.severity : 'neutral';
    if (refs.card) {
      refs.card.className = `score-card status-${severity}`;
    }

    if (refs.scoreEl) {
      if (state && state.adminScore != null) {
        refs.scoreEl.innerHTML = `${state.adminScore}<span class="score-suffix">/100</span>`;
      } else {
        refs.scoreEl.innerHTML = `--<span class="score-suffix">/100</span>`;
      }
    }

    if (refs.labelEl) {
      refs.labelEl.textContent = state && state.statusLabel ? state.statusLabel : 'در انتظار ارزیابی';
    }
    if (refs.statusEl) {
      refs.statusEl.textContent = state && state.statusMessage
        ? state.statusMessage
        : 'به محض ثبت نمره توسط تیم ادمین، وضعیت عملکردت نمایش داده می‌شود.';
    }
    if (refs.updatedEl) {
      refs.updatedEl.textContent = state && state.updatedAt
        ? `آخرین بروزرسانی: ${formatDateTime(state.updatedAt)}`
        : 'آخرین بروزرسانی: —';
    }

    if (refs.summaryEl) {
      let summaryMessage = 'پس از ثبت نمره، توصیه‌های لازم برای حفظ یا بهبود حضور در ویترینت نمایش داده می‌شود.';
      if (!state || state.adminScore == null) {
        summaryMessage = 'هنوز امتیازی برای شما ثبت نشده است. پس از ارزیابی تیم ادمین، نتیجه و راهنمایی‌های لازم اینجا قرار می‌گیرد.';
      } else if (state.canStay === false) {
        summaryMessage = '⛔ با نمره فعلی امکان ادامه فعالیت در ویترینت وجود ندارد. لطفاً برای بررسی مجدد با پشتیبانی تماس بگیر یا اقدامات اصلاحی پیشنهاد شده را انجام بده.';
      } else if (severity === 'warning') {
        summaryMessage = '⚠️ شما واجد شرایط ادامه همکاری هستید، اما لازم است در ارائه خدمات و رضایت مشتریان بهبود ایجاد کنید تا ریسک خروج از ویترینت کاهش یابد.';
      } else if (severity === 'danger') {
        summaryMessage = '⛔ امتیاز شما کمتر از حد قابل قبول است و باید فوراً مشکلات را برطرف کنید. برای دریافت راهنمایی بیشتر با تیم پشتیبانی هماهنگ شوید.';
      } else {
        summaryMessage = '✅ عملکرد شما مورد تأیید است. برای حفظ این وضعیت، روند فعلی را ادامه بده و همواره بازخورد مشتریان را بررسی کن.';
      }
      refs.summaryEl.textContent = summaryMessage;
    }
  }

  function renderError(root, message) {
    if (!root) return;
    root.innerHTML = `<div class="error-box">${message}</div>`;
  }

  async function fetchPerformancePayload() {
    const res = await fetch('/api/seller/performance/status', { credentials: 'include' });
    let payload = null;
    try {
      payload = await res.json();
    } catch (err) {
      payload = null;
    }

    if (!res.ok) {
      const message = payload && payload.message ? payload.message : 'خطا در دریافت وضعیت عملکرد. لطفاً دوباره تلاش کن.';
      throw new Error(message);
    }

    return payload || {};
  }

  async function initSellerPerformanceStatus(rootElement) {
    const root = rootElement || document.getElementById('performance-root');
    if (!root || root.dataset.performanceInitialising === '1') {
      return;
    }

    root.dataset.performanceInitialising = '1';

    const refs = {
      root,
      card: root.querySelector('#performance-card'),
      scoreEl: root.querySelector('#performance-score'),
      labelEl: root.querySelector('#performance-label'),
      statusEl: root.querySelector('#performance-status'),
      updatedEl: root.querySelector('#performance-updated'),
      summaryEl: root.querySelector('#performance-summary-text')
    };

    try {
      const payload = await fetchPerformancePayload();
      applyState(refs, payload);
    } catch (err) {
      console.error('loadPerformanceStatus error:', err);
      renderError(root, err.message || 'خطا در دریافت وضعیت عملکرد.');
    } finally {
      delete root.dataset.performanceInitialising;
    }
  }

  window.initSellerPerformanceStatus = initSellerPerformanceStatus;

  if (document.readyState !== 'loading') {
    initSellerPerformanceStatus();
  } else {
    document.addEventListener('DOMContentLoaded', () => initSellerPerformanceStatus());
  }
})();
