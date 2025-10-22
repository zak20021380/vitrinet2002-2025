# Service Shop Ratings Implementation

## Overview
The rating system is now fully integrated across the application, connecting customer reviews to both the service seller panel and the public service shops page.

## Architecture

### Data Flow
```
Customer submits review
    ↓
Review Model (approved: false)
    ↓
Seller approves/rejects review
    ↓
recalcShopRating() triggers
    ↓
Updates both:
  - ShopAppearance.averageRating & ratingCount
  - ServiceShop.analytics.ratingAverage & ratingCount
    ↓
Frontend displays ratings
```

### Models Involved

1. **Review Model** (`/backend/models/Review.js`)
   - Stores individual customer reviews
   - Fields: `sellerId`, `userId`, `score` (1-5), `comment`, `approved`, timestamps
   - Only approved reviews are counted in ratings

2. **ShopAppearance Model** (`/backend/models/ShopAppearance.js`)
   - Cached/denormalized ratings for fast access
   - Fields: `averageRating`, `ratingCount`

3. **ServiceShop Model** (`/backend/models/serviceShop.js`)
   - Service shop catalog with analytics
   - Fields: `analytics.ratingAverage`, `analytics.ratingCount`

## Backend Implementation

### Controllers

#### ShopAppearanceController (`/backend/controllers/shopAppearanceController.js`)

**Key Function: `recalcShopRating(sellerId)`**
- Aggregates approved reviews from Review collection
- Calculates average rating and count
- Updates ShopAppearance model
- **NEW**: Also updates ServiceShop.analytics if exists

**Endpoints:**
- `POST /api/shopAppearance/:sellerId/rate` - Submit review (auth required)
- `GET /api/shopAppearance/:sellerId/reviews` - Get approved reviews
- `GET /api/shopAppearance/reviews/pending` - Get pending reviews (seller only)
- `PATCH /api/shopAppearance/reviews/:reviewId/approve` - Approve review (seller only)
- `DELETE /api/shopAppearance/reviews/:reviewId` - Reject/delete review (seller only)
- **NEW**: `POST /api/shopAppearance/admin/sync-ratings` - Sync all ratings to ServiceShop (admin only)

#### SellerController (`/backend/controllers/sellerController.js`)

**Endpoint: `GET /api/seller/dashboard/stats`**
- Returns dashboard statistics including:
  - `ratingAverage`: Average of approved reviews
  - `ratingCount`: Number of approved reviews
- Aggregates directly from Review collection for real-time accuracy

### Routes

**ShopAppearance Routes** (`/backend/routes/shopAppearance.js`)
- Review management routes configured
- Admin sync endpoint added

## Frontend Implementation

### Service Seller Panel

**Location**: `/public/service-seller-panel/s-seller-panel.html`

**JavaScript**: `/public/service-seller-panel/s-seller-panel.js`

**Features:**
- Fetches ratings from `/api/seller/dashboard/stats`
- Displays in dashboard stat card (line 226-240 in HTML)
- Shows:
  - Rating value (0.0 - 5.0)
  - Star visualization
  - Rating count
  - Badge based on rating level

**Code Reference:**
```javascript
// Line 374-403 in s-seller-panel.js
async getDashboardStats() {
  const r = await fetch(`${API_BASE}/api/seller/dashboard/stats`, {
    credentials: 'include'
  });
  const parsed = await this._json(r);
  return parsed; // includes ratingAverage, ratingCount
}

// Line 1870-1924 - Rendering ratings
setValue('.stat-rating .stat-value', ratingAverage, { fractionDigits: 1 });
```

### Service Shops Page

**Location**: `/public/service-shops.html`

**Features:**
- Fetches shop appearance data including ratings
- Displays ratings in multiple locations:
  - Header badge (line 1240-1241)
  - Review section (line 3623-3625)
  - Star visualization

**Code Reference:**
```javascript
// Line 4196-4252 - loadReviews() function
async function loadReviews() {
  // Fetch shop appearance
  data = await fetchByUrl(`/api/shopAppearance/url/${encodeURIComponent(shopurl)}`);

  // Extract ratings
  const avg = data?.averageRating;
  const cnt = data?.ratingCount;

  // Update UI
  updateSummary(avg, cnt, reviewsData);
}

// Line 4351-4381 - updateSummary() function
function updateSummary(avg, count, ratings) {
  // Updates all rating display elements
  setTextAllById('avg-rating', avgStr);
  setTextAllById('review-count', cntStr);
  // ... more UI updates
}
```

