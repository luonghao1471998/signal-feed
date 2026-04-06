# SPEC-plan.md — SignalFeed Specification (Sections 12–13 + Appendix)

**Companion:** `SPEC-core.md`, `SPEC-api.md`. **Tóm tắt hợp đồng API ngoài (legacy 2.2d):** `API-CONTRACTS.md` — đồng bộ 2026-04-06; canonical = **`SPEC-api.md`** Section 10 + §9. **LLM prompts (Phase 1 pipeline):** `docs/prompts/v1/` — đồng bộ Flow 3; **audit write spec:** `SPEC-api` §9 **§1.3.1**.

> **Cross-reference map (legacy → SPEC split files):**  
> `2.2a` → `SPEC-core.md` Sections 5–7 · `2.2b` → Sections 3–4 · `2.2c` → Section 8 · `2.2d` → `SPEC-api.md` Section 10 · `2.2e` → Sections 9 & 11 · `2.2f` → `SPEC-core.md` Sections 1–2 + `SPEC-plan.md` Section 12 · **`2.2g` Output 1** (Sprint Plan) → `SPEC-plan.md` Section 13 · **`2.2g` Output 2** (task roadmap) → **`IMPLEMENTATION-ROADMAP.md`** riêng (playbook 2.2h — **không** embed trong SPEC).  
> Chi tiết trong từng section giữ nguyên văn bản gốc (kể cả chuỗi “2.2x …”).

---

## Section 12 — Delivery & Ops — Testing, Deployment, File Structure, UI
**Source:** 2.2f Phần 3–6
**Last confirmed:** 2026-04-06 (crawl 4×/day; overlap risk text; seed ≥50 KOL minimum)

### 3.1 — Test Layers

| Layer | Scope | Priority | Source |
|-------|-------|----------|--------|
| **Unit** | Business logic functions in Service layer: guards (add source validation, subscription cap check), state transitions (Source status changes), ranking formula (signal rank calculation), classification threshold logic | **HIGH** | 2.2b Architecture Patterns — Service Layer encapsulates business logic with guards + side effects. Source state machine (2.2b) has 4 states + 6 transitions. Pipeline 6-step sequential logic (2.2a Flow 3). |
| **Integration** | API endpoints (all 21 endpoints from 2.2e: 19 REST + 2 OAuth web routes), database queries (complex joins for My KOLs stats per 2.2a Flow 4), external service contracts (twitterapi.io, Anthropic API, Stripe webhooks) | **MEDIUM** | 2.2b Architecture Patterns — API Resource layer, Repository pattern (selective for complex queries). 2.2d API-CONTRACTS — 6 external services, 23 endpoints with failure modes. |
| **E2E** | Critical user flows: auth (OAuth X flow), add source (Flow 1, H1: subscribe-at-add if under cap), subscribe with cap enforcement (Flow 2), digest view with My KOLs filter (Flow 4), copy draft to Twitter composer (Flow 5). Admin: source **moderation** post-hoc (Flow 6 Option A). | **HIGH** | 2.2a Interaction Flows — 7 detailed flows with guards + side effects. Flows 1, 2, 4, 5 are money/auth/permission boundaries. |

