const mongoose = require('mongoose');

const accountantEntrySchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: true
    },
    category: {
      type: String,
      trim: true,
      maxlength: 60,
      default: 'عمومی',
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'transfer', 'online', 'cheque', 'other'],
      default: 'cash',
      index: true
    },
    status: {
      type: String,
      enum: ['paid', 'pending', 'overdue', 'refunded'],
      default: 'paid',
      index: true
    },
    counterpartyType: {
      type: String,
      enum: ['customer', 'supplier', 'other'],
      default: 'customer'
    },
    counterpartyName: {
      type: String,
      trim: true,
      maxlength: 120
    },
    referenceNumber: {
      type: String,
      trim: true,
      maxlength: 80,
      index: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    dueDate: {
      type: Date
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 30
      }
    ],
    recordedAt: {
      type: Date,
      required: true,
      default: () => new Date()
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AccountantEntry', accountantEntrySchema);
