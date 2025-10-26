const mongoose = require('mongoose');
const ServiceShop = require('../models/serviceShop');
const Seller = require('../models/Seller');
const SellerService = require('../models/seller-services');
const ShopAppearance = require('../models/ShopAppearance');
const Booking = require('../models/booking');
const BannedPhone = require('../models/BannedPhone');
const { normalizePhone, buildPhoneCandidates, buildDigitInsensitiveRegex } = require('../utils/phone');

const STATUS_VALUES = ['draft', 'pending', 'approved', 'suspended', 'archived'];

const toNumber = (value, fallback = undefined) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toBoolean = (value, fallback = undefined) => {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === null) return fallback;
  const str = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(str)) return true;
  if (['false', '0', 'no', 'off'].includes(str)) return false;
  return fallback;
};

const escapeRegExp = (str = '') => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseList = (value, { unique = true, limit = 50 } = {}) => {
  if (value == null) return undefined;

  let arr = [];
  if (Array.isArray(value)) {
    arr = value;
  } else if (typeof value === 'string') {
    arr = value
      .split(/[,\n]/)
      .map(item => item.trim());
  }

  const cleaned = arr
    .map(item => (typeof item === 'string' ? item : String(item || '')).trim())
    .filter(Boolean);

  if (!cleaned.length) return [];

  if (!unique) {
    return cleaned.slice(0, limit);
  }

  const seen = new Set();
  const result = [];
  for (const item of cleaned) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
};

const parseDateValue = (value, { allowNull = false } = {}) => {
  if (value == null || value === '') {
    return allowNull ? null : undefined;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw { status: 400, message: 'تاریخ نامعتبر است.' };
  }
  return date;
};

const slugify = (value = '') => {
  const trimmed = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
  return trimmed
    .replace(/[^a-z0-9\u0600-\u06FF-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const parseWorkingHours = (value) => {
  if (value == null || value === '') return undefined;
  const result = [];
  const normalise = (entry) => {
    if (!entry) return null;
    if (typeof entry === 'string') {
      const text = entry.trim();
      if (!text) return null;
      const [dayPart, timePart = ''] = text.split('=');
      const day = (dayPart || '').trim();
      if (!day) return null;
      const lower = timePart.trim().toLowerCase();
      if (!timePart || ['off', 'closed', 'تعطیل', 'بسته'].includes(lower)) {
        return { day, open: '', close: '', isClosed: true };
      }
      const [openRaw = '', closeRaw = ''] = timePart.split('-');
      return {
        day,
        open: openRaw.trim(),
        close: closeRaw.trim(),
        isClosed: false
      };
    }
    if (typeof entry === 'object') {
      const day = String(entry.day || entry.name || entry.title || '').trim();
      if (!day) return null;
      const isClosed = entry.isClosed != null
        ? !!entry.isClosed
        : ['off', 'closed', 'تعطیل', 'بسته'].includes(String(entry.status || '').trim().toLowerCase());
      return {
        day,
        open: String(entry.open || entry.start || '').trim(),
        close: String(entry.close || entry.end || '').trim(),
        isClosed
      };
    }
    return null;
  };

  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = normalise(item);
      if (parsed) result.push(parsed);
    }
  } else if (typeof value === 'string') {
    value
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .forEach(line => {
        const parsed = normalise(line);
        if (parsed) result.push(parsed);
      });
  }

  return result.length ? result.slice(0, 14) : [];
};

const parseGeoLocation = (value, raw = {}) => {
  if (value === null) {
    return { lat: null, lng: null };
  }
  const source = (value && typeof value === 'object') ? value : {};
  const latRaw = source.lat ?? source.latitude ?? raw.lat ?? raw.latitude;
  const lngRaw = source.lng ?? source.longitude ?? raw.lng ?? raw.longitude;
  const lat = latRaw != null ? toNumber(latRaw, null) : undefined;
  const lng = lngRaw != null ? toNumber(lngRaw, null) : undefined;
  if (lat === undefined && lng === undefined) return undefined;
  return {
    lat: lat == null ? null : lat,
    lng: lng == null ? null : lng
  };
};

const parseAnalytics = (value) => {
  if (!value || typeof value !== 'object') return undefined;
  const analytics = {};
  const fields = [
    'totalBookings',
    'completedBookings',
    'cancelledBookings',
    'totalRevenue',
    'avgTicketSize',
    'ratingAverage',
    'ratingCount'
  ];
  fields.forEach((field) => {
    if (value[field] != null && value[field] !== '') {
      analytics[field] = toNumber(value[field], 0) || 0;
    }
  });
  if (value.lastBookingAt != null) {
    analytics.lastBookingAt = parseDateValue(value.lastBookingAt, { allowNull: true });
  }
  if (value.lastVisitorAt != null) {
    analytics.lastVisitorAt = parseDateValue(value.lastVisitorAt, { allowNull: true });
  }
  return Object.keys(analytics).length ? analytics : undefined;
};

const parsePerformance = (value) => {
  if (!value || typeof value !== 'object') return undefined;
  const performance = {};
  if (value.slaBreaches != null) performance.slaBreaches = Math.max(0, toNumber(value.slaBreaches, 0) || 0);
  if (value.responseTimeMinutes != null) performance.responseTimeMinutes = Math.max(0, toNumber(value.responseTimeMinutes, 0) || 0);
  if (value.satisfactionScore != null) performance.satisfactionScore = Math.max(0, toNumber(value.satisfactionScore, 0) || 0);
  if (value.notes != null) performance.notes = String(value.notes || '').trim();
  return Object.keys(performance).length ? performance : undefined;
};

const parseBookingSettings = (value, raw = {}) => {
  const source = (value && typeof value === 'object') ? value : {};
  const booking = {};

  const enabled = toBoolean(source.enabled ?? raw.bookingEnabled, undefined);
  if (enabled !== undefined) booking.enabled = enabled;

  const instant = toBoolean(source.instantConfirmation ?? raw.instantConfirmation, undefined);
  if (instant !== undefined) booking.instantConfirmation = instant;

  const waitlist = toBoolean(source.allowWaitlist ?? raw.allowWaitlist, undefined);
  if (waitlist !== undefined) booking.allowWaitlist = waitlist;

  const depositRequired = toBoolean(source.depositRequired ?? raw.depositRequired, undefined);
  if (depositRequired !== undefined) booking.depositRequired = depositRequired;

  const depositAmountRaw = source.depositAmount ?? raw.depositAmount;
  if (depositAmountRaw != null && depositAmountRaw !== '') {
    booking.depositAmount = Math.max(0, toNumber(depositAmountRaw, 0) || 0);
  }

  const cancellationPolicy = source.cancellationPolicy ?? raw.cancellationPolicy;
  if (cancellationPolicy != null) booking.cancellationPolicy = String(cancellationPolicy || '').trim();

  const slotInterval = source.timeSlotInterval ?? raw.timeSlotInterval;
  if (slotInterval != null && slotInterval !== '') {
    const valueNum = Math.max(5, Math.min(480, toNumber(slotInterval, 30) || 30));
    booking.timeSlotInterval = valueNum;
  }

  const advanceDays = source.advanceBookingDays ?? raw.advanceBookingDays;
  if (advanceDays != null && advanceDays !== '') {
    booking.advanceBookingDays = Math.max(1, Math.min(365, toNumber(advanceDays, 30) || 30));
  }

  const buffer = source.bufferBetweenAppointments ?? raw.bufferBetweenAppointments;
  if (buffer != null && buffer !== '') {
    booking.bufferBetweenAppointments = Math.max(0, Math.min(240, toNumber(buffer, 0) || 0));
  }

  return Object.keys(booking).length ? booking : undefined;
};

const parseSeo = (value) => {
  if (!value) return undefined;
  const seoSource = (typeof value.seo === 'object' && value.seo !== null) ? value.seo : value;
  const seo = {};
  const title = seoSource.title ?? seoSource.seoTitle;
  if (title != null) seo.title = String(title || '').trim();
  const description = seoSource.description ?? seoSource.seoDescription;
  if (description != null) seo.description = String(description || '').trim();
  const keywords = seoSource.keywords ?? seoSource.seoKeywords;
  const parsedKeywords = parseList(keywords, { unique: true, limit: 30 });
  if (parsedKeywords !== undefined) seo.keywords = parsedKeywords;
  if (seoSource.schemaMarkup != null || seoSource.seoSchema != null) {
    seo.schemaMarkup = String(seoSource.schemaMarkup ?? seoSource.seoSchema ?? '').trim();
  }
  if (seoSource.metaRobots != null) {
    seo.metaRobots = String(seoSource.metaRobots || '').trim() || 'index,follow';
  }
  return Object.keys(seo).length ? seo : undefined;
};

const parseIntegrations = (value) => {
  if (!value) return undefined;
  const src = (typeof value.integrations === 'object' && value.integrations !== null)
    ? value.integrations
    : value;
  const integrations = {};
  const fields = {
    website: 'integrationWebsite',
    instagram: 'integrationInstagram',
    telegram: 'integrationTelegram',
    whatsapp: 'integrationWhatsapp',
    googleBusiness: 'integrationGoogle',
    bookingLink: 'integrationBooking'
  };
  Object.entries(fields).forEach(([field, alias]) => {
    if (src[field] != null) {
      integrations[field] = String(src[field] || '').trim();
    } else if (value[alias] != null) {
      integrations[field] = String(value[alias] || '').trim();
    }
  });
  return Object.keys(integrations).length ? integrations : undefined;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const clampComplimentaryDuration = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw { status: 400, message: 'مدت پلن رایگان باید بزرگتر از صفر باشد.' };
  }
  return Math.min(Math.round(num), 365);
};

