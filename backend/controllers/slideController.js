const Slide = require('../models/slide');

// دریافت همه اسلایدهای یک فروشگاه
exports.getSlides = async (req, res) => {
  try {
    const shopId = req.query.shop; // یا از توکن کاربر بگیر
    const slides = await Slide.find({ shop: shopId }).sort({ order: 1 });
    res.json(slides);
  } catch (err) {
    res.status(500).json({ error: 'خطا در دریافت اسلایدها' });
  }
};

// افزودن اسلاید جدید
exports.addSlide = async (req, res) => {
  try {
    const { title, desc, image, shop } = req.body;
    const count = await Slide.countDocuments({ shop });
    const slide = new Slide({ title, desc, image, shop, order: count });
    await slide.save();
    res.status(201).json(slide);
  } catch (err) {
    res.status(400).json({ error: 'خطا در افزودن اسلاید' });
  }
};

// حذف اسلاید
exports.deleteSlide = async (req, res) => {
  try {
    await Slide.findByIdAndDelete(req.params.id);
    res.json({ message: 'اسلاید حذف شد' });
  } catch (err) {
    res.status(500).json({ error: 'حذف نشد' });
  }
};

// ویرایش اسلاید
exports.editSlide = async (req, res) => {
  try {
    const { title, desc, image } = req.body;
    const slide = await Slide.findByIdAndUpdate(
      req.params.id,
      { title, desc, image },
      { new: true }
    );
    res.json(slide);
  } catch (err) {
    res.status(400).json({ error: 'ویرایش نشد' });
  }
};
