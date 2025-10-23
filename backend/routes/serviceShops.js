const express = require('express');
const router = express.Router();

const auth = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/serviceShopController');
const {
  searchRateLimiter,
  autocompleteRateLimiter,
  createAutocompleteDebounce
} = require('../middlewares/searchRateLimiters');

const serviceShopDebounce = createAutocompleteDebounce();

router.get('/overview', auth('admin'), ctrl.getOverview);
router.get(
  '/',
  auth('admin'),
  searchRateLimiter,
  autocompleteRateLimiter,
  serviceShopDebounce,
  ctrl.listServiceShops
);
router.post('/', auth('admin'), ctrl.createServiceShop);
router.get('/:id', auth('admin'), ctrl.getServiceShop);
router.put('/:id', auth('admin'), ctrl.updateServiceShop);
router.patch('/:id/status', auth('admin'), ctrl.updateServiceShopStatus);
router.delete('/:id', auth('admin'), ctrl.removeServiceShop);

module.exports = router;
