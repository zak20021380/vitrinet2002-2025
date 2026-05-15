const mongoose = require('mongoose');

const PLAN_TIERS = ['normal', 'priority'];
const DURATION_UNITS = ['daily', 'weekly', 'monthly'];

const similarPromotionPlanSchema = new mongoose.Schema({
  tier: {
    type: String,
    enum: PLAN_TIERS,
    required: true,
    index: true
  },
  durationUnit: {
    type: String,
    enum: DURATION_UNITS,
    required: true,
    index: true
  },
  durationDays: {
    type: Number,
    required: true,
    min: 1,
    max: 370
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  slotLimit: {
    type: Number,
    default: 3,
    min: 1,
    max: 10
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  }
}, { timestamps: true });

similarPromotionPlanSchema.index({ tier: 1, durationUnit: 1 }, { unique: true });

module.exports = mongoose.models.SimilarPromotionPlan
  || mongoose.model('SimilarPromotionPlan', similarPromotionPlanSchema);
module.exports.PLAN_TIERS = PLAN_TIERS;
module.exports.DURATION_UNITS = DURATION_UNITS;
