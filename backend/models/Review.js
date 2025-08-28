const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  score:    { type: Number, min: 1, max: 5, required: true },
  comment:  { type: String, default: '' }
}, { timestamps: true });

reviewSchema.index({ sellerId: 1 });
reviewSchema.index({ userId: 1 });

module.exports = mongoose.model('Review', reviewSchema);
