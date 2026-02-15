const mongoose = require('mongoose');
const Product = require('../models/product');
const {
  HomepageSection,
  HOMEPAGE_SECTION_TYPES,
  HOMEPAGE_SECTION_SORTS
} = require('../models/HomepageSection');

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSectionPayload(body = {}, { partial = false } = {}) {
  const next = {};

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'title')) {
    const title = String(body.title || '').trim();
    if (!title) {
      throw new Error('title is required.');
    }
    next.title = title;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'type')) {
    const type = String(body.type || 'latest').trim().toLowerCase();
    if (!HOMEPAGE_SECTION_TYPES.includes(type)) {
      throw new Error(`type must be one of: ${HOMEPAGE_SECTION_TYPES.join(', ')}`);
    }
    next.type = type;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'categoryFilter')) {
    next.categoryFilter = String(body.categoryFilter || '').trim();
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'sort')) {
    const sort = String(body.sort || 'latest').trim().toLowerCase();
    if (!HOMEPAGE_SECTION_SORTS.includes(sort)) {
      throw new Error(`sort must be one of: ${HOMEPAGE_SECTION_SORTS.join(', ')}`);
    }
    next.sort = sort;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'limit')) {
    const limit = Math.max(1, Math.min(40, Math.floor(toNumber(body.limit, 10))));
    next.limit = limit;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'displayOrder')) {
    const displayOrder = Math.max(0, Math.floor(toNumber(body.displayOrder, 0)));
    next.displayOrder = displayOrder;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'isActive')) {
    next.isActive = Boolean(body.isActive);
  }

  const type = next.type || String(body.type || '').trim().toLowerCase();
  const categoryFilter = (next.categoryFilter || '').trim();
  if (type === 'category' && !categoryFilter) {
    throw new Error('categoryFilter is required when type is "category".');
  }

  return next;
}

function getSortObject(sort) {
  switch (sort) {
    case 'oldest':
      return { createdAt: 1 };
    case 'price-desc':
      return { price: -1, createdAt: -1 };
    case 'price-asc':
      return { price: 1, createdAt: -1 };
    case 'most-liked':
      return { likesCount: -1, createdAt: -1 };
    case 'latest':
    default:
      return { createdAt: -1 };
  }
}

function buildSectionProductQuery(section) {
  const query = { inStock: { $ne: false } };
  const categoryFilter = String(section.categoryFilter || '').trim();

  if (categoryFilter) {
    query.category = new RegExp(`^${escapeRegex(categoryFilter)}$`, 'i');
  }

  if (section.type === 'category') {
    if (!categoryFilter) return null;
  } else if (section.type === 'discounted') {
    query.discountActive = true;
    query.discountPrice = { $ne: null };
  }

  return query;
}

function formatProductForHomepage(product) {
  const seller = product.sellerId || {};
  const mainImageIndex = Number.isInteger(product.mainImageIndex) ? product.mainImageIndex : 0;
  const image = Array.isArray(product.images) && product.images.length
    ? (product.images[mainImageIndex] || product.images[0])
    : '';

  return {
    _id: product._id,
    title: product.title || '',
    category: product.category || '',
    price: Number(product.price || 0),
    discountPrice: product.discountPrice == null ? null : Number(product.discountPrice),
    discountActive: Boolean(product.discountActive),
    likesCount: Number(product.likesCount || 0),
    image,
    images: Array.isArray(product.images) ? product.images : [],
    sellerId: seller._id || null,
    shopName: seller.storename || '',
    shopurl: seller.shopurl || '',
    sellerLocation: seller.address || seller.city || ''
  };
}

exports.listAdminSections = async (req, res) => {
  try {
    const sections = await HomepageSection.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    return res.json({ success: true, sections });
  } catch (error) {
    console.error('listAdminSections error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load homepage sections.' });
  }
};

exports.listActiveSections = async (req, res) => {
  try {
    const sections = await HomepageSection.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    return res.json({ success: true, sections });
  } catch (error) {
    console.error('listActiveSections error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load active homepage sections.' });
  }
};

exports.createSection = async (req, res) => {
  try {
    const payload = normalizeSectionPayload(req.body || {});

    if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'displayOrder')) {
      const lastSection = await HomepageSection.findOne()
        .sort({ displayOrder: -1, createdAt: -1 })
        .select('displayOrder')
        .lean();
      payload.displayOrder = Number(lastSection?.displayOrder || 0) + 1;
    }

    const section = await HomepageSection.create(payload);
    return res.status(201).json({ success: true, section });
  } catch (error) {
    console.error('createSection error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to create section.' });
  }
};

exports.updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid section id.' });
    }

    const payload = normalizeSectionPayload(req.body || {}, { partial: true });
    const section = await HomepageSection.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true
    });

    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    return res.json({ success: true, section });
  } catch (error) {
    console.error('updateSection error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to update section.' });
  }
};

exports.deleteSection = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid section id.' });
    }

    const section = await HomepageSection.findByIdAndDelete(id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    return res.json({ success: true, message: 'Section deleted successfully.' });
  } catch (error) {
    console.error('deleteSection error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete section.' });
  }
};

exports.toggleSection = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid section id.' });
    }

    const section = await HomepageSection.findById(id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    if (typeof req.body?.isActive === 'boolean') {
      section.isActive = req.body.isActive;
    } else {
      section.isActive = !section.isActive;
    }

    await section.save();
    return res.json({ success: true, section });
  } catch (error) {
    console.error('toggleSection error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update section status.' });
  }
};

exports.reorderSections = async (req, res) => {
  try {
    const updates = Array.isArray(req.body?.sections) ? req.body.sections : [];
    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'sections array is required.' });
    }

    const bulk = [];
    updates.forEach((item, index) => {
      const id = String(item?.id || '').trim();
      if (!isValidObjectId(id)) return;

      const displayOrder = Math.max(
        0,
        Math.floor(toNumber(item?.displayOrder, index + 1))
      );

      bulk.push({
        updateOne: {
          filter: { _id: id },
          update: { $set: { displayOrder } }
        }
      });
    });

    if (!bulk.length) {
      return res.status(400).json({ success: false, message: 'No valid section ids were provided.' });
    }

    await HomepageSection.bulkWrite(bulk);
    const sections = await HomepageSection.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    return res.json({ success: true, sections });
  } catch (error) {
    console.error('reorderSections error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reorder sections.' });
  }
};

exports.getSectionProducts = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid section id.' });
    }

    const includeInactive = req.query.includeInactive === 'true';
    const section = await HomepageSection.findById(id).lean();
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }
    if (!includeInactive && !section.isActive) {
      return res.status(404).json({ success: false, message: 'Section is not active.' });
    }

    const query = buildSectionProductQuery(section);
    if (!query) {
      return res.json({ success: true, section, products: [] });
    }

    const products = await Product.find(query)
      .sort(getSortObject(section.sort))
      .limit(Math.max(1, Math.min(40, Number(section.limit) || 10)))
      .populate({
        path: 'sellerId',
        select: 'storename shopurl address city'
      })
      .lean();

    return res.json({
      success: true,
      section,
      products: products.map(formatProductForHomepage)
    });
  } catch (error) {
    console.error('getSectionProducts error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load section products.' });
  }
};
