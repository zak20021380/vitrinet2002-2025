const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const auth = require('../middlewares/authMiddleware');

// افزودن
router.post('/', auth, favoriteController.addFavorite);
// گرفتن لیست
router.get('/', auth, favoriteController.getFavorites);
// حذف
router.delete('/', auth, favoriteController.removeFavorite);

module.exports = router;
