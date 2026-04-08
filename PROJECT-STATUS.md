# SignalFeed - Project Status

**Last Updated:** 2026-04-08 (Task 1.7.1 complete)
**Current Phase:** Giai đoạn 3 - Implementation
**Current Sprint:** Sprint 1 - Wedge Delivery
**Current Task:** **1.7.2** — Build Digest Compilation Engine — *tuỳ ưu tiên có thể làm **1.6.2** (cron crawl) trước*

---

## Quick Stats

### Sprint 1 Progress (34 tasks total)
- **Completed:** 16/34 (47%)
- **In Progress:** None
- **Blocked:** None

### Code Metrics
- **Backend:** 55% (Auth + DB + Categories + Sources + API + Crawler + Signal generation complete)
- **Frontend:** 5% (Scaffold only)
- **Database:** 100% (All migrations done)
- **Seed Data:** 100% (Categories ✅, Sources CSV ✅, Sources imported ✅)
- **Tests:** 6/6 manual tests passed (OAuth, Categories seed, Categories API, Sources seed, Sources API, Crawler)

### Integration Status
- [x] OAuth X.com (Task 1.3.1 complete) ✅
- [x] Categories API (Task 1.4.2 complete) ✅
- [x] Sources API (Task 1.5.3 complete) ✅
- [x] twitterapi.io (Task 1.6.1 complete) ✅  
  - Endpoint: `/twitter/user/last_tweets` (`userName` + `count`)  
  - API key: cấu hình qua `.env` (active khi có key)  
  - Rate limit: sleep 3s giữa các source (dev)
- [x] Anthropic Claude (Task 1.7.1 complete) ✅  
  - Model: `claude-sonnet-4-20250514`  
  - Command: `php artisan signals:generate [--date] [--dry-run]`  
  - Credits: ~$4.95 remaining (snapshot sau test)
- [ ] Stripe (Sprint 3)
- [ ] Resend (Sprint 2+)

### Data Metrics

**Database (snapshot dev, có thể thay sau crawl full / OAuth):**

- Categories: **10** ✅
- Sources: **80** ✅
- Tweets: **16** ✅ (twitterapi.io thật; crawl full 80 nguồn chưa chạy xong trên snapshot này)
- Users: **tùy** (sau `migrate:fresh` có thể 0 — đăng nhập OAuth lại để có bản ghi)
- Signals: **5** ✅ (Task 1.7.1 — manual run từ 16 tweets; conversion ~31%, avg impact ~0.71)

**Độ “fresh”:**

- `last_crawled_at`: **3/80** sources đã crawl trong snapshot hiện tại; chạy `php artisan tweets:crawl --limit=10` để bao phủ dần.
- Tweet timeline: dữ liệu gần đây từ API (theo `last_tweets`).
- Sẵn sàng bước tiếp (signal pipeline): sau khi có đủ tweets + Task 1.7.x.

### API Endpoints Available

**Public APIs** (no auth required):

- `GET /api/categories` — 10 categories ✅
- `GET /api/sources` — 80 sources kèm categories ✅

**Authenticated APIs:**

- Chưa có (Phase 3–4)

**Next APIs to build:**

- `GET /api/tweets` (hậu Task 1.6.x)
- `GET /api/signals` (Task 1.7.x)
- `POST /api/user/categories` (liên quan Task 1.3.3)

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

**Status:** 6/8 complete (75%)

- [x] 1.3.1 - OAuth X.com redirect + callback flow ✅
- [x] 1.3.2 - OAuth token exchange + user upsert (merged với 1.3.1) ✅
- [ ] 1.3.3 - Onboarding Screen #3: Category selection
- [x] 1.4.1 - Seed 10 categories migration ✅
- [x] 1.4.2 - Implement GET /api/categories endpoint ✅
- [x] 1.5.1 - Create source pool CSV seed data ✅
- [x] 1.5.2 - Implement source pool seed script ✅
- [x] 1.5.3 - Implement GET /api/sources endpoint ✅

**Next Task:** 1.7.2 (digest compilation) hoặc 1.6.2 (cron crawl) tùy ưu tiên

### Phase 3: Tweet Crawling (Tasks 1.6) — 3 tasks

**Status:** 1/3 complete (33%)

