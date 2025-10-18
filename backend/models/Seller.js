const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  firstname: String,
  lastname: String,
  storename: String,
  shopurl: { type: String, unique: true },
  phone: { type: String, unique: true },
  category: String,
  subcategory: String,
  address: String,
  desc: String,
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  password: {
    type: String,
    required: true,
    select: false  // یعنی رمز رو پیش‌فرض نفرست
  },


  // --- برای OTP ---
  otp: { type: String },           // کد تایید پیامک
  otpExpire: { type: Date },       // زمان انقضای کد

  // --- فیلد عکس تابلو فروشگاه (لوگو) ---
  boardImage: { type: String, default: "" },   // عکس تابلو (base64 یا آدرس عکس)

  // --- اطلاعات اشتراک و بازدید ---
  subscriptionStart: { type: Date },     // تاریخ شروع اشتراک
  subscriptionEnd: { type: Date },       // تاریخ پایان اشتراک
  visits: { type: Number, default: 0 },  // تعداد بازدید فروشگاه

  // --- وضعیت فروشنده پریمیوم ---
  // ⚠️ هرگز به فرانت اجازه نده این فیلدها را تغییر دهد؛ فقط کال‌بک درگاه یا ادمین
  isPremium: { type: Boolean, default: false },
  premiumUntil: { type: Date, default: null },

  // آیا توسط ادمین برای ارسال پیام مسدود شده است؟
  blockedByAdmin: { type: Boolean, default: false },

  // مشتریانی که توسط این فروشنده مسدود شده‌اند
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // --- ارزیابی عملکرد توسط تیم ادمین ---
  adminScore: { type: Number, min: 0, max: 100, default: null },
  adminScoreUpdatedAt: { type: Date, default: null },
  adminScoreNote: { type: String, default: '' },
  performanceStatus: {
    type: String,
    enum: ['unset', 'warning', 'good', 'excellent', 'critical'],
    default: 'unset'
  }

}, { timestamps: true });

module.exports = mongoose.model('Seller', sellerSchema);
