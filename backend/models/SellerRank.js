const mongoose = require('mongoose');

/**
 * SellerRank Model
 * ذخیره رتبه و معیارهای محاسبه‌شده فروشنده
 * این مدل به صورت دوره‌ای آپدیت می‌شود
 */
const sellerRankSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    unique: true,
    index: true
  },
  
  // معیارهای اصلی رتبه‌بندی
  metrics: {
    // اعتبار کیف پول
    walletBalance: { type: Number, default: 0 },
    
    // تعداد مشتریان یکتا
    uniqueCustomers: { type: Number, default: 0 },
    
    // تعداد کل نوبت‌ها
    totalBookings: { type: Number, default: 0 },
    
    // نوبت‌های تکمیل شده
    completedBookings: { type: Number, default: 0 },
    
    // میانگین امتیاز (1-5)
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    
    // تعداد نظرات
    ratingCount: { type: Number, default: 0 },
    
    // روزهای استریک فعلی
    currentStreak: { type: Number, default: 0 },
    
    // امتیاز وفاداری
    loyaltyPoints: { type: Number, default: 0 }
  },
  
  // امتیاز کل محاسبه‌شده
  totalScore: { type: Number, default: 0, index: true },
  
  // رتبه در دسته‌بندی
  rankInCategory: { type: Number, default: 0 },
  
  // رتبه کلی
  globalRank: { type: Number, default: 0 },
  
  // تعداد کل فروشندگان در دسته‌بندی
  totalInCategory: { type: Number, default: 0 },
  
  // دسته‌بندی فروشنده
  category: { type: String, default: '' },
  subcategory: { type: String, default: '' },
  
  // آخرین زمان محاسبه
  calculatedAt: { type: Date, default: Date.now },
  
  // وضعیت فعال بودن
  isActive: { type: Boolean, default: true }
  
}, { timestamps: true });

// ایندکس‌های ترکیبی برای جستجوی سریع
sellerRankSchema.index({ category: 1, totalScore: -1 });
sellerRankSchema.index({ subcategory: 1, totalScore: -1 });
sellerRankSchema.index({ isActive: 1, totalScore: -1 });

/**
 * محاسبه امتیاز کل بر اساس وزن‌های مختلف
 * فرمول: (rating * 20) + (bookings * 2) + (customers * 3) + (wallet / 1000) + (streak * 5)
 */
sellerRankSchema.methods.calculateTotalScore = function() {
  const m = this.metrics;
  
  // وزن‌های مختلف برای هر معیار
  const weights = {
    rating: 20,        // امتیاز × 20
    bookings: 2,       // نوبت × 2
    customers: 3,      // مشتری × 3
    wallet: 0.001,     // اعتبار / 1000
    streak: 5,         // استریک × 5
    loyalty: 0.1       // امتیاز وفاداری × 0.1
  };
  
  const score = 
    (m.ratingAverage * weights.rating) +
    (m.completedBookings * weights.bookings) +
    (m.uniqueCustomers * weights.customers) +
    (m.walletBalance * weights.wallet) +
    (m.currentStreak * weights.streak) +
    (m.loyaltyPoints * weights.loyalty);
  
  this.totalScore = Math.round(score * 100) / 100;
  return this.totalScore;
};

module.exports = mongoose.models.SellerRank || mongoose.model('SellerRank', sellerRankSchema);
