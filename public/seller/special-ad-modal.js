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
    isLoading: false
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
      editImageBtn: document.getElementById('specialAdEditImageBtn'),
      imageInput: document.getElementById('specialAdImageInput'),
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
      const profile = await fetchSellerProfile();
      const sellerId = profile?.seller?.id || profile?.seller?._id;
      if (!sellerId) return 0;

      const res = await fetch(`${API_BASE}/seller/wallet?sellerId=${sellerId}`, withCreds());
      if (!res.ok) return 0;
      
      const data = await res.json();
      return data.balance || data.wallet?.balance || 0;
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

  const updateImagePreview = (imageUrl) => {
    if (imageUrl) {
      elements.previewImg.src = imageUrl;
      elements.previewImg.style.display = 'block';
      elements.imagePlaceholder.style.display = 'none';
      elements.imagePreview.classList.add('has-image');
    } else {
      elements.previewImg.style.display = 'none';
      elements.imagePlaceholder.style.display = 'flex';
      elements.imagePreview.classList.remove('has-image');
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
      
      // Clear product selection when switching to shop
      if (state.adType === 'shop') {
        state.selectedProductId = null;
        state.selectedProductImage = null;
        updateImagePreview(null);
      }
    }
  };

  const handleProductChange = (e) => {
    const selectedOption = e.target.selectedOptions[0];
    state.selectedProductId = e.target.value;
    state.selectedProductImage = selectedOption?.dataset.image || null;
    
    // Update image preview with product image (if no custom image)
    if (!state.customImage && state.selectedProductImage) {
      const baseUrl = API_BASE.replace('/api', '');
      const imageUrl = state.selectedProductImage.startsWith('http') 
        ? state.selectedProductImage 
        : `${baseUrl}/uploads/${state.selectedProductImage}`;
      updateImagePreview(imageUrl);
    }
  };

  const handleImageEdit = () => {
    elements.imageInput.click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    state.customImage = file;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      updateImagePreview(event.target.result);
    };
    reader.readAsDataURL(file);
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
    
    elements.backdrop.classList.remove('is-open');
    document.body.classList.remove('overflow-hidden', 'no-scroll');
  };

  const resetForm = () => {
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
      isLoading: false
    };
    
    elements.form.reset();
    elements.creditSwitch.checked = false;
    updateTypeCards();
    updateProductPicker();
    updateImagePreview(null);
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
    
    // Image edit
    elements.editImageBtn?.addEventListener('click', handleImageEdit);
    elements.imageInput?.addEventListener('change', handleImageChange);
    
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
      });
    } else {
      initElements();
      attachEventListeners();
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
