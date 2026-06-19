// Extracted from shop.html.

(function ensureSafeSessionStorage() {
  if (window.SafeSS && typeof window.SafeSS.setJSON === 'function' && typeof window.SafeSS.getJSON === 'function') {
    return;
  }

  window.SafeSS = {
    setJSON(key, value) {
      try {
        sessionStorage.setItem(key, JSON.stringify(value));
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
})();

/*
<!--
<script>
  (function () {
    var config = window.POSTHOG_CONFIG || { enabled: false, apiKey: 'phc_YOUR_KEY_HERE', apiHost: 'https://analytics.vitreenet.ir' };
    if (!config.enabled) {
      return; // فعال نیست | Not enabled yet
    }
    try {
      (function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")),p.type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js";(r=t.getElementsByTagName("script")[0]),r.parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:u=e,u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==u._i&&(e+="."+u._i),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"};n="capture identify alias people.set people.set_once people.unset people.increment people.append people.union people.remove people.clear_opt_out_outcome register register_once unregister opt_out_capturing opt_in_capturing has_opted_out_capturing reset isFeatureEnabled onFeatureFlags reloadFeatureFlags group".split(" ");for(o=0;o<n.length;o++)g(u,n[o]);e._i.push([i,s,a])},e.__SV=1.1)})(document, window.posthog || []);
      window.posthog.init(config.apiKey, { api_host: config.apiHost, capture_pageview: true, advanced_disable_decide: true });
    } catch (error) {
      console.warn('PostHog init failed (preview mode):', error);
    }
  })();
</script>
-->
*/

/*
<!--
<script>
  document.addEventListener('DOMContentLoaded', function () {
    const safeCapture = window.safePosthogCapture || function () {};
    // شناسایی فروشگاه بازدید شده | Identify visited shop
    // const shopId = document.body.getAttribute('data-shop-id') || 'SHOP_ID';
    // safeCapture('shop_visited', { shop_id: shopId });
    // می‌توانید افزودن به سبد را نیز در صفحه فروشگاه رهگیری کنید | Track add to cart from shop page if needed
  });
</script>
-->
*/

// ===== گرفتن shopurl (هم از query ?shopurl=... هم از انتهای url) =====
function getShopSlug() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('shopurl')) {
    return urlParams.get('shopurl');
  }
  if (urlParams.has('sellerId') || urlParams.has('id')) {
    return '';
  }
  // shops/mobforoshi یا shop.html/mobforoshi یا حتی shop.html?shopurl=mobforoshi
  let path = window.location.pathname.split('/').filter(Boolean);
  let last = path[path.length - 1] || '';
  if (last.endsWith('.html')) last = last.replace('.html', '');
  // اگر shops یا shop.html بود و آخرش اسلاگ نبود، خالی برگردون
  if (['shops', 'shop', 'shop.html'].includes(last)) {
    return getStoredSellerField('shopurl') || getStoredSellerField('shopUrl') || '';
  }
  return last;
}

function getStoredSellerField(field) {
  try {
    const seller = JSON.parse(localStorage.getItem('seller') || '{}');
    return typeof seller?.[field] === 'string' ? seller[field].trim() : '';
  } catch {
    return '';
  }
}

function normalizeEntityId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value).trim();
  if (typeof value === 'object') {
    const directValue = value._id || value.id || value.sellerId || value.$oid;
    if (directValue && directValue !== value) {
      return normalizeEntityId(directValue);
    }
    if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
      const text = value.toString();
      return text && text !== '[object Object]' ? text.trim() : '';
    }
  }
  return '';
}

function setTextById(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
  return element;
}

function formatDrawerRatingValue(averageRating, ratingCount) {
  const ratingNumber = Number(averageRating);
  if (!Number.isFinite(ratingNumber) || ratingNumber <= 0) {
    return 'بدون امتیاز';
  }

  const ratingText = ratingNumber.toLocaleString('fa-IR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
  const countNumber = Number(ratingCount);
  const hasReviewCount = Number.isFinite(countNumber) && countNumber > 0;

  return hasReviewCount
    ? `${ratingText} از ۵ • ${countNumber.toLocaleString('fa-IR')} نظر`
    : `${ratingText} از ۵`;
}

function getCurrentShopShareUrl() {
  const url = new URL(window.location.href);
  url.hash = '';
  return url.toString();
}

function setDrawerOptionalRow(rowId, textId, value) {
  const row = document.getElementById(rowId);
  const text = document.getElementById(textId);
  const cleanValue = typeof value === 'string' ? value.trim() : '';
  if (!row || !text) return;
  row.hidden = !cleanValue;
  text.textContent = cleanValue;
}

function resolveWorkingHoursText(source = {}) {
  const directValue = [
    source.workingHours,
    source.shopWorkingHours,
    source.openingHours,
    source.businessHours,
    source.workHours
  ].find(value => typeof value === 'string' && value.trim());

  if (directValue) return directValue.trim();

  const start = source.openTime || source.startTime || source.workingHoursStart;
  const end = source.closeTime || source.endTime || source.workingHoursEnd;
  if (start && end) return `${start} تا ${end}`;

  return '';
}

function getShopSellerId() {
  const urlParams = new URLSearchParams(window.location.search);
  return (
    urlParams.get('sellerId') ||
    urlParams.get('id') ||
    getStoredSellerField('_id') ||
    getStoredSellerField('id') ||
    ''
  ).trim();
}

function normalizeSellerId(value) {
  return normalizeEntityId(value);
}

function resolveShopDataSellerId(data = {}) {
  return normalizeSellerId(data.sellerId) ||
    normalizeSellerId(data.seller) ||
    normalizeSellerId(data.owner) ||
    normalizeSellerId(data.shopOwner);
}

function setShopCategoryBadge(category) {
  const badge = document.getElementById('shopCategoryBadge');
  const text = document.getElementById('shopCategoryBadgeText');
  const drawerCategory = document.getElementById('drawerShopCategory');
  const mobileCategory = document.getElementById('mobileShopCategoryText');
  const mobileCategoryChip = document.getElementById('mobileCategoryChip');
  if (badge) {
    badge.hidden = true;
    badge.setAttribute('aria-hidden', 'true');
    badge.removeAttribute('aria-label');
  }
  if (text) text.textContent = '';
  if (mobileCategory) mobileCategory.textContent = '';
  if (mobileCategoryChip) {
    mobileCategoryChip.hidden = true;
    mobileCategoryChip.setAttribute('aria-hidden', 'true');
    mobileCategoryChip.removeAttribute('aria-label');
  }

  const cleanCategory = typeof category === 'string' ? category.trim() : '';
  if (!cleanCategory) {
    if (drawerCategory) {
      drawerCategory.hidden = true;
      drawerCategory.textContent = '';
    }
    return;
  }

  if (drawerCategory) {
    drawerCategory.hidden = false;
    drawerCategory.textContent = cleanCategory;
  }
}

function resolveShopCategory(source = {}) {
  return [
    source.shopSubcategory,
    source.subcategory,
    source.shopCategory,
    source.category,
    source.categoryName
  ].map(value => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) || '';
}

function getStoredShopCategory() {
  return getStoredSellerField('subcategory') || getStoredSellerField('category');
}

setShopCategoryBadge(getStoredShopCategory());

// ← این متغیر رو در بالای اسکریپت تعریف می‌کنیم
let currentSellerId = null;
const SHOP_API_BASE = (window.__API_BASE__ || window.API_BASE || 'http://localhost:5000').replace(/\/$/, '');

const customerUpdateChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('seller-customer-updates')
  : null;

function emitCustomerAdded({ totalCustomers } = {}) {
  if (!currentSellerId) return;
  const payload = {
    type: 'customer-added',
    sellerId: currentSellerId,
    totalCustomers: Number.isFinite(totalCustomers) ? totalCustomers : undefined,
    at: Date.now()
  };

  customerUpdateChannel?.postMessage(payload);

  try {
    const nonce = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
    localStorage.setItem('seller-customer-updates', JSON.stringify({ ...payload, nonce }));
  } catch (error) {
    console.warn('Cannot persist customer update', error);
  }
}

const slug = getShopSlug();
const sellerIdParam = getShopSellerId();

// نمایش تعداد مشتریان در همه المان‌های مربوطه
function setCustomerCount(countValue = 0) {
  const safeCount = Number.isFinite(countValue) ? countValue : 0;
  document.querySelectorAll('[data-customer-count]').forEach((el) => {
    el.textContent = safeCount.toLocaleString();
  });
}

const STORY_VIEW_DURATION_MS = 6500;
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const SHOP_STORY_INACTIVE_TOAST_MESSAGE = 'استوری فعالی وجود ندارد';
const shopStoriesState = {
  stories: [],
  latestStory: null,
  hasExpiredStory: false,
  hasShopContext: false,
  sellerId: '',
  avatarUrl: '',
  shopName: '',
  activeIndex: 0,
  viewerTimer: null,
  toastTimer: null,
  viewerStartedAt: 0,
  viewerElapsedMs: 0,
  viewerPaused: false,
  viewerTouchX: null,
  viewerTouchY: null,
  viewerPointerStartedAt: 0,
  viewerWasPausedBeforePointer: false,
  mobileNavWasHidden: false,
  countdownTimer: null,
  replying: false
};

// Hide the story circle by default. It must only appear once a real active story
// for THIS shop/seller is confirmed from the API. Run as early as possible so the
// element can never be visible before the data check completes.
(function ensureStoriesHiddenByDefault() {
  const hide = () => {
    const section = document.getElementById('shopStoriesSection');
    if (section) {
      if (section.querySelector('.story-thumb')) return;
      section.hidden = true;
      section.setAttribute('aria-hidden', 'true');
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hide, { once: true });
  } else {
    hide();
  }
})();

function getStoryId(story) {
  return story && String(story.id || story._id || '');
}

function getStorySellerId(story) {
  return normalizeSellerId(story?.sellerId || story?.seller || story?.owner || '');
}

function formatStoryCount(value) {
  const safeValue = Number(value || 0);
  return Number.isFinite(safeValue) ? safeValue.toLocaleString('fa-IR') : '۰';
}

function getStoryReactionKey() {
  const storageKey = 'shop-story-reaction-key';
  try {
    let key = localStorage.getItem(storageKey);
    if (!key) {
      const randomPart = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      key = `anon:${randomPart}`;
      localStorage.setItem(storageKey, key);
    }
    return key;
  } catch {
    return '';
  }
}

function getStoryReplyKey() {
  return getStoryReactionKey();
}

function isStoryReacted(story) {
  const storyId = getStoryId(story);
  if (!storyId) return false;
  if (typeof story.reacted === 'boolean') return story.reacted;
  try {
    return localStorage.getItem(`shop-story-reacted:${storyId}`) === '1';
  } catch {
    return false;
  }
}

function normalizeStoryImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  return url.startsWith('/') ? url : `/${url}`;
}

