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









// -------- مدیریت دسته‌بندی‌ها --------
const CATEGORY_API_URL = `${ADMIN_API_BASE}/categories`;
const CATEGORY_CACHE_TTL = 60 * 1000;

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

const DEFAULT_SERVICE_SUBCATEGORIES = [
  'آرایشگاه مردانه',
  'آرایشگاه زنانه',
  'کارواش',
  'کلینیک زیبایی',
  'تعمیر موبایل',
  'آتلیه عکاسی',
  'خیاطی',
  'آرایش حیوانات'
];

let categoryManagerState = {
  categories: [],
  serviceSubcategories: [],
  isLoading: false,
  metadata: {},
  lastFetchedAt: null
};

let categoryManagerInitialised = false;
let categoryFeedbackTimer = null;
let categoryFetchCache = { data: null, expiresAt: 0 };
let categoryFetchPromise = null;

function normaliseCategoryText(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function normaliseCategoryRecord(raw, fallbackType = 'category') {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const name = normaliseCategoryText(raw);
    if (!name) return null;
    return {
      id: `${fallbackType}-${name}`,
      name,
      slug: null,
      type: fallbackType
    };
  }
  if (typeof raw !== 'object') return null;
  const name = normaliseCategoryText(raw.name || raw.title || raw.label || raw.slug || '');
  if (!name) return null;
  const id = raw.id || raw._id || raw.slug || `${fallbackType}-${name}`;
  const type = typeof raw.type === 'string' ? raw.type : fallbackType;
  return {
    id: String(id),
    name,
    slug: raw.slug || null,
    type
  };
}

function sortCategoryRecords(list = []) {
  return [...list].sort((a, b) => {
    const nameA = normaliseCategoryText(a?.name || '');
    const nameB = normaliseCategoryText(b?.name || '');
    return nameA.localeCompare(nameB, 'fa-IR', { sensitivity: 'base' });
  });
}

function listIncludesCaseInsensitive(list = [], value = '') {
  const compare = String(value || '').toLocaleLowerCase('fa-IR');
  return list.some(item => {
    const name = typeof item === 'string' ? item : item?.name;
    return name ? name.toLocaleLowerCase('fa-IR') === compare : false;
  });
}

function invalidateCategoryCache() {
  categoryFetchCache = { data: null, expiresAt: 0 };
}

async function fetchCategoryCollections({ force = false } = {}) {
  if (!force) {
    if (categoryFetchCache.data && categoryFetchCache.expiresAt > Date.now()) {
      return categoryFetchCache.data;
    }
    if (categoryFetchPromise) {
      return categoryFetchPromise;
    }
  }

  const request = fetch(CATEGORY_API_URL, {
    credentials: 'include'
  })
    .then(async response => {
      if (!response.ok) {
        let message = 'خطا در دریافت لیست دسته‌بندی ها.';
        try {
          const payload = await response.json();
          if (payload?.message) {
            message = payload.message;
          }
        } catch (err) {
          const text = await response.text();
          if (text) message = text;
        }
        throw new Error(message);
      }
      const payload = await response.json();
      const categories = Array.isArray(payload?.categories)
        ? payload.categories.map(item => normaliseCategoryRecord(item, 'category')).filter(Boolean)
        : [];
      const serviceSubcategories = Array.isArray(payload?.serviceSubcategories)
        ? payload.serviceSubcategories.map(item => normaliseCategoryRecord(item, 'service-subcategory')).filter(Boolean)
        : [];
      const metadata = payload?.metadata || {};
      const result = {
        categories: sortCategoryRecords(categories),
        serviceSubcategories: sortCategoryRecords(serviceSubcategories),
        metadata
      };
      categoryFetchCache = {
        data: result,
        expiresAt: Date.now() + CATEGORY_CACHE_TTL
      };
      return result;
    })
    .finally(() => {
      categoryFetchPromise = null;
    });

  categoryFetchPromise = request;
  return request;
}

async function createCategoryRemote(name, type) {
  const response = await fetch(CATEGORY_API_URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'ثبت دسته‌بندی با خطا مواجه شد.');
  }
  return normaliseCategoryRecord(payload?.data || { name, type });
}

async function deleteCategoryRemote(identifier) {
  const response = await fetch(CATEGORY_API_URL, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identifier)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'حذف دسته‌بندی با خطا مواجه شد.');
  }
  return normaliseCategoryRecord(payload?.data || identifier);
}

