(()=>{
    'use strict';

    // DOM Elements
    const navItems = Array.from(document.querySelectorAll('.nav-item'));
    const views = Array.from(document.querySelectorAll('.view-container'));
    const fabBtn = document.getElementById('fabBtn');
    const speedDial = document.getElementById('speedDial');
    const newSaleModal = document.getElementById('newSaleModal');
    const addProductModal = document.getElementById('addProductModal');
    const addCustomerModal = document.getElementById('addCustomerModal');
    const modalCloses = Array.from(document.querySelectorAll('.modal-close'));
    const modals = Array.from(document.querySelectorAll('.modal'));
    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toastText');
    const toastActionButton = document.getElementById('toastAction');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const darkModeIcon = darkModeToggle ? darkModeToggle.querySelector('i') : null;
    const currentDateText = document.getElementById('currentDateText');
    const paymentMethods = Array.from(document.querySelectorAll('.payment-method'));
    const customerSelect = document.getElementById('customerSelect');
    const reportPeriodTabs = Array.from(document.querySelectorAll('[data-period]'));
    const quickActionButtons = Array.from(document.querySelectorAll('[data-action]'));
    const taskCheckboxes = Array.from(document.querySelectorAll('.task-checkbox'));
    const taskProgressBar = document.getElementById('taskProgressBar');
    const taskProgressText = document.getElementById('taskProgressText');
    const taskProgressContainer = taskProgressBar ? taskProgressBar.closest('.progress') : null;
    const isRTL = document.documentElement.dir === 'rtl';
    let toastTimeout;
    let salesChartInstance = null;
    let salesReportChartInstance = null;
    const TASK_STORAGE_KEY = 'accountantDailyTasks';

    function safeLocalStorageGet(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function safeLocalStorageSet(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (error) {
            // Storage might be unavailable (private mode, etc.)
        }
    }

    function closeSpeedDial() {
        if (!speedDial || !fabBtn) return;
        speedDial.classList.remove('active');
        fabBtn.classList.remove('active');
        fabBtn.setAttribute('aria-expanded', 'false');
    }

    function openModal(modal) {
        if (!modal) return;
        if (modal === newSaleModal) {
            resetSaleModal();
        }
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        const focusableElement = modal.querySelector('input, select, textarea, button, [tabindex]:not([tabindex="-1"])');
        if (focusableElement) {
            focusableElement.focus({ preventScroll: true });
        } else {
            modal.focus({ preventScroll: true });
        }
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');

        if (modal === newSaleModal) {
            resetSaleModal();
        }

        if (!document.querySelector('.modal.active')) {
            document.body.style.overflow = '';
        }
    }

    function closeAllModals() {
        modals.forEach(closeModal);
    }

    function hideToast() {
        if (!toast) return;
        clearTimeout(toastTimeout);
        toastTimeout = null;
        toast.classList.remove('show');
        toast.setAttribute('aria-hidden', 'true');
        if (toastActionButton) {
            toastActionButton.hidden = true;
            toastActionButton.onclick = null;
        }
    }

    function resetSaleModal() {
        if (customerSelect) {
            customerSelect.style.display = 'none';
        }

        paymentMethods.forEach(method => {
            method.classList.remove('btn-primary');
            method.classList.add('btn-outline');
            method.setAttribute('aria-pressed', 'false');
        });

        const defaultMethod = paymentMethods.find(method => method.dataset.method === 'cash') || paymentMethods[0];
        if (defaultMethod) {
            defaultMethod.classList.add('btn-primary');
            defaultMethod.classList.remove('btn-outline');
            defaultMethod.setAttribute('aria-pressed', 'true');
        }
    }

    // Product form elements
    const productSteps = {
        step1: document.getElementById('step1'),
        step2: document.getElementById('step2'),
        step3: document.getElementById('step3')
    };

    const productFormSteps = {
        step1: document.getElementById('formStep1'),
        step2: document.getElementById('formStep2'),
        step3: document.getElementById('formStep3')
    };

    const productFormFields = {
        name: document.getElementById('productName'),
        code: document.getElementById('productCode'),
        category: document.getElementById('productCategory'),
        price: document.getElementById('productPrice'),
        cost: document.getElementById('productCost'),
        stock: document.getElementById('productStock'),
        minStock: document.getElementById('productMinStock')
    };

    const productFormErrors = {
        name: document.getElementById('productNameError'),
        code: document.getElementById('productCodeError'),
        category: document.getElementById('productCategoryError'),
        price: document.getElementById('productPriceError'),
        cost: document.getElementById('productCostError'),
        stock: document.getElementById('productStockError'),
        minStock: document.getElementById('productMinStockError')
    };

    const productFormButtons = {
        prev: document.getElementById('prevStepBtn'),
        next: document.getElementById('nextStepBtn'),
        save: document.getElementById('saveProductBtn'),
        cancel: document.getElementById('cancelProductBtn')
    };

    // Customer form elements
    const customerSteps = {
        step1: document.getElementById('customerStep1'),
        step2: document.getElementById('customerStep2'),
        step3: document.getElementById('customerStep3')
    };

    const customerFormSteps = {
        step1: document.getElementById('customerFormStep1'),
        step2: document.getElementById('customerFormStep2'),
        step3: document.getElementById('customerFormStep3')
    };

    const customerFormFields = {
        name: document.getElementById('customerName'),
        phone: document.getElementById('customerPhone'),
        address: document.getElementById('customerAddress'),
        credit: document.getElementById('customerCredit'),
        notes: document.getElementById('customerNotes')
    };

    const customerFormErrors = {
        name: document.getElementById('customerNameError'),
        phone: document.getElementById('customerPhoneError'),
        credit: document.getElementById('customerCreditError')
    };

    const customerFormButtons = {
        prev: document.getElementById('customerPrevStepBtn'),
        next: document.getElementById('customerNextStepBtn'),
        save: document.getElementById('saveCustomerBtn'),
        cancel: document.getElementById('cancelCustomerBtn')
    };

    // Empty state elements
    const emptyStates = {
        sales: document.getElementById('salesEmptyState'),
        inventory: document.getElementById('inventoryEmptyState'),
        credit: document.getElementById('creditEmptyState'),
        reports: document.getElementById('reportsEmptyState')
    };

    // Set current date (Shamsi)
    function setCurrentDate() {
        if (!currentDateText) return;

        try {
            const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            currentDateText.textContent = formatter.format(new Date());
        } catch (error) {
            currentDateText.textContent = new Date().toLocaleDateString('fa-IR');
        }
    }
    setCurrentDate();

    // Navigation
    function setActiveView(viewId, { focus = false } = {}) {
        const targetView = document.getElementById(viewId);
        if (!targetView) return;

        navItems.forEach(nav => {
            const isActive = nav.dataset.view === viewId;
            nav.classList.toggle('active', isActive);
            nav.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            nav.setAttribute('aria-selected', isActive ? 'true' : 'false');

            if (isActive && focus) {
                nav.focus();
            }
        });

        views.forEach(view => {
            const isActive = view.id === viewId;
            view.classList.toggle('active', isActive);
            view.setAttribute('aria-hidden', isActive ? 'false' : 'true');
            view.setAttribute('tabindex', isActive ? '0' : '-1');

            if (isActive) {
                view.scrollTop = 0;
            }
        });

        if (viewId === 'reportsView') {
            initSalesReportChart();
        }

        checkEmptyStates(viewId);
        closeSpeedDial();
    }

    function handleQuickAction(action) {
        switch (action) {
            case 'sale':
                openModal(newSaleModal);
                break;
            case 'expense':
                showToast('هزینه روزانه را در پایان شیفت ثبت کنید.');
                break;
            case 'inventory':
                setActiveView('inventoryView');
                showToast('وضعیت انبار به‌روز شد.');
                break;
            case 'customer':
                setActiveView('creditView');
                showToast('فهرست بدهی مشتریان نمایش داده شد.');
                break;
            case 'supplier-call':
                showToast('یادآوری: با تامین‌کننده تماس بگیرید.');
                break;
            case 'supplier-order':
                showToast('پیش‌نویس سفارش برای تامین‌کننده آماده شد.');
                break;
            default:
                showToast('این بخش به زودی فعال می‌شود.');
        }
    }

    // Check for empty states
    function checkEmptyStates(viewId) {
        // Hide all empty states first
        Object.values(emptyStates).forEach(state => {
            if (state) {
                state.style.display = 'none';
            }
        });

        // Show appropriate empty state if needed
        // In a real app, this would check actual data
        // For demo purposes, we'll simulate empty states
        if (viewId === 'salesView' && document.querySelectorAll('#salesView .list-item').length === 0) {
            emptyStates.sales && (emptyStates.sales.style.display = 'block');
        } else if (viewId === 'inventoryView' && document.querySelectorAll('#productList .product-card').length === 0) {
            emptyStates.inventory && (emptyStates.inventory.style.display = 'block');
        } else if (viewId === 'creditView' && document.querySelectorAll('#creditView .list-item').length === 0) {
            emptyStates.credit && (emptyStates.credit.style.display = 'block');
        } else if (viewId === 'reportsView' && document.querySelectorAll('#reportsView .list-item').length === 0) {
            emptyStates.reports && (emptyStates.reports.style.display = 'block');
        }
    }

    // Nav item click event
    navItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            const targetView = item.dataset.view;
            if (targetView) {
                setActiveView(targetView);
            }
        });

        item.addEventListener('keydown', (event) => {
            handleNavKeydown(event, index);
        });
    });

    quickActionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const action = button.getAttribute('data-action');
            if (action) {
                handleQuickAction(action);
            }
        });
    });

    function handleNavKeydown(event, index) {
        const { key } = event;

        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            event.preventDefault();
            const direction = (key === 'ArrowLeft') ? (isRTL ? 1 : -1) : (isRTL ? -1 : 1);
            const nextIndex = (index + direction + navItems.length) % navItems.length;
            const nextNav = navItems[nextIndex];
            if (nextNav && nextNav.dataset.view) {
                setActiveView(nextNav.dataset.view, { focus: true });
            }
        } else if (key === 'Home') {
            event.preventDefault();
            const firstNav = navItems[0];
            if (firstNav && firstNav.dataset.view) {
                setActiveView(firstNav.dataset.view, { focus: true });
            }
        } else if (key === 'End') {
            event.preventDefault();
            const lastNav = navItems[navItems.length - 1];
            if (lastNav && lastNav.dataset.view) {
                setActiveView(lastNav.dataset.view, { focus: true });
            }
        }
    }

    resetSaleModal();
    const defaultView = navItems[0]?.dataset.view || 'salesView';
    setActiveView(defaultView);

    // FAB click event
    if (fabBtn && speedDial) {
        fabBtn.addEventListener('click', () => {
            const isOpen = speedDial.classList.toggle('active');
            fabBtn.classList.toggle('active', isOpen);
            fabBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        document.addEventListener('click', (event) => {
            if (!speedDial.contains(event.target) && event.target !== fabBtn && !fabBtn.contains(event.target)) {
                closeSpeedDial();
            }
        });
    }

    // Speed dial buttons
    document.getElementById('newSaleBtn').addEventListener('click', () => {
        openModal(newSaleModal);
        closeSpeedDial();
    });

    document.getElementById('newProductBtn').addEventListener('click', () => {
        resetProductForm();
        openModal(addProductModal);
        closeSpeedDial();
    });

    document.getElementById('newCustomerBtn').addEventListener('click', () => {
        resetCustomerForm();
        openModal(addCustomerModal);
        closeSpeedDial();
    });

    document.getElementById('newExpenseBtn').addEventListener('click', () => {
        showToast('ثبت هزینه به زودی اضافه می‌شود');
        closeSpeedDial();
    });

    // Modal close
    modalCloses.forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            const modal = closeBtn.closest('.modal');
            closeModal(modal);
        });
    });

    // Close modal when clicking outside
    modals.forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal(modal);
            }
        });
    });

    const darkModeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    let storedDarkModePreference = safeLocalStorageGet('darkMode');

    function applyDarkMode(isEnabled, { persist = false } = {}) {
        document.body.classList.toggle('dark-mode', Boolean(isEnabled));

        if (darkModeToggle) {
            darkModeToggle.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');
            darkModeToggle.setAttribute('aria-label', isEnabled ? 'فعال‌سازی حالت روشن' : 'فعال‌سازی حالت تاریک');
        }

        if (darkModeIcon) {
            darkModeIcon.classList.toggle('fa-sun', Boolean(isEnabled));
            darkModeIcon.classList.toggle('fa-moon', !Boolean(isEnabled));
        }

        if (persist) {
            safeLocalStorageSet('darkMode', isEnabled ? 'enabled' : 'disabled');
            storedDarkModePreference = isEnabled ? 'enabled' : 'disabled';
        }
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            const shouldEnable = !document.body.classList.contains('dark-mode');
            applyDarkMode(shouldEnable, { persist: true });
        });
    }

    if (storedDarkModePreference === 'enabled') {
        applyDarkMode(true);
    } else if (storedDarkModePreference === 'disabled') {
        applyDarkMode(false);
    } else {
        applyDarkMode(darkModeMedia.matches);
    }

    const handleDarkModeChange = (event) => {
        if (!storedDarkModePreference) {
            applyDarkMode(event.matches);
        }
    };

    if (typeof darkModeMedia.addEventListener === 'function') {
        darkModeMedia.addEventListener('change', handleDarkModeChange);
    } else if (typeof darkModeMedia.addListener === 'function') {
        darkModeMedia.addListener(handleDarkModeChange);
    }

    // Payment method selection
    paymentMethods.forEach(method => {
        method.addEventListener('click', () => {
            paymentMethods.forEach(m => {
                m.classList.remove('btn-primary');
                m.classList.add('btn-outline');
                m.setAttribute('aria-pressed', 'false');
            });

            method.classList.add('btn-primary');
            method.classList.remove('btn-outline');
            method.setAttribute('aria-pressed', 'true');

            const selectedMethod = method.getAttribute('data-method');
            if (customerSelect) {
                customerSelect.style.display = selectedMethod === 'credit' ? 'block' : 'none';
            }
        });
    });

    // Show toast notification
    function showToast(message, actionText = null, actionCallback = null) {
        if (!toast || !toastText) return;

        toastText.textContent = message;
        toast.setAttribute('aria-hidden', 'false');
        toast.classList.add('show');

        if (toastActionButton) {
            if (actionText) {
                toastActionButton.textContent = actionText;
                toastActionButton.hidden = false;
                toastActionButton.onclick = () => {
                    if (typeof actionCallback === 'function') {
                        actionCallback();
                    }
                    hideToast();
                };
            } else {
                toastActionButton.hidden = true;
                toastActionButton.onclick = null;
            }
        }

        clearTimeout(toastTimeout);
        toastTimeout = window.setTimeout(() => {
            hideToast();
        }, 3200);
    }

    // Initialize Sales Chart
    function initSalesChart() {
        const ctx = document.getElementById('salesChart');
        if (!ctx) return;

        if (salesChartInstance) {
            salesChartInstance.destroy();
        }

        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'],
                datasets: [{
                    label: 'فروش (تومان)',
                    data: [8500000, 9200000, 7800000, 12345000, 10500000, 11200000, 9500000],
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderColor: 'rgba(79, 70, 229, 1)',
                    borderWidth: 3,
                    pointBackgroundColor: 'rgba(79, 70, 229, 1)',
                    pointBorderColor: '#fff',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString('fa-IR');
                            }
                        }
                    }
                }
            }
        });
    }

    // Initialize Sales Report Chart
    function initSalesReportChart() {
        const ctx = document.getElementById('salesReportChart');
        if (!ctx) return;

        if (salesReportChartInstance) {
            salesReportChartInstance.destroy();
        }

        salesReportChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'],
                datasets: [{
                    label: 'فروش (تومان)',
                    data: [185000000, 192000000, 178000000, 223450000, 205000000, 212000000],
                    backgroundColor: 'rgba(79, 70, 229, 0.7)',
                    borderColor: 'rgba(79, 70, 229, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString('fa-IR');
                            }
                        }
                    }
                }
            }
        });
    }

    // Report period tabs
    reportPeriodTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            reportPeriodTabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-pressed', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-pressed', 'true');

            // Update chart based on selected period
            const period = tab.getAttribute('data-period');
            showToast(`نمایش گزارش ${period === 'day' ? 'روزانه' : period === 'week' ? 'هفتگی' : 'ماهانه'}`);
        });
    });

    // Button event listeners
    document.getElementById('viewAllSalesBtn').addEventListener('click', () => {
        showToast('نمایش تمام فروش‌ها');
    });

    document.getElementById('addProductBtn').addEventListener('click', () => {
        resetProductForm();
        openModal(addProductModal);
    });

    document.getElementById('addCustomerBtn').addEventListener('click', () => {
        resetCustomerForm();
        openModal(addCustomerModal);
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
        showToast('در حال آماده‌سازی فایل اکسل...');
        setTimeout(() => {
            showToast('فایل اکسل با موفقیت دانلود شد');
        }, 2000);
    });

    document.getElementById('cancelSaleBtn').addEventListener('click', () => {
        closeModal(newSaleModal);
    });

    document.getElementById('confirmSaleBtn').addEventListener('click', () => {
        closeModal(newSaleModal);
        showToast('فاکتور فروش با موفقیت ثبت شد');
    });

    function loadTaskStates() {
        try {
            const stored = safeLocalStorageGet(TASK_STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            return {};
        }
    }

    function saveTaskStates(states) {
        safeLocalStorageSet(TASK_STORAGE_KEY, JSON.stringify(states));
    }

    function updateTaskProgress() {
        if (!taskProgressBar || !taskProgressText) return;

        const total = taskCheckboxes.length;
        const completed = taskCheckboxes.filter(checkbox => checkbox.checked).length;
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

        taskProgressBar.style.width = `${percent}%`;
        if (taskProgressContainer) {
            taskProgressContainer.setAttribute('aria-valuenow', percent);
            taskProgressContainer.setAttribute('aria-valuetext', `${percent.toLocaleString('fa-IR')} درصد`);
        }
        taskProgressText.textContent = `${percent.toLocaleString('fa-IR')}٪ تکمیل شده`;
    }

    const taskStates = loadTaskStates();

    taskCheckboxes.forEach(checkbox => {
        const taskId = checkbox.dataset.taskId;
        if (taskId && taskStates[taskId]) {
            checkbox.checked = true;
        }

        checkbox.addEventListener('change', () => {
            if (taskId) {
                taskStates[taskId] = checkbox.checked;
                saveTaskStates(taskStates);
                updateTaskProgress();
            }
        });
    });

    updateTaskProgress();

    // Product form functions
    function resetProductForm() {
        // Reset form fields
        Object.values(productFormFields).forEach(field => field.value = '');

        // Reset errors
        Object.values(productFormErrors).forEach(error => error.classList.remove('show'));
        Object.values(productFormFields).forEach(field => field.classList.remove('error'));

        // Reset steps
        Object.values(productFormSteps).forEach(step => step.style.display = 'none');
        productFormSteps.step1.style.display = 'block';

        // Reset step indicators
        Object.values(productSteps).forEach(step => {
            step.classList.remove('active', 'completed');
        });
        productSteps.step1.classList.add('active');

        // Reset buttons
        productFormButtons.prev.style.display = 'none';
        productFormButtons.next.style.display = 'inline-flex';
        productFormButtons.save.style.display = 'none';
    }

    function validateProductStep(step) {
        let isValid = true;

        if (step === 1) {
            // Validate step 1 fields
            if (!productFormFields.name.value.trim()) {
                productFormFields.name.classList.add('error');
                productFormErrors.name.classList.add('show');
                isValid = false;
            } else {
                productFormFields.name.classList.remove('error');
                productFormErrors.name.classList.remove('show');
            }

            if (!productFormFields.code.value.trim()) {
                productFormFields.code.classList.add('error');
                productFormErrors.code.classList.add('show');
                isValid = false;
            } else {
                productFormFields.code.classList.remove('error');
                productFormErrors.code.classList.remove('show');
            }

            if (!productFormFields.category.value) {
                productFormFields.category.classList.add('error');
                productFormErrors.category.classList.add('show');
                isValid = false;
            } else {
                productFormFields.category.classList.remove('error');
                productFormErrors.category.classList.remove('show');
            }
        } else if (step === 2) {
            // Validate step 2 fields
            if (!productFormFields.price.value || productFormFields.price.value <= 0) {
                productFormFields.price.classList.add('error');
                productFormErrors.price.classList.add('show');
                isValid = false;
            } else {
                productFormFields.price.classList.remove('error');
                productFormErrors.price.classList.remove('show');
            }

            if (!productFormFields.cost.value || productFormFields.cost.value <= 0) {
                productFormFields.cost.classList.add('error');
                productFormErrors.cost.classList.add('show');
                isValid = false;
            } else {
                productFormFields.cost.classList.remove('error');
                productFormErrors.cost.classList.remove('show');
            }

            if (!productFormFields.stock.value || productFormFields.stock.value < 0) {
                productFormFields.stock.classList.add('error');
                productFormErrors.stock.classList.add('show');
                isValid = false;
            } else {
                productFormFields.stock.classList.remove('error');
                productFormErrors.stock.classList.remove('show');
            }

            if (!productFormFields.minStock.value || productFormFields.minStock.value < 0) {
                productFormFields.minStock.classList.add('error');
                productFormErrors.minStock.classList.add('show');
                isValid = false;
            } else {
                productFormFields.minStock.classList.remove('error');
                productFormErrors.minStock.classList.remove('show');
            }
        }

        return isValid;
    }

    function showProductStep(step) {
        // Hide all steps
        Object.values(productFormSteps).forEach(s => s.style.display = 'none');

        // Show current step
        productFormSteps[`step${step}`].style.display = 'block';

        // Update step indicators
        Object.values(productSteps).forEach(s => {
            s.classList.remove('active');
        });
        productSteps[`step${step}`].classList.add('active');

        // Update buttons
        if (step === 1) {
            productFormButtons.prev.style.display = 'none';
            productFormButtons.next.style.display = 'inline-flex';
            productFormButtons.save.style.display = 'none';
        } else if (step === 2) {
            productFormButtons.prev.style.display = 'inline-flex';
            productFormButtons.next.style.display = 'inline-flex';
            productFormButtons.save.style.display = 'none';
        } else if (step === 3) {
            productFormButtons.prev.style.display = 'inline-flex';
            productFormButtons.next.style.display = 'none';
            productFormButtons.save.style.display = 'inline-flex';

            // Populate confirmation data
            document.getElementById('confirmName').textContent = productFormFields.name.value;
            document.getElementById('confirmCode').textContent = productFormFields.code.value;
            document.getElementById('confirmCategory').textContent = productFormFields.category.value;
            document.getElementById('confirmPrice').textContent = parseInt(productFormFields.price.value).toLocaleString('fa-IR') + ' تومان';
            document.getElementById('confirmCost').textContent = parseInt(productFormFields.cost.value).toLocaleString('fa-IR') + ' تومان';
            document.getElementById('confirmStock').textContent = productFormFields.stock.value + ' عدد';
            document.getElementById('confirmMinStock').textContent = productFormFields.minStock.value + ' عدد';
        }

        // Mark previous steps as completed
        for (let i = 1; i < step; i++) {
            productSteps[`step${i}`].classList.add('completed');
        }
    }

    // Product form navigation
    productFormButtons.next.addEventListener('click', () => {
        const currentStep = Object.values(productFormSteps).findIndex(step => step.style.display !== 'none') + 1;

        if (validateProductStep(currentStep)) {
            showProductStep(currentStep + 1);
        }
    });

    productFormButtons.prev.addEventListener('click', () => {
        const currentStep = Object.values(productFormSteps).findIndex(step => step.style.display !== 'none') + 1;
        showProductStep(currentStep - 1);
    });

    productFormButtons.save.addEventListener('click', () => {
        // In a real app, this would save the product to the database
        closeModal(addProductModal);
        showToast('کالای جدید با موفقیت اضافه شد');
    });

    productFormButtons.cancel.addEventListener('click', () => {
        closeModal(addProductModal);
    });

    // Customer form functions
    function resetCustomerForm() {
        // Reset form fields
        Object.values(customerFormFields).forEach(field => field.value = '');

        // Reset errors
        Object.values(customerFormErrors).forEach(error => error.classList.remove('show'));
        Object.values(customerFormFields).forEach(field => field.classList.remove('error'));

        // Reset steps
        Object.values(customerFormSteps).forEach(step => step.style.display = 'none');
        customerFormSteps.step1.style.display = 'block';

        // Reset step indicators
        Object.values(customerSteps).forEach(step => {
            step.classList.remove('active', 'completed');
        });
        customerSteps.step1.classList.add('active');

        // Reset buttons
        customerFormButtons.prev.style.display = 'none';
        customerFormButtons.next.style.display = 'inline-flex';
        customerFormButtons.save.style.display = 'none';
    }

    function validateCustomerStep(step) {
        let isValid = true;

        if (step === 1) {
            // Validate step 1 fields
            if (!customerFormFields.name.value.trim()) {
                customerFormFields.name.classList.add('error');
                customerFormErrors.name.classList.add('show');
                isValid = false;
            } else {
                customerFormFields.name.classList.remove('error');
                customerFormErrors.name.classList.remove('show');
            }

            if (!customerFormFields.phone.value.trim()) {
                customerFormFields.phone.classList.add('error');
                customerFormErrors.phone.classList.add('show');
                isValid = false;
            } else {
                customerFormFields.phone.classList.remove('error');
                customerFormErrors.phone.classList.remove('show');
            }
        } else if (step === 2) {
            // Validate step 2 fields
            if (!customerFormFields.credit.value || customerFormFields.credit.value <= 0) {
                customerFormFields.credit.classList.add('error');
                customerFormErrors.credit.classList.add('show');
                isValid = false;
            } else {
                customerFormFields.credit.classList.remove('error');
                customerFormErrors.credit.classList.remove('show');
            }
        }

        return isValid;
    }

    function showCustomerStep(step) {
        // Hide all steps
        Object.values(customerFormSteps).forEach(s => s.style.display = 'none');

        // Show current step
        customerFormSteps[`step${step}`].style.display = 'block';

        // Update step indicators
        Object.values(customerSteps).forEach(s => {
            s.classList.remove('active');
        });
        customerSteps[`step${step}`].classList.add('active');

        // Update buttons
        if (step === 1) {
            customerFormButtons.prev.style.display = 'none';
            customerFormButtons.next.style.display = 'inline-flex';
            customerFormButtons.save.style.display = 'none';
        } else if (step === 2) {
            customerFormButtons.prev.style.display = 'inline-flex';
            customerFormButtons.next.style.display = 'inline-flex';
            customerFormButtons.save.style.display = 'none';
        } else if (step === 3) {
            customerFormButtons.prev.style.display = 'inline-flex';
            customerFormButtons.next.style.display = 'none';
            customerFormButtons.save.style.display = 'inline-flex';

            // Populate confirmation data
            document.getElementById('confirmCustomerName').textContent = customerFormFields.name.value;
            document.getElementById('confirmCustomerPhone').textContent = customerFormFields.phone.value;
            document.getElementById('confirmCustomerAddress').textContent = customerFormFields.address.value || '-';
            document.getElementById('confirmCustomerCredit').textContent = parseInt(customerFormFields.credit.value).toLocaleString('fa-IR') + ' تومان';
            document.getElementById('confirmCustomerNotes').textContent = customerFormFields.notes.value || '-';
        }

        // Mark previous steps as completed
        for (let i = 1; i < step; i++) {
            customerSteps[`step${i}`].classList.add('completed');
        }
    }

    // Customer form navigation
    customerFormButtons.next.addEventListener('click', () => {
        const currentStep = Object.values(customerFormSteps).findIndex(step => step.style.display !== 'none') + 1;

        if (validateCustomerStep(currentStep)) {
            showCustomerStep(currentStep + 1);
        }
    });

    customerFormButtons.prev.addEventListener('click', () => {
        const currentStep = Object.values(customerFormSteps).findIndex(step => step.style.display !== 'none') + 1;
        showCustomerStep(currentStep - 1);
    });

    customerFormButtons.save.addEventListener('click', () => {
        // In a real app, this would save the customer to the database
        closeModal(addCustomerModal);
        showToast('مشتری جدید با موفقیت اضافه شد');
    });

    customerFormButtons.cancel.addEventListener('click', () => {
        closeModal(addCustomerModal);
    });

    // Product search
    document.getElementById('inventorySearch').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const productCards = document.querySelectorAll('.product-card');

        productCards.forEach(card => {
            const productName = card.querySelector('.product-name').textContent.toLowerCase();
            const productCode = card.querySelector('.product-code').textContent.toLowerCase();

            if (productName.includes(searchTerm) || productCode.includes(searchTerm)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    });

    // Product search in sale modal
    document.getElementById('productSearchInput').addEventListener('input', (e) => {
        const searchTerm = e.target.value;
        if (searchTerm.length > 2) {
            // Simulate product search
            showToast(`جستجو برای: ${searchTerm}`);
        }
    });

    // Empty state buttons
    document.getElementById('emptyStateNewSaleBtn').addEventListener('click', () => {
        openModal(newSaleModal);
    });

    document.getElementById('emptyStateAddProductBtn').addEventListener('click', () => {
        resetProductForm();
        openModal(addProductModal);
    });

    document.getElementById('emptyStateAddCustomerBtn').addEventListener('click', () => {
        resetCustomerForm();
        openModal(addCustomerModal);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (speedDial && speedDial.classList.contains('active')) {
                closeSpeedDial();
            }

            if (document.querySelector('.modal.active')) {
                closeAllModals();
            }

            hideToast();
        }
    });

    // Initialize app
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize sales chart
        setTimeout(() => {
            initSalesChart();
        }, 300);

        // Check if app is installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('App is running in standalone mode');
        }
    });

    // Handle online/offline status
    window.addEventListener('online', () => {
        showToast('اتصال به اینترنت برقرار شد');
    });

    window.addEventListener('offline', () => {
        showToast('بدون اتصال به اینترنت. داده‌ها به صورت آفلاین ذخیره می‌شوند.');
    });
})();
