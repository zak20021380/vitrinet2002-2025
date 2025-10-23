const mongoose = require('mongoose');

const CATEGORY_TYPES = ['category', 'service-subcategory'];

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160
    },
    type: {
      type: String,
      enum: CATEGORY_TYPES,
      required: true,
      default: 'category'
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: undefined
    }
  },
  {
    timestamps: true
  }
);

categorySchema.index({ slug: 1, type: 1 }, { unique: true });

categorySchema.statics.normaliseName = function normaliseName(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
};

categorySchema.statics.slugify = function slugify(value) {
  const name = this.normaliseName(value);
  return name
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^\w\-\u0600-\u06FF]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

module.exports = mongoose.model('Category', categorySchema);
module.exports.CATEGORY_TYPES = CATEGORY_TYPES;
