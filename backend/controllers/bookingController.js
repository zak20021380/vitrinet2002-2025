const mongoose = require('mongoose');
const Booking = require('../models/booking');
const SellerService = require('../models/seller-services');
const Seller = require('../models/Seller');
const User = require('../models/user');
const { createNotification } = require('./notificationController');

// Convert Persian/Arabic digits in a string to English digits
function normalizeDigits(str = '') {
  return str
    .toString()
    .replace(/[\u06F0-\u06F9]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[\u0660-\u0669]/g, d => String.fromCharCode(d.charCodeAt(0) - 1632));
}

// Build a regex matching digits in any of the three numeral sets
function digitInsensitiveRegex(phone = '') {
  const en = normalizeDigits(phone);
  const pattern = en.replace(/\d/g, d => `[${d}${String.fromCharCode(0x06F0 + +d)}${String.fromCharCode(0x0660 + +d)}]`);
  return new RegExp(`^${pattern}$`);
}

// ایجاد نوبت جدید توسط کاربر
exports.createBooking = async (req, res) => {
  try {
    const {
      serviceId,
      sellerId,
      service,
      customerName,
      customerPhone: rawPhone,
      date,
      time
    } = req.body || {};
    const customerPhone = normalizeDigits(rawPhone || '');

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
      customerPhone: { $regex: digitInsensitiveRegex(customerPhone) },
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

    // Blocked user check
    try {
      const sellerDoc = await Seller.findById(sid).select('blockedUsers');
      if (sellerDoc) {
        const blocked = (sellerDoc.blockedUsers || [])
          .map(u => normalizeDigits(u.toString()));
        const uid = req.user && req.user.id;
        if (uid && blocked.includes(uid.toString())) {
          return res.status(403).json({ message: 'شما توسط این فروشنده مسدود شده‌اید.' });
        }
        if (customerPhone && blocked.includes(customerPhone)) {
          return res.status(403).json({ message: 'شما توسط این فروشنده مسدود شده‌اید.' });
        }
      }
    } catch (err) {
      console.error('blocked user check error:', err);
      return res.status(500).json({ message: 'خطا در بررسی وضعیت مسدودیت.' });
    }

    // Prevent booking creation if slot already taken
    const slotTaken = await Booking.exists({
      bookingDate: date,
      startTime: time,
      sellerId: sid
    });
    if (slotTaken) {
      return res.status(409).json({ message: 'این بازه زمانی قبلاً رزرو شده است.' });
    }

    let booking;
    try {
      booking = await Booking.create({
        sellerId: sid,
        serviceId: serviceId || undefined,
        service: serviceTitle,
        customerName,
        customerPhone,
        bookingDate: date,
        startTime: time
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

    const booking = await Booking.findOne({ _id: id, sellerId });

    if (!booking) {
      return res.status(404).json({ message: 'نوبت یافت نشد.' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ message: 'نوبت انجام شده قابل تغییر نیست.' });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'نوبت لغو شده قابل تغییر نیست.' });
    }

    booking.status = status;
    await booking.save();

    if (status === 'confirmed') {
      try {
        const user = await User.findOne({ phone: { $regex: digitInsensitiveRegex(booking.customerPhone) } }).select('_id');
        if (user) {
          await createNotification(user._id, `نوبت شما برای ${booking.service} در تاریخ ${booking.bookingDate} ساعت ${booking.startTime} تایید شد.`);
        }
      } catch (err) {
        console.error('notify user confirmation error:', err);
      }
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

// حذف نوبت توسط کاربر (بدون نیاز به لاگین فروشنده)
exports.deleteBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'شناسه نوبت نامعتبر است.' });
    }

    const booking = await Booking.findByIdAndDelete(id);
    if (!booking) {
      return res.status(404).json({ message: 'نوبت یافت نشد.' });
    }

    return res.json({ message: 'نوبت حذف شد.' });
  } catch (err) {
    console.error('deleteBookingById error:', err);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

// لغو نوبت توسط کاربر
exports.cancelBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'شناسه نوبت نامعتبر است.' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'نوبت یافت نشد.' });
    }

    booking.status = 'cancelled';
    await booking.save();

    return res.json({ booking });
  } catch (err) {
    console.error('cancelBookingById error:', err);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

// دریافت نوبت‌ها بر اساس شماره تلفن مشتری
exports.getCustomerBookings = async (req, res) => {
  try {
    const { phone: rawPhone } = req.query || {};
    if (!rawPhone) {
      return res.status(400).json({ message: 'شماره تلفن الزامی است.' });
    }

    const phone = normalizeDigits(rawPhone);
    const regex = digitInsensitiveRegex(phone);

    const items = await Booking.find({ customerPhone: { $regex: regex } })
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
    const { phone: rawPhone } = req.query || {};
    if (!rawPhone) {
      return res.status(400).json({ message: 'شماره تلفن الزامی است.' });
    }

    const phone = normalizeDigits(rawPhone);
    const regex = digitInsensitiveRegex(phone);

    // اگر نوبت معلقی وجود داشته باشد، همان را برگردانیم
    const pending = await Booking.findOne({ customerPhone: { $regex: regex }, status: 'pending' })
      .sort({ createdAt: -1 })
      .select('status');
    if (pending) {
      return res.json({ status: 'pending' });
    }

    const last = await Booking.findOne({ customerPhone: { $regex: regex } })
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

    const sellerDoc = await Seller.findById(sellerId).select('blockedUsers');
    if (sellerDoc) {
      const blocked = (sellerDoc.blockedUsers || []).map(u => u.toString());
      const uid = req.user && req.user.id;
      if (uid && blocked.includes(uid.toString())) {
        return res.status(403).json({ message: 'شما توسط این فروشنده مسدود شده‌اید.' });
      }
    }

    const items = await Booking.find({
      sellerId,
      bookingDate: date,
      status: { $in: ['pending', 'confirmed'] }
    })
      .select('startTime')
      .lean();

    const times = items.map(b => b.startTime);
    return res.json({ times });
  } catch (err) {
    console.error('getBookedSlots error:', err);
    return res.status(500).json({ message: 'خطا در دریافت نوبت‌های رزرو شده' });
  }
};
