// public/js/product-comments.js
// سیستم ثبت و نمایش نظرات محصولات با مدیریت وضعیت

(function initProductComments() {
  'use strict';

  const persianNumberFormatter = new Intl.NumberFormat('fa-IR');
  const STAR_PATH = 'M12 2C12.3 2 12.6 2.2 12.7 2.5L14.7 8.1L20.6 8.6C20.9 8.6 21.2 8.8 21.3 9.1C21.4 9.4 21.3 9.7 21.1 9.9L16.5 13.8L18 19.5C18.1 19.8 18 20.1 17.7 20.3C17.5 20.5 17.2 20.5 16.9 20.4L12 17.3L7.1 20.4C6.8 20.5 6.5 20.5 6.3 20.3C6 20.1 5.9 19.8 6 19.5L7.5 13.8L2.9 9.9C2.7 9.7 2.6 9.4 2.7 9.1C2.8 8.8 3.1 8.6 3.4 8.6L9.3 8.1L11.3 2.5C11.4 2.2 11.7 2 12 2Z';

  const state = {
    productId: null,
    reviews: [],
    page: 1,
    limit: 10,
    hasMore: false,
    totalCount: 0,
    avgRating: 0,
    isLoggedIn: false,
    isLoading: false,
    isModalOpen: false,
    isFormOpen: false,
    selectedRating: 0,
    isSubmitting: false
  };

  // DOM Elements
  const dom = {
    bar: document.getElementById('reviewsBar'),
    barScore: document.getElementById('reviewsBarScore'),
    barStars: document.getElementById('reviewsBarStars'),
    barCount: document.getElementById('reviewsBarCount'),
    modal: document.getElementById('reviewsModal'),
    modalClose: document.getElementById('reviewsModalClose'),
    modalLoggedOut: document.getElementById('reviewsModalLoggedOut'),
    modalWriteBtn: document.getElementById('reviewsModalWriteBtn'),
    modalBody: document.getElementById('reviewsModalBody'),
    modalLoading: document.getElementById('reviewsModalLoading'),
    modalList: document.getElementById('reviewsModalList'),
    modalEmpty: document.getElementById('reviewsModalEmpty'),
    modalLoadMore: document.getElementById('reviewsModalLoadMore'),
    modalLoadMoreBtn: document.getElementById('reviewsModalLoadMoreBtn')
  };

  // ═══════════════════════════════════════════════════════════════
  // API Functions
  // ═══════════════════════════════════════════════════════════════
  async function fetchPublishedComments(page = 1) {
    if (!state.productId) return null;
    
    const response = await fetch(
      `/api/public/comments/${encodeURIComponent(state.productId)}?page=${page}&limit=${state.limit}`,
      { credentials: 'include' }
    );
    
    if (!response.ok) {
      throw new Error('خطا در دریافت نظرات');
    }
    
    return response.json();
  }

  async function submitComment(content, rating) {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        productId: state.productId,
        content,
        rating
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'خطا در ثبت نظر');
    }
    
    return data;
  }

  // ═══════════════════════════════════════════════════════════════
  // Check Login Status
  // ═══════════════════════════════════════════════════════════════
  function checkLoginStatus() {
    try {
      const user = localStorage.getItem('user');
      state.isLoggedIn = !!user;
    } catch (e) {
      state.isLoggedIn = false;
    }
    updateCtaVisibility();
  }

  function updateCtaVisibility() {
    if (dom.modalLoggedOut) dom.modalLoggedOut.hidden = state.isLoggedIn;
    if (dom.modalWriteBtn) dom.modalWriteBtn.hidden = !state.isLoggedIn;
  }

  // ═══════════════════════════���═══════════════════════════════════
  // Render Functions
  // ═══════════════════════════════════════════════════════════════
  function renderStars(container, rating) {
    if (!container) return;
    container.innerHTML = '';
    
    for (let i = 0; i < 5; i++) {
      const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      star.setAttribute('viewBox', '0 0 24 24');
      star.setAttribute('fill', 'currentColor');
      star.classList.add('star-icon');
      star.classList.add(i < rating ? 'star-icon--filled' : 'star-icon--empty');
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', STAR_PATH);
      star.appendChild(path);
      container.appendChild(star);
    }
  }

  function updateSummaryBar() {
    if (dom.barScore) {
      dom.barScore.textContent = state.avgRating > 0 
        ? persianNumberFormatter.format(state.avgRating.toFixed(1))
        : '۰';
    }
    if (dom.barStars) {
      renderStars(dom.barStars, Math.round(state.avgRating));
    }
    if (dom.barCount) {
      dom.barCount.textContent = `(از ${persianNumberFormatter.format(state.totalCount)} نظر)`;
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffDays < 1) return 'امروز';
      if (diffDays < 7) return `${persianNumberFormatter.format(diffDays)} روز پیش`;
      
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(date);
    } catch {
      return '';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function createReviewCard(review) {
    const card = document.createElement('article');
    card.className = 'review-card';

    const userName = review.user?.name || 'کاربر';
    const rating = review.rating || 0;
    const content = review.content || '';
    const date = review.createdAt;
    const initial = userName.charAt(0);

    let starsHtml = '';
    for (let i = 0; i < 5; i++) {
      const filled = i < rating;
      starsHtml += `<svg class="review-card__star${filled ? ' review-card__star--filled' : ' review-card__star--empty'}" viewBox="0 0 24 24" fill="currentColor"><path d="${STAR_PATH}"/></svg>`;
    }

    card.innerHTML = `
      <header class="review-card__header">
        <div class="review-card__avatar">${initial}</div>
        <div class="review-card__info">
          <div class="review-card__top">
            <h3 class="review-card__name">${escapeHtml(userName)}</h3>
            <span class="review-card__date">${formatDate(date)}</span>
          </div>
          <div class="review-card__rating">${starsHtml}</div>
        </div>
      </header>
      <p class="review-card__body">${escapeHtml(content)}</p>
    `;

    return card;
  }

  // ═══════════════════════════════════════════════════════════════
  // Review Form
  // ═══════════════════════════════════════════════════════════════
  function createReviewForm() {
    const form = document.createElement('div');
    form.className = 'review-form';
    form.id = 'reviewForm';
    form.innerHTML = `
      <div class="review-form__header">
        <h3 class="review-form__title">ثبت نظر جدید</h3>
        <button type="button" class="review-form__close" id="reviewFormClose">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      
      <div class="review-form__rating">
        <label class="review-form__label">امتیاز شما:</label>
        <div class="review-form__stars" id="reviewFormStars">
          ${[1,2,3,4,5].map(i => `
            <button type="button" class="review-form__star" data-rating="${i}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="${STAR_PATH}"/></svg>
            </button>
          `).join('')}
        </div>
      </div>
      
      <div class="review-form__content">
        <label class="review-form__label" for="reviewContent">متن نظر:</label>
        <textarea 
          id="reviewContent" 
          class="review-form__textarea" 
          placeholder="نظر خود را درباره این محصول بنویسید..."
          maxlength="1000"
          rows="4"
        ></textarea>
        <span class="review-form__counter"><span id="reviewCharCount">0</span>/1000</span>
      </div>
      
      <div class="review-form__actions">
        <button type="button" class="review-form__cancel" id="reviewFormCancel">انصراف</button>
        <button type="button" class="review-form__submit" id="reviewFormSubmit" disabled>
          <span class="review-form__submit-text">ثبت نظر</span>
          <svg class="review-form__submit-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/>
          </svg>
        </button>
      </div>
      
      <p class="review-form__notice">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        نظر شما پس از تأیید فروشنده نمایش داده خواهد شد.
      </p>
    `;
    return form;
  }

  function showReviewForm() {
    if (state.isFormOpen) return;
    
    let form = document.getElementById('reviewForm');
    if (!form) {
      form = createReviewForm();
      dom.modalBody?.insertBefore(form, dom.modalBody.firstChild);
      setupFormListeners(form);
    }
    
    form.classList.add('is-visible');
    state.isFormOpen = true;
    state.selectedRating = 0;
    
    // Reset form
    const textarea = form.querySelector('#reviewContent');
    if (textarea) textarea.value = '';
    updateFormStars(0);
    updateSubmitButton();
  }

  function hideReviewForm() {
    const form = document.getElementById('reviewForm');
    if (form) {
      form.classList.remove('is-visible');
    }
    state.isFormOpen = false;
    state.selectedRating = 0;
  }

  function setupFormListeners(form) {
    // Star rating
    const starsContainer = form.querySelector('#reviewFormStars');
    if (starsContainer) {
      starsContainer.addEventListener('click', (e) => {
        const star = e.target.closest('.review-form__star');
        if (star) {
          state.selectedRating = parseInt(star.dataset.rating, 10);
          updateFormStars(state.selectedRating);
          updateSubmitButton();
        }
      });
    }

    // Textarea
    const textarea = form.querySelector('#reviewContent');
    const charCount = form.querySelector('#reviewCharCount');
    if (textarea && charCount) {
      textarea.addEventListener('input', () => {
        charCount.textContent = textarea.value.length;
        updateSubmitButton();
      });
    }

    // Close button
    const closeBtn = form.querySelector('#reviewFormClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', hideReviewForm);
    }

    // Cancel button
    const cancelBtn = form.querySelector('#reviewFormCancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', hideReviewForm);
    }

    // Submit button
    const submitBtn = form.querySelector('#reviewFormSubmit');
    if (submitBtn) {
      submitBtn.addEventListener('click', handleSubmitReview);
    }
  }

  function updateFormStars(rating) {
    const stars = document.querySelectorAll('#reviewFormStars .review-form__star');
    stars.forEach((star, index) => {
      star.classList.toggle('is-selected', index < rating);
    });
  }

  function updateSubmitButton() {
    const submitBtn = document.getElementById('reviewFormSubmit');
    const textarea = document.getElementById('reviewContent');
    
    if (submitBtn && textarea) {
      const isValid = state.selectedRating > 0 && textarea.value.trim().length >= 3;
      submitBtn.disabled = !isValid || state.isSubmitting;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Submit Handler
  // ═══════════════════════════════════════════════════════════════
  async function handleSubmitReview() {
    if (state.isSubmitting) return;
    
    const textarea = document.getElementById('reviewContent');
    const submitBtn = document.getElementById('reviewFormSubmit');
    
    if (!textarea || !submitBtn) return;
    
    const content = textarea.value.trim();
    const rating = state.selectedRating;
    
    if (!content || content.length < 3) {
      showToast('لطفاً متن نظر را وارد کنید (حداقل ۳ کاراکتر)', 'error');
      return;
    }
    
    if (rating < 1 || rating > 5) {
      showToast('لطفاً امتیاز خود را انتخاب کنید', 'error');
      return;
    }
    
    state.isSubmitting = true;
    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;
    
    try {
      await submitComment(content, rating);
      
      showToast('نظر شما با موفقیت ثبت شد و پس از تأیید فروشنده نمایش داده می‌شود.', 'success');
      hideReviewForm();
      
    } catch (err) {
      console.error('Failed to submit review:', err);
      showToast(err.message || 'خطا در ثبت نظر. لطفاً دوباره تلاش کنید.', 'error');
    } finally {
      state.isSubmitting = false;
      submitBtn.classList.remove('is-loading');
      updateSubmitButton();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Load Reviews
  // ═══════════════════════════════════════════════════════════════
  async function loadReviews(append = false) {
    if (!state.productId || state.isLoading) return;
    
    state.isLoading = true;
    
    if (!append) {
      if (dom.modalLoading) dom.modalLoading.hidden = false;
      if (dom.modalList) dom.modalList.hidden = true;
      if (dom.modalEmpty) dom.modalEmpty.hidden = true;
    }
    
    try {
      const data = await fetchPublishedComments(state.page);
      
      if (!data) return;
      
      if (append) {
        const newReviews = data.reviews || [];
        newReviews.forEach(review => {
          const card = createReviewCard(review);
          dom.modalList?.appendChild(card);
        });
        state.reviews = [...state.reviews, ...newReviews];
      } else {
        state.reviews = data.reviews || [];
        renderReviewsList();
      }
      
      state.totalCount = data.totalCount || 0;
      state.avgRating = data.avgRating || 0;
      state.hasMore = data.pagination?.hasMore || false;
      
      updateSummaryBar();
      updateLoadMoreButton();
      
    } catch (err) {
      console.error('Failed to load reviews:', err);
      if (!append) {
        if (dom.modalEmpty) dom.modalEmpty.hidden = false;
      }
    } finally {
      state.isLoading = false;
      if (dom.modalLoading) dom.modalLoading.hidden = true;
    }
  }

  function renderReviewsList() {
    if (!dom.modalList) return;
    
    dom.modalList.innerHTML = '';
    
    if (state.reviews.length === 0) {
      if (dom.modalEmpty) dom.modalEmpty.hidden = false;
      if (dom.modalList) dom.modalList.hidden = true;
      return;
    }
    
    if (dom.modalEmpty) dom.modalEmpty.hidden = true;
    if (dom.modalList) dom.modalList.hidden = false;
    
    state.reviews.forEach(review => {
      const card = createReviewCard(review);
      dom.modalList.appendChild(card);
    });
  }

  function updateLoadMoreButton() {
    if (dom.modalLoadMore) {
      dom.modalLoadMore.hidden = !state.hasMore;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Modal Controls
  // ═══════════════════════════════════════════════════════════════
  function openModal() {
    if (!dom.modal) return;
    
    state.isModalOpen = true;
    dom.modal.classList.add('is-open');
    document.body.classList.add('modal-open');
    
    if (state.reviews.length === 0 && state.productId) {
      loadReviews();
    }
  }

  function closeModal() {
    if (!dom.modal) return;
    
    state.isModalOpen = false;
    dom.modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    hideReviewForm();
  }

  // ═══════════════════════════════════════════════════════════════
  // Toast Notification
  // ═══════════════════════════════════════════════════════════════
  function showToast(message, type = 'success') {
    // Remove existing toast
    const existing = document.querySelector('.comment-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `comment-toast comment-toast--${type}`;
    toast.innerHTML = `
      <div class="comment-toast__icon">
        ${type === 'success' 
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        }
      </div>
      <span class="comment-toast__message">${escapeHtml(message)}</span>
    `;
    
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.classList.add('is-visible');
    });
    
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ═══════════════════════════════════════════════════════════════
  // Initialize
  // ═══════════════════════════════════════════════════════════════
  function init() {
    checkLoginStatus();

    // Summary bar click
    if (dom.bar) {
      dom.bar.addEventListener('click', openModal);
      dom.bar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openModal();
        }
      });
    }

    // Modal close
    if (dom.modalClose) {
      dom.modalClose.addEventListener('click', closeModal);
    }

    // Click outside modal
    if (dom.modal) {
      dom.modal.addEventListener('click', (e) => {
        if (e.target === dom.modal) closeModal();
      });
    }

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.isModalOpen) closeModal();
    });

    // Load more
    if (dom.modalLoadMoreBtn) {
      dom.modalLoadMoreBtn.addEventListener('click', () => {
        state.page++;
        loadReviews(true);
      });
    }

    // Write review button
    if (dom.modalWriteBtn) {
      dom.modalWriteBtn.addEventListener('click', showReviewForm);
    }

    // Get product ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    if (productId) {
      state.productId = productId;
      // Fetch summary for bar display
      setTimeout(fetchSummary, 300);
    }

    // Listen for product data updates
    document.addEventListener('product:updated', (event) => {
      const detail = event?.detail?.state || {};
      if (detail.item_id) {
        state.productId = detail.item_id;
        fetchSummary();
      }
    });
  }

  async function fetchSummary() {
    if (!state.productId) return;
    
    try {
      const data = await fetchPublishedComments(1);
      if (data) {
        state.totalCount = data.totalCount || 0;
        state.avgRating = data.avgRating || 0;
        updateSummaryBar();
      }
    } catch (err) {
      console.warn('Failed to fetch summary:', err);
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
