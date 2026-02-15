const mongoose = require('mongoose');

const HOMEPAGE_SECTION_TYPES = ['latest', 'category', 'popular', 'discounted'];
const HOMEPAGE_SECTION_SORTS = ['latest', 'oldest', 'price-desc', 'price-asc', 'most-liked'];

const homepageSectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    type: {
      type: String,
      enum: HOMEPAGE_SECTION_TYPES,
      default: 'latest',
      required: true
    },
    categoryFilter: {
      type: String,
      trim: true,
      default: ''
    },
    sort: {
      type: String,
      enum: HOMEPAGE_SECTION_SORTS,
      default: 'latest',
      required: true
    },
    limit: {
      type: Number,
      min: 1,
      max: 40,
      default: 10
    },
    displayOrder: {
      type: Number,
      min: 0,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

homepageSectionSchema.index({ isActive: 1, displayOrder: 1, createdAt: 1 });
homepageSectionSchema.index({ displayOrder: 1, createdAt: 1 });

module.exports = {
  HomepageSection: mongoose.models.HomepageSection || mongoose.model('HomepageSection', homepageSectionSchema),
  HOMEPAGE_SECTION_TYPES,
  HOMEPAGE_SECTION_SORTS
};
