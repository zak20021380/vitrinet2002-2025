//-------------------------------------------------------------
//  مدل پلن‌های اشتراک (Global + Seller‑Specific)
//  • اگر sellerPhone === null  ⇒  قیمت عمومی (برای همه فروشنده‌ها)
//  • اگر sellerPhone یک شماره معتبر باشد ⇒  قیمت اختصاصی همان فروشنده
//-------------------------------------------------------------
const mongoose = require('mongoose');

/* اسلاگ‌های مجاز – فقط برای جلوگیری از اشتباه تایپی در سرور  */
const VALID_SLUGS = ['1month', '3month', '12month'];

const planSchema = new mongoose.Schema(
  {
    slug: {
      type:     String,
      required: true,
      enum:     VALID_SLUGS,           // فقط مقادیر شناخته‌شده
      index:    true
    },

    title: {
      type:     String,
      required: true,
      trim:     true
    },

    price: {
      type:     Number,
      required: true,
      min:      [0, 'قیمت باید بزرگتر از ۰ باشد.']
    },

    /* null  ⇒  پلن سراسری    |    "09..." ⇒  پلن فروشنده */
    sellerPhone: {
      type:    String,
      default: null,
      index:   true,
      set: v => {
        // نرمالایز: رشته خالی یا undefined → null
        if (!v) return null;
        let p = String(v).trim().replace(/\D/g, '');  // فقط اعداد
        if (p.length === 10 && p.startsWith('9')) p = '0' + p;
        return (p.length === 11 && p.startsWith('09')) ? p : null;
      }
    }
  },
  {
    timestamps: true               // createdAt , updatedAt
  }
);

/* ایندکس یکتا: برای هر slug یک رکورد عمومی + رکوردهای اختصاصی فروشندگان */
planSchema.index({ slug: 1, sellerPhone: 1 }, { unique: true });

/* جلوگیری از OverwriteModelError در ری‌لودهای dev */
module.exports =
  mongoose.models.Plan || mongoose.model('Plan', planSchema);