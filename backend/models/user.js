const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstname : { type: String, required: true },
  lastname  : { type: String, required: true },
  phone     : { type: String, required: true, unique: true },
  password  : { type: String, required: true },

  /* ─── فیلدهای جدید برای حذف نرم ─── */
  deleted   : { type: Boolean, default: false },      // نشانهٔ حذف کاربر
  deletedAt : { type: Date },                         // زمان حذف (در صورت وجود)

  favorites : [{
    type: mongoose.Schema.Types.ObjectId,
    ref : 'Product'
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
