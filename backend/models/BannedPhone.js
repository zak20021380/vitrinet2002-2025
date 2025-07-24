const mongoose = require('mongoose');

/**
 * لیست شماره‌تلفن‌هایی که به طور دائمی حق
 * ورود یا ثبت‌نام در سامانه را ندارند.
 */
const bannedPhoneSchema = new mongoose.Schema({
  phone: {
    type    : String,
    required: true,
    unique  : true          // هر شماره فقط یک‌بار ذخیره شود
  },
  reason: {
    type: String,            // توضیح اختیاری (مثلاً «حذف توسط ادمین»)
    default: ''
  },
  createdAt: {
    type   : Date,
    default: Date.now        // زمان ثبت در لیست سیاه
  }
});

module.exports = mongoose.model('BannedPhone', bannedPhoneSchema);
