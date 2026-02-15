const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/homepageSectionController');

const homepageCardUploadDir = path.join(__dirname, '..', 'uploads', 'homepage-cards');
fs.mkdirSync(homepageCardUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function destination(_req, _file, cb) {
    cb(null, homepageCardUploadDir);
  },
  filename: function filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeBase = path.basename(file.originalname || 'homepage-card', ext).replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${Date.now()}-${Math.floor(Math.random() * 10000)}-${safeBase || 'card'}${ext}`);
  }
});

const upload = multer({ storage });

router.get('/public', controller.listActiveSections);
router.get('/:id/products', controller.getSectionProducts);

router.get('/admin', auth('admin'), controller.listAdminSections);
router.post('/admin', auth('admin'), controller.createSection);
router.put('/admin/:id', auth('admin'), controller.updateSection);
router.put('/admin/:id/toggle', auth('admin'), controller.toggleSection);
router.put('/admin/reorder', auth('admin'), controller.reorderSections);
router.patch('/admin/:id/toggle', auth('admin'), controller.toggleSection);
router.patch('/admin/reorder', auth('admin'), controller.reorderSections);
router.post('/admin/:id/cards', auth('admin'), upload.single('image'), controller.createSectionCard);
router.put('/admin/:id/cards/:cardId', auth('admin'), upload.single('image'), controller.updateSectionCard);
router.delete('/admin/:id/cards/:cardId', auth('admin'), controller.deleteSectionCard);
router.delete('/admin/:id', auth('admin'), controller.deleteSection);

module.exports = router;
