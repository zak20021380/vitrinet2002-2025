const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    tag: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: String,
      trim: true,
      default: '',
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    link: {
      type: String,
      trim: true,
      default: '',
    },
    buttonText: {
      type: String,
      trim: true,
      default: '',
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

const homeCardSectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    viewAllText: {
      type: String,
      trim: true,
      default: '',
    },
    viewAllLink: {
      type: String,
      trim: true,
      default: '',
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    cards: {
      type: [cardSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
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
  if (this.slug) {
    this.slug = normaliseSlug(this.slug);
  }
  next();
});

homeCardSectionSchema.statics.normaliseSlug = normaliseSlug;

module.exports = mongoose.model('HomeCardSection', homeCardSectionSchema);
