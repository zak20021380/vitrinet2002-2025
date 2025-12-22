// تابع اصلی برای مقداردهی اولیه بخش تابلو فروشگاه
async function initLogoDashboard() {
  // ریست کردن flag برای اجازه اجرای مجدد
  window._logoDashboardInited = false;

  const API = window.VITRINET_API || null;
  const apiUrl = path => API ? API.buildUrl(path) : `http://localhost:5000${path}`;
  const withCreds = (init = {}) => {
    if (API) return API.ensureCredentials(init);
    if (init.credentials === undefined) {
      return { ...init, credentials: 'include' };
    }
    return init;
  };

  // المنت‌ها
  const logoInput = document.getElementById("logo-file-input");
  const logoPreview = document.getElementById("shop-logo-preview");
  const noLogoMsg = document.getElementById("no-logo-msg");
  const logoSaveBtn = document.getElementById("logo-save-btn");
  const logoFileError = document.getElementById("logo-file-error");
  const logoSaveSuccess = document.getElementById("logo-save-success");
  const dropzone = document.getElementById("logo-dropzone");
  const logoForm = document.getElementById("logo-upload-form");

  // بررسی وجود المنت‌ها
  if (!logoInput || !logoPreview || !noLogoMsg || !logoSaveBtn || !logoFileError || !logoSaveSuccess || !dropzone || !logoForm) {
    console.warn('Logo dashboard elements not found');
    return;
  }

  let selectedLogoBase64 = "";
  let seller = null;

  // تابع دریافت اطلاعات فروشنده
  async function fetchCurrentSellerLogo() {
    try {
      // ابتدا از window.seller استفاده کن (اگر موجود باشد)
      if (window.seller && window.seller.id) {
        seller = window.seller;
        updateLogoPreview();
        return;
      }

      // در غیر این صورت از API دریافت کن
      let res = await fetch(apiUrl('/api/auth/me'), withCreds({ method: 'GET' }));
      if (res.status === 401 || res.status === 403) {
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

      localStorage.setItem("seller", JSON.stringify(seller));
      updateLogoPreview();
    } catch (e) {
      console.error(e);
      logoFileError.innerText = "دریافت اطلاعات فروشنده با خطا مواجه شد.";
      logoFileError.classList.remove('hidden');
    }
  }

  // تابع به‌روزرسانی پیش‌نمایش لوگو
  function updateLogoPreview() {
    if (seller && seller.boardImage) {
      logoPreview.src = seller.boardImage;
      logoPreview.style.display = 'block';
      noLogoMsg.style.display = 'none';
    } else {
      logoPreview.style.display = 'none';
      noLogoMsg.style.display = 'block';
    }
    logoSaveBtn.disabled = true;
    selectedLogoBase64 = "";
  }

  // دریافت اطلاعات فروشنده
  await fetchCurrentSellerLogo();

  // کلیک روی dropzone = کلیک روی input
  dropzone.addEventListener('click', function(e) {
    if (e.target === logoInput) return;
    logoInput.click();
  });

  // Drag & drop
  dropzone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  
  dropzone.addEventListener('dragleave', function(e) {
    dropzone.classList.remove('dragover');
  });
  
  dropzone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      logoInput.files = e.dataTransfer.files;
      handleLogoFile(e.dataTransfer.files[0]);
    }
  });

  // انتخاب فایل جدید
  logoInput.addEventListener('change', function(e) {
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
    reader.onload = function(ev) {
      logoPreview.src = ev.target.result;
      logoPreview.style.display = 'block';
      noLogoMsg.style.display = 'none';
      selectedLogoBase64 = ev.target.result;
      logoSaveBtn.disabled = false;
    }
    reader.readAsDataURL(file);
  }

  // ارسال فرم
  logoForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!selectedLogoBase64 || !seller || !seller.id) return;
    
    logoSaveBtn.disabled = true;
    logoFileError.classList.add('hidden');
    
    try {
      let res = await fetch(apiUrl(`/api/sellers/${seller.id}/logo`), withCreds({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo: selectedLogoBase64 })
      }));
      
      const data = await res.json();
      
      if (res.ok) {
        seller.boardImage = selectedLogoBase64;
        localStorage.setItem("seller", JSON.stringify(seller));
        
        // به‌روزرسانی window.seller هم
        if (window.seller) {
          window.seller.boardImage = selectedLogoBase64;
        }
        
        logoSaveSuccess.classList.remove('hidden');
        setTimeout(() => {
          logoSaveSuccess.classList.add('hidden');
        }, 2500);
        
        // ریست کردن فرم
        selectedLogoBase64 = "";
        logoSaveBtn.disabled = true;
      } else {
        if (res.status === 401 || res.status === 403) {
          logoFileError.innerText = "شما لاگین نیستید یا دسترسی ندارید!";
          logoFileError.classList.remove('hidden');
        } else {
          logoFileError.innerText = data.message || "ثبت تابلو با خطا مواجه شد!";
          logoFileError.classList.remove('hidden');
        }
      }
    } catch (err) {
      logoFileError.innerText = "ثبت تابلو با خطا مواجه شد!";
      logoFileError.classList.remove('hidden');
    }
    
    logoSaveBtn.disabled = !selectedLogoBase64;
  });

  // علامت‌گذاری به عنوان مقداردهی شده
  window._logoDashboardInited = true;
}

// اگر صفحه مستقیم لود شده، اجرا کن
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initLogoDashboard().catch(console.error));
} else {
  // اگر DOM آماده است، مستقیم اجرا کن
  initLogoDashboard().catch(console.error);
}
