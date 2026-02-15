const mongoose = require('mongoose');

const HOMEPAGE_SECTION_TYPES = ['latest', 'category', 'popular', 'discounted'];
const HOMEPAGE_SECTION_SORTS = ['latest', 'oldest', 'price-desc', 'price-asc', 'most-liked'];

const homepageSectionCardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140
    },
    image: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180
    },
    link: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2048
    },
    displayOrder: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  { _id: true, timestamps: false }
);

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
    },
    cards: {
      type: [homepageSectionCardSchema],
      default: []
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
