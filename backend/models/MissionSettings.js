const mongoose = require('mongoose');

const missionSettingSchema = new mongoose.Schema({
  // Mission identifier (e.g., 'user-register', 'user-app-install', 'seller-sale')
  missionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Category: 'users', 'product-sellers', 'service-sellers'
  category: {
    type: String,
    required: true,
    enum: ['users', 'product-sellers', 'service-sellers']
  },
  // Display name in Persian
  title: {
    type: String,
    required: true
  },
  // Description
  description: {
    type: String,
    default: ''
  },
  // Reward amount in Toman
  amount: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  // Whether this mission is active
  isActive: {
    type: Boolean,
    default: true
  },
  // Icon class or identifier
  icon: {
    type: String,
    default: ''
  },
  // Card color/style class
  cardStyle: {
    type: String,
    default: ''
  },
  // Display order
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
missionSettingSchema.index({ category: 1, isActive: 1 });
missionSettingSchema.index({ category: 1, order: 1 });

// Static method to get all active missions for a category
missionSettingSchema.statics.getActiveByCategory = function(category) {
  return this.find({ category, isActive: true }).sort({ order: 1 });
};

// Static method to get all missions grouped by category
missionSettingSchema.statics.getAllGrouped = async function() {
  const missions = await this.find().sort({ category: 1, order: 1 });
  return missions.reduce((acc, mission) => {
    if (!acc[mission.category]) {
      acc[mission.category] = [];
    }
    acc[mission.category].push(mission);
    return acc;
  }, {});
};

// Default missions data
missionSettingSchema.statics.getDefaults = function() {
  return [
    // User missions
    { missionId: 'user-register', category: 'users', title: 'ثبت‌نام کاربر جدید', description: 'پاداش برای هر کاربر جدید که ثبت‌نام می‌کند', amount: 5000, isActive: true, icon: 'ri-user-add-line', cardStyle: 'register', order: 1 },
    { missionId: 'user-app-install', category: 'users', title: 'نصب اپلیکیشن', description: 'پاداش برای نصب اپلیکیشن موبایل', amount: 10000, isActive: true, icon: 'ri-smartphone-line', cardStyle: 'install-app', order: 2 },
    { missionId: 'user-profile-complete', category: 'users', title: 'تکمیل پروفایل', description: 'پاداش برای تکمیل اطلاعات پروفایل', amount: 3000, isActive: true, icon: 'ri-profile-line', cardStyle: 'profile', order: 3 },
    { missionId: 'user-referral', category: 'users', title: 'دعوت دوستان', description: 'پاداش برای هر دوست دعوت‌شده که ثبت‌نام کند', amount: 15000, isActive: true, icon: 'ri-user-shared-line', cardStyle: 'invite', order: 4 },
    { missionId: 'user-book-appointment', category: 'users', title: 'رزرو نوبت', description: 'پاداش برای اولین رزرو نوبت آنلاین', amount: 5000, isActive: true, icon: 'ri-calendar-check-line', cardStyle: 'booking', order: 5 },
    { missionId: 'user-review', category: 'users', title: 'ثبت نظر', description: 'پاداش برای ثبت نظر روی محصولات', amount: 2000, isActive: true, icon: 'ri-chat-quote-line', cardStyle: 'explore', order: 6 },
    
    // Product seller missions
    { missionId: 'seller-sale', category: 'product-sellers', title: 'فروش موفق', description: 'پاداش برای هر فروش تکمیل‌شده', amount: 5000, isActive: true, icon: 'ri-shopping-cart-2-line', cardStyle: 'sale', order: 1 },
    { missionId: 'seller-5star', category: 'product-sellers', title: 'نظر ۵ ستاره', description: 'پاداش برای دریافت نظر ۵ ستاره از مشتری', amount: 3000, isActive: true, icon: 'ri-star-line', cardStyle: 'star', order: 2 },
    { missionId: 'seller-streak-7', category: 'product-sellers', title: 'استریک ۷ روزه', description: 'پاداش برای فعالیت متوالی ۷ روزه', amount: 25000, isActive: true, icon: 'ri-fire-line', cardStyle: 'streak', order: 3 },
    { missionId: 'seller-streak-30', category: 'product-sellers', title: 'استریک ۳۰ روزه', description: 'پاداش برای فعالیت متوالی ۳۰ روزه', amount: 100000, isActive: true, icon: 'ri-fire-fill', cardStyle: 'streak-gold', order: 4 },
    { missionId: 'seller-new-product', category: 'product-sellers', title: 'افزودن محصول جدید', description: 'پاداش برای هر محصول جدید ثبت‌شده', amount: 1000, isActive: false, icon: 'ri-add-box-line', cardStyle: 'product', order: 5 },
    { missionId: 'seller-profile-complete', category: 'product-sellers', title: 'تکمیل پروفایل فروشگاه', description: 'پاداش برای تکمیل اطلاعات فروشگاه', amount: 10000, isActive: true, icon: 'ri-store-3-line', cardStyle: 'profile', order: 6 },
    
    // Service seller missions
    { missionId: 'service-booking', category: 'service-sellers', title: 'رزرو موفق', description: 'پاداش برای هر رزرو تکمیل‌شده', amount: 8000, isActive: true, icon: 'ri-calendar-check-line', cardStyle: 'booking', order: 1 },
    { missionId: 'service-5star', category: 'service-sellers', title: 'نظر ۵ ستاره', description: 'پاداش برای دریافت نظر ۵ ستاره از مشتری', amount: 4000, isActive: true, icon: 'ri-star-smile-line', cardStyle: 'star', order: 2 },
    { missionId: 'service-streak-7', category: 'service-sellers', title: 'استریک ۷ روزه', description: 'پاداش برای فعالیت متوالی ۷ روزه', amount: 30000, isActive: true, icon: 'ri-fire-line', cardStyle: 'streak', order: 3 },
    { missionId: 'service-streak-30', category: 'service-sellers', title: 'استریک ۳۰ روزه', description: 'پاداش برای فعالیت متوالی ۳۰ روزه', amount: 120000, isActive: true, icon: 'ri-fire-fill', cardStyle: 'streak-gold', order: 4 },
    { missionId: 'service-new-service', category: 'service-sellers', title: 'افزودن سرویس جدید', description: 'پاداش برای هر سرویس جدید ثبت‌شده', amount: 2000, isActive: false, icon: 'ri-service-line', cardStyle: 'service', order: 5 },
    { missionId: 'service-quick-reply', category: 'service-sellers', title: 'پاسخ سریع به مشتری', description: 'پاداش برای پاسخ در کمتر از ۱۵ دقیقه', amount: 1500, isActive: false, icon: 'ri-chat-check-line', cardStyle: 'chat', order: 6 }
  ];
};

// Initialize default missions if collection is empty
missionSettingSchema.statics.initializeDefaults = async function() {
  const count = await this.countDocuments();
  if (count === 0) {
    const defaults = this.getDefaults();
    await this.insertMany(defaults);
    console.log('✅ Mission settings initialized with defaults');
  }
};

module.exports = mongoose.model('MissionSetting', missionSettingSchema);
