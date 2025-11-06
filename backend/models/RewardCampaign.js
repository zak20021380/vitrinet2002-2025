const mongoose = require('mongoose');

const rewardCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    trim: true,
    match: /^[0-9]{6}$/
  },
  note: {
    type: String,
    trim: true,
    default: ''
  },
  used: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  usedAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const rewardCampaignSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    default: 'default'
  },
  title: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  prizeValue: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    trim: true,
    default: 'تومان'
  },
  capacity: {
    type: Number,
    default: 0
  },
  winnersClaimed: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: false
  },
  codes: {
    type: [rewardCodeSchema],
    default: []
  },
  updatedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('RewardCampaign', rewardCampaignSchema);
