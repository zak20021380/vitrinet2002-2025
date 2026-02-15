const express = require('express');
const router = express.Router();

const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/homepageSectionController');

router.get('/public', controller.listActiveSections);
router.get('/:id/products', controller.getSectionProducts);

router.get('/admin', auth('admin'), controller.listAdminSections);
router.post('/admin', auth('admin'), controller.createSection);
router.put('/admin/:id', auth('admin'), controller.updateSection);
router.put('/admin/:id/toggle', auth('admin'), controller.toggleSection);
router.put('/admin/reorder', auth('admin'), controller.reorderSections);
router.patch('/admin/:id/toggle', auth('admin'), controller.toggleSection);
router.patch('/admin/reorder', auth('admin'), controller.reorderSections);
router.delete('/admin/:id', auth('admin'), controller.deleteSection);

module.exports = router;
