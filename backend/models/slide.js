const mongoose = require('mongoose');

const slideSchema = new mongoose.Schema({
  title: { type: String, required: true },
  desc: { type: String, default: "" },
  image: { type: String, required: true }, // مسیر عکس (url یا base64 یا نام فایل)
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true }, // هر اسلاید متعلق به یک فروشگاه
  order: { type: Number, default: 0 }, // ترتیب نمایش اسلایدها
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Slide', slideSchema);
