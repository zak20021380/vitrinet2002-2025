const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/product');
const {
  HomepageSection,
  HOMEPAGE_SECTION_TYPES,
  HOMEPAGE_SECTION_SORTS
} = require('../models/HomepageSection');

const BACKEND_ROOT = path.join(__dirname, '..');
const HOMEPAGE_CARD_UPLOAD_PREFIX = '/uploads/homepage-cards/';
const DEFAULT_CARD_IMAGE = '/uploads/homepage-cards/placeholder.svg';

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUploadedPath(file) {
  if (!file?.path) return '';
  const relative = path.relative(BACKEND_ROOT, file.path).replace(/\\/g, '/');
  if (!relative) return '';
  if (relative.startsWith('uploads/')) {
    return `/${relative}`;
  }
  return `/uploads/${path.basename(file.path)}`;
}

function isHomepageCardUploadPath(imagePath) {
  const value = String(imagePath || '').trim();
  return value.startsWith(HOMEPAGE_CARD_UPLOAD_PREFIX);
}

function removeCardImageFile(imagePath) {
  const value = String(imagePath || '').trim();
  if (!isHomepageCardUploadPath(value)) return;
  if (value === DEFAULT_CARD_IMAGE) return;

  const filePath = path.join(BACKEND_ROOT, value.replace(/^\//, ''));
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn('removeCardImageFile failed:', filePath, error?.message || error);
  }
}

function normalizeHomepageCardPayload(body = {}, { partial = false } = {}) {
  const next = {};

  if (!partial || hasOwn(body, '_id') || hasOwn(body, 'id')) {
    const cardId = String(body._id || body.id || '').trim();
    if (cardId && isValidObjectId(cardId)) {
      next._id = cardId;
    }
  }

  if (!partial || hasOwn(body, 'title')) {
    const title = String(body.title || '').trim();
    if (!title) {
      throw new Error('card title is required.');
    }
    next.title = title;
  }

  if (!partial || hasOwn(body, 'image')) {
    const image = String(body.image || '').trim();
    next.image = image || DEFAULT_CARD_IMAGE;
  }

  if (!partial || hasOwn(body, 'category')) {
    const category = String(body.category || '').trim();
    if (!category) {
      throw new Error('card category is required.');
    }
    next.category = category;
  }

  if (!partial || hasOwn(body, 'price')) {
    const price = toNumber(body.price, NaN);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error('card price must be a non-negative number.');
    }
    next.price = price;
  }

  if (!partial || hasOwn(body, 'location')) {
    const location = String(body.location || '').trim();
    if (!location) {
      throw new Error('card location is required.');
    }
    next.location = location;
  }

  if (!partial || hasOwn(body, 'link')) {
    next.link = String(body.link || '').trim();
  }

  if (!partial || hasOwn(body, 'displayOrder')) {
    next.displayOrder = Math.max(0, Math.floor(toNumber(body.displayOrder, 0)));
  }

  return next;
}

function normalizeHomepageCardsPayload(cards = []) {
  if (!Array.isArray(cards)) {
    throw new Error('cards must be an array.');
  }
  return cards.map((item, index) => {
    const normalized = normalizeHomepageCardPayload(item || {});
    if (!hasOwn(item || {}, 'displayOrder')) {
      normalized.displayOrder = index + 1;
    }
    return normalized;
  });
}

