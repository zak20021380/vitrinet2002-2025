const express = require('express');
const router = express.Router();
const { getMyRank, getCategoryLeaderboard } = require('../controllers/rankController');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * @route   GET /api/rank/my
 * @desc    دریافت رتبه فروشنده فعلی با محاسبه معیارها
 * @access  Private (Seller)
 */
router.get('/my', authMiddleware('seller'), getMyRank);

/**
 * @route   GET /api/rank/leaderboard
 * @desc    دریافت لیدربورد دسته‌بندی فروشنده
 * @access  Private (Seller)
 */
router.get('/leaderboard', authMiddleware('seller'), getCategoryLeaderboard);

module.exports = router;
