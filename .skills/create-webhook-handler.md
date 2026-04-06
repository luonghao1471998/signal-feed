# Skill: Tạo webhook handler (SignalFeed)

**Tham chiếu:** `SPEC-api.md` Section 11 (cuối — Webhooks Inbound) + Section 9 (bảng idempotency + `audit_logs`), `SPEC-core.md` Section 3 (layering), `CLAUDE.md` (Constraint 2.2d qua spec).

**Stack:** Laravel 11; bảo mật bằng **chữ ký** từng provider; **idempotency** bằng bảng processed* trong DB.

---

## Webhook đã lock trong SPEC

| Provider | Route | Verify | Idempotency |
|----------|-------|--------|-------------|
| **Stripe** | `POST /api/webhooks/stripe` | Header `Stripe-Signature` + `STRIPE_WEBHOOK_SECRET` | `processed_stripe_events.event_id` UNIQUE |
| **Telegram** | `POST /api/webhooks/telegram` | `X-Telegram-Bot-Api-Secret-Token` | `processed_telegram_updates.update_id` |
| **Resend** | `POST /api/webhooks/resend` | Chữ ký (method TBD — flag trong SPEC / Blocker #7) | `processed_resend_events.event_id` |

Chi tiết HTTP 401/409/400 và hành động từng `event.type` → đọc đúng bảng trong **`SPEC-api.md`** (Stripe: `checkout.session.completed`, `customer.subscription.updated`, …).

---

## Checklist triển khai

1. [ ] Route **không** dùng `auth:sanctum`; thay bằng verify chữ ký (middleware hoặc đầu controller).
2. [ ] **Đọc raw body** cho Stripe (`$request->getContent()`) trước khi verify — không parse JSON làm mất format chữ ký.
3. [ ] **Idempotency trước nghiệp vụ:** tra `processed_*` theo id ngoài; nếu đã có → **409** + code `DUPLICATE_EVENT` / `DUPLICATE_UPDATE` đúng SPEC (Stripe/Telegram).
4. [ ] Sau xử lý thành công: insert `processed_*` trong **cùng transaction** với cập nhật `User` / side effects (khi khả thi).
5. [ ] **User.plan / stripe_customer_id:** chỉ cập nhật theo luồng đã mô tả (Constraint #7); map `price_id` → `pro`/`power` qua env (`STRIPE_PRO_PRICE_ID`, …).
6. [ ] **Downgrade / subscription.deleted:** cleanup `MySourceSubscriptions` theo assumption trong spec (giữ N bản ghi đầu khi downgrade Pro, v.v.).
7. [ ] **Audit:** sau verify chữ ký, có thể ghi `audit_logs` với `event_type = webhook_received` và metadata `provider` + `event_id` / `external_event_type` (§9.1.3.1).
8. [ ] Response thành công: **`200 OK`** body `{}` nếu spec nói vậy — Stripe/Telegram/Resend đều ghi empty JSON acknowledge.
9. [ ] **Không** để exception raw ra client; log nội bộ; với Stripe, trả đúng status để Stripe retry khi cần (5xx cho lỗi tạm thời — cân nhắc tách “lỗi nghiệp vụ” vs “lỗi hạ tầng”).

---

## Kiến trúc gợi ý

- **Controller** (`StripeWebhookController`, …): verify → parse event type → delegate **Service** (`StripeWebhookService::handle(EventPayload)`).
- **Service:** switch `type`, gọi model/repository, enqueue job nếu xử lý nặng (ghi rõ trong CR nếu spec chưa nói async).
- **Integration:** chỉ nếu cần gọi API ngược lại Stripe/Resend; không nhồi verify signature vào Integration trừ khi team chọn tách `StripeClient::constructEvent`.

---

## Test (tối thiểu)

- Feature test: payload mẫu + header chữ ký giả lập (hoặc mock facade SDK).
- Case duplicate → 409.
- Case sai chữ ký → 401.

Chi tiết → `write-unit-test.md`.

---

## Sau lock

Webhook mới (provider khác) = **change request** + bảng `processed_*` + dòng trong `SPEC-api` Section 11 + env secret.
