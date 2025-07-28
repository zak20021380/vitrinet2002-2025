const Payment = require('../models/payment');
const AdOrder = require('../models/AdOrder');
const Plan = require('../models/plan'); // مدل پلن اشتراک
const Seller = require('../models/Seller');
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
      const plan = await Plan.findOne({ slug: planSlug });
      if (!plan) {
        return res.status(404).json({ success: false, message: 'پلن اشتراک پیدا نشد.' });
      }
      // ثبت پرداخت تستی در دیتابیس (اگه خواستی)
      const payment = new Payment({
        planSlug,
        sellerId: req.user?.id || req.user?.sellerId,
        amount: plan.price,
        paymentStatus: 'completed',
        paymentMethod: 'test',
        type: 'sub'
      });
      await payment.save();

      // می‌تونی همینجا رکورد اشتراک بسازی یا وضعیت رو تغییر بدی

      return res.status(200).json({
        success: true,
        message: "پرداخت تستی با موفقیت انجام شد.",
        fake: true
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
      payment.paymentStatus = 'completed';
      payment.transactionId = transactionId;
      await payment.save();

      if (adOrder) {
        adOrder.status = 'paid';
        await adOrder.save();
      }
      // اگر خرید اشتراک بود (planSlug) اینجا وضعیت اشتراک رو فعال کن یا رکورد بساز

      return res.status(200).json({
        success: true,
        message: 'پرداخت با موفقیت انجام شد.',
        payment,
        adOrder,
      });
    } else {
      payment.paymentStatus = 'failed';
      await payment.save();

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
