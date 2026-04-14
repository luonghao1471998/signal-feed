# SPEC-api.md — SignalFeed Specification (Sections 9–11)

**Companion:** `SPEC-core.md` (Sections 1–8), `SPEC-plan.md` (12–13 + Appendix).

> **Cross-reference map (legacy → SPEC split files):**  
> `2.2a` → `SPEC-core.md` Sections 5–7 · `2.2b` → Sections 3–4 · `2.2c` → Section 8 · `2.2d` → `SPEC-api.md` Section 10 · `2.2e` → Sections 9 & 11 · `2.2f` → `SPEC-core.md` Sections 1–2 + `SPEC-plan.md` Section 12 · `2.2g` → `SPEC-plan.md` Section 13.  
> Chi tiết trong từng section giữ nguyên văn bản gốc (kể cả chuỗi “2.2x …”).

---

## Section 9 — DB Schema
**Source:** 2.2e Phần 1 (+ file header & External Constraints)
**Last confirmed:** 2026-04-06 (amendment: crawl schedule, twitterapi POC, schema extensions — see changelog in Section 9 header notes)

**Changelog 2026-04-06:** (1) Scheduler/crawl: **4 lần/ngày** (không còn mô tả 96 lần crawl cho digest). (2) **twitterapi.io:** endpoint chính theo **Báo Cáo POC** — `advanced_search` (thay cho ví dụ `/tweets/user/{username}`). (3) Schema: `users.is_admin`, `sources.last_crawled_at`, `tweets.tweet_kind` (optional), bảng **`user_personal_feed_entries`** (Pro/Power personal feed). (4) **ON DELETE** các flag placeholder được **chốt** trong comment SQL. (5) **audit_logs:** danh mục `event_type` + **§1.3.1** cơ chế ghi (LOCK). (6) Anthropic **clustering:** Phase 1 = **prompt-based** (Section 10). (7) **Tweet fetch abstraction** — interface + binding (Section 10, trước Phần 2 §1). (8) **`API-CONTRACTS.md`** — đồng bộ tóm tắt dịch vụ ngoài; nếu lệch, **canonical = file này**. (9) **LLM prompts** — file versioned tại **`docs/prompts/v1/`** (classify, cluster, summarize, draft).

— Schema & API Specs (2.2e)

**Generated:** 2026-04-02  
**Input:** Ideation v2.0 + Domain Foundation (2.2a) + Architecture & State (2.2b) + Data Model (2.2c) + API-CONTRACTS (2.2d)  
**Purpose:** Physical database schema + internal API contracts for AI coding tools  
**DB Engine:** PostgreSQL 15+  
**API Style:** HTTP REST

---

## External Constraints Absorbed

**From 2.2d (API-CONTRACTS.md) — Phần 6 Hard Constraints:**
- Constraint #1: Webhook signature verification (Stripe, Telegram, Resend) — reflected in webhook endpoint specs
- Constraint #2: Idempotency for webhooks — reflected in `processed_stripe_events`, `processed_telegram_updates`, `processed_resend_events` tables
- Constraint #3: External IDs must persist — reflected in User.stripe_customer_id, User.telegram_chat_id, Tweet.tweet_id (read-only in API)
- Constraint #7: Plan sync from Stripe webhook ONLY — reflected in User update endpoint (plan field read-only)
- Constraint #8: Category filter OR logic — reflected in Digest list endpoint filter query (Postgres array overlap operator)
- Constraint #9: Free tier Mon/Wed/Fri schedule — reflected in Digest delivery job filter logic (not API surface, noted in implementation comment)
- Constraint #10: My KOLs cap enforcement — reflected in MySourceSubscription create endpoint guards
- Constraint #11: Timezone UTC only — reflected in all datetime columns (TIMESTAMPTZ), API response format (ISO 8601 + 'Z')
- Constraint #13: Stripe price→plan env config — reflected in webhook handler validation logic (not schema, noted in API spec)

---

## Phần 1 — DB Schema

### 1.1 — Type Mapping Reference

