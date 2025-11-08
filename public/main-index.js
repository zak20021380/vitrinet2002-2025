const SERVICE_PANEL_KEYWORDS = ['خدمات', 'زیبایی', 'تالار', 'مجالس', 'خودرو', 'ورزشی', 'پزشکی', 'سلامت', 'آرایش'];
const REWARD_API_BASE = '/api/rewards';
const REWARD_USER_CLAIM_KEY = 'vt_reward_user_claim';
const rewardNumberFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const rewardDateFormatter = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
});

const DEFAULT_REWARD_CAMPAIGN = {
  title: '',
  description: '',
  prizeValue: 0,
  currency: 'تومان',
  capacity: 0,
  winnersClaimed: 0,
  active: false,
  showButton: true,
  codes: [],
  winners: [],
  updatedAt: null
};

function normaliseRewardCampaign(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const codes = Array.isArray(source.codes)
    ? source.codes
        .map(item => {
          if (!item) return null;
          const codeStr = String(item.code || '')
            .replace(/[^0-9]/g, '')
            .slice(0, 6);
          if (!codeStr || codeStr.length !== 6) return null;
          return {
            code: codeStr,
            used: Boolean(item.used),
            note: item.note ? String(item.note) : undefined,
            createdAt: item.createdAt || null,
            usedAt: item.usedAt || null
          };
        })
        .filter(Boolean)
    : [];
  const winners = Array.isArray(source.winners)
    ? source.winners
        .map(item => {
          if (!item) return null;
          const firstName = item.firstName ? String(item.firstName).trim() : '';
          const lastName = item.lastName ? String(item.lastName).trim() : '';
          const phoneMasked = item.phoneMasked
            ? String(item.phoneMasked).trim()
            : maskPhoneForPublic(item.phone);
          const createdAt = item.createdAt || null;
          return { firstName, lastName, phoneMasked, createdAt };
        })
        .filter(Boolean)
    : [];

  const prizeValue = Number.isFinite(Number(source.prizeValue)) ? Number(source.prizeValue) : DEFAULT_REWARD_CAMPAIGN.prizeValue;
  const capacity = Math.max(0, Number.isFinite(Number(source.capacity)) ? Number(source.capacity) : DEFAULT_REWARD_CAMPAIGN.capacity);
  let winnersClaimed = Math.max(0, Number.isFinite(Number(source.winnersClaimed)) ? Number(source.winnersClaimed) : DEFAULT_REWARD_CAMPAIGN.winnersClaimed);
  const usedCount = codes.filter(item => item.used).length;
  if (winnersClaimed < usedCount) {
    winnersClaimed = usedCount;
  }
  if (capacity > 0 && winnersClaimed > capacity) {
    winnersClaimed = capacity;
  }

  return {
    title: source.title ? String(source.title) : DEFAULT_REWARD_CAMPAIGN.title,
    description: source.description ? String(source.description) : DEFAULT_REWARD_CAMPAIGN.description,
    prizeValue,
    currency: source.currency ? String(source.currency) : DEFAULT_REWARD_CAMPAIGN.currency,
    capacity,
    winnersClaimed,
    active: source.active !== undefined ? Boolean(source.active) : DEFAULT_REWARD_CAMPAIGN.active,
    showButton: source.showButton !== undefined ? Boolean(source.showButton) : true,
    codes,
    winners,
    updatedAt: source.updatedAt || DEFAULT_REWARD_CAMPAIGN.updatedAt
  };
}

function maskPhoneForPublic(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  const first = digits.slice(0, Math.min(4, digits.length));
  const last = digits.length > 4 ? digits.slice(-4) : '';
  const revealed = first.length + last.length;
  const maskLength = Math.max(4, Math.max(0, digits.length - revealed));
  return `${first}${'•'.repeat(maskLength)}${last}`;
}

function formatRewardDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return rewardDateFormatter.format(date);
}

function formatRewardPrize(amount, currency) {
  if (amount == null || Number.isNaN(Number(amount))) {
    return '—';
  }
  const formatted = rewardNumberFormatter.format(Math.round(Number(amount)));
  return currency ? `${formatted} ${currency}` : formatted;
}

function computeRewardStats(campaign) {
  const codes = Array.isArray(campaign?.codes) ? campaign.codes : [];
  const totalCodes = codes.length;
  const usedCodes = codes.filter(code => code.used).length;
  const availableCodes = Math.max(0, totalCodes - usedCodes);
  const completion = campaign?.capacity > 0
    ? Math.min(100, Math.round((Math.min(campaign.winnersClaimed, campaign.capacity) / campaign.capacity) * 100))
    : 0;
  return { totalCodes, usedCodes, availableCodes, completion };
}

const rewardElements = {
  openBtn: document.getElementById('rewardClaimBtn'),
  backdrop: document.getElementById('rewardModalBackdrop'),
  modal: document.getElementById('rewardModal'),
  title: document.getElementById('rewardModalTitle'),
  subtitle: document.getElementById('rewardModalSubtitle'),
  closeBtn: document.getElementById('rewardModalCloseBtn'),
  dismissBtn: document.getElementById('rewardModalDismissBtn'),
  form: document.getElementById('rewardClaimForm'),
  codeInput: document.getElementById('rewardCodeInput'),
  message: document.getElementById('rewardMessage'),
  prizeValue: document.getElementById('rewardPrizeValue'),
  capacityValue: document.getElementById('rewardCapacityValue'),
  winnersValue: document.getElementById('rewardWinnersValue'),
  progressBar: document.getElementById('rewardProgressBar'),
  submitBtn: document.getElementById('rewardModalSubmitBtn'),
  helpToggle: document.getElementById('rewardHelpToggle'),
  helpContent: document.getElementById('rewardHelpContent'),
  winnersSection: document.getElementById('rewardPublicWinnersSection'),
  winnersList: document.getElementById('rewardPublicWinnersList'),
  winnersEmpty: document.getElementById('rewardPublicWinnersEmpty')
};

let rewardCampaignState = null;
let rewardCampaignFetchPromise = null;
let rewardModalInitialised = false;
let authPromptInitialised = false;

const authPromptElements = {
  backdrop: document.getElementById('authPromptBackdrop'),
  closeBtn: document.getElementById('authPromptCloseBtn'),
  dismissBtn: document.getElementById('authPromptDismissBtn'),
  loginBtn: document.getElementById('authPromptLoginBtn'),
  registerBtn: document.getElementById('authPromptRegisterBtn')
};

function setRewardHelpState(expanded) {
  if (!rewardElements.helpToggle || !rewardElements.helpContent) return;
  rewardElements.helpToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  rewardElements.helpToggle.classList.toggle('is-active', expanded);
  rewardElements.helpContent.hidden = !expanded;
  rewardElements.helpContent.classList.toggle('is-visible', expanded);
}

function isAuthPromptOpen() {
  return Boolean(authPromptElements.backdrop?.classList.contains('active'));
}

function setRewardMessage(message, type = 'info') {
  if (!rewardElements.message) return;
  rewardElements.message.textContent = message || '';
  rewardElements.message.classList.remove('is-success', 'is-error');
  if (type === 'success') {
    rewardElements.message.classList.add('is-success');
  } else if (type === 'error') {
    rewardElements.message.classList.add('is-error');
  }
}

function renderRewardWinners(campaignState = rewardCampaignState) {
  if (!rewardElements.winnersSection || !rewardElements.winnersList || !rewardElements.winnersEmpty) {
    return;
  }
  const winners = Array.isArray(campaignState?.winners) ? campaignState.winners : [];
  rewardElements.winnersList.innerHTML = '';

  if (!winners.length) {
    rewardElements.winnersEmpty.hidden = false;
    return;
  }

  rewardElements.winnersEmpty.hidden = true;
  const limited = winners.slice(0, 10);
  limited.forEach((winner) => {
    const item = document.createElement('li');
    item.className = 'reward-modal__winner-item';

    const info = document.createElement('div');
    info.className = 'reward-modal__winner-info';
    const nameEl = document.createElement('span');
    nameEl.className = 'reward-modal__winner-name';
    nameEl.textContent = `${winner.firstName || ''} ${winner.lastName || ''}`.trim() || 'برنده';
    info.appendChild(nameEl);

    if (winner.phoneMasked) {
      const phoneEl = document.createElement('span');
      phoneEl.className = 'reward-modal__winner-phone';

      const phoneLabelEl = document.createElement('span');
      phoneLabelEl.className = 'reward-modal__winner-phone-label';
      phoneLabelEl.textContent = 'شماره:';

      const phoneNumberEl = document.createElement('span');
      phoneNumberEl.className = 'reward-modal__winner-phone-number';
      phoneNumberEl.textContent = winner.phoneMasked;

      phoneEl.appendChild(phoneLabelEl);
      phoneEl.append(' ');
      phoneEl.appendChild(phoneNumberEl);

      info.appendChild(phoneEl);
    }

    if (winner.createdAt) {
      const dateEl = document.createElement('span');
      dateEl.className = 'reward-modal__winner-date';
      const formatted = formatRewardDate(winner.createdAt);
      if (formatted) {
        dateEl.textContent = `ثبت: ${formatted}`;
        info.appendChild(dateEl);
      }
    }

    item.appendChild(info);
    rewardElements.winnersList.appendChild(item);
  });
}

