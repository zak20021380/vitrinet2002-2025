const mongoose = require('mongoose');

/**
 * مدل پیشرفت ماموریت‌های کاربر
 * ذخیره وضعیت و پیشرفت هر ماموریت برای هر کاربر
 */
const userMissionProgressSchema = new mongoose.Schema({
  // شناسه کاربر
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // شناسه ماموریت (مثلاً 'user-review' برای گردش در بازار)
  missionId: {
    type: String,
    required: true,
    index: true
  },

  // وضعیت ماموریت
  status: {
    type: String,
    enum: ['active', 'completed', 'expired', 'claimed'],
    default: 'active'
  },

  // تعداد مورد نیاز برای تکمیل
  requiredCount: {
    type: Number,
    default: 3
  },

  // تعداد فعلی انجام شده
  currentCount: {
    type: Number,
    default: 0
  },

  // لیست فروشگاه‌های بازدید شده (برای ماموریت گردش در بازار)
  visitedStores: [{
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true
    },
    visitedAt: {
      type: Date,
      default: Date.now
    },
    // زمان صرف شده در صفحه (ثانیه)
    timeSpent: {
      type: Number,
      default: 0
    }
  }],

  // تاریخ شروع دوره ماموریت
  cycleStartDate: {
    type: Date,
    default: Date.now
  },

  // تاریخ پایان دوره ماموریت (اختیاری)
  cycleEndDate: {
    type: Date,
    default: null
  },

  // تاریخ تکمیل ماموریت
  completedAt: {
    type: Date,
    default: null
  },

  // مبلغ پاداش (در زمان تکمیل)
  rewardAmount: {
    type: Number,
    default: 0
  },

  // آیا پاداش پرداخت شده؟
  rewardPaid: {
    type: Boolean,
    default: false
  },

  // متادیتا اضافی
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }

}, {
  timestamps: true
});

// ایندکس ترکیبی برای جلوگیری از تکرار
userMissionProgressSchema.index({ user: 1, missionId: 1 }, { unique: true });
userMissionProgressSchema.index({ status: 1 });
userMissionProgressSchema.index({ 'visitedStores.storeId': 1 });

/**
 * بررسی آیا فروشگاه قبلاً بازدید شده
 */
userMissionProgressSchema.methods.hasVisitedStore = function(storeId) {
  return this.visitedStores.some(v => v.storeId.toString() === storeId.toString());
};

/**
 * افزودن بازدید فروشگاه
 */
userMissionProgressSchema.methods.addStoreVisit = function(storeId, timeSpent = 0) {
  if (this.hasVisitedStore(storeId)) {
    return false; // قبلاً بازدید شده
  }
  
  this.visitedStores.push({
    storeId,
    visitedAt: new Date(),
    timeSpent
  });
  this.currentCount = this.visitedStores.length;
  
  return true;
};

/**
 * بررسی تکمیل ماموریت
 */
userMissionProgressSchema.methods.checkCompletion = function() {
  if (this.currentCount >= this.requiredCount && this.status === 'active') {
    this.status = 'completed';
    this.completedAt = new Date();
    return true;
  }
  return false;
};

/**
 * دریافت یا ایجاد پیشرفت ماموریت
 */
userMissionProgressSchema.statics.getOrCreate = async function(userId, missionId, requiredCount = 3) {
  let progress = await this.findOne({ user: userId, missionId });
  
  if (!progress) {
    progress = await this.create({
      user: userId,
      missionId,
      requiredCount,
      status: 'active'
    });
  }
  
  return progress;
};

/**
 * ریست کردن ماموریت برای دوره جدید
 */
userMissionProgressSchema.methods.resetForNewCycle = function() {
  this.visitedStores = [];
  this.currentCount = 0;
  this.status = 'active';
  this.completedAt = null;
  this.rewardPaid = false;
  this.cycleStartDate = new Date();
};

module.exports = mongoose.model('UserMissionProgress', userMissionProgressSchema);
