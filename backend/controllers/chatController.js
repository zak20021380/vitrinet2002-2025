


    // controllers/chatController.js
    const Chat = require('../models/chat');
    const Product  = require('../models/product');
    const mongoose = require('mongoose');
    const Seller   = require('../models/Seller'); 
const Block = require('../models/Block');
const User     = require('../models/user');   // ← مطمئن شوید این خط هست
const Admin = require('../models/admin');  // 👈 اضافه کن
const BlockedSeller = require('../models/BlockedSeller');

    /**
     * GET /api/chats?sellerId=...
     * دریافت همه‌ی چت‌ها برای یک فروشنده
     */
    // controllers/chatController.js

    // controllers/chatController.js
// GET /api/chats?sellerId=...
exports.getChatsBySeller = async (req, res) => {
  try {
    const sid = new mongoose.Types.ObjectId(req.user.id);
    const chats = await Chat.find({
      $or: [
        { sellerId: sid },
        { participants: sid }
      ]
    })
      .sort({ lastUpdated: -1 })
      .populate('participants', 'firstname lastname role')
      .populate('productId', 'title images')
      .lean();

    return res.json(chats);
  } catch (err) {
    return res.status(500).json({ error: 'خطای داخلی سرور در دریافت چت‌ها' });
  }
};











    /**
     * POST /api/chats
     * ایجاد یک چت جدید یا اضافه کردن پیام اولیه
     * body: { sellerId, customerId, productId, from, text }
     */
    // ─── controllers/chatController.js ───

    /**
     * POST /api/chats
     * ایجاد یک چت جدید یا اضافه کردن پیام اولیه
     * body: { sellerId, shopurl, customerId, productId, from, text }
     */
  // controllers/chatController.js



function getModelFromRole(role) {
  switch (role) {
    case 'user':
    case 'customer':
      return 'User';
    case 'seller':
      return 'Seller';
    case 'admin':
      return 'Admin';
    default:
      return 'User'; // پیش‌فرض
  }
}

