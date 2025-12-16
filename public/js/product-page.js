'use strict';

(function handleNavigation() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primaryNav');
  if (!toggle || !nav) return;

  const mobileQuery = window.matchMedia('(max-width: 767px)');

  function setExpanded(expanded) {
    nav.dataset.expanded = expanded ? 'true' : 'false';
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function syncState() {
    if (mobileQuery.matches) {
      toggle.hidden = false;
      if (!toggle.hasAttribute('data-mobile-initialised')) {
        setExpanded(false);
        toggle.setAttribute('data-mobile-initialised', 'true');
      } else {
        toggle.setAttribute('aria-expanded', nav.dataset.expanded === 'true' ? 'true' : 'false');
      }
    } else {
      toggle.hidden = true;
      toggle.removeAttribute('data-mobile-initialised');
      setExpanded(true);
    }
  }

  toggle.addEventListener('click', () => {
    const expanded = nav.dataset.expanded === 'true';
    setExpanded(!expanded);
  });

  // Close menu when clicking on nav links
  nav.addEventListener('click', (event) => {
    if (!mobileQuery.matches) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.tagName === 'A') {
      setExpanded(false);
    }
  });

  // Close menu when clicking on backdrop
  document.addEventListener('click', (event) => {
    if (!mobileQuery.matches) return;
    const target = event.target;
    if (nav.dataset.expanded === 'true' &&
        !nav.contains(target) &&
        !toggle.contains(target)) {
      setExpanded(false);
    }
  });

  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', syncState);
  } else if (typeof mobileQuery.addListener === 'function') {
    mobileQuery.addListener(syncState);
  }

  syncState();
})();

// Header scroll handler
(function handleHeaderScroll() {
  const header = document.querySelector('header');
  if (!header) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  function updateHeader() {
    const scrollY = window.scrollY;

    if (scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    lastScrollY = scrollY;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateHeader);
      ticking = true;
    }
  });

  updateHeader();
})();