function normalizeSectionPayload(body = {}, { partial = false } = {}) {
  const next = {};

  if (!partial || hasOwn(body, 'title')) {
    const title = String(body.title || '').trim();
    if (!title) {
      throw new Error('title is required.');
    }
    next.title = title;
  }

  if (!partial || hasOwn(body, 'type')) {
    const type = String(body.type || 'latest').trim().toLowerCase();
    if (!HOMEPAGE_SECTION_TYPES.includes(type)) {
      throw new Error(`type must be one of: ${HOMEPAGE_SECTION_TYPES.join(', ')}`);
    }
    next.type = type;
  }

  if (!partial || hasOwn(body, 'categoryFilter')) {
    next.categoryFilter = String(body.categoryFilter || '').trim();
  }

  if (!partial || hasOwn(body, 'sort')) {
    const sort = String(body.sort || 'latest').trim().toLowerCase();
    if (!HOMEPAGE_SECTION_SORTS.includes(sort)) {
      throw new Error(`sort must be one of: ${HOMEPAGE_SECTION_SORTS.join(', ')}`);
    }
    next.sort = sort;
  }

  if (!partial || hasOwn(body, 'limit')) {
    const limit = Math.max(1, Math.min(40, Math.floor(toNumber(body.limit, 10))));
    next.limit = limit;
  }

  if (!partial || hasOwn(body, 'displayOrder')) {
    const displayOrder = Math.max(0, Math.floor(toNumber(body.displayOrder, 0)));
    next.displayOrder = displayOrder;
  }

  if (!partial || hasOwn(body, 'isActive')) {
    next.isActive = Boolean(body.isActive);
  }

  if (!partial || hasOwn(body, 'cards')) {
    next.cards = normalizeHomepageCardsPayload(body.cards || []);
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

function formatSectionCard(card) {
  if (!card) return null;
  return {
    _id: card._id,
    title: String(card.title || ''),
    image: String(card.image || ''),
    category: String(card.category || ''),
    price: Number(card.price || 0),
    location: String(card.location || ''),
    link: String(card.link || ''),
    displayOrder: Math.max(0, Number(card.displayOrder) || 0)
  };
}

function formatSectionForResponse(section) {
  if (!section) return null;
  const raw = typeof section.toObject === 'function'
    ? section.toObject()
    : { ...section };

  const cards = Array.isArray(raw.cards)
    ? raw.cards
        .map(formatSectionCard)
        .filter(Boolean)
        .sort((a, b) => {
          const orderA = Number(a?.displayOrder) || 0;
          const orderB = Number(b?.displayOrder) || 0;
          if (orderA !== orderB) return orderA - orderB;
          return String(a?._id || '').localeCompare(String(b?._id || ''));
        })
    : [];

  return { ...raw, cards };
}

async function fetchOrderedSectionIds() {
  const sections = await HomepageSection.find()
    .sort({ displayOrder: 1, createdAt: 1 })
    .select('_id')
    .lean();

  return sections
    .map((item) => String(item?._id || '').trim())
    .filter((id) => id && isValidObjectId(id));
}

async function writeSectionOrderSequence(orderedIds = []) {
  if (!Array.isArray(orderedIds) || !orderedIds.length) return;

  const bulk = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { displayOrder: index + 1 } }
    }
  }));

  if (bulk.length) {
    await HomepageSection.bulkWrite(bulk);
  }
}

async function placeSectionAtDisplayOrder(sectionId, requestedOrder, { appendIfInvalid = true } = {}) {
  const targetId = String(sectionId || '').trim();
  if (!targetId || !isValidObjectId(targetId)) return;

  const orderedIds = await fetchOrderedSectionIds();
  const withoutTarget = orderedIds.filter((id) => id !== targetId);
  const maxPosition = withoutTarget.length + 1;

  let position = Math.floor(toNumber(requestedOrder, appendIfInvalid ? maxPosition : 1));
  if (!Number.isFinite(position)) {
    position = appendIfInvalid ? maxPosition : 1;
  }

  if (position <= 0) {
    position = appendIfInvalid ? maxPosition : 1;
  }

  position = Math.min(Math.max(position, 1), maxPosition);
  withoutTarget.splice(position - 1, 0, targetId);
  await writeSectionOrderSequence(withoutTarget);
}

async function normalizeSectionDisplayOrderSequence() {
  const orderedIds = await fetchOrderedSectionIds();
  await writeSectionOrderSequence(orderedIds);
}

