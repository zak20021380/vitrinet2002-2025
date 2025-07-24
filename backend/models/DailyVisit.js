// models/DailyVisit.js
const mongoose = require('mongoose');

/**
 * تاریخ را به ۰۰:۰۰ (نیمه‌شب) UTC برمی‌گرداند
 * تا کل روز به شکل یکتا ذخیره شود.
 */
const normalizeToMidnightUTC = (d) => {
  const dt = new Date(d);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
};

/**
 * آمار بازدید یک روز برای هر فروشنده
 * (ترکیب seller + date باید یکتا باشد)
 */
const dailyVisitSchema = new mongoose.Schema(
  {
    /* yyyy-mm-dd بدون ساعت */
    date: {
      type: Date,
      required: true,
      set: normalizeToMidnightUTC   // همیشه به نیمه‌شب بریده شود
    },

    /* تعداد بازدیدکننده‌های آن روز */
    count: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },

    /* رفرنس به فروشنده */
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true        // برای رکوردهای جدید اجباری است
    },

    /* اسنپ‌شات مشخصات فروشنده برای ثابت ماندن */
    sellerInfo: {
      firstName: { type: String, required: true },
      lastName:  { type: String, required: true },
      phone:     { type: String, required: true },
      address:   { type: String, required: true },
      storeName: { type: String }
    }
  },
  {
    timestamps: true,   // createdAt و updatedAt
    autoIndex: true     // ایندکس‌ها را خودکار سینک کن
  }
);

/*
 * ایندکس یکتا برای seller + date
 * فقط روی اسنادی که seller از نوع ObjectId واقعی است (null یا undefined نباشد)
 * این، مشکل DuplicateKey با seller=null را برطرف می‌کند.
 */
dailyVisitSchema.index(
  { date: 1, seller: 1 },
  {
    unique: true,
    partialFilterExpression: { seller: { $type: 'objectId' } }
  }
);

// هنگام validate دوباره چک می‌کنیم که فیلد date بریده شده باشد
dailyVisitSchema.pre('validate', function (next) {
  if (this.date) {
    this.date = normalizeToMidnightUTC(this.date);
  }
  next();
});

module.exports = mongoose.model('DailyVisit', dailyVisitSchema);
