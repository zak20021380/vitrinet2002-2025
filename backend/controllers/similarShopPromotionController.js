const mongoose = require('mongoose');

const SimilarPromotionPlan = require('../models/SimilarPromotionPlan');
const SimilarShopPromotion = require('../models/SimilarShopPromotion');
const Seller = require('../models/Seller');
const ServiceShop = require('../models/serviceShop');
const ShopAppearance = require('../models/ShopAppearance');

const TIER_LABELS = {
  normal: 'اسپانسری معمولی',
  priority: 'اسپانسری اولویت‌دار'
};

const DURATION_LABELS = {
  daily: 'روزانه',
  weekly: 'هفتگی',
  monthly: 'ماهانه'
};

const DURATION_DAYS = {
  daily: 1,
  weekly: 7,
  monthly: 30
};

const DEFAULT_PLANS = [
  { tier: 'normal', durationUnit: 'daily', price: 49000, slotLimit: 3 },
  { tier: 'normal', durationUnit: 'weekly', price: 249000, slotLimit: 3 },
  { tier: 'normal', durationUnit: 'monthly', price: 790000, slotLimit: 3 },
  { tier: 'priority', durationUnit: 'daily', price: 89000, slotLimit: 1 },
  { tier: 'priority', durationUnit: 'weekly', price: 449000, slotLimit: 1 },
  { tier: 'priority', durationUnit: 'monthly', price: 1390000, slotLimit: 1 }
].map((plan) => ({
  ...plan,
  durationDays: DURATION_DAYS[plan.durationUnit],
  title: `${TIER_LABELS[plan.tier]} - ${DURATION_LABELS[plan.durationUnit]}`,
  description: plan.tier === 'priority'
    ? 'نمایش قبل از اسپانسری معمولی در بخش مغازه‌های مشابه'
    : 'نمایش قبل از مغازه‌های مشابه عادی'
}));

const PLAN_ORDER = {
  normal: 1,
  priority: 0
};

const PAYMENT_STATUSES = ['pending', 'submitted', 'verified', 'rejected', 'waived'];
const ADMIN_ACTIONS = ['approve', 'reject', 'pause', 'resume', 'remove', 'update'];

function normaliseText(value = '', maxLength = 500) {
  const cleaned = String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[<>"'\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, maxLength);
}

function bodyFrom(req) {
  return req.fields && Object.keys(req.fields).length ? req.fields : (req.body || {});
}

function firstFieldValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function toObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

function parseDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days || 1));
  return next;
}

function normaliseEnum(value, allowed, fallback = '') {
  const normalised = String(value || '').trim().toLowerCase();
  return allowed.includes(normalised) ? normalised : fallback;
}

function calcCtr(metrics = {}) {
  const impressions = Number(metrics.impressions || 0);
  const clicks = Number(metrics.clicks || 0);
  return impressions > 0 ? clicks / impressions : 0;
}

function isCurrentlyActive(promotion, now = new Date()) {
  if (!promotion || promotion.status !== 'approved') return false;
  const startAt = promotion.startAt ? new Date(promotion.startAt) : null;
  const endAt = promotion.endAt ? new Date(promotion.endAt) : null;
  if (!startAt || !endAt) return false;
  return startAt <= now && endAt > now;
}

function serializePlan(plan) {
  if (!plan) return null;
  const raw = typeof plan.toObject === 'function' ? plan.toObject() : { ...plan };
  return {
    id: String(raw._id || raw.id || ''),
    tier: raw.tier,
    tierLabel: TIER_LABELS[raw.tier] || raw.tier,
    durationUnit: raw.durationUnit,
    durationLabel: DURATION_LABELS[raw.durationUnit] || raw.durationUnit,
    durationDays: raw.durationDays,
    title: raw.title,
    description: raw.description || '',
    price: raw.price,
    isActive: raw.isActive !== false,
    slotLimit: raw.slotLimit || 1,
    updatedAt: raw.updatedAt || null
  };
}

