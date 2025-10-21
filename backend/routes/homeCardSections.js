const express = require('express');
const router = express.Router();

const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/homeCardSectionController');

// Public endpoints
router.get('/', controller.getPublicSections);
router.get('/slug/:slug', controller.getBySlug);

// Admin endpoints
router.get('/admin/all', auth('admin'), controller.getAllSections);
router.get('/:id', auth('admin'), controller.getSectionById);
router.post('/', auth('admin'), controller.createSection);
router.put('/:id', auth('admin'), controller.updateSection);
router.delete('/:id', auth('admin'), controller.deleteSection);

router.post('/:id/cards', auth('admin'), controller.addCard);
router.put('/:id/cards/:cardId', auth('admin'), controller.updateCard);
router.delete('/:id/cards/:cardId', auth('admin'), controller.removeCard);

module.exports = router;
