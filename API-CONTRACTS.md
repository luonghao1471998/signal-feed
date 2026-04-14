# SignalFeed — API-CONTRACTS.md (COMPLETE)

**Generated:** 2026-04-02  
**Revised:** 2026-04-02 (all 30 gaps filled per technical review)  
**Re-sync:** 2026-04-06: crawl **4×/ngày**; twitterapi.io primary **`advanced_search`** (Báo cáo POC); **`TweetFetchProvider`** abstraction; clustering Phase 1 **prompt-based**; `last_crawled_at` per source.  
**Re-sync:** 2026-04-14: **Option B** (user-added source → `pending_review`) — crawl chỉ **`status=active`**; thông báo user sau moderation có thể dùng **Resend** (transactional) hoặc in-app — chi tiết task **`IMPLEMENTATION-ROADMAP.md`** **3.3.4** / **2.1.3–2.1.4**; REST nội bộ vẫn lấy từ **`SPEC-api.md`**.  
**Re-sync:** 2026-04-14 (CR Archive/Settings/Language): bổ sung nhóm task 2.5.x/3.5.x cho **Save to Archive**, **Settings persistence**, **i18n**. Không thêm vendor mới; i18n dùng dictionary nội bộ + user locale preference qua internal API.
**Re-sync:** 2026-04-15: bổ sung onboarding Step 2 (`/onboarding/sources`) lọc KOL theo `my_categories`, cho phép follow ngay bằng internal API subscribe hoặc skip vào digest; không phát sinh vendor mới.
**Input:** Ideation v2.0 Section 7 + Domain Foundation (2.2a) + Architecture & State (2.2b) + Data Model (2.2c)  
**Purpose:** Tóm tắt hợp đồng dịch vụ ngoài — **canonical = `SPEC-api.md` Section 10 + schema §9**. Nếu lệch, ưu tiên SPEC-api.

---

## Phần 1 — Service Inventory

| # | Service | Purpose | Ideation Source | Direction | Auth Method | Env Config |
|---|---------|---------|-----------------|-----------|-------------|------------|
| 1 | twitterapi.io | Crawl tweets from curated KOL pool on **4× daily** schedule (not 96 runs/day); stagger per source via `last_crawled_at` | Ideation Section 7 + **SPEC-api 2026-04-06** (POC `advanced_search`) | Outbound | API key (Bearer) — **đúng header theo Báo cáo POC** | `TWITTER_API_KEY`, `TWITTER_API_BASE_URL`, **`TWEET_FETCH_PROVIDER`** (chọn implementation: `twitterapi_io`, v.v.) |
| 2 | Anthropic API | LLM classify signal/noise, cluster tweets, generate summaries + drafts | Ideation Section 7: "LLM API (Haiku / GPT-4o-mini) — Classify, summarize, rank, draft, External API, $15-30/tháng" | Outbound | API key (x-api-key header) [from public knowledge — verify] | `ANTHROPIC_API_KEY` [from public knowledge — verify] |
| 3 | Stripe | Payment processing for Pro/Power subscriptions | Ideation Section 7: "Stripe — Payment processing, Via Nextel SG entity" | Bidirectional | API key (Bearer token) + webhook signature verification [from public knowledge — verify] | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_POWER_PRICE_ID` [from public knowledge — verify] |
| 4 | Resend [provider pending — see 2.2b assumption #5] | Email digest (daily 8AM) **và** (khi bật) email transactional: **kết quả duyệt nguồn** sau admin `PATCH` (approve / spam / soft delete) — roadmap **3.3.4** | Ideation Section 7: "Resend / SendGrid — Email digest delivery, External service, $0-10/tháng" [provider: Resend per 2.2b assumption #5] | Outbound + Inbound (webhooks) | API key (Bearer token) [from public knowledge — verify] | `RESEND_API_KEY` [from public knowledge — verify] |
| 5 | Telegram Bot API | Real-time signal alerts (Power plan), admin alerts (pipeline failures) | Ideation Section 7: "Telegram Bot API — Real-time signal alerts, Free" | Bidirectional | Bot token + chat_id [from public knowledge — verify] | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` [from public knowledge — verify] |
| 6 | Twitter Web Intent | Pre-fill tweet composer with draft text (no API, URL scheme) | Ideation Section 7: "Twitter Web Intent — Pre-fill tweet composer, URL scheme, không cần API" | Outbound (browser redirect) | N/A — public URL scheme | N/A — no server-side config |

**Notes:**
- Service #3: Added `STRIPE_PRO_PRICE_ID`, `STRIPE_POWER_PRICE_ID` to env config (needed for plan mapping per gap analysis)
- Service #4: Marked "[provider pending]" per 2.2b assumption #5. Endpoints mapped generically where possible.
- Service #5: Added `TELEGRAM_WEBHOOK_SECRET` for webhook signature verification
- Service #6: Client-side only, included for completeness per Ideation Section 7

---

## Phần 2 — Endpoint Mapping

### 1. twitterapi.io

**Service Source:** Ideation Section 7 + **`SPEC-api.md` Phần 2 (2026-04-06)**  
**Base URL / path:** **Theo Báo cáo POC** — không hardcode trong Service; chỉ trong implementation của **`TweetFetchProvider`** (vd. `TwitterApiIoTweetProvider`).  
**Abstraction (LOCK):** Ứng dụng chỉ gọi **`TweetFetchProviderInterface`**; đổi vendor = đổi binding + class trong `app/Integrations/` — xem `SPEC-core` §3.2, `SPEC-api` Section 10 §0.

#### Outbound Calls (project → service)

