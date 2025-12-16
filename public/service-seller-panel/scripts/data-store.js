import { API_BASE } from './core-utils.js';
import { StorageManager } from './storage.js';

const MOCK_DATA = {
  recentActivity: [],
  bookings: [],
  customers: [],
  reviews: []
};

// داده‌های فیک حذف شدند - فقط داده‌های واقعی از سرور استفاده می‌شوند
function buildSampleCustomers() {
  return [];
}

async function loadCustomers() {
  const applyCustomers = (list) => {
    MOCK_DATA.customers = list;
    window.customersData = list.map(c => ({
      id: c.id,
      name: c.name,
      vipCurrent: c.vipCurrent,
      rewardCount: c.reviewCount ?? c.rewardCount,
      lastReservationAt: c.lastReservation,
      joinedAt: c.joinedAt,
      bookingsCount: c.bookingsCount,
      reviewCount: c.reviewCount
    }));

    if (typeof app !== 'undefined' && app.renderCustomers) {
      app.renderCustomers();
    }

    if (typeof app !== 'undefined' && app.refreshDiscountCustomers) {
      app.refreshDiscountCustomers();
      app.renderDiscounts?.();
    }

    document.dispatchEvent(new CustomEvent('customers:loaded', { detail: list }));
    document.dispatchEvent(new Event('vip:refresh'));
  };

  try {
    const res = await fetch(`${API_BASE}/api/loyalty/customers`, { credentials: 'include' });
    const data = res.ok ? await res.json() : [];

    let mapped = data.map(c => {
      const bookingsCount = Number(c.totalBookings ?? c.bookingsCount ?? c.completedBookings ?? 0);
      const reviewCount = Number(c.reviewCount ?? c.feedbackCount ?? c.reviews ?? c.rewardCount ?? 0);
      const joinedAt = c.joinedAt || c.memberSince || c.createdAt || c.lastReservation || new Date().toISOString();

      return {
        id: String(c.id || c.userId || c._id),
        name: c.name || '-',
        phone: c.phone || '-',
        lastReservation: c.lastReservation || c.lastReservationAt || '',
        joinedAt,
        bookingsCount,
        reviewCount,
        vipCurrent: c.completed || 0,
        rewardCount: c.claimed || 0
      };
    });

    applyCustomers(mapped);
  } catch (err) {
    console.error('loadCustomers', err);
    // در صورت خطا، آرایه خالی برگردان - بدون داده فیک
    applyCustomers([]);
  }
}

function persistBookings() {
  try {
    StorageManager.set('vitreenet-bookings', MOCK_DATA.bookings);
  } catch (e) {
    console.error('Error persisting bookings', e);
  }
}

export { MOCK_DATA, buildSampleCustomers, loadCustomers, persistBookings };
