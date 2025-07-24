// models/sellerPlan.js
const mongoose = require('mongoose');

const sellerPlanSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  planSlug: { type: String, required: true },
  planTitle: String,
  price: Number,
  startDate: { type: Date, default: Date.now },
  endDate: Date,
  status: { type: String, enum: ['active', 'expired', 'pending'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SellerPlan', sellerPlanSchema);
