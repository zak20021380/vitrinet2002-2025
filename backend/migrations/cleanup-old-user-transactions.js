/**
 * Migration: حذف تراکنش‌های قدیمی کیف پول کاربران
 * 
 * این اسکریپت تراکنش‌های قدیمی‌تر از 90 روز را حذف می‌کند
 * می‌توان آن را به صورت دستی یا با cron job اجرا کرد
 * 
 * Usage:
 *   node backend/migrations/cleanup-old-user-transactions.js
 *   node backend/migrations/cleanup-old-user-transactions.js --days=60
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const UserWalletTransaction = require('../models/UserWalletTransaction');

// تعداد روزهای نگهداری (پیش‌فرض: 90 روز)
const DEFAULT_RETENTION_DAYS = 90;

async function cleanupOldTransactions() {
  // خواندن پارامتر days از command line
  const args = process.argv.slice(2);
  let retentionDays = DEFAULT_RETENTION_DAYS;
  
  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      const days = parseInt(arg.split('=')[1]);
      if (!isNaN(days) && days >= 30) {
        retentionDays = days;
      } else {
        console.warn('⚠️ مقدار days باید حداقل 30 باشد. از مقدار پیش‌فرض استفاده می‌شود.');
      }
    }
  }

  console.log('🔄 شروع پاکسازی تراکنش‌های قدیمی کیف پول کاربران...');
  console.log(`📅 حذف تراکنش‌های قدیمی‌تر از ${retentionDays} روز`);

  try {
    // اتصال به دیتابیس
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ اتصال به دیتابیس برقرار شد');

    // محاسبه تاریخ cutoff
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    console.log(`📆 تاریخ cutoff: ${cutoffDate.toISOString()}`);

    // شمارش تراکنش‌های قدیمی قبل از حذف
    const countBefore = await UserWalletTransaction.countDocuments({
      createdAt: { $lt: cutoffDate }
    });
    console.log(`📊 تعداد تراکنش‌های قدیمی: ${countBefore}`);

    if (countBefore === 0) {
      console.log('✨ هیچ تراکنش قدیمی برای حذف وجود ندارد');
      return;
    }

    // حذف تراکنش‌های قدیمی
    const result = await UserWalletTransaction.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    console.log(`✅ ${result.deletedCount} تراکنش قدیمی با موفقیت حذف شد`);

    // آمار نهایی
    const totalRemaining = await UserWalletTransaction.countDocuments();
    console.log(`📈 تعداد کل تراکنش‌های باقی‌مانده: ${totalRemaining}`);

  } catch (error) {
    console.error('❌ خطا در پاکسازی:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 اتصال به دیتابیس قطع شد');
  }
}

// اجرای migration
cleanupOldTransactions()
  .then(() => {
    console.log('✅ پاکسازی با موفقیت انجام شد');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ خطا:', err);
    process.exit(1);
  });
