const mongoose = require('mongoose');

const bookingAvailabilitySchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    unique: true,
    index: true
  },
  // Map of weekday numbers ('0'-'6') to array of time strings 'HH:MM'
  slots: {
    type: Map,
    of: [String],
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.models.BookingAvailability || mongoose.model('BookingAvailability', bookingAvailabilitySchema);
