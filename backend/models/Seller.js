const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  firstname: String,
  lastname: String,
  storename: String,
  shopurl: { type: String, unique: true },
  phone: { type: String, unique: true },
  category: String,
  address: String,
  desc: String,
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

}, { timestamps: true });

module.exports = mongoose.model('Seller', sellerSchema);
