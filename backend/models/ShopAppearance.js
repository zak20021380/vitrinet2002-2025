const mongoose = require('mongoose');

// اسلایدهای فروشگاه (مثل بنرهای تصویری بالای فروشگاه)
const slideSchema = new mongoose.Schema({
  title: String,
  desc:  String,
  img:   String, // می‌تونه base64 یا URL باشه
});

// ظاهر و تنظیمات فروشگاه
const shopAppearanceSchema = new mongoose.Schema({
  sellerId:     { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Seller' },

  // آدرس اختصاصی فروشگاه (مثلاً vitreenet.ir/yourshop)
  customUrl:    { type: String, required: true, unique: true },

  shopPhone:    { type: String, default: '' },
  shopAddress:  { type: String, default: '' },
  shopLogoText: { type: String, default: '' },
  shopStatus:   { type: String, enum: ['open', 'closed'], default: 'open' },

  slides:       [slideSchema],  // لیست اسلایدها

  // خلاصه امتیاز‌دهی
  averageRating: { type: Number, default: 0 }, // میانگین امتیازها
  ratingCount:   { type: Number, default: 0 }, // تعداد کل امتیازها

  // لوگوی فروشگاه (URL یا مسیر نسبی)
  shopLogo:      { type: String, default: '' }

}, { timestamps: true });


// توابع کمکی و هوک‌ها
function escapeRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

// Hook بعد از ذخیره مغازه برای به‌روزرسانی تعداد مغازه‌ها در تمام مراکز خرید
shopAppearanceSchema.post('save', async function(doc) {
  const ShoppingCenter = mongoose.model('ShoppingCenter');
  const centers = await ShoppingCenter.find();
  for (let center of centers) {
    const escapedTitle = escapeRegex(center.title);
    const count = await mongoose.model('ShopAppearance').countDocuments({
      shopAddress: { $regex: escapedTitle, $options: 'i' }
    });
    await ShoppingCenter.updateOne({ _id: center._id }, { stores: count });
  }
});

// ایندکس‌ها برای بهبود عملکرد
shopAppearanceSchema.index({ shopAddress: 1 });
shopAppearanceSchema.index({ sellerId: 1 });

module.exports = mongoose.model('ShopAppearance', shopAppearanceSchema);
