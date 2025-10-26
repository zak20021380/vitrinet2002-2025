const AccountantEntry = require('../models/AccountantEntry');

const formatValidationError = (message) => ({ message });

const TRANSACTION_TYPES = ['income', 'expense'];
const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'online', 'cheque', 'other'];
const PAYMENT_STATUS = ['paid', 'pending', 'overdue', 'refunded'];
const COUNTERPARTY_TYPES = ['customer', 'supplier', 'other'];

const sanitizeTags = (rawTags) => {
  if (!rawTags) return undefined;

  const items = Array.isArray(rawTags)
    ? rawTags
    : String(rawTags)
        .split(',')
        .map((tag) => tag.trim());

  const filtered = items
    .filter((tag) => Boolean(tag))
    .slice(0, 8)
    .map((tag) => tag.slice(0, 30));

  return filtered.length ? filtered : undefined;
};

const buildSearchQuery = (searchTerm) => {
  if (!searchTerm) return undefined;
  const regex = new RegExp(String(searchTerm).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  return {
    $or: [
      { title: regex },
      { description: regex },
      { category: regex },
      { counterpartyName: regex },
      { referenceNumber: regex },
      { tags: regex }
    ]
  };
};

exports.createEntry = async (req, res) => {
  const sellerId = req.user?.id;
  if (!sellerId) {
    return res.status(401).json({ message: 'ابتدا وارد حساب کاربری خود شوید.' });
  }

  try {
    const {
      title,
      type,
      amount,
      description,
      recordedAt,
      category,
      paymentMethod,
      status,
      counterpartyType,
      counterpartyName,
      referenceNumber,
      dueDate,
      tags
    } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json(formatValidationError('عنوان تراکنش الزامی است.'));
    }

    if (!TRANSACTION_TYPES.includes(type)) {
      return res.status(400).json(formatValidationError('نوع تراکنش معتبر نیست.'));
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(400).json(formatValidationError('مبلغ تراکنش نامعتبر است.'));
    }

    let normalizedCategory = 'عمومی';
    if (category && typeof category === 'string') {
      normalizedCategory = category.trim().slice(0, 60) || 'عمومی';
    }

    let normalizedPaymentMethod = 'cash';
    if (paymentMethod && PAYMENT_METHODS.includes(paymentMethod)) {
      normalizedPaymentMethod = paymentMethod;
    }

    let normalizedStatus = 'paid';
    if (status && PAYMENT_STATUS.includes(status)) {
      normalizedStatus = status;
    }

    let normalizedCounterpartyType = 'customer';
    if (counterpartyType && COUNTERPARTY_TYPES.includes(counterpartyType)) {
      normalizedCounterpartyType = counterpartyType;
    }

    const normalizedCounterpartyName = counterpartyName
      ? String(counterpartyName).trim().slice(0, 120)
      : undefined;

    const normalizedReferenceNumber = referenceNumber
      ? String(referenceNumber).trim().slice(0, 80)
      : undefined;

    let entryDate = recordedAt ? new Date(recordedAt) : new Date();
    if (Number.isNaN(entryDate.getTime())) {
      return res.status(400).json(formatValidationError('تاریخ تراکنش نامعتبر است.'));
    }

    let normalizedDueDate;
    if (dueDate) {
      const due = new Date(dueDate);
      if (Number.isNaN(due.getTime())) {
        return res.status(400).json(formatValidationError('تاریخ سررسید نامعتبر است.'));
      }
      normalizedDueDate = due;
    }

    const sanitizedTags = sanitizeTags(tags);

    const entry = await AccountantEntry.create({
      seller: sellerId,
      title: title.trim(),
      type,
      category: normalizedCategory,
      amount: numericAmount,
      paymentMethod: normalizedPaymentMethod,
      status: normalizedStatus,
      counterpartyType: normalizedCounterpartyType,
      counterpartyName: normalizedCounterpartyName,
      referenceNumber: normalizedReferenceNumber,
      description: description ? String(description).trim() : undefined,
      recordedAt: entryDate,
      dueDate: normalizedDueDate,
      tags: sanitizedTags
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
    const { from, to, type, category, status, paymentMethod, search } = req.query || {};

    const baseFilter = { seller: sellerId };

    if (type && TRANSACTION_TYPES.includes(type)) {
      baseFilter.type = type;
    }

    if (category && typeof category === 'string' && category.trim()) {
      baseFilter.category = category.trim();
    }

    if (status && PAYMENT_STATUS.includes(status)) {
      baseFilter.status = status;
    }

    if (paymentMethod && PAYMENT_METHODS.includes(paymentMethod)) {
      baseFilter.paymentMethod = paymentMethod;
    }

    const recordedAtFilter = {};
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        recordedAtFilter.$gte = fromDate;
      }
    }

    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        recordedAtFilter.$lte = toDate;
      }
    }

    if (Object.keys(recordedAtFilter).length) {
      baseFilter.recordedAt = recordedAtFilter;
    }

    const searchQuery = buildSearchQuery(search);
    const mongoQuery = searchQuery ? { $and: [baseFilter, searchQuery] } : baseFilter;

    const entries = await AccountantEntry.find(mongoQuery)
      .sort({ recordedAt: -1, createdAt: -1 })
      .lean();

    const totals = {
      income: 0,
      expense: 0,
      balance: 0
    };

    const statusCounts = {
      paid: 0,
      pending: 0,
      overdue: 0,
      refunded: 0
    };

    const statusAmounts = {
      paid: 0,
      pending: 0,
      overdue: 0,
      refunded: 0
    };

    const categoryTotals = new Map();
    const paymentTotals = new Map();
    const upcomingDue = [];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    entries.forEach((entry) => {
      const amount = Number(entry.amount) || 0;

      if (entry.type === 'income') {
        totals.income += amount;
      } else if (entry.type === 'expense') {
        totals.expense += amount;
      }

      const dueDate = entry.dueDate ? new Date(entry.dueDate) : null;
      let computedStatus = PAYMENT_STATUS.includes(entry.status) ? entry.status : 'paid';
      if (computedStatus === 'pending' && dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < startOfToday) {
        computedStatus = 'overdue';
      }

      entry.computedStatus = computedStatus;

      statusCounts[computedStatus] = (statusCounts[computedStatus] || 0) + 1;
      statusAmounts[computedStatus] = (statusAmounts[computedStatus] || 0) + amount;

      const categoryKey = entry.category && entry.category.trim() ? entry.category.trim() : 'عمومی';
      categoryTotals.set(categoryKey, (categoryTotals.get(categoryKey) || 0) + amount);

      const paymentKey = PAYMENT_METHODS.includes(entry.paymentMethod) ? entry.paymentMethod : 'other';
      paymentTotals.set(paymentKey, (paymentTotals.get(paymentKey) || 0) + amount);

      if (
        dueDate &&
        !Number.isNaN(dueDate.getTime()) &&
        computedStatus !== 'paid' &&
        dueDate >= startOfToday
      ) {
        upcomingDue.push({
          id: entry._id,
          title: entry.title,
          dueDate,
          amount,
          counterpartyName: entry.counterpartyName,
          status: computedStatus
        });
      }
    });

    totals.balance = totals.income - totals.expense;

    const categories = Array.from(categoryTotals.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const paymentMethodsSummary = Array.from(paymentTotals.entries())
      .map(([method, total]) => ({ method, total }))
      .sort((a, b) => b.total - a.total);

    const upcomingDueSummary = upcomingDue
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 5);

    const summary = {
      totals,
      counts: {
        total: entries.length,
        paid: statusCounts.paid || 0,
        pending: statusCounts.pending || 0,
        overdue: statusCounts.overdue || 0,
        refunded: statusCounts.refunded || 0
      },
      amountsByStatus: {
        paid: statusAmounts.paid || 0,
        pending: statusAmounts.pending || 0,
        overdue: statusAmounts.overdue || 0,
        refunded: statusAmounts.refunded || 0
      },
      categories,
      paymentMethods: paymentMethodsSummary,
      upcomingDue: upcomingDueSummary
    };

    res.json({ entries, summary });
  } catch (err) {
    console.error('Error fetching accountant entries:', err);
    res.status(500).json({ message: 'خطا در دریافت اطلاعات حسابداری.' });
  }
};
