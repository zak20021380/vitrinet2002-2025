const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const SellerStory = require('../models/SellerStory');
const Seller = require('../models/Seller');
const SellerNotification = require('../models/SellerNotification');
const User = require('../models/user');
const authMiddleware = require('../middlewares/authMiddleware');
const { JWT_SECRET } = require('../config/security');

const router = express.Router();
const STORY_DURATION_MS = SellerStory.DAY_MS;
const uploadDir = path.join(__dirname, '..', 'uploads', 'stories');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeBase = path.basename(file.originalname || 'story', ext).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'story';
    cb(null, `${safeBase}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    return cb(null, true);
  }
});

function getSellerId(req) {
  return req.user && req.user.sellerId;
}

function getStoryTarget(req) {
  const raw = String(
    req.query?.target ||
    req.query?.scope ||
    req.query?.context ||
    req.body?.target ||
    req.get('x-story-target') ||
    ''
  ).trim().toLowerCase();

  if (['service', 'services', 'service-shop', 'serviceshop'].includes(raw)) return 'service';
  return 'shop';
}

function getStoryTargetFilter(target = 'shop') {
  if (target === 'service') return { targetType: 'service' };
  return {
    $or: [
      { targetType: 'shop' },
      { targetType: { $exists: false } },
      { targetType: null }
    ]
  };
}

function mergeStoryTargetFilter(base, target) {
  const filter = getStoryTargetFilter(target);
  if (filter.$or) {
    return { $and: [base, filter] };
  }
  return { ...base, ...filter };
}

function getStoryWindowEndsAt(story, now = new Date()) {
  const createdAt = story?.createdAt ? new Date(story.createdAt) : null;
  if (createdAt && !Number.isNaN(createdAt.getTime())) {
    return new Date(createdAt.getTime() + STORY_DURATION_MS);
  }

  const expiresAt = story?.expiresAt ? new Date(story.expiresAt) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime())) return expiresAt;

  return now;
}

function isStoryActive(story, now = new Date()) {
  if (!story) return false;
  if (story.status === 'deleted') return false;
  if (!String(story.imageUrl || '').trim()) return false;
  return getStoryWindowEndsAt(story, now).getTime() > now.getTime();
}

function activeStoryWindowFilter(now = new Date()) {
  const earliestCreatedAt = new Date(now.getTime() - STORY_DURATION_MS);
  return {
    status: { $ne: 'deleted' },
    imageUrl: { $exists: true, $nin: ['', null] },
    $or: [
      { createdAt: { $gt: earliestCreatedAt } },
      { createdAt: { $exists: false }, expiresAt: { $gt: now } },
      { createdAt: null, expiresAt: { $gt: now } }
    ]
  };
}

function cleanSingleLine(value, maxLength = 140) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function buildStoryDashboardUrl(storyId) {
  const encodedStoryId = encodeURIComponent(String(storyId || ''));
  return `/seller/dashboard.html?section=stories${encodedStoryId ? `&storyId=${encodedStoryId}` : ''}`;
}

function getTokenCandidates(req) {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  return [
    headerToken,
    req.cookies?.user_token,
    req.cookies?.seller_token
  ].filter((token, index, tokens) => token && tokens.indexOf(token) === index);
}

async function getOptionalStoryActor(req, storySellerId = null) {
  const tokens = getTokenCandidates(req);
  for (const token of tokens) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const role = String(payload?.role || '').trim().toLowerCase();
      if (!payload?.id || !['user', 'seller'].includes(role)) continue;

      if (role === 'seller') {
        const seller = await Seller.findById(payload.id).select('storename firstname lastname phone').lean();
        if (!seller) continue;

        const sellerName = cleanSingleLine(
          seller.storename || `${seller.firstname || ''} ${seller.lastname || ''}`,
          60
        );
        return {
          role: 'seller',
          sellerId: seller._id,
          isStoryOwner: storySellerId ? String(seller._id) === String(storySellerId) : false,
          displayName: sellerName || 'فروشنده'
        };
      }

      const user = await User.findById(payload.id).select('firstname lastname phone deleted').lean();
      if (!user || user.deleted) continue;

      let isStoryOwner = false;
      if (storySellerId && user.phone) {
        const owner = await Seller.findById(storySellerId).select('phone').lean();
        isStoryOwner = Boolean(owner?.phone && String(owner.phone) === String(user.phone));
      }

      const fullName = cleanSingleLine(`${user.firstname || ''} ${user.lastname || ''}`, 60);
      return {
        role: 'user',
        userId: user._id,
        isStoryOwner,
        displayName: fullName || (user.phone ? `کاربر ${String(user.phone).slice(-4)}` : 'یک کاربر')
      };
    } catch {
      continue;
    }
  }

  return null;
}

function getStoryActorName(actor) {
  return cleanSingleLine(actor?.displayName, 60) || 'یک کاربر';
}

async function createStoryLikeNotification(story, actor, reactionKey) {
  try {
    const storyId = story?._id;
    const sellerId = story?.seller;
    if (!storyId || !sellerId || actor?.isStoryOwner) return null;

    const actorKey = actor?.userId
      ? `user:${actor.userId}`
      : (reactionKey ? `reaction:${reactionKey}` : 'anonymous');
    const actorName = getStoryActorName(actor);
    const isNamedActor = actorName && actorName !== 'یک کاربر';
    const dedupeKey = `story-like:${storyId}:${actorKey}`;
    const actionUrl = buildStoryDashboardUrl(storyId);

    return await SellerNotification.findOneAndUpdate(
      { dedupeKey },
      {
        $setOnInsert: {
          sellerId,
          recipientRole: 'seller',
          recipientId: sellerId,
          type: 'story_like',
          title: 'استوری شما لایک شد',
          message: isNamedActor
            ? `${actorName} استوری فروشگاه شما را لایک کرد.`
            : 'یک کاربر استوری فروشگاه شما را لایک کرد.',
          read: false,
          readAt: null,
          targetRoute: 'stories',
          targetId: String(storyId),
          metadata: {
            storyId: String(storyId),
            actorKey,
            actorName,
            createdAt: new Date()
          },
          dedupeKey,
          relatedData: {
            storyId,
            customerId: actor?.userId || null,
            customerName: actorName,
            actionUrl
          }
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.warn('Failed to create story like notification:', error.message || error);
    return null;
  }
}

async function createStoryReplyNotification(story, reply, actor) {
  try {
    const storyId = story?._id;
    const sellerId = story?.seller;
    const replyId = reply?._id;
    if (!storyId || !sellerId || !replyId || actor?.isStoryOwner) return null;

    const preview = cleanSingleLine(reply.message, 90);
    const actorName = cleanSingleLine(actor?.displayName || reply.displayName, 60) || 'یک کاربر';
    const isNamedActor = actorName && actorName !== 'یک کاربر';
    const dedupeKey = `story-reply:${storyId}:${replyId}`;
    const actionUrl = buildStoryDashboardUrl(storyId);
    const previewText = preview ? `: «${preview}»` : '.';

    return await SellerNotification.findOneAndUpdate(
      { dedupeKey },
      {
        $setOnInsert: {
          sellerId,
          recipientRole: 'seller',
          recipientId: sellerId,
          type: 'story_reply',
          title: 'پاسخ جدید به استوری',
          message: isNamedActor
            ? `${actorName} به استوری شما پاسخ داد${previewText}`
            : `یک کاربر به استوری شما پاسخ داد${previewText}`,
          read: false,
          readAt: null,
          targetRoute: 'stories',
          targetId: String(storyId),
          metadata: {
            storyId: String(storyId),
            replyId: String(replyId),
            actorName,
            replyPreview: preview,
            createdAt: new Date()
          },
          dedupeKey,
          relatedData: {
            storyId,
            storyReplyId: String(replyId),
            replyPreview: preview,
            customerId: actor?.userId || reply.user || null,
            customerName: actorName,
            actionUrl
          }
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.warn('Failed to create story reply notification:', error.message || error);
    return null;
  }
}

function serializeReply(reply) {
  if (!reply) return null;
  return {
    id: reply._id,
    _id: reply._id,
    message: reply.message || '',
    displayName: reply.displayName || 'کاربر ویتری‌نت',
    user: reply.user || null,
    readAt: reply.readAt || null,
    createdAt: reply.createdAt || null
  };
}

function serializeReplies(replies = [], limit = 50) {
  return [...(Array.isArray(replies) ? replies : [])]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, limit)
    .map(serializeReply)
    .filter(Boolean);
}

function serializeStory(story, now = new Date(), options = {}) {
  if (!story) return null;
  if (!String(story.imageUrl || '').trim()) return null;
  const expiresAt = getStoryWindowEndsAt(story, now);
  const createdAt = story.createdAt ? new Date(story.createdAt) : null;
  const sellerId = story.seller ? String(story.seller) : '';
  const isDeleted = story.status === 'deleted';
  const isExpired = isDeleted || !expiresAt || expiresAt.getTime() <= now.getTime();
  const remainingMs = expiresAt ? Math.max(0, expiresAt.getTime() - now.getTime()) : 0;
  const elapsedMs = createdAt ? Math.max(0, now.getTime() - createdAt.getTime()) : 0;
  const progress = Math.min(100, Math.max(0, (elapsedMs / STORY_DURATION_MS) * 100));
  const replies = Array.isArray(story.replies) ? story.replies : [];
  const repliesCount = Number.isFinite(Number(story.repliesCount))
    ? Number(story.repliesCount || 0)
    : replies.length;
  const unreadRepliesCount = Number.isFinite(Number(story.unreadRepliesCount))
    ? Number(story.unreadRepliesCount || 0)
    : replies.filter((reply) => !reply.readAt).length;

  const payload = {
    id: story._id,
    _id: story._id,
    sellerId,
    imageUrl: story.imageUrl,
    targetType: story.targetType || 'shop',
    caption: story.caption || '',
    viewsCount: story.viewsCount || 0,
    likesCount: story.likesCount || 0,
    repliesCount,
    status: isDeleted ? 'deleted' : (isExpired ? 'expired' : 'active'),
    createdAt: story.createdAt,
    expiresAt,
    remainingMs,
    progress
  };

  if (options.includeReplies) {
    payload.unreadRepliesCount = unreadRepliesCount;
    payload.replies = serializeReplies(replies, options.replyLimit || 50);
  }

  return payload;
}

function getReactionKey(req) {
  const raw = String(
    req.get('x-story-reaction-key') ||
    req.body?.reactionKey ||
    req.query?.reactionKey ||
    ''
  ).trim();

  const safeRaw = raw.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 96);
  if (safeRaw) return safeRaw;

  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwardedFor || req.ip || req.socket?.remoteAddress || 'unknown-ip';
  const userAgent = req.get('user-agent') || 'unknown-agent';
  const fallbackHash = crypto
    .createHash('sha256')
    .update(`${ip}|${userAgent}`)
    .digest('hex')
    .slice(0, 40);

  return `request:${fallbackHash}`;
}

function getReplyKey(req) {
  const raw = String(
    req.get('x-story-reply-key') ||
    req.body?.replyKey ||
    ''
  ).trim();
  const safeRaw = raw.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 96);
  return safeRaw || getReactionKey(req);
}

function getDesiredReactionState(req) {
  const raw = String(req.get('x-story-reaction-state') || req.body?.reacted || '').trim().toLowerCase();
  if (['1', 'true', 'liked', 'like'].includes(raw)) return true;
  if (['0', 'false', 'unliked', 'unlike'].includes(raw)) return false;
  return null;
}

async function expireOldStories(sellerId, target = 'shop', now = new Date()) {
  await SellerStory.updateMany(
    mergeStoryTargetFilter({
      seller: sellerId,
      status: 'active',
      $or: [
        { createdAt: { $lte: new Date(now.getTime() - STORY_DURATION_MS) } },
        { createdAt: { $exists: false }, expiresAt: { $lte: now } },
        { createdAt: null, expiresAt: { $lte: now } }
      ]
    }, target),
    { $set: { status: 'expired' } }
  );
}

async function buildStoryState(sellerId, target = 'shop') {
  const now = new Date();
  await expireOldStories(sellerId, target, now);

  const [latestStory, activeStory] = await Promise.all([
    SellerStory.findOne(mergeStoryTargetFilter({ seller: sellerId }, target)).sort({ createdAt: -1 }).lean(),
    SellerStory.findOne(mergeStoryTargetFilter({ seller: sellerId, ...activeStoryWindowFilter(now) }, target)).sort({ createdAt: -1 }).lean()
  ]);

  // Debug logging
  console.log('[buildStoryState] sellerId:', sellerId, 'target:', target);
  console.log('[buildStoryState] latestStory found:', !!latestStory, latestStory ? {
    id: latestStory._id,
    status: latestStory.status,
    expiresAt: latestStory.expiresAt,
    createdAt: latestStory.createdAt
  } : null);
  console.log('[buildStoryState] activeStory found:', !!activeStory);

  const nextAvailableAt = latestStory?.createdAt
    ? new Date(new Date(latestStory.createdAt).getTime() + STORY_DURATION_MS)
    : null;
  const cooldownRemainingMs = nextAvailableAt
    ? Math.max(0, nextAvailableAt.getTime() - now.getTime())
    : 0;
  const visibleLatestStory = latestStory?.status === 'deleted' ? null : latestStory;

  return {
    success: true,
    targetType: target,
    story: serializeStory(isStoryActive(activeStory, now) ? activeStory : null, now, { includeReplies: true }),
    latestStory: serializeStory(visibleLatestStory, now, { includeReplies: true }),
    canPost: cooldownRemainingMs <= 0,
    cooldownRemainingMs,
    nextAvailableAt
  };
}

async function buildPublicStoryState(sellerId, target = 'shop') {
  const now = new Date();
  await expireOldStories(sellerId, target, now);

  const [activeStories, latestStory] = await Promise.all([
    SellerStory.find(mergeStoryTargetFilter({ seller: sellerId, ...activeStoryWindowFilter(now) }, target))
      .sort({ createdAt: -1 })
      .limit(12)
      .lean(),
    SellerStory.findOne(mergeStoryTargetFilter({ seller: sellerId }, target)).sort({ createdAt: -1 }).lean()
  ]);
  const visibleLatestStory = latestStory?.status === 'deleted' ? null : latestStory;

  return {
    success: true,
    targetType: target,
    stories: activeStories.map((story) => serializeStory(story, now)).filter(Boolean),
    story: serializeStory(activeStories.find((story) => isStoryActive(story, now)) || null, now),
    latestStory: serializeStory(visibleLatestStory, now)
  };
}

function removeUploadedFile(file) {
  if (!file?.path) return;
  fs.unlink(file.path, (error) => {
    if (error) {
      console.warn('Failed to remove story upload:', error.message || error);
    }
  });
}

function removeStoryImage(imageUrl) {
  const normalized = String(imageUrl || '').replace(/\\/g, '/');
  const prefix = '/uploads/stories/';
  if (!normalized.startsWith(prefix)) return;

  const filename = path.basename(normalized);
  if (!filename) return;

  fs.unlink(path.join(uploadDir, filename), (error) => {
    if (error && error.code !== 'ENOENT') {
      console.warn('Failed to remove story image:', error.message || error);
    }
  });
}

async function getOptionalReplyAuthor(req) {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const token = headerToken || req.cookies?.user_token || '';
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.id || String(payload.role || '').toLowerCase() !== 'user') return null;

    const user = await User.findById(payload.id).select('firstname lastname phone deleted').lean();
    if (!user || user.deleted) return null;

    const fullName = cleanSingleLine(`${user.firstname || ''} ${user.lastname || ''}`, 60);
    return {
      userId: user._id,
      displayName: fullName || (user.phone ? `کاربر ${String(user.phone).slice(-4)}` : 'کاربر ویتری‌نت')
    };
  } catch {
    return null;
  }
}

router.get('/public/:sellerId', async (req, res) => {
  try {
    const { sellerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller id.' });
    }

    return res.json(await buildPublicStoryState(sellerId, getStoryTarget(req)));
  } catch (error) {
    console.error('Failed to load public seller stories:', error);
    return res.status(500).json({ success: false, message: 'Could not load story data.' });
  }
});

router.post('/public/:storyId/view', async (req, res) => {
  try {
    const { storyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ success: false, message: 'Invalid story id.' });
    }

    const now = new Date();
    const story = await SellerStory.findOneAndUpdate(
      { _id: storyId, ...activeStoryWindowFilter(now) },
      { $inc: { viewsCount: 1 } },
      { new: true }
    ).lean();

    if (!story) {
      return res.status(404).json({ success: false, message: 'Story is not active.' });
    }

    return res.json({ success: true, story: serializeStory(story, now) });
  } catch (error) {
    console.error('Failed to track story view:', error);
    return res.status(500).json({ success: false, message: 'Could not track story view.' });
  }
});

router.post('/public/:storyId/reaction', async (req, res) => {
  try {
    const { storyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ success: false, message: 'Invalid story id.' });
    }

    const now = new Date();
    const reactionKey = getReactionKey(req);
    const desiredReacted = getDesiredReactionState(req);
    const story = await SellerStory.findOne({ _id: storyId, ...activeStoryWindowFilter(now) })
      .select('+likedBy');
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story is not active.' });
    }

    const currentLikedBy = Array.isArray(story.likedBy) ? story.likedBy : [];
    const alreadyReacted = currentLikedBy.includes(reactionKey);
    const shouldReact = desiredReacted === null ? !alreadyReacted : desiredReacted;
    let reacted = alreadyReacted;

    if (!shouldReact && alreadyReacted) {
      story.likedBy = currentLikedBy.filter((key) => key !== reactionKey);
      story.likesCount = Math.max(0, Number(story.likesCount || 0) - 1);
      reacted = false;
      await story.save();
    } else if (shouldReact && !alreadyReacted) {
      story.likedBy = [...currentLikedBy, reactionKey];
      story.likesCount = Math.max(0, Number(story.likesCount || 0) + 1);
      reacted = true;
      await story.save();
      const actor = await getOptionalStoryActor(req, story.seller);
      await createStoryLikeNotification(story, actor, reactionKey);
    } else {
      story.likesCount = Math.max(0, Number(story.likesCount || 0));
    }

    return res.json({ success: true, reacted, story: serializeStory(story.toObject(), now) });
  } catch (error) {
    console.error('Failed to react to story:', error);
    return res.status(500).json({ success: false, message: 'Could not react to story.' });
  }
});

router.post('/public/:storyId/replies', async (req, res) => {
  try {
    const { storyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ success: false, message: 'Invalid story id.' });
    }

    const message = cleanSingleLine(req.body?.message, 500);
    if (!message || message.length < 2) {
      return res.status(400).json({ success: false, message: 'Reply message is required.' });
    }

    const now = new Date();
    const story = await SellerStory.findOne({ _id: storyId, ...activeStoryWindowFilter(now) })
      .select('+replies.replyKey');
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story is not active.' });
    }

    const actor = await getOptionalStoryActor(req, story.seller);
    const optionalAuthor = actor?.role === 'user'
      ? { userId: actor.userId, displayName: actor.displayName }
      : await getOptionalReplyAuthor(req);
    const requestedName = cleanSingleLine(req.body?.displayName, 60);
    const replyKey = getReplyKey(req);
    const duplicateReply = (Array.isArray(story.replies) ? story.replies : [])
      .find((item) => (
        item?.replyKey &&
        item.replyKey === replyKey &&
        cleanSingleLine(item.message, 500) === message &&
        item.createdAt &&
        (now.getTime() - new Date(item.createdAt).getTime()) < 30000
      ));

    if (duplicateReply) {
      return res.json({
        success: true,
        duplicate: true,
        reply: serializeReply(duplicateReply),
        story: serializeStory(story.toObject(), now)
      });
    }

    const reply = {
      message,
      displayName: optionalAuthor?.displayName || requestedName || 'کاربر ویتری‌نت',
      replyKey: getReplyKey(req),
      user: optionalAuthor?.userId || null,
      createdAt: now
    };
    reply.displayName = actor?.displayName || requestedName || reply.displayName || 'یک کاربر';
    reply.replyKey = replyKey;
    reply.user = actor?.role === 'user' ? actor.userId : reply.user;

    story.replies.push(reply);
    story.repliesCount = Math.max(Number(story.repliesCount || 0) + 1, story.replies.length);
    story.unreadRepliesCount = Math.max(0, Number(story.unreadRepliesCount || 0) + 1);
    await story.save();

    const savedReply = story.replies[story.replies.length - 1];
    await createStoryReplyNotification(story, savedReply, actor);
    return res.status(201).json({
      success: true,
      reply: serializeReply(savedReply),
      story: serializeStory(story.toObject(), now)
    });
  } catch (error) {
    console.error('Failed to submit story reply:', error);
    return res.status(500).json({ success: false, message: 'Could not submit story reply.' });
  }
});

router.get('/me', authMiddleware('seller'), async (req, res) => {
  try {
    const sellerId = getSellerId(req);
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Seller authentication is required.' });
    }

    const storyState = await buildStoryState(sellerId, getStoryTarget(req));
    
    console.log('[GET /api/seller/stories/me] Returning state for seller:', sellerId, {
      hasStory: !!storyState.story,
      storyStatus: storyState.story?.status,
      storyId: storyState.story?.id
    });

    return res.json(storyState);
  } catch (error) {
    console.error('Failed to load seller story:', error);
    return res.status(500).json({ success: false, message: 'Could not load story data.' });
  }
});

router.get('/:storyId/replies', authMiddleware('seller'), async (req, res) => {
  try {
    const sellerId = getSellerId(req);
    const { storyId } = req.params;
    const target = getStoryTarget(req);
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Seller authentication is required.' });
    }
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ success: false, message: 'Invalid story id.' });
    }

    const story = await SellerStory.findOne(mergeStoryTargetFilter({ _id: storyId, seller: sellerId }, target)).lean();
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story was not found.' });
    }

    return res.json({
      success: true,
      replies: serializeReplies(story.replies, 100),
      repliesCount: story.repliesCount || story.replies?.length || 0,
      unreadRepliesCount: story.unreadRepliesCount || 0
    });
  } catch (error) {
    console.error('Failed to load story replies:', error);
    return res.status(500).json({ success: false, message: 'Could not load story replies.' });
  }
});

router.patch('/:storyId/replies/read', authMiddleware('seller'), async (req, res) => {
  try {
    const sellerId = getSellerId(req);
    const { storyId } = req.params;
    const target = getStoryTarget(req);
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Seller authentication is required.' });
    }
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ success: false, message: 'Invalid story id.' });
    }

    const story = await SellerStory.findOne(mergeStoryTargetFilter({ _id: storyId, seller: sellerId }, target));
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story was not found.' });
    }

    const now = new Date();
    story.replies.forEach((reply) => {
      if (!reply.readAt) reply.readAt = now;
    });
    story.unreadRepliesCount = 0;
    await story.save();

    return res.json({
      success: true,
      replies: serializeReplies(story.toObject().replies, 100),
      unreadRepliesCount: 0
    });
  } catch (error) {
    console.error('Failed to mark story replies as read:', error);
    return res.status(500).json({ success: false, message: 'Could not mark story replies as read.' });
  }
});

router.delete('/:storyId', authMiddleware('seller'), async (req, res) => {
  try {
    const sellerId = getSellerId(req);
    const { storyId } = req.params;
    const target = getStoryTarget(req);
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Seller authentication is required.' });
    }
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ success: false, message: 'Invalid story id.' });
    }

    const now = new Date();
    await expireOldStories(sellerId, target, now);

    const story = await SellerStory.findOneAndUpdate(
      mergeStoryTargetFilter({ _id: storyId, seller: sellerId, ...activeStoryWindowFilter(now) }, target),
      { $set: { status: 'deleted', expiresAt: now } },
      { new: true }
    ).lean();

    if (!story) {
      return res.status(404).json({ success: false, message: 'Story is not active.' });
    }

    removeStoryImage(story.imageUrl);
    return res.json(await buildStoryState(sellerId, target));
  } catch (error) {
    console.error('Failed to delete seller story:', error);
    return res.status(500).json({ success: false, message: 'Could not delete story.' });
  }
});

router.post('/', authMiddleware('seller'), (req, res) => {
  upload.single('image')(req, res, async (uploadError) => {
    if (uploadError) {
      const message = uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE'
        ? 'Image must be smaller than 5MB.'
        : uploadError.message || 'Could not upload story image.';
      return res.status(400).json({ success: false, message });
    }

    try {
      const sellerId = getSellerId(req);
      const target = getStoryTarget(req);
      if (!sellerId) {
        removeUploadedFile(req.file);
        return res.status(401).json({ success: false, message: 'Seller authentication is required.' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Story image is required.' });
      }

      const caption = String(req.body.caption || '').trim().slice(0, 140);
      const now = new Date();
      await expireOldStories(sellerId, target, now);

      const latestStory = await SellerStory.findOne(mergeStoryTargetFilter({ seller: sellerId }, target)).sort({ createdAt: -1 }).lean();
      if (latestStory?.createdAt) {
        const nextAvailableAt = new Date(new Date(latestStory.createdAt).getTime() + STORY_DURATION_MS);
        if (nextAvailableAt.getTime() > now.getTime()) {
          removeUploadedFile(req.file);
          return res.status(429).json({
            success: false,
            message: 'Only one story can be posted every 24 hours.',
            cooldownRemainingMs: nextAvailableAt.getTime() - now.getTime(),
            nextAvailableAt
          });
        }
      }

      const story = await SellerStory.create({
        seller: sellerId,
        targetType: target,
        imageUrl: `/uploads/stories/${req.file.filename}`,
        caption,
        expiresAt: SellerStory.buildExpiryDate(now),
        status: 'active'  // Explicitly set status
      });

      console.log('[POST /api/seller/stories] Created story:', {
        id: story._id,
        sellerId,
        status: story.status,
        expiresAt: story.expiresAt,
        targetType: story.targetType
      });

      const storyState = await buildStoryState(sellerId, target);
      const createdStory = serializeStory(story.toObject(), now);

      return res.status(201).json({
        ...storyState,
        story: createdStory  // Ensure we return the newly created story
      });
    } catch (error) {
      removeUploadedFile(req.file);
      console.error('Failed to create seller story:', error);
      return res.status(500).json({ success: false, message: 'Could not publish story.' });
    }
  });
});

module.exports = router;
