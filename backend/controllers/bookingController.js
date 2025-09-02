const mongoose = require('mongoose');
const Booking = require('../models/booking');
const SellerService = require('../models/seller-services');

// ایجاد نوبت جدید توسط کاربر
exports.createBooking = async (req, res) => {
  try {
    const { serviceId, sellerId, service, customerName, customerPhone, date, time } = req.body || {};
    if (!customerName || !customerPhone || !date || !time || (!serviceId && !sellerId && !service)) {
      return res.status(400).json({ message: 'اطلاعات نوبت ناقص است.' });
    }

    let sid = sellerId;
    let serviceTitle = service;
    if (serviceId) {
      const svc = await SellerService.findById(serviceId).select('sellerId title');
      if (!svc) return res.status(404).json({ message: 'سرویس یافت نشد.' });
      sid = svc.sellerId;
      serviceTitle = svc.title;
    }

    const booking = await Booking.create({
      sellerId: sid,
      serviceId: serviceId || undefined,
      service: serviceTitle,
      customerName,
      customerPhone,
      date,
      time
    });

    return res.status(201).json({ booking });
  } catch (err) {
    console.error('createBooking error:', err);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

// دریافت نوبت‌ها برای فروشنده لاگین شده
exports.getSellerBookings = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const items = await Booking.find({ sellerId }).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (err) {
    console.error('getSellerBookings error:', err);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

// به‌روزرسانی وضعیت نوبت برای فروشنده لاگین شده
exports.updateBookingStatus = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { id } = req.params;
    const { status } = req.body || {};

    const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'وضعیت نامعتبر است.' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'شناسه نوبت نامعتبر است.' });
    }

    const booking = await Booking.findOneAndUpdate(
      { _id: id, sellerId },
      { status },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ message: 'نوبت یافت نشد.' });
    }

    return res.json({ booking });
  } catch (err) {
    console.error('updateBookingStatus error:', err);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

// بررسی آخرین وضعیت نوبت بر اساس شماره تلفن مشتری
exports.checkBookingStatus = async (req, res) => {
  try {
    const { phone } = req.query || {};
    if (!phone) {
      return res.status(400).json({ message: 'شماره تلفن الزامی است.' });
    }

    const booking = await Booking.findOne({ customerPhone: phone })
      .sort({ createdAt: -1 })
      .select('status');

    if (!booking) {
      return res.json({ status: 'none' });
    }

    return res.json({ status: booking.status });
  } catch (err) {
    console.error('checkBookingStatus error:', err);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};
