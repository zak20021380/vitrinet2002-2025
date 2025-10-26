/* daily-visits.js – نسخهٔ نهایی: مقایسهٔ دقیق روز/هفته/ماه در منطقهٔ محلی */
(() => {
  /* ─── ثابت‌ها ─── */
  const API_CFG = window.VITRINET_API || null;
  const API_URL = API_CFG ? API_CFG.buildUrl('/api/daily-visits') : 'http://localhost:5000/api/daily-visits';
  const withCreds = (init = {}) => {
    if (API_CFG) return API_CFG.ensureCredentials(init);
    if (init.credentials === undefined) {
      return { ...init, credentials: 'include' };
    }
    return init;
  };
  const DAY = 86_400_000; // ms

  /* ─── فانکشن‌های کمکی ─── */
  const $    = id => document.getElementById(id);
  const toFa = n  => (+n || 0).toLocaleString('fa-IR');

  /** تاریخ جاوااسکریپتی → YYYY‑MM‑DD به‌وقت محلی */
  const toLocalISO = d => {
    const t = new Date(d);
    const y = t.getFullYear(), m = t.getMonth() + 1, day = t.getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  /** پارس تاریخ YYYY‑MM‑DD (همیشه به‌وقت محلی) */
  const parseLocalYMD = s => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);               // local midnight
  };

  /** بررسی اینکه dateStr همان روزِ امروز است */
  const isToday = s => {
    const d = parseLocalYMD(s);
    const now = new Date();
    return d.getFullYear() === now.getFullYear()
        && d.getMonth()    === now.getMonth()
        && d.getDate()     === now.getDate();
  };

  /** تفاوت روزهای دو تاریخ محلی */
  const diffDays = (d1, d2) => Math.round(
    (parseLocalYMD(d1) - parseLocalYMD(d2)) / DAY
  );

  const todayStr = () => toLocalISO(Date.now());
  const monthKey = s   => s.slice(0, 7);  // YYYY‑MM

  /* ─── وضعیت ─── */
  let visits = []; // { date:'YYYY‑MM‑DD', count:Number }

  /* ─── بارگیری از API ─── */
  async function loadVisits () {
    try {
      const res = await fetch(API_URL, withCreds());
      if (!res.ok) throw new Error(res.status);

      const data = await res.json();
      visits = data.map(v => ({
        date  : toLocalISO(v.date),  // تبدیل به محلی
        count : +v.count || 0
      }));
    } catch (err) {
      console.error('API error', err);
      visits = [];
      alert('خطا در دریافت آمار از سرور.');
    }
    refreshUI();
  }

  /* ─── رفرش رابط ─── */
  function refreshUI () {
    updateCards();
    renderWeekTable();
    renderMonthTotals();
  }

  /* ─── کارت‌های آمار ─── */
  function updateCards () {
    // کل
    $('totalVisits').textContent = toFa(
      visits.reduce((s, v) => s + v.count, 0)
    );

    // امروز
    const todaySum = visits.reduce((s, v) => isToday(v.date) ? s + v.count : s, 0);
    $('todayVisits').textContent = toFa(todaySum);

    // ۷ روز اخیر (۰ تا ۶ روز اختلاف)
    const weekSum = visits.reduce((s, v) => {
      const diff = -diffDays(v.date, todayStr()); // منفی => گذشته
      return diff >= 0 && diff < 7 ? s + v.count : s;
    }, 0);
    $('weekVisits').textContent = toFa(weekSum);

    // ماه جاری
    const curMonth = monthKey(todayStr());
    const monthSum = visits.reduce((s, v) => monthKey(v.date) === curMonth ? s + v.count : s, 0);
    $('monthVisits').textContent = toFa(monthSum);
  }

  /* ─── جدول هفت‌روزه (تجمیع) ─── */
  function renderWeekTable () {
    const tbody = $('visitTableBody');
    tbody.innerHTML = '';

    // تجمیع
    const daily = {};
    visits.forEach(v => {
      const diff = -diffDays(v.date, todayStr());
      if (diff >= 0 && diff < 7)
        daily[v.date] = (daily[v.date] || 0) + v.count;
    });

    Object.entries(daily)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // نزولی
      .forEach(([d, cnt]) => {
        tbody.insertAdjacentHTML('beforeend',
          `<tr>
            <td>${parseLocalYMD(d).toLocaleDateString('fa-IR')}</td>
            <td>${toFa(cnt)}</td>
           </tr>`
        );
      });
  }

  /* ─── جدول ماهانه ─── */
  function renderMonthTotals () {
    const tbody = $('monthTotalsBody');
    if (!tbody) return;

    const groups = {};
    visits.forEach(v => {
      const k = monthKey(v.date);
      groups[k] = (groups[k] || 0) + v.count;
    });

    tbody.innerHTML = '';
    Object.entries(groups)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .forEach(([m, cnt]) => {
        const [y, mn] = m.split('-');
        tbody.insertAdjacentHTML('beforeend',
          `<tr><td>${toFa(y)} / ${toFa(mn)}</td><td>${toFa(cnt)}</td></tr>`
        );
      });
  }

  /* ─── ارسال فرم ─── */
  $('dailyVisitForm').addEventListener('submit', async e => {
    e.preventDefault();
    const cnt = +$('visitCount').value;
    if (isNaN(cnt) || cnt < 0) return alert('عدد معتبر وارد کنید!');

    const payload = { date: todayStr(), count: cnt };

    try {
      const res = await fetch(API_URL, withCreds({
        method  : 'POST',
        headers : { 'Content-Type': 'application/json' },
        body    : JSON.stringify(payload)
      }));
      if (!res.ok) {
        const { message } = await res.json().catch(()=>({}));
        throw new Error(message || 'خطای سرور');
      }

      const saved = await res.json();          // { date, count }
      const iso   = toLocalISO(saved.date);

      const ex = visits.find(v => v.date === iso);
      if (ex) ex.count = saved.count;
      else visits.push({ date: iso, count: saved.count });

      refreshUI();

      $('visitCount').value = '';
      $('successMessage').classList.remove('hidden');
      setTimeout(() => $('successMessage').classList.add('hidden'), 1800);

    } catch (err) {
      console.error(err);
      alert(err.message || 'ارسال ناموفق بود');
    }
  });

  /* ─── شروع ─── */
  loadVisits();
})();
