const mongoose = require('mongoose');
const Booking = require('../models/booking');
const SellerService = require('../models/seller-services');

// ایجاد نوبت جدید توسط کاربر
exports.createBooking = async (req, res) => {
  try {
    const {
      serviceId,
      sellerId,
      service,
      customerName,
      customerPhone,
      date,
      time
    } = req.body || {};

    // log incoming payload for debugging
    console.log('createBooking payload:', {
      serviceId,
      sellerId,
      service,
      customerName,
      customerPhone,
      date,
      time
    });

    // require serviceId or (sellerId and service)
    if (
      !customerName ||
      !customerPhone ||
      !date ||
      !time ||
      (!serviceId && (!sellerId || !service))
    ) {
      return res.status(400).json({ message: 'اطلاعات نوبت ناقص است.' });
    }

    // validate object ids to avoid CastErrors
    if (serviceId && !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ message: 'شناسه سرویس نامعتبر است.' });
    }
    if (sellerId && !mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ message: 'شناسه فروشنده نامعتبر است.' });
    }

    // جلوگیری از ثبت نوبت جدید در صورت وجود نوبت در انتظار تایید
    const pendingExists = await Booking.exists({
      customerPhone,
      status: 'pending'
    });
    if (pendingExists) {
      return res.status(409).json({ message: 'نوبت قبلی شما هنوز توسط فروشنده تایید یا رد نشده است.' });
    }

    let sid = sellerId;
    let serviceTitle = service;
    if (serviceId) {
      try {
        const svc = await SellerService.findById(serviceId).select('sellerId title');
        if (!svc) {
          return res.status(404).json({ message: 'سرویس یافت نشد.' });
        }
        sid = svc.sellerId;
        serviceTitle = svc.title;
      } catch (err) {
        console.error('SellerService.findById error:', { serviceId, err });
        return res.status(500).json({ message: 'خطا در دریافت اطلاعات سرویس.' });
      }
    }

    if (!mongoose.Types.ObjectId.isValid(sid)) {
      return res.status(400).json({ message: 'شناسه فروشنده نامعتبر است.' });
    }

    let booking;
    try {
      booking = await Booking.create({
        sellerId: sid,
        serviceId: serviceId || undefined,
        service: serviceTitle,
        customerName,
        customerPhone,
        date,
        time
      });
    } catch (err) {
      console.error('Booking.create error:', {
        sellerId: sid,
        serviceId,
        service: serviceTitle,
        err
      });
      if (err.name === 'ValidationError') {
        return res.status(400).json({ message: 'اطلاعات نوبت نامعتبر است.' });
      }
      // handle duplicate bookings gracefully
      if (err.code === 11000) {
        return res
          .status(409)
          .json({ message: 'این بازه زمانی قبلاً رزرو شده است.' });
      }
      return res.status(500).json({ message: 'خطا در ایجاد نوبت.' });
    }

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

// حذف نوبت برای فروشنده لاگین شده
exports.deleteBooking = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'شناسه نوبت نامعتبر است.' });
    }

    const booking = await Booking.findOneAndDelete({ _id: id, sellerId });
    if (!booking) {
      return res.status(404).json({ message: 'نوبت یافت نشد.' });
    }

    return res.json({ message: 'نوبت حذف شد.' });
  } catch (err) {
    console.error('deleteBooking error:', err);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

// دریافت نوبت‌ها بر اساس شماره تلفن مشتری
exports.getCustomerBookings = async (req, res) => {
  try {
    const { phone } = req.query || {};
    if (!phone) {
      return res.status(400).json({ message: 'شماره تلفن الزامی است.' });
    }

    const items = await Booking.find({ customerPhone: phone })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ items });
  } catch (err) {
    console.error('getCustomerBookings error:', err);
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

    // اگر نوبت معلقی وجود داشته باشد، همان را برگردانیم
    const pending = await Booking.findOne({ customerPhone: phone, status: 'pending' })
      .sort({ createdAt: -1 })
      .select('status');
    if (pending) {
      return res.json({ status: 'pending' });
    }

    const last = await Booking.findOne({ customerPhone: phone })
      .sort({ createdAt: -1 })
      .select('status');

    if (!last) {
      return res.json({ status: 'none' });
    }

    return res.json({ status: last.status });
  } catch (err) {
    console.error('checkBookingStatus error:', err);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

// دریافت زمان‌های رزرو شده برای یک فروشنده در تاریخ مشخص
exports.getBookedSlots = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { date } = req.query || {};
    if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ message: 'شناسه فروشنده نامعتبر است.' });
    }
    if (!date) {
      return res.status(400).json({ message: 'تاریخ الزامی است.' });
    }

    const items = await Booking.find({
      sellerId,
      date,
      status: { $in: ['pending', 'confirmed'] }
    })
      .select('time')
      .lean();

    const times = items.map(b => b.time);
    return res.json({ times });
  } catch (err) {
    console.error('getBookedSlots error:', err);
    return res.status(500).json({ message: 'خطا در دریافت نوبت‌های رزرو شده' });
  }
};
