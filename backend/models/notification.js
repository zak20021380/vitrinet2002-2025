const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  userReplies: [{
    message: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    senderRole: { type: String, default: 'seller' }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
