// controllers/productController.js

const Product = require('../models/product');
// تبدیل مسیر نسبى → آدرس کامل (نسبى، http/https یا data:)
function makeFullUrl(req, path = '') {
  if (!path) return '';
  if (/^(https?:|data:)/i.test(path)) return path;            // لینک کامل یا data:
  return `${req.protocol}://${req.headers.host}/${path.replace(/^\/+/, '')}`;
}

// افزودن محصول جدید
exports.addProduct = async (req, res) => {
  try {
    const { sellerId, title, price, category, tags, desc, images, mainImageIndex } = req.body;

    // چک فیلدهای الزامی
    if (!sellerId || !title || !price || !category) {
      return res.status(400).json({ message: 'لطفاً تمام فیلدهای الزامی را وارد کنید.' });
    }

    // آرایه‌سازی مطمئن
    const _tags = Array.isArray(tags) ? tags : tags ? tags.split(',') : [];
    const _images = Array.isArray(images) ? images : images ? images.split(',') : [];

    const product = new Product({
      sellerId,
      title,
      price,
      category,
      tags: _tags,
      desc,
      images: _images,
      mainImageIndex: typeof mainImageIndex === "number" ? mainImageIndex : 0
    });

    await product.save();
    res.status(201).json({ message: 'محصول با موفقیت اضافه شد', product });
  } catch (err) {
    console.error('خطا در افزودن محصول:', err);
    res.status(500).json({ message: 'خطا در افزودن محصول', error: err.message });
  }
};

// دریافت محصولات (به ‌همراه دسته‌بندی فروشنده)
// دریافت محصولات (به ‌همراه اطلاعات کامل فروشنده)
exports.getProducts = async (req, res) => {
  try {
    const filter = req.query.sellerId ? { sellerId: req.query.sellerId } : {};

    const raw = await Product.find(filter)
      .sort({ createdAt: -1 })
      .populate({
        path: 'sellerId',
        select: 'storename ownerName address shopurl ownerFirstname ownerLastname category city'
      })
      .lean();

    const products = raw.map(p => {
      const idx      = Number.isInteger(p.mainImageIndex) ? p.mainImageIndex : 0;
      const mainImg  = (p.images?.length ? (p.images[idx] || p.images[0]) : '');
      return {
        ...p,
        image: makeFullUrl(req, mainImg),               // ✅ عکس شاخص
        shopName: p.sellerId?.storename || '',          // ✅ نام فروشگاه
        seller: p.sellerId || {},                       // ⚙️ همان خروجی قبلی
        sellerCategory: p.sellerId?.category || '',
        sellerId: p.sellerId?._id?.toString() || p.sellerId
      };
    });

    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'خطا در دریافت محصولات', error: err.message });
  }
};


// ویرایش محصول (اصلاح شده برای پشتیبانی از mainImageIndex)
exports.editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const {
      title,
      price,
      category,
      tags,
      desc,
      images,
      mainImageIndex
    } = req.body;

    // مطمئن شو آرایه‌ها درست هستن
    const _tags = Array.isArray(tags) ? tags : tags ? tags.split(',') : [];
    const _images = Array.isArray(images) ? images : images ? images.split(',') : [];

    const update = {
      ...(title !== undefined && { title }),
      ...(price !== undefined && { price }),
      ...(category !== undefined && { category }),
      ...(desc !== undefined && { desc }),
      ...(tags !== undefined && { tags: _tags }),
      ...(images !== undefined && { images: _images }),
      ...(mainImageIndex !== undefined && { mainImageIndex })
    };

    const updatedProduct = await Product.findByIdAndUpdate(id, update, { new: true });
    if (!updatedProduct) return res.status(404).json({ message: 'محصول پیدا نشد!' });
    res.json({ message: 'محصول ویرایش شد', product: updatedProduct });
  } catch (err) {
    res.status(500).json({ message: 'خطا در ویرایش محصول', error: err.message });
  }
};

// حذف محصول
exports.deleteProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'محصول پیدا نشد!' });
    res.json({ message: 'محصول حذف شد' });
  } catch (err) {
    res.status(500).json({ message: 'خطا در حذف محصول', error: err.message });
  }
};


// گرفتن محصول تکی با آیدی
// گرفتن محصول تکی با آیدی و دادن مشخصات فروشنده
// گرفتن محصول تکی با آیدی و دادن مشخصات فروشنده
exports.getProductById = async (req, res) => {
  try {
    const id = req.params.id;
    // پیدا کردن محصول و گرفتن اطلاعات seller (گسترش‌یافته)
    const product = await Product.findById(id)
      .populate({
        path: 'sellerId',
        select: 'storename ownerName address shopurl ownerFirstname ownerLastname phone logo category city'
      })
      .lean();

    if (!product) return res.status(404).json({ message: 'محصول پیدا نشد!' });

    // اضافه کردن اطلاعات seller به خروجی
    product.seller = product.sellerId || {};

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'خطا در دریافت محصول', error: err.message });
  }
};



// گرفتن جدیدترین محصولات
// گرفتن جدیدترین محصولات
// گرفتن جدیدترین محصولات
// controllers/productController.js  ⬅️ فقط این تابع را جایگزین کن
// گرفتن جدیدترین محصولات
exports.getLatestProducts = async (req, res) => {
  try {
    const raw = await Product.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate({
        path: 'sellerId',
        select: 'storename ownerName address shopurl ownerFirstname ownerLastname category city'
      })
      .lean();

    const products = raw.map(p => {
      const idx      = Number.isInteger(p.mainImageIndex) ? p.mainImageIndex : 0;
      const mainImg  = (p.images?.length ? (p.images[idx] || p.images[0]) : '');
      return {
        ...p,
        image: makeFullUrl(req, mainImg),               // ✅ عکس شاخص
        shopName: p.sellerId?.storename || '',          // ✅ نام فروشگاه
        seller: p.sellerId || {},                       // ⚙️ همان خروجی قبلی
        sellerCategory: p.sellerId?.category || '',
        sellerLocation: p.sellerId?.address || p.sellerId?.city || '—',
        sellerId: p.sellerId?._id?.toString() || p.sellerId
      };
    });

    if (!products.length)
      return res.status(404).json({ success: false, message: 'محصولی یافت نشد' });

    res.json({ success: true, products });
  } catch (err) {
    console.error('Error fetching latest products:', err);
    res.status(500).json({ success: false, message: 'خطا در دریافت جدیدترین محصولات', error: err.message });
  }
};