function applyCategoryLists(categories = [], serviceSubcategories = [], metadata = {}) {
  categoryManagerState.categories = sortCategoryRecords(categories);
  categoryManagerState.serviceSubcategories = sortCategoryRecords(serviceSubcategories);
  categoryManagerState.metadata = metadata || {};
  categoryManagerState.lastFetchedAt = metadata?.fetchedAt || new Date().toISOString();
}

function applyFallbackCategoryData() {
  if (categoryManagerState.categories.length || categoryManagerState.serviceSubcategories.length) {
    return;
  }
  const fallbackCategories = DEFAULT_CATEGORIES.map(name => normaliseCategoryRecord(name, 'category')).filter(Boolean);
  const fallbackServices = DEFAULT_SERVICE_SUBCATEGORIES.map(name => normaliseCategoryRecord(name, 'service-subcategory')).filter(Boolean);
  applyCategoryLists(fallbackCategories, fallbackServices, { fallback: true });
}

function renderChipList(container, items = [], { removable = true, type = 'category', emptyMessage = '' } = {}) {
  if (!container) return;
  container.innerHTML = '';

  if (!items.length) {
    container.classList.add('empty');
    if (emptyMessage) {
      const placeholder = document.createElement('div');
      placeholder.className = 'chip-placeholder text-sm text-gray-500';
      placeholder.textContent = emptyMessage;
      container.appendChild(placeholder);
    }
    return;
  }

  container.classList.remove('empty');
  items.forEach(item => {
    const labelText = normaliseCategoryText(item?.name || item);
    if (!labelText) return;
    const chip = document.createElement('div');
    chip.className = 'chip-item';
    const label = document.createElement('span');
    label.textContent = labelText;
    chip.appendChild(label);
    if (removable) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.action = 'remove-category';
      btn.dataset.type = type;
      btn.dataset.name = labelText;
      btn.dataset.id = item?.id || item?._id || item?.slug || labelText;
      btn.setAttribute('aria-label', `حذف ${labelText}`);
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
    select.innerHTML = '';
    if (!categoryManagerState.categories.length) {
      const option = document.createElement('option');
      option.textContent = 'دسته‌ای تعریف نشده است';
      option.disabled = true;
      option.selected = true;
      select.appendChild(option);
      select.disabled = true;
    } else {
      const placeholder = document.createElement('option');
      placeholder.textContent = 'انتخاب دسته';
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);
      categoryManagerState.categories.forEach(item => {
        const option = document.createElement('option');
        option.value = item.name;
        option.textContent = item.name;
        option.dataset.categoryId = item.id;
        if (item.slug) option.dataset.slug = item.slug;
        select.appendChild(option);
      });
      select.disabled = false;
    }
  }
  if (chips) {
    renderChipList(chips, categoryManagerState.serviceSubcategories, {
      removable: false,
      type: 'service-subcategory',
      emptyMessage: 'زیرگروهی ثبت نشده است.'
    });
  }
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

async function handleChipRemoval(event) {
  const button = event.target.closest('button[data-action="remove-category"]');
  if (!button) return;

  if (categoryManagerState.metadata?.fallback) {
    showCategoryFeedback('error', 'در حال حاضر امکان ویرایش بدون اتصال به سرور وجود ندارد.');
    return;
  }

  const type = button.dataset.type || 'category';
  const name = button.dataset.name;
  const id = button.dataset.id;
  if (!name) return;
  const label = type === 'service-subcategory' ? 'زیرگروه' : 'دسته';

  if (!confirm(`آیا از حذف ${label} «${name}» مطمئن هستید؟`)) return;

  button.disabled = true;
  button.classList.add('loading');
  try {
    const identifier = { type, name };
    if (id && /^[a-f\d]{24}$/i.test(id)) {
      identifier.id = id;
    }
    await deleteCategoryRemote(identifier);
    invalidateCategoryCache();
    if (type === 'service-subcategory') {
      categoryManagerState.serviceSubcategories = categoryManagerState.serviceSubcategories.filter(item => item.id !== identifier.id && item.name !== name);
    } else {
      categoryManagerState.categories = categoryManagerState.categories.filter(item => item.id !== identifier.id && item.name !== name);
    }
    categoryManagerState.metadata = { ...categoryManagerState.metadata, fallback: false };
    categoryManagerState.lastFetchedAt = new Date().toISOString();
    renderCategoryManager();
    showCategoryFeedback('success', `${label} «${name}» حذف شد.`);
  } catch (error) {
    console.error('handleChipRemoval error ->', error);
    showCategoryFeedback('error', error?.message || `حذف ${label} با خطا مواجه شد.`);
  } finally {
    button.disabled = false;
    button.classList.remove('loading');
  }
}

function renderCategoryManager() {
  const categoriesContainer = document.getElementById('categoryManagerList');
  const servicesContainer = document.getElementById('serviceSubcategoryList');
  const loadingMarkup = '<div class="chip-placeholder text-sm text-gray-500">در حال بارگذاری...</div>';

  if (categoriesContainer) {
    if (categoryManagerState.isLoading) {
      categoriesContainer.innerHTML = loadingMarkup;
      categoriesContainer.classList.add('empty');
    } else {
      renderChipList(categoriesContainer, categoryManagerState.categories, {
        removable: true,
        type: 'category',
        emptyMessage: 'دسته‌ای ثبت نشده است.'
      });
    }
  }

  if (servicesContainer) {
    if (categoryManagerState.isLoading) {
      servicesContainer.innerHTML = loadingMarkup;
      servicesContainer.classList.add('empty');
    } else {
      renderChipList(servicesContainer, categoryManagerState.serviceSubcategories, {
        removable: true,
        type: 'service-subcategory',
        emptyMessage: 'زیرگروهی ثبت نشده است.'
      });
    }
  }

  updateCategoryMetrics();
  updateCategoryPreview();
}

async function refreshCategoryManagerState({ force = false, successMessage = '', silent = false } = {}) {
  categoryManagerState.isLoading = true;
  renderCategoryManager();
  try {
    const payload = await fetchCategoryCollections({ force });
    applyCategoryLists(payload.categories, payload.serviceSubcategories, payload.metadata);
    renderCategoryManager();
    if (successMessage) {
      showCategoryFeedback('success', successMessage);
    } else if (!silent) {
      showCategoryFeedback('info', 'لیست دسته‌بندی به‌روز شد.');
    }
  } catch (error) {
    console.error('refreshCategoryManagerState error ->', error);
    applyFallbackCategoryData();
    renderCategoryManager();
    if (!silent) {
      showCategoryFeedback('error', error?.message || 'دریافت اطلاعات دسته‌بندی ناموفق بود.');
    }
  } finally {
    categoryManagerState.isLoading = false;
    renderCategoryManager();
  }
}

function initCategoryManager() {
  if (categoryManagerInitialised) {
    renderCategoryManager();
    return;
  }

  const categoryForm = document.getElementById('categoryAddForm');
  const categoryInput = document.getElementById('categoryNameInput');
  if (categoryForm) {
    const submitBtn = categoryForm.querySelector('button[type="submit"]');
    categoryForm.addEventListener('submit', async event => {
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
      if (categoryManagerState.metadata?.fallback) {
        showCategoryFeedback('error', 'در حالت آفلاین امکان افزودن دسته وجود ندارد.');
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      try {
        const created = await createCategoryRemote(value, 'category');
        invalidateCategoryCache();
        if (created) {
          categoryManagerState.categories = sortCategoryRecords([
            ...categoryManagerState.categories.filter(item => item.id !== created.id),
            created
          ]);
          categoryManagerState.metadata = { ...categoryManagerState.metadata, fallback: false };
          categoryManagerState.lastFetchedAt = new Date().toISOString();
          renderCategoryManager();
          showCategoryFeedback('success', `دسته «${value}» با موفقیت اضافه شد.`);
        }
        categoryForm.reset();
        categoryInput.focus();
      } catch (error) {
        console.error('createCategoryRemote error ->', error);
        showCategoryFeedback('error', error?.message || 'ثبت دسته با خطا مواجه شد.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  const serviceForm = document.getElementById('serviceSubcategoryForm');
  const serviceInput = document.getElementById('serviceSubcategoryInput');
  if (serviceForm) {
    const submitBtn = serviceForm.querySelector('button[type="submit"]');
    serviceForm.addEventListener('submit', async event => {
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
      if (listIncludesCaseInsensitive(categoryManagerState.serviceSubcategories, value)) {
        showCategoryFeedback('error', `زیرگروه «${value}» از قبل وجود دارد.`);
        return;
      }
      if (categoryManagerState.metadata?.fallback) {
        showCategoryFeedback('error', 'در حالت آفلاین امکان افزودن زیرگروه وجود ندارد.');
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      try {
        const created = await createCategoryRemote(value, 'service-subcategory');
        invalidateCategoryCache();
        if (created) {
          categoryManagerState.serviceSubcategories = sortCategoryRecords([
            ...categoryManagerState.serviceSubcategories.filter(item => item.id !== created.id),
            created
          ]);
          categoryManagerState.metadata = { ...categoryManagerState.metadata, fallback: false };
          categoryManagerState.lastFetchedAt = new Date().toISOString();
          renderCategoryManager();
          showCategoryFeedback('success', `زیرگروه «${value}» با موفقیت اضافه شد.`);
        }
        serviceForm.reset();
        serviceInput.focus();
      } catch (error) {
        console.error('createServiceSubcategory error ->', error);
        showCategoryFeedback('error', error?.message || 'ثبت زیرگروه با خطا مواجه شد.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
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
  refreshCategoryManagerState({ force: true, successMessage: 'لیست دسته‌بندی از سرور بارگذاری شد.' });
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

function formatCurrency(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return '—';
  }
  return `${currencyFormatter.format(Math.round(Number(amount)))} تومان`;
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
    const orderId = escapeHtml(getOrderId(order));

    const product = order && typeof order.productId === 'object' && order.productId !== null ? order.productId : null;
    const productBadge = product
      ? `<span class="ad-cell-secondary"><i class="ri-shopping-bag-3-line"></i>${escapeHtml(product.title || 'محصول ویژه')}</span>`
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
        <td>
          <div class="ad-cell-primary">${escapeHtml(sellerName)}</div>
          ${sellerMetaParts.length ? `<div class="ad-cell-secondary">${sellerMetaParts.join('')}</div>` : ''}
        </td>
        <td>
          <span class="ad-plan-pill"><i class="ri-megaphone-line"></i>${escapeHtml(planLabel)}</span>
          ${planLocationBadge}
          ${productBadge}
          <div class="ad-title">${escapeHtml(order.adTitle || order.planTitle || 'بدون عنوان')}</div>
          ${adText}
        </td>
        <td><div class="ad-price">${formatCurrency(order.price)}</div></td>
        <td>
          <div class="ad-date">
            <span><i class="ri-calendar-line"></i> ثبت: ${createdAt}</span>
            ${displayDateHtml}
          </div>
        </td>
        <td>
          <div class="ad-status-cell">
            <span class="ad-status-badge ${statusMeta.className}"><i class="${statusMeta.icon}"></i>${statusMeta.label}</span>
            <div class="ad-status-note">${reviewText}</div>
          </div>
        </td>
        <td>
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
  const saveButton = overlay.querySelector('#adModalSave');
  const deleteButton = overlay.querySelector('#adModalDelete');

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


async function fetchShops() {
  const res = await fetch(ADMIN_API_BASE + '/shops', {
    credentials: 'include'
  });
  const data = await res.json();
  return Array.isArray(data) ? data : (data.shops || data.data || []);
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
const serviceShopsTableBody = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-shops-table tbody') : null;
const serviceShopsLoadingEl = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-shops-loading') : null;
const serviceShopsEmptyEl = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-shops-empty') : null;
const serviceShopsPaginationEl = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-shops-pagination') : null;
const serviceShopsStatusBreakdownEl = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-status-breakdown') : null;
const serviceTopCitiesEl = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-top-cities') : null;
const serviceTopCategoriesEl = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-top-categories') : null;
const serviceRecentListEl = serviceShopsPanelEl ? serviceShopsPanelEl.querySelector('#service-recent-list') : null;
const serviceShopsSummaryCards = serviceShopsPanelEl ? Array.from(serviceShopsPanelEl.querySelectorAll('.service-summary-card')) : [];

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
  if (shop.isFeatured) flags.push('<span class="service-flag featured"><i class="ri-star-smile-line"></i>ویژه</span>');
  if (isPremiumActive(shop)) flags.push('<span class="service-flag premium"><i class="ri-vip-crown-line"></i>پریمیوم</span>');
  if (shop?.bookingSettings?.enabled) flags.push('<span class="service-flag booking"><i class="ri-calendar-check-line"></i>رزرو فعال</span>');
  if (shop.isVisible === false) flags.push('<span class="service-flag hidden"><i class="ri-eye-off-line"></i>پنهان</span>');
  const statusLabel = getServiceStatusLabel(shop.status);
  const statusClass = getServiceStatusClass(shop.status);
  const updated = escapeHtml(formatDateTime(shop.updatedAt || shop.lastReviewedAt || shop.createdAt) || '—');
  const shopUrlAttr = shop.shopUrl ? escapeHtml(shop.shopUrl) : '';

  return `<tr>
    <td>
      <div class="service-shop-name">${name}</div>
      ${metaParts ? `<div class="service-shop-meta">${metaParts}</div>` : ''}
      ${flags.length ? `<div class="service-shop-flags">${flags.join('')}</div>` : ''}
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
        window.open(`/service-seller-panel/index.html?shopurl=${encodeURIComponent(shopUrl)}`, '_blank');
      } else {
        alert('شناسه فروشگاه یافت نشد.');
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
  users:     document.getElementById('users-panel'),
  sellers:   document.getElementById('sellers-panel'),
  'service-shops': document.getElementById('service-shops-panel'),
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
      await ensureServiceShopsLoaded();
    }

    if (section === 'ad-orders') {
      await loadAdOrders();
    }

    if (section === 'categories') {
      initCategoryManager();
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

  sellers.forEach((shop, i) => {
    let countProducts = shop._productsCount;
    let ownerName = shop.ownerName || `${shop.ownerFirstname || ''} ${shop.ownerLastname || ''}`.trim() || "-";
    let shopLink = shop.shopurl
      ? `<a href="/shop.html?shopurl=${shop.shopurl}" target="_blank" style="color:#0ea5e9;text-decoration:underline">${shop.shopurl}</a>`
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
    const eligibilityClass = performance
      ? (performance.canStay ? 'status-eligible' : 'status-ineligible')
      : 'status-neutral';
    const eligibilityText = performance
      ? (performance.canStay ? '✅ مجاز به ادامه فعالیت' : '⛔ امکان ادامه فعالیت در ویترینت وجود ندارد')
      : 'در انتظار ارزیابی ادمین';
    const combinedStatus = `<div class="seller-score-cell-wrap">${scoreBadge}${statusBadge}<span class="seller-status-note ${eligibilityClass}">${eligibilityText}</span></div>`;
    const sid = toIdString(shop.sellerId || shop.seller_id || shop._id || shop._sid || shop.shopurl);
    let tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="seller-cell seller-modal-trigger" style="cursor:pointer;color:#10b981;font-weight:bold">${shop.storename || shop.shopLogoText || '-'}</td>
      <td class="seller-cell seller-modal-trigger" style="cursor:pointer">${ownerName}</td>
      <td class="seller-cell seller-modal-trigger" style="cursor:pointer">${shop.address || shop.shopAddress || '-'}</td>
      <td>${shopLink}</td>
      <td>${countProducts}</td>
      <td>${shop._visits}</td>
      <td class="seller-cell seller-modal-trigger seller-score-cell" data-score-key="${sellerKey || ''}">${combinedStatus}</td>
      <td>
        <button class="action-btn delete">
          <i class="ri-delete-bin-line"></i> حذف
        </button>
      </td>
    `;
    // اتصال ایندکس فروشنده به هر سلول قابل کلیک
    Array.from(tr.querySelectorAll('.seller-cell')).forEach(td=>{
      td.onclick = () => showSellerModal(shop);
    });
    const delBtn = tr.querySelector('.action-btn.delete');
    if (delBtn) {
      delBtn.addEventListener('click', () => deleteSeller(sid));
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

  /* شناسهٔ مطمئن فروشنده */
  const sellerId =
        (shop._id && shop._id.toString())              ||
        (shop.sellerId && String(shop.sellerId))       ||
        (shop._sid && !String(shop._sid).startsWith('shopurl:')
          ? String(shop._sid)
          : '')                                        ||
        (shop.shopurl ? `shopurl:${shop.shopurl}` : '');

  const storeName = shop.storename || shop.shopLogoText || '-';
  const url       = shop.shopurl  || '';
  const phone     =
        shop.phone || shop.mobile ||
        shop.ownerPhone || shop.ownerMobile || '-';
  const sellerScoreKey = resolveSellerKeyFromShop(shop);

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
        <span style="color:#0ea5e9">${storeName}</span>
      </div>

      <div class="seller-modal-row">
        <span class="seller-modal-label">ثبت‌نام:</span>
        <span class="seller-modal-value">${fDate(shop.createdAt)}</span>
      </div>

      <div class="seller-modal-row">
        <span class="seller-modal-label">شماره موبایل:</span>
        <span class="seller-modal-value">${phone}</span>
      </div>

      <div class="seller-modal-row">
        <span class="seller-modal-label">نوع اشتراک:</span>
        <span class="seller-modal-value">${shop.subscriptionType || '-'}</span>
      </div>

      <div class="seller-modal-row">
        <span class="seller-modal-label">تاریخ خرید:</span>
        <span class="seller-modal-value">${fDate(shop.subscriptionStart)}</span>
      </div>

      <div class="seller-modal-row">
        <span class="seller-modal-label">تاریخ پایان:</span>
        <span class="seller-modal-value">${fDate(shop.subscriptionEnd)}</span>
      </div>

      <!-- ردیف پسورد حذف شد -->

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
            data-seller-id="${sellerId}"
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
const planInputs = {
  "1month":  document.getElementById('plan-1month'),
  "3month":  document.getElementById('plan-3month'),
  "12month": document.getElementById('plan-12month'),
  "vitriPlus": document.getElementById('vitriPlusPrice')
};
const plansMsg  = document.getElementById('plansMsg');

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

    const { plans } = await res.json();  // { "1month": ..., "3month": ..., ... }

    // پر کردن فیلدها
    planInputs['1month'].value  = plans['1month']  ?? '';
    planInputs['3month'].value  = plans['3month']  ?? '';
    planInputs['12month'].value = plans['12month'] ?? '';
    planInputs['vitriPlus'].value = plans['vitriPlus'] ?? '';

    // اگر همه خالی (یعنی override نداره)، پیام بدید
    if (phone && !Object.values(plans).some(p => p !== null)) {
      showPlansMsg('قیمت اختصاصی برای این فروشنده تعریف نشده؛ از قیمت عمومی استفاده می‌شود.', true, phone);
    }
  } catch (err) {
    console.error('خطا در دریافت قیمت پلن‌ها:', err);
    showPlansMsg('❌ خطا در دریافت قیمت‌ها!', false);
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

  // آماده‌سازی payload
  const prices = {
    '1month':  Number(planInputs['1month'].value),
    '3month':  Number(planInputs['3month'].value),
    '12month': Number(planInputs['12month'].value),
    'vitriPlus': Number(planInputs['vitriPlus'].value)
  };

  const validPrices = {};
  Object.keys(prices).forEach(k => {
    const val = prices[k];
    if (!Number.isNaN(val) && val > 0) validPrices[k] = val;
  });

  if (!Object.keys(validPrices).length) {
    showPlansMsg('هیچ قیمت معتبری ارسال نشد', false);
    return;
  }

  const body = { prices: validPrices };


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
    showPlansMsg('✅ ' + (data.message || 'قیمت‌ها با موفقیت ذخیره شدند.'), true, phone);
  } catch (err) {
    console.error('خطا در ذخیره قیمت‌ها:', err);
    showPlansMsg('❌ ' + err.message, false, phone);
  }
}


/* ---------- 3) نمایش پیام موفقیت / خطا ---------- */
function showPlansMsg(txt, ok, phone = '') {
  const plansMsg = document.getElementById('plansMsg');
  plansMsg.textContent      = txt + (phone ? ` (اختصاصی برای ${phone})` : ' (عمومی)');
  plansMsg.style.display    = 'block';
  plansMsg.style.background = ok ? '#e0fdfa' : '#fee2e2';
  plansMsg.style.color      = ok ? '#10b981' : '#b91c1c';
  setTimeout(() => plansMsg.style.display = 'none', 3000);
}

/* ---------- 4) اتصال رویدادها ---------- */
if (document.getElementById('plansForm')) {
  loadPlanPrices();                                   // بارگذاری اولیه
  document.getElementById('plansForm')
          .addEventListener('submit', savePlanPrices); // ذخیره روی بک‌اند

  // listener روی input شماره تلفن برای reload موقع تغییر
  document.getElementById('seller-phone-plans')
          .addEventListener('input', debounce(loadPlanPrices));

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
    let url = `${ADMIN_API_BASE}/adplans`;
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
    const res = await fetch(`${ADMIN_API_BASE}/adplans/admin`, {
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
        const newScript = document.createElement('script');
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        if (scriptKey) {
          newScript.dataset.externalSection = scriptKey;
        }
        document.body.appendChild(newScript);
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
        const s = document.createElement('script');
        if (old.src) s.src = old.src;
        else         s.textContent = old.textContent;
        document.body.appendChild(s);
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