function arraysEqual(a = [], b = []) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// controllers/chatController.js
// controllers/chatController.js
// تابع createChat
// POST /api/chats  → ایجاد چت جدید یا افزودن پیام اولیه
// تابع ارسال چت
// controllers/chatController.js
// تابع createChat
// POST /api/chats  → ایجاد چت جدید یا افزودن پیام اولیه
// controllers/chatController.js
// تابع createChat
// POST /api/chats  → ایجاد چت جدید یا افزودن پیام اولیه
// تابع ارسال چت
// controllers/chatController.js
// تابع createChat
// POST /api/chats  → ایجاد چت جدید یا افزودن پیام اولیه
// تابع ارسال چت
exports.createChat = async (req, res) => {
  try {
    let { text: rawText, productId = null, sellerId = null, shopurl = null, recipientRole } = req.body;
    console.log('Creating a new chat:', { rawText, productId, sellerId, shopurl, recipientRole });

    if (!req.user) {
      console.log('Token invalid or expired');
      return res.status(401).json({ error: 'توکن نامعتبر یا منقضی.' });
    }

    const senderId = new mongoose.Types.ObjectId(req.user.id);
    const senderRole = req.user.role;
    console.log('Sender ID:', senderId, 'Sender Role:', senderRole);

    // جلوگیری از ارسال پیام در صورت مسدودی توسط ادمین
    if (['user', 'seller'].includes(senderRole) && recipientRole === 'admin') {
      const model = senderRole === 'user' ? User : Seller;
      const doc = await model.findById(senderId).select('blockedByAdmin');
      if (doc && doc.blockedByAdmin) {
        return res
          .status(403)
          .json({ success: false, message: 'شما مسدود شده‌اید و نمی‌توانید پیامی ارسال کنید.' });
      }
    }

    let pid = null, sid = null;

    if (productId) {
      pid = new mongoose.Types.ObjectId(productId);
      const prod = await Product.findById(pid).select('sellerId');
      if (!prod) return res.status(404).json({ error: 'محصول یافت نشد.' });
      if (!prod.sellerId) return res.status(400).json({ error: 'فروشنده برای این محصول یافت نشد.' });

      let productSellerId = prod.sellerId;
      if (Array.isArray(productSellerId)) {
        if (productSellerId.length === 0) return res.status(400).json({ error: 'هیچ فروشنده‌ای برای محصول یافت نشد.' });
        productSellerId = productSellerId[0];
        console.log('Multiple sellers for product; selecting the first one:', productSellerId);
      }
      sid = new mongoose.Types.ObjectId(productSellerId);
      console.log('Found seller ID from product:', sid);
    }

    // ------------------ افزودن این بخش (بررسی shopurl) ------------------
    if (!sellerId && shopurl) {
      // دنبال فروشنده با این shopurl بگرد
      const sellerDoc = await Seller.findOne({ shopurl });
      if (!sellerDoc)
        return res.status(404).json({ error: 'فروشنده با این shopurl یافت نشد.' });
      sellerId = sellerDoc._id.toString();
    }
    // ---------------------------------------------------------------------

    if (sellerId) {
      let bodySellerId = sellerId;
      if (Array.isArray(bodySellerId)) {
        if (bodySellerId.length === 0) return res.status(400).json({ error: 'شناسه فروشنده نامعتبر.' });
        bodySellerId = bodySellerId[0];  // فقط اولین
        console.log('Multiple seller IDs in body; selecting the first one:', bodySellerId);
      } else if (typeof bodySellerId === 'string' && bodySellerId.includes(',')) {
        bodySellerId = bodySellerId.split(',')[0].trim();
        console.log('Seller ID string with commas; selecting the first one:', bodySellerId);
      }
      sid = new mongoose.Types.ObjectId(bodySellerId);

      if (productId) {
        const prod = await Product.findById(pid).select('sellerId');
        let productSellers = prod.sellerId;
        if (!Array.isArray(productSellers)) productSellers = [productSellers];
        const productSellerStrings = productSellers.map(id => id.toString());
        if (!productSellerStrings.includes(sid.toString())) {
          return res.status(400).json({ error: 'شناسه فروشنده ارسال‌شده با فروشندگان محصول مطابقت ندارد.' });
        }
      }
    }

    if (!sid) return res.status(400).json({ error: 'شناسهٔ فروشنده الزامی است.' });

    // چک اعتبار فروشنده (فقط اگر recipientRole 'seller' باشد)
    if (recipientRole === 'seller') {
      const sellerExists = await Seller.findById(sid).select('blockedUsers');
      if (!sellerExists) {
        return res.status(404).json({ error: 'فروشنده یافت نشد.' });
      }
      if (senderRole === 'user' && sellerExists.blockedUsers?.some(u => u.toString() === senderId.toString())) {
        return res.status(403).json({ error: 'شما مسدود شده‌اید' });
      }
    }

    const temp = [
      { id: senderId, role: senderRole },
      { id: sid,      role: recipientRole }
    ].sort((a, b) => a.id.toString().localeCompare(b.id.toString()));

    const participants       = temp.map(t => t.id);
    const participantsModel  = temp.map(t => getModelFromRole(t.role));
    console.log('Participants:', participants);

    // اگر فرستنده فروشنده باشد و کاربر مقابل او را مسدود کرده باشد
    if (senderRole === 'seller') {
      const uIdx = participantsModel.findIndex(m => m === 'User');
      if (uIdx !== -1) {
        const userId = participants[uIdx];
        const blocked = await BlockedSeller.findOne({ user: userId, seller: senderId });
        if (blocked) {
          return res.status(403).json({ error: 'شما توسط این کاربر مسدود شده‌اید' });
        }
      }
    }

      let chatType;
      if (pid) {
        // در صورت وجود productId چت باید از نوع "product" باشد
        chatType = 'product';
      } else if (recipientRole === 'admin') {
        chatType = 'admin-user';
        const adminDoc = await Admin.findById(sid);
        if (!adminDoc) {
          return res.status(400).json({ error: 'گیرنده ادمین نیست.' });
        }
      } else {
        chatType = 'user-seller';
      }
    console.log('Final chatType:', chatType);
    console.log('Participants model:', participantsModel);

    let chat = await Chat.findOne({
      participants: { $all: participants, $size: participants.length },
      type: chatType,
      productId: pid || null
    });
    if (!chat) {
      chat = new Chat({
        participants,
        participantsModel,
        type: chatType,
        sellerId: (chatType === 'user-seller') ? sid : null,
        productId: pid,
        messages: []
      });
      console.log('New chat created:', chat);
    }

    const text = (rawText || '').trim();
    if (text) {
      chat.messages.push({
        from: senderRole,
        text,
        date: new Date(),
        read: false,
        readByAdmin: (chatType === 'user-admin' || chatType === 'admin-user' || chatType === 'seller-admin' || chatType === 'admin') ? false : true,
        readBySeller: senderRole === 'seller'
      });
      chat.lastUpdated = Date.now();
      await chat.save();
      console.log('Chat message added:', chat);
    }

    return res.status(chat.isNew ? 201 : 200).json(chat);

  } catch (err) {
    console.error('❌ createChat error:', err);
    return res.status(500).json({ error: 'خطا در ایجاد چت.' });
  }
};


    // این متد فقط برای چت بین مدیر و کاربر است
    // این متد فقط برای چت بین مدیر و کاربر است
    // چت «کاربر ↔ مدیر» (بدون الزام پیام اولیه)
  /* ─────────────────────────  چت «کاربر ↔ مدیر»  ───────────────────────── */
  /*  ➜  chatController.js  */
/* ─────────────────────────  چت «کاربر ↔ مدیر»  ───────────────────────── */
/* POST /api/chats/createAdminUserChat */
exports.createAdminUserChat = async (req, res) => {
  try {
    const { message = 'سلام، نیاز به پشتیبانی دارم.', productId = null } = req.body;
    const content = (message || '').trim();
    if (!content) return res.status(400).json({ error: 'متن پیام الزامی است.' });
    if (!req.user) return res.status(401).json({ error: 'توکن نامعتبر یا منقضی است.' });
    if (req.user.role !== 'user')
      return res.status(403).json({ error: 'فقط کاربر مجاز به ارسال پیام به مدیر است.' });

    const userDoc = await User.findById(req.user.id).select('blockedByAdmin');
    if (userDoc && userDoc.blockedByAdmin) {
      return res
        .status(403)
        .json({ success: false, message: 'شما مسدود شده‌اید و نمی‌توانید پیامی ارسال کنید.' });
    }

    const userId = req.user.id;
    const adminDoc = await Admin.findOne().select('_id');
    if (!adminDoc) return res.status(500).json({ error: 'ادمین در سیستم تعریف نشده است.' });

    const adminId = adminDoc._id.toString();

    const participants = [userId, adminId].sort();
    const participantsModel = participants.map(id =>
      id === userId ? 'User' : 'Admin'
    );

    const finder = {
      participants: { $all: participants, $size: 2 },
      type: 'admin-user',
      productId: productId || null
    };

    let chat = await Chat.findOne(finder);
    if (!chat) {
      chat = new Chat({
        participants,
        participantsModel,
        type: 'admin-user',
        productId: productId || null,
        messages: []
      });
    }

    chat.messages.push({
      from: 'user',
      text: content,
      date: new Date(),
      read: false,
      readByAdmin: false,
      readBySeller: true
    });
    chat.lastUpdated = Date.now();
    await chat.save();

    return res.status(chat.isNew ? 201 : 200).json(chat);

  } catch (err) {
    console.error('❌ createAdminUserChat error:', err);
    return res.status(500).json({ error: 'خطا در ایجاد یا به‌روزرسانی چت.' });
  }
};








    /* ------------------------------------------------------------------
      ایجاد یا برگرداندن چت موجود بین کاربر فعلی و گیرندهٔ انتخابی
      POST  /api/chats/ensure
      body: { recipientId, recipientRole: 'seller'|'admin', productId }
    -------------------------------------------------------------------*/