async function fetchRewardCampaign(force = false) {
  if (!force && rewardCampaignState) {
    return rewardCampaignState;
  }
  if (rewardCampaignFetchPromise && !force) {
    return rewardCampaignFetchPromise;
  }
  rewardCampaignFetchPromise = fetch(`${REWARD_API_BASE}/campaign`, {
    credentials: 'include'
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((payload) => {
      const campaign = normaliseRewardCampaign(payload?.campaign);
      rewardCampaignState = campaign;
      return campaign;
    })
    .catch((error) => {
      rewardCampaignState = null;
      throw error;
    })
    .finally(() => {
      rewardCampaignFetchPromise = null;
    });

  return rewardCampaignFetchPromise;
}

function applyRewardCampaignToUI(campaign = rewardCampaignState) {
  rewardCampaignState = campaign ? normaliseRewardCampaign(campaign) : null;
  const campaignState = rewardCampaignState || normaliseRewardCampaign(DEFAULT_REWARD_CAMPAIGN);
  const titleText = campaignState.title?.trim() || 'کمپین جوایز ویترینت';
  const subtitleText = campaignState.description?.trim() || 'به محض فعال شدن کمپین، جزئیات اینجا نمایش داده می‌شود.';

  if (rewardElements.title) {
    rewardElements.title.textContent = titleText;
  }
  if (rewardElements.subtitle) {
    rewardElements.subtitle.textContent = subtitleText;
  }
  if (rewardElements.prizeValue) {
    rewardElements.prizeValue.textContent = campaignState.prizeValue > 0
      ? formatRewardPrize(campaignState.prizeValue, campaignState.currency)
      : '—';
  }
  if (rewardElements.capacityValue) {
    rewardElements.capacityValue.textContent = campaignState.capacity > 0
      ? `${rewardNumberFormatter.format(campaignState.capacity)} نفر`
      : 'ظرفیت اعلام نشده';
  }
  if (rewardElements.winnersValue) {
    const winnersLabel = Math.min(campaignState.winnersClaimed, campaignState.capacity || campaignState.winnersClaimed);
    rewardElements.winnersValue.textContent = `${rewardNumberFormatter.format(winnersLabel)} نفر`;
  }

  const stats = computeRewardStats(campaignState);
  if (rewardElements.progressBar) {
    rewardElements.progressBar.style.width = `${stats.completion}%`;
  }
  renderRewardWinners(campaignState);
  if (rewardElements.openBtn) {
    rewardElements.openBtn.setAttribute('data-available-codes', stats.availableCodes);
    rewardElements.openBtn.setAttribute(
      'title',
      stats.totalCodes > 0
        ? `ارزش جایزه ${formatRewardPrize(campaignState.prizeValue, campaignState.currency)} • ${rewardNumberFormatter.format(Math.min(campaignState.winnersClaimed, campaignState.capacity || campaignState.winnersClaimed))} از ${rewardNumberFormatter.format(Math.max(campaignState.capacity, campaignState.winnersClaimed))} برنده`
        : 'کمپین جوایز'
    );

    // نمایش یا مخفی کردن دکمه بر اساس تنظیمات ادمین
    if (campaignState.showButton === false) {
      rewardElements.openBtn.style.display = 'none';
    } else {
      rewardElements.openBtn.style.display = '';
    }
  }

  if (!campaignState.active) {
    if (rewardElements.codeInput) {
      rewardElements.codeInput.disabled = true;
    }
    if (rewardElements.submitBtn) {
      rewardElements.submitBtn.disabled = true;
    }
    if (rewardElements.backdrop?.classList.contains('active')) {
      setRewardMessage('کمپین در حال حاضر فعال نیست. لطفاً بعداً دوباره تلاش کنید.', 'error');
    }
  } else {
    if (rewardElements.codeInput) {
      rewardElements.codeInput.disabled = false;
    }
    if (rewardElements.submitBtn) {
      rewardElements.submitBtn.disabled = false;
    }
    if (rewardElements.backdrop?.classList.contains('active')) {
      setRewardMessage('');
    }
  }
}

async function refreshRewardCampaignState(force = false) {
  try {
    const campaign = await fetchRewardCampaign(force);
    applyRewardCampaignToUI(campaign);
    return rewardCampaignState;
  } catch (error) {
    console.error('fetchRewardCampaign failed', error);
    if (rewardElements.backdrop?.classList.contains('active')) {
      setRewardMessage('خطا در دریافت اطلاعات کمپین. لطفاً دوباره تلاش کنید.', 'error');
    }
    throw error;
  }
}

  function closeRewardModal(focusTarget) {
  if (!rewardElements.backdrop) return;
  rewardElements.backdrop.classList.remove('active');
  rewardElements.backdrop.setAttribute('aria-hidden', 'true');
  setRewardHelpState(false);
  if (rewardElements.openBtn) {
    rewardElements.openBtn.setAttribute('aria-expanded', 'false');
  }
  if (!isAuthPromptOpen()) {
    document.body.classList.remove('hide-mobile-nav');
  }
  if (focusTarget && typeof focusTarget.focus === 'function') {
    focusTarget.focus();
  }
}

async function openRewardModal() {
  if (!rewardElements.backdrop) return;
  document.body.classList.add('hide-mobile-nav');
  setRewardHelpState(false);
  if (rewardElements.codeInput) {
    rewardElements.codeInput.value = '';
    rewardElements.codeInput.readOnly = false;
  }

  try {
    await refreshRewardCampaignState(true);
  } catch (error) {
    setRewardMessage('خطا در بارگذاری اطلاعات کمپین. لطفاً کمی بعد دوباره تلاش کنید.', 'error');
  }

  const userClaim = safeParseLocalStorage(REWARD_USER_CLAIM_KEY);
  if (userClaim && userClaim.code && rewardElements.codeInput) {
    rewardElements.codeInput.value = userClaim.code;
    rewardElements.codeInput.readOnly = true;
    if (rewardElements.submitBtn) {
      rewardElements.submitBtn.disabled = true;
    }
    setRewardMessage('شما قبلاً جایزه خود را دریافت کرده‌اید. برای اطلاعات بیشتر با پشتیبانی در تماس باشید.', 'info');
  } else if (rewardCampaignState?.active) {
    setRewardMessage('');
    if (rewardElements.submitBtn) {
      rewardElements.submitBtn.disabled = false;
    }
  }

  rewardElements.backdrop.classList.add('active');
  rewardElements.backdrop.setAttribute('aria-hidden', 'false');
  if (rewardElements.openBtn) {
    rewardElements.openBtn.setAttribute('aria-expanded', 'true');
  }
  if (rewardElements.codeInput) {
    setTimeout(() => rewardElements.codeInput?.focus({ preventScroll: true }), 40);
  }
}

async function handleRewardSubmit(event) {
  event.preventDefault();

  try {
    await refreshRewardCampaignState();
  } catch (error) {
    setRewardMessage('خطا در دریافت اطلاعات کمپین. لطفاً بعداً تلاش کنید.', 'error');
    return;
  }

  if (!rewardCampaignState || !rewardCampaignState.active) {
    setRewardMessage('کمپین در حال حاضر فعال نیست.', 'error');
    return;
  }
  if (!isUserAuthenticated()) {
    setRewardMessage('برای دریافت جایزه ابتدا وارد حساب کاربری خود شوید.', 'error');
    openAuthPrompt();
    return;
  }
  if (!rewardElements.codeInput) return;

  const rawCode = rewardElements.codeInput.value || '';
  const normalisedCode = rawCode.replace(/[^0-9]/g, '').slice(0, 6);
  rewardElements.codeInput.value = normalisedCode;

  if (normalisedCode.length !== 6) {
    setRewardMessage('لطفاً یک کد ۶ رقمی معتبر وارد کنید.', 'error');
    rewardElements.codeInput.focus();
    return;
  }

  const userClaim = safeParseLocalStorage(REWARD_USER_CLAIM_KEY);
  if (userClaim && userClaim.code && userClaim.code === normalisedCode) {
    setRewardMessage('شما قبلاً با همین کد جایزه خود را دریافت کرده‌اید.', 'info');
    return;
  }

  setRewardMessage('در حال بررسی کد شما...', 'info');
  if (rewardElements.submitBtn) {
    rewardElements.submitBtn.disabled = true;
  }

  try {
    const response = await fetch(`${REWARD_API_BASE}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ code: normalisedCode })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.message || (response.status === 404
        ? 'کد وارد شده یافت نشد. لطفاً دوباره تلاش کنید.'
        : response.status === 409
          ? 'امکان استفاده از این کد وجود ندارد.'
          : 'خطا در ثبت کد.');
      setRewardMessage(message, 'error');
      if (rewardElements.submitBtn) {
        rewardElements.submitBtn.disabled = false;
      }
      return;
    }

    rewardCampaignState = normaliseRewardCampaign(payload?.campaign);
    applyRewardCampaignToUI(rewardCampaignState);

    try {
      localStorage.setItem(REWARD_USER_CLAIM_KEY, JSON.stringify({ code: normalisedCode, claimedAt: new Date().toISOString() }));
    } catch (err) {
      console.warn('reward user claim storage failed', err);
    }

    if (rewardElements.codeInput) {
      rewardElements.codeInput.readOnly = true;
    }
    setRewardMessage(payload?.message || 'تبریک! جایزه برای شما ثبت شد. همکاران ما به زودی با شما تماس می‌گیرند.', 'success');
  } catch (error) {
    console.error('handleRewardSubmit failed', error);
    setRewardMessage('خطا در اتصال به سرور. لطفاً دوباره تلاش کنید.', 'error');
    if (rewardElements.submitBtn) {
      rewardElements.submitBtn.disabled = false;
    }
  }
}

function initRewardModal() {
  if (rewardModalInitialised) return;
  rewardModalInitialised = true;
  setRewardHelpState(false);
  if (rewardElements.openBtn) {
    rewardElements.openBtn.addEventListener('click', () => {
      openRewardModal().catch(err => {
        console.error('openRewardModal failed', err);
      });
    });
  }
  if (rewardElements.closeBtn) {
    rewardElements.closeBtn.addEventListener('click', () => closeRewardModal(rewardElements.openBtn));
  }
  if (rewardElements.dismissBtn) {
    rewardElements.dismissBtn.addEventListener('click', () => closeRewardModal(rewardElements.openBtn));
  }
  if (rewardElements.backdrop) {
    rewardElements.backdrop.addEventListener('click', (event) => {
      if (event.target === rewardElements.backdrop) {
        closeRewardModal(rewardElements.openBtn);
      }
    });
  }
  if (rewardElements.form) {
    rewardElements.form.addEventListener('submit', event => {
      handleRewardSubmit(event).catch(err => {
        console.error('handleRewardSubmit failed', err);
      });
    });
  }
  if (rewardElements.codeInput) {
    rewardElements.codeInput.addEventListener('input', () => {
      const digitsOnly = rewardElements.codeInput.value.replace(/[^0-9]/g, '').slice(0, 6);
      if (rewardElements.codeInput.value !== digitsOnly) {
        rewardElements.codeInput.value = digitsOnly;
      }
    });
  }
  if (rewardElements.helpToggle) {
    rewardElements.helpToggle.addEventListener('click', () => {
      const expanded = rewardElements.helpToggle.getAttribute('aria-expanded') === 'true';
      setRewardHelpState(!expanded);
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (isAuthPromptOpen()) {
        closeAuthPrompt();
        return;
      }
      if (rewardElements.backdrop?.classList.contains('active')) {
        closeRewardModal(rewardElements.openBtn);
      }
    }
  });
  refreshRewardCampaignState().catch(err => {
    console.warn('initial reward campaign fetch failed', err);
  });
}

function safeParseLocalStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('خطا در خواندن localStorage برای', key, err);
    return null;
  }
}

function isUserAuthenticated() {
  try {
    const token = localStorage.getItem('token');
    return Boolean(token);
  } catch (err) {
    console.warn('خطا در بررسی وضعیت احراز هویت کاربر', err);
    return false;
  }
}

function openAuthPrompt() {
  if (!authPromptElements.backdrop) return;
  authPromptElements.backdrop.classList.add('active');
  authPromptElements.backdrop.setAttribute('aria-hidden', 'false');
  document.body.classList.add('hide-mobile-nav');
  setTimeout(() => {
    if (authPromptElements.loginBtn) {
      authPromptElements.loginBtn.focus({ preventScroll: true });
    }
  }, 40);
}

function closeAuthPrompt() {
  if (!authPromptElements.backdrop) return;
  authPromptElements.backdrop.classList.remove('active');
  authPromptElements.backdrop.setAttribute('aria-hidden', 'true');
  if (!rewardElements.backdrop?.classList.contains('active')) {
    document.body.classList.remove('hide-mobile-nav');
  } else if (rewardElements.codeInput) {
    setTimeout(() => {
      if (!rewardElements.codeInput.readOnly) {
        rewardElements.codeInput.focus({ preventScroll: true });
      }
    }, 40);
  }
}

function initAuthPrompt() {
  if (authPromptInitialised) return;
  authPromptInitialised = true;
  if (!authPromptElements.backdrop) return;

  const closeHandler = () => closeAuthPrompt();

  if (authPromptElements.closeBtn) {
    authPromptElements.closeBtn.addEventListener('click', closeHandler);
  }
  if (authPromptElements.dismissBtn) {
    authPromptElements.dismissBtn.addEventListener('click', closeHandler);
  }
  authPromptElements.backdrop.addEventListener('click', (event) => {
    if (event.target === authPromptElements.backdrop) {
      closeAuthPrompt();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isAuthPromptOpen()) {
      closeAuthPrompt();
      event.stopImmediatePropagation();
    }
  });
}

function isServiceSellerAccount(seller) {
  if (!seller || typeof seller !== 'object') return false;
  if (seller.isService || seller.panelType === 'service') return true;
  const role = (seller.role || seller.type || '').toString().toLowerCase();
  if (role.includes('service')) return true;
  const category = (seller.category || seller.sellerCategory || '').toString();
  const tags = Array.isArray(seller.tags) ? seller.tags.join(' ') : '';
  const haystack = `${category} ${tags}`;
  return SERVICE_PANEL_KEYWORDS.some(keyword => haystack.includes(keyword));
}

function buildSellerPanelLink(seller) {
  const baseUrl = isServiceSellerAccount(seller)
    ? 'service-seller-panel/s-seller-panel.html'
    : 'seller/dashboard.html';
  const shopurl = seller?.shopurl || seller?.shopUrl || seller?.slug || '';
  const query = shopurl ? `?shopurl=${encodeURIComponent(shopurl)}` : '';
  return `${baseUrl}${query}`;
}

function updateAuthNavigationState() {
  const loginLink = document.getElementById('loginNavLink');
  const loginMobile = document.getElementById('loginMobileLink');
  const desktopLabel = loginLink?.querySelector('.login-link-label');
  const mobileLabel = loginMobile?.querySelector('.login-mobile-label');

  if (!loginLink && !loginMobile) return;

  const token = localStorage.getItem('token');
  const seller = safeParseLocalStorage('seller');
  const user = safeParseLocalStorage('user');

  let targetUrl = 'login.html';
  let labelText = 'ورود';
  let accountType = '';

  if (token && seller && typeof seller === 'object') {
    targetUrl = buildSellerPanelLink(seller);
    labelText = 'پنل فروشنده';
    accountType = 'seller';
  } else if (token && user && typeof user === 'object') {
    targetUrl = 'user/dashboard.html';
    labelText = 'پنل مشتری';
    accountType = 'customer';
  }

  if (loginLink) {
    loginLink.href = targetUrl;
    if (accountType) {
      loginLink.classList.add('logged-in');
      loginLink.setAttribute('data-account-type', accountType);
    } else {
      loginLink.classList.remove('logged-in');
      loginLink.removeAttribute('data-account-type');
    }
    if (desktopLabel) desktopLabel.textContent = labelText;
  }

  if (loginMobile) {
    loginMobile.href = targetUrl;
    if (accountType) {
      loginMobile.classList.add('logged-in');
      loginMobile.setAttribute('data-account-type', accountType);
    } else {
      loginMobile.classList.remove('logged-in');
      loginMobile.removeAttribute('data-account-type');
    }
    if (mobileLabel) mobileLabel.textContent = labelText;
  }
}

updateAuthNavigationState();
window.addEventListener('storage', (event) => {
  if (!event.key || ['token', 'seller', 'user'].includes(event.key)) {
    updateAuthNavigationState();
  }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateAuthNavigationState();
  }
});
document.addEventListener('mobileNavReady', () => {
  updateAuthNavigationState();
});

initRewardModal();
initAuthPrompt();

// نشون دادن پاپ‌آپ
  document.getElementById('cityBtn').onclick = function(e) {
    document.getElementById('cityModalBackdrop').classList.add('active');
  };
  // بستن پاپ‌آپ با دکمه
  document.getElementById('closeAlertBtn').onclick = function() {
    document.getElementById('cityModalBackdrop').classList.remove('active');
  };
  // بستن با کلیک روی پس‌زمینه
  document.getElementById('cityModalBackdrop').onclick = function(e) {
    if (e.target === this) this.classList.remove('active');
  };







// -----------------------------
// جستجوی پیشرفته صفحه اصلی
// -----------------------------
const SEARCH_API_BASE = 'http://localhost:5000/api';
const searchElements = {
  form: document.getElementById('searchForm'),
  input: document.getElementById('mainSearchInput'),
  panel: document.getElementById('searchResultsPanel'),
  container: document.getElementById('searchResultsContainer'),
  status: document.getElementById('searchStatusText'),
  queryLabel: document.getElementById('searchQueryLabel'),
  closeBtn: document.getElementById('closeSearchPanel'),
  refreshBtn: document.getElementById('refreshSearchBtn')
};

const MAX_VISIBLE_SEARCH_RESULTS = 5;

const searchState = {
  loading: false,
  loaderPromise: null,
  loaded: false,
  items: [],
  summary: { shops: 0, products: 0, centers: 0, categories: 0 },
  trending: { shops: [], products: [], centers: [], categories: [] },
  lastUpdated: null
};

const typeOrder = { shop: 0, product: 1, center: 2, category: 3 };

const typeMeta = {
  shop: {
    label: 'مغازه‌ها',
    accent: 'from-[#10b981] to-[#0ea5e9]',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-4.5A2 2 0 0 1 6.4 3h11.2a2 2 0 0 1 1.9 1.3L21 9"/><path d="M20 9v8a2 2 0 0 1-2 2h-1.5a2 2 0 0 1-2-2v-3a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9"/><path d="M4 9h16"/></svg>'
  },
  product: {
    label: 'محصولات',
    accent: 'from-[#0ea5e9] to-[#6366f1]',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 4v14"/><path d="M16 4v14"/><path d="M3 10h18"/></svg>'
  },
  center: {
    label: 'مراکز خرید',
    accent: 'from-[#6366f1] to-[#f97316]',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-6 9 6"/><path d="M4 10v10h16V10"/><path d="M9 21V12h6v9"/></svg>'
  },
  category: {
    label: 'دسته‌بندی‌ها',
    accent: 'from-[#f59e0b] to-[#10b981]',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>'
  }
};

function normalizeText(str) {
  return (str || '')
    .toString()
    .trim()
    .replace(/[‌]/g, '')
    .replace(/[آإأ]/g, 'ا')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .toLowerCase();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);
}

function escapeHTML(str) {
  return (str || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function highlightText(text, rawTokens) {
  if (!text) return '';
  const safe = escapeHTML(text);
  if (!rawTokens || !rawTokens.length) return safe;
  let highlighted = safe;
  rawTokens.forEach(token => {
    if (!token) return;
    const escaped = token.replace(/[-/\^$*+?.()|[\]{}]/g, '\$&');
    highlighted = highlighted.replace(new RegExp(escaped, 'gi'), match => `<span class="bg-emerald-100 text-emerald-700 font-bold px-1 rounded-md">${match}</span>`);
  });
  return highlighted;
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (Number.isNaN(number)) return '';
  return number.toLocaleString('fa-IR') + ' تومان';
}

function buildSearchItem(type, data) {
  const base = {
    type,
    title: data.title || '',
    subtitle: data.subtitle || '',
    location: data.location || '',
    description: data.description || '',
    url: data.url || '#',
    badge: data.badge || '',
    extras: data.extras || {},
    rawCount: data.rawCount || 0
  };
  const titleNorm = normalizeText(base.title);
  const subtitleNorm = normalizeText(base.subtitle);
  const locationNorm = normalizeText(base.location);
  const descriptionNorm = normalizeText(base.description);
  return {
    ...base,
    typeWeight: typeOrder[type] ?? 99,
    keywords: [titleNorm, subtitleNorm, locationNorm, descriptionNorm, normalizeText(data.extraKeywords || '')].join(' ').trim(),
    norm: {
      title: titleNorm,
      subtitle: subtitleNorm,
      location: locationNorm,
      description: descriptionNorm
    }
  };
}

function buildSearchIndex(dataset) {
  const shops = Array.isArray(dataset.shops) ? dataset.shops : [];
  const products = Array.isArray(dataset.products) ? dataset.products : [];
  const centers = Array.isArray(dataset.centers) ? dataset.centers : [];
  const rawCategories = Array.isArray(dataset.categories)
    ? dataset.categories
    : Array.isArray(dataset.categories?.categories)
      ? dataset.categories.categories
      : [];
  const rawServiceSubcategories = Array.isArray(dataset.categories?.serviceSubcategories)
    ? dataset.categories.serviceSubcategories
    : [];
  const combinedCategories = [...rawCategories, ...rawServiceSubcategories];
  const items = [];
  const categoryMap = new Map();

  const normaliseCategoryKey = (name) => {
    const key = normalizeText(name);
    return key.trim();
  };

  shops.forEach(shop => {
    const item = buildSearchItem('shop', {
      title: shop.storename || 'نام فروشگاه نامشخص',
      subtitle: shop.category || 'دسته‌بندی نامشخص',
      location: shop.address || '',
      description: shop.desc || '',
      url: shop.shopurl ? `shop.html?shopurl=${encodeURIComponent(shop.shopurl)}` : '#',
      badge: 'مغازه',
      extraKeywords: shop.shopurl || ''
    });
    items.push(item);
    const categoryName = (shop.category || '').trim();
    if (categoryName) {
      const key = normaliseCategoryKey(categoryName);
      if (key) {
        const entry = categoryMap.get(key) || {
          name: categoryName,
          count: 0,
          slug: categoryName.replace(/\s+/g, '-')
        };
        entry.name = entry.name || categoryName;
        entry.count += 1;
        entry.slug = entry.slug || categoryName.replace(/\s+/g, '-');
        categoryMap.set(key, entry);
      }
    }
  });

  products.forEach(product => {
    const priceText = formatPrice(product.price);
    const item = buildSearchItem('product', {
      title: product.title || 'نام محصول نامشخص',
      subtitle: product.sellerCategory || product.category || '',
      location: product.seller?.address || product.seller?.city || '',
      description: product.desc || '',
      url: product._id ? `product.html?id=${product._id}` : '#',
      badge: 'محصول',
      extras: {
        shopName: product.shopName || product.seller?.storename || '',
        priceText
      },
      extraKeywords: [product.shopName, product.seller?.storename, Array.isArray(product.tags) ? product.tags.join(' ') : product.tags || '', priceText].join(' ')
    });
    items.push(item);
  });

  centers.forEach(center => {
    const title = center.title || 'مرکز خرید';
    const url = center._id
      ? `shopping-centers-shops.html?centerId=${center._id}&title=${encodeURIComponent(center.title || '')}`
      : '#';
    const item = buildSearchItem('center', {
      title,
      subtitle: center.tag || '',
      location: center.location || '',
      description: center.description || '',
      url,
      badge: 'مرکز خرید',
      extras: { stores: center.stores }
    });
    items.push(item);
  });

  combinedCategories.forEach(cat => {
    const displayName = (cat?.name || '').toString().trim();
    if (!displayName) return;
    const key = normaliseCategoryKey(displayName);
    if (!key) return;
    const entry = categoryMap.get(key) || { name: displayName, count: 0 };
    entry.name = displayName || entry.name;
    entry.slug = (cat.slug || entry.slug || displayName.replace(/\s+/g, '-')).trim();
    if (cat.parentName) entry.parentName = cat.parentName;
    if (cat.type) entry.typeLabel = cat.type;
    categoryMap.set(key, entry);
  });

  const categories = Array.from(categoryMap.values())
    .map(cat => buildSearchItem('category', {
      title: cat.name,
      subtitle: `${cat.count} فروشگاه`,
      description: 'مشاهده مغازه‌های این دسته',
      url: `shops-by-category.html?cat=${encodeURIComponent((cat.slug || cat.name || '').trim().replace(/\s+/g, '-'))}`,
      badge: 'دسته‌بندی',
      extraKeywords: [cat.parentName, cat.slug, cat.typeLabel].filter(Boolean).join(' '),
      rawCount: cat.count
    }))
    .sort((a, b) => (b.rawCount || 0) - (a.rawCount || 0));

  items.push(...categories);

  const trending = {
    shops: items.filter(item => item.type === 'shop').slice(0, 4),
    products: items.filter(item => item.type === 'product').slice(0, 3),
    centers: items.filter(item => item.type === 'center').slice(0, 3),
    categories: categories.slice(0, 6)
  };

  return {
    items,
    summary: {
      shops: shops.length,
      products: products.length,
      centers: centers.length,
      categories: categories.length
    },
    trending
  };
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function ensureSearchData(force = false) {
  if (!searchElements.input) return [];
  if (searchState.loading && searchState.loaderPromise) {
    return searchState.loaderPromise;
  }
  if (searchState.loaded && !force) {
    return searchState.items;
  }

  searchState.loading = true;
  if (searchElements.status) {
    searchElements.status.textContent = 'در حال آماده‌سازی داده‌های جستجو...';
  }
  if (searchElements.panel) {
    searchElements.panel.classList.remove('hidden');
  }

  const loader = (async () => {
    try {
      const [shopsRes, productsRes, centersRes, categoriesRes] = await Promise.allSettled([
        fetchJSON(`${SEARCH_API_BASE}/shops`),
        fetchJSON(`${SEARCH_API_BASE}/products`),
        fetchJSON(`${SEARCH_API_BASE}/shopping-centers`),
        fetchJSON(`${SEARCH_API_BASE}/categories`)
      ]);

      const shops = shopsRes.status === 'fulfilled' ? shopsRes.value : [];
      const products = productsRes.status === 'fulfilled' ? productsRes.value : [];
      const centers = centersRes.status === 'fulfilled' ? centersRes.value : [];
      const categories = categoriesRes.status === 'fulfilled' ? categoriesRes.value : [];

      const { items, summary, trending } = buildSearchIndex({ shops, products, centers, categories });
      searchState.items = items;
      searchState.summary = summary;
      searchState.trending = trending;
      searchState.loaded = true;
      searchState.lastUpdated = new Date();

      if (searchElements.status) {
        const { shops: sCount, products: pCount, centers: cCount, categories: catCount } = summary;
        searchElements.status.textContent = `بیش از ${sCount} مغازه، ${pCount} محصول، ${cCount} مرکز خرید و ${catCount} دسته‌بندی برای جستجو آماده است.`;
      }
      if (searchElements.refreshBtn) {
        searchElements.refreshBtn.classList.remove('hidden');
      }

      return items;
    } catch (error) {
      console.error('search preload error', error);
      if (searchElements.status) {
        searchElements.status.textContent = 'خطا در آماده‌سازی داده‌های جستجو. لطفاً دوباره تلاش کنید.';
      }
      if (searchElements.container) {
        searchElements.container.innerHTML = '<div class="rounded-2xl border border-dashed border-rose-200 bg-white/80 p-6 text-center text-sm font-bold text-rose-500">در بارگذاری داده‌های جستجو خطایی رخ داد. لطفاً بعداً دوباره تلاش کنید.</div>';
      }
      throw error;
    } finally {
      searchState.loading = false;
      searchState.loaderPromise = null;
    }
  })();

  searchState.loaderPromise = loader;
  return loader;
}

function renderGroup(type, items, rawTokens) {
  if (!items || !items.length) return '';
  const meta = typeMeta[type] || { label: type, accent: 'from-[#94a3b8] to-[#cbd5f5]', icon: '' };
  const groupCards = items.map(item => renderResultCard(item, rawTokens)).join('');
  return `
    <section class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-sm sm:text-base font-extrabold text-slate-600">
          <span class="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.accent} text-white shadow-md">
            ${meta.icon}
          </span>
          <span class="text-slate-700">${meta.label}</span>
        </div>
      </div>
      <div class="grid gap-3 sm:gap-4 ${type === 'category' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}">
        ${groupCards}
      </div>
    </section>
  `;
}

function renderResultCard(item, rawTokens) {
  const titleHTML = highlightText(item.title, rawTokens);
  const subtitleHTML = item.subtitle ? highlightText(item.subtitle, rawTokens) : '';
  const locationHTML = item.location ? highlightText(item.location, rawTokens) : '';
  const descriptionHTML = item.description ? highlightText(item.description, rawTokens) : '';
  const badge = item.badge
    ? `<span class="inline-flex items-center justify-center rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-extrabold text-emerald-600">${escapeHTML(item.badge)}</span>`
    : '';

  let footerHTML = '';
  if (item.type === 'product') {
    const price = item.extras?.priceText;
    const shopName = item.extras?.shopName ? escapeHTML(item.extras.shopName) : '';
    footerHTML = `
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        ${shopName ? `<span class="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 font-bold text-sky-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 008.6 15a1.65 1.65 0 00-1.82-.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 005 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 008.6 5a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0015 8.6a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 15z"></path></svg>${shopName}</span>` : ''}
        ${price ? `<span class="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-extrabold text-emerald-600">${escapeHTML(price)}</span>` : ''}
      </div>
    `;
  } else if (item.type === 'center') {
    const stores = item.extras?.stores;
    footerHTML = stores !== undefined
      ? `<div class="mt-3 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-6 9 6"/><path d="M4 10v10h16V10"/><path d="M9 21V12h6v9"/></svg>${stores || 0} مغازه</div>`
      : '';
  } else if (item.type === 'category') {
    footerHTML = `<div class="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>${escapeHTML(item.subtitle)}</div>`;
  }

  const body = `
    <div class="flex flex-col gap-2 text-right">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-base sm:text-lg font-black text-slate-700 leading-7">${titleHTML}</h4>
        ${badge}
      </div>
      ${subtitleHTML ? `<p class="text-xs sm:text-sm font-bold text-slate-500">${subtitleHTML}</p>` : ''}
      ${locationHTML ? `<p class="flex items-center justify-end gap-1 text-xs text-slate-400"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 5.25-9 13-9 13s-9-7.75-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${locationHTML}</p>` : ''}
      ${descriptionHTML ? `<p class="text-[11px] sm:text-xs leading-6 text-slate-400">${descriptionHTML}</p>` : ''}
      ${footerHTML}
    </div>
  `;

  return `
    <a href="${item.url}" class="group block rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
      ${body}
    </a>
  `;
}

function renderDefaultResults() {
  if (!searchElements.panel) return;
  const { trending, summary } = searchState;
  const typeSequence = ['shop', 'product', 'center', 'category'];
  let remainingSlots = MAX_VISIBLE_SEARCH_RESULTS;
  const groups = [];

  typeSequence.forEach(type => {
    if (remainingSlots <= 0) return;
    const source = trending[type] || [];
    if (!source.length) return;
    const limitedItems = source.slice(0, remainingSlots);
    groups.push(renderGroup(type, limitedItems, []));
    remainingSlots -= limitedItems.length;
  });

  if (searchElements.queryLabel) {
    searchElements.queryLabel.textContent = '';
  }
  if (searchElements.status) {
    if (searchState.loaded) {
      searchElements.status.textContent = `برای شروع، محبوب‌ترین گزینه‌ها از بین ${summary.shops} مغازه، ${summary.products} محصول، ${summary.centers} مرکز خرید و ${summary.categories} دسته‌بندی را ببینید.`;
    } else {
      searchElements.status.textContent = 'برای مشاهده نتایج جستجو، عبارت موردنظر خود را تایپ کنید.';
    }
  }
  if (searchElements.container) {
    searchElements.container.innerHTML = groups.length
      ? groups.join('')
      : '<div class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-sm font-bold text-slate-400">هنوز داده‌ای برای نمایش وجود ندارد.</div>';
  }
  searchElements.panel.classList.remove('hidden');
}

function renderSearchResults(query, matches, rawTokens, totalMatches = matches.length) {
  if (!searchElements.panel) return;
  const grouped = matches.reduce((acc, item) => {
    (acc[item.type] = acc[item.type] || []).push(item);
    return acc;
  }, {});

  const sections = [
    renderGroup('shop', grouped.shop || [], rawTokens),
    renderGroup('product', grouped.product || [], rawTokens),
    renderGroup('center', grouped.center || [], rawTokens),
    renderGroup('category', grouped.category || [], rawTokens)
  ].filter(Boolean);

  if (searchElements.container) {
    if (sections.length) {
      searchElements.container.innerHTML = sections.join('');
    } else {
      searchElements.container.innerHTML = '<div class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-sm font-bold text-slate-400">هیچ نتیجه‌ای با این جستجو پیدا نشد. عبارات مشابه یا کوتاه‌تر را امتحان کنید.</div>';
    }
  }

  if (searchElements.queryLabel) {
    searchElements.queryLabel.textContent = `«${query}»`;
  }
  if (searchElements.status) {
    const displayed = matches.length;
    if (totalMatches && totalMatches > displayed) {
      searchElements.status.textContent = `${displayed} نتیجه از ${totalMatches} نتیجه مرتبط با «${query}» نمایش داده شد.`;
    } else {
      searchElements.status.textContent = displayed
        ? `${displayed} نتیجه مرتبط با «${query}» پیدا شد.`
        : `نتیجه‌ای برای «${query}» پیدا نشد.`;
    }
  }
  searchElements.panel.classList.remove('hidden');
}

function performSearch(tokens) {
  if (!tokens.length) return [];
  const matches = [];
  searchState.items.forEach(item => {
    let score = 0;
    tokens.forEach(token => {
      if (!token) return;
      if (item.norm.title.includes(token)) score += 6;
      else if (item.norm.subtitle.includes(token)) score += 4;
      else if (item.norm.location.includes(token)) score += 3;
      else if (item.keywords.includes(token)) score += 1;
    });
    if (score > 0) {
      matches.push({ ...item, score });
    }
  });

  return matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.typeWeight !== b.typeWeight) return a.typeWeight - b.typeWeight;
    if ((b.rawCount || 0) !== (a.rawCount || 0)) return (b.rawCount || 0) - (a.rawCount || 0);
    return 0;
  });
}

