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

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMultiline(value) {
    if (!value) return '';
    return escapeHtml(value).replace(/\n/g, '<br>');
  }

  function applyState(refs, state) {
    const severity = state && state.severity ? state.severity : 'neutral';
    const displayName = state && state.displayName ? state.displayName : '';
    const addressedName = displayName || 'فروشنده';
    if (refs.card) {
      refs.card.className = `score-card status-${severity}`;
    }

    if (refs.greetingName) {
      refs.greetingName.textContent = addressedName;
    }
    if (refs.messageName) {
      refs.messageName.textContent = addressedName;
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
      const greetingPrefix = displayName ? `${displayName} عزیز، ` : '';
      refs.statusEl.textContent = state && state.statusMessage
        ? `${greetingPrefix}${state.statusMessage}`
        : `${greetingPrefix}به محض ثبت نمره توسط تیم ادمین، وضعیت عملکردت نمایش داده می‌شود.`;
    }
    if (refs.updatedEl) {
      refs.updatedEl.textContent = state && state.updatedAt
        ? `آخرین بروزرسانی: ${formatDateTime(state.updatedAt)}`
        : 'آخرین بروزرسانی: —';
    }

    if (refs.summaryEl) {
      let summaryMessage = 'پس از ثبت نمره، توصیه‌های لازم برای حفظ یا بهبود حضور در ویترینت نمایش داده می‌شود.';
      const summaryPrefix = displayName ? `${displayName} عزیز، ` : '';
      if (!state || state.adminScore == null) {
        summaryMessage = `${summaryPrefix}هنوز امتیازی برای شما ثبت نشده است. پس از ارزیابی تیم ادمین، نتیجه و راهنمایی‌های لازم اینجا قرار می‌گیرد.`;
      } else if (state.canStay === false) {
        summaryMessage = `${summaryPrefix}⛔ با نمره فعلی امکان ادامه فعالیت در ویترینت وجود ندارد. لطفاً برای بررسی مجدد با پشتیبانی تماس بگیر یا اقدامات اصلاحی پیشنهاد شده را انجام بده.`;
      } else if (severity === 'warning') {
        summaryMessage = `${summaryPrefix}⚠️ شما واجد شرایط ادامه همکاری هستید، اما لازم است در ارائه خدمات و رضایت مشتریان بهبود ایجاد کنید تا ریسک خروج از ویترینت کاهش یابد.`;
      } else if (severity === 'danger') {
        summaryMessage = `${summaryPrefix}⛔ امتیاز شما کمتر از حد قابل قبول است و باید فوراً مشکلات را برطرف کنید. برای دریافت راهنمایی بیشتر با تیم پشتیبانی هماهنگ شوید.`;
      } else {
        summaryMessage = `${summaryPrefix}✅ عملکرد شما مورد تأیید است. برای حفظ این وضعیت، روند فعلی را ادامه بده و همواره بازخورد مشتریان را بررسی کن.`;
      }
      refs.summaryEl.textContent = summaryMessage;
    }

    if (refs.messageCard) {
      const message = state && typeof state.adminScoreMessage === 'string'
        ? state.adminScoreMessage.trim()
        : '';
      if (message) {
        if (refs.messageText) {
          refs.messageText.innerHTML = formatMultiline(message);
        }
        if (refs.messageUpdated) {
          refs.messageUpdated.textContent = state && state.updatedAt
            ? `ارسال شده در ${formatDateTime(state.updatedAt)}`
            : '';
        }
        refs.messageCard.hidden = false;
      } else {
        refs.messageCard.hidden = true;
      }
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
      summaryEl: root.querySelector('#performance-summary-text'),
      greetingName: root.querySelector('#performance-greeting-name'),
      messageCard: root.querySelector('#performance-message-card'),
      messageText: root.querySelector('#performance-message-text'),
      messageUpdated: root.querySelector('#performance-message-updated'),
      messageName: root.querySelector('#performance-message-name')
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
