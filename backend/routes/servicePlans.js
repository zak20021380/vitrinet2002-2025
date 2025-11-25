const express = require('express');
const router = express.Router();

const ServicePlan = require('../models/servicePlan');
const ServicePlanSubscription = require('../models/servicePlanSubscription');
const ServicePlanDiscountCode = require('../models/servicePlanDiscountCode');
const ServiceShop = require('../models/serviceShop');
const auth = require('../middlewares/authMiddleware');
const { normalizePhone, buildDigitInsensitiveRegex, buildPhoneCandidates } = require('../utils/phone');

const mapPlan = (plan) => ({
  id: String(plan._id),
  title: plan.title,
  slug: plan.slug,
  description: plan.description || '',
  price: plan.price,
  durationDays: plan.durationDays,
  // Treat plans with a missing flag as active to remain backwards compatible
  isActive: plan.isActive !== false,
  features: Array.isArray(plan.features)
    ? plan.features.map((feature) => typeof feature === 'string' ? feature : feature?.value).filter(Boolean)
    : [],
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt
});

const mapAssignment = (assignment) => ({
  id: String(assignment._id),
  serviceShop: assignment.serviceShop ? {
    id: String(assignment.serviceShop._id),
    name: assignment.serviceShop.name,
    ownerPhone: assignment.serviceShop.ownerPhone,
    city: assignment.serviceShop.city,
    shopUrl: assignment.serviceShop.shopUrl
  } : null,
  plan: assignment.servicePlan ? mapPlan(assignment.servicePlan) : assignment.planSnapshot,
  assignedPhone: assignment.assignedPhone,
  normalizedPhone: assignment.normalizedPhone,
  basePrice: assignment.basePrice,
  customPrice: assignment.customPrice,
  durationDays: assignment.durationDays,
  startDate: assignment.startDate,
  endDate: assignment.endDate,
  status: assignment.status,
  notes: assignment.notes,
  createdAt: assignment.createdAt,
  updatedAt: assignment.updatedAt
});

const mapDiscountCode = (code) => {
  if (!code) return null;
  const maxUsages = Number.isFinite(code.maxUsages) ? Number(code.maxUsages) : null;
  const usedCount = Number.isFinite(code.usedCount) ? Number(code.usedCount) : 0;
  const remainingUses = maxUsages == null ? null : Math.max(maxUsages - usedCount, 0);
  return {
    id: String(code._id),
    code: code.code,
    discountPercent: code.discountPercent,
    maxUsages,
    usedCount,
    remainingUses,
    expiresAt: code.expiresAt,
    isActive: code.isActive !== false,
    notes: code.notes || '',
    createdAt: code.createdAt,
    updatedAt: code.updatedAt
  };
};

const normalizeDiscountCode = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-_]/g, '');
};

const toPositiveInt = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.floor(num);
};

