const mongoose = require('mongoose');

const SupportTicketSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    index: true,
    sparse: true
  },
  sellerName: { type: String, trim: true },
  shopurl: { type: String, trim: true, index: true },
  phone: { type: String, trim: true },
  subject: { type: String, required: true, trim: true },
  category: { type: String, trim: true, default: 'عمومی' },
  message: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved'],
    default: 'open',
    index: true
  },
  priority: {
    type: String,
    enum: ['normal', 'high'],
    default: 'normal'
  },
  adminNote: { type: String, trim: true },
  lastUpdatedBy: { type: String, trim: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('SupportTicket', SupportTicketSchema);
