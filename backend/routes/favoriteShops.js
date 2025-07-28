const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/favoriteShopController');

router.post('/:sellerId', auth('user'), ctrl.addFavoriteShop);
router.delete('/:sellerId', auth('user'), ctrl.removeFavoriteShop);
router.get('/', auth('user'), ctrl.getUserFavoriteShops);
router.get('/count/:sellerId', ctrl.getFavoriteCount);

module.exports = router;
