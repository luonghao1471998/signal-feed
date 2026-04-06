# Skill: Tạo REST endpoint (SignalFeed)

**Tham chiếu bắt buộc:** `CLAUDE.md`, `SPEC-api.md` Section 11 (REST), `SPEC-core.md` Section 3 (layering) + Section 4–7 (flows, permissions). Schema/cột mới → Section 9. Sau lock → **change request** trong `SPEC.md` trước khi đổi hành vi.

**Stack:** Laravel 11, PHP 8.2+, Sanctum, PostgreSQL, envelope JSON thống nhất.

---

## Phân loại (roadmap / sản phẩm)

| Loại | Khi nào dùng |
|------|----------------|
| **STANDARD** | CRUD/guard nghiệp vụ user-facing: validate, policy/plan, Service, transaction khi cần. |
| **SUPPORT** | Health, nội bộ, ít REST public (theo task `IMPLEMENTATION-ROADMAP.md`). |
| **WEDGE** | Sprint 1 kill path (digest, signals, draft copy, pipeline-adjacent). |
| **ADMIN** | Prefix `/api/admin/*`, middleware **`users.is_admin`** (`SPEC-api` Section 11). |

---

## Quy tắc kiến trúc (SPEC-core §3)

- **Controller → Service / Action → Model** khi có guard, nhiều bước, hoặc side effect.
- Controller **không** gọi trực tiếp vendor HTTP; Integration nằm `app/Integrations/`.
- **Crawl tweet:** Service chỉ phụ thuộc **`TweetFetchProviderInterface`** (binding env).
- **Job** gọi Service, **không** gọi Controller.

---

## Checklist triển khai một endpoint

1. [ ] Endpoint + request/response đã có trong **`SPEC-api.md` §11** (hoặc CR đã duyệt).
2. [ ] Route: `routes/api.php` — `auth:sanctum` (hoặc public nếu spec nói rõ). **Không** prefix `/v1/` Phase 1.
3. [ ] **Form Request** (`app/Http/Requests/...`): `rules()`, `authorize()`; message lỗi không leak nội bộ.
4. [ ] **Controller** (`app/Http/Controllers/Api/` hoặc `Admin/`): mỏng — gọi Service/Action, trả Resource hoặc array chuẩn.
5. [ ] **Service** (`app/Services/`): nghiệp vụ, `DB::transaction` khi ghi nhiều bảng.
6. [ ] **API Resource** (`app/Http/Resources/`) khi spec mô tả shape cố định.
7. [ ] **Feature test** (`tests/Feature/`) — xem skill `write-unit-test.md`.

---

## Envelope & HTTP (SPEC-core §4 + SPEC-api §11)

- **Lỗi:** `{"error": {"code": "STRING", "message": "...", "details": {...}}}`
- **Thành công có body:** `{"data": ...}`; phân trang thêm `meta` (`?page=`, `per_page=` mặc định 20).
- **Mã gợi ý:** `VALIDATION_ERROR` + 422; `401` unauthenticated; `403 FORBIDDEN` (plan/cap/admin); `400`/`409` conflict nghiệp vụ — **khớp bảng lỗi từng endpoint trong SPEC-api**.

---

## Business rules hay chạm (đừng vi phạm)

- **OAuth-only Phase 1:** không làm email/password làm auth chính (xem `SPEC-core` / NFR).
- **User.plan:** chỉ đổi qua Stripe webhook (hoặc luồng đã spec); không sửa tay qua API user-facing.
- **My KOLs cap:** Pro ≤10, Power ≤50 — kiểm tra **trước** tạo `MySourceSubscription` → 403 + message upgrade (`SPEC-core` Flow 2).
- **Free tier:** digest 3 ngày/tuần, không draft copy — enforce theo spec (API và/hoặc job; xem `VALIDATION-LOG` VR-6, VR-7).
- **Source Phase 1 Option A:** `type=user` → `active` ngay (`SPEC-core` Section 4).

---

## Anti-pattern

- Fat controller (vòng lặp + guard + DB).
- Model gọi Service.
- Thêm package Composer không có trong `SPEC.md` / dự án.
- Một PR sửa nhiều concern không liên quan — tách theo task.
