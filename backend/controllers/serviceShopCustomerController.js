const mongoose = require('mongoose');
const ServiceShopCustomer = require('../models/serviceShopCustomer');
const ServiceShop = require('../models/serviceShop');
const Booking = require('../models/booking');
const Seller = require('../models/Seller');

const DIGITS_EN = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const toEnglishDigits = (value = '') => String(value || '')
  .replace(/[۰-۹]/g, d => DIGITS_EN[d.charCodeAt(0) - 1776] || d)
  .replace(/[٠-٩]/g, d => DIGITS_EN[d.charCodeAt(0) - 1632] || d);

const normalisePhone = (value = '') => {
  let raw = toEnglishDigits(value).replace(/[\s\-()]/g, '');
  if (!raw) return '';

  if (raw.startsWith('+')) {
    raw = raw.slice(1);
  }

  raw = raw.replace(/[^0-9]/g, '');

  if (!raw) return '';

  if (raw.startsWith('0098')) {
    raw = raw.slice(4);
  }

  if (raw.startsWith('98') && raw.length === 12) {
    raw = raw.slice(2);
  }

  if (raw.length === 10 && raw.startsWith('9')) {
    raw = `0${raw}`;
  }

  if (raw.length === 11 && !raw.startsWith('0')) {
    raw = `0${raw.slice(-10)}`;
  }

  return raw;
};

const digitInsensitiveRegex = (phone = '') => {
  const en = normalisePhone(phone);
  if (!en) return null;
  const pattern = en.replace(/\d/g, d => {
    const digit = Number(d);
    if (Number.isNaN(digit)) return d;
    const persian = String.fromCharCode(0x06F0 + digit);
    const arabic = String.fromCharCode(0x0660 + digit);
    return `[${d}${persian}${arabic}]`;
  });
  return new RegExp(`^${pattern}$`);
};

const findServiceShopIdForSeller = async (seller) => {
  if (!seller) return null;
  const clauses = [];
  if (seller._id) clauses.push({ legacySellerId: seller._id });
  if (seller.phone) clauses.push({ ownerPhone: seller.phone });
  if (!clauses.length) return null;

  try {
    const shop = await ServiceShop.findOne({ $or: clauses }).select('_id').lean();
    return shop?._id || null;
  } catch (err) {
    console.warn('findServiceShopIdForSeller failed:', err.message);
    return null;
  }
};

const updateServiceShopFollowers = async (sellerId, total, sellerDoc = null) => {
  if (!mongoose.Types.ObjectId.isValid(sellerId)) return;
  const match = { $or: [] };

  match.$or.push({ legacySellerId: sellerId });

  let seller = sellerDoc;
  try {
    if (!seller) {
      seller = await Seller.findById(sellerId).select('phone');
    }
    if (seller?.phone) {
      match.$or.push({ ownerPhone: seller.phone });
    }
  } catch (err) {
    console.warn('updateServiceShopFollowers seller lookup failed:', err.message);
  }

  if (!match.$or.length) return;

  try {
    await ServiceShop.updateMany(match, {
      $set: { 'analytics.customerFollowers': total }
    });
  } catch (err) {
    console.warn('updateServiceShopFollowers update failed:', err.message);
  }
};

exports.getCustomerStats = async (req, res) => {
  try {
    const { sellerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ message: 'شناسه فروشنده نامعتبر است.' });
    }

    const phone = normalisePhone(req.query.phone || '');

    const [totalCustomers, existingFollower] = await Promise.all([
      ServiceShopCustomer.countDocuments({ sellerId }),
      phone
        ? ServiceShopCustomer.findOne({ sellerId, customerPhone: phone }).lean()
        : Promise.resolve(null)
    ]);

    let hasBooking = false;
    if (phone) {
      const bookingFilter = {
        sellerId,
        customerPhone: { $regex: digitInsensitiveRegex(phone) }
      };
      const booking = await Booking.exists(bookingFilter);
      hasBooking = !!booking;
    } else if (existingFollower) {
      hasBooking = true;
    }

    return res.json({
      totalCustomers,
      isFollower: !!existingFollower,
      hasBooking
    });
  } catch (err) {
    console.error('getCustomerStats error:', err);
    return res.status(500).json({ message: 'خطا در دریافت اطلاعات مشتریان.' });
  }
};

exports.followShop = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { customerPhone: rawPhone, phone: fallbackPhone, customerName: rawName } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ message: 'شناسه فروشنده نامعتبر است.' });
    }

    const phone = normalisePhone(rawPhone || fallbackPhone || '');
    if (!phone || phone.length < 8) {
      return res.status(400).json({ message: 'شماره تماس مشتری نامعتبر است.' });
    }

    const seller = await Seller.findById(sellerId).select('_id phone');
    if (!seller) {
      return res.status(404).json({ message: 'مغازه موردنظر یافت نشد.' });
    }

    const existing = await ServiceShopCustomer.findOne({ sellerId, customerPhone: phone }).lean();
    if (existing) {
      const totalCustomers = await ServiceShopCustomer.countDocuments({ sellerId });
      return res.json({
        totalCustomers,
        isFollower: true,
        hasBooking: true
      });
    }

    const booking = await Booking.findOne({
      sellerId,
      customerPhone: { $regex: digitInsensitiveRegex(phone) },
      status: { $ne: 'cancelled' }
    }).sort({ createdAt: -1 }).lean();

    if (!booking) {
      return res.status(403).json({ message: 'برای دنبال کردن، ابتدا باید یک نوبت رزرو کنید.' });
    }

    const customerName = String(rawName || booking.customerName || '').trim();

    try {
      const serviceShopId = await findServiceShopIdForSeller(seller);

      await ServiceShopCustomer.create({
        sellerId,
        serviceShopId,
        customerPhone: phone,
        customerName,
        bookingId: booking._id
      });
    } catch (err) {
      if (err.code === 11000) {
        const totalCustomers = await ServiceShopCustomer.countDocuments({ sellerId });
        return res.json({ totalCustomers, isFollower: true, hasBooking: true });
      }
      throw err;
    }

    const totalCustomers = await ServiceShopCustomer.countDocuments({ sellerId });
    await updateServiceShopFollowers(sellerId, totalCustomers, seller);

    return res.status(201).json({
      totalCustomers,
      isFollower: true,
      hasBooking: true
    });
  } catch (err) {
    console.error('followShop error:', err);
    return res.status(500).json({ message: 'خطا در ثبت مشتری.' });
  }
};
