(() => {
  const ACCESS_KEY = 'vitrinet-accountant-access';
  const ACCOUNTANT_API = '/api/accountant';
  const SELLER_API = '/api/auth/getCurrentSeller';
  const DASHBOARD_URL = '../seller/dashboard.html';
  const LOGIN_URL = '../seller/login.html';

  const elements = {
    sellerName: document.getElementById('sellerName'),
    entryForm: document.getElementById('entryForm'),
    amountInput: document.querySelector('input[name="amount"]'),
    dateInput: document.querySelector('input[name="recordedAt"]'),
    formMessage: document.getElementById('formMessage'),
    entriesBody: document.getElementById('entriesBody'),
    emptyState: document.getElementById('emptyState'),
    entriesTable: document.querySelector('.entries-table'),
    totalIncome: document.getElementById('totalIncome'),
    totalExpense: document.getElementById('totalExpense'),
    totalBalance: document.getElementById('totalBalance'),
    backButton: document.getElementById('backToDashboard'),
    toolbar: document.querySelector('.bottom-toolbar'),
    toolbarButtons: document.querySelectorAll('.bottom-toolbar__button'),
    newEntrySection: document.getElementById('newEntrySection'),
    reportsSection: document.getElementById('reportsSection')
  };

  const formatCurrency = (value) => {
    try {
      const formatter = new Intl.NumberFormat('fa-IR');
      return `${formatter.format(value)} تومان`;
    } catch (error) {
      return `${value} تومان`;
    }
  };

  const formatDateForInput = (date) => {
    const current = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(current.getTime())) return '';
    const tzOffset = current.getTimezoneOffset() * 60000;
    return new Date(current.getTime() - tzOffset).toISOString().split('T')[0];
  };

  const formatDateForDisplay = (value) => {
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
      throw error;
    }
  };

  const fetchEntries = async () => {
    const response = await fetch(ACCOUNTANT_API, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('FAILED_FETCH');
    }

    const data = await response.json();
    return Array.isArray(data.entries) ? data.entries : [];
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
      const error = await response.json().catch(() => ({ message: 'خطا در ذخیره‌سازی اطلاعات.' }));
      const err = new Error(error.message || 'FAILED_CREATE');
      err.code = response.status;
      throw err;
    }

    const data = await response.json();
    return data.entry;
  };

  const renderEntries = (entries) => {
    if (!elements.entriesBody || !elements.entriesTable || !elements.emptyState) return;

    elements.entriesBody.innerHTML = '';

    if (!entries.length) {
      elements.entriesTable.style.display = 'none';
      elements.emptyState.classList.add('show');
      updateTotals([]);
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

      const amountCell = document.createElement('td');
      amountCell.textContent = formatCurrency(entry.amount || 0);

      const dateCell = document.createElement('td');
      dateCell.textContent = formatDateForDisplay(entry.recordedAt || entry.createdAt);

      const descriptionCell = document.createElement('td');
      descriptionCell.textContent = entry.description || '-';

      row.append(titleCell, typeCell, amountCell, dateCell, descriptionCell);
      fragment.appendChild(row);
    });

    elements.entriesBody.appendChild(fragment);
    updateTotals(entries);
  };

  const updateTotals = (entries) => {
    if (!Array.isArray(entries)) return;
    let income = 0;
    let expense = 0;

    entries.forEach((entry) => {
      const amount = Number(entry.amount) || 0;
      if (entry.type === 'income') {
        income += amount;
      } else if (entry.type === 'expense') {
        expense += amount;
      }
    });

    const balance = income - expense;

    if (elements.totalIncome) elements.totalIncome.textContent = formatCurrency(income);
    if (elements.totalExpense) elements.totalExpense.textContent = formatCurrency(expense);
    if (elements.totalBalance) elements.totalBalance.textContent = formatCurrency(balance);
  };

  const setDefaultDateValue = () => {
    if (!elements.dateInput) return;
    elements.dateInput.value = formatDateForInput(new Date());
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
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              if (entry.target.id === 'reportsSection') {
                setActiveToolbar('report');
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

    try {
      const entries = await fetchEntries();
      renderEntries(entries);
    } catch (error) {
      showFormMessage('خطا در دریافت تراکنش‌ها. لطفاً دوباره تلاش کنید.', 'error');
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
          recordedAt: recordedAt ? recordedAt : undefined
        };

        try {
          await createEntry(payload);
          showFormMessage('تراکنش با موفقیت ثبت شد.', 'success');
          elements.entryForm.reset();
          setDefaultDateValue();

          const entries = await fetchEntries();
          renderEntries(entries);
        } catch (error) {
          const message = error?.message || 'خطا در ذخیره‌سازی تراکنش.';
          showFormMessage(message, 'error');
        }
      });
    }
  });
})();