async function handleSearch(query, { immediate = false } = {}) {
  if (!searchElements.input) return;
  const trimmed = (query || '').trim();
  try {
    await ensureSearchData();
  } catch {
    return;
  }

  if (!trimmed) {
    renderDefaultResults();
    return;
  }

  const normalizedTokens = tokenize(trimmed);
  const rawTokens = trimmed.split(/\s+/).filter(Boolean);
  if (!normalizedTokens.length) {
    renderDefaultResults();
    return;
  }

  const matches = performSearch(normalizedTokens);
  const limitedMatches = matches.slice(0, MAX_VISIBLE_SEARCH_RESULTS);
  renderSearchResults(trimmed, limitedMatches, rawTokens, matches.length);

  if (immediate && matches.length) {
    setTimeout(() => {
      const firstLink = searchElements.container?.querySelector('a');
      firstLink?.focus();
    }, 10);
  }
}

let searchDebounce;
function scheduleSearch(query) {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => handleSearch(query), 280);
}

function attachSearchEvents() {
  if (!searchElements.input || !searchElements.form) return;

  searchElements.input.addEventListener('focus', () => {
    ensureSearchData().then(() => renderDefaultResults()).catch(() => renderDefaultResults());
    if (searchElements.panel) {
      searchElements.panel.classList.remove('hidden');
    }
  });

  searchElements.input.addEventListener('input', (event) => {
    const value = event.target.value;
    scheduleSearch(value);
  });

  searchElements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = searchElements.input.value;
    handleSearch(query, { immediate: true });
  });

  document.addEventListener('click', (event) => {
    if (!searchElements.panel || searchElements.panel.classList.contains('hidden')) return;
    const isInside = searchElements.panel.contains(event.target) || searchElements.form.contains(event.target);
    if (!isInside) {
      searchElements.panel.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && searchElements.panel && !searchElements.panel.classList.contains('hidden')) {
      searchElements.panel.classList.add('hidden');
    }
  });

  if (searchElements.closeBtn) {
    searchElements.closeBtn.addEventListener('click', () => {
      if (searchElements.panel) searchElements.panel.classList.add('hidden');
    });
  }

  if (searchElements.refreshBtn) {
    searchElements.refreshBtn.addEventListener('click', async () => {
      try {
        await ensureSearchData(true);
        handleSearch(searchElements.input.value);
      } catch {
        // خطا از قبل مدیریت شده است
      }
    });
  }
}

