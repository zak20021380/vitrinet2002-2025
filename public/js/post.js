// --- Safe sessionStorage helper (SafeSS) ---
const SafeSS = window.SafeSS || {
  setJSON(key, value) {
    try {
      const str = JSON.stringify(value);
      sessionStorage.setItem(key, str);
      return true;
    } catch (err) {
      console.warn('SafeSS setJSON failed', err);
      return false;
    }
  },
  getJSON(key, fallback = null) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.warn('SafeSS getJSON failed', err);
      return fallback;
    }
  }
};
if (!window.SafeSS) {
  window.SafeSS = SafeSS;
}

// Mobile menu functionality
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const mobileOverlay = document.getElementById('mobile-overlay');
const closeMenuBtn = document.getElementById('close-menu');

function toggleMobileMenu() {
  mobileMenuBtn.classList.toggle('active');
  mobileMenu.classList.toggle('active');
  mobileOverlay.classList.toggle('active');
  document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
}

mobileMenuBtn.addEventListener('click', toggleMobileMenu);
closeMenuBtn.addEventListener('click', toggleMobileMenu);
mobileOverlay.addEventListener('click', toggleMobileMenu);

// Close menu when clicking on a link
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    if (mobileMenu.classList.contains('active')) {
      toggleMobileMenu();
    }
  });
});

// نمایش لحظه‌ای آدرس فروشگاه
document.getElementById("shopurl").addEventListener("input", function (e) {
  let val = this.value.trim();
  // فقط حروف کوچک و عدد؛ بیشتر از 10 کاراکتر اجازه وارد کردن نده
  let cleaned = val.replace(/[^a-z0-9]/g, '').slice(0, 10);
  if (val !== cleaned) {
    this.value = cleaned;
  }
  let prev = document.getElementById("address-preview");
  if (cleaned.length > 0) {
    prev.innerText = "آدرس فروشگاه شما: vitreenet.ir/" + cleaned;
  } else {
    prev.innerText = "آدرس فروشگاه شما: vitreenet.ir/shopgol";
  }
  document.getElementById("shopurl-hint").classList.add("hidden");
});

// Password visibility toggles
const passwordIcons = {
  show: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12c1.5-4 5.25-7.5 9.75-7.5s8.25 3.5 9.75 7.5c-1.5 4-5.25 7.5-9.75 7.5S3.75 16 2.25 12z" /><circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round"></circle></svg>`,
  hide: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223a10.477 10.477 0 0 0-1.72 2.473 2.31 2.31 0 0 0 0 2.608C4.46 16.753 8.08 19.5 12 19.5c1.63 0 3.168-.43 4.542-1.155" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.33 16.63C20.8 15.44 22 13.842 22 12c0-.642-.228-1.27-.655-1.859C19.54 6.621 15.973 4.5 12 4.5c-.977 0-1.927.146-2.836.42" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 0 0-3-3" /><path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18" /></svg>`
};

document.querySelectorAll('.password-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    const input = document.getElementById(targetId);
    if (!input) return;

    const isVisible = btn.getAttribute('data-visible') === 'true';
    input.type = isVisible ? 'password' : 'text';
    btn.setAttribute('data-visible', String(!isVisible));
    btn.setAttribute('aria-pressed', String(!isVisible));
    btn.setAttribute('aria-label', isVisible ? 'نمایش رمز عبور' : 'پنهان کردن رمز عبور');
    btn.innerHTML = isVisible ? passwordIcons.show : passwordIcons.hide;
  });
});

// ریست پیام خطا با تغییر هر فیلد
[
  ["firstname", "firstname-hint"],
  ["lastname", "lastname-hint"],
  ["pass1", "pass-hint"],
  ["pass2", "pass-hint"],
  ["storename", "storename-hint"],
  ["shopurl", "shopurl-hint"],
  ["phone", "phone-hint"],
  ["category", "category-hint"],
  ["address", "address-hint"],
  ["rules", "rules-hint"]
].forEach(function (pair) {
  let el = document.getElementById(pair[0]);
  if (el) {
    el.addEventListener("input", function () {
      document.getElementById(pair[1]).classList.add("hidden");
    });
    if (["category", "rules"].includes(pair[0])) {
      el.addEventListener("change", function () {
        document.getElementById(pair[1]).classList.add("hidden");
      });
    }
  }
});

