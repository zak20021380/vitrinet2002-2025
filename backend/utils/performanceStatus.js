/**
 * Utility helpers around seller performance scoring.
 */

/**
 * نمره ارسال‌شده توسط ادمین را نرمال‌سازی می‌کند (بین ۰ تا ۱۰۰).
 * اگر مقدار نامعتبر باشد، null برمی‌گرداند.
 * @param {unknown} value
 * @returns {number|null}
 */
function clampAdminScore(value) {
  if (value === null || value === undefined || value === '') return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  const rounded = Math.round(numeric);
  if (Number.isNaN(rounded)) return null;

  return Math.max(0, Math.min(100, rounded));
}

/**
 * بر اساس نمره ادمین، وضعیت عملکرد فروشنده را تعیین می‌کند.
 * @param {number|null} score
 * @returns {{status: 'unset'|'warning'|'good'|'excellent'|'critical', label: string, message: string, severity: 'neutral'|'warning'|'success'|'danger'|'info', canStay: boolean}}
 */
function evaluatePerformance(score) {
  const normalised = typeof score === 'number' ? score : clampAdminScore(score);

  if (normalised === null) {
    return {
      status: 'unset',
      label: 'منتظر ارزیابی',
      message: 'هنوز نمره‌ای برای این فروشنده ثبت نشده است. پس از ارزیابی ادمین، وضعیت عملکرد نمایش داده می‌شود.',
      severity: 'neutral',
      canStay: true
    };
  }

  if (normalised < 50) {
    return {
      status: 'critical',
      label: 'عدم تأیید',
      message: 'امتیاز کمتر از ۵۰ است؛ این فروشنده در وضعیت بحرانی قرار دارد و امکان ادامه همکاری در ویترینت را ندارد.',
      severity: 'danger',
      canStay: false
    };
  }

  if (normalised < 70) {
    return {
      status: 'warning',
      label: 'نیاز به بهبود',
      message: 'عملکرد فروشنده در مرز پذیرش است. برای حفظ حضور در ویترینت باید کیفیت خدمات و رضایت مشتریان بهبود یابد.',
      severity: 'warning',
      canStay: true
    };
  }

  if (normalised < 85) {
    return {
      status: 'good',
      label: 'عملکرد مناسب',
      message: 'نمره فروشنده قابل قبول است و می‌تواند به فعالیت در ویترینت ادامه دهد. پیشنهاد می‌شود روی بهبود مستمر تمرکز کند.',
      severity: 'success',
      canStay: true
    };
  }

  return {
    status: 'excellent',
    label: 'عملکرد عالی',
    message: 'فروشنده عملکرد بسیار خوبی دارد و به طور کامل واجد شرایط تمدید همکاری در ویترینت است.',
    severity: 'success',
    canStay: true
  };
}

module.exports = {
  clampAdminScore,
  evaluatePerformance
};

