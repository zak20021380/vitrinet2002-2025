const mongoose = require('mongoose');
const ServiceShop = require('../models/serviceShop');

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

function normalizePayload(raw = {}, { partial = false } = {}) {
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

  if (raw.lastReviewedAt !== undefined) {
    data.lastReviewedAt = parseDateValue(raw.lastReviewedAt, { allowNull: true }) ?? new Date();
  }

  return data;
}

const buildStatusCounts = (rows = []) => {
  return rows.reduce((acc, row) => {
    if (row && row._id) {
      acc[row._id] = row.count;
    }
    return acc;
  }, {});
};

async function buildOverview() {
  const now = new Date();
  const [
    total,
    active,
    pending,
    suspended,
    archived,
    featured,
    bookingEnabled,
    premiumActive,
    statusAggregation,
    topCities,
    topCategories,
    recent
  ] = await Promise.all([
    ServiceShop.countDocuments({}),
    ServiceShop.countDocuments({ status: 'approved', isVisible: true }),
    ServiceShop.countDocuments({ status: 'pending' }),
    ServiceShop.countDocuments({ status: 'suspended' }),
    ServiceShop.countDocuments({ status: 'archived' }),
    ServiceShop.countDocuments({ isFeatured: true }),
    ServiceShop.countDocuments({ 'bookingSettings.enabled': true }),
    ServiceShop.countDocuments({ isPremium: true, premiumUntil: { $gt: now } }),
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
      premiumActive
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

    const filters = {};
    const search = String(req.query.q || req.query.search || '').trim();
    if (search) {
      const regex = new RegExp(escapeRegExp(search), 'i');
      filters.$or = [
        { name: regex },
        { shopUrl: regex },
        { ownerName: regex },
        { ownerPhone: regex },
        { city: regex },
        { tags: regex }
      ];
    }

    const status = String(req.query.status || '').trim().toLowerCase();
    if (status && STATUS_VALUES.includes(status)) {
      filters.status = status;
    }

    const city = String(req.query.city || '').trim();
    if (city) {
      filters.city = new RegExp(escapeRegExp(city), 'i');
    }

    if (req.query.isFeatured != null) {
      filters.isFeatured = toBoolean(req.query.isFeatured, false);
    }

    if (req.query.isPremium != null) {
      filters.isPremium = toBoolean(req.query.isPremium, false);
    }

    if (req.query.bookingEnabled != null) {
      filters['bookingSettings.enabled'] = toBoolean(req.query.bookingEnabled, false);
    }

    if (req.query.visible != null) {
      filters.isVisible = toBoolean(req.query.visible, true);
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
      return res.status(404).json({ message: 'مغازه خدماتی یافت نشد.' });
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
    const shop = await ServiceShop.findById(id);
    if (!shop) {
      return res.status(404).json({ message: 'مغازه خدماتی یافت نشد.' });
    }

    const data = normalizePayload(req.body, { partial: true });
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
    const shop = await ServiceShop.findById(id);
    if (!shop) {
      return res.status(404).json({ message: 'مغازه خدماتی یافت نشد.' });
    }

    const updates = {};
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

    const bookingSettings = parseBookingSettings(req.body.bookingSettings, req.body);
    if (bookingSettings) {
      shop.bookingSettings = {
        ...shop.bookingSettings?.toObject?.(),
        ...bookingSettings
      };
    }

    if (req.body.notes != null) {
      updates.notes = String(req.body.notes || '').trim();
    }

    if (!Object.keys(updates).length && !bookingSettings) {
      return res.status(400).json({ message: 'هیچ تغییری ارسال نشده است.' });
    }

    Object.assign(shop, updates, {
      updatedBy: req.user?.id || shop.updatedBy,
      lastReviewedAt: new Date()
    });
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