const API_ORIGIN = window.location.origin.includes('localhost') ? 'http://localhost:5000' : window.location.origin;
const CATEGORY_API_URL = `${API_ORIGIN}/api/categories`;
const CATEGORY_CACHE_KEY = 'post.categories.cache';
const SERVICE_CACHE_KEY = 'post.serviceSubcategories.cache';
const CATEGORY_CACHE_TTL_MS = 1000 * 60 * 30; // 30 دقیقه

// لیست دسته‌های خدماتی برای تشخیص نوع حساب کاربری
const SERVICE_CATEGORIES = ["خدمات", "زیبایی", "تالار و مجالس", "خودرو", "ورزشی"];

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

const categorySelect = document.getElementById("category");
const serviceExamplesContainer = document.getElementById('service-examples');
const serviceExamplesChipsContainer = document.getElementById('service-examples-chips');
const subcatWrapper = document.getElementById("subcategory-wrapper") || serviceExamplesContainer;
const subcatInput = document.getElementById("subcategory");
const subcatChipsContainer = document.getElementById('subcategory-chips') || serviceExamplesChipsContainer;
const categoryState = {
  categories: [],
  serviceSubcategories: []
};
let subcategoryValidationActive = false;

function toIdString(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    if (raw.$oid) return String(raw.$oid);
    if (raw._id) return String(raw._id);
    if (raw.id) return String(raw.id);
  }
  return String(raw);
}

function normaliseCategoryText(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
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

function getCategoryType(item) {
  if (!item) return 'category';
  if (typeof item === 'string') return 'category';
  return item.type || 'category';
}

function normaliseCategoryItem(raw, fallbackType = 'category') {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const name = normaliseCategoryText(raw);
    if (!name) return null;
    return {
      id: '',
      name,
      type: fallbackType,
      isDefault: fallbackType === 'service-subcategory'
        ? DEFAULT_SERVICE_SUBCATEGORY_NAMES.includes(name)
        : DEFAULT_CATEGORIES.includes(name),
      parentId: '',
      parentName: fallbackType === 'service-subcategory'
        ? DEFAULT_SERVICE_PARENT_MAP[name] || ''
        : ''
    };
  }
  const name = normaliseCategoryText(
    raw.name
    || raw.title
    || raw.label
    || raw.desc
    || raw.description
    || ''
  );
  if (!name) return null;
  const id = toIdString(raw._id || raw.id || raw.value || '');
  const type = raw.type || fallbackType;
  const parentId = getCategoryParentId(raw);
  const parentName = getCategoryParentName(raw) || (type === 'service-subcategory'
    ? DEFAULT_SERVICE_PARENT_MAP[name] || ''
    : '');
  return {
    id,
    name,
    type,
    isDefault: typeof raw.isDefault === 'boolean'
      ? raw.isDefault
      : (type === 'service-subcategory'
          ? DEFAULT_SERVICE_SUBCATEGORY_NAMES.includes(name)
          : DEFAULT_CATEGORIES.includes(name)),
    parentId,
    parentName
  };
}

function normaliseCategoryList(list = [], type = 'category') {
  const unique = new Map();
  list.forEach(item => {
    const record = normaliseCategoryItem(item, type);
    if (!record) return;
    const nameKey = record.name.toLocaleLowerCase('fa-IR');
    const parentKey = getCategoryType(record) === 'service-subcategory'
      ? (record.parentId || record.parentName.toLocaleLowerCase('fa-IR'))
      : '';
    const key = parentKey ? `${nameKey}__${parentKey}` : nameKey;
    if (!unique.has(key) || (!unique.get(key).id && record.id)) {
      unique.set(key, record);
    }
  });
  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, 'fa-IR', { sensitivity: 'base' }));
}

