const express = require('express');
const router = express.Router();
const loyaltyController = require('../controllers/loyaltyController');
const auth = require('../middlewares/authMiddleware');

router.get('/', auth, loyaltyController.getLoyaltyStores);
router.put('/', auth, loyaltyController.updateLoyalty);

module.exports = router;