| # | Endpoint | Method | Used By (flow/feature) | Request Schema | Response Schema | Key Error Codes | Rate Limit |
|---|----------|--------|------------------------|----------------|-----------------|-----------------|------------|
| 1 | **`/twitter/tweet/advanced_search`** (hoặc path đúng POC) **[PRIMARY]** | GET | **Flow 3 Crawl** — query `from:user` / time window; **4× daily** job; cập nhật `sources.last_crawled_at` sau batch | Query: `query`, `queryType`, cursor — **[per POC]** | Chuẩn hóa trong provider → `NormalizedTweet[]` — **[per POC]** | `401`, `429`, `404` | Stagger + queue; backoff 429 |
| 1b | `/tweets/user/{username}` | GET | **Legacy / tham chiếu** — chỉ dùng nếu POC chứng minh tương đương; ưu tiên hàng #1 | Query: `count`, `since_id` [verify] | Theo provider | Same | Verify |
| 2 | `/users/{username}` [verify] | GET | 2.2a Flow 1 Add Source Step 2 — validate account exists, is public, has recent activity | Query: none | `{ data: { username: string, display_name: string, is_public: boolean, last_tweet_date: datetime, tweet_count_30d: integer } }` [verify — CRITICAL: verify last_tweet_date OR tweet_count_30d availability] | `401`, `404`, `403` | Verify |
| 3 | `/users/{username}/profile` [verify] | GET | 2.2a Flow 6 Admin Reviews Source — admin views source profile when reviewing user-added sources [GAP FILLED] | Query: `include_recent_tweets` (bool) | `{ data: { username: string, bio: string, followers_count: int, recent_tweets: [{ id: string, text: string, created_at: datetime }] } }` [verify] | `401`, `404` | Verify |

**Notes:**
- **Crawl chính:** hàng #1 theo POC — không lấy ví dụ draft cũ (`/tweets/user` only) làm nguồn truth.
- **Ứng dụng:** `PipelineService` / job **không** import URL twitterapi trực tiếp — chỉ qua interface.
- Endpoint #2 CRITICAL: Verify if `last_tweet_date` or `tweet_count_30d` available for Flow 1 validation.
- Endpoint #3: Admin review workflow.

---

### 2. Anthropic API

**Service Source:** Ideation Section 7: "LLM API (Haiku / GPT-4o-mini)"  
**Base URL:** `https://api.anthropic.com/v1` [verify]  
**API version:** 2023-06-01 (header) [verify]

#### Outbound Calls (project → service)

| # | Endpoint | Method | Used By (flow/feature) | Request Schema | Response Schema | Key Error Codes | Rate Limit |
|---|----------|--------|------------------------|----------------|-----------------|-----------------|------------|
| 1 | `/messages` | POST | 2.2a Flow 3 Classify — classify tweet signal/noise | `{ model: string, max_tokens: int, messages: [{ role: "user", content: string }] }` [verify] | `{ content: [{ type: "text", text: string }], usage: { input_tokens: int, output_tokens: int } }` [verify] | `401`, `429`, `400`, `529` | Verify RPM/TPM |
| 2 | `/messages` | POST | 2.2a Flow 3 Cluster — **Phase 1 CHỐT 2026-04-06: prompt-based** (JSON cluster output via same `/messages` pattern) | Same as #1 | Same as #1 | Same as #1 | Verify |
| 3 | `/messages` | POST | 2.2a Flow 3 Summarize — generate title/summary/tags | Same as #1 | `{ content: [{ type: "text", text: string }], usage: {...} }` | Same as #1 | Same as #1 |
| 4 | `/messages` | POST | 2.2a Flow 3 Draft — generate tweet draft | Same as #1 | Same as #3 | Same as #1 | Same as #1 |

**Notes:**
- **Clustering:** Phase 1 = **prompt-based** per `SPEC-api` / `SPEC-core` — không còn blocker “embeddings vs prompt” cho Sprint 1.
- All `/messages` calls return `usage` field — must persist for budget tracking (see Data Mapping)

---

### 3. Stripe

**Service Source:** Ideation Section 7: "Stripe — Payment processing"  
**Base URL:** `https://api.stripe.com/v1` [verify]

#### Outbound Calls (project → service)

| # | Endpoint | Method | Used By (flow/feature) | Request Schema | Response Schema | Key Error Codes | Rate Limit |
|---|----------|--------|------------------------|----------------|-----------------|-----------------|------------|
| 1 | `/checkout/sessions` | POST | 2.2a F02 Plan & Billing — user clicks upgrade | `{ mode: "subscription", line_items: [{ price: string }], customer_email: string, success_url: string, cancel_url: string, metadata: { user_id: string } }` [verify — metadata added] | `{ id: string, url: string }` [verify] | `401`, `400`, `402` | Verify |
| 2 | `/customers` | POST | User first upgrade — create Stripe customer [flow: implicit during checkout or explicit before] | `{ email: string, metadata: { user_id: string } }` [verify] | `{ id: string, email: string }` [verify] | Same as #1 | Same as #1 |
| 3 | `/subscriptions/{id}` | POST | Plan change/cancel via app UI [flow: user settings, not in 2.2a but implied by 2.2b lifecycle] | `{ cancel_at_period_end: bool }` OR `{ items: [{ price: string }] }` [verify] | `{ id: string, status: string, current_period_end: datetime }` [verify] | `401`, `404` | Same as #1 |

#### Inbound Calls (webhooks)

| # | Event | Trigger | Payload Schema | Handler Action | Verification | Source |
|---|-------|---------|----------------|----------------|--------------|--------|
| 1 | `checkout.session.completed` | Payment succeeds | `{ data: { object: { id: string, customer: string, subscription: string, metadata: { user_id: string } } } }` [verify] | Accept event → sync user plan/customer_id | Stripe-Signature header [verify] | 2.2a F02, 2.2b lifecycle |
| 2 | `customer.subscription.updated` | Plan changed/canceled | `{ data: { object: { id: string, status: string, items: [{ price: { id: string } }] } } }` [verify] | Accept event → sync plan based on status | Same as #1 | 2.2b lifecycle |
| 3 | `customer.subscription.deleted` | Subscription expired | `{ data: { object: { id: string, customer: string } } }` [verify] | Accept event → downgrade to free + cleanup | Same as #1 | 2.2b downgrade |
| 4 | `invoice.payment_failed` [GAP FILLED] | Payment declined | `{ data: { object: { subscription: string, attempt_count: int } } }` [verify] | Accept event → if attempt≥3: downgrade, else: send alert | Same as #1 | 2.2b downgrade scenario |

