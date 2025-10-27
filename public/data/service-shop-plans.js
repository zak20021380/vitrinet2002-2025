(function (global) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const persianDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  const startOfToday = (() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  })();
  const addDays = (date, days) => new Date(date.getTime() + days * MS_PER_DAY);
  const toISOStringWithOffset = (date) => {
    if (!date) return null;
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
  };
  const toPersianDigits = (value) => String(value).replace(/\d/g, (d) => persianDigits[d] ?? d);

  const base = [
    {
      id: 'wallet',
      name: 'ولت',
      manager: 'ابراهیم اصفهانی',
      category: 'خدمات خودرو',
      phone: '09137100084',
      status: { type: 'active', label: 'فعال و ممتاز' },
      responseMinutes: 12,
      plan: {
        isActive: true,
        startDaysAgo: 4,
        durationDays: 45,
        lastUpdateDaysAgo: 0,
        perks: [
          'ثبت نامحدود خدمات محبوب برای جذب مشتریان جدید',
          'نمایش ویژه در نتایج جست‌وجوی ویترینت',
          'پشتیبانی اختصاصی راه‌اندازی و فروش'
        ]
      },
      analytics: {
        bookings: { total: 428, change: 0.08, approved: 398, approvalRate: 0.93 },
        rating: { average: 4.8, count: 237 },
        revenue: { monthly: 184, change: 0.12 },
        cancellation: { cancelled: 14 },
        newCustomers: 64,
        returningCustomersRatio: 0.32,
        avgCompletionTime: { hours: 3, minutes: 45 },
        ontimeRate: 0.87,
        topServices: [
          { name: 'تعمیر سیستم صوتی و برق خودرو', bookings: 156, revenueShare: 42 },
          { name: 'سرامیک بدنه و صفرشویی', bookings: 112, revenueShare: 33 },
          { name: 'نصب آپشن‌های هوشمند', bookings: 74, revenueShare: 25 }
        ],
        weeklyRevenue: [
          { day: 'شنبه', amount: 21 },
          { day: 'یکشنبه', amount: 26 },
          { day: 'دوشنبه', amount: 28 },
          { day: 'سه‌شنبه', amount: 32 },
          { day: 'چهارشنبه', amount: 27 },
          { day: 'پنجشنبه', amount: 30 },
          { day: 'جمعه', amount: 20 }
        ]
      }
    },
    {
      id: 'mostofi',
      name: 'mostofi',
      manager: 'احسان مصطفوی',
      category: 'خدمات رایانه و شبکه',
      phone: '09016700084',
      status: { type: 'hold', label: 'نیازمند پیگیری' },
      responseMinutes: 25,
      plan: {
        isActive: true,
        startDaysAgo: 18,
        durationDays: 30,
        lastUpdateDaysAgo: 1,
        perks: [
          'دسترسی رایگان به ابزارهای تیکتینگ و نوبت‌دهی',
          'تحلیل ماهانه عملکرد با گزارش ایمیلی',
          'تسهیل معرفی مشتریان جدید توسط ویترینت'
        ]
      },
      analytics: {
        bookings: { total: 212, change: -0.04, approved: 180, approvalRate: 0.85 },
        rating: { average: 4.3, count: 118 },
        revenue: { monthly: 92, change: -0.03 },
        cancellation: { cancelled: 18 },
        newCustomers: 28,
        returningCustomersRatio: 0.41,
        avgCompletionTime: { hours: 5, minutes: 10 },
        ontimeRate: 0.76,
        topServices: [
          { name: 'پشتیبانی شبکه اداری', bookings: 84, revenueShare: 46 },
          { name: 'عیب‌یابی سرور و مجازی‌سازی', bookings: 62, revenueShare: 32 },
          { name: 'تعمیرات تخصصی لپ‌تاپ', bookings: 38, revenueShare: 22 }
        ],
        weeklyRevenue: [
          { day: 'شنبه', amount: 11 },
          { day: 'یکشنبه', amount: 13 },
          { day: 'دوشنبه', amount: 14 },
          { day: 'سه‌شنبه', amount: 16 },
          { day: 'چهارشنبه', amount: 15 },
          { day: 'پنجشنبه', amount: 12 },
          { day: 'جمعه', amount: 9 }
        ]
      }
    },
    {
      id: 'digisir',
      name: 'فروشگاه دیجیسیر',
      manager: 'ساناز موسوی',
      category: 'خدمات لوازم خانگی هوشمند',
      phone: '09391100924',
      status: { type: 'risk', label: 'ریسک لغو بالا' },
      responseMinutes: 32,
      plan: {
        isActive: true,
        startDaysAgo: 35,
        durationDays: 30,
        lastUpdateDaysAgo: 2,
        perks: [
          'یادآوری پیامکی برای مشتریان ویزیت حضوری',
          'پشتیبانی برای مدیریت لغو سفارش‌های پرریسک',
          'تحلیل رایگان رضایت مشتریان و پیشنهاد بهبود'
        ]
      },
      analytics: {
        bookings: { total: 156, change: -0.09, approved: 118, approvalRate: 0.76 },
        rating: { average: 3.9, count: 74 },
        revenue: { monthly: 68, change: -0.05 },
        cancellation: { cancelled: 26 },
        newCustomers: 18,
        returningCustomersRatio: 0.28,
        avgCompletionTime: { hours: 6, minutes: 20 },
        ontimeRate: 0.61,
        topServices: [
          { name: 'نصب و عیب‌یابی سیستم‌های هوشمندسازی', bookings: 54, revenueShare: 38 },
          { name: 'راه‌اندازی مجدد لوازم خانگی هوشمند', bookings: 48, revenueShare: 34 },
          { name: 'آموزش حضوری خانواده‌ها', bookings: 22, revenueShare: 28 }
        ],
        weeklyRevenue: [
          { day: 'شنبه', amount: 7 },
          { day: 'یکشنبه', amount: 9 },
          { day: 'دوشنبه', amount: 10 },
          { day: 'سه‌شنبه', amount: 11 },
          { day: 'چهارشنبه', amount: 10 },
          { day: 'پنجشنبه', amount: 12 },
          { day: 'جمعه', amount: 9 }
        ]
      }
    }
  ];

  const shops = {};

  base.forEach((shop) => {
    const planStart = shop.plan.startDaysAgo != null
      ? addDays(startOfToday, -shop.plan.startDaysAgo)
      : null;
    const planEnd = shop.plan.endDaysFromNow != null
      ? addDays(startOfToday, shop.plan.endDaysFromNow)
      : (shop.plan.durationDays != null && planStart)
        ? addDays(planStart, shop.plan.durationDays)
        : null;
    const lastUpdated = shop.plan.lastUpdateDaysAgo != null
      ? addDays(startOfToday, -shop.plan.lastUpdateDaysAgo)
      : startOfToday;

    shops[shop.id] = {
      id: shop.id,
      name: shop.name,
      manager: shop.manager,
      category: shop.category,
      phone: toPersianDigits(shop.phone),
      status: shop.status,
      responseMinutes: shop.responseMinutes,
      plan: {
        isActive: !!shop.plan.isActive,
        startDate: planStart ? toISOStringWithOffset(planStart) : null,
        endDate: planEnd ? toISOStringWithOffset(planEnd) : null,
        lastUpdated: lastUpdated ? toISOStringWithOffset(lastUpdated) : null,
        durationDays: shop.plan.durationDays ?? null,
        perks: Array.isArray(shop.plan.perks) ? shop.plan.perks.slice() : []
      },
      analytics: shop.analytics
    };
  });

  global.ServiceShopPlans = Object.freeze({
    generatedAt: toISOStringWithOffset(startOfToday),
    shops
  });
})(typeof window !== 'undefined' ? window : globalThis);
