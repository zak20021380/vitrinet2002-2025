// public/seller/reviews-management.js
// سیستم مدیریت نظرات محصولات - پنل فروشنده

(function initReviewsManagement() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════
  const state = {
    comments: [],
    currentFilter: 'pending',
    page: 1,
    limit: 20,
    totalCount: 0,
    pendingCount: 0,
    isLoading: false,
    hasMore: false
  };

  // ═══════════════════════════════════════════════════════════════
  // DOM Elements
  // ═══════════════════════════════════════════════════════════════
  let container = null;
  let listEl = null;
  let toastEl = null;

  // ═══════════════════════════════════════════════════════════════
  // API Functions
  // ═══════════════════════════════════════════════════════════════
  
  // Helper to get auth headers
  function getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    // Try to get token from localStorage (seller panel stores it there)
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async function fetchComments(filter = 'pending', page = 1) {
    const endpoint = filter === 'pending'
      ? `/api/seller/pending-comments?page=${page}&limit=${state.limit}`
      : `/api/seller/comments?status=${filter}&page=${page}&limit=${state.limit}`;

    const response = await fetch(endpoint, {
      credentials: 'include',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('لطفاً دوباره وارد شوید');
      }
      throw new Error('خطا در دریافت نظرات');
    }

    return response.json();
  }

  async function fetchPendingCount() {
    try {
      const response = await fetch('/api/seller/pending-comments/count', {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        state.pendingCount = data.count || 0;
        updatePendingBadge();
      }
    } catch (err) {
      console.warn('Failed to fetch pending count:', err);
    }
  }

  async function updateCommentStatus(commentId, status) {
    const response = await fetch(`/api/comments/${commentId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'خطا در تغییر وضعیت نظر');
    }

    return response.json();
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
          
          <div class="reviews-filter-tabs" id="reviewsFilterTabs">
            <button type="button" class="reviews-filter-tab active" data-filter="pending">
              در انتظار تأیید
              <span class="reviews-filter-tab__count" id="pendingTabCount">0</span>
            </button>
            <button type="button" class="reviews-filter-tab" data-filter="published">
              تأیید شده
            </button>
            <button type="button" class="reviews-filter-tab" data-filter="rejected">
              رد شده
            </button>
          </div>
        </header>
        
        <div class="reviews-list" id="reviewsList"></div>
        
        <button type="button" class="review-action-btn review-action-btn--approve" id="loadMoreBtn" hidden style="margin-top: 1rem;">
          بارگذاری بیشتر
        </button>
      </div>
      
      <!-- Toast Notification -->
      <div class="review-toast" id="reviewToast">
        <div class="review-toast__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <span class="review-toast__message" id="reviewToastMessage"></span>
      </div>
    `;

    listEl = document.getElementById('reviewsList');
    toastEl = document.getElementById('reviewToast');

    // Event Listeners
    setupEventListeners();

    // Initial Load
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

        // Update active tab
        tabsContainer.querySelectorAll('.reviews-filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Load new filter
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

    // Action buttons (delegated)
    if (listEl) {
      listEl.addEventListener('click', handleActionClick);
    }
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
      // Show toast for user feedback
      showToast(err.message || 'خطا در برقراری ارتباط با سرور', 'error');
    } finally {
      state.isLoading = false;
    }
  }

  function renderComments() {
    if (!state.comments.length) {
      listEl.innerHTML = renderEmptyState(getEmptyMessage());
      return;
    }

    listEl.innerHTML = state.comments.map(renderCommentCard).join('');
  }

  function renderCommentCard(comment) {
    const statusClass = `review-card--${comment.status}`;
    const statusLabel = getStatusLabel(comment.status);
    const stars = renderStars(comment.rating);
    const userInitial = (comment.user?.name || 'ک')[0];
    const productImage = comment.product?.image 
      ? (comment.product.image.startsWith('/') ? comment.product.image : `/uploads/products/${comment.product.image}`)
      : '/assets/images/placeholder-product.png';

    const actionsHtml = comment.status === 'pending' ? `
      <div class="review-card__actions">
        <button type="button" class="review-action-btn review-action-btn--approve" data-action="approve" data-id="${comment.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          تأیید و انتشار
        </button>
        <button type="button" class="review-action-btn review-action-btn--reject" data-action="reject" data-id="${comment.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          رد کردن
        </button>
      </div>
    ` : '';

    return `
      <article class="review-card ${statusClass}" data-comment-id="${comment.id}">
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
            <img src="${productImage}" alt="" class="review-card__product-image" loading="lazy" onerror="this.src='/assets/images/placeholder-product.png'">
            <span class="review-card__product-title">${escapeHtml(comment.product.title || 'محصول')}</span>
          </div>
        ` : ''}
        
        <p class="review-card__content">${escapeHtml(comment.content)}</p>
        
        ${comment.status !== 'pending' ? `
          <span class="review-card__status review-card__status--${comment.status}">${statusLabel}</span>
        ` : ''}
        
        ${actionsHtml}
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
    const btn = e.target.closest('.review-action-btn[data-action]');
    if (!btn || btn.disabled) return;

    const action = btn.dataset.action;
    const commentId = btn.dataset.id;
    const card = btn.closest('.review-card');

    if (!commentId || !action) return;

    // Disable buttons
    const buttons = card.querySelectorAll('.review-action-btn');
    buttons.forEach(b => {
      b.disabled = true;
      if (b === btn) b.classList.add('is-loading');
    });

    try {
      const status = action === 'approve' ? 'published' : 'rejected';
      await updateCommentStatus(commentId, status);

      // Remove card with animation
      card.style.transition = 'all 0.3s ease';
      card.style.opacity = '0';
      card.style.transform = 'translateX(-20px)';

      setTimeout(() => {
        // Remove from state
        state.comments = state.comments.filter(c => c.id !== commentId);
        
        // Update pending count
        if (state.currentFilter === 'pending') {
          state.pendingCount = Math.max(0, state.pendingCount - 1);
          updatePendingBadge();
        }

        // Re-render or show empty state
        if (state.comments.length === 0) {
          renderComments();
        } else {
          card.remove();
        }
      }, 300);

      // Show toast
      showToast(
        action === 'approve' ? 'نظر با موفقیت تأیید شد' : 'نظر رد شد',
        action === 'approve' ? 'success' : 'error'
      );

    } catch (err) {
      console.error('Failed to update comment:', err);
      showToast(err.message || 'خطا در تغییر وضعیت نظر', 'error');

      // Re-enable buttons
      buttons.forEach(b => {
        b.disabled = false;
        b.classList.remove('is-loading');
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UI Helpers
  // ═══════════════════════════════════════════════════════════════
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

    // Update sidebar badge if exists (mobile)
    const sidebarBadge = document.getElementById('sidebarReviewsBadge');
    if (sidebarBadge) {
      sidebarBadge.textContent = state.pendingCount;
      sidebarBadge.style.display = state.pendingCount === 0 ? 'none' : 'grid';
    }

    // Update desktop sidebar badge
    const desktopBadge = document.getElementById('desktopReviewsBadge');
    if (desktopBadge) {
      desktopBadge.textContent = state.pendingCount;
      desktopBadge.style.display = state.pendingCount === 0 ? 'none' : 'inline-flex';
    }
  }

  function updateLoadMoreButton() {
    const btn = document.getElementById('loadMoreBtn');
    if (btn) {
      btn.hidden = !state.hasMore;
    }
  }

  function showToast(message, type = 'success') {
    if (!toastEl) return;

    const messageEl = document.getElementById('reviewToastMessage');
    if (messageEl) {
      messageEl.textContent = message;
    }

    toastEl.classList.remove('review-toast--success', 'review-toast--error');
    toastEl.classList.add(`review-toast--${type}`);
    toastEl.classList.add('is-visible');

    setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 3000);
  }

  function getStatusLabel(status) {
    const labels = {
      pending: 'در انتظار تأیید',
      published: 'تأیید شده',
      rejected: 'رد شده'
    };
    return labels[status] || status;
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
    getPendingCount: () => state.pendingCount
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('reviewsManagementSection')) {
        renderSection();
      }
    });
  } else {
    if (document.getElementById('reviewsManagementSection')) {
      renderSection();
    }
  }

})();