/* ------------------------------------------------------------------
   ایجاد یا برگرداندن چت موجود بین کاربر فعلی و گیرندهٔ انتخابی
   POST /api/chats/ensure
   body: { recipientId, recipientRole: 'user' | 'seller' | 'admin', productId? }
-------------------------------------------------------------------*/
/* ------------------------------------------------------------------
   ایجاد یا برگرداندن چت موجود بین کاربر فعلی و گیرندهٔ انتخابی
   POST /api/chats/ensure
   body: { recipientId, recipientRole, productId? }
-------------------------------------------------------------------*/
// POST /api/chats/ensure  → ایجاد یا برگرداندن چت بین دو نقش
exports.ensureChat = async (req, res) => {
  try {
    let { recipientId, recipientRole, productId = null } = req.body;
    if (recipientRole === 'admin' && !recipientId) {
      const adminDoc = await Admin.findOne().select('_id');
      if (!adminDoc)
        return res.status(500).json({ error: 'ادمین یافت نشد' });
      recipientId = adminDoc._id.toString();
    }
    console.log('Ensuring chat between:', { recipientId, recipientRole, productId });

    const myId = req.user.id;
    const myRole = req.user.role;
    console.log('My ID:', myId, 'My Role:', myRole);

    if (!recipientId || !recipientRole) {
      return res.status(400).json({ error: 'recipientId و recipientRole الزامی است.' });
    }

    // مرتب‌سازی شناسه‌ها همراه با نقش هر کدام
    const sorted = [
      { id: myId, role: myRole },
      { id: recipientId, role: recipientRole }
    ].sort((a, b) => a.id.localeCompare(b.id));

    const participants = sorted.map(i => new mongoose.Types.ObjectId(i.id));
    const participantsModel = sorted.map(i => getModelFromRole(i.role));
    console.log('Participants:', participants);
    console.log('Participants Model:', participantsModel);

    let chatType;
    if (productId) {
      chatType = 'product'; // چت مرتبط با یک محصول
    } else {
      const roles = new Set([myRole, recipientRole]);
      if (roles.has('user') && roles.has('seller')) chatType = 'user-seller';
      else if (roles.has('user') && roles.has('admin')) chatType = 'admin-user';
      else if (roles.has('seller') && roles.has('admin')) chatType = 'seller-admin';
      else chatType = 'general'; // چت عمومی
    }
    console.log('Chat Type:', chatType);

    const finder = {
      participants: { $all: participants, $size: participants.length },
      productId: productId || null,
      type: chatType
    };
    let chat = await Chat.findOne(finder);
    if (!chat) {
      chat = await Chat.create({
        participants,
        participantsModel,
        type: chatType,
        productId,
        sellerId: chatType.includes('seller')
          ? participants[sorted.findIndex(i => i.role === 'seller')] || null
          : null,
        messages: []
      });
      console.log('New chat created:', chat);
    } else {
      // در صورت ناهماهنگی اطلاعات، اصلاح کن
      let updated = false;
      if (chat.type !== chatType) { chat.type = chatType; updated = true; }
      if (chat.productId?.toString() !== (productId ? String(productId) : null)) {
        chat.productId = productId;
        updated = true;
      }
      if (chat.participants.length !== participants.length ||
          chat.participants.some((p, idx) => p.toString() !== participants[idx].toString())) {
        chat.participants = participants;
        updated = true;
      }
      if (!arraysEqual(chat.participantsModel, participantsModel)) {
        chat.participantsModel = participantsModel;
        updated = true;
      }
      if (updated) {
        chat.sellerId = chatType.includes('seller')
          ? participants[sorted.findIndex(i => i.role === 'seller')] || null
          : null;
        await chat.save();
        console.log('Chat updated to match roles');
      }
    }

    return res.json(chat);

  } catch (err) {
    console.error('ensureChat ➜', err);
    return res.status(500).json({ error: 'خطا در ایجاد / دریافت چت' });
  }
};






    /* ------------------------------------------------------------------
      لیست تمام چت‌های کاربر جاری
      GET  /api/chats/my
    -------------------------------------------------------------------*/
