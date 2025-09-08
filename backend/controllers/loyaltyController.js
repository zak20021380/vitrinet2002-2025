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

// کاربر: درخواست جایزه جدید
exports.requestReward = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storeId } = req.body;
    if (!storeId) return res.status(400).json({ message: 'storeId is required' });

    const loyalty = await Loyalty.findOneAndUpdate(
      { userId, storeId },
      { $inc: { pending: 1 } },
      { new: true, upsert: true }
    );

    res.json(loyalty);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// فروشنده: دریافت درخواست‌های جایزه در انتظار
exports.getRewardRequests = async (req, res) => {
  try {
    const storeId = req.user.id;
    const requests = await Loyalty.find({ storeId, pending: { $gt: 0 } })
      .populate('userId', 'name phone');

    const mapped = requests.map(r => ({
      userId: r.userId._id,
      name: r.userId.name,
      phone: r.userId.phone,
      pending: r.pending
    }));

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// فروشنده: تایید یا رد درخواست جایزه
exports.resolveReward = async (req, res) => {
  try {
    const storeId = req.user.id;
    const { userId, action } = req.body;
    if (!userId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'invalid data' });
    }

    const update = action === 'approve'
      ? { $inc: { pending: -1, claimed: 1 } }
      : { $inc: { pending: -1 } };

    const loyalty = await Loyalty.findOneAndUpdate(
      { userId, storeId },
      update,
      { new: true }
    );

    res.json(loyalty);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// فروشنده: دریافت همه مشتریان با وضعیت وفاداری
exports.getStoreCustomers = async (req, res) => {
  try {
    const storeId = req.user.id;
    const loyalties = await Loyalty.find({ storeId }).populate('userId', 'name phone');

    const mapped = loyalties.map(l => ({
      id: l.userId._id,
      name: l.userId.name,
      phone: l.userId.phone,
      completed: l.completed || 0,
      claimed: l.claimed || 0,
      pending: l.pending || 0,
      lastReservation: l.updatedAt
    }));

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
