const Setting = require('../models/setting');

const SELLER_PLANS_KEY = 'feature:seller-plans';
const DEFAULT_FLAGS = {
  sellerPlansEnabled: false
};

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
