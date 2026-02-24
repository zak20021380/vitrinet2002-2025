const express = require('express');
const router = express.Router();

const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', settingsController.getSmartSearchSettings);
router.put('/', authMiddleware('admin'), settingsController.updateSmartSearchSettings);

module.exports = router;
