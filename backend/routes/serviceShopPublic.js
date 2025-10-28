const express = require('express');
const router = express.Router({ mergeParams: true });

const customerCtrl = require('../controllers/serviceShopCustomerController');
const serviceShopCtrl = require('../controllers/serviceShopController');

router.get('/status/by-shopurl/:shopUrl', serviceShopCtrl.getPublicModerationStatusBySlug);
router.get('/status/by-seller/:sellerId', serviceShopCtrl.getPublicModerationStatusBySeller);
router.get('/:sellerId/bookings/summary', serviceShopCtrl.getPublicBookingSummary);

router.get('/:sellerId/customers', customerCtrl.getCustomerStats);
router.post('/:sellerId/customers', customerCtrl.followShop);

module.exports = router;
