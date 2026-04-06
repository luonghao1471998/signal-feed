# Skill: Code review (SignalFeed)

**Tham chiếu:** `CLAUDE.md` (Business Rules, Architecture, State Machines), `SPEC-core.md`, `SPEC-api.md`, `SPEC.md` (lock + CR).

Mục tiêu: PR **một vấn đề** rõ ràng; không lệch spec; an toàn đa tenant / plan / OAuth.

---

## Kiến trúc & layering

- [ ] Controller mỏng; logic guard/multi-step trong **Service** hoặc **Action**.
- [ ] **Job → Service**, không Controller. **Listener → Service** cho side effect.
- [ ] **Model không gọi Service.**
- [ ] HTTP vendor không lộ từ Controller; crawl qua **`TweetFetchProviderInterface`**.

---

## Spec & schema

- [ ] Endpoint / cột / enum khớp **`SPEC-api`**; không “âm thầm” mở rộng — cần **CR** (`SPEC.md`).
- [ ] Migration khớp §9 (kiểu Postgres, FK ON DELETE, index).
- [ ] Envelope JSON: `data` / `error.code` / `message` / `details` đúng pattern `SPEC-core` §4.

---

## Business rules (blocker nếu vi phạm)

- [ ] **OAuth-only Phase 1** — không dựng auth email/password làm chính.
- [ ] **`User.plan`:** không API user tự sửa plan; sync qua Stripe webhook (Constraint #7).
- [ ] **My KOLs cap:** Pro ≤10, Power ≤50 trước khi tạo subscription.
- [ ] **Source Option A:** user source tạo ra `active` ngay Phase 1.
- [ ] **Free tier:** giới hạn digest / không draft copy — đúng guard đã chốt (VR-6, VR-7).
- [ ] **Admin:** `/api/admin/*` có check **`is_admin`**.
- [ ] **Soft delete Source:** không hard-delete khi đã có Signal (Flow 6).
- [ ] **Pipeline:** `signal_score`, cluster rule, draft không copy nguyên văn tweet (`SPEC-core` Flow 3).

---

## Bảo mật & vận hành

- [ ] Webhook: verify chữ ký + idempotency (`processed_*`).
- [ ] Mass assignment: `$fillable` / DTO / chỉ field cho phép.
- [ ] Không log token/cookie/PII đầy đủ.
- [ ] Queue job idempotent khi retry (Stripe, pipeline).

---

## Chất lượng PR

- [ ] Diff nhỏ, đúng task roadmap khi có số task.
- [ ] Test tối thiểu (Feature cho API mới; Unit cho guard Service) — xem `write-unit-test.md`.
- [ ] Không thêm dependency Composer/npm ngoài phạm vi **SPEC** / đã approve.
- [ ] PSR-12 cho PHP; nhất quán style file lân cận.

---

## Câu hỏi gợi ý cho reviewer

1. Nếu spec và code lệch, đâu là nguồn truth đã được CR?
2. Luồng này có cần `DB::transaction` không?
3. Có race (double subscribe, double webhook) không — đã khóa idempotency/chỉ mục UNIQUE?
