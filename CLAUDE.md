# CLAUDE.md

**Project:** SignalFeed  
**Trạng thái:** Đồng bộ với **SPEC bundle** — lock gốc 2026-04-03 + **amendment 2026-04-06** — xem `SPEC.md` (Lock & human sign-off). Mọi thay đổi hành vi/schema/API sau amendment = **change request** (mẫu trong `SPEC.md`).  
**Phiên bản stack:** Các số như PHP 8.2 / Laravel 11 lấy từ `SPEC-core.md` Mục 3; khi khởi tạo môi trường thực tế, xác nhận lại `composer.json` / `.env`.  
**Đồng bộ roadmap (2026-04-06 + CR 2026-04-15 + CR 2026-04-16):** `IMPLEMENTATION-ROADMAP.md` và file này khớp review: crawl **4×/ngày**; twitterapi **`advanced_search`** theo **Báo cáo POC**; `sources.last_crawled_at` + vòng lặp crawl; **`TweetFetchProviderInterface`**; clustering **prompt-based**; `users.is_admin`; onboarding Step 2 `/onboarding/sources` (filter `my_categories`, follow/skip); **personal signals** — `signals.type=1` + `user_id`, pipeline **Flow 8**, task **2.6.x** (CR 2026-04-15 part 2). Hợp đồng vendor chi tiết = **`SPEC-api.md`** (canonical); `API-CONTRACTS.md` là bản tóm tắt đồng bộ.

**Nguồn chi tiết:** `SPEC-core.md` (Mục 1–8), `SPEC-api.md` (Mục 9–11), `SPEC-plan.md` (Mục 12–13 + Phụ lục). Roadmap task: **`IMPLEMENTATION-ROADMAP.md`** (không nhân đôi trong SPEC-plan).

---

## Project Overview

SignalFeed aggregates signal from noise across 500+ curated tech/crypto/marketing KOL Twitter accounts. Users receive daily AI-clustered digest of important signals with ready-to-post tweet drafts, replacing 1-2 hours of manual scrolling with a 5-minute consumption flow. Target users: tech builders (AI focus), marketers, crypto professionals who follow KOLs for competitive intelligence and miss critical signals in information overload.

---

## Tech Stack

| Thành phần | Giá trị (theo SPEC) |
|------------|---------------------|
| Runtime | PHP 8.2+ |
| Framework | Laravel 11.x |
| Frontend | React 18+ (Vite) |
| Database | PostgreSQL 15+ |
| Queue | Laravel Queue (Redis ưu tiên, DB fallback) |
| Scheduler | Laravel Scheduler (cron → pipeline crawl/pipeline theo **4 lần/ngày** (UTC slots trong env) — xem `SPEC-core` Flow 3; đổi lịch = **CR** rồi mới đổi `schedule()`) |
| Cache | Redis (tentative) |
| Auth | Laravel Sanctum + OAuth X.com (Socialite) |
| External APIs | **twitterapi.io** (crawl — path chính **`advanced_search`** per POC + `SPEC-api` Phần 2; implement trong `TwitterApiIoTweetProvider` chứ không trong Service), Anthropic (Claude Haiku — cluster Phase 1 **prompt-based**), Resend, Telegram Bot API |
| Deployment | Railway hoặc Render (tentative) |

---

## Architecture Rules

**Layer dependency (SPEC Mục 3):**

- Controller → Service → Model (data layer)
- Controller → Action → Model (single-purpose operations)
- Service có thể gọi Repository (truy vấn phức tạp) hoặc Eloquent trực tiếp (CRUD đơn giản)
- Jobs gọi Service — **không** gọi Controller
- Event Listeners gọi Service cho side effects
- External Service Adapters bọc HTTP client — Service gọi adapter
- **Crawl tweet:** Service chỉ phụ thuộc **`TweetFetchProviderInterface`** (implementations trong `app/Integrations/*Provider`); binding theo env — **không** gọi trực tiếp vendor (xem `SPEC-core` §3.2 LOCK, `SPEC-api` Section 10 §0)
- **Không** Model → Service (một chiều)

**Pattern (SPEC Mục 3):**

| Pattern | Thư mục |
|---------|---------|
| Service Layer | `app/Services/` |
| Repository (chọn lọc) | `app/Repositories/` |
| Jobs | `app/Jobs/` |
| Actions | `app/Actions/` |
| Events / Listeners | `app/Events/`, `app/Listeners/` |
| Integrations | `app/Integrations/` |
| API Resources | `app/Http/Resources/` |

