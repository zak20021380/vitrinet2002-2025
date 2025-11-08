const express = require('express');
const RewardCampaign = require('../models/RewardCampaign');

const router = express.Router();

async function getOrCreateCampaign() {
  const campaign = await syncCampaignState();
  return campaign.toObject();
}

function maskPhoneNumber(raw) {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  const first = digits.slice(0, Math.min(4, digits.length));
  const last = digits.length > 4 ? digits.slice(-4) : '';
  const revealedLength = first.length + last.length;
  let hiddenLength = Math.max(0, digits.length - revealedLength);
  if (hiddenLength === 0) {
    hiddenLength = digits.length >= 8 ? 4 : Math.max(0, 8 - revealedLength);
  }
  const mask = '•'.repeat(Math.max(hiddenLength, 4));
  return `${first}${mask}${last}`;
}

function normaliseWinner(entry = {}, { includePhone = false } = {}) {
  if (!entry) return null;
  const id = entry._id ? String(entry._id) : entry.id ? String(entry.id) : '';
  const firstName = entry.firstName ? String(entry.firstName).trim() : '';
  const lastName = entry.lastName ? String(entry.lastName).trim() : '';
  const digits = String(entry.phone || '').replace(/[^0-9]/g, '');
  const masked = maskPhoneNumber(digits || entry.phone);

  const payload = {
    id,
    firstName,
    lastName,
    phoneMasked: masked || '',
    createdAt: entry.createdAt || null
  };

  if (includePhone) {
    payload.phone = digits || String(entry.phone || '').trim();
  }

  return payload;
}

function normaliseCampaign(doc = {}, { includePrivateWinners = false } = {}) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const usedCodes = Array.isArray(plain.codes)
    ? plain.codes.filter(code => code && code.used).length
    : 0;
  const winnersList = buildWinnerList(plain, includePrivateWinners);
  const capacity = Math.max(0, Number(plain.capacity || 0));
  const winnersClaimed = Math.min(
    capacity,
    Math.max(Number(plain.winnersClaimed || 0), usedCodes, winnersList.length)
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
    showButton: plain.showButton !== undefined ? Boolean(plain.showButton) : true,
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
    winners: winnersList,
    updatedAt: plain.updatedAt || null,
    createdAt: plain.createdAt || null
  };
}

function buildWinnerList(doc, includePhone = false) {
  if (!doc || !Array.isArray(doc.winners)) return [];
  return doc.winners
    .map(winner => normaliseWinner(winner, { includePhone }))
    .filter(Boolean);
}

