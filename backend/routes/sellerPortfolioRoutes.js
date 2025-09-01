const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/sellerPortfolioController');

const likeLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 5
});

// Public routes - get portfolio by shopurl (multiple endpoint patterns)
router.get('/public/:shopurl', ctrl.getPortfolioByShopUrl);
router.get('/seller-portfolio/public/:shopurl', ctrl.getPortfolioByShopUrl);
router.get('/portfolios/public/:shopurl', ctrl.getPortfolioByShopUrl);
router.get('/portfolio/public/:shopurl', ctrl.getPortfolioByShopUrl);
router.get('/portfolio', ctrl.getPortfolioByShopUrlQuery);

// Like/unlike portfolio item
router.post('/:id/like', auth(), likeLimiter, ctrl.toggleLike);

// Private routes (seller only)
router.get('/me', auth('seller'), ctrl.getMyPortfolio);
router.post('/', auth('seller'), ctrl.createPortfolioItem);
router.put('/:id', auth('seller'), ctrl.updatePortfolioItem);
router.delete('/:id', auth('seller'), ctrl.deletePortfolioItem);

module.exports = router;
