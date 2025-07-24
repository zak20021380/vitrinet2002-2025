const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/adminUserMessageController');

router.get('/', auth('admin'), ctrl.listUsers);
router.get('/:userId', auth(), ctrl.getMessages);
router.post('/send', auth(), ctrl.sendMessage);
router.patch('/:id/read', auth(), ctrl.markRead);

module.exports = router;
