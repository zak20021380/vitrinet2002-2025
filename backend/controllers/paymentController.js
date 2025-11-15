const Payment = require('../models/payment');
const AdOrder = require('../models/AdOrder');
const Plan = require('../models/plan'); // مدل پلن اشتراک
const Seller = require('../models/Seller');
const SellerPlan = require('../models/sellerPlan');
const { calcPremiumUntil } = require('../utils/premium');
const axios = require('axios'); // برای ارتباط با درگاه پرداخت (مثلاً زرین‌پال)

// درخواست پرداخت برای هر دو نوع سفارش: تبلیغ ویژه یا اشتراک فروشگاه
// درخواست پرداخت برای هر دو نوع سفارش: تبلیغ ویژه یا اشتراک فروشگاه (پرداخت فیک)
exports.createPaymentRequest = async (req, res) => {
  try {
    const { adOrderId, planSlug } = req.body;

    // پرداخت تبلیغ ویژه
    if (adOrderId) {
      const adOrder = await AdOrder.findById(adOrderId);
      if (!adOrder || adOrder.status !== 'pending') {
        return res.status(404).json({ success: false, message: 'سفارش تبلیغ پیدا نشد.' });
      }
      // ثبت پرداخت تستی در دیتابیس (اگه خواستی)
      const payment = new Payment({
        adOrderId: adOrder._id,
        sellerId: adOrder.sellerId,
        amount: adOrder.price,
        paymentStatus: 'completed', // چون تستی هست
        paymentMethod: 'zarinpal',
        type: 'ad'
      });
      await payment.save();

      // تغییر وضعیت سفارش تبلیغ
      adOrder.status = 'paid';
      await adOrder.save();

      return res.status(200).json({
        success: true,
        message: "پرداخت تستی با موفقیت انجام شد.",
        fake: true
      });
    }

    // پرداخت پلن اشتراک
    if (planSlug) {
      // -------------- خرید پلن اشتراک (ویتری‌پلاس) --------------
      const sellerId = req.user && req.user.id;
      if (!sellerId) {
        return res.status(401).json({ success: false, message: 'احراز هویت نامعتبر است.' });
      }

      if (typeof planSlug !== 'string') {
        return res.status(400).json({ success: false, message: 'شناسه پلن نامعتبر است.' });
      }

      // فقط به شناسه پلن اعتماد کن، قیمت از دیتابیس خوانده می‌شود
      const plan = await Plan.findOne({ slug: planSlug.trim() });
      if (!plan) {
        return res.status(404).json({ success: false, message: 'پلن اشتراک پیدا نشد.' });
      }

      // ایجاد رکورد پرداخت در وضعیت «در انتظار»
      const payment = await Payment.create({
        planSlug,
        sellerId,
        amount: plan.price,
        paymentStatus: 'pending',
        paymentMethod: 'zarinpal',
        type: 'sub'
      });

      // درگاه پرداخت واقعی را صدا بزن (در اینجا فیک)
      // برای تست، لینک کال‌بک موفق را برمی‌گردانیم
      const callbackUrl = `/api/payment/callback?status=success&paymentId=${payment._id}`;

      return res.status(200).json({
        success: true,
        url: callbackUrl,
        message: 'در حال هدایت به درگاه پرداخت...'
      });
    }

    return res.status(400).json({ success: false, message: 'پارامتر ورودی اشتباه است.' });
  } catch (err) {
    console.error('❌ خطا در پرداخت تستی:', err);
    res.status(500).json({ success: false, message: 'خطا در پرداخت تستی!' });
  }
};


// ارسال درخواست به درگاه پرداخت (زرین‌پال)
const sendPaymentRequestToGateway = async (amount, orderId) => {
  try {
    // مرچنت کد دوستت رو اینجا قرار بده
    const merchant_id = "d97f7648-614f-4025-bee2-5f3cda6d8fcd";

    const response = await axios.post('https://api.zarinpal.com/pg/v4/payment/request.json', {
      merchant_id,
      amount,
      callback_url: 'https://yourdomain.com/payment/callback', // آدرس برگشت صحیح خودت رو بذار!
      description: 'خرید تبلیغ یا اشتراک از ویترین‌نت',
      metadata: {
        order_id: orderId.toString()
      }
    }, {
      headers: {
        'content-type': 'application/json'
      }
    });

    if (response.data && response.data.data && response.data.data.code === 100) {
      // ساخت لینک پرداخت برای کاربر
      return "https://www.zarinpal.com/pg/StartPay/" + response.data.data.authority;
    } else {
      console.error('Zarinpal Error:', response.data);
    }
    return null;
  } catch (err) {
    console.error('خطا در ارسال درخواست به درگاه:', err.response?.data || err.message);
    return null;
  }
};


