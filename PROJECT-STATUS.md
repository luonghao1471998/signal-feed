# SignalFeed - Project Status

**Last Updated:** 2026-04-16 (Task 3.3.3 admin moderation screen completed)
**Current Phase:** Giai đoạn 3 - Implementation
**Current Sprint:** Sprint 3 — Billing + Admin + i18n
**Sprint Status:** 🔄 In Progress (2/3 feature groups done)
**Previous Sprint:** Sprint 2.6 — Personal Signals Pipeline ✅ COMPLETED
**Blocker:** None — Stripe price IDs resolved ✅

---

## Sprint 2 Tasks

- [x] **Task 2.6.1**: PersonalPipeline Job (backend) — tạo signals type=1 từ My KOLs tweets ✅ (2026-04-15)
  - Created `app/Jobs/PersonalPipelineJob.php` với early duplicate check (credit-safe)
  - Verified: Pro user signal creation, Free user skip, idempotency, draft generation
  - cluster_id format: `{user_id}_{date}_cluster_{N}`
  - 0 TwitterAPI calls (reuse DB), ~900 tokens Anthropic per user per day
- [x] **Task 2.6.2**: Schedule Personal Pipeline fan-out (backend) ✅ (2026-04-15)
  - Added scheduler entry in `routes/console.php` (Laravel 11 schedule location), name `personal-pipeline-fanout`
  - Cron via env: `PERSONAL_PIPELINE_CRON` (default `30 1,7,13,19 * * *`)
  - Fan-out query verified: Pro/Power + has `sourceSubscriptions`; dispatch 1 job per user
  - Guards enabled: `withoutOverlapping(60)` + `onOneServer()`; crawler logs for started/completed
- [x] **Task 2.6.3**: Enforce GET /api/signals/{id} ownership for type=1 ✅ (2026-04-16)
  - Added ~5 lines ownership guard in `SignalController@show()`
  - type=1 + user_id ≠ auth → 403 FORBIDDEN (error format chuẩn CLAUDE.md)
  - type=0 behavior unchanged — all authenticated users can view
  - Manual testing: 6/6 test cases PASS (tinker + cURL)

**Sprint 2**: 17/17 tasks done

## Sprint 3 Tasks — Billing + Admin + i18n

- [x] **Task 3.1.1**: Implement Stripe Checkout Session creation ✅ (2026-04-16)
  - `POST /api/billing/checkout` — authenticated user tạo Stripe Checkout Session
  - `stripe/stripe-php` v20.0.0 (raw SDK, no Cashier)
  - Migration: `processed_stripe_events` table (idempotency cho 3.1.2)
  - Stripe test keys + real price IDs configured
  - Manual testing: 5/5 test cases PASS (cURL + tinker)
- [x] **Task 3.1.2**: Implement Stripe Webhook Handler (4 events) ✅ (2026-04-16)
- [x] **Task 3.1.3**: Implement plan downgrade cleanup logic ✅ (2026-04-16)
- [x] **Task 3.2.0**: Implement SendDigestEmailJob (F16 real delivery) ✅ (2026-04-16)
  - `app/Jobs/SendDigestEmailJob.php` + `app/Mail/DigestEmail.php` + `resources/views/emails/digest.blade.php`
  - `AuditLogService` new — whitelist thêm `digest.email.sent|failed|skipped_empty`
  - Resend SDK installed, config `services.resend.*`, from default `onboarding@resend.dev`
  - Signal selection: Free → `type=0` only; Pro/Power → `type=0` + `type=1 WHERE user_id=$user->id`, top 10 by `rank_score DESC`
  - Manual testing 5/5 PASS, 1 email credit consumed, Resend dashboard: Delivered
  - Unblocks Task 3.2.1 (Free tier Mon/Wed/Fri gate)
- [x] **Task 3.2.1**: Implement Signal Digest Delivery Gate (Tier-based Schedule) ✅ (2026-04-16)
  - Created `app/Services/DigestDeliveryGateService.php` (Free Mon/Wed/Fri; Pro/Power daily).
  - Integrated early gate in `SendDigestEmailJob` + audit event `digest.email.skipped_tier_restriction`.
  - Scheduler `digest:delivery-fanout` chạy `08:00` theo `Asia/Ho_Chi_Minh`.
  - Scheduling và delivery timezone đã đồng bộ `Asia/Ho_Chi_Minh`.
- [x] **Task 3.2.2**: Add plan-based feature gates to API endpoints ✅ (2026-04-16)
   - Added middleware `plan_features` (`CheckPlanFeature`) và gắn gate cho:
     - `POST /api/signals/{id}/draft/copy` (feature `draft_copy`) → chỉ Pro/Power
     - `POST /api/sources` (feature `add_source`) → chỉ Pro/Power
   - Verify Free (plan=`free`):
     - `POST /api/signals/2/draft/copy` → `403` + `{"error":"PLAN_RESTRICTED"}`
     - `POST /api/sources` → `403` + `{"error":"PLAN_RESTRICTED"}`
     - `GET /api/my-sources` → `200` (CR 2026-04-16)
   - Verify Pro (plan=`pro`): `POST /api/signals/2/draft/copy` → `200`

- [x] **Task 3.3.1**: Implement GET /api/admin/sources (moderation list) endpoint ✅ (2026-04-16)
  - `AdminSourceController@index`: default `status=pending_review`, filter `type=user|default`, eager-load `addedBy`
  - `AdminSourceResource`: response includes `id`, `x_handle`, `display_name`, `added_by_user{id,email}`, `signal_count`, `noise_ratio`, `status`, `created_at`
  - Route protected under `auth:sanctum` + `admin` middleware (`GET /api/admin/sources`)
  - Manual verify: non-admin `403`, admin `200`, record chuyển `active` không còn trong queue mặc định
- [x] **Task 3.3.2**: Implement PATCH /api/admin/sources/{id} (moderate) endpoint ✅ (2026-04-16)
  - Implemented moderation actions: `approve`, `flag_spam`, `soft_delete`, `restore`, `adjust_categories`
  - Integrated `AuditLogService::log(...)` with metadata `action`, `old_status`, `new_status`, `category_ids`
  - Verified category sync (`Count: 2`), admin permission guard (`is_admin=true/false`)
  - Last manual test note: Source ID `84` currently in `deleted` state
  - Safety complied: no `migrate:fresh`, no `php artisan test`, manual Tinker + PostgreSQL verification only
- [x] **Task 3.3.3**: Frontend: Admin moderation screen ✅ (2026-04-16)
  - Full UI with tabs, actions, optimistic updates, route guard

### 3.3 — Admin Review Queue

**Status:** ✅ COMPLETE  
**Progress:** 3/3 tasks done

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 3.3.1 | Backend: GET admin sources endpoint | ✅ | Returns user-submitted sources with filters |
| 3.3.2 | Backend: PATCH moderate endpoint | ✅ | Actions: approve, flag_spam, soft_delete, restore, adjust_categories |
| 3.3.3 | Frontend: Admin moderation screen | ✅ | Full UI with tabs, actions, optimistic updates, route guard |

**Completion Date:** 2026-04-16  
**Tested:** ✅ All actions + security (non-admin blocked)

**Sprint 3**: 9/14 tasks done

---

## Overall Project Progress

**Current Sprint:** Sprint 3 — Billing + Admin + i18n  
**Sprint Status:** 🔄 In Progress (2/3 feature groups done)

**Completed Feature Groups:**
- ✅ 3.2 — Billing & Subscription (Stripe integration)
- ✅ 3.3 — Admin Review Queue (moderation UI + API)

**In Progress:**
- 🔄 3.4 — i18n Support (next)

**Overall Completion:**
- Core Features (Sprint 1): ✅ 100%
- Advanced Features (Sprint 2): ✅ 100%
- Polish & Admin (Sprint 3): 🔄 66% (2/3 done)

---

## 🎯 Current Sprint (Tasks 2.5.5 → 2.5.7)

### Task 2.5.5: Settings API (GET/PATCH `/api/settings`) — ✅ COMPLETED
**Status:** ✅ Completed (2026-04-15)

### Task 2.5.6: Settings Screen Integration (Frontend) — ✅ COMPLETED
**Status:** ✅ Completed (2026-04-15)

### Task 2.5.7: i18n Foundation + Language Persistence (Frontend) — ✅ COMPLETED
**Status:** ✅ Completed (2026-04-15)
**Priority:** Medium
**Completed:** 2026-04-15
**Time Taken:** ~4 hours
**Outcome:** i18n infrastructure ready (en/vi), UI shell translated, locale persists across sessions

**Implementation:**
- Simple React Context pattern (NO external library)
- Translation coverage: nav labels, filters, empty states, common actions
- Locale flow: localStorage → API sync → persist
- Signal content intentionally NOT translated (AI English)

**Files Created:**
- `resources/js/i18n/{index.ts, en.ts, vi.ts}`
- `resources/js/components/LocaleSync.tsx`

**Files Modified:**
- App.tsx, LeftSidebar.tsx, MobileNav.tsx
- DigestPage.tsx, ArchivePage.tsx, MyKOLsPage.tsx, SettingsPage.tsx

**Verification:** Manual browser testing passed (7 test cases)

**Next Steps:**
- Incremental translation additions cho labels còn sót
- Consider thêm languages (ja, ko) nếu có user demand
- Future: AI multi-language signal generation

---

## 🎯 Current Sprint Summary

**Sprint Goal:** Settings Page MVP + Language Support  
**Timeline:** 2026-04-12 → 2026-04-15 (4 days)  
**Status:** ✅ COMPLETED

**Tasks:**
- ✅ Task 2.5.5: Backend locale field (COMPLETED 2026-04-12)
- ✅ Task 2.5.6: Language tab UI (COMPLETED 2026-04-13)
- ✅ Task 2.5.7: i18n foundation (COMPLETED 2026-04-15)

**Sprint Velocity:** 3 tasks / 4 days = 0.75 tasks/day  
**Completion Rate:** 100% (3/3 tasks completed)

**Key Achievements:**
- Users can now switch language (en/vi) with full persistence
- i18n infrastructure ready for future language additions
- Zero external dependencies added
- Clean separation: UI translated, AI content stays English

**Lessons Learned:**
- Simple Context pattern đủ dùng cho Phase 1 (không cần react-i18next)
- LocaleSync component pattern giải quyết hook ordering elegantly
- Manual browser testing hiệu quả cho i18n verification

**Next Sprint Focus:**
- [TBD based on product priorities]

---

## Sprint 2 — My KOLs (`IMPLEMENTATION-ROADMAP.md`)

**Đồng bộ roadmap:** Sprint 2 = **14** task (trong đó **2.1.3** / **2.1.4** + polish **2.1.5** auto-refresh); tổng dự án **59** task — xem `IMPLEMENTATION-ROADMAP.md`.

**Progress (14 tasks):** **14 / 14** (100%) — gồm 2.1.1–2.1.4, 2.2.x, 2.3.x, 2.4.1–2.4.5; **2.1.5** là polish UI (auto-refresh) cùng release

## Phase 2: My KOLs & Personalization

### Sprint 2 — Archive System

