function initContentDashboard() {
  /* ---- فروشنده از localStorage ---- */
  let seller = null;
  try {
    seller = JSON.parse(localStorage.getItem("seller"));
  } catch (e) {
    seller = null;
  }
  const sellerId = seller && seller.id ? seller.id : "";
  if (!sellerId) {
    alert("برای مدیریت ظاهر فروشگاه ابتدا وارد حساب شوید.");
    window.location.href = "login.html";
  }

  /* ---- API ---- */
  const API_GET = `http://localhost:5000/api/shopAppearance/${sellerId}`;
  const API_POST = `http://localhost:5000/api/shopAppearance/${sellerId}/save`;

  /* ---- لوگوی متنی ---- */
  const shopLogoText = document.getElementById('shopLogoText');
  const logoPreview = document.getElementById('logoPreview');
  shopLogoText.addEventListener('input', function () {
    const val = shopLogoText.value.trim();
    if (val.length > 0) {
      logoPreview.innerHTML = '<span style="font-family: Vazirmatn,sans-serif; font-weight:900; font-size:2.2rem; letter-spacing:-1px; color:#19954b; text-shadow:0 2px 8px #7fcba11a;">' + val + '</span>';
    } else {
      logoPreview.innerHTML = '';
    }
  });

  /* ---- مدیریت اسلایدها ---- */
  let slides = [];
  function renderSlides() {
    const c = document.getElementById('sliderList');
    if (!c) return;
    c.innerHTML = slides.length === 0
      ? `<div class="text-center text-gray-400 text-sm py-4">هنوز اسلایدی اضافه نشده است.</div>`
      : slides.map((s, i) => `
      <div class="slide-card" style="scroll-snap-align:center;">
        <div class="slide-actions">
          <span class="slide-number">اسلاید ${i + 1}</span>
          <button type="button" onclick="window.removeSlide(${i})" class="remove-btn" title="حذف اسلاید">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M6 6L14 14M6 14L14 6" stroke="#f43f5e" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="slide-img-box">
          <input type="file" accept="image/*" onchange="window.handleSlideImg(event,${i})" class="absolute opacity-0 w-full h-full z-10 cursor-pointer" title="تغییر عکس اسلاید"/>
          ${s.img
            ? `<img src="${s.img}" alt="اسلاید ${i + 1}" />`
            : `<span class="text-gray-400 text-sm">انتخاب عکس</span>`
          }
        </div>
        <div class="slide-info-flex">
          <input type="text" value="${s.title ? s.title.replace(/"/g, '&quot;') : ''}" placeholder="عنوان اسلاید"
            onchange="window.slides[${i}].title=this.value;window.renderSlides();" class="slide-input"/>
          <input type="text" value="${s.desc ? s.desc.replace(/"/g, '&quot;') : ''}" placeholder="توضیح اسلاید"
            onchange="window.slides[${i}].desc=this.value;window.renderSlides();" class="slide-input slide-desc-input"/>
        </div>
      </div>
      `).join('');
    window.slides = slides;
    window.renderSlides = renderSlides;
  }
  function addSlide() {
    slides.push({ title: '', desc: '', img: '' });
    renderSlides();
  }
  function removeSlide(idx) {
    slides.splice(idx, 1);
    renderSlides();
  }
  function handleSlideImg(e, i) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      slides[i].img = ev.target.result;
      renderSlides();
    }
    reader.readAsDataURL(file);
  }
  // وصل کردن به window برای دسترسی از html inline
  window.addSlide = addSlide;
  window.removeSlide = removeSlide;
  window.handleSlideImg = handleSlideImg;
  window.renderSlides = renderSlides;
  window.slides = slides;

  /* ---- لود تنظیمات فعلی ---- */
  async function loadTheme() {
    if (!sellerId) {
      alert('شناسه فروشنده مشخص نیست!');
      return;
    }
    try {
      const res = await fetch(API_GET, { credentials: 'include' });
      if (!res.ok) throw new Error("خطا در دریافت اطلاعات فروشگاه");
      const data = await res.json();
      document.getElementById('shopPhone').value = data.shopPhone || '';
      document.getElementById('shopAddress').value = data.shopAddress || '';
      document.getElementById('shopLogoText').value = data.shopLogoText || '';
      document.getElementById('shopStatus').value = data.shopStatus || 'open';
      slides = Array.isArray(data.slides) ? data.slides : [];
      window.slides = slides;
      shopLogoText.dispatchEvent(new Event('input'));
      renderSlides();
    } catch (err) {
      console.error(err);
      slides = [];
      window.slides = slides;
      renderSlides();
    }
  }

  /* ---- ذخیره تنظیمات ---- */
 async function saveTheme() {
  if (!sellerId) {
    alert('شناسه فروشنده مشخص نیست!');
    return;
  }
  const shopPhone = document.getElementById('shopPhone').value;
  const shopAddress = document.getElementById('shopAddress').value;
  const shopLogoTextVal = document.getElementById('shopLogoText').value;
  const shopStatus = document.getElementById('shopStatus').value;

  // اینجا shopurl رو از seller بگیر
  let seller = null;
  try {
    seller = JSON.parse(localStorage.getItem("seller"));
  } catch (e) {
    seller = null;
  }
  const shopurl = seller && seller.shopurl ? seller.shopurl : "";

  if (!shopAddress) {
    alert("آدرس فروشگاه را وارد کنید.");
    return;
  }
  if (!shopurl) {
    alert("آدرس اختصاصی فروشگاه پیدا نشد!");
    return;
  }

  try {
    const res = await fetch(API_POST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: 'include',
      body: JSON.stringify({
        sellerId,
        shopurl, // این باید باشه حتماً!
        shopPhone,
        shopAddress,
        shopLogoText: shopLogoTextVal,
        shopStatus,
        slides
      })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "ذخیره ناموفق بود");
    // نمایش پاپ‌آپ موفقیت
    const popup = document.getElementById('saveSuccessPopup');
    if (popup) {
      popup.classList.remove('hidden');
      setTimeout(() => popup.classList.add('hidden'), 2200);
      popup.onclick = e => { if (e.target === popup) popup.classList.add('hidden'); }
    }
  } catch (err) {
    alert("خطا در ذخیره! " + err.message);
  }
}
window.saveTheme = saveTheme;
window.loadTheme = loadTheme;

// اتوماتیک لود شدن وقتی فانکشن اجرا شد
loadTheme();

}