function saveCategoryCache(key, list) {
  try {
    if (typeof localStorage === 'undefined') return;
    const payload = {
      items: Array.isArray(list) ? list.map(item => ({
        id: item.id || '',
        name: item.name,
        type: item.type,
        isDefault: !!item.isDefault,
        parentId: item.parentId || '',
        parentName: item.parentName || ''
      })) : [],
      updatedAt: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.warn('saveCategoryCache ->', err);
  }
}

function loadCategoryCache(key, fallback = [], type = 'category') {
  try {
    if (typeof localStorage === 'undefined') {
      return normaliseCategoryList(fallback, type);
    }
    const raw = localStorage.getItem(key);
    if (!raw) {
      return normaliseCategoryList(fallback, type);
    }
    const parsed = JSON.parse(raw);
    const updatedAt = Number(parsed?.updatedAt || 0);
    if (updatedAt && Date.now() - updatedAt > CATEGORY_CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return normaliseCategoryList(fallback, type);
    }
    const list = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
    const normalised = normaliseCategoryList(list, type);
    if (!normalised.length) {
      return normaliseCategoryList(fallback, type);
    }
    return normalised;
  } catch (err) {
    console.warn('loadCategoryCache ->', err);
    return normaliseCategoryList(fallback, type);
  }
}

function renderCategoryOptions(list = []) {
  if (!categorySelect) return;
  const options = normaliseCategoryList(list, 'category');
  categoryState.categories = options;
  const previousOption = categorySelect.options[categorySelect.selectedIndex];
  const previousId = categorySelect.dataset.selectedId || (previousOption && previousOption.dataset.id) || '';
  const previousName = categorySelect.dataset.selectedName || categorySelect.value || '';
  categorySelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = options.length ? 'انتخاب دسته' : 'دسته‌ای یافت نشد';
  categorySelect.appendChild(placeholder);

  let matched = false;
  options.forEach(item => {
    const option = document.createElement('option');
    const id = item.id || '';
    const name = item.name;
    option.value = name;
    option.textContent = name;
    if (id) {
      option.dataset.id = id;
    }
    if (!matched) {
      if (previousId && id && id === previousId) {
        option.selected = true;
        matched = true;
        placeholder.selected = false;
      } else if (!previousId && previousName && name === previousName) {
        option.selected = true;
        matched = true;
        placeholder.selected = false;
      }
    }
    categorySelect.appendChild(option);
  });

  categorySelect.disabled = !options.length;
  if (!matched && options.length) {
    placeholder.selected = true;
  }

  const selectedOption = categorySelect.options[categorySelect.selectedIndex];
  categorySelect.dataset.selectedId = selectedOption?.dataset.id || '';
  categorySelect.dataset.selectedName = selectedOption?.value || '';

  if (!categorySelect.dataset.bound) {
    categorySelect.addEventListener('change', () => {
      const currentOption = categorySelect.options[categorySelect.selectedIndex];
      categorySelect.dataset.selectedId = currentOption?.dataset.id || '';
      categorySelect.dataset.selectedName = currentOption?.value || '';
      updateServiceChipsForSelection();
    });
    categorySelect.dataset.bound = 'true';
  }

  updateServiceChipsForSelection();
}

function highlightServiceChip(value = '') {
  const containers = [subcatChipsContainer, serviceExamplesChipsContainer].filter(Boolean);
  containers.forEach(container => {
    const buttons = container.querySelectorAll('button[data-value]');
    buttons.forEach(btn => {
      btn.classList.remove('bg-[#10b981]', 'text-white', 'border-[#10b981]');
      if (btn.dataset.value === value) {
        btn.classList.add('bg-[#10b981]', 'text-white', 'border-[#10b981]');
      }
    });
  });
}

function setSubcategoryRequiredState({ hasItems = false, selectedValue = '' } = {}) {
  const hint = document.getElementById('subcategory-hint');
  if (subcatWrapper) {
    subcatWrapper.dataset.hasItems = hasItems ? 'true' : 'false';
  }
  if (subcatInput) {
    subcatInput.dataset.required = hasItems ? 'true' : 'false';
  }
  if (!hint) return;
  if (hasItems && !selectedValue && subcategoryValidationActive) {
    hint.innerText = 'لطفاً زیر گروه را انتخاب کنید.';
    hint.classList.remove('hidden');
  } else {
    hint.classList.add('hidden');
  }
}

function handleSubcategorySelection(value = '') {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  if (subcatInput) {
    subcatInput.value = cleaned;
  }
  highlightServiceChip(cleaned);
  const hint = document.getElementById('subcategory-hint');
  if (hint) {
    hint.classList.add('hidden');
  }
  subcategoryValidationActive = false;
  const hasItems = subcatWrapper ? subcatWrapper.dataset.hasItems === 'true' : false;
  setSubcategoryRequiredState({ hasItems, selectedValue: cleaned });
}

function renderServiceChips(list = []) {
  const normalised = Array.isArray(list) ? list : [];
  const hasItems = normalised.length > 0;

  if (serviceExamplesContainer) {
    serviceExamplesContainer.classList.toggle('hidden', !hasItems);
  }
  if (!hasItems && subcatInput) {
    subcatInput.value = '';
  }
  if (!hasItems) {
    subcategoryValidationActive = false;
    highlightServiceChip('');
    setSubcategoryRequiredState({ hasItems, selectedValue: '' });
  }

  if (!subcatChipsContainer) return;

  const selected = subcatInput ? subcatInput.value : '';
  subcatChipsContainer.innerHTML = '';
  if (!hasItems) {
    return;
  }

  normalised.forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.value = item.name;
    if (item.id) {
      btn.dataset.id = item.id;
    }
    btn.className = 'px-4 py-2 border border-gray-300 rounded-full text-sm bg-white text-gray-700 hover:bg-gray-100';
    btn.textContent = item.name;
    if (item.name === selected) {
      btn.classList.add('bg-[#10b981]', 'text-white', 'border-[#10b981]');
    }
    subcatChipsContainer.appendChild(btn);
  });

  if (selected) {
    highlightServiceChip(selected);
  }

  setSubcategoryRequiredState({ hasItems, selectedValue: selected });
}

