/**
 * Migration: تولید کد معرف یکتا برای کاربران موجود
 * 
 * اجرا: node backend/migrations/generate-user-referral-codes.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/user');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/vitrinet';

// تولید کد معرف یکتا
async function generateUniqueReferralCode(existingCodes) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codeLength = 8;
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    let code = 'VT';
    for (let i = 0; i < codeLength - 2; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    if (!existingCodes.has(code)) {
      existingCodes.add(code);
      return code;
    }
    attempts++;
  }

  // Fallback با timestamp
  const timestamp = Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
  const fallbackCode = `VT${timestamp}`.slice(0, 8);
  existingCodes.add(fallbackCode);
  return fallbackCode;
}

async function migrate() {
  try {
    console.log('🔌 اتصال به دیتابیس...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ متصل شد به:', MONGO_URI);

    // پیدا کردن کاربرانی که کد معرف ندارند
    const usersWithoutCode = await User.find({
      $or: [
        { referralCode: { $exists: false } },
        { referralCode: null },
        { referralCode: '' }
      ]
    });

    console.log(`📊 تعداد کاربران بدون کد معرف: ${usersWithoutCode.length}`);

    if (usersWithoutCode.length === 0) {
      console.log('✅ همه کاربران کد معرف دارند!');
      await mongoose.disconnect();
      return;
    }

    // جمع‌آوری کدهای موجود
    const existingCodes = new Set();
    const allUsers = await User.find({ referralCode: { $exists: true, $ne: null, $ne: '' } }).select('referralCode');
    allUsers.forEach(u => existingCodes.add(u.referralCode));

    console.log(`📋 تعداد کدهای موجود: ${existingCodes.size}`);
    console.log('🚀 شروع تولید کدهای معرف...\n');

    let updated = 0;
    let failed = 0;

    for (const user of usersWithoutCode) {
      try {
        const newCode = await generateUniqueReferralCode(existingCodes);
        
        await User.updateOne(
          { _id: user._id },
          { $set: { referralCode: newCode } }
        );

        updated++;
        console.log(`✅ ${updated}/${usersWithoutCode.length} - کاربر ${user.firstname} ${user.lastname}: ${newCode}`);
      } catch (err) {
        failed++;
        console.error(`❌ خطا برای کاربر ${user._id}:`, err.message);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ تعداد آپدیت شده: ${updated}`);
    console.log(`❌ تعداد خطا: ${failed}`);
    console.log('='.repeat(50));

    await mongoose.disconnect();
    console.log('\n🔌 اتصال قطع شد.');

  } catch (err) {
    console.error('❌ خطای کلی:', err);
    process.exit(1);
  }
}

migrate();