attachSearchEvents();

// واکشی و رندر تبلیغ فروشگاه ویژه قبل از کارت فروشگاه‌ها
// متغیر تبلیغ ویژه (در صورت وجود)
let adHomeData = null;

// گرفتن تبلیغ ad_home فقط یکبار برای هر بار بارگذاری فروشگاه‌ها
async function fetchAdHome() {
  try {
    const res = await fetch('http://localhost:5000/api/adOrder/active?planSlug=ad_home');
    const data = await res.json();
    if (data.success && Array.isArray(data.ads)) {
      const approved = data.ads.filter(ad => ad && ad.status === 'approved');
      adHomeData = approved.length ? approved[0] : null;
    } else {
      adHomeData = null;
    }
  } catch {
    adHomeData = null;
  }
}

async function loadShops() {
  const cardsWrap = document.getElementById('drag-scroll-cards');
  cardsWrap.innerHTML = '<div style="margin: 60px auto;">در حال بارگذاری...</div>';
  updateSliderNavVisibility('drag-scroll-cards');

  // اول تبلیغ ویژه رو بگیر
  await fetchAdHome();

  try {
    const res = await fetch('http://localhost:5000/api/shops');
    const shops = await res.json();
    cardsWrap.innerHTML = '';
    updateSliderNavVisibility('drag-scroll-cards');

    // اگر تبلیغ ویژه داریم، اول کارت تبلیغ رو اضافه کن
    if (adHomeData && adHomeData.status === 'approved') {
      const ad = adHomeData;
      const card = document.createElement('a');

      const productId = typeof ad.productId === 'object' && ad.productId !== null
        ? ad.productId._id || ad.productId.id
        : ad.productId;
      const sellerId = typeof ad.sellerId === 'object' && ad.sellerId !== null
        ? ad.sellerId._id || ad.sellerId.id
        : ad.sellerId;

      let targetUrl = '#';
      if (productId) {
        targetUrl = `product.html?id=${productId}`;
      } else if (sellerId) {
        targetUrl = `shop.html?id=${sellerId}`;
      }

      card.href = targetUrl;
      card.className = `
        group glass min-w-[265px] max-w-xs flex-shrink-0 flex flex-col items-center
        p-4 rounded-2xl shadow-xl border bg-white/90 backdrop-blur-[3px] transition-all duration-200 special-ad-card
      `;

      const adTitleHTML = ad.adTitle && ad.adTitle.trim()
        ? `<div class="ad-title">${ad.adTitle}</div>`
        : '';

      // استایل مدرن adText
      const adTextHTML = ad.adText && ad.adText.trim()
        ? `<div style="
              margin-top: 13px;
              margin-bottom: 0;
              padding: 11px 18px;
              background: linear-gradient(90deg, #e0fdfa 65%, #f1f5f9 100%);
              border-radius: 17px;
              color: #22223b;
              font-weight: 700;
              font-size: 1.07rem;
              box-shadow: 0 2px 8px #0ea5e911;
              text-align: center;
              display: block;
              letter-spacing: 0.01em;
              min-height: 38px;
              border: 1.4px solid #38bdf8;
              max-width: 96%;
              margin-left:auto;margin-right:auto;
           ">
              ${ad.adText}
           </div>`
        : '';

      card.innerHTML = `
        <div class="ad-badge-vip">تبلیغ ویژه</div>
        <div class="w-full h-[120px] sm:h-[160px] rounded-xl mb-5 flex items-center justify-center relative overflow-hidden shop-card-banner"
             style="background:linear-gradient(100deg,#e0fdfa,#d4fbe8);">
          ${
            ad.bannerImage
              ? `<img src="/uploads/${ad.bannerImage}"
                     class="object-cover w-full h-full absolute inset-0 rounded-xl"
                     alt="لوگو تبلیغ ویژه">`
              : `<div class="flex items-center justify-center w-full h-full absolute inset-0 rounded-xl text-[#f59e42] text-4xl font-black">AD</div>`
          }
        </div>
        <div class="w-full flex flex-col items-center mb-2">
          <span class="font-extrabold text-lg sm:text-xl text-[#10b981] mb-1">${ad.shopTitle || 'فروشگاه ویژه'}</span>
          ${adTitleHTML}
        </div>
        ${adTextHTML}
        <button class="card-action-btn" onclick="event.stopPropagation();">
          مشاهده
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
      `;
      cardsWrap.appendChild(card);
    }

    // کارت‌های فروشگاه‌ها رو اضافه کن
    if (!shops.length) {
      cardsWrap.innerHTML += '<div class="text-gray-400 text-center w-full p-7">فعلا فروشگاهی ثبت نشده.</div>';
      updateSliderNavVisibility('drag-scroll-cards');
      return;
    }

    const filteredShops = shops.filter(shop => {
      const category = (shop.category || '').trim();
      return category !== 'خدمات';
    });

    if (!filteredShops.length) {
      cardsWrap.innerHTML = '<div class="text-gray-400 text-center w-full p-7">فعلاً فروشگاه منتخب برای نمایش وجود ندارد.</div>';
      updateSliderNavVisibility('drag-scroll-cards');
      return;
    }

    filteredShops.forEach(shop => {
      const card = document.createElement('a');
      card.href = `shop.html?shopurl=${shop.shopurl}`;
      card.className = `
        group glass min-w-[265px] max-w-xs flex-shrink-0 flex flex-col items-center
        p-4 rounded-2xl shadow-xl border hover:scale-[1.04] hover:shadow-2xl
        bg-white/90 backdrop-blur-[3px] transition-all duration-200
      `;
      // برای فروشگاه اگه دسته‌بندی نبود، نشون بده «سایر»
      const shopCategoryHTML = shop.category && shop.category.trim()
        ? `<span class="inline-block bg-[#10b981]/10 text-[#10b981] text-xs font-bold px-3 py-1 rounded-full">${shop.category}</span>`
        : `<span class="inline-block bg-[#cbd5e1]/40 text-[#64748b] text-xs font-bold px-3 py-1 rounded-full">سایر</span>`;

      card.innerHTML = `
        <div class="w-full h-[120px] sm:h-[160px] rounded-xl mb-5 flex items-center justify-center relative overflow-hidden"
             style="background:linear-gradient(100deg,#e0fdfa,#d4fbe8);">
          ${
            shop.boardImage && shop.boardImage.length > 0
              ? `<img src="${shop.boardImage}" class="object-cover w-full h-full absolute inset-0 rounded-xl" alt="لوگو فروشگاه">`
              : (
                  shop.banner
                    ? `<img src="${shop.banner}" class="object-cover w-full h-full absolute inset-0 rounded-xl" alt="${shop.storename}">`
                    : `<div class="flex items-center justify-center w-full h-full absolute inset-0 rounded-xl text-gray-300 text-4xl font-black">?</div>`
                )
          }
          <span class="absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-full bg-[#10b981] text-white bg-opacity-80">جدید</span>
        </div>
        <div class="w-full flex flex-col items-center mb-2">
          <span class="font-extrabold text-lg sm:text-xl text-[#10b981] mb-1">${shop.storename}</span>
        </div>
        <div class="flex items-center justify-center gap-2 mb-1 w-full">
          <svg width="18" height="18" fill="none" viewBox="0 0 22 22">
            <circle cx="11" cy="11" r="10" fill="#e0f7fa"/>
            <path d="M11 2.5C7.13 2.5 4 5.61 4 9.45c0 3.52 4.1 7.93 6.2 10.01.46.47 1.2.47 1.66 0 2.1-2.08 6.14-6.49 6.14-10.01C18 5.61 14.87 2.5 11 2.5Zm0 10.25a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5Z" fill="#10b981"/>
          </svg>
          <span class="text-gray-700 text-sm sm:text-base font-bold truncate max-w-[180px]">${shop.address}</span>
        </div>
        <div class="flex items-center justify-center gap-2 mt-2 w-full">
          ${shopCategoryHTML}
        </div>
        <button class="card-action-btn" onclick="event.stopPropagation();">
          مشاهده
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
      `;
      cardsWrap.appendChild(card);
    });

    updateSliderNavVisibility('drag-scroll-cards');

  } catch (e) {
    cardsWrap.innerHTML = '<div class="text-red-500 text-center و-full p-8">مشکل در ارتباط با سرور!</div>';
    updateSliderNavVisibility('drag-scroll-cards');
  }
}

window.addEventListener('DOMContentLoaded', loadShops);