| Logical Type (2.2c) | PostgreSQL 15+ Physical Type | Rule |
|---------------------|------------------------------|------|
| identifier | BIGSERIAL | Laravel default auto-increment PK. UUID alternative flagged if public ID exposure needed. [based on assumption #1] |
| string | TEXT | PostgreSQL default string type. No arbitrary VARCHAR(N) unless 2.2c Notes specify domain length. |
| text | TEXT | |
| integer | INTEGER | |
| decimal | NUMERIC | Precision/scale specified only when 2.2c domain source exists (e.g., money = NUMERIC(10,2)). Otherwise placeholder comment. |
| boolean | BOOLEAN | |
| date-time | TIMESTAMPTZ | Timezone-aware per 2.2d Constraint #11 (UTC storage). |
| date | DATE | |
| enum | CREATE TYPE ... AS ENUM + CHECK constraint | Values match 2.2b state machine exactly. Assumption markers inherited. |
| object (structured) | JSONB | PostgreSQL native JSON with indexing. Shape documented in column comment. |
| array of string | TEXT[] | PostgreSQL native array. Used for Signal.categories, Signal.topic_tags, User.my_categories per 2.2c. |
| array of relation | INTEGER[] (FK array) | For User.my_categories (category IDs array). |
| relation (FK) | INTEGER / BIGINT | Match referenced table PK type. |

**Notes:**
- [assumption #1]: Identifier strategy = BIGSERIAL (auto-increment) for internal PK. UUID alternative if public-facing IDs needed (API URLs, share links). Phase 1: BIGSERIAL for simplicity (Laravel default). Flag if UUID needed.

---

### 1.2 — Enum Types

```sql
-- ============================================================
-- Enum Types
-- ============================================================

-- Source.type enum
-- Source: 2.2c Source.type, 2.2a Entity Relationship "type enum: 'default' or 'user'"
CREATE TYPE source_type AS ENUM ('default', 'user');

-- Source.status enum
-- Source: 2.2b Source state machine — pending_review | active | spam | deleted
-- Phase 1 Option B (SPEC-core): user-added sources → status='pending_review' then admin approve -> active
CREATE TYPE source_status AS ENUM ('pending_review', 'active', 'spam', 'deleted');

-- User.plan enum
-- Source: 2.2c User.plan, 2.2a F02 "plan enum: free, pro, power"
CREATE TYPE user_plan AS ENUM ('free', 'pro', 'power');

-- UserInteraction.action enum
-- Source: 2.2c UserInteraction.action, 2.2a Entity Relationship "action enum ('click', 'skip', 'copy_draft', 'edit_draft')"
CREATE TYPE interaction_action AS ENUM ('click', 'skip', 'copy_draft', 'edit_draft');
```

---

### 1.3 — Tables

```sql
-- ============================================================
-- Core Entity Tables
-- ============================================================

-- Table: categories
-- Source: 2.2c Category entity
-- Lifecycle: No lifecycle — CRUD only (read-only) — 2.2b Section 3
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL, -- 2.2c Category.name — platform invariant, one of 10 predefined
    slug TEXT NOT NULL UNIQUE, -- 2.2c Category.slug — URL-safe identifier for API filtering
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- 2.2c Category.created_at — seeded at migration
);
-- Values: AI & ML, Developer Tools, Indie Hackers & SaaS, Marketing & Growth, Startup & VC, 
--         Crypto & Web3, Finance & Markets, Design & Product, Creator Economy, Tech Industry & Policy
-- Slugs: ai-ml, developer-tools, indie-hackers-saas, marketing-growth, startup-vc, 
--        crypto-web3, finance-markets, design-product, creator-economy, tech-industry-policy


-- Table: users
-- Source: 2.2c User entity + NFR OAuth X.com only Phase 1
-- Lifecycle: Simple status — 2.2b Section 3 (plan changes via Stripe webhook)
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1, -- NFR #5, #6: Phase 2 multi-tenant prep
    
    -- OAuth X.com fields (Phase 1 primary auth method per NFR)
    x_user_id TEXT UNIQUE, -- X.com user ID from OAuth token (primary identifier Phase 1)
    x_username TEXT, -- X.com @handle from OAuth profile
    x_access_token TEXT, -- OAuth access token (encrypted at app layer)
    x_refresh_token TEXT, -- OAuth refresh token (encrypted at app layer)
    x_token_expires_at TIMESTAMPTZ, -- Token expiry for refresh logic
    
    -- Email/password fields (Phase 2 or fallback - nullable Phase 1)
    email TEXT UNIQUE, -- Email from X.com profile OR manual entry Phase 2. Nullable Phase 1 (OAuth may not provide email).
    email_valid BOOLEAN DEFAULT true, -- Email deliverability per 2.2d Resend bounce webhook. False = bounce detected.
    password_hash TEXT, -- Nullable Phase 1 (OAuth-only). Phase 2: bcrypt/argon2 if email/password auth added.
    
    name TEXT, -- Display name from X.com profile OR manual entry [based on 2.2c assumption #1]
    plan user_plan NOT NULL DEFAULT 'free', -- 2.2c User.plan — changed via Stripe webhook only (2.2d Constraint #7)
    my_categories INTEGER[] NOT NULL DEFAULT '{}', -- 2.2c User.my_categories — array of category IDs, 1-3 selected at onboarding
    delivery_preferences JSONB NOT NULL DEFAULT '{"email": true, "telegram": false, "web": true}', -- 2.2c User.delivery_preferences — plan-gated features
    telegram_chat_id TEXT, -- 2.2c User.telegram_chat_id — for F17 Telegram delivery [based on 2.2c assumption #2]
    stripe_customer_id TEXT, -- 2.2c User.stripe_customer_id — Stripe billing [based on 2.2c assumption #3], NULL for free users
    is_admin BOOLEAN NOT NULL DEFAULT false, -- 2026-04-06: admin API guard (SPEC-api Section 11 /admin/*); set via env seed or manual
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auth constraint: Phase 1 requires OAuth (x_user_id NOT NULL for all users). Phase 2: email/password optional.
-- Accommodates 2.2d Constraint #11 (UTC timezone storage)
-- my_categories: CHECK constraint for 1-3 items validated at app layer (not DB) per onboarding flow
-- Sprint task 1.3.2: OAuth flow creates user with x_user_id, x_username, x_access_token from X.com callback


-- Table: sources
-- Source: 2.2c Source entity
-- Lifecycle: Full state machine — 2.2b Section 3; Phase 1 Option B: happy-path add → pending_review (approve-first moderation)
CREATE TABLE sources (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1, -- NFR #5, #6: Phase 2 multi-tenant prep
    type source_type NOT NULL, -- 2.2c Source.type — 'default' (platform) or 'user' (user-added)
    handle TEXT NOT NULL UNIQUE, -- 2.2c Source.handle — Twitter username without @ prefix
    account_url TEXT NOT NULL, -- 2.2c Source.account_url — https://twitter.com/{handle}
    display_name TEXT, -- 2.2c Source.display_name — from Twitter profile, can change
    is_public BOOLEAN NOT NULL DEFAULT true, -- 2.2c Source.is_public — validated at add time (2.2a Flow 1)
    is_active BOOLEAN NOT NULL DEFAULT true, -- 2.2c Source.is_active — ≥1 tweet in last 30 days check [based on 2.2a assumption #5]
    status source_status NOT NULL DEFAULT 'active', -- 2.2c Source.status — type='default' active; user-added set pending_review at app layer
    added_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, -- 2.2c Source.added_by — NULL for type='default', required for type='user'
    last_crawled_at TIMESTAMPTZ, -- 2026-04-06: last successful twitterapi fetch for this source (crawl loop / backoff / observability)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ -- 2.2c Source.deleted_at — soft delete per 2.2b state machine
);
-- CR 2026-04-13: type='user' created pending_review; admin approve -> active before crawl


-- Table: source_categories (M:N junction)
-- Source: 2.2a Entity Relationship SourceCategory, M:N junction Source ↔ Category
-- Lifecycle: No lifecycle — CRUD only — 2.2b Section 3
CREATE TABLE source_categories (
    id BIGSERIAL PRIMARY KEY,
    source_id BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT, -- CHỐT 2026-04-06: categories không xóa Phase 1; RESTRICT
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_id, category_id)
);
-- Per 2.2a Flow 1 Guard: Source must have ≥1 category (enforced at app layer, not DB)


-- Table: my_source_subscriptions (M:N junction — User ↔ Source for My KOLs)
-- Source: 2.2a Entity Relationship MySourceSubscription, M:N User ↔ Source personal watchlist
-- Lifecycle: Simple flag — 2.2b Section 3 (boolean existence = subscribed)
CREATE TABLE my_source_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1, -- NFR #5, #6: Phase 2 multi-tenant prep
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE, -- [based on 2.2a assumption #6: preserve on source soft delete]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Used for "first 10" selection in downgrade per 2.2b assumption #10
    UNIQUE(user_id, source_id)
);
-- Cap enforcement: Pro max 10, Power max 50, Free = 0 — checked at API layer (2.2d Constraint #10), not DB
-- [assumption #6 from 2.2a]: Soft-deleted sources preserve subscriptions (user keeps following until manual unfollow)


-- Table: tweets
-- Source: 2.2c Tweet entity
-- Lifecycle: Simple flag — 2.2b Section 3 (crawled → classified, immutable after classification)
CREATE TABLE tweets (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1, -- NFR #5, #6: Phase 2 multi-tenant prep
    source_id BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE, -- CHỐT 2026-04-06: CASCADE khi source bị xóa cứng (hiếm); soft-delete Source giữ tweets
    tweet_id TEXT NOT NULL UNIQUE, -- 2.2c Tweet.tweet_id — external Twitter ID, accommodates 2.2d Constraint #3
    tweet_kind TEXT CHECK (tweet_kind IS NULL OR tweet_kind IN ('post', 'reply', 'quote', 'retweet')), -- 2026-04-06: optional; weight classify Sprint 1+ nếu cần
    text TEXT NOT NULL, -- 2.2c Tweet.text — tweet content, max 280 chars (Twitter limit) but TEXT for threads
    url TEXT NOT NULL, -- 2.2c Tweet.url — https://twitter.com/{handle}/status/{tweet_id}
    posted_at TIMESTAMPTZ NOT NULL, -- 2.2c Tweet.posted_at — original tweet timestamp from Twitter (UTC)
    is_signal BOOLEAN NOT NULL, -- 2.2c Tweet.is_signal — TRUE if signal_score ≥0.7 (2.2a assumption #7)
    signal_score NUMERIC(3,2) NOT NULL CHECK (signal_score >= 0 AND signal_score <= 1), -- 2.2c Tweet.signal_score — LLM confidence 0.0-1.0
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When record created in DB (not tweet posted_at)
    deleted_at TIMESTAMPTZ -- 2.2c Tweet.deleted_at — soft delete if source deleted + not linked to signal
);
-- Accommodates 2.2d Constraint #11 (UTC storage)


-- Table: signals
-- Source: 2.2c Signal entity
-- Lifecycle: Simple lifecycle (no user-facing state machine) — 2.2b Section 3 (created → published)
-- Amendment 2026-04-06: Added type + user_id for personal signals (Sprint 2 - sếp feedback)
CREATE TABLE signals (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1, -- NFR #5, #6: Phase 2 multi-tenant prep
    
    -- Signal ownership (2026-04-06 - Personal Signals Support)
    type INTEGER NOT NULL DEFAULT 0, -- 0 = shared (all users, 500 KOL pool), 1 = personal (specific user, My KOLs)
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE, -- NULL if type=0, User ID if type=1
    
    cluster_id TEXT NOT NULL, -- 2.2c Signal.cluster_id — internal clustering ID (UUID or date_hash) - REMOVED UNIQUE for per-user clustering
    title TEXT NOT NULL CHECK (array_length(regexp_split_to_array(title, '\s+'), 1) <= 10), -- 2.2c Signal.title — ≤10 words
    summary TEXT NOT NULL, -- 2.2c Signal.summary — 50-100 words (validated at app layer)
    source_count INTEGER NOT NULL, -- 2.2c Signal.source_count (derived/persisted) — count of unique KOLs
    rank_score NUMERIC(3,2) NOT NULL CHECK (rank_score >= 0 AND rank_score <= 1), -- 2.2c Signal.rank_score — 0.0-1.0
    categories INTEGER[] NOT NULL DEFAULT '{}', -- 2.2c Signal.categories (derived/persisted) — array of category IDs inferred from sources
    topic_tags TEXT[] NOT NULL DEFAULT '{}', -- 2.2c Signal.topic_tags — 1-3 AI-generated tags
    date DATE NOT NULL, -- 2.2c Signal.date — digest date (YYYY-MM-DD), FK to Digest via date
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Pipeline timestamp
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When attached to digest (usually = created_at)
    
    -- Constraints
    CHECK (
        (type = 0 AND user_id IS NULL) OR 
        (type = 1 AND user_id IS NOT NULL)
    ),
    UNIQUE (type, user_id, cluster_id, date) -- Allow same cluster_id for different users
);
-- Accommodates 2.2d Constraint #8 (category filter OR logic via Postgres array overlap operator in queries)
-- Accommodates 2.2d Constraint #11 (UTC storage)
-- Note: type=0 signals generated by shared pipeline (Sprint 1), type=1 by personal pipeline (Sprint 2+)


-- Table: signal_sources (M:N junction — Signal ↔ Tweet ↔ Source attribution)
-- Source: 2.2a Entity Relationship SignalSource, M:N preserves attribution
-- Lifecycle: No lifecycle — CRUD only — 2.2b Section 3 (immutable after signal creation)
CREATE TABLE signal_sources (
    id BIGSERIAL PRIMARY KEY,
    signal_id BIGINT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    tweet_id BIGINT NOT NULL REFERENCES tweets(id) ON DELETE RESTRICT, -- CHỐT 2026-04-06: không xóa tweet đã gán signal (giữ attribution)
    source_id BIGINT NOT NULL REFERENCES sources(id) ON DELETE RESTRICT, -- Denormalized from Tweet.source_id per 2.2c assumption #4 (My KOLs filter performance)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(signal_id, tweet_id)
);
-- [assumption #4 from 2.2c]: source_id denormalized for query performance (My KOLs filter). Trade-off: storage vs query speed.


-- Table: draft_tweets
-- Source: 2.2c DraftTweet entity
-- Lifecycle: No lifecycle — CRUD only — 2.2b Section 3 (immutable)
CREATE TABLE draft_tweets (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1, -- NFR #5, #6: Phase 2 multi-tenant prep
    signal_id BIGINT NOT NULL UNIQUE REFERENCES signals(id) ON DELETE CASCADE, -- 1:1 relationship, 1 draft per signal
    text TEXT NOT NULL CHECK (char_length(text) <= 280), -- 2.2c DraftTweet.text — ready-to-post tweet, ≤280 chars
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Table: digests
-- Source: 2.2c Digest entity
-- Lifecycle: No lifecycle — CRUD only — 2.2b Section 3 (created daily)
CREATE TABLE digests (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1, -- NFR #5, #6: Phase 2 multi-tenant prep
    date DATE NOT NULL UNIQUE, -- 2.2c Digest.date — YYYY-MM-DD, one digest per day
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Midnight UTC per 2.2a assumption #18
    deleted_at TIMESTAMPTZ -- Soft delete after 30 days (F20 archive retention)
);
-- Signals belong to Digest via Signal.date FK (implicit relationship, not junction table per 2.2c assumption #9)


-- Table: user_interactions
-- Source: 2.2c UserInteraction entity
-- Lifecycle: No lifecycle — CRUD only (append-only) — 2.2b Section 3
CREATE TABLE user_interactions (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 1, -- NFR #5, #6: Phase 2 multi-tenant prep
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_id BIGINT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    action interaction_action NOT NULL, -- 'click', 'skip', 'copy_draft', 'edit_draft'
    time_on_signal INTEGER CHECK (time_on_signal >= 0), -- Seconds, NULL for 'skip' action
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Interaction timestamp
);
-- Per Product Strategy V1 Rule #1: Phase 1 capture only, no usage. Phase 2 = data moat.
-- No update/delete operations — append-only log per 2.2b classification



-- Table: user_personal_feed_entries - REMOVED 2026-04-06
-- Replaced by: signals.type + signals.user_id columns
-- Reason: Per sếp feedback - personal signals should be in same table as shared signals, differentiated by type field


-- ============================================================
-- Infrastructure Tables
-- ============================================================

-- Table: processed_stripe_events
-- Source: 2.2d Constraint #2 (webhook idempotency)
-- Lifecycle: Infrastructure — event deduplication
CREATE TABLE processed_stripe_events (
    id BIGSERIAL PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE, -- Stripe event ID from webhook payload
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Accommodates 2.2d Constraint #2 (idempotency for webhooks)


-- Table: processed_telegram_updates  
-- Source: 2.2d Constraint #2 (webhook idempotency)
-- Lifecycle: Infrastructure — event deduplication (TTL 24h per 2.2d)
CREATE TABLE processed_telegram_updates (
    id BIGSERIAL PRIMARY KEY,
    update_id BIGINT NOT NULL UNIQUE, -- Telegram update_id from webhook payload
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- TTL 24h handled at app layer (cleanup job), not DB constraint
-- Accommodates 2.2d Constraint #2


-- Table: processed_resend_events
-- Source: 2.2d Constraint #2 (webhook idempotency)  
-- Lifecycle: Infrastructure — event deduplication
CREATE TABLE processed_resend_events (
    id BIGSERIAL PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE, -- Resend event ID from webhook payload
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Accommodates 2.2d Constraint #2


-- Table: telegram_auth_tokens
-- Source: 2.2d Telegram Inbound webhook notes (deep link auth flow, single-use nonce tracking)
-- Lifecycle: Infrastructure — auth token verification
CREATE TABLE telegram_auth_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nonce TEXT NOT NULL UNIQUE, -- Random UUID, single-use
    used_at TIMESTAMPTZ, -- NULL = not used yet, non-NULL = already consumed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Token expiry (10min) enforced at app layer via JWT exp claim, not DB
-- Accommodates 2.2d Telegram auth flow (prevent replay attacks)


-- Table: anthropic_usage_daily
-- Source: 2.2d Phần 3 Data Mapping (Anthropic API usage.input_tokens, usage.output_tokens → token_usage_log)
-- Lifecycle: Infrastructure — budget monitoring
CREATE TABLE anthropic_usage_daily (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE, -- Daily aggregation
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_estimate NUMERIC(10,2), -- USD, calculated from token count × pricing [precision placeholder — flag #5]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Used for budget monitoring dashboard (admin tracks spend vs $15-30/mo budget per Ideation Section 10)
-- [precision flag #5]: NUMERIC(10,2) = up to $99,999,999.99. Assumption: sufficient for monthly LLM costs. Verify if needs adjustment.


-- Table: audit_logs
-- Source: NFR #10 (Audit log / Compliance tracking — BOTH tables: audit_logs immutable + user_interactions deletable)
-- Lifecycle: Infrastructure — immutable security/compliance events
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, -- Nullable if user deleted (preserve audit trail)
    event_type VARCHAR(50) NOT NULL, -- CHỐT 2026-04-06 catalog: oauth_login, oauth_failed, plan_change (stripe), admin_source_action, admin_pipeline_view, api_call_outbound, api_error_critical, gdpr_export_requested, gdpr_delete_requested, session_revoked, webhook_received (stripe|telegram|resend)
    entity_type VARCHAR(50), -- e.g., 'User', 'Source', 'Signal' (polymorphic reference)
    entity_id BIGINT, -- FK to entity (polymorphic, not enforced by DB constraint)
    metadata JSONB, -- Event-specific data (e.g., {"old_plan": "free", "new_plan": "pro"})
    ip_address INET, -- User IP for security audit
    user_agent TEXT, -- Browser/client info
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

COMMENT ON TABLE audit_logs IS 'Immutable security/compliance events per NFR #10. Used for GDPR compliance, security audit trail. Never delete records.';
-- Write path: middleware (auth), StripeWebhookController, Admin controllers, Integration adapters (sampled api_call_outbound), Artisan GDPR commands.
-- Note: user_interactions table (Section 1.3) handles moat data (deletable). audit_logs = compliance (immutable).
```

### 1.3.1 — `audit_logs`: Danh mục sự kiện & cơ chế ghi (LOCK — 2026-04-06)

**Nguyên tắc**

- **Append-only:** ứng dụng chỉ **INSERT**; không UPDATE/DELETE bản ghi audit từ code nghiệp vụ.
- **`user_id`:** NULL cho sự kiện thuần hệ thống (outbound API sample, lỗi hạ tầng) hoặc khi user đã bị xóa (FK `ON DELETE SET NULL` giữ dòng audit).
- **`ip_address` / `user_agent`:** Ghi khi request HTTP có ngữ cảnh (OAuth, admin, GDPR self-service); job/queue có thể để NULL.
- **`metadata`:** JSONB — hình dạng theo từng `event_type` (bảng dưới); không lưu PII nhạy (full token, full card); có thể lưu **hash** hoặc **4 ký tự cuối** nếu cần debug.

**Triển khai khuyến nghị (Laravel)**

- Một **service** tập trung (vd. `App\Services\AuditLogService::record(...)`) hoặc **listener** cho event nội bộ (`OAuthSucceeded`, `StripePlanUpdated`, …) để tránh nhân đôi logic ghi.
- Ghi **đồng bộ** trong cùng DB transaction với side effect quan trọng khi cần (vd. `plan_change` sau khi commit user plan).
- **`api_call_outbound`:** Phase 1 có thể **sample** (vd. 1 log / N request thành công) + **luôn ghi** khi `http_status >= 400` hoặc timeout → tránh phình bảng; chi tiết `N` = config env.

**Danh mục `event_type` (chỉ dùng các giá trị sau)**

| `event_type` | Khi ghi | Layer / nơi gọi | `user_id` | `entity_type` / `entity_id` | `metadata` (gợi ý) |
|--------------|---------|-----------------|-----------|-----------------------------|---------------------|
| `oauth_login` | OAuth X thành công, session/token đã tạo | `Auth` callback / `UserService` | User vừa đăng nhập | `User` / id | `x_username`, `oauth_provider` |
| `oauth_failed` | OAuth lỗi (từ chối, code invalid, token exchange fail) | Auth callback | NULL hoặc user nếu đã nhận diện | NULL | `error_code`, `step`, `x_error` (rút gọn) |
| `plan_change` | `User.plan` đổi sau Stripe (hoặc admin hiếm) | `StripeWebhookController` / job sync | User bị ảnh hưởng | `User` / id | `old_plan`, `new_plan`, `stripe_event_id` |
| `admin_source_action` | Admin PATCH source (spam, category, soft delete, restore) | `Admin\SourceController` | Admin | `Source` / id | `action`, `payload_summary` |
| `admin_pipeline_view` | Admin mở dashboard pipeline (GET metrics) — tùy chọn, bật nếu cần compliance | `Admin\PipelineController` | Admin | NULL | `route`, `filters` |
| `api_call_outbound` | Gọi HTTP ra vendor (twitterapi, Anthropic, Resend, Telegram, Stripe server-side) | **Adapter / Integration** (sau khi nhận response) | NULL thường gặp | NULL | `service`, `endpoint` (path ngắn), `http_status`, `duration_ms`, `request_summary` (không body đầy đủ) |
| `api_error_critical` | Sau threshold lỗi (vd. 3 fail liên tiếp, circuit mở) | Job pipeline / integration | NULL | NULL | `service`, `error_class`, `message_short` |
| `gdpr_export_requested` | User bấm export dữ liệu | GDPR controller / Artisan kích hoạt bởi user | User | `User` / id | `request_id` |
| `gdpr_delete_requested` | User yêu cầu xóa / bắt đầu workflow xóa | GDPR controller | User | `User` / id | `request_id` |
| `session_revoked` | Logout toàn bộ thiết bị / revoke token | Auth controller | User | `User` / id | `revoked_count` |
| `webhook_received` | Webhook **đã verify chữ ký**, trước khi xử lý nghiệp vụ | Middleware hoặc đầu `WebhookController` | NULL hoặc user sau resolve | NULL | `provider`: `stripe` \| `telegram` \| `resend`, `external_event_type`, `event_id` |

**Lưu ý:** Chuỗi trong comment SQL cũ “`webhook_received (stripe|telegram|resend)`” nghĩa là **`event_type` = `webhook_received`** và **`metadata.provider`** phân biệt nguồn — không tạo thêm giá trị `event_type` khác cho từng provider.

**Không dùng:** Giá trị `api_call` (đã thống nhất thành **`api_call_outbound`**).

**Phân tách với `user_interactions`:** `user_interactions` = hành vi sản phẩm (click signal, copy draft) có thể xóa theo policy; **`audit_logs`** = tuân thủ / bảo mật, immutable.

---

### 1.4 — Indexes

```sql
-- ============================================================
-- Indexes
-- ============================================================

-- FK indexes (database engine convention — PostgreSQL)
CREATE INDEX idx_source_categories_source_id ON source_categories(source_id);
CREATE INDEX idx_source_categories_category_id ON source_categories(category_id);
CREATE INDEX idx_my_source_subscriptions_user_id ON my_source_subscriptions(user_id);
CREATE INDEX idx_my_source_subscriptions_source_id ON my_source_subscriptions(source_id);
CREATE INDEX idx_tweets_source_id ON tweets(source_id);
CREATE INDEX idx_signal_sources_signal_id ON signal_sources(signal_id);
CREATE INDEX idx_signal_sources_tweet_id ON signal_sources(tweet_id);
CREATE INDEX idx_signal_sources_source_id ON signal_sources(source_id); -- For My KOLs filter performance
CREATE INDEX idx_draft_tweets_signal_id ON draft_tweets(signal_id);
CREATE INDEX idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX idx_user_interactions_signal_id ON user_interactions(signal_id);
-- Index: user_personal_feed_entries - REMOVED (table deleted)
-- Replaced by: idx_signals_personal index below

CREATE INDEX idx_signals_type_user_date ON signals(type, user_id, date) WHERE type = 1; -- Fast lookup for personal signals
CREATE INDEX idx_signals_shared_date ON signals(date) WHERE type = 0; -- Fast lookup for shared signals

CREATE INDEX idx_telegram_auth_tokens_user_id ON telegram_auth_tokens(user_id);
CREATE INDEX idx_sources_last_crawled_at ON sources(last_crawled_at); -- crawl loop / ops


-- Permission scope filters (2.2a Permission Matrix)
CREATE INDEX idx_sources_status ON sources(status);
-- Source: admin moderation filters (active/spam/deleted); pending_review if Option B enabled later

CREATE INDEX idx_sources_type ON sources(type);
-- Source: 2.2a Flow 6 — filter type='user' for moderation queue (Option B)

CREATE INDEX idx_sources_added_by_user_id ON sources(added_by_user_id);
-- Source: 2.2a Flow 1 — user views own added sources


-- State-based lookups (2.2b state machines)
CREATE INDEX idx_tweets_is_signal ON tweets(is_signal);
-- Source: 2.2a Flow 3 Cluster step — filter tweets WHERE is_signal=true


-- Explicit search/filter requirements
CREATE INDEX idx_signals_date ON signals(date);
-- Source: 2.2a F13/F14 Digest view — filter signals by digest date, 2.2c Digest-Signal relationship via date FK

CREATE INDEX idx_signals_categories ON signals USING GIN(categories);
-- Source: 2.2a F13 category filter + 2.2d Constraint #8 (OR logic via array overlap operator)
-- GIN index for array overlap queries: WHERE categories && user_filter_array

CREATE INDEX idx_user_interactions_created_at ON user_interactions(created_at);
-- Source: 2.2a F15 My KOLs Stats — 7-day trend calculation (filter by date range)


-- Composite indexes
CREATE INDEX idx_my_source_subscriptions_user_source ON my_source_subscriptions(user_id, source_id);
-- Source: 2.2a Flow 4 My KOLs digest filter — JOIN user subscriptions + signals for personalized view
-- Column order: user_id first (filter by user), source_id second (match signal sources)
```

---

### 1.5 — Computed Fields (Not Stored)

```sql
-- Computed fields from 2.2c Phần 2 (Derived/Computed Fields) — NOT persisted in schema:
-- 
-- User.my_kols_count = COUNT(my_source_subscriptions WHERE user_id = ?)
--   Source: 2.2c Phần 2, User.my_kols_count (computed)
--   Used for: Cap enforcement UI display (2.2a Flow 2 guard check)
--
-- Source.signal_count = COUNT(signal_sources WHERE source_id = ?)
--   Source: 2.2c Phần 2, Source.signal_count (computed [based on assumption #7])
--   Used for: 2.2a F15 My KOLs Stats display
--
-- Source.last_active_date = MAX(tweets.posted_at WHERE source_id = ?)
--   Source: 2.2c Phần 2, Source.last_active_date (computed [based on assumption #7])
--   Used for: 2.2a F15 My KOLs Stats display
--
-- Digest.signal_ids = relation-backed via Signal.date FK
--   Source: 2.2c Phần 2, Digest.signal_ids
--   Query: SELECT id FROM signals WHERE date = digest.date ORDER BY rank_score DESC
```

---

---


---

### 1.3.1 — Audit Logs: Event Types & Write Mechanism

**Purpose:** Comprehensive audit trail cho security, compliance, và debugging. Table `audit_logs` đã định nghĩa trong schema §1.3, section này specify event taxonomy và write mechanism.

**Event Type Taxonomy (23 events across 6 categories):**

#### Category: Authentication (4 events)
- `auth.login.success` — User OAuth login successful (x_user_id captured)
- `auth.login.failed` — OAuth flow failed (token exchange error, captured in metadata)
- `auth.logout` — User initiated logout
- `auth.token.revoked` — User revoked X.com OAuth token

#### Category: Source Management (6 events)
- `source.added` — User added new source to pool (handle, categories in metadata)
- `source.subscribed` — User subscribed to My KOL (Pro/Power)
- `source.unsubscribed` — User unsubscribed from My KOL
- `source.flagged_spam` — Admin flagged source as spam (reason in metadata)
- `source.restored` — Admin restored soft-deleted source (from spam or deleted status)
- `source.categories_updated` — Admin adjusted source categories (old/new categories in metadata)

#### Category: Subscription & Billing (4 events)
- `subscription.created` — Stripe checkout.session.completed webhook processed
- `subscription.updated` — Plan changed (upgrade/downgrade via subscription.updated webhook)
- `subscription.cancelled` — Subscription cancelled (subscription.deleted webhook)
- `subscription.payment_failed` — Payment failed (invoice.payment_failed webhook)

#### Category: User Interaction (5 events)
- `signal.viewed` — User viewed signal detail (signal_id in entity_id)
- `signal.draft_copied` — User clicked "Copy Draft" button (draft_tweet_id in metadata)
- `signal.tweet_opened` — User clicked "Tweet" button (Web Intent opened)
- `digest.email_opened` — Email digest opened (Resend webhook `email.opened`)
- `digest.email_clicked` — Link clicked in email digest (Resend webhook `email.clicked`, link URL in metadata)

#### Category: Admin Actions (3 events)
- `admin.pipeline.manual_trigger` — Admin manually triggered pipeline run
- `admin.source.reviewed` — Admin reviewed source in queue (action taken in metadata: approve/flag_spam/adjust_categories)
- `admin.user.plan_override` — Admin manually changed user plan (bypass Stripe, old/new plan in metadata)

#### Category: System Events (4 events)
- `pipeline.run.started` — Pipeline job started (pipeline_run_id in entity_id, batch size in metadata)
- `pipeline.run.completed` — Pipeline job completed successfully (pipeline_run_id, signals created count in metadata)
- `pipeline.run.failed` — Pipeline job failed (pipeline_run_id, error message in metadata)
- `rate_limit.hit` — External API rate limit hit (service name, endpoint in metadata)

---

**Write Mechanism (Implementation LOCK):**

```php
// app/Services/AuditLogService.php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

class AuditLogService
{
    /**
     * Log an audit event.
     * 
     * @param string $eventType One of 23 defined event types above
     * @param int|null $userId User who triggered action (null for system events)
     * @param string|null $entityType Entity class name (e.g., 'Source', 'Signal', 'User')
     * @param int|null $entityId Primary key of affected entity
     * @param array $metadata Additional context (JSON-serializable)
     * @return void
     */
    public function log(
        string $eventType,
        ?int $userId = null,
        ?string $entityType = null,
        ?int $entityId = null,
        array $metadata = []
    ): void {
        // Validate event type (23 allowed values)
        $allowedEvents = [
            'auth.login.success', 'auth.login.failed', 'auth.logout', 'auth.token.revoked',
            'source.added', 'source.subscribed', 'source.unsubscribed', 'source.flagged_spam', 
            'source.restored', 'source.categories_updated',
            'subscription.created', 'subscription.updated', 'subscription.cancelled', 'subscription.payment_failed',
            'signal.viewed', 'signal.draft_copied', 'signal.tweet_opened', 'digest.email_opened', 'digest.email_clicked',
            'admin.pipeline.manual_trigger', 'admin.source.reviewed', 'admin.user.plan_override',
            'pipeline.run.started', 'pipeline.run.completed', 'pipeline.run.failed', 'rate_limit.hit',
        ];
        
        if (!in_array($eventType, $allowedEvents)) {
            logger()->warning("Invalid audit event type: {$eventType}");
            return;
        }
        
        // Dispatch async write to avoid blocking user request
        Queue::push(function () use ($eventType, $userId, $entityType, $entityId, $metadata) {
            DB::table('audit_logs')->insert([
                'user_id' => $userId,
                'event_type' => $eventType,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'metadata' => json_encode($metadata),
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'created_at' => now(),
            ]);
        });
    }
    
    /**
     * Batch insert multiple audit logs (for high-volume events like pipeline processing).
     * 
     * @param array $events Array of [eventType, userId, entityType, entityId, metadata]
     * @return void
     */
    public function logBatch(array $events): void
    {
        $records = [];
        foreach ($events as $event) {
            $records[] = [
                'user_id' => $event['userId'] ?? null,
                'event_type' => $event['eventType'],
                'entity_type' => $event['entityType'] ?? null,
                'entity_id' => $event['entityId'] ?? null,
                'metadata' => json_encode($event['metadata'] ?? []),
                'ip_address' => $event['ip'] ?? request()->ip(),
                'user_agent' => $event['userAgent'] ?? request()->userAgent(),
                'created_at' => now(),
            ];
        }
        
        if (!empty($records)) {
            DB::table('audit_logs')->insert($records);
        }
    }
}
```

**Usage Examples:**

```php
// In Controller (user action)
public function addSource(Request $request, AuditLogService $auditLog)
{
    $source = Source::create([...]);
    
    $auditLog->log(
        eventType: 'source.added',
        userId: auth()->id(),
        entityType: 'Source',
        entityId: $source->id,
        metadata: [
            'handle' => $source->handle,
            'categories' => $source->categories->pluck('name')->toArray(),
        ]
    );
    
    return response()->json(['data' => $source], 201);
}

// In Event Listener (Stripe webhook)
public function handle(StripeWebhookReceived $event)
{
    if ($event->type === 'checkout.session.completed') {
        $user = User::where('stripe_customer_id', $event->customerId)->first();
        
        $this->auditLog->log(
            eventType: 'subscription.created',
            userId: $user->id,
            entityType: 'User',
            entityId: $user->id,
            metadata: [
                'plan' => $user->plan,
                'stripe_subscription_id' => $event->subscriptionId,
            ]
        );
    }
}

// In Pipeline Job (system event with batch)
public function handle(AuditLogService $auditLog)
{
    $events = [];
    
    foreach ($tweets as $tweet) {
        // Process tweet...
        
        $events[] = [
            'eventType' => 'pipeline.run.completed',
            'userId' => null, // system event
            'entityType' => 'Tweet',
            'entityId' => $tweet->id,
            'metadata' => ['step' => 'classify', 'signal_score' => $tweet->signal_score],
        ];
    }
    
    // Batch insert để tránh 500 individual inserts
    if (count($events) > 10) {
        $auditLog->logBatch($events);
    }
}
```

---

**Trigger Points:**

| Trigger Location | Events Logged | Example |
|------------------|---------------|---------|
| **Controllers** | User actions (add source, subscribe, view signal) | `POST /api/sources` → `source.added` |
| **Middleware** | Auth events (login, logout) | OAuth callback success → `auth.login.success` |
| **Event Listeners** | Webhook processing (Stripe, Resend, Telegram) | Stripe webhook → `subscription.created` |
| **Jobs** | Pipeline events, system actions | PipelineCrawlJob start → `pipeline.run.started` |
| **Admin Controllers** | Admin moderation actions | `PATCH /api/admin/sources/{id}` → `admin.source.reviewed` |

---

**Performance Considerations:**

1. **Async Write:** Queue-based write to avoid blocking user requests (non-critical path)
2. **Batch Insert:** For high-volume events (e.g., pipeline processing 500 tweets → 1 batch insert, not 500 individual)
3. **Sampling:** Consider sampling for very high-frequency events (e.g., `signal.viewed` — log 10% randomly if >1000/day)
4. **No Deletion:** Append-only table (no `deleted_at` column) — retention managed via partitioning (Phase 2)

---

**Retention Policy:**

- **Phase 1:** Indefinite retention (table grows ~1-10K rows/day depending on traffic)
- **Phase 2:** Partition by month after 1 year production
  - Archive partitions >12 months to cold storage
  - Keep 12 months hot for compliance/debugging

---

**Monitoring:**

```sql
-- Daily audit log volume by event type
SELECT 
  event_type,
  DATE(created_at) as date,
  COUNT(*) as event_count
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_type, DATE(created_at)
ORDER BY date DESC, event_count DESC;
```

**Alert Thresholds:**
- `auth.login.failed` >100/hour → potential attack
- `subscription.payment_failed` >10/day → billing issue
- `pipeline.run.failed` >3/day → infrastructure issue

---

**Compliance Notes:**

- **GDPR:** `user_id` + `ip_address` = personal data → include in user deletion flow (anonymize, not delete)
- **Audit:** `event_type` taxonomy supports NFR #10 audit requirements
- **Forensics:** `metadata` JSON field enables root cause analysis for incidents

## Section 10 — API Contracts — External
**Source:** 2.2d API-CONTRACTS.md
**Last confirmed:** 2026-04-06 (amendment: crawl schedule, twitterapi POC, schema extensions — see changelog in Section 9 header notes)

# SignalFeed — API-CONTRACTS.md (COMPLETE)

**Generated:** 2026-04-02  
**Revised:** 2026-04-02 (all 30 gaps filled per technical review)  
**Input:** Ideation v2.0 Section 7 + Domain Foundation (2.2a) + Architecture & State (2.2b) + Data Model (2.2c)  
**Purpose:** Freeze external service contracts before internal API design (2.2e)

---

## Phần 1 — Service Inventory

| # | Service | Purpose | Ideation Source | Direction | Auth Method | Env Config |
|---|---------|---------|-----------------|-----------|-------------|------------|
| 1 | twitterapi.io | Crawl tweets from curated KOL list on **4 scheduled runs per day** (shared pipeline — not 96×/day) | Ideation Section 7: "twitterapi.io — Crawl tweets từ X accounts, External API, $50-70/tháng. Alternatives: Netrows, SociaVault" | Outbound | API key (Bearer / header per **Báo Cáo POC** — verify) | `TWITTER_API_KEY`, `TWITTER_API_BASE_URL` [verify against POC] |
| 2 | Anthropic API | LLM classify signal/noise, cluster tweets, generate summaries + drafts | Ideation Section 7: "LLM API (Haiku / GPT-4o-mini) — Classify, summarize, rank, draft, External API, $15-30/tháng" | Outbound | API key (x-api-key header) [from public knowledge — verify] | `ANTHROPIC_API_KEY` [from public knowledge — verify] |
| 3 | Stripe | Payment processing for Pro/Power subscriptions | Ideation Section 7: "Stripe — Payment processing, Via Nextel SG entity" | Bidirectional | API key (Bearer token) + webhook signature verification [from public knowledge — verify] | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_POWER_PRICE_ID` [from public knowledge — verify] |
| 4 | Resend [provider pending — see 2.2b assumption #5] | Email digest delivery (daily 8AM) | Ideation Section 7: "Resend / SendGrid — Email digest delivery, External service, $0-10/tháng" [provider: Resend per 2.2b assumption #5] | Outbound + Inbound (webhooks) | API key (Bearer token) [from public knowledge — verify] | `RESEND_API_KEY` [from public knowledge — verify] |
| 5 | Telegram Bot API | Real-time signal alerts (Power plan), admin alerts (pipeline failures) | Ideation Section 7: "Telegram Bot API — Real-time signal alerts, Free" | Bidirectional | Bot token + chat_id [from public knowledge — verify] | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` [from public knowledge — verify] |
| 6 | Twitter Web Intent | Pre-fill tweet composer with draft text (no API, URL scheme) | Ideation Section 7: "Twitter Web Intent — Pre-fill tweet composer, URL scheme, không cần API" | Outbound (browser redirect) | N/A — public URL scheme | N/A — no server-side config |

**Notes:**
- Service #3: Added `STRIPE_PRO_PRICE_ID`, `STRIPE_POWER_PRICE_ID` to env config (needed for plan mapping per gap analysis)
- Service #4: Marked "[provider pending]" per 2.2b assumption #5. Endpoints mapped generically where possible.
- Service #5: Added `TELEGRAM_WEBHOOK_SECRET` for webhook signature verification
- Service #6: Client-side only, included for completeness per Ideation Section 7
- **LOCK — Tweet crawl vendor selection:** `TWEET_FETCH_PROVIDER` (hoặc tương đương) chọn implementation của **`TweetFetchProvider` interface** — xem mục **0** dưới đây. Business logic **không** reference trực tiếp Service #1 HTTP paths.

---

## Phần 2 — Endpoint Mapping

### 0. Tweet fetch provider abstraction (LOCK — application contract)

**Mục đích:** Cho phép thay vendor crawl (twitterapi.io, Netrows, SociaVault, …) **không** sửa `PipelineService` / job / classify → cluster; chỉ thêm hoặc đổi **implementation** + config.

| Thành phần | Quy ước |
|-------------|---------|
| **Interface** | `TweetFetchProviderInterface` (hoặc tên tương đương trong `app/Contracts/`) — phương thức tối thiểu: fetch tweets theo **source handle** (và/hoặc `source_id`), **cursor** / `since`, **time window**; trả về **DTO chuẩn** `{ tweets: NormalizedTweet[], next_cursor?: string, rate_limited?: bool }` với `NormalizedTweet` chứa tối thiểu: `external_tweet_id`, `text`, `posted_at` (UTC), `author_handle`, `permalink_url` (nếu có). |
| **Implementation** | Một class per vendor, vd. `TwitterApiIoTweetProvider`, sau này `NetrowsTweetProvider` — **chỉ** lớp này gọi HTTP tới bảng endpoint ở **§1 twitterapi.io** (hoặc vendor khác). |
| **DI binding** | `AppServiceProvider` (hoặc dedicated ServiceProvider): bind interface → implementation theo `config('services.tweet_fetch.provider')` / env `TWEET_FETCH_PROVIDER`. |
| **Tests** | Mock interface trong unit test `PipelineService`; contract test integration với provider thật ở môi trường dev/staging. |

**Cấm:** `PipelineService` / `PipelineCrawlJob` import trực tiếp client HTTP hoặc string URL twitterapi — phải qua interface.

---

### 1. twitterapi.io

**Service Source:** Ideation Section 7: "twitterapi.io — Crawl tweets"  
**Base URL pattern:** Per **Báo Cáo POC** (verify — may differ from older public snippets). Example historical pattern: `https://api.twitterapi.io/...` — **do not hardcode** until POC env matches.  
**API version:** Per provider docs tied to POC  
**Docs verified:** Via POC + trial key — **2026-04-06:** primary crawl path = **`advanced_search`** (not the illustrative `/tweets/user/{username}` row used in early drafts).

#### Outbound Calls (project → service)

| # | Endpoint | Method | Used By (flow/feature) | Request Schema | Response Schema | Key Error Codes | Rate Limit |
|---|----------|--------|------------------------|----------------|-----------------|-----------------|------------|
| 1 | **`/twitter/tweet/advanced_search`** (or path per **POC**) [PRIMARY] | GET | **Flow 3 Crawl** — query by `from:user` / time window; **4× daily** schedule; update `sources.last_crawled_at` after batch | Query: `query`, `queryType`, pagination cursor [per POC] | Map to normalized `{ id, text, created_at, author }[]` [per POC] | `401`, `429`, `404` | Stagger + queue per 2.2b |
| 1b | `/tweets/user/{username}` | GET | **Legacy reference only** — use if POC proves equivalent; otherwise prefer row #1 | Query: `count`, `since_id` [verify] | As provider returns | Same | Verify |
| 2 | `/users/{username}` [verify] | GET | 2.2a Flow 1 Add Source Step 2 — validate account exists, is public, has recent activity | Query: none | `{ data: { username: string, display_name: string, is_public: boolean, last_tweet_date: datetime, tweet_count_30d: integer } }` [verify — CRITICAL: verify last_tweet_date OR tweet_count_30d availability] | `401`, `404`, `403` | Verify |
| 3 | `/users/{username}/profile` [verify] | GET | 2.2a Flow 6 Admin Reviews Source — admin views source profile when reviewing user-added sources [GAP FILLED] | Query: `include_recent_tweets` (bool) | `{ data: { username: string, bio: string, followers_count: int, recent_tweets: [{ id: string, text: string, created_at: datetime }] } }` [verify] | `401`, `404` | Verify |

**Crawl loop (2026-04-06):** For each **active** `sources` row: call outbound #1 (or #1b) with cursor/since derived from **`last_crawled_at`** + provider limits; on success set `last_crawled_at = NOW()`; on 429 apply backoff; never fire 96 sequential crawls for one digest day.

**Notes:**
- Endpoint #2 CRITICAL: Verify if `last_tweet_date` or `tweet_count_30d` available for 2.2a Flow 1 activity validation ("≥1 tweet in last 30 days")
- Endpoint #3: Added for admin review workflow (gap fill)
- **Implementation MUST match POC** — illustrative paths in older spec text are non-binding.

---

### 2. Anthropic API

**Service Source:** Ideation Section 7: "LLM API (Haiku / GPT-4o-mini)"  
**Base URL:** `https://api.anthropic.com/v1` [verify]  
**API version:** 2023-06-01 (header) [verify]

#### Outbound Calls (project → service)

| # | Endpoint | Method | Used By (flow/feature) | Request Schema | Response Schema | Key Error Codes | Rate Limit |
|---|----------|--------|------------------------|----------------|-----------------|-----------------|------------|
| 1 | `/messages` | POST | 2.2a Flow 3 Classify — classify tweet signal/noise | `{ model: string, max_tokens: int, messages: [{ role: "user", content: string }] }` [verify] | `{ content: [{ type: "text", text: string }], usage: { input_tokens: int, output_tokens: int } }` [verify] | `401`, `429`, `400`, `529` | Verify RPM/TPM |
| 2 | `/messages` | POST | 2.2a Flow 3 Cluster — **CHỐT 2026-04-06: prompt-based** via LLM (same `/messages` contract as classify). Embeddings-based clustering = **Phase 2** optional optimization. | Same as #1 — prompt asks model to group tweet IDs / themes | Same as #1 | Same as #1 | Verify RPM/TPM |
| 3 | `/messages` | POST | 2.2a Flow 3 Summarize — generate title/summary/tags | Same as #1 | `{ content: [{ type: "text", text: string }], usage: {...} }` | Same as #1 | Same as #1 |
| 4 | `/messages` | POST | 2.2a Flow 3 Draft — generate tweet draft | Same as #1 | Same as #3 | Same as #1 | Same as #1 |

**Notes:**
- Endpoint #2: **Blocker cleared 2026-04-06** — use prompt-based clustering Phase 1; revisit embeddings if quality/cost requires.
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

#### Inbound Calls (webhooks) [GAP FILLED]

| # | Event | Trigger | Payload Schema | Handler Action | Verification | Source |
|---|-------|---------|----------------|----------------|--------------|--------|
| 1 | `email.bounced` OR `bounce` | Email bounces | Generic: `{ email: string, bounce_type: string }` [verify] | Accept → if hard bounce: disable delivery + flag email_invalid | Provider signature [verify] | Deliverability monitoring |
| 2 | `email.complained` OR `spam_report` | Marked as spam | Generic: `{ email: string }` [verify] | Accept → disable delivery + notify user | Same as #1 | Same |

**Notes:**
- Provider pending per 2.2b assumption #5
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
| **twitterapi.io** | 429 Rate limit | Digest incomplete | Retry with backoff (exponential pattern, max 3 retries). Circuit breaker if error >20%. Alert admin >3 consecutive failures. | Fallback provider (Netrows, SociaVault) defer Phase 2. Accept incomplete digest. | 2.2b Error Handling, Ideation risk |
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
| **twitterapi.io** | KOL usernames, cursor | Tweet text, author metadata | No (public data) | HTTPS [verify] | No GDPR concerns — public data per GDPR Article 4(1). Audit: `audit_logs` với `event_type='api_call_outbound'` (sample hoặc on-error — Section 9 §1.3.1). Retention per NFR #10. | Ideation §7, GDPR Art 4(1) |
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
- **Bảng:** `audit_logs` — chi tiết cột tại Section 9; **danh mục + write path:** **§1.3.1**.
- **Outbound API:** `event_type='api_call_outbound'` (không dùng `api_call`). `metadata`: `{service, endpoint, http_status, duration_ms, request_summary}`.
- **Retention:** Immutable; archive/partition khi volume lớn — chính sách cụ thể theo NFR / vận hành.

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
| 1 | twitterapi.io API docs unknown | Endpoint mapping (all Phần 2 rows), Pipeline crawl, Source validation | Verify: endpoint paths, schemas (especially: last_tweet_date OR tweet_count_30d?), rate limits (req/min, req/day), auth header name. Test with trial account. | Verification Tasks #1, Phần 2 endpoint #2 CRITICAL |
| 2 | Anthropic clustering method unclear | Endpoint #2, clustering step, cost estimate | Clarify: (a) Embeddings API exists? (b) Pricing separate? (c) Prompt-based viable? Test both if possible, compare accuracy+cost. | Verification Tasks #2, Phần 2 endpoint #2 PLACEHOLDER, Active Assumption #1 |
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
| 1 | Anthropic clustering = prompt-based (not embeddings API) | Endpoint #2, cost, accuracy | If embeddings required → different endpoint, pricing (may exceed $15-30/mo), different schema. Accuracy may improve but cost increases. | Open Questions #1, Blocker #2 |
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
| 1 | Anthropic clustering: prompt-based OR embeddings API? | Cost ($15-30/mo may change), accuracy, endpoint mapping | Test both approaches if possible. If embeddings not available OR too expensive → confirm prompt-based viable. | Blocker #2, Assumption #1 |
| 2 | Stripe price IDs: values unknown | Cannot implement checkout, webhook sync | Create in dashboard, document in env vars. BLOCKER. | Blocker #3, Assumption #2 |
| 3 | Stripe webhook reconciliation frequency: daily sufficient? | User experience (plan sync delay acceptable?) | Start daily, monitor webhook delivery rate Sprint 1, increase frequency if >10% miss rate. | Assumption #3 |
| 4 | Email provider: Resend OR SendGrid? | API contract shape, migration risk if switch mid-dev | Finalize before 2.2e. Test deliverability + free tier. Resend recommended but not confirmed. | Blocker #4, Assumption #4 |
| 5 | Telegram token expiry: 10min appropriate? | UX (too short=friction) vs security (too long=risk) | 10min = assumed balance. Can adjust post-launch if user feedback indicates issue. | Blocker #5, Assumption #5 |
| 6 | NFR audit logging scope: all services OR selective? | Dev effort (1-2 days if all), storage cost | NFR not provided. Assumed required for all. If NFR confirms NO → remove to save time. | Assumption #6 |
| 7 | Free tier schedule: Mon/Wed/Fri locked OR configurable? | User expectation management, churn risk | Display clearly in signup. If high churn → consider configurable days Phase 2. | Assumption #7 |
| 8 | My KOLs stats: cache strategy needed Phase 1? | Performance (if >2s load = UX hit) | Start on-demand, monitor Sprint 1. Add cache (Redis 1h TTL) if slow. | Assumption #8 |
| 9 | Source review workflow | Spam control vs user friction | **Đã chốt Option B (CR 2026-04-13):** review queue `pending_review` + admin `approve` trước crawl. | 2.2a conflict #13, 2.2b conflict #13 |
| 10 | Category filter: OR confirmed OR needs founder decision? | Digest relevance, user satisfaction | 2.2a/2.2b conflict #24. Recommend OR logic (show if ANY match). Document as Hard Constraint #8. | 2.2a conflict #24, 2.2b conflict #16, Constraint #8 |

---

**End of API-CONTRACTS.md (COMPLETE with all 30 gaps filled)**

**Summary:**
- 6 services mapped (all from Ideation §7)
- 23 endpoints (3 outbound twitterapi.io, 4 Anthropic, 3 Stripe outbound + 4 webhooks, 1 Resend outbound + 2 webhooks, 2 Telegram outbound + 1 webhook, 1 Twitter Web Intent)
- 23 data mappings (all critical fields covered)
- 18 failure modes (all services × applicable modes)
- 6 security/compliance rows (GDPR workflows specified)
- 13 hard constraints (all from gaps + 2.2a/2.2b conflicts resolved)
- 8 blockers (all critical, must resolve before 2.2e)
- 8 active assumptions (validate during Sprint 1)
- 10 verification tasks (prioritized)
- 10 open questions (decision tree for founder)

**Ready for 2.2e (Internal API Design) after blockers #1-6 resolved.**

---

## Section 11 — API Specs (Internal REST)
**Source:** 2.2e Phần 2
**Last confirmed:** 2026-04-06 (amendment: crawl schedule, twitterapi POC, schema extensions — see changelog in Section 9 header notes)

### 2.1 — Conventions

| Convention | Rule | Source |
|-----------|------|--------|
| API style | HTTP REST | 2.2b Architecture Pattern (Laravel API Resources, React SPA consume) |
| URL paths | `/api/{resource}` or `/api/{resource}/{id}` — plural resource names, kebab-case | Laravel REST convention |
| Request/Response fields | snake_case (match DB columns) | 2.2b convention (Laravel default), no transform needed |
| DB↔API naming | Same — snake_case throughout | 2.2b (no camelCase transform layer Phase 1) |
| Error codes | UPPER_SNAKE_CASE machine-readable codes | 2.2b Error Handling Strategy |
| Error response format | `{"error": {"code": "ERROR_CODE", "message": "Human message", "details": {...}}}` | 2.2b Error Handling Strategy |
| Versioning | No versioning prefix Phase 1 (no /v1/) [based on assumption #6] | 2.2b (versioning not explicit — flag if needed Phase 2) |
| Auth | Laravel Sanctum token-based (Bearer token in header) | 2.2b Tech Stack Decision |

**Pagination (for list endpoints):**

| Convention | Rule | Source |
|-----------|------|--------|
| Pagination style | Offset-based (`?page=N&per_page=M`) | Laravel default pagination |
| Default page size | 20 items | Standard REST convention [based on assumption #7] |
| Response envelope | `{"data": [...], "meta": {"current_page": N, "total": X, "per_page": M}}` | Laravel API Resource pagination format |

**Filter/Sort (only keys with explicit source):**

| Key | Applies To | Rule | Source |
|-----|-----------|------|--------|
| `?status=X` | Sources list | Filter by source status (admin only) | 2.2a Flow 6 Admin Reviews Source |
| `?type=X` | Sources list | Filter by type (default/user) | 2.2a Permission Matrix (admin views user-added sources) |
| `?category_id=X` | Signals list (Digest view) | Filter by category (OR logic if multiple via `category_id[]=X&category_id[]=Y`) | 2.2a F13 category filter + 2.2d Constraint #8 |
| `?my_sources_only=true` | Signals list | Toggle My KOLs filter | 2.2a Flow 4 My KOLs Digest View |
| `?date=YYYY-MM-DD` | Signals list | Filter by digest date | 2.2a F13 Digest view by date |
| `?sort=rank_score` | Signals list | Sort by rank (desc default) | 2.2a F10 Signal ranking |

---

### 2.2 — Endpoint Specs

**External constraints:** From 2.2d absorbed into endpoint specs below (noted per endpoint).

---

#### Authentication & User Management

**Phase 1 Auth Method:** OAuth X.com only per NFR. Email/password routes below are placeholders for Phase 2 compatibility - NOT implemented Sprint 1.

##### OAuth X.com Redirect (Phase 1 PRIMARY)
**Source:** NFR OAuth X.com flow diagram, Sprint task 1.3.1  
**Accommodates:** 2.2d Constraint #11 (UTC timezone)

| Field | Detail |
|-------|--------|
| Route | `GET /auth/twitter` |
| Actor | Unauthenticated |
| Auth | None |
| Permission Guard | None |
| Request | None (initiates OAuth flow) |
| Success Response | `302 Redirect` to X.com OAuth authorize URL with client_id, redirect_uri, scope, state |
| Error Responses | N/A (redirect errors handled by X.com) |

**Notes:**
- Redirects to `https://twitter.com/oauth2/authorize?client_id=...&redirect_uri=...&scope=tweet.read%20users.read&state={CSRF_token}`
- State param = CSRF protection token stored in session
- Sprint task 1.3.1: Implement redirect logic with correct OAuth params

---

##### OAuth X.com Callback (Phase 1 PRIMARY)
**Source:** NFR OAuth X.com flow diagram, Sprint task 1.3.2  
**Accommodates:** 2.2d Constraint #3 (External IDs must persist - x_user_id)

| Field | Detail |
|-------|--------|
| Route | `GET /auth/twitter/callback` |
| Actor | Unauthenticated (OAuth flow in progress) |
| Auth | None (validates state param for CSRF) |
| Permission Guard | None |
| Request | Query params: `{ code: string, state: string }` from X.com OAuth redirect |
| Success Response | `302 Redirect` to `/onboarding/categories` (new user) OR `/digest` (returning user). Sets auth session/token. |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 400 | OAUTH_ERROR | Invalid code, state mismatch (CSRF), X.com API error | NFR OAuth flow error handling |
| 500 | TOKEN_EXCHANGE_FAILED | X.com token exchange API failure | NFR OAuth flow step 6 |

**Notes:**
- Exchanges `code` for access_token + refresh_token via X.com API
- Fetches user profile from X.com (id, username, name, email if available)
- Upserts User record: x_user_id (unique), x_username, x_access_token, x_refresh_token, x_token_expires_at, email (nullable), name
- Creates Sanctum session token for SPA auth
- Sprint task 1.3.2: Implement token exchange + user upsert logic
- Audit log: `event_type='oauth_login'`, entity_type='User', entity_id=user.id (Section 9 §1.3.1)

---

##### User Registration (PLACEHOLDER - Phase 2)
**Source:** 2.2a CRUD summary F01 (deprecated by OAuth Phase 1)  
**Status:** NOT IMPLEMENTED Sprint 1. Keep spec for Phase 2 compatibility.

| Field | Detail |
|-------|--------|
| Route | `POST /api/auth/register` |
| Actor | Unauthenticated |
| Auth | None |
| Permission Guard | None |
| Request | `{ email: string, password: string, name?: string }` — email format + unique validated |
| Success Response | `201 Created` — `{ data: { id, email, name, plan: 'free', token } }` — Sanctum token for immediate login |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 422 | VALIDATION_ERROR | Email format invalid, password <8 chars, email already exists | 2.2b Error Handling (validation errors), 2.2c User.email unique constraint |

**Notes:**
- Phase 2 only if email/password auth added alongside OAuth
- User.plan defaults to 'free', User.my_categories defaults to empty (selected in next onboarding step)

---

##### User Login (PLACEHOLDER - Phase 2)
**Source:** 2.2a CRUD summary F01 (deprecated by OAuth Phase 1)  
**Status:** NOT IMPLEMENTED Sprint 1. Keep spec for Phase 2 compatibility.

| Field | Detail |
|-------|--------|
| Route | `POST /api/auth/login` |
| Actor | Unauthenticated |
| Auth | None |
| Permission Guard | None |
| Request | `{ email: string, password: string }` |
| Success Response | `200 OK` — `{ data: { id, email, name, plan, token } }` |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 401 | UNAUTHENTICATED | Email/password mismatch | 2.2b Error Handling (auth errors) |

---

##### Update User Preferences
**Source:** 2.2a CRUD summary (User updates delivery preferences), F02  
**Accommodates:** 2.2d Constraint #7 (plan field read-only)

| Field | Detail |
|-------|--------|
| Route | `PATCH /api/users/me` |
| Actor | Authenticated user (self only) |
| Auth | Sanctum token |
| Permission Guard | Self-owned resource (user can only update own profile) |
| Request | `{ name?: string, my_categories?: array<int>, delivery_preferences?: {email: bool, telegram: bool, web: bool} }` — plan field EXCLUDED (read-only per 2.2d Constraint #7) |
| Success Response | `200 OK` — `{ data: { id, email, name, plan, my_categories, delivery_preferences, telegram_chat_id?, stripe_customer_id? } }` — full user object |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 422 | VALIDATION_ERROR | my_categories not 1-3 items, category IDs invalid, delivery_preferences wrong structure | 2.2a Onboarding flow (1-3 categories), 2.2c User.delivery_preferences structure |

**Notes:**
- Plan changes ONLY via Stripe webhook (2.2d Constraint #7) — attempting to update plan field returns validation error
- Accommodates 2.2d Constraint #7 explicitly

---

#### Categories

##### List Categories
**Source:** 2.2a CRUD summary (Category), F03  
**Accommodates:** N/A

| Field | Detail |
|-------|--------|
| Route | `GET /api/categories` |
| Actor | All (public) |
| Auth | None (public endpoint for onboarding) |
| Permission Guard | None |
| Request | None |
| Success Response | `200 OK` — `{ data: [{ id, name, slug }] }` — all 10 categories |
| Error Responses | None (static data) |

**Notes:**
- No pagination (10 items hardcoded)
- Used in onboarding flow (select 1-3 categories) and digest filtering

---

#### Sources & My KOLs Management

##### List Sources (Browse Pool)
**Source:** 2.2a F06 My KOLs management, Permission Matrix (browse pool)  
**Accommodates:** N/A

| Field | Detail |
|-------|--------|
| Route | `GET /api/sources` |
| Actor | All authenticated users (Free: read-only, Pro/Power: can add/subscribe) |
| Auth | Sanctum token |
| Permission Guard | Free users: read-only access. Admin: can filter by status/type. |
| Request | Query params: `?category_id=X` (filter by category), `?search=handle` (search by handle/display_name), `?status=X` (admin only), `?type=X` (admin only) |
| Success Response | `200 OK` — `{ data: [{ id, handle, display_name, account_url, categories: [{id, name}], type, status }], meta: {...} }` — paginated |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 403 | FORBIDDEN | Free user attempts status/type filter (admin-only params) | 2.2a Permission Matrix (admin-only filters) |

**Notes:**
- Default filter: `status='active'` (hide spam/deleted/pending_review from non-admin browse)
- Admin-only: `?type=user` (+ optional `?status=`) để duyệt queue; mặc định ưu tiên `pending_review` (Flow 6 Option B)

---

##### Add Source to Pool
**Source:** 2.2a Flow 1 (User Adds New Source to Pool)  
**Accommodates:** N/A

| Field | Detail |
|-------|--------|
| Route | `POST /api/sources` |
| Actor | Pro, Power (not Free) |
| Auth | Sanctum token |
| Permission Guard | User.plan IN ('pro', 'power') — 2.2a Flow 1 Guard |
| Request | `{ handle: string, category_ids: array<int> }` — handle format: alphanumeric + underscore, 1-15 chars (without @ prefix). category_ids: 1+ items. |
| Success Response | `201 Created` — `{ data: { id, handle, display_name, account_url, categories, type: 'user', status, is_subscribed: boolean } }` — `is_subscribed` = true iff `MySourceSubscription` created (user under My KOLs cap); false if at cap — source still in pool (H1 / 2.2a Flow 1 Step 6) |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 403 | FORBIDDEN | Free user attempts to add source | 2.2a Flow 1 Guard (Pro/Power only) |
| 400 | ACCOUNT_NOT_FOUND | Account doesn't exist on X (twitterapi.io 404) | 2.2a Flow 1 Error Case, 2.2d twitterapi.io endpoint #2 |
| 400 | ACCOUNT_PRIVATE | Account is private (twitterapi.io is_public=false) | 2.2a Flow 1 Guard + Error Case |
| 400 | ACCOUNT_INACTIVE | No tweets in last 30 days (twitterapi.io check) [based on 2.2a assumption #5] | 2.2a Flow 1 Error Case |
| 409 | CONFLICT | Account already in pool (handle unique constraint) | 2.2a Flow 1 Error Case (redirect to subscribe flow) |
| 422 | VALIDATION_ERROR | Handle format invalid, category_ids empty or invalid IDs | 2.2a Flow 1 Guard (handle format, ≥1 category) |

**Notes:**
- Calls twitterapi.io `/users/{username}` to validate account (2.2d endpoint #2)
- Creates Source + SourceCategory in one transaction; creates `MySourceSubscription` only when user's subscription count < plan cap (H1). If at cap, response `is_subscribed: false` — user may `POST /api/sources/{id}/subscribe` after freeing a slot (Flow 2)
- **Phase 1 Option B:** `Source.status` mặc định **`'pending_review'`** khi tạo (`type='user'`); chỉ vào crawl pool sau admin `approve` → `active`
- No cap on adding new Sources to pool per 2.2a assumption #2 + H1 (cap applies to My KOLs subscriptions, not pool size)

---

##### Subscribe to Source (Follow to My KOLs)
**Source:** 2.2a Flow 2 (User Subscribes to Source)  
**Accommodates:** 2.2d Constraint #10 (My KOLs cap enforcement)

| Field | Detail |
|-------|--------|
| Route | `POST /api/sources/{id}/subscribe` |
| Actor | Pro (cap 10), Power (cap 50) |
| Auth | Sanctum token |
| Permission Guard | User.plan IN ('pro', 'power'). Cap check: Pro <10, Power <50 current subscriptions. |
| Request | None (source ID in URL) |
| Success Response | `201 Created` — `{ data: { subscription_id, source: {id, handle, display_name}, subscribed_at } }` |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 403 | FORBIDDEN | Free user attempts subscribe | 2.2a Permission Matrix (Free users: no My KOLs) |
| 400 | SUBSCRIPTION_CAP_EXCEEDED | Pro user has 10 subscriptions, Power has 50 | 2.2a Flow 2 Guard (Pro ≤10, Power ≤50), 2.2d Constraint #10 |
| 409 | CONFLICT | Already subscribed (unique constraint user_id, source_id) | 2.2a Flow 2 Error Case |
| 404 | NOT_FOUND | Source doesn't exist or status='deleted' | reference integrity |

**Notes:**
- Accommodates 2.2d Constraint #10 (atomic cap check via SELECT FOR UPDATE to prevent race condition)
- Error response for cap exceeded includes upgrade prompt: `"message": "You've reached your limit (10). Upgrade to Power (50) or unfollow others"`

---

##### Unsubscribe from Source
**Source:** 2.2a CRUD summary (User unfollows source), F06  
**Accommodates:** N/A

| Field | Detail |
|-------|--------|
| Route | `DELETE /api/sources/{id}/subscribe` |
| Actor | Pro, Power (user who subscribed) |
| Auth | Sanctum token |
| Permission Guard | MySourceSubscription.user_id = authenticated user (self-owned) |
| Request | None |
| Success Response | `204 No Content` |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 404 | NOT_FOUND | Subscription doesn't exist (not subscribed or already deleted) | reference integrity |

**Notes:**
- Side effect: My KOLs stats recalculated (on-demand, no immediate trigger) per 2.2b assumption #11

---

##### List My KOLs (User's Subscriptions)
**Source:** 2.2a F06 My KOLs management (personal list view)  
**Accommodates:** N/A

| Field | Detail |
|-------|--------|
| Route | `GET /api/my-sources` |
| Actor | Pro, Power |
| Auth | Sanctum token |
| Permission Guard | User.plan IN ('pro', 'power') |
| Request | None |
| Success Response | `200 OK` — `{ data: [{ id, handle, display_name, account_url, categories, subscribed_at, stats: { signal_count, last_active_date } }] }` — no pagination (cap 10/50) |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 403 | FORBIDDEN | Free user attempts access | 2.2a Permission Matrix (Free: no My KOLs) |

**Notes:**
- Stats (signal_count, last_active_date) computed on-demand per 2.2c Phần 2
- Empty state if zero subscriptions: `{ data: [] }`

---

#### Signals & Digest

##### List Signals (Digest View)
**Source:** 2.2a F13 Signal Digest (Web) — All, F14 Signal Digest — My KOLs, Flow 4  
**Accommodates:** 2.2d Constraint #8 (category filter OR logic), **Decision 1** (API Guard enforcement for Free tier)  
**Amendment 2026-04-06:** Support personal signals (type=1) for Pro/Power users

| Field | Detail |
|-------|--------|
| Route | `GET /api/signals` |
| Actor | All authenticated users |
| Auth | Sanctum token |
| Permission Guard | **Decision 1 - API Guard:** Free users → check `user.plan === 'free' AND day_of_week NOT IN ['Mon', 'Wed', 'Fri']` → return `403 FORBIDDEN`. Pro/Power: full filters enabled. |
| Request | Query params: `?date=YYYY-MM-DD` (default: today), `?category_id[]=X&category_id[]=Y` (OR logic filter), `?my_sources_only=true` (Pro/Power only), `?topic_tag=X` (Pro/Power only) |
| Success Response | `200 OK` — `{ data: [{ id, title, summary, source_count, rank_score, categories: [{id, name}], topic_tags: [string], sources: [{handle, display_name, tweet_url, is_my_source?: bool}], draft_tweets: [{ id, text }], date, type, is_personal }], meta: {...} }` — sorted by rank_score DESC. **Decision 3:** `draft_tweets` EMPTY for Free users. |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 403 | FORBIDDEN | **Decision 1:** Free user attempts access on Tue/Thu/Sat/Sun. Message: "Free tier: digest available Mon/Wed/Fri only. Upgrade to Pro for daily access." | Decision 1 |
| 403 | FORBIDDEN | Free user attempts my_sources_only filter | 2.2a Permission Matrix (Free: All Sources view only, no My KOLs) |
| 422 | VALIDATION_ERROR | Date format invalid | platform invariant |

**Notes:**
- **Decision 1 (API Guard):** Free tier enforcement at API layer. Check plan + day_of_week → 403 if not Mon/Wed/Fri. Clear error message.
- **Decision 2 (Dedicated Page):** This endpoint returns list view only. For signal detail, client calls `GET /api/signals/{id}`.
- **Decision 3 (API Strip):** Backend strips `draft_tweets` for Free users before serialization (array empty in response).
- **Personal Signals (2026-04-06):**
  - Free users: ONLY see `type=0` (shared signals from 500 KOL pool)
  - Pro/Power users:
    - **`my_sources_only=false` (default):** See shared signals (`type=0`)
    - **`my_sources_only=true`:** See personal signals (`type=1` WHERE `user_id=auth_user`)
  - Query: `WHERE (type = 0) OR (type = 1 AND user_id = ?)` depending on `my_sources_only` param
- Category filter: OR logic via Postgres array overlap (`WHERE signals.categories && ARRAY[selected_ids]`) — accommodates 2.2d Constraint #8
- sources array: `is_my_source` flag added for Pro/Power users (TRUE if source in user's My KOLs, NULL for Free users)

---

##### Get Signal Detail
**Source:** 2.2a CRUD summary (User views Signal detail), F18 Source Attribution  
**Accommodates:** **Decision 2** (Dedicated Page approach), **Decision 3** (API Strip for Free users)

| Field | Detail |
|-------|--------|
| Route | `GET /api/signals/{id}` |
| Actor | All authenticated users |
| Auth | Sanctum token |
| Permission Guard | None (signals are shared, no user ownership) |
| Request | None |
| Success Response | `200 OK` — `{ data: { id, title, summary, source_count, rank_score, categories, topic_tags, sources: [{ handle, display_name, tweet_url, tweet_text, posted_at }], draft_tweets: [{ id, text }], date, published_at } }` — full signal object with all source attribution |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 404 | NOT_FOUND | Signal ID doesn't exist | reference integrity |

**Notes:**
- **Decision 2 (Dedicated Page):** This endpoint returns full signal detail for dedicated page view (not modal). Client calls this when user clicks signal row.
- **Decision 3 (API Strip):** `draft_tweets` array is **EMPTY** for Free users (backend strips before serialization). Pro/Power users see full draft_tweets array.
- Source attribution: all tweets + sources linked via signal_sources table (2.2a F18)
- No permission check beyond auth — signals are public to all authenticated users

---

##### Personal digest (Pro / Power) — `user_personal_feed_entries`
**Source:** 2026-04-06 review — shared `signals` may omit My KOLs-only tweets; this feed fills gap per user/day.  
**Sprint:** Implementation **Sprint 2+** (after shared wedge stable).

| Field | Detail |
|-------|--------|
| Route | `GET /api/me/personal-digest` |
| Actor | Pro, Power |
| Auth | Sanctum token |
| Permission Guard | `User.plan IN ('pro','power')` **AND** row exists or job created `user_personal_feed_entries` for `digest_date` |
| Request | Query: `?date=YYYY-MM-DD` (default: today) |
| Success Response | `200 OK` — `{ data: { date, items: [...], referenced_signal_ids: [] } }` — shape aligns with `user_personal_feed_entries.items` JSONB |
| Error Responses | `403` FORBIDDEN (Free); `404` if not yet generated (optional empty state `{ data: { items: [] } }`) |

**Notes:**
- Builder job: after shared Pipeline + My KOLs membership, optionally run LLM to merge/rank items for **this user only**.
- Not a replacement for shared digest — **additive** for paid retention.

---

##### My KOLs Stats
**Source:** 2.2a F15 My KOLs Stats, Flow 4  
**Accommodates:** N/A

| Field | Detail |
|-------|--------|
| Route | `GET /api/my-sources/stats` |
| Actor | Pro, Power |
| Auth | Sanctum token |
| Permission Guard | User.plan IN ('pro', 'power') |
| Request | Query params: `?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` (default: last 7 days) |
| Success Response | `200 OK` — `{ data: { total_signals_today: int, top_active_sources: [{ source_id, handle, signal_count }], trend_7day: [{ date, signal_count }], per_category_breakdown: [{ category_id, category_name, signal_count }] } }` |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 403 | FORBIDDEN | Free user attempts access | 2.2a Permission Matrix |

**Notes:**
- Stats computed on-demand per 2.2c Phần 2 (no pre-aggregation Phase 1)
- Empty state if zero My KOLs subscriptions: all counts = 0

---

#### Draft Tweets

##### Open Twitter Composer (Copy Draft)
**Source:** 2.2a Flow 5 (User Opens Twitter Composer with Draft), F19  
**Accommodates:** 2.2d Twitter Web Intent (client-side redirect, no server action beyond logging)

| Field | Detail |
|-------|--------|
| Route | `POST /api/signals/{signal_id}/draft/copy` |
| Actor | Pro, Power |
| Auth | Sanctum token |
| Permission Guard | User.plan IN ('pro', 'power') — 2.2a Permission Matrix (Free: no drafts) |
| Request | None |
| Success Response | `200 OK` — `{ data: { twitter_intent_url: "https://twitter.com/intent/tweet?text={url_encoded_draft}" } }` — client opens URL in new tab |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 403 | FORBIDDEN | Free user attempts draft access | 2.2a Permission Matrix (Free: no drafts) |
| 404 | NOT_FOUND | Signal or draft doesn't exist | reference integrity |

**Notes:**
- Side effect: log UserInteraction (action='copy_draft') via event (2.2a Flow 5 Step 2)
- URL encoding: RFC 3986 percent-encoding per 2.2d Twitter Web Intent notes
- Hard dependency: if Twitter.com down, client shows fallback UI with draft text for manual copy (2.2d Phần 4)

---

#### Admin Endpoints

##### List Sources (Admin — moderation queue)
**Source:** 2.2a Flow 6 (Admin Reviews User-Added Source — Option B), F21  
**Accommodates:** N/A

| Field | Detail |
|-------|--------|
| Route | `GET /api/admin/sources` |
| Actor | Admin only |
| Auth | Sanctum token + **`users.is_admin = true`** (2026-04-06) |
| Permission Guard | Admin middleware checks `is_admin` (2.2a Permission Matrix) |
| Request | Query params: `?type=user` (khuyến nghị Flow 6), optional `?status=active|spam|deleted|pending_review` (lọc theo trạng thái; queue chính = `pending_review`) |
| Success Response | `200 OK` — `{ data: [{ id, handle, display_name, account_url, type, status, added_by_user: {id, email}, categories, created_at, signal_count, noise_ratio? }], meta: {...} }` — paginated |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 403 | FORBIDDEN | Non-admin attempts access | 2.2a Permission Matrix (admin-only) |

**Notes:**
- noise_ratio computed if source >7 days old per 2.2a Flow 6 Step 3 (% of tweets classified as noise)
- Option B: danh sách mặc định thường là `type=user&status=pending_review` + sort `created_at` desc (sources mới cần duyệt)

---

##### Moderate Source (Admin Action)
**Source:** 2.2a Flow 6 (Admin Reviews Source — Option B), F21  
**Accommodates:** N/A

| Field | Detail |
|-------|--------|
| Route | `PATCH /api/admin/sources/{id}` |
| Actor | Admin only |
| Auth | Sanctum token + **`users.is_admin = true`** |
| Permission Guard | Admin middleware checks `is_admin` |
| Request | `{ action: 'approve' | 'flag_spam' | 'adjust_categories' | 'soft_delete' | 'restore', category_ids?: array<int> }` — `category_ids` bắt buộc khi `action='adjust_categories'` (≥1) |
| Success Response | `200 OK` — `{ data: { id, status, categories, updated_at } }` |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 403 | FORBIDDEN | Non-admin attempts access | 2.2a Permission Matrix |
| 400 | INVALID_ACTION | `action` không hợp lệ Phase 1; hoặc `restore` từ trạng thái không cho phép | 2.2a Flow 6, Section 4 Source |
| 422 | VALIDATION_ERROR | `adjust_categories` mà `category_ids` thiếu/rỗng/invalid | 2.2a Flow 6 Guard |

**Notes:**
- **Phase 1 Option B:** có bước approve trước crawl; `approve`: `pending_review` → `active` (vào crawl pool)
- `adjust_categories`: giữ `status`, thay SourceCategory (Flow 6 Step 4)
- `soft_delete`: `active` → `deleted` (theo policy Section 4)
- `restore`: `spam` hoặc `deleted` → `active` (assumption #9)
- `flag_spam`: `active|pending_review` → `spam` (ẩn browse)
- Side effect: log admin action in audit trail per 2.2a assumption #14 [not in current spec — flag for infrastructure table if needed]

---

##### Pipeline Monitor Dashboard
**Source:** 2.2a Flow 7 (Admin Monitors Pipeline Health), F22  
**Accommodates:** N/A

| Field | Detail |
|-------|--------|
| Route | `GET /api/admin/pipeline/status` |
| Actor | Admin only |
| Auth | Sanctum token + **`users.is_admin = true`** |
| Permission Guard | Admin middleware checks `is_admin` |
| Request | None |
| Success Response | `200 OK` — `{ data: { last_run_timestamp: datetime, tweets_fetched_count: int, signals_created_count: int, error_rate: float, per_category_signal_volume: [{ category_id, category_name, signal_count }] } }` |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 403 | FORBIDDEN | Non-admin attempts access | 2.2a Permission Matrix |

**Notes:**
- Metrics derived from system logs/DB state (not real-time monitoring service)
- Alert triggers (error rate >10%, no run in 24h) handled by background job, not API endpoint

---

#### Webhooks (Inbound from External Services)

##### Stripe Webhook Handler
**Source:** 2.2d Phần 2 Stripe Inbound webhooks (events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed)  
**Accommodates:** 2.2d Constraint #1 (signature verification), 2.2d Constraint #2 (idempotency), 2.2d Constraint #7 (plan sync)

| Field | Detail |
|-------|--------|
| Route | `POST /api/webhooks/stripe` |
| Actor | Stripe service |
| Auth | None (webhook signature verification via Stripe-Signature header replaces auth) |
| Permission Guard | Webhook signature verification (HMAC SHA-256 via STRIPE_WEBHOOK_SECRET) — 2.2d Constraint #1 |
| Request | Stripe event payload (JSON) — event types: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` |
| Success Response | `200 OK` — `{}` (empty body, acknowledge receipt) |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 401 | INVALID_SIGNATURE | Stripe-Signature header missing or verification fails | 2.2d Constraint #1 (webhook signature verification) |
| 409 | DUPLICATE_EVENT | Event already processed (event_id in processed_stripe_events table) | 2.2d Constraint #2 (idempotency) |

**Notes:**
- Accommodates 2.2d Constraint #1, #2, #7
- Handler actions per event type (2.2d Phần 2 Stripe Inbound table):
  - `checkout.session.completed`: sync user plan (extract price_id → map to 'pro'/'power'), store stripe_customer_id
  - `customer.subscription.updated`: sync plan based on status ('canceled' → 'free', 'active' → sync tier)
  - `customer.subscription.deleted`: downgrade to 'free' + cleanup MySourceSubscriptions (keep first 10 per 2.2b assumption #10)
  - `invoice.payment_failed`: if attempt_count ≥3 → downgrade to 'free', else send alert email
- Idempotency: check `processed_stripe_events` table before processing (2.2d Constraint #2)

---

##### Telegram Webhook Handler
**Source:** 2.2d Phần 2 Telegram Inbound webhook (`/start` command for user chat_id linking)  
**Accommodates:** 2.2d Constraint #1 (signature verification), 2.2d Constraint #2 (idempotency)

| Field | Detail |
|-------|--------|
| Route | `POST /api/webhooks/telegram` |
| Actor | Telegram Bot API |
| Auth | None (webhook secret verification via X-Telegram-Bot-Api-Secret-Token header) |
| Permission Guard | Webhook signature verification — 2.2d Constraint #1 |
| Request | Telegram update payload (JSON) — `{ update_id, message: { chat: { id }, text: "/start {auth_token}" } }` |
| Success Response | `200 OK` — `{}` |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 401 | INVALID_SIGNATURE | X-Telegram-Bot-Api-Secret-Token header missing or wrong | 2.2d Constraint #1 |
| 409 | DUPLICATE_UPDATE | update_id already processed | 2.2d Constraint #2 |
| 400 | INVALID_TOKEN | JWT token expired, invalid signature, or nonce already used | 2.2d Telegram auth flow (JWT verify + nonce check) |
| 409 | CHAT_ID_IN_USE | chat_id already linked to another user | 2.2d Data Mapping (duplicate validation) |

**Notes:**
- Accommodates 2.2d Constraint #1, #2
- Handler action: extract auth_token from `/start {token}` → verify JWT (signature, exp 10min, nonce not used in `telegram_auth_tokens` table) → link chat_id to user → mark nonce as used
- Deep link format: `https://t.me/{bot_username}?start={JWT_token}` (generated by web app per 2.2d Phần 2 notes)

---

##### Resend Webhook Handler (Bounce/Complaint)
**Source:** 2.2d Phần 2 Resend Inbound webhooks (events: email.bounced, email.complained)  
**Accommodates:** 2.2d Constraint #1 (signature verification), 2.2d Constraint #2 (idempotency)

| Field | Detail |
|-------|--------|
| Route | `POST /api/webhooks/resend` |
| Actor | Resend service |
| Auth | None (webhook signature verification — method TBD per 2.2d Blocker #7) [flag #9] |
| Permission Guard | Webhook signature verification [method pending — 2.2d Blocker #7] |
| Request | Resend event payload (JSON) — event types: `email.bounced` (bounce_type: hard/soft), `email.complained` |
| Success Response | `200 OK` — `{}` |
| Error Responses | See table below |

| HTTP Status | Error Code | Trigger | Source |
|-------------|-----------|---------|--------|
| 401 | INVALID_SIGNATURE | Signature verification fails [method pending] | 2.2d Constraint #1 |
| 409 | DUPLICATE_EVENT | Event already processed | 2.2d Constraint #2 |

**Notes:**
- [flag #9]: Resend signature verification method pending verification (2.2d Blocker #7). Implementation blocked until resolved.
- Handler actions per event type (2.2d Phần 2 Resend Inbound table):
  - `email.bounced` + hard bounce: mark user.email_valid=false (add column if not in 2.2c) [flag #10], disable email delivery, send in-app notification
  - `email.bounced` + soft bounce: log + retry later (transient failure)
  - `email.complained`: disable email delivery, send in-app notification offering re-enable via preferences

---
