const AdOrder = require('../models/AdOrder');
const { calculateExpiry } = require('./adDisplay');
const { getCleanupIntervalMs } = require('./adDisplayConfig');

let cleanupTimer = null;
let cleanupInProgress = false;

async function cleanupExpiredAds(referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(now.getTime())) {
    throw new Error('Invalid reference date for cleanup.');
  }

  const activeAds = await AdOrder.find({
    status: { $in: ['approved', 'paid'] },
    displayedAt: { $ne: null }
  }).select('_id status planSlug displayedAt displayDurationHours expiresAt bannerImage');

  const metadataUpdates = [];
  const expirations = [];

  activeAds.forEach(doc => {
    const { durationHours, expiresAt } = calculateExpiry(doc);
    if (!durationHours || !expiresAt) {
      return;
    }

    const currentExpiry = doc.expiresAt instanceof Date
      ? doc.expiresAt
      : doc.expiresAt
        ? new Date(doc.expiresAt)
        : null;

    if (expiresAt <= now) {
      expirations.push({
        id: doc._id,
        expiresAt,
        durationHours
      });
      return;
    }

    if (!currentExpiry || Math.abs(currentExpiry.getTime() - expiresAt.getTime()) > 1000) {
      metadataUpdates.push({
        id: doc._id,
        expiresAt,
        durationHours
      });
    }
  });

  if (metadataUpdates.length) {
    await Promise.all(metadataUpdates.map(item =>
      AdOrder.updateOne(
        { _id: item.id },
        {
          $set: {
            displayDurationHours: item.durationHours,
            expiresAt: item.expiresAt
          }
        }
      )
    ));
  }

  if (expirations.length) {
    await Promise.all(expirations.map(item =>
      AdOrder.updateOne(
        { _id: item.id },
        {
          $set: {
            status: 'expired',
            expiredAt: now,
            displayDurationHours: item.durationHours,
            expiresAt: item.expiresAt
          }
        }
      )
    ));
  }

  return {
    processed: activeAds.length,
    metadataUpdated: metadataUpdates.length,
    expired: expirations.length
  };
}

function startAdCleanupScheduler() {
  if (cleanupTimer) {
    return cleanupTimer;
  }

  const interval = getCleanupIntervalMs();
  if (!interval || interval <= 0) {
    console.warn('⚠️  Ad cleanup scheduler disabled due to invalid interval.');
    return null;
  }

  const runCleanup = async () => {
    if (cleanupInProgress) return;
    cleanupInProgress = true;
    try {
      const result = await cleanupExpiredAds();
      if (result.expired > 0) {
        console.log(`🧹  Ad cleanup: expired ${result.expired} ad(s).`);
      }
    } catch (err) {
      console.error('❌  Ad cleanup failed:', err);
    } finally {
      cleanupInProgress = false;
    }
  };

  runCleanup();
  cleanupTimer = setInterval(runCleanup, interval);
  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }
  return cleanupTimer;
}

module.exports = {
  cleanupExpiredAds,
  startAdCleanupScheduler
};
