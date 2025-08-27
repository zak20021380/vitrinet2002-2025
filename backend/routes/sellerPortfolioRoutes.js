const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/sellerPortfolioController');

// Public route - get portfolio by shopurl
router.get('/public/:shopurl', ctrl.getPortfolioByShopUrl);

// Private routes (seller only)
router.get('/me', auth('seller'), ctrl.getMyPortfolio);
router.post('/', auth('seller'), ctrl.createPortfolioItem);
router.put('/:id', auth('seller'), ctrl.updatePortfolioItem);
router.delete('/:id', auth('seller'), ctrl.deletePortfolioItem);

module.exports = router;