function getValidatedStoryImageUrl(story) {
  const imageUrl = normalizeStoryImageUrl(story?.imageUrl);
  if (!imageUrl) return '';
  if (/^https?:\/\/[^\s"'<>]+$/i.test(imageUrl)) return imageUrl;
  if (/^\/[^\s"'<>]+$/i.test(imageUrl)) return imageUrl;
  return '';
}

function getShopAvatarUrl() {
  return getValidatedStoryImageUrl({ imageUrl: shopStoriesState.avatarUrl });
}

function hasValidShopStoryContext() {
  return Boolean(shopStoriesState.hasShopContext && normalizeSellerId(shopStoriesState.sellerId));
}

// Inline minimal store/shop icon used as a premium fallback when the shop has no
// logo/avatar image. No text initials are ever rendered as the avatar fallback.
const SHOP_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h16l-1 10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1L4 9Z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/></svg>';

// When the shop has a logo/avatar, show that image inside the circle. Otherwise,
// render a clean minimal store icon instead of a letter initial placeholder.
function createStoryThumbFallback() {
  const fallback = document.createElement('div');
  fallback.className = 'story-media-fallback story-thumb-fallback story-thumb-icon';
  fallback.innerHTML = SHOP_ICON_SVG;
  return fallback;
}

function getStoryRemainingMs(story) {
  const expiresAt = story?.expiresAt ? new Date(story.expiresAt).getTime() : 0;
  if (expiresAt && !Number.isNaN(expiresAt)) {
    return Math.max(0, expiresAt - Date.now());
  }
  const remainingMs = Number(story?.remainingMs);
  return Number.isFinite(remainingMs) ? Math.max(0, remainingMs) : 0;
}

function markStoryMediaFallback(container) {
  if (!container) return;
  container.classList.add('media-failed');
}

function createStoryImage(src, alt, fallbackContainer) {
  const img = document.createElement('img');
  img.alt = alt || 'استوری فروشگاه';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => markStoryMediaFallback(fallbackContainer));
  if (src) {
    img.src = src;
  } else {
    requestAnimationFrame(() => markStoryMediaFallback(fallbackContainer));
  }
  return img;
}

function hideStoriesSection() {
  const section = document.getElementById('shopStoriesSection');
  const content = document.getElementById('shopStoriesContent');
  if (section) {
    section.hidden = true;
    section.setAttribute('aria-hidden', 'true');
  }
  if (content) content.innerHTML = '';
  shopStoriesState.stories = [];
  clearInterval(shopStoriesState.countdownTimer);
}

// Small transient toast for the inactive/expired story state. We avoid opening the
// story viewer in that case and instead let the user know there is no active story.
function showShopStoryToast(message = SHOP_STORY_INACTIVE_TOAST_MESSAGE) {
  let toast = document.getElementById('shopStoryToast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  toast.setAttribute('aria-hidden', 'false');
  clearTimeout(shopStoriesState.toastTimer);
  shopStoriesState.toastTimer = window.setTimeout(() => {
    toast.classList.remove('show');
    toast.setAttribute('aria-hidden', 'true');
  }, 2200);
}

// Clicking an expired/inactive story ring must never open stale story media.
function onExpiredStoryClick(event) {
  event.preventDefault();
  event.stopPropagation();
  showShopStoryToast();
}

function renderStoriesEmpty(options = {}) {
  if (options.forceHide || !hasValidShopStoryContext()) {
    hideStoriesSection();
    return;
  }

  if (isStoryExpiredRecord(shopStoriesState.latestStory)) {
    renderInactiveStoryRing(shopStoriesState.latestStory);
    return;
  }

  renderPlainShopCircle();
}

function renderStoriesUnavailable() {
  hideStoriesSection();
}

// When the latest story is expired/older than 24h we keep the circular icon
// visible but render it in an inactive/expired style: no colorful ring, no glow.
// Clicking it only surfaces the "no active story" toast and never opens the viewer.
function renderInactiveStoryRing(latestStory) {
  const section = document.getElementById('shopStoriesSection');
  const content = document.getElementById('shopStoriesContent');
  if (!section || !content) return;
  const avatarSrc = getShopAvatarUrl();
  if (!hasValidShopStoryContext()) {
    hideStoriesSection();
    return;
  }

  section.hidden = false;
  section.removeAttribute('aria-hidden');
  content.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'stories-list';

  const thumb = document.createElement('button');
  thumb.type = 'button';
  thumb.className = 'story-thumb story-thumb--inactive';
  thumb.setAttribute('aria-label', SHOP_STORY_INACTIVE_TOAST_MESSAGE);
  thumb.setAttribute('aria-disabled', 'true');
  thumb.title = SHOP_STORY_INACTIVE_TOAST_MESSAGE;

  const media = document.createElement('div');
  media.className = 'story-thumb-media';
  media.appendChild(createStoryImage(avatarSrc, 'استوری فروشگاه', media));
  media.appendChild(createStoryThumbFallback());

  thumb.append(media);
  thumb.addEventListener('click', onExpiredStoryClick);
  list.appendChild(thumb);
  content.appendChild(list);

  shopStoriesState.hasExpiredStory = true;
  shopStoriesState.stories = [];
}

// No story data at all: keep the circular shop/avatar circle visible, but with
// NO story ring (neither active nor expired). It is a plain avatar circle and is
// not interactive as a story.
function renderPlainShopCircle() {
  const section = document.getElementById('shopStoriesSection');
  const content = document.getElementById('shopStoriesContent');
  if (!section || !content) return;
  const avatarSrc = getShopAvatarUrl();
  if (!hasValidShopStoryContext()) {
    hideStoriesSection();
    return;
  }

  section.hidden = false;
  section.removeAttribute('aria-hidden');
  content.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'stories-list';

  const thumb = document.createElement('button');
  thumb.type = 'button';
  thumb.className = 'story-thumb story-thumb--plain';
  thumb.setAttribute('aria-label', 'تصویر فروشگاه');
  thumb.tabIndex = -1;

  const media = document.createElement('div');
  media.className = 'story-thumb-media';
  media.appendChild(createStoryImage(avatarSrc, 'تصویر فروشگاه', media));
  media.appendChild(createStoryThumbFallback());

  thumb.append(media);
  list.appendChild(thumb);
  content.appendChild(list);

  shopStoriesState.hasExpiredStory = false;
  shopStoriesState.stories = [];
}

// A story is only considered "active" when it is explicitly active, has a real id,
// a usable image, and a remaining lifetime greater than zero. This guards against
// placeholder/demo/fallback/expired/deleted payloads that might slip through.
function isStoryTrulyActive(story, sellerId = shopStoriesState.sellerId) {
  if (!story || typeof story !== 'object') return false;
  if (story.status && story.status !== 'active') return false;
  if (getStoryId(story) === '') return false;
  const expectedSellerId = normalizeSellerId(sellerId);
  const storySellerId = getStorySellerId(story);
  if (expectedSellerId && storySellerId !== expectedSellerId) return false;
  const imageUrl = getValidatedStoryImageUrl(story);
  if (!imageUrl) return false;
  return getStoryRemainingMs(story) > 0;
}

function renderShopStories(stories = []) {
  const section = document.getElementById('shopStoriesSection');
  const content = document.getElementById('shopStoriesContent');
  if (!content) return;

  const storyList = Array.isArray(stories) ? stories : (stories ? [stories] : []);
  const activeStories = storyList.filter((story) => isStoryTrulyActive(story));
  shopStoriesState.stories = activeStories;
  shopStoriesState.hasExpiredStory = false;
  shopStoriesState.latestStory = activeStories[0] || shopStoriesState.latestStory;

  if (!activeStories.length) {
    // A story we were just viewing expired/ran out. Re-evaluate the empty state:
    // expired latest story => gray ring, otherwise plain shop avatar.
    renderStoriesEmpty();
    return;
  }

  if (section) section.hidden = false;
  if (section) section.removeAttribute('aria-hidden');
  content.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'stories-list';

  activeStories.slice(0, 1).forEach((story, index) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'story-thumb';
    thumb.setAttribute('aria-label', 'مشاهده استوری فروشگاه');
    thumb.title = 'استوری فروشگاه';

    const media = document.createElement('div');
    media.className = 'story-thumb-media';
    const avatarSrc = getValidatedStoryImageUrl({ imageUrl: shopStoriesState.avatarUrl }) || getValidatedStoryImageUrl(story);
    media.appendChild(createStoryImage(avatarSrc, 'استوری فروشگاه', media));
    media.appendChild(createStoryThumbFallback());

    thumb.append(media);
    thumb.addEventListener('click', () => openStoryViewer(index));
    list.appendChild(thumb);
  });

  content.appendChild(list);

  clearInterval(shopStoriesState.countdownTimer);
  shopStoriesState.countdownTimer = window.setInterval(() => {
    if (!shopStoriesState.stories.some((story) => getStoryRemainingMs(story) > 0)) {
      renderStoriesEmpty();
    }
  }, 30000);
}

// Pull active stories only from the documented API contract (data.stories / data.story).
// Stale/expired/deleted entries are rejected here before the render/show path, so we
// never reveal placeholder, fallback, demo, cached, or old story data.
function extractPublicStories(data = {}, sellerId = shopStoriesState.sellerId) {
  const fromList = Array.isArray(data.stories) ? data.stories : [];
  if (fromList.length) return fromList.filter((story) => isStoryTrulyActive(story, sellerId));

  const singleStory = data.story;
  return isStoryTrulyActive(singleStory, sellerId) ? [singleStory] : [];
}

// Only treat a record as an EXPIRED story (gray inactive ring) when it is a real
// story that has genuinely passed its lifetime. A record counts as expired only if:
//   - status is explicitly 'expired', OR
//   - the publish/create time is older than 24h.
// Deleted, draft, pending, empty, invalid, or otherwise unknown records are NOT
// expired stories and must not render as the inactive story ring.
function isStoryExpiredRecord(story, sellerId = shopStoriesState.sellerId) {
  if (!story || typeof story !== 'object') return false;
  if (getStoryId(story) === '') return false;

  const rawStatus = typeof story.status === 'string' ? story.status.trim().toLowerCase() : '';
  // Deleted/draft/pending stories are intentionally excluded from the expired state.
  if (['deleted', 'draft', 'pending', ''].includes(rawStatus)) return false;

  // Reject records that belong to a different shop than the one we are viewing.
  const expectedSellerId = normalizeSellerId(sellerId);
  const storySellerId = getStorySellerId(story);
  if (expectedSellerId && storySellerId !== expectedSellerId) return false;

  // Explicit expired flag from the backend.
  if (rawStatus === 'expired') return true;

  // Otherwise require a real, parseable publish/create timestamp older than 24h.
  const publishedAt = new Date(story.createdAt || story.publishedAt || story.createdAtMs || 0).getTime();
  if (!Number.isFinite(publishedAt) || publishedAt <= 0) return false;
  const ageMs = Date.now() - publishedAt;
  return ageMs >= STORY_LIFETIME_MS;
}

async function loadShopStories(sellerId) {
  const content = document.getElementById('shopStoriesContent');
  const resolvedSellerId = normalizeSellerId(sellerId);
  shopStoriesState.sellerId = resolvedSellerId;
  // Keep the story circle hidden until a real active story is confirmed.
  hideStoriesSection();
  if (!resolvedSellerId || !content) {
    return;
  }

  try {
    // cache: 'no-store' so we never render stale/old story data after a
    // seller deletes or lets their story expire in the dashboard.
    const res = await fetch(
      `${SHOP_API_BASE}/api/seller/stories/public/${encodeURIComponent(resolvedSellerId)}`,
      { cache: 'no-store' }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || 'امکان بارگذاری استوری‌ها وجود ندارد.');
    }
    const activeStories = extractPublicStories(data, resolvedSellerId);
    if (activeStories.length) {
      renderShopStories(activeStories);
      return;
    }

    // No active story. If the shop has an expired/older story on record we keep
    // the circular icon visible in an inactive style instead of hiding it.
    const latestStory = data.latestStory || data.story || null;
    if (isStoryExpiredRecord(latestStory, resolvedSellerId)) {
      shopStoriesState.latestStory = latestStory;
      renderInactiveStoryRing(latestStory);
      return;
    }

    // No story data at all (or only deleted/draft/pending records) → keep the
    // circular shop/avatar circle visible, but without any story ring.
    renderPlainShopCircle();
  } catch (error) {
    console.warn('بارگذاری استوری ناموفق بود:', error);
    renderPlainShopCircle();
  }
}

function updateViewerProgress() {
  const progressEl = document.getElementById('storyViewerProgress');
  if (!progressEl) return;

  const elapsed = shopStoriesState.viewerPaused
    ? shopStoriesState.viewerElapsedMs
    : shopStoriesState.viewerElapsedMs + (Date.now() - shopStoriesState.viewerStartedAt);
  const currentProgress = Math.min(100, Math.max(0, (elapsed / STORY_VIEW_DURATION_MS) * 100));
  Array.from(progressEl.children).forEach((bar, index) => {
    const value = index < shopStoriesState.activeIndex ? 100 : index > shopStoriesState.activeIndex ? 0 : currentProgress;
    bar.style.setProperty('--viewer-progress', `${value}%`);
  });

  if (elapsed >= STORY_VIEW_DURATION_MS) {
    showNextStory();
  }
}

function setStoryPaused(paused) {
  const viewer = document.getElementById('storyViewer');
  if (paused === shopStoriesState.viewerPaused) return;

  if (paused) {
    shopStoriesState.viewerElapsedMs += Date.now() - shopStoriesState.viewerStartedAt;
    shopStoriesState.viewerPaused = true;
    viewer?.classList.add('is-paused');
  } else {
    shopStoriesState.viewerStartedAt = Date.now();
    shopStoriesState.viewerPaused = false;
    viewer?.classList.remove('is-paused');
  }
  updateViewerProgress();
}

function toggleStoryPaused() {
  setStoryPaused(!shopStoriesState.viewerPaused);
}

function hideMobileNavForStory() {
  shopStoriesState.mobileNavWasHidden = document.body.classList.contains('hide-mobile-nav');
  document.body.classList.add('hide-mobile-nav', 'story-viewer-open');
}

function restoreMobileNavAfterStory() {
  document.body.classList.remove('story-viewer-open');
  if (!shopStoriesState.mobileNavWasHidden) {
    document.body.classList.remove('hide-mobile-nav');
  }
}

async function trackStoryView(story) {
  const storyId = getStoryId(story);
  if (!storyId) return;

  const storageKey = `shop-story-viewed:${storyId}`;
  try {
    if (localStorage.getItem(storageKey)) return;
    localStorage.setItem(storageKey, '1');
  } catch {}

  try {
    const res = await fetch(`${SHOP_API_BASE}/api/seller/stories/public/${storyId}/view`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.story) {
      Object.assign(story, data.story);
      renderShopStories(shopStoriesState.stories);
    }
  } catch (error) {
    console.warn('ثبت بازدید استوری ناموفق بود:', error);
  }
}

function updateStoryReactionUi(story) {
  const react = document.getElementById('storyViewerReact');
  const likes = document.getElementById('storyViewerLikes');
  const reacted = isStoryReacted(story);

  react?.classList.toggle('is-reacted', reacted);
  react?.setAttribute('aria-pressed', String(reacted));
  react?.setAttribute('aria-label', reacted ? 'حذف واکنش استوری' : 'واکنش به استوری');
  if (likes) likes.textContent = formatStoryCount(story?.likesCount);
}

function setStoryReplyFeedback(message = '', type = '') {
  const feedback = document.getElementById('storyReplyFeedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.toggle('error', type === 'error');
}

function resetStoryReplyForm() {
  const input = document.getElementById('storyReplyInput');
  if (input) {
    input.value = '';
    input.style.height = '';
  }
  shopStoriesState.replying = false;
  setStoryReplyFeedback('');
  updateStoryReplyFormState();
}

function updateStoryReplyFormState() {
  const send = document.getElementById('storyReplySend');
  const input = document.getElementById('storyReplyInput');
  const hasMessage = Boolean(String(input?.value || '').trim());
  if (send) send.disabled = shopStoriesState.replying || !hasMessage;
}

function renderViewerStory(index) {
  const stories = shopStoriesState.stories;
  const story = stories[index];
  if (!story) return closeStoryViewer();
  if (!isStoryTrulyActive(story)) {
    closeStoryViewer();
    renderStoriesEmpty();
    showShopStoryToast();
    return;
  }

  shopStoriesState.activeIndex = index;
  shopStoriesState.viewerStartedAt = Date.now();
  shopStoriesState.viewerElapsedMs = 0;
  shopStoriesState.viewerPaused = false;
  document.getElementById('storyViewer')?.classList.remove('is-paused');

  const image = document.getElementById('storyViewerImage');
  const media = document.getElementById('storyViewerMedia');
  const progress = document.getElementById('storyViewerProgress');
  const react = document.getElementById('storyViewerReact');
  const caption = document.getElementById('storyViewerCaption');

  media?.classList.remove('media-failed');
  if (image) {
    image.removeAttribute('src');
    image.onerror = () => markStoryMediaFallback(media);
    const src = normalizeStoryImageUrl(story.imageUrl);
    if (src) image.src = src;
    else markStoryMediaFallback(media);
  }
  if (progress) {
    progress.innerHTML = '';
    stories.forEach(() => progress.appendChild(document.createElement('span')));
  }
  if (react) updateStoryReactionUi(story);
  if (caption) {
    const captionText = String(story.caption || '').trim();
    caption.textContent = captionText;
    caption.style.display = captionText ? '' : 'none';
  }
  resetStoryReplyForm();

  clearInterval(shopStoriesState.viewerTimer);
  shopStoriesState.viewerTimer = window.setInterval(updateViewerProgress, 90);
  updateViewerProgress();
  trackStoryView(story);
}

function openStoryViewer(index = 0) {
  if (!shopStoriesState.stories.length) return;
  if (!isStoryTrulyActive(shopStoriesState.stories[index])) {
    renderStoriesEmpty();
    showShopStoryToast();
    return;
  }
  const viewer = document.getElementById('storyViewer');
  if (!viewer) return;

  viewer.classList.add('is-open');
  viewer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  hideMobileNavForStory();
  renderViewerStory(index);
}

function closeStoryViewer() {
  const viewer = document.getElementById('storyViewer');
  if (!viewer) return;
  viewer.classList.remove('is-open');
  viewer.classList.remove('is-paused');
  viewer.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  clearInterval(shopStoriesState.viewerTimer);
  shopStoriesState.viewerPaused = false;
  shopStoriesState.viewerElapsedMs = 0;
  restoreMobileNavAfterStory();
}

function showNextStory() {
  if (shopStoriesState.activeIndex < shopStoriesState.stories.length - 1) {
    renderViewerStory(shopStoriesState.activeIndex + 1);
  } else {
    closeStoryViewer();
  }
}

function showPrevStory() {
  renderViewerStory(Math.max(0, shopStoriesState.activeIndex - 1));
}

async function reactToCurrentStory() {
  const story = shopStoriesState.stories[shopStoriesState.activeIndex];
  const storyId = getStoryId(story);
  if (!storyId) return;

  const storageKey = `shop-story-reacted:${storyId}`;
  const wasReacted = isStoryReacted(story);
  const previousLikes = Number(story.likesCount || 0);
  const nextReacted = !wasReacted;
  const reactionKey = getStoryReactionKey();

  story.reacted = nextReacted;
  story.likesCount = Math.max(0, previousLikes + (nextReacted ? 1 : -1));
  try {
    if (nextReacted) localStorage.setItem(storageKey, '1');
    else localStorage.removeItem(storageKey);
  } catch {}

  const react = document.getElementById('storyViewerReact');
  if (react) react.disabled = true;
  updateStoryReactionUi(story);

  try {
    const res = await fetch(`${SHOP_API_BASE}/api/seller/stories/public/${storyId}/reaction`, {
      method: 'POST',
      headers: {
        ...(reactionKey ? { 'X-Story-Reaction-Key': reactionKey } : {}),
        'X-Story-Reaction-State': nextReacted ? 'liked' : 'unliked'
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || 'امکان ثبت واکنش وجود ندارد.');
    }
    if (res.ok && data.story) {
      Object.assign(story, data.story);
      if (typeof data.reacted === 'boolean') story.reacted = data.reacted;
      try {
        if (story.reacted) localStorage.setItem(storageKey, '1');
        else localStorage.removeItem(storageKey);
      } catch {}
      updateStoryReactionUi(story);
      renderShopStories(shopStoriesState.stories);
    }
  } catch (error) {
    story.reacted = wasReacted;
    story.likesCount = previousLikes;
    try {
      if (wasReacted) localStorage.setItem(storageKey, '1');
      else localStorage.removeItem(storageKey);
    } catch {}
    updateStoryReactionUi(story);
    console.warn('ثبت واکنش استوری ناموفق بود:', error);
  } finally {
    if (react) react.disabled = false;
  }
}

async function submitStoryReply(event) {
  event?.preventDefault?.();
  const story = shopStoriesState.stories[shopStoriesState.activeIndex];
  const storyId = getStoryId(story);
  const input = document.getElementById('storyReplyInput');
  const send = document.getElementById('storyReplySend');
  const message = String(input?.value || '').trim();

  if (!storyId || shopStoriesState.replying) return;
  if (message.length < 2) {
    setStoryReplyFeedback('متن پاسخ را وارد کنید.', 'error');
    updateStoryReplyFormState();
    return;
  }

  shopStoriesState.replying = true;
  if (send) send.disabled = true;
  setStoryPaused(true);
  setStoryReplyFeedback('در حال ارسال پاسخ...');

  try {
    const res = await fetch(`${SHOP_API_BASE}/api/seller/stories/public/${storyId}/replies`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Story-Reply-Key': getStoryReplyKey()
      },
      body: JSON.stringify({ message })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || 'امکان ارسال پاسخ وجود ندارد.');
    }

    if (data.story) Object.assign(story, data.story);
    if (input) {
      input.value = '';
      input.style.height = '';
    }
    setStoryReplyFeedback('پاسخ شما ارسال شد.');
    renderShopStories(shopStoriesState.stories);
  } catch (error) {
    console.warn('ارسال پاسخ استوری ناموفق بود:', error);
    setStoryReplyFeedback('ارسال پاسخ انجام نشد. دوباره تلاش کنید.', 'error');
  } finally {
    shopStoriesState.replying = false;
    updateStoryReplyFormState();
  }
}

// ======== لود داده و داینامیک‌سازی کل اطلاعات فروشگاه ========
async function loadShopData() {
  if (!slug && !sellerIdParam) {
    setShopCategoryBadge(getStoredShopCategory());
    shopStoriesState.hasShopContext = false;
    renderStoriesUnavailable();
    return;
  }
  try {
    const shopEndpoint = slug
      ? `${SHOP_API_BASE}/api/shopAppearance/url/${encodeURIComponent(slug)}`
      : `${SHOP_API_BASE}/api/shopAppearance/${encodeURIComponent(sellerIdParam)}`;
    const res = await fetch(shopEndpoint);
    if (!res.ok) throw new Error('فروشگاه یافت نشد!');
    const data = await res.json();

    // ← وقتی اطلاعات فروشگاه لود شد، شناسه‌ش رو توی currentSellerId ذخیره می‌کنیم
    currentSellerId = resolveShopDataSellerId(data) || normalizeSellerId(sellerIdParam);
    const resolvedAvatarUrl = data.shopLogo || data.boardImage || data.sellerId?.boardImage || data.footerImage || '';
    const resolvedShopName = data.shopLogoText || data.shopName || 'نام فروشگاه';
    shopStoriesState.avatarUrl = resolvedAvatarUrl;
    shopStoriesState.shopName = resolvedShopName;
    shopStoriesState.hasShopContext = Boolean(currentSellerId);
    setSimilarShopContext({
      sellerId: currentSellerId,
      shopUrl: slug || data.customUrl || data.shopurl || '',
      name: data.shopLogoText || data.shopName || '',
      category: resolveShopCategory(data),
      city: data.shopCity || data.city || '',
      address: data.shopAddress || '',
      rating: data.averageRating || 0,
      logo: data.shopLogo || data.boardImage || ''
    });
    loadShopStories(currentSellerId);

    // لوگو و نام فروشگاه
    document.querySelectorAll('.logo-txt').forEach(el =>
      el.textContent = resolvedShopName
    );
    setTextById('currentShopName', resolvedShopName);
    const drawerShopName = document.getElementById('drawerShopName');
    if (drawerShopName) drawerShopName.textContent = resolvedShopName;
    const shopHeaderDesc = data.shopShortDesc || data.shortDescription || data.description || data.shopDescription || 'فروشگاه آنلاین';
    document.querySelectorAll('.logo-caption').forEach(el => {
      el.textContent = shopHeaderDesc;
    });
    const drawerShopCaption = document.getElementById('drawerShopCaption');
    if (drawerShopCaption) drawerShopCaption.textContent = shopHeaderDesc;
    const resolvedShopCategory = resolveShopCategory(data);
    setShopCategoryBadge(resolvedShopCategory);
    const drawerShopCategory = document.getElementById('drawerShopCategory');
    setDrawerOptionalRow('drawerWorkingHoursRow', 'drawerWorkingHoursText', resolveWorkingHoursText(data));
    setDrawerOptionalRow(
      'drawerAboutShopRow',
      'drawerAboutShopText',
      data.aboutShop || data.about || data.shopAbout || data.fullDescription || data.shopDescription || ''
    );
    setDrawerOptionalRow(
      'drawerCategoryRow',
      'drawerCategoryText',
      resolvedShopCategory
    );

    // وضعیت فروشگاه (باز/بسته) — آپدیت چیپ هدر موبایل و بج قدیمی
    const shopStatusEl = document.getElementById('shop-status');
    const mobileStatusBadge = document.querySelector('.mobile-status-badge');
    const coverStatusBadge = document.getElementById('shopCoverStatusBadge');
    const coverStatusText = coverStatusBadge ? coverStatusBadge.querySelector('.shop-cover-status-text') : null;
    const drawerStatusBadge = document.getElementById('drawerShopStatus');
    const drawerStatusText = drawerStatusBadge ? drawerStatusBadge.querySelector('.drawer-status-text') : null;
    const isClosed = data.shopStatus === 'closed';
    const hasStatusData = data.shopStatus === 'open' || data.shopStatus === 'closed';
    if (mobileStatusBadge) {
      mobileStatusBadge.textContent = isClosed ? 'بسته' : 'باز';
      mobileStatusBadge.classList.toggle('is-closed', isClosed);
    }
    if (coverStatusBadge && coverStatusText) {
      coverStatusBadge.classList.remove('is-open', 'is-closed', 'is-unknown');
      if (!hasStatusData) {
        coverStatusBadge.classList.add('is-unknown');
        coverStatusText.textContent = 'نامشخص';
      } else {
        coverStatusBadge.classList.add(isClosed ? 'is-closed' : 'is-open');
        coverStatusText.textContent = isClosed ? 'بسته است' : 'باز است';
      }
    }
    if (drawerStatusBadge && drawerStatusText) {
      drawerStatusBadge.hidden = !hasStatusData;
      drawerStatusBadge.classList.remove('is-open', 'is-closed', 'is-unknown');
      drawerStatusBadge.classList.add(!hasStatusData ? 'is-unknown' : (isClosed ? 'is-closed' : 'is-open'));
      drawerStatusText.textContent = isClosed ? 'بسته است' : 'باز است';
    }
    if (coverStatusBadge && coverStatusText) {
      const coverStatusLabel = coverStatusText.textContent || '';
      coverStatusBadge.setAttribute('aria-label', `\u0648\u0636\u0639\u06cc\u062a \u0641\u0631\u0648\u0634\u06af\u0627\u0647: ${coverStatusLabel}`);
      coverStatusBadge.title = coverStatusLabel;
    }
    if (shopStatusEl) {
      shopStatusEl.innerHTML =
        data.shopStatus === 'closed'
          ? '<span class="w-2 h-2 rounded-full bg-red-400 inline-block"></span> بسته است'
          : '<span class="w-2 h-2 rounded-full bg-green-400 inline-block"></span> باز است';
    }

    // آدرس و شماره تماس
    const addressContent = document.querySelector('#addressModal .text-gray-800');
    if (addressContent) {
      addressContent.innerHTML = `
        ${data.shopAddress || 'آدرس ثبت نشده'}
        <br>
        <span class="text-emerald-700 text-sm font-semibold mt-1 flex items-center justify-center gap-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M3 5h12M9 3v2m0 14a4 4 0 100-8 4 4 0 000 8zm7-4h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2z"/>
          </svg>
          شماره تماس: <b dir="ltr" class="font-bold mx-1">${data.shopPhone || '-'}</b>
        </span>
      `;
    }

    // Compact mobile address line (one-line, ellipsis). Always visible in header.
    const mobileAddressLine = document.getElementById('mobileAddressLine');
    const mobileAddressText = document.getElementById('mobileAddressText');
    if (mobileAddressLine && mobileAddressText) {
      const cleanAddress = typeof data.shopAddress === 'string' ? data.shopAddress.trim() : '';
      mobileAddressText.textContent = cleanAddress || 'آدرس ثبت نشده';
      mobileAddressLine.classList.toggle('is-empty', !cleanAddress);
    }

    // امتیاز میانگین کاربران و تعداد کل امتیازها
    const avg = typeof data.averageRating === 'number'
      ? parseFloat(data.averageRating).toFixed(1)
      : '0.0';
    setTextById('shop-rating', avg);
    const mobileRating = document.getElementById('mobile-shop-rating');
    if (mobileRating) mobileRating.textContent = avg;

    const ratingCount = typeof data.ratingCount === 'number'
      ? data.ratingCount
      : 0;
    // بروزرسانی مقدار پاک رتبه در پنل منو (سمت چپ ردیف امتیاز)
    setTextById('drawerRatingValue', formatDrawerRatingValue(data.averageRating, ratingCount));
    const formattedRatingCount = ratingCount.toLocaleString();
    setTextById('rating-count', formattedRatingCount);
    const mobileRatingCount = document.getElementById('mobile-rating-count');
    if (mobileRatingCount) mobileRatingCount.textContent = formattedRatingCount;

    try {
      const favRes = await fetch(`${SHOP_API_BASE}/api/favorite-shops/count/${currentSellerId}`);
      if (favRes.ok) {
        const { count: favCount = 0 } = await favRes.json();
        setCustomerCount(favCount);
      } else {
        setCustomerCount(0);
      }
    } catch {
      setCustomerCount(0);
    }

    // اسلایدر
    renderHeroSlider(data.slides || []);

    // داینامیک سازی متاتگ‌ها و سئو
    setDynamicSEO(data);

    // محصولات را جدا بگیر
    const resolvedSlug = slug || data.customUrl || data.shopurl || '';
    setSimilarShopContext({ shopUrl: resolvedSlug });
    if (resolvedSlug) loadShopProducts(resolvedSlug);
    else {
      renderProducts([]);
      loadSimilarShops();
    }

  } catch (e) {
    console.error(e);
    shopStoriesState.hasShopContext = false;
    renderStoriesUnavailable();
    document.querySelectorAll('.logo-txt').forEach(el => el.textContent = 'نام فروشگاه');
    setTextById('currentShopName', 'نام فروشگاه');
    setShopCategoryBadge('');
    setDynamicSEO({
      shopName: 'نام فروشگاه',
      shopShortDesc: 'فروشگاه آنلاین',
      shopCity: '',
      shopTags: ''
    });
    renderSimilarShops([]);
  }
}


// ======== گرفتن و رندر محصولات فروشگاه بر اساس shopurl ========
async function loadShopProducts(shopurl) {
  try {
    const res = await fetch(`${SHOP_API_BASE}/api/products/shop/${shopurl}`);
    const products = await res.json();
    const inferredCategory = inferPrimaryProductCategory(products);
    if (inferredCategory && !similarShopState.current.category) {
      setShopCategoryBadge(inferredCategory);
    }
    renderProducts(products);
  } catch (err) {
    renderProducts([]);
  }
}

// ======== رندر محصولات فروشگاه ========
function renderProducts(products = []) {
  console.log("PRODUCTS:", products); // فقط برای دیباگ
  const grid = document.getElementById('productGrid');
  const noMsg = document.getElementById('noProductsMsg');
  if (!products.length) {
    if (grid) grid.innerHTML = "";
    if (noMsg) noMsg.classList.remove("hidden");
    return;
  }
  if (noMsg) noMsg.classList.add("hidden");
  grid.innerHTML = products.map((p, i) => {
    let badgeClass = 'product-chip';
    if (p.badgeType === "best") badgeClass += ' best';
    else if (p.badgeType === "new") badgeClass += ' new';
    else if (p.badgeType === "sale") badgeClass += ' sale';

    // ساپورت هم img و هم images
    let imageUrl = 'assets/images/shop-placeholder.svg';
    if (p.images && Array.isArray(p.images) && p.images.length > 0) {
      imageUrl = p.images[p.mainImageIndex ?? 0] || p.images[0];
    } else if (p.image) {
      imageUrl = p.image;
    } else if (p.img) {
      imageUrl = p.img;
    }
    if (imageUrl && !/^(https?:|data:|\/)/i.test(imageUrl)) {
      imageUrl = `/${imageUrl.replace(/^\.?\//, '')}`;
    }

    return `
      <article class="product-card" data-cat="${p.category}" data-idx="${i}">
        <div class="product-media">
          <img src="${imageUrl}" alt="${p.title}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='assets/images/shop-placeholder.svg';" />
          <div class="product-badges">
            ${p.badge ? `<span class="${badgeClass}">${p.badge}</span>` : ''}
          </div>
        </div>
        <div class="product-body">
          <h3 class="product-title" title="${p.title}">${p.title}</h3>
          <div class="product-category">${p.category || 'دسته‌بندی نشده'}</div>
          <div class="product-meta">
            <div class="product-price">${p.price?.toLocaleString?.() || p.priceTxt || ''} <span class="price-note">تومان</span></div>
          </div>
        </div>
        <button class="onyx-btn details-btn" aria-label="مشاهده ${p.title}" data-idx="${i}">
          <span>مشاهده محصول</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m-7-7l7 7-7 7" />
          </svg>
        </button>
      </article>
    `;
  }).join('');
  document.querySelectorAll('.details-btn').forEach((btn, idx) => {
    btn.onclick = function () {
  window.location.href = `product.html?id=${products[idx]._id}`;
};

  });
}


// ======== رندر اسلایدر داینامیک ========
function renderHeroSlider(slidesArr = []) {
  const heroSlider = document.getElementById('heroSliderSection');
  if (!heroSlider) return;
  heroSlider.querySelectorAll('.slide').forEach(el => el.remove());
  if (!slidesArr.length) {
    heroSlider.insertAdjacentHTML('afterbegin', `
      <div class="slide active">
        <img src="https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80&format=webp" alt="اسلاید پیش‌فرض" loading="lazy"/>
        <div class="slide-caption">
          <h2 class="slide-title">اسلاید نمونه</h2>
        </div>
      </div>
    `);
    return;
  }
  slidesArr.forEach((slide, i) => {
    heroSlider.insertAdjacentHTML('beforeend', `
      <div class="slide${i === 0 ? ' active' : ''}">
        <img src="${slide.img || ''}" alt="${slide.title || 'اسلاید'}" loading="lazy"/>
        <div class="slide-caption">
          <h2 class="slide-title">${slide.title || ''}</h2>
          <p class="slide-desc">${slide.desc || ''}</p>
        </div>
      </div>
    `);
  });
  let slides = Array.from(heroSlider.querySelectorAll('.slide'));
  let current = 0;
  const dots = document.getElementById('sliderDots');
  if (dots) {
    dots.innerHTML = '';
    slides.forEach((_, idx) => {
      const dot = document.createElement('span');
      dot.className = `slider-dot${idx === 0 ? ' active' : ''}`;
      dot.onclick = () => gotoSlide(idx);
      dots.appendChild(dot);
    });
  }
  function gotoSlide(idx) {
    slides.forEach((el, j) => el.classList.toggle('active', j === idx));
    if (dots) {
      dots.querySelectorAll('.slider-dot').forEach((el, j) => el.classList.toggle('active', j === idx));
    }
    current = idx;
  }
  document.getElementById('prevSlide').onclick = () => gotoSlide((current - 1 + slides.length) % slides.length);
  document.getElementById('nextSlide').onclick = () => gotoSlide((current + 1) % slides.length);
  setInterval(() => gotoSlide((current + 1) % slides.length), 6000);
}


// ========== اجرا بعد از لود صفحه ==========
document.addEventListener('DOMContentLoaded', function () {
  loadShopData();
  const shopHeader = document.getElementById('shopHeader');
  const headerMenuToggle = document.getElementById('headerMenuToggle');

  const closeHeaderMenu = () => {
    if (!shopHeader || !headerMenuToggle) return;
    shopHeader.classList.remove('menu-open');
    document.body.classList.remove('shop-menu-open');
    headerMenuToggle.setAttribute('aria-expanded', 'false');
  };

  if (shopHeader && headerMenuToggle) {
    const headerActions = document.getElementById('headerActions');

    headerMenuToggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = shopHeader.classList.toggle('menu-open');
      document.body.classList.toggle('shop-menu-open', isOpen);
      headerMenuToggle.setAttribute('aria-expanded', String(isOpen));
    });

    if (headerActions) {
      headerActions.querySelectorAll('button').forEach((actionButton) => {
        actionButton.addEventListener('click', () => {
          if (actionButton.hasAttribute('data-menu-stay-open')) return;
          if (window.innerWidth <= 900) {
            requestAnimationFrame(() => closeHeaderMenu());
          }
        });
      });
    }

    document.addEventListener('click', (event) => {
      if (!shopHeader.contains(event.target)) {
        closeHeaderMenu();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeHeaderMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) {
        closeHeaderMenu();
      }
    });
  }

  const updateDrawerHint = (id, message, fallback) => {
    const hint = document.getElementById(id);
    if (!hint) return;
    hint.textContent = message;
    window.clearTimeout(hint.dataset.resetTimer);
    hint.dataset.resetTimer = window.setTimeout(() => {
      hint.textContent = fallback;
      delete hint.dataset.resetTimer;
    }, 1800);
  };

  const copyShopUrl = async () => {
    const shareUrl = getCurrentShopShareUrl();
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const field = document.createElement('textarea');
        field.value = shareUrl;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        field.remove();
      }
      updateDrawerHint('copyShopLinkHint', 'لینک فروشگاه کپی شد', 'ذخیره لینک در کلیپ‌بورد');
      return true;
    } catch (error) {
      console.warn('Copy shop link failed', error);
      updateDrawerHint('copyShopLinkHint', 'کپی لینک انجام نشد', 'ذخیره لینک در کلیپ‌بورد');
      return false;
    }
  };

  document.getElementById('copyShopLinkBtn')?.addEventListener('click', copyShopUrl);

  const scrollTopBtn = document.getElementById('scrollTopBtn');
  window.onscroll = () => {
    if (scrollTopBtn) scrollTopBtn.classList.toggle('hidden', window.scrollY < 300);
  }
  if (scrollTopBtn)
    scrollTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  document.getElementById('storyViewerClose')?.addEventListener('click', closeStoryViewer);
  document.getElementById('storyViewerNext')?.addEventListener('click', showNextStory);
  document.getElementById('storyViewerPrev')?.addEventListener('click', showPrevStory);
  document.getElementById('storyViewerReact')?.addEventListener('click', reactToCurrentStory);
  document.getElementById('storyReplyForm')?.addEventListener('submit', submitStoryReply);
  document.getElementById('storyReplyInput')?.addEventListener('input', (event) => {
    const input = event.currentTarget;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 92)}px`;
    setStoryReplyFeedback('');
    updateStoryReplyFormState();
  });
  document.getElementById('storyReplyInput')?.addEventListener('focus', () => setStoryPaused(true));

  const storyViewer = document.getElementById('storyViewer');
  const storyViewerCard = document.getElementById('storyViewerCard');
  storyViewer?.addEventListener('click', (event) => {
    if (event.target === storyViewer) closeStoryViewer();
  });

  const beginStoryPointer = (event) => {
    if (event.target?.closest?.('button, input, textarea, form, .story-reply-form')) return;
    const point = event.touches?.[0] || event;
    shopStoriesState.viewerTouchX = point.clientX ?? null;
    shopStoriesState.viewerTouchY = point.clientY ?? null;
    shopStoriesState.viewerPointerStartedAt = Date.now();
    shopStoriesState.viewerWasPausedBeforePointer = shopStoriesState.viewerPaused;
    setStoryPaused(true);
  };

  const endStoryPointer = (event) => {
    if (shopStoriesState.viewerTouchX === null) return;
    const point = event.changedTouches?.[0] || event;
    const endX = point.clientX ?? shopStoriesState.viewerTouchX;
    const endY = point.clientY ?? shopStoriesState.viewerTouchY;
    const deltaX = endX - shopStoriesState.viewerTouchX;
    const deltaY = endY - shopStoriesState.viewerTouchY;
    const duration = Date.now() - shopStoriesState.viewerPointerStartedAt;
    const wasPaused = shopStoriesState.viewerWasPausedBeforePointer;

    shopStoriesState.viewerTouchX = null;
    shopStoriesState.viewerTouchY = null;

    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
      setStoryPaused(false);
      if (deltaX > 0) showPrevStory();
      else showNextStory();
      return;
    }

    if (duration < 260 && Math.abs(deltaX) < 18 && Math.abs(deltaY) < 18) {
      setStoryPaused(!wasPaused);
      return;
    }

    if (!wasPaused) setStoryPaused(false);
  };

  storyViewerCard?.addEventListener('pointerdown', beginStoryPointer);
  storyViewerCard?.addEventListener('pointerup', endStoryPointer);
  storyViewerCard?.addEventListener('pointercancel', () => {
    const wasPaused = shopStoriesState.viewerWasPausedBeforePointer;
    shopStoriesState.viewerTouchX = null;
    shopStoriesState.viewerTouchY = null;
    if (!wasPaused) setStoryPaused(false);
  });

  document.addEventListener('keydown', (event) => {
    if (!storyViewer?.classList.contains('is-open')) return;
    if (event.key === 'Escape') closeStoryViewer();
    if (event.key === 'ArrowLeft') showNextStory();
    if (event.key === 'ArrowRight') showPrevStory();
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      toggleStoryPaused();
    }
  });
});





// کنترل باز و بسته شدن مودال آدرس فروشگاه
document.addEventListener('DOMContentLoaded', function () {
  const addressBtn = document.getElementById('addressBtn');
  const mobileAddressBtn = document.getElementById('mobileAddressBtn');
  const addressModal = document.getElementById('addressModal');
  const closeAddressModal = document.getElementById('closeAddressModal');

  const openAddressModal = function() {
    addressModal.classList.remove('hidden');
  };

  if (addressBtn && addressModal) {
    addressBtn.onclick = openAddressModal;
  }
  if (mobileAddressBtn && addressModal) {
    mobileAddressBtn.onclick = openAddressModal;
  }
  const mobileAddressLineBtn = document.getElementById('mobileAddressLine');
  if (mobileAddressLineBtn && addressModal) {
    mobileAddressLineBtn.onclick = openAddressModal;
  }
  if (closeAddressModal && addressModal) {
    closeAddressModal.onclick = function() {
      addressModal.classList.add('hidden');
    }
  }
  if (addressModal) {
    addressModal.addEventListener('click', function(e) {
      if (e.target === addressModal) {
        addressModal.classList.add('hidden');
      }
    });
  }
});








document.addEventListener('DOMContentLoaded', () => {

/* ───────────────── ثابت‌ها و ابزار‌ها ──────────────── */
const API_BASE     = 'http://localhost:5000';     // آدرس بک‌اند
const AUTH_CHECK   = `${API_BASE}/api/auth/getCurrentUser`;
const REPORT_URL   = `${API_BASE}/api/reports`;

/* ‌────────── المان‌های صفحه ────────── */
/* 1) مودال آدرس */
const addressBtn        = document.getElementById('addressBtn');
const mobileAddressBtn  = document.getElementById('mobileAddressBtn');
const addressModal      = document.getElementById('addressModal');
const closeAddressModal = document.getElementById('closeAddressModal');

/* 2) گزارش تخلف */
const $btn   = document.getElementById('reportBtn');
const $modal = document.getElementById('reportModal');
const $close = document.getElementById('closeReportModal');

const $type  = document.getElementById('reportType');
const $txt   = document.getElementById('reportText');
const $send  = document.getElementById('submitReport');
const $msg   = document.getElementById('reportMsg');

/* ───────────── کمک‌خرج‌ها ───────────── */

/* ───────────── کمک‌خرج‌ها ───────────── */
const showMsg = (text = '', ok = true) => {
  $msg.textContent = text;
  $msg.className   = ok ? 'text-green-500 font-bold mt-1'
                        : 'text-red-500  font-bold mt-1';
};

const isLoggedIn = async () => {
  try {
    const res = await fetch(AUTH_CHECK, { credentials: 'include' });
    return res.ok;                  // کوکی معتبر → ۲۰۰
  } catch {
    return false;
  }
};


/* ───────────── مودال آدرس ───────────── */
addressBtn?.addEventListener('click', () => addressModal?.classList.remove('hidden'));
mobileAddressBtn?.addEventListener('click', () => addressModal?.classList.remove('hidden'));
closeAddressModal?.addEventListener('click', () => addressModal?.classList.add('hidden'));
addressModal?.addEventListener('click', e => (e.target === addressModal) && addressModal.classList.add('hidden'));

/* ───────────── مودال گزارش ───────────── */
  // ───────────── گزارش تخلف ─────────────
  const resetForm = () => {
    showMsg('');
    $type.value = 'price_mismatch';
    $txt.value  = '';
  };

  const openModal  = () => { resetForm(); $modal.classList.remove('hidden'); };
  const closeModal = () =>   $modal.classList.add('hidden');

  $btn  ?.addEventListener('click', openModal);
  $close?.addEventListener('click', closeModal);
  $modal?.addEventListener('click', e => (e.target === $modal) && closeModal());

  /* ───────────── ارسال گزارش ───────────── */
  $send?.addEventListener('click', async () => {

    const description = $txt.value.trim();
    const type        = $type.value;

    if (description.length < 5)
      return showMsg('توضیح حداقل ۵ کاراکتر باشد.', false);

    if (!(await isLoggedIn()))
      return askForLogin({ type, description });

    $send.disabled    = true;
    $send.textContent = 'در حال ارسال…';

    try {
      const res = await fetch(REPORT_URL, {
        method      : 'POST',
        credentials : 'include',
        headers     : { 'Content-Type': 'application/json' },
        body        : JSON.stringify({ type, description, sellerId: currentSellerId, shopurl: slug })
      });

      if (res.status === 401) return askForLogin({ type, description });
      if (res.status === 429) return showMsg('لطفاً یک دقیقه بعد دوباره تلاش کنید.', false);
      if (!res.ok)            return showMsg('خطا! دوباره امتحان کنید.', false);

      showMsg('✅ گزارش با موفقیت ثبت شد');
      setTimeout(closeModal, 2000);

    } catch (err) {
      console.error(err);
      showMsg('خطای شبکه؛ بعداً تلاش کنید.', false);
    } finally {
      $send.disabled    = false;
      $send.textContent = 'ارسال گزارش';
    }
  });

  /* ───── پرسش برای ورود ───── */
  function askForLogin(draft) {
    $send.disabled    = false;
    $send.textContent = 'ارسال گزارش';

    if (confirm('برای ارسال گزارش باید وارد شوید. مایلید به صفحهٔ ورود بروید؟')) {
      window.SafeSS.setJSON('afterLoginReturn', location.href);
      window.SafeSS.setJSON('reportDraft', draft);
      location.href = '/login.html';
    } else {
      showMsg('ابتدا وارد حساب شوید سپس دوباره گزارش دهید.', false);
    }
  }

  /* ───── بازیابی پیش‌نویس پس از ورود ───── */
  (async () => {
    const draft = window.SafeSS.getJSON('reportDraft');
    if (!draft) return;
    if (!(await isLoggedIn())) return;  // هنوز وارد نشده

    const { type, description } = draft;
    sessionStorage.removeItem('reportDraft');

    $type.value = type;
    $txt.value  = description;
    $modal.classList.remove('hidden');
  })();

  // ───────────── امتیازدهی ─────────────
  const rateShow       = document.getElementById('rateShow');
  const mobileRateShow = document.getElementById('mobileRateShow');
  const rateModal      = document.getElementById('rateModal');
  const closeRateModal = document.getElementById('closeRateModal');
  const rateStars      = document.getElementById('rateStars');
  const submitRateBtn  = document.getElementById('submitRate');
  const rateMsg        = document.getElementById('rateMsg');
  let   selectedRating = 0;

  function renderStars(rating = 0) {
    rateStars.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.className    = `rate-star ${i <= rating ? 'active' : 'inactive'}`;
      star.textContent  = '★';
      star.dataset.value = i;
      star.addEventListener('click', () => {
        selectedRating = i;
        renderStars(i);
      });
      rateStars.appendChild(star);
    }
  }

  const openRateModal = async () => {
    if (!(await isLoggedIn())) {
      if (confirm('برای ثبت امتیاز باید وارد شوید. به صفحهٔ ورود بروید؟')) {
        window.SafeSS.setJSON('afterLoginReturn', location.href);
        location.href = '/login.html';
      }
      return;
    }
    selectedRating = 0;
    renderStars(0);
    rateMsg.classList.add('hidden');
    rateModal.classList.remove('hidden');
  };

  rateShow?.addEventListener('click', openRateModal);
  mobileRateShow?.addEventListener('click', openRateModal);

  closeRateModal.addEventListener('click', () => rateModal.classList.add('hidden'));
  rateModal.addEventListener('click', e => {
    if (e.target === rateModal) closeRateModal.click();
  });

  submitRateBtn.addEventListener('click', async () => {
    if (selectedRating < 1) {
      rateMsg.textContent = 'لطفاً یک امتیاز انتخاب کنید.';
      rateMsg.className   = 'text-red-500 font-bold mt-1';
      rateMsg.classList.remove('hidden');
      return;
    }
    submitRateBtn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/api/shopAppearance/${currentSellerId}/rate`, {
        method      : 'POST',
        credentials : 'include',
        headers     : { 'Content-Type': 'application/json' },
        body        : JSON.stringify({ rating: selectedRating })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'خطا در ثبت امتیاز');

      const updatedAverageRating = parseFloat(data.averageRating).toFixed(1);
      setTextById('shop-rating', updatedAverageRating);
      const mobileRating = document.getElementById('mobile-shop-rating');
      if (mobileRating) mobileRating.textContent = updatedAverageRating;
      setTextById('drawerRatingValue', formatDrawerRatingValue(data.averageRating, data.ratingCount));
      if (typeof data.ratingCount === 'number') {
        const formattedRatingCount = data.ratingCount.toLocaleString();
        setTextById('rating-count', formattedRatingCount);
        const mobileRatingCount = document.getElementById('mobile-rating-count');
        if (mobileRatingCount) mobileRatingCount.textContent = formattedRatingCount;
      }
      rateMsg.textContent = '✅ امتیاز با موفقیت ثبت شد.';
      rateMsg.className   = 'text-green-500 font-bold mt-1';
      rateModal.classList.add('hidden');
    } catch (err) {
      rateMsg.textContent = err.message;
      rateMsg.className   = 'text-red-500 font-bold mt-1';
      rateMsg.classList.remove('hidden');
    } finally {
      submitRateBtn.disabled = false;
    }
  });

  // ───────────── مغازه محبوب ─────────────
  const favShopBtn       = document.getElementById('favShopBtn');
  const customerTriggers = document.querySelectorAll('[data-customer-trigger]');
  const favShopModal     = document.getElementById('favShopModal');
  const closeFavShop     = document.getElementById('closeFavShopModal');
  const favShopCountEl   = document.getElementById('favShopCount');
  const toggleFavShopBtn = document.getElementById('toggleFavShopBtn');
  const favSuccessNotice = document.getElementById('favSuccessNotice');
  let favSuccessTimer    = null;

  const setFavBtnLabel = (text) => {
    if (!toggleFavShopBtn) return;
    const label = toggleFavShopBtn.querySelector('.fav-cta-text');
    if (label) label.textContent = text;
    else toggleFavShopBtn.textContent = text;
  };

  async function refreshFavShopInfo() {
    if (!toggleFavShopBtn) return 0;

    let count = 0;
    try {
      const res = await fetch(`${API_BASE}/api/favorite-shops/count/${currentSellerId}`);
      const data = await res.json();
      count = Number.isFinite(data?.count) ? data.count : 0;
      favShopCountEl.textContent = count;
      setCustomerCount(count);
    } catch {
      favShopCountEl.textContent = 0;
      setCustomerCount(0);
    }

    const loggedIn = await isLoggedIn();
    toggleFavShopBtn.dataset.auth = loggedIn ? 'true' : 'false';

    if (!loggedIn) {
      toggleFavShopBtn.dataset.added = 'false';
      setFavBtnLabel('ورود برای افزودن به محبوب‌ها');
      return count;
    }

    let added = false;
    try {
      const res2 = await fetch(`${API_BASE}/api/favorite-shops`, { credentials: 'include' });
      if (res2.ok) {
        const shops = await res2.json();
        added = shops.some(s => s._id === currentSellerId);
      }
    } catch {}

    toggleFavShopBtn.dataset.added = added ? 'true' : 'false';
    setFavBtnLabel(added ? 'افزوده شد' : 'افزودن به محبوب‌ها');

    return count;
  }

  async function ensureFavoriteLogin({ silent = false } = {}) {
    if (await isLoggedIn()) return true;

    if (silent) return false;

    const goLogin = confirm('برای افزودن مغازه به محبوب‌ها باید وارد شوید. آیا مایل به ورود هستید؟');
    if (goLogin) {
      if (window.SafeSS && typeof window.SafeSS.setJSON === 'function') {
        window.SafeSS.setJSON('afterLoginReturn', location.href);
      }
      location.href = '/login.html';
    } else {
      alert('ابتدا وارد حساب کاربری خود شوید.');
    }
    return false;
  }

  const hideFavSuccessNotice = () => {
    favSuccessNotice?.classList.add('hidden');
    if (favSuccessTimer) {
      clearTimeout(favSuccessTimer);
      favSuccessTimer = null;
    }
  };

  const showFavSuccessNotice = (totalCustomers) => {
    if (typeof totalCustomers === 'number') {
      favShopCountEl.textContent = totalCustomers.toLocaleString();
      setCustomerCount(totalCustomers);
    }
    favShopModal.classList.remove('hidden');
    favSuccessNotice?.classList.remove('hidden');
    if (favSuccessTimer) clearTimeout(favSuccessTimer);
    favSuccessTimer = setTimeout(hideFavSuccessNotice, 4500);
  };

  const openCustomerModal = async () => {
    hideFavSuccessNotice();
    await refreshFavShopInfo();
    favShopModal.classList.remove('hidden');
  };

  favShopBtn?.addEventListener('click', openCustomerModal);
  customerTriggers.forEach((trigger) => {
    trigger.addEventListener('click', openCustomerModal);
  });

  closeFavShop?.addEventListener('click', () => {
    hideFavSuccessNotice();
    favShopModal.classList.add('hidden');
  });
  favShopModal?.addEventListener('click', e => {
    if (e.target === favShopModal) {
      hideFavSuccessNotice();
      favShopModal.classList.add('hidden');
    }
  });

  toggleFavShopBtn?.addEventListener('click', async () => {
    if (!(await ensureFavoriteLogin())) return;

    const added = toggleFavShopBtn.dataset.added === 'true';
    toggleFavShopBtn.disabled = true;
    setFavBtnLabel('در حال بروزرسانی…');
    try {
      const res = await fetch(`${API_BASE}/api/favorite-shops/${currentSellerId}`, {
        method: added ? 'DELETE' : 'POST',
        credentials: 'include'
      });
      if (res.status === 401) {
        toggleFavShopBtn.dataset.auth = 'false';
        setFavBtnLabel('ورود برای افزودن به محبوب‌ها');
        await ensureFavoriteLogin();
        return;
      }
      if (!res.ok) throw new Error('خطا در به‌روزرسانی محبوب‌ها');
      const updatedCount = await refreshFavShopInfo();
      if (!added) {
        emitCustomerAdded({ totalCustomers: updatedCount });
        showFavSuccessNotice(updatedCount);
      }
    } catch (err) {
      console.error(err);
      setFavBtnLabel('خطا! دوباره تلاش کنید');
      setTimeout(() => refreshFavShopInfo(), 1500);
      return;
    } finally {
      toggleFavShopBtn.disabled = false;
    }
  });

}); // پایان DOMContentLoaded












