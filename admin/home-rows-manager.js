const DEFAULT_API_BASE = '/api/home/rows';
const AUTO_REFRESH_INTERVAL = 45000;

class AdminHomeRowsManager {
  constructor(rootSelector, options = {}) {
    this.root = typeof rootSelector === 'string' ? document.querySelector(rootSelector) : rootSelector;
    if (!this.root) {
      return;
    }

    this.apiBase = options.apiBase || DEFAULT_API_BASE;
    this.maxCards = Number(this.root.dataset.maxCards || options.maxCards || 6) || 6;

    this.statusEl = this.root.querySelector('[data-status]');
    this.emptyEl = this.root.querySelector('[data-empty]');
    this.listEl = this.root.querySelector('[data-list]');
    this.addBtn = this.root.querySelector('[data-action="add-row"]');
    this.refreshBtn = this.root.querySelector('[data-action="refresh"]');

    this.editor = document.getElementById('homeRowEditor');
    this.form = document.getElementById('homeRowForm');
    this.titleInput = document.getElementById('homeRowTitle');
    this.cardsContainer = document.getElementById('homeRowCardsContainer');
    this.addCardBtn = this.editor?.querySelector('[data-action="add-card"]');
    this.submitBtn = this.editor?.querySelector('[data-action="submit-editor"]');
    this.cancelBtn = this.editor?.querySelector('[data-action="cancel-editor"]');
    this.closeBtn = this.editor?.querySelector('[data-action="close-editor"]');
    this.subtitleEl = document.getElementById('homeRowEditorSubtitle');
    this.maxCardsLabel = this.editor?.querySelector('[data-max-cards-label]');

    this.confirmDialog = document.getElementById('homeRowConfirm');
    this.confirmMessage = document.getElementById('homeRowConfirmMessage');

    this.rows = [];
    this.formCards = [];
    this.pendingRowIds = new Set();
    this.statusTimeout = null;
    this.autoRefreshHandle = null;
    this.draggedRowId = null;
    this.draggingElement = null;

    this.editingId = null;

    this.init();
  }

  init() {
    if (!this.listEl) {
      return;
    }

    if (this.maxCardsLabel) {
      this.maxCardsLabel.textContent = String(this.maxCards);
    }

    this.bindEvents();
    this.setLoading(true);
    this.refresh({ silent: false });
    this.startAutoRefresh();
  }

  bindEvents() {
    if (this.addBtn) {
      this.addBtn.addEventListener('click', () => this.openEditor());
    }

    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => this.refresh({ silent: false }));
    }

    if (this.form) {
      this.form.addEventListener('submit', (event) => {
        event.preventDefault();
        this.handleFormSubmit();
      });
    }

    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => this.closeEditor());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closeEditor());
    }

    if (this.addCardBtn) {
      this.addCardBtn.addEventListener('click', () => this.addCard());
    }

    if (this.cardsContainer) {
      this.cardsContainer.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const field = target.dataset.field;
        if (!field) return;
        const index = Number(target.dataset.index);
        if (!Number.isInteger(index) || index < 0 || index >= this.formCards.length) return;
        this.formCards[index][field] = target.value;
        if (field === 'title') {
          this.updateCardLegend(index);
          this.validateTitleInput(target);
        }
        if (field === 'linkUrl') {
          this.validateLinkInput(target);
        }
      });

      this.cardsContainer.addEventListener('blur', (event) => {
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          const field = target.dataset.field;
          if (field === 'title') {
            this.validateTitleInput(target);
          } else if (field === 'linkUrl') {
            this.validateLinkInput(target);
          }
        }
      }, true);

      this.cardsContainer.addEventListener('click', (event) => {
        const button = event.target instanceof HTMLElement ? event.target.closest('button[data-action="remove-card"]') : null;
        if (!button) return;
        const index = Number(button.dataset.index);
        if (Number.isInteger(index)) {
          this.removeCard(index);
        }
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.refresh({ silent: true });
      }
    });
  }

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.autoRefreshHandle = setInterval(() => {
      this.refresh({ silent: true });
    }, AUTO_REFRESH_INTERVAL);
  }

  stopAutoRefresh() {
    if (this.autoRefreshHandle) {
      clearInterval(this.autoRefreshHandle);
      this.autoRefreshHandle = null;
    }
  }

  async refresh({ silent = false } = {}) {
    if (!silent) {
      this.setLoading(true);
      this.showStatus('در حال بارگذاری ردیف‌ها...', 'info', { autoHide: false });
    }
    try {
      const rows = await this.fetchJson(this.apiBase);
      if (Array.isArray(rows)) {
        this.rows = rows.map((row) => ({
          ...row,
          cards: Array.isArray(row.cards) ? row.cards : [],
        })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        this.renderRows();
      }
      if (!silent) {
        this.showStatus('لیست به‌روزرسانی شد.', 'success');
      }
    } catch (err) {
      if (!silent) {
        this.showStatus(err.message || 'بارگذاری ردیف‌ها ناموفق بود.', 'error', { autoHide: false });
      }
    } finally {
      if (!silent) {
        this.setLoading(false);
      }
    }
  }

  setLoading(isLoading) {
    if (isLoading) {
      this.root.classList.add('is-loading');
      this.renderSkeleton();
    } else {
      this.root.classList.remove('is-loading');
    }
  }

  renderSkeleton() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';
    this.emptyEl?.setAttribute('hidden', 'hidden');
    for (let i = 0; i < 3; i += 1) {
      const li = document.createElement('li');
      li.className = 'home-rows-item skeleton';
      li.setAttribute('aria-hidden', 'true');
      li.innerHTML = '&nbsp;';
      this.listEl.appendChild(li);
    }
  }

  renderRows() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';

    if (!this.rows.length) {
      this.emptyEl?.removeAttribute('hidden');
      return;
    }

    this.emptyEl?.setAttribute('hidden', 'hidden');

    this.rows.forEach((row, index) => {
      const item = this.createRowItem(row, index);
      this.listEl.appendChild(item);
    });
  }

  createRowItem(row, index) {
    const li = document.createElement('li');
    li.className = 'home-rows-item';
    li.dataset.rowId = row.id;

    if (this.pendingRowIds.has(row.id)) {
      li.classList.add('is-pending');
    }

    const header = document.createElement('div');
    header.className = 'home-row-item-header';
    li.appendChild(header);

    const dragHandle = document.createElement('button');
    dragHandle.type = 'button';
    dragHandle.className = 'home-row-drag-handle';
    dragHandle.setAttribute('data-action', 'drag-handle');
    dragHandle.setAttribute('aria-label', `جابجایی ردیف ${row.title}`);
    dragHandle.draggable = true;
    dragHandle.textContent = '⋮⋮';
    header.appendChild(dragHandle);

    const main = document.createElement('div');
    main.className = 'home-row-item-main';
    header.appendChild(main);

    const title = document.createElement('div');
    title.className = 'home-row-item-title';
    title.textContent = row.title;
    main.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'home-row-item-meta';
    main.appendChild(meta);

    const badge = document.createElement('span');
    badge.className = 'home-row-badge';
    badge.textContent = `${row.cards.length} کارت`;
    meta.appendChild(badge);

    const updatedText = row.updatedAt || row.createdAt;
    if (updatedText) {
      const updated = document.createElement('span');
      updated.textContent = `به‌روزرسانی: ${this.formatDate(updatedText)}`;
      meta.appendChild(updated);
    }

    const cardsPreview = document.createElement('div');
    cardsPreview.className = 'home-row-item-cards';
    row.cards.slice(0, 6).forEach((card) => {
      const chip = document.createElement('span');
      chip.className = 'home-row-card-chip';
      const badgeText = card.badge ? `${card.badge} · ${card.title}` : card.title;
      chip.textContent = badgeText;
      chip.title = card.title || '';
      cardsPreview.appendChild(chip);
    });
    main.appendChild(cardsPreview);

    const actions = document.createElement('div');
    actions.className = 'home-row-item-actions';
    header.appendChild(actions);

    const moveUp = this.createActionButton('بالا', 'move-up', 'ghost');
    moveUp.disabled = index === 0;
    actions.appendChild(moveUp);

    const moveDown = this.createActionButton('پایین', 'move-down', 'ghost');
    moveDown.disabled = index === this.rows.length - 1;
    actions.appendChild(moveDown);

    const editBtn = this.createActionButton('ویرایش', 'edit-row');
    actions.appendChild(editBtn);

    const deleteBtn = this.createActionButton('حذف', 'delete-row', 'danger');
    actions.appendChild(deleteBtn);

    actions.addEventListener('click', (event) => {
      const button = event.target instanceof HTMLElement ? event.target.closest('button[data-action]') : null;
      if (!button) return;
      const action = button.dataset.action;
      if (!action) return;
      event.preventDefault();
      if (action === 'move-up') {
        this.moveRow(row.id, -1);
      } else if (action === 'move-down') {
        this.moveRow(row.id, 1);
      } else if (action === 'edit-row') {
        this.openEditor(row);
      } else if (action === 'delete-row') {
        this.confirmAndDelete(row);
      }
    });

    dragHandle.addEventListener('dragstart', (event) => {
      this.handleDragStart(event, row.id, li);
    });

    dragHandle.addEventListener('dragend', () => {
      this.handleDragEnd();
    });

    li.addEventListener('dragover', (event) => {
      this.handleDragOver(event, row.id, li);
    });

    li.addEventListener('drop', (event) => {
      this.handleDrop(event, row.id, li);
    });

    li.addEventListener('dragleave', () => {
      li.classList.remove('drop-target');
    });

    return li;
  }

  createActionButton(label, action, variant) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = action;
    button.textContent = label;
    if (variant) {
      button.classList.add(variant);
    }
    return button;
  }

  handleDragStart(event, rowId, element) {
    if (!(event instanceof DragEvent)) return;
    this.draggedRowId = rowId;
    this.draggingElement = element;
    element.classList.add('is-dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', rowId);
    }
  }

  handleDragEnd() {
    if (this.draggingElement) {
      this.draggingElement.classList.remove('is-dragging');
      this.draggingElement = null;
    }
    this.draggedRowId = null;
  }

  handleDragOver(event, targetRowId, element) {
    event.preventDefault();
    if (!this.draggedRowId || this.draggedRowId === targetRowId) return;
    element.classList.add('drop-target');
  }

  handleDrop(event, targetRowId, element) {
    event.preventDefault();
    element.classList.remove('drop-target');
    const sourceId = this.draggedRowId || (event.dataTransfer ? event.dataTransfer.getData('text/plain') : null);
    if (!sourceId || sourceId === targetRowId) return;
    const newOrder = this.buildReorderedRows(sourceId, targetRowId);
    if (newOrder) {
      this.commitOrder(newOrder);
    }
    this.handleDragEnd();
  }

  buildReorderedRows(sourceId, targetId) {
    const sourceIndex = this.rows.findIndex((row) => row.id === sourceId);
    const targetIndex = this.rows.findIndex((row) => row.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) {
      return null;
    }
    const next = [...this.rows];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    return next;
  }

  moveRow(rowId, direction) {
    const index = this.rows.findIndex((row) => row.id === rowId);
    if (index === -1) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.rows.length) return;
    const next = [...this.rows];
    const [row] = next.splice(index, 1);
    next.splice(newIndex, 0, row);
    this.commitOrder(next);
  }

  async commitOrder(newRows) {
    const previous = this.rows;
    this.rows = newRows.map((row, order) => ({ ...row, order }));
    this.renderRows();
    this.showStatus('در حال ذخیره ترتیب...', 'info', { autoHide: false });
    try {
      const orderPayload = this.rows.map((row) => row.id);
      const response = await this.fetchJson(`${this.apiBase}/reorder`, {
        method: 'PATCH',
        body: { order: orderPayload },
      });
      if (Array.isArray(response)) {
        this.rows = response;
        this.renderRows();
      }
      this.showStatus('ترتیب ردیف‌ها ذخیره شد.', 'success');
    } catch (err) {
      this.rows = previous;
      this.renderRows();
      this.showStatus(err.message || 'ذخیره ترتیب با خطا مواجه شد.', 'error', { autoHide: false });
    }
  }

  openEditor(row) {
    this.editingId = row?.id || null;
    if (this.submitBtn) {
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = row ? 'ذخیره تغییرات' : 'افزودن ردیف';
    }
    if (this.subtitleEl) {
      this.subtitleEl.textContent = row
        ? 'عنوان ردیف را تغییر دهید و کارت‌ها را به‌روزرسانی کنید.'
        : 'عنوان و کارت‌های ردیف را مشخص کنید.';
    }

    if (this.titleInput) {
      this.titleInput.value = row?.title || '';
      this.titleInput.setCustomValidity('');
    }

    this.formCards = Array.isArray(row?.cards) && row.cards.length
      ? row.cards.map((card) => ({
          id: card.id || null,
          title: card.title || '',
          linkUrl: card.linkUrl || '',
          description: card.description || '',
          imageUrl: card.imageUrl || '',
          badge: card.badge || '',
        }))
      : [this.createEmptyCard()];

    this.renderCardEditors();
    this.updateAddCardState();

    this.openDialog(this.editor);
    if (this.titleInput) {
      this.titleInput.focus();
    }
  }

  closeEditor() {
    this.editingId = null;
    if (this.form) {
      this.form.reset();
    }
    this.formCards = [this.createEmptyCard()];
    this.renderCardEditors();
    this.updateAddCardState();
    this.closeDialog(this.editor);
  }

  createEmptyCard() {
    return {
      id: null,
      title: '',
      linkUrl: '',
      description: '',
      imageUrl: '',
      badge: '',
    };
  }

  renderCardEditors() {
    if (!this.cardsContainer) return;
    this.cardsContainer.innerHTML = '';
    this.formCards.forEach((card, index) => {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'home-row-card-editor';
      fieldset.dataset.index = String(index);

      const legend = document.createElement('legend');
      legend.textContent = `کارت ${index + 1}`;
      fieldset.appendChild(legend);

      const fields = document.createElement('div');
      fields.className = 'card-fields';
      fieldset.appendChild(fields);

      fields.appendChild(this.buildInputGroup({
        id: `card-title-${index}`,
        label: 'عنوان کارت *',
        type: 'text',
        required: true,
        value: card.title,
        field: 'title',
        index,
        maxLength: 140,
        placeholder: 'مثلاً فروش ویژه زمستان',
      }));

      fields.appendChild(this.buildInputGroup({
        id: `card-link-${index}`,
        label: 'لینک کارت *',
        type: 'url',
        required: true,
        value: card.linkUrl,
        field: 'linkUrl',
        index,
        placeholder: 'https://example.com',
      }));

      fields.appendChild(this.buildInputGroup({
        id: `card-badge-${index}`,
        label: 'نشان (اختیاری)',
        type: 'text',
        value: card.badge,
        field: 'badge',
        index,
        maxLength: 60,
        placeholder: 'جدید، ویژه، ...',
      }));

      fields.appendChild(this.buildInputGroup({
        id: `card-image-${index}`,
        label: 'آدرس تصویر (اختیاری)',
        type: 'url',
        value: card.imageUrl,
        field: 'imageUrl',
        index,
        placeholder: 'https://.../image.jpg',
      }));

      const descriptionGroup = document.createElement('div');
      descriptionGroup.className = 'home-row-form-group';
      const descriptionLabel = document.createElement('label');
      descriptionLabel.setAttribute('for', `card-description-${index}`);
      descriptionLabel.textContent = 'توضیح کوتاه (اختیاری)';
      descriptionGroup.appendChild(descriptionLabel);
      const descriptionInput = document.createElement('textarea');
      descriptionInput.id = `card-description-${index}`;
      descriptionInput.rows = 2;
      descriptionInput.dataset.field = 'description';
      descriptionInput.dataset.index = String(index);
      descriptionInput.value = card.description || '';
      descriptionGroup.appendChild(descriptionInput);
      fieldset.appendChild(descriptionGroup);

      const controls = document.createElement('div');
      controls.className = 'home-row-card-controls';
      const hint = document.createElement('span');
      hint.className = 'home-row-input-hint';
      hint.textContent = 'لینک باید با http یا https شروع شود یا مسیر داخلی باشد.';
      controls.appendChild(hint);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.dataset.action = 'remove-card';
      removeBtn.dataset.index = String(index);
      removeBtn.textContent = 'حذف کارت';
      removeBtn.disabled = this.formCards.length <= 1;
      controls.appendChild(removeBtn);

      fieldset.appendChild(controls);
      this.cardsContainer.appendChild(fieldset);
    });
  }

  buildInputGroup({ id, label, type, required = false, value = '', field, index, maxLength, placeholder }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'home-row-form-group';
    const inputLabel = document.createElement('label');
    inputLabel.setAttribute('for', id);
    inputLabel.textContent = label;
    wrapper.appendChild(inputLabel);

    const input = document.createElement('input');
    input.id = id;
    input.type = type;
    input.value = value || '';
    input.dataset.field = field;
    input.dataset.index = String(index);
    if (placeholder) input.placeholder = placeholder;
    if (required) input.required = true;
    if (maxLength) input.maxLength = maxLength;
    wrapper.appendChild(input);

    return wrapper;
  }

  updateCardLegend(index) {
    if (!this.cardsContainer) return;
    const fieldset = this.cardsContainer.querySelector(`fieldset[data-index="${index}"]`);
    if (!fieldset) return;
    const legend = fieldset.querySelector('legend');
    if (!legend) return;
    const card = this.formCards[index];
    const preview = card?.title ? `: ${card.title.slice(0, 18)}` : '';
    legend.textContent = `کارت ${index + 1}${preview}`;
  }

  addCard() {
    if (this.formCards.length >= this.maxCards) return;
    this.formCards.push(this.createEmptyCard());
    this.renderCardEditors();
    this.updateAddCardState();
    if (this.cardsContainer) {
      const lastInput = this.cardsContainer.querySelector('fieldset:last-of-type input[data-field="title"]');
      if (lastInput instanceof HTMLInputElement) {
        lastInput.focus();
      }
    }
  }

  removeCard(index) {
    if (this.formCards.length <= 1) return;
    this.formCards.splice(index, 1);
    this.renderCardEditors();
    this.updateAddCardState();
  }

  updateAddCardState() {
    if (this.addCardBtn) {
      this.addCardBtn.disabled = this.formCards.length >= this.maxCards;
    }
  }

  validateTitleInput(input) {
    const value = (input.value || '').trim();
    if (!value) {
      input.setCustomValidity('عنوان کارت الزامی است.');
    } else {
      input.setCustomValidity('');
    }
    input.reportValidity();
  }

  validateLinkInput(input) {
    const value = (input.value || '').trim();
    if (!value) {
      input.setCustomValidity('لینک کارت الزامی است.');
    } else if (!this.isValidUrl(value)) {
      input.setCustomValidity('آدرس لینک معتبر نیست.');
    } else {
      input.setCustomValidity('');
    }
    input.reportValidity();
  }

  isValidUrl(value) {
    if (value.startsWith('/')) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (err) {
      return false;
    }
  }

  async handleFormSubmit() {
    if (!this.form) return;
    if (this.submitBtn) {
      this.submitBtn.disabled = true;
    }

    const payload = this.buildPayload();
    if (!payload) {
      if (this.submitBtn) this.submitBtn.disabled = false;
      return;
    }

    if (this.editingId) {
      await this.submitUpdate(payload);
    } else {
      await this.submitCreate(payload);
    }

    if (this.submitBtn) {
      this.submitBtn.disabled = false;
    }
  }

  buildPayload() {
    const title = (this.titleInput?.value || '').trim();
    if (this.titleInput) {
      if (!title) {
        this.titleInput.setCustomValidity('عنوان ردیف الزامی است.');
        this.titleInput.reportValidity();
        return null;
      }
      if (this.isDuplicateTitle(title, this.editingId)) {
        this.titleInput.setCustomValidity('این عنوان از قبل استفاده شده است.');
        this.titleInput.reportValidity();
        return null;
      }
      this.titleInput.setCustomValidity('');
    }

    if (!this.formCards.length) {
      this.showStatus('حداقل یک کارت باید تعریف شود.', 'error', { autoHide: false });
      return null;
    }

    const cards = [];
    for (let index = 0; index < this.formCards.length; index += 1) {
      const card = this.formCards[index];
      const titleValue = (card.title || '').trim();
      const linkValue = (card.linkUrl || '').trim();
      if (!titleValue || !linkValue) {
        this.showStatus('تمام کارت‌ها باید عنوان و لینک معتبر داشته باشند.', 'error', { autoHide: false });
        return null;
      }
      if (!this.isValidUrl(linkValue)) {
        this.showStatus('لینک کارت باید معتبر باشد.', 'error', { autoHide: false });
        return null;
      }
      const payload = {
        id: card.id || undefined,
        title: titleValue,
        linkUrl: linkValue,
      };
      if (card.description && card.description.trim()) {
        payload.description = card.description.trim();
      }
      if (card.imageUrl && card.imageUrl.trim()) {
        payload.imageUrl = card.imageUrl.trim();
      }
      if (card.badge && card.badge.trim()) {
        payload.badge = card.badge.trim();
      }
      cards.push(payload);
    }

    if (cards.length > this.maxCards) {
      this.showStatus(`حداکثر ${this.maxCards} کارت مجاز است.`, 'error', { autoHide: false });
      return null;
    }

    return { title, cards };
  }

  isDuplicateTitle(title, currentId) {
    const lowered = title.toLowerCase();
    return this.rows.some((row) => row.title && row.title.toLowerCase() === lowered && row.id !== currentId);
  }

  async submitCreate(payload) {
    const tempRow = {
      id: `temp-${Date.now()}`,
      title: payload.title,
      cards: payload.cards,
      order: this.rows.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.rows = [...this.rows, tempRow];
    this.renderRows();
    this.showStatus('در حال ذخیره ردیف جدید...', 'info', { autoHide: false });
    try {
      const created = await this.fetchJson(this.apiBase, {
        method: 'POST',
        body: payload,
      });
      if (created) {
        this.rows = this.rows.map((row) => (row.id === tempRow.id ? created : row));
        await this.refresh({ silent: true });
        this.renderRows();
      }
      this.showStatus('ردیف جدید با موفقیت اضافه شد.', 'success');
      this.closeEditor();
    } catch (err) {
      this.rows = this.rows.filter((row) => row.id !== tempRow.id);
      this.renderRows();
      this.showStatus(err.message || 'ذخیره ردیف جدید ناموفق بود.', 'error', { autoHide: false });
    }
  }

  async submitUpdate(payload) {
    const rowId = this.editingId;
    if (!rowId) {
      this.showStatus('ردیف انتخاب‌شده یافت نشد.', 'error', { autoHide: false });
      return;
    }
    const index = this.rows.findIndex((row) => row.id === rowId);
    if (index === -1) {
      this.showStatus('ردیف انتخاب‌شده یافت نشد.', 'error', { autoHide: false });
      return;
    }
    const previous = this.rows[index];
    this.pendingRowIds.add(rowId);
    const optimistic = {
      ...previous,
      title: payload.title,
      cards: payload.cards,
      updatedAt: new Date().toISOString(),
    };
    this.rows = this.rows.map((row) => (row.id === rowId ? optimistic : row));
    this.renderRows();
    this.showStatus('در حال ذخیره تغییرات...', 'info', { autoHide: false });
    try {
      const updated = await this.fetchJson(`${this.apiBase}/${rowId}`, {
        method: 'PUT',
        body: payload,
      });
      if (updated) {
        this.rows = this.rows.map((row) => (row.id === rowId ? updated : row));
        await this.refresh({ silent: true });
      }
      this.showStatus('تغییرات ذخیره شد.', 'success');
      this.closeEditor();
    } catch (err) {
      this.rows = this.rows.map((row) => (row.id === rowId ? previous : row));
      this.showStatus(err.message || 'ذخیره تغییرات ناموفق بود.', 'error', { autoHide: false });
    } finally {
      this.pendingRowIds.delete(rowId);
      this.renderRows();
    }
  }

  async confirmAndDelete(row) {
    const confirmed = await this.showConfirm(`با حذف «${row.title}» همه کارت‌های آن نیز حذف می‌شوند.`);
    if (!confirmed) return;
    const previous = [...this.rows];
    this.rows = this.rows.filter((item) => item.id !== row.id);
    this.renderRows();
    this.showStatus('در حال حذف ردیف...', 'info', { autoHide: false });
    try {
      await this.fetchJson(`${this.apiBase}/${row.id}`, {
        method: 'DELETE',
      });
      await this.refresh({ silent: true });
      this.showStatus('ردیف حذف شد.', 'success');
    } catch (err) {
      this.rows = previous;
      this.renderRows();
      this.showStatus(err.message || 'حذف ردیف ناموفق بود.', 'error', { autoHide: false });
    }
  }

  async showConfirm(message) {
    if (this.confirmDialog && typeof this.confirmDialog.showModal === 'function') {
      if (this.confirmMessage) {
        this.confirmMessage.textContent = message;
      }
      this.confirmDialog.showModal();
      return new Promise((resolve) => {
        const handler = () => {
          resolve(this.confirmDialog.returnValue === 'confirm');
        };
        this.confirmDialog.addEventListener('close', handler, { once: true });
      });
    }
    return window.confirm(message);
  }

  showStatus(message, variant = 'info', options = {}) {
    if (!this.statusEl) return;
    const { autoHide = true, duration = 4000 } = options;
    this.statusEl.textContent = message;
    this.statusEl.classList.remove('info', 'success', 'error');
    this.statusEl.classList.add(variant);
    this.statusEl.dataset.visible = 'true';
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
    }
    if (autoHide) {
      this.statusTimeout = setTimeout(() => {
        this.hideStatus();
      }, duration);
    }
  }

  hideStatus() {
    if (!this.statusEl) return;
    this.statusEl.dataset.visible = 'false';
    this.statusEl.textContent = '';
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }
  }

  openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      dialog.setAttribute('open', '');
    }
  }

  closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
      if (dialog.open) {
        dialog.close();
      }
    } else {
      dialog.removeAttribute('open');
    }
  }

  formatDate(value) {
    if (!value) return '';
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch (err) {
      return '';
    }
  }

  async fetchJson(url, { method = 'GET', body } = {}) {
    const options = {
      method,
      credentials: 'include',
      headers: {},
    };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetch(url, options);
    } catch (err) {
      throw new Error('اتصال به سرور برقرار نشد.');
    }

    let data = null;
    if (response.status !== 204) {
      try {
        data = await response.json();
      } catch (err) {
        data = null;
      }
    }

    if (!response.ok) {
      const message = data?.message || 'خطا در پردازش درخواست.';
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return data;
  }
}

function initAdminHomeRowsManager() {
  new AdminHomeRowsManager('#homeRowsManager');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminHomeRowsManager);
} else {
  initAdminHomeRowsManager();
}
