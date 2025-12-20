# Streak & Wallet API Documentation

## Overview

این سند API های مربوط به سیستم استریک (فعالیت متوالی) و کیف پول (اعتبار فروشگاه) را توضیح می‌دهد.

**اصول مهم:**
- Source of Truth فقط Backend/Database است
- Frontend هیچ محاسبه نهایی یا ساخت مقدار نمایشی (Fake/Random) انجام نمی‌دهد
- داده‌ها Persist می‌شوند و با refresh/خروج و ورود ثابت می‌مانند
- تمام تغییرات با رویکرد Transaction-safe و قابل audit انجام می‌شود

---

## 1. Streak API (فعالیت متوالی)

### تعریف Streak
- تعداد روزهای متوالی که فروشنده حداقل یک event معتبر داشته
- Event معتبر: ورود به پنل فروشنده (check-in)
- محاسبه بر اساس timezone `Asia/Tehran`
- چند event در یک روز فقط یک روز حساب می‌شود (idempotent)

### قوانین
- اگر امروز event ثبت شد → streak ادامه پیدا می‌کند
- اگر دیروز event ثبت شده و امروز هنوز چیزی ثبت نشده → streak موقتاً حفظ می‌شود
- اگر یک روز کامل بدون event معتبر گذشت → streak به آخرین checkpoint برمی‌گردد
- هر 7 روز یک checkpoint ذخیره می‌شود

### Endpoints

#### GET /api/streak
دریافت وضعیت استریک فروشنده

**Query Parameters:**
- `days` (optional): تعداد روزهای تقویم (پیش‌فرض: 14)

**Response:**
```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Tehran",
    "currentStreak": 12,
    "longestStreak": 15,
    "totalLoginDays": 45,
    "lastActiveDate": "2024-12-20",
    "lastLoginDate": "2024-12-20T10:30:00.000Z",
    "streakStartDate": "2024-12-08T00:00:00.000Z",
    "lastCheckpoint": 7,
    "loyaltyPoints": 150,
    "weekProgress": 5,
    "checkpointReached": false,
    "activeDaysInLast14": 10,
    "calendarDays": [
      { "date": "2024-12-07", "day": 7, "active": false, "today": false },
      { "date": "2024-12-08", "day": 8, "active": true, "today": false },
      ...
      { "date": "2024-12-20", "day": 20, "active": true, "today": true }
    ],
    "level": {
      "name": "فعال",
      "icon": "⭐",
      "color": "#fbbf24",
      "daysToNext": 18,
      "nextTierName": "نقره‌ای",
      "progress": 22
    },
    "days": [
      { "label": "ش", "status": "hit", "isGift": false },
      { "label": "ی", "status": "hit", "isGift": false },
      { "label": "د", "status": "hit", "isGift": false },
      { "label": "س", "status": "hit", "isGift": false },
      { "label": "چ", "status": "hit", "isGift": false },
      { "label": "پ", "status": "pending", "isGift": false },
      { "label": "ج", "status": "pending", "isGift": true }
    ],
    "needsCheckIn": true,
    "streakAtRisk": false,
    "dailyReward": "+۱۰ امتیاز وفاداری",
    "weeklyReward": "۵,۰۰۰ تومان اعتبار",
    "checkpointReward": "+۵۰ امتیاز وفاداری"
  }
}
```

**Response (کاربر بدون هیچ activity):**
```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Tehran",
    "currentStreak": 0,
    "longestStreak": 0,
    "totalLoginDays": 0,
    "lastActiveDate": null,
    "activeDaysInLast14": 0,
    "calendarDays": [
      { "date": "2024-12-07", "day": 7, "active": false, "today": false },
      ...
      { "date": "2024-12-20", "day": 20, "active": false, "today": true }
    ],
    ...
  }
}
```

#### POST /api/streak/checkin
ثبت ورود روزانه (check-in)

**Response (اولین بار امروز):**
```json
{
  "success": true,
  "alreadyCheckedIn": false,
  "message": "ادامه بده! ۱۲ روز متوالی 🔥",
  "data": { ... }
}
```

**Response (تکراری):**
```json
{
  "success": true,
  "alreadyCheckedIn": true,
  "message": "امروز قبلاً ثبت شده است",
  "data": { ... }
}
```

#### GET /api/streak/leaderboard
دریافت لیدربورد استریک

**Query Parameters:**
- `limit` (optional): تعداد نتایج (پیش‌فرض: 10، حداکثر: 50)

---

## 2. Wallet API (اعتبار فروشگاه)

### معماری Ledger
- همه تغییرات اعتبار فقط از طریق ایجاد ledger entry انجام می‌شود
- `balance` در `SellerWallet` یک کش است که از ledger محاسبه می‌شود
- تمام عملیات با MongoDB transaction انجام می‌شود
- از idempotency key برای جلوگیری از تراکنش‌های تکراری استفاده می‌شود

### Endpoints

