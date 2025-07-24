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





// واکشی و رندر تبلیغ فروشگاه ویژه قبل از کارت فروشگاه‌ها
// متغیر تبلیغ ویژه (در صورت وجود)
let adHomeData = null;

// گرفتن تبلیغ ad_home فقط یکبار برای هر بار بارگذاری فروشگاه‌ها
async function fetchAdHome() {
  try {
    const res = await fetch('http://localhost:5000/api/adOrder/active?planSlug=ad_home');
    const data = await res.json();
    if (data.success && data.ads && data.ads.length > 0) {
      adHomeData = data.ads[0];
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

  // اول تبلیغ ویژه رو بگیر
  await fetchAdHome();

  try {
    const res = await fetch('http://localhost:5000/api/shops');
    const shops = await res.json();
    cardsWrap.innerHTML = '';

    // اگر تبلیغ ویژه داریم، اول کارت تبلیغ رو اضافه کن
    if (adHomeData) {
      const ad = adHomeData;
      const card = document.createElement('a');
      card.href = ad.sellerId ? `shop.html?id=${ad.sellerId}` : '#';
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
      `;
      cardsWrap.appendChild(card);
    }

    // کارت‌های فروشگاه‌ها رو اضافه کن
    if (!shops.length) {
      cardsWrap.innerHTML += '<div class="text-gray-400 text-center w-full p-7">فعلا فروشگاهی ثبت نشده.</div>';
      return;
    }

    shops.forEach(shop => {
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
      `;
      cardsWrap.appendChild(card);
    });

  } catch (e) {
    cardsWrap.innerHTML = '<div class="text-red-500 text-center و-full p-8">مشکل در ارتباط با سرور!</div>';
  }
}

window.addEventListener('DOMContentLoaded', loadShops);


// اسکرول نرم و Drag برای فروشگاه‌های منتخب شهر
const shopSlider = document.getElementById('drag-scroll-cards');
function momentumShop() {
  if (Math.abs(velocity) > 0.4) {
    shopSlider.scrollLeft -= velocity;
    velocity *= 0.93;
    momentumID = requestAnimationFrame(momentumShop);
  } else {
    cancelAnimationFrame(momentumID);
    velocity = 0;
  }
}
shopSlider.addEventListener('mousedown', (e) => {
  isDown = true; drag = false;
  shopSlider.classList.add('grabbing');
  startX = e.pageX - shopSlider.offsetLeft;
  lastX = e.pageX;
  scrollLeft = shopSlider.scrollLeft;
  velocity = 0;
  cancelAnimationFrame(momentumID);
});
shopSlider.addEventListener('mousemove', (e) => {
  if (!isDown) return;
  drag = true;
  const x = e.pageX - shopSlider.offsetLeft;
  shopSlider.scrollLeft = scrollLeft - (x - startX);
  velocity = (e.pageX - lastX);
  lastX = e.pageX;
});
shopSlider.addEventListener('mouseup', () => {
  isDown = false;
  shopSlider.classList.remove('grabbing');
  if (Math.abs(velocity) > 1) momentumShop();
});
shopSlider.addEventListener('mouseleave', () => {
  isDown = false;
  shopSlider.classList.remove('grabbing');
  if (Math.abs(velocity) > 1) momentumShop();
});
shopSlider.addEventListener('touchstart', (e) => {
  isDown = true;
  startX = e.touches[0].pageX - shopSlider.offsetLeft;
  lastX = e.touches[0].pageX;
  scrollLeft = shopSlider.scrollLeft;
  velocity = 0;
  cancelAnimationFrame(momentumID);
}, {passive:true});
shopSlider.addEventListener('touchmove', (e) => {
  if (!isDown) return;
  const x = e.touches[0].pageX - shopSlider.offsetLeft;
  shopSlider.scrollLeft = scrollLeft - (x - startX);
  velocity = (e.touches[0].pageX - lastX);
  lastX = e.touches[0].pageX;
}, {passive:false});
shopSlider.addEventListener('touchend', () => {
  isDown = false;
  if (Math.abs(velocity) > 2) momentumShop();
}, {passive:true});

// اسکرول نرم و Drag برای پربازدیدترین مغازه شهر
const mostVisitedSlider = document.getElementById('most-visited-shops');
let mvIsDown = false, mvStartX, mvScrollLeft, mvLastX, mvVelocity = 0, mvMomentumID;
function mvMomentum() {
  if (Math.abs(mvVelocity) > 0.4) {
    mostVisitedSlider.scrollLeft -= mvVelocity;
    mvVelocity *= 0.93;
    mvMomentumID = requestAnimationFrame(mvMomentum);
  } else {
    cancelAnimationFrame(mvMomentumID);
    mvVelocity = 0;
  }
}
mostVisitedSlider.addEventListener('mousedown', (e) => {
  mvIsDown = true;
  mvStartX = e.pageX - mostVisitedSlider.offsetLeft;
  mvLastX = e.pageX;
  mvScrollLeft = mostVisitedSlider.scrollLeft;
  mvVelocity = 0;
  cancelAnimationFrame(mvMomentumID);
});
mostVisitedSlider.addEventListener('mousemove', (e) => {
  if (!mvIsDown) return;
  const x = e.pageX - mostVisitedSlider.offsetLeft;
  mostVisitedSlider.scrollLeft = mvScrollLeft - (x - mvStartX);
  mvVelocity = (e.pageX - mvLastX);
  mvLastX = e.pageX;
});
mostVisitedSlider.addEventListener('mouseup', () => {
  mvIsDown = false;
  if (Math.abs(mvVelocity) > 1) mvMomentum();
});
mostVisitedSlider.addEventListener('mouseleave', () => {
  mvIsDown = false;
  if (Math.abs(mvVelocity) > 1) mvMomentum();
});
mostVisitedSlider.addEventListener('touchstart', (e) => {
  mvIsDown = true;
  mvStartX = e.touches[0].pageX - mostVisitedSlider.offsetLeft;
  mvLastX = e.touches[0].pageX;
  mvScrollLeft = mostVisitedSlider.scrollLeft;
  mvVelocity = 0;
  cancelAnimationFrame(mvMomentumID);
}, {passive:true});
mostVisitedSlider.addEventListener('touchmove', (e) => {
  if (!mvIsDown) return;
  const x = e.touches[0].pageX - mostVisitedSlider.offsetLeft;
  mostVisitedSlider.scrollLeft = mvScrollLeft - (x - mvStartX);
  mvVelocity = (e.touches[0].pageX - mvLastX);
  mvLastX = e.touches[0].pageX;
}, {passive:false});
mostVisitedSlider.addEventListener('touchend', () => {
  mvIsDown = false;
  if (Math.abs(mvVelocity) > 2) mvMomentum();
}, {passive:true});







// زکی - نسخه اصلاح شده loadPopularProducts

// زکی – نسخهٔ نهایی loadPopularProducts با
// ✔︎ دسته‌بندی فروشگاه در بالای کارت
// ✔︎ مکان فروشگاه به جای امتیاز ⭐️

async function loadPopularProducts() {
  const slider = document.getElementById('popular-products-slider');
  slider.innerHTML = '<div style="margin: 60px auto;">در حال بارگذاری...</div>';

  try {
    const res = await fetch('http://localhost:5000/api/products/latest-products');
    if (!res.ok) throw new Error('Network error');

    const payload  = await res.json();
    const products = Array.isArray(payload) ? payload : payload.products;

    if (!products?.length) {
      slider.innerHTML =
        '<div class="text-gray-400 text-center w-full p-7">محصولی یافت نشد.</div>';
      return;
    }

    slider.innerHTML = ''; // پاک کردن لودر

    products.forEach(p => {
      const cat  = p.sellerCategory || p.category || 'نامشخص';
      const loc  = p.sellerLocation || '—';
      const img  = p.images?.[0] ?? 'assets/images/no-image.png';
      const priceText = (p.price ?? 0).toLocaleString() + ' تومان';

      const card = document.createElement('a');
      card.href = p._id ? `product.html?id=${p._id}` : '#';  // اصلاح: هدایت به صفحه محصول بر اساس ID
      card.target = '_blank';  // اصلاح: باز شدن در تب جدید
      card.className = `
        group glass min-w-[265px] max-w-xs flex-shrink-0 flex flex-col items-center
        p-4 rounded-2xl shadow-2xl border-2 border-[#0ea5e9]/20 hover:scale-[1.04] hover:shadow-2xl hover:border-[#0ea5e9]/40
        bg-white/95 backdrop-blur-[5px] transition-all duration-300 center-card
      `;

      card.innerHTML = `
        <!-- تصویر محصول -->
        <div class="w-full h-[130px] sm:h-[170px] rounded-xl mb-5 flex items-center justify-center relative overflow-hidden"
             style="background:linear-gradient(120deg,#d4fbe8,#e0fdfa,#c8f7e6); box-shadow:inset 0 2px 10px rgba(16,185,129,0.1);">
          <img src="${img}" alt="${p.title}"
               class="w-full h-full object-cover group-hover:brightness-105 transition-all duration-300"/>
          <!-- تگ دسته‌بندی فروشگاه -->
          <span class="absolute top-2 right-2 text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-[#10b981] to-[#0ea5e9] text-white shadow-md">
            ${cat}
          </span>
        </div>

        <!-- عنوان محصول -->
        <h4 class="font-extrabold text-lg sm:text-xl bg-gradient-to-r from-[#10b981] to-[#0ea5e9] bg-clip-text text-transparent text-center mb-2 line-clamp-2">
          ${p.title}
        </h4>

        <!-- مکان فروشگاه -->
        <div class="flex items-center gap-1 mb-3">
          <svg width="18" height="18" fill="none" viewBox="0 0 22 22">
            <circle cx="11" cy="11" r="10" fill="#e0f7fa"/>
            <path d="M11 2.5C7.13 2.5 4 5.61 4 9.45c0 3.52 4.1 7.93 6.2 10.01.46.47 1.2.47 1.66 0
                     2.1-2.08 6.14-6.49 6.14-10.01C18 5.61 14.87 2.5 11 2.5Z"
                  fill="#10b981"/>
            <circle cx="11" cy="9" r="2.5" fill="#0ea5e9"/>
          </svg>
          <span class="text-gray-700 text-sm font-bold truncate max-w-[160px]">${loc}</span>
        </div>

        <!-- قیمت -->
        <div class="inline-block bg-gradient-to-r from-[#10b981]/10 to-[#0ea5e9]/10 px-4 py-1 rounded-full text-[#10b981] font-extrabold text-base shadow-sm">
          ${priceText}
        </div>
      `;
      slider.appendChild(card);
    });
  } catch (err) {
    slider.innerHTML =
      '<div class="text-red-500 text-center w-full p-7">مشکلی در بارگذاری محصولات پیش آمد.</div>';
    console.error(err);
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
  slider.innerHTML = '<div style="margin:60px auto;">در حال بارگذاری...</div>';
  try {
    const res = await fetch('/api/shops');
    if (!res.ok) throw new Error('network');
    const data = await res.json();
    const shopsAll = Array.isArray(data) ? data : [];
    const shops = shopsAll
      .filter(s => /بانتا/i.test(s.address || ''))
      .slice(0, 4);
    slider.innerHTML = '';
    if (!shops.length) {
      slider.innerHTML = '<p class="text-gray-500 text-center py-8">هیچ مغازه‌ای برای بانتا یافت نشد.</p>';
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
      `;
      slider.appendChild(card);
    });
  } catch (err) {
    slider.innerHTML = '<p class="text-red-500 text-center py-8">خطا در دریافت اطلاعات. لطفا دوباره تلاش کنید.</p>';
  }
}

window.addEventListener('DOMContentLoaded', loadBantaShops);


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
  if (!centers.length) {
    slider.innerHTML = "<div style='color:#bbb; margin:70px auto; font-size:1.2rem;'>هنوز مرکز خریدی ثبت نشده!</div>";
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
    `;
    slider.appendChild(card);
  });
}

// گرفتن دیتا از سرور و نمایش
fetch(API_URL, FETCH_OPTIONS)
  .then(res => res.json())
  .then(centers => {
    renderSliderCenters(centers);
  })
  .catch(err => {
    document.getElementById('shopping-centers-slider').innerHTML = "<div style='color:#ff0000;'>خطا در دریافت مراکز خرید!</div>";
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


window.showAdBannerPopup = async function() {
  console.log("⏺️ شروع showAdBannerPopup");
  const adSlot = document.getElementById('ad-banner-slot-popup');
  if (!adSlot) {
    console.error("❌ عنصر ad-banner-slot-popup پیدا نشد!");
    return;
  }
  adSlot.innerHTML = '<div style="padding:32px 0;text-align:center;">در حال دریافت تبلیغ...</div>';
  const popup = document.getElementById('adPopup');
  if (!popup) {
    console.error("❌ عنصر adPopup پیدا نشد!");
    return;
  }
  popup.style.display = 'block';

  try {
    console.log("⏳ ارسال درخواست fetch برای تبلیغ...");
const res = await fetch('http://localhost:5000/api/adOrder/active?planSlug=ad_search');
    console.log("✅ پاسخ اولیه fetch دریافت شد", res);

    if (!res.ok) {
      console.error("❌ پاسخ سرور غیرموفق بود:", res.status);
      adSlot.innerHTML = '';
      popup.style.display = 'none';
      return;
    }

    const data = await res.json();
    console.log("📦 داده دریافتی از API:", data);

    // فقط تبلیغات مربوط به سرچ باکس
    const searchAds = data.ads && Array.isArray(data.ads)
      ? data.ads.filter(ad => ad.planSlug === 'ad_search')
      : [];

    if (!data.success || !searchAds.length) {
      console.warn("⚠️ هیچ تبلیغ فعالی مخصوص سرچ دریافت نشد.");
      adSlot.innerHTML = '';
      popup.style.display = 'none';
      return;
    }

    const ad = searchAds[0];
    console.log("🎯 تبلیغ انتخاب شده:", ad);

    let targetUrl = '#';
    if (ad.productId) targetUrl = `product.html?id=${ad.productId}`;
    else if (ad.sellerId) targetUrl = `shop.html?id=${ad.sellerId}`;

    adSlot.innerHTML = `
      <a href="${targetUrl}" style="display:block;padding:18px;text-align:right;text-decoration:none;">
        <div style="display:flex;align-items:center;gap:20px;">
          <div style="
            width:90px;height:90px;
            border-radius:0;
            overflow:hidden;
            border:1.5px solid #10b98133;
            display:flex;
            align-items:center;
            justify-content:center;
            flex-shrink:0;
            background:none;
            box-shadow:none;
          ">
            ${
              ad.bannerImage
                ? `<img src="/uploads/${ad.bannerImage}"
                       style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;">`
                : `<span style="font-size:22px;color:#10b981;font-weight:bold;">AD</span>`
            }
          </div>
          <div style="flex:1;">
            <div style="font-weight:900;font-size:1.14rem;color:#10b981">${ad.adTitle || 'تبلیغ ویژه فروشگاه'}</div>
            <div style="font-size:.98rem;color:#555;margin-top:3px;">${ad.adText || ''}</div>
          </div>
        </div>
      </a>
    `;
  } catch (e) {
    console.error("❌ خطا در دریافت یا نمایش تبلیغ:", e);
    adSlot.innerHTML = '';
    popup.style.display = 'none';
  }
};




document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.querySelector('input[type="text"][placeholder^="جستجو"]');
  const adPopup = document.getElementById('adPopup');
  const closeAdBtn = document.getElementById('closeAdBtn');

  // رویداد باز شدن پاپ‌آپ
  if (searchInput) {
    searchInput.addEventListener('focus', window.showAdBannerPopup);
    searchInput.addEventListener('click', window.showAdBannerPopup);
  } else {
    console.error("❌ input جستجو پیدا نشد!");
  }

  // بستن با دکمه
  if (closeAdBtn) {
    closeAdBtn.onclick = function() {
      adPopup.style.display = 'none';
    };
  } else {
    console.error("❌ دکمه بستن تبلیغ پیدا نشد!");
  }

  // بستن با تایپ در سرچ
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      adPopup.style.display = 'none';
    });
  }

  // بستن با کلیک بیرون از پاپ‌آپ
  document.addEventListener('mousedown', function(e) {
    // فقط وقتی پاپ‌آپ بازه و روی خود پاپ‌آپ یا محتواش کلیک نشده و روی input سرچ هم کلیک نشده:
    if (
      adPopup.style.display !== 'none' &&
      !adPopup.contains(e.target) &&
      e.target !== searchInput
    ) {
      adPopup.style.display = 'none';
    }
  });
});

// جابجایی لینک‌های ناوبری بین هدر و فوتر موبایل
document.addEventListener('DOMContentLoaded', function() {
  const desktopNav = document.getElementById('desktopNav');
  const mobileList = document.getElementById('mobileNavList');
  const registerBtn = document.getElementById('registerShopBtn');
  const links = Array.from(desktopNav.querySelectorAll('.main-nav-link'));

  function moveLinks() {
    if (window.innerWidth <= 768) {
      links.forEach(l => {
        if (!mobileList.contains(l)) {
          l.classList.remove('hide-on-mobile');
          mobileList.appendChild(l);
        }
      });
      highlightActive();
    } else {
      links.forEach(l => {
        if (!desktopNav.contains(l)) {
          l.classList.add('hide-on-mobile');
          desktopNav.insertBefore(l, registerBtn);
        }
      });
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