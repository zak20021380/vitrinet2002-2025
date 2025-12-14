/**
 * Migration: ایجاد ایندکس‌های مدل SellerStreak
 * 
 * اجرا:
 * node backend/migrations/createSellerStreakIndexes.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

async function migrate() {
  try {
    console.log('🔄 در حال اتصال به دیتابیس...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ اتصال به دیتابیس برقرار شد');

    const db = mongoose.connection.db;
    const collectionName = 'sellerstreaks';

    // بررسی وجود کالکشن
    const collections = await db.listCollections({ name: collectionName }).toArray();
    
    if (collections.length === 0) {
      console.log(`📦 کالکشن ${collectionName} وجود ندارد، در حال ایجاد...`);
      await db.createCollection(collectionName);
    }

    const collection = db.collection(collectionName);

    // ایجاد ایندکس‌ها
    console.log('🔧 در حال ایجاد ایندکس‌ها...');

    // ایندکس یکتا برای seller
    await collection.createIndex(
      { seller: 1 },
      { unique: true, name: 'seller_unique' }
    );
    console.log('  ✓ ایندکس seller_unique ایجاد شد');

    // ایندکس برای مرتب‌سازی بر اساس استریک
    await collection.createIndex(
      { currentStreak: -1 },
      { name: 'currentStreak_desc' }
    );
    console.log('  ✓ ایندکس currentStreak_desc ایجاد شد');

    // ایندکس برای آخرین ورود
    await collection.createIndex(
      { lastLoginDate: -1 },
      { name: 'lastLoginDate_desc' }
    );
    console.log('  ✓ ایندکس lastLoginDate_desc ایجاد شد');

    console.log('\n✅ Migration با موفقیت انجام شد!');
    
  } catch (err) {
    console.error('❌ خطا در اجرای migration:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 اتصال به دیتابیس قطع شد');
  }
}

migrate();
