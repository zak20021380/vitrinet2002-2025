const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/blockedSellerController');

router.get('/', auth('user'), ctrl.getBlockedSellers);
router.post('/:sellerId', auth('user'), ctrl.blockSeller);

module.exports = router;
