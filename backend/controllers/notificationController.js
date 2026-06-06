const Notification = require('../models/notification');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/user');

const ADMIN_NOTIFICATION_LIMIT_DEFAULT = 40;
const ADMIN_NOTIFICATION_LIMIT_MAX = 100;

function normalizeLimit(value, fallback = ADMIN_NOTIFICATION_LIMIT_DEFAULT) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), ADMIN_NOTIFICATION_LIMIT_MAX);
}

function normalizePage(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

function normalizePriority(value) {
  const priority = String(value || 'normal').trim().toLowerCase();
  return ['low', 'normal', 'high', 'critical'].includes(priority) ? priority : 'normal';
}

function formatAdminNotification(doc) {
  const source = typeof doc?.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: source?._id ? String(source._id) : '',
    type: source?.type || 'system',
    title: source?.title || '',
    message: source?.message || '',
    createdAt: source?.createdAt || null,
    readAt: source?.readAt || null,
    priority: normalizePriority(source?.priority),
    targetRoute: source?.targetRoute || '',
    targetId: source?.targetId || '',
    metadata: source?.metadata && typeof source.metadata === 'object' ? source.metadata : {}
  };
}

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
      { read: true, readAt: new Date() },
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
exports.listAdminNotifications = async (req, res) => {
  try {
    const page = normalizePage(req.query?.page);
    const limit = normalizeLimit(req.query?.limit);
    const skip = (page - 1) * limit;
    const unreadOnly = ['1', 'true', 'yes'].includes(String(req.query?.unread || req.query?.unreadOnly || '').toLowerCase());

    const query = { recipientRole: 'admin' };
    if (unreadOnly) {
      query.read = { $ne: true };
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipientRole: 'admin', read: { $ne: true } })
    ]);

    res.json({
      success: true,
      notifications: notifications.map(formatAdminNotification),
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (err) {
    console.error('listAdminNotifications error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.markAdminNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientRole: 'admin' },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const unreadCount = await Notification.countDocuments({ recipientRole: 'admin', read: { $ne: true } });
    return res.json({
      success: true,
      notification: formatAdminNotification(notification),
      unreadCount
    });
  } catch (err) {
    console.error('markAdminNotificationAsRead error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.markAllAdminNotificationsAsRead = async (_req, res) => {
  try {
    const now = new Date();
    const result = await Notification.updateMany(
      { recipientRole: 'admin', read: { $ne: true } },
      { read: true, readAt: now }
    );

    return res.json({
      success: true,
      modifiedCount: result.modifiedCount || result.nModified || 0,
      unreadCount: 0
    });
  } catch (err) {
    console.error('markAllAdminNotificationsAsRead error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.clearReadAdminNotifications = async (_req, res) => {
  try {
    const result = await Notification.deleteMany({
      recipientRole: 'admin',
      $or: [
        { read: true },
        { readAt: { $ne: null } }
      ]
    });
    const unreadCount = await Notification.countDocuments({ recipientRole: 'admin', read: { $ne: true } });

    return res.json({
      success: true,
      deletedCount: result.deletedCount || 0,
      unreadCount
    });
  } catch (err) {
    console.error('clearReadAdminNotifications error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.removeAdminNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Notification.findOneAndDelete({ _id: id, recipientRole: 'admin' });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const unreadCount = await Notification.countDocuments({ recipientRole: 'admin', read: { $ne: true } });
    return res.json({
      success: true,
      deletedId: String(deleted._id),
      unreadCount
    });
  } catch (err) {
    console.error('removeAdminNotification error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createNotification = async (userId, message, options = {}) => {
  try {
    const payload = { recipientRole: 'user', userId, message };
    ['title', 'type', 'relatedTicketId', 'priority', 'targetRoute', 'targetId', 'metadata'].forEach((key) => {
      if (options[key]) payload[key] = options[key];
    });
    await Notification.create(payload);
  } catch (err) {
    console.error('Failed to create notification', err);
  }
};

exports.createAdminNotification = async (options = {}) => {
  try {
    const title = String(options.title || '').trim();
    const message = String(options.message || '').trim();
    if (!title || !message) return null;

    const notification = await Notification.create({
      recipientRole: 'admin',
      type: String(options.type || 'system').trim() || 'system',
      title,
      message,
      read: false,
      readAt: null,
      priority: normalizePriority(options.priority),
      targetRoute: String(options.targetRoute || '').trim(),
      targetId: options.targetId ? String(options.targetId).trim() : '',
      metadata: options.metadata && typeof options.metadata === 'object' ? options.metadata : {}
    });

    return formatAdminNotification(notification);
  } catch (err) {
    console.error('Failed to create admin notification', err);
    return null;
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