**Notes:**
- Webhook idempotency CRITICAL — store processed event_id in DB
- metadata.user_id propagation: must set in outbound call #1 for webhook mapping

---

### 4. Resend [PROVIDER PENDING]

**Service Source:** Ideation Section 7: "Resend / SendGrid"  
**Base URL:** `https://api.resend.com` (Resend) OR `https://api.sendgrid.com/v3` (SendGrid) [verify] [provider pending]

#### Outbound Calls

| # | Endpoint | Method | Used By | Request Schema | Response Schema | Key Error Codes | Rate Limit |
|---|----------|--------|---------|----------------|-----------------|-----------------|------------|
| 1 | `/emails` (Resend) OR `/mail/send` (SendGrid) | POST | 2.2a F16 Email Digest | Generic: `{ from: string, to: string, subject: string, html: string }` [verify] | Generic: `{ id: string }` [verify] | `401`, `400`, `429`, `554` | 3000/mo free tier [verify] |
| 1b | `/emails` (Resend) | POST | **Option B — thông báo người gửi** sau moderation (nếu chọn kênh email thay vì chỉ in-app) — cùng pattern payload HTML/text | Same as #1 [verify] | Same as #1 | Same as #1 | Same as #1 |

#### Inbound Calls (webhooks) [GAP FILLED]

| # | Event | Trigger | Payload Schema | Handler Action | Verification | Source |
|---|-------|---------|----------------|----------------|--------------|--------|
| 1 | `email.bounced` OR `bounce` | Email bounces | Generic: `{ email: string, bounce_type: string }` [verify] | Accept → if hard bounce: disable delivery + flag email_invalid | Provider signature [verify] | Deliverability monitoring |
| 2 | `email.complained` OR `spam_report` | Marked as spam | Generic: `{ email: string }` [verify] | Accept → disable delivery + notify user | Same as #1 | Same |

**Notes:**
- Provider pending per 2.2b assumption #5
- **Moderation email (3.3.4):** không bắt buộc mở rộng schema vendor — reuse POST `/emails`; nội dung template theo product copy (approved / rejected\* / spam). \*“Từ chối” không có enum riêng — khớp `SPEC-core` / `PATCH` admin.
- Webhooks added per gap analysis (bounce/complaint monitoring)
- Template rendering server-side (HTML string, not template ID)

---

### 5. Telegram Bot API

**Service Source:** Ideation Section 7: "Telegram Bot API"  
**Base URL:** `https://api.telegram.org/bot{token}` [verify]

#### Outbound Calls

| # | Endpoint | Method | Used By | Request Schema | Response Schema | Key Error Codes | Rate Limit |
|---|----------|--------|---------|----------------|-----------------|-----------------|------------|
| 1 | `/sendMessage` | POST | 2.2a F17 Telegram alerts | `{ chat_id: string, text: string, parse_mode: "Markdown" }` [verify] | `{ ok: bool, result: { message_id: int } }` [verify] | `400`, `403`, `429` | 30 msg/sec [verify] |
| 2 | `/sendMessage` | POST | 2.2a Flow 7 Pipeline Monitor — admin alerts | Same as #1 | Same as #1 | Same as #1 | Same as #1 |

#### Inbound Calls (webhooks)

| # | Event | Trigger | Payload Schema | Handler Action | Verification | Source |
|---|-------|---------|----------------|----------------|--------------|--------|
| 1 | `/start` command | User connects bot | `{ update_id: int, message: { chat: { id: int }, text: "/start {token}" } }` [verify] | Extract token → verify JWT (10min exp, single-use nonce) → link chat_id to user | X-Telegram-Bot-Api-Secret-Token [verify] | 2.2c telegram_chat_id, 2.2b assumption #5 |

**Notes:**
- Deep link auth: web app generates JWT, user clicks `https://t.me/{bot}?start={JWT}`, bot verifies + links chat_id
- Nonce tracking in `telegram_auth_tokens` table (user_id, nonce, used_at) to prevent replay attacks

---

### 6. Twitter Web Intent

**Service Source:** Ideation Section 7: "Twitter Web Intent"  
**Base URL:** `https://twitter.com/intent/tweet` (public)

#### Outbound Calls

| # | Endpoint | Method | Used By | Request Schema | Response Schema | Key Error Codes | Rate Limit |
|---|----------|--------|---------|----------------|-----------------|-----------------|------------|
| 1 | `/intent/tweet` | GET (redirect) | 2.2a Flow 5 Open Composer | Query: `text` (RFC 3986 percent-encoded, ≤280 chars) | Browser redirect (no API response) | N/A — client errors only | N/A |

**Notes:**
- Client-side only — no server API calls
- URL encoding: RFC 3986 percent-encoding (space=%20, not +)
- Hard dependency: if Twitter.com down → draft feature broken, fallback = show draft text for manual copy

---

## Phần 3 — Data Mapping