function setPlansNoStoreHeaders(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
}

function buildPlansMeta(plans) {
  const timestamps = (Array.isArray(plans) ? plans : [])
    .map((plan) => new Date(plan.updatedAt || 0).getTime())
    .filter(Number.isFinite);
  const latest = timestamps.length ? Math.max(...timestamps) : Date.now();
  return {
    version: String(latest),
    plansUpdatedAt: new Date(latest).toISOString()
  };
}

function serializePromotion(promotion) {
  if (!promotion) return null;
  const raw = typeof promotion.toObject === 'function'
    ? promotion.toObject({ virtuals: true })
    : { ...promotion };
  const metrics = raw.metrics || {};
  return {
    ...raw,
    id: String(raw._id || raw.id || ''),
    sellerId: raw.sellerId,
    serviceShopId: raw.serviceShopId,
    tierLabel: TIER_LABELS[raw.planTier] || raw.planTier,
    durationLabel: DURATION_LABELS[raw.durationUnit] || raw.durationUnit,
    isActive: isCurrentlyActive(raw),
    ctr: calcCtr(metrics)
  };
}

async function ensureDefaultPlans() {
  await Promise.all(DEFAULT_PLANS.map((plan) => (
    SimilarPromotionPlan.updateOne(
      { tier: plan.tier, durationUnit: plan.durationUnit },
      { $setOnInsert: plan },
      { upsert: true }
    )
  )));
}

async function getPlans({ includeInactive = false } = {}) {
  await ensureDefaultPlans();
  const filter = includeInactive ? {} : { isActive: true };
  const plans = await SimilarPromotionPlan.find(filter).lean();
  return plans
    .sort((a, b) => {
      const tierDiff = (PLAN_ORDER[a.tier] ?? 99) - (PLAN_ORDER[b.tier] ?? 99);
      if (tierDiff) return tierDiff;
      return (DURATION_DAYS[a.durationUnit] || 999) - (DURATION_DAYS[b.durationUnit] || 999);
    })
    .map(serializePlan);
}

async function getEffectivePlan(tier, durationUnit) {
  await ensureDefaultPlans();
  return SimilarPromotionPlan.findOne({ tier, durationUnit, isActive: true });
}

async function findShopSnapshotForSeller(seller) {
  const serviceShop = await ServiceShop.findOne({
    legacySellerId: seller._id,
    status: { $in: ['approved', 'pending', 'draft'] }
  })
    .select('name shopUrl category subcategories ownerPhone address city coverImage gallery legacySellerId')
    .sort({ status: 1, updatedAt: -1 })
    .lean();

  const appearance = await ShopAppearance.findOne({ sellerId: seller._id })
    .select('shopLogo footerImage slides')
    .lean();

  const slideImage = Array.isArray(appearance?.slides)
    ? appearance.slides.map((slide) => normaliseText(slide?.img || '', 300)).find(Boolean)
    : '';
  const galleryImage = Array.isArray(serviceShop?.gallery)
    ? serviceShop.gallery.map((item) => normaliseText(item || '', 300)).find(Boolean)
    : '';

  return {
    serviceShopId: serviceShop?._id || null,
    snapshot: {
      name: normaliseText(serviceShop?.name || seller.storename || '', 120),
      shopUrl: normaliseText(serviceShop?.shopUrl || seller.shopurl || '', 80).toLowerCase(),
      phone: normaliseText(serviceShop?.ownerPhone || seller.phone || '', 40),
      address: normaliseText(serviceShop?.address || seller.address || '', 220),
      city: normaliseText(serviceShop?.city || seller.city || '', 80),
      categoryName: normaliseText(serviceShop?.category || seller.subcategory || seller.category || '', 120),
      imageUrl: normaliseText(
        serviceShop?.coverImage
        || galleryImage
        || appearance?.footerImage
        || slideImage
        || appearance?.shopLogo
        || seller.boardImage
        || '',
        500
      )
    }
  };
}

