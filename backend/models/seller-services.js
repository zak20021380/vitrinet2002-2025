// models/seller-services.js
const mongoose = require('mongoose');

const sellerServiceSchema = new mongoose.Schema({
  // اتصال به فروشنده
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },

  // مشخصات سرویس
  title: { type: String, required: true, trim: true },
  desc:  { type: String, default: '' },
  category: { type: String, default: '' },
  tags: [{ type: String }],

  // قیمت و مدت‌زمان سرویس (برای نوبت‌دهی حرفه‌ای)
  price: { type: Number, required: true, min: 0 },
  durationMinutes: { type: Number, default: 30, min: 5, max: 600 },

  // تصاویر (مشابه Product)
  images: [{ type: String }],
  mainImageIndex: { type: Number, default: 0 },

  // وضعیت‌ها
  isActive:   { type: Boolean, default: true }, // نمایش در صفحه
  isBookable: { type: Boolean, default: true }  // قابل‌رزرو بودن
}, { timestamps: true });

// جلوگیری از تکرار عنوان سرویس برای یک فروشنده
sellerServiceSchema.index({ sellerId: 1, title: 1 }, { unique: true });

// ایندکس‌های کاربردی
sellerServiceSchema.index({ sellerId: 1, isActive: 1 });
sellerServiceSchema.index({ title: 'text', desc: 'text', category: 'text' });

module.exports =
  mongoose.models.SellerService || mongoose.model('SellerService', sellerServiceSchema);
