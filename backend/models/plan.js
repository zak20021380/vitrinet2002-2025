//-------------------------------------------------------------
//  مدل پلن‌های اشتراک (Global + Seller‑Specific)
//  • اگر sellerPhone === null  ⇒  قیمت و جزئیات عمومی (برای همه فروشنده‌ها)
//  • اگر sellerPhone یک شماره معتبر باشد ⇒  قیمت/جزئیات اختصاصی همان فروشنده
//-------------------------------------------------------------
const mongoose = require('mongoose');

const {
  SUBSCRIPTION_PLANS,
  getDefaultDurationDays,
  getDefaultDescription,
  getDefaultFeatures
} = require('../config/subscriptionPlans');

const VALID_SLUGS = SUBSCRIPTION_PLANS.map(plan => plan.slug);

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

    durationDays: {
      type: Number,
      min : [1, 'مدت زمان پلن باید حداقل ۱ روز باشد.'],
      max : [3650, 'مدت زمان پلن نمی‌تواند بیش از ۳۶۵۰ روز باشد.'],
      default() {
        return getDefaultDurationDays(this.slug) ?? 30;
      }
    },

    description: {
      type: String,
      trim: true,
      default() {
        return getDefaultDescription(this.slug);
      }
    },

    features: {
      type: [String],
      default() {
        return getDefaultFeatures(this.slug);
      },
      set(values) {
        if (!values) return [];
        const list = Array.isArray(values) ? values : String(values).split(/\r?\n/);
        return list
          .map(item => String(item || '').trim())
          .filter(Boolean)
          .slice(0, 12);
      }
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
