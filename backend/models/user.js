const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  referralCode: { type: String }, // کد معرف

  /* ─── فیلدهای جدید برای حذف نرم ─── */
  deleted: { type: Boolean, default: false },      // نشانهٔ حذف کاربر
  deletedAt: { type: Date },                         // زمان حذف (در صورت وجود)

  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }]
  ,
  lastVisit: { type: Date },

  activityLog: [{
    action: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    meta: { type: mongoose.Schema.Types.Mixed }
  }],

  // آیا توسط ادمین برای ارسال پیام مسدود شده است؟
  blockedByAdmin: { type: Boolean, default: false },

  userType: {
    type: String,
    enum: ['product', 'service', 'both'],
    default: 'both',
    index: true
  },

  bookings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
