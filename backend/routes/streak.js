const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  checkIn,
  getStreak,
  getLeaderboard
} = require('../controllers/streakController');

/**
 * روت‌های استریک فروشنده
 * Base: /api/streak
 */

// دریافت وضعیت استریک فروشنده
// GET /api/streak
router.get('/', authMiddleware('seller'), getStreak);

// ثبت ورود روزانه (چک‌این)
// POST /api/streak/checkin
router.post('/checkin', authMiddleware('seller'), checkIn);

// دریافت لیدربورد استریک
// GET /api/streak/leaderboard
router.get('/leaderboard', authMiddleware('seller'), getLeaderboard);

module.exports = router;
