// controllers/shoppingCenterController.js

const ShoppingCenter = require('../models/ShoppingCenter');
const ShopAppearance = require('../models/ShopAppearance');
const fs = require('fs');
const path = require('path');

function getTitleForRegex(title) {
  // Use the first word of the title for matching to handle partial addresses
  return title.trim().split(/\s+/)[0] || title;
}

function escapeRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

// دریافت همه مراکز خرید با محاسبه تعداد مغازه‌ها
exports.getAll = async (req, res) => {
  try {
    const centers = await ShoppingCenter.find().sort({ order: 1 });
    
    const centersWithStores = await Promise.all(centers.map(async (center) => {
      const matchTitle = getTitleForRegex(center.title);
      const escapedTitle = escapeRegex(matchTitle);
      const storesCount = await ShopAppearance.countDocuments({
        shopAddress: { $regex: escapedTitle, $options: 'i' }
      });
      return { ...center.toObject(), stores: storesCount };
    }));
    
    res.json(centersWithStores);
  } catch (err) {
    console.error('خطا در دریافت مراکز خرید:', err);
    res.status(500).json({ error: 'خطا در دریافت مراکز خرید!' });
  }
};

// دریافت یک مرکز خرید خاص با محاسبه تعداد مغازه‌ها
exports.getById = async (req, res) => {
  try {
    const center = await ShoppingCenter.findById(req.params.id);
    if (!center) {
      return res.status(404).json({ error: 'مرکز خرید یافت نشد!' });
    }
    
    const matchTitle = getTitleForRegex(center.title);
    const escapedTitle = escapeRegex(matchTitle);
    const storesCount = await ShopAppearance.countDocuments({
      shopAddress: { $regex: escapedTitle, $options: 'i' }
    });
    
    res.json({ ...center.toObject(), stores: storesCount });
  } catch (err) {
    console.error('خطا در دریافت مرکز خرید:', err);
    res.status(500).json({ error: 'خطا در دریافت مرکز خرید!' });
  }
};

// ایجاد مرکز خرید جدید
exports.create = async (req, res) => {
  try {
    const { title, description, tag, location, order, hours, holidays } = req.body;
    const image = req.file ? `/uploads/shopping-centers/${req.file.filename}` : '';  // ذخیره مسیر عکس
    
    const center = new ShoppingCenter({
      title,
      description,
      image,
      tag,
      location,
      order: order || 0,
      hours,
      holidays
    });
    
    await center.save();
    res.json(center);
  } catch (err) {
    console.error('خطا در ایجاد مرکز خرید:', err);
    res.status(500).json({ error: 'خطا در ایجاد مرکز خرید!' });
  }
};

// ویرایش مرکز خرید
exports.update = async (req, res) => {
  try {
    const { title, description, tag, location, order, hours, holidays } = req.body;
    const center = await ShoppingCenter.findById(req.params.id);
    if (!center) {
      return res.status(404).json({ error: 'مرکز خرید یافت نشد!' });
    }
    
    // اگر عکس جدید آپلود شده، عکس قدیمی را حذف کن و جدید را ذخیره کن
    let image = center.image;
    if (req.file) {
      if (center.image && fs.existsSync(path.join(__dirname, '..', center.image))) {
        fs.unlinkSync(path.join(__dirname, '..', center.image));  // حذف عکس قدیمی
      }
      image = `/uploads/shopping-centers/${req.file.filename}`;
    }
    
    center.title = title || center.title;
    center.description = description || center.description;
    center.image = image;
    center.tag = tag || center.tag;
    center.location = location || center.location;
    center.order = order || center.order;
    center.hours = hours || center.hours;
    center.holidays = holidays || center.holidays;
    
    await center.save();
    res.json(center);
  } catch (err) {
    console.error('خطا در ویرایش مرکز خرید:', err);
    res.status(500).json({ error: 'خطا در ویرایش مرکز خرید!' });
  }
};

// حذف مرکز خرید
exports.remove = async (req, res) => {
  try {
    const center = await ShoppingCenter.findById(req.params.id);
    if (!center) {
      return res.status(404).json({ error: 'مرکز خرید یافت نشد!' });
    }
    
    // حذف عکس اگر وجود داشته باشد
    if (center.image && fs.existsSync(path.join(__dirname, '..', center.image))) {
      fs.unlinkSync(path.join(__dirname, '..', center.image));
    }
    
    await ShoppingCenter.deleteOne({ _id: req.params.id });
    res.json({ message: 'مرکز خرید با موفقیت حذف شد.' });
  } catch (err) {
    console.error('خطا در حذف مرکز خرید:', err);
    res.status(500).json({ error: 'خطا در حذف مرکز خرید!' });
  }
};