const mongoose = require('mongoose');
const Category = require('../models/Category');

const { CATEGORY_TYPES } = Category;

const CACHE_TTL = 60 * 1000; // 60 seconds
const DEFAULT_SERVICE_CATEGORY_NAMES = ['خدمات', 'زیبایی', 'تالار و مجالس', 'خودرو', 'ورزشی'];

let cachedPayload = null;
let cacheExpiresAt = 0;

function normaliseName(value) {
  return Category.normaliseName(value);
}

function slugify(value) {
  return Category.slugify(value);
}

function toPlainCategory(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug,
    type: doc.type,
    parent: doc.parent ? String(doc.parent) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

function buildPayload(docs) {
  const categories = [];
  const serviceSubcategories = [];

  docs.forEach(doc => {
    const plain = toPlainCategory(doc);
    if (!plain || !plain.name) return;
    if (doc.type === 'service-subcategory') {
      serviceSubcategories.push(plain);
    } else {
      categories.push(plain);
    }
  });

  const localeCompare = (a, b) => a.name.localeCompare(b.name, 'fa-IR', { sensitivity: 'base' });

  categories.sort(localeCompare);
  serviceSubcategories.sort(localeCompare);

  const payload = {
    categories,
    serviceSubcategories,
    metadata: {
      fetchedAt: new Date().toISOString(),
      serviceCategoryNames: Array.from(new Set([...DEFAULT_SERVICE_CATEGORY_NAMES]))
    }
  };

  return payload;
}

function getCachedPayload() {
  if (cachedPayload && cacheExpiresAt > Date.now()) {
    return cachedPayload;
  }
  return null;
}

function setCache(payload) {
  cachedPayload = payload;
  cacheExpiresAt = Date.now() + CACHE_TTL;
}

function invalidateCache() {
  cachedPayload = null;
  cacheExpiresAt = 0;
}

exports.getCategoryCollections = async (req, res, next) => {
  try {
    const cached = getCachedPayload();
    if (cached) {
      return res.json({ ...cached, metadata: { ...cached.metadata, cached: true } });
    }

    const docs = await Category.find({});
    const payload = buildPayload(docs);
    setCache(payload);

    return res.json({ ...payload, metadata: { ...payload.metadata, cached: false } });
  } catch (error) {
    return next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, type } = req.body || {};
    const normalisedName = normaliseName(name);
    const normalisedType = typeof type === 'string' ? type.trim() : 'category';

    if (!normalisedName || normalisedName.length < 2) {
      return res.status(400).json({ message: 'عنوان دسته معتبر نیست.' });
    }

    if (!CATEGORY_TYPES.includes(normalisedType)) {
      return res.status(400).json({ message: 'نوع دسته‌بندی نامعتبر است.' });
    }

    const slug = slugify(normalisedName);
    if (!slug) {
      return res.status(400).json({ message: 'امکان ساخت شناسه برای این عنوان وجود ندارد.' });
    }

    const existing = await Category.findOne({ slug, type: normalisedType });
    if (existing) {
      return res.status(409).json({
        message: `این ${normalisedType === 'service-subcategory' ? 'زیرگروه' : 'دسته'} از قبل وجود دارد.`,
        data: toPlainCategory(existing)
      });
    }

    const category = await Category.create({ name: normalisedName, slug, type: normalisedType });
    invalidateCache();

    return res.status(201).json({
      message: `${normalisedType === 'service-subcategory' ? 'زیرگروه' : 'دسته'} با موفقیت افزوده شد.`,
      data: toPlainCategory(category)
    });
  } catch (error) {
    return next(error);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const { id, type, name } = req.body || {};

    const normalisedType = typeof type === 'string' ? type.trim() : '';
    if (!CATEGORY_TYPES.includes(normalisedType)) {
      return res.status(400).json({ message: 'نوع دسته‌بندی نامعتبر است.' });
    }

    const filters = { type: normalisedType };
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      filters._id = id;
    } else if (name) {
      const slug = slugify(name);
      filters.slug = slug;
    } else {
      return res.status(400).json({ message: 'شناسه یا عنوان برای حذف الزامی است.' });
    }

    const removed = await Category.findOneAndDelete(filters);
    if (!removed) {
      return res.status(404).json({ message: 'موردی برای حذف یافت نشد.' });
    }

    invalidateCache();

    return res.json({
      message: `${normalisedType === 'service-subcategory' ? 'زیرگروه' : 'دسته'} حذف شد.`,
      data: toPlainCategory(removed)
    });
  } catch (error) {
    return next(error);
  }
};
