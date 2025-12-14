const mongoose = require('mongoose');

/**
 * مدل پیام‌های ادمین به فروشندگان خدماتی
 * این پیام‌ها در داشبورد فروشنده نمایش داده می‌شوند
 */
const adminSellerNotificationSchema = new mongoose.Schema({
  // فروشنده دریافت‌کننده پیام
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  // شناسه فروشگاه خدماتی (اختیاری)
  serviceShopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceShop',
    index: true
  },
  // نوع پیام
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'urgent'],
    default: 'info'
  },
  // عنوان پیام
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  // متن پیام
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  // وضعیت خوانده شدن
  read: {
    type: Boolean,
    default: false
  },
  // تاریخ خوانده شدن
  readAt: {
    type: Date
  },
  // ادمین ارسال‌کننده (اختیاری)
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// ایندکس‌های ترکیبی برای بهبود عملکرد
adminSellerNotificationSchema.index({ sellerId: 1, read: 1 });
adminSellerNotificationSchema.index({ sellerId: 1, createdAt: -1 });

module.exports = mongoose.model('AdminSellerNotification', adminSellerNotificationSchema);
