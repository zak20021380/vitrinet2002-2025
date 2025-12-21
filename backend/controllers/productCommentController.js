// backend/controllers/productCommentController.js
// کنترلر مدیریت نظرات محصولات - نسخه امن و حرفه‌ای

const ProductComment = require('../models/ProductComment');
const Product = require('../models/product');
const User = require('../models/user');
const mongoose = require('mongoose');
const { processMessage, securityLog, isValidObjectId } = require('../utils/messageSecurity');

// ═══════════════════════════════════════════════════════════════
// Rate Limiting برای جلوگیری از spam
// ═══════════════════════════════════════════════════════════════
const commentRateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 ساعت
const MAX_COMMENTS_PER_HOUR = 5;

function checkCommentRateLimit(userId) {
  const now = Date.now();
  const userKey = `comment_${userId}`;
  
  if (!commentRateLimits.has(userKey)) {
    commentRateLimits.set(userKey, { count: 1, firstRequest: now });
    return { allowed: true, remaining: MAX_COMMENTS_PER_HOUR - 1 };
  }
  
  const userData = commentRateLimits.get(userKey);
  
  if (now - userData.firstRequest > RATE_LIMIT_WINDOW) {
    commentRateLimits.set(userKey, { count: 1, firstRequest: now });
    return { allowed: true, remaining: MAX_COMMENTS_PER_HOUR - 1 };
  }
  
  if (userData.count >= MAX_COMMENTS_PER_HOUR) {
    const resetTime = Math.ceil((userData.firstRequest + RATE_LIMIT_WINDOW - now) / 60000);
    return { 
      allowed: false, 
      remaining: 0,
      resetInMinutes: resetTime,
      error: `تعداد نظرات شما بیش از حد مجاز است. لطفاً ${resetTime} دقیقه صبر کنید.`
    };
  }
  
  userData.count++;
  return { allowed: true, remaining: MAX_COMMENTS_PER_HOUR - userData.count };
}

// پاکسازی دوره‌ای Map
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of commentRateLimits.entries()) {
    if (now - value.firstRequest > RATE_LIMIT_WINDOW * 2) {
      commentRateLimits.delete(key);
    }
  }
}, 30 * 60 * 1000); // هر 30 دقیقه

