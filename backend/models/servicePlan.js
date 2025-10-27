const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema({
  value: { type: String, trim: true }
}, { _id: false });

const servicePlanSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true },
  description: { type: String, default: '', trim: true },
  price: { type: Number, required: true, min: 0 },
  durationDays: { type: Number, default: 30, min: 0 },
  isActive: { type: Boolean, default: true },
  features: { type: [featureSchema], default: () => [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }
}, { timestamps: true });

servicePlanSchema.index({ slug: 1 }, { unique: true });

module.exports = mongoose.models.ServicePlan || mongoose.model('ServicePlan', servicePlanSchema);