exports.getMyChats = async (req, res) => {
  try {
    const myId = new mongoose.Types.ObjectId(req.user.id);

    // کل چت‌هایی که کاربر عضوشه رو بیار و همه شرکت‌کننده‌ها رو populate کن
    const chats = await Chat.find({ participants: myId })
      .populate('participants', 'firstname lastname role username storename shopurl')
      .populate('productId', 'title images')
      .sort({ lastUpdated: -1 })
      .lean();

    chats.forEach(chat => {
      if (Array.isArray(chat.participants)) {
        // دقیقاً کسی که من نیستم (یعنی طرف مقابلم)
        const other = chat.participants.find(p =>
          p && p._id && p._id.toString() !== myId.toString()
        );
        if (other) {
          // اگه فروشنده باشه، اسم فروشگاهش رو هم بزار
          chat.otherParticipant = {
            _id: other._id,
            firstname: other.firstname || '',
            lastname: other.lastname || '',
            username: other.username || '',
            role: other.role || '',
            storename: other.storename || '',
            shopurl: other.shopurl || '',
          };
        } else {
          // اگه فقط یه نفر تو participants باشه (اشتباه!) 
          chat.otherParticipant = null;
        }
      } else {
        chat.otherParticipant = null;
      }
    });

    res.json(chats);
  } catch (err) {
    console.error('getMyChats ➜', err);
    res.status(500).json({ error: 'خطا در دریافت چت‌ها' });
  }
};

    /* ------------------------------------------------------------------
      ارسال پیام عمومی داخل یک چت (برای هر نقش)
      POST /api/chats/:id               body:{ text }
    -------------------------------------------------------------------*/
// controllers/chatController.js
// تابع ارسال پیام
// POST /api/chats/:id  → ارسال پیام عمومی
exports.sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const senderId = new mongoose.Types.ObjectId(req.user.id);
    const senderRole = req.user.role;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'متن پیام الزامی است.' });
    }

    const chat = await Chat.findById(id);
    if (!chat) {
      return res.status(404).json({ error: 'چت پیدا نشد.' });
    }

    if (!chat.participants.some(p => p.equals(senderId))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز به این چت.' });
    }

    // چک مسدودی در صورتی که طرف مقابل ادمین باشد
    if (chat.participantsModel?.includes('Admin') && ['user','seller'].includes(senderRole)) {
      const model = senderRole === 'user' ? User : Seller;
      const doc = await model.findById(senderId).select('blockedByAdmin');
      if (doc && doc.blockedByAdmin) {
        return res
          .status(403)
          .json({ success: false, message: 'شما مسدود شده‌اید و نمی‌توانید پیامی ارسال کنید.' });
      }
    }

    // اگر فرستنده کاربر باشد و توسط فروشنده مسدود شده باشد
    if (senderRole === 'user') {
      const idx = chat.participantsModel.findIndex(m => m === 'Seller');
      if (idx !== -1) {
        const sellerId = chat.participants[idx];
        const sellerDoc = await Seller.findById(sellerId).select('blockedUsers');
        if (sellerDoc && sellerDoc.blockedUsers?.some(u => u.toString() === senderId.toString())) {
          return res.status(403).json({ error: 'شما مسدود شده‌اید' });
        }
      }
    }

    // اگر فرستنده فروشنده باشد و کاربر او را مسدود کرده باشد، اجازه ارسال ندارد
    if (senderRole === 'seller') {
      const idx = chat.participantsModel.findIndex(m => m === 'User');
      if (idx !== -1) {
        const userId = chat.participants[idx];
        const blocked = await BlockedSeller.findOne({ user: userId, seller: senderId });
        if (blocked) {
          return res.status(403).json({ error: 'شما توسط این کاربر مسدود شده‌اید' });
        }
      }
    }

    // در صورتی که چت نوع "seller-admin" باشد، پیام را از فروشنده به ادمین ارسال کنید.
    const readByAdmin = ['seller-admin', 'user-admin', 'admin-user', 'admin'].includes(chat.type) ? false : true;
    const readBySeller = senderRole === 'seller';

    chat.messages.push({
      from: senderRole,
      text: text.trim(),
      date: new Date(),
      read: false,
      readByAdmin,
      readBySeller
    });
    chat.lastUpdated = Date.now();
    await chat.save();

    return res.json({ success: true });

  } catch (err) {
    console.error('sendMessage ➜', err);
    return res.status(500).json({ error: 'خطا در ارسال پیام.' });
  }
};



// chatController.js - اضافه کردن متد جدید
// controllers/chatController.js

/**
 * GET /api/chats/:id
 * دریافت جزئیات یک چت
 */
// controllers/chatController.js

