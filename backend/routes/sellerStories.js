const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const SellerStory = require('../models/SellerStory');
const authMiddleware = require('../middlewares/authMiddleware');

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
  return req.user && (req.user.id || req.user._id);
}

function serializeStory(story, now = new Date()) {
  if (!story) return null;
  const expiresAt = story.expiresAt ? new Date(story.expiresAt) : null;
  const createdAt = story.createdAt ? new Date(story.createdAt) : null;
  const isExpired = !expiresAt || expiresAt.getTime() <= now.getTime() || story.status === 'expired';
  const remainingMs = expiresAt ? Math.max(0, expiresAt.getTime() - now.getTime()) : 0;
  const elapsedMs = createdAt ? Math.max(0, now.getTime() - createdAt.getTime()) : 0;
  const progress = Math.min(100, Math.max(0, (elapsedMs / STORY_DURATION_MS) * 100));

  return {
    id: story._id,
    _id: story._id,
    imageUrl: story.imageUrl,
    caption: story.caption || '',
    viewsCount: story.viewsCount || 0,
    likesCount: story.likesCount || 0,
    status: isExpired ? 'expired' : 'active',
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    remainingMs,
    progress
  };
}

async function expireOldStories(sellerId, now = new Date()) {
  await SellerStory.updateMany(
    { seller: sellerId, status: 'active', expiresAt: { $lte: now } },
    { $set: { status: 'expired' } }
  );
}

async function buildStoryState(sellerId) {
  const now = new Date();
  await expireOldStories(sellerId, now);

  const [latestStory, activeStory] = await Promise.all([
    SellerStory.findOne({ seller: sellerId }).sort({ createdAt: -1 }).lean(),
    SellerStory.findOne({ seller: sellerId, status: 'active', expiresAt: { $gt: now } }).sort({ createdAt: -1 }).lean()
  ]);

  const nextAvailableAt = latestStory?.createdAt
    ? new Date(new Date(latestStory.createdAt).getTime() + STORY_DURATION_MS)
    : null;
  const cooldownRemainingMs = nextAvailableAt
    ? Math.max(0, nextAvailableAt.getTime() - now.getTime())
    : 0;

  return {
    success: true,
    story: serializeStory(activeStory || latestStory, now),
    latestStory: serializeStory(latestStory, now),
    canPost: cooldownRemainingMs <= 0,
    cooldownRemainingMs,
    nextAvailableAt
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

router.get('/me', authMiddleware('seller'), async (req, res) => {
  try {
    const sellerId = getSellerId(req);
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Seller authentication is required.' });
    }

    return res.json(await buildStoryState(sellerId));
  } catch (error) {
    console.error('Failed to load seller story:', error);
    return res.status(500).json({ success: false, message: 'Could not load story data.' });
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
      if (!sellerId) {
        removeUploadedFile(req.file);
        return res.status(401).json({ success: false, message: 'Seller authentication is required.' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Story image is required.' });
      }

      const caption = String(req.body.caption || '').trim().slice(0, 140);
      const now = new Date();
      await expireOldStories(sellerId, now);

      const latestStory = await SellerStory.findOne({ seller: sellerId }).sort({ createdAt: -1 }).lean();
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
        imageUrl: `/uploads/stories/${req.file.filename}`,
        caption,
        expiresAt: SellerStory.buildExpiryDate(now)
      });

      return res.status(201).json({
        ...(await buildStoryState(sellerId)),
        story: serializeStory(story, now)
      });
    } catch (error) {
      removeUploadedFile(req.file);
      console.error('Failed to create seller story:', error);
      return res.status(500).json({ success: false, message: 'Could not publish story.' });
    }
  });
});

module.exports = router;
