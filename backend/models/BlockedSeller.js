const mongoose = require('mongoose');

const blockedSellerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  createdAt: { type: Date, default: Date.now }
});

blockedSellerSchema.index({ user: 1, seller: 1 }, { unique: true });

module.exports = mongoose.model('BlockedSeller', blockedSellerSchema);
