async function initLogoDashboard() {  // اضافه کردن async اینجا
  // جلوگیری از چندبار اجرا
  if (window._logoDashboardInited) return;
  window._logoDashboardInited = true;

  // المنت‌ها
  const logoInput      = document.getElementById("logo-file-input");
  const logoPreview    = document.getElementById("shop-logo-preview");
  const noLogoMsg      = document.getElementById("no-logo-msg");
  const logoSaveBtn    = document.getElementById("logo-save-btn");
  const logoFileError  = document.getElementById("logo-file-error");
  const logoSaveSuccess= document.getElementById("logo-save-success");
  const dropzone       = document.getElementById("logo-dropzone");
  const logoForm       = document.getElementById("logo-upload-form");

  if (!logoInput || !logoPreview || !noLogoMsg || !logoSaveBtn || !logoFileError || !logoSaveSuccess || !dropzone || !logoForm) return;

  let selectedLogoBase64 = "";
  let seller = null;

  // تابع جدید fetchCurrentSellerLogo (جایگزین نسخه قدیمی)
  async function fetchCurrentSellerLogo() {
    try {
      let res = await fetch(`http://localhost:5000/api/auth/me`, {
        method: "GET",
        credentials: 'include'
      });
      if (res.status === 401 || res.status === 403) { // اگر unauthorized یا forbidden
        window.location.href = "login.html";
        return;
      }
      if (!res.ok) {
        throw new Error("دریافت اطلاعات فروشنده با خطا مواجه شد");
      }
      const sellerData = await res.json();
      seller = sellerData.seller;
      if (!seller || !seller.id) {
        window.location.href = "login.html";
        return;
      }

      // ذخیره seller در localStorage برای استفاده‌های بعدی (اختیاری، اما برای cache مفید)
      localStorage.setItem("seller", JSON.stringify(seller));

      if (seller.boardImage) {
        logoPreview.src = seller.boardImage;
        logoPreview.style.display = 'block';
        noLogoMsg.style.display = 'none';
      } else {
        logoPreview.style.display = 'none';
        noLogoMsg.style.display = 'block';
      }
      logoSaveBtn.disabled = true;
      selectedLogoBase64 = "";
    } catch (e) {
      console.error(e);
      logoFileError.innerText = "دریافت اطلاعات فروشنده با خطا مواجه شد. لطفاً دوباره لاگین کنید.";
      logoFileError.classList.remove('hidden');
      setTimeout(() => window.location.href = "login.html", 3000); // ریدایرکت پس از نمایش خطا
    }
  }
  await fetchCurrentSellerLogo();  // اضافه کردن await اینجا

  // کلیک روی dropzone = کلیک روی input
  dropzone.addEventListener('click', function (e) {
    if (e.target === logoInput) return;
    logoInput.click();
  });

  // Drag & drop
  dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', function (e) {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      logoInput.files = e.dataTransfer.files;
      handleLogoFile(e.dataTransfer.files[0]);
    }
  });

  // انتخاب فایل جدید
  logoInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) handleLogoFile(file);
  });

  // پیش‌نمایش و اعتبارسنجی عکس
  function handleLogoFile(file) {
    logoFileError.classList.add('hidden');
    if (!file.type.match(/^image\/(jpeg|png|jpg)$/)) {
      logoFileError.innerText = "فقط فرمت JPG یا PNG مجاز است!";
      logoFileError.classList.remove('hidden');
      logoPreview.style.display = 'none';
      logoSaveBtn.disabled = true;
      return;
    }
    const reader = new FileReader();
    reader.onload = function (ev) {
      logoPreview.src = ev.target.result;
      logoPreview.style.display = 'block';
      noLogoMsg.style.display = 'none';
      selectedLogoBase64 = ev.target.result;
      logoSaveBtn.disabled = false;
    }
    reader.readAsDataURL(file);
  }

  // event listener جدید برای submit (جایگزین نسخه قدیمی)
  logoForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!selectedLogoBase64 || !seller || !seller.id) return;
    logoSaveBtn.disabled = true;
    logoFileError.classList.add('hidden');
    try {
      let res = await fetch(`http://localhost:5000/api/sellers/${seller.id}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ logo: selectedLogoBase64 })
      });
      const data = await res.json();
      if (res.ok) {
        seller.boardImage = selectedLogoBase64;
        localStorage.setItem("seller", JSON.stringify(seller));
        logoSaveSuccess.classList.remove('hidden');
        setTimeout(() => {
          logoSaveSuccess.classList.add('hidden');
        }, 1700);
        fetchCurrentSellerLogo();
      } else {
        if (res.status === 401 || res.status === 403) {
          logoFileError.innerText = "شما لاگین نیستید یا دسترسی ندارید!";
          logoFileError.classList.remove('hidden');
          setTimeout(() => window.location.href = "login.html", 3000);
        } else {
          logoFileError.innerText = data.message || "ثبت تابلو با خطا مواجه شد!";
          logoFileError.classList.remove('hidden');
        }
      }
    } catch (err) {
      logoFileError.innerText = "ثبت تابلو با خطا مواجه شد!";
      logoFileError.classList.remove('hidden');
    }
    logoSaveBtn.disabled = false;
  });
}

// اگر میخوای با لود صفحه خودش اجرا شه این خط رو بنداز آخرش:
initLogoDashboard().catch(console.error);  // اضافه کردن catch برای مدیریت خطاهای async