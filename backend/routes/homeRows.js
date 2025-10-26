const express = require('express');
const router = express.Router();

const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/homeRowsController');

router.get('/', controller.listRows);
router.post('/', auth('admin'), controller.createRow);
router.put('/:id', auth('admin'), controller.updateRow);
router.delete('/:id', auth('admin'), controller.deleteRow);
router.patch('/reorder', auth('admin'), controller.reorderRows);

module.exports = router;
