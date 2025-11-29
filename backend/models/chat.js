// backend/models/chat.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

/* --- اسکیمای تک‌پیام داخل یک چت --- */
const messageSchema = new Schema({
  from: {
    type: String,
    enum: ['user', 'seller', 'admin'],
    required: true
  },

  text: { type: String, required: true },

  /* تاریخ و ساعت ارسال پیام */
  date: { type: Date, default: Date.now },

  // وضعیت خوانده شدن کلی پیام
  read: { type: Boolean, default: false },

  /* آیا ادمین این پیام را دیده است؟ */
  readByAdmin: { type: Boolean, default: false },

  /* آیا فروشنده این پیام را دیده است؟ */
  readBySeller: { type: Boolean, default: false }
});

/* --- اسکیمای چت --- */
const chatSchema = new Schema({
  sellerId:   { type: Schema.Types.ObjectId, ref: 'Seller' },

  // در گفت‌وگوی ادمین ↔ فروشنده ممکن است customerId خالی باشد
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'participantsModel'
  }],
  participantsModel: [{
    type: String,
    required: true,
    enum: ['User', 'Seller', 'Admin']
  }],

  productId:  { type: Schema.Types.ObjectId, ref: 'Product' },
  type: {
    type: String,
    enum: ['product', 'user-admin', 'admin-user', 'user-seller', 'seller-admin', 'general'], // allow general chats
    required: true
  },

  messages:   [messageSchema],

  lastUpdated:{ type: Date, default: Date.now }
});

// اطمینان از مرتب‌سازی شرکت‌کنندگان پیش از ذخیره
chatSchema.pre('save', function(next) {
  if (Array.isArray(this.participants) && Array.isArray(this.participantsModel)) {
    const zipped = this.participants.map((id, idx) => ({
      id,
      model: this.participantsModel[idx]
    }));
    zipped.sort((a, b) => a.id.toString().localeCompare(b.id.toString()));
    this.participants = zipped.map(z => z.id);
    this.participantsModel = zipped.map(z => z.model);
  }
  next();
});

// REMOVED: chatSchema.index({ participants: 1 ... }) because it causes duplicate key errors

/* جلوگیری از OverwriteModelError هنگام هات‌ریلود */
module.exports = mongoose.models.Chat || mongoose.model('Chat', chatSchema);