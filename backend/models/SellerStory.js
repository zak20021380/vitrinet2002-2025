const mongoose = require('mongoose');

const DAY_MS = 24 * 60 * 60 * 1000;

const sellerStorySchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  targetType: {
    type: String,
    enum: ['shop', 'service'],
    default: 'shop',
    index: true
  },
  imageUrl: {
    type: String,
    required: true,
    trim: true
  },
  caption: {
    type: String,
    default: '',
    trim: true,
    maxlength: 140
  },
  viewsCount: {
    type: Number,
    default: 0,
    min: 0
  },
  likesCount: {
    type: Number,
    default: 0,
    min: 0
  },
  repliesCount: {
    type: Number,
    default: 0,
    min: 0
  },
  unreadRepliesCount: {
    type: Number,
    default: 0,
    min: 0
  },
  replies: [{
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    displayName: {
      type: String,
      default: 'کاربر ویتری‌نت',
      trim: true,
      maxlength: 60
    },
    replyKey: {
      type: String,
      default: '',
      trim: true,
      maxlength: 96,
      select: false
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    readAt: {
      type: Date,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  likedBy: {
    type: [String],
    default: [],
    select: false
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'deleted'],
    default: 'active',
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, { timestamps: true });

sellerStorySchema.methods.isExpired = function isExpired(now = new Date()) {
  return this.expiresAt && this.expiresAt.getTime() <= now.getTime();
};

sellerStorySchema.statics.buildExpiryDate = function buildExpiryDate(from = new Date()) {
  return new Date(from.getTime() + DAY_MS);
};

sellerStorySchema.index({ seller: 1, targetType: 1, createdAt: -1 });

module.exports = mongoose.model('SellerStory', sellerStorySchema);
module.exports.DAY_MS = DAY_MS;
