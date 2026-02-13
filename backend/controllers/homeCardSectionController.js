const mongoose = require('mongoose');
const HomeCardSection = require('../models/homeCardSection');

const normaliseSlug = HomeCardSection.normaliseSlug || ((slug) => slug);

function toBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const lowered = `${value}`.toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(lowered)
    ? true
    : ['0', 'false', 'no', 'off'].includes(lowered)
    ? false
    : defaultValue;
}

function toNumber(value, defaultValue = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
}

function sanitiseText(value) {
  if (value === undefined || value === null) return '';
  return `${value}`.trim();
}

function mapSectionPayload(body = {}) {
  const title = sanitiseText(body.title);
  if (!title) throw new Error('TITLE_REQUIRED');

  const payload = {
    title,
    subtitle: sanitiseText(body.subtitle),
    description: sanitiseText(body.description),
    slug: normaliseSlug(body.slug || title),
    viewAllText: sanitiseText(body.viewAllText),
    viewAllLink: sanitiseText(body.viewAllLink),
    ctaText: sanitiseText(body.ctaText),
    ctaLink: sanitiseText(body.ctaLink),
    scope: body.scope === 'specific_city' ? 'specific_city' : 'all_cities',
    cityId: sanitiseText(body.cityId),
    cityName: sanitiseText(body.cityName),
    layout: body.layout === 'grid' ? 'grid' : 'carousel',
    order: toNumber(body.order),
    isActive: toBoolean(body.isActive, true),
  };

  if (!payload.slug) throw new Error('SLUG_REQUIRED');
  if (payload.scope === 'specific_city' && !payload.cityId && !payload.cityName) {
    throw new Error('CITY_REQUIRED');
  }

  if (Array.isArray(body.stores)) {
    payload.stores = body.stores
      .map((store, index) => {
        const sellerId = sanitiseText(store?.sellerId || store?.seller?._id || store?._id);
        if (!mongoose.Types.ObjectId.isValid(sellerId)) return null;
        return {
          sellerId,
          order: toNumber(store.order, index),
          badgeMode: ['manual', 'auto', 'none'].includes(store.badgeMode) ? store.badgeMode : 'none',
          isActive: toBoolean(store.isActive, true),
        };
      })
      .filter(Boolean);
  }

  return payload;
}

function isRecent(dateValue) {
  const created = new Date(dateValue || 0).getTime();
  if (!created) return false;
  return Date.now() - created <= 1000 * 60 * 60 * 24 * 21;
}

function serialiseSection(sectionDoc, { publicOnly = false } = {}) {
  if (!sectionDoc) return null;
  const plain = sectionDoc.toObject({ virtuals: false });


  const cards = Array.isArray(plain.cards)
    ? [...plain.cards]
        .filter((card) => (publicOnly ? toBoolean(card.isActive, true) : true))
        .map((card) => ({
          _id: card._id?.toString?.() || card._id,
          title: card.title || '',
          tag: card.tag || '',
          description: card.description || '',
          location: card.location || '',
          price: card.price || '',
          imageUrl: card.imageUrl || '',
          link: card.link || '',
          buttonText: card.buttonText || '',
          order: toNumber(card.order),
          isActive: toBoolean(card.isActive, true),
        }))
        .sort((a, b) => a.order - b.order)
    : [];

  const stores = Array.isArray(plain.stores)
    ? [...plain.stores]
        .filter((entry) => (publicOnly ? toBoolean(entry.isActive, true) : true))
        .map((entry) => {
          const seller = entry.sellerId && typeof entry.sellerId === 'object' ? entry.sellerId : null;
          const badgeMode = ['manual', 'auto', 'none'].includes(entry.badgeMode) ? entry.badgeMode : 'none';
          const autoNew = badgeMode === 'auto' && seller ? isRecent(seller.createdAt) : false;
          return {
            _id: entry._id?.toString?.() || entry._id,
            sellerId: seller?._id?.toString?.() || entry.sellerId?.toString?.() || entry.sellerId,
            order: toNumber(entry.order),
            badgeMode,
            showNewBadge: badgeMode === 'manual' || autoNew,
            isActive: toBoolean(entry.isActive, true),
            seller: seller
              ? {
                  _id: seller._id,
                  storename: seller.storename || '',
                  shopurl: seller.shopurl || '',
                  address: seller.address || '',
                  city: seller.city || '',
                  region: seller.region || '',
                  boardImage: seller.boardImage || '',
                  category: seller.category || '',
                  createdAt: seller.createdAt || null,
                }
              : null,
          };
        })
        .sort((a, b) => a.order - b.order)
    : [];

  return {
    _id: plain._id,
    title: plain.title,
    subtitle: plain.subtitle || '',
    description: plain.description || '',
    slug: plain.slug,
    viewAllText: plain.viewAllText || '',
    viewAllLink: plain.viewAllLink || '',
    ctaText: plain.ctaText || '',
    ctaLink: plain.ctaLink || '',
    scope: plain.scope || 'all_cities',
    cityId: plain.cityId || '',
    cityName: plain.cityName || '',
    layout: plain.layout || 'carousel',
    order: toNumber(plain.order),
    isActive: toBoolean(plain.isActive, true),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    cards,
    stores,
  };
}

