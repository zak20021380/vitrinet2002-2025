/**
 * Featured Ad Module - Dedicated Sponsored Section
 * Separate from search results with frequency capping & tracking
 * Version: 3.0
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  
  const CONFIG = {
    API_BASE: (window.__API_BASE__ || window.API_BASE || '').replace(/\/$/, '') || window.location.origin,
    AD_ENDPOINT: '/api/adOrder/active',
    IMPRESSION_ENDPOINT: '/api/adOrder/impression',
    CLICK_ENDPOINT: '/api/adOrder/click',
    PLAN_SLUG: 'ad_search',
    SESSION_KEY: 'vt_featured_ad_session',
    DISMISS_KEY: 'vt_featured_ad_dismissed',
    IMPRESSION_KEY: 'vt_featured_ad_impressions',
    MAX_IMPRESSIONS_PER_SESSION: 3, // Frequency cap
    CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
    ROTATION_INTERVAL_MS: 30 * 1000 // 30 seconds for rotation
  };

  // ============================================
  // STATE
  // ============================================
  
  const state = {
    currentAd: null,
    allAds: [],
    adIndex: 0,
    isLoading: false,
    isVisible: false,
    isDismissed: false,
    impressionCount: 0,
    sessionId: null,
    cacheTime: null,
    rotationTimer: null
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  function generateSessionId() {
    return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function getSessionId() {
    let sessionId = sessionStorage.getItem(CONFIG.SESSION_KEY);
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem(CONFIG.SESSION_KEY, sessionId);
    }
    return sessionId;
  }

  function getImpressionCount() {
    const data = sessionStorage.getItem(CONFIG.IMPRESSION_KEY);
    if (!data) return 0;
    try {
      const parsed = JSON.parse(data);
      return parsed.count || 0;
    } catch {
      return 0;
    }
  }

  function incrementImpressionCount() {
    const count = getImpressionCount() + 1;
    sessionStorage.setItem(CONFIG.IMPRESSION_KEY, JSON.stringify({ count, timestamp: Date.now() }));
    return count;
  }

  function isDismissedThisSession() {
    return sessionStorage.getItem(CONFIG.DISMISS_KEY) === 'true';
  }

  function setDismissed() {
    sessionStorage.setItem(CONFIG.DISMISS_KEY, 'true');
    state.isDismissed = true;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveImageUrl(path) {
    if (!path) return null;
    const trimmed = String(path).trim();
    if (!trimmed) return null;
    if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) return trimmed;
    return `/uploads/${trimmed}`;
  }

  // ============================================
  // API FUNCTIONS
  // ============================================
  
  async function fetchAds(force = false) {
    // Check cache
    if (!force && state.allAds.length && state.cacheTime) {
      const age = Date.now() - state.cacheTime;
      if (age < CONFIG.CACHE_TTL_MS) {
        return state.allAds;
      }
    }

    if (state.isLoading) return state.allAds;
    state.isLoading = true;

    try {
      const url = `${CONFIG.API_BASE}${CONFIG.AD_ENDPOINT}?planSlug=${CONFIG.PLAN_SLUG}`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        console.warn('[FeaturedAd] API error:', response.status);
        return [];
      }

      const data = await response.json();
      
      if (!data.success || !Array.isArray(data.ads)) {
        return [];
      }

      // Filter approved ads
      const approvedAds = data.ads.filter(
        ad => ad.planSlug === CONFIG.PLAN_SLUG && ad.status === 'approved'
      );

      state.allAds = approvedAds;
      state.cacheTime = Date.now();
      
      return approvedAds;
    } catch (error) {
      console.error('[FeaturedAd] Fetch error:', error);
      return [];
    } finally {
      state.isLoading = false;
    }
  }

  async function trackImpression(adId) {
    if (!adId) return;
    
    try {
      await fetch(`${CONFIG.API_BASE}${CONFIG.IMPRESSION_ENDPOINT}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adId, 
          sessionId: getSessionId(),
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.warn('[FeaturedAd] Impression tracking failed:', error);
    }
  }

  async function trackClick(adId) {
    if (!adId) return;
    
    try {
      await fetch(`${CONFIG.API_BASE}${CONFIG.CLICK_ENDPOINT}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adId, 
          sessionId: getSessionId(),
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.warn('[FeaturedAd] Click tracking failed:', error);
    }
  }

  // ============================================
  // RENDER FUNCTIONS
  // ============================================
  
  function renderLoadingState() {
    return `
      <div class="featured-ad-card">
        <div class="featured-ad-header">
          <div class="featured-ad-label">
            <span class="featured-ad-badge">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4.5 8.5c0-2.485 2.015-4.5 4.5-4.5h2c2.485 0 4.5 2.015 4.5 4.5v3c0 2.485-2.015 4.5-4.5 4.5h-2c-2.485 0-4.5-2.015-4.5-4.5v-3Z"/>
              </svg>
              تبلیغ
            </span>
            <span class="featured-ad-title-label">پیشنهاد ویژه</span>
          </div>
        </div>
        <div class="featured-ad-loading">
          <div class="featured-ad-loading-thumb"></div>
          <div class="featured-ad-loading-info">
            <div class="featured-ad-loading-line featured-ad-loading-line--short"></div>
            <div class="featured-ad-loading-line featured-ad-loading-line--full"></div>
            <div class="featured-ad-loading-line featured-ad-loading-line--medium"></div>
            <div class="featured-ad-loading-line featured-ad-loading-line--cta"></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderAdCard(ad) {
    if (!ad) return '';

    // Extract data
    const productInfo = typeof ad.productId === 'object' ? ad.productId : null;
    const sellerInfo = typeof ad.sellerId === 'object' ? ad.sellerId : null;
    const productId = productInfo?._id || productInfo?.id || (typeof ad.productId === 'string' ? ad.productId : null);
    const sellerId = sellerInfo?._id || sellerInfo?.id || (typeof ad.sellerId === 'string' ? ad.sellerId : null);
    const sellerShopurl = sellerInfo?.shopurl;

    // Build target URL
    let targetUrl = '#';
    if (productId) {
      targetUrl = `product.html?id=${productId}`;
    } else if (sellerShopurl) {
      targetUrl = `shop.html?shopurl=${encodeURIComponent(sellerShopurl)}`;
    } else if (sellerId) {
      targetUrl = `shop.html?id=${sellerId}`;
    }

    const adId = ad._id || ad.id || '';
    const title = escapeHTML(ad.adTitle || 'پیشنهاد ویژه');
    const description = ad.adText ? escapeHTML(ad.adText).replace(/\n+/g, ' ').substring(0, 80) : '';
    const shopName = escapeHTML(ad.shopTitle || sellerInfo?.storename || '');
    const imageUrl = resolveImageUrl(ad.bannerImage);

    const thumbnailHTML = imageUrl
      ? `<img src="${imageUrl}" alt="${title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'featured-ad-thumb-placeholder\\'><i class=\\'ri-store-2-line\\'></i></div>'">`
      : `<div class="featured-ad-thumb-placeholder"><i class="ri-store-2-line"></i></div>`;

    return `
      <div class="featured-ad-card" data-ad-id="${escapeHTML(adId)}">
        <div class="featured-ad-header">
          <div class="featured-ad-label">
            <span class="featured-ad-badge">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4.5 8.5c0-2.485 2.015-4.5 4.5-4.5h2c2.485 0 4.5 2.015 4.5 4.5v3c0 2.485-2.015 4.5-4.5 4.5h-2c-2.485 0-4.5-2.015-4.5-4.5v-3Z"/>
                <path d="M7.5 8h5" stroke-linecap="round"/>
                <path d="M7.5 11h3" stroke-linecap="round"/>
              </svg>
              تبلیغ
            </span>
            <span class="featured-ad-title-label">پیشنهاد ویژه</span>
          </div>
          <button type="button" class="featured-ad-dismiss" aria-label="بستن تبلیغ" data-action="dismiss">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l8 8M14 6l-8 8"/>
            </svg>
          </button>
        </div>
        <a href="${targetUrl}" class="featured-ad-content" data-action="click" data-ad-id="${escapeHTML(adId)}">
          <div class="featured-ad-thumb">
            ${thumbnailHTML}
          </div>
          <div class="featured-ad-info">
            ${shopName ? `
              <div class="featured-ad-shop">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 9l1.5-4.5A2 2 0 0 1 6.4 3h11.2a2 2 0 0 1 1.9 1.3L21 9"/>
                  <path d="M20 9v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9"/>
                </svg>
                ${shopName}
              </div>
            ` : ''}
            <h4 class="featured-ad-name">${title}</h4>
            ${description ? `<p class="featured-ad-desc">${description}</p>` : ''}
            <span class="featured-ad-cta">
              مشاهده
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M7 5l-5 5 5 5"/>
              </svg>
            </span>
          </div>
        </a>
      </div>
    `;
  }

  // ============================================
  // MODULE CONTROL
  // ============================================
  
  function getModuleElement() {
    return document.getElementById('featuredAdModule');
  }

  function createModuleElement() {
    let module = getModuleElement();
    if (module) return module;

    module = document.createElement('div');
    module.id = 'featuredAdModule';
    module.className = 'featured-ad-module';
    module.setAttribute('role', 'complementary');
    module.setAttribute('aria-label', 'تبلیغ ویژه');

    // Insert after search form
    const searchForm = document.getElementById('searchForm');
    if (searchForm && searchForm.parentNode) {
      searchForm.parentNode.insertBefore(module, searchForm.nextSibling);
    }

    return module;
  }

  function showModule() {
    const module = getModuleElement();
    if (!module) return;

    // Check frequency cap
    if (getImpressionCount() >= CONFIG.MAX_IMPRESSIONS_PER_SESSION) {
      console.log('[FeaturedAd] Frequency cap reached');
      return;
    }

    // Check if dismissed
    if (isDismissedThisSession()) {
      console.log('[FeaturedAd] Dismissed this session');
      return;
    }

    module.classList.add('is-visible');
    state.isVisible = true;
  }

  function hideModule() {
    const module = getModuleElement();
    if (!module) return;

    module.classList.remove('is-visible');
    state.isVisible = false;
  }

  function dismissModule() {
    const module = getModuleElement();
    if (!module) return;

    setDismissed();
    module.classList.add('is-dismissed');
    hideModule();
    stopRotation();
  }

  // ============================================
  // AD ROTATION
  // ============================================
  
  function rotateAd() {
    if (state.allAds.length <= 1) return;

    state.adIndex = (state.adIndex + 1) % state.allAds.length;
    state.currentAd = state.allAds[state.adIndex];

    const module = getModuleElement();
    if (module && state.currentAd) {
      module.innerHTML = renderAdCard(state.currentAd);
      trackImpression(state.currentAd._id || state.currentAd.id);
      incrementImpressionCount();
    }
  }

  function startRotation() {
    if (state.rotationTimer) return;
    if (state.allAds.length <= 1) return;

    state.rotationTimer = setInterval(rotateAd, CONFIG.ROTATION_INTERVAL_MS);
  }

  function stopRotation() {
    if (state.rotationTimer) {
      clearInterval(state.rotationTimer);
      state.rotationTimer = null;
    }
  }

  // ============================================
  // MAIN FUNCTIONS
  // ============================================
  
  async function loadAndShowAd() {
    // Check if should show
    if (isDismissedThisSession()) return;
    if (getImpressionCount() >= CONFIG.MAX_IMPRESSIONS_PER_SESSION) return;

    const module = createModuleElement();
    
    // Show loading state
    module.innerHTML = renderLoadingState();
    showModule();

    try {
      const ads = await fetchAds();
      
      if (!ads.length) {
        hideModule();
        return;
      }

      // Select first ad (or random for rotation)
      state.currentAd = ads[0];
      state.adIndex = 0;

      // Render ad
      module.innerHTML = renderAdCard(state.currentAd);
      
      // Track impression
      trackImpression(state.currentAd._id || state.currentAd.id);
      incrementImpressionCount();

      // Start rotation if multiple ads
      if (ads.length > 1) {
        startRotation();
      }

    } catch (error) {
      console.error('[FeaturedAd] Load error:', error);
      hideModule();
    }
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================
  
  function handleModuleClick(event) {
    const target = event.target;
    
    // Dismiss button
    if (target.closest('[data-action="dismiss"]')) {
      event.preventDefault();
      event.stopPropagation();
      dismissModule();
      return;
    }

    // Ad click
    const clickTarget = target.closest('[data-action="click"]');
    if (clickTarget) {
      const adId = clickTarget.dataset.adId;
      if (adId) {
        trackClick(adId);
      }
      // Let the link navigate naturally
    }
  }

  function handleSearchFocus() {
    if (!state.isVisible && !isDismissedThisSession()) {
      loadAndShowAd();
    }
  }

  function handleSearchBlur(event) {
    // Don't hide if clicking inside the ad module
    const relatedTarget = event.relatedTarget;
    const module = getModuleElement();
    
    if (module && relatedTarget && module.contains(relatedTarget)) {
      return;
    }

    // Optional: hide after delay if not interacting
    // setTimeout(() => {
    //   if (!document.activeElement?.closest('#featuredAdModule')) {
    //     hideModule();
    //   }
    // }, 200);
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  
  function init() {
    state.sessionId = getSessionId();
    state.isDismissed = isDismissedThisSession();
    state.impressionCount = getImpressionCount();

    // Create module element
    createModuleElement();

    // Attach event listeners
    const module = getModuleElement();
    if (module) {
      module.addEventListener('click', handleModuleClick);
    }

    const searchInput = document.getElementById('mainSearchInput');
    if (searchInput) {
      searchInput.addEventListener('focus', handleSearchFocus);
      searchInput.addEventListener('blur', handleSearchBlur);
    }

    // Preload ads
    fetchAds();

    console.log('[FeaturedAd] Module initialized');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', stopRotation);

  // Expose API
  window.FeaturedAdModule = {
    show: loadAndShowAd,
    hide: hideModule,
    dismiss: dismissModule,
    refresh: () => fetchAds(true).then(loadAndShowAd),
    getState: () => ({ ...state })
  };

})();
