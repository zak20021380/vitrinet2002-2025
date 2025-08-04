// migrations/addPremiumFields.js
// Migration script to add default premium fields to existing sellers.
// Run once after deploying VitriPlus.

require('dotenv').config();
const mongoose = require('mongoose');
const Seller = require('../models/Seller');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/vitrinet';
  await mongoose.connect(uri);

  await Seller.updateMany(
    { isPremium: { $exists: false } },
    { $set: { isPremium: false, premiumUntil: null } }
  );

  console.log('✅ Premium fields initialized for existing sellers');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
