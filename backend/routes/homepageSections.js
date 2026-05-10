const express = require('express');
const router = express.Router();

const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/homepageSectionController');
const { createImageUpload } = require('../utils/uploadHelper');

const upload = createImageUpload({
  subdirectory: 'homepage-cards',
  filenamePrefix: 'homepage-card'
});

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
