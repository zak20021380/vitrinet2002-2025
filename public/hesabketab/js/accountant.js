(() => {
  const ACCESS_KEY = 'vitrinet-accountant-access';
  const ACCOUNTANT_API = '/api/accountant';
  const SELLER_API = '/api/auth/getCurrentSeller';
  const DASHBOARD_URL = '../seller/dashboard.html';
  const LOGIN_URL = '../seller/login.html';

  const paymentMethodLabels = {
    cash: 'نقدی',
    card: 'دستگاه کارتخوان',
    transfer: 'کارت به کارت / حواله',
    online: 'پرداخت آنلاین',
    cheque: 'چک',
    other: 'سایر'
  };

  const statusLabels = {
    paid: 'تسویه شده',
    pending: 'در انتظار پرداخت',
    overdue: 'سررسید گذشته',
    refunded: 'مرجوعی / بازگشتی'
  };

  const statusIcons = {
    paid: 'ri-check-line',
    pending: 'ri-time-line',
    overdue: 'ri-error-warning-line',
    refunded: 'ri-arrow-go-back-line'
  };

  const counterpartyTypeLabels = {
    customer: 'مشتری',
    supplier: 'تأمین‌کننده',
    other: 'سایر'
  };

  const filterDisplayConfig = {
    type: { label: 'نوع', options: { income: 'درآمد', expense: 'هزینه' } },
    category: {
      label: 'دسته‌بندی',
      options: {
        عمومی: 'عمومی',
        'فروش محصول': 'فروش محصول',
        'هزینه ثابت': 'هزینه ثابت',
        'هزینه متغیر': 'هزینه متغیر',
        'حقوق و دستمزد': 'حقوق و دستمزد',
        'تبلیغات و بازاریابی': 'تبلیغات و بازاریابی',
        'هزینه انبار': 'هزینه انبار',
        سایر: 'سایر'
      }
    },
    paymentMethod: { label: 'روش پرداخت', options: paymentMethodLabels },
    status: { label: 'وضعیت', options: statusLabels },
    from: { label: 'از تاریخ' },
    to: { label: 'تا تاریخ' },
    search: { label: 'جستجو' }
  };

  const elements = {
    sellerName: document.getElementById('sellerName'),
    entryForm: document.getElementById('entryForm'),
    amountInput: document.querySelector('input[name="amount"]'),
    dateInput: document.querySelector('input[name="recordedAt"]'),
    dueDateInput: document.querySelector('input[name="dueDate"]'),
    formMessage: document.getElementById('formMessage'),
    entriesBody: document.getElementById('entriesBody'),
    emptyState: document.getElementById('emptyState'),
    entriesTable: document.querySelector('.entries-table'),
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
    filtersSection: document.getElementById('filtersSection'),
    searchInput: document.getElementById('searchQuery'),
    backButton: document.getElementById('backToDashboard'),
    toolbar: document.querySelector('.bottom-toolbar'),
    toolbarButtons: document.querySelectorAll('.bottom-toolbar__button'),
    newEntrySection: document.getElementById('newEntrySection'),
    reportsSection: document.getElementById('reportsSection')
  };

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
    elements.formMessage.classList.remove('error', 'success');
    if (type === 'error') {
      elements.formMessage.classList.add('error');
    } else if (type === 'success') {
      elements.formMessage.classList.add('success');
    }
  };

  const clearFormMessage = () => {
    if (!elements.formMessage) return;
    elements.formMessage.textContent = '';
    elements.formMessage.classList.remove('error', 'success');
  };

  const fetchCurrentSeller = async () => {
    const response = await fetch(SELLER_API, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('UNAUTHENTICATED');
    }

    const data = await response.json();
    return data?.seller || null;
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
    const response = await fetch(`${ACCOUNTANT_API}${queryString}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('FAILED_FETCH');
    }

    const data = await response.json();
    return {
      entries: Array.isArray(data.entries) ? data.entries : [],
      summary: data.summary || {}
    };
  };

  const createEntry = async (payload) => {
    const response = await fetch(ACCOUNTANT_API, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: 'خطا در ذخیره‌سازی اطلاعات.' }));
      const err = new Error(error.message || 'FAILED_CREATE');
      err.code = response.status;
      throw err;
    }

    const data = await response.json();
    return data.entry;
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

  const updateTotals = (totals = {}) => {
    const income = Number(totals.income) || 0;
    const expense = Number(totals.expense) || 0;
    const balance = Number.isFinite(Number(totals.balance))
      ? Number(totals.balance)
      : income - expense;

    if (elements.totalIncome) elements.totalIncome.textContent = formatCurrency(income);
    if (elements.totalExpense) elements.totalExpense.textContent = formatCurrency(expense);
    if (elements.totalBalance) elements.totalBalance.textContent = formatCurrency(balance);
  };

  const renderStatusSummary = (summary = {}) => {
    const counts = summary.counts || {};
    const amounts = summary.amountsByStatus || {};

    if (elements.pendingAmount) elements.pendingAmount.textContent = formatCurrency(amounts.pending || 0);
    if (elements.pendingCount) elements.pendingCount.textContent = formatCount(counts.pending || 0);

    if (elements.overdueAmount) elements.overdueAmount.textContent = formatCurrency(amounts.overdue || 0);
    if (elements.overdueCount) elements.overdueCount.textContent = formatCount(counts.overdue || 0);

    if (elements.paidAmount) elements.paidAmount.textContent = formatCurrency(amounts.paid || 0);
    if (elements.paidCount) elements.paidCount.textContent = formatCount(counts.paid || 0);
  };

  const renderEntriesCount = (count) => {
    if (!elements.totalEntriesCount) return;
    elements.totalEntriesCount.textContent = formatCount(count || 0);
  };

  const renderCategoryBreakdown = (categories = []) => {
    if (!elements.categoryBreakdown) return;
    elements.categoryBreakdown.innerHTML = '';

    if (!Array.isArray(categories) || !categories.length) {
      elements.categoryBreakdown.innerHTML = '<li class="insight-empty">داده‌ای برای نمایش وجود ندارد.</li>';
      return;
    }

    categories.forEach(({ name, total }) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'insight-list__label';
      label.textContent = name || 'نامشخص';

      const value = document.createElement('span');
      value.className = 'insight-list__value';
      value.textContent = formatCurrency(total || 0);

      li.append(label, value);
      elements.categoryBreakdown.appendChild(li);
    });
  };

  const renderPaymentBreakdown = (payments = []) => {
    if (!elements.paymentBreakdown) return;
    elements.paymentBreakdown.innerHTML = '';

    if (!Array.isArray(payments) || !payments.length) {
      elements.paymentBreakdown.innerHTML = '<li class="insight-empty">روش پرداختی ثبت نشده است.</li>';
      return;
    }

    payments.forEach(({ method, total }) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'insight-list__label';
      label.textContent = paymentMethodLabels[method] || 'سایر';

      const value = document.createElement('span');
      value.className = 'insight-list__value';
      value.textContent = formatCurrency(total || 0);

      li.append(label, value);
      elements.paymentBreakdown.appendChild(li);
    });
  };

  const renderUpcomingDue = (items = []) => {
    if (!elements.upcomingDueList) return;
    elements.upcomingDueList.innerHTML = '';

    if (!Array.isArray(items) || !items.length) {
      elements.upcomingDueList.innerHTML = '<li class="insight-empty">سررسید فعالی وجود ندارد.</li>';
      return;
    }

    items.forEach((item) => {
      const li = document.createElement('li');

      const title = document.createElement('span');
      title.className = 'insight-list__label';
      title.textContent = item.title || 'بدون عنوان';

      const value = document.createElement('span');
      value.className = 'insight-list__value';
      value.textContent = formatCurrency(item.amount || 0);

      const meta = document.createElement('span');
      meta.className = 'insight-list__meta';
      const statusText = statusLabels[item.status] || '';
      meta.textContent = `${formatDateForDisplay(item.dueDate)}${statusText ? ` • ${statusText}` : ''}`;

      li.append(title, value, meta);
      elements.upcomingDueList.appendChild(li);
    });
  };

  const renderActiveFilters = (filters = {}) => {
    if (!elements.activeFilters) return;
    elements.activeFilters.innerHTML = '';

    const entries = Object.entries(filters).filter(([, value]) => Boolean(value));
    if (!entries.length) {
      return;
    }

    entries.forEach(([key, value]) => {
      const config = filterDisplayConfig[key] || { label: key };
      const label = config.label || key;
      const valueLabel = config.options?.[value] || value;

      const chip = document.createElement('span');
      chip.className = 'active-filters__chip';

      const icon = document.createElement('i');
      icon.className = 'ri-filter-line';

      const text = document.createElement('span');
      text.textContent = `${label}: ${valueLabel}`;

      chip.append(icon, text);
      elements.activeFilters.appendChild(chip);
    });
  };

  const createStatusBadge = (statusKey) => {
    const key = statusKey && statusLabels[statusKey] ? statusKey : 'paid';
    const badge = document.createElement('span');
    badge.className = `status-badge status-${key}`;

    const icon = document.createElement('i');
    icon.className = statusIcons[key] || statusIcons.paid;

    const text = document.createElement('span');
    text.textContent = statusLabels[key];

    badge.append(icon, text);
    return badge;
  };

  const createCounterpartyNode = (entry) => {
    const container = document.createElement('div');
    container.className = 'counterparty-text';

    const type = document.createElement('span');
    type.className = 'counterparty-type';
    type.textContent = counterpartyTypeLabels[entry.counterpartyType] || counterpartyTypeLabels.other;

    const name = document.createElement('span');
    name.textContent = entry.counterpartyName ? entry.counterpartyName : 'ثبت نشده';

    container.append(type, name);
    return container;
  };

  const createTagListNode = (tags) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'tag-list';

    if (!Array.isArray(tags) || !tags.length) {
      wrapper.textContent = '-';
      return wrapper;
    }

    tags.forEach((tag) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.textContent = tag;
      wrapper.appendChild(chip);
    });

    return wrapper;
  };

  const renderEntries = (entries = []) => {
    if (!elements.entriesBody || !elements.entriesTable || !elements.emptyState) return;

    elements.entriesBody.innerHTML = '';

    if (!entries.length) {
      elements.entriesTable.style.display = 'none';
      elements.emptyState.classList.add('show');
      return;
    }

    elements.entriesTable.style.display = '';
    elements.emptyState.classList.remove('show');

    const fragment = document.createDocumentFragment();

    entries.forEach((entry) => {
      const row = document.createElement('tr');

      const titleCell = document.createElement('td');
      titleCell.textContent = entry.title || '-';

      const typeCell = document.createElement('td');
      const typeClass = entry.type === 'income' ? 'entry-type-income' : 'entry-type-expense';
      typeCell.classList.add(typeClass);
      typeCell.textContent = entry.type === 'income' ? 'درآمد' : 'هزینه';

      const categoryCell = document.createElement('td');
      categoryCell.textContent = entry.category || 'عمومی';

      const amountCell = document.createElement('td');
      amountCell.textContent = formatCurrency(entry.amount || 0);

      const paymentCell = document.createElement('td');
      paymentCell.textContent = paymentMethodLabels[entry.paymentMethod] || paymentMethodLabels.other;

      const statusCell = document.createElement('td');
      statusCell.appendChild(createStatusBadge(entry.computedStatus || entry.status));

      const counterpartyCell = document.createElement('td');
      counterpartyCell.appendChild(createCounterpartyNode(entry));

      const referenceCell = document.createElement('td');
      referenceCell.textContent = entry.referenceNumber || '-';

      const recordedAtCell = document.createElement('td');
      recordedAtCell.textContent = formatDateForDisplay(entry.recordedAt || entry.createdAt);

      const dueDateCell = document.createElement('td');
      dueDateCell.textContent = formatDateForDisplay(entry.dueDate);

      const tagsCell = document.createElement('td');
      tagsCell.appendChild(createTagListNode(entry.tags));

      const descriptionCell = document.createElement('td');
      descriptionCell.textContent = entry.description || '-';

      row.append(
        titleCell,
        typeCell,
        categoryCell,
        amountCell,
        paymentCell,
        statusCell,
        counterpartyCell,
        referenceCell,
        recordedAtCell,
        dueDateCell,
        tagsCell,
        descriptionCell
      );

      fragment.appendChild(row);
    });

    elements.entriesBody.appendChild(fragment);
  };

  const renderSummary = (summary = {}, entries = []) => {
    const totals = summary.totals || calculateTotals(entries);
    updateTotals(totals);
    renderStatusSummary(summary);
    renderCategoryBreakdown(summary.categories);
    renderPaymentBreakdown(summary.paymentMethods);
    renderUpcomingDue(summary.upcomingDue);
    renderEntriesCount(summary.counts?.total ?? entries.length);
  };

  const setDefaultDateValue = () => {
    if (elements.dateInput) {
      elements.dateInput.value = formatDateForInput(new Date());
    }
    if (elements.dueDateInput) {
      elements.dueDateInput.value = '';
    }
  };

  const ensureAccessFlag = () => {
    try {
      return sessionStorage.getItem(ACCESS_KEY) === 'granted';
    } catch (error) {
      return false;
    }
  };

  const removeAccessFlag = () => {
    try {
      sessionStorage.removeItem(ACCESS_KEY);
    } catch (error) {
      /* noop */
    }
  };

  const setActiveToolbar = (action) => {
    if (!elements.toolbarButtons?.length) return;
    elements.toolbarButtons.forEach((button) => {
      if (button.dataset.action === action) {
        button.classList.add('is-active');
      } else {
        button.classList.remove('is-active');
      }
    });
  };

  const scrollToSection = (section) => {
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getFiltersFromForm = () => {
    if (!elements.filtersForm) return {};
    const formData = new FormData(elements.filtersForm);

    const filters = {};
    const search = formData.get('search');
    const type = formData.get('type');
    const category = formData.get('category');
    const paymentMethod = formData.get('paymentMethod');
    const status = formData.get('status');
    const from = formData.get('from');
    const to = formData.get('to');

    if (search && search.toString().trim()) filters.search = search.toString().trim();
    if (type) filters.type = type;
    if (category) filters.category = category;
    if (paymentMethod) filters.paymentMethod = paymentMethod;
    if (status) filters.status = status;
    if (from) filters.from = from;
    if (to) filters.to = to;

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

      if (!entries.length) {
        updateTotals(summary.totals || { income: 0, expense: 0, balance: 0 });
        renderStatusSummary(summary);
      }
    } catch (error) {
      showFormMessage('خطا در دریافت تراکنش‌ها. لطفاً دوباره تلاش کنید.', 'error');
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    if (!ensureAccessFlag()) {
      window.location.replace(DASHBOARD_URL);
      return;
    }

    const handleBackNavigation = () => {
      removeAccessFlag();
      window.location.href = DASHBOARD_URL;
    };

    if (elements.backButton) {
      elements.backButton.addEventListener('click', handleBackNavigation);
    }

    if (elements.toolbar && elements.toolbarButtons?.length) {
      setActiveToolbar('add');
      elements.toolbarButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const { action } = button.dataset;
          switch (action) {
            case 'back':
              handleBackNavigation();
              break;
            case 'add':
              scrollToSection(elements.newEntrySection);
              setActiveToolbar('add');
              break;
            case 'filters':
              scrollToSection(elements.filtersSection);
              setActiveToolbar('filters');
              break;
            case 'report':
              scrollToSection(elements.reportsSection);
              setActiveToolbar('report');
              break;
            default:
              break;
          }
        });
      });

      if (typeof IntersectionObserver === 'function') {
        const observer = new IntersectionObserver(
          (observerEntries) => {
            observerEntries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              if (entry.target.id === 'reportsSection') {
                setActiveToolbar('report');
              } else if (entry.target.id === 'filtersSection') {
                setActiveToolbar('filters');
              } else if (entry.target.id === 'newEntrySection') {
                setActiveToolbar('add');
              }
            });
          },
          {
            rootMargin: '-45% 0px -45% 0px',
            threshold: 0
          }
        );

        if (elements.newEntrySection) observer.observe(elements.newEntrySection);
        if (elements.filtersSection) observer.observe(elements.filtersSection);
        if (elements.reportsSection) observer.observe(elements.reportsSection);
      }
    }

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        handleBackNavigation();
      }
    });

    try {
      const seller = await fetchCurrentSeller();
      if (!seller) {
        removeAccessFlag();
        window.location.replace(LOGIN_URL);
        return;
      }

      if (elements.sellerName) {
        const first = seller.firstname || '';
        const last = seller.lastname || '';
        const fullName = `${first}${last ? ' ' + last : ''}`.trim();
        elements.sellerName.textContent = fullName || 'فروشنده عزیز';
      }
    } catch (error) {
      removeAccessFlag();
      window.location.replace(LOGIN_URL);
      return;
    }

    setDefaultDateValue();
    loadEntries();

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

    if (elements.searchInput) {
      let debounceTimer;
      elements.searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          loadEntries();
        }, 350);
      });
    }

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

        if (!title) {
          showFormMessage('لطفاً عنوان تراکنش را وارد کنید.', 'error');
          return;
        }

        if (!Number.isFinite(amountValue) || amountValue < 0) {
          showFormMessage('مبلغ تراکنش نامعتبر است.', 'error');
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
          await createEntry(payload);
          showFormMessage('تراکنش با موفقیت ثبت شد.', 'success');
          elements.entryForm.reset();
          setDefaultDateValue();
          await loadEntries();
        } catch (error) {
          const message = error?.message || 'خطا در ذخیره‌سازی تراکنش.';
          showFormMessage(message, 'error');
        }
      });
    }
  });
})();