async function expireExpiredPromotions(referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(now.getTime())) return { modifiedCount: 0 };
  return SimilarShopPromotion.updateMany(
    {
      status: { $in: ['approved', 'paused'] },
      endAt: { $lte: now }
    },
    {
      $set: {
        status: 'expired',
        expiredAt: now
      }
    }
  );
}

async function findOverlappingPromotion({ sellerId, startAt, endAt, excludeId = null }) {
  const query = {
    sellerId,
    status: { $in: ['approved', 'paused'] },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt }
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return SimilarShopPromotion.findOne(query).select('_id startAt endAt status').lean();
}

async function hasCurrentActivePromotion(sellerId, now = new Date()) {
  return SimilarShopPromotion.exists({
    sellerId,
    status: 'approved',
    startAt: { $lte: now },
    endAt: { $gt: now }
  });
}

function getAdminId(req) {
  return req.user?.id || req.user?._id || null;
}

exports.getPublicPlans = async (req, res) => {
  try {
    const plans = await getPlans({ includeInactive: false });
    setPlansNoStoreHeaders(res);
    return res.json({ success: true, plans, meta: buildPlansMeta(plans) });
  } catch (err) {
    console.error('similar promotions getPublicPlans error:', err);
    return res.status(500).json({ success: false, message: 'خطا در دریافت پلن‌های تبلیغات.' });
  }
};

exports.getAdminPlans = async (req, res) => {
  try {
    const plans = await getPlans({ includeInactive: true });
    setPlansNoStoreHeaders(res);
    return res.json({ success: true, plans, meta: buildPlansMeta(plans) });
  } catch (err) {
    console.error('similar promotions getAdminPlans error:', err);
    return res.status(500).json({ success: false, message: 'خطا در دریافت پلن‌های تبلیغات.' });
  }
};

exports.updateAdminPlans = async (req, res) => {
  try {
    const plans = Array.isArray(req.body?.plans) ? req.body.plans : [];
    if (!plans.length) {
      return res.status(400).json({ success: false, message: 'هیچ پلنی برای ذخیره ارسال نشد.' });
    }

    const updates = [];
    for (const rawPlan of plans) {
      const tier = normaliseEnum(rawPlan.tier, ['normal', 'priority']);
      const durationUnit = normaliseEnum(rawPlan.durationUnit, ['daily', 'weekly', 'monthly']);
      if (!tier || !durationUnit) {
        return res.status(400).json({ success: false, message: 'نوع پلن یا مدت زمان معتبر نیست.' });
      }

      const price = Number(rawPlan.price);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ success: false, message: 'قیمت پلن معتبر نیست.' });
      }

      const slotLimit = Number(rawPlan.slotLimit);
      const cleanSlotLimit = Number.isFinite(slotLimit)
        ? Math.min(Math.max(Math.round(slotLimit), 1), 10)
        : (tier === 'priority' ? 1 : 3);
      const durationDays = Number(rawPlan.durationDays) > 0
        ? Math.min(Math.round(Number(rawPlan.durationDays)), 370)
        : DURATION_DAYS[durationUnit];
      const title = normaliseText(rawPlan.title, 120)
        || `${TIER_LABELS[tier]} - ${DURATION_LABELS[durationUnit]}`;

      updates.push(SimilarPromotionPlan.updateOne(
        { tier, durationUnit },
        {
          $set: {
            title,
            price,
            durationDays,
            description: normaliseText(rawPlan.description, 500),
            isActive: rawPlan.isActive !== false,
            slotLimit: cleanSlotLimit,
            updatedBy: getAdminId(req)
          },
          $setOnInsert: { tier, durationUnit }
        },
        { upsert: true, runValidators: true }
      ));
    }

    await Promise.all(updates);
    const savedPlans = await getPlans({ includeInactive: true });
    setPlansNoStoreHeaders(res);
    return res.json({
      success: true,
      message: 'پلن‌های تبلیغات ذخیره شد.',
      plans: savedPlans,
      meta: buildPlansMeta(savedPlans)
    });
  } catch (err) {
    console.error('similar promotions updateAdminPlans error:', err);
    return res.status(500).json({ success: false, message: 'خطا در ذخیره پلن‌های تبلیغات.' });
  }
};

