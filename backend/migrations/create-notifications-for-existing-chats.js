/**
 * Migration: ایجاد اعلان برای پیام‌های موجود مشتریان
 * این اسکریپت برای چت‌های موجود که پیام خوانده نشده دارند، اعلان ایجاد می‌کند
 * 
 * اجرا: node backend/migrations/create-notifications-for-existing-chats.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Chat = require('../models/chat');
const User = require('../models/user');
const Product = require('../models/product');
const SellerNotification = require('../models/SellerNotification');

async function migrate() {
  try {
    // اتصال به دیتابیس
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/vitrinet';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // پیدا کردن چت‌هایی که پیام خوانده نشده از مشتری دارند
    const chats = await Chat.find({
      $or: [
        { type: 'product' },
        { type: 'user-seller' }
      ],
      sellerId: { $exists: true, $ne: null }
    }).populate('productId', 'title').lean();

    console.log(`Found ${chats.length} chats to process`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const chat of chats) {
      // پیدا کردن پیام‌های خوانده نشده از مشتری
      const unreadMessages = (chat.messages || []).filter(m => 
        m.from !== 'seller' && 
        m.from !== 'admin' && 
        !m.readBySeller
      );

      if (unreadMessages.length === 0) {
        skippedCount++;
        continue;
      }

      const sellerId = chat.sellerId;
      if (!sellerId) {
        skippedCount++;
        continue;
      }

      // چک کردن اینکه آیا قبلاً اعلان برای این چت ایجاد شده یا نه
      const existingNotif = await SellerNotification.findOne({
        sellerId,
        'relatedData.chatId': chat._id,
        type: 'customer_message'
      });

      if (existingNotif) {
        skippedCount++;
        continue;
      }

      // پیدا کردن اطلاعات مشتری
      const userIdx = (chat.participantsModel || []).findIndex(m => m === 'User');
      let customerName = 'مشتری';
      let customerId = null;

      if (userIdx !== -1 && chat.participants[userIdx]) {
        customerId = chat.participants[userIdx];
        try {
          const user = await User.findById(customerId).select('firstname lastname phone');
          if (user) {
            customerName = `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.phone || 'مشتری';
          }
        } catch (e) {
          console.warn('Failed to get user info:', e.message);
        }
      }

      const productTitle = chat.productId?.title || '';

      // ایجاد اعلان
      const notification = new SellerNotification({
        sellerId,
        type: 'customer_message',
        title: 'پیام جدید از مشتری',
        message: productTitle 
          ? `${customerName} درباره "${productTitle}" پیام داده است.`
          : `${customerName} به شما پیام داده است.`,
        relatedData: {
          chatId: chat._id,
          customerId,
          productId: chat.productId?._id || null,
          customerName,
          productTitle
        }
      });

      await notification.save();
      createdCount++;
      console.log(`Created notification for chat ${chat._id} (seller: ${sellerId})`);
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Created: ${createdCount} notifications`);
    console.log(`Skipped: ${skippedCount} chats`);

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

migrate();
