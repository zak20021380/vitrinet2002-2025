// backend/models/ProductComment.js
// مدل نظرات محصولات با سیستم مدیریت وضعیت

const mongoose = require('mongoose');

const productCommentSchema = new mongoose.Schema({
  // شناسه کاربر نظردهنده
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // شناسه محصول
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  
  // شناسه فروشنده (برای دسترسی سریع در پنل فروشنده)
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  
  // متن نظر
  content: {
    type: String,
    required: true,
    trim: true,
    minlength: [3, 'متن نظر باید حداقل ۳ کاراکتر باشد'],
    maxlength: [1000, 'متن نظر نباید بیشتر از ۱۰۰۰ کاراکتر باشد']
  },
  
  // امتیاز (۱ تا ۵ ستاره)
  rating: {
    type: Number,
    required: true,
    min: [1, 'امتیاز باید حداقل ۱ باشد'],
    max: [5, 'امتیاز نباید بیشتر از ۵ باشد']
  },
  
  // وضعیت نظر
  status: {
    type: String,
    enum: ['pending', 'published', 'rejected'],
    default: 'pending',
    index: true
  },
  
  // زمان تغییر وضعیت
  statusChangedAt: {
    type: Date,
    default: null
  },
  
  // دلیل رد (اختیاری)
  rejectionReason: {
    type: String,
    default: null,
    maxlength: 500
  }
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ایندکس‌های ترکیبی برای کوئری‌های بهینه
productCommentSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
productCommentSchema.index({ productId: 1, status: 1, createdAt: -1 });
productCommentSchema.index({ userId: 1, productId: 1 });

// متد استاتیک: دریافت میانگین امتیاز محصول
productCommentSchema.statics.getProductRating = async function(productId) {
  const result = await this.aggregate([
    { 
      $match: { 
        productId: new mongoose.Types.ObjectId(productId),
        status: 'published'
      }
    },
    {
      $group: {
        _id: '$productId',
        avgRating: { $avg: '$rating' },
        totalCount: { $sum: 1 }
      }
    }
  ]);
  
  return result.length > 0 
    ? { avgRating: Math.round(result[0].avgRating * 10) / 10, totalCount: result[0].totalCount }
    : { avgRating: 0, totalCount: 0 };
};

// متد استاتیک: شمارش نظرات در انتظار فروشنده
productCommentSchema.statics.getPendingCountForSeller = async function(sellerId) {
  return this.countDocuments({ sellerId, status: 'pending' });
};

module.exports = mongoose.model('ProductComment', productCommentSchema);