function sortSectionCards(cards = []) {
  return [...cards].sort((a, b) => {
    const orderA = Number(a?.displayOrder) || 0;
    const orderB = Number(b?.displayOrder) || 0;
    if (orderA !== orderB) return orderA - orderB;
    return String(a?._id || '').localeCompare(String(b?._id || ''));
  });
}

function normalizeSectionCardOrderSequence(section) {
  if (!section || !Array.isArray(section.cards) || !section.cards.length) return;
  const orderedCards = sortSectionCards(section.cards);
  orderedCards.forEach((card, index) => {
    if (!card) return;
    card.displayOrder = index + 1;
  });
}

function placeSectionCardAtDisplayOrder(section, cardId, requestedOrder, { appendIfInvalid = true } = {}) {
  if (!section || !Array.isArray(section.cards) || !section.cards.length) return;
  const targetId = String(cardId || '').trim();
  if (!targetId) return;

  const orderedCards = sortSectionCards(section.cards);
  const targetCard = orderedCards.find((card) => String(card?._id || '') === targetId);
  if (!targetCard) return;

  const withoutTarget = orderedCards.filter((card) => String(card?._id || '') !== targetId);
  const maxPosition = withoutTarget.length + 1;

  let position = Math.floor(toNumber(requestedOrder, appendIfInvalid ? maxPosition : 1));
  if (!Number.isFinite(position)) {
    position = appendIfInvalid ? maxPosition : 1;
  }
  if (position <= 0) {
    position = appendIfInvalid ? maxPosition : 1;
  }

  position = Math.min(Math.max(position, 1), maxPosition);
  withoutTarget.splice(position - 1, 0, targetCard);
  withoutTarget.forEach((card, index) => {
    if (!card) return;
    card.displayOrder = index + 1;
  });
}

exports.listAdminSections = async (req, res) => {
  try {
    const sections = await HomepageSection.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    return res.json({
      success: true,
      sections: sections.map(formatSectionForResponse).filter(Boolean)
    });
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
    return res.json({
      success: true,
      sections: sections.map(formatSectionForResponse).filter(Boolean)
    });
  } catch (error) {
    console.error('listActiveSections error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load active homepage sections.' });
  }
};

exports.createSection = async (req, res) => {
  try {
    const hasDisplayOrder = hasOwn(req.body || {}, 'displayOrder');
    const requestedDisplayOrder = hasDisplayOrder ? req.body.displayOrder : null;
    const payload = normalizeSectionPayload(req.body || {});

    const section = await HomepageSection.create(payload);
    await placeSectionAtDisplayOrder(section._id, requestedDisplayOrder, { appendIfInvalid: true });
    const refreshedSection = await HomepageSection.findById(section._id);

    return res.status(201).json({
      success: true,
      section: formatSectionForResponse(refreshedSection || section)
    });
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

    const hasDisplayOrder = hasOwn(req.body || {}, 'displayOrder');
    const requestedDisplayOrder = hasDisplayOrder ? req.body.displayOrder : null;
    const payload = normalizeSectionPayload(req.body || {}, { partial: true });
    let section = await HomepageSection.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true
    });

    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    if (hasDisplayOrder) {
      await placeSectionAtDisplayOrder(id, requestedDisplayOrder, { appendIfInvalid: true });
      section = await HomepageSection.findById(id);
    }

    return res.json({ success: true, section: formatSectionForResponse(section) });
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

    const cards = Array.isArray(section.cards) ? section.cards : [];
    cards.forEach((card) => removeCardImageFile(card?.image));
    await normalizeSectionDisplayOrderSequence();

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
    return res.json({ success: true, section: formatSectionForResponse(section) });
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
        1,
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
    await normalizeSectionDisplayOrderSequence();
    const sections = await HomepageSection.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    return res.json({
      success: true,
      sections: sections.map(formatSectionForResponse).filter(Boolean)
    });
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

    const manualCards = Array.isArray(section.cards) ? section.cards.filter(Boolean) : [];
    if (!manualCards.length) {
      return res.json({ success: true, section: formatSectionForResponse(section), products: [] });
    }

    const query = buildSectionProductQuery(section);
    if (!query) {
      return res.json({ success: true, section: formatSectionForResponse(section), products: [] });
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
      section: formatSectionForResponse(section),
      products: products.map(formatProductForHomepage)
    });
  } catch (error) {
    console.error('getSectionProducts error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load section products.' });
  }
};

