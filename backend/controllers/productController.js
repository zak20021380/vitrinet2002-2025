// controllers/productController.js

const Product = require('../models/product');
const path = require('path');
const jwt = require('jsonwebtoken');
// تبدیل مسیر نسبى → آدرس کامل (نسبى، http/https یا data:)
function makeFullUrl(req, path = '') {
  if (!path) return '';
  if (/^(https?:|data:)/i.test(path)) return path;            // لینک کامل یا data:
  return `${req.protocol}://${req.headers.host}/${path.replace(/^\/+/, '')}`;
}

const BSON_MAX_BYTES = 16 * 1024 * 1024; // 16MB – محدودیت پیشفرض MongoDB
const BSON_SAFETY_MARGIN = 512 * 1024;   // نیم مگابایت حاشیه امن برای متادیتا

function estimatePayloadBytes(data) {
  try {
    return Buffer.byteLength(JSON.stringify(data || {}), 'utf8');
  } catch (_err) {
    return BSON_MAX_BYTES; // اگر مشکلی در محاسبه بود، اجازه ذخیره نده
  }
}

function normalizeUploadedPath(file) {
  if (!file?.path) return '';
  const backendRoot = path.join(__dirname, '..');
  const relative = path.relative(backendRoot, file.path).replace(/\\/g, '/');
  if (relative.startsWith('uploads/')) return relative;
  return `uploads/${path.basename(file.path)}`;
}

function resolveRequestActor(req, { allowIpFallback = true } = {}) {
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;

  if (bearerToken) {
    try {
      const payload = jwt.verify(bearerToken, 'vitrinet_secret_key');
      if (payload?.id) {
        return `user:${payload.id}`;
      }
    } catch (_err) {
      // توکن نامعتبر، ادامه می‌دهیم
    }
  }

  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  const deviceId = typeof req.headers['x-client-id'] === 'string'
    ? req.headers['x-client-id'].trim()
    : '';
  if (deviceId) {
    return `device:${deviceId}`;
  }

  if (!allowIpFallback) return null;

  const forwarded = (req.headers['x-forwarded-for'] || '').toString().split(',').map((ip) => ip.trim()).find(Boolean);
  const ip = forwarded || req.ip;
  return ip ? `ip:${ip}` : null;
}

// افزودن محصول جدید
exports.addProduct = async (req, res) => {
  try {
    const { sellerId, title, price, category, tags, desc, images, mainImageIndex } = req.body;

    const uploadedImages = Array.isArray(req.files)
      ? req.files.map((file) => normalizeUploadedPath(file)).filter(Boolean)
      : [];

    // چک فیلدهای الزامی
    if (!sellerId || !title || !price || !category) {
      return res.status(400).json({ message: 'لطفاً تمام فیلدهای الزامی را وارد کنید.' });
    }

    // آرایه‌سازی مطمئن
    const _tags = Array.isArray(tags) ? tags : tags ? tags.split(',') : [];
    const bodyImages = Array.isArray(images) ? images : images ? images.split(',') : [];
    const _images = uploadedImages.length ? uploadedImages : bodyImages;

    // جلوگیری از ثبت تصاویر base64/data URL که باعث عبور از سقف ۱۶MB می‌شوند
    const hasInlineImage = _images.some((img) => typeof img === 'string' && /^data:/i.test(img));
    if (hasInlineImage && !uploadedImages.length) {
      return res.status(400).json({ message: 'لطفاً تصویر را به‌صورت فایل آپلود کنید؛ ارسال رشته‌های data:URL پشتیبانی نمی‌شود.' });
    }

    const productData = {
      sellerId,
      title,
      price,
      category,
      tags: _tags,
      desc,
      images: _images,
      mainImageIndex: Number.isInteger(Number(mainImageIndex)) ? Number(mainImageIndex) : 0
    };

    // جلوگیری از ذخیره سند بزرگ‌تر از محدودیت BSON (16MB)
    const estimatedBytes = estimatePayloadBytes(productData);
    if (estimatedBytes > (BSON_MAX_BYTES - BSON_SAFETY_MARGIN)) {
      return res.status(413).json({
        message: 'حجم داده محصول بیش از حد مجاز است. لطفاً اندازه توضیحات یا تصاویر را کاهش دهید.',
        estimatedBytes
      });
    }

    const product = new Product(productData);

    await product.save();
    // TODO: ثبت محصول منتشر شده در PostHog بعد از فعال‌سازی | TODO: Capture product_published after enabling PostHog
    // const { trackProductPublished } = require('../utils/posthog-tracking');
    // await trackProductPublished(product);
    res.status(201).json({ message: 'محصول با موفقیت اضافه شد', product });
  } catch (err) {
    console.error('خطا در افزودن محصول:', err);
    res.status(500).json({ message: 'خطا در افزودن محصول', error: err.message });
  }
};

function deactivateDiscount(product) {
  if (!product) return;
  product.discountPrice = null;
  product.discountStart = null;
  product.discountEnd = null;
  product.discountActive = false;
  product.discountQuantityLimit = null;
  product.discountQuantitySold = 0;
}

