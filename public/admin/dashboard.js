const ADMIN_API_BASE = "http://localhost:5000/api";
const ADMIN_API_ORIGIN = "http://localhost:5000";
const SHOPPING_CENTER_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#ecfdf5"/><stop offset="100%" stop-color="#e0f2fe"/>' +
    '</linearGradient></defs>' +
    '<rect width="640" height="360" fill="url(#g)"/>' +
    '<text x="50%" y="52%" font-family="Vazirmatn,Arial" font-size="36" fill="#0ea5e9"' +
    ' text-anchor="middle">Shopping Center</text>' +
    '</svg>'
  );
// اگر admin_token ست نشده، از کلید token هم استفاده کن

let messagesInterval = null;
let badgeInterval = null; // ⬅️ تایمر مجزا برای بج

/**
 * شروع polling پیام‌ها هر 5 ثانیه
 */
function startMessagesPolling() {
  // اگر قبلاً یک polling فعال است، آن را متوقف کن
  if (messagesInterval) clearInterval(messagesInterval);
  // فوراً یک‌بار پیام‌ها را بگیر
  fetchMessages().catch(console.error);
  // سپس هر 5 ثانیه یک‌بار
  messagesInterval = setInterval(() => {
    fetchMessages().catch(console.error);
  }, 5000);
}

/**
 * متوقف کردن polling
 */
function stopMessagesPolling() {
  if (messagesInterval) {
    clearInterval(messagesInterval);
    messagesInterval = null;
  }
}




/* بعد از const token = … این را اضافه کن */
function toIdString(raw) {
  if (!raw) return '';

  if (typeof raw === 'string') return raw;

  if (typeof raw === 'object') {
    if (raw.$oid) return String(raw.$oid);
    if (raw._id) return String(raw._id);
    if (raw.id) return String(raw.id);

    if (typeof raw.toString === 'function') {
      return raw.toString();
    }
  }

  return String(raw);
}

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return numberFormatter.format(0);
  return numberFormatter.format(num);
}

function formatPercent(part, total) {
  const partNum = Number(part);
  const totalNum = Number(total);
  if (!Number.isFinite(partNum) || !Number.isFinite(totalNum) || totalNum === 0) {
    return '0٪';
  }
  return `${Math.round((partNum / totalNum) * 100)}٪`;
}

async function copyToClipboard(value) {
  if (value == null) return false;
  const text = String(value);
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('copyToClipboard clipboard API failed', err);
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const result = document.execCommand('copy');
    document.body.removeChild(textarea);
    return result;
  } catch (err) {
    console.warn('copyToClipboard fallback failed', err);
    return false;
  }
}

function toAbsoluteMediaUrl(path, fallback = SHOPPING_CENTER_PLACEHOLDER) {
  if (!path) return fallback;
  const str = String(path);
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:')) {
    return str;
  }
  if (str.startsWith('/')) {
    return `${ADMIN_API_ORIGIN}${str}`;
  }
  return `${ADMIN_API_ORIGIN}/${str.replace(/^\/+/, '')}`;
}

function getShoppingCenterId(center) {
  if (!center) return '';
  return toIdString(center.centerId || center._id || center.id || center._id?.$oid || '');
}

function normalizeShoppingCenter(center = {}) {
  if (!center || typeof center !== 'object') return null;
  const normalised = { ...center };
  normalised.centerId = getShoppingCenterId(center);
  normalised.title = normalised.title || normalised.name || 'بدون نام';
  const orderNum = Number(normalised.order);
  normalised.order = Number.isFinite(orderNum) ? orderNum : 0;
  const storesNum = Number(normalised.stores);
  normalised.stores = Number.isFinite(storesNum) ? storesNum : 0;
  return normalised;
}

function sortShoppingCenters(list = []) {
  return [...list].sort((a, b) => {
    const orderA = Number.isFinite(a?.order) ? a.order : 0;
    const orderB = Number.isFinite(b?.order) ? b.order : 0;
    if (orderA !== orderB) return orderA - orderB;
    const dateA = new Date(a?.createdAt || 0).getTime();
    const dateB = new Date(b?.createdAt || 0).getTime();
    return dateB - dateA;
  });
}

function upsertShoppingCenterLocal(center) {
  const normalised = normalizeShoppingCenter(center);
  if (!normalised) return;
  const id = getShoppingCenterId(normalised);
  let updated = false;
  shoppingCentersList = shoppingCentersList.map(existing => {
    if (getShoppingCenterId(existing) === id) {
      updated = true;
      return { ...existing, ...normalised };
    }
    return existing;
  });
  if (!updated) {
    shoppingCentersList.push(normalised);
  }
  shoppingCentersList = sortShoppingCenters(shoppingCentersList);
}

function removeShoppingCenterLocal(id) {
  const normalisedId = toIdString(id);
  if (!normalisedId) return;
  shoppingCentersList = shoppingCentersList.filter(center => getShoppingCenterId(center) !== normalisedId);
}

async function fetchShoppingCenters() {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/shopping-centers`, { credentials: 'include' });
    if (!res.ok) {
      console.error('fetchShoppingCenters – HTTP-', res.status, await res.text());
      return [];
    }
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    const list = data
      .map(normalizeShoppingCenter)
      .filter(Boolean);
    return sortShoppingCenters(list);
  } catch (err) {
    console.error('fetchShoppingCenters – EXCEPTION', err);
    return [];
  }
}

function createShoppingCenterMetaRow(iconClass, text) {
  if (!text) return null;
  const span = document.createElement('span');
  const icon = document.createElement('i');
  icon.className = iconClass;
  span.appendChild(icon);
  span.appendChild(document.createTextNode(` ${text}`));
  return span;
}

function renderShoppingCenters() {
  const cardsWrap = document.getElementById('shoppingCentersCards');
  const emptyState = document.getElementById('shoppingCentersEmpty');
  if (!cardsWrap || !emptyState) return;

  cardsWrap.innerHTML = '';

  if (!shoppingCentersList.length) {
    cardsWrap.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  cardsWrap.style.display = 'grid';
  emptyState.style.display = 'none';

  shoppingCentersList.forEach(center => {
    const card = document.createElement('div');
    card.className = 'shopping-center-card';

    const img = document.createElement('img');
    img.src = toAbsoluteMediaUrl(center.image, SHOPPING_CENTER_PLACEHOLDER);
    img.alt = center.title || 'مرکز خرید';
    card.appendChild(img);

    const body = document.createElement('div');
    body.className = 'shopping-center-body';

    const title = document.createElement('h4');
    title.textContent = center.title || 'مرکز خرید';
    body.appendChild(title);

    if (center.tag) {
      const tag = document.createElement('span');
      tag.className = 'shopping-center-tag';
      tag.textContent = center.tag;
      body.appendChild(tag);
    }

    if (center.description) {
      const desc = document.createElement('p');
      desc.className = 'shopping-center-desc';
      desc.textContent = center.description;
      body.appendChild(desc);
    }

    const meta = document.createElement('div');
    meta.className = 'shopping-center-meta';
    const storesRow = createShoppingCenterMetaRow('ri-store-2-line', `${formatNumber(center.stores)} فروشگاه`);
    if (storesRow) meta.appendChild(storesRow);
    const locationRow = createShoppingCenterMetaRow('ri-map-pin-2-line', center.location);
    if (locationRow) meta.appendChild(locationRow);
    const hoursRow = createShoppingCenterMetaRow('ri-time-line', center.hours);
    if (hoursRow) meta.appendChild(hoursRow);
    const holidayRow = createShoppingCenterMetaRow('ri-calendar-event-line', center.holidays);
    if (holidayRow) meta.appendChild(holidayRow);
    if (meta.childNodes.length) {
      body.appendChild(meta);
    }

    const actions = document.createElement('div');
    actions.className = 'shopping-center-actions';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete';
    deleteBtn.innerHTML = '<i class="ri-delete-bin-line"></i> حذف';
    const id = getShoppingCenterId(center);
    deleteBtn.addEventListener('click', () => window.deleteShoppingCenter(id));
    actions.appendChild(deleteBtn);
    body.appendChild(actions);

    card.appendChild(body);
    cardsWrap.appendChild(card);
  });
}

function setShoppingCenterFormMessage(message, type = 'success', timeout = 3500) {
  const box = document.getElementById('shoppingCenterFormMessage');
  if (!box) return;

  if (shoppingCenterFormMessageTimer) {
    clearTimeout(shoppingCenterFormMessageTimer);
    shoppingCenterFormMessageTimer = null;
  }

  if (!message) {
    box.style.display = 'none';
    return;
  }

  const styles = {
    success: { bg: '#ecfdf5', color: '#047857' },
    error:   { bg: '#fee2e2', color: '#dc2626' },
    info:    { bg: '#e0f2fe', color: '#0369a1' }
  };
  const palette = styles[type] || styles.success;
  box.textContent = message;
  box.style.background = palette.bg;
  box.style.color = palette.color;
  box.style.display = 'block';

  if (timeout > 0) {
    shoppingCenterFormMessageTimer = setTimeout(() => {
      box.style.display = 'none';
      shoppingCenterFormMessageTimer = null;
    }, timeout);
  }
}

async function ensureShoppingCentersLoaded(force = false) {
  if (force) {
    shoppingCentersLoaded = false;
    shoppingCentersLoadingPromise = null;
  }

  if (shoppingCentersLoaded && !force) {
    return shoppingCentersList;
  }

  if (!shoppingCentersLoadingPromise) {
    shoppingCentersLoadingPromise = (async () => {
      const list = await fetchShoppingCenters();
      shoppingCentersList = list;
      shoppingCentersLoaded = true;
      renderShoppingCenters();
      updateSidebarCounts();
      updateHeaderCounts();
      return list;
    })().finally(() => {
      shoppingCentersLoadingPromise = null;
    });
  }

  return shoppingCentersLoadingPromise;
}

async function handleShoppingCenterSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  const title = String(formData.get('title') || '').trim();
  if (!title) {
    setShoppingCenterFormMessage('لطفاً نام مرکز خرید را وارد کنید.', 'error');
    return;
  }

  try {
    setShoppingCenterFormMessage('در حال ثبت مرکز خرید...', 'info', 0);
    const res = await fetch(`${ADMIN_API_BASE}/shopping-centers`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    let data = {};
    try {
      data = await res.json();
    } catch (err) {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data?.error || data?.message || 'خطا در ذخیره مرکز خرید');
    }

    upsertShoppingCenterLocal(data);
    renderShoppingCenters();
    updateSidebarCounts();
    updateHeaderCounts();
    form.reset();
    setShoppingCenterFormMessage('مرکز خرید با موفقیت افزوده شد.', 'success');
  } catch (err) {
    console.error('handleShoppingCenterSubmit error:', err);
    setShoppingCenterFormMessage(`خطا: ${err.message}`, 'error', 6000);
  }
}

window.deleteShoppingCenter = async function(id) {
  const normalisedId = toIdString(id);
  if (!normalisedId) {
    alert('شناسه مرکز خرید معتبر نیست.');
    return;
  }

  if (!confirm('آیا از حذف این مرکز خرید مطمئن هستید؟')) return;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/shopping-centers/${normalisedId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    let data = {};
    try {
      data = await res.json();
    } catch (err) {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data?.error || data?.message || 'خطا در حذف مرکز خرید');
    }

    removeShoppingCenterLocal(normalisedId);
    renderShoppingCenters();
    updateSidebarCounts();
    updateHeaderCounts();
    alert('✅ مرکز خرید با موفقیت حذف شد.');
  } catch (err) {
    console.error('deleteShoppingCenter error:', err);
    alert('❌ ' + err.message);
  }
};

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNoteForDisplay(note) {
  if (!note) return '';
  return escapeHtml(note).replace(/\n/g, '<br>');
}

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch (err) {
    return '';
  }
}

function toDatetimeLocalValue(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  } catch (err) {
    return '';
  }
}

function formatInputNumberValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  let str = num.toFixed(2);
  str = str.replace(/\.0+$/, '');
  str = str.replace(/\.([0-9]*?)0+$/, '.$1');
  if (str.endsWith('.')) {
    str = str.slice(0, -1);
  }
  return str;
}

function hasCustomAdDuration(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

function formatAdDuration(hours) {
  const num = Number(hours);
  if (!Number.isFinite(num) || num <= 0) return '';
  const days = Math.floor(num / 24);
  const remainderRaw = num - days * 24;
  const remainder = Math.round(remainderRaw * 100) / 100;
  const parts = [];
  if (days > 0) {
    parts.push(`${formatDecimal(days)} روز`);
  }
  if (remainder > 0 || parts.length === 0) {
    const hoursValue = parts.length === 0 ? num : remainder;
    parts.push(`${formatDecimal(hoursValue)} ساعت`);
  }
  return parts.join(' و ');
}

function prepareAdDurationInput(hours) {
  const result = { value: '', unit: DEFAULT_AD_DURATION_UNIT };
  const num = Number(hours);
  if (!Number.isFinite(num) || num <= 0) {
    return result;
  }
  if (Math.abs(num % 24) < 1e-6) {
    result.value = formatInputNumberValue(num / 24);
    result.unit = 'days';
    return result;
  }
  result.value = formatInputNumberValue(num);
  result.unit = 'hours';
  return result;
}

function parseAdDurationForm(valueInput, unitInput) {
  const rawValue = valueInput ? valueInput.value.trim() : '';
  const unit = (unitInput ? unitInput.value : DEFAULT_AD_DURATION_UNIT) || DEFAULT_AD_DURATION_UNIT;
  if (!rawValue) {
    return { hours: null, isEmpty: true };
  }
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return { error: 'مدت نمایش وارد شده معتبر نیست.' };
  }
  const hours = unit === 'hours' ? numericValue : numericValue * 24;
  return { hours, isEmpty: false };
}

function durationsNearlyEqual(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) < 0.01;
}









// -------- مدیریت دسته‌بندی‌ها --------
const CATEGORY_API_URL = `${ADMIN_API_BASE}/categories`;
const CATEGORY_STORAGE_KEY = 'admin.categories.list';
const SERVICE_SUBCATEGORY_STORAGE_KEY = 'admin.categories.services';
const POST_FORM_CATEGORY_CACHE_KEY = 'post.categories.cache';
const POST_FORM_SERVICE_CACHE_KEY = 'post.serviceSubcategories.cache';
const DEFAULT_CATEGORIES = [
  'پوشاک',
  'خوراک',
  'خدمات',
  'دیجیتال',
  'زیبایی',
  'کتاب و تحریر',
  'لوازم خانگی',
  'ورزشی',
  'تالار و مجالس',
  'قنادی و شیرینی',
  'گل و گیاه',
  'خودرو',
  'کودکان'
];

const DEFAULT_SERVICE_CATEGORY_NAME = 'خدمات';
const DEFAULT_SERVICE_SUBCATEGORIES = [
  { name: 'آرایشگاه مردانه', parentName: DEFAULT_SERVICE_CATEGORY_NAME },
  { name: 'آرایشگاه زنانه', parentName: DEFAULT_SERVICE_CATEGORY_NAME },
  { name: 'کارواش', parentName: DEFAULT_SERVICE_CATEGORY_NAME },
  { name: 'کلینیک زیبایی', parentName: DEFAULT_SERVICE_CATEGORY_NAME },
  { name: 'تعمیر موبایل', parentName: DEFAULT_SERVICE_CATEGORY_NAME },
  { name: 'خیاطی', parentName: DEFAULT_SERVICE_CATEGORY_NAME }
];
const DEFAULT_SERVICE_SUBCATEGORY_NAMES = DEFAULT_SERVICE_SUBCATEGORIES.map(item => item.name);
const DEFAULT_SERVICE_PARENT_MAP = DEFAULT_SERVICE_SUBCATEGORIES.reduce((acc, item) => {
  if (item && item.name) {
    acc[item.name] = item.parentName || DEFAULT_SERVICE_CATEGORY_NAME;
  }
  return acc;
}, {});

let categoryManagerState = {
  categories: [],
  serviceSubcategories: []
};

let categoryManagerInitialised = false;
let categoryFeedbackTimer = null;

function normaliseCategoryText(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function getCategoryName(item) {
  if (!item) return '';
  if (typeof item === 'string') return normaliseCategoryText(item);
  return normaliseCategoryText(item.name || item.label || item.title || '');
}

function getCategoryId(item) {
  if (!item) return '';
  if (typeof item === 'string') return '';
  return toIdString(item._id || item.id || item.categoryId || item.value || '');
}

function getCategoryType(item) {
  if (!item) return 'category';
  if (typeof item === 'string') return 'category';
  return item.type || 'category';
}

function getCategoryParentId(item) {
  if (!item) return '';
  if (typeof item === 'string') return '';
  return toIdString(
    item.parentId
      || item.parentID
      || item.parent
      || item.parentCategory
      || item.parentCategoryId
      || item.parentCategoryID
      || (item.parent && (item.parent._id || item.parent.id))
      || ''
  );
}

function getCategoryParentName(item) {
  if (!item) return '';
  if (typeof item === 'string') return DEFAULT_SERVICE_PARENT_MAP[item] || '';
  const value = item.parentName
    || item.parentLabel
    || item.parentTitle
    || (item.parent && (item.parent.name || item.parent.title))
    || '';
  return normaliseCategoryText(value);
}

function getCategoryParentKey(item) {
  const parentId = getCategoryParentId(item);
  if (parentId) return parentId;
  const parentName = getCategoryParentName(item);
  return parentName ? parentName.toLocaleLowerCase('fa-IR') : '';
}

function matchesParent(item, filter) {
  if (!filter) return true;
  const type = getCategoryType(item);
  if (type !== 'service-subcategory') return true;
  const itemParentId = getCategoryParentId(item);
  const itemParentName = getCategoryParentName(item);
  const filterId = filter.id ? toIdString(filter.id) : filter.parentId ? toIdString(filter.parentId) : '';
  const filterName = filter.name
    ? normaliseCategoryText(filter.name)
    : filter.parentName
      ? normaliseCategoryText(filter.parentName)
      : '';
  if (filterId) {
    return itemParentId ? itemParentId === filterId : false;
  }
  if (itemParentId) {
    return false;
  }
  if (filterName) {
    return itemParentName ? itemParentName === filterName : false;
  }
  return !itemParentName;
}

function isDefaultCategory(item) {
  const name = getCategoryName(item);
  const type = getCategoryType(item);
  if (typeof item?.isDefault === 'boolean') {
    return item.isDefault;
  }
  return type === 'service-subcategory'
    ? DEFAULT_SERVICE_SUBCATEGORY_NAMES.includes(name)
    : DEFAULT_CATEGORIES.includes(name);
}

function normalizeCategoryRecord(raw, fallbackType = 'category') {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const name = normaliseCategoryText(raw);
    if (!name) return null;
    return {
      _id: null,
      id: null,
      name,
      type: fallbackType,
      isDefault: fallbackType === 'service-subcategory'
        ? DEFAULT_SERVICE_SUBCATEGORY_NAMES.includes(name)
        : DEFAULT_CATEGORIES.includes(name),
      parentId: null,
      parentName: fallbackType === 'service-subcategory'
        ? DEFAULT_SERVICE_PARENT_MAP[name] || ''
        : ''
    };
  }

  const name = getCategoryName(raw);
  if (!name) return null;
  const type = raw.type || fallbackType;
  const id = getCategoryId(raw);
  const parentId = getCategoryParentId(raw) || null;
  const parentName = getCategoryParentName(raw) || (type === 'service-subcategory'
    ? DEFAULT_SERVICE_PARENT_MAP[name] || ''
    : '');

  return {
    _id: id || null,
    id: id || null,
    name,
    type,
    isDefault: typeof raw.isDefault === 'boolean' ? raw.isDefault : isDefaultCategory({ ...raw, name, type }),
    slug: raw.slug || null,
    parentId: parentId || null,
    parentName
  };
}

function normalizeCategoryList(items = [], fallbackType = 'category') {
  const unique = new Map();
  items.forEach(item => {
    const record = normalizeCategoryRecord(item, fallbackType);
    if (!record) return;
    const nameKey = getCategoryName(record).toLocaleLowerCase('fa-IR');
    const parentKey = getCategoryType(record) === 'service-subcategory' ? getCategoryParentKey(record) : '';
    const key = parentKey ? `${nameKey}__${parentKey}` : nameKey;
    if (!key) return;
    if (!unique.has(key)) {
      unique.set(key, record);
      return;
    }
    const current = unique.get(key);
    if (!getCategoryId(current) && getCategoryId(record)) {
      unique.set(key, record);
    }
  });
  return Array.from(unique.values());
}

function sortCategoryList(list = []) {
  return [...list].sort((a, b) => getCategoryName(a).localeCompare(getCategoryName(b), 'fa-IR', { sensitivity: 'base' }));
}

function loadCategoryList(key, fallback = [], type = 'category') {
  try {
    if (typeof localStorage === 'undefined') {
      return sortCategoryList(normalizeCategoryList(fallback, type));
    }
    const raw = localStorage.getItem(key);
    if (!raw) {
      return sortCategoryList(normalizeCategoryList(fallback, type));
    }
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
    const normalised = normalizeCategoryList(list, type);
    if (!normalised.length) {
      return sortCategoryList(normalizeCategoryList(fallback, type));
    }
    return sortCategoryList(normalised);
  } catch (err) {
    console.warn('loadCategoryList error ->', err);
    return sortCategoryList(normalizeCategoryList(fallback, type));
  }
}

function saveCategoryList(key, list) {
  try {
    if (typeof localStorage === 'undefined') return;
    const payload = Array.isArray(list)
      ? list.map(item => ({
          _id: getCategoryId(item) || null,
          name: getCategoryName(item),
          type: getCategoryType(item),
          isDefault: !!isDefaultCategory(item),
          slug: item && item.slug ? item.slug : null,
          parentId: getCategoryParentId(item) || null,
          parentName: getCategoryParentName(item) || null
        }))
      : [];
    localStorage.setItem(key, JSON.stringify({ items: payload, updatedAt: Date.now() }));
  } catch (err) {
    console.warn('saveCategoryList error ->', err);
  }
}

function mapForPostFormCache(item) {
  if (!item) {
    return null;
  }
  const name = getCategoryName(item);
  if (!name) {
    return null;
  }
  return {
    id: getCategoryId(item) || '',
    name,
    type: getCategoryType(item),
    isDefault: !!isDefaultCategory(item),
    parentId: getCategoryParentId(item) || '',
    parentName: getCategoryParentName(item) || ''
  };
}

function savePostFormCache(key, list) {
  try {
    if (typeof localStorage === 'undefined') return;
    const items = Array.isArray(list)
      ? list
          .map(mapForPostFormCache)
          .filter(Boolean)
      : [];
    const payload = { items, updatedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.warn('savePostFormCache error ->', err);
  }
}

function syncPostFormCategoryCache() {
  savePostFormCache(POST_FORM_CATEGORY_CACHE_KEY, categoryManagerState.categories);
  savePostFormCache(POST_FORM_SERVICE_CACHE_KEY, categoryManagerState.serviceSubcategories);
}

function listIncludesCaseInsensitive(list = [], value = '', { parentId = '', parentName = '' } = {}) {
  const compare = value.toLocaleLowerCase('fa-IR');
  const resolvedParentId = parentId ? toIdString(parentId) : '';
  const resolvedParentName = parentName ? normaliseCategoryText(parentName).toLocaleLowerCase('fa-IR') : '';
  return list.some(item => {
    if (getCategoryName(item).toLocaleLowerCase('fa-IR') !== compare) {
      return false;
    }
    if (getCategoryType(item) !== 'service-subcategory') {
      return true;
    }
    const itemParentId = getCategoryParentId(item);
    const itemParentName = getCategoryParentName(item).toLocaleLowerCase('fa-IR');
    if (resolvedParentId) {
      if (itemParentId) {
        return itemParentId === resolvedParentId;
      }
      return false;
    }
    if (itemParentId) {
      return false;
    }
    if (resolvedParentName) {
      return itemParentName === resolvedParentName;
    }
    return !itemParentName;
  });
}

function renderChipList(
  container,
  items = [],
  { removable = true, type = 'category', filterParent = null, showParent = type === 'service-subcategory' } = {}
) {
  if (!container) return;
  container.innerHTML = '';
  const normalisedItems = normalizeCategoryList(items, type);
  const filteredItems = filterParent ? normalisedItems.filter(item => matchesParent(item, filterParent)) : normalisedItems;
  if (!filteredItems.length) {
    container.classList.add('empty');
    return;
  }
  container.classList.remove('empty');
  filteredItems.forEach(item => {
    const name = getCategoryName(item);
    if (!name) return;
    const chip = document.createElement('div');
    chip.className = 'chip-item';
    const isDefault = isDefaultCategory(item);
    if (isDefault) {
      chip.classList.add('chip-item-default');
    }
    const label = document.createElement('span');
    const parentName = showParent ? getCategoryParentName(item) : '';
    label.textContent = parentName && type === 'service-subcategory' ? `${name} (${parentName})` : name;
    chip.appendChild(label);
    if (removable) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.action = 'remove-category';
      btn.dataset.type = type;
      btn.dataset.name = name;
      const id = getCategoryId(item);
      if (id) {
        btn.dataset.id = id;
      }
      btn.dataset.isDefault = isDefault ? 'true' : 'false';
      btn.title = `حذف ${name}`;
      btn.setAttribute('aria-label', `حذف ${name}`);
      const icon = document.createElement('i');
      icon.className = 'ri-close-circle-line';
      btn.appendChild(icon);
      chip.appendChild(btn);
    }
    container.appendChild(chip);
  });
}

function updateCategoryMetrics() {
  const categoriesCountEl = document.getElementById('categories-count');
  const servicesCountEl = document.getElementById('service-subcategories-count');
  if (categoriesCountEl) {
    categoriesCountEl.textContent = numberFormatter.format(categoryManagerState.categories.length);
  }
  if (servicesCountEl) {
    servicesCountEl.textContent = numberFormatter.format(categoryManagerState.serviceSubcategories.length);
  }
}

function updateCategoryPreview() {
  const select = document.getElementById('categoryPreviewSelect');
  const chips = document.getElementById('servicePreviewChips');
  if (select) {
    const previousOption = select.options[select.selectedIndex];
    const previousId = select.dataset.selectedId || (previousOption && previousOption.dataset.id) || '';
    const previousName = select.dataset.selectedName || (previousOption && previousOption.value) || '';
    select.innerHTML = '';
    if (!categoryManagerState.categories.length) {
      const option = document.createElement('option');
      option.textContent = 'دسته‌ای تعریف نشده است';
      option.disabled = true;
      option.selected = true;
      select.appendChild(option);
      select.disabled = true;
      select.dataset.selectedId = '';
      select.dataset.selectedName = '';
    } else {
      const placeholder = document.createElement('option');
      placeholder.textContent = 'انتخاب دسته';
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);
      categoryManagerState.categories.forEach(item => {
        const option = document.createElement('option');
        const name = getCategoryName(item);
        option.value = name;
        option.textContent = name;
        const id = getCategoryId(item);
        if (id) {
          option.dataset.id = id;
        }
        if (id && previousId && id === previousId) {
          option.selected = true;
          placeholder.selected = false;
        } else if (!previousId && previousName && name === previousName) {
          option.selected = true;
          placeholder.selected = false;
        }
        select.appendChild(option);
      });
      select.disabled = false;
      const selectedOption = select.options[select.selectedIndex];
      select.dataset.selectedId = selectedOption?.dataset.id || '';
      select.dataset.selectedName = selectedOption?.value || '';
      if (!select.dataset.previewBound) {
        select.addEventListener('change', () => {
          const currentOption = select.options[select.selectedIndex];
          select.dataset.selectedId = currentOption?.dataset.id || '';
          select.dataset.selectedName = currentOption?.value || '';
          updateCategoryPreview();
        });
        select.dataset.previewBound = 'true';
      }
    }
  }
  if (chips) {
    const selectedOption = select && select.options[select.selectedIndex];
    const filterParent = selectedOption && selectedOption.dataset.id
      ? { id: selectedOption.dataset.id }
      : selectedOption && selectedOption.value
        ? { name: selectedOption.value }
        : null;
    renderChipList(chips, categoryManagerState.serviceSubcategories, {
      removable: false,
      type: 'service-subcategory',
      filterParent,
      showParent: false
    });
  }
}

function updateServiceParentOptions() {
  const select = document.getElementById('serviceSubcategoryParent');
  if (!select) return;
  const previousId = select.dataset.selectedId || '';
  const previousName = select.dataset.selectedName || '';
  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.textContent = categoryManagerState.categories.length
    ? 'انتخاب دسته اصلی'
    : 'ابتدا دسته اصلی را بسازید';
  select.appendChild(placeholder);

  if (!categoryManagerState.categories.length) {
    placeholder.selected = true;
    select.disabled = true;
    select.dataset.selectedId = '';
    select.dataset.selectedName = '';
    return;
  }

  let matched = false;
  categoryManagerState.categories.forEach(item => {
    const option = document.createElement('option');
    const id = getCategoryId(item);
    const name = getCategoryName(item);
    option.value = id || name;
    if (id) {
      option.dataset.id = id;
    }
    option.dataset.name = name;
    option.textContent = name;
    if (!matched) {
      if (previousId && id && id === previousId) {
        option.selected = true;
        matched = true;
      } else if (!previousId && previousName && name === previousName) {
        option.selected = true;
        matched = true;
      }
    }
    select.appendChild(option);
  });

  if (!matched) {
    placeholder.selected = true;
    select.dataset.selectedId = '';
    select.dataset.selectedName = '';
  } else {
    const selectedOption = select.options[select.selectedIndex];
    select.dataset.selectedId = selectedOption?.dataset.id || '';
    select.dataset.selectedName = selectedOption?.dataset.name || selectedOption?.textContent || '';
  }

  select.disabled = false;
}

function persistCategoryState() {
  saveCategoryList(CATEGORY_STORAGE_KEY, categoryManagerState.categories);
  saveCategoryList(SERVICE_SUBCATEGORY_STORAGE_KEY, categoryManagerState.serviceSubcategories);
  syncPostFormCategoryCache();
}

function showCategoryFeedback(type, message) {
  const feedback = document.getElementById('categoryManagerFeedback');
  if (!feedback || !message) return;
  feedback.textContent = message;
  feedback.className = `category-feedback show ${type || 'info'}`;
  if (categoryFeedbackTimer) {
    clearTimeout(categoryFeedbackTimer);
  }
  categoryFeedbackTimer = setTimeout(() => {
    feedback.className = 'category-feedback';
    feedback.textContent = '';
  }, 3500);
}

async function fetchCategoryListsFromApi({ silent = false } = {}) {
  try {
    const res = await fetch(CATEGORY_API_URL, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    const payload = data && typeof data === 'object' ? data : {};
    if (!res.ok) {
      throw new Error(payload?.message || 'خطا در دریافت دسته‌بندی‌ها.');
    }
    const categories = sortCategoryList(normalizeCategoryList(payload?.categories, 'category'));
    const serviceSubcategories = sortCategoryList(normalizeCategoryList(payload?.serviceSubcategories, 'service-subcategory'));

    if (Object.prototype.hasOwnProperty.call(payload, 'categories')) {
      categoryManagerState.categories = categories;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'serviceSubcategories')) {
      categoryManagerState.serviceSubcategories = serviceSubcategories;
    }
    persistCategoryState();
    renderCategoryManager();
    if (!silent) {
      showCategoryFeedback('success', 'لیست دسته‌بندی با سرور به‌روزرسانی شد.');
    }
  } catch (error) {
    console.error('fetchCategoryListsFromApi ->', error);
    if (!silent) {
      showCategoryFeedback('error', error.message || 'خطا در دریافت دسته‌بندی‌ها.');
    }
  }
}

async function createCategoryOnServer(name, type, extra = {}) {
  const label = type === 'service-subcategory' ? 'زیرگروه' : 'دسته';
  try {
    const res = await fetch(CATEGORY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, type, ...extra })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || `خطا در ثبت ${label}.`);
    }
    const record = normalizeCategoryRecord(data?.item, type);
    if (record) {
      if (type === 'service-subcategory') {
        categoryManagerState.serviceSubcategories = sortCategoryList([
          ...categoryManagerState.serviceSubcategories,
          record
        ]);
      } else {
        categoryManagerState.categories = sortCategoryList([
          ...categoryManagerState.categories,
          record
        ]);
      }
      persistCategoryState();
      renderCategoryManager();
    } else {
      await fetchCategoryListsFromApi({ silent: true });
    }
    showCategoryFeedback('success', data?.message || `${label} «${name}» با موفقیت اضافه شد.`);
  } catch (error) {
    console.error('createCategoryOnServer ->', error);
    showCategoryFeedback('error', error.message || 'خطا در ثبت دسته.');
  }
}

async function deleteCategoryOnServer(id, type, name) {
  const label = type === 'service-subcategory' ? 'زیرگروه' : 'دسته';
  try {
    const res = await fetch(`${CATEGORY_API_URL}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json().catch(() => ({}));
    const payload = data && typeof data === 'object' ? data : {};
    if (!res.ok) {
      throw new Error(payload?.message || `حذف ${label} انجام نشد.`);
    }
    const deletedType = (payload?.item && payload.item.type) || type;
    const deletedName = (payload?.item && payload.item.name) || name;
    const shouldRemove = item => getCategoryId(item) === id || getCategoryName(item) === deletedName;
    if (deletedType === 'service-subcategory') {
      categoryManagerState.serviceSubcategories = categoryManagerState.serviceSubcategories.filter(item => !shouldRemove(item));
    } else {
      categoryManagerState.categories = categoryManagerState.categories.filter(item => !shouldRemove(item));
      categoryManagerState.serviceSubcategories = categoryManagerState.serviceSubcategories.map(item => {
        const parentId = getCategoryParentId(item);
        const parentName = getCategoryParentName(item);
        if (parentId && id && parentId === id) {
          return { ...item, parentId: null, parentName: '' };
        }
        if (!parentId && parentName && parentName === name) {
          return { ...item, parentId: null, parentName: '' };
        }
        return item;
      });
    }
    persistCategoryState();
    renderCategoryManager();
    showCategoryFeedback('success', payload?.message || `${label} «${name}» حذف شد.`);
  } catch (error) {
    console.error('deleteCategoryOnServer ->', error);
    showCategoryFeedback('error', error.message || 'حذف دسته انجام نشد.');
  }
}

function handleChipRemoval(event) {
  const button = event.target.closest('button[data-action="remove-category"]');
  if (!button) return;
  if (button.disabled) return;
  const rawType = button.dataset.type || 'category';
  const type = rawType === 'service' ? 'service-subcategory' : rawType;
  const name = button.dataset.name || '';
  const id = button.dataset.id;
  const isDefault = button.dataset.isDefault === 'true';
  if (!id) {
    showCategoryFeedback('error', 'برای حذف ابتدا با سرور همگام‌سازی کنید.');
    return;
  }
  const label = type === 'service-subcategory' ? 'زیرگروه' : 'دسته';
  const confirmMessage = isDefault
    ? `این ${label} جزو گزینه‌های پیش‌فرض بوده است و با حذف آن از تمام فرم‌ها حذف می‌شود. آیا از حذف «${name}» مطمئن هستید؟`
    : `آیا از حذف ${label} «${name}» مطمئن هستید؟`;
  if (!confirm(confirmMessage)) return;
  button.disabled = true;
  deleteCategoryOnServer(id, type, name).finally(() => {
    button.disabled = false;
  });
}

function renderCategoryManager() {
  const categoriesContainer = document.getElementById('categoryManagerList');
  const servicesContainer = document.getElementById('serviceSubcategoryList');
  if (categoriesContainer) {
    renderChipList(categoriesContainer, categoryManagerState.categories, { removable: true, type: 'category' });
  }
  if (servicesContainer) {
    renderChipList(servicesContainer, categoryManagerState.serviceSubcategories, {
      removable: true,
      type: 'service-subcategory',
      showParent: true
    });
  }
  updateServiceParentOptions();
  updateCategoryMetrics();
  updateCategoryPreview();
}

function initCategoryManager() {
  if (categoryManagerInitialised) {
    renderCategoryManager();
    return;
  }

  categoryManagerState.categories = loadCategoryList(CATEGORY_STORAGE_KEY, DEFAULT_CATEGORIES, 'category');
  categoryManagerState.serviceSubcategories = loadCategoryList(
    SERVICE_SUBCATEGORY_STORAGE_KEY,
    DEFAULT_SERVICE_SUBCATEGORIES,
    'service-subcategory'
  );

  syncPostFormCategoryCache();

  const categoryForm = document.getElementById('categoryAddForm');
  const categoryInput = document.getElementById('categoryNameInput');
  if (categoryForm) {
    categoryForm.addEventListener('submit', event => {
      event.preventDefault();
      if (!categoryInput) return;
      const value = normaliseCategoryText(categoryInput.value);
      if (!value) {
        showCategoryFeedback('error', 'عنوان دسته را وارد کنید.');
        return;
      }
      if (value.length < 2) {
        showCategoryFeedback('error', 'عنوان دسته باید حداقل ۲ کاراکتر باشد.');
        return;
      }
      if (listIncludesCaseInsensitive(categoryManagerState.categories, value)) {
        showCategoryFeedback('error', `دسته «${value}» از قبل وجود دارد.`);
        return;
      }
      createCategoryOnServer(value, 'category');
      categoryForm.reset();
      categoryInput.focus();
    });
  }

  const serviceForm = document.getElementById('serviceSubcategoryForm');
  const serviceInput = document.getElementById('serviceSubcategoryInput');
  const serviceParentSelect = document.getElementById('serviceSubcategoryParent');
  if (serviceParentSelect) {
    serviceParentSelect.addEventListener('change', () => {
      const option = serviceParentSelect.options[serviceParentSelect.selectedIndex];
      serviceParentSelect.dataset.selectedId = option?.dataset.id || '';
      serviceParentSelect.dataset.selectedName = option?.dataset.name || option?.textContent || '';
    });
  }
  if (serviceForm) {
    serviceForm.addEventListener('submit', event => {
      event.preventDefault();
      if (!serviceInput) return;
      const value = normaliseCategoryText(serviceInput.value);
      if (!value) {
        showCategoryFeedback('error', 'عنوان زیرگروه را وارد کنید.');
        return;
      }
      if (value.length < 2) {
        showCategoryFeedback('error', 'عنوان زیرگروه باید حداقل ۲ کاراکتر باشد.');
        return;
      }
      const parentOption = serviceParentSelect && serviceParentSelect.options[serviceParentSelect.selectedIndex];
      const parentId = parentOption && parentOption.dataset.id ? parentOption.dataset.id : '';
      const parentName = parentOption && (parentOption.dataset.name || parentOption.textContent) ?
        normaliseCategoryText(parentOption.dataset.name || parentOption.textContent) : '';
      if (!parentId) {
        showCategoryFeedback('error', 'برای افزودن زیرگروه، ابتدا دسته اصلی معتبر را انتخاب کنید.');
        return;
      }
      if (listIncludesCaseInsensitive(categoryManagerState.serviceSubcategories, value, { parentId, parentName })) {
        showCategoryFeedback('error', `زیرگروه «${value}» از قبل وجود دارد.`);
        return;
      }
      serviceParentSelect.dataset.selectedId = parentId;
      serviceParentSelect.dataset.selectedName = parentName;
      createCategoryOnServer(value, 'service-subcategory', { parentId });
      serviceInput.value = '';
      serviceInput.focus();
    });
  }

  const categoriesContainer = document.getElementById('categoryManagerList');
  if (categoriesContainer) {
    categoriesContainer.addEventListener('click', handleChipRemoval);
  }
  const servicesContainer = document.getElementById('serviceSubcategoryList');
  if (servicesContainer) {
    servicesContainer.addEventListener('click', handleChipRemoval);
  }

  categoryManagerInitialised = true;
  renderCategoryManager();
  showCategoryFeedback('info', 'لیست دسته‌بندی‌ها برای مدیریت آماده شد.');
  fetchCategoryListsFromApi({ silent: true });
}

const numberFormatter = new Intl.NumberFormat('fa-IR');
const persianDateFormatter = new Intl.DateTimeFormat('fa-IR', { month: 'numeric', day: 'numeric' });

let dashboardSummary = {
  visitsToday: 0,
  newUsersToday: 0,
  newSellersToday: 0,
  newProductsToday: 0,
  newServiceShopsToday: 0,
  totalUsers: 0,
  totalSellers: 0,
  totalProducts: 0,
  totalServiceShops: 0,
  activeServiceShops: 0,
  pendingServiceShops: 0,
  premiumServiceShops: 0,
  generatedAt: null,
  range: null
};

let dashboardTrend = [];
let trendLabels = [];
let visitsPerDay = [];
let usersPerDay = [];
let sellersPerDay = [];
let productsPerDay = [];
let serviceShopsPerDay = [];

let usersList = [];
let shopsList = [];
let productsList = [];
let servicePlansList = [];
let shoppingCentersList = [];
let shoppingCentersLoaded = false;
let shoppingCentersLoadingPromise = null;
let shoppingCenterFormMessageTimer = null;
let productsSortMode = 'newest';  // حالت پیش‌فرض مرتب‌سازی
let productSearchQuery = '';      // کوئری جستجو (برای فیلتر)

let adOrdersList = [];
let adOrdersLoaded = false;
let adOrdersLoadingPromise = null;
let adOrdersFilter = 'all';
let adOrdersSearchTerm = '';
let adOrdersPlanFilter = 'all';
let currentAdOrderId = null;
let adModalOverlayHandler = null;

let sellerPerformanceMap = {};
let sellerPerformanceLoaded = false;

let servicePlanManagerInitialised = false;
let servicePlansLoaded = false;
let servicePlansLoading = false;
let servicePlanEditingId = null;
let servicePlanCouponsLoaded = false;
let servicePlanCouponsLoading = false;
let servicePlanCoupons = [];
let servicePlanCouponSaving = false;

const AD_PLAN_META = {
  ad_home: {
    label: 'تبلیغ صفحه اصلی',
    location: 'بخش ویژه صفحه اصلی ویترینت',
    icon: 'ri-home-smile-line',
    url: '/index.html#drag-scroll-cards'
  },
  ad_search: {
    label: 'تبلیغ جستجو',
    location: 'پاپ‌آپ جستجوی سریع صفحه اصلی',
    icon: 'ri-search-2-line',
    url: '/index.html#searchForm'
  },
  ad_products: {
    label: 'تبلیغ بین محصولات',
    location: 'صفحه لیست محصولات و نتایج جستجو',
    icon: 'ri-store-3-line',
    url: '/all-products.html'
  }
};

const AD_STATUS_META = {
  pending:  { label: 'در انتظار تایید', icon: 'ri-timer-line', className: 'pending' },
  approved: { label: 'تایید شده',      icon: 'ri-checkbox-circle-line', className: 'approved' },
  rejected: { label: 'رد شده',          icon: 'ri-close-circle-line', className: 'rejected' },
  paid:     { label: 'پرداخت شده',      icon: 'ri-bank-card-line', className: 'paid' },
  expired:  { label: 'منقضی شده',       icon: 'ri-time-line', className: 'expired' }
};

const DEFAULT_AD_DURATION_UNIT = 'days';

function normaliseSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_');
}

const AD_PLAN_LABELS = Object.keys(AD_PLAN_META).reduce((acc, key) => {
  acc[key] = AD_PLAN_META[key].label;
  return acc;
}, {});

function getAdPlanMeta(slug, fallback = 'تبلیغ ویژه') {
  const normalisedSlug = normaliseSlug(slug);
  if (normalisedSlug && AD_PLAN_META[normalisedSlug]) {
    return AD_PLAN_META[normalisedSlug];
  }
  return {
    label: fallback || 'تبلیغ ویژه',
    location: 'محل نمایش نامشخص',
    icon: 'ri-information-line',
    url: null
  };
}

function getAdPlanLabel(slug, fallback = 'تبلیغ ویژه') {
  return getAdPlanMeta(slug, fallback).label;
}

function getAdStatusMeta(status) {
  const key = normaliseSlug(status);
  if (key && AD_STATUS_META[key]) {
    return AD_STATUS_META[key];
  }
  return { label: 'نامشخص', icon: 'ri-question-line', className: 'unknown' };
}

const adOrdersTableBody = document.querySelector('#adOrdersTable tbody');
const adOrdersStatusEl = document.getElementById('adOrdersStatus');
const adOrdersPlanFilterEl = document.getElementById('adOrdersPlanFilter');
const adOrdersSearchEl = document.getElementById('adOrdersSearch');
const adOrdersRefreshBtn = document.getElementById('adOrdersRefresh');
const adOrdersHeaderCountEl = document.getElementById('header-ad-orders-count');
const adSidebarCountEl = document.getElementById('count-ad-orders');
const adTotalCountEl = document.getElementById('adTotalCount');
const adPendingCountEl = document.getElementById('adPendingCount');
const adApprovedCountEl = document.getElementById('adApprovedCount');

const currencyFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

function formatCurrency(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return '—';
  }
  return `${currencyFormatter.format(Math.round(Number(amount)))} تومان`;
}

function formatDecimal(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return decimalFormatter.format(num);
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (err) {
    return '—';
  }
}

function buildUploadsUrl(path) {
  if (!path) return '';
  if (/^https?:/i.test(path)) return path;
  const base = ADMIN_API_BASE.replace(/\/api$/, '');
  return `${base}/uploads/${path.replace(/^\/?uploads\//, '')}`;
}

function setAdOrdersStatus(message = '', type = 'info') {
  if (!adOrdersStatusEl) return;
  adOrdersStatusEl.classList.remove('info', 'success', 'error');
  if (!message) {
    adOrdersStatusEl.style.display = 'none';
    adOrdersStatusEl.textContent = '';
    return;
  }
  adOrdersStatusEl.textContent = message;
  adOrdersStatusEl.classList.add(type);
  adOrdersStatusEl.style.display = 'block';
}

function setAdOrdersLoading(isLoading) {
  if (!adOrdersTableBody) return;
  if (isLoading) {
    adOrdersTableBody.innerHTML = `<tr><td colspan="6" class="loading-row"><i class="ri-loader-4-line ri-spin"></i> در حال بارگذاری تبلیغات...</td></tr>`;
  }
}

function getOrderId(order) {
  return order ? (order._id || order.id || order.orderId || '') : '';
}

function updateAdOrdersSummary() {
  const total = adOrdersList.length;
  const pending = adOrdersList.filter(order => order.status === 'pending').length;
  const approved = adOrdersList.filter(order => order.status === 'approved').length;

  if (adTotalCountEl) adTotalCountEl.textContent = formatNumber(total);
  if (adPendingCountEl) adPendingCountEl.textContent = formatNumber(pending);
  if (adApprovedCountEl) adApprovedCountEl.textContent = formatNumber(approved);
  if (adSidebarCountEl) adSidebarCountEl.textContent = formatNumber(pending);

  if (adOrdersHeaderCountEl) {
    adOrdersHeaderCountEl.textContent = total
      ? `(${formatNumber(total)} تبلیغ | ${formatNumber(pending)} در انتظار | ${formatNumber(approved)} تایید شده)`
      : '(هیچ تبلیغی ثبت نشده)';
  }
}

function renderAdOrders() {
  if (!adOrdersTableBody) return;

  let rows = [...adOrdersList];

  if (adOrdersFilter && adOrdersFilter !== 'all') {
    rows = rows.filter(order => order.status === adOrdersFilter);
  }

  if (adOrdersPlanFilter && adOrdersPlanFilter !== 'all') {
    rows = rows.filter(order => (order.planSlug || '') === adOrdersPlanFilter);
  }

  if (adOrdersSearchTerm) {
    const term = adOrdersSearchTerm;
    rows = rows.filter(order => {
      const seller = order && typeof order.sellerId === 'object' && order.sellerId !== null ? order.sellerId : {};
      const sellerName = ((seller.storename || order.shopTitle || '')).toLowerCase();
      const sellerPhone = ((seller.phone || order.sellerPhone || '')).toLowerCase();
      const adTitle = (order.adTitle || order.planTitle || '').toLowerCase();
      const planLabel = getAdPlanLabel(order.planSlug || '', order.planTitle || '').toLowerCase();
      return (
        sellerName.includes(term) ||
        sellerPhone.includes(term) ||
        adTitle.includes(term) ||
        planLabel.includes(term)
      );
    });
  }

  rows.sort((a, b) => {
    const aTime = a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  if (!rows.length) {
    if (!adOrdersList.length) {
      adOrdersTableBody.innerHTML = `<tr><td colspan="6" class="empty-row">هنوز تبلیغی ثبت نشده است.</td></tr>`;
    } else {
      adOrdersTableBody.innerHTML = `<tr><td colspan="6" class="empty-row">هیچ تبلیغی مطابق فیلترهای انتخابی یافت نشد.</td></tr>`;
    }
    return;
  }

  const rowsHtml = rows.map(order => {
    const seller = order && typeof order.sellerId === 'object' && order.sellerId !== null ? order.sellerId : {};
    const sellerName = seller.storename || order.shopTitle || 'بدون نام';
    const sellerPhone = seller.phone || order.sellerPhone || '';
    const sellerAddress = seller.address || seller.city || '';
    const planMeta = getAdPlanMeta(order.planSlug || '', order.planTitle || 'تبلیغ ویژه');
    const planLabel = planMeta.label;
    const planIcon = planMeta.icon || 'ri-compass-3-line';
    const planLocationBadge = planMeta.location
      ? `<span class="ad-plan-location"><i class="${planIcon}"></i>${escapeHtml(planMeta.location)}</span>`
      : '';
    const statusMeta = getAdStatusMeta(order.status);
    const statusClass = statusMeta.className || 'unknown';
    const createdAt = formatDateTime(order.createdAt);
    const reviewedAt = order.reviewedAt ? formatDateTime(order.reviewedAt) : '';
    const reviewedBy = order.reviewedBy && order.reviewedBy.name ? order.reviewedBy.name : '';
    const displayedAt = order.displayedAt
      ? formatDateTime(order.displayedAt)
      : (order.approvedAt ? formatDateTime(order.approvedAt) : '');
    const expiresAt = order.expiresAt ? formatDateTime(order.expiresAt) : '';
    const orderId = escapeHtml(getOrderId(order));

    const product = order && typeof order.productId === 'object' && order.productId !== null ? order.productId : null;
    const productBadge = product
      ? `<span class="ad-cell-secondary"><i class="ri-shopping-bag-3-line"></i>${escapeHtml(product.title || 'محصول ویژه')}</span>`
      : '';

    const durationHours = Number(order.displayDurationHours);
    const hasCustomDuration = hasCustomAdDuration(durationHours);
    const durationBadges = [];
    if (hasCustomDuration) {
      durationBadges.push(`<span><i class="ri-timer-line"></i>${escapeHtml(formatAdDuration(durationHours))}</span>`);
    }
    if (expiresAt) {
      durationBadges.push(`<span><i class="ri-calendar-event-line"></i>پایان: ${escapeHtml(expiresAt)}</span>`);
    }
    const durationMetaHtml = durationBadges.length
      ? `<div class="ad-cell-secondary ad-duration-badges">${durationBadges.join('')}</div>`
      : '';

    const sellerMetaParts = [];
    if (sellerPhone) sellerMetaParts.push(`<span><i class="ri-phone-line"></i>${escapeHtml(sellerPhone)}</span>`);
    if (sellerAddress) sellerMetaParts.push(`<span><i class="ri-map-pin-line"></i>${escapeHtml(sellerAddress)}</span>`);

    const reviewNoteParts = [];
    if (reviewedAt) reviewNoteParts.push(`بررسی: ${reviewedAt}`);
    if (reviewedBy) reviewNoteParts.push(`توسط ${escapeHtml(reviewedBy)}`);
    const reviewText = reviewNoteParts.length ? reviewNoteParts.join(' | ') : 'در انتظار بررسی ادمین';

    const adText = order.adText ? `<div class="ad-text">${escapeHtml(order.adText)}</div>` : '';

    let quickActions = '';
    if (order.status === 'pending') {
      quickActions = `
        <button class="ad-action-btn approve" data-action="quick-approve" data-id="${orderId}">
          <i class="ri-checkbox-circle-line"></i> تایید سریع
        </button>
        <button class="ad-action-btn reject" data-action="quick-reject" data-id="${orderId}">
          <i class="ri-close-circle-line"></i> رد
        </button>
      `;
    } else if (order.status === 'approved') {
      quickActions = `
        <button class="ad-action-btn ghost" data-action="quick-edit" data-id="${orderId}">
          <i class="ri-edit-line"></i> ویرایش
        </button>
        <button class="ad-action-btn reject" data-action="quick-delete" data-id="${orderId}">
          <i class="ri-delete-bin-line"></i> حذف
        </button>
      `;
    }

    const displayDateHtml = displayedAt
      ? `<span class="ad-date-live"><i class="ri-calendar-check-line"></i> نمایش: ${displayedAt}</span>`
      : `<span class="ad-date-pending"><i class="ri-time-line"></i> در انتظار نمایش</span>`;

    const viewLocationButton = planMeta.url
      ? `<a class="ad-action-btn link" href="${escapeHtml(planMeta.url)}" target="_blank" rel="noopener"><i class="ri-external-link-line"></i> مشاهده صفحه</a>`
      : '';

    return `
      <tr class="ad-order-row status-${escapeHtml(statusClass)}" data-order-id="${orderId}" data-status="${escapeHtml(statusClass)}">
        <td data-column="فروشنده">
          <div class="ad-cell-primary">${escapeHtml(sellerName)}</div>
          ${sellerMetaParts.length ? `<div class="ad-cell-secondary">${sellerMetaParts.join('')}</div>` : ''}
        </td>
        <td data-column="پلن / جزئیات">
          <span class="ad-plan-pill"><i class="ri-megaphone-line"></i>${escapeHtml(planLabel)}</span>
          ${planLocationBadge}
          ${productBadge}
          <div class="ad-title">${escapeHtml(order.adTitle || order.planTitle || 'بدون عنوان')}</div>
          ${adText}
          ${durationMetaHtml}
        </td>
        <td data-column="مبلغ"><div class="ad-price">${formatCurrency(order.price)}</div></td>
        <td data-column="ثبت درخواست">
          <div class="ad-date">
            <span><i class="ri-calendar-line"></i> ثبت: ${createdAt}</span>
            ${displayDateHtml}
          </div>
        </td>
        <td data-column="آخرین وضعیت">
          <div class="ad-status-cell">
            <span class="ad-status-badge ${statusMeta.className}"><i class="${statusMeta.icon}"></i>${statusMeta.label}</span>
            <div class="ad-status-note">${reviewText}</div>
          </div>
        </td>
        <td data-column="عملیات">
          <div class="ad-actions">
            ${viewLocationButton}
            <button class="ad-action-btn ghost" data-action="view" data-id="${orderId}"><i class="ri-eye-line"></i> جزئیات</button>
            ${quickActions}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  adOrdersTableBody.innerHTML = rowsHtml;
  attachAdOrdersRowActions();
}

function attachAdOrdersRowActions() {
  if (!adOrdersTableBody) return;

  adOrdersTableBody.querySelectorAll('tr.ad-order-row').forEach(row => {
    row.addEventListener('click', event => {
      const interactive = event.target.closest('button, a, .ad-actions, [data-action]');
      if (interactive) {
        return;
      }
      const id = row.dataset.orderId;
      if (id) {
        openAdOrderModal(id);
      }
    });
  });

  adOrdersTableBody.querySelectorAll('button[data-action="view"]').forEach(btn => {
    btn.addEventListener('click', () => openAdOrderModal(btn.dataset.id));
  });

  adOrdersTableBody.querySelectorAll('button[data-action="quick-edit"]').forEach(btn => {
    btn.addEventListener('click', () => openAdOrderModal(btn.dataset.id));
  });

  adOrdersTableBody.querySelectorAll('button[data-action="quick-approve"]').forEach(btn => {
    btn.addEventListener('click', () => handleQuickAdAction(btn, 'approved'));
  });

  adOrdersTableBody.querySelectorAll('button[data-action="quick-reject"]').forEach(btn => {
    btn.addEventListener('click', () => handleQuickAdAction(btn, 'rejected'));
  });

  adOrdersTableBody.querySelectorAll('button[data-action="quick-delete"]').forEach(btn => {
    btn.addEventListener('click', () => handleQuickDelete(btn));
  });
}

function setButtonLoading(button, isLoading) {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalHtml = button.innerHTML;
    button.classList.add('is-loading');
    button.innerHTML = '<i class="ri-loader-4-line ri-spin"></i>';
    button.disabled = true;
  } else {
    if (!document.body.contains(button)) return;
    button.classList.remove('is-loading');
    button.disabled = false;
    if (button.dataset.originalHtml !== undefined) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

function handleQuickAdAction(button, status) {
  const orderId = button?.dataset?.id;
  if (!orderId) return;
  const actionLabel = status === 'approved' ? 'تایید' : 'رد';
  if (!confirm(`آیا از ${actionLabel} این تبلیغ مطمئن هستید؟`)) {
    return;
  }
  setButtonLoading(button, true);
  updateAdOrderStatus(orderId, status, undefined, { silent: false })
    .catch(() => {})
    .finally(() => setButtonLoading(button, false));
}

function handleQuickDelete(button) {
  const orderId = button?.dataset?.id;
  if (!orderId) return;
  if (!confirm('آیا از حذف این تبلیغ مطمئن هستید؟')) {
    return;
  }
  setButtonLoading(button, true);
  removeAdOrder(orderId, { silent: false })
    .catch(() => {})
    .finally(() => setButtonLoading(button, false));
}

async function updateAdOrderStatus(orderId, status, note, { silent = false } = {}) {
  if (!orderId || !status) return null;
  const payload = { status };
  if (note !== undefined) payload.adminNote = note;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/adOrder/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || 'خطا در بروزرسانی تبلیغ.');
    }

    const updated = data.adOrder || data.order || null;
    if (updated) {
      const updatedId = getOrderId(updated);
      const idx = adOrdersList.findIndex(order => getOrderId(order) === updatedId);
      if (idx !== -1) {
        adOrdersList[idx] = updated;
      } else {
        adOrdersList.push(updated);
      }
      updateAdOrdersSummary();
      renderAdOrders();
    }

    if (!silent) {
      setAdOrdersStatus(data.message || 'وضعیت تبلیغ بروزرسانی شد.', 'success');
    }

    return updated;
  } catch (err) {
    console.error('updateAdOrderStatus error:', err);
    if (!silent) {
      setAdOrdersStatus(err.message || 'خطا در بروزرسانی تبلیغ.', 'error');
    }
    throw err;
  }
}

async function removeAdOrder(orderId, { silent = false } = {}) {
  if (!orderId) return false;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/adOrder/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    let data = {};
    try {
      data = await res.json();
    } catch (err) {
      data = {};
    }

    if (!res.ok) {
      throw new Error(data.error || data.message || 'خطا در حذف تبلیغ.');
    }

    const idx = adOrdersList.findIndex(order => getOrderId(order) === orderId);
    if (idx !== -1) {
      adOrdersList.splice(idx, 1);
    }
    updateAdOrdersSummary();
    renderAdOrders();

    if (!silent) {
      setAdOrdersStatus(data.message || 'تبلیغ حذف شد.', 'success');
    }

    return true;
  } catch (err) {
    console.error('removeAdOrder error:', err);
    if (!silent) {
      setAdOrdersStatus(err.message || 'خطا در حذف تبلیغ.', 'error');
    }
    throw err;
  }
}

async function updateAdOrderDetails(orderId, updates, { silent = false } = {}) {
  if (!orderId || !updates || typeof updates !== 'object') return null;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/adOrder/${encodeURIComponent(orderId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates)
    });

    let data = {};
    try {
      data = await res.json();
    } catch (err) {
      data = {};
    }

    if (!res.ok) {
      throw new Error(data.error || data.message || 'خطا در بروزرسانی تبلیغ.');
    }

    const updated = data.adOrder || data.order || null;
    if (updated) {
      const updatedId = getOrderId(updated);
      const idx = adOrdersList.findIndex(item => getOrderId(item) === updatedId);
      if (idx !== -1) {
        adOrdersList[idx] = updated;
      } else {
        adOrdersList.push(updated);
      }
      updateAdOrdersSummary();
      renderAdOrders();
    }

    if (!silent) {
      setAdOrdersStatus(data.message || 'تبلیغ بروزرسانی شد.', 'success');
    }

    return updated;
  } catch (err) {
    console.error('updateAdOrderDetails error:', err);
    if (!silent) {
      setAdOrdersStatus(err.message || 'خطا در بروزرسانی تبلیغ.', 'error');
    }
    throw err;
  }
}

async function loadAdOrders(force = false) {
  if (force) {
    adOrdersLoaded = false;
  }

  if (adOrdersLoadingPromise) {
    return adOrdersLoadingPromise;
  }

  if (adOrdersLoaded) {
    renderAdOrders();
    return adOrdersList;
  }

  setAdOrdersLoading(true);
  setAdOrdersStatus('');

  adOrdersLoadingPromise = (async () => {
    try {
      const res = await fetch(`${ADMIN_API_BASE}/adOrder`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'خطا در دریافت تبلیغات.');
      }

      const list = Array.isArray(data.adOrders) ? data.adOrders : [];
      adOrdersList = list;
      adOrdersLoaded = true;
      updateAdOrdersSummary();
      renderAdOrders();
      if (!list.length) {
        setAdOrdersStatus('هنوز تبلیغی ثبت نشده است.', 'info');
      }
      return list;
    } catch (err) {
      adOrdersLoaded = false;
      console.error('loadAdOrders error:', err);
      setAdOrdersStatus(err.message || 'خطا در دریافت تبلیغات.', 'error');
      if (adOrdersTableBody) {
        adOrdersTableBody.innerHTML = `<tr><td colspan="6" class="empty-row">خطا در دریافت تبلیغات.</td></tr>`;
      }
      throw err;
    } finally {
      adOrdersLoadingPromise = null;
    }
  })();

  return adOrdersLoadingPromise;
}

function openAdOrderModal(orderId) {
  const overlay = document.getElementById('ad-order-modal');
  if (!overlay || !orderId) return;

  const order = adOrdersList.find(item => getOrderId(item) === orderId);
  if (!order) {
    setAdOrdersStatus('تبلیغ مورد نظر یافت نشد.', 'error');
    return;
  }

  currentAdOrderId = orderId;
  renderAdOrderModal(order);
  overlay.style.display = 'flex';

  if (adModalOverlayHandler) {
    overlay.removeEventListener('click', adModalOverlayHandler);
  }
  adModalOverlayHandler = event => {
    if (event.target === overlay) {
      closeAdOrderModal();
    }
  };
  overlay.addEventListener('click', adModalOverlayHandler);
}

function renderAdOrderModal(order) {
  const overlay = document.getElementById('ad-order-modal');
  if (!overlay || !order) return;

  const seller = typeof order.sellerId === 'object' && order.sellerId !== null ? order.sellerId : {};
  const product = typeof order.productId === 'object' && order.productId !== null ? order.productId : null;
  const planMeta = getAdPlanMeta(order.planSlug || '', order.planTitle || 'تبلیغ ویژه');
  const planLabel = planMeta.label;
  const planIcon = planMeta.icon || 'ri-compass-3-line';
  const planLocationRow = planMeta.location
    ? `<span><span class="label">محل نمایش:</span> <i class="${planIcon}"></i> ${escapeHtml(planMeta.location)}${planMeta.url ? ` <a href="${escapeHtml(planMeta.url)}" target="_blank" rel="noopener">(مشاهده)</a>` : ''}</span>`
    : '';
  const planVisitLink = planMeta.url
    ? `<div class="ad-modal-visit"><a href="${escapeHtml(planMeta.url)}" target="_blank" rel="noopener"><i class="ri-external-link-line"></i> مشاهده محل نمایش در سایت</a></div>`
    : '';
  const statusMeta = getAdStatusMeta(order.status);
  const sellerName = seller.storename || order.shopTitle || 'بدون نام';
  const sellerPhone = seller.phone || order.sellerPhone || '';
  const sellerAddress = seller.address || seller.city || '';
  const shopurl = seller.shopurl || '';
  const createdAt = formatDateTime(order.createdAt);
  const reviewedAt = order.reviewedAt ? formatDateTime(order.reviewedAt) : '';
  const approvedAt = order.approvedAt ? formatDateTime(order.approvedAt) : '';
  const reviewedBy = order.reviewedBy && order.reviewedBy.name ? order.reviewedBy.name : '';
  const bannerUrl = order.bannerImage ? buildUploadsUrl(order.bannerImage) : '';
  const adminNoteValue = order.adminNote || '';
  const orderId = getOrderId(order);
  currentAdOrderId = orderId || currentAdOrderId;

  const displayDateValue = order.displayedAt || order.approvedAt || null;
  const displayedAt = displayDateValue ? formatDateTime(displayDateValue) : '';
  const displayedAtInputValue = toDatetimeLocalValue(displayDateValue);
  const titleValue = order.adTitle || '';
  const previewTitle = order.adTitle || order.planTitle || planLabel;
  const textValue = order.adText || '';
  const priceInputValue = order.price !== undefined && order.price !== null ? String(order.price) : '';
  const expiresAt = order.expiresAt ? formatDateTime(order.expiresAt) : '';
  const durationHours = Number(order.displayDurationHours);
  const hasCustomDuration = hasCustomAdDuration(durationHours);
  const durationDisplay = hasCustomDuration ? formatAdDuration(durationHours) : '';
  const durationSummaryText = hasCustomDuration ? `${durationDisplay} (سفارشی)` : 'پیش‌فرض پلن';
  const durationPreset = prepareAdDurationInput(durationHours);
  const durationInputValue = durationPreset.value;
  const durationInputUnit = durationPreset.unit;
  const durationHintText = hasCustomDuration
    ? `مدت سفارشی فعلی: ${durationDisplay}. برای بازگشت به تنظیمات پلن مقدار را خالی بگذارید یا روی «پیش‌فرض پلن» کلیک کنید.`
    : 'برای تعیین مدت نمایش سفارشی عدد مورد نظر را وارد کنید؛ در صورت خالی بودن، مدت پیش‌فرض پلن اعمال می‌شود.';

  overlay.innerHTML = `
    <div class="ad-modal" role="dialog" aria-modal="true">
      <button type="button" class="ad-modal-close" onclick="closeAdOrderModal()" aria-label="بستن پنجره">×</button>
      <div class="ad-modal-title">
        <i class="ri-megaphone-line"></i>
        بررسی تبلیغ ویژه
        <span class="badge">${escapeHtml(planLabel)}</span>
      </div>
      ${planVisitLink}

      <div class="ad-modal-grid">
        <div class="ad-modal-section">
          <h4>اطلاعات فروشنده</h4>
          <div class="ad-modal-meta">
            <span><span class="label">نام فروشگاه:</span> ${escapeHtml(sellerName)}</span>
            ${sellerPhone ? `<span><span class="label">شماره تماس:</span> ${escapeHtml(sellerPhone)}</span>` : ''}
            ${sellerAddress ? `<span><span class="label">آدرس:</span> ${escapeHtml(sellerAddress)}</span>` : ''}
            ${shopurl ? `<span><span class="label">آدرس اینترنتی:</span> <a href="/shop.html?shopurl=${encodeURIComponent(shopurl)}" target="_blank" rel="noopener">مشاهده فروشگاه</a></span>` : ''}
          </div>
        </div>
        <div class="ad-modal-section">
          <h4>جزئیات سفارش</h4>
          <div class="ad-modal-meta">
            <span><span class="label">مبلغ:</span> ${formatCurrency(order.price)}</span>
            <span><span class="label">تاریخ ثبت:</span> ${createdAt}</span>
            <span><span class="label">وضعیت فعلی:</span> ${statusMeta.label}</span>
            <span><span class="label">آخرین بررسی:</span> ${reviewedAt ? `${reviewedAt}${reviewedBy ? ` توسط ${escapeHtml(reviewedBy)}` : ''}` : 'در انتظار بررسی'}</span>
            ${approvedAt ? `<span><span class="label">تاریخ تایید:</span> ${approvedAt}</span>` : ''}
            ${displayedAt ? `<span><span class="label">تاریخ نمایش:</span> ${displayedAt}</span>` : '<span><span class="label">تاریخ نمایش:</span> در انتظار تعیین</span>'}
            <span><span class="label">مدت نمایش:</span> ${escapeHtml(durationSummaryText)}</span>
            ${expiresAt ? `<span><span class="label">پایان نمایش:</span> ${expiresAt}</span>` : ''}
            ${planLocationRow}
          </div>
        </div>
      </div>

      <div class="ad-modal-preview">
        <div class="banner">
          ${bannerUrl ? `<img src="${bannerUrl}" alt="بنر تبلیغ">` : '<span class="ad-status-note">بنری بارگذاری نشده است.</span>'}
        </div>
        <div class="ad-title">${escapeHtml(previewTitle)}</div>
        ${textValue ? `<div class="ad-text">${escapeHtml(textValue)}</div>` : ''}
        ${product ? `<div class="ad-modal-meta"><span><span class="label">محصول هدف:</span> ${escapeHtml(product.title || '')}</span>${product.price != null ? `<span><span class="label">قیمت محصول:</span> ${formatCurrency(product.price)}</span>` : ''}</div>` : ''}
      </div>

      <div class="ad-modal-edit">
        <h4>ویرایش تبلیغ</h4>
        <div class="ad-edit-grid">
          <label for="adModalTitle">عنوان نمایشی</label>
          <input type="text" id="adModalTitle" value="${escapeHtml(titleValue)}" placeholder="عنوان نمایش تبلیغ" />
          <label for="adModalText">متن تبلیغ</label>
          <textarea id="adModalText" placeholder="متن تبلیغ">${escapeHtml(textValue)}</textarea>
          <label for="adModalPrice">مبلغ (ریال)</label>
          <input type="number" id="adModalPrice" min="0" step="1000" value="${escapeHtml(priceInputValue)}" />
          <label for="adModalDisplayedAt">تاریخ نمایش در سایت</label>
          <input type="datetime-local" id="adModalDisplayedAt" value="${escapeHtml(displayedAtInputValue)}" />
          <label for="adModalDurationValue">مدت نمایش سفارشی</label>
          <div class="ad-duration-control">
            <input type="number" id="adModalDurationValue" min="1" step="0.5" value="${escapeHtml(durationInputValue)}" placeholder="مثلاً 3" />
            <select id="adModalDurationUnit">
              <option value="days" ${durationInputUnit === 'days' ? 'selected' : ''}>روز</option>
              <option value="hours" ${durationInputUnit === 'hours' ? 'selected' : ''}>ساعت</option>
            </select>
            <button type="button" class="ad-action-btn ghost ad-duration-reset" id="adModalDurationReset"><i class="ri-arrow-go-back-line"></i> پیش‌فرض پلن</button>
          </div>
          <div class="ad-duration-hint">${escapeHtml(durationHintText)}</div>
        </div>
        <div class="ad-edit-actions">
          <button type="button" id="adModalSave" class="ad-action-btn ghost"><i class="ri-save-3-line"></i> ذخیره تغییرات</button>
          <button type="button" id="adModalDelete" class="ad-action-btn reject"><i class="ri-delete-bin-line"></i> حذف تبلیغ</button>
        </div>
        <p id="adModalEditStatus" class="ad-modal-edit-status" style="display:none;"></p>
      </div>

      <div class="ad-modal-note">
        <label for="adModalNote">یادداشت داخلی ادمین</label>
        <textarea id="adModalNote" placeholder="یادداشت خود را وارد کنید...">${escapeHtml(adminNoteValue)}</textarea>
      </div>

      <div class="ad-modal-actions">
        <button data-action="approve" data-id="${escapeHtml(orderId)}"><i class="ri-checkbox-circle-line"></i> تایید تبلیغ</button>
        <button data-action="reject" data-id="${escapeHtml(orderId)}"><i class="ri-close-circle-line"></i> رد تبلیغ</button>
        <button data-action="pending" data-id="${escapeHtml(orderId)}"><i class="ri-time-line"></i> بازگشت به انتظار</button>
      </div>

      <div class="ad-modal-timestamps">
        <span>ثبت درخواست: ${createdAt}</span>
        ${reviewedAt ? `<span>آخرین بررسی: ${reviewedAt}${reviewedBy ? ` توسط ${escapeHtml(reviewedBy)}` : ''}</span>` : ''}
        ${approvedAt ? `<span>تایید نهایی: ${approvedAt}</span>` : ''}
        ${displayedAt ? `<span>نمایش در سایت: ${displayedAt}</span>` : '<span>نمایش در سایت: در انتظار نمایش</span>'}
        ${expiresAt ? `<span>پایان نمایش: ${expiresAt}</span>` : ''}
      </div>

      <div class="ad-modal-status">
        <i class="${statusMeta.icon}"></i>
        <span>${statusMeta.label}</span>
      </div>
    </div>
  `;

  const noteInput = overlay.querySelector('#adModalNote');
  const titleInput = overlay.querySelector('#adModalTitle');
  const textInput = overlay.querySelector('#adModalText');
  const priceInput = overlay.querySelector('#adModalPrice');
  const displayedAtInput = overlay.querySelector('#adModalDisplayedAt');
  const durationValueInput = overlay.querySelector('#adModalDurationValue');
  const durationUnitSelect = overlay.querySelector('#adModalDurationUnit');
  const durationResetButton = overlay.querySelector('#adModalDurationReset');
  const saveButton = overlay.querySelector('#adModalSave');
  const deleteButton = overlay.querySelector('#adModalDelete');
  const originalDurationHours = hasCustomDuration ? durationHours : null;
  const hasOriginalDuration = hasCustomDuration;

  overlay.querySelectorAll('.ad-modal-actions button').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (!action) return;
      const noteValue = noteInput ? noteInput.value : undefined;
      if (action === 'pending' && order.status === 'pending' && (!noteValue || noteValue.trim() === (order.adminNote || ''))) {
        closeAdOrderModal();
        return;
      }
      handleAdModalAction(getOrderId(order), action === 'pending' ? 'pending' : action, noteValue !== undefined ? noteValue : undefined, button);
    });
  });

  if (saveButton) {
    saveButton.addEventListener('click', () => {
      const payload = {};
      let hasChanges = false;

      const originalTitle = (order.adTitle || '').trim();
      const newTitle = titleInput ? titleInput.value.trim() : '';
      if (newTitle !== originalTitle) {
        payload.adTitle = newTitle;
        hasChanges = true;
      }

      const originalText = (order.adText || '').trim();
      const newText = textInput ? textInput.value.trim() : '';
      if (newText !== originalText) {
        payload.adText = newText;
        hasChanges = true;
      }

      const originalPriceStr = priceInputValue;
      const newPriceStr = priceInput ? priceInput.value : '';
      if (newPriceStr !== originalPriceStr) {
        if (!newPriceStr.length) {
          setAdModalEditStatus('مبلغ تبلیغ را وارد کنید.', 'error');
          return;
        }
        const priceNumber = Number(newPriceStr);
        if (!Number.isFinite(priceNumber) || priceNumber < 0) {
          setAdModalEditStatus('مبلغ وارد شده معتبر نیست.', 'error');
          return;
        }
        payload.price = priceNumber;
        hasChanges = true;
      }

      const originalDisplay = displayedAtInputValue || '';
      const newDisplay = displayedAtInput ? displayedAtInput.value : '';
      if (newDisplay !== originalDisplay) {
        if (newDisplay) {
          const parsed = new Date(newDisplay);
          if (Number.isNaN(parsed.getTime())) {
            setAdModalEditStatus('تاریخ نمایش معتبر نیست.', 'error');
            return;
          }
          payload.displayedAt = parsed.toISOString();
        } else {
          payload.displayedAt = null;
        }
        hasChanges = true;
      }

      const durationResult = parseAdDurationForm(durationValueInput, durationUnitSelect);
      if (durationResult && durationResult.error) {
        setAdModalEditStatus(durationResult.error, 'error');
        return;
      }
      if (durationResult) {
        if (durationResult.isEmpty) {
          if (hasOriginalDuration) {
            payload.displayDurationHours = null;
            hasChanges = true;
          }
        } else {
          const newDurationHours = durationResult.hours;
          if (!hasOriginalDuration || !durationsNearlyEqual(newDurationHours, originalDurationHours)) {
            payload.displayDurationHours = newDurationHours;
            hasChanges = true;
          }
        }
      }

      const currentNote = noteInput ? noteInput.value : '';
      if ((currentNote || '').trim() !== (adminNoteValue || '').trim()) {
        payload.adminNote = currentNote;
        hasChanges = true;
      }

      if (!hasChanges) {
        setAdModalEditStatus('تغییری برای ذخیره وجود ندارد.', 'info');
        return;
      }

      setAdModalEditStatus('در حال ذخیره تغییرات...', 'info');
      setButtonLoading(saveButton, true);
      updateAdOrderDetails(orderId, payload, { silent: true })
        .then(updated => {
          if (updated) {
            renderAdOrderModal(updated);
            setTimeout(() => setAdModalEditStatus('تغییرات با موفقیت ذخیره شد.', 'success'), 0);
          }
          setAdOrdersStatus('جزئیات تبلیغ بروزرسانی شد.', 'success');
        })
        .catch(err => {
          console.error('ad-modal save error:', err);
          setAdModalEditStatus(err.message || 'خطا در ذخیره تغییرات.', 'error');
        })
        .finally(() => setButtonLoading(saveButton, false));
    });
  }

  if (durationResetButton) {
    durationResetButton.addEventListener('click', () => {
      if (durationValueInput) {
        durationValueInput.value = '';
      }
      if (durationUnitSelect) {
        durationUnitSelect.value = DEFAULT_AD_DURATION_UNIT;
      }
      setAdModalEditStatus('مدت نمایش به حالت پیش‌فرض پلن بازنشانی شد. برای اعمال تغییر روی «ذخیره تغییرات» کلیک کنید.', 'info');
    });
  }

  if (deleteButton) {
    deleteButton.addEventListener('click', () => {
      if (!confirm('آیا از حذف این تبلیغ مطمئن هستید؟')) {
        return;
      }
      setAdModalEditStatus('در حال حذف تبلیغ...', 'info');
      setButtonLoading(deleteButton, true);
      removeAdOrder(orderId, { silent: true })
        .then(() => {
          closeAdOrderModal();
          setAdOrdersStatus('تبلیغ با موفقیت حذف شد.', 'success');
        })
        .catch(err => {
          console.error('ad-modal delete error:', err);
          setAdModalEditStatus(err.message || 'خطا در حذف تبلیغ.', 'error');
        })
        .finally(() => setButtonLoading(deleteButton, false));
    });
  }
}

function setAdModalEditStatus(message = '', type = 'info') {
  const statusEl = document.getElementById('adModalEditStatus');
  if (!statusEl) return;

  statusEl.classList.remove('info', 'success', 'error');
  if (!message) {
    statusEl.textContent = '';
    statusEl.style.display = 'none';
    return;
  }

  statusEl.textContent = message;
  statusEl.classList.add(type);
  statusEl.style.display = 'block';
}

function handleAdModalAction(orderId, status, note, button) {
  if (!orderId || !status) return;
  const trimmedNote = note !== undefined ? note.trim() : undefined;

  if (status === 'rejected' && !confirm('آیا از رد این تبلیغ مطمئن هستید؟')) {
    return;
  }

  if (status === 'pending' && !confirm('تبلیغ به حالت در انتظار بازگردد؟')) {
    return;
  }

  setButtonLoading(button, true);
  updateAdOrderStatus(orderId, status, trimmedNote, { silent: true })
    .then(updated => {
      if (updated) {
        renderAdOrderModal(updated);
        setAdOrdersStatus('وضعیت تبلیغ بروزرسانی شد.', 'success');
      }
    })
    .catch(err => {
      console.error('handleAdModalAction error:', err);
      setAdOrdersStatus(err.message || 'خطا در بروزرسانی تبلیغ.', 'error');
    })
    .finally(() => setButtonLoading(button, false));
}

function closeAdOrderModal() {
  const overlay = document.getElementById('ad-order-modal');
  if (!overlay) return;
  overlay.style.display = 'none';
  overlay.innerHTML = '';
  currentAdOrderId = null;
  if (adModalOverlayHandler) {
    overlay.removeEventListener('click', adModalOverlayHandler);
    adModalOverlayHandler = null;
  }
}

window.closeAdOrderModal = closeAdOrderModal;

function initAdOrdersUI() {
  if (adOrdersPlanFilterEl) {
    adOrdersPlanFilterEl.addEventListener('change', event => {
      adOrdersPlanFilter = event.target.value;
      renderAdOrders();
    });
  }

  if (adOrdersSearchEl) {
    adOrdersSearchEl.addEventListener('input', event => {
      adOrdersSearchTerm = event.target.value.trim().toLowerCase();
      renderAdOrders();
    });
  }

  if (adOrdersRefreshBtn) {
    adOrdersRefreshBtn.addEventListener('click', async () => {
      if (adOrdersRefreshBtn.disabled) return;
      const original = adOrdersRefreshBtn.innerHTML;
      adOrdersRefreshBtn.disabled = true;
      adOrdersRefreshBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> بروزرسانی...';
      try {
        await loadAdOrders(true);
        setAdOrdersStatus('لیست تبلیغات بروزرسانی شد.', 'success');
      } catch (err) {
        console.error('adOrdersRefresh error:', err);
      } finally {
        adOrdersRefreshBtn.disabled = false;
        adOrdersRefreshBtn.innerHTML = original;
      }
    });
  }

  document.querySelectorAll('.ad-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ad-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      adOrdersFilter = btn.dataset.filter || 'all';
      renderAdOrders();
    });
  });
}

updateAdOrdersSummary();
renderAdOrders();
initAdOrdersUI();

function normaliseScoreKey(id) {
  if (!id) return '';
  return toIdString(id);
}

function resolveSellerKeyFromShop(shop) {
  if (!shop) return '';
  const candidate =
    shop._sid ||
    shop.sellerId ||
    shop.seller_id ||
    (shop.shopurl ? `shopurl:${shop.shopurl}` : '') ||
    shop._id;
  return normaliseScoreKey(candidate);
}

function collectSellerAliasKeys(shop) {
  if (!shop || typeof shop !== 'object') return [];
  const keys = new Set();
  const addKey = (value) => {
    const normalised = normaliseScoreKey(value);
    if (normalised) {
      keys.add(normalised);
    }
  };
  addKey(shop._sid);
  addKey(shop.sellerId);
  addKey(shop.seller_id);
  addKey(shop._id);
  addKey(shop.id);
  if (shop.shopurl) {
    addKey(`shopurl:${shop.shopurl}`);
    addKey(shop.shopurl);
  }
  return Array.from(keys);
}

function findShopByAliasKey(key) {
  const normalised = normaliseScoreKey(key);
  if (!normalised) return null;
  return shopsList.find(shop => collectSellerAliasKeys(shop).includes(normalised)) || null;
}

function applySellerModerationState(keys, state) {
  if (!state) return false;
  const list = Array.isArray(keys) ? keys : [keys];
  const keySet = new Set(
    list
      .map(normaliseScoreKey)
      .filter(Boolean)
  );
  if (!keySet.size) return false;

  let updated = false;
  shopsList.forEach(shop => {
    const aliases = collectSellerAliasKeys(shop);
    const shouldUpdate = aliases.some(alias => keySet.has(alias));
    if (shouldUpdate) {
      Object.assign(shop, {
        blockedByAdmin: !!state.blocked,
        blockedAt: state.blockedAt || null,
        blockedBy: state.blockedBy || null,
        blockedReason: state.blockedReason || ''
      });
      updated = true;
    }
  });

  if (updated) {
    renderSellers();
  }

  return updated;
}

async function requestSellerModeration(sellerKey, mode, reason) {
  const normalised = normaliseScoreKey(sellerKey);
  if (!normalised) {
    throw new Error('شناسه فروشنده معتبر نیست.');
  }

  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  const endpoint = mode === 'block' ? 'block' : 'unblock';
  const res = await fetch(`${ADMIN_API_BASE}/sellers/${encodeURIComponent(normalised)}/${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(trimmedReason ? { reason: trimmedReason } : {})
  });

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }

  if (!res.ok) {
    const message = data?.message || data?.error || 'خطا در انجام عملیات.';
    throw new Error(message);
  }

  const payload = data?.seller || {};
  const state = {
    blocked: payload.blockedByAdmin != null ? !!payload.blockedByAdmin : (mode === 'block'),
    blockedAt: payload.blockedAt || (mode === 'block' ? new Date().toISOString() : null),
    blockedBy: payload.blockedBy || null,
    blockedReason: payload.blockedReason || trimmedReason
  };

  return {
    state,
    message: data?.message || (mode === 'block' ? 'فروشنده مسدود شد.' : 'مسدودی فروشنده برداشته شد.')
  };
}

async function handleSellerQuickModeration(button, shop, mode) {
  if (!button || !shop) return;

  const sellerKey =
    resolveSellerKeyFromShop(shop) ||
    (shop.shopurl ? `shopurl:${shop.shopurl}` : '') ||
    toIdString(shop._id || shop.id || '');

  if (!sellerKey) {
    alert('شناسه فروشنده معتبر نیست.');
    return;
  }

  const confirmMessage = mode === 'block'
    ? 'آیا مطمئن هستید که می‌خواهید این فروشنده را مسدود کنید؟'
    : 'آیا مطمئن هستید که می‌خواهید دسترسی فروشنده را فعال کنید؟';

  if (!window.confirm(confirmMessage)) return;

  let reason = '';
  if (mode === 'block') {
    const input = window.prompt('دلیل مسدودسازی فروشنده (اختیاری):', '');
    if (input === null) return;
    reason = input.trim();
  }

  const previousHtml = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> در حال انجام...';

  try {
    const { state, message } = await requestSellerModeration(sellerKey, mode, reason);
    const aliasKeys = collectSellerAliasKeys(shop);
    applySellerModerationState(aliasKeys.length ? aliasKeys : sellerKey, state);
    alert(message);
  } catch (err) {
    console.error('seller quick moderation error:', err);
    alert(err.message || 'خطا در انجام عملیات.');
  } finally {
    button.disabled = false;
    button.innerHTML = previousHtml;
  }
}

function parsePerformancePayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const sellerId = payload.sellerId ? toIdString(payload.sellerId) : '';
  const shopurl = payload.shopurl || '';
  const note = typeof payload.adminScoreNote === 'string'
    ? payload.adminScoreNote
    : (typeof payload.note === 'string' ? payload.note : '');
  const publicMessage = typeof payload.adminScoreMessage === 'string'
    ? payload.adminScoreMessage
    : (typeof payload.publicMessage === 'string' ? payload.publicMessage : '');
  const meta = {
    sellerId,
    shopurl,
    storename: payload.storename || '',
    adminScore: payload.adminScore != null ? Number(payload.adminScore) : null,
    updatedAt: payload.updatedAt || null,
    status: payload.status || 'unset',
    statusLabel: payload.statusLabel || 'منتظر ارزیابی',
    statusMessage: payload.statusMessage || '',
    severity: payload.severity || 'neutral',
    canStay: payload.canStay !== false,
    message: payload.message || '',
    adminScoreNote: note,
    note,
    adminScoreMessage: publicMessage,
    publicMessage
  };

  const aliasKeys = [];
  const addAlias = (value) => {
    const normalised = normaliseScoreKey(value);
    if (normalised && !aliasKeys.includes(normalised)) {
      aliasKeys.push(normalised);
    }
  };

  addAlias(payload.sellerKey);
  addAlias(sellerId);
  addAlias(payload._id);
  if (payload.seller && typeof payload.seller === 'object') {
    addAlias(payload.seller._id || payload.seller.id);
  }
  if (shopurl) addAlias(`shopurl:${shopurl}`);
  if (Array.isArray(payload.aliases)) {
    payload.aliases.forEach(addAlias);
  }

  const keyCandidate = payload.sellerKey || sellerId || (shopurl ? `shopurl:${shopurl}` : '');
  addAlias(keyCandidate);

  meta.sellerKey = aliasKeys.length ? aliasKeys[0] : '';
  meta.aliasKeys = aliasKeys;

  if (meta.sellerKey && !meta.aliasKeys.includes(meta.sellerKey)) {
    meta.aliasKeys.unshift(meta.sellerKey);
  }
  if (!meta.aliasKeys.length && meta.sellerKey) {
    meta.aliasKeys = [meta.sellerKey];
  }

  return meta;
}

function getSellerPerformanceByKey(key) {
  const normalised = normaliseScoreKey(key);
  if (!normalised) return null;
  return Object.prototype.hasOwnProperty.call(sellerPerformanceMap, normalised)
    ? sellerPerformanceMap[normalised]
    : null;
}

function getSellerScoreByKey(key) {
  const meta = getSellerPerformanceByKey(key);
  return meta && meta.adminScore != null ? meta.adminScore : null;
}

function getSellerScoreForShop(shop) {
  const key = resolveSellerKeyFromShop(shop);
  return key ? getSellerScoreByKey(key) : null;
}

async function refreshSellerPerformanceMap() {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/sellers/performance`, {
      credentials: 'include'
    });

    let payload = null;
    try {
      payload = await res.json();
    } catch (err) {
      payload = null;
    }

    if (!res.ok) {
      const message = payload && payload.message ? payload.message : 'خطا در دریافت وضعیت عملکرد فروشنده‌ها.';
      throw new Error(message);
    }

    const records = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload?.data) ? payload.data : []);

    const nextMap = {};
    records.forEach(item => {
      const meta = parsePerformancePayload(item);
      if (!meta) return;
      const keys = Array.isArray(meta.aliasKeys) && meta.aliasKeys.length
        ? meta.aliasKeys
        : (meta.sellerKey ? [meta.sellerKey] : []);
      keys.forEach(alias => {
        const normalised = normaliseScoreKey(alias);
        if (normalised) {
          nextMap[normalised] = meta;
        }
      });
    });

    sellerPerformanceMap = nextMap;
    sellerPerformanceLoaded = true;
    return true;
  } catch (err) {
    console.error('⚠️ خطا در دریافت وضعیت عملکرد فروشنده‌ها:', err);
    sellerPerformanceLoaded = false;
    return false;
  }
}

async function setSellerScoreByKey(key, value, note, message) {
  const normalised = normaliseScoreKey(key);
  if (!normalised) throw new Error('شناسه فروشنده برای ثبت نمره معتبر نیست.');

  const body = { score: value };
  if (typeof note === 'string') {
    body.note = note;
  }
  if (typeof message === 'string') {
    body.message = message;
  }

  const res = await fetch(`${ADMIN_API_BASE}/sellers/performance/${encodeURIComponent(normalised)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch (err) {
    payload = null;
  }

  if (!res.ok) {
    const message = payload && payload.message ? payload.message : 'خطا در ثبت نمره فروشنده.';
    throw new Error(message);
  }

  const meta = parsePerformancePayload(payload);
  if (meta) {
    const keys = new Set([
      normalised,
      ...(Array.isArray(meta.aliasKeys) ? meta.aliasKeys : []),
      meta.sellerKey
    ]);
    keys.forEach(alias => {
      const keyAlias = normaliseScoreKey(alias);
      if (keyAlias) {
        sellerPerformanceMap[keyAlias] = meta;
      }
    });
  }
  sellerPerformanceLoaded = true;
  return meta;
}

async function setSellerScoreForShop(shop, value, note, message) {
  const key = resolveSellerKeyFromShop(shop);
  return key ? setSellerScoreByKey(key, value, note, message) : null;
}

async function clearSellerScoreByKey(key) {
  const normalised = normaliseScoreKey(key);
  if (!normalised) throw new Error('شناسه فروشنده معتبر نیست.');

  const res = await fetch(`${ADMIN_API_BASE}/sellers/performance/${encodeURIComponent(normalised)}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch (err) {
    payload = null;
  }

  if (!res.ok) {
    const message = payload && payload.message ? payload.message : 'خطا در حذف نمره فروشنده.';
    throw new Error(message);
  }

  const meta = parsePerformancePayload(payload);
  if (meta) {
    const keys = new Set([
      normalised,
      ...(Array.isArray(meta.aliasKeys) ? meta.aliasKeys : []),
      meta.sellerKey
    ]);
    keys.forEach(alias => {
      const keyAlias = normaliseScoreKey(alias);
      if (keyAlias) {
        sellerPerformanceMap[keyAlias] = meta;
      }
    });
  } else {
    delete sellerPerformanceMap[normalised];
  }
  sellerPerformanceLoaded = true;
  return meta;
}

async function clearSellerScoreForShop(shop) {
  const key = resolveSellerKeyFromShop(shop);
  return key ? clearSellerScoreByKey(key) : null;
}

let messagesList = [];




/* --- global name-maps ------------------------------------ */
/* --- global name-maps -------------------------------- */
let sellerNameById = {};   // { sellerId : "نام فروشنده / فروشگاه" }
let userNameById   = {};   // { userId   : "نام کاربر" }

/* -------------------- buildNameMaps (FIXED) -------------------- */
/**
 * تمام شناسه‌های ممکن فروشنده و کاربر را به «قابل‌نمایش‌ترین» نامشان نگاشت می‌کند.
 * اولویت نام‌ها، از صریح‌ترین (همراه چت) تا محاسبه‌شده از دیتابیس است.
 */
function normSellerId(id) {
  // اگر رشته خالی یا undefined بود
  if (!id) return '';
  // اگر همین الان هم shopurl: بود
  if (typeof id !== 'string') id = String(id);
  if (id.startsWith('shopurl:')) return id;
  // اگر فقط اسلاگ هست
  return 'shopurl:' + id;
}

function buildNameMaps() {
  sellerNameById = {};

  // فروشگاه‌ها
  shopsList.forEach(shop => {
    const ids = [
      shop._id, shop._sid, shop.id,
      shop.sellerId, shop.seller_id,
      shop.shopurl
    ].filter(Boolean).map(toIdString);

    const label = (shop.ownerName || '').trim() ||
      (`${shop.ownerFirstname || ''} ${shop.ownerLastname || ''}`).trim() ||
      shop.storename || shop.storeName || shop.shopLogoText || 'فروشنده';

    ids.forEach(id => { 
      if (id) sellerNameById[normSellerId(id)] = label; 
    });
  });

  // پیام‌ها - نام صریح فروشنده
  messagesList.forEach(chat => {
    const ids = [
      chat.sellerId,
      chat.shopurl,
      chat.seller?._id,
      chat.seller?.id
    ].filter(Boolean).map(toIdString);

    const label =
      (chat.sellerName || chat.storeName ||
        chat.seller?.storename || chat.seller?.ownerName || '').trim();

    if (label)
      ids.forEach(id => { 
        if (id) sellerNameById[normSellerId(id)] = label; 
      });
  });

  // Patch: shopurl → sellerId
  messagesList.forEach(chat => {
    const sid  = normSellerId(toIdString(chat.sellerId));
    const surl = normSellerId(toIdString(chat.shopurl));
    if (!sid || !surl) return;
    // پیدا کردن فروشگاه مطابق shopurl
    const shop = shopsList.find(s => normSellerId(toIdString(s.shopurl)) === surl);
    if (!shop) return;
    // برچسب فروشگاه
    const label =
      (shop.ownerName || '').trim() ||
      (`${shop.ownerFirstname||''} ${shop.ownerLastname||''}`).trim() ||
      shop.storename || shop.storeName || shop.shopLogoText || 'فروشنده';
    // غنی‌سازی نقشه
    sellerNameById[sid] = label;
  });

  // مشتری‌ها
  userNameById = {};
  usersList.forEach(u => {
    const ids = [
      u._id, u.id, u.userId, u.user_id, u.customerId
    ].filter(Boolean).map(toIdString);

    const label =
      (u.fullName || u.fullname || '').trim() ||
      (`${u.firstName || u.firstname || ''} ${u.lastName || u.lastname || ''}`).trim() ||
      u.name || u.username || u.phone || 'مشتری';

    ids.forEach(id => { 
      if (id) userNameById[id] = label; 
    });
  });

  // پیام‌ها - نام صریح مشتری
  messagesList.forEach(chat => {
    const id = toIdString(chat.customerId || chat.userId);
    const name = (chat.customerName || chat.userName || '').trim();
    if (id && name) userNameById[id] = name;
  });
}







// ← همینجا، درست بعد از let messagesList = [];
/* ------------------------------- fetchMessages (FIXED) ------------------------------ */
async function fetchMessages() {
  console.log('⚙️ fetchMessages called');

const res = await fetch(`${ADMIN_API_BASE}/chats/all`, { credentials: 'include' });

  const data = await res.json();

  if (!res.ok) {
    console.error('❌ خطا در واکشی پیام‌ها:', data);
    throw new Error(data.error || 'خطا در واکشی پیام‌ها');
  }

  /* ۱) ذخیره لیست چت‌ها */
  messagesList = Array.isArray(data) ? data : (data.chats || []);

  /* ۲) نرمال‌سازی شناسه‌ها در خود چت (برای سازگاری کامل) */
  messagesList.forEach(c => {
    if (c.sellerId)   c.sellerId   = toIdString(c.sellerId);
    if (!c.sellerId && c.shopurl)
  c.sellerId = 'shopurl:' + c.shopurl;     // ← اضافه کنید

    if (c.customerId) c.customerId = toIdString(c.customerId);
  });

  /* ۳) مپ نام‌ها را «بعد از» داشتن پیام‌ها بسازیم */
  buildNameMaps();

  /* ۴) آپدیت شمارنده‌ها */
  updateSidebarCounts();
  updateHeaderCounts();

  /* ۵) اگر پنل پیام‌ها همین حالا باز است، جدول را فوراً رندر کن */
  if (panels.messages.style.display !== 'none') {
    renderMessages();
  }
}




function getTotalUnreadMessages() {
  let total = 0;
  messagesList.forEach(chat => {
    if (Array.isArray(chat.messages)) {
      total += chat.messages.filter(
        m => (m.from === 'seller' || m.from === 'user') && !m.read
      ).length;
    }
  });
  return total;
}








/* ------------------ helpers/name-utils.js ------------------ */

/**
 * یک رشته را نرمالایز می‌کند (حذف فاصله‌های دوطرف و چند space پیاپی)
 */
function clean(str = '') {
  return String(str).replace(/\s+/g, ' ').trim();
}

/**
 * از یک شیء (یا حتی رشته) سعی می‌کند نام قابل‌نمایش استخراج کند.
 * کلیدهای متداول + کلیدهای اضافی (آرگومان دوم) بررسی می‌شوند.
 */
function extractName(obj, extraKeys = []) {
  if (!obj) return '';

  // اگر خودِ ورودی رشته باشد
  if (typeof obj === 'string') return clean(obj);

  // کلیدهای رایج
  const commonKeys = [
    'fullName', 'fullname', 'name', 'username',      // عمومی
    'storename', 'storeName',                        // فروشنده
    'ownerName',                                     // فروشنده
    'firstName', 'firstname', 'lastName', 'lastname' // جداگانه
  ];

  for (const k of [...commonKeys, ...extraKeys]) {
    if (obj[k]) return clean(obj[k]);
  }

  // حالت first/last جدا
  if (obj.firstName || obj.firstname || obj.lastName || obj.lastname) {
    return clean(
      `${obj.firstName || obj.firstname || ''} ${obj.lastName || obj.lastname || ''}`
    );
  }

  return '';
}

/* --------------- core/getSenderName.js ---------------- */

/**
 * با درنظرگرفتن انواع ساختارهای ممکن پیام، نام نمایش‌داده‌شدهٔ فرستنده را برمی‌گرداند.
 * همیشه یک مقدار «غیرفالسـی» (حداقل عنوان پیش‌فرض) برمی‌گردد.
 */
/* --------------- core/getSenderName.js ---------------- */
/**
 * براى هر پیام برچسب «فرستنده» را برمى‌گرداند.
 * اولویت: نام صریح در خود پیام → نام صریح در شیء chat → mapها → لیست‌ها → پیش‌فرض
/* -------------------- getSenderName (FIXED) -------------------- */
/**
 * نام قابل‌نمایش فرستندهٔ یک پیام را برمی‌گرداند.
 * اولویت: ۱) نام صریح در خود پیام، ۲) نام صریح در شیء chat،
 * ۳) مپ‌های ازپیش‌ساخته، ۴) جست‌وجو در لیست‌ها، ۵) برچسب پیش‌فرض.
 */
function getSenderName (chat = {}, msg = {}) {

  /* ---------- 1) نام صریح داخل خود پیام ---------- */
  const explicitMsg =
    extractName(msg,         ['fromName', 'senderName', 'displayName']) ||
    extractName(msg.sender || {}, ['fromName', 'senderName', 'displayName']);
  if (explicitMsg) return explicitMsg;

  /* ---------- 2) نام صریح داخل شیء Chat ---------- */
  const explicitChat =
    extractName(chat, ['sellerName',   'seller_name',
                       'storeName',    'store_name',
                       'customerName', 'customer_name',
                       'userName',     'user_name',
                       'username']);
  if (explicitChat) return explicitChat;

  /* ---------- 3) تشخیص «نقش» فرستنده ---------- */
  let role = String(msg.from || chat.role || '').toLowerCase().trim();

  /* اگر نقش صریح نیست، با وجود شناسه حدس بزنیم */
  if (!role) {
    if (msg.sellerId   || chat.sellerId   || chat.seller_id || chat.shopurl)
      role = 'seller';
    else if (msg.customerId || chat.customerId || chat.userId ||
             chat.customer_id || chat.user_id)
      role = 'customer';
    else if (msg.fromId === 'admin' || chat.admin)
      role = 'admin';
  }

  /* ---------- 4) فروشنده ---------- */
  if (role === 'seller') {
    const sid = toIdString(
      msg.sellerId || chat.sellerId || chat.seller_id ||
      msg.shopurl  || chat.shopurl  || ''
    );

    if (sellerNameById[sid]) return sellerNameById[sid];

    /* جست‌وجو در shopsList برای اطلاعات بیشتر */
    const shop = shopsList.find(s =>
      s._sid === sid || toIdString(s.shopurl) === sid
    );
    if (shop) {
      const name =
        (shop.ownerName || '').trim() ||
        (`${shop.ownerFirstname || ''} ${shop.ownerLastname || ''}`).trim() ||
        shop.storename || shop.storeName || '';
      if (name) return name;
    }
    return 'فروشنده';
  }

  /* ---------- 5) مشتری / کاربر ---------- */
  if (role === 'customer' || role === 'user') {
    const uid = toIdString(
      msg.customerId   || chat.customerId   ||
      chat.customer_id || chat.userId       ||
      chat.user_id     || ''
    );

    if (userNameById[uid]) return userNameById[uid];

    /* fallback → جست‌وجو در usersList */
    const user = usersList.find(u =>
      toIdString(u._id || u.id || u.userId || u.user_id) === uid
    );
    if (user) {
      const name =
        (user.fullName || user.fullname || '').trim() ||
        (`${user.firstName || user.firstname || ''} ${user.lastName || user.lastname || ''}`).trim() ||
        user.name || user.username || '';
      if (name) return name;
    }
    return 'مشتری';
  }

  /* ---------- 6) ادمین یا فرستندهٔ ناشناس ---------- */
  return 'ادمین';
}






/* ───── 2) نسخهٔ نهاییِ تابع renderMessages ───── */
/* ───── نسخهٔ اصلاح‌شده‌ی تابع renderMessages ───── */
function renderMessages() {
  const tbody = document.querySelector('#messagesTable tbody');
  tbody.innerHTML = '';

  // 1. کپی لیست پیام‌ها برای فیلتر و مرتب‌سازی
  let chats = [...messagesList];
  
  // 2. اعمال فیلترها
  if (messagesFilterMode === 'seller') {
    chats = chats.filter(chat => chat.sellerId);
  } else if (messagesFilterMode === 'customer') {
    chats = chats.filter(chat => !chat.sellerId);
  } else if (messagesFilterMode === 'unanswered') {
    chats = chats.filter(chat => {
      const msgs = chat.messages || [];
      return msgs.length > 0 && msgs[msgs.length - 1].from !== 'admin';
    });
  }

  // 3. مرتب‌سازی بر اساس تاریخ
  chats.sort((a, b) => {
    const aLastMsg = a.messages[a.messages.length - 1];
    const bLastMsg = b.messages[b.messages.length - 1];
    const aTime = aLastMsg ? new Date(aLastMsg.createdAt || aLastMsg.date).getTime() : 0;
    const bTime = bLastMsg ? new Date(bLastMsg.createdAt || bLastMsg.date).getTime() : 0;
    
    return messagesFilterMode === 'oldest' ? aTime - bTime : bTime - aTime;
  });

  // 4. بررسی خالی بودن لیست پس از فیلتر
  if (chats.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:#888;padding:1.5rem">
          ${getEmptyFilterMessage()}
        </td>
      </tr>`;
    return;
  }

  // 5. رندر پیام‌های فیلتر شده
  chats.forEach(chat => {
    const msgs = chat.messages || [];
    const lastMsg = msgs[msgs.length - 1];
    const senderMsg = msgs.slice().reverse().find(m => m.from !== 'admin') || lastMsg;

    const senderLabel = getSenderName(chat, senderMsg);
    const unreadCount = msgs.filter(m => (m.from === 'seller' || m.from === 'user') && !m.read).length;

    const fullText = lastMsg && lastMsg.text ? lastMsg.text : '-';
    const shortText = fullText.length > 36 ? fullText.slice(0, 36) + '…' : fullText;

    const raw = lastMsg && (lastMsg.createdAt || lastMsg.date);
    const dt = raw ? new Date(raw) : null;
    const faDate = (dt && !isNaN(dt.valueOf()))
      ? dt.toLocaleString('fa-IR', {
          hour12: false,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center;color:#10b981;font-weight:bold">
        ${unreadCount
          ? `<span style="background:#eafaf4;border-radius:8px;padding:2px 10px">${unreadCount}</span>`
          : '۰'
        }
      </td>
      <td>${shortText}</td>
      <td class="msg-sender-cell"
          style="cursor:pointer;color:#0ea5e9;font-weight:bold">
        ${senderLabel}
      </td>
      <td>${faDate}</td>
        <td>
          <button class="action-btn delete" onclick="deleteMessage('${chat._id}')">حذف</button>
          <button class="action-btn view" onclick="openChatModal('${chat._id}')">مشاهده</button>
          ${chat.blockedByAdmin
            ? `<button class="action-btn unblock" onclick="unblockSender('${chat._id}')">آزاد کردن</button>`
            : `<button class="action-btn block" onclick="blockSender('${chat._id}')">مسدودسازی</button>`}

        </td>`;
    
    tbody.appendChild(tr);

    // افزودن کلیک برای نمایش اطلاعات فرستنده
    tr.querySelector('.msg-sender-cell').addEventListener('click', () => {
      openSenderModal(chat);
    });
  });
}

// تابع کمکی برای ایجاد پیام مناسب بر اساس فیلتر
function getEmptyFilterMessage() {
  switch(messagesFilterMode) {
    case 'seller':
      return 'هیچ پیامی از فروشنده‌ها وجود ندارد.';
    case 'customer':
      return 'هیچ پیامی از مشتری‌ها وجود ندارد.';
    case 'unanswered':
      return 'هیچ پیام پاسخ داده نشده‌ای وجود ندارد.';
    case 'oldest':
      return 'هیچ پیام قدیمی‌ای وجود ندارد.';
    default:
      return 'هیچ پیامی وجود ندارد.';
  }
}









// ----------------- فیلتر پیام‌ها -----------------
// ----------------- فیلتر پیام‌ها -----------------
// ——— کد یکپارچهٔ فیلتر و رندر پیام‌ها ———
let messagesFilterMode = 'seller'; // پیش‌فرض: پیام‌های فروشنده

// تنظیم دکمه‌های فیلتر
document.querySelectorAll('.messages-filters button').forEach(btn => {
  btn.addEventListener('click', () => {
    // حذف active از همه و اضافه کردن به کلیک‌شده
    document.querySelectorAll('.messages-filters button')
      .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // تعیین حالت فیلتر
    messagesFilterMode = btn.getAttribute('data-filter');
    renderMessages();
  });
});


// ————————————————————————————————





// هندل کلیک روی فرستنده (می‌تونه باکس یا مودال باز کنه)
function showSenderDetails(sellerId, label) {
  if (label !== 'فروشنده') return;
  alert(`مشخصات فروشنده (ID: ${sellerId})`);
}


async function deleteMessage(chatId) {
  if (!confirm('آیا مطمئن هستید که می‌خواهید این چت را حذف کنید؟')) return;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/chats/${chatId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'خطا در حذف چت');
    }

    // بروزرسانی لیست
    messagesList = messagesList.filter(c => c._id !== chatId);
    renderMessages();
    updateSidebarCounts();

  } catch (err) {
    alert('❌ ' + (err.message || 'خطا در حذف چت'));
    console.error(err);
  }
}




// مسدودسازی فرستنده مستقیماً از جدول
async function blockSender(chatId) {
  const chat = messagesList.find(c => c._id === chatId) || {};
  
  // استخراج targetId و targetRole از participants
  let targetRole = 'user'; // پیش‌فرض مشتری
  let targetId = null;
  
  if (chat.participants && chat.participants.length > 1) {
    const nonAdmin = chat.participants.find(p => p.role !== 'admin');
    if (nonAdmin) {
      targetId = nonAdmin._id;
      targetRole = nonAdmin.role === 'seller' ? 'seller' : 'user';
    }
  } else if (chat.sellerId) {
    targetId = chat.sellerId;
    targetRole = 'seller';
  } else if (chat.customerId || chat.userId) {
    targetId = chat.customerId || chat.userId;
    targetRole = 'user';
  }

  const label = targetRole === 'seller' ? 'فروشنده' : 'مشتری';
  if (!targetId) return alert('شناسه کاربر پیدا نشد.');

  if (!confirm(`آیا مطمئن هستید که می‌خواهید این ${label} را مسدود کنید؟`)) return;

  try {
    console.log('blockSender ->', { targetId, targetRole });
    const res = await fetch(`${ADMIN_API_BASE}/chats/block-target`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, targetRole })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در مسدودسازی');

    alert('✅ ' + (data.message || 'کاربر با موفقیت مسدود شد.'));
    await fetchMessages();
  } catch (err) {
    console.error('❌ blockSender error:', err);
    alert('❌ ' + err.message);
  }
}

async function unblockSender(chatId) {
  const chat = messagesList.find(c => c._id === chatId) || {};
  
  // استخراج targetId و targetRole از participants
  let targetRole = 'user';
  let targetId = null;
  
  if (chat.participants && chat.participants.length > 1) {
    const nonAdmin = chat.participants.find(p => p.role !== 'admin');
    if (nonAdmin) {
      targetId = nonAdmin._id;
      targetRole = nonAdmin.role === 'seller' ? 'seller' : 'user';
    }
  } else if (chat.sellerId) {
    targetId = chat.sellerId;
    targetRole = 'seller';
  } else if (chat.customerId || chat.userId) {
    targetId = chat.customerId || chat.userId;
    targetRole = 'user';
  }

  const label = targetRole === 'seller' ? 'فروشنده' : 'مشتری';
  if (!targetId) return alert('شناسه کاربر پیدا نشد.');

  if (!confirm(`آیا مطمئن هستید که می‌خواهید این ${label} را آزاد کنید؟`)) return;

  try {
    console.log('unblockSender ->', { targetId, targetRole });
    const res = await fetch(`${ADMIN_API_BASE}/chats/unblock-target`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, targetRole })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در رفع مسدودی');

    alert('✅ ' + (data.message || 'کاربر آزاد شد.'));
    await fetchMessages();
  } catch (err) {
    console.error('❌ unblockSender error:', err);
    alert('❌ ' + err.message);
  }
}



// -------- fetchers --------
// ← این بخش را پیدا کنید (جایی که تابع fetchUsers تعریف شده است)
// بهتره این خطاگیری رو هم به تابع اضافه کنید
// ← این بخش را پیدا کنید (جایی که تابع fetchUsers تعریف شده است)
// ─── اصلاح تابع fetchUsers ───
// جایگزین کل تابع قبلی کنید
const DASHBOARD_TREND_DAYS = 90;

async function fetchDashboardStats(days = DASHBOARD_TREND_DAYS) {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/admin/dashboard/stats?days=${encodeURIComponent(days)}`, {
      credentials: 'include'
    });

    if (!res.ok) {
      console.error('fetchDashboardStats – HTTP‑', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error('fetchDashboardStats – EXCEPTION', err);
    return null;
  }
}

function applyDashboardStats(stats, { usersFallback = 0, sellersFallback = 0, productsFallback = 0 } = {}) {
  const safeNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  dashboardSummary = {
    visitsToday: safeNumber(stats?.summary?.visitsToday),
    newUsersToday: safeNumber(stats?.summary?.newUsersToday),
    newSellersToday: safeNumber(stats?.summary?.newSellersToday),
    newProductsToday: safeNumber(stats?.summary?.newProductsToday),
    newServiceShopsToday: safeNumber(stats?.summary?.newServiceShopsToday),
    totalUsers: safeNumber(stats?.summary?.totalUsers, safeNumber(usersFallback)),
    totalSellers: safeNumber(stats?.summary?.totalSellers, safeNumber(sellersFallback)),
    totalProducts: safeNumber(stats?.summary?.totalProducts, safeNumber(productsFallback)),
    totalServiceShops: safeNumber(stats?.summary?.totalServiceShops),
    activeServiceShops: safeNumber(stats?.summary?.activeServiceShops),
    pendingServiceShops: safeNumber(stats?.summary?.pendingServiceShops),
    premiumServiceShops: safeNumber(stats?.summary?.premiumServiceShops),
    generatedAt: stats?.generatedAt || null,
    range: stats?.range || null
  };

  const trendsPayload = Array.isArray(stats?.trends) ? stats.trends : [];

  const normalisedTrend = trendsPayload
    .map((item) => {
      const iso = typeof item.date === 'string'
        ? item.date.slice(0, 10)
        : (item.date ? new Date(item.date).toISOString().slice(0, 10) : null);

      if (!iso) return null;

      const dateObj = new Date(iso);
      const label = Number.isNaN(dateObj.getTime())
        ? iso
        : persianDateFormatter.format(dateObj);

      return {
        date: iso,
        label,
        visits: safeNumber(item.visits),
        users: safeNumber(item.newUsers),
        sellers: safeNumber(item.newSellers),
        products: safeNumber(item.newProducts),
        serviceShops: safeNumber(item.newServiceShops)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  dashboardTrend = normalisedTrend;
  trendLabels = dashboardTrend.map((item) => item.label);
  visitsPerDay = dashboardTrend.map((item) => item.visits);
  usersPerDay = dashboardTrend.map((item) => item.users);
  sellersPerDay = dashboardTrend.map((item) => item.sellers);
  productsPerDay = dashboardTrend.map((item) => item.products);
  serviceShopsPerDay = dashboardTrend.map((item) => item.serviceShops);
}

async function fetchUsers() {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/user`, {   // ← مسیر مفرد
      credentials: 'include'
      });
    if (!res.ok) {
      console.error('Error fetching users:', res.status, await res.text());
      return [];
    }
    const data = await res.json();
    console.log('fetchUsers returned:', data);      // ← برای دیباگ بنویسید ببینید زیر چه کلیدی آبجکتِ کاربرهاست
    // اگر مستقیماً آرایه است:
    if (Array.isArray(data)) return data;
    // اگر زیر فیلد users یا data قرار گرفته:
    if (Array.isArray(data.users)) return data.users;
    if (Array.isArray(data.data))  return data.data;
    return [];
  } catch (err) {
    console.error('Exception in fetchUsers:', err);
    return [];
  }
}


function normaliseSellerRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const result = { ...raw };
  const sellerId = toIdString(
    raw.sellerId ||
    raw._sid ||
    raw._id ||
    raw.id ||
    (raw.shopurl ? `shopurl:${raw.shopurl}` : '')
  );

  const ownerFirstname = raw.ownerFirstname || raw.firstname || '';
  const ownerLastname = raw.ownerLastname || raw.lastname || '';
  const ownerName = raw.ownerName || [ownerFirstname, ownerLastname].filter(Boolean).join(' ').trim();

  const shopurl = raw.shopurl || raw.shopUrl || '';
  const storename = raw.storename || raw.shopLogoText || raw.shopName || '';
  const address = raw.address || raw.shopAddress || '';
  const phone = raw.phone || raw.ownerPhone || raw.mobile || '';

  result.sellerId = sellerId;
  result._sid = sellerId;
  result.ownerFirstname = ownerFirstname;
  result.ownerLastname = ownerLastname;
  result.ownerName = ownerName;
  result.shopurl = shopurl;
  result.storename = storename;
  result.shopLogoText = raw.shopLogoText || storename;
  result.address = address;
  result.shopAddress = raw.shopAddress || address;
  result.phone = phone;
  result.mobile = raw.mobile || phone;
  result.subscriptionStart = raw.subscriptionStart || null;
  result.subscriptionEnd = raw.subscriptionEnd || null;
  if (!result.subscriptionType) {
    result.subscriptionType = raw.isPremium ? 'premium' : '';
  }
  result.blockedByAdmin = !!raw.blockedByAdmin;
  result.blockedAt = raw.blockedAt || null;
  result.blockedBy = raw.blockedBy || null;
  result.blockedReason = raw.blockedReason || '';
  result.productsCount = raw.productsCount || raw.productCount || 0;
  result.visits = raw.visits || raw.shopVisits || 0;

  if (!result.createdAt && raw.createdAt) {
    result.createdAt = raw.createdAt;
  }

  return result;
}

async function fetchShops() {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/sellers`, { credentials: 'include' });
    let payload = null;
    try {
      payload = await res.json();
    } catch (err) {
      payload = null;
    }

    if (!res.ok) {
      console.error('fetchShops – HTTP-', res.status, payload);
      return [];
    }

    const list = Array.isArray(payload)
      ? payload
      : (payload?.sellers || payload?.items || payload?.data?.sellers || payload?.data || []);

    return list
      .map(normaliseSellerRecord)
      .filter(Boolean);
  } catch (err) {
    console.error('fetchShops – EXCEPTION', err);
    return [];
  }
}

async function ensureShopsLoaded() {
  if (!shopsList.length) {
    shopsList = await fetchShops();
  }
}

async function sellerExists(phone) {
  await ensureShopsLoaded();
  return shopsList.some(s => normalizePhone(s.ownerPhone || s.phone || s.shopPhone) === phone);
}
/* -------- fetchProducts (FIXED & ROBUST) -------- */
async function fetchProducts () {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/products`, { credentials: 'include' });

    /* اگر پاسخ خطاست یک آرایهٔ خالی برگردانیم */
    if (!res.ok) {
      console.error('fetchProducts – HTTP‑', res.status, await res.text());
      return [];
    }

    const data = await res.json();

    /* در بسیاری از بک‑اِندها دادهٔ واقعی زیر کلیدهای متفاوت است */
    const productsArr =
          (Array.isArray(data)                    ? data                     :
          Array.isArray(data.products)            ? data.products            :
          Array.isArray(data.items)               ? data.items               :
          Array.isArray(data.allProducts)         ? data.allProducts         :
          Array.isArray(data.data?.products)      ? data.data.products       :
          Array.isArray(data.data?.items)         ? data.data.items          :
          []);

    return productsArr;
  } catch (err) {
    console.error('fetchProducts – EXCEPTION', err);
    return [];
  }
}


// -------- نمایش کارت‌ها و جداول --------
function updateDashboardCards() {
  document.getElementById('visit-today').textContent = formatNumber(dashboardSummary.visitsToday);
  document.getElementById('register-user-today').textContent = formatNumber(dashboardSummary.newUsersToday);
  document.getElementById('register-seller-today').textContent = formatNumber(dashboardSummary.newSellersToday);
  document.getElementById('products-total').textContent = formatNumber(dashboardSummary.totalProducts);
  const serviceCardValue = document.getElementById('service-shops-total');
  if (serviceCardValue) {
    serviceCardValue.textContent = formatNumber(dashboardSummary.activeServiceShops);
  }
}
function updateSidebarCounts() {
  document.getElementById('count-users').textContent    = formatNumber(usersList.length);
  document.getElementById('count-sellers').textContent  = formatNumber(shopsList.length);
  document.getElementById('count-products').textContent = formatNumber(productsList.length);
  const serviceCountEl = document.getElementById('count-service-shops');
  if (serviceCountEl) {
    serviceCountEl.textContent = formatNumber(dashboardSummary.totalServiceShops || 0);
  }
  const servicePlansCountEl = document.getElementById('count-service-plans');
  if (servicePlansCountEl) {
    servicePlansCountEl.textContent = formatNumber(servicePlansList.length || 0);
  }
  const centersCountEl = document.getElementById('count-shopping-centers');
  if (centersCountEl) centersCountEl.textContent = formatNumber(shoppingCentersList.length);

  const unread = getTotalUnreadMessages();
  // فقط اگر عدد بزرگ‌تر از صفر باشد نمایش بده
  document.getElementById('count-messages').textContent = unread > 0 ? formatNumber(unread) : '';
  updateAdOrdersSummary();
}
function updateHeaderCounts() {
  document.getElementById('header-users-count').textContent    = `(${formatNumber(usersList.length)} کاربر)`;
  document.getElementById('header-sellers-count').textContent  = `(${formatNumber(shopsList.length)} فروشگاه)`;
  document.getElementById('header-products-count').textContent = `(${formatNumber(productsList.length)} محصول)`;
  const serviceHeaderEl = document.getElementById('header-service-shops-count');
  if (serviceHeaderEl) {
    serviceHeaderEl.textContent = `(${formatNumber(dashboardSummary.totalServiceShops || 0)} مغازه)`;
  }
  const servicePlanHeaderEl = document.getElementById('header-service-plans-count');
  if (servicePlanHeaderEl) {
    servicePlanHeaderEl.textContent = `(${formatNumber(servicePlansList.length || 0)} پلن)`;
  }
  const centersHeaderEl = document.getElementById('header-shopping-centers-count');
  if (centersHeaderEl) centersHeaderEl.textContent = `(${formatNumber(shoppingCentersList.length)} مرکز خرید)`;

  const unread = getTotalUnreadMessages();
  // اگر صفر بود خالی بنویس
  document.getElementById('header-messages-count').textContent =
    unread > 0 ? `(${formatNumber(unread)} پیام جدید)` : '';
}




/* -------- مدیریت مغازه‌های خدماتی -------- */
const SERVICE_SHOPS_PAGE_SIZE = 10;
const SERVICE_STATUS_LABELS = {
  approved: 'تایید شده',
  pending: 'در انتظار تایید',
  suspended: 'معلق / غیرفعال',
  archived: 'آرشیو شده',
  draft: 'پیش‌نویس'
};
const SERVICE_STATUS_CLASS = {
  approved: 'approved',
  pending: 'pending',
  suspended: 'suspended',
  archived: 'archived',
  draft: 'draft'
};

const serviceShopsPanelEl = document.getElementById('service-shops-panel');
const serviceShopsIframe = document.getElementById('service-shops-iframe');
const serviceShopsEmbedLoading = document.getElementById('service-shops-embed-loading');
const serviceShopsTableBody = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-shops-table tbody') : null;
const serviceShopsLoadingEl = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-shops-loading') : null;
const serviceShopsEmptyEl = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-shops-empty') : null;
const serviceShopsPaginationEl = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-shops-pagination') : null;
const serviceShopsStatusBreakdownEl = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-status-breakdown') : null;
const serviceTopCitiesEl = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-top-cities') : null;
const serviceTopCategoriesEl = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-top-categories') : null;
const serviceRecentListEl = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-recent-list') : null;
const serviceShopsSummaryCards = serviceShopsPanelEl ? Array.from(serviceShopsPanelEl.querySelectorAll('.service-summary-card')) : [];
const serviceShopsQuickFilters = serviceShopsPanelEl ? Array.from(serviceShopsPanelEl.querySelectorAll('[data-service-quick-filter]')) : [];
const serviceShopsAdvancedToggle = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-shops-advanced-toggle') : null;
const serviceShopsAdvancedWrapper = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-shops-advanced') : null;

let serviceShopsIframeObserver = null;
let serviceShopsIframeLoaded = false;

function adjustServiceShopsIframeHeight() {
  if (!serviceShopsIframe || !serviceShopsIframeLoaded) return;
  try {
    const doc = serviceShopsIframe.contentDocument;
    if (!doc) return;
    const body = doc.body;
    const html = doc.documentElement;
    const height = Math.max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      html ? html.scrollHeight : 0,
      html ? html.offsetHeight : 0
    );
    if (height) {
      const padding = window.innerWidth < 768 ? 24 : 48;
      serviceShopsIframe.style.height = `${height + padding}px`;
    }
  } catch (err) {
    console.warn('service-shops iframe height adjustment failed:', err);
  }
}

function setupServiceShopsIframeListeners() {
  if (!serviceShopsIframe || serviceShopsIframe.dataset.listeners === 'true') return;
  serviceShopsIframe.addEventListener('load', () => {
    if (serviceShopsIframe.dataset.loaded !== 'true') {
      return;
    }
    serviceShopsIframeLoaded = true;
    if (serviceShopsEmbedLoading) {
      serviceShopsEmbedLoading.style.display = 'none';
    }
    serviceShopsIframe.classList.add('is-ready');
    adjustServiceShopsIframeHeight();
    try {
      const doc = serviceShopsIframe.contentDocument;
      if (doc?.body) {
        serviceShopsIframeObserver?.disconnect?.();
        serviceShopsIframeObserver = new MutationObserver(() => {
          adjustServiceShopsIframeHeight();
        });
        serviceShopsIframeObserver.observe(doc.body, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true
        });
      }
      serviceShopsIframe.contentWindow?.addEventListener('resize', adjustServiceShopsIframeHeight);
    } catch (err) {
      console.warn('service-shops iframe observer setup failed:', err);
    }
  });
  serviceShopsIframe.dataset.listeners = 'true';
  window.addEventListener('resize', adjustServiceShopsIframeHeight);
}

function ensureServiceShopsIframeLoaded() {
  if (!serviceShopsIframe) return;
  setupServiceShopsIframeListeners();
  if (serviceShopsIframe.dataset.loaded === 'true') {
    adjustServiceShopsIframeHeight();
    return;
  }
  const src = serviceShopsIframe.dataset.src || 'service-shops.html';
  serviceShopsIframe.src = src;
  serviceShopsIframe.dataset.loaded = 'true';
}

setupServiceShopsIframeListeners();

const serviceShopsSummaryValues = {
  total: document.getElementById('service-summary-total'),
  active: document.getElementById('service-summary-active'),
  pending: document.getElementById('service-summary-pending'),
  suspended: document.getElementById('service-summary-suspended'),
  archived: document.getElementById('service-summary-archived'),
  featured: document.getElementById('service-summary-featured'),
  premium: document.getElementById('service-summary-premium'),
  booking: document.getElementById('service-summary-booking')
};

const serviceShopForm = document.getElementById('serviceShopManagementForm');
const serviceShopFormStatus = document.getElementById('serviceShopFormStatus');
const serviceShopFormDraftBtn = document.getElementById('serviceShopFormDraft');
const serviceShopGuideBtn = document.getElementById('serviceShopFormGuide');
const serviceShopGuidePanel = document.getElementById('serviceShopGuidePanel');
const serviceShopSelectedTags = document.getElementById('serviceShopSelectedTags');

const serviceShopPreviewElements = {
  name: document.getElementById('serviceShopPreviewName'),
  owner: document.getElementById('serviceShopPreviewOwner'),
  city: document.getElementById('serviceShopPreviewCity'),
  plan: document.getElementById('serviceShopPreviewPlan'),
  status: document.getElementById('serviceShopPreviewStatus'),
  booking: document.getElementById('serviceShopPreviewBooking'),
  period: document.getElementById('serviceShopPreviewPeriod')
};

function setServiceShopFormStatus(message = '', state = '') {
  if (!serviceShopFormStatus) return;
  serviceShopFormStatus.textContent = message;
  serviceShopFormStatus.classList.remove('is-success', 'is-error', 'is-info', 'is-visible');
  if (!message) return;
  serviceShopFormStatus.classList.add('is-visible');
  if (state) {
    serviceShopFormStatus.classList.add(`is-${state}`);
  }
}

function formatPersianDate(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(date);
  } catch (err) {
    console.warn('serviceShopForm – unable to format date', err);
    return value;
  }
}

function updateServiceShopPreview() {
  if (!serviceShopForm) return;
  const nameInput = serviceShopForm.querySelector('#serviceShopName');
  const ownerInput = serviceShopForm.querySelector('#serviceShopOwner');
  const citySelect = serviceShopForm.querySelector('#serviceShopCity');
  const planRadio = serviceShopForm.querySelector('input[name="serviceShopPlanTier"]:checked');
  const statusSwitch = serviceShopForm.querySelector('#serviceShopStatus');
  const bookingSwitch = serviceShopForm.querySelector('#serviceShopBooking');
  const startInput = serviceShopForm.querySelector('#serviceShopPlanStart');
  const endInput = serviceShopForm.querySelector('#serviceShopPlanEnd');

  if (serviceShopPreviewElements.name) {
    const value = nameInput?.value?.trim();
    serviceShopPreviewElements.name.textContent = value || '—';
  }
  if (serviceShopPreviewElements.owner) {
    const value = ownerInput?.value?.trim();
    serviceShopPreviewElements.owner.textContent = value || '—';
  }
  if (serviceShopPreviewElements.city) {
    const optionLabel = citySelect?.options?.[citySelect.selectedIndex]?.text?.trim();
    serviceShopPreviewElements.city.textContent = optionLabel && citySelect.value ? optionLabel : '—';
  }
  if (serviceShopPreviewElements.plan) {
    const label = planRadio?.dataset?.label || 'پلن پایه';
    serviceShopPreviewElements.plan.textContent = label;
  }
  if (serviceShopPreviewElements.status) {
    serviceShopPreviewElements.status.textContent = statusSwitch?.checked ? 'فعال' : 'غیرفعال';
  }
  if (serviceShopPreviewElements.booking) {
    serviceShopPreviewElements.booking.textContent = bookingSwitch?.checked ? 'فعال' : 'غیرفعال';
  }
  if (serviceShopPreviewElements.period) {
    const start = formatPersianDate(startInput?.value);
    const end = formatPersianDate(endInput?.value);
    if (start && end) {
      serviceShopPreviewElements.period.textContent = `${start} → ${end}`;
    } else if (start) {
      serviceShopPreviewElements.period.textContent = `از ${start}`;
    } else if (end) {
      serviceShopPreviewElements.period.textContent = `تا ${end}`;
    } else {
      serviceShopPreviewElements.period.textContent = '—';
    }
  }
}

function updateServiceShopTagPreview() {
  if (!serviceShopForm || !serviceShopSelectedTags) return;
  const selected = Array.from(serviceShopForm.querySelectorAll('input[type="checkbox"][data-tag]:checked'))
    .map(input => input.value?.trim())
    .filter(Boolean);
  serviceShopSelectedTags.innerHTML = '';
  if (!selected.length) {
    serviceShopSelectedTags.classList.add('empty');
    return;
  }
  serviceShopSelectedTags.classList.remove('empty');
  selected.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'chip-item';
    chip.textContent = tag;
    serviceShopSelectedTags.appendChild(chip);
  });
}

function persistServiceShopDraft() {
  if (!serviceShopForm || typeof sessionStorage === 'undefined') return;
  try {
    const data = {
      name: serviceShopForm.querySelector('#serviceShopName')?.value || '',
      owner: serviceShopForm.querySelector('#serviceShopOwner')?.value || '',
      phone: serviceShopForm.querySelector('#serviceShopPhone')?.value || '',
      city: serviceShopForm.querySelector('#serviceShopCity')?.value || '',
      area: serviceShopForm.querySelector('#serviceShopArea')?.value || '',
      address: serviceShopForm.querySelector('#serviceShopAddress')?.value || '',
      hours: serviceShopForm.querySelector('#serviceShopHours')?.value || '',
      category: serviceShopForm.querySelector('#serviceShopCategory')?.value || '',
      subcategories: Array.from(serviceShopForm.querySelector('#serviceShopSubcategories')?.selectedOptions || []).map(opt => opt.value),
      tags: Array.from(serviceShopForm.querySelectorAll('input[type="checkbox"][data-tag]:checked')).map(input => input.value),
      planTier: serviceShopForm.querySelector('input[name="serviceShopPlanTier"]:checked')?.value || 'basic',
      planStart: serviceShopForm.querySelector('#serviceShopPlanStart')?.value || '',
      planEnd: serviceShopForm.querySelector('#serviceShopPlanEnd')?.value || '',
      isActive: serviceShopForm.querySelector('#serviceShopStatus')?.checked || false,
      booking: serviceShopForm.querySelector('#serviceShopBooking')?.checked || false,
      featured: serviceShopForm.querySelector('#serviceShopFeatured')?.checked || false,
      notes: serviceShopForm.querySelector('#serviceShopNotes')?.value || ''
    };
    sessionStorage.setItem('service-shop-form-draft', JSON.stringify(data));
    setServiceShopFormStatus('اطلاعات به‌صورت پیش‌نویس در این مرورگر ذخیره شد.', 'info');
  } catch (err) {
    console.warn('serviceShopForm – persist draft failed', err);
    setServiceShopFormStatus('ذخیره پیش‌نویس با مشکل مواجه شد.', 'error');
  }
}

function restoreServiceShopDraft() {
  if (!serviceShopForm || typeof sessionStorage === 'undefined') return;
  try {
    const raw = sessionStorage.getItem('service-shop-form-draft');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return;
    const assignValue = (selector, value) => {
      const element = serviceShopForm.querySelector(selector);
      if (element && value !== undefined) {
        element.value = value;
      }
    };
    assignValue('#serviceShopName', data.name);
    assignValue('#serviceShopOwner', data.owner);
    assignValue('#serviceShopPhone', data.phone);
    assignValue('#serviceShopCity', data.city);
    assignValue('#serviceShopArea', data.area);
    assignValue('#serviceShopAddress', data.address);
    assignValue('#serviceShopHours', data.hours);
    assignValue('#serviceShopCategory', data.category);
    assignValue('#serviceShopPlanStart', data.planStart);
    assignValue('#serviceShopPlanEnd', data.planEnd);
    assignValue('#serviceShopNotes', data.notes);

    const subcategoriesSelect = serviceShopForm.querySelector('#serviceShopSubcategories');
    if (subcategoriesSelect && Array.isArray(data.subcategories)) {
      const values = new Set(data.subcategories);
      Array.from(subcategoriesSelect.options).forEach(option => {
        option.selected = values.has(option.value);
      });
    }

    if (Array.isArray(data.tags)) {
      const tagValues = new Set(data.tags);
      serviceShopForm.querySelectorAll('input[type="checkbox"][data-tag]').forEach(input => {
        input.checked = tagValues.has(input.value);
      });
    }

    if (data.planTier) {
      const tierRadio = serviceShopForm.querySelector(`input[name="serviceShopPlanTier"][value="${data.planTier}"]`);
      if (tierRadio) tierRadio.checked = true;
    }

    const setChecked = (selector, value) => {
      const element = serviceShopForm.querySelector(selector);
      if (element) element.checked = Boolean(value);
    };
    setChecked('#serviceShopStatus', data.isActive);
    setChecked('#serviceShopBooking', data.booking);
    setChecked('#serviceShopFeatured', data.featured);

    updateServiceShopTagPreview();
    updateServiceShopPreview();
  } catch (err) {
    console.warn('serviceShopForm – restore draft failed', err);
  }
}

function clearServiceShopDraft() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem('service-shop-form-draft');
}

if (serviceShopGuideBtn && serviceShopGuidePanel) {
  serviceShopGuideBtn.addEventListener('click', () => {
    const expanded = serviceShopGuideBtn.getAttribute('aria-expanded') === 'true';
    serviceShopGuideBtn.setAttribute('aria-expanded', (!expanded).toString());
    serviceShopGuidePanel.hidden = expanded;
    if (!expanded) {
      serviceShopGuidePanel.focus();
    }
  });
}

if (serviceShopForm) {
  restoreServiceShopDraft();
  updateServiceShopTagPreview();
  updateServiceShopPreview();

  serviceShopForm.addEventListener('input', event => {
    if (event.target && event.target.matches('input, textarea, select')) {
      updateServiceShopPreview();
      if (event.target.matches('input[type="checkbox"][data-tag]')) {
        updateServiceShopTagPreview();
      }
    }
  });

  serviceShopForm.addEventListener('change', event => {
    if (event.target && event.target.matches('input, textarea, select')) {
      updateServiceShopPreview();
      if (event.target.matches('input[type="checkbox"][data-tag]')) {
        updateServiceShopTagPreview();
      }
    }
  });

  serviceShopForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!serviceShopForm.checkValidity()) {
      serviceShopForm.reportValidity();
      setServiceShopFormStatus('لطفاً موارد الزامی فرم را تکمیل کنید.', 'error');
      return;
    }

    const planLabel = serviceShopForm.querySelector('input[name="serviceShopPlanTier"]:checked')?.dataset?.label || 'پلن پایه';
    const shopName = serviceShopForm.querySelector('#serviceShopName')?.value?.trim() || 'مغازه بدون نام';
    clearServiceShopDraft();
    serviceShopForm.reset();
    updateServiceShopTagPreview();
    updateServiceShopPreview();
    setServiceShopFormStatus(`اطلاعات مغازه «${shopName}» با موفقیت برای پلن ${planLabel} ثبت موقت شد. برای ثبت نهایی در بک‌اند، ارسال کنید.`, 'success');
  });

  serviceShopForm.addEventListener('reset', () => {
    setTimeout(() => {
      updateServiceShopTagPreview();
      updateServiceShopPreview();
      setServiceShopFormStatus('فرم به حالت اولیه بازنشانی شد.', 'info');
    }, 0);
  });
}

if (serviceShopFormDraftBtn) {
  serviceShopFormDraftBtn.addEventListener('click', persistServiceShopDraft);
}


const serviceShopsSummaryHints = {
  total: document.getElementById('service-summary-hint-total'),
  active: document.getElementById('service-summary-hint-active'),
  pending: document.getElementById('service-summary-hint-pending'),
  suspended: document.getElementById('service-summary-hint-suspended'),
  archived: document.getElementById('service-summary-hint-archived'),
  featured: document.getElementById('service-summary-hint-featured'),
  premium: document.getElementById('service-summary-hint-premium'),
  booking: document.getElementById('service-summary-hint-booking')
};

const serviceShopsInputs = serviceShopsPanelEl ? {
  search: serviceShopsPanelEl.querySelector('#service-shops-search'),
  status: serviceShopsPanelEl.querySelector('#service-shops-status'),
  city: serviceShopsPanelEl.querySelector('#service-shops-city'),
  featured: serviceShopsPanelEl.querySelector('#service-shops-featured'),
  premium: serviceShopsPanelEl.querySelector('#service-shops-premium'),
  booking: serviceShopsPanelEl.querySelector('#service-shops-booking'),
  refresh: serviceShopsPanelEl.querySelector('#service-shops-refresh'),
  reset: serviceShopsPanelEl.querySelector('#service-shops-reset')
} : {};

const serviceShopsState = {
  overview: null,
  items: [],
  pagination: { page: 1, pages: 1, total: 0, limit: SERVICE_SHOPS_PAGE_SIZE },
  filters: { search: '', status: 'all', city: '', featured: 'all', premium: 'all', booking: 'all' },
  loading: false,
  initialised: false,
  mapById: new Map()
};

let serviceShopsSearchTimer = null;
let serviceShopsCityTimer = null;

function getServiceStatusLabel(status = '') {
  const key = String(status || '').toLowerCase();
  return SERVICE_STATUS_LABELS[key] || 'نامشخص';
}

function getServiceStatusClass(status = '') {
  const key = String(status || '').toLowerCase();
  return SERVICE_STATUS_CLASS[key] || 'pending';
}

function isPremiumActive(shop = {}) {
  if (!shop) return false;
  if (shop.isPremium && !shop.premiumUntil) return true;
  const until = shop.premiumUntil || shop.premiumActiveUntil;
  if (!until) return !!shop.isPremium;
  const date = new Date(until);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

function highlightServiceQuickFilters() {
  if (!serviceShopsQuickFilters?.length) return;
  const activeStatus = serviceShopsState.filters.status || 'all';
  serviceShopsQuickFilters.forEach((btn) => {
    const status = btn.dataset.serviceQuickFilter || 'all';
    btn.classList.toggle('active', status === activeStatus);
  });
}

function highlightServiceSummary() {
  if (!serviceShopsSummaryCards) return;
  const activeStatus = serviceShopsState.filters.status || 'all';
  serviceShopsSummaryCards.forEach((card) => {
    const status = card.dataset.statusFilter;
    if (typeof status !== 'undefined') {
      card.classList.toggle('active', status === activeStatus);
    } else {
      card.classList.remove('active');
    }
  });
  highlightServiceQuickFilters();
}

function renderServiceShopsOverview() {
  if (!serviceShopsPanelEl) return;
  const overview = serviceShopsState.overview;
  const totals = overview?.totals || {};
  const totalAll = Number(totals.total) || 0;
  const summaryMap = {
    total: totalAll,
    active: Number(totals.active) || 0,
    pending: Number(totals.pending) || 0,
    suspended: Number(totals.suspended) || 0,
    archived: Number(totals.archived) || 0,
    featured: Number(totals.featured) || 0,
    premium: Number(totals.premiumActive) || 0,
    booking: Number(totals.bookingEnabled) || 0
  };

  Object.entries(summaryMap).forEach(([key, value]) => {
    if (serviceShopsSummaryValues[key]) {
      serviceShopsSummaryValues[key].textContent = formatNumber(value || 0);
    }
    if (serviceShopsSummaryHints[key]) {
      let hintText = '';
      if (key === 'total') {
        hintText = totalAll ? `${formatNumber(totalAll)} مغازه ثبت شده` : 'هنوز داده‌ای ثبت نشده است.';
      } else if (['active', 'pending', 'suspended', 'archived'].includes(key)) {
        hintText = totalAll ? `${formatPercent(value || 0, totalAll)} از کل` : 'بدون داده';
      } else if (key === 'featured') {
        hintText = totalAll ? `${formatPercent(value || 0, totalAll)} ویژه` : '';
      } else if (key === 'premium') {
        hintText = totalAll ? `${formatPercent(value || 0, totalAll)} پریمیوم فعال` : '';
      } else if (key === 'booking') {
        hintText = totalAll ? `${formatPercent(value || 0, totalAll)} رزرو فعال` : '';
      }
      serviceShopsSummaryHints[key].textContent = hintText;
    }
  });

  if (serviceShopsStatusBreakdownEl) {
    const entries = Object.entries(overview?.statusCounts || {}).filter(([, count]) => Number(count) > 0);
    if (!entries.length) {
      serviceShopsStatusBreakdownEl.innerHTML = '<li class="empty">داده‌ای موجود نیست.</li>';
    } else {
      serviceShopsStatusBreakdownEl.innerHTML = entries.map(([status, count]) => (
        `<li><span>${getServiceStatusLabel(status)}</span><span>${formatNumber(count)}</span></li>`
      )).join('');
    }
  }

  if (serviceTopCitiesEl) {
    const cities = Array.isArray(overview?.topCities) ? overview.topCities : [];
    if (!cities.length) {
      serviceTopCitiesEl.innerHTML = '<li class="empty">داده‌ای موجود نیست.</li>';
    } else {
      serviceTopCitiesEl.innerHTML = cities.map((item) => {
        const title = item?._id || item?.city || 'نامشخص';
        return `<li><span>${escapeHtml(title)}</span><span>${formatNumber(item?.count || 0)}</span></li>`;
      }).join('');
    }
  }

  if (serviceTopCategoriesEl) {
    const categories = Array.isArray(overview?.topCategories) ? overview.topCategories : [];
    if (!categories.length) {
      serviceTopCategoriesEl.innerHTML = '<li class="empty">داده‌ای موجود نیست.</li>';
    } else {
      serviceTopCategoriesEl.innerHTML = categories.map((item) => {
        const title = item?._id || item?.category || 'نامشخص';
        return `<li><span>${escapeHtml(title)}</span><span>${formatNumber(item?.count || 0)}</span></li>`;
      }).join('');
    }
  }

  if (serviceRecentListEl) {
    const recent = Array.isArray(overview?.recent) ? overview.recent : [];
    if (!recent.length) {
      serviceRecentListEl.innerHTML = '<div class="service-recent-item"><strong>موردی ثبت نشده است.</strong><span>با تایید مغازه‌ها، فهرست بروزرسانی می‌شود.</span></div>';
    } else {
      serviceRecentListEl.innerHTML = recent.map((shop) => {
        const name = escapeHtml(shop?.name || 'بدون نام');
        const city = shop?.city ? ` • ${escapeHtml(shop.city)}` : '';
        const statusLabel = getServiceStatusLabel(shop?.status);
        const statusClass = getServiceStatusClass(shop?.status);
        const updatedAt = escapeHtml(formatDateTime(shop?.updatedAt || shop?.lastReviewedAt || shop?.createdAt) || '—');
        const owner = shop?.ownerName ? `<span>مدیر: ${escapeHtml(shop.ownerName)}</span>` : '';
        return `<div class="service-recent-item"><strong>${name}</strong><span><span class="service-status-badge ${statusClass}">${statusLabel}</span>${city}</span><span>بروزرسانی: ${updatedAt}</span>${owner}</div>`;
      }).join('');
    }
  }

  highlightServiceSummary();
}

function showServiceShopsLoading(show, message = 'در حال بارگیری مغازه‌ها...') {
  if (!serviceShopsLoadingEl) return;
  if (show) {
    serviceShopsLoadingEl.style.display = 'flex';
    const textEl = serviceShopsLoadingEl.querySelector('span');
    if (textEl) textEl.textContent = message;
    if (serviceShopsEmptyEl) serviceShopsEmptyEl.style.display = 'none';
  } else {
    serviceShopsLoadingEl.style.display = 'none';
  }
}

function buildServiceShopRow(shop = {}) {
  const name = escapeHtml(shop.name || 'بدون نام');
  const city = shop.city ? `<span><i class="ri-map-pin-2-line"></i>${escapeHtml(shop.city)}</span>` : '';
  const category = shop.category ? `<span><i class="ri-price-tag-3-line"></i>${escapeHtml(shop.category)}</span>` : '';
  const ownerName = shop.ownerName ? `<span><i class="ri-user-3-line"></i>${escapeHtml(shop.ownerName)}</span>` : '';
  const phone = shop.ownerPhone || shop.phone || '';
  const phoneHtml = phone ? `<span><i class="ri-phone-line"></i>${escapeHtml(phone)}</span>` : '';
  const slug = shop.shopUrl ? `<span><i class="ri-at-line"></i>${escapeHtml(shop.shopUrl)}</span>` : '';
  const metaParts = [city, category, ownerName, phoneHtml, slug].filter(Boolean).join('');
  const flags = [];
  const isBlocked = !!(shop?.adminModeration?.isBlocked);
  const blockReason = String(shop?.adminModeration?.reason || '').trim();
  const blockedAt = shop?.adminModeration?.blockedAt ? formatDateTime(shop.adminModeration.blockedAt) : '';
  const blockReasonAttr = blockReason ? ` title="${escapeHtml(blockReason)}"` : '';
  if (shop.isFeatured) flags.push('<span class="service-flag featured"><i class="ri-star-smile-line"></i>ویژه</span>');
  if (isPremiumActive(shop)) flags.push('<span class="service-flag premium"><i class="ri-vip-crown-line"></i>پریمیوم</span>');
  if (shop?.bookingSettings?.enabled) flags.push('<span class="service-flag booking"><i class="ri-calendar-check-line"></i>رزرو فعال</span>');
  if (shop.isVisible === false) flags.push('<span class="service-flag hidden"><i class="ri-eye-off-line"></i>پنهان</span>');
  if (isBlocked) {
    flags.push(`<span class="service-flag blocked"${blockReasonAttr}><i class="ri-shield-keyhole-line"></i>مسدود</span>`);
  }
  const statusLabel = getServiceStatusLabel(shop.status);
  const statusClass = getServiceStatusClass(shop.status);
  const updated = escapeHtml(formatDateTime(shop.updatedAt || shop.lastReviewedAt || shop.createdAt) || '—');
  const shopUrlAttr = shop.shopUrl ? escapeHtml(shop.shopUrl) : '';
  const shopId = escapeHtml(toIdString(shop?._id || shop?.id || shop?.shopId || shop?.shopID || shop?.legacySellerId || ''));
  const sellerId = escapeHtml(toIdString(shop?.legacySellerId || shop?.sellerId || ''));
  const blockInfo = isBlocked
    ? `<div class="service-shop-block-reason"><i class="ri-shield-keyhole-line"></i><span>مسدود شده${blockedAt ? ` از ${escapeHtml(blockedAt)}` : ''}${blockReason ? ` • ${escapeHtml(blockReason)}` : ''}</span></div>`
    : '';

  return `<tr>
    <td>
      <div class="service-shop-name">${name}</div>
      ${metaParts ? `<div class="service-shop-meta">${metaParts}</div>` : ''}
      ${flags.length ? `<div class="service-shop-flags">${flags.join('')}</div>` : ''}
      ${blockInfo}
    </td>
    <td class="service-status-cell">
      <span class="service-status-badge ${statusClass}">${statusLabel}</span>
      ${shop.isVisible === false ? '<span class="service-flag hidden">غیرفعال</span>' : ''}
    </td>
    <td class="service-updated-cell">${updated}</td>
    <td class="service-actions-cell">
      <div class="service-shop-actions">
        <button class="action-btn edit" data-service-action="open" data-shop-url="${shopUrlAttr}">نمایه</button>
        ${phone ? `<button class="action-btn" data-service-action="copy-phone" data-phone="${escapeHtml(phone)}">کپی تماس</button>` : ''}
        ${shopId ? (isBlocked
          ? `<button class="action-btn unblock" data-service-action="unblock" data-shop-id="${shopId}"${sellerId ? ` data-seller-id="${sellerId}"` : ''}>رفع انسداد</button>`
          : `<button class="action-btn block" data-service-action="block" data-shop-id="${shopId}"${sellerId ? ` data-seller-id="${sellerId}"` : ''}>مسدودسازی</button>`)
          : ''}
      </div>
    </td>
  </tr>`;
}

function renderServiceShopsTable({ errorMessage = '' } = {}) {
  if (!serviceShopsTableBody) return;
  if (errorMessage) {
    serviceShopsTableBody.innerHTML = '';
    if (serviceShopsEmptyEl) {
      serviceShopsEmptyEl.innerHTML = `<i class="ri-error-warning-line"></i><p>${escapeHtml(errorMessage)}</p>`;
      serviceShopsEmptyEl.style.display = 'flex';
    }
    return;
  }
  const items = Array.isArray(serviceShopsState.items) ? serviceShopsState.items : [];
  if (!items.length) {
    serviceShopsTableBody.innerHTML = '';
    if (serviceShopsEmptyEl) {
      if (serviceShopsState.loading) {
        serviceShopsEmptyEl.style.display = 'none';
      } else {
        serviceShopsEmptyEl.innerHTML = '<i class="ri-store-2-line"></i><p>موردی برای نمایش یافت نشد.</p>';
        serviceShopsEmptyEl.style.display = 'flex';
      }
    }
    return;
  }
  if (serviceShopsEmptyEl) serviceShopsEmptyEl.style.display = 'none';
  serviceShopsTableBody.innerHTML = items.map(buildServiceShopRow).join('');
}

function renderServiceShopsPagination() {
  if (!serviceShopsPaginationEl) return;
  const { page, pages } = serviceShopsState.pagination;
  serviceShopsPaginationEl.innerHTML = '';
  if (pages <= 1) {
    serviceShopsPaginationEl.style.display = 'none';
    return;
  }
  serviceShopsPaginationEl.style.display = 'flex';

  const createButton = (label, targetPage, disabled = false, active = false) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    if (active) btn.classList.add('active');
    if (disabled) btn.disabled = true;
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      if (targetPage < 1 || targetPage > pages || targetPage === page) return;
      goToServiceShopsPage(targetPage);
    });
    return btn;
  };

  serviceShopsPaginationEl.appendChild(createButton('قبلی', page - 1, page <= 1));

  const maxButtons = 5;
  let start = Math.max(1, page - 2);
  let end = Math.min(pages, start + maxButtons - 1);
  if (end - start < maxButtons - 1) {
    start = Math.max(1, end - maxButtons + 1);
  }

  if (start > 1) {
    serviceShopsPaginationEl.appendChild(createButton('1', 1, false, page === 1));
    if (start > 2) {
      const dots = document.createElement('span');
      dots.className = 'dots';
      dots.textContent = '…';
      serviceShopsPaginationEl.appendChild(dots);
    }
  }

  for (let p = start; p <= end; p++) {
    serviceShopsPaginationEl.appendChild(createButton(String(p), p, false, p === page));
  }

  if (end < pages) {
    if (end < pages - 1) {
      const dots = document.createElement('span');
      dots.className = 'dots';
      dots.textContent = '…';
      serviceShopsPaginationEl.appendChild(dots);
    }
    serviceShopsPaginationEl.appendChild(createButton(String(pages), pages, false, page === pages));
  }

  serviceShopsPaginationEl.appendChild(createButton('بعدی', page + 1, page >= pages));
}

function goToServiceShopsPage(page) {
  serviceShopsState.pagination.page = page;
  loadServiceShopsList();
  if (serviceShopsPanelEl) {
    serviceShopsPanelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function loadServiceShopsOverview(force = false) {
  if (!serviceShopsPanelEl) return null;
  if (serviceShopsState.overview && !force) {
    renderServiceShopsOverview();
    return serviceShopsState.overview;
  }
  try {
    const res = await fetch(`${ADMIN_API_BASE}/service-shops/overview`, { credentials: 'include' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || 'خطا در دریافت نمای کلی مغازه‌های خدماتی.');
    }
    const data = await res.json();
    serviceShopsState.overview = data;
    renderServiceShopsOverview();
    applyServiceOverviewToDashboard(data);
    return data;
  } catch (err) {
    console.error('loadServiceShopsOverview error:', err);
    if (serviceShopsStatusBreakdownEl) {
      serviceShopsStatusBreakdownEl.innerHTML = `<li class="empty">${escapeHtml(err.message || 'خطا در دریافت نمای کلی.')}</li>`;
    }
    if (serviceTopCitiesEl) {
      serviceTopCitiesEl.innerHTML = `<li class="empty">${escapeHtml(err.message || 'خطا در دریافت اطلاعات.')}</li>`;
    }
    if (serviceTopCategoriesEl) {
      serviceTopCategoriesEl.innerHTML = `<li class="empty">${escapeHtml(err.message || 'خطا در دریافت اطلاعات.')}</li>`;
    }
    if (serviceRecentListEl) {
      serviceRecentListEl.innerHTML = `<div class="service-recent-item"><strong>خطا در دریافت اطلاعات</strong><span>${escapeHtml(err.message || '')}</span></div>`;
    }
    return null;
  }
}

async function loadServiceShopsList(force = false) {
  if (!serviceShopsPanelEl) return [];
  serviceShopsState.loading = true;
  showServiceShopsLoading(true, force ? 'در حال بروزرسانی فهرست...' : 'در حال بارگیری مغازه‌ها...');
  const params = new URLSearchParams();
  params.set('page', serviceShopsState.pagination.page);
  params.set('limit', serviceShopsState.pagination.limit);
  const filters = serviceShopsState.filters;
  if (filters.search) params.set('q', filters.search);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.city) params.set('city', filters.city);
  if (filters.featured !== 'all') params.set('isFeatured', filters.featured === 'yes' ? 'true' : 'false');
  if (filters.premium !== 'all') params.set('isPremium', filters.premium === 'yes' ? 'true' : 'false');
  if (filters.booking !== 'all') params.set('bookingEnabled', filters.booking === 'yes' ? 'true' : 'false');

  try {
    const res = await fetch(`${ADMIN_API_BASE}/service-shops?${params.toString()}`, { credentials: 'include' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || 'خطا در دریافت فهرست مغازه‌ها.');
    }
    const data = await res.json();
    const items = Array.isArray(data) ? data
      : Array.isArray(data?.items) ? data.items
      : Array.isArray(data?.data?.items) ? data.data.items
      : [];
    const paginationSource = data?.pagination || data?.data?.pagination || {};
    const total = Number(paginationSource.total) || Number(serviceShopsState.overview?.totals?.total) || items.length;
    const pages = Number(paginationSource.pages) || Math.max(1, Math.ceil(total / serviceShopsState.pagination.limit));
    const page = Number(paginationSource.page) || serviceShopsState.pagination.page;
    const limit = Number(paginationSource.limit) || serviceShopsState.pagination.limit;

    serviceShopsState.items = items;
    serviceShopsState.pagination = { page, pages, total, limit };
    serviceShopsState.mapById = new Map(items.map((item) => [toIdString(item?._id || item?.id || item?.shopId || item?.shopID || item?.shopUrl), item]));
    serviceShopsState.loading = false;
    showServiceShopsLoading(false);
    renderServiceShopsTable();
    renderServiceShopsPagination();
    serviceShopsState.initialised = true;
    return items;
  } catch (err) {
    console.error('loadServiceShopsList error:', err);
    serviceShopsState.loading = false;
    showServiceShopsLoading(false);
    serviceShopsState.items = [];
    renderServiceShopsTable({ errorMessage: err.message || 'خطا در دریافت داده‌ها.' });
    renderServiceShopsPagination();
    return [];
  }
}

async function ensureServiceShopsLoaded(force = false) {
  if (!serviceShopsPanelEl) return;
  await loadServiceShopsOverview(force);
  await loadServiceShopsList(force);
}

function applyServiceOverviewToDashboard(overview) {
  if (!overview?.totals) return;
  const totals = overview.totals;
  if (Number.isFinite(Number(totals.total))) {
    dashboardSummary.totalServiceShops = Number(totals.total);
  }
  if (Number.isFinite(Number(totals.active))) {
    dashboardSummary.activeServiceShops = Number(totals.active);
  }
  if (Number.isFinite(Number(totals.pending))) {
    dashboardSummary.pendingServiceShops = Number(totals.pending);
  }
  updateDashboardCards();
  updateSidebarCounts();
  updateHeaderCounts();
}

function setupServiceShopsPanel() {
  if (!serviceShopsPanelEl) return;
  highlightServiceSummary();
  const { search, status, city, featured, premium, booking, refresh, reset } = serviceShopsInputs;

  if (serviceShopsQuickFilters.length) {
    serviceShopsQuickFilters.forEach((btn) => {
      btn.addEventListener('click', () => {
        const statusKey = btn.dataset.serviceQuickFilter || 'all';
        serviceShopsState.filters.status = statusKey;
        serviceShopsState.pagination.page = 1;
        if (serviceShopsInputs.status) {
          serviceShopsInputs.status.value = statusKey;
        }
        highlightServiceSummary();
        loadServiceShopsList();
      });
    });
  }

  if (search) {
    search.addEventListener('input', () => {
      clearTimeout(serviceShopsSearchTimer);
      serviceShopsSearchTimer = setTimeout(() => {
        serviceShopsState.filters.search = search.value.trim();
        serviceShopsState.pagination.page = 1;
        loadServiceShopsList();
      }, 400);
    });
  }

  if (city) {
    city.addEventListener('input', () => {
      clearTimeout(serviceShopsCityTimer);
      serviceShopsCityTimer = setTimeout(() => {
        serviceShopsState.filters.city = city.value.trim();
        serviceShopsState.pagination.page = 1;
        loadServiceShopsList();
      }, 400);
    });
  }

  status?.addEventListener('change', () => {
    serviceShopsState.filters.status = status.value || 'all';
    serviceShopsState.pagination.page = 1;
    highlightServiceSummary();
    loadServiceShopsList();
  });

  if (serviceShopsAdvancedToggle && serviceShopsAdvancedWrapper) {
    serviceShopsAdvancedToggle.addEventListener('click', () => {
      const isHidden = serviceShopsAdvancedWrapper.hasAttribute('hidden');
      if (isHidden) {
        serviceShopsAdvancedWrapper.removeAttribute('hidden');
      } else {
        serviceShopsAdvancedWrapper.setAttribute('hidden', '');
      }
      serviceShopsAdvancedToggle.setAttribute('aria-expanded', String(isHidden));
    });
  }

  featured?.addEventListener('change', () => {
    serviceShopsState.filters.featured = featured.value || 'all';
    serviceShopsState.pagination.page = 1;
    loadServiceShopsList();
  });

  premium?.addEventListener('change', () => {
    serviceShopsState.filters.premium = premium.value || 'all';
    serviceShopsState.pagination.page = 1;
    loadServiceShopsList();
  });

  booking?.addEventListener('change', () => {
    serviceShopsState.filters.booking = booking.value || 'all';
    serviceShopsState.pagination.page = 1;
    loadServiceShopsList();
  });

  refresh?.addEventListener('click', () => {
    ensureServiceShopsLoaded(true);
  });

  reset?.addEventListener('click', () => {
    serviceShopsState.filters = { search: '', status: 'all', city: '', featured: 'all', premium: 'all', booking: 'all' };
    serviceShopsState.pagination.page = 1;
    if (search) search.value = '';
    if (status) status.value = 'all';
    if (city) city.value = '';
    if (featured) featured.value = 'all';
    if (premium) premium.value = 'all';
    if (booking) booking.value = 'all';
    highlightServiceSummary();
    loadServiceShopsList();
  });

  if (serviceShopsSummaryCards.length) {
    serviceShopsSummaryCards.forEach((card) => {
      const statusKey = card.dataset.statusFilter;
      if (typeof statusKey === 'undefined') return;
      card.addEventListener('click', () => {
        serviceShopsState.filters.status = statusKey || 'all';
        serviceShopsState.pagination.page = 1;
        if (serviceShopsInputs.status) {
          serviceShopsInputs.status.value = statusKey || 'all';
        }
        highlightServiceSummary();
        loadServiceShopsList();
      });
    });
  }

  serviceShopsPanelEl.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-service-action]');
    if (!button) return;
    const action = button.dataset.serviceAction;
    if (action === 'copy-phone') {
      const phone = button.dataset.phone || '';
      if (!phone) return;
      const copied = await copyToClipboard(phone);
      alert(copied ? 'شماره تماس در کلیپ‌بورد کپی شد.' : 'کپی شماره تماس امکان‌پذیر نبود.');
    } else if (action === 'open') {
      const shopUrl = button.dataset.shopUrl;
      if (shopUrl) {
        window.open(`/service-shops.html?shopurl=${encodeURIComponent(shopUrl)}`, '_blank');
      } else {
        alert('شناسه فروشگاه یافت نشد.');
      }
    } else if (action === 'block' || action === 'unblock') {
      const shopId = button.dataset.shopId;
      if (!shopId) {
        alert('شناسه مغازه یافت نشد.');
        return;
      }
      const sellerId = button.dataset.sellerId || '';
      if (action === 'block') {
        if (!confirm('آیا مطمئن هستید که می‌خواهید این فروشنده را مسدود کنید؟')) return;
      } else {
        if (!confirm('آیا مطمئن هستید که می‌خواهید دسترسی فروشنده را فعال کنید؟')) return;
      }

      let reason;
      if (action === 'block') {
        const input = window.prompt('دلیل مسدودسازی فروشنده (اختیاری):', '');
        if (input === null) return;
        reason = input.trim();
      }

      const originalText = button.textContent;
      button.disabled = true;
      button.dataset.loading = 'true';
      button.textContent = 'در حال پردازش...';

      try {
        const payload = {};
        if (sellerId) payload.sellerId = sellerId;
        if (typeof reason === 'string') payload.reason = reason;
        const endpoint = action === 'block' ? 'block' : 'unblock';
        const res = await fetch(`${ADMIN_API_BASE}/service-shops/${encodeURIComponent(shopId)}/${endpoint}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        let data = null;
        try {
          data = await res.json();
        } catch (parseErr) {
          data = null;
        }
        if (!res.ok) {
          throw new Error(data?.message || 'عملیات ناموفق بود.');
        }
        alert(data?.message || 'عملیات با موفقیت انجام شد.');
        await ensureServiceShopsLoaded(true);
      } catch (err) {
        console.error('serviceShops block/unblock error:', err);
        alert(err.message || 'خطا در انجام عملیات.');
      } finally {
        button.disabled = false;
        button.textContent = originalText;
        delete button.dataset.loading;
      }
    }
  });
}

setupServiceShopsPanel();


// -------- نمایش کاربران --------
// -------- نمایش کاربران --------
function renderUsers(filteredUsers = usersList) {
  const tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = '';
  filteredUsers.forEach((user, i) => {
    const fullName = `${user.firstname || user.name || ''} ${user.lastname || ''}`.trim();
    const contact = user.email || user.phone || '';
    let tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="user-cell user-modal-trigger" style="cursor:pointer;color:#10b981;font-weight:bold">${fullName}</td>
      <td class="user-cell user-modal-trigger" style="cursor:pointer">${contact}</td>
      <td>
        <button class="action-btn delete" onclick="deleteUser(${i})"><i class="ri-delete-bin-line"></i> حذف</button>
        ${user.blockedByAdmin
          ? `<button class="action-btn unblock" onclick="unblockUser('${user._id || user.id}', ${i})">آزاد کردن</button>`
          : `<button class="action-btn block" onclick="blockUser('${user._id || user.id}', ${i})">مسدودسازی</button>`}
      </td>
    `;
    // اتصال ایندکس کاربر به هر سلول قابل کلیک
    Array.from(tr.querySelectorAll('.user-modal-trigger')).forEach(td=>{
      td.onclick = () => showUserModal(user);
    });
    tbody.appendChild(tr);
  });
  if (!filteredUsers.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="color:#888;text-align:center">هیچ کاربری یافت نشد.</td></tr>`;
  }
}

// پاپ‌آپ اطلاعات کاربر
function showUserModal(user) {
  const overlay = document.getElementById('user-modal-overlay');
  const uid = toIdString(user._id || user.id || '');
  const fullName = `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.name || '-';
  const fDate = d => d ? new Date(d).toLocaleDateString('fa-IR',{year:'numeric',month:'long',day:'numeric'}) : '—';

  const modalHtml = `
    <div class="user-modal">
      <button class="user-modal-close" onclick="closeUserModal()">×</button>
      <div class="user-modal-title">
        مشخصات کاربر:
        <span style="color:#0ea5e9">${fullName}</span>
      </div>
      <div class="user-modal-row">
        <span class="user-modal-label">نام:</span>
        <span class="user-modal-value">${user.firstname || '-'}</span>
      </div>
      <div class="user-modal-row">
        <span class="user-modal-label">نام خانوادگی:</span>
        <span class="user-modal-value">${user.lastname || '-'}</span>
      </div>
      <div class="user-modal-row">
        <span class="user-modal-label">ایمیل:</span>
        <span class="user-modal-value">${user.email || '-'}</span>
      </div>
      <div class="user-modal-row">
        <span class="user-modal-label">تلفن:</span>
        <span class="user-modal-value">${user.phone || '-'}</span>
      </div>
      <div class="user-modal-row">
        <span class="user-modal-label">ثبت‌نام:</span>
        <span class="user-modal-value">${fDate(user.createdAt)}</span>
      </div>
      <form id="userMessageForm" class="user-modal-form" data-user-id="${uid}">
        <label for="userMessage">ارسال پیام به این کاربر:</label>
        <textarea id="userMessage" name="msg" placeholder="پیام خود را بنویسید…" required></textarea>
        <button type="submit">ارسال پیام</button>
        <div id="user-modal-success" class="user-modal-success" style="display:none"></div>
      </form>
    </div>`;

  overlay.innerHTML = modalHtml;
  overlay.style.display = 'flex';

  document.getElementById('userMessageForm').addEventListener('submit', sendUserMessage);
}

function closeUserModal() {
  document.getElementById('user-modal-overlay').style.display = "none";
  document.getElementById('user-modal-overlay').innerHTML = "";
}

async function sendUserMessage(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const uid = form.dataset.userId;
  const text = form.querySelector('textarea').value.trim();

  if (!text) return alert('متن پیام نمی‌تواند خالی باشد.');
  if (!uid) return alert('شناسه کاربر پیدا نشد!');

  try {
    // ابتدا اطمینان حاصل کن که چت بین ادمین و کاربر وجود دارد
    const ensureRes = await fetch(`${ADMIN_API_BASE}/chats/ensure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ recipientId: uid, recipientRole: 'user' })
    });
    const chat = await ensureRes.json();
    if (!ensureRes.ok) throw new Error(chat.error || 'خطا در ایجاد گفتگو');

    // سپس پیام را به عنوان ادمین در آن چت ارسال کن
    const res = await fetch(`${ADMIN_API_BASE}/chats/${chat._id}/admin-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در ارسال پیام');

    form.querySelector('textarea').value = '';
    const okBox = document.getElementById('user-modal-success');
    okBox.textContent = '✅ پیام با موفقیت ارسال شد!';
    okBox.style.display = 'block';
    setTimeout(() => okBox.style.display = 'none', 2500);
  } catch (err) {
    console.error('sendUserMessage error:', err);
    alert('❌ خطا در ارسال پیام:\n' + err.message);
  }
}
// جستجو کاربران
document.getElementById('userSearch').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = usersList.filter(u => {
    return (
      (u.firstname || '').toLowerCase().includes(q) ||
      (u.lastname || '').toLowerCase().includes(q) ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    );
  });
  renderUsers(filtered);
});


// جستجو محصولات
document.getElementById('productSearch').addEventListener('input', e => {
  productSearchQuery = e.target.value.trim().toLowerCase();
  renderProducts();
});

// فیلتر مرتب‌سازی محصولات
document.querySelectorAll('.products-filters button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.products-filters button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    productsSortMode = btn.getAttribute('data-sort');
    renderProducts();
  });
});

// -------- نمایش فروشگاه‌ها --------







window.deleteSeller = async function(id) {
  const idx = shopsList.findIndex(s =>
    toIdString(s.sellerId) === id ||
    toIdString(s.seller_id) === id ||
    toIdString(s._id) === id ||
    toIdString(s._sid) === id ||
    toIdString(s.shopurl) === id
  );
  const shop = shopsList[idx];
  if (!shop) return alert('فروشگاه پیدا نشد!');
  const name = shop.storename || shop.shopLogoText || 'بدون‌نام';

  if (!confirm(`آیا از حذف «${name}» مطمئن هستید؟`)) return;

  const sid = shop.sellerId || shop.seller_id || shop._id || shop._sid || null;
  if (!sid) return alert('شناسه فروشنده نامعتبر است.');

  console.log('Deleting seller:', sid, name);

  try {
    const res = await fetch(`${ADMIN_API_BASE}/sellers/${encodeURIComponent(sid)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'خطا در حذف فروشنده');

    shopsList.splice(idx, 1);
    renderSellers();
    updateSidebarCounts();
    updateHeaderCounts();
    alert('✅ فروشنده با موفقیت حذف شد.');
  } catch (err) {
    console.error('deleteSeller error:', err);
    alert('❌ ' + err.message);
  }
};




/* ---------- helper : پیدا کردن فروشگاه یک محصول ---------- */
function findShopForProduct(prod) {
  if (!prod) return null;

  /* 1) بر اساس shopurl */
  if (prod.shopurl) {
    return shopsList.find(s => String(s.shopurl) === String(prod.shopurl));
  }

  /* 2) بر اساس شناسهٔ فروشنده */
  const sid = toIdString(prod.sellerId || prod.seller_id);
  if (sid) {
    return shopsList.find(s =>
      toIdString(s.sellerId || s.seller_id || s._sid) === sid
    );
  }
  return null;
}


// -------- نمایش محصولات --------
/* ---------- renderProducts (نسخهٔ جدید) ---------- */
/* -------- renderProducts (NO product‑count column) -------- */
// -------- نمایش محصولات --------
function renderProducts() {
  const tbody = document.querySelector('#productsTable tbody');
  tbody.innerHTML = '';

  // ۱) کپی لیست و اعمال فیلتر جستجو
  let list = [...productsList];
  if (productSearchQuery) {
    list = list.filter(prod => {
      let shop = prod.seller || findShopForProduct(prod);
      return (
        (prod.title || prod.name || '').toLowerCase().includes(productSearchQuery) ||
        (shop?.storename || shop?.shopLogoText || '').toLowerCase().includes(productSearchQuery) ||
        (shop?.ownerName || `${shop?.ownerFirstname || ''} ${shop?.ownerLastname || ''}`.trim().toLowerCase()).includes(productSearchQuery)
      );
    });
  }

  // ۲) اعمال مرتب‌سازی (فرض: فیلد createdAt در هر محصول وجود دارد)
  list.forEach(prod => {
    prod._createdAt = prod.createdAt ? new Date(prod.createdAt).getTime() : 0;
  });
  if (productsSortMode === 'newest') {
    list.sort((a, b) => b._createdAt - a._createdAt);
  } else if (productsSortMode === 'oldest') {
    list.sort((a, b) => a._createdAt - b._createdAt);
  }

  // ۳) اگر لیست خالی بود
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#888;padding:1.5rem">هیچ محصولی یافت نشد.</td></tr>`;
    return;
  }

  // ۴) رندر لیست فیلترشده/مرتب‌شده
  list.forEach((prod, i) => {
    let shop = prod.seller || findShopForProduct(prod);
    const productName = prod.title || prod.name || '-';
    const storeName = shop ? (shop.storename || shop.shopLogoText || '-') : '-';
    const ownerName = shop ? (shop.ownerName || `${shop.ownerFirstname || ''} ${shop.ownerLastname || ''}`.trim() || '-') : '-';
    const storeAddr = shop ? (shop.address || shop.shopAddress || '-') : '-';
    const shopUrl = (shop ? shop.shopurl : (prod.shopurl || prod.shopUrl || '')) || '';
    const linkHTML = shopUrl ? `<a href="/shop.html?shopurl=${encodeURIComponent(shopUrl)}" target="_blank" style="color:#0ea5e9;text-decoration:underline">${shopUrl}</a>` : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${productName}</td>
      <td>${storeName}</td>
      <td>${ownerName}</td>
      <td>${storeAddr}</td>
      <td>${linkHTML}</td>
      <td>
        <button class="action-btn edit" onclick="editProduct(${i})"><i class="ri-pencil-line"></i> ویرایش</button>
        <button class="action-btn delete" onclick="deleteProduct(${i})"><i class="ri-delete-bin-line"></i> حذف</button>
      </td>`;
    tbody.appendChild(tr);
  });
}



// -------- حذف محصول --------
window.deleteProduct = async function (idx) {
  const prod = productsList[idx];
  if (!prod) return alert('محصول پیدا نشد!');
  
  if (!confirm(`آیا مطمئن هستید که می‌خواهید محصول "${prod.title || prod.name || 'نامشخص'}" را حذف کنید؟`)) return;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/products/${prod._id || prod.id}`, {
      method: 'DELETE',
      credentials: 'include'  // برای ارسال کوکی‌های احراز هویت (مثل admin_token)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'خطا در حذف محصول');
    }

    // حذف از لیست محلی و رندر مجدد
    productsList.splice(idx, 1);
    renderProducts();
    updateSidebarCounts();
    updateHeaderCounts();
    alert('✅ محصول با موفقیت حذف شد.');

  } catch (err) {
    console.error('❌ deleteProduct error:', err);
    alert('❌ ' + err.message);
  }
};




window.deleteUser = async function (idx) {
  const user = usersList[idx];
  if (!user)        return alert('کاربر پیدا نشد!');
  const name = `${user.firstname || ''} ${user.lastname || ''}`.trim()
               || user.name || user.phone || 'بدون‌نام';

  if (!confirm(`آیا از حذف «${name}» مطمئن هستید؟
پس از حذف، این شماره دیگر قادر به ورود یا ثبت‌نام نخواهد بود.`)) return;

  try {
    const res  = await fetch(`${ADMIN_API_BASE}/user/${user._id || user.id}`, {
      method      : 'DELETE',
      credentials : 'include'
    });
    const data  = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'خطا در حذف کاربر');

    /* پاک‌کردن از آرایهٔ محلی و رندر مجدد رابط */
    usersList.splice(idx, 1);
    renderUsers();
    updateSidebarCounts();
    updateHeaderCounts();

    alert('✅ کاربر با موفقیت حذف و مسدود شد.');
  } catch (err) {
    console.error('deleteUser error:', err);
    alert('❌ ' + err.message);
  }
};

window.blockUser = async function(id, idx) {
  if (!id) return alert('شناسه معتبر یافت نشد');
  if (!confirm('آیا مطمئن هستید که می‌خواهید این مشتری را مسدود کنید؟')) return;
  try {
    console.log('blockUser ->', { targetId: id, targetRole: 'user' });
    const res = await fetch(`${ADMIN_API_BASE}/chats/block-target`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: id, targetRole: 'user' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در مسدودسازی');
    usersList[idx].blockedByAdmin = true;
    renderUsers();
    alert('✅ کاربر با موفقیت مسدود شد.');
  } catch (err) {
    console.error('blockUser error:', err);
    alert('❌ ' + err.message);
  }
};

window.unblockUser = async function(id, idx) {
  if (!id) return alert('شناسه معتبر یافت نشد');
  if (!confirm('آیا مطمئن هستید که می‌خواهید این مشتری را آزاد کنید؟')) return;
  try {
    console.log('unblockUser ->', { targetId: id, targetRole: 'user' });
    const res = await fetch(`${ADMIN_API_BASE}/chats/unblock-target`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: id, targetRole: 'user' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در رفع مسدودی');
    usersList[idx].blockedByAdmin = false;
    renderUsers();
    alert('✅ کاربر آزاد شد.');
  } catch (err) {
    console.error('unblockUser error:', err);
    alert('❌ ' + err.message);
  }
};








/* -------- مدیریت پلن‌های خدماتی -------- */
const servicePlanForm = document.getElementById('servicePlanForm');
const servicePlanMessageEl = document.getElementById('servicePlanMessage');
const servicePlansListEl = document.getElementById('servicePlansList');
const servicePlanResetBtn = document.getElementById('servicePlanReset');
const servicePlanRefreshBtn = document.getElementById('servicePlanRefresh');
const servicePlanFormModeEl = document.getElementById('servicePlanFormMode');
const servicePlanTitleInput = document.getElementById('servicePlanTitle');
const servicePlanSlugInput = document.getElementById('servicePlanSlug');
const servicePlanPriceInput = document.getElementById('servicePlanPrice');
const servicePlanDurationInput = document.getElementById('servicePlanDuration');
const servicePlanDescriptionInput = document.getElementById('servicePlanDescription');
const servicePlanFeaturesInput = document.getElementById('servicePlanFeatures');
const servicePlanCouponForm = document.getElementById('servicePlanCouponForm');
const servicePlanCouponMessageEl = document.getElementById('servicePlanCouponMessage');
const servicePlanCouponsListEl = document.getElementById('servicePlanCouponsList');
const servicePlanCouponRefreshBtn = document.getElementById('servicePlanCouponRefresh');
const servicePlanCouponCodeInput = document.getElementById('servicePlanCouponCode');
const servicePlanCouponPercentInput = document.getElementById('servicePlanCouponPercent');
const servicePlanCouponUsageInput = document.getElementById('servicePlanCouponUsage');
const servicePlanCouponExpiresValueInput = document.getElementById('servicePlanCouponExpiresIn');
const servicePlanCouponExpiresUnitSelect = document.getElementById('servicePlanCouponExpiresUnit');
const servicePlanCouponNotesInput = document.getElementById('servicePlanCouponNotes');
const servicePlanCouponSubmitBtn = document.getElementById('servicePlanCouponSubmit');

function normaliseServicePlanSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function normaliseServicePlanDiscountCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-_]/g, '');
}

function setServicePlanMessage(message, type = 'info') {
  if (!servicePlanMessageEl) return;
  servicePlanMessageEl.classList.remove('success', 'error', 'info', 'show');
  if (!message) {
    servicePlanMessageEl.hidden = true;
    servicePlanMessageEl.textContent = '';
    return;
  }
  servicePlanMessageEl.hidden = false;
  servicePlanMessageEl.textContent = message;
  servicePlanMessageEl.classList.add('show', type);
}

function setServicePlanCouponMessage(message, type = 'info') {
  if (!servicePlanCouponMessageEl) return;
  servicePlanCouponMessageEl.classList.remove('success', 'error', 'info', 'show');
  if (!message) {
    servicePlanCouponMessageEl.hidden = true;
    servicePlanCouponMessageEl.textContent = '';
    return;
  }
  servicePlanCouponMessageEl.hidden = false;
  servicePlanCouponMessageEl.textContent = message;
  servicePlanCouponMessageEl.classList.add('show', type);
}

function resetServicePlanForm(showInfo = false) {
  if (!servicePlanForm) return;
  servicePlanForm.reset();
  servicePlanEditingId = null;
  if (servicePlanFormModeEl) {
    servicePlanFormModeEl.textContent = 'ثبت پلن جدید';
  }
  if (servicePlanDurationInput) {
    servicePlanDurationInput.value = '';
  }
  if (servicePlanFeaturesInput) {
    servicePlanFeaturesInput.value = '';
  }
  if (showInfo) {
    setServicePlanMessage('برای ثبت پلن جدید، فیلدها را تکمیل کنید.', 'info');
  } else {
    setServicePlanMessage('');
  }
}

function resetServicePlanCouponForm(showInfo = false) {
  if (!servicePlanCouponForm) return;
  servicePlanCouponForm.reset();
  if (servicePlanCouponExpiresUnitSelect) {
    servicePlanCouponExpiresUnitSelect.value = 'days';
  }
  if (showInfo) {
    setServicePlanCouponMessage('برای ثبت کد تخفیف جدید، فیلدها را تکمیل کنید.', 'info');
  } else {
    setServicePlanCouponMessage('');
  }
}

function collectServicePlanFormData() {
  const title = (servicePlanTitleInput?.value || '').trim();
  let slug = normaliseServicePlanSlug(servicePlanSlugInput?.value || '');
  const priceRaw = (servicePlanPriceInput?.value || '').trim();
  const durationRaw = (servicePlanDurationInput?.value || '').trim();
  const description = (servicePlanDescriptionInput?.value || '').trim();
  const features = (servicePlanFeaturesInput?.value || '')
    .split(/\r?\n/)
    .map((feature) => feature.trim())
    .filter(Boolean);

  if (!slug && title) {
    slug = normaliseServicePlanSlug(title);
    if (servicePlanSlugInput) {
      servicePlanSlugInput.value = slug;
    }
  }

  return {
    title,
    slug,
    price: priceRaw === '' ? null : Number(priceRaw),
    durationDays: durationRaw === '' ? null : Number(durationRaw),
    description,
    features
  };
}

function collectServicePlanCouponFormData() {
  const code = normaliseServicePlanDiscountCode(servicePlanCouponCodeInput?.value || '');
  const percentRaw = (servicePlanCouponPercentInput?.value || '').trim();
  const usageRaw = (servicePlanCouponUsageInput?.value || '').trim();
  const expiresValueRaw = (servicePlanCouponExpiresValueInput?.value || '').trim();
  const expiresUnit = (servicePlanCouponExpiresUnitSelect?.value || 'days').toLowerCase();
  const notes = (servicePlanCouponNotesInput?.value || '').trim();

  const payload = {
    code,
    discountPercent: percentRaw === '' ? null : Number(percentRaw),
    expiresInUnit: expiresUnit,
    notes
  };

  if (usageRaw) {
    payload.maxUsages = Number(usageRaw);
  }
  if (expiresValueRaw) {
    payload.expiresInValue = Number(expiresValueRaw);
  }

  return payload;
}

function populateServicePlanForm(plan) {
  if (!plan) return;
  servicePlanEditingId = plan.id || plan._id || null;
  if (servicePlanTitleInput) servicePlanTitleInput.value = plan.title || '';
  if (servicePlanSlugInput) servicePlanSlugInput.value = plan.slug || '';
  if (servicePlanPriceInput) servicePlanPriceInput.value = plan.price != null ? Number(plan.price) : '';
  if (servicePlanDurationInput) servicePlanDurationInput.value = plan.durationDays != null ? Number(plan.durationDays) : '';
  if (servicePlanDescriptionInput) servicePlanDescriptionInput.value = plan.description || '';
  if (servicePlanFeaturesInput) {
    const features = Array.isArray(plan.features)
      ? plan.features.map((feature) => (typeof feature === 'string' ? feature : feature?.value)).filter(Boolean)
      : [];
    servicePlanFeaturesInput.value = features.join('\n');
  }
  if (servicePlanFormModeEl) {
    const label = plan.title || plan.slug || 'پلن انتخابی';
    servicePlanFormModeEl.textContent = `ویرایش پلن: ${label}`;
  }
  setServicePlanMessage('در حال ویرایش پلن. پس از اعمال تغییرات روی «ذخیره پلن» کلیک کنید.', 'info');
  const panel = document.getElementById('service-plan-management-panel');
  if (panel && typeof panel.scrollIntoView === 'function') {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (servicePlanTitleInput && typeof servicePlanTitleInput.focus === 'function') {
    servicePlanTitleInput.focus();
  }
}

async function handleServicePlanSubmit(event) {
  event.preventDefault();
  if (servicePlansLoading) return;

  const formData = collectServicePlanFormData();

  if (!formData.title) {
    setServicePlanMessage('عنوان پلن الزامی است.', 'error');
    servicePlanTitleInput?.focus();
    return;
  }
  if (!formData.slug) {
    setServicePlanMessage('برای پلن یک اسلاگ یکتا وارد کنید.', 'error');
    servicePlanSlugInput?.focus();
    return;
  }
  if (formData.price == null || Number.isNaN(formData.price) || formData.price < 0) {
    setServicePlanMessage('قیمت معتبر وارد کنید.', 'error');
    servicePlanPriceInput?.focus();
    return;
  }
  if (formData.durationDays != null && (Number.isNaN(formData.durationDays) || formData.durationDays < 0)) {
    setServicePlanMessage('مدت اعتبار نمی‌تواند منفی باشد.', 'error');
    servicePlanDurationInput?.focus();
    return;
  }

  const payload = {
    title: formData.title,
    slug: formData.slug,
    description: formData.description,
    price: formData.price,
    features: formData.features
  };

  if (formData.durationDays != null && !Number.isNaN(formData.durationDays)) {
    payload.durationDays = formData.durationDays;
  }

  const token = getCookie('admin_token') || getCookie('access_token');

  try {
    servicePlansLoading = true;
    setServicePlanMessage(servicePlanEditingId ? 'در حال بروزرسانی پلن...' : 'در حال ثبت پلن جدید...', 'info');

    const url = servicePlanEditingId
      ? `${ADMIN_API_BASE}/service-plans/${encodeURIComponent(servicePlanEditingId)}`
      : `${ADMIN_API_BASE}/service-plans`;
    const method = servicePlanEditingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || 'خطا در ذخیره پلن');
    }

    const successMessage = servicePlanEditingId
      ? `پلن «${formData.title}» با موفقیت بروزرسانی شد.`
      : `پلن جدید «${formData.title}» با موفقیت ایجاد شد.`;
    await loadServicePlans(true);
    resetServicePlanForm(false);
    setServicePlanMessage(successMessage, 'success');
  } catch (err) {
    console.error('❌ handleServicePlanSubmit error:', err);
    setServicePlanMessage(err.message || 'خطا در ذخیره پلن', 'error');
  } finally {
    servicePlansLoading = false;
  }
}

async function handleServicePlanCouponSubmit(event) {
  event.preventDefault();
  if (servicePlanCouponSaving) return;

  const formData = collectServicePlanCouponFormData();

  if (!formData.code) {
    setServicePlanCouponMessage('کد تخفیف را وارد کنید.', 'error');
    servicePlanCouponCodeInput?.focus();
    return;
  }

  if (formData.discountPercent == null || Number.isNaN(formData.discountPercent)) {
    setServicePlanCouponMessage('درصد تخفیف را وارد کنید.', 'error');
    servicePlanCouponPercentInput?.focus();
    return;
  }

  if (formData.discountPercent <= 0 || formData.discountPercent > 100) {
    setServicePlanCouponMessage('درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.', 'error');
    servicePlanCouponPercentInput?.focus();
    return;
  }

  if (formData.maxUsages != null && (Number.isNaN(formData.maxUsages) || formData.maxUsages <= 0)) {
    setServicePlanCouponMessage('تعداد استفاده باید بزرگتر از صفر باشد.', 'error');
    servicePlanCouponUsageInput?.focus();
    return;
  }

  if (formData.expiresInValue != null && (Number.isNaN(formData.expiresInValue) || formData.expiresInValue <= 0)) {
    setServicePlanCouponMessage('مقدار انقضا باید بزرگتر از صفر باشد.', 'error');
    servicePlanCouponExpiresValueInput?.focus();
    return;
  }

  const payload = {
    code: formData.code,
    discountPercent: formData.discountPercent
  };

  if (formData.maxUsages != null && !Number.isNaN(formData.maxUsages)) {
    payload.maxUsages = formData.maxUsages;
  }
  if (formData.expiresInValue != null && !Number.isNaN(formData.expiresInValue)) {
    payload.expiresInValue = formData.expiresInValue;
    payload.expiresInUnit = formData.expiresInUnit;
  }
  if (formData.notes) {
    payload.notes = formData.notes;
  }

  const token = getCookie('admin_token') || getCookie('access_token');

  try {
    servicePlanCouponSaving = true;
    setServicePlanCouponMessage('در حال ثبت کد تخفیف...', 'info');
    if (servicePlanCouponSubmitBtn) {
      servicePlanCouponSubmitBtn.disabled = true;
      servicePlanCouponSubmitBtn.setAttribute('aria-busy', 'true');
    }

    const res = await fetch(`${ADMIN_API_BASE}/service-plans/discount-codes`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || 'خطا در ثبت کد تخفیف');
    }

    const discountCode = data?.discountCode;
    if (discountCode) {
      const id = toIdString(discountCode.id || discountCode._id);
      const existingIndex = servicePlanCoupons.findIndex((item) => toIdString(item?.id || item?._id) === id);
      if (existingIndex >= 0) {
        servicePlanCoupons[existingIndex] = discountCode;
      } else {
        servicePlanCoupons.unshift(discountCode);
      }
      servicePlanCouponsLoaded = true;
      renderServicePlanCoupons();
    } else {
      servicePlanCouponsLoaded = false;
      await loadServicePlanCoupons(true);
    }

    resetServicePlanCouponForm(false);
    setServicePlanCouponMessage(`کد تخفیف «${formData.code}» ثبت شد.`, 'success');
  } catch (err) {
    console.error('❌ handleServicePlanCouponSubmit error:', err);
    setServicePlanCouponMessage(err.message || 'خطا در ثبت کد تخفیف', 'error');
  } finally {
    servicePlanCouponSaving = false;
    if (servicePlanCouponSubmitBtn) {
      servicePlanCouponSubmitBtn.disabled = false;
      servicePlanCouponSubmitBtn.removeAttribute('aria-busy');
    }
  }
}

function renderServicePlans() {
  if (!servicePlansListEl) return;
  if (!Array.isArray(servicePlansList) || servicePlansList.length === 0) {
    servicePlansListEl.innerHTML = `
      <div class="service-plan-empty">
        <i class="ri-inbox-archive-line"></i>
        <p>هنوز هیچ پلن خدماتی ثبت نشده است.</p>
      </div>`;
    return;
  }

  servicePlansListEl.innerHTML = servicePlansList.map((plan) => {
    const planId = toIdString(plan?.id || plan?._id || '');
    const title = plan?.title || 'بدون عنوان';
    const slug = plan?.slug || '';
    const priceText = formatCurrency(plan?.price);
    const durationText = plan?.durationDays != null
      ? `${formatNumber(plan.durationDays)} روز`
      : 'بدون محدودیت زمانی';
    const createdAt = formatDateTime(plan?.createdAt);
    const updatedAt = formatDateTime(plan?.updatedAt);
    const features = Array.isArray(plan?.features)
      ? plan.features.map((feature) => (typeof feature === 'string' ? feature : feature?.value)).filter(Boolean)
      : [];

    const metaParts = [
      `<span><i class="ri-copper-coin-line"></i>${escapeHtml(priceText)}</span>`,
      `<span><i class="ri-timer-line"></i>${escapeHtml(durationText)}</span>`
    ];
    if (features.length) {
      metaParts.push(`<span><i class="ri-list-check"></i>${escapeHtml(`${formatNumber(features.length)} ویژگی`)}</span>`);
    }

    const featuresList = features.length
      ? `<ul class="service-plan-card__features">${features.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '';

    const descriptionHtml = plan?.description
      ? `<p class="service-plan-card__description">${escapeHtml(plan.description)}</p>`
      : '';

    return `
      <article class="service-plan-card" data-plan-id="${escapeHtml(planId)}">
        <div class="service-plan-card__head">
          <div class="service-plan-card__title">
            <h4>${escapeHtml(title)}</h4>
            <span class="service-plan-card__slug"><i class="ri-at-line"></i>${escapeHtml(slug)}</span>
          </div>
          <span class="service-plan-card__badge ${plan?.isActive ? '' : 'inactive'}">
            <i class="${plan?.isActive ? 'ri-checkbox-circle-line' : 'ri-forbid-2-line'}"></i>
            ${plan?.isActive ? 'فعال' : 'غیرفعال'}
          </span>
        </div>
        ${descriptionHtml}
        <div class="service-plan-card__meta">${metaParts.join('')}</div>
        ${featuresList}
        <div class="service-plan-card__timestamps">
          <span><i class="ri-calendar-line"></i> ایجاد: ${escapeHtml(createdAt)}</span>
          <span><i class="ri-refresh-line"></i> بروزرسانی: ${escapeHtml(updatedAt)}</span>
        </div>
        <div class="service-plan-card__footer">
          <button type="button" data-action="edit" data-plan-id="${escapeHtml(planId)}"><i class="ri-pencil-line"></i> ویرایش</button>
          <button type="button" data-action="delete" data-plan-id="${escapeHtml(planId)}"><i class="ri-delete-bin-line"></i> حذف</button>
        </div>
      </article>`;
  }).join('');
}

function renderServicePlanCoupons() {
  if (!servicePlanCouponsListEl) return;
  if (!Array.isArray(servicePlanCoupons) || servicePlanCoupons.length === 0) {
    servicePlanCouponsListEl.innerHTML = `
      <div class="service-plan-coupon-empty">
        <i class="ri-ticket-line"></i>
        <p>هنوز هیچ کد تخفیفی ثبت نشده است.</p>
      </div>`;
    return;
  }

  const now = Date.now();

  servicePlanCouponsListEl.innerHTML = servicePlanCoupons.map((coupon) => {
    const id = toIdString(coupon?.id || coupon?._id || '');
    const code = coupon?.code || '';
    const percent = Number(coupon?.discountPercent || 0);
    const maxUsages = coupon?.maxUsages != null ? Number(coupon.maxUsages) : null;
    const usedCount = Number(coupon?.usedCount || 0);
    const remainingUsesRaw = coupon?.remainingUses != null ? Number(coupon.remainingUses) : null;
    const remainingUses = maxUsages == null
      ? null
      : Math.max(remainingUsesRaw != null ? remainingUsesRaw : maxUsages - usedCount, 0);
    const expiresAt = coupon?.expiresAt ? new Date(coupon.expiresAt) : null;
    const expiresAtTime = expiresAt ? expiresAt.getTime() : null;
    const expired = expiresAtTime != null && expiresAtTime <= now;
    const createdAt = formatDateTime(coupon?.createdAt);
    const updatedAt = formatDateTime(coupon?.updatedAt);
    const notes = coupon?.notes || '';

    const badges = [];
    badges.push(`<span class="service-plan-coupon-badge">تخفیف ${escapeHtml(formatNumber(percent))}٪</span>`);

    if (maxUsages == null) {
      badges.push('<span class="service-plan-coupon-badge">بدون محدودیت مصرف</span>');
    } else {
      const remainingLabel = `مانده ${formatNumber(remainingUses)} از ${formatNumber(maxUsages)}`;
      badges.push(`<span class="service-plan-coupon-badge${remainingUses <= 0 ? ' warning' : ''}">${escapeHtml(remainingLabel)}</span>`);
    }

    if (usedCount > 0) {
      badges.push(`<span class="service-plan-coupon-badge">استفاده شده: ${escapeHtml(formatNumber(usedCount))}</span>`);
    }

    if (coupon?.isActive === false) {
      badges.push('<span class="service-plan-coupon-badge warning">غیرفعال</span>');
    }

    if (expiresAt) {
      const expiresText = formatDateTime(expiresAt) || '—';
      const label = expired ? `منقضی شده (${expiresText})` : `انقضا: ${expiresText}`;
      badges.push(`<span class="service-plan-coupon-badge${expired ? ' warning' : ''}">${escapeHtml(label)}</span>`);
    }

    const metaParts = [];
    if (createdAt) {
      metaParts.push(`<div><i class="ri-calendar-check-line"></i>ایجاد: ${escapeHtml(createdAt)}</div>`);
    }
    if (updatedAt && updatedAt !== createdAt) {
      metaParts.push(`<div><i class="ri-refresh-line"></i>آخرین بروزرسانی: ${escapeHtml(updatedAt)}</div>`);
    }
    if (notes) {
      metaParts.push(`<div class="service-plan-coupon-note"><i class="ri-chat-1-line"></i>${escapeHtml(notes).replace(/\n/g, '<br>')}</div>`);
    }

    const metaHtml = metaParts.length ? metaParts.join('') : '<div>—</div>';

    const toggleLabel = coupon?.isActive === false ? 'فعال‌سازی' : 'غیرفعال‌سازی';

    return `
      <div class="service-plan-coupon-item${coupon?.isActive === false ? ' inactive' : ''}" data-coupon-id="${escapeHtml(id)}">
        <div>
          <div class="service-plan-coupon-code">${escapeHtml(code)}</div>
          <div class="service-plan-coupon-badges">${badges.join('')}</div>
        </div>
        <div class="service-plan-coupon-meta">${metaHtml}</div>
        <div class="service-plan-coupon-actions-inline">
          <button type="button" data-action="toggle" data-coupon-id="${escapeHtml(id)}">${toggleLabel}</button>
          <button type="button" class="danger" data-action="delete" data-coupon-id="${escapeHtml(id)}">حذف</button>
        </div>
      </div>`;
  }).join('');
}

async function loadServicePlanCoupons(force = false) {
  if (!servicePlanCouponsListEl) return;
  if (servicePlanCouponsLoading && !force) return;
  if (servicePlanCouponsLoaded && !force) {
    renderServicePlanCoupons();
    return;
  }

  servicePlanCouponsLoading = true;
  servicePlanCouponsListEl.innerHTML = `
    <div class="service-plan-coupon-empty">
      <i class="ri-loader-4-line" style="animation:spin 0.9s linear infinite;"></i>
      <p>در حال دریافت کدهای تخفیف...</p>
    </div>`;

  const token = getCookie('admin_token') || getCookie('access_token');

  try {
    const res = await fetch(`${ADMIN_API_BASE}/service-plans/discount-codes`, {
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'خطا در دریافت کدهای تخفیف');
    }

    const data = await res.json().catch(() => ({}));
    const list = Array.isArray(data?.discountCodes) ? data.discountCodes : [];
    servicePlanCoupons = list;
    servicePlanCouponsLoaded = true;
    renderServicePlanCoupons();
  } catch (err) {
    console.error('❌ loadServicePlanCoupons error:', err);
    servicePlanCouponsLoaded = false;
    servicePlanCouponsListEl.innerHTML = `
      <div class="service-plan-coupon-empty">
        <i class="ri-error-warning-line"></i>
        <p>${escapeHtml(err.message || 'خطا در دریافت کدهای تخفیف')}</p>
      </div>`;
    setServicePlanCouponMessage(err.message || 'خطا در دریافت کدهای تخفیف', 'error');
  } finally {
    servicePlanCouponsLoading = false;
  }
}

async function toggleServicePlanCoupon(couponId, triggerButton = null) {
  if (!couponId) return;
  const coupon = servicePlanCoupons.find((item) => toIdString(item?.id || item?._id) === toIdString(couponId));
  if (!coupon) {
    setServicePlanCouponMessage('کد تخفیف انتخابی یافت نشد.', 'error');
    return;
  }

  const nextState = coupon.isActive === false;
  const token = getCookie('admin_token') || getCookie('access_token');

  try {
    setServicePlanCouponMessage(`در حال ${nextState ? 'فعال‌سازی' : 'غیرفعال‌سازی'} کد «${coupon.code}»...`, 'info');
    if (triggerButton) {
      triggerButton.disabled = true;
      triggerButton.setAttribute('aria-busy', 'true');
    }

    const res = await fetch(`${ADMIN_API_BASE}/service-plans/discount-codes/${encodeURIComponent(couponId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ isActive: nextState })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || 'خطا در بروزرسانی کد تخفیف');
    }

    const updated = data?.discountCode;
    if (updated) {
      const id = toIdString(updated.id || updated._id);
      const index = servicePlanCoupons.findIndex((item) => toIdString(item?.id || item?._id) === id);
      if (index >= 0) {
        servicePlanCoupons[index] = updated;
      }
    } else {
      await loadServicePlanCoupons(true);
    }

    setServicePlanCouponMessage(`کد «${coupon.code}» ${nextState ? 'فعال شد' : 'غیرفعال شد'}.`, 'success');
    renderServicePlanCoupons();
  } catch (err) {
    console.error('❌ toggleServicePlanCoupon error:', err);
    setServicePlanCouponMessage(err.message || 'خطا در بروزرسانی کد تخفیف', 'error');
  } finally {
    if (triggerButton) {
      triggerButton.disabled = false;
      triggerButton.removeAttribute('aria-busy');
    }
  }
}

async function deleteServicePlanCoupon(couponId, triggerButton = null) {
  if (!couponId) return;
  const coupon = servicePlanCoupons.find((item) => toIdString(item?.id || item?._id) === toIdString(couponId));
  const code = coupon?.code || 'کد انتخابی';
  if (!confirm(`آیا از حذف کد «${code}» مطمئن هستید؟`)) return;

  const token = getCookie('admin_token') || getCookie('access_token');

  try {
    setServicePlanCouponMessage(`در حال حذف کد «${code}»...`, 'info');
    if (triggerButton) {
      triggerButton.disabled = true;
      triggerButton.setAttribute('aria-busy', 'true');
    }

    const res = await fetch(`${ADMIN_API_BASE}/service-plans/discount-codes/${encodeURIComponent(couponId)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    if (!res.ok) {
      let data = null;
      try {
        data = await res.json();
      } catch (err) {
        data = null;
      }
      throw new Error(data?.message || 'خطا در حذف کد تخفیف');
    }

    servicePlanCoupons = servicePlanCoupons.filter((item) => toIdString(item?.id || item?._id) !== toIdString(couponId));
    if (!servicePlanCoupons.length) {
      servicePlanCouponsLoaded = false;
    }
    renderServicePlanCoupons();
    setServicePlanCouponMessage(`کد «${code}» حذف شد.`, 'success');
  } catch (err) {
    console.error('❌ deleteServicePlanCoupon error:', err);
    setServicePlanCouponMessage(err.message || 'خطا در حذف کد تخفیف', 'error');
  } finally {
    if (triggerButton) {
      triggerButton.disabled = false;
      triggerButton.removeAttribute('aria-busy');
    }
  }
}

function handleServicePlanCouponsListClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const action = button.dataset.action;
  const couponId = button.dataset.couponId;
  if (!couponId) return;

  if (action === 'toggle') {
    toggleServicePlanCoupon(couponId, button);
    return;
  }

  if (action === 'delete') {
    deleteServicePlanCoupon(couponId, button);
  }
}

async function loadServicePlans(force = false) {
  if (!servicePlansListEl) return;
  if (servicePlansLoading && !force) return;
  if (servicePlansLoaded && !force) {
    renderServicePlans();
    return;
  }

  servicePlansLoading = true;
  servicePlansListEl.innerHTML = `
    <div class="service-plan-empty">
      <i class="ri-loader-4-line" style="animation:spin 0.9s linear infinite;"></i>
      <p>در حال دریافت لیست پلن‌ها...</p>
    </div>`;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/service-plans`, { credentials: 'include' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'خطا در دریافت پلن‌ها');
    }
    const data = await res.json();
    const plans = Array.isArray(data?.plans) ? data.plans : [];
    servicePlansList = plans;
    servicePlansLoaded = true;
    renderServicePlans();
    updateSidebarCounts();
    updateHeaderCounts();
  } catch (err) {
    console.error('❌ loadServicePlans error:', err);
    servicePlansListEl.innerHTML = `
      <div class="service-plan-error-state">
        <i class="ri-error-warning-line"></i>
        <p>${escapeHtml(err.message || 'خطا در دریافت پلن‌ها')}</p>
        <button type="button" data-action="retry" class="service-plan-retry">تلاش دوباره</button>
      </div>`;
    setServicePlanMessage(err.message || 'خطا در دریافت پلن‌ها', 'error');
  } finally {
    servicePlansLoading = false;
  }
}

async function deleteServicePlan(planId) {
  if (!planId) return;
  const plan = servicePlansList.find((item) => toIdString(item?.id || item?._id) === toIdString(planId));
  const title = plan?.title || plan?.slug || 'پلن انتخابی';
  if (!confirm(`آیا از حذف پلن «${title}» مطمئن هستید؟`)) return;

  const token = getCookie('admin_token') || getCookie('access_token');

  try {
    servicePlansLoading = true;
    setServicePlanMessage(`در حال حذف پلن «${title}»...`, 'info');
    const res = await fetch(`${ADMIN_API_BASE}/service-plans/${encodeURIComponent(planId)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) {
      let data = null;
      try {
        data = await res.json();
      } catch (error) {
        data = null;
      }
      throw new Error(data?.message || 'خطا در حذف پلن');
    }
    if (servicePlanEditingId && toIdString(servicePlanEditingId) === toIdString(planId)) {
      resetServicePlanForm(false);
    }
    setServicePlanMessage(`پلن «${title}» حذف شد.`, 'success');
    await loadServicePlans(true);
  } catch (err) {
    console.error('❌ deleteServicePlan error:', err);
    setServicePlanMessage(err.message || 'خطا در حذف پلن', 'error');
  } finally {
    servicePlansLoading = false;
  }
}

function handleServicePlanListClick(event) {
  const targetButton = event.target.closest('button');
  if (!targetButton) return;
  const action = targetButton.dataset.action;
  if (action === 'retry') {
    loadServicePlans(true);
    return;
  }
  const planId = targetButton.dataset.planId;
  if (!planId) return;
  const plan = servicePlansList.find((item) => toIdString(item?.id || item?._id) === toIdString(planId));
  if (action === 'edit') {
    if (plan) {
      populateServicePlanForm(plan);
    } else {
      setServicePlanMessage('پلن انتخابی یافت نشد.', 'error');
    }
    return;
  }
  if (action === 'delete') {
    deleteServicePlan(planId);
  }
}

function initServicePlanManager() {
  if (servicePlanManagerInitialised) return;
  if (!servicePlanForm) return;

  servicePlanForm.addEventListener('submit', handleServicePlanSubmit);
  servicePlanResetBtn?.addEventListener('click', () => resetServicePlanForm(true));
  servicePlanRefreshBtn?.addEventListener('click', () => {
    if (!servicePlansLoading) {
      loadServicePlans(true);
    }
  });
  servicePlansListEl?.addEventListener('click', handleServicePlanListClick);
  if (servicePlanSlugInput) {
    servicePlanSlugInput.addEventListener('blur', () => {
      servicePlanSlugInput.value = normaliseServicePlanSlug(servicePlanSlugInput.value);
    });
  }
  if (servicePlanTitleInput && servicePlanSlugInput) {
    servicePlanTitleInput.addEventListener('blur', () => {
      if (!(servicePlanSlugInput.value || '').trim()) {
        servicePlanSlugInput.value = normaliseServicePlanSlug(servicePlanTitleInput.value);
      }
    });
  }

  servicePlanCouponForm?.addEventListener('submit', handleServicePlanCouponSubmit);
  servicePlanCouponRefreshBtn?.addEventListener('click', () => {
    if (!servicePlanCouponsLoading) {
      loadServicePlanCoupons(true);
    }
  });
  servicePlanCouponsListEl?.addEventListener('click', handleServicePlanCouponsListClick);

  resetServicePlanForm(true);
  resetServicePlanCouponForm(true);
  servicePlanManagerInitialised = true;
  loadServicePlanCoupons();
}

async function ensureServicePlanManager(forceReload = false) {
  if (!servicePlanForm) return;
  if (!servicePlanManagerInitialised) {
    initServicePlanManager();
  }
  if (forceReload) {
    await Promise.all([
      loadServicePlans(true),
      loadServicePlanCoupons(true)
    ]);
    return;
  }

  if (!servicePlansLoaded) {
    await loadServicePlans();
  }
  if (!servicePlanCouponsLoaded) {
    await loadServicePlanCoupons();
  }
}

const REWARD_API_BASE = `${ADMIN_API_BASE}/rewards`;
const rewardSidebarCountEl = document.getElementById('count-rewards');
const rewardPanelEl = document.getElementById('rewards-panel');
const rewardAdminPrizeEl = document.getElementById('rewardAdminPrizeValue');
const rewardAdminCapacityEl = document.getElementById('rewardAdminCapacityValue');
const rewardAdminWinnersEl = document.getElementById('rewardAdminWinnersValue');
const rewardAdminProgressBarEl = document.getElementById('rewardAdminProgressBar');
const rewardAdminProgressLabelEl = document.getElementById('rewardAdminProgressLabel');
const rewardAdminStatusChipEl = document.getElementById('rewardCampaignStatusChip');
const rewardAdminUpdatedAtEl = document.getElementById('rewardAdminUpdatedAt');
const rewardAdminCodesCountEl = document.getElementById('rewardAdminCodesCount');
const rewardCodesAvailableBadgeEl = document.getElementById('rewardCodesAvailableBadge');
const rewardCodesUsedBadgeEl = document.getElementById('rewardCodesUsedBadge');
const rewardCampaignForm = document.getElementById('rewardCampaignForm');
const rewardFormMessageEl = document.getElementById('rewardFormMessage');
const rewardTitleInput = document.getElementById('rewardTitleInput');
const rewardDescriptionInput = document.getElementById('rewardDescriptionInput');
const rewardPrizeInput = document.getElementById('rewardPrizeInput');
const rewardCurrencyInput = document.getElementById('rewardCurrencyInput');
const rewardCapacityInput = document.getElementById('rewardCapacityInput');
const rewardWinnersInput = document.getElementById('rewardWinnersInput');
const rewardActiveInput = document.getElementById('rewardActiveInput');
const rewardResetBtn = document.getElementById('rewardResetBtn');
const rewardCodeForm = document.getElementById('rewardCodeForm');
const rewardNewCodeInput = document.getElementById('rewardNewCodeInput');
const rewardNewCodeNoteInput = document.getElementById('rewardNewCodeNote');
const rewardCodesListEl = document.getElementById('rewardCodesList');
const rewardCodesMessageEl = document.getElementById('rewardCodesMessage');
const rewardCodesEmptyStateEl = document.getElementById('rewardCodesEmptyState');
const rewardWinnersForm = document.getElementById('rewardWinnerForm');
const rewardWinnerFirstNameInput = document.getElementById('rewardWinnerFirstName');
const rewardWinnerLastNameInput = document.getElementById('rewardWinnerLastName');
const rewardWinnerPhoneInput = document.getElementById('rewardWinnerPhone');
const rewardWinnersMessageEl = document.getElementById('rewardWinnersMessage');
const rewardWinnersListEl = document.getElementById('rewardWinnersList');
const rewardWinnersEmptyStateEl = document.getElementById('rewardWinnersEmptyState');

const DEFAULT_REWARD_CAMPAIGN = {
  title: '',
  description: '',
  prizeValue: 0,
  currency: 'تومان',
  capacity: 0,
  winnersClaimed: 0,
  active: false,
  codes: [],
  winners: [],
  updatedAt: null
};

let rewardCampaignState = null;
let rewardCampaignFetchPromise = null;
let rewardPanelInitialised = false;
let rewardWinnersState = [];
let rewardWinnersFetchPromise = null;

function normaliseRewardCampaign(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const codes = Array.isArray(source.codes)
    ? source.codes
        .map(item => {
          if (!item) return null;
          const codeStr = String(item.code || '')
            .replace(/[^0-9]/g, '')
            .slice(0, 6);
          if (!codeStr || codeStr.length !== 6) return null;
          return {
            code: codeStr,
            used: Boolean(item.used),
            note: item.note ? String(item.note) : undefined,
            createdAt: item.createdAt || null,
            usedAt: item.usedAt || null
          };
        })
        .filter(Boolean)
    : [];
  const winners = Array.isArray(source.winners)
    ? source.winners.map(normaliseAdminWinner).filter(Boolean)
    : [];

  const prizeValue = Number.isFinite(Number(source.prizeValue)) ? Number(source.prizeValue) : DEFAULT_REWARD_CAMPAIGN.prizeValue;
  const capacity = Math.max(0, Number.isFinite(Number(source.capacity)) ? Number(source.capacity) : DEFAULT_REWARD_CAMPAIGN.capacity);
  let winnersClaimed = Math.max(0, Number.isFinite(Number(source.winnersClaimed)) ? Number(source.winnersClaimed) : DEFAULT_REWARD_CAMPAIGN.winnersClaimed);
  const usedCount = codes.filter(item => item.used).length;
  if (winnersClaimed < usedCount) {
    winnersClaimed = usedCount;
  }
  if (capacity > 0 && winnersClaimed > capacity) {
    winnersClaimed = capacity;
  }

  return {
    title: source.title ? String(source.title) : DEFAULT_REWARD_CAMPAIGN.title,
    description: source.description ? String(source.description) : DEFAULT_REWARD_CAMPAIGN.description,
    prizeValue,
    currency: source.currency ? String(source.currency) : DEFAULT_REWARD_CAMPAIGN.currency,
    capacity,
    winnersClaimed,
    active: source.active !== undefined ? Boolean(source.active) : DEFAULT_REWARD_CAMPAIGN.active,
    codes,
    winners,
    updatedAt: source.updatedAt || DEFAULT_REWARD_CAMPAIGN.updatedAt
  };
}

function syncRewardCampaignTotals(campaign) {
  if (!campaign) return;
  const usedCount = Array.isArray(campaign.codes) ? campaign.codes.filter(item => item.used).length : 0;
  const winnersCount = Array.isArray(campaign.winners) ? campaign.winners.length : 0;
  if (campaign.winnersClaimed < usedCount) {
    campaign.winnersClaimed = usedCount;
  }
  if (campaign.winnersClaimed < winnersCount) {
    campaign.winnersClaimed = winnersCount;
  }
  if (campaign.capacity > 0 && campaign.winnersClaimed > campaign.capacity) {
    campaign.winnersClaimed = campaign.capacity;
  }
}

function formatRewardPrize(amount, currency) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const formatted = currencyFormatter ? currencyFormatter.format(Math.round(Number(amount))) : formatNumber(amount);
  return currency ? `${formatted} ${currency}` : formatted;
}

function computeRewardStats(campaign) {
  const codes = Array.isArray(campaign?.codes) ? campaign.codes : [];
  const totalCodes = codes.length;
  const usedCodes = codes.filter(code => code.used).length;
  const availableCodes = Math.max(0, totalCodes - usedCodes);
  const completion = campaign?.capacity > 0
    ? Math.min(100, Math.round((Math.min(campaign.winnersClaimed, campaign.capacity) / campaign.capacity) * 100))
    : 0;
  return { totalCodes, usedCodes, availableCodes, completion };
}

function setRewardFormMessage(message, type = 'info') {
  if (!rewardFormMessageEl) return;
  rewardFormMessageEl.textContent = message || '';
  rewardFormMessageEl.classList.remove('is-success', 'is-error');
  if (type === 'success') {
    rewardFormMessageEl.classList.add('is-success');
  } else if (type === 'error') {
    rewardFormMessageEl.classList.add('is-error');
  }
}

function setRewardCodesMessage(message, type = 'info') {
  if (!rewardCodesMessageEl) return;
  rewardCodesMessageEl.textContent = message || '';
  rewardCodesMessageEl.classList.remove('is-success', 'is-error');
  if (type === 'success') {
    rewardCodesMessageEl.classList.add('is-success');
  } else if (type === 'error') {
    rewardCodesMessageEl.classList.add('is-error');
  }
}

function setRewardWinnersMessage(message, type = 'info') {
  if (!rewardWinnersMessageEl) return;
  rewardWinnersMessageEl.textContent = message || '';
  rewardWinnersMessageEl.classList.remove('is-success', 'is-error');
  if (type === 'success') {
    rewardWinnersMessageEl.classList.add('is-success');
  } else if (type === 'error') {
    rewardWinnersMessageEl.classList.add('is-error');
  }
}

function maskPhoneDisplay(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  const first = digits.slice(0, Math.min(4, digits.length));
  const last = digits.length > 4 ? digits.slice(-4) : '';
  const revealed = first.length + last.length;
  const maskLength = Math.max(4, Math.max(0, digits.length - revealed));
  return `${first}${'•'.repeat(maskLength)}${last}`;
}

function normaliseAdminWinner(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ? String(raw.id) : raw._id ? String(raw._id) : '';
  if (!id) return null;
  const firstName = raw.firstName ? String(raw.firstName).trim() : '';
  const lastName = raw.lastName ? String(raw.lastName).trim() : '';
  const phone = raw.phone ? String(raw.phone).trim() : '';
  const phoneMasked = raw.phoneMasked ? String(raw.phoneMasked).trim() : maskPhoneDisplay(phone);
  const createdAt = raw.createdAt || null;
  return { id, firstName, lastName, phone, phoneMasked, createdAt };
}

function sortRewardWinners(list = []) {
  return [...list].sort((a, b) => {
    const timeA = new Date(a?.createdAt || 0).getTime();
    const timeB = new Date(b?.createdAt || 0).getTime();
    return timeB - timeA;
  });
}

function renderRewardWinnersList() {
  if (!rewardWinnersListEl || !rewardWinnersEmptyStateEl) return;
  rewardWinnersListEl.innerHTML = '';
  const list = Array.isArray(rewardWinnersState) ? sortRewardWinners(rewardWinnersState) : [];
  if (!list.length) {
    rewardWinnersEmptyStateEl.hidden = false;
    return;
  }
  rewardWinnersEmptyStateEl.hidden = true;

  list.forEach((winner) => {
    const card = document.createElement('div');
    card.className = 'reward-winner-card';
    card.dataset.id = winner.id;

    const info = document.createElement('div');
    info.className = 'reward-winner-card__info';
    const name = document.createElement('div');
    name.className = 'reward-winner-card__name';
    name.textContent = `${winner.firstName || ''} ${winner.lastName || ''}`.trim() || 'برنده';
    info.appendChild(name);

    if (winner.phone) {
      const phoneEl = document.createElement('div');
      phoneEl.className = 'reward-winner-card__meta';
      phoneEl.textContent = `شماره تماس: ${winner.phone}`;
      info.appendChild(phoneEl);
    }

    if (winner.createdAt) {
      const createdEl = document.createElement('div');
      createdEl.className = 'reward-winner-card__meta';
      createdEl.textContent = `تاریخ ثبت: ${formatDateTime(winner.createdAt) || '—'}`;
      info.appendChild(createdEl);
    }

    const actions = document.createElement('div');
    actions.className = 'reward-winner-card__actions';
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.textContent = 'حذف';
    actions.appendChild(deleteBtn);

    card.appendChild(info);
    card.appendChild(actions);
    rewardWinnersListEl.appendChild(card);
  });
}

async function fetchRewardWinners(force = false) {
  if (!force && Array.isArray(rewardWinnersState) && rewardWinnersState.length) {
    return rewardWinnersState;
  }
  if (rewardWinnersFetchPromise && !force) {
    return rewardWinnersFetchPromise;
  }
  rewardWinnersFetchPromise = fetch(`${REWARD_API_BASE}/winners`, {
    credentials: 'include'
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((payload) => {
      const winners = Array.isArray(payload?.winners)
        ? payload.winners.map(normaliseAdminWinner).filter(Boolean)
        : [];
      rewardWinnersState = winners;
      return winners;
    })
    .catch((error) => {
      rewardWinnersState = [];
      throw error;
    })
    .finally(() => {
      rewardWinnersFetchPromise = null;
    });

  return rewardWinnersFetchPromise;
}

async function createRewardWinner(data) {
  const response = await fetch(`${REWARD_API_BASE}/winners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'خطا در ثبت برنده جدید.');
  }
  rewardCampaignState = normaliseRewardCampaign(payload?.campaign);
  rewardWinnersState = Array.isArray(payload?.winners)
    ? payload.winners.map(normaliseAdminWinner).filter(Boolean)
    : [];
  return payload;
}

async function removeRewardWinner(id) {
  const response = await fetch(`${REWARD_API_BASE}/winners/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'خطا در حذف برنده.');
  }
  rewardCampaignState = normaliseRewardCampaign(payload?.campaign);
  rewardWinnersState = Array.isArray(payload?.winners)
    ? payload.winners.map(normaliseAdminWinner).filter(Boolean)
    : [];
  return payload;
}

async function handleRewardWinnerFormSubmit(event) {
  event.preventDefault();
  const firstName = rewardWinnerFirstNameInput?.value?.trim() || '';
  const lastName = rewardWinnerLastNameInput?.value?.trim() || '';
  const phone = rewardWinnerPhoneInput?.value?.trim() || '';
  if (!firstName || !lastName || !phone) {
    setRewardWinnersMessage('لطفاً نام، نام خانوادگی و شماره تلفن را تکمیل کنید.', 'error');
    return;
  }

  setRewardWinnersMessage('در حال ثبت برنده جدید...', 'info');
  try {
    await createRewardWinner({ firstName, lastName, phone });
    renderRewardSummary();
    renderRewardWinnersList();
    populateRewardFormFields();
    setRewardWinnersMessage('برنده جدید با موفقیت ثبت شد.', 'success');
    if (rewardWinnerFirstNameInput) rewardWinnerFirstNameInput.value = '';
    if (rewardWinnerLastNameInput) rewardWinnerLastNameInput.value = '';
    if (rewardWinnerPhoneInput) rewardWinnerPhoneInput.value = '';
    rewardWinnerFirstNameInput?.focus();
  } catch (error) {
    console.error('createRewardWinner failed', error);
    setRewardWinnersMessage(error.message || 'خطا در ثبت برنده جدید.', 'error');
  }
}

async function handleRewardWinnersListClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button || button.dataset.action !== 'delete') return;
  const card = button.closest('[data-id]');
  if (!card) return;
  const winnerId = card.dataset.id;
  const confirmed = window.confirm('آیا از حذف این برنده مطمئن هستید؟');
  if (!confirmed) return;

  setRewardWinnersMessage('در حال حذف برنده...', 'info');
  try {
    await removeRewardWinner(winnerId);
    renderRewardSummary();
    renderRewardWinnersList();
    populateRewardFormFields();
    setRewardWinnersMessage('برنده انتخابی حذف شد.', 'success');
  } catch (error) {
    console.error('removeRewardWinner failed', error);
    setRewardWinnersMessage(error.message || 'خطا در حذف برنده.', 'error');
  }
}

function renderRewardSummary() {
  if (!rewardCampaignState) return;
  const summary = rewardCampaignState;
  if (rewardAdminPrizeEl) {
    rewardAdminPrizeEl.textContent = summary.prizeValue > 0 ? formatRewardPrize(summary.prizeValue, summary.currency) : '—';
  }
  if (rewardAdminCapacityEl) {
    rewardAdminCapacityEl.textContent = summary.capacity > 0 ? formatNumber(summary.capacity) : 'ظرفیت اعلام نشده';
  }
  if (rewardAdminWinnersEl) {
    rewardAdminWinnersEl.textContent = formatNumber(Math.min(summary.winnersClaimed, summary.capacity || summary.winnersClaimed));
  }
  const stats = computeRewardStats(summary);
  if (rewardAdminProgressBarEl) {
    rewardAdminProgressBarEl.style.width = `${stats.completion}%`;
  }
  if (rewardAdminProgressLabelEl) {
    rewardAdminProgressLabelEl.textContent = `${stats.completion}% ظرفیت تکمیل شده`;
  }
  if (rewardAdminStatusChipEl) {
    rewardAdminStatusChipEl.textContent = summary.active ? 'فعال' : 'غیرفعال';
    rewardAdminStatusChipEl.classList.toggle('is-inactive', !summary.active);
  }
  if (rewardAdminUpdatedAtEl) {
    rewardAdminUpdatedAtEl.textContent = summary.updatedAt
      ? formatDateTime(summary.updatedAt)
      : 'به‌روزرسانی نشده';
  }
  if (rewardAdminCodesCountEl) {
    rewardAdminCodesCountEl.textContent = `${formatNumber(stats.totalCodes)} کد ذخیره شده`;
  }
  if (rewardCodesAvailableBadgeEl) {
    rewardCodesAvailableBadgeEl.textContent = `${formatNumber(stats.availableCodes)} کد فعال`;
  }
  if (rewardCodesUsedBadgeEl) {
    rewardCodesUsedBadgeEl.textContent = `${formatNumber(stats.usedCodes)} کد استفاده شده`;
  }
  if (rewardSidebarCountEl) {
    rewardSidebarCountEl.textContent = stats.availableCodes > 0 ? formatNumber(stats.availableCodes) : '';
  }
}

function populateRewardFormFields() {
  if (!rewardCampaignForm || !rewardCampaignState) return;
  if (rewardTitleInput) rewardTitleInput.value = rewardCampaignState.title || '';
  if (rewardDescriptionInput) rewardDescriptionInput.value = rewardCampaignState.description || '';
  if (rewardPrizeInput) rewardPrizeInput.value = rewardCampaignState.prizeValue != null ? rewardCampaignState.prizeValue : '';
  if (rewardCurrencyInput) rewardCurrencyInput.value = rewardCampaignState.currency || 'تومان';
  if (rewardCapacityInput) rewardCapacityInput.value = rewardCampaignState.capacity != null ? rewardCampaignState.capacity : '';
  if (rewardWinnersInput) rewardWinnersInput.value = rewardCampaignState.winnersClaimed != null ? rewardCampaignState.winnersClaimed : '';
  if (rewardActiveInput) rewardActiveInput.checked = Boolean(rewardCampaignState.active);
}

function renderRewardCodesList() {
  if (!rewardCodesListEl || !rewardCodesEmptyStateEl) return;
  rewardCodesListEl.innerHTML = '';
  const codes = Array.isArray(rewardCampaignState?.codes) ? rewardCampaignState.codes : [];
  if (!codes.length) {
    rewardCodesEmptyStateEl.hidden = false;
    return;
  }
  rewardCodesEmptyStateEl.hidden = true;
  codes.forEach(code => {
    const card = document.createElement('article');
    card.className = 'reward-code-card';
    card.dataset.code = code.code;

    const header = document.createElement('header');
    header.className = 'reward-code-card__header';

    const codeLabel = document.createElement('span');
    codeLabel.className = 'reward-code-card__code';
    codeLabel.textContent = code.code;

    const status = document.createElement('span');
    status.className = `reward-code-card__status ${code.used ? 'is-used' : 'is-active'}`;
    status.textContent = code.used ? 'استفاده شده' : 'فعال';

    header.appendChild(codeLabel);
    header.appendChild(status);

    const meta = document.createElement('div');
    meta.className = 'reward-code-card__meta';

    if (code.createdAt) {
      const created = document.createElement('span');
      created.textContent = `ایجاد: ${formatDateTime(code.createdAt)}`;
      meta.appendChild(created);
    }
    if (code.used && code.usedAt) {
      const used = document.createElement('span');
      used.textContent = `استفاده: ${formatDateTime(code.usedAt)}`;
      meta.appendChild(used);
    }
    if (code.note) {
      const noteEl = document.createElement('p');
      noteEl.className = 'reward-code-card__note';
      noteEl.textContent = code.note;
      meta.appendChild(noteEl);
    }

    const actions = document.createElement('div');
    actions.className = 'reward-code-card__actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.dataset.action = 'toggle';
    toggleBtn.className = 'reward-code-card__action';
    toggleBtn.textContent = code.used ? 'فعال‌سازی مجدد' : 'علامت به عنوان استفاده شده';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.className = 'reward-code-card__action reward-code-card__action--danger';
    deleteBtn.textContent = 'حذف';

    actions.appendChild(toggleBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(actions);

    rewardCodesListEl.appendChild(card);
  });
}

async function fetchRewardCampaign(force = false) {
  if (!force && rewardCampaignState) {
    return rewardCampaignState;
  }
  if (rewardCampaignFetchPromise && !force) {
    return rewardCampaignFetchPromise;
  }
  rewardCampaignFetchPromise = fetch(`${REWARD_API_BASE}/campaign`, {
    credentials: 'include'
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((payload) => {
      const campaign = normaliseRewardCampaign(payload?.campaign);
      rewardCampaignState = campaign;
      return campaign;
    })
    .catch((error) => {
      rewardCampaignState = null;
      throw error;
    })
    .finally(() => {
      rewardCampaignFetchPromise = null;
    });

  return rewardCampaignFetchPromise;
}

async function updateRewardCampaign(partial) {
  const response = await fetch(`${REWARD_API_BASE}/campaign`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(partial)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'خطا در ذخیره تنظیمات کمپین.');
  }
  rewardCampaignState = normaliseRewardCampaign(payload?.campaign);
  return payload;
}

async function addRewardCode(data) {
  const response = await fetch(`${REWARD_API_BASE}/codes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'خطا در ثبت کد جدید.');
  }
  rewardCampaignState = normaliseRewardCampaign(payload?.campaign);
  return payload;
}

async function toggleRewardCode(code) {
  const response = await fetch(`${REWARD_API_BASE}/codes/${code}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action: 'toggle' })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'خطا در به‌روزرسانی وضعیت کد.');
  }
  rewardCampaignState = normaliseRewardCampaign(payload?.campaign);
  return payload;
}

async function removeRewardCode(code) {
  const response = await fetch(`${REWARD_API_BASE}/codes/${code}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'خطا در حذف کد.');
  }
  rewardCampaignState = normaliseRewardCampaign(payload?.campaign);
  return payload;
}

async function handleRewardFormSubmit(event) {
  event.preventDefault();
  if (!rewardCampaignForm) return;
  setRewardFormMessage('در حال ذخیره تنظیمات...', 'info');
  const updates = {
    title: rewardTitleInput?.value?.trim() || '',
    description: rewardDescriptionInput?.value?.trim() || '',
    prizeValue: Number(rewardPrizeInput?.value || 0) || 0,
    currency: rewardCurrencyInput?.value?.trim() || 'تومان',
    capacity: Math.max(0, Number(rewardCapacityInput?.value || 0) || 0),
    winnersClaimed: Math.max(0, Number(rewardWinnersInput?.value || 0) || 0),
    active: Boolean(rewardActiveInput?.checked)
  };

  try {
    await updateRewardCampaign(updates);
    syncRewardCampaignTotals(rewardCampaignState);
    renderRewardSummary();
    populateRewardFormFields();
    renderRewardCodesList();
    setRewardFormMessage('تنظیمات کمپین با موفقیت ذخیره شد.', 'success');
  } catch (error) {
    console.error('handleRewardFormSubmit failed', error);
    setRewardFormMessage(error.message || 'خطا در ذخیره تنظیمات کمپین.', 'error');
  }
}

async function handleRewardReset() {
  if (!rewardCampaignForm) return;
  const confirmed = window.confirm('آیا از بازنشانی تنظیمات کمپین مطمئن هستید؟');
  if (!confirmed) return;
  setRewardFormMessage('در حال بازنشانی تنظیمات...', 'info');
  const defaults = {
    title: '',
    description: '',
    prizeValue: 0,
    currency: 'تومان',
    capacity: 0,
    winnersClaimed: 0,
    active: false
  };
  try {
    await updateRewardCampaign(defaults);
    renderRewardSummary();
    populateRewardFormFields();
    renderRewardCodesList();
    setRewardFormMessage('تنظیمات کمپین بازنشانی شد.', 'success');
  } catch (error) {
    console.error('handleRewardReset failed', error);
    setRewardFormMessage(error.message || 'خطا در بازنشانی تنظیمات.', 'error');
  }
}

async function handleRewardCodeFormSubmit(event) {
  event.preventDefault();
  const code = rewardNewCodeInput?.value?.replace(/[^0-9]/g, '').slice(0, 6) || '';
  if (rewardNewCodeInput) rewardNewCodeInput.value = code;
  if (code.length !== 6) {
    setRewardCodesMessage('لطفاً یک کد ۶ رقمی معتبر وارد کنید.', 'error');
    rewardNewCodeInput?.focus();
    return;
  }
  const note = rewardNewCodeNoteInput?.value?.trim();
  setRewardCodesMessage('در حال ثبت کد جدید...', 'info');
  try {
    const payload = await addRewardCode({ code, note });
    syncRewardCampaignTotals(rewardCampaignState);
    renderRewardSummary();
    renderRewardCodesList();
    populateRewardFormFields();
    setRewardCodesMessage(payload?.message || 'کد جدید با موفقیت افزوده شد.', 'success');
    if (rewardNewCodeInput) rewardNewCodeInput.value = '';
    if (rewardNewCodeNoteInput) rewardNewCodeNoteInput.value = '';
  } catch (error) {
    console.error('handleRewardCodeFormSubmit failed', error);
    setRewardCodesMessage(error.message || 'خطا در افزودن کد جدید.', 'error');
  }
}

async function handleRewardCodesListClick(event) {
  const actionBtn = event.target.closest('button[data-action]');
  if (!actionBtn || !rewardCampaignState) return;
  const card = actionBtn.closest('[data-code]');
  if (!card) return;
  const codeValue = card.dataset.code;
  const action = actionBtn.dataset.action;

  if (action === 'toggle') {
    setRewardCodesMessage('در حال به‌روزرسانی وضعیت کد...', 'info');
    try {
      const payload = await toggleRewardCode(codeValue);
      syncRewardCampaignTotals(rewardCampaignState);
      renderRewardSummary();
      renderRewardCodesList();
      populateRewardFormFields();
      setRewardCodesMessage(payload?.message || 'وضعیت کد به‌روزرسانی شد.', 'success');
    } catch (error) {
      console.error('toggleRewardCode failed', error);
      setRewardCodesMessage(error.message || 'خطا در به‌روزرسانی وضعیت کد.', 'error');
    }
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm('آیا از حذف این کد مطمئن هستید؟');
    if (!confirmed) return;
    setRewardCodesMessage('در حال حذف کد...', 'info');
    try {
      const payload = await removeRewardCode(codeValue);
      syncRewardCampaignTotals(rewardCampaignState);
      renderRewardSummary();
      renderRewardCodesList();
      populateRewardFormFields();
      setRewardCodesMessage(payload?.message || 'کد انتخابی حذف شد.', 'success');
    } catch (error) {
      console.error('removeRewardCode failed', error);
      setRewardCodesMessage(error.message || 'خطا در حذف کد.', 'error');
    }
  }
}

async function ensureRewardCampaignPanel(forceReload = false) {
  if (!rewardPanelEl) return;
  try {
    await fetchRewardCampaign(forceReload);
  } catch (error) {
    console.error('fetchRewardCampaign (admin) failed', error);
    setRewardFormMessage('خطا در دریافت اطلاعات کمپین.', 'error');
    setRewardCodesMessage('خطا در دریافت اطلاعات کمپین.', 'error');
    return;
  }

  try {
    await fetchRewardWinners(forceReload);
    renderRewardWinnersList();
    setRewardWinnersMessage('');
  } catch (error) {
    console.error('fetchRewardWinners failed', error);
    setRewardWinnersMessage(error.message || 'خطا در دریافت فهرست برندگان.', 'error');
  }

  if (!rewardPanelInitialised) {
    rewardPanelInitialised = true;
    rewardCampaignForm?.addEventListener('submit', (event) => {
      handleRewardFormSubmit(event).catch(err => console.error(err));
    });
    rewardResetBtn?.addEventListener('click', () => {
      handleRewardReset().catch(err => console.error(err));
    });
    rewardCodeForm?.addEventListener('submit', (event) => {
      handleRewardCodeFormSubmit(event).catch(err => console.error(err));
    });
    rewardCodesListEl?.addEventListener('click', (event) => {
      handleRewardCodesListClick(event).catch(err => console.error(err));
    });
    rewardNewCodeInput?.addEventListener('input', () => {
      const digitsOnly = rewardNewCodeInput.value.replace(/[^0-9]/g, '').slice(0, 6);
      if (rewardNewCodeInput.value !== digitsOnly) {
        rewardNewCodeInput.value = digitsOnly;
      }
    });
    rewardWinnersForm?.addEventListener('submit', (event) => {
      handleRewardWinnerFormSubmit(event).catch(err => console.error(err));
    });
    rewardWinnersListEl?.addEventListener('click', (event) => {
      handleRewardWinnersListClick(event).catch(err => console.error(err));
    });
    rewardWinnerPhoneInput?.addEventListener('input', () => {
      const digitsOnly = rewardWinnerPhoneInput.value.replace(/[^0-9+]/g, '');
      if (rewardWinnerPhoneInput.value !== digitsOnly) {
        rewardWinnerPhoneInput.value = digitsOnly;
      }
    });
  }

  populateRewardFormFields();
  renderRewardSummary();
  renderRewardCodesList();
  renderRewardWinnersList();
}

if (rewardPanelEl) {
  ensureRewardCampaignPanel().catch(err => console.error(err));
}

// -------- Nav & Responsive (FIXED) --------
// -------- Nav & Responsive (FIXED) --------
const sidebar       = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const menuLinks     = document.querySelectorAll('.sidebar-menu a');

const syncSidebarState = () => {
  if (!sidebar) return;
  document.body.classList.toggle('sidebar-open', sidebar.classList.contains('open'));
};

syncSidebarState();

// آبجکت پنل‌ها را قبلاً تعریف کرده‌اید:
const panels = {
  dashboard: document.getElementById('dashboard-panel'),
  rewards: document.getElementById('rewards-panel'),
  users:     document.getElementById('users-panel'),
  sellers:   document.getElementById('sellers-panel'),
  'service-shops': document.getElementById('service-shops-panel'),
  'service-plan-management': document.getElementById('service-plan-management-panel'),
  categories: document.getElementById('categories-panel'),
  products:  document.getElementById('products-panel'),
  'shopping-centers': document.getElementById('shopping-centers-panel'),
  plans:     document.getElementById('plans-panel'),
  ads:       document.getElementById('ads-panel'),
  'income-insights': document.getElementById('income-insights-panel'),
  'ad-orders': document.getElementById('ad-orders-panel'),
  'home-section': document.getElementById('home-section-panel'),
  messages:  document.getElementById('messages-panel'),
  'daily-visits': document.getElementById('daily-visits-panel')
};

menuLinks.forEach(link => {
  link.addEventListener('click', async e => {
    const section = link.dataset.section;

    if (!section) {
      return;
    }

    e.preventDefault();

    // 1) استایلِ active در منو
    menuLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    // 2) مخفی/نمایشِ پنل‌ها
    Object.values(panels).forEach(p => p.style.display = 'none');
    if (!panels[section]) return;
    panels[section].style.display = 'block';

    // 3) به‌روزرسانی شمارندهٔ هدر
    updateHeaderCounts();

    // 4) وقتی وارد بخش پیام‌ها شدیم، polling را استارت کن؛
    //    وقتی خارج شدیم، polling را متوقف کن.
    if (section === 'messages') {
      startMessagesPolling();
    } else {
      stopMessagesPolling();
    }

    if (section === 'shopping-centers') {
      await ensureShoppingCentersLoaded();
    }

    if (section === 'service-shops') {
      ensureServiceShopsIframeLoaded();
      await ensureServiceShopsLoaded();
    }

    if (section === 'service-plan-management') {
      await ensureServicePlanManager();
    }

    if (section === 'ad-orders') {
      await loadAdOrders();
    }

    if (section === 'categories') {
      initCategoryManager();
    }

    if (section === 'rewards') {
      ensureRewardCampaignPanel();
    }

    // لود محتوای AJAX برای آمار روزانه بازدید
    if (section === 'daily-visits') {
      loadDailyVisContent();
    }

    // لود محتوای کارت‌های صفحه اصلی
    if (section === 'home-section') {
      loadHomeSectionContent();
    }

    if (section === 'income-insights') {
      loadIncomeInsightsContent();
    }

    // 5) بستن سایدبار در موبایل
    if (window.innerWidth < 700 && sidebar) {
      sidebar.classList.remove('open');
      syncSidebarState();
    }
  });
});

if (sidebar && sidebarToggle) {
  // دکمهٔ برگر در موبایل
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    syncSidebarState();
  });

  document.body.addEventListener('click', e => {
    if (
      window.innerWidth < 700 &&
      sidebar.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      e.target !== sidebarToggle
    ) {
      sidebar.classList.remove('open');
      syncSidebarState();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 700 && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      syncSidebarState();
    } else if (window.innerWidth <= 700) {
      syncSidebarState();
    }
  });
}


// -------- نمودار داینامیک داشبورد --------
let chartObj;
let filterBtns = [
  {label: 'امروز', value: 'today'},
  {label: 'دیروز', value: 'yesterday'},
  {label: '۷ روز اخیر', value: 'week'},
  {label: '۳۰ روز اخیر', value: 'month'},
];

function showDashboardChart(type, title) {
  let wrap = document.getElementById('dashboard-dynamic-chart-wrap');
  wrap.innerHTML = `
    <div class="dynamic-chart-box-pro">
      <div class="dynamic-chart-top">
        <span id="chartBox-title">${title}</span>
        <button id="close-dash-chart" class="close-dash-chart-btn">×</button>
      </div>
      <div class="dynamic-chart-filters">
        ${filterBtns.map(b => `<button class="dash-filter-btn" data-v="${b.value}">${b.label}</button>`).join('')}
      </div>
      <div class="dynamic-chart-canvas-wrap">
        <canvas id="chartBox-canvas"></canvas>
        <div id="chartBox-empty" class="dynamic-chart-empty">
          داده‌ای برای این بازه زمانی ثبت نشده است.
        </div>
      </div>
    </div>
  `;

  document.getElementById('close-dash-chart').onclick = () => {
    wrap.innerHTML = "";
    if (chartObj) chartObj.destroy();
  };

  const arrs = {
    visits: visitsPerDay,
    users: usersPerDay,
    sellers: sellersPerDay,
    products: productsPerDay,
    serviceShops: serviceShopsPerDay
  };

  function getData(period) {
    const arr = arrs[type] || [];
    const labels = trendLabels;
    const count = arr.length;

    if (!count) {
      return { data: [], labels: [] };
    }

    if (period === 'today') {
      const idx = count - 1;
      return {
        data: [arr[idx]],
        labels: [labels[idx] || 'امروز']
      };
    }

    if (period === 'yesterday') {
      const idx = count - 2;
      if (idx < 0) return { data: [], labels: [] };
      return {
        data: [arr[idx]],
        labels: [labels[idx] || 'دیروز']
      };
    }

    if (period === 'week') {
      const sliceStart = Math.max(count - 7, 0);
      const dataSlice = arr.slice(sliceStart);
      const labelSlice = labels.slice(sliceStart, sliceStart + dataSlice.length);
      return { data: dataSlice, labels: labelSlice };
    }

    if (period === 'month') {
      const limit = window.innerWidth < 700 ? 10 : 30;
      const sliceStart = Math.max(count - limit, 0);
      const dataSlice = arr.slice(sliceStart);
      const labelSlice = labels.slice(sliceStart, sliceStart + dataSlice.length);
      return { data: dataSlice, labels: labelSlice };
    }

    return { data: arr, labels };
  }

  function getColor() {
    if (type === "visits") return "rgba(16,185,129,1)";
    if (type === "users") return "rgba(14,165,233,1)";
    if (type === "sellers") return "rgba(22,163,74,1)";
    if (type === "products") return "rgba(234,179,8,1)";
    return "#666";
  }
  function getGradient(ctx) {
    let grad = ctx.createLinearGradient(0,0,0,260);
    grad.addColorStop(0,"rgba(14,165,233,0.25)");
    grad.addColorStop(1,"rgba(16,185,129,0.04)");
    return grad;
  }
  function getType(period) {
    return (period === "today" || period === "yesterday") ? "bar" : "line";
  }
  const canvas = document.getElementById('chartBox-canvas');
  const emptyBox = document.getElementById('chartBox-empty');

  wrap.querySelectorAll(".dash-filter-btn").forEach(btn => {
    btn.onclick = () => {
      wrap.querySelectorAll(".dash-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      let period = btn.getAttribute("data-v");
      let { data, labels } = getData(period);
      if (chartObj) {
        chartObj.destroy();
        chartObj = null;
      }

      if (!data.length) {
        canvas.style.display = 'none';
        emptyBox.style.display = 'flex';
        return;
      }

      emptyBox.style.display = 'none';
      canvas.style.display = 'block';

      let parW = Math.max(canvas.parentElement.offsetWidth, 360);
      canvas.width = Math.min(900, parW - 0 + 1);
      canvas.height = window.innerWidth < 600 ? 240 : 340;

      let color = getColor();
      let typeC = getType(period);

      chartObj = new Chart(canvas.getContext('2d'), {
        type: typeC,
        data: {
          labels: labels,
          datasets: [{
            label: title,
            data: data,
            backgroundColor: (ctx) =>
              typeC === "bar"
                ? color + "B0"
                : getGradient(ctx.chart.ctx),
            borderColor: color,
            borderWidth: 4,
            fill: true,
            tension: 0.5,
            pointRadius: 8,
            pointBackgroundColor: color,
            pointBorderColor: "#fff",
            pointHoverRadius: 12,
            pointHoverBorderWidth: 2,
            barPercentage: 0.45,
            categoryPercentage: 0.7,
            borderCapStyle: 'round'
          }]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              rtl: true,
              padding: 15,
              backgroundColor: "#fff",
              borderColor: "#10b98122",
              borderWidth: 1.2,
              titleColor: "#16a34a",
              bodyColor: "#0ea5e9",
              bodyFont: { family: "Vazirmatn" },
              titleFont: { family: "Vazirmatn", weight: "bold", size:16 },
              displayColors: false,
              callbacks: {
                title: (ctx) => ctx[0].label,
                label: (ctx) => " " + ctx.dataset.label + ": " + ctx.formattedValue
              }
            }
          },
          layout: { padding: { left: 5, right: 5, top: 0, bottom: 5 } },
          scales: {
            y: {
              beginAtZero: true,
              border: { color: "#e5e7eb" },
              grid: { color: "#e5e7eb2b", drawTicks: false, borderDash: [3,5] },
              ticks: { color: '#999', font: { size: 15, weight:'bold' } }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#555', font: { size: 15, weight: 700 } }
            }
          }
        }
      });
    };
  });
  wrap.querySelector('.dash-filter-btn[data-v="week"]').click();
}

// کلیک روی کارت‌های آمار
document.getElementById('card-visits').onclick = ()=> showDashboardChart("visits", "آمار بازدید سایت");
document.getElementById('card-users').onclick = ()=> showDashboardChart("users", "آمار ثبت‌نام کاربران");
document.getElementById('card-sellers').onclick = ()=> showDashboardChart("sellers", "آمار فروشگاه‌ها");
document.getElementById('card-products').onclick = ()=> showDashboardChart("products", "آمار محصولات جدید");
const cardServiceShops = document.getElementById('card-service-shops');
if (cardServiceShops) {
  cardServiceShops.onclick = ()=> showDashboardChart("serviceShops", "آمار مغازه‌های خدماتی جدید");
}

const shoppingCenterFormEl = document.getElementById('shoppingCenterForm');
if (shoppingCenterFormEl) {
  shoppingCenterFormEl.addEventListener('submit', handleShoppingCenterSubmit);
}

const shoppingCentersRefreshBtn = document.getElementById('shoppingCentersRefresh');
if (shoppingCentersRefreshBtn) {
  shoppingCentersRefreshBtn.addEventListener('click', async () => {
    const original = shoppingCentersRefreshBtn.innerHTML;
    shoppingCentersRefreshBtn.disabled = true;
    shoppingCentersRefreshBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> در حال بروزرسانی';
    try {
      await ensureShoppingCentersLoaded(true);
      setShoppingCenterFormMessage('لیست مراکز خرید بروزرسانی شد.', 'info');
    } catch (err) {
      console.error('shoppingCentersRefresh error:', err);
      setShoppingCenterFormMessage('خطا در بروزرسانی مراکز خرید.', 'error', 6000);
    } finally {
      shoppingCentersRefreshBtn.disabled = false;
      shoppingCentersRefreshBtn.innerHTML = original;
    }
  });
}

// -------- لود اولیه دیتا و بروزرسانی --------
// نسخهٔ اصلاح‌شده‌ی updateAll — فقط همین تابع را جایگزین کن
async function updateAll() {
  try {
    // ۱) واکشی هم‌زمان داده‌ها و آمار داشبورد
    const [users, shops, products, centers, stats] = await Promise.all([
      fetchUsers(),
      fetchShops(),
      fetchProducts(),
      fetchShoppingCenters(),
      fetchDashboardStats()
    ]);

    // ۲) ست‌کردن آرایه‌های سراسری
    usersList    = users;
    shopsList    = shops;
    shoppingCentersList = centers;
    shoppingCentersLoaded = true;
    renderShoppingCenters();
    await refreshSellerPerformanceMap();
    console.group('🟢 shopsList snapshot');
shopsList.slice(0, 10).forEach((s, i) => {
  console.log(i,
    'sid:',   s._sid,
    '_id:',   toIdString(s._id),
    'sellerId:', toIdString(s.sellerId ?? s.seller_id),
    'shopurl:', toIdString(s.shopurl)
  );
});
console.groupEnd();

    productsList = products;
    updateSidebarCounts();
    updateHeaderCounts();
    await loadAdOrders();

    // ۳) به‌روزرسانی آمار داشبورد
    applyDashboardStats(stats, {
      usersFallback: usersList.length,
      sellersFallback: shopsList.length,
      productsFallback: productsList.length
    });

    // ۴) تعیین شناسهٔ یکتا برای هر فروشنده
   // ۳) تعیین شناسهٔ یکتا برای هر فروشنده (نسخه‌ی جدید)
/* ─── STEP 1 : ساخت شناسه یکتا برای هر فروشنده ───────── */
shopsList.forEach(s => {
  // محاسبه‌ی شناسه یکتا
  const uniqueId = toIdString(
    s.sellerId   || s.seller_id ||
    s._id        || s.id        ||
    (s.shopurl ? 'shopurl:' + s.shopurl : '')
  );
  s._sid     = uniqueId;
  s.sellerId = uniqueId;   // ← این خط را اضافه کن
});


/* 🆕  لاگ تحلیلی – فقط برای دیباگ. خواستی بعداً حذف کن. */
console.table(
  shopsList.map(({_sid, _id, sellerId, shopurl}) => ({ _sid, _id, sellerId, shopurl }))
);
/* ─────────────────────────────────────────────────────── */



    // ۵) پس از داشتن _sidها، مپ نام‌ها را بساز
    buildNameMaps();

    // ۶) واکشی پیام‌ها (برای شمارنده و نمایش)
    await fetchMessages();

    // حتماً جدول پیام‌ها را هم رندر کن
    renderMessages();

    // ۷) رندر رابط کاربری
    updateDashboardCards();
    updateSidebarCounts();
    updateHeaderCounts();
    renderUsers();
    renderSellers();
    renderProducts();

  } catch (err) {
    alert('خطا در دریافت داده‌های پنل ادمین!\n' + (err.message || err));
  }
}



/* اجرای اولیه */
updateAll();


let style = document.createElement('style');
style.innerHTML = `@keyframes fadeIn{from{opacity:0;transform:translateY(30px);}to{opacity:1;transform:none;}}`;
document.head.appendChild(style);







// --- فیلتر و مرتب‌سازی فروشگاه‌ها ---
let sellersSortMode = 'newest'; // حالت پیش‌فرض
document.querySelectorAll('.seller-filter-btn').forEach(btn => {
  btn.onclick = function() {
    document.querySelectorAll('.seller-filter-btn').forEach(b=>b.classList.remove('active'));
    this.classList.add('active');
    sellersSortMode = this.getAttribute('data-sort');
    renderSellers();
  }
});


let sellerSearchQuery = '';  // متغیر برای ذخیره کوئری جستجو

// جستجو فروشگاه‌ها
document.getElementById('sellerSearch').addEventListener('input', e => {
  sellerSearchQuery = e.target.value.trim().toLowerCase();
  renderSellers();
});

function renderSellers() {
  const tbody = document.querySelector('#sellersTable tbody');
  tbody.innerHTML = '';

  if (!shopsList.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:#888;text-align:center">هیچ فروشگاهی ثبت نشده است.</td></tr>`;
    return;
  }

  // فیلتر جستجو (نام فروشگاه، نام صاحب، آدرس)
  let sellers = shopsList.filter(shop => {
    const storeName = (shop.storename || shop.shopLogoText || '').toLowerCase();
    const ownerName = (shop.ownerName || `${shop.ownerFirstname || ''} ${shop.ownerLastname || ''}`.trim()).toLowerCase();
    const storeAddr = (shop.address || shop.shopAddress || '').toLowerCase();
    const phone = (shop.phone || shop.mobile || shop.ownerPhone || shop.ownerMobile || '').toLowerCase();
    return (
      storeName.includes(sellerSearchQuery) ||
      ownerName.includes(sellerSearchQuery) ||
      storeAddr.includes(sellerSearchQuery) ||
      phone.includes(sellerSearchQuery)
    );
  });

  sellers.forEach(shop => {
    shop._productsCount = shop.productsCount ?? shop.productCount ?? 0;
    shop._visits = shop.visits || shop.shopVisits || 0;
    shop._createdAt = shop.createdAt ? new Date(shop.createdAt).getTime() : 0;
    shop._subStart = shop.subscriptionStart ? new Date(shop.subscriptionStart) : null;
    shop._subEnd = shop.subscriptionEnd ? new Date(shop.subscriptionEnd) : null;
  });

  // مرتب‌سازی
  if (sellersSortMode === 'newest') {
    sellers.sort((a, b) => b._createdAt - a._createdAt);
  } else if (sellersSortMode === 'oldest') {
    sellers.sort((a, b) => a._createdAt - b._createdAt);
  } else if (sellersSortMode === 'mostvisited') {
    sellers.sort((a, b) => b._visits - a._visits);
  } else if (sellersSortMode === 'mostproducts') {
    sellers.sort((a, b) => b._productsCount - a._productsCount);
  }

  sellers.forEach((shop) => {
    const countProducts = shop._productsCount;
    const ownerName = shop.ownerName || `${shop.ownerFirstname || ''} ${shop.ownerLastname || ''}`.trim() || '-';
    const address = shop.address || shop.shopAddress || '-';
    const storeName = shop.storename || shop.shopLogoText || '-';
    const shopUrl = shop.shopurl || '';
    const shopLink = shopUrl
      ? `<a class="seller-link" href="/shop.html?shopurl=${encodeURIComponent(shopUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(shopUrl)}</a>`
      : '-';

    const sellerKey = resolveSellerKeyFromShop(shop);
    const performance = sellerKey ? getSellerPerformanceByKey(sellerKey) : null;
    const adminScore = performance && performance.adminScore != null ? performance.adminScore : null;
    const scoreBadge = adminScore != null
      ? `<span class="seller-score-badge has-score"><strong>${adminScore}</strong><span class="score-suffix">/100</span></span>`
      : '<span class="seller-score-badge no-score">ثبت نشده</span>';
    const statusSeverity = performance ? performance.severity || 'neutral' : 'neutral';
    const statusLabel = performance ? performance.statusLabel : 'در انتظار ارزیابی';
    const statusBadge = `<span class="seller-status-pill status-${statusSeverity}">${statusLabel}</span>`;
    const isBlocked = !!shop.blockedByAdmin;
    const blockedBadge = isBlocked
      ? '<span class="seller-blocked-badge"><i class="ri-shield-cross-line"></i>مسدود</span>'
      : '';
    const eligibilityClass = performance
      ? (performance.canStay ? 'status-eligible' : 'status-ineligible')
      : 'status-neutral';
    const eligibilityText = performance
      ? (performance.canStay ? '✅ مجاز به ادامه فعالیت' : '⛔ امکان ادامه فعالیت در ویترینت وجود ندارد')
      : 'در انتظار ارزیابی ادمین';
    const combinedStatus = `<div class="seller-score-cell-wrap">${blockedBadge}${scoreBadge}${statusBadge}<span class="seller-status-note ${eligibilityClass}">${eligibilityText}</span></div>`;

    const blockedAtText = shop.blockedAt ? formatDateTime(shop.blockedAt) : '';
    const blockReason = (shop.blockedReason || '').trim();
    const blockInfo = isBlocked
      ? `<div class="seller-block-info"><i class="ri-shield-keyhole-line"></i><span>مسدود شده${blockedAtText ? ` از ${escapeHtml(blockedAtText)}` : ''}${blockReason ? ` • ${escapeHtml(blockReason)}` : ''}</span></div>`
      : '';

    const sellerAliases = collectSellerAliasKeys(shop);
    const sellerActionKey = sellerAliases.length
      ? sellerAliases[0]
      : (sellerKey || (shop.shopurl ? `shopurl:${shop.shopurl}` : '') || toIdString(shop._id || shop.id || ''));
    const sellerActionKeyEscaped = escapeHtml(sellerActionKey || '');
    const sid = toIdString(shop.sellerId || shop.seller_id || shop._id || shop._sid || shop.shopurl);

    const moderationButton = sellerActionKey
      ? `<button type="button" class="action-btn ${isBlocked ? 'unblock' : 'block'}" data-seller-action="${isBlocked ? 'unblock' : 'block'}" data-seller-key="${sellerActionKeyEscaped}"><i class="ri-${isBlocked ? 'shield-check-line' : 'shield-keyhole-line'}"></i> ${isBlocked ? 'رفع مسدودی' : 'مسدودسازی'}</button>`
      : '';

    const actionsHtml = `
      <div class="seller-actions">
        <button type="button" class="action-btn edit" data-seller-action="details" data-seller-key="${sellerActionKeyEscaped}"><i class="ri-eye-line"></i> جزئیات</button>
        ${moderationButton}
        <button type="button" class="action-btn delete" data-seller-action="delete" data-seller-id="${escapeHtml(sid)}"><i class="ri-delete-bin-line"></i> حذف</button>
      </div>
    `;

    let tr = document.createElement('tr');
    tr.dataset.sellerKey = sellerKey || '';
    tr.dataset.sellerBlocked = isBlocked ? 'true' : 'false';
    tr.innerHTML = `
      <td class="seller-cell seller-modal-trigger">
        <div class="seller-name">${escapeHtml(storeName)}</div>
        ${blockInfo}
      </td>
      <td class="seller-cell seller-modal-trigger">${escapeHtml(ownerName)}</td>
      <td class="seller-cell seller-modal-trigger">${escapeHtml(address)}</td>
      <td>${shopLink}</td>
      <td>${countProducts}</td>
      <td>${shop._visits}</td>
      <td class="seller-cell seller-modal-trigger seller-score-cell" data-score-key="${sellerKey || ''}">${combinedStatus}</td>
      <td class="seller-actions-cell">${actionsHtml}</td>
    `;

    Array.from(tr.querySelectorAll('.seller-cell')).forEach(td => {
      td.onclick = () => showSellerModal(findShopByAliasKey(sellerActionKey) || shop);
    });

    const detailBtn = tr.querySelector('[data-seller-action="details"]');
    if (detailBtn) {
      detailBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const key = detailBtn.dataset.sellerKey || sellerActionKey;
        const targetShop = findShopByAliasKey(key) || shop;
        if (targetShop) {
          showSellerModal(targetShop);
        } else {
          alert('فروشنده در لیست یافت نشد.');
        }
      });
    }

    const blockBtn = tr.querySelector('[data-seller-action="block"]');
    if (blockBtn) {
      blockBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await handleSellerQuickModeration(blockBtn, shop, 'block');
      });
    }

    const unblockBtn = tr.querySelector('[data-seller-action="unblock"]');
    if (unblockBtn) {
      unblockBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await handleSellerQuickModeration(unblockBtn, shop, 'unblock');
      });
    }

    const deleteBtn = tr.querySelector('[data-seller-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const targetId = deleteBtn.dataset.sellerId || sid;
        deleteSeller(targetId);
      });
    }

    tbody.appendChild(tr);
  });

  if (!sellers.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:#888;text-align:center">هیچ فروشگاهی یافت نشد.</td></tr>`;
  }
}

// پاپ‌آپ اطلاعات فروشنده
// ← این تابع را جایگزین کنید
/* ===== نسخهٔ جدید تابع showSellerModal (همراه شماره موبایل) ===== */
/* ------------------------------------------------------------------
/* ─────────────── showSellerModal ───────────────── */
let sellerModalOverlayClickHandler = null;
let sellerModalKeydownHandler = null;
async function showSellerModal (shop) {
  const overlay = document.getElementById('seller-modal-overlay');

  /* تبدیل تاریخ میلادی به شمسی */
  const fDate = d =>
    d
      ? new Date(d).toLocaleDateString('fa-IR', {
          year: 'numeric', month: 'long', day: 'numeric'
        })
      : '—';

  const sellerKey = resolveSellerKeyFromShop(shop);
  const fallbackKey = sellerKey || (shop.shopurl ? `shopurl:${shop.shopurl}` : '');
  const moderationAliasKeys = new Set();
  collectSellerAliasKeys(shop).forEach(key => moderationAliasKeys.add(key));
  if (fallbackKey) moderationAliasKeys.add(fallbackKey);
  let sellerDetails = null;

  if (fallbackKey) {
    sellerDetails = await getSellerDetails(fallbackKey);
  }

  if (sellerDetails && sellerKey) {
    const idx = shopsList.findIndex(s => resolveSellerKeyFromShop(s) === sellerKey);
    if (idx !== -1) {
      const target = shopsList[idx];
      Object.assign(target, {
        phone: sellerDetails.phone || target.phone,
        mobile: sellerDetails.mobile || sellerDetails.phone || target.mobile,
        address: sellerDetails.address || target.address,
        shopAddress: sellerDetails.address || target.shopAddress,
        subscriptionStart: sellerDetails.subscriptionStart || target.subscriptionStart,
        subscriptionEnd: sellerDetails.subscriptionEnd || target.subscriptionEnd,
        blockedByAdmin: !!sellerDetails.blockedByAdmin,
        blockedAt: sellerDetails.blockedAt || null,
        blockedBy: sellerDetails.blockedBy || null,
        blockedReason: sellerDetails.blockedReason || ''
      });
      renderSellers();
    }
  }

  if (sellerDetails) {
    collectSellerAliasKeys(sellerDetails).forEach(key => moderationAliasKeys.add(key));
  }

  const sellerData = sellerDetails ? { ...shop, ...sellerDetails } : { ...shop };

  const storeName = sellerData.storename || sellerData.shopLogoText || '-';
  const url       = sellerData.shopurl  || '';
  const phone     =
        sellerData.phone || sellerData.mobile ||
        sellerData.ownerPhone || sellerData.ownerMobile || '-';
  const sellerScoreKey = sellerKey;
  const sellerEndpointKey = sellerDetails?._id ? toIdString(sellerDetails._id) : (sellerScoreKey || fallbackKey || '');
  if (sellerScoreKey) moderationAliasKeys.add(sellerScoreKey);
  if (sellerEndpointKey) moderationAliasKeys.add(sellerEndpointKey);
  const subscriptionStart = sellerData.subscriptionStart;
  const subscriptionEnd = sellerData.subscriptionEnd;

  if (sellerScoreKey && !sellerPerformanceLoaded) {
    await refreshSellerPerformanceMap();
  }

  let performanceMeta = sellerScoreKey ? getSellerPerformanceByKey(sellerScoreKey) : null;

  const existingAdminScore = performanceMeta && performanceMeta.adminScore != null
    ? performanceMeta.adminScore
    : null;
  const defaultAdminScore = 75;
  let hasExistingScore = existingAdminScore != null;
  const initialAdminScore = hasExistingScore ? existingAdminScore : defaultAdminScore;
  const statusSeverity = performanceMeta ? performanceMeta.severity || 'neutral' : 'neutral';
  const statusLabel = performanceMeta ? performanceMeta.statusLabel : 'در انتظار ارزیابی';
  const statusMessage = performanceMeta && performanceMeta.statusMessage
    ? performanceMeta.statusMessage
    : 'پس از ثبت نمره، وضعیت عملکرد نمایش داده می‌شود.';
  const eligibilityNote = performanceMeta
    ? (performanceMeta.canStay ? '✅ این فروشنده مجاز به ادامه همکاری است.' : '⛔ با این نمره فروشنده قادر به ماندن در ویترینت نیست.')
    : 'برای تعیین وضعیت همکاری، ابتدا نمره را ثبت کنید.';
  const statusUpdatedText = performanceMeta && performanceMeta.updatedAt
    ? `آخرین بروزرسانی: ${formatDateTime(performanceMeta.updatedAt)}`
    : 'هنوز نمره‌ای ثبت نشده است.';
  const existingAdminNote = performanceMeta && typeof performanceMeta.note === 'string'
    ? performanceMeta.note
    : (performanceMeta && typeof performanceMeta.adminScoreNote === 'string'
      ? performanceMeta.adminScoreNote
      : '');
  const existingAdminMessage = performanceMeta && typeof performanceMeta.adminScoreMessage === 'string'
    ? performanceMeta.adminScoreMessage
    : (performanceMeta && typeof performanceMeta.publicMessage === 'string'
      ? performanceMeta.publicMessage
      : '');
  const defaultNoteMessage = 'یادداشتی ثبت نشده است.';
  const defaultMessageText = 'پیامی برای فروشنده ثبت نشده است.';
  const moderationStateInitial = {
    blocked: !!sellerData.blockedByAdmin,
    blockedAt: sellerData.blockedAt || null,
    blockedBy: sellerData.blockedBy || null,
    blockedReason: sellerData.blockedReason || ''
  };
  const createdAt = sellerData.createdAt;
  const noteDisplayHtml = existingAdminNote
    ? formatNoteForDisplay(existingAdminNote)
    : escapeHtml(defaultNoteMessage);
  const noteValueForInput = escapeHtml(existingAdminNote);
  const messageDisplayHtml = existingAdminMessage
    ? formatNoteForDisplay(existingAdminMessage)
    : escapeHtml(defaultMessageText);
  const messageValueForInput = escapeHtml(existingAdminMessage);

  /* ---------- رندر اولیه ---------- */
  overlay.innerHTML = `
    <div class="seller-modal" role="dialog" aria-modal="true">
      <button type="button" class="seller-modal-close" onclick="closeSellerModal()" aria-label="بستن پنجره">×</button>

      <div class="seller-modal-title">
        مشخصات فروشگاه:
        <span style="color:#0ea5e9">${escapeHtml(storeName)}</span>
      </div>

      <div class="seller-modal-row">
        <span class="seller-modal-label">ثبت‌نام:</span>
        <span class="seller-modal-value">${escapeHtml(fDate(createdAt))}</span>
      </div>

      <div class="seller-modal-row">
        <span class="seller-modal-label">شماره موبایل:</span>
        <span class="seller-modal-value">${escapeHtml(phone)}</span>
      </div>

      <div class="seller-modal-row">
        <span class="seller-modal-label">نوع اشتراک:</span>
        <span class="seller-modal-value">${escapeHtml(sellerData.subscriptionType || (sellerData.isPremium ? 'premium' : '-'))}</span>
      </div>

      <div class="seller-modal-row">
        <span class="seller-modal-label">تاریخ خرید:</span>
        <span class="seller-modal-value">${escapeHtml(fDate(subscriptionStart))}</span>
      </div>

      <div class="seller-modal-row">
        <span class="seller-modal-label">تاریخ پایان:</span>
        <span class="seller-modal-value">${escapeHtml(fDate(subscriptionEnd))}</span>
      </div>

      <section class="seller-moderation-card" id="sellerModerationCard" data-status="${moderationStateInitial.blocked ? 'blocked' : 'active'}">
        <div class="seller-moderation-header">
          <span class="seller-moderation-chip" id="sellerModerationChip"></span>
          <div class="seller-moderation-meta" id="sellerModerationMeta"></div>
        </div>
        <p class="seller-moderation-description" id="sellerModerationDescription"></p>
        <label class="seller-moderation-label" for="sellerModerationReason">دلیل یا یادداشت مدیریتی</label>
        <textarea id="sellerModerationReason" placeholder="دلیل مسدودسازی یا توضیح مدیریتی..."></textarea>
        <div class="seller-moderation-actions">
          <button type="button" class="seller-moderation-btn danger" id="sellerModerationBlock"><i class="ri-shield-off-line"></i> مسدودسازی فروشنده</button>
          <button type="button" class="seller-moderation-btn success" id="sellerModerationUnblock"><i class="ri-shield-check-line"></i> رفع مسدودی</button>
        </div>
        <div class="seller-moderation-alert" id="sellerModerationAlert" style="display:none;"></div>
      </section>

      <div class="seller-score-block" data-score-key="${sellerScoreKey || ''}">
        <span class="seller-modal-label">نمره ارزیابی ادمین</span>
        <div class="seller-score-range">
          <input type="range" id="sellerScoreInput" min="0" max="100" step="1" value="${initialAdminScore}" aria-label="امتیاز عملکرد فروشنده">
          <div class="seller-score-value" id="sellerScoreValue">${initialAdminScore}</div>
        </div>
        <div class="seller-score-actions">
          <button type="button" class="score-save-btn" id="saveSellerScoreBtn">ثبت نمره</button>
          <button type="button" class="score-clear-btn" id="clearSellerScoreBtn" ${hasExistingScore ? '' : 'disabled'}>حذف نمره</button>
        </div>
        <p class="seller-score-hint">نمره ۰ تا ۱۰۰ کیفیت همکاری فروشنده را از نگاه تیم ادمین نشان می‌دهد. پس از انتخاب مقدار، دکمه «ثبت نمره» را بزن.</p>
        <div class="seller-score-note">
          <label for="sellerScoreNote">یادداشت داخلی ادمین</label>
          <textarea id="sellerScoreNote" placeholder="نکات ارزیابی را وارد کنید…">${noteValueForInput}</textarea>
          <p class="seller-score-note-hint">این یادداشت فقط برای تیم ادمین نمایش داده می‌شود و به فروشنده ارسال نخواهد شد.</p>
        </div>
        <div class="seller-score-message">
          <label for="sellerScoreMessage">پیام قابل نمایش برای فروشنده</label>
          <textarea id="sellerScoreMessage" placeholder="این پیام همراه با نمره برای فروشنده ارسال می‌شود…">${messageValueForInput}</textarea>
          <p class="seller-score-message-hint">فروشنده متن این پیام را در بخش وضعیت عملکرد پنل خود مشاهده می‌کند.</p>
        </div>
        <div class="seller-score-alert" id="sellerScoreAlert" style="display:none;"></div>
        <div class="seller-score-status" id="sellerScoreStatus">
          <div class="seller-score-status-header">
            <span class="seller-status-pill status-${statusSeverity}" id="sellerStatusBadge">${statusLabel}</span>
            <span class="seller-status-updated" id="sellerStatusUpdated">${statusUpdatedText}</span>
          </div>
          <p class="seller-status-text" id="sellerStatusText">${statusMessage}</p>
          <p class="seller-status-note ${performanceMeta ? (performanceMeta.canStay ? 'status-eligible' : 'status-ineligible') : 'status-neutral'}" id="sellerStatusNote">${eligibilityNote}</p>
          <div class="seller-score-message-display" id="sellerMessageDisplay">
            <span class="seller-score-message-title">آخرین پیام برای فروشنده</span>
            <p class="seller-message-text" id="sellerMessageText">${messageDisplayHtml}</p>
          </div>
          <div class="seller-score-note-display" id="sellerNoteDisplay">
            <span class="seller-score-note-title">آخرین یادداشت ثبت‌شده</span>
            <p class="seller-note-text" id="sellerNoteText">${noteDisplayHtml}</p>
          </div>
        </div>
      </div>

      <form id="sellerMessageForm"
            class="seller-modal-form"
            data-seller-id="${sellerEndpointKey}"
            data-shopurl="${url}">
        <label for="sellerMessage">ارسال پیام به این فروشنده:</label>
        <textarea id="sellerMessage" name="msg"
                  placeholder="پیام خود را بنویسید…" required></textarea>
        <button type="submit">ارسال پیام</button>
        <div id="seller-modal-success"
             class="seller-modal-success"
             style="display:none"></div>
      </form>
    </div>`;

  overlay.style.display = 'flex';

  if (sellerModalOverlayClickHandler) {
    overlay.removeEventListener('click', sellerModalOverlayClickHandler);
  }
  sellerModalOverlayClickHandler = (event) => {
    if (event.target === overlay) {
      closeSellerModal();
    }
  };
  overlay.addEventListener('click', sellerModalOverlayClickHandler);

  if (sellerModalKeydownHandler) {
    document.removeEventListener('keydown', sellerModalKeydownHandler);
  }
  sellerModalKeydownHandler = (event) => {
    if (event.key === 'Escape') {
      closeSellerModal();
    }
  };
  document.addEventListener('keydown', sellerModalKeydownHandler);

  const scoreInputEl = document.getElementById('sellerScoreInput');
  const scoreValueEl = document.getElementById('sellerScoreValue');
  const scoreSaveBtn = document.getElementById('saveSellerScoreBtn');
  const scoreClearBtn = document.getElementById('clearSellerScoreBtn');
  const scoreAlertEl = document.getElementById('sellerScoreAlert');
  const sellerScoreNoteEl = document.getElementById('sellerScoreNote');
  const sellerScoreMessageEl = document.getElementById('sellerScoreMessage');
  const statusElements = {
    badge: document.getElementById('sellerStatusBadge'),
    text: document.getElementById('sellerStatusText'),
    note: document.getElementById('sellerStatusNote'),
    updated: document.getElementById('sellerStatusUpdated'),
    noteText: document.getElementById('sellerNoteText'),
    noteContainer: document.getElementById('sellerNoteDisplay'),
    messageText: document.getElementById('sellerMessageText'),
    messageContainer: document.getElementById('sellerMessageDisplay')
  };

  const moderationElements = {
    card: document.getElementById('sellerModerationCard'),
    chip: document.getElementById('sellerModerationChip'),
    meta: document.getElementById('sellerModerationMeta'),
    description: document.getElementById('sellerModerationDescription'),
    reason: document.getElementById('sellerModerationReason'),
    blockBtn: document.getElementById('sellerModerationBlock'),
    unblockBtn: document.getElementById('sellerModerationUnblock'),
    alert: document.getElementById('sellerModerationAlert')
  };

  const moderationStateRef = { ...moderationStateInitial };
  let moderationAlertTimer = null;

  const formatModerationMeta = (state) => {
    if (!state.blocked) {
      return 'بدون مسدودی فعال';
    }
    const parts = [];
    if (state.blockedAt) {
      const dateText = formatDateTime(state.blockedAt);
      if (dateText) {
        parts.push(`مسدود شده در ${escapeHtml(dateText)}`);
      }
    }
    if (state.blockedBy) {
      parts.push(`شناسه مدیر: ${escapeHtml(toIdString(state.blockedBy))}`);
    }
    if (!parts.length) {
      parts.push('مسدود شده توسط تیم ادمین');
    }
    return parts.join(' • ');
  };

  const formatModerationDescription = (state) => {
    if (!state.blocked) {
      return 'این فروشنده فعال است و دسترسی کامل دارد.';
    }
    const reasonHtml = state.blockedReason
      ? `<br><strong>دلیل:</strong> ${formatNoteForDisplay(state.blockedReason)}`
      : '';
    return `این فروشنده در حال حاضر توسط تیم ادمین مسدود شده است.${reasonHtml}`;
  };

  const updateModerationUI = (state) => {
    if (!moderationElements.card) return;
    const status = state.blocked ? 'blocked' : 'active';
    moderationElements.card.dataset.status = status;
    if (moderationElements.chip) {
      moderationElements.chip.innerHTML = state.blocked
        ? '<i class="ri-shield-cross-line"></i> مسدود شده'
        : '<i class="ri-shield-check-line"></i> فعال';
      moderationElements.chip.classList.toggle('is-blocked', !!state.blocked);
      moderationElements.chip.classList.toggle('is-active', !state.blocked);
    }
    if (moderationElements.meta) {
      moderationElements.meta.innerHTML = formatModerationMeta(state);
    }
    if (moderationElements.description) {
      moderationElements.description.innerHTML = formatModerationDescription(state);
    }
    if (moderationElements.reason) {
      moderationElements.reason.value = state.blocked ? state.blockedReason : '';
      moderationElements.reason.placeholder = state.blocked
        ? 'دلیل مسدودسازی یا یادداشت پیگیری...'
        : 'یادداشت رفع مسدودی (اختیاری)...';
    }
    const hasIdentifier = !!sellerEndpointKey;
    if (!hasIdentifier && moderationElements.meta) {
      moderationElements.meta.innerHTML = 'شناسه فروشنده معتبر نیست.';
    }
    if (moderationElements.blockBtn) {
      moderationElements.blockBtn.disabled = state.blocked || !hasIdentifier;
    }
    if (moderationElements.unblockBtn) {
      moderationElements.unblockBtn.disabled = !state.blocked || !hasIdentifier;
    }
  };

  const showModerationAlert = (message, type = 'success') => {
    if (!moderationElements.alert) return;
    moderationElements.alert.textContent = message;
    moderationElements.alert.classList.remove('is-success', 'is-error');
    moderationElements.alert.classList.add(type === 'error' ? 'is-error' : 'is-success');
    moderationElements.alert.style.display = 'block';
    clearTimeout(moderationAlertTimer);
    moderationAlertTimer = setTimeout(() => {
      if (moderationElements.alert) {
        moderationElements.alert.style.display = 'none';
      }
    }, 3200);
  };

  const handleModerationAction = async (mode) => {
    if (!sellerEndpointKey) {
      showModerationAlert('شناسه فروشنده معتبر نیست.', 'error');
      return;
    }
    const targetBtn = mode === 'block' ? moderationElements.blockBtn : moderationElements.unblockBtn;
    if (!targetBtn) return;

    const previousLabel = targetBtn.innerHTML;
    targetBtn.disabled = true;
    targetBtn.innerHTML = '<i class="ri-loader-4-line"></i> در حال انجام...';

    try {
      const reasonValue = moderationElements.reason ? moderationElements.reason.value.trim() : '';
      const { state, message } = await requestSellerModeration(sellerEndpointKey, mode, reasonValue);
      Object.assign(moderationStateRef, state);
      updateModerationUI(moderationStateRef);
      applySellerModerationState(Array.from(moderationAliasKeys), moderationStateRef);
      showModerationAlert(message);
    } catch (err) {
      console.error('seller moderation action error:', err);
      showModerationAlert(err.message || 'خطا در انجام عملیات.', 'error');
    } finally {
      targetBtn.innerHTML = previousLabel;
      updateModerationUI(moderationStateRef);
    }
  };

  if (moderationElements.blockBtn) {
    moderationElements.blockBtn.addEventListener('click', () => handleModerationAction('block'));
  }
  if (moderationElements.unblockBtn) {
    moderationElements.unblockBtn.addEventListener('click', () => handleModerationAction('unblock'));
  }

  updateModerationUI(moderationStateRef);

  if (scoreInputEl && scoreValueEl) {
    scoreInputEl.value = String(initialAdminScore);
    scoreValueEl.textContent = String(initialAdminScore);
  }

  const resolveNoteValue = (info) => {
    if (!info) return '';
    if (typeof info.note === 'string') return info.note;
    if (typeof info.adminScoreNote === 'string') return info.adminScoreNote;
    return '';
  };

  const resolveMessageValue = (info) => {
    if (!info) return '';
    if (typeof info.adminScoreMessage === 'string') return info.adminScoreMessage;
    if (typeof info.publicMessage === 'string') return info.publicMessage;
    return '';
  };

  const updateNoteUI = (value) => {
    const noteValue = typeof value === 'string' ? value : '';
    if (sellerScoreNoteEl) sellerScoreNoteEl.value = noteValue;
    if (statusElements.noteText) {
      statusElements.noteText.innerHTML = noteValue
        ? formatNoteForDisplay(noteValue)
        : escapeHtml(defaultNoteMessage);
    }
    if (statusElements.noteContainer) {
      statusElements.noteContainer.style.display = 'flex';
    }
  };

  const updateMessageUI = (value) => {
    const messageValue = typeof value === 'string' ? value : '';
    if (sellerScoreMessageEl) sellerScoreMessageEl.value = messageValue;
    if (statusElements.messageText) {
      statusElements.messageText.innerHTML = messageValue
        ? formatNoteForDisplay(messageValue)
        : escapeHtml(defaultMessageText);
    }
    if (statusElements.messageContainer) {
      statusElements.messageContainer.style.display = 'flex';
      if (messageValue) {
        statusElements.messageContainer.classList.remove('is-empty');
      } else {
        statusElements.messageContainer.classList.add('is-empty');
      }
    }
  };

  updateNoteUI(existingAdminNote);
  updateMessageUI(existingAdminMessage);

  const applyStatusMeta = (meta) => {
    const info = meta || null;
    const severity = info ? info.severity || 'neutral' : 'neutral';
    if (statusElements.badge) {
      statusElements.badge.textContent = info ? info.statusLabel : 'در انتظار ارزیابی';
      statusElements.badge.className = `seller-status-pill status-${severity}`;
    }
    if (statusElements.text) {
      statusElements.text.textContent = info && info.statusMessage
        ? info.statusMessage
        : 'پس از ثبت نمره، وضعیت عملکرد نمایش داده می‌شود.';
    }
    if (statusElements.note) {
      const canStay = info ? !!info.canStay : null;
      statusElements.note.textContent = info
        ? (canStay ? '✅ این فروشنده مجاز به ادامه همکاری است.' : '⛔ با این نمره فروشنده قادر به ماندن در ویترینت نیست.')
        : 'برای تعیین وضعیت همکاری، ابتدا نمره را ثبت کنید.';
      statusElements.note.className = `seller-status-note ${info ? (canStay ? 'status-eligible' : 'status-ineligible') : 'status-neutral'}`;
    }
    if (statusElements.updated) {
      statusElements.updated.textContent = info && info.updatedAt
        ? `آخرین بروزرسانی: ${formatDateTime(info.updatedAt)}`
        : 'هنوز نمره‌ای ثبت نشده است.';
    }
    updateNoteUI(resolveNoteValue(info));
    updateMessageUI(resolveMessageValue(info));
  };

  applyStatusMeta(performanceMeta);

  const showScoreAlert = (message, type = 'success') => {
    if (!scoreAlertEl) return;
    scoreAlertEl.textContent = message;
    scoreAlertEl.classList.remove('is-success', 'is-error');
    scoreAlertEl.classList.add(type === 'error' ? 'is-error' : 'is-success');
    scoreAlertEl.style.display = 'block';
    setTimeout(() => {
      if (scoreAlertEl) scoreAlertEl.style.display = 'none';
    }, 2800);
  };

  if (scoreInputEl) {
    scoreInputEl.addEventListener('input', () => {
      if (scoreValueEl) scoreValueEl.textContent = scoreInputEl.value;
    });
  }

  if (scoreSaveBtn) {
    scoreSaveBtn.addEventListener('click', async () => {
      if (!sellerScoreKey) {
        showScoreAlert('شناسه فروشنده برای ثبت نمره یافت نشد.', 'error');
        return;
      }
      const sourceValue = scoreInputEl ? scoreInputEl.value : initialAdminScore;
      const noteValue = sellerScoreNoteEl ? sellerScoreNoteEl.value : '';
      const messageValue = sellerScoreMessageEl ? sellerScoreMessageEl.value : '';
      if (!messageValue.trim()) {
        showScoreAlert('لطفاً دلیل نمره را برای فروشنده بنویسید.', 'error');
        return;
      }
      scoreSaveBtn.disabled = true;
      scoreSaveBtn.classList.add('is-loading');
      try {
        const meta = await setSellerScoreByKey(sellerScoreKey, sourceValue, noteValue, messageValue);
        performanceMeta = meta || performanceMeta;
        const finalScore = meta && meta.adminScore != null
          ? meta.adminScore
          : Math.max(0, Math.min(100, Math.round(Number(sourceValue) || 0)));
        if (scoreValueEl) scoreValueEl.textContent = String(finalScore);
        if (scoreInputEl) scoreInputEl.value = String(finalScore);
        hasExistingScore = finalScore != null;
        if (scoreClearBtn) scoreClearBtn.disabled = !hasExistingScore;
        if (meta) {
          applyStatusMeta(meta);
        } else {
          updateNoteUI(noteValue);
          updateMessageUI(messageValue);
        }
        renderSellers();
        showScoreAlert((meta && meta.message) || 'نمره ثبت شد.');
      } catch (err) {
        console.error('saveSellerScore error:', err);
        showScoreAlert(err.message || 'خطا در ثبت نمره.', 'error');
      } finally {
        scoreSaveBtn.disabled = false;
        scoreSaveBtn.classList.remove('is-loading');
      }
    });
  }

  if (scoreClearBtn) {
    scoreClearBtn.addEventListener('click', async () => {
      if (!sellerScoreKey) {
        showScoreAlert('شناسه فروشنده یافت نشد.', 'error');
        return;
      }
      scoreClearBtn.disabled = true;
      scoreClearBtn.classList.add('is-loading');
      try {
        const meta = await clearSellerScoreByKey(sellerScoreKey);
        performanceMeta = meta || null;
        if (scoreInputEl) scoreInputEl.value = String(defaultAdminScore);
        if (scoreValueEl) scoreValueEl.textContent = String(defaultAdminScore);
        hasExistingScore = false;
        if (meta) {
          applyStatusMeta(meta);
        } else {
          updateNoteUI('');
          updateMessageUI('');
        }
        renderSellers();
        showScoreAlert((meta && meta.message) || 'نمره حذف شد.');
      } catch (err) {
        console.error('clearSellerScore error:', err);
        showScoreAlert(err.message || 'خطا در حذف نمره.', 'error');
        scoreClearBtn.disabled = false;
      } finally {
        scoreClearBtn.classList.remove('is-loading');
      }
    });
  }

  /* ارسال پیام */
  document
    .getElementById('sellerMessageForm')
    .addEventListener('submit', sendSellerMessage);

  // تابع fetchSellerPassword دیگر نیازی نیست و حذف می‌شود
}









function closeSellerModal() {
  const overlay = document.getElementById('seller-modal-overlay');
  if (!overlay) return;
  overlay.style.display = "none";
  overlay.innerHTML = "";
  if (sellerModalOverlayClickHandler) {
    overlay.removeEventListener('click', sellerModalOverlayClickHandler);
    sellerModalOverlayClickHandler = null;
  }
  if (sellerModalKeydownHandler) {
    document.removeEventListener('keydown', sellerModalKeydownHandler);
    sellerModalKeydownHandler = null;
  }
}

// ← این تابع را جایگزین کنید
async function sendSellerMessage(e) {
  e.preventDefault();
  const form  = e.currentTarget;
  let   rawId = form.dataset.sellerId;  // "shopurl:slug" یا ObjectId
  const text  = form.querySelector('textarea').value.trim();

  if (!text) {
    return alert('متن پیام نمی‌تواند خالی باشد.');
  }
  if (!rawId) {
    return alert('شناسه فروشنده پیدا نشد!');
  }

  // آماده‌سازی payload
  const body = { text, from: 'admin' };
  if (rawId.startsWith('shopurl:')) {
    body.shopurl = rawId.replace(/^shopurl:/, '');
  } else {
    body.sellerId = rawId;
  }

  try {
    const res = await fetch(`${ADMIN_API_BASE}/chats`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json'
        // هدر Authorization لازم نیست چون با کوکی کار می‌کنی
      },
      credentials: 'include',
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || 'خطا در ارسال پیام');
    }

    // موفقیت
    form.querySelector('textarea').value = '';
    const okBox = document.getElementById('seller-modal-success');
    okBox.textContent = '✅ پیام با موفقیت ارسال شد!';
    okBox.style.display = 'block';
    setTimeout(() => okBox.style.display = 'none', 2500);

  } catch (err) {
    console.error('sendSellerMessage error:', err, body);
    alert('❌ خطا در ارسال پیام:\n' + err.message);
  }
}











/**
 * اگر chat.seller پر نشده باشد، با شناسه یا shopurl در shopsList جست‌وجو کن
 */
// 1) تابع کمکی برای یافتن شیء فروشنده
/** پیدا کردن شیء فروشنده با sellerId یا shopurl */
// تابع کمکی برای یافتن شیء فروشنده
// پیدا کردن شیء فروشنده با sellerId یا shopurl
// تابع اصلاح شده برای یافتن فروشگاه
function findShopBySellerId(sellerId, shopUrl) {
  const sid = toIdString(sellerId);
  const url = toIdString(shopUrl);
  
  // جستجوی اولیه با استفاده از شناسه فروشنده
  const bySellerId = shopsList.find(shop => {
    const shopIds = [
      toIdString(shop._id),
      toIdString(shop.id),
      toIdString(shop.sellerId),
      toIdString(shop.seller_id),
      shop._sid ? toIdString(shop._sid) : null
    ].filter(Boolean);
    
    return shopIds.includes(sid);
  });
  
  if (bySellerId) return bySellerId;
  
  // جستجوی ثانویه با استفاده از آدرس فروشگاه
  const byShopUrl = shopsList.find(shop => 
    toIdString(shop.shopurl) === url
  );
  
  return byShopUrl || null;
}
// تابع اصلاح شده برای نمایش مدال فرستنده
// تابع اصلاح شده برای دریافت اطلاعات فروشنده
async function getSellerDetails(sellerId) {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/sellers/${encodeURIComponent(sellerId)}`, {
      credentials: 'include'
    });
    
    if (!res.ok) {
      throw new Error('فروشنده یافت نشد');
    }
    
    return await res.json();
  } catch (err) {
    console.error('خطا در دریافت اطلاعات فروشنده:', err);
    return null;
  }
}

// تابع اصلاح شده برای نمایش مدال
async function openSenderModal(chat) {
  const ov = document.getElementById('sender-modal-overlay');
  if (!ov) return;

  ov.innerHTML = `
    <div class="sender-modal">
      <button class="sender-modal-close" onclick="closeSenderModal()">×</button>
      <h4>دریافت اطلاعات فروشنده...</h4>
    </div>
  `;
  ov.style.display = 'flex';

  try {
    // استفاده از شناسه فروشنده از چت
    const sellerId = chat.sellerId || '';
    
    // دریافت اطلاعات فروشنده از بک‌اند
    const seller = await getSellerDetails(sellerId);
    
    if (!seller) {
      ov.innerHTML = `
        <div class="sender-modal">
          <button class="sender-modal-close" onclick="closeSenderModal()">×</button>
          <h4>خطا در دریافت اطلاعات</h4>
          <p>فروشنده با شناسه ${sellerId} یافت نشد</p>
        </div>
      `;
      return;
    }

    // نمایش اطلاعات فروشنده
    ov.innerHTML = `
      <div class="sender-modal">
        <button class="sender-modal-close" onclick="closeSenderModal()">×</button>
        <h4>مشخصات فروشنده</h4>
        
        <div class="sender-info-row">
          <span class="sender-info-label">نام فروشگاه:</span>
          <span class="sender-info-value">${seller.storename || '-'}</span>
        </div>
        
        <div class="sender-info-row">
          <span class="sender-info-label">نام صاحب فروشگاه:</span>
          <span class="sender-info-value">${seller.firstname || ''} ${seller.lastname || ''}</span>
        </div>
        
        <div class="sender-info-row">
          <span class="sender-info-label">آدرس فروشگاه:</span>
          <span class="sender-info-value">${seller.address || '-'}</span>
        </div>
        
        <div class="sender-info-row">
          <span class="sender-info-label">شماره تماس:</span>
          <span class="sender-info-value">${seller.phone || '-'}</span>
        </div>
        
        <div class="sender-info-row">
          <span class="sender-info-label">آدرس اینترنتی:</span>
          <span class="sender-info-value">${seller.shopurl || '-'}</span>
        </div>
        
        <div class="sender-info-row">
          <span class="sender-info-label">دسته‌بندی:</span>
          <span class="sender-info-value">${seller.category || '-'}</span>
        </div>
      </div>
    `;
  } catch (err) {
    ov.innerHTML = `
      <div class="sender-modal">
        <button class="sender-modal-close" onclick="closeSenderModal()">×</button>
        <h4>خطا در دریافت اطلاعات</h4>
        <p>${err.message || 'خطای نامشخص'}</p>
      </div>
    `;
  }
}
/* بستن مدال */
function closeSenderModal() {
  const ov = document.getElementById('sender-modal-overlay');
  ov.style.display = 'none';
  ov.innerHTML = '';
}




// تابع کمکی برای استانداردسازی ID




// ————————————————————————————






// ثبت پنل مدیریت پلن‌ها به panels
// ثبت پنل مدیریت پلن‌ها به panels
// ثبت پنل مدیریت پلن‌ها به panels
panels['plans'] = document.getElementById('plans-panel');

panels['ads'] = document.getElementById('ads-panel');
panels['messages'] = document.getElementById('messages-panel');
panels['home-section'] = document.getElementById('home-section-panel');


/* المان‌های ورودی */
const PLAN_SLUGS = ['1month', '3month', '12month'];
const VALID_BADGE_VARIANTS = ['emerald', 'amber', 'sky', 'violet', 'rose', 'slate'];
const PLAN_BADGE_STYLES = {
  emerald: { background: 'linear-gradient(90deg,#10b981 10%,#0ea5e9 100%)', color: '#ffffff' },
  amber:   { background: 'linear-gradient(90deg,#f59e0b 10%,#f97316 100%)', color: '#ffffff' },
  sky:     { background: 'linear-gradient(90deg,#0ea5e9 10%,#38bdf8 100%)', color: '#ffffff' },
  violet:  { background: 'linear-gradient(90deg,#6366f1 10%,#8b5cf6 100%)', color: '#ffffff' },
  rose:    { background: 'linear-gradient(90deg,#f43f5e 10%,#ec4899 100%)', color: '#ffffff' },
  slate:   { background: 'linear-gradient(90deg,#1e293b 0%,#0f172a 100%)', color: '#e2e8f0' }
};

const normalizeBadgeVariant = (variant) => {
  const value = (variant || '').toString().trim();
  return VALID_BADGE_VARIANTS.includes(value) ? value : VALID_BADGE_VARIANTS[0];
};

const planFormRefs = PLAN_SLUGS.reduce((acc, slug) => {
  acc[slug] = {
    title: document.getElementById(`plan-${slug}-title`),
    price: document.getElementById(`plan-${slug}-price`),
    duration: document.getElementById(`plan-${slug}-duration`),
    description: document.getElementById(`plan-${slug}-description`),
    features: document.getElementById(`plan-${slug}-features`),
    badgeLabel: document.getElementById(`plan-${slug}-badge-label`),
    badgeVariant: document.getElementById(`plan-${slug}-badge-variant`),
    badgeVisible: document.getElementById(`plan-${slug}-badge-visible`),
    badgeChip: document.querySelector(`[data-plan-badge-chip="${slug}"]`),
    badgeStatus: document.querySelector(`[data-plan-badge-status="${slug}"]`),
    source: document.querySelector(`[data-plan-source="${slug}"]`),
    updated: document.querySelector(`[data-plan-updated="${slug}"]`)
  };
  return acc;
}, {});
const plansMsg  = document.getElementById('plansMsg');
const planSaveModal = document.getElementById('plan-save-success-modal');
const planSaveModalClose = document.getElementById('plan-save-success-close');
let planCache   = {};
let lastFocusedBeforePlanSaveModal = null;

function openPlanSaveModal() {
  if (!planSaveModal) return;
  lastFocusedBeforePlanSaveModal = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  planSaveModal.classList.add('is-visible');
  planSaveModal.setAttribute('aria-hidden', 'false');
  planSaveModalClose?.focus({ preventScroll: true });
}

function closePlanSaveModal() {
  if (!planSaveModal) return;
  planSaveModal.classList.remove('is-visible');
  planSaveModal.setAttribute('aria-hidden', 'true');
  if (lastFocusedBeforePlanSaveModal && typeof lastFocusedBeforePlanSaveModal.focus === 'function') {
    lastFocusedBeforePlanSaveModal.focus({ preventScroll: true });
  }
  lastFocusedBeforePlanSaveModal = null;
}

if (planSaveModal) {
  planSaveModal.addEventListener('click', (event) => {
    if (event.target === planSaveModal) {
      closePlanSaveModal();
    }
  });
}

planSaveModalClose?.addEventListener('click', () => closePlanSaveModal());

if (planSaveModal) {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && planSaveModal.classList.contains('is-visible')) {
      closePlanSaveModal();
    }
  });
}

const formatPlanOrigin = (origin, sellerPhone) => {
  if (origin === 'seller-override') {
    return sellerPhone ? `اختصاصی ${sellerPhone}` : 'پلن اختصاصی';
  }
  if (origin === 'global') {
    return 'پلن عمومی';
  }
  return 'پیش‌فرض سیستم';
};

const sanitizeFeaturesInput = (value) => {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 12);
};

const applyBadgeChipStyle = (chipEl, variant) => {
  if (!chipEl) return;
  const style = PLAN_BADGE_STYLES[variant] || PLAN_BADGE_STYLES[VALID_BADGE_VARIANTS[0]];
  chipEl.style.background = style.background;
  chipEl.style.color = style.color;
};

const updateBadgePreview = (slug, overrides = {}) => {
  const refs = planFormRefs[slug];
  if (!refs) return;

  const label = overrides.badgeLabel !== undefined
    ? overrides.badgeLabel
    : (refs.badgeLabel?.value || '').trim();

  const variant = normalizeBadgeVariant(
    overrides.badgeVariant !== undefined
      ? overrides.badgeVariant
      : refs.badgeVariant?.value
  );

  const visible = overrides.badgeVisible !== undefined
    ? !!overrides.badgeVisible
    : (refs.badgeVisible ? refs.badgeVisible.checked : !!label);

  if (refs.badgeVariant) {
    refs.badgeVariant.value = variant;
  }

  if (refs.badgeChip) {
    refs.badgeChip.textContent = label || 'برچسب غیرفعال';
    applyBadgeChipStyle(refs.badgeChip, variant);
    refs.badgeChip.style.opacity = visible && label ? '1' : '0.35';
  }

  if (refs.badgeStatus) {
    refs.badgeStatus.textContent = visible && label ? 'نمایش فعال' : 'نمایش غیرفعال';
  }
};

const sellerPlanToggle       = document.getElementById('sellerPlanToggle');
const sellerPlanToggleSave   = document.getElementById('sellerPlanToggleSave');
const sellerPlanToggleRefresh= document.getElementById('sellerPlanToggleRefresh');
const sellerPlanToggleStatus = document.getElementById('sellerPlanToggleStatus');
const sellerPlanToggleMeta   = document.getElementById('sellerPlanToggleMeta');
const sellerPlanCard         = document.getElementById('sellerPlanToggleCard');

const SELLER_PLAN_STATUS_CLASSES = ['status-on', 'status-off', 'status-loading', 'status-error', 'status-success'];
let sellerPlanStatusResetTimer = null;

const formatFeatureDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch (err) {
    console.warn('formatFeatureDate failed', err);
    return date.toLocaleString('fa-IR');
  }
};

const buildSellerPlanMetaText = (meta) => {
  if (!meta || (!meta.updatedAt && !meta.updatedBy)) {
    return 'تغییرات این بخش به صورت آنی برای تمام فروشندگان اعمال می‌شود.';
  }

  const parts = [];
  const formattedDate = formatFeatureDate(meta.updatedAt);
  if (formattedDate) {
    parts.push(`آخرین بروزرسانی: ${formattedDate}`);
  }

  const updater = meta.updatedBy?.name || meta.updatedBy?.phone || '';
  if (updater) {
    parts.push(`توسط ${updater}`);
  }

  parts.push('اعمال روی همهٔ فروشندگان');
  return parts.join(' • ');
};

const setSellerPlanStatus = (text, className) => {
  if (!sellerPlanToggleStatus) return;
  sellerPlanToggleStatus.textContent = text;
  sellerPlanToggleStatus.classList.remove(...SELLER_PLAN_STATUS_CLASSES);
  if (className) {
    sellerPlanToggleStatus.classList.add(className);
  }
};

const updateSellerPlanCard = (enabled, meta) => {
  if (sellerPlanCard) {
    sellerPlanCard.dataset.enabled = enabled ? 'true' : 'false';
  }
  if (sellerPlanToggle) {
    sellerPlanToggle.checked = !!enabled;
  }
  const baseClass = enabled ? 'status-on' : 'status-off';
  const baseText  = enabled ? 'فعال' : 'غیرفعال';
  setSellerPlanStatus(baseText, baseClass);
  if (sellerPlanToggleMeta) {
    sellerPlanToggleMeta.textContent = buildSellerPlanMetaText(meta);
  }
};

const scheduleSellerPlanStatusReset = (enabled) => {
  clearTimeout(sellerPlanStatusResetTimer);
  sellerPlanStatusResetTimer = setTimeout(() => {
    let meta = null;
    const rawMeta = sellerPlanToggleMeta?.dataset?.meta;
    if (rawMeta) {
      try {
        meta = JSON.parse(rawMeta);
      } catch (err) {
        console.warn('scheduleSellerPlanStatusReset meta parse failed', err);
      }
    }
    updateSellerPlanCard(enabled, meta);
  }, 2200);
};

const persistSellerPlanMeta = (meta) => {
  if (!sellerPlanToggleMeta) return;
  try {
    sellerPlanToggleMeta.dataset.meta = JSON.stringify(meta || {});
  } catch (err) {
    sellerPlanToggleMeta.dataset.meta = '{}';
  }
};

const applySellerPlanMeta = (meta) => {
  persistSellerPlanMeta(meta);
  if (sellerPlanToggleMeta) {
    sellerPlanToggleMeta.textContent = buildSellerPlanMetaText(meta);
  }
};

async function loadSellerPlanFeatureFlag(silent = false) {
  if (!sellerPlanToggle) return;
  try {
    sellerPlanToggle.disabled = true;
    sellerPlanToggleSave && (sellerPlanToggleSave.disabled = true);
    sellerPlanToggleRefresh && (sellerPlanToggleRefresh.disabled = true);
    if (!silent) {
      setSellerPlanStatus('در حال دریافت...', 'status-loading');
    }

    const res = await fetch(`${ADMIN_API_BASE}/settings/feature-flags`, { credentials: 'include' });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const json = await res.json();
    const enabled = !!json?.flags?.sellerPlansEnabled;
    const meta = json?.meta?.sellerPlans || null;

    updateSellerPlanCard(enabled, meta);
    applySellerPlanMeta(meta);
  } catch (err) {
    console.error('loadSellerPlanFeatureFlag error:', err);
    setSellerPlanStatus('خطا در دریافت وضعیت', 'status-error');
    if (sellerPlanToggleMeta) {
      sellerPlanToggleMeta.textContent = 'امکان دریافت آخرین وضعیت فراهم نشد. دوباره تلاش کنید.';
    }
  } finally {
    sellerPlanToggle.disabled = false;
    sellerPlanToggleSave && (sellerPlanToggleSave.disabled = false);
    sellerPlanToggleRefresh && (sellerPlanToggleRefresh.disabled = false);
  }
}

async function saveSellerPlanFeatureFlag() {
  if (!sellerPlanToggle) return;
  const desired = !!sellerPlanToggle.checked;
  try {
    sellerPlanToggle.disabled = true;
    sellerPlanToggleSave && (sellerPlanToggleSave.disabled = true);
    sellerPlanToggleRefresh && (sellerPlanToggleRefresh.disabled = true);
    setSellerPlanStatus('در حال ذخیره...', 'status-loading');

    const token = getCookie('admin_token') || getCookie('access_token');
    const res = await fetch(`${ADMIN_API_BASE}/settings/feature-flags`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: 'Bearer ' + token })
      },
      body: JSON.stringify({ sellerPlansEnabled: desired })
    });

    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch (err) {
      console.warn('saveSellerPlanFeatureFlag JSON parse failed', err);
    }

    if (!res.ok || json.success === false) {
      throw new Error(json.message || text || 'ذخیره انجام نشد.');
    }

    const enabled = !!json?.flags?.sellerPlansEnabled;
    const meta = json?.meta?.sellerPlans || null;

    updateSellerPlanCard(enabled, meta);
    applySellerPlanMeta(meta);
    setSellerPlanStatus(enabled ? 'فعال شد' : 'غیرفعال شد', 'status-success');
    scheduleSellerPlanStatusReset(enabled);
  } catch (err) {
    console.error('saveSellerPlanFeatureFlag error:', err);
    setSellerPlanStatus(err.message || 'ذخیره انجام نشد.', 'status-error');
  } finally {
    sellerPlanToggle.disabled = false;
    sellerPlanToggleSave && (sellerPlanToggleSave.disabled = false);
    sellerPlanToggleRefresh && (sellerPlanToggleRefresh.disabled = false);
  }
}





// تابع debounce برای جلوگیری از درخواست‌های مکرر موقع تایپ (۵۰۰ میلی‌ثانیه)
function debounce(fn, delay = 500) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}


// تابع normalize phone (مشترک برای فرانت)
function normalizePhone(p) {
  if (!p) return null;
  p = p.replace(/\D/g, '');  // حذف غیرعددی
  if (p.length === 10 && p.startsWith('9')) p = '0' + p;
  return (p.length === 11 && p.startsWith('09')) ? p : null;
}


/* ---------- 1) خواندن قیمت‌ها از سرور ---------- */
async function loadPlanPrices() {
  try {
    let phone = document.getElementById('seller-phone-plans').value.trim();
    phone = normalizePhone(phone);
    let url = `${ADMIN_API_BASE}/plans`;
    if (phone) {
      url += `?sellerPhone=${encodeURIComponent(phone)}`;
    }

    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(await res.text());

    const { plans = {}, meta = {} } = await res.json();
    planCache = plans;

    PLAN_SLUGS.forEach(slug => {
      const refs = planFormRefs[slug];
      const plan = plans[slug] || {};
      const normalizedVariant = normalizeBadgeVariant(plan.badgeVariant || plan.badge?.variant);
      const badgeLabel = (plan.badgeLabel ?? plan.badge?.label ?? '').trim();
      const badgeVisible = plan.badgeVisible ?? plan.badge?.visible ?? !!badgeLabel;
      if (refs.title) refs.title.value = plan.title || '';
      if (refs.price) refs.price.value = plan.price ?? '';
      if (refs.duration) refs.duration.value = plan.durationDays ?? '';
      if (refs.description) refs.description.value = plan.description || '';
      if (refs.features) {
        const features = Array.isArray(plan.features) ? plan.features.filter(Boolean) : [];
        refs.features.value = features.join('\n');
      }
      if (refs.badgeLabel) refs.badgeLabel.value = badgeLabel;
      if (refs.badgeVariant) refs.badgeVariant.value = normalizedVariant;
      if (refs.badgeVisible) refs.badgeVisible.checked = !!badgeVisible && !!badgeLabel;
      updateBadgePreview(slug, {
        badgeLabel,
        badgeVariant: normalizedVariant,
        badgeVisible: !!badgeVisible && !!badgeLabel
      });
      if (refs.source) {
        refs.source.textContent = formatPlanOrigin(plan.origin, meta.sellerPhone || phone);
      }
      if (refs.updated) {
        refs.updated.textContent = plan.lastUpdatedAt ? formatFeatureDate(plan.lastUpdatedAt) : '—';
      }
    });

    if (phone && !Object.values(plans).some(p => p && p.origin === 'seller-override')) {
      showPlansMsg('قیمت و جزئیات اختصاصی برای این فروشنده تعریف نشده؛ از پلن عمومی استفاده می‌شود.', true, phone);
    }
  } catch (err) {
    console.error('خطا در دریافت قیمت پلن‌ها:', err);
    showPlansMsg('❌ خطا در دریافت پلن‌ها!', false);
  }
}

/* ---------- 2) ذخیره قیمت‌ها روی سرور ---------- */
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return '';
}

async function savePlanPrices(e) {
  e.preventDefault();

  const plansPayload = {};

  for (const slug of PLAN_SLUGS) {
    const refs = planFormRefs[slug];
    if (!refs || !refs.price) continue;

    const title = (refs.title?.value || '').trim();
    const planName = refs.title?.placeholder || slug;
    if (!title) {
      showPlansMsg(`عنوان پلن ${planName} را وارد کنید.`, false);
      return;
    }
    if (title.length > 120) {
      showPlansMsg(`عنوان پلن ${planName} نمی‌تواند بیش از ۱۲۰ کاراکتر باشد.`, false);
      return;
    }

    const price = Number(refs.price.value);
    if (!Number.isFinite(price) || price <= 0) {
      showPlansMsg(`قیمت پلن ${slug} نامعتبر است.`, false);
      return;
    }

    const duration = Number(refs.duration?.value);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 3650) {
      showPlansMsg(`مدت زمان پلن ${slug} باید بین ۱ تا ۳۶۵۰ روز باشد.`, false);
      return;
    }

    const description = (refs.description?.value || '').trim();
    const features = sanitizeFeaturesInput(refs.features?.value || '');

    const badgeLabel = (refs.badgeLabel?.value || '').trim();
    if (badgeLabel.length > 60) {
      showPlansMsg(`عنوان برچسب پلن ${planName} باید حداکثر ۶۰ کاراکتر باشد.`, false);
      return;
    }
    const badgeVariant = normalizeBadgeVariant(refs.badgeVariant?.value);
    const badgeVisible = !!(refs.badgeVisible ? refs.badgeVisible.checked : badgeLabel);
    const effectiveBadgeVisible = badgeVisible && !!badgeLabel;

    plansPayload[slug] = {
      title,
      price,
      durationDays: duration,
      description,
      features,
      badgeLabel,
      badgeVariant,
      badgeVisible: effectiveBadgeVisible
    };
  }

  if (!Object.keys(plansPayload).length) {
    showPlansMsg('هیچ داده‌ای برای ذخیره ارسال نشد.', false);
    return;
  }

  const body = { plans: plansPayload };


  const rawPhone = document.getElementById('seller-phone-plans').value.trim();
  const phone    = normalizePhone(rawPhone);
  if (rawPhone && !phone) {
    showPlansMsg('شماره موبایل نامعتبر است.', false);
    return;
  }

  if (phone && !(await sellerExists(phone))) {
    showPlansMsg('فروشنده‌ای با این شماره وجود ندارد.', false);
    return;
  }

  if (phone) body.sellerPhone = phone;

  try {
    const token = getCookie('admin_token') || getCookie('access_token');

    const res = await fetch(`${ADMIN_API_BASE}/plans/admin`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': 'Bearer ' + token })
      },
      credentials: 'include',
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.message || await res.text());
    }

    await loadPlanPrices();
    showPlansMsg('✅ ' + (data.message || 'پلن‌ها با موفقیت ذخیره شدند.'), true, phone);
    openPlanSaveModal();
  } catch (err) {
    console.error('خطا در ذخیره قیمت‌ها:', err);
    showPlansMsg('❌ ' + err.message, false, phone);
  }
}


/* ---------- 3) نمایش پیام موفقیت / خطا ---------- */
function showPlansMsg(txt, ok, phone = '') {
  if (!plansMsg) return;
  plansMsg.textContent = txt + (phone ? ` (${phone})` : '');
  plansMsg.classList.add('is-visible');
  plansMsg.style.background = ok ? '#ecfdf5' : '#fee2e2';
  plansMsg.style.color = ok ? '#047857' : '#b91c1c';
  clearTimeout(showPlansMsg.timer);
  showPlansMsg.timer = setTimeout(() => {
    plansMsg.classList.remove('is-visible');
  }, 3200);
}

/* ---------- 4) اتصال رویدادها ---------- */
if (document.getElementById('plansForm')) {
  loadPlanPrices();                                   // بارگذاری اولیه
  document.getElementById('plansForm')
          .addEventListener('submit', savePlanPrices); // ذخیره روی بک‌اند

  // listener روی input شماره تلفن برای reload موقع تغییر
  document.getElementById('seller-phone-plans')
          .addEventListener('input', debounce(loadPlanPrices));

  PLAN_SLUGS.forEach(slug => {
    const refs = planFormRefs[slug];
    if (!refs) return;
    refs.badgeLabel?.addEventListener('input', () => updateBadgePreview(slug));
    refs.badgeVariant?.addEventListener('change', () => updateBadgePreview(slug));
    refs.badgeVisible?.addEventListener('change', () => updateBadgePreview(slug));
  });

  if (sellerPlanToggle) {
    loadSellerPlanFeatureFlag();
    sellerPlanToggleSave && sellerPlanToggleSave.addEventListener('click', saveSellerPlanFeatureFlag);
    sellerPlanToggleRefresh && sellerPlanToggleRefresh.addEventListener('click', () => loadSellerPlanFeatureFlag(true));
    sellerPlanToggle.addEventListener('change', () => {
      const pendingEnabled = !!sellerPlanToggle.checked;
      setSellerPlanStatus(
        pendingEnabled ? 'فعال (در انتظار ذخیره)' : 'غیرفعال (در انتظار ذخیره)',
        pendingEnabled ? 'status-on' : 'status-off'
      );
    });
  }
}







const adInputs = {
  'ad_search'   : document.getElementById('ad_search'),
  'ad_home'     : document.getElementById('ad_home'),
  'ad_products' : document.getElementById('ad_products')
};
const adsMsg = document.getElementById('adsMsg');

// ---------- 2) خواندن قیمت‌ تبلیغات ----------
async function loadAdsPrices() {
  try {
    let phone = document.getElementById('seller-phone-ads').value.trim();
    phone = normalizePhone(phone);
    let url = `${ADMIN_API_BASE}/adPlans`;
    if (phone) {
      url += `?sellerPhone=${encodeURIComponent(phone)}`;
    }
    const res  = await fetch(url, { credentials: 'include' });
    const json = await res.json();              // { adplans: { search:12000, … } }
    const prices = json.adplans || {};
    Object.keys(adInputs).forEach(k => {
      adInputs[k].value = prices[k] ?? '';
    });

    // اگر همه خالی (یعنی override نداره)، پیام بدید
    if (phone && !Object.values(prices).some(p => p !== null)) {
      showAdsMsg('قیمت اختصاصی برای این فروشنده تعریف نشده؛ از قیمت عمومی استفاده می‌شود.', true, phone);
    }
  } catch (err) {
    console.error('❌ خطا در دریافت قیمت تبلیغات', err);
    showAdsMsg('خطا در دریافت قیمت تبلیغات!', false);
  }
}

// ---------- 3) ذخیره قیمت تبلیغات ----------
async function saveAdsPrices(e) {
  e.preventDefault();
  // ۱) payload
  const prices = {};
  Object.keys(adInputs).forEach(k => {
    const val = Number(adInputs[k].value);
    if (!Number.isNaN(val) && val > 0) prices[k] = val;
  });

  if (!Object.keys(prices).length) {
    showAdsMsg('هیچ قیمت معتبری ارسال نشد', false);
    return;
  }

  const body = { prices };


  const rawPhone   = document.getElementById('seller-phone-ads').value.trim();
  let sellerPhone  = normalizePhone(rawPhone);
  if (rawPhone && !sellerPhone) {
    showAdsMsg('شماره موبایل نامعتبر است.', false);
    return;
  }

  if (sellerPhone && !(await sellerExists(sellerPhone))) {
    showAdsMsg('فروشنده‌ای با این شماره وجود ندارد.', false);
    return;
  }


  if (sellerPhone) body.sellerPhone = sellerPhone;

  // ۲) توکن
  const token = getCookie('admin_token') || getCookie('access_token');

  try {
    // ۳) PUT
    const res = await fetch(`${ADMIN_API_BASE}/adPlans/admin`, {
      method: 'PUT',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': token ? 'Bearer ' + token : ''
      },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.message || await res.text());
    }

    // بعد از ذخیره موفق، قیمت‌ها رو reload کن
    await loadAdsPrices();
    showAdsMsg('✅ ' + (data.message || 'قیمت تبلیغات با موفقیت ذخیره شد.'), true, sellerPhone);
  } catch (err) {
    console.error('❌ خطا در ذخیره قیمت تبلیغات', err);
    showAdsMsg('❌ ' + err.message, false, sellerPhone);
  }
}

// ---------- 4) نمایش پیام ----------
function showAdsMsg (txt, ok, phone = '') {
  adsMsg.textContent      = txt + (phone ? ` (اختصاصی برای ${phone})` : ' (عمومی)');
  adsMsg.style.display    = 'block';
  adsMsg.style.background = ok ? '#e0fdfa' : '#fee2e2';
  adsMsg.style.color      = ok ? '#10b981' : '#b91c1c';
  setTimeout(() => adsMsg.style.display = 'none', 3000);
}

/* ---------- 5) اتصال رویدادها ---------- */
if (document.getElementById('adsForm')) {
  loadAdsPrices();                                   // بارگذاری اولیه
  document.getElementById('adsForm')
          .addEventListener('submit', saveAdsPrices);// ذخیره روی بک‌اند
  
  // listener روی input شماره تلفن برای reload موقع تغییر
  document.getElementById('seller-phone-ads')
          .addEventListener('input', debounce(loadAdsPrices));
}







// ─── بالای بخش "نمایش کارت‌ها و جداول" ───
// ─── بالای بخش "نمایش کارت‌ها و جداول" ───
// ─── در ابتدای <script> (جایی که پیام‌ها خالی تعریف شده‌اند) ───
// ─── مدیریت پیام‌ها در پنل ادمین ───

// ───────────────────────────────────────


// ایجاد مدال HTML
const modalWrapper = document.createElement('div');
modalWrapper.id = 'chatModal';
modalWrapper.innerHTML = `
  <div class="modal-overlay" onclick="closeModal()"></div>
  <div class="modal-content">
    <h3>گفتگو</h3>
    <div id="chatMessages" class="chat-messages"></div>
    
    <div class="chat-input-area">
      <textarea id="chatReplyInput" rows="2" placeholder="پیام خود را بنویسید..."></textarea>
      <button onclick="sendAdminMessage()">ارسال</button>
      <!-- ↓ دکمهٔ مسدودسازی ↓ -->
      <button class="action-btn block" onclick="blockCurrentSender()">مسدودسازی فرستنده</button>
      <button class="action-btn unblock" id="unblockBtn" onclick="unblockCurrentSender()" style="display:none">آزاد کردن</button>
      <span id="blockedBadge" class="blocked-badge" style="display:none">مسدود شده</span>
    </div>

    <button class="modal-close" onclick="closeModal()">بستن</button>
  </div>
`;

document.body.appendChild(modalWrapper);

// متغیر کمکی
let currentChatId = null;

// باز کردن مدال
window.openChatModal = async function (chatId) {
  currentChatId = chatId;
  const chat = messagesList.find(c => c._id === chatId);
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  document.getElementById('chatReplyInput').disabled = false;
  document.getElementById('blockedBadge').style.display = 'none';
  document.getElementById('unblockBtn').style.display = 'none';
  const blockBtn = document.querySelector('#chatModal .action-btn.block');
  if (blockBtn) blockBtn.style.display = 'inline-block';

  if (chat && chat.blockedByAdmin) {
    document.getElementById('chatReplyInput').disabled = true;
    document.getElementById('blockedBadge').style.display = 'inline-block';
    document.getElementById('unblockBtn').style.display = 'inline-block';
    if (blockBtn) blockBtn.style.display = 'none';
  }

  // 🟢 اگر پیام فروشنده یا کاربری نخونده وجود داره، به سرور اطلاع بده که خوانده شدند
  if (chat) {
    const unreadMsgIds = (chat.messages || [])
      .filter(m => (m.from === 'seller' || m.from === 'user') && !m.read)
      .map(m => m._id)
      .filter(Boolean);

    if (unreadMsgIds.length > 0) {
      try {
        const token = getCookie('admin_token') || getCookie('access_token');
        await fetch(`${ADMIN_API_BASE}/chats/${chatId}/mark-read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: 'Bearer ' + token })
          },
          credentials: 'include',
          body: JSON.stringify({ messageIds: unreadMsgIds })
        });
        // توی لیست محلی هم برو پیام‌ها رو خوانده‌شده کن
        chat.messages.forEach(m => {
          if (unreadMsgIds.includes(m._id)) m.readByAdmin = true;
          if (unreadMsgIds.includes(m._id)) m.read = true;
        });
        updateSidebarCounts(); // شمارنده پیام آپدیت شه
        renderMessages();      // جدول پیام‌ها رفرش شه
      } catch (e) {
        console.warn('خطا در خواندن پیام‌ها:', e);
      }
    }
  }

  if (!chat || !chat.messages?.length) {
    container.innerHTML = '<p style="text-align:center;color:#888">پیامی وجود ندارد.</p>';
  } else {
    chat.messages.forEach(msg => {
     const sender = getSenderName(chat, msg);


      const date = new Date(msg.createdAt || msg.date).toLocaleString('fa-IR', {
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const div = document.createElement('div');
      div.className = 'chat-bubble ' + msg.from;
      div.innerHTML = `
        <div class="sender">${sender}</div>
        <div class="text">${msg.text || '-'}</div>
        <div class="time">${date}</div>`;
      container.appendChild(div);
    });
  }

  document.getElementById('chatModal').classList.add('show');
  document.getElementById('chatReplyInput').focus();

  setTimeout(() => {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 100);
};


// بستن مدال
window.closeModal = function () {
  document.getElementById('chatModal').classList.remove('show');
  document.getElementById('chatReplyInput').value = '';
  currentChatId = null;
};

// ارسال پیام از طرف ادمین
// ارسال پیام از طرف ادمین در مودال گفتگو
// ─── در بخش <script> پنل ادمین ───
// ارسال پیام از طرف ادمین در مودال گفتگو
// در فایل JS فرانت-ند (مثلاً public/js/main.js یا داخل تگ <script> در HTML)
// ارسال پیام از طرف ادمین در مودال گفتگو
window.sendAdminMessage = async function () {
  const text = document.getElementById('chatReplyInput').value.trim();
  if (!text)          return alert('متن پیام را وارد کنید.');
  if (!currentChatId) return alert('چت انتخاب نشده است.');

  try {
    const res = await fetch(`${ADMIN_API_BASE}/chats/${currentChatId}/admin-reply`, {
      method: 'POST',
      credentials: 'include', // ارسال کوکی‌های HttpOnly مثل admin_token
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'خطا در ارسال پیام.');

    // بروزرسانی رابط کاربری بعد از ارسال موفق
    const idx = messagesList.findIndex(c => c._id === currentChatId);
    if (idx !== -1) messagesList[idx] = data;

    openChatModal(currentChatId); // مودال را رفرش کن
    document.getElementById('chatReplyInput').value = '';
    updateSidebarCounts();

  } catch (err) {
    console.error('❌ sendAdminMessage error:', err);
    alert('❌ ' + err.message);
  }
};








// بستن مدال با کلید ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    closeSellerModal();
    closeAdOrderModal();
  }
});



document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('broadcastHeader');
  const card   = document.getElementById('broadcastCard');

  if (header && card) {
    header.addEventListener('click', () => {
      card.classList.toggle('collapsed');
    });
  }

  initCategoryManager();
});





/**
 * مسدودسازی فرستندهٔ آخرین پیام در چت جاری
 */
async function blockCurrentSender() {
  if (!currentChatId) return alert('شناسهٔ چت پیدا نشد.');
  const chat = messagesList.find(c => c._id === currentChatId) || {};
  const targetRole = chat.sellerId ? 'seller' : 'user';
  const targetId   = chat.sellerId || chat.customerId || chat.userId;
  const label      = targetRole === 'seller' ? 'فروشنده' : 'مشتری';

  if (!targetId) return alert('شناسه کاربر پیدا نشد.');
  if (!confirm(`آیا مطمئن هستید که می‌خواهید این ${label} را مسدود کنید؟`)) return;

  try {
    console.log('blockCurrentSender ->', { targetId, targetRole });
    const res = await fetch(`${ADMIN_API_BASE}/chats/block-target`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ targetId, targetRole })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در مسدودسازی');

    alert('✅ ' + (data.message || 'کاربر با موفقیت مسدود شد.'));
    document.getElementById('chatReplyInput').disabled = true;
    document.getElementById('blockedBadge').style.display = 'inline-block';
    await fetchMessages();
  } catch (err) {
    console.error('❌ blockCurrentSender error:', err);
    alert('❌ ' + err.message);
  }
}

async function unblockCurrentSender() {
  if (!currentChatId) return alert('شناسهٔ چت پیدا نشد.');
  const chat = messagesList.find(c => c._id === currentChatId) || {};
  const targetRole = chat.sellerId ? 'seller' : 'user';
  const targetId   = chat.sellerId || chat.customerId || chat.userId;
  const label      = targetRole === 'seller' ? 'فروشنده' : 'مشتری';

  if (!targetId) return alert('شناسه کاربر پیدا نشد.');
  if (!confirm(`آیا مطمئن هستید که می‌خواهید این ${label} را آزاد کنید؟`)) return;

  try {
    console.log('unblockCurrentSender ->', { targetId, targetRole });
    const res = await fetch(`${ADMIN_API_BASE}/chats/unblock-target`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ targetId, targetRole })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در رفع مسدودی');

    alert('✅ ' + (data.message || 'کاربر آزاد شد.'));
    await fetchMessages();
    openChatModal(currentChatId);
  } catch (err) {
    console.error('❌ unblockCurrentSender error:', err);
    alert('❌ ' + err.message);
  }
}



async function sendBroadcastMessage() {
  const target = document.querySelector('#broadcastTarget').value;
  const text   = document.querySelector('#broadcastText').value.trim();
  const status = document.querySelector('#broadcastStatus');

  if (!text) {
    status.style.color = '#f43f5e';
    status.textContent = 'متن پیام نمی‌تواند خالی باشد.';
    return;
  }
  status.style.color = '#888';
  status.textContent = '⏳ در حال ارسال...';

  try {
    const res = await fetch(`${ADMIN_API_BASE}/chats/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ target, text })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'خطا در ارسال پیام همگانی');
    status.style.color = '#10b981';
    status.textContent = `✅ پیام با موفقیت به ${data.sent || 0} نفر ارسال شد.`;
    document.querySelector('#broadcastText').value = '';
  } catch (err) {
    console.error('❌ sendBroadcastMessage error:', err);
    status.style.color = '#f43f5e';
    status.textContent = '❌ ' + err.message;
  }
}




async function fetchUnreadCountAndUpdateBadge() {
  try {
   const res = await fetch(`${ADMIN_API_BASE}/chats/all`, {
  credentials: 'include'
});
    if (!res.ok) throw new Error("خطا در شمارش پیام‌ها");
    const data = await res.json();
    const chats = Array.isArray(data) ? data : (data.chats || []);
    let total = 0;
    chats.forEach(chat => {
      if (Array.isArray(chat.messages)) {
        total += chat.messages.filter(
          m => (m.from === 'seller' || m.from === 'user') && !m.read
        ).length;
      }
    });
    document.getElementById('count-messages').textContent = total > 0 ? total : '';
    document.getElementById('header-messages-count').textContent = total > 0 ? `(${total} پیام جدید)` : '';
  } catch (e) {
    document.getElementById('count-messages').textContent = '';
    document.getElementById('header-messages-count').textContent = '';
  }
}

function startBadgePolling() {
  if (badgeInterval) clearInterval(badgeInterval);
  fetchUnreadCountAndUpdateBadge();
  badgeInterval = setInterval(fetchUnreadCountAndUpdateBadge, 7000); // هر ۷ ثانیه یکبار
}
startBadgePolling();

function cloneAndAppendScript(oldScript, scriptKey) {
  const newScript = document.createElement('script');

  Array.from(oldScript.attributes).forEach(attr => {
    if (attr.name === 'data-external-section') return;
    newScript.setAttribute(attr.name, attr.value);
  });

  if (!oldScript.src) {
    newScript.textContent = oldScript.textContent || '';
  }

  if (scriptKey) {
    newScript.dataset.externalSection = scriptKey;
  }

  document.body.appendChild(newScript);
}

function loadExternalPanel(panelId, url, {
  loadingMessage = 'در حال بارگیری محتوا...',
  errorMessage = 'خطا در بارگیری محتوا.',
  scriptKey
} = {}) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  panel.innerHTML = `<p style="text-align:center;color:#888">${loadingMessage}</p>`;

  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);

  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;

    if (xhr.status === 200) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xhr.responseText, 'text/html');

      const headElements = doc.querySelectorAll('head > *');
      headElements.forEach(el => {
        if (el.tagName === 'LINK' || el.tagName === 'STYLE' || el.tagName === 'SCRIPT') {
          const href = el.getAttribute('href');
          const src = el.getAttribute('src');
          const selectors = [];
          if (href) selectors.push(`[href="${href}"]`);
          if (src) selectors.push(`[src="${src}"]`);

          if (!selectors.length) {
            document.head.appendChild(el.cloneNode(true));
          } else if (!document.querySelector(selectors.join(', '))) {
            document.head.appendChild(el.cloneNode(true));
          }
        }
      });

      panel.innerHTML = doc.body.innerHTML;

      if (scriptKey) {
        document.querySelectorAll(`script[data-external-section="${scriptKey}"]`).forEach(s => s.remove());
      }

      const scripts = doc.querySelectorAll('script');
      scripts.forEach(oldScript => {
        cloneAndAppendScript(oldScript, scriptKey);
      });
    } else {
      panel.innerHTML = `<p style="text-align:center;color:#ef4444">${errorMessage}</p>`;
    }
  };

  xhr.send();
}

// لود محتوای آمار روزانه با AJAX
function loadDailyVisContent() {
  loadExternalPanel('daily-visits-panel', 'admin-dailyVis.html', {
    loadingMessage: 'در حال بارگیری محتوا...',
    errorMessage: 'خطا در بارگیری محتوا. مسیر فایل رو چک کن یا صفحه رو رفرش کن.',
    scriptKey: 'daily-visits'
  });
}

// لود محتوای داشبورد درآمد با AJAX
function loadIncomeInsightsContent() {
  loadExternalPanel('income-insights-panel', 'income-insights.html', {
    loadingMessage: 'در حال آماده‌سازی داشبورد درآمد...',
    errorMessage: 'خطا در بارگیری داشبورد درآمد. مسیر فایل را بررسی کنید.',
    scriptKey: 'income-insights'
  });
}

// لود محتوای کارت‌های صفحه اصلی با AJAX
function loadHomeSectionContent() {
  loadExternalPanel('home-section-panel', 'home-section.html', {
    loadingMessage: 'در حال بارگیری محتوا...',
    errorMessage: 'خطا در بارگیری محتوای کارت‌های صفحه اصلی.',
    scriptKey: 'home-section'
  });
}

// لود محتوای گزارش‌ها با AJAX
// ─── تابع بهبودیافته برای لود محتوای گزارشات ───
// ─── ۱) تابع بارگذاری AJAX گزارش‌ها ───
// ─── 1) تابع AJAX برای لود گزارش‌ها ─────────────────────────
/* ──────────────────────────────────────────────────────────────
   گزارش‌ها (reports.html) – بارگذاری داینامیک با AJAX
   این بلوک را در همان <script> اصلی داشبورد قرار بده و
   نسخه‌های قدیمی loadReportsContent / loadDefaultReportsContent
   را کاملاً حذف کن.                                          
──────────────────────────────────────────────────────────────── */

function loadReportsContent () {
  const panel = panels['reports'];

  /* 1) پیام «در حال بارگیری…» */
  panel.innerHTML =
    '<p style="text-align:center;color:#888">در حال بارگیری گزارش‌ها…</p>';

  const xhr = new XMLHttpRequest();
  /* فایل reports.html در همان پوشهٔ داشبورد است */
  xhr.open('GET', 'reports.html', true);
  xhr.timeout = 5000;                   // ۵ ثانیه مهلت

  xhr.onreadystatechange = () => {
    if (xhr.readyState !== 4) return;

    if (xhr.status === 200) {
      /* 2) Parse و تزریق محتواى فایل */
      const doc = new DOMParser()
        .parseFromString(xhr.responseText, 'text/html');

      /* 3) افزودن CSS / لینک‌ها به <head> (اگر قبلاً نبودند) */
      doc.head.querySelectorAll('link,style').forEach(el => {
        if (el.tagName === 'LINK') {
          if (!document.querySelector(`link[href="${el.href}"]`)) {
            document.head.appendChild(el.cloneNode(true));
          }
        } else {
          document.head.appendChild(el.cloneNode(true));
        }
      });

      /* 4) قرار دادن بدنهٔ فایل در پنل «reports» */
      panel.innerHTML = doc.body.innerHTML;

      /* 5) اجرای تمام <script>‌های reports.html */
      doc.querySelectorAll('script').forEach(old => {
        cloneAndAppendScript(old);
      });

    } else {
      loadDefaultReportsContent();   // فایل پیدا نشد یا خطای HTTP
    }
  };

  xhr.onerror   = loadDefaultReportsContent;
  xhr.ontimeout = loadDefaultReportsContent;
  xhr.send();
}

/* 2) محتوای پیش‌فرض در صورت عدم دسترسی به reports.html */
function loadDefaultReportsContent () {
  const panel = panels['reports'];
  panel.innerHTML = `
    <div style="text-align:center;padding:2rem;">
      <h2 style="color:#10b981;font-weight:900">گزارشی یافت نشد</h2>
      <p style="color:#666">
        نتوانستم <code>reports.html</code> را بارگیری کنم؛
        لطفاً مسیر یا اتصال را بررسی کنید.
      </p>
    </div>`;
}

/* 3) اتصال تب «گزارشات» به این منطق */
panels['reports'] = document.getElementById('reports-panel');

menuLinks.forEach(link => {
  if (link.dataset.section !== 'reports') return;

  let loaded = false;        // فقط اولین بار AJAX بزن
  link.addEventListener('click', () => {
    if (!loaded) {
      loadReportsContent();
      loaded = true;
    }
  });
});