const normaliseComplimentaryPlan = (plan = {}) => {
  const normalized = {
    isActive: !!plan.isActive,
    note: String(plan.note || '').trim()
  };

  const start = plan.startDate instanceof Date
    ? plan.startDate
    : (plan.startDate ? new Date(plan.startDate) : null);
  const end = plan.endDate instanceof Date
    ? plan.endDate
    : (plan.endDate ? new Date(plan.endDate) : null);

  normalized.startDate = (start && !Number.isNaN(start.getTime())) ? start : null;
  normalized.endDate = (end && !Number.isNaN(end.getTime())) ? end : null;

  const duration = clampComplimentaryDuration(plan.durationDays);
  normalized.durationDays = duration ?? null;

  if (normalized.startDate && normalized.durationDays && !normalized.endDate) {
    normalized.endDate = new Date(normalized.startDate.getTime() + normalized.durationDays * MS_PER_DAY);
  }

  if (normalized.endDate && normalized.durationDays && !normalized.startDate) {
    normalized.startDate = new Date(normalized.endDate.getTime() - normalized.durationDays * MS_PER_DAY);
  }

  if (normalized.startDate && normalized.endDate && normalized.durationDays == null) {
    const diff = Math.round((normalized.endDate - normalized.startDate) / MS_PER_DAY);
    normalized.durationDays = diff > 0 ? diff : 1;
  }

  return normalized;
};

const extractComplimentarySource = (value) => {
  if (!value || typeof value !== 'object') return null;
  if (value.complimentaryPlan && typeof value.complimentaryPlan === 'object') {
    return value.complimentaryPlan;
  }
  return value;
};

const parseComplimentaryPlan = (value, { existing = null, partial = false } = {}) => {
  const source = extractComplimentarySource(value);
  if (!source) {
    return (!partial && existing) ? normaliseComplimentaryPlan(existing) : undefined;
  }

  const base = existing ? { ...existing } : {};
  let changed = false;

  if (!partial && Object.keys(base).length === 0) {
    base.isActive = false;
    base.durationDays = null;
    base.startDate = null;
    base.endDate = null;
    base.note = '';
  }

  if (source.isActive !== undefined) {
    base.isActive = !!toBoolean(source.isActive, source.isActive);
    changed = true;
  }

  if (source.startDate !== undefined) {
    base.startDate = parseDateValue(source.startDate, { allowNull: true }) ?? null;
    changed = true;
  }

  if (source.endDate !== undefined) {
    base.endDate = parseDateValue(source.endDate, { allowNull: true }) ?? null;
    changed = true;
  }

  if (source.durationDays !== undefined) {
    base.durationDays = clampComplimentaryDuration(source.durationDays);
    changed = true;
  }

  if (source.note !== undefined) {
    base.note = String(source.note || '').trim();
    changed = true;
  }

  if (!changed && partial) {
    return undefined;
  }

  return normaliseComplimentaryPlan(base);
};

function normalizePayload(raw = {}, { partial = false, existing = null } = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  const data = {};

  if (!partial || raw.name != null) {
    const name = String(raw.name || '').trim();
    if (!name && !partial) {
      throw { status: 400, message: 'نام مغازه الزامی است.' };
    }
    if (name) data.name = name;
  }

  if (!partial || raw.shopUrl != null) {
    const inputSlug = raw.shopUrl != null ? String(raw.shopUrl || '') : String(raw.name || '');
    const slug = slugify(inputSlug);
    if (!slug && !partial) {
      throw { status: 400, message: 'شناسه آدرس فروشگاه الزامی است.' };
    }
    if (slug) data.shopUrl = slug;
  }

  if (!partial || raw.ownerPhone != null) {
    const phone = String(raw.ownerPhone || raw.phone || '').trim();
    if (!phone && !partial) {
      throw { status: 400, message: 'شماره تماس الزامی است.' };
    }
    if (phone) data.ownerPhone = phone;
  }

  if (raw.ownerName != null) data.ownerName = String(raw.ownerName || '').trim();
  if (raw.ownerEmail != null) data.ownerEmail = String(raw.ownerEmail || '').trim();
  if (raw.category != null) data.category = String(raw.category || '').trim();
  if (raw.description != null) data.description = String(raw.description || '').trim();
  if (raw.address != null) data.address = String(raw.address || '').trim();
  if (raw.city != null) data.city = String(raw.city || '').trim();
  if (raw.province != null) data.province = String(raw.province || '').trim();
  if (raw.coverImage != null) data.coverImage = String(raw.coverImage || '').trim();
  if (raw.notes != null) data.notes = String(raw.notes || '').trim();

  const subcategories = parseList(raw.subcategories, { unique: true, limit: 30 });
  if (subcategories !== undefined) data.subcategories = subcategories;
  const tags = parseList(raw.tags, { unique: true, limit: 40 });
  if (tags !== undefined) data.tags = tags;
  const serviceAreas = parseList(raw.serviceAreas, { unique: true, limit: 40 });
  if (serviceAreas !== undefined) data.serviceAreas = serviceAreas;
  const highlightServices = parseList(raw.highlightServices, { unique: true, limit: 40 });
  if (highlightServices !== undefined) data.highlightServices = highlightServices;
  const gallery = parseList(raw.gallery, { unique: false, limit: 12 });
  if (gallery !== undefined) data.gallery = gallery;

  const geoLocation = parseGeoLocation(raw.geoLocation, raw);
  if (geoLocation !== undefined) data.geoLocation = geoLocation;

  const workingHours = parseWorkingHours(raw.workingHours ?? raw.schedule);
  if (workingHours !== undefined) data.workingHours = workingHours;

  if (raw.status != null) {
    const status = String(raw.status || '').trim().toLowerCase();
    if (!STATUS_VALUES.includes(status)) {
      throw { status: 400, message: 'وضعیت انتخاب‌شده معتبر نیست.' };
    }
    data.status = status;
  }

  ['isFeatured', 'isBookable', 'isVisible', 'isPremium'].forEach((field) => {
    if (raw[field] != null) {
      data[field] = !!toBoolean(raw[field], raw[field]);
    }
  });

  if (raw.premiumUntil !== undefined) {
    data.premiumUntil = parseDateValue(raw.premiumUntil, { allowNull: true });
  }

  const bookingSettings = parseBookingSettings(raw.bookingSettings, raw);
  if (bookingSettings) data.bookingSettings = bookingSettings;

  const analytics = parseAnalytics(raw.analytics);
  if (analytics) data.analytics = analytics;

  const performance = parsePerformance(raw.performance);
  if (performance) data.performance = performance;

  const seo = parseSeo(raw);
  if (seo) data.seo = seo;

  const integrations = parseIntegrations(raw);
  if (integrations) data.integrations = integrations;

  const existingPlan = existing?.complimentaryPlan
    ? (typeof existing.complimentaryPlan.toObject === 'function'
        ? existing.complimentaryPlan.toObject()
        : { ...existing.complimentaryPlan })
    : null;
  const complimentaryPlan = parseComplimentaryPlan(raw.complimentaryPlan ?? raw, {
    existing: existingPlan,
    partial
  });
  if (complimentaryPlan !== undefined) {
    data.complimentaryPlan = complimentaryPlan;
  }

  if (raw.lastReviewedAt !== undefined) {
    data.lastReviewedAt = parseDateValue(raw.lastReviewedAt, { allowNull: true }) ?? new Date();
  }

  return data;
}

