const mongoose = require('mongoose');

const workingHourSchema = new mongoose.Schema({
  day: { type: String, trim: true },
  open: { type: String, default: '' },
  close: { type: String, default: '' },
  isClosed: { type: Boolean, default: false }
}, { _id: false });

const analyticsSchema = new mongoose.Schema({
  totalBookings: { type: Number, default: 0 },
  completedBookings: { type: Number, default: 0 },
  cancelledBookings: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  avgTicketSize: { type: Number, default: 0 },
  ratingAverage: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  customerFollowers: { type: Number, default: 0 },
  lastBookingAt: { type: Date, default: null },
  lastVisitorAt: { type: Date, default: null }
}, { _id: false });

const bookingSettingsSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  instantConfirmation: { type: Boolean, default: false },
  allowWaitlist: { type: Boolean, default: false },
  depositRequired: { type: Boolean, default: false },
  depositAmount: { type: Number, default: 0 },
  cancellationPolicy: { type: String, default: '' },
  timeSlotInterval: { type: Number, default: 30 },
  advanceBookingDays: { type: Number, default: 30 },
  bufferBetweenAppointments: { type: Number, default: 0 }
}, { _id: false });

const performanceSchema = new mongoose.Schema({
  slaBreaches: { type: Number, default: 0 },
  responseTimeMinutes: { type: Number, default: 0 },
  satisfactionScore: { type: Number, default: 0 },
  notes: { type: String, default: '' }
}, { _id: false });

const seoSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  keywords: [{ type: String }],
  schemaMarkup: { type: String, default: '' },
  metaRobots: { type: String, default: 'index,follow' }
}, { _id: false });

const integrationsSchema = new mongoose.Schema({
  website: { type: String, default: '' },
  instagram: { type: String, default: '' },
  telegram: { type: String, default: '' },
  whatsapp: { type: String, default: '' },
  googleBusiness: { type: String, default: '' },
  bookingLink: { type: String, default: '' }
}, { _id: false });

const adminModerationSchema = new mongoose.Schema({
  isBlocked: { type: Boolean, default: false },
  reason: { type: String, default: '' },
  blockedAt: { type: Date, default: null },
  blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  unblockedAt: { type: Date, default: null },
  unblockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  previousStatus: { type: String, default: '' },
  previousIsVisible: { type: Boolean, default: true },
  previousIsBookable: { type: Boolean, default: true },
  previousBookingEnabled: { type: Boolean, default: true }
}, { _id: false });

const geoLocationSchema = new mongoose.Schema({
  lat: { type: Number, default: null },
  lng: { type: Number, default: null }
}, { _id: false });

const complimentaryPlanSchema = new mongoose.Schema({
  isActive: { type: Boolean, default: false },
  durationDays: { type: Number, default: 14 },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  note: { type: String, default: '' },
  planTitle: { type: String, default: '' },
  planSlug: { type: String, default: '' }
}, { _id: false });

const serviceShopSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  shopUrl: { type: String, required: true, lowercase: true, trim: true },
  ownerName: { type: String, default: '', trim: true },
  ownerPhone: { type: String, required: true, trim: true },
  ownerEmail: { type: String, default: '', trim: true },
  category: { type: String, default: '', trim: true },
  subcategories: [{ type: String, trim: true }],
  tags: [{ type: String, trim: true }],
  description: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: '', trim: true },
  province: { type: String, default: '', trim: true },
  geoLocation: { type: geoLocationSchema, default: () => ({}) },
  coverImage: { type: String, default: '' },
  gallery: [{ type: String }],
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'suspended', 'archived'],
    default: 'draft',
    index: true
  },
  isFeatured: { type: Boolean, default: false },
  isBookable: { type: Boolean, default: true },
  isVisible: { type: Boolean, default: true },
  isPremium: { type: Boolean, default: false },
  premiumUntil: { type: Date, default: null },
  complimentaryPlan: { type: complimentaryPlanSchema, default: () => ({}) },
  bookingSettings: { type: bookingSettingsSchema, default: () => ({}) },
  workingHours: { type: [workingHourSchema], default: () => [] },
  serviceAreas: [{ type: String, trim: true }],
  highlightServices: [{ type: String, trim: true }],
  analytics: { type: analyticsSchema, default: () => ({}) },
  performance: { type: performanceSchema, default: () => ({}) },
  seo: { type: seoSchema, default: () => ({}) },
  integrations: { type: integrationsSchema, default: () => ({}) },
  adminModeration: { type: adminModerationSchema, default: () => ({}) },
  notes: { type: String, default: '' },
  lastReviewedAt: { type: Date, default: null },
  legacySellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', default: null, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }
}, { timestamps: true });

serviceShopSchema.index({ shopUrl: 1 }, { unique: true });
serviceShopSchema.index({ city: 1, status: 1 });
serviceShopSchema.index({ tags: 1 });
serviceShopSchema.index({ name: 'text', description: 'text', tags: 'text', city: 'text' });

module.exports = mongoose.models.ServiceShop || mongoose.model('ServiceShop', serviceShopSchema);
