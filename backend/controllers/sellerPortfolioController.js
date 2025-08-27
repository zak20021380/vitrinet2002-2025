const Seller = require('../models/Seller');
const SellerPortfolio = require('../models/seller-portfolio');

// Get portfolio items by shop URL (public)
exports.getPortfolioByShopUrl = async (req, res) => {
  try {
    const { shopurl } = req.params;
    
    const seller = await Seller.findOne({ shopurl }).select('_id');
    if (!seller) {
      return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    }

    const items = await SellerPortfolio.find({ 
      sellerId: seller._id, 
      isActive: true 
    }).sort({ order: 1, createdAt: -1 });

    return res.json({ items });
  } catch (err) {
    console.error('getPortfolioByShopUrl error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
};

// Get my portfolio items
exports.getMyPortfolio = async (req, res) => {
  try {
    const items = await SellerPortfolio.find({ 
      sellerId: req.user.id 
    }).sort({ order: 1, createdAt: -1 });

    return res.json({ items });
  } catch (err) {
    console.error('getMyPortfolio error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
};

// Create portfolio item
exports.createPortfolioItem = async (req, res) => {
  try {
    const { title, description, image } = req.body;
    
    if (!title || !image) {
      return res.status(400).json({ message: 'عنوان و تصویر الزامی است' });
    }

    const item = await SellerPortfolio.create({
      sellerId: req.user.id,
      title,
      description,
      image,
      isActive: true
    });

    return res.status(201).json({ item });
  } catch (err) {
    console.error('createPortfolioItem error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
};

// Update portfolio item
exports.updatePortfolioItem = async (req, res) => {
  try {
    const item = await SellerPortfolio.findOne({ 
      _id: req.params.id, 
      sellerId: req.user.id 
    });

    if (!item) {
      return res.status(404).json({ message: 'آیتم پیدا نشد' });
    }

    const { title, description, image, isActive } = req.body;
    
    if (title) item.title = title;
    if (description !== undefined) item.description = description;
    if (image) item.image = image;
    if (isActive !== undefined) item.isActive = isActive;

    await item.save();
    return res.json({ item });
  } catch (err) {
    console.error('updatePortfolioItem error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
};

// Delete portfolio item
exports.deletePortfolioItem = async (req, res) => {
  try {
    const result = await SellerPortfolio.deleteOne({ 
      _id: req.params.id, 
      sellerId: req.user.id 
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'آیتم پیدا نشد' });
    }

    return res.json({ message: 'حذف شد' });
  } catch (err) {
    console.error('deletePortfolioItem error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
};