const SellerRank = require('../models/SellerRank');
const SellerWallet = require('../models/SellerWallet');
const SellerStreak = require('../models/SellerStreak');
const Booking = require('../models/booking');
const Review = require('../models/Review');
const Seller = require('../models/Seller');

/**
 * محاسبه و آپدیت رتبه یک فروشنده
 */
const calculateSellerRank = async (sellerId) => {
  try {
    // دریافت اطلاعات فروشنده
    const seller = await Seller.findById(sellerId)
      .select('category subcategory storename shopurl')
      .lean();
    
    if (!seller) {
      throw new Error('فروشنده یافت نشد');
    }

    // دریافت موجودی کیف پول
    const wallet = await SellerWallet.findOne({ sellerId }).lean();
    const walletBalance = wallet?.balance || 0;

    // دریافت استریک
    const streak = await SellerStreak.findOne({ sellerId }).lean();
    const currentStreak = streak?.currentStreak || 0;
    const loyaltyPoints = streak?.loyaltyPoints || 0;

    // محاسبه تعداد نوبت‌ها
    const bookingStats = await Booking.aggregate([
      { $match: { sellerId: sellerId } },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          uniqueCustomers: { $addToSet: '$customerPhone' }
        }
      }
    ]);

    const bookingData = bookingStats[0] || {};
    const totalBookings = bookingData.totalBookings || 0;
    const completedBookings = bookingData.completedBookings || 0;
    const uniqueCustomers = bookingData.uniqueCustomers?.length || 0;

    // محاسبه میانگین امتیاز
    const reviewStats = await Review.aggregate([
      { $match: { sellerId: sellerId, approved: true } },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$score' },
          count: { $sum: 1 }
        }
      }
    ]);

    const reviewData = reviewStats[0] || {};
    const ratingAverage = Math.round((reviewData.avgScore || 0) * 10) / 10;
    const ratingCount = reviewData.count || 0;

    // آپدیت یا ایجاد رکورد رتبه
    const rankData = await SellerRank.findOneAndUpdate(
      { sellerId },
      {
        $set: {
          metrics: {
            walletBalance,
            uniqueCustomers,
            totalBookings,
            completedBookings,
            ratingAverage,
            ratingCount,
            currentStreak,
            loyaltyPoints
          },
          category: seller.category || '',
          subcategory: seller.subcategory || '',
          calculatedAt: new Date(),
          isActive: true
        }
      },
      { upsert: true, new: true }
    );

    // محاسبه امتیاز کل
    rankData.calculateTotalScore();
    await rankData.save();

    return rankData;
  } catch (error) {
    console.error('calculateSellerRank error:', error);
    throw error;
  }
};

/**
 * آپدیت رتبه‌بندی همه فروشندگان در یک دسته‌بندی
 */
const updateCategoryRankings = async (category, subcategory = null) => {
  try {
    const match = { isActive: true };
    if (subcategory) {
      match.subcategory = subcategory;
    } else if (category) {
      match.category = category;
    }

    // دریافت همه فروشندگان دسته‌بندی مرتب شده بر اساس امتیاز
    const rankings = await SellerRank.find(match)
      .sort({ totalScore: -1 })
      .lean();

    const total = rankings.length;

    // آپدیت رتبه هر فروشنده
    const bulkOps = rankings.map((rank, index) => ({
      updateOne: {
        filter: { _id: rank._id },
        update: {
          $set: {
            rankInCategory: index + 1,
            totalInCategory: total
          }
        }
      }
    }));

    if (bulkOps.length > 0) {
      await SellerRank.bulkWrite(bulkOps);
    }

    return { updated: bulkOps.length, total };
  } catch (error) {
    console.error('updateCategoryRankings error:', error);
    throw error;
  }
};

/**
 * دریافت رتبه فروشنده فعلی
 */