## API Endpoints Summary

### Public Endpoints
- `GET /api/shopAppearance/url/:shopurl` - Get shop appearance by URL (includes ratings)
- `GET /api/shopAppearance/:sellerId` - Get shop appearance by seller ID (includes ratings)
- `GET /api/shopAppearance/:sellerId/reviews` - Get approved reviews

### Authenticated User Endpoints
- `POST /api/shopAppearance/:sellerId/rate` - Submit a review

### Seller Endpoints
- `GET /api/seller/dashboard/stats` - Get dashboard stats (includes ratings)
- `GET /api/shopAppearance/reviews/pending` - Get pending reviews
- `PATCH /api/shopAppearance/reviews/:reviewId/approve` - Approve review
- `DELETE /api/shopAppearance/reviews/:reviewId` - Reject review

### Admin Endpoints
- `POST /api/shopAppearance/admin/sync-ratings` - Sync all ratings to ServiceShop

## Usage

### For Customers
1. Visit a service shop page
2. Click "ثبت امتیاز" (Submit Rating) button
3. Rate 1-5 stars and optionally add a comment
4. Submit review (requires login)
5. Review goes to seller for approval

### For Sellers
1. Login to seller panel
2. View overall rating on dashboard
3. Go to "نظرات و امتیازات" (Reviews) tab
4. Approve or reject pending reviews
5. Ratings automatically recalculate

### For Admins
To sync all existing ratings to ServiceShop collection:
```bash
curl -X POST http://localhost:5000/api/shopAppearance/admin/sync-ratings \
  -H "Cookie: your-admin-session-cookie"
```

## Testing

### Manual Testing Steps

1. **Submit a Review:**
   ```bash
   curl -X POST http://localhost:5000/api/shopAppearance/{SELLER_ID}/rate \
     -H "Content-Type: application/json" \
     -H "Cookie: your-user-session" \
     -d '{"rating": 5, "comment": "عالی بود!"}'
   ```

2. **Check Pending Reviews (as seller):**
   ```bash
   curl http://localhost:5000/api/shopAppearance/reviews/pending \
     -H "Cookie: your-seller-session"
   ```

3. **Approve Review (as seller):**
   ```bash
   curl -X PATCH http://localhost:5000/api/shopAppearance/reviews/{REVIEW_ID}/approve \
     -H "Cookie: your-seller-session"
   ```

4. **Verify Dashboard Stats:**
   ```bash
   curl http://localhost:5000/api/seller/dashboard/stats \
     -H "Cookie: your-seller-session"
   ```

5. **Check Public Ratings:**
   ```bash
   curl http://localhost:5000/api/shopAppearance/url/{SHOP_URL}
   ```

## Troubleshooting

### Ratings Not Showing
1. Check if reviews are approved: `approved: true` in Review collection
2. Verify sellerId is correct
3. Run admin sync endpoint to update ServiceShop

### Ratings Not Syncing to ServiceShop
1. Run the admin sync endpoint: `POST /api/shopAppearance/admin/sync-ratings`
2. Check console for errors
3. Verify ServiceShop has `legacySellerId` field matching the seller's `_id`

### Frontend Not Displaying Ratings
1. Check browser console for API errors
2. Verify `averageRating` and `ratingCount` in API response
3. Check element IDs match: `avg-rating`, `review-count`

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for instant rating updates
2. **Rating Breakdown**: Show distribution of 1-5 star ratings
3. **Review Responses**: Allow sellers to respond to reviews
4. **Verified Purchase**: Mark reviews from verified bookings
5. **Helpful Votes**: Let users vote on helpful reviews
6. **Photo Reviews**: Allow customers to upload photos with reviews

## Files Modified

### Backend
- `/backend/controllers/shopAppearanceController.js` - Added ServiceShop sync to recalcShopRating
- `/backend/routes/shopAppearance.js` - Added admin sync endpoint

### Frontend
- No changes required (already implemented!)

## Conclusion

The rating system is now fully functional and professionally integrated:
- ✅ Customers can submit reviews
- ✅ Sellers can approve/reject reviews
- ✅ Ratings automatically calculate and sync
- ✅ Seller dashboard displays ratings
- ✅ Public service shops page displays ratings
- ✅ Backend properly connects Review → ShopAppearance → ServiceShop
