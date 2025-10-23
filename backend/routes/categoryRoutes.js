const express = require('express');
const {
  getCategoryLists,
  createCategory,
  deleteCategory
} = require('../controllers/categoryController');

const router = express.Router();

router.get('/', getCategoryLists);
router.post('/', createCategory);
router.delete('/:id', deleteCategory);

module.exports = router;
