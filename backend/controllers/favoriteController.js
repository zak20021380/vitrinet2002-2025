const Favorite = require('../models/favorite');

// افزودن محصول به علاقه‌مندی
exports.addFavorite = async (req, res) => {
  try {
    const userId = req.user.id; // از میدل‌ویر authMiddleware
    const { productId } = req.body;

    // چک نکنه قبلاً اضافه شده
    const already = await Favorite.findOne({ user: userId, product: productId });
    if (already) return res.status(200).json({ ok: true, message: "Already in favorites" });

    await Favorite.create({ user: userId, product: productId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Server error" });
  }
};

// لیست علاقه‌مندی‌ها (همراه اطلاعات محصول)
// لیست علاقه‌مندی‌ها (همراه اطلاعات کامل محصول و فروشگاه)
// فایل favoriteController.js
exports.getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const favs = await Favorite.find({ user: userId })
      .populate({
        path: 'product',
        populate: {
          path: 'sellerId',
          select: 'storename',
          model: 'Seller'
        }
      });

    console.log(favs);  // بررسی داده‌ها در کنسول

    res.json(favs);
  } catch (err) {
    res.status(500).json({ ok: false, message: "Server error" });
  }
};


// حذف از علاقه‌مندی
exports.removeFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;
    await Favorite.deleteOne({ user: userId, product: productId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Server error" });
  }
};
