
import { API_BASE, NO_CACHE, bust, escapeHtml } from './core-utils.js';
import { StorageManager } from './storage.js';
import UIComponents from './ui-components.js';

// Convert Persian/Arabic digits to English digits
const toEn = (s) => (s || '')
  .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
  .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);

// Cache of booked time slots keyed by ISO date
const bookedCache = {};

const toFaDigits = (value) => {
  if (value == null) return '';
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
};

const normalizeKeyPart = (value) => toEn(String(value || '').trim().toLowerCase());

const createBookingKey = (booking) => {
  if (!booking) return '';
  const id = booking._id || booking.id;
  if (id) return `id:${id}`;
  const name = normalizeKeyPart(booking.customerName || booking.name || '');
  const date = normalizeKeyPart(booking.dateISO || booking.date || '');
  const time = normalizeKeyPart(booking.time || booking.startTime || '');
  if (!name && !date && !time) return '';
  return `fallback:${name}|${date}|${time}`;
};

const collectBookingKeys = (list) => {
  const set = new Set();
  if (!list) return set;
  const source = Array.isArray(list)
    ? list
    : (list instanceof Set ? Array.from(list) : []);
  source.forEach((item) => {
    if (!item) return;
    if (typeof item === 'string') {
      set.add(item);
      return;
    }
    const key = createBookingKey(item);
    if (key) set.add(key);
  });
  return set;
};

