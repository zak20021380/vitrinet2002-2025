const Category = require('../models/Category');

const DEFAULT_CATEGORIES = [
  'پوشاک',
  'خوراک',
  'خدمات',
  'دیجیتال',
  'زیبایی',
  'کتاب و تحریر',
  'لوازم خانگی',
  'ورزشی',
  'تالار و مجالس',
  'قنادی و شیرینی',
  'گل و گیاه',
  'خودرو',
  'کودکان'
];

const DEFAULT_SERVICE_SUBCATEGORIES = [
  'آرایشگاه مردانه',
  'آرایشگاه زنانه',
  'کارواش',
  'کلینیک زیبایی',
  'تعمیر موبایل',
  'آتلیه عکاسی',
  'خیاطی',
  'آرایش حیوانات'
];

const CATEGORY_CACHE_TTL = 1000 * 60; // 1 minute
let categoryCache = { data: null, expiresAt: 0 };

function slugifyName(value = '') {
  return value
    .toString()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
    .toLowerCase();
}

function normaliseName(value = '') {
  return value.toString().replace(/\s+/g, ' ').trim();
}

async function ensureDefaultEntries() {
  const totalDocuments = await Category.estimatedDocumentCount();
  if (totalDocuments > 0) {
    return;
  }

  const operations = [];

  for (const name of DEFAULT_CATEGORIES) {
    const slug = slugifyName(name);
    operations.push(
      Category.updateOne(
        { type: 'category', slug },
        {
          $setOnInsert: { name, type: 'category' },
          $set: { isDefault: true }
        },
        { upsert: true }
      )
    );
  }

  for (const name of DEFAULT_SERVICE_SUBCATEGORIES) {
    const slug = slugifyName(name);
    operations.push(
      Category.updateOne(
        { type: 'service-subcategory', slug },
        {
          $setOnInsert: { name, type: 'service-subcategory' },
          $set: { isDefault: true }
        },
        { upsert: true }
      )
    );
  }

  if (operations.length) {
    await Promise.all(operations);
  }
}

function mapCategory(doc) {
  if (!doc) return null;
  return {
    id: doc._id,
    _id: doc._id,
    name: doc.name,
    slug: doc.slug,
    type: doc.type,
    isDefault: Boolean(doc.isDefault)
  };
}

function invalidateCache() {
  categoryCache = { data: null, expiresAt: 0 };
}

async function getCategoryLists(req, res) {
  try {
    if (categoryCache.data && categoryCache.expiresAt > Date.now()) {
      return res.json(categoryCache.data);
    }

    await ensureDefaultEntries();

    const [categories, serviceSubcategories] = await Promise.all([
      Category.find({ type: 'category' }).sort({ name: 1 }).lean(),
      Category.find({ type: 'service-subcategory' }).sort({ name: 1 }).lean()
    ]);

    const payload = {
      categories: categories.map(mapCategory),
      serviceSubcategories: serviceSubcategories.map(mapCategory),
      refreshedAt: new Date().toISOString()
    };

    categoryCache = {
      data: payload,
      expiresAt: Date.now() + CATEGORY_CACHE_TTL
    };

    return res.json(payload);
  } catch (error) {
    console.error('getCategoryLists error ->', error);
    return res.status(500).json({ message: 'خطا در دریافت دسته‌بندی‌ها.' });
  }
}

async function createCategory(req, res) {
  try {
    const { name, type } = req.body || {};
    const normalisedName = normaliseName(name);
    if (!normalisedName) {
      return res.status(400).json({ message: 'عنوان دسته را وارد کنید.' });
    }
    if (normalisedName.length < 2) {
      return res.status(400).json({ message: 'عنوان دسته باید حداقل ۲ کاراکتر باشد.' });
    }

    const categoryType = type === 'service-subcategory' ? 'service-subcategory' : 'category';
    const slug = slugifyName(normalisedName);

    const existing = await Category.findOne({ type: categoryType, slug });
    if (existing) {
      return res.status(409).json({ message: 'این عنوان از قبل وجود دارد.' });
    }

    const category = await Category.create({
      name: normalisedName,
      type: categoryType,
      isDefault: false
    });

    invalidateCache();

    return res.status(201).json({
      message: 'دسته جدید با موفقیت ثبت شد.',
      item: mapCategory(category)
    });
  } catch (error) {
    console.error('createCategory error ->', error);
    return res.status(500).json({ message: 'خطا در ثبت دسته جدید.' });
  }
}

async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'شناسه دسته نامعتبر است.' });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'دسته پیدا نشد.' });
    }

    await category.deleteOne();
    invalidateCache();

    return res.json({
      message: 'دسته حذف شد.',
      item: mapCategory(category)
    });
  } catch (error) {
    console.error('deleteCategory error ->', error);
    return res.status(500).json({ message: 'خطا در حذف دسته.' });
  }
}

module.exports = {
  getCategoryLists,
  createCategory,
  deleteCategory
};
