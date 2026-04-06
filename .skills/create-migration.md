# Skill: Tạo migration DB (SignalFeed)

**Tham chiếu:** `SPEC-api.md` Section 9 (schema lock), `SPEC-core.md` data model / state machine, `SPEC.md` (CR sau lock).

**Stack:** Laravel migration + **PostgreSQL 15+**; Laravel 11 convention (`database/migrations/`).

---

## Nguyên tắc

1. **Nguồn truth cột/bảng/enum:** SQL và comment trong **`SPEC-api.md` §9** — migration phải khớp tên bảng `snake_case`, kiểu PostgreSQL, FK, index đã liệt kê.
2. **Sau lock:** thêm bảng/cột đổi nghĩa → **change request** (`SPEC.md`) rồi mới code migration.
3. **Timezone:** cột thời gian dùng **`TIMESTAMPTZ`**, lưu UTC (Constraint #11) — trong Laravel thường `timestampTz()` / `$table->timestampsTz()`.
4. **PK:** `BIGSERIAL` / `$table->id()` trừ khi spec chỉ UUID.
5. **Multi-tenant prep:** cột `tenant_id` DEFAULT 1 trên bảng core khi spec có.
6. **Soft delete:** `deleted_at` nullable timestampTz cho `Source`, `Tweet`, `Digest` khi spec áp dụng.
7. **Enum:** Postgres `CREATE TYPE ... AS ENUM` — ưu tiên migration riêng cho enum (roadmap task 1.2.1) rồi bảng tham chiếu; hoặc `check` constraint nếu team đã chốt cách Laravel map enum app ↔ DB.
8. **ON DELETE:** bám comment SQL lock trong SPEC (vd. `categories` RESTRICT, junction CASCADE, …) — không đổi hành vi delete silently.
9. **JSONB / array:** đúng kiểu `SPEC-api` Phần 1.1 (JSONB, `TEXT[]`, v.v.).

---

## Checklist một file migration

- [ ] Tên file có timestamp; một concern chính mỗi PR khi có thể (tránh “god migration”).
- [ ] `up()` khớp spec; `down()` revert được (drop column/table/type theo thứ tự phụ thuộc FK).
- [ ] Index: thêm migration index riêng nếu roadmap/spec có mục 1.2.5 / Phần 1.4 — không bỏ qua composite index cho filter API (`SPEC-api` GET list).
- [ ] **Không** seed dữ liệu nghiệp vụ trong migration — dùng Seeder.
- [ ] Comment ngắn trong migration trỏ tới **section SPEC** (vd. `SPEC-api §9 users.is_admin`) nếu không hiển nhiên.
- [ ] Chạy `php artisan migrate` trên DB sạch + kiểm tra `migrate:rollback` step liên quan.

---

## Khớp roadmap wedge

- Enums trước bảng base (task 1.2.1 → 1.2.2).
- Cột amendment **`sources.last_crawled_at`**, **`users.is_admin`**, **`user_personal_feed_entries`**, `tweets.tweet_kind` — đối chiếu changelog 2026-04-06 trong Section 9.

---

## Anti-pattern

- Đổi cột đã lock mà không cập nhật SPEC + CR.
- Dùng `string()` Laravel mặc định thành VARCHAR ngẫu nhiên khi spec yêu cầu TEXT.
- Thêm package DB chỉ để migration (trái `SPEC.md`).
