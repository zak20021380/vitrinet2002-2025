// ==========================================
    // Header Scroll Effect & Navigation
    // ==========================================

    // Add scroll effect to header
    window.addEventListener('scroll', () => {
      const header = document.querySelector('.main-header');
      if (header) {
        if (window.scrollY > 20) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
      }
    });

    // Handle navigation link clicks
    document.addEventListener('DOMContentLoaded', () => {
      const navLinks = document.querySelectorAll('.nav-link');

      navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          const section = link.getAttribute('data-section');
          if (section) {
            e.preventDefault();

            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));

            // Add active class to clicked link
            link.classList.add('active');

            // Trigger section change (if applicable)
            const menuBtn = document.querySelector(`button[data-section="${section}"]`);
            if (menuBtn) {
              menuBtn.click();
            }
          }
        });
      });

      initEditProfileModal();
    });

    function populateEditProfileForm() {
      const firstInput = document.getElementById('editFirstName');
      const lastInput = document.getElementById('editLastName');
      const initialsPreview = document.getElementById('editInitialsPreview');

      if (firstInput) firstInput.value = profileState.user.firstName || '';
      if (lastInput) lastInput.value = profileState.user.lastName || '';
      if (initialsPreview) {
        initialsPreview.textContent = formatInitials(profileState.user.firstName, profileState.user.lastName);
      }
    }

    function applyProfileStateToUI() {
      const { firstName, lastName, city, phone } = profileState.user;
      const isAuthenticated = Boolean(profileState.isAuthenticated);
      const fullNameRaw = `${firstName} ${lastName}`.trim();
      const fullName = isAuthenticated ? (fullNameRaw || 'کاربر ویترینت') : '';
      const initials = isAuthenticated ? formatInitials(firstName, lastName) : '';
      const maskedPhone = isAuthenticated && phone
        ? phone.toString().slice(0, 4) + '***' + phone.toString().slice(-3)
        : '';

      const hello = document.querySelector('.profile-hello');
      if (hello) hello.textContent = isAuthenticated && firstName ? `سلام ${firstName}` : '';

      const nameEls = document.querySelectorAll('.profile-fullname');
      nameEls.forEach(el => (el.textContent = fullName));

      const badgeCity = document.querySelector('.profile-badge.profile-badge--outline');
      if (badgeCity) badgeCity.textContent = isAuthenticated && city ? city : '';

      const avatar = document.querySelector('.profile-avatar-large');
      if (avatar) avatar.textContent = initials;

      const sidebarNames = document.querySelectorAll('.sidebar-user-name');
      sidebarNames.forEach(el => (el.textContent = fullName));

      document.querySelectorAll('.sidebar-user-mobile')
        .forEach(el => (el.textContent = maskedPhone));

      const initialsPreview = document.getElementById('editInitialsPreview');
      if (initialsPreview) initialsPreview.textContent = initials;

      // Update Hero Header
      const heroUserName = document.getElementById('heroUserName');
      if (heroUserName) {
        heroUserName.textContent = isAuthenticated && firstName 
          ? `سلام ${firstName} جان` 
          : 'سلام کاربر عزیز';
      }

      // Hero Avatar - Keep the modern placeholder SVG icon (don't replace with initials)
      // The avatar now uses a professional user silhouette placeholder

      // Update Hero Info Row - Location
      const heroLocationText = document.getElementById('heroLocationText');
      if (heroLocationText && city) {
        heroLocationText.textContent = city;
      }

      // Update Hero Info Row - Status (VIP or regular)
      const heroStatusText = document.getElementById('heroStatusText');
      const heroStatusPill = document.getElementById('heroStatusPill');
      if (heroStatusText && isAuthenticated) {
        // You can customize this based on user's actual VIP status
        heroStatusText.textContent = 'کاربر ویژه';
      }
    }

    function openEditProfileModal() {
      const modal = document.getElementById('editProfileModal');
      const status = document.getElementById('editProfileStatus');
      if (!modal) return;
      populateEditProfileForm();
      if (status) {
        status.textContent = '';
        status.classList.add('hidden');
        status.classList.remove('text-red-500');
        status.classList.add('text-emerald-600');
      }
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
      requestAnimationFrame(() => {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
      });
    }

    function closeEditProfileModal() {
      const modal = document.getElementById('editProfileModal');
      const status = document.getElementById('editProfileStatus');
      if (!modal) return;
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('overflow-hidden');
      if (status) status.classList.add('hidden');
      setTimeout(() => modal.classList.add('hidden'), 220);
    }

    async function handleEditProfileSubmit(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const firstInput = document.getElementById('editFirstName');
      const lastInput = document.getElementById('editLastName');
      const status = document.getElementById('editProfileStatus');
      const submitBtn = form.querySelector('button[type="submit"]');

      const firstName = firstInput?.value.trim() || '';
      const lastName = lastInput?.value.trim() || '';
      const phone = (profileState.user.phone || '').toString().trim();
      const name = `${firstName} ${lastName}`.trim();

      if (!firstName || !lastName) {
        if (status) {
          status.textContent = 'نام و نام خانوادگی را کامل وارد کنید.';
          status.classList.remove('hidden', 'text-emerald-600');
          status.classList.add('text-red-500');
        }
        return;
      }

      if (!phone) {
        if (status) {
          status.textContent = 'شماره تماس کاربر یافت نشد. لطفاً دوباره تلاش کنید.';
          status.classList.remove('hidden', 'text-emerald-600');
          status.classList.add('text-red-500');
        }
        return;
      }

      if (status) {
        status.textContent = 'در حال ذخیره...';
        status.classList.remove('hidden', 'text-red-500');
        status.classList.add('text-emerald-600');
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'در حال ذخیره...';
      }

      try {
        const res = await fetch('/api/user/profile', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            phone
          })
        });

        if (!res.ok) {
          throw new Error('ثبت اطلاعات انجام نشد. دوباره تلاش کنید.');
        }

        profileState.user.firstName = firstName;
        profileState.user.lastName = lastName;
        applyProfileStateToUI();

        if (status) {
          status.textContent = 'اطلاعات با موفقیت ذخیره شد.';
          status.classList.remove('text-red-500');
          status.classList.add('text-emerald-600');
        }

        setTimeout(() => closeEditProfileModal(), 600);
      } catch (error) {
        console.error('edit profile error:', error);
        if (status) {
          status.textContent = error?.message || 'خطا در ذخیره اطلاعات.';
          status.classList.remove('text-emerald-600');
          status.classList.remove('hidden');
          status.classList.add('text-red-500');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'ذخیره تغییرات';
        }
      }
    }

    function initEditProfileModal() {
      const modal = document.getElementById('editProfileModal');
      const form = document.getElementById('editProfileForm');
      if (!modal || !form) return;

      form.addEventListener('submit', handleEditProfileSubmit);

      document.querySelectorAll('[data-dismiss="edit-modal"]').forEach(btn => {
        btn.addEventListener('click', closeEditProfileModal);
      });

      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          closeEditProfileModal();
        }
      });
    }

    // داده‌ی دموی پروفایل
    async function loadProfileSection() {
      const formatDate = (value) => {
        if (!value) return '---';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '---';
        return date.toLocaleDateString('fa-IR', { day: 'numeric', month: 'short', year: 'numeric' });
      };

      let html = `
      <div class="glass px-6 py-7 fadein">
        <div class="text-center text-gray-400 py-12">در حال دریافت اطلاعات...</div>
      </div>`;
      document.getElementById('mainContent').innerHTML = html;

      try {
        const res = await fetch('/api/user/profile', {
          method: 'GET',
          credentials: 'include',          // کوکی JWT
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403)
            throw new Error('برای دسترسی به این بخش ابتدا وارد شوید.');
          throw new Error('دریافت اطلاعات با خطا مواجه شد!');
        }

        const user = await res.json();
        const phone = user.phone || user.mobile || '';   // ✳️ فیکس: فیلد mobile هم پوشش داده شد
        const masked =
          phone ? phone.toString().slice(0, 4) + '***' + phone.toString().slice(-3) : '-';
        const firstName = (user.firstname || user.firstName || 'کاربر').toString().trim() || 'کاربر';
        const lastName = (user.lastname || user.lastName || '').toString().trim();
        const fullName = `${firstName} ${lastName}`.trim() || 'کاربر ویترینت';
        const initials = formatInitials(firstName, lastName);
        const city = (user.city || user.cityName || 'سنندج').toString().trim() || 'سنندج';
        const safeCity = city && city !== '---' ? city : 'سنندج';
        const memberSince = formatDate(user.createdAt || user.created_at || user.signupDate);
        const lastSeen = formatDate(user.lastLogin || user.last_seen || user.updatedAt || user.lastSeen);
        const referralCode = user.referralCode || '---';
        const birthDate = user.birthDate || user.birthday || user.dateOfBirth ? formatDate(user.birthDate || user.birthday || user.dateOfBirth) : '';
        // ذخیره کد معرف برای استفاده در مودال ماموریت
        if (typeof userReferralCode !== 'undefined') {
          userReferralCode = referralCode !== '---' ? referralCode : null;
        }
        const filledFields = [firstName, lastName, safeCity, phone]
          .filter(Boolean).length;
        const completionProgress = Math.min(100, Math.round((filledFields / 4) * 100));
        const completionLabel = completionProgress >= 80
          ? 'پروفایل کامل'
          : completionProgress >= 50
            ? 'در حال تکمیل'
            : 'نیاز به تکمیل';
        const membershipLabel = user.role === 'seller'
          ? 'فروشنده تاییدشده'
          : 'کاربر تاییدشده';

        profileState.isAuthenticated = true;
        profileState.user = {
          firstName,
          lastName,
          city: safeCity,
          phone
        };

        html = `
        <section class="profile-section fadein">
          <div class="profile-card glass">
            <div class="profile-hero">
              <div class="profile-avatar-large">${initials}</div>
              <div>
                <p class="profile-hello">سلام ${firstName}</p>
                <h2 class="profile-fullname">${fullName}</h2>
                <div class="profile-badges">
                  <span class="profile-badge">${membershipLabel}</span>
                  <span class="profile-badge profile-badge--outline">${safeCity}</span>
                </div>
              </div>
              <button type="button" class="profile-edit-btn" data-action="edit-profile">ویرایش اطلاعات</button>
            </div>
            <div class="profile-info-grid">
              <div class="profile-info-card">
                <div class="profile-info-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                    <path d="M12 18h.01" />
                    <path d="M9 6h6" />
                    <path d="M9 10h6" />
                  </svg>
                </div>
                <div>
                  <p class="profile-info-label">شماره تماس</p>
                  <p class="profile-info-value" dir="ltr">${masked}</p>
                </div>
              </div>
              <div class="profile-info-card">
                <div class="profile-info-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                </div>
                <div>
                  <p class="profile-info-label">شهر</p>
                  <p class="profile-info-value">${safeCity}</p>
                </div>
              </div>
              <div class="profile-info-card">
                <div class="profile-info-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 2v2" />
                    <path d="M16 2v2" />
                    <rect x="4" y="4" width="16" height="18" rx="2" />
                    <path d="M4 10h16" />
                    <path d="M9 14h.01" />
                    <path d="M9 18h.01" />
                    <path d="M13 14h.01" />
                    <path d="M13 18h.01" />
                    <path d="M17 14h.01" />
                  </svg>
                </div>
                <div>
                  <p class="profile-info-label">عضویت از</p>
                  <p class="profile-info-value">${memberSince}</p>
                </div>
              </div>
              <div class="profile-info-card">
                <div class="profile-info-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 6v6l4 2" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                </div>
                <div>
                  <p class="profile-info-label">آخرین فعالیت</p>
                  <p class="profile-info-value">${lastSeen}</p>
                </div>
              </div>
              <div class="profile-info-card birthday-card" id="birthdayCard" onclick="openBirthdayModal()" data-has-birthday="${birthDate ? 'true' : 'false'}">
                <div class="profile-info-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 2v2" />
                    <path d="M16 2v2" />
                    <rect x="4" y="4" width="16" height="18" rx="2" />
                    <path d="M4 10h16" />
                    <path d="M12 14l-2 2 2 2" />
                    <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                <div>
                  <p class="profile-info-label">تاریخ تولد</p>
                  <p class="profile-info-value ${birthDate ? '' : 'placeholder-value'}" id="birthdayValue">${birthDate || 'ثبت نشده'}</p>
                </div>
              </div>
              <div class="profile-info-card referral-card">
                <div class="profile-info-icon referral-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div class="referral-content">
                  <p class="profile-info-label">کد معرف شما</p>
                  <div class="referral-code-wrapper">
                    <p class="profile-info-value referral-code-value" dir="ltr">${referralCode}</p>
                    <button type="button" class="referral-copy-btn" data-code="${referralCode}" title="کپی کد معرف">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Referral Benefits Section -->
          <div class="referral-benefits-section">
            <div class="referral-benefits-header">
              <div class="referral-benefits-header-icon">
                <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <div class="referral-benefits-header-content">
                <h3>دوستانت رو دعوت کن، جایزه بگیر!</h3>
                <p>با معرفی دوستان خود به ویترینت، هدایای ویژه دریافت کنید</p>
              </div>
            </div>
            <div class="referral-benefits-body">
              <div class="referral-benefits-grid">
                <div class="referral-benefit-card user-type">
                  <div class="referral-benefit-icon blue">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <h4 class="referral-benefit-title">دعوت کاربر جدید</h4>
                  <p class="referral-benefit-desc">با ثبت‌نام هر کاربر جدید با کد معرف شما، اعتبار هدیه دریافت کنید</p>
                  <span class="referral-benefit-badge blue">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    ۵,۰۰۰ تومان اعتبار
                  </span>
                </div>
                <div class="referral-benefit-card seller-type">
                  <div class="referral-benefit-icon purple">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  </div>
                  <h4 class="referral-benefit-title">دعوت فروشنده جدید</h4>
                  <p class="referral-benefit-desc">با ثبت‌نام هر فروشنده جدید، جایزه ویژه و اعتبار بیشتر بگیرید</p>
                  <span class="referral-benefit-badge purple">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    ۲۰,۰۰۰ تومان اعتبار
                  </span>
                </div>
                <div class="referral-benefit-card">
                  <div class="referral-benefit-icon green">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <h4 class="referral-benefit-title">ارتقای سطح کاربری</h4>
                  <p class="referral-benefit-desc">با دعوت بیشتر، به سطوح بالاتر برسید و مزایای بیشتری کسب کنید</p>
                  <span class="referral-benefit-badge green">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    دسترسی VIP
                  </span>
                </div>
                <div class="referral-benefit-card">
                  <div class="referral-benefit-icon amber">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="8" r="7"/>
                      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
                    </svg>
                  </div>
                  <h4 class="referral-benefit-title">قرعه‌کشی ماهانه</h4>
                  <p class="referral-benefit-desc">هر دعوت موفق = یک شانس در قرعه‌کشی جوایز ویژه ماهانه</p>
                  <span class="referral-benefit-badge amber">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    جوایز ارزنده
                  </span>
                </div>
              </div>

              <div class="referral-divider">
                <div class="referral-divider-line"></div>
                <span class="referral-divider-text">همین الان شروع کن</span>
                <div class="referral-divider-line"></div>
              </div>

              <div class="referral-share-section">
                <div class="referral-share-text">
                  <p>کد معرف خود را با دوستانتان به اشتراک بگذارید</p>
                  <span>کد شما: <strong dir="ltr" style="color:#0f766e;font-family:'Poppins',monospace;">${referralCode}</strong></span>
                </div>
                <button type="button" class="referral-share-btn" onclick="shareReferralCode('${referralCode}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="18" cy="5" r="3"/>
                    <circle cx="6" cy="12" r="3"/>
                    <circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  کپی کد دعوت
                </button>
              </div>
            </div>
          </div>

          <div class="profile-secondary">
            <div class="profile-subcard glass">
              <h3>دسترسی سریع</h3>
              <p class="text-sm text-gray-500">مسیرهای مهم داشبورد تنها با یک کلیک در دسترس شماست.</p>
              <div class="profile-quick-actions">
                <button type="button" class="profile-quick-action" data-target-section="bookings">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="4" />
                    <path d="M16 2v4" />
                    <path d="M8 2v4" />
                    <path d="M3 10h18" />
                  </svg>
                  رزروهای من
                </button>
                <button type="button" class="profile-quick-action" data-target-section="favorites">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  علاقه‌مندی‌ها
                </button>
                <button type="button" class="profile-quick-action" data-target-section="dashboard">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 13h8V3H3z" />
                    <path d="M13 21h8V11h-8z" />
                    <path d="M13 3h8v4h-8z" />
                    <path d="M3 17h8v4H3z" />
                  </svg>
                  بازگشت به داشبورد
                </button>
              </div>
            </div>
          </div>
        </section>`;
      } catch (e) {
        profileState.isAuthenticated = false;
        profileState.user = {
          firstName: '',
          lastName: '',
          city: '',
          phone: ''
        };
        html = `
        <div class="glass px-6 py-7 fadein">
          <div class="text-center text-red-400 py-12">
            برای دسترسی به این بخش ابتدا
            <a href="/login.html"
              class="inline-block px-3 py-1.5 mx-1 rounded-xl brand-btn text-white font-bold text-base transition hover:scale-105"
              style="text-decoration:none;">وارد شوید</a>
            .
          </div>
        </div>`;
      }

      document.getElementById('mainContent').innerHTML = html;
      applyProfileStateToUI();
      initProfileSectionInteractions();
    }

    function initProfileSectionInteractions() {
      document.querySelectorAll('[data-target-section]').forEach(btn => {
        btn.addEventListener('click', () => {
          const { targetSection } = btn.dataset;
          if (targetSection) {
            showSection(targetSection);
          }
        });
      });

      const editBtn = document.querySelector('[data-action="edit-profile"]');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          openEditProfileModal();
        });
      }

      // کپی کد معرف
      document.querySelectorAll('.referral-copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const code = btn.dataset.code;
          if (!code || code === '---') {
            showToast('کد معرف هنوز تولید نشده است', 'error');
            return;
          }
          try {
            await navigator.clipboard.writeText(code);
            btn.classList.add('copied');
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            showToast('کد معرف کپی شد!', 'success');
            setTimeout(() => {
              btn.classList.remove('copied');
              btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
            }, 2000);
          } catch (err) {
            // Fallback برای مرورگرهای قدیمی
            const textarea = document.createElement('textarea');
            textarea.value = code;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('کد معرف کپی شد!', 'success');
          }
        });
      });
    }

    // تابع اشتراک‌گذاری کد معرف
    async function shareReferralCode(code) {
      if (!code || code === '---') {
        showToast('کد معرف هنوز تولید نشده است', 'error');
        return;
      }

      const shareText = `🎁 با کد معرف من در ویترینت ثبت‌نام کن و جایزه بگیر!\n\nکد معرف: ${code}\n\n🔗 لینک ثبت‌نام:\nhttps://vitrinet.ir/register.html?ref=${code}`;
      const shareData = {
        title: 'دعوت به ویترینت',
        text: shareText,
        url: `https://vitrinet.ir/register.html?ref=${code}`
      };

      // اگر Web Share API پشتیبانی میشه
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          showToast('با موفقیت به اشتراک گذاشته شد!', 'success');
        } catch (err) {
          if (err.name !== 'AbortError') {
            // اگر کاربر کنسل نکرده، کپی کن
            fallbackCopyReferral(code, shareText);
          }
        }
      } else {
        // Fallback: کپی متن
        fallbackCopyReferral(code, shareText);
      }
    }

    function fallbackCopyReferral(code, text) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('متن دعوت کپی شد! حالا می‌تونی بفرستی برای دوستات', 'success');
      }).catch(() => {
        // Fallback برای مرورگرهای قدیمی
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('متن دعوت کپی شد!', 'success');
      });
    }

    async function ensureUserPhone() {
      if (window.currentUserPhone) return window.currentUserPhone;

      try {
        const res = await fetch('/api/user/profile', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) return '';

        const user = await res.json();
        const phone = user.phone || user.mobile || '';
        window.currentUserPhone = phone;
        return phone;
      } catch (_) {
        return '';
      }
    }

    async function fetchBookings(phone) {
      const res = await fetch(`/api/bookings?phone=${encodeURIComponent(phone)}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        let message = 'خطا در دریافت رزروها';
        try {
          const data = await res.json();
          if (data && data.message) message = data.message;
        } catch (_) { }
        throw new Error(message);
      }

      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    }

    async function getBookings(force = false) {
      if (!force && bookingsLoaded) {
        return { data: bookingsData, hasPhone: true };
      }

      const phone = await ensureUserPhone();
      if (!phone) {
        bookingsData = [];
        bookingsLoaded = false;
        return { data: [], hasPhone: false };
      }

      try {
        bookingsData = await fetchBookings(phone);
        bookingsLoaded = true;
        return { data: bookingsData, hasPhone: true };
      } catch (err) {
        bookingsData = [];
        bookingsLoaded = false;
        throw err;
      }
    }

    function updateBookingsBadge() {
      const dataset = (Array.isArray(allBookings) && allBookings.length)
        ? allBookings
        : (Array.isArray(bookingsData) ? bookingsData : []);

      const pendingCount = dataset
        .filter(b => (b.status || '').toLowerCase() === 'pending')
        .length;

      const badges = document.querySelectorAll('#bookings-badge');
      if (!badges.length) return;

      badges.forEach(badge => {
        if (pendingCount > 0) {
          badge.textContent = pendingCount.toLocaleString('fa-IR');
          badge.classList.remove('hidden');
        } else {
          badge.textContent = '';
          badge.classList.add('hidden');
        }
      });
    }

    function updateBookingsBadgeDisplay() {
      updateBookingsBadge();
    }

    async function refreshBookingsBadge(force = false) {
      const badges = document.querySelectorAll('#bookings-badge');
      if (!badges.length) return;

      try {
        const result = await getBookings(force);
        if (!result.hasPhone) {
          badges.forEach(b => {
            b.textContent = '';
            b.classList.add('hidden');
          });
          allBookings = [];
          return;
        }
        allBookings = Array.isArray(result.data) ? result.data : [];
        updateBookingsBadge();
      } catch (err) {
        console.error('refreshBookingsBadge error:', err);
        badges.forEach(b => {
          b.textContent = '';
          b.classList.add('hidden');
        });
        allBookings = [];
      }
    }

    // Load user's bookings
    async function loadBookings() {
      try {
        const token = localStorage.getItem('token');

        // Check if user is actually logged in
        if (!token) {
          console.log('No auth token found, skipping bookings');
          bookingsLoaded = false;
          allBookings = [];
          bookingsData = [];
          renderBookings([]);
          updateBookingsBadge();
          return;
        }

        const response = await fetch('/api/user/bookings', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const payload = await response.json();
          const bookings = Array.isArray(payload)
            ? payload
            : (Array.isArray(payload?.items) ? payload.items : []);

          allBookings = bookings;
          bookingsData = bookings;
          bookingsLoaded = true;
          renderBookings(allBookings);
          updateBookingsBadge();
        } else if (response.status === 401) {
          // User not authenticated - this is OK, just don't show bookings
          console.log('User not authenticated for bookings');
          allBookings = [];
          bookingsData = [];
          bookingsLoaded = false;
          renderBookings([]);
          updateBookingsBadge();
        } else {
          console.error('Failed to load bookings:', response.status);
        }
      } catch (error) {
        console.error('Error loading bookings:', error);
      }
    }

    // Cancel a booking
    async function cancelBooking(bookingId) {
      // Confirm with user
      if (!confirm('آیا مطمئن هستید که می‌خواهید این رزرو را لغو کنید؟')) {
        return;
      }

      try {
        const token = localStorage.getItem('token');

        const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          alert('رزرو با موفقیت لغو شد');

          // Reload bookings to show updated status
          await loadBookings();
        } else {
          const error = await response.json();
          alert(error.message || 'خطا در لغو رزرو');
        }
      } catch (error) {
        console.error('Error cancelling booking:', error);
        alert('خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.');
      }
    }

    async function loadBookingsSection() {
      const mainContent = document.getElementById('mainContent');
      mainContent.innerHTML = `
    <!-- Bookings Section -->
    <div id="bookings-section" class="section hidden">
      <div class="bg-white rounded-lg shadow-md p-6">
        <h2 class="text-2xl font-bold mb-6 text-gray-800">رزروهای من</h2>
        
        <!-- Status Filter Buttons -->
        <div class="flex flex-wrap gap-3 mb-6">
          <button data-status="all" class="filter-btn active px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 ease-out">
            همه
          </button>
          <button data-status="pending" class="filter-btn px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all duration-200 ease-out">
            در انتظار تایید
          </button>
          <button data-status="confirmed" class="filter-btn px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all duration-200 ease-out">
            تایید شده
          </button>
          <button data-status="completed" class="filter-btn px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all duration-200 ease-out">
            انجام شده
          </button>
          <button data-status="cancelled" class="filter-btn px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all duration-200 ease-out">
            لغو شده
          </button>
        </div>
        
        <!-- Bookings Container -->
        <div id="bookings-container" class="space-y-4">
          <div class="text-center text-gray-400 py-12">در حال دریافت رزروها...</div>
        </div>
        
        <!-- Empty State -->
        <div id="no-bookings" class="text-center py-12 hidden">
          <div class="text-6xl mb-4">📅</div>
          <p class="text-gray-500 text-lg mb-2">شما هنوز رزروی ندارید</p>
          <p class="text-gray-400 mb-6">برای رزرو خدمات، از صفحه دایرکتوری سرویس‌ها بازدید کنید</p>
          <a href="http://localhost:5000/shops-by-category.html?cat=service" class="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
            مشاهده خدمات
          </a>
        </div>
      </div>
    </div>
  `;

      const section = document.getElementById('bookings-section');
      if (section) section.classList.remove('hidden');

      // Add event listeners for filter buttons
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const status = btn.dataset.status;
          filterBookings(status, e);
        });
      });

      const container = document.getElementById('bookings-container');
      const emptyState = document.getElementById('no-bookings');
      if (container) container.innerHTML = `<div class="text-center text-gray-400 py-12">در حال دریافت رزروها...</div>`;
      if (emptyState) emptyState.classList.add('hidden');

      try {
        const result = await getBookings(true);
        if (!result.hasPhone) {
          if (container) {
            container.innerHTML = `<div class="text-center text-red-400 py-12">برای مشاهده رزروها ابتدا وارد شوید یا شماره تماس خود را در پروفایل ثبت کنید.</div>`;
          }
          allBookings = [];
          updateBookingsBadge();
          return;
        }

        allBookings = Array.isArray(result.data) ? result.data : [];
        bookingsData = allBookings;
        updateBookingsBadge();
        filterBookings('all');
      } catch (err) {
        console.error('loadBookingsSection error:', err);
        if (container) {
          container.innerHTML = `<div class="text-center text-red-400 py-12">خطا در دریافت رزروها. لطفاً بعداً دوباره تلاش کنید.</div>`;
        }
        allBookings = [];
        updateBookingsBadge();
      }
    }

    function filterBookings(status, evt) {
      const normalized = (status || 'all').toLowerCase();
      currentBookingFilter = normalized;

      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-blue-500', 'text-white');
        btn.classList.add('border', 'border-gray-300');
      });

      const target = evt?.currentTarget || evt?.target || document.querySelector(`.filter-btn[data-status="${normalized}"]`);
      if (target) {
        target.classList.add('active', 'bg-blue-500', 'text-white');
        target.classList.remove('border', 'border-gray-300');
      }

      if (!Array.isArray(allBookings) || allBookings.length === 0) {
        renderBookings([]);
        return;
      }

      const filtered = normalized === 'all'
        ? allBookings
        : allBookings.filter(item => (item.status || '').toLowerCase() === normalized);

      if (!filtered.length) {
        const container = document.getElementById('bookings-container');
        const noBookings = document.getElementById('no-bookings');
        if (container && noBookings) {
          container.classList.remove('hidden');
          container.innerHTML = `<div class="text-center text-gray-400 py-10 transition-opacity duration-300 ease-out">رزروی با این وضعیت پیدا نشد.</div>`;
          noBookings.classList.add('hidden');
        }
        return;
      }

      renderBookings(filtered);
    }

    // تبدیل تاریخ میلادی به شمسی
    function gregorianToJalali(gDate) {
      try {
        let date;
        if (typeof gDate === 'string') {
          // Handle different date formats
          if (gDate.includes('/')) {
            const parts = gDate.split('/');
            if (parts.length === 3) {
              date = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
              date = new Date(gDate);
            }
          } else {
            date = new Date(gDate);
          }
        } else {
          date = new Date(gDate);
        }

        if (isNaN(date.getTime())) {
          return gDate; // Return original if invalid
        }

        const gy = date.getFullYear();
        const gm = date.getMonth() + 1;
        const gd = date.getDate();

        const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        let jy = (gy <= 1600) ? 0 : 979;
        gy > 1600 ? (jy += 1, gy -= 1601) : gy -= 621;
        const gy2 = (gm > 2) ? (gy + 1) : gy;
        let days = (365 * gy) + (parseInt((gy2 + 3) / 4)) - (parseInt((gy2 + 99) / 100)) + (parseInt((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
        jy += 33 * (parseInt(days / 12053));
        days %= 12053;
        jy += 4 * (parseInt(days / 1461));
        days %= 1461;
        jy += parseInt((days - 1) / 365);
        if (days > 365) days = (days - 1) % 365;

        const jm = (days < 186) ? 1 + parseInt(days / 31) : 7 + parseInt((days - 186) / 30);
        const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));

        const monthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
        return `${jd} ${monthNames[jm - 1]} ${jy}`;
      } catch (err) {
        console.error('Error converting date:', err);
        return gDate;
      }
    }

    // Render bookings to the page
    function renderBookings(bookings) {
      const container = document.getElementById('bookings-container');
      const noBookings = document.getElementById('no-bookings');

      if (!container || !noBookings) {
        return;
      }

      if (!bookings || bookings.length === 0) {
        container.classList.add('hidden');
        container.innerHTML = '';
        noBookings.classList.remove('hidden');
        return;
      }

      container.classList.remove('hidden');
      noBookings.classList.add('hidden');

      container.innerHTML = bookings.map(booking => {
        const sellerLink = getSellerLink(booking);
        const normalizedStatus = (booking.status || '').toLowerCase();
        const persianDate = gregorianToJalali(booking.bookingDate);

        return `
    <div class="booking-card fadein ${getBookingStatusClass(booking.status)}">
      <!-- Header Section -->
      <div class="booking-card-header">
        <div class="booking-service-icon-wrapper">
          <div class="booking-service-icon">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
        </div>
        <div class="booking-header-content">
          <div class="booking-service-name">
            <span class="booking-service-label">نام خدمت</span>
            <h3 class="booking-service-title">${escapeHtml(booking.service)}</h3>
          </div>
          <span class="${getStatusBadgeClass(booking.status)}">
            ${getStatusLabel(booking.status)}
          </span>
        </div>
      </div>

      <!-- Info Grid -->
      <div class="booking-info-grid">
        <div class="booking-info-item">
          <div class="booking-info-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </div>
          <div class="booking-info-content">
            <span class="booking-info-label">فروشگاه</span>
            ${sellerLink ?
            `<a href="${sellerLink}" class="booking-info-value booking-info-link" target="_blank" rel="noopener noreferrer">
                ${escapeHtml(booking.sellerName || 'فروشگاه')}
              </a>` :
            `<span class="booking-info-value missing-seller-link cursor-pointer">
                ${escapeHtml(booking.sellerName || 'فروشگاه')}
              </span>`
          }
          </div>
        </div>

        <div class="booking-info-item">
          <div class="booking-info-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
          <div class="booking-info-content">
            <span class="booking-info-label">تاریخ رزرو</span>
            <span class="booking-info-value">${escapeHtml(persianDate)}</span>
          </div>
        </div>

        <div class="booking-info-item">
          <div class="booking-info-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div class="booking-info-content">
            <span class="booking-info-label">ساعت شروع</span>
            <span class="booking-info-value">${escapeHtml(booking.startTime)}</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="booking-actions">
        <button type="button" data-booking-id="${booking._id}" class="booking-action-btn booking-action-btn--primary show-booking-details">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>جزئیات رزرو</span>
        </button>
        ${(normalizedStatus === 'pending' || normalizedStatus === 'confirmed') ? `
          <button type="button" data-booking-id="${booking._id}" class="booking-action-btn booking-action-btn--danger cancel-booking">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
            <span>لغو رزرو</span>
          </button>
        ` : ''}
        ${normalizedStatus === 'cancelled' ? `
          <button type="button" data-booking-id="${booking._id}" class="booking-action-btn booking-action-btn--ghost delete-booking">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            <span>حذف دائمی</span>
          </button>
        ` : ''}
      </div>
    </div>
  `;
      }).join('');

      // Add event listeners for booking action buttons
      container.querySelectorAll('.show-booking-details').forEach(btn => {
        btn.addEventListener('click', () => {
          const bookingId = btn.dataset.bookingId;
          showBookingDetails(bookingId);
        });
      });

      container.querySelectorAll('.cancel-booking').forEach(btn => {
        btn.addEventListener('click', () => {
          const bookingId = btn.dataset.bookingId;
          cancelBooking(bookingId);
        });
      });

      container.querySelectorAll('.delete-booking').forEach(btn => {
        btn.addEventListener('click', () => {
          const bookingId = btn.dataset.bookingId;
          deleteBooking(bookingId);
        });
      });

      container.querySelectorAll('.missing-seller-link').forEach(span => {
        span.addEventListener('click', () => {
          alert('لینک فروشگاه موجود نیست');
        });
      });
    }

    function getBookingStatusClass(status) {
      const classes = {
        'pending': 'booking-card--pending',
        'confirmed': 'booking-card--confirmed',
        'completed': 'booking-card--completed',
        'cancelled': 'booking-card--cancelled'
      };
      const key = (status || '').toLowerCase();
      return classes[key] || 'booking-card--default';
    }

    function getStatusBadgeClass(status) {
      const classes = {
        'pending': 'status-badge status-badge--pending',
        'confirmed': 'status-badge status-badge--confirmed',
        'completed': 'status-badge status-badge--completed',
        'cancelled': 'status-badge status-badge--cancelled'
      };
      const key = (status || '').toLowerCase();
      return classes[key] || 'status-badge status-badge--default';
    }

    function getStatusLabel(status) {
      const labels = {
        'pending': 'در انتظار تایید',
        'confirmed': 'تایید شده',
        'completed': 'انجام شده',
        'cancelled': 'لغو شده'
      };
      const key = (status || '').toLowerCase();
      return labels[key] || (status || 'نامشخص');
    }

    function getSellerLink(booking) {
      if (!booking) return '';

      const slug = typeof booking.sellerUrl === 'string'
        ? booking.sellerUrl.trim()
        : '';
      if (slug) {
        return `/service-shops.html?shopurl=${encodeURIComponent(slug)}`;
      }

      let sellerId = booking.sellerId;
      if (sellerId && typeof sellerId === 'object') {
        if (sellerId._id || sellerId.id) {
          sellerId = sellerId._id || sellerId.id;
        } else if (typeof sellerId.toString === 'function') {
          sellerId = sellerId.toString();
        } else {
          sellerId = '';
        }
      }
      if (typeof sellerId === 'string' && sellerId.trim()) {
        return `/service-shops.html?sellerId=${encodeURIComponent(sellerId.trim())}`;
      }

      return '';
    }

    async function cancelBooking(id) {
      if (!id) return;

      const confirmed = window.confirm('آیا از لغو این رزرو اطمینان دارید؟');
      if (!confirmed) return;

      const token = localStorage.getItem('token');
      if (!token) {
        alert('برای لغو رزرو ابتدا وارد حساب کاربری خود شوید.');
        return;
      }

      try {
        const response = await fetch(`/api/bookings/${encodeURIComponent(id)}/cancel`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const message = errorData.message || 'لغو رزرو با خطا مواجه شد.';
          alert(message);
          return;
        }

        bookingsData = Array.isArray(bookingsData)
          ? bookingsData.map(booking => booking._id === id ? { ...booking, status: 'cancelled' } : booking)
          : [];
        allBookings = bookingsData;

        filterBookings(currentBookingFilter || 'all');
        updateBookingsBadge();

        alert('رزرو با موفقیت لغو شد.');
      } catch (error) {
        console.error('cancelBooking error:', error);
        alert('لغو رزرو با خطای غیرمنتظره مواجه شد.');
      }
    }

    async function deleteBooking(id) {
      if (!id) return;

      const confirmed = window.confirm('با حذف دائمی، امکان بازیابی این رزرو وجود نخواهد داشت. ادامه می‌دهید؟');
      if (!confirmed) return;

      const token = localStorage.getItem('token');
      if (!token) {
        alert('برای حذف رزرو ابتدا وارد حساب کاربری خود شوید.');
        return;
      }

      try {
        const response = await fetch(`/api/bookings/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const message = errorData.message || 'حذف رزرو با خطا مواجه شد.';
          alert(message);
          return;
        }

        bookingsData = Array.isArray(bookingsData)
          ? bookingsData.filter(booking => booking._id !== id)
          : [];
        allBookings = bookingsData;

        filterBookings(currentBookingFilter || 'all');
        updateBookingsBadge();

        alert('رزرو برای همیشه حذف شد.');
      } catch (error) {
        console.error('deleteBooking error:', error);
        alert('حذف رزرو با خطای غیرمنتظره مواجه شد.');
      }
    }

    // Show booking details modal
    function showBookingDetails(bookingId) {
      if (!bookingId) return;

      // Find the booking in our data
      const booking = allBookings.find(b => b._id === bookingId);
      if (!booking) {
        alert('اطلاعات رزرو یافت نشد');
        return;
      }

      // Format created date in Persian if available
      let createdDate = 'نامشخص';
      if (booking.createdAt) {
        try {
          const date = new Date(booking.createdAt);
          createdDate = date.toLocaleDateString('fa-IR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (e) {
          createdDate = booking.createdAt;
        }
      }

      // Format booking date to Shamsi (Persian) calendar
      let bookingDateShamsi = booking.bookingDate;
      if (booking.bookingDate) {
        try {
          // Try to parse the date - it might be in format like "2024-01-15" or "15/01/2024"
          let dateObj;
          if (booking.bookingDate.includes('-')) {
            // Format: YYYY-MM-DD
            dateObj = new Date(booking.bookingDate);
          } else if (booking.bookingDate.includes('/')) {
            // Format: DD/MM/YYYY or MM/DD/YYYY
            const parts = booking.bookingDate.split('/');
            if (parts.length === 3) {
              // Assume DD/MM/YYYY format
              dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
            }
          }

          if (dateObj && !isNaN(dateObj.getTime())) {
            bookingDateShamsi = dateObj.toLocaleDateString('fa-IR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          }
        } catch (e) {
          // Keep original value if conversion fails
          bookingDateShamsi = booking.bookingDate;
        }
      }

      // Remove any existing modal
      document.getElementById('bookingDetailsModal')?.remove();

      const isMobileViewport = window.matchMedia('(max-width: 640px)').matches;
      const modalMaxHeight = isMobileViewport ? '98vh' : '92vh';
      const contentOffset = isMobileViewport ? 120 : 180;
      const contentMaxHeight = `calc(${modalMaxHeight} - ${contentOffset}px)`;

      // Create and insert modal
      document.body.insertAdjacentHTML('beforeend', `
          <div id="bookingDetailsModal" class="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4" style="z-index:9999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);animation:fadein .2s">
            <div class="bg-gradient-to-br from-white to-gray-50 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-[650px] overflow-hidden shadow-2xl" style="z-index:10000;animation:slideUp .3s ease-out;max-height:${modalMaxHeight}">

              <!-- Header with Gradient -->
              <div class="sticky top-0 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-6 py-5 flex justify-between items-center shadow-lg" style="z-index:100">
                <div class="flex items-center gap-3">
                  <div class="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                  </div>
                  <h2 class="text-xl sm:text-2xl font-bold text-white drop-shadow-sm">جزئیات رزرو</h2>
                </div>
                <button class="close-booking-modal text-white/90 hover:text-white hover:bg-white/20 rounded-xl p-2.5 transition-all duration-200 backdrop-blur-sm">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <!-- Content with Card Design -->
              <div class="p-5 sm:p-7 space-y-5 pb-28 sm:pb-7 overflow-y-auto" style="max-height:${contentMaxHeight}">

                <!-- Service Card -->
                <div class="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-200">
                  <div class="flex items-start gap-3">
                    <div class="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl shadow-md flex-shrink-0">
                      <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                      </svg>
                    </div>
                    <div class="flex-1">
                      <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">خدمت درخواستی</div>
                      <div class="text-gray-900 text-lg font-bold">${escapeHtml(booking.service)}</div>
                    </div>
                  </div>
                </div>

                <!-- Shop Card -->
                <div class="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-200">
                  <div class="flex items-start gap-3">
                    <div class="bg-gradient-to-br from-purple-500 to-pink-600 p-2.5 rounded-xl shadow-md flex-shrink-0">
                      <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                      </svg>
                    </div>
                    <div class="flex-1">
                      <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">فروشگاه</div>
                      <div class="text-gray-800">
                        ${(() => {
          const sellerLink = getSellerLink(booking);
          if (sellerLink) {
            return `<a href="${sellerLink}"
                                       class="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-2 hover:gap-3 transition-all group"
                                       target="_blank" rel="noopener noreferrer">
                                      ${escapeHtml(booking.sellerName || 'فروشگاه')}
                                      <svg class="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                      </svg>
                                    </a>`;
          }
          return `<span class="font-semibold text-gray-900">${escapeHtml(booking.sellerName || 'فروشگاه')}</span>`;
        })()}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Date & Time Card -->
                <div class="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-200">
                  <div class="flex items-start gap-3">
                    <div class="bg-gradient-to-br from-green-500 to-emerald-600 p-2.5 rounded-xl shadow-md flex-shrink-0">
                      <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                    </div>
                    <div class="flex-1">
                      <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">زمان رزرو</div>
                      <div class="space-y-3">
                        <div class="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                          <div class="bg-white p-2 rounded-lg shadow-sm">
                            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                          </div>
                          <span class="text-gray-900 font-semibold">${escapeHtml(bookingDateShamsi)}</span>
                        </div>
                        <div class="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                          <div class="bg-white p-2 rounded-lg shadow-sm">
                            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                          </div>
                          <span class="text-gray-900 font-semibold">${escapeHtml(booking.startTime)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Status Card -->
                <div class="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-200">
                  <div class="flex items-start gap-3">
                    <div class="bg-gradient-to-br from-orange-500 to-red-600 p-2.5 rounded-xl shadow-md flex-shrink-0">
                      <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                    <div class="flex-1">
                      <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">وضعیت رزرو</div>
                      <span class="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold shadow-sm ${getStatusBadgeClass(booking.status)}">
                        ${getStatusLabel(booking.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Created Date Card -->
                <div class="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-200">
                  <div class="flex items-start gap-3">
                    <div class="bg-gradient-to-br from-gray-500 to-gray-700 p-2.5 rounded-xl shadow-md flex-shrink-0">
                      <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                    <div class="flex-1">
                      <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">تاریخ ثبت رزرو</div>
                      <div class="text-gray-800 font-semibold">${escapeHtml(createdDate)}</div>
                    </div>
                  </div>
                </div>

                ${booking.customerName || booking.customerPhone ? `
                  <!-- Customer Info Card -->
                  <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 shadow-md border border-blue-100 hover:shadow-lg transition-shadow duration-200">
                    <div class="flex items-start gap-3">
                      <div class="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl shadow-md flex-shrink-0">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                      </div>
                      <div class="flex-1">
                        <div class="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">اطلاعات مشتری</div>
                        <div class="space-y-2.5">
                          ${booking.customerName ? `
                            <div class="flex items-center gap-2 bg-white rounded-lg p-3 shadow-sm">
                              <svg class="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                              </svg>
                              <span class="text-gray-600 text-sm font-medium">نام:</span>
                              <span class="text-gray-900 font-semibold">${escapeHtml(booking.customerName)}</span>
                            </div>
                          ` : ''}
                          ${booking.customerPhone ? `
                            <div class="flex items-center gap-2 bg-white rounded-lg p-3 shadow-sm">
                              <svg class="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                              </svg>
                              <span class="text-gray-600 text-sm font-medium">تلفن:</span>
                              <span class="text-gray-900 font-semibold font-mono">${escapeHtml(booking.customerPhone)}</span>
                            </div>
                          ` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ` : ''}

              </div>

              <!-- Footer - Mobile Fixed with Gradient -->
              <div class="fixed sm:sticky bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent px-6 pt-4 pb-5 border-t border-gray-200 sm:rounded-b-3xl backdrop-blur-sm" style="box-shadow: 0 -4px 20px rgba(0,0,0,0.08);padding-bottom:calc(env(safe-area-inset-bottom,0px) + 20px)">
                <button
                  class="close-booking-modal w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-gray-700 to-gray-900 text-white rounded-xl hover:from-gray-800 hover:to-black transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] duration-200">
                  بستن
                </button>
              </div>

            </div>
          </div>
        `);

      // Add event listeners for modal close buttons
      document.querySelectorAll('.close-booking-modal').forEach(btn => {
        btn.addEventListener('click', closeBookingDetails);
      });

      // Also close when clicking the backdrop
      const modal = document.getElementById('bookingDetailsModal');
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            closeBookingDetails();
          }
        });
      }

      // Close on ESC key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          closeBookingDetails();
        }
      };
      document.addEventListener('keydown', handleEscape);

      // Store handler for cleanup
      modal._escapeHandler = handleEscape;
    }

    // Close booking details modal
    function closeBookingDetails() {
      const modal = document.getElementById('bookingDetailsModal');
      if (modal && modal._escapeHandler) {
        document.removeEventListener('keydown', modal._escapeHandler);
      }
      modal?.remove();
    }

    // Helper to escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text == null ? '' : String(text);
      return div.innerHTML;
    }

    // داشبورد پیش‌فرض - Welcome is now in Hero Header
    const dashboardSection = `

  <!-- پاپ‌آپ استریک روزانه -->
  <div class="streak-popup-overlay" id="streakPopupOverlay">
    <div class="streak-popup" id="streakPopup">
      <!-- هدر -->
      <div class="streak-popup-header">
        <button type="button" class="streak-popup-close" id="streakPopupClose">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="streak-popup-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
            <line x1="16" x2="16" y1="2" y2="6"></line>
            <line x1="8" x2="8" y1="2" y2="6"></line>
            <line x1="3" x2="21" y1="10" y2="10"></line>
            <path d="m9 16 2 2 4-4"></path>
          </svg>
        </div>
        <h2 class="streak-popup-title">ورود روزانه</h2>
        <p class="streak-popup-subtitle">هر روز وارد شو، امتیاز بگیر</p>
      </div>

      <!-- بدنه -->
      <div class="streak-popup-body">
        <!-- کارت شمارنده -->
        <div class="streak-counter-card">
          <div class="streak-counter-number" id="streakNumber">0</div>
          <div class="streak-counter-label">روز متوالی</div>
          <span class="streak-counter-badge" id="streakLevel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
              <path d="M4 22h16"></path>
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
            </svg>
            <span id="streakLevelText">تازه‌کار</span>
          </span>
        </div>

        <!-- آمار -->
        <div class="streak-popup-stats">
          <div class="streak-popup-stat">
            <div class="streak-popup-stat-icon trophy">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                <path d="M4 22h16"></path>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
              </svg>
            </div>
            <div class="streak-popup-stat-value" id="longestStreak">0</div>
            <div class="streak-popup-stat-label">بیشترین رکورد</div>
          </div>
          <div class="streak-popup-stat">
            <div class="streak-popup-stat-icon calendar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                <line x1="16" x2="16" y1="2" y2="6"></line>
                <line x1="8" x2="8" y1="2" y2="6"></line>
                <line x1="3" x2="21" y1="10" y2="10"></line>
              </svg>
            </div>
            <div class="streak-popup-stat-value" id="totalLoginDays">0</div>
            <div class="streak-popup-stat-label">کل ورودها</div>
          </div>
        </div>

        <!-- تاریخچه هفتگی -->
        <div class="streak-popup-week" id="streakWeek">
          <!-- با جاوااسکریپت پر می‌شود -->
        </div>

        <!-- دکمه چک‌این -->
        <button type="button" class="streak-popup-checkin-btn active" id="streakCheckinBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span id="streakCheckinText">ثبت ورود امروز</span>
        </button>

        <!-- دکمه بستن -->
        <button type="button" class="streak-popup-dismiss" id="streakPopupDismiss">
          بعداً یادآوری کن
        </button>
      </div>
    </div>
  </div>

  <!-- بنر کوچک استریک -->
  <div class="streak-mini-banner" id="streakMiniBanner">
    <div class="streak-mini-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
        <line x1="16" x2="16" y1="2" y2="6"></line>
        <line x1="8" x2="8" y1="2" y2="6"></line>
        <line x1="3" x2="21" y1="10" y2="10"></line>
        <path d="m9 16 2 2 4-4"></path>
      </svg>
    </div>
    <div class="streak-mini-content">
      <h4 class="streak-mini-title">ورود روزانه</h4>
      <p class="streak-mini-subtitle" id="streakMiniSubtitle">برای دریافت پاداش کلیک کنید</p>
    </div>
    <div class="streak-mini-count">
      <span class="streak-mini-number" id="streakMiniNumber">0</span>
      <span class="streak-mini-label">روز</span>
    </div>
    <svg class="streak-mini-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  </div>

  <!-- مودال جزئیات ماموریت -->
  <div class="mission-modal-overlay" id="missionModalOverlay" aria-hidden="true">
    <div class="mission-modal" id="missionModal" role="dialog" aria-modal="true" aria-labelledby="missionModalTitle">
      <!-- هدر -->
      <div class="mission-modal-header" id="missionModalHeader">
        <div class="mission-modal-header-row">
          <div class="mission-modal-icon" id="missionModalIcon">🎁</div>
          <button type="button" class="mission-modal-close" id="missionModalClose" aria-label="بستن">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="mission-modal-title-group">
          <h2 class="mission-modal-title" id="missionModalTitle">دعوت از دوستان</h2>
          <div class="mission-modal-reward" id="missionModalReward">۵,۰۰۰ تومان</div>
        </div>
      </div>

      <!-- بدنه -->
      <div class="mission-modal-body">
        <!-- محتوای داینامیک -->
        <div id="missionModalBodyContent" class="mission-modal-content">
          <!-- با جاوااسکریپت پر می‌شود -->
        </div>

        <div class="mission-modal-actions" id="missionModalActions">
          <!-- دکمه‌ها با جاوااسکریپت پر می‌شوند -->
        </div>

        <button type="button" class="mission-modal-dismiss" id="missionModalDismiss">
          بعداً
        </button>
      </div>
    </div>
  </div>

  <!-- پیام موفقیت کپی -->
  <!-- مودال نیاز به ورود برای ماموریت‌ها -->
  <div class="mission-auth-modal-overlay" id="missionAuthModalOverlay" aria-hidden="true">
    <div class="mission-auth-modal" role="dialog" aria-modal="true" aria-labelledby="missionAuthModalTitle">
      <button type="button" class="mission-auth-modal-close" id="missionAuthModalClose" aria-label="بستن">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="mission-auth-modal-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="3"></rect>
          <path d="M7 11V8a5 5 0 0 1 10 0v3"></path>
          <circle cx="12" cy="16" r="1.5"></circle>
        </svg>
      </div>

      <h3 class="mission-auth-modal-title" id="missionAuthModalTitle">برای شروع ماموریت‌ها ابتدا وارد حساب شوید</h3>
      <p class="mission-auth-modal-desc">بعد از ورود، می‌توانید ماموریت‌های پول‌ساز را انجام دهید و جایزه بگیرید.</p>

      <div class="mission-auth-modal-actions">
        <a href="/login.html" class="mission-auth-modal-btn primary" id="missionAuthLoginBtn">ورود به حساب</a>
        <button type="button" class="mission-auth-modal-btn ghost" id="missionAuthDismissBtn">بعداً</button>
      </div>
    </div>
  </div>

  <div class="mission-copy-toast" id="missionCopyToast">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span id="missionCopyToastText">کپی شد!</span>
  </div>

  <!-- پیام پیشرفت ماموریت گردشگر -->
  <div class="mission-progress-toast" id="exploreProgressToast">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
    </svg>
    <span id="exploreProgressText">فروشگاه بازدید شد! (۱/۳)</span>
  </div>

  <!-- بخش کیف پول -->
  <div class="streak-wallet-container fadein">
    <!-- کارت کیف پول -->
    <div class="wallet-card" id="walletCard">
      <!-- هدر با گرادیانت -->
      <div class="wallet-header">
        <div class="wallet-header-pattern"></div>
        <div class="wallet-title">
          <div class="wallet-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
              <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"></path>
            </svg>
          </div>
          <div class="wallet-title-text">
            <h3>کیف پول من</h3>
            <p>اعتبار و پاداش‌های شما</p>
          </div>
        </div>
      </div>

      <!-- موجودی اصلی -->
      <div class="wallet-main">
        <div class="wallet-balance-label">موجودی فعلی</div>
        <div class="wallet-balance">
          <span id="walletBalance">0</span>
          <span class="wallet-balance-unit">تومان</span>
        </div>
      </div>

      <!-- آمار کسب و مصرف -->
      <div class="wallet-stats">
        <div class="wallet-stat earned">
          <div class="wallet-stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
          </div>
          <div class="wallet-stat-value" id="totalEarned">0</div>
          <div class="wallet-stat-label">کل کسب شده</div>
        </div>
        <div class="wallet-stat spent">
          <div class="wallet-stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
              <polyline points="17 18 23 18 23 12"></polyline>
            </svg>
          </div>
          <div class="wallet-stat-value" id="totalSpent">0</div>
          <div class="wallet-stat-label">کل مصرف شده</div>
        </div>
      </div>

    </div>
  </div>

  <!-- دسترسی سریع - Quick Action Bar -->
  <div class="quick-access-section fadein">
    <div class="quick-access-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      دسترسی سریع
    </div>
    <div class="quick-action-bar">
      <!-- رزرو خدمات -->
      <a href="/service-directory.html" class="quick-action">
        <svg class="quick-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span class="quick-action-label">رزرو</span>
      </a>

      <!-- فروشگاه -->
      <a href="/all-products.html" class="quick-action">
        <svg class="quick-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        <span class="quick-action-label">فروشگاه</span>
      </a>

      <!-- پیام‌ها -->
      <button type="button" class="quick-action" data-section="messages">
        <svg class="quick-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="quick-action-label">پیام‌ها</span>
      </button>

      <!-- علاقه‌مندی‌ها -->
      <button type="button" class="quick-action" data-section="favorites">
        <svg class="quick-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
        <span class="quick-action-label">علاقه‌مندی</span>
      </button>

      <!-- رزروهای من -->
      <button type="button" class="quick-action" data-section="bookings">
        <svg class="quick-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span class="quick-action-label">رزروها</span>
      </button>

      <!-- پروفایل -->
      <button type="button" class="quick-action" data-section="profile">
        <svg class="quick-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span class="quick-action-label">پروفایل</span>
      </button>
    </div>
  </div>

  <!-- ماموریت‌های پولساز - Separate container for proper horizontal scroll -->
  <div class="missions-section">
    <div class="missions-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="8" r="6"></circle>
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"></path>
      </svg>
      ماموریت‌های پولساز
    </div>
    <div class="missions-scroll" id="missionsScroll">
      <!-- Skeleton cards - will be replaced by JavaScript -->
      <div class="mission-card-skeleton"><div class="skeleton-reward"></div><div class="skeleton-title"></div></div>
      <div class="mission-card-skeleton"><div class="skeleton-reward"></div><div class="skeleton-title"></div></div>
      <div class="mission-card-skeleton"><div class="skeleton-reward"></div><div class="skeleton-title"></div></div>
      <div class="mission-card-skeleton"><div class="skeleton-reward"></div><div class="skeleton-title"></div></div>
      <div class="mission-card-skeleton"><div class="skeleton-reward"></div><div class="skeleton-title"></div></div>
    </div>
  </div>

  <!-- تراکنش‌های اخیر - Recent Transactions Section -->
  <div class="recent-transactions-section fadein">
    <div class="wallet-transactions-header">
      <span class="wallet-transactions-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
        تراکنش‌های اخیر
      </span>
    </div>
    <div class="wallet-transactions" id="recentTransactions">
      <!-- تراکنش‌های اخیر با جاوااسکریپت پر می‌شود -->
    </div>
    <!-- دکمه مشاهده همه -->
    <button type="button" class="wallet-view-all" id="viewAllTransactions">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      مشاهده همه تراکنش‌ها
    </button>
  </div>

  <!-- مودال تراکنش‌ها -->
  <div class="transactions-modal-overlay" id="transactionsModal">
    <div class="transactions-modal">
      <div class="transactions-modal-header">
        <div class="transactions-modal-title">
          <span>💳</span>
          <h3>تاریخچه تراکنش‌ها</h3>
        </div>
        <button type="button" class="transactions-modal-close" id="closeTransactionsModal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="transactions-modal-body" id="allTransactionsList">
        <!-- لیست کامل تراکنش‌ها -->
      </div>
    </div>
  </div>

  <!-- مودال اقدامات بیشتر -->
  <div id="moreActionsModal" class="more-actions-modal">
    <div class="more-actions-content">
      <div class="more-actions-header">
        <h3 class="text-lg font-bold text-gray-800">اقدامات بیشتر</h3>
        <button type="button" class="more-actions-close" id="closeMoreActions">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="more-actions-grid">
        <!-- رزروهای من -->
        <button type="button" class="more-action-item" data-section="bookings">
          <svg class="more-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>رزروهای من</span>
        </button>

        <!-- فروشگاه‌ها -->
        <a href="/all-shops.html" class="more-action-item">
          <svg class="more-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>فروشگاه‌ها</span>
        </a>

        <!-- جستجو -->
        <a href="/search.html" class="more-action-item">
          <svg class="more-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <span>جستجو</span>
        </a>

        <!-- تنظیمات -->
        <button type="button" class="more-action-item" data-section="profile">
          <svg class="more-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6m5.2-13.2l-4.2 4.2m0 6l-4.2 4.2M23 12h-6m-6 0H5m13.2 5.2l-4.2-4.2m0-6l-4.2-4.2"></path>
          </svg>
          <span>تنظیمات</span>
        </button>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-5 fadein">
    <div id="favBoxClick" class="glass p-6 flex flex-col items-center text-center min-h-[135px] justify-center cursor-pointer hover:shadow-lg transition">
      <div class="text-[#0ea5e9] font-bold text-base mb-1">علاقه‌مندی‌های ثبت‌شده</div>
      <div class="text-4xl font-black primary-text mb-1" id="favCountDashboard">-</div>
    <a href="#" class="text-xs font-bold text-[#0ea5e9] hover:underline menu-btn mt-2" data-section="favorites">نمایش لیست</a>
    </div>
    <div id="recentFavsContainerWrapper" class="flex flex-col">
      <div id="recentFavsContainer"></div>
    </div>
  </div>
  `;





    function setupQuickActions() {
      // اقدامات سریع با data-section
      document.querySelectorAll('.quick-action[data-section]').forEach(action => {
        action.addEventListener('click', (event) => {
          event.preventDefault();
          const target = action.getAttribute('data-section');
          if (target) {
            showSection(target);
          }
        });
      });

      // دکمه "بیشتر..."
      const moreBtn = document.getElementById('moreActionsBtn');
      const modal = document.getElementById('moreActionsModal');
      const closeBtn = document.getElementById('closeMoreActions');

      if (moreBtn && modal) {
        moreBtn.addEventListener('click', () => {
          modal.classList.add('active');
        });
      }

      if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
          modal.classList.remove('active');
        });
      }

      // بستن مودال با کلیک روی پس‌زمینه
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.classList.remove('active');
          }
        });
      }

      // اقدامات بیشتر در مودال
      document.querySelectorAll('.more-action-item[data-section]').forEach(item => {
        item.addEventListener('click', (event) => {
          event.preventDefault();
          const target = item.getAttribute('data-section');
          if (target) {
            modal.classList.remove('active');
            showSection(target);
          }
        });
      });

      // بستن مودال با کلید ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
          modal.classList.remove('active');
        }
      });
    }

    async function renderRecentFavorites() {
      const container = document.getElementById('recentFavsContainer');
      container.innerHTML = `
      <div class="glass px-6 py-5 fadein">
        <div class="flex items-center justify-between mb-4">
          <span id="recentFavsTitle" class="text-lg font-bold primary-text cursor-pointer">علاقه‌مندی‌های اخیر شما</span>
          <a href="#" id="recentFavsShowAll" class="text-[#0ea5e9] hover:underline font-bold text-sm menu-btn">مشاهده همه</a>
        </div>
        <div class="flex flex-wrap gap-3 scrollbar-hide overflow-x-auto" id="recentFavsList">
          <div class="text-gray-400 text-center w-full py-3">در حال دریافت ...</div>
        </div>
      </div>
    `;

      try {
        // درخواست با کوکی و بدون هدر Authorization
        const res = await fetch('/api/user/profile', {
          method: 'GET',
          credentials: 'include', // کوکی‌ها (توکن) ارسال می‌شود
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!res.ok) throw new Error();

        const user = await res.json();
        const favs = Array.isArray(user.favorites) ? user.favorites : [];

        const favsList = container.querySelector("#recentFavsList");
        if (favs.length === 0) {
          favsList.innerHTML = `<div class="text-gray-400 text-center w-full py-3">هنوز علاقه‌مندی ثبت نکردی!</div>`;
        } else {
          favsList.innerHTML = favs.slice(-3).reverse().map(p => {
            const shop = (p.sellerId && typeof p.sellerId === 'object') ? p.sellerId : {};
            return `
            <div class="min-w-[170px] max-w-xs bg-[#e0fdfa] rounded-xl p-3 flex flex-col items-center text-center">
              <img src="${(p.images && p.images[0]) ? p.images[0] : '/assets/images/noimage.png'}" class="w-20 h-20 object-cover rounded-xl mb-2 shadow" alt="${p.title || ''}"/>
              <span class="text-[#10b981] text-base font-bold mb-1">${p.title || '-'}</span>
              <span class="text-xs text-gray-500 mb-1">${shop.storename ? `فروشگاه ${shop.storename}` : ''}</span>
              <span class="text-xs text-gray-600 mb-1">قیمت: ${p.price ? p.price.toLocaleString('fa-IR') + ' تومان' : '-'}</span>
              <a href="http://localhost:5000/product.html?id=${p._id}" class="mt-2 px-4 py-1.5 rounded-lg brand-btn text-xs font-bold inline-block" target="_blank" rel="noopener noreferrer">مشاهده محصول</a>
            </div>
          `;
          }).join('');
        }
      } catch (e) {
        const favsList = container.querySelector("#recentFavsList");
        favsList.innerHTML = `<div class="text-red-400 text-center w-full py-3">دریافت لیست علاقه‌مندی‌ها ناموفق بود.</div>`;
      }
    }






    // ═══════════════════════════════════════════════════════════════
    // مودال جزئیات ماموریت‌ها
    // ═══════════════════════════════════════════════════════════════
    
    let missionAuthCheckPromise = null;

    function getMissionLoginUrl() {
      const redirectTarget = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      return `/login.html?redirect=${encodeURIComponent(redirectTarget)}`;
    }

    function closeMissionAuthModal() {
      const overlay = document.getElementById('missionAuthModalOverlay');
      if (!overlay || !overlay.classList.contains('active')) return false;
      const prevOverflow = overlay.dataset.prevOverflow || '';
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = prevOverflow;
      delete overlay.dataset.prevOverflow;
      return true;
    }

    function setupMissionAuthModalListeners() {
      const overlay = document.getElementById('missionAuthModalOverlay');
      if (!overlay || overlay.dataset.bound === 'true') return;

      const closeBtn = document.getElementById('missionAuthModalClose');
      const dismissBtn = document.getElementById('missionAuthDismissBtn');

      if (closeBtn) closeBtn.onclick = closeMissionAuthModal;
      if (dismissBtn) dismissBtn.onclick = closeMissionAuthModal;

      overlay.onclick = (event) => {
        if (event.target === overlay) {
          closeMissionAuthModal();
        }
      };

      overlay.dataset.bound = 'true';
    }

    function showMissionAuthModal() {
      const overlay = document.getElementById('missionAuthModalOverlay');
      if (!overlay) {
        window.location.href = getMissionLoginUrl();
        return;
      }

      setupMissionAuthModalListeners();

      const loginBtn = document.getElementById('missionAuthLoginBtn');
      if (loginBtn) {
        loginBtn.setAttribute('href', getMissionLoginUrl());
      }

      overlay.dataset.prevOverflow = document.body.style.overflow || '';
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (loginBtn) loginBtn.focus();
    }

    async function ensureMissionAuth() {
      if (profileState.isAuthenticated) return true;
      if (missionAuthCheckPromise) return missionAuthCheckPromise;

      missionAuthCheckPromise = (async () => {
        try {
          await updateSidebarUser();
        } catch (error) {
          console.warn('Mission auth check failed:', error);
        }
        return Boolean(profileState.isAuthenticated);
      })();

      const result = await missionAuthCheckPromise;
      missionAuthCheckPromise = null;
      return result;
    }

    const WHERE_IS_QUIZ_API_BASE = `${API_BASE}/where-is-quiz`;
    let whereIsQuizFetchPromise = null;
    let whereIsQuizCache = null;

    function normaliseWhereIsQuiz(quiz) {
      const source = quiz && typeof quiz === 'object' ? quiz : {};
      const options = Array.isArray(source.options)
        ? source.options
            .map((item) => {
              const id = String(item?.id || '').trim().toLowerCase();
              if (!['a', 'b', 'c', 'd'].includes(id)) return null;
              return { id, text: String(item?.text || '').trim() };
            })
            .filter(Boolean)
        : [];

      const orderedOptions = ['a', 'b', 'c', 'd'].map((id) => {
        const found = options.find((option) => option.id === id);
        return found || { id, text: '' };
      });

      const rewardValue = Number(source.rewardToman ?? missionData?.whereIs?.rewardToman);
      const rewardToman = Number.isFinite(rewardValue) && rewardValue >= 0
        ? Math.round(rewardValue)
        : 0;

      return {
        title: String(source.title || missionData.whereIs.title || 'اینجا کجاست؟').trim() || 'اینجا کجاست؟',
        subtitle: String(source.subtitle || missionData.whereIs.subtitle || '').trim(),
        imageUrl: String(source.imageUrl || missionData.whereIs.quizImage || '/assets/images/shop-placeholder.svg').trim() || '/assets/images/shop-placeholder.svg',
        options: orderedOptions,
        rewardToman
      };
    }

    function applyWhereIsQuizToMission(quiz) {
      if (!quiz || !missionData || !missionData.whereIs) return;
      missionData.whereIs.title = quiz.title || missionData.whereIs.title || 'اینجا کجاست؟';
      missionData.whereIs.subtitle = quiz.subtitle || missionData.whereIs.subtitle || '';
      missionData.whereIs.quizImage = quiz.imageUrl || missionData.whereIs.quizImage || '/assets/images/shop-placeholder.svg';
      missionData.whereIs.options = Array.isArray(quiz.options) && quiz.options.length === 4
        ? quiz.options.map((item) => ({ id: item.id, text: item.text || '' }))
        : missionData.whereIs.options;
      missionData.whereIs.rewardToman = Number.isFinite(Number(quiz.rewardToman)) && Number(quiz.rewardToman) >= 0
        ? Math.round(Number(quiz.rewardToman))
        : (missionData.whereIs.rewardToman || 0);
      missionData.whereIs.reward = 'جایزه پس از پاسخ صحیح';
    }

    async function fetchWhereIsQuiz(force = false) {
      if (!force && whereIsQuizCache) return whereIsQuizCache;
      if (!force && whereIsQuizFetchPromise) return whereIsQuizFetchPromise;

      whereIsQuizFetchPromise = fetch(`${WHERE_IS_QUIZ_API_BASE}/public`, {
        credentials: 'include'
      })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.success) {
            throw new Error(payload?.message || 'Failed to fetch where-is quiz');
          }

          if (!payload.active || !payload.quiz) {
            whereIsQuizCache = { active: false, quiz: null };
            return whereIsQuizCache;
          }

          const quiz = normaliseWhereIsQuiz(payload.quiz);
          applyWhereIsQuizToMission(quiz);
          whereIsQuizCache = { active: true, quiz };
          return whereIsQuizCache;
        })
        .catch((error) => {
          console.warn('where-is quiz fetch failed, fallback to local data:', error);
          const fallbackQuiz = normaliseWhereIsQuiz(missionData?.whereIs || {});
          applyWhereIsQuizToMission(fallbackQuiz);
          whereIsQuizCache = { active: true, quiz: fallbackQuiz, fallback: true };
          return whereIsQuizCache;
        })
        .finally(() => {
          whereIsQuizFetchPromise = null;
        });

      return whereIsQuizFetchPromise;
    }

    // دریافت کد معرف کاربر
    async function getUserReferralCode() {
      // اگر قبلاً گرفته شده، برگردون
      if (userReferralCode) return userReferralCode;
      
      try {
        const token = localStorage.getItem('token');
        if (!token) return null;
        
        const res = await fetch('/api/user/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          const user = data.user || data;
          if (user.referralCode && user.referralCode !== '---') {
            userReferralCode = user.referralCode;
            return userReferralCode;
          }
        }
      } catch (err) {
        console.error('Error fetching referral code:', err);
      }
      return null;
    }

    // نمایش مودال ماموریت
    async function showMissionModal(type) {
      const data = missionData[type];
      if (!data) return;

      const isAuthorized = await ensureMissionAuth();
      if (!isAuthorized) {
        showMissionAuthModal();
        return;
      }

      if (type === 'whereIs') {
        const whereIsResult = await fetchWhereIsQuiz(true);
        if (!whereIsResult?.active || !whereIsResult?.quiz) {
          showCopyToast('در حال حاضر سوال فعالی برای این بخش منتشر نشده است.');
          return;
        }
        applyWhereIsQuizToMission(whereIsResult.quiz);
      }

      closeMissionAuthModal();
      currentMissionType = type;

      const overlay = document.getElementById('missionModalOverlay');
      const header = document.getElementById('missionModalHeader');
      const icon = document.getElementById('missionModalIcon');
      const reward = document.getElementById('missionModalReward');
      const title = document.getElementById('missionModalTitle');
      const bodyContent = document.getElementById('missionModalBodyContent');
      const actions = document.getElementById('missionModalActions');
      const dismissButton = document.getElementById('missionModalDismiss');

      // پاک کردن هدر سفارشی قبلی (اگر وجود داشته باشد)
      const existingHero = header.querySelector('.install-app-hero');
      if (existingHero) existingHero.remove();

      // ریست کردن استایل‌های المنت‌های پیش‌فرض
      icon.style.cssText = '';
      reward.style.cssText = '';
      title.style.cssText = '';
      actions.style.display = '';
      overlay.classList.remove('where-is-mode');

      // مخفی کردن دکمه dismiss برای مدال رزرو نوبت (فقط یک دکمه اصلی نمایش داده می‌شود)
      const isBookingModal = Boolean(data.isBookingModal);
      const isWhereIsModal = Boolean(data.isWhereIsModal);
      if (dismissButton) {
        dismissButton.style.display = (isBookingModal || isWhereIsModal) ? 'none' : '';
      }

      // تنظیم کلاس رنگ
      header.className = 'mission-modal-header ' + type;

      // تنظیم محتوا
      icon.innerHTML = data.icon;
      title.textContent = data.title;

      // اگر مودال دعوت است، محتوای ویژه نمایش بده
      if (data.isInviteModal) {
        reward.style.display = 'none';
        
        // دریافت کد معرف واقعی کاربر
        const code = await getUserReferralCode() || '---';
        
        bodyContent.innerHTML = `
          <!-- کارت‌های پاداش -->
          <div class="invite-rewards-container">
            <!-- کارت دعوت کاربر -->
            <div class="invite-reward-card user">
              <div class="invite-reward-icon user">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <line x1="19" y1="8" x2="19" y2="14"></line>
                  <line x1="22" y1="11" x2="16" y2="11"></line>
                </svg>
              </div>
              <div class="invite-reward-content">
                <div class="invite-reward-title-row">
                  <p class="invite-reward-title">دعوت از دوستان</p>
                  <button
                    type="button"
                    class="invite-rules-info-btn"
                    onclick="openInviteRulesModal('friend')"
                    aria-label="قوانین دعوت از دوستان"
                    title="قوانین دعوت از دوستان"
                  >&#9432;</button>
                </div>
                <p class="invite-reward-subtitle">وقتی اولین رزروشون رو انجام بدن</p>
              </div>
              <div class="invite-reward-badge user">۵,۰۰۰ تومان</div>
            </div>

            <!-- کارت دعوت فروشنده -->
            <div class="invite-reward-card vendor">
              <div class="invite-reward-icon vendor">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <div class="invite-reward-content">
                <div class="invite-reward-title-row">
                  <p class="invite-reward-title">دعوت از فروشنده</p>
                  <button
                    type="button"
                    class="invite-rules-info-btn"
                    onclick="openInviteRulesModal('seller')"
                    aria-label="قوانین دعوت از فروشنده"
                    title="قوانین دعوت از فروشنده"
                  >&#9432;</button>
                </div>
                <p class="invite-reward-subtitle">پاداش ویژه برای معرفی کسب‌وکار!</p>
              </div>
              <div class="invite-reward-badge vendor">۵۰,۰۰۰ تومان</div>
            </div>
          </div>

          <!-- بخش کد معرف -->
          <div class="invite-code-section">
            <p class="invite-code-label">کد معرف شما</p>
            <p class="invite-code-value" dir="ltr">${code}</p>
          </div>

          <!-- پاپ‌آپ قوانین دعوت از دوستان -->
          <div
            class="invite-rules-popup-overlay"
            id="inviteFriendRulesPopup"
            aria-hidden="true"
            onclick="closeInviteRulesModalOnOverlay(event, 'friend')"
          >
            <div class="invite-rules-popup" role="dialog" aria-modal="true" aria-labelledby="inviteFriendRulesTitle">
              <button
                type="button"
                class="invite-rules-popup-close"
                onclick="closeInviteRulesModal('friend')"
                aria-label="بستن"
              >×</button>
              <h3 class="invite-rules-popup-title" id="inviteFriendRulesTitle">قوانین دعوت از دوستان</h3>
              <div class="invite-rules-popup-body">
                <ul class="invite-rules-list">
                  <li>پاداش هر دعوت موفق: ۵,۰۰۰ تومان اعتبار.</li>
                  <li>پاداش زمانی ثبت می‌شود که کاربر دعوت‌شده اولین رزرو موفق خود را انجام دهد.</li>
                  <li>هر کاربر فقط یک‌بار با کد معرف ثبت می‌شود و فقط یک پاداش ثبت خواهد شد.</li>
                  <li>دعوت‌های غیرواقعی یا تکراری مشمول پاداش نیستند.</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- پاپ‌آپ قوانین دعوت از فروشنده -->
          <div
            class="invite-rules-popup-overlay"
            id="inviteSellerRulesPopup"
            aria-hidden="true"
            onclick="closeInviteRulesModalOnOverlay(event, 'seller')"
          >
            <div class="invite-rules-popup" role="dialog" aria-modal="true" aria-labelledby="inviteSellerRulesTitle">
              <button
                type="button"
                class="invite-rules-popup-close"
                onclick="closeInviteRulesModal('seller')"
                aria-label="بستن"
              >×</button>
              <h3 class="invite-rules-popup-title" id="inviteSellerRulesTitle">قوانین دعوت از فروشنده</h3>
              <div class="invite-rules-popup-body">
                <ul class="invite-rules-list">
                  <li>پاداش هر دعوت فروشنده موفق: ۵۰,۰۰۰ تومان اعتبار.</li>
                  <li>فروشنده باید ثبت‌نام را کامل کند و حساب او تایید نهایی شود.</li>
                  <li>پاداش پس از تایید اطلاعات فروشنده به کیف پول شما اضافه می‌شود.</li>
                  <li>ثبت چند حساب برای یک کسب‌وکار یا اطلاعات نامعتبر، پاداش را باطل می‌کند.</li>
                </ul>
              </div>
            </div>
          </div>
        `;
      } else if (data.isWhereIsModal) {
        whereIsSelectedOptionId = null;
        overlay.classList.add('where-is-mode');
        icon.style.display = 'none';
        reward.style.display = 'none';
        reward.textContent = '';
        actions.style.display = 'none';
        actions.innerHTML = '';

        const options = Array.isArray(data.options) ? data.options : [];
        const rewardAmount = Number.isFinite(Number(data.rewardToman)) && Number(data.rewardToman) >= 0
          ? Math.round(Number(data.rewardToman))
          : Math.round(Number(missionData?.whereIs?.rewardToman) || 0);
        const rewardLabel = formatWhereIsRewardLabel(rewardAmount);
        const optionsHTML = options.map((option, index) => `
          <button
            type="button"
            class="where-is-option"
            data-option-id="${escapeHtml(option.id)}"
            onclick="selectWhereIsOption('${escapeHtml(option.id)}')"
          >
            <span class="where-is-option-index">${index + 1}</span>
            <span class="where-is-option-text">${escapeHtml(option.text)}</span>
          </button>
        `).join('');

        bodyContent.innerHTML = `
          <div class="where-is-sheet">
            <div class="where-is-meta">
              <p class="where-is-subtitle">${escapeHtml(data.subtitle || '')}</p>
              <div class="where-is-reward-pill" aria-label="مبلغ جایزه">
                <span class="where-is-reward-pill-label">جایزه این سوال</span>
                <strong>${escapeHtml(rewardLabel)}</strong>
              </div>
            </div>
            <figure class="where-is-image-wrap">
              <img src="${escapeHtml(data.quizImage || '/assets/images/shop-placeholder.svg')}" alt="تصویر فروشگاه" class="where-is-image" loading="lazy" />
            </figure>
            <div class="where-is-options" id="whereIsOptions">
              ${optionsHTML}
            </div>
            <div class="where-is-result" id="whereIsResult"></div>
            <div class="where-is-submit-wrap">
              <button type="button" class="where-is-submit-btn" id="whereIsSubmitBtn" onclick="submitWhereIsAnswer()" disabled>
                ثبت پاسخ
              </button>
            </div>
          </div>
        `;
      } else if (data.isExploreModal) {
        // مودال پاساژگردی آنلاین - طراحی پریمیوم V4
        reward.style.cssText = 'display: none !important;';
        icon.style.cssText = 'display: none !important;';
        title.style.cssText = 'display: none !important;';
        
        // تنظیم هدر به حالت مینیمال با گرادیانت
        header.classList.add('explore-modal-header-premium');
        
        bodyContent.innerHTML = `
          <!-- طراحی پریمیوم مودال پاساژگردی V4 -->
          <div class="explore-modal-premium">
            <!-- شکل ارگانیک درخشان پس‌زمینه -->
            <div class="explore-blob-bg">
              <div class="explore-blob"></div>
            </div>
            
            <!-- آیکون اصلی با سایه و عمق -->
            <div class="explore-hero-icon">
              <div class="explore-hero-glow"></div>
              <div class="explore-hero-circle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </div>
              <!-- بج تایمر با سایه -->
              <div class="explore-timer-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
            </div>
            
            <!-- عنوان و توضیحات -->
            <h2 class="explore-premium-title">پاساژگردی آنلاین</h2>
            <p class="explore-premium-desc">فقط ۹۰ ثانیه در بازارچه بچرخید و جایزه بگیرید!</p>
            
            <!-- کپسول جایزه درخشان -->
            <div class="explore-reward-capsule">
              <div class="explore-reward-sparkle"></div>
              <div class="explore-reward-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 12 20 22 4 22 4 12"/>
                  <rect x="2" y="7" width="20" height="5"/>
                  <line x1="12" y1="22" x2="12" y2="7"/>
                  <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                  <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                </svg>
                <span class="explore-sparkle-dot"></span>
                <span class="explore-sparkle-dot"></span>
                <span class="explore-sparkle-dot"></span>
              </div>
              <span class="explore-reward-amount">۲۰۰ تومان هدیه</span>
            </div>
            
            <!-- دکمه اصلی پریمیوم -->
            <button type="button" class="explore-premium-btn" onclick="handleMissionAction('startExplore')">
              <span>شروع گردش در بازار</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"/>
                <path d="m12 5-7 7 7 7"/>
              </svg>
            </button>
            
            <!-- لینک بعداً -->
            <button type="button" class="explore-premium-later" onclick="closeMissionModal()">
              بعداً
            </button>
          </div>
        `;
        
        // مخفی کردن دکمه‌های پیش‌فرض
        actions.style.display = 'none';
        if (dismissButton) dismissButton.style.display = 'none';
        
        // نمایش مودال و خروج زودهنگام
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        setupMissionModalListeners();
        return;
      } else if (data.isInstallAppModal) {
        // مودال نصب اپلیکیشن با طراحی پریمیوم V2
        reward.style.cssText = 'display: none !important;';
        icon.style.cssText = 'display: none !important;';
        title.style.cssText = 'display: none !important;';
        
        // اضافه کردن هدر سفارشی
        const heroHTML = `
          <div class="install-app-hero">
            <div class="install-app-phone">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                <path d="M12 18h.01"/>
                <path d="M9 6h6"/>
              </svg>
            </div>
            <div class="install-app-hero-content">
              <h2 class="install-app-hero-title">نصب اپلیکیشن ویترینت</h2>
              <p class="install-app-hero-subtitle">نصب کن و جایزه بگیر!</p>
              <div class="install-app-reward-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 12 20 22 4 22 4 12"/>
                  <rect x="2" y="7" width="20" height="5"/>
                  <line x1="12" y1="22" x2="12" y2="7"/>
                  <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                  <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                </svg>
                <span>۱۰,۰۰۰ تومان هدیه</span>
              </div>
            </div>
          </div>
        `;
        header.insertAdjacentHTML('beforeend', heroHTML);
        
        bodyContent.innerHTML = `
          <!-- راهنمای گام به گام با طراحی کارتی -->
          <div class="install-steps-premium">
            <!-- مرحله ۱ -->
            <div class="install-step-premium">
              <div class="install-step-icon-wrap">
                <div class="install-step-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </div>
              </div>
              <div class="install-step-content-premium">
                <span class="install-step-num">۱</span>
                <p class="install-step-title-premium">دانلود فایل نصب</p>
                <p class="install-step-desc-premium">از دکمه پایین صفحه فایل نصب را دانلود کنید</p>
              </div>
            </div>
            
            <!-- مرحله ۲ -->
            <div class="install-step-premium">
              <div class="install-step-icon-wrap">
                <div class="install-step-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                </div>
              </div>
              <div class="install-step-content-premium">
                <span class="install-step-num">۲</span>
                <p class="install-step-title-premium">صدور مجوز نصب</p>
                <p class="install-step-desc-premium">در تنظیمات گوشی، اجازه نصب از منابع ناشناس را فعال کنید</p>
              </div>
            </div>
            
            <!-- مرحله ۳ -->
            <div class="install-step-premium last">
              <div class="install-step-icon-wrap">
                <div class="install-step-icon gift">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 12 20 22 4 22 4 12"/>
                    <rect x="2" y="7" width="20" height="5"/>
                    <line x1="12" y1="22" x2="12" y2="7"/>
                    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                  </svg>
                </div>
              </div>
              <div class="install-step-content-premium">
                <span class="install-step-num highlight">۳</span>
                <p class="install-step-title-premium">ورود و دریافت ۱۰,۰۰۰ تومان هدیه!</p>
                <p class="install-step-desc-premium">وارد حساب کاربری شوید تا جایزه به کیف پولتان اضافه شود</p>
              </div>
            </div>
          </div>
          
          <!-- بنر نکته مهم -->
          <div class="install-tip-banner">
            <span class="install-tip-icon">💡</span>
            <p class="install-tip-text">
              <strong>نکته:</strong> اعتبار هدیه بلافاصله پس از اولین ورود شما به اپلیکیشن اضافه می‌شود.
            </p>
          </div>
        `;
      } else if (data.isBookingModal) {
        // مودال رزرو نوبت با طراحی پریمیوم
        reward.style.display = 'none';
        
        bodyContent.innerHTML = `
          <div class="booking-modal-content">
            <!-- Hero Section with Illustration -->
            <div class="booking-hero-section">
              <div class="booking-illustration">
                <div class="booking-illustration-bg"></div>
                <div class="booking-illustration-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                    <path d="M9 16l2 2 4-4"/>
                  </svg>
                </div>
              </div>
              <h3 class="booking-main-title">اولین نوبتت رو آنلاین بگیر!</h3>
              <p class="booking-subtitle">همین الان اولین نوبت خودت رو رزرو کن و هدیه نقدی بگیر.</p>
            </div>
            
            <!-- Reward Highlight Box -->
            <div class="booking-reward-box">
              <div class="booking-reward-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 12 20 22 4 22 4 12"/>
                  <rect x="2" y="7" width="20" height="5"/>
                  <line x1="12" y1="22" x2="12" y2="7"/>
                  <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                  <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                </svg>
              </div>
              <div class="booking-reward-content">
                <p class="booking-reward-label">هدیه ویژه شما</p>
                <p class="booking-reward-amount">۵,۰۰۰ تومان</p>
              </div>
            </div>
            
            <!-- دکمه‌های اکشن -->
            <div class="booking-actions-wrapper">
              <button type="button" class="booking-primary-btn booking-single-btn" onclick="handleMissionAction('bookAppointment')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                  <path d="M9 16l2 2 4-4"/>
                </svg>
                رزرو نوبت و دریافت هدیه
              </button>
              <button type="button" class="booking-dismiss-btn" onclick="closeMissionModal()">
                بعداً
              </button>
            </div>
          </div>
        `;
        
        // Hide default actions for booking modal (we have custom button in bodyContent)
        actions.innerHTML = '';
      } else {
        reward.style.display = '';
        reward.textContent = data.reward;
        bodyContent.innerHTML = `
          <div class="mission-modal-desc-card">
            <p class="mission-modal-desc">${data.desc}</p>
          </div>
        `;
      }

      // ساخت دکمه‌ها (فقط برای مدال‌هایی که دکمه سفارشی ندارند)
      if (!data.isBookingModal && !data.isWhereIsModal) {
        let actionsHTML = '';
        
        if (data.primaryBtn) {
          actionsHTML += `
            <button type="button" class="mission-modal-btn primary ${type}" onclick="handleMissionAction('${data.primaryBtn.action}')">
              ${data.primaryBtn.icon}
              ${data.primaryBtn.text}
            </button>
          `;
        }

        if (data.secondaryBtn) {
          actionsHTML += `
            <button type="button" class="mission-modal-btn secondary ${type}" onclick="handleMissionAction('${data.secondaryBtn.action}')">
              ${data.secondaryBtn.icon}
              ${data.secondaryBtn.text}
            </button>
          `;
        }

        actions.innerHTML = actionsHTML;
      }

      // نمایش مودال
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      
      // Setup listeners بعد از نمایش مودال
      setupMissionModalListeners();
    }

    // بستن مودال ماموریت
    function closeMissionModal() {
      const overlay = document.getElementById('missionModalOverlay');
      overlay.classList.remove('active');
      overlay.classList.remove('where-is-mode');
      overlay.setAttribute('aria-hidden', 'true');
      closeAnyInviteRulesModal();
      document.body.style.overflow = '';
      currentMissionType = null;
      whereIsSelectedOptionId = null;
    }

    function getInviteRulesPopupId(type) {
      return type === 'seller' ? 'inviteSellerRulesPopup' : 'inviteFriendRulesPopup';
    }

    function openInviteRulesModal(type) {
      const popup = document.getElementById(getInviteRulesPopupId(type));
      if (!popup) return;
      popup.classList.add('active');
      popup.setAttribute('aria-hidden', 'false');
    }

    function closeInviteRulesModal(type) {
      const popup = document.getElementById(getInviteRulesPopupId(type));
      if (!popup) return;
      popup.classList.remove('active');
      popup.setAttribute('aria-hidden', 'true');
    }

    function closeInviteRulesModalOnOverlay(event, type) {
      if (event.target === event.currentTarget) {
        closeInviteRulesModal(type);
      }
    }

    function closeAnyInviteRulesModal() {
      const activePopup = document.querySelector('.invite-rules-popup-overlay.active');
      if (!activePopup) return false;
      activePopup.classList.remove('active');
      activePopup.setAttribute('aria-hidden', 'true');
      return true;
    }

    // هندل کردن اکشن‌های ماموریت
    async function handleMissionAction(action) {
      switch (action) {
        case 'share':
          await shareMissionLink();
          break;
        case 'copy':
          await copyReferralCode();
          break;
        case 'browse':
          closeMissionModal();
          window.location.href = '/service-directory.html';
          break;
        case 'edit':
          closeMissionModal();
          // باز کردن مستقیم مدال ثبت تاریخ تولد
          setTimeout(() => {
            openBirthdayModal();
          }, 300);
          break;
        case 'startExplore':
          closeMissionModal();
          // Set pending flag for product feed browsing mission
          localStorage.setItem('vitrinet_mission_market_pending', Date.now().toString());
          window.location.href = '/all-products.html';
          break;
        case 'installApp':
          triggerPWAInstall();
          break;
        case 'bookAppointment':
          closeMissionModal();
          window.location.href = '/service-directory.html';
          break;
      }
    }

    // نصب PWA
    // ذخیره رویداد beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
    });
    
    function triggerPWAInstall() {
      if (deferredPrompt) {
        // اگر prompt نصب موجود است، نمایش بده
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            showCopyToast('🎉 در حال نصب...');
          }
          deferredPrompt = null;
        });
      } else {
        // اگر prompt موجود نیست، راهنمای دستی نمایش بده
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        if (isIOS) {
          showCopyToast('از منوی Share گزینه "Add to Home Screen" را انتخاب کنید');
        } else if (isAndroid) {
          showCopyToast('از منوی مرورگر گزینه "نصب برنامه" را انتخاب کنید');
        } else {
          showCopyToast('از منوی مرورگر گزینه "Install" را انتخاب کنید');
        }
      }
    }

    // اشتراک‌گذاری لینک
    async function shareMissionLink() {
      const code = await getUserReferralCode();
      if (!code || code === '---') {
        showCopyToast('کد معرف هنوز تولید نشده است');
        return;
      }
      
      const shareUrl = `${window.location.origin}/register.html?ref=${code}`;
      const shareText = `با این لینک ثبت‌نام کن و ۳ هزار تومان هدیه بگیر! 🎁`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: 'دعوت به ویترینت',
            text: shareText,
            url: shareUrl
          });
        } catch (err) {
          if (err.name !== 'AbortError') {
            await copyToClipboard(shareUrl, 'لینک کپی شد!');
          }
        }
      } else {
        await copyToClipboard(shareUrl, 'لینک کپی شد!');
      }
    }

    // کپی کد معرف
    async function copyReferralCode() {
      const code = await getUserReferralCode();
      if (!code || code === '---') {
        showCopyToast('کد معرف هنوز تولید نشده است');
        return;
      }
      await copyToClipboard(code, 'کد معرف کپی شد!');
    }

    // کپی به کلیپ‌بورد
    async function copyToClipboard(text, message) {
      try {
        await navigator.clipboard.writeText(text);
        showCopyToast(message);
      } catch (err) {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showCopyToast(message);
      }
    }

    // نمایش پیام کپی
    function showCopyToast(message) {
      const toast = document.getElementById('missionCopyToast');
      const toastText = document.getElementById('missionCopyToastText');
      toastText.textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 2000);
    }

    // Event Listeners برای مودال - استفاده از Event Delegation
    function setupMissionModalListeners() {
      const closeBtn = document.getElementById('missionModalClose');
      const dismissBtn = document.getElementById('missionModalDismiss');
      const overlay = document.getElementById('missionModalOverlay');

      // بستن با دکمه X
      if (closeBtn) {
        closeBtn.onclick = closeMissionModal;
      }
      
      // بستن با دکمه بعداً
      if (dismissBtn) {
        dismissBtn.onclick = closeMissionModal;
      }
      
      // بستن با کلیک روی overlay
      if (overlay) {
        overlay.onclick = (e) => {
          if (e.target.id === 'missionModalOverlay') {
            closeMissionModal();
          }
        };
      }
    }

    // بستن با Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (closeMissionAuthModal()) return;
        if (closeAnyInviteRulesModal()) return;
        closeMissionModal();
      }
    });

    // اجرای setup هنگام لود صفحه
    document.addEventListener('DOMContentLoaded', setupMissionModalListeners);

    // توابع کمکی برای کلیک روی کارت‌های ماموریت
    function showReferralSection() {
      showMissionModal('invite');
    }

    function showProfileSection() {
      showMissionModal('profile');
    }

    function showBookingMission() {
      showMissionModal('booking');
    }

    function showBookAppointmentMission() {
      showMissionModal('bookAppointment');
    }

    function showExploreMission() {
      showMissionModal('explore');
    }

    function showInstallAppMission() {
      showMissionModal('installApp');
    }

    function showWhereIsMission() {
      showMissionModal('whereIs');
    }

    function formatWhereIsRewardLabel(amount) {
      const numeric = Number(amount);
      const safeAmount = Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : 0;
      return `${safeAmount.toLocaleString('fa-IR')} تومان`;
    }

    function normaliseWhereIsCorrectOption(option) {
      const source = option && typeof option === 'object' ? option : {};
      const id = String(source.id || '').trim().toLowerCase();
      return {
        id: ['a', 'b', 'c', 'd'].includes(id) ? id : '',
        text: String(source.text || '').trim()
      };
    }

    function normaliseWhereIsCorrectOptionDetails(details) {
      const source = details && typeof details === 'object' ? details : {};
      return {
        description: String(source.description || '').trim(),
        address: String(source.address || '').trim(),
        link: String(source.link || '').trim()
      };
    }

    function resolveWhereIsCorrectOptionText(optionId = '') {
      const id = String(optionId || '').trim().toLowerCase();
      if (!['a', 'b', 'c', 'd'].includes(id)) return '';
      const options = Array.isArray(missionData?.whereIs?.options) ? missionData.whereIs.options : [];
      const found = options.find((item) => String(item?.id || '').trim().toLowerCase() === id);
      return String(found?.text || '').trim();
    }

    function toWhereIsSafeExternalLink(rawLink = '') {
      const value = String(rawLink || '').trim();
      if (!value) return '';
      const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      try {
        const parsed = new URL(candidate);
        if (!['http:', 'https:'].includes(parsed.protocol)) return '';
        return parsed.toString();
      } catch (error) {
        return '';
      }
    }

    function clearWhereIsAnswerHighlights() {
      const optionButtons = Array.from(document.querySelectorAll('.where-is-option'));
      optionButtons.forEach((button) => {
        button.classList.remove('is-correct-answer', 'is-wrong-choice');
      });
    }

    function highlightWhereIsAnswerOptions({ correctOptionId = '', selectedOptionId = '' } = {}) {
      const normalisedCorrectId = String(correctOptionId || '').trim().toLowerCase();
      const normalisedSelectedId = String(selectedOptionId || '').trim().toLowerCase();
      const optionButtons = Array.from(document.querySelectorAll('.where-is-option'));
      optionButtons.forEach((button) => {
        const buttonId = String(button.dataset.optionId || '').trim().toLowerCase();
        button.classList.toggle('is-correct-answer', Boolean(normalisedCorrectId) && buttonId === normalisedCorrectId);
        button.classList.toggle(
          'is-wrong-choice',
          Boolean(normalisedSelectedId)
            && Boolean(normalisedCorrectId)
            && buttonId === normalisedSelectedId
            && normalisedSelectedId !== normalisedCorrectId
        );
      });
    }

    function buildWhereIsCorrectInfoMarkup({ correctOption = null, correctOptionDetails = null } = {}) {
      const option = normaliseWhereIsCorrectOption(correctOption);
      const details = normaliseWhereIsCorrectOptionDetails(correctOptionDetails);
      const optionText = option.text || resolveWhereIsCorrectOptionText(option.id) || '';
      const safeLink = toWhereIsSafeExternalLink(details.link);
      const fallbackLinkLabel = String(details.link || '').trim();

      if (!optionText && !details.description && !details.address && !details.link) {
        return '';
      }

      const rows = [];
      if (optionText) {
        rows.push(`
          <div class="where-is-correct-info-row">
            <span class="where-is-correct-info-label">گزینه صحیح</span>
            <strong class="where-is-correct-info-value">${escapeHtml(optionText)}</strong>
          </div>
        `);
      }
      if (details.description) {
        rows.push(`
          <div class="where-is-correct-info-row">
            <span class="where-is-correct-info-label">توضیحات</span>
            <span class="where-is-correct-info-value">${escapeHtml(details.description)}</span>
          </div>
        `);
      }
      if (details.address) {
        rows.push(`
          <div class="where-is-correct-info-row">
            <span class="where-is-correct-info-label">آدرس</span>
            <span class="where-is-correct-info-value">${escapeHtml(details.address)}</span>
          </div>
        `);
      }
      if (safeLink) {
        rows.push(`
          <div class="where-is-correct-info-row">
            <span class="where-is-correct-info-label">لینک</span>
            <a href="${escapeHtml(safeLink)}" class="where-is-correct-info-link" target="_blank" rel="noopener noreferrer">مشاهده لینک</a>
          </div>
        `);
      } else if (fallbackLinkLabel) {
        rows.push(`
          <div class="where-is-correct-info-row">
            <span class="where-is-correct-info-label">لینک</span>
            <span class="where-is-correct-info-value">${escapeHtml(fallbackLinkLabel)}</span>
          </div>
        `);
      }

      return `
        <div class="where-is-correct-info">
          <p class="where-is-correct-info-title">اطلاعات گزینه صحیح</p>
          ${rows.join('')}
        </div>
      `;
    }

    function renderWhereIsResult({
      isCorrect = false,
      message = '',
      rewardToman = 0,
      correctOption = null,
      correctOptionDetails = null
    } = {}) {
      const resultEl = document.getElementById('whereIsResult');
      const rewardBadge = document.getElementById('missionModalReward');
      if (!resultEl) return;

      if (!message && !isCorrect) {
        resultEl.classList.remove('is-visible', 'is-correct', 'is-error');
        resultEl.innerHTML = '';
        clearWhereIsAnswerHighlights();
        if (rewardBadge) {
          rewardBadge.style.display = 'none';
          rewardBadge.textContent = '';
        }
        return;
      }

      const correctInfoMarkup = buildWhereIsCorrectInfoMarkup({ correctOption, correctOptionDetails });
      if (isCorrect) {
        const rewardLabel = formatWhereIsRewardLabel(rewardToman);
        resultEl.classList.remove('is-error');
        resultEl.classList.add('is-visible', 'is-correct');
        resultEl.innerHTML = `
          <p class="where-is-result-title">پاسخ صحیح بود</p>
          <p class="where-is-result-text">${escapeHtml(message || 'آفرین! پاسخ شما درست است.')}</p>
          ${correctInfoMarkup}
          <p class="where-is-result-reward">جایزه این سوال: <strong>${escapeHtml(rewardLabel)}</strong></p>
        `;
        if (rewardBadge) {
          rewardBadge.style.display = '';
          rewardBadge.textContent = rewardLabel;
        }
        return;
      }

      resultEl.classList.remove('is-correct');
      resultEl.classList.add('is-visible', 'is-error');
      const errorTitle = correctInfoMarkup ? 'پاسخ صحیح را ببینید' : 'نتیجه ثبت پاسخ';
      resultEl.innerHTML = `
        <p class="where-is-result-title">${errorTitle}</p>
        <p class="where-is-result-text">${escapeHtml(message || 'پاسخ ثبت شد.')}</p>
        ${correctInfoMarkup}
      `;
      if (rewardBadge) {
        rewardBadge.style.display = 'none';
        rewardBadge.textContent = '';
      }
    }

    function selectWhereIsOption(optionId) {
      whereIsSelectedOptionId = optionId;
      const options = document.querySelectorAll('.where-is-option');
      options.forEach((option) => {
        option.classList.toggle('is-selected', option.dataset.optionId === optionId);
      });
      clearWhereIsAnswerHighlights();

      renderWhereIsResult();

      const submitButton = document.getElementById('whereIsSubmitBtn');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'ثبت پاسخ';
      }
    }

    async function submitWhereIsAnswer() {
      if (!whereIsSelectedOptionId) return;
      const submitButton = document.getElementById('whereIsSubmitBtn');
      const optionButtons = Array.from(document.querySelectorAll('.where-is-option'));
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'در حال ثبت...';
      }

      try {
        const response = await fetch(`${WHERE_IS_QUIZ_API_BASE}/submit`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionId: whereIsSelectedOptionId })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.message || 'ثبت پاسخ انجام نشد.');
        }

        const payloadCorrectOption = normaliseWhereIsCorrectOption(payload?.correctOption);
        const resolvedCorrectOption = {
          id: payloadCorrectOption.id,
          text: payloadCorrectOption.text || resolveWhereIsCorrectOptionText(payloadCorrectOption.id)
        };
        const resolvedCorrectOptionDetails = normaliseWhereIsCorrectOptionDetails(payload?.correctOptionDetails);
        highlightWhereIsAnswerOptions({
          correctOptionId: resolvedCorrectOption.id,
          selectedOptionId: whereIsSelectedOptionId
        });

        if (payload?.isCorrect) {
          const rewardToman = Number.isFinite(Number(payload?.rewardToman)) && Number(payload?.rewardToman) >= 0
            ? Math.round(Number(payload.rewardToman))
            : Math.round(Number(missionData?.whereIs?.rewardToman) || 0);

          renderWhereIsResult({
            isCorrect: true,
            message: payload?.message || 'پاسخ شما صحیح بود.',
            rewardToman,
            correctOption: resolvedCorrectOption,
            correctOptionDetails: resolvedCorrectOptionDetails
          });
          optionButtons.forEach((button) => {
            button.disabled = true;
          });
          if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'پاسخ صحیح ثبت شد';
          }
          showCopyToast('تبریک! پاسخ شما صحیح بود.');
          return;
        }

        renderWhereIsResult({
          isCorrect: false,
          message: payload?.message || 'پاسخ ثبت شد.',
          correctOption: resolvedCorrectOption,
          correctOptionDetails: resolvedCorrectOptionDetails
        });
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'ارسال پاسخ دیگر';
        }
      } catch (error) {
        console.error('submit where-is answer failed:', error);
        renderWhereIsResult({
          isCorrect: false,
          message: error.message || 'خطا در ثبت پاسخ. لطفاً دوباره تلاش کنید.'
        });
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'ثبت پاسخ';
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // مودال ماموریت انجام شده - طراحی پریمیوم
    // ═══════════════════════════════════════════════════════════════
    function showCompletedMissionModal(missionType) {
      const missionInfo = {
        'user-review': {
          title: 'پاساژگردی آنلاین',
          reward: '۲۰۰',
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
          message: 'شما امروز این ماموریت را با موفقیت انجام دادید!',
          nextMessage: 'فردا دوباره می‌توانید این ماموریت را انجام دهید و جایزه بگیرید.'
        },
        'user-app-install': {
          title: 'نصب اپلیکیشن',
          reward: '۱۰,۰۰۰',
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><path d="M12 18h.01"/><path d="M12 6v6"/><path d="M9 9l3 3 3-3"/></svg>`,
          message: 'شما این ماموریت را با موفقیت انجام دادید!',
          nextMessage: 'از اپلیکیشن ویترینت لذت ببرید.'
        },
        'user-profile-complete': {
          title: 'ثبت تاریخ تولد',
          reward: '۵۰۰',
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>`,
          message: 'تاریخ تولد شما ثبت شده است!',
          nextMessage: 'منتظر سورپرایز روز تولدتان باشید.'
        },
        'user-book-appointment': {
          title: 'رزرو نوبت',
          reward: '۵,۰۰۰',
          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/></svg>`,
          message: 'شما این ماموریت را با موفقیت انجام دادید!',
          nextMessage: 'از خدمات رزرو شده لذت ببرید.'
        }
      };

      const info = missionInfo[missionType] || {
        title: 'ماموریت',
        reward: '---',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        message: 'این ماموریت قبلاً انجام شده است.',
        nextMessage: ''
      };

      // ایجاد مودال
      const existingModal = document.getElementById('completedMissionModal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'completedMissionModal';
      modal.className = 'completed-mission-overlay';
      modal.innerHTML = `
        <div class="completed-mission-card">
          <!-- دکمه بستن -->
          <button class="completed-mission-close" onclick="closeCompletedMissionModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          <!-- محتوای مودال -->
          <div class="completed-mission-content">
            <!-- آیکون موفقیت با انیمیشن -->
            <div class="completed-mission-success-icon">
              <div class="success-ring"></div>
              <div class="success-circle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
            
            <!-- عنوان -->
            <h2 class="completed-mission-title">ماموریت انجام شد!</h2>
            
            <!-- آیکون و نام ماموریت -->
            <div class="completed-mission-info">
              <span class="completed-mission-icon">${info.icon}</span>
              <h3 class="completed-mission-name">${info.title}</h3>
            </div>
            
            <!-- پیام -->
            <p class="completed-mission-message">${info.message}</p>
            
            <!-- جایزه دریافت شده -->
            <div class="completed-mission-reward-box">
              <div class="reward-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <div class="reward-text-wrap">
                <span class="completed-reward-label">جایزه دریافت شده</span>
                <span class="completed-reward-amount">${info.reward} تومان</span>
              </div>
            </div>
            
            <!-- پیام بعدی -->
            ${info.nextMessage ? `<p class="completed-mission-next">${info.nextMessage}</p>` : ''}
            
            <!-- دکمه -->
            <button class="completed-mission-btn" onclick="closeCompletedMissionModal()">
              متوجه شدم
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      
      // انیمیشن ورود
      requestAnimationFrame(() => {
        modal.classList.add('active');
      });

      // بستن با کلیک روی overlay
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeCompletedMissionModal();
        }
      });

      // بستن با Escape
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          closeCompletedMissionModal();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    }

    function closeCompletedMissionModal() {
      const modal = document.getElementById('completedMissionModal');
      if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // اکسپورت توابع ماموریت به window برای دسترسی از onclick
    // ═══════════════════════════════════════════════════════════════
    window.showBookingMission = showBookingMission;
    window.showBookAppointmentMission = showBookAppointmentMission;
    window.showExploreMission = showExploreMission;
    window.showInstallAppMission = showInstallAppMission;
    window.showWhereIsMission = showWhereIsMission;
    window.closeMissionModal = closeMissionModal;
    window.handleMissionAction = handleMissionAction;
    window.selectWhereIsOption = selectWhereIsOption;
    window.submitWhereIsAnswer = submitWhereIsAnswer;
    window.openInviteRulesModal = openInviteRulesModal;
    window.closeInviteRulesModal = closeInviteRulesModal;
    window.closeInviteRulesModalOnOverlay = closeInviteRulesModalOnOverlay;
    window.showCompletedMissionModal = showCompletedMissionModal;
    window.closeCompletedMissionModal = closeCompletedMissionModal;

    // ═══════════════════════════════════════════════════════════════
    // مودال ثبت تاریخ تولد
    // ═══════════════════════════════════════════════════════════════
    
    // پر کردن سلکت‌های روز و سال
    function initBirthdaySelects() {
      const daySelect = document.getElementById('birthdayDay');
      const yearSelect = document.getElementById('birthdayYear');
      
      if (!daySelect || !yearSelect) {
        console.warn('Birthday selects not found in DOM');
        return;
      }
      
      // پر کردن روزها (1-31)
      for (let i = 1; i <= 31; i++) {
        const option = document.createElement('option');
        option.value = i.toString().padStart(2, '0');
        option.textContent = i.toLocaleString('fa-IR');
        daySelect.appendChild(option);
      }
      
      // پر کردن سال‌ها (1395 تا 1300 - نزولی)
      for (let i = 1395; i >= 1300; i--) {
        const option = document.createElement('option');
        option.value = i.toString();
        option.textContent = i.toLocaleString('fa-IR');
        yearSelect.appendChild(option);
      }
    }

    // باز کردن مودال تاریخ تولد
    // باز کردن مودال تاریخ تولد - Premium Version
    function openBirthdayModal() {
      const overlay = document.getElementById('birthdayModalOverlay');
      if (!overlay) {
        console.warn('Birthday modal overlay not found');
        return;
      }
      
      // Reset form
      document.getElementById('birthdayDay').value = '';
      document.getElementById('birthdayMonth').value = '';
      document.getElementById('birthdayYear').value = '';
      checkBirthdayFormValid();
      
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      
      // Focus on first select
      setTimeout(() => {
        document.getElementById('birthdayDay').focus();
      }, 300);
    }
    // دسترسی global برای onclick در HTML
    window.openBirthdayModal = openBirthdayModal;

    // بستن مودال تاریخ تولد
    function closeBirthdayModal() {
      const overlay = document.getElementById('birthdayModalOverlay');
      if (!overlay) return;
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    // بررسی فعال بودن دکمه ثبت
    function checkBirthdayFormValid() {
      const day = document.getElementById('birthdayDay').value;
      const month = document.getElementById('birthdayMonth').value;
      const year = document.getElementById('birthdayYear').value;
      const submitBtn = document.getElementById('birthdaySubmitBtn');
      
      const isValid = day && month && year;
      submitBtn.disabled = !isValid;
    }

    // ثبت تاریخ تولد - Premium Version
    async function submitBirthday() {
      const day = document.getElementById('birthdayDay').value;
      const month = document.getElementById('birthdayMonth').value;
      const year = document.getElementById('birthdayYear').value;
      const submitBtn = document.getElementById('birthdaySubmitBtn');
      
      if (!day || !month || !year) return;
      
      const birthDate = `${year}/${month}/${day}`;
      
      submitBtn.disabled = true;
      const originalHTML = submitBtn.innerHTML;
      submitBtn.innerHTML = `
        <svg class="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"></path>
        </svg>
        <span>در حال ثبت...</span>
      `;
      
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('لطفاً ابتدا وارد شوید');
        }
        
        const res = await fetch('/api/user/birthday', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ birthDate })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.message || 'خطا در ثبت تاریخ تولد');
        }
        
        // بستن مودال با انیمیشن
        closeBirthdayModal();
        
        // آپدیت UI تاریخ تولد در پروفایل
        const birthdayValue = document.getElementById('birthdayValue');
        const birthdayCard = document.getElementById('birthdayCard');
        if (birthdayValue) {
          birthdayValue.textContent = birthDate;
          birthdayValue.classList.remove('placeholder-value');
        }
        if (birthdayCard) {
          birthdayCard.setAttribute('data-has-birthday', 'true');
        }
        
        // آپدیت موجودی کیف پول اگر جایزه داده شده
        if (data.rewardGiven) {
          const walletBalanceEl = document.querySelector('.wallet-balance-value');
          if (walletBalanceEl && data.formattedBalance) {
            walletBalanceEl.textContent = data.formattedBalance;
          }
          
          // نمایش toast موفقیت با جایزه
          showBirthdaySuccessToast('تاریخ تولد ثبت شد! ۵۰۰ تومان جایزه گرفتی 🎉');
        } else {
          // نمایش toast موفقیت بدون جایزه
          showBirthdaySuccessToast('تاریخ تولد به‌روزرسانی شد ✓');
        }
        
        // مخفی کردن badge جایزه برای دفعات بعدی
        const rewardBadge = document.getElementById('birthdayRewardBadge');
        if (rewardBadge && !data.rewardGiven) {
          rewardBadge.style.display = 'none';
        }
        
        // علامت‌گذاری ماموریت تولد به عنوان تکمیل شده
        markMissionCompleted('user-profile-complete');
        
      } catch (error) {
        console.error('Birthday submit error:', error);
        showBirthdaySuccessToast(error.message || 'خطا در ثبت تاریخ تولد ❌', true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
      }
    }

    // نمایش toast موفقیت تولد - Premium Version
    function showBirthdaySuccessToast(message, isError = false) {
      const toast = document.getElementById('birthdaySuccessToast');
      const text = document.getElementById('birthdaySuccessText');
      if (toast && text) {
        text.textContent = message;
        
        if (isError) {
          toast.style.background = 'linear-gradient(145deg, #ef4444, #dc2626)';
        } else {
          toast.style.background = 'linear-gradient(145deg, #10b981, #059669)';
        }
        
        toast.classList.add('show');
        setTimeout(() => {
          toast.classList.remove('show');
        }, 3500);
      }
    }

    // راه‌اندازی event listeners مودال تولد
    function initBirthdayModal() {
      initBirthdaySelects();
      
      // دکمه بستن
      const closeBtn = document.getElementById('birthdayModalClose');
      const dismissBtn = document.getElementById('birthdayModalDismiss');
      const overlay = document.getElementById('birthdayModalOverlay');
      const submitBtn = document.getElementById('birthdaySubmitBtn');
      
      if (closeBtn) closeBtn.addEventListener('click', closeBirthdayModal);
      if (dismissBtn) dismissBtn.addEventListener('click', closeBirthdayModal);
      
      // کلیک روی overlay
      if (overlay) {
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) closeBirthdayModal();
        });
      }
      
      // تغییر سلکت‌ها
      const daySelect = document.getElementById('birthdayDay');
      const monthSelect = document.getElementById('birthdayMonth');
      const yearSelect = document.getElementById('birthdayYear');
      
      if (daySelect) daySelect.addEventListener('change', checkBirthdayFormValid);
      if (monthSelect) monthSelect.addEventListener('change', checkBirthdayFormValid);
      if (yearSelect) yearSelect.addEventListener('change', checkBirthdayFormValid);
      
      // دکمه ثبت
      if (submitBtn) submitBtn.addEventListener('click', submitBirthday);
    }

    // راه‌اندازی در بارگذاری صفحه
    document.addEventListener('DOMContentLoaded', initBirthdayModal);

    // ═══════════════════════════════════════════════════════════════
    // سیستم ردیابی ماموریت گردشگر بازار
    // ═══════════════════════════════════════════════════════════════
    
    // دریافت پیشرفت ماموریت گردشگر از API
    async function fetchExploreProgressFromAPI() {
      try {
        const res = await fetch('/api/missions/browse-status', {
          credentials: 'include'
        });
        
        if (!res.ok) {
          // کاربر لاگین نیست - از localStorage استفاده کن
          return null;
        }
        
        const data = await res.json();
        if (data.success) {
          cachedExploreProgress = {
            count: data.progress || 0,
            required: data.required || 3,
            status: data.status,
            visitedShops: data.visitedStores?.map(v => v.storeId) || [],
            completed: data.status === 'completed' || data.status === 'claimed',
            rewarded: data.rewardPaid || false,
            isActive: data.isActive
          };
          return cachedExploreProgress;
        }
      } catch (e) {
        console.log('Could not fetch explore progress from API');
      }
      return null;
    }
    
    // دریافت پیشرفت ماموریت گردشگر (ترکیبی از API و localStorage)
    function getExploreProgress() {
      // اگر کش موجود است، برگردان
      if (cachedExploreProgress) {
        return cachedExploreProgress;
      }
      
      // fallback به localStorage
      try {
        const today = new Date().toISOString().split('T')[0];
        const stored = localStorage.getItem(EXPLORE_STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          // اگر تاریخ امروز نیست، ریست کن
          if (data.date !== today) {
            return { date: today, visitedShops: [], count: 0, completed: false, rewarded: false };
          }
          return data;
        }
      } catch (e) {
        console.error('Error reading explore progress:', e);
      }
      return { date: new Date().toISOString().split('T')[0], visitedShops: [], count: 0, completed: false, rewarded: false };
    }

    // ذخیره پیشرفت ماموریت گردشگر
    function saveExploreProgress(progress) {
      try {
        localStorage.setItem(EXPLORE_STORAGE_KEY, JSON.stringify(progress));
      } catch (e) {
        console.error('Error saving explore progress:', e);
      }
    }

    // ثبت بازدید از فروشگاه
    function trackShopVisit(shopId) {
      if (!shopId) return;
      
      const progress = getExploreProgress();
      
      // اگر قبلاً تکمیل شده و پاداش گرفته، کاری نکن
      if (progress.completed && progress.rewarded) return;
      
      // اگر این فروشگاه قبلاً بازدید شده، کاری نکن
      if (progress.visitedShops.includes(shopId)) return;
      
      // اضافه کردن فروشگاه به لیست بازدید شده‌ها
      progress.visitedShops.push(shopId);
      progress.count = progress.visitedShops.length;
      
      // نمایش toast پیشرفت
      showExploreProgressToast(progress.count);
      
      // بررسی تکمیل ماموریت
      if (progress.count >= EXPLORE_REQUIRED_VISITS && !progress.completed) {
        progress.completed = true;
        // نمایش پیام تکمیل با تاخیر
        setTimeout(() => {
          showExploreCompleteToast();
          // TODO: اینجا می‌تونید API call برای ثبت پاداش اضافه کنید
          progress.rewarded = true;
          saveExploreProgress(progress);
        }, 1500);
      }
      
      saveExploreProgress(progress);
    }

    // نمایش toast پیشرفت
    function showExploreProgressToast(count) {
      const toast = document.getElementById('exploreProgressToast');
      const text = document.getElementById('exploreProgressText');
      if (!toast || !text) return;
      
      const persianCount = count.toString().replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
      text.textContent = `فروشگاه بازدید شد! (${persianCount}/۳)`;
      toast.classList.remove('complete');
      toast.classList.add('show');
      
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }

    // نمایش toast تکمیل ماموریت
    function showExploreCompleteToast() {
      const toast = document.getElementById('exploreProgressToast');
      const text = document.getElementById('exploreProgressText');
      if (!toast || !text) return;
      
      text.textContent = '🎉 تبریک! ۵۰۰ تومان جایزه گرفتی!';
      toast.classList.add('complete', 'show');
      
      setTimeout(() => {
        toast.classList.remove('show', 'complete');
      }, 4000);
    }

    // تابع global برای استفاده در صفحات دیگر
    window.trackShopVisit = trackShopVisit;

    // هندل کردن SPA و رسپانسیو
    function showSection(section) {
      const mainContent = document.getElementById('mainContent');
      // پاک کردن فعال بودن منوها
      document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.classList.remove('tab-active', 'active');
      });
      // فعال کردن منوی فعلی
      document.querySelectorAll(`.menu-btn[data-section="${section}"]`).forEach(btn => {
        btn.classList.add('tab-active', 'active');
      });
      // محتوا
      if (section === 'dashboard') {
        mainContent.innerHTML = dashboardSection;
        setupQuickActions();
        renderRecentFavorites(); // اینجا رندر داینامیک رو صدا بزن
        updateDashboardFavCount(); // اینم اضافه کن تا تعداد علاقه‌مندی درست بشه
        initStreakAndWallet(); // بارگذاری استریک و کیف پول
        loadUserMissions(); // بارگذاری مجدد ماموریت‌ها
      }
      else if (section === 'profile') loadProfileSection();
      else if (section === 'favorites') loadFavoritesSection();
      else if (section === 'favshops') loadFavShopsSection();
      else if (section === 'bookings') loadBookingsSection();
      else if (section === 'messages') loadMessagesSection();

      if (section === 'messages') startMsgPolling(); else stopMsgPolling();

      // اسکرول به بالا
      mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }


    async function updateDashboardFavCount() {
      const favCountEl = document.getElementById('favCountDashboard');
      try {
        // درخواست با کوکی (credentials: 'include')
        const res = await fetch('/api/user/profile', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        if (!res.ok) {
          if (favCountEl) favCountEl.textContent = '-';
          return;
        }
        const user = await res.json();
        if (favCountEl) {
          favCountEl.textContent = Array.isArray(user.favorites) ? user.favorites.length : '0';
        }
      } catch (e) {
        if (favCountEl) favCountEl.textContent = '-';
      }
    }


    // منوهای دسکتاپ و موبایل

    /* ——— هندل منوهای سایدبار (مستقیم) ——— */
    document.addEventListener('click', e => {
      const btn = e.target.closest('.menu-btn');
      if (!btn) return;
      e.preventDefault();
      showSection(btn.dataset.section);
      if (window.innerWidth < 1024) closeSidebar();
    });




    // سوییچ کردن با دکمه پروفایل (Hero Avatar)
    const heroAvatarBtn = document.getElementById('heroAvatar');
    if (heroAvatarBtn) {
      heroAvatarBtn.onclick = function () {
        showSection('profile');
        // Don't open sidebar when clicking profile - just show profile section
      };
    }

    // همبرگر موبایل
    function openSidebar() {
      markNotificationsViewed();
      document.getElementById('mobileSidebar').classList.add('open');
      document.getElementById('sidebarOverlay').classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
      document.getElementById('mobileSidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('open');
      document.body.style.overflow = '';
    }
    const hamBtn = document.getElementById('hamBtn');
    if (hamBtn) {
      hamBtn.addEventListener('click', openSidebar);
    }
    document.getElementById('closeSidebar').onclick = closeSidebar;
    document.getElementById('sidebarOverlay').onclick = closeSidebar;
    document.addEventListener('keydown', function (e) {
      if (e.key === "Escape") {
        closeSidebar();
      }
    });





    // به‌روزرسانی اطلاعات کاربر در سایدبار (موبایل + دسکتاپ)
    async function updateSidebarUser() {
      try {
        const res = await fetch('/api/user/profile', {
          method: 'GET',
          credentials: 'include',          // ارسال توکن از طریق کوکی
          headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error();

        const user = await res.json();

        /* ↙️ آی‌دی کاربر را برای فیلتر چت‌ها نگه می‌داریم */
        window.currentUserId = user._id;

        const first = user.firstname || user.firstName || 'کاربر';
        const last = user.lastname || user.lastName || 'ویترینت';
        const phone = user.phone || user.mobile || '';
        profileState.isAuthenticated = true;
        profileState.user = {
          ...profileState.user,
          firstName: first,
          lastName: last,
          phone
        };
        applyProfileStateToUI();

        window.currentUserPhone = phone;
        refreshBookingsBadge();

        // Check if birthday is set and mark mission as completed
        const hasBirthday = user.birthDate || user.birthday || user.dateOfBirth;
        if (hasBirthday) {
          window.completedMissions.add('user-profile-complete');
        }

        // Check if browse products mission is completed today
        const browseMissionDone = localStorage.getItem('vitrinet_mission_market_done');
        const today = new Date().toDateString();
        if (browseMissionDone === today) {
          window.completedMissions.add('user-review');
        }
      } catch (_) {
        profileState.isAuthenticated = false;
        profileState.user = {
          firstName: '',
          lastName: '',
          city: '',
          phone: ''
        };
        applyProfileStateToUI();
      }
    }








    async function loadFavoritesSection() {
      let html = `<div class="glass px-6 py-7 fadein"><div class="text-center text-gray-400 py-12">در حال دریافت...</div></div>`;
      document.getElementById('mainContent').innerHTML = html;

      try {
        // درخواست با کوکی (credentials: 'include')
        const res = await fetch('/api/user/profile', {
          method: 'GET',
          credentials: 'include', // مهم!
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        if (!res.ok) throw new Error('دریافت پروفایل کاربر ناموفق بود!');
        const user = await res.json();
        const favs = user.favorites;

        if (!Array.isArray(favs) || favs.length === 0) {
          html = `<div class="glass px-6 py-7 fadein text-center text-gray-400">هیچ محصولی در علاقه‌مندی‌ها نیست.</div>`;
        } else {
          html = `
        <div class="glass px-6 py-7 fadein">
          <div class="text-xl font-black primary-text mb-5">علاقه‌مندی‌های من</div>
          <div class="flex flex-wrap gap-4">
            ${favs.map(p => {
            const shop = (p.sellerId && typeof p.sellerId === 'object') ? p.sellerId : {};
            return `
                <div class="min-w-[170px] max-w-xs bg-[#e0fdfa] rounded-xl p-3 flex flex-col items-center text-center">
                  <img src="${(p.images && p.images[0]) ? p.images[0] : '/assets/images/noimage.png'}" class="w-24 h-24 object-cover rounded-xl mb-2 shadow" alt="${p.title || ''}"/>
                  <span class="text-[#10b981] text-lg font-bold mb-1">${p.title || '-'}</span>
                  <span class="text-xs text-gray-500 mb-1">${shop.storename ? `فروشگاه ${shop.storename}` : ''}</span>
                  <span class="text-xs text-gray-600 mb-1">قیمت: ${p.price ? p.price.toLocaleString('fa-IR') + ' تومان' : '-'}</span>
                  <a href="http://localhost:5000/product.html?id=${p._id}" class="mt-2 px-4 py-1.5 rounded-lg brand-btn text-xs font-bold inline-block" target="_blank" rel="noopener noreferrer">مشاهده محصول</a>
                </div>
              `;
          }).join('')}
          </div>
        </div>
        `;
        }
      } catch (e) {
        html = `<div class="glass px-6 py-7 fadein text-center text-red-400">${e.message}</div>`;
      }

      document.getElementById('mainContent').innerHTML = html;
    }

    async function loadFavShopsSection() {
      let html = `<div class="glass px-6 py-7 fadein"><div class="text-center text-gray-400 py-12">در حال دریافت...</div></div>`;
      document.getElementById('mainContent').innerHTML = html;

      try {
        const res = await fetch('/api/favorite-shops', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) throw new Error('دریافت لیست ناموفق بود!');
        const shops = await res.json();

        // حذف مقادیر null/undefined برای جلوگیری از خطاهای دسترسی به خصوصیت
        const validShops = Array.isArray(shops) ? shops.filter(Boolean) : [];

        const resolveShopImage = (shop) => {
          const candidate = shop?.boardImage
            || shop?.coverImage
            || shop?.banner
            || (Array.isArray(shop?.images) ? shop.images[0] : shop?.image);
          const src = candidate || '/assets/images/shop-placeholder.svg';
          if (/^https?:/i.test(src) || src.startsWith('data:') || src.startsWith('//')) return src;
          if (src.startsWith('/')) return src;
          return `/${src.replace(/^\/+/, '')}`;
        };

        const buildShopLink = (shop) => {
          const slug = shop?.shopurl || shop?.shopUrl || shop?.slug;
          if (slug) return `/shop.html?shopurl=${encodeURIComponent(slug)}`;
          if (shop?._id) return `/shop.html?id=${encodeURIComponent(shop._id)}`;
          return '';
        };

        if (validShops.length === 0) {
          html = `<div class="glass px-6 py-7 fadein text-center text-gray-400">هیچ مغازه‌ای در لیست محبوب‌ها نیست.</div>`;
        } else {
          html = `
        <div class="glass px-6 py-7 fadein">
          <div class="text-xl font-black primary-text mb-5">مغازه‌های محبوب من</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            ${validShops.map(s => {
            const shop = s || {};
            const cover = resolveShopImage(shop);
            const linkUrl = buildShopLink(shop);
            const category = shop.category || shop.subcategory || 'دسته‌بندی ثبت نشده';
            return `
              <div class="relative overflow-hidden rounded-2xl bg-white border border-emerald-50 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl flex flex-col">
                <div class="relative h-32 w-full overflow-hidden">
                  <img src="${cover}" alt="${shop.storename || 'فروشگاه'}" class="w-full h-full object-cover" loading="lazy" onerror="this.src='/assets/images/shop-placeholder.svg'" />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-black/10"></div>
                  <span class="absolute top-3 left-3 bg-white/80 text-emerald-600 text-[11px] font-extrabold px-3 py-1 rounded-full shadow-sm">محبوب</span>
                </div>
                <div class="p-4 flex flex-col gap-2 text-right">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <span class="text-lg font-black text-slate-800">${shop.storename || '-'}</span>
                    <span class="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">${category}</span>
                  </div>
                  ${shop.city || shop.address ? `<p class="text-xs text-gray-500 flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-emerald-500"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"/></svg>${[shop.city, shop.address].filter(Boolean).join('، ')}</p>` : ''}
                  <div class="flex gap-2 pt-2">
                    ${linkUrl ? `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="flex-1 brand-btn rounded-xl px-4 py-2 text-sm font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow-lg"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14 3h7v7m0-7L10 14"/><path stroke-linecap="round" stroke-linejoin="round" d="M5 5h4m-4 4h2m5 10H5a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h5l4 4v12c0 1.1-.9 2-2 2Z"/></svg>ورود به صفحه مغازه</a>` : ''}
                    ${shop._id ? `<button data-id="${shop._id}" class="removeFavShop px-4 py-2 rounded-xl border border-red-100 bg-red-50 text-red-600 text-sm font-bold transition hover:bg-red-100">حذف</button>` : ''}
                  </div>
                </div>
              </div>
              `;
          }).join('')}
          </div>
        </div>`;
        }
      } catch (e) {
        html = `<div class="glass px-6 py-7 fadein text-center text-red-400">${e.message}</div>`;
      }

      document.getElementById('mainContent').innerHTML = html;

      document.querySelectorAll('.removeFavShop').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          btn.disabled = true;
          try {
            await fetch(`/api/favorite-shops/${id}`, { method: 'DELETE', credentials: 'include' });
            loadFavShopsSection();
          } catch { btn.disabled = false; }
        });
      });
    }




    /* ─────────  پیام‌های کاربر  ───────── */
    /* ───────── بخش پیام‌های حرفه‌ای کاربر ───────── */
    function getLastNotificationsViewedAt() {
      try {
        return Number(localStorage.getItem(LAST_NOTIF_KEY)) || 0;
      } catch (_) {
        return 0;
      }
    }

    function setLastNotificationsViewedNow() {
      try {
        localStorage.setItem(LAST_NOTIF_KEY, String(Date.now()));
      } catch (_) {
        /* ignore storage errors */
      }
    }

    async function loadMessagesSection() {
      const box = document.getElementById('mainContent');
      box.innerHTML = `
    <div id="messages-section" class="messages-section-v5 fadein">
      <!-- Header V6 - Large Bold Elegant Title -->
      <div class="msg-header-v5">
        <h1 class="msg-header-title-v5">پیام‌ها</h1>
        <button class="msg-search-btn-v5" aria-label="جستجو">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </button>
      </div>

      <!-- Filter Tabs V6 - Modern Pill Chips -->
      <div class="msg-filters-v5">
        <button class="msg-filter-v5 active" data-filter="all">همه</button>
        <button class="msg-filter-v5" data-filter="admin">پشتیبانی</button>
        <button class="msg-filter-v5" data-filter="seller">فروشندگان</button>
        <button class="msg-filter-v5" data-filter="product">محصولات</button>
      </div>

      <!-- Chat List V6 - Premium Surface -->
      <div class="msg-list-v5" id="userChatsList">
        <div class="msg-loading-v5">
          <div class="msg-spinner-v5"></div>
          <span>در حال بارگذاری...</span>
        </div>
      </div>
    </div>
  `;

      // Event: Tab clicks
      document.querySelectorAll('.msg-filter-v5').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.msg-filter-v5').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentMsgFilter = btn.dataset.filter;
          renderMessagesList();
        });
      });

      // Event: Filter pills (legacy support)
      document.querySelectorAll('.msg-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.msg-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentMsgFilter = btn.dataset.filter;
          renderMessagesList();
        });
      });

      // Get user ID if not set
      if (!window.currentUserId) {
        try {
          const res = await fetch('/api/user/profile', { credentials: 'include' });
          if (res.ok) {
            const user = await res.json();
            window.currentUserId = user._id;
          }
        } catch (e) {
          console.error('خطا در دریافت پروفایل:', e);
        }
      }

      await fetchBlockedSellers();
      await fetchUserChats();
      renderMessagesList();    // رندر کن
      startMsgPolling();       // polling شروع کن
    }

    /* گرفتن لیست چت‌ها */
    /*  دریافت لیست چت‌های *خودِ کاربر*  */
    /* گرفتن لیست چت‌ها (فقط لیست، بدون جزئیات پیام‌ها) */
    async function fetchUserChats() {
      try {
        const res = await fetch(`${API_BASE}/chats/my`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
          console.error('fetchUserChats: HTTP error', res.status);
          chatsList = [];
          return;
        }

        const data = await res.json();
        console.log('📨 چت‌های دریافتی از سرور:', data);

        // API /chats/my خودش فقط چت‌های کاربر لاگین شده رو برمی‌گردونه
        // پس نیازی به فیلتر اضافی نیست
        chatsList = Array.isArray(data) ? data : (data.chats || []);

        // مرتب‌سازی بر اساس آخرین به‌روزرسانی
        chatsList.sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));

        console.log('📋 لیست چت‌ها پس از مرتب‌سازی:', chatsList.length, 'چت');

      } catch (e) {
        console.error('fetchUserChats error:', e);
        chatsList = [];
      }
    }

    async function loadMessages() {
      try {
        await fetchUserChats();
        updateBadge();
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    }


    /* رندر لیست چت‌ها - V3 با Product Context و Action Icons */
    function renderMessagesList() {
      const box = document.getElementById('userChatsList');
      console.log("لیست چت‌ها:", chatsList);

      // فیلتر کردن چت‌ها بر اساس تب انتخابی
      let filteredChats = chatsList;
      
      // Add admin chat at top if filter is 'all' or 'admin'
      const showAdminChat = currentMsgFilter === 'all' || currentMsgFilter === 'admin';
      
      if (currentMsgFilter !== 'all') {
        filteredChats = chatsList.filter(c => {
          if (currentMsgFilter === 'admin') {
            return c.type === 'user-admin' || c.type === 'admin-user' || 
                   (c.participantsModel && c.participantsModel.includes('Admin'));
          }
          if (currentMsgFilter === 'seller') {
            return c.type === 'user-seller' || (c.participantsModel && c.participantsModel.includes('Seller') && !c.participantsModel.includes('Admin'));
          }
          if (currentMsgFilter === 'product') {
            return c.type === 'product' || c.productId;
          }
          return true;
        });
      }

      // Build admin pinned row HTML - VIP Premium Card Style
      const adminPinnedRow = showAdminChat ? `
        <div class="msg-row-v5 msg-row-admin" data-chat-id="admin-support" onclick="openAdminMsgModal()">
          <div class="msg-avatar-v5 admin">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span class="msg-verified-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
          </div>
          <div class="msg-body-v5">
            <div class="msg-row-top">
              <span class="msg-name-v5">پشتیبانی ویترینت</span>
            </div>
            <div class="msg-row-bottom">
              <span class="msg-preview-v5">سوالی دارید؟ با ما در ارتباط باشید</span>
            </div>
          </div>
          <div class="msg-chevron-v5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </div>
        </div>
      ` : '';

      if (!filteredChats.length && !showAdminChat) {
        box.innerHTML = `
      <div class="msg-empty-v5">
        <div class="msg-empty-icon-v5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h3>${currentMsgFilter === 'all' ? 'هنوز گفتگویی نداری' : 'گفتگویی یافت نشد'}</h3>
        <p>${currentMsgFilter === 'all' ? 'از صفحه محصولات به فروشندگان پیام بده' : 'تب دیگری را امتحان کنید'}</p>
      </div>
    `;
        return;
      }

      const myId = window.currentUserId;

      const chatRowsHtml = filteredChats.map(c => {
        let role = '';
        let sellerId = null;
        let storeName = '';
        let isBlocked = false;

        if (Array.isArray(c.participants)) {
          const participant = c.participants.find(p => p && p._id && p._id.toString() !== myId?.toString());
          if (participant) {
            const pIdx = c.participants.findIndex(pp => pp && pp._id && pp._id.toString() === participant._id.toString());
            const pModel = c.participantsModel?.[pIdx];
            role = participant.role || (pModel === 'Seller' ? 'seller' : (pModel === 'Admin' ? 'admin' : 'user'));
            sellerId = participant._id;
            storeName = participant.storename || '';
          }
        }

        if (role === 'seller' && sellerId) {
          const sellerIdStr = sellerId?.toString() || sellerId;
          isBlocked = blockedSellers.some(bs => (bs?.toString() || bs) === sellerIdStr);
        }

        if (!role && Array.isArray(c.participantsModel)) {
          if (c.participantsModel.includes('Admin')) role = 'admin';
          else if (c.participantsModel.includes('Seller')) role = 'seller';
        }

        if (!role && c.type) {
          if (c.type === 'user-seller' || c.type === 'product') {
            role = 'seller';
            sellerId = c.sellerId;
          } else if (c.type === 'user-admin' || c.type === 'admin-user') {
            role = 'admin';
          }
        }

        // Avatar - Colorful filled circles with gradients
        const avatarClass = role === 'admin' ? 'admin' : (role === 'seller' ? 'seller' : 'user');
        // Avatar colors based on chat index for variety
        const avatarColors = ['', 'data-color="blue"', 'data-color="purple"', 'data-color="orange"', 'data-color="pink"'];
        const colorAttr = role === 'seller' ? avatarColors[Math.floor(Math.random() * avatarColors.length)] : '';
        // Use person icon for all avatars (filled style)
        const avatarIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

        // Name
        const displayName = role === 'seller' ? (storeName || 'فروشنده') : (role === 'admin' ? 'پشتیبانی' : 'مخاطب');

        // Product Context (Blue text) - Line 2
        let productTag = '';
        if (c.productId && c.productId.title) {
          productTag = `<div class="msg-product-line"><span class="msg-product-tag-v5">محصول: ${c.productId.title}</span></div>`;
        }

        // Last message
        const last = c.messages?.[c.messages.length - 1] || {};
        const preview = (last.text || 'بدون پیام').slice(0, 45) + (last.text?.length > 45 ? '…' : '');
        const unread = (c.messages || []).filter(m => !m.read && m.from !== 'user').length;

        // Time
        const msgDate = last.date || last.createdAt || c.lastUpdated;
        const timeDisplay = msgDate ? getRelativeTime(new Date(msgDate)) : '';

        return `
      <div class="msg-row-v5 ${unread > 0 ? 'unread' : ''} ${isBlocked ? 'blocked' : ''}" data-chat-id="${c._id}" data-seller-id="${sellerId || ''}">
        <div class="msg-avatar-v5 ${avatarClass}" ${colorAttr}>
          ${avatarIcon}
        </div>
        <div class="msg-body-v5" data-chat-id="${c._id}">
          <div class="msg-row-top">
            <span class="msg-name-v5">${displayName}</span>
            <span class="msg-time-v5">${timeDisplay}</span>
          </div>
          ${productTag}
          <div class="msg-row-bottom">
            <span class="msg-preview-v5">${preview}</span>
            ${unread > 0 ? `<span class="msg-unread-v5">${unread > 9 ? '9+' : unread}</span>` : ''}
          </div>
        </div>
        <button class="msg-more-btn-v5" data-chat-id="${c._id}" data-seller-id="${sellerId || ''}" aria-label="گزینه‌ها">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
          </svg>
        </button>
      </div>
      <div class="msg-divider-v5"></div>
    `;
      }).join('');

      box.innerHTML = adminPinnedRow + chatRowsHtml;

      // Event listeners
      setTimeout(() => {
        // Click on body area to open chat
        document.querySelectorAll('.msg-body-v5').forEach(item => {
          item.addEventListener('click', () => {
            openChat(item.dataset.chatId);
          });
        });

        // More button - show action sheet
        document.querySelectorAll('.msg-more-btn-v5').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showChatActionSheet(btn.dataset.chatId, btn.dataset.sellerId);
          });
        });
      }, 50);
    }

    // Action sheet for chat options - Premium iOS Style
    function showChatActionSheet(chatId, sellerId) {
      // Remove existing action sheet
      document.getElementById('chatActionSheet')?.remove();
      
      const isBlocked = sellerId && blockedSellers.some(bs => (bs?.toString() || bs) === sellerId);
      
      document.body.insertAdjacentHTML('beforeend', `
        <div id="chatActionSheet" class="chat-action-sheet-overlay" onclick="closeChatActionSheet()">
          <div class="chat-action-sheet" onclick="event.stopPropagation()">
            <div class="chat-action-sheet-handle"></div>
            
            <div class="chat-action-sheet-header">
              <h3 class="chat-action-sheet-title">مدیریت گفتگو</h3>
              <p class="chat-action-sheet-subtitle">یک گزینه را انتخاب کنید</p>
            </div>
            
            <button class="chat-action-item delete" onclick="deleteChat('${chatId}'); closeChatActionSheet();">
              <div class="chat-action-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                  <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </div>
              <div class="chat-action-text">
                <span class="chat-action-label">حذف گفتگو</span>
                <span class="chat-action-desc">این گفتگو برای همیشه حذف می‌شود</span>
              </div>
            </button>
            
            ${sellerId ? `
            <button class="chat-action-item ${isBlocked ? 'unblock' : 'block'}" onclick="${isBlocked ? 'unblockSeller' : 'blockSeller'}('${sellerId}'); closeChatActionSheet();">
              <div class="chat-action-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  ${isBlocked ? 
                    '<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/>' :
                    '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>'
                  }
                </svg>
              </div>
              <div class="chat-action-text">
                <span class="chat-action-label">${isBlocked ? 'رفع مسدودی' : 'مسدود کردن'}</span>
                <span class="chat-action-desc">${isBlocked ? 'این فروشنده می‌تواند پیام بفرستد' : 'دیگر پیامی دریافت نمی‌کنید'}</span>
              </div>
            </button>
            ` : ''}
            
            <button class="chat-action-item cancel" onclick="closeChatActionSheet()">
              <span>انصراف</span>
            </button>
          </div>
        </div>
      `);
      
      // Animate in
      requestAnimationFrame(() => {
        document.getElementById('chatActionSheet')?.classList.add('active');
      });
    }

    function closeChatActionSheet() {
      const sheet = document.getElementById('chatActionSheet');
      if (sheet) {
        sheet.classList.remove('active');
        setTimeout(() => sheet.remove(), 200);
      }
    }

    // تابع کمکی برای نمایش زمان نسبی
    function getRelativeTime(date) {
      const now = new Date();
      const diffMs = now - date;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) return 'همین الان';
      if (diffMin < 60) return `${diffMin} دقیقه پیش`;
      if (diffHour < 24) return `${diffHour} ساعت پیش`;
      if (diffDay < 7) return `${diffDay} روز پیش`;

      return date.toLocaleDateString('fa-IR', { year: '2-digit', month: '2-digit', day: '2-digit' });
    }




    /* باز کردن مودال چت */
    /* باز کردن مودال چت (با دریافت جزئیات کامل) */
    async function openChat(cid) {
      // اگر چت مجازی ادمین است، مودال ادمین رو باز کن
      if (cid && cid.toString().startsWith('admin-user-')) {
        await openAdminMsgModal();
        return;
      }

      // بررسی اینکه آیا این چت از نوع admin-user است
      const chat = chatsList.find(c => c._id === cid || c._id?.toString() === cid);
      if (chat && (chat.isVirtualAdminChat || chat.type === 'admin-user' ||
        (chat.participantsModel && chat.participantsModel.includes('Admin')))) {
        await openAdminMsgModal();
        return;
      }

      currentCid = cid;
      await showChatModal();
    }

    /* ارسال پیام جدید به مدیر (ایجاد چت جدید اگر قبلا نداره) */
    // باز کردن مودال گفتگوی کاربر با مدیر (نسخه ساده)
    async function openAdminMsgModal() {
      const uid = window.currentUserId;
      if (!uid) return alert('شناسه کاربر پیدا نشد!');

      // مودال گفتگو با مدیر را با API اختصاصی مدیر/کاربر باز کن
      try {
        await showAdminMsgModal(uid);
      } catch (err) {
        alert('خطا در باز کردن گفتگو با مدیر: ' + (err?.message || err));
      }
    }

    function closeAdminMsg() {
      document.getElementById('adminMsgModal')?.remove();
    }

    async function showAdminMsgModal(uid) {
      document.getElementById('adminMsgModal')?.remove();
      document.body.insertAdjacentHTML('beforeend', `
      <div id="adminMsgModal" class="fixed inset-0 z-50 flex items-center justify-center" style="backdrop-filter:blur(4px);background:#0003;animation:fadein .25s">
        <div class="bg-white rounded-2xl w-[98vw] max-w-md max-h-[93vh] flex flex-col shadow-xl border">
          <div class="px-4 py-3 border-b flex justify-between items-center">
            <span class="font-bold primary-text">گفتگو با مدیر سایت</span>
            <button class="close-admin-msg text-2xl font-black text-gray-400 hover:text-red-500 rounded-full w-8 h-8 flex items-center justify-center">×</button>
          </div>
          <div id="adminMsgBody" class="flex-1 overflow-y-auto p-4 space-y-4 text-[15px] scrollbar-hide bg-[#f9fafb]"></div>
          <div class="border-t p-3 flex gap-2 bg-white">
            <textarea id="adminMsgInput" rows="2" class="flex-1 border rounded-xl p-2 resize-none focus:outline-none" placeholder="پیام خود را وارد کنید"></textarea>
            <button class="send-admin-msg brand-btn px-5 py-2 rounded-xl font-bold shrink-0">ارسال</button>
          </div>
        </div>
      </div>
    `);

      // Add event listeners for admin modal buttons
      const closeBtn = document.querySelector('.close-admin-msg');
      if (closeBtn) {
        closeBtn.addEventListener('click', closeAdminMsg);
      }

      const sendBtn = document.querySelector('.send-admin-msg');
      if (sendBtn) {
        sendBtn.addEventListener('click', sendAdminMsg);
      }

      // Also allow sending message with Enter key
      const msgInput = document.getElementById('adminMsgInput');
      if (msgInput) {
        msgInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAdminMsg();
          }
        });
      }

      renderAdminMsgs(uid);
    }

    async function renderAdminMsgs(uid) {
      const box = document.getElementById('adminMsgBody');
      if (!box) return;
      box.innerHTML = '<div class="text-center text-gray-400 py-6">در حال دریافت...</div>';
      try {
        const token = document.cookie.split('; ').find(r => r.startsWith('user_token='))?.split('=')[1];
        const res = await fetch(`${API_BASE}/messages/${uid}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: 'Bearer ' + token })
          }
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) throw new Error('دسترسی غیرمجاز');
          throw new Error('دریافت گفتگو ناموفق بود');
        }
        let data = await res.json();
        if (!Array.isArray(data)) data = [];
        data.sort((a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt));
        box.innerHTML = data.map(m => {
          const rawRole =
            m.senderRole ||
            m.senderId?.role ||
            (typeof m.senderModel === 'string' ? m.senderModel.toLowerCase() : '') ||
            (typeof m.from === 'string' ? m.from.toLowerCase() : '');
          const role = (rawRole || '').toLowerCase();
          const isMe = m.senderId?._id === window.currentUserId || role === 'user';
          const label = isMe ? 'شما' : role === 'admin' ? 'مدیر سایت' : role === 'seller' ? 'فروشنده' : 'مشتری';
          const cls = isMe ? 'bg-[#e0fdfa] self-end' : 'bg-[#f3f4f6]';
          const time = new Date(m.timestamp || m.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
          const align = isMe ? 'items-end' : 'items-start';
          const msgText = m.message || m.text || '';
          return `
          <div class="flex flex-col ${align}">
            <div class="${cls} rounded-xl px-3 py-2 max-w-[78%]">
              <span class="text-xs font-bold text-[#10b981]">${label}</span>
              <div>${msgText}</div>
              <div class="text-xs text-gray-400 mt-1 text-left">${time}</div>
            </div>
          </div>`;
        }).join('');
        box.scrollTop = box.scrollHeight;
      } catch (err) {
        box.innerHTML = '<div class="text-center text-red-500 py-6">امکان دریافت گفتگو وجود ندارد.</div>';
      }
    }

    async function sendAdminMsg() {
      const ta = document.getElementById('adminMsgInput');
      const text = ta.value.trim();
      if (!text) return;
      try {
        const token = document.cookie.split('; ').find(r => r.startsWith('user_token='))?.split('=')[1];
        const res = await fetch(`${API_BASE}/messages/send`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: 'Bearer ' + token })
          },
          body: JSON.stringify({ message: text })
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) throw new Error('دسترسی غیرمجاز');
          throw new Error('ارسال پیام ناموفق بود');
        }
        ta.value = '';
        renderAdminMsgs(window.currentUserId);
      } catch (err) {
        alert('خطا در ارسال پیام: ' + err.message);
      }
    }





    /* دریافت جزئیات کامل یک چت (شامل تمام پیام‌ها) */











    /* ساختار مودال چت */
    /* ساختار مودال چت */
    /* ساختار مودال چت */
    /* ساختار مودال چت */
    /* ساختار مودال چت */
    /* ساختار مودال چت */
    /* ساختار مودال چت */
    async function ensureShopUrl(sid, existing) {
      if (existing) return existing;
      if (!sid) return '';
      try {
        const res = await fetch(`${API_BASE}/shopAppearance/${sid}`);
        if (!res.ok) return '';
        const data = await res.json();
        return data.customUrl || '';
      } catch {
        return '';
      }
    }

    /* ساختار مودال چت - نسخه جدید با استایل حرفه‌ای */
    async function showChatModal() {
      console.log("در حال نمایش مودال چت...");

      // دریافت جزئیات کامل چت از سرور
      const chat = await fetchChatDetails(currentCid);
      if (!chat) {
        alert('دریافت گفتگو ناموفق بود!');
        return;
      }

      // پس از دریافت، پیام‌های طرف مقابل را خوانده‌شده علامت بزن
      chat.messages.forEach(m => {
        if (m.from !== 'user') m.read = true;
      });

      // بروزرسانی لیست محلی
      const idx = chatsList.findIndex(c => c._id === currentCid);
      if (idx !== -1) chatsList[idx] = chat;
      updateBadge();

      // استخراج طرف مقابل
      let whom = 'مخاطب';
      let role = '';
      let sellerId = null;
      let storeName = '';
      let shopUrl = '';

      if (Array.isArray(chat.participants)) {
        // مقایسه با toString برای اطمینان از تطابق صحیح
        const participant = chat.participants.find(p => p && p._id && p._id.toString() !== window.currentUserId?.toString());
        if (participant) {
          // اگر فروشنده باشه، role نداره پس از participantsModel استفاده میکنیم
          const pIdx = chat.participants.findIndex(pp => pp && pp._id && pp._id.toString() === participant._id.toString());
          const pModel = chat.participantsModel?.[pIdx];
          role = participant.role || (pModel === 'Seller' ? 'seller' : (pModel === 'Admin' ? 'admin' : 'user'));
          sellerId = participant._id;
          storeName = participant.storename || '';
          shopUrl = participant.shopurl || '';
          whom = role === 'seller' ? 'فروشنده' : (role === 'admin' ? 'مدیر سایت' : (role === 'user' ? 'مشتری' : 'مخاطب'));
        }
      }

      if (!role && Array.isArray(chat.participantsModel)) {
        if (chat.participantsModel.includes('Admin')) {
          role = 'admin';
          whom = 'مدیر سایت';
        } else if (chat.participantsModel.includes('Seller')) {
          role = 'seller';
          whom = 'فروشنده';
        }
      }

      // fallback از type
      if (!role && chat.type) {
        if (chat.type === 'user-seller' || chat.type === 'seller-admin' || chat.type === 'product') {
          whom = 'فروشنده';
          role = 'seller';
          sellerId = chat.sellerId;
        } else if (chat.type === 'user-admin' || chat.type === 'admin-user' || chat.type === 'admin') {
          whom = 'مدیر سایت';
          role = 'admin';
        }
      }

      // لینک فروشگاه
      let recipientLink = '';
      if (role === 'seller' && sellerId) {
        shopUrl = await ensureShopUrl(sellerId, shopUrl);
        if (shopUrl) {
          const linkUrl = `/shop.html?shopurl=${shopUrl}`;
          const linkText = storeName ? `مشاهده مغازه ${storeName}` : 'مشاهده مغازه';
          recipientLink = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="chat-modal-recipient-link">${linkText} ←</a>`;
        }
      }

      // محصول مرتبط
      let productBlock = '';
      if (chat.productId && chat.productId.title) {
        const productUrl = `/product.html?id=${chat.productId._id}`;
        productBlock = `
      <div class="chat-modal-product">
        <a href="${productUrl}" target="_blank" rel="noopener noreferrer">
          <img src="${chat.productId.images?.[0] || '/assets/images/noimage.png'}" 
               class="chat-product-img" alt="${chat.productId.title}">
        </a>
        <div class="chat-product-info">
          <div class="chat-product-title">${chat.productId.title}</div>
          <a href="${productUrl}" target="_blank" rel="noopener noreferrer" class="chat-product-link">
            مشاهده محصول
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      </div>
    `;
      }

      // مودال HTML با استایل جدید
      document.body.classList.add('hide-mobile-nav');
      document.body.insertAdjacentHTML('beforeend', `
    <div id="chatModal" class="chat-modal-overlay">
      <div class="chat-modal-card">
        <!-- هدر -->
        <div class="chat-modal-header">
          <div class="chat-modal-recipient">
            <span class="chat-modal-recipient-name">${storeName || whom}</span>
            ${recipientLink}
          </div>
          <button class="chat-modal-close close-chat-modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- محصول مرتبط -->
        ${productBlock}

        <!-- بدنه چت -->
        <div id="chatBody" class="chat-modal-body scrollbar-hide"></div>

        <!-- فرم ارسال -->
        <div class="chat-modal-footer">
          <textarea id="msgBox" class="chat-input" rows="1" placeholder="پیام خود را بنویسید..."></textarea>
          <button class="chat-send-btn send-msg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            ارسال
          </button>
        </div>
      </div>
    </div>
  `);

      // Event listeners
      document.querySelector('.close-chat-modal')?.addEventListener('click', closeChat);
      document.querySelector('.send-msg')?.addEventListener('click', sendMsg);

      const msgBox = document.getElementById('msgBox');
      if (msgBox) {
        msgBox.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMsg();
          }
        });
        // Auto-resize textarea
        msgBox.addEventListener('input', () => {
          msgBox.style.height = 'auto';
          msgBox.style.height = Math.min(msgBox.scrollHeight, 100) + 'px';
        });
      }

      renderChat();
      setTimeout(() => msgBox?.focus(), 120);
    }
    // بستن مودال چت
    function closeChat() {
      document.getElementById('chatModal')?.remove();
      document.body.classList.remove('hide-mobile-nav');
      currentCid = null;
    }

    async function fetchBlockedSellers() {
      try {
        const res = await fetch(`${API_BASE}/blocked-sellers`, { credentials: 'include' });
        const data = await res.json();
        blockedSellers = Array.isArray(data) ? data : [];
      } catch (e) {
        blockedSellers = [];
      }
    }

    async function blockSeller(sid) {
      if (!confirm('آیا مطمئن هستید که می‌خواهید این فروشنده را مسدود کنید؟')) return;
      try {
        const res = await fetch(`${API_BASE}/blocked-sellers/${sid}`, {
          method: 'POST',
          credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'خطا در مسدودسازی');
        if (!blockedSellers.includes(sid)) blockedSellers.push(sid);
        renderMessagesList();
      } catch (err) {
        alert('خطا در مسدودسازی: ' + err.message);
      }
    }

    /* رندر مکالمه داخل مودال - نسخه جدید */
    function renderChat() {
      const chat = chatsList.find(c => c._id === currentCid);
      const target = document.getElementById('chatBody');
      if (!target) return;

      function getSenderRoleText(msg, isMe) {
        if (isMe) return 'شما';
        const raw =
          msg.senderRole ||
          msg?.sender?.role ||
          msg?.senderId?.role ||
          (typeof msg.senderModel === 'string' ? msg.senderModel.toLowerCase() : '') ||
          (typeof msg.from === 'string' ? msg.from.toLowerCase() : '');
        const role = (raw || '').toLowerCase();
        if (role === 'admin') return 'مدیر سایت';
        if (role === 'seller') return 'فروشنده';
        if (role === 'user') return 'مشتری';
        return 'مخاطب';
      }

      if (!chat.messages || chat.messages.length === 0) {
        target.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center py-8">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" class="mb-3">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p class="text-gray-400 text-sm">هنوز پیامی ارسال نشده</p>
        <p class="text-gray-300 text-xs mt-1">اولین پیام را ارسال کنید!</p>
      </div>
    `;
        return;
      }

      target.innerHTML = (chat.messages || []).map(m => {
        const roleHint = (m.senderRole || m?.senderId?.role || '').toLowerCase();
        const isMe =
          m.senderId?._id === window.currentUserId ||
          m.senderId === window.currentUserId ||
          roleHint === 'user' ||
          m.from === 'user' ||
          m.from === window.currentUserId;

        const msgTime = new Date(m.date || m.createdAt);
        const timeStr = msgTime.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

        return `
      <div class="chat-message ${isMe ? 'sent' : 'received'}">
        <span class="chat-message-sender">${getSenderRoleText(m, isMe)}</span>
        <div class="chat-message-bubble">${m.text || ''}</div>
        <span class="chat-message-time">${timeStr}</span>
      </div>
    `;
      }).join('');

      target.scrollTop = target.scrollHeight;
    }



    /* ارسال پیام */
    /**
     * ارسال پیام از طرف کاربر
     */
    async function sendMsg() {
      const ta = document.getElementById('msgBox');
      const text = ta.value.trim();
      if (!text) {
        alert('لطفاً متن پیام را وارد کنید');
        return;
      }

      // توکنِ کاربر (مشتری) را از کوکی خارج می‌کنیم
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('user_token='))
        ?.split('=')[1];

      try {
        // به مسیر مخصوص reply کاربر بفرستیم
        const res = await fetch(`${API_BASE}/chats/${currentCid}/user-reply`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: 'Bearer ' + token })
          },
          body: JSON.stringify({ text })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'خطا در ارسال پیام');

        // پس از موفقیت، textarea را پاک و لیست چت را به‌روز می‌کنیم
        ta.value = '';
        chatsList = chatsList.map(c => c._id === currentCid ? data : c);
        renderChat();
        updateBadge();

      } catch (err) {
        console.error('❌ sendMsg error:', err);
        alert('❌ خطا در ارسال پیام:\n' + err.message);
      }
    }





    async function deleteChat(cid) {
      if (!confirm('آیا از حذف این چت مطمئن هستید؟')) return;

      try {
        const res = await fetch(`${API_BASE}/chats/${cid}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'حذف چت ناموفق بود!');
        // حذف چت از لیست و رفرش
        chatsList = chatsList.filter(c => c._id !== cid);
        renderMessagesList();
        updateBadge();
        closeChat();
      } catch (err) {
        alert('خطا در حذف چت: ' + err.message);
      }
    }




    /* badge پیام‌های خوانده نشده */
    function getMessageTimestamp(message) {
      if (!message) return 0;
      const stamp = message.createdAt || message.sentAt || message.timestamp;
      if (stamp) {
        const date = new Date(stamp);
        const time = date.getTime();
        if (!Number.isNaN(time)) return time;
      }
      if (typeof message._id === 'string' && message._id.length >= 8) {
        const hex = message._id.slice(0, 8);
        const parsed = parseInt(hex, 16);
        if (!Number.isNaN(parsed)) return parsed * 1000;
      }
      return 0;
    }

    function updateBadge() {
      const lastViewed = getLastNotificationsViewedAt();
      const total = chatsList.reduce((count, chat) => {
        const messages = Array.isArray(chat.messages) ? chat.messages : [];
        const unread = messages.filter(m => {
          if (!m || m.from === 'user' || m.read) return false;
          const ts = getMessageTimestamp(m);
          if (ts === 0) return lastViewed === 0;
          return ts > lastViewed;
        });
        return count + unread.length;
      }, 0);

      const msgBadge = document.getElementById('msgBadge');
      if (msgBadge) {
        msgBadge.textContent = total > 0 ? total : '';
      }

      const hamBadge = document.getElementById('hamBadge');
      if (hamBadge) {
        if (total > 0) {
          hamBadge.textContent = total;
          hamBadge.classList.remove('hidden');
        } else {
          hamBadge.textContent = '';
          hamBadge.classList.add('hidden');
        }
      }
    }

    function markNotificationsViewed() {
      setLastNotificationsViewedNow();
      const msgBadge = document.getElementById('msgBadge');
      if (msgBadge) {
        msgBadge.textContent = '';
      }
      const hamBadge = document.getElementById('hamBadge');
      if (hamBadge) {
        hamBadge.textContent = '';
        hamBadge.classList.add('hidden');
      }
    }


    /* بروزرسانی خودکار لیست و چت */
    /* بروزرسانی خودکار لیست و چت */
    function startMsgPolling() {
      if (pollHandle) clearInterval(pollHandle);
      pollHandle = setInterval(async () => {
        await fetchUserChats();
        updateBadge();
        if (currentCid) {
          // اگر مودال باز است، جزئیات چت را دوباره fetch و رندر کن
          const chat = await fetchChatDetails(currentCid);
          if (chat) {
            const idx = chatsList.findIndex(c => c._id === currentCid);
            if (idx !== -1) chatsList[idx] = chat;
            renderChat();
          }
        } else {
          renderMessagesList();
        }
      }, 10000);
    }
    function stopMsgPolling() { if (pollHandle) { clearInterval(pollHandle); pollHandle = null; } }
    /* ───────── پایان پیام‌های حرفه‌ای ───────── */








    /* دریافت جزئیات کامل یک چت (شامل تمام پیام‌ها) */
    /* دریافت جزئیات کامل یک چت (شامل تمام پیام‌ها) */
    async function fetchChatDetails(cid) {
      const token = document.cookie.split('; ').find(row => row.startsWith('user_token='))?.split('=')[1];
      try {
        const res = await fetch(`${API_BASE}/chats/${cid}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: 'Bearer ' + token })
          }
        });
        if (!res.ok) throw new Error('دریافت جزئیات چت ناموفق بود');
        const data = await res.json();
        return data;  // چت کامل با messages
      } catch (e) {
        console.error('❌ fetchChatDetails error:', e);
        return null;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // Dynamic Missions Loading from Admin Settings
    // ═══════════════════════════════════════════════════════════════
    
    // Mission card configurations with icons and styles
    const missionCardConfigs = {
      'user-where-is': {
        htmlId: 'missionWhereIs',
        style: 'where-is',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="16" r="1" fill="currentColor"/><path d="M12 14V8"/><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/></svg>`,
        title: 'اینجا کجاست؟',
        subtitle: 'حدس بزن و جایزه بگیر...',
        fomoBadge: 'فقط تا امشب ⏱️',
        rewardText: 'جایزه پاسخ درست',
        onclick: 'showWhereIsMission()',
        order: 0
      },
      'user-referral': {
        htmlId: 'missionInvite',
        style: 'invite',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`,
        title: 'دعوت از دوستان',
        onclick: 'showReferralSection()',
        order: 1
      },
      'user-app-install': {
        htmlId: 'missionInstallApp',
        style: 'install-app',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><path d="M12 18h.01"/><path d="M12 6v6"/><path d="M9 9l3 3 3-3"/></svg>`,
        title: 'نصب اپلیکیشن',
        onclick: 'showInstallAppMission()',
        order: 2
      },
      'user-profile-complete': {
        htmlId: 'missionProfile',
        style: 'profile',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M12 8v13"/><path d="M3 13h18"/><circle cx="12" cy="4" r="1" fill="currentColor" stroke="none"/></svg>`,
        title: 'ثبت تاریخ تولد',
        onclick: 'showProfileSection()',
        order: 3
      },
      'user-book-appointment': {
        htmlId: 'missionBooking',
        style: 'booking',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/></svg>`,
        title: 'رزرو نوبت',
        onclick: 'showBookAppointmentMission()',
        order: 4
      },
      'user-review': {
        htmlId: 'missionExplore',
        style: 'explore',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
        title: 'پاساژگردی آنلاین',
        onclick: 'showExploreMission()',
        order: 5
      }
    };

    // Generate skeleton cards HTML
    function generateSkeletonCards(count = Object.keys(missionCardConfigs).length) {
      let html = '';
      for (let i = 0; i < count; i++) {
        html += `
          <div class="mission-card-skeleton">
            <div class="skeleton-reward"></div>
            <div class="skeleton-title"></div>
          </div>
        `;
      }
      return html;
    }

    // Generate mission card HTML
    function generateMissionCardHTML(missionId, config, mission, isCompleted = false) {
      const amountValue = typeof config.fixedAmount === 'number'
        ? config.fixedAmount
        : (mission && typeof mission.amount === 'number' ? mission.amount : 0);
      const formattedAmount = new Intl.NumberFormat('fa-IR').format(amountValue);
      
      // These missions should ALWAYS be active unless explicitly completed
      const alwaysActiveMissions = ['user-book-appointment', 'user-review', 'user-referral', 'user-app-install', 'user-profile-complete', 'user-where-is'];
      const isActive = alwaysActiveMissions.includes(missionId) ? true : (mission ? mission.isActive : true);
      
      let cardClasses = `mission-card ${config.style}`;
      if (isCompleted) cardClasses += ' completed';
      // Only add disabled class if NOT in alwaysActiveMissions and not active
      if (!isActive && !isCompleted && !alwaysActiveMissions.includes(missionId)) cardClasses += ' disabled';
      
      // اگر ماموریت تکمیل شده، مودال "انجام شده" نشون بده، در غیر این صورت مودال عادی
      let clickHandler = '';
      if (isCompleted) {
        clickHandler = `onclick="showCompletedMissionModal('${missionId}')"`;
      } else if (isActive) {
        clickHandler = `onclick="${config.onclick}"`;
      }
      
      // Completed badge HTML
      const completedBadge = isCompleted ? `
        <span class="mission-completed-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
      ` : '';
      
      // Special badge for install-app
      const specialBadge = config.badge ? `<span class="mission-special-badge">${config.badge}</span>` : '';
      const fomoBadge = config.fomoBadge ? `<span class="mission-fomo-badge">${config.fomoBadge}</span>` : '';
      
      // Icon HTML (handle emoji vs SVG)
      const iconHtml = config.icon.startsWith('<svg') 
        ? `<span class="mission-reward-icon">${config.icon}</span>`
        : `<span class="mission-reward-icon">${config.icon}</span>`;
      const subtitleHtml = config.subtitle ? `<p class="mission-subtitle">${config.subtitle}</p>` : '';
      const rewardText = config.rewardText || `${formattedAmount} تومان`;

      // Simplified Where-Is card matching other mission cards
      if (missionId === 'user-where-is') {
        const whereIsCardSubtitle = isCompleted ? 'انجام شد' : 'حدس بزن و جایزه بگیر...';
        return `
          <div class="${cardClasses}" id="${config.htmlId}" ${clickHandler} data-mission-id="${missionId}" data-order="${config.order}">
            ${completedBadge}
            <div class="mission-reward">
              <span class="mission-reward-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="16" r="1" fill="currentColor"/>
                  <path d="M12 14V8"/>
                  <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/>
                </svg>
              </span>
              ${rewardText}
            </div>
            <p class="mission-title">اینجا کجاست؟</p>
            <p class="mission-subtitle">${whereIsCardSubtitle}</p>
            <div class="mission-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
        `;
      }
      
      return `
        <div class="${cardClasses}" id="${config.htmlId}" ${clickHandler} data-mission-id="${missionId}" data-order="${config.order}">
          ${completedBadge}
          ${specialBadge}
          ${fomoBadge}
          <div class="mission-reward">
            ${iconHtml}
            ${rewardText}
          </div>
          <p class="mission-title">${config.title}</p>
          ${subtitleHtml}
          <div class="mission-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      `;
    }

    // Track completed missions (will be populated from user data)
    // Load missions from API and render ALL cards
    async function loadUserMissions() {
      const missionsScroll = document.querySelector('.missions-scroll');
      if (!missionsScroll) return;
      const missionCardCount = Object.keys(missionCardConfigs).length;
      let whereIsState = null;

      // Show skeleton loading immediately
      missionsScroll.innerHTML = generateSkeletonCards(missionCardCount);

      try {
        whereIsState = await fetchWhereIsQuiz();
        if (missionCardConfigs['user-where-is']) {
          missionCardConfigs['user-where-is'].subtitle = 'حدس بزن و جایزه بگیر...';
        }

        const res = await fetch('/api/missions/users', {
          credentials: 'include'
        });

        if (!res.ok) {
          console.warn('Failed to load missions from API');
          renderFallbackMissions(missionsScroll, whereIsState);
          return;
        }

        const data = await res.json();
        if (!data.success || !Array.isArray(data.data)) {
          renderFallbackMissions(missionsScroll, whereIsState);
          return;
        }

        // Create mission map from API data
        const missionMap = {};
        data.data.forEach(m => {
          missionMap[m.missionId] = m;
        });

        // Build cards array with proper ordering
        const cards = [];
        
        Object.entries(missionCardConfigs).forEach(([missionId, config]) => {
          // Default to active for user missions if not found in API
          const mission = missionMap[missionId] || { amount: 0, isActive: true };
          const isCompleted = window.completedMissions.has(missionId);
          const resolvedMission = missionId === 'user-where-is'
            ? { ...mission, isActive: true }
            : mission;
          
          cards.push({
            missionId,
            config,
            mission: resolvedMission,
            isCompleted,
            order: isCompleted ? 100 + config.order : config.order
          });
        });

        // Sort: active first (by order), then completed (by order)
        cards.sort((a, b) => a.order - b.order);

        // Render all cards
        missionsScroll.innerHTML = cards.map(c => 
          generateMissionCardHTML(c.missionId, c.config, c.mission, c.isCompleted)
        ).join('');

        console.log(`✅ User missions loaded - all ${missionCardCount} cards rendered`);
      } catch (err) {
        console.warn('Error loading user missions:', err);
        renderFallbackMissions(missionsScroll, whereIsState);
      }
    }

    // Fallback rendering with static data
    function renderFallbackMissions(container, whereIsState = null) {
      if (missionCardConfigs['user-where-is']) {
        missionCardConfigs['user-where-is'].subtitle = missionData?.whereIs?.subtitle || 'حدس بزن و اعتبار بگیر';
      }

      const cards = Object.entries(missionCardConfigs)
        .sort((a, b) => a[1].order - b[1].order)
        .map(([missionId, config]) => {
          const isCompleted = window.completedMissions.has(missionId);
          const mission = missionId === 'user-where-is'
            ? { amount: 0, isActive: true }
            : { amount: 0, isActive: true };
          return generateMissionCardHTML(missionId, config, mission, isCompleted);
        });
      
      container.innerHTML = cards.join('');
    }

    // Mark a mission as completed (call this when user completes a mission)
    function markMissionCompleted(missionId) {
      window.completedMissions.add(missionId);
      const card = document.querySelector(`[data-mission-id="${missionId}"]`);
      if (card) {
        card.classList.add('completed');
        card.removeAttribute('onclick');
        card.style.order = '100';
        
        // Add completed badge if not exists
        if (!card.querySelector('.mission-completed-badge')) {
          const badge = document.createElement('span');
          badge.className = 'mission-completed-badge';
          badge.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
          card.insertBefore(badge, card.firstChild);
        }
      }
    }

    // Initialize horizontal scroll touch handling for missions - Ultra Smooth Version
    function initMissionsScrollTouch() {
      const scrollContainer = document.querySelector('.missions-scroll');
      if (!scrollContainer) return;

      let isDown = false;
      let startX;
      let scrollLeft;
      let velocity = 0;
      let lastX = 0;
      let lastTime = Date.now();
      let momentumID;
      let rafID;

      // Create scroll wrapper for fade indicators
      const wrapper = scrollContainer.parentElement;
      if (wrapper && !wrapper.classList.contains('missions-scroll-wrapper')) {
        const newWrapper = document.createElement('div');
        newWrapper.className = 'missions-scroll-wrapper';
        scrollContainer.parentNode.insertBefore(newWrapper, scrollContainer);
        newWrapper.appendChild(scrollContainer);
      }

      // Create progress indicator
      const progressContainer = document.createElement('div');
      progressContainer.className = 'missions-scroll-progress';
      const progressBar = document.createElement('div');
      progressBar.className = 'missions-scroll-progress-bar';
      progressContainer.appendChild(progressBar);
      
      const missionsSection = scrollContainer.closest('.missions-section');
      if (missionsSection) {
        missionsSection.appendChild(progressContainer);
      }

      // Smooth update scroll indicators and progress using RAF
      function updateScrollIndicators() {
        if (rafID) cancelAnimationFrame(rafID);
        
        rafID = requestAnimationFrame(() => {
          const scrollWrapper = scrollContainer.closest('.missions-scroll-wrapper');
          if (!scrollWrapper) return;

          const currentScrollLeft = scrollContainer.scrollLeft;
          const scrollWidth = scrollContainer.scrollWidth;
          const clientWidth = scrollContainer.clientWidth;
          const maxScroll = scrollWidth - clientWidth;

          // Update fade indicators
          if (currentScrollLeft <= 5) {
            scrollWrapper.classList.remove('scrolled-middle', 'scrolled-end');
            scrollWrapper.classList.add('scrolled-start');
          } else if (currentScrollLeft >= maxScroll - 5) {
            scrollWrapper.classList.remove('scrolled-start', 'scrolled-middle');
            scrollWrapper.classList.add('scrolled-end');
          } else {
            scrollWrapper.classList.remove('scrolled-start', 'scrolled-end');
            scrollWrapper.classList.add('scrolled-middle');
          }

          // Update progress bar with smooth transition
          const progress = maxScroll > 0 ? (currentScrollLeft / maxScroll) * 100 : 0;
          progressBar.style.width = `${progress}%`;
        });
      }

      // Ultra smooth momentum scrolling with easing
      function beginMomentumTracking() {
        cancelMomentumTracking();
        momentumID = requestAnimationFrame(momentumLoop);
      }

      function cancelMomentumTracking() {
        if (momentumID) {
          cancelAnimationFrame(momentumID);
          momentumID = null;
        }
      }

      function momentumLoop() {
        // Apply friction with smooth easing
        if (Math.abs(velocity) > 0.3) {
          scrollContainer.scrollLeft += velocity;
          velocity *= 0.92; // Smoother friction coefficient
          momentumID = requestAnimationFrame(momentumLoop);
        } else {
          velocity = 0;
        }
      }

      // Touch events for mobile - Ultra Smooth
      scrollContainer.addEventListener('touchstart', (e) => {
        cancelMomentumTracking();
        lastX = e.touches[0].pageX;
        lastTime = performance.now(); // More precise timing
        velocity = 0;
      }, { passive: true });

      scrollContainer.addEventListener('touchmove', (e) => {
        const currentX = e.touches[0].pageX;
        const currentTime = performance.now();
        const timeDiff = currentTime - lastTime;
        
        if (timeDiff > 0) {
          // Calculate velocity with smoothing
          const newVelocity = (lastX - currentX) / timeDiff * 12;
          velocity = velocity * 0.3 + newVelocity * 0.7; // Smooth velocity
        }
        
        lastX = currentX;
        lastTime = currentTime;
      }, { passive: true });

      scrollContainer.addEventListener('touchend', () => {
        // Only apply momentum if velocity is significant
        if (Math.abs(velocity) > 0.5) {
          beginMomentumTracking();
        }
      }, { passive: true });

      // Mouse drag support for desktop - Ultra Smooth
      scrollContainer.addEventListener('mousedown', (e) => {
        isDown = true;
        scrollContainer.style.cursor = 'grabbing';
        scrollContainer.style.userSelect = 'none';
        startX = e.pageX - scrollContainer.offsetLeft;
        scrollLeft = scrollContainer.scrollLeft;
        cancelMomentumTracking();
        lastX = e.pageX;
        lastTime = performance.now();
        velocity = 0;
      });

      scrollContainer.addEventListener('mouseleave', () => {
        if (isDown) {
          isDown = false;
          scrollContainer.style.cursor = 'grab';
          scrollContainer.style.userSelect = '';
          if (Math.abs(velocity) > 0.5) {
            beginMomentumTracking();
          }
        }
      });

      scrollContainer.addEventListener('mouseup', () => {
        if (isDown) {
          isDown = false;
          scrollContainer.style.cursor = 'grab';
          scrollContainer.style.userSelect = '';
          if (Math.abs(velocity) > 0.5) {
            beginMomentumTracking();
          }
        }
      });

      scrollContainer.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        
        const currentX = e.pageX;
        const currentTime = performance.now();
        const timeDiff = currentTime - lastTime;
        
        const x = e.pageX - scrollContainer.offsetLeft;
        const walk = (x - startX) * 1.2; // Slightly reduced multiplier for smoother feel
        scrollContainer.scrollLeft = scrollLeft - walk;
        
        if (timeDiff > 0) {
          const newVelocity = (lastX - currentX) / timeDiff * 12;
          velocity = velocity * 0.3 + newVelocity * 0.7;
        }
        
        lastX = currentX;
        lastTime = currentTime;
      });

      // Update indicators on scroll with throttling
      let scrollTimeout;
      scrollContainer.addEventListener('scroll', () => {
        if (!scrollTimeout) {
          scrollTimeout = setTimeout(() => {
            updateScrollIndicators();
            scrollTimeout = null;
          }, 16); // ~60fps
        }
      }, { passive: true });

      // Initial update
      setTimeout(() => {
        updateScrollIndicators();
      }, 100);

      // Set initial cursor
      scrollContainer.style.cursor = 'grab';
    }

    // Call after DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
      // Initialize touch scroll after a short delay to ensure DOM is ready
      setTimeout(initMissionsScrollTouch, 500);
    });

    // Store mission amounts for use in modals
    window.missionAmounts = {};

    // Update missionData with dynamic amounts
    async function updateMissionDataAmounts() {
      try {
        const res = await fetch('/api/missions/users', {
          credentials: 'include'
        });

        if (!res.ok) return;

        const data = await res.json();
        if (!data.success || !Array.isArray(data.data)) return;

        data.data.forEach(mission => {
          const formattedAmount = new Intl.NumberFormat('fa-IR').format(mission.amount);
          window.missionAmounts[mission.missionId] = {
            amount: mission.amount,
            formatted: `${formattedAmount} تومان`,
            isActive: mission.isActive
          };
        });
      } catch (err) {
        console.warn('Error updating mission amounts:', err);
      }
    }

    document.addEventListener('DOMContentLoaded', async () => {
      try {
        showSection('dashboard');
        // اول اطلاعات کاربر رو بگیر تا currentUserId تنظیم بشه
        await updateSidebarUser();
        // بعد پیام‌ها و رزروها رو لود کن
        await loadMessages();
        await loadBookings();
        // Load dynamic missions from admin settings
        await loadUserMissions();
        await updateMissionDataAmounts();
      } catch (error) {
        console.error('Initialization error:', error);
      }

      // Hero Info Row - Update date dynamically
      updateHeroInfoRow();
    });

    // Update Hero Info Row with current Persian date
    function updateHeroInfoRow() {
      const heroDateText = document.getElementById('heroDateText');
      if (heroDateText) {
        try {
          const now = new Date();
          const persianDate = now.toLocaleDateString('fa-IR', {
            day: 'numeric',
            month: 'long'
          });
          heroDateText.textContent = persianDate;
        } catch (e) {
          // Fallback if Persian locale not supported
          heroDateText.textContent = '۲۷ آذر';
        }
      }
    }









    // --- داشبورد: کلیک باکس علاقه‌مندی و علاقه‌مندی‌های اخیر ---

    // ============= Notification System =============
    // Toggle Notification Panel
    if (notificationBtn) {
      notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNotificationPanel();
      });
    }

    if (closeNotificationPanel) {
      closeNotificationPanel.addEventListener('click', (e) => {
        e.stopPropagation();
        hideNotificationPanel();
      });
    }

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (notificationPanel && !notificationPanel.contains(e.target) &&
        !notificationBtn.contains(e.target)) {
        hideNotificationPanel();
      }
    });

    function toggleNotificationPanel() {
      if (notificationPanel.classList.contains('active')) {
        hideNotificationPanel();
      } else {
        showNotificationPanel();
      }
    }

    function showNotificationPanel() {
      notificationPanel.classList.add('active');
      loadNotifications();
    }

    function hideNotificationPanel() {
      notificationPanel.classList.remove('active');
    }

    // Fetch notifications from API
    async function loadNotifications() {
      const token = document.cookie.split('; ').find(row => row.startsWith('user_token='))?.split('=')[1];

      try {
        notificationList.innerHTML = `
        <div class="notification-loading">
          <div class="loading-spinner"></div>
          <p>در حال بارگذاری اعلان‌ها...</p>
        </div>
      `;

        const response = await fetch(`${API_BASE}/notifications`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: 'Bearer ' + token })
          }
        });

        // Gracefully handle unauthorized users so we don't spam the console
        if (response.status === 401) {
          notificationsData = [];
          notificationList.innerHTML = `
          <div class="notification-empty">
            <svg class="notification-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <p class="notification-empty-text">برای مشاهده اعلان‌ها ابتدا وارد شوید</p>
          </div>
        `;
          updateBadgeCount();
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch notifications');
        }

        notificationsData = await response.json();
        displayNotifications();
        updateBadgeCount();
      } catch (error) {
        console.error('Error loading notifications:', error);
        notificationList.innerHTML = `
        <div class="notification-empty">
          <svg class="notification-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <p class="notification-empty-text">خطا در بارگذاری اعلان‌ها</p>
        </div>
      `;
      }
    }

    // Display notifications in the panel
    function displayNotifications() {
      if (!notificationsData || notificationsData.length === 0) {
        notificationList.innerHTML = `
        <div class="notification-empty">
          <svg class="notification-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <p class="notification-empty-text">اعلانی وجود ندارد</p>
        </div>
      `;
        return;
      }

      const notificationsHTML = notificationsData.map(notification => {
        const timeAgo = getTimeAgo(new Date(notification.createdAt));
        const unreadClass = !notification.read ? 'unread' : '';

        return `
        <div class="notification-item ${unreadClass}" data-id="${notification._id}">
          <div class="notification-content">
            <div class="notification-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div class="notification-body">
              <p class="notification-message">${notification.message}</p>
              <div class="notification-time">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>${timeAgo}</span>
              </div>
              <div class="notification-actions">
                ${!notification.read ? `
                  <button class="notification-action-btn notification-mark-read-btn" onclick="markNotificationAsRead('${notification._id}')">
                    خوانده شد
                  </button>
                ` : ''}
                <button class="notification-action-btn notification-delete-btn" onclick="deleteNotification('${notification._id}')">
                  حذف
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      }).join('');

      notificationList.innerHTML = notificationsHTML;
    }

    // Update badge count
    function updateBadgeCount() {
      unreadCount = notificationsData.filter(n => !n.read).length;

      if (unreadCount > 0) {
        // Hero header uses a dot indicator
        if (notificationBadge) {
          notificationBadge.style.display = 'block';
        }
      } else {
        if (notificationBadge) {
          notificationBadge.style.display = 'none';
        }
      }
    }

    // Mark notification as read
    window.markNotificationAsRead = async function (notificationId) {
      const token = document.cookie.split('; ').find(row => row.startsWith('user_token='))?.split('=')[1];

      try {
        const response = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: 'Bearer ' + token })
          }
        });

        if (!response.ok) {
          throw new Error('Failed to mark notification as read');
        }

        // Update local data
        const notification = notificationsData.find(n => n._id === notificationId);
        if (notification) {
          notification.read = true;
        }

        displayNotifications();
        updateBadgeCount();

        // Show success message
        showToast('اعلان به عنوان خوانده شده علامت‌گذاری شد', 'success');
      } catch (error) {
        console.error('Error marking notification as read:', error);
        showToast('خطا در علامت‌گذاری اعلان', 'error');
      }
    };

    // Delete notification
    window.deleteNotification = async function (notificationId) {
      const token = document.cookie.split('; ').find(row => row.startsWith('user_token='))?.split('=')[1];

      try {
        const response = await fetch(`${API_BASE}/notifications/${notificationId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: 'Bearer ' + token })
          }
        });

        if (!response.ok) {
          throw new Error('Failed to delete notification');
        }

        // Remove from local data
        notificationsData = notificationsData.filter(n => n._id !== notificationId);

        displayNotifications();
        updateBadgeCount();

        // Show success message
        showToast('اعلان با موفقیت حذف شد', 'success');
      } catch (error) {
        console.error('Error deleting notification:', error);
        showToast('خطا در حذف اعلان', 'error');
      }
    };

    // Helper function to calculate time ago
    function getTimeAgo(date) {
      const now = new Date();
      const diffInSeconds = Math.floor((now - date) / 1000);

      if (diffInSeconds < 60) {
        return 'همین الان';
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} دقیقه پیش`;
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} ساعت پیش`;
      } else if (diffInSeconds < 2592000) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} روز پیش`;
      } else {
        const months = Math.floor(diffInSeconds / 2592000);
        return `${months} ماه پیش`;
      }
    }

    // Load notifications on page load and periodically refresh
    document.addEventListener('DOMContentLoaded', () => {
      // Initial load
      loadNotifications();

      // Refresh notifications every 30 seconds
      setInterval(() => {
        loadNotifications();
      }, 30000);
    });

    // ============= End Notification System =============

    // ============= Streak & Wallet System =============
    
    /**
     * بارگذاری و نمایش استریک و کیف پول
     */
    async function initStreakAndWallet() {
      await Promise.all([
        loadStreakData(),
        loadWalletData()
      ]);
      setupStreakWalletEvents();
    }

    /**
     * دریافت اطلاعات استریک
     */
    async function loadStreakData() {
      try {
        const res = await fetch('/api/user/streak', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
          if (res.status === 401) {
            renderStreakNotLoggedIn();
            return;
          }
          throw new Error('خطا در دریافت استریک');
        }

        streakData = await res.json();
        renderStreakCard();
      } catch (error) {
        console.error('loadStreakData error:', error);
        renderStreakError();
      }
    }

    /**
     * دریافت اطلاعات کیف پول
     */
    async function loadWalletData() {
      try {
        const res = await fetch('/api/user/wallet/summary', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
          if (res.status === 401) {
            renderWalletNotLoggedIn();
            return;
          }
          throw new Error('خطا در دریافت کیف پول');
        }

        walletData = await res.json();
        renderWalletCard();
      } catch (error) {
        console.error('loadWalletData error:', error);
        renderWalletError();
      }
    }

    /**
     * رندر پاپ‌آپ استریک
     */
    function renderStreakCard() {
      if (!streakData) return;

      const streakNumber = document.getElementById('streakNumber');
      const streakLevel = document.getElementById('streakLevel');
      const longestStreak = document.getElementById('longestStreak');
      const totalLoginDays = document.getElementById('totalLoginDays');
      const streakWeek = document.getElementById('streakWeek');
      const streakCheckinBtn = document.getElementById('streakCheckinBtn');
      const streakCheckinText = document.getElementById('streakCheckinText');
      const streakMiniNumber = document.getElementById('streakMiniNumber');
      const streakMiniSubtitle = document.getElementById('streakMiniSubtitle');
      const streakPopupDismiss = document.getElementById('streakPopupDismiss');

      if (streakNumber) streakNumber.textContent = streakData.currentStreak || 0;
      if (streakMiniNumber) streakMiniNumber.textContent = streakData.currentStreak || 0;
      
      const streakLevelText = document.getElementById('streakLevelText');
      if (streakLevelText && streakData.level) {
        streakLevelText.textContent = streakData.level.name || 'تازه‌کار';
      }
      if (longestStreak) longestStreak.textContent = streakData.longestStreak || 0;
      if (totalLoginDays) totalLoginDays.textContent = streakData.totalLoginDays || 0;

      // رندر تاریخچه هفتگی
      if (streakWeek && streakData.weekHistory) {
        const today = new Date().toISOString().split('T')[0];
        streakWeek.innerHTML = streakData.weekHistory.map(day => {
          const isToday = day.date === today;
          let dotClass = 'pending';
          let dotContent = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle></svg>`;
          
          if (day.status === 'hit') {
            dotClass = 'hit';
            dotContent = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          } else if (day.status === 'missed') {
            dotClass = 'missed';
            dotContent = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
          }
          
          return `
            <div class="streak-popup-day">
              <span class="streak-popup-day-name">${day.dayName || ''}</span>
              <div class="streak-popup-day-dot ${dotClass} ${isToday ? 'today' : ''}">${dotContent}</div>
            </div>
          `;
        }).join('');
      }

      // وضعیت دکمه چک‌این
      if (streakCheckinBtn && streakCheckinText) {
        if (streakData.checkedInToday) {
          streakCheckinBtn.classList.remove('active');
          streakCheckinBtn.classList.add('done');
          streakCheckinText.textContent = 'امروز ثبت شده';
          streakCheckinBtn.disabled = true;
          if (streakMiniSubtitle) {
            streakMiniSubtitle.textContent = 'امروز ثبت شده';
            streakMiniSubtitle.classList.add('checked');
          }
          if (streakPopupDismiss) streakPopupDismiss.textContent = 'بستن';
        } else {
          streakCheckinBtn.classList.add('active');
          streakCheckinBtn.classList.remove('done');
          streakCheckinText.textContent = 'ثبت ورود امروز';
          streakCheckinBtn.disabled = false;
          if (streakMiniSubtitle) {
            streakMiniSubtitle.textContent = 'برای دریافت امتیاز کلیک کنید';
            streakMiniSubtitle.classList.remove('checked');
          }
          if (streakPopupDismiss) streakPopupDismiss.textContent = 'بعداً یادآوری کن';
        }
      }

      // نمایش پاپ‌آپ اگر امروز چک‌این نشده و قبلاً بسته نشده
      checkAndShowStreakPopup();
    }

    /**
     * بررسی و نمایش پاپ‌آپ استریک
     */
    function checkAndShowStreakPopup() {
      const today = new Date().toISOString().split('T')[0];
      const dismissedDate = localStorage.getItem('streakPopupDismissed');
      const miniBanner = document.getElementById('streakMiniBanner');
      
      // اگر امروز چک‌این شده، فقط بنر کوچک نشون بده
      if (streakData && streakData.checkedInToday) {
        hideStreakPopup();
        if (miniBanner) miniBanner.classList.add('visible');
        return;
      }

      // اگر امروز پاپ‌آپ بسته شده، بنر کوچک نشون بده
      if (dismissedDate === today) {
        if (miniBanner) miniBanner.classList.add('visible');
        return;
      }

      // نمایش پاپ‌آپ
      showStreakPopup();
    }

    /**
     * نمایش پاپ‌آپ استریک
     */
    function showStreakPopup() {
      const overlay = document.getElementById('streakPopupOverlay');
      const miniBanner = document.getElementById('streakMiniBanner');
      if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
      if (miniBanner) miniBanner.classList.remove('visible');
    }

    /**
     * بستن پاپ‌آپ استریک
     */
    function hideStreakPopup() {
      const overlay = document.getElementById('streakPopupOverlay');
      if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    }

    /**
     * بستن پاپ‌آپ و ذخیره در localStorage
     */
    function dismissStreakPopup() {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('streakPopupDismissed', today);
      hideStreakPopup();
      
      const miniBanner = document.getElementById('streakMiniBanner');
      if (miniBanner) miniBanner.classList.add('visible');
    }

    /**
     * نمایش کانفتی
     */
    function showConfetti() {
      const container = document.createElement('div');
      container.className = 'streak-confetti';
      document.body.appendChild(container);

      const colors = ['#f97316', '#22c55e', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6'];
      
      for (let i = 0; i < 50; i++) {
        const piece = document.createElement('div');
        piece.className = 'streak-confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = Math.random() * 0.5 + 's';
        piece.style.animationDuration = (2 + Math.random() * 2) + 's';
        container.appendChild(piece);
      }

      setTimeout(() => container.remove(), 4000);
    }

    // Event listeners برای پاپ‌آپ استریک
    document.addEventListener('DOMContentLoaded', function() {
      // دکمه بستن پاپ‌آپ
      const closeBtn = document.getElementById('streakPopupClose');
      if (closeBtn) {
        closeBtn.addEventListener('click', dismissStreakPopup);
      }

      // دکمه بعداً یادآوری کن
      const dismissBtn = document.getElementById('streakPopupDismiss');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', dismissStreakPopup);
      }

      // کلیک روی overlay برای بستن
      const overlay = document.getElementById('streakPopupOverlay');
      if (overlay) {
        overlay.addEventListener('click', function(e) {
          if (e.target === overlay) {
            dismissStreakPopup();
          }
        });
      }

      // کلیک روی بنر کوچک برای باز کردن پاپ‌آپ
      const miniBanner = document.getElementById('streakMiniBanner');
      if (miniBanner) {
        miniBanner.addEventListener('click', function() {
          localStorage.removeItem('streakPopupDismissed');
          showStreakPopup();
        });
      }
    });

    /**
     * رندر کارت کیف پول
     */
    function renderWalletCard() {
      if (!walletData) return;

      const walletBalance = document.getElementById('walletBalance');
      const totalEarned = document.getElementById('totalEarned');
      const totalSpent = document.getElementById('totalSpent');
      const recentTransactions = document.getElementById('recentTransactions');

      if (walletBalance) walletBalance.textContent = (walletData.balance || 0).toLocaleString('fa-IR');
      if (totalEarned) totalEarned.textContent = (walletData.totalEarned || 0).toLocaleString('fa-IR');
      if (totalSpent) totalSpent.textContent = (walletData.totalSpent || 0).toLocaleString('fa-IR');

      // رندر تراکنش‌های اخیر
      if (recentTransactions && walletData.recentTransactions) {
        if (walletData.recentTransactions.length === 0) {
          recentTransactions.innerHTML = `
            <div class="text-center text-gray-400 py-4 text-sm">
              هنوز تراکنشی ثبت نشده
            </div>
          `;
        } else {
          recentTransactions.innerHTML = walletData.recentTransactions.map(t => {
            // آیکون SVG بر اساس نوع تراکنش
            const icon = t.isPositive 
              ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transaction-icon-svg positive"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transaction-icon-svg negative"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>`;
            
            return `
              <div class="wallet-transaction">
                <div class="wallet-transaction-info">
                  <span class="wallet-transaction-icon">${icon}</span>
                  <span class="wallet-transaction-title">${t.title || 'تراکنش'}</span>
                </div>
                <span class="wallet-transaction-amount ${t.isPositive ? 'positive' : 'negative'}">
                  ${t.formattedAmount || t.amount}
                </span>
              </div>
            `;
          }).join('');
        }
      }
    }

    /**
     * ثبت ورود روزانه (چک‌این)
     */
    async function doCheckIn() {
      const btn = document.getElementById('streakCheckinBtn');
      const text = document.getElementById('streakCheckinText');
      
      if (!btn || btn.disabled) return;
      
      btn.disabled = true;
      text.textContent = 'در حال ثبت...';

      try {
        const res = await fetch('/api/user/streak/checkin', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.alreadyCheckedIn) {
            showStreakToast('امروز قبلاً ورود ثبت شده است', 'info');
            btn.classList.remove('active');
            btn.classList.add('done');
            text.textContent = '✓ امروز ثبت شده';
            return;
          }
          throw new Error(data.message || 'خطا در ثبت ورود');
        }

        // موفقیت
        streakData = {
          ...streakData,
          currentStreak: data.currentStreak,
          longestStreak: data.longestStreak,
          totalLoginDays: data.totalLoginDays,
          loyaltyPoints: data.loyaltyPoints,
          level: data.level,
          checkedInToday: true
        };

        // آپدیت کیف پول
        if (walletData) {
          walletData.balance = data.newBalance;
        }

        renderStreakCard();
        renderWalletCard();

        // نمایش پاداش
        const rewardText = data.rewards && data.rewards.length > 0
          ? `+${data.totalReward.toLocaleString('fa-IR')} تومان پاداش!`
          : 'ورود ثبت شد!';
        
        showStreakToast(`🎉 ${rewardText}`, 'success');

        // انیمیشن موفقیت و کانفتی
        const streakPopup = document.getElementById('streakPopup');
        if (streakPopup) {
          streakPopup.classList.add('success-animation');
          setTimeout(() => streakPopup.classList.remove('success-animation'), 500);
        }
        
        // نمایش کانفتی
        showConfetti();

        // بستن پاپ‌آپ بعد از 2 ثانیه
        setTimeout(() => {
          hideStreakPopup();
          const miniBanner = document.getElementById('streakMiniBanner');
          if (miniBanner) miniBanner.classList.add('visible');
        }, 2500);

      } catch (error) {
        console.error('doCheckIn error:', error);
        showStreakToast(error.message || 'خطا در ثبت ورود', 'error');
        btn.disabled = false;
        text.textContent = 'ثبت ورود امروز';
      }
    }

    /**
     * نمایش همه تراکنش‌ها
     */
    async function showAllTransactions() {
      const modal = document.getElementById('transactionsModal');
      const list = document.getElementById('allTransactionsList');
      
      if (!modal || !list) return;

      modal.classList.add('active');
      list.innerHTML = `
        <div class="text-center py-8">
          <div class="loading-spinner mx-auto mb-3"></div>
          <p class="text-gray-500">در حال بارگذاری...</p>
        </div>
      `;

      try {
        const res = await fetch('/api/user/wallet/transactions?limit=50', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) throw new Error('خطا در دریافت تراکنش‌ها');

        const data = await res.json();
        const transactions = data.transactions || [];

        if (transactions.length === 0) {
          list.innerHTML = `
            <div class="text-center py-8">
              <div class="text-4xl mb-3">💳</div>
              <p class="text-gray-500">هنوز تراکنشی ثبت نشده</p>
            </div>
          `;
          return;
        }

        list.innerHTML = transactions.map(t => {
          // آیکون SVG بر اساس نوع تراکنش
          const icon = t.isPositive 
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>`;
          
          return `
            <div class="transaction-item">
              <div class="transaction-icon-wrapper ${t.isPositive ? 'earn' : 'spend'}">
                ${icon}
              </div>
              <div class="transaction-details">
                <p class="transaction-title">${t.title || 'تراکنش'}</p>
                <span class="transaction-date">${formatDate(t.createdAt)} • ${t.categoryLabel || ''}</span>
              </div>
              <span class="transaction-amount ${t.isPositive ? 'positive' : 'negative'}">
                ${t.formattedAmount || t.amount}
              </span>
            </div>
          `;
        }).join('');

      } catch (error) {
        console.error('showAllTransactions error:', error);
        list.innerHTML = `
          <div class="text-center py-8 text-red-500">
            خطا در بارگذاری تراکنش‌ها
          </div>
        `;
      }
    }

    /**
     * بستن مودال تراکنش‌ها
     */
    function closeTransactionsModal() {
      const modal = document.getElementById('transactionsModal');
      if (modal) modal.classList.remove('active');
    }

    /**
     * تنظیم رویدادها
     */
    function setupStreakWalletEvents() {
      const checkinBtn = document.getElementById('streakCheckinBtn');
      if (checkinBtn) {
        checkinBtn.addEventListener('click', doCheckIn);
      }

      const viewAllBtn = document.getElementById('viewAllTransactions');
      if (viewAllBtn) {
        viewAllBtn.addEventListener('click', showAllTransactions);
      }

      const closeModalBtn = document.getElementById('closeTransactionsModal');
      if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeTransactionsModal);
      }

      const modal = document.getElementById('transactionsModal');
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeTransactionsModal();
        });
      }
    }

    /**
     * نمایش toast
     */
    function showStreakToast(message, type = 'success') {
      // حذف toast قبلی
      const existing = document.querySelector('.streak-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.className = `streak-toast ${type === 'error' ? 'error' : ''}`;
      toast.innerHTML = `
        <span>${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
        <span>${message}</span>
      `;
      document.body.appendChild(toast);

      setTimeout(() => toast.classList.add('show'), 10);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
      }, 3000);
    }

    /**
     * فرمت تاریخ
     */
    function formatDate(dateStr) {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fa-IR', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } catch {
        return dateStr;
      }
    }

    /**
     * حالت خطا برای استریک
     */
    function renderStreakError() {
      const card = document.getElementById('streakCard');
      if (card) {
        card.innerHTML = `
          <div class="text-center py-6">
            <div class="text-3xl mb-2">⚠️</div>
            <p class="text-orange-700 font-bold">خطا در بارگذاری استریک</p>
            <button onclick="loadStreakData()" class="mt-3 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold">
              تلاش مجدد
            </button>
          </div>
        `;
      }
    }

    /**
     * حالت خطا برای کیف پول
     */
    function renderWalletError() {
      const card = document.getElementById('walletCard');
      if (card) {
        card.innerHTML = `
          <div class="text-center py-6">
            <div class="text-3xl mb-2">⚠️</div>
            <p class="text-emerald-700 font-bold">خطا در بارگذاری کیف پول</p>
            <button onclick="loadWalletData()" class="mt-3 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold">
              تلاش مجدد
            </button>
          </div>
        `;
      }
    }

    /**
     * حالت لاگین نشده برای استریک
     */
    function renderStreakNotLoggedIn() {
      const card = document.getElementById('streakCard');
      if (card) {
        card.innerHTML = `
          <div class="text-center py-6">
            <div class="text-3xl mb-2">🔒</div>
            <p class="text-orange-700 font-bold mb-2">برای استفاده از استریک وارد شوید</p>
            <a href="/login.html" class="inline-block px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold">
              ورود به حساب
            </a>
          </div>
        `;
      }
    }

    /**
     * حالت لاگین نشده برای کیف پول
     */
    function renderWalletNotLoggedIn() {
      const card = document.getElementById('walletCard');
      if (card) {
        card.innerHTML = `
          <div class="wallet-login-prompt">
            <div class="wallet-login-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/>
                <path d="M5 20c0-3.5 3.5-6 7-6s7 2.5 7 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M15 11l2 2 4-4" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="wallet-login-content">
              <h4 class="wallet-login-title">ورود به حساب کاربری</h4>
              <p class="wallet-login-desc">برای مشاهده موجودی کیف پول و دریافت پاداش‌ها، وارد حساب کاربری خود شوید</p>
            </div>
            <div class="wallet-login-features">
              <div class="wallet-login-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                <span>مدیریت اعتبار</span>
              </div>
              <div class="wallet-login-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
                <span>تاریخچه تراکنش</span>
              </div>
              <div class="wallet-login-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/></svg>
                <span>پشتیبانی ۲۴/۷</span>
              </div>
            </div>
            <a href="/login.html" class="wallet-login-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              <span>ورود به حساب</span>
            </a>
          </div>
        `;
      }
    }

    // ============= End Streak & Wallet System =============