const similarShopState = {
  current: {},
  lastKey: '',
  sliderRaf: 0,
  gesture: {
    startX: 0,
    startY: 0,
    movedHorizontally: false,
    resetTimer: 0
  }
};

const SIMILAR_SHOPS_DEMO = [
  {
    id: 'demo-sahar-boutique',
    shopUrl: 'sahar-boutique',
    name: 'بوتیک سحر',
    category: 'پوشاک زنانه',
    subcategory: 'مانتو و استایل روزمره',
    city: 'تهران',
    address: 'تهران، ونک، خیابان خدامی',
    image: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=240&q=80',
    rating: 4.8,
    reviewCount: 126,
    verified: true,
    sponsored: true,
    shortInfo: 'ارسال سریع در محدوده ونک'
  },
  {
    id: 'demo-lavender-style',
    shopUrl: 'lavender-style',
    name: 'استایل لاوندر',
    category: 'پوشاک زنانه',
    subcategory: 'لباس مینیمال و مجلسی',
    city: 'تهران',
    address: 'تهران، سعادت‌آباد، سرو غربی',
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=240&q=80',
    rating: 4.7,
    reviewCount: 98,
    verified: true,
    sponsored: false,
    shortInfo: 'کالکشن‌های محدود و خوش‌دوخت'
  },
  {
    id: 'demo-rastin-shoes',
    shopUrl: 'rastin-shoes',
    name: 'کفش راستین',
    category: 'کیف و کفش',
    subcategory: 'کفش اسپرت و رسمی',
    city: 'تهران',
    address: 'تهران، جردن، بلوار گلشهر',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=240&q=80',
    rating: 4.6,
    reviewCount: 74,
    verified: false,
    sponsored: false,
    shortInfo: 'سایزبندی کامل و تعویض آسان'
  },
  {
    id: 'demo-narenj-accessory',
    shopUrl: 'narenj-accessory',
    name: 'اکسسوری نارنج',
    category: 'اکسسوری',
    subcategory: 'زیورآلات و کیف کوچک',
    city: 'تهران',
    address: 'تهران، یوسف‌آباد، خیابان جهان‌آرا',
    image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=240&q=80',
    rating: 4.9,
    reviewCount: 143,
    verified: true,
    sponsored: false,
    shortInfo: 'بسته‌بندی هدیه و محصولات دست‌ساز'
  },
  {
    id: 'demo-mehr-kids',
    shopUrl: 'mehr-kids',
    name: 'مهر کودک',
    category: 'پوشاک کودک',
    subcategory: 'لباس کودک و نوجوان',
    city: 'تهران',
    address: 'تهران، شهرک غرب، ایران‌زمین',
    image: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=240&q=80',
    rating: 4.5,
    reviewCount: 61,
    verified: false,
    sponsored: false,
    shortInfo: 'پارچه‌های نرم و مناسب فصل'
  },
  {
    id: 'demo-aria-denim',
    shopUrl: 'aria-denim',
    name: 'آریا دنیم',
    category: 'پوشاک مردانه',
    subcategory: 'جین، هودی و تی‌شرت',
    city: 'تهران',
    address: 'تهران، هفت‌تیر، خیابان مفتح',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=240&q=80',
    rating: 4.4,
    reviewCount: 89,
    verified: true,
    sponsored: true,
    shortInfo: 'استایل شهری با قیمت منطقی'
  },
  {
    id: 'demo-rosha-bag',
    shopUrl: 'rosha-bag',
    name: 'کیف روشا',
    category: 'کیف و کفش',
    subcategory: 'کیف روزمره و اداری',
    city: 'تهران',
    address: 'تهران، میرداماد، میدان مادر',
    image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=240&q=80',
    rating: 4.7,
    reviewCount: 112,
    verified: true,
    sponsored: false,
    shortInfo: 'چرم مصنوعی با دوخت تمیز'
  },
  {
    id: 'demo-nika-scarf',
    shopUrl: 'nika-scarf',
    name: 'شال و روسری نیکا',
    category: 'پوشاک زنانه',
    subcategory: 'شال، روسری و اکسسوری',
    city: 'تهران',
    address: 'تهران، کریمخان، خیابان خردمند',
    image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=240&q=80',
    rating: 4.6,
    reviewCount: 77,
    verified: false,
    sponsored: false,
    shortInfo: 'طرح‌های ساده برای استفاده روزانه'
  }
];