const SERVICE_CATEGORY_REGEX = /(خدمات|service|سرویس)/i;

const PERSIAN_DIGITS_MAP = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9'
};

const ARABIC_DIGITS_MAP = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9'
};

const normaliseDigits = (value = '') => String(value || '')
  .replace(/[۰-۹]/g, d => PERSIAN_DIGITS_MAP[d] || d)
  .replace(/[٠-٩]/g, d => ARABIC_DIGITS_MAP[d] || d);

const normaliseText = (value = '') => normaliseDigits(value).toLowerCase().trim();

const containsNormalized = (haystack, needle) => {
  const search = normaliseText(needle);
  if (!search) return true;
  return normaliseText(haystack).includes(search);
};

const coerceDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const extractCity = (address = '') => {
  const text = normaliseDigits(String(address || '').trim());
  if (!text) return '';
  const separators = ['،', ',', '\n', '-', '|', '؛'];
  for (const sep of separators) {
    const parts = text.split(sep).map(part => part.trim()).filter(Boolean);
    if (parts.length) {
      const candidate = parts[0];
      if (candidate.length <= 40) return candidate;
    }
  }
  return text.split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
};

const parseLegacyList = (value) => {
  if (!value) return [];
  const source = Array.isArray(value)
    ? value
    : String(value)
      .split(/[،,\n]/);
  return source
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 20);
};

const mapLegacySellerToItem = (seller, { appearance, services = [], booking = {} } = {}) => {
  if (!seller) return null;

  const serviceTitles = Array.isArray(services)
    ? services.filter(Boolean)
    : [];
  const highlightServices = serviceTitles.slice(0, 5);
  const subcategories = parseLegacyList(seller.subcategory);
  const ownerName = [seller.firstname, seller.lastname]
    .map(part => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
  const appearanceName = appearance?.shopLogoText ? String(appearance.shopLogoText).trim() : '';
  const name = String(seller.storename || appearanceName || ownerName || serviceTitles[0] || 'بدون نام').trim();
  const shopUrl = String(appearance?.customUrl || seller.shopurl || '').trim();
  const address = String(appearance?.shopAddress || seller.address || '').trim();
  const city = extractCity(address);
  const updatedAt = coerceDate(seller.updatedAt)
    || coerceDate(appearance?.updatedAt)
    || coerceDate(booking.lastBookingAt)
    || coerceDate(seller.createdAt)
    || new Date();
  const createdAt = coerceDate(seller.createdAt) || new Date();
  const premiumUntil = coerceDate(seller.premiumUntil);
  const ratingAverage = Number(appearance?.averageRating ?? 0) || 0;
  const ratingCount = Number(appearance?.ratingCount ?? 0) || 0;
  const isBlockedByAdmin = !!seller.blockedByAdmin;
  const baseBookable = serviceTitles.length > 0;
  const blockedAt = coerceDate(seller.blockedAt) || coerceDate(seller.updatedAt) || null;
  const adminModeration = {
    isBlocked: isBlockedByAdmin,
    reason: String(seller.blockedReason || '').trim(),
    blockedAt,
    blockedBy: seller.blockedBy || null,
    unblockedAt: null,
    unblockedBy: null,
    previousStatus: isBlockedByAdmin ? 'approved' : '',
    previousIsVisible: !isBlockedByAdmin,
    previousIsBookable: baseBookable,
    previousBookingEnabled: baseBookable
  };

  return {
    _id: seller._id,
    legacySellerId: seller._id,
    name,
    shopUrl,
    ownerName: ownerName || name,
    ownerPhone: String(seller.phone || appearance?.shopPhone || '').trim(),
    address,
    city,
    province: '',
    category: seller.category || 'خدماتی',
    subcategories,
    tags: [...new Set([...subcategories, ...highlightServices])],
    description: seller.desc || '',
    status: isBlockedByAdmin ? 'suspended' : 'approved',
    isVisible: !isBlockedByAdmin,
    isBookable: isBlockedByAdmin ? false : baseBookable,
    isFeatured: false,
    isPremium: !!seller.isPremium,
    premiumUntil,
    complimentaryPlan: {
      isActive: false,
      durationDays: null,
      startDate: null,
      endDate: null,
      note: ''
    },
    bookingSettings: { enabled: isBlockedByAdmin ? false : baseBookable },
    analytics: {
      totalBookings: booking.total || 0,
      completedBookings: booking.completed || 0,
      cancelledBookings: booking.cancelled || 0,
      pendingBookings: booking.pending || 0,
      totalRevenue: 0,
      ratingAverage,
      ratingCount,
      lastBookingAt: coerceDate(booking.lastBookingAt)
    },
    highlightServices,
    serviceAreas: [],
    createdAt,
    updatedAt,
    integrations: {},
    notes: '',
    legacySource: 'seller',
    adminModeration
  };
};

const buildComplimentaryPlanPayload = (shop) => {
  const plan = shop?.complimentaryPlan || {};
  const start = coerceDate(plan.startDate);
  const end = coerceDate(plan.endDate);
  const now = new Date();

  const rawDuration = Number(plan.durationDays);
  const duration = Number.isFinite(rawDuration) && rawDuration > 0
    ? Math.max(1, Math.round(rawDuration))
    : (start && end ? Math.max(1, Math.round((end - start) / MS_PER_DAY)) : null);

  let usedDays = null;
  if (start) {
    const effectiveEnd = end && end < now ? end : now;
    usedDays = Math.max(0, Math.round((effectiveEnd - start) / MS_PER_DAY));
  }

  if (duration != null && usedDays != null) {
    usedDays = Math.min(usedDays, duration);
  }

  const remainingDays = end ? Math.max(0, Math.ceil((end - now) / MS_PER_DAY)) : null;

  return {
    isActive: !!plan.isActive,
    activeNow: !!plan.isActive && (!end || end >= now),
    startDate: start ? start.toISOString() : null,
    endDate: end ? end.toISOString() : null,
    durationDays: duration,
    note: plan.note || '',
    remainingDays,
    usedDays,
    totalDays: duration,
    hasExpired: !!plan.isActive && !!end && end < now
  };
};

async function fetchLegacyServiceShopsItems() {
  const sellers = await Seller.find({
    $or: [
      { category: { $regex: SERVICE_CATEGORY_REGEX } },
      { subcategory: { $regex: SERVICE_CATEGORY_REGEX } }
    ]
  }).sort({ updatedAt: -1 }).lean();

  if (!sellers.length) return [];

  const sellerIds = sellers.map(seller => seller._id);

  const [appearances, services, bookingStats] = await Promise.all([
    ShopAppearance.find({ sellerId: { $in: sellerIds } }).lean(),
    SellerService.find({ sellerId: { $in: sellerIds } }).select('sellerId title').lean(),
    Booking.aggregate([
      { $match: { sellerId: { $in: sellerIds } } },
      {
        $group: {
          _id: '$sellerId',
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
            }
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
            }
          },
          lastBookingAt: { $max: '$createdAt' }
        }
      }
    ])
  ]);

  const appearanceMap = new Map();
  appearances.forEach((item) => {
    if (item?.sellerId) {
      appearanceMap.set(String(item.sellerId), item);
    }
  });

  const servicesMap = new Map();
  services.forEach((service) => {
    const key = String(service.sellerId);
    if (!servicesMap.has(key)) servicesMap.set(key, []);
    if (service?.title) {
      servicesMap.get(key).push(service.title);
    }
  });

  const bookingMap = new Map();
  bookingStats.forEach((stat) => {
    bookingMap.set(String(stat._id), {
      total: stat.total || 0,
      completed: stat.completed || 0,
      cancelled: stat.cancelled || 0,
      pending: stat.pending || 0,
      lastBookingAt: stat.lastBookingAt || null
    });
  });

  return sellers
    .map((seller) => mapLegacySellerToItem(seller, {
      appearance: appearanceMap.get(String(seller._id)),
      services: servicesMap.get(String(seller._id)) || [],
      booking: bookingMap.get(String(seller._id)) || {}
    }))
    .filter(Boolean);
}

