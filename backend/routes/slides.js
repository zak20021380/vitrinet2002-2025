const express = require('express');
const router = express.Router();
const slideController = require('../controllers/slideController');

// همه اسلایدهای فروشگاه
router.get('/', slideController.getSlides);
// اضافه‌کردن اسلاید
router.post('/', slideController.addSlide);
// حذف اسلاید
router.delete('/:id', slideController.deleteSlide);
// ویرایش اسلاید
router.put('/:id', slideController.editSlide);

module.exports = router;
