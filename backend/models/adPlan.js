const mongoose = require('mongoose');

const adPlanSchema = new mongoose.Schema({
  slug: { 
    type: String, 
    required: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  price: { 
    type: Number, 
    required: true,
    min: [0, 'قیمت باید بزرگتر از 0 باشد.']
  },
  sellerPhone: { 
    type: String, 
    default: null, 
    index: true 
  }  // null یعنی عمومی
}, {
  timestamps: true
});

// ایندکس unique روی slug + sellerPhone
adPlanSchema.index({ slug: 1, sellerPhone: 1 }, { unique: true });

module.exports = mongoose.model('AdPlan', adPlanSchema);