async function enforceDiscountLifecycle(product, now = new Date()) {
  if (!product?.discountActive || product.discountPrice == null) return false;
  const limit = product.discountQuantityLimit;
  const sold = Number(product.discountQuantitySold || 0);
  const endDate = product.discountEnd ? new Date(product.discountEnd) : null;
  const expiredByTime = endDate ? endDate.getTime() <= now.getTime() : false;
  const hasQuantityLimit = limit != null && Number.isFinite(Number(limit));
  const soldOut = hasQuantityLimit ? sold >= Number(limit) : false;

  if (expiredByTime || soldOut) {
    deactivateDiscount(product);
    await product.save();
    return true;
  }
  return false;
}

function buildProductResponse(req, doc, options = {}) {
  const p = typeof doc?.toObject === 'function' ? doc.toObject() : doc;
  const idx = Number.isInteger(p.mainImageIndex) ? p.mainImageIndex : 0;
  const mainImg = (p.images?.length ? (p.images[idx] || p.images[0]) : '');
  const liked = options.likeActor
    ? Array.isArray(p.likedBy) && p.likedBy.includes(options.likeActor)
    : null;
  return {
    ...p,
    image: makeFullUrl(req, mainImg),
    shopName: p.sellerId?.storename || '',
    likesCount: Number.isFinite(Number(p.likesCount)) ? Number(p.likesCount) : 0,
    ...(liked !== null ? { liked } : {}),
    seller: p.sellerId || {},
    sellerCategory: p.sellerId?.category || '',
    sellerLocation: p.sellerId?.address || p.sellerId?.city || '—',
    sellerId: p.sellerId?._id?.toString() || p.sellerId
  };
}

// ساخت یا به‌روزرسانی تخفیف محصول
exports.upsertDiscount = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'محصول پیدا نشد!' });
    }

    const { priceAfterDiscount, start, end, quantityLimit } = req.body || {};
    const discountPrice = Number(priceAfterDiscount);
    if (!Number.isFinite(discountPrice) || discountPrice <= 0) {
      return res.status(400).json({ message: 'قیمت بعد از تخفیف نامعتبر است.' });
    }

    if (discountPrice >= Number(product.price || 0)) {
      return res.status(400).json({ message: 'قیمت جدید باید کمتر از قیمت اصلی باشد.' });
    }

    const startDate = start ? new Date(start) : new Date();
    const endDate = end ? new Date(end) : null;

    if (!endDate || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ message: 'زمان پایان تخفیف معتبر نیست.' });
    }

    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ message: 'زمان شروع تخفیف معتبر نیست.' });
    }

    if (endDate <= startDate) {
      return res.status(400).json({ message: 'زمان پایان باید بعد از زمان شروع باشد.' });
    }

    const normalizedQuantity = Number.isInteger(Number(quantityLimit))
      ? Number(quantityLimit)
      : Math.floor(Number(quantityLimit));

    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      return res.status(400).json({ message: 'سقف تعداد تخفیف باید یک عدد صحیح بزرگ‌تر از صفر باشد.' });
    }

    product.discountPrice = discountPrice;
    product.discountStart = startDate;
    product.discountEnd = endDate;
    product.discountActive = true;
    product.discountQuantityLimit = normalizedQuantity;
    product.discountQuantitySold = 0;

    await product.save();

    res.json({ message: 'تخفیف با موفقیت ذخیره و فعال شد.', product });
  } catch (err) {
    console.error('Failed to upsert product discount:', err);
    res.status(500).json({ message: 'خطا در ذخیره تخفیف محصول', error: err.message });
  }
};

// حذف یا غیرفعال‌سازی تخفیف محصول
exports.removeDiscount = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'محصول پیدا نشد!' });
    }

    deactivateDiscount(product);

    await product.save();

    res.json({ message: 'تخفیف محصول حذف شد.', product });
  } catch (err) {
    console.error('Failed to remove product discount:', err);
    res.status(500).json({ message: 'خطا در حذف تخفیف محصول', error: err.message });
  }
};

// دریافت محصولات (به ‌همراه دسته‌بندی فروشنده)
// دریافت محصولات (به ‌همراه اطلاعات کامل فروشنده)
exports.getProducts = async (req, res) => {
  try {
    const filter = req.query.sellerId ? { sellerId: req.query.sellerId } : {};
    const likeActor = resolveRequestActor(req, { allowIpFallback: false });

    const now = new Date();
    const docs = await Product.find(filter)
      .sort({ createdAt: -1 })
      .populate({
        path: 'sellerId',
        select: 'storename ownerName address shopurl ownerFirstname ownerLastname category city'
    });

    const products = await Promise.all(docs.map(async (doc) => {
      await enforceDiscountLifecycle(doc, now);
      return buildProductResponse(req, doc, { likeActor });
    }));

    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'خطا در دریافت محصولات', error: err.message });
  }
};