async function loadMostVisitedStores() {
  const container = document.getElementById('most-visited-shops');
  if (!container) {
    console.warn('Most visited stores container not found. Skipping load.');
    return;
  }
  container.innerHTML = '<div class="w-full text-center py-8 text-gray-500">در حال بارگذاری...</div>';
  try {
    const res = await fetch('/api/shops/top-visited?city=سنندج&limit=8');
    if (!res.ok) throw new Error('network');
    let stores = await res.json();
    stores = Array.isArray(stores) ? stores : [];
    stores.sort((a,b) => (b.visits || 0) - (a.visits || 0));

    container.innerHTML = '';
    if (!stores.length) {
      container.innerHTML = '<p class="text-gray-400 text-center w-full p-7">فروشگاهی یافت نشد.</p>';
      return;
    }

    stores.forEach((shop, i) => {
      const rank = i + 1;
      const img = shop.image || 'assets/images/no-image.png';
      const name = shop.name || 'بدون نام';
      const loc = shop.address || '';
      const category = shop.category || 'نامشخص';
      const visits = shop.visits || 0;

      const badgeColor = rank === 1 ? 'bg-emerald-500'
        : rank === 2 ? 'bg-sky-500'
        : rank === 3 ? 'bg-amber-500'
        : 'bg-slate-500';

      const card = document.createElement('a');
      card.href = shop.shopurl ? `/shop/${shop.shopurl}` : '#';
      card.target = '_blank';
      card.className = 'relative rounded-2xl shadow-md bg-[#f9f7f4] p-3 transition-all hover:shadow-lg hover:scale-[1.01]';
      card.innerHTML = `
        <div class="absolute top-2 left-2 text-white text-[11px] px-2 py-1 rounded-full ${badgeColor}">رتبه ${rank}</div>
        <img src="${img}" class="w-full h-32 object-cover rounded-xl mb-2" onerror="this.src='assets/images/no-image.png'" />
        <h3 class="text-sm font-bold text-gray-800 truncate">${name}</h3>
        <p class="text-xs text-gray-600 truncate">${loc}</p>
        <div class="flex items-center justify-between mt-2">
          <span class="bg-emerald-100 text-emerald-600 text-[11px] px-2 py-1 rounded-full">${category}</span>
          <span class="text-[10px] text-gray-400">${visits} بازدید</span>
        </div>
        <button class="card-action-btn" onclick="event.stopPropagation();" style="margin-top: 10px;">
          مشاهده
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '<p class="text-red-500 text-center w-full p-7">خطا در بارگذاری فروشگاه‌ها</p>';
  }
}

window.addEventListener('DOMContentLoaded', loadMostVisitedStores);







// زکی - نسخه اصلاح شده loadPopularProducts

// زکی – نسخهٔ نهایی loadPopularProducts با
// ✔︎ دسته‌بندی فروشگاه در بالای کارت
// ✔︎ مکان فروشگاه به جای امتیاز ⭐️

const POPULAR_PRODUCTS_SECTION_SLUG = 'popular-products';

function renderPopularProductsSection(section) {
  const slider = document.getElementById('popular-products-slider');
  const titleEl = document.getElementById('popular-products-title');
  const titleSpan = titleEl?.querySelector('span') || titleEl;
  const subtitleEl = document.getElementById('popular-products-subtitle');
  const ctaEl = document.getElementById('popular-products-cta');

  if (titleSpan && section?.title) {
    titleSpan.textContent = section.title;
  }

  if (subtitleEl) {
    const subtitle = section?.subtitle?.trim() || section?.description?.trim() || '';
    if (subtitle) {
      subtitleEl.textContent = subtitle;
      subtitleEl.classList.remove('hidden');
    } else {
      subtitleEl.textContent = '';
      subtitleEl.classList.add('hidden');
    }
  }

  if (ctaEl) {
    const label = section?.viewAllText?.trim();
    const href = section?.viewAllLink?.trim();
    ctaEl.textContent = label || 'مشاهده همه';
    if (href) {
      ctaEl.href = href;
      if (/^https?:/i.test(href)) {
        ctaEl.target = '_blank';
        ctaEl.rel = 'noopener';
      } else {
        ctaEl.target = '_self';
        ctaEl.removeAttribute('rel');
      }
      ctaEl.classList.remove('pointer-events-none', 'opacity-60');
    } else {
      ctaEl.href = '#';
      ctaEl.target = '_self';
      ctaEl.rel = 'nofollow noopener';
      ctaEl.classList.add('pointer-events-none', 'opacity-60');
    }
  }

  const cards = Array.isArray(section?.cards)
    ? [...section.cards].filter((card) => card && card.isActive !== false)
    : [];

  if (!cards.length) {
    slider.innerHTML = '<div class="text-gray-400 text-center w-full p-7">هیچ کارت فعالی ثبت نشده است.</div>';
    updateSliderNavVisibility('popular-products-slider');
    return false;
  }

  slider.innerHTML = '';

  cards
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .forEach((card) => {
      const elementTag = card.link ? 'a' : 'div';
      const cardEl = document.createElement(elementTag);
      cardEl.className = `
        group glass popular-product-card min-w-[265px] max-w-[280px] flex-shrink-0 flex flex-col
        p-4 rounded-3xl shadow-xl border border-[#0ea5e9]/20 bg-white/95 backdrop-blur-[5px]
        hover:-translate-y-1 hover:shadow-2xl hover:border-[#0ea5e9]/40 transition-all duration-300
      `;

      if (card.link) {
        cardEl.href = card.link;
        if (/^https?:/i.test(card.link)) {
          cardEl.target = '_blank';
          cardEl.rel = 'noopener';
        } else {
          cardEl.target = '_self';
          cardEl.removeAttribute('rel');
        }
      }

      const imageUrl = card.imageUrl?.trim() || 'assets/images/no-image.png';
      const tag = card.tag ? `<span class="absolute top-2 right-2 text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-[#10b981] to-[#0ea5e9] text-white shadow-md">${escapeHTML(card.tag)}</span>` : '';
      const description = card.description
        ? `<p class="popular-card-description text-sm text-gray-600 leading-relaxed">${escapeHTML(card.description)}</p>`
        : '';
      const location = card.location
        ? `<div class="popular-card-location flex flex-row-reverse items-center justify-end gap-2 text-sm text-gray-700 font-bold">
            <svg width="18" height="18" fill="none" viewBox="0 0 22 22">
              <circle cx="11" cy="11" r="10" fill="#e0f7fa"/>
              <path d="M11 2.5C7.13 2.5 4 5.61 4 9.45c0 3.52 4.1 7.93 6.2 10.01.46.47 1.2.47 1.66 0 2.1-2.08 6.14-6.49 6.14-10.01C18 5.61 14.87 2.5 11 2.5Z" fill="#10b981"/>
              <circle cx="11" cy="9" r="2.5" fill="#0ea5e9"/>
            </svg>
            <span class="truncate">${escapeHTML(card.location)}</span>
          </div>`
        : '';
      const price = card.price
        ? `<div class="popular-card-price self-center inline-flex items-center justify-center bg-gradient-to-r from-[#10b981]/10 to-[#0ea5e9]/10 px-4 py-1 rounded-full text-[#10b981] font-extrabold text-base shadow-sm text-center">${escapeHTML(card.price)}</div>`
        : '';
      const button = card.buttonText
        ? `<span class="popular-card-link inline-flex items-center gap-2 text-sm font-bold text-[#0ea5e9] bg-[#e0fdfa] px-4 py-1.5 rounded-full shadow-sm">${escapeHTML(card.buttonText)}<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M7 7h10v10"/></svg></span>`
        : '';

      cardEl.innerHTML = `
        <div class="popular-card-image w-full h-[130px] sm:h-[170px] rounded-2xl mb-5 flex items-center justify-center relative overflow-hidden" style="background:linear-gradient(120deg,#d4fbe8,#e0fdfa,#c8f7e6); box-shadow:inset 0 2px 10px rgba(16,185,129,0.1);">
          <img src="${imageUrl}" alt="${escapeHTML(card.title)}" class="w-full h-full object-cover group-hover:brightness-105 transition-all duration-300" onerror="this.src='assets/images/no-image.png'"/>
          ${tag}
        </div>
        <div class="popular-card-body flex flex-col gap-3 w-full text-right">
          <h4 class="font-extrabold text-lg sm:text-xl bg-gradient-to-r from-[#10b981] to-[#0ea5e9] bg-clip-text text-transparent leading-8">
            ${escapeHTML(card.title)}
          </h4>
          ${description}
          ${location}
          ${price}
        </div>
        <div class="popular-card-footer w-full">
          ${button || `<button class="card-action-btn w-full justify-center" onclick="event.stopPropagation();">
            مشاهده
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>`}
        </div>
      `;

      slider.appendChild(cardEl);
    });

  updateSliderNavVisibility('popular-products-slider');
  return true;
}

async function loadPopularProductsFallback(slider) {
  try {
    const res = await fetch('http://localhost:5000/api/products/latest-products');
    if (!res.ok) throw new Error('Network error');

    const payload = await res.json();
    const products = Array.isArray(payload) ? payload : payload.products;

    if (!products?.length) {
      slider.innerHTML = '<div class="text-gray-400 text-center w-full p-7">محصولی یافت نشد.</div>';
      updateSliderNavVisibility('popular-products-slider');
      return;
    }

    slider.innerHTML = '';

    products.forEach((p) => {
      const cat = p.sellerCategory || p.category || 'نامشخص';
      const loc = p.sellerLocation || '—';
      const img = p.images?.[0] ?? 'assets/images/no-image.png';
      const priceText = (p.price ?? 0).toLocaleString() + ' تومان';

      const card = document.createElement('a');
      card.href = p._id ? `product.html?id=${p._id}` : '#';
      card.target = '_blank';
      card.rel = 'noopener';
      card.className = `
        group glass popular-product-card min-w-[265px] max-w-[280px] flex-shrink-0 flex flex-col
        p-4 rounded-3xl shadow-xl border border-[#0ea5e9]/20 bg-white/95 backdrop-blur-[5px]
        hover:-translate-y-1 hover:shadow-2xl hover:border-[#0ea5e9]/40 transition-all duration-300
      `;

      card.innerHTML = `
        <div class="popular-card-image w-full h-[130px] sm:h-[170px] rounded-2xl mb-5 flex items-center justify-center relative overflow-hidden" style="background:linear-gradient(120deg,#d4fbe8,#e0fdfa,#c8f7e6); box-shadow:inset 0 2px 10px rgba(16,185,129,0.1);">
          <img src="${img}" alt="${escapeHTML(p.title)}" class="w-full h-full object-cover group-hover:brightness-105 transition-all duration-300"/>
          <span class="absolute top-2 right-2 text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-[#10b981] to-[#0ea5e9] text-white shadow-md">
            ${escapeHTML(cat)}
          </span>
        </div>
        <div class="popular-card-body flex flex-col gap-3 w-full text-right">
          <h4 class="font-extrabold text-lg sm:text-xl bg-gradient-to-r from-[#10b981] to-[#0ea5e9] bg-clip-text text-transparent leading-8">
            ${escapeHTML(p.title)}
          </h4>
          <div class="popular-card-location flex flex-row-reverse items-center justify-end gap-2 text-sm text-gray-700 font-bold">
            <svg width="18" height="18" fill="none" viewBox="0 0 22 22">
              <circle cx="11" cy="11" r="10" fill="#e0f7fa"/>
              <path d="M11 2.5C7.13 2.5 4 5.61 4 9.45c0 3.52 4.1 7.93 6.2 10.01.46.47 1.2.47 1.66 0 2.1-2.08 6.14-6.49 6.14-10.01C18 5.61 14.87 2.5 11 2.5Z" fill="#10b981"/>
              <circle cx="11" cy="9" r="2.5" fill="#0ea5e9"/>
            </svg>
            <span class="truncate">${escapeHTML(loc)}</span>
          </div>
          <div class="popular-card-price self-center inline-flex items-center justify-center bg-gradient-to-r from-[#10b981]/10 to-[#0ea5e9]/10 px-4 py-1 rounded-full text-[#10b981] font-extrabold text-base shadow-sm text-center">
            ${escapeHTML(priceText)}
          </div>
        </div>
        <div class="popular-card-footer w-full">
          <button class="card-action-btn w-full justify-center" onclick="event.stopPropagation();">
            مشاهده
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
        </div>
      `;
      slider.appendChild(card);
    });

    updateSliderNavVisibility('popular-products-slider');
  } catch (err) {
    slider.innerHTML = '<div class="text-red-500 text-center w-full p-7">مشکلی در بارگذاری محصولات پیش آمد.</div>';
    updateSliderNavVisibility('popular-products-slider');
    console.error(err);
  }
}

async function loadPopularProducts() {
  const slider = document.getElementById('popular-products-slider');
  slider.innerHTML = '<div style="margin: 60px auto;">در حال بارگذاری...</div>';
  updateSliderNavVisibility('popular-products-slider');

  let customLoaded = false;
  try {
    const res = await fetch('/api/home-card-sections');
    if (!res.ok) {
      throw new Error(`Failed to fetch home sections: ${res.status}`);
    }

    const sections = await res.json();
    const section = Array.isArray(sections)
      ? sections.find((item) => item?.slug === POPULAR_PRODUCTS_SECTION_SLUG)
      : null;

    if (section) {
      customLoaded = renderPopularProductsSection(section);
    }
  } catch (err) {
    console.warn('Custom section load failed, falling back to products.', err);
  }

  if (!customLoaded) {
    await loadPopularProductsFallback(slider);
  }
}

// بارگذاری محصولات هنگام آماده‌شدن صفحه
window.addEventListener('DOMContentLoaded', loadPopularProducts);

// اسکرول روان و drag برای مغازه‌های بانتا
const bantaSlider = document.getElementById('banta-shops-section');
let bantaDown = false, bantaStartX, bantaScrollLeft, bantaLastX, bantaVelocity = 0, bantaMomentumID;
function bantaMomentum() {
  if (Math.abs(bantaVelocity) > 0.4) {
    bantaSlider.scrollLeft -= bantaVelocity;
    bantaVelocity *= 0.93;
    bantaMomentumID = requestAnimationFrame(bantaMomentum);
  } else {
    cancelAnimationFrame(bantaMomentumID);
    bantaVelocity = 0;
  }
}
bantaSlider.addEventListener('mousedown', (e) => {
  bantaDown = true;
  bantaStartX = e.pageX - bantaSlider.offsetLeft;
  bantaLastX = e.pageX;
  bantaScrollLeft = bantaSlider.scrollLeft;
  bantaVelocity = 0;
  cancelAnimationFrame(bantaMomentumID);
});
bantaSlider.addEventListener('mousemove', (e) => {
  if (!bantaDown) return;
  const x = e.pageX - bantaSlider.offsetLeft;
  bantaSlider.scrollLeft = bantaScrollLeft - (x - bantaStartX);
  bantaVelocity = (e.pageX - bantaLastX);
  bantaLastX = e.pageX;
});
bantaSlider.addEventListener('mouseup', () => {
  bantaDown = false;
  if (Math.abs(bantaVelocity) > 1) bantaMomentum();
});
bantaSlider.addEventListener('mouseleave', () => {
  bantaDown = false;
  if (Math.abs(bantaVelocity) > 1) bantaMomentum();
});
bantaSlider.addEventListener('touchstart', (e) => {
  bantaDown = true;
  bantaStartX = e.touches[0].pageX - bantaSlider.offsetLeft;
  bantaLastX = e.touches[0].pageX;
  bantaScrollLeft = bantaSlider.scrollLeft;
  bantaVelocity = 0;
  cancelAnimationFrame(bantaMomentumID);
}, {passive:true});
bantaSlider.addEventListener('touchmove', (e) => {
  if (!bantaDown) return;
  const x = e.touches[0].pageX - bantaSlider.offsetLeft;
  bantaSlider.scrollLeft = bantaScrollLeft - (x - bantaStartX);
  bantaVelocity = (e.touches[0].pageX - bantaLastX);
  bantaLastX = e.touches[0].pageX;
}, {passive:false});
bantaSlider.addEventListener('touchend', () => {
  bantaDown = false;
  if (Math.abs(bantaVelocity) > 2) bantaMomentum();
}, {passive:true});

async function loadBantaShops() {
  const slider = document.getElementById('banta-shops-section');
  const wrapper = document.getElementById('banta-shops-wrapper');
  if (!slider || !wrapper) {
    return;
  }

  wrapper.classList.add('hidden');
  slider.innerHTML = '';
  updateSliderNavVisibility('banta-shops-section');
  try {
    const res = await fetch('/api/shops');
    if (!res.ok) throw new Error('network');
    const data = await res.json();
    const shopsAll = Array.isArray(data) ? data : [];
    const shops = shopsAll
      .filter(s => /بانتا/i.test(s.address || ''))
      .slice(0, 4);
    slider.innerHTML = '';
    updateSliderNavVisibility('banta-shops-section');
    if (!shops.length) {
      return;
    }
    shops.forEach(shop => {
      const badge = shop.category && shop.category.trim()
        ? `<span class="inline-block bg-[#10b981]/10 text-[#10b981] text-xs font-bold px-3 py-1 rounded-full">${shop.category}</span>`
        : `<span class="inline-block bg-[#cbd5e1]/40 text-[#64748b] text-xs font-bold px-3 py-1 rounded-full">سایر</span>`;

      const card = document.createElement('a');
      card.href = shop.shopurl ? `shop.html?shopurl=${shop.shopurl}` : '#';
      card.className = 'group glass min-w-[265px] max-w-xs flex-shrink-0 flex flex-col items-center p-4 rounded-2xl shadow-xl border hover:scale-[1.04] hover:shadow-2xl bg-white/90 backdrop-blur-[3px] transition-all duration-200';
      card.innerHTML = `
        <div class="w-full h-[120px] sm:h-[160px] rounded-xl mb-5 flex items-center justify-center relative overflow-hidden" style="background:linear-gradient(100deg,#e0fdfa,#d4fbe8);">
          ${shop.boardImage ? `<img src="${shop.boardImage}" class="object-cover w-full h-full absolute inset-0 rounded-xl" alt="${shop.storename}">` : (shop.banner ? `<img src="${shop.banner}" class="object-cover w-full h-full absolute inset-0 rounded-xl" alt="${shop.storename}">` : `<div class="flex items-center justify-center w-full h-full absolute inset-0 rounded-xl text-gray-300 text-4xl font-black">?</div>`)}
        </div>
        <div class="w-full flex flex-col items-center mb-2">
          <span class="font-extrabold text-lg sm:text-xl text-[#10b981] mb-1">${shop.storename}</span>
        </div>
        <div class="flex items-center justify-center gap-2 mb-1 w-full">
          <svg width="18" height="18" fill="none" viewBox="0 0 22 22">
            <circle cx="11" cy="11" r="10" fill="#e0f7fa"/>
            <path d="M11 2.5C7.13 2.5 4 5.61 4 9.45c0 3.52 4.1 7.93 6.2 10.01.46.47 1.2.47 1.66 0 2.1-2.08 6.14-6.49 6.14-10.01C18 5.61 14.87 2.5 11 2.5Zm0 10.25a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5Z" fill="#10b981"/>
          </svg>
          <span class="text-gray-700 text-sm sm:text-base font-bold truncate max-w-[180px]">${shop.address}</span>
        </div>
        <div class="flex items-center justify-center gap-2 mt-2 w-full">
          ${badge}
        </div>
        <button class="card-action-btn" onclick="event.stopPropagation();">
          مشاهده
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
      `;
      slider.appendChild(card);
    });

    wrapper.classList.remove('hidden');
    updateSliderNavVisibility('banta-shops-section');
  } catch (err) {
    console.error('خطا در دریافت مغازه‌های بانتا:', err);
    slider.innerHTML = '';
    updateSliderNavVisibility('banta-shops-section');
  }
}

window.addEventListener('DOMContentLoaded', loadBantaShops);


function shopMatchesShoesBags(shop) {
  if (!shop) return false;
  const keywordSource = [
    shop.category,
    Array.isArray(shop.categories) ? shop.categories.join(' ') : '',
    Array.isArray(shop.tags) ? shop.tags.join(' ') : shop.tags,
    shop.storename,
    shop.name,
    shop.desc,
  ]
    .filter(Boolean)
    .join(' ');

  if (!keywordSource) return false;

  const haystack = normalizeText(keywordSource);
  const keywords = ['کیف', 'کفش', 'bag', 'shoe', 'boots', 'boot', 'صندل'];
  return keywords.some(keyword => haystack.includes(normalizeText(keyword)));
}

function resolveShopImage(shop) {
  const candidate = shop?.boardImage || shop?.banner || (Array.isArray(shop?.images) ? shop.images[0] : shop?.image);
  let src = candidate || 'assets/images/no-image.png';
  if (/^https?:/i.test(src) || src.startsWith('data:') || src.startsWith('//')) {
    return src;
  }
  if (src.startsWith('/')) {
    return src;
  }
  return `/${src.replace(/^\/+/, '')}`;
}

async function loadShoesAndBagsShops() {
  const slider = document.getElementById('shoes-bags-slider');
  if (!slider) return;

  slider.innerHTML = '<div style="margin:60px auto;">در حال بارگذاری...</div>';
  updateSliderNavVisibility('shoes-bags-slider');

  try {
    const res = await fetch('/api/shops');
    if (!res.ok) throw new Error('network');

    const raw = await res.json();
    const shops = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.shops)
        ? raw.shops
        : [];

    const filtered = shops.filter(shopMatchesShoesBags).slice(0, 8);

    slider.innerHTML = '';

    if (!filtered.length) {
      slider.innerHTML = '<p class="text-gray-500 text-center py-8">هیچ فروشگاه کیف و کفشی پیدا نشد.</p>';
      updateSliderNavVisibility('shoes-bags-slider');
      return;
    }

    filtered.forEach(shop => {
      const card = document.createElement('a');
      const href = shop?.shopurl ? `shop.html?shopurl=${encodeURIComponent(shop.shopurl)}` : '#';
      card.href = href;
      card.className = 'group glass min-w-[265px] max-w-xs flex-shrink-0 flex flex-col items-center p-4 rounded-2xl shadow-xl border hover:scale-[1.04] hover:shadow-2xl bg-white/90 backdrop-blur-[3px] transition-all duration-200';

      const badgeText = (Array.isArray(shop?.badges) ? shop.badges[0] : shop?.badge) || '';
      const categoryText = shop?.category || (Array.isArray(shop?.categories) ? shop.categories[0] : 'کیف و کفش');
      const tagText = Array.isArray(shop?.tags) ? shop.tags[0] : (shop?.specialty || '');
      const locationText = shop?.address || shop?.location || '';
      const name = shop?.storename || shop?.name || 'فروشگاه بدون نام';

      const badgeTemplate = badgeText
        ? `<span class="absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-full bg-[#10b981] text-white bg-opacity-80">${escapeHTML(badgeText)}</span>`
        : '';

      const tagTemplate = tagText
        ? `<span class="inline-block bg-[#10b981]/10 text-[#10b981] text-xs font-bold px-3 py-1 rounded-full">${escapeHTML(tagText)}</span>`
        : '';

      card.innerHTML = `
        <div class="w-full h-[120px] sm:h-[160px] rounded-xl mb-5 flex items-center justify-center relative overflow-hidden" style="background:linear-gradient(100deg,#e0fdfa,#d4fbe8);">
          <img src="${resolveShopImage(shop)}" class="object-cover w-full h-full absolute inset-0 rounded-xl" alt="${escapeHTML(name)}" onerror="this.src='assets/images/no-image.png'">
          ${badgeTemplate}
        </div>
        <div class="w-full flex flex-col items-center mb-2">
          <span class="font-extrabold text-lg sm:text-xl text-[#10b981] mb-1">${escapeHTML(name)}</span>
        </div>
        <div class="flex items-center justify-center gap-2 mb-1 w-full">
          <svg width="18" height="18" fill="none" viewBox="0 0 22 22">
            <circle cx="11" cy="11" r="10" fill="#e0f7fa"/>
            <path d="M11 2.5C7.13 2.5 4 5.61 4 9.45c0 3.52 4.1 7.93 6.2 10.01.46.47 1.2.47 1.66 0 2.1-2.08 6.14-6.49 6.14-10.01C18 5.61 14.87 2.5 11 2.5Zm0 10.25a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5Z" fill="#10b981"/>
          </svg>
          <span class="text-gray-700 text-sm sm:text-base font-bold truncate max-w-[180px]">${escapeHTML(locationText || '—')}</span>
        </div>
        <div class="flex items-center justify-center gap-2 mt-2 w-full">
          ${tagTemplate || `<span class="inline-block bg-[#10b981]/10 text-[#10b981] text-xs font-bold px-3 py-1 rounded-full">${escapeHTML(categoryText)}</span>`}
        </div>
        <button class="card-action-btn" onclick="event.stopPropagation();">
          مشاهده
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
      `;

      slider.appendChild(card);
    });

    updateSliderNavVisibility('shoes-bags-slider');
  } catch (err) {
    slider.innerHTML = '<p class="text-red-500 text-center py-8">خطا در دریافت فروشگاه‌های کیف و کفش. لطفا دوباره تلاش کنید.</p>';
    updateSliderNavVisibility('shoes-bags-slider');
    console.error(err);
  }
}

window.addEventListener('DOMContentLoaded', loadShoesAndBagsShops);


const SERVICE_SHOWCASE_CONFIGS = [
  {
    sliderId: 'hair-salon-slider',
    keywords: [
      'آرایشگاه مردانه',
      'پیرایش مردانه',
      'سالن پیرایش مردانه',
      'آرایشگاه آقایان',
      'پیرایش آقایان',
      'barbershop',
      'barber shop',
      'barber'
    ],
    tonePalette: ['emerald', 'rose', 'mint', 'purple', 'sky', 'teal'],
    chipFallback: 'آرایشگاه مردانه ثبت‌شده',
    emptyMessage: 'هیچ آرایشگاه مردانه ثبت‌شده‌ای یافت نشد.',
    city: 'سنندج'
  },
  {
    sliderId: 'carwash-slider',
    keywords: ['کارواش', 'carwash', 'کار واش', 'دیتیلینگ', 'سرامیک', 'خودرو'],
    tonePalette: ['sky', 'teal', 'mint', 'indigo'],
    chipFallback: 'کارواش ثبت‌شده',
    emptyMessage: 'هیچ کارواش ثبت‌شده‌ای یافت نشد.',
    city: 'سنندج'
  }
];

function truncateText(input, maxLength) {
  const text = (input || '').toString().trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function shopMatchesConfig(shop, config) {
  if (!shop) return false;

  const normalizedKeywords = config.keywords.map(normalizeText);
  const haystackSource = [
    shop.storename,
    shop.name,
    shop.category,
    shop.subcategory,
    Array.isArray(shop.tags) ? shop.tags.join(' ') : shop.tags,
    shop.desc
  ]
    .filter(Boolean)
    .join(' ');

  if (!haystackSource) return false;

  const haystack = normalizeText(haystackSource);
  const matchesKeyword = normalizedKeywords.some(keyword => keyword && haystack.includes(keyword));
  if (!matchesKeyword) return false;

  const cityNeedle = normalizeText(config.city || '');
  if (!cityNeedle) return true;

  const locationParts = [shop.address, shop.city, shop.region]
    .map(part => normalizeText(part))
    .filter(Boolean);

  const locationHaystack = locationParts.join(' ');

  if (locationHaystack.includes(cityNeedle) || haystack.includes(cityNeedle)) {
    return true;
  }

  if (!locationParts.length) {
    // برخی از فروشگاه‌های تازه ثبت‌شده هنوز شهر خود را وارد نکرده‌اند.
    // در حال حاضر تنها شهر فعال پلتفرم سنندج است، بنابراین در صورت نبود
    // اطلاعات لوکیشن، فروشگاه را مطابقت می‌دهیم تا در vitrine دیده شود.
    return true;
  }

  const locationTokens = locationParts
    .flatMap(part => part.split(/[،,]/))
    .map(token => token.trim())
    .filter(Boolean);

  return locationTokens.some(token => token.includes(cityNeedle));
}

function renderServiceShowcase(config, shops) {
  const slider = document.getElementById(config.sliderId);
  if (!slider) return;

  const section = slider.closest('section');

  slider.innerHTML = '';

  if (!shops.length) {
    if (section) section.classList.add('hidden');
    updateSliderNavVisibility(config.sliderId);
    return;
  }

  if (section) section.classList.remove('hidden');

  shops.forEach((shop, index) => {
    const tone = config.tonePalette[index % config.tonePalette.length];
    const card = document.createElement('a');
    card.className = 'featured-service-card group';
    card.dataset.tone = tone;

    const href = shop?.shopurl ? `shop.html?shopurl=${encodeURIComponent(shop.shopurl)}` : '#';
    card.href = href;

    const chipText = shop?.subcategory || shop?.category || config.chipFallback;
    const description = truncateText(shop?.desc || 'این کسب‌وکار در ویترینت ثبت شده است.', 110);
    const locationText = shop?.address || shop?.city || config.city || '';
    const imageSrc = resolveShopImage(shop);
    const altText = shop?.storename
      ? `تصویر ${shop.storename}`
      : `کسب‌وکار ثبت‌شده در ویترینت`;

    card.innerHTML = `
      <div class="featured-service-card__media">
        <span class="featured-service-card__chip">${escapeHTML(chipText)}</span>
        <img class="featured-service-card__image" loading="lazy" src="${escapeHTML(imageSrc)}" alt="${escapeHTML(altText)}" onerror="this.src='assets/images/no-image.png'" />
      </div>
      <div class="featured-service-card__body">
        <h4 class="featured-service-card__title">${escapeHTML(shop?.storename || shop?.name || 'فروشگاه بدون نام')}</h4>
        <p class="featured-service-card__description">${escapeHTML(description)}</p>
      </div>
      <div class="featured-service-card__footer">
        <span class="featured-service-card__location">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
          </svg>
          ${escapeHTML(locationText)}
        </span>
        <div class="featured-service-card__actions">
          <span class="featured-service-card__quick-book" aria-label="رزرو سریع">رزرو سریع</span>
        </div>
      </div>
    `;

    slider.appendChild(card);
  });

  updateSliderNavVisibility(config.sliderId);
}

async function loadServiceShowcases() {
  const activeConfigs = SERVICE_SHOWCASE_CONFIGS
    .map(config => {
      const element = document.getElementById(config.sliderId);
      if (!element) return null;
      const section = element.closest('section');
      if (section) section.classList.add('hidden');
      return { ...config, element, section };
    })
    .filter(Boolean)
    .filter(entry => entry.element);

  if (!activeConfigs.length) return;

  activeConfigs.forEach(entry => {
    entry.element.innerHTML = '<p class="w-full text-center text-sm sm:text-base text-gray-400 py-6">در حال بارگذاری...</p>';
  });

  let shops = [];
  try {
    const res = await fetch('/api/shops');
    if (!res.ok) throw new Error('network');
    const raw = await res.json();
    shops = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.shops)
        ? raw.shops
        : [];
  } catch (err) {
    activeConfigs.forEach(entry => {
      entry.element.innerHTML = '<p class="w-full text-center text-sm sm:text-base text-red-500 py-6">خطا در دریافت کسب‌وکارهای ثبت‌شده.</p>';
      if (entry.section) entry.section.classList.remove('hidden');
      updateSliderNavVisibility(entry.sliderId);
    });
    console.error('loadServiceShowcases error', err);
    return;
  }

  const validShops = shops.filter(shop => shop && (shop.storename || shop.name || shop.shopurl));

  activeConfigs.forEach(config => {
    const matched = validShops.filter(shop => shopMatchesConfig(shop, config)).slice(0, config.tonePalette.length);
    renderServiceShowcase(config, matched);
  });
}

window.addEventListener('DOMContentLoaded', loadServiceShowcases);


// ====== آدرس API سرور (در صورت نیاز کامل کن: http://yourdomain.com/api/shopping-centers) ======
const API_URL = '/api/shopping-centers';

// آیکون لوکیشن
const locationSVG = `
<svg width="18" height="18" fill="none" viewBox="0 0 22 22">
  <circle cx="11" cy="11" r="10" fill="#e0f7fa"/>
  <path d="M11 2.5C7.13 2.5 4 5.61 4 9.45c0 3.52 4.1 7.93 6.2 10.01.46.47 1.2.47 1.66 0 2.1-2.08 6.14-6.49 6.14-10.01C18 5.61 14.87 2.5 11 2.5Zm0 10.25a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5Z" fill="#10b981"/>
</svg>
`;

// توکن نیاز داشتی اینجا بذار
const FETCH_OPTIONS = {
  // headers: { "Authorization": "Bearer YOUR_TOKEN" }
};

// رندر کارت‌ها از دیتا
function renderSliderCenters(centers) {
  const slider = document.getElementById('shopping-centers-slider');
  slider.innerHTML = '';
  updateSliderNavVisibility('shopping-centers-slider');
  if (!centers.length) {
    slider.innerHTML = "<div style='color:#bbb; margin:70px auto; font-size:1.2rem;'>هنوز مرکز خریدی ثبت نشده!</div>";
    updateSliderNavVisibility('shopping-centers-slider');
    return;
  }
  centers.forEach((center, i) => {
    let imageSrc = center.image ? (
      center.image.startsWith('/') ? center.image : '/' + center.image
    ) : 'https://via.placeholder.com/320x220?text=عکس+مرکز+خرید';
    let card = document.createElement('a');
    card.href = center._id
  ? `shopping-centers-shops.html?centerId=${center._id}`
      + `&title=${encodeURIComponent(center.title || '')}`
  : '#';
card.target = '_blank';  // اصلاح: باز شدن در تب جدید
    card.className = "group glass min-w-[265px] max-w-xs flex-shrink-0 flex flex-col items-center p-4 rounded-2xl shadow-2xl border-2 border-[#0ea5e9]/20 hover:scale-[1.04] hover:shadow-2xl hover:border-[#0ea5e9]/40 bg-white/95 backdrop-blur-[5px] transition-all duration-300 center-card";
    card.innerHTML = `
      <div class="w-full h-[130px] sm:h-[170px] rounded-xl mb-5 flex items-center justify-center relative overflow-hidden" style="background:linear-gradient(120deg,#d4fbe8,#e0fdfa,#c8f7e6); box-shadow:inset 0 2px 10px rgba(16,185,129,0.1);">
        <img src="${imageSrc}" class="object-cover w-full h-full absolute inset-0 rounded-xl group-hover:brightness-105 transition-all duration-300" alt="${center.title || ''}">
        ${center.tag ? `<span class="absolute top-2 right-2 text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-[#10b981] to-[#0ea5e9] text-white shadow-md">${center.tag}</span>` : ""}
      </div>
      <div class="w-full flex flex-col items-center mb-2">
        <span class="font-extrabold text-lg sm:text-xl bg-gradient-to-r from-[#10b981] to-[#0ea5e9] bg-clip-text text-transparent mb-1">${center.title || ''}</span>
      </div>
      <div class="flex items-center justify-center gap-2 mb-1 w-full">
        ${locationSVG}
        <span class="text-gray-700 text-sm sm:text-base font-bold truncate max-w-[180px]">${center.location || ''}</span>
      </div>
      <div class="flex items-center justify-center gap-2 mt-2 w-full">
        ${center.description ? `<span class="inline-block bg-[#10b981]/10 text-[#0ea5e9] text-xs font-bold px-3 py-1 rounded-full shadow-sm">${center.description}</span>` : ""}
      </div>
      <button class="card-action-btn" onclick="event.stopPropagation();">
        مشاهده
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
    `;
    slider.appendChild(card);
  });

  updateSliderNavVisibility('shopping-centers-slider');
}

// گرفتن دیتا از سرور و نمایش
fetch(API_URL, FETCH_OPTIONS)
  .then(res => res.json())
  .then(centers => {
    renderSliderCenters(centers);
  })
  .catch(err => {
    document.getElementById('shopping-centers-slider').innerHTML = "<div style='color:#ff0000;'>خطا در دریافت مراکز خرید!</div>";
    updateSliderNavVisibility('shopping-centers-slider');
  });

// --- اسکرول drag/momentum ---
const centersSlider = document.getElementById('shopping-centers-slider');
let centersDown = false, centersStartX, centersScrollLeft, centersLastX, centersVelocity = 0, centersMomentumID;
function centersMomentum() {
  if (Math.abs(centersVelocity) > 0.4) {
    centersSlider.scrollLeft -= centersVelocity;
    centersVelocity *= 0.93;
    centersMomentumID = requestAnimationFrame(centersMomentum);
  } else {
    cancelAnimationFrame(centersMomentumID);
    centersVelocity = 0;
  }
}
centersSlider.addEventListener('mousedown', (e) => {
  centersDown = true;
  centersStartX = e.pageX - centersSlider.offsetLeft;
  centersLastX = e.pageX;
  centersScrollLeft = centersSlider.scrollLeft;
  centersVelocity = 0;
  cancelAnimationFrame(centersMomentumID);
});
centersSlider.addEventListener('mousemove', (e) => {
  if (!centersDown) return;
  const x = e.pageX - centersSlider.offsetLeft;
  centersSlider.scrollLeft = centersScrollLeft - (x - centersStartX);
  centersVelocity = (e.pageX - centersLastX);
  centersLastX = e.pageX;
});
centersSlider.addEventListener('mouseup', () => {
  centersDown = false;
  if (Math.abs(centersVelocity) > 1) centersMomentum();
});
centersSlider.addEventListener('mouseleave', () => {
  centersDown = false;
  if (Math.abs(centersVelocity) > 1) centersMomentum();
});
centersSlider.addEventListener('touchstart', (e) => {
  centersDown = true;
  centersStartX = e.touches[0].pageX - centersSlider.offsetLeft;
  centersLastX = e.touches[0].pageX;
  centersScrollLeft = centersSlider.scrollLeft;
  centersVelocity = 0;
  cancelAnimationFrame(centersMomentumID);
}, {passive:true});
centersSlider.addEventListener('touchmove', (e) => {
  if (!centersDown) return;
  const x = e.touches[0].pageX - centersSlider.offsetLeft;
  centersSlider.scrollLeft = centersScrollLeft - (x - centersStartX);
  centersVelocity = (e.touches[0].pageX - centersLastX);
  centersLastX = e.touches[0].pageX;
}, {passive:false});
centersSlider.addEventListener('touchend', () => {
  centersDown = false;
  if (Math.abs(centersVelocity) > 2) centersMomentum();
}, {passive:true});


const shoesBagsSlider = document.getElementById('shoes-bags-slider');
if (shoesBagsSlider) {
  let shoesBagsDown = false, shoesBagsStartX, shoesBagsScrollLeft, shoesBagsLastX, shoesBagsVelocity = 0, shoesBagsMomentumID;
  function shoesBagsMomentum() {
    if (Math.abs(shoesBagsVelocity) > 0.4) {
      shoesBagsSlider.scrollLeft -= shoesBagsVelocity;
      shoesBagsVelocity *= 0.93;
      shoesBagsMomentumID = requestAnimationFrame(shoesBagsMomentum);
    } else {
      cancelAnimationFrame(shoesBagsMomentumID);
      shoesBagsVelocity = 0;
    }
  }
  shoesBagsSlider.addEventListener('mousedown', (e) => {
    shoesBagsDown = true;
    shoesBagsStartX = e.pageX - shoesBagsSlider.offsetLeft;
    shoesBagsLastX = e.pageX;
    shoesBagsScrollLeft = shoesBagsSlider.scrollLeft;
    shoesBagsVelocity = 0;
    cancelAnimationFrame(shoesBagsMomentumID);
  });
  shoesBagsSlider.addEventListener('mousemove', (e) => {
    if (!shoesBagsDown) return;
    const x = e.pageX - shoesBagsSlider.offsetLeft;
    shoesBagsSlider.scrollLeft = shoesBagsScrollLeft - (x - shoesBagsStartX);
    shoesBagsVelocity = (e.pageX - shoesBagsLastX);
    shoesBagsLastX = e.pageX;
  });
  shoesBagsSlider.addEventListener('mouseup', () => {
    shoesBagsDown = false;
    if (Math.abs(shoesBagsVelocity) > 1) shoesBagsMomentum();
  });
  shoesBagsSlider.addEventListener('mouseleave', () => {
    shoesBagsDown = false;
    if (Math.abs(shoesBagsVelocity) > 1) shoesBagsMomentum();
  });
  shoesBagsSlider.addEventListener('touchstart', (e) => {
    shoesBagsDown = true;
    shoesBagsStartX = e.touches[0].pageX - shoesBagsSlider.offsetLeft;
    shoesBagsLastX = e.touches[0].pageX;
    shoesBagsScrollLeft = shoesBagsSlider.scrollLeft;
    shoesBagsVelocity = 0;
    cancelAnimationFrame(shoesBagsMomentumID);
  }, {passive:true});
  shoesBagsSlider.addEventListener('touchmove', (e) => {
    if (!shoesBagsDown) return;
    const x = e.touches[0].pageX - shoesBagsSlider.offsetLeft;
    shoesBagsSlider.scrollLeft = shoesBagsScrollLeft - (x - shoesBagsStartX);
    shoesBagsVelocity = (e.touches[0].pageX - shoesBagsLastX);
    shoesBagsLastX = e.touches[0].pageX;
  }, {passive:false});
  shoesBagsSlider.addEventListener('touchend', () => {
    shoesBagsDown = false;
    if (Math.abs(shoesBagsVelocity) > 2) shoesBagsMomentum();
  }, {passive:true});
}


const slider2 = document.getElementById('popular-products-slider');
let down2 = false, startX2, scrollLeft2, lastX2, velocity2 = 0, drag2 = false, momentumID2;
function momentum2() {
  if (Math.abs(velocity2) > 0.4) {
    slider2.scrollLeft -= velocity2;
    velocity2 *= 0.93;
    momentumID2 = requestAnimationFrame(momentum2);
  } else {
    cancelAnimationFrame(momentumID2);
    velocity2 = 0;
  }
}
slider2.addEventListener('mousedown', (e) => {
  down2 = true; drag2 = false;
  startX2 = e.pageX - slider2.offsetLeft;
  lastX2 = e.pageX;
  scrollLeft2 = slider2.scrollLeft;
  velocity2 = 0;
  cancelAnimationFrame(momentumID2);
});
slider2.addEventListener('mousemove', (e) => {
  if (!down2) return;
  drag2 = true;
  const x = e.pageX - slider2.offsetLeft;
  slider2.scrollLeft = scrollLeft2 - (x - startX2);
  velocity2 = (e.pageX - lastX2);
  lastX2 = e.pageX;
});
slider2.addEventListener('mouseup', () => {
  down2 = false;
  if (Math.abs(velocity2) > 1) momentum2();
});
slider2.addEventListener('mouseleave', () => {
  down2 = false;
  if (Math.abs(velocity2) > 1) momentum2();
});
slider2.addEventListener('touchstart', (e) => {
  down2 = true;
  startX2 = e.touches[0].pageX - slider2.offsetLeft;
  lastX2 = e.touches[0].pageX;
  scrollLeft2 = slider2.scrollLeft;
  velocity2 = 0;
  cancelAnimationFrame(momentumID2);
}, {passive:true});
slider2.addEventListener('touchmove', (e) => {
  if (!down2) return;
  const x = e.touches[0].pageX - slider2.offsetLeft;
  slider2.scrollLeft = scrollLeft2 - (x - startX2);
  velocity2 = (e.touches[0].pageX - lastX2);
  lastX2 = e.touches[0].pageX;
}, {passive:false});
slider2.addEventListener('touchend', () => {
  down2 = false;
  if (Math.abs(velocity2) > 2) momentum2();
}, {passive:true});

const slider = document.getElementById('drag-scroll-cards');
let isDown = false;
let startX, scrollLeft, lastX, isDragged = false;
let velocity = 0, momentumID;

function momentum() {
  if (Math.abs(velocity) > 0.4) {
    slider.scrollLeft -= velocity;
    velocity *= 0.93; // عدد کمتر = روان‌تر
    momentumID = requestAnimationFrame(momentum);
  } else {
    cancelAnimationFrame(momentumID);
    velocity = 0;
  }
}

// دسکتاپ موس
slider.addEventListener('mousedown', (e) => {
  isDown = true;
  isDragged = false;
  startX = e.pageX - slider.offsetLeft;
  lastX = e.pageX;
  scrollLeft = slider.scrollLeft;
  velocity = 0;
  cancelAnimationFrame(momentumID);
});
slider.addEventListener('mousemove', (e) => {
  if (!isDown) return;
  isDragged = true;
  const x = e.pageX - slider.offsetLeft;
  const walk = x - startX;
  slider.scrollLeft = scrollLeft - walk;
  velocity = (e.pageX - lastX);
  lastX = e.pageX;
});
slider.addEventListener('mouseup', () => {
  isDown = false;
  if (Math.abs(velocity) > 1) momentum();
});
slider.addEventListener('mouseleave', () => {
  isDown = false;
  if (Math.abs(velocity) > 1) momentum();
});

// موبایل تاچ
slider.addEventListener('touchstart', (e) => {
  isDown = true;
  startX = e.touches[0].pageX - slider.offsetLeft;
  lastX = e.touches[0].pageX;
  scrollLeft = slider.scrollLeft;
  velocity = 0;
  cancelAnimationFrame(momentumID);
}, {passive:true});
slider.addEventListener('touchmove', (e) => {
  if (!isDown) return;
  const x = e.touches[0].pageX - slider.offsetLeft;
  const walk = x - startX;
  slider.scrollLeft = scrollLeft - walk;
  velocity = (e.touches[0].pageX - lastX);
  lastX = e.touches[0].pageX;
}, {passive:false});
slider.addEventListener('touchend', () => {
  isDown = false;
  if (Math.abs(velocity) > 2) momentum();
}, {passive:true});


const sliderNavIds = [
  'drag-scroll-cards',
  'popular-products-slider',
  'banta-shops-section',
  'shopping-centers-slider',
  'shoes-bags-slider'
];

function updateSliderNavVisibility(sliderId) {
  const sliderEl = document.getElementById(sliderId);
  const buttons = document.querySelectorAll(`[data-scroll-target="${sliderId}"]`);
  if (!sliderEl || !buttons.length) {
    return;
  }

  const hasInteractiveCards = Boolean(sliderEl.querySelector(':scope > a'));

  buttons.forEach(button => {
    if (hasInteractiveCards) {
      button.style.display = '';
      button.setAttribute('aria-hidden', 'false');
      button.removeAttribute('aria-disabled');
      button.tabIndex = 0;
    } else {
      button.style.display = 'none';
      button.setAttribute('aria-hidden', 'true');
      button.setAttribute('aria-disabled', 'true');
      button.tabIndex = -1;
    }
  });
}

function getSliderScrollAmount(sliderEl) {
  const firstChild = sliderEl.querySelector(':scope > *');
  if (!firstChild) {
    return sliderEl.clientWidth || 320;
  }
  const styles = window.getComputedStyle(sliderEl);
  const gapValue = parseFloat(styles.columnGap || styles.gap || '0') || 0;
  return firstChild.getBoundingClientRect().width + gapValue;
}

function getDocumentDirectionMultiplier(sliderEl) {
  // در مرورگرهای مدرن، اسکرول افقی در حالت RTL همانند LTR کار می‌کند و
  // اعمال ضریب منفی باعث برعکس شدن جهت دکمه‌ها می‌شد. بنابراین همواره ۱
  // برمی‌گردانیم تا اسکرول مطابق انتظار کاربر انجام شود.
  return 1;
}

function setupSliderNavigation(sliderId) {
  const sliderEl = document.getElementById(sliderId);
  if (!sliderEl) return;
  const buttons = document.querySelectorAll(`[data-scroll-target="${sliderId}"]`);
  if (!buttons.length) return;

  updateSliderNavVisibility(sliderId);

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const dirAttr = button.dataset.direction;
      if (!dirAttr) return;
      const direction = dirAttr === 'next' ? 1 : -1;
      const amount = getSliderScrollAmount(sliderEl);
      const directionMultiplier = getDocumentDirectionMultiplier(sliderEl);
      sliderEl.scrollBy({ left: direction * directionMultiplier * amount, behavior: 'smooth' });
    });
  });
}