#### GET /api/wallet
دریافت اطلاعات کیف پول

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 2500000,
    "availableBalance": 2500000,
    "pendingBalance": 0,
    "totalEarned": 3000000,
    "totalSpent": 500000,
    "lastTransactionAt": "2024-12-20T10:30:00.000Z",
    "formattedBalance": "۲,۵۰۰,۰۰۰",
    "formattedAvailableBalance": "۲,۵۰۰,۰۰۰",
    "recentTransactions": [
      {
        "id": "...",
        "type": "credit",
        "category": "streak_daily",
        "title": "پاداش استریک روزانه",
        "description": "روز ۱۲ استریک",
        "amount": 1000,
        "formattedAmount": "+۱,۰۰۰",
        "isPositive": true,
        "balanceBefore": 2499000,
        "balanceAfter": 2500000,
        "status": "completed",
        "timeAgo": "۲ ساعت پیش",
        "createdAt": "2024-12-20T10:30:00.000Z"
      }
    ]
  }
}
```

#### GET /api/wallet/transactions
دریافت تاریخچه تراکنش‌ها (Ledger)

**Query Parameters:**
- `page` (optional): شماره صفحه (پیش‌فرض: 1)
- `limit` (optional): تعداد در هر صفحه (پیش‌فرض: 20، حداکثر: 50)

#### POST /api/wallet/earn
کسب اعتبار (پاداش فعالیت)

**Request Body:**
```json
{
  "category": "streak_daily",
  "relatedId": "...",
  "relatedType": "streak",
  "idempotencyKey": "streak_daily_2024-12-20_sellerId"
}
```

**Categories:**
- `streak_daily`: پاداش روزانه استریک (1,000 تومان)
- `streak_checkpoint`: پاداش چک‌پوینت (5,000 تومان)
- `booking_complete`: تکمیل نوبت (2,000 تومان)
- `review_received`: دریافت نظر مثبت (3,000 تومان)
- `referral`: دعوت دوستان (10,000 تومان)
- `first_booking`: اولین نوبت (5,000 تومان)
- `profile_complete`: تکمیل پروفایل (3,000 تومان)

#### POST /api/wallet/spend
خرج اعتبار (خرید خدمات)

**Request Body:**
```json
{
  "serviceType": "boost_purchase",
  "idempotencyKey": "boost_2024-12-20_sellerId"
}
```

**Service Types:**
- `boost_purchase`: نردبان آگهی (20,000 تومان)
- `vip_badge`: نشان VIP (80,000 تومان)
- `plan_discount`: تخفیف پلن (50,000 تومان)

---

## 3. Dashboard Metrics API

#### GET /api/sellers/me/dashboard-metrics
دریافت متریک‌های داشبورد (streak + wallet)

**Response:**
```json
{
  "success": true,
  "data": {
    "current_streak_days": 12,
    "longest_streak_days": 15,
    "last_active_date": "2024-12-20",
    "streak_at_risk": false,
    "store_balance_irr": 2500000,
    "available_balance_irr": 2500000,
    "pending_balance_irr": 0,
    "fetched_at": "2024-12-20T10:30:00.000Z"
  }
}
```

---

## Data Models

### SellerStreak
```javascript
{
  seller: ObjectId,           // شناسه فروشنده
  currentStreak: Number,      // تعداد روزهای متوالی فعلی
  longestStreak: Number,      // بیشترین استریک تاریخی
  lastActiveDate: String,     // آخرین تاریخ فعالیت (YYYY-MM-DD)
  lastLoginDate: Date,        // آخرین تاریخ ورود
  streakStartDate: Date,      // تاریخ شروع استریک فعلی
  totalLoginDays: Number,     // مجموع روزهای ورود
  lastCheckpoint: Number,     // آخرین چک‌پوینت
  loyaltyPoints: Number,      // امتیاز وفاداری
  weekHistory: Array          // تاریخچه هفتگی
}
```

### SellerWallet
```javascript
{
  seller: ObjectId,           // شناسه فروشنده
  balance: Number,            // موجودی کش شده
  pendingBalance: Number,     // موجودی در انتظار
  totalEarned: Number,        // مجموع کسب شده
  totalSpent: Number,         // مجموع مصرف شده
  lastTransactionAt: Date,    // آخرین تراکنش
  lastReconciledAt: Date      // آخرین reconciliation
}
```

### WalletTransaction (Ledger)
```javascript
{
  seller: ObjectId,           // شناسه فروشنده
  type: String,               // نوع: credit, debit, hold, release
  amount: Number,             // مبلغ (مثبت/منفی)
  balanceBefore: Number,      // موجودی قبل
  balanceAfter: Number,       // موجودی بعد
  category: String,           // دسته‌بندی
  title: String,              // عنوان
  description: String,        // توضیحات
  referenceId: ObjectId,      // شناسه مرتبط
  referenceType: String,      // نوع موجودیت مرتبط
  status: String,             // وضعیت: completed, pending, cancelled
  idempotencyKey: String,     // کلید یکتا برای جلوگیری از تکرار
  byAdmin: ObjectId           // اگر توسط ادمین انجام شده
}
```

---

## UI/UX Requirements

1. **در حالت loading:** نمایش skeleton یا «—»
2. **اگر API خطا داد:** نمایش state خطا + دکمه retry
3. **اگر داده null بود:** نمایش «—» نه عدد فیک
4. **در هیچ شرایطی:** fallback به مقدار نمایشی/فیک انجام نشود

---

## Migration

برای اعمال تغییرات به دیتابیس موجود:

```bash
node backend/migrations/add-streak-wallet-fields.js
```
