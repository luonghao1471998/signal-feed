# SPEC — SignalFeed (split assembly)

**Ngày merge:** 2026-04-02  
**Đồng bộ sau review (OAuth + schema + format):** 2026-04-03  
**Bổ sung kỹ thuật / sản phẩm (review):** 2026-04-06 — cập nhật **`SPEC-core.md`**, **`SPEC-api.md`**, **`SPEC-plan.md`** (lịch crawl 4×/ngày, twitterapi theo POC, `last_crawled_at`, personal feed Pro/Power, `users.is_admin`, audit events, chốt clustering prompt-based). **Tweet fetch:** abstraction layer (`TweetFetchProviderInterface` + binding) — **LOCK** trong `SPEC-core` §3.2 + `SPEC-api` Section 10 §0. Playbook artifacts: **`IMPLEMENTATION-ROADMAP.md`**, **`CLAUDE.md`** (ngoài bundle nhưng được trích dẫn). **Đồng bộ hợp đồng dịch vụ ngoài (tóm tắt):** `API-CONTRACTS.md` — **canonical** = `SPEC-api.md` Section 10 + schema §9.

Do tổng nội dung > 60.000 ký tự, spec được **chia 3 file** (theo rule Size Check):

| File | Sections | Nội dung |
|------|----------|----------|
| `SPEC-core.md` | 1–8 | Overview, NFR, Architecture, State/Error, Domain, Permissions, Flows, Data Model |
| `SPEC-api.md` | 9–11 | DB Schema, External API Contracts, Internal REST API Specs |
| `SPEC-plan.md` | 12–13 + Appendix A/B + Consistency Report | Delivery & Ops, **Sprint Plan** (Section 13); roadmap task → **`IMPLEMENTATION-ROADMAP.md`** riêng (playbook 2.2h) |
| *(playbook)* | — | **`CLAUDE.md`** — rule ngắn cho agent; **`IMPLEMENTATION-ROADMAP.md`** — bảng task đánh số 1.x–3.x (**59** task tổng; Sprint 1: 34, Sprint 2: 14, Sprint 3: 11 — đối chiếu file roadmap) |

**Change request (2026-04-13):** Chuyển workflow Source Phase 1 sang **Option B**. User thêm nguồn (`type=user`) tạo với **`status='pending_review'`**; chỉ vào crawl pool sau khi admin `approve` → `active`. Admin review queue qua `GET/PATCH /api/admin/sources`; state machine `SPEC-core.md` Section 4; UI/sprint Screen **#11**, **#13** + tasks **2.1.x**, **3.3.x** trong `SPEC-plan.md` / `IMPLEMENTATION-ROADMAP.md`.

---

## Lock & human sign-off

**Trạng thái:** LOCKED (có **amendment** sau review kỹ thuật / sản phẩm)  
**Ngày lock gốc:** 2026-04-03  
**Amendment:** 2026-04-06 — scheduler crawl **4×/ngày**; twitterapi.io **theo Báo cáo POC** (`advanced_search`); schema `last_crawled_at`, `users.is_admin`, `user_personal_feed_entries`; clustering **prompt-based**; **`TweetFetchProviderInterface`** + binding; **`audit_logs` §1.3.1** (event + write mechanism); prompt LLM tại **`docs/prompts/v1/`**; ON DELETE trong SQL — chi tiết trong `SPEC-core` / `SPEC-api` / `SPEC-plan`.  
**Phạm vi lock:** Toàn bộ bundle `SPEC.md` + `SPEC-core.md` + `SPEC-api.md` + `SPEC-plan.md` (kèm Appendix A/B và Consistency Report nhúng trong `SPEC-plan.md`). Artifact đi kèm: **`IMPLEMENTATION-ROADMAP.md`**, **`CLAUDE.md`**.  
**Người ký / reviewer:** HaoLuong  
**Verdict:** PASS (baseline 2026-04-03); amendment 2026-04-06 **ghi nhận trong VALIDATION-LOG** (VR-6…VR-10) và các section đã nêu.

