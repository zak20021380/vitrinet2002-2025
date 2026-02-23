const Notification = require('../models/notification');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/user');

// لیست اعلان‌های کاربر
exports.list = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// علامت‌گذاری اعلان به‌عنوان خوانده شده
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const notif = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { read: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// حذف اعلان
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const deleted = await Notification.findOneAndDelete({ _id: id, userId });
    if (!deleted) return res.status(404).json({ message: 'Notification not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ثبت پاسخ کاربر برای اعلان‌های سیستمی (مثل تیکت)
exports.reply = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body || {};
    const userId = req.user.id;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'متن پاسخ الزامی است.' });
    }

    const notif = await Notification.findOne({ _id: id, userId });
    if (!notif) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const replyEntry = {
      message: String(message).trim(),
      senderRole: req.user?.role || 'seller',
      createdAt: new Date()
    };

    if (!Array.isArray(notif.userReplies)) {
      notif.userReplies = [];
    }

    notif.userReplies.push(replyEntry);
    await notif.save();

    if (notif.relatedTicketId) {
      const ticket = await SupportTicket.findById(notif.relatedTicketId);
      if (ticket) {
        if (!Array.isArray(ticket.sellerReplies)) {
          ticket.sellerReplies = [];
        }
        ticket.sellerReplies.push({
          message: replyEntry.message,
          sellerId: req.user?.id || null,
          createdAt: replyEntry.createdAt
        });
        ticket.lastUpdatedBy = req.user?.role || ticket.lastUpdatedBy;
        ticket.status = 'in_progress';
        await ticket.save();
      }
    }

    res.status(201).json({
      notification: notif,
      reply: replyEntry
    });
  } catch (err) {
    console.error('notification reply error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// متد کمکی برای ایجاد اعلان
exports.createNotification = async (userId, message, options = {}) => {
  try {
    const payload = { userId, message };
    ['title', 'type', 'relatedTicketId'].forEach((key) => {
      if (options[key]) payload[key] = options[key];
    });
    await Notification.create(payload);
  } catch (err) {
    console.error('Failed to create notification', err);
  }
};

// متد کمکی برای ایجاد اعلان گروهی کاربران (batch insert)
exports.createNotificationForAllUsers = async (message, options = {}) => {
  try {
    const text = String(message || '').trim();
    if (!text) return 0;

    const query = {
      role: 'user',
      deleted: { $ne: true }
    };

    if (options.userFilter && typeof options.userFilter === 'object') {
      Object.assign(query, options.userFilter);
    }

    const batchSize = 500;
    const title = options.title ? String(options.title).trim() : '';
    const type = options.type ? String(options.type).trim() : '';
    let createdCount = 0;
    let batchUserIds = [];

    const cursor = User.find(query).select('_id').lean().cursor();

    for await (const user of cursor) {
      if (!user?._id) continue;
      batchUserIds.push(user._id);

      if (batchUserIds.length < batchSize) continue;

      const now = new Date();
      const docs = batchUserIds.map((userId) => {
        const payload = {
          userId,
          message: text,
          read: false,
          createdAt: now,
          updatedAt: now
        };
        if (title) payload.title = title;
        if (type) payload.type = type;
        return payload;
      });

      await Notification.insertMany(docs, { ordered: false });
      createdCount += docs.length;
      batchUserIds = [];
    }

    if (batchUserIds.length > 0) {
      const now = new Date();
      const docs = batchUserIds.map((userId) => {
        const payload = {
          userId,
          message: text,
          read: false,
          createdAt: now,
          updatedAt: now
        };
        if (title) payload.title = title;
        if (type) payload.type = type;
        return payload;
      });
      await Notification.insertMany(docs, { ordered: false });
      createdCount += docs.length;
    }

    return createdCount;
  } catch (err) {
    console.error('Failed to create bulk user notifications', err);
    return 0;
  }
};
