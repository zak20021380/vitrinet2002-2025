const mongoose = require('mongoose');

const portfolioLikeSchema = new mongoose.Schema({
  portfolioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellerPortfolio',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

portfolioLikeSchema.index({ portfolioId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('PortfolioLike', portfolioLikeSchema);