exports.getChatById = async (req, res) => {
  try {
    // 🔍 لاگ ورودی‌
    console.log('🔍 getChatById', {
      url: req.originalUrl,
      paramId: req.params.id,
      userRole: req.user?.role,
      userId:  req.user?.id
    });

    // ۱) حذف فضاهای اضافی و اعتبارسنجی ObjectId
    const rawId = (req.params.id || '').trim();
    if (!mongoose.Types.ObjectId.isValid(rawId)) {
      console.warn('🚫 Invalid chat id ->', rawId);
      return res.status(400).json({ error: 'شناسه چت نامعتبر است' });
    }

    // ۲) واکشی چت بدون populate برای اعتبارسنجی
    let chat = await Chat.findById(rawId);
    if (!chat) {
      console.warn('❓ Chat not found ->', rawId);
      return res.status(404).json({ error: 'چت پیدا نشد' });
    }

    // ۳) اگر نقش کاربر admin نیست، باید عضو چت باشد
    if (req.user.role !== 'admin') {
      const userId = req.user.id;
      const isParticipant = chat.participants.some(p => p.toString() === userId);
      if (!isParticipant) {
        console.warn('🚫 Unauthorized access attempt', { chatId: rawId, requester: userId });
        return res.status(403).json({ error: 'دسترسی غیرمجاز' });
      }
    }

    // ۴) پرکردن جزییات
    await chat.populate('participants', 'firstname lastname role storename shopurl');
    await chat.populate('productId', 'title images');

    // ----- mark received messages as read -----
    const role = req.user.role;
    const update = {};
    const arrayFilters = [];
    if (role === 'seller') {
      update['messages.$[m].readBySeller'] = true;
      update['messages.$[m].read'] = true;
      arrayFilters.push({ 'm.from': { $ne: 'seller' }, 'm.readBySeller': false });
    } else if (role === 'user') {
      update['messages.$[m].read'] = true;
      arrayFilters.push({ 'm.from': { $ne: 'user' }, 'm.read': false });
    }

    if (arrayFilters.length) {
      await Chat.updateOne({ _id: rawId }, { $set: update }, { arrayFilters });
      chat = await Chat.findById(rawId)
        .populate('participants', 'firstname lastname role storename shopurl')
        .populate('productId', 'title images');
    }

    // ۵) ارسال نتیجه
    return res.json(chat);

  } catch (err) {
    console.error('getChatById ➜', err);
    return res.status(500).json({ error: 'خطا در دریافت چت' });
  }
};


// POST /api/chats/:id/reply  → پاسخ فروشنده (فقط در user-seller یا seller-admin)
// controllers/chatController.js

exports.replyToChat = async (req, res) => {
  const { id }   = req.params;
  const { text } = req.body;

  // ۱. ولیدیشن
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'متن پیام الزامی است.' });
  }

  try {
    // ۲. واکشی چت
    const chat = await Chat.findById(id);
    if (!chat) {
      return res.status(404).json({ error: 'چت پیدا نشد.' });
    }

  // ۳. فقط فروشنده‌ی عضو این چت می‌تواند پاسخ بدهد
  if (!req.user || req.user.role !== 'seller') {
    return res.status(403).json({ error: 'دسترسی غیرمجاز.' });
  }

  const senderId = req.user.id;

  // چک کنید که این فروشنده داخل چت شرکت‌کننده است
  const isParticipant = chat.participants.some(p => p.toString() === senderId);
  if (!isParticipant) {
    return res.status(403).json({ error: 'دسترسی غیرمجاز.' });
  }

  // در صورت وجود فیلد sellerId باید با شناسهٔ فرستنده مطابقت داشته باشد
  if (chat.sellerId && chat.sellerId.toString() !== senderId) {
    return res.status(403).json({ error: 'دسترسی غیرمجاز.' });
  }

    // ۴. اگر کاربر این فروشنده را مسدود کرده باشد، اجازه ارسال ندارد
    const uIdx = chat.participantsModel.findIndex(m => m === 'User');
    if (uIdx !== -1) {
      const userId = chat.participants[uIdx];
      const blocked = await BlockedSeller.findOne({ user: userId, seller: req.user.id });
      if (blocked) {
        return res.status(403).json({ error: 'شما توسط این کاربر مسدود شده‌اید' });
      }
    }

    // ۵. درج پیام از طرف فروشنده
    chat.messages.push({
      from: 'seller',
      text: text.trim(),
      date: new Date(),
      read: false,
      // اگر چت با ادمین باشد (seller-admin)، admin هنوز پیام را نخوانده
      readByAdmin: ['seller-admin', 'user-admin', 'admin-user', 'admin'].includes(chat.type) ? false : true,
      readBySeller: true
    });
    // ۶. به‌روزرسانی timestamp
    chat.lastUpdated = Date.now();

    // ۷. ذخیره در دیتابیس
    await chat.save();

    // ۸. برگرداندن چت کامل
    return res.json(chat);
  } catch (err) {
    console.error('❌ replyToChat error:', err);
    return res.status(500).json({ error: 'خطا در ارسال پاسخ فروشنده.' });
  }
};





    /**
     * POST /api/chats/:id/admin-reply
     * اضافه کردن پیام از طرف مدیر سایت
     * params: id = chatId
     * body: { text }
     */
  // controllers/chatController.js
// POST /api/chats/:id/admin-reply  → پاسخ مدیر (فقط در چت‌های admin)
exports.adminReplyToChat = async (req, res) => {
  const { id }   = req.params;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'متن پیام الزامی است.' });
  }
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'دسترسی غیرمجاز.' });
  }

  try {
    const chat = await Chat.findById(id);
    if (!chat) return res.status(404).json({ error: 'چت پیدا نشد.' });

    const adminId = req.user.id;
    if (!chat.participants.some(p => p.toString() === adminId)) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز.' });
    }

    if (!['user-admin', 'admin-user', 'seller-admin', 'admin'].includes(chat.type)) {
      const idx = chat.participants.findIndex(p => p.toString() !== adminId);
      const otherModel = chat.participantsModel?.[idx];
      if (otherModel === 'User') chat.type = 'admin-user';
      else if (otherModel === 'Seller') chat.type = 'seller-admin';
    }

    chat.messages.push({
      from: 'admin',
      text: text.trim(),
      date: new Date(),
      read: false,
      readByAdmin: true,
      readBySeller: chat.type === 'seller-admin'
    });
    chat.lastUpdated = Date.now();
    await chat.save();

    return res.json(chat);

  } catch (err) {
    console.error('❌ adminReplyToChat error:', err);
    return res.status(500).json({ error: 'خطا در ارسال پیام مدیر.' });
  }
};


    // حذف کامل یک چت با آیدی
    exports.deleteChat = async (req, res) => {
      try {
        const { id } = req.params;
        const result = await Chat.findByIdAndDelete(id);
        if (!result) {
          return res.status(404).json({ error: 'چت پیدا نشد' });
        }
        res.json({ success: true });
      } catch (err) {
        console.error('❌ deleteChat error:', err);
        res.status(500).json({ error: 'خطا در حذف چت' });
      }
    };



