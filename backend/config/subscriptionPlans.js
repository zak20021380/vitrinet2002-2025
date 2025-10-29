const BADGE_VARIANTS = Object.freeze([
  'emerald',
  'amber',
  'sky',
  'violet',
  'rose',
  'slate'
]);

const SUBSCRIPTION_PLANS = [
  {
    slug: '1month',
    title: 'اشتراک ۱ ماهه',
    defaultDurationDays: 30,
    defaultDescription: 'شروع سریع فروشگاه در ویترینت طی یک ماه کامل حضور.',
    defaultFeatures: [
      'نمایش فروشگاه در نتایج جستجو و دسته‌بندی‌ها',
      'پشتیبانی استاندارد تیم ویترینت',
      'امکان فعالسازی سرویس‌های پرمیوم (VitriPlus)'
    ],
    defaultBadge: {
      label: 'پیشنهاد اقتصادی',
      variant: 'emerald',
      visible: true
    }
  },
  {
    slug: '3month',
    title: 'اشتراک ۳ ماهه',
    defaultDurationDays: 90,
    defaultDescription: 'پوشش یک فصل کامل با تمرکز بر جذب مشتریان وفادار.',
    defaultFeatures: [
      'همه امکانات پلن یک‌ماهه',
      'اولویت نمایش در لیست فروشگاه‌ها',
      'دسترسی سریع‌تر به تیم پشتیبانی'
    ],
    defaultBadge: {
      label: 'پیشنهاد محبوب',
      variant: 'amber',
      visible: true
    }
  },
  {
    slug: '12month',
    title: 'اشتراک ۱۲ ماهه',
    defaultDurationDays: 365,
    defaultDescription: 'راهکاری پایدار برای یک سال حضور مستمر و رشد پیوسته.',
    defaultFeatures: [
      'همه امکانات پلن‌های قبلی',
      'برندسازی و نمایش ویژه در کمپین‌های ویترینت',
      'پشتیبانی اختصاصی و گزارش‌های تحلیلی دوره‌ای'
    ],
    defaultBadge: {
      label: 'بیشترین صرفه‌جویی',
      variant: 'sky',
      visible: true
    }
  }
];

const SUBSCRIPTION_PLAN_MAP = new Map(SUBSCRIPTION_PLANS.map(plan => [plan.slug, plan]));

function getPlanDefinition(slug) {
  return SUBSCRIPTION_PLAN_MAP.get(slug) || null;
}

function getDefaultDurationDays(slug) {
  return getPlanDefinition(slug)?.defaultDurationDays ?? null;
}

function getDefaultDescription(slug) {
  return getPlanDefinition(slug)?.defaultDescription ?? '';
}

function getDefaultFeatures(slug) {
  return [...(getPlanDefinition(slug)?.defaultFeatures ?? [])];
}

function getDefaultBadge(slug) {
  const badge = getPlanDefinition(slug)?.defaultBadge;
  if (!badge) return null;
  return {
    label: badge.label || '',
    variant: BADGE_VARIANTS.includes(badge.variant) ? badge.variant : 'emerald',
    visible: badge.visible !== undefined ? !!badge.visible : !!badge.label
  };
}

module.exports = {
  SUBSCRIPTION_PLANS,
  BADGE_VARIANTS,
  getPlanDefinition,
  getDefaultDurationDays,
  getDefaultDescription,
  getDefaultFeatures,
  getDefaultBadge
};
