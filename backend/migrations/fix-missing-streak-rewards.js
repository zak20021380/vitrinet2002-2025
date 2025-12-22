/**
 * Migration: اصلاح پاداش‌های استریک گمشده
 * 
 * این اسکریپت برای فروشنده‌هایی که استریک دارن ولی پاداش کیف پول نگرفتن،
 * پاداش‌های گذشته رو اضافه می‌کنه.
 * 
 * اجرا: node backend/migrations/fix-missing-streak-rewards.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vitrinet';

async function run() {
  try {
    console.log('🔌 در حال اتصال به دیتابیس...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ اتصال برقرار شد');

    const SellerStreak = require('../models/SellerStreak');
    const SellerWallet = require('../models/SellerWallet');
    const WalletTransaction = require('../models/WalletTransaction');

    // پیدا کردن همه فروشنده‌هایی که استریک دارن
    const streaks = await SellerStreak.find({ totalLoginDays: { $gt: 0 } }).lean();
    console.log(`📊 ${streaks.length} فروشنده با استریک پیدا شد`);

    let fixedCount = 0;
    let alreadyOkCount = 0;
    let errorCount = 0;

    for (const streak of streaks) {
      try {
        const sellerId = streak.seller;
        
        // بررسی تعداد تراکنش‌های استریک
        const streakTransactions = await WalletTransaction.countDocuments({
          seller: sellerId,
          category: { $in: ['streak_daily', 'streak_checkpoint'] }
        });

        // اگر تعداد تراکنش‌ها کمتر از تعداد روزهای لاگین باشه، پاداش گمشده داریم
        if (streakTransactions < streak.totalLoginDays) {
          const missingDays = streak.totalLoginDays - streakTransactions;
          console.log(`\n🔧 فروشنده ${sellerId}: ${missingDays} روز پاداش گمشده`);

          // دریافت یا ایجاد کیف پول
          let wallet = await SellerWallet.findOne({ seller: sellerId });
          if (!wallet) {
            wallet = await SellerWallet.create({ seller: sellerId, balance: 0 });
          }

          // اضافه کردن پاداش‌های گمشده
          const rewardPerDay = 1000; // تومان
          const totalReward = missingDays * rewardPerDay;
          
          const balanceBefore = wallet.balance;
          const balanceAfter = balanceBefore + totalReward;

          // ایجاد تراکنش
          await WalletTransaction.create({
            seller: sellerId,
            type: 'credit',
            amount: totalReward,
            balanceBefore,
            balanceAfter,
            category: 'streak_daily',
            title: 'جبران پاداش‌های استریک گذشته',
            description: `جبران ${missingDays} روز پاداش استریک`,
            relatedType: 'streak',
            status: 'completed'
          });

          // آپدیت کیف پول
          wallet.balance = balanceAfter;
          wallet.totalEarned += totalReward;
          wallet.lastTransactionAt = new Date();
          await wallet.save();

          console.log(`   ✅ ${totalReward} تومان اضافه شد. موجودی جدید: ${balanceAfter}`);
          fixedCount++;
        } else {
          alreadyOkCount++;
        }
      } catch (err) {
        console.error(`   ❌ خطا برای فروشنده ${streak.seller}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 نتیجه:');
    console.log(`   ✅ اصلاح شده: ${fixedCount}`);
    console.log(`   ✓ بدون مشکل: ${alreadyOkCount}`);
    console.log(`   ❌ خطا: ${errorCount}`);
    console.log('='.repeat(50));

  } catch (err) {
    console.error('❌ خطای کلی:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 اتصال قطع شد');
    process.exit(0);
  }
}

run();
