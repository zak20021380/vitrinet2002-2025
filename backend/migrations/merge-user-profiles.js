/**
 * USER PROFILE MIGRATION SCRIPT
 * Links service bookings to user accounts and updates userType
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');
const Booking = require('../models/booking');
const ServiceShopCustomer = require('../models/serviceShopCustomer');
const FavoriteShop = require('../models/favoriteShop');

// Check for dry-run mode
const isDryRun = process.argv.includes('--dry-run');

const stats = {
  bookingsMatched: 0,
  usersCreated: 0,
  userTypesUpdated: 0,
  customersLinked: 0,
  errors: []
};

async function migrateUserProfiles() {
  try {
    console.log('🚀 Starting user profile migration...');
    console.log(isDryRun ? '📋 DRY RUN MODE (no changes will be saved)\n' : '✏️  LIVE MODE (changes will be saved)\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database\n');
    
    // Migration steps will go here
    
    console.log('\n📊 MIGRATION SUMMARY:');
    console.log(`   Bookings matched: ${stats.bookingsMatched}`);
    console.log(`   Users created: ${stats.usersCreated}`);
    console.log(`   User types updated: ${stats.userTypesUpdated}`);
    console.log(`   Customers linked: ${stats.customersLinked}`);
    console.log(`   Errors: ${stats.errors.length}`);
    
    if (stats.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      stats.errors.forEach(err => console.log(`   - ${err}`));
    }
    
    console.log('\n✅ Migration completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

// Run migration
migrateUserProfiles();