**Điều kiện gate (tóm tắt):** Không còn BLOCKER mở cho lock; conflict workflow Source (2.2b #13) đã đổi sang **Option B** qua CR 2026-04-13; Consistency Report trong `SPEC-plan.md` **8/8 PASS** tại thời điểm lock; human đã xác nhận đọc lại các section đã chỉnh (Source state machine, admin API, plan Screen #11 / #13 / tasks 3.3.x). **Sau amendment 2026-04-06:** các quyết định VR-6…VR-10 và đồng bộ POC twitterapi — **đối chiếu `SPEC-api.md`** làm nguồn truth cho hợp đồng API ngoài.

**Sau lock:** Mọi thay đổi spec = **change request** — bắt buộc ghi: mô tả, file + section (theo SPEC Section / Strategy Section), impact (schema, API, UI, sprint), người approve. Không sửa “ngầm” rồi bỏ trace.

---

## VALIDATION-LOG — Accept risk (trước / trong triển khai)

| ID | Nội dung (rút gọn) | Lý do accept | Impact nếu assumption sai | Giảm rủi ro |
|----|-------------------|--------------|---------------------------|------------|
| VR-1 | Phase 1 **Option B**: user-added → `pending_review`; chỉ crawl sau admin approve (`active`) | Giảm spam/noise và quota waste trước khi nguồn được duyệt | User chờ duyệt, tăng friction add source | Queue admin theo `created_at`, SLA moderation, UI thông báo trạng thái chờ duyệt |
| VR-2 | Dùng enum `pending_review` làm default happy-path cho user-added | Đồng bộ state machine + moderation queue | Queue phình to nếu admin chậm | Dashboard admin filter `status=pending_review`; theo dõi backlog và throughput duyệt |
| VR-3 | Blocker tích hợp dịch vụ ngoài (2.2d) resolve **trước** code path pipeline | Spec đã liệt kê blocker; không chặn lock tài liệu | Trễ Sprint 1 nếu chưa verify API | Checklist verify doc/endpoint trước task crawl/classify (roadmap 1.6.x–1.8.x) |
| VR-4 | Roadmap task chỉ trong **`IMPLEMENTATION-ROADMAP.md`**; `SPEC-plan.md` Section 13 = Sprint Plan + stub dẫn chiếu (playbook 2.2h) | Tránh nhúng trùng SPEC | Sửa roadmap mà quên file riêng | CR ghi rõ; `tools/build_spec.php` không nhúng roadmap vào plan |
| VR-5 | Open questions còn lại (ví dụ: chỗ enforce Free tier API vs job; My KOLs toggle Sprint 1 vs 2; admin rank override vs immutability) | Impact chấp nhận được ≤ refactor nhỏ theo tiêu chí đã dùng khi triage | Đổi guard/cron hoặc thêm endpoint sau | Triage trong sprint planning; resolve trước khi đụng code path tương ứng |
| VR-6 | **Free tier:** enforce **cả** API middleware (403) **và** job/cron (không tạo digest ngoài Mon/Wed/Fri cho Free) | Tránh lệch UX nếu chỉ chặn một lớp | Free thấy dữ liệu Pro qua API bug | Middleware `plan` + job filter; test cả hai |
| VR-7 | **Draft Free:** API trả 403; UI ẩn nút copy — double layer | Chuẩn REST + giảm nhầm user | User copy được draft khi API lỗi | E2E + policy |
| VR-8 | **Signal detail:** `GET /api/signals/{id}` là nguồn truth; UI modal chỉ là presentation | Trùng SPEC-api | Hai nguồn data lệch | Một controller + Resource |
| VR-9 | **Rank weights:** giá trị khởi điểm trong `config` — tinh chỉnh sau dogfood | Không block wedge | Ranking suboptimal tuần đầu | Log rank components tuần 1 |
| VR-10 | **KOL seed:** tối thiểu **≥50** account để dogfood; **~500** mục tiêu đầy đủ | CSV có thể trễ | Pool nhỏ → ít signal | Seed nhỏ trước, mở rộng sau |

_(Thêm dòng VR-x khi có **accept risk** mới; mỗi dismiss issue nên ghi lý do riêng trong log dự án / PR review.)_

---

## Tài liệu triển khai (ngoài bundle SPEC)

| Artifact | Ghi chú |
|----------|---------|
| **LLM prompt templates** (classify / cluster / summarize / draft) | **Có tại** `docs/prompts/v1/` (`README.md`, `classify.md`, `cluster.md`, `summarize.md`, `draft.md`) — versioned ngoài SPEC; guards & threshold: `SPEC-core` Flow 3 + `SPEC-api` §9 changelog / Anthropic. |
| **`API-CONTRACTS.md`** | Bản tóm tắt hợp đồng dịch vụ ngoài — **đồng bộ** với `SPEC-api.md` Section 10 + §9; nếu lệch, ưu tiên **SPEC-api**. |
| **SETUP-GUIDE.md** | Sinh sau khi stack môi trường cố định (WAMP/Composer/npm/env). |

---

## Change request (mẫu sau lock)

1. **Mô tả** thay đổi + lý do (product/tech).  
2. **Phạm vi:** `SPEC-core` Section X / `SPEC-api` §Y / `SPEC-plan` feature hoặc Appendix — **không** chỉ tên file trung gian không có trong spec.  
3. **Impact:** migration DB? breaking API? thay UI/sprint task?  
4. **Approval:** owner / reviewer.  
5. **Cập nhật** Consistency Report (trong `SPEC-plan.md`) nếu đụng permission, schema, state machine, hoặc endpoint count.

