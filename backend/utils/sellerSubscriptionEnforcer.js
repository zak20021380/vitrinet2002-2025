const SellerPlan = require('../models/sellerPlan');
const Seller = require('../models/Seller');
const { cascadeDeleteSellerById } = require('./sellerDeletion');

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const GRACE_PERIOD_DAYS = 3;

let schedulerHandle = null;
let enforcementInProgress = false;

async function markExpiredPlans(now) {
  const updateResult = await SellerPlan.updateMany(
    {
      endDate: { $ne: null, $lte: now },
      status: { $ne: 'expired' }
    },
    { $set: { status: 'expired' } }
  );

  return updateResult.modifiedCount || updateResult.nModified || 0;
}

async function deactivateExpiredPremiums(now) {
  const updateResult = await Seller.updateMany(
    {
      isPremium: true,
      premiumUntil: { $ne: null, $lte: now }
    },
    {
      $set: { isPremium: false, premiumUntil: null }
    }
  );

  return updateResult.modifiedCount || updateResult.nModified || 0;
}

async function findSellersWithExpiredPlans(now) {
  const graceThreshold = new Date(now.getTime() - GRACE_PERIOD_DAYS * DAY_IN_MS);

  const aggregation = await SellerPlan.aggregate([
    {
      $group: {
        _id: '$sellerId',
        latestEndDate: { $max: '$endDate' },
        futurePlans: {
          $sum: {
            $cond: [{ $gt: ['$endDate', now] }, 1, 0]
          }
        },
        activePlans: {
          $sum: {
            $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
          }
        },
        pendingPlans: {
          $sum: {
            $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
          }
        }
      }
    },
    {
      $match: {
        latestEndDate: { $ne: null, $lte: graceThreshold },
        futurePlans: 0,
        activePlans: 0,
        pendingPlans: 0
      }
    }
  ]);

  if (!aggregation.length) {
    return [];
  }

  const sellerIds = aggregation
    .map(item => item._id)
    .filter(Boolean);

  if (!sellerIds.length) {
    return [];
  }

  const sellers = await Seller.find({
    _id: { $in: sellerIds },
    $or: [
      { premiumUntil: null },
      { premiumUntil: { $lte: now } }
    ]
  }).select('_id');

  return sellers.map(doc => doc._id);
}

async function enforceSellerSubscriptionPolicy(referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(now.getTime())) {
    throw new Error('Invalid reference date for subscription enforcement');
  }

  const [expiredPlansCount, deactivatedPremiums] = await Promise.all([
    markExpiredPlans(now),
    deactivateExpiredPremiums(now)
  ]);

  const sellerIdsForDeletion = await findSellersWithExpiredPlans(now);

  let deletedCount = 0;
  for (const sellerId of sellerIdsForDeletion) {
    try {
      const result = await cascadeDeleteSellerById(sellerId, { banReason: 'subscription-expired' });
      if (result.success) {
        deletedCount += 1;
        console.log(`🗑️  Seller ${sellerId.toString()} deleted due to expired subscription.`);
      }
    } catch (err) {
      console.error(`❌ Failed to delete seller ${sellerId} after subscription expiry:`, err);
    }
  }

  return {
    expiredPlansUpdated: expiredPlansCount,
    premiumsDeactivated: deactivatedPremiums,
    sellersDeleted: deletedCount
  };
}

function startSellerSubscriptionEnforcer(intervalHours = 6) {
  if (schedulerHandle) {
    return schedulerHandle;
  }

  const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;

  const runEnforcement = async () => {
    if (enforcementInProgress) return;
    enforcementInProgress = true;
    try {
      const summary = await enforceSellerSubscriptionPolicy();
      if (summary.sellersDeleted > 0) {
        console.log(`📦  Subscription enforcement removed ${summary.sellersDeleted} seller(s).`);
      }
    } catch (err) {
      console.error('❌ Subscription enforcement failed:', err);
    } finally {
      enforcementInProgress = false;
    }
  };

  runEnforcement();
  schedulerHandle = setInterval(runEnforcement, intervalMs);
  if (typeof schedulerHandle.unref === 'function') {
    schedulerHandle.unref();
  }
  return schedulerHandle;
}

module.exports = {
  enforceSellerSubscriptionPolicy,
  startSellerSubscriptionEnforcer
};
