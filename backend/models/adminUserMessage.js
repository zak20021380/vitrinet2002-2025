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
  isSystemMessage: { type: Boolean, default: false }
});

module.exports = mongoose.models.AdminUserMessage || mongoose.model('AdminUserMessage', adminUserMessageSchema);