(function () {
  'use strict';

  const dom = {
    status: document.getElementById('statusMessage'),
    badge: document.getElementById('productBadge'),
    title: document.getElementById('productTitle'),
    subtitle: document.getElementById('productSubtitle'),
    galleryPlaceholder: document.getElementById('galleryPlaceholder'),
    heroWrapper: document.getElementById('heroImageWrapper'),
    sliderTrack: document.getElementById('sliderTrack'),
    sliderViewport: document.getElementById('sliderViewport'),
    sliderPrev: document.getElementById('sliderPrev'),
    sliderNext: document.getElementById('sliderNext'),
    sliderIndicators: document.getElementById('sliderIndicators'),
    sliderZoom: document.getElementById('sliderZoom'),
    sliderCounter: document.getElementById('sliderCounter'),
    thumbnails: document.getElementById('thumbnails'),
    lightbox: document.getElementById('galleryLightbox'),
    lightboxImage: document.getElementById('lightboxImage'),
    lightboxCaption: document.getElementById('lightboxCaption'),
    lightboxClose: document.getElementById('lightboxClose'),
    lightboxPrev: document.getElementById('lightboxPrev'),
    lightboxNext: document.getElementById('lightboxNext'),
    lightboxThumbnails: document.getElementById('lightboxThumbnails'),
    lightboxTitle: document.getElementById('lightboxTitle'),
    tagList: document.getElementById('tagList'),
    meta: {
      seller: document.getElementById('productSeller'),
      category: document.getElementById('productCategory'),
      priceCard: document.getElementById('priceCard'),
      price: document.getElementById('productPrice'),
      locationCard: document.getElementById('locationCard'),
      location: document.getElementById('productLocation'),
      updatedCard: document.getElementById('updatedCard'),
      updated: document.getElementById('productUpdated')
    },
    sellerActions: document.getElementById('sellerActions'),
    sellerAddressButton: document.getElementById('sellerAddressButton'),
    messageSellerButton: document.getElementById('messageSellerButton'),
    sellerLink: document.getElementById('sellerLink'),
    addressModal: document.getElementById('addressModal'),
    addressModalTitle: document.getElementById('addressModalTitle'),
    addressModalAddress: document.getElementById('addressModalAddress'),
    addressModalCity: document.getElementById('addressModalCity'),
    addressModalCopy: document.getElementById('addressModalCopy'),
    addressModalClose: document.getElementById('addressModalClose'),
    descriptionLong: document.getElementById('productDescriptionLong'),
    featuresPanel: document.getElementById('featuresPanel'),
    featureList: document.getElementById('featureList'),
    contactList: document.getElementById('contactList'),
    jsonLd: document.getElementById('productJsonLd'),
    likeCard: document.getElementById('likeCard'),
    likeButton: document.getElementById('likeButton'),
    likeCount: document.getElementById('likeCount'),
    likeButtonLabel: document.getElementById('likeButtonLabel'),
    likeStatus: document.getElementById('likeStatus'),
    likeMeterFill: document.getElementById('likeMeterFill')
  };

  const state = {
    images: [],
    activeIndex: 0,
    title: '',
    sellerName: '',
    productId: '',
    sellerId: '',
    shopId: '',
    shopName: '',
    shopType: '',
    category: '',
    priceValue: undefined,
    currency: 'IRR',
    transactionId: undefined,
    addressInfo: null,
    sellerLinkUrl: '',
    sellerLinkMessage: '',
    sellerLinkReady: false,
    copyTimeout: null,
    statusTimeout: null
  };

  const likeState = {
    deviceId: getOrCreateDeviceId(),
    likesCount: 0,
    liked: false,
    loading: false
  };

  function normaliseLikesCount(value) {
    const numericValue = Number(
      (value && typeof value === 'object') ? value.likesCount ?? value.likeCount ?? value.likes : value
    );
    if (!Number.isFinite(numericValue) || numericValue < 0) return 0;
    return numericValue;
  }

  const persianNumberFormatter = new Intl.NumberFormat('fa-IR');

  const sliderTransition = 'transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1)';

  const dragState = {
    isPointerDown: false,
    startX: 0,
    currentX: 0,
    viewportWidth: 0,
    pointerId: null,
    animationFrame: null,
    resizeObserver: null
  };

  const overlayState = {
    active: null,
    lastFocus: null
  };

  function getOrCreateDeviceId() {
    const storageKey = 'vitrinet:device-id';
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) return cached;
    } catch (_err) {
      // دسترسی به localStorage ممکن نیست
    }

    const randomPart = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const generated = `client-${randomPart}`;

    try {
      localStorage.setItem(storageKey, generated);
    } catch (_err) {
      // اگر ذخیره نشد، مقدار تولید شده را برمی‌گردانیم
    }

    return generated;
  }

  function notifyProductAnalytics(detail) {
    try {
      document.dispatchEvent(new CustomEvent('product:updated', { detail }));
    } catch (error) {
      console.warn('product analytics dispatch failed', error);
    }
  }

  if (dom.sliderPrev) {
    dom.sliderPrev.addEventListener('click', () => showPreviousImage());
  }

  if (dom.sliderNext) {
    dom.sliderNext.addEventListener('click', () => showNextImage());
  }

  if (dom.sliderZoom) {
    dom.sliderZoom.addEventListener('click', () => openLightbox());
  }

  if (dom.sliderViewport) {
    dom.sliderViewport.addEventListener('keydown', handleSliderKeydown);
  }

  if (dom.sliderTrack && dom.sliderViewport) {
    setupSliderDrag();
  }

  if (dom.lightboxPrev) {
    dom.lightboxPrev.addEventListener('click', () => showPreviousImage());
  }

  if (dom.lightboxNext) {
    dom.lightboxNext.addEventListener('click', () => showNextImage());
  }

  if (dom.lightboxClose) {
    dom.lightboxClose.addEventListener('click', () => closeOverlay(dom.lightbox));
  }

  if (dom.lightbox) {
    setupOverlay(dom.lightbox);
  }

  if (dom.addressModalClose) {
    dom.addressModalClose.addEventListener('click', () => closeOverlay(dom.addressModal));
  }

  if (dom.addressModal) {
    setupOverlay(dom.addressModal);
  }

  if (dom.addressModalCopy) {
    dom.addressModalCopy.addEventListener('click', handleCopyAddress);
  }

  if (dom.sellerAddressButton) {
    dom.sellerAddressButton.addEventListener('click', openAddressModal);
  }

  if (dom.sellerLink) {
    dom.sellerLink.addEventListener('click', handleSellerLinkClick);
  }

  if (dom.likeButton) {
    dom.likeButton.addEventListener('click', handleLikeToggle);
  }

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    canonical.setAttribute('href', window.location.href.split('#')[0]);
  }

  const productId = new URLSearchParams(window.location.search).get('id');
  if (!productId) {
    showError('شناسه محصولی در آدرس پیدا نشد.');
    return;
  }

  setStatus('در حال بارگذاری اطلاعات محصول...');
  fetchProduct(productId);

  async function fetchProduct(id) {
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
        headers: {
          'x-client-id': likeState.deviceId
        },
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const product = await response.json();
      renderProduct(product, id);
      clearStatus();
    } catch (error) {
      console.error('load product failed', error);
      showError('امکان دریافت اطلاعات محصول وجود ندارد. لطفاً بعداً تلاش کنید.');
    }
  }

  document.addEventListener('keydown', handleGlobalKeydown);

  function setupOverlay(overlay) {
    if (!overlay) return;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeOverlay(overlay);
      }
    });
  }

  function openOverlay(overlay, focusTarget) {
    if (!overlay) return;
    if (overlayState.active && overlayState.active !== overlay) {
      closeOverlay(overlayState.active, false);
    }

    if (overlay.dataset.hideTimerId) {
      clearTimeout(Number(overlay.dataset.hideTimerId));
      delete overlay.dataset.hideTimerId;
    }

    overlay.hidden = false;
    requestAnimationFrame(() => {
      overlay.classList.add('is-visible');
      overlay.removeAttribute('aria-hidden');
    });

    if (document.activeElement instanceof HTMLElement) {
      overlayState.lastFocus = document.activeElement;
    } else {
      overlayState.lastFocus = null;
    }

    overlayState.active = overlay;
    document.body.classList.add('modal-open');
    if (overlay === dom.lightbox) {
      document.body.classList.add('hide-mobile-nav');
    }

    const focusable = focusTarget || overlay.querySelector('[data-focus-default], button, [href], input, select, textarea');
    if (focusable instanceof HTMLElement) {
      focusable.focus();
    }
  }

  function closeOverlay(overlay, restoreFocus = true) {
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    const timerId = window.setTimeout(() => {
      overlay.hidden = true;
      delete overlay.dataset.hideTimerId;
    }, 180);
    overlay.dataset.hideTimerId = String(timerId);

    if (overlayState.active === overlay) {
      overlayState.active = null;
      document.body.classList.remove('modal-open');
      if (overlay === dom.lightbox) {
        document.body.classList.remove('hide-mobile-nav');
      }
      if (restoreFocus && overlayState.lastFocus instanceof HTMLElement) {
        overlayState.lastFocus.focus();
      }
      overlayState.lastFocus = null;
    }
    if (overlay === dom.lightbox) {
      document.body.classList.remove('hide-mobile-nav');
    }
  }

  function handleGlobalKeydown(event) {
    if (event.key === 'Escape' && overlayState.active) {
      event.preventDefault();
      closeOverlay(overlayState.active);
    }
  }

  function handleCopyAddress() {
    if (!dom.addressModalCopy) return;
    const info = state.addressInfo;
    const parts = info ? [info.address, info.city].filter(Boolean) : [];
    const value = parts.join('، ').trim();

    if (!value) {
      showCopyFeedback(false);
      announce('آدرس قابل کپی برای این فروشنده ثبت نشده است.');
      return;
    }

    copyToClipboard(value)
      .then(() => showCopyFeedback(true))
      .catch(() => {
        showCopyFeedback(false);
        announce('کپی آدرس انجام نشد. لطفاً بعداً دوباره تلاش کنید.', true);
      });
  }

  async function copyToClipboard(text) {
    const value = String(text || '').trim();
    if (!value) {
      throw new Error('empty');
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.insetInlineStart = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const succeeded = document.execCommand && document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!succeeded) {
      throw new Error('execCommand failed');
    }
  }

  function showCopyFeedback(success) {
    if (!dom.addressModalCopy) return;
    if (state.copyTimeout) {
      clearTimeout(state.copyTimeout);
    }

    const original = dom.addressModalCopy.dataset.originalLabel || dom.addressModalCopy.textContent || '';
    dom.addressModalCopy.dataset.originalLabel = original;
    dom.addressModalCopy.textContent = success ? 'کپی شد!' : 'خطا در کپی';
    dom.addressModalCopy.classList.toggle('is-success', success);
    dom.addressModalCopy.classList.toggle('is-error', !success);

    state.copyTimeout = window.setTimeout(() => {
      dom.addressModalCopy.textContent = dom.addressModalCopy.dataset.originalLabel || 'کپی آدرس';
      dom.addressModalCopy.classList.remove('is-success', 'is-error');
      state.copyTimeout = null;
    }, 2400);
  }

  function openAddressModal() {
    if (!dom.addressModal) return;
    const info = state.addressInfo || {
      address: 'آدرس فروشنده برای این محصول ثبت نشده است.',
      city: '',
      mapUrl: '',
      sellerName: state.sellerName || 'فروشنده',
      hasAddress: false
    };

    if (dom.addressModalAddress) {
      dom.addressModalAddress.textContent = info.address || 'آدرس فروشنده برای این محصول ثبت نشده است.';
    }

    if (dom.addressModalCity) {
      if (info.hasAddress && info.city) {
        dom.addressModalCity.textContent = `شهر: ${info.city}`;
        dom.addressModalCity.hidden = false;
      } else {
        dom.addressModalCity.hidden = true;
        dom.addressModalCity.textContent = '';
      }
    }

    if (dom.addressModalCopy) {
      if (state.copyTimeout) {
        clearTimeout(state.copyTimeout);
        state.copyTimeout = null;
      }
      dom.addressModalCopy.textContent = dom.addressModalCopy.dataset.originalLabel || 'کپی آدرس';
      dom.addressModalCopy.dataset.originalLabel = dom.addressModalCopy.textContent;
      dom.addressModalCopy.classList.remove('is-success', 'is-error');
      dom.addressModalCopy.dataset.hasAddress = info.hasAddress ? 'true' : 'false';
    }

    if (dom.addressModalTitle) {
      dom.addressModalTitle.textContent = info.sellerName
        ? `آدرس مغازه ${info.sellerName}`
        : 'آدرس مغازه';
    }

    dom.addressModal.dataset.hasAddress = info.hasAddress ? 'true' : 'false';

    openOverlay(dom.addressModal, dom.addressModalClose || dom.addressModalCopy);
  }

  function handleSellerLinkClick(event) {
    if (state.sellerLinkUrl) {
      return;
    }
    event.preventDefault();
    const message = state.sellerLinkMessage || 'صفحه مغازه برای این فروشنده در دسترس نیست.';
    announce(message);
  }

  function setStatus(message) {
    updateStatus(message, { isError: false, autoHide: false });
  }

  function clearStatus() {
    if (!dom.status) return;
    if (state.statusTimeout) {
      clearTimeout(state.statusTimeout);
      state.statusTimeout = null;
    }
    dom.status.textContent = '';
    dom.status.hidden = true;
    dom.status.classList.remove('status-error');
  }

  function showError(message) {
    updateStatus(message, { isError: true, autoHide: false });
    if (dom.galleryPlaceholder) {
      dom.galleryPlaceholder.hidden = false;
      dom.galleryPlaceholder.innerHTML = `<p>${message}</p>`;
    }
  }

  function announce(message, isError = false) {
    updateStatus(message, { isError, autoHide: true });
  }

  function updateStatus(message, { isError = false, autoHide = false } = {}) {
    if (!dom.status) return;
    if (state.statusTimeout) {
      clearTimeout(state.statusTimeout);
      state.statusTimeout = null;
    }
    dom.status.textContent = message;
    dom.status.hidden = false;
    dom.status.classList.toggle('status-error', Boolean(isError));
    if (autoHide) {
      state.statusTimeout = window.setTimeout(() => {
        dom.status.textContent = '';
        dom.status.hidden = true;
        dom.status.classList.remove('status-error');
        state.statusTimeout = null;
      }, 4800);
    }
  }

  function updateLikeUI() {
    if (!dom.likeButton || !dom.likeCount) return;

    dom.likeButton.setAttribute('aria-pressed', likeState.liked ? 'true' : 'false');
    dom.likeButton.classList.toggle('is-liked', likeState.liked);
    dom.likeButton.classList.toggle('is-busy', likeState.loading);

    if (dom.likeButtonLabel) {
      dom.likeButtonLabel.textContent = likeState.liked ? 'این محصول را پسندیده‌اید' : 'پسندیدن محصول';
    }

    dom.likeCount.textContent = persianNumberFormatter.format(Math.max(0, likeState.likesCount));

    if (dom.likeMeterFill) {
      const progress = Math.min(100, 12 + Math.log(likeState.likesCount + 1) * 28);
      dom.likeMeterFill.style.width = `${progress}%`;
    }

    if (dom.likeStatus) {
      dom.likeStatus.textContent = likeState.liked
        ? 'بازخورد شما ثبت شد'
        : 'اولین نفری باشید که این محصول را می‌پسندد';
      dom.likeStatus.classList.toggle('is-liked', likeState.liked);
    }
  }

  async function loadLikeStatus(productId) {
    if (!productId) return;
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/like-status`, {
        headers: {
          'x-client-id': likeState.deviceId
        },
        credentials: 'include'
      });

      if (!response.ok) return;
      const payload = await response.json();
      const count = normaliseLikesCount(payload);
      likeState.likesCount = Number.isFinite(count) ? count : likeState.likesCount;
      likeState.liked = Boolean(payload.liked);
      updateLikeUI();
    } catch (_err) {
      // سکوت در صورت خطا، بخش لایک نباید تجربه کلی را خراب کند
    }
  }

  async function handleLikeToggle(event) {
    if (event) event.preventDefault();
    if (!state.productId || likeState.loading) return;

    likeState.loading = true;
    updateLikeUI();
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(state.productId)}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': likeState.deviceId
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Like toggle failed: ${response.status}`);
      }

      const payload = await response.json();
      const count = normaliseLikesCount(payload);
      likeState.likesCount = Number.isFinite(count) ? count : likeState.likesCount;
      likeState.liked = Boolean(payload.liked);
      animateLikeButton();
      updateLikeUI();
    } catch (_err) {
      announce('امکان ثبت پسند در حال حاضر وجود ندارد. لطفاً دوباره تلاش کنید.', true);
    } finally {
      likeState.loading = false;
      updateLikeUI();
    }
  }

  function animateLikeButton() {
    if (!dom.likeButton) return;
    dom.likeButton.classList.remove('pop');
    void dom.likeButton.offsetWidth;
    dom.likeButton.classList.add('pop');
    window.setTimeout(() => dom.likeButton && dom.likeButton.classList.remove('pop'), 650);
  }

  function renderProduct(product, id) {
    if (!product || typeof product !== 'object') {
      showError('اطلاعات معتبری برای این محصول ثبت نشده است.');
      return;
    }

    state.title = (product.title || '').trim();
    const title = state.title || 'محصول بدون نام';
    dom.title.textContent = title;
    document.title = `${title} | ویترینت`;

    const seller =
(product.seller && typeof product.seller === 'object') ? product.seller :
(product.sellerId && typeof product.sellerId === 'object') ? product.sellerId :
{};


    const summary = extractSummary(product.desc);
    dom.subtitle.textContent = summary || 'برای این محصول هنوز توضیح مختصری ثبت نشده است.';

    if (product.badge) {
      dom.badge.textContent = product.badge;
      dom.badge.hidden = false;
    } else {
      dom.badge.hidden = true;
    }

    const sellerName = seller.storename || seller.ownerName || [seller.ownerFirstname, seller.ownerLastname].filter(Boolean).join(' ') || '';
    dom.meta.seller.textContent = sellerName || 'فروشنده نامشخص';
    dom.meta.category.textContent = product.category || 'نامشخص';
    state.productId = product._id || product.id || id || '';
    state.category = product.category || '';
    state.shopName = sellerName || '';

    const likeCount = normaliseLikesCount(product);
    likeState.likesCount = Number.isFinite(likeCount) ? likeCount : 0;
    likeState.liked = Boolean(product.liked);
    updateLikeUI();

    const priceValue = normaliseNumber(product.price);
    if (priceValue !== null) {
      dom.meta.price.textContent = new Intl.NumberFormat('fa-IR').format(priceValue) + ' تومان';
      dom.meta.priceCard.hidden = false;
    } else {
      dom.meta.priceCard.hidden = true;
      dom.meta.price.textContent = '';
    }
    state.priceValue = priceValue !== null ? priceValue : undefined;

    const location = seller.address || seller.city || '';
    if (location && dom.meta.locationCard) {
      dom.meta.location.textContent = location;
      dom.meta.locationCard.hidden = false;
    } else if (dom.meta.locationCard) {
      dom.meta.locationCard.hidden = true;
      dom.meta.location.textContent = '';
    }

    if (product.updatedAt && dom.meta.updatedCard) {
      dom.meta.updated.textContent = formatDate(product.updatedAt);
      dom.meta.updatedCard.hidden = false;
    } else if (dom.meta.updatedCard) {
      dom.meta.updatedCard.hidden = true;
      dom.meta.updated.textContent = '';
    }

    renderGallery(product, seller);
    renderTags(product.tags);
    renderDescription(product.desc);
    renderSellerCard(seller, product);
    renderContactPanel(seller);
    updateMetaTags(product, seller, summary);
    updateStructuredData(product, seller, id);
    if (state.productId) {
      loadLikeStatus(state.productId);
    }

    const analyticsState = {
      item_id: state.productId,
      item_name: title,
      category: state.category,
      price: state.priceValue,
      currency: state.currency,
      seller_id: state.sellerId || '',
      shop_id: state.shopId || '',
      shop_name: state.shopName || '',
      shop_type: state.shopType || '',
      sellerLinkReady: Boolean(state.sellerLinkUrl)
    };

    notifyProductAnalytics({
      state: analyticsState,
      viewItem: {
        item_id: analyticsState.item_id,
        item_name: analyticsState.item_name,
        category: analyticsState.category,
        price: analyticsState.price,
        currency: analyticsState.currency,
        seller_id: analyticsState.seller_id || undefined,
        shop_id: analyticsState.shop_id || undefined
      },
      viewShop: analyticsState.shop_id ? {
        shop_id: analyticsState.shop_id,
        shop_name: analyticsState.shop_name,
        shop_type: analyticsState.shop_type
      } : undefined
    });
  }

  function renderGallery(product, seller) {
    const resolved = Array.isArray(product.images) ? product.images.map(resolveMediaPath).filter(Boolean) : [];
    if ((!resolved || !resolved.length) && seller && seller.boardImage) {
      resolved.push(resolveMediaPath(seller.boardImage));
    }

    state.images = resolved;
    state.activeIndex = Number.isInteger(product.mainImageIndex) ? product.mainImageIndex : 0;
    dom.thumbnails.innerHTML = '';

    if (!state.images.length) {
      dom.heroWrapper.hidden = true;
      if (dom.galleryPlaceholder) {
        dom.galleryPlaceholder.hidden = false;
        dom.galleryPlaceholder.innerHTML = '<p>برای این محصول تصویری ثبت نشده است.</p>';
      }
      dom.thumbnails.hidden = true;
      if (dom.lightboxThumbnails) {
        dom.lightboxThumbnails.innerHTML = '';
        dom.lightboxThumbnails.hidden = true;
      }
      if (dom.sliderCounter) {
        dom.sliderCounter.hidden = true;
        dom.sliderCounter.textContent = '';
      }
      syncLightbox();
      updateLightboxControls();
      return;
    }

    if (dom.galleryPlaceholder) {
      dom.galleryPlaceholder.hidden = true;
    }

    dom.heroWrapper.hidden = false;

    if (dom.sliderZoom) {
      dom.sliderZoom.hidden = false;
      dom.sliderZoom.disabled = false;
    }

    if (dom.sliderTrack) {
      dom.sliderTrack.innerHTML = '';
    }

    if (dom.sliderIndicators) {
      dom.sliderIndicators.innerHTML = '';
    }

    dom.thumbnails.innerHTML = '';

    if (dom.sliderCounter) {
      dom.sliderCounter.hidden = true;
      dom.sliderCounter.textContent = '';
    }

    const initialIndex = Math.min(Math.max(state.activeIndex, 0), state.images.length - 1);
    state.activeIndex = initialIndex;

    state.images.forEach((src, index) => {
      const imageNumber = persianNumberFormatter.format(index + 1);
      if (dom.sliderTrack) {
        const slide = document.createElement('li');
        slide.className = 'slide';
        if (index === initialIndex) {
          slide.classList.add('is-active');
        }
        slide.setAttribute('aria-hidden', index === initialIndex ? 'false' : 'true');

        const img = document.createElement('img');
        img.src = src;
        img.alt = `${state.title || 'تصویر محصول'} - تصویر ${imageNumber}`;

        slide.appendChild(img);
        dom.sliderTrack.appendChild(slide);
      }

      if (dom.sliderIndicators) {
        const indicator = document.createElement('button');
        indicator.type = 'button';
        indicator.className = 'slider-indicator';
        indicator.setAttribute('aria-label', `نمایش تصویر ${imageNumber}`);
        indicator.setAttribute('aria-pressed', index === initialIndex ? 'true' : 'false');
        indicator.addEventListener('click', () => setActiveImage(index));
        dom.sliderIndicators.appendChild(indicator);
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'thumb';
      button.setAttribute('aria-pressed', index === initialIndex ? 'true' : 'false');

      const thumbImage = document.createElement('img');
      thumbImage.src = src;
      thumbImage.alt = `${state.title || 'تصویر محصول'} - تصویر ${imageNumber}`;

      button.appendChild(thumbImage);
      button.addEventListener('click', () => setActiveImage(index));
      dom.thumbnails.appendChild(button);
    });

    if (dom.sliderViewport) {
      const activeText = persianNumberFormatter.format(initialIndex + 1);
      const totalText = persianNumberFormatter.format(state.images.length);
      dom.sliderViewport.setAttribute('aria-label', `گالری تصاویر محصول - تصویر ${activeText} از ${totalText}`);
    }

    dom.thumbnails.hidden = state.images.length < 2;

    renderLightboxThumbnails();

    setActiveImage(initialIndex);
  }

  function setActiveImage(index) {
    if (!state.images[index]) return;
    state.activeIndex = index;
    if (dom.sliderTrack) {
      dom.sliderTrack.classList.remove('is-dragging');
      dom.sliderTrack.style.transition = sliderTransition;
      dom.sliderTrack.style.transform = `translate3d(${-index * 100}%, 0, 0)`;
      [...dom.sliderTrack.children].forEach((slide, idx) => {
        slide.classList.toggle('is-active', idx === index);
        slide.setAttribute('aria-hidden', idx === index ? 'false' : 'true');
      });
    }

    if (dom.sliderIndicators) {
      [...dom.sliderIndicators.children].forEach((indicator, idx) => {
        indicator.setAttribute('aria-pressed', idx === index ? 'true' : 'false');
        if (idx === index) {
          indicator.setAttribute('aria-current', 'true');
        } else {
          indicator.removeAttribute('aria-current');
        }
      });
    }

    if (dom.sliderViewport) {
      const activeText = persianNumberFormatter.format(index + 1);
      const totalText = persianNumberFormatter.format(state.images.length);
      dom.sliderViewport.setAttribute('aria-label', `گالری تصاویر محصول - تصویر ${activeText} از ${totalText}`);
    }

    [...dom.thumbnails.children].forEach((btn, idx) => {
      btn.setAttribute('aria-pressed', idx === index ? 'true' : 'false');
    });

    updateSliderCounter();
    updateSliderControls();
    syncLightbox();
  }

  function updateSliderControls() {
    const hasMultiple = state.images.length > 1;

    if (dom.sliderPrev) {
      dom.sliderPrev.hidden = !hasMultiple;
      dom.sliderPrev.disabled = !hasMultiple;
    }

    if (dom.sliderNext) {
      dom.sliderNext.hidden = !hasMultiple;
      dom.sliderNext.disabled = !hasMultiple;
    }

    if (dom.sliderIndicators) {
      dom.sliderIndicators.hidden = !hasMultiple;
    }
  }

  function updateSliderCounter() {
    if (!dom.sliderCounter) return;
    if (!state.images.length) {
      dom.sliderCounter.hidden = true;
      dom.sliderCounter.textContent = '';
      return;
    }

    const current = persianNumberFormatter.format(state.activeIndex + 1);
    const total = persianNumberFormatter.format(state.images.length);
    dom.sliderCounter.hidden = false;
    dom.sliderCounter.textContent = state.images.length > 1 ? `${current} / ${total}` : total;
  }

  function showNextImage() {
    if (state.images.length < 2) return;
    const nextIndex = (state.activeIndex + 1) % state.images.length;
    setActiveImage(nextIndex);
  }

  function showPreviousImage() {
    if (state.images.length < 2) return;
    const prevIndex = (state.activeIndex - 1 + state.images.length) % state.images.length;
    setActiveImage(prevIndex);
  }

  function handleSliderKeydown(event) {
    if (!state.images.length) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showPreviousImage();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showNextImage();
    }
  }

  function setupSliderDrag() {
    if (!dom.sliderTrack || !dom.sliderViewport) return;
    updateDragViewportWidth();

    dom.sliderTrack.addEventListener('pointerdown', handleSliderPointerDown);
    dom.sliderTrack.addEventListener('pointermove', handleSliderPointerMove);
    dom.sliderTrack.addEventListener('pointerup', handleSliderPointerUp);
    dom.sliderTrack.addEventListener('pointercancel', handleSliderPointerCancel);
    dom.sliderTrack.addEventListener('lostpointercapture', handleSliderPointerCancel);
    dom.sliderTrack.addEventListener('pointerleave', handleSliderPointerLeave);

    if ('ResizeObserver' in window) {
      dragState.resizeObserver = new ResizeObserver(updateDragViewportWidth);
      dragState.resizeObserver.observe(dom.sliderViewport);
    } else {
      window.addEventListener('resize', updateDragViewportWidth);
    }
  }

  function updateDragViewportWidth() {
    dragState.viewportWidth = dom.sliderViewport ? dom.sliderViewport.clientWidth : 0;
  }

  function handleSliderPointerDown(event) {
    if (!dom.sliderTrack || !dom.sliderViewport) return;
    if (state.images.length < 2) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    dragState.isPointerDown = true;
    dragState.pointerId = event.pointerId;
    dragState.startX = event.clientX;
    dragState.currentX = event.clientX;
    updateDragViewportWidth();

    dom.sliderTrack.setPointerCapture(event.pointerId);
    dom.sliderTrack.classList.add('is-dragging');
    dom.sliderTrack.style.transition = 'none';
  }

  function handleSliderPointerMove(event) {
    if (!dragState.isPointerDown || event.pointerId !== dragState.pointerId) return;
    dragState.currentX = event.clientX;

    if (!dragState.animationFrame) {
      dragState.animationFrame = requestAnimationFrame(() => {
        dragState.animationFrame = null;
        renderSliderDrag();
      });
    }
  }

  function handleSliderPointerUp(event) {
    if (!dragState.isPointerDown || event.pointerId !== dragState.pointerId) return;
    finishSliderDrag(false, event.pointerId);
  }

  function handleSliderPointerCancel(event) {
    if (!dragState.isPointerDown) return;
    const pointerId = typeof event.pointerId === 'number' ? event.pointerId : dragState.pointerId;
    finishSliderDrag(true, pointerId);
  }

  function handleSliderPointerLeave(event) {
    if (!dragState.isPointerDown || event.pointerType !== 'mouse') return;
    finishSliderDrag(false, event.pointerId);
  }

  function renderSliderDrag() {
    if (!dom.sliderTrack) return;
    const delta = dragState.currentX - dragState.startX;
    const offset = dragState.viewportWidth ? (delta / dragState.viewportWidth) * 100 : 0;
    dom.sliderTrack.style.transform = `translate3d(${(-state.activeIndex * 100) + offset}%, 0, 0)`;
  }

  function finishSliderDrag(cancelled, pointerId) {
    if (!dom.sliderTrack) return;

    if (typeof pointerId === 'number' && dom.sliderTrack.hasPointerCapture(pointerId)) {
      dom.sliderTrack.releasePointerCapture(pointerId);
    }

    if (dragState.animationFrame) {
      cancelAnimationFrame(dragState.animationFrame);
      dragState.animationFrame = null;
    }

    const delta = dragState.currentX - dragState.startX;
    dragState.isPointerDown = false;
    dragState.pointerId = null;
    dom.sliderTrack.classList.remove('is-dragging');
    dom.sliderTrack.style.transition = sliderTransition;

    if (cancelled) {
      setActiveImage(state.activeIndex);
      return;
    }

    const threshold = dragState.viewportWidth * 0.18;
    if (dragState.viewportWidth && Math.abs(delta) > threshold) {
      const total = state.images.length;
      if (delta < 0) {
        setActiveImage((state.activeIndex + 1) % total);
      } else if (delta > 0) {
        setActiveImage((state.activeIndex - 1 + total) % total);
      } else {
        setActiveImage(state.activeIndex);
      }
    } else {
      setActiveImage(state.activeIndex);
    }
  }

  function openLightbox(index = state.activeIndex) {
    if (!dom.lightbox || !state.images.length) return;
    if (typeof index === 'number' && state.images[index]) {
      setActiveImage(index);
    }
    syncLightbox();
    openOverlay(dom.lightbox, dom.lightboxClose || dom.lightboxNext || dom.lightboxPrev);
  }

  function renderLightboxThumbnails() {
    if (!dom.lightboxThumbnails) return;
    dom.lightboxThumbnails.innerHTML = '';

    if (!state.images.length) {
      dom.lightboxThumbnails.hidden = true;
      return;
    }

    dom.lightboxThumbnails.hidden = state.images.length < 2;

    state.images.forEach((src, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lightbox-thumb';
      button.setAttribute('aria-pressed', index === state.activeIndex ? 'true' : 'false');

      const img = document.createElement('img');
      img.src = src;
      const imageNumber = persianNumberFormatter.format(index + 1);
      img.alt = `${state.title || 'تصویر محصول'} - تصویر ${imageNumber}`;

      button.appendChild(img);
      button.addEventListener('click', () => setActiveImage(index));
      dom.lightboxThumbnails.appendChild(button);
    });
  }

  function syncLightbox() {
    if (!dom.lightboxImage) return;

    if (!state.images.length || state.activeIndex >= state.images.length) {
      dom.lightboxImage.removeAttribute('src');
      if (dom.lightboxCaption) {
        dom.lightboxCaption.textContent = '';
      }
      updateLightboxControls();
      return;
    }

    const currentSrc = state.images[state.activeIndex];
    dom.lightboxImage.src = currentSrc;
    const imageNumber = persianNumberFormatter.format(state.activeIndex + 1);
    const totalNumber = persianNumberFormatter.format(state.images.length);
    dom.lightboxImage.alt = `${state.title || 'تصویر محصول'} - نمای بزرگ تصویر ${imageNumber}`;

    if (dom.lightboxCaption) {
      dom.lightboxCaption.textContent = `تصویر ${imageNumber} از ${totalNumber}`;
    }

    if (dom.lightboxThumbnails) {
      [...dom.lightboxThumbnails.children].forEach((btn, idx) => {
        btn.setAttribute('aria-pressed', idx === state.activeIndex ? 'true' : 'false');
      });
    }

    updateLightboxControls();
  }

  function updateLightboxControls() {
    const hasImages = state.images.length > 0;
    const hasMultiple = state.images.length > 1;

    if (dom.lightboxPrev) {
      dom.lightboxPrev.hidden = !hasMultiple;
      dom.lightboxPrev.disabled = !hasMultiple;
    }

    if (dom.lightboxNext) {
      dom.lightboxNext.hidden = !hasMultiple;
      dom.lightboxNext.disabled = !hasMultiple;
    }

    if (dom.lightboxThumbnails) {
      dom.lightboxThumbnails.hidden = !hasMultiple;
    }

    if (dom.sliderZoom) {
      dom.sliderZoom.hidden = !hasImages;
      dom.sliderZoom.disabled = !hasImages;
    }
  }

  function renderTags(tags) {
    if (dom.tagList) {
      dom.tagList.innerHTML = '';
      dom.tagList.hidden = true;
    }

    if (dom.featureList) {
      dom.featureList.innerHTML = '';
    }

    if (dom.featuresPanel) {
      dom.featuresPanel.hidden = true;
    }

    const list = Array.isArray(tags) ? tags.map(tag => String(tag || '').trim()).filter(Boolean) : [];
    if (!list.length) {
      return;
    }

    list.forEach(tag => {
      if (dom.tagList) {
        const chip = document.createElement('li');
        chip.className = 'tag-chip';
        chip.textContent = tag;
        dom.tagList.appendChild(chip);
      }

      if (dom.featureList) {
        const featureItem = document.createElement('li');
        featureItem.textContent = tag;
        dom.featureList.appendChild(featureItem);
      }
    });

    if (dom.tagList) {
      dom.tagList.hidden = false;
    }

    if (dom.featuresPanel && dom.featureList) {
      dom.featuresPanel.hidden = false;
    }
  }

  function renderDescription(desc) {
    if (!dom.descriptionLong) return;

    dom.descriptionLong.innerHTML = '';
    const parts = typeof desc === 'string'
      ? desc.split(/\n{2,}|[\r\n]+/).map(part => part.trim()).filter(Boolean)
      : [];

    if (!parts.length) {
      const p = document.createElement('p');
      p.textContent = 'برای این محصول هنوز توضیحاتی ثبت نشده است.';
      dom.descriptionLong.appendChild(p);
      return;
    }

    parts.forEach(text => {
      const p = document.createElement('p');
      p.textContent = text;
      dom.descriptionLong.appendChild(p);
    });
  }

  function renderSellerCard(seller, productDesc) {
    const sellerName = seller && (seller.storename || seller.ownerName || [seller.ownerFirstname, seller.ownerLastname].filter(Boolean).join(' ')) || 'فروشنده نامشخص';
    state.sellerName = sellerName;

    const fallbackAddress = 'آدرس فروشنده برای این محصول ثبت نشده است.';

    const productSellerId = (productDesc && typeof productDesc.sellerId === 'string') ? productDesc.sellerId.trim() : '';
    const sellerId = productSellerId || document.body?.dataset?.sellerId || window.LAST_PUBLIC?.sellerId || '';
    const productShopSlug = (productDesc && typeof productDesc.shopurl === 'string') ? productDesc.shopurl.trim() : '';
    const productShopSlugAlt = (productDesc && typeof productDesc.shopUrl === 'string') ? productDesc.shopUrl.trim() : '';
    const shopSlug = seller?.shopurl || seller?.shopUrl || productShopSlug || productShopSlugAlt || '';
    const rawSellerId = seller && (seller._id || seller.id || seller.sellerId);
    const resolvedSellerId = rawSellerId && typeof rawSellerId === 'object'
      ? (rawSellerId.$oid || rawSellerId._id || rawSellerId.id || '')
      : rawSellerId;
    state.sellerId = resolvedSellerId ? String(resolvedSellerId) : String(sellerId || '');
    const rawShopId = seller && (seller.shopid || seller.shopId);
    const resolvedShopId = rawShopId && typeof rawShopId === 'object'
      ? (rawShopId.$oid || rawShopId._id || rawShopId.id || '')
      : rawShopId;
    state.shopId = String(resolvedShopId || shopSlug || '');
    state.shopType = seller?.category || productDesc?.category || state.category;
    state.shopName = sellerName;

    const hasSeller = !!(seller && (seller.storename || seller.ownerName || seller.ownerFirstname || seller.ownerLastname || seller.phone || seller.address || seller.category || seller.boardImage || seller.desc)) || !!sellerId || !!shopSlug;

    if (!hasSeller) {
      if (dom.sellerActions) {
        dom.sellerActions.hidden = false;
      }
      if (dom.sellerAddressButton) {
        dom.sellerAddressButton.hidden = false;
        dom.sellerAddressButton.disabled = false;
        dom.sellerAddressButton.classList.remove('is-disabled');
        dom.sellerAddressButton.dataset.hasAddress = 'false';
        dom.sellerAddressButton.setAttribute('aria-label', 'آدرس فروشنده برای این محصول ثبت نشده است.');
      }
      if (dom.messageSellerButton) {
        dom.messageSellerButton.hidden = false;
        dom.messageSellerButton.disabled = false;
        dom.messageSellerButton.classList.remove('is-disabled');
      }
      if (dom.sellerLink) {
        dom.sellerLink.classList.remove('is-disabled');
        dom.sellerLink.removeAttribute('aria-disabled');
        dom.sellerLink.removeAttribute('tabindex');
        dom.sellerLink.href = '#';
        dom.sellerLink.setAttribute('aria-label', 'صفحه مغازه برای این فروشنده در دسترس نیست.');
        dom.sellerLink.dataset.hasShop = 'false';
      }
      state.addressInfo = {
        address: fallbackAddress,
        city: '',
        mapUrl: '',
        sellerName,
        hasAddress: false
      };
      state.sellerLinkUrl = '';
      state.sellerLinkMessage = 'صفحه مغازه برای این فروشنده در دسترس نیست.';
      state.sellerLinkReady = false;
      return;
    }

    const addressText = seller && seller.address ? String(seller.address).trim() : '';
    const cityText = seller && seller.city ? String(seller.city).trim() : '';

    if (dom.sellerAddressButton) {
      dom.sellerAddressButton.hidden = false;
      dom.sellerAddressButton.disabled = false;
      dom.sellerAddressButton.classList.remove('is-disabled');
    }

    if (dom.messageSellerButton) {
      dom.messageSellerButton.hidden = false;
      dom.messageSellerButton.disabled = false;
      dom.messageSellerButton.classList.remove('is-disabled');
    }

    if (addressText) {
      if (dom.sellerAddressButton) {
        const mapQuery = [addressText, cityText].filter(Boolean).join('، ');
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery || addressText)}`;
        state.addressInfo = {
          address: addressText,
          city: cityText,
          mapUrl,
          sellerName,
          hasAddress: true
        };
        dom.sellerAddressButton.setAttribute('aria-label', `مشاهده آدرس ${sellerName} در پنجره مجزا`);
        dom.sellerAddressButton.dataset.hasAddress = 'true';
      }
    } else {
      if (dom.sellerAddressButton) {
        dom.sellerAddressButton.setAttribute('aria-label', fallbackAddress);
        dom.sellerAddressButton.dataset.hasAddress = 'false';
      }
      state.addressInfo = {
        address: fallbackAddress,
        city: cityText,
        mapUrl: '',
        sellerName,
        hasAddress: false
      };
    }

    const shopUrl = seller && typeof seller.shopurl === 'string' ? seller.shopurl.trim() : '';
    if (shopUrl) {
      state.sellerLinkUrl = `/shop.html?shopurl=${encodeURIComponent(shopUrl)}`;
      state.sellerLinkMessage = '';
    } else {
      state.sellerLinkUrl = '';
      state.sellerLinkMessage = `صفحه مغازه ${sellerName} هنوز در ویترینت ثبت نشده است.`;
    }
    state.sellerLinkReady = Boolean(state.sellerLinkUrl);

    if (dom.sellerLink) {
      if (state.sellerLinkUrl) {
        dom.sellerLink.href = state.sellerLinkUrl;
        dom.sellerLink.setAttribute('aria-label', `مشاهده صفحه مغازه ${sellerName} در ویترینت`);
        dom.sellerLink.classList.remove('is-disabled');
        dom.sellerLink.removeAttribute('aria-disabled');
        dom.sellerLink.removeAttribute('tabindex');
        dom.sellerLink.dataset.hasShop = 'true';
      } else {
        dom.sellerLink.href = '#';
        dom.sellerLink.setAttribute('aria-label', `صفحه مغازه ${sellerName} در ویترینت ثبت نشده است.`);
        dom.sellerLink.classList.remove('is-disabled');
        dom.sellerLink.removeAttribute('aria-disabled');
        dom.sellerLink.removeAttribute('tabindex');
        dom.sellerLink.dataset.hasShop = 'false';
      }
    }
  }

  function renderContactPanel(seller) {
    const contactList = dom.contactList;
    if (!contactList) {
      return;
    }

    contactList.innerHTML = '';
    const items = [];
    const addressText = seller && seller.address ? String(seller.address).trim() : '';

    if (seller && seller.phone) {
      items.push({
        label: 'شماره تماس فروشنده',
        value: seller.phone,
        type: 'phone'
      });
    }

    if (addressText) {
      items.push({
        label: 'آدرس',
        value: addressText
      });
    }

    if (seller && seller.city) {
      items.push({
        label: 'شهر',
        value: seller.city
      });
    }

    if (seller && seller.shopurl) {
      const storeUrl = `${window.location.origin}/shop.html?shopurl=${encodeURIComponent(seller.shopurl)}`;
      items.push({
        label: 'صفحه فروشگاه در ویترینت',
        value: storeUrl,
        text: seller.shopurl,
        type: 'link'
      });
    }

    if (!items.length) {
      items.push({
        label: 'پشتیبانی ویترینت',
        value: '۰۲۱۹۱۰۹۰۸۱۰',
        type: 'phone'
      });
    }

    items.forEach(item => {
      const li = document.createElement('li');

      const labelSpan = document.createElement('span');
      labelSpan.textContent = item.label;

      const valueSpan = document.createElement('span');
      if (item.type === 'link') {
        const link = document.createElement('a');
        link.href = item.value;
        link.textContent = item.text || item.value;
        link.target = '_blank';
        link.rel = 'noopener';
        valueSpan.appendChild(link);
      } else if (item.type === 'external-link') {
        const link = document.createElement('a');
        link.href = item.value;
        link.textContent = item.text || item.value;
        link.target = '_blank';
        link.rel = 'noopener';
        valueSpan.appendChild(link);
      } else if (item.type === 'phone') {
        const link = document.createElement('a');
        const phoneDigits = toEnglishDigits(String(item.value));
        link.href = `tel:${phoneDigits}`;
        link.textContent = item.value;
        valueSpan.appendChild(link);
      } else {
        valueSpan.textContent = item.value;
      }

      li.appendChild(labelSpan);
      li.appendChild(valueSpan);
      contactList.appendChild(li);
    });
  }

  function updateMetaTags(product, seller, summary) {
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      const desc = summary || extractSummary(product.desc, 180) || 'جزئیات محصول در ویترینت';
      metaDescription.setAttribute('content', desc);
    }

    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      const tags = Array.isArray(product.tags) ? product.tags.filter(Boolean) : [];
      const keywords = [product.title, product.category, seller?.storename, ...tags].filter(Boolean).join(', ');
      metaKeywords.setAttribute('content', keywords);
    }
  }

  function updateStructuredData(product, seller, id) {
    if (!dom.jsonLd) return;

    const images = state.images;
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': `${window.location.origin}/product.html?id=${product._id || product.id || id}`,
      name: product.title || '',
      description: extractSummary(product.desc, 300) || '',
      image: images,
      brand: {
        '@type': 'Brand',
        name: 'Vitrinnet'
      }
    };

    if (product._id || product.id) {
      data.sku = String(product._id || product.id);
    }

    if (seller && (seller.storename || seller.ownerName)) {
      data.seller = {
        '@type': 'Organization',
        name: seller.storename || seller.ownerName
      };
    }

    const priceValue = normaliseNumber(product.price);
    if (priceValue !== null) {
      data.offers = {
        '@type': 'Offer',
        priceCurrency: 'IRR',
        price: priceValue,
        availability: 'https://schema.org/InStock',
        url: window.location.href
      };
    }

    dom.jsonLd.textContent = JSON.stringify(data, null, 2);
  }

  function resolveMediaPath(path) {
    if (!path) return '';
    const trimmed = String(path).trim();
    if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
    return `${window.location.origin}/${trimmed.replace(/^\/+/, '')}`;
  }

  function extractSummary(desc, maxLength = 220) {
    if (!desc) return '';
    const text = String(desc).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength).trim()}…` : text;
  }

  function normaliseNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const normalised = toEnglishDigits(value);
      const numeric = Number(normalised.replace(/[^\d.-]/g, ''));
      return Number.isFinite(numeric) ? numeric : null;
    }
    return null;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'long' }).format(date);
  }

  function toEnglishDigits(input) {
    if (typeof input !== 'string') return '';
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    return input
      .split('')
      .map(char => {
        const persianIndex = persian.indexOf(char);
        if (persianIndex > -1) return String(persianIndex);
        const arabicIndex = arabic.indexOf(char);
        if (arabicIndex > -1) return String(arabicIndex);
        return char;
      })
      .join('');
  }

  // Prize Code Modal Functionality
  (function initializePrizeCodeModal() {
    const prizeBtn = document.getElementById('prizeCodeBtn');
    const modal = document.getElementById('prizeModal');
    const closeBtn = document.getElementById('prizeModalClose');
    const codeDisplay = document.getElementById('prizeCodeDisplay');

    if (!prizeBtn || !modal || !closeBtn || !codeDisplay) {
      console.warn('Prize code modal elements not found');
      return;
    }

    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    codeDisplay.setAttribute('role', 'status');
    codeDisplay.setAttribute('aria-live', 'polite');

    // Check campaign status and hide button if needed
    async function checkCampaignStatus() {
      try {
        const productId = state.productId || new URLSearchParams(window.location.search).get('id');

        if (!productId) {
          return;
        }

        const response = await fetch(`/api/rewards/product-code?productId=${encodeURIComponent(productId)}`);

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        // Hide button if campaign is inactive OR showButton is false
        if (!data.active || data.showButton === false) {
          prizeBtn.style.display = 'none';
          prizeBtn.setAttribute('hidden', 'true');
          prizeBtn.setAttribute('aria-hidden', 'true');
        } else {
          prizeBtn.style.display = '';
          prizeBtn.removeAttribute('hidden');
          prizeBtn.setAttribute('aria-hidden', 'false');
        }
      } catch (error) {
        console.error('Error checking campaign status:', error);
        // On error, keep button visible to avoid breaking existing functionality
      }
    }

    // Check status when page loads
    checkCampaignStatus();

    function toPersianDigits(code) {
      if (!code) return '';
      return String(code)
        .split('')
        .map(char => {
          const digit = parseInt(char, 10);
          return !isNaN(digit) ? persianDigits[digit] : char;
        })
        .join('');
    }

    async function fetchPrizeCode() {
      const productId = state.productId || new URLSearchParams(window.location.search).get('id');

      if (!productId) {
        throw new Error('شناسه محصول یافت نشد');
      }

      const response = await fetch(`/api/rewards/product-code?productId=${encodeURIComponent(productId)}`);

      if (!response.ok) {
        throw new Error(`خطا در دریافت کد: ${response.status}`);
      }

      const data = await response.json();
      return data;
    }

    function revealPrizeCode() {
      codeDisplay.innerHTML = '<div class="prize-loading">در حال دریافت کد جایزه...</div>';

      fetchPrizeCode()
        .then(data => {
          if (!data.active) {
            codeDisplay.innerHTML = `
              <div class="prize-error">${data.message || 'کمپین جوایز در حال حاضر فعال نیست.'}</div>
            `;
            return;
          }

          if (!data.code) {
            codeDisplay.innerHTML = `
              <div class="prize-error">${data.message || 'این صفحه کد جایزه نداره، باید بری صفحه های دیگه رو بگردی'}</div>
            `;
            return;
          }

          const persianCode = toPersianDigits(data.code);
          codeDisplay.innerHTML = `
            <div class="prize-code-label">کد جایزه این محصول:</div>
            <div class="prize-code-value" aria-live="polite">${persianCode}</div>
          `;
          codeDisplay.setAttribute('data-code', data.code);
        })
        .catch(error => {
          console.error('Error fetching prize code:', error);
          codeDisplay.innerHTML = `
            <div class="prize-error">خطا در دریافت کد جایزه. لطفاً دوباره تلاش کنید.</div>
          `;
        });
    }

    function openModal() {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      revealPrizeCode();
      prizeBtn.blur();
    }

    function closeModal() {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      prizeBtn.focus({ preventScroll: true });
    }

    prizeBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });
  })();
})();

