const Plan = require('../models/plan');
const {
  SUBSCRIPTION_PLANS,
  BADGE_VARIANTS,
  getDefaultDurationDays,
  getDefaultDescription,
  getDefaultFeatures,
  getDefaultBadge
} = require('../config/subscriptionPlans');

const SUBSCRIPTION_PLAN_SLUGS = SUBSCRIPTION_PLANS.map(plan => plan.slug);

const sanitizeFeatures = (rawValue) => {
  if (!rawValue) return [];
  const list = Array.isArray(rawValue)
    ? rawValue
    : String(rawValue).split(/\r?\n/);

  return list
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 12);
};

const parseOptionalBoolean = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (['false', '0', 'no', 'off', 'غیر فعال', 'غیرفعال'].includes(normalized)) {
      return false;
    }
    return true;
  }
  return Boolean(value);
};

const buildBasePlan = (definition) => {
  const badge = getDefaultBadge(definition.slug) || {};
  return {
    slug: definition.slug,
    title: definition.title,
    price: null,
    durationDays: definition.defaultDurationDays ?? null,
    description: definition.defaultDescription || '',
    features: [...(definition.defaultFeatures || [])],
    badgeLabel: badge.label || '',
    badgeVariant: badge.variant || BADGE_VARIANTS[0],
    badgeVisible: badge.visible !== undefined ? !!badge.visible : !!badge.label,
    origin: 'default',
    lastUpdatedAt: null
  };
};

const applyDocumentToPlan = (plan, doc) => {
  if (!doc) return plan;
  if (doc.title) plan.title = doc.title;
  if (doc.price != null) plan.price = doc.price;
  if (doc.durationDays != null) plan.durationDays = doc.durationDays;
  if (doc.description != null) plan.description = doc.description;
  if (Array.isArray(doc.features)) plan.features = doc.features;
  if (doc.badgeLabel != null) plan.badgeLabel = doc.badgeLabel;
  if (doc.badgeVariant) {
    plan.badgeVariant = BADGE_VARIANTS.includes(doc.badgeVariant)
      ? doc.badgeVariant
      : plan.badgeVariant;
  }
  if (doc.badgeVisible != null) plan.badgeVisible = !!doc.badgeVisible;
  plan.lastUpdatedAt = doc.updatedAt || doc.createdAt || plan.lastUpdatedAt;
  plan.origin = doc.sellerPhone ? 'seller-override' : 'global';
  return plan;
};

/* ── GET  /api/plans ─────────────────────────────── */
/* خروجی جدید: { plans : { "1month": { price, durationDays, ... } } } */
exports.getPlans = async (req, res) => {
  try {
    let { sellerPhone } = req.query;
    if (sellerPhone) {
      sellerPhone = sellerPhone.trim().replace(/\D/g, '');  // نرمالایز: فقط اعداد نگه دار
      if (sellerPhone.length === 10 && sellerPhone.startsWith('9')) sellerPhone = '0' + sellerPhone;
    }

    const globalPlans = await Plan.find({
      slug: { $in: SUBSCRIPTION_PLAN_SLUGS },
      sellerPhone: null
    }).lean();

    const overridePlans = sellerPhone
      ? await Plan.find({
          slug: { $in: SUBSCRIPTION_PLAN_SLUGS },
          sellerPhone
        }).lean()
      : [];

    const globalMap = new Map(globalPlans.map(doc => [doc.slug, doc]));
    const overrideMap = new Map(overridePlans.map(doc => [doc.slug, doc]));

    const merged = {};

    SUBSCRIPTION_PLANS.forEach(definition => {
      const basePlan = buildBasePlan(definition);
      const appliedGlobal = applyDocumentToPlan(basePlan, globalMap.get(definition.slug));
      const finalPlan = applyDocumentToPlan(appliedGlobal, overrideMap.get(definition.slug));

      merged[definition.slug] = finalPlan;
    });

    return res.json({
      success: true,
      plans: merged,
      meta: {
        sellerPhone: sellerPhone || null
      }
    });
  } catch (err) {
    console.error('getPlans ❌', err);
    return res.status(500).json({ success:false, message:'خطا در دریافت پلن‌ها' });
  }
};

