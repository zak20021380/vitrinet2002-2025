const mongoose = require('mongoose');

const REPORT_TYPES = [
  'price_mismatch',   // عدم تطابق قیمت
  'no_response',      // پاسخ‌ندادن به مشتری
  'overpricing',      // گران‌فروشی
  'other',            // سایر
  'block'            // مسدودسازی کاربر توسط فروشنده
];

const reportSchema = new mongoose.Schema(
  {
    // شناسایی فروشنده
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', index: true },
    shopurl:  { type: String, index: true },

    // گزارش‌دهنده
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ip:      { type: String },       // برای بلاک کردن مهمان‌ها (در صورت نیاز)
    contact: { type: String, trim: true, maxlength: 160 },

    // جزئیات گزارش
    type:        { type: String, enum: REPORT_TYPES, required: true },
    description: { type: String, required: true, minlength: 5 },

    // وضعیت رسیدگی
    status:  { type: String, enum: ['pending','reviewing','resolved','rejected'], default: 'pending' },

    // اگر این کاربر / آی‌پی بلاک شد
    blocked: { type: Boolean, default: false },
  },
  { timestamps: true } // createdAt , updatedAt
);

module.exports = mongoose.model('Report', reportSchema);
module.exports.REPORT_TYPES = REPORT_TYPES;
