const mongoose = require('mongoose');

const usageSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', default: null },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'ServicePlan', default: null },
  usedAt: { type: Date, default: Date.now }
}, { _id: false });

const servicePlanDiscountCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, uppercase: true, unique: true },
  discountPercent: { type: Number, required: true, min: 1, max: 100 },
  maxUsages: { type: Number, default: null },
  usedCount: { type: Number, default: 0 },
  expiresAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  notes: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  usages: { type: [usageSchema], default: () => [] }
}, { timestamps: true });

servicePlanDiscountCodeSchema.index({ expiresAt: 1 });

module.exports = mongoose.models.ServicePlanDiscountCode
  || mongoose.model('ServicePlanDiscountCode', servicePlanDiscountCodeSchema);
