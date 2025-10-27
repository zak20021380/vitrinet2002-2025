const express = require('express');
const router = express.Router();

const ServicePlan = require('../models/servicePlan');
const ServicePlanSubscription = require('../models/servicePlanSubscription');
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
  isActive: !!plan.isActive,
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
    const { phone, planId, customPrice, durationDays, startDate, notes } = req.body || {};

    if (!phone || !planId) {
      return res.status(400).json({ message: 'شماره تلفن و پلن انتخابی الزامی است.' });
    }

    const plan = await ServicePlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'پلن انتخابی یافت نشد.' });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ message: 'شماره تلفن معتبر نیست.' });
    }

    const regex = buildDigitInsensitiveRegex(phone, { allowSeparators: true });
    const phoneCandidates = buildPhoneCandidates(phone);
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

    const serviceShop = await ServiceShop.findOne(shopQuery);

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
        assignedPhone: String(phone).trim(),
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
