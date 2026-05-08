const mongoose = require('mongoose');

const DAY_MS = 24 * 60 * 60 * 1000;

const sellerStorySchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
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

sellerStorySchema.index({ seller: 1, createdAt: -1 });

module.exports = mongoose.model('SellerStory', sellerStorySchema);
module.exports.DAY_MS = DAY_MS;