sliderNavIds.forEach(setupSliderNavigation);


function toggleAdPopupVisibility(popupEl, shouldShow) {
  if (!popupEl) return;
  if (shouldShow) {
    popupEl.classList.add('is-visible');
    popupEl.setAttribute('aria-hidden', 'false');
  } else {
    popupEl.classList.remove('is-visible');
    popupEl.setAttribute('aria-hidden', 'true');
  }
}

window.showAdBannerPopup = async function() {
  console.log("⏺️ شروع showAdBannerPopup");
  const adSlot = document.getElementById('ad-banner-slot-popup');
  if (!adSlot) {
    console.error("❌ عنصر ad-banner-slot-popup پیدا نشد!");
    return;
  }
  const popup = document.getElementById('adPopup');
  if (!popup) {
    console.error("❌ عنصر adPopup پیدا نشد!");
    return;
  }
  const alreadyLoaded = adSlot.dataset.loaded === 'true' && adSlot.innerHTML.trim() !== '';
  if (alreadyLoaded) {
    toggleAdPopupVisibility(popup, true);
    return;
  }

  if (popup.dataset.loading === 'true') {
    toggleAdPopupVisibility(popup, true);
    return;
  }

  adSlot.dataset.loaded = 'false';
  popup.dataset.loading = 'true';
  adSlot.innerHTML = '<div class="ad-popup-loading">در حال دریافت تبلیغ...</div>';
  toggleAdPopupVisibility(popup, true);

  try {
    console.log("⏳ ارسال درخواست fetch برای تبلیغ...");
const res = await fetch('http://localhost:5000/api/adOrder/active?planSlug=ad_search');
    console.log("✅ پاسخ اولیه fetch دریافت شد", res);

    if (!res.ok) {
      console.error("❌ پاسخ سرور غیرموفق بود:", res.status);
      adSlot.innerHTML = '';
      popup.dataset.loading = 'false';
      toggleAdPopupVisibility(popup, false);
      return;
    }

    const data = await res.json();
    console.log("📦 داده دریافتی از API:", data);

    // فقط تبلیغات مربوط به سرچ باکس و تایید شده
    const searchAds = data.ads && Array.isArray(data.ads)
      ? data.ads.filter(ad => ad.planSlug === 'ad_search' && ad.status === 'approved')
      : [];

    if (!data.success || !searchAds.length) {
      console.warn("⚠️ هیچ تبلیغ فعالی مخصوص سرچ دریافت نشد.");
      adSlot.innerHTML = '';
      popup.dataset.loading = 'false';
      toggleAdPopupVisibility(popup, false);
      return;
    }

    const ad = searchAds[0];
    console.log("🎯 تبلیغ انتخاب شده:", ad);

    const productInfo = typeof ad.productId === 'object' && ad.productId !== null
      ? ad.productId
      : null;
    const sellerInfo = typeof ad.sellerId === 'object' && ad.sellerId !== null
      ? ad.sellerId
      : null;

    const productId = productInfo ? productInfo._id || productInfo.id : ad.productId;
    const sellerId = sellerInfo ? sellerInfo._id || sellerInfo.id : ad.sellerId;
    const sellerShopurl = sellerInfo && typeof sellerInfo.shopurl === 'string'
      ? sellerInfo.shopurl
      : undefined;

    let targetUrl = '#';
    if (productId) targetUrl = `product.html?id=${productId}`;
    else if (sellerShopurl) targetUrl = `shop.html?shopurl=${encodeURIComponent(sellerShopurl)}`;
    else if (sellerId) targetUrl = `shop.html?id=${sellerId}`;

    const safeAdTitle = escapeHTML(ad.adTitle || 'تبلیغ ویژه فروشگاه');
    const rawAdText = typeof ad.adText === 'string' ? ad.adText.trim() : '';
    const safeAdText = rawAdText ? escapeHTML(rawAdText).replace(/\n+/g, '<br>') : '';
    const safeShopTitle = ad.shopTitle ? escapeHTML(ad.shopTitle) : '';
    const mediaContent = ad.bannerImage
      ? `<img src="/uploads/${ad.bannerImage}" alt="${safeAdTitle}" loading="lazy">`
      : `<div class="ad-popup-placeholder" aria-hidden="true">AD</div>`;

    adSlot.innerHTML = `
      <a href="${targetUrl}" class="ad-popup-card" rel="noopener sponsored" aria-label="مشاهده تبلیغ پیشنهادی">
        <div class="ad-popup-header">
          <span class="ad-popup-badge">
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4.5 8.5c0-2.485 2.015-4.5 4.5-4.5h2c2.485 0 4.5 2.015 4.5 4.5v3c0 2.485-2.015 4.5-4.5 4.5h-2c-2.485 0-4.5-2.015-4.5-4.5v-3Z" stroke="#047857" stroke-width="1.4"/>
              <path d="M7.5 8h5" stroke="#047857" stroke-width="1.4" stroke-linecap="round"/>
              <path d="M7.5 11h3" stroke="#047857" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            تبلیغ
          </span>
          <span class="ad-popup-sponsor">حامی نتایج جستجو</span>
        </div>
        <div class="ad-popup-body">
          <div class="ad-popup-media">
            ${mediaContent}
          </div>
          <div class="ad-popup-info">
            ${safeShopTitle ? `<div class="ad-popup-shop">${safeShopTitle}</div>` : ''}
            <div class="ad-popup-title">${safeAdTitle}</div>
            ${safeAdText ? `<div class="ad-popup-text">${safeAdText}</div>` : ''}
            <span class="ad-popup-cta">مشاهده پیشنهاد
              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M7 5l6 5-6 5" stroke="#0ea5e9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </div>
        </div>
      </a>
    `;
    adSlot.dataset.loaded = 'true';
  } catch (e) {
    console.error("❌ خطا در دریافت یا نمایش تبلیغ:", e);
    adSlot.innerHTML = '';
    popup.dataset.loading = 'false';
    toggleAdPopupVisibility(popup, false);
    return;
  }

  popup.dataset.loading = 'false';
};




