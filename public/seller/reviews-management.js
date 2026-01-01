// public/seller/reviews-management.js
// سیستم مدیریت نظرات محصولات - پنل فروشنده
// نسخه حرفه‌ای با قابلیت تأیید، رد و مسدود کردن کاربر

(function initReviewsManagement() {
  'use strict';

  const API = window.VITRINET_API || {
    buildUrl: (path) => path,
    ensureCredentials(init = {}) {
      if (init.credentials === undefined) {
        return { ...init, credentials: 'include' };
      }
      return init;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════
  const state = {
    comments: [],
    blockedUsers: [],
    currentFilter: 'pending',
    page: 1,
    limit: 20,
    totalCount: 0,
    pendingCount: 0,
    isLoading: false,
    hasMore: false,
    activeModal: null
  };

  // ═══════════════════════════════════════════════════════════════
  // DOM Elements
  // ═══════════════════════════════════════════════════════════════
  let container = null;
  let listEl = null;
  let toastEl = null;
  let modalOverlay = null;

  // ═══════════════════════════════════════════════════════════════
  // API Functions
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * دریافت هدرهای احراز هویت
   * توکن از منابع مختلف خوانده می‌شود:
   * 1. localStorage (برای پنل فروشنده قدیمی)
   * 2. کوکی‌ها به صورت خودکار با credentials: 'include' ارسال می‌شوند
   */
  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    
    // تلاش برای خواندن توکن از localStorage (برای سازگاری با پنل‌های مختلف)
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('seller_token') || 
                  localStorage.getItem('user_token') ||
                  localStorage.getItem('access_token');
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  /**
   * تابع کمکی برای درخواست‌های API با مدیریت خطا
   */
  async function apiRequest(url, options = {}) {
    const defaultOptions = {
      headers: getAuthHeaders()
    };
    
    const finalOptions = API.ensureCredentials({
      ...defaultOptions,
      ...options,
      headers: { ...defaultOptions.headers, ...options.headers }
    });

    const response = await fetch(API.buildUrl(url), finalOptions);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('لطفاً دوباره وارد شوید');
      }
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'دسترسی غیرمجاز');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `خطای سرور (${response.status})`);
    }
    
    return response.json();
  }

  async function fetchComments(filter = 'pending', page = 1) {
    const endpoint = filter === 'pending'
      ? `/api/seller/pending-comments?page=${page}&limit=${state.limit}`
      : `/api/seller/comments?status=${filter}&page=${page}&limit=${state.limit}`;

    return apiRequest(endpoint);
  }

  async function fetchPendingCount() {
    try {
      const data = await apiRequest('/api/seller/pending-comments/count');
      state.pendingCount = data.count || 0;
      updatePendingBadge();
    } catch (err) {
      console.warn('Failed to fetch pending count:', err);
    }
  }

  async function updateCommentStatus(commentId, status, rejectionReason = null) {
    const body = { status };
    if (rejectionReason) body.rejectionReason = rejectionReason;
    
    return apiRequest(`/api/comments/${commentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }

  async function blockUser(userId, reason = null, deleteComments = false) {
    return apiRequest('/api/seller/block-commenter', {
      method: 'POST',
      body: JSON.stringify({ userId, reason, deleteComments })
    });
  }

  async function unblockUser(userId) {
    return apiRequest(`/api/seller/block-commenter/${userId}`, {
      method: 'DELETE'
    });
  }

  async function fetchBlockedUsers() {
    const data = await apiRequest('/api/seller/blocked-commenters');
    return data.blockedUsers || [];
  }


  // ═══════════════════════════════════════════════════════════════
  // Render Functions
  // ═══════════════════════════════════════════════════════════════
  function renderSection() {
    container = document.getElementById('reviewsManagementSection');
    if (!container) return;

    container.innerHTML = `
      <div class="reviews-management-section">
        <header class="reviews-management-section__header">
          <h2 class="reviews-management-section__title">
            <span class="reviews-management-section__title-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C12.3 2 12.6 2.2 12.7 2.5L14.7 8.1L20.6 8.6C20.9 8.6 21.2 8.8 21.3 9.1C21.4 9.4 21.3 9.7 21.1 9.9L16.5 13.8L18 19.5C18.1 19.8 18 20.1 17.7 20.3C17.5 20.5 17.2 20.5 16.9 20.4L12 17.3L7.1 20.4C6.8 20.5 6.5 20.5 6.3 20.3C6 20.1 5.9 19.8 6 19.5L7.5 13.8L2.9 9.9C2.7 9.7 2.6 9.4 2.7 9.1C2.8 8.8 3.1 8.6 3.4 8.6L9.3 8.1L11.3 2.5C11.4 2.2 11.7 2 12 2Z"/>
              </svg>
            </span>
            مدیریت نظرات
            <span class="reviews-pending-badge" id="reviewsPendingBadge" hidden>0</span>
          </h2>
          
          <div class="reviews-header-actions">
            <button type="button" class="reviews-blocked-btn" id="showBlockedUsersBtn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
              کاربران مسدود
            </button>
          </div>
        </header>
        
        <div class="reviews-filter-tabs" id="reviewsFilterTabs">
          <button type="button" class="reviews-filter-tab active" data-filter="pending">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            در انتظار تأیید
            <span class="reviews-filter-tab__count" id="pendingTabCount">0</span>
          </button>
          <button type="button" class="reviews-filter-tab" data-filter="published">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            تأیید شده
          </button>
          <button type="button" class="reviews-filter-tab" data-filter="rejected">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            رد شده
          </button>
        </div>
        
        <div class="reviews-list" id="reviewsList"></div>
        
        <button type="button" class="reviews-load-more-btn" id="loadMoreBtn" hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          بارگذاری بیشتر
        </button>
      </div>
      
      <!-- Modal Overlay -->
      <div class="reviews-modal-overlay" id="reviewsModalOverlay" hidden>
        <div class="reviews-modal" id="reviewsModal"></div>
      </div>
      
      <!-- Toast Notification -->
      <div class="review-toast" id="reviewToast">
        <div class="review-toast__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <span class="review-toast__message" id="reviewToastMessage"></span>
      </div>
    `;

    listEl = document.getElementById('reviewsList');
    toastEl = document.getElementById('reviewToast');
    modalOverlay = document.getElementById('reviewsModalOverlay');

    setupEventListeners();
    loadComments();
    fetchPendingCount();
  }

  function setupEventListeners() {
    // Filter tabs
    const tabsContainer = document.getElementById('reviewsFilterTabs');
    if (tabsContainer) {
      tabsContainer.addEventListener('click', (e) => {
        const tab = e.target.closest('.reviews-filter-tab');
        if (!tab) return;

        const filter = tab.dataset.filter;
        if (filter === state.currentFilter) return;

        tabsContainer.querySelectorAll('.reviews-filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        state.currentFilter = filter;
        state.page = 1;
        state.comments = [];
        loadComments();
      });
    }

    // Load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        state.page++;
        loadComments(true);
      });
    }

    // Blocked users button
    const blockedBtn = document.getElementById('showBlockedUsersBtn');
    if (blockedBtn) {
      blockedBtn.addEventListener('click', showBlockedUsersModal);
    }

    // Action buttons (delegated)
    if (listEl) {
      listEl.addEventListener('click', handleActionClick);
    }

    // Modal overlay click to close
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
      });
    }

    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.activeModal) closeModal();
    });
  }

  async function loadComments(append = false) {
    if (state.isLoading) return;
    state.isLoading = true;

    if (!append) {
      listEl.innerHTML = renderSkeletons(3);
    }

    try {
      const data = await fetchComments(state.currentFilter, state.page);

      if (append) {
        state.comments = [...state.comments, ...(data.comments || [])];
      } else {
        state.comments = data.comments || [];
      }

      state.totalCount = data.pagination?.totalCount || 0;
      state.hasMore = data.pagination?.hasMore || false;

      if (data.pendingCount !== undefined) {
        state.pendingCount = data.pendingCount;
        updatePendingBadge();
      }

      renderComments();
      updateLoadMoreButton();

    } catch (err) {
      console.error('Failed to load comments:', err);
      if (!append) {
        listEl.innerHTML = renderEmptyState('خطا در بارگذاری نظرات. لطفاً دوباره تلاش کنید.');
      }
      showToast(err.message || 'خطا در برقراری ارتباط با سرور', 'error');
    } finally {
      state.isLoading = false;
    }
  }

  function renderComments() {
    if (!state.comments.length) {
      listEl.innerHTML = renderEmptyState(getEmptyMessage());
      listEl.classList.remove('reviews-list--compact');
      return;
    }
    
    // Add compact class for published/rejected tabs
    if (state.currentFilter === 'published' || state.currentFilter === 'rejected') {
      listEl.classList.add('reviews-list--compact');
    } else {
      listEl.classList.remove('reviews-list--compact');
    }
    
    listEl.innerHTML = state.comments.map(renderCommentCard).join('');
  }


  function renderCommentCard(comment) {
    const statusClass = `review-card--${comment.status}`;
    const stars = renderStars(comment.rating);
    const userInitial = (comment.user?.name || 'ک')[0];
    
    let productImage = '/assets/images/placeholder-product.svg';
    if (comment.product?.image) {
      const img = comment.product.image;
      if (img.startsWith('data:') || img.startsWith('http://') || img.startsWith('https://') || img.startsWith('/')) {
        productImage = img;
      } else {
        productImage = `/uploads/products/${img}`;
      }
    }

    const isPending = comment.status === 'pending';
    
    return `
      <article class="review-card ${statusClass}" data-comment-id="${comment.id}" data-user-id="${comment.user?.id || ''}">
        <header class="review-card__header">
          <div class="review-card__user">
            <div class="review-card__avatar">${userInitial}</div>
            <div class="review-card__user-info">
              <span class="review-card__user-name">${escapeHtml(comment.user?.name || 'کاربر')}</span>
              ${comment.user?.phone ? `<span class="review-card__user-phone">${comment.user.phone}</span>` : ''}
            </div>
          </div>
          <div class="review-card__meta">
            <span class="review-card__date">${formatDate(comment.createdAt)}</span>
            <div class="review-card__rating">${stars}</div>
          </div>
        </header>
        
        ${comment.product ? `
          <div class="review-card__product">
            <img src="${productImage}" alt="" class="review-card__product-image" loading="lazy" onerror="this.src='/assets/images/placeholder-product.svg'">
            <span class="review-card__product-title">${escapeHtml(comment.product.title || 'محصول')}</span>
          </div>
        ` : ''}
        
        <p class="review-card__content">${escapeHtml(comment.content)}</p>
        
        ${!isPending && comment.status ? `
          <div class="review-card__status-row">
            <span class="review-card__status review-card__status--${comment.status}">
              ${comment.status === 'published' ? '✓ تأیید شده' : '✕ رد شده'}
            </span>
            ${comment.rejectionReason ? `<span class="review-card__rejection-reason">دلیل: ${escapeHtml(comment.rejectionReason)}</span>` : ''}
          </div>
        ` : ''}
        
        <div class="review-card__actions">
          ${isPending ? `
            <button type="button" class="review-action-btn review-action-btn--approve" data-action="approve" data-id="${comment.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              تأیید
            </button>
            <button type="button" class="review-action-btn review-action-btn--reject" data-action="reject" data-id="${comment.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              رد
            </button>
          ` : ''}
          ${comment.user?.id ? `
            <button type="button" class="review-action-btn review-action-btn--block" data-action="block" data-id="${comment.id}" data-user-id="${comment.user.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
              <span class="review-action-btn__text">مسدود</span>
            </button>
          ` : ''}
        </div>
      </article>
    `;
  }

  function renderStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const filled = i <= rating;
      html += `
        <svg class="review-card__star ${filled ? 'review-card__star--filled' : 'review-card__star--empty'}" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C12.3 2 12.6 2.2 12.7 2.5L14.7 8.1L20.6 8.6C20.9 8.6 21.2 8.8 21.3 9.1C21.4 9.4 21.3 9.7 21.1 9.9L16.5 13.8L18 19.5C18.1 19.8 18 20.1 17.7 20.3C17.5 20.5 17.2 20.5 16.9 20.4L12 17.3L7.1 20.4C6.8 20.5 6.5 20.5 6.3 20.3C6 20.1 5.9 19.8 6 19.5L7.5 13.8L2.9 9.9C2.7 9.7 2.6 9.4 2.7 9.1C2.8 8.8 3.1 8.6 3.4 8.6L9.3 8.1L11.3 2.5C11.4 2.2 11.7 2 12 2Z"/>
        </svg>
      `;
    }
    return html;
  }

  function renderSkeletons(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="review-skeleton">
          <div class="review-skeleton__header">
            <div class="review-skeleton__avatar"></div>
            <div class="review-skeleton__lines">
              <div class="review-skeleton__line"></div>
              <div class="review-skeleton__line"></div>
            </div>
          </div>
          <div class="review-skeleton__content"></div>
          <div class="review-skeleton__actions">
            <div class="review-skeleton__btn"></div>
            <div class="review-skeleton__btn"></div>
          </div>
        </div>
      `;
    }
    return html;
  }

  function renderEmptyState(message) {
    return `
      <div class="reviews-empty-state">
        <div class="reviews-empty-state__icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C12.3 2 12.6 2.2 12.7 2.5L14.7 8.1L20.6 8.6C20.9 8.6 21.2 8.8 21.3 9.1C21.4 9.4 21.3 9.7 21.1 9.9L16.5 13.8L18 19.5C18.1 19.8 18 20.1 17.7 20.3C17.5 20.5 17.2 20.5 16.9 20.4L12 17.3L7.1 20.4C6.8 20.5 6.5 20.5 6.3 20.3C6 20.1 5.9 19.8 6 19.5L7.5 13.8L2.9 9.9C2.7 9.7 2.6 9.4 2.7 9.1C2.8 8.8 3.1 8.6 3.4 8.6L9.3 8.1L11.3 2.5C11.4 2.2 11.7 2 12 2Z"/>
          </svg>
        </div>
        <h3 class="reviews-empty-state__title">${message}</h3>
        <p class="reviews-empty-state__text">نظرات جدید کاربران در این بخش نمایش داده می‌شود.</p>
      </div>
    `;
  }


  // ═══════════════════════════════════════════════════════════════
  // Action Handlers
  // ═══════════════════════════════════════════════════════════════
  async function handleActionClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;

    const action = btn.dataset.action;
    const commentId = btn.dataset.id;
    const userId = btn.dataset.userId;
    const card = btn.closest('.review-card');

    switch (action) {
      case 'approve':
        await handleApprove(commentId, card);
        break;
      case 'reject':
        showRejectModal(commentId, card);
        break;
      case 'block':
        showBlockModal(userId, commentId, card);
        break;
    }
  }

  async function handleApprove(commentId, card) {
    const buttons = card.querySelectorAll('.review-action-btn');
    buttons.forEach(b => b.disabled = true);

    try {
      await updateCommentStatus(commentId, 'published');
      animateCardRemoval(card, commentId);
      showToast('نظر با موفقیت تأیید و منتشر شد', 'success');
    } catch (err) {
      console.error('Failed to approve:', err);
      showToast(err.message || 'خطا در تأیید نظر', 'error');
      buttons.forEach(b => b.disabled = false);
    }
  }

  function showRejectModal(commentId, card) {
    const modal = document.getElementById('reviewsModal');
    modal.innerHTML = `
      <div class="reviews-modal__content">
        <div class="reviews-modal__header">
          <h3 class="reviews-modal__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            رد کردن نظر
          </h3>
          <button type="button" class="reviews-modal__close" onclick="window.ReviewsManagement.closeModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="reviews-modal__body">
          <p class="reviews-modal__desc">آیا از رد کردن این نظر مطمئن هستید؟ این نظر از لیست حذف خواهد شد.</p>
          <div class="reviews-modal__field">
            <label for="rejectReason">دلیل رد (اختیاری)</label>
            <textarea id="rejectReason" placeholder="دلیل رد نظر را وارد کنید..." rows="3"></textarea>
          </div>
        </div>
        <div class="reviews-modal__footer">
          <button type="button" class="reviews-modal__btn reviews-modal__btn--cancel" onclick="window.ReviewsManagement.closeModal()">
            انصراف
          </button>
          <button type="button" class="reviews-modal__btn reviews-modal__btn--reject" id="confirmRejectBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            رد کردن
          </button>
        </div>
      </div>
    `;

    document.getElementById('confirmRejectBtn').onclick = async () => {
      const reason = document.getElementById('rejectReason').value.trim();
      const btn = document.getElementById('confirmRejectBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> در حال پردازش...';

      try {
        await updateCommentStatus(commentId, 'rejected', reason);
        closeModal();
        animateCardRemoval(card, commentId);
        showToast('نظر رد شد', 'error');
      } catch (err) {
        showToast(err.message || 'خطا در رد نظر', 'error');
        btn.disabled = false;
        btn.innerHTML = 'رد کردن';
      }
    };

    openModal();
  }

  function showBlockModal(userId, commentId, card) {
    const modal = document.getElementById('reviewsModal');
    modal.innerHTML = `
      <div class="reviews-modal__content reviews-modal__content--warning">
        <div class="reviews-modal__header">
          <h3 class="reviews-modal__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
            مسدود کردن کاربر
          </h3>
          <button type="button" class="reviews-modal__close" onclick="window.ReviewsManagement.closeModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="reviews-modal__body">
          <div class="reviews-modal__warning-box">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <p>با مسدود کردن این کاربر، او دیگر نمی‌تواند برای محصولات شما نظر ثبت کند.</p>
          </div>
          <div class="reviews-modal__field">
            <label for="blockReason">دلیل مسدودیت (اختیاری)</label>
            <textarea id="blockReason" placeholder="دلیل مسدود کردن کاربر..." rows="2"></textarea>
          </div>
          <div class="reviews-modal__checkbox">
            <input type="checkbox" id="deleteAllComments">
            <label for="deleteAllComments">حذف تمام نظرات این کاربر</label>
          </div>
        </div>
        <div class="reviews-modal__footer">
          <button type="button" class="reviews-modal__btn reviews-modal__btn--cancel" onclick="window.ReviewsManagement.closeModal()">
            انصراف
          </button>
          <button type="button" class="reviews-modal__btn reviews-modal__btn--block" id="confirmBlockBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
            مسدود کردن
          </button>
        </div>
      </div>
    `;

    document.getElementById('confirmBlockBtn').onclick = async () => {
      const reason = document.getElementById('blockReason').value.trim();
      const deleteAll = document.getElementById('deleteAllComments').checked;
      const btn = document.getElementById('confirmBlockBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> در حال پردازش...';

      try {
        const result = await blockUser(userId, reason, deleteAll);
        closeModal();
        
        if (deleteAll && result.deletedComments > 0) {
          // Reload comments if all were deleted
          state.page = 1;
          state.comments = [];
          loadComments();
          showToast(`کاربر مسدود شد و ${result.deletedComments} نظر حذف شد`, 'success');
        } else {
          animateCardRemoval(card, commentId);
          showToast('کاربر با موفقیت مسدود شد', 'success');
        }
      } catch (err) {
        showToast(err.message || 'خطا در مسدود کردن کاربر', 'error');
        btn.disabled = false;
        btn.innerHTML = 'مسدود کردن';
      }
    };

    openModal();
  }

  async function showBlockedUsersModal() {
    const modal = document.getElementById('reviewsModal');
    modal.innerHTML = `
      <div class="reviews-modal__content reviews-modal__content--wide">
        <div class="reviews-modal__header">
          <h3 class="reviews-modal__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
            کاربران مسدود شده
          </h3>
          <button type="button" class="reviews-modal__close" onclick="window.ReviewsManagement.closeModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="reviews-modal__body">
          <div class="blocked-users-loading">
            <span class="spinner"></span>
            در حال بارگذاری...
          </div>
        </div>
      </div>
    `;

    openModal();

    try {
      const blockedUsers = await fetchBlockedUsers();
      const body = modal.querySelector('.reviews-modal__body');

      if (blockedUsers.length === 0) {
        body.innerHTML = `
          <div class="blocked-users-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            <p>هیچ کاربری مسدود نشده است</p>
          </div>
        `;
      } else {
        body.innerHTML = `
          <div class="blocked-users-list">
            ${blockedUsers.map(user => `
              <div class="blocked-user-item" data-user-id="${user.userId}">
                <div class="blocked-user-info">
                  <div class="blocked-user-avatar">${(user.userName || 'ک')[0]}</div>
                  <div class="blocked-user-details">
                    <span class="blocked-user-name">${escapeHtml(user.userName)}</span>
                    ${user.userPhone ? `<span class="blocked-user-phone">${user.userPhone}</span>` : ''}
                    ${user.reason ? `<span class="blocked-user-reason">دلیل: ${escapeHtml(user.reason)}</span>` : ''}
                    <span class="blocked-user-date">مسدود شده در: ${formatDate(user.blockedAt)}</span>
                  </div>
                </div>
                <button type="button" class="blocked-user-unblock" data-user-id="${user.userId}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                    <line x1="12" y1="2" x2="12" y2="12"/>
                  </svg>
                  رفع مسدودیت
                </button>
              </div>
            `).join('')}
          </div>
        `;

        // Add unblock handlers
        body.querySelectorAll('.blocked-user-unblock').forEach(btn => {
          btn.onclick = async () => {
            const userId = btn.dataset.userId;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span>';

            try {
              await unblockUser(userId);
              const item = btn.closest('.blocked-user-item');
              item.style.opacity = '0';
              item.style.transform = 'translateX(-20px)';
              setTimeout(() => {
                item.remove();
                if (body.querySelectorAll('.blocked-user-item').length === 0) {
                  body.innerHTML = `
                    <div class="blocked-users-empty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="8.5" cy="7" r="4"/>
                        <line x1="23" y1="11" x2="17" y2="11"/>
                      </svg>
                      <p>هیچ کاربری مسدود نشده است</p>
                    </div>
                  `;
                }
              }, 300);
              showToast('مسدودیت کاربر برداشته شد', 'success');
            } catch (err) {
              showToast(err.message || 'خطا در رفع مسدودیت', 'error');
              btn.disabled = false;
              btn.innerHTML = 'رفع مسدودیت';
            }
          };
        });
      }
    } catch (err) {
      const body = modal.querySelector('.reviews-modal__body');
      body.innerHTML = `
        <div class="blocked-users-error">
          <p>خطا در بارگذاری لیست</p>
          <button onclick="window.ReviewsManagement.showBlockedUsersModal()">تلاش مجدد</button>
        </div>
      `;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UI Helpers
  // ═══════════════════════════════════════════════════════════════
  function animateCardRemoval(card, commentId) {
    card.style.transition = 'all 0.3s ease';
    card.style.opacity = '0';
    card.style.transform = 'translateX(-20px)';

    setTimeout(() => {
      state.comments = state.comments.filter(c => c.id !== commentId);
      
      if (state.currentFilter === 'pending') {
        state.pendingCount = Math.max(0, state.pendingCount - 1);
        updatePendingBadge();
      }

      if (state.comments.length === 0) {
        renderComments();
      } else {
        card.remove();
      }
    }, 300);
  }

  function openModal() {
    state.activeModal = true;
    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => modalOverlay.classList.add('is-visible'), 10);
  }

  function closeModal() {
    state.activeModal = null;
    modalOverlay.classList.remove('is-visible');
    document.body.style.overflow = '';
    setTimeout(() => {
      modalOverlay.hidden = true;
    }, 300);
  }

  function updatePendingBadge() {
    const badge = document.getElementById('reviewsPendingBadge');
    const tabCount = document.getElementById('pendingTabCount');

    if (badge) {
      badge.textContent = state.pendingCount;
      badge.hidden = state.pendingCount === 0;
    }

    if (tabCount) {
      tabCount.textContent = state.pendingCount;
    }

    // Update sidebar badges
    ['sidebarReviewsBadge', 'desktopReviewsBadge'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = state.pendingCount;
        el.style.display = state.pendingCount === 0 ? 'none' : 'inline-flex';
      }
    });
  }

  function updateLoadMoreButton() {
    const btn = document.getElementById('loadMoreBtn');
    if (btn) btn.hidden = !state.hasMore;
  }

  function showToast(message, type = 'success') {
    if (!toastEl) return;

    const messageEl = document.getElementById('reviewToastMessage');
    if (messageEl) messageEl.textContent = message;

    toastEl.classList.remove('review-toast--success', 'review-toast--error');
    toastEl.classList.add(`review-toast--${type}`);
    toastEl.classList.add('is-visible');

    setTimeout(() => toastEl.classList.remove('is-visible'), 3000);
  }

  function getEmptyMessage() {
    const messages = {
      pending: 'نظری در انتظار تأیید نیست',
      published: 'هنوز نظری تأیید نشده است',
      rejected: 'نظر رد شده‌ای وجود ندارد'
    };
    return messages[state.currentFilter] || 'نظری یافت نشد';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
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

  // ═══════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════
  window.ReviewsManagement = {
    init: renderSection,
    refresh: () => {
      state.page = 1;
      state.comments = [];
      loadComments();
      fetchPendingCount();
    },
    getPendingCount: () => state.pendingCount,
    closeModal,
    showBlockedUsersModal
  };

  // Auto-init - منتظر می‌ماند تا فروشنده لاگین شود
  function tryInit() {
    // بررسی وجود فروشنده در localStorage یا window.seller
    const seller = window.seller || JSON.parse(localStorage.getItem('seller') || '{}');
    const hasValidSeller = seller && (seller.id || seller._id);
    
    if (hasValidSeller && document.getElementById('reviewsManagementSection')) {
      renderSection();
      return true;
    }
    return false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // اول سعی کن init کنی
      if (!tryInit()) {
        // اگر فروشنده هنوز لاگین نشده، منتظر event seller:ready بمان
        document.addEventListener('seller:ready', () => {
          tryInit();
        }, { once: true });
        
        // همچنین هر 500ms چک کن (برای حالت‌هایی که event fire نشود)
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          if (tryInit() || attempts > 20) {
            clearInterval(checkInterval);
          }
        }, 500);
      }
    });
  } else {
    if (!tryInit()) {
      document.addEventListener('seller:ready', () => {
        tryInit();
      }, { once: true });
      
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        if (tryInit() || attempts > 20) {
          clearInterval(checkInterval);
        }
      }, 500);
    }
  }

})();
