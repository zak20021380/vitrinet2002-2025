const mockShops = [
  {
    id: 1,
    name: 'بوتیک نیلوفر',
    category: 'پوشاک',
    city: 'سنندج',
    rating: 4.7,
    badge: 'ویژه',
    description: 'ارائه‌کننده پوشاک زنانه دست‌دوز با پارچه‌های ایرانی و تحویل در همان روز.',
    tags: ['پوشاک زنانه', 'دوخت سفارشی', 'تحویل سریع'],
    launchedAt: '2024-09-12'
  },
  {
    id: 2,
    name: 'خانه هوشمند آریو',
    category: 'الکترونیک',
    city: 'تهران',
    rating: 4.9,
    badge: 'Vitreenet Pro',
    description: 'نصب و پشتیبانی سیستم‌های هوشمند سازی منازل و محل کار با گارانتی رسمی.',
    tags: ['اتوماسیون', 'دوربین امنیتی', 'پشتیبانی ۲۴/۷'],
    launchedAt: '2025-01-03'
  },
  {
    id: 3,
    name: 'سالن زیبایی المیرا',
    category: 'زیبایی',
    city: 'کرمانشاه',
    rating: 4.3,
    badge: 'مورد اعتماد',
    description: 'ارائه جدیدترین خدمات رنگ، کراتین و گریم عروس با تیم متخصص.',
    tags: ['آرایش عروس', 'کراتین', 'بسته‌های VIP'],
    launchedAt: '2024-07-21'
  },
  {
    id: 4,
    name: 'تعمیرات خانگی آرتا',
    category: 'خدمات خانگی',
    city: 'تبریز',
    rating: 4.1,
    badge: 'محبوب',
    description: 'گروه تخصصی نصب و تعمیر لوازم خانگی با ضمانت قطعات اصلی.',
    tags: ['نصب لوازم', 'تعمیر تخصصی', 'ضمانت ۹۰ روزه'],
    launchedAt: '2024-05-18'
  }
];

const mockPortfolios = [
  {
    id: 101,
    title: 'دکوراسیون بوتیک پاییز ۱۴۰۳',
    shop: 'بوتیک نیلوفر',
    cover: 'linear-gradient(135deg,#0ea5e9,#10b981)',
    category: 'پوشاک',
    summary: 'طراحی vitreenet برای ویترین جدید همراه نورپردازی مدرن.',
    likes: 68
  },
  {
    id: 102,
    title: 'پروژه هوشمندسازی آپارتمان سپیدار',
    shop: 'خانه هوشمند آریو',
    cover: 'linear-gradient(135deg,#38bdf8,#1d4ed8)',
    category: 'الکترونیک',
    summary: 'کنترل روشنایی، سیستم امنیتی و سناریوهای انرژی برای ۱۲ واحد.',
    likes: 94
  },
  {
    id: 103,
    title: 'پکیج عروس پاییزی',
    shop: 'سالن زیبایی المیرا',
    cover: 'linear-gradient(135deg,#f472b6,#db2777)',
    category: 'زیبایی',
    summary: 'به‌روزرسانی کامل رنگ، استایل مو و میکاپ سبک اروپایی.',
    likes: 52
  },
  {
    id: 104,
    title: 'نصب سیستم سرمایش فروشگاه',
    shop: 'تعمیرات خانگی آرتا',
    cover: 'linear-gradient(135deg,#fbbf24,#f59e0b)',
    category: 'خدمات خانگی',
    summary: 'طراحی و اجرای سیستم سرمایش صنعتی با مانیتورینگ انرژی.',
    likes: 41
  }
];

const filtersState = {
  search: '',
  category: 'all',
  city: 'all',
  rating: 'all',
  sort: 'featured'
};

function applyFilters() {
  let result = [...mockShops];

  if (filtersState.search.trim()) {
    const keyword = filtersState.search.trim().toLowerCase();
    result = result.filter((shop) =>
      shop.name.toLowerCase().includes(keyword) ||
      shop.description.toLowerCase().includes(keyword)
    );
  }

  if (filtersState.category !== 'all') {
    result = result.filter((shop) => shop.category === filtersState.category);
  }

  if (filtersState.city !== 'all') {
    result = result.filter((shop) => shop.city === filtersState.city);
  }

  if (filtersState.rating !== 'all') {
    const minRating = parseFloat(filtersState.rating);
    result = result.filter((shop) => shop.rating >= minRating);
  }

  if (filtersState.sort === 'rating') {
    result.sort((a, b) => b.rating - a.rating);
  } else if (filtersState.sort === 'newest') {
    result.sort((a, b) => new Date(b.launchedAt) - new Date(a.launchedAt));
  } else {
    result.sort((a, b) => (b.rating + (b.badge === 'Vitreenet Pro' ? 0.2 : 0)) - (a.rating + (a.badge === 'Vitreenet Pro' ? 0.2 : 0)));
  }

  renderResults(result);
}

