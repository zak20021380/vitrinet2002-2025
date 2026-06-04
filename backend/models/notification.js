const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientRole: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function requiredUserId() {
      return this.recipientRole !== 'admin';
    }
  },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  title: { type: String, trim: true },
  type: { type: String, trim: true },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'critical'],
    default: 'normal',
    index: true
  },
  targetRoute: { type: String, trim: true, default: '' },
  targetId: { type: String, trim: true, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  relatedTicketId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket' },
  userReplies: [{
    message: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    senderRole: { type: String, default: 'seller' }
  }]
}, { timestamps: true });

notificationSchema.index({ recipientRole: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
