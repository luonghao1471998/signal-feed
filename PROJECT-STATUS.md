# SignalFeed - Project Status

**Last Updated:** 2026-04-08 16:07 +07 (Task 1.7.2 complete)
**Current Phase:** Giai đoạn 3 - Implementation
**Current Sprint:** Sprint 1 - Wedge Delivery
**Current Task:** **1.8.1** — Implement LLMClient cluster method (tiếp pipeline: Cluster signals)

---

## Overall Progress

**Phase 1 (MVP) - Core Pipeline:**

- [x] 1.6.1 - Twitter Crawler (twitterapi.io integration) ✅
- [x] 1.6.2 - Scheduler (4×/day automated crawl) ✅
- [x] 1.6.3 - Incremental Crawl (only new tweets) ✅
- [x] 1.7.1 - LLM Integration (Anthropic Claude API) ✅
- [x] 1.7.2 - Classify Pipeline (signal detection) ✅ ← **COMPLETED**
- [ ] 1.8.1 - Cluster Step (group similar tweets) ← **NEXT**
- [ ] 1.8.2 - Summarize Step (generate signal summaries)
- [ ] 1.8.3 - Add cluster + summarize to pipeline
- [ ] 1.9.1 - Rank signals (importance scoring)
- [ ] 1.9.2 - Generate drafts (tweet composer)

**Progress:** 5/10 wedge tasks complete (50%) 🎯  
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

**Next:** Task 1.8.1 — `LLMClient::cluster()` method

## Current Sprint Status

**Active Task:** Task 1.8.1 — Implement `LLMClient::cluster()`  
**Started:** TBD  
**Target:** TBD

**Recent Completions:**

- ✅ 2026-04-08: Task 1.7.2 — Classify pipeline complete
- ✅ 2026-04-08: Task 1.6.3 — Incremental crawl
- ✅ 2026-04-08: Task 1.7.1 — LLM integration (signal generation)
- ✅ 2026-04-08: Task 1.6.2 — Scheduler (tweet crawl)
- ✅ 2026-04-07: Task 1.6.1 — Twitter crawler

**Velocity:** ~1.5 wedge tasks/day (ước lượng theo các mốc gần đây) 🚀

---

## Quick Stats

### Sprint 1 Progress (34 tasks total)
- **Completed:** 19/34 (56%)
- **In Progress:** None
- **Blocked:** None

### Code Metrics
- **Backend:** 65% (Auth + DB + Categories + Sources + API + Crawler + Scheduler + Incremental + Signal generation + **Classify pipeline** complete)
- **Frontend:** 5% (Scaffold only)
- **Database:** 100% (All migrations done)
- **Seed Data:** 100% (Categories ✅, Sources CSV ✅, Sources imported ✅)
- **Tests:** Feature `SchedulerTest` + manual (OAuth, seed, APIs, crawler, incremental, signals, **classify**)

### Integration Status
- [x] OAuth X.com (Task 1.3.1 complete) ✅
- [x] Categories API (Task 1.4.2 complete) ✅
- [x] Sources API (Task 1.5.3 complete) ✅
- [x] twitterapi.io (Tasks 1.6.1-1.6.3 complete) ✅  
  - Endpoint: `/twitter/user/last_tweets` (`userName` + `count`)  
  - API key: cấu hình qua `.env` (active khi có key)  
  - Rate limit: sleep 3s giữa các source (dev)
  - **Scheduler:** 4×/day automated (Task 1.6.2 ✅)
  - **Incremental:** Client-side filtering by `last_crawled_at` (Task 1.6.3 ✅)
  - **Duplicate prevention:** UNIQUE constraint + logging
- [x] Anthropic Claude (Tasks 1.7.1-1.7.2 complete) ✅  
  - Model: `claude-sonnet-4-20250514`  
  - **Signal generation:** `php artisan signals:generate` (Task 1.7.1)  
  - **Tweet classification:** `TweetClassifierService` (Task 1.7.2 ✅)  
    - Classify prompt: `docs/prompts/v1/classify.md`  
    - Signal threshold: **0.6** (configurable `SIGNAL_THRESHOLD` / `config/signalfeed.php`)  
    - Conversion rate: ~**60%** (kịch bản mẫu / manual; PHPUnit 11 tests PASS)  
    - Retry logic: **3** attempts, exponential backoff (~**1s**, **2s** giữa các attempt)  
    - Performance: ~**2–3s**/tweet (ước lượng, tuỳ API)  
  - **Pipeline:** `PipelineCrawlJob` orchestrates **Crawl → Classify**; scheduler: `dispatch_sync` trong `Schedule::call` (chạy ngay khi `schedule:run`, không phụ thuộc worker queue)  
  - Credits: ~**$4.71** remaining (snapshot); **ước tính scale:** ~**$9.60**/day nếu ~3.200 classify calls/day (giả định ~$0.003/call — chỉnh theo usage thực tế)  
