// controllers/reportController.js

const Report      = require('../models/Report');
const { REPORT_TYPES } = require('../models/Report');

// ➊ ثبت گزارش
exports.createReport = async (req, res) => {
  try {
    const { type, description, sellerId, shopurl } = req.body;

    // ۱) نوع گزارش را بررسی می‌کنیم
    if (!type || !REPORT_TYPES.includes(type)) {
      return res.status(400).json({ message: 'نوع گزارش معتبر نیست.' });
    }

    // ۲) توضیح حداقل ۵ کاراکتر باشد
    if (!description || description.trim().length < 5) {
      return res.status(400).json({ message: 'توضیح حداقل ۵ کاراکتر باشد.' });
    }

    // ۳) کاربر احراز هویت شده باشد
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'کاربر معتبر نیست. لطفاً دوباره وارد شوید.' });
    }

    // ۴) جلوگیری از ارسال بیش از ۱ گزارش در هر ۶۰ ثانیه
    const last = await Report.findOne({
      userId:    req.user.id,
      createdAt: { $gt: Date.now() - 60 * 1000 }
    });
    if (last) {
      return res.status(429).json({ message: 'لطفاً یک دقیقه بعد دوباره تلاش کنید.' });
    }

    // ۵) ایجاد گزارش جدید
    const report = await Report.create({
      sellerId:  sellerId || undefined,
      shopurl:   shopurl  || undefined,
      userId:    req.user.id,
      ip:        req.ip,
      type,
      description
    });

    // ۶) پاسخ موفق
    res.status(201).json({ message: 'گزارش ثبت شد.', id: report._id });
  } catch (err) {
    console.error('❌ createReport error:', err);
    res.status(500).json({ message: 'خطای سرور در ثبت گزارش.' });
  }
};

// ➋ دریافت همه گزارش‌ها با اطلاعات فروشنده (فقط ادمین)
exports.getReportsWithSellerInfo = async (req, res) => {
  try {
    const { status } = req.query;           // فیلتر وضعیت اختیاری
    const query = status ? { status } : {};

    const reports = await Report
      .find(query)
      // populate روی sellerId: firstname, lastname, storename, shopurl، phone و address
      .populate(
        'sellerId',
        'firstname lastname storename shopurl phone address'
      )
      // populate روی userId: firstname, lastname, phone
      .populate(
        'userId',
        'firstname lastname phone'
      )
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (err) {
    console.error('❌ getReportsWithSellerInfo error:', err);
    res.status(500).json({ message: 'خطای سرور.' });
  }
};

// ➌ تغییر وضعیت یا بلاک‌کردن گزارش‌دهنده
exports.updateReport = async (req, res) => {
  try {
    const { id }     = req.params;
    const { status, block } = req.body;     // block = true/false

    const upd = {};
    if (status)        upd.status  = status;
    if (block !== undefined) upd.blocked = !!block;

    const report = await Report.findByIdAndUpdate(id, upd, { new: true });
    if (!report) return res.status(404).json({ message: 'گزارش پیدا نشد.' });

    res.json({ message: 'به‌روزرسانی شد.', report });
  } catch (err) {
    console.error('❌ updateReport error:', err);
    res.status(500).json({ message: 'خطای سرور.' });
  }
};



// ➍ حذف کامل یک گزارش (فقط ادمین)
exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findByIdAndDelete(id);
    if (!report) {
      return res.status(404).json({ message: 'گزارش مورد نظر یافت نشد.' });
    }
    res.json({ message: 'گزارش با موفقیت حذف شد.' });
  } catch (err) {
    console.error('❌ deleteReport error:', err);
    res.status(500).json({ message: 'خطای سرور در حذف گزارش.' });
  }
};
