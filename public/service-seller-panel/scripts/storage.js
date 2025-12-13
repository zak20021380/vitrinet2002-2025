// Safe session storage helpers
const SafeSS = {
  setJSON(key, value, opts = {}) {
    const str = JSON.stringify(value);
    if (str.length > 500 * 1024) return false;
    try { sessionStorage.setItem(key, str); return true; }
    catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        const prefix = /^vt:(?:cache|logs|tmp):/;
        const items = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (prefix.test(k)) {
            const v = sessionStorage.getItem(k) || '';
            items.push({ key: k, size: v.length });
          }
        }
        items.sort((a, b) => b.size - a.size);
        for (const it of items) sessionStorage.removeItem(it.key);
        try { sessionStorage.setItem(key, str); return true; }
        catch (e2) { console.warn('SafeSS quota exceeded', e2); return false; }
      }
      console.warn('SafeSS setJSON failed', e);
      return false;
    }
  },
  getJSON(key, fallback = null) {
    try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  }
};

function auditSessionStorage() {
  const rows = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    const v = sessionStorage.getItem(k) || '';
    rows.push({ key: k, bytes: v.length });
  }
  rows.sort((a, b) => b.bytes - a.bytes);
  console.table(rows);
}

class StorageManager {
  static get(key) {
    try {
      const lsItem = localStorage.getItem(key);
      if (lsItem !== null) return JSON.parse(lsItem);
      return SafeSS.getJSON(key, null);
    } catch (e) {
      console.error('Error getting from storage', e);
      return null;
    }
  }

  static set(key, value) {
    const data = JSON.stringify(value);
    try {
      localStorage.setItem(key, data);
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        console.warn('localStorage quota exceeded, using sessionStorage instead');
        SafeSS.setJSON(key, value);
      } else {
        console.error('Error setting to localStorage', e);
      }
    }
  }
}

const normalizeKey = (s) => (s || '').toString().trim().toLowerCase();

const CustomerPrefs = {
  _KEY: 'vit_customer_prefs',
  load() { return StorageManager.get(this._KEY) || {}; },
  save(data) { StorageManager.set(this._KEY, data); },
  getByName(name) {
    const all = this.load();
    return all[normalizeKey(name)] || { autoAccept: false, blocked: false };
  },
  setByName(name, patch) {
    const k = normalizeKey(name);
    const all = this.load();
    all[k] = { ...(all[k] || { autoAccept: false, blocked: false }), ...patch };
    this.save(all);
  }
};

class DiscountStore {
  constructor(key = 'vit_seller_discounts') {
    this._KEY = key;
  }

  load() { return StorageManager.get(this._KEY) || []; }
  save(list) { StorageManager.set(this._KEY, list); }

  purgeExpired(now = new Date()) {
    const active = this.load().filter(item => new Date(item.expiresAt) > now);
    this.save(active);
    return active;
  }

  getActive(now = new Date()) {
    return this.purgeExpired(now).sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));
  }

  upsert(discount) {
    const items = this.getActive().filter(d => d.id !== discount.id && d.customerId !== discount.customerId);
    items.push(discount);
    this.save(items);
  }

  remove(id) {
    const items = this.getActive().filter(d => d.id !== id);
    this.save(items);
  }
}

export { SafeSS, auditSessionStorage, StorageManager, CustomerPrefs, DiscountStore };