document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.querySelector('input[type="text"][placeholder^="جستجو"]');
  const adPopup = document.getElementById('adPopup');
  const closeAdBtn = document.getElementById('closeAdBtn');
  const adSlot = document.getElementById('ad-banner-slot-popup');

  const hideAdPopup = () => {
    if (!adPopup) return;
    adPopup.dataset.loading = 'false';
    toggleAdPopupVisibility(adPopup, false);
  };

  // رویداد باز شدن پاپ‌آپ
  if (searchInput) {
    searchInput.addEventListener('focus', window.showAdBannerPopup);
    searchInput.addEventListener('click', window.showAdBannerPopup);
  } else {
    console.error("❌ input جستجو پیدا نشد!");
  }

  // بستن با دکمه
  if (closeAdBtn) {
    closeAdBtn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      hideAdPopup();
    });
  } else {
    console.error("❌ دکمه بستن تبلیغ پیدا نشد!");
  }

  // بستن با تایپ در سرچ
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (!adPopup) return;
      if (adSlot && adSlot.dataset.loaded === 'true') {
        toggleAdPopupVisibility(adPopup, false);
      } else {
        hideAdPopup();
      }
    });
  }

  // بستن با کلیک بیرون از پاپ‌آپ
  document.addEventListener('mousedown', function(e) {
    // فقط وقتی پاپ‌آپ بازه و روی خود پاپ‌آپ یا محتواش کلیک نشده و روی input سرچ هم کلیک نشده:
    if (
      adPopup &&
      adPopup.classList.contains('is-visible') &&
      !adPopup.contains(e.target) &&
      e.target !== searchInput
    ) {
      hideAdPopup();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      hideAdPopup();
    }
  });
});