- [ ] Stripe (Sprint 3)
- [ ] Resend (Sprint 2+)

### Data Metrics

**Database (snapshot sau Task 1.7.2 — số liệu môi trường có thể khác):**

- Categories: **10** ✅
- Sources: **80** ✅
- Tweets: **~200** ✅ (twitterapi.io + scheduler automated — mục tiêu scale; dev có thể thấp hơn)
  - **Classified:** ~**50** tweets có `signal_score` (ước lượng sau pipeline)
  - **Signals:** ~**30** tweets (`is_signal = true`) — ~**60%** so với đã classify (minh hoạ)
- Users: **tùy** (sau `migrate:fresh` có thể 0 — đăng nhập OAuth lại để có bản ghi)
- Signals: **5** ✅ (Task 1.7.1 — manual run; pipeline tự sinh signal sau Task **1.8.3** / **1.9.x**)

**Độ "fresh":**

- `last_crawled_at`: cập nhật **4×/ngày** qua scheduler (khi cron + credits ổn)
- Tweet classification: tự classify trong `PipelineCrawlJob` (Task **1.7.2** ✅)
- Signal generation: manual `signals:generate` cho wedge; auto full pipeline pending Tasks **1.8.x–1.9.x**

### API Endpoints Available

**Public APIs** (no auth required):

- `GET /api/categories` — 10 categories ✅
- `GET /api/sources` — 80 sources kèm categories ✅

**Authenticated APIs:**

- Chưa có (Phase 5)

**Next APIs to build:**

- `GET /api/signals` (Task **1.10.1** — sau khi pipeline cluster/summarize/rank/draft xong)
- `POST /api/user/categories` (Task **1.3.3** — onboarding)

**Backend Processing (automated):**

- ✅ Tweet crawling: 4×/day via scheduler (`pipeline:crawl-classify`)
- ✅ Tweet classification: trong `PipelineCrawlJob` (Task **1.7.2**)
- ⏸️ Signal generation end-to-end: pending Tasks **1.8.x–1.9.x** (cluster, summarize, rank, draft)

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

**Next Task:** 1.8.1 (cluster) hoặc 1.3.3 (onboarding) tùy ưu tiên

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

_(Tiến độ pipeline AI tổng thể: **Phase 4** ở trên — **2/6**.)_

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

**Next Task:** **1.8.1** — `LLMClient::cluster()` + tích hợp pipeline (roadmap)

**1.7.2 Add classify step to PipelineCrawlJob** ✅ DONE (2026-04-08)

- `TweetClassifierService`, `config/signalfeed.php`, prompt `docs/prompts/v1/classify.md`
- `PipelineCrawlJob`: crawl sources → `classifyPendingTweets()`; `ShouldQueue`; scheduler vẫn `dispatch_sync`

### Phase 4: AI Pipeline (Tasks 1.7–1.9) — wedge steps

**Status:** 2/6 complete (33%)

- [x] 1.7.1 — Signal generation (`signals:generate`) ✅
- [x] 1.7.2 — Classify step (`TweetClassifierService` + pipeline) ✅
- [ ] 1.8.1 — `LLMClient` cluster method
- [ ] 1.8.2 — Summarize method
- [ ] 1.8.3 — Cluster + summarize trong job
- [ ] 1.9.1 / 1.9.2 / 1.9.3 — Rank + draft + job steps

### Phase 5: Digest UI (Tasks 1.10-1.12) — 7 tasks
_(Sau Phase 4 pipeline; nhóm UI 1.10–1.12.)_

---

## Current Focus

### Vừa Hoàn Thành

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

- **PipelineCrawlJob:** Crawl → Classify  
  - Scheduler **4×/ngày** (01:00, 07:00, 13:00, 19:00 VN)  
  - Job implements `ShouldQueue`; lịch dùng `Schedule::call` + **`dispatch_sync`** (xem `routes/console.php`)  
  - Mở rộng sau: cluster, summarize, rank, draft (1.8–1.9)