// مدیریت پاسخ درگاه پرداخت برای هر دو نوع سفارش
exports.handlePaymentCallback = async (req, res) => {
  try {
    const { status, transactionId, adOrderId, paymentId } = req.query;

    // اولویت با adOrderId (تبلیغ)، بعد paymentId (اشتراک)
    let payment, adOrder, planSlug;

    if (adOrderId) {
      adOrder = await AdOrder.findById(adOrderId);
      if (!adOrder) return res.status(404).json({ success: false, message: 'سفارش تبلیغ پیدا نشد.' });
      payment = await Payment.findOne({ adOrderId: adOrderId });
      if (!payment) return res.status(404).json({ success: false, message: 'پرداخت پیدا نشد.' });
    } else if (paymentId) {
      payment = await Payment.findById(paymentId);
      if (!payment) return res.status(404).json({ success: false, message: 'پرداخت پیدا نشد.' });
      planSlug = payment.planSlug;
      // اگر خواستی اینجا رکورد اشتراک بساز، یا وضعیت رو تغییر بده
    } else {
      return res.status(400).json({ success: false, message: 'اطلاعات بازگشتی نامعتبر.' });
    }

    if (status === 'success') {
      if (payment.paymentStatus !== 'pending') {
        return res.status(400).json({ success: false, message: 'پرداخت قبلاً پردازش شده است.' });
      }

      payment.paymentStatus = 'completed';
      payment.transactionId = transactionId;
      await payment.save();
      // TODO: ثبت رویداد پردازش پرداخت در PostHog پس از فعال‌سازی | TODO: Capture payment_processed after enabling PostHog
      // const { trackPaymentProcessed } = require('../utils/posthog-tracking');
      // await trackPaymentProcessed({ orderId: adOrder?._id || payment._id, status: payment.paymentStatus, amount: payment.amount });

      if (adOrder) {
        adOrder.status = 'paid';
        await adOrder.save();
      }

      // --- فعال‌سازی پریمیوم بعد از تایید پرداخت ---
      // ⚠️ هرگز به مقدار ارسالی از سمت فرانت اعتماد نکن؛
      // فقط پس از تایید موفق درگاه پرداخت، وضعیت پریمیوم ست می‌شود.
      if (payment.type === 'sub' && planSlug) {
        try {
          const plan = await Plan.findOne({ slug: planSlug });
          if (!plan) throw new Error('invalid plan');

          const seller = await Seller.findById(payment.sellerId);
          if (seller) {
            const now = new Date();
            const premiumUntil = calcPremiumUntil(plan, now);
            seller.isPremium = true;
            seller.premiumUntil = premiumUntil;
            await seller.save();

            // ثبت لاگ تغییر وضعیت
            console.log(`✅ Seller ${seller._id} upgraded to premium until ${premiumUntil.toISOString()}`);

            // ذخیره در جدول SellerPlan برای سوابق
            await SellerPlan.create({
              sellerId: seller._id,
              planSlug: plan.slug,
              planTitle: plan.title,
              price: plan.price,
              startDate: now,
              endDate: premiumUntil,
              status: 'active'
            });
          }
        } catch (err) {
          console.error('❌ خطا در فعال‌سازی اشتراک:', err);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Payment completed successfully.',
        payment,
        adOrder,
      });
    } else {
      payment.paymentStatus = 'failed';
      await payment.save();
      // TODO: اطلاع‌رسانی وضعیت ناموفق به PostHog | TODO: Report failed payment to PostHog
      // const { trackPaymentProcessed } = require('../utils/posthog-tracking');
      // await trackPaymentProcessed({ orderId: adOrder?._id || payment._id, status: payment.paymentStatus, amount: payment.amount });

      return res.status(200).json({
        success: false,
        message: 'پرداخت ناموفق بود.',
      });
    }
  } catch (err) {
    console.error('خطا در پردازش پاسخ پرداخت:', err);
    res.status(500).json({ success: false, message: 'خطا در پردازش پرداخت' });
  }
};