// جابجایی لینک‌های ناوبری بین هدر و فوتر موبایل
document.addEventListener('DOMContentLoaded', function() {
  const desktopNav = document.getElementById('desktopNav');
  const mobileList = document.getElementById('mobileNavList');
  const registerBtn = document.getElementById('registerShopBtn');

  if (!desktopNav || !mobileList || !registerBtn) {
    console.warn('Navigation elements missing – skipping responsive nav setup.');
    return;
  }

  const links = Array.from(desktopNav.querySelectorAll('.main-nav-link'));

  function addMobileLinkInteractions(link) {
    if (link.dataset.bound) return;
    link.addEventListener('click', function() {
      mobileList.querySelectorAll('a').forEach(a => a.classList.remove('active'));
      this.classList.add('active');
    });
    link.addEventListener('pointerdown', function() {
      this.classList.add('tapped');
      setTimeout(() => this.classList.remove('tapped'), 300);
    });
    link.dataset.bound = 'true';
  }

  function moveLinks() {
    if (window.innerWidth <= 767) {
      links.forEach(l => {
        if (!mobileList.contains(l)) {
          l.classList.remove('hide-on-mobile');
          mobileList.appendChild(l);
          addMobileLinkInteractions(l);
        }
      });
      highlightActive();
      registerBtn.classList.remove('mx-auto', 'mt-2');
    } else {
      links.forEach(l => {
        if (!desktopNav.contains(l)) {
          l.classList.add('hide-on-mobile');
          desktopNav.insertBefore(l, registerBtn);
        }
      });
      registerBtn.classList.remove('mx-auto', 'mt-2');
    }
  }

  function highlightActive() {
    const current = location.pathname.split('/').pop() || 'index.html';
    Array.from(mobileList.querySelectorAll('a')).forEach(a => {
      const path = new URL(a.href).pathname.split('/').pop();
      if (path === current) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
  }

  moveLinks();
  window.addEventListener('resize', moveLinks);
});

document.addEventListener('DOMContentLoaded', () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash ? window.location.hash.replace('#', '') : '';
    const highlight = params.get('highlightAd') || (hash && hash.startsWith('ad_') ? hash : '');
    if (highlight === 'ad_search' && typeof window.showAdBannerPopup === 'function') {
      setTimeout(() => {
        window.showAdBannerPopup();
      }, 600);
    }
  } catch (err) {
    console.warn('highlightAd parse error', err);
  }
});

// مدیریت اسکرول header برای کوچک شدن در زمان اسکرول
document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('mainHeader');
  let lastScrollTop = 0;
  let scrollThreshold = 100; // پیکسل اسکرول برای فعال شدن افکت

  function handleScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > scrollThreshold) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    lastScrollTop = scrollTop;
  }

  // استفاده از throttle برای بهینه‌سازی performance
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        handleScroll();
        ticking = false;
      });
      ticking = true;
    }
  });
});