exports.getMyRank = async (req, res) => {
  try {
    const sellerId = req.user?.id || req.user?._id;
    if (!sellerId) {
      return res.status(401).json({ message: 'احراز هویت نامعتبر است.' });
    }

    // ابتدا رتبه را محاسبه کن
    await calculateSellerRank(sellerId);

    // دریافت اطلاعات فروشنده
    const seller = await Seller.findById(sellerId)
      .select('category subcategory')
      .lean();

    // آپدیت رتبه‌بندی دسته‌بندی
    if (seller?.subcategory) {
      await updateCategoryRankings(seller.category, seller.subcategory);
    } else if (seller?.category) {
      await updateCategoryRankings(seller.category);
    }

    // دریافت رتبه آپدیت شده
    const rank = await SellerRank.findOne({ sellerId }).lean();

    if (!rank) {
      return res.json({
        rank: null,
        totalInCategory: 0,
        metrics: {
          walletBalance: 0,
          uniqueCustomers: 0,
          totalBookings: 0,
          completedBookings: 0,
          ratingAverage: 0,
          ratingCount: 0,
          currentStreak: 0,
          loyaltyPoints: 0
        },
        totalScore: 0,
        category: seller?.subcategory || seller?.category || 'خدمات',
        calculatedAt: new Date().toISOString()
      });
    }

    return res.json({
      rank: rank.rankInCategory,
      totalInCategory: rank.totalInCategory,
      metrics: rank.metrics,
      totalScore: rank.totalScore,
      category: rank.subcategory || rank.category || 'خدمات',
      calculatedAt: rank.calculatedAt
    });
  } catch (error) {
    console.error('getMyRank error:', error);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

/**
 * دریافت لیدربورد دسته‌بندی
 * فروشندگان هم‌دسته و هم‌زیرگروه با محاسبه رتبه کلی
 */
exports.getCategoryLeaderboard = async (req, res) => {
  try {
    const sellerId = req.user?.id || req.user?._id;
    if (!sellerId) {
      return res.status(401).json({ message: 'احراز هویت نامعتبر است.' });
    }

    const limit = Math.min(50, Math.max(3, parseInt(req.query.limit) || 10));

    // دریافت اطلاعات فروشنده
    const seller = await Seller.findById(sellerId)
      .select('category subcategory storename shopurl city')
      .lean();

    if (!seller) {
      return res.status(404).json({ message: 'فروشنده یافت نشد.' });
    }

    // ابتدا رتبه فروشنده فعلی را محاسبه کن
    await calculateSellerRank(sellerId);

    // پیدا کردن همه فروشندگان هم‌دسته و هم‌زیرگروه
    const categoryMatch = { isActive: true };
    
    // فیلتر بر اساس دسته و زیرگروه - باید هر دو یکی باشد
    if (seller.category && seller.subcategory) {
      categoryMatch.category = seller.category;
      categoryMatch.subcategory = seller.subcategory;
    } else if (seller.category) {
      categoryMatch.category = seller.category;
    }

    // محاسبه رتبه همه فروشندگان در این دسته‌بندی
    await updateCategoryRankings(seller.category, seller.subcategory);

    // دریافت تعداد کل فروشندگان در این دسته‌بندی
    const total = await SellerRank.countDocuments(categoryMatch);

    // دریافت لیدربورد با مرتب‌سازی بر اساس امتیاز کل
    const leaderboard = await SellerRank.find(categoryMatch)
      .sort({ totalScore: -1, 'metrics.ratingAverage': -1, 'metrics.totalBookings': -1 })
      .limit(limit)
      .populate('sellerId', 'storename shopurl firstname lastname city')
      .lean();

    // دریافت رتبه فروشنده فعلی
    const myRank = await SellerRank.findOne({ sellerId }).lean();

    // ساخت لیست برترین‌ها با اطلاعات کامل
    const top = leaderboard.map((entry, index) => {
      const sellerInfo = entry.sellerId || {};
      const isMine = sellerInfo._id?.toString() === sellerId.toString();
      
      return {
        rank: index + 1,
        name: sellerInfo.storename || sellerInfo.shopurl || 
              `${sellerInfo.firstname || ''} ${sellerInfo.lastname || ''}`.trim() || 'فروشگاه',
        shopUrl: sellerInfo.shopurl || null,
        city: sellerInfo.city || '',
        score: Math.round(entry.totalScore * 10) / 10,
        metrics: {
          walletBalance: entry.metrics?.walletBalance || 0,
          uniqueCustomers: entry.metrics?.uniqueCustomers || 0,
          totalBookings: entry.metrics?.totalBookings || 0,
          completedBookings: entry.metrics?.completedBookings || 0,
          ratingAverage: Math.round((entry.metrics?.ratingAverage || 0) * 10) / 10,
          ratingCount: entry.metrics?.ratingCount || 0,
          currentStreak: entry.metrics?.currentStreak || 0,
          loyaltyPoints: entry.metrics?.loyaltyPoints || 0
        },
        isMine,
        badges: {
          isPremium: (entry.metrics?.walletBalance || 0) >= 1000000,
          isFeatured: (entry.metrics?.ratingAverage || 0) >= 4.5 && (entry.metrics?.ratingCount || 0) >= 10,
          isTopRated: (entry.metrics?.ratingAverage || 0) >= 4.8,
          isActive: (entry.metrics?.currentStreak || 0) >= 7
        }
      };
    });

    // اطلاعات فروشنده فعلی
    const mineData = myRank ? {
      rank: myRank.rankInCategory || 0,
      name: seller.storename || seller.shopurl || 'فروشگاه شما',
      shopUrl: seller.shopurl,
      city: seller.city || '',
      score: Math.round(myRank.totalScore * 10) / 10,
      metrics: {
        walletBalance: myRank.metrics?.walletBalance || 0,
        uniqueCustomers: myRank.metrics?.uniqueCustomers || 0,
        totalBookings: myRank.metrics?.totalBookings || 0,
        completedBookings: myRank.metrics?.completedBookings || 0,
        ratingAverage: Math.round((myRank.metrics?.ratingAverage || 0) * 10) / 10,
        ratingCount: myRank.metrics?.ratingCount || 0,
        currentStreak: myRank.metrics?.currentStreak || 0,
        loyaltyPoints: myRank.metrics?.loyaltyPoints || 0
      },
      badges: {
        isPremium: (myRank.metrics?.walletBalance || 0) >= 1000000,
        isFeatured: (myRank.metrics?.ratingAverage || 0) >= 4.5 && (myRank.metrics?.ratingCount || 0) >= 10,
        isTopRated: (myRank.metrics?.ratingAverage || 0) >= 4.8,
        isActive: (myRank.metrics?.currentStreak || 0) >= 7
      }
    } : null;

    // توضیح نحوه محاسبه امتیاز
    const scoreExplanation = {
      formula: '(امتیاز × ۲۰) + (نوبت × ۲) + (مشتری × ۳) + (اعتبار ÷ ۱۰۰۰) + (استریک × ۵)',
      weights: {
        rating: 20,
        bookings: 2,
        customers: 3,
        wallet: 0.001,
        streak: 5
      }
    };

    return res.json({
      top,
      mine: mineData,
      total,
      category: seller.category || 'خدمات',
      subcategory: seller.subcategory || '',
      scope: seller.subcategory ? 'subcategory' : 'category',
      scoreExplanation,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('getCategoryLeaderboard error:', error);
    return res.status(500).json({ message: 'خطای داخلی سرور.' });
  }
};

/**
 * بازمحاسبه رتبه (برای استفاده داخلی)
 */
exports.recalculateRank = async (sellerId) => {
  return calculateSellerRank(sellerId);
};

/**
 * آپدیت رتبه بعد از تغییر معیارها
 */
exports.triggerRankUpdate = async (sellerId) => {
  try {
    await calculateSellerRank(sellerId);
    
    const seller = await Seller.findById(sellerId)
      .select('category subcategory')
      .lean();
    
    if (seller?.subcategory) {
      await updateCategoryRankings(seller.category, seller.subcategory);
    } else if (seller?.category) {
      await updateCategoryRankings(seller.category);
    }
    
    return true;
  } catch (error) {
    console.error('triggerRankUpdate error:', error);
    return false;
  }
};
