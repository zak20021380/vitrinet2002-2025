const express = require('express');
const router = express.Router({ mergeParams: true });

const ctrl = require('../controllers/serviceShopCustomerController');

router.get('/:sellerId/customers', ctrl.getCustomerStats);
router.post('/:sellerId/customers', ctrl.followShop);

module.exports = router;
