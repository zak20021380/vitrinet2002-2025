// controllers/sellerServicesController.js
// کنترلر سرویس‌های فروشندهٔ خدماتی (CRUD + endpoint عمومی با shopurl)

const mongoose = require('mongoose');
const Seller = require('../models/Seller');
const SellerService = require('../models/seller-services');
const {
  sanitizeSearchInput,
  buildSafeRegex,
  flagSuspiciousQuery,
  sanitizeForOutput
} = require('../utils/searchSecurity');

// -------- Helpers ----------
const toNumber = (v, def = undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const pick = (obj = {}, fields = []) =>
  fields.reduce((acc, f) => (obj[f] !== undefined ? (acc[f] = obj[f], acc) : acc), {});
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

const SELLER_SERVICE_SAFE_FIELDS = [
  '_id',
  'sellerId',
  'title',
  'price',
  'durationMinutes',
  'category',
  'tags',
  'desc',
  'images',
  'mainImageIndex',
  'isActive',
  'isBookable',
  'createdAt',
  'updatedAt'
];

// فیلدهای قابل‌ویرایش از سمت فروشنده
const ALLOWED_FIELDS = [
  'title', 'price', 'durationMinutes',
  'category', 'subcategory',
  'tags', 'badge', 'badgeType',
  'desc', 'images', 'mainImageIndex',
  'isActive'
];

// پاکسازی/normalize ورودی‌ها قبل از ذخیره
function normalizePayload(raw = {}) {
  const data = pick(raw, ALLOWED_FIELDS);

  // اجباری‌ها
  if (!isNonEmptyString(data.title)) {
    throw { status: 400, message: 'عنوان خدمت الزامی است.' };
  }
  if (raw.price == null || !Number.isFinite(Number(raw.price))) {
    throw { status: 400, message: 'قیمت معتبر وارد کنید.' };
  }

  data.title = data.title.trim();
  data.price = toNumber(raw.price, 0);
  if (data.price < 0) throw { status: 400, message: 'قیمت نمی‌تواند منفی باشد.' };

  // اختیاری‌ها
  if (raw.durationMinutes != null) {
    data.durationMinutes = clamp(toNumber(raw.durationMinutes, 30), 5, 24 * 60);
  }

  if (Array.isArray(raw.tags)) {
    data.tags = raw.tags
      .filter(t => typeof t === 'string')
      .map(t => t.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  if (Array.isArray(raw.images)) {
    data.images = raw.images
      .filter(u => typeof u === 'string')
      .map(u => u.trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  if (raw.mainImageIndex != null) {
    data.mainImageIndex = clamp(toNumber(raw.mainImageIndex, 0), 0, (data.images?.length || 1) - 1);
  }

  if (raw.category != null) data.category = String(raw.category || '').trim();
  if (raw.subcategory != null) data.subcategory = String(raw.subcategory || '').trim();
  if (raw.badge != null) data.badge = String(raw.badge || '').trim();
  if (raw.badgeType != null) data.badgeType = String(raw.badgeType || '').trim();

  if (raw.desc != null) data.desc = String(raw.desc || '').trim();
  if (raw.isActive != null) data.isActive = !!raw.isActive;

  return data;
}

// تأیید مالکیت سرویس
async function mustOwnService(sellerId, serviceId) {
  if (!mongoose.Types.ObjectId.isValid(serviceId)) return null;
  return SellerService.findOne({ _id: serviceId, sellerId });
}

// ---------- Seller (private) endpoints ----------

// GET /api/seller-services/me
// لیست سرویس‌های فروشندهٔ جاری با pagination، سرچ و فیلتر وضعیت
exports.getMyServices = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ message: 'دسترسی غیرمجاز.' });
    }

    const page = Math.max(1, toNumber(req.query.page, 1));
    const limit = clamp(toNumber(req.query.limit, 20), 1, 50);
    const { value: q, suspicious } = sanitizeSearchInput(req.query.q);
    const status = String(req.query.status || '').trim(); // 'active' | 'inactive' | ''

    const where = { sellerId: req.user.id };
    if (q) {
      const safeRegex = buildSafeRegex(q);
      where.$or = [
        { title: safeRegex },
        { tags: safeRegex },
        { category: safeRegex },
        { desc: safeRegex }
      ];
    }

    if (suspicious) {
      flagSuspiciousQuery(req, req.query.q, 'seller-services:search');
    }
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const [items, total] = await Promise.all([
      SellerService.find(where)
        .select(SELLER_SERVICE_SAFE_FIELDS.join(' '))
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SellerService.countDocuments(where),
    ]);

    return res.json(sanitizeForOutput({
      items,
      pagination: {
        page, limit, total, pages: Math.ceil(total / limit)
      }
    }));
  } catch (err) {
    console.error('getMyServices error:', err);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

// POST /api/seller-services
// ساخت سرویس جدید برای فروشندهٔ جاری
exports.createService = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ message: 'دسترسی غیرمجاز.' });
    }

    const data = normalizePayload(req.body);
    data.sellerId = req.user.id;

    const created = await SellerService.create(data);
    return res.status(201).json({ item: created });
  } catch (err) {
    console.error('createService error:', err);
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'داده‌های نامعتبر.', details: err.errors });
    }
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