const resolveExpiry = ({ expiresAt, expiresInValue, expiresInUnit }) => {
  if (expiresAt) {
    const parsed = new Date(expiresAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  const value = toPositiveInt(expiresInValue);
  if (!value) return null;
  const unit = String(expiresInUnit || '').toLowerCase();
  const now = Date.now();
  if (unit === 'hour' || unit === 'hours' || unit === 'h') {
    return new Date(now + value * 60 * 60 * 1000);
  }
  const days = unit === 'day' || unit === 'days' || unit === 'd'
    ? value
    : null;
  if (days != null) {
    return new Date(now + days * 24 * 60 * 60 * 1000);
  }
  // پیش‌فرض: روز
  return new Date(now + value * 24 * 60 * 60 * 1000);
};

const computeStatus = (startDate, endDate) => {
  const now = Date.now();
  const start = startDate ? new Date(startDate).getTime() : null;
  const end = endDate ? new Date(endDate).getTime() : null;
  if (start && start > now) return 'scheduled';
  if (end && end < now) return 'expired';
  return 'active';
};

const buildPlanSnapshot = (plan) => ({
  title: plan.title,
  slug: plan.slug,
  description: plan.description || '',
  durationDays: plan.durationDays,
  price: plan.price,
  features: Array.isArray(plan.features)
    ? plan.features.map((feature) => typeof feature === 'string' ? feature : feature?.value).filter(Boolean)
    : []
});

// -------- Plans CRUD --------
router.get('/', async (req, res) => {
  try {
    const plans = await ServicePlan.find().sort({ createdAt: -1 }).lean();
    res.json({ plans: plans.map(mapPlan) });
  } catch (error) {
    console.error('Failed to list service plans:', error);
    res.status(500).json({ message: 'خطا در دریافت لیست پلن‌ها' });
  }
});

router.post('/', auth('admin'), async (req, res) => {
  try {
    const { title, slug, description, price, durationDays, isActive = true, features = [] } = req.body || {};
    if (!title || !slug || price == null) {
      return res.status(400).json({ message: 'عنوان، اسلاگ و قیمت پلن الزامی است.' });
    }

    const normalizedSlug = String(slug).trim().toLowerCase();
    const featureList = Array.isArray(features)
      ? features.map((feature) => ({ value: String(feature).trim() })).filter((item) => item.value)
      : [];

    const plan = await ServicePlan.create({
      title: String(title).trim(),
      slug: normalizedSlug,
      description: description ? String(description).trim() : '',
      price: Number(price),
      durationDays: durationDays != null ? Number(durationDays) : undefined,
      isActive: Boolean(isActive),
      features: featureList,
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null
    });

    res.status(201).json({ plan: mapPlan(plan) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'اسلاگ وارد شده تکراری است.' });
    }
    console.error('Failed to create service plan:', error);
    res.status(500).json({ message: 'خطا در ایجاد پلن جدید' });
  }
});

router.put('/:id', auth('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, description, price, durationDays, isActive, features } = req.body || {};

    const plan = await ServicePlan.findById(id);
    if (!plan) {
      return res.status(404).json({ message: 'پلن مورد نظر یافت نشد.' });
    }

    if (title != null) plan.title = String(title).trim();
    if (slug != null) plan.slug = String(slug).trim().toLowerCase();
    if (description != null) plan.description = String(description).trim();
    if (price != null) plan.price = Number(price);
    if (durationDays != null) plan.durationDays = Number(durationDays);
    if (isActive != null) plan.isActive = Boolean(isActive);
    if (Array.isArray(features)) {
      plan.features = features.map((feature) => ({ value: String(feature).trim() })).filter((item) => item.value);
    }
    plan.updatedBy = req.user?.id || plan.updatedBy;

    await plan.save();

    res.json({ plan: mapPlan(plan) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'اسلاگ وارد شده تکراری است.' });
    }
    console.error('Failed to update service plan:', error);
    res.status(500).json({ message: 'خطا در بروزرسانی پلن' });
  }
});

router.delete('/:id', auth('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ServicePlan.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'پلن مورد نظر یافت نشد.' });
    }
    await ServicePlanSubscription.deleteMany({ servicePlan: id });
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete service plan:', error);
    res.status(500).json({ message: 'خطا در حذف پلن' });
  }
});

// -------- Discount Codes --------
router.get('/discount-codes', auth('admin'), async (req, res) => {
  try {
    const codes = await ServicePlanDiscountCode.find().sort({ createdAt: -1 }).lean();
    res.json({ discountCodes: codes.map(mapDiscountCode) });
  } catch (error) {
    console.error('Failed to list service plan discount codes:', error);
    res.status(500).json({ message: 'خطا در دریافت کدهای تخفیف' });
  }
});

router.post('/discount-codes', auth('admin'), async (req, res) => {
  try {
    const { code, discountPercent, maxUsages, expiresAt, expiresInValue, expiresInUnit, notes } = req.body || {};

    const normalizedCode = normalizeDiscountCode(code);
    if (!normalizedCode) {
      return res.status(400).json({ message: 'کد تخفیف را وارد کنید.' });
    }

    const percent = Number(discountPercent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      return res.status(400).json({ message: 'درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.' });
    }

    let normalizedMaxUsages = null;
    if (maxUsages !== undefined && maxUsages !== null && String(maxUsages).trim() !== '') {
      normalizedMaxUsages = toPositiveInt(maxUsages);
      if (!normalizedMaxUsages) {
        return res.status(400).json({ message: 'تعداد دفعات مجاز باید عددی بزرگتر از صفر باشد.' });
      }
    }

    let expiry = null;
    if (expiresAt || expiresInValue) {
      expiry = resolveExpiry({ expiresAt, expiresInValue, expiresInUnit });
      if (!expiry) {
        return res.status(400).json({ message: 'تاریخ انقضای وارد شده معتبر نیست.' });
      }
      if (expiry.getTime() <= Date.now()) {
        return res.status(400).json({ message: 'تاریخ انقضا باید در آینده باشد.' });
      }
    }

    const discount = await ServicePlanDiscountCode.create({
      code: normalizedCode,
      discountPercent: percent,
      maxUsages: normalizedMaxUsages,
      expiresAt: expiry,
      notes: notes ? String(notes).trim() : '',
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null
    });

    res.status(201).json({ discountCode: mapDiscountCode(discount) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'این کد تخفیف قبلاً ثبت شده است.' });
    }
    console.error('Failed to create service plan discount code:', error);
    res.status(500).json({ message: 'خطا در ثبت کد تخفیف' });
  }
});