async function findSections(query = {}) {
  return HomeCardSection.find(query)
    .populate('stores.sellerId', 'storename shopurl address city region boardImage category createdAt')
    .sort({ order: 1, createdAt: -1 });
}

exports.getPublicSections = async (req, res) => {
  try {
    const sections = await findSections({ isActive: true });
    res.json(sections.map((section) => serialiseSection(section, { publicOnly: true })));
  } catch (err) {
    console.error('Error fetching public home sections:', err);
    res.status(500).json({ message: 'خطا در دریافت اطلاعات سکشن‌ها' });
  }
};

exports.getBySlug = async (req, res) => {
  try {
    const slug = normaliseSlug(req.params.slug);
    const section = await HomeCardSection.findOne({ slug, isActive: true }).populate('stores.sellerId', 'storename shopurl address city region boardImage category createdAt');
    if (!section) {
      return res.status(404).json({ message: 'سکشن موردنظر یافت نشد.' });
    }
    res.json(serialiseSection(section, { publicOnly: true }));
  } catch (err) {
    console.error('Error fetching section by slug:', err);
    res.status(500).json({ message: 'خطا در دریافت سکشن' });
  }
};

exports.getAllSections = async (req, res) => {
  try {
    const sections = await findSections();
    res.json(sections.map((section) => serialiseSection(section)));
  } catch (err) {
    console.error('Error fetching all sections:', err);
    res.status(500).json({ message: 'خطا در دریافت لیست سکشن‌ها' });
  }
};

exports.getSectionById = async (req, res) => {
  try {
    const section = await HomeCardSection.findById(req.params.id).populate('stores.sellerId', 'storename shopurl address city region boardImage category createdAt');
    if (!section) return res.status(404).json({ message: 'سکشن یافت نشد.' });
    res.json(serialiseSection(section));
  } catch (err) {
    console.error('Error fetching section by id:', err);
    res.status(500).json({ message: 'خطا در دریافت سکشن' });
  }
};

exports.createSection = async (req, res) => {
  try {
    const payload = mapSectionPayload(req.body || {});
    const section = await HomeCardSection.create(payload);
    const hydrated = await HomeCardSection.findById(section._id).populate('stores.sellerId', 'storename shopurl address city region boardImage category createdAt');
    res.status(201).json(serialiseSection(hydrated));
  } catch (err) {
    console.error('Error creating section:', err);
    if (err?.code === 11000) return res.status(409).json({ message: 'اسلاگ تکراری است. مقدار دیگری انتخاب کنید.' });
    if (err?.message === 'TITLE_REQUIRED') return res.status(400).json({ message: 'عنوان سکشن الزامی است.' });
    if (err?.message === 'SLUG_REQUIRED') return res.status(400).json({ message: 'اسلاگ سکشن الزامی است.' });
    if (err?.message === 'CITY_REQUIRED') return res.status(400).json({ message: 'برای سکشن شهری، شهر الزامی است.' });
    res.status(500).json({ message: 'خطا در ایجاد سکشن جدید.' });
  }
};

exports.updateSection = async (req, res) => {
  try {
    const section = await HomeCardSection.findById(req.params.id);
    if (!section) return res.status(404).json({ message: 'سکشن یافت نشد.' });

    const payload = mapSectionPayload({ ...section.toObject(), ...req.body });
    Object.assign(section, payload);
    await section.save();

    const hydrated = await HomeCardSection.findById(section._id).populate('stores.sellerId', 'storename shopurl address city region boardImage category createdAt');
    res.json(serialiseSection(hydrated));
  } catch (err) {
    console.error('Error updating section:', err);
    if (err?.code === 11000) return res.status(409).json({ message: 'اسلاگ تکراری است.' });
    if (err?.message === 'TITLE_REQUIRED') return res.status(400).json({ message: 'عنوان سکشن الزامی است.' });
    if (err?.message === 'CITY_REQUIRED') return res.status(400).json({ message: 'برای سکشن شهری، شهر الزامی است.' });
    res.status(500).json({ message: 'خطا در ویرایش سکشن.' });
  }
};

exports.deleteSection = async (req, res) => {
  try {
    const section = await HomeCardSection.findByIdAndDelete(req.params.id);
    if (!section) return res.status(404).json({ message: 'سکشن یافت نشد.' });
    res.json({ message: 'سکشن با موفقیت حذف شد.' });
  } catch (err) {
    console.error('Error deleting section:', err);
    res.status(500).json({ message: 'خطا در حذف سکشن.' });
  }
};

// Legacy no-op card endpoints kept for compatibility
exports.addCard = async (req, res) => res.status(410).json({ message: 'مدیریت کارت منسوخ شده است.' });
exports.updateCard = async (req, res) => res.status(410).json({ message: 'مدیریت کارت منسوخ شده است.' });
exports.removeCard = async (req, res) => res.status(410).json({ message: 'مدیریت کارت منسوخ شده است.' });
