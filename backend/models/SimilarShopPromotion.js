const mongoose = require('mongoose');

const PROMOTION_STATUSES = ['pending', 'approved', 'rejected', 'paused', 'expired', 'removed'];
const PAYMENT_STATUSES = ['pending', 'submitted', 'verified', 'rejected', 'waived'];
const PLAN_TIERS = ['normal', 'priority'];
const DURATION_UNITS = ['daily', 'weekly', 'monthly'];

const paymentProofSchema = new mongoose.Schema({
  text: { type: String, default: '', trim: true, maxlength: 1000 },
  fileUrl: { type: String, default: '', trim: true },
  fileName: { type: String, default: '', trim: true },
  uploadedAt: { type: Date, default: null }
}, { _id: false });

const shopSnapshotSchema = new mongoose.Schema({
  name: { type: String, default: '', trim: true },
  shopUrl: { type: String, default: '', trim: true, lowercase: true },
  phone: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true },
  city: { type: String, default: '', trim: true },
  categoryName: { type: String, default: '', trim: true },
  imageUrl: { type: String, default: '', trim: true }
}, { _id: false });

const productSnapshotSchema = new mongoose.Schema({
  title: { type: String, default: '', trim: true },
  price: { type: Number, default: 0, min: 0 },
  imageUrl: { type: String, default: '', trim: true }
}, { _id: false });

const metricsSchema = new mongoose.Schema({
  impressions: { type: Number, default: 0, min: 0 },
  clicks: { type: Number, default: 0, min: 0 },
  lastImpressionAt: { type: Date, default: null },
  lastClickAt: { type: Date, default: null }
}, { _id: false });

const similarShopPromotionSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  serviceShopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceShop',
    default: null,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null,
    index: true
  },
  planTier: {
    type: String,
    enum: PLAN_TIERS,
    required: true,
    index: true
  },
  durationUnit: {
    type: String,
    enum: DURATION_UNITS,
    required: true
  },
  durationDays: {
    type: Number,
    required: true,
    min: 1,
    max: 370
  },
  planTitle: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  slotLimit: {
    type: Number,
    min: 1,
    max: 10,
    default: 1
  },
  paymentStatus: {
    type: String,
    enum: PAYMENT_STATUSES,
    default: 'submitted',
    index: true
  },
  paymentProof: {
    type: paymentProofSchema,
    default: () => ({})
  },
  status: {
    type: String,
    enum: PROMOTION_STATUSES,
    default: 'pending',
    index: true
  },
  startAt: { type: Date, default: null, index: true },
  endAt: { type: Date, default: null, index: true },
  priorityOrder: { type: Number, default: 100, index: true },
  adminNote: { type: String, default: '', trim: true, maxlength: 1000 },
  shopSnapshot: {
    type: shopSnapshotSchema,
    default: () => ({})
  },
  productSnapshot: {
    type: productSnapshotSchema,
    default: () => ({})
  },
  metrics: {
    type: metricsSchema,
    default: () => ({})
  },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  approvedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },
  pausedAt: { type: Date, default: null },
  resumedAt: { type: Date, default: null },
  removedAt: { type: Date, default: null },
  expiredAt: { type: Date, default: null }
}, { timestamps: true });

similarShopPromotionSchema.index({ sellerId: 1, status: 1, startAt: 1, endAt: 1 });
similarShopPromotionSchema.index({ status: 1, startAt: 1, endAt: 1, planTier: 1, priorityOrder: 1 });

similarShopPromotionSchema.virtual('ctr').get(function getCtr() {
  const impressions = Number(this.metrics?.impressions || 0);
  const clicks = Number(this.metrics?.clicks || 0);
  return impressions > 0 ? clicks / impressions : 0;
});

module.exports = mongoose.models.SimilarShopPromotion
  || mongoose.model('SimilarShopPromotion', similarShopPromotionSchema);
module.exports.PROMOTION_STATUSES = PROMOTION_STATUSES;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