exports.createSellerRequest = async (req, res) => {
  try {
    const sellerId = req.user?.sellerId;
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'احراز هویت فروشنده معتبر نیست.' });
    }

    const body = bodyFrom(req);
    const planTier = normaliseEnum(firstFieldValue(body.planTier || body.tier), ['normal', 'priority']);
    const durationUnit = normaliseEnum(firstFieldValue(body.durationUnit || body.duration), ['daily', 'weekly', 'monthly']);
    if (!planTier || !durationUnit) {
      return res.status(400).json({ success: false, message: 'پلن تبلیغاتی معتبر نیست.' });
    }

    const seller = await Seller.findById(sellerId).select('storename shopurl phone category subcategory address city boardImage blockedByAdmin').lean();
    if (!seller || seller.blockedByAdmin) {
      return res.status(403).json({ success: false, message: 'فروشگاه برای ثبت تبلیغ مجاز نیست.' });
    }

    const activeDuplicate = await hasCurrentActivePromotion(seller._id);
    if (activeDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'این فروشگاه در حال حاضر یک تبلیغ فعال در بخش مغازه‌های مشابه دارد.'
      });
    }

    const plan = await getEffectivePlan(planTier, durationUnit);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'پلن انتخابی فعال نیست.' });
    }

    const { serviceShopId, snapshot } = await findShopSnapshotForSeller(seller);

    const promotion = await SimilarShopPromotion.create({
      sellerId: seller._id,
      serviceShopId,
      planTier,
      durationUnit,
      durationDays: plan.durationDays,
      planTitle: plan.title,
      price: plan.price,
      slotLimit: plan.slotLimit || (planTier === 'priority' ? 1 : 3),
      paymentStatus: 'pending',
      paymentProof: {},
      status: 'pending',
      priorityOrder: planTier === 'priority' ? 10 : 100,
      shopSnapshot: snapshot
    });

    return res.status(201).json({
      success: true,
      message: 'درخواست تبلیغ ثبت شد. برای تکمیل فرایند به درگاه پرداخت هدایت می‌شوید.',
      promotion: serializePromotion(promotion)
    });
  } catch (err) {
    console.error('similar promotions createSellerRequest error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'خطا در ثبت درخواست تبلیغ.'
    });
  }
};

exports.listSellerRequests = async (req, res) => {
  try {
    const sellerId = req.user?.sellerId;
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'احراز هویت فروشنده معتبر نیست.' });
    }
    await expireExpiredPromotions();
    const promotions = await SimilarShopPromotion.find({ sellerId })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, promotions: promotions.map(serializePromotion) });
  } catch (err) {
    console.error('similar promotions listSellerRequests error:', err);
    return res.status(500).json({ success: false, message: 'خطا در دریافت تبلیغات فروشنده.' });
  }
};

exports.listAdminRequests = async (req, res) => {
  try {
    await expireExpiredPromotions();
    const status = normaliseEnum(req.query?.status, ['pending', 'approved', 'rejected', 'paused', 'expired', 'removed', 'all'], 'all');
    const filter = {};
    if (status !== 'all') filter.status = status;

    const promotions = await SimilarShopPromotion.find(filter)
      .populate({ path: 'sellerId', select: 'storename shopurl phone city address category subcategory boardImage' })
      .populate({ path: 'serviceShopId', select: 'name shopUrl category city coverImage' })
      .populate({ path: 'reviewedBy', select: 'name phone' })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, promotions: promotions.map(serializePromotion) });
  } catch (err) {
    console.error('similar promotions listAdminRequests error:', err);
    return res.status(500).json({ success: false, message: 'خطا در دریافت درخواست‌های تبلیغاتی.' });
  }
};

