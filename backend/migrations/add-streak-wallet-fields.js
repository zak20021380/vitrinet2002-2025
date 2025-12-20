/**
 * Migration: Add new fields to SellerStreak and SellerWallet models
 * 
 * این migration فیلدهای جدید را به مدل‌های موجود اضافه می‌کند:
 * - SellerStreak: lastActiveDate (string format YYYY-MM-DD)
 * - SellerWallet: pendingBalance, lastReconciledAt
 * - WalletTransaction: status, idempotencyKey, referenceId, referenceType
 * 
 * Usage: node backend/migrations/add-streak-wallet-fields.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function migrate() {
  console.log('🚀 Starting migration: add-streak-wallet-fields');
  
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // ===== Update SellerStreak documents =====
    console.log('\n📝 Updating SellerStreak documents...');
    
    const streakCollection = db.collection('sellerstreaks');
    const streakDocs = await streakCollection.find({ lastActiveDate: { $exists: false } }).toArray();
    
    console.log(`Found ${streakDocs.length} SellerStreak documents to update`);
    
    for (const doc of streakDocs) {
      let lastActiveDate = null;
      
      // Convert lastLoginDate to lastActiveDate string format
      if (doc.lastLoginDate) {
        const date = new Date(doc.lastLoginDate);
        // Convert to Tehran timezone
        const tehranTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
        const year = tehranTime.getFullYear();
        const month = String(tehranTime.getMonth() + 1).padStart(2, '0');
        const day = String(tehranTime.getDate()).padStart(2, '0');
        lastActiveDate = `${year}-${month}-${day}`;
      }
      
      await streakCollection.updateOne(
        { _id: doc._id },
        { 
          $set: { 
            lastActiveDate: lastActiveDate 
          } 
        }
      );
    }
    
    console.log(`✅ Updated ${streakDocs.length} SellerStreak documents`);
    
    // ===== Update SellerWallet documents =====
    console.log('\n📝 Updating SellerWallet documents...');
    
    const walletCollection = db.collection('sellerwallets');
    const walletResult = await walletCollection.updateMany(
      { pendingBalance: { $exists: false } },
      { 
        $set: { 
          pendingBalance: 0,
          lastReconciledAt: null
        } 
      }
    );
    
    console.log(`✅ Updated ${walletResult.modifiedCount} SellerWallet documents`);
    
    // ===== Update WalletTransaction documents =====
    console.log('\n📝 Updating WalletTransaction documents...');
    
    const txCollection = db.collection('wallettransactions');
    
    // Add status field
    const txStatusResult = await txCollection.updateMany(
      { status: { $exists: false } },
      { $set: { status: 'completed' } }
    );
    console.log(`✅ Added status field to ${txStatusResult.modifiedCount} WalletTransaction documents`);
    
    // Convert type from 'earn'/'spend' to 'credit'/'debit'
    const earnResult = await txCollection.updateMany(
      { type: 'earn' },
      { $set: { type: 'credit' } }
    );
    console.log(`✅ Converted ${earnResult.modifiedCount} 'earn' transactions to 'credit'`);
    
    const spendResult = await txCollection.updateMany(
      { type: 'spend' },
      { $set: { type: 'debit' } }
    );
    console.log(`✅ Converted ${spendResult.modifiedCount} 'spend' transactions to 'debit'`);
    
    // Copy relatedId to referenceId if not exists
    const refResult = await txCollection.updateMany(
      { 
        referenceId: { $exists: false },
        relatedId: { $exists: true, $ne: null }
      },
      [
        { 
          $set: { 
            referenceId: '$relatedId',
            referenceType: '$relatedType'
          } 
        }
      ]
    );
    console.log(`✅ Copied referenceId for ${refResult.modifiedCount} WalletTransaction documents`);
    
    // ===== Create indexes =====
    console.log('\n📝 Creating indexes...');
    
    await streakCollection.createIndex({ lastActiveDate: -1 });
    console.log('✅ Created index on SellerStreak.lastActiveDate');
    
    await txCollection.createIndex({ idempotencyKey: 1 }, { sparse: true });
    console.log('✅ Created index on WalletTransaction.idempotencyKey');
    
    await txCollection.createIndex({ referenceId: 1, referenceType: 1 });
    console.log('✅ Created index on WalletTransaction.referenceId/referenceType');
    
    await txCollection.createIndex({ status: 1 });
    console.log('✅ Created index on WalletTransaction.status');
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run migration
migrate();