function capitalizeFirstLetter(str = '') {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

/**
 * GET /api/chats/all
 * دریافت همهٔ چت‌ها برای پنل ادمین
 */
exports.getAllChats = async (req, res) => {
  try {
    // فقط ادمین
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'دسترسی غیرمجاز. فقط ادمین مجاز است.' });
    }

    // (اختیاری) اعتبارسنجی id ادمین
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      return res.status(400).json({ error: 'شناسه ادمین نامعتبر است.' });
    }

    const adminId = new mongoose.Types.ObjectId(req.user.id);

    // واکشی فقط چت‌هایی که ادمین در آن‌ها شرکت‌کننده است
    const chats = await Chat.find({ participants: adminId })
      .sort({ lastUpdated: -1 })
      .populate('participants', 'firstname lastname role storename shopurl username blockedByAdmin')
      .populate('productId', 'title images mainImageIndex')
      .lean();

    // ساخت عنوان نمایشی برای هر چت
    chats.forEach(chat => {
      const parts = (chat.participants || []).map(p => {
        const name =
          p.storename ||
          `${p.firstname || ''} ${p.lastname || ''}`.trim() ||
          p.username   ||
          'نامشخص';
        return `${capitalizeFirstLetter(p.role || '')}: ${name}`;
      });
      chat.customTitle = parts.join(' ↔ ') || 'چت نامشخص';
      if (chat.productId?.title) {
        chat.customTitle += ` - محصول: ${chat.productId.title}`;
      }

      const idx = (chat.participants || []).findIndex(p => p.role !== 'admin');
      chat.blockedByAdmin = idx !== -1 ? !!chat.participants[idx].blockedByAdmin : false;
    });

    return res.json(chats);
  } catch (err) {
    console.error('getAllChats ➜', err);
    return res.status(500).json({ error: 'خطای داخلی سرور در دریافت چت‌ها' });
  }
};

// ... (بقیه توابع بدون تغییر)



    // علامت‌گذاری پیام‌های فروشنده به عنوان «خوانده توسط ادمین»
    // ✔ خوانده‌شدن پیام‌های فروشنده توسط ادمین
    exports.markMessagesRead = async (req, res) => {
      try {
        const chatId = req.params.id;              // /chats/:id/mark-read
        let { messageIds = [] } = req.body;        // آرایه‌ی id پیام‌ها

        if (!messageIds.length)
          return res.status(400).json({ error: 'هیچ پیامى ارسال نشده است.' });

        // 👇 رشته‌ها را به ObjectId تبدیل کن
        messageIds = messageIds.map(id => new mongoose.Types.ObjectId(id));

        await Chat.updateOne(
          { _id: chatId },
          { $set: { "messages.$[m].readByAdmin": true, "messages.$[m].read": true } },
          { arrayFilters: [{ "m._id": { $in: messageIds } }] }
        );

        const updatedChat = await Chat.findById(chatId);
        return res.json(updatedChat);
      } catch (err) {
        console.error('markMessagesRead error:', err);
        res.status(500).json({ error: 'خطاى سرور در علامت‌گذاری پیام‌ها.' });
      }
    };


    // ارسال پیام همگانی از طرف ادمین
    // POST /api/chats/broadcast
    // body: { target: 'sellers' | 'customers', text: '...' }
  // controllers/chatController.js

exports.broadcastMessage = async (req, res) => {
  try {
    const { target, text } = req.body;
    if (!['sellers', 'customers'].includes(target) || !text) {
      return res.status(400).json({ error: 'پارامترها ناقص یا نامعتبرند.' });
    }

    // پیدا کردن آیدی ادمین
    const adminDoc = await Admin.findOne().select('_id');
    if (!adminDoc) {
      return res.status(500).json({ error: 'ادمین وجود ندارد.' });
    }
    const adminId = adminDoc._id;

    // لیست دریافت‌کننده‌ها
    const recipients = target === 'sellers'
      ? await Seller.find({}, '_id')
      : await User.find({}, '_id');

    let count = 0;
    for (let r of recipients) {
      // ترتیب شرکت‌کننده‌ها
      const participants = [r._id, adminId].sort((a, b) =>
        a.toString().localeCompare(b.toString())
      );
      const participantsModel = target === 'sellers'
        ? ['Seller', 'Admin'].sort()
        : ['User', 'Admin'].sort();

      // نوع چت را بر اساس target تنظیم کنید
        const chatType = target === 'sellers' ? 'seller-admin' : 'admin-user';

      // تلاش برای پیدا کردن چت موجود با فیلتر نوع و productId
      let chat = await Chat.findOne({
        participants: { $all: participants, $size: 2 },
        productId: null,
        type: chatType
      });

      if (!chat) {
        // اگر نبود، بساز
        chat = new Chat({
          participants,
          participantsModel,
          type: chatType,
          productId: null,
          sellerId: target === 'sellers' ? r._id : null,
          messages: []
        });
      } else {
        // اگر موجود بود ولی type نداشت، حتما ستش کن
        chat.type = chatType;
      }

      // افزودن پیام
      chat.messages.push({
        from: 'admin',
        text,
        date: new Date(),
        read: false,
        readByAdmin: true,
        readBySeller: target === 'sellers' ? false : false  // برای customers هم false ست کنید تا سازگار باشد
      });
      chat.lastUpdated = Date.now();

      await chat.save();
      count++;
    }

    return res.json({ success: true, sent: count });
  } catch (err) {
    console.error('❌ broadcastMessage:', err);
    return res.status(500).json({ error: 'خطا در ارسال پیام همگانی.' });
  }
};



