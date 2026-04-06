# Task 1.1.1 — Xác minh scaffold (Laravel 11 + React + Vite)

## Chuẩn bị một lần

```bash
cd /var/www/signalfeed
cp .env.example .env
php artisan key:generate
composer install
npm install
```

> **Sanctum:** `HasApiTokens` đã gắn trên `User`. Bảng `personal_access_tokens` sẽ có khi chạy migration Sanctum ở task schema (1.2.x) — không yêu cầu migrate cho bước verify này.

## Chạy dev (hai terminal)

**Terminal A — Vite (HMR):**

```bash
cd /var/www/signalfeed
npm run dev
```

Kỳ vọng: `http://localhost:5173` — Vite phục vụ asset; với Laravel, SPA được xem qua Laravel (bước B).

**Terminal B — Laravel:**

```bash
cd /var/www/signalfeed
php artisan serve
```

Mở **`http://127.0.0.1:8000`** (hoặc `http://localhost:8000`): trang React qua Blade `resources/views/app.blade.php` + `@vite`.

## Checklist verify

- [ ] `npm run dev` chạy không lỗi; cổng 5173 listen.
- [ ] `php artisan serve` boot được; không exception khi load `/`.
- [ ] Trình duyệt: không lỗi console nghiêm trọng; chỉnh `resources/js/app.jsx` → HMR cập nhật sau refresh (F5) nếu load qua Laravel.

## Build production asset (tuỳ chọn)

```bash
npm run build
php artisan serve
```

## CORS + Sanctum (dev)

- `config/cors.php`: `paths` gồm `api/*`, `sanctum/csrf-cookie`; `supports_credentials: true`; origin mặc định `FRONTEND_URL` (`http://localhost:5173`).
- `SANCTUM_STATEFUL_DOMAINS` trong `.env` khớp host dev (đã mẫu trong `.env.example`).

## Lệnh hữu ích

```bash
php artisan route:list
php artisan config:show cors
```
