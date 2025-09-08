const mongoose = require('mongoose');

const loyaltySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    completed: { type: Number, default: 0 },
    claimed: { type: Number, default: 0 },
    pending: { type: Number, default: 0 }
  },
  { timestamps: true }
);

loyaltySchema.index({ userId: 1, storeId: 1 }, { unique: true });

module.exports = mongoose.model('Loyalty', loyaltySchema);
