// server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const chatRoutes   = require('./routes/chatRoutes');
const adminUserMessageRoutes = require('./routes/adminUserMessages');
const sellerRoutes = require('./routes/seller');
const adminRoutes  = require('./routes/adminRoutes');
const planRoutes   = require('./routes/plans');
const adPlanRoutes = require('./routes/adPlans');
const paymentRoutes = require('./routes/payment');
const settingsRoutes = require('./routes/settings');
const accountantRoutes = require('./routes/accountant');
const categoryRoutes = require('./routes/categoryRoutes');
const securityRoutes = require('./routes/security');
require('dotenv').config();

const app = express();
const cookieParser = require('cookie-parser');
const path = require('path');
const dailyVisitRoutes = require('./routes/dailyVisitRoutes');
const { startAdCleanupScheduler } = require('./utils/adCleanupScheduler');
const { startSellerSubscriptionEnforcer } = require('./utils/sellerSubscriptionEnforcer');

// ------------------- Middlewares -------------------
app.use(cookieParser());

// Updated CORS configuration to allow multiple origins
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5000',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  exposedHeaders: ['Content-Disposition']
}));


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ------------------- Static Files -------------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// ------------------- Routes -------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/products', require('./routes/products'));
app.use('/api/seller', sellerRoutes);
app.use('/api/sellers', require('./routes/seller'));
app.use('/api/seller-services', require('./routes/sellerServicesRoutes'));
app.use('/api/shopAppearance', require('./routes/shopAppearance'));
app.use('/api/slides', require('./routes/slides'));
app.use('/api/favorite', require('./routes/favorites'));
app.use('/api/favorite-shops', require('./routes/favoriteShops'));
app.use('/api/blocked-sellers', require('./routes/blockedSellers'));
app.use('/api/categories', categoryRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', adminUserMessageRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/adPlans', adPlanRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/shops', require('./routes/shops'));
app.use('/api/home-card-sections', require('./routes/homeCardSections'));
app.use('/api/service-portfolio', require('./routes/sellerPortfolioRoutes'));
app.use('/api/portfolios', require('./routes/sellerPortfolioRoutes'));
app.use('/api/portfolio', require('./routes/sellerPortfolioRoutes'));
app.use('/api/seller-portfolio', require('./routes/sellerPortfolioRoutes'));
app.use('/api/service-shops', require('./routes/serviceShopPublic'));
app.use('/api/service-shops', require('./routes/serviceShops'));
app.use('/api/adOrder', require('./routes/adOrder'));
app.use('/api/sellerPlans', require('./routes/sellerPlans'));
app.use('/api/service-plans', require('./routes/servicePlans'));
app.use('/api/shopping-centers', require('./routes/shoppingCenter'));
app.use('/api/shop-appearances', require('./routes/shopAppearance'));
app.use('/api/payment', paymentRoutes);  // روت‌های پرداخت
app.use('/api/branding', require('./routes/branding'));
app.use('/api/settings', settingsRoutes);
app.use('/api/accountant', accountantRoutes);
app.use('/api/security', securityRoutes);

// Booking routes
app.use('/api', require('./routes/bookingRoutes'));
app.use('/api', require('./routes/bookingAvailabilityRoutes'));

app.use('/api/daily-visits', dailyVisitRoutes);
app.use('/api/reports', require('./routes/report'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/loyalty', require('./routes/loyalty'));

// ------------------- Health Check -------------------
app.get('/', (req, res) => {
  res.send('Vitrinet Backend is running!');
});

// ------------------- Database & Server -------------------
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const cleanupHandle = startAdCleanupScheduler();
    if (cleanupHandle) {
      app.locals.adCleanupHandle = cleanupHandle;
      const stopCleanup = () => {
        clearInterval(cleanupHandle);
      };
      process.once('SIGINT', stopCleanup);
      process.once('SIGTERM', stopCleanup);
    }

    const subscriptionHandle = startSellerSubscriptionEnforcer();
    if (subscriptionHandle) {
      app.locals.sellerSubscriptionHandle = subscriptionHandle;
      const stopSubscription = () => {
        clearInterval(subscriptionHandle);
      };
      process.once('SIGINT', stopSubscription);
      process.once('SIGTERM', stopSubscription);
    }
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message || err);
    process.exit(1);
  });

// ------------------- Global Error Handler -------------------
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'دسترسی غیرمجاز (CORS)!' });
  }
  console.error('Server Error:', err.stack || err);
  res.status(500).json({ message: 'خطای سرور! لطفاً بعداً تلاش کنید.' });
});

// ------------------- 404 Not Found -------------------
app.use((req, res) => {
  res.status(404).json({ message: 'آدرس موردنظر یافت نشد!' });
});