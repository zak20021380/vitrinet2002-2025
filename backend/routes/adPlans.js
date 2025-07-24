const express = require('express');
const router = express.Router();
const AdPlan = require('../models/adPlan');

const DEFAULT_TITLES = {
  'ad_search':   'تبلیغ جستجو',
  'ad_home':     'تبلیغ صفحه اول',
  'ad_products': 'تبلیغ بین محصولات'
};
const SLUGS = Object.keys(DEFAULT_TITLES);

/**
 * GET /api/adplans?sellerPhone=0912...
 * برمی‌گرداند: { adplans: { "ad_search": 80000, ... } }
 */
router.get('/', async (req, res) => {
  try {
    let sellerPhone = req.query.sellerPhone
      ? String(req.query.sellerPhone).trim()
      : null;

    if (sellerPhone) {
      sellerPhone = sellerPhone.replace(/\D/g, '');
      if (sellerPhone.length === 10 && sellerPhone.startsWith('9')) {
        sellerPhone = '0' + sellerPhone;
      }
    }

    // ۱) بخوان global
    const globalPlans = await AdPlan.find({
      slug: { $in: SLUGS },
      sellerPhone: null
    }).lean();

    // ۲) بخوان override
    const overridePlans = sellerPhone
      ? await AdPlan.find({
          slug: { $in: SLUGS },
          sellerPhone
        }).lean()
      : [];

    // ۳) merge (override اولویت دارد)
    const merged = {};
    SLUGS.forEach(slug => {
      merged[slug] = null;  // default null اگر نبود
    });
    globalPlans.forEach(p => {
      merged[p.slug] = p.price;
    });
    overridePlans.forEach(p => {
      merged[p.slug] = p.price;
    });

    return res.json({ success: true, adplans: merged });
  } catch (err) {
    console.error('Error fetching adplans:', err);
    return res.status(500).json({ success: false, message: 'خطا در دریافت تبلیغات' });
  }
});

/**
 * PUT /api/adplans/admin
 * body: {
 *   sellerPhone?: "0912...",
 *   "ad_search": 80000,
 *   "ad_home": 95000,
 *   ...
 * }
 */
router.put('/admin', async (req, res) => {
  try {
    let sellerPhone = (req.body.sellerPhone || '').toString().trim() || null;

    const prices = req.body.prices || {};

    // نرمالایز phone اگر وجود داشت
    if (sellerPhone) {
      sellerPhone = sellerPhone.replace(/\D/g, '');  // حذف غیرعددی
      if (sellerPhone.length === 10 && sellerPhone.startsWith('9')) {
        sellerPhone = '0' + sellerPhone;
      }
      if (!/^09\d{9}$/.test(sellerPhone)) {
        return res.status(400).json({ success: false, message: 'فرمت شماره موبایل درست نیست (مثال: 09123456789).' });
      }
    }

    const updates = [];

    for (const slug of SLUGS) {
      const price = Number(prices[slug]);
      if (isNaN(price) || price <= 0) continue;

      updates.push(
        AdPlan.findOneAndUpdate(
          { slug, sellerPhone },
          { slug, title: DEFAULT_TITLES[slug], price, sellerPhone },
          { upsert: true, new: true }
        )
      );
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'هیچ قیمت معتبری ارسال نشد.' });
    }

    await Promise.all(updates);

    return res.json({
      success: true,
      message: `قیمت تبلیغات برای ${sellerPhone ? `فروشنده ${sellerPhone}` : 'همه'} با موفقیت ذخیره شد.`
    });
  } catch (err) {
    console.error('Error saving adplans:', err);
    return res.status(500).json({ success: false, message: 'خطا در ذخیره تبلیغات' });
  }
});

module.exports = router;