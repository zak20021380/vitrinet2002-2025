const mongoose = require('mongoose');

const planSnapshotSchema = new mongoose.Schema({
  title: { type: String, trim: true },
  slug: { type: String, trim: true },
  description: { type: String, default: '', trim: true },
  durationDays: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  features: [{ type: String, trim: true }]
}, { _id: false });

const servicePlanSubscriptionSchema = new mongoose.Schema({
  serviceShop: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceShop', required: true },
  servicePlan: { type: mongoose.Schema.Types.ObjectId, ref: 'ServicePlan', required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  assignedPhone: { type: String, required: true, trim: true },
  normalizedPhone: { type: String, required: true, trim: true, index: true },
  basePrice: { type: Number, default: 0 },
  customPrice: { type: Number, default: null },
  durationDays: { type: Number, default: 0 },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: null },
  status: { type: String, enum: ['active', 'scheduled', 'expired'], default: 'active' },
  notes: { type: String, default: '', trim: true },
  planSnapshot: { type: planSnapshotSchema, default: () => ({}) }
}, { timestamps: true });

servicePlanSubscriptionSchema.index({ serviceShop: 1 }, { unique: true });

module.exports = mongoose.models.ServicePlanSubscription || mongoose.model('ServicePlanSubscription', servicePlanSubscriptionSchema);
