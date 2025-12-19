// routes/chatRoutes.js

const express = require('express');
const router  = express.Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middlewares/authMiddleware');
const chatController = require('../controllers/chatController');

// ═══════════════════════════════════════════════════════════════
// Rate Limiters برای امنیت بیشتر
// ═══════════════════════════════════════════════════════════════

// Rate limiter برای ایجاد چت جدید
const createChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 دقیقه
  max: 10, // حداکثر 10 درخواست در دقیقه
  message: { 
    error: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً کمی صبر کنید.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});

// Rate limiter برای ارسال پیام
const sendMessageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 دقیقه
  max: 20, // حداکثر 20 پیام در دقیقه
  message: { 
    error: 'تعداد پیام‌های شما بیش از حد مجاز است. لطفاً کمی صبر کنید.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});

// Rate limiter سخت‌گیرانه برای جلوگیری از حملات brute force
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقیقه
  max: 100, // حداکثر 100 درخواست در 15 دقیقه
  message: { 
    error: 'فعالیت مشکوک شناسایی شد. لطفاً بعداً تلاش کنید.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false
});




router.post('/createAdminUserChat', auth(), chatController.createAdminUserChat);


/*━━━━━━━━━━ مسیرهای عمومی کاربر ━━━━━━━━━━*/
// 0-A) اگر چت بین دو طرف وجود نداشت، بساز و برگردان
router.post(
  '/ensure',                 // POST /api/chats/ensure
  auth(),                    // هر کاربر لاگین (customer | seller | admin)
  chatController.ensureChat  // ← این متد را در کنترلر ساخته‌ایم
);

// 0-B) همهٔ چت‌های کاربر لاگین
router.get(
  '/my',                     // GET  /api/chats/my
  auth(),                    // هر کاربر لاگین
  chatController.getMyChats  // ← این متد را در کنترلر ساخته‌ایم
);



// routes/chatRoutes.js - اضافه کردن روت جدید



/*━━━━━━━━━━ ۱) گرفتن چت‌های یک فروشنده ━━━━━━━━━━*/
router.get(
  '/',
  auth('seller'),
  chatController.getChatsBySeller
);


/*━━━━━━━━━━ ۲) ادمین می‌خواد همهٔ چت‌ها رو بگیره ━━━━━━━━━━*/
router.get('/all',
  auth('admin'),
  chatController.getAllChats
);



/*━━━━━━━━━━ ۳) ایجاد چت جدید - با Rate Limiting ━━━━━━━━━━*/
router.post('/',
  strictLimiter,         // محافظت در برابر حملات
  createChatLimiter,     // محدودیت ایجاد چت
  auth(),                // نقش null یعنی هر کسی با توکن معتبر (seller|admin|user)
  chatController.createChat
);

/*━━━━━━━━━━ ۴) فروشنده پاسخ می‌دهد ━━━━━━━━━━*/
router.post('/:id/reply',
  auth('seller'),
  chatController.replyToChat
);

/*━━━━━━━━━━ ۵) مدیر پاسخ می‌دهد ━━━━━━━━━━*/
router.post('/:id/admin-reply',
  auth('admin'),
  chatController.adminReplyToChat
);

/*━━━━━━━━━━ ۶) علامت خوانده شدن پیام ━━━━━━━━━━*/
router.post('/:id/mark-read',
  auth('admin'),
  chatController.markMessagesRead
);

/*━━━━━━━━━━ ۶-ب) علامت خوانده شدن پیام توسط فروشنده ━━━━━━━━━━*/
router.post('/:id/mark-read-seller',
  auth('seller'),
  chatController.markMessagesReadBySeller
);

/*━━━━━━━━━━ ۷) حذف چت ━━━━━━━━━━*/
router.delete('/:id',
  auth(),  // هر کاربر لاگین شده می‌تونه چت خودش رو حذف کنه
  chatController.deleteChat
);

/*━━━━━━━━━━ ۸) پخش پیام به همه ━━━━━━━━━━*/
router.post('/broadcast',
  auth('admin'),
  chatController.broadcastMessage
);

/*━━━━━━━━━━ ۹) بلاک فرستنده ━━━━━━━━━━*/
router.post('/:id/block',
  auth('admin'),
  chatController.blockSender
);

// مسدودسازی مستقیم کاربر یا فروشنده توسط ادمین
router.post('/block-target',
  auth('admin'),
  chatController.blockTarget
);

router.post('/unblock-target',
  auth('admin'),
  chatController.unblockTarget
);

// اجازه می‌دهیم فروشنده با مدیر چت جدیدی باز کند
router.post(
  '/contact-admin',
  auth('seller'),           // فقط فروشنده‌ی لاگین‌کرده می‌تواند پیام بفرستد
  chatController.contactAdmin
);



// ۱۰) تعداد پیام‌های نخوانده
router.get(
  '/unreadCount',
  auth(),
  chatController.getUnreadCount
);


/*━━━━━━━━━━ ۱۱) علامت‌گذاری همهٔ پیام‌ها به عنوان خوانده‌شده ━━━━━━━━━━*/
router.post(
  '/markAllRead',
  auth('seller'),
  (req, res, next) => {
    // اطمینان از اینکه sellerId از توکن کاربر گرفته شود
    req.body.sellerId = req.user.id;
    return chatController.markAllRead(req, res, next);
  }
);




router.get('/:id', auth(), chatController.getChatById);

/*━━━━━━━━━━ ارسال پیام داخل یک چت - با Rate Limiting ━━━━━━━━━━*/
// POST /api/chats/:id
router.post(
  '/:id',
  strictLimiter,               // محافظت در برابر حملات
  sendMessageLimiter,          // محدودیت ارسال پیام
  auth(),                      // هر کسی که صاحب چت باشد
  chatController.sendMessage   // ← متدِ sendMessage داخل کنترلر
);



/*━━━━━━━━━━ ۱۲) پاسخ کاربر به چت ━━━━━━━━━━*/
// POST /api/chats/:id/user-reply
router.post('/:id/user-reply',
  auth('user'),                              // فقط کاربر لاگین‌شده
  chatController.userReplyToChat            // باید در کنترلر اضافه بشه
);


module.exports = router;
