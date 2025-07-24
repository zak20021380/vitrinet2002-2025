// models/ShoppingCenter.js

const mongoose = require('mongoose');
const ShopAppearance = require('./ShopAppearance'); // Import to use in hook

function getTitleForRegex(title) {
  // Use the first word of the title for matching to handle partial addresses
  return title.trim().split(/\s+/)[0] || title;
}

function escapeRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

const shoppingCenterSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true },   // نام مرکز خرید
  description:  { type: String, default: '', trim: true },      // توضیحات
  image:        { type: String, required: true },               // آدرس عکس
  tag:          { type: String, default: '' },                  // تگ بالای کارت (اختیاری)
  location:     { type: String, default: '' },                  // آدرس/موقعیت (اختیاری)
  order:        { type: Number, default: 0 },                   // ترتیب نمایش (اختیاری)
  stores:       { type: Number, default: 0 },                   // تعداد مغازه‌ها
  hours:        { type: String, default: '' },                  // ساعات کاری
  holidays:     { type: String, default: '' },                  // روزهای تعطیل
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now }
});

shoppingCenterSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();

  if (this.isModified('title')) {
    const matchTitle = getTitleForRegex(this.title);
    const escapedTitle = escapeRegex(matchTitle);
    this.stores = await ShopAppearance.countDocuments({
      shopAddress: { $regex: escapedTitle, $options: 'i' }
    });
  }

  next();
});

module.exports = mongoose.model('ShoppingCenter', shoppingCenterSchema);