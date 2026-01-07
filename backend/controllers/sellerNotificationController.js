const SellerNotification = require('../models/SellerNotification');
const mongoose = require('mongoose');

/**
 * دریافت لیست اعلان‌های فروشنده
 * GET /api/seller/notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { limit = 50, skip = 0, unreadOnly = false } = req.query;

    const query = { sellerId };
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const notifications = await SellerNotification.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    const unreadCount = await SellerNotification.countDocuments({ sellerId, read: false });

    res.json({
      notifications,
      unreadCount,
      total: await SellerNotification.countDocuments({ sellerId })
    });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: 'خطا در دریافت اعلان‌ها' });
  }
};

/**
 * دریافت تعداد اعلان‌های خوانده نشده
 * GET /api/seller/notifications/unread-count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const count = await SellerNotification.countDocuments({ sellerId, read: false });
    res.json({ count });
  } catch (err) {
    console.error('getUnreadCount error:', err);
    res.status(500).json({ error: 'خطا در دریافت تعداد اعلان‌ها' });
  }
};

/**
 * علامت‌گذاری اعلان به عنوان خوانده شده
 * PUT /api/seller/notifications/:id/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'شناسه اعلان نامعتبر است' });
    }

    const notification = await SellerNotification.findOneAndUpdate(
      { _id: id, sellerId },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'اعلان یافت نشد' });
    }

    res.json({ success: true, notification });
  } catch (err) {
    console.error('markAsRead error:', err);
    res.status(500).json({ error: 'خطا در به‌روزرسانی اعلان' });
  }
};

/**
 * علامت‌گذاری همه اعلان‌ها به عنوان خوانده شده
 * PUT /api/seller/notifications/mark-all-read
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const sellerId = req.user.id;

    await SellerNotification.updateMany(
      { sellerId, read: false },
      { read: true, readAt: new Date() }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('markAllAsRead error:', err);
    res.status(500).json({ error: 'خطا در به‌روزرسانی اعلان‌ها' });
  }
};

/**
 * حذف اعلان
 * DELETE /api/seller/notifications/:id
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'شناسه اعلان نامعتبر است' });
    }

    const deleted = await SellerNotification.findOneAndDelete({ _id: id, sellerId });

    if (!deleted) {
      return res.status(404).json({ error: 'اعلان یافت نشد' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('deleteNotification error:', err);
    res.status(500).json({ error: 'خطا در حذف اعلان' });
  }
};

/**
 * حذف همه اعلان‌ها
 * DELETE /api/seller/notifications/clear-all
 */
exports.clearAll = async (req, res) => {
  try {
    const sellerId = req.user.id;
    await SellerNotification.deleteMany({ sellerId });
    res.json({ success: true });
  } catch (err) {
    console.error('clearAll error:', err);
    res.status(500).json({ error: 'خطا در حذف اعلان‌ها' });
  }
};

/**
 * ایجاد اعلان جدید برای فروشنده (استفاده داخلی)
 */
exports.createNotification = async (sellerId, data) => {
  try {
    const notification = new SellerNotification({
      sellerId,
      type: data.type || 'info',
      title: data.title,
      message: data.message,
      relatedData: data.relatedData || {}
    });
    await notification.save();
    return notification;
  } catch (err) {
    console.error('createNotification error:', err);
    return null;
  }
};

/**
 * ایجاد اعلان پیام مشتری
 */
exports.createCustomerMessageNotification = async (sellerId, customerName, productTitle, chatId, customerId, productId) => {
  try {
    const notification = new SellerNotification({
      sellerId,
      type: 'customer_message',
      title: 'پیام جدید از مشتری',
      message: productTitle 
        ? `${customerName} درباره "${productTitle}" پیام داده است.`
        : `${customerName} به شما پیام داده است.`,
      relatedData: {
        chatId,
        customerId,
        productId,
        customerName,
        productTitle
      }
    });
    await notification.save();
    return notification;
  } catch (err) {
    console.error('createCustomerMessageNotification error:', err);
    return null;
  }
};

/**
 * ایجاد اعلان تایید تبلیغ
 * @param {ObjectId} sellerId - شناسه فروشنده
 * @param {ObjectId} adId - شناسه تبلیغ
 * @param {string} adTitle - عنوان تبلیغ
 */
exports.createAdApprovedNotification = async (sellerId, adId, adTitle) => {
  try {
    const notification = new SellerNotification({
      sellerId,
      type: 'ad_approved',
      title: 'تبلیغ شما تایید شد',
      message: 'تبلیغ شما آماده نمایش است. برای مشاهده جزئیات کلیک کنید.',
      relatedData: {
        adId,
        adTitle: adTitle || '',
        // Deep-link URL for navigation
        actionUrl: `/seller/dashboard.html#upgrade-special-ads?ad_id=${adId}&focus=my_plans`
      }
    });
    await notification.save();
    return notification;
  } catch (err) {
    console.error('createAdApprovedNotification error:', err);
    return null;
  }
};

/**
 * ایجاد اعلان تست (فقط برای تست)
 * POST /api/seller/notifications/test
 */
exports.createTestNotification = async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    const notification = new SellerNotification({
      sellerId,
      type: 'customer_message',
      title: 'پیام جدید از مشتری',
      message: 'این یک پیام تست است. مشتری درباره محصول شما سوال دارد.',
      relatedData: {
        customerName: 'مشتری تست',
        productTitle: 'محصول نمونه'
      }
    });
    
    await notification.save();
    console.log('Test notification created:', notification._id);
    
    res.json({ 
      success: true, 
      notification,
      message: 'اعلان تست با موفقیت ایجاد شد'
    });
  } catch (err) {
    console.error('createTestNotification error:', err);
    res.status(500).json({ error: 'خطا در ایجاد اعلان تست' });
  }
};
