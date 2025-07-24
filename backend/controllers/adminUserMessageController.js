const AdminUserMessage = require('../models/adminUserMessage');
const Admin = require('../models/admin');

// لیست کاربران که با مدیر گفتگو داشته‌اند
exports.listUsers = async (req, res) => {
  try {
    const users = await AdminUserMessage.aggregate([
      {
        $group: {
          _id: '$senderId'
        }
      },
      {
        $unionWith: {
          coll: 'adminusermessages',
          pipeline: [
            { $group: { _id: '$receiverId' } }
          ]
        }
      },
      { $group: { _id: '$_id' } }
    ]);
    const ids = users.map(u => u._id);
    res.json(ids);
  } catch(err){
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

    // ensure authorized
    if (requester.role === 'user' && requester.id !== userId) {
      return res.status(403).json({ message: 'دسترسی غیرمجاز' });
    }

    // find admin id
    const adminDoc = await Admin.findOne();
    if (!adminDoc) return res.status(500).json({ message: 'ادمین یافت نشد' });
    const adminId = adminDoc._id.toString();

    const uid = requester.role === 'admin' ? userId : requester.id;

    const msgs = await AdminUserMessage.find({
      $or: [
        { senderId: uid, receiverId: adminId },
        { senderId: adminId, receiverId: uid }
      ]
    }).sort({ timestamp: 1 }).lean();

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

    const adminDoc = await Admin.findOne();
    if (!adminDoc) return res.status(500).json({ message: 'ادمین یافت نشد' });
    const adminId = adminDoc._id.toString();

    let msgData;
    if (sender.role === 'admin') {
      if (!userId) return res.status(400).json({ message: 'شناسه کاربر الزامی است' });
      msgData = {
        senderId: sender.id,
        receiverId: userId,
        senderModel: 'Admin',
        receiverModel: 'User',
        message
      };
    } else if (sender.role === 'user') {
      msgData = {
        senderId: sender.id,
        receiverId: adminId,
        senderModel: 'User',
        receiverModel: 'Admin',
        message
      };
    } else {
      return res.status(403).json({ message: 'نقش نامعتبر' });
    }

    const saved = await AdminUserMessage.create(msgData);
    res.json(saved);
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