// ═══════════════════════════════════════════════════════════════
// ثبت نظر جدید (کاربر) - وضعیت پیش‌فرض: pending
// POST /api/comments
// ═══════════════════════════════════════════════════════════════
exports.submitComment = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const userIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const { productId, content, rating } = req.body;

    // ═══════════════════════════════════════════════════════════
    // 1. Rate Limiting
    // ═══════════════════════════════════════════════════════════
    const rateCheck = checkCommentRateLimit(userId);
    if (!rateCheck.allowed) {
      securityLog('RATE_LIMIT_EXCEEDED', { userId, userIp, type: 'comment' });
      return res.status(429).json({
        success: false,
        message: rateCheck.error,
        retryAfter: rateCheck.resetInMinutes
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 2. اعتبارسنجی ورودی‌های اولیه
    // ═══════════════════════════════════════════════════════════
    if (!productId || !content || rating === undefined || rating === null) {
      return res.status(400).json({
        success: false,
        message: 'شناسه محصول، متن نظر و امتیاز الزامی است.'
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 3. اعتبارسنجی ObjectId (جلوگیری از NoSQL Injection)
    // ═══════════════════════════════════════════════════════════
    if (!isValidObjectId(productId)) {
      securityLog('INVALID_OBJECT_ID', { userId, userIp, productId });
      return res.status(400).json({
        success: false,
        message: 'شناسه محصول نامعتبر است.'
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 4. اعتبارسنجی و Sanitize امتیاز
    // ═══════════════════════════════════════════════════════════
    const ratingNum = parseInt(rating, 10);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        success: false,
        message: 'امتیاز باید عددی بین ۱ تا ۵ باشد.'
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 5. پردازش و Sanitize متن نظر (مهم‌ترین بخش امنیتی)
    // ═══════════════════════════════════════════════════════════
    const processedContent = processMessage(content, {
      minLength: 3,
      maxLength: 1000,
      allowHtml: false,
      strictMode: true
    });

    if (!processedContent.success) {
      // لاگ امنیتی در صورت شناسایی محتوای خطرناک
      if (processedContent.code === 'DANGEROUS_CONTENT') {
        securityLog('DANGEROUS_CONTENT_BLOCKED', {
          userId,
          userIp,
          productId,
          threats: processedContent.threats,
          originalLength: content?.length
        });
      }
      
      return res.status(400).json({
        success: false,
        message: processedContent.error,
        code: processedContent.code
      });
    }

    const sanitizedContent = processedContent.sanitizedText;

    // ═══════════════════════════════════════════════════════════
    // 6. بررسی وجود محصول و دریافت sellerId
    // ═══════════════════════════════════════════════════════════
    const product = await Product.findById(productId).select('sellerId title').lean();
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'محصول مورد نظر یافت نشد.'
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 7. بررسی نظر تکراری
    // ═══════════════════════════════════════════════════════════
    const existingComment = await ProductComment.findOne({
      userId,
      productId,
      status: { $in: ['pending', 'published'] }
    });

    if (existingComment) {
      return res.status(400).json({
        success: false,
        message: 'شما قبلاً برای این محصول نظر ثبت کرده‌اید.'
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 8. ایجاد نظر جدید با وضعیت pending
    // ═══════════════════════════════════════════════════════════
    const comment = new ProductComment({
      userId,
      productId,
      sellerId: product.sellerId,
      content: sanitizedContent,
      rating: ratingNum,
      status: 'pending',
      metadata: {
        userIp: userIp.split(',')[0].trim(), // فقط IP اول
        userAgent: (req.headers['user-agent'] || '').slice(0, 200),
        submittedAt: new Date()
      }
    });

    await comment.save();

    // لاگ موفقیت
    securityLog('COMMENT_SUBMITTED', {
      userId,
      productId,
      commentId: comment._id,
      rating: ratingNum,
      contentLength: sanitizedContent.length
    });

    res.status(201).json({
      success: true,
      message: 'نظر شما با موفقیت ثبت شد و پس از تأیید فروشنده نمایش داده خواهد شد.',
      comment: {
        id: comment._id,
        status: comment.status,
        createdAt: comment.createdAt
      }
    });

  } catch (err) {
    console.error('❌ خطا در ثبت نظر:', err);
    securityLog('COMMENT_SUBMIT_ERROR', { error: err.message });
    res.status(500).json({
      success: false,
      message: 'خطا در ثبت نظر. لطفاً دوباره تلاش کنید.'
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// دریافت نظرات در انتظار تأیید (فروشنده)
// GET /api/seller/pending-comments
// ═══════════════════════════════════════════════════════════════
exports.getPendingComments = async (req, res) => {
  try {
    const sellerId = req.user.id || req.user._id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [comments, totalCount] = await Promise.all([
      ProductComment.find({ sellerId, status: 'pending' })
        .populate('userId', 'firstname lastname phone')
        .populate('productId', 'title images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductComment.countDocuments({ sellerId, status: 'pending' })
    ]);

    // فرمت‌دهی پاسخ
    const formattedComments = comments.map(c => ({
      id: c._id,
      content: c.content,
      rating: c.rating,
      createdAt: c.createdAt,
      user: c.userId ? {
        id: c.userId._id,
        name: [c.userId.firstname, c.userId.lastname].filter(Boolean).join(' ') || 'کاربر',
        phone: c.userId.phone ? `****${c.userId.phone.slice(-4)}` : null
      } : { name: 'کاربر ناشناس' },
      product: c.productId ? {
        id: c.productId._id,
        title: c.productId.title,
        image: c.productId.images?.[0] || null
      } : null
    }));

    res.json({
      success: true,
      comments: formattedComments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + comments.length < totalCount
      }
    });

  } catch (err) {
    console.error('❌ خطا در دریافت نظرات در انتظار:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت نظرات.'
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// تغییر وضعیت نظر (فروشنده) - تأیید یا رد
// PATCH /api/comments/:id/status
// ═══════════════════════════════════════════════════════════════
exports.updateCommentStatus = async (req, res) => {
  try {
    const sellerId = req.user.id || req.user._id;
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    // اعتبارسنجی ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'شناسه نظر نامعتبر است.'
      });
    }

    // اعتبارسنجی وضعیت
    if (!['published', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'وضعیت باید published یا rejected باشد.'
      });
    }

    // یافتن نظر و بررسی مالکیت
    const comment = await ProductComment.findById(id);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'نظر مورد نظر یافت نشد.'
      });
    }

    // بررسی امنیتی: فروشنده فقط می‌تواند نظرات محصولات خودش را مدیریت کند
    if (comment.sellerId.toString() !== sellerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'شما مجاز به مدیریت این نظر نیستید.'
      });
    }

    // بررسی وضعیت فعلی
    if (comment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `این نظر قبلاً ${comment.status === 'published' ? 'تأیید' : 'رد'} شده است.`
      });
    }

    // به‌روزرسانی وضعیت
    comment.status = status;
    comment.statusChangedAt = new Date();
    
    if (status === 'rejected' && rejectionReason) {
      comment.rejectionReason = String(rejectionReason).trim().slice(0, 500);
    }

    await comment.save();

    res.json({
      success: true,
      message: status === 'published' 
        ? 'نظر با موفقیت تأیید و منتشر شد.' 
        : 'نظر با موفقیت رد شد.',
      comment: {
        id: comment._id,
        status: comment.status,
        statusChangedAt: comment.statusChangedAt
      }
    });

  } catch (err) {
    console.error('❌ خطا در تغییر وضعیت نظر:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در تغییر وضعیت نظر.'
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// دریافت نظرات منتشر شده محصول (عمومی)
// GET /api/public/comments/:productId
// ═══════════════════════════════════════════════════════════════
exports.getPublishedComments = async (req, res) => {
  try {
    const { productId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    // اعتبارسنجی ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'شناسه محصول نامعتبر است.'
      });
    }

    const [comments, totalCount, ratingStats] = await Promise.all([
      ProductComment.find({ productId, status: 'published' })
        .populate('userId', 'firstname lastname')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductComment.countDocuments({ productId, status: 'published' }),
      ProductComment.getProductRating(productId)
    ]);

    // فرمت‌دهی پاسخ
    const formattedComments = comments.map(c => ({
      id: c._id,
      content: c.content,
      rating: c.rating,
      createdAt: c.createdAt,
      user: {
        name: c.userId 
          ? [c.userId.firstname, c.userId.lastname].filter(Boolean).join(' ') || 'کاربر'
          : 'کاربر'
      }
    }));

    res.json({
      success: true,
      reviews: formattedComments,
      avgRating: ratingStats.avgRating,
      totalCount: ratingStats.totalCount,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + comments.length < totalCount
      }
    });

  } catch (err) {
    console.error('❌ خطا در دریافت نظرات محصول:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت نظرات.'
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// دریافت تعداد نظرات در انتظار (فروشنده)
// GET /api/seller/pending-comments/count
// ═══════════════════════════════════════════════════════════════
exports.getPendingCount = async (req, res) => {
  try {
    const sellerId = req.user.id || req.user._id;
    const count = await ProductComment.getPendingCountForSeller(sellerId);

    res.json({
      success: true,
      count
    });

  } catch (err) {
    console.error('❌ خطا در دریافت تعداد نظرات:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت تعداد نظرات.'
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// دریافت همه نظرات فروشنده (با فیلتر وضعیت)
// GET /api/seller/comments
// ═══════════════════════════════════════════════════════════════
exports.getSellerComments = async (req, res) => {
  try {
    const sellerId = req.user.id || req.user._id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status;

    // ساخت فیلتر
    const filter = { sellerId };
    if (statusFilter && ['pending', 'published', 'rejected'].includes(statusFilter)) {
      filter.status = statusFilter;
    }

    const [comments, totalCount, pendingCount] = await Promise.all([
      ProductComment.find(filter)
        .populate('userId', 'firstname lastname phone')
        .populate('productId', 'title images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductComment.countDocuments(filter),
      ProductComment.countDocuments({ sellerId, status: 'pending' })
    ]);

    // فرمت‌دهی پاسخ
    const formattedComments = comments.map(c => ({
      id: c._id,
      content: c.content,
      rating: c.rating,
      status: c.status,
      createdAt: c.createdAt,
      statusChangedAt: c.statusChangedAt,
      rejectionReason: c.rejectionReason,
      user: c.userId ? {
        id: c.userId._id,
        name: [c.userId.firstname, c.userId.lastname].filter(Boolean).join(' ') || 'کاربر',
        phone: c.userId.phone ? `****${c.userId.phone.slice(-4)}` : null
      } : { name: 'کاربر ناشناس' },
      product: c.productId ? {
        id: c.productId._id,
        title: c.productId.title,
        image: c.productId.images?.[0] || null
      } : null
    }));

    res.json({
      success: true,
      comments: formattedComments,
      pendingCount,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + comments.length < totalCount
      }
    });

  } catch (err) {
    console.error('❌ خطا در دریافت نظرات فروشنده:', err);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت نظرات.'
    });
  }
};