- **Configuration:** `config/signalfeed.php`  
  - `signal_threshold: 0.6` (`SIGNAL_THRESHOLD`)  
  - `classify_batch_size: 200`  
  - `classify_lookback_hours: 24`

- **Test / verify:** PHPUnit **11** tests PASS; kịch bản manual / mẫu SESSION: ~**60%** signals trong batch nhỏ; threshold **≥0.6** → `is_signal`

- **Status:** Production-ready cho bước classify; **Flow 3 step 2** xong

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
- ✅ Phase 2: Auth + Data Seed (**6/8** — 75%)
- ✅ Phase 3: Tweet Crawling (**3/3** — 100%)
- 🚧 **Phase 4: AI Pipeline** (**2/6** — **33%**)
  - ✅ Task 1.7.1: Signal Generator Service
  - ✅ Task 1.7.2: Classify Step
  - ⏸️ Task 1.8.1: Cluster Method (next)
  - ⏸️ Task 1.8.3: Cluster + Summarize Steps
  - ⏸️ Task 1.9.1: Ranking Formula
  - ⏸️ Task 1.9.3: Rank + Draft Steps
- ⏸️ Phase 5: Digest UI (**0/7** — nhóm 1.10–1.12)

### Đang Làm

Không có

### Task Tiếp Theo

🔜 **Task 1.8.1** — Implement LLMClient cluster method

- **Loại:** WEDGE (AI pipeline critical path)
- **Dependencies:** 1.7.2 ✅ (đã có tweet classified)
- **Mục tiêu:** Gom tweet tương đồng thành cluster  
  - Input: tweets `is_signal = true`  
  - Process: clustering prompt-based (SPEC)  
  - Output: `[{cluster_id, tweet_ids}]`
- **Impact:** Mở đường summarize (1.8.2–1.8.3)

**Pipeline Progress:**

```text
✅ Step 1: Crawl tweets (Task 1.6.x)
✅ Step 2: Classify tweets (Task 1.7.2)
→ Step 3: Cluster signals (Task 1.8.1) ← NEXT
  Step 4: Summarize clusters (Task 1.8.2)
  Step 5: Rank signals (Task 1.9.1)
  Step 6: Generate drafts (Task 1.9.2)
```

**Technical debt (khác):** cron `signals:generate` (ví dụ 7:00) — xem block Task 1.7.1; onboarding **1.3.3** vẫn mở.

---

## Technical Debt / Known Issues

**Low Priority:**

1. Deprecation warning: BigNumber float casting (non-blocking)
   - **Impact:** Warning logs only
   - **Fix:** Cast floats to string in model mutations / decimal handling
   - **Timeline:** Phase 2 optimization

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
- **1.8.1** cluster method + wiring pipeline; **1.3.3** onboarding hoặc **1.10.1** API signals tuỳ ưu tiên; top-up twitterapi.io khi crawl quy mô lớn.

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

### Expected Duration
Tuỳ scope (1.8.1 vs 1.3.3 vs 1.10.1)

---

## Metrics Update (2026-04-08)

### API Integration

- **Anthropic API:** ✅ Connected
- **Model:** `claude-sonnet-4-20250514`
- **Credits:** ~$4.71 remaining (session snapshot)
- **Signal generation (1.7.1):** 5 signals, ~0.71 avg impact, ~31% conversion (16 tweets)
- **Classify pipeline (1.7.2):** `TweetClassifierService` + `PipelineCrawlJob`; threshold **0.6**; PHPUnit **11** tests; ước tính chi phí scale classify ~**$9.60**/day (giả định volume — đối chiếu dashboard Anthropic)

### Code Quality (1.7.1)

- **Service layer:** ✅ Transactions (`storeSignals`)
- **Error handling:** ✅ Try-catch + logging (batch / API / parse)
- **PostgreSQL compatibility:** ✅ Raw array literals + junction conflict handling
- **Command interface:** ✅ `signals:generate` với `--date`, `--dry-run`

### Code Quality (1.7.2)

- **TweetClassifierService:** ✅ Retry + logging kênh `crawler` / `crawler-errors`
- **Idempotency:** ✅ `whereNull('signal_score')` + migration default NULL

---

## Recent Decisions

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
- **Impact:** Flow 3 **Crawl ✅ → Classify ✅**; sẵn sàng **1.8.1** cluster
- **Next:** Task **1.8.1** (`LLMClient::cluster`)

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
- **Next:** Task 1.8.1 (cluster)

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
