(() => {
  // ============================================================================
  // CONFIGURATION - PRESERVED FROM ORIGINAL
  // ============================================================================
  const ACCESS_KEY = 'vitrinet-accountant-access';
  const ACCOUNTANT_API = '/api/accountant';
  const SELLER_API = '/api/auth/getCurrentSeller';
  const DASHBOARD_URL = '../seller/dashboard.html';
  const LOGIN_URL = '../seller/login.html';
  const THEME_KEY = 'accountant-preferred-theme';
  const LOCAL_STORAGE_KEY = 'accountant-demo-entries';

  const LOCAL_SEED_ENTRIES = [
    {
      id: 'demo-income-1',
      title: 'فروش نقدی صبح',
      type: 'income',
      amount: 3500000,
      recordedAt: '2024-07-14T08:35:00.000Z',
      category: 'فروش محصول',
      paymentMethod: 'cash',
      status: 'paid',
      counterpartyType: 'customer',
      counterpartyName: 'مشتری حضوری',
      referenceNumber: 'RCPT-4582',
      tags: ['فروش روزانه'],
      description: 'ثبت فروش صبحگاهی فروشگاه.',
      createdAt: '2024-07-14T08:35:00.000Z'
    },
    {
      id: 'demo-expense-1',
      title: 'خرید کالا از تامین‌کننده',
      type: 'expense',
      amount: 2100000,
      recordedAt: '2024-07-13T15:10:00.000Z',
      category: 'خرید کالا',
      paymentMethod: 'transfer',
      status: 'pending',
      counterpartyType: 'supplier',
      counterpartyName: 'تعاونی سبز',
      referenceNumber: 'INV-7821',
      dueDate: '2024-07-20',
      tags: ['تامین کالا'],
      description: 'خرید ماهانه.',
      createdAt: '2024-07-13T15:10:00.000Z'
    }
  ];

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

  let hasShownLocalNotice = false;
  let categoryChart = null;
  let paymentChart = null;

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
    // Calculator elements
    calculatorModal: document.getElementById('calculatorModal'),
    calculatorTrigger: document.getElementById('calculatorTrigger'),
    calculatorQuickAccess: document.getElementById('calculatorQuickAccess'),
    calculatorClose: document.getElementById('calculatorClose'),
    calcExpression: document.getElementById('calcExpression'),
    calcResult: document.getElementById('calcResult'),
    calcCopy: document.getElementById('calcCopy'),
    calcUse: document.getElementById('calcUse'),
    amountInput: document.getElementById('amountInput')
  };

  // ============================================================================
  // CALCULATOR STATE
  // ============================================================================
  const calculatorState = {
    currentValue: '0',
    previousValue: '',
    operator: null,
    shouldResetDisplay: false
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

  const clearFormMessage = () => {
    if (!elements.formMessage) return;
    elements.formMessage.textContent = '';
    elements.formMessage.classList.remove('error', 'success', 'show');
  };

  // ============================================================================
  // CALCULATOR UTILITY FUNCTIONS
  // ============================================================================
  const convertPersianToEnglishNumbers = (str) => {
    const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const englishNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    
    let result = str;
    for (let i = 0; i < 10; i++) {
      result = result.replace(new RegExp(persianNumbers[i], 'g'), englishNumbers[i]);
    }
    return result;
  };

  const formatNumberForDisplay = (num) => {
    try {
      const formatted = new Intl.NumberFormat('en-US').format(num);
      return formatted;
    } catch (error) {
      return num.toString();
    }
  };

  // ============================================================================
  // CALCULATOR FUNCTIONS
  // ============================================================================
  const updateCalculatorDisplay = () => {
    if (!elements.calcExpression || !elements.calcResult) return;

    let expression = '';
    if (calculatorState.previousValue) {
      expression += formatNumberForDisplay(calculatorState.previousValue);
      if (calculatorState.operator) {
        const operatorSymbols = {
          add: '+',
          subtract: '−',
          multiply: '×',
          divide: '÷'
        };
        expression += ` ${operatorSymbols[calculatorState.operator]} `;
      }
    }
    if (calculatorState.currentValue !== calculatorState.previousValue) {
      expression += formatNumberForDisplay(calculatorState.currentValue);
    }

    elements.calcExpression.textContent = expression || '0';
    elements.calcResult.textContent = formatNumberForDisplay(calculatorState.currentValue);
  };

  const resetCalculator = () => {
    calculatorState.currentValue = '0';
    calculatorState.previousValue = '';
    calculatorState.operator = null;
    calculatorState.shouldResetDisplay = false;
    updateCalculatorDisplay();
  };

  const appendNumber = (num) => {
    if (calculatorState.shouldResetDisplay) {
      calculatorState.currentValue = num;
      calculatorState.shouldResetDisplay = false;
    } else {
      if (calculatorState.currentValue === '0' && num !== '.') {
        calculatorState.currentValue = num;
      } else if (num === '.' && calculatorState.currentValue.includes('.')) {
        return;
      } else {
        calculatorState.currentValue += num;
      }
    }
    updateCalculatorDisplay();
  };

  const deleteLastDigit = () => {
    if (calculatorState.currentValue.length > 1) {
      calculatorState.currentValue = calculatorState.currentValue.slice(0, -1);
    } else {
      calculatorState.currentValue = '0';
    }
    updateCalculatorDisplay();
  };

  const setOperator = (op) => {
    if (calculatorState.operator && !calculatorState.shouldResetDisplay) {
      calculate();
    }
    calculatorState.previousValue = calculatorState.currentValue;
    calculatorState.operator = op;
    calculatorState.shouldResetDisplay = true;
    updateCalculatorDisplay();
  };

  const calculate = () => {
    if (!calculatorState.operator || !calculatorState.previousValue) return;

    const prev = parseFloat(calculatorState.previousValue);
    const current = parseFloat(calculatorState.currentValue);

    if (isNaN(prev) || isNaN(current)) return;

    let result = 0;
    switch (calculatorState.operator) {
      case 'add':
        result = prev + current;
        break;
      case 'subtract':
        result = prev - current;
        break;
      case 'multiply':
        result = prev * current;
        break;
      case 'divide':
        if (current === 0) {
          resetCalculator();
          return;
        }
        result = prev / current;
        break;
      default:
        return;
    }

    calculatorState.currentValue = result.toString();
    calculatorState.previousValue = '';
    calculatorState.operator = null;
    calculatorState.shouldResetDisplay = true;
    updateCalculatorDisplay();
  };

  const calculatePercent = () => {
    const current = parseFloat(calculatorState.currentValue);
    if (isNaN(current)) return;

    if (calculatorState.previousValue && calculatorState.operator) {
      const prev = parseFloat(calculatorState.previousValue);
      calculatorState.currentValue = ((prev * current) / 100).toString();
    } else {
      calculatorState.currentValue = (current / 100).toString();
    }
    updateCalculatorDisplay();
  };

  const copyCalculatorResult = async () => {
    const value = calculatorState.currentValue;
    try {
      await navigator.clipboard.writeText(value);
      // Visual feedback
      if (elements.calcCopy) {
        const originalText = elements.calcCopy.innerHTML;
        elements.calcCopy.innerHTML = '<i class="ri-check-line"></i> کپی شد';
        setTimeout(() => {
          elements.calcCopy.innerHTML = originalText;
        }, 1500);
      }
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        if (elements.calcCopy) {
          const originalText = elements.calcCopy.innerHTML;
          elements.calcCopy.innerHTML = '<i class="ri-check-line"></i> کپی شد';
          setTimeout(() => {
            elements.calcCopy.innerHTML = originalText;
          }, 1500);
        }
      } catch (err) {
        console.error('Failed to copy:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const useCalculatorResult = () => {
    const value = parseFloat(calculatorState.currentValue);
    if (!isNaN(value) && elements.amountInput) {
      elements.amountInput.value = Math.round(value);
      closeCalculatorModal();
    }
  };

  const openCalculatorModal = () => {
    if (elements.calculatorModal) {
      elements.calculatorModal.classList.add('show');
      // If amount input has a value, use it as starting point
      if (elements.amountInput && elements.amountInput.value) {
        const currentAmount = parseFloat(elements.amountInput.value);
        if (!isNaN(currentAmount)) {
          calculatorState.currentValue = currentAmount.toString();
          updateCalculatorDisplay();
        }
      }
    }
  };

  const closeCalculatorModal = () => {
    if (elements.calculatorModal) {
      elements.calculatorModal.classList.remove('show');
    }
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
      id: entry.id || `local-${Date.now()}`,
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

  const readLocalEntries = () => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(LOCAL_SEED_ENTRIES));
        return LOCAL_SEED_ENTRIES.map((entry) => normaliseEntryShape(entry));
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(LOCAL_SEED_ENTRIES));
        return LOCAL_SEED_ENTRIES.map((entry) => normaliseEntryShape(entry));
      }
      return parsed.map((entry) => normaliseEntryShape(entry));
    } catch (error) {
      return LOCAL_SEED_ENTRIES.map((entry) => normaliseEntryShape(entry));
    }
  };

  const writeLocalEntries = (entries = []) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      /* noop */
    }
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

  const buildLocalSummary = (entries = []) => {
    const totals = calculateTotals(entries);

    const counts = entries.reduce(
      (acc, entry) => {
        const statusKey = entry.computedStatus || entry.status || 'paid';
        if (statusKey === 'pending') acc.pending += 1;
        if (statusKey === 'overdue') acc.overdue += 1;
        if (statusKey === 'paid') acc.paid += 1;
        acc.total += 1;
        return acc;
      },
      { total: 0, pending: 0, overdue: 0, paid: 0 }
    );

    const amountsByStatus = entries.reduce(
      (acc, entry) => {
        const statusKey = entry.computedStatus || entry.status || 'paid';
        const current = acc[statusKey] || 0;
        acc[statusKey] = current + (Number(entry.amount) || 0);
        return acc;
      },
      { pending: 0, overdue: 0, paid: 0 }
    );

    const categoryTotalsMap = entries.reduce((acc, entry) => {
      const key = entry.category || 'عمومی';
      const existing = acc.get(key) || 0;
      acc.set(key, existing + (Number(entry.amount) || 0));
      return acc;
    }, new Map());

    const paymentTotalsMap = entries.reduce((acc, entry) => {
      const key = entry.paymentMethod || 'other';
      const existing = acc.get(key) || 0;
      acc.set(key, existing + (Number(entry.amount) || 0));
      return acc;
    }, new Map());

    const categories = Array.from(categoryTotalsMap.entries()).map(([name, total]) => ({
      name,
      total
    }));

    const paymentMethods = Array.from(paymentTotalsMap.entries()).map(([method, total]) => ({
      method,
      total
    }));

    return {
      totals,
      counts,
      categories,
      paymentMethods,
      upcomingDue: [],
      amountsByStatus
    };
  };

  const applyLocalFilters = (entries = [], filters = {}) => {
    if (!entries.length) return [];
    const query = filters.search ? filters.search.toString().toLowerCase() : '';

    return entries.filter((entry) => {
      if (filters.type && entry.type !== filters.type) return false;
      if (filters.category && entry.category !== filters.category) return false;
      if (filters.paymentMethod && entry.paymentMethod !== filters.paymentMethod) return false;
      if (filters.status) {
        const statusKey = entry.computedStatus || entry.status;
        if (statusKey !== filters.status) return false;
      }

      if (query) {
        const tagString = Array.isArray(entry.tags) ? entry.tags.join(' ') : '';
        const combined = `${entry.title || ''} ${entry.counterpartyName || ''} ${tagString}`.toLowerCase();
        if (!combined.includes(query)) return false;
      }

      return true;
    });
  };

  const fetchEntriesFromLocal = (filters = {}) => {
    const entries = readLocalEntries();
    const filteredEntries = applyLocalFilters(entries, filters);
    const summary = buildLocalSummary(filteredEntries);
    return { entries: filteredEntries, summary };
  };

  const notifyLocalMode = () => {
    if (!hasShownLocalNotice) {
      showFormMessage('در حالت آفلاین. داده‌ها در دستگاه ذخیره می‌شوند.', 'info');
      hasShownLocalNotice = true;
    }
  };

  // ============================================================================
  // API FUNCTIONS - PRESERVED FROM ORIGINAL
  // ============================================================================
  const fetchCurrentSeller = async () => {
    try {
      const response = await fetch(SELLER_API, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('UNAUTHENTICATED');
      }

      const data = await response.json();
      return data?.seller || null;
    } catch (error) {
      notifyLocalMode();
      return {
        firstname: 'فروشنده',
        lastname: 'عزیز'
      };
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

      if (!response.ok) {
        throw new Error('FAILED_FETCH');
      }

      const data = await response.json();
      hasShownLocalNotice = false;
      const entries = Array.isArray(data.entries)
        ? data.entries.map((entry) => normaliseEntryShape(entry))
        : [];

      writeLocalEntries(entries);

      return {
        entries,
        summary: data.summary || buildLocalSummary(entries)
      };
    } catch (error) {
      notifyLocalMode();
      return fetchEntriesFromLocal(filters);
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

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: 'خطا در ذخیره‌سازی.' }));
        const err = new Error(error.message || 'FAILED_CREATE');
        err.code = response.status;
        throw err;
      }

      const data = await response.json();
      const entry = normaliseEntryShape(data.entry || payload);
      const existingEntries = readLocalEntries();
      existingEntries.unshift(entry);
      writeLocalEntries(existingEntries);
      return entry;
    } catch (error) {
      notifyLocalMode();

      const existingEntries = readLocalEntries();
      const preparedPayload = {
        ...payload,
        tags: parseTags(payload.tags)
      };

      const entry = normaliseEntryShape({
        ...preparedPayload,
        id: `local-${Date.now()}`,
        createdAt: new Date().toISOString()
      });

      existingEntries.unshift(entry);
      writeLocalEntries(existingEntries);

      return entry;
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

  const renderTransactionCard = (entry) => {
    const card = document.createElement('div');
    card.className = `transaction-card ${entry.type}`;

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

    card.appendChild(header);
    card.appendChild(details);

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

    // Calculator triggers
    const openCalculator = (e) => {
      if (e) {
        e.preventDefault();
      }
      openCalculatorModal();
    };

    if (elements.calculatorTrigger) {
      elements.calculatorTrigger.addEventListener('click', openCalculator);
    }

    if (elements.calculatorQuickAccess) {
      elements.calculatorQuickAccess.addEventListener('click', openCalculator);
    }

    // Calculator close
    if (elements.calculatorClose) {
      elements.calculatorClose.addEventListener('click', closeCalculatorModal);
    }

    // Click outside calculator modal to close
    if (elements.calculatorModal) {
      elements.calculatorModal.addEventListener('click', (e) => {
        if (e.target === elements.calculatorModal) {
          closeCalculatorModal();
        }
      });
    }

    // Calculator buttons
    document.querySelectorAll('.calc-btn-number').forEach(button => {
      button.addEventListener('click', () => {
        const value = button.dataset.value;
        appendNumber(value);
      });
    });

    document.querySelectorAll('.calc-btn-operator').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        setOperator(action);
      });
    });

    document.querySelectorAll('.calc-btn-function').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (action === 'clear') {
          resetCalculator();
        } else if (action === 'backspace') {
          deleteLastDigit();
        } else if (action === 'percent') {
          calculatePercent();
        }
      });
    });

    document.querySelectorAll('.calc-btn-equals').forEach(button => {
      button.addEventListener('click', calculate);
    });

    // Calculator actions
    if (elements.calcCopy) {
      elements.calcCopy.addEventListener('click', copyCalculatorResult);
    }

    if (elements.calcUse) {
      elements.calcUse.addEventListener('click', useCalculatorResult);
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
    const seller = await fetchCurrentSeller();
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
          await createEntry(payload);
          showFormMessage('تراکنش با موفقیت ثبت شد! ✓', 'success');
          elements.entryForm.reset();
          setDefaultDateValue();
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
    }

    // Keyboard shortcuts
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeModal();
        closeCalculatorModal();
      }
    });
  });
})();