| External Service | External Field | Internal Entity | Internal Field | Transform | Source |
|------------------|---------------|-----------------|----------------|-----------|--------|
| **twitterapi.io** | `data[].id` | Tweet | tweet_id | Direct | 2.2c Tweet.tweet_id, 2.2a Flow 3 Crawl |
| twitterapi.io | `data[].text` | Tweet | text | Direct | 2.2c Tweet.text, 2.2a Flow 3 |
| twitterapi.io | `data[].created_at` | Tweet | posted_at | Parse ISO 8601 → UTC datetime | 2.2c Tweet.posted_at, 2.2a Flow 3 |
| twitterapi.io | `data[].author.username` | Source | handle | Direct (strip @ if present) | 2.2c Source.handle, 2.2a Flow 3 |
| twitterapi.io | `data[].author.display_name` | Source | display_name | Direct | 2.2c Source.display_name, 2.2a Flow 3 |
| twitterapi.io | `data[].last_tweet_date` OR `tweet_count_30d` [VERIFY AVAILABILITY] | Source | is_active | Transform: if last_tweet_date within 30d OR count>0 → true [GAP FILLED] | 2.2c Source.is_active, 2.2a Flow 1 activity check |
| **Anthropic API** | `content[].text` (JSON: signal_score) | Tweet | signal_score | Parse JSON → extract score (0-1) → decimal. Handle parse error: log + skip | 2.2c Tweet.signal_score, 2.2a Flow 3 Classify |
| Anthropic API | `content[].text` (JSON: is_signal) | Tweet | is_signal | Parse JSON → is_signal (score≥0.7). Handle error: log + skip | 2.2c Tweet.is_signal, 2.2a Flow 3 |
| Anthropic API | `content[].text` (JSON: title) | Signal | title | Parse → extract title (≤10 words). If >10: truncate + warn. If missing field: use summary first 10 words [GAP FILLED — schema mismatch handling] | 2.2c Signal.title, 2.2a Flow 3 Summarize |
| Anthropic API | `content[].text` (JSON: summary) | Signal | summary | Parse → extract (50-100 words). Out of range: warn. Missing field: fail signal [GAP FILLED] | 2.2c Signal.summary, 2.2a Flow 3 |
| Anthropic API | `content[].text` (JSON: topic_tags array) | Signal | topic_tags | Parse → extract (1-3 tags) → Postgres array. >3: take first 3 + warn. Not array: fail [GAP FILLED] | 2.2c Signal.topic_tags, 2.2a Flow 3 |
| Anthropic API | `content[].text` (draft) | DraftTweet | text | Extract. If >280: truncate to 280 + "..." + error | 2.2c DraftTweet.text, 2.2a Flow 3 Draft |
| Anthropic API | `usage.input_tokens` [GAP FILLED] | system tracking | token_usage_log | Aggregate daily → `anthropic_usage_daily` table (date, input_tokens, output_tokens, cost_estimate) | Budget monitoring per Ideation $15-30/mo |
| Anthropic API | `usage.output_tokens` [GAP FILLED] | system tracking | token_usage_log | Same as input_tokens | Same |
| **Stripe** | `data.object.customer` | User | stripe_customer_id | Direct | 2.2c User.stripe_customer_id |
| Stripe | `data.object.items[].price.id` | User | plan | Map via env config (STRIPE_PRO_PRICE_ID → 'pro'). Unknown ID: log error + default 'free' + alert [GAP FILLED — unknown price handling] | 2.2c User.plan, 2.2a F02 |
| Stripe | `data.object.status` | User | plan | Map: 'canceled'→'free', 'past_due'→keep current+remind, 'active'→sync tier [GAP FILLED — past_due handling] | 2.2c User.plan, 2.2b lifecycle |
| Stripe | `data.object.current_period_end` | (not persisted) | subscription_end_date | Unix timestamp → UTC datetime. Used for grace period calc | 2.2b downgrade logic |
| **Resend** | `email` (bounce webhook) [GAP FILLED] | User | email_valid | If hard bounce → set false + disable delivery | Deliverability tracking |
| **Telegram** | `message.chat.id` | User | telegram_chat_id | Cast int → string. Validate: reject if already linked to another user [GAP FILLED — duplicate validation] | 2.2c User.telegram_chat_id, 2.2a F17 |
| Telegram | `update_id` [GAP FILLED] | system tracking | processed_telegram_updates | Store for idempotency (TTL 24h) | Webhook deduplication |