---

## Database Conventions

- Naming: `snake_case` bảng/cột (SPEC Mục 9)
- PK: BIGSERIAL auto-increment (UUID nếu sau này cần ID công khai — xem SPEC-api)
- Timestamp: `created_at`, `updated_at` — `TIMESTAMPTZ`, lưu UTC (Constraint #11 / NFR)
- Soft delete: `deleted_at` cho `Source`, `Tweet`, `Digest` khi áp dụng
- Multi-tenant prep: `tenant_id DEFAULT 1` trên các bảng core (NFR #5, #6)
- Array / JSONB: Postgres arrays + JSONB theo schema Mục 9
- Audit: bảng `audit_logs` + **`SPEC-api` Section 9 §1.3.1** (danh mục `event_type` + **write mechanism** — `AuditLogService` / listener; `api_call_outbound` cho HTTP vendor, sample hoặc on-error)
- **Crawl / sources:** cột **`sources.last_crawled_at`** trong **`SPEC-api` Section 9** (2026-04-06) — migration phải khớp schema lock

---

## API Conventions

- REST, URL dạng `/api/{resource}` — **không** prefix `/v1/` Phase 1 (SPEC Mục 11)
- Auth: Sanctum; đăng nhập: OAuth X.com
- Lỗi: `{"error": {"code": "...", "message": "...", "details": {...}}}`
- Phân trang: `?page=` & `per_page=` (mặc định 20)
- Envelope: `{"data": ..., "meta": ...}` khi phân trang
- Filter tiêu biểu: `?status=`, `?category_id[]=`, `?my_sources_only=true`, `?date=YYYY-MM-DD`

---

## State Machines

**Source** (SPEC Mục 4):

- Enum: `pending_review`, `active`, `spam`, `deleted`
- **Phase 1 — Option B (CR 2026-04-13):** user thêm nguồn → `status='pending_review'`; chỉ sau admin `approve` mới sang `active` và tham gia crawl/browse
- Chi tiết chuyển trạng thái: `SPEC-core.md` Mục 4

**User.plan:** `free` | `pro` | `power` — đổi qua Stripe webhook (không sửa tay plan trong API user-facing)

**MySourceSubscription:** có bản ghi = đang follow; không có trường status

**Khác:** Tweet, Signal, Digest, DraftTweet, Category, UserInteraction — vòng đời đơn giản / CRUD (xem SPEC)

---

## Business Rules — Do NOT Violate

**OAuth-only (Phase 1):** Không triển khai email/password làm auth chính Sprint 1; endpoint placeholder Phase 2. User OAuth cần `x_user_id`, token (SPEC + NFR).

**Cap My KOLs (SPEC Mục 7 Flow 2, CR 2026-04-16):** Free ≤**5**, Pro ≤10, Power ≤50 subscription — kiểm tra **trước** khi tạo `MySourceSubscription`; vượt → 400 `SUBSCRIPTION_CAP_EXCEEDED` + prompt nâng cấp / unfollow.

**Thêm nguồn (Flow 1):** Tài khoản public X; ≥1 tweet 30 ngày; ≥1 category; chỉ Pro/Power.

**Pipeline (Flow 3):** `signal_score ≥ 0.7` cho signal; cluster ≥2 nguồn hoặc 1 nguồn với score ≥0.9; tóm tắt trích dẫn tweet; draft không copy nguyên văn tweet.

**Free tier (SPEC Mục 6):** 3 digest/tuần (Mon/Wed/Fri — enforcement tại job/API theo spec); **được follow My KOLs cap 5 nhưng không chạy Flow 8**; không draft copy; không email/Telegram (web only).

**Admin (Flow 6):** Không hard-delete Source đã có Signal; chỉnh category ≥1; middleware admin.

**Soft delete Source:** Giữ `MySourceSubscription` đến khi user unfollow.

---

## Scope Boundaries

**Trong Phase 1 (tóm tắt):** OAuth, onboarding 2-step (category + optional KOL follow/skip), pool KOL, pipeline AI, digest web, My KOLs (Free/Pro/Power với cap theo plan), draft + Twitter intent (Pro/Power), tier Free/Pro/Power, Stripe, admin moderation + pipeline monitor, SPA responsive, **Archive save/list flow**, **Settings persistence**, **đa ngôn ngữ UI (en/vi baseline)** theo roadmap cập nhật.

**Ngoài / hoãn:** Auth email/password chính, Telegram real-time, email digest (tuỳ sprint — xem OQ), **full-text archive keyword search** (Phase 2+), “Flag as Noise” (OQ), app native.

---

## Wedge & Kill Checkpoint

**Sprint 1 (wedge):** Theo **SPEC-core Flow 3**: crawl (scheduler **4×/ngày**) → classify → cluster → summarize → rank → draft; UI digest; attribution; draft; onboarding Step 2 `/onboarding/sources` lọc theo `my_categories` + follow/skip. **Tích hợp crawl:** inject **`TweetFetchProviderInterface`**; implementation đúng **POC**; cập nhật **`last_crawled_at`**; loop/stagger theo rate limit — task **1.6.x** trong `IMPLEMENTATION-ROADMAP.md`.

**Kill (cuối Sprint 1 / PRODUCT-STRATEGY):** Landing <5% signup; <10 paying sau 4 tuần; Reddit 2 tuần không organic; founder không dogfood daily sau 1 tuần.

**POST-WEDGE:** My KOLs đầy đủ, billing, admin nâng cao — Sprint 2–3; xem `SPEC-plan.md` Mục 13 + `IMPLEMENTATION-ROADMAP.md`. **Personal signals Pro/Power (Flow 8)** — `signals.type=1` + `user_id`, job sau shared pipeline, task **2.6.1–2.6.3** (CR 2026-04-15 part 2); **Free** có follow (cap 5) nhưng **không** chạy Flow 8 — `my_sources_only` = lọc **`type=0`** theo follow (**CR 2026-04-16**).

---

## Decisions Already Locked (không cần “mở lại” trừ change request)

- **Source workflow Phase 1:** Option B — `type=user` → `pending_review`; admin `approve` rồi mới `active` (đã chốt qua CR 2026-04-13, đồng bộ SPEC + roadmap task 2.1.x/3.3.x).
- **SPEC bundle:** LOCKED + amendment 2026-04-06 — mọi thay đổi sau đó quy trình **change request** trong `SPEC.md`.

---

## Open Items — Resolve Before / During Implementation

Các mục sau **vẫn mở** hoặc phụ thuộc môi trường; không tự ý “chốt” trong code mà không ghi nhận (xem `SPEC-plan.md` Appendix A / `IMPLEMENTATION-ROADMAP.md` Open Questions):

| Chủ đề | Ghi chú |
|--------|---------|
| **CSV 500 KOL** | Sẵn sàng import hay cần curation? — ảnh hưởng seed `SourcePoolSeeder` |
| **Backfill tweets** | Crawl từ đầu hay chỉ forward — ảnh hưởng tín hiệu ban đầu / kill test |
| **Flag as Noise (F17 Appendix)** | Phase 1 hay Phase 2 — ảnh hưởng Digest UI |
| **E2E: Dusk vs Playwright** | Chọn trước khi dựng khung E2E |
| **Blocker API 2.2d #1–7** | Account/key twitterapi.io, Anthropic, Stripe test, Resend… — cần trước khi code pipeline |
| **Email digest Sprint 1?** | Có cần cho kill checkpoint không — xem Sprint Plan OQ |
| **My KOLs toggle trên digest** | Sprint 1 (wedge) hay Sprint 2 — ảnh hưởng có/không `MySourceSubscription` sớm |
| **Landing page** | Kill checkpoint #1 cần landing — roadmap ghi nhận có thể ngoài task list dev |
| **Admin rank override Signal** | Endpoint/UI chưa trong roadmap — xung đột immutability vs F22; cần quyết định sản phẩm |
| **twitterapi.io vs POC** | **Đã chốt trong `SPEC-api` Phần 2** — primary `advanced_search`; code theo POC + mapping SPEC |
| **`last_crawled_at` + crawl loop** | **Cột trong `SPEC-api` §9**; logic trong Pipeline job (roadmap **1.6.2**) |
| **Clustering** | **Phase 1 = prompt-based** (đã ghi `SPEC-api` changelog + Flow 3) — task **1.8.1** theo hướng đó |
| **Admin guard** | **`users.is_admin`** trong schema `SPEC-api` §9 + middleware admin — xem REST `/api/admin/*` |
| **My KOLs + personal signals** | **CR 2026-04-16:** Free follow cap **5** (shared `my_source_subscriptions`); Flow 8 / `type=1` chỉ Pro/Power; task **2.6.x** + subscribe **2.2.x** |

---

## File Structure

Cấu trúc dưới đây là **rút gọn**; cây đầy đủ, ghi chú Loại A/B: **`SPEC-plan.md` — Section 12 — Phần 5 — File Structure**.

```
signalfeed/                          # Laravel project root
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Auth/                # OAuth X.com
│   │   │   ├── Api/                 # REST cho React SPA
│   │   │   └── Admin/               # Moderation nguồn, pipeline monitor
│   │   ├── Middleware/
│   │   └── Resources/               # API Resources
│   ├── Services/                    # PipelineService, SourceService, DigestService, …
│   ├── Actions/                     # AddSourceToPoolAction, SubscribeToSourceAction, …
│   ├── Repositories/                # Tùy chọn — truy vấn phức tạp (vd. SignalRepository)
│   ├── Models/
│   ├── Jobs/                        # PipelineCrawlJob, SendDigestEmailJob, LogUserInteractionJob, …
│   ├── Events/ + Listeners/
│   ├── Integrations/                # TwitterApiIoTweetProvider (+ alt providers), LLMClient, StripeClient, EmailClient, TelegramClient
│   └── Console/                     # Kernel (scheduler), Commands (GDPR, …)
├── database/
│   ├── migrations/
│   ├── factories/
│   └── seeders/                     # CategorySeeder, SourcePoolSeeder (500 KOL)
├── routes/                          # api.php, web.php (OAuth callback, privacy)
├── resources/
│   ├── js/                          # React + Vite (components/pages/App)
│   └── views/                       # Blade tối thiểu (privacy-policy, …)
├── storage/
├── tests/                           # Unit / Feature / Browser (Dusk hoặc Playwright — OQ)
├── config/
├── public/
├── .env.example
├── composer.json
├── package.json
└── vite.config.js
```

**Phân loại nhanh:**

- **Loại A (kiến trúc):** `Controllers`, `Services`, `Actions`, `Repositories`, `Models`, `Jobs`, `Events`/`Listeners`, `Integrations`
- **Loại B (hỗ trợ):** `database/*`, `routes`, `resources`, `storage`, `tests`, `config`, `public`

---

## Related Docs (đọc theo thứ tự khi không chắc)

| File | Nội dung |
|------|----------|
| `SPEC.md` | Index bundle + lock + VALIDATION-LOG + mẫu change request |
| `SPEC-core.md` | Tổng quan, NFR, kiến trúc, máy trạng thái, miền, quyền, luồng, data model |
| `SPEC-api.md` | Schema DB, hợp đồng API ngoài, đặc tả REST |
| `SPEC-plan.md` | Test, deploy, **file structure đầy đủ**, UI screens, Sprint Plan, Appendix, Consistency Report |
| `docs/prompts/v1/` | Prompt LLM classify / cluster / summarize / draft (versioned; xem `README.md`) |
| `IMPLEMENTATION-ROADMAP.md` | Task 1.x.x–3.x.x, depends-on, verify method |
| `PRODUCT-STRATEGY.md` | Chiến lược sản phẩm (nhúng tóm tắt trong SPEC-core Mục 1) |
| `API-CONTRACTS.md` | Tóm tắt hợp đồng dịch vụ ngoài — luôn đối chiếu **`SPEC-api.md`** nếu lệch. |
| `SETUP-GUIDE.md` | *(Chưa bắt buộc — tạo sau khi scaffold môi trường.)* |

---

## Cách dùng file này (agent / developer)

1. **Ưu tiên:** Không vi phạm mục **Business Rules** và **State Machines** trên; chi tiết số cột DB và endpoint lấy từ **SPEC-api**.
2. **Khi đụng task cụ thể:** Tra **`IMPLEMENTATION-ROADMAP.md`** (số task) và **`SPEC-plan`** (màn hình #n).
3. **Khi đổi hành vi sản phẩm / schema / API:** Không sửa spec ngầm — làm **change request** theo `SPEC.md`.

---

*End of CLAUDE.md*
