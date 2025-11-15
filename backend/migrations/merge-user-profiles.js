/**
 * ═══════════════════════════════════════════════════════════════════════
 * DATA MIGRATION: MERGE USER PROFILES
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Purpose: Merge separate product and service user systems into unified dashboard
 *
 * What this script does:
 * 1. Link existing bookings to users by matching phone numbers
 * 2. Create placeholder user accounts for service customers without accounts
 * 3. Update userType field based on user activity (product/service/both)
 * 4. Link ServiceShopCustomer records to user accounts
 *
 * Usage:
 *   node backend/migrations/merge-user-profiles.js [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be changed without making changes
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');
const Booking = require('../models/booking');
const ServiceShopCustomer = require('../models/serviceShopCustomer');
const FavoriteShop = require('../models/favoriteShop');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 100; // Process in batches to avoid memory issues

// Statistics
const stats = {
  bookingsMatched: 0,
  bookingsUnmatched: 0,
  usersCreated: 0,
  usersUpdated: 0,
  serviceCustomersLinked: 0,
  errors: []
};

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/vitrinet';
    await mongoose.connect(dbUri);
    console.log('✅ Connected to MongoDB:', dbUri);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnectDB() {
  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');
}

/**
 * STEP 1: Match bookings to users by phone number
 */
async function linkBookingsToUsers() {
  console.log('\n📅 STEP 1: Linking bookings to users...');
  console.log('─'.repeat(60));

  try {
    // Find all bookings without userId
    const bookingsWithoutUser = await Booking.find({
      $or: [
        { userId: { $exists: false } },
        { userId: null }
      ]
    });

    console.log(`Found ${bookingsWithoutUser.length} bookings to process`);

    for (let i = 0; i < bookingsWithoutUser.length; i++) {
      const booking = bookingsWithoutUser[i];

      if ((i + 1) % 50 === 0) {
        console.log(`  Processing booking ${i + 1}/${bookingsWithoutUser.length}...`);
      }

      try {
        // Try to find user by phone number
        let user = await User.findOne({ phone: booking.customerPhone });

        if (!user) {
          // Create new user for service customers
          const [firstname, ...lastnameParts] = (booking.customerName || 'مشتری سرویس').split(' ');

          if (!DRY_RUN) {
            user = await User.create({
              firstname: firstname || 'مشتری',
              lastname: lastnameParts.join(' ') || 'سرویس',
              phone: booking.customerPhone,
              password: `TEMP_${Date.now()}_${Math.random().toString(36)}`, // They'll need to reset
              userType: 'service',
              role: 'user',
              bookings: [booking._id]
            });
          }

          stats.usersCreated++;
          console.log(`  ✨ Created new user for ${booking.customerPhone}`);
        } else {
          stats.bookingsMatched++;
        }

        // Link booking to user
        if (!DRY_RUN && user) {
          booking.userId = user._id;
          await booking.save();

          // Add booking to user's bookings array if not already there
          if (!user.bookings || !user.bookings.includes(booking._id)) {
            user.bookings = user.bookings || [];
            user.bookings.push(booking._id);
            await user.save();
          }
        }

      } catch (error) {
        stats.errors.push({
          step: 'linkBookings',
          bookingId: booking._id,
          error: error.message
        });
        console.error(`  ⚠️  Error processing booking ${booking._id}:`, error.message);
      }
    }

    console.log(`\n  ✅ Linked ${stats.bookingsMatched} bookings to existing users`);
    console.log(`  ✨ Created ${stats.usersCreated} new user accounts`);

  } catch (error) {
    console.error('❌ Error in linkBookingsToUsers:', error);
    throw error;
  }
}

/**
 * STEP 2: Update userType based on activity
 */
async function updateUserTypes() {
  console.log('\n👥 STEP 2: Updating user types based on activity...');
  console.log('─'.repeat(60));

  try {
    const users = await User.find({});
    console.log(`Found ${users.length} users to analyze`);

    let productOnly = 0;
    let serviceOnly = 0;
    let both = 0;
    let neither = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      if ((i + 1) % 100 === 0) {
        console.log(`  Analyzing user ${i + 1}/${users.length}...`);
      }

      try {
        // Check product activity
        const hasFavoriteProducts = user.favorites && user.favorites.length > 0;
        const favoriteShopsCount = await FavoriteShop.countDocuments({ user: user._id });
        const hasProductActivity = hasFavoriteProducts || favoriteShopsCount > 0;

        // Check service activity
        const bookingsCount = user.bookings ? user.bookings.length : 0;
        const hasServiceActivity = bookingsCount > 0;

        // Determine userType
        let newUserType = 'both'; // Default for new/inactive users

        if (hasProductActivity && hasServiceActivity) {
          newUserType = 'both';
          both++;
        } else if (hasProductActivity) {
          newUserType = 'product';
          productOnly++;
        } else if (hasServiceActivity) {
          newUserType = 'service';
          serviceOnly++;
        } else {
          newUserType = 'both'; // Default for inactive users
          neither++;
        }

        // Update if changed
        if (user.userType !== newUserType) {
          if (!DRY_RUN) {
            user.userType = newUserType;
            await user.save();
          }
          stats.usersUpdated++;
        }

      } catch (error) {
        stats.errors.push({
          step: 'updateUserTypes',
          userId: user._id,
          error: error.message
        });
        console.error(`  ⚠️  Error processing user ${user._id}:`, error.message);
      }
    }

    console.log(`\n  User type distribution:`);
    console.log(`    🛍️  Product only: ${productOnly}`);
    console.log(`    📅 Service only: ${serviceOnly}`);
    console.log(`    🎯 Both: ${both}`);
    console.log(`    ⭕ Neither (new/inactive): ${neither}`);
    console.log(`  ✅ Updated ${stats.usersUpdated} users`);

  } catch (error) {
    console.error('❌ Error in updateUserTypes:', error);
    throw error;
  }
}

/**
 * STEP 3: Link ServiceShopCustomer records to users
 */
async function linkServiceCustomersToUsers() {
  console.log('\n🏪 STEP 3: Linking service shop customers to users...');
  console.log('─'.repeat(60));

  try {
    const customersWithoutUser = await ServiceShopCustomer.find({
      $or: [
        { userId: { $exists: false } },
        { userId: null }
      ]
    });

    console.log(`Found ${customersWithoutUser.length} customer records to link`);

    for (let i = 0; i < customersWithoutUser.length; i++) {
      const customer = customersWithoutUser[i];

      if ((i + 1) % 50 === 0) {
        console.log(`  Processing customer ${i + 1}/${customersWithoutUser.length}...`);
      }

      try {
        const user = await User.findOne({ phone: customer.customerPhone });

        if (user) {
          if (!DRY_RUN) {
            customer.userId = user._id;
            await customer.save();
          }
          stats.serviceCustomersLinked++;
        }

      } catch (error) {
        stats.errors.push({
          step: 'linkServiceCustomers',
          customerId: customer._id,
          error: error.message
        });
        console.error(`  ⚠️  Error processing customer ${customer._id}:`, error.message);
      }
    }

    console.log(`  ✅ Linked ${stats.serviceCustomersLinked} customer records`);

  } catch (error) {
    console.error('❌ Error in linkServiceCustomersToUsers:', error);
    throw error;
  }
}

/**
 * Print final statistics
 */
function printSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('═'.repeat(60));

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes were made\n');
  }

  console.log('Results:');
  console.log(`  📅 Bookings matched to existing users: ${stats.bookingsMatched}`);
  console.log(`  ✨ New user accounts created: ${stats.usersCreated}`);
  console.log(`  👥 User types updated: ${stats.usersUpdated}`);
  console.log(`  🏪 Service customers linked: ${stats.serviceCustomersLinked}`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
    console.log('\nError details:');
    stats.errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. [${err.step}] ${err.error}`);
      if (err.bookingId) console.log(`     Booking ID: ${err.bookingId}`);
      if (err.userId) console.log(`     User ID: ${err.userId}`);
      if (err.customerId) console.log(`     Customer ID: ${err.customerId}`);
    });
  }

  console.log('\n' + '═'.repeat(60));

  if (DRY_RUN) {
    console.log('💡 To apply these changes, run without --dry-run flag');
  } else {
    console.log('✅ Migration completed successfully!');
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('═'.repeat(60));
  console.log('🚀 USER PROFILE MIGRATION');
  console.log('═'.repeat(60));

  if (DRY_RUN) {
    console.log('⚠️  Running in DRY RUN mode - no changes will be made');
  }

  console.log(`📅 Started at: ${new Date().toISOString()}\n`);

  try {
    await connectDB();

    // Run migration steps
    await linkBookingsToUsers();
    await updateUserTypes();
    await linkServiceCustomersToUsers();

    printSummary();

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await disconnectDB();
  }

  console.log(`\n📅 Finished at: ${new Date().toISOString()}`);
  process.exit(0);
}

// Run migration
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