**Notes:**
- LLM parsing errors: TWO types: (a) malformed JSON (syntax), (b) invalid structure (missing fields) — handle separately
- Timezone: All datetimes stored as UTC in DB
- Stripe metadata.user_id: must set in checkout session outbound call (gap filled in endpoint #1)
- Anthropic token usage: new system table `anthropic_usage_daily` for budget monitoring

---

## Phần 4 — Failure & Degradation Strategy

| Service | Failure Mode | Impact on User | Strategy Direction | Fallback | Source |
|---------|-------------|----------------|--------------------| ---------|--------|
| **twitterapi.io** | 429 Rate limit | Digest incomplete | Retry with backoff (exponential pattern, max 3 retries). Circuit breaker if error >20%. Alert admin >3 consecutive failures. Stagger crawl per `last_crawled_at`. | **Swap provider:** implementation khác của `TweetFetchProviderInterface` + env (không rewrite pipeline). Netrows/SociaVault = Phase 2 nếu cần. Accept incomplete digest. | 2.2b Error Handling; `SPEC-core` §3.2 LOCK |
| twitterapi.io | 5xx Service down | Same | Same | Same | Same |
| twitterapi.io | 401 Invalid key | Pipeline fails, no digest | Alert admin (critical). No retry (auth won't resolve). | Hard dependency — block until fixed | 2.2b, 2.2a Flow 7 |
| twitterapi.io | 404 Account deleted [GAP FILLED] | Source orphaned | Log → soft-delete Source → continue other sources. Alert admin. | Graceful degradation — skip deleted source | 2.2a Source soft delete |
| twitterapi.io | Timeout [GAP FILLED] | Crawl blocked | Timeout threshold (implementation detail). After timeout → treat as 5xx. | Same as 5xx — retry | Standard HTTP timeout |
| **Anthropic API** | 429 Rate limit | Digest delayed | Queue throttling per 2.2b. Retry with backoff. Alert if backlog >2h. | No fallback LLM Phase 1. Accept delay. | 2.2b, 2.2a Flow 3 |
| Anthropic API | 5xx Service down | Same | Same | Same | Same |
| Anthropic API | Malformed JSON | Tweet/signal skipped, partial digest (fewer signals silently, no error message to user) | Log to Sentry → skip item → continue. Track rate: if >10% → alert. Store in `failed_tweets` table for manual reprocess. | Partial degradation — skip bad items | 2.2b External service errors |
| Anthropic API | Invalid JSON structure [GAP FILLED] | Same | Same — log field name + schema → skip. Track separately from malformed. | Same | Data Mapping gap fill |
| Anthropic API | Timeout [GAP FILLED] | Pipeline blocked | Timeout threshold. After timeout → retry. If 3 consecutive timeouts same tweet → skip + log. Alert if timeout rate >20%. | Skip problematic tweets | Standard timeout handling |
| **Stripe** | Webhook missed | Plan not synced | Stripe auto-retries 3 days. Reconciliation job daily 2AM UTC: query Stripe API → sync mismatches. | Eventual consistency (≤24h delay) | 2.2b Side-effect failures |
| Stripe | Checkout fails (400/402) | Cannot upgrade, retry available | Return 400, show sanitized error, allow retry. Log Sentry. | User retry — transient may resolve | 2.2b Business logic errors |
| Stripe | Payment failed (invoice.payment_failed) | Subscription at risk | Webhook received → send failure email. If attempt<3: grace period. If ≥3: downgrade to free. | Grace period → eventual downgrade | Webhook #4, 2.2b downgrade |
| **Resend** | Send fails (400/429) | No email, web still accessible | Retry (linear backoff pattern, max 2). Final fail → log `failed_email_jobs`, admin manual resend. | Web app access remains — email = convenience only | 2.2b External service errors |
| Resend | 5xx down | Same | Same | Same | Same |
| Resend | 554 Permanent [GAP FILLED] | Domain invalid, cannot deliver | No retry (permanent). Mark email_valid=false → disable → in-app notification "update email". | User uses web app, loses email delivery | Email deliverability best practice |
| **Telegram** | 403 Blocked by user | Alert not delivered | No retry (permanent). Log info level. User can re-link if unblocks. | User won't get alerts until unblock. Web accessible. | 2.2b Side-effect failures |
| Telegram | 429 Rate limit | Alerts delayed | Retry immediate once. If fail → log, skip (non-critical). | Delayed delivery. Email backup for critical admin alerts. | 2.2b External service errors |
| Telegram | Timeout [GAP FILLED] | Alert blocked | Timeout → log → skip (non-critical side effect). | Skip failed alert. Email backup. | 2.2b side-effect handling |
| **Twitter Web Intent** | Twitter.com down [GAP FILLED] | Draft feature broken | Hard dependency — no server action. Show fallback UI: "Twitter unavailable. Copy draft below:" + display text. | Manual copy/paste. No data loss (draft in DB). | Gap analysis hard dependency |

**Retry Strategy Summary (direction only — timings in 2.2e):**
- twitterapi.io / Anthropic: Exponential backoff, max 3 retries
- Stripe: No auto-retry outbound (user-triggered). Webhooks auto-retry by Stripe.
- Resend: Linear backoff, max 2 retries
- Telegram: Immediate retry once, then skip

**Circuit Breaker Thresholds:**
- twitterapi.io: error rate >20% → auto-pause source crawl
- Anthropic: accuracy <80% (spot-check) → alert
- Any service: >3 consecutive failures → escalate alert

---

## Phần 5 — Security & Compliance

| Service | Data Sent | Data Received | PII? | Encryption | Compliance Notes | Source |
|---------|-----------|---------------|------|------------|------------------|--------|
| **twitterapi.io** | KOL usernames, cursor | Tweet text, author metadata | No (public data) | HTTPS [verify] | No GDPR concerns — public data per GDPR Article 4(1). Audit: log outbound calls vào **`audit_logs`** (`event_type` per `SPEC-api` §9) — không dùng bảng `api_audit_log` riêng trừ khi CR. | Ideation §7; `SPEC-api` audit catalog |
| **Anthropic API** | Tweet text (public), user categories (preference) | LLM responses (derived) | No (public + minimal preference data) | HTTPS [verify] | No GDPR concerns for input (public tweets). Anthropic retention: verify policy. If indefinite retention → concern on user deletion (tweets in logs). Mitigation: (a) Enterprise zero-retention [verify cost vs budget], (b) Accept (legitimate interest — public data), (c) Anonymize categories in prompts. Recommend (b) Phase 1. | Ideation §7, Anthropic ToS [verify], GDPR Art 6(1)(f) |
| **Stripe** | User email (PII), subscription metadata | Customer ID, payment metadata (PII) | Yes — email, payment data | HTTPS, PCI-DSS L1 [verify] | GDPR deletion (Art 17): DELETE `/customers/{id}`. Retain subscription history anonymized (email→`deleted-user-{SHA256(email+salt)}`, remove payment metadata, keep dates/amounts) per Art 17(3)(e) accounting exemption. Audit: Log API calls + webhook events if NFR requires. Data residency: Verify Nextel SG Stripe account region (US/EU/APAC) — if US + EU users → assess SCC requirement. [GAP FILLED — anonymization method specified] | Ideation §7, GDPR Art 17, PCI-DSS |
| **Resend** | User email (PII), digest content (public-derived) | Send status | Yes — email | HTTPS [verify] | GDPR deletion: Verify Resend auto-deletes OR requires API call. Email content = public data (no concern). Audit: Log send events (timestamp, email hash, status) — hash for PII minimization. Bounce/complaint: process + delete (no long-term retention). | Ideation §7, Resend Privacy [verify], GDPR Art 5(1)(c) minimization |
| **Telegram** | chat_id (indirect PII), signal content (public) | User metadata (not stored) | Yes — chat_id links to User | HTTPS [verify] | GDPR deletion: Set telegram_chat_id=NULL. Telegram retains messages (cloud) — out of our control, Telegram = independent controller per GDPR Art 4(7), not our processor. Recommend: Disclose in UI "Messages stored by Telegram per their policy". Audit: Log API calls (timestamp, chat_id hash). [GAP FILLED — processor responsibility clarified] | Ideation §7, Telegram Privacy [verify], GDPR Art 4(7), Art 13 transparency |
| **Twitter Web Intent** | Draft text (public-derived) | N/A | No | HTTPS (Twitter.com) | No GDPR concerns — public data, client redirect. Twitter = independent controller. | Ideation §7 |

**GDPR Deletion Workflow (Article 17):**
1. User requests deletion
2. Actions:
   - Stripe: DELETE `/customers/{id}`
   - Resend: Verify method [verify], call if API exists, else anonymize + rely on auto-delete
   - Telegram: Set chat_id=NULL (user deletes chat separately)
   - Internal: Anonymize User (email→hash, name→NULL, preserve ID for referential integrity). Retain subscription history per Art 17(3)(e).
3. Audit: Log deletion (user_id, timestamp, IP, services contacted)

**Anonymization Method (Stripe history):**
- Email: `deleted-user-{SHA256(original_email + salt)}`
- Payment: Remove brand/last4/country, keep dates/amounts only
- User.id: Retain as FK (preserve data integrity)

**Audit Logging (NFR #10):**
- Table: **`audit_logs`** (immutable) — schema + **danh mục + write mechanism LOCK:** **`SPEC-api` Section 9 §1.3.1** (layer ghi, `metadata`, `api_call_outbound` sample/on-error).
- Retention: theo NFR / vận hành (immutable, có thể partition/archive).

---

## Phần 6 — Downstream Constraints for 2.2e

### Hard Constraints (khóa internal API design)

| # | Constraint | From Service | Impact on Internal API | Source |
|---|-----------|-------------|----------------------|--------|
| 1 | Webhook signature verification | Stripe, Telegram, Resend [GAP FILLED — Resend added] | Middleware verify: (a) `Stripe-Signature` (HMAC SHA-256), (b) `X-Telegram-Bot-Api-Secret-Token`, (c) Resend signature [verify method]. Reject unsigned (401). | Phần 2 webhooks |
| 2 | Idempotency for webhooks | Stripe, Telegram, Resend [GAP FILLED] | Store processed IDs: `processed_stripe_events`, `processed_telegram_updates` (TTL 24h), `processed_resend_events`. Check before process, skip if duplicate. | Phần 2 notes, Phần 3 Telegram update_id |
| 3 | External IDs must persist | Stripe, Telegram, Twitter | Preserve: stripe_customer_id, telegram_chat_id, tweet_id. Never delete without sync. Read-only in admin UI (system-managed). | Phần 3 Data Mapping |
| 4 | LLM response parsing errors (2 types) | Anthropic API | Handle: (a) Malformed JSON (syntax) → catch parse exception, (b) Invalid structure (missing fields) → validate schema post-parse. Both: log to Sentry (include field/schema details) → skip → continue. Track rates separately, alert if either >10%. | Phần 2 Anthropic notes, Phần 3 gap fills, Phần 4 |
| 5 | Email HTML server-side render | Resend | Render full HTML (Laravel Blade) before API call. Cannot use external templates. Must be responsive (mobile-first). | Phần 2 Resend #1, Ideation mobile-first |
| 6 | Rate limit-aware queuing | twitterapi.io, Anthropic [GAP FILLED — details TBD after verification] | Queue throttling per 2.2b. LIMITS TBD (verify RPM/TPM with providers). Direction: limit concurrent calls, batch sources, stagger requests. Laravel Queue `RateLimited` or Redis limiter. | Phần 2 rate limit columns, 2.2b Queue Pattern, Verification Tasks #1-2 |
| 7 | Plan sync from Stripe webhook ONLY | Stripe | User.plan field: (a) No direct updates (except initial='free'), (b) Changes via webhook OR admin override (separate endpoint + audit log: `admin_audit_log` table). Public User update: plan read-only. | Phần 2 Stripe webhooks, 2.2c User.plan |
| 8 | Category filter OR logic [GAP FILLED] | Internal logic (2.2a conflict #24) | Digest filter: OR logic for multi-category signals. If user selects ["AI", "Crypto"] → show signals where categories array overlaps ANY. Postgres: `signal.categories && ARRAY[...]` (overlap operator). NOT AND logic. | 2.2a conflict #24, 2.2b conflict #16, Phần 3 Signal.categories |
| 9 | Free tier schedule: Mon/Wed/Fri [GAP FILLED] | Internal logic (2.2a assumption #1) | Digest delivery: enforce Free=Mon/Wed/Fri only (3/week per Ideation §4). Check User.plan before send. Pro/Power=daily. Cron daily 8AM UTC, filter by plan+day. | 2.2a assumption #1, Ideation §4 Free tier |
| 10 | My KOLs cap enforcement [GAP FILLED] | Internal logic (2.2a Permission Matrix) | Subscribe endpoint: check cap BEFORE create MySourceSubscription. Pro<10, Power<50. If exceeded → 400 `SUBSCRIPTION_CAP_EXCEEDED` + upgrade prompt. Atomic check (transaction lock or SELECT FOR UPDATE — race condition). | 2.2a Permission Matrix caps, 2.2c MySourceSubscription |
| 11 | Timezone: UTC only [GAP FILLED] | All services (return UTC) | Store all datetime fields as UTC (Postgres `timestamp with time zone`). User timezone = frontend concern (convert UTC→local for display). Backend API: return UTC ISO 8601 + 'Z' suffix. | Phần 3 timezone note, standard best practice |
| 12 | Prompt engineering constraint [GAP FILLED] | Anthropic API | LLM responses must be structured JSON (enforced via prompt). Prompt design = contract constraint (affects parsing reliability). Prompts must specify: (a) JSON-only output, (b) Schema with required fields, (c) No preamble/markdown. Test prompts before deploy. | Phần 2 Anthropic notes, Phần 3 parsing dependencies |
| 13 | Stripe price→plan env config [GAP FILLED] | Stripe | Deployment config: STRIPE_PRO_PRICE_ID, STRIPE_POWER_PRICE_ID required. Validate at app startup (throw error if missing). Unknown price IDs → log + alert + default 'free'. | Phần 3 Stripe mapping note, Phần 1 env config |

---

### Unresolved Blockers (MUST resolve before 2.2e)

| # | Blocker | Blocks What | Need | Source |
|---|---------|------------|------|--------|
| 1 | twitterapi.io — chi tiết còn **[verify]** theo tài khoản trial | Flow 1 user lookup fields; rate limits thực tế | Xác nhận path/auth khớp **Báo cáo POC**; test trial. **Primary crawl path đã chốt:** `advanced_search` (`SPEC-api` 2026-04-06). | Verification Tasks #1, Phần 2 |
| 2 | ~~Anthropic clustering method~~ | ~~Endpoint #2~~ | **Đã chốt:** prompt-based Phase 1. Embeddings = tùy chọn sau. | `SPEC-api` changelog 2026-04-06 |
| 3 | Stripe price IDs not created | Checkout session, webhook plan sync | Create in Stripe dashboard: Pro ($9.90/mo), Power ($29.90/mo). Copy IDs → env config. Document in deployment guide. | Verification Tasks #3, Phần 3 Stripe mapping, Active Assumption #2 |
| 4 | Email provider not finalized | Email integration implementation | Finalize Resend vs SendGrid. Test: (a) deliverability (inbox, spam score), (b) free tier (hard/soft limit?), (c) webhook support, (d) Laravel SDK. Recommend Resend but validate first. | Verification Tasks #4, 2.2b assumption #5, Active Assumption #4 |
| 5 | Telegram auth flow incomplete | Telegram onboarding, chat_id linking | Design: (a) JWT token (payload: user_id, exp 10min, nonce), sign HS256, (b) Deep link `t.me/{bot}?start={JWT}`, (c) Webhook verify JWT + check nonce not used (`telegram_auth_tokens` table), (d) Link chat_id + mark nonce used. Document in 2.2e. | Verification Tasks #5, Phần 2 Telegram webhook, Active Assumption #5 |
| 6 | Stripe account region unknown [GAP FILLED] | GDPR compliance (EU users?), SCC requirement | Check Nextel SG Stripe account → Business Location. If US-based + EU users → assess SCC. If SG → verify APAC residency. Document findings. | Verification Tasks #8, Phần 5 Stripe compliance |
| 7 | Resend bounce/complaint webhook method [GAP FILLED] | Email deliverability monitoring, bounce handling | Verify Resend docs: (a) Webhook events available? (b) Event names? (c) Signature verification method? Add to endpoint mapping if confirmed. | Verification Tasks #9 (new), Phần 2 Resend webhooks, Phần 4 554 failure |
| 8 | twitterapi.io last_tweet_date availability [GAP FILLED] | Source activity validation (Flow 1 Step 2) | Verify `/users/{username}` response includes last_tweet_date OR tweet_count_30d. If neither → need workaround (fetch recent tweets via endpoint #1, check count). | Verification Tasks #10 (new), Phần 2 endpoint #2 CRITICAL, Phần 3 is_active mapping |

---

### Active Assumptions (validate during implementation)

| # | Assumption | Affects | Risk if Wrong | Source |
|---|-----------|---------|---------------|--------|
| 1 | Anthropic clustering = **prompt-based** Phase 1 (đã chốt SPEC 2026-04-06) | Endpoint #2, cost, accuracy | Nếu sau này chuyển embeddings → CR + đổi integration, không ảnh hưởng contract classify/summarize/draft. | `SPEC-api` / `SPEC-core` Flow 3 |
| 2 | Stripe price IDs via env config | Plan mapping, webhook sync | If IDs change (new tiers, promos) → env update + redeploy. Wrong mapping → charged but not upgraded. Mitigation: validate at startup. | Open Questions #2, Blocker #3 |
| 3 | Stripe webhook reconciliation daily 2AM UTC | Webhook missed strategy | If delivery <90% reliable → 24h delay too long, need hourly. If 99.9% → daily unnecessary (but harmless). Monitor in production to tune. | Open Questions #3, Phần 4 Stripe webhook missed |
| 4 | Resend chosen (not SendGrid) | Email endpoints, webhooks, templates | If SendGrid → different API: template IDs (not HTML string), different auth, error codes, webhook names. Migration 1-2 days. | 2.2b assumption #5, Open Questions #4, Blocker #4 |
| 5 | Telegram token: JWT, 10min exp, single-use nonce | Auth security, UX | Reuse allowed → security risk. Exp too short (<5min) → UX friction. Too long (>30min) → extended risk. 10min = balance. | Open Questions #5, Blocker #5 |
| 6 | NFR audit logging required | All services compliance notes | If NO audit → remove logs (save 1-2 days dev). If partial (payment only) → clarify scope. If all → implement per 2.2b Event pattern. NFR not provided → cannot validate. | Open Questions #6, Phần 5 all rows |
| 7 | Free tier Mon/Wed/Fri schedule | Digest delivery cron | Different days needed (Tue/Thu/Sat for timezone) → change filter. User expects daily → churn. Display schedule clearly in signup. | Open Questions #7, Constraint #9 |
| 8 | My KOLs stats on-demand (no pre-aggregation) | Stats query performance | If slow (>2s) → need cache per 2.2b assumption #4. User UX hit. Monitor Sprint 1, add cache if needed. | Open Questions #8, 2.2a Flow 4 assumption #12 |

---

## Phần 7 — Open Questions / Verification Tasks

### Verification Tasks (complete before 2.2e finalized)

| # | Service | Verify What | Method | Affects |
|---|---------|-------------|--------|---------|
| 1 | twitterapi.io | Endpoint paths, schemas (last_tweet_date?), rate limits, auth header | Read API docs (if exist), test trial account, contact support | Phần 1-4, Blocker #1, #8 |
| 2 | Anthropic API | Model string (claude-haiku-?), embeddings API (exists? pricing?), rate limits (RPM/TPM), structured output support | Read docs.anthropic.com, test with account, confirm model availability | Phần 1-4, Blocker #2 |
| 3 | Stripe | Create price IDs (Pro $9.90, Power $29.90), webhook signature method, delivery SLA | Stripe dashboard (create products+prices), API docs (webhooks), dev docs (best practices) | Phần 1-3, Blocker #3 |
| 4 | Resend | Free tier (3000/mo hard or soft?), endpoint paths, deliverability (spam score), data retention (GDPR), webhook support | Resend docs, test account, privacy policy | Phần 1-5, Blocker #4 |
| 5 | Telegram | Webhook secret header, rate limits (30 msg/sec?), deep link parameter passing | Bot API docs (core.telegram.org/bots/api), create test bot, test webhook+deep link | Phần 1-3, Blocker #5 |
| 6 | Twitter Web Intent | URL scheme still supported (X.com rebrand?), URL encoding edge cases (emojis, multi-line) | Developer docs (developer.twitter.com), manual browser tests | Phần 2-3 |
| 7 | Anthropic Data Retention | Prompts/responses retained? Retention period? Enterprise zero-retention (availability/cost)? | Terms of Service, Privacy Policy, contact sales | Phần 5 Anthropic compliance |
| 8 | Stripe Account Region | Nextel SG account region (US/EU/APAC) — GDPR + data residency | Stripe dashboard settings, contact support | Phần 5 Stripe compliance, Blocker #6 |
| 9 | Resend Webhooks [NEW] | Bounce/complaint events available? Event names? Signature verification? | Resend docs, test account | Phần 2 Resend webhooks, Blocker #7 |
| 10 | twitterapi.io Activity Check [NEW] | `/users/{username}` returns last_tweet_date OR tweet_count_30d? | API docs, test call | Phần 2 endpoint #2, Phần 3 is_active, Blocker #8 |

### Open Questions (prioritized)

| # | Question | Impact | Decision Needed | Source |
|---|----------|--------|-----------------|--------|
| 1 | ~~Anthropic clustering: prompt-based OR embeddings?~~ | — | **Đã chốt:** prompt-based Phase 1. | Amendment 2026-04-06 |
| 2 | Stripe price IDs: values unknown | Cannot implement checkout, webhook sync | Create in dashboard, document in env vars. BLOCKER. | Blocker #3, Assumption #2 |
| 3 | Stripe webhook reconciliation frequency: daily sufficient? | User experience (plan sync delay acceptable?) | Start daily, monitor webhook delivery rate Sprint 1, increase frequency if >10% miss rate. | Assumption #3 |
| 4 | Email provider: Resend OR SendGrid? | API contract shape, migration risk if switch mid-dev | Finalize before 2.2e. Test deliverability + free tier. Resend recommended but not confirmed. | Blocker #4, Assumption #4 |
| 5 | Telegram token expiry: 10min appropriate? | UX (too short=friction) vs security (too long=risk) | 10min = assumed balance. Can adjust post-launch if user feedback indicates issue. | Blocker #5, Assumption #5 |
| 6 | NFR audit logging scope: all services OR selective? | Dev effort (1-2 days if all), storage cost | NFR not provided. Assumed required for all. If NFR confirms NO → remove to save time. | Assumption #6 |
| 7 | Free tier schedule: Mon/Wed/Fri locked OR configurable? | User expectation management, churn risk | Display clearly in signup. If high churn → consider configurable days Phase 2. | Assumption #7 |
| 8 | My KOLs stats: cache strategy needed Phase 1? | Performance (if >2s load = UX hit) | Start on-demand, monitor Sprint 1. Add cache (Redis 1h TTL) if slow. | Assumption #8 |
| 9 | i18n provider ngoài có cần cho Phase 1? | Scope/cost | **Không** — baseline en/vi dùng dictionary nội bộ; chưa dùng external translation API. | CR 2026-04-14 (2.5.7, 3.5.x) |
| 9 | ~~Source review workflow~~ | Spam control vs user friction | **Đã chốt (CR 2026-04-13 / SPEC): Option B** — user-added → **`pending_review`**; admin **approve** → `active` rồi mới crawl/browse công khai. File này chỉ ghi thêm **Resend** có thể dùng cho thông báo sau duyệt. | `SPEC-core` §4, `SPEC.md`, `IMPLEMENTATION-ROADMAP.md` 3.3.x |
| 10 | Category filter: OR confirmed OR needs founder decision? | Digest relevance, user satisfaction | 2.2a/2.2b conflict #24. Recommend OR logic (show if ANY match). Document as Hard Constraint #8. | 2.2a conflict #24, 2.2b conflict #16, Constraint #8 |

---

**End of API-CONTRACTS.md (COMPLETE with all 30 gaps filled)**

**Summary:**
- 6 services mapped (all from Ideation §7)
- 23+ endpoint rows (twitterapi: **advanced_search primary** + user/profile; 4 Anthropic `/messages`, …) — chi tiết bảng đầy đủ trong **`SPEC-api.md`**
- 23 data mappings (all critical fields covered)
- 18 failure modes (all services × applicable modes)
- 6 security/compliance rows (GDPR workflows specified)
- 13 hard constraints (all from gaps + 2.2a/2.2b conflicts resolved)
- Blockers: twitterapi trial verification còn cần; clustering ~~blocker~~ đã chốt trong SPEC
- 8 active assumptions (validate during Sprint 1)
- 10 verification tasks (prioritized)
- 10 open questions (decision tree for founder)

**Ready for 2.2e (Internal API Design)** — crawl path twitterapi + clustering đã chốt trong SPEC; tiếp tục verify trial account cho field Flow 1 và rate limits.

**Đồng bộ 2026-04-06:** Ưu tiên đọc **`SPEC-api.md`** (Section 10 + §9) thay vì chỉ file này.  
**Đồng bộ 2026-04-14:** Số task đánh số trong **`IMPLEMENTATION-ROADMAP.md`** = **59** (không đổi hợp đồng vendor — chỉ liên kết tính năng Resend/notification).