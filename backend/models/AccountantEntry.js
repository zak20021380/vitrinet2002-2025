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
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
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
