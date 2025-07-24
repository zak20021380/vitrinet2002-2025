const Plan = require('../models/plan');

// لیست ثابتِ پلن‌های اشتراک
const SUBSCRIPTION_PLANS = [
  { slug: '1month',  title: 'اشتراک ۱ ماهه'  },
  { slug: '3month',  title: 'اشتراک ۳ ماهه'  },
  { slug: '12month', title: 'اشتراک ۱۲ ماهه' }
];

/* ── GET  /api/plans ─────────────────────────────── */
/* خروجی: { plans : { "1month": 49000, ... } }       */
exports.getPlans = async (req, res) => {
  try {
    let { sellerPhone } = req.query;
    if (sellerPhone) {
      sellerPhone = sellerPhone.trim().replace(/\D/g, '');  // نرمالایز: فقط اعداد نگه دار
      if (sellerPhone.length === 10 && sellerPhone.startsWith('9')) sellerPhone = '0' + sellerPhone;
    }

    // ۱) پلن‌های سراسری
    const globalPlans = await Plan.find({
      slug: { $in: SUBSCRIPTION_PLANS.map(p => p.slug) },
      sellerPhone: null
    }).lean();

    // ۲) override‌های اختصاصی برای شماره‌ی داده‌شده
    const overridePlans = sellerPhone
      ? await Plan.find({
          slug: { $in: SUBSCRIPTION_PLANS.map(p => p.slug) },
          sellerPhone
        }).lean()
      : [];

    // ۳) merge (overrideها اولویت دارند)
    const merged = {};
    globalPlans.forEach(p => { merged[p.slug] = p.price; });
    overridePlans.forEach(p => { merged[p.slug] = p.price; });

    // ۴) اگر رکوردی نداشتیم، مقدار را null برگردانیم
    SUBSCRIPTION_PLANS.forEach(p => {
      if (merged[p.slug] === undefined) merged[p.slug] = null;
    });

    return res.json({ success: true, plans: merged });
  } catch (err) {
    console.error('getPlans ❌', err);
    return res.status(500).json({ success:false, message:'خطا در دریافت پلن‌ها' });
  }
};

/* ── PUT /api/plans/admin ─────────────────────────── */
/* بدنهٔ نمونه (global) :
   { "1month": 59000, "3month": 149000, "12month": 399000 }

   بدنهٔ نمونه (اختصاصی فروشنده) :
   { "sellerPhone": "09121234567", "1month": 69000, "3month": 179000 }
*/
exports.updatePlans = async (req, res) => {
  try {
    const body        = req.body || {};
    let   sellerPhone = (body.sellerPhone || '').toString().trim() || null;  // «» → null

    /* اگر شماره موبایل فرستاده شد، نرمالایز کن */
    if (sellerPhone) {
      sellerPhone = sellerPhone.replace(/\D/g, '');  // حذف غیرعددی
      if (sellerPhone.length === 10 && sellerPhone.startsWith('9')) {
        sellerPhone = '0' + sellerPhone;
      }
      if (!/^09\d{9}$/.test(sellerPhone)) {
        return res
          .status(400)
          .json({ success:false, message:'فرمت شماره موبایل درست نیست (مثال: 09123456789 یا 9123456789).' });
      }
    }

    const updates = [];

    /* فقط پلن‌هایی که قیمت معتبر (عدد > 0) دارند ذخیره می‌شوند */
    for (const planDef of SUBSCRIPTION_PLANS) {
      const price = Number(body[planDef.slug]);
      if (Number.isNaN(price) || price <= 0) continue;

      updates.push(
        Plan.findOneAndUpdate(
          { slug: planDef.slug, sellerPhone },         // ← فیلتر منحصربه‌فرد
          { $set: { title: planDef.title, price, sellerPhone } },
          { upsert: true, new: true }
        )
      );
    }

    if (!updates.length) {
      return res
        .status(400)
        .json({ success:false, message:'هیچ قیمت معتبری ارسال نشد.' });
    }

    await Promise.all(updates);

    return res.json({
      success : true,
      message : `پلن‌ها برای ${
        sellerPhone ? `فروشندهٔ ${sellerPhone}` : 'پلن سراسری'
      } با موفقیت ذخیره شدند.`
    });

  } catch (err) {
    console.error('updatePlans ❌', err);
    return res
      .status(500)
      .json({ success:false, message:'خطا در ذخیرهٔ پلن‌ها' });
  }
};