const express = require('express');
const formidable = require('express-formidable');
const authMiddleware = require('../middlewares/authMiddleware');
const adOrderController = require('../controllers/adOrderController');

const router = express.Router();

router.post(
  '/mock-payment-request',
  authMiddleware('seller'),
  formidable({ multiples: false }),
  adOrderController.createMockPaymentAdOrder
);

module.exports = router;
