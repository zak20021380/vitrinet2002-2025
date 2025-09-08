const express = require('express');
const router = express.Router();
const loyaltyController = require('../controllers/loyaltyController');
const auth = require('../middlewares/authMiddleware');

router.get('/', auth('user'), loyaltyController.getLoyaltyStores);
router.put('/', auth('user'), loyaltyController.updateLoyalty);
router.post('/request', auth('user'), loyaltyController.requestReward);
router.get('/requests', auth('seller'), loyaltyController.getRewardRequests);
router.post('/requests/resolve', auth('seller'), loyaltyController.resolveReward);

module.exports = router;
