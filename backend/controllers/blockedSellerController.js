const BlockedSeller = require('../models/BlockedSeller');

exports.getBlockedSellers = async (req, res) => {
  try {
    const userId = req.user.id;
    const docs = await BlockedSeller.find({ user: userId }).select('seller');
    res.json(docs.map(d => d.seller.toString()));
  } catch (err) {
    res.status(500).json({ error: 'خطا در دریافت لیست مسدودسازی' });
  }
};

exports.blockSeller = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sellerId } = req.params;
    if (!sellerId) return res.status(400).json({ error: 'شناسه فروشنده ارسال نشده است' });
    const exists = await BlockedSeller.findOne({ user: userId, seller: sellerId });
    if (exists) return res.json({ success: true, blocked: true });
    await BlockedSeller.create({ user: userId, seller: sellerId });
    res.json({ success: true, blocked: true });
  } catch (err) {
    res.status(500).json({ error: 'خطا در مسدودسازی فروشنده' });
  }
};
