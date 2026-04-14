# IMPLEMENTATION-ROADMAP.md

**Generated from:** SPEC split (2.2a-2.2f) + PRODUCT-STRATEGY.md + SPRINT-PLAN.md  
**Đồng bộ SPEC:** Bundle **LOCKED** 2026-04-03 + **amendment** 2026-04-06 — `SPEC.md`. Mọi thay đổi sau amendment = **change request** (không sửa ngầm).  
**Tóm tắt cho agent:** `CLAUDE.md` (rule ngắn + OQ); chi tiết schema/API/UI = `SPEC-core.md` / `SPEC-api.md` / `SPEC-plan.md`. Hợp đồng vendor crawl: **`SPEC-api.md` Section 10** (canonical).  
**Sprint Plan:** 3 sprints  
**Wedge scope:** Crawl pipeline + AI classify/cluster/summarize/rank + Digest web UI + Source attribution + Draft generation — delivers kill checkpoint test capability  
**Playbook 2.2h:** File này là **Output 2** của 2.2g — **không** embed trong `SPEC-plan.md` Section 13. Đồng bộ task admin Source (Option B) 2026-04-13.

**Option B — đóng vòng (SPEC.md CR 2026-04-13, `SPEC-core` §4):** User add → `pending_review` → **admin** `PATCH` approve (`active`) hoặc từ chối/dọn spam (`flag_spam`, `soft_delete`, …) — **`GET/PATCH /api/admin/sources`** (nhóm **3.3.x**), UI Screen **#13**. **Không** có giá trị crawl/browse công khai cho nguồn user cho đến khi **approve** (crawl chỉ `status=active`, `Source::forCrawl`). Bổ sung roadmap **2.1.3–2.1.4** (user xem trạng thái submission) + **3.3.4** (thông báo khi admin xử lý); có thể **lên lịch 3.3.x trước 3.1.x (Stripe)** nếu cần dogfood moderation sớm — xem cột *Depends On* Sprint 3.

**Đối chiếu review kỹ thuật (2026-04-06):** Roadmap đã **ăn khớp** `SPEC-api` / `SPEC-core` sau amendment (twitterapi **`advanced_search`**, **`last_crawled_at`**, lịch **4×/ngày**, **`TweetFetchProviderInterface`**, clustering **prompt-based**). Mục *Ghi chú đồng bộ* bên dưới phản ánh trạng thái hiện tại.

---

## Task Table — Sprint 1

