// controllers/sellerPlanController.js
const SellerPlan = require('../models/sellerPlan');

exports.getMyPlans = async (req, res) => {
  try {
    const sellerId = req.user.id; // فرض: seller اومده توکن زده
    const plans = await SellerPlan.find({ sellerId }).sort({ startDate: -1 }).lean();

    res.json({
      success: true,
      plans: plans.map(plan => ({
        title: plan.planTitle,
        price: plan.price,
        startDate: plan.startDate,
        endDate: plan.endDate,
        active: plan.status === 'active',
        description: plan.description || ''
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در دریافت پلن‌ها' });
  }
};
