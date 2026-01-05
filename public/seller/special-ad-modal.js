/* ═══════════════════════════════════════════════════════════════════════════
   Special Advertisement Modal - JavaScript Controller
   Premium Mobile-First Design with Credit Logic
   
   IMAGE MODULE STATE DIAGRAM:
   ┌─────────────────────────────────────────────────────────────────┐
   │                    IMAGE STATE MACHINE                          │
   ├─────────────────────────────────────────────────────────────────┤
   │   ┌─────────┐  product selected    ┌─────────┐                 │
   │   │  EMPTY  │ ──────────────────► │ LOADING │                  │
   │   └────┬────┘  (with image URL)    └────┬────┘                 │
   │        │                                │                       │
   │        │ no image URL                   ├── onload ──► PREVIEW  │
   │        │ (stay empty)                   │                       │
   │        │                                └── onerror ──► ERROR   │
   │        │                                                        │
   │   PREVIEW ◄── retry success ── ERROR ◄── network fail          │
   │        │                           │                            │
   │        └── remove/change ──────────┴── retry ──► LOADING       │
   └─────────────────────────────────────────────────────────────────┘
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ─────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────
  const API_CFG = window.VITRINET_API || null;
  const API_BASE = `${API_CFG ? API_CFG.backendOrigin : 'http://localhost:5000'}/api`;
  
  const withCreds = (init = {}) => {
    if (API_CFG) return API_CFG.ensureCredentials(init);
    if (init.credentials === undefined) {
      return { ...init, credentials: 'include' };
    }
    return init;
  };

  // Ad Plan Prices (will be fetched from server)
  const AD_PLAN_PRICES = {
    ad_search: 79000,
    ad_home: 99000,
    ad_products: 89000
  };

  const AD_PLAN_TITLES = {
    ad_search: 'تبلیغ ویژه در جستجو',
    ad_home: 'تبلیغ ویژه صفحه اول',
    ad_products: 'تبلیغ لیست محصولات'
  };

  // ─────────────────────────────────────────────────────
  // Debug Mode (only log in development)
  // ─────────────────────────────────────────────────────
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // ─────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────
  let state = {
    adType: 'product',
    selectedProductId: null,
    selectedProductImage: null,
    customImage: null,
    walletBalance: 0,
    useCredit: false,
    planSlug: 'ad_search',
    totalPrice: 79000,
    creditAmount: 0,
    maxCredit: 0, // Maximum credit allowed (min of wallet balance and 50% of total)
    finalPrice: 79000,
    isLoading: false,
    // Image state machine: 'empty' | 'loading' | 'preview' | 'error'
    imageState: 'empty',
    imageErrorReason: null,
    // Current image URL being displayed
    currentImageUrl: null,
    // Preload abort controller
    imageLoadAbortController: null
  };

  // ─────────────────────────────────────────────────────
  // DOM Elements
  // ─────────────────────────────────────────────────────
  let elements = {};

  const initElements = () => {
    elements = {
      backdrop: document.getElementById('specialAdBackdrop'),
      closeBtn: document.getElementById('specialAdCloseBtn'),
      form: document.getElementById('specialAdForm'),
      typeCards: document.querySelectorAll('.special-ad-type-card'),
      productPicker: document.getElementById('specialAdProductPicker'),
      productSelect: document.getElementById('specialAdProductSelect'),
      titleInput: document.getElementById('specialAdTitle'),
      titleCounter: document.getElementById('specialAdTitleCounter'),
      textInput: document.getElementById('specialAdText'),
      textCounter: document.getElementById('specialAdTextCounter'),
      imagePreview: document.getElementById('specialAdImagePreview'),
      previewImg: document.getElementById('specialAdPreviewImg'),
      imagePlaceholder: document.getElementById('specialAdImagePlaceholder'),
      imageInput: document.getElementById('specialAdImageInput'),
      changeImageBtn: document.getElementById('specialAdChangeImageBtn'),
      changeImageText: document.getElementById('specialAdChangeImageText'),
      removeImageBtn: document.getElementById('specialAdRemoveImageBtn'),
      changeImageOverlay: document.getElementById('specialAdChangeImageOverlay'),
      imageBadge: document.getElementById('specialAdImageBadge'),
      imageError: document.getElementById('specialAdImageError'),
      retryBtn: document.getElementById('specialAdRetryBtn'),
      imageStatus: document.getElementById('specialAdImageStatus'),
      editImageBtn: document.getElementById('specialAdEditImageBtn'),
      walletBalance: document.getElementById('specialAdWalletBalance'),
      creditToggle: document.getElementById('specialAdCreditToggle'),
      creditSwitch: document.getElementById('specialAdCreditSwitch'),
      creditHint: document.getElementById('specialAdCreditHint'),
      // Credit Allocation Controls
      creditAllocation: document.getElementById('specialAdCreditAllocation'),
      maxCreditDisplay: document.getElementById('specialAdMaxCredit'),
      creditSlider: document.getElementById('specialAdCreditSlider'),
      creditInput: document.getElementById('specialAdCreditInput'),
      creditChips: document.querySelectorAll('.special-ad-credit-chip'),
      creditClampHint: document.getElementById('specialAdCreditClampHint'),
      // Price Breakdown
      creditRow: document.getElementById('specialAdCreditRow'),
      cashRow: document.getElementById('specialAdCashRow'),
      totalPrice: document.getElementById('specialAdTotalPrice'),
      creditAmount: document.getElementById('specialAdCreditAmount'),
      cashAmount: document.getElementById('specialAdCashAmount'),
      finalPrice: document.getElementById('specialAdFinalPrice'),
      submitBtn: document.getElementById('specialAdSubmitBtn')
    };
  };

  // ─────────────────────────────────────────────────────
  // Utility Functions
  // ─────────────────────────────────────────────────────
  const toFaDigits = (num) => {
    if (num === null || num === undefined) return '';
    return String(num).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  };

  const toFaPrice = (num) => {
    return toFaDigits((+num || 0).toLocaleString('en-US'));
  };

  // ─────────────────────────────────────────────────────
  // API Functions
  // ─────────────────────────────────────────────────────
  const fetchSellerProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, withCreds());
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('fetchSellerProfile error:', err);
      return null;
    }
  };

  const fetchWalletBalance = async () => {
    try {
      const res = await fetch(`${API_BASE}/wallet`, withCreds());
      if (!res.ok) return 0;
      const data = await res.json();
      return data?.data?.balance || data?.balance || data?.wallet?.balance || 0;
    } catch (err) {
      console.error('fetchWalletBalance error:', err);
      return 0;
    }
  };

  const fetchProducts = async () => {
    try {
      const profile = await fetchSellerProfile();
      const sellerId = profile?.seller?.id || profile?.seller?._id;
      if (!sellerId) return [];
      const res = await fetch(`${API_BASE}/products?sellerId=${sellerId}`, withCreds());
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.error('fetchProducts error:', err);
      return [];
    }
  };

  const fetchAdPrices = async () => {
    try {
      const res = await fetch(`${API_BASE}/adPlans`, withCreds());
      if (!res.ok) return;
      const data = await res.json();
      const plans = data.adplans || {};
      Object.keys(AD_PLAN_PRICES).forEach(slug => {
        if (plans[slug] != null) AD_PLAN_PRICES[slug] = plans[slug];
      });
    } catch (err) {
      console.error('fetchAdPrices error:', err);
    }
  };

  // ─────────────────────────────────────────────────────
  // UI Update Functions
  // ─────────────────────────────────────────────────────
  const updateCharCounter = (input, counter, max) => {
    const len = input.value.length;
    counter.textContent = `${toFaDigits(len)} / ${toFaDigits(max)}`;
    counter.classList.remove('is-warning', 'is-error');
    if (len >= max) counter.classList.add('is-error');
    else if (len >= max * 0.8) counter.classList.add('is-warning');
  };

  const updateProductPicker = () => {
    if (state.adType === 'product') {
      elements.productPicker.style.display = 'block';
      elements.productSelect.required = true;
    } else {
      elements.productPicker.style.display = 'none';
      elements.productSelect.required = false;
    }
  };

  const updateTypeCards = () => {
    elements.typeCards.forEach(card => {
      const type = card.dataset.type;
      card.classList.toggle('is-selected', type === state.adType);
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE MODULE - Professional Implementation
  // ═══════════════════════════════════════════════════════════════════════════

  let currentObjectUrl = null;

  const revokeCurrentObjectUrl = () => {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
  };

  /**
   * Extract primary image URL from product data
   * Handles various API response formats
   */
  const extractProductImage = (product) => {
    if (!product) return null;
    
    const possibleFields = ['image', 'images', 'primaryImageUrl', 'img', 'photo', 'thumbnail', 'mainImage'];
    
    for (const field of possibleFields) {
      const value = product[field];
      if (!value) continue;
      
      // String value
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      
      // Array of strings or objects
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (typeof first === 'string' && first.trim()) return first.trim();
        if (first && typeof first === 'object') {
          const url = first.url || first.src || first.path || first.image || first.filename;
          if (url && typeof url === 'string') return url.trim();
        }
      }
      
      // Object with url property
      if (typeof value === 'object' && value !== null) {
        const url = value.url || value.src || value.path;
        if (url && typeof url === 'string') return url.trim();
      }
    }
    
    return null;
  };

  /**
   * Build absolute URL from image path
   */
  const buildImageUrl = (imagePath) => {
    if (!imagePath || typeof imagePath !== 'string') return null;
    
    const trimmed = imagePath.trim();
    if (!trimmed) return null;
    
    // Already absolute URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    
    // Data URL - return as-is
    if (trimmed.startsWith('data:')) {
      return trimmed;
    }
    
    // Block base64 in path
    if (trimmed.includes('base64')) {
      console.error('[AdImage] Invalid path contains base64');
      return null;
    }
    
    // Build server URL
    const baseUrl = API_BASE.replace('/api', '');
    const cleanPath = trimmed.startsWith('/') ? trimmed : 
                      trimmed.startsWith('uploads/') ? `/${trimmed}` : `/uploads/${trimmed}`;
    return `${baseUrl}${cleanPath}`;
  };

  /**
   * Preload image and return promise
   * @param {string} url - Image URL to preload
   * @param {number} timeout - Timeout in ms (default 10s)
   * @returns {Promise<string>} - Resolves with URL on success
   */
  const preloadImage = (url, timeout = 10000) => {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error('No URL provided'));
        return;
      }
      
      const img = new Image();
      let timeoutId = null;
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        img.onload = null;
        img.onerror = null;
      };
      
      img.onload = () => {
        cleanup();
        resolve(url);
      };
      
      img.onerror = () => {
        cleanup();
        reject(new Error('Image load failed'));
      };
      
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Image load timeout'));
      }, timeout);
      
      img.src = url;
    });
  };

  /**
   * Set image state and render UI
   */
  const setAdImageState = (newState, errorReason = null) => {
    if (state.imageState === newState && state.imageErrorReason === errorReason) return;
    
    if (isDev) console.log(`[AdImage] State: ${state.imageState} → ${newState}${errorReason ? ` (${errorReason})` : ''}`);
    state.imageState = newState;
    state.imageErrorReason = errorReason;
    renderAdImageUI();
  };

  /**
   * Render image UI based on current state
   */
  const renderAdImageUI = () => {
    if (!elements.imagePreview || !elements.previewImg) return;
    
    const { imageState, imageErrorReason, currentImageUrl } = state;
    
    // Reset classes
    elements.imagePreview.classList.remove('has-image', 'has-error', 'is-loading');
    
    // Hide all overlays first
    if (elements.imageError) elements.imageError.hidden = true;
    if (elements.imageBadge) elements.imageBadge.style.display = 'none';
    if (elements.changeImageOverlay) elements.changeImageOverlay.style.display = 'none';
    
    switch (imageState) {
      case 'empty':
        elements.previewImg.style.display = 'none';
        elements.previewImg.src = '';
        if (elements.imagePlaceholder) {
          elements.imagePlaceholder.style.display = 'flex';
          const text = elements.imagePlaceholder.querySelector('.special-ad-image-preview__placeholder-text');
          if (text) text.textContent = 'برای انتخاب تصویر ضربه بزنید';
        }
        if (elements.changeImageText) elements.changeImageText.textContent = 'انتخاب تصویر';
        if (elements.removeImageBtn) elements.removeImageBtn.hidden = true;
        if (elements.imageStatus) {
          elements.imageStatus.textContent = 'تصویر محصول به صورت خودکار نمایش داده می‌شود';
          elements.imageStatus.classList.remove('is-custom');
        }
        break;
        
      case 'loading':
        elements.imagePreview.classList.add('is-loading');
        elements.previewImg.style.display = 'none';
        if (elements.imagePlaceholder) {
          elements.imagePlaceholder.style.display = 'flex';
          const text = elements.imagePlaceholder.querySelector('.special-ad-image-preview__placeholder-text');
          if (text) text.textContent = 'در حال بارگذاری...';
        }
        if (elements.changeImageText) elements.changeImageText.textContent = 'انتخاب تصویر';
        if (elements.removeImageBtn) elements.removeImageBtn.hidden = true;
        if (elements.imageStatus) {
          elements.imageStatus.textContent = 'در حال بارگذاری تصویر...';
        }
        break;
        
      case 'preview':
        elements.imagePreview.classList.add('has-image');
        elements.previewImg.src = currentImageUrl || '';
        elements.previewImg.style.display = 'block';
        elements.previewImg.style.opacity = '1';
        if (elements.imagePlaceholder) elements.imagePlaceholder.style.display = 'none';
        if (elements.changeImageOverlay) elements.changeImageOverlay.style.display = 'flex';
        if (elements.imageBadge) elements.imageBadge.style.display = 'block';
        if (elements.changeImageText) elements.changeImageText.textContent = 'تغییر تصویر';
        if (elements.removeImageBtn) elements.removeImageBtn.hidden = !state.customImage;
        if (elements.imageStatus) {
          elements.imageStatus.textContent = state.customImage ? 'تصویر سفارشی' : 'تصویر محصول';
          elements.imageStatus.classList.toggle('is-custom', !!state.customImage);
        }
        break;
        
      case 'error':
        elements.imagePreview.classList.add('has-error');
        elements.previewImg.style.display = 'none';
        elements.previewImg.src = '';
        if (elements.imagePlaceholder) elements.imagePlaceholder.style.display = 'none';
        if (elements.imageError) {
          elements.imageError.hidden = false;
          const errorText = elements.imageError.querySelector('span:not(button)');
          if (errorText) errorText.textContent = errorReason || 'خطا در بارگذاری تصویر';
        }
        if (elements.changeImageText) elements.changeImageText.textContent = 'انتخاب تصویر';
        if (elements.removeImageBtn) elements.removeImageBtn.hidden = true;
        if (elements.imageStatus) {
          elements.imageStatus.textContent = errorReason || 'خطا در بارگذاری';
        }
        break;
    }
  };

  /**
   * Set ad image source and preload
   * Main entry point for setting image
   */
  const setAdImageSource = async (imageSource, isCustom = false) => {
    // Handle File/Blob (custom upload)
    if (imageSource instanceof File || imageSource instanceof Blob) {
      if (isDev) console.log(`[AdImage] Custom image: ${imageSource.type}, ${imageSource.size} bytes`);
      revokeCurrentObjectUrl();
      currentObjectUrl = URL.createObjectURL(imageSource);
      state.currentImageUrl = currentObjectUrl;
      state.customImage = imageSource;
      setAdImageState('preview');
      return;
    }
    
    // No image source - show empty state
    if (!imageSource) {
      revokeCurrentObjectUrl();
      state.currentImageUrl = null;
      if (!isCustom) state.customImage = null;
      setAdImageState('empty');
      return;
    }
    
    // Build absolute URL
    const absoluteUrl = buildImageUrl(imageSource);
    if (isDev) {
      const urlType = absoluteUrl?.startsWith('data:') ? 'data-url' : 
                      absoluteUrl?.startsWith('http') ? 'http' : 'relative';
      console.log(`[AdImage] Loading ${urlType} image`);
    }
    
    if (!absoluteUrl) {
      state.currentImageUrl = null;
      setAdImageState('empty');
      return;
    }
    
    // Data URL - show immediately
    if (absoluteUrl.startsWith('data:')) {
      state.currentImageUrl = absoluteUrl;
      setAdImageState('preview');
      return;
    }
    
    // Network URL - preload first
    setAdImageState('loading');
    
    try {
      await preloadImage(absoluteUrl);
      state.currentImageUrl = absoluteUrl;
      if (!isCustom) state.customImage = null;
      setAdImageState('preview');
      if (isDev) console.log('[AdImage] Image loaded successfully');
    } catch (err) {
      console.error('[AdImage] Preload failed:', err.message);
      state.currentImageUrl = null;
      
      let errorReason = 'خطا در بارگذاری تصویر';
      if (!navigator.onLine) errorReason = 'اتصال اینترنت برقرار نیست';
      else if (err.message.includes('timeout')) errorReason = 'زمان بارگذاری به پایان رسید';
      
      setAdImageState('error', errorReason);
    }
  };

  /**
   * Handle product selection - auto-load product image
   */
  const onProductSelected = (productId, productImagePath) => {
    if (isDev) console.log(`[AdImage] Product selected: ${productId}, hasImage: ${!!productImagePath}`);
    
    state.selectedProductId = productId;
    state.selectedProductImage = productImagePath;
    
    // If user has custom image, don't override
    if (state.customImage) {
      if (isDev) console.log('[AdImage] Custom image exists, keeping it');
      return;
    }
    
    // Load product image
    if (productImagePath) {
      setAdImageSource(productImagePath, false);
    } else {
      setAdImageState('empty');
    }
  };

  /**
   * Retry loading current image
   */
  const retryImageLoad = () => {
    if (isDev) console.log('[AdImage] Retry requested');
    
    if (state.customImage) {
      setAdImageSource(state.customImage, true);
    } else if (state.selectedProductImage) {
      setAdImageSource(state.selectedProductImage, false);
    } else {
      // No image to retry - open file picker
      elements.imageInput?.click();
    }
  };

  /**
   * Remove custom image and revert to product image
   */
  const removeCustomImage = () => {
    if (isDev) console.log('[AdImage] Remove custom image');
    
    state.customImage = null;
    revokeCurrentObjectUrl();
    elements.imageInput.value = '';
    
    // Revert to product image if available
    if (state.selectedProductImage) {
      setAdImageSource(state.selectedProductImage, false);
    } else {
      setAdImageState('empty');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // END IMAGE MODULE
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // CREDIT ALLOCATION MODULE - Enhanced Payment Control
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Convert Persian digits to English for calculations
   */
  const toEnDigits = (str) => {
    if (!str) return '';
    return String(str).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  };

  /**
   * Calculate maximum allowed credit
   * Returns min(walletBalance, 50% of totalPrice)
   */
  const calculateMaxCredit = () => {
    const maxByPercent = Math.floor(state.totalPrice * 0.5);
    return Math.min(state.walletBalance, maxByPercent);
  };

  /**
   * Update slider visual progress
   */
  const updateSliderProgress = () => {
    if (!elements.creditSlider) return;
    const max = parseInt(elements.creditSlider.max) || 1;
    const value = parseInt(elements.creditSlider.value) || 0;
    const progress = (value / max) * 100;
    elements.creditSlider.style.setProperty('--slider-progress', `${progress}%`);
  };

  /**
   * Set credit amount with validation and clamping
   */
  const setCreditAmount = (amount, showClampHint = false) => {
    // Clamp to valid range
    const clamped = Math.max(0, Math.min(amount, state.maxCredit));
    const wasClamped = amount > state.maxCredit && showClampHint;
    
    state.creditAmount = clamped;
    
    // Update slider
    if (elements.creditSlider) {
      elements.creditSlider.value = clamped;
      updateSliderProgress();
    }
    
    // Update input
    if (elements.creditInput) {
      elements.creditInput.value = toFaDigits(clamped.toLocaleString('en-US'));
    }
    
    // Show/hide clamp hint
    if (elements.creditClampHint) {
      elements.creditClampHint.hidden = !wasClamped;
      if (wasClamped) {
        setTimeout(() => {
          if (elements.creditClampHint) elements.creditClampHint.hidden = true;
        }, 3000);
      }
    }
    
    // Update chip active states
    updateChipStates();
    
    // Update price breakdown
    updatePriceDisplay();
  };

  /**
   * Update chip active states based on current credit amount
   */
  const updateChipStates = () => {
    if (!elements.creditChips) return;
    
    elements.creditChips.forEach(chip => {
      const percent = parseInt(chip.dataset.percent) || 0;
      const chipValue = percent === 100 
        ? state.maxCredit 
        : Math.floor(state.maxCredit * (percent / 100));
      
      chip.classList.toggle('is-active', state.creditAmount === chipValue && chipValue > 0);
    });
  };

  /**
   * Update price display (breakdown section)
   */
  const updatePriceDisplay = () => {
    state.finalPrice = state.totalPrice - state.creditAmount;
    const cashAmount = state.finalPrice;
    
    // Total price
    if (elements.totalPrice) {
      elements.totalPrice.textContent = `${toFaPrice(state.totalPrice)} تومان`;
    }
    
    // Credit row
    if (state.creditAmount > 0) {
      if (elements.creditRow) elements.creditRow.style.display = 'flex';
      if (elements.creditAmount) {
        elements.creditAmount.textContent = `-${toFaPrice(state.creditAmount)} تومان`;
      }
      elements.creditToggle?.classList.add('is-active');
    } else {
      if (elements.creditRow) elements.creditRow.style.display = 'none';
      elements.creditToggle?.classList.remove('is-active');
    }
    
    // Cash row (shown when using credit)
    if (elements.cashRow) {
      elements.cashRow.style.display = state.creditAmount > 0 ? 'flex' : 'none';
    }
    if (elements.cashAmount) {
      elements.cashAmount.textContent = `${toFaPrice(cashAmount)} تومان`;
    }
    
    // Final price
    if (elements.finalPrice) {
      elements.finalPrice.textContent = `${toFaPrice(state.finalPrice)} تومان`;
    }
  };

  /**
   * Show/hide credit allocation control with animation
   */
  const toggleCreditAllocation = (show) => {
    if (!elements.creditAllocation) return;
    
    if (show) {
      // Calculate and set max credit
      state.maxCredit = calculateMaxCredit();
      
      // Update max display
      if (elements.maxCreditDisplay) {
        elements.maxCreditDisplay.textContent = `${toFaPrice(state.maxCredit)} تومان`;
      }
      
      // Configure slider
      if (elements.creditSlider) {
        elements.creditSlider.max = state.maxCredit;
        elements.creditSlider.value = state.creditAmount;
        updateSliderProgress();
      }
      
      // Update input
      if (elements.creditInput) {
        elements.creditInput.value = toFaDigits(state.creditAmount.toLocaleString('en-US'));
      }
      
      // Show with animation
      elements.creditAllocation.hidden = false;
      
      // Set initial credit to max if first time enabling
      if (state.creditAmount === 0 && state.maxCredit > 0) {
        setCreditAmount(state.maxCredit);
      }
    } else {
      elements.creditAllocation.hidden = true;
      state.creditAmount = 0;
      updatePriceDisplay();
    }
  };

  /**
   * Handle slider input
   */
  const handleCreditSliderInput = (e) => {
    const value = parseInt(e.target.value) || 0;
    setCreditAmount(value);
  };

  /**
   * Handle text input change
   */
  const handleCreditInputChange = (e) => {
    const rawValue = toEnDigits(e.target.value).replace(/[^\d]/g, '');
    const value = parseInt(rawValue) || 0;
    setCreditAmount(value, true);
  };

  /**
   * Handle chip click
   */
  const handleCreditChipClick = (e) => {
    const chip = e.target.closest('.special-ad-credit-chip');
    if (!chip) return;
    
    const percent = parseInt(chip.dataset.percent) || 0;
    const value = percent === 100 
      ? state.maxCredit 
      : Math.floor(state.maxCredit * (percent / 100));
    
    setCreditAmount(value);
  };

  const updateWalletDisplay = () => {
    if (!elements.walletBalance) return;
    elements.walletBalance.textContent = `${toFaPrice(state.walletBalance)} تومان`;
    
    const minCredit = 100;
    const canUseCredit = state.walletBalance >= minCredit;
    
    if (!canUseCredit) {
      elements.creditToggle?.classList.add('is-disabled');
      if (elements.creditSwitch) {
        elements.creditSwitch.disabled = true;
        elements.creditSwitch.checked = false;
      }
      if (elements.creditHint) {
        elements.creditHint.textContent = 'اعتبار کافی ندارید';
        elements.creditHint.classList.add('is-error');
      }
      state.useCredit = false;
      toggleCreditAllocation(false);
    } else {
      elements.creditToggle?.classList.remove('is-disabled');
      if (elements.creditSwitch) elements.creditSwitch.disabled = false;
      if (elements.creditHint) {
        elements.creditHint.textContent = 'اعتبار شما برای کسر از هزینه استفاده می‌شود';
        elements.creditHint.classList.remove('is-error');
      }
    }
  };

  const updatePriceBreakdown = () => {
    state.totalPrice = AD_PLAN_PRICES[state.planSlug] || 79000;
    
    // Recalculate max credit when price changes
    const newMaxCredit = calculateMaxCredit();
    
    // If max credit changed and we're using credit, adjust
    if (state.useCredit && state.maxCredit !== newMaxCredit) {
      state.maxCredit = newMaxCredit;
      
      // Update max display
      if (elements.maxCreditDisplay) {
        elements.maxCreditDisplay.textContent = `${toFaPrice(state.maxCredit)} تومان`;
      }
      
      // Update slider max
      if (elements.creditSlider) {
        elements.creditSlider.max = state.maxCredit;
      }
      
      // Clamp current credit amount if needed
      if (state.creditAmount > state.maxCredit) {
        setCreditAmount(state.maxCredit);
      }
    }
    
    if (!state.useCredit) {
      state.creditAmount = 0;
    }
    
    updatePriceDisplay();
  };


  const populateProducts = async () => {
    if (!elements.productSelect) return;
    elements.productSelect.innerHTML = '<option value="">در حال بارگذاری...</option>';
    
    const response = await fetchProducts();
    
    // Handle different API response formats
    let productList = [];
    if (Array.isArray(response)) {
      productList = response;
    } else if (response?.products) {
      productList = response.products;
    } else if (response?.data) {
      productList = response.data;
    }
    
    if (isDev) console.log('[AdImage] Products loaded:', productList.length);
    
    if (!productList.length) {
      elements.productSelect.innerHTML = '<option value="">محصولی برای انتخاب نیست</option>';
      return;
    }
    
    elements.productSelect.innerHTML = '<option value="">یک مورد را انتخاب کنید...</option>';
    
    productList.forEach(product => {
      const option = document.createElement('option');
      option.value = product._id || product.id;
      option.textContent = product.title || product.name || 'بدون نام';
      
      // Extract image using helper
      const productImage = extractProductImage(product);
      option.dataset.image = productImage || '';
      
      elements.productSelect.appendChild(option);
    });
  };

  const setLoading = (loading) => {
    state.isLoading = loading;
    if (elements.submitBtn) {
      elements.submitBtn.disabled = loading;
      elements.submitBtn.classList.toggle('is-loading', loading);
    }
  };

  // ─────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────
  const handleTypeChange = (e) => {
    const card = e.target.closest('.special-ad-type-card');
    if (!card) return;
    
    const radio = card.querySelector('input[type="radio"]');
    if (radio) {
      radio.checked = true;
      state.adType = radio.value;
      updateTypeCards();
      updateProductPicker();
      
      if (state.adType === 'shop') {
        state.selectedProductId = null;
        state.selectedProductImage = null;
        if (!state.customImage) {
          setAdImageState('empty');
        }
      }
    }
  };

  const handleProductChange = (e) => {
    const select = e.target;
    const selectedOption = select.options[select.selectedIndex];
    const productId = select.value;
    const productImage = selectedOption?.dataset?.image || null;
    
    if (isDev) console.log(`[AdImage] Product changed: ${productId}, hasImage: ${!!productImage}`);
    
    // Use the image module
    onProductSelected(productId, productImage);
  };

  const handleImageEdit = () => {
    elements.imageInput?.click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      showToast('لطفاً یک فایل تصویری انتخاب کنید', true);
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      showToast('حجم تصویر نباید بیشتر از ۵ مگابایت باشد', true);
      return;
    }
    
    // Set custom image
    setAdImageSource(file, true);
  };

  const handleRemoveImage = () => {
    removeCustomImage();
  };

  const handlePlaceholderClick = () => {
    elements.imageInput?.click();
  };

  const handleRetryImage = () => {
    retryImageLoad();
  };

  const handleCreditToggle = (e) => {
    state.useCredit = e.target.checked;
    toggleCreditAllocation(state.useCredit);
    updatePriceBreakdown();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (state.isLoading) return;
    
    if (state.adType === 'product' && !state.selectedProductId) {
      showToast('لطفاً یک محصول انتخاب کنید', true);
      return;
    }
    
    const title = elements.titleInput?.value?.trim();
    if (!title) {
      showToast('عنوان تبلیغ الزامی است', true);
      return;
    }
    
    setLoading(true);
    
    try {
      const profile = await fetchSellerProfile();
      const sellerId = profile?.seller?.id || profile?.seller?._id;
      
      if (!sellerId) {
        showToast('خطا در دریافت اطلاعات فروشنده', true);
        setLoading(false);
        return;
      }
      
      const formData = new FormData();
      formData.append('sellerId', sellerId);
      formData.append('planSlug', state.planSlug);
      formData.append('title', title);
      formData.append('text', elements.textInput?.value?.trim() || '');
      formData.append('useCredit', state.useCredit);
      formData.append('creditAmount', state.creditAmount);
      
      if (state.adType === 'product' && state.selectedProductId) {
        formData.append('productId', state.selectedProductId);
      }
      
      if (state.customImage) {
        formData.append('image', state.customImage);
      }
      
      const res = await fetch(`${API_BASE}/adOrder`, withCreds({
        method: 'POST',
        body: formData
      }));
      
      const result = await res.json();
      
      if (!res.ok || !result.success) {
        showToast(result.message || 'ثبت تبلیغ ناموفق بود', true);
        setLoading(false);
        return;
      }
      
      closeModal();
      showSuccessPopup({
        title: 'تبلیغ شما با موفقیت ثبت شد',
        message: `تبلیغ «${title}» ثبت شد و پس از تایید ادمین نمایش داده خواهد شد.`,
        details: [
          `پلن انتخابی: ${AD_PLAN_TITLES[state.planSlug]}`,
          state.creditAmount > 0 ? `کسر از اعتبار: ${toFaPrice(state.creditAmount)} تومان` : '',
          `مبلغ پرداختی: ${toFaPrice(state.finalPrice)} تومان`
        ].filter(Boolean),
        highlight: 'ثبت تبلیغ جدید'
      });
      
      resetForm();
    } catch (err) {
      console.error('Submit error:', err);
      showToast('خطا در ثبت تبلیغ', true);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === elements.backdrop) {
      closeModal();
    }
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape' && elements.backdrop?.classList.contains('is-open')) {
      closeModal();
    }
  };

  // ─────────────────────────────────────────────────────
  // Modal Control
  // ─────────────────────────────────────────────────────
  const openModal = async (planSlug = 'ad_search') => {
    state.planSlug = planSlug;
    
    if (!elements.backdrop) {
      initElements();
      attachEventListeners();
    }
    
    // Reset state
    state.selectedProductId = null;
    state.selectedProductImage = null;
    state.customImage = null;
    state.imageState = 'empty';
    state.imageErrorReason = null;
    state.currentImageUrl = null;
    revokeCurrentObjectUrl();
    
    // Render empty state
    renderAdImageUI();
    
    // Fetch data
    await Promise.all([
      fetchAdPrices(),
      populateProducts(),
      (async () => {
        state.walletBalance = await fetchWalletBalance();
        updateWalletDisplay();
      })()
    ]);
    
    updatePriceBreakdown();
    
    elements.backdrop?.classList.add('is-open');
    document.body.classList.add('overflow-hidden', 'no-scroll');
    
    setTimeout(() => elements.titleInput?.focus(), 300);
  };

  const closeModal = () => {
    if (!elements.backdrop) return;
    revokeCurrentObjectUrl();
    elements.backdrop.classList.remove('is-open');
    document.body.classList.remove('overflow-hidden', 'no-scroll');
  };

  const resetForm = () => {
    revokeCurrentObjectUrl();
    
    state.adType = 'product';
    state.selectedProductId = null;
    state.selectedProductImage = null;
    state.customImage = null;
    state.useCredit = false;
    state.creditAmount = 0;
    state.maxCredit = 0;
    state.finalPrice = AD_PLAN_PRICES[state.planSlug];
    state.isLoading = false;
    state.imageState = 'empty';
    state.imageErrorReason = null;
    state.currentImageUrl = null;
    
    elements.form?.reset();
    if (elements.creditSwitch) elements.creditSwitch.checked = false;
    if (elements.imageInput) elements.imageInput.value = '';
    
    // Reset credit allocation UI
    toggleCreditAllocation(false);
    
    updateTypeCards();
    updateProductPicker();
    renderAdImageUI();
    updatePriceBreakdown();
    
    if (elements.titleInput && elements.titleCounter) {
      updateCharCounter(elements.titleInput, elements.titleCounter, 25);
    }
    if (elements.textInput && elements.textCounter) {
      updateCharCounter(elements.textInput, elements.textCounter, 30);
    }
  };

  // ─────────────────────────────────────────────────────
  // Toast & Popup Helpers
  // ─────────────────────────────────────────────────────
  const showToast = (message, isError = false) => {
    if (window.UIComponents?.showToast) {
      window.UIComponents.showToast(message, isError ? 'error' : 'success');
      return;
    }
    
    let toast = document.getElementById('special-ad-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'special-ad-toast';
      toast.style.cssText = `
        position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%) translateY(20px);
        padding: 14px 24px; border-radius: 16px; font-size: 0.9rem; font-weight: 600;
        z-index: 9999; opacity: 0; transition: all 0.3s ease; max-width: 90%; text-align: center;
      `;
      document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.background = isError ? 'linear-gradient(135deg, #fef2f2, #fee2e2)' : 'linear-gradient(135deg, #ecfdf5, #d1fae5)';
    toast.style.color = isError ? '#dc2626' : '#059669';
    toast.style.border = isError ? '1px solid #fecaca' : '1px solid #a7f3d0';
    
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 3000);
  };

  const showSuccessPopup = (options) => {
    if (typeof window.showSuccessPopup === 'function') {
      window.showSuccessPopup(options);
      return;
    }
    showToast(options.title);
  };

  // ─────────────────────────────────────────────────────
  // Event Listeners
  // ─────────────────────────────────────────────────────
  const attachEventListeners = () => {
    elements.closeBtn?.addEventListener('click', closeModal);
    elements.backdrop?.addEventListener('click', handleBackdropClick);
    document.addEventListener('keydown', handleKeydown);
    
    elements.typeCards.forEach(card => {
      card.addEventListener('click', handleTypeChange);
    });
    
    elements.productSelect?.addEventListener('change', handleProductChange);
    
    elements.titleInput?.addEventListener('input', () => {
      updateCharCounter(elements.titleInput, elements.titleCounter, 25);
    });
    
    elements.textInput?.addEventListener('input', () => {
      updateCharCounter(elements.textInput, elements.textCounter, 30);
    });
    
    // Image actions
    elements.changeImageBtn?.addEventListener('click', handleImageEdit);
    elements.changeImageOverlay?.addEventListener('click', handleImageEdit);
    elements.removeImageBtn?.addEventListener('click', handleRemoveImage);
    elements.imagePlaceholder?.addEventListener('click', handlePlaceholderClick);
    elements.retryBtn?.addEventListener('click', handleRetryImage);
    elements.editImageBtn?.addEventListener('click', handleImageEdit);
    elements.imageInput?.addEventListener('change', handleImageChange);
    
    // Credit allocation controls
    elements.creditSwitch?.addEventListener('change', handleCreditToggle);
    elements.creditSlider?.addEventListener('input', handleCreditSliderInput);
    elements.creditInput?.addEventListener('change', handleCreditInputChange);
    elements.creditInput?.addEventListener('blur', handleCreditInputChange);
    
    // Credit chips
    elements.creditChips?.forEach(chip => {
      chip.addEventListener('click', handleCreditChipClick);
    });
    
    elements.form?.addEventListener('submit', handleSubmit);
  };

  // ─────────────────────────────────────────────────────
  // Initialize
  // ─────────────────────────────────────────────────────
  const init = () => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initElements();
        attachEventListeners();
        // Ensure clean initial state
        if (elements.imagePreview) {
          elements.imagePreview.classList.remove('has-error', 'has-image', 'is-loading');
        }
        if (elements.imageError) elements.imageError.hidden = true;
      });
    } else {
      initElements();
      attachEventListeners();
      if (elements.imagePreview) {
        elements.imagePreview.classList.remove('has-error', 'has-image', 'is-loading');
      }
      if (elements.imageError) elements.imageError.hidden = true;
    }
  };

  // ─────────────────────────────────────────────────────
  // Export to Window
  // ─────────────────────────────────────────────────────
  window.SpecialAdModal = {
    open: openModal,
    close: closeModal,
    reset: resetForm
  };

  window.openSpecialAdModal = openModal;

  init();

})();