- [x] 2.5.1: POST/DELETE /api/signals/{id}/archive (backend endpoints) — ✅ 2026-04-15
- [x] 2.5.2 GET /api/archive/signals — list archived (filter date/category/search) ✅ 2026-04-15
- [x] Task 2.5.3: Save to Archive Button on Digest Cards ✅ 2026-04-15
- [x] Task 2.5.4: Integrate Archive Screen with Real API ✅ 2026-04-15

### Feature 2.5: Settings Page (Profile, Preferences, Plan)
- **Status:** 🚧 In Progress
- **Progress:** 3/5 tasks completed (60%)
- **Components:**
  - Task 2.5.1: ✅ Define settings schema & API contracts
  - Task 2.5.2: ⏳ Pending — SettingsPage layout & tab navigation
  - Task 2.5.3: ⏳ Pending — Profile & Digest Preferences tabs
  - Task 2.5.4: ⏳ Pending — Plan & Billing + Telegram tabs
  - Task 2.5.5: ✅ Completed — GET/PATCH /api/settings endpoints (Backend)
    - Migration: add_settings_columns_to_users_table
    - Controller: SettingsController (show, update)
    - Routes: GET/PATCH /api/settings (auth:sanctum)
    - Verified: 11/11 test cases passed
    - Integration tested với frontend (Task 2.5.6)
  - [x] **Task 2.5.6** - Settings Screen Frontend Integration ✅
    - settingsService.ts: fetchSettings() + updateSettings()
    - SettingsPage.tsx: 5 tabs integrated với backend APIs
    - Manual tested: Profile, Digest Preferences, Plan & Billing, Telegram, Language
    - Hotfix: Avatar render, UX improvements, /billing 404 fixes
    - Phase 1 limitations: Coming Soon toasts cho billing/telegram features

### 2.4 Frontend - My KOLs Integration

- [x] 2.4.5 Add My KOLs filter toggle to Digest view ✅ COMPLETED 2026-04-15
  - Backend: `my_sources_only` logic phân nhánh theo plan (Free vs Pro/Power)
  - Frontend: Toggle visibility chỉ cho Pro/Power users có subscriptions
  - Fallback banner cho Pro/Power khi chưa có personal signals
  - Migration: thêm `signals.type` và `signals.user_id` columns
  - Tested: curl + browser manual testing, tất cả scenarios pass

### Feature 2.2: Follow/Unfollow KOL Sources

| Task # | Task Name | Status | Completed Date |
|--------|-----------|--------|----------------|
| 2.2.1 | POST /api/sources/{id}/subscribe endpoint | ✅ COMPLETED | 2026-04-14 |
| 2.2.2 | DELETE /api/sources/{id}/subscribe endpoint | ✅ COMPLETED | 2026-04-14 |
| 2.2.3 | Add Follow/Unfollow buttons to Browse UI | ✅ COMPLETED | 2026-04-14 |

### Feature 2.3: Browse/Search

| Task # | Task Name | Status | Completed Date |
|--------|-----------|--------|----------------|
| 2.3.1 | Add server-side search filter to GET /api/sources endpoint | ✅ COMPLETED | 2026-04-14 |
| 2.3.2 | Build Browse Source Pool Screen #10 with search input | ✅ COMPLETED | 2026-04-14 |

### Feature 2.4: My KOLs API + UI

| Task # | Task Name | Status | Completed Date |
|--------|-----------|--------|----------------|
| 2.4.1 | Implement GET /api/my-sources endpoint | ✅ COMPLETED | 2026-04-14 |
| 2.4.2 | Implement GET /api/my-sources/stats endpoint | ✅ COMPLETE | 2026-04-14 |
| 2.4.3 | Build My KOLs List Screen #8 | ✅ DONE | 2026-04-14 |
| 2.4.4 | Build My KOLs Stats Screen #9 (React) | ✅ DONE | 2026-04-14 |

### ✅ Task 2.1.1: `POST /api/sources` — COMPLETED (2026-04-13)

- **Files:** `SourceController.php` (`store`), `User.php` (`sourceSubscriptions`), `routes/api.php` (`POST /sources`, `auth:sanctum`).
- **Handle:** request có `@` → DB `x_handle` không `@` → response `handle` có `@`.
- **H1:** Pro 10 / Power 50 subscriptions; `is_subscribed` theo cap.
- **Tests:** Manual **9/9** (tinker + curl); không automated tests (DATABASE SAFETY RULES).
- **DB (phiên test):** vd. sources id 81–82, subscription + pivot như SESSION-LOG — không truncate pool.

### Task 2.1.2: Build Add Source Form Screen - ✅ COMPLETED (2026-04-14)

**Status:** ✅ Complete

**Implementation:**
- Frontend form allowing Pro/Power users to submit KOL sources
- Sources created with `status='pending_review'` (Option B)
- NO auto-subscribe until admin approval
- Success messaging explains review process
- Free users excluded (no button visibility)

**Components Delivered:**
- `AddSourceModal.tsx` - Modal form component
- `sourceService.createSource()` - API call layer
- Integration in MyKOLsPage with trigger button
- Backend creates sources with pending_review status (`app/Http/Controllers/Api/SourceController.php`)

**Testing:**
- ✅ Form submission successful (Pro/Power users)
- ✅ Validation working (handle @, categories, display_name)
- ✅ Success toasts show correct Option B messaging
- ✅ Backend creates pending_review sources (verified)
- ✅ No auto-subscription (verified in DB)
- ✅ Free users restricted (button hidden)

**Next Step:** Sprint 2 (14-task bundle) ✅ — chuyển sang **2.5.x** (Archive / Settings) hoặc **3.x** (Stripe / Admin) theo ưu tiên

---

## Phase 2.1: Source Management (Option B - Moderation Queue)

**Status:** Complete (core user-facing 2.1.x + subscribe APIs)

- ✅ Task 2.1.1: POST /api/sources endpoint (Option B) - Complete
- ✅ Task 2.1.2: Add Source Form (pending_review queue) - Complete
- [x] **Task 2.1.3:** GET /api/sources/my-submissions endpoint ✅ **(DONE 2026-04-15)**
  - Returns user's submitted sources with status (pending_review/active/spam/deleted)
  - Pro/Power only (403 for free users)
  - Includes `is_subscribed` flag
  - Pagination 20/page
- [x] **Task 2.1.4:** My Submissions UI in MyKOLsPage ✅ **(DONE 2026-04-15)**
  - Tab "Submitted" (Pro/Power only)
  - Status badges with colors (yellow/green/red/gray)
  - Follow button for active sources not yet subscribed
  - Empty state + pagination
- [x] **Task 2.1.5:** Auto-refresh Submitted tab after Add Source ✅ **(DONE 2026-04-15)**
  - `AddSourceModal` `onSuccess` + `handleAddSourceSuccess` on parent
  - New submission appears at top of list (sort `created_at` DESC) without manual refresh
- ✅ Task 2.2.1: Implement POST /api/sources/{id}/subscribe endpoint — **COMPLETED 2026-04-14** (`SubscriptionController`, cap Pro≤10/Power≤50, `auth:sanctum`, manual tests 10/10)
- ✅ Task 2.2.2: Implement DELETE /api/sources/{id}/subscribe endpoint — **COMPLETED 2026-04-14** (idempotent delete + `204 No Content`, source `404`, auth `401`)

_(Roadmap tiếp: **2.5.x** Archive / Settings — `IMPLEMENTATION-ROADMAP.md`.)_

---

## Phase 2: API Layer Implementation (Sprint 2 — subscriptions)

### Module 2.2: Source Subscription Endpoints

| Task | Status | Assignee | Notes |
|------|--------|----------|-------|
| 2.2.1 `POST /api/sources/{id}/subscribe` | ✅ COMPLETED | Dev Team | Cap enforcement (Pro≤10, Power≤50), composite PK handling, `DB::transaction` + `lockForUpdate()`, `DB::table` insert for junction row. Manual tests 10/10 (tinker + curl). **2.2.1–2.2.3** ✅. |
| 2.2.2 `DELETE /api/sources/{id}/subscribe` | ✅ COMPLETED | Dev Team | Idempotent unsubscribe (`204`), source validation (`404`), `auth:sanctum` (`401` unauthenticated), self-owned delete via `WHERE user_id`. Manual tests 7/7 passed. |
| 2.2.3 Follow/Unfollow UI (browse pool) | ✅ COMPLETED | Dev Team | Browse tab `/my-kols`: Follow/Following + subscribe APIs + `is_subscribed` on `GET /api/sources`; category filter + quota; manual browser tests PASS (2026-04-14). |

**Ghi chú:** `GET /api/my-sources` = roadmap **2.4.1** (My KOLs list), không phải 2.2.3.

---

## Phase 1 Progress

### Completed Tasks
- ✅ **Task 1.10.1:** `GET /api/signals` endpoint (Backend API)
- ✅ **Task 1.10.2:** Integrate DigestPage with Real API — Screen #5 (`DigestPage`, filters, stats, hybrid category pills)
- ✅ **Task 1.11.1:** `GET /api/signals/{id}` (detail endpoint) — COMPLETED 2026-04-10
  - `SignalDetailResource` với full source attribution
  - Sources include: `tweet_url`, `tweet_text`, `posted_at` (from tweets JOIN)
  - Permission guard: Free users → `draft_tweets` stripped
  - Error handling: 404, 401
  - Tested: Free/Pro user scenarios, error cases
- ✅ **Task 1.11.2:** Signal Detail Modal (Screen #7) — COMPLETED 2026-04-10
  - `SignalDetailModal.tsx`: responsive Dialog (desktop) / Sheet (mobile), skeleton, errors
  - `SourceAttribution.tsx`: initials avatar, blockquote tweet, `date-fns` relative time, “View on X”
  - `fetchSignalDetail(id)` + `DigestPage` state + `DigestSignalCard` `onClick`
  - Draft block Pro/Power only; “Copy to X” wired (Task 1.12.3 ✅)
  - Manual testing: 14/14 scenarios PASS (SESSION-LOG)
- ✅ **Task 1.12.1:** `POST /api/signals/{id}/draft/copy` — COMPLETED 2026-04-13
  - `DraftController::copy` + `UserInteraction` model + route `auth:sanctum` + `whereNumber('id')`
  - Twitter Web Intent (`rawurlencode` RFC 3986); Free → 403; missing signal/draft → 404
  - Tests: `DraftCopyApiTest` dùng `DatabaseTransactions` (không `RefreshDatabase`)
- ✅ **Task 1.12.2:** Refactor to Event-Driven Logging ✅ (2026-04-13)
  - Event: `app/Events/DraftCopied.php` created
  - Listener: `app/Listeners/LogUserInteraction.php` created
  - `EventServiceProvider`: `$listen` mapping + `shouldDiscoverEvents(): false`
  - `bootstrap/app.php`: `->withEvents(discover: false)` (fix duplicate listener với Laravel 11 auto-discovery)
  - Controller decoupled from `UserInteraction` model trong `DraftController`
  - Verified: 1 HTTP request → 1 DB record (`count(getListeners(DraftCopied)) === 1`)
- ✅ **Task 1.12.3:** Copy to X button — dual-mode (browser tab vs X desktop app) ✅ (2026-04-13)
  - `resources/js/services/signalService.ts`: `copyDraft()` + `ensureSanctumCsrf()` + `authFetchHeaders()`
  - `resources/js/components/SignalDetailModal.tsx`: `handleCopyDraft`, toast, `localStorage` `signalfeed_x_client_mode`, intent `x.com/intent/post` mở tab (`<a rel="noopener">`)
  - Clipboard fallback; desktop-app mode không mở URL (PWA pre-fill limitation)

### Task 1.12: Draft Sharing & Social Integration

#### 1.12.1 POST /api/signals/{id}/draft/copy endpoint ✅ COMPLETED

**Status:** DONE (April 13, 2026)

**Deliverables:**

- ✅ DraftController với `copy()` method
- ✅ Twitter Web Intent URL generation
- ✅ Permission guard (Pro/Power only)
- ✅ UserInteraction logging
- ✅ URL encoding RFC 3986 compliant
- ✅ Error handling (403, 404)
- ✅ Manual testing passed (9 test cases)

**Testing:**

- Pro user success → 200 OK with Twitter Intent URL
- Free user blocked → 403 FORBIDDEN
- Signal not found → 404
- Draft not found → 404
- URL encoding verified (spaces=%20, special chars encoded)
- UserInteraction logged correctly

**Files:**

- `app/Http/Controllers/Api/DraftController.php`
- `app/Models/UserInteraction.php`
- `routes/api.php`
- `tests/Feature/DraftCopyApiTest.php`

#### 1.12.2 Event-driven UserInteraction logging (`copy_draft`) ✅ COMPLETED

**Status:** DONE (April 13, 2026)

**Deliverables:**

- ✅ `DraftCopied` event + `LogUserInteraction` listener
- ✅ Duplicate logging fix: `shouldDiscoverEvents()` + `withEvents(discover: false)`
- ✅ Manual verification (Tinker + cURL): một request chỉ một bản ghi `copy_draft`

#### 1.12.3 Copy to X button (React) ✅ COMPLETED

**Status:** DONE (April 13, 2026)

**Files:**

- `resources/js/services/signalService.ts` — `copyDraft()`
- `resources/js/components/SignalDetailModal.tsx` — dual-mode, clipboard, toast

**Notes:** Intent base URL backend: `https://x.com/intent/post?text=`; CSRF stateful Sanctum cho POST.

### In Progress / Next (roadmap)
- **Sprint 2 (14-task table):** ✅ **14/14** — gồm **2.4.5** (digest My KOLs toggle) + **2.1.3–2.1.4** (my submissions) + **2.1.5** (auto-refresh; polish cùng release)
- ✅ **3.1.1** Stripe Checkout Session (2026-04-16)
- ✅ **3.1.2** Stripe webhook handler — 4 events + idempotency (2026-04-16)
- ✅ **3.1.3** Plan downgrade cleanup logic — multi-tier cap (`pro=10`, `free=5`), 7/7 test PASS (2026-04-16)
- ✅ **3.2.0** SendDigestEmailJob — F16 real delivery qua Resend, Mailable + Blade template + audit (sent/failed/skipped_empty), 5/5 test PASS (2026-04-16)
- ✅ **3.2.1** Signal Digest Delivery Gate — Free Mon/Wed/Fri (VN time), Pro/Power daily, scheduler `08:00 Asia/Ho_Chi_Minh` (2026-04-16)
- **Backlog (ngoài bảng Sprint 2):** **1.11.3** — metadata digest (tùy ưu tiên)

### Statistics
- **Sprint 1 (34 tasks, `IMPLEMENTATION-ROADMAP`):** 34 / 34 ✅
- **Sprint 2 (14 tasks):** 14 / 14 (100%) ✅
- **Sprint 3 (14 tasks):** 8 / 14 (57%) — Feature 3.1 Stripe Integration ✅; Feature 3.2 Free Tier Enforcement ✅ (3/3); Feature 3.3 Admin Review Queue in progress (2/4: 3.3.1, 3.3.2)

### Progress Summary

**Completed Tasks:** Sprint 1 **34/34** ✅; Sprint 2 **14/14** (thêm **2.1.3–2.1.5** 2026-04-15; **2.4.5** 2026-04-15; cùng các task 2.1.1–2.1.2, 2.2.x, 2.3.x, 2.4.1–2.4.4)
**Current phase:** Sprint 3 — Feature 3.1 ✅; Feature 3.2 ✅; Feature 3.3 đang triển khai (3.3.1 + 3.3.2 ✅, kế tiếp 3.3.3 UI moderation)
**Last Updated:** 2026-04-16

**Recent Completions:**
- ✅ Task **3.2.2:** Add plan-based feature gates to API endpoints — middleware `plan_features` (CheckPlanFeature) chặn premium endpoints cho Free (`403` + `PLAN_RESTRICTED` ở `POST /api/signals/{id}/draft/copy` và `POST /api/sources`), nhưng vẫn cho `GET /api/my-sources`; Pro truy cập premium thành công — SESSION-LOG 2026-04-16
- ✅ Task **3.2.1:** Signal Digest Delivery Gate — thêm `DigestDeliveryGateService`, gate trong `SendDigestEmailJob`, audit event `digest.email.skipped_tier_restriction`, scheduler `digest:delivery-fanout` chạy `08:00` theo `Asia/Ho_Chi_Minh`; verify Tinker: Free Tue skip + audit, Free Mon allow, Pro any day allow — SESSION-LOG 2026-04-16
- ✅ Task **3.2.0:** SendDigestEmailJob F16 real delivery — Mailable `DigestEmail` + Blade `emails.digest` responsive + Job queue `digest-delivery` + `AuditLogService` whitelist 3 new events, Resend SDK integrated, manual 5/5 PASS (1 email credit), Delivered confirmed trên Resend dashboard — SESSION-LOG 2026-04-16
- ✅ Task **3.1.3:** Plan downgrade cleanup — `cleanupSubscriptionsToPlanLimit()` trong `StripeWebhookService`, multi-tier cap (`pro=10`, `free=5`), hook vào `subscription.updated` + `subscription.deleted`, syntax/lint PASS — SESSION-LOG 2026-04-16
- ✅ Task **3.1.2:** Stripe webhook handler — 4 events (checkout.completed / subscription.updated / subscription.deleted / invoice.payment_failed), idempotency qua `processed_stripe_events.event_id`, price→plan map qua `config/services.php`, audit logging `plan_change` + `webhook_received` — SESSION-LOG 2026-04-16
- ✅ Task **2.5.6:** Settings Screen Frontend Integration — integrated all 5 tabs với backend APIs, save/load cho Profile + Digest Preferences + Language, fixed 4 UI issues (avatar render, digest UX, /billing 404 toasts) — SESSION-LOG 2026-04-15
- ✅ Task **2.5.5:** GET/PATCH `/api/settings` endpoints — backend settings APIs integrated with frontend in Task 2.5.6 — SESSION-LOG 2026-04-15
- ✅ Task **2.5.4:** Archive Screen integrated with real API — `ArchivePage` fetch/filter/pagination/unsave + error/empty/loading states + category pills from DB + TypeError fix + deep-link support — SESSION-LOG 2026-04-15
- ✅ Task **2.5.3:** Save to Archive button on Digest cards — `is_archived` API field + optimistic UI + rollback/toast — SESSION-LOG 2026-04-15
- ✅ Task **2.5.2:** GET `/api/archive/signals` — `ArchiveController@index`, filters + pagination — SESSION-LOG 2026-04-15
- ✅ Task **2.5.1:** Archive save/unsave — `ArchiveController`, `user_archived_signals`, Tinker verify — SESSION-LOG 2026-04-15
- ✅ Task 2.1.3–2.1.5: `GET /api/sources/my-submissions`, tab Submitted (Pro/Power), `getMySubmissionsAPI`, `AddSourceModal` `onSuccess` + refetch — SESSION-LOG 2026-04-15
- ✅ Task 2.4.5: Digest My KOLs filter toggle — `SignalController` + `DigestPage` (2026-04-15)
- ✅ Task 2.4.4: Stats dashboard UI — 4 metric cards (Total Today, Top Sources, 7-Day Trend chart, Category Breakdown), API integration + loading/error/empty states, responsive layout (2026-04-14)
- ✅ Task 2.4.3: My KOLs Following Tab UI — list from `GET /api/my-sources`, unfollow with optimistic rollback, pagination, empty state, manual browser tests PASS (2026-04-14)
- ✅ Task 2.4.2: `GET /api/my-sources/stats` — 4 metrics (total today, top 3, trend 7d, category breakdown), auth + empty-state handled, SQL-verified aggregate logic (2026-04-14)
- ✅ Task 2.4.1: `GET /api/my-sources` — `MySourcesController@index`, eager loading, pagination, per-source stats batch computation, manual Tinker+cURL checks PASS (2026-04-14)
- ✅ Task 2.3.2: Browse Source Pool Screen #10 — đã fulfilled bởi UI Browse tab (`/my-kols`) từ 2.2.3 + backend search 2.3.1 (2026-04-14)
- ✅ Task 2.3.1: Server-side search filter on `GET /api/sources` — search `x_handle` + `display_name` (ILIKE), strip `@`, manual cURL checks PASS (2026-04-14)
- ✅ Task 2.2.3: Follow/Unfollow buttons in Browse Source Pool UI — `is_subscribed`, `categoryService`, optimistic UI, plan caps, manual browser tests (2026-04-14)
- ✅ Task 2.2.2: `DELETE /api/sources/{id}/subscribe` — idempotent unsubscribe, manual 7/7 (2026-04-14)
- ✅ Task 2.2.1: `POST /api/sources/{id}/subscribe` — `SubscriptionController`, cap + transaction lock, manual 10/10 (2026-04-14)
- ✅ Task 2.1.2: Add Source Form (Option B) — `AddSourceModal` + `pending_review` (2026-04-14)
- ✅ Task 2.1.1: `POST /api/sources` — add user source + H1 + manual 9/9 (2026-04-13)
- ✅ Task 1.12.3: Copy to X UI — dual-mode + CSRF (2026-04-13)
- ✅ Task 1.12.2: Event-driven logging + duplicate listener fix (2026-04-13)
  - `DraftCopied` / `LogUserInteraction`; `withEvents(false)`; verified single listener
- ✅ Task 1.12.1: POST `/api/signals/{id}/draft/copy` (2026-04-13)
  - Twitter Web Intent URL + `UserInteraction` (`copy_draft`); manual Tinker + cURL verification
- ✅ Task 1.11.2: Signal Detail Modal (2026-04-10)
  - Responsive modal với full signal detail
  - Source attribution với relative timestamps
  - Draft tweets section (plan-based visibility)
  - Manual testing: 14/14 test cases PASS

---

## Overall Progress

**Phase 1 (MVP) - Core Pipeline:**

- [x] 1.6.1 - Twitter Crawler (twitterapi.io integration) ✅
- [x] 1.6.2 - Scheduler (4×/day automated crawl) ✅
- [x] 1.6.3 - Incremental Crawl (only new tweets) ✅
- [x] 1.7.1 - LLM Integration (Anthropic Claude API) ✅
- [x] 1.7.2 - Classify Pipeline (signal detection) ✅ ← **COMPLETED**
- [x] 1.8.1 - Cluster Step (group similar tweets) ✅ ← **COMPLETED**
- [x] 1.8.2 - Summarize Step (`SignalSummarizerService` + `summarize.md`) ✅ ← **COMPLETED** (April 9, 2026)
- [x] 1.8.3 - Add summarize + Signal records to pipeline ✅ ← **COMPLETED** (April 9, 2026)
- [x] 1.9.1 - Rank signals (importance scoring) ← **COMPLETE** (April 9, 2026)
  - ✅ `SignalRankingService` — 3-component formula (source / quality / recency)
  - ✅ All 7 dev signals ranked (approx. **0.66–0.82** `rank_score` range in verification session)
  - ✅ Formula verified: **40% / 30% / 30%** weights per SPEC
  - ✅ Index `idx_signals_rank_score` — `EXPLAIN ANALYZE` uses index scan for `ORDER BY rank_score DESC`
- [x] 1.9.2 - Generate drafts (tweet composer) ✅ ← **COMPLETE** (April 9, 2026)
  - ✅ `DraftTweetService` — category-aware draft generation
  - ✅ Prompt template `docs/prompts/v1/generate-draft.md`
  - ✅ Character limit enforcement (≤280 strict)
  - ✅ Idempotent (no duplicate API calls)
  - ✅ Test verified: 2 drafts (161-191 chars), quality OK
- [x] Task 1.9.3: Add rank + draft steps to PipelineCrawlJob
  - Status: COMPLETED
  - Date: 2026-04-10
  - Files Modified:
    - `app/Jobs/PipelineCrawlJob.php` (added Step 5: Ranking + Step 6: Draft Generation)
  - Testing: Manual testing passed
    - `SignalRankingService->calculateRankScore()` verified (7 signals ranked)
    - `DraftTweetService->generateDraft()` verified (3 drafts created, all ≤280 chars)
    - Signal→Draft relationship working
    - Error handling per-signal verified
  - Notes:
    - Inject services vào `handle()` method (queued job pattern)
    - Comprehensive logging for Step 5 & 6
    - Return metrics: `signals_ranked`, `drafts_generated`, `rank_errors`, `draft_errors`
    - Full pipeline not executed to save Anthropic API credits

**Progress (wedge pipeline 1.6.x–1.9.x):** 11/11 tasks complete (100%) 🎉  
**Critical path:** On track  
**Blockers:** None

## Task 1.7.2 — Add Classify Step to PipelineCrawlJob ✅

**Status:** Complete  
**Completed:** 2026-04-08  
**Type:** WEDGE (Critical Path)

**What was built:**

- `TweetClassifierService`: Claude API integration cho tweet classification
- `classify.md` prompt: Tech signal detection criteria
- `PipelineCrawlJob`: Orchestration (Crawl → Classify pipeline)
- Config: `signal_threshold` (0.6), `classify_batch_size` (200), `classify_lookback_hours` (24h)

**Test results:**

- 5 tweets classified: 3 signals detected (60% rate) _(kịch bản mẫu / manual; PHPUnit 11 tests PASS)_
- 0% error rate, 100% success rate _(trên batch test tự động)_
- Average score: 0.53 (balanced distribution) _(ước lượng minh hoạ)_

**Files:**

- **Created:** `TweetClassifierService`, `config/signalfeed.php`, migration `signal_score` unclassified; tests unit/feature bổ sung
- **Modified:** `PipelineCrawlJob` (refactor orchestration), `docs/prompts/v1/classify.md`, `routes/console.php` (scheduler 4×/day), `.env.example`, `TwitterCrawlerService`, `LLMClient`, `FakeLLMClient`

**Next (block Task 1.7.2 lịch sử):** theo roadmap hiện tại → **2.3.1** / **2.4.1** (Sprint 2); backlog **1.11.3**.

## Current Sprint Status

**Completed Task:** Sprint 2 bundle **14/14** ✅ — gồm **2.1.3–2.1.5** (My Submissions + auto-refresh, 2026-04-15), **2.4.5** (digest toggle), các task 2.2.x / 2.3.x / 2.4.1–2.4.4; **2.5.1** + **2.5.2** (archive APIs, 2026-04-15)  
**Next Task:** **2.5.3** Save to Archive button (hoặc nhánh Stripe **3.1.1**) — `IMPLEMENTATION-ROADMAP.md`  
**Status:** Sprint 2 (14-task table) complete — archive list API **2.5.2** done — xem SESSION-LOG 2026-04-15  
**Previous:** Task 2.4.5 Digest My KOLs filter; Task 2.1.2 Add Source modal

**Recent Completions:**

- ✅ **2026-04-15:** Task **2.5.2** — GET `/api/archive/signals`
  - List archived signals + date_range / category / search / pagination
  - Manual curl + tinker verification (10/10)
  - Ready for Task **2.5.3** (Digest save button) & **2.5.4** (Archive UI)
- ✅ **2026-04-15:** Task **2.5.1** — POST/DELETE `/api/signals/{id}/archive`
  - Backend foundation cho Archive feature
  - Idempotent save/unsave signals
  - Verified qua Tinker (10/10 tests passed)
  - Superseded by Task **2.5.2** (list archived signals) — ✅ 2026-04-15
- ✅ 2026-04-10: Task 1.11.2 — `SignalDetailModal` / Sheet+Dialog; `SourceAttribution`; `fetchSignalDetail`; `DigestPage` + card `onClick`; Pro/Power draft block; SESSION-LOG
- ✅ 2026-04-10: Task 1.11.1 — `GET /api/signals/{id}`; `SignalDetailResource`; full tweet attribution; Free draft strip; tested (SESSION-LOG)
- ✅ 2026-04-10: Task 1.10.2 — `DigestPage` + `signalService` + map API → UI; `AuthContext`; hybrid category pills; `RightPanel`/stats aggregates; rank badges; `constants/categories.ts`; category assigner + backfill command (SESSION-LOG)
- ✅ 2026-04-10: Task 1.10.1 — `SignalController` + `SignalResource`; `GET /api/signals` (`auth:sanctum`); filters + Free/Pro guards; manual tests 8/10 PASS (SESSION-LOG)
- ✅ 2026-04-10: Task 1.9.3 — `PipelineCrawlJob` Step 5 (rank) + Step 6 (draft); `handle()` inject `SignalRankingService` + `DraftTweetService`; manual verify 7 ranked, 3 drafts ≤280 chars
- ✅ 2026-04-09: Task 1.9.2 — `DraftTweetService`; `generate-draft.md` prompt; ≤280 char enforcement; verified 2 drafts
- ✅ 2026-04-09: Task 1.9.1 — `SignalRankingService`; `rank_score` 3-factor formula; verified on 7 signals + PostgreSQL
- ✅ 2026-04-09: Task 1.8.3 — `PipelineCrawlJob` persist `Signal` + `signal_sources`; digest; idempotency
- ✅ 2026-04-09: Task 1.8.2 — `SignalSummarizerService`, `docs/prompts/v1/summarize.md`, `LLMClient::summarize()` + tests
- ✅ 2026-04-09: Task 1.8.1 — Tweet clustering (prompt-based, `TweetClusterService` + pipeline)
- ✅ 2026-04-08: Task 1.7.2 — Classify pipeline complete
- ✅ 2026-04-08: Task 1.6.3 — Incremental crawl
- ✅ 2026-04-08: Task 1.7.1 — LLM integration (signal generation)
- ✅ 2026-04-08: Task 1.6.2 — Scheduler (tweet crawl)
- ✅ 2026-04-07: Task 1.6.1 — Twitter crawler

**Velocity:** ~1.5 wedge tasks/day (ước lượng theo các mốc gần đây) 🚀

---

## Quick Stats

### Sprint 1 Progress (34 tasks total)
- **Completed:** 29/34 (85%)
- **In Progress:** None
- **Blocked:** None

### Code Metrics
- **Backend:** 88% (Auth + DB + Categories + Sources + API + Crawler + Scheduler + Incremental + Signal generation + **Classify** + **Cluster** + **Summarize** + **Persist signals** + **Ranking** + **Draft generation** + **Rank/draft trong `PipelineCrawlJob` (1.9.3)** + **`GET /api/signals` (1.10.1)** + **category assigner / backfill (hỗ trợ 1.10.2)** ✅)
- **Frontend:** ~35% (Digest view + API integration + **signal detail modal (1.11.2)** + onboarding category step; scaffold còn lại)
- **Database:** 100% (All migrations done)
- **Seed Data:** 100% (Categories ✅, Sources CSV ✅, Sources imported ✅)
- **Tests:** Feature `SchedulerTest` + manual (OAuth, seed, APIs, crawler, incremental, signals, **classify**, **cluster**, **summarize**)

### Integration Status
- [x] OAuth X.com (Task 1.3.1 complete) ✅
- [x] Categories API (Task 1.4.2 complete) ✅
- [x] Digest list API + SPA + signal detail (`GET /api/signals` **1.10.1** + `DigestPage` **1.10.2** + modal **1.11.2** ✅; `GET /api/signals/{id}` **1.11.1** ✅)
- [x] Sources API (Task 1.5.3 complete) ✅
- [x] twitterapi.io (Tasks 1.6.1-1.6.3 complete) ✅  
  - Endpoint: `/twitter/user/last_tweets` (`userName` + `count`)  
  - API key: cấu hình qua `.env` (active khi có key)  
  - Rate limit: sleep 3s giữa các source (dev)
  - **Scheduler:** 4×/day automated (Task 1.6.2 ✅)
  - **Incremental:** Client-side filtering by `last_crawled_at` (Task 1.6.3 ✅)
  - **Duplicate prevention:** UNIQUE constraint + logging
- [x] Anthropic Claude (Tasks 1.7.1–1.8.3 pipeline steps complete) ✅  
  - Model: `claude-sonnet-4-20250514`  
  - **Signal generation:** `php artisan signals:generate` (Task 1.7.1)  
  - **Tweet classification:** `TweetClassifierService` (Task 1.7.2 ✅)  
    - Classify prompt: `docs/prompts/v1/classify.md`  
    - Signal threshold: **0.6** (configurable `SIGNAL_THRESHOLD` / `config/signalfeed.php`)  
    - Conversion rate: ~**60%** (kịch bản mẫu / manual; PHPUnit suite PASS)  
    - Retry logic: **3** attempts, exponential backoff (~**1s**, **2s** giữa các attempt)  
    - Performance: ~**2–3s**/tweet (ước lượng, tuỳ API)  
  - **Tweet clustering:** `TweetClusterService` + `LLMClient::cluster()` (Task **1.8.1** ✅)  
    - Prompt: `docs/prompts/v1/cluster.md`; lookback **24h** (`CLUSTER_LOOKBACK_HOURS`); kết quả in-memory cho bước summarize  
    - Chi phí ước tính cluster: ~**$0.02**/day (4 runs × ~$0.005)  
  - **Signal summarization (Task 1.8.2 ✅):** `SignalSummarizerService` + `LLMClient::summarize()` + `docs/prompts/v1/summarize.md`  
    - Retry **3** lần + JSON/regex fallback; output sẵn cho `Signal::create()`; chi phí ước tính summarize: ~**$0.40**/day (50 clusters × 4 runs × ~$0.002)  
  - **Draft tweet generation (Task 1.9.2 ✅):** `DraftTweetService` + `docs/prompts/v1/generate-draft.md`  
    - Category-aware tone: Funding (amounts), Product (benefits), AI (metrics), Research (innovation)  
    - Character limit: **≤280** strict (Twitter requirement); target **120-200** chars  
    - Emojis: **0-2** max, context-appropriate (🚀 launches, 💰 funding, 📊 metrics)  
    - Idempotent: returns existing draft (no duplicate API calls)  
    - Fallback: signal title (truncated) on API failure  
    - Cost estimate: ~**$0.03**/day (7 signals × 4 runs × ~$0.001)  
  - **Pipeline:** `PipelineCrawlJob` orchestrates **Crawl → Classify → Cluster → Summarize → persist `signals` → rank (`1.9.1` / Step 5) → draft (`1.9.2` / Step 6)** (Tasks **1.8.3** ✅, **1.9.3** ✅); scheduler: `dispatch_sync` trong `Schedule::call` (chạy ngay khi `schedule:run`, không phụ thuộc worker queue)  
  - Credits: ~**$4.71** remaining (snapshot); **ước tính scale pipeline (sau 1.8.2):** classify ~**$9.60**/day + cluster ~**$0.08**/day + summarize ~**$0.40**/day + crawl (twitterapi.io) — xem *Metrics Update*  
- [ ] Stripe (Sprint 3)
- [ ] Resend (Sprint 2+)

### Data Metrics

**Database (snapshot sau Task 1.8.1 — số liệu môi trường có thể khác):**

- Categories: **10** ✅
- Sources: **80** ✅
- Tweets: **~200** ✅ (twitterapi.io + scheduler automated — mục tiêu scale; dev có thể thấp hơn)
  - **Classified:** ~**50** tweets có `signal_score` (ước lượng sau pipeline)
  - **Signals:** ~**30** tweets (`is_signal = true`) — ~**60%** so với đã classify (minh hoạ)
- Users: **tùy** (sau `migrate:fresh` có thể 0 — đăng nhập OAuth lại để có bản ghi)
- Signals: **tùy** (Task 1.7.1 manual + pipeline **1.8.3** ghi `signals` / `signal_sources`; **`rank_score`** via **1.9.1** ✅ + **Step 5 trong job (1.9.3)** ✅; **`draft_tweets`** via **1.9.2** + **Step 6 trong job (1.9.3)** ✅)

**Độ "fresh":**

- `last_crawled_at`: cập nhật **4×/ngày** qua scheduler (khi cron + credits ổn)
- Tweet classification: tự classify trong `PipelineCrawlJob` (Task **1.7.2** ✅)
- Tweet clustering + summarize + persist: trong `PipelineCrawlJob` (Tasks **1.8.1–1.8.3** ✅)
- Signal generation: manual `signals:generate` (1.7.1); auto pipeline persist signals (**1.8.3** ✅); ranking formula **1.9.1** ✅; rank + draft trong job **1.9.3** ✅

### API Endpoints Available

**Public APIs** (no auth required):

- `GET /api/categories` — 10 categories ✅
- `GET /api/sources` — 80 sources kèm categories ✅ (với Bearer: thêm **`is_subscribed`** / user — Task **2.2.3** ✅)

**Authenticated APIs:**

- `GET /api/signals` — list digest (Task **1.10.1** ✅, `auth:sanctum`)
- `GET /api/signals/{id}` — signal detail + tweet attribution (Task **1.11.1** ✅, `auth:sanctum`)
- `POST /api/signals/{id}/archive` — save signal to personal archive (Task **2.5.1** ✅, idempotent 201/200, `auth:sanctum`)
- `DELETE /api/signals/{id}/archive` — remove from archive (Task **2.5.1** ✅, `204 No Content`, idempotent, `auth:sanctum`)
- `GET /api/archive/signals` — list archived signals + filters (Task **2.5.2** ✅, `auth:sanctum`)
- `POST /api/sources` — add user source (Task **2.1.1** ✅, Pro/Power, Option B `pending_review`)
- `POST /api/sources/{id}/subscribe` — My KOLs subscribe (Task **2.2.1** ✅, `auth:sanctum`, cap Pro≤10 / Power≤50)
- `DELETE /api/sources/{id}/subscribe` — unsubscribe (Task **2.2.2** ✅, `204 No Content`, idempotent)

**Next APIs to build:**
- `POST /api/user/categories` (Task **1.3.3** — onboarding; đã có `PATCH /api/me` cho `my_categories`)

**Backend Processing (automated):**

- ✅ Tweet crawling: 4×/day via scheduler (`pipeline:crawl-classify`)
- ✅ Tweet classification: trong `PipelineCrawlJob` (Task **1.7.2**)
- ✅ Tweet clustering: trong `PipelineCrawlJob` (Task **1.8.1**)
- ✅ Summarize + persist: `SignalSummarizerService` + `PipelineCrawlJob` (Tasks **1.8.2–1.8.3** ✅)
- ✅ Ranking trong job: **1.9.3** Step 5 (`SignalRankingService::calculateRankScore`); ✅ draft trong job: **1.9.3** Step 6 (`DraftTweetService::generateDraft`)

---

## Current Sprint: Sprint 1 - Wedge Delivery

### Phase 1: Setup + Infrastructure (Tasks 1.1-1.2) — 8 tasks
- [x] 1.1.1 - Initialize Laravel 11.x + React 18 SPA
- [x] 1.1.2 - Configure external service env vars
- [x] 1.1.3 - Setup PostgreSQL + Redis
- [x] 1.2.1 - Create enum types migration
- [x] 1.2.2 - Create core entity tables migration
- [x] 1.2.3 - Create junction tables migration
- [x] 1.2.4 - Create derived tables migration
- [x] 1.2.5 - Create indexes migration

### Phase 2: Auth + Data Seed (Tasks 1.3-1.5) — 8 tasks

**Status:** 8/8 complete (100%)

- [x] 1.3.1 - OAuth X.com redirect + callback flow ✅
- [x] 1.3.2 - OAuth token exchange + user upsert (merged với 1.3.1) ✅
- [x] 1.3.3 - Onboarding Screen #3: Category selection ✅
- [x] 1.3.4 - Enable subscribe API for onboarding follow step ✅
- [x] 1.3.5 - Onboarding Screen #4: Real API integration (follow/unfollow KOLs filtered by my_categories) ✅
- [x] 1.4.1 - Seed 10 categories migration ✅
- [x] 1.4.2 - Implement GET /api/categories endpoint ✅
- [x] 1.5.1 - Create source pool CSV seed data ✅
- [x] 1.5.2 - Implement source pool seed script ✅
- [x] 1.5.3 - Implement GET /api/sources endpoint ✅

**Next Task:** **1.11.3** (metadata) hoặc **2.4.5** (My KOLs filter toggle) _( **1.10.1** ✅, **1.10.2** ✅, **1.11.1** ✅, **1.11.2** ✅ )._

#### Task 1.3.4: Enable subscribe API for onboarding follow step
**Status:** ✅ COMPLETED (2026-04-14)
**Implementation:**
- Subscribe API supports Free users (cap: 5 KOLs)
- Bulk subscribe API created for "Follow all" button
- Source filtering by my_categories implemented (server-side)
- Plan enforcement: free=5, pro=10, power=50
- Upgrade prompts when Free users hit cap
- Manual testing completed (cURL + browser)
**Files:** SubscriptionController.php, SourceController.php, OnboardingStep2.tsx, sourceService.ts
**Testing:** Manual only (no automated tests, DB-safe)

#### Task 1.3.5: Onboarding Step 2 - Real API Integration
**Status:** ✅ COMPLETED (2026-04-14)
**Implementation:**
- Frontend integrated with real APIs (getOnboardingKOLs, subscribe/unsubscribe)
- KOLs filtered by user's my_categories (stored in users.my_categories int4[] field)
- Follow/Unfollow toggle functionality (no upgrade popup)
- Dynamic counter: X/5 (Free), X/10 (Pro), X/50 (Power)
- "Follow all" bulk subscribe with remaining slot count
- Cap enforcement: disable buttons when full (clean UX)
- Empty state handling when no KOLs match categories
- State persistence across refresh
**Files:** OnboardingStep2.tsx, sourceService.ts
**Testing:** Manual browser testing (10 test cases passed)
**Data:** User 2 test data - my_categories [1,3,5], 62 matching sources

### Phase 3: Tweet Crawling (Tasks 1.6) — 3 tasks

**Status:** ✅ 3/3 complete (100%) - PHASE COMPLETE

- [x] 1.6.1 - Integrate twitterapi.io crawler ✅
- [x] 1.6.2 - Schedule automated tweet crawling ✅
- [x] 1.6.3 - Incremental crawl (chỉ tweet mới) ✅

**Phase 3 Summary:**

- Tweet crawling infrastructure hoàn chỉnh
- Automated 4×/day với scheduler
- Incremental logic prevents duplicates + API waste
- Production-ready crawler system

_(Các task pipeline 1.7–1.9 vẫn theo `IMPLEMENTATION-ROADMAP.md`; nhóm 1.6.x là wedge crawl.)_

### AI / Anthropic wedge (reference) — Tasks 1.7.x+

_(Tiến độ pipeline AI tổng thể: **Phase 4** ở trên — **3/6**.)_

**1.7.1 Integrate Anthropic Claude for Signal Generation** ✅ DONE

- **Status:** Production-ready (theo mốc session 2026-04-08)
- **Service:** `SignalGeneratorService` (350+ lines)
- **Model:** `claude-sonnet-4-20250514`
- **Performance:** ~31% conversion rate, ~0.71 avg impact score (5 signals / 16 tweets, snapshot test)
- **Cost:** ~$0.03–0.05/day estimated (session note)
- **Command:** `php artisan signals:generate [--date] [--dry-run]`
- **Database:** PostgreSQL array format via `DB::raw()`; junction `ON CONFLICT (signal_id, source_id) DO NOTHING`
- **Testing:** Manual tests passing per session log

**Blocking Issues:** None

**Technical Debt:**

- [ ] Add cron scheduling for daily runs (e.g. 7:00 AM)
- [ ] Update SPEC-api.md documentation
- [ ] Add production monitoring/alerts
- [ ] Optimize prompt to reduce token usage

**Dependencies Ready:**

- [x] Anthropic API key configured
- [x] Database schema updated (impact_score, digest title, …)
- [x] Models with proper array handling
- [x] Command with progress reporting

**Next Task:** **1.11.3** — Render metadata _(1.10.1 ✅, 1.10.2 ✅, 1.11.1 ✅, 1.11.2 ✅)._

**1.7.2 Add classify step to PipelineCrawlJob** ✅ DONE (2026-04-08)

- `TweetClassifierService`, `config/signalfeed.php`, prompt `docs/prompts/v1/classify.md`
- `PipelineCrawlJob`: crawl sources → `classifyPendingTweets()`; `ShouldQueue`; scheduler vẫn `dispatch_sync`

**1.8.1 Cluster step (prompt-based)** ✅ DONE (2026-04-09)

- `TweetClusterService`, `LLMClient::cluster()`, `docs/prompts/v1/cluster.md`
- `PipelineCrawlJob`: sau classify → `clusterRecentSignals()`; cluster IDs `cluster_<uuid>`; in-memory tới bước summarize

### Phase 4: AI Pipeline (Tasks 1.7–1.9) — wedge steps

**Status:** 8/8 complete (100%)

- [x] 1.7.1 — Signal generation (`signals:generate`) ✅
- [x] 1.7.2 — Classify step (`TweetClassifierService` + pipeline) ✅
- [x] 1.8.1 — `LLMClient` cluster method + `TweetClusterService` + pipeline ✅
- [x] 1.8.2 — Summarize clusters (`SignalSummarizerService` + `LLMClient::summarize()` + `summarize.md`) ✅ (April 9, 2026)
- [x] 1.8.3 — Wire cluster + summarize + Signal creation trong `PipelineCrawlJob` ✅ (April 9, 2026)
- [x] 1.9.1 — Signal ranking formula (`SignalRankingService`) ✅ (April 9, 2026)
- [x] 1.9.2 — Draft tweet generation (`DraftTweetService` + `generate-draft.md`) ✅ (April 9, 2026)
- [x] 1.9.3 — Integrate ranking + draft into `PipelineCrawlJob` ✅ (April 10, 2026)

### Phase 5: Digest UI (Tasks 1.10-1.12) — 7 tasks
_(Sau Phase 4 pipeline; nhóm UI 1.10–1.12.)_

### Milestone 1.10: List API + Digest UI (Week 3-4) 🔄 IN PROGRESS

**Tasks (theo IMPLEMENTATION-ROADMAP.md):**
- ✅ **1.10.1**: `GET /api/signals` (list digest) - **COMPLETED** ✨
  - Controller: SignalController với filtering logic
  - Resource: SignalResource cho JSON transformation
  - Permission guards: Free tier restrictions
  - my_sources_only filter với EXISTS subquery
  - Manual testing: 8/10 test cases PASS
  
- ✅ **1.10.2**: Digest View Screen #5 — `DigestPage` + real API — **COMPLETED** ✨ (2026-04-10)
  - SPA: `signalService`, map API → UI, hybrid category pills, stats/sidebar aggregates
  
- ✅ **1.11.1**: `GET /api/signals/{id}` (detail endpoint) — **COMPLETED** 2026-04-10
  - `SignalDetailResource` với full source attribution
  - Sources include: `tweet_url`, `tweet_text`, `posted_at` (from tweets JOIN)
  - Permission guard: Free users → `draft_tweets` stripped
  - Error handling: 404, 401
  - Tested: Free/Pro user scenarios, error cases
- ✅ **1.11.2**: Signal Detail Modal (Screen #7) — **COMPLETED** ✨ (2026-04-10)
  - Components: `SignalDetailModal.tsx` (Dialog/Sheet), `SourceAttribution.tsx`, `fetchSignalDetail(id)`
  - Integration: `DigestPage` state; `DigestSignalCard` `onClick`; types `tweet_text` / `posted_at`
  - Features: full summary, sources, `date-fns` timestamps, draft section Pro/Power; manual 14/14 PASS
- ✅ **1.12.1**: `POST /api/signals/{id}/draft/copy` — **COMPLETED** (2026-04-13)
  - `DraftController::copy`, Twitter Web Intent + `UserInteraction` logging (ban đầu)
- ✅ **1.12.2**: Event-driven `copy_draft` logging — **COMPLETED** (2026-04-13)
  - `DraftCopied` / `LogUserInteraction`; `withEvents(discover: false)`; không duplicate listener/DB row
- [ ] **1.11.3**: Render metadata (categories, tags, date) _(backlog / không trong bảng Sprint 2)_
- [x] **1.12.3**: Draft Copy Button + Twitter composer (React) — **COMPLETED** (2026-04-13)
  - `signalService.copyDraft` + Sanctum CSRF; `SignalDetailModal` dual-mode (browser vs X app) + `localStorage` + clipboard

---

## 🎯 Current Focus

**Completed Task:** Task **3.3.2** — Implement PATCH /api/admin/sources/{id} (moderate) endpoint ✅ (April 16, 2026)
**Next Task:** Task **3.3.3** — Build Admin Source Moderation Screen #13 (React)
**Previous Task:** Task **3.3.1** — Implement GET /api/admin/sources (moderation list) endpoint ✅ (April 16, 2026)

### Vừa Hoàn Thành

✅ **Task 3.1.3** — Plan downgrade cleanup logic (2026-04-16)

- `cleanupSubscriptionsToPlanLimit()` trong `StripeWebhookService`
- Enforce cap theo plan đích khi downgrade: Pro 10, Free 5 (`created_at DESC, source_id DESC`)
- Manual testing 7/7 PASS (thừa/đủ/thiếu/recency/tie-break/idempotency/audit log)

✅ **Task 3.1.2** — Implement Stripe Webhook Handler (2026-04-16)

- Hoàn thành hệ thống Webhook Stripe với cơ chế chống xử lý trùng lặp (Idempotency).

✅ **Task 3.1.1** — Implement Stripe Checkout Session Creation (2026-04-16)

- **Stripe SDK:** `stripe/stripe-php` v20.0.0 installed (raw, no Cashier)
- **Endpoint:** `POST /api/billing/checkout` — tạo Checkout Session, trả `checkout_url`
- **Guards:** 409 conflict (same plan), 422 validation, 500 Stripe error (logged)
- **Migration:** `processed_stripe_events` table created (idempotency cho webhook 3.1.2)
- **Config:** `config/services.php` stripe block + `.env` vars (real test keys)
- **Blocker #3 RESOLVED:** Stripe price IDs created in dashboard + configured
- **Testing:** 5/5 manual tests PASS (cURL + tinker, no `php artisan test`)

✅ **Task 1.7.2** — Add classify step to PipelineCrawlJob (2026-04-08)

- **TweetClassifierService:** logic classify
  - `classifyPendingTweets()` — batch + ghi DB, chỉ `signal_score IS NULL`
  - `classifyTweet()` — từng tweet + retry
  - Retry: **3** lần, backoff ~**1s**, **2s** giữa các attempt
  - Idempotent: chỉ classify khi `signal_score` còn `NULL`
  - Lookback: **24h** (config `CLASSIFY_LOOKBACK_HOURS`; `0` = tắt lọc thời gian)

- **Classify prompt:** `docs/prompts/v1/classify.md`  
  - High signal: launches, M&A, funding, breakthroughs  
  - Low signal: cá nhân, spam, nội dung chung chung  
  - Output JSON: `signal_score`, `is_signal`; `reasoning` tuỳ chọn

- **PipelineCrawlJob:** Crawl → Classify → Cluster → Summarize → Persist signals (**1.8.3** ✅) → Rank (**1.9.3** ✅) → Draft (**1.9.3** ✅)  
  - Scheduler **4×/ngày** (01:00, 07:00, 13:00, 19:00 VN)  
  - Job implements `ShouldQueue`; lịch dùng `Schedule::call` + **`dispatch_sync`** (xem `routes/console.php`)

- **Configuration:** `config/signalfeed.php`  
  - `signal_threshold: 0.6` (`SIGNAL_THRESHOLD`)  
  - `classify_batch_size: 200`  
  - `classify_lookback_hours: 24`

- **Test / verify:** PHPUnit **11** tests PASS; kịch bản manual / mẫu SESSION: ~**60%** signals trong batch nhỏ; threshold **≥0.6** → `is_signal`

- **Status:** Production-ready cho bước classify; **Flow 3 step 2** xong

✅ **Task 1.8.1** — Tweet Clustering Implementation (2026-04-09)

- Prompt-based clustering (Phase 1); semantic grouping qua Claude API  
- Flow 3 step 3 **HOÀN THÀNH**

**Implementation:**

- `TweetClusterService::clusterRecentSignals()` / `clusterTweets()` — logic clustering  
- `docs/prompts/v1/cluster.md` — prompt template (`{{TWEETS_JSON}}`)  
- `PipelineCrawlJob` — bước cluster sau classify  
- Config: `CLUSTER_LOOKBACK_HOURS=24`, `MIN_CLUSTER_SIZE=2` (`config/signalfeed.php`)

**Test Results:**

- 5 signal tweets → 2 clusters + 1 unclustered (manual @karpathy)  
- Cluster 1: "LLM personal knowledge bases" (2 tweets)  
- Cluster 2: "npm supply chain attacks" (2 tweets)  
- Semantic grouping chính xác, `cluster_<uuid>` đúng format

**Cost:** ~$0.02/day (4 runs × ~$0.005) — rẻ so với classify

**Status:** Production-ready cho bước clustering; Flow 3 **Crawl ✅ → Classify ✅ → Cluster ✅**; persist signals — **1.8.3** ✅

✅ **Task 1.8.2** — Signal Summarization Service (April 9, 2026, ~10:45 AM)

**Completed:** April 9, 2026 10:45 AM  
**Duration:** ~2 hours (implementation + testing)

**Files Created:**

- `app/Services/SignalSummarizerService.php` (10.4 KB)
- `docs/prompts/v1/summarize.md` (2.2 KB)
- `tests/Feature/SignalSummarizerServiceTest.php` (2.5 KB)

**Files Modified:** `app/Integrations/LLMClient.php` (`summarize()`), `app/Services/FakeLLMClient.php`, `config/anthropic.php`

**Key Deliverables:**

- Summarization service với Claude API integration
- Prompt template cho signal synthesis
- 3-attempt retry logic + JSON/regex fallback
- Output structure ready for `Signal::create()`

**Test Results:**

- ✅ All constraint validations passed
- ✅ Quality checks passed (title 7 words, summary 74 words — manual cluster test)
- ✅ API cost: ~$0.002 per cluster (acceptable)
- ✅ Data structure validated for Task 1.8.3
- ✅ PHPUnit: `SignalSummarizerServiceTest` PASS (`MOCK_LLM`)

**Blockers Resolved:**

- Signal summarization logic complete
- No dependencies blocking Task 1.8.3

**Status:** Flow 3 step 4–5 (summarize + persist) hoàn thành (**1.8.2–1.8.3** ✅).

✅ **Task 1.6.3** — Incremental crawl logic (2026-04-08)

- Dual-mode; Phase **3** Tweet Crawling **100%**

✅ **Task 1.6.2** — Automated tweet crawling scheduler (2026-04-08)

- **4×/day** VN; `withoutOverlapping(120)` _(closure schedule — không `runInBackground`)_

✅ **Task 1.7.1** — Anthropic Claude signal generation (2026-04-08)

- `SignalGeneratorService`; **5** signals / **16** tweets (~**31%** conversion)

✅ **Task 1.6.1** — twitterapi.io crawler (2026-04-07)

- API thật `last_tweets`

### Phase Progress

- ✅ Phase 1: Setup + Infrastructure (**8/8** — 100%)
- ✅ Phase 2: Auth + Data Seed (**8/8** — 100%)
- ✅ Phase 3: Tweet Crawling (**3/3** — 100%)
- ✅ **Phase 4: AI Pipeline** (**8/8** — **100%**)
  - ✅ Task 1.7.1: Signal Generator Service
  - ✅ Task 1.7.2: Classify Step
  - ✅ Task 1.8.1: Cluster Method
  - ✅ Task 1.8.2: Summarize Service (`SignalSummarizerService`)
  - ✅ Task 1.8.3: Wire summarize + Create Signals in job
  - ✅ Task 1.9.1: Ranking Formula (`SignalRankingService`)
  - ✅ Task 1.9.2: Draft tweet generation (`DraftTweetService`)
  - ✅ Task 1.9.3: Rank + draft trong job (`PipelineCrawlJob` Step 5–6)
- ✅ Phase 5: Digest UI (**7/7** — nhóm 1.10–1.12; **1.10.1** ✅ **1.10.2** ✅ **1.11.1** ✅ **1.11.2** ✅ **1.12.1** ✅ **1.12.2** ✅ **1.12.3** ✅)

### Đang Làm

Không có

### Task Tiếp Theo (`IMPLEMENTATION-ROADMAP.md`)

🔜 **Task 2.3.1** — `GET /api/sources?search=` — depends **2.2.2** ✅

- **Sprint 2 tiếp:** **2.3.1** → **2.3.2** (Browse UI polish) / **2.4.1** my-sources → … ; **2.1.3** admin approval nếu tách task
- **Digest:** **1.10.x–1.12.x** ✅; backlog **1.11.3** metadata nếu cần.
- **Pipeline wedge:** Task **1.9.3** ✅ — `PipelineCrawlJob` Step 5–6.

**Pipeline Progress:**

```text
✅ Step 1: Crawl tweets (Task 1.6.x)
✅ Step 2: Classify tweets (Task 1.7.2)
✅ Step 3: Cluster signals (Task 1.8.1)
✅ Step 4: Summarize clusters (Task 1.8.2)
✅ Step 5: Persist signals + junction (Task 1.8.3)
✅ Step 6: Rank signals (1.9.1 + **1.9.3** trong job)
✅ Step 7: Generate drafts (1.9.2 + **1.9.3** trong job)
```

**Technical debt (khác):** cron `signals:generate` (ví dụ 7:00) — xem block Task 1.7.1; onboarding **1.3.3** vẫn mở.

---

## Technical Debt / Known Issues

**Low Priority:**

1. Deprecation warning: BigNumber float casting (non-blocking)
   - **Impact:** Warning logs only
   - **Fix:** Cast floats to string in model mutations / decimal handling
   - **Timeline:** Phase 2 optimization

### Minor Observations (Task 1.8.2)

- ⚠️ Title word count có thể >10 words (logged as warning, not blocking)
- ⚠️ Summary word count có thể outside 50-100 range (quality guideline, not strict)
- ℹ️ These are acceptable trade-offs for natural language quality

**Resolved:**

- ~~Tweet factory missing~~ — Tests dùng `Tweet::query()->create()` / manual setup ✅
- ~~Source pool empty~~ — CSV seed + 80 sources documented ✅

---

## Blockers

**None currently**

_(Removed: API credits depleted — resolved via top-up hoặc không chặn dev; HTTP 402 vẫn có thể xảy ra khi hết credits — top-up khi scale production.)_

---

## Next Session Plan

### Target
- **Task 2.3.1** / **2.4.1** / **2.1.3** — Server-side search, `GET /api/my-sources`, hoặc my submissions / admin queue. _(Backlog: **1.11.3** metadata, **1.3.3** onboarding polish.)_

### Pre-requisites
- [x] WSL / dev environment
- [x] PostgreSQL + migrations
- [x] OAuth X.com (1.3.1)
- [x] Category seed + API (1.4.1–1.4.2)
- [x] Source pool CSV (1.5.1)
- [x] Source pool seeder (1.5.2)
- [x] Anthropic signal generation (1.7.1)
- [x] Scheduled tweet crawl (1.6.2)
- [x] Incremental crawl (1.6.3)
- [x] Classify step (1.7.2)
- [x] Cluster step (1.8.1)
- [x] Summarize service (1.8.2)
- [x] Pipeline persist signals (1.8.3)
- [x] Signal ranking (1.9.1)
- [x] Draft tweet generation (1.9.2)
- [x] Rank + draft trong pipeline job (1.9.3)

### Expected Duration
Tuỳ scope **2.3.1** (search) hoặc **2.4.1** (my-sources) hoặc **2.1.3** (my submissions); polish 1.11.3 / 1.3.3 tách khỏi chuỗi Sprint 2

---

## 🎯 Next Milestones

### Immediate (This Week)

- [x] **Task 1.8.3:** Integrate cluster + summarize + persist signals trong `PipelineCrawlJob` ✅ (2026-04-09)
- [x] **Task 1.9.1:** Implement signal ranking algorithm (`SignalRankingService`) ✅ (2026-04-09)
- [x] **Task 1.9.2:** Draft tweet generation (`DraftTweetService`) ✅ (2026-04-09)
- [x] **Task 1.9.3:** Integrate ranking + draft into pipeline job ✅ (2026-04-10)

### Short-term (Next 2 Weeks)

- [x] **Task 1.10.1:** `GET /api/signals` ✅ (2026-04-10)
- [x] **Task 1.10.2:** Digest View Screen #5 (real API) ✅ (2026-04-10)
- [x] **Task 1.11.1:** `GET /api/signals/{id}` ✅ (2026-04-10)
- [x] **Task 1.11.2:** Signal Detail Modal (Screen #7) ✅ (2026-04-10)
- [ ] **Task 1.11.3:** Render metadata (categories, tags, date) _(backlog)_
- [x] **Tasks 1.12.1–1.12.3:** Draft copy API + logging + Copy to X UI ✅ (2026-04-13)
- [x] **Task 2.1.1:** `POST /api/sources` (add user source) ✅ (2026-04-13)
- [x] **Task 2.1.2:** Add Source Form Screen #11 (React, Option B) ✅ (2026-04-14)
- [x] **Task 2.2.1:** `POST /api/sources/{id}/subscribe` ✅ (2026-04-14)

---

## 📊 Project Statistics (Updated: April 10, 2026)

**Pipeline Completion (Flow 3 steps):**

- Crawl: ✅ 100%
- Classify: ✅ 100%
- Cluster: ✅ 100%
- Summarize + persist signals: ✅ 100% _(Tasks 1.8.2–1.8.3)_
- Rank: ✅ formula (**1.9.1**) + job Step 5 (**1.9.3**)
- Draft: ✅ service (**1.9.2**) + job Step 6 (**1.9.3**)

**Overall Pipeline Progress:** 100% (wedge pipeline end-to-end trong `PipelineCrawlJob`)

**Services Implemented:**

- TweetCrawlerService ✅
- TweetClassifierService ✅
- TweetClusterService ✅
- SignalSummarizerService ✅
- SignalRankingService ✅ (wired in **`PipelineCrawlJob`** — **1.9.3**)
- DraftTweetService ✅ (wired in **`PipelineCrawlJob`** — **1.9.3**)

**Test Data (snapshot Task 1.8.3 session 2026-04-09 — môi trường có thể khác):**

- Signal tweets: 62
- Clusters: 6; unclustered: 48
- Signals persisted: 7; `signal_sources` rows: 16

---

## Metrics Update (2026-04-08 / cluster 2026-04-09 / summarize 2026-04-09 / pipeline persist 2026-04-09)

### API Integration

- **Anthropic API:** ✅ Connected
- **Model:** `claude-sonnet-4-20250514`
- **Credits:** ~$4.71 remaining (session snapshot)
- **Signal generation (1.7.1):** 5 signals, ~0.71 avg impact, ~31% conversion (16 tweets)
- **Classify pipeline (1.7.2):** `TweetClassifierService` + `PipelineCrawlJob`; threshold **0.6**; PHPUnit suite PASS; ước tính chi phí scale classify ~**$9.60**/day (giả định volume — đối chiếu dashboard Anthropic)
- **Cluster pipeline (1.8.1):** `TweetClusterService` + `LLMClient::cluster()`; ước tính ~**$0.02**/day (4 runs × ~$0.005)
- **Summarize service (1.8.2):** `SignalSummarizerService` + `LLMClient::summarize()`; ~**$0.002**/cluster; ước tính ~**$0.40**/day (50 clusters × 4 runs)

**Updated Daily Pipeline Costs (after Task 1.8.3 — ước tính, chỉnh theo volume thực tế):**

| Thành phần | ~$/run × 4 runs | ~$/day |
|------------|----------------|--------|
| Crawl (twitterapi.io) | ~$0.50 × 4 | ~$2.00 |
| Classify | ~$2.40 × 4 | ~$9.60 |
| Cluster | ~$0.02 × 4 | ~$0.08 |
| Summarize | ~$0.10 × 4 | ~$0.40 |
| **Tổng pipeline (AI + crawl)** | — | **~$12.08** (~$362/month) |

**Status:** ✅ Within acceptable budget

### Code Quality (1.7.1)

- **Service layer:** ✅ Transactions (`storeSignals`)
- **Error handling:** ✅ Try-catch + logging (batch / API / parse)
- **PostgreSQL compatibility:** ✅ Raw array literals + junction conflict handling
- **Command interface:** ✅ `signals:generate` với `--date`, `--dry-run`

### Code Quality (1.7.2)

- **TweetClassifierService:** ✅ Retry + logging kênh `crawler` / `crawler-errors`
- **Idempotency:** ✅ `whereNull('signal_score')` + migration default NULL

### Code Quality (1.8.1)

- **TweetClusterService:** ✅ Parse JSON + fallback toàn `unclustered` khi LLM lỗi; `cluster_<uuid>` gán server-side
- **Tests:** `TweetClusterServiceTest` + cập nhật job tests

### Code Quality (1.8.2)

- **SignalSummarizerService:** ✅ Retry + JSON/regex fallback + validation (title/tags); log `crawler` / `crawler-errors`
- **Tests:** `SignalSummarizerServiceTest` (PHPUnit + `FakeLLMClient::summarize()`)

---

## Recent Decisions

**2026-04-09 — Task 1.8.3 Pipeline persist signals**

- **Quyết định:** `PipelineCrawlJob` gọi `SignalSummarizerService` theo cluster; `Digest::firstOrCreate` theo ngày; insert `signals` + `signal_sources`; idempotency `idx_signals_cluster_digest` + `persistableClusterId` (hash digest + tweet ids).
- **Kết quả:** 7 signals / 16 junction rows (session test); duplicate → QueryException **23505**.
- **Follow-up:** **1.9.1** ranking formula ✅; **1.9.2** draft generation ✅; **1.9.3** tích hợp rank + draft vào job ✅ (2026-04-10).

**2026-04-09 — Task 1.9.1 Signal ranking formula**

- **Quyết định:** `SignalRankingService` — `rank_score = 0.4×source + 0.3×quality + 0.3×recency`; `source_score = min(1, log(n+1)/log(6))`; quality = avg `tweet.signal_score` qua `signal_sources`; recency = `exp(-hours/24)`; clamp + làm tròn 4 chữ số.
- **Kết quả:** 7 signals xếp hạng trong session verify; `EXPLAIN ANALYZE` dùng index `idx_signals_rank_score`.
- **Done:** **1.9.3** — `calculateRankScore()` + `generateDraft()` trong `PipelineCrawlJob` sau persist signals (2026-04-10).

**2026-04-09 — Task 1.9.2 Draft tweet generation**

- **Quyết định:** `DraftTweetService` tách biệt; prompt `docs/prompts/v1/generate-draft.md`; category-aware instructions; ≤280 chars strict; idempotent (keep first draft).
- **Implementation:**
  - `DraftTweet` model + `Signal->draft()` relationship
  - Category priority: Funding > Acquisition > Product Launch > AI > Research
  - Character validation: `normalizeDraftLength` truncate + log nếu >280; warnings nếu <80 hoặc ngoài target 120–200
  - Fallback: signal title on API error
  - Testing: 16-step Tinker validation; only 1 API call used (~$0.001)
- **Test / kết quả:** 2 drafts verified (161-191 chars); quality OK (specific facts, active voice, no hype); character limits enforced ✅.
- **Cost:** ~$0.03/day draft (ước tính 7 signals × 4 runs); total pipeline ~$10.05/day.
- **Impact:** **1.9.3** ✅ — ranking + draft wired trong `PipelineCrawlJob`; **1.10.1** list API signals ✅; **1.10.2** digest UI ✅; **1.11.1** detail API ✅; **1.11.2** detail modal ✅; next: **1.11.3** metadata.

**2026-04-09 — Task 1.8.2 Signal summarization service**

- **Quyết định:** `SignalSummarizerService` tách biệt generator; prompt `docs/prompts/v1/summarize.md`; `LLMClient::summarize()` + `FakeLLMClient::summarize()`; config `anthropic.models.summarize`.
- **Output:** `{cluster_id, title, summary, topic_tags, source_count, tweet_ids}` — sẵn cho persist **1.8.3**.
- **Test:** Manual cluster @karpathy + PHPUnit PASS; chi phí ~**$0.002**/cluster.

**2026-04-09 — Task 1.8.1 Tweet clustering deployed**

- **Quyết định:** Prompt-based clustering (SPEC amendment 2026-04-06); in-memory trong `PipelineCrawlJob`; lookback `created_at` **24h** (`CLUSTER_LOOKBACK_HOURS`).
- **Implementation:** `TweetClusterService`, `docs/prompts/v1/cluster.md`, `LLMClient::cluster()` / `FakeLLMClient::cluster()`.
- **Test / kết quả:** Manual 5 tweets → 2 clusters + 1 unclustered; PHPUnit suite PASS.
- **Cost:** ~**$0.02**/day cluster (ước tính) vs classify scale ~**$9.60**/day.
- **Impact:** Flow 3 **Crawl ✅ → Classify ✅ → Cluster ✅**; persist — **1.8.3** ✅.

**2026-04-08 — Task 1.7.2 Classify pipeline deployed**

- **Quyết định:** Job-based pipeline (`PipelineCrawlJob`) + service riêng `TweetClassifierService`
- **Implementation:**
  - `classifyPendingTweets()` + `classifyTweet()`; prompt `docs/prompts/v1/classify.md`
  - Threshold **0.6** (`SIGNAL_THRESHOLD` / `config/signalfeed.php`)
  - Retry **3** lần, backoff ~**1s** / **2s**
  - Chỉ classify tweet `signal_score IS NULL`; lookback **24h** (config)
  - Scheduler: `dispatch_sync` trong `Schedule::call` (ổn định khi chưa có queue worker)
- **Test / kết quả:** PHPUnit **11** PASS; kịch bản mẫu ~**60%** signal rate; threshold `≥0.6` → `is_signal`
- **Cost estimate (scale):** ~**$9.60**/day nếu ~3.200 calls × ~$0.003 (chỉnh theo usage thực tế)
- **Impact (2026-04-08):** Flow 3 **Crawl ✅ → Classify ✅**. **Cập nhật 2026-04-09:** **Cluster ✅** (Task 1.8.1 — xem *Current Focus*).
- **Roadmap sau đó:** **1.8.3** ✅ → **1.9.1** ✅ → **1.9.3** ✅ (rank + draft trong job, 2026-04-10) → **1.10.1** ✅ → **1.10.2** digest UI ✅ → **1.11.1** detail API ✅ → **1.11.2** modal ✅ → **1.11.3** metadata.

**2026-04-08 — Task 1.6.3 Incremental crawl deployed**

- **Quyết định:** Client-side filtering approach (API không support time-based params)
- **Implementation:**
  - Dual-mode: Initial (fetch all) vs Incremental (filter by timestamp)
  - Update `last_crawled_at` after successful crawl
  - UNIQUE constraint prevents duplicates
  - Comprehensive logging: mode, metrics, duplicates
- **Test results:**
  - ✅ 10 tweets saved (initial mode)
  - ✅ 10 old tweets skipped (incremental mode)
  - ✅ 0 duplicates in database
  - ✅ Timestamp updates correctly
- **Impact:**
  - Phase 3 (Tweet Crawling) complete 100%
  - Reduced API calls via incremental filtering
  - No duplicate storage waste
  - Production-ready crawler system
- **Later pipeline:** persist signals **1.8.3** ✅; ranking **1.9.1** ✅; rank + draft trong job **1.9.3** ✅ (2026-04-10).

**2026-04-08 13:09 +07 — Task 1.6.2 Scheduler deployed**

- **Quyết định:** Laravel Task Scheduler trong `routes/console.php` — cron **`0 1,7,13,19 * * *`**, timezone **`Asia/Ho_Chi_Minh`** (4 slot/ngày giờ VN); `withoutOverlapping(120)`; logging tách kênh (`scheduler`, `crawler`, `crawler-errors`). _(Scheduled closure: không dùng `runInBackground`.)_
- **Kết quả:**
  - ✅ Thực thi theo lịch đã verify (ví dụ mốc 13:00 VN)
  - ✅ Crawler xử lý nhiều source trong một run
  - ⚠️ HTTP **402** khi credits twitterapi.io hết — cần top-up cho production
  - ✅ Lỗi được log, crawl tiếp các source còn lại
- **Production:** Cron host: `* * * * * cd /var/www/signalfeed && php artisan schedule:run` (xem `docs/deployment/scheduler-setup.md`)
- **Action items:**
  - [ ] Top-up twitterapi.io credits
  - [ ] Monitor 24h đầu chạy tự động
  - [ ] Verify tweets tích lũy trong DB sau các slot

**2026-04-08 — Task 1.7.1 Anthropic signal generation**

- **Quyết định:** Model API `claude-sonnet-4-20250514`; lưu `categories`/`topic_tags` PostgreSQL bằng `DB::raw()`; `signal_sources` insert kèm `ON CONFLICT (signal_id, source_id) DO NOTHING`; lấy `signal` id sau insert bằng `insertGetId` (tránh `latest()` theo `created_at` gây trùng PK).
- **Kết quả:** Command `signals:generate` chạy được; snapshot test 5 signals / 16 tweets.
- **Chi phí / credits:** ~$5 nạp, ~$0.05 test (ghi nhận trong SESSION-LOG).

**2026-04-07 20:25 +07 — Task 1.6.1 API endpoint discovery**

- **Quyết định:** Dùng endpoint **`/twitter/user/last_tweets`** với query **`userName`** (+ **`count`**), base **`https://api.twitterapi.io`** (không `/v1`).
- **Bối cảnh:** Bản nháp `/v1/user/tweets` và path cũ → 404 / không khớp JSON; docs twitterapi.io có nhiều biến thể — đã thử và chốt path khớp OpenAPI thực tế.
- **Kết quả:**
  - ✅ Crawler chạy được với API thật (tweet thật, không mock)
  - ✅ **16** tweets trên snapshot dev; **3/80** source đã có `last_crawled_at` (mở rộng khi chạy full crawl)
  - ✅ `userName` đơn giản hơn flow bắt buộc `user_id` + lookup (MVP wedge)
- **Bài học:** Doc có thể lệch; khi 404 nên đối chiếu OpenAPI / thử path; ưu tiên verify bằng request thật.

**2026-04-07 15:06 +07 — Task 1.5.3 API Design**

- **Quyết định:** Không pagination, không filtering cho wedge MVP.
- **Lý do:**
  - Dataset nhỏ: 80 sources ≈ ~30–50KB response
  - Frontend có thể filter/search phía client
  - Đơn giản > tính năng cho wedge validation
  - Pagination/filtering bổ sung sau khi scale
- **Kết quả:**
  - ✅ API phản hồi nhanh (~200ms)
  - ✅ Triển khai đơn giản (~24 phút session)
  - ✅ Đủ tốt cho founder dogfood test
- **Trade-off chấp nhận:**
  - Không scale sẵn cho 10.000+ sources
  - Frontend phải xử lý filtering
  - OK cho wedge phase; refactor khi đã proven

**2026-04-07 14:34 +07 — Task 1.5.2 Seeder Success**

- **Quyết định:** Import trực tiếp từ CSV vào DB (không qua API).
- **Lý do:**
  - Seeder pattern phù hợp cho platform-curated data
  - Transaction-wrapped đảm bảo data integrity
  - Preload categories mapping tránh N+1 queries
- **Kết quả:**
  - ✅ 80 sources imported successfully
  - ✅ 190 category links created (avg 2.4/source)
  - ✅ No errors, data integrity perfect

**2026-04-07 13:55 — Task 1.5.1 Sample Data Strategy**

- **Quyết định:** Tạo **80 accounts** sample thay vì 500 full dataset.
- **Lý do:**
  - Execute fast — `PRODUCT-STRATEGY.md` kill checkpoint cần data ngay
  - 80 accounts đủ để test seeder logic + API endpoints
  - Mix realistic: AI/ML, Crypto, Marketing, Startups, Indie hackers
  - Có thể expand sau khi wedge proven với real users
- **Kết quả:**
  - ✅ CSV created in 35 minutes (vs ước tính 2–4 giờ cho 500 real)
  - ✅ Data quality cao (realistic handles, proper categorization)
  - ✅ Ready for seeder implementation
- **Trade-off accepted:**
  - Sample data đủ cho dogfood test
  - Production sẽ cần expand (có thể crowdsource từ users)

**2026-04-07 12:20 — Grouped Tasks 1.4.1–1.4.2**

- **Quyết định:** Thực hiện 2 tasks liên quan cùng lúc trong 1 session.
- **Lý do:**
  - Task 1.4.2 phụ thuộc trực tiếp vào 1.4.1 (cần data để test API).
  - Cả 2 đều là STANDARD tasks, đơn giản.
  - Tiết kiệm context switching time.
- **Kết quả:**
  - ✅ Hoàn thành trong 19 phút
  - ✅ Không có bug
  - ✅ Hiệu suất cao (2 prompts cho 2 tasks)

**2026-04-07 11:48 — Task 1.3.1 OAuth Implementation**

- **Quyết định:** Sử dụng `twitter-oauth-2` driver thay vì `twitter`.
- **Lý do:** Twitter OAuth 2.0 API format compatibility.
- **Kết quả:** ✅ OAuth flow hoạt động hoàn hảo (scopes gồm `offline.access`; upsert user + `audit_logs.oauth_login` trong `AuthService` — xem `SESSION-LOG.md` Task 1.3.1).

---

## Files to Sync to Project Knowledge

- [x] PROJECT-STATUS.md (this file)
- [x] SESSION-LOG.md
- [ ] schema.sql (after migrations / dump nếu cần)

---

*Derived from IMPLEMENTATION-ROADMAP.md + session notes*
