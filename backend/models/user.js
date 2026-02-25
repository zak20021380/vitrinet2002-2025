const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstname: { type: String, default: '' },
  lastname: { type: String, default: '' },
  city: { type: String, default: '' },
  mobile: { type: String, default: '' },
  phone: { type: String, required: true, unique: true },
  password: { type: String, default: null },
  otp: { type: String, default: null },
  otpExpire: { type: Date, default: null },
  termsAcceptedAt: { type: Date, default: null },
  role: { type: String, default: 'user' },
  referralCode: { type: String, unique: true, sparse: true }, // کد معرف یکتای کاربر
  referredBy: { type: String }, // کد معرفی که با آن ثبت‌نام کرده
  
  // تاریخ تولد (فرمت شمسی: "1375/06/20")
  birthDate: { type: String, default: null },
  // آیا جایزه ثبت تاریخ تولد دریافت شده؟
  birthDateRewardClaimed: { type: Boolean, default: false },

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
