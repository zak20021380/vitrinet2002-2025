(() => {
  // ============================================================================
  // CONFIGURATION - PRESERVED FROM ORIGINAL
  // ============================================================================
  const resolveApiBase = () => {
    const base = window.__API_BASE__ || window.API_BASE || '';
    if (!base) return '';
    const trimmed = String(base).trim();
    return trimmed.replace(/\/+$/, '');
  };

  const API_BASE = resolveApiBase();

  const withApiBase = (path) => {
    const suffix = path.startsWith('/') ? path : `/${path}`;
    if (!API_BASE) {
      return suffix;
    }
    return `${API_BASE}${suffix}`;
  };

  const ACCOUNTANT_API = withApiBase('/api/accountant');
  const SELLER_API = withApiBase('/api/auth/getCurrentSeller');
  const DASHBOARD_URL = '../seller/dashboard.html';
  const LOGIN_URL = '../seller/login.html';
  const THEME_KEY = 'accountant-preferred-theme';

  const paymentMethodLabels = {
    cash: 'نقدی',
    card: 'کارتخوان',
    transfer: 'کارت به کارت',
    online: 'آنلاین',
    cheque: 'چک',
    other: 'سایر'
  };

  const statusLabels = {
    paid: 'تسویه شده',
    pending: 'در انتظار',
    overdue: 'سررسید گذشته',
    refunded: 'مرجوعی'
  };

  const categoryColors = {
    'فروش محصول': '#10b981',
    'هزینه ثابت': '#ef4444',
    'حقوق و دستمزد': '#f59e0b',
    'تبلیغات': '#8b5cf6',
    'خرید کالا': '#ec4899',
    'عمومی': '#6b7280'
  };

  let categoryChart = null;
  let paymentChart = null;
  const clearFormMessage = () => {
    if (!elements.formMessage) return;
    elements.formMessage.textContent = '';
    elements.formMessage.classList.remove('error', 'success', 'show');
  };

  // ============================================================================
  // DOM ELEMENTS
  // ============================================================================
  const elements = {
    sellerName: document.getElementById('sellerName'),
    entryForm: document.getElementById('entryForm'),
    formMessage: document.getElementById('formMessage'),
    entriesBody: document.getElementById('entriesBody'),
    emptyState: document.getElementById('emptyState'),
    totalIncome: document.getElementById('totalIncome'),
    totalExpense: document.getElementById('totalExpense'),
    totalBalance: document.getElementById('totalBalance'),
    pendingAmount: document.getElementById('pendingAmount'),
    pendingCount: document.getElementById('pendingCount'),
    overdueAmount: document.getElementById('overdueAmount'),
    overdueCount: document.getElementById('overdueCount'),
    paidAmount: document.getElementById('paidAmount'),
    paidCount: document.getElementById('paidCount'),
    totalEntriesCount: document.getElementById('totalEntriesCount'),
    activeFilters: document.getElementById('activeFilters'),
    categoryBreakdown: document.getElementById('categoryBreakdown'),
    paymentBreakdown: document.getElementById('paymentBreakdown'),
    upcomingDueList: document.getElementById('upcomingDueList'),
    filtersForm: document.getElementById('filtersForm'),
    searchInput: document.getElementById('searchQuery'),
    backButton: document.getElementById('backToDashboard'),
    themeToggle: document.getElementById('themeToggle'),
    // Modern UI elements
    fabAdd: document.getElementById('fabAdd'),
    addModal: document.getElementById('addModal'),
    modalClose: document.getElementById('modalClose'),
    filterToggle: document.getElementById('filterToggle'),
    filtersPanel: document.getElementById('filtersPanel'),
    advancedToggle: document.getElementById('advancedToggle'),
    advancedFields: document.getElementById('advancedFields'),
    transactionsList: document.getElementById('transactionsList'),
    navButtons: document.querySelectorAll('.nav-item'),
    categoryChartCanvas: document.getElementById('categoryChart'),
    paymentChartCanvas: document.getElementById('paymentChart'),
    amountInput: document.getElementById('amountInput'),
    entrySubmitButton: document.querySelector('#entryForm button[type="submit"]')
  };

  // ============================================================================
  // UTILITY FUNCTIONS - PRESERVED FROM ORIGINAL
  // ============================================================================
  const formatCurrency = (value) => {
    const numeric = Number(value) || 0;
    try {
      const formatter = new Intl.NumberFormat('fa-IR');
      return `${formatter.format(numeric)} تومان`;
    } catch (error) {
      return `${numeric} تومان`;
    }
  };

  const formatCount = (value = 0) => {
    const numeric = Number(value) || 0;
    try {
      return new Intl.NumberFormat('fa-IR').format(numeric);
    } catch (error) {
      return numeric.toString();
    }
  };

  const formatDateForInput = (date) => {
    const current = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(current.getTime())) return '';
    const tzOffset = current.getTimezoneOffset() * 60000;
    return new Date(current.getTime() - tzOffset).toISOString().split('T')[0];
  };

  const formatDateForDisplay = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    try {
      return date.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return date.toISOString().split('T')[0];
    }
  };

  const showFormMessage = (message, type = 'info') => {
    if (!elements.formMessage) return;
    elements.formMessage.textContent = message;
    elements.formMessage.classList.remove('error', 'success', 'show');
    if (type === 'error') {
      elements.formMessage.classList.add('error');
    } else if (type === 'success') {
      elements.formMessage.classList.add('success');
    }
    elements.formMessage.classList.add('show');
    setTimeout(() => {
      elements.formMessage.classList.remove('show');
    }, 5000);
  };

  const redirectToLogin = () => {
    window.location.href = LOGIN_URL;
  };

  const handleUnauthorized = (message = 'برای ادامه لطفاً وارد حساب کاربری شوید.') => {
    showFormMessage(message, 'error');
    setTimeout(() => {
      redirectToLogin();
    }, 1500);
  };

  // ============================================================================
  // THEME MANAGEMENT - PRESERVED
  // ============================================================================
  const applyTheme = (theme = 'light') => {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nextTheme);

    if (elements.themeToggle) {
      const icon = elements.themeToggle.querySelector('i');
      if (icon) {
        icon.className = nextTheme === 'dark' ? 'ri-moon-clear-line' : 'ri-sun-line';
      }
    }
  };

  const storeThemePreference = (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      /* noop */
    }
  };

  const resolveInitialTheme = () => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch (error) {
      /* ignore */
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  };

  // ============================================================================
  // DATA MANAGEMENT - PRESERVED FROM ORIGINAL
  // ============================================================================
  const parseTags = (value) => {
    if (Array.isArray(value)) {
      return value.filter(Boolean).map((tag) => tag.toString().trim()).filter(Boolean).slice(0, 8);
    }
    if (typeof value !== 'string') return [];
    return value.split(/[،,]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
  };

  const deriveComputedStatus = (entry = {}) => {
    const baseStatus = entry.status || 'paid';
    if (baseStatus === 'paid' || baseStatus === 'refunded') {
      return baseStatus;
    }
    const dueDate = entry.dueDate ? new Date(entry.dueDate) : null;
    if (dueDate && !Number.isNaN(dueDate.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        return 'overdue';
      }
    }
    return baseStatus === 'pending' ? 'pending' : 'paid';
  };

  const normaliseEntryShape = (entry = {}) => {
    const tags = parseTags(entry.tags);
    const computedStatus = deriveComputedStatus(entry);

    return {
      id: entry._id || entry.id || `entry-${Date.now()}`,
      title: entry.title || 'تراکنش بدون عنوان',
      type: entry.type === 'expense' ? 'expense' : 'income',
      amount: Number(entry.amount) || 0,
      description: entry.description || '',
      recordedAt: entry.recordedAt || entry.createdAt || new Date().toISOString(),
      createdAt: entry.createdAt || new Date().toISOString(),
      category: entry.category || 'عمومی',
      paymentMethod: entry.paymentMethod || 'cash',
      status: entry.status || 'paid',
      counterpartyType: entry.counterpartyType || 'other',
      counterpartyName: entry.counterpartyName || '',
      referenceNumber: entry.referenceNumber || '',
      dueDate: entry.dueDate || '',
      tags,
      computedStatus
    };
  };

  const calculateTotals = (entries = []) => {
    return entries.reduce(
      (acc, entry) => {
        const amount = Number(entry.amount) || 0;
        if (entry.type === 'income') {
          acc.income += amount;
        } else if (entry.type === 'expense') {
          acc.expense += amount;
        }
        acc.balance = acc.income - acc.expense;
        return acc;
      },
      { income: 0, expense: 0, balance: 0 }
    );
  };

  const buildDefaultSummary = (entries = []) => ({
    totals: calculateTotals(entries),
    counts: {
      total: entries.length,
      paid: 0,
      pending: 0,
      overdue: 0,
      refunded: 0
    },
    amountsByStatus: {
      paid: 0,
      pending: 0,
      overdue: 0,
      refunded: 0
    },
    categories: [],
    paymentMethods: [],
    upcomingDue: []
  });

  // ============================================================================
  // API FUNCTIONS - PRESERVED FROM ORIGINAL
  // ============================================================================
  const fetchCurrentSeller = async () => {
    try {
      const response = await fetch(SELLER_API, {
        credentials: 'include'
      });

      if (response.status === 401) {
        handleUnauthorized('لطفاً ابتدا وارد حساب کاربری خود شوید.');
        throw new Error('UNAUTHENTICATED');
      }

      if (!response.ok) {
        throw new Error('FAILED_FETCH');
      }

      const data = await response.json();
      return data?.seller || null;
    } catch (error) {
      const isNetworkIssue = error?.message === 'FAILED_FETCH' || error?.name === 'TypeError';
      if (isNetworkIssue) {
        console.warn('Falling back after failing to fetch current seller:', error);
        showFormMessage('امکان برقراری ارتباط با سرور وجود ندارد. لطفاً دوباره تلاش کنید.', 'error');
        return null;
      }

      console.error('Failed to fetch current seller:', error);
      showFormMessage('امکان برقراری ارتباط با سرور وجود ندارد. لطفاً دوباره تلاش کنید.', 'error');
      throw error;
    }
  };

  const buildQueryString = (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      const stringValue = value.toString().trim();
      if (stringValue) {
        searchParams.append(key, stringValue);
      }
    });
    const query = searchParams.toString();
    return query ? `?${query}` : '';
  };

  const fetchEntries = async (filters = {}) => {
    const queryString = buildQueryString(filters);
    try {
      const response = await fetch(`${ACCOUNTANT_API}${queryString}`, {
        credentials: 'include'
      });

      if (response.status === 401) {
        handleUnauthorized('برای مشاهده تراکنش‌ها وارد حساب کاربری شوید.');
        throw new Error('UNAUTHENTICATED');
      }

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: 'خطا در دریافت اطلاعات.' }));
        throw new Error(error.message || 'FAILED_FETCH');
      }

      const data = await response.json();
      const entries = Array.isArray(data.entries)
        ? data.entries.map((entry) => normaliseEntryShape(entry))
        : [];

      return {
        entries,
        summary: data.summary || buildDefaultSummary(entries)
      };
    } catch (error) {
      console.error('Failed to fetch accountant entries:', error);
      throw error;
    }
  };

  const createEntry = async (payload) => {
    try {
      const response = await fetch(ACCOUNTANT_API, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        handleUnauthorized('برای ثبت تراکنش ابتدا وارد حساب خود شوید.');
        const err = new Error('UNAUTHENTICATED');
        err.code = 401;
        throw err;
      }

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: 'خطا در ذخیره‌سازی.' }));
        const err = new Error(error.message || 'FAILED_CREATE');
        err.code = response.status;
        throw err;
      }

      const data = await response.json();
      return normaliseEntryShape(data.entry || payload);
    } catch (error) {
      console.error('Failed to create accountant entry:', error);
      throw error;
    }
  };

  const updateEntry = async (id, payload) => {
    try {
      const response = await fetch(`${ACCOUNTANT_API}/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        handleUnauthorized('برای ویرایش تراکنش ابتدا وارد حساب خود شوید.');
        const err = new Error('UNAUTHENTICATED');
        err.code = 401;
        throw err;
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'ویرایش تراکنش با خطا مواجه شد.' }));
        const err = new Error(error.message || 'FAILED_UPDATE');
        err.code = response.status;
        throw err;
      }

      const data = await response.json();
      return normaliseEntryShape(data.entry || payload);
    } catch (error) {
      console.error('Failed to update accountant entry:', error);
      throw error;
    }
  };

  // ============================================================================
  // RENDERING FUNCTIONS - MODERNIZED
  // ============================================================================
  const updateTotals = (totals = {}) => {
    const income = Number(totals.income) || 0;
    const expense = Number(totals.expense) || 0;
    const balance = income - expense;

    if (elements.totalIncome) elements.totalIncome.textContent = formatCurrency(income);
    if (elements.totalExpense) elements.totalExpense.textContent = formatCurrency(expense);
    if (elements.totalBalance) elements.totalBalance.textContent = formatCurrency(balance);
  };

  const renderStatusSummary = (summary = {}) => {
    const counts = summary.counts || {};
    const amounts = summary.amountsByStatus || {};

    if (elements.pendingAmount) elements.pendingAmount.textContent = formatCount(counts.pending || 0);
    if (elements.overdueAmount) elements.overdueAmount.textContent = formatCount(counts.overdue || 0);
    if (elements.paidCount) elements.paidCount.textContent = formatCount(counts.paid || 0);
  };

  const renderCharts = (summary = {}) => {
    const categories = summary.categories || [];
    const payments = summary.paymentMethods || [];

    // Category Chart
    if (elements.categoryChartCanvas && typeof Chart !== 'undefined') {
      const ctx = elements.categoryChartCanvas.getContext('2d');
      
      if (categoryChart) {
        categoryChart.destroy();
      }

      if (categories.length > 0) {
        categoryChart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: categories.map(c => c.name),
            datasets: [{
              data: categories.map(c => c.total),
              backgroundColor: categories.map(c => categoryColors[c.name] || '#6b7280'),
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                position: 'bottom',
                rtl: true,
                labels: {
                  font: {
                    family: 'Vazirmatn',
                    size: 12
                  },
                  padding: 12,
                  usePointStyle: true,
                  pointStyle: 'circle'
                }
              },
              tooltip: {
                rtl: true,
                textDirection: 'rtl',
                callbacks: {
                  label: function(context) {
                    return formatCurrency(context.parsed);
                  }
                }
              }
            }
          }
        });
      }
    }

    // Payment Chart
    if (elements.paymentChartCanvas && typeof Chart !== 'undefined') {
      const ctx = elements.paymentChartCanvas.getContext('2d');
      
      if (paymentChart) {
        paymentChart.destroy();
      }

      if (payments.length > 0) {
        paymentChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: payments.map(p => paymentMethodLabels[p.method] || 'سایر'),
            datasets: [{
              data: payments.map(p => p.total),
              backgroundColor: '#0ea5e9',
              borderRadius: 8
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'y',
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                rtl: true,
                textDirection: 'rtl',
                callbacks: {
                  label: function(context) {
                    return formatCurrency(context.parsed.x);
                  }
                }
              }
            },
            scales: {
              x: {
                ticks: {
                  font: {
                    family: 'Vazirmatn'
                  }
                }
              },
              y: {
                ticks: {
                  font: {
                    family: 'Vazirmatn',
                    size: 12
                  }
                }
              }
            }
          }
        });
      }
    }
  };

  const renderActiveFilters = (filters = {}) => {
    if (!elements.activeFilters) return;
    elements.activeFilters.innerHTML = '';

    const entries = Object.entries(filters).filter(([, value]) => Boolean(value));
    if (!entries.length) {
      return;
    }

    const filterLabels = {
      type: 'نوع',
      category: 'دسته',
      status: 'وضعیت',
      search: 'جستجو'
    };

    entries.forEach(([key, value]) => {
      const label = filterLabels[key] || key;
      const chip = document.createElement('span');
      chip.className = 'active-filters__chip';
      chip.innerHTML = `<i class="ri-filter-line"></i> ${label}: ${value}`;
      elements.activeFilters.appendChild(chip);
    });
  };

  const handleDeleteEntry = async (id) => {
    if (!id) return;

    const confirmed = window.confirm('آیا از حذف این تراکنش مطمئن هستید؟');
    if (!confirmed) return;

    try {
      const response = await fetch(`${ACCOUNTANT_API}/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'حذف تراکنش با خطا مواجه شد.' }));
        throw new Error(error.message || 'FAILED_DELETE');
      }

      const card = document.getElementById(`card-${id}`);
      if (card) {
        card.style.transition = 'opacity 300ms ease';
        card.style.opacity = '0';
        setTimeout(() => {
          card.remove();
          loadEntries();
        }, 320);
      } else {
        await loadEntries();
      }
    } catch (error) {
      console.error('Failed to delete entry:', error);
      showFormMessage(error?.message || 'امکان حذف تراکنش وجود ندارد.', 'error');
    }
  };

  const handleEditEntry = (entry = {}) => {
    if (!elements.entryForm) return;

    openModal();

    const form = elements.entryForm;
    form.dataset.editingId = entry.id;

    const setValue = (selector, value) => {
      const field = form.querySelector(selector);
      if (field) {
        field.value = value ?? '';
      }
    };

    setValue('input[name="title"]', entry.title || '');
    setValue('input[name="amount"]', entry.amount ?? '');
    setValue('input[name="recordedAt"]', formatDateForInput(entry.recordedAt));
    setValue('select[name="category"]', entry.category || 'عمومی');
    setValue('select[name="paymentMethod"]', entry.paymentMethod || 'cash');
    setValue('select[name="status"]', entry.status || 'paid');
    setValue('input[name="counterpartyType"]', entry.counterpartyType || 'customer');
    setValue('input[name="counterpartyName"]', entry.counterpartyName || '');
    setValue('input[name="referenceNumber"]', entry.referenceNumber || '');
    setValue('input[name="dueDate"]', entry.dueDate ? formatDateForInput(entry.dueDate) : '');
    setValue('input[name="tags"]', Array.isArray(entry.tags) ? entry.tags.join('، ') : entry.tags || '');
    setValue('textarea[name="description"]', entry.description || '');

    const typeInput = form.querySelector(`input[name="type"][value="${entry.type === 'expense' ? 'expense' : 'income'}"]`);
    if (typeInput) {
      typeInput.checked = true;
    }

    if (elements.entrySubmitButton) {
      elements.entrySubmitButton.innerHTML = '<i class="ri-edit-2-line"></i> ویرایش تراکنش';
    }

    if (elements.advancedFields && elements.advancedToggle) {
      elements.advancedFields.classList.add('show');
      elements.advancedToggle.classList.add('active');
    }
  };

  const handleShareEntry = async (entry = {}) => {
    const statusLabel = statusLabels[entry.computedStatus || entry.status] || statusLabels.paid;
    const receiptText = [
      '🧾 رسید تراکنش',
      '----------------------',
      `عنوان: ${entry.title || 'بدون عنوان'}`,
      `مبلغ: ${formatCurrency(entry.amount)}`,
      `تاریخ: ${formatDateForDisplay(entry.recordedAt)}`,
      `دسته: ${entry.category || '-'}`,
      `وضعیت: ${statusLabel || '-'}`,
      '----------------------',
      'مدیریت حسابداری ویترینت'
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'رسید تراکنش',
          text: receiptText
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(receiptText);
        showFormMessage('متن رسید کپی شد', 'success');
        return;
      }

      throw new Error('SHARE_UNAVAILABLE');
    } catch (error) {
      console.error('Failed to share receipt:', error);
      showFormMessage('امکان اشتراک گذاری رسید وجود ندارد.', 'error');
    }
  };

  const renderTransactionCard = (entry) => {
    const card = document.createElement('div');
    card.className = `transaction-card ${entry.type}`;
    card.id = `card-${entry.id}`;

    const header = document.createElement('div');
    header.className = 'transaction-header';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'transaction-title';

    const title = document.createElement('h3');
    title.textContent = entry.title || 'تراکنش';

    const date = document.createElement('div');
    date.className = 'transaction-date';
    date.innerHTML = `<i class="ri-calendar-line"></i> ${formatDateForDisplay(entry.recordedAt)}`;

    titleDiv.appendChild(title);
    titleDiv.appendChild(date);

    const amount = document.createElement('div');
    amount.className = `transaction-amount ${entry.type}`;
    amount.textContent = formatCurrency(entry.amount);

    header.appendChild(titleDiv);
    header.appendChild(amount);

    const details = document.createElement('div');
    details.className = 'transaction-details';

    const categoryBadge = document.createElement('span');
    categoryBadge.className = 'detail-badge';
    categoryBadge.innerHTML = `<i class="ri-bookmark-line"></i> ${entry.category}`;
    details.appendChild(categoryBadge);

    const paymentBadge = document.createElement('span');
    paymentBadge.className = 'detail-badge';
    paymentBadge.innerHTML = `<i class="ri-bank-card-line"></i> ${paymentMethodLabels[entry.paymentMethod] || 'سایر'}`;
    details.appendChild(paymentBadge);

    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge status-${entry.computedStatus || entry.status}`;
    statusBadge.textContent = statusLabels[entry.computedStatus || entry.status] || 'تسویه';
    details.appendChild(statusBadge);

    const footer = document.createElement('div');
    footer.className = 'transaction-footer';

    const actions = document.createElement('div');
    actions.className = 'transaction-actions';

    const shareButton = document.createElement('button');
    shareButton.type = 'button';
    shareButton.className = 'action-button share';
    shareButton.style.color = 'var(--color-primary)';
    shareButton.innerHTML = '<i class="ri-share-forward-line"></i> اشتراک‌گذاری';
    shareButton.onclick = () => handleShareEntry(entry);

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'action-button edit';
    editButton.innerHTML = '<i class="ri-pencil-line"></i> ویرایش';
    editButton.onclick = () => handleEditEntry(entry);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'action-button delete';
    deleteButton.innerHTML = '<i class="ri-delete-bin-6-line"></i> حذف';
    deleteButton.onclick = () => handleDeleteEntry(entry.id);

    actions.appendChild(shareButton);
    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    footer.appendChild(actions);

    card.appendChild(header);
    card.appendChild(details);
    card.appendChild(footer);

    return card;
  };

  const renderEntries = (entries = []) => {
    if (!elements.entriesBody || !elements.emptyState) return;

    elements.entriesBody.innerHTML = '';

    if (!entries.length) {
      elements.emptyState.classList.add('show');
      return;
    }

    elements.emptyState.classList.remove('show');

    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => {
      fragment.appendChild(renderTransactionCard(entry));
    });

    elements.entriesBody.appendChild(fragment);
  };

  const renderSummary = (summary = {}, entries = []) => {
    const totals = summary.totals || calculateTotals(entries);
    updateTotals(totals);
    renderStatusSummary(summary);
    renderCharts(summary);
  };

  // ============================================================================
  // UI INTERACTIONS - MODERN
  // ============================================================================
  const openModal = () => {
    if (elements.addModal) {
      elements.addModal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  };

  const closeModal = () => {
    if (elements.addModal) {
      elements.addModal.classList.remove('show');
      document.body.style.overflow = '';
    }

    resetEntryFormState(true);
    clearFormMessage();
  };

  const toggleFilters = () => {
    if (elements.filtersPanel) {
      elements.filtersPanel.classList.toggle('show');
    }
  };

  const toggleAdvanced = () => {
    if (elements.advancedFields && elements.advancedToggle) {
      elements.advancedFields.classList.toggle('show');
      elements.advancedToggle.classList.toggle('active');
    }
  };

  const setActiveNav = (action) => {
    if (!elements.navButtons?.length) return;
    elements.navButtons.forEach((button) => {
      if (button.dataset.action === action) {
        button.classList.add('is-active');
      } else {
        button.classList.remove('is-active');
      }
    });
  };

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ============================================================================
  // MAIN LOGIC
  // ============================================================================
  const getFiltersFromForm = () => {
    if (!elements.filtersForm) return {};
    const formData = new FormData(elements.filtersForm);

    const filters = {};
    const search = formData.get('search');
    const type = formData.get('type');
    const category = formData.get('category');
    const status = formData.get('status');

    if (search && search.toString().trim()) filters.search = search.toString().trim();
    if (type) filters.type = type;
    if (category) filters.category = category;
    if (status) filters.status = status;

    return filters;
  };

  let currentFilters = {};

  const loadEntries = async () => {
    try {
      const filters = getFiltersFromForm();
      currentFilters = filters;
      renderActiveFilters(filters);

      const { entries, summary } = await fetchEntries(filters);
      renderEntries(entries);
      renderSummary(summary, entries);
    } catch (error) {
      showFormMessage('خطا در دریافت تراکنش‌ها.', 'error');
    }
  };

  const resetEntryFormState = (shouldResetFields = false) => {
    if (!elements.entryForm) return;

    if (shouldResetFields) {
      elements.entryForm.reset();
      setDefaultDateValue();
    }

    delete elements.entryForm.dataset.editingId;

    if (elements.entrySubmitButton) {
      elements.entrySubmitButton.innerHTML = '<i class="ri-save-line"></i> ذخیره تراکنش';
    }

    if (elements.advancedFields && elements.advancedToggle) {
      elements.advancedFields.classList.remove('show');
      elements.advancedToggle.classList.remove('active');
    }
  };

  const setDefaultDateValue = () => {
    const dateInput = document.querySelector('input[name="recordedAt"]');
    if (dateInput) {
      dateInput.value = formatDateForInput(new Date());
    }
  };

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  document.addEventListener('DOMContentLoaded', async () => {
    // Theme
    let activeTheme = resolveInitialTheme();
    applyTheme(activeTheme);

    if (elements.themeToggle) {
      elements.themeToggle.addEventListener('click', () => {
        activeTheme = activeTheme === 'light' ? 'dark' : 'light';
        applyTheme(activeTheme);
        storeThemePreference(activeTheme);
        
        // Redraw charts with new theme
        if (categoryChart) categoryChart.destroy();
        if (paymentChart) paymentChart.destroy();
        loadEntries();
      });
    }

    // Back button
    if (elements.backButton) {
      elements.backButton.addEventListener('click', () => {
        window.location.href = DASHBOARD_URL;
      });
    }

    // FAB button
    if (elements.fabAdd) {
      elements.fabAdd.addEventListener('click', openModal);
    }

    // Modal close
    if (elements.modalClose) {
      elements.modalClose.addEventListener('click', closeModal);
    }

    // Click outside modal to close
    if (elements.addModal) {
      elements.addModal.addEventListener('click', (e) => {
        if (e.target === elements.addModal) {
          closeModal();
        }
      });
    }

    // Filter toggle
    if (elements.filterToggle) {
      elements.filterToggle.addEventListener('click', toggleFilters);
    }

    // Advanced toggle
    if (elements.advancedToggle) {
      elements.advancedToggle.addEventListener('click', toggleAdvanced);
    }

    // Bottom nav
    if (elements.navButtons?.length) {
      elements.navButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const { action } = button.dataset;
          setActiveNav(action);
          
          if (action === 'dashboard') {
            scrollToSection('dashboardSection');
          } else if (action === 'add') {
            openModal();
          } else if (action === 'report') {
            scrollToSection('transactionsSection');
          }
        });
      });
    }

    // Fetch seller
    let seller = null;
    try {
      seller = await fetchCurrentSeller();
    } catch (error) {
      return;
    }

    if (elements.sellerName) {
      const first = seller?.firstname || '';
      const last = seller?.lastname || '';
      const fullName = `${first}${last ? ' ' + last : ''}`.trim();
      elements.sellerName.textContent = fullName || 'فروشنده عزیز';
    }

    // Load entries
    setDefaultDateValue();
    loadEntries();

    // Filters
    if (elements.filtersForm) {
      elements.filtersForm.addEventListener('submit', (event) => {
        event.preventDefault();
        loadEntries();
      });

      elements.filtersForm.addEventListener('change', (event) => {
        if (event.target?.name === 'search') return;
        loadEntries();
      });

      elements.filtersForm.addEventListener('reset', () => {
        setTimeout(() => {
          loadEntries();
        }, 0);
      });
    }

    // Search
    if (elements.searchInput) {
      let debounceTimer;
      elements.searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          loadEntries();
        }, 350);
      });
    }

    // Form submit
    if (elements.entryForm) {
      elements.entryForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearFormMessage();

        const formData = new FormData(elements.entryForm);
        const title = (formData.get('title') || '').toString().trim();
        const type = formData.get('type') === 'expense' ? 'expense' : 'income';
        const amountValue = Number(formData.get('amount'));
        const description = (formData.get('description') || '').toString().trim();
        const recordedAt = formData.get('recordedAt');
        const category = (formData.get('category') || 'عمومی').toString();
        const paymentMethod = (formData.get('paymentMethod') || 'cash').toString();
        const status = (formData.get('status') || 'paid').toString();
        const counterpartyType = (formData.get('counterpartyType') || 'customer').toString();
        const counterpartyName = (formData.get('counterpartyName') || '').toString().trim();
        const referenceNumber = (formData.get('referenceNumber') || '').toString().trim();
        const dueDate = formData.get('dueDate');
        const tagsInput = (formData.get('tags') || '').toString().trim();

        const isEditing = Boolean(elements.entryForm.dataset.editingId);
        const editingId = elements.entryForm.dataset.editingId;

        if (!title) {
          showFormMessage('لطفاً عنوان تراکنش را وارد کنید.', 'error');
          return;
        }

        if (!Number.isFinite(amountValue) || amountValue < 0) {
          showFormMessage('مبلغ نامعتبر است.', 'error');
          return;
        }

        const payload = {
          title,
          type,
          amount: amountValue,
          description: description || undefined,
          recordedAt: recordedAt ? recordedAt : undefined,
          category,
          paymentMethod,
          status,
          counterpartyType,
          counterpartyName: counterpartyName || undefined,
          referenceNumber: referenceNumber || undefined,
          dueDate: dueDate ? dueDate : undefined,
          tags: tagsInput || undefined
        };

        try {
          if (isEditing && editingId) {
            await updateEntry(editingId, payload);
            showFormMessage('تراکنش با موفقیت ویرایش شد! ✓', 'success');
          } else {
            await createEntry(payload);
            showFormMessage('تراکنش با موفقیت ثبت شد! ✓', 'success');
          }

          resetEntryFormState(true);
          await loadEntries();

          // Close modal after success
          setTimeout(() => {
            closeModal();
            clearFormMessage();
          }, 1500);
        } catch (error) {
          const message = error?.message || 'خطا در ذخیره‌سازی.';
          showFormMessage(message, 'error');
        }
      });

      elements.entryForm.addEventListener('reset', () => {
        resetEntryFormState(false);
        setDefaultDateValue();
        clearFormMessage();
      });
    }

    // Keyboard shortcuts
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeModal();
        closeCalculator();
      }
    });

    // ============================================================================
    // CALCULATOR FUNCTIONALITY
    // ============================================================================
    const calculatorModal = document.getElementById('calculatorModal');
    const calculatorToggle = document.getElementById('calculatorToggle');
    const calculatorClose = document.getElementById('calculatorClose');
    const calcResult = document.getElementById('calcResult');
    const calcHistory = document.getElementById('calcHistory');
    const copyResultBtn = document.getElementById('copyResult');
    const calcButtons = document.querySelectorAll('.calc-btn');

    let calcState = {
      currentValue: '0',
      previousValue: '',
      operation: null,
      shouldResetScreen: false
    };

    const openCalculator = () => {
      if (calculatorModal) {
        calculatorModal.classList.add('show');
        document.body.style.overflow = 'hidden';
      }
    };

    const closeCalculator = () => {
      if (calculatorModal) {
        calculatorModal.classList.remove('show');
        if (!elements.addModal?.classList.contains('show')) {
          document.body.style.overflow = '';
        }
      }
    };

    const updateDisplay = () => {
      if (calcResult) {
        calcResult.textContent = formatNumber(calcState.currentValue);
      }
      if (calcHistory) {
        if (calcState.previousValue && calcState.operation) {
          const opSymbol = getOperationSymbol(calcState.operation);
          calcHistory.textContent = `${formatNumber(calcState.previousValue)} ${opSymbol}`;
        } else {
          calcHistory.textContent = '';
        }
      }
    };

    const formatNumber = (num) => {
      const str = (num ?? '0').toString();

      const [rawIntegerPart = '0', rawDecimalPart] = str.split('.');
      const hasDecimal = str.includes('.');
      const sign = rawIntegerPart.startsWith('-') ? '-' : '';
      const integerDigits = rawIntegerPart.replace('-', '') || '0';
      const normalizedDigits = integerDigits.replace(/^0+(?=\d)/, '') || '0';

      if (normalizedDigits.length > 15) {
        const numericValue = parseFloat(str);
        return Number.isFinite(numericValue) ? numericValue.toExponential(8) : str;
      }

      const groupedInteger = normalizedDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const formattedInteger = `${sign}${groupedInteger}`;

      if (hasDecimal) {
        const decimalPart = rawDecimalPart ?? '';
        return `${formattedInteger}.${decimalPart}`;
      }

      return formattedInteger;
    };

    const getOperationSymbol = (operation) => {
      const symbols = {
        add: '+',
        subtract: '−',
        multiply: '×',
        divide: '÷'
      };
      return symbols[operation] || '';
    };

    const handleNumber = (num) => {
      if (calcState.shouldResetScreen) {
        calcState.currentValue = num;
        calcState.shouldResetScreen = false;
      } else {
        if (calcState.currentValue === '0') {
          calcState.currentValue = num;
        } else {
          calcState.currentValue += num;
        }
      }
      updateDisplay();
    };

    const handleDecimal = () => {
      if (calcState.shouldResetScreen) {
        calcState.currentValue = '0.';
        calcState.shouldResetScreen = false;
      } else if (!calcState.currentValue.includes('.')) {
        calcState.currentValue += '.';
      }
      updateDisplay();
    };

    const handleOperation = (nextOperation) => {
      const inputValue = parseFloat(calcState.currentValue);

      if (calcState.previousValue === '') {
        calcState.previousValue = calcState.currentValue;
      } else if (calcState.operation) {
        const result = performCalculation();
        calcState.currentValue = String(result);
        calcState.previousValue = String(result);
      }

      calcState.shouldResetScreen = true;
      calcState.operation = nextOperation;
      updateDisplay();
    };

    const performCalculation = () => {
      const prev = parseFloat(calcState.previousValue);
      const current = parseFloat(calcState.currentValue);

      if (isNaN(prev) || isNaN(current)) return 0;

      switch (calcState.operation) {
        case 'add':
          return prev + current;
        case 'subtract':
          return prev - current;
        case 'multiply':
          return prev * current;
        case 'divide':
          return current !== 0 ? prev / current : 0;
        default:
          return current;
      }
    };

    const handleEquals = () => {
      if (calcState.operation && calcState.previousValue !== '') {
        const result = performCalculation();
        calcState.currentValue = String(result);
        calcState.previousValue = '';
        calcState.operation = null;
        calcState.shouldResetScreen = true;
        updateDisplay();
      }
    };

    const handleClear = () => {
      calcState.currentValue = '0';
      calcState.previousValue = '';
      calcState.operation = null;
      calcState.shouldResetScreen = false;
      updateDisplay();
    };

    const handleDelete = () => {
      if (calcState.currentValue.length > 1) {
        calcState.currentValue = calcState.currentValue.slice(0, -1);
      } else {
        calcState.currentValue = '0';
      }
      updateDisplay();
    };

    const handlePercent = () => {
      const current = parseFloat(calcState.currentValue);
      calcState.currentValue = String(current / 100);
      updateDisplay();
    };

    const handleCopyResult = async () => {
      try {
        await navigator.clipboard.writeText(calcState.currentValue);

        // Visual feedback
        if (copyResultBtn) {
          const originalText = copyResultBtn.innerHTML;
          copyResultBtn.innerHTML = '<i class="ri-check-line"></i> کپی شد';
          copyResultBtn.style.background = '#10b981';
          copyResultBtn.style.color = 'white';

          setTimeout(() => {
            copyResultBtn.innerHTML = originalText;
            copyResultBtn.style.background = '';
            copyResultBtn.style.color = '';
          }, 1500);
        }
      } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = calcState.currentValue;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          if (copyResultBtn) {
            const originalText = copyResultBtn.innerHTML;
            copyResultBtn.innerHTML = '<i class="ri-check-line"></i> کپی شد';
            setTimeout(() => {
              copyResultBtn.innerHTML = originalText;
            }, 1500);
          }
        } catch (err) {
          console.error('Failed to copy:', err);
        }
        document.body.removeChild(textArea);
      }
    };

    // Event Listeners
    if (calculatorToggle) {
      calculatorToggle.addEventListener('click', openCalculator);
    }

    if (calculatorClose) {
      calculatorClose.addEventListener('click', closeCalculator);
    }

    if (calculatorModal) {
      calculatorModal.addEventListener('click', (e) => {
        if (e.target === calculatorModal) {
          closeCalculator();
        }
      });
    }

    if (copyResultBtn) {
      copyResultBtn.addEventListener('click', handleCopyResult);
    }

    // Calculator buttons
    calcButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const { value, action } = button.dataset;

        if (value) {
          handleNumber(value);
        } else if (action) {
          switch (action) {
            case 'clear':
              handleClear();
              break;
            case 'delete':
              handleDelete();
              break;
            case 'percent':
              handlePercent();
              break;
            case 'divide':
            case 'multiply':
            case 'subtract':
            case 'add':
              handleOperation(action);
              break;
            case 'decimal':
              handleDecimal();
              break;
            case 'equals':
              handleEquals();
              break;
          }
        }
      });
    });

    // Keyboard support for calculator
    window.addEventListener('keydown', (event) => {
      if (!calculatorModal?.classList.contains('show')) return;

      const { key } = event;

      if (/^[0-9]$/.test(key)) {
        event.preventDefault();
        handleNumber(key);
      } else if (key === '.') {
        event.preventDefault();
        handleDecimal();
      } else if (key === '+') {
        event.preventDefault();
        handleOperation('add');
      } else if (key === '-') {
        event.preventDefault();
        handleOperation('subtract');
      } else if (key === '*') {
        event.preventDefault();
        handleOperation('multiply');
      } else if (key === '/') {
        event.preventDefault();
        handleOperation('divide');
      } else if (key === 'Enter' || key === '=') {
        event.preventDefault();
        handleEquals();
      } else if (key === 'Backspace') {
        event.preventDefault();
        handleDelete();
      } else if (key === 'Escape') {
        event.preventDefault();
        closeCalculator();
      } else if (key.toLowerCase() === 'c') {
        event.preventDefault();
        handleClear();
      } else if (key === '%') {
        event.preventDefault();
        handlePercent();
      }
    });

    // Initialize calculator display
    updateDisplay();
  });
})();