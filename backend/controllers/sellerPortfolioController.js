const mongoose = require('mongoose');
const Seller = require('../models/Seller');
const SellerPortfolio = require('../models/seller-portfolio');
const PortfolioLike = require('../models/portfolio-like');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'vitrinet_secret_key';

function getUserId(req) {
  try {
    let token = null;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies) {
      token = req.cookies.user_token || req.cookies.seller_token || req.cookies.admin_token || req.cookies.access_token;
    }
    if (!token) return null;
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.id;
  } catch (_) {
    return null;
  }
}

// Get portfolio items by shop URL (public)
exports.getPortfolioByShopUrl = async (req, res) => {
  try {
    const { shopurl } = req.params;
    
    const seller = await Seller.findOne({ shopurl }).select('_id');
    if (!seller) {
      return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    }

    const userId = getUserId(req);
    const itemsRaw = await SellerPortfolio.find({
      sellerId: seller._id,
      isActive: true
    }).sort({ order: 1, createdAt: -1 }).lean();

    let likedSet = new Set();
    if (userId && itemsRaw.length) {
      const ids = itemsRaw.map(it => it._id);
      const likes = await PortfolioLike.find({ portfolioId: { $in: ids }, userId })
        .select('portfolioId').lean();
      likedSet = new Set(likes.map(l => l.portfolioId.toString()));
    }

    const items = itemsRaw.map(it => ({
      ...it,
      likeCount: it.likeCount || 0,
      liked: likedSet.has(it._id.toString())
    }));

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
    }).sort({ order: 1, createdAt: -1 }).lean();

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


// Get portfolio items by shop URL (query parameter version)
exports.getPortfolioByShopUrlQuery = async (req, res) => {
  try {
    const { shopurl } = req.query;
    
    if (!shopurl) {
      return res.status(400).json({ message: 'پارامتر shopurl الزامی است' });
    }
    
    const seller = await Seller.findOne({ shopurl }).select('_id');
    if (!seller) {
      return res.status(404).json({ message: 'فروشنده پیدا نشد.' });
    }

    const userId = getUserId(req);
    const itemsRaw = await SellerPortfolio.find({
      sellerId: seller._id,
      isActive: true
    }).sort({ order: 1, createdAt: -1 }).lean();

    let likedSet = new Set();
    if (userId && itemsRaw.length) {
      const ids = itemsRaw.map(it => it._id);
      const likes = await PortfolioLike.find({ portfolioId: { $in: ids }, userId })
        .select('portfolioId').lean();
      likedSet = new Set(likes.map(l => l.portfolioId.toString()));
    }

    const items = itemsRaw.map(it => ({
      ...it,
      likeCount: it.likeCount || 0,
      liked: likedSet.has(it._id.toString())
    }));

    return res.json({ items });
  } catch (err) {
    console.error('getPortfolioByShopUrlQuery error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
};

// Toggle like/unlike portfolio item
exports.toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }

    const portfolio = await SellerPortfolio.findById(id).select('isActive');
    if (!portfolio || !portfolio.isActive) {
      return res.status(404).json({ message: 'آیتم پیدا نشد' });
    }

    const userId = req.user.id;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await PortfolioLike.create([{ portfolioId: id, userId }], { session });
      const updated = await SellerPortfolio.findByIdAndUpdate(
        id,
        { $inc: { likeCount: 1 } },
        { new: true, session, projection: { likeCount: 1 } }
      );
      await session.commitTransaction();
      return res.json({ liked: true, likeCount: updated.likeCount });
    } catch (err) {
      if (err.code === 11000) {
        try {
          await PortfolioLike.deleteOne({ portfolioId: id, userId }, { session });
          const updated = await SellerPortfolio.findByIdAndUpdate(
            id,
            { $inc: { likeCount: -1 } },
            { new: true, session, projection: { likeCount: 1 } }
          );
          await session.commitTransaction();
          return res.json({ liked: false, likeCount: updated.likeCount });
        } catch (inner) {
          await session.abortTransaction();
          console.error('toggleLike error:', inner);
          return res.status(500).json({ message: 'خطای سرور' });
        }
      }
      await session.abortTransaction();
      console.error('toggleLike error:', err);
      return res.status(500).json({ message: 'خطای سرور' });
    } finally {
      session.endSession();
    }
  } catch (err) {
    console.error('toggleLike error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
};
