# vitrinet2002-2025

**Vitreenet** – آخرین نسخهٔ سایت  
Tech: HTML/CSS/JS (Tailwind), موبایل‌فرست، RTL

## Dev
- نصب: `npm i`
- اجرا: `npm run dev`

## Deploy
- Build: `npm run build`

## مدیریت ردیف‌های صفحه اصلی
- منبع داده در `data/homeRows.json` ذخیره می‌شود و لاگ تغییرات در `data/homeRows-audit.log` ثبت خواهد شد.
- API های قابل استفاده:
  - `GET /api/home/rows`
  - `POST /api/home/rows` (ادمین، ایجاد ردیف جدید)
  - `PUT /api/home/rows/:id` (ادمین، ویرایش)
  - `DELETE /api/home/rows/:id` (ادمین، حذف)
  - `PATCH /api/home/rows/reorder` (ادمین، جابجایی ترتیب)
- برای مدیریت UI به داشبورد ادمین (`admin/dashboard.html`) مراجعه کنید؛ کامپوننت «AdminHomeRowsManager» با درگ‌اَند‌دراپ و فرم‌های اعتبارسنجی درجا پیاده‌سازی شده است.
- رندر صفحهٔ اصلی (`public/index.html`) از همین API مصرف می‌کند و هر ۴۵ ثانیه به‌روزرسانی می‌شود.

## تست‌ها
- تست‌های واحد و انتها‌به‌انتها در دایرکتوری `backend/tests` قرار دارند.
- اجرای تست‌ها: `cd backend && npm test`