function matchesParent(item, filter) {
  if (!filter) return true;
  if (getCategoryType(item) !== 'service-subcategory') return true;
  const itemParentId = item.parentId || '';
  const itemParentName = normaliseCategoryText(item.parentName || '');
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

function getSelectedCategoryFilter() {
  if (!categorySelect) return null;
  const option = categorySelect.options[categorySelect.selectedIndex];
  if (!option || !option.value) return null;
  if (option.dataset.id) {
    return { id: option.dataset.id };
  }
  return { name: option.value };
}

function updateServiceChipsForSelection() {
  const filter = getSelectedCategoryFilter();
  if (!filter) {
    renderServiceChips([]);
    return;
  }
  if (!categoryState.serviceSubcategories.length) {
    renderServiceChips([]);
    return;
  }
  const filtered = categoryState.serviceSubcategories.filter(item => matchesParent(item, filter));
  renderServiceChips(filtered);
}

function setServiceSubcategories(list = []) {
  categoryState.serviceSubcategories = normaliseCategoryList(list, 'service-subcategory');
  updateServiceChipsForSelection();
}

function applyCategoryPayload(data = {}) {
  const payload = data && typeof data === 'object' ? data : {};
  const categories = normaliseCategoryList(payload?.categories, 'category');
  const services = normaliseCategoryList(payload?.serviceSubcategories, 'service-subcategory');
  const categoriesProvided = Object.prototype.hasOwnProperty.call(payload, 'categories');
  const servicesProvided = Object.prototype.hasOwnProperty.call(payload, 'serviceSubcategories');

  const categoriesToUse = categoriesProvided
    ? categories
    : categoryState.categories.length
      ? categoryState.categories
      : normaliseCategoryList(DEFAULT_CATEGORIES, 'category');

  const servicesToUse = servicesProvided
    ? services
    : categoryState.serviceSubcategories.length
      ? categoryState.serviceSubcategories
      : normaliseCategoryList(DEFAULT_SERVICE_SUBCATEGORIES, 'service-subcategory');

  renderCategoryOptions(categoriesToUse);
  setServiceSubcategories(servicesToUse);
  saveCategoryCache(CATEGORY_CACHE_KEY, categoriesToUse);
  saveCategoryCache(SERVICE_CACHE_KEY, servicesToUse);
}

async function fetchCategoryDataForForm({ silent = false } = {}) {
  try {
    const res = await fetch(CATEGORY_API_URL, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || 'خطا در دریافت دسته‌بندی‌ها.');
    }
    applyCategoryPayload(data);
    if (!silent) {
      showToast('دسته‌بندی‌ها به‌روزرسانی شد ✅');
    }
  } catch (error) {
    console.warn('fetchCategoryDataForForm ->', error);
    if (!silent) {
      showToast(error.message || 'امکان دریافت دسته‌بندی‌ها نبود ❗️');
    }
  }
}