router.patch('/discount-codes/:id', auth('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { discountPercent, maxUsages, isActive, expiresAt, expiresInValue, expiresInUnit, notes } = req.body || {};

    const discount = await ServicePlanDiscountCode.findById(id);
    if (!discount) {
      return res.status(404).json({ message: 'کد تخفیف مورد نظر یافت نشد.' });
    }

    if (discountPercent != null) {
      const percent = Number(discountPercent);
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        return res.status(400).json({ message: 'درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.' });
      }
      discount.discountPercent = percent;
    }

    if (maxUsages !== undefined) {
      if (maxUsages === null || String(maxUsages).trim() === '') {
        discount.maxUsages = null;
      } else {
        const normalizedMaxUsages = toPositiveInt(maxUsages);
        if (!normalizedMaxUsages) {
          return res.status(400).json({ message: 'تعداد دفعات مجاز باید عددی بزرگتر از صفر باشد.' });
        }
        if (discount.usedCount > normalizedMaxUsages) {
          return res.status(400).json({ message: 'تعداد استفاده‌های ثبت‌شده بیشتر از سقف جدید است.' });
        }
        discount.maxUsages = normalizedMaxUsages;
      }
    }

    if (isActive != null) {
      discount.isActive = Boolean(isActive);
    }

    if ('expiresAt' in req.body || 'expiresInValue' in req.body || 'expiresInUnit' in req.body) {
      if (expiresAt === null || expiresAt === '' || expiresInValue === '' || expiresInValue === null) {
        discount.expiresAt = null;
      } else {
        const expiry = resolveExpiry({ expiresAt, expiresInValue, expiresInUnit });
        if (!expiry) {
          return res.status(400).json({ message: 'تاریخ انقضای وارد شده معتبر نیست.' });
        }
        if (expiry.getTime() <= Date.now()) {
          return res.status(400).json({ message: 'تاریخ انقضا باید در آینده باشد.' });
        }
        discount.expiresAt = expiry;
      }
    }

    if (notes !== undefined) {
      discount.notes = notes ? String(notes).trim() : '';
    }

    discount.updatedBy = req.user?.id || discount.updatedBy;
    await discount.save();

    res.json({ discountCode: mapDiscountCode(discount) });
  } catch (error) {
    console.error('Failed to update service plan discount code:', error);
    res.status(500).json({ message: 'خطا در بروزرسانی کد تخفیف' });
  }
});

router.delete('/discount-codes/:id', auth('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ServicePlanDiscountCode.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'کد تخفیف مورد نظر یافت نشد.' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete service plan discount code:', error);
    res.status(500).json({ message: 'خطا در حذف کد تخفیف' });
  }
});

router.post('/discount-codes/validate', auth('seller'), async (req, res) => {
  try {
    const { code } = req.body || {};
    const normalizedCode = normalizeDiscountCode(code);
    if (!normalizedCode) {
      return res.status(400).json({ message: 'کد تخفیف را وارد کنید.' });
    }

    const discount = await ServicePlanDiscountCode.findOne({ code: normalizedCode }).lean();
    if (!discount) {
      return res.status(404).json({ message: 'کد تخفیف یافت نشد.' });
    }
    if (discount.isActive === false) {
      return res.status(410).json({ message: 'این کد تخفیف غیرفعال شده است.' });
    }
    if (discount.expiresAt && new Date(discount.expiresAt).getTime() <= Date.now()) {
      return res.status(410).json({ message: 'تاریخ انقضای این کد گذشته است.' });
    }
    if (discount.maxUsages != null && Number(discount.usedCount || 0) >= Number(discount.maxUsages)) {
      return res.status(409).json({ message: 'سقف استفاده از این کد تکمیل شده است.' });
    }

    res.json({ discountCode: mapDiscountCode(discount) });
  } catch (error) {
    console.error('Failed to validate service plan discount code:', error);
    res.status(500).json({ message: 'خطا در بررسی کد تخفیف' });
  }
});

