/**
 * Migration Script: Fix Chat Seller IDs
 * 
 * این اسکریپت چت‌هایی که sellerId ندارند ولی productId دارند را پیدا کرده
 * و sellerId را از محصول استخراج و ذخیره می‌کند.
 * 
 * اجرا: node backend/migrations/fix-chat-seller-ids.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Chat = require('../models/chat');
const Product = require('../models/product');

async function fixChatSellerIds() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database');

    // پیدا کردن چت‌هایی که productId دارند ولی sellerId ندارند
    const chatsToFix = await Chat.find({
      productId: { $ne: null },
      $or: [
        { sellerId: null },
        { sellerId: { $exists: false } }
      ]
    }).lean();

    console.log(`📋 Found ${chatsToFix.length} chats to fix`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const chat of chatsToFix) {
      try {
        const product = await Product.findById(chat.productId).select('sellerId').lean();
        
        if (!product) {
          console.log(`⚠️ Product not found for chat ${chat._id}`);
          skipped++;
          continue;
        }

        let sellerId = product.sellerId;
        if (Array.isArray(sellerId)) {
          sellerId = sellerId[0];
        }

        if (!sellerId) {
          console.log(`⚠️ No sellerId in product for chat ${chat._id}`);
          skipped++;
          continue;
        }

        await Chat.updateOne(
          { _id: chat._id },
          { $set: { sellerId: sellerId } }
        );

        fixed++;
        console.log(`✅ Fixed chat ${chat._id} with sellerId ${sellerId}`);
      } catch (err) {
        console.error(`❌ Error fixing chat ${chat._id}:`, err.message);
        errors++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ⚠️ Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📋 Total: ${chatsToFix.length}`);

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

fixChatSellerIds();
