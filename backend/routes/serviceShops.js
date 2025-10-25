const express = require('express');
const router = express.Router();

const auth = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/serviceShopController');

router.get('/overview', auth('admin'), ctrl.getOverview);
router.get('/my/complimentary-plan', auth('seller'), ctrl.getMyComplimentaryPlan);
router.get('/', auth('admin'), ctrl.listServiceShops);
router.post('/', auth('admin'), ctrl.createServiceShop);
router.get('/:id', auth('admin'), ctrl.getServiceShop);
router.put('/:id', auth('admin'), ctrl.updateServiceShop);
router.patch('/:id/status', auth('admin'), ctrl.updateServiceShopStatus);
router.patch('/:id/block', auth('admin'), ctrl.blockServiceShop);
router.patch('/:id/unblock', auth('admin'), ctrl.unblockServiceShop);
router.delete('/:id', auth('admin'), ctrl.removeServiceShop);

module.exports = router;
