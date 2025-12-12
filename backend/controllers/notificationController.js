const Notification = require('../models/notification');

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
exports.createNotification = async (userId, message) => {
  try {
    await Notification.create({ userId, message });
  } catch (err) {
    console.error('Failed to create notification', err);
  }
};
