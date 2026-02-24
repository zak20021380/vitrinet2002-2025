const Setting = require('../models/setting');

const SELLER_PLANS_KEY = 'feature:seller-plans';
const SMART_SEARCH_KEY = 'feature:smart-search';

const DEFAULT_FLAGS = {
  sellerPlansEnabled: false
};

const SMART_SEARCH_EXAMPLE_MIN = 2;
const SMART_SEARCH_EXAMPLE_MAX = 3;
const SMART_SEARCH_EXAMPLE_MAX_LENGTH = 160;
const SMART_SEARCH_DEFAULTS = Object.freeze({
  enabled: true,
  examples: [
    'نزدیک‌ترین فروشگاهی که کیف چرمی با ارسال فوری دارد را پیدا کن',
    'یک مغازه برای مقایسه قیمت گوشی در سنندج پیشنهاد بده',
    'مرکز خریدی با تنوع کفش ورزشی و پارکینگ نزدیک پیدا کن'
  ]
});

const TRUE_SET = new Set(['1', 'true', 'yes', 'on', 'enable', 'enabled', 'فعال', 'روشن', 'active']);
const FALSE_SET = new Set(['0', 'false', 'no', 'off', 'disable', 'disabled', 'غیرفعال', 'خاموش', 'inactive']);

const parseBoolean = (value, fallback = null) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (TRUE_SET.has(normalized)) return true;
    if (FALSE_SET.has(normalized)) return false;
    return fallback;
  }
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'enabled')) {
      return parseBoolean(value.enabled, fallback);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'value')) {
      return parseBoolean(value.value, fallback);
    }
  }
  return fallback;
};

const normalizeFlags = (raw = {}) => ({
  sellerPlansEnabled: parseBoolean(raw.sellerPlansEnabled, DEFAULT_FLAGS.sellerPlansEnabled)
});

const normalizeSmartSearchExample = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const normalizeSmartSearchExamplesForRead = (examples) => {
  if (!Array.isArray(examples)) return [];
  return examples
    .map((item) => (typeof item === 'string' ? normalizeSmartSearchExample(item) : ''))
    .filter((item) => item.length > 0 && item.length <= SMART_SEARCH_EXAMPLE_MAX_LENGTH)
    .slice(0, SMART_SEARCH_EXAMPLE_MAX);
};

const normalizeSmartSearchSettings = (raw = {}) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const enabled = parseBoolean(source.enabled, SMART_SEARCH_DEFAULTS.enabled);
  const examples = normalizeSmartSearchExamplesForRead(source.examples);

  return {
    enabled,
    examples:
      examples.length >= SMART_SEARCH_EXAMPLE_MIN && examples.length <= SMART_SEARCH_EXAMPLE_MAX
        ? examples
        : SMART_SEARCH_DEFAULTS.examples.slice()
  };
};

const buildMeta = (doc) => {
  if (!doc) return { updatedAt: null, updatedBy: null };
  const updatedBy = doc.updatedBy;
  if (!updatedBy) {
    return {
      updatedAt: doc.updatedAt || null,
      updatedBy: null
    };
  }

  const id = updatedBy._id || updatedBy.id || updatedBy;
  return {
    updatedAt: doc.updatedAt || null,
    updatedBy: {
      id: id ? id.toString() : null,
      name: updatedBy.name || null,
      phone: updatedBy.phone || null
    }
  };
};

const buildSmartSearchResponse = (doc) => {
  const source = doc && doc.value && typeof doc.value === 'object' ? doc.value : {};
  const normalized = normalizeSmartSearchSettings(source);

  return {
    enabled: normalized.enabled,
    examples: normalized.examples,
    updatedAt: doc?.updatedAt || null
  };
};

async function loadSellerPlansSetting(populate = false) {
  const query = Setting.findOne({ key: SELLER_PLANS_KEY });
  if (populate) {
    query.populate('updatedBy', 'name phone');
  }
  const doc = await query.lean();
  if (!doc) {
    return {
      doc: null,
      flags: { ...DEFAULT_FLAGS },
      meta: { updatedAt: null, updatedBy: null }
    };
  }

  const flags = normalizeFlags({ sellerPlansEnabled: parseBoolean(doc.value, DEFAULT_FLAGS.sellerPlansEnabled) });
  return {
    doc,
    flags,
    meta: buildMeta(doc)
  };
}

exports.getFeatureFlags = async (req, res) => {
  try {
    const { flags, meta } = await loadSellerPlansSetting(true);
    return res.json({
      success: true,
      flags,
      meta: { sellerPlans: meta }
    });
  } catch (err) {
    console.error('settings.getFeatureFlags ❌', err);
    return res.status(500).json({ success: false, message: 'خطا در دریافت تنظیمات.' });
  }
};