const API = {
  async _json(res) {
    const txt = await res.text();
    if (!txt) return null;
    try { return JSON.parse(txt); } catch { return null; }
  },

  _unwrap(res) {
    const o = res || {};
    if (Array.isArray(o)) return o;
    // Allow different backend response shapes (items, data, bookings, etc.)
    // so that newer booking endpoints returning `{ bookings: [...] }`
    // are parsed correctly.
    return o.items ||
           o.data ||
           o.services ||
           o.service ||
           o.bookings ||
           o.notifications ||
           o.notification ||
           [];
  },

  // فقط دریافت خدمات فروشنده‌ی لاگین‌شده
  async getServices() {
    const r = await fetch(bust(`${API_BASE}/api/seller-services/me/services`), {
      credentials: 'include', // مهم: برای ارسال کوکی/توکن
      ...NO_CACHE
    });
    if (!r.ok && r.status !== 304) throw new Error('FETCH_SERVICES_FAILED');
    const raw = this._unwrap(await this._json(r));
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map(s => {
      // Handle both 'image' string and 'images' array from backend
      let imageUrl = '';
      if (s.image) {
        imageUrl = s.image;
      } else if (Array.isArray(s.images) && s.images.length > 0) {
        const mainIdx = s.mainImageIndex || 0;
        imageUrl = s.images[mainIdx] || s.images[0] || '';
      }
      return {
        id:    s._id || s.id,
        title: s.title,
        price: s.price,
        image: imageUrl,
        images: s.images || []
      };
    });
  },

  async getComplimentaryPlan() {
    const url = bust(`${API_BASE}/api/service-shops/my/complimentary-plan`);
    const res = await fetch(url, { credentials: 'include', ...NO_CACHE });
    if (res.status === 404) return null;
    if (res.status === 403) {
      console.info('Complimentary plan endpoint forbidden; treating as no complimentary plan');
      return null;
    }
    if (res.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (!res.ok) {
      throw new Error(`COMPLIMENTARY_PLAN_HTTP_${res.status}`);
    }
    return await this._json(res);
  },

  async getServicePlans() {
    const res = await fetch(bust(`${API_BASE}/api/service-plans`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (!res.ok) {
      throw new Error(`SERVICE_PLANS_HTTP_${res.status}`);
    }
    const data = await this._json(res);
    if (Array.isArray(data?.plans)) {
      return data.plans;
    }
    const fallback = this._unwrap(data);
    return Array.isArray(fallback) ? fallback : [];
  },

  async validatePlanDiscountCode(payload = {}) {
    const body = {
      code: payload.code,
      planKey: payload.planKey || null
    };
    const res = await fetch(bust(`${API_BASE}/api/service-plans/discount-codes/validate`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await this._json(res);
    if (!res.ok) {
      const message = data?.message || 'کد تخفیف نامعتبر است.';
      throw new Error(message);
    }
    return data?.discountCode || null;
  },

  async redeemPlanDiscountCode(code, payload = {}) {
    if (!code) throw new Error('کد تخفیف نامعتبر است.');
    const res = await fetch(bust(`${API_BASE}/api/service-plans/discount-codes/${encodeURIComponent(code)}/redeem`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: payload.planId || null })
    });
    const data = await this._json(res);
    if (!res.ok) {
      const message = data?.message || 'ثبت استفاده از کد تخفیف با خطا مواجه شد.';
      throw new Error(message);
    }
    return data?.discountCode || null;
  },

  async getFeatureFlags() {
    try {
      const res = await fetch(bust(`${API_BASE}/api/settings/public/feature-flags`), {
        credentials: 'include',
        ...NO_CACHE
      });
      if (!res.ok) {
        throw new Error(`FEATURE_FLAGS_HTTP_${res.status}`);
      }
      const data = await this._json(res);
      return data?.flags || {};
    } catch (err) {
      console.warn('API.getFeatureFlags failed', err);
      throw err;
    }
  },

  async getTopPeers(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit);
    if (options.scope) params.set('scope', options.scope);
    const query = params.toString();
    const url = bust(`${API_BASE}/api/sellers/top-peers${query ? `?${query}` : ''}`);
    const res = await fetch(url, { credentials: 'include', ...NO_CACHE });
    if (res.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (res.status === 403) {
      console.info('Top peers endpoint forbidden; returning fallback data');
      return {
        top: [],
        mine: null,
        total: 0,
        category: '',
        scope: options.scope || 'category',
        updatedAt: null,
        isRestricted: true
      };
    }
    if (!res.ok) {
      throw new Error(`TOP_PEERS_HTTP_${res.status}`);
    }
    const data = await this._json(res);
    const total = Number(data?.total);

    return {
      top: Array.isArray(data?.top) ? data.top : [],
      mine: data?.mine || null,
      total: Number.isFinite(total) ? total : 0,
      category: data?.category || '',
      scope: data?.scope || 'category',
      updatedAt: data?.updatedAt || null
    };
  },

  // ایجاد خدمت جدید
// ایجاد خدمت جدید
async createService(payload) {
  console.log('Sending service data to server:', payload); // Debug log
  
  const r = await fetch(`${API_BASE}/api/seller-services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  
  if (!r.ok) {
    // Get more detailed error information
    let errorMessage = 'CREATE_SERVICE_FAILED';
    try {
      const errorData = await r.json();
      console.error('Server error details:', errorData);
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch (e) {
      console.error('Failed to parse error response:', e);
    }
    throw new Error(errorMessage);
  }
  
  const data = this._unwrap(await this._json(r));
  // Handle both 'image' string and 'images' array from backend
  let imageUrl = '';
  if (data.image) {
    imageUrl = data.image;
  } else if (Array.isArray(data.images) && data.images.length > 0) {
    const mainIdx = data.mainImageIndex || 0;
    imageUrl = data.images[mainIdx] || data.images[0] || '';
  } else if (Array.isArray(payload.images) && payload.images.length > 0) {
    // Backend might omit the uploaded data URL in the response; keep the local preview so cards show immediately
    imageUrl = payload.images[0];
  }
  return {
    id:    data._id || data.id,
    title: data.title,
    price: data.price,
    image: imageUrl,
    images: data.images || []
  };
},

  // ویرایش خدمت
  async updateService({ id, ...payload }) {
    const r = await fetch(`${API_BASE}/api/seller-services/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('UPDATE_SERVICE_FAILED');
    const data = this._unwrap(await this._json(r));
    // Handle both 'image' string and 'images' array from backend
    let imageUrl = '';
    if (data.image) {
      imageUrl = data.image;
    } else if (Array.isArray(data.images) && data.images.length > 0) {
      const mainIdx = data.mainImageIndex || 0;
      imageUrl = data.images[mainIdx] || data.images[0] || '';
    } else if (Array.isArray(payload.images) && payload.images.length > 0) {
      imageUrl = payload.images[0] || '';
    }
    return {
      id:    data._id || data.id || id,
      title: data.title,
      price: data.price,
      image: imageUrl,
      images: data.images || payload.images || []
    };
  },

  // حذف خدمت
  async deleteService(id) {
    const r = await fetch(`${API_BASE}/api/seller-services/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!r.ok) throw new Error('DELETE_SERVICE_FAILED');
    return true;
  },

  // Bookings API methods
  async getBookings() {
    console.log('Fetching bookings from:', `${API_BASE}/api/seller-bookings/me`);
    
    const url = bust(`${API_BASE}/api/seller-bookings/me`);
    console.log('Full URL with cache busting:', url);
    
    const r = await fetch(url, {
      credentials: 'include',
      ...NO_CACHE
    });
    
    console.log('Bookings API response status:', r.status);
    console.log('Bookings API response headers:', [...r.headers.entries()]);
    
    if (r.status === 401) {
      console.error('Unauthorized access to bookings API');
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    
    if (r.status === 403) {
      console.warn('Bookings API access returned 403; continuing with empty list.');
      return [];
    }

    if (!r.ok && r.status !== 304) {
      console.error('Failed to fetch bookings, status:', r.status);
      throw { status: r.status, message: 'FETCH_BOOKINGS_FAILED' };
    }
    
    const raw = this._unwrap(await this._json(r));
    console.log('Raw bookings response:', raw);
    
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map(b => {
      const rawDate = b.dateISO || b.bookingDate || b.date || '';
      const dateStr = toEn((rawDate || '').split(' ')[0]).replace(/\//g, '-');
      const dateISO = dateStr.split('T')[0];
      const time = normalizeTime(toEn(b.startTime || b.time || '')) || '';
      return {
        id: b._id || b.id,
        customerId: b.customerId || b.userId || '',
        customerName: b.customerName || '',
        service: b.service || '',
        date: dateISO,
        dateISO,
        time,
        customerPhone: b.customerPhone || '',
        status: b.status || 'pending',
        cancelledBy: b.cancelledBy || b.canceledBy
      };
    });
  },

  async getDashboardStats() {
    const url = bust(`${API_BASE}/api/sellers/dashboard/stats`);
    try {
      const r = await fetch(url, {
        credentials: 'include',
        ...NO_CACHE
      });

      if (r.status === 401) {
        throw { status: 401, message: 'UNAUTHORIZED' };
      }

      if (!r.ok && r.status !== 304) {
        console.warn('Dashboard stats endpoint unavailable, falling back to local data', r.status);
        return computeFallbackDashboardStats();
      }

      const parsed = await this._json(r);
      if (!parsed || typeof parsed !== 'object') {
        return computeFallbackDashboardStats();
      }
      return parsed;
    } catch (err) {
      if (err?.status === 401) {
        throw err;
      }
      console.error('getDashboardStats failed, using fallback data', err);
      return computeFallbackDashboardStats();
    }
  },

  async getMonthlyBookingInsights() {
    const url = bust(`${API_BASE}/api/sellers/dashboard/bookings/monthly`);
    const r = await fetch(url, {
      credentials: 'include',
      ...NO_CACHE
    });
    if (r.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (!r.ok && r.status !== 304) {
      throw new Error('FETCH_MONTHLY_BOOKING_INSIGHTS_FAILED');
    }
    const parsed = await this._json(r);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('INVALID_MONTHLY_BOOKING_INSIGHTS');
    }
    return parsed;
  },

  // Portfolio API methods
  async getPortfolio() {
    const r = await fetch(bust(`${API_BASE}/api/seller-portfolio/me`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (!r.ok && r.status !== 304) throw new Error('FETCH_PORTFOLIO_FAILED');
    const data = await this._json(r);
    const items = data.items || data.data || data || [];
    return Array.isArray(items) ? items : [];
  },

  async createPortfolioItem(payload) {
    console.log('Creating portfolio item:', payload);
    const r = await fetch(`${API_BASE}/api/seller-portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      let errorMessage = 'CREATE_PORTFOLIO_FAILED';
      try {
        const errorData = await r.json();
        console.error('Portfolio create error:', errorData);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        console.error('Failed to parse error response:', e);
      }
      throw new Error(errorMessage);
    }
    const data = await this._json(r);
    return data.item || data;
  },

  async updatePortfolioItem(id, payload) {
    const r = await fetch(`${API_BASE}/api/seller-portfolio/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('UPDATE_PORTFOLIO_FAILED');
    const data = await this._json(r);
    return data.item || data;
  },

async deletePortfolioItem(id) {
        if (!confirm('آیا از حذف این نمونه‌کار مطمئن هستید؟')) return;

        const before = StorageManager.get('vit_portfolio') || [];
        const item = before.find(p => p.id === id);
        const dbId = item?._id || item?.id;
        const after = before.filter(p => p.id !== id && p._id !== dbId);

        // Optimistic update
        StorageManager.set('vit_portfolio', after);
        this.renderPortfolioList();

        try {
            if (!API || typeof API.deletePortfolioItem !== 'function') {
                throw new Error('API adapter missing');
            }
            await API.deletePortfolioItem(dbId);
            UIComponents.showToast('نمونه‌کار حذف شد.', 'success');
        } catch (err) {
            console.error('deletePortfolioItem failed', err);
            // Rollback on error
            StorageManager.set('vit_portfolio', before);
            this.renderPortfolioList();
            UIComponents.showToast('حذف در سرور انجام نشد؛ تغییرات برگشت داده شد.', 'error');
        }
    },


  // Notifications API methods
  async getNotifications() {
    const r = await fetch(bust(`${API_BASE}/api/notifications`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (!r.ok && r.status !== 304) throw new Error('FETCH_NOTIFICATIONS_FAILED');
    const raw = this._unwrap(await this._json(r));
    const arr = Array.isArray(raw) ? raw : [];
    const fmt = (d) => {
      const diff = (Date.now() - new Date(d).getTime()) / 1000;
      if (diff < 3600) return `${Math.floor(diff/60)} دقیقه پیش`;
      if (diff < 86400) return `${Math.floor(diff/3600)} ساعت پیش`;
      return `${Math.floor(diff/86400)} روز پیش`;
    };
    const detectType = (n) => {
      if (n.type) return n.type;
      if (typeof n.message === 'string' && n.message.includes('تیکت')) return 'ticket';
      return 'info';
    };
    return arr.map(n => ({
      id: n._id || n.id,
      text: n.message || '',
      time: n.createdAt ? fmt(n.createdAt) : '',
      read: !!n.read,
      type: detectType(n),
      title: n.title || '',
      relatedTicketId: n.relatedTicketId || null,
      ticketId: n.relatedTicketId || n.ticketId || null,
      userReplies: Array.isArray(n.userReplies) ? n.userReplies : []
    }));
  },

  async markNotificationRead(id) {
    const r = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: 'PUT',
      credentials: 'include'
    });
    if (!r.ok) throw new Error('MARK_NOTIFICATION_READ_FAILED');
    return true;
  },

  async deleteNotification(id) {
    const r = await fetch(`${API_BASE}/api/notifications/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!r.ok) throw new Error('DELETE_NOTIFICATION_FAILED');
    return true;
  },

  async sendNotificationReply(id, message) {
    const r = await fetch(`${API_BASE}/api/notifications/${id}/reply`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    if (!r.ok) throw new Error('SEND_NOTIFICATION_REPLY_FAILED');
    const data = await this._json(r);
    return data?.reply || { message, createdAt: new Date().toISOString() };
  },

  // ===== Admin Seller Notifications API Methods =====
  
  /**
   * دریافت پیام‌های ادمین برای فروشنده لاگین‌شده
   * از endpoint /my استفاده می‌کند که نیازی به sellerId ندارد
   */
  async getAdminNotifications(sellerId = null) {
    // استفاده از endpoint جدید /my که از توکن استفاده می‌کند
    const url = sellerId 
      ? bust(`${API_BASE}/api/admin-seller-notifications/seller/${sellerId}`)
      : bust(`${API_BASE}/api/admin-seller-notifications/my`);
    
    const r = await fetch(url, {
      credentials: 'include',
      ...NO_CACHE
    });
    if (!r.ok && r.status !== 304) throw new Error('FETCH_ADMIN_NOTIFICATIONS_FAILED');
    const data = await this._json(r);
    const arr = Array.isArray(data?.notifications) ? data.notifications : [];
    const fmt = (d) => {
      const diff = (Date.now() - new Date(d).getTime()) / 1000;
      if (diff < 3600) return `${Math.floor(diff/60)} دقیقه پیش`;
      if (diff < 86400) return `${Math.floor(diff/3600)} ساعت پیش`;
      return `${Math.floor(diff/86400)} روز پیش`;
    };
    return arr.map(n => ({
      id: n._id || n.id,
      _id: n._id || n.id,
      text: n.content || '',
      content: n.content || '',
      time: n.createdAt ? fmt(n.createdAt) : '',
      createdAt: n.createdAt,
      read: !!n.read,
      type: n.type || 'info',
      title: n.title || '',
      isAdminMessage: true
    }));
  },

  /**
   * علامت‌گذاری پیام ادمین به عنوان خوانده شده
   */
  async markAdminNotificationRead(id) {
    const r = await fetch(`${API_BASE}/api/admin-seller-notifications/${id}/read`, {
      method: 'PUT',
      credentials: 'include'
    });
    if (!r.ok) throw new Error('MARK_ADMIN_NOTIFICATION_READ_FAILED');
    return true;
  },

  /**
   * حذف پیام ادمین
   */
  async deleteAdminNotification(id) {
    const r = await fetch(`${API_BASE}/api/admin-seller-notifications/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!r.ok) throw new Error('DELETE_ADMIN_NOTIFICATION_FAILED');
    return true;
  },

  /**
   * دریافت تعداد پیام‌های خوانده نشده ادمین
   * از endpoint /my/unread-count استفاده می‌کند که نیازی به sellerId ندارد
   */
  async getAdminNotificationsUnreadCount(sellerId = null) {
    const url = sellerId
      ? bust(`${API_BASE}/api/admin-seller-notifications/seller/${sellerId}/unread-count`)
      : bust(`${API_BASE}/api/admin-seller-notifications/my/unread-count`);
    
    const r = await fetch(url, {
      credentials: 'include',
      ...NO_CACHE
    });
    if (!r.ok && r.status !== 304) return { count: 0 };
    const data = await this._json(r);
    return { count: data?.count || 0 };
  },

  // ===== Seller Notifications API Methods (پیام‌های مشتریان و سیستم) =====
  
  /**
   * دریافت اعلان‌های فروشنده (شامل پیام‌های مشتریان)
   */
  async getSellerNotifications(options = {}) {
    const { limit = 50, skip = 0, unreadOnly = false } = options;
    const params = new URLSearchParams({ limit, skip, unreadOnly });
    const r = await fetch(bust(`${API_BASE}/api/seller/notifications?${params}`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (!r.ok && r.status !== 304) throw new Error('FETCH_SELLER_NOTIFICATIONS_FAILED');
    const data = await this._json(r);
    const arr = Array.isArray(data?.notifications) ? data.notifications : [];
    const fmt = (d) => {
      const diff = (Date.now() - new Date(d).getTime()) / 1000;
      if (diff < 3600) return `${Math.floor(diff/60)} دقیقه پیش`;
      if (diff < 86400) return `${Math.floor(diff/3600)} ساعت پیش`;
      return `${Math.floor(diff/86400)} روز پیش`;
    };
    return {
      notifications: arr.map(n => ({
        id: n._id || n.id,
        _id: n._id || n.id,
        text: n.message || '',
        message: n.message || '',
        time: n.createdAt ? fmt(n.createdAt) : '',
        createdAt: n.createdAt,
        read: !!n.read,
        type: n.type || 'info',
        title: n.title || '',
        relatedData: n.relatedData || {},
        isCustomerMessage: n.type === 'customer_message'
      })),
      unreadCount: data?.unreadCount || 0,
      total: data?.total || 0
    };
  },

  /**
   * دریافت تعداد اعلان‌های خوانده نشده فروشنده
   */
  async getSellerNotificationsUnreadCount() {
    const r = await fetch(bust(`${API_BASE}/api/seller/notifications/unread-count`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (!r.ok && r.status !== 304) return { count: 0 };
    const data = await this._json(r);
    return { count: data?.count || 0 };
  },

  /**
   * علامت‌گذاری اعلان فروشنده به عنوان خوانده شده
   */
  async markSellerNotificationRead(id) {
    const r = await fetch(`${API_BASE}/api/seller/notifications/${id}/read`, {
      method: 'PUT',
      credentials: 'include'
    });
    if (!r.ok) throw new Error('MARK_SELLER_NOTIFICATION_READ_FAILED');
    return true;
  },

  /**
   * علامت‌گذاری همه اعلان‌های فروشنده به عنوان خوانده شده
   */
  async markAllSellerNotificationsRead() {
    const r = await fetch(`${API_BASE}/api/seller/notifications/mark-all-read`, {
      method: 'PUT',
      credentials: 'include'
    });
    if (!r.ok) throw new Error('MARK_ALL_SELLER_NOTIFICATIONS_READ_FAILED');
    return true;
  },

  /**
   * حذف اعلان فروشنده
   */
  async deleteSellerNotification(id) {
    const r = await fetch(`${API_BASE}/api/seller/notifications/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!r.ok) throw new Error('DELETE_SELLER_NOTIFICATION_FAILED');
    return true;
  },

  /**
   * حذف همه اعلان‌های فروشنده
   */
  async clearAllSellerNotifications() {
    const r = await fetch(`${API_BASE}/api/seller/notifications/clear-all`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!r.ok) throw new Error('CLEAR_ALL_SELLER_NOTIFICATIONS_FAILED');
    return true;
  },

  // ===== Streak API Methods =====
  
  /**
   * دریافت وضعیت استریک فروشنده
   */
  async getStreak() {
    const r = await fetch(bust(`${API_BASE}/api/streak`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (r.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (!r.ok && r.status !== 304) {
      throw new Error('FETCH_STREAK_FAILED');
    }
    const data = await this._json(r);
    return data?.data || null;
  },

  /**
   * ثبت ورود روزانه (چک‌این استریک)
   */
  async checkInStreak() {
    const r = await fetch(`${API_BASE}/api/streak/checkin`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (r.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (!r.ok) {
      throw new Error('CHECKIN_STREAK_FAILED');
    }
    const data = await this._json(r);
    return data;
  },

  /**
   * دریافت لیدربورد استریک
   */
  async getStreakLeaderboard(limit = 10) {
    const r = await fetch(bust(`${API_BASE}/api/streak/leaderboard?limit=${limit}`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (r.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (!r.ok && r.status !== 304) {
      throw new Error('FETCH_STREAK_LEADERBOARD_FAILED');
    }
    const data = await this._json(r);
    return data?.data || [];
  },

  // ===== Wallet API Methods =====
  
  /**
   * دریافت اطلاعات کیف پول فروشنده
   */
  async getWallet() {
    const r = await fetch(bust(`${API_BASE}/api/wallet`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (r.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (!r.ok && r.status !== 304) {
      throw new Error('FETCH_WALLET_FAILED');
    }
    const data = await this._json(r);
    return data?.data || null;
  },

  /**
   * دریافت تاریخچه تراکنش‌های کیف پول
   */
  async getWalletTransactions(page = 1, limit = 20) {
    const r = await fetch(bust(`${API_BASE}/api/wallet/transactions?page=${page}&limit=${limit}`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (r.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (!r.ok && r.status !== 304) {
      throw new Error('FETCH_WALLET_TRANSACTIONS_FAILED');
    }
    const data = await this._json(r);
    return data?.data || { transactions: [], pagination: {} };
  },

  /**
   * کسب اعتبار (پاداش فعالیت)
   */
  async earnWalletCredit(category, options = {}) {
    const r = await fetch(`${API_BASE}/api/wallet/earn`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, ...options })
    });
    if (r.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (!r.ok) {
      const errData = await this._json(r);
      throw new Error(errData?.message || 'EARN_CREDIT_FAILED');
    }
    const data = await this._json(r);
    return data;
  },

  /**
   * خرج اعتبار (خرید خدمات)
   */
  async spendWalletCredit(serviceType, options = {}) {
    const r = await fetch(`${API_BASE}/api/wallet/spend`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceType, ...options })
    });
    if (r.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    const data = await this._json(r);
    if (!r.ok) {
      throw { 
        status: r.status, 
        message: data?.message || 'SPEND_CREDIT_FAILED',
        data: data?.data
      };
    }
    return data;
  },

  // ==================== RANK API ====================

  /**
   * دریافت رتبه فروشنده با محاسبه معیارهای واقعی
   */
  async getMyRank() {
    const r = await fetch(bust(`${API_BASE}/api/rank/my`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (r.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (!r.ok) {
      const errData = await this._json(r);
      throw new Error(errData?.message || 'GET_RANK_FAILED');
    }
    return await this._json(r);
  },

  /**
   * دریافت لیدربورد دسته‌بندی
   */
  async getRankLeaderboard(limit = 10) {
    const r = await fetch(bust(`${API_BASE}/api/rank/leaderboard?limit=${limit}`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (r.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (!r.ok) {
      const errData = await this._json(r);
      throw new Error(errData?.message || 'GET_LEADERBOARD_FAILED');
    }
    return await this._json(r);
  },

  // ==================== SELLER PROFILE API ====================

  /**
   * به‌روزرسانی اطلاعات فروشنده (شماره تلفن، آدرس، نام کسب‌وکار)
   */
  async updateSellerProfile(data) {
    const r = await fetch(`${API_BASE}/api/sellers/me`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (r.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    const result = await this._json(r);
    if (!r.ok) {
      throw new Error(result?.message || 'UPDATE_PROFILE_FAILED');
    }
    return result;
  },

  /**
   * دریافت اطلاعات فروشنده جاری
   */
  async getSellerProfile() {
    const r = await fetch(bust(`${API_BASE}/api/sellers/me`), {
      credentials: 'include',
      ...NO_CACHE
    });
    if (r.status === 401) {
      throw { status: 401, message: 'UNAUTHORIZED' };
    }
    if (!r.ok) {
      throw new Error('GET_PROFILE_FAILED');
    }
    return await this._json(r);
  }

};

export { API, bookedCache, collectBookingKeys, createBookingKey, normalizeKeyPart, toEn, toFaDigits };
export default API;

  /**
   * ایجاد اعلان تست (فقط برای تست)
   */
  async createTestNotification() {
    const r = await fetch(`${API_BASE}/api/seller/notifications/test`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!r.ok) throw new Error('CREATE_TEST_NOTIFICATION_FAILED');
    return await this._json(r);
  },
