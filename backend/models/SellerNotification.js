const mongoose = require('mongoose');

/**
 * مدل اعلان‌های فروشنده
 * شامل پیام‌های مشتریان، لایک‌ها، سفارشات و غیره
 */
const sellerNotificationSchema = new mongoose.Schema({
  // فروشنده دریافت‌کننده اعلان
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  // نوع اعلان
  type: {
    type: String,
    enum: ['customer_message', 'product_like', 'order', 'review', 'admin_message', 'system', 'info'],
    default: 'info'
  },
  // عنوان اعلان
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  // متن اعلان
  message: {
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
  // اطلاعات مرتبط
  relatedData: {
    // شناسه چت (برای پیام مشتری)
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat'
    },
    // شناسه محصول
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    // شناسه مشتری
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // نام مشتری
    customerName: String,
    // عنوان محصول
    productTitle: String
  }
}, {
  timestamps: true
});

// ایندکس‌های ترکیبی برای بهبود عملکرد
sellerNotificationSchema.index({ sellerId: 1, read: 1 });
sellerNotificationSchema.index({ sellerId: 1, createdAt: -1 });
sellerNotificationSchema.index({ sellerId: 1, type: 1 });

module.exports = mongoose.model('SellerNotification', sellerNotificationSchema);
