const Loyalty = require('../models/loyalty');

// دریافت لیست وفاداری‌های کاربر
exports.getLoyaltyStores = async (req, res) => {
  try {
    const userId = req.user.id;
    const stores = await Loyalty.find({ userId });
    res.json(stores);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// بروزرسانی یا ایجاد رکورد وفاداری برای کاربر
exports.updateLoyalty = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storeId, completed, claimed } = req.body;

    const update = {};
    if (completed !== undefined) update.completed = completed;
    if (claimed !== undefined) update.claimed = claimed;

    const loyalty = await Loyalty.findOneAndUpdate(
      { userId, storeId },
      { $set: update },
      { new: true, upsert: true }
    );

    res.json(loyalty);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