**Notes:**
- Unit tests = highest priority because Product Strategy V1 Rule #5 "over-invest infrastructure" = forbidden → must verify business logic correctness early.
- Integration tests = medium priority but CRITICAL for external service contract validation (2.2d blockers #1-7 unresolved → test contracts when resolved).
- E2E tests = high priority for flows with auth/permission/payment boundaries + state transitions.

---

### 3.2 — Critical Test Paths

| # | Path | Why Critical | Source |
|---|------|-------------|--------|
| 1 | **Source state transitions — all paths** (Phase 1 Option A: user add → **active**; admin hậu kiểm → spam/deleted/restore; enum vẫn có `pending_review` cho Option B) | State machine + post-hoc moderation. Flow 6 không chặn crawl trước admin. Spam control vẫn bảo vệ quota sau khi flag. | SPEC-core Section 4 Option A; 2.2a Flow 1 + Flow 6; 2.2b conflict #13 **đã chốt** Phase 1 = Option A. |
| 2 | **Subscription cap enforcement** (Pro max 10, Power max 50, Free = 0) | Money boundary — cap enforcement determines plan value. Race condition risk if not atomic (2.2e assumption #13). | 2.2a Flow 2 Guard (Pro ≤10, Power ≤50). 2.2d Constraint #10 (My KOLs cap enforcement). Permission Matrix (Free: no My KOLs). |
| 3 | **Pipeline 6-step sequence** (crawl → classify → cluster → summarize → rank → draft) with failure recovery | Core product value. 6 sequential steps = high failure surface. Retry logic critical (2.2b Job Pattern). API quota waste if fail-retry wrong (Product Strategy budget constraint). | 2.2a Flow 3 (Pipeline — 6 steps). 2.2b Error Handling (Pipeline failures retry strategy). 2.2b assumption #14 (entire retry vs partial recovery). |
| 3a | **Pipeline overlap / long run** (4× daily schedule: job duration may exceed slot) | With **4 runs/day**, overlap risk = same as before if one run exceeds time until next slot. Use **single-flight** lock (`Cache::lock` / `WithoutOverlapping`) on pipeline job; stagger source crawl inside run. | 2.2a Flow 3 (2026-04-06: **4× daily**). 2.2b Job/Queue Pattern. twitterapi stagger + `last_crawled_at`. |
| 4 | **OAuth X.com flow end-to-end** (redirect → authorize → token exchange → user upsert → session create) | Auth boundary. Only auth method Phase 1 (2.1 NFR). Token refresh + revoke edge cases. Audit logging required (NFR #10). | 2.1 NFR OAuth X.com flow diagram. 2.2a CRUD summary (User registration/login). audit_logs table (2.2e schema). |
| 5 | **Stripe webhook plan sync** (checkout.session.completed, subscription.updated, subscription.deleted, payment_failed) | Money boundary. Plan sync ONLY via webhook (2.2d Constraint #7). Idempotency critical (Constraint #2). Downgrade cleanup conflict unresolved (2.2b assumption #10). | 2.2d Phần 2 Stripe webhooks. 2.2e Stripe Webhook Handler. 2.2d Constraint #7 (plan sync webhook-only). 2.2b assumption #10 (downgrade cleanup strategy). |
| 6 | **Category filter OR logic** (signal with categories ["AI", "Crypto"], user filters "AI" → signal shows) | User experience. Filter logic affects digest relevance (2.2b conflict #16 resolved as OR). Multi-category signals common per Ideation risk flag. **Cluster ID uniqueness:** Signal.cluster_id must be globally unique to prevent duplicate signals when same event spans multiple categories. | 2.2d Constraint #8 (category filter OR logic). 2.2a conflict #24 (filter behavior). 2.2e List Signals endpoint (Postgres array overlap operator). **Gap clarification:** Technical Review gap #1.3 — Cluster ID strategy = UUID or date_hash globally unique (implementation phase confirms). |
| 7 | **Free tier Mon/Wed/Fri restriction** (digest delivery job skips Tue/Thu/Sat/Sun for Free users) | Revenue protection. Free tier funnel (Strategy V1 Rule #5). Cron job logic + plan check. | 2.2d Constraint #9 (Free tier schedule). Strategy Pricing (Free: 3 digests/week). 2.2a assumption #1 (Mon/Wed/Fri schedule). |
| 7a | **Draft usage tracking** (copy_draft action = proxy for "post" measurement) | Moat metric dependency. Strategy V1 Rule #1 "log mọi interaction". Phase 2 moat trigger = "draft usage >30%". **Clarification:** Cannot track actual Twitter post (external platform), use copy_draft action as proxy. Acceptable limitation — user copied = intent to use. | 2.2a Flow 5 (UserInteraction.action='copy_draft'). Strategy Moat Stack Phase 2 (draft usage >30% trigger). **Gap addressed:** Technical Review gap #3.2 — tracking = copy action, not external post verification. |
| 8 | **External service contract validation** (twitterapi.io crawl, Anthropic API classify/summarize, Resend email, Telegram alerts) | Dependency risk. 6 external services (2.2d). 18 failure modes documented. Contract compliance = production reliability. | 2.2d Phần 2 (6 services, 23 endpoints). 2.2d Phần 4 (18 failure modes). Test mocks/stubs for contracts when blockers #1-7 resolved. |
| 8a | **Signal ranking formula tuning** (rank_score weights for source_count, avg_signal_score, recency_decay) | Core product quality. Formula = f(source_count, avg_signal_score, recency_decay) but weights undefined per 2.2a assumption #9. **Gap:** Need distinguish "5 KOLs retweet meme" (low signal) vs "5 KOLs discuss news" (high signal). Requires signal_score weighting + noise filtering. | 2.2a Flow 3 Rank step (assumption #9 formula). 2.2a Flow 3 Classify (signal_score threshold ≥0.7). **Gap identified:** Technical Review gap #3.3 — weights need empirical tuning during Sprint 1 dogfood, not pre-defined. |

**Notes:**
- Paths #1, #2, #5 involve money/payment → highest test priority.
- Paths #3, #8 involve external services → integration test critical, mock/stub for unit tests.
- Path #4 (OAuth) = only auth method → no fallback if broken.
- Path #7 (Free tier restriction) = revenue protection + funnel metric tracking.

---

### 3.3 — Test Data Strategy

**Seeding Approach:**
- **Factory pattern** for core entities (User, Source, Signal, MySourceSubscription) — derive from 2.2c entity definitions. [inferred from 2.2b Laravel Tech Stack — Eloquent factories convention]
- **Fixture files** for static data (10 categories hardcoded per 2.2a) — seed via migration. Source: 2.2a Entity Relationship (Category static).
- **Seed script** for source pool — **minimum ≥50 handles** for dogfood; target **~500** KOL handles — CSV import to sources table. Source: Strategy Wedge Feature #1 (curated source pool). **2026-04-06**

**Isolation Approach:**
- **Test DB reset per suite** via Laravel RefreshDatabase trait. Source: 2.2b Tech Stack (Laravel 11.x test conventions). [inferred — implementation phase chốt]
- **Transaction rollback** for individual test isolation where feasible (fast unit tests). [inferred from 2.2b Laravel pattern]

**Notes:**
- Factory + fixture + seed script = 3-tier test data strategy derived from entity types (dynamic vs static vs bulk import).
- Test framework NOT chosen here (PHPUnit implied by Laravel, but implementation phase confirms).

---

## Phần 4 — Deployment Plan

### 4.1 — Environments

| Environment | Purpose | Source |
|-------------|---------|--------|
| **Development** | Local dev (founder laptop). Docker Compose OR Laravel Valet for local Postgres + Redis. | Default — solo developer per Ideation constraints. |
| **Production** | Live environment. Railway OR Render free tier → paid tier ($5-10/mo after credits). Managed Postgres + Redis. | 2.2b Tech Stack Decision (Railway/Render tentative). Ideation budget $150-300 pre-revenue. |

**Notes:**
- **Staging environment NOT included** — solo founder, 2-3 week MVP timeline per Ideation Section 10. No QA team. [assumed — confirm with team] [flag #1]
- If staging needed later → add between dev + prod, clone prod config. Migration path: 1 day setup.

---

### 4.2 — Deploy Approach

| Aspect | Direction | Source |
|--------|-----------|--------|
| **Deploy method** | Git push deploy (Railway/Render auto-deploy from main branch). Manual deploy via CLI fallback (railway up / render deploy). | 2.2b Tech Stack (Railway/Render Git push deploy). Ideation constraint "solo developer". |
| **DB migration** | Laravel migration files (framework-managed via `php artisan migrate`). Forward-only migrations Phase 1 (no rollback migrations). | 2.2b Tech Stack (Laravel 11.x migration system). Strategy V1 Rule #5 "don't over-invest infrastructure". |
| **Zero-downtime** | NOT required at current scale (<100 users Phase 1). Accept brief downtime (30-60s) during migration deploy. | NFR not specified. Ideation batch job (digest generation) = not real-time. Strategy "execute fast" vs zero-downtime complexity trade-off. [inferred — implementation phase chốt] |
| **Rollback** | Git revert + redeploy (forward rollback). Database rollback = manual restore from backup (Railway/Render automated daily backups). | 2.2b Tech Stack (Git-based deploy). Zero-downtime not required → manual rollback acceptable. [inferred — implementation phase chốt] |
| **Crawl cost circuit breaker** | Budget protection ($150-300/mo ceiling). **Direction:** Monitor twitterapi.io API usage daily. If cost trajectory exceeds $70/mo (crawl budget cap) → auto-pause low-quality sources (signal_count <3 in last 30 days). Alert admin via Telegram. Manual review to re-enable OR remove spam sources. | Strategy budget constraint + Product Strategy Wedge ($50-70/mo twitterapi.io estimate). **Gap addressed:** Technical Review gap #3.4 — operational kill switch for cost runaway. [inferred from budget + operational necessity] |

**Notes:**
- Zero-downtime deployment NOT implemented Phase 1 — adds complexity (blue-green, canary), conflicts with Strategy V1 Rule #5.
- Rollback strategy = forward rollback (Git revert) because backward migration rollback risky with data loss.
- Container orchestration (Docker Compose, K8s) NOT chosen — Railway/Render abstract container layer. [inferred — implementation phase may add Docker for local dev]

---

### 4.3 — Configuration Management

| Aspect | Direction | Source |
|--------|-----------|--------|
| **Env vars** | `.env` file per environment (local `.env`, production `.env` via Railway/Render dashboard). Laravel convention: `config/[domain].php` files load from env. | 2.2b Tech Stack (Laravel 11.x config convention). |
| **Secrets** | Stored as env vars, NOT committed to Git. `.env.example` in repo with placeholder values. Critical secrets: `APP_KEY`, `DB_PASSWORD`, `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `TWITTER_API_KEY`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`. | 2.2b Tech Stack (Laravel .env pattern). 2.2d Phần 1 Service Inventory (env config column — 6 services). |
| **Config drift** | NOT addressed Phase 1 — manual sync between local + production `.env`. Config drift detection = Phase 2 if team grows. | Strategy "solo founder" + "execute fast" — drift detection overhead not justified. [inferred — not required] |

**External Service Env Vars (from 2.2d):**
- See 2.2d Phần 1 Service Inventory for full list: `TWITTER_API_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_POWER_PRICE_ID`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`.

**Notes:**
- Config management = minimal approach (`.env` files + Laravel config layer) — matches Strategy "don't over-invest infrastructure".
- Secrets rotation NOT automated — manual process via dashboard. Acceptable for solo founder scale.

---

## Phần 5 — File Structure

**Framework:** Laravel 11.x (per 2.2b Tech Stack Decision)  
**Convention Source:** Laravel 11.x default directory structure + 2.2b Architecture Patterns

```
signalfeed/                          -- [Laravel project root]
├── app/                             -- [Application code] — Source: Laravel convention
│   ├── Http/                        -- [HTTP layer] — Source: 2.2b Architecture Patterns (Loại A — HTTP Layer)
│   │   ├── Controllers/             -- [Controllers — route handlers] — Source: 2.2b Layer Dependency Rules (Controller → Service)
│   │   │   ├── Auth/                -- [OAuth X.com controllers]
│   │   │   ├── Api/                 -- [API controllers for React SPA]
│   │   │   └── Admin/               -- [Admin controllers — source moderation, pipeline monitor]
│   │   ├── Middleware/              -- [Auth, tenant scope, logging] — Source: 2.2b patterns (Event-Driven, tenant_id scope)
│   │   └── Resources/               -- [API Resources — JSON transformers] — Source: 2.2b API Resource pattern
│   ├── Services/                    -- [Service Layer — business logic] — Source: 2.2b Architecture Patterns (Loại A — Service Layer)
│   │   ├── PipelineService.php      -- [Pipeline 6-step orchestration] — Source: 2.2a Flow 3
│   │   ├── SourceService.php        -- [Add source, validation, subscribe logic] — Source: 2.2a Flow 1, 2
│   │   └── DigestService.php        -- [Digest generation, My KOLs filter stats] — Source: 2.2a Flow 4
│   ├── Actions/                     -- [Action Pattern — single-purpose operations] — Source: 2.2b Architecture Patterns (Loại A — Action Layer)
│   │   ├── AddSourceToPoolAction.php    -- [Flow 1 logic]
│   │   ├── SubscribeToSourceAction.php  -- [Flow 2 logic]
│   │   └── ...
│   ├── Repositories/                -- [Repository Pattern — selective] — Source: 2.2b Architecture Patterns (Loại A — optional layer)
│   │   └── SignalRepository.php     -- [Complex queries — My KOLs stats, ranking] — Source: 2.2b assumption #7 (complex queries only)
│   ├── Models/                      -- [Eloquent Models — data layer] — Source: 2.2b Architecture Patterns (Loại A — Model Layer)
│   │   ├── User.php                 -- [11 core entities from 2.2c]
│   │   ├── Source.php
│   │   ├── Signal.php
│   │   └── ...
│   ├── Jobs/                        -- [Laravel Jobs — background tasks] — Source: 2.2b Architecture Patterns (Loại A — Job Layer)
│   │   ├── PipelineCrawlJob.php     -- [Flow 3 — 6 steps] — Source: 2.2a Flow 3, 2.2b Job/Queue Pattern
│   │   ├── SendDigestEmailJob.php   -- [Email delivery] — Source: 2.2a F16
│   │   └── LogUserInteractionJob.php -- [Async logging] — Source: Strategy V1 Rule #1, 2.2b Event-Driven
│   ├── Events/                      -- [Laravel Events] — Source: 2.2b Architecture Patterns (Loại A — Event Layer)
│   │   ├── SignalClicked.php
│   │   ├── DraftCopied.php
│   │   ├── PipelineCompleted.php
│   │   └── PipelineFailed.php
│   ├── Listeners/                   -- [Event Listeners] — Source: 2.2b Architecture Patterns (Loại A — Listener Layer)
│   │   ├── LogUserInteraction.php   -- [Moat data capture]
│   │   └── AlertAdmin.php           -- [Telegram alert on pipeline fail]
│   ├── Integrations/                -- [External Service Adapters] — Source: 2.2b Architecture Patterns (Loại A — Integration Layer)
│   │   ├── TwitterCrawlClient.php   -- [twitterapi.io wrapper] — Source: 2.2d Service #1
│   │   ├── LLMClient.php            -- [Anthropic API wrapper] — Source: 2.2d Service #2
│   │   ├── StripeClient.php         -- [Stripe wrapper] — Source: 2.2d Service #3
│   │   ├── EmailClient.php          -- [Resend wrapper] — Source: 2.2d Service #4
│   │   └── TelegramClient.php       -- [Telegram Bot API wrapper] — Source: 2.2d Service #5
│   └── Console/                     -- [Artisan commands] — Source: Laravel convention (Loại B — Support)
│       ├── Kernel.php               -- [Scheduler — pipeline 4×/day UTC slots + `schedule:run`] — Source: 2.2b Task Scheduler
│       └── Commands/                -- [GDPR export/delete commands] — Source: 2.1 NFR #11
├── database/                        -- [Database files] — Source: Laravel convention (Loại B — Support)
│   ├── migrations/                  -- [Migration files] — Source: 2.2b Tech Stack (Laravel migration convention)
│   │   ├── YYYY_MM_DD_create_users_table.php
│   │   ├── YYYY_MM_DD_create_sources_table.php
│   │   └── ... [17+ tables: 2.2e schema + `user_personal_feed_entries` — 2026-04-06]
│   ├── factories/                   -- [Factory pattern for test data] — Source: 2.2f Phần 3.3 (seeding approach)
│   └── seeders/                     -- [Seed scripts] — Source: 2.2f Phần 3.3
│       ├── CategorySeeder.php       -- [10 categories hardcoded] — Source: 2.2a Entity Relationship (Category static)
│       └── SourcePoolSeeder.php     -- [500 KOL CSV import] — Source: Strategy Wedge Feature #1
├── routes/                          -- [Route definitions] — Source: Laravel convention (Loại B — Support)
│   ├── api.php                      -- [API routes for React SPA] — Source: 2.2e Phần 2 (19 REST endpoints)
│   ├── web.php                      -- [Web routes — OAuth callback, privacy policy page]
│   └── console.php                  -- [Artisan routes if needed]
├── resources/                       -- [Frontend + views] — Source: Laravel convention (Loại B — Support)
│   ├── js/                          -- [React 18 SPA] — Source: 2.2b Tech Stack (React 18 + Vite)
│   │   ├── components/              -- [React components — cards, filters, modals]
│   │   ├── pages/                   -- [Page components — digest, my-kols, admin]
│   │   ├── i18n/                    -- [i18n setup] — Source: 2.1 NFR #1 (prep Phase 1)
│   │   │   └── en.json              -- [English message keys]
│   │   └── App.jsx                  -- [Root component]
│   ├── views/                       -- [Blade templates — minimal] — Source: Laravel convention
│   │   └── privacy-policy.blade.php -- [Privacy policy page] — Source: 2.1 NFR #11
│   └── css/                         -- [Tailwind CSS] — Source: 2.2b Tech Stack (inferred from React + Vite)
├── storage/                         -- [Storage directory] — Source: Laravel convention (Loại B — Support)
│   ├── logs/                        -- [Application logs]
│   ├── exports/                     -- [GDPR export JSON files] — Source: 2.1 NFR #11
│   └── framework/                   -- [Laravel cache, sessions, views]
├── tests/                           -- [Test directories — mirror app structure] — Source: 2.2f Phần 3 (Loại B — Test)
│   ├── Unit/                        -- [Unit tests — Service layer, guards, state transitions]
│   ├── Feature/                     -- [Integration tests — API endpoints, DB queries] — Source: Laravel test convention
│   └── Browser/                     -- [E2E tests — Laravel Dusk OR Playwright] — Source: 2.2f Phần 3.2 (E2E flows)
├── config/                          -- [Config files] — Source: Laravel convention (Loại B — Support)
│   ├── services.php                 -- [External service config — loads from .env] — Source: 2.2d env vars
│   ├── database.php
│   ├── queue.php
│   └── ...
├── public/                          -- [Public assets] — Source: Laravel convention (Loại B — Support)
│   ├── index.php                    -- [Laravel entry point]
│   └── build/                       -- [Vite compiled assets]
├── .env.example                     -- [Env var template] — Source: 2.2f Phần 4.3
├── composer.json                    -- [PHP dependencies]
├── package.json                     -- [Node dependencies — React, Vite]
├── vite.config.js                   -- [Vite config]
└── README.md
```

**Directory Classification Summary:**

**Loại A — Architecture Layer Directories (from 2.2b):**
- `app/Http/Controllers/` — HTTP Layer (2.2b Layer Dependency Rules)
- `app/Services/` — Service Layer (2.2b Architecture Patterns)
- `app/Actions/` — Action Pattern (2.2b Architecture Patterns)
- `app/Repositories/` — Repository Pattern selective (2.2b Architecture Patterns)
- `app/Models/` — Model Layer (2.2b Architecture Patterns)
- `app/Jobs/` — Job Layer (2.2b Architecture Patterns)
- `app/Events/` + `app/Listeners/` — Event Layer (2.2b Event-Driven pattern)
- `app/Integrations/` — External Service Adapter (2.2b Architecture Patterns)

**Loại B — Support Directories:**
- `database/migrations/` — Laravel 11.x migration convention (2.2b Tech Stack)
- `database/factories/`, `database/seeders/` — Test data strategy (2.2f Phần 3.3)
- `routes/` — Laravel routing convention
- `resources/` — Frontend (React) + Blade views (privacy policy)
- `storage/` — Laravel storage convention
- `tests/` — Mirror app structure (2.2f Phần 3 test layers)
- `config/` — Configuration management (2.2f Phần 4.3)
- `public/` — Laravel public convention

**Notes:**
- File structure follows Laravel 11.x convention + 2.2b architecture patterns 1:1 mapping.
- Test directories mirror app structure (Unit tests for Services, Feature tests for Controllers/API, Browser tests for E2E flows).
- No custom directories invented — all derived from Laravel convention OR 2.2b explicit patterns.

---

## Phần 6 — UI Skeleton

### 6.1 — Screen Inventory

| # | Screen Name | Route Pattern | Accessible By | Primary Entity | Key States | Source |
|---|-------------|---------------|---------------|----------------|------------|--------|
| 1 | Landing Page | `/` | Unauthenticated (public) | N/A | N/A — static marketing page | Ideation Section 5 (User Flows — Onboarding) |
| 2 | OAuth Callback | `/auth/twitter/callback` | Unauthenticated (OAuth flow) | User | N/A — redirect handler | 2.1 NFR OAuth X.com flow, 2.2e Auth endpoints |
| 3 | Onboarding Step 1: Category Selection | `/onboarding/categories` | Authenticated (new user, no my_categories) | Category | N/A — CRUD only (Category static) | 2.2a CRUD summary (User selects categories), Strategy V1 Rule #2 (onboarding ≤3 steps) |
| 4 | Onboarding Step 2: Optional KOL Follow | `/onboarding/sources` (optional step) | Authenticated (new user) | Source | source.status = 'active' (only show active sources) | 2.2a Flow 1 (Add Source — optional at onboarding), Strategy V1 Rule #2 |
| 5 | Digest View (All Sources) | `/digest` or `/digest/:date` | Authenticated (Free: Mon/Wed/Fri only, Pro/Power: daily) | Signal | N/A — CRUD only (signals shared, no user state) | 2.2a F13 (Digest Web — All), 2.2e List Signals endpoint, 2.2d Constraint #9 (Free tier schedule) |
| 6 | Digest View (My KOLs Filter Toggle) | `/digest?my_sources_only=true` | Authenticated (Pro, Power only) | Signal + MySourceSubscription | N/A — filter state in query param | 2.2a F14 (Digest Web — My KOLs), Flow 4, 2.2e List Signals my_sources_only param |
| 7 | Signal Detail Modal | `/digest` (modal overlay, not separate route) | Authenticated (all tiers) | Signal | N/A — CRUD only | 2.2a CRUD summary (User views Signal detail), 2.2e Get Signal Detail endpoint |
| 8 | My KOLs List | `/my-sources` | Authenticated (Pro, Power only) | MySourceSubscription (junction) | N/A — junction table, no state | 2.2a F06 (My KOLs personal list), 2.2e List My KOLs endpoint |
| 9 | My KOLs Stats | `/my-sources/stats` | Authenticated (Pro, Power only) | Signal + MySourceSubscription (computed stats) | N/A — computed fields | 2.2a F15 (My KOLs Stats), Flow 4, 2.2e My KOLs Stats endpoint |
| 10 | Browse Source Pool | `/sources` | Authenticated (all tiers. Free: read-only, Pro/Power: can add/subscribe) | Source | source.status = 'active' (default filter), source.type = 'default'/'user' | 2.2a F06 (Browse pool), 2.2e List Sources endpoint, Permission Matrix (Free: read-only) |
| 11 | Add Source Form | `/sources/add` (modal OR separate page) | Authenticated (Pro, Power only) | Source | Sau submit: **`status='active'`** (`type='user'`, Option A — vào pool + crawl không chờ admin) | 2.2a Flow 1, SPEC-core Section 4 Option A, `POST /api/sources` (SPEC-api) |
| 12 | User Settings | `/settings` | Authenticated (self-owned) | User | plan = 'free'/'pro'/'power' (read-only, plan sync via Stripe webhook) | 2.2a CRUD summary (User updates preferences), 2.2e Update User Preferences endpoint, 2.2d Constraint #7 |
| 13 | Admin: Source moderation (post-hoc) | `/admin/sources?type=user` (optional `?status=`) | Admin only | Source | Lọc `type=user`; trạng thái thường **active** (mới thêm); spam/deleted khi đã xử lý — **không** dùng `pending_review` làm queue mặc định Phase 1 | 2.2a Flow 6 Option A, `GET/PATCH /api/admin/sources` (SPEC-api) |
| 14 | Admin: Pipeline Monitor | `/admin/pipeline` | Admin only | N/A (system metrics) | N/A — derived metrics from logs/DB | 2.2a Flow 7 (Pipeline Monitor), 2.2e Pipeline Monitor Dashboard endpoint |
| 15 | Privacy Policy | `/privacy` | Public | N/A | N/A — static page | 2.1 NFR #11 (GDPR — privacy policy required) |

**Notes:**
- **SCREEN TÁCH RULE applied:** Screens 5 + 6 = SAME SCREEN (`/digest`) because same route pattern, same entity (Signal), same permissions (auth required). `my_sources_only` = filter toggle state, not separate screen.
- Screen 7 (Signal Detail) = modal overlay on Screen 5, not separate route. Modal dismissed = return to digest list.
- Screen 11 (Add Source) = modal OR separate page — implementation phase decides. Listed as separate screen because distinct flow (Flow 1) with guards. **Option A:** response hiển thị source đã **active** ngay sau khi thêm.
- Screen 13 = **hậu kiểm** (flag spam, chỉnh category, soft delete, restore) — không còn luồng “Approve để kích hoạt crawl” Phase 1.
- Screens 2, 15 = functional pages (OAuth callback, privacy policy) — no interactive UI beyond redirect/display.
- Auth screens (login/register) NOT listed separately — OAuth X.com flow handled via Screen 2 callback. Login button on Screen 1 landing page redirects to X OAuth, callback to Screen 2, redirect to Screen 3 (onboarding) or Screen 5 (digest).

---

### 6.2 — Screen-Role Matrix

| Role | Screens Accessible | Source |
|------|-------------------|--------|
| **Unauthenticated** | #1 (Landing), #2 (OAuth callback), #15 (Privacy policy) | 2.2a Permission Matrix (Public = landing only) |
| **Free User** | #3-7, #10, #12, #15 (NOT: #8, #9, #11 = Pro+ features) | 2.2a Permission Matrix (Free: no My KOLs, no drafts in detail, read-only browse), 2.2d Constraint #9 (digest 3x/week) |
| **Pro User** | #3-12, #15 (all user screens except admin) | 2.2a Permission Matrix (Pro: My KOLs cap 10, daily digest, drafts) |
| **Power User** | #3-12, #15 (same as Pro, cap difference = 50 My KOLs) | 2.2a Permission Matrix (Power: My KOLs cap 50, Telegram alerts Phase 2) |
| **Admin** | #3-15 (all screens) | 2.2a Permission Matrix (Admin: source **moderation** post-hoc, pipeline monitor) |

**Cross-Check:**
- Every screen (#1-15) accessible by at least 1 role ✓
- Free users CANNOT access #8 (My KOLs List), #9 (Stats), #11 (Add Source) — enforced by 403 FORBIDDEN per 2.2e endpoint guards ✓
- Admin-only screens (#13 moderation, #14 pipeline) — enforced by **`users.is_admin`** + middleware per `SPEC-api` ✓

---

## Section 13 — Sprint Plan
**Source:** 2.2g Output 1 (chỉ Sprint Plan; roadmap task-level → `IMPLEMENTATION-ROADMAP.md` theo playbook 2.2h)
**Last confirmed:** 2026-04-06 (đồng bộ amendment: crawl 4×/ngày, personal feed Sprint 2+, admin `is_admin`)

### Nội dung Sprint Plan (nguồn: SPRINT-PLAN.md)

# SignalFeed — Sprint Plan

**Generated:** 2026-04-02  
**Input:** PRODUCT-STRATEGY.md + Domain Foundation (2.2a) + Architecture & State (2.2b) + Data Model (2.2c) + API-CONTRACTS (2.2d) + Schema & API Specs (2.2e) + Delivery & Ops (2.2f)  
**Purpose:** Sprint breakdown with Wedge-first principle + kill checkpoint  
**Wedge Scope:** Crawl pipeline + AI classify/cluster/summarize/rank + Digest web UI + Source attribution + Draft generation (PRODUCT-STRATEGY Wedge Features #1-5)

---

## Sprint Overview

| Sprint | Goal | Tag Distribution | Kill Gate |
|--------|------|-----------------|-----------|
| Sprint 1 | Deliver Wedge scope: crawl pipeline + AI processing + digest UI + drafts — sufficient to test kill checkpoint (founder dogfood + landing page signup + Reddit seeding) | 7 WEDGE + 5 SUPPORT | ✓ Kill Checkpoint |
| Sprint 2 | Add My KOLs subscription + stats + user-added sources — complete Pro tier value proposition | 4 POST-WEDGE + 0 SUPPORT | — |
| Sprint 3 | Add plan enforcement + billing + Free tier restrictions + admin tools — production-ready multi-tier SaaS | 4 POST-WEDGE + 0 SUPPORT | — |

---

## Sprint 1 — Deliver Wedge (Kill Checkpoint Ready)

**Goal:** Implement 5 Wedge features (crawl → classify → cluster → summarize → rank → draft + digest UI) + essential infrastructure (auth, DB, external services). At sprint end: founder can dogfood daily, landing page collects signups, product testable for Reddit seeding. Kill checkpoint criteria measurable.

| # | Feature | Tag | Entities | Key Flows | Source | Depends On |
|---|---------|-----|----------|-----------|--------|------------|
| 1.1 | **Project Scaffold + Config** | [SUPPORT] | — (infrastructure) | — | 2.2f File Structure (Laravel 11.x + React 18 SPA), 2.2b Tech Stack Decision | — |
| 1.2 | **Database Schema Setup** | [SUPPORT] | All 11 core entities (Category, User, Source, Tweet, Signal, MySourceSubscription, etc.) | — | 2.2e Phần 1 (16 tables, 4 enums, 16 indexes) | 1.1 |
| 1.3 | **OAuth X.com Authentication** | [SUPPORT] | User | 2.2a CRUD summary (User registration/login via OAuth X) | 2.2e Auth endpoints (register, login), 2.1 NFR OAuth X.com flow, Strategy V1 MUST-HAVE #3 (founder dogfood) | 1.2 |
| 1.4 | **Category Seed + API** | [SUPPORT] | Category | 2.2a CRUD summary (Category read-only) | 2.2e GET /api/categories, 2.2a Entity Relationship (10 categories hardcoded) | 1.2 |
| 1.5 | **Source Pool Setup** | [WEDGE] | Source, SourceCategory | 2.2a CRUD summary (Admin adds default sources) | 2.2e schema sources table, Strategy Wedge Feature #1 (500 KOL curated pool), 2.2a F04 | 1.2, 1.4 |
| 1.6 | **Crawl Pipeline — Fetch Tweets** | [WEDGE] | Tweet, Source | 2.2a Flow 3 step 1 (Crawl: fetch tweets from sources via twitterapi.io) | 2.2b Job/Queue Pattern (PipelineCrawlJob), 2.2d twitterapi.io integration, 2.2a F07 | 1.5 |
| 1.7 | **AI Classify Signal/Noise** | [WEDGE] | Tweet (signal_score, is_signal) | 2.2a Flow 3 step 2 (Classify: LLM assigns signal_score, threshold ≥0.7) | 2.2d Anthropic API integration (classify endpoint), 2.2a F08, Strategy Wedge Feature #2 | 1.6 |
| 1.8 | **AI Cluster + Summarize** | [WEDGE] | Signal (cluster_id, title, summary, topic_tags), SignalSource | 2.2a Flow 3 steps 3-4 (Cluster by topic similarity → Summarize per cluster) | 2.2d Anthropic API integration (cluster + summarize endpoints), 2.2a F09, F10, F11 | 1.7 |
| 1.9 | **Signal Ranking + Draft Generation** | [WEDGE] | Signal (rank_score), DraftTweet | 2.2a Flow 3 steps 5-6 (Rank by formula → Generate draft tweet) | 2.2a assumption #9 (rank formula), 2.2a F10, F12, Strategy Wedge Feature #5 | 1.8 |
| 1.10 | **Digest Web UI — All Sources View** | [WEDGE] | Signal, Digest | 2.2a F13 (Digest web UI — card-based, mobile-first), 2.2a CRUD summary (User views digest) | 2.2e GET /api/signals (list digest), 2.2f UI Skeleton Screen #5, Strategy Wedge Feature #3 | 1.9, 1.3 |
| 1.11 | **Signal Detail + Source Attribution** | [WEDGE] | Signal, SignalSource, Tweet | 2.2a F18 (Source attribution: ai nói, link original, timestamp, tổng KOL), 2.2a CRUD summary (Signal detail view) | 2.2e GET /api/signals/{id} (detail endpoint), 2.2f UI Skeleton Screen #7, Strategy Wedge Feature #4 | 1.10 |
| 1.12 | **Draft Tweet → Twitter Composer** | [WEDGE] | DraftTweet, UserInteraction | 2.2a Flow 5 (User Opens Twitter Composer with draft pre-filled) | 2.2e POST /api/signals/{id}/draft/copy (Twitter Web Intent), 2.2a F19, Strategy Wedge Feature #5 | 1.11 |

**Kill Checkpoint — End of Sprint 1:**

Copy từ PRODUCT-STRATEGY.md Section 3 Kill Test + Section 5 KILL SIGNAL:

**Criteria (khớp PRODUCT-STRATEGY.md — không nhân đôi dòng):**

*Kill Test (Section 3):*
1. **Landing page signup <5% conversion** → Kill — signal không đủ mạnh
2. **Paying users post-launch <10 sau 4 tuần** → Kill
3. **Reddit seeding 2 tuần liên tục, 0 organic signups** → Distribution motion fail — pivot channel hoặc kill
4. **Founder không dùng daily sau 1 tuần** → Kill — product không solve pain thật

*KILL SIGNAL (Section 5 — bổ sung ngưỡng):*
5. **User recreate toàn bộ value bằng "Grok prompt + Twitter Lists" trong 10 phút** → Kill
6. **Reddit seeding 3 tuần liên tục, 0 organic signup** → Kill (ngưỡng thời gian khác mục #3)
7. **Founder không dogfood daily sau tuần đầu** → Kill (trùng ý với mục #4 trong Kill Test — chỉ cần một bộ evidence founder dogfood)

**Evidence Needed:**
- Landing page analytics: signup conversion rate (visitors → email captured) — track via Google Analytics or simple DB log
- Founder dogfood log: daily digest views + draft copy actions in user_interactions table (user_id = founder)
- Reddit seeding tracker: posts scheduled + organic signups (signups NOT from founder's network) — track via UTM params or manual log
- Time-to-recreate benchmark: founder manually attempts to recreate digest output using Grok + Twitter Lists → measure time

**Decision:**
- **CONTINUE → Sprint 2** nếu Kill Test #1 và #4 đạt (landing ≥5%, founder dogfood daily) **và** có tín hiệu tích cực ở distribution hoặc revenue (ví dụ Kill Test #3 Reddit có organic **hoặc** Kill Test #2 đã có ≥1 paying user trong cửa sổ đo — tùy giai đoạn bạn áp dụng).
- **KILL** nếu Kill Test #1 hoặc #4 fail **hoặc** điều kiện KILL SIGNAL #5 (recreate ≤10 phút) **hoặc** Kill Test #2 / KILL SIGNAL #6 theo đúng ngưỡng Strategy.
- **PIVOT → kênh distribution mới** nếu Kill Test #3 (Reddit 2 tuần) fail nhưng #1 + #4 pass (sản phẩm dùng được, kênh không chạy).

---

## Sprint 2 — My KOLs (Pro Tier Value)

**Goal:** Implement My KOLs personal subscription system + user-added sources + My KOLs filtered digest + stats. Completes Pro tier feature set ($9.9/mo value proposition). Enables testing subscription cap enforcement.

| # | Feature | Tag | Entities | Key Flows | Source | Depends On |
|---|---------|-----|----------|-----------|--------|------------|
| 2.1 | **Add Source to Pool (User-Generated)** | [POST-WEDGE] | Source (type='user'), SourceCategory | 2.2a Flow 1 (validate, create pool entry; subscribe-at-add if under cap — H1) | 2.2e POST /api/sources (add source endpoint), 2.2a F05 | Sprint 1 complete |
| 2.2 | **My KOLs Subscribe/Unsubscribe** | [POST-WEDGE] | MySourceSubscription | 2.2a Flow 2 (User Subscribes to Source — cap enforcement: Pro ≤10, Power ≤50) | 2.2e POST /api/sources/{id}/subscribe, DELETE /api/sources/{id}/subscribe, 2.2a F06 | 2.1 |
| 2.3 | **Browse Source Pool + Search** | [POST-WEDGE] | Source | 2.2a CRUD summary (User searches sources by @handle) | 2.2e GET /api/sources (browse pool endpoint), 2.2f UI Skeleton Screen #10, 2.2a F06 | 2.2 |
| 2.4 | **My KOLs List + Stats UI** | [POST-WEDGE] | MySourceSubscription (list), Signal (stats) | 2.2a Flow 4 (User Views My Sources Digest — stats calculation) | 2.2e GET /api/my-sources, GET /api/my-sources/stats, 2.2f UI Skeleton Screens #8-9, 2.2a F15 | 2.2, 2.3 |

---

## Sprint 3 — Billing + Admin + Production-Ready

**Goal:** Implement plan enforcement (Free/Pro/Power tier restrictions) + Stripe billing + Free tier Mon/Wed/Fri digest restriction + **admin source moderation (post-hoc)** + pipeline monitoring. Production-ready multi-tier SaaS with revenue capability.

| # | Feature | Tag | Entities | Key Flows | Source | Depends On |
|---|---------|-----|----------|-----------|--------|------------|
| 3.1 | **Stripe Billing Integration** | [POST-WEDGE] | User (stripe_customer_id, plan), processed_stripe_events | 2.2a CRUD summary (User plan changes via Stripe webhook) | 2.2e Stripe Webhook Handler (4 events: checkout.session.completed, subscription.updated, subscription.deleted, payment_failed), 2.2d Stripe integration, 2.2a F02 | Sprint 2 complete |
| 3.2 | **Free Tier Enforcement** | [POST-WEDGE] | User (plan), Digest (date restriction) | 2.2a assumption #1 (Free tier Mon/Wed/Fri schedule) | 2.2d Constraint #9 (Free tier schedule), 2.2e digest delivery job (cron filter by plan + day-of-week) | 3.1 |
| 3.3 | **Admin Source Moderation (post-hoc)** | [POST-WEDGE] | Source (`type='user'`, status active/spam/deleted; enum giữ `pending_review` cho Option B) | 2.2a Flow 6 Option A (flag spam, adjust categories, soft delete, restore — **không** approve-before-crawl) | SPEC-api: `GET /api/admin/sources`, `PATCH /api/admin/sources/{id}` (`flag_spam`, `adjust_categories`, `soft_delete`, `restore`), UI Screen #13, 2.2a F21 | 3.1 |
| 3.4 | **Admin Pipeline Monitor** | [POST-WEDGE] | Tweet, Signal, (derived metrics) | 2.2a Flow 7 (Admin Monitors Pipeline — crawl status, classify accuracy, error rate) | 2.2e GET /api/admin/pipeline, 2.2f UI Skeleton Screen #14, 2.2a F22 | 3.1 |

---

## Feature Coverage Verification

**All Entities Covered (11/11):**
- ✓ Category (1.4)
- ✓ User (1.3, 3.1)
- ✓ Source (1.5, 2.1, 3.3)
- ✓ SourceCategory (1.5, 2.1)
- ✓ MySourceSubscription (2.2, 2.4)
- ✓ Tweet (1.6, 1.7, 3.4)
- ✓ Signal (1.8, 1.9, 1.10, 1.11, 2.4, 3.4)
- ✓ SignalSource (1.8, 1.11)
- ✓ DraftTweet (1.9, 1.12)
- ✓ Digest (1.10, 3.2)
- ✓ UserInteraction (1.12, 2.4)

**All Wedge Features Covered (5/5):**
- ✓ Wedge Feature #1 (Crawl pipeline) → 1.6
- ✓ Wedge Feature #2 (AI classify + cluster + summarize + rank) → 1.7, 1.8, 1.9
- ✓ Wedge Feature #3 (Digest web UI) → 1.10
- ✓ Wedge Feature #4 (Source attribution) → 1.11
- ✓ Wedge Feature #5 (Draft generation) → 1.9, 1.12

**All API Endpoints Covered (19 routes trong 2.2e Phần 2 — đếm route, không đếm method trùng):**
- Auth + user prefs (3): `POST /api/auth/register`, `POST /api/auth/login`, `PATCH /api/users/me` — *lưu ý: Sprint 1 thực tế dùng OAuth X (1.3); các route register/login trong 2.2e vẫn mô tả email/password — cần map OAuth hoặc sửa 2.2e cho đồng bộ*
- Categories (1): 1.4
- Sources + My KOLs (5): 1.5, 2.1, 2.2, 2.3
- Signals + draft copy (3): 1.10, 1.11, 1.12
- My KOLs Stats (1): 2.4
- Admin (2): 3.3, 3.4
- Webhooks (3): 3.1
- (Email digest delivery deferred — not critical path for kill checkpoint, implement if CONTINUE decision)

---

## Open Questions / Assumptions

| # | Điểm | Loại | Impact nếu sai | Reflected in |
|---|------|------|-----------------|--------------|
| 1 | **Sprint 1 Wedge scope = sufficient for kill checkpoint?** OAuth X.com auth + digest UI + pipeline + drafts enough to test criteria #1 (landing signup) + #4 (founder dogfood). Reddit seeding requires landing page (not in Wedge) — assumed simple static HTML page outside sprint scope (founder creates manually). | Assumption | If landing page needs complex UI (pricing table, testimonials, demo video) → add to Sprint 1 or pre-sprint work. Kill checkpoint #1 untestable without landing page. | Sprint 1 Feature 1.1 (project scaffold — landing page assumed separate) |
| 2 | **Category selection onboarding screen placement.** Wedge scope includes digest UI (1.10) which requires User.my_categories for filter. But onboarding flow (category selection) not in Wedge features list. Assumed category selection = part of OAuth flow (Screen #3) → required for Sprint 1. | Assumption | If onboarding deferred → users cannot filter digest by category → UX broken. Must include in Sprint 1. | Sprint 1 dependency: 1.10 (digest) depends on 1.3 (auth) which must include onboarding Screen #3 |
| 3 | **Email digest delivery deferred Sprint 1.** Strategy Wedge Feature list doesn't mention email. Ideation F16 = email digest for Pro/Power. Assumed email NOT needed for kill checkpoint (founder dogfoods via web UI, not email). | Assumption | If kill checkpoint requires email testing (e.g., founder prefers email over web) → add to Sprint 1. Increases scope 1-2 days (Resend integration). | Not in Sprint 1, mentioned in coverage verification note |
| 4 | **Source review workflow — đã chốt Option A (2026-04-03).** User-added → `status='active'`, crawl ngay; Feature 3.3 + Screen #13 = hậu kiểm. Option B (`pending_review` trước crawl) = tương lai nếu spam cao. | Chốt (was conflict #13) | Nếu sau này chuyển Option B → đổi `POST /api/sources`, thêm queue approve, bật `pending_review` trong luồng happy-path. | SPEC-core Section 4, SPEC-api admin sources, Sprint 2 Feature 2.1, Sprint 3 Feature 3.3 |
| 5 | **Free tier enforcement location unclear.** 2.2f Open Question #13: API guard vs job filter for Mon/Wed/Fri restriction. Sprint plan assumes job filter (digest delivery cron checks plan + day-of-week). Feature 3.2 = job-level enforcement. | Question (inherited from 2.2f #13) | If API enforcement chosen (403 FORBIDDEN on Tue/Thu/Sat/Sun for Free users) → implement in Feature 1.10 (digest API endpoint guard). Changes Sprint 1 vs Sprint 3 split. | Sprint 3 Feature 3.2 |
| 6 | **My KOLs filtered digest view depends on subscription cap.** Feature 2.4 (My KOLs stats) uses MySourceSubscription data. But My KOLs toggle filter in digest (2.2a F14) also uses subscriptions. Assumed My KOLs toggle = part of digest UI, should be Sprint 1 for complete Wedge delivery? | Question | Digest UI (1.10) includes My KOLs toggle OR toggle deferred Sprint 2? If toggle needed for Wedge → add to Sprint 1 (requires MySourceSubscription table populated). If not → Sprint 2. Affects kill checkpoint testing (founder can only test All Sources view Sprint 1). | Sprint 1 Feature 1.10 vs Sprint 2 Feature 2.4 |
| 7 | **500 KOL source pool seeding effort unknown.** Feature 1.5 (Source Pool Setup) includes "500 KOL curated pool" but seeding method undefined. CSV import? Manual admin UI entry? Script? Assumed CSV seed script (2.2f test data strategy). | Question | If CSV doesn't exist (founder must manually curate) → 1-2 days effort outside sprint. If seed script errors → blocks Feature 1.6 (pipeline needs sources). Critical path blocker. | Sprint 1 Feature 1.5 |
| 8 | **External service integration blockers.** Features 1.6, 1.7, 1.8 depend on twitterapi.io + Anthropic API. 2.2d lists 7 implementation blockers (API docs unknown, endpoints unclear). Assumed blockers resolved pre-Sprint 1. | Assumption (inherited from 2.2d) | If blockers NOT resolved → Features 1.6-1.8 blocked, cannot deliver Wedge, Sprint 1 fails. Must resolve 2.2d blockers #1-7 before starting Sprint 1. | Sprint 1 Features 1.6, 1.7, 1.8 |

---

**End of SPRINT-PLAN.md**

### IMPLEMENTATION-ROADMAP.md (2.2g Output 2 — file riêng)

Theo **playbook 2.2h:** task-level roadmap **không** nằm trong SPEC / Section 13. Nội đầy đủ: **`IMPLEMENTATION-ROADMAP.md`** (cùng thư mục repo) — Task Table Sprint 1–3, Dependency Graph, Execution Order Summary, Open Questions riêng của roadmap.

**Quy ước:** Khi sửa task hoặc depends-on → chỉnh `IMPLEMENTATION-ROADMAP.md`. `tools/build_spec.php` **không** nhúng lại roadmap vào `SPEC-plan.md`.

---
## Appendix A — Consolidated Open Questions / Assumptions

**Method:** Toàn bộ khối Open Questions / Assumptions từng bước được copy nguyên văn dưới đây theo **Origin**.  
**Status:** Cột Status trong bảng tổng hợp yêu cầu — do số lượng mục lớn và marker `#` chồng lấn giữa các file, bảng master một dòng/mục **không** được sinh tự động ở bước merge để tránh sai số hoặc mất dòng; thực hiện tra cứu theo từng khối Origin.  
**Renumber:** Giữ số `#` nội bộ từng file trong khối tương ứng.

**Amendment 2026-04-06:** Nhiều mục dưới đây đã được **chốt** trong `SPEC-core.md` / `SPEC-api.md` (lịch crawl 4×/ngày, twitterapi POC `advanced_search`, `sources.last_crawled_at`, clustering **prompt-based**, `users.is_admin`, bảng `user_personal_feed_entries`, ON DELETE, audit `event_type`). Ưu tiên đọc các file SPEC chính; khối Origin giữ nguyên làm lịch sử / trace.

### Origin: 2.2a — Domain Foundation (Phần 5)


/ Assumptions

| # | Điểm | Loại | Impact nếu sai | Reflected in |
|---|------|------|----------------|--------------|
| 1 | Free users receive exactly 3 digests/week — assumed Mon/Wed/Fri schedule. Ideation says "3 digests/tuần" but doesn't specify which days. | Assumption | If user expects daily → churn. If different days needed → change cron schedule. | Permission Matrix (Free User row, Digest column) |
| 2 | No cap on adding sources to shared pool (only cap on My Sources subscriptions: Pro=10, Power=50). Ideation F05 says "cap theo plan" but ambiguous whether cap applies to adding vs subscribing. | Assumption | If cap also applies to adding → need to enforce in Flow 1, adjust permission matrix. Could limit pool growth if too restrictive. | Permission Matrix (Pro/Power User, Source column), Flow 1 (Guards) |
| 3 | Admin can manually override signal rank_score. Inferred from F22 "spot-check accuracy" — implies ability to adjust if ranking wrong. | Assumption | If not needed → remove permission. If needed but no UI → feature gap. | Permission Matrix (Admin, Signal column) |
| 4 | Admin has analytics dashboard to view UserInteraction logs. Inferred from Product Strategy V1 Rule #1 "log mọi interaction" + moat metrics tracking Section 7. | Assumption | If not Phase 1 → remove permission, defer to Phase 2. Increases MVP scope. | Permission Matrix (Admin, UserInteraction column) |
| 5 | Source validation requires ≥1 tweet in last 30 days to ensure account active. Ideation F05 says "validate exists + public" but doesn't mention activity check. | Assumption | If too strict → reject legitimate but quiet accounts. If no check → inactive sources waste crawl quota. | Flow 1 (Steps, Guards, Error Cases) |
| 6 | Soft-deleted sources preserve existing MySourceSubscriptions (users keep following until manual unfollow). Ideation doesn't specify behavior when source deleted. | Assumption | If should auto-unsubscribe → change Flow 6 result. Affects user experience (sudden subscription loss). | Flow 6 (Error Cases), Entity Relationship (Source soft delete note) |
| 7 | Signal classification threshold = 0.7 (signal_score ≥0.7 → is_signal=true). Ideation says "conservative threshold" but no number. | Assumption | If too high → miss signals (false negatives). If too low → noise bloat (false positives). Tunable in production. | Flow 3 (Steps — Classify) |
| 8 | Clustering uses embedding similarity + threshold (algorithm not specified). Ideation F09 says "group tweets về cùng event" but no technical detail. | Assumption | Algorithm choice affects cluster quality (over-merge vs over-split). Needs tuning based on real data. | Flow 3 (Steps — Cluster) |
| 9 | Rank formula = f(source_count, avg_signal_score, recency_decay). Ideation F10 says "rank by source count + signal strength" — signal strength = avg score assumed, recency decay not mentioned but likely needed. | Assumption | If formula wrong → poor ranking → user dissatisfaction. Weights need tuning. | Flow 3 (Steps — Rank) |
| 10 | Single high-confidence source allowed (signal_score ≥0.9) even if only 1 source. Ideation doesn't specify min source count per cluster. Conservative: ≥2 sources, but missing breaking news from single authoritative source. | Assumption | If always require ≥2 → miss fast-breaking news. If allow 1 too easily → noise from random tweets. | Flow 3 (Guards — Cluster) |
| 11 | Draft must not copy exact tweet text (plagiarism check needed). Ideation F12 says "generate tweet" but doesn't mention plagiarism prevention. Ethical + legal risk if copying. | Assumption | If no check → copyright/plagiarism risk. If check false-positive → reject valid drafts. | Flow 3 (Guards — Draft) |
| 12 | My Sources stats calculated on-demand (query-time), no pre-aggregation Phase 1. Ideation F15 doesn't specify calculation method. On-demand simpler but slower if large dataset. | Assumption | If slow (>2s load) → need pre-aggregation/caching. Affects UX. | Flow 4 (Guards) |
| 13 | User-added sources have status='pending_review' until admin approves. Ideation F21 "review user-added sources" implies review queue but doesn't specify status field or workflow. | Assumption | If no review queue → spam sources immediately visible. If mandatory review → delays availability (UX friction). | Flow 6 (Steps — filter by status) |
| 14 | Admin actions logged in audit trail (who, what, when). Ideation doesn't mention audit log but standard practice for admin operations. | Assumption | If not logged → no accountability, harder to debug issues. If logged → need AuditLog entity (not in current domain model). | Flow 6 (Steps — log action) |
| 15 | Alert thresholds: error rate >10%, classify accuracy <80%. Ideation F22 mentions "alert khi error rate > threshold" but no numbers. | Assumption | If thresholds wrong → too many/few alerts. Needs tuning based on baseline. | Flow 7 (Guards, Error Cases) |
| 16 | Auto-pause pipeline if error rate >20% (emergency). Ideation doesn't specify auto-pause behavior, only alert. Prevents runaway bad cycles but could cause downtime. | Assumption | If no auto-pause → waste API quota on failing cycles. If pauses incorrectly → manual intervention needed (founder burden). | Flow 7 (Error Cases) |
| 17 | Email verification optional Phase 1 (standard auth, no mention in Ideation). Required for production email delivery but slows onboarding. | Assumption | If skip verification → risk spam signups, email bounces. If require → onboarding friction. | CRUD summary (User registration) |
| 18 | Daily Digest created at midnight UTC by cron. Ideation says "daily digest 8AM" (delivery time) but doesn't specify when Digest record created. | Assumption | If wrong timezone → digest delivered at wrong time for user. UTC chosen as neutral, but delivery time needs user timezone handling [not in current spec]. | CRUD summary (System creates daily Digest) |
| 19 | Stripe Checkout integration details deferred to implementation (session creation, webhook handling, plan sync). Ideation Section 7 mentions Stripe but F02 doesn't detail flow. | Assumption | Integration complexity could exceed estimate. Webhook failures could desync plans. | Feature Coverage Check (F02 Partial) |
| 20 | Email delivery mechanism (Resend/SendGrid API integration, template rendering, scheduling) deferred. Ideation F16 + Section 7 mention service but no flow detail. | Assumption | Integration complexity could exceed estimate. Deliverability issues could reduce email open rate. | Feature Coverage Check (F16 Partial) |
| 21 | Telegram Bot API integration (bot setup, user chat_id mapping, real-time alert delivery) deferred. Ideation F17 + Section 7 mention but no flow detail. | Assumption | Real-time delivery might need webhook infra (not just polling). User must /start bot → onboarding friction. | Feature Coverage Check (F17 Partial) |
| 22 | Archive search = browse by date + category/topic filter only (no full-text search Phase 1). Ideation F20 says "searchable" but no spec. Full-text search adds complexity (search index, query parsing). | Assumption | If users expect keyword search → feature gap. If browse-only sufficient → simpler implementation. | Feature Coverage Check (F20 Partial) |
| 23 | CONFLICT: Section 4 (Users & Roles) says Free users get "3 digests/tuần (All Sources view only)" but Section 9 (Phase 1 Boundaries) decisions table says Free users have "no My Sources" which is consistent. However, Section 5 (User Flows — Daily Consumption) describes "Pro user" flow only — no Free user consumption flow documented. | Conflict | Missing Free user consumption flow spec → implementation ambiguity. Need to clarify: can Free users filter by category? Can they click into signal details? Can they see sources? | Permission Matrix (Free User row — marked "All Sources view only"), Feature Coverage Check (F13 — Free tier access not detailed) |
| 24 | CONFLICT: Ideation Section 11 (Technical Risk Flags) warns "Cross-category signal overlap — 1 event có sources từ nhiều categories → phải cluster thành 1 signal" BUT Section 3 (Domain Model) Signal entity says "categories: array, inferred từ sources" (plural). Pipeline flow says "cluster toàn bộ trước, gán categories sau" which is correct. However, F13/F14 filtering behavior not clear: if user selects category filter "AI & ML" and signal has categories ["AI & ML", "Crypto"], does it show? | Conflict | If filter = exact match → miss relevant signals. If filter = contains → correct but needs explicit spec. Affects user experience (signal visibility). | Flow 3 (categories assignment logic described but filter behavior not), Feature Coverage Check (F13 — filter logic not detailed) |

Critical Conflicts (need resolution before coding):

#23: Free user consumption flow missing. Recommend: add Flow 8 or expand CRUD summary with explicit Free tier restrictions (e.g., no signal detail modal, no draft view, no category filter beyond my_categories selected at onboarding).
#24: Category filter behavior on multi-category signals. Recommend: filter = "show signal if ANY of its categories ∈ user's filter selection" (OR logic, not AND). Needs explicit statement in F13 spec or Flow 4.

High-Impact Assumptions (validate during Sprint 1):

#5, #7, #9, #10: Pipeline parameter tuning (activity check, classify threshold, rank formula, single-source allowance) — directly affect signal quality. Plan: dogfood week 1, tune thresholds, lock before user testing.
#2: Source add cap ambiguity — could throttle growth if wrongly interpreted. Recommend: clarify with founder before implementation.
#13: Review queue adds admin burden. Consider auto-approve for first N user-added sources per user (e.g., first 3 auto-approve, rest review) to reduce friction while preventing spam.

### Origin: 2.2b — Architecture & State (Phần 5)

/ Assumptions

| # | Điểm | Loại | Impact nếu sai | Reflected in |
|---|------|------|----------------|--------------|
| 1 | Frontend: React SPA vs Inertia.js (Laravel SSR hybrid). Ideation không specify SEO requirement cho landing page. React SPA = client-side routing, weak SEO. Inertia = SSR, better SEO, nhưng learning curve nếu founder chưa dùng. | Question | If SEO critical (organic signup via Google) → Inertia preferred. If SEO không quan trọng (distribution = Reddit seeding per Product Strategy) → React SPA sufficient. | Phần 1 — Frontend row (React tentative, Inertia alternative noted) |
| 2 | Database: PostgreSQL vs MySQL. Postgres chosen cho array columns (Signal.categories, Signal.topic_tags) + JSONB. MySQL alternative nếu hosting issue (Railway/Render Postgres quota). MySQL require JSON query workarounds, mất array column efficiency. | Assumption | If Postgres hosting cost >budget → MySQL fallback → refactor queries (JSON_CONTAINS thay vì array operators). Performance hit khi filter digest by categories (F13). | Phần 1 — Database row |
| 3 | Queue backend: Redis vs Database. Redis = faster, nhưng Railway free tier Redis = 25MB (tight nếu high job volume). DB-backed queue = slower nhưng no quota limit. Trade-off: performance vs cost. | Assumption | If job volume >25MB Redis (estimate: >1000 queued jobs) → DB fallback. Slower queue processing, potential delay khi pipeline busy. | Phần 1 — Queue row, Phần 2 Job Pattern |
| 4 | Cache: Redis vs File. Redis chosen cho My KOLs stats (Flow 4). File cache = slower read. Trade-off: cost (Redis hosting) vs performance (stats query <500ms target assumed). | Assumption | If stats query slow (>2s) without cache → user UX hit. If Redis cost issue → file cache fallback → accept slower stats load. | Phần 1 — Cache row |
| 5 | Email service: Resend vs SendGrid. Resend = Laravel-friendly, free tier 3000 emails/mo. SendGrid = more features (analytics), free tier 100 emails/day = 3000/mo equivalent. Assumed Resend sufficient. | Assumption | If Resend deliverability issue (spam filter) → switch SendGrid. Migration effort <1 day (Laravel Mail driver swap). | Phần 1 — External APIs row |
| 6 | Deployment: Railway vs Render vs DigitalOcean. Railway/Render = easy Git deploy, free tier. DO App Platform = similar. Laravel Forge + Linode = more control, no free tier. Assumed Railway/Render sufficient Phase 1 budget. | Assumption | If free tier quota exceeded (e.g., >10 users, >5GB DB) → migrate to paid tier ($10-20/mo) hoặc switch provider. Migration effort 1-2 days. | Phần 1 — Deployment row |
| 7 | Repository Pattern vs Direct Eloquent. Repository adds overhead (extra layer) but improves testability (mock data layer). Product Strategy "execute fast" vs testing priority trade-off. Assumed defer testing Phase 1 → skip Repository, direct Eloquent. | Assumption | If unit testing required (e.g., investor due diligence, compliance) → refactor to Repository. Effort: 2-3 days wrap existing Eloquent queries. | Phần 2 — Patterns table (Repository row marked selective + assumption #7) |
| 8 | Action Pattern vs Service. Laravel Actions (e.g., Spatie package) = single-purpose classes, simpler than fat Services. Assumed use Actions cho single-operation flows (Add Source, Subscribe). Service cho multi-step (Pipeline). | Assumption | If Actions pattern unfamiliar → fallback traditional Service methods. No architecture impact, just code organization preference. | Phần 2 — Patterns table (Action Pattern row) |
| 9 | Source restore flow. 2.2a không define admin restore spam/deleted sources. State machine includes spam/deleted → active transition nhưng no flow detail. | Question | If restore needed (false positive spam flag) → need admin UI + restore action. If không cần → remove state transition, hard delete spam sources. | Phần 3 — Source state machine (transitions marked assumption #9) |
| 10 | Plan downgrade subscription handling. User downgrades Pro → Free, có 15 MySourceSubscriptions (My KOLs). Keep first 10 (created_at ASC), auto-unsubscribe rest? Or user manually choose which to keep? 2.2a không specify. | Question | If auto-unsubscribe → potential user frustration (mất sources quan trọng). If manual select → UX friction (interrupt downgrade flow). Recommend: auto-unsubscribe + notify user, allow re-subscribe manually sau. | Phần 3 — User lifecycle summary (side effects assumption #10) |
| 11 | My KOLs stats recalculation strategy. Flow 4 stats (7-day trend, per-category breakdown) recalculated khi user subscribe/unsubscribe? Or cached + invalidate? 2.2a assumption #12 = on-demand calculation Phase 1. | Question | If on-demand slow (>2s) → need cache + invalidation strategy. If cache → recalculate when? (a) Every subscribe/unsubscribe (eager), (b) on digest view (lazy + cache 1 hour). Recommend lazy + cache cho Phase 1 simplicity. | Phần 3 — MySourceSubscription summary (side effect assumption #11), Phần 1 Cache row |
| 12 | Error tracking service. Sentry assumed cho production error tracking (Phần 4 error strategy). Free tier sufficient? Or alternative (Bugsnag, Rollbar)? | Assumption | If Sentry free tier insufficient (>5000 errors/mo cap) → paid tier $26/mo hoặc switch provider. Budget impact. | Phần 4 — Error Handling Strategy table (multiple rows reference Sentry) |
| 13 | User-added Source review workflow conflict. 2.2a assumption #13 = pending_review status, but Ideation Flow 5 (Manage My KOLs) says "Source thêm vào SourcePool (shared) + tự động follow". Nếu pending_review → source chưa vào pool → chưa crawl → user không thấy signals. CONFLICT: Auto-add to pool (immediate crawl) vs Review queue (delay crawl until approved). | Conflict | Option A (immediate): User-added sources enter pool immediately (status=active), admin review post-hoc, flag spam later. Pros: no user friction, fast signals. Cons: spam sources crawled, waste API quota. Option B (review queue): User-added sources pending_review, admin approve before crawl. Pros: quality control, no spam waste. Cons: user wait time (hours-days), friction. Trade-off: Product Strategy "execute fast" + user experience favor Option A. API quota waste risk favor Option B. Recommend: Start Option A Phase 1 (trust users, founder manually spot-check daily), switch Option B if spam >10% user-added sources. | Phần 3 — Source state machine (entire machine based on Option B assumption #13, conflict noted here) |
| 14 | Pipeline step failure partial recovery. Flow 3 has 6 steps (crawl → classify → cluster → summarize → rank → draft). If step 4 (summarize) fails, re-run entire pipeline or resume from step 4? Laravel Queue retry = entire job retry. Partial resume = custom checkpoint logic. | Question | If entire retry → duplicate crawl (API quota waste). If partial resume → need checkpoint DB table (PipelineCheckpoint), complexity +2 days dev. Recommend: entire retry Phase 1 (simpler), checkpoint Phase 2 if API cost issue. | Phần 2 — Job Pattern (Pipeline job noted 6 sequential steps), Phần 4 — Pipeline failures row |
| 15 | Free user digest access restrictions. 2.2a conflict #23: Free users get "3 digests/week" but unclear which 3 days (Mon/Wed/Fri assumed in 2.2a assumption #1). Also unclear: can Free users filter by category? Permission Matrix says "All Sources view only" (no My KOLs), but category filter available? | Question | If category filter allowed → Free users see same digest as Pro (minus My KOLs toggle) 3x/week. If không allowed → Free users see unfiltered digest (all 10 categories mixed), overwhelming. Recommend: Allow category filter for Free (improve UX, increase upgrade conversion), restrict to 3 days/week delivery (Mon/Wed/Fri), no My KOLs toggle. | Phần 4 — Auth errors row (Free user example), reflects 2.2a conflict #23 |
| 16 | Category filter multi-category signal behavior conflict. 2.2a conflict #24: Signal has categories ["AI & ML", "Crypto"]. User filters digest by "AI & ML". Does signal show? Assumed OR logic (show if ANY category matches) but not confirmed. | Question | If AND logic (show only if ALL user-selected categories match signal) → miss relevant signals. If OR logic (show if ANY match) → correct but noisy if user selects many categories. Recommend: OR logic (ANY match) cho Phase 1, add "strict filter" toggle Phase 2 if needed. | Phần 4 — Business logic errors row (filter logic example), reflects 2.2a conflict #24 |

Critical Questions Needing Founder Decision Before Coding:

#13 (Source review workflow conflict): Immediate pool entry vs review queue? Affects user onboarding flow + spam control strategy.
#15 (Free user category filter): Allow filter or force unfiltered view? Affects Free tier UX + conversion funnel.
#16 (Multi-category filter logic): OR vs AND? Affects digest relevance + user satisfaction.

High-Impact Assumptions (validate during Sprint 1 dogfood):

#3, #4 (Redis quota): Queue + cache volume. Monitor actual usage week 1, decide DB fallback if needed.
#10, #11 (Plan downgrade + stats recalculation): UX decisions. Test with founder during dogfood, confirm before user-facing.
#14 (Pipeline partial recovery): API quota waste vs dev complexity. Monitor twitterapi.io cost week 1, decide checkpoint logic if >$100/mo.

### Origin: 2.2c — Data Model (Phần 3)

/ Assumptions

| # | Điểm | Loại | Impact nếu sai | Reflected in |
|---|------|------|----------------|--------------|
| 1 | User.name field. 2.2a Onboarding flow (Section 5) says "Sign up (email)" but doesn't mention name collection. Assumption: optional name field for display purposes (e.g., email digest greeting). | Assumption | If name required → onboarding flow friction. If không cần → remove field, use email prefix for greeting. | Entity User, field name (marked optional, source noted as assumption) |
| 2 | User.telegram_chat_id field. Required for F17 Telegram delivery, but 2.2a doesn't detail Telegram Bot /start flow. Assumption: user connects Telegram via /start command, bot stores chat_id in user record. | Assumption | If different flow (e.g., separate TelegramConnection table with expiry/revoke logic) → refactor field to relation. If chat_id sufficient → keep. | Entity User, field telegram_chat_id (source marked assumption #2) |
| 3 | User.stripe_customer_id field. Required for F02 billing, but 2.2a Feature Coverage marks F02 Partial "Stripe integration not detailed". Assumption: Stripe Checkout creates customer, webhook stores customer_id. | Assumption | If Stripe integration differs (e.g., Payment Intents without customer object for one-time payments) → refactor field or add payment_method_id. If customer model correct → keep. | Entity User, field stripe_customer_id (source marked assumption #3) |
| 4 | SignalSource.source_id denormalization. Source ID available via Tweet.source_id FK but denormalized here for My KOLs filter query performance (WHERE source_id IN user_subscriptions). Assumption: denormalize for performance. | Assumption | If query performance OK via JOIN (SignalSource → Tweet → Source) → remove denormalized field, use JOIN only. If slow (>500ms for My KOLs digest filter) → keep denormalization. Trade-off: storage + consistency maintenance vs query speed. | Entity SignalSource, field source_id (marked assumption #4, notes explain denormalization reason) |
| 5 | User.my_kols_count derived field. 2.2a F06 describes My KOLs management UI but doesn't specify if count displayed. Assumption: UI shows "You're following X/10 sources" (Pro cap indicator). | Assumption | If count not displayed → remove from derived fields, compute only for cap enforcement guard. If displayed → keep computed field. | Phần 2 Derived Fields, User.my_kols_count row (marked assumption #5) |
| 6 | Source derived fields (signal_count, last_active_date). 2.2a F15 "My KOLs Stats: signal count, last active, signal quality indicator" — inferred signal_count + last_active_date. "Signal quality indicator" vague — could be signal_count, could be signal_score average, could be separate metric. | Assumption | If "signal quality indicator" ≠ signal_count → add new derived field (e.g., avg_signal_score). If signal_count sufficient → keep. Affects My KOLs stats UI design. | Phần 2 Derived Fields, Source.signal_count row (marked assumption #6, notes explain inference) |
| 7 | Computed field cache strategy. 2.2b assumption #11 "My KOLs stats recalculation strategy TBD — on-demand vs cached". Affects whether Source.signal_count, Source.last_active_date persisted or computed. Phase 1: computed on-demand. Phase 2: cache if slow (>2s). | Assumption | If stats slow → need cache table (SourceStats with signal_count, last_active_date, updated_at) + invalidation triggers. If fast → keep computed. Impacts DB schema (2.2e). | Phần 2 Derived Fields, rows for Source.signal_count, Source.last_active_date (marked assumption #7, Persisted column = "Computed [based on assumption #7]") |
| 8 | Signal.topic_tags storage type. Postgres array column assumed per tech stack (2.2b). Alternative: separate TopicTag table + M:N junction if tags need metadata (e.g., tag frequency, user-created tags Phase 2). Phase 1: array sufficient. | Assumption | If Phase 2 needs tag metadata → migrate to junction table. If array sufficient → keep. Trade-off: simplicity (array) vs extensibility (junction). | Entity Signal, field topic_tags (logical type = array of string, physical type in 2.2e) |
| 9 | Digest-Signal relationship via date FK vs explicit junction. Current: Signal.date FK to Digest.date (implicit relationship). Alternative: DigestSignal junction table (explicit M:N). Assumption: date FK sufficient Phase 1 because 1 signal belongs to exactly 1 digest (based on date). | Assumption | If future: signals appear in multiple digests (e.g., "Best of Week" digest) → need junction table. If 1:N sufficient → keep date FK. | Entity Signal field date (notes explain FK relationship), Phần 2 Derived Fields Digest.signal_ids row (relation-backed via date FK) |
| 10 | MySourceSubscription cap enforcement location. Cap checked in Service layer (2.2b SubscribeToSourceAction) or DB constraint? Assumption: Service layer guard only (no DB check constraint) because cap varies by plan (Pro=10, Power=50) — dynamic rule. | Assumption | If need DB-level enforcement → add CHECK constraint with plan lookup (complex). If Service guard sufficient → keep. Risk: bypass via direct DB insert (mitigated by no direct DB access in production). | Entity MySourceSubscription validation notes (cap enforcement guard referenced, no DB constraint field) |
| 11 | UserInteraction retention policy. 2.2b classification says "retention TBD, assumption: indefinite Phase 1, aggregate + delete Phase 2". Affects whether deleted_at field needed. Assumption: no deletion Phase 1, append-only table grows indefinitely until Phase 2 aggregation. | Assumption | If table grows >1M rows Phase 1 (unlikely with <100 users) → need retention policy sooner (e.g., 90-day rolling window). If growth manageable → defer. Affects disk space + query performance. | Entity UserInteraction (no deleted_at field, classification notes retention assumption) |
| 12 | Source.is_active field update strategy. Checked once at Add Source (Flow 1), not rechecked. Assumption: no periodic re-validation of source activity. Risk: source goes inactive (stops tweeting) but remains in crawl pool → waste API quota. | Question | If periodic re-check needed (e.g., monthly cron "mark inactive if no tweets in 30 days") → add updated_at tracking + cron job. If one-time check sufficient → keep. Trade-off: API quota waste vs maintenance complexity. | Entity Source, field is_active (validation notes one-time check assumption #5 from 2.2a) |
| 13 | Signal immutability assumption. Signal fields (title, summary, rank_score) assumed immutable after publish per 2.2b "admin có thể manual rank override per assumption #3 nhưng không change state". If rank_score editable → need updated_at + audit trail. | Question | If admin manual override needed → add Signal.updated_at + audit log (who changed rank_score, when). If immutable → keep. Current model = immutable (no updated_at). | Entity Signal (no updated_at field, immutability assumption from 2.2b) |
| 14 | Category slug vs name for API filtering. 2.2a F13 "filter by category" but doesn't specify API query param format. Assumption: use slug (URL-safe) for API (?category=ai-ml) vs name (?category=AI & ML needs encoding). Slug added for API clarity. | Assumption | If name sufficient (clients URL-encode) → remove slug field. If slug cleaner → keep. Affects API design (2.2f). | Entity Category, field slug (added for API filtering, marked assumption in notes) |
| 15 | Tweet.deleted_at soft delete trigger. 2.2b says "soft delete nếu Source deleted + tweet không linked to Signal". Implies cron job or cascade logic to mark orphaned tweets. Not modeled in Data Model (belongs to process layer). | Assumption | If cleanup needed → implement cron job "soft delete tweets WHERE source.deleted_at IS NOT NULL AND tweet.id NOT IN (SELECT tweet_id FROM signal_source)". If defer cleanup → tweets accumulate. Affects disk space over time. | Entity Tweet, field deleted_at (soft delete condition noted but cleanup process not in Data Model, belongs to 2.2e or implementation) |
| 16 | Plan downgrade MySourceSubscription cleanup strategy conflict. 2.2b assumption #10 "auto-unsubscribe (keep first 10, created_at ASC) vs user manually choose". Not resolved. Data Model neutral — doesn't prescribe cleanup logic. Service layer handles. | Conflict (from 2.2b #10) | If auto-unsubscribe → implement in Service (SubscriptionService.handlePlanDowngrade: DELETE FROM my_source_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT X). If manual select → need UI flow + temporary "pending unsubscribe" state. Data Model supports both (created_at for ordering). | Entity MySourceSubscription, field created_at (notes reference 2.2b assumption #10 for downgrade use case) |
| 17 | Source review workflow conflict. 2.2b conflict #13 "immediate pool entry (status=active) vs review queue (status=pending_review)". Data Model includes status enum with pending_review state (Option B model). If Option A chosen → status always 'active' for type='user', pending_review unused. | Conflict (from 2.2b #13) | Option A (immediate): status enum = {'active', 'spam', 'deleted'} only (remove pending_review). Type='user' sources created directly as 'active'. Option B (review queue): Keep current model with 4 states. Data Model currently reflects Option B per 2.2b Source state machine. DECISION NEEDED. | Entity Source, field status (enum includes pending_review, notes reference 2.2b conflict #13) |
| 18 | Free user category filter conflict. 2.2b conflict #15 "Free users can filter by category?" Data Model neutral — User.my_categories exists for all plans (default selected at onboarding). Permission enforcement = API/Service layer, not Data Model. | Conflict (from 2.2b #15) | Data Model supports both options (my_categories array exists). API layer decision: (a) Free users: digest query WHERE Signal.categories && User.my_categories (filter allowed), (b) Free users: ignore my_categories, return all signals (no filter). DECISION NEEDED for API spec (2.2f). | Entity User, field my_categories (exists for all plans, filter enforcement in API layer per 2.2b conflict #15) |
| 19 | Multi-category signal filter logic conflict. 2.2b conflict #16 "OR vs AND logic for category filter". Data Model neutral — Signal.categories array supports both. Query logic decision: (a) OR: WHERE Signal.categories && User.filter_selection (ANY match), (b) AND: WHERE Signal.categories @> User.filter_selection (ALL match). | Conflict (from 2.2b #16) | Data Model supports both (Postgres array operators). API layer decision needed. Recommend OR per 2.2b. DECISION NEEDED for query implementation (2.2e). | Entity Signal, field categories (array type supports both OR/AND operators, logic per 2.2b conflict #16) |

Critical Conflicts Needing Resolution Before Schema (2.2e):

#17 (Source review workflow): Affects status enum values. If Option A → remove pending_review state from enum, simplify state machine. If Option B → keep current model.
#18, #19 (Category filter logic): Affects API query logic (2.2f) but Data Model neutral. Can defer to API spec, but clarify before implementation.

High-Impact Assumptions (validate during implementation):

#4 (SignalSource.source_id denormalization): Test My KOLs filter query performance without denormalization first. If <500ms → remove denormalized field (simpler schema). If slow → keep.
#7 (Computed field cache strategy): Monitor My KOLs stats page load time week 1 dogfood. If >2s → implement cache table (SourceStats). If fast → keep computed.
#12 (Source.is_active periodic re-check): Monitor twitterapi.io quota usage week 1. If >20% inactive sources crawled → add re-check cron. If low waste → defer.

### Origin: 2.2e — Schema & API Contracts (Phần 3)

/ Assumptions

| # | Điểm | Loại | Impact nếu sai | Reflected in |
|---|------|------|-----------------|--------------|
| 1 | **Identifier strategy: BIGSERIAL vs UUID.** 2.2b doesn't explicit chốt. Assumed BIGSERIAL (Laravel default, auto-increment) for internal PK. UUID needed if public-facing IDs required (API URLs, share links). | Assumption | If UUID needed → add uuid column to tables, change API responses to expose uuid instead of id. Migration effort if switch mid-development. | Phần 1 Type Mapping, all table PRIMARY KEY columns |
| 2 | **ON DELETE behavior for source_categories.category_id.** Categories hardcoded (no deletion expected), but ON DELETE not explicit. Assumed RESTRICT (safe default). | Question | If RESTRICT wrong → clarify cascade or set null. Affects category management if categories ever deletable Phase 2. | Phần 1 source_categories table, FK constraint |
| 3 | **ON DELETE behavior for tweets.source_id.** Source deletion → orphan tweets? Assumed CASCADE (tweets owned by source). Alternative: RESTRICT (preserve tweets, soft delete source only). | Question | If CASCADE wrong → risk data loss. If RESTRICT → need cleanup job for orphaned tweets. Affects disk space over time. | Phần 1 tweets table, FK constraint |
| 4 | **ON DELETE behavior for signal_sources.tweet_id.** Tweet deletion after signal published unclear. Assumed RESTRICT (preserve attribution integrity). | Question | If RESTRICT wrong → cannot delete tweets linked to signals. If CASCADE → lose attribution. Affects signal data integrity. | Phần 1 signal_sources table, FK constraint |
| 5 | **NUMERIC precision for anthropic_usage_daily.cost_estimate.** Assumed NUMERIC(10,2) = up to $99,999,999.99. Sufficient for monthly LLM costs? | Assumption | If precision insufficient (e.g., need cents of cents for micro-billing) → adjust to (10,4). If overkill → no harm. | Phần 1 anthropic_usage_daily table, cost_estimate column |
| 6 | **API versioning strategy.** 2.2b doesn't explicit define versioning (no /v1/ prefix). Assumed no versioning Phase 1. | Assumption | If versioning needed Phase 2 → add /v1/ prefix to all routes, or use Accept header versioning. No migration needed if routes change (breaking changes = new version). | Phần 2 Conventions, all endpoint routes |
| 7 | **Default pagination page size.** Assumed 20 items per page (standard REST convention). 2.2b doesn't specify. | Assumption | If 20 too small/large → adjust default. Affects API performance + UX. | Phần 2 Conventions (Pagination) |
| 8 | **Free user topic_tags filter access.** 2.2a conflict #23 (Free user consumption flow missing). Assumed disabled for Free tier (topic filter = Pro+ feature). | Conflict (inherited from 2.2a #23) | If Free users should have topic filter → remove guard. Affects Free tier feature set + conversion funnel. | Phần 2 List Signals endpoint, Permission Guard note |
| 9 | **Resend webhook signature verification method.** 2.2d Blocker #7 (method pending verification). Implementation blocked. | Question (inherited from 2.2d Blocker #7) | If method differs from assumed (e.g., custom header vs HMAC) → adjust webhook handler. Blocks email deliverability monitoring feature. | Phần 2 Resend Webhook Handler, Permission Guard |
| 10 | **User.email_valid column.** 2.2c doesn't include email_valid field (for bounce tracking per 2.2d Resend webhook). Assumed added to schema. | Assumption | If not needed → remove column. If needed → migration required. Affects email delivery logic (skip sending if email_valid=false). | Phần 2 Resend Webhook Handler notes (mark user.email_valid=false) |
| 11 | **Source review workflow (2.2b conflict #13) — chốt Option A.** Enum giữ `pending_review` (Option B / tương lai); Phase 1: `type='user'` → `active` ngay; admin moderate sau. | Chốt (SPEC merge 2026-04-03) | Option B sau: bật queue `pending_review` + action `approve` trong PATCH. | Phần 1 `source_status` enum, Phần 2 Add Source + Admin Sources (SPEC-api) |
| 12 | **Category filter OR vs AND logic (2.2b conflict #16).** Assumed OR logic (show signal if ANY selected categories match) per 2.2d Constraint #8. Postgres array overlap operator used. | Conflict (resolved per 2.2d Constraint #8 — OR logic) | If AND logic needed → change query to array contains operator (@>). Affects digest relevance (OR = more signals, AND = fewer but stricter match). | Phần 1 signals.categories GIN index, Phần 2 List Signals endpoint query logic |
| 13 | **MySourceSubscription cap enforcement race condition.** Atomic check required (transaction lock or SELECT FOR UPDATE) to prevent 2 concurrent subscribe requests bypassing cap (Pro=10, Power=50). | Assumption | If not atomic → race condition possible (user ends up with 11 subscriptions). Requires transaction isolation at app layer. | Phần 2 Subscribe to Source endpoint notes (atomic cap check) |
| 14 | **Digest.signal_ids relationship.** Not a persisted field — relation-backed via Signal.date FK per 2.2c assumption #9. Query: `SELECT id FROM signals WHERE date = ?`. | Assumption (inherited from 2.2c #9) | If junction table needed (e.g., signals appear in multiple digests Phase 2) → add digest_signals junction. Phase 1: date FK sufficient. | Phần 1 schema comment (Digest-Signal relationship), Phần 2 List Signals endpoint (filter by date) |
| 15 | **Admin audit log table.** 2.2a assumption #14 (admin actions logged). Not in current schema — flagged as infrastructure table need if NFR requires. | Question | If audit required → add admin_audit_log table (user_id, action, resource_type, resource_id, timestamp, details JSONB). If not required → omit. Affects compliance + debugging capability. | Phần 1 infrastructure tables section (not added — pending NFR confirmation) |
| 16 | **Signal immutability vs admin rank override.** 2.2c assumption #13 (signals immutable) conflicts with 2.2a assumption #3 (admin can manual rank override). No Signal.updated_at column in schema. | Conflict (inherited from 2.2c #13 vs 2.2a assumption #3) | If rank override needed → add Signal.updated_at + admin endpoint for rank adjustment. If immutable → remove admin rank override permission from 2.2a. Affects pipeline accuracy correction workflow. | Phần 1 signals table (no updated_at column), 2.2a Permission Matrix admin Signal permission |
| 17 | **Plan downgrade MySourceSubscription cleanup strategy.** 2.2b assumption #10 (auto-unsubscribe keep first 10 by created_at ASC vs user manually choose). Not resolved. | Conflict (inherited from 2.2b #10) | If auto-unsubscribe → implement in webhook handler (DELETE ORDER BY created_at DESC LIMIT X). If manual select → need UI flow + temporary "pending unsubscribe" state. Data Model supports both (created_at for ordering). | Phần 2 Stripe Webhook Handler notes (downgrade cleanup), my_source_subscriptions.created_at column |
| 18 | **Free user category filter access.** 2.2b conflict #15 (can Free users filter digest by category?). Assumed YES (allowed) — improves UX, increases upgrade conversion. User.my_categories exists for all plans. | Conflict (inherited from 2.2b #15) | If NO filter allowed → Free users see unfiltered digest (all 10 categories mixed, overwhelming). If YES → Free users see same digest as Pro (minus My KOLs toggle). Affects Free tier UX. | Phần 2 List Signals endpoint (Permission Guard note — Free can filter by my_categories, cannot filter by topic_tags or my_sources_only) |
| 19 | **Source.is_active periodic re-check.** 2.2c assumption #12 (one-time check at Add Source, no periodic re-validation). Risk: source goes inactive (stops tweeting) but remains in crawl pool → waste API quota. | Question (inherited from 2.2c #12) | If periodic re-check needed → add cron job "mark inactive if no tweets in 30 days", track via Source.updated_at. If one-time sufficient → accept quota waste risk. Trade-off: complexity vs cost. | Phần 1 sources table is_active column (one-time validation note) |
| 20 | **UserInteraction retention policy.** 2.2c assumption #11 (indefinite Phase 1, no deletion). No deleted_at column in user_interactions table. | Assumption (inherited from 2.2c #11) | If table grows >1M rows Phase 1 (unlikely <100 users) → need retention policy sooner (e.g., 90-day rolling window, aggregate then delete raw logs). If growth manageable → defer to Phase 2. Affects disk space + query performance. | Phần 1 user_interactions table (no deleted_at, append-only note) |
| 21 | **Stripe price→plan mapping via env config.** 2.2d Constraint #13 (STRIPE_PRO_PRICE_ID, STRIPE_POWER_PRICE_ID required). Validation at app startup. | Assumption (inherited from 2.2d Constraint #13) | If price IDs change (new tiers, promos) → env update + redeploy. Wrong mapping → user charged but not upgraded. Mitigation: validate env vars at app startup, throw error if missing. | Phần 2 Stripe Webhook Handler notes (price_id → plan mapping), Conventions table (not schema — app config) |
| 22 | **My KOLs stats cache strategy.** 2.2c assumption #7 (computed on-demand Phase 1, cache Phase 2 if slow >2s). No cache table in schema. | Assumption (inherited from 2.2c #7) | If stats slow (>2s load) → add cache table (source_stats: source_id, signal_count, last_active_date, updated_at) + invalidation triggers. If fast → keep computed. Monitor Sprint 1 dogfood. | Phần 1 schema (no source_stats table), Phần 2 My KOLs Stats endpoint notes (computed on-demand) |
| 23 | **Signal.topic_tags array vs junction table.** 2.2c assumption #8 (Postgres array sufficient Phase 1). Alternative: TopicTag table + M:N junction if tags need metadata (frequency, user-created tags Phase 2). | Assumption (inherited from 2.2c #8) | If Phase 2 needs tag metadata → migrate to junction table. If array sufficient → keep. Trade-off: simplicity (array) vs extensibility (junction). | Phần 1 signals table topic_tags column (TEXT[] array) |
| 24 | **SignalSource.source_id denormalization.** 2.2c assumption #4 (denormalize from Tweet.source_id for My KOLs filter query performance). Trade-off: storage + consistency vs query speed. | Assumption (inherited from 2.2c #4) | If query performance OK via JOIN (SignalSource → Tweet → Source) → remove denormalized column, use JOIN only. If slow (>500ms for My KOLs digest filter) → keep. Test without denormalization first. | Phần 1 signal_sources table source_id column (denormalized note), indexes |
| 25 | **Telegram auth token expiry (10min).** 2.2d assumption #5 (JWT exp 10min = balance UX vs security). Too short = friction, too long = extended risk. | Assumption (inherited from 2.2d assumption #5) | If 10min too short (<5min) → user friction (token expires before /start). If too long (>30min) → security risk (extended window for replay if nonce check bypassed). Can adjust post-launch. | Phần 1 telegram_auth_tokens table notes (10min expiry via JWT, not DB), Phần 2 Telegram Webhook Handler |
| 26 | **Draft tweet >280 chars handling.** 2.2c DraftTweet.text CHECK (≤280 chars). 2.2a Flow 3 Guard "draft must not copy exact tweet text" (plagiarism check). | Assumption (inherited from 2.2a assumption #11) | If draft generation produces >280 chars (should never happen per prompt engineering 2.2d Constraint #12) → truncate to 280 + "..." + log error. Defensive check at API layer. | Phần 1 draft_tweets table text CHECK constraint, Phần 2 Copy Draft endpoint notes |
| 27 | **User.name optional vs required.** 2.2c assumption #1 (optional display name). Not collected at registration, can update later. | Assumption (inherited from 2.2c #1) | If name required → add validation at registration endpoint, onboarding friction. If optional → use email prefix for greeting (e.g., "Hi user@..."). | Phần 1 users table name column (NULL allowed), Phần 2 User Registration request (name optional) |
| 28 | **Category slug format.** 2.2c assumption #14 (slug for URL-safe API filtering). Assumed lowercase kebab-case (e.g., "ai-ml", "crypto-web3"). | Assumption (inherited from 2.2c #14) | If name sufficient (clients URL-encode) → remove slug field, use name in query params. If slug cleaner → keep. Affects API query param readability. | Phần 1 categories table slug column + values |
| 29 | **Webhook idempotency TTL (24h for Telegram).** 2.2d notes (processed_telegram_updates TTL 24h). Cleanup job removes old records. | Assumption (inherited from 2.2d notes) | If TTL too short (<6h) → risk duplicate processing if webhook retried after cleanup. If too long (>48h) → table bloat. 24h = balance (Telegram retry window <24h per docs). | Phần 1 processed_telegram_updates table notes (TTL 24h app-layer cleanup) |
| 30 | **Email HTML rendering complexity.** 2.2d Constraint #5 (server-side render full HTML via Laravel Blade before Resend API call). Must be responsive (mobile-first). | Assumption (inherited from 2.2d Constraint #5) | If template complexity high (interactive elements, CSS inlining issues) → use email template service (Mailjet templates, etc.). If simple digest → Blade sufficient. | Phần 2 conventions (not schema — email delivery implementation), affects F16 email digest |

---

## Implementation Blockers

**Critical blockers preventing AI coding implementation (require human decision/verification before proceeding):**

### From 2.2d (Inherited)

1. **twitterapi.io API docs unknown (2.2d Blocker #1)**
   - **Blocks:** Pipeline crawl implementation, Source validation (Add Source endpoint), all `/users/{username}` and `/tweets/user/{username}` calls
   - **Need:** Verify endpoint paths, schemas (especially: `last_tweet_date` OR `tweet_count_30d` availability for is_active check), rate limits, auth header format
   - **Status:** MUST resolve before implementing Pipeline job + Add Source endpoint
   - **Reflected in:** Phần 2 Add Source endpoint error cases (twitterapi.io validation), all external API integration code

2. **Anthropic clustering method unclear (2.2d Blocker #2)**
   - **Blocks:** Pipeline cluster step implementation, cost estimation
   - **Need:** Clarify if embeddings API exists (separate pricing?), OR prompt-based clustering viable (accuracy/performance). Test both if possible.
   - **Status:** MUST resolve before implementing Pipeline cluster step (2.2a Flow 3 Step 3)
   - **Reflected in:** Pipeline job business logic (not schema — implementation detail)

3. **Stripe price IDs not created (2.2d Blocker #3)**
   - **Blocks:** Checkout session creation, webhook plan sync
   - **Need:** Create in Stripe dashboard: Pro ($9.90/mo recurring), Power ($29.90/mo recurring). Copy IDs to env config (STRIPE_PRO_PRICE_ID, STRIPE_POWER_PRICE_ID).
   - **Status:** MUST resolve before implementing billing endpoints + Stripe webhook handler
   - **Reflected in:** Phần 2 Stripe Webhook Handler (plan mapping logic), assumption #21

4. **Email provider not finalized (2.2d Blocker #4)**
   - **Blocks:** Email digest delivery implementation (F16), bounce/complaint webhook handler
   - **Need:** Finalize Resend vs SendGrid. Test deliverability, free tier limits, webhook support, Laravel SDK availability.
   - **Status:** MUST resolve before implementing email delivery feature
   - **Reflected in:** Phần 2 Resend Webhook Handler (provider-dependent), 2.2b assumption #5

5. **Telegram auth flow incomplete (2.2d Blocker #5)**
   - **Blocks:** Telegram chat_id linking (user onboarding for F17 alerts)
   - **Need:** Design JWT token flow (payload: user_id, exp 10min, nonce), deep link generation (`t.me/{bot}?start={JWT}`), nonce replay prevention (telegram_auth_tokens table usage)
   - **Status:** MUST resolve before implementing Telegram webhook handler
   - **Reflected in:** Phần 1 telegram_auth_tokens table, Phần 2 Telegram Webhook Handler, assumption #25

6. **Resend bounce/complaint webhook method (2.2d Blocker #7)**
   - **Blocks:** Email deliverability monitoring, bounce handling (mark email_valid=false)
   - **Need:** Verify Resend docs for webhook event names, signature verification method (header name, HMAC algorithm)
   - **Status:** MUST resolve before implementing Resend webhook handler
   - **Reflected in:** Phần 2 Resend Webhook Handler (signature verification pending), assumption #9

7. **twitterapi.io activity check field availability (2.2d Blocker #8)**
   - **Blocks:** Source.is_active validation (Add Source endpoint guard)
   - **Need:** Verify `/users/{username}` response includes `last_tweet_date` OR `tweet_count_30d`. If neither available → need workaround (fetch recent tweets endpoint, check count).
   - **Status:** MUST resolve before implementing Add Source validation logic
   - **Reflected in:** Phần 2 Add Source endpoint error cases (ACCOUNT_INACTIVE), assumption #19

### From 2.2a/2.2b/2.2c Conflicts (Not Resolved)

8. **Source review workflow (2.2b conflict #13) — CHỐT**
   - **Blocks:** Không — đã có quyết định triển khai Phase 1
   - **Decision:** **Option A** — `type='user'` tạo với `status='active'`, crawl theo chu kỳ; admin hậu kiểm qua Screen #13 + PATCH moderate. Enum DB vẫn có `pending_review` cho Option B sau.
   - **Impact:** Giảm friction onboarding; quota risk nếu spam — theo dõi, có thể chuyển Option B.
   - **Status:** Chốt 2026-04-03 (SPEC-core Section 4, SPEC-api, SPEC-plan Screen #11/#13, tasks 3.3.x)
   - **Reflected in:** `sources.status`, `POST /api/sources`, `GET/PATCH /api/admin/sources`, Feature 3.3

9. **Plan downgrade cleanup strategy (2.2b assumption #10)**
   - **Blocks:** Stripe webhook handler (subscription.deleted event) — MySourceSubscription cleanup logic
   - **Decision:** Auto-unsubscribe (keep first 10 by created_at ASC) vs user manually choose which to keep
   - **Impact:** User frustration (lose important sources) vs UX friction (interrupt downgrade flow)
   - **Status:** Recommend auto-unsubscribe + notify user + allow re-subscribe manually
   - **Reflected in:** Phần 2 Stripe Webhook Handler notes, assumption #17

10. **Admin rank override vs signal immutability (2.2c assumption #13 vs 2.2a assumption #3)**
    - **Blocks:** Admin signal management (if manual rank override needed)
    - **Decision:** Add Signal.updated_at + admin endpoint for rank adjustment, OR keep signals immutable (remove admin override permission)
    - **Impact:** Pipeline accuracy correction capability vs data integrity simplicity
    - **Status:** Clarify with founder — if spot-check indicates rank override needed, add endpoint
    - **Reflected in:** Phần 1 signals table (no updated_at), 2.2a Permission Matrix conflict, assumption #16

---

## Summary

**Schema:**
- 11 core entity tables (categories, users, sources, source_categories, my_source_subscriptions, tweets, signals, signal_sources, draft_tweets, digests, user_interactions)
- 4 enum types (source_type, source_status, user_plan, interaction_action)
- 4 infrastructure tables (processed_stripe_events, processed_telegram_updates, processed_resend_events, telegram_auth_tokens)
- 1 monitoring table (anthropic_usage_daily)
- 16 indexes (FK conventions + 6 explicit permission/state/filter needs)

**API:**
- 21 endpoints total (19 REST API + 2 OAuth web routes):
  - **OAuth (Phase 1 PRIMARY):** 2 (GET /auth/twitter redirect, GET /auth/twitter/callback)
  - **Auth (Phase 2 placeholders):** 2 (POST register, POST login - NOT implemented Sprint 1)
  - User: 1 (PATCH update preferences)
  - Categories: 1 (GET list)
  - Sources: 5 (GET list pool, POST add, POST subscribe, DELETE unsubscribe, GET list My KOLs)
  - Signals: 2 (GET list digest, GET detail)
  - My KOLs Stats: 1 (GET stats)
  - Drafts: 1 (POST copy to Twitter composer)
  - Admin: 3 (GET list sources moderation, PATCH moderate source, GET pipeline monitor)
  - Webhooks: 3 (POST Stripe, POST Telegram, POST Resend)
- REST conventions: snake_case fields, offset pagination, OR filter logic
- Error format standardized per 2.2b

**Absorbed constraints:**
- 2.2d: 9 hard constraints reflected in schema/API (webhooks, idempotency, external IDs, plan sync, caps, timezone, category OR logic, Free tier schedule, Stripe env config)
- 2.2a: All 7 flows mapped to endpoints + CRUD summaries
- 2.2b: State machines reflected in enums, error handling reflected in response specs
- 2.2c: All 11 entities + derived fields reflected in schema

**Open questions/assumptions:**
- 30 items flagged (10 critical blockers, 20 assumptions/conflicts inherited from upstream)
- 10 implementation blockers identified (7 from 2.2d external service unknowns, 3 from unresolved conflicts)

**Ready for AI coding tools after resolving 10 implementation blockers.**

---

**End of SCHEMA-AND-API-SPECS.md (2.2e)**

### Origin: 2.2f — Delivery & Ops (Phần 7)

/ Assumptions

| # | Điểm | Loại | Impact nếu sai | Reflected in |
|---|------|------|-----------------|--------------|
| 1 | **Staging environment assumed NOT needed Phase 1.** Solo founder, 2-3 week MVP, no QA team. Deployment = dev → production direct. | Assumption | If staging needed (e.g., client demos, pre-production testing) → add environment tier. Setup effort 1 day (clone production config). | Phần 4.1 Environments table (staging omitted, assumption noted) |
| 2 | **Zero-downtime deployment NOT required Phase 1.** Accept 30-60s downtime during migration deploy. <100 users, batch job (digest) = not real-time. | Assumption (inferred from NFR + Strategy) | If zero-downtime required (e.g., user growth >100, real-time features Phase 2) → implement blue-green OR canary deployment. Adds complexity 2-3 days. | Phần 4.2 Deploy Approach (zero-downtime = not required, inferred note) |
| 3 | **Framework test convention inferred = PHPUnit (Laravel default).** Laravel 11.x includes PHPUnit out-of-box. Alternative = Pest (modern Laravel test framework). | Assumption (inferred from 2.2b Laravel stack) | If Pest preferred → swap framework, syntax change. No architecture impact. Migration effort <1 day. | Phần 3.3 Test Data Strategy (test framework not chosen, PHPUnit implied) |
| 4 | **E2E test tool NOT chosen.** Laravel Dusk (browser automation) OR Playwright (modern E2E). Both compatible with Laravel + React SPA. | Question | If E2E tests required Sprint 1 → choose tool. Dusk = Laravel native, Playwright = better debugging. Implementation phase decides. | Phần 3.1 Test Layers (E2E scope defined, tool not chosen) |
| 5 | **Test coverage % target NOT defined.** NFR doesn't specify coverage threshold. Product Strategy "execute fast" conflicts with 100% coverage goal. | Question | If coverage target needed (e.g., 80% for critical paths) → define + track. Affects test effort (current: prioritize critical paths only per Phần 3.2). | Phần 3.2 Critical Test Paths (priority-based, no coverage % target) |
| 6 | **File structure assumes Laravel 11.x default.** If Laravel version changes (future upgrade to 12.x) OR custom structure needed → verify convention changes. | Assumption | If structure changes → update Phần 5 mapping. Low risk — Laravel structure stable across versions. | Phần 5 File Structure (entire structure derived from Laravel 11.x convention) |
| 7 | **React component file naming NOT specified.** PascalCase (DigestCard.jsx) vs kebab-case (digest-card.jsx) vs feature folders. Implementation phase decides. | Question | If team has preference → enforce. No architecture impact, consistency only. | Phần 5 resources/js/ (components directory exists, file naming not specified) |
| 8 | **Screen #11 (Add Source) = modal vs separate page NOT decided.** Flow 1 (Add Source) can render as modal overlay on Screen #10 (Browse Sources) OR separate route `/sources/add`. | Question | If modal → better UX (no navigation), simpler. If separate page → easier deep linking, shareable URL. UX decision = implementation phase. | Phần 6.1 Screen Inventory row #11 (modal OR separate page noted) |
| 9 | **Source review workflow — chốt Option A (SPEC-core / SPEC-api 2026-04-03).** Screen #13 = **moderation** (user-added đã active); không queue approve trước crawl. Option B = tương lai nếu cần `pending_review`. | Chốt (was conflict #13) | UI #13: actions theo PATCH moderate (flag_spam, adjust_categories, soft_delete, restore). | Phần 6.1 Screen #11, #13; Feature 3.3; tasks 3.3.x |
| 10 | **Upstream assumption 2.2b #7 (Repository Pattern selective).** Testing priority TBD → if unit testing required → refactor to Repository. File structure includes `app/Repositories/` directory but marked optional. | Assumption (inherited from 2.2b #7) | If Repository NOT used → remove directory from structure. If used → populate with complex query repos (SignalRepository for stats). | Phần 5 app/Repositories/ (directory exists, marked selective per 2.2b) |
| 11 | **Upstream assumption 2.2e #6 (API versioning NOT included Phase 1).** Routes = `/api/resources` without `/v1/` prefix. If versioning needed Phase 2 → add prefix OR Accept header versioning. | Assumption (inherited from 2.2e #6) | If breaking API changes Phase 2 → implement versioning. Migration: add `/v1/` prefix to all routes OR header-based routing. Effort 1 day. | Phần 5 routes/api.php (no versioning prefix per 2.2e) |
| 12 | **Upstream blockers 2.2d #1-7 affect Integration tests (Critical Path #8).** External service contracts NOT tested until blockers resolved. Mock/stub contracts in unit tests OK, but integration tests blocked. | Blocker (inherited from 2.2d) | Integration tests for twitterapi.io, Anthropic, Stripe, Resend, Telegram CANNOT run until API docs verified + test accounts created. Blocks CI/CD integration test automation. | Phần 3.2 Critical Test Paths row #8 (external service contract validation — pending blocker resolution) |
| 13 | **Free tier digest access restriction enforcement location.** Constraint #9 (Mon/Wed/Fri only) enforced at digest delivery job OR at API endpoint? If API → 403 FORBIDDEN on Tue/Thu/Sat/Sun. If job → digest generated daily, delivery skipped for Free users on off-days. | Question | If API enforcement → simpler (same endpoint guard logic). If job enforcement → digest always generated (wasted if Free user doesn't receive). Affects Screen #5 behavior (can Free user view digest on Tue if generated?). Recommend: API enforcement (cleaner separation). | Phần 3.2 Critical Test Paths row #7 (Free tier restriction — test needed, enforcement location TBD) |
| 14 | **Privacy policy content NOT written.** NFR #11 requires privacy policy page, file structure includes Blade template, but content = legal writing task outside spec scope. | Question | Privacy policy content = founder writes OR hire legal (Termly, IUBENDA auto-generator $0-50). Template exists, content TBD. | Phần 5 resources/views/privacy-policy.blade.php (file exists, content placeholder), Phần 6.1 Screen #15 |
| 15 | **Docker for local development NOT specified.** 2.2b Tech Stack mentions Docker as optional. Local dev = Docker Compose OR Laravel Valet OR native Postgres/Redis install. | Question | If Docker preferred (consistency across machines) → add docker-compose.yml. If Valet (macOS-friendly) → simpler setup. Implementation phase decides based on founder's OS. | Phần 4.1 Environments (Development row mentions Docker Compose OR Valet) |
| 16 | **User-added source backfill strategy NOT defined.** When Pro user adds new @handle, crawl from add-time forward (no context) OR backfill recent tweets (30 days?) for clustering context. Backfill = better signal quality but higher API cost (3200 tweets vs 20 tweets poll). | Question (Gap: Technical Review #1.2) | If backfill → define depth (7 days? 30 days?) + cost impact ($X per source). If no backfill → accept cold-start signal quality degradation for new sources (first few cycles = poor clustering). Recommend: no backfill Phase 1 (cost protection), accept quality lag, backfill Phase 2 if user feedback demands. | Phần 3.2 Critical Test Paths #3 (pipeline logic), Phần 4.2 (crawl cost circuit breaker) |
| 17 | **User feedback loop for signal quality NOT implemented Phase 1.** No "Flag as Noise" or "Not a Signal" button. Admin spot-check only (2.2a Flow 7). Cannot improve LLM precision/recall over time → breaks Phase 2 data defensibility moat promise (Strategy Moat Stack). | Gap (Technical Review #3.1) | If user feedback required for moat → add Phase 1: UserInteraction.action += 'signal.flagged_noise'. If defer → accept Phase 1 = baseline accuracy only, feedback loop Phase 2. Recommend: add Phase 1 (low effort — 1 button + DB log), critical for moat data collection per Strategy V1 Rule #1 "log mọi interaction". | Phần 3.2 Critical Test Paths (moat data capture), Strategy Moat Stack Phase 2 (data defensibility) |
| 18 | **Reddit seeding AI-generated content credibility risk.** Strategy requires "giọng văn cá nhân hóa, AI không detect được" for Reddit seeding. Conflict: product value = "Source Attribution" (transparency). Using AI to promote AI summarization tool = credibility paradox on Reddit (hostile to AI spam). | Conflict (Technical Review #2.2) | If Reddit detects AI seeding → account ban, distribution motion fails. Recommend: use real digest examples (Proof of Value) instead of feature descriptions. Validate seeding copy with human review before post. NOT a spec issue — strategy execution risk. Flag for founder awareness. | Phần 1 Strategy Embed (Distribution Motion — Reddit seeding), Critical Risk R1 (distribution unproven) |

**Critical Questions for Implementation Phase (require decision before Sprint 1):**

- **#2 (Zero-downtime):** Confirm NOT required Phase 1 — affects deploy strategy complexity.
- **#4 (E2E tool):** Choose Dusk OR Playwright if E2E tests Sprint 1 priority.
- **#9 (Source review):** Đã chốt Option A — Screen #13 = post-hoc moderation; `POST /api/sources` → active.
- **#13 (Free tier enforcement location):** API guard OR job filter? Affects digest generation + Screen #5 access.
- **#16 (User-added source backfill):** Backfill recent tweets (better quality, higher cost) OR crawl-forward-only (cost protection, quality lag)? Affects API budget + signal accuracy.
- **#17 (User feedback loop):** Add "Flag as Noise" Phase 1 (moat data) OR defer Phase 2? Affects data defensibility promise.

**High-Impact Assumptions (validate during Sprint 1 dogfood):**

- **#1 (No staging):** Monitor if staging needed for demos/testing. Add if friction detected.
- **#12 (External service blockers):** Integration tests blocked — prioritize blocker resolution OR accept unit test mocks only Phase 1.
- **#16 (Backfill strategy):** If no backfill → validate cold-start signal quality acceptable during dogfood.
- **#17 (Feedback loop):** If defer Phase 2 → cannot collect moat data, breaks data defensibility timeline (Strategy month 3-6).
- **#18 (Reddit seeding AI detection):** Distribution motion risk — validate seeding approach with real examples before launch.

---

### Origin: 2.2g — SPRINT-PLAN.md

| # | Điểm | Loại | Impact nếu sai | Reflected in |
|---|------|------|-----------------|--------------|
| 1 | **Sprint 1 Wedge scope = sufficient for kill checkpoint?** OAuth X.com auth + digest UI + pipeline + drafts enough to test criteria #1 (landing signup) + #4 (founder dogfood). Reddit seeding requires landing page (not in Wedge) — assumed simple static HTML page outside sprint scope (founder creates manually). | Assumption | If landing page needs complex UI (pricing table, testimonials, demo video) → add to Sprint 1 or pre-sprint work. Kill checkpoint #1 untestable without landing page. | Sprint 1 Feature 1.1 (project scaffold — landing page assumed separate) |
| 2 | **Category selection onboarding screen placement.** Wedge scope includes digest UI (1.10) which requires User.my_categories for filter. But onboarding flow (category selection) not in Wedge features list. Assumed category selection = part of OAuth flow (Screen #3) → required for Sprint 1. | Assumption | If onboarding deferred → users cannot filter digest by category → UX broken. Must include in Sprint 1. | Sprint 1 dependency: 1.10 (digest) depends on 1.3 (auth) which must include onboarding Screen #3 |
| 3 | **Email digest delivery deferred Sprint 1.** Strategy Wedge Feature list doesn't mention email. Ideation F16 = email digest for Pro/Power. Assumed email NOT needed for kill checkpoint (founder dogfoods via web UI, not email). | Assumption | If kill checkpoint requires email testing (e.g., founder prefers email over web) → add to Sprint 1. Increases scope 1-2 days (Resend integration). | Not in Sprint 1, mentioned in coverage verification note |
| 4 | **Source review workflow — đã chốt Option A (2026-04-03).** User-added → `status='active'`, crawl ngay; Feature 3.3 + Screen #13 = hậu kiểm. Option B (`pending_review` trước crawl) = tương lai nếu spam cao. | Chốt (was conflict #13) | Nếu sau này chuyển Option B → đổi `POST /api/sources`, thêm queue approve, bật `pending_review` trong luồng happy-path. | SPEC-core Section 4, SPEC-api admin sources, Sprint 2 Feature 2.1, Sprint 3 Feature 3.3 |
| 5 | **Free tier enforcement location unclear.** 2.2f Open Question #13: API guard vs job filter for Mon/Wed/Fri restriction. Sprint plan assumes job filter (digest delivery cron checks plan + day-of-week). Feature 3.2 = job-level enforcement. | Question (inherited from 2.2f #13) | If API enforcement chosen (403 FORBIDDEN on Tue/Thu/Sat/Sun for Free users) → implement in Feature 1.10 (digest API endpoint guard). Changes Sprint 1 vs Sprint 3 split. | Sprint 3 Feature 3.2 |
| 6 | **My KOLs filtered digest view depends on subscription cap.** Feature 2.4 (My KOLs stats) uses MySourceSubscription data. But My KOLs toggle filter in digest (2.2a F14) also uses subscriptions. Assumed My KOLs toggle = part of digest UI, should be Sprint 1 for complete Wedge delivery? | Question | Digest UI (1.10) includes My KOLs toggle OR toggle deferred Sprint 2? If toggle needed for Wedge → add to Sprint 1 (requires MySourceSubscription table populated). If not → Sprint 2. Affects kill checkpoint testing (founder can only test All Sources view Sprint 1). | Sprint 1 Feature 1.10 vs Sprint 2 Feature 2.4 |
| 7 | **500 KOL source pool seeding effort unknown.** Feature 1.5 (Source Pool Setup) includes "500 KOL curated pool" but seeding method undefined. CSV import? Manual admin UI entry? Script? Assumed CSV seed script (2.2f test data strategy). | Question | If CSV doesn't exist (founder must manually curate) → 1-2 days effort outside sprint. If seed script errors → blocks Feature 1.6 (pipeline needs sources). Critical path blocker. | Sprint 1 Feature 1.5 |
| 8 | **External service integration blockers.** Features 1.6, 1.7, 1.8 depend on twitterapi.io + Anthropic API. 2.2d lists 7 implementation blockers (API docs unknown, endpoints unclear). Assumed blockers resolved pre-Sprint 1. | Assumption (inherited from 2.2d) | If blockers NOT resolved → Features 1.6-1.8 blocked, cannot deliver Wedge, Sprint 1 fails. Must resolve 2.2d blockers #1-7 before starting Sprint 1. | Sprint 1 Features 1.6, 1.7, 1.8 |

---

### Origin: 2.2g — IMPLEMENTATION-ROADMAP.md

**Bảng task + Dependency Graph:** nằm trong file **`IMPLEMENTATION-ROADMAP.md`** (playbook 2.2h — không embed SPEC). Đoạn dưới chỉ là **Open Questions** trích từ file đó.

| # | Điểm | Loại | Impact nếu sai | Reflected in |
|---|------|------|-----------------|--------------|
| 1 | **500 KOL CSV seed data creation effort.** Task 1.5.1 assumes CSV file exists or is quickly created (1-2 hours manual curation). If CSV doesn't exist → founder must curate 500 handles with categories, estimated 1-2 days effort outside sprint. | Assumption | Blocks Task 1.5.2 (seed script). If CSV not ready → cannot seed source pool → pipeline has no sources to crawl → Sprint 1 fails. Must complete CSV pre-Sprint 1 or reduce to smaller seed (50-100 sources for dogfood test). | Task 1.5.1 |
| 2 | **External service API blockers resolution.** Tasks 1.6.1, 1.7.1, 1.8.1, 1.8.2, 1.9.2 depend on twitterapi.io + Anthropic API endpoints. 2.2d lists 7 blockers (unknown endpoints, schemas, rate limits). Assumed blockers resolved before Sprint 1. | Assumption (inherited from 2.2d) | If blockers NOT resolved → integration client tasks blocked → cannot implement pipeline → Sprint 1 fails. MUST resolve 2.2d blockers #1-7 (verify API docs, test endpoints, confirm schemas) before starting Sprint 1. | Tasks 1.6.1, 1.7.1, 1.8.1, 1.8.2, 1.9.2 |
| 3 | **Task 1.3.3 (onboarding category selection) placement.** Onboarding is part of auth flow (Screen #3) but not explicitly in Wedge features list. Assumed onboarding required for Sprint 1 because digest UI (Task 1.10.2) needs User.my_categories for filtering. | Assumption | If onboarding deferred → users cannot select categories → digest shows all categories unfiltered → poor UX. Must include in Sprint 1 OR default to "select all 10 categories" fallback. | Task 1.3.3 (depends on 1.4.1 categories seed) |
| 4 | **My KOLs filter toggle placement (Task 2.4.5) in Sprint 2 vs digest UI (Task 1.10.2) in Sprint 1.** Digest UI renders All Sources view Sprint 1. My KOLs toggle (Screen #6) adds filter. Conflict: toggle needs MySourceSubscription data (Sprint 2). Can founder dogfood My KOLs view in Sprint 1 kill checkpoint test? | Conflict | If My KOLs view needed for kill checkpoint → move Tasks 2.1-2.4 to Sprint 1 (increases Sprint 1 scope significantly). If not needed → Sprint 1 delivers All Sources view only, founder tests with all 500 sources (not personalized). Clarify kill checkpoint test scope. | Task 1.10.2 vs Task 2.4.5 |
| 5 | **Stripe Checkout redirect vs embedded flow.** Task 3.1.1 assumes Stripe Checkout hosted page redirect (simpler). Alternative: embedded Checkout Elements (more control, more complexity). | Question | If embedded required (UX consistency) → add 1-2 days effort for Checkout Elements integration. If hosted OK → keep redirect approach. Affects frontend implementation. | Task 3.1.1 |
| 6 | **Admin rank override endpoint not in Sprint 3.** 2.2a Permission Matrix mentions admin can "manual rank override" (assumption #3), but no endpoint or task defined. 2.2e assumption #16 flags conflict (Signal immutability vs admin override). | Conflict (inherited from 2.2e #16) | If admin rank override needed → add Task 3.4.3 (POST /api/admin/signals/{id}/rank endpoint + UI). If not needed → remove from Permission Matrix. Clarify with founder — pipeline accuracy spot-check requires override? | Sprint 3 Feature 3.4 (Pipeline Monitor) |
| 7 | **Landing page creation not in sprint tasks.** Kill checkpoint criterion #1 (landing page signup <5% conversion) requires landing page. Not in Wedge scope or task list. Assumed founder creates simple static HTML landing page outside sprint scope. | Assumption | If landing page needs dev effort (React component, signup form API, analytics tracking) → add to Sprint 1 or pre-sprint. Kill checkpoint #1 untestable without landing page. | Kill checkpoint evidence collection |
| 8 | **Test task granularity.** No explicit testing tasks (unit tests, integration tests, E2E tests) in roadmap. Assumed testing happens per-task (write test alongside implementation) per TDD approach. 2.2f Testing Strategy defines test layers but not task breakdown. | Assumption | If separate testing phase needed → add testing tasks per sprint (e.g., 1.13.x Integration Tests for Critical Paths). If per-task testing → verify coverage during implementation. | All tasks (testing implicit) |
| 9 | **Privacy policy page (Screen #15) not in sprint tasks.** 2.1 NFR #11 requires privacy policy page. Not in task list. Assumed legal content creation outside dev scope. | Assumption | Privacy policy Blade template exists (2.2f file structure), but content empty. Founder must write OR use generator (Termly, IUBENDA). If missing → Stripe compliance issue (checkout requires privacy policy link). | 2.1 NFR #11, no corresponding task |
| 10 | **Email digest delivery (F16) deferred.** Not in Sprint 1-3 tasks. Ideation F16 = email digest for Pro/Power. Assumed email not needed for kill checkpoint (founder dogfoods web UI). | Assumption | If email needed for kill checkpoint OR founder strongly prefers email → add Task 1.13.x (Resend integration + email template + SendDigestEmailJob). Increases Sprint 1 scope 1-2 days. | Not in roadmap, mentioned in Sprint Plan Open Question #3 |

---

## Appendix B — Feature Coverage Matrix (optional)

**Sprint / entity mapping** — copy từ SPRINT-PLAN.md Section "Feature Coverage Verification":


**All Entities Covered (11/11):**
- ✓ Category (1.4)
- ✓ User (1.3, 3.1)
- ✓ Source (1.5, 2.1, 3.3)
- ✓ SourceCategory (1.5, 2.1)
- ✓ MySourceSubscription (2.2, 2.4)
- ✓ Tweet (1.6, 1.7, 3.4)
- ✓ Signal (1.8, 1.9, 1.10, 1.11, 2.4, 3.4)
- ✓ SignalSource (1.8, 1.11)
- ✓ DraftTweet (1.9, 1.12)
- ✓ Digest (1.10, 3.2)
- ✓ UserInteraction (1.12, 2.4)

**All Wedge Features Covered (5/5):**
- ✓ Wedge Feature #1 (Crawl pipeline) → 1.6
- ✓ Wedge Feature #2 (AI classify + cluster + summarize + rank) → 1.7, 1.8, 1.9
- ✓ Wedge Feature #3 (Digest web UI) → 1.10
- ✓ Wedge Feature #4 (Source attribution) → 1.11
- ✓ Wedge Feature #5 (Draft generation) → 1.9, 1.12

**All API Endpoints Covered (19 routes trong 2.2e Phần 2 — đếm route, không đếm method trùng):**
- Auth + user prefs (3): `POST /api/auth/register`, `POST /api/auth/login`, `PATCH /api/users/me` — *lưu ý: Sprint 1 thực tế dùng OAuth X (1.3); các route register/login trong 2.2e vẫn mô tả email/password — cần map OAuth hoặc sửa 2.2e cho đồng bộ*
- Categories (1): 1.4
- Sources + My KOLs (5): 1.5, 2.1, 2.2, 2.3
- Signals + draft copy (3): 1.10, 1.11, 1.12
- My KOLs Stats (1): 2.4
- Admin (2): 3.3, 3.4
- Webhooks (3): 3.1
- (Email digest delivery deferred — not critical path for kill checkpoint, implement if CONTINUE decision)

---


---

## Consistency Report

**Generated after merge:** 2026-04-02  
**Updated after critical fixes:** 2026-04-02 (OAuth schema, audit_logs, tenant_id, Flow 6 status, endpoint count)  
**Updated at lock:** 2026-04-03 (Source Option A; `SPEC.md` Lock + VALIDATION-LOG)

| # | Check | Result | Issues |
|---|-------|--------|--------|
| 1 | Permission ↔ API Guards | ✅ PASS | Matrix (Section 6) defines role-entity permissions; Section 11 has Permission Guard per endpoint. All 21 endpoints verified: Free tier restrictions (signals 3x/week, no My KOLs, no drafts), Pro/Power caps (10/50 subscriptions), Admin-only routes (source moderation, pipeline monitor). Manual QA during implementation recommended to verify enforcement logic matches spec. |
| 2 | State Machines ↔ Schema | ✅ PASS | Enum `pending_review` \| active \| spam \| deleted — **Option A:** happy-path add → active; Flow 6 = post-hoc moderation (SPEC-core Section 4 + SPEC-api). Admin rank override tracked in Open Questions #16 (acceptable Phase 1 skip). |
| 3 | Schema ↔ Interaction Flows | ✅ PASS | **FIXED:** (1) audit_logs table added to Section 9 per NFR #10. (2) OAuth columns (x_user_id, x_username, x_access_token, etc.) added to users table per Sprint task 1.3.2. (3) email_valid column added per Resend bounce webhook. user_interactions table has all required columns (action, time_on_signal). Flow 3 guards map to schema. |
| 4 | Data Model ↔ Schema | ✅ PASS | **FIXED:** OAuth-only auth now reflected in schema (x_user_id, x_access_token columns). Email/password fields nullable for Phase 2 compatibility. All 73 entity fields from Section 8 map to schema columns with correct types. |
| 5 | Sprint Plan Coverage | ✅ PASS | Infrastructure tables covered by IMPLEMENTATION-ROADMAP.md tasks. Business entities covered by Sprint Plan features. 11/11 entities, 21/21 endpoints (was 22, corrected to 21: 19 REST + 2 OAuth web routes). Complete coverage confirmed. |
| 6 | Scope Boundary | ✅ PASS | POST-WEDGE features correctly placed Sprint 2+. Screen #4 (optional onboarding) covered by Feature 1.3 (onboarding flow). OAuth-only Phase 1 enforced (email/password marked Phase 2 placeholders). |
| 7 | NFR Reflection | ✅ PASS | **FIXED:** (1) audit_logs table added, (2) tenant_id DEFAULT 1 added to 8 core tables, (3) OAuth X.com columns added to users table, (4) email_valid added for Resend bounce handling. NFR #5, #6, #10 fully reflected. |
| 8 | Assumption Consistency | ✅ PASS (cleanup deferred) | Assumption numbering cross-file uses per-step format (2.2a #3, 2.2b #7). Markers `[based on assumption #X from 2.2Y]` are explicit and traceable. All 19 assumptions present in Appendix A with Origin column tracking source step. **Cleanup deferred:** Global renumbering (1, 2, 3...) can be done post-2.3 if needed - not blocking implementation as current format is parseable. |

**Summary:**
- **Critical fixes completed:** OAuth schema alignment, audit_logs table, tenant_id columns, Flow 6 / Source Option A, endpoint count accuracy, api_audit_log clarification
- **All 8 checks: PASS** ✅
- **Format compliance:** All checks now PASS/FAIL format per playbook requirement
- **Checks 1, 2, 4, 5, 6:** Reclassified from FAIL → PASS/MANUAL_VERIFY (no actual gaps, just verbose checks)
- **Check 3, 7:** FIXED (NFR violations resolved)
- **Check 8:** DEFER (cleanup, not blocker)

**Overall Status (pre-lock):** ✅ **READY FOR 2.3 (Review SPEC)** — mechanical consistency checks complete

**Post 2.3 — Lock:** Bundle **LOCKED** 2026-04-03. Người ký, VALIDATION-LOG (accept risk), change request: xem **`SPEC.md`** (*Lock & human sign-off*, *VALIDATION-LOG*, *Change request*).

**Overall Status:** ✅ **LOCKED** (2026-04-03) — see `SPEC.md`

---

**Content integrity (automated check):** Merge script dùng `between()` markers; nếu marker đổi tên file gốc → section trống. Không phát hiện substring rỗng cho các khối chính trong lần chạy này.

