const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    tag: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    price: { type: String, trim: true, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    link: { type: String, trim: true, default: '' },
    buttonText: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: true, timestamps: true }
);

const sectionStoreSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
    },
    order: { type: Number, default: 0 },
    badgeMode: {
      type: String,
      enum: ['none', 'manual', 'auto'],
      default: 'none',
    },
    isActive: { type: Boolean, default: true },
  },
  { _id: true, timestamps: true }
);

const homeCardSectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    viewAllText: { type: String, trim: true, default: '' },
    viewAllLink: { type: String, trim: true, default: '' },
    scope: {
      type: String,
      enum: ['all_cities', 'specific_city'],
      default: 'all_cities',
    },
    cityId: { type: String, trim: true, default: '' },
    cityName: { type: String, trim: true, default: '' },
    layout: {
      type: String,
      enum: ['carousel', 'grid'],
      default: 'carousel',
    },
    ctaText: { type: String, trim: true, default: '' },
    ctaLink: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    cards: { type: [cardSchema], default: [] },
    stores: { type: [sectionStoreSchema], default: [] },
  },
  { timestamps: true }
);

function normaliseSlug(slug) {
  return slug
    ? slug
        .toString()
        .trim()
        .replace(/[^\w\u0600-\u06FF\-\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
    : slug;
}

homeCardSectionSchema.pre('validate', function (next) {
  if (this.slug) this.slug = normaliseSlug(this.slug);
  if (this.scope !== 'specific_city') {
    this.cityId = '';
    this.cityName = '';
  }
  next();
});

homeCardSectionSchema.statics.normaliseSlug = normaliseSlug;

module.exports = mongoose.model('HomeCardSection', homeCardSectionSchema);
