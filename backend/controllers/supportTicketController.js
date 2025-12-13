const SupportTicket = require('../models/SupportTicket');
const Seller = require('../models/Seller');
const { createNotification } = require('./notificationController');

function normalizeSellerName(seller) {
  if (!seller) return '';
  const name = `${seller.firstname || ''} ${seller.lastname || ''}`.trim();
  if (name) return name;
  return seller.storename || seller.storeName || '';
}

exports.createTicket = async (req, res) => {
  try {
    const { subject, message, category, priority } = req.body || {};
    if (!subject || !message) {
      return res.status(400).json({ message: 'موضوع و متن تیکت الزامی است.' });
    }

    let sellerInfo = { id: null, name: '', shopurl: '', phone: '' };

    if (req.user?.id) {
      const seller = await Seller.findById(req.user.id).select('firstname lastname storename shopurl phone');
      if (!seller) {
        return res.status(403).json({ message: 'حساب فروشنده یافت نشد.' });
      }
      sellerInfo = {
        id: seller._id,
        name: normalizeSellerName(seller) || 'فروشنده خدماتی',
        shopurl: seller.shopurl || '',
        phone: seller.phone || ''
      };
    }

    const ticket = await SupportTicket.create({
      sellerId: sellerInfo.id,
      sellerName: sellerInfo.name,
      shopurl: sellerInfo.shopurl,
      phone: sellerInfo.phone,
      subject: String(subject).trim(),
      category: (category || 'عمومی').toString().trim(),
      message: String(message).trim(),
      priority: priority === 'high' ? 'high' : 'normal'
    });

    res.status(201).json({ ticket });
  } catch (err) {
    console.error('createTicket error:', err);
    res.status(500).json({ message: 'ثبت تیکت با خطا مواجه شد.' });
  }
};

exports.listTickets = async (req, res) => {
  try {
    const { status } = req.query || {};
    const filter = {};
    if (status) filter.status = status;

    const tickets = await SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ tickets });
  } catch (err) {
    console.error('listTickets error:', err);
    res.status(500).json({ message: 'امکان واکشی تیکت‌ها وجود ندارد.' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body || {};
    if (!status || !['open', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'وضعیت معتبر نیست.' });
    }

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: 'تیکت پیدا نشد.' });
    }

    ticket.status = status;
    if (adminNote) ticket.adminNote = adminNote;
    if (req.user?.role) ticket.lastUpdatedBy = req.user.role;
    await ticket.save();

    res.json({ ticket });
  } catch (err) {
    console.error('updateStatus error:', err);
    res.status(500).json({ message: 'بروزرسانی وضعیت ممکن نیست.' });
  }
};

exports.replyToTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, status } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'متن پاسخ اجباری است.' });
    }

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: 'تیکت پیدا نشد.' });
    }

    const replyEntry = {
      message: String(message).trim(),
      adminId: req.user?.id || null
    };

    if (!Array.isArray(ticket.adminReplies)) {
      ticket.adminReplies = [];
    }
    ticket.adminReplies.push(replyEntry);

    const normalizedStatus = status && ['open', 'in_progress', 'resolved'].includes(status)
      ? status
      : 'in_progress';

    ticket.status = normalizedStatus;
    ticket.lastUpdatedBy = req.user?.role || ticket.lastUpdatedBy;
    await ticket.save();

    if (ticket.sellerId) {
      const summary = replyEntry.message.length > 120
        ? `${replyEntry.message.slice(0, 120)}…`
        : replyEntry.message;
      await createNotification(ticket.sellerId, `پاسخ جدید برای تیکت «${ticket.subject}»: ${summary}`, {
        relatedTicketId: ticket._id,
        type: 'support_ticket'
      });
    }

    res.json({ ticket });
  } catch (err) {
    console.error('replyToTicket error:', err);
    res.status(500).json({ message: 'ارسال پاسخ با خطا مواجه شد.' });
  }
};

// فروشنده: دریافت تیکت‌های خود
exports.getMyTickets = async (req, res) => {
  try {
    const sellerId = req.user?.id;
    if (!sellerId) {
      return res.status(401).json({ message: 'احراز هویت الزامی است.' });
    }

    const tickets = await SupportTicket.find({ sellerId })
      .sort({ createdAt: -1 })
      .lean();

    // Transform tickets for frontend
    const transformedTickets = tickets.map(ticket => {
      // Combine admin replies into a unified replies array
      const replies = [];
      
      if (Array.isArray(ticket.adminReplies)) {
        ticket.adminReplies.forEach(reply => {
          replies.push({
            message: reply.message,
            from: 'admin',
            isAdmin: true,
            createdAt: reply.createdAt || reply.repliedAt
          });
        });
      }

      if (Array.isArray(ticket.sellerReplies)) {
        ticket.sellerReplies.forEach(reply => {
          replies.push({
            message: reply.message,
            from: 'seller',
            isAdmin: false,
            createdAt: reply.createdAt
          });
        });
      }

      // Sort replies by date
      replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      // Map status to frontend format
      let status = 'pending';
      if (ticket.status === 'resolved') status = 'closed';
      else if (ticket.status === 'in_progress') status = 'in-progress';
      else if (ticket.adminReplies?.length > 0) status = 'answered';

      return {
        _id: ticket._id,
        id: ticket._id,
        subject: ticket.subject,
        message: ticket.message,
        category: ticket.category,
        status,
        priority: ticket.priority,
        replies,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt
      };
    });

    res.json({ tickets: transformedTickets });
  } catch (err) {
    console.error('getMyTickets error:', err);
    res.status(500).json({ message: 'خطا در دریافت تیکت‌ها.' });
  }
};

// فروشنده: پاسخ به تیکت خود
exports.sellerReplyToTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body || {};
    const sellerId = req.user?.id;

    if (!sellerId) {
      return res.status(401).json({ message: 'احراز هویت الزامی است.' });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'متن پاسخ الزامی است.' });
    }

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: 'تیکت پیدا نشد.' });
    }

    // Check if this ticket belongs to the seller
    if (String(ticket.sellerId) !== String(sellerId)) {
      return res.status(403).json({ message: 'شما اجازه پاسخ به این تیکت را ندارید.' });
    }

    // Check if ticket is closed
    if (ticket.status === 'resolved') {
      return res.status(400).json({ message: 'این تیکت بسته شده و امکان پاسخ وجود ندارد.' });
    }

    const replyEntry = {
      message: String(message).trim(),
      createdAt: new Date()
    };

    if (!Array.isArray(ticket.sellerReplies)) {
      ticket.sellerReplies = [];
    }
    ticket.sellerReplies.push(replyEntry);

    // Update status to open (waiting for admin response)
    ticket.status = 'open';
    ticket.lastUpdatedBy = 'seller';
    await ticket.save();

    res.json({ success: true, message: 'پاسخ شما ثبت شد.' });
  } catch (err) {
    console.error('sellerReplyToTicket error:', err);
    res.status(500).json({ message: 'خطا در ارسال پاسخ.' });
  }
};
