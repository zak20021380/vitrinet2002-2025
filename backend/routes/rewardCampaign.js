const express = require('express');
const RewardCampaign = require('../models/RewardCampaign');

const router = express.Router();

async function getOrCreateCampaign() {
  const campaign = await syncCampaignState();
  return campaign.toObject();
}

function normaliseCampaign(doc = {}) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const usedCodes = Array.isArray(plain.codes)
    ? plain.codes.filter(code => code && code.used).length
    : 0;
  const capacity = Math.max(0, Number(plain.capacity || 0));
  const winnersClaimed = Math.min(
    capacity,
    Math.max(Number(plain.winnersClaimed || 0), usedCodes)
  );

  return {
    id: String(plain._id || ''),
    title: plain.title || '',
    description: plain.description || '',
    prizeValue: Number(plain.prizeValue || 0),
    currency: plain.currency || 'تومان',
    capacity,
    winnersClaimed,
    active: Boolean(plain.active),
    codes: Array.isArray(plain.codes)
      ? plain.codes
          .filter(code => code && code.code)
          .map(code => ({
            code: code.code,
            note: code.note || '',
            used: Boolean(code.used),
            createdAt: code.createdAt || null,
            usedAt: code.usedAt || null
          }))
      : [],
    updatedAt: plain.updatedAt || null,
    createdAt: plain.createdAt || null
  };
}

async function syncCampaignState() {
  let doc = await RewardCampaign.findOne({ slug: 'default' });
  if (!doc) {
    doc = await RewardCampaign.create({ slug: 'default' });
    return doc;
  }
  const usedCodes = doc.codes.filter(code => code.used).length;
  const normalisedCapacity = Math.max(0, Number(doc.capacity || 0));
  const desiredWinners = Math.max(Number(doc.winnersClaimed || 0), usedCodes);
  let changed = false;
  if (doc.capacity !== normalisedCapacity) {
    doc.capacity = normalisedCapacity;
    changed = true;
  }
  let normalisedWinners = desiredWinners;
  if (normalisedCapacity > 0 && normalisedWinners > normalisedCapacity) {
    normalisedWinners = normalisedCapacity;
  }
  if (doc.winnersClaimed !== normalisedWinners) {
    doc.winnersClaimed = normalisedWinners;
    changed = true;
  }
  if (changed) {
    doc.updatedAt = new Date();
    await doc.save();
  }
  return doc;
}

router.get('/campaign', async (req, res, next) => {
  try {
    const campaign = await getOrCreateCampaign();
    res.json({ campaign: normaliseCampaign(campaign) });
  } catch (error) {
    next(error);
  }
});

router.put('/campaign', async (req, res, next) => {
  try {
    const doc = await syncCampaignState();
    const {
      title = '',
      description = '',
      prizeValue = 0,
      currency = 'تومان',
      capacity = 0,
      winnersClaimed = 0,
      active = false
    } = req.body || {};

    doc.title = String(title || '').trim();
    doc.description = String(description || '').trim();
    doc.prizeValue = Math.max(0, Number(prizeValue) || 0);
    doc.currency = String(currency || 'تومان').trim() || 'تومان';
    doc.capacity = Math.max(0, Number(capacity) || 0);
    doc.winnersClaimed = Math.max(0, Number(winnersClaimed) || 0);
    doc.active = Boolean(active);
    doc.updatedAt = new Date();

    const usedCodes = doc.codes.filter(code => code.used).length;
    if (doc.winnersClaimed < usedCodes) {
      doc.winnersClaimed = usedCodes;
    }
    if (doc.capacity > 0 && doc.winnersClaimed > doc.capacity) {
      doc.winnersClaimed = doc.capacity;
    }

    await doc.save();
    res.json({ campaign: normaliseCampaign(doc) });
  } catch (error) {
    next(error);
  }
});

