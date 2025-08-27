const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/sellerPortfolioController');

// Public routes - get portfolio by shopurl (multiple endpoint patterns)
router.get('/public/:shopurl', ctrl.getPortfolioByShopUrl);
router.get('/seller-portfolio/public/:shopurl', ctrl.getPortfolioByShopUrl);
router.get('/portfolios/public/:shopurl', ctrl.getPortfolioByShopUrl);
router.get('/portfolio/public/:shopurl', ctrl.getPortfolioByShopUrl);
router.get('/portfolio', ctrl.getPortfolioByShopUrlQuery);

// Private routes (seller only)
router.get('/me', auth('seller'), ctrl.getMyPortfolio);
router.post('/', auth('seller'), ctrl.createPortfolioItem);
router.put('/:id', auth('seller'), ctrl.updatePortfolioItem);
router.delete('/:id', auth('seller'), ctrl.deletePortfolioItem);

module.exports = router;