const HOME_ROWS_ENDPOINT = '/api/home/rows';
const HOME_ROWS_REFRESH_INTERVAL = 45000;

class HomeRowsRenderer {
  constructor(rootElement) {
    this.root = rootElement;
    this.container = this.root?.querySelector('[data-home-rows]') || null;
    this.statusEl = this.root?.querySelector('[data-home-rows-status]') || null;
    this.rows = [];
    this.refreshTimer = null;
    this.isLoading = false;
    this.init();
  }

  init() {
    if (!this.root || !this.container) {
      return;
    }
    this.renderSkeleton();
    this.fetchAndRender();
    this.startAutoRefresh();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.fetchAndRender(true);
      }
    });
  }

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(() => {
      this.fetchAndRender(true);
    }, HOME_ROWS_REFRESH_INTERVAL);
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async fetchAndRender(silent = false) {
    if (!silent) {
      this.isLoading = true;
      this.renderSkeleton();
      this.updateStatus('در حال بارگذاری...', 'info');
    }
    try {
      const response = await fetch(HOME_ROWS_ENDPOINT, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('خطا در دریافت اطلاعات ردیف‌ها.');
      }
      const rows = await response.json();
      if (Array.isArray(rows)) {
        this.rows = rows;
        this.renderRows();
        if (!silent) {
          this.updateStatus('آخرین به‌روزرسانی انجام شد.', 'success', true);
        } else {
          this.hideStatus();
        }
      }
    } catch (err) {
      this.updateStatus(err.message || 'اتصال به سرور ممکن نشد.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  renderSkeleton() {
    if (!this.container) return;
    this.container.innerHTML = '';
    const skeleton = document.createElement('div');
    skeleton.className = 'dynamic-home-row is-loading';
    skeleton.setAttribute('aria-hidden', 'true');
    skeleton.innerHTML = `
      <div class="dynamic-home-row__header">
        <div class="dynamic-home-row__title placeholder"></div>
        <div class="dynamic-home-row__meta placeholder"></div>
      </div>
      <div class="dynamic-home-row__cards">
        ${Array.from({ length: 3 }).map(() => '<div class="dynamic-home-card placeholder"></div>').join('')}
      </div>
    `;
    this.container.appendChild(skeleton);
  }

  renderRows() {
    if (!this.container) return;
    this.container.innerHTML = '';

    if (!this.rows.length) {
      const empty = document.createElement('div');
      empty.className = 'dynamic-home-rows-empty';
      empty.textContent = 'به‌زودی ردیف‌های ویژه اینجا نمایش داده می‌شوند.';
      this.container.appendChild(empty);
      return;
    }

    this.rows
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .forEach((row) => {
        const element = this.createRowElement(row);
        this.container.appendChild(element);
      });
  }

  createRowElement(row) {
    const wrapper = document.createElement('section');
    wrapper.className = 'dynamic-home-row';
    wrapper.dataset.rowId = row.id;
    wrapper.setAttribute('aria-label', row.title || 'ردیف');

    const header = document.createElement('div');
    header.className = 'dynamic-home-row__header';

    const title = document.createElement('h3');
    title.className = 'dynamic-home-row__title';
    title.textContent = row.title || '';
    header.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'dynamic-home-row__meta';
    meta.textContent = `${row.cards?.length || 0} کارت`;
    header.appendChild(meta);

    wrapper.appendChild(header);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'dynamic-home-row__cards';

    const cards = Array.isArray(row.cards) ? row.cards : [];
    cards.slice(0, 6).forEach((card) => {
      const cardEl = this.createCardElement(card);
      cardsContainer.appendChild(cardEl);
    });

    wrapper.appendChild(cardsContainer);

    return wrapper;
  }

  createCardElement(card) {
    const link = document.createElement('a');
    link.className = 'dynamic-home-card';
    const href = typeof card.linkUrl === 'string' ? card.linkUrl : '#';
    link.href = href || '#';
    link.setAttribute('aria-label', card.title || 'کارت');
    if (href.startsWith('http')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }

    const media = document.createElement('div');
    media.className = 'dynamic-home-card__media';
    if (card.imageUrl) {
      const img = document.createElement('img');
      img.src = card.imageUrl;
      img.alt = card.title || '';
      img.loading = 'lazy';
      media.appendChild(img);
    } else {
      media.classList.add('dynamic-home-card__media--placeholder');
    }
    link.appendChild(media);

    const body = document.createElement('div');
    body.className = 'dynamic-home-card__body';

    if (card.badge) {
      const badge = document.createElement('span');
      badge.className = 'dynamic-home-card__badge';
      badge.textContent = card.badge;
      body.appendChild(badge);
    }

    const title = document.createElement('h4');
    title.className = 'dynamic-home-card__title';
    title.textContent = card.title || '';
    body.appendChild(title);

    if (card.description) {
      const description = document.createElement('p');
      description.className = 'dynamic-home-card__description';
      description.textContent = card.description;
      body.appendChild(description);
    }

    body.appendChild(this.buildLinkIndicator());

    link.appendChild(body);
    return link;
  }

  buildLinkIndicator() {
    const indicator = document.createElement('span');
    indicator.className = 'dynamic-home-card__action';
    indicator.textContent = 'مشاهده';
    return indicator;
  }

  updateStatus(message, variant = 'info', autoHide = false) {
    if (!this.statusEl) return;
    this.statusEl.textContent = message;
    this.statusEl.classList.remove('info', 'success', 'error');
    this.statusEl.classList.add(variant);
    this.statusEl.dataset.visible = 'true';
    if (autoHide) {
      setTimeout(() => this.hideStatus(), 4000);
    }
  }

  hideStatus() {
    if (!this.statusEl) return;
    this.statusEl.dataset.visible = 'false';
    this.statusEl.textContent = '';
  }
}

function initHomeRowsRenderer() {
  const root = document.getElementById('homeRowsSection');
  if (!root) return;
  new HomeRowsRenderer(root);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomeRowsRenderer);
} else {
  initHomeRowsRenderer();
}
