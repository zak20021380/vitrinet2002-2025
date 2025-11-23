document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const themeBtn = document.getElementById('toggleTheme');
  if (!themeBtn) {
    return;
  }

  let dark = localStorage.getItem('admin_theme_dark') === '1';
  if (dark) {
    body.classList.add('dark');
  }

  const updateThemeIcon = () => {
    themeBtn.innerHTML = dark
      ? '<i class="ri-sun-line"></i>'
      : '<i class="ri-moon-clear-line"></i>';
  };

  updateThemeIcon();

  themeBtn.addEventListener('click', () => {
    body.classList.toggle('dark');
    dark = body.classList.contains('dark');
    localStorage.setItem('admin_theme_dark', dark ? '1' : '0');
    updateThemeIcon();
  });

  const form = document.getElementById('adminLoginForm');
  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const phoneInput = document.getElementById('phone');
    const passwordInput = document.getElementById('password');
    const errorDiv = document.getElementById('loginError');

    if (!phoneInput || !passwordInput || !errorDiv) {
      return;
    }

    const phone = phoneInput.value.trim();
    const password = passwordInput.value;
    errorDiv.textContent = '';

    try {
      const res = await fetch('http://localhost:5000/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, password })
      });

      const data = await res.json();

      if (res.ok) {
        try {
          if (data && data.token) {
            localStorage.setItem('admin_token', data.token);
          } else {
            localStorage.removeItem('admin_token');
          }
        } catch (storageErr) {
          console.warn('⚠️  Unable to persist admin token locally', storageErr);
        }
        window.location.href = 'dashboard.html';
      } else {
        errorDiv.textContent = data.message || 'ورود ناموفق بود. لطفاً اطلاعات را درست وارد کنید.';
      }
    } catch (error) {
      errorDiv.textContent = 'ارتباط با سرور برقرار نشد!';
    }
  });
});
