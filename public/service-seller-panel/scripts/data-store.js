import { API_BASE } from './core-utils.js';
import { StorageManager } from './storage.js';

const MOCK_DATA = {
  recentActivity: [],
  bookings: [],
  customers: [],
  reviews: []
};

function buildSampleCustomers() {
  const baseDate = new Date();
  const daysAgo = (d) => {
    const copy = new Date(baseDate);
    copy.setDate(copy.getDate() - d);
    return copy.toISOString();
  };

  return [
    { id: 'c-101', name: 'امیر محمدی', phone: '۰۹۱۲۳۴۵۶۷۸۹', bookingsCount: 12, reviewCount: 4, joinedAt: daysAgo(320), lastReservation: daysAgo(3) },
    { id: 'c-102', name: 'نسترن حیدری', phone: '۰۹۳۵۴۳۲۱۵۴۵', bookingsCount: 7, reviewCount: 2, joinedAt: daysAgo(45), lastReservation: daysAgo(9), vipCurrent: 2 },
    { id: 'c-103', name: 'حسین مرادی', phone: '۰۹۱۳۳۳۳۳۳۳۳', bookingsCount: 3, reviewCount: 1, joinedAt: daysAgo(18), lastReservation: daysAgo(2) },
    { id: 'c-104', name: 'شیما مقدم', phone: '۰۹۱۲۴۴۴۴۳۳۳', bookingsCount: 15, reviewCount: 6, joinedAt: daysAgo(600), lastReservation: daysAgo(40), rewardCount: 3 },
    { id: 'c-105', name: 'سینا احدی', phone: '۰۹۰۱۱۲۲۲۳۳۴', bookingsCount: 1, reviewCount: 0, joinedAt: daysAgo(10), lastReservation: daysAgo(8) },
    { id: 'c-106', name: 'الهام کاظمی', phone: '۰۹۱۹۸۷۶۵۴۳۲', bookingsCount: 9, reviewCount: 5, joinedAt: daysAgo(120), lastReservation: daysAgo(14) }
  ];
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

    if (!mapped.length) {
      mapped = buildSampleCustomers();
    }

    applyCustomers(mapped);
  } catch (err) {
    console.error('loadCustomers', err);
    applyCustomers(buildSampleCustomers());
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
