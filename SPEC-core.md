# SPEC-core.md — SignalFeed Specification (Sections 1–8)

**Assembly:** Hợp nhất từ Domain Foundation (2.2a), Architecture & State (2.2b), Data Model (2.2c), Delivery & Ops Phần 1–2 (2.2f).  
**Companion files:** `SPEC-api.md` (Sections 9–11), `SPEC-plan.md` (Sections 12–13 + Appendix). **Tóm tắt vendor (2.2d):** `API-CONTRACTS.md` — đồng bộ 2026-04-06; chi tiết crawl/LLM = **`SPEC-api.md`** + `SPEC-core` §3.2 (TweetFetchProvider LOCK).

> **Cross-reference map (legacy → SPEC split files):**  
> `2.2a` → `SPEC-core.md` Sections 5–7 · `2.2b` → Sections 3–4 · `2.2c` → Section 8 · `2.2d` → `SPEC-api.md` Section 10 · `2.2e` → Sections 9 & 11 · `2.2f` → `SPEC-core.md` Sections 1–2 + `SPEC-plan.md` Section 12 · `2.2g` → `SPEC-plan.md` Section 13.  
> Chi tiết trong từng section giữ nguyên văn bản gốc (kể cả chuỗi “2.2x …”).

---

## Section 1 — System Overview
**Source:** 2.2f Phần 1
**Last confirmed:** 2026-04-06 (crawl **4×/ngày**; twitterapi **POC/advanced_search**; personal feed Pro/Power; clustering **prompt-based** — đồng bộ `SPEC-api.md`)

### 1.1 — Project Description

SignalFeed aggregates signal from noise across 500+ curated tech/crypto/marketing KOL Twitter accounts. Users receive daily AI-clustered digest of important signals with ready-to-post tweet drafts, replacing 1-2 hours of manual scrolling with a 5-minute consumption flow. Target users: tech builders (AI focus), marketers, crypto professionals who follow KOLs for competitive intelligence and miss critical signals in information overload.

**Source:** Ideation Document Section 1 (Pain & Solution), Section 2 (Target User)

---

### 1.2 — Strategy Embed

--- BEGIN STRATEGY EMBED (source: PRODUCT-STRATEGY.md) ---

**Wedge:**

### Pain
- **Ai:** Tech builders (AI focus), marketers, crypto professionals
- **Đau gì:** Scroll X 1-2h/ngày, sợ miss signal quan trọng từ KOL. Information overload — signal ≈10%, noise ≈90%.
- **Recurring:** Daily. Mỗi ngày lặp lại.
- **Mất product:** Quay lại scroll thủ công + Twitter Lists + Grok. Không mất tiền, mất thời gian.

### Buyer
- Cá nhân tự quyết định, tự trả. $9.9/tháng.
- Budget sẵn — không cần approval từ ai.
- Buyer = User (cùng 1 người).

### Distribution Motion
| Giai đoạn | Motion | Status |
|---|---|---|
| 0-10 users | Bạn bè cá nhân trong giới crypto, marketing, founder. DM/group chat. | Có access nhưng risk "dùng free vì nể mặt" |
| 10-50 users | Reddit seeding liên tục + đều đặn. Skill viết bài cá nhân hóa (trích xuất giọng văn, AI không detect được). Account Reddit mua + warm up từ khi build. | **Planned, chưa proven.** Chưa từng execute. Reddit hostile với self-promotion. |
| 50+ users | Build in public + Product Hunt launch | Build in public không audience (Distribution WEAK). PH = one-shot boost, không phải engine. |

**Flag:** Distribution motion duy nhất repeatable = Reddit seeding. Chưa proven. Nếu fail → không có backup engine.

### Wedge Features (5)

| # | Feature | Mô tả |
|---|---|---|
| 1 | Crawl pipeline | Fetch tweets từ curated source pool (~500 KOL) theo lịch **4 lần/ngày** via twitterapi.io (POC: `advanced_search` + `last_crawled_at` per source — xem `SPEC-api`) |
| 2 | AI classify + cluster + summarize + rank | LLM pipeline: signal/noise classify → event clustering → summary generation → rank by source count + signal strength |
| 3 | Digest web UI | Danh sách signals ranked, filter by category. Mobile-first, card-based. |
| 4 | Source attribution | Mỗi signal ghi rõ: ai nói, link original tweet, timestamp, tổng KOL đề cập. |
| 5 | Draft generation | Ready-to-post tweet per signal. Category-aware tone. Click → mở Twitter composer với text pre-filled. |

**Kill Checkpoint:**

| Test | Threshold | Action |
|---|---|---|
| Landing page signup | <5% conversion | Kill — signal không đủ mạnh |
| Paying users post-launch | <10 users sau 4 tuần | Kill |
| Reddit seeding traction | 2 tuần liên tục, 0 organic signups | Distribution motion fail — pivot channel hoặc kill |
| Founder dogfood | Founder không dùng daily sau 1 tuần | Kill — product không solve pain thật |

**Moat Stack:**

### Tier: Tier 1 (Survive)
- Target: $5-10k MRR
- Defend: 12-24 tháng
- $8k MRR sau 12 tháng = happy → confirm Tier 1

### Moat Layers

| Phase | Moat Type | Timing | Trigger |
|---|---|---|---|
| Phase 1 | **KHÔNG CÓ MOAT** | Ngay | Accept. Objective = validate WTP. Sống bằng execution speed. |
| Phase 2 (primary) | **Data defensibility** | Tháng 3-6 | 10+ paying users → implement insight loop |
| Phase 2 (secondary) | **Workflow lock-in** | Tháng 4-6 | Draft usage >30% signals → voice personalization |

### V1 Design Rules — MUST-HAVE
1. **Log mọi user interaction** — signal click, draft copy, signal skip, time-on-signal. Chưa dùng Phase 1 nhưng phải capture. Chi phí storage ≈ 0. Đây là nguyên liệu cho data moat Phase 2.
2. **Source attribution rõ ràng mỗi signal** — ai nói, link original, bao nhiêu KOL. Đây là trust anchor duy nhất khi không có domain credibility.
3. **Founder dùng daily** — nếu founder bỏ dùng, kill.
4. **Reddit seeding warm up bắt đầu từ khi build** — không đợi launch. Account mua + warm up + content pipeline chạy song song với dev.
5. **Free tier làm funnel** — conversion từ Free → Pro phải track từ ngày 1.

### V1 Design Rules — MUST-NOT-HAVE
1. **Paid acquisition trước khi validate organic distribution works** — CAC >$0 trước tháng 2 = red flag.
2. **Onboarding >3 bước** — hiện tại 2 bước (category selection → optional KOL follow). Giữ nguyên.
3. **Feature nào không trực tiếp serve digest consumption hoặc draft creation** — cắt hết.
4. **AI personalization Phase 1** — chưa đủ data. Output giống nhau cho tất cả user cùng category.
5. **Over-invest infrastructure** — low moat product không deserve complex architecture.

### KILL SIGNAL
1. User recreate toàn bộ value bằng "Grok prompt + Twitter Lists" trong 10 phút.
2. 4 tuần post-launch <10 paying users.
3. Reddit seeding 3 tuần liên tục, 0 organic signup.
4. Founder không dogfood daily sau tuần đầu.

--- END STRATEGY EMBED ---

**Critical Risks (from PRODUCT-STRATEGY.md Verdict):**

| Risk | Severity | Mitigation | Validate khi nào |
|---|---|---|---|
| **R1 — Distribution chưa proven** | HIGH | Reddit seeding là plan duy nhất repeatable. Skill viết bài + account mua = preparation tốt nhưng 0 lần thực thi. | Sprint 1 checkpoint — Reddit seeding có organic signup không? |
| **R2 — Zero moat Phase 1** | MEDIUM | Switching cost ≈ 0, clone cost ≈ 2 tuần. Accept: Phase 1 sống bằng speed, moat build Phase 2. | Tháng 3-6 — data insight loop implemented và showing delta? |
| **R3 — Platform absorption** | HIGH | Grok promptable feeds + Stories on X đang tiến về hướng SignalFeed. Gap: custom KOL groups + cross-category clustering + draft creation. | Continuous monitor — nếu X ship "curate from followed accounts" → pivot hoặc kill. |

**Source:** PRODUCT-STRATEGY.md Section 7 Verdict — CONDITIONAL

---

### 1.3 — Scope Boundaries

| In Scope | Out of Scope | Source |
|----------|-------------|--------|
| 500 KOL source pool curated by platform | User-added unlimited sources Phase 1 | Strategy Wedge Feature #1 |
| **User-added sources to shared pool (no cap on adding)** — Pro/Power users can add KOLs to shared pool for all users to benefit. Cap applies ONLY to My KOLs subscriptions (Pro: 10, Power: 50), NOT to the act of creating a new Source in the pool. **H1 (2026-04-02):** On add, `MySourceSubscription` is created only if the user is under cap; if at cap, the Source is still created (pool grows) and the user may Follow via Flow 2 after freeing a slot. | User bypassing cap by finding existing sources in pool — this is INTENDED behavior (contribute to commons = no penalty). | 2.2a assumption #2 + Flow 1 H1. **Clarification:** Add to pool = altruistic contribution. My KOLs list = personal quota (capped); optional subscribe-at-add when under cap. |
| AI classify + cluster + summarize pipeline (shared output for all users same category) | **Full** AI personalization mọi ranking Phase 1 | Strategy V1 MUST-NOT-HAVE #4 — **Ngoại lệ 2026-04-06:** Pro/Power **personal digest slice** (`user_personal_feed_entries` + job sau shared pipeline) **Sprint 2+** — không đổi shared ranking, chỉ bổ sung feed theo My KOLs |
| Daily digest web UI (mobile-first, card-based) | Native mobile app Phase 1 | 2.1 NFR #4 — PWA Phase 1, native app Phase 2 |
| Twitter OAuth login only | Email/password, Google, GitHub auth | 2.1 NFR — OAuth X.com single provider |
| Email digest delivery (Pro/Power) | Real-time Telegram alerts Phase 1 — defer to Phase 2 per 2.1 NFR. **Clarification:** "Real-time" in Strategy = misnomer. Pipeline runs **4×/day** → digest latency theo slot crawl + queue, không phải push tức thời. Phase 2 = "faster notification via Telegram". | Strategy Wedge Features — email Yes, Telegram defer per 2.1 |
| English-only UI Phase 1 | Vietnamese, multi-language | 2.1 NFR #1 — i18n defer Phase 2 |
| UTC timezone hardcode (display Vietnam local) | User-selectable timezone Phase 1 | 2.1 NFR #2 — multi-timezone defer Phase 2 |
| 3 plans: Free (3 digests/week), Pro ($9.9/mo), Power ($29.9/mo) | Enterprise plans, custom pricing | Strategy Pricing table |
| Mon/Wed/Fri digest delivery for Free tier | Daily delivery Free tier, configurable schedule | 2.2d Constraint #9, Strategy Free tier design |
| 30-day archive search (browse by date + category filter) | Full-text search, keyword search Phase 1 | 2.2a F20 — archive search = browse only Phase 1 |
| | Admin analytics dashboard Phase 1 | Strategy V1 MUST-NOT-HAVE #3 — feature không serve consumption/draft |
| | Onboarding >3 steps | Strategy V1 MUST-NOT-HAVE #2 — keep 2 steps (category + optional KOL) |

