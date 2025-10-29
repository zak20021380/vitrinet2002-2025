const mongoose = require('mongoose');
const Seller = require('../models/Seller');
const Product = require('../models/product');
const ShopAppearance = require('../models/ShopAppearance');
const SellerPlan = require('../models/sellerPlan');
const AdOrder = require('../models/AdOrder');
const Payment = require('../models/payment');
const Chat = require('../models/chat');
const Report = require('../models/Report');
const BannedPhone = require('../models/BannedPhone');
const { normalizePhone, buildDigitInsensitiveRegex } = require('./phone');

async function cascadeDeleteSeller(sellerDoc, options = {}) {
  if (!sellerDoc || !sellerDoc._id) {
    return { success: false, reason: 'invalid-seller' };
  }

  const sellerId = sellerDoc._id instanceof mongoose.Types.ObjectId
    ? sellerDoc._id
    : new mongoose.Types.ObjectId(sellerDoc._id);

  await Promise.all([
    Product.deleteMany({ sellerId }),
    ShopAppearance.deleteMany({ sellerId }),
    SellerPlan.deleteMany({ sellerId }),
    AdOrder.deleteMany({ sellerId }),
    Payment.deleteMany({ sellerId }),
    Chat.deleteMany({ sellerId }),
    Report.deleteMany({ sellerId }),
    Seller.deleteOne({ _id: sellerId })
  ]);

  const { banPhone = true, banReason = 'deleted-by-system' } = options;
  const phone = sellerDoc.phone;

  if (banPhone && phone) {
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone) {
      const regex = buildDigitInsensitiveRegex(phone);
      const query = { _id: { $ne: sellerId } };
      if (regex) {
        query.phone = { $regex: regex };
      } else {
        query.phone = normalizedPhone;
      }

      const duplicates = await Seller.countDocuments(query);
      if (duplicates > 0) {
        console.warn(`Skipping phone ban for seller ${sellerId} because phone is shared with ${duplicates} other seller(s).`);
      } else {
        await BannedPhone.updateOne(
          { phone: normalizedPhone },
          { $set: { phone: normalizedPhone, reason: banReason } },
          { upsert: true }
        );
      }
    }
  }

  return { success: true };
}

async function cascadeDeleteSellerById(sellerId, options = {}) {
  if (!sellerId) {
    return { success: false, reason: 'invalid-id' };
  }

  const seller = await Seller.findById(sellerId);
  if (!seller) {
    return { success: false, reason: 'not-found' };
  }

  const result = await cascadeDeleteSeller(seller, options);
  return { ...result, seller };
}

module.exports = {
  cascadeDeleteSeller,
  cascadeDeleteSellerById
};
