const BookingAvailability = require('../models/booking-availability');

// Get availability for authenticated seller
exports.getMyAvailability = async (req, res) => {
  try {
    const doc = await BookingAvailability.findOne({ sellerId: req.user.id });
    res.json(doc?.slots || {});
  } catch (err) {
    console.error('getMyAvailability failed', err);
    res.status(500).json({ message: 'خطا در دریافت برنامه نوبت‌دهی' });
  }
};

// Update availability for authenticated seller
exports.updateMyAvailability = async (req, res) => {
  try {
    const slots = req.body || {};
    const doc = await BookingAvailability.findOneAndUpdate(
      { sellerId: req.user.id },
      { slots },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(doc.slots);
  } catch (err) {
    console.error('updateMyAvailability failed', err);
    res.status(500).json({ message: 'خطا در ذخیره برنامه نوبت‌دهی' });
  }
};

// Public: get availability for given sellerId
exports.getSellerAvailability = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const doc = await BookingAvailability.findOne({ sellerId });
    res.json(doc?.slots || {});
  } catch (err) {
    console.error('getSellerAvailability failed', err);
    res.status(500).json({ message: 'خطا در دریافت برنامه نوبت‌دهی' });
  }
};