router.post('/discount-codes/:code/redeem', auth('seller'), async (req, res) => {
  try {
    const { code } = req.params;
    const { planId } = req.body || {};
    const normalizedCode = normalizeDiscountCode(code);
    if (!normalizedCode) {
      return res.status(400).json({ message: 'کد تخفیف معتبر نیست.' });
    }

    const discount = await ServicePlanDiscountCode.findOne({ code: normalizedCode });
    if (!discount) {
      return res.status(404).json({ message: 'کد تخفیف یافت نشد.' });
    }
    if (discount.isActive === false) {
      return res.status(410).json({ message: 'این کد تخفیف غیرفعال شده است.' });
    }
    if (discount.expiresAt && discount.expiresAt.getTime() <= Date.now()) {
      return res.status(410).json({ message: 'تاریخ انقضای این کد گذشته است.' });
    }
    if (discount.maxUsages != null && Number(discount.usedCount || 0) >= Number(discount.maxUsages)) {
      return res.status(409).json({ message: 'سقف استفاده از این کد تکمیل شده است.' });
    }

    const sellerId = req.user?.id ? String(req.user.id) : null;
    if (sellerId) {
      const hasAlreadyUsed = discount.usages?.some((usage) => usage.seller && String(usage.seller) === sellerId);
      if (hasAlreadyUsed) {
        return res.status(409).json({ message: 'این کد قبلاً برای حساب شما استفاده شده است.' });
      }
    }

    discount.usages.push({
      seller: req.user?.id || null,
      plan: planId || null,
      usedAt: new Date()
    });
    discount.usedCount = Array.isArray(discount.usages) ? discount.usages.length : Number(discount.usedCount || 0) + 1;
    await discount.save();

    res.json({ discountCode: mapDiscountCode(discount) });
  } catch (error) {
    console.error('Failed to redeem service plan discount code:', error);
    res.status(500).json({ message: 'خطا در ثبت استفاده از کد تخفیف' });
  }
});

// -------- Assignments --------
router.get('/assignments', async (req, res) => {
  try {
    const assignments = await ServicePlanSubscription.find()
      .populate('serviceShop', 'name ownerPhone city shopUrl')
      .populate('servicePlan')
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ assignments: assignments.map(mapAssignment) });
  } catch (error) {
    console.error('Failed to list service plan assignments:', error);
    res.status(500).json({ message: 'خطا در دریافت پلن‌های اختصاص داده شده' });
  }
});

