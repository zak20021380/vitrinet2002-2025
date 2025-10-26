const {
  getRows,
  addRow,
  updateRow,
  removeRow,
  reorderRows,
  sanitiseText,
  normaliseCardPayload,
} = require('../utils/homeRowsStore');

const MAX_CARDS_PER_ROW = Number(process.env.HOME_ROWS_MAX_CARDS || 6) || 6;

exports.listRows = async (req, res) => {
  try {
    const rows = await getRows();
    const ordered = [...rows]
      .sort((a, b) => a.order - b.order)
      .map((row) => ({
        ...row,
        cards: Array.isArray(row.cards) ? row.cards.map((card) => normaliseCardPayload(card)) : [],
      }));
    res.json(ordered);
  } catch (err) {
    console.error('Failed to load home rows:', err);
    res.status(500).json({ message: 'خطا در دریافت ردیف‌ها.' });
  }
};

exports.createRow = async (req, res) => {
  try {
    const payload = {
      title: sanitiseText(req.body?.title),
      cards: Array.isArray(req.body?.cards) ? req.body.cards : [],
    };
    const actorId = req.user?.id || req.user?._id;
    const created = await addRow(payload, { maxCards: MAX_CARDS_PER_ROW, actorId });
    res.status(201).json(created);
  } catch (err) {
    console.error('Failed to create home row:', err);
    if (err?.message === 'ROW_TITLE_REQUIRED') {
      return res.status(400).json({ message: 'عنوان ردیف الزامی است.' });
    }
    if (err?.message === 'ROW_TITLE_DUPLICATE') {
      return res.status(409).json({ message: 'عنوان ردیف تکراری است.' });
    }
    if (err?.message === 'CARDS_INVALID' || err?.message === 'CARDS_MIN') {
      return res.status(400).json({ message: 'حداقل یک کارت لازم است.' });
    }
    if (err?.message === 'CARDS_MAX') {
      return res.status(400).json({ message: `حداکثر ${MAX_CARDS_PER_ROW} کارت می‌توانید اضافه کنید.` });
    }
    if (err?.message === 'CARD_TITLE_REQUIRED') {
      return res.status(400).json({ message: 'عنوان کارت الزامی است.' });
    }
    if (err?.message === 'CARD_LINK_REQUIRED') {
      return res.status(400).json({ message: 'لینک کارت معتبر نیست.' });
    }
    res.status(500).json({ message: 'خطا در ایجاد ردیف جدید.' });
  }
};

exports.updateRow = async (req, res) => {
  try {
    const payload = {
      title: req.body?.title,
      cards: Array.isArray(req.body?.cards) ? req.body.cards : undefined,
    };
    const actorId = req.user?.id || req.user?._id;
    const updated = await updateRow(req.params.id, payload, { maxCards: MAX_CARDS_PER_ROW, actorId });
    res.json(updated);
  } catch (err) {
    console.error('Failed to update home row:', err);
    if (err?.message === 'ROW_NOT_FOUND') {
      return res.status(404).json({ message: 'ردیف موردنظر یافت نشد.' });
    }
    if (err?.message === 'ROW_TITLE_REQUIRED') {
      return res.status(400).json({ message: 'عنوان ردیف الزامی است.' });
    }
    if (err?.message === 'ROW_TITLE_DUPLICATE') {
      return res.status(409).json({ message: 'عنوان ردیف تکراری است.' });
    }
    if (err?.message === 'CARDS_INVALID' || err?.message === 'CARDS_MIN') {
      return res.status(400).json({ message: 'حداقل یک کارت لازم است.' });
    }
    if (err?.message === 'CARDS_MAX') {
      return res.status(400).json({ message: `حداکثر ${MAX_CARDS_PER_ROW} کارت می‌توانید اضافه کنید.` });
    }
    if (err?.message === 'CARD_TITLE_REQUIRED') {
      return res.status(400).json({ message: 'عنوان کارت الزامی است.' });
    }
    if (err?.message === 'CARD_LINK_REQUIRED') {
      return res.status(400).json({ message: 'لینک کارت معتبر نیست.' });
    }
    res.status(500).json({ message: 'خطا در به‌روزرسانی ردیف.' });
  }
};

exports.deleteRow = async (req, res) => {
  try {
    const actorId = req.user?.id || req.user?._id;
    await removeRow(req.params.id, { actorId });
    res.status(204).send();
  } catch (err) {
    console.error('Failed to delete home row:', err);
    if (err?.message === 'ROW_NOT_FOUND') {
      return res.status(404).json({ message: 'ردیف یافت نشد.' });
    }
    res.status(500).json({ message: 'حذف ردیف با خطا مواجه شد.' });
  }
};

exports.reorderRows = async (req, res) => {
  try {
    const actorId = req.user?.id || req.user?._id;
    const ids = Array.isArray(req.body?.order) ? req.body.order : [];
    const reordered = await reorderRows(ids, { actorId });
    res.json(reordered);
  } catch (err) {
    console.error('Failed to reorder home rows:', err);
    if (err?.message === 'REORDER_PAYLOAD_INVALID' || err?.message === 'REORDER_IDS_MISMATCH') {
      return res.status(400).json({ message: 'ترتیب ارسالی معتبر نیست.' });
    }
    if (err?.message === 'ROW_NOT_FOUND') {
      return res.status(404).json({ message: 'ردیف یافت نشد.' });
    }
    res.status(500).json({ message: 'جا‌به‌جایی ردیف‌ها با خطا مواجه شد.' });
  }
};