const cachedCategories = loadCategoryCache(CATEGORY_CACHE_KEY, DEFAULT_CATEGORIES, 'category');
const cachedServices = loadCategoryCache(SERVICE_CACHE_KEY, DEFAULT_SERVICE_SUBCATEGORIES, 'service-subcategory');
renderCategoryOptions(cachedCategories);
setServiceSubcategories(cachedServices);
fetchCategoryDataForForm({ silent: true });

// === Service examples: setup ===
const chipContainers = Array.from(new Set([serviceExamplesChipsContainer, subcatChipsContainer].filter(Boolean)));
chipContainers.forEach(container => {
  container.addEventListener('click', event => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    handleSubcategorySelection(button.dataset.value || '');
  });
});

if (categorySelect) {
  categorySelect.addEventListener('change', function () {
    if (subcatInput) {
      subcatInput.value = '';
    }
    handleSubcategorySelection('');
    const hint = document.getElementById('subcategory-hint');
    if (hint) {
      hint.classList.add('hidden');
    }
  });
}

// force category dropdown to open downward
categorySelect.addEventListener('focus', function(){
  this.size = this.options.length;
  this.classList.add('open');
});
categorySelect.addEventListener('blur', function(){
  this.size = 1;
  this.classList.remove('open');
});
categorySelect.addEventListener('change', function(){
  this.size = 1;
  this.classList.remove('open');
  this.blur();
});

