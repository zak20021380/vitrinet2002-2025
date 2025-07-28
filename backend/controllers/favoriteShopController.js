const FavoriteShop = require('../models/favoriteShop');

exports.addFavoriteShop = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sellerId } = req.params;
    if (!sellerId) return res.status(400).json({ message: 'شناسه فروشنده لازم است' });
    const exists = await FavoriteShop.findOne({ user: userId, shop: sellerId });
    if (exists) return res.json({ ok: true, added: true });
    await FavoriteShop.create({ user: userId, shop: sellerId });
    res.json({ ok: true, added: true });
  } catch (err) {
    res.status(500).json({ message: 'خطای سرور' });
  }
};

exports.removeFavoriteShop = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sellerId } = req.params;
    await FavoriteShop.deleteOne({ user: userId, shop: sellerId });
    res.json({ ok: true, removed: true });
  } catch (err) {
    res.status(500).json({ message: 'خطای سرور' });
  }
};

exports.getUserFavoriteShops = async (req, res) => {
  try {
    const userId = req.user.id;
    const shops = await FavoriteShop.find({ user: userId }).populate('shop');
    res.json(shops.map(f => f.shop));
  } catch (err) {
    res.status(500).json({ message: 'خطای سرور' });
  }
};

exports.getFavoriteCount = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const count = await FavoriteShop.countDocuments({ shop: sellerId });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'خطا' });
  }
};
