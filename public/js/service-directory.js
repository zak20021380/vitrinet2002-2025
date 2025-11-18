// Mock data for shops
const mockShops = [
  {
    id: 1,
    name: '"1'Ì4¯'G E1/'FG "1Ì'',
    category: 'barbershop',
    description: ''1'&G ./E'* '5D'- ©H*'GÌ EH H 1F¯ (' (G*1ÌF ©ÌAÌ*',
    location: '.Ì'('F ~'3/'1'F ©H†G GA*E',
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="250"%3E%3Crect fill="%2310b981" width="400" height="250"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="24" font-weight="bold" font-family="Vazirmatn,sans-serif"%3E"1'Ì4¯'G "1Ì'%3C/text%3E%3C/svg%3E'
  },
  {
    id: 2,
    name: '©'1H'4 VIP ~'13Ì'F',
    category: 'carwash',
    description: '43*4H H'©3 H ~HDÌ4 (' *,GÌ2'* E/1F H ©'/1 -1AG'Ì',
    location: '(DH'1 "2'/Ì 1H(1HÌ ~'1© 4G1',
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="250"%3E%3Crect fill="%230ea5e9" width="400" height="250"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="24" font-weight="bold" font-family="Vazirmatn,sans-serif"%3E©'1H'4 ~'13Ì'F%3C/text%3E%3C/svg%3E'
  },
  {
    id: 3,
    name: '"1'Ì4¯'G E1/'FG 16'',
    category: 'barbershop',
    description: '(Ì4 '2 15 3'D 3'(BG /1 ./E'* 2Ì('ÌÌ E1/'FG',
    location: 'EÌ/'F 'FBD'( ,F( ('F© EDÌ',
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="250"%3E%3Crect fill="%2314b8a6" width="400" height="250"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="24" font-weight="bold" font-family="Vazirmatn,sans-serif"%3E"1'Ì4¯'G 16'%3C/text%3E%3C/svg%3E'
  },
  {
    id: 4,
    name: '©'1H'4 '©3~13 FHÌF',
    category: 'carwash',
    description: '43*4HÌ ©'ED /1 ©E*1 '2 30 /BÌBG (' 6E'F* ©ÌAÌ*',
    location: ''*H('F 'E'E 9DÌ F(4 ©H†G 12',
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="250"%3E%3Crect fill="%2338bdf8" width="400" height="250"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="24" font-weight="bold" font-family="Vazirmatn,sans-serif"%3E©'1H'4 FHÌF%3C/text%3E%3C/svg%3E'
  }
];

// Mock data for portfolios
const mockPortfolios = [
  {
    id: 1,
    shopName: '"1'Ì4¯'G E1/'FG "1Ì'',
    title: ''5D'- ©D'3Ì© (' 1Ì4 AÌ/',
    description: ''5D'- -1AG'Ì (' '3*A'/G '2 *Ì: ©D'3Ì© H E-5HD'* '1¯'FÌ©',
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%2310b981" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="20" font-weight="bold" font-family="Vazirmatn,sans-serif"%3E'5D'- ©D'3Ì©%3C/text%3E%3C/svg%3E'
  },
  {
    id: 2,
    shopName: '©'1H'4 VIP ~'13Ì'F',
    title: '43*4HÌ ©'ED H H'©3 (/FG',
    description: '.H/1H 4E' E+D FH EÌ4H/! H'©3 H ~HDÌ4 (' /3*¯'GG'Ì 1H2 /FÌ'',
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%230ea5e9" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="20" font-weight="bold" font-family="Vazirmatn,sans-serif"%3E43*4HÌ ©'ED%3C/text%3E%3C/svg%3E'
  },
  {
    id: 3,
    shopName: '"1'Ì4¯'G E1/'FG 16'',
    title: '©H*'GÌ E/D AÌ/ "E1Ì©'ÌÌ',
    description: ',/Ì/*1ÌF E/DG'Ì 1H2 /FÌ' (' /3*G'Ì .(1G',
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%2314b8a6" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="20" font-weight="bold" font-family="Vazirmatn,sans-serif"%3EAÌ/ "E1Ì©'ÌÌ%3C/text%3E%3C/svg%3E'
  },
  {
    id: 4,
    shopName: '©'1H'4 '©3~13 FHÌF',
    title: '43*4HÌ EH*H1 H 2Ì1 4'3Ì',
    description: '*EÌ2©'1Ì ©'ED EH*H1 H '*'B (' EH'/ '3*'F/'1/',
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%2338bdf8" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="20" font-weight="bold" font-family="Vazirmatn,sans-serif"%3E43*4HÌ EH*H1%3C/text%3E%3C/svg%3E'
  }
];

// Category labels
const categoryLabels = {
  'barbershop': '"1'Ì4¯'G E1/'FG',
  'carwash': '©'1H'4',
  'beauty': '2Ì('ÌÌ',
  'services': './E'*'
};

// State
let filteredShops = [...mockShops];

// Render results using appendChild loop (CRITICAL: Cards must be direct children)
function renderResults() {
  const grid = document.getElementById('results-grid');
  const resultsCount = document.getElementById('resultsCount');

  if (!grid) return;

  // Clear grid
  grid.innerHTML = '';

  // Update count
  if (resultsCount) {
    resultsCount.textContent = `${filteredShops.length} F*Ì,G`;
  }

  if (filteredShops.length === 0) {
    grid.innerHTML = '<p class="col-span-full text-center text-gray-500 py-10">GÌ† F*Ì,G'Ì Ì'A* F4/</p>';
    return;
  }

  // Build all cards HTML
  const cardsHTML = filteredShops.map(shop => `
    <div class="service-card">
      <div class="service-card__image">
        <img src="${shop.image}" alt="${shop.name}" loading="lazy" />
      </div>
      <span class="service-card__category">${categoryLabels[shop.category] || shop.category}</span>
      <h3 class="service-card__title">${shop.name}</h3>
      <p class="service-card__description">${shop.description}</p>
      <div class="service-card__location">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
        </svg>
        <span>${shop.location}</span>
      </div>
      <a href="#" class="service-card__cta">E4'G/G ,2&Ì'*</a>
    </div>
  `).join('');

  // Create temp container and convert HTML to DOM nodes
  const temp = document.createElement('div');
  temp.innerHTML = cardsHTML;

  // Append each child directly to grid (CRITICAL)
  while (temp.firstChild) {
    grid.appendChild(temp.firstChild);
  }
}

// Render portfolio showcase using appendChild loop
function renderPortfolioShowcase() {
  const grid = document.getElementById('portfolio-grid');

  if (!grid) return;

  // Clear grid
  grid.innerHTML = '';

  if (mockPortfolios.length === 0) {
    grid.innerHTML = '<p class="col-span-full text-center text-gray-500 py-10">GÌ† FEHFG©'1Ì Ì'A* F4/</p>';
    return;
  }

  // Build all cards HTML
  const cardsHTML = mockPortfolios.map(portfolio => `
    <div class="portfolio-card">
      <div class="portfolio-card__image">
        <img src="${portfolio.image}" alt="${portfolio.title}" loading="lazy" />
      </div>
      <span class="portfolio-card__shop">${portfolio.shopName}</span>
      <h3 class="portfolio-card__title">${portfolio.title}</h3>
      <p class="portfolio-card__description">${portfolio.description}</p>
    </div>
  `).join('');

  // Create temp container and convert HTML to DOM nodes
  const temp = document.createElement('div');
  temp.innerHTML = cardsHTML;

  // Append each child directly to grid (CRITICAL)
  while (temp.firstChild) {
    grid.appendChild(temp.firstChild);
  }
}

// Apply filters
function applyFilters() {
  const categoryFilter = document.getElementById('categoryFilter');
  const searchInput = document.getElementById('searchInput');

  const selectedCategory = categoryFilter ? categoryFilter.value : '';
  const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';

  // Filter shops
  filteredShops = mockShops.filter(shop => {
    // Category filter
    if (selectedCategory && shop.category !== selectedCategory) {
      return false;
    }

    // Search filter
    if (searchQuery && !shop.name.toLowerCase().includes(searchQuery)) {
      return false;
    }

    return true;
  });

  // Re-render results
  renderResults();
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  // Initial render
  renderResults();
  renderPortfolioShowcase();

  // Attach event listeners
  const applyFilterBtn = document.getElementById('applyFilterBtn');
  const categoryFilter = document.getElementById('categoryFilter');
  const searchInput = document.getElementById('searchInput');

  if (applyFilterBtn) {
    applyFilterBtn.addEventListener('click', applyFilters);
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', applyFilters);
  }

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      // Debounce search
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(applyFilters, 300);
    });
  }

  // Check URL parameters for category filter
  const urlParams = new URLSearchParams(window.location.search);
  const categoryParam = urlParams.get('category');

  if (categoryParam && categoryFilter) {
    categoryFilter.value = categoryParam;
    applyFilters();
  }
});