// اعتبارسنجی و ارسال فرم ثبت فروشگاه
document.getElementById("signup-form").addEventListener("submit", function (e) {
  e.preventDefault(); // همیشه ابتدا قرار بگیره تا فرم ارسال نشه تا بررسی کامل شه

  let hasError = false;
  let firstErrorElement = null;
  const rememberErrorElement = element => {
    if (!firstErrorElement && element) {
      firstErrorElement = element;
    }
  };

  // نام فروشنده
  const firstnameInput = document.getElementById("firstname");
  const firstname = firstnameInput.value.trim();
  const firstnameHint = document.getElementById("firstname-hint");
  if (!firstname) {
    firstnameHint.innerText = "لطفاً نام فروشنده را وارد کنید.";
    firstnameHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(firstnameInput);
  } else {
    firstnameHint.classList.add("hidden");
  }

  // نام خانوادگی فروشنده
  const lastnameInput = document.getElementById("lastname");
  const lastname = lastnameInput.value.trim();
  const lastnameHint = document.getElementById("lastname-hint");
  if (!lastname) {
    lastnameHint.innerText = "لطفاً نام خانوادگی فروشنده را وارد کنید.";
    lastnameHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(lastnameInput);
  } else {
    lastnameHint.classList.add("hidden");
  }

  // نام فروشگاه
  const storenameInput = document.getElementById("storename");
  const storename = storenameInput.value.trim();
  const storenameHint = document.getElementById("storename-hint");
  if (!storename) {
    storenameHint.innerText = "لطفاً نام فروشگاه را وارد کنید.";
    storenameHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(storenameInput);
  } else {
    storenameHint.classList.add("hidden");
  }

  // آدرس فروشگاه
  const shopurlInput = document.getElementById("shopurl");
  const shopurl = shopurlInput.value.trim();
  const shopurlHint = document.getElementById("shopurl-hint");
  if (shopurl.length < 4) {
    shopurlHint.innerText = "آدرس فروشگاه باید حداقل ۴ کاراکتر باشد.";
    shopurlHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(shopurlInput);
  } else if (shopurl.length > 10) {
    shopurlHint.innerText = "آدرس فروشگاه نباید بیشتر از ۱۰ کاراکتر باشد.";
    shopurlHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(shopurlInput);
  } else if (!/^[a-z0-9]+$/.test(shopurl)) {
    shopurlHint.innerText = "آدرس فقط می‌تواند شامل حروف انگلیسی کوچک و عدد باشد. از فاصله و کاراکترهای خاص مثل # یا ! استفاده نکنید.";
    shopurlHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(shopurlInput);
  } else {
    shopurlHint.classList.add("hidden");
  }

  // شماره موبایل
  const phoneInput = document.getElementById("phone");
  const phone = phoneInput.value.trim();
  const phoneHint = document.getElementById("phone-hint");
  if (!/^09\d{9}$/.test(phone)) {
    phoneHint.innerText = "شماره موبایل را به صورت صحیح و کامل وارد کنید (مثلاً 09123456789).";
    phoneHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(phoneInput);
  } else {
    phoneHint.classList.add("hidden");
  }

  // دسته‌بندی
  const categorySelectInput = document.getElementById("category");
  const category = categorySelectInput.value;
  const categoryHint = document.getElementById("category-hint");
  if (!category) {
    categoryHint.innerText = "لطفاً دسته‌بندی فروشگاه را انتخاب کنید.";
    categoryHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(categorySelectInput);
  } else {
    categoryHint.classList.add("hidden");
  }

  // زیر گروه در صورت نیاز
  let subcategory = "";
  const shouldSelectSubcategory = subcatWrapper && subcatWrapper.dataset.hasItems === 'true';
  if (shouldSelectSubcategory) {
    subcategory = subcatInput ? (subcatInput.value || '').trim() : '';
    if (!subcategory) {
      subcategoryValidationActive = true;
      setSubcategoryRequiredState({ hasItems: true, selectedValue: '' });
      hasError = true;
      rememberErrorElement(subcatWrapper || subcatInput);
    } else {
      subcategoryValidationActive = false;
      setSubcategoryRequiredState({ hasItems: true, selectedValue: subcategory });
    }
  } else {
    subcategoryValidationActive = false;
    setSubcategoryRequiredState({ hasItems: false, selectedValue: '' });
  }

  // آدرس دقیق
  const addressInput = document.getElementById("address");
  const address = addressInput.value.trim();
  const addressHint = document.getElementById("address-hint");
  if (!address) {
    addressHint.innerText = "لطفاً آدرس دقیق فروشگاه را وارد کنید.";
    addressHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(addressInput);
  } else {
    addressHint.classList.add("hidden");
  }

  // رمز عبور
  const pass1Input = document.getElementById("pass1");
  const pass2Input = document.getElementById("pass2");
  const pass1 = pass1Input.value;
  const pass2 = pass2Input.value;
  const passHint = document.getElementById("pass-hint");
  if (pass1.length < 8) {
    passHint.innerText = "رمز عبور باید حداقل ۸ کاراکتر باشد.";
    passHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(pass1Input);
  } else if (!/[a-zA-Z]/.test(pass1)) {
    passHint.innerText = "رمز عبور باید حداقل یک حرف انگلیسی داشته باشد.";
    passHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(pass1Input);
  } else if (!/\d/.test(pass1)) {
    passHint.innerText = "رمز عبور باید حداقل یک عدد داشته باشد.";
    passHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(pass1Input);
  } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pass1)) {
    passHint.innerText = "رمز عبور باید حداقل یک نماد مثل !@#$% داشته باشد.";
    passHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(pass1Input);
  } else if (pass1 !== pass2) {
    passHint.innerText = "رمز عبور و تکرار آن با هم یکسان نیستند.";
    passHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(pass2Input);
  } else {
    passHint.classList.add("hidden");
  }

  // قوانین سایت
  const rules = document.getElementById("rules");
  const rulesHint = document.getElementById("rules-hint");
  if (!rules.checked) {
    rulesHint.innerText = "لطفاً تیک پذیرش قوانین سایت را بزنید.";
    rulesHint.classList.remove("hidden");
    hasError = true;
    rememberErrorElement(rules);
  } else {
    rulesHint.classList.add("hidden");
  }

  // اگر حتی یکی از خطاها وجود داشت، اجازه ارسال فرم نده
  if (hasError) {
    if (firstErrorElement) {
      firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof firstErrorElement.focus === 'function') {
        firstErrorElement.focus({ preventScroll: true });
      }
    }
    return;
  }
  // ساخت داده‌ها برای ارسال به بک‌اند
  const data = {
    firstname: firstname,
    lastname: lastname,
    storename: storename,
    shopurl: shopurl,
    phone: phone,
    category: category,
    subcategory: subcategory,
    address: address,
    desc: document.querySelector("textarea[name='desc']").value.trim(),
    password: pass1,
  };

  // غیر فعال کردن دکمه ثبت تا پاسخ بیاد
  let btn = this.querySelector("button[type='submit']");
  btn.disabled = true;
  btn.innerText = "در حال ارسال...";

  fetch(`${API_ORIGIN}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then(res => res.json())
    .then(result => {
      btn.disabled = false;
      btn.innerText = "ثبت فروشگاه";
      if (result.success) {
        localStorage.setItem('shopurl', data.shopurl);
        SafeSS.setJSON('signup_password', data.password); // SafeSS

        // ✅ اضافه‌شدن نقش و دسته برای تعیین پنل بعد از وریفای
        // توجه: SERVICE_CATEGORIES بالاتر در همین فایل تعریف شده.
        SafeSS.setJSON('signup_category', data.category); // SafeSS
        SafeSS.setJSON('signup_role', SERVICE_CATEGORIES.includes(data.category) ? 'service' : 'seller'); // SafeSS

        window.location.href = "verify.html?shopurl=" + encodeURIComponent(data.shopurl) + "&phone=" + encodeURIComponent(data.phone);
      }

      else {
        alert("خطا در ثبت‌نام: " + (result.message || "لطفاً دوباره تلاش کنید"));
      }
    })
    .catch(err => {
      btn.disabled = false;
      btn.innerText = "ثبت فروشگاه";
      console.error("Error:", err);
      alert("مشکلی در ارتباط با سرور پیش آمد.");
    });


});

// مرحله تأیید شماره موبایل
function showVerifySection(phone) {
// مقدار shopurl رو از localStorage بخون
var shopurl = localStorage.getItem('shopurl');
// ریدایرکت به صفحه verify.html با پارامتر
window.location.href = `verify.html?shopurl=${encodeURIComponent(shopurl)}&phone=${encodeURIComponent(phone)}`;
}


// تایید کد پیامک
// --- تایید کد پیامک با سرور ---
document.getElementById("verify-form").addEventListener("submit", function (e) {
e.preventDefault();
var code = document.getElementById("sms-code").value.trim();
var codeHint = document.getElementById("code-hint");
var params = new URLSearchParams(window.location.search);
var shopurl = params.get("shopurl");
var phone = params.get("phone");
if (!/^\d{5}$/.test(code)) {
  codeHint.innerText = "کد تأیید باید دقیقاً ۵ رقم باشد.";
  codeHint.classList.remove("hidden");
  return false;
}

fetch(`${API_ORIGIN}/api/auth/verify`, {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({ shopurl, phone, code })
})
.then(res => res.json())
.then(result => {
  if (result.success) {
    // رمز رو از sessionStorage بخون برای لاگین
    var password = SafeSS.getJSON('signup_password'); // SafeSS
    if (!password) {
      codeHint.innerText = "خطا: رمز ثبت‌نام پیدا نشد. لطفا مجدد ثبت‌نام کنید.";
      codeHint.classList.remove("hidden");
      return;
    }
    // درخواست لاگین به سرور
    fetch(`${API_ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ phone, password })
    })
    .then(res2 => res2.json())
    .then(loginRes => {
      if (loginRes.success && loginRes.seller) {
        // توکن و اطلاعات رو ذخیره کن (در صورت نیاز)
        localStorage.setItem('token', loginRes.token);
        localStorage.setItem('seller', JSON.stringify(loginRes.seller));
        // sessionStorage رو پاک کن
        sessionStorage.removeItem('signup_password');
        // ریدایرکت به داشبورد
        window.location.href = "seller/dashboard.html?shopurl=" + encodeURIComponent(loginRes.seller.shopurl);
      } else {
        codeHint.innerText = loginRes.message || "ورود ناموفق!";
        codeHint.classList.remove("hidden");
      }
    })
    .catch(() => {
      codeHint.innerText = "خطای ورود به اکانت!";
      codeHint.classList.remove("hidden");
    });
  } else {
    codeHint.innerText = result.message || "کد تایید اشتباه است!";
    codeHint.classList.remove("hidden");
  }
})
.catch(() => {
  codeHint.innerText = "مشکل ارتباط با سرور!";
  codeHint.classList.remove("hidden");
});
});