exports.updateAdminRequest = async (req, res) => {
  try {
    const promotionId = toObjectId(req.params.id);
    if (!promotionId) {
      return res.status(400).json({ success: false, message: 'شناسه تبلیغ معتبر نیست.' });
    }

    const body = req.body || {};
    const action = normaliseEnum(body.action || 'update', ADMIN_ACTIONS, 'update');
    await expireExpiredPromotions();
    const promotion = await SimilarShopPromotion.findById(promotionId);
    if (!promotion) {
      return res.status(404).json({ success: false, message: 'درخواست تبلیغ پیدا نشد.' });
    }

    const now = new Date();
    const adminId = getAdminId(req);

    if (Object.prototype.hasOwnProperty.call(body, 'adminNote')) {
      promotion.adminNote = normaliseText(body.adminNote, 1000);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'paymentStatus')) {
      const paymentStatus = normaliseEnum(body.paymentStatus, PAYMENT_STATUSES);
      if (!paymentStatus) {
        return res.status(400).json({ success: false, message: 'وضعیت پرداخت معتبر نیست.' });
      }
      promotion.paymentStatus = paymentStatus;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'priorityOrder')) {
      const order = Number(body.priorityOrder);
      if (!Number.isFinite(order)) {
        return res.status(400).json({ success: false, message: 'اولویت نمایش معتبر نیست.' });
      }
      promotion.priorityOrder = Math.max(0, Math.min(Math.round(order), 9999));
    }

    const requestedStart = parseDate(body.startAt, null);
    const requestedEnd = parseDate(body.endAt, null);

    if ((body.startAt && !requestedStart) || (body.endAt && !requestedEnd)) {
      return res.status(400).json({ success: false, message: 'تاریخ شروع یا پایان معتبر نیست.' });
    }

    if (action === 'approve') {
      if (!['verified', 'waived'].includes(promotion.paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: 'قبل از تایید تبلیغ، پرداخت آنلاین باید با موفقیت انجام شده باشد.'
        });
      }
      const startAt = requestedStart || promotion.startAt || now;
      const endAt = requestedEnd || promotion.endAt || addDays(startAt, promotion.durationDays);
      if (endAt <= startAt) {
        return res.status(400).json({ success: false, message: 'تاریخ پایان باید بعد از تاریخ شروع باشد.' });
      }
      const duplicate = await findOverlappingPromotion({
        sellerId: promotion.sellerId,
        startAt,
        endAt,
        excludeId: promotion._id
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'این فروشگاه در بازه انتخابی یک تبلیغ فعال یا رزروشده دارد.'
        });
      }
      promotion.status = 'approved';
      promotion.startAt = startAt;
      promotion.endAt = endAt;
      promotion.approvedAt = promotion.approvedAt || now;
      promotion.rejectedAt = null;
      promotion.pausedAt = null;
      promotion.removedAt = null;
      promotion.expiredAt = null;
      if (!body.paymentStatus) promotion.paymentStatus = 'verified';
    } else if (action === 'reject') {
      promotion.status = 'rejected';
      promotion.rejectedAt = now;
      promotion.paymentStatus = body.paymentStatus ? promotion.paymentStatus : 'rejected';
    } else if (action === 'pause') {
      if (promotion.status !== 'approved') {
        return res.status(400).json({ success: false, message: 'فقط تبلیغ تاییدشده قابل توقف است.' });
      }
      promotion.status = 'paused';
      promotion.pausedAt = now;
    } else if (action === 'resume') {
      if (promotion.status !== 'paused') {
        return res.status(400).json({ success: false, message: 'فقط تبلیغ متوقف‌شده قابل ادامه است.' });
      }
      if (promotion.endAt && promotion.endAt <= now) {
        promotion.status = 'expired';
        promotion.expiredAt = now;
        await promotion.save();
        return res.status(400).json({ success: false, message: 'زمان این تبلیغ تمام شده است.' });
      }
      const duplicate = await findOverlappingPromotion({
        sellerId: promotion.sellerId,
        startAt: promotion.startAt || now,
        endAt: promotion.endAt || addDays(now, promotion.durationDays),
        excludeId: promotion._id
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'این فروشگاه در این بازه تبلیغ فعال دیگری دارد.'
        });
      }
      promotion.status = 'approved';
      promotion.resumedAt = now;
    } else if (action === 'remove') {
      promotion.status = 'removed';
      promotion.removedAt = now;
    } else {
      if (requestedStart) promotion.startAt = requestedStart;
      if (requestedEnd) promotion.endAt = requestedEnd;
      if (promotion.startAt && promotion.endAt && promotion.endAt <= promotion.startAt) {
        return res.status(400).json({ success: false, message: 'تاریخ پایان باید بعد از تاریخ شروع باشد.' });
      }
      if (['approved', 'paused'].includes(promotion.status) && promotion.startAt && promotion.endAt) {
        const duplicate = await findOverlappingPromotion({
          sellerId: promotion.sellerId,
          startAt: promotion.startAt,
          endAt: promotion.endAt,
          excludeId: promotion._id
        });
        if (duplicate) {
          return res.status(409).json({
            success: false,
            message: 'این فروشگاه در بازه انتخابی یک تبلیغ فعال یا رزروشده دارد.'
          });
        }
      }
    }

    promotion.reviewedAt = now;
    promotion.reviewedBy = adminId;
    await promotion.save();

    await promotion.populate([
      { path: 'sellerId', select: 'storename shopurl phone city address category subcategory boardImage' },
      { path: 'serviceShopId', select: 'name shopUrl category city coverImage' },
      { path: 'reviewedBy', select: 'name phone' }
    ]);

    return res.json({
      success: true,
      message: 'وضعیت تبلیغ بروزرسانی شد.',
      promotion: serializePromotion(promotion)
    });
  } catch (err) {
    console.error('similar promotions updateAdminRequest error:', err);
    return res.status(500).json({ success: false, message: 'خطا در بروزرسانی تبلیغ.' });
  }
};