// ویرایش محصول (اصلاح شده برای پشتیبانی از mainImageIndex)
exports.editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const {
      title,
      price,
      category,
      tags,
      desc,
      images,
      mainImageIndex
    } = req.body;

    // مطمئن شو آرایه‌ها درست هستن
    const _tags = Array.isArray(tags) ? tags : tags ? tags.split(',') : [];
    const _images = Array.isArray(images) ? images : images ? images.split(',') : [];

    const update = {
      ...(title !== undefined && { title }),
      ...(price !== undefined && { price }),
      ...(category !== undefined && { category }),
      ...(desc !== undefined && { desc }),
      ...(tags !== undefined && { tags: _tags }),
      ...(images !== undefined && { images: _images }),
      ...(mainImageIndex !== undefined && { mainImageIndex })
    };

    const updatedProduct = await Product.findByIdAndUpdate(id, update, { new: true });
    if (!updatedProduct) return res.status(404).json({ message: 'محصول پیدا نشد!' });
    res.json({ message: 'محصول ویرایش شد', product: updatedProduct });
  } catch (err) {
    res.status(500).json({ message: 'خطا در ویرایش محصول', error: err.message });
  }
};

// حذف محصول
exports.deleteProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'محصول پیدا نشد!' });
    res.json({ message: 'محصول حذف شد' });
  } catch (err) {
    res.status(500).json({ message: 'خطا در حذف محصول', error: err.message });
  }
};

exports.getLikeStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const actor = resolveRequestActor(req, { allowIpFallback: false });

    const product = await Product.findById(id).select('likesCount likedBy');
    if (!product) return res.status(404).json({ message: 'محصول پیدا نشد!' });

    const likesCount = Number(product.likesCount || 0);
    const liked = actor ? product.likedBy.includes(actor) : false;

    res.json({ likesCount, liked });
  } catch (err) {
    res.status(500).json({ message: 'خطا در دریافت وضعیت پسندیدن', error: err.message });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const id = req.params.id;
    const actor = resolveRequestActor(req);

    if (!actor) {
      return res.status(400).json({ message: 'هویت کاربر برای ثبت پسند ضروری است.' });
    }

    const product = await Product.findById(id).select('likesCount likedBy');
    if (!product) return res.status(404).json({ message: 'محصول پیدا نشد!' });

    const hasLiked = product.likedBy.includes(actor);
    if (hasLiked) {
      product.likedBy = product.likedBy.filter((entry) => entry !== actor);
      product.likesCount = Math.max(0, Number(product.likesCount || 0) - 1);
    } else {
      product.likedBy.push(actor);
      product.likesCount = Number(product.likesCount || 0) + 1;
    }

    await product.save();

    res.json({
      liked: !hasLiked,
      likesCount: product.likesCount,
      message: hasLiked ? 'پسند شما حذف شد.' : 'محصول با موفقیت پسندیده شد.'
    });
  } catch (err) {
    console.error('Failed to toggle product like:', err);
    res.status(500).json({ message: 'خطا در ثبت پسند', error: err.message });
  }
};


// گرفتن محصول تکی با آیدی
// گرفتن محصول تکی با آیدی و دادن مشخصات فروشنده
// گرفتن محصول تکی با آیدی و دادن مشخصات فروشنده
exports.getProductById = async (req, res) => {
  try {
    const id = req.params.id;
    const likeActor = resolveRequestActor(req, { allowIpFallback: false });

    // پیدا کردن محصول و گرفتن اطلاعات seller (گسترش‌یافته)
    const product = await Product.findById(id)
      .populate({
        path: 'sellerId',
        select: 'storename ownerName address shopurl ownerFirstname ownerLastname phone logo category city'
      });

    if (!product) return res.status(404).json({ message: 'محصول پیدا نشد!' });

    await enforceDiscountLifecycle(product);
    const payload = buildProductResponse(req, product, { likeActor });

    // اضافه کردن اطلاعات seller به خروجی
    payload.seller = payload.seller || payload.sellerId || {};

    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: 'خطا در دریافت محصول', error: err.message });
  }
};



// گرفتن جدیدترین محصولات
// گرفتن جدیدترین محصولات
// گرفتن جدیدترین محصولات
// controllers/productController.js  ⬅️ فقط این تابع را جایگزین کن
// گرفتن جدیدترین محصولات
exports.getLatestProducts = async (req, res) => {
  try {
    const likeActor = resolveRequestActor(req, { allowIpFallback: false });
    const now = new Date();
    const docs = await Product.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate({
        path: 'sellerId',
        select: 'storename ownerName address shopurl ownerFirstname ownerLastname category city'
      });

    const products = await Promise.all(docs.map(async (doc) => {
      await enforceDiscountLifecycle(doc, now);
      return buildProductResponse(req, doc, { likeActor });
    }));

    if (!products.length)
      return res.status(404).json({ success: false, message: 'محصولی یافت نشد' });

    res.json({ success: true, products });
  } catch (err) {
    console.error('Error fetching latest products:', err);
    res.status(500).json({ success: false, message: 'خطا در دریافت جدیدترین محصولات', error: err.message });
  }
};