/* ── PUT /api/plans/admin ─────────────────────────── */
/* بدنهٔ جدید (گلوبال):
   {
     "plans": {
       "1month": {
         "price": 69000,
         "durationDays": 30,
         "description": "...",
         "features": ["..."]
       }
     }
   }

   بدنهٔ نمونه (اختصاصی فروشنده):
   {
     "sellerPhone": "09121234567",
     "plans": {
       "1month": { "price": 79000, "durationDays": 35, "features": ["..."] }
     }
   }
*/
exports.updatePlans = async (req, res) => {
  try {
    const body        = req.body || {};
    const incoming    = body.plans || {};
    const legacyPrices = body.prices || {};

    let sellerPhone = (body.sellerPhone || '').toString().trim() || null;  // «» → null

    if (sellerPhone) {
      sellerPhone = sellerPhone.replace(/\D/g, '');
      if (sellerPhone.length === 10 && sellerPhone.startsWith('9')) {
        sellerPhone = '0' + sellerPhone;
      }
      if (!/^09\d{9}$/.test(sellerPhone)) {
        return res
          .status(400)
          .json({ success:false, message:'فرمت شماره موبایل درست نیست (مثال: 09123456789 یا 9123456789).' });
      }
    }

    const planPayload = {};

    for (const definition of SUBSCRIPTION_PLANS) {
      const slug = definition.slug;
      const payload = incoming[slug] || (legacyPrices[slug] != null ? { price: legacyPrices[slug] } : null);
      if (!payload) continue;

      const rawTitle = Object.prototype.hasOwnProperty.call(payload, 'title')
        ? String(payload.title ?? '').trim()
        : definition.title;
      const title = (rawTitle || definition.title).slice(0, 120);

      const price = Number(payload.price);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ success:false, message:`قیمت پلن «${definition.title}» نامعتبر است.` });
      }

      let durationDays;
      if (Object.prototype.hasOwnProperty.call(payload, 'durationDays')) {
        durationDays = Number(payload.durationDays);
      } else {
        durationDays = getDefaultDurationDays(slug) ?? 30;
      }

      if (!Number.isFinite(durationDays) || durationDays <= 0 || durationDays > 3650) {
        return res.status(400).json({ success:false, message:`مدت زمان پلن «${definition.title}» باید بین ۱ تا ۳۶۵۰ روز باشد.` });
      }

      const description = Object.prototype.hasOwnProperty.call(payload, 'description')
        ? (payload.description ?? '').toString().trim()
        : getDefaultDescription(slug);

      const features = Object.prototype.hasOwnProperty.call(payload, 'features')
        ? sanitizeFeatures(payload.features)
        : getDefaultFeatures(slug);

      const defaultBadge = getDefaultBadge(slug) || {};
      const badgePayload = payload.badge || {};

      const rawBadgeLabel = Object.prototype.hasOwnProperty.call(payload, 'badgeLabel')
        ? payload.badgeLabel
        : Object.prototype.hasOwnProperty.call(badgePayload, 'label')
          ? badgePayload.label
          : defaultBadge.label;

      const badgeLabel = (rawBadgeLabel ?? '').toString().trim().slice(0, 60);

      let badgeVariant = Object.prototype.hasOwnProperty.call(payload, 'badgeVariant')
        ? payload.badgeVariant
        : Object.prototype.hasOwnProperty.call(badgePayload, 'variant')
          ? badgePayload.variant
          : defaultBadge.variant;

      badgeVariant = (badgeVariant ?? '').toString().trim();
      if (!BADGE_VARIANTS.includes(badgeVariant)) {
        badgeVariant = defaultBadge.variant || BADGE_VARIANTS[0];
      }

      let badgeVisibleRaw;
      if (Object.prototype.hasOwnProperty.call(payload, 'badgeVisible')) {
        badgeVisibleRaw = payload.badgeVisible;
      } else if (Object.prototype.hasOwnProperty.call(badgePayload, 'visible')) {
        badgeVisibleRaw = badgePayload.visible;
      } else if (Object.prototype.hasOwnProperty.call(defaultBadge, 'visible')) {
        badgeVisibleRaw = defaultBadge.visible;
      }

      const parsedVisible = parseOptionalBoolean(badgeVisibleRaw);
      const fallbackVisible = defaultBadge.visible !== undefined
        ? !!defaultBadge.visible
        : !!badgeLabel;
      const badgeVisible = parsedVisible === undefined ? fallbackVisible : parsedVisible;

      planPayload[slug] = {
        title,
        price,
        durationDays,
        description,
        features,
        badgeLabel,
        badgeVariant,
        badgeVisible: badgeVisible && !!badgeLabel
      };
    }

    const entries = Object.entries(planPayload);
    if (!entries.length) {
      return res
        .status(400)
        .json({ success:false, message:'هیچ دادهٔ معتبری برای پلن‌ها ارسال نشد.' });
    }

    await Promise.all(entries.map(([slug, payload]) =>
      Plan.findOneAndUpdate(
        { slug, sellerPhone },
        {
          $set: {
            title: payload.title,
            price: payload.price,
            durationDays: payload.durationDays,
            description: payload.description,
            features: payload.features,
            badgeLabel: payload.badgeLabel,
            badgeVariant: payload.badgeVariant,
            badgeVisible: payload.badgeVisible,
            sellerPhone
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    ));

    return res.json({
      success : true,
      message : `پلن‌ها برای ${
        sellerPhone ? `فروشندهٔ ${sellerPhone}` : 'پلن سراسری'
      } با موفقیت ذخیره شدند.`
    });

  } catch (err) {
    console.error('updatePlans ❌', err);
    return res
      .status(500)
      .json({ success:false, message:'خطا در ذخیرهٔ پلن‌ها' });
  }
};