- [x] 1.6.1 - Integrate twitterapi.io crawler ✅
- [ ] 1.6.2 - Schedule automated tweet crawling (cron / scheduler)
- [ ] 1.6.3 - Incremental crawl (chỉ tweet mới)

_(Các task pipeline 1.7–1.9 vẫn theo `IMPLEMENTATION-ROADMAP.md`; nhóm 1.6.x là wedge crawl.)_

### Phase 1 — Core Infrastructure (AI / pipeline wedge): Task 1.7 AI Integration Layer ✅ COMPLETED (2026-04-08)

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

**Next Task:** **1.7.2** Build Digest Compilation Engine (pending start)

### Phase 4: Digest UI (Tasks 1.10-1.12) — 7 tasks
_(Will expand after Phase 3 complete)_

---

## Current Focus

### Vừa Hoàn Thành

✅ **Task 1.7.1** — Anthropic Claude signal generation (~4h session 2026-04-08)

- `SignalGeneratorService` + `signals:generate`; model `claude-sonnet-4-20250514`
- **5** signals từ **16** tweets (~31% conversion, ~0.71 avg impact); PostgreSQL arrays + `insertGetId` + `ON CONFLICT` junction
- Credits: ~$5 purchased, ~$0.05 spent testing, ~$4.95 remaining (snapshot log)

✅ **Task 1.6.1** — twitterapi.io crawler (303 phút theo mốc SESSION-LOG 15:20 → 20:23; thời gian code effectif ngắn hơn)

- **16** tweets đã lưu (snapshot DB dev); crawl full **80** nguồn: chạy `tweets:crawl --limit=10` khi sẵn sàng quota
- API thật: `GET …/twitter/user/last_tweets` + `userName` / `count`
- Rate limit: sleep **3s** giữa các source
- **3/80** sources có `last_crawled_at` trên snapshot hiện tại (sẽ tăng khi crawl tiếp)

### Phase Progress

- ✅ Phase 1: Setup + Infrastructure (**8/8** — 100%)
- ✅ Phase 2: Auth + Data Seed (**6/8** — 75%)
- 🚧 Phase 3: Tweet Crawling (**1/3** — 33%)
- 🚧 AI signal layer Task **1.7.1** ✅; **1.7.2+** pending
- ⏸️ Phase 4: Digest UI (**0/7** — chưa bắt đầu nhóm 1.10–1.12)

### Đang Làm

Không có

### Task Tiếp Theo

🔜 **Task 1.7.2** — Build Digest Compilation Engine

- **Loại:** CRITICAL (pipeline wedge)
- **Dependencies:** 1.7.1 ✅ (signals + digest row)
- **Mục tiêu:** Biên dịch digest từ signals theo roadmap & SPEC

**Tuỳ chọn song song:** **Task 1.6.2** — cron crawl; **cron signals** (7:00 AM) — technical debt đã ghi trong Task 1.7 block.

---

## Blockers

**None currently**

---

## Next Session Plan

### Target
- **1.7.2** — Digest compilation engine; hoặc **1.6.2** scheduler crawl; **1.3.3** onboarding tuỳ ưu tiên.

### Pre-requisites
- [x] WSL / dev environment
- [x] PostgreSQL + migrations
- [x] OAuth X.com (1.3.1)
- [x] Category seed + API (1.4.1–1.4.2)
- [x] Source pool CSV (1.5.1)
- [x] Source pool seeder (1.5.2)
- [x] Anthropic signal generation (1.7.1)

### Expected Duration
Tuỳ scope (1.7.2 vs 1.6.2 vs 1.3.3)

---

## Metrics Update (2026-04-08)

### API Integration

- **Anthropic API:** ✅ Connected
- **Model:** `claude-sonnet-4-20250514`
- **Credits:** ~$4.95 remaining (session snapshot)
- **Test results:** 5 signals, ~0.71 avg impact, ~31% conversion (16 tweets)

### Code Quality (1.7.1)

- **Service layer:** ✅ Transactions (`storeSignals`)
- **Error handling:** ✅ Try-catch + logging (batch / API / parse)
- **PostgreSQL compatibility:** ✅ Raw array literals + junction conflict handling
- **Command interface:** ✅ `signals:generate` với `--date`, `--dry-run`

---

## Recent Decisions

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
