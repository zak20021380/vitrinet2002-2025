const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  getWallet,
  getTransactions,
  earnCredit,
  spendCredit,
  adminAddCredit,
  adminDeductCredit
} = require('../controllers/walletController');

/**
 * روت‌های کیف پول فروشنده
 * Base: /api/wallet
 */

// دریافت اطلاعات کیف پول
// GET /api/wallet
router.get('/', authMiddleware('seller'), getWallet);

// دریافت تاریخچه تراکنش‌ها
// GET /api/wallet/transactions
router.get('/transactions', authMiddleware('seller'), getTransactions);

// کسب اعتبار (پاداش فعالیت)
// POST /api/wallet/earn
router.post('/earn', authMiddleware('seller'), earnCredit);

// خرج اعتبار (خرید خدمات)
// POST /api/wallet/spend
router.post('/spend', authMiddleware('seller'), spendCredit);

// ===== روت‌های ادمین =====

// افزودن اعتبار توسط ادمین
// POST /api/wallet/admin/add
router.post('/admin/add', authMiddleware('admin'), adminAddCredit);

// کسر اعتبار توسط ادمین
// POST /api/wallet/admin/deduct
router.post('/admin/deduct', authMiddleware('admin'), adminDeductCredit);

module.exports = router;