// GET /api/seller-services/:id
// دریافت یک سرویس (فقط مالک)
exports.getServiceById = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ message: 'دسترسی غیرمجاز.' });
    }
    const svc = await mustOwnService(req.user.id, req.params.id);
    if (!svc) return res.status(404).json({ message: 'سرویس پیدا نشد.' });
    return res.json({ item: svc });
  } catch (err) {
    console.error('getServiceById error:', err);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

// PUT /api/seller-services/:id
// ویرایش سرویس (فقط مالک)
exports.updateService = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ message: 'دسترسی غیرمجاز.' });
    }

    const svc = await mustOwnService(req.user.id, req.params.id);
    if (!svc) return res.status(404).json({ message: 'سرویس پیدا نشد.' });

    const data = normalizePayload(req.body);
    Object.assign(svc, data);
    await svc.save();

    return res.json({ item: svc });
  } catch (err) {
    console.error('updateService error:', err);
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'داده‌های نامعتبر.', details: err.errors });
    }
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

// PATCH /api/seller-services/:id/toggle
// تغییر سریع وضعیت فعال/غیرفعال (فقط مالک)
exports.toggleActive = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ message: 'دسترسی غیرمجاز.' });
    }
    const svc = await mustOwnService(req.user.id, req.params.id);
    if (!svc) return res.status(404).json({ message: 'سرویس پیدا نشد.' });

    const next = req.body.isActive != null ? !!req.body.isActive : !svc.isActive;
    svc.isActive = next;
    await svc.save();

    return res.json({ item: svc });
  } catch (err) {
    console.error('toggleActive error:', err);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

// DELETE /api/seller-services/:id
// حذف سرویس (فقط مالک)
exports.deleteService = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'seller') {
      return res.status(403).json({ message: 'دسترسی غیرمجاز.' });
    }
    const svc = await mustOwnService(req.user.id, req.params.id);
    if (!svc) return res.status(404).json({ message: 'سرویس پیدا نشد.' });

    await SellerService.deleteOne({ _id: svc._id });
    return res.json({ message: 'سرویس حذف شد.' });
  } catch (err) {
    console.error('deleteService error:', err);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

// ---------- Public endpoint (no auth) ----------
// GET /api/seller-services/public/:shopurl
// سرویس‌های فعالِ یک فروشگاه خدماتی بر اساس shopurl (برای صفحهٔ عمومی فروشگاه)
exports.getActiveServicesByShopUrl = async (req, res) => {
  try {
    const { shopurl } = req.params;
    if (!isNonEmptyString(shopurl)) {
      return res.status(400).json({ message: 'shopurl نامعتبر است.' });
    }

    const seller = await Seller.findOne({ shopurl }).select('_id');
    if (!seller) {
      return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    }

    const items = await SellerService.find({
      sellerId: seller._id,
      isActive: true
    }).sort({ price: 1, createdAt: -1 }); // مثلاً مرتب‌سازی پیش‌فرض

    return res.json({ items, sellerId: seller._id });
  } catch (err) {
    console.error('getActiveServicesByShopUrl error:', err);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};