router.post('/assignments', auth('admin'), async (req, res) => {
  try {
    const { phone, planId, serviceShopId, customPrice, durationDays, startDate, notes } = req.body || {};

    if (!planId || (!phone && !serviceShopId)) {
      return res.status(400).json({ message: 'شناسه پلن و یکی از شناسه مغازه یا شماره تلفن الزامی است.' });
    }

    let plan = await ServicePlan.findById(planId);
    if (!plan) {
      plan = await ServicePlan.findOne({ slug: String(planId).trim().toLowerCase() });
    }
    if (!plan) {
      return res.status(404).json({ message: 'پلن انتخابی یافت نشد.' });
    }

    let serviceShop = null;
    if (serviceShopId) {
      serviceShop = await ServiceShop.findById(serviceShopId);
    }

    const phoneToUse = phone || serviceShop?.ownerPhone;
    if (!phoneToUse) {
      return res.status(400).json({ message: 'شماره تلفن برای این فروشنده ثبت نشده است.' });
    }

    const normalizedPhone = normalizePhone(phoneToUse);
    if (!normalizedPhone) {
      return res.status(400).json({ message: 'شماره تلفن معتبر نیست.' });
    }

    if (!serviceShop) {
      const regex = buildDigitInsensitiveRegex(phoneToUse, { allowSeparators: true });
      const phoneCandidates = buildPhoneCandidates(phoneToUse);
      if (normalizedPhone && !phoneCandidates.includes(normalizedPhone)) {
        phoneCandidates.push(normalizedPhone);
      }
      if (normalizedPhone && normalizedPhone.startsWith('0')) {
        const withoutZero = normalizedPhone.slice(1);
        if (withoutZero) {
          phoneCandidates.push(`98${withoutZero}`, `+98${withoutZero}`);
        }
      }

      const queryConditions = [];
      if (phoneCandidates.length) {
        queryConditions.push({ ownerPhone: { $in: phoneCandidates } });
      }
      if (regex) {
        queryConditions.push({ ownerPhone: { $regex: regex } });
      }

      const shopQuery = queryConditions.length === 0
        ? { ownerPhone: normalizedPhone }
        : queryConditions.length === 1
          ? queryConditions[0]
          : { $or: queryConditions };

      serviceShop = await ServiceShop.findOne(shopQuery);
    }

    if (!serviceShop) {
      return res.status(404).json({ message: 'فروشنده خدماتی با این شماره یافت نشد.' });
    }

    const effectiveDuration = durationDays != null && durationDays !== ''
      ? Number(durationDays)
      : plan.durationDays;

    const start = startDate ? new Date(startDate) : new Date();
    const end = Number.isFinite(effectiveDuration) && effectiveDuration > 0
      ? new Date(start.getTime() + effectiveDuration * 24 * 60 * 60 * 1000)
      : null;

    const assignment = await ServicePlanSubscription.findOneAndUpdate(
      { serviceShop: serviceShop._id },
      {
        serviceShop: serviceShop._id,
        servicePlan: plan._id,
        assignedBy: req.user?.id || null,
        assignedPhone: String(phoneToUse).trim(),
        normalizedPhone,
        basePrice: plan.price,
        customPrice: customPrice != null && customPrice !== '' ? Number(customPrice) : null,
        durationDays: Number.isFinite(effectiveDuration) ? effectiveDuration : plan.durationDays,
        startDate: start,
        endDate: end,
        status: computeStatus(start, end),
        notes: notes ? String(notes).trim() : '',
        planSnapshot: buildPlanSnapshot(plan)
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate('serviceShop', 'name ownerPhone city shopUrl').populate('servicePlan');

    // Sync complimentary plan status on the service shop so the admin dashboard immediately reflects the change
    const complimentaryPlan = {
      isActive: true,
      durationDays: Number.isFinite(effectiveDuration) ? effectiveDuration : null,
      startDate: start,
      endDate: end,
      note: notes ? String(notes).trim() : '',
      planId: plan._id,
      title: plan.title,
      slug: plan.slug,
      source: 'admin-assignment'
    };

    await ServiceShop.findByIdAndUpdate(serviceShop._id, {
      $set: { complimentaryPlan }
    });

    res.status(201).json({ assignment: mapAssignment(assignment) });
  } catch (error) {
    console.error('Failed to assign service plan:', error);
    res.status(500).json({ message: 'خطا در اختصاص پلن به فروشنده' });
  }
});

router.patch('/assignments/:id', auth('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { customPrice, durationDays, startDate, notes, status } = req.body || {};

    const assignment = await ServicePlanSubscription.findById(id).populate('servicePlan');
    if (!assignment) {
      return res.status(404).json({ message: 'رکورد اختصاص پلن یافت نشد.' });
    }

    if (customPrice !== undefined) {
      assignment.customPrice = customPrice === null || customPrice === '' ? null : Number(customPrice);
    }
    if (durationDays !== undefined) {
      assignment.durationDays = durationDays === null || durationDays === '' ? assignment.planSnapshot?.durationDays || assignment.servicePlan?.durationDays || assignment.durationDays : Number(durationDays);
    }
    if (startDate !== undefined) {
      assignment.startDate = startDate ? new Date(startDate) : new Date();
    }
    if (notes !== undefined) {
      assignment.notes = notes ? String(notes).trim() : '';
    }
    if (status !== undefined && ['active', 'scheduled', 'expired'].includes(status)) {
      assignment.status = status;
    }

    if (assignment.durationDays && assignment.startDate) {
      assignment.endDate = new Date(assignment.startDate.getTime() + assignment.durationDays * 24 * 60 * 60 * 1000);
    }

    assignment.status = computeStatus(assignment.startDate, assignment.endDate);
    await assignment.save();

    await assignment.populate('serviceShop', 'name ownerPhone city shopUrl');
    await assignment.populate('servicePlan');

    res.json({ assignment: mapAssignment(assignment) });
  } catch (error) {
    console.error('Failed to update plan assignment:', error);
    res.status(500).json({ message: 'خطا در بروزرسانی پلن فروشنده' });
  }
});

router.delete('/assignments/:id', auth('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ServicePlanSubscription.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'رکورد اختصاص پلن یافت نشد.' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete plan assignment:', error);
    res.status(500).json({ message: 'خطا در حذف پلن اختصاصی فروشنده' });
  }
});

module.exports = router;
