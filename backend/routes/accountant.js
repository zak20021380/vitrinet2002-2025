const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { createEntry, listEntries } = require('../controllers/accountantController');

router.use(authMiddleware('seller'));

router.get('/', listEntries);
router.post('/', createEntry);

module.exports = router;
