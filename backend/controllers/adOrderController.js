const AdOrder = require('../models/AdOrder');
const Product = require('../models/product');
const Seller = require('../models/Seller');
const AdPlan = require('../models/adPlan');
const fs = require('fs');
const path = require('path');
const { calculateExpiry } = require('../utils/adDisplay');
const { parseDurationHours } = require('../utils/adDisplayConfig');

const ALLOWED_STATUSES = ['pending', 'approved', 'paid', 'rejected', 'expired'];
const POPULATE_SPEC = [
  { path: 'sellerId', select: 'storename shopurl phone city address ownerName ownerLastname' },
  { path: 'productId', select: 'title price slug' },
  { path: 'reviewedBy', select: 'name phone' }
];

const PUBLIC_POPULATE_SPEC = [
  { path: 'sellerId', select: 'storename shopurl boardImage' },
  { path: 'productId', select: 'title price slug' }
];

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION & SANITIZATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sanitize text input - strip HTML/script tags, enforce max length
 * @param {string} input - Raw input string
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized string
 */
function sanitizeText(input, maxLength = 100) {
  if (!input || typeof input !== 'string') return '';
  
  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Remove script-like patterns
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  sanitized = sanitized.replace(/data:/gi, '');
  
  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>'"&\\]/g, '');
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Validate ad order input fields
 * @param {Object} fields - Input fields
 * @param {string} adType - 'product' or 'shop'
 * @param {boolean} hasImage - Whether an image was provided
 * @param {string} selectedImageUrl - URL of selected product image
 * @returns {Object} - { isValid: boolean, errors: Object, sanitized: Object }
 */
function validateAdOrderInput(fields, adType, hasImage, selectedImageUrl) {
  const errors = {};
  const sanitized = {};
  
  // Validate and sanitize title (required, 3-25 chars)
  const title = sanitizeText(fields.title || fields.adTitle || '', 25);
  if (!title) {
    errors.title = 'عنوان تبلیغ الزامی است';
  } else if (title.length < 3) {
    errors.title = 'عنوان تبلیغ باید حداقل ۳ کاراکتر باشد';
  } else if (title.length > 25) {
    errors.title = 'عنوان تبلیغ نباید بیشتر از ۲۵ کاراکتر باشد';
  }
  sanitized.title = title;
  
  // Validate and sanitize text (required, 10-30 chars)
  const text = sanitizeText(fields.text || fields.adText || '', 30);
  if (!text) {
    errors.text = 'متن جذاب الزامی است';
  } else if (text.length < 10) {
    errors.text = 'متن جذاب باید حداقل ۱۰ کاراکتر باشد';
  } else if (text.length > 30) {
    errors.text = 'متن جذاب نباید بیشتر از ۳۰ کاراکتر باشد';
  }
  sanitized.text = text;
  
  // Validate product selection (required if adType is 'product')
  if (adType === 'product' && !fields.productId) {
    errors.product = 'لطفاً یک محصول انتخاب کنید';
  }
  sanitized.productId = fields.productId || null;
  
  // Validate image (required - either uploaded or selected from product)
  if (!hasImage && !selectedImageUrl) {
    errors.image = 'لطفاً یک تصویر انتخاب کنید';
  }
  
  const isValid = Object.keys(errors).length === 0;
  
  return { isValid, errors, sanitized };
}

function normaliseNote(note) {
  if (note === undefined) return undefined;
  if (note === null) return undefined;
  const trimmed = String(note).trim();
  return trimmed.length ? trimmed : undefined;
}

function normalisePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10 && digits.startsWith('9')) {
    return `0${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('09')) {
    return digits;
  }
  return null;
}

async function findEffectiveAdPlan(slug, sellerPhone) {
  if (!slug) return null;

  let normalisedPhone = normalisePhone(sellerPhone);
  let plan = null;

  if (normalisedPhone) {
    plan = await AdPlan.findOne({ slug, sellerPhone: normalisedPhone });
  }

  if (!plan) {
    plan = await AdPlan.findOne({ slug, sellerPhone: null });
  }

  if (!plan) {
    plan = await AdPlan.findOne({ slug });
  }

  return plan;
}

async function populateAdOrder(doc) {
  if (!doc) return doc;
  await doc.populate(POPULATE_SPEC);
  return doc;
}

function refreshExpiryMetadata(order, { force = false } = {}) {
  if (!order) return null;

  const shouldApply = force || ['approved', 'paid', 'expired'].includes(order.status);
  if (!shouldApply) {
    order.displayDurationHours = undefined;
    order.expiresAt = undefined;
    return null;
  }

  const { durationHours, expiresAt } = calculateExpiry(order);
  if (durationHours && expiresAt) {
    order.displayDurationHours = durationHours;
    order.expiresAt = expiresAt;
    return expiresAt;
  }

  order.displayDurationHours = undefined;
  order.expiresAt = undefined;
  return null;
}

function extractSellerPhone(order) {
  if (!order) return null;
  const seller = order.sellerId;
  if (seller && typeof seller === 'object' && seller !== null && seller.phone) {
    return seller.phone;
  }
  if (order.sellerPhone) {
    return order.sellerPhone;
  }
  return null;
}

async function resolveEffectivePlanPrice(slug, sellerPhone, cache) {
  if (!slug) return null;

  const normalisedPhone = normalisePhone(sellerPhone) || '';
  const cacheKey = `${slug}::${normalisedPhone}`;

  if (cache && cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const plan = await findEffectiveAdPlan(slug, normalisedPhone || null);
  const price = plan ? plan.price : null;

  if (cache) {
    cache.set(cacheKey, price);
  }

  return price;
}

async function buildAdOrderResponse(doc, { cache } = {}) {
  if (!doc) return doc;

  const order = typeof doc.toObject === 'function'
    ? doc.toObject({ virtuals: true })
    : { ...doc };

  const slug = order.planSlug || '';
  if (slug) {
    const sellerPhone = extractSellerPhone(order);
    const effectivePrice = await resolveEffectivePlanPrice(slug, sellerPhone, cache);
    if (effectivePrice !== null && effectivePrice !== undefined) {
      order.effectivePrice = effectivePrice;
      if (sellerPhone || order.price === undefined || order.price === null) {
        order.price = effectivePrice;
      }
    }
  }

  return order;
}
// ثبت سفارش تبلیغ ویژه
exports.createAdOrder = async (req, res) => {
  try {
    console.log("🔎 req.user:", req.user);
    console.log("🔎 req.fields:", req.fields);
    console.log("🔎 req.files:", req.files);

    const sellerId = req.user.id || req.user.sellerId;

    // داده‌های فرم
    const planSlug   = req.fields.adType || req.fields.planSlug;
    const productId  = req.fields.productId;
    const adTitle    = req.fields.title || req.fields.adTitle;
    const adText     = req.fields.text  || req.fields.adText;
    const image      = req.files?.image;
    const selectedImageUrl = req.fields.selectedImageUrl;

    // چک مقادیر اولیه
    if (!sellerId || !planSlug) {
      return res.status(400).json({ success: false, message: 'sellerId و planSlug الزامی است.' });
    }

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'فروشنده پیدا نشد.' });
    }

    const plan = await findEffectiveAdPlan(planSlug, seller.phone);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'پلن تبلیغ پیدا نشد.' });
    }

    // Determine ad type based on whether product is selected
    const adType = productId ? 'product' : 'shop';
    const hasImage = image && image.size > 0;

    // ═══════════════════════════════════════════════════════════════════════════
    // SERVER-SIDE VALIDATION
    // ═══════════════════════════════════════════════════════════════════════════
    const validation = validateAdOrderInput(
      { title: adTitle, text: adText, productId },
      adType,
      hasImage,
      selectedImageUrl
    );

    if (!validation.isValid) {
      console.log('❌ Validation failed:', validation.errors);
      return res.status(400).json({
        success: false,
        message: 'لطفاً فیلدهای مشخص‌شده را تکمیل کنید',
        validationErrors: validation.errors
      });
    }

    // Use sanitized values
    const sanitizedTitle = validation.sanitized.title;
    const sanitizedText = validation.sanitized.text;

    let product = null;
    if (productId) {
      product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'محصول انتخاب‌شده پیدا نشد.' });
      }
    }

    // --- ذخیره عکس در uploads ---
    let bannerImage = undefined;
    if (hasImage) {
      const ext = path.extname(image.name);
      const fileName = Date.now() + '-' + Math.floor(Math.random() * 10000) + ext;
      const newPath = path.join(__dirname, '..', 'uploads', fileName);
      fs.copyFileSync(image.path, newPath);
      bannerImage = fileName;
      console.log('✅ عکس تبلیغ ذخیره شد:', bannerImage);
    } else if (selectedImageUrl) {
      // Use the selected product image URL (store just the path)
      // Extract filename from URL if it's a full URL
      const urlPath = selectedImageUrl.replace(/^https?:\/\/[^\/]+/, '');
      bannerImage = urlPath.replace(/^\/uploads\//, '').replace(/^\//, '');
      console.log('✅ تصویر محصول انتخاب شد:', bannerImage);
    }

    const adOrder = new AdOrder({
      sellerId,
      planSlug,
      planTitle: plan.title,
      price: plan.price,
      productId: productId || undefined,
      shopTitle: seller.storename,
      bannerImage: bannerImage,
      adTitle: sanitizedTitle || undefined,
      adText: sanitizedText || undefined,
      status: 'pending',
      createdAt: new Date(),
    });

    await adOrder.save();
    // TODO: ارسال رخداد ایجاد سفارش به PostHog پس از فعال‌سازی | TODO: Send order_created event to PostHog once enabled
    // const { trackOrderCreated } = require('../utils/posthog-tracking');
    // await trackOrderCreated(adOrder);
    const responseOrder = await buildAdOrderResponse(adOrder);

    res.status(201).json({
      success: true,
      message: 'سفارش تبلیغ ثبت شد.',
      adOrder: responseOrder
    });
  } catch (err) {
    console.error('❌ خطا در ثبت سفارش تبلیغ:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در ثبت سفارش تبلیغ!',
      error: err.message
    });
  }
};

// گرفتن سفارشات تبلیغ یک فروشنده (مثلا برای پنل فروشنده)
exports.getSellerAdOrders = async (req, res) => {
  try {
    const { sellerId } = req.query;
    if (!sellerId)
      return res.status(400).json({ success: false, message: 'sellerId الزامی است.' });

    const docs = await AdOrder.find({ sellerId }).sort({ createdAt: -1 });
    const cache = new Map();
    const adOrders = await Promise.all(docs.map(doc => buildAdOrderResponse(doc, { cache })));
    res.json({ success: true, adOrders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در دریافت سفارشات تبلیغ', error: err.message });
  }
};

// دریافت همه سفارش‌های تبلیغ برای مدیریت ادمین
exports.getAllAdOrders = async (req, res) => {
  try {
    const { status, planSlug, sellerId } = req.query;

    const filter = {};
    if (status) {
      if (status === 'all') {
        // no status filter
      } else if (ALLOWED_STATUSES.includes(status)) {
        filter.status = status;
      } else {
        filter.status = { $ne: 'expired' };
      }
    } else {
      filter.status = { $ne: 'expired' };
    }
    if (planSlug) {
      filter.planSlug = planSlug;
    }
    if (sellerId) {
      filter.sellerId = sellerId;
    }

    const docs = await AdOrder.find(filter)
      .sort({ createdAt: -1 })
      .populate(POPULATE_SPEC);

    const cache = new Map();
    const adOrders = await Promise.all(docs.map(doc => buildAdOrderResponse(doc, { cache })));

    res.json({ success: true, adOrders });
  } catch (err) {
    console.error('❌ خطا در دریافت سفارش‌های تبلیغ برای ادمین:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت سفارش‌های تبلیغ.',
      error: err.message
    });
  }
};

// گرفتن سفارش تبلیغ با آیدی (برای ادمین یا مشاهده جزئیات)
exports.getAdOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const adOrder = await AdOrder.findById(id);

    if (!adOrder) return res.status(404).json({ success: false, message: 'سفارش تبلیغ پیدا نشد.' });

    await populateAdOrder(adOrder);
    const responseOrder = await buildAdOrderResponse(adOrder);
    res.json({ success: true, adOrder: responseOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در دریافت سفارش تبلیغ', error: err.message });
  }
};

// (در صورت نیاز: ویرایش یا حذف سفارش تبلیغ...)

// بروزرسانی وضعیت سفارش تبلیغ توسط ادمین
exports.updateAdOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body || {};

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'وضعیت ارسالی معتبر نیست.'
      });
    }

    const adOrder = await AdOrder.findById(id);
    if (!adOrder) {
      return res.status(404).json({ success: false, message: 'سفارش تبلیغ پیدا نشد.' });
    }

    adOrder.status = status;

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'adminNote')) {
      adOrder.adminNote = normaliseNote(adminNote);
    }

    adOrder.reviewedAt = new Date();
    if (req.user?.id || req.user?._id) {
      adOrder.reviewedBy = req.user.id || req.user._id;
    }

    const now = new Date();
    if (status === 'approved') {
      adOrder.approvedAt = now;
      if (!adOrder.displayedAt) {
        adOrder.displayedAt = now;
      }
      adOrder.expiredAt = undefined;
      refreshExpiryMetadata(adOrder, { force: true });
    } else if (status === 'paid') {
      if (!adOrder.approvedAt) {
        adOrder.approvedAt = now;
      }
      if (!adOrder.displayedAt) {
        adOrder.displayedAt = now;
      }
      adOrder.expiredAt = undefined;
      refreshExpiryMetadata(adOrder, { force: true });
    } else if (status === 'expired') {
      if (!adOrder.displayedAt) {
        adOrder.displayedAt = adOrder.approvedAt || now;
      }
      const expiresAt = refreshExpiryMetadata(adOrder, { force: true });
      adOrder.expiredAt = now;
      if (!expiresAt) {
        adOrder.expiresAt = now;
      }
    } else {
      adOrder.approvedAt = undefined;
      adOrder.displayedAt = undefined;
      adOrder.displayDurationHours = undefined;
      adOrder.expiresAt = undefined;
      adOrder.expiredAt = undefined;
    }

    await adOrder.save();
    await populateAdOrder(adOrder);
    const responseOrder = await buildAdOrderResponse(adOrder);

    res.json({
      success: true,
      message: 'وضعیت تبلیغ بروزرسانی شد.',
      adOrder: responseOrder
    });
  } catch (err) {
    console.error('❌ خطا در بروزرسانی وضعیت تبلیغ:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در بروزرسانی وضعیت تبلیغ.',
      error: err.message
    });
  }
};

// بروزرسانی جزئیات تبلیغ توسط ادمین
exports.updateAdOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    const adOrder = await AdOrder.findById(id);
    if (!adOrder) {
      return res.status(404).json({ success: false, message: 'سفارش تبلیغ پیدا نشد.' });
    }

    let hasChanges = false;
    let displayedAtChanged = false;
    let durationChanged = false;

    if (Object.prototype.hasOwnProperty.call(updates, 'adTitle')) {
      const title = updates.adTitle !== undefined && updates.adTitle !== null
        ? String(updates.adTitle).trim()
        : '';
      adOrder.adTitle = title.length ? title : undefined;
      hasChanges = true;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'adText')) {
      const text = updates.adText !== undefined && updates.adText !== null
        ? String(updates.adText).trim()
        : '';
      adOrder.adText = text.length ? text : undefined;
      hasChanges = true;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'price')) {
      const price = Number(updates.price);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ success: false, message: 'مبلغ معتبر نیست.' });
      }
      adOrder.price = price;
      hasChanges = true;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'displayedAt')) {
      const rawDate = updates.displayedAt;
      if (!rawDate) {
        adOrder.displayedAt = undefined;
      } else {
        const displayDate = new Date(rawDate);
        if (Number.isNaN(displayDate.getTime())) {
          return res.status(400).json({ success: false, message: 'تاریخ نمایش معتبر نیست.' });
        }
        adOrder.displayedAt = displayDate;
      }
      hasChanges = true;
      displayedAtChanged = true;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'displayDurationHours')) {
      const rawDuration = updates.displayDurationHours;
      if (rawDuration === null || rawDuration === undefined || rawDuration === '') {
        if (adOrder.displayDurationHours !== undefined) {
          adOrder.displayDurationHours = undefined;
          durationChanged = true;
          hasChanges = true;
        }
      } else {
        const parsedDuration = parseDurationHours(rawDuration);
        if (!parsedDuration) {
          return res.status(400).json({ success: false, message: 'مدت نمایش معتبر نیست.' });
        }
        if (adOrder.displayDurationHours !== parsedDuration) {
          adOrder.displayDurationHours = parsedDuration;
          durationChanged = true;
          hasChanges = true;
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'adminNote')) {
      adOrder.adminNote = normaliseNote(updates.adminNote);
      hasChanges = true;
    }

    if (!hasChanges) {
      return res.status(400).json({ success: false, message: 'هیچ تغییری اعمال نشد.' });
    }

    if (displayedAtChanged || durationChanged) {
      if (['approved', 'paid'].includes(adOrder.status)) {
        refreshExpiryMetadata(adOrder, { force: true });
      } else if (adOrder.status === 'expired') {
        const expiresAt = refreshExpiryMetadata(adOrder, { force: true });
        if (!expiresAt && adOrder.expiredAt) {
          adOrder.expiresAt = adOrder.expiredAt;
        }
      } else if (!adOrder.displayedAt) {
        if (durationChanged || displayedAtChanged) {
          adOrder.expiresAt = undefined;
        }
      }
    }

    await adOrder.save();
    await populateAdOrder(adOrder);
    const responseOrder = await buildAdOrderResponse(adOrder);

    res.json({
      success: true,
      message: 'جزئیات تبلیغ بروزرسانی شد.',
      adOrder: responseOrder
    });
  } catch (err) {
    console.error('❌ خطا در بروزرسانی جزئیات تبلیغ:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در بروزرسانی جزئیات تبلیغ.',
      error: err.message
    });
  }
};

// حذف سفارش تبلیغ توسط ادمین
exports.deleteAdOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const adOrder = await AdOrder.findById(id);

    if (!adOrder) {
      return res.status(404).json({ success: false, message: 'سفارش تبلیغ پیدا نشد.' });
    }

    const bannerPath = adOrder.bannerImage
      ? path.join(__dirname, '..', 'uploads', adOrder.bannerImage)
      : null;

    await adOrder.deleteOne();

    if (bannerPath) {
      fs.promises.unlink(bannerPath).catch(err => {
        if (err && err.code !== 'ENOENT') {
          console.warn('⚠️ خطا در حذف بنر تبلیغ:', err.message || err);
        }
      });
    }

    res.json({ success: true, message: 'تبلیغ با موفقیت حذف شد.' });
  } catch (err) {
    console.error('❌ خطا در حذف سفارش تبلیغ:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در حذف سفارش تبلیغ.',
      error: err.message
    });
  }
};

// گرفتن تبلیغ‌های فعال (مثلاً برای صفحه اصلی یا جستجو)
exports.getActiveAds = async (req, res) => {
  try {
    // planSlug رو از query بگیر (مثلاً ad_home یا ad_search)
    const { planSlug } = req.query;

    // فیلتر داینامیک: اگر planSlug نبود همه تبلیغ‌های فعال رو بده
    const query = { status: 'approved' };
    if (planSlug) query.planSlug = planSlug;

    // فقط جدیدترین تبلیغ رو بفرست (می‌تونی چندتا هم بدی، ولی معمولاً یکی کافیه)
    const rawAds = await AdOrder.find(query)
      .sort({ approvedAt: -1, createdAt: -1 })
      .limit(5)
      .populate(PUBLIC_POPULATE_SPEC);

    const now = Date.now();
    const validAds = [];

    for (const ad of rawAds) {
      const { expiresAt } = calculateExpiry(ad);
      if (expiresAt && expiresAt.getTime() <= now) {
        continue;
      }
      validAds.push(ad);
      if (validAds.length >= 1) {
        break;
      }
    }

    res.json({ success: true, ads: validAds });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در دریافت تبلیغات فعال', error: err.message });
  }
};

