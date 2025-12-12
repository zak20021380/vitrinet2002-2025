const SupportTicket = require('../models/SupportTicket');
const Seller = require('../models/Seller');

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
