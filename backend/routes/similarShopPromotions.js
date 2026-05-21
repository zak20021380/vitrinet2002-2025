const express = require('express');
const formidable = require('express-formidable');
const auth = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/similarShopPromotionController');

const router = express.Router();

router.get('/plans', ctrl.getPublicPlans);
router.post('/:id/track', ctrl.trackPromotionEvent);

router.post(
  '/requests',
  auth('seller'),
  formidable({ multiples: false, maxFileSize: 5 * 1024 * 1024 }),
  ctrl.createSellerRequest
);
router.get('/seller', auth('seller'), ctrl.listSellerRequests);

router.get('/admin/plans', auth('admin'), ctrl.getAdminPlans);
router.put('/admin/plans', auth('admin'), ctrl.updateAdminPlans);
router.get('/admin', auth('admin'), ctrl.listAdminRequests);
router.patch('/admin/:id', auth('admin'), ctrl.updateAdminRequest);
router.delete('/admin/:id', auth('admin'), ctrl.hardRemoveAdminRequest);

module.exports = router;