/**
 * POST /api/chats/:id/block
 * مسدودسازی یا رفع مسدودی طرف گفتگو توسط ادمین
 */
exports.blockSender = async (req, res) => {
  try {
    const { unblock = false } = req.body || {};
    const chat = await Chat.findById(req.params.id).lean();
    if (!chat) return res.status(404).json({ error: 'چت پیدا نشد' });

    // یافتن شرکت‌کننده‌ای که ادمین نیست
    const idx = (chat.participantsModel || []).findIndex(m => m !== 'Admin');
    if (idx === -1) return res.status(400).json({ error: 'شرکت‌کننده‌ای برای مسدودسازی یافت نشد' });
    const participantId = chat.participants[idx];
    const model = chat.participantsModel[idx];

    if (model === 'User') {
      await User.findByIdAndUpdate(participantId, { blockedByAdmin: !unblock });
    } else if (model === 'Seller') {
      await Seller.findByIdAndUpdate(participantId, { blockedByAdmin: !unblock });
    } else {
      return res.status(400).json({ error: 'امکان مسدودسازی این نقش نیست' });
    }

    return res.json({ success: true, blocked: !unblock });
  } catch (err) {
    console.error('❌ blockSender error:', err);
    return res.status(500).json({ error: 'خطا در مسدودسازی فرستنده' });
  }
};

/**
 * POST /api/chats/block-target
 * مسدودسازی کاربر یا فروشنده توسط ادمین بر اساس نقش
 * body: { targetId, targetRole }
 */
exports.blockTarget = async (req, res) => {
  try {
    const { targetId, targetRole } = req.body || {};

    if (!targetId || !targetRole)
      return res.status(400).json({ error: 'اطلاعات ناقص ارسال شده است.' });

    console.log('🛑 blockTarget payload', { targetId, targetRole });

    const model = targetRole === 'user' ? User : Seller;
    const target = await model.findById(targetId);
    if (!target)
      return res.status(404).json({ message: 'شناسه یافت نشد' });

    target.blockedByAdmin = true;
    await target.save();

    console.log(`🔒 Blocked ${targetRole}: ${targetId}`);

    return res.json({ success: true, message: 'کاربر با موفقیت مسدود شد.' });
  } catch (err) {
    console.error('❌ blockTarget error:', err);
    return res.status(500).json({ error: 'خطا در مسدودسازی' });
  }
};

/**
 * POST /api/chats/unblock-target
 * رفع مسدودی کاربر یا فروشنده توسط ادمین بر اساس نقش
 * body: { targetId, targetRole }
 */
exports.unblockTarget = async (req, res) => {
  try {
    const { targetId, targetRole } = req.body || {};

    if (!targetId || !targetRole)
      return res.status(400).json({ error: 'اطلاعات ناقص ارسال شده است.' });

    console.log('🟢 unblockTarget payload', { targetId, targetRole });

    const model = targetRole === 'user' ? User : Seller;
    const target = await model.findById(targetId);
    if (!target)
      return res.status(404).json({ message: 'شناسه یافت نشد' });

    target.blockedByAdmin = false;
    await target.save();

    console.log(`🔓 Unblocked ${targetRole}: ${targetId}`);

    return res.json({ success: true, message: 'کاربر با موفقیت آزاد شد.' });
  } catch (err) {
    console.error('❌ unblockTarget error:', err);
    return res.status(500).json({ error: 'خطا در رفع مسدودی' });
  }
};



    /**
     * ارسال پیام از طرف فروشنده به مدیر
     */
// controllers/chatController.js
// POST /api/chats/contact-admin  → پیام فروشنده به مدیر (چت seller-admin)
// POST /api/chats/contact-admin  → پیام فروشنده به مدیر (چت seller-admin)
// controllers/chatController.js

exports.contactAdmin = async (req, res) => {
  try {
    const { text, message } = req.body;
    const content = (text || message || '').trim();
  if (!content)
      return res.status(400).json({ error: 'متن پیام اجباری است.' });
  if (!req.user || req.user.role !== 'seller')
      return res.status(403).json({ error: 'فقط فروشنده مجاز است.' });

  const sellerDoc = await Seller.findById(req.user.id).select('blockedByAdmin');
  if (sellerDoc && sellerDoc.blockedByAdmin) {
    return res
      .status(403)
      .json({ success: false, message: 'شما مسدود شده‌اید و نمی‌توانید پیامی ارسال کنید.' });
  }

    const sellerId = req.user.id;

    // ———————————— اضافه: پیدا کردن adminId ————————————
    const adminDoc = await Admin.findOne().select('_id');
    if (!adminDoc) 
      return res.status(500).json({ error: 'ادمین در سیستم تعریف نشده است.' });
    const adminId = adminDoc._id.toString();

    // ———————— جستجو یا ایجاد چت seller-admin ————————
    let chat = await Chat.findOne({
      participants: { $all: [sellerId, adminId], $size: 2 },
      type: 'seller-admin'
    });
    if (!chat) {
      chat = new Chat({
        participants: [sellerId, adminId],
        participantsModel: ['Seller', 'Admin'],
        sellerId,
        type: 'seller-admin',
        messages: []
      });
    }

    // ————————— افزودن پیام فروشنده —————————
    chat.messages.push({
      from: 'seller',
      text: content,
      date: new Date(),
      read: false,
      readByAdmin: false,
      readBySeller: true
    });
    chat.lastUpdated = Date.now();
    await chat.save();

    return res.json({ success: true, chat });
  } catch (err) {
    console.error('❌ contactAdmin error:', err);
    return res.status(500).json({ error: 'خطا در ارسال پیام به مدیر.' });
  }
};