exports.softRemoveAdminRequest = async (req, res) => {
  req.body = { ...(req.body || {}), action: 'remove' };
  return exports.updateAdminRequest(req, res);
};

exports.trackPromotionEvent = async (req, res) => {
  try {
    const promotionId = toObjectId(req.params.id);
    if (!promotionId) {
      return res.status(400).json({ success: false, message: 'شناسه تبلیغ معتبر نیست.' });
    }
    const event = normaliseEnum(req.body?.event || req.query?.event, ['impression', 'click']);
    if (!event) {
      return res.status(400).json({ success: false, message: 'نوع رخداد معتبر نیست.' });
    }

    const now = new Date();
    const field = event === 'click' ? 'metrics.clicks' : 'metrics.impressions';
    const dateField = event === 'click' ? 'metrics.lastClickAt' : 'metrics.lastImpressionAt';

    const updated = await SimilarShopPromotion.findOneAndUpdate(
      {
        _id: promotionId,
        status: 'approved',
        startAt: { $lte: now },
        endAt: { $gt: now }
      },
      {
        $inc: { [field]: 1 },
        $set: { [dateField]: now }
      },
      { new: true }
    ).select('metrics');

    if (!updated) {
      return res.status(404).json({ success: false, message: 'تبلیغ فعال پیدا نشد.' });
    }

    const rawMetrics = updated.metrics && typeof updated.metrics.toObject === 'function'
      ? updated.metrics.toObject()
      : { ...(updated.metrics || {}) };

    return res.json({
      success: true,
      metrics: {
        ...rawMetrics,
        ctr: calcCtr(rawMetrics)
      }
    });
  } catch (err) {
    console.error('similar promotions trackPromotionEvent error:', err);
    return res.status(500).json({ success: false, message: 'خطا در ثبت رخداد تبلیغ.' });
  }
};

exports.expireExpiredPromotions = expireExpiredPromotions;