| Task # | Task Name | Feature | Tag | Output | Depends On | Verify Method | Source |
|--------|-----------|---------|-----|--------|------------|---------------|--------|
| 1.1.1 | Initialize Laravel 11.x project + React 18 SPA scaffold | 1.1 | [SUPPORT] | Laravel project structure + Vite config + React App.jsx entry point created | — | Run `npm run dev` + `php artisan serve` → React app renders at localhost | 2.2f File Structure (Laravel + React), 2.2b Tech Stack |
| 1.1.2 | Configure external service env vars | 1.1 | [SUPPORT] | .env.example populated with TWITTER_API_KEY, ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, RESEND_API_KEY, TELEGRAM_BOT_TOKEN | 1.1.1 | Check .env.example contains all service vars from 2.2d Phần 1 | 2.2d Service Inventory, 2.2f Config Management |
| 1.1.3 | Setup PostgreSQL + Redis connections | 1.1 | [SUPPORT] | Database connection + queue connection configured, test connection successful | 1.1.1 | Run `php artisan migrate:status` → connects to DB without error | 2.2b Tech Stack (Postgres 15+, Redis for queue) |
| 1.2.1 | Create enum types migration | 1.2 | [SUPPORT] | source_type, source_status, user_plan, interaction_action enum types created | 1.1.3 | Run migration → check enums exist in DB schema | 2.2e Phần 1.2 Enums |
| 1.2.2 | Create core entity tables migration (Part 1: base tables) | 1.2 | [SUPPORT] | categories, users, sources, tweets, signals, digests tables created with columns + constraints per **SPEC-api Section 9** — gồm **`sources.last_crawled_at`**, **`users.is_admin`** (amendment 2026-04-06) | 1.2.1 | Run migration → schema khớp đoạn SQL lock trong `SPEC-api.md` §9 | 2.2e Phần 1.1 Tables, SPEC-api.md |
| 1.2.3 | Create junction tables migration (Part 2: M:N relationships) | 1.2 | [SUPPORT] | source_categories, my_source_subscriptions, signal_sources tables created with FK constraints | 1.2.2 | Run migration → check 3 junction tables exist with composite indexes | 2.2e Phần 1.1 Tables (junction tables) |
| 1.2.4 | Create derived tables migration (Part 3: drafts + interactions) | 1.2 | [SUPPORT] | draft_tweets, user_interactions tables created | 1.2.2 | Run migration → check 2 tables exist | 2.2e Phần 1.1 Tables (draft_tweets, user_interactions) |
| 1.2.5 | Create indexes migration | 1.2 | [SUPPORT] | 16 indexes created (FK conventions + permission/state/filter indexes) | 1.2.2, 1.2.3, 1.2.4 | Run migration → check indexes exist per 2.2e Phần 1.4 | 2.2e Phần 1.4 Indexes |
| 1.3.1 | Implement OAuth X.com redirect + callback flow | 1.3 | [SUPPORT] | Routes /auth/twitter, /auth/twitter/callback implemented, OAuth flow redirects to X.com authorize page | 1.2.2 | Click "Login with X" → redirects to twitter.com/oauth2/authorize with correct params | 2.1 NFR OAuth X.com flow diagram, 2.2e Auth endpoints |
| 1.3.2 | Implement OAuth token exchange + user upsert | 1.3 | [SUPPORT] | POST callback handler exchanges code for tokens, creates/updates User record (x_user_id, x_username, x_access_token), creates session | 1.3.1 | Complete OAuth flow → User record created in DB with x_user_id, session active | 2.1 NFR OAuth flow steps 5-9, 2.2e User table |
| 1.3.3 | Build onboarding Screen #3: Category selection | 1.3 | [SUPPORT] | React component /onboarding/categories renders 10 categories, user selects 1-3, saves to User.my_categories | 1.3.2, 1.4.1 | After OAuth login → onboarding screen shows, select categories → User.my_categories updated | 2.2f UI Skeleton Screen #3, 2.2a CRUD summary (category selection) |
| 1.3.4 | Enable subscribe API for onboarding follow step | 1.3 | [SUPPORT] | Implement `POST /api/sources/{id}/subscribe` sớm để Step 2 onboarding có thể follow ngay (cap guard + idempotency + Pro/Power policy giữ nguyên) | 1.3.3, 1.5.3 | User mới ở onboarding gọi follow thành công, `my_source_subscriptions` được tạo đúng cap | Onboarding Screen #4 needs immediate follow, 2.2a Flow 2 |
| 1.3.5 | Build onboarding Screen #4: `/onboarding/sources` (filter by my_categories, follow/skip) | 1.3 | [SUPPORT] | UI lấy sources `status=active` theo category user đã chọn (`my_categories`), cho phép Follow ngay tại onboarding hoặc Skip đi thẳng digest | 1.3.4, 1.3.3, 1.5.3 | Sau Step 1 → vào Step 2 thấy list KOL đúng category; follow tạo subscription; skip chuyển `/digest` | SPEC-plan Screen #4, Strategy Rule onboarding 2-step |
| 1.4.1 | Seed 10 categories migration | 1.4 | [SUPPORT] | categories table seeded with 10 hardcoded categories (id, name, slug) per 2.2a | 1.2.2 | Query categories table → 10 rows exist matching 2.2a category list | 2.2a Entity Relationship (10 categories), 2.2f Test Data Strategy (fixture files) |
| 1.4.2 | Implement GET /api/categories endpoint | 1.4 | [SUPPORT] | API returns all 10 categories as JSON array | 1.4.1 | GET /api/categories → 200 OK with 10 category objects | 2.2e GET /api/categories spec |
| 1.5.1 | Create source pool CSV seed data | 1.5 | [WEDGE] | CSV file with 500 KOL handles + categories (~500 rows: handle, display_name, account_url, categories[]) | 1.4.1 | CSV file exists, parseable, contains 500 rows | 2.2f Test Data Strategy (seed script for 500 KOL pool), Strategy Wedge Feature #1 |
| 1.5.2 | Implement source pool seed script | 1.5 | [WEDGE] | Artisan command imports CSV → creates Source records (type='default') + SourceCategory links | 1.5.1, 1.2.2, 1.2.3 | Run seed command → sources table has ~500 rows, source_categories has M:N links | 2.2a F04 (default source list), 2.2e sources table |
| 1.5.3 | Implement GET /api/sources (browse pool) endpoint | 1.5 | [WEDGE] | API returns paginated source list with filters (category, search) | 1.5.2 | GET /api/sources → 200 OK with source array, pagination meta | 2.2e GET /api/sources spec, 2.2a F06 browse pool |
| 1.6.1 | Implement TweetFetchProvider (twitterapi.io impl) + bind interface | 1.6 | [WEDGE] | Định nghĩa **`TweetFetchProviderInterface`** + **`TwitterApiIoTweetProvider`** (hoặc tên tương đương) gọi **đúng** base URL/path/query/header theo **Báo cáo POC**; bind interface → impl qua config/env (`TWEET_FETCH_PROVIDER`). Pipeline/job chỉ inject interface — **không** gọi HTTP vendor trong Service. Trả về DTO chuẩn hóa cho lưu `tweets` | 1.5.2 | Integration test: mock interface trong unit test Pipeline; gọi API thật trong feature test provider | SPEC-core §3.2 LOCK, SPEC-api Section 10 §0 + Phần 2; POC |
| 1.6.2 | Implement PipelineCrawlJob (crawl step only) | 1.6 | [WEDGE] | Job: lấy sources **active** (pool), **crawl loop** — round-robin / stagger theo rate limit, cập nhật **`last_crawled_at`** sau batch thành công (nếu migration đã có cột), lưu Tweet (`tweet_id`, text, `posted_at`, url, `source_id`); xử lý cursor/`since_id` theo contract API thực tế | 1.6.1, 1.2.2 | Dispatch job → tweets có dữ liệu mới; sources có `last_crawled_at` cập nhật (khi cột tồn tại) | 2.2a Flow 3 step 1 (Crawl), 2.2b Job Pattern, SPEC-api tweets table |
| 1.6.3 | Setup cron scheduler for pipeline interval | 1.6 | [WEDGE] | Laravel Scheduler dispatch job crawl/pipeline theo **SPEC-core Flow 3** — **4 lần/ngày** (UTC slots trong config/env; không crawl 96 lần/ngày cho digest). `WithoutOverlapping` / `Cache::lock` để tránh chồng job nếu một run dài. Cấu hình `routes/console.php` / Laravel 11 scheduler | 1.6.2 | `schedule:work` hoặc cron production → đúng 4 slot/ngày đã cấu hình | 2.2a Flow 3, SPEC-core §3.1 Task Scheduler |
| 1.7.1 | Implement LLMClient integration (classify method) | 1.7 | [WEDGE] | `app/Integrations/LLMClient.php` wraps Anthropic API; **đọc system/user prompt từ** `docs/prompts/v1/classify.md` (hoặc config path); `classify($tweet_text)` parse JSON → `{signal_score, is_signal}`. Các bước cluster/summarize/draft dùng file tương ứng trong cùng thư mục | 1.6.2 | Call client với prompt file → returns signal_score 0-1 + is_signal boolean | `docs/prompts/v1/`, 2.2d Anthropic, SPEC-api §9 (9) |
| 1.7.2 | Add classify step to PipelineCrawlJob | 1.7 | [WEDGE] | Job iterates tweets from crawl step, calls LLMClient.classify(), updates Tweet.signal_score + Tweet.is_signal | 1.7.1, 1.6.2 | Dispatch job → tweets table has signal_score + is_signal populated | 2.2a Flow 3 step 2 (Classify), 2.2e tweets table (signal_score, is_signal columns) |
| 1.8.1 | Implement LLMClient cluster method | 1.8 | [WEDGE] | LLMClient.cluster($tweets) groups similar tweets, returns clusters array [{cluster_id, tweet_ids}] | 1.7.2 | Call client->cluster([tweet1, tweet2, tweet3]) → returns cluster groupings | 2.2d Anthropic API endpoint #2 (cluster), 2.2a Flow 3 step 3 |
| 1.8.2 | Implement LLMClient summarize method | 1.8 | [WEDGE] | LLMClient.summarize($cluster_tweets) returns {title: string, summary: string, topic_tags: string[]} per cluster | 1.8.1 | Call client->summarize(cluster_tweets) → returns title (≤10 words) + summary (50-100 words) + 1-3 topic tags | 2.2d Anthropic API endpoint #3 (summarize), 2.2a Flow 3 step 4, 2.2e signals table (title, summary, topic_tags) |
| 1.8.3 | Add cluster + summarize steps to PipelineCrawlJob | 1.8 | [WEDGE] | Job filters is_signal=true tweets, calls cluster(), per cluster calls summarize(), creates Signal records (cluster_id, title, summary, topic_tags, date) + SignalSource M:N links | 1.8.2, 1.7.2 | Dispatch job → signals table populated with clustered signals, signal_sources links created | 2.2a Flow 3 steps 3-4, 2.2e signals + signal_sources tables |
| 1.9.1 | Implement signal ranking formula | 1.9 | [WEDGE] | Service method calculateRankScore(Signal) computes rank_score = f(source_count, avg_signal_score, recency_decay), updates Signal.rank_score | 1.8.3 | Call service->calculateRankScore(signal) → rank_score 0-1 value computed and saved | 2.2a assumption #9 (rank formula), 2.2e signals.rank_score column |
| 1.9.2 | Implement LLMClient generateDraft method | 1.9 | [WEDGE] | LLMClient.generateDraft($signal) returns draft tweet text (≤280 chars, category-aware tone) | 1.8.3 | Call client->generateDraft(signal) → returns tweet draft string | 2.2d Anthropic API endpoint #4 (draft generation), 2.2a F12, 2.2e draft_tweets table |
| 1.9.3 | Add rank + draft steps to PipelineCrawlJob | 1.9 | [WEDGE] | Job calls calculateRankScore() per signal, calls generateDraft(), creates DraftTweet records (signal_id, text) | 1.9.1, 1.9.2, 1.8.3 | Dispatch job → signals have rank_score, draft_tweets table populated | 2.2a Flow 3 steps 5-6, 2.2e draft_tweets table |
| 1.10.1 | Implement GET /api/signals (list digest) endpoint | 1.10 | [WEDGE] | API returns signals for date (default today), sorted by rank_score DESC, includes sources array + draft object | 1.9.3 | GET /api/signals → 200 OK with ranked signal array | 2.2e GET /api/signals spec, 2.2a F13 |
| 1.10.2 | Build Digest View Screen #5 (React component) | 1.10 | [WEDGE] | React component /digest fetches signals API, renders card-based UI (title, summary, source_count, sources list), mobile-first responsive | 1.10.1, 1.3.3 | Navigate to /digest after auth → screen shows signals sorted by rank | 2.2f UI Skeleton Screen #5, Strategy Wedge Feature #3 (card-based UI) |
| 1.11.1 | Implement GET /api/signals/{id} (detail) endpoint | 1.11 | [WEDGE] | API returns full signal object with all source attribution (sources array with tweet_url, posted_at, handle) | 1.10.1 | GET /api/signals/{id} → 200 OK with full signal + sources array | 2.2e GET /api/signals/{id} spec, 2.2a F18 source attribution |
| 1.11.2 | Build Signal Detail Modal Screen #7 (React component) | 1.11 | [WEDGE] | Modal overlay on digest screen, shows full summary + all sources with tweet links + timestamp | 1.11.1, 1.10.2 | Click signal on digest → modal opens with source attribution details | 2.2f UI Skeleton Screen #7, 2.2a CRUD summary (signal detail view) |
| 1.12.1 | Implement POST /api/signals/{id}/draft/copy endpoint | 1.12 | [WEDGE] | API returns Twitter Web Intent URL with draft text pre-filled (URL encoded per RFC 3986) | 1.11.1 | POST /api/signals/{id}/draft/copy → 200 OK with twitter_intent_url | 2.2e POST /api/signals/{id}/draft/copy spec, 2.2d Twitter Web Intent |
| 1.12.2 | Implement UserInteraction logging (copy_draft event) | 1.12 | [WEDGE] | Event listener LogUserInteraction creates user_interactions record (action='copy_draft') when draft copied | 1.12.1, 1.2.4 | Copy draft → user_interactions table has new row | 2.2a Flow 5 step 2, 2.2b Event-Driven pattern, Strategy V1 Rule #1 (log interactions) |
| 1.12.3 | Build Draft Copy Button + Twitter Composer link (React) | 1.12 | [WEDGE] | Button in Signal Detail modal, onClick calls copy endpoint → opens Twitter composer in new tab with draft pre-filled | 1.12.1, 1.11.2 | Click "Copy Draft" button → Twitter composer opens with draft text | 2.2f UI Skeleton Screen #7, Strategy Wedge Feature #5 (draft generation) |

