const express = require('express');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

router.get('/', categoryController.getCategoryCollections);
router.post('/', categoryController.createCategory);
router.delete('/', categoryController.deleteCategory);

module.exports = router;
