const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, 'عنوان دسته باید حداقل ۲ کاراکتر باشد.']
    },
    type: {
      type: String,
      enum: ['category', 'service-subcategory'],
      default: 'category',
      index: true
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true
    },
    parentName: {
      type: String,
      trim: true,
      default: null
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      index: true
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

categorySchema.pre('validate', function setSlug(next) {
  if (this.name) {
    this.slug = this.name
      .toString()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
      .toLowerCase();
  }
  next();
});

categorySchema.index({ type: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