---

## Task Table — Sprint 2

| Task # | Task Name | Feature | Tag | Output | Depends On | Verify Method | Source |
|--------|-----------|---------|-----|--------|------------|---------------|--------|
| 2.1.1 | Implement POST /api/sources (add source) endpoint | 2.1 | [POST-WEDGE] | API validates @handle; creates Source + SourceCategory với **`status='pending_review'`** (`type='user'`, Option B); **không** tạo `MySourceSubscription` tại submit (subscribe sau khi `active` + Flow 2); response `is_subscribed: false` | Sprint 1 complete | POST /api/sources → 201, `status: pending_review`, `is_subscribed: false` | SPEC-api POST /api/sources, SPEC-core Section 4 Option B |
| 2.1.2 | Build Add Source Form Screen #11 (React modal or page) | 2.1 | [POST-WEDGE] | Form @handle + categories; success = source **chờ duyệt** (`pending_review`) | 2.1.1 | Submit → 201 → hiển thị message chờ admin duyệt; browse chỉ thấy source sau khi approve | 2.2f UI Skeleton Screen #11, 2.2a F05 |
| 2.1.3 | Implement GET user-submitted sources (my submissions) endpoint | 2.1 | [POST-WEDGE] | API trả các Source `type=user` do user hiện tại thêm (`added_by_user_id`), kèm **`status`** (`pending_review` \| `active` \| `spam` \| `deleted`) + metadata hiển thị — để user theo dõi queue **không** phụ thuộc admin UI | 2.1.1 | GET (path theo SPEC-api / quy ước REST) → danh sách submission + status đúng | SPEC-core Flow 1 (feedback cho user), VR-1 SPEC.md |
| 2.1.4 | Build “My submissions” / status UI (Screen #11 bổ sung hoặc section My KOLs) | 2.1 | [POST-WEDGE] | React: hiển thị các KOL đã gửi + badge trạng thái (pending / approved / rejected\*); \*“từ chối” map từ `spam` hoặc `deleted` theo copy sản phẩm | 2.1.3 | User thấy submission pending; sau admin xử lý, status cập nhật (sau 3.3.4 có thể kèm toast/email) | SPEC-plan VR-1 (UI trạng thái chờ duyệt) |
| 2.2.1 | Implement POST /api/sources/{id}/subscribe endpoint | 2.2 | [POST-WEDGE] | API checks cap (Pro ≤10, Power ≤50), creates MySourceSubscription record | 2.1.1 | POST /api/sources/{id}/subscribe as Pro user → subscription created, count ≤10 enforced | 2.2e POST /api/sources/{id}/subscribe spec, 2.2a Flow 2 (Subscribe) |
| 2.2.2 | Implement DELETE /api/sources/{id}/subscribe endpoint | 2.2 | [POST-WEDGE] | API deletes MySourceSubscription record (self-owned only) | 2.2.1 | DELETE /api/sources/{id}/subscribe → 204 No Content, subscription deleted | 2.2e DELETE /api/sources/{id}/subscribe spec, 2.2a CRUD (unfollow) |
| 2.2.3 | Add Follow/Unfollow buttons to Browse Source Pool UI | 2.2 | [POST-WEDGE] | Buttons in source pool browse screen (Screen #10), calls subscribe/unsubscribe APIs, updates button state (Follow → Following) | 2.2.1, 2.2.2, 1.5.3 | Browse sources → click Follow → button changes to Following, MySourceSubscription created | 2.2f UI Skeleton Screen #10, 2.2a F06 |
| 2.3.1 | Add search filter to GET /api/sources endpoint | 2.3 | [POST-WEDGE] | API accepts ?search=@handle query param, filters sources by handle LIKE search | 2.2.2 | GET /api/sources?search=elon → returns sources matching search | 2.2e GET /api/sources spec (search param), 2.2a CRUD (search sources) |
| 2.3.2 | Build Browse Source Pool Screen #10 with search input (React) | 2.3 | [POST-WEDGE] | Screen renders source list, search input filters by @handle, category filter, Follow/Unfollow buttons | 2.3.1, 2.2.3 | Navigate to /sources → search by handle → results filtered, click Follow → subscribed | 2.2f UI Skeleton Screen #10, 2.2a F06 |
| 2.4.1 | Implement GET /api/my-sources endpoint | 2.4 | [POST-WEDGE] | API returns user's MySourceSubscription list with source details + stats (signal_count, last_active_date computed on-demand) | 2.2.1 | GET /api/my-sources as Pro user → returns subscribed sources array (≤10) | 2.2e GET /api/my-sources spec, 2.2a F06 |
| 2.4.2 | Implement GET /api/my-sources/stats endpoint | 2.4 | [POST-WEDGE] | API computes stats: total_signals_today, top_active_sources (top 3), trend_7day (signal count per day), per_category_breakdown | 2.4.1 | GET /api/my-sources/stats → 200 OK with computed stats object | 2.2e GET /api/my-sources/stats spec, 2.2a Flow 4 (stats calculation) |
| 2.4.3 | Build My KOLs List Screen #8 (React) | 2.4 | [POST-WEDGE] | Screen renders My KOLs list from API, shows subscribed sources with Unfollow button | 2.4.1, 2.2.2 | Navigate to /my-sources → shows subscribed sources, click Unfollow → subscription deleted | 2.2f UI Skeleton Screen #8, 2.2a F06 |
| 2.4.4 | Build My KOLs Stats Screen #9 (React) | 2.4 | [POST-WEDGE] | Screen fetches stats API, renders stats bar (signal count, top sources, 7-day trend chart, per-category breakdown) | 2.4.2, 2.4.3 | Navigate to /my-sources/stats → shows computed stats | 2.2f UI Skeleton Screen #9, 2.2a F15 |
| 2.4.5 | Add My KOLs filter toggle to Digest View | 2.4 | [POST-WEDGE] | Toggle button on Screen #5 (digest), ?my_sources_only=true query param, filters signals to My KOLs sources only | 2.4.1, 1.10.2 | Toggle "My KOLs Only" on digest → signals filtered to subscribed sources | 2.2f UI Skeleton Screen #6 (filter toggle), 2.2a F14 |
| 2.5.1 | Implement POST/DELETE /api/signals/{id}/archive endpoints | 2.5 | [POST-WEDGE] | API toggle save/unsave signal vào personal archive (self-owned), idempotent cho repeated requests | 1.10.1, 1.2.4 | POST archive → 201/200; DELETE archive → 204; only current user archive affected | CR 2026-04-14 (Archive save flow), Screen #5 + Archive menu behavior |
| 2.5.2 | Implement GET /api/archive/signals endpoint | 2.5 | [POST-WEDGE] | API trả danh sách archived signals của user với filter date/category/search + pagination | 2.5.1, 1.10.1 | GET /api/archive/signals?date_range=last30 → trả archived list đúng user | CR 2026-04-14, Screen Archive (`/archive`), SPEC-plan assumption #22 |
| 2.5.3 | Add “Save to Archive” button on Digest cards | 2.5 | [POST-WEDGE] | Nút bookmark/save trên Digest (Screen #5), optimistic UI Saved/Unsaved, sync với archive endpoints | 2.5.1, 1.10.2 | Click Save on digest card → state đổi Saved + record archive created | CR 2026-04-14, Digest Screen #5 (missing save action) |
| 2.5.4 | Integrate Archive Screen with real API | 2.5 | [POST-WEDGE] | Thay mock `archivedSignals` bằng GET /api/archive/signals, giữ date/category/search filters + empty state | 2.5.2 | Navigate /archive → hiển thị dữ liệu lưu thật, filters hoạt động đúng | CR 2026-04-14, existing `ArchivePage.tsx` |
| 2.5.5 | Implement GET/PATCH /api/settings endpoints | 2.5 | [POST-WEDGE] | API đọc/cập nhật user settings: profile basics, digest preferences, category prefs, locale | 1.3.2, 1.4.2 | PATCH /api/settings thành công → refresh GET phản ánh cấu hình mới | CR 2026-04-14, Screen #12 Settings |
| 2.5.6 | Integrate Settings Screen with settings APIs | 2.5 | [POST-WEDGE] | Nối `SettingsPage` tabs (profile/digest/billing/telegram/language) vào API thật, bỏ hardcoded defaults | 2.5.5 | Save in Settings → reload vẫn giữ dữ liệu đúng | CR 2026-04-14, existing `/settings` route |
| 2.5.7 | Add i18n foundation + Language persistence | 2.5 | [POST-WEDGE] | Setup i18n dictionaries (en/vi baseline), locale provider, bind Language tab với `PATCH /api/settings` | 2.5.5, 2.5.6 | Switch language in Settings → UI shell đổi ngôn ngữ và persist qua reload | CR 2026-04-14, multi-language enablement |

---

## Task Table — Sprint 3

| Task # | Task Name | Feature | Tag | Output | Depends On | Verify Method | Source |
|--------|-----------|---------|-----|--------|------------|---------------|--------|
| 3.1.1 | Implement Stripe Checkout Session creation | 3.1 | [POST-WEDGE] | API endpoint (or frontend redirect) creates Stripe Checkout Session with Pro/Power price IDs, redirects to Stripe hosted page | Sprint 2 complete | Click "Upgrade to Pro" → redirects to Stripe checkout page | 2.2d Stripe integration (checkout.session.completed event), 2.2a F02 |
| 3.1.2 | Implement Stripe webhook handler (4 events) | 3.1 | [POST-WEDGE] | POST /webhooks/stripe endpoint handles checkout.session.completed, subscription.updated, subscription.deleted, payment_failed → updates User.plan + User.stripe_customer_id, logs processed_stripe_events (idempotency) | 3.1.1 | Stripe sends webhook → User.plan updated, processed_stripe_events row created | 2.2e Stripe Webhook Handler spec, 2.2d Constraint #7 (plan sync webhook-only) |
| 3.1.3 | Implement plan downgrade cleanup logic | 3.1 | [POST-WEDGE] | When subscription.deleted event received → auto-unsubscribe My KOLs (keep first 10 by created_at ASC for Pro downgrade, or all if Free downgrade) | 3.1.2 | Stripe webhook downgrade event → MySourceSubscriptions pruned to cap | 2.2e assumption #17 (downgrade cleanup), 2.2b assumption #10 |
| 3.2.1 | Add Free tier Mon/Wed/Fri restriction to digest delivery job | 3.2 | [POST-WEDGE] | Cron job checks User.plan + current day-of-week, skips digest delivery for Free users on Tue/Thu/Sat/Sun | 3.1.2 | Free user on Tuesday → digest not generated/delivered, Mon/Wed/Fri → delivered | 2.2d Constraint #9 (Free tier schedule), 2.2a assumption #1 (Mon/Wed/Fri) |
| 3.2.2 | Add plan-based feature gates to API endpoints | 3.2 | [POST-WEDGE] | Middleware checks User.plan, returns 403 FORBIDDEN for Free users accessing Pro/Power endpoints (My KOLs, drafts, stats) | 3.1.2 | Free user calls GET /api/my-sources → 403 FORBIDDEN | 2.2e Permission Guards (plan checks), 2.2a Permission Matrix |
| 3.3.1 | Implement GET /api/admin/sources (moderation list) endpoint | 3.3 | [POST-WEDGE] | API: filter **`type=user`** (+ optional `status=`); added_by_user, signal_count, noise_ratio — queue mặc định `pending_review` | Sprint 1 complete + admin guard (`users.is_admin`) — **không** bắt buộc Stripe | GET /api/admin/sources?type=user&status=pending_review → nguồn chờ duyệt | SPEC-api GET /api/admin/sources, SPEC-core Flow 6 Option B |
| 3.3.2 | Implement PATCH /api/admin/sources/{id} (moderate) endpoint | 3.3 | [POST-WEDGE] | `action` ∈ `approve` \| `flag_spam` \| `adjust_categories` \| `soft_delete` \| `restore` (+ `category_ids` khi adjust); admin-only; **“Từ chối”** sản phẩm = `flag_spam` hoặc `soft_delete` (không có enum `rejected` riêng) | 3.3.1 | PATCH `approve` → `pending_review` → `active`; PATCH từ chối/spam → status tương ứng + audit | SPEC-api PATCH /api/admin/sources/{id} |
| 3.3.3 | Build Admin Source Moderation Screen #13 (React) | 3.3 | [POST-WEDGE] | UI `type=user`, sort `created_at` desc; Approve, Flag spam, Adjust categories, Soft delete, Restore | 3.3.2 | `/admin/sources?type=user&status=pending_review` → approve → source được crawl/browse | 2.2f UI Skeleton Screen #13, SPEC-core Flow 6 Option B |
| 3.3.4 | Notify submitter when moderation completes (approve / reject / spam) | 3.3 | [POST-WEDGE] | Sau PATCH admin thành công: gửi thông báo tới `added_by_user_id` — **Phase 1 tối thiểu:** email (Resend) **hoặc** in-app (poll `2.1.3` + banner); log product/audit (`admin.source.reviewed`, `source.flagged_spam`, … per SPEC-api §9). Tuỳ chọn: Telegram (Power) = backlog | 3.3.2 | User nhận được thông báo đúng hành động admin; không im lặng sau duyệt | SPEC-core §4 (notify khi spam), SPEC.md VR-1, Open Q email Sprint 2+ |
| 3.4.1 | Implement GET /api/admin/pipeline endpoint | 3.4 | [POST-WEDGE] | API returns pipeline metrics: crawl_status, last_run_at, total_tweets_today, total_signals_today, classify_accuracy_sample (spot-check), error_rate, per_category_signal_volume | 3.3.1 | GET /api/admin/pipeline → 200 OK with metrics object | 2.2e GET /api/admin/pipeline spec, 2.2a Flow 7 (Admin Monitors Pipeline) |
| 3.4.2 | Build Admin Pipeline Monitor Screen #14 (React) | 3.4 | [POST-WEDGE] | Screen fetches pipeline metrics API, renders dashboard (crawl status, signal volume chart, error log) | 3.4.1 | Navigate to /admin/pipeline → shows metrics dashboard | 2.2f UI Skeleton Screen #14, 2.2a F22 |
| 3.5.1 | Expand i18n coverage for Digest/My KOLs/Archive pages | 3.5 | [POST-WEDGE] | Replace hardcoded UI copy by i18n keys on major user screens | 2.5.7, 1.10.2, 2.4.4, 2.5.4 | Switch locale en↔vi → Digest/My KOLs/Archive copy changes correctly | CR 2026-04-14, multi-language rollout |
| 3.5.2 | Add i18n coverage for Settings + Admin screens | 3.5 | [POST-WEDGE] | Localize Settings/Admin strings with fallback policy (`en` default) | 3.5.1, 3.3.3, 3.4.2 | Switch locale → Settings/Admin labels localized, no missing-key crash | CR 2026-04-14 |
| 3.5.3 | Implement locale-aware formatting standards | 3.5 | [POST-WEDGE] | Date/number format theo locale (digest timestamps, stats cards, archive dates) | 3.5.1 | Locale vi/en hiển thị format ngày/số khác nhau đúng chuẩn | CR 2026-04-14, UX consistency |

---

## Dependency Graph

### Sprint 1:

```
1.1.1 (Project Setup) → 1.1.2 (Env Vars), 1.1.3 (DB Connect)
  → 1.2.1 (Enums) → 1.2.2 (Base Tables) → 1.2.3 (Junction Tables), 1.2.4 (Derived Tables)
    → 1.2.5 (Indexes)
  
1.2.2 → 1.4.1 (Category Seed) → 1.4.2 (Category API)
      → 1.3.1 (OAuth Redirect) → 1.3.2 (OAuth Token Exchange) → 1.3.3 (Onboarding Step 1) → 1.3.4 (Subscribe API) → 1.3.5 (Onboarding Step 2)
      → 1.5.1 (Source CSV) → 1.5.2 (Source Seed Script) → 1.5.3 (Source API)
                          → 1.6.1 (Twitter Client / POC contract) → 1.6.2 (Crawl Job + loop) → 1.6.3 (Scheduler)
                                                   → 1.7.1 (LLM Classify) → 1.7.2 (Classify Step)
                                                                        → 1.8.1 (LLM Cluster) → 1.8.2 (LLM Summarize) → 1.8.3 (Cluster+Summarize Step)
                                                                                                                    → 1.9.1 (Rank Formula), 1.9.2 (LLM Draft) → 1.9.3 (Rank+Draft Step)
                                                                                                                                                            → 1.10.1 (Signals API) → 1.10.2 (Digest UI)
                                                                                                                                                                                → 1.11.1 (Signal Detail API) → 1.11.2 (Detail Modal)
                                                                                                                                                                                                            → 1.12.1 (Draft Copy API), 1.12.2 (Interaction Log) → 1.12.3 (Draft Copy Button)

Critical Path: 1.1.1 → 1.2.2 → 1.5.2 → 1.6.2 → 1.7.2 → 1.8.3 → 1.9.3 → 1.10.1 → 1.12.3 (Wedge delivery)
Parallel Paths: 1.3.x (Auth), 1.4.x (Categories) can run parallel with 1.5-1.6
```

### Sprint 2:

```
Sprint 1 Complete → 2.1.1 (Add Source API) → 2.1.2 (Add Source UI) → 2.1.3 (My submissions API) → 2.1.4 (My submissions UI)
                  → 2.2.1 (Subscribe API), 2.2.2 (Unsubscribe API) → 2.2.3 (Follow Buttons)
                                                                   → 2.3.1 (Search Filter) → 2.3.2 (Browse UI)
                                                                   → 2.4.1 (My KOLs API), 2.4.2 (Stats API) → 2.4.3 (My KOLs List UI), 2.4.4 (Stats UI), 2.4.5 (Filter Toggle)
                                                                   → 2.5.1 (Archive save API) → 2.5.2 (Archive list API) → 2.5.3 (Digest Save button), 2.5.4 (Archive UI API), 2.5.5 (Settings API) → 2.5.6 (Settings UI), 2.5.7 (i18n foundation)

Critical Path: Sprint 1 → 2.1.1 → 2.2.1 → 2.4.1 → 2.4.5 → 2.5.1 → 2.5.4 (My KOLs + Archive complete)
Parallel Paths: 2.3.x (Browse/Search) can run parallel with 2.4.x; 2.1.3–2.1.4 song song 2.2.x; 2.5.5-2.5.7 phụ thuộc song song API settings
Option B closure: moderation **3.3.1–3.3.4** (Sprint 3) có thể bắt đầu sớm — không cần chờ Stripe — xem Sprint 3
```

### Sprint 3:

```
Sprint 2 Complete → 3.1.1 (Stripe Checkout) → 3.1.2 (Stripe Webhook) → 3.1.3 (Downgrade Cleanup)
                                                                      → 3.2.1 (Free Tier Job), 3.2.2 (Feature Gates)

Parallel (Option B / admin — có thể lịch trước hoặc xen 3.1.x):
  3.3.1 (Admin Sources API) → 3.3.2 (Moderate API) → 3.3.3 (Moderation UI #13) → 3.3.4 (Notify submitter on outcome)
  3.4.1 (Pipeline Metrics API) → 3.4.2 (Pipeline Monitor UI)
  3.5.1 (i18n app screens) → 3.5.2 (i18n settings/admin) → 3.5.3 (locale formatting)

Critical Path (billing): Sprint 2 → 3.1.2 → 3.2.2 (plan enforcement complete)
Parallel Paths: 3.3.x (Admin Sources + notify), 3.4.x (Admin Pipeline), 3.5.x (i18n rollout) — parallel với 3.1.x nếu cần
```

---

## Execution Order Summary

**Sprint 1 — Wedge Delivery (12 feature groups → 36 tasks):**
1. Setup + Infrastructure: Tasks 1.1.1 - 1.2.5 (8 tasks) — Project scaffold + DB schema
2. Auth + Data Seed: Tasks 1.3.1 - 1.5.3 (10 tasks) — OAuth + onboarding step 2 + categories + source pool
3. Pipeline Core: Tasks 1.6.1 - 1.9.3 (11 tasks) — Crawl → Classify → Cluster → Summarize → Rank → Draft
4. Digest UI: Tasks 1.10.1 - 1.12.3 (7 tasks) — Digest view + detail + draft copy

**Sprint 2 — My KOLs + Archive + Settings (5 feature groups → 21 tasks):**
1. Add Source: Tasks 2.1.1 - 2.1.4 (4 tasks — API + form + **my submissions** visibility)
2. Subscribe/Unsubscribe: Tasks 2.2.1 - 2.2.3 (3 tasks)
3. Browse/Search: Tasks 2.3.1 - 2.3.2 (2 tasks)
4. My KOLs UI + Stats: Tasks 2.4.1 - 2.4.5 (5 tasks)
5. Archive + Settings + Language foundation: Tasks 2.5.1 - 2.5.7 (7 tasks)

**Sprint 3 — Billing + Admin + i18n completion (5 feature groups → 14 tasks):**
1. Stripe Integration: Tasks 3.1.1 - 3.1.3 (3 tasks)
2. Free Tier Enforcement: Tasks 3.2.1 - 3.2.2 (2 tasks)
3. Admin Source Moderation: Tasks 3.3.1 - 3.3.4 (4 tasks — list + PATCH + UI **+ notify submitter**)
4. Admin Pipeline Monitor: Tasks 3.4.1 - 3.4.2 (2 tasks)
5. Multi-language rollout: Tasks 3.5.1 - 3.5.3 (3 tasks)

**Total: 69 tasks across 3 sprints** (đếm trực tiếp từ các bảng Task Table phía trên)

---

## Ghi chú đồng bộ SPEC & CR (2026-04-06 — đã merge amendment)

Bảng này mô tả **trạng thái sau amendment**; mọi thay đổi tiếp theo = **change request** trong `SPEC.md`.

| Chủ đề | Trạng thái trong SPEC (sau 2026-04-06) | Ghi chú triển khai |
|--------|----------------------------------------|---------------------|
| **twitterapi.io** | **`SPEC-api` Phần 2:** primary **`advanced_search`** per POC; hàng legacy `/tweets/user/{username}` chỉ tham chiếu | Task **1.6.1** — `TwitterApiIoTweetProvider`; binding `TWEET_FETCH_PROVIDER` |
| **`sources.last_crawled_at`** | **§9 schema** — có cột + index | Migration **1.2.2** khớp SQL lock |
| **Crawl loop** | Mô tả trong **`SPEC-api` Phần 2** + Flow 3 | Task **1.6.2** |
| **Lịch scheduler** | **4×/ngày** — `SPEC-core`, `SPEC-plan` | Task **1.6.3**; đổi lịch = CR |
| **Tweet fetch abstraction** | **`SPEC-core` §3.2 LOCK** + **`SPEC-api` Section 10 §0** | Interface + DI; swap vendor không đụng `PipelineService` logic |
| **Personal feed** | Bảng **`user_personal_feed_entries`** + endpoint trong `SPEC-api` — **Sprint 2+** | Ngoài 69 task roadmap hiện tại; xem backlog / CR task sau |
| **Clustering** | **Prompt-based** Phase 1 — changelog `SPEC-api` + Flow 3 | Task **1.8.1** theo hướng này |

---

## Open Questions / Assumptions

| # | Điểm | Loại | Impact nếu sai | Reflected in |
|---|------|------|-----------------|--------------|
| 1 | **500 KOL CSV seed data creation effort.** Task 1.5.1 assumes CSV file exists or is quickly created (1-2 hours manual curation). If CSV doesn't exist → founder must curate 500 handles with categories, estimated 1-2 days effort outside sprint. | Assumption | Blocks Task 1.5.2 (seed script). If CSV not ready → cannot seed source pool → pipeline has no sources to crawl → Sprint 1 fails. Must complete CSV pre-Sprint 1 or reduce to smaller seed (50-100 sources for dogfood test). | Task 1.5.1 |
| 2 | **External service API blockers resolution.** Tasks 1.6.1, 1.7.1, 1.8.1, 1.8.2, 1.9.2 depend on twitterapi.io + Anthropic API endpoints. 2.2d lists 7 blockers (unknown endpoints, schemas, rate limits). Assumed blockers resolved before Sprint 1. | Assumption (inherited from 2.2d) | If blockers NOT resolved → integration client tasks blocked → cannot implement pipeline → Sprint 1 fails. MUST resolve 2.2d blockers #1-7 (verify API docs, test endpoints, confirm schemas) before starting Sprint 1. | Tasks 1.6.1, 1.7.1, 1.8.1, 1.8.2, 1.9.2 |
| 3 | **Onboarding 2-step completeness (Screen #3 + #4).** Sau OAuth, user cần đi qua category selection rồi optional follow theo `my_categories` trước khi vào digest để tránh cold-start rỗng. | Assumption | Nếu bỏ Step 2 onboarding → user chưa follow KOL nào, My KOLs value bị chậm kích hoạt; cần CTA bù ở digest. | Tasks 1.3.3, 1.3.4, 1.3.5 |
| 4 | **My KOLs filter toggle placement (Task 2.4.5) in Sprint 2 vs digest UI (Task 1.10.2) in Sprint 1.** Digest UI renders All Sources view Sprint 1. My KOLs toggle (Screen #6) adds filter. Conflict: toggle needs MySourceSubscription data (Sprint 2). Can founder dogfood My KOLs view in Sprint 1 kill checkpoint test? | Conflict | If My KOLs view needed for kill checkpoint → move Tasks 2.1-2.4 to Sprint 1 (increases Sprint 1 scope significantly). If not needed → Sprint 1 delivers All Sources view only, founder tests with all 500 sources (not personalized). Clarify kill checkpoint test scope. | Task 1.10.2 vs Task 2.4.5 |
| 5 | **Stripe Checkout redirect vs embedded flow.** Task 3.1.1 assumes Stripe Checkout hosted page redirect (simpler). Alternative: embedded Checkout Elements (more control, more complexity). | Question | If embedded required (UX consistency) → add 1-2 days effort for Checkout Elements integration. If hosted OK → keep redirect approach. Affects frontend implementation. | Task 3.1.1 |
| 6 | **Admin rank override endpoint not in Sprint 3.** 2.2a Permission Matrix mentions admin can "manual rank override" (assumption #3), but no endpoint or task defined. 2.2e assumption #16 flags conflict (Signal immutability vs admin override). | Conflict (inherited from 2.2e #16) | If admin rank override needed → add Task 3.4.3 (POST /api/admin/signals/{id}/rank endpoint + UI). If not needed → remove from Permission Matrix. Clarify with founder — pipeline accuracy spot-check requires override? | Sprint 3 Feature 3.4 (Pipeline Monitor) |
| 7 | **Landing page creation not in sprint tasks.** Kill checkpoint criterion #1 (landing page signup <5% conversion) requires landing page. Not in Wedge scope or task list. Assumed founder creates simple static HTML landing page outside sprint scope. | Assumption | If landing page needs dev effort (React component, signup form API, analytics tracking) → add to Sprint 1 or pre-sprint. Kill checkpoint #1 untestable without landing page. | Kill checkpoint evidence collection |
| 8 | **Test task granularity.** No explicit testing tasks (unit tests, integration tests, E2E tests) in roadmap. Assumed testing happens per-task (write test alongside implementation) per TDD approach. 2.2f Testing Strategy defines test layers but not task breakdown. | Assumption | If separate testing phase needed → add testing tasks per sprint (e.g., 1.13.x Integration Tests for Critical Paths). If per-task testing → verify coverage during implementation. | All tasks (testing implicit) |
| 9 | **Privacy policy page (Screen #15) not in sprint tasks.** 2.1 NFR #11 requires privacy policy page. Not in task list. Assumed legal content creation outside dev scope. | Assumption | Privacy policy Blade template exists (2.2f file structure), but content empty. Founder must write OR use generator (Termly, IUBENDA). If missing → Stripe compliance issue (checkout requires privacy policy link). | 2.1 NFR #11, no corresponding task |
| 10 | **Email digest delivery (F16) deferred.** Not in Sprint 1-3 tasks. Ideation F16 = email digest for Pro/Power. Assumed email not needed for kill checkpoint (founder dogfoods web UI). | Assumption | If email needed for kill checkpoint OR founder strongly prefers email → add Task 1.13.x (Resend integration + email template + SendDigestEmailJob). Increases Sprint 1 scope 1-2 days. | Not in roadmap, mentioned in Sprint Plan Open Question #3 |
| 11 | **Historical tweet backfill (Appendix A #16).** Crawl-forward-only vs backfill N ngày trước go-live — ảnh hưởng khối lượng Signal ban đầu và kill test. | Question | Quyết trước khi chạy seed/crawl lần đầu; có thể cần Artisan command backfill riêng (không có task số trong roadmap). | SPEC-plan Appendix A #16; `CLAUDE.md` Open Items |
| 12 | **E2E framework (Appendix A #4).** Laravel Dusk vs Playwright — chưa có task chọn stack. | Question | Ảnh hưởng `tests/Browser/` và CI; chọn trước khi viết E2E nghiêm. | SPEC-plan Appendix A #4 |
| 13 | **“Flag as Noise” user feedback (Appendix A #17).** Phase 1 (Digest UI) vs Phase 2 — không có task roadmap. | Question | Nếu Phase 1 → thêm task UI + API/log tương ứng; nếu Phase 2 → giữ ngoài scope. | SPEC-plan Appendix A #17 |
| 14 | **Clustering: prompt-based vs embeddings.** | **Đã chốt:** Phase 1 **prompt-based** (`SPEC-api` changelog 2026-04-06). | Embeddings = backlog / CR nếu sau này đổi chiến lược. | Task 1.8.1 |
| 15 | **Admin role** | **Đã có:** `users.is_admin` trong `SPEC-api` §9 + middleware admin. | Seed / manual gán admin. | Tasks 3.3.x, 3.4.x |
| 16 | **Personal feed Pro/Power** | **Schema/API đã lock** trong `SPEC-api`; triển khai job/UI **sau wedge**. | Không nằm trong 69 task roadmap hiện tại. | Sprint 2+ backlog |

---

**End of IMPLEMENTATION-ROADMAP.md**
