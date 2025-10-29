const Plan = require('../models/plan');
const {
  SUBSCRIPTION_PLANS,
  getDefaultDurationDays,
  getDefaultDescription,
  getDefaultFeatures
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

const buildBasePlan = (definition) => ({
  slug: definition.slug,
  title: definition.title,
  price: null,
  durationDays: definition.defaultDurationDays ?? null,
  description: definition.defaultDescription || '',
  features: [...(definition.defaultFeatures || [])],
  origin: 'default',
  lastUpdatedAt: null
});

const applyDocumentToPlan = (plan, doc) => {
  if (!doc) return plan;
  if (doc.price != null) plan.price = doc.price;
  if (doc.durationDays != null) plan.durationDays = doc.durationDays;
  if (doc.description != null) plan.description = doc.description;
  if (Array.isArray(doc.features)) plan.features = doc.features;
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

      planPayload[slug] = {
        title: definition.title,
        price,
        durationDays,
        description: description || getDefaultDescription(slug),
        features: features.length ? features : getDefaultFeatures(slug)
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