const matchesLegacyFilters = (item, filters = {}) => {
  if (!item) return false;
  if (filters.search) {
    const haystack = [
      item.name,
      item.shopUrl,
      item.ownerName,
      item.ownerPhone,
      item.address,
      item.city,
      item.category,
      ...(item.highlightServices || []),
      ...(item.subcategories || []),
      ...(item.tags || [])
    ].join(' \u200c ');
    if (!containsNormalized(haystack, filters.search)) {
      return false;
    }
  }

  if (filters.status && filters.status !== 'all') {
    if ((item.status || '').toLowerCase() !== filters.status) {
      return false;
    }
  }

  if (filters.city) {
    const cityMatch = containsNormalized(item.city || '', filters.city)
      || containsNormalized(item.address || '', filters.city);
    if (!cityMatch) return false;
  }

  if (filters.category) {
    const categorySources = [
      item.category,
      item.subcategory,
      ...(Array.isArray(item.subcategories) ? item.subcategories : []),
      ...(Array.isArray(item.tags) ? item.tags : [])
    ];
    const categoryMatch = categorySources.some((value) => containsNormalized(value || '', filters.category));
    if (!categoryMatch) return false;
  }

  if (typeof filters.isPremium === 'boolean') {
    if (!!item.isPremium !== filters.isPremium) return false;
  }

  if (typeof filters.bookingEnabled === 'boolean') {
    const enabled = !!item?.bookingSettings?.enabled;
    if (enabled !== filters.bookingEnabled) return false;
  }

  if (typeof filters.isFeatured === 'boolean') {
    if (!!item.isFeatured !== filters.isFeatured) return false;
  }

  if (typeof filters.visible === 'boolean') {
    const isVisible = item.isVisible !== false;
    if (isVisible !== filters.visible) return false;
  }

  return true;
};

