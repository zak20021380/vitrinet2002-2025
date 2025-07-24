// routes/chatRoutes.js

const express = require('express');
const router  = express.Router();
const auth = require('../middlewares/authMiddleware');       // ← این را اضافه کنید
const chatController = require('../controllers/chatController');




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



/*━━━━━━━━━━ ۳) ایجاد چت جدید ━━━━━━━━━━*/
router.post('/',
  // اگر مشتری ایجاد می‌کنه نیازی به auth، اما اگر فروشنده یا admin هست:
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
  auth('seller'),
  chatController.markMessagesRead
);

/*━━━━━━━━━━ ۷) حذف چت ━━━━━━━━━━*/
router.delete('/:id',
  auth('seller'),
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

// اجازه می‌دهیم فروشنده با مدیر چت جدیدی باز کند
router.post(
  '/contact-admin',
  auth('seller'),           // فقط فروشنده‌ی لاگین‌کرده می‌تواند پیام بفرستد
  chatController.contactAdmin
);



// ۱۰) تعداد پیام‌های نخوانده
router.get(
  '/unreadCount',
  auth('seller'),              // فقط فروشنده‌ی لاگین‌شده
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

/*━━━━━━━━━━ ارسال پیام داخل یک چت ━━━━━━━━━━*/
// POST /api/chats/:id
router.post(
  '/:id',
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
