const mongoose = require('mongoose');

const SERVICE_SHOP_CUSTOMER_COLLECTION = 'ServiceShopCustomer';

const serviceShopCustomerSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  serviceShopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceShop',
    default: null,
    index: true
  },
  customerPhone: {
    type: String,
    required: true,
    trim: true
  },
  customerName: {
    type: String,
    default: '',
    trim: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  },

  /* ─── فیلد جدید برای اتصال به کاربر ─── */
  // ارتباط با کاربر (اختیاری برای سازگاری با گذشته)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: false
  }
}, { timestamps: true });

serviceShopCustomerSchema.index(
  { sellerId: 1, customerPhone: 1 },
  { unique: true }
);

module.exports = mongoose.models[SERVICE_SHOP_CUSTOMER_COLLECTION]
  || mongoose.model(SERVICE_SHOP_CUSTOMER_COLLECTION, serviceShopCustomerSchema);
