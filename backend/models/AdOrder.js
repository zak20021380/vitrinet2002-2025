const mongoose = require('mongoose');

const adOrderSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },  // آیدی فروشنده سفارش‌دهنده
  planSlug: { type: String, required: true },           // مثل ad_search, ad_home, ad_products
  planTitle: { type: String },                          // عنوان پلن (اختیاری)
  price: { type: Number, required: true },              // مبلغ سفارش (در لحظه ثبت)
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // اگر تبلیغ روی محصوله
  shopTitle: { type: String },                          // اسم فروشگاه (اختیاری)
  bannerImage: { type: String },                        // آدرس عکس تبلیغ (اختیاری)
  adTitle: { type: String },                            // عنوان تبلیغ (از فرم)
  adText: { type: String },                             // متن تبلیغ (از فرم)
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'rejected', 'expired'],
    default: 'pending'
  },                                                    // وضعیت سفارش تبلیغ
  adminNote: { type: String, trim: true },              // یادداشت داخلی ادمین
  reviewedAt: { type: Date },                           // تاریخ آخرین بررسی ادمین
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }, // شناسه ادمین بررسی کننده
  approvedAt: { type: Date },                           // تاریخ تایید نهایی
  displayedAt: { type: Date },                          // تاریخ نمایش در سایت
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdOrder', adOrderSchema);
