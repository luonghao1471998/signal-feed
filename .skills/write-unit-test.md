# Skill: Viết unit / feature test (SignalFeed)

**Tham chiếu:** `SPEC-plan.md` Section 12 (Delivery — Testing strategy), `SPEC-core.md` flows & guards, `IMPLEMENTATION-ROADMAP.md` (verify method từng task).

**Stack:** Laravel 11 test harness (PHPUnit mặc định; **Pest** chỉ khi dự án đã chốt trong `composer.json` — spec ghi “implementation phase confirms”).

---

## Phân tầng test (SPEC-plan)

| Layer | Thư mục | Ưu tiên / mục đích |
|-------|---------|---------------------|
| **Unit** | `tests/Unit/` | Service: cap My KOLs, rank formula, chuyển trạng thái Source, guard Flow 1–3 — **mock** Integration (`LLMClient`, `TweetFetchProvider`). |
| **Feature** | `tests/Feature/` | HTTP API: Sanctum, FormRequest 422, 403 plan, envelope `error.code`, DB assert. |
| **Browser / E2E** | `tests/Browser/` | Auth + payment + luồng critical — **Dusk hoặc Playwright** (Open Question trong spec; chọn một trước khi viết hàng loạt). |

SPEC-plan: **Unit = highest priority** cho business logic Service; integration với vendor = contract test khi có key thật / mock HTTP.

---

## Quy ước Laravel

- **`RefreshDatabase`** (hoặc `LazilyRefreshDatabase`) cho Feature test chạm DB.
- **Factory** (`database/factories/`) cho `User`, `Source`, … — khớp constraint spec (plan, `is_admin`, v.v.).
- Fake: `Http::fake()`, `Queue::fake()`, `Event::fake()` khi assert side effect không cần chạy thật.
- **Không** gọi API ngoài (twitterapi, Anthropic) trong CI unit/feature — stub provider interface.

---

## Checklist test cho một endpoint

- [ ] Happy path → status + `data` shape tối thiểu theo `SPEC-api` §11.
- [ ] Validation → **422** + `error.code` / `details` field-level nếu spec có.
- [ ] Unauthenticated → **401** (Sanctum).
- [ ] Plan / role → **403** (Free vs Pro/Power, admin).
- [ ] Idempotency / conflict → **409** nếu endpoint spec có (webhook xem `create-webhook-handler.md`).

---

## Checklist test cho Service (unit)

- [ ] Mỗi nhánh guard (vd. cap subscription, không category, signal threshold).
- [ ] Mock interface thay vì concrete Integration.
- [ ] Không assert qua HTTP nếu mục tiêu là pure Service — gọi class trực tiếp.

---

## Crawl / pipeline

- **Pipeline / Job:** Feature hoặc Unit với `TweetFetchProviderInterface` bind fake; assert `last_crawled_at` / tweet insert theo task 1.6.2 spec.

---

## Anti-pattern

- Test phụ thuộc thứ tự chạy hoặc DB shared không rollback.
- Hardcode magic không có trong spec (vd. rank weight) — lấy từ `config` hoặc hằng đã document.
- Thêm framework test mới (Pest plugin, v.v.) khi chưa có trong dependency lock.