const buildLegacyStatusCounts = (items = []) => {
  return items.reduce((acc, item) => {
    const key = item?.status || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
};

const computeLegacyTotals = (items = []) => {
  const now = new Date();
  const totals = {
    total: 0,
    active: 0,
    pending: 0,
    suspended: 0,
    archived: 0,
    featured: 0,
    bookingEnabled: 0,
    premiumActive: 0
  };

  items.forEach((item) => {
    if (!item) return;
    totals.total += 1;
    const status = (item.status || '').toLowerCase();
    if (status === 'approved' && item.isVisible !== false) totals.active += 1;
    if (status === 'pending') totals.pending += 1;
    if (status === 'suspended') totals.suspended += 1;
    if (status === 'archived') totals.archived += 1;
    if (item.isFeatured) totals.featured += 1;
    if (item?.bookingSettings?.enabled) totals.bookingEnabled += 1;
    if (item.isPremium) {
      const until = coerceDate(item.premiumUntil);
      if (!until || until > now) {
        totals.premiumActive += 1;
      }
    }
  });

  return totals;
};

const mergeOverviewTotals = (...sources) => {
  const base = {
    total: 0,
    active: 0,
    pending: 0,
    suspended: 0,
    archived: 0,
    featured: 0,
    bookingEnabled: 0,
    premiumActive: 0
  };

  sources.forEach((source) => {
    if (!source) return;
    Object.keys(base).forEach((key) => {
      const value = Number(source[key]);
      if (Number.isFinite(value)) {
        base[key] += value;
      }
    });
  });

  return base;
};

const sortByRecentActivityDesc = (a, b) => {
  const resolveDate = (item) => {
    return coerceDate(item?.updatedAt)
      || coerceDate(item?.analytics?.lastBookingAt)
      || coerceDate(item?.createdAt)
      || null;
  };

  const aTime = resolveDate(a)?.getTime() || 0;
  const bTime = resolveDate(b)?.getTime() || 0;
  return bTime - aTime;
};

const buildLegacyOverviewData = async (existingItems) => {
  const items = Array.isArray(existingItems) ? existingItems : await fetchLegacyServiceShopsItems();
  if (!items.length) {
    return {
      totals: {
        total: 0,
        active: 0,
        pending: 0,
        suspended: 0,
        archived: 0,
        featured: 0,
        bookingEnabled: 0,
        premiumActive: 0
      },
      statusCounts: {},
      topCities: [],
      topCategories: [],
      recent: []
    };
  }

  const totals = computeLegacyTotals(items);
  const statusCounts = buildLegacyStatusCounts(items);

  const cityCounter = new Map();
  items.forEach((item) => {
    const city = normaliseText(item.city || '');
    if (!city) return;
    cityCounter.set(city, {
      _id: item.city,
      count: (cityCounter.get(city)?.count || 0) + 1
    });
  });

  const topCities = Array.from(cityCounter.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const categoryCounter = new Map();
  items.forEach((item) => {
    const categories = (item.subcategories && item.subcategories.length)
      ? item.subcategories
      : [item.category];
    categories.filter(Boolean).forEach((cat) => {
      const key = normaliseText(cat);
      if (!key) return;
      categoryCounter.set(key, {
        _id: cat,
        count: (categoryCounter.get(key)?.count || 0) + 1
      });
    });
  });

  const topCategories = Array.from(categoryCounter.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const recent = items
    .slice()
    .sort((a, b) => {
      const aDate = coerceDate(a.updatedAt) || coerceDate(a.createdAt) || new Date(0);
      const bDate = coerceDate(b.updatedAt) || coerceDate(b.createdAt) || new Date(0);
      return bDate - aDate;
    })
    .slice(0, 6)
    .map((item) => ({
      name: item.name,
      status: item.status,
      city: item.city,
      ownerName: item.ownerName,
      ownerPhone: item.ownerPhone,
      isPremium: item.isPremium,
      bookingSettings: item.bookingSettings,
      updatedAt: coerceDate(item.updatedAt) || coerceDate(item.createdAt),
      shopUrl: item.shopUrl
    }));

  return {
    totals,
    statusCounts,
    topCities,
    topCategories,
    recent
  };
};

async function buildLegacyServiceShopBySellerId(id) {
  const seller = await Seller.findById(id).lean();
  if (!seller) return null;
  const categoryText = `${seller.category || ''} ${seller.subcategory || ''}`;
  if (!SERVICE_CATEGORY_REGEX.test(categoryText)) return null;

  const [appearance, services, bookingStats] = await Promise.all([
    ShopAppearance.findOne({ sellerId: seller._id }).lean(),
    SellerService.find({ sellerId: seller._id }).select('title').lean(),
    Booking.aggregate([
      { $match: { sellerId: seller._id } },
      {
        $group: {
          _id: '$sellerId',
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
            }
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
            }
          },
          lastBookingAt: { $max: '$createdAt' }
        }
      }
    ])
  ]);

  const booking = bookingStats && bookingStats.length ? bookingStats[0] : {};

  return mapLegacySellerToItem(seller, {
    appearance,
    services: services.map(service => service.title).filter(Boolean),
    booking
  });
}

const toPlainDocument = (doc, fallback = {}) => {
  if (!doc) return { ...fallback };
  if (typeof doc.toObject === 'function') {
    return { ...fallback, ...doc.toObject() };
  }
  if (typeof doc.toJSON === 'function') {
    return { ...fallback, ...doc.toJSON() };
  }
  return { ...fallback, ...doc };
};

const toPlainSubdocument = (value, fallback = {}) => {
  if (!value) return { ...fallback };
  if (typeof value.toObject === 'function') {
    return { ...fallback, ...value.toObject() };
  }
  return { ...fallback, ...value };
};

async function findOrCreateServiceShop(id, adminId = null) {
  let shop = await ServiceShop.findById(id);
  let createdFromLegacy = false;
  if (!shop) {
    const legacyShop = await buildLegacyServiceShopBySellerId(id);
    if (!legacyShop) {
      return { shop: null, createdFromLegacy: false };
    }

    const fallbackShopUrl = legacyShop.shopUrl && String(legacyShop.shopUrl).trim()
      ? legacyShop.shopUrl.trim().toLowerCase()
      : `legacy-${id}`;

    shop = new ServiceShop({
      ...legacyShop,
      _id: new mongoose.Types.ObjectId(id),
      shopUrl: fallbackShopUrl,
      createdBy: adminId || null,
      updatedBy: adminId || null,
      lastReviewedAt: new Date()
    });
    createdFromLegacy = true;
  }

  return { shop, createdFromLegacy };
}

async function findSellerForShop({ shop, providedSellerId, fallbackId }) {
  const candidates = [];
  const seen = new Set();
  const pushCandidate = (value) => {
    if (!value) return;
    const idStr = String(value);
    if (!mongoose.Types.ObjectId.isValid(idStr)) return;
    if (seen.has(idStr)) return;
    seen.add(idStr);
    candidates.push(idStr);
  };

  pushCandidate(providedSellerId);
  pushCandidate(shop?.legacySellerId);
  pushCandidate(fallbackId);

  for (const candidate of candidates) {
    const seller = await Seller.findById(candidate);
    if (seller) return seller;
  }

  if (shop?.ownerPhone) {
    const sellerByPhone = await Seller.findOne({ phone: shop.ownerPhone });
    if (sellerByPhone) return sellerByPhone;
  }

  if (shop?.shopUrl) {
    const sellerBySlug = await Seller.findOne({ shopurl: shop.shopUrl });
    if (sellerBySlug) return sellerBySlug;
  }

  return null;
}

const applyAdminBlock = async ({ shop, seller, adminId = null, reason = '' }) => {
  const now = new Date();
  const cleanReason = String(reason || '').trim();
  let savedSeller = null;
  let savedShop = null;

  if (seller) {
    seller.blockedByAdmin = true;
    seller.blockedAt = now;
    seller.blockedBy = adminId || null;
    seller.blockedReason = cleanReason;
    savedSeller = await seller.save();

    const sellerPhone = savedSeller?.phone || seller.phone;
    if (sellerPhone) {
      const normalizedPhone = normalizePhone(sellerPhone);
      if (normalizedPhone) {
        const regex = buildDigitInsensitiveRegex(sellerPhone, { allowSeparators: true });
        const sellerId = savedSeller?._id || seller._id;
        const query = {};
        if (sellerId) {
          query._id = { $ne: sellerId };
        }
        if (regex) {
          query.phone = { $regex: regex };
        } else {
          query.phone = normalizedPhone;
        }

        const duplicates = await Seller.countDocuments(query);
        if (duplicates > 0) {
          console.warn(`Skipping phone ban for seller ${sellerId} because phone is shared with ${duplicates} other seller(s).`);
        } else {
          await BannedPhone.updateOne(
            { phone: normalizedPhone },
            {
              $set: {
                phone: normalizedPhone,
                reason: cleanReason || 'blocked-by-admin'
              }
            },
            { upsert: true }
          );
        }
      }
    }
  }

  if (shop) {
    const moderation = toPlainSubdocument(shop.adminModeration, {
      previousStatus: '',
      previousIsVisible: true,
      previousIsBookable: true,
      previousBookingEnabled: true
    });

    moderation.previousStatus = shop.status || moderation.previousStatus || 'approved';
    if (shop.isVisible !== undefined) {
      moderation.previousIsVisible = !!shop.isVisible;
    }
    if (shop.isBookable !== undefined) {
      moderation.previousIsBookable = !!shop.isBookable;
    }
    if (shop.bookingSettings && typeof shop.bookingSettings === 'object' && 'enabled' in shop.bookingSettings) {
      moderation.previousBookingEnabled = !!shop.bookingSettings.enabled;
    }

    moderation.isBlocked = true;
    moderation.reason = cleanReason;
    moderation.blockedAt = now;
    moderation.blockedBy = adminId || null;
    moderation.unblockedAt = null;
    moderation.unblockedBy = null;

    shop.status = 'suspended';
    shop.isVisible = false;
    shop.isBookable = false;
    if (!shop.bookingSettings || typeof shop.bookingSettings !== 'object') {
      shop.bookingSettings = { enabled: false };
    } else {
      shop.bookingSettings.enabled = false;
    }
    shop.updatedBy = adminId || shop.updatedBy || null;
    shop.lastReviewedAt = now;
    shop.set('adminModeration', moderation);

    savedShop = await shop.save();
  }

  return { shop: savedShop, seller: savedSeller };
};

const applyAdminUnblock = async ({ shop, seller, adminId = null, reason = null }) => {
  const now = new Date();
  const cleanReason = reason == null ? null : String(reason).trim();
  let savedSeller = null;
  let savedShop = null;
  const phoneCandidates = new Set();

  if (seller) {
    seller.blockedByAdmin = false;
    seller.blockedAt = null;
    seller.blockedBy = null;
    if (cleanReason !== null) {
      seller.blockedReason = cleanReason;
    }
    savedSeller = await seller.save();

    const sellerPhone = savedSeller?.phone || seller.phone;
    if (sellerPhone) {
      buildPhoneCandidates(sellerPhone).forEach((candidate) => {
        if (candidate) phoneCandidates.add(candidate);
      });
    }
  }

  if (shop?.ownerPhone) {
    buildPhoneCandidates(shop.ownerPhone).forEach((candidate) => {
      if (candidate) phoneCandidates.add(candidate);
    });
  }

  if (shop) {
    const moderation = toPlainSubdocument(shop.adminModeration, {
      previousStatus: 'approved',
      previousIsVisible: true,
      previousIsBookable: true,
      previousBookingEnabled: true
    });

    const targetStatus = moderation.previousStatus && STATUS_VALUES.includes(moderation.previousStatus)
      ? moderation.previousStatus
      : 'approved';
    const targetVisible = typeof moderation.previousIsVisible === 'boolean'
      ? moderation.previousIsVisible
      : true;
    const targetBookable = typeof moderation.previousIsBookable === 'boolean'
      ? moderation.previousIsBookable
      : true;
    const targetBookingEnabled = typeof moderation.previousBookingEnabled === 'boolean'
      ? moderation.previousBookingEnabled
      : undefined;

    shop.status = targetStatus;
    shop.isVisible = targetVisible;
    shop.isBookable = targetBookable;
    if (targetBookingEnabled !== undefined) {
      if (!shop.bookingSettings || typeof shop.bookingSettings !== 'object') {
        shop.bookingSettings = { enabled: targetBookingEnabled };
      } else {
        shop.bookingSettings.enabled = targetBookingEnabled;
      }
    }

    moderation.isBlocked = false;
    moderation.unblockedAt = now;
    moderation.unblockedBy = adminId || null;
    if (cleanReason !== null) {
      moderation.reason = cleanReason;
    }
    moderation.previousStatus = shop.status;
    moderation.previousIsVisible = shop.isVisible;
    moderation.previousIsBookable = shop.isBookable;
    if (shop.bookingSettings && typeof shop.bookingSettings === 'object' && 'enabled' in shop.bookingSettings) {
      moderation.previousBookingEnabled = !!shop.bookingSettings.enabled;
    }

    shop.updatedBy = adminId || shop.updatedBy || null;
    shop.lastReviewedAt = now;
    shop.set('adminModeration', moderation);

    savedShop = await shop.save();
  }

  if (phoneCandidates.size) {
    for (const phone of phoneCandidates) {
      if (!phone) continue;

      const normalized = normalizePhone(phone);
      const phoneRegex = buildDigitInsensitiveRegex(phone, { allowSeparators: true });
      const query = { blockedByAdmin: true };
      if (seller?._id) {
        query._id = { $ne: seller._id };
      }
      if (phoneRegex) {
        query.phone = { $regex: phoneRegex };
      } else if (normalized) {
        query.phone = normalized;
      } else {
        continue;
      }

      const stillBlocked = await Seller.exists(query);
      if (stillBlocked) {
        continue;
      }

      const variants = new Set();
      buildPhoneCandidates(phone).forEach((candidate) => {
        if (candidate) variants.add(candidate);
        const norm = normalizePhone(candidate);
        if (norm) variants.add(norm);
      });
      if (variants.size) {
        await BannedPhone.deleteMany({ phone: { $in: Array.from(variants) } });
      }
    }
  }

  return { shop: savedShop, seller: savedSeller };
};

const buildStatusCounts = (rows = []) => {
  return rows.reduce((acc, row) => {
    if (row && row._id) {
      acc[row._id] = row.count;
    }
    return acc;
  }, {});
};

async function buildOverview() {
  const total = await ServiceShop.countDocuments({});
  if (total === 0) {
    return buildLegacyOverviewData();
  }

  const now = new Date();
  const soon = new Date(now.getTime() + 7 * MS_PER_DAY);
  const [
    active,
    pending,
    suspended,
    archived,
    featured,
    bookingEnabled,
    premiumActive,
    complimentaryActive,
    complimentaryActiveNow,
    complimentaryExpiringSoon,
    complimentaryExpired,
    statusAggregation,
    topCities,
    topCategories,
    recent
  ] = await Promise.all([
    ServiceShop.countDocuments({ status: 'approved', isVisible: true }),
    ServiceShop.countDocuments({ status: 'pending' }),
    ServiceShop.countDocuments({ status: 'suspended' }),
    ServiceShop.countDocuments({ status: 'archived' }),
    ServiceShop.countDocuments({ isFeatured: true }),
    ServiceShop.countDocuments({ 'bookingSettings.enabled': true }),
    ServiceShop.countDocuments({ isPremium: true, premiumUntil: { $gt: now } }),
    ServiceShop.countDocuments({ 'complimentaryPlan.isActive': true }),
    ServiceShop.countDocuments({
      'complimentaryPlan.isActive': true,
      $and: [
        {
          $or: [
            { 'complimentaryPlan.startDate': { $exists: false } },
            { 'complimentaryPlan.startDate': null },
            { 'complimentaryPlan.startDate': { $lte: now } }
          ]
        },
        {
          $or: [
            { 'complimentaryPlan.endDate': { $exists: false } },
            { 'complimentaryPlan.endDate': null },
            { 'complimentaryPlan.endDate': { $gte: now } }
          ]
        }
      ]
    }),
    ServiceShop.countDocuments({
      'complimentaryPlan.isActive': true,
      'complimentaryPlan.endDate': { $gte: now, $lte: soon }
    }),
    ServiceShop.countDocuments({
      'complimentaryPlan.isActive': true,
      'complimentaryPlan.endDate': { $lt: now }
    }),
    ServiceShop.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    ServiceShop.aggregate([
      { $match: { city: { $exists: true, $ne: '' } } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 }
    ]),
    ServiceShop.aggregate([
      { $match: { category: { $exists: true, $ne: '' } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 }
    ]),
    ServiceShop.find({})
      .sort({ updatedAt: -1 })
      .limit(6)
      .select('name status city ownerName ownerPhone isPremium bookingSettings updatedAt createdAt shopUrl')
      .lean()
  ]);

  return {
    totals: {
      total,
      active,
      pending,
      suspended,
      archived,
      featured,
      bookingEnabled,
      premiumActive,
      complimentaryActive,
      complimentaryActiveNow,
      complimentaryExpiringSoon,
      complimentaryExpired
    },
    statusCounts: buildStatusCounts(statusAggregation),
    topCities,
    topCategories,
    recent
  };
}

exports.getOverview = async (req, res) => {
  try {
    const overview = await buildOverview();
    res.json(overview);
  } catch (err) {
    console.error('serviceShops.getOverview error:', err);
    res.status(500).json({ message: 'خطا در دریافت نمای کلی.', error: err.message || err });
  }
};

exports.listServiceShops = async (req, res) => {
  try {
    const page = Math.max(1, toNumber(req.query.page, 1) || 1);
    const limit = Math.min(100, Math.max(1, toNumber(req.query.limit, 20) || 20));
    const skip = (page - 1) * limit;

    const search = String(req.query.q || req.query.search || '').trim();
    const status = String(req.query.status || '').trim().toLowerCase();
    const city = String(req.query.city || '').trim();
    const category = String(req.query.category || '').trim();

    const planStatus = String(req.query.planStatus || req.query.plan || '').trim().toLowerCase();

    const legacyFilters = {
      search,
      status: status && STATUS_VALUES.includes(status) ? status : '',
      city,
      category,
      isPremium: req.query.isPremium != null ? toBoolean(req.query.isPremium, false) : undefined,
      bookingEnabled: req.query.bookingEnabled != null ? toBoolean(req.query.bookingEnabled, false) : undefined,
      isFeatured: req.query.isFeatured != null ? toBoolean(req.query.isFeatured, false) : undefined,
      visible: req.query.visible != null ? toBoolean(req.query.visible, true) : undefined
    };

    let includeLegacy = req.query.includeLegacy == null
      ? true
      : !!toBoolean(req.query.includeLegacy, true);

    if (planStatus) {
      includeLegacy = false;
    }

    const useLegacy = (await ServiceShop.countDocuments({})) === 0;

    if (useLegacy) {
      const allItems = await fetchLegacyServiceShopsItems();
      const filteredItems = allItems.filter(item => matchesLegacyFilters(item, legacyFilters));
      const total = filteredItems.length;
      const pages = total > 0 ? Math.ceil(total / limit) : 0;
      const items = total > 0 ? filteredItems.slice(skip, skip + limit) : [];
      const statusCounts = buildLegacyStatusCounts(filteredItems);
      const overview = await buildLegacyOverviewData(allItems);

      return res.json({
        items,
        pagination: {
          page,
          limit,
          total,
          pages
        },
        summary: {
          total,
          statusCounts,
          totals: overview.totals
        }
      });
    }

    const filterConditions = [];
    if (search) {
      const regex = new RegExp(escapeRegExp(search), 'i');
      filterConditions.push({
        $or: [
          { name: regex },
          { shopUrl: regex },
          { ownerName: regex },
          { ownerPhone: regex },
          { city: regex },
          { tags: regex }
        ]
      });
    }

    if (status && STATUS_VALUES.includes(status)) {
      filterConditions.push({ status });
    }

    if (city) {
      filterConditions.push({ city: new RegExp(escapeRegExp(city), 'i') });
    }

    if (category) {
      const categoryRegex = new RegExp(escapeRegExp(category), 'i');
      filterConditions.push({
        $or: [
          { category: categoryRegex },
          { subcategories: categoryRegex },
          { tags: categoryRegex },
          { highlightServices: categoryRegex }
        ]
      });
    }

    if (req.query.isFeatured != null) {
      filterConditions.push({ isFeatured: toBoolean(req.query.isFeatured, false) });
    }

    if (req.query.isPremium != null) {
      filterConditions.push({ isPremium: toBoolean(req.query.isPremium, false) });
    }

    if (req.query.bookingEnabled != null) {
      filterConditions.push({ 'bookingSettings.enabled': toBoolean(req.query.bookingEnabled, false) });
    }

    if (req.query.visible != null) {
      filterConditions.push({ isVisible: toBoolean(req.query.visible, true) });
    }

    if (planStatus) {
      const now = new Date();
      let planFilter = null;

      switch (planStatus) {
        case 'complimentary':
          planFilter = {
            'complimentaryPlan.isActive': true,
            $and: [
              {
                $or: [
                  { 'complimentaryPlan.startDate': { $exists: false } },
                  { 'complimentaryPlan.startDate': null },
                  { 'complimentaryPlan.startDate': { $lte: now } }
                ]
              },
              {
                $or: [
                  { 'complimentaryPlan.endDate': { $exists: false } },
                  { 'complimentaryPlan.endDate': null },
                  { 'complimentaryPlan.endDate': { $gte: now } }
                ]
              }
            ]
          };
          break;
        case 'premium':
          planFilter = {
            isPremium: true,
            $or: [
              { premiumUntil: { $exists: false } },
              { premiumUntil: null },
              { premiumUntil: { $gte: now } }
            ]
          };
          break;
        case 'none': {
          const activeComplimentary = {
            'complimentaryPlan.isActive': true,
            $and: [
              {
                $or: [
                  { 'complimentaryPlan.startDate': { $exists: false } },
                  { 'complimentaryPlan.startDate': null },
                  { 'complimentaryPlan.startDate': { $lte: now } }
                ]
              },
              {
                $or: [
                  { 'complimentaryPlan.endDate': { $exists: false } },
                  { 'complimentaryPlan.endDate': null },
                  { 'complimentaryPlan.endDate': { $gte: now } }
                ]
              }
            ]
          };
          const activePremium = {
            isPremium: true,
            $or: [
              { premiumUntil: { $exists: false } },
              { premiumUntil: null },
              { premiumUntil: { $gte: now } }
            ]
          };
          planFilter = {
            $and: [
              { $nor: [activeComplimentary] },
              { $nor: [activePremium] }
            ]
          };
          break;
        }
        default:
          break;
      }

      if (planFilter) {
        filterConditions.push(planFilter);
      }
    }

    const filters = filterConditions.length === 0
      ? {}
      : filterConditions.length === 1
        ? filterConditions[0]
        : { $and: filterConditions };

    if (includeLegacy) {
      const [matchedItems, legacyAll, overviewTotals, legacyLinkedIds] = await Promise.all([
        ServiceShop.find(filters)
          .sort({ updatedAt: -1 })
          .lean(),
        fetchLegacyServiceShopsItems(),
        buildOverview(),
        ServiceShop.distinct('legacySellerId', { legacySellerId: { $ne: null } })
      ]);

      const convertedSet = new Set(
        legacyLinkedIds
          .filter(id => id)
          .map(id => String(id))
      );

      const legacyUnconvertedAll = legacyAll
        .filter(item => item && !convertedSet.has(String(item.legacySellerId || item._id)));

      const legacyFiltered = legacyUnconvertedAll
        .filter(item => matchesLegacyFilters(item, legacyFilters));

      const combinedItems = [...matchedItems, ...legacyFiltered]
        .sort(sortByRecentActivityDesc);

      const total = combinedItems.length;
      const pages = total > 0 ? Math.ceil(total / limit) : 0;
      const items = total > 0 ? combinedItems.slice(skip, skip + limit) : [];

      const statusCounts = buildLegacyStatusCounts(combinedItems);
      const legacyTotals = computeLegacyTotals(legacyUnconvertedAll);
      const totals = mergeOverviewTotals(overviewTotals?.totals, legacyTotals);

      return res.json({
        items,
        pagination: {
          page,
          limit,
          total,
          pages
        },
        summary: {
          total,
          statusCounts,
          totals
        }
      });
    }

    const [items, total, statusAggregation, summaryCounts] = await Promise.all([
      ServiceShop.find(filters)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ServiceShop.countDocuments(filters),
      ServiceShop.aggregate([
        { $match: filters },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      buildOverview()
    ]);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      summary: {
        total,
        statusCounts: buildStatusCounts(statusAggregation),
        totals: summaryCounts.totals
      }
    });
  } catch (err) {
    console.error('serviceShops.list error:', err);
    res.status(500).json({ message: 'خطا در دریافت فهرست مغازه‌های خدماتی.', error: err.message || err });
  }
};

exports.getServiceShop = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'شناسه نامعتبر است.' });
    }
    const shop = await ServiceShop.findById(id).lean();
    if (!shop) {
      const legacyShop = await buildLegacyServiceShopBySellerId(id);
      if (!legacyShop) {
        return res.status(404).json({ message: 'مغازه خدماتی یافت نشد.' });
      }
      return res.json({ item: legacyShop });
    }
    res.json({ item: shop });
  } catch (err) {
    console.error('serviceShops.get error:', err);
    res.status(500).json({ message: 'خطا در دریافت اطلاعات مغازه.', error: err.message || err });
  }
};

