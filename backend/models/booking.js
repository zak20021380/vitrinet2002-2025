const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellerService',
    required: false
  },
  service: { type: String, required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true, index: true },
  // Align stored field names with existing MongoDB indexes
  bookingDate: { type: String, required: true, alias: 'date' },
  startTime: { type: String, required: true, alias: 'time' },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  },

  /* ─── فیلد جدید برای اتصال به کاربر ─── */
  // ارتباط با کاربر (اختیاری برای سازگاری با گذشته)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: false  // اختیاری برای مایگریشن
  }
}, { timestamps: true });

// Ensure same unique compound index as database (prevents overlapping bookings)
bookingSchema.index({ bookingDate: 1, startTime: 1, sellerId: 1 }, { unique: true });

module.exports = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
