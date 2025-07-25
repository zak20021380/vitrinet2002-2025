const mongoose = require('mongoose');
const { Schema } = mongoose;

const adminUserMessageSchema = new Schema({
  senderId:   { type: Schema.Types.ObjectId, required: true, refPath: 'senderModel' },
  receiverId: { type: Schema.Types.ObjectId, required: true, refPath: 'receiverModel' },
  senderModel:   { type: String, required: true, enum: ['Admin', 'User'] },
  receiverModel: { type: String, required: true, enum: ['Admin', 'User'] },
  message:    { type: String, required: true },
  timestamp:  { type: Date, default: Date.now },
  read:       { type: Boolean, default: false },
  isSystemMessage: { type: Boolean, default: false },

  // new unified fields
  senderRole:   { type: String, enum: ['admin', 'seller', 'user'], required: true },
  senderName:   { type: String, required: true },
  recipientId:  { type: Schema.Types.ObjectId, required: true },
  type:         { type: String, enum: ['global', 'private'], default: 'private' },
  createdAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.models.AdminUserMessage || mongoose.model('AdminUserMessage', adminUserMessageSchema);