document.getElementById("sms-code").addEventListener("input", function () {
document.getElementById("code-hint").classList.add("hidden");
});

// تایمر ارسال مجدد کد
var resendBtn = document.getElementById("resend-btn");
var timerSpan = document.getElementById("resend-timer");
function startResendTimer() {
resendBtn.disabled = true;
let time = 60;
timerSpan.innerText = `(${time})`;
resendBtn.innerHTML = 'ارسال مجدد کد <span id="resend-timer">(' + time + ')</span>';
timerSpan = document.getElementById("resend-timer");
let t = setInterval(function () {
  time--;
  timerSpan.innerText = `(${time})`;
  if (time <= 0) {
    clearInterval(t);
    resendBtn.disabled = false;
    timerSpan.innerText = '';
    resendBtn.innerText = 'ارسال مجدد کد';
  }
}, 1000);
}

resendBtn.addEventListener("click", function () {
if (resendBtn.disabled) return;
alert("کد جدید ارسال شد! (در حالت واقعی)");
startResendTimer();
});



// Mini toast for quick feedback
function showToast(msg) {
const el = document.createElement('div');
el.className = "fixed bottom-4 left-1/2 -translate-x-1/2 z-[999] px-4 py-2 rounded-xl bg-gradient-to-l from-[#11d6ad] via-[#10b981] to-[#2db4e8] text-white text-sm shadow-lg";
el.textContent = msg;
document.body.appendChild(el);
setTimeout(() => {
  el.style.transition = "opacity .3s, transform .3s";
  el.style.opacity = "0";
  el.style.transform = "translate(-50%, 8px)";
  setTimeout(() => el.remove(), 300);
}, 1400);
}
