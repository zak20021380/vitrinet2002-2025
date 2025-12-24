/**
 * Migration: Activate user-first-purchase and user-review missions
 * Run: node backend/migrations/activate-user-missions.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const MissionSetting = require('../models/MissionSettings');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Activate the two missions
    const result = await MissionSetting.updateMany(
      { missionId: { $in: ['user-first-purchase', 'user-review'] } },
      { $set: { isActive: true } }
    );

    console.log(`✅ Updated ${result.modifiedCount} missions to active`);

    // Show current state
    const missions = await MissionSetting.find({ category: 'users' }).sort({ order: 1 });
    console.log('\n📋 Current user missions:');
    missions.forEach(m => {
      console.log(`  - ${m.title}: ${m.isActive ? '✅ Active' : '❌ Inactive'}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Done!');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
