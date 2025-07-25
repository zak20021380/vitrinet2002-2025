const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    match: /^09\d{9}$/,
    trim: true
  },
  password: {
    type: String,
    required: true,
  },
  // added for role-based messaging labels
  role: {
    type: String,
    default: 'admin'
  },
  name: {
    type: String,
    default: 'ادمین'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Admin', adminSchema);
