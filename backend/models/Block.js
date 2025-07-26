const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema({
  sellerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason:     { type: String },
  blockedAt:  { type: Date, default: Date.now }
});

BlockSchema.index({ sellerId: 1, customerId: 1 }, { unique: true });

module.exports = mongoose.model('Block', BlockSchema);
