const AdminUserMessage = require('../models/adminUserMessage');
const Admin = require('../models/admin');
const mongoose = require('mongoose');

// لیست کاربران که با مدیر گفتگو داشته‌اند
exports.listUsers = async (req, res) => {
  try {
    // کاربرانی که با ادمین مکاتبه کرده‌اند را استخراج کن
    const result = await AdminUserMessage.aggregate([
      {
        $match: {
          $or: [
            { senderModel: 'User' },
            { receiverModel: 'User' }
          ]
        }
      },
      {
        $project: {
          userId: {
            $cond: [
              { $eq: ['$senderModel', 'User'] },
              '$senderId',
              '$receiverId'
            ]
          }
        }
      },
      { $group: { _id: '$userId' } }
    ]);

    const userIds = result.map(r => r._id);

    const users = await require('../models/user')
      .find({ _id: { $in: userIds } })
      .select('firstname lastname phone')
      .lean();

    res.json(users);
  } catch (err) {
    console.error('listUsers error', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
};

/**
 * Get messages between admin and a specific user
 */
exports.getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const requester = req.user;

    // allow only admin or the owner of the messages
    const requesterId = requester._id || requester.id;
    const authorized =
      requester.role === 'admin' ||
      (requester.role === 'user' && String(requesterId) === String(userId));

    if (!authorized) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }

    // find admin id
    const adminDoc = await Admin.findOne();
    if (!adminDoc) return res.status(500).json({ message: 'ادمین یافت نشد' });
    const adminId = adminDoc._id.toString();

    const uid = requester.role === 'admin' ? userId : requester.id;

    const adminObjId = new mongoose.Types.ObjectId(adminId);
    const userObjId  = new mongoose.Types.ObjectId(uid);

    const msgs = await AdminUserMessage.find({
      $or: [
        { senderId: userObjId, receiverId: adminObjId },
        { senderId: adminObjId, receiverId: userObjId }
      ]
    })
      .sort({ timestamp: 1 })
      .populate('senderId', 'role firstname lastname phone name')
      .populate('receiverId', 'role firstname lastname phone name')
      .lean();

    res.json(msgs);
  } catch (err) {
    console.error('getMessages error', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
};

/**
 * Send a message from admin or user
 * Admin must include userId in body when sending to a user
 */
exports.sendMessage = async (req, res) => {
  try {
    const { message = '', userId } = req.body;
  const sender = req.user;

  if (!message.trim()) return res.status(400).json({ message: 'متن پیام الزامی است' });

  if (sender.role === 'user') {
    const userDoc = await require('../models/user').findById(sender.id).select('blockedByAdmin');
    if (userDoc && userDoc.blockedByAdmin) {
      return res
        .status(403)
        .json({ success: false, message: 'شما مسدود شده‌اید و نمی‌توانید پیامی ارسال کنید.' });
    }
  }

    const adminDoc = await Admin.findOne();
    if (!adminDoc) return res.status(500).json({ message: 'ادمین یافت نشد' });
    const adminId = adminDoc._id.toString();
    const adminObjId = new mongoose.Types.ObjectId(adminId);

    let msgData;
    if (sender.role === 'admin') {
      if (!userId) return res.status(400).json({ message: 'شناسه کاربر الزامی است' });
      msgData = {
        senderId: new mongoose.Types.ObjectId(sender.id),
        receiverId: new mongoose.Types.ObjectId(userId),
        senderModel: 'Admin',
        receiverModel: 'User',
        message,
        senderRole: 'admin',
        senderName: 'مدیر سایت',
        recipientId: new mongoose.Types.ObjectId(userId),
        type: 'private'
      };
    } else if (sender.role === 'user') {
      msgData = {
        senderId: new mongoose.Types.ObjectId(sender.id),
        receiverId: adminObjId,
        senderModel: 'User',
        receiverModel: 'Admin',
        message,
        senderRole: 'user',
        senderName: `${sender.firstname || ''} ${sender.lastname || ''}`.trim() || sender.phone || 'کاربر',
        recipientId: adminObjId,
        type: 'private'
      };
    } else {
      return res.status(403).json({ message: 'نقش نامعتبر' });
    }

    const saved = await AdminUserMessage.create(msgData);
    await saved.populate('senderId', 'role firstname lastname phone name');
    const obj = saved.toObject();
    if (!obj.createdAt) obj.createdAt = obj.timestamp;
    res.json(obj);
  } catch (err) {
    console.error('sendMessage error', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
};

/**
 * Mark a message as read
 */
exports.markRead = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const msg = await AdminUserMessage.findById(id);
    if (!msg) return res.status(404).json({ message: 'پیام یافت نشد' });

    // only receiver or admin can mark
    if (user.role !== 'admin' && msg.receiverId.toString() !== user.id) {
      return res.status(403).json({ message: 'دسترسی غیرمجاز' });
    }

    msg.read = true;
    await msg.save();

    res.json({ success: true });
  } catch (err) {
    console.error('markRead error', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
};