exports.createServiceShop = async (req, res) => {
  try {
    const data = normalizePayload(req.body, { partial: false });
    data.createdBy = req.user?.id || null;
    data.updatedBy = req.user?.id || null;
    data.lastReviewedAt = new Date();

    const created = await ServiceShop.create(data);
    res.status(201).json({ message: 'مغازه خدماتی ایجاد شد.', item: created });
  } catch (err) {
    console.error('serviceShops.create error:', err);
    if (err?.status) {
      return res.status(err.status).json({ message: err.message });
    }
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'shopUrl تکراری است. مقدار دیگری انتخاب کنید.' });
    }
    res.status(500).json({ message: 'خطا در ایجاد مغازه خدماتی.', error: err.message || err });
  }
};

exports.updateServiceShop = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'شناسه نامعتبر است.' });
    }
    let shop = await ServiceShop.findById(id);
    if (!shop) {
      const legacyShop = await buildLegacyServiceShopBySellerId(id);
      if (!legacyShop) {
        return res.status(404).json({ message: 'مغازه خدماتی یافت نشد.' });
      }

      const fallbackShopUrl = legacyShop.shopUrl && String(legacyShop.shopUrl).trim()
        ? legacyShop.shopUrl.trim().toLowerCase()
        : `legacy-${id}`;

      shop = new ServiceShop({
        ...legacyShop,
        _id: new mongoose.Types.ObjectId(id),
        shopUrl: fallbackShopUrl,
        createdBy: req.user?.id || null,
        updatedBy: req.user?.id || null,
        lastReviewedAt: new Date()
      });
    }

    const data = normalizePayload(req.body, { partial: true, existing: shop });
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'هیچ داده‌ای برای بروزرسانی ارسال نشده است.' });
    }

    Object.assign(shop, data, {
      updatedBy: req.user?.id || shop.updatedBy,
      lastReviewedAt: new Date()
    });
    await shop.save();

    res.json({ message: 'مغازه خدماتی بروزرسانی شد.', item: shop });
  } catch (err) {
    console.error('serviceShops.update error:', err);
    if (err?.status) {
      return res.status(err.status).json({ message: err.message });
    }
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'shopUrl تکراری است. مقدار دیگری انتخاب کنید.' });
    }
    res.status(500).json({ message: 'خطا در بروزرسانی مغازه خدماتی.', error: err.message || err });
  }
};

