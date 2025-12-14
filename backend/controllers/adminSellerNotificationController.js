const AdminSellerNotification = require('../models/AdminSellerNotification');
const ServiceShop = require('../models/serviceShop');
const Seller = require('../models/Seller');

/**
 * ارسال پیام از ادمین به فروشنده
 */
exports.sendNotification = async (req, res) => {
  try {
    const { sellerId, serviceShopId, type, title, content } = req.body;

    // اعتبارسنجی
    if (!sellerId) {
      return res.status(400).json({ error: 'شناسه فروشنده الزامی است' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'عنوان پیام الزامی است' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'متن پیام الزامی است' });
    }

    // بررسی وجود فروشنده
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ error: 'فروشنده یافت نشد' });
    }

    // ایجاد پیام
    const notification = new AdminSellerNotification({
      sellerId,
      serviceShopId: serviceShopId || null,
      type: type || 'info',
      title: title.trim(),
      content: content.trim(),
      sentBy: req.user?._id || null
    });

    await notification.save();

    res.status(201).json({
      success: true,
      message: 'پیام با موفقیت ارسال شد',
      notification
    });
  } catch (error) {
    console.error('sendNotification error:', error);
    res.status(500).json({ error: 'خطا در ارسال پیام' });
  }
};

/**
 * دریافت پیام‌های فروشنده لاگین‌شده (بدون نیاز به sellerId در URL)
 */
exports.getMyNotifications = async (req, res) => {
  try {
    const sellerId = req.user?.id || req.user?._id;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    if (!sellerId) {
      return res.status(401).json({ error: 'لطفاً وارد حساب کاربری شوید' });
    }

    const query = { sellerId };
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
      AdminSellerNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AdminSellerNotification.countDocuments(query)
    ]);

    res.json({
      success: true,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('getMyNotifications error:', error);
    res.status(500).json({ error: 'خطا در دریافت پیام‌ها' });
  }
};

/**
 * دریافت تعداد پیام‌های خوانده نشده فروشنده لاگین‌شده
 */
exports.getMyUnreadCount = async (req, res) => {
  try {
    const sellerId = req.user?.id || req.user?._id;

    if (!sellerId) {
      return res.status(401).json({ error: 'لطفاً وارد حساب کاربری شوید' });
    }

    const count = await AdminSellerNotification.countDocuments({
      sellerId,
      read: false
    });

    res.json({ success: true, count });
  } catch (error) {
    console.error('getMyUnreadCount error:', error);
    res.status(500).json({ error: 'خطا در دریافت تعداد پیام‌ها' });
  }
};

/**
 * دریافت پیام‌های فروشنده
 */
exports.getSellerNotifications = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    // بررسی دسترسی: فروشنده فقط می‌تواند پیام‌های خودش را ببیند
    // ادمین می‌تواند پیام‌های همه را ببیند
    const userRole = req.user?.role;
    const userId = req.user?.id || req.user?._id;
    
    if (userRole === 'seller' && sellerId !== String(userId)) {
      return res.status(403).json({ error: 'شما فقط می‌توانید پیام‌های خودتان را مشاهده کنید' });
    }

    const query = { sellerId };
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
      AdminSellerNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AdminSellerNotification.countDocuments(query)
    ]);

    res.json({
      success: true,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('getSellerNotifications error:', error);
    res.status(500).json({ error: 'خطا در دریافت پیام‌ها' });
  }
};

/**
 * علامت‌گذاری پیام به عنوان خوانده شده
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await AdminSellerNotification.findByIdAndUpdate(
      id,
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'پیام یافت نشد' });
    }

    res.json({ success: true, notification });
  } catch (error) {
    console.error('markAsRead error:', error);
    res.status(500).json({ error: 'خطا در به‌روزرسانی پیام' });
  }
};

/**
 * علامت‌گذاری همه پیام‌ها به عنوان خوانده شده
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const { sellerId } = req.params;

    const result = await AdminSellerNotification.updateMany(
      { sellerId, read: false },
      { read: true, readAt: new Date() }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} پیام به عنوان خوانده شده علامت‌گذاری شد`
    });
  } catch (error) {
    console.error('markAllAsRead error:', error);
    res.status(500).json({ error: 'خطا در به‌روزرسانی پیام‌ها' });
  }
};

/**
 * حذف پیام
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await AdminSellerNotification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({ error: 'پیام یافت نشد' });
    }

    res.json({ success: true, message: 'پیام با موفقیت حذف شد' });
  } catch (error) {
    console.error('deleteNotification error:', error);
    res.status(500).json({ error: 'خطا در حذف پیام' });
  }
};

/**
 * دریافت تعداد پیام‌های خوانده نشده
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const { sellerId } = req.params;

    // بررسی دسترسی: فروشنده فقط می‌تواند تعداد پیام‌های خودش را ببیند
    const userRole = req.user?.role;
    const userId = req.user?.id || req.user?._id;
    
    if (userRole === 'seller' && sellerId !== String(userId)) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    const count = await AdminSellerNotification.countDocuments({
      sellerId,
      read: false
    });

    res.json({ success: true, count });
  } catch (error) {
    console.error('getUnreadCount error:', error);
    res.status(500).json({ error: 'خطا در دریافت تعداد پیام‌ها' });
  }
};
