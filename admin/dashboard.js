(function () {
  const serviceShopDataset = window.ServiceShopPlans?.shops || {};
  const shops = {};
  const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  const toPersianDigits = (value) => String(value ?? '').replace(/\d/g, (d) => PERSIAN_DIGITS[d] ?? d);
  const formatNumber = (value, options = {}) => {
    if (value == null || value === '') return '۰';
    try {
      return new Intl.NumberFormat('fa-IR', options).format(value);
    } catch (err) {
      console.warn('formatNumber failed', err);
      return String(value);
    }
  };
  const formatDate = (value, options) => {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat('fa-IR-u-nu-arabext-ca-persian', options || {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    } catch (err) {
      console.warn('formatDate failed', err);
      return date.toLocaleDateString('fa-IR');
    }
  };
  const formatChange = (value, suffix) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return suffix ? `بدون تغییر ${suffix}` : 'بدون تغییر';
    }
    if (value === 0) {
      return suffix ? `بدون تغییر ${suffix}` : 'بدون تغییر';
    }
    const sign = value > 0 ? '+' : '−';
    const formatted = formatNumber(Math.abs(value) * 100, { maximumFractionDigits: 0 });
    return `${sign}${formatted}٪${suffix ? ` ${suffix}` : ''}`;
  };
  const formatCompletionTime = (time = {}) => {
    const hours = Number(time.hours);
    const minutes = Number(time.minutes);
    const parts = [];
    if (Number.isFinite(hours) && hours > 0) {
      parts.push(`${formatNumber(hours, { maximumFractionDigits: 0 })} ساعت`);
    }
    if (Number.isFinite(minutes) && minutes > 0) {
      parts.push(`${formatNumber(minutes, { maximumFractionDigits: 0 })} دقیقه`);
    }
    return parts.length ? parts.join(' و ') : '—';
  };

  const tableBody = document.querySelector('.shop-table tbody');
  if (tableBody) {
    tableBody.innerHTML = '';

    Object.values(serviceShopDataset).forEach((shopData) => {
      const analytics = shopData.analytics || {};
      const bookings = analytics.bookings || {};
      const revenue = analytics.revenue || {};
      const rating = analytics.rating || {};
      const cancellation = analytics.cancellation || {};

      const totalBookings = Number(bookings.total) || 0;
      const approvedBookings = Number(bookings.approved) || 0;
      const approvalRateRaw = typeof bookings.approvalRate === 'number'
        ? bookings.approvalRate
        : (totalBookings ? approvedBookings / Math.max(totalBookings, 1) : 0);
      const ratingAverage = typeof rating.average === 'number' ? rating.average : 0;
      const ratingCount = Number(rating.count) || 0;
      const cancellationCount = Number(cancellation.cancelled) || 0;
      const cancellationRateValue = totalBookings ? (cancellationCount / totalBookings) * 100 : 0;
      const returningRatio = typeof analytics.returningCustomersRatio === 'number'
        ? analytics.returningCustomersRatio
        : 0;
      const ontimeRateRaw = typeof analytics.ontimeRate === 'number' ? analytics.ontimeRate : null;
      const newCustomers = Number(analytics.newCustomers) || 0;
      const lastUpdatedLabelRaw = formatDate(shopData.plan?.lastUpdated);
      const lastUpdatedLabel = lastUpdatedLabelRaw === '—' ? 'تاریخ نامشخص' : lastUpdatedLabelRaw;
      const responseMinutes = Number(shopData.responseMinutes) || 0;
      const responseLabel = formatNumber(responseMinutes, { maximumFractionDigits: 0 });

      shops[shopData.id] = {
        id: shopData.id,
        name: shopData.name,
        subtitle: `آخرین گزارش ثبت شده در ${lastUpdatedLabel} - پاسخگویی متوسط ${responseLabel} دقیقه`,
        totalBookings,
        bookingChange: formatChange(bookings.change, 'نسبت به هفته قبل'),
        approvedBookings,
        approvalRate: `${formatNumber(approvalRateRaw * 100, { maximumFractionDigits: 0 })}٪ تایید شده`,
        avgRating: formatNumber(ratingAverage, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        ratingCount: `براساس ${formatNumber(ratingCount, { maximumFractionDigits: 0 })} نظر تایید شده`,
        monthlyRevenue: Number(revenue.monthly) || 0,
        revenueChange: formatChange(revenue.change, 'نسبت به ماه قبل'),
        cancellationRate: Number(cancellationRateValue.toFixed(1)),
        cancellationDetail: `${formatNumber(cancellationCount, { maximumFractionDigits: 0 })} رزرو لغو شده از ${formatNumber(totalBookings, { maximumFractionDigits: 0 })} مورد`,
        newCustomers,
        returningCustomers: `${formatNumber(returningRatio * 100, { maximumFractionDigits: 0 })}٪ مشتریان تکراری`,
        avgCompletionTime: formatCompletionTime(analytics.avgCompletionTime),
        ontimeRate: ontimeRateRaw != null
          ? `${formatNumber(ontimeRateRaw * 100, { maximumFractionDigits: 0 })}٪ سفارش‌ها در زمان مقرر تحویل شد`
          : '—',
        topServices: Array.isArray(analytics.topServices) ? analytics.topServices : [],
        weeklyRevenue: Array.isArray(analytics.weeklyRevenue) ? analytics.weeklyRevenue : []
      };

      const row = document.createElement('tr');
      row.className = 'shop-row';
      row.dataset.shopId = shopData.id;

      const manager = shopData.manager || '—';
      const category = shopData.category || '—';
      const phone = shopData.phone ? toPersianDigits(shopData.phone) : '—';
      const statusType = shopData.status?.type || '';
      const statusLabel = shopData.status?.label || '—';

      row.innerHTML = `
        <td>
          <div class="shop-title">${shopData.name}</div>
          <div class="shop-meta">
            <span>مدیر: ${manager}</span>
            <span>${category}</span>
            <span>${phone}</span>
          </div>
        </td>
        <td>
          <span class="status-chip ${statusType}">${statusLabel}</span>
        </td>
        <td>
          <div class="last-update">
            <span>${lastUpdatedLabel}</span>
            <span>سرعت پاسخ: ${responseLabel} دقیقه</span>
          </div>
        </td>
        <td>
          <div class="row-actions">
            <button type="button" class="action-link" data-modal-target="shop" data-shop-id="${shopData.id}">مشاهده آمار</button>
            <a class="action-link" href="../public/service-seller-panel/s-seller-panel.html?shopId=${encodeURIComponent(shopData.id)}" target="_blank" rel="noopener noreferrer">نمای فروشنده</a>
            <a class="action-link secondary" href="../public/admin/service-shops.html?q=${encodeURIComponent(shopData.name)}" target="_blank" rel="noopener noreferrer">اقدامات</a>
          </div>
        </td>
      `;

      tableBody.appendChild(row);
    });
  }

  const modal = document.getElementById('shopModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');
  const totalBookingsEl = document.getElementById('totalBookings');
  const bookingChangeEl = document.getElementById('bookingChange');
  const approvedBookingsEl = document.getElementById('approvedBookings');
  const approvalRateEl = document.getElementById('approvalRate');
  const avgRatingEl = document.getElementById('avgRating');
  const ratingCountEl = document.getElementById('ratingCount');
  const monthlyRevenueEl = document.getElementById('monthlyRevenue');
  const revenueChangeEl = document.getElementById('revenueChange');
  const cancellationRateEl = document.getElementById('cancellationRate');
  const cancellationDetailEl = document.getElementById('cancellationDetail');
  const cancellationBar = document.getElementById('cancellationBar');
  const newCustomersEl = document.getElementById('newCustomers');
  const returningCustomersEl = document.getElementById('returningCustomers');
  const avgCompletionTimeEl = document.getElementById('avgCompletionTime');
  const ontimeRateEl = document.getElementById('ontimeRate');
  const topServicesEl = document.getElementById('topServices');
  const revenueBarsEl = document.getElementById('revenueBars');

  function openModal(shopId) {
    const shop = shops[shopId];
    if (!shop) return;

    modalTitle.textContent = shop.name;
    modalSubtitle.textContent = shop.subtitle;

    totalBookingsEl.textContent = formatNumber(shop.totalBookings, { maximumFractionDigits: 0 });
    bookingChangeEl.textContent = shop.bookingChange;

    approvedBookingsEl.textContent = formatNumber(shop.approvedBookings, { maximumFractionDigits: 0 });
    approvalRateEl.textContent = shop.approvalRate;

    avgRatingEl.textContent = shop.avgRating;
    ratingCountEl.textContent = shop.ratingCount;

    monthlyRevenueEl.textContent = `${formatNumber(shop.monthlyRevenue, { maximumFractionDigits: 0 })} میلیون`;
    revenueChangeEl.textContent = shop.revenueChange;

    cancellationRateEl.textContent = `${formatNumber(shop.cancellationRate, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}٪`;
    cancellationDetailEl.textContent = shop.cancellationDetail;
    cancellationBar.style.width = `${Math.min(shop.cancellationRate, 100)}%`;

    newCustomersEl.textContent = `${formatNumber(shop.newCustomers, { maximumFractionDigits: 0 })} نفر`;
    returningCustomersEl.textContent = shop.returningCustomers;

    avgCompletionTimeEl.textContent = shop.avgCompletionTime;
    ontimeRateEl.textContent = shop.ontimeRate;

    topServicesEl.innerHTML = shop.topServices.map((service) => `
      <li>
        <div class="service-header">
          <span>${service.name}</span>
          <span>${formatNumber(service.bookings, { maximumFractionDigits: 0 })} رزرو</span>
        </div>
        <div class="progress">
          <div class="progress-bar" style="width: ${service.revenueShare}%;"></div>
        </div>
      </li>
    `).join('');

    const revenues = shop.weeklyRevenue.map((item) => Number(item.amount) || 0);
    const maxRevenue = revenues.length ? Math.max(...revenues) : 0;

    revenueBarsEl.innerHTML = shop.weeklyRevenue.map((item) => {
      const amount = Number(item.amount) || 0;
      const height = maxRevenue ? Math.round((amount / maxRevenue) * 100) : 0;
      return `
        <div class="chart-bar">
          <div class="bar">
            <div class="bar-fill" style="height: ${height}%"></div>
          </div>
          <strong>${formatNumber(amount, { maximumFractionDigits: 0 })}</strong>
          <span>${item.day}</span>
        </div>
      `;
    }).join('');

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function attachRowHandlers() {
    document.querySelectorAll('.shop-row').forEach((row) => {
      row.addEventListener('click', () => {
        const shopId = row.getAttribute('data-shop-id');
        openModal(shopId);
      });
    });

    document.querySelectorAll('.row-actions a').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.stopPropagation();
      });
    });

    document.querySelectorAll('.action-link[data-modal-target="shop"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const shopId = button.getAttribute('data-shop-id') || button.closest('.shop-row')?.getAttribute('data-shop-id');
        if (!shopId) return;
        openModal(shopId);
      });
    });
  }

  attachRowHandlers();

  const modalCloseButton = document.getElementById('modalClose');
  if (modalCloseButton) {
    modalCloseButton.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  const openSellerPanelBtn = document.getElementById('openSellerPanel');
  if (openSellerPanelBtn) {
    const shopIds = Object.keys(shops);
    const fallbackId = openSellerPanelBtn.dataset.defaultShop || 'wallet';
    const targetId = shopIds.includes(fallbackId) ? fallbackId : (shopIds[0] || fallbackId);
    openSellerPanelBtn.dataset.defaultShop = targetId;
    openSellerPanelBtn.addEventListener('click', () => {
      window.open(`../public/service-seller-panel/s-seller-panel.html?shopId=${encodeURIComponent(targetId)}`, '_blank');
    });
  }
})();