async function syncCampaignState() {
  let doc = await RewardCampaign.findOne({ slug: 'default' });
  if (!doc) {
    doc = await RewardCampaign.create({ slug: 'default' });
    return doc;
  }
  const usedCodes = doc.codes.filter(code => code.used).length;
  const winnersCount = Array.isArray(doc.winners) ? doc.winners.length : 0;
  const normalisedCapacity = Math.max(0, Number(doc.capacity || 0));
  const desiredWinners = Math.max(Number(doc.winnersClaimed || 0), usedCodes, winnersCount);
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

router.get('/winners', async (req, res, next) => {
  try {
    const doc = await syncCampaignState();
    const winners = buildWinnerList(doc, true);
    res.json({ winners });
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
      active = false,
      showButton
    } = req.body || {};

    doc.title = String(title || '').trim();
    doc.description = String(description || '').trim();
    doc.prizeValue = Math.max(0, Number(prizeValue) || 0);
    doc.currency = String(currency || 'تومان').trim() || 'تومان';
    doc.capacity = Math.max(0, Number(capacity) || 0);
    doc.winnersClaimed = Math.max(0, Number(winnersClaimed) || 0);
    doc.active = Boolean(active);
    if (showButton !== undefined) {
      doc.showButton = Boolean(showButton);
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
    res.json({ campaign: normaliseCampaign(doc) });
  } catch (error) {
    next(error);
  }
});

router.post('/winners', async (req, res, next) => {
  try {
    const { firstName = '', lastName = '', phone = '' } = req.body || {};
    const normalisedFirstName = String(firstName || '').trim();
    const normalisedLastName = String(lastName || '').trim();
    const phoneDigits = String(phone || '').replace(/[^0-9]/g, '');

    if (!normalisedFirstName) {
      return res.status(400).json({ message: 'نام برنده الزامی است.' });
    }
    if (!normalisedLastName) {
      return res.status(400).json({ message: 'نام خانوادگی برنده الزامی است.' });
    }
    if (phoneDigits.length < 8) {
      return res.status(400).json({ message: 'شماره تلفن وارد شده معتبر نیست.' });
    }

    const doc = await syncCampaignState();
    doc.winners.push({
      firstName: normalisedFirstName,
      lastName: normalisedLastName,
      phone: phoneDigits,
      createdAt: new Date()
    });
    doc.markModified('winners');
    const usedCodes = doc.codes.filter(code => code.used).length;
    const winnersCount = doc.winners.length;
    doc.winnersClaimed = Math.max(Number(doc.winnersClaimed || 0), winnersCount, usedCodes);
    if (doc.capacity > 0 && doc.winnersClaimed > doc.capacity) {
      doc.winnersClaimed = doc.capacity;
    }
    doc.updatedAt = new Date();

    await doc.save();

    const winners = buildWinnerList(doc, true);
    const latestWinner = winners[winners.length - 1] || null;

    res.status(201).json({
      message: 'برنده جدید با موفقیت ثبت شد.',
      winner: latestWinner,
      winners,
      campaign: normaliseCampaign(doc)
    });
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

router.delete('/winners/:id', async (req, res, next) => {
  try {
    const winnerId = String(req.params.id || '').trim();
    if (!winnerId) {
      return res.status(400).json({ message: 'شناسه برنده معتبر نیست.' });
    }

    const doc = await syncCampaignState();
    const winnerDoc = doc.winners.id(winnerId);
    if (!winnerDoc) {
      return res.status(404).json({ message: 'برنده مورد نظر یافت نشد.' });
    }

    winnerDoc.deleteOne();
    doc.markModified('winners');

    const usedCodes = doc.codes.filter(code => code.used).length;
    const winnersCount = doc.winners.length;
    let desiredWinners = Math.max(Number(doc.winnersClaimed || 0), usedCodes, winnersCount);
    if (doc.capacity > 0 && desiredWinners > doc.capacity) {
      desiredWinners = doc.capacity;
    }
    doc.winnersClaimed = desiredWinners;

    doc.updatedAt = new Date();
    await doc.save();

    const winners = buildWinnerList(doc, true);

    res.json({
      message: 'برنده انتخابی حذف شد.',
      winners,
      campaign: normaliseCampaign(doc)
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

function hashString(str) {
  let hash = 0;
  if (!str || str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

router.get('/product-code', async (req, res, next) => {
  try {
    const { productId } = req.query;

    if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
      return res.status(400).json({
        message: 'شناسه محصول الزامی است.',
        code: null,
        active: false
      });
    }

    const doc = await syncCampaignState();

    if (!doc.active) {
      return res.json({
        message: 'کمپین جوایز در حال حاضر فعال نیست.',
        code: null,
        active: false,
        showButton: doc.showButton !== undefined ? doc.showButton : true
      });
    }

    if (!doc.showButton) {
      return res.json({
        message: 'دکمه کد جایزه غیرفعال است.',
        code: null,
        active: doc.active,
        showButton: false
      });
    }

    const availableCodes = doc.codes
      .filter(code => code && code.code && !code.used)
      .map((entry, index) => ({
        entry,
        order: hashString(`${entry.code}-${index}-${doc.updatedAt || ''}`)
      }))
      .sort((a, b) => a.order - b.order)
      .map(item => item.entry);

    if (availableCodes.length === 0) {
      return res.json({
        message: 'در حال حاضر کد جایزه‌ای موجود نیست.',
        code: null,
        active: doc.active,
        showButton: doc.showButton !== undefined ? doc.showButton : true,
        campaign: {
          title: doc.title || '',
          description: doc.description || '',
          prizeValue: doc.prizeValue || 0,
          currency: doc.currency || 'تومان'
        }
      });
    }

    const saltSource = [
      doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0,
      availableCodes.map(code => `${code.code}-${code.createdAt ? new Date(code.createdAt).getTime() : 0}`).join('|'),
      doc.codes.length
    ].join('|');

    const productHash = hashString(`${String(productId).trim()}-${saltSource}`);
    const distributionSpan = Math.max(availableCodes.length * 4, availableCodes.length + 1);
    const slot = distributionSpan > 0 ? productHash % distributionSpan : 0;

    if (slot >= availableCodes.length) {
      return res.json({
        message: 'این صفحه کد جایزه نداره، باید بری صفحه های دیگه رو بگردی',
        code: null,
        active: true,
        showButton: doc.showButton !== undefined ? doc.showButton : true,
        campaign: {
          title: doc.title || '',
          description: doc.description || '',
          prizeValue: doc.prizeValue || 0,
          currency: doc.currency || 'تومان'
        }
      });
    }

    const selectedCode = availableCodes[slot];

    res.json({
      code: selectedCode.code,
      active: true,
      showButton: doc.showButton !== undefined ? doc.showButton : true,
      campaign: {
        title: doc.title || '',
        description: doc.description || '',
        prizeValue: doc.prizeValue || 0,
        currency: doc.currency || 'تومان'
      }
    });
  } catch (error) {
    console.error('Error fetching product code:', error);
    next(error);
  }
});

module.exports = router;
