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
  // Utility Functions (must be defined early for validation)
  // ─────────────────────────────────────────────────────
  const toFaDigits = (num) => {
    if (num === null || num === undefined) return '';
    return String(num).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  };

  const toFaPrice = (num) => {
    return toFaDigits((+num || 0).toLocaleString('en-US'));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION & SANITIZATION MODULE
  // Strict form validation with Persian error messages
  // ═══════════════════════════════════════════════════════════════════════════

  // Validation rules
  const VALIDATION_RULES = {
    title: {
      required: true,
      minLength: 3,
      maxLength: 25,
      fieldName: 'عنوان تبلیغ'
    },
    text: {
      required: true,
      minLength: 10,
      maxLength: 30,
      fieldName: 'متن جذاب'
    },
    product: {
      requiredWhen: () => state.adType === 'product',
      fieldName: 'محصول'
    },
    image: {
      required: true,
      fieldName: 'تصویر تبلیغ'
    }
  };

  // Validation error messages (Persian) - Specific and clear
  const VALIDATION_MESSAGES = {
    // Title-specific messages
    titleRequired: 'عنوان تبلیغ الزامی است.',
    titleLength: 'عنوان تبلیغ باید بین ۳ تا ۲۵ کاراکتر باشد.',
    // Text-specific messages
    textRequired: 'متن جذاب الزامی است.',
    textLength: 'متن جذاب باید بین ۱۰ تا ۳۰ کاراکتر باشد.',
    // Product message
    productRequired: 'لطفاً یک محصول انتخاب کنید.',
    // Image message
    imageRequired: 'لطفاً یک تصویر انتخاب کنید یا از تصاویر محصول یکی را برگزینید.',
    // Generic fallbacks
    required: (fieldName) => `${fieldName} الزامی است.`,
    minLength: (fieldName, min) => `${fieldName} باید حداقل ${toFaDigits(min)} کاراکتر باشد.`,
    maxLength: (fieldName, max) => `${fieldName} نباید بیشتر از ${toFaDigits(max)} کاراکتر باشد.`,
    invalidChars: (fieldName) => `${fieldName} شامل کاراکترهای غیرمجاز است.`
  };

  // Track validation state
  let validationErrors = {};

  /**
   * Sanitize text input - strip HTML/script tags, enforce max length
   * @param {string} input - Raw input string
   * @param {number} maxLength - Maximum allowed length
   * @returns {string} - Sanitized string
   */
  const sanitizeText = (input, maxLength = 100) => {
    if (!input || typeof input !== 'string') return '';
    
    // Remove HTML tags
    let sanitized = input.replace(/<[^>]*>/g, '');
    
    // Remove script-like patterns
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    sanitized = sanitized.replace(/data:/gi, '');
    
    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[<>'"&\\]/g, '');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Enforce max length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    return sanitized;
  };

  /**
   * Validate a single field
   * @param {string} fieldId - Field identifier
   * @param {*} value - Field value
   * @returns {string|null} - Error message or null if valid
   */
  const validateField = (fieldId, value) => {
    const rules = VALIDATION_RULES[fieldId];
    if (!rules) return null;

    // Check conditional requirement
    if (rules.requiredWhen && !rules.requiredWhen()) {
      return null;
    }

    // Field-specific validation with clear messages
    switch (fieldId) {
      case 'title': {
        const trimmed = (value || '').trim();
        if (!trimmed) {
          return VALIDATION_MESSAGES.titleRequired;
        }
        if (trimmed.length < rules.minLength || trimmed.length > rules.maxLength) {
          return VALIDATION_MESSAGES.titleLength;
        }
        break;
      }
      
      case 'text': {
        const trimmed = (value || '').trim();
        if (!trimmed) {
          return VALIDATION_MESSAGES.textRequired;
        }
        if (trimmed.length < rules.minLength || trimmed.length > rules.maxLength) {
          return VALIDATION_MESSAGES.textLength;
        }
        break;
      }
      
      case 'product': {
        if (rules.requiredWhen && rules.requiredWhen() && !state.selectedProductId) {
          return VALIDATION_MESSAGES.productRequired;
        }
        break;
      }
      
      case 'image': {
        const hasImage = state.imageState === 'preview' && state.currentImageUrl;
        if (!hasImage) {
          return VALIDATION_MESSAGES.imageRequired;
        }
        break;
      }
    }

    return null;
  };

  /**
   * Validate entire form
   * @returns {Object} - { isValid: boolean, errors: Object, firstInvalidField: string|null }
   */
  const validateForm = () => {
    const errors = {};
    let firstInvalidField = null;

    // Validate title
    const titleValue = elements.titleInput?.value || '';
    const titleError = validateField('title', titleValue);
    if (titleError) {
      errors.title = titleError;
      if (!firstInvalidField) firstInvalidField = 'title';
    }

    // Validate text
    const textValue = elements.textInput?.value || '';
    const textError = validateField('text', textValue);
    if (textError) {
      errors.text = textError;
      if (!firstInvalidField) firstInvalidField = 'text';
    }

    // Validate product (only if product type selected)
    if (state.adType === 'product') {
      const productError = validateField('product', state.selectedProductId);
      if (productError) {
        errors.product = productError;
        if (!firstInvalidField) firstInvalidField = 'product';
      }
    }

    // Validate image
    const imageError = validateField('image', null);
    if (imageError) {
      errors.image = imageError;
      if (!firstInvalidField) firstInvalidField = 'image';
    }

    validationErrors = errors;
    const isValid = Object.keys(errors).length === 0;

    if (isDev) {
      console.log('[Validation]', isValid ? 'VALID' : 'INVALID', errors);
    }

    return { isValid, errors, firstInvalidField };
  };

  /**
   * Show validation error on a field with shake animation
   * @param {string} fieldId - Field identifier
   * @param {string} message - Error message
   */
  const showFieldError = (fieldId, message) => {
    if (isDev) console.log('[Validation] showFieldError:', fieldId, message);
    
    let inputElement, formGroup;

    switch (fieldId) {
      case 'title':
        inputElement = elements.titleInput;
        formGroup = inputElement?.closest('.special-ad-form-group');
        break;
      case 'text':
        inputElement = elements.textInput;
        formGroup = inputElement?.closest('.special-ad-form-group');
        break;
      case 'product':
        inputElement = elements.dropdown;
        formGroup = elements.productPicker;
        break;
      case 'image':
        inputElement = elements.imagePreview;
        formGroup = inputElement?.closest('.special-ad-image-section');
        break;
    }

    if (inputElement) {
      inputElement.classList.add('is-invalid');
      inputElement.setAttribute('aria-invalid', 'true');
      
      // Trigger shake animation by removing and re-adding class
      inputElement.classList.remove('is-invalid');
      // Force reflow to restart animation
      void inputElement.offsetWidth;
      inputElement.classList.add('is-invalid');
    }

    if (formGroup) {
      formGroup.classList.add('has-error');
      
      // Find or create error message element
      let errorEl = formGroup.querySelector('.special-ad-field-error');
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'special-ad-field-error';
        errorEl.setAttribute('role', 'alert');
        errorEl.setAttribute('aria-live', 'polite');
        formGroup.appendChild(errorEl);
      }
      errorEl.textContent = message;
      errorEl.hidden = false;
      errorEl.style.display = 'flex';
    }
  };

  /**
   * Clear validation error from a field
   * @param {string} fieldId - Field identifier
   */
  const clearFieldError = (fieldId) => {
    let inputElement, formGroup;

    switch (fieldId) {
      case 'title':
        inputElement = elements.titleInput;
        formGroup = inputElement?.closest('.special-ad-form-group');
        break;
      case 'text':
        inputElement = elements.textInput;
        formGroup = inputElement?.closest('.special-ad-form-group');
        break;
      case 'product':
        inputElement = elements.dropdown;
        formGroup = elements.productPicker;
        break;
      case 'image':
        inputElement = elements.imagePreview;
        formGroup = inputElement?.closest('.special-ad-image-section');
        break;
    }

    if (inputElement) {
      inputElement.classList.remove('is-invalid');
      inputElement.removeAttribute('aria-invalid');
    }

    if (formGroup) {
      formGroup.classList.remove('has-error');
      const errorEl = formGroup.querySelector('.special-ad-field-error');
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.style.display = 'none';
        errorEl.textContent = '';
      }
    }

    // Remove from validation errors
    delete validationErrors[fieldId];
  };

  /**
   * Clear all validation errors
   */
  const clearAllErrors = () => {
    ['title', 'text', 'product', 'image'].forEach(clearFieldError);
    validationErrors = {};
    hideTopAlert();
  };

  /**
   * Show top alert banner
   * @param {string} message - Alert message
   */
  const showTopAlert = (message) => {
    if (isDev) console.log('[Validation] showTopAlert:', message);
    
    let alertEl = document.getElementById('specialAdTopAlert');
    
    if (!alertEl) {
      alertEl = document.createElement('div');
      alertEl.id = 'specialAdTopAlert';
      alertEl.className = 'special-ad-top-alert';
      alertEl.setAttribute('role', 'alert');
      alertEl.setAttribute('aria-live', 'polite');
      alertEl.innerHTML = `
        <svg class="special-ad-top-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4m0 4h.01"/>
        </svg>
        <span class="special-ad-top-alert__text"></span>
        <button type="button" class="special-ad-top-alert__close" aria-label="بستن">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      `;
      
      // Insert at the beginning of the body (inside modal)
      const modalBody = elements.backdrop?.querySelector('.special-ad-body');
      if (modalBody) {
        modalBody.insertBefore(alertEl, modalBody.firstChild);
      } else {
        // Fallback: insert after header
        const header = elements.backdrop?.querySelector('.special-ad-header');
        if (header) {
          header.after(alertEl);
        }
      }
      
      // Close button handler
      alertEl.querySelector('.special-ad-top-alert__close')?.addEventListener('click', hideTopAlert);
    }
    
    alertEl.querySelector('.special-ad-top-alert__text').textContent = message;
    alertEl.classList.add('is-visible');
    alertEl.hidden = false;
    alertEl.style.display = 'flex';
    
    // Ensure alert is visible by scrolling modal body to top briefly
    const modalBody = elements.backdrop?.querySelector('.special-ad-body');
    if (modalBody && modalBody.scrollTop > 50) {
      // Don't scroll to top - let scrollToField handle positioning
      // Just ensure the alert animates in nicely
    }
  };

  /**
   * Hide top alert banner
   */
  const hideTopAlert = () => {
    const alertEl = document.getElementById('specialAdTopAlert');
    if (alertEl) {
      alertEl.classList.remove('is-visible');
      alertEl.hidden = true;
      alertEl.style.display = 'none';
    }
  };

  /**
   * Scroll to first invalid field with mobile-friendly positioning
   * Ensures field is visible above the CTA button and keyboard
   * @param {string} fieldId - Field identifier
   * @param {boolean} shouldFocus - Whether to focus the element after scrolling
   */
  const scrollToField = (fieldId, shouldFocus = true) => {
    let targetElement, formGroup;

    switch (fieldId) {
      case 'title':
        targetElement = elements.titleInput;
        formGroup = targetElement?.closest('.special-ad-form-group');
        break;
      case 'text':
        targetElement = elements.textInput;
        formGroup = targetElement?.closest('.special-ad-form-group');
        break;
      case 'product':
        targetElement = elements.dropdownTrigger || elements.dropdown;
        formGroup = elements.productPicker;
        break;
      case 'image':
        targetElement = elements.imagePreview;
        formGroup = targetElement?.closest('.special-ad-image-section');
        break;
    }

    const scrollTarget = formGroup || targetElement;
    if (!scrollTarget) return;

    const modalBody = elements.backdrop?.querySelector('.special-ad-body');
    if (modalBody) {
      // Calculate scroll position to show field at top with padding
      // Account for footer CTA height (~80px) and some breathing room
      const targetRect = scrollTarget.getBoundingClientRect();
      const bodyRect = modalBody.getBoundingClientRect();
      const footerHeight = 100; // CTA button area
      const topPadding = 20; // Space from top
      
      // Calculate ideal scroll position
      const scrollTop = modalBody.scrollTop + (targetRect.top - bodyRect.top) - topPadding;
      
      // Smooth scroll to position
      modalBody.scrollTo({ 
        top: Math.max(0, scrollTop), 
        behavior: 'smooth' 
      });
      
      // Focus the element after scroll completes (for keyboard accessibility)
      if (shouldFocus && targetElement && targetElement.focus && fieldId !== 'image') {
        setTimeout(() => {
          targetElement.focus({ preventScroll: true });
        }, 350);
      }
    } else {
      // Fallback for non-modal context
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (shouldFocus && targetElement && targetElement.focus && fieldId !== 'image') {
        setTimeout(() => targetElement.focus(), 350);
      }
    }
  };

  /**
   * Display all validation errors
   * @param {Object} errors - Validation errors object
   * @param {string} firstInvalidField - First invalid field ID
   */
  const displayValidationErrors = (errors, firstInvalidField) => {
    if (isDev) console.log('[Validation] displayValidationErrors:', errors, firstInvalidField);
    
    // Show compact top summary alert
    showTopAlert('لطفاً موارد زیر را اصلاح کنید');

    // Show individual field errors with shake animation
    Object.entries(errors).forEach(([fieldId, message]) => {
      showFieldError(fieldId, message);
    });

    // Scroll to first invalid field and focus it
    if (firstInvalidField) {
      // Small delay to ensure DOM updates are complete
      setTimeout(() => scrollToField(firstInvalidField, true), 150);
    }
  };

  /**
   * Real-time validation on input
   * @param {string} fieldId - Field identifier
   * @param {*} value - Current value
   */
  const validateFieldRealtime = (fieldId, value) => {
    // Only validate if field was previously invalid or has enough content
    if (validationErrors[fieldId]) {
      const error = validateField(fieldId, value);
      if (error) {
        showFieldError(fieldId, error);
      } else {
        clearFieldError(fieldId);
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // END VALIDATION MODULE
  // ═══════════════════════════════════════════════════════════════════════════

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
    imageLoadAbortController: null,
    // Product image gallery
    productImageGallery: [],
    productImageIndex: 0,
    productImageRequestId: 0,
    imageRetryHintTimer: null,
    // Products list for dropdown filtering
    productsList: []
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
      // Custom dropdown elements
      dropdown: document.getElementById('specialAdDropdown'),
      dropdownTrigger: document.getElementById('specialAdDropdownTrigger'),
      dropdownValue: document.getElementById('specialAdDropdownValue'),
      dropdownPanel: document.getElementById('specialAdDropdownPanel'),
      dropdownList: document.getElementById('specialAdDropdownList'),
      dropdownSearch: document.getElementById('specialAdDropdownSearch'),
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
      imagePrevBtn: document.getElementById('specialAdImagePrev'),
      imageNextBtn: document.getElementById('specialAdImageNext'),
      imageIndicator: document.getElementById('specialAdImageIndicator'),
      imageRetryHint: document.getElementById('specialAdImageRetryHint'),
      imageBadge: document.getElementById('specialAdImageBadge'),
      imageError: document.getElementById('specialAdImageError'),
      retryBtn: document.getElementById('specialAdRetryBtn'),
      imageStatus: document.getElementById('specialAdImageStatus'),
      imageFinalHint: document.getElementById('specialAdImageFinalHint'),
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

  const fetchProductGallery = async (productId) => {
    if (!productId) return [];
    try {
      const res = await fetch(`${API_BASE}/products/${productId}`, withCreds());
      if (!res.ok) return [];
      const data = await res.json();
      const payload = data?.data || data;
      return extractProductGallery(payload);
    } catch (err) {
      console.error('fetchProductGallery error:', err);
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
      // Note: Don't set required on hidden native select - custom validation handles this
      // Setting required on hidden/aria-hidden elements causes browser error:
      // "An invalid form control with name='' is not focusable"
    } else {
      elements.productPicker.style.display = 'none';
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
   * Extract product image gallery URLs
   */
  const extractProductGallery = (product) => {
    if (!product) return [];
    const gallery = [];
    const possibleFields = ['images', 'gallery', 'photos', 'image', 'img', 'photo', 'thumbnail', 'mainImage', 'primaryImageUrl'];

    possibleFields.forEach(field => {
      const value = product[field];
      if (!value) return;

      if (typeof value === 'string' && value.trim()) {
        gallery.push(value.trim());
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(entry => {
          if (typeof entry === 'string' && entry.trim()) {
            gallery.push(entry.trim());
          } else if (entry && typeof entry === 'object') {
            const url = entry.url || entry.src || entry.path || entry.image || entry.filename;
            if (url && typeof url === 'string') gallery.push(url.trim());
          }
        });
        return;
      }

      if (typeof value === 'object') {
        const url = value.url || value.src || value.path;
        if (url && typeof url === 'string') gallery.push(url.trim());
      }
    });

    return gallery.filter(Boolean);
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
    
    // Clear image validation error when image is successfully loaded
    if (newState === 'preview' && state.currentImageUrl) {
      clearFieldError('image');
    }
    
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

    updateGalleryControls();
  };

  const updateGalleryIndicator = () => {
    if (!elements.imageIndicator) return;
    if (state.productImageGallery.length > 1) {
      elements.imageIndicator.textContent = `${toFaDigits(state.productImageIndex + 1)}/${toFaDigits(state.productImageGallery.length)}`;
    } else {
      elements.imageIndicator.textContent = '';
    }
  };

  const updateGalleryControls = () => {
    if (!elements.imagePreview) return;
    const shouldShow = !state.customImage && state.productImageGallery.length > 1 && state.imageState === 'preview';
    elements.imagePreview.classList.toggle('has-gallery', shouldShow);
    updateGalleryIndicator();
    updateImageFinalHint();
  };

  const updateImageFinalHint = () => {
    if (!elements.imageFinalHint) return;
    const shouldShow = state.productImageGallery.length > 1 && !state.customImage && state.imageState === 'preview';
    elements.imageFinalHint.hidden = !shouldShow;
  };

  const showRetryHint = (message) => {
    if (!elements.imageRetryHint) return;
    if (state.imageRetryHintTimer) {
      clearTimeout(state.imageRetryHintTimer);
      state.imageRetryHintTimer = null;
    }
    elements.imageRetryHint.textContent = message;
    elements.imageRetryHint.hidden = false;
    elements.imageRetryHint.classList.add('is-visible');
    state.imageRetryHintTimer = setTimeout(() => {
      elements.imageRetryHint.classList.remove('is-visible');
      elements.imageRetryHint.hidden = true;
    }, 3200);
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

  const setProductGallery = (images, { shouldLoad = true } = {}) => {
    state.productImageGallery = Array.isArray(images) ? images.filter(Boolean) : [];
    state.productImageIndex = 0;
    updateGalleryIndicator();
    if (!state.customImage && shouldLoad) {
      loadGalleryImage(0);
    } else {
      updateGalleryControls();
    }
  };

  const loadGalleryImage = async (index, attempts = 0) => {
    const gallery = state.productImageGallery;
    if (!gallery.length) {
      state.selectedProductImage = null;
      setAdImageState('empty');
      return;
    }

    const normalizedIndex = ((index % gallery.length) + gallery.length) % gallery.length;
    state.productImageIndex = normalizedIndex;
    state.selectedProductImage = gallery[normalizedIndex];
    updateGalleryIndicator();

    const absoluteUrl = buildImageUrl(state.selectedProductImage);
    if (!absoluteUrl) {
      if (attempts < gallery.length - 1) {
        showRetryHint('بارگذاری تصویر ناموفق بود؛ تصویر بعدی نمایش داده شد');
        return loadGalleryImage(normalizedIndex + 1, attempts + 1);
      }
      setAdImageState('error', 'خطا در نمایش تصویر');
      return;
    }

    setAdImageState('loading');

    try {
      await preloadImage(absoluteUrl);
      state.currentImageUrl = absoluteUrl;
      state.customImage = null;
      setAdImageState('preview');
      if (isDev) console.log('[AdImage] Gallery image loaded successfully');
    } catch (err) {
      console.error('[AdImage] Gallery preload failed:', err.message);
      if (attempts < gallery.length - 1) {
        showRetryHint('تصویر بارگذاری نشد؛ به تصویر بعدی می‌رویم');
        return loadGalleryImage(normalizedIndex + 1, attempts + 1);
      }
      let errorReason = 'خطا در بارگذاری تصویر';
      if (!navigator.onLine) errorReason = 'اتصال اینترنت برقرار نیست';
      else if (err.message.includes('timeout')) errorReason = 'زمان بارگذاری به پایان رسید';
      setAdImageState('error', errorReason);
    }
  };

  /**
   * Handle product selection - auto-load product image
   */
  const onProductSelected = async (productId, productImagePath) => {
    if (isDev) console.log(`[AdImage] Product selected: ${productId}, hasImage: ${!!productImagePath}`);
    
    state.selectedProductId = productId;
    state.selectedProductImage = productImagePath;
    const requestId = ++state.productImageRequestId;
    
    // Clear product validation error when product is selected
    if (productId) {
      clearFieldError('product');
    }
    
    // If user has custom image, don't override
    if (state.customImage) {
      if (isDev) console.log('[AdImage] Custom image exists, keeping it');
      if (!productId) {
        setProductGallery([]);
      }
      return;
    }
    
    if (!productId) {
      setProductGallery([]);
      setAdImageState('empty');
      return;
    }

    const fallbackGallery = productImagePath ? [productImagePath] : [];
    if (fallbackGallery.length) {
      setProductGallery(fallbackGallery);
    } else {
      setAdImageState('loading');
    }

    const galleryImages = await fetchProductGallery(productId);
    if (requestId !== state.productImageRequestId) return;

    if (galleryImages.length) {
      setProductGallery(galleryImages);
    } else if (!fallbackGallery.length) {
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
    } else if (state.productImageGallery.length) {
      loadGalleryImage(state.productImageIndex);
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
    if (state.productImageGallery.length) {
      loadGalleryImage(state.productImageIndex);
    } else if (state.selectedProductImage) {
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
    
    // Credit row - shown as payment method (not discount)
    if (state.creditAmount > 0) {
      if (elements.creditRow) {
        elements.creditRow.style.display = 'flex';
        // Update label to show it's a payment method with 50% limit
        const creditLabel = elements.creditRow.querySelector('.special-ad-price-row__label');
        if (creditLabel) {
          creditLabel.textContent = 'پرداخت با اعتبار (تا ۵۰٪)';
        }
      }
      if (elements.creditAmount) {
        // Remove negative sign and discount styling
        elements.creditAmount.textContent = `${toFaPrice(state.creditAmount)} تومان`;
        elements.creditAmount.classList.remove('is-discount');
      }
      elements.creditToggle?.classList.add('is-active');
    } else {
      if (elements.creditRow) elements.creditRow.style.display = 'none';
      elements.creditToggle?.classList.remove('is-active');
    }
    
    // Cash row - always shown with clear label
    if (elements.cashRow) {
      elements.cashRow.style.display = 'flex';
      const cashLabel = elements.cashRow.querySelector('.special-ad-price-row__label');
      if (cashLabel) {
        cashLabel.textContent = 'پرداخت نقدی';
      }
    }
    if (elements.cashAmount) {
      elements.cashAmount.textContent = `${toFaPrice(cashAmount)} تومان`;
    }
    
    // Final price - strong emphasis
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
      // Calculate and set max credit (50% of order total)
      state.maxCredit = calculateMaxCredit();
      
      // Update max display with helper text
      if (elements.maxCreditDisplay) {
        elements.maxCreditDisplay.textContent = `${toFaPrice(state.maxCredit)} تومان`;
      }
      
      // Update helper text to show 50% limit
      const allocationHeader = elements.creditAllocation.querySelector('.special-ad-credit-allocation__header');
      if (allocationHeader) {
        const existingHelper = allocationHeader.querySelector('.credit-limit-helper');
        if (!existingHelper) {
          const helperText = document.createElement('p');
          helperText.className = 'credit-limit-helper';
          helperText.style.cssText = 'font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; text-align: center;';
          helperText.textContent = `سقف مجاز اعتبار برای این سفارش: ${toFaPrice(state.maxCredit)} تومان`;
          allocationHeader.appendChild(helperText);
        } else {
          existingHelper.textContent = `سقف مجاز اعتبار برای این سفارش: ${toFaPrice(state.maxCredit)} تومان`;
        }
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

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOM DROPDOWN MODULE - Premium Product Selector
  // Mobile-First, RTL-Ready, Accessible
  // ═══════════════════════════════════════════════════════════════════════════

  let dropdownState = {
    isOpen: false,
    focusedIndex: -1,
    filteredItems: []
  };

  /**
   * Open the custom dropdown
   */
  const openDropdown = () => {
    if (!elements.dropdown || dropdownState.isOpen) return;
    
    dropdownState.isOpen = true;
    elements.dropdown.classList.add('is-open');
    elements.dropdown.setAttribute('aria-expanded', 'true');
    
    // Reset search
    if (elements.dropdownSearch) {
      elements.dropdownSearch.value = '';
      filterDropdownItems('');
    }
    
    // Focus search input
    setTimeout(() => {
      elements.dropdownSearch?.focus();
    }, 100);
    
    // Add click outside listener
    document.addEventListener('click', handleDropdownClickOutside);
    document.addEventListener('keydown', handleDropdownKeydown);
  };

  /**
   * Close the custom dropdown
   */
  const closeDropdown = () => {
    if (!elements.dropdown || !dropdownState.isOpen) return;
    
    dropdownState.isOpen = false;
    dropdownState.focusedIndex = -1;
    elements.dropdown.classList.remove('is-open');
    elements.dropdown.setAttribute('aria-expanded', 'false');
    
    // Clear focus states
    const items = elements.dropdownList?.querySelectorAll('.sam-dropdown__item');
    items?.forEach(item => item.classList.remove('is-focused'));
    
    // Remove listeners
    document.removeEventListener('click', handleDropdownClickOutside);
    document.removeEventListener('keydown', handleDropdownKeydown);
    
    // Return focus to trigger
    elements.dropdownTrigger?.focus();
  };

  /**
   * Toggle dropdown open/close
   */
  const toggleDropdown = () => {
    if (dropdownState.isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };

  /**
   * Filter dropdown items based on search query
   */
  const filterDropdownItems = (query) => {
    const items = elements.dropdownList?.querySelectorAll('.sam-dropdown__item');
    if (!items) return;
    
    const normalizedQuery = query.trim().toLowerCase();
    let visibleCount = 0;
    
    items.forEach(item => {
      const title = (item.dataset.title || '').toLowerCase();
      const category = (item.dataset.category || '').toLowerCase();
      
      const matches = !normalizedQuery || 
        title.includes(normalizedQuery) || 
        category.includes(normalizedQuery);
      
      item.style.display = matches ? '' : 'none';
      if (matches) visibleCount++;
    });
    
    // Show/hide no results message
    let noResults = elements.dropdownList?.querySelector('.sam-dropdown__no-results');
    if (visibleCount === 0 && normalizedQuery) {
      if (!noResults) {
        noResults = document.createElement('li');
        noResults.className = 'sam-dropdown__no-results';
        noResults.innerHTML = `
          <svg class="sam-dropdown__no-results-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
            <path d="M8 11h6"/>
          </svg>
          <p class="sam-dropdown__no-results-text">نتیجه‌ای یافت نشد</p>
        `;
        elements.dropdownList.appendChild(noResults);
      }
      noResults.style.display = '';
    } else if (noResults) {
      noResults.style.display = 'none';
    }
    
    // Reset focus index
    dropdownState.focusedIndex = -1;
  };

  /**
   * Select a dropdown item
   */
  const selectDropdownItem = (item) => {
    if (!item || item.classList.contains('is-disabled')) return;
    
    const value = item.dataset.value;
    const title = item.dataset.title;
    const image = item.dataset.image;
    
    // Update native select
    if (elements.productSelect) {
      elements.productSelect.value = value;
      // Trigger change event for existing handlers
      elements.productSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Update custom dropdown display
    if (elements.dropdownValue) {
      elements.dropdownValue.textContent = title;
      elements.dropdownValue.classList.remove('is-placeholder');
    }
    
    // Update selected state
    const items = elements.dropdownList?.querySelectorAll('.sam-dropdown__item');
    items?.forEach(i => {
      const isSelected = i.dataset.value === value;
      i.classList.toggle('is-selected', isSelected);
      i.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
    
    // Close dropdown
    closeDropdown();
    
    // Trigger product selection handler
    onProductSelected(value, image);
  };

  /**
   * Handle click outside dropdown
   */
  const handleDropdownClickOutside = (e) => {
    if (!elements.dropdown?.contains(e.target)) {
      closeDropdown();
    }
  };

  /**
   * Handle keyboard navigation in dropdown
   */
  const handleDropdownKeydown = (e) => {
    if (!dropdownState.isOpen) return;
    
    const items = Array.from(elements.dropdownList?.querySelectorAll('.sam-dropdown__item:not([style*="display: none"])') || []);
    if (!items.length) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        dropdownState.focusedIndex = Math.min(dropdownState.focusedIndex + 1, items.length - 1);
        updateDropdownFocus(items);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        dropdownState.focusedIndex = Math.max(dropdownState.focusedIndex - 1, 0);
        updateDropdownFocus(items);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (dropdownState.focusedIndex >= 0 && items[dropdownState.focusedIndex]) {
          selectDropdownItem(items[dropdownState.focusedIndex]);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        break;
        
      case 'Tab':
        closeDropdown();
        break;
    }
  };

  /**
   * Update focus state for keyboard navigation
   */
  const updateDropdownFocus = (items) => {
    items.forEach((item, index) => {
      const isFocused = index === dropdownState.focusedIndex;
      item.classList.toggle('is-focused', isFocused);
      if (isFocused) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  };

  /**
   * Handle dropdown trigger click
   */
  const handleDropdownTriggerClick = (e) => {
    e.preventDefault();
    toggleDropdown();
  };

  /**
   * Handle dropdown item click
   */
  const handleDropdownItemClick = (e) => {
    const item = e.target.closest('.sam-dropdown__item');
    if (item) {
      selectDropdownItem(item);
    }
  };

  /**
   * Handle search input
   */
  const handleDropdownSearch = (e) => {
    filterDropdownItems(e.target.value);
  };

  /**
   * Reset dropdown to initial state
   */
  const resetDropdown = () => {
    if (elements.dropdownValue) {
      elements.dropdownValue.textContent = 'یک مورد را انتخاب کنید...';
      elements.dropdownValue.classList.add('is-placeholder');
    }
    
    const items = elements.dropdownList?.querySelectorAll('.sam-dropdown__item');
    items?.forEach(item => {
      item.classList.remove('is-selected', 'is-focused');
      item.setAttribute('aria-selected', 'false');
      item.style.display = '';
    });
    
    if (elements.dropdownSearch) {
      elements.dropdownSearch.value = '';
    }
    
    dropdownState.focusedIndex = -1;
    closeDropdown();
  };

  /**
   * Attach dropdown event listeners
   */
  const attachDropdownListeners = () => {
    elements.dropdownTrigger?.addEventListener('click', handleDropdownTriggerClick);
    elements.dropdownList?.addEventListener('click', handleDropdownItemClick);
    elements.dropdownSearch?.addEventListener('input', handleDropdownSearch);
    
    // Prevent form submission on Enter in search
    elements.dropdownSearch?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // END CUSTOM DROPDOWN MODULE
  // ═══════════════════════════════════════════════════════════════════════════

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
        elements.creditHint.textContent = 'اعتبار شما به عنوان روش پرداخت استفاده می‌شود (حداکثر ۵۰٪ از مبلغ سفارش)';
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
    
    // Show loading state in custom dropdown
    if (elements.dropdownList) {
      elements.dropdownList.innerHTML = `
        <li class="sam-dropdown__loading">
          <span class="sam-dropdown__loading-spinner"></span>
          <span>در حال بارگذاری...</span>
        </li>
      `;
    }
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
      if (elements.dropdownList) {
        elements.dropdownList.innerHTML = `
          <li class="sam-dropdown__empty">محصولی برای انتخاب نیست</li>
        `;
      }
      if (elements.dropdownValue) {
        elements.dropdownValue.textContent = 'محصولی برای انتخاب نیست';
        elements.dropdownValue.classList.add('is-placeholder');
      }
      return;
    }
    
    elements.productSelect.innerHTML = '<option value="">یک مورد را انتخاب کنید...</option>';
    
    // Build custom dropdown items
    let dropdownHTML = '';
    
    productList.forEach(product => {
      const productId = product._id || product.id;
      const productTitle = product.title || product.name || 'بدون نام';
      const productImage = extractProductImage(product);
      const productCategory = product.category || product.categoryName || '';
      const productPrice = product.price ? toFaPrice(product.price) + ' تومان' : '';
      const subtitle = productCategory || productPrice;
      
      // Native select option
      const option = document.createElement('option');
      option.value = productId;
      option.textContent = productTitle;
      option.dataset.image = productImage || '';
      option.dataset.category = productCategory;
      option.dataset.price = product.price || '';
      elements.productSelect.appendChild(option);
      
      // Custom dropdown item
      const thumbHTML = productImage 
        ? `<img class="sam-dropdown__item-thumb" src="${buildImageUrl(productImage)}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : '';
      
      const subtitleHTML = subtitle 
        ? `<span class="sam-dropdown__item-subtitle">${subtitle}</span>` 
        : '';
      
      dropdownHTML += `
        <li class="sam-dropdown__item" 
            role="option" 
            tabindex="-1"
            data-value="${productId}" 
            data-image="${productImage || ''}"
            data-title="${productTitle}"
            data-category="${productCategory}"
            data-price="${product.price || ''}"
            aria-selected="false">
          ${thumbHTML}
          <div class="sam-dropdown__item-content">
            <span class="sam-dropdown__item-title">${productTitle}</span>
            ${subtitleHTML}
          </div>
          <svg class="sam-dropdown__item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </li>
      `;
    });
    
    if (elements.dropdownList) {
      elements.dropdownList.innerHTML = dropdownHTML;
    }
    
    // Store products for search filtering
    state.productsList = productList;
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
        state.productImageGallery = [];
        state.productImageIndex = 0;
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

  const handleGalleryPrev = () => {
    if (state.customImage || state.productImageGallery.length < 2) return;
    loadGalleryImage(state.productImageIndex - 1);
  };

  const handleGalleryNext = () => {
    if (state.customImage || state.productImageGallery.length < 2) return;
    loadGalleryImage(state.productImageIndex + 1);
  };

  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;

  const handleImageTouchStart = (e) => {
    if (state.customImage || state.productImageGallery.length < 2) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchActive = true;
  };

  const handleImageTouchEnd = (e) => {
    if (!touchActive) return;
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    touchActive = false;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        handleGalleryNext();
      } else {
        handleGalleryPrev();
      }
    }
  };

  const handleCreditToggle = (e) => {
    state.useCredit = e.target.checked;
    toggleCreditAllocation(state.useCredit);
    updatePriceBreakdown();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (state.isLoading) return;
    
    // Clear previous errors
    clearAllErrors();
    
    // Run validation
    const { isValid, errors, firstInvalidField } = validateForm();
    
    if (!isValid) {
      // Display all errors
      displayValidationErrors(errors, firstInvalidField);
      return;
    }
    
    // Sanitize inputs before submission
    const sanitizedTitle = sanitizeText(elements.titleInput?.value || '', 25);
    const sanitizedText = sanitizeText(elements.textInput?.value || '', 30);
    
    // Double-check sanitized values meet requirements
    if (sanitizedTitle.length < 3) {
      showFieldError('title', VALIDATION_MESSAGES.titleLength);
      showTopAlert('لطفاً موارد زیر را اصلاح کنید');
      scrollToField('title', true);
      return;
    }
    
    if (sanitizedText.length < 10) {
      showFieldError('text', VALIDATION_MESSAGES.textLength);
      showTopAlert('لطفاً موارد زیر را اصلاح کنید');
      scrollToField('text', true);
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
      formData.append('title', sanitizedTitle);
      formData.append('text', sanitizedText);
      formData.append('useCredit', state.useCredit);
      formData.append('creditAmount', state.creditAmount);
      
      if (state.adType === 'product' && state.selectedProductId) {
        formData.append('productId', state.selectedProductId);
      }
      
      if (state.customImage) {
        formData.append('image', state.customImage);
      } else if (state.currentImageUrl && !state.currentImageUrl.startsWith('blob:')) {
        // Send the selected product image URL
        formData.append('selectedImageUrl', state.currentImageUrl);
      }
      
      const res = await fetch(`${API_BASE}/adOrder`, withCreds({
        method: 'POST',
        body: formData
      }));
      
      const result = await res.json();
      
      if (!res.ok || !result.success) {
        // Handle validation errors from backend
        if (result.validationErrors) {
          Object.entries(result.validationErrors).forEach(([field, message]) => {
            showFieldError(field, message);
          });
          showTopAlert(result.message || 'لطفاً خطاهای فرم را برطرف کنید');
        } else {
          showToast(result.message || 'ثبت تبلیغ ناموفق بود', true);
        }
        setLoading(false);
        return;
      }
      
      // Extract scheduling info from response
      const scheduling = result.adOrder?.scheduling || {};
      const scheduledStartDate = scheduling.scheduled_start_date 
        ? new Date(scheduling.scheduled_start_date).toLocaleDateString('fa-IR')
        : null;
      const scheduledEndDate = scheduling.scheduled_end_date
        ? new Date(scheduling.scheduled_end_date).toLocaleDateString('fa-IR')
        : null;
      const daysUntilStart = scheduling.days_until_start || 0;
      const isToday = scheduling.is_today || daysUntilStart === 0;
      
      // Build scheduling details for success popup
      const scheduleDetails = [];
      if (scheduledStartDate) {
        if (isToday) {
          scheduleDetails.push(`تاریخ شروع رزرو: امروز (${scheduledStartDate})`);
        } else {
          scheduleDetails.push(`تاریخ شروع رزرو: ${toFaDigits(daysUntilStart)} روز دیگر (${scheduledStartDate})`);
        }
      }
      if (scheduledEndDate) {
        scheduleDetails.push(`پایان: پایان روز ${scheduledEndDate}`);
      }
      
      closeModal();
      showSuccessPopup({
        title: 'تبلیغ شما با موفقیت ثبت شد',
        message: `تبلیغ «${sanitizedTitle}» ثبت شد و پس از تایید ادمین نمایش داده خواهد شد.`,
        details: [
          `پلن انتخابی: ${AD_PLAN_TITLES[state.planSlug]}`,
          ...scheduleDetails,
          state.creditAmount > 0 ? `کسر از اعتبار: ${toFaPrice(state.creditAmount)} تومان` : '',
          `مبلغ پرداختی: ${toFaPrice(state.finalPrice)} تومان`
        ].filter(Boolean),
        highlight: isToday ? 'ثبت تبلیغ جدید' : `شروع: ${toFaDigits(daysUntilStart)} روز دیگر`
      });
      
      resetForm();
      
      // Refresh slot availability after successful submission
      if (typeof fetchSlotAvailability === 'function') {
        fetchSlotAvailability();
      }
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
    state.productImageGallery = [];
    state.productImageIndex = 0;
    state.productImageRequestId = 0;
    state.productImageRequestId = 0;
    state.imageState = 'empty';
    state.imageErrorReason = null;
    state.currentImageUrl = null;
    revokeCurrentObjectUrl();

    if (state.imageRetryHintTimer) {
      clearTimeout(state.imageRetryHintTimer);
      state.imageRetryHintTimer = null;
    }
    if (elements.imageRetryHint) {
      elements.imageRetryHint.hidden = true;
      elements.imageRetryHint.classList.remove('is-visible');
    }
    
    // Render empty state
    renderAdImageUI();
    
    // Fetch data
    await Promise.all([
      fetchAdPrices(),
      populateProducts(),
      (async () => {
        state.walletBalance = await fetchWalletBalance();
        updateWalletDisplay();
      })(),
      updateSchedulePreview(planSlug)
    ]);
    
    updatePriceBreakdown();
    
    elements.backdrop?.classList.add('is-open');
    document.body.classList.add('overflow-hidden', 'no-scroll');
    
    setTimeout(() => elements.titleInput?.focus(), 300);
  };

  // Update schedule preview based on slot availability
  const updateSchedulePreview = async (planSlug) => {
    try {
      const res = await fetch(`${API_BASE}/adOrder/slots/availability`, withCreds());
      if (!res.ok) return;
      
      const json = await res.json();
      if (!json.success || !json.slots) return;
      
      const slotInfo = json.slots[planSlug];
      if (!slotInfo) return;
      
      // Update booked count
      const bookedEl = document.querySelector('#specialAdScheduleBooked [data-booked-value]');
      if (bookedEl) {
        bookedEl.textContent = `${toFaDigits(slotInfo.booked_today_count)}/۳`;
      }
      
      // Update schedule start text
      const scheduleRow = document.getElementById('specialAdScheduleStart');
      const scheduleText = scheduleRow?.querySelector('.special-ad-schedule-preview__start-text');
      if (scheduleText) {
        if (slotInfo.days_until_next_available === 0) {
          scheduleText.textContent = 'شروع: امروز (فعال تا پایان روز)';
          scheduleRow.classList.remove('is-future');
        } else {
          const nextDate = new Date(slotInfo.next_available_date);
          const dateStr = nextDate.toLocaleDateString('fa-IR');
          scheduleText.textContent = `شروع: ${toFaDigits(slotInfo.days_until_next_available)} روز دیگر (${dateStr})`;
          scheduleRow.classList.add('is-future');
        }
      }
    } catch (err) {
      if (isDev) console.error('updateSchedulePreview error:', err);
    }
  };

  const closeModal = () => {
    if (!elements.backdrop) return;
    revokeCurrentObjectUrl();
    elements.backdrop.classList.remove('is-open');
    document.body.classList.remove('overflow-hidden', 'no-scroll');
  };

  const resetForm = () => {
    revokeCurrentObjectUrl();
    
    // Clear all validation errors
    clearAllErrors();
    
    state.adType = 'product';
    state.selectedProductId = null;
    state.selectedProductImage = null;
    state.customImage = null;
    state.productImageGallery = [];
    state.productImageIndex = 0;
    state.useCredit = false;
    state.creditAmount = 0;
    state.maxCredit = 0;
    state.finalPrice = AD_PLAN_PRICES[state.planSlug];
    state.isLoading = false;
    state.imageState = 'empty';
    state.imageErrorReason = null;
    state.currentImageUrl = null;

    if (state.imageRetryHintTimer) {
      clearTimeout(state.imageRetryHintTimer);
      state.imageRetryHintTimer = null;
    }
    if (elements.imageRetryHint) {
      elements.imageRetryHint.hidden = true;
      elements.imageRetryHint.classList.remove('is-visible');
    }
    
    elements.form?.reset();
    if (elements.creditSwitch) elements.creditSwitch.checked = false;
    if (elements.imageInput) elements.imageInput.value = '';
    
    // Reset credit allocation UI
    toggleCreditAllocation(false);
    
    // Reset custom dropdown
    resetDropdown();
    
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
    
    // Custom dropdown listeners
    attachDropdownListeners();
    
    // Title input with real-time validation
    elements.titleInput?.addEventListener('input', () => {
      updateCharCounter(elements.titleInput, elements.titleCounter, 25);
      // Real-time validation if field was previously invalid
      validateFieldRealtime('title', elements.titleInput.value);
    });
    
    elements.titleInput?.addEventListener('blur', () => {
      // Validate on blur if field has content
      if (elements.titleInput.value.trim()) {
        validateFieldRealtime('title', elements.titleInput.value);
      }
    });
    
    // Text input with real-time validation
    elements.textInput?.addEventListener('input', () => {
      updateCharCounter(elements.textInput, elements.textCounter, 30);
      // Real-time validation if field was previously invalid
      validateFieldRealtime('text', elements.textInput.value);
    });
    
    elements.textInput?.addEventListener('blur', () => {
      // Validate on blur if field has content
      if (elements.textInput.value.trim()) {
        validateFieldRealtime('text', elements.textInput.value);
      }
    });
    
    // Image actions
    elements.changeImageBtn?.addEventListener('click', handleImageEdit);
    elements.removeImageBtn?.addEventListener('click', handleRemoveImage);
    elements.imagePlaceholder?.addEventListener('click', handlePlaceholderClick);
    elements.retryBtn?.addEventListener('click', handleRetryImage);
    elements.editImageBtn?.addEventListener('click', handleImageEdit);
    elements.imageInput?.addEventListener('change', handleImageChange);
    elements.imagePrevBtn?.addEventListener('click', handleGalleryPrev);
    elements.imageNextBtn?.addEventListener('click', handleGalleryNext);
    elements.imagePreview?.addEventListener('touchstart', handleImageTouchStart, { passive: true });
    elements.imagePreview?.addEventListener('touchend', handleImageTouchEnd);
    
    // Credit allocation controls
    elements.creditSwitch?.addEventListener('change', handleCreditToggle);
    elements.creditSlider?.addEventListener('input', handleCreditSliderInput);
    elements.creditInput?.addEventListener('change', handleCreditInputChange);
    elements.creditInput?.addEventListener('blur', handleCreditInputChange);
    
    // Credit chips
    elements.creditChips?.forEach(chip => {
      chip.addEventListener('click', handleCreditChipClick);
    });
    
    // Form submission - prevent native validation, use custom only
    // Note: form has novalidate attribute, but we also prevent submit event
    elements.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSubmit(e);
    });
    
    // Submit button click handler (button is type="button" to avoid native validation)
    elements.submitBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      handleSubmit(e);
    });
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
