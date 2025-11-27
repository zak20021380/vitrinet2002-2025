const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const auth = require('../middlewares/authMiddleware');
const ShopAppearance = require('../models/ShopAppearance');

// ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'branding');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `footer-${req.user.id}-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

function makeFullUrl(req, filePath) {
  if (!filePath) return '';
  if (/^(https?:|data:)/i.test(filePath)) return filePath;
  return `${req.protocol}://${req.get('host')}/${filePath.replace(/^\//, '')}`;
}

// GET current footer image for seller
router.get('/footer', auth('seller'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.user?.id)) {
      return res.status(400).json({ message: 'شناسه فروشنده معتبر نیست.' });
    }

    const appearance = await ShopAppearance.findOne({ sellerId: req.user.id });
    const url = makeFullUrl(req, appearance?.footerImage || '');
    res.json({ url });
  } catch (err) {
    res.status(500).json({ message: 'خطا در دریافت تصویر فوتر.' });
  }
});

// Public endpoint to get a seller's footer image by ID
router.get('/footer/:sellerId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.sellerId)) {
      return res.status(400).json({ message: 'شناسه فروشنده معتبر نیست.' });
    }

    const appearance = await ShopAppearance.findOne({ sellerId: req.params.sellerId });
    const url = makeFullUrl(req, appearance?.footerImage || '');
    if (!url) {
      return res.status(404).json({ message: 'تصویر فوتر موجود نیست.' });
    }
    res.json({ url });
  } catch (err) {
    res.status(500).json({ message: 'خطا در دریافت تصویر فوتر.' });
  }
});

// POST upload new footer image
router.post('/footer', auth('seller'), upload.single('image'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.user?.id)) {
      return res.status(400).json({ message: 'شناسه فروشنده معتبر نیست.' });
    }

    const appearance = await ShopAppearance.findOne({ sellerId: req.user.id });
    if (!appearance) {
      return res.status(404).json({ message: 'ظاهر فروشگاه یافت نشد.' });
    }

    // remove previous file if exists
    if (appearance.footerImage) {
      fs.unlink(path.join(__dirname, '..', appearance.footerImage), () => {});
    }

    const relPath = path.join('uploads', 'branding', req.file.filename).replace(/\\/g, '/');
    appearance.footerImage = relPath;
    await appearance.save();

    res.json({ url: makeFullUrl(req, relPath) });
  } catch (err) {
    res.status(500).json({ message: 'خطا در آپلود تصویر.' });
  }
});

// DELETE footer image
router.delete('/footer', auth('seller'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.user?.id)) {
      return res.status(400).json({ message: 'شناسه فروشنده معتبر نیست.' });
    }

    const appearance = await ShopAppearance.findOne({ sellerId: req.user.id });
    if (!appearance) {
      return res.status(404).json({ message: 'ظاهر فروشگاه یافت نشد.' });
    }

    if (appearance.footerImage) {
      fs.unlink(path.join(__dirname, '..', appearance.footerImage), () => {});
      appearance.footerImage = '';
      await appearance.save();
    }

    res.json({ message: 'تصویر فوتر حذف شد.' });
  } catch (err) {
    res.status(500).json({ message: 'خطا در حذف تصویر.' });
  }
});

module.exports = router;
