const express = require('express');
const router = express.Router();

const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/feature-flags', authMiddleware('admin'), settingsController.getFeatureFlags);
router.put('/feature-flags', authMiddleware('admin'), settingsController.updateFeatureFlags);
router.get('/public/feature-flags', settingsController.getPublicFeatureFlags);

module.exports = router;
