const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema({
  senderId:    { type: mongoose.Schema.Types.ObjectId, required: true },
  senderType:  { type: String, enum: ['seller','customer'], required: true },
  blockedAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Block', BlockSchema);