exports.getUnreadCount = async (req, res) => {
  try {
    const myId = new mongoose.Types.ObjectId(req.user.id);
    const myRole = req.user.role;
    const chats = await Chat.find({ participants: myId });

    let count = 0;
    chats.forEach(ch => {
      count += (ch.messages || []).filter(m => m.from !== myRole && !m.read).length;
    });

    return res.json({ success: true, count });
  } catch (err) {
    console.error('Error in getUnreadCount:', err);
    return res.status(500).json({ success: false, message: 'خطای سرور' });
  }
};

    /**
     * POST /api/chats/markAllRead
     * علامت‌گذاری همهٔ پیام‌های «ادمین→فروشنده» به عنوان خوانده‌شده توسط فروشنده
     * body: { sellerId }
     */
    /**
     * POST /api/chats/markAllRead
     * علامت‌گذاری همهٔ پیام‌های «ادمین→فروشنده» به عنوان خوانده‌شده توسط فروشنده
     * body: { sellerId }
     */
    exports.markAllRead = async (req, res) => {
      try {
        const sellerId = req.body.sellerId;
        if (!sellerId) {
          return res.status(400).json({ error: 'sellerId الزامی است.' });
        }

        // برای هر چتِ این فروشنده، همهٔ پیام‌های admin را خوانده‌شده می‌کنیم
        await Chat.updateMany(
          { sellerId },
          { $set: { 'messages.$[m].readBySeller': true, 'messages.$[m].read': true } },
          {
            // فقط فیلد from را چک می‌کنیم، بدون شرط روی readBySeller
            arrayFilters: [{ 'm.from': 'admin' }]
          }
        );

        return res.json({ success: true });
      } catch (err) {
        console.error('❌ markAllRead error:', err);
        return res
          .status(500)
          .json({ error: 'خطا در علامت‌گذاری پیام‌ها به عنوان خوانده‌شده.' });
      }
    };


    /**
   * POST /api/chats/:id/user-reply
   * اضافه کردن پیام از طرف کاربر (مشتری)
   */
// controllers/chatController.js
// controllers/chatController.js
// controllers/chatController.js

// controllers/chatController.js

exports.userReplyToChat = async (req, res) => {
  const { id }   = req.params;   // chatId
  const { text } = req.body;     // متن پیام

  // ۱. ولیدیشن ورودی
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'متن پیام الزامی است.' });
  }

  try {
    // ۲. واکشی چت
    const chat = await Chat.findById(id);
    if (!chat) {
      return res.status(404).json({ error: 'چت پیدا نشد.' });
    }

    // ۳. بررسی دسترسی: فقط کاربری که عضو این چت است
  if (!chat.participants.some(p => p.toString() === req.user.id)) {
    return res.status(403).json({ error: 'دسترسی غیرمجاز به این چت.' });
  }

  // اگر طرف مقابل ادمین است، بررسی مسدودی
  if (chat.participantsModel?.includes('Admin')) {
    const userDoc = await User.findById(req.user.id).select('blockedByAdmin');
    if (userDoc && userDoc.blockedByAdmin) {
      return res
        .status(403)
        .json({ success: false, message: 'شما مسدود شده‌اید و نمی‌توانید پیامی ارسال کنید.' });
    }
  }

  // اگر فروشنده این کاربر را مسدود کرده باشد
  const idx = chat.participantsModel.findIndex(m => m === 'Seller');
  if (idx !== -1) {
    const sellerId = chat.participants[idx];
    const sellerDoc = await Seller.findById(sellerId).select('blockedUsers');
    if (sellerDoc && sellerDoc.blockedUsers?.some(u => u.toString() === req.user.id)) {
      return res.status(403).json({ error: 'شما مسدود شده‌اید' });
    }
  }

    // ۴. تعیین وضعیت خوانده‌شدن برای ادمین
    // اگر چت با ادمین باشد (user-admin یا seller-admin)، readByAdmin=false
    // در غیر این صورت (مثلاً user-seller)، readByAdmin=true
      const readByAdmin = !['user-admin', 'admin-user', 'seller-admin', 'admin'].includes(chat.type);

    // ۵. درج پیام
    chat.messages.push({
      from: 'user',
      text: text.trim(),
      date: new Date(),
      read: false,
      readByAdmin,
      readBySeller: false
    });

    // ۶. به‌روز کردن زمان آخرین پیام
    chat.lastUpdated = Date.now();

    // ۷. ذخیره در دیتابیس
    await chat.save();

    // ۸. برگرداندن چت جدید
    return res.json(chat);
  } catch (err) {
    console.error('❌ userReplyToChat error:', err);
    return res.status(500).json({ error: 'خطا در ارسال پیام.' });
  }
};
