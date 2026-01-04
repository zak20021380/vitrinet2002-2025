/* ═══════════════════════════════════════════════════════════════════════════
   Special Advertisement Modal - JavaScript Controller
   Premium Mobile-First Design with Credit Logic
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
    finalPrice: 79000,
    isLoading: false,
    // Image state machine: 'empty' | 'loading' | 'preview' | 'error'
    imageState: 'empty',
    imageErrorReason: null
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
      // New image action elements
      changeImageBtn: document.getElementById('specialAdChangeImageBtn'),
      changeImageText: document.getElementById('specialAdChangeImageText'),
      removeImageBtn: document.getElementById('specialAdRemoveImageBtn'),
      changeImageOverlay: document.getElementById('specialAdChangeImageOverlay'),
      imageBadge: document.getElementById('specialAdImageBadge'),
      imageError: document.getElementById('specialAdImageError'),
      retryBtn: document.getElementById('specialAdRetryBtn'),
      imageStatus: document.getElementById('specialAdImageStatus'),
      // Legacy support
      editImageBtn: document.getElementById('specialAdEditImageBtn'),
      walletBalance: document.getElementById('specialAdWalletBalance'),
      creditToggle: document.getElementById('specialAdCreditToggle'),
      creditSwitch: document.getElementById('specialAdCreditSwitch'),
      creditHint: document.getElementById('specialAdCreditHint'),
      creditRow: document.getElementById('specialAdCreditRow'),
      totalPrice: document.getElementById('specialAdTotalPrice'),
      creditAmount: document.getElementById('specialAdCreditAmount'),
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

  const faToEn = (str) => {
    return (str || '').replace(/[۰-۹]/g, d => '0123456789'.charAt('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
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
      // Use the correct wallet endpoint that uses auth token (not sellerId query param)
      // The /api/wallet endpoint uses authMiddleware('seller') which extracts seller from token
      const res = await fetch(`${API_BASE}/wallet`, withCreds());
      
      if (res.status === 401) {
        console.warn('[SpecialAdModal] Wallet fetch unauthorized - user may need to re-login');
        return 0;
      }
      
      if (!res.ok) {
        console.warn('[SpecialAdModal] Wallet fetch failed:', res.status);
        return 0;
      }
      
      const data = await res.json();
      // The wallet endpoint returns { data: { balance, ... } }
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
        if (plans[slug] != null) {
          AD_PLAN_PRICES[slug] = plans[slug];
        }
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
    if (len >= max) {
      counter.classList.add('is-error');
    } else if (len >= max * 0.8) {
      counter.classList.add('is-warning');
    }
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

  // Track object URLs for cleanup
  let currentObjectUrl = null;

  /**
   * Safely revoke any existing object URL to prevent memory leaks
   */
  const revokeCurrentObjectUrl = () => {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
  };

  /**
   * Check if a string is a base64 dataURL
   */
  const isDataUrl = (str) => {
    return typeof str === 'string' && str.startsWith('data:');
  };

  /**
   * Check if a string is a valid HTTP(S) URL
   */
  const isHttpUrl = (str) => {
    return typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'));
  };

  /**
   * Check if a value is a File or Blob
   */
  const isFileOrBlob = (value) => {
    return value instanceof File || value instanceof Blob;
  };

  /**
   * Resolve image source for preview:
   * - dataURL → use directly (never fetch)
   * - File/Blob → create objectURL
   * - http(s) URL → use directly
   * - server filename → prepend /uploads/
   * 
   * @param {string|File|Blob|null} imageValue - The image value to resolve
   * @returns {string|null} - The resolved image URL for preview
   */
  const resolveImageSrc = (imageValue) => {
    if (!imageValue) return null;

    // Case 1: File or Blob - create object URL
    if (isFileOrBlob(imageValue)) {
      revokeCurrentObjectUrl();
      currentObjectUrl = URL.createObjectURL(imageValue);
      return currentObjectUrl;
    }

    // Case 2: Already a dataURL - use directly (NEVER fetch)
    if (isDataUrl(imageValue)) {
      // Dev warning: dataURLs should not be stored/sent as paths
      console.warn('[SpecialAdModal] Using dataURL for preview. Ensure this is not sent to server as a path.');
      return imageValue;
    }

    // Case 3: Full HTTP(S) URL - use directly
    if (isHttpUrl(imageValue)) {
      return imageValue;
    }

    // Case 4: Server filename/path - prepend base URL
    // Guard: Make sure it doesn't contain base64 indicators
    if (typeof imageValue === 'string' && imageValue.length > 0) {
      if (imageValue.includes('base64') || imageValue.includes('data:')) {
        console.error('[SpecialAdModal] Invalid image path contains base64 data. Blocking to prevent 431 error.');
        return null;
      }
      
      const baseUrl = API_BASE.replace('/api', '');
      // Handle paths that may or may not start with /
      const cleanPath = imageValue.startsWith('/') ? imageValue : `/uploads/${imageValue}`;
      return `${baseUrl}${cleanPath}`;
    }

    return null;
  };

  /**
   * Image State Machine
   * States: 'empty' | 'loading' | 'preview' | 'error'
   * 
   * Transitions:
   * - empty → loading (when product selected or image fetch starts)
   * - loading → preview (when image loads successfully)
   * - loading → empty (when image URL is missing/invalid - not an error)
   * - loading → error (when actual fetch fails: network/403/404/timeout)
   * - preview → loading (when product changes or retry)
   * - error → loading (when retry clicked)
   * - any → empty (when image removed or product cleared)
   */
  const setImageState = (newState, errorReason = null) => {
    // Prevent redundant state changes
    if (state.imageState === newState && state.imageErrorReason === errorReason) {
      return;
    }
    
    const prevState = state.imageState;
    state.imageState = newState;
    state.imageErrorReason = errorReason;
    
    console.log(`[SpecialAdModal] Image state: ${prevState} → ${newState}${errorReason ? ` (${errorReason})` : ''}`);
    
    // Update UI based on state
    renderImageState();
  };

  /**
   * Render UI based on current image state
   * Ensures mutually exclusive visual states
   */
  const renderImageState = () => {
    // Guard: ensure elements are initialized
    if (!elements.imagePreview || !elements.previewImg) {
      console.warn('[SpecialAdModal] renderImageState called before elements initialized');
      return;
    }
    
    const { imageState, imageErrorReason } = state;
    
    // Reset all states first
    elements.imagePreview.classList.remove('has-image', 'has-error', 'is-loading');
    if (elements.imageError) elements.imageError.hidden = true;
    if (elements.imageBadge) elements.imageBadge.style.display = 'none';
    if (elements.changeImageOverlay) elements.changeImageOverlay.style.display = 'none';
    
    switch (imageState) {
      case 'empty':
        // Show placeholder, hide image
        elements.previewImg.style.display = 'none';
        elements.previewImg.style.opacity = '0';
        if (elements.imagePlaceholder) {
          elements.imagePlaceholder.style.display = 'flex';
          // Reset placeholder text
          const placeholderText = elements.imagePlaceholder.querySelector('.special-ad-image-preview__placeholder-text');
          if (placeholderText) placeholderText.textContent = 'برای انتخاب تصویر ضربه بزنید';
        }
        if (elements.changeImageText) elements.changeImageText.textContent = 'انتخاب تصویر';
        if (elements.removeImageBtn) elements.removeImageBtn.hidden = true;
        if (elements.imageStatus) {
          elements.imageStatus.textContent = 'پیش‌فرض: تصویر محصول انتخابی';
          elements.imageStatus.classList.remove('is-custom');
        }
        break;
        
      case 'loading':
        // Show loading indicator in placeholder
        if (elements.imagePlaceholder) {
          elements.imagePlaceholder.style.display = 'flex';
          const placeholderText = elements.imagePlaceholder.querySelector('.special-ad-image-preview__placeholder-text');
          if (placeholderText) placeholderText.textContent = 'در حال بارگذاری...';
        }
        elements.imagePreview.classList.add('is-loading');
        elements.previewImg.style.display = 'none';
        elements.previewImg.style.opacity = '0';
        if (elements.changeImageText) elements.changeImageText.textContent = 'انتخاب تصویر';
        if (elements.removeImageBtn) elements.removeImageBtn.hidden = true;
        if (elements.imageStatus) {
          elements.imageStatus.textContent = 'در حال بارگذاری تصویر...';
          elements.imageStatus.classList.remove('is-custom');
        }
        break;
        
      case 'preview':
        // Show image, hide placeholder
        elements.previewImg.style.display = 'block';
        elements.previewImg.style.opacity = '1';
        if (elements.imagePlaceholder) elements.imagePlaceholder.style.display = 'none';
        elements.imagePreview.classList.add('has-image');
        if (elements.changeImageOverlay) elements.changeImageOverlay.style.display = 'flex';
        if (elements.imageBadge) elements.imageBadge.style.display = 'block';
        if (elements.changeImageText) elements.changeImageText.textContent = 'تغییر تصویر';
        if (elements.removeImageBtn) elements.removeImageBtn.hidden = false;
        if (elements.imageStatus) {
          if (state.customImage) {
            elements.imageStatus.textContent = 'تصویر سفارشی انتخاب شد';
            elements.imageStatus.classList.add('is-custom');
          } else {
            elements.imageStatus.textContent = 'تصویر محصول انتخابی';
            elements.imageStatus.classList.remove('is-custom');
          }
        }
        break;
        
      case 'error':
        // Show error state
        elements.imagePreview.classList.add('has-error');
        elements.previewImg.style.display = 'none';
        elements.previewImg.style.opacity = '0';
        if (elements.imagePlaceholder) elements.imagePlaceholder.style.display = 'none';
        if (elements.imageError) {
          elements.imageError.hidden = false;
          // Update error message if we have a reason
          const errorSpan = elements.imageError.querySelector('span:not(.special-ad-image-retry-btn)');
          if (errorSpan && imageErrorReason) {
            errorSpan.textContent = imageErrorReason;
          } else if (errorSpan) {
            errorSpan.textContent = 'خطا در بارگذاری تصویر';
          }
        }
        if (elements.changeImageText) elements.changeImageText.textContent = 'انتخاب تصویر';
        if (elements.removeImageBtn) elements.removeImageBtn.hidden = true;
        if (elements.imageStatus) {
          elements.imageStatus.textContent = imageErrorReason || 'خطا در بارگذاری';
          elements.imageStatus.classList.remove('is-custom');
        }
        break;
    }
  };

  /**
   * Load and display image with proper state management
   * @param {string|File|Blob|null} imageValue - The image to load
   * @param {boolean} isProductImage - Whether this is from product selection
   */
  const loadImage = (imageValue, isProductImage = false) => {
    // If no image value, go to empty state (not error)
    if (!imageValue) {
      revokeCurrentObjectUrl();
      elements.previewImg.src = '';
      setImageState('empty');
      return;
    }
    
    // Resolve the image source
    const resolvedSrc = resolveImageSrc(imageValue);
    
    if (!resolvedSrc) {
      // Invalid/missing URL - show empty state, not error
      revokeCurrentObjectUrl();
      elements.previewImg.src = '';
      setImageState('empty');
      return;
    }
    
    // For File/Blob or dataURL, we can show preview immediately (no network fetch)
    if (isFileOrBlob(imageValue) || isDataUrl(imageValue)) {
      elements.previewImg.src = resolvedSrc;
      setImageState('preview');
      return;
    }
    
    // For network URLs, show loading state and wait for load/error
    setImageState('loading');
    
    // Create a new image to test loading
    const testImg = new Image();
    
    testImg.onload = () => {
      // Success! Update the actual preview image and show preview state
      elements.previewImg.src = resolvedSrc;
      setImageState('preview');
    };
    
    testImg.onerror = (e) => {
      // Actual network error - show error state with reason
      console.error('[SpecialAdModal] Image load failed:', resolvedSrc, e);
      revokeCurrentObjectUrl();
      elements.previewImg.src = '';
      
      // Determine error reason
      let errorReason = 'خطا در بارگذاری تصویر';
      // We can't easily detect 403/404 from img.onerror, but we can provide a generic message
      if (!navigator.onLine) {
        errorReason = 'اتصال اینترنت برقرار نیست';
      }
      
      setImageState('error', errorReason);
    };
    
    // Start loading
    testImg.src = resolvedSrc;
  };

  // Legacy function for backward compatibility
  const updateImagePreview = (imageValue) => {
    loadImage(imageValue, !state.customImage);
  };

  const showImageError = (reason = null) => {
    setImageState('error', reason || 'خطا در بارگذاری تصویر');
  };

  const hideImageError = () => {
    // Only hide error if we're in error state
    if (state.imageState === 'error') {
      setImageState('empty');
    }
  };

  const updateWalletDisplay = () => {
    elements.walletBalance.textContent = `${toFaPrice(state.walletBalance)} تومان`;
    
    // Check if credit can be used (minimum 100 toman)
    const minCredit = 100;
    const canUseCredit = state.walletBalance >= minCredit;
    
    if (!canUseCredit) {
      elements.creditToggle.classList.add('is-disabled');
      elements.creditSwitch.disabled = true;
      elements.creditSwitch.checked = false;
      elements.creditHint.textContent = 'حداقل ۱۰۰ تومان اعتبار برای استفاده نیاز است';
      elements.creditHint.classList.add('is-error');
      state.useCredit = false;
    } else {
      elements.creditToggle.classList.remove('is-disabled');
      elements.creditSwitch.disabled = false;
      elements.creditHint.textContent = 'اعتبار شما برای کسر از هزینه استفاده می‌شود';
      elements.creditHint.classList.remove('is-error');
    }
  };

  const updatePriceBreakdown = () => {
    state.totalPrice = AD_PLAN_PRICES[state.planSlug] || 79000;
    
    // Calculate credit amount (max 50% of total)
    if (state.useCredit && state.walletBalance >= 100) {
      const maxCredit = Math.floor(state.totalPrice * 0.5);
      state.creditAmount = Math.min(state.walletBalance, maxCredit);
    } else {
      state.creditAmount = 0;
    }
    
    state.finalPrice = state.totalPrice - state.creditAmount;
    
    // Update UI
    elements.totalPrice.textContent = `${toFaPrice(state.totalPrice)} تومان`;
    
    if (state.creditAmount > 0) {
      elements.creditRow.style.display = 'flex';
      elements.creditAmount.textContent = `-${toFaPrice(state.creditAmount)} تومان`;
      elements.creditToggle.classList.add('is-active');
    } else {
      elements.creditRow.style.display = 'none';
      elements.creditToggle.classList.remove('is-active');
    }
    
    elements.finalPrice.textContent = `${toFaPrice(state.finalPrice)} تومان`;
  };

  const populateProducts = async () => {
    elements.productSelect.innerHTML = '<option value="">در حال بارگذاری...</option>';
    
    const products = await fetchProducts();
    
    if (!products.length) {
      elements.productSelect.innerHTML = '<option value="">محصولی برای انتخاب نیست</option>';
      return;
    }
    
    elements.productSelect.innerHTML = '<option value="">یک مورد را انتخاب کنید...</option>';
    
    products.forEach(product => {
      const option = document.createElement('option');
      option.value = product._id;
      option.textContent = product.title;
      option.dataset.image = product.image || product.images?.[0] || '';
      elements.productSelect.appendChild(option);
    });
  };

  const setLoading = (loading) => {
    state.isLoading = loading;
    elements.submitBtn.disabled = loading;
    elements.submitBtn.classList.toggle('is-loading', loading);
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
      
      // Clear product selection and image when switching to shop
      if (state.adType === 'shop') {
        state.selectedProductId = null;
        state.selectedProductImage = null;
        // Only reset to empty if no custom image
        if (!state.customImage) {
          setImageState('empty');
        }
      }
    }
  };

  const handleProductChange = (e) => {
    const selectedOption = e.target.selectedOptions[0];
    state.selectedProductId = e.target.value;
    
    // Get the raw image value from the product
    const rawImage = selectedOption?.dataset.image || null;
    
    // Validate and store the product image path
    // Only store if it's a valid server path (not a dataURL or base64)
    if (rawImage && !isDataUrl(rawImage) && !rawImage.includes('base64')) {
      state.selectedProductImage = rawImage;
    } else {
      state.selectedProductImage = null;
      if (rawImage && (isDataUrl(rawImage) || rawImage.includes('base64'))) {
        console.warn('[SpecialAdModal] Product image appears to be a dataURL/base64. This should be a server path.');
      }
    }
    
    // Clear any previous error state immediately when product changes
    // This is critical - we must reset state before attempting to load new image
    if (state.imageState === 'error') {
      setImageState('empty');
    }
    
    // Update image preview with product image (if no custom image)
    // Pass the raw path - loadImage will handle URL construction and state transitions
    if (!state.customImage) {
      if (state.selectedProductImage) {
        loadImage(state.selectedProductImage, true);
      } else {
        // No product image available - show empty state (not error)
        setImageState('empty');
      }
    }
  };

  const handleImageEdit = () => {
    elements.imageInput.click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('لطفاً یک فایل تصویری انتخاب کنید', true);
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('حجم تصویر نباید بیشتر از ۵ مگابایت باشد', true);
      return;
    }
    
    // Store the File object (will be sent via FormData)
    state.customImage = file;
    
    // Use the File object directly - loadImage will create objectURL and manage state
    loadImage(file, false);
  };

  const handleRemoveImage = () => {
    state.customImage = null;
    elements.imageInput.value = '';
    
    // Cleanup object URL if exists
    revokeCurrentObjectUrl();
    
    // If product is selected, load product image, otherwise show empty state
    if (state.selectedProductImage) {
      loadImage(state.selectedProductImage, true);
    } else {
      setImageState('empty');
    }
  };

  const handlePlaceholderClick = () => {
    elements.imageInput.click();
  };

  const handleRetryImage = () => {
    // Set to loading state first
    setImageState('loading');
    
    // Try to reload the current image source
    if (state.customImage) {
      loadImage(state.customImage, false);
    } else if (state.selectedProductImage) {
      loadImage(state.selectedProductImage, true);
    } else {
      // No image to retry - open file picker
      elements.imageInput.click();
    }
  };

  const handleCreditToggle = (e) => {
    state.useCredit = e.target.checked;
    updatePriceBreakdown();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (state.isLoading) return;
    
    // Validation
    if (state.adType === 'product' && !state.selectedProductId) {
      showToast('لطفاً یک محصول انتخاب کنید', true);
      return;
    }
    
    const title = elements.titleInput.value.trim();
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
      formData.append('text', elements.textInput.value.trim());
      formData.append('useCredit', state.useCredit);
      formData.append('creditAmount', state.creditAmount);
      
      if (state.adType === 'product') {
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
      
      // Success
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
      
      // Reset form
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
    if (e.key === 'Escape' && elements.backdrop.classList.contains('is-open')) {
      closeModal();
    }
  };

  // ─────────────────────────────────────────────────────
  // Modal Control
  // ─────────────────────────────────────────────────────
  const openModal = async (planSlug = 'ad_search') => {
    state.planSlug = planSlug;
    
    // Initialize elements if not done
    if (!elements.backdrop) {
      initElements();
      attachEventListeners();
    }
    
    // Reset image state to empty when opening modal
    state.imageState = 'empty';
    state.imageErrorReason = null;
    state.selectedProductId = null;
    state.selectedProductImage = null;
    state.customImage = null;
    revokeCurrentObjectUrl();
    elements.previewImg.src = '';
    renderImageState();
    
    // Fetch data
    await Promise.all([
      fetchAdPrices(),
      populateProducts(),
      (async () => {
        state.walletBalance = await fetchWalletBalance();
        updateWalletDisplay();
      })()
    ]);
    
    // Update price
    updatePriceBreakdown();
    
    // Show modal
    elements.backdrop.classList.add('is-open');
    document.body.classList.add('overflow-hidden', 'no-scroll');
    
    // Focus first input
    setTimeout(() => {
      elements.titleInput.focus();
    }, 300);
  };

  const closeModal = () => {
    if (!elements.backdrop) return;
    
    // Cleanup object URL when closing
    revokeCurrentObjectUrl();
    
    elements.backdrop.classList.remove('is-open');
    document.body.classList.remove('overflow-hidden', 'no-scroll');
  };

  const resetForm = () => {
    // Cleanup object URL before reset
    revokeCurrentObjectUrl();
    
    state = {
      adType: 'product',
      selectedProductId: null,
      selectedProductImage: null,
      customImage: null,
      walletBalance: state.walletBalance,
      useCredit: false,
      planSlug: state.planSlug,
      totalPrice: AD_PLAN_PRICES[state.planSlug],
      creditAmount: 0,
      finalPrice: AD_PLAN_PRICES[state.planSlug],
      isLoading: false,
      imageState: 'empty',
      imageErrorReason: null
    };
    
    elements.form.reset();
    elements.creditSwitch.checked = false;
    elements.imageInput.value = '';
    updateTypeCards();
    updateProductPicker();
    setImageState('empty');
    updatePriceBreakdown();
    updateCharCounter(elements.titleInput, elements.titleCounter, 25);
    updateCharCounter(elements.textInput, elements.textCounter, 30);
  };

  // ─────────────────────────────────────────────────────
  // Toast & Popup Helpers
  // ─────────────────────────────────────────────────────
  const showToast = (message, isError = false) => {
    // Use existing toast system if available
    if (window.UIComponents?.showToast) {
      window.UIComponents.showToast(message, isError ? 'error' : 'success');
      return;
    }
    
    // Fallback toast
    let toast = document.getElementById('special-ad-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'special-ad-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        padding: 14px 24px;
        border-radius: 16px;
        font-size: 0.9rem;
        font-weight: 600;
        z-index: 9999;
        opacity: 0;
        transition: all 0.3s ease;
        max-width: 90%;
        text-align: center;
      `;
      document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.background = isError 
      ? 'linear-gradient(135deg, #fef2f2, #fee2e2)' 
      : 'linear-gradient(135deg, #ecfdf5, #d1fae5)';
    toast.style.color = isError ? '#dc2626' : '#059669';
    toast.style.border = isError 
      ? '1px solid #fecaca' 
      : '1px solid #a7f3d0';
    
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
    // Use existing popup system if available
    if (typeof window.showSuccessPopup === 'function') {
      window.showSuccessPopup(options);
      return;
    }
    
    // Fallback - just show toast
    showToast(options.title);
  };

  // ─────────────────────────────────────────────────────
  // Event Listeners
  // ─────────────────────────────────────────────────────
  const attachEventListeners = () => {
    // Close button
    elements.closeBtn?.addEventListener('click', closeModal);
    
    // Backdrop click
    elements.backdrop?.addEventListener('click', handleBackdropClick);
    
    // Escape key
    document.addEventListener('keydown', handleKeydown);
    
    // Type selection
    elements.typeCards.forEach(card => {
      card.addEventListener('click', handleTypeChange);
    });
    
    // Product selection
    elements.productSelect?.addEventListener('change', handleProductChange);
    
    // Character counters
    elements.titleInput?.addEventListener('input', () => {
      updateCharCounter(elements.titleInput, elements.titleCounter, 25);
    });
    
    elements.textInput?.addEventListener('input', () => {
      updateCharCounter(elements.textInput, elements.textCounter, 30);
    });
    
    // Image actions - New mobile-first approach
    // Primary change button (full-width)
    elements.changeImageBtn?.addEventListener('click', handleImageEdit);
    
    // Overlay change button (on image)
    elements.changeImageOverlay?.addEventListener('click', handleImageEdit);
    
    // Remove image button
    elements.removeImageBtn?.addEventListener('click', handleRemoveImage);
    
    // Clickable placeholder
    elements.imagePlaceholder?.addEventListener('click', handlePlaceholderClick);
    elements.imagePlaceholder?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlePlaceholderClick();
      }
    });
    
    // Retry button for error state
    elements.retryBtn?.addEventListener('click', handleRetryImage);
    
    // Legacy support for old edit button
    elements.editImageBtn?.addEventListener('click', handleImageEdit);
    
    // File input change
    elements.imageInput?.addEventListener('change', handleImageChange);
    
    // Handle image load error - only if we're in loading state
    // This prevents stale errors from showing when state has already changed
    elements.previewImg?.addEventListener('error', () => {
      // Ignore errors when src is empty or same as current page
      const src = elements.previewImg.src;
      if (!src || src === '' || src === window.location.href || src === 'about:blank') {
        return;
      }
      
      // Only show error if we're currently in loading state
      // This prevents race conditions where error fires after state has changed
      if (state.imageState === 'loading') {
        console.warn('[SpecialAdModal] Image error event fired while in loading state:', src);
        // The loadImage function handles errors via testImg, so this is a fallback
        // Don't call showImageError here as loadImage manages state
      }
    });
    
    // Handle successful image load
    elements.previewImg?.addEventListener('load', () => {
      // Ignore load events when src is empty
      const src = elements.previewImg.src;
      if (!src || src === '' || src === window.location.href || src === 'about:blank') {
        return;
      }
      
      // If we're in loading state and image loaded, transition to preview
      // This is a safety net - loadImage should handle this via testImg
      if (state.imageState === 'loading') {
        console.log('[SpecialAdModal] Image load event fired - transitioning to preview');
        setImageState('preview');
      }
    });
    
    // Credit toggle
    elements.creditSwitch?.addEventListener('change', handleCreditToggle);
    
    // Form submit
    elements.form?.addEventListener('submit', handleSubmit);
  };

  // ─────────────────────────────────────────────────────
  // Initialize
  // ─────────────────────────────────────────────────────
  const init = () => {
    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initElements();
        attachEventListeners();
        // Ensure initial state is empty (not error)
        if (elements.imagePreview) {
          elements.imagePreview.classList.remove('has-error', 'has-image', 'is-loading');
        }
        if (elements.imageError) {
          elements.imageError.hidden = true;
        }
      });
    } else {
      initElements();
      attachEventListeners();
      // Ensure initial state is empty (not error)
      if (elements.imagePreview) {
        elements.imagePreview.classList.remove('has-error', 'has-image', 'is-loading');
      }
      if (elements.imageError) {
        elements.imageError.hidden = true;
      }
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

  // Also expose as openSpecialAdModal for convenience
  window.openSpecialAdModal = openModal;

  // Initialize
  init();

})();