exports.updateServiceShopStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'شناسه نامعتبر است.' });
    }
    let shop = await ServiceShop.findById(id);
    if (!shop) {
      const legacyShop = await buildLegacyServiceShopBySellerId(id);
      if (!legacyShop) {
        return res.status(404).json({ message: 'مغازه خدماتی یافت نشد.' });
      }

      const fallbackShopUrl = legacyShop.shopUrl && String(legacyShop.shopUrl).trim()
        ? legacyShop.shopUrl.trim().toLowerCase()
        : `legacy-${id}`;

      shop = new ServiceShop({
        ...legacyShop,
        _id: new mongoose.Types.ObjectId(id),
        shopUrl: fallbackShopUrl,
        createdBy: req.user?.id || null,
        updatedBy: req.user?.id || null,
        lastReviewedAt: new Date()
      });
    }

    const wasBlocked = !!(shop?.adminModeration && shop.adminModeration.isBlocked);
    const updates = {};
    let complimentaryPlanUpdated = false;
    if (req.body.status != null) {
      const status = String(req.body.status || '').trim().toLowerCase();
      if (!STATUS_VALUES.includes(status)) {
        return res.status(400).json({ message: 'وضعیت انتخاب‌شده معتبر نیست.' });
      }
      updates.status = status;
    }

    ['isFeatured', 'isBookable', 'isVisible', 'isPremium'].forEach((field) => {
      if (req.body[field] != null) {
        updates[field] = !!toBoolean(req.body[field], req.body[field]);
      }
    });

    if (req.body.premiumUntil !== undefined) {
      updates.premiumUntil = parseDateValue(req.body.premiumUntil, { allowNull: true });
    }

    const existingBookingSettings = (shop.bookingSettings && typeof shop.bookingSettings === 'object')
      ? (typeof shop.bookingSettings.toObject === 'function'
        ? shop.bookingSettings.toObject()
        : { ...shop.bookingSettings })
      : {};
    const bookingSettingsDiff = parseBookingSettings(req.body.bookingSettings, req.body);

    const existingPlan = shop.complimentaryPlan
      ? (typeof shop.complimentaryPlan.toObject === 'function'
        ? shop.complimentaryPlan.toObject()
        : { ...shop.complimentaryPlan })
      : null;
    const planUpdate = parseComplimentaryPlan(req.body.complimentaryPlan ?? req.body, {
      existing: existingPlan,
      partial: true
    });
    if (planUpdate !== undefined) {
      shop.complimentaryPlan = planUpdate;
      complimentaryPlanUpdated = true;
    }

    if (req.body.notes != null) {
      updates.notes = String(req.body.notes || '').trim();
    }

    if (!Object.keys(updates).length && !bookingSettingsDiff && !complimentaryPlanUpdated) {
      return res.status(400).json({ message: 'هیچ تغییری ارسال نشده است.' });
    }

    const finalStatus = updates.status ?? shop.status;
    const finalIsVisible = Object.prototype.hasOwnProperty.call(updates, 'isVisible')
      ? updates.isVisible
      : shop.isVisible;
    const finalIsBookable = Object.prototype.hasOwnProperty.call(updates, 'isBookable')
      ? updates.isBookable
      : shop.isBookable;
    const predictedBookingEnabled = bookingSettingsDiff && Object.prototype.hasOwnProperty.call(bookingSettingsDiff, 'enabled')
      ? bookingSettingsDiff.enabled
      : (Object.prototype.hasOwnProperty.call(existingBookingSettings, 'enabled')
        ? existingBookingSettings.enabled
        : undefined);

    let autoUnblocked = false;
    if (wasBlocked && (
      finalStatus !== 'suspended' ||
      finalIsVisible === true ||
      finalIsBookable === true ||
      predictedBookingEnabled === true
    )) {
      const seller = await findSellerForShop({
        shop,
        providedSellerId: req.body?.sellerId,
        fallbackId: id
      });
      await applyAdminUnblock({
        shop,
        seller,
        adminId: req.user?.id || null,
        reason: req.body?.unblockReason ?? null
      });
      autoUnblocked = true;
    }

    Object.assign(shop, updates, {
      updatedBy: req.user?.id || shop.updatedBy,
      lastReviewedAt: new Date()
    });

    if (bookingSettingsDiff) {
      const freshBookingSettings = (shop.bookingSettings && typeof shop.bookingSettings === 'object')
        ? (typeof shop.bookingSettings.toObject === 'function'
          ? shop.bookingSettings.toObject()
          : { ...shop.bookingSettings })
        : {};
      shop.bookingSettings = {
        ...freshBookingSettings,
        ...bookingSettingsDiff
      };
    }

    if (autoUnblocked && shop.adminModeration) {
      shop.adminModeration.previousStatus = shop.status;
      if (typeof shop.isVisible === 'boolean') {
        shop.adminModeration.previousIsVisible = shop.isVisible;
      }
      if (typeof shop.isBookable === 'boolean') {
        shop.adminModeration.previousIsBookable = shop.isBookable;
      }
      if (shop.bookingSettings && typeof shop.bookingSettings === 'object' && 'enabled' in shop.bookingSettings) {
        shop.adminModeration.previousBookingEnabled = !!shop.bookingSettings.enabled;
      }
    }

    await shop.save();

    res.json({ message: 'وضعیت مغازه بروزرسانی شد.', item: shop });
  } catch (err) {
    console.error('serviceShops.updateStatus error:', err);
    if (err?.status) {
      return res.status(err.status).json({ message: err.message });
    }
    res.status(500).json({ message: 'خطا در بروزرسانی وضعیت.', error: err.message || err });
  }
};