function renderResults(data) {
  const grid = document.getElementById('results-grid');
  if (!grid) return;
  let cardsHTML = '';

  data.forEach((shop) => {
    const tagsHTML = shop.tags.map((tag) => `<span class="tag-chip">${tag}</span>`).join('');
    cardsHTML += `
      <article class="service-card" data-shop-id="${shop.id}">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="service-card__badge">${shop.badge}</p>
            <h3 class="text-xl font-black text-slate-900 mt-2">${shop.name}</h3>
            <p class="text-sm text-gray-500 font-semibold">${shop.category} • ${shop.city}</p>
          </div>
          <span class="rating-pill">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3.3 14.9 9l6.1.9-4.4 4.6 1 6.2L12 17.9 6.4 20.7l1-6.2L3 9.9 9.1 9l2.9-5.7Z" stroke="#facc15" stroke-width="1.4" fill="none"/>
            </svg>
            ${shop.rating.toFixed(1)}
          </span>
        </div>
        <p class="text-gray-600 leading-relaxed font-medium">${shop.description}</p>
        <div class="service-card__tags">${tagsHTML}</div>
        <div class="flex items-center justify-between pt-2">
          <div class="text-sm font-bold text-emerald-500">همکاری با ویترینت از ${new Date(shop.launchedAt).toLocaleDateString('fa-IR')}</div>
          <button class="btn-grad px-4 py-2 rounded-full text-sm font-extrabold">رزرو سریع</button>
        </div>
      </article>
    `;
  });

  grid.innerHTML = '';
  const temp = document.createElement('div');
  temp.innerHTML = cardsHTML.trim();
  while (temp.firstChild) {
    grid.appendChild(temp.firstChild);
  }
}

function renderPortfolioShowcase(items) {
  const grid = document.getElementById('portfolio-grid');
  if (!grid) return;
  let cardsHTML = '';

  items.forEach((item) => {
    cardsHTML += `
      <article class="portfolio-card" data-portfolio-id="${item.id}">
        <div class="portfolio-thumb" style="background-image:${item.cover};" aria-hidden="true"></div>
        <div>
          <p class="text-sm font-bold text-sky-500">${item.category}</p>
          <h3 class="text-xl font-black text-slate-900 mt-1">${item.title}</h3>
          <p class="text-gray-600 font-medium mt-1">${item.summary}</p>
        </div>
        <div class="portfolio-meta">
          <span>${item.shop}</span>
          <span class="flex items-center gap-1 text-rose-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.1 5.3c1.4-1.8 4.2-2 5.8-.3 1.7 1.7 1.7 4.5 0 6.2L12 17l-5.9-5.8c-1.7-1.7-1.7-4.5 0-6.2 1.6-1.7 4.4-1.5 5.8.3Z" stroke="#f43f5e" stroke-width="1.4" fill="none"/>
            </svg>
            ${item.likes}
          </span>
        </div>
      </article>
    `;
  });

  grid.innerHTML = '';
  const temp = document.createElement('div');
  temp.innerHTML = cardsHTML.trim();
  while (temp.firstChild) {
    grid.appendChild(temp.firstChild);
  }
}

function attachEvents() {
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const cityFilter = document.getElementById('cityFilter');
  const ratingFilter = document.getElementById('ratingFilter');
  const sortSelect = document.getElementById('sortSelect');
  const resetBtn = document.getElementById('resetFilters');

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      filtersState.search = event.target.value;
      applyFilters();
    });
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', (event) => {
      filtersState.category = event.target.value;
      applyFilters();
    });
  }

  if (cityFilter) {
    cityFilter.addEventListener('change', (event) => {
      filtersState.city = event.target.value;
      applyFilters();
    });
  }

  if (ratingFilter) {
    ratingFilter.addEventListener('change', (event) => {
      filtersState.rating = event.target.value;
      applyFilters();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (event) => {
      filtersState.sort = event.target.value;
      applyFilters();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      filtersState.search = '';
      filtersState.category = 'all';
      filtersState.city = 'all';
      filtersState.rating = 'all';
      filtersState.sort = 'featured';
      if (searchInput) searchInput.value = '';
      if (categoryFilter) categoryFilter.value = 'all';
      if (cityFilter) cityFilter.value = 'all';
      if (ratingFilter) ratingFilter.value = 'all';
      if (sortSelect) sortSelect.value = 'featured';
      applyFilters();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderResults(mockShops);
  renderPortfolioShowcase(mockPortfolios);
  attachEvents();
});
