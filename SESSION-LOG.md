# Session Log - 20260406-001

**Session ID:** SES-20260406-001
**Date:** 2026-04-06
**Phase:** Giai đoạn 3 - Implementation
**Sprint:** Sprint 1 - Wedge Delivery
**Tasks Covered:** 1.1.1 - 1.2.5

---

## Pre-Session Checklist

- [x] Reviewed PROJECT-STATUS.md  ← Check ngay
- [x] Reviewed previous SESSION-LOG (if any)
- [x] Checked for blockers
- [x] CLAUDE.md is up-to-date
- [x] Git status clean (committed previous work)

---

## Session Goal

**Primary Objective:**
Complete Phase 1: Setup + Infrastructure (Tasks 1.1.1 - 1.2.5)

**Success Criteria:**
- [ ] Laravel 11.x + React 18 SPA scaffolded
- [ ] PostgreSQL + Redis connected
- [ ] All database migrations created and run
- [ ] Schema matches SPEC-api.md Section 9

### Task 1.1.1 - Initialize Laravel 11.x + React 18 SPA
- **Status:** ✅ Done
- **Prompts Used:** 1/5
- **Files Changed:**
  - `composer.json` (created)
  - `package.json` (created)
  - `vite.config.js` (created)
  - `resources/js/App.jsx` (created)
  - `.env.example` (created)
- **Key Decisions:**
  - Used Vite plugin for React (Laravel 11 standard)
  - SPA mode = React Router handles all routes
- **Test Results:**
  - ✅ npm run dev → React app at :5173
  - ✅ php artisan serve → Laravel at :8000
  - ✅ No console errors

---

## Current Session

**Task / scope:** 1.1.2 (env external services), 1.1.3 (Postgres + Redis queue + DB fallback), 1.2.1–1.2.5 (enum + core + junction + derived + indexes migrations; Category seeder).

**Files changed (chính):**
- `.env.example` — biến vendor §10 + `DB_URL`/`DB_SSLMODE`/`DB_SCHEMA`; queue Redis + comment fallback `database`/`sync`; Redis `REDIS_DB`/`REDIS_CACHE_DB`.
- `config/database.php` — default `pgsql`, DSN `DB_URL`, default DB/user Postgres, `search_path` + `sslmode` từ env.
- `config/queue.php` — default `redis`, batching/failed jobs gắn `pgsql`.
- `database/migrations/2026_04_06_095552_create_enums.php` — enum types theo SPEC-api.
- `database/migrations/2026_04_06_095703_create_core_tables_part_1.php` — bảng core part 1.
- `database/migrations/2026_04_06_095753_create_junction_tables.php` — junction M:N.
- `database/migrations/2026_04_06_095812_create_derived_tables.php` — draft_tweets, user_interactions, …
- `database/migrations/2026_04_06_095833_create_indexes.php` — index theo roadmap 1.2.5.
- `database/seeders/CategorySeeder.php`, `DatabaseSeeder.php` — seed categories (nếu đã wire).

**Approach & vì sao:** Khớp SPEC-api §9 (thứ tự: enum → bảng → junction → derived → index) để FK/index an toàn; config DB/queue đọc từ env để deploy Railway/Render/local không hardcode; queue Redis mặc định theo SPEC-core §3.1, fallback ghi rõ trong `.env.example` để không bắt Redis khi dev.

**Quyết định quan trọng:** `DB_CONNECTION` default `pgsql`; `QUEUE_CONNECTION` default `redis`; hỗ trợ `DB_URL` một dòng; không commit secret — chỉ placeholder trong `.env.example`.

**Đã thử / fail:** `php artisan migrate:status` trên môi trường không có `DB_PASSWORD` / Postgres chưa mở auth → lỗi kết nối (expected); sau khi điền `.env` đúng host/user/pass hoặc `DB_URL` thì verify lại.

**Tool/agent sau cần biết:** Entrypoint React là `resources/js/app.jsx` (không phải `App.jsx`). Cần `.env` thật cho Postgres trước khi `migrate`; nếu `QUEUE_CONNECTION=redis` thì Redis phải chạy trước `queue:work` (artisan vẫn boot được nếu chỉ migrate). Schema lock = `SPEC-api.md` §9 — đổi cột/bảng sau này = change request.

---

## Sprint Commit History

| Date       | Summary |
|------------|---------|
| 2026-04-06 | Scaffold Laravel 11 + React/Vite/Sanctum; env vendor + Postgres/Redis queue config; migrations 1.2.1–1.2.5 + category seed theo SPEC-api §9. |