function normalizeSimilarText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeSimilarKey(value = '') {
  return normalizeSimilarText(value).toLowerCase();
}

function escapeSimilarHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toFaNumber(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '۰';
  return number.toLocaleString('fa-IR', options);
}

function resolveShopLink(shopUrl = '', fallback = '') {
  const safeUrl = normalizeSimilarText(shopUrl);
  if (fallback) return fallback;
  return safeUrl ? `shop.html?shopurl=${encodeURIComponent(safeUrl)}` : '#';
}

function extractShopCity(address = '') {
  const parts = normalizeSimilarText(address)
    .split(/[،,|-]/)
    .map(part => part.trim())
    .filter(Boolean);
  return parts[0] || '';
}

function inferPrimaryProductCategory(products = []) {
  const counts = new Map();
  products.forEach((product) => {
    const category = normalizeSimilarText(product?.category);
    if (!category) return;
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function setSimilarShopContext(partial = {}) {
  const next = { ...similarShopState.current, ...partial };
  next.shopUrl = normalizeSimilarText(next.shopUrl || slug || '');
  next.sellerId = normalizeSimilarText(next.sellerId || currentSellerId || sellerIdParam || '');
  next.category = normalizeSimilarText(next.category || '');
  next.city = normalizeSimilarText(next.city || extractShopCity(next.address || ''));
  next.address = normalizeSimilarText(next.address || '');
  similarShopState.current = next;
}

function buildSimilarContextLabel() {
  const { category, city } = similarShopState.current;
  if (category && city) return `${category} در ${city}`;
  if (category) return `دسته ${category}`;
  if (city) return `نزدیک ${city}`;
  return 'پوشاک، کیف و اکسسوری نزدیک شما';
}

function normalizeServiceSimilarShop(item = {}) {
  const category = normalizeSimilarText(item.categoryName || item.category || '');
  const city = normalizeSimilarText(item.city || extractShopCity(item.address || ''));
  const image = normalizeSimilarText(item.imageUrl || item.coverImage || item.logo || '/assets/images/shop-placeholder.svg');
  return {
    id: normalizeSimilarText(item.id || item._id || item.shopUrl),
    shopUrl: normalizeSimilarText(item.shopUrl || ''),
    sellerId: normalizeSimilarText(item.sellerId || item.legacySellerId || ''),
    name: normalizeSimilarText(item.name || item.storename || 'فروشگاه'),
    category,
    subcategory: normalizeSimilarText(item.subcategoryName || (Array.isArray(item.subcategories) ? item.subcategories.find(Boolean) : '')),
    city,
    address: normalizeSimilarText(item.address || ''),
    image,
    rating: Number(item.rating || item.averageRating || 0) || 0,
    reviewCount: Number(item.reviewCount || item.ratingCount || 0) || 0,
    verified: Boolean(item.isPremium || item.isFeatured || item.verified),
    sponsored: Boolean(item.isPromoted || item.isSponsored || item.sponsored),
    href: resolveShopLink(item.shopUrl, item.requestUrl || '')
  };
}

function normalizeLegacySimilarShop(item = {}) {
  const category = normalizeSimilarText(item.category || item.subcategory || '');
  const city = normalizeSimilarText(item.city || item.region || extractShopCity(item.address || ''));
  return {
    id: normalizeSimilarText(item.id || item._id || item.shopurl),
    shopUrl: normalizeSimilarText(item.shopurl || item.shopUrl || ''),
    sellerId: normalizeSimilarText(item.id || item._id || ''),
    name: normalizeSimilarText(item.storename || item.shopName || item.name || 'فروشگاه'),
    category,
    subcategory: normalizeSimilarText(item.subcategory || ''),
    city,
    address: normalizeSimilarText(item.address || ''),
    image: normalizeSimilarText(item.image || item.boardImage || item.shopLogo || '/assets/images/shop-placeholder.svg'),
    rating: Number(item.rating || item.averageRating || 0) || 0,
    reviewCount: Number(item.ratingCount || 0) || 0,
    verified: Boolean(item.isPremium || item.verified),
    sponsored: Boolean(item.isSponsored || item.sponsored),
    href: resolveShopLink(item.shopurl || item.shopUrl)
  };
}

function normalizeDemoSimilarShop(item = {}) {
  return {
    id: normalizeSimilarText(item.id),
    shopUrl: normalizeSimilarText(item.shopUrl),
    sellerId: normalizeSimilarText(item.sellerId || item.id),
    name: normalizeSimilarText(item.name || 'فروشگاه'),
    category: normalizeSimilarText(item.category || 'پوشاک'),
    subcategory: normalizeSimilarText(item.subcategory || ''),
    city: normalizeSimilarText(item.city || 'تهران'),
    address: normalizeSimilarText(item.address || ''),
    image: normalizeSimilarText(item.image || '/assets/images/shop-placeholder.svg'),
    rating: Number(item.rating || 0) || 0,
    reviewCount: Number(item.reviewCount || 0) || 0,
    verified: Boolean(item.verified),
    sponsored: Boolean(item.sponsored),
    shortInfo: normalizeSimilarText(item.shortInfo || ''),
    href: resolveShopLink(item.shopUrl)
  };
}

function getDemoSimilarShops() {
  return SIMILAR_SHOPS_DEMO.map(normalizeDemoSimilarShop);
}

function isCurrentSimilarShop(item = {}) {
  const current = similarShopState.current;
  const currentUrl = normalizeSimilarKey(current.shopUrl);
  const itemUrl = normalizeSimilarKey(item.shopUrl);
  const currentSeller = normalizeSimilarKey(current.sellerId);
  const itemSeller = normalizeSimilarKey(item.sellerId || item.id);
  return Boolean(
    (currentUrl && itemUrl && currentUrl === itemUrl) ||
    (currentSeller && itemSeller && currentSeller === itemSeller)
  );
}

function scoreSimilarShop(item = {}) {
  const current = similarShopState.current;
  const currentCategory = normalizeSimilarKey(current.category);
  const itemCategory = normalizeSimilarKey(`${item.category} ${item.subcategory}`);
  const currentCity = normalizeSimilarKey(current.city);
  const itemCity = normalizeSimilarKey(item.city);
  const currentAddress = normalizeSimilarKey(current.address);
  const itemAddress = normalizeSimilarKey(item.address);
  let score = 0;

  if (currentCategory && itemCategory) {
    if (itemCategory.includes(currentCategory) || currentCategory.includes(itemCategory)) score += 58;
    else if (currentCategory.split(' ').some(token => token.length > 2 && itemCategory.includes(token))) score += 26;
  }
  if (currentCity && itemCity && currentCity === itemCity) score += 22;
  if (currentAddress && itemAddress && currentAddress.split(' ').some(token => token.length > 3 && itemAddress.includes(token))) score += 10;
  score += Math.min(5, Math.max(0, Number(item.rating || 0))) * 4;
  if (item.verified) score += 6;
  if (item.sponsored) score += 2;
  return score;
}

function resolveSimilarShopLocation(item = {}) {
  const currentCity = normalizeSimilarKey(similarShopState.current.city);
  const itemCity = normalizeSimilarText(item.city);
  if (itemCity && currentCity && normalizeSimilarKey(itemCity) === currentCity) return 'همین محدوده';
  return itemCity || normalizeSimilarText(item.address).split(/[،,|-]/).slice(0, 2).join('، ') || 'موقعیت ثبت نشده';
}

function getActiveSimilarShopIndex() {
  const list = document.getElementById('similarShopsList');
  if (!list) return 0;
  const cards = Array.from(list.querySelectorAll('.similar-shop-card'));
  if (!cards.length) return 0;

  const listRect = list.getBoundingClientRect();
  const viewportCenter = listRect.left + (listRect.width / 2);
  return cards.reduce((activeIndex, card, index) => {
    const cardRect = card.getBoundingClientRect();
    const cardCenter = cardRect.left + (cardRect.width / 2);
    const currentDistance = Math.abs(cardCenter - viewportCenter);
    const activeCard = cards[activeIndex];
    const activeRect = activeCard.getBoundingClientRect();
    const activeCenter = activeRect.left + (activeRect.width / 2);
    return currentDistance < Math.abs(activeCenter - viewportCenter) ? index : activeIndex;
  }, 0);
}

function updateSimilarShopDots(activeIndex = getActiveSimilarShopIndex()) {
  const dots = document.getElementById('similarShopsDots');
  if (!dots) return;
  Array.from(dots.children).forEach((dot, index) => {
    const isActive = index === activeIndex;
    dot.classList.toggle('is-active', isActive);
    dot.setAttribute('aria-current', isActive ? 'true' : 'false');
  });
}

function bindSimilarShopSlider() {
  const list = document.getElementById('similarShopsList');
  if (!list || list.dataset.sliderBound === 'true') return;
  list.dataset.sliderBound = 'true';

  const gesture = similarShopState.gesture;
  const resetGestureSoon = () => {
    clearTimeout(gesture.resetTimer);
    gesture.resetTimer = window.setTimeout(() => {
      list.classList.remove('is-dragging');
      gesture.movedHorizontally = false;
    }, 380);
  };
  const getTouchPoint = (event) => event.touches?.[0] || event.changedTouches?.[0] || event;

  list.addEventListener('touchstart', (event) => {
    const point = getTouchPoint(event);
    gesture.startX = point.clientX || 0;
    gesture.startY = point.clientY || 0;
    gesture.movedHorizontally = false;
    clearTimeout(gesture.resetTimer);
  }, { passive: true });

  list.addEventListener('touchmove', (event) => {
    const point = getTouchPoint(event);
    const deltaX = Math.abs((point.clientX || 0) - gesture.startX);
    const deltaY = Math.abs((point.clientY || 0) - gesture.startY);
    if (deltaX > 8 && deltaX > deltaY * 1.15) {
      gesture.movedHorizontally = true;
      list.classList.add('is-dragging');
    }
  }, { passive: true });

  list.addEventListener('touchend', resetGestureSoon, { passive: true });
  list.addEventListener('touchcancel', resetGestureSoon, { passive: true });

  list.addEventListener('click', (event) => {
    if (!gesture.movedHorizontally) return;
    event.preventDefault();
    event.stopPropagation();
    resetGestureSoon();
  }, true);

  list.addEventListener('dragstart', (event) => event.preventDefault());

  list.addEventListener('scroll', () => {
    if (similarShopState.sliderRaf) return;
    similarShopState.sliderRaf = requestAnimationFrame(() => {
      similarShopState.sliderRaf = 0;
      updateSimilarShopDots();
    });
  }, { passive: true });

  window.addEventListener('resize', () => updateSimilarShopDots(), { passive: true });
}

function renderSimilarShopDots(count = 0) {
  const dots = document.getElementById('similarShopsDots');
  const list = document.getElementById('similarShopsList');
  if (!dots || !list) return;

  dots.innerHTML = '';
  if (count <= 1) {
    dots.hidden = true;
    return;
  }

  dots.hidden = false;
  Array.from({ length: count }).forEach((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'similar-shops-dot';
    dot.setAttribute('aria-label', `نمایش فروشگاه ${toFaNumber(index + 1)}`);
    dot.addEventListener('click', () => {
      const card = list.querySelectorAll('.similar-shop-card')[index];
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      }
      updateSimilarShopDots(index);
    });
    dots.appendChild(dot);
  });
  updateSimilarShopDots(0);
}

function renderSimilarShops(items = []) {
  const section = document.getElementById('similarShopsSection');
  const list = document.getElementById('similarShopsList');
  const empty = document.getElementById('similarShopsEmpty');
  const dots = document.getElementById('similarShopsDots');
  const viewAllWrap = document.getElementById('similarShopsViewAllWrap');
  const context = document.getElementById('similarShopsContext');
  if (!section || !list || !empty) return;

  if (context) context.textContent = buildSimilarContextLabel();

  if (!items.length) {
    list.innerHTML = '';
    if (dots) dots.hidden = true;
    /* Keep viewAllWrap hidden when no items */
    if (viewAllWrap) viewAllWrap.style.visibility = 'hidden';
    empty.hidden = false;
    section.hidden = false;
    return;
  }

  empty.hidden = true;
  /* Reveal header CTA */
  if (viewAllWrap) viewAllWrap.style.visibility = '';
  section.hidden = false;

  /* Update "مشاهده همه" button: show extra-count hint when more than 4 exist */
  const viewAllBtn = document.getElementById('similarShopsViewAll');
  if (viewAllBtn) {
    const extraCount = items.length > 4 ? items.length - 4 : 0;
    const extraHint = extraCount > 0
      ? ` <span class="similar-shops-view-all-badge">+${toFaNumber(extraCount)}</span>`
      : '';
    viewAllBtn.innerHTML = `مشاهده همه${extraHint} <i class="fas fa-arrow-left" aria-hidden="true"></i>`;
  }

  list.innerHTML = items.map((item) => {
    const name = escapeSimilarHtml(item.name);
    const category = escapeSimilarHtml(item.subcategory || item.category || 'دسته‌بندی عمومی');
    const location = escapeSimilarHtml(resolveSimilarShopLocation(item));
    const image = escapeSimilarHtml(item.image || '/assets/images/shop-placeholder.svg');
    const href = escapeSimilarHtml(item.href || resolveShopLink(item.shopUrl));
    const shortInfo = escapeSimilarHtml(item.shortInfo || '');
    const rating = item.rating > 0
      ? toFaNumber(item.rating, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : 'جدید';
    const ratingLabel = item.rating > 0
      ? `${rating}${item.reviewCount ? ` (${toFaNumber(item.reviewCount)})` : ''}`
      : rating;

    return `
      <article class="similar-shop-card">
        <a class="similar-shop-media" href="${href}" aria-label="${name}">
          <img class="similar-shop-logo" src="${image}" alt="${name}" loading="lazy" decoding="async" onerror="this.src='/assets/images/shop-placeholder.svg'">
          <span class="similar-shop-sponsored" ${item.sponsored ? '' : 'hidden'}>ویژه</span>
        </a>
        <div class="similar-shop-content">
          <div class="similar-shop-main">
            <div class="similar-shop-name-row">
              <h3 class="similar-shop-name" title="${name}">${name}</h3>
              ${item.verified ? '<span class="similar-shop-verified" title="تایید شده" aria-label="تایید شده"><i class="fas fa-check"></i></span>' : ''}
            </div>
            <p class="similar-shop-category" title="${category}">${category}</p>
          </div>
          <div class="similar-shop-meta">
            <span class="similar-shop-chip similar-shop-location" aria-label="موقعیت">
              <i class="fas fa-location-dot" aria-hidden="true"></i>
              <span>${location}</span>
            </span>
            <span class="similar-shop-chip similar-shop-rating" aria-label="امتیاز">
              <i class="fas fa-star" aria-hidden="true"></i>
              <span>${ratingLabel}</span>
            </span>
          </div>
          ${shortInfo ? `<p class="similar-shop-note" title="${shortInfo}">${shortInfo}</p>` : ''}
          <a class="similar-shop-action" href="${href}">
            ورود به فروشگاه
            <i class="fas fa-arrow-left" aria-hidden="true"></i>
          </a>
        </div>
      </article>
    `;
  }).join('');
  bindSimilarShopSlider();
  renderSimilarShopDots(items.length);
}

async function fetchServiceSimilarShops() {
  const category = normalizeSimilarText(similarShopState.current.category);
  if (!category) return [];
  const params = new URLSearchParams();
  params.set('category', category);
  params.set('limit', '8');
  if (similarShopState.current.shopUrl) params.set('excludeShopUrl', similarShopState.current.shopUrl);
  if (similarShopState.current.sellerId) params.set('excludeSellerId', similarShopState.current.sellerId);

  const res = await fetch(`${SHOP_API_BASE}/api/service-shops/similar?${params.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`similar service shops ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items.map(normalizeServiceSimilarShop) : [];
}

async function fetchLegacySimilarShops() {
  const res = await fetch(`${SHOP_API_BASE}/api/shops`);
  if (!res.ok) throw new Error(`shops ${res.status}`);
  const data = await res.json();
  const shops = Array.isArray(data) ? data : [];
  const currentUrl = normalizeSimilarKey(similarShopState.current.shopUrl);
  const currentRecord = shops.find(item => normalizeSimilarKey(item.shopurl || item.shopUrl) === currentUrl);
  if (currentRecord && !similarShopState.current.category) {
    setSimilarShopContext({
      category: currentRecord.category || currentRecord.subcategory || '',
      city: currentRecord.city || currentRecord.region || '',
      address: currentRecord.address || similarShopState.current.address || ''
    });
  }
  return shops.map(normalizeLegacySimilarShop);
}

async function loadSimilarShops() {
  const section = document.getElementById('similarShopsSection');
  if (!section) return;

  const key = [
    similarShopState.current.shopUrl,
    similarShopState.current.sellerId,
    similarShopState.current.category,
    similarShopState.current.city
  ].join('|');
  if (key && key === similarShopState.lastKey) return;
  similarShopState.lastKey = key;

  try {
    const settled = await Promise.allSettled([
      fetchServiceSimilarShops(),
      fetchLegacySimilarShops()
    ]);
    const combined = [
      ...settled.flatMap(result => result.status === 'fulfilled' ? result.value : []),
      ...getDemoSimilarShops()
    ];
    const seen = new Set();
    const scored = combined
      .filter(item => item && !isCurrentSimilarShop(item))
      .map(item => ({ ...item, score: scoreSimilarShop(item) }))
      .filter(item => item.score > 0 || !similarShopState.current.category)
      .filter(item => {
        const dedupeKey = normalizeSimilarKey(item.shopUrl || item.id || item.name);
        if (!dedupeKey || seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    renderSimilarShops(scored);
  } catch (error) {
    console.warn('loadSimilarShops failed:', error);
    renderSimilarShops(getDemoSimilarShops().slice(0, 8));
  }
}

let allProducts = []; // همه محصولات اینجا ذخیره میشه

function populateCategoryOptions(products = []) {
  const catSel = document.getElementById('filterCategory');
  if (!catSel) return;

  const previousValue = catSel.value || 'همه';
  const categories = [];

  products.forEach(item => {
    const category = (item && typeof item.category === 'string') ? item.category.trim() : '';
    if (category && !categories.includes(category)) {
      categories.push(category);
    }
  });

  catSel.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = 'همه';
  defaultOption.textContent = 'همه دسته‌ها';
  catSel.appendChild(defaultOption);

  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    catSel.appendChild(option);
  });

  catSel.value = categories.includes(previousValue) ? previousValue : 'همه';
}

// ===== گرفتن و رندر محصولات فروشگاه بر اساس shopurl =====
async function loadShopProducts(shopurl) {
  try {
    const res = await fetch(`http://localhost:5000/api/products/shop/${shopurl}`);
    const products = await res.json();
    allProducts = Array.isArray(products) ? products : [];
    const inferredCategory = inferPrimaryProductCategory(allProducts);
    if (inferredCategory && !similarShopState.current.category) {
      setShopCategoryBadge(inferredCategory);
    }
    populateCategoryOptions(allProducts);
    applyFiltersAndRender();
    setSimilarShopContext({
      category: similarShopState.current.category || inferredCategory
    });
    loadSimilarShops();
  } catch (err) {
    allProducts = [];
    populateCategoryOptions(allProducts);
    applyFiltersAndRender();
    loadSimilarShops();
  }
}

// ===== فیلتر و مرتب‌سازی =====
function applyFiltersAndRender() {
  let filtered = [...allProducts];
  
  // دسته‌بندی
  const cat = document.getElementById('filterCategory')?.value || "همه";
  if (cat && cat !== "همه") {
    filtered = filtered.filter(p => (p.category && p.category.trim() === cat));
  }
  
  // مرتب‌سازی
  const sort = document.getElementById('sortProducts')?.value || "default";
  if (sort === "newest") {
    filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } else if (sort === "expensive") {
    filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
  } else if (sort === "cheap") {
    filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (sort === "best") {
    // برای پرفروش اگه فیلد مثلا "sold" یا "orders" داری استفاده کن وگرنه badgeType === 'best'
    filtered.sort((a, b) => ((b.sold || 0) - (a.sold || 0)));
  }
  
  renderProducts(filtered);
}

// ===== ایوند لیسنرهای فیلتر و مرتب‌سازی =====
document.addEventListener('DOMContentLoaded', function () {
  const catSel = document.getElementById('filterCategory');
  const sortSel = document.getElementById('sortProducts');
  if (catSel) catSel.addEventListener('change', applyFiltersAndRender);
  if (sortSel) sortSel.addEventListener('change', applyFiltersAndRender);
});






// ---- داینامیک کردن title و meta تگ‌های سئو ----

function setDynamicSEO(shop) {
  // title
  document.title = `${shop.shopName || 'فروشگاه'} | ${shop.shopShortDesc || ''}`;

  // description
  let desc = document.querySelector('meta[name="description"]');
  if (!desc) {
    desc = document.createElement('meta');
    desc.setAttribute('name', 'description');
    document.head.appendChild(desc);
  }
  desc.setAttribute('content', shop.shopShortDesc || 'خرید آنلاین از فروشگاه');

  // keywords
  let keywords = document.querySelector('meta[name="keywords"]');
  if (!keywords) {
    keywords = document.createElement('meta');
    keywords.setAttribute('name', 'keywords');
    document.head.appendChild(keywords);
  }
  keywords.setAttribute('content', `${shop.shopName || ''}, ${shop.shopCity || ''}, ${shop.shopTags || ''}, فروشگاه`);

  // author
  let author = document.querySelector('meta[name="author"]');
  if (!author) {
    author = document.createElement('meta');
    author.setAttribute('name', 'author');
    document.head.appendChild(author);
  }
  author.setAttribute('content', shop.shopName || '');

  // og:title
  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (!ogTitle) {
    ogTitle = document.createElement('meta');
    ogTitle.setAttribute('property', 'og:title');
    document.head.appendChild(ogTitle);
  }
  ogTitle.setAttribute('content', `${shop.shopName || ''} | ${shop.shopShortDesc || ''}`);

  // og:description
  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (!ogDesc) {
    ogDesc = document.createElement('meta');
    ogDesc.setAttribute('property', 'og:description');
    document.head.appendChild(ogDesc);
  }
  ogDesc.setAttribute('content', shop.shopShortDesc || '');

  // og:url
  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (!ogUrl) {
    ogUrl = document.createElement('meta');
    ogUrl.setAttribute('property', 'og:url');
    document.head.appendChild(ogUrl);
  }
  ogUrl.setAttribute('content', window.location.href);

  // og:image (اگه داری)
  if (shop.shopImage) {
    let ogImg = document.querySelector('meta[property="og:image"]');
    if (!ogImg) {
      ogImg = document.createElement('meta');
      ogImg.setAttribute('property', 'og:image');
      document.head.appendChild(ogImg);
    }
    ogImg.setAttribute('content', shop.shopImage);
  }
}

/* --- */

(function() {
  'use strict';
  
  const MISSION_CONFIG = {
    minTimeSeconds: 5,
    missionId: 'user-review',
    apiBase: ''
  };
  
  let visitStartTime = Date.now();
  let visitTracked = false;
  let missionAuthPromise = null;
  let missionTrackingAllowed = false;
  let scrolledToBottom = false;
  
  // تابع نمایش Toast
  function showMissionToast(message, progress, required, isCompleted = false) {
    const toast = document.getElementById('missionToast');
    if (!toast) return;
    
    const textEl = toast.querySelector('.mission-toast-text');
    const progressEl = toast.querySelector('.mission-toast-progress');
    const iconEl = toast.querySelector('.mission-toast-icon');
    
    if (textEl) textEl.textContent = message;
    if (progressEl) progressEl.textContent = `${toPersianNum(progress)}/${toPersianNum(required)}`;
    if (iconEl) iconEl.textContent = isCompleted ? '🎉' : '🧭';
    
    toast.classList.toggle('completed', isCompleted);
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }
  
  // تبدیل به اعداد فارسی
  function toPersianNum(num) {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(num).replace(/\d/g, d => persianDigits[d]);
  }
  
  async function canTrackMissionVisit() {
    if (missionTrackingAllowed) return true;
    if (!missionAuthPromise) {
      missionAuthPromise = fetch('/api/auth/getCurrentUser', { credentials: 'include' })
        .then((res) => {
          missionTrackingAllowed = res.ok;
          return missionTrackingAllowed;
        })
        .catch(() => false)
        .finally(() => {
          missionAuthPromise = null;
        });
    }
    return missionAuthPromise;
  }
  
  // ثبت بازدید
  async function trackVisit() {
    if (visitTracked) return;
    if (!currentSellerId) return;
    
    const timeSpent = Math.floor((Date.now() - visitStartTime) / 1000);
    
    if (timeSpent < MISSION_CONFIG.minTimeSeconds) return;
    
    visitTracked = true;
    if (!(await canTrackMissionVisit())) return;
    
    try {
      const res = await fetch(`${MISSION_CONFIG.apiBase}/api/missions/track-visit`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storeId: currentSellerId,
          timeSpent: timeSpent
        })
      });
      
      if (!res.ok) {
        // کاربر لاگین نیست یا خطای دیگر - بی‌صدا رد شو
        return;
      }
      
      const data = await res.json();
      
      if (!data.success) return;
      
      // اگر تکراری یا قبلاً تکمیل شده، نمایش نده
      if (data.duplicate || data.alreadyCompleted) return;
      
      // نمایش Toast
      if (data.isCompleted) {
        showMissionToast(
          'تبریک! ماموریت تکمیل شد! 🎉',
          data.progress,
          data.required,
          true
        );
      } else {
        showMissionToast(
          'بازدید ثبت شد!',
          data.progress,
          data.required,
          false
        );
      }
      
    } catch (err) {
      // خطا - بی‌صدا رد شو
      console.log('Mission tracking skipped');
    }
  }
  
  // تایمر 5 ثانیه‌ای
  setTimeout(() => {
    trackVisit();
  }, MISSION_CONFIG.minTimeSeconds * 1000);
  
  // اسکرول به پایین صفحه
  function checkScrollToBottom() {
    if (scrolledToBottom) return;
    
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    
    // اگر به 80% صفحه رسید
    if (scrollTop + clientHeight >= scrollHeight * 0.8) {
      scrolledToBottom = true;
      trackVisit();
    }
  }
  
  window.addEventListener('scroll', checkScrollToBottom, { passive: true });
  
  // قبل از ترک صفحه
  window.addEventListener('beforeunload', () => {
    const timeSpent = Math.floor((Date.now() - visitStartTime) / 1000);
    if (timeSpent >= MISSION_CONFIG.minTimeSeconds && !visitTracked && currentSellerId && missionTrackingAllowed) {
      fetch(`${MISSION_CONFIG.apiBase}/api/missions/track-visit`, {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storeId: currentSellerId,
          timeSpent: timeSpent
        })
      }).catch(() => {});
    }
  });
  
})();

/* --- Extracted existing /nav-active.js dependency for standalone shop page structure. --- */

// Vitreenet mobile bottom navigation
(function() {
  if (!window.__vitrinetCsrfFetchInitialized && typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
    let csrfTokenPromise = null;

    const readCookie = (name) => {
      const cookies = document.cookie ? document.cookie.split(';') : [];
      for (const cookie of cookies) {
        const [rawName, ...rawValue] = cookie.trim().split('=');
        if (rawName === name) return decodeURIComponent(rawValue.join('=') || '');
      }
      return '';
    };

    const isApiRequest = (url) => {
      if (!url) return false;
      try {
        return new URL(url, window.location.href).pathname.startsWith('/api/');
      } catch {
        return String(url).includes('/api/');
      }
    };

    const getCsrfToken = () => {
      const cookieToken = readCookie('csrf_token');
      if (cookieToken) return Promise.resolve(cookieToken);
      if (!csrfTokenPromise) {
        csrfTokenPromise = originalFetch('/api/csrf-token', { method: 'GET', credentials: 'include' })
          .then((response) => response.ok ? response.json() : null)
          .then((data) => data?.csrfToken || readCookie('csrf_token') || '')
          .finally(() => {
            csrfTokenPromise = null;
          });
      }
      return csrfTokenPromise;
    };

    window.fetch = async function csrfFetch(resource, init) {
      const url = typeof resource === 'string' ? resource : (resource?.url || '');
      const method = String(init?.method || resource?.method || 'GET').toUpperCase();
      if (!isApiRequest(url) || !unsafeMethods.has(method)) {
        return originalFetch(resource, init);
      }

      const options = init ? { ...init } : {};
      const headers = new Headers(options.headers || resource?.headers || {});
      if (!headers.has('X-CSRF-Token')) {
        const token = await getCsrfToken();
        if (token) headers.set('X-CSRF-Token', token);
      }
      if (!headers.has('X-Requested-With')) headers.set('X-Requested-With', 'XMLHttpRequest');
      if (options.credentials === undefined) options.credentials = 'include';
      options.headers = headers;
      options.method = method;
      return originalFetch(resource, options);
    };

    window.__vitrinetCsrfFetchInitialized = true;
  }

  const NAV_STYLE_ID = 'vitreenet-mobile-nav-style';
  const BODY_READY_CLASS = 'has-mobile-nav';
  const NAV_READY_CLASS = 'vitreenet-mobile-nav';
  const SERVICE_PANEL_KEYWORDS = ['خدمات'];

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;

  function safeParseLocalStorage(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('[Vitreenet] Failed to parse localStorage item:', key, error);
      return null;
    }
  }

  function isServiceSellerAccount(seller) {
    if (!seller || typeof seller !== 'object') return false;
    const category = (seller.category || seller.sellerCategory || '').toString().trim();
    const normalizedCategory = category.normalize('NFC');

    return SERVICE_PANEL_KEYWORDS.some(keyword => normalizedCategory === keyword);
  }

  function buildSellerPanelLink(seller) {
    const baseUrl = isServiceSellerAccount(seller)
      ? 'service-seller-panel/s-seller-panel.html'
      : 'seller/dashboard.html';
    const shopurl = seller?.shopurl || seller?.shopUrl || seller?.slug || '';
    const query = shopurl ? `?shopurl=${encodeURIComponent(shopurl)}` : '';
    return `${baseUrl}${query}`;
  }

  function hasValidSellerProfile(seller) {
    if (!seller || typeof seller !== 'object') return false;

    const sellerId = seller._id || seller.id || seller.sellerId;
    const sellerSlug = seller.shopurl || seller.shopUrl || seller.slug;

    return Boolean(sellerId || (typeof sellerSlug === 'string' && sellerSlug.trim())) || isServiceSellerAccount(seller);
  }

  function hasValidCustomerProfile(user) {
    if (!user || typeof user !== 'object') return false;
    const userId = user._id || user.id || user.userId;
    const userPhone = typeof user.phone === 'string' ? user.phone.trim() : '';
    return Boolean(userId || userPhone);
  }

  function parseJwtPayload(token) {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3 || typeof atob !== 'function') return null;

    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      return JSON.parse(atob(padded));
    } catch (_) {
      return null;
    }
  }

  function hasActiveAuthToken(token) {
    if (typeof token !== 'string' || !token.trim()) return false;
    const payload = parseJwtPayload(token.trim());
    if (!payload || typeof payload !== 'object') return false;
    if (typeof payload.exp !== 'number') return true;
    return payload.exp > Math.floor(Date.now() / 1000);
  }

  function updateAuthNavigationState() {
    const loginLink = document.getElementById('loginNavLink');
    const loginMobile = document.getElementById('loginMobileLink');
    const desktopLabel = loginLink?.querySelector('.login-link-label');
    const mobileLabel = loginMobile?.querySelector('.login-mobile-label');

    if (!loginLink && !loginMobile) return;

    const token = localStorage.getItem('token');
    const seller = safeParseLocalStorage('seller');
    const user = safeParseLocalStorage('user');

    let targetUrl = 'login.html';
    let labelText = 'ورود';
    let accountType = '';

    const hasAuthenticatedSession = hasActiveAuthToken(token);

    if (hasAuthenticatedSession && hasValidCustomerProfile(user)) {
      targetUrl = 'user/dashboard.html';
      labelText = 'پنل من';
      accountType = 'customer';
    } else if (hasAuthenticatedSession && hasValidSellerProfile(seller)) {
      targetUrl = buildSellerPanelLink(seller);
      labelText = 'پنل فروشنده';
      accountType = 'seller';
    }

    if (loginLink) {
      loginLink.href = targetUrl;
      if (accountType) {
        loginLink.classList.add('logged-in');
        loginLink.setAttribute('data-account-type', accountType);
      } else {
        loginLink.classList.remove('logged-in');
        loginLink.removeAttribute('data-account-type');
      }
      if (desktopLabel) desktopLabel.textContent = labelText;
    }

    if (loginMobile) {
      loginMobile.href = targetUrl;
      if (accountType) {
        loginMobile.classList.add('logged-in');
        loginMobile.setAttribute('data-account-type', accountType);
      } else {
        loginMobile.classList.remove('logged-in');
        loginMobile.removeAttribute('data-account-type');
      }
      if (mobileLabel) mobileLabel.textContent = labelText;
    }
  }

  function appendSvgContent(svgElement, markup) {
    if (!svgElement || !markup) return;

    if (!parser) {
      // Fallback: attempt to set innerHTML for environments without DOMParser support
      svgElement.innerHTML = markup;
      return;
    }

    try {
      const doc = parser.parseFromString(`<svg xmlns="${SVG_NS}">${markup}</svg>`, 'image/svg+xml');
      const parserError = doc.getElementsByTagName('parsererror');
      if (parserError && parserError.length > 0) {
        console.warn('[Vitreenet] Failed to parse SVG markup for mobile nav icon.');
        return;
      }

      const nodes = doc.documentElement ? Array.from(doc.documentElement.childNodes) : [];
      nodes.forEach((node) => {
        if (typeof Node === 'undefined' || node.nodeType === Node.ELEMENT_NODE) {
          svgElement.appendChild(document.importNode(node, true));
        }
      });
    } catch (error) {
      console.warn('[Vitreenet] Error while parsing SVG markup for mobile nav icon.', error);
    }
  }

  const NAV_ITEMS = [
    {
      id: 'mobileNavHome',
      href: '/index.html',
      label: 'خانه',
      icon: '<path d="M3 10.75 12 3l9 7.75V20a1.5 1.5 0 0 1-1.5 1.5H15a1.5 1.5 0 0 1-1.5-1.5v-4.25h-3V20A1.5 1.5 0 0 1 9 21.5H4.5A1.5 1.5 0 0 1 3 20v-9.25Z" fill="currentColor"/><path d="M9.5 21.5v-5.25A1.25 1.25 0 0 1 10.75 15h2.5A1.25 1.25 0 0 1 14.5 16.25V21.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      iconOutline: '<path d="M3 10.75 12 3l9 7.75V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-9.25Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.5 21.5v-5.25A1.25 1.25 0 0 1 10.75 15h2.5A1.25 1.25 0 0 1 14.5 16.25V21.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      iconFilled: '<path d="M3 10.75 12 3l9 7.75V20a1.5 1.5 0 0 1-1.5 1.5H15a1.5 1.5 0 0 1-1.5-1.5v-4.25h-3V20A1.5 1.5 0 0 1 9 21.5H4.5A1.5 1.5 0 0 1 3 20v-9.25Z" fill="currentColor"/><path d="M9.5 21.5v-5.25A1.25 1.25 0 0 1 10.75 15h2.5A1.25 1.25 0 0 1 14.5 16.25V21.5" stroke="white" stroke-width="1.2" stroke-linecap="round"/>',
      matches: ['/', '/index.html', 'index.html']
    },
    {
      id: 'mobileNavCategories',
      href: '/categories.html',
      label: 'دسته‌بندی',
      icon: '<path d="M4 4.5h6a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 10 13.5H4A1.5 1.5 0 0 1 2.5 12V6A1.5 1.5 0 0 1 4 4.5Z" fill="currentColor"/><path d="M14 4.5h6a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 20 13.5h-6a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 14 4.5Z" fill="currentColor"/><path d="M4 14.5h6A1.5 1.5 0 0 1 11.5 16v4A1.5 1.5 0 0 1 10 21.5H4A1.5 1.5 0 0 1 2.5 20v-4A1.5 1.5 0 0 1 4 14.5Z" fill="currentColor"/><path d="M14 14.5h6a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 20 21.5h-6a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5Z" fill="currentColor"/>',
      iconOutline: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/>',
      iconFilled: '<path d="M4 4.5h6a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 10 13.5H4A1.5 1.5 0 0 1 2.5 12V6A1.5 1.5 0 0 1 4 4.5Z" fill="currentColor"/><path d="M14 4.5h6a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 20 13.5h-6a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 14 4.5Z" fill="currentColor"/><path d="M4 14.5h6A1.5 1.5 0 0 1 11.5 16v4A1.5 1.5 0 0 1 10 21.5H4A1.5 1.5 0 0 1 2.5 20v-4A1.5 1.5 0 0 1 4 14.5Z" fill="currentColor"/><path d="M14 14.5h6a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 20 21.5h-6a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5Z" fill="currentColor"/>',
      matches: [
        '/categories.html',
        'categories.html',
        '/shops-by-category.html',
        'shops-by-category.html',
        '/all-products.html',
        'all-products.html',
        '/all-shops.html',
        'all-shops.html',
        '/all-shopping-centers.html',
        'all-shopping-centers.html',
        '/shopping-centers-shops.html',
        'shopping-centers-shops.html',
        '/shop.html',
        'shop.html',
        '/product.html',
        'product.html',
        '/pad-shops.html',
        'pad-shops.html',
        '/city-explore.html',
        'city-explore.html'
      ]
    },
    {
      id: 'mobileNavServices',
      href: '/shops-by-category.html?cat=service',
      label: 'خدمات',
      icon: '<path d="M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8.25v7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M8.25 12h7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      iconOutline: '<path d="M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 8.25v7.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M8.25 12h7.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      iconFilled: '<path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z" fill="currentColor"/><path d="M12 8.25v7.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/><path d="M8.25 12h7.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/>',
      matches: [
        '/service-directory.html',
        'service-directory.html',
        '/service-shops.html',
        'service-shops.html',
        '/service-seller-panel',
        'service-seller-panel',
        '/service-seller-panel/',
        'service-seller-panel/',
        '/seller-paneel.html',
        'seller-paneel.html'
      ]
    },
    {
      id: 'loginMobileLink',
      href: '/login.html',
      label: 'ورود',
      icon: '<path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 1.5c-3 0-6.5 1.54-6.5 4.5v.5A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5v-.5c0-2.96-3.5-4.5-6.5-4.5Z" fill="currentColor"/>',
      iconOutline: '<path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 19v-.5c0-2.96 3.5-4.5 6.5-4.5s6.5 1.54 6.5 4.5v.5A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19Z" fill="none" stroke="currentColor" stroke-width="1.7"/>',
      iconFilled: '<path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 1.5c-3 0-6.5 1.54-6.5 4.5v.5A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5v-.5c0-2.96-3.5-4.5-6.5-4.5Z" fill="currentColor"/>',
      labelClass: 'login-mobile-label',
      extraClass: 'nav-item-account',
      matches: [
        '/login.html',
        'login.html',
        '/seller/login.html',
        'seller/login.html',
        '/register.html',
        'register.html',
        '/verify.html',
        'verify.html',
        '/verify-user.html',
        'verify-user.html',
        '/user/dashboard.html',
        'user/dashboard.html',
        '/user-panel.html',
        'user-panel.html',
        '/seller/dashboard.html',
        'seller/dashboard.html',
        '/service-seller-panel/s-seller-panel.html',
        'service-seller-panel/s-seller-panel.html'
      ]
    }
  ];

  function normalisePath(pathname) {
    if (!pathname) return 'index.html';
    let cleaned = pathname;
    if (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1) || '/';
    return cleaned || '/';
  }

  function ensureStyle() {
    if (document.getElementById(NAV_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = NAV_STYLE_ID;
    style.textContent = `
      /* ── Vitreenet Mobile Nav — Premium Redesign ── */

      @media (max-width: 1024px) {

        /* ── Body clearance so content isn't hidden under the nav ── */
        body.${BODY_READY_CLASS} {
          padding-bottom: calc(100px + env(safe-area-inset-bottom, 0px));
        }
        body.${BODY_READY_CLASS}.hide-mobile-nav {
          padding-bottom: 0 !important;
        }

        /* Hide page footer when the injected nav is present */
        footer:not(.mobile-nav) {
          display: none !important;
        }

        /* ── Nav container — floating pill ── */
        .mobile-nav,
        .mobile-bottom-nav {
          display: flex !important;
          position: fixed;
          left: 14px;
          right: 14px;
          bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          z-index: 1000;
          height: 76px;
          padding: 8px 8px;
          /* Premium light frosted glass */
          background: rgba(255, 255, 255, 0.92);
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow:
            0 12px 40px rgba(0, 0, 0, 0.10),
            0 3px 10px rgba(0, 0, 0, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            inset 0 -1px 0 rgba(0, 0, 0, 0.04);
          backdrop-filter: saturate(2) blur(24px);
          -webkit-backdrop-filter: saturate(2) blur(24px);
          justify-content: space-between;
          align-items: stretch;
          gap: 2px;
          overflow: visible;
          transition:
            transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
            opacity  0.3s cubic-bezier(0.4, 0, 0.2, 1),
            box-shadow 0.3s ease;
        }

        @supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
          .mobile-nav,
          .mobile-bottom-nav {
            background: rgba(255, 255, 255, 0.97);
            border: 1px solid rgba(203, 213, 225, 0.8);
          }
        }

        /* ── Animated sliding indicator pill ── */
        .mobile-nav-indicator {
          position: absolute;
          top: 8px;
          left: 8px;
          width: 72px;
          height: calc(100% - 16px);
          border-radius: 20px;
          background: linear-gradient(135deg,
            rgba(16, 185, 129, 0.13) 0%,
            rgba(5, 150, 105, 0.10) 100%);
          box-shadow:
            0 4px 14px rgba(16, 185, 129, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
          border: 1px solid rgba(16, 185, 129, 0.18);
          opacity: 0;
          pointer-events: none;
          transform: translate3d(0, 0, 0);
          transition:
            transform 0.32s cubic-bezier(0.4, 0, 0.2, 1),
            width   0.32s cubic-bezier(0.4, 0, 0.2, 1),
            opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 0;
        }

        /* Hide/show transition */
        body.hide-mobile-nav .mobile-nav,
        body.hide-mobile-nav .mobile-bottom-nav {
          transform: translateY(130%);
          opacity: 0;
          pointer-events: none;
          visibility: hidden;
        }

        /* Legacy ul/li structure support */
        .mobile-bottom-nav ul {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          height: 100%;
          gap: 2px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .mobile-bottom-nav li {
          flex: 1;
          min-width: 0;
          display: flex;
        }

        /* ── Nav items ── */
        .mobile-nav .nav-item,
        .mobile-bottom-nav .nav-item {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 52px;
          min-width: 44px;
          height: 100%;
          color: #64748b;
          text-decoration: none;
          font-weight: 500;
          font-size: 10.5px;
          letter-spacing: 0.01em;
          gap: 4px;
          padding: 6px 4px;
          border-radius: 20px;
          -webkit-tap-highlight-color: transparent;
          cursor: pointer;
          transition:
            color      0.22s cubic-bezier(0.4, 0, 0.2, 1),
            transform  0.18s cubic-bezier(0.4, 0, 0.2, 1),
            background 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Hover (pointer devices only) */
        @media (hover: hover) and (pointer: fine) {
          .mobile-nav .nav-item:hover,
          .mobile-bottom-nav .nav-item:hover {
            color: #334155;
            background: rgba(16, 185, 129, 0.07);
          }
        }

        /* Focus ring for a11y */
        .mobile-nav .nav-item:focus-visible,
        .mobile-bottom-nav .nav-item:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.4);
        }

        /* Touch press */
        .mobile-nav .nav-item:active,
        .mobile-bottom-nav .nav-item:active {
          transform: scale(0.92);
        }

        /* ── Icon wrapper ── */
        .mobile-nav .nav-icon-wrap,
        .mobile-bottom-nav .nav-icon-wrap {
          position: relative;
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }

        /* Both SVG states sit on top of each other */
        .mobile-nav .nav-item svg,
        .mobile-bottom-nav .nav-item svg {
          width: 24px;
          height: 24px;
          color: inherit;
          position: absolute;
          inset: 0;
          transform-origin: center;
          transition:
            transform 0.26s cubic-bezier(0.34, 1.4, 0.64, 1),
            opacity   0.22s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Outline icon — visible by default */
        .mobile-nav .nav-item .nav-icon-outline,
        .mobile-bottom-nav .nav-item .nav-icon-outline {
          opacity: 1;
          transform: scale(1) rotate(0deg);
        }

        /* Filled icon — hidden by default */
        .mobile-nav .nav-item .nav-icon-filled,
        .mobile-bottom-nav .nav-item .nav-icon-filled {
          opacity: 0;
          transform: scale(0.7) rotate(-10deg);
        }

        /* ── Labels ── */
        .mobile-nav .nav-item .nav-label,
        .mobile-bottom-nav .nav-item .nav-label,
        .mobile-bottom-nav .nav-item span {
          font-size: 11px;
          font-weight: inherit;
          line-height: 1.1;
          opacity: 0.78;
          white-space: nowrap;
          letter-spacing: 0.01em;
          transition:
            opacity   0.22s ease,
            transform 0.22s ease,
            color     0.22s ease;
        }

        /* ── Active state ── */
        .mobile-nav .nav-item.active,
        .mobile-bottom-nav .nav-item.active {
          color: #059669;
          font-weight: 650;
        }

        /* Active icon swap: outline fades out, filled bounces in */
        .mobile-nav .nav-item.active .nav-icon-outline,
        .mobile-bottom-nav .nav-item.active .nav-icon-outline {
          opacity: 0;
          transform: scale(0.7) rotate(10deg);
        }

        .mobile-nav .nav-item.active .nav-icon-filled,
        .mobile-bottom-nav .nav-item.active .nav-icon-filled {
          opacity: 1;
          transform: scale(1.1) rotate(0deg);
          filter: drop-shadow(0 2px 5px rgba(5, 150, 105, 0.28));
        }

        /* Active label lifts slightly and becomes opaque */
        .mobile-nav .nav-item.active .nav-label,
        .mobile-bottom-nav .nav-item.active .nav-label,
        .mobile-bottom-nav .nav-item.active span {
          opacity: 1;
          font-weight: 650;
          transform: translateY(-1px);
          color: #059669;
        }

        /* Suppress old static nav when injected nav is active */
        body.${BODY_READY_CLASS} .mobile-bottom-nav {
          display: none !important;
        }
      }

      /* ── Reduced motion ── */
      @media (prefers-reduced-motion: reduce) {
        .mobile-nav,
        .mobile-bottom-nav,
        .mobile-nav-indicator,
        .mobile-nav .nav-item,
        .mobile-bottom-nav .nav-item,
        .mobile-nav .nav-item svg,
        .mobile-bottom-nav .nav-item svg {
          transition: none !important;
          animation: none !important;
        }
      }

      /* ── Hide on desktop ── */
      @media (min-width: 1025px) {
        .mobile-nav {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createNavItem(config) {
    const link = document.createElement('a');
    link.className = 'nav-item';
    link.href = config.href;
    link.setAttribute('id', config.id);
    link.setAttribute('aria-label', config.label);

    if (config.extraClass) {
      link.classList.add(config.extraClass);
    }

    const iconWrap = document.createElement('span');
    iconWrap.className = 'nav-icon-wrap';

    const outlineIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    outlineIcon.setAttribute('viewBox', '0 0 24 24');
    outlineIcon.setAttribute('fill', 'none');
    outlineIcon.setAttribute('aria-hidden', 'true');
    outlineIcon.classList.add('nav-icon', 'nav-icon-outline');
    appendSvgContent(outlineIcon, config.iconOutline || config.icon || '');

    const filledIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    filledIcon.setAttribute('viewBox', '0 0 24 24');
    filledIcon.setAttribute('fill', 'none');
    filledIcon.setAttribute('aria-hidden', 'true');
    filledIcon.classList.add('nav-icon', 'nav-icon-filled');
    appendSvgContent(filledIcon, config.iconFilled || config.iconOutline || config.icon || '');

    const label = document.createElement('span');
    label.className = 'nav-label';
    if (config.labelClass) {
      label.classList.add(config.labelClass);
    }
    label.textContent = config.label;

    iconWrap.appendChild(outlineIcon);
    iconWrap.appendChild(filledIcon);
    link.appendChild(iconWrap);
    link.appendChild(label);

    return link;
  }

  function ensureNavIndicator(nav) {
    if (!nav) return null;

    let indicator = nav.querySelector('.mobile-nav-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'mobile-nav-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      nav.insertBefore(indicator, nav.firstChild);
    }

    nav.classList.add('has-indicator');
    return indicator;
  }

  function updateNavIndicator(nav, activeItem) {
    if (!nav) return;
    const indicator = ensureNavIndicator(nav);
    if (!indicator) return;

    if (!activeItem) {
      indicator.style.opacity = '0';
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const activeRect = activeItem.getBoundingClientRect();
    if (!navRect.width || !activeRect.width) {
      indicator.style.opacity = '0';
      return;
    }

    // Indicator height is set via CSS (top:8px, height:calc(100%-16px))
    // We only need to slide it horizontally to the active item
    const width = Math.max(64, Math.min(activeRect.width + 4, 96));
    const left = activeRect.left - navRect.left + ((activeRect.width - width) / 2);
    const clampedLeft = Math.max(8, Math.min(left, navRect.width - width - 8));

    indicator.style.width = `${width}px`;
    indicator.style.height = '';   // let CSS handle height
    indicator.style.transform = `translate3d(${clampedLeft}px, 0, 0)`;
    indicator.style.opacity = '1';
  }

  function getCurrentPath() {
    const { pathname } = window.location;
    return normalisePath(pathname);
  }

  function getCurrentSearch() {
    return window.location.search || '';
  }

  function isServiceCategoryPage() {
    const pathname = getCurrentPath();
    const search = getCurrentSearch();
    const params = new URLSearchParams(search);
    const cat = params.get('cat');
    
    // Check if we're on shops-by-category.html with cat=service
    const isShopsByCategoryPage = pathname.includes('shops-by-category.html');
    const isServiceCategory = cat === 'service';
    
    return isShopsByCategoryPage && isServiceCategory;
  }

  function matchesCurrent(config, currentPath) {
    if (!Array.isArray(config.matches)) return false;
    
    // Special handling for service category page
    // If we're on shops-by-category.html?cat=service, only mobileNavServices should match
    if (isServiceCategoryPage()) {
      if (config.id === 'mobileNavServices') return true;
      if (config.id === 'mobileNavCategories') return false;
    }
    
    return config.matches.some(match => {
      if (!match) return false;
      
      // Normalize the match pattern
      const normalizedMatch = match.startsWith('/') ? match : `/${match}`;
      const normalizedCurrent = currentPath.startsWith('/') ? currentPath : `/${currentPath}`;
      
      // Exact match check
      if (normalizedCurrent === normalizedMatch) return true;
      
      // Handle root/index page
      if (match === '/' || match === '/index.html' || match === 'index.html') {
        return normalizedCurrent === '/' || 
               normalizedCurrent === '/index.html' || 
               normalizedCurrent.endsWith('/index.html');
      }
      
      // For file paths (ending with .html), require exact match
      if (match.endsWith('.html')) {
        return normalizedCurrent === normalizedMatch || 
               normalizedCurrent.endsWith(normalizedMatch);
      }
      
      // For directory-style paths, check if current path starts with it
      // but only if the match doesn't end with .html
      if (match.endsWith('/')) {
        return normalizedCurrent.startsWith(normalizedMatch.slice(0, -1) + '/') ||
               normalizedCurrent.startsWith(normalizedMatch);
      }
      
      return false;
    });
  }

  function setActiveState(nav) {
    if (!nav) return;
    const currentPath = getCurrentPath();
    const items = nav.querySelectorAll('.nav-item');

    // First pass: find all matching items
    const matchingItems = [];
    items.forEach((item) => {
      const config = NAV_ITEMS.find(entry => entry.id === item.id);
      if (config && matchesCurrent(config, currentPath)) {
        matchingItems.push({ item, config });
      }
    });

    // Determine which item should be active (most specific match wins)
    // Priority: exact match > longer path match > first match
    let activeItem = null;
    if (matchingItems.length === 1) {
      activeItem = matchingItems[0].item;
    } else if (matchingItems.length > 1) {
      // Find the most specific match
      // Home page should only be active on exact index.html match
      const isHomePage = currentPath === '/' || currentPath === '/index.html' || currentPath.endsWith('/index.html');
      
      if (isHomePage) {
        // On home page, only home nav should be active
        const homeItem = matchingItems.find(m => m.config.id === 'mobileNavHome');
        activeItem = homeItem ? homeItem.item : matchingItems[0].item;
      } else {
        // For other pages, prefer non-home items and find most specific match
        const nonHomeItems = matchingItems.filter(m => m.config.id !== 'mobileNavHome');
        if (nonHomeItems.length > 0) {
          // Sort by specificity (longer match paths are more specific)
          nonHomeItems.sort((a, b) => {
            const aMaxLen = Math.max(...(a.config.matches || []).filter(m => currentPath.includes(m.replace(/^\//, ''))).map(m => m.length));
            const bMaxLen = Math.max(...(b.config.matches || []).filter(m => currentPath.includes(m.replace(/^\//, ''))).map(m => m.length));
            return bMaxLen - aMaxLen;
          });
          activeItem = nonHomeItems[0].item;
        } else {
          activeItem = matchingItems[0].item;
        }
      }
    }

    // Apply active state
    items.forEach((item) => {
      if (item === activeItem) {
        item.classList.add('active');
        item.setAttribute('aria-current', 'page');
      } else {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
      }
    });

    updateNavIndicator(nav, activeItem);
  }

  function initialiseNav() {
    const body = document.body;
    if (!body) return null;

    const currentPath = getCurrentPath();
    const isSellerLoginPage =
      currentPath === '/seller/login.html' ||
      currentPath.endsWith('/seller/login.html');
    const disableNav =
      (currentPath.startsWith('/seller/') && !isSellerLoginPage) ||
      currentPath.startsWith('/hesabketab/');

    if (disableNav) {
      const existingNav = document.querySelector('footer.mobile-nav');
      if (existingNav) {
        existingNav.remove();
      }
      body.classList.remove(BODY_READY_CLASS);
      body.classList.add('hide-mobile-nav');
      return null;
    }

    ensureStyle();

    let nav = document.querySelector('footer.mobile-nav');
    if (!nav) {
      nav = document.createElement('footer');
      nav.className = 'mobile-nav hidden';
      nav.setAttribute('role', 'navigation');
      nav.setAttribute('aria-label', 'ناوبری موبایل');
      body.appendChild(nav);
    } else {
      nav.innerHTML = '';
    }

    NAV_ITEMS.forEach(config => {
      const item = createNavItem(config);
      nav.appendChild(item);
    });

    nav.classList.remove('hidden');
    nav.classList.add(NAV_READY_CLASS);
    body.classList.add(BODY_READY_CLASS);

    setActiveState(nav);

    updateAuthNavigationState();

    document.dispatchEvent(new CustomEvent('mobileNavReady', { detail: { nav } }));

    return nav;
  }

  let navElement = null;
  let navLayoutRaf = null;

  function queueNavLayoutUpdate() {
    if (navLayoutRaf !== null) {
      cancelAnimationFrame(navLayoutRaf);
    }

    navLayoutRaf = requestAnimationFrame(() => {
      navLayoutRaf = null;
      setActiveState(navElement);
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    navElement = initialiseNav();
  });

  window.addEventListener('storage', (event) => {
    if (!event.key || ['token', 'seller', 'user'].includes(event.key)) {
      updateAuthNavigationState();
      queueNavLayoutUpdate();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateAuthNavigationState();
      queueNavLayoutUpdate();
    }
  });

  document.addEventListener('mobileNavReady', () => {
    updateAuthNavigationState();
    queueNavLayoutUpdate();
  });

  window.addEventListener('hashchange', () => setActiveState(navElement));
  window.addEventListener('popstate', () => setActiveState(navElement));
  window.addEventListener('resize', queueNavLayoutUpdate);
  window.addEventListener('orientationchange', queueNavLayoutUpdate);
})();
