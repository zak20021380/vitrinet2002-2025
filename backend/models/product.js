// models/Product.js

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  tags: [{
    type: String
  }],
  badge: {
    type: String,
    default: ""  // مثلا: "پرفروش"
  },
  badgeType: {
    type: String,
    default: ""  // مثلا: "best"
  },
  desc: {
    type: String
  },
  images: [{
    type: String
  }],
  mainImageIndex: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
