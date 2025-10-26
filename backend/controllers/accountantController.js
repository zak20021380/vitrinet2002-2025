const AccountantEntry = require('../models/AccountantEntry');

const formatValidationError = (message) => ({ message });

exports.createEntry = async (req, res) => {
  const sellerId = req.user?.id;
  if (!sellerId) {
    return res.status(401).json({ message: 'ابتدا وارد حساب کاربری خود شوید.' });
  }

  try {
    const { title, type, amount, description, recordedAt } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json(formatValidationError('عنوان تراکنش الزامی است.'));
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json(formatValidationError('نوع تراکنش معتبر نیست.'));
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(400).json(formatValidationError('مبلغ تراکنش نامعتبر است.'));
    }

    let entryDate = recordedAt ? new Date(recordedAt) : new Date();
    if (Number.isNaN(entryDate.getTime())) {
      return res.status(400).json(formatValidationError('تاریخ تراکنش نامعتبر است.'));
    }

    const entry = await AccountantEntry.create({
      seller: sellerId,
      title: title.trim(),
      type,
      amount: numericAmount,
      description: description ? String(description).trim() : undefined,
      recordedAt: entryDate
    });

    res.status(201).json({ entry });
  } catch (err) {
    console.error('Error creating accountant entry:', err);
    res.status(500).json({ message: 'خطا در ذخیره‌سازی اطلاعات حسابداری.' });
  }
};

exports.listEntries = async (req, res) => {
  const sellerId = req.user?.id;
  if (!sellerId) {
    return res.status(401).json({ message: 'ابتدا وارد حساب کاربری خود شوید.' });
  }

  try {
    const entries = await AccountantEntry.find({ seller: sellerId })
      .sort({ recordedAt: -1, createdAt: -1 })
      .lean();

    res.json({ entries });
  } catch (err) {
    console.error('Error fetching accountant entries:', err);
    res.status(500).json({ message: 'خطا در دریافت اطلاعات حسابداری.' });
  }
};