exports.createSectionCard = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid section id.' });
    }

    const section = await HomepageSection.findById(id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    const hasDisplayOrder = hasOwn(req.body || {}, 'displayOrder');
    const requestedDisplayOrder = hasDisplayOrder ? req.body.displayOrder : null;
    const payload = normalizeHomepageCardPayload(req.body || {});
    const uploadedImage = normalizeUploadedPath(req.file);
    if (uploadedImage) {
      payload.image = uploadedImage;
    }

    if (!payload.image) {
      payload.image = DEFAULT_CARD_IMAGE;
    }

    section.cards.push(payload);
    const savedCard = section.cards[section.cards.length - 1];
    placeSectionCardAtDisplayOrder(section, savedCard?._id, requestedDisplayOrder, { appendIfInvalid: true });
    await section.save();

    return res.status(201).json({
      success: true,
      card: formatSectionCard(section.cards.id(savedCard?._id) || savedCard),
      section: formatSectionForResponse(section)
    });
  } catch (error) {
    console.error('createSectionCard error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to create card.' });
  }
};

exports.updateSectionCard = async (req, res) => {
  try {
    const { id, cardId } = req.params;
    if (!isValidObjectId(id) || !isValidObjectId(cardId)) {
      return res.status(400).json({ success: false, message: 'Invalid section/card id.' });
    }

    const section = await HomepageSection.findById(id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    const card = section.cards.id(cardId);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Card not found.' });
    }

    const hasDisplayOrder = hasOwn(req.body || {}, 'displayOrder');
    const requestedDisplayOrder = hasDisplayOrder ? req.body.displayOrder : null;
    const payload = normalizeHomepageCardPayload(req.body || {}, { partial: true });
    const uploadedImage = normalizeUploadedPath(req.file);
    if (uploadedImage) {
      payload.image = uploadedImage;
    }

    const keys = Object.keys(payload);
    if (!keys.length) {
      return res.status(400).json({ success: false, message: 'No card fields to update.' });
    }

    const previousImage = String(card.image || '').trim();
    keys.forEach((key) => {
      card[key] = payload[key];
    });

    if (hasDisplayOrder) {
      placeSectionCardAtDisplayOrder(section, cardId, requestedDisplayOrder, { appendIfInvalid: true });
    } else {
      normalizeSectionCardOrderSequence(section);
    }

    await section.save();

    if (payload.image && previousImage && previousImage !== payload.image) {
      removeCardImageFile(previousImage);
    }

    return res.json({
      success: true,
      card: formatSectionCard(card),
      section: formatSectionForResponse(section)
    });
  } catch (error) {
    console.error('updateSectionCard error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to update card.' });
  }
};

exports.deleteSectionCard = async (req, res) => {
  try {
    const { id, cardId } = req.params;
    if (!isValidObjectId(id) || !isValidObjectId(cardId)) {
      return res.status(400).json({ success: false, message: 'Invalid section/card id.' });
    }

    const section = await HomepageSection.findById(id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    const card = section.cards.id(cardId);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Card not found.' });
    }

    const imageToDelete = String(card.image || '').trim();
    card.deleteOne();
    normalizeSectionCardOrderSequence(section);
    await section.save();
    removeCardImageFile(imageToDelete);

    return res.json({
      success: true,
      message: 'Card deleted successfully.',
      section: formatSectionForResponse(section)
    });
  } catch (error) {
    console.error('deleteSectionCard error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete card.' });
  }
};