---

---

## Section 2 — Non-Functional Requirements
**Source:** 2.2f Phần 2 (NFR embed)
**Last confirmed:** 2026-04-06

--- BEGIN NFR EMBED (source: 2.1 NFR Summary) ---

| # | NFR Item | Decision | Impact | Phase |
|---|----------|----------|--------|-------|
| 1 | Internationalization (i18n) | DEFER Phase 2 (prep architecture) | +5% effort: message keys, i18n library setup, users.locale column | V1 prep, Phase 2 activate |
| 2 | Multi-timezone | DEFER Phase 2 (prep architecture) | +5% effort: UTC storage mandatory, users.timezone column, display conversion helper | V1 prep, Phase 2 activate |
| 3 | Multi-currency | NO (USD forever) | 0% effort: hardcode USD, no exchange rates | V1 |
| 4 | Mobile app | DEFER Phase 2 (PWA Phase 1) | 0% effort: session-based OK. Optional: manifest.json (~2h) | V1 PWA, Phase 2 native |
| 5 | White-label / Multi-brand | DEFER Phase 2 (prep architecture) | +10% effort: tenants table + tenant_id all core tables | V1 prep, Phase 2 activate |
| 6 | Multi-tenant isolation | Level 1: Shared DB + tenant_id filter | +0% (covered by #5). Global scope middleware. | V1 prep |
| 7 | Offline mode | NO (online required) | 0% effort. Optional: service worker cache static assets only. | V1 |
| 8 | Accessibility (a11y) | Level 2: Basic (semantic HTML, keyboard nav, decent contrast) | +5% effort: semantic tags, form labels, color contrast #000-#333 | V1 |
| 9 | Export data (PDF/Excel) | DEFER Phase 2 | 0% effort Phase 1. Digest URLs persistent + auth-gated. | Phase 2 |
| 10 | Audit log / Compliance tracking | BOTH (2 tables: audit_logs + user_interactions) | +5% effort: 2 tables; **`audit_logs`:** danh mục + cơ chế ghi **LOCK** trong `SPEC-api` Section 9 §1.3.1. `audit_logs` immutable; `user_interactions` deletable. | V1 |
| 11 | GDPR / Data privacy | Level 2: Basic manual (script + policy) | +4-6h: privacy policy page, 2 artisan commands (export/delete), email template. 30-day SLA. | V1 |

**TOTAL NFR EFFORT:** +12-15% (2-3 ngày extra trên 2 tuần Sprint 1)

--- END NFR EMBED ---

**Critical NFR Constraints for Implementation:**

1. **ALL timestamps UTC storage** — no exception. Display conversion at application layer. (NFR #2)
2. **OAuth X.com only auth** — no email/password Phase 1. (2.1 NFR decision)
3. **Semantic HTML mandatory** — `<button>` not `<div onclick>`. Color contrast #000-#333 minimum. (NFR #8)
4. **Dual logging tables** — audit_logs (immutable, security events) + user_interactions (deletable, moat data). (NFR #10)
5. **tenant_id DEFAULT 1** — all core tables prep for Phase 2 multi-tenant, default to single tenant Phase 1. (NFR #5, #6)

---

---

## Section 3 — Tech Stack & Architecture
**Source:** 2.2b Phần 1–2
**Last confirmed:** 2026-04-06

### 3.1 — Tech Stack Decision

| Layer | Choice | Source Constraint | Lý do (bám constraint) |
|-------|--------|------------------|------------------------|
| Backend language | PHP 8.2+ | Ideation Section 10 "Stack preference: Chưa chốt — quyết định trong Giai Đoạn 2 sau khi hiểu rõ requirements. Ưu tiên stack quen deploy + maintain." Product Strategy "Low moat — execute fast, don't overinvest". | Founder familiar với PHP ecosystem. Laravel modern PHP framework với community support mạnh, deployment guides abundant. |
| Backend framework | Laravel 11.x | Ideation constraint "solo developer" + "2-3 tuần build MVP". Product Strategy "execute fast". Domain 2.2a: CRUD-heavy (Source, User, Signal management) + background jobs (Pipeline) + scheduled tasks (cron). | Laravel batteries-included: Eloquent ORM (relationships), Queue system (Redis/DB), Scheduler (cron), Auth scaffolding, migration system. Faster MVP than building từ đầu. |
| Frontend | React 18+ (Vite) | Domain 2.2a F13, F14 (digest web UI), F06 (My KOLs browse/search). Ideation Section 1 "mobile-first" + responsive. Product Strategy "Low moat" → không overinvest UI framework. | React component model fit card-based digest UI + filter interactions. Vite = fast dev build. Laravel serve API, React SPA consume. Alternative: Inertia.js (Laravel + React SSR hybrid) nếu cần SEO cho landing page [based on assumption #1]. |
| Database | PostgreSQL 15+ | Domain 2.2a: M:N relationships (SourceCategory, MySourceSubscription, SignalSource), array fields (Signal.categories, Signal.topic_tags, User.my_categories), JSON fields (User.delivery_preferences). Ideation constraint "budget $150-300 pre-revenue" → managed DB preferred (Railway/Render free tier). | Postgres native: array columns, JSONB, full-text search (future archive F20). Laravel Eloquent support Postgres natively. Free tier available on Railway/Render. MySQL alternative nếu Postgres hosting issue nhưng mất array query efficiency [based on assumption #2]. |
| Queue/Jobs | Laravel Queue (Redis-backed) [tentative — DB fallback] | Domain 2.2a Flow 3 "Pipeline runs on **4× daily schedule**", 6 sequential steps. Ideation Section 11 risk "Pipeline failure — retry logic". Product Strategy "execute fast" vs reliability trade-off. | Laravel Queue native: retry, backoff, failed job tracking. Redis = performance. DB-backed fallback nếu Redis hosting cost issue (free tier limitations) [based on assumption #3]. Queue cho: Pipeline job, email digest, interaction logging. |
| Task Scheduler | Laravel Scheduler (cron wrapper) | Domain 2.2a Flow 3 "cron kicks pipeline **4 times per day** (UTC slots in env)". Ideation Section 11 "Pipeline miss cycle → alert". | Laravel Scheduler = code-based cron definition, single `schedule:run` entry. Easier maintain than raw crontab. |
| Cache | Redis [tentative] | Domain 2.2a Flow 4 "My KOLs stats calculated on-demand" — assumption #12 từ 2.2a = performance risk nếu user base lớn. Product Strategy moat metrics tracking = query-heavy analytics. | Redis cache digest filters, My KOLs stats (7-day trend, per-category breakdown). Alternative: Laravel file cache nếu Redis cost issue, nhưng slower [based on assumption #4]. |
| File storage | Local filesystem (server storage) | Domain 2.2a: no file uploads from users Phase 1. Only system-generated: UserInteraction logs (DB records, not files). No image/document storage. | No cloud storage cost. Laravel storage/ sufficient. Phase 2: S3 (Laravel Filesystem) nếu archive >30 days needs object storage. |
| Auth method | Laravel Sanctum (token-based API auth) | NFR OAuth X.com Phase 1. User preferences "react native" → future mobile app needs stateless auth. Product Strategy Phase 2 potential mobile. | Sanctum = SPA + mobile API auth. Cookies for web (CSRF protected), tokens for mobile. OAuth X.com integration via Socialite package. |
| Runtime/Server | PHP-FPM 8.2+ + Nginx | Ideation constraint "solo developer" + "deploy + maintain" ease. Standard Laravel stack. | Founder familiar, Laravel Forge/Ploi support, deployment guides abundant (Railway, Render, DigitalOcean App Platform). |
| External APIs | twitterapi.io (crawl), Anthropic API (LLM), Resend (email) [tentative], Telegram Bot API | Ideation Section 7 Integration Points. Domain 2.2a Flow 3 (pipeline), F16 (email), F17 (Telegram). Budget: twitterapi.io $50-70/mo, Anthropic $15-30/mo confirmed. | twitterapi.io = tweet crawl validated. Anthropic Claude Haiku = classify/summarize/draft. Resend = Laravel-friendly email service, free tier 3000 emails/mo (sufficient early users). SendGrid alternative [based on assumption #5]. Telegram Bot API = free. |
| Deployment | Railway or Render [tentative] | Ideation constraint "solo developer", Product Strategy "execute fast", budget "$150-300 pre-revenue". Domain 2.2a: digest batch job (not real-time) = zero-downtime deploy không critical Phase 1. | Git push deploy, free tier ($5-10/mo after free credits), managed Postgres + Redis, cron support via web service keep-alive. Alternative: DigitalOcean App Platform, Laravel Forge + Linode [based on assumption #6]. |

**Notes:**
- [tentative] = subject to change during environment setup (2.2d), architecture-agnostic decisions.
- Redis: Railway free tier = 25MB Redis, sufficient cho cache nhưng không cho queue nếu volume cao → DB-backed queue fallback.
- Versions finalized in 2.2d.

---

### 3.2 — Architecture Patterns

| Pattern | Áp dụng ở | Source Need | Lý do (bám project need) |
|---------|-----------|-------------|--------------------------|
| Service Layer | Backend business logic | Domain 2.2a Flows 1-7 có guards + side effects. Flow 1 (Add Source) = validate + conditional My KOLs subscribe if under cap (H1). Flow 3 (Pipeline) = 6 steps + error handling. Product Strategy "data moat Phase 2" = reusable logic cho personalization. | Service encapsulate business logic, separate từ Controller (HTTP) và Model (data). Reusable across web API + future CLI/Artisan commands. Laravel convention: app/Services/. |
| Repository Pattern (selective) | Complex queries only [based on assumption #7] | Domain 2.2a Flow 4 "My KOLs stats" = multi-table join (Signal ↔ SignalSource ↔ MySourceSubscription). Product Strategy moat metrics = analytics queries. Trade-off: overhead vs testability. | Repository cho queries phức tạp cần mock/test (stats, ranking). Direct Eloquent cho CRUD đơn giản. Laravel convention: app/Repositories/. Assumption #7: testing priority TBD — if defer testing Phase 1 → skip Repository, direct Eloquent. |
| Job/Queue Pattern | Background processing | Domain 2.2a Flow 3 "Pipeline runs **4×/day**", retry logic per Ideation Section 11 risk. Flow 5 "log interaction" không block main flow per Product Strategy Rule #1. | Laravel Jobs cho: PipelineCrawlJob (6 steps), SendDigestEmailJob, LogUserInteractionJob. Queue = async execution + retry. Scheduler dispatch jobs via cron. |
| Action Pattern (Laravel) | Single-purpose operations | Domain 2.2a Flow 1 (Add Source), Flow 2 (Subscribe). Product Strategy "execute fast" vs Service bloat. | Laravel Action = single class, single responsibility (e.g., AddSourceToPoolAction, SubscribeToSourceAction). Alternative to fat Services. Simpler test isolation. Reference: Spatie Laravel Actions package [based on assumption #8]. |
| Event-Driven (Laravel Events) | UserInteraction logging, pipeline hooks | Product Strategy V1 Rule #1 "log mọi interaction", Domain 2.2a UserInteraction entity. Ideation Section 11 risk "Pipeline failure — alert founder". | Controller fire event SignalClicked, DraftCopied → listener LogUserInteraction. Pipeline fire PipelineCompleted, PipelineFailed → listener alert admin. Decouples logging từ main flow. Laravel native: app/Events/, app/Listeners/. |
| External Service Adapter | API client wrappers | Ideation Section 11 risk "twitterapi.io rate limit — fallback provider". Domain 2.2a Flow 3 error "LLM API error → retry". Product Strategy "execute fast" vs vendor lock-in. | Adapter pattern = swap provider (twitterapi.io → Netrows) without changing service layer. Laravel convention: app/Integrations/TwitterCrawlClient, LLMClient, EmailClient. Retry + circuit breaker in adapter. |
| API Resource (Laravel) | API response transformation | Domain 2.2a: API responses cho React frontend (F13 digest, F14 My KOLs view). Future mobile app per user preferences. | Laravel API Resources = consistent JSON structure, hide internal fields, pagination. Transform Eloquent models → JSON. Example: SignalResource, DigestResource. |

#### LOCK — Tweet data source abstraction (vendor-agnostic crawl)

**Bắt buộc:** Luồng crawl (Flow 3) **không** phụ thuộc trực tiếp vào HTTP client / endpoint của một vendor cụ thể (twitterapi.io hay tên khác).

- **Interface ứng dụng (domain):** Một contract thống nhất (vd. `TweetFetchProviderInterface` / `Contracts\TweetFetchProvider`) định nghĩa thao tác nghiệp vụ: lấy tweet theo nguồn / cửa sổ thời gian / cursor, trả về **cấu trúc đã chuẩn hóa** (danh sách tweet + metadata cursor + lỗi có kiểu) — chi tiết field-level trong `SPEC-api.md` Section 10 (mục *Abstraction*).
- **Implementation:** Mỗi vendor = một class trong `app/Integrations/` (vd. `TwitterApiIoTweetProvider`) **implement** interface; chỉ lớp này biết path, query, auth header thực tế.
- **Binding:** Laravel container bind interface → implementation theo **config/env** (vd. `TWEET_FETCH_PROVIDER=twitterapi_io`). Đổi vendor = đổi binding + config, **không** rewrite `PipelineService` / job / bước classify trở đi.
- **Phạm vi:** Chỉ **crawl/fetch tweet**; LLM (Anthropic) và **Twitter Web Intent** (URL) không thuộc abstraction này.

**Anti-pattern:** `PipelineService` gọi trực tiếp `Http::get()` tới twitterapi.io hoặc hardcode vendor trong Service.

---

### 3.3 — Layer Dependency Rules
┌─────────────────────────────────────────────────────┐
│  HTTP Layer (Laravel Controllers)                   │  ← Routes, request validation, auth middleware
│  - Web API routes (for React SPA)                   │
│  - Future mobile API routes                         │
└──────────────┬──────────────────────────────────────┘
               │ calls ↓
┌──────────────▼──────────────────────────────────────┐
│  Service Layer / Action Layer                       │  ← Business logic, guards, orchestration
│  - SourceService (or AddSourceAction)               │
│  - PipelineService                                  │
│  - DigestService                                    │
│  Optional: Repository cho complex queries           │
└──────────────┬──────────────────────────────────────┘
               │ calls ↓
┌──────────────▼──────────────────────────────────────┐
│  Model Layer (Eloquent Models)                      │  ← Data access, relationships, validation rules
│  - Source, User, Signal, Tweet, etc.                │
│  - Relationships: hasMany, belongsToMany            │
└──────────────┬──────────────────────────────────────┘
               │ queries ↓
┌──────────────▼──────────────────────────────────────┐
│  Database (PostgreSQL)                              │
└─────────────────────────────────────────────────────┘

External:
┌─────────────────────────────────────────────────────┐
│  Integration Layer (API clients)                    │  ← Wrap external services
│  - Tweet fetch: TweetFetchProvider interface       │
│    → impl: TwitterApiIoTweetProvider (swap vendor OK) │
│  - LLMClient (Anthropic API)                        │
│  - EmailClient (Resend/SendGrid)                    │
│  - TelegramClient (Bot API)                         │
└─────────────────────────────────────────────────────┘
      ↑ called by Service/Action Layer

Background:
┌─────────────────────────────────────────────────────┐
│  Job Layer (Laravel Jobs)                           │  ← Long-running tasks
│  - PipelineCrawlJob (Flow 3 — 6 steps)              │
│  - SendDigestEmailJob (F16)                         │
│  - LogUserInteractionJob (async logging)            │
└─────────────────────────────────────────────────────┘
      ↑ dispatched by Service Layer or Scheduler

Events:
┌─────────────────────────────────────────────────────┐
│  Event/Listener Layer                               │  ← Async side effects
│  - Events: SignalClicked, PipelineFailed            │
│  - Listeners: LogInteraction, AlertAdmin            │
└─────────────────────────────────────────────────────┘
      ↑ fired by Controller/Job, handled async
Rules:

Controller → Service/Action ONLY khi có business logic hoặc side effects.

Controller KHÔNG trực tiếp gọi Model nếu có guards, side effects, hoặc multi-step operation.
Example KHÔNG tuân thủ: Controller trực tiếp Source::create() + MySourceSubscription::create() (2 steps = side effect) → phải qua Service.


Controller bypass Service CHỈ KHI:

Simple CRUD: 1 model, no guard ngoài auth, no side effect.
Example hợp lệ: User update delivery_preferences (self-owned JSON field, no validation beyond type check) → Controller gọi $user->update() trực tiếp.
Example KHÔNG hợp lệ: User unsubscribe Source (xóa MySourceSubscription + potential stats recalculation) → có side effect → phải qua Service.


Service/Action → Model, Integration, Job, Event.

Service có thể gọi Service khác (composition OK).
Service KHÔNG gọi Controller (circular dependency).


Model KHÔNG gọi Service (tránh circular dependency).

Model có thể gọi Model khác via Eloquent relationships.
Model có thể fire Events (Laravel Observer pattern) nhưng KHÔNG directly call Service.


Integration Layer (API clients) KHÔNG gọi Service/Model — pure external communication.

**Tweet crawl:** Service gọi **`TweetFetchProvider` interface** (không gọi vendor cụ thể). Các Integration khác (LLM, email, …): gọi HTTP client, retry/timeout, trả dữ liệu đã chuẩn hóa hoặc map vào model.
Service gọi Integration, xử lý, ghi Model.


Job Layer:

Job gọi Service/Action (e.g., PipelineCrawlJob gọi PipelineService).
Job KHÔNG gọi Controller.
Job có thể fire Events.


Event Listeners:

Listener gọi Service/Integration (e.g., AlertAdmin listener gọi TelegramClient).
Listener KHÔNG gọi Controller.



Bypass Rule Detail (CRUD đơn giản):
Simple CRUD = TẤT CẢ điều kiện sau đúng:

Single model operation (create/update/delete 1 record).
No guard ngoài auth middleware (e.g., auth:sanctum, owner check qua policy).
No side effects (không trigger cascade update, không recalculate stats, không send notification).
No multi-step logic (không có "if X then Y else Z" business logic).

Example:

✅ Bypass OK: PUT /user/preferences → $user->update(['delivery_preferences' => $validated]) — self-owned field, no side effect.
❌ Bypass KHÔNG OK: POST /sources/{id}/follow → tạo MySourceSubscription + check cap (Pro=10, Power=50) → có guard + potential side effect (stats) → phải qua SubscribeToSourceAction.


Anti-patterns Cần Tránh
Anti-patternLý do tránh SourceFat Controller — Controller chứa business logic (guards, loops, conditional side effects)Không reusable, khó test, violate SRP. Service/Action layer tồn tại để tách logic khỏi HTTP layer.Laravel best practice + Domain 2.2a Flows có guards phức tạp (Flow 1, 3, 4).Eloquent Model gọi Service — Model method gọi Service classCircular dependency risk. Model = data layer, không orchestrate business logic. Use Events nếu cần side effects.Laravel convention + Product Strategy "execute fast" → tránh debug circular dependency.Direct DB query bỏ qua Eloquent trong Service — Service dùng DB::table() thay vì Eloquent Mất relationship benefits, type safety, event hooks. Chỉ dùng raw query khi Eloquent query builder không đủ (complex aggregation).Domain 2.2a: M:N relationships (SourceCategory, SignalSource) — Eloquent belongsToMany handle tự động.Queue job chứa business logic — Job class chứa guards, validation, multi-step orchestrationJob = transport mechanism, không phải business logic container. Logic thuộc Service. Job gọi Service.Domain 2.2a Flow 3 Pipeline — logic (classify, cluster, rank) thuộc PipelineService, job chỉ dispatch + retry.Integration client chứa business logic — TwitterCrawlClient decide "tweet nào là signal"Integration = IO boundary, return raw data. Classification logic thuộc Service (gọi LLMClient).Ideation Section 11 risk "fallback provider" — swap client không ảnh hưởng classification logic.Missing plan/scope guard trong query — Query Signal/Digest không filter theo user.plan hoặc user.my_categoriesSecurity + business logic leak. Free user thấy Pro data = revenue loss.Domain 2.2a Permission Matrix — Free users restricted to 3 digests/week, All Sources view only.Hardcode external service credentials — API keys trong code thay vì .envSecurity risk + không flexible per environment (dev/staging/prod keys khác nhau).Laravel convention .env + config/services.php.

---

## Section 4 — State Machines & Error Handling
**Source:** 2.2b Phần 3–4
**Last confirmed:** 2026-04-06

Phân Loại Entities
Full State Machine (có lifecycle phức tạp)
1. Source
Loại: Full state machine
Source: Domain 2.2a Entity Relationship (Source soft delete), Flow 1 (add → pool), Flow 6 (admin **hậu kiểm**)

**Chốt Phase 1 — Option A (2026-04-03):** Source `type='user'` được tạo với **`status='active'`** ngay; vào crawl pool; **lần chạy crawl tiếp theo** (theo lịch 4×/ngày) có thể fetch tweet. **Không** có bước chờ admin approve trước crawl. Flow 6 = moderation sau (spam / category / soft delete).

Giá trị enum `pending_review` vẫn trong schema DB (`SPEC-api.md` §1.2) cho **Option B tương lai**; Phase 1 wedge **không** dùng làm trạng thái mặc định khi user add.

| State | Event | Next state | Side effects | Guards |
|-------|-------|------------|--------------|--------|
| — | User adds source (Flow 1) | **active** | Source `type='user'`; MySourceSubscription nếu under cap (H1); vào pool, crawl cycle tiếp theo | @handle hợp lệ, public, ≥1 tweet/30d, Pro/Power |
| active | Admin flags spam (Flow 6) | spam | Ẩn browse, notify user thêm source | Admin; không hard delete nếu đã có signals |
| active | Admin soft deletes | deleted | Ẩn browse; giữ MySourceSubscriptions | Admin |
| active | Admin adjusts categories | active | Cập nhật SourceCategory | Admin; ≥1 category |
| spam | Admin restores (manual) | active | Vào lại crawl pool | Admin [assumption #9] |
| deleted | Admin restores (manual) | active | Hiện lại browse | Admin [assumption #9] |

State diagram (Option A):

```
[User adds] ──→ active ←──────────────────┐
                  │                     │
     [Admin flag spam]                  │ [Admin restores]
                  ↓                     │
                spam ───────────────────┘
                  │
     [Admin soft delete]
                  ↓
              deleted ──→ [restore] ──→ active
```

Notes:

- `type='default'`: tạo thẳng **active** (admin seed).
- `type='user'`: Phase 1 = **active** ngay (Option A). Conflict #13 (2.2a/2.2b) **đã chốt** — immediate pool + post-hoc review; nếu spam tăng → cân nhắc Option B sau.
- Soft delete giữ lịch sử (không hard delete nếu Source có Tweet/Signal).


2. Signal (per Pipeline)
Loại: Simple lifecycle (no user-facing state machine)
Source: Domain 2.2a Flow 3 (Pipeline), Entity Relationship (Signal system-generated)
Summary: Signal created by Pipeline (Flow 3 step 7), no user-editable state. Lifecycle = created → published (attached to Digest). Admin có thể manual rank override per assumption #3 (2.2a Permission Matrix) nhưng không change state. Archive sau 30 days (F20) = soft delete marker, không phải state transition.
Side effects khi created:

Attached to today's Digest (Flow 3 step 8).
SignalSource M:N links created (attribution).
DraftTweet generated (1:1 relationship).

No state machine needed. CRUD + timestamp fields (created_at, published_at).

3. User
Loại: Simple status
Source: Domain 2.2a Entity Relationship (User.plan), F02 (Plan & Billing)
Summary: User.plan enum: free, pro, power. No complex lifecycle — plan changes via Stripe webhook (subscription created/canceled/updated). Not a state machine — just plan field update + timestamp.
Side effects khi plan changes:

Plan downgrade (Pro → Free): MySourceSubscription cap enforcement (keep first 10, unsubscribe rest) [based on assumption #10].
Plan upgrade (Free → Pro): unlock features (My KOLs, drafts, daily digest).

No state machine needed. Plan field + feature gates in code (middleware/policy).

Simple Status (flag changes có side effects nhỏ)
4. MySourceSubscription
Loại: Simple flag
Source: Domain 2.2a Flow 2 (Subscribe), Flow 6 error case (soft delete Source preserves subscriptions)
Summary: Boolean existence = subscribed to My KOLs list. Created via Flow 2 (follow), deleted via unfollow. No status field. Side effect khi deleted: My KOLs stats recalculated (7-day trend, per-category breakdown per Flow 4) [based on assumption #11 — recalculation strategy TBD].
No state machine. Simple create/delete.

5. Tweet
Loại: Simple flag
Source: Domain 2.2a Flow 3 (Classify step), Entity Relationship (Tweet.is_signal, Tweet.signal_score)
Summary: Crawled → classified. Fields: is_signal (boolean), signal_score (float 0-1). No state enum. Classification happens once (Flow 3 step 2), không re-classify. Soft delete nếu Source deleted + tweet không linked to Signal.
No state machine. Immutable after classification.

No Lifecycle — CRUD Only
6. Category
Loại: No lifecycle — CRUD only
Source: Domain 2.2a Entity Relationship "10 categories hardcoded, cannot be created/deleted by users", F03
Summary: Static lookup table. No create/update/delete operations by users or admin Phase 1. Seeded via migration. CRUD = read-only.

7. SourceCategory (M:N junction)
Loại: No lifecycle — CRUD only
Source: Domain 2.2a Entity Relationship (junction table)
Summary: Pivot table linking Source ↔ Category. Created/deleted khi Source categories assigned. No status field, no guards ngoài foreign key constraints.

8. SignalSource (M:N junction)
Loại: No lifecycle — CRUD only
Source: Domain 2.2a Entity Relationship (junction table), F18 (Source attribution)
Summary: Pivot table linking Signal ↔ Tweet ↔ Source (attribution). Created atomically khi Signal created (Flow 3 step 7). Immutable — cannot edit after creation (preserve attribution integrity).

9. DraftTweet
Loại: No lifecycle — CRUD only
Source: Domain 2.2a Entity Relationship (1:1 with Signal), Flow 3 (Draft step), Flow 5 (copy draft)
Summary: Generated khi Signal created (Flow 3 step 6). 1 draft per signal Phase 1. No edit — user copies text to Twitter composer (Flow 5), edits externally. Immutable in system.

10. Digest
Loại: No lifecycle — CRUD only
Source: Domain 2.2a Entity Relationship (system-generated daily), CRUD summary "System creates daily Digest"
Summary: Created daily at midnight UTC (assumption #18 từ 2.2a). One Digest per day. No status field — exists hoặc not. Soft delete sau 30 days (archive retention F20).

11. UserInteraction
Loại: No lifecycle — CRUD only (append-only)
Source: Domain 2.2a Entity Relationship (logs user actions), Product Strategy V1 Rule #1
Summary: Append-only log. Created via events (SignalClicked, DraftCopied). No update/delete. Retention policy TBD (assumption: indefinite Phase 1, aggregate + delete raw logs Phase 2).

CategoryStrategyHandle ở layerLog ở đâu Source Ví dụ Validation errorsReturn 422 với field-level errors. Laravel FormRequest validation.Controller (FormRequest)Laravel log (daily rotation)2.2a Flow 1 error "No category selected → validation error", Flow 2 "Cap exceeded → show upgrade prompt"User submits Add Source form, missing category → 422 {"error": {"code": "VALIDATION_ERROR", "details": {"categories": ["At least 1 category required"]}}}Auth errorsReturn 401 (unauthenticated) hoặc 403 (unauthorized). Laravel Sanctum middleware + Policies.Middleware (auth:sanctum) + PolicyLaravel log (daily)2.2a Permission Matrix (role restrictions), Flow 2 guard "Pro/Power users only"Free user tries POST /sources/{id}/follow → 403 {"error": {"code": "FORBIDDEN", "message": "Upgrade to Pro to use My KOLs"}}Business logic errorsReturn 400 hoặc 409 (conflict). Throw custom exception trong Service, catch trong Controller.Service layer (throw), Controller (catch + format)Laravel log (daily) + Sentry (production) [based on assumption #12]2.2a Flow 1 error "Account private → reject", Flow 2 "Cap exceeded", Flow 4 "Zero subscriptions → empty state"User adds private X account → Service throw AccountPrivateException → Controller catch → 400 {"error": {"code": "ACCOUNT_PRIVATE", "message": "Cannot add private accounts"}}External service errorsRetry with exponential backoff (Laravel Queue retry mechanism). Return 503 (service unavailable) nếu exhaust retries. Alert admin via Telegram nếu >3 consecutive failures.Integration layer (retry), Job (retry config), Service (throw if final fail)Laravel log (daily) + external service errors to SentryIdeation Section 11 risk "twitterapi.io rate limit", 2.2a Flow 3 error "LLM API error → retry next cycle"twitterapi.io rate limit (429) → TwitterCrawlClient retry 3x with backoff → if fail → Job fail → alert admin → 503 {"error": {"code": "CRAWL_SERVICE_UNAVAILABLE", "message": "Tweet crawl temporarily unavailable"}}. User-facing: digest may be incomplete, show warning banner.Side-effect failuresLog error, continue main operation. Non-critical side effects không block main flow. Alert admin nếu repeated failures.Service (try-catch side effect), Event Listener (log failure)Laravel log (daily) + SentryProduct Strategy V1 Rule #1 "log interaction không block main flow", 2.2a Flow 5 "log interaction action='copy_draft'"User copies draft (Flow 5) → main flow succeed (Twitter composer opens) → LogUserInteractionJob fails (DB connection timeout) → log error to Sentry → admin alerted → user không affected.Pipeline failuresRetry entire job (PipelineCrawlJob) with backoff. If fail >3x, alert admin via Telegram + email. Manual trigger fallback.Job layer (retry config: 3 attempts, exponential backoff), Listener (alert on failed)Laravel failed_jobs table + log (daily) + SentryIdeation Section 11 risk "Pipeline failure/downtime — miss digest → user nhận digest trống", 2.2a Flow 7 error "No pipeline runs in 24h → critical alert"Pipeline job fails (LLM API timeout) → retry 3x → final fail → fire PipelineFailed event → listener send Telegram alert to admin + log to failed_jobs table → admin manually triggers php artisan pipeline:run (fallback command).Unexpected errorsReturn 500. Log full stack trace + context (user ID, request params). Report to Sentry (production). Generic user-facing message (no stack trace leak).Global exception handler (Laravel Handler.php)Laravel log (daily) + Sentry (production)General catch-allUnhandled exception (e.g., array index out of bounds trong Service) → 500 {"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred. Support has been notified."}} → Sentry alert with stack trace → admin debug.
Error Response Format Chuẩn:
json{
  "error": {
    "code": "ERROR_CODE",          // Machine-readable: VALIDATION_ERROR, ACCOUNT_PRIVATE, etc.
    "message": "Human message",     // User-facing explanation
    "details": {                    // Optional: field-level errors (validation only)
      "field_name": ["Error message"]
    }
  }
}
Error Codes Convention:

VALIDATION_ERROR: FormRequest validation failures (422).
UNAUTHENTICATED: Not logged in (401).
FORBIDDEN: Logged in but lacks permission (403).
ACCOUNT_PRIVATE, ACCOUNT_NOT_FOUND, ACCOUNT_INACTIVE: Business logic errors từ Flow 1 (400).
SUBSCRIPTION_CAP_EXCEEDED: Flow 2 cap guard (400).
CRAWL_SERVICE_UNAVAILABLE, LLM_SERVICE_UNAVAILABLE: External service failures (503).
INTERNAL_SERVER_ERROR: Unexpected errors (500).

Retry Strategy (External Services):

twitterapi.io (crawl): 3 retries, exponential backoff (2s, 4s, 8s), circuit breaker nếu error rate >20% per Flow 7 assumption #16. Fallback provider (Netrows) TBD Phase 2.
Anthropic API (LLM): 3 retries, exponential backoff. Rate limit (RPM) handle via queue throttling. If final fail → skip tweet classification, log to failed_tweets table, manual re-process later.
Resend (email): 2 retries, linear backoff (30s, 60s). If final fail → log to failed_email_jobs, admin manually resend via Artisan command.
Telegram Bot API (alerts): 1 retry immediate. If fail → log error, không block (alert = nice-to-have, không critical).

Alert Thresholds (Admin Notifications):
Per 2.2a Flow 7 assumptions #15, #16:

Pipeline error rate >10% → warning Telegram alert.
Pipeline error rate >20% → critical alert + auto-pause pipeline (prevent waste API quota).
No pipeline run in 24h → critical alert via Telegram + email.
LLM classify accuracy <80% (spot-check) → warning alert.
External service down >1 hour → escalate alert.

---

## Section 5 — Entity Relationships
**Source:** 2.2a Phần 1 + Phần 4 Feature Coverage
**Last confirmed:** 2026-04-06

SignalFeed — Domain Foundation
Generated: 2026-04-02
Input: Ideation v2.0 + Product Strategy
Purpose: Domain spec for AI coding tools (Claude Code, Cursor, Antigravity)

| Entity | Belongs To | Has Many | Cardinality | Constraints | Source |
|--------|------------|----------|-------------|---------------|--------|
| Category | Platform | Sources (M:N via `source_categories`) | 1:N | Exactly 10 categories in Phase 1, hardcoded list. Cannot be created/deleted by users. | Section 3, F03 |
| Source | Source Pool | Tweets; SignalSources (M:N) | 1:N | Type enum: `default` (platform curated) or `user` (user-added). Must have ≥1 category. Account must exist + be public on X. Soft delete (preserve history). | Section 3, F04, F05 |
| SourceCategory | — | M:N junction | — | Links Source ↔ Category. 1 source can have multiple categories. | Section 3, F03 |
| User | Platform | MySourceSubscriptions; Digests (view history) | 1:N | `plan` enum: `free`, `pro`, `power`. Has `my_categories` (array of category IDs at onboarding). Has `delivery_preferences` (json: email, telegram, web). | Section 3, Section 4, F01, F02 |
| MySourceSubscription | User | — (junction) | M:N junction | Links User ↔ Source for personal watchlist. Pro max 10, Power max 50, Free = 0. Created via follow action. | Section 3, F06 |
| Tweet | Source | SignalSources (M:N) | N:1 (Source) → 1:N (Signals) | Raw tweet data from twitterapi.io. Fields: `tweet_id` (unique), text, timestamp, url; optional `tweet_kind`. Classification: `signal_score` (0–1), `is_signal` (boolean). Ingested on **scheduled crawl** (4×/day). | Section 3, F07, F08 |
| Signal | Pipeline (system-generated) | SignalSources (M:N); DraftTweet | 1:N | `cluster_id` (unique), title, summary, `source_count`, `rank_score` (0–1), date. `categories` array (inferred from sources). `topic_tags` (1–3 AI tags). Phase 1: **shared** digest; per-user **supplement** = `user_personal_feed_entries` (Pro/Power, Sprint 2+). | Section 3, F09, F10, F11 |
| UserPersonalFeedEntry | User | — | 1:1 per (user, date) | `SPEC-api` table `user_personal_feed_entries` — JSON `items` for Pro/Power when shared clusters miss My KOLs-only signal. Built **after** shared pipeline. | Amendment 2026-04-06 |
| SignalSource | — | M:N junction | — | Links Signal ↔ Tweet ↔ Source. Preserves attribution: which KOL said what (tweet) in which event (signal). | Section 3, F18 |
| DraftTweet | Signal | — | 1:1 | AI-generated ready-to-post tweet per signal. Fields: text (280 chars max), tone (category-aware). 1 draft per signal Phase 1. | Section 3, F12 |
| Digest | Platform (system-generated) | Signals (view reference, not ownership) | 1:N | Daily compilation. Fields: date (unique per day), `created_at`. Phase 1: single shared digest per day; filter at view time per user. Not user-owned. | Section 3, F13, F14 |
| UserInteraction | User | — | N:1 | [assumed system entity] Logs user actions for Phase 2 data moat. Fields: `user_id`, `signal_id`, action enum (`click`, `skip`, `copy_draft`, `edit_draft`), timestamp, `time_on_signal` (seconds). F15 stats + Phase 2 personalization per PRODUCT-STRATEGY §7. | Product Strategy Section 5 (V1 Design Rule #1) |

Notes:

Pipeline is NOT an entity — it's a scheduled background process (**4× daily** crawl + classify + cluster + …).
SourcePool is a logical concept, not a separate table — refers to all Source records.
Phase 1: Signals are **shared**; Pro/Power **personal digest slice** is additive (`user_personal_feed_entries`), not a replacement — Sprint 2+.

### Phần 4 — Feature Coverage Check (from 2.2a — preserved)

| Feature ID | Feature Name | Covered by Entity | Covered by Flow | Status |
|------------|--------------|-------------------|-----------------|--------|
| F01 | Auth | User | CRUD summary (registration/login) | ✓ Covered |
| F02 | Plan & Billing | User (`plan`, `delivery_preferences`) | CRUD summary (update preferences) | ⚠ Partial — Stripe integration not detailed, deferred to implementation [based on assumption #19] |
| F03 | Categories | Category, SourceCategory, User (`my_categories`) | CRUD summary (select categories onboarding) | ✓ Covered |
| F04 | Default Source List | Source (`type='default'`), SourceCategory | CRUD summary (admin adds default source) | ✓ Covered |
| F05 | Add Source to Pool | Source (`type='user'`), SourceCategory, MySourceSubscription (optional at add if under cap) | Flow 1 (User Adds New Source) | ✓ Covered |
| F06 | My Sources (Personal List) | MySourceSubscription, Source | Flow 2 (Subscribe), CRUD summary (search, unfollow) | ✓ Covered |
| F07 | Tweet Crawl Pipeline | Tweet, Source | Flow 3 (Pipeline — Crawl step) | ✓ Covered |
| F08 | AI Classify | Tweet (`signal_score`, `is_signal`) | Flow 3 (Pipeline — Classify step) | ✓ Covered |
| F09 | Event Clustering | Signal, SignalSource | Flow 3 (Pipeline — Cluster step) | ✓ Covered |
| F10 | Signal Summarize + Rank | Signal (title, summary, `rank_score`) | Flow 3 (Pipeline — Summarize + Rank steps) | ✓ Covered |
| F11 | Topic Tagging | Signal (`topic_tags`) | Flow 3 (Summarize step, tags generated) | ✓ Covered |
| F12 | Draft Generation | DraftTweet | Flow 3 (Pipeline — Draft step) | ✓ Covered |
| F13 | Signal Digest (Web) — All | Digest, Signal | CRUD summary (user views digest, default All view) | ✓ Covered |
| F14 | Signal Digest (Web) — My Sources | Digest, Signal, MySourceSubscription | Flow 4 (My Sources Digest Filtered) | ✓ Covered |
| F15 | My Sources Stats | Signal, MySourceSubscription, SignalSource | Flow 4 (My Sources Digest — stats calculation) | ✓ Covered |
| F16 | Email Digest | Digest, User (`delivery_preferences`) | — | ⚠ Partial — email delivery mechanism not detailed (Resend/SendGrid deferred) [based on assumption #20] |
| F17 | Telegram Delivery | Digest, Signal, User (`delivery_preferences`, `plan='power'`) | — | ⚠ Partial — Telegram Bot API not detailed [based on assumption #21] |
| F18 | Source Attribution | SignalSource (M:N Signal ↔ Tweet ↔ Source) | Flow 3 (attribution preserved), CRUD summary (signal detail view) | ✓ Covered |
| F19 | Twitter Composer Link | DraftTweet, UserInteraction | Flow 5 (Open Twitter Composer) | ✓ Covered |
| F20 | Signal Archive | Digest, Signal | — | ⚠ Partial — archive search not detailed; browse by date + filter only [based on assumption #22] |
| F21 | Source Management (Admin) | Source, SourceCategory | Flow 6 (Admin Reviews Source), CRUD summaries (add/edit default sources) | ✓ Covered |
| F22 | Pipeline Monitor (Admin) | Tweet, Signal (metrics derived) | Flow 7 (Admin Monitors Pipeline) | ✓ Covered |

Summary: 17 ✓ Covered, 5 ⚠ Partial. Partial features are integration-heavy (Stripe, email, Telegram, archive search) — deferred to implementation phase per Ideation Section 7 (Integration Points). Core domain logic fully covered.

---

## Section 6 — Permission Matrix
**Source:** 2.2a Phần 2
**Last confirmed:** 2026-04-06

| Entity | Free User | Pro User | Power User | Admin | Source |
|--------|-----------|----------|------------|-------|--------|
| SourceCategory | R (all 10) | R (all 10) | R (all 10) | R | Section 4, F03 |
| Source | R (browse pool only) | R (browse + search pool), C (add new to pool, cap none [assumption #2]), assign (follow My Sources, cap 10) | R, C (add new), assign (cap 50) | C, R, U (edit categories), D (soft delete), approve (review user-added) | Section 4, Section 5 (Manage My Sources), F04, F05, F06 |
| MySourceSubscription | — (none) | C (follow), D (unfollow) — cap 10 total | C, D — cap 50 total | R (view all users' lists) | Section 4, F06 |
| Tweet | — | — | — | R (spot-check for accuracy) | Section 4, F22 |
| Signal | R (3 digests/week, All Sources only, no topic filter [assumption #1]) | R (daily, filter category + topic + My Sources toggle) | R (daily + Telegram alerts) | R, U (manual rank override [assumption #3]) | Section 4, F13, F14, F17 |
| DraftTweet | — (none) | R (view + copy) | R (view + copy) | R | Section 4, Section 5 (Daily Creation), F12, F19 |
| Digest | R (3/week, web only) | R (daily, web + email) | R (daily, web + email + Telegram) | R | Section 4, F13, F16, F17 |
| UserInteraction | C (log clicks/skips — Phase 1 capture only, no usage) | C (log all actions) | C (log all actions) | R (analytics dashboard [assumption #4]) | Product Strategy Section 5 Rule #1 |
| Unauthenticated / Public | R (landing page only, no digest access) | — | — | — | Section 5 (Onboarding flow) |

Phase 1 Notes:

**Admin access (2026-04-06):** `users.is_admin = true` — middleware on `/api/admin/*` (see `SPEC-api`). Bootstrap admin via env allowlist or one-time seeder.

**Free tier enforcement:** **Both** (1) API middleware returns **403** for Pro-only routes (My KOLs, drafts, personal digest, copy draft) and (2) digest delivery job skips non–Mon/Wed/Fri for Free users [Constraint #9].

Free users: 3 digests/week = access restricted to Mon/Wed/Fri digests [based on assumption #1].
Source add cap: Ideation F05 says "cap theo plan" but doesn't specify cap for adding to shared pool vs subscribing. Assumption #2: no cap on adding to pool (benefits all users), cap only on My Sources subscriptions.
Admin manual rank override (assumption #3) needed for F22 pipeline monitor "spot-check accuracy" — implies ability to adjust if AI ranking wrong.
Admin analytics dashboard (assumption #4) inferred from Product Strategy V1 Rule #1 "log mọi interaction" + moat metrics tracking.

---

## Section 7 — Interaction Flows
**Source:** 2.2a Phần 3
**Last confirmed:** 2026-04-06

Flow 1: User Adds New Source to Pool  
Source: Section 5 (Manage My Sources), F05

| Field | Detail |
|-------|--------|
| Actor | Pro User, Power User |
| Action | Add @handle to shared SourcePool |
| Precondition | User authenticated, plan ∈ {pro, power}, @handle not already in pool |
| Steps | 1. User inputs @handle in Add Source form → 2. System validates: (a) account exists on X, (b) public, (c) ≥1 tweet in last 30 days [assumption #5] → 3. User selects 1+ categories → 4. Creates Source (`type='user'`, `added_by=user_id`, **`status='active'`** — Option A, Section 4) → 5. SourceCategory links → 6. If My KOLs count &lt; plan cap (Pro &lt;10, Power &lt;50), create MySourceSubscription; if at cap, skip subscription — Source still enters pool (H1) → 7. **Next scheduled crawl** includes new source |
| Guards | @handle format (alphanumeric + underscore, 1–15 chars); account public (API); ≥1 category; Pro/Power only; no cap on adding to pool; cap gates only optional subscribe in step 6 and Flow 2 [assumption #2, H1] |
| Result | Source in pool for all users; My KOLs subscription at add only when under cap; at cap, user may Follow via Flow 2 after freeing a slot |
| Error Cases | Account missing → "Account not found on X"; private → "Cannot add private accounts"; no tweets 30d → "Account appears inactive" [assumption #5]; already in pool → subscribe flow; no category → validation error |

Flow 2: User Subscribes to Source (Follow to My Sources)  
Source: Section 5 (Manage My Sources), F06

| Field | Detail |
|-------|--------|
| Actor | Pro User (cap 10), Power User (cap 50) |
| Action | Follow source from pool into personal My Sources list |
| Precondition | User authenticated, plan ∈ {pro, power}, source in pool, not already subscribed |
| Steps | 1. User clicks Follow → 2. Cap check: Pro ≤10, Power ≤50 → 3. Create MySourceSubscription(user_id, source_id) → 4. UI: Following, source in My Sources tab |
| Guards | Pro: subscription count &lt;10; Power: &lt;50; source exists; no duplicate follow |
| Result | MySourceSubscription created; signals from source appear in My Sources digest filter |
| Error Cases | Cap exceeded → upgrade prompt; already following → ignore or message; source soft-deleted → hide from browse, keep subscription [assumption #6] |

Flow 3: Pipeline — Classify + Cluster + Summarize Cycle  
Source: Section 3 (Pipeline), F07–F12

| Field | Detail |
|-------|--------|
| Actor | System (cron **4×/day** + queue workers) |
| Action | Process raw tweets → ranked signals with drafts |
| Precondition | ≥1 source in pool; twitterapi.io + LLM reachable |
| Steps | 1. **Crawl:** fetch new tweets per source since `last_crawled_at` (twitterapi **advanced_search** / POC path), staggered loop, rate-limit safe → 2. Classify: signal_score (0–1), is_signal, threshold ≥0.7 [assumption #7] → 3. Cluster is_signal tweets **[prompt-based LLM — CHỐT 2026-04-06]** [assumption #8] → 4. Summarize: title (≤10 words), summary (50–100 words), topic_tags (1–3) → 5. Rank: rank_score = f(source_count, avg_signal_score, recency_decay) [assumption #9] — **initial weights in `config/signal_rank.php`, tune after dogfood** → 6. Draft ≤280 chars, category tone → 7. Create Signal + SignalSource + DraftTweet → 8. Attach to today’s Digest → 9. *(Sprint 2+)* Job: fill **`user_personal_feed_entries`** for Pro/Power |
| Guards | Threshold ≥0.7; cluster ≥2 sources OR signal_score ≥0.9 single-source [assumption #10]; summary cites tweets; draft not exact copy [assumption #11] |
| Result | ~5–15 signals/day (estimate), ranked, ready for digest |
| Error Cases | Rate limit → retry + backoff, alert if &gt;3 consecutive fails; LLM error → skip cycle, alert, retry next; 0 signals 24h → alert; &gt;50 signals/day → alert |

Flow 4: User Views My Sources Digest (Filtered)  
Source: Section 5 (My Sources Digest View), F14, F15

| Field | Detail |
|-------|--------|
| Actor | Pro User, Power User |
| Action | Toggle "My Sources Only" on digest |
| Precondition | Authenticated, plan ∈ {pro, power}, ≥1 My Sources subscription |
| Steps | 1. Open Digest (All, filtered by my_categories) → 2. Toggle My Sources Only → 3. Filter signals where SignalSources ∩ MySourceSubscriptions non-empty → 4. Stats: today count, top 3 sources, 7-day trend, per-category breakdown → 5. UI highlight matched sources |
| Guards | ≥1 subscription (else empty state); stats on-demand, no pre-agg Phase 1 [assumption #12] |
| Result | Filtered digest + stats overlay |
| Error Cases | No signals today from my sources → empty state; zero subscriptions → redirect to My Sources CTA |

Flow 5: User Opens Twitter Composer with Draft  
Source: Section 5 (Daily Creation), F19

| Field | Detail |
|-------|--------|
| Actor | Pro User, Power User |
| Action | Open Twitter Composer with draft |
| Precondition | Authenticated, plan ∈ {pro, power}, draft exists |
| Steps | 1. Click button → 2. Log interaction `copy_draft` → 3. Build intent URL `https://twitter.com/intent/tweet?text={encoded}` → 4. Open new tab → 5. X composer pre-filled |
| Guards | Draft ≤280 chars; proper URL encoding (emoji, specials) |
| Result | UserInteraction logged; composer open |
| Error Cases | Draft &gt;280 → truncate + log; user not logged into X → X prompts login |

Flow 6: Admin Reviews User-Added Source (post-hoc moderation — Option A)  
Source: Section 5 (Admin Source Curation), F21

| Field | Detail |
|-------|--------|
| Actor | Admin |
| Action | **Hậu kiểm** source `type='user'` đã **active**: flag spam, chỉnh category, soft delete — **không** có bước “approve trước crawl” Phase 1 |
| Precondition | Admin authenticated; có source `type='user'` (thường `status='active'`) cần xem xét |
| Steps | 1. Source Management → 2. Filter `type=user` (gợi ý sort `created_at` desc cho mới thêm); **không** dùng queue `pending_review` làm mặc định Phase 1 → 3. Xem profile, tweet gần đây, signal/noise nếu &gt;7 ngày → 4. **Flag spam** → `status='spam'` (hoặc soft delete theo policy), notify user thêm source; **hoặc Adjust categories** → cập nhật SourceCategory; **hoặc Soft delete** → `deleted` — 5. Log admin audit [assumption #14] |
| Guards | Admin-only; không hard-delete nếu đã có signals; chỉnh category phải ≥1 category |
| Result | Trạng thái / category cập nhật; browse và crawl phản ánh sau khi ẩn nếu spam/deleted |
| Error Cases | Đã có signals → không hard delete; soft-delete + subscriptions → ẩn browse, giữ follow đến khi user unfollow [assumption #6] |

Flow 7: Admin Monitors Pipeline Health  
Source: Section 5 (Admin Pipeline Monitor), F22

| Field | Detail |
|-------|--------|
| Actor | Admin |
| Action | Dashboard, spot-check classify accuracy, monitor errors |
| Precondition | Admin authenticated; pipeline ran ≥1 cycle |
| Steps | 1. Open Pipeline Monitor → 2. Metrics: last run, tweets fetched, signals created, error rate, per-category volume → 3. Sample 10 tweets, admin labels signal/noise → 4. Compare to AI → accuracy → 5. If error rate &gt;10% [assumption #15] or accuracy &lt;80% → alert |
| Guards | Admin-only; sample size 10; thresholds &gt;10% error or &lt;80% accuracy [assumption #15] |
| Result | Health view; identify threshold/API/source issues |
| Error Cases | No run 24h → critical alert; error rate &gt;20% → emergency + pause pipeline [assumption #16]; 0 signals 3 days → alert |

---

Flow 8: Generate Personal Signals (Pro/Power - Sprint 2)  
Source: 2026-04-06 sếp feedback — personal signals for My KOLs  
**Amendment:** Signals table now has `type` (0=shared, 1=personal) + `user_id` columns

| Field | Detail |
|-------|--------|
| Actor | System (cron daily after shared pipeline) |
| Action | Generate personal signals for each Pro/Power user from their My KOLs |
| Precondition | Shared pipeline completed; ≥1 Pro/Power user with My KOLs subscriptions |
| Steps | **FOR EACH Pro/Power user:** 1. Get My KOLs (my_source_subscriptions) → 2. Crawl tweets from My KOLs only (last 24h) → 3. Classify (signal_score ≥0.7) → 4. Cluster tweets (same as shared pipeline) → 5. Summarize clusters → 6. Rank → 7. Create Signal records with **`type=1`, `user_id=X`** → 8. Generate DraftTweets linked to personal signals |
| Guards | Skip if user has 0 My KOLs; Skip if 0 tweets from My KOLs today; Use same classify threshold (≥0.7); Personal cluster_id format: `{user_id}_{date}_cluster_{N}` |
| Result | Each Pro/Power user has personal signals (type=1) from their My KOLs in signals table |
| Error Cases | LLM error → skip user, retry next cycle; User deletes all My KOLs mid-run → skip gracefully; 0 signals for user → empty state OK (no alert) |

**Notes:**
- Personal signals are **separate** from shared signals (type=0)
- Same clustering logic but per-user tweet pool (not 500 KOL pool)
- Query: `WHERE type=1 AND user_id=X` for personal digest
- Toggle behavior: 
  - "All Sources" → Show `type=0` (shared)
  - "My KOLs" → Show `type=1, user_id=X` (personal)

---

CRUD Summaries (no full detail needed)

User registration/login: OAuth X.com (2.1 NFR — single provider) + session/Sanctum; không dùng email+password làm primary Phase 1. CRUD summary F01 trước đây ghi email+password — **đã lệch** so với NFR + Sprint 1.1–1.3; coi OAuth là chuẩn triển khai.
User selects categories (onboarding): Pick 1-3 from 10, saved to user.my_categories (F03, Section 5 Onboarding).
User updates delivery preferences: Toggle email/telegram/web in settings (F02, Section 3).
User views Signal detail: Click signal → modal/page showing full summary, all sources with links, draft (F13, F18).
User searches sources: Text search by name/@handle in Browse view (F06).
User unfollows source: Delete MySourceSubscription (F06).
Admin adds default source: Create Source (type='default'), assign categories (F04, F21).
Admin edits source categories: Update SourceCategory links (F21).
System creates daily Digest: Cron job at midnight UTC, creates Digest(date=today) if not exists [based on assumption #18].

---


---

### 7.X — Signal Ranking Formula (Phase 1 Baseline)

**Source:** Flow 3 Step 5 (Rank), [assumption #9], **Decision 5** (Use proposed weights, tune after dogfood)  
**Purpose:** Rank signals trong digest by importance/relevance  
**Location:** `config/signal_rank.php` (tunable via env vars)

---

**Formula:**

```
rank_score = (signal_score × W_signal) + (source_weight × W_source) + (recency_factor × W_recency)

where:
  W_signal = 0.4     (40% - content quality)
  W_source = 0.3     (30% - source credibility)
  W_recency = 0.3    (30% - timeliness)
```

**Result:** `rank_score` float 0.0-1.0, persisted in `signals.rank_score` column

---

**Component Calculations:**

#### 1. signal_score (from LLM classify step)

```
signal_score = LLM output (0.0-1.0)
  - Already computed in Flow 3 Step 2 (Classify)
  - Threshold ≥0.7 for is_signal=true
  - No additional transform needed
```

**Source:** Tweet.signal_score column (LLM output)

---

#### 2. source_weight (from follower count)

```
source_weight = min(1.0, follower_count_log / 6.0)

where:
  follower_count_log = log10(source.followers_count)
```

**Rationale:** Logarithmic scale to avoid mega-influencers dominating. Cap at 1.0.

**Examples:**
| Follower Count | log10 | source_weight |
|----------------|-------|---------------|
| 1,000,000 (1M) | 6.0 | 1.0 (capped) |
| 100,000 (100K) | 5.0 | 0.83 |
| 10,000 (10K) | 4.0 | 0.67 |
| 1,000 (1K) | 3.0 | 0.50 |
| 100 | 2.0 | 0.33 |

**Source:** Source.followers_count column (from twitterapi.io)

**Note:** If `followers_count` NULL or 0 → default to 0.33 (assume small account ~100 followers)

---

#### 3. recency_factor (from tweet posted_at)

```
recency_factor = max(0.0, 1.0 - (hours_since_posted / 24.0))

where:
  hours_since_posted = (NOW() - tweet.posted_at) in hours
```

**Rationale:** Linear decay over 24 hours. Tweets >24h old get 0.0 recency bonus.

**Examples:**
| Time Since Posted | hours_since_posted | recency_factor |
|-------------------|---------------------|----------------|
| 1 hour ago | 1.0 | 0.96 |
| 6 hours ago | 6.0 | 0.75 |
| 12 hours ago | 12.0 | 0.50 |
| 18 hours ago | 18.0 | 0.25 |
| 24 hours ago | 24.0 | 0.00 |
| 30 hours ago | 30.0 | 0.00 (capped) |

**Source:** Tweet.posted_at column

**Aggregation for multi-source signals:** Use **earliest** tweet in cluster (most recent = highest recency_factor)

---

**Implementation (Laravel):**

```php
// config/signal_rank.php
return [
    'signal_score_weight' => env('RANK_SIGNAL_WEIGHT', 0.4),
    'source_weight' => env('RANK_SOURCE_WEIGHT', 0.3),
    'recency_weight' => env('RANK_RECENCY_WEIGHT', 0.3),
];

// app/Services/PipelineService.php (Rank step)
public function calculateRankScore(Signal $signal): float
{
    $config = config('signal_rank');
    
    // 1. signal_score: avg across all tweets in cluster
    $avgSignalScore = $signal->tweets->avg('signal_score');
    
    // 2. source_weight: avg across all sources
    $sourceWeights = $signal->sources->map(function ($source) {
        $followerCount = $source->followers_count ?? 100;
        $log = log10($followerCount);
        return min(1.0, $log / 6.0);
    });
    $avgSourceWeight = $sourceWeights->avg();
    
    // 3. recency_factor: use earliest (most recent) tweet
    $earliestTweet = $signal->tweets->sortBy('posted_at')->first();
    $hoursOld = now()->diffInHours($earliestTweet->posted_at);
    $recencyFactor = max(0.0, 1.0 - ($hoursOld / 24.0));
    
    // Weighted sum
    $rankScore = 
        ($avgSignalScore * $config['signal_score_weight']) +
        ($avgSourceWeight * $config['source_weight']) +
        ($recencyFactor * $config['recency_weight']);
    
    return round($rankScore, 4); // 4 decimal precision
}
```

---

**Tuning Strategy:**

**Phase 1 Week 1 (Baseline):**
- Use default weights (0.4, 0.3, 0.3)
- No adjustments

**Phase 1 Week 2+ (Tune based on dogfood):**

Monitor metrics:
- **Click-through:** Which signals founder clicks to read detail?
- **Copy rate:** Which signals founder copies draft?
- **Skip rate:** Which signals founder skips?

**Tuning scenarios:**

| Observation | Action | New Weights Example |
|-------------|--------|---------------------|
| Large KOL spam buries important signals | Reduce source_weight | signal=0.5, source=0.2, recency=0.3 |
| Old-but-important signals buried by recency | Reduce recency_weight | signal=0.5, source=0.3, recency=0.2 |
| Low-quality signals rank high | Increase signal_score weight | signal=0.6, source=0.2, recency=0.2 |
| Fresh but trivial news ranks too high | Reduce recency, increase signal | signal=0.5, source=0.3, recency=0.2 |

**Adjustment mechanism:**
1. Update `.env`:
   ```env
   RANK_SIGNAL_WEIGHT=0.5
   RANK_SOURCE_WEIGHT=0.2
   RANK_RECENCY_WEIGHT=0.3
   ```
2. Re-run pipeline (no code change needed)
3. Monitor for 2-3 days
4. Iterate

**A/B Testing (Phase 2):**
- Split users: 50% baseline, 50% tuned weights
- Compare engagement metrics
- Roll out winner

---

**Validation:**

After rank calculation, verify:
1. ✅ `rank_score` ∈ [0.0, 1.0]
2. ✅ No NULL values
3. ✅ Weights sum to 1.0 (0.4 + 0.3 + 0.3 = 1.0)

**On validation failure:** Log error, default to `rank_score = 0.5` (middle value)

---

**Performance Notes:**

- **Calculation timing:** Once per signal during pipeline (Flow 3 Step 5)
- **No re-calculation:** `rank_score` persisted, immutable after signal published
- **Query:** Digest endpoint ORDER BY rank_score DESC (indexed column)

---

**Phase 2 Enhancements (Not Implemented Phase 1):**

1. **User engagement feedback loop:**
   - Track UserInteraction (click/skip/copy_draft)
   - Adjust weights per-user based on behavior
   - Personalized ranking

2. **Category-specific weights:**
   - Crypto: Higher recency_weight (fast-moving news)
   - Research: Higher signal_score (content quality matters more)
   - Marketing: Balanced

3. **Collaborative filtering:**
   - "Users who engaged with Signal A also engaged with Signal B"
   - Boost rank_score for similar signals

4. **Time-of-day adjustment:**
   - Morning digest: Prioritize overnight news (high recency)
   - Evening digest: Prioritize quality over recency

**Decision:** Defer to Phase 2. Phase 1 = simple baseline, tune manually.

## Section 8 — Data Model
**Source:** 2.2c Phần 1–2
**Last confirmed:** 2026-04-06 (physical schema = source of truth in `SPEC-api` Section 9)

Category  
Lifecycle: No lifecycle — CRUD only (read-only)  
Lifecycle Source: 2.2b Section 3 — Category classification, "Static lookup table, no create/update/delete Phase 1"

| Field | Type | Required | Source | Validation | Notes |
|-------|------|----------|--------|------------|-------|
| id | identifier | yes | platform convention — PK standard | reference integrity | — |
| name | string | yes | user input — 2.2a Section 3 Domain Model, 10 categories hardcoded | platform invariant — one of 10 predefined categories | Seeded via migration: AI & ML, Developer Tools, Indie Hackers & SaaS, Marketing & Growth, Startup & VC, Crypto & Web3, Finance & Markets, Design & Product, Creator Economy, Tech Industry & Policy |
| slug | string | yes | platform convention — URL-safe identifier | platform invariant — unique, lowercase, hyphenated | API filtering, e.g. `ai-ml`, `crypto-web3` |
| created_at | date-time | yes | platform convention — 2.2b audit metadata | — | Seeded at migration |

Source  
Lifecycle: Full state machine  
Lifecycle Source: 2.2b Section 3 — Source state machine; **Phase 1 Option A:** `type='user'` tạo với `status='active'` (vào pool + crawl ngay); `pending_review` giữ trong enum cho tương lai / Option B.

| Field | Type | Required | Source | Validation | Notes |
|-------|------|----------|--------|------------|-------|
| id | identifier | yes | platform convention — PK standard | reference integrity | — |
| type | enum | yes | user input — 2.2a Entity Relationship Source | platform invariant — `default` or `user` | Default = platform curated; User = user-added |
| handle | string | yes | 2.2a Flow 1 Step 1 "user inputs @handle" | 2.2a Flow 1 Guard: X username format (alphanumeric + underscore, 1–15 chars) | Without `@` prefix; unique |
| account_url | string | yes | system — construct from handle | valid Twitter profile URL | `https://twitter.com/{handle}` |
| display_name | string | no | system — 2.2a Flow 1 Step 2, twitterapi.io | — | From profile; may change |
| is_public | boolean | yes | system — Flow 1 Step 2 | 2.2a Guard: account public | From twitterapi.io |
| is_active | boolean | yes | system — Flow 1 Step 2 | ≥1 tweet in 30 days [assumption #5] | Avoid dead accounts |
| status | enum | yes | state — Section 4 Source machine | `pending_review`, `active`, `spam`, `deleted` | Phase 1: `type='user'` mặc định **`active`** (Option A); `pending_review` không dùng happy-path add |
| added_by | relation → User | yes (`type='user'`) | 2.2a Flow 1 Step 4 | reference integrity | NULL if `type='default'` |
| last_crawled_at | date-time | no | Flow 3 crawl — `SPEC-api` 2026-04-06 | — | Per-source watermark for twitterapi loop |
| created_at | date-time | yes | platform convention — 2.2b | — | — |
| updated_at | date-time | yes | platform convention — 2.2b | — | When status/categories change |
| deleted_at | date-time | no | 2.2b soft delete | — | Soft delete; preserve history |

SourceCategory (M:N junction)  
Lifecycle: No lifecycle — CRUD only  
Lifecycle Source: 2.2b Section 3 — SourceCategory, "Pivot table, no status field"

| Field | Type | Required | Source | Validation | Notes |
|-------|------|----------|--------|------------|-------|
| id | identifier | yes | platform convention — PK standard | reference integrity | — |
| source_id | relation → Source | yes | 2.2a SourceCategory M:N | reference integrity | — |
| category_id | relation → Category | yes | 2.2a SourceCategory M:N | reference integrity | — |
| created_at | date-time | yes | platform convention — 2.2b | — | — |

Validation: Unique `(source_id, category_id)`. Per 2.2a Flow 1 Guard "≥1 category" → each Source has ≥1 SourceCategory record.

User  
Lifecycle: Simple status  
Lifecycle Source: 2.2b Section 3 — User classification, "User.plan enum, no complex lifecycle"

**Auth Note:** Phase 1 uses OAuth X.com only per NFR. OAuth fields (`x_user_id`, `x_username`, `x_access_token`, `x_refresh_token`, `x_token_expires_at`) in schema (Section 9). `email`, `password_hash` nullable Phase 1; required Phase 2 if email/password auth added.

| Field | Type | Required | Source | Validation | Notes |
|-------|------|----------|--------|------------|-------|
| id | identifier | yes | platform convention — PK standard | reference integrity | — |
| x_user_id | string | yes (OAuth) | OAuth X.com Phase 1 PRIMARY | unique X user id | NOT NULL for OAuth users |
| x_username | string | no | OAuth X.com profile | — | X @handle from profile |
| x_access_token | string | no | OAuth token exchange | — | Encrypted at app layer |
| x_refresh_token | string | no | OAuth token exchange | — | Encrypted at app layer |
| x_token_expires_at | date-time | no | OAuth token | — | Refresh logic |
| email | string | no (Phase 1) | 2.2a F01 (Phase 2) | valid email, unique | Nullable Phase 1; required Phase 2 if email/password |
| email_valid | boolean | no | Resend bounce webhook | — | `false` = bounce; default true |
| password_hash | string | no (Phase 1) | 2.2a F01 (Phase 2) | — | Nullable OAuth-only; bcrypt/argon2 Phase 2 |
| name | string | no | OAuth profile or manual | — | Optional display name |
| plan | enum | yes | 2.2a F02 | `free`, `pro`, `power` | Default `free`; Stripe webhook |
| my_categories | array → Category | yes | 2.2a Onboarding | 1–3 categories | Digest filter |
| delivery_preferences | object | yes | 2.2a Entity Relationship | `{email, telegram, web}` booleans | Plan-gated Pro+ |
| telegram_chat_id | string | no | Telegram `/start` [assumption #2] | — | F17; NULL if disconnected |
| stripe_customer_id | string | no | Stripe Checkout [assumption #3] | — | NULL if never upgraded |
| is_admin | boolean | yes | 2026-04-06 — admin API | default `false` | `/api/admin/*` guard |
| created_at | date-time | yes | 2.2b audit | — | — |
| updated_at | date-time | yes | 2.2b audit | — | — |

MySourceSubscription (M:N junction — User ↔ Source for My KOLs)  
Lifecycle: Simple flag  
Lifecycle Source: 2.2b Section 3 — MySourceSubscription, "Boolean existence = subscribed"

| Field | Type | Required | Source | Validation | Notes |
|-------|------|----------|--------|------------|-------|
| id | identifier | yes | platform convention — PK standard | reference integrity | — |
| user_id | relation → User | yes | 2.2a M:N junction | reference integrity | — |
| source_id | relation → Source | yes | 2.2a M:N junction | reference integrity | — |
| created_at | date-time | yes | 2.2b audit | — | "First 10" on downgrade [2.2b assumption #10] |

Validation:

Unique constraint on (user_id, source_id).
Cap enforcement per 2.2a Flow 2 Guards: Pro max 10, Power max 50, Free = 0.
Per 2.2a Permission Matrix: Free users have no MySourceSubscription records.


Tweet  
Lifecycle: Simple flag  
Lifecycle Source: 2.2b Section 3 — Tweet, "Crawled → classified, immutable after classification"

| Field | Type | Required | Source | Validation | Notes |
|-------|------|----------|--------|------------|-------|
| id | identifier | yes | platform convention — PK | reference integrity | — |
| source_id | relation → Source | yes | 2.2a Tweet N:1 Source | reference integrity | — |
| tweet_id | string | yes | 2.2a Flow 3 Crawl, twitterapi.io | unique Twitter id | External id |
| text | text | yes | Flow 3 Crawl | — | Raw tweet; threads OK |
| url | string | yes | Flow 3 Crawl | valid status URL | `https://twitter.com/{handle}/status/{tweet_id}` |
| posted_at | date-time | yes | Flow 3 Crawl | — | Original tweet time |
| is_signal | boolean | yes | Flow 3 Classify | threshold ≥0.7 [assumption #7] | TRUE if `signal_score` ≥ 0.7 |
| signal_score | decimal | yes | Flow 3 Classify | 0.0–1.0 | LLM confidence |
| created_at | date-time | yes | 2.2b audit | — | Row created in DB |
| deleted_at | date-time | no | 2.2b Tweet soft delete | — | If Source deleted and not linked to Signal |

Signal  
Lifecycle: Simple lifecycle (no user-facing state machine)  
Lifecycle Source: 2.2b Section 3 — Signal, "Created by Pipeline, no user-editable state"

| Field | Type | Required | Source | Validation | Notes |
|-------|------|----------|--------|------------|-------|
| id | identifier | yes | platform convention — PK | reference integrity | — |
| cluster_id | string | yes | Flow 3 Cluster | unique per pipeline run | UUID or date_hash |
| title | string | yes | Flow 3 Summarize | ≤10 words | Headline |
| summary | text | yes | Flow 3 Summarize | 50–100 words | From tweets |
| source_count | integer | yes | derived — Phần 2 | — | Unique KOLs count |
| rank_score | decimal | yes | Flow 3 Rank | 0.0–1.0 | f(source_count, avg_signal_score, recency_decay) [assumption #9] |
| categories | array → Category | yes | derived — Phần 2 | — | Inferred from sources |
| topic_tags | array of string | yes | Flow 3 Summarize F11 | 1–3 tags | Filter tags |
| date | date | yes | Flow 3 Step 8 Digest attach | YYYY-MM-DD | Filter / archive |
| created_at | date-time | yes | 2.2b audit | — | Pipeline time |
| published_at | date-time | yes | 2.2b lifecycle | — | Attached to digest |

SignalSource (M:N — Signal ↔ Tweet ↔ Source)  
Lifecycle: No lifecycle — CRUD only  
Lifecycle Source: 2.2b Section 3 — SignalSource, "Pivot immutable after creation"

| Field | Type | Required | Source | Validation | Notes |
|-------|------|----------|--------|------------|-------|
| id | identifier | yes | platform convention — PK | reference integrity | — |
| signal_id | relation → Signal | yes | 2.2a M:N | reference integrity | — |
| tweet_id | relation → Tweet | yes | 2.2a M:N | reference integrity | — |
| source_id | relation → Source | yes | 2.2a M:N; denormalized from Tweet [assumption #4] | reference integrity | My KOLs filter perf |
| created_at | date-time | yes | 2.2b audit | — | — |

Validation: Unique `(signal_id, tweet_id)`. F18 attribution: who said what, link, timestamp, KOL count.

DraftTweet  
Lifecycle: No lifecycle — CRUD only  
Lifecycle Source: 2.2b Section 3 — DraftTweet, "Generated when Signal created, immutable"

| Field | Type | Required | Source | Validation | Notes |
|-------|------|----------|--------|------------|-------|
| id | identifier | yes | platform convention — PK | reference integrity | — |
| signal_id | relation → Signal | yes | 2.2a 1:1 | unique | 1 draft per signal Phase 1 |
| text | string | yes | Flow 3 Draft | ≤280 chars; tone; no exact copy [assumption #11] | Composer-ready |
| created_at | date-time | yes | 2.2b audit | — | — |

Digest  
Lifecycle: No lifecycle — CRUD only  
Lifecycle Source: 2.2b Section 3 — Digest, "Created daily, one per day"

| Field | Type | Required | Source | Validation | Notes |
|-------|------|----------|--------|------------|-------|
| id | identifier | yes | platform convention — PK | reference integrity | — |
| date | date | yes | 2.2a CRUD midnight UTC [assumption #18] | unique YYYY-MM-DD | One digest per day |
| created_at | date-time | yes | 2.2b audit | — | Midnight UTC |
| deleted_at | date-time | no | 2.2b F20 archive | — | Soft delete after 30 days |

Note: Signals link via `Signal.date` FK; no Digest–Signal junction. Container semantics, not ownership.

UserInteraction  
Lifecycle: No lifecycle — CRUD only (append-only)  
Lifecycle Source: 2.2b Section 3 — UserInteraction, "Append-only log"

| Field | Type | Required | Source | Validation | Notes |
|-------|------|----------|--------|------------|-------|
| id | identifier | yes | platform convention — PK | reference integrity | — |
| user_id | relation → User | yes | 2.2a N:1 | reference integrity | — |
| signal_id | relation → Signal | yes | 2.2a N:1 | reference integrity | — |
| action | enum | yes | 2.2a Entity Relationship | `click`, `skip`, `copy_draft`, `edit_draft` | Events SignalClicked, DraftCopied |
| time_on_signal | integer | no | 2.2a Entity | ≥0 if set | Seconds; NULL for skip |
| created_at | date-time | yes | 2.2b audit | — | Interaction time |

Note: Product Strategy Rule #1 — Phase 1 capture only; Phase 2 moat [2.2a assumption #12].

### Phần 2 — Derived / Computed Fields

| Entity | Field | Formula / logic | Persisted hay computed | Source of truth | Recalculate trigger | Source (ref) | Lý do |
|--------|-------|-----------------|-------------------------|-----------------|---------------------|--------------|-------|
| Signal | source_count | Count unique sources via SignalSource → Tweet → Source | Persisted (cached projection) | Flow 3 step 7 | When SignalSource rows added; immutable after publish | Flow 3 Rank, F18 | Ranking + UI; avoid JOIN count |
| Signal | categories | Aggregate categories from sources via SignalSource → Source → SourceCategory | Persisted (cached projection) | Flow 3 step 7 | Same as above | Domain Signal.categories, F13/F14 | `categories && user.my_categories` query |
| User | my_kols_count [assumption #5] | COUNT MySourceSubscription for user | Computed | — | On subscribe/unsubscribe | Flow 2 cap, F06 | Cap UI + guard |
| Source | signal_count [assumption #6] | COUNT SignalSource for source_id | Computed [assumption #7 TBD] | — | On demand | F15 stats | My KOLs stats; may cache Phase 2 |
| Source | last_active_date [assumption #6] | MAX(Tweet.posted_at) for source | Computed [assumption #7] | — | On demand | F15 stats | "Last active" display |
| Digest | signal_ids | `Signal.id` WHERE `Signal.date` = Digest.date | Relation-backed (not column) | Signal.date FK | — | F13, Entity Relationship | Query: filter by date, ORDER BY rank_score |

Notes:

- **Signal.source_count**, **Signal.categories:** Persisted; immutable after pipeline publish; no recalculation trigger; optimizes digest filter + ranking.
- **User.my_kols_count**, **Source.signal_count**, **Source.last_active_date:** Computed; change often or page-specific (My KOLs stats); cache strategy Phase 2 per 2.2b assumption #11.
- **Digest.signal_ids:** Not a column — relation via `Signal.date` FK; listed for digest–signal query clarity.