exports.blockServiceShop = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'شناسه نامعتبر است.' });
    }

    const { shop } = await findOrCreateServiceShop(id, req.user?.id || null);
    if (!shop) {
      return res.status(404).json({ message: 'مغازه خدماتی یافت نشد.' });
    }

    const seller = await findSellerForShop({
      shop,
      providedSellerId: req.body?.sellerId,
      fallbackId: id
    });

    if (!seller) {
      return res.status(404).json({ message: 'فروشنده مرتبط با این مغازه یافت نشد.' });
    }

    const reason = req.body?.reason != null ? String(req.body.reason).trim() : '';
    const { shop: savedShop, seller: savedSeller } = await applyAdminBlock({
      shop,
      seller,
      adminId: req.user?.id || null,
      reason
    });

    res.json({
      message: 'فروشنده و مغازه با موفقیت مسدود شدند.',
      item: toPlainDocument(savedShop || shop),
      seller: savedSeller
        ? {
            _id: savedSeller._id,
            blockedByAdmin: savedSeller.blockedByAdmin,
            blockedAt: savedSeller.blockedAt,
            blockedReason: savedSeller.blockedReason
          }
        : {
            _id: seller._id,
            blockedByAdmin: seller.blockedByAdmin,
            blockedAt: seller.blockedAt,
            blockedReason: seller.blockedReason
          }
    });
  } catch (err) {
    console.error('serviceShops.block error:', err);
    if (err?.status) {
      return res.status(err.status).json({ message: err.message });
    }
    res.status(500).json({ message: 'خطا در مسدودسازی فروشنده.', error: err.message || err });
  }
};

exports.unblockServiceShop = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'شناسه نامعتبر است.' });
    }

    const { shop } = await findOrCreateServiceShop(id, req.user?.id || null);
    if (!shop) {
      return res.status(404).json({ message: 'مغازه خدماتی یافت نشد.' });
    }

    const seller = await findSellerForShop({
      shop,
      providedSellerId: req.body?.sellerId,
      fallbackId: id
    });

    if (!seller) {
      return res.status(404).json({ message: 'فروشنده مرتبط با این مغازه یافت نشد.' });
    }

    const reason = req.body?.reason != null ? String(req.body.reason).trim() : null;
    const { shop: savedShop, seller: savedSeller } = await applyAdminUnblock({
      shop,
      seller,
      adminId: req.user?.id || null,
      reason
    });

    res.json({
      message: 'دسترسی فروشنده با موفقیت فعال شد.',
      item: toPlainDocument(savedShop || shop),
      seller: savedSeller
        ? {
            _id: savedSeller._id,
            blockedByAdmin: savedSeller.blockedByAdmin,
            blockedAt: savedSeller.blockedAt,
            blockedReason: savedSeller.blockedReason
          }
        : {
            _id: seller._id,
            blockedByAdmin: seller.blockedByAdmin,
            blockedAt: seller.blockedAt,
            blockedReason: seller.blockedReason
          }
    });
  } catch (err) {
    console.error('serviceShops.unblock error:', err);
    if (err?.status) {
      return res.status(err.status).json({ message: err.message });
    }
    res.status(500).json({ message: 'خطا در فعال‌سازی مجدد فروشنده.', error: err.message || err });
  }
};

exports.getMyComplimentaryPlan = async (req, res) => {
  try {
    const sellerId = req.user?.id || req.user?._id;
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'احراز هویت نامعتبر است.' });
    }

    const seller = await Seller.findById(sellerId)
      .select('phone shopurl storename')
      .lean();
    if (!seller) {
      return res.status(404).json({ success: false, message: 'فروشنده یافت نشد.' });
    }

    let shop = null;
    if (seller.phone) {
      shop = await ServiceShop.findOne({ ownerPhone: seller.phone }).lean();
    }
    if (!shop && seller.shopurl) {
      shop = await ServiceShop.findOne({ shopUrl: seller.shopurl }).lean();
    }

    if (!shop) {
      return res.json({ success: true, plan: buildComplimentaryPlanPayload(null) });
    }

    const plan = buildComplimentaryPlanPayload(shop);
    return res.json({
      success: true,
      plan,
      shop: {
        id: shop._id,
        name: shop.name || seller.storename || '',
        shopUrl: shop.shopUrl || seller.shopurl || '',
        ownerPhone: shop.ownerPhone || seller.phone || ''
      }
    });
  } catch (err) {
    console.error('serviceShops.getMyComplimentaryPlan error:', err);
    res.status(500).json({ success: false, message: 'خطا در دریافت وضعیت پلن رایگان.' });
  }
};

exports.removeServiceShop = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'شناسه نامعتبر است.' });
    }
    const hard = req.query.hard === '1' || req.query.hard === 'true';
    const shop = await ServiceShop.findById(id);
    if (!shop) {
      return res.status(404).json({ message: 'مغازه خدماتی یافت نشد.' });
    }

    if (hard) {
      await ServiceShop.deleteOne({ _id: id });
      return res.json({ message: 'مغازه خدماتی به طور کامل حذف شد.' });
    }

    shop.status = 'archived';
    shop.isVisible = false;
    shop.updatedBy = req.user?.id || shop.updatedBy;
    shop.lastReviewedAt = new Date();
    await shop.save();

    res.json({ message: 'مغازه به حالت بایگانی منتقل شد.', item: shop });
  } catch (err) {
    console.error('serviceShops.remove error:', err);
    res.status(500).json({ message: 'خطا در حذف مغازه خدماتی.', error: err.message || err });
  }
};

exports.buildOverview = buildOverview;
