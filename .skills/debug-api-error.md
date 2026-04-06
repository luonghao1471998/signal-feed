# Skill: Debug lỗi API (SignalFeed)

**Tham chiếu:** `SPEC-core.md` Section 4 (error categories + envelope), `SPEC-api.md` Section 11 (bảng lỗi từng endpoint), `CLAUDE.md`.

**Stack:** Laravel 11, Sanctum, queue Redis/DB, `storage/logs/laravel.log`.

---

## Bước 1 — Xác định lớp lỗi

1. **422 + `VALIDATION_ERROR`:** FormRequest — đọc `details` field; so với rules trong code và spec input.
2. **401:** Thiếu/invalid Bearer token Sanctum; cookie session SPA không gửi đúng domain/credentials.
3. **403:** Policy, middleware plan (`free` chạm tính năng Pro), **`is_admin`** cho `/api/admin/*`, cap My KOLs (Flow 2).
4. **400 / 409:** Custom exception từ Service — đọc `error.code` trong response, trace throw site.
5. **404:** Route model binding hoặc scope query (soft delete `Source`/`Tweet`/…).
6. **500:** Exception chưa map — xem log stack trace; APP_DEBUG chỉ bật local.

---

## Bước 2 — Laravel cụ thể

- `php artisan route:list --path=api` — đúng method + middleware.
- `tail -f storage/logs/laravel.log` hoặc `LOG_CHANNEL=stack` — tìm cùng `request_id` nếu có.
- **Queue:** job API follow-up — `php artisan queue:failed`, Horizon (nếu cấu hình); lỗi “silent” thường là job throw sau 200 OK response.
- **`php artisan optimize:clear`** khi nghi config cache route cũ.

---

## Bước 3 — Hợp đồng SPEC

- Đối chiếu response thực tế với **`{"data":...}` / `{"error":...}`** — Phase 1 không lệch envelope.
- Webhook: sai chữ ký → 401; duplicate → 409 — không nhầm với lỗi nghiệp vụ Stripe bên trong (xem `create-webhook-handler.md`).

---

## Bước 4 — Tích hợp ngoài

- **twitterapi / Anthropic / Resend / Stripe:** xem `audit_logs` / log `api_call_outbound` (mẫu on-error) trong `SPEC-api` §9.1.3.1.
- **Tweet fetch:** xác nhận binding `TweetFetchProviderInterface` đúng env — Service không gọi URL vendor trực tiếp.

---

## Checklist nhanh

- [ ] Reproduce với `curl` / HTTP client tách khỏi frontend (loại CORS/token).
- [ ] So sánh payload với spec (tên field snake_case JSON).
- [ ] Kiểm tra migration đã chạy (cột `last_crawled_at`, `is_admin`, …).
- [ ] Một bug một fix — không đổi envelope global trong cùng PR trừ khi CR.
