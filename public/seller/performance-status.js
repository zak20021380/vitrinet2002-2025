(function () {
  'use strict';

  const API = window.VITRINET_API || null;
  const apiUrl = path => API ? API.buildUrl(path) : `http://localhost:5000${path}`;
  const withCreds = (init = {}) => {
    if (API) return API.ensureCredentials(init);
    if (init.credentials === undefined) {
      return { ...init, credentials: 'include' };
    }
    return init;
  };

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

  const fallbackCityRanking = {
    city: 'سنندج',
    totalShops: 412,
    visitRank: 7,
    visitPercentile: 94,
    avgVisit: 680,
    yourVisit: 1240,
    customerRank: 5,
    customerPercentile: 96,
    avgCustomer: 210,
    yourCustomer: 338,
    updatedAt: '2025-01-03T08:00:00Z'
  };

  async function fetchCityRanking() {
    try {
      const res = await fetch(apiUrl('/api/seller/performance/city-ranking'), withCreds());
      if (!res.ok) {
        throw new Error('response not ok');
      }
      const payload = await res.json();
      if (!payload || typeof payload !== 'object') {
        throw new Error('invalid payload');
      }
      return { ...fallbackCityRanking, ...payload };
    } catch (err) {
      console.warn('city ranking fallback in use', err);
      return fallbackCityRanking;
    }
  }

  function renderCityRanking(refs, ranking) {
    if (!refs.rankingSection || !ranking) return;

    const total = ranking.totalShops || 0;
    const visitRank = ranking.visitRank || '--';
    const customerRank = ranking.customerRank || '--';
    const visitPercentile = Math.min(100, Math.max(0, ranking.visitPercentile || 0));
    const customerPercentile = Math.min(100, Math.max(0, ranking.customerPercentile || 0));

    const setText = (el, value) => { if (el) el.textContent = value; };
    const formatNumber = (val, suffix = '') => {
      if (typeof val !== 'number' || Number.isNaN(val)) return `—${suffix}`;
      return `${val.toLocaleString('fa-IR')}${suffix}`;
    };

    const visitSurpassed = (typeof total === 'number' && typeof visitRank === 'number')
      ? Math.max(total - visitRank, 0)
      : null;
    const customerSurpassed = (typeof total === 'number' && typeof customerRank === 'number')
      ? Math.max(total - customerRank, 0)
      : null;

    const visitMultiplierValue = (typeof ranking.yourVisit === 'number' && typeof ranking.avgVisit === 'number' && ranking.avgVisit > 0)
      ? (ranking.yourVisit / ranking.avgVisit)
      : null;
    const customerLeadValue = (typeof ranking.yourCustomer === 'number' && typeof ranking.avgCustomer === 'number')
      ? ranking.yourCustomer - ranking.avgCustomer
      : null;

    setText(refs.visitRank, typeof visitRank === 'number' ? visitRank.toLocaleString('fa-IR') : visitRank);
    setText(refs.visitSurpassed, visitSurpassed != null
      ? `از ${formatNumber(visitSurpassed)} رقیب جلو زدی!`
      : 'پله محبوبیتت اوج گرفته');
    setText(refs.visitMultiplier, visitMultiplierValue != null
      ? `${visitMultiplierValue.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}x پررفت‌وآمدتر از بازار شهر`
      : 'پررفت‌وآمدتر از بازار شهر');
    setText(refs.visitYour, `بازدید واقعی تو: ${formatNumber(ranking.yourVisit)}`);
    setText(refs.visitPercentile, visitPercentile
      ? `🔥 فروشگاه داغ · جلوتر از ${visitPercentile.toLocaleString('fa-IR')}٪`
      : '🔥 فروشگاه داغ');
    setText(refs.visitPercentileNote, visitPercentile
      ? `در بین ${visitPercentile.toLocaleString('fa-IR')}٪ بالایی`
      : 'در مسیر داغ شدن بازار');
    if (refs.visitProgress) {
      refs.visitProgress.style.width = `${visitPercentile}%`;
    }

    setText(refs.customerRank, typeof customerRank === 'number' ? customerRank.toLocaleString('fa-IR') : customerRank);
    setText(refs.customerSurpassed, customerSurpassed != null
      ? `بازار در دست توست؛ از ${formatNumber(customerSurpassed)} فروشگاه جلوتر هستی`
      : 'باشگاه وفاداری دست توست');
    setText(refs.customerLead, customerLeadValue != null
      ? `${customerLeadValue > 0 ? '+' : ''}${formatNumber(customerLeadValue)} نفر جلوتر از فروشگاه‌های معمولی`
      : 'جلوتر از فروشگاه‌های معمولی');
    setText(refs.customerYour, `مشتری‌های فعال تو: ${formatNumber(ranking.yourCustomer)}`);
    setText(refs.customerPercentile, customerPercentile
      ? `🤝 رهبر جامعه · جلوتر از ${customerPercentile.toLocaleString('fa-IR')}٪`
      : '🤝 رهبر جامعه');
    setText(refs.customerPercentileNote, customerPercentile
      ? `در بین ${customerPercentile.toLocaleString('fa-IR')}٪ بالایی`
      : 'جایگاه وفاداری بالا');
    if (refs.customerProgress) {
      refs.customerProgress.style.width = `${customerPercentile}%`;
    }

    if (refs.updated) {
      refs.updated.textContent = ranking.updatedAt
        ? `آخرین بروزرسانی: ${formatDateTime(ranking.updatedAt)}`
        : 'آخرین بروزرسانی: —';
    }

    refs.rankingSection.hidden = false;
  }

  async function fetchPerformancePayload() {
    const res = await fetch(apiUrl('/api/seller/performance/status'), withCreds());
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
      messageName: root.querySelector('#performance-message-name'),
      rankingSection: root.querySelector('#city-ranking'),
      visitRank: root.querySelector('#visit-rank'),
      visitYour: root.querySelector('#visit-your'),
      visitPercentile: root.querySelector('#visit-percentile-badge'),
      visitPercentileNote: root.querySelector('#visit-percentile-note'),
      visitSurpassed: root.querySelector('#visit-surpassed'),
      visitMultiplier: root.querySelector('#visit-multiplier'),
      visitProgress: root.querySelector('#visit-progress'),
      customerRank: root.querySelector('#customer-rank'),
      customerYour: root.querySelector('#customer-your'),
      customerPercentile: root.querySelector('#customer-percentile-badge'),
      customerPercentileNote: root.querySelector('#customer-percentile-note'),
      customerSurpassed: root.querySelector('#customer-surpassed'),
      customerLead: root.querySelector('#customer-lead'),
      customerProgress: root.querySelector('#customer-progress'),
      customerCta: root.querySelector('#customer-cta'),
      updated: root.querySelector('#city-ranking-updated')
    };

    try {
      const [performancePayload, ranking] = await Promise.all([
        fetchPerformancePayload(),
        fetchCityRanking()
      ]);
      applyState(refs, performancePayload);
      renderCityRanking(refs, ranking);
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
