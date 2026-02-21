// Shared dashboard state (extracted from dashboard.js)

let currentBookingFilter = 'all';
let allBookings = [];

let pollHandle = null;
let bookingsData = [];
let bookingsLoaded = false;
const profileState = {
  isAuthenticated: false,
  user: {
    firstName: '',
    lastName: '',
    city: '',
    phone: ''
  }
};

    const missionData = {
      invite: {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`,
        title: 'دعوت و کسب درآمد',
        isInviteModal: true, // نشانگر مودال ویژه دعوت
        primaryBtn: {
          text: 'کپی کد معرف',
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`,
          action: 'copy'
        }
      },
      booking: {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
        reward: '۲,۰۰۰ تومان',
        title: 'اولین رزرو',
        desc: 'اولین سرویست رو همین امروز رزرو کن و فوری کش‌بک بگیر!',
        primaryBtn: {
          text: 'مشاهده خدمات',
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
          action: 'browse'
        },
        secondaryBtn: null
      },
      bookAppointment: {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/></svg>`,
        reward: '۵,۰۰۰ تومان',
        title: 'رزرو نوبت آنلاین',
        isBookingModal: true,
        desc: 'اولین نوبت خود را آنلاین رزرو کنید و ۵,۰۰۰ تومان اعتبار هدیه بگیرید! 📅',
        primaryBtn: {
          text: 'رزرو نوبت و دریافت هدیه',
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M9 16l2 2 4-4"/></svg>`,
          action: 'bookAppointment'
        },
        secondaryBtn: null
      },
      profile: {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M12 8v13"/><path d="M3 13h18"/><circle cx="12" cy="4" r="1" fill="currentColor" stroke="none"/></svg>`,
        reward: '۵۰۰ تومان',
        title: 'کادوی تولد تو',
        desc: 'تاریخ تولدت رو ثبت کن تا روز تولدت سورپرایزت کنیم! 🎁\nهمین الان هم ۵۰۰ تومان جایزه بگیر.',
        primaryBtn: {
          text: 'ثبت تاریخ تولد',
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
          action: 'edit'
        },
        secondaryBtn: null
      },
      explore: {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
        reward: '۲۰۰ تومان',
        title: 'گردش در بازار',
        isExploreModal: true, // نشانگر مودال ویژه گردشگر
        desc: '۹۰ ثانیه محصولات رو ببین و ۲۰۰ تومان جایزه بگیر!',
        primaryBtn: {
          text: 'شروع گردش',
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>`,
          action: 'startExplore'
        },
        secondaryBtn: null
      },
      whereIs: {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="16" r="1" fill="currentColor"/><path d="M12 14V8"/><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/></svg>`,
        reward: 'جایزه پس از پاسخ صحیح',
        rewardToman: 5000,
        title: 'اینجا کجاست؟',
        subtitle: 'حدس بزن و اعتبار بگیر',
        fomoBadge: 'فقط تا امشب ⏱️',
        isWhereIsModal: true,
        quizImage: '/assets/images/shop-placeholder.svg',
        options: [
          { id: 'a', text: 'کافه ترنج' },
          { id: 'b', text: 'بوتیک پارمیس' },
          { id: 'c', text: 'کتاب‌فروشی آفتاب' },
          { id: 'd', text: 'نانوایی سنگک بازار' }
        ]
      },
      installApp: {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><path d="M12 18h.01"/><path d="M12 6v6"/><path d="M9 9l3 3 3-3"/></svg>`,
        reward: '۱۰,۰۰۰ تومان',
        title: 'نصب اپلیکیشن و دریافت جایزه',
        isInstallAppModal: true, // نشانگر مودال ویژه نصب اپلیکیشن
        desc: 'اپلیکیشن ویترینت رو نصب کن و بعد از اولین ورود، ۱۰ هزار تومان اعتبار هدیه بگیر!',
        primaryBtn: {
          text: 'دانلود مستقیم اپلیکیشن',
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
          action: 'installApp'
        },
        secondaryBtn: null
      }
    };

let currentMissionType = null;
let whereIsSelectedOptionId = null;
let userReferralCode = null;

let deferredPrompt = null;
let cachedExploreProgress = null;

let chatsList = [];               // لیست چت‌ها
let currentCid = null;             // آی‌دی چت انتخاب شده
let blockedSellers = [];            // فروشندگان مسدودشده
let currentMsgFilter = 'all';

window.completedMissions = new Set();

let notificationsData = [];
let unreadCount = 0;

let streakData = null;
let walletData = null;