router.post('/codes', async (req, res, next) => {
  try {
    const { code, note = '' } = req.body || {};
    const normalisedCode = String(code || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (normalisedCode.length !== 6) {
      return res.status(400).json({ message: 'کد باید ۶ رقمی باشد.' });
    }

    const doc = await syncCampaignState();
    if (doc.codes.some(entry => entry.code === normalisedCode)) {
      return res.status(409).json({ message: 'این کد قبلاً ثبت شده است.' });
    }

    doc.codes.push({
      code: normalisedCode,
      note: String(note || '').trim(),
      used: false,
      createdAt: new Date(),
      usedAt: null
    });
    doc.updatedAt = new Date();
    await doc.save();

    res.status(201).json({
      campaign: normaliseCampaign(doc),
      message: 'کد جدید با موفقیت افزوده شد.'
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/codes/:code', async (req, res, next) => {
  try {
    const codeValue = String(req.params.code || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (codeValue.length !== 6) {
      return res.status(400).json({ message: 'کد معتبر نیست.' });
    }

    const doc = await syncCampaignState();
    const entry = doc.codes.find(item => item.code === codeValue);
    if (!entry) {
      return res.status(404).json({ message: 'کد مورد نظر یافت نشد.' });
    }

    const { action = 'toggle', note } = req.body || {};
    if (action === 'toggle') {
      entry.used = !entry.used;
      entry.usedAt = entry.used ? new Date() : null;
    }
    if (typeof note === 'string') {
      entry.note = note.trim();
    }

    doc.updatedAt = new Date();
    const usedCodes = doc.codes.filter(code => code.used).length;
    if (doc.winnersClaimed < usedCodes) {
      doc.winnersClaimed = usedCodes;
    }
    if (doc.capacity > 0 && doc.winnersClaimed > doc.capacity) {
      doc.winnersClaimed = doc.capacity;
    }

    await doc.save();
    res.json({
      campaign: normaliseCampaign(doc),
      message: action === 'toggle'
        ? entry.used
          ? 'کد به عنوان استفاده شده علامت خورد.'
          : 'کد دوباره فعال شد.'
        : 'کد به‌روزرسانی شد.'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/codes/:code', async (req, res, next) => {
  try {
    const codeValue = String(req.params.code || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (codeValue.length !== 6) {
      return res.status(400).json({ message: 'کد معتبر نیست.' });
    }

    const doc = await syncCampaignState();
    const initialLength = doc.codes.length;
    doc.codes = doc.codes.filter(item => item.code !== codeValue);
    if (doc.codes.length === initialLength) {
      return res.status(404).json({ message: 'کد مورد نظر یافت نشد.' });
    }

    doc.markModified('codes');
    doc.updatedAt = new Date();
    const usedCodes = doc.codes.filter(code => code.used).length;
    if (doc.winnersClaimed < usedCodes) {
      doc.winnersClaimed = usedCodes;
    }
    if (doc.capacity > 0 && doc.winnersClaimed > doc.capacity) {
      doc.winnersClaimed = doc.capacity;
    }

    await doc.save();
    res.json({
      campaign: normaliseCampaign(doc),
      message: 'کد انتخابی حذف شد.'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/claim', async (req, res, next) => {
  try {
    const { code } = req.body || {};
    const normalisedCode = String(code || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (normalisedCode.length !== 6) {
      return res.status(400).json({ message: 'کد باید ۶ رقمی باشد.' });
    }

    const doc = await syncCampaignState();
    if (!doc.active) {
      return res.status(409).json({ message: 'کمپین در حال حاضر فعال نیست.' });
    }
    if (doc.capacity > 0 && doc.winnersClaimed >= doc.capacity) {
      return res.status(409).json({ message: 'ظرفیت کمپین تکمیل شده است.' });
    }

    const entry = doc.codes.find(item => item.code === normalisedCode);
    if (!entry) {
      return res.status(404).json({ message: 'کد وارد شده یافت نشد.' });
    }
    if (entry.used) {
      return res.status(409).json({ message: 'این کد قبلاً استفاده شده است.' });
    }

    entry.used = true;
    entry.usedAt = new Date();
    doc.winnersClaimed = Number(doc.winnersClaimed || 0) + 1;
    if (doc.capacity > 0 && doc.winnersClaimed > doc.capacity) {
      doc.winnersClaimed = doc.capacity;
    }
    doc.updatedAt = new Date();

    await doc.save();

    res.json({
      campaign: normaliseCampaign(doc),
      code: { code: entry.code, note: entry.note || '', usedAt: entry.usedAt },
      message: 'کد با موفقیت ثبت شد.'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