// ===== Message to Seller Feature =====
(function initMessageToSeller() {
  'use strict';

  const messageBtn = document.getElementById('messageSellerButton');
  const messageModal = document.getElementById('messageModal');
  const messageModalClose = document.getElementById('messageModalClose');
  const messageCancelBtn = document.getElementById('messageCancelBtn');
  const messageSendBtn = document.getElementById('messageSendBtn');
  const messageText = document.getElementById('messageText');
  const messageCharCount = document.getElementById('messageCharCount');
  const messageSuccess = document.getElementById('messageSuccess');
  const messageError = document.getElementById('messageError');
  const messageErrorText = document.getElementById('messageErrorText');
  const messageLoginPrompt = document.getElementById('messageLoginPrompt');
  const messageFormContainer = document.getElementById('messageFormContainer');
  const messageModalFooter = document.getElementById('messageModalFooter');
  const messageFooterHint = document.getElementById('messageFooterHint');
  const messageProductImage = document.getElementById('messageProductImage');
  const messageProductTitle = document.getElementById('messageProductTitle');
  const messageProductSeller = document.getElementById('messageProductSeller');
  const messageSendText = document.getElementById('messageSendText');
  const messageSendIcon = document.getElementById('messageSendIcon');
  const successPopup = document.getElementById('successPopup');
  const successPopupClose = document.getElementById('successPopupClose');

  if (!messageBtn || !messageModal) return;

  const messageState = {
    productId: null,
    sellerId: null,
    productTitle: '',
    sellerName: '',
    productImage: '',
    isLoggedIn: false,
    isSending: false
  };

  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  function toPersianNumber(num) {
    return String(num).replace(/\d/g, d => persianDigits[d]);
  }

  // Check if user is logged in using backend endpoints (httpOnly cookies aren't readable on client)
  async function checkUserLogin() {
    try {
      // اول کاربر عادی را بررسی می‌کنیم
      const userRes = await fetch('/api/auth/getCurrentUser', {
        credentials: 'include'
      });
      if (userRes.ok) {
        return true;
      }

      // سپس فروشنده (برای مواقعی که فروشنده در حال مشاهده صفحه است)
      const sellerRes = await fetch('/api/auth/getCurrentSeller', {
        credentials: 'include'
      });
      return sellerRes.ok;
    } catch (error) {
      console.error('checkUserLogin error:', error);
      return false;
    }
  }

  // Update character count
  function updateCharCount() {
    const length = messageText.value.length;
    const maxLength = 1000;
    messageCharCount.textContent = `${toPersianNumber(length)} / ${toPersianNumber(maxLength)}`;
    
    messageCharCount.classList.remove('is-warning', 'is-error');
    if (length >= maxLength) {
      messageCharCount.classList.add('is-error');
    } else if (length >= maxLength * 0.9) {
      messageCharCount.classList.add('is-warning');
    }

    // Enable/disable send button
    messageSendBtn.disabled = length === 0 || messageState.isSending || !messageState.isLoggedIn;
  }

  // Open message modal
  async function openMessageModal() {
    if (!messageModal) return;

    // Get product data from analytics state or existing messageState
    const analyticsState = window.__PRODUCT_ANALYTICS__ || {};
    messageState.productId = messageState.productId || analyticsState.item_id || new URLSearchParams(window.location.search).get('id');
    messageState.sellerId = messageState.sellerId || analyticsState.seller_id || '';
    messageState.productTitle = messageState.productTitle || analyticsState.item_name || document.getElementById('productTitle')?.textContent || '';
    messageState.sellerName = messageState.sellerName || analyticsState.shop_name || document.getElementById('productSeller')?.textContent || '';
    
    // Get product image
    const sliderImage = document.querySelector('.slide.is-active img, .slide img');
    messageState.productImage = sliderImage?.src || '/assets/images/placeholder.png';

    // Update modal content
    messageProductTitle.textContent = messageState.productTitle || 'محصول';
    messageProductSeller.textContent = `فروشنده: ${messageState.sellerName || 'نامشخص'}`;
    messageProductImage.src = messageState.productImage;
    messageProductImage.alt = messageState.productTitle;

    // Reset auth-related UI until نتیجه بررسی مشخص شود
    messageState.isLoggedIn = false;
    messageLoginPrompt.hidden = true;
    messageFormContainer.hidden = true;
    messageModalFooter.hidden = false;
    messageModalFooter.classList.remove('is-locked');
    if (messageFooterHint) {
      const footerHintText = messageFooterHint.querySelector('span');
      if (footerHintText) {
        footerHintText.textContent = '';
      }
      messageFooterHint.hidden = true;
    }

    // Reset form
    messageText.value = '';
    updateCharCount();
    messageSuccess.hidden = true;
    messageError.hidden = true;
    messageSendBtn.disabled = true;
    messageSendBtn.classList.remove('is-loading');
    messageSendText.textContent = 'ارسال پیام';

    // Show modal
    messageModal.hidden = false;
    requestAnimationFrame(() => {
      messageModal.classList.add('is-visible');
      messageModal.removeAttribute('aria-hidden');
    });
    document.body.classList.add('modal-open');

    // Check login status using backend (کوکی‌های httpOnly در دسترس JS نیستند)
    const isLoggedIn = await checkUserLogin();
    messageState.isLoggedIn = isLoggedIn;

    if (isLoggedIn) {
      messageLoginPrompt.hidden = true;
      messageFormContainer.hidden = false;
      messageModalFooter.hidden = false;
      messageModalFooter.classList.remove('is-locked');
      if (messageFooterHint) {
        messageFooterHint.hidden = true;
      }
      setTimeout(() => messageText.focus(), 100);
    } else {
      messageLoginPrompt.hidden = false;
      messageFormContainer.hidden = true;
      messageModalFooter.hidden = false;
      messageModalFooter.classList.add('is-locked');
      messageSendBtn.disabled = true;
      if (messageFooterHint) {
        const footerHintText = messageFooterHint.querySelector('span');
        if (footerHintText) {
          footerHintText.textContent = 'برای ارسال پیام باید وارد حساب کاربری شوید.';
        }
        messageFooterHint.hidden = false;
      }
    }

    updateCharCount();
  }

  // Close message modal
  function closeMessageModal() {
    if (!messageModal) return;
    
    messageModal.classList.remove('is-visible');
    messageModal.setAttribute('aria-hidden', 'true');
    
    setTimeout(() => {
      messageModal.hidden = true;
    }, 200);
    
    document.body.classList.remove('modal-open');
    messageBtn.focus({ preventScroll: true });
  }

  // Send message
  async function sendMessage() {
    if (messageState.isSending || !messageText.value.trim()) return;

    if (!messageState.isLoggedIn) {
      showError('برای ارسال پیام باید وارد شوید.');
      return;
    }

    const text = messageText.value.trim();
    if (!text) {
      showError('لطفاً متن پیام را وارد کنید.');
      return;
    }

    if (!messageState.productId) {
      showError('شناسه محصول یافت نشد.');
      return;
    }

    messageState.isSending = true;
    messageSendBtn.disabled = true;
    messageSendBtn.classList.add('is-loading');
    messageSendText.textContent = 'در حال ارسال...';
    messageSendIcon.innerHTML = '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10"/>';
    messageSuccess.hidden = true;
    messageError.hidden = true;

    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          text: text,
          productId: messageState.productId,
          sellerId: messageState.sellerId || null,
          recipientRole: 'seller'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'خطا در ارسال پیام');
      }

      // Success - نمایش پاپ‌آپ موفقیت
      messageText.value = '';
      updateCharCount();
      
      // بستن مدال پیام
      closeMessageModal();
      
      // نمایش پاپ‌آپ موفقیت
      setTimeout(() => {
        showSuccessPopup();
      }, 300);

    } catch (error) {
      console.error('Send message error:', error);
      showError(error.message || 'خطا در ارسال پیام. لطفاً دوباره تلاش کنید.');
    } finally {
      messageState.isSending = false;
      messageSendBtn.classList.remove('is-loading');
      messageSendText.textContent = 'ارسال پیام';
      messageSendIcon.innerHTML = '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      updateCharCount();
    }
  }

  function showError(message) {
    messageError.hidden = false;
    messageErrorText.textContent = message;
  }

  // Show success popup
  function showSuccessPopup() {
    if (!successPopup) return;
    
    successPopup.hidden = false;
    requestAnimationFrame(() => {
      successPopup.classList.add('is-visible');
    });
    document.body.classList.add('modal-open');
    
    // Auto close after 4 seconds
    setTimeout(() => {
      closeSuccessPopup();
    }, 4000);
  }

  // Close success popup
  function closeSuccessPopup() {
    if (!successPopup) return;
    
    successPopup.classList.remove('is-visible');
    setTimeout(() => {
      successPopup.hidden = true;
      document.body.classList.remove('modal-open');
    }, 300);
  }

  // Event listeners
  messageBtn.addEventListener('click', openMessageModal);
  messageModalClose.addEventListener('click', closeMessageModal);
  messageCancelBtn.addEventListener('click', closeMessageModal);
  messageSendBtn.addEventListener('click', sendMessage);
  
  messageText.addEventListener('input', updateCharCount);
  messageText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey && !messageSendBtn.disabled) {
      sendMessage();
    }
  });

  // Close on backdrop click
  messageModal.addEventListener('click', (e) => {
    if (e.target === messageModal) {
      closeMessageModal();
    }
  });

  // Success popup close button
  if (successPopupClose) {
    successPopupClose.addEventListener('click', closeSuccessPopup);
  }

  // Close success popup on backdrop click
  if (successPopup) {
    successPopup.addEventListener('click', (e) => {
      if (e.target === successPopup) {
        closeSuccessPopup();
      }
    });
  }

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && successPopup && successPopup.classList.contains('is-visible')) {
      closeSuccessPopup();
      return;
    }
    if (e.key === 'Escape' && messageModal.classList.contains('is-visible')) {
      closeMessageModal();
    }
  });

  // Listen for product data updates to enable button
  document.addEventListener('product:updated', (event) => {
    const detail = event?.detail || {};
    const state = detail.state || {};
    
    if (state.seller_id || state.item_id) {
      messageBtn.disabled = false;
      messageState.sellerId = state.seller_id;
      messageState.productId = state.item_id;
      messageState.productTitle = state.item_name || '';
      messageState.sellerName = state.shop_name || '';
    }
  });

  // Check if product data is already available
  const existingState = window.__PRODUCT_ANALYTICS__ || {};
  if (existingState.item_id) {
    messageBtn.disabled = false;
    messageState.productId = existingState.item_id;
    messageState.sellerId = existingState.seller_id;
  }
})();