exports.getPublicFeatureFlags = async (req, res) => {
  try {
    const { flags } = await loadSellerPlansSetting(false);
    return res.json({ success: true, flags });
  } catch (err) {
    console.error('settings.getPublicFeatureFlags ❌', err);
    return res.status(500).json({ success: false, message: 'خطا در دریافت تنظیمات.' });
  }
};

exports.updateFeatureFlags = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!Object.prototype.hasOwnProperty.call(payload, 'sellerPlansEnabled')) {
      return res.status(400).json({ success: false, message: 'وضعیت جدید ارسال نشده است.' });
    }

    const parsed = parseBoolean(payload.sellerPlansEnabled, null);
    if (parsed === null) {
      return res.status(400).json({ success: false, message: 'مقدار ارسال شده معتبر نیست.' });
    }

    const adminId = req.user?.id || null;

    await Setting.findOneAndUpdate(
      { key: SELLER_PLANS_KEY },
      {
        $set: {
          value: { enabled: parsed },
          updatedBy: adminId || null
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const { flags, meta } = await loadSellerPlansSetting(true);

    return res.json({
      success: true,
      message: `نمایش پلن‌ها ${flags.sellerPlansEnabled ? 'فعال' : 'غیرفعال'} شد.`,
      flags,
      meta: { sellerPlans: meta }
    });
  } catch (err) {
    console.error('settings.updateFeatureFlags ❌', err);
    return res.status(500).json({ success: false, message: 'ذخیره تنظیمات انجام نشد.' });
  }
};

exports.getSmartSearchSettings = async (req, res) => {
  try {
    const doc = await Setting.findOne({ key: SMART_SEARCH_KEY }).lean();
    return res.json(buildSmartSearchResponse(doc));
  } catch (err) {
    console.error('settings.getSmartSearchSettings ❌', err);
    return res.status(500).json({ message: 'خطا در دریافت تنظیمات جستجوی هوشمند.' });
  }
};

exports.updateSmartSearchSettings = async (req, res) => {
  try {
    const payload = req.body || {};

    if (!Object.prototype.hasOwnProperty.call(payload, 'enabled')) {
      return res.status(400).json({ message: 'وضعیت فعال یا غیرفعال ارسال نشده است.' });
    }
    if (!Object.prototype.hasOwnProperty.call(payload, 'examples')) {
      return res.status(400).json({ message: 'نمونه‌جمله‌ها ارسال نشده است.' });
    }

    const enabled = parseBoolean(payload.enabled, null);
    if (enabled === null) {
      return res.status(400).json({ message: 'مقدار enabled معتبر نیست.' });
    }

    if (!Array.isArray(payload.examples)) {
      return res.status(400).json({ message: 'examples باید آرایه باشد.' });
    }

    if (
      payload.examples.length < SMART_SEARCH_EXAMPLE_MIN ||
      payload.examples.length > SMART_SEARCH_EXAMPLE_MAX
    ) {
      return res.status(400).json({
        message: `تعداد مثال‌ها باید بین ${SMART_SEARCH_EXAMPLE_MIN} تا ${SMART_SEARCH_EXAMPLE_MAX} باشد.`
      });
    }

    const normalizedExamples = [];
    for (let index = 0; index < payload.examples.length; index += 1) {
      const rawExample = payload.examples[index];
      if (typeof rawExample !== 'string') {
        return res.status(400).json({ message: `مثال شماره ${index + 1} باید متن باشد.` });
      }

      const normalized = normalizeSmartSearchExample(rawExample);
      if (!normalized) {
        return res.status(400).json({ message: `مثال شماره ${index + 1} نمی‌تواند خالی باشد.` });
      }

      if (normalized.length > SMART_SEARCH_EXAMPLE_MAX_LENGTH) {
        return res.status(400).json({
          message: `طول مثال شماره ${index + 1} نباید بیشتر از ${SMART_SEARCH_EXAMPLE_MAX_LENGTH} کاراکتر باشد.`
        });
      }

      normalizedExamples.push(normalized);
    }

    const adminId = req.user?.id || null;

    const updatedDoc = await Setting.findOneAndUpdate(
      { key: SMART_SEARCH_KEY },
      {
        $set: {
          value: {
            enabled,
            examples: normalizedExamples
          },
          updatedBy: adminId || null
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json(buildSmartSearchResponse(updatedDoc));
  } catch (err) {
    console.error('settings.updateSmartSearchSettings ❌', err);
    return res.status(500).json({ message: 'ذخیره تنظیمات جستجوی هوشمند انجام نشد.' });
  }
};
