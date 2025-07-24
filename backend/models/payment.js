const mongoose = require('mongoose');

// مدل پرداخت (Payment) — پشتیبانی همزمان از تبلیغ ویژه و اشتراک فروشگاه
const paymentSchema = new mongoose.Schema({
  adOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdOrder',
    required: false, // فقط برای پرداخت تبلیغات ویژه
  },
  planSlug: {
    type: String,
    required: false, // فقط برای پرداخت اشتراک
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: false, // برای هر دو حالت، معمولاً تو کنترلر باید چک بشه
  },
  amount: {
    type: Number,
    required: true, // مبلغ پرداختی (ریال)
  },
  transactionId: {
    type: String,
    required: false, // بعد از پرداخت موفق از زرین‌پال برمی‌گرده
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['zarinpal', 'paypal', 'credit_card'],
    default: 'zarinpal',
  },
  type: {
    type: String,
    enum: ['ad', 'sub'],
    required: true, // نوع پرداخت: ad = تبلیغ | sub = اشتراک
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
