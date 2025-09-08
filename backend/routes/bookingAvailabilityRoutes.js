const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/bookingAvailabilityController');

// Seller-owned endpoints
router.get('/booking-slots/me', auth('seller'), ctrl.getMyAvailability);
router.put('/booking-slots/me', auth('seller'), ctrl.updateMyAvailability);

// Public endpoint to get slots for a seller
router.get('/booking-slots/:sellerId', ctrl.getSellerAvailability);

module.exports = router;
