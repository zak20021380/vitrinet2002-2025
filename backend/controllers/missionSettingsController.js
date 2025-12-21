const MissionSetting = require('../models/MissionSettings');

/**
 * Get all mission settings (Admin)
 */
exports.getAllMissions = async (req, res) => {
  try {
    // Initialize defaults if needed
    await MissionSetting.initializeDefaults();
    
    const missions = await MissionSetting.find().sort({ category: 1, order: 1 });
    
    // Group by category
    const grouped = missions.reduce((acc, mission) => {
      if (!acc[mission.category]) {
        acc[mission.category] = [];
      }
      acc[mission.category].push(mission);
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: grouped,
      missions: missions
    });
  } catch (error) {
    console.error('Error fetching mission settings:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در دریافت تنظیمات ماموریت‌ها'
    });
  }
};

/**
 * Update a single mission setting (Admin)
 */
exports.updateMission = async (req, res) => {
  try {
    const { missionId } = req.params;
    const { amount, isActive } = req.body;
    
    const updateData = {};
    if (typeof amount === 'number' && amount >= 0) {
      updateData.amount = amount;
    }
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }
    
    const mission = await MissionSetting.findOneAndUpdate(
      { missionId },
      { $set: updateData },
      { new: true }
    );
    
    if (!mission) {
      return res.status(404).json({
        success: false,
        error: 'ماموریت یافت نشد'
      });
    }
    
    res.json({
      success: true,
      data: mission
    });
  } catch (error) {
    console.error('Error updating mission setting:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در بروزرسانی تنظیمات ماموریت'
    });
  }
};

/**
 * Bulk update mission settings (Admin)
 */
exports.bulkUpdateMissions = async (req, res) => {
  try {
    const { missions } = req.body;
    
    if (!Array.isArray(missions)) {
      return res.status(400).json({
        success: false,
        error: 'فرمت داده نامعتبر است'
      });
    }
    
    const bulkOps = missions.map(m => ({
      updateOne: {
        filter: { missionId: m.missionId },
        update: {
          $set: {
            amount: m.amount,
            isActive: m.isActive
          }
        }
      }
    }));
    
    await MissionSetting.bulkWrite(bulkOps);
    
    // Fetch updated data
    const updated = await MissionSetting.find().sort({ category: 1, order: 1 });
    
    res.json({
      success: true,
      message: 'تنظیمات با موفقیت ذخیره شد',
      data: updated
    });
  } catch (error) {
    console.error('Error bulk updating mission settings:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در ذخیره تنظیمات'
    });
  }
};

/**
 * Get active missions for users (Public API)
 */
exports.getActiveMissionsForUsers = async (req, res) => {
  try {
    await MissionSetting.initializeDefaults();
    
    const missions = await MissionSetting.find({
      category: 'users',
      isActive: true
    }).sort({ order: 1 }).select('missionId title description amount icon cardStyle');
    
    res.json({
      success: true,
      data: missions
    });
  } catch (error) {
    console.error('Error fetching user missions:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در دریافت ماموریت‌ها'
    });
  }
};

/**
 * Get active missions for product sellers (Public API)
 */
exports.getActiveMissionsForProductSellers = async (req, res) => {
  try {
    await MissionSetting.initializeDefaults();
    
    const missions = await MissionSetting.find({
      category: 'product-sellers',
      isActive: true
    }).sort({ order: 1 }).select('missionId title description amount icon cardStyle');
    
    res.json({
      success: true,
      data: missions
    });
  } catch (error) {
    console.error('Error fetching seller missions:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در دریافت ماموریت‌ها'
    });
  }
};

/**
 * Get active missions for service sellers (Public API)
 */
exports.getActiveMissionsForServiceSellers = async (req, res) => {
  try {
    await MissionSetting.initializeDefaults();
    
    const missions = await MissionSetting.find({
      category: 'service-sellers',
      isActive: true
    }).sort({ order: 1 }).select('missionId title description amount icon cardStyle');
    
    res.json({
      success: true,
      data: missions
    });
  } catch (error) {
    console.error('Error fetching service seller missions:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در دریافت ماموریت‌ها'
    });
  }
};

/**
 * Get mission reward amount by ID (for internal use)
 */
exports.getMissionReward = async (missionId) => {
  try {
    const mission = await MissionSetting.findOne({ missionId, isActive: true });
    return mission ? mission.amount : 0;
  } catch (error) {
    console.error('Error getting mission reward:', error);
    return 0;
  }
};

/**
 * Reset missions to defaults (Admin)
 */
exports.resetToDefaults = async (req, res) => {
  try {
    await MissionSetting.deleteMany({});
    await MissionSetting.initializeDefaults();
    
    const missions = await MissionSetting.find().sort({ category: 1, order: 1 });
    
    res.json({
      success: true,
      message: 'تنظیمات به حالت پیش‌فرض بازگردانده شد',
      data: missions
    });
  } catch (error) {
    console.error('Error resetting mission settings:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در بازنشانی تنظیمات'
    });
  }
};
