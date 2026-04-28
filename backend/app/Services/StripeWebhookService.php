<?php

namespace App\Services;

use App\Jobs\SyncStripeInvoicesJob;
use App\Models\MySourceSubscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Stripe\Checkout\Session;
use Stripe\Event;
use Stripe\Exception\ApiErrorException;
use Stripe\Invoice;
use Stripe\StripeClient;
use Stripe\StripeObject;
use Stripe\Subscription;

class StripeWebhookService
{
    private StripeClient $stripe;

    public function __construct(
        private readonly BillingInvoiceSyncService $billingInvoiceSync,
    ) {
        $secret = config('services.stripe.secret');
        if (empty($secret)) {
            throw new \RuntimeException('STRIPE_SECRET is not configured.');
        }

        $this->stripe = new StripeClient($secret);
    }

    /**
     * Xử lý nghiệp vụ sau khi đã verify signature và chưa ghi idempotency record.
     *
     * @throws ApiErrorException
     */
    public function processStripeEvent(Event $event): void
    {
        match ($event->type) {
            'checkout.session.completed' => $this->handleCheckoutSessionCompleted($event),
            'customer.subscription.updated' => $this->handleSubscriptionUpdated($event),
            'customer.subscription.deleted' => $this->handleSubscriptionDeleted($event),
            'invoice.paid' => $this->handleInvoiceSyncedEvent($event),
            'invoice.payment_succeeded' => $this->handleInvoiceSyncedEvent($event),
            'invoice_payment.paid' => $this->handleInvoicePaymentPaid($event),
            'invoice.updated' => $this->handleInvoiceSyncedEvent($event),
            'invoice.finalized' => $this->handleInvoiceSyncedEvent($event),
            'invoice.payment_failed' => $this->handleInvoicePaymentFailed($event),
            default => Log::info('Stripe webhook: ignored event type', ['type' => $event->type]),
        };
    }

    private function handleInvoiceSyncedEvent(Event $event): void
    {
        /** @var Invoice $invoice */
        $invoice = $event->data->object;
        $this->billingInvoiceSync->upsertFromStripeInvoice($invoice);
    }

    /**
     * Billing API / V2: object là InvoicePayment, không phải Invoice — cần retrieve invoice đầy đủ.
     */
    private function handleInvoicePaymentPaid(Event $event): void
    {
        $obj = $event->data->object;
        $invoiceId = null;
        if (is_object($obj)) {
            if (isset($obj->invoice)) {
                $inv = $obj->invoice;
                $invoiceId = is_string($inv) ? $inv : ($inv->id ?? null);
            }
        }
        if ($invoiceId === null || $invoiceId === '') {
            Log::info('Stripe invoice_payment.paid: missing invoice reference', [
                'event_id' => $event->id ?? null,
            ]);

            return;
        }

        try {
            /** @var Invoice $invoice */
            $invoice = $this->stripe->invoices->retrieve((string) $invoiceId, []);
            $this->billingInvoiceSync->upsertFromStripeInvoice($invoice);
        } catch (\Throwable $e) {
            Log::warning('Stripe invoice_payment.paid: sync failed', [
                'event_id' => $event->id ?? null,
                'invoice_id' => $invoiceId,
                'message' => $e->getMessage(),
            ]);
        }
    }

    /**
     * @throws ApiErrorException
     */
    private function handleCheckoutSessionCompleted(Event $event): void
    {
        /** @var Session $session */
        $session = $event->data->object;

        // Setup mode: dùng cho Pro→Power (chọn/đổi thẻ, xử lý SCA) trước khi upgrade qua API.
        $sessionMode = (string) ($session->mode ?? '');
        if ($sessionMode === 'setup') {
            $checkoutAction = $this->stripeMetadataString($session->metadata ?? null, 'checkout_action');
            if ($checkoutAction === 'setup_for_upgrade') {
                $this->handleSetupCheckoutForUpgrade($session, $event);
            } else {
                Log::info('Stripe checkout.session.completed (setup): unknown checkout_action, skipped', [
                    'session_id' => $session->id ?? null,
                    'checkout_action' => $checkoutAction,
                ]);
            }

            return;
        }

        $userIdRaw = $this->metadataUserId($session->metadata ?? null);

        if ($userIdRaw === null || $userIdRaw === '') {
            Log::warning('Stripe checkout.session.completed: missing metadata.user_id', [
                'session_id' => $session->id ?? null,
            ]);

            return;
        }

        $userId = (int) $userIdRaw;

        $customerId = is_string($session->customer) ? $session->customer : ($session->customer->id ?? null);
        $subscriptionId = is_string($session->subscription)
            ? $session->subscription
            : ($session->subscription->id ?? null);

        if ($subscriptionId === null || $subscriptionId === '') {
            Log::warning('Stripe checkout.session.completed: missing subscription on session', [
                'session_id' => $session->id ?? null,
            ]);

            return;
        }

        DB::transaction(function () use ($event, $userId, $customerId, $subscriptionId, $session): void {
            $user = User::query()->lockForUpdate()->find($userId);
            if ($user === null) {
                Log::warning('Stripe checkout.session.completed: user not found', ['user_id' => $userId]);

                return;
            }

            $existingSubId = $user->stripe_subscription_id;
            $priorSubId = $this->stripeMetadataString($session->metadata ?? null, 'prior_subscription_id');
            $intentionalReplace = is_string($priorSubId) && $priorSubId !== ''
                && $existingSubId !== null && $existingSubId !== ''
                && (string) $priorSubId === (string) $existingSubId;

            if ($existingSubId !== null && $existingSubId !== '' && (string) $existingSubId !== (string) $subscriptionId) {
                if ($intentionalReplace) {
                    Log::info('Stripe checkout.session.completed: replacing prior subscription after checkout', [
                        'user_id' => $userId,
                        'old_subscription_id' => $existingSubId,
                        'new_subscription_id' => $subscriptionId,
                    ]);
                    try {
                        $this->stripe->subscriptions->cancel((string) $existingSubId);
                    } catch (\Throwable $e) {
                        Log::error('Stripe checkout.session.completed: failed to cancel old subscription after replacement checkout', [
                            'subscription_id' => $existingSubId,
                            'message' => $e->getMessage(),
                        ]);
                    }
                } else {
                    Log::warning('Stripe checkout.session.completed: duplicate subscription cancelled', [
                        'user_id' => $userId,
                        'existing_subscription_id' => $existingSubId,
                        'duplicate_subscription_id' => $subscriptionId,
                        'session_id' => $session->id ?? null,
                    ]);
                    try {
                        $this->stripe->subscriptions->cancel((string) $subscriptionId);
                    } catch (\Throwable $e) {
                        Log::error('Stripe checkout.session.completed: failed to cancel duplicate subscription', [
                            'subscription_id' => $subscriptionId,
                            'message' => $e->getMessage(),
                        ]);
                    }

                    return;
                }
            }

            if ($existingSubId !== null && $existingSubId !== '' && (string) $existingSubId === (string) $subscriptionId) {
                $subscription = $this->stripe->subscriptions->retrieve((string) $subscriptionId, []);
                $this->applyCancelAtPeriodEndOnSubscription((string) $subscriptionId);
                if (is_string($customerId) && $customerId !== '') {
                    $user->stripe_customer_id = $customerId;
                }
                $user->subscription_ends_at = $this->subscriptionPeriodEndFromStripe($subscription);
                $user->save();

                $this->syncInvoicesImmediately((string) $subscriptionId, $user->id);

                return;
            }

            $subscription = $this->stripe->subscriptions->retrieve((string) $subscriptionId, []);
            $this->applyCancelAtPeriodEndOnSubscription((string) $subscriptionId);
            $priceId = $this->getSubscriptionPriceId($subscription);
            $newPlan = $this->mapPriceIdToPlan($priceId);

            $oldPlan = (string) $user->plan;
            $user->stripe_customer_id = is_string($customerId) ? $customerId : $user->stripe_customer_id;
            $user->stripe_subscription_id = $subscriptionId;
            $user->plan = $newPlan;
            $user->subscription_ends_at = $this->subscriptionPeriodEndFromStripe($subscription);
            $user->save();

            $this->auditPlanChangeIfNeeded($user->id, $oldPlan, $newPlan, (string) $event->id);
            $this->auditWebhookStripe('checkout.session.completed', $user->id, [
                'event_id' => $event->id,
                'effect' => 'subscription.created',
            ]);

            $this->syncInvoicesImmediately((string) $subscriptionId, $user->id);
        });
    }

    /**
     * Xử lý Checkout Session mode=setup dùng cho Pro→Power upgrade:
     * 1. Lấy payment method từ SetupIntent
     * 2. Set làm default cho customer
     * 3. Gọi subscriptions.update + always_invoice (proration)
     * 4. Cập nhật users.plan + subscription_ends_at
     */
    private function handleSetupCheckoutForUpgrade(Session $session, Event $event): void
    {
        $userIdRaw = $this->metadataUserId($session->metadata ?? null);
        $upgradeTo = $this->stripeMetadataString($session->metadata ?? null, 'upgrade_to');

        if ($userIdRaw === null || $userIdRaw === '') {
            Log::warning('Stripe setup checkout: missing user_id in metadata', ['session_id' => $session->id ?? null]);

            return;
        }

        if ($upgradeTo !== 'power') {
            Log::info('Stripe setup checkout: upgrade_to is not power, skipping', [
                'session_id' => $session->id ?? null,
                'upgrade_to' => $upgradeTo,
            ]);

            return;
        }

        $userId = (int) $userIdRaw;

        DB::transaction(function () use ($session, $event, $userId): void {
            $user = User::query()->lockForUpdate()->find($userId);
            if ($user === null) {
                Log::warning('Stripe setup checkout: user not found', ['user_id' => $userId]);

                return;
            }

            if ((string) ($user->plan ?? 'free') !== 'pro') {
                Log::warning('Stripe setup checkout: user is no longer on Pro plan, upgrade skipped', [
                    'user_id' => $userId,
                    'current_plan' => $user->plan,
                ]);

                return;
            }

            $subscriptionId = (string) ($user->stripe_subscription_id ?? '');
            if ($subscriptionId === '') {
                Log::error('Stripe setup checkout: no stripe_subscription_id on user', ['user_id' => $userId]);

                return;
            }

            // Lấy payment method từ SetupIntent.
            $setupIntentId = is_string($session->setup_intent)
                ? $session->setup_intent
                : ($session->setup_intent->id ?? null);

            if ($setupIntentId === null || $setupIntentId === '') {
                Log::error('Stripe setup checkout: no setup_intent on session', ['session_id' => $session->id ?? null]);

                return;
            }

            // --- Retrieve SetupIntent & PaymentMethod ---
            try {
                $setupIntent = $this->stripe->setupIntents->retrieve((string) $setupIntentId, []);
                $paymentMethodId = is_string($setupIntent->payment_method)
                    ? $setupIntent->payment_method
                    : ($setupIntent->payment_method->id ?? null);
            } catch (\Stripe\Exception\ApiErrorException $e) {
                Log::error('Pro→Power: failed to retrieve SetupIntent', [
                    'user_id' => $userId,
                    'setup_intent_id' => $setupIntentId,
                    'error' => $e->getMessage(),
                ]);

                return;
            }

            if ($paymentMethodId === null || $paymentMethodId === '') {
                Log::error('Pro→Power: no payment_method on setup_intent', [
                    'setup_intent_id' => $setupIntentId,
                ]);

                return;
            }

            $customerId = is_string($session->customer)
                ? $session->customer
                : ($session->customer->id ?? null);

            // --- Set default payment method cho customer ---
            if ($customerId !== null && $customerId !== '') {
                try {
                    $this->stripe->customers->update($customerId, [
                        'invoice_settings' => ['default_payment_method' => $paymentMethodId],
                    ]);
                    Log::info('Pro→Power: set default payment method on customer', [
                        'customer_id' => $customerId,
                        'payment_method_id' => $paymentMethodId,
                    ]);
                } catch (\Stripe\Exception\ApiErrorException $e) {
                    Log::error('Pro→Power: failed to update customer default PM', [
                        'customer_id' => $customerId,
                        'error' => $e->getMessage(),
                    ]);

                    return;
                }
            }

            // --- Lấy subscription hiện tại ---
            try {
                $subscription = $this->stripe->subscriptions->retrieve($subscriptionId, []);
            } catch (\Stripe\Exception\ApiErrorException $e) {
                Log::error('Pro→Power: failed to retrieve subscription', [
                    'subscription_id' => $subscriptionId,
                    'error' => $e->getMessage(),
                ]);

                return;
            }

            $items = $subscription->items->data ?? [];
            if (empty($items[0]->id)) {
                Log::error('Pro→Power: subscription has no items', ['subscription_id' => $subscriptionId]);

                return;
            }

            $powerPriceId = config('services.stripe.power_price_id');
            if (empty($powerPriceId)) {
                Log::error('Pro→Power: power_price_id is not configured');

                return;
            }

            // --- Bước 1: Reset cancel_at_period_end để proration tính đúng 2 chiều ---
            Log::info('Pro→Power Step 1: Reset cancel_at_period_end to false', [
                'subscription_id' => $subscriptionId,
            ]);
            try {
                $this->stripe->subscriptions->update($subscriptionId, [
                    'cancel_at_period_end' => false,
                ]);
                Log::info('Pro→Power Step 1: completed');
            } catch (\Stripe\Exception\ApiErrorException $e) {
                Log::error('Pro→Power Step 1: FAILED', [
                    'subscription_id' => $subscriptionId,
                    'error' => $e->getMessage(),
                ]);

                return;
            }

            // --- Bước 2: Đổi giá lên Power; create_prorations tạo pending items (không auto-charge) ---
            Log::info('Pro→Power Step 2: Update subscription to Power price', [
                'subscription_id' => $subscriptionId,
                'power_price_id' => $powerPriceId,
                'item_id' => (string) $items[0]->id,
            ]);
            try {
                $this->stripe->subscriptions->update($subscriptionId, [
                    'items' => [
                        ['id' => (string) $items[0]->id, 'price' => (string) $powerPriceId],
                    ],
                    'proration_behavior' => 'create_prorations',
                    'default_payment_method' => $paymentMethodId,
                ]);

                // Retrieve full object — update() trả về object thiếu current_period_end trên Stripe API mới.
                $updatedSub = $this->stripe->subscriptions->retrieve($subscriptionId, []);

                $periodEndTs = is_numeric($updatedSub->current_period_end ?? null)
                    ? (int) $updatedSub->current_period_end
                    : null;

                Log::info('Pro→Power Step 2: completed', [
                    'subscription_id' => $subscriptionId,
                    'current_period_end' => $periodEndTs !== null ? date('Y-m-d H:i:s', $periodEndTs) : 'null',
                    'status' => $updatedSub->status ?? null,
                ]);
            } catch (\Stripe\Exception\ApiErrorException $e) {
                Log::error('Pro→Power Step 2: FAILED', [
                    'subscription_id' => $subscriptionId,
                    'error' => $e->getMessage(),
                ]);

                return;
            }

            // Chờ Stripe gắn proration items vào customer trước khi tạo invoice.
            sleep(5);
            Log::info('Pro→Power Step 2→3: waited 5s for Stripe to attach proration items');

            // --- Bước 3: Tạo invoice mới gom toàn bộ pending proration items ---
            // auto_advance: true → Stripe tự finalize nếu Step 4 không kịp chạy.
            Log::info('Pro→Power Step 3: Create proration invoice', [
                'customer_id' => (string) $customerId,
                'subscription_id' => $subscriptionId,
                'payment_method_id' => $paymentMethodId,
            ]);
            try {
                $prorationInvoice = $this->stripe->invoices->create([
                    'customer' => (string) $customerId,
                    'subscription' => $subscriptionId,
                    'auto_advance' => true,
                    'default_payment_method' => $paymentMethodId,
                ]);

                $lineItems = $prorationInvoice->lines->data ?? [];
                $lineItemsSummary = array_map(
                    static fn ($item): array => [
                        'description' => $item->description ?? null,
                        'amount' => ($item->amount ?? 0) / 100,
                        'type' => ($item->amount ?? 0) > 0 ? 'charge' : 'credit',
                    ],
                    $lineItems
                );

                Log::info('Pro→Power Step 3: completed', [
                    'invoice_id' => $prorationInvoice->id,
                    'status' => $prorationInvoice->status,
                    'amount_due' => ($prorationInvoice->amount_due ?? 0) / 100,
                    'line_items_count' => count($lineItems),
                    'line_items' => $lineItemsSummary,
                ]);

                if (count($lineItems) === 0) {
                    Log::error('Pro→Power Step 3: invoice has NO line items — proration items were not attached', [
                        'invoice_id' => $prorationInvoice->id,
                        'customer_id' => (string) $customerId,
                        'subscription_id' => $subscriptionId,
                    ]);

                    throw new \RuntimeException('Proration invoice is empty — Stripe did not attach pending items.');
                }

                $hasChargeItem = false;
                foreach ($lineItems as $lineItem) {
                    if (($lineItem->amount ?? 0) > 0) {
                        $hasChargeItem = true;
                        break;
                    }
                }

                if (! $hasChargeItem) {
                    Log::error('Pro→Power Step 3: invoice has NO charge items — only credit, missing Power charge', [
                        'invoice_id' => $prorationInvoice->id,
                        'amount_due' => ($prorationInvoice->amount_due ?? 0) / 100,
                        'line_items' => $lineItemsSummary,
                    ]);

                    throw new \RuntimeException('Proration invoice missing charge items — only credit line found. Stripe may need more time to attach proration items.');
                }
            } catch (\Stripe\Exception\ApiErrorException $e) {
                Log::error('Pro→Power Step 3: FAILED', [
                    'customer_id' => (string) $customerId,
                    'subscription_id' => $subscriptionId,
                    'error' => $e->getMessage(),
                ]);

                return;
            }

            // --- Bước 4: Finalize invoice (draft → open) ---
            Log::info('Pro→Power Step 4: Finalize invoice', ['invoice_id' => $prorationInvoice->id]);
            try {
                $finalizedInvoice = $this->stripe->invoices->finalizeInvoice(
                    (string) $prorationInvoice->id,
                    []
                );
                Log::info('Pro→Power Step 4: completed', [
                    'invoice_id' => $finalizedInvoice->id,
                    'status' => $finalizedInvoice->status,
                    'amount_due' => ($finalizedInvoice->amount_due ?? 0) / 100,
                ]);
            } catch (\Stripe\Exception\ApiErrorException $e) {
                Log::error('Pro→Power Step 4: FAILED to finalize invoice', [
                    'invoice_id' => $prorationInvoice->id,
                    'error' => $e->getMessage(),
                ]);

                return;
            }

            // --- Bước 5: Pay invoice ngay lập tức ---
            if ((int) ($finalizedInvoice->amount_due ?? 0) > 0) {
                Log::info('Pro→Power Step 5: Pay invoice', [
                    'invoice_id' => $finalizedInvoice->id,
                    'amount_due' => ($finalizedInvoice->amount_due ?? 0) / 100,
                    'payment_method_id' => $paymentMethodId,
                ]);
                try {
                    $paidInvoice = $this->stripe->invoices->pay(
                        (string) $finalizedInvoice->id,
                        ['payment_method' => $paymentMethodId]
                    );
                    Log::info('Pro→Power Step 5: completed', [
                        'invoice_id' => $paidInvoice->id,
                        'status' => $paidInvoice->status,
                        'amount_paid' => ($paidInvoice->amount_paid ?? 0) / 100,
                    ]);
                } catch (\Stripe\Exception\ApiErrorException $e) {
                    Log::error('Pro→Power Step 5: FAILED to pay invoice', [
                        'invoice_id' => $finalizedInvoice->id,
                        'payment_method_id' => $paymentMethodId,
                        'error' => $e->getMessage(),
                    ]);

                    return;
                }
            } else {
                Log::warning('Pro→Power Step 5: Skipped — amount_due is 0', [
                    'invoice_id' => $finalizedInvoice->id,
                ]);
            }

            // --- Bước 6: Khôi phục cancel_at_period_end để subscription tự hủy cuối kỳ ---
            $periodEnd = (int) ($updatedSub->current_period_end ?? 0);
            $restoreParams = ['cancel_at_period_end' => true];
            if ($periodEnd > 0) {
                $restoreParams['cancel_at'] = $periodEnd;
            }
            Log::info('Pro→Power Step 6: Restore cancel_at_period_end', [
                'subscription_id' => $subscriptionId,
                'cancel_at' => $periodEnd > 0 ? date('Y-m-d H:i:s', $periodEnd) : null,
            ]);
            try {
                $this->stripe->subscriptions->update($subscriptionId, $restoreParams);
                Log::info('Pro→Power Step 6: completed', [
                    'subscription_id' => $subscriptionId,
                ]);
            } catch (\Stripe\Exception\ApiErrorException $e) {
                Log::error('Pro→Power Step 6: FAILED to restore cancel_at_period_end', [
                    'subscription_id' => $subscriptionId,
                    'error' => $e->getMessage(),
                ]);
                // Không return — plan đã được upgrade thành công, lỗi step 6 không block ghi DB.
            }

            // --- Cập nhật DB ---
            $oldPlan = (string) $user->plan;
            $user->plan = 'power';
            $user->subscription_ends_at = $this->subscriptionPeriodEndFromStripe($updatedSub);
            if ($customerId !== null && $customerId !== '') {
                $user->stripe_customer_id = $customerId;
            }
            $user->save();

            $this->auditPlanChangeIfNeeded($user->id, $oldPlan, 'power', (string) $event->id);
            $this->auditWebhookStripe('checkout.session.setup.completed', $user->id, [
                'event_id' => $event->id,
                'effect' => 'subscription.upgraded_pro_to_power',
            ]);

            Log::info('Pro→Power: upgrade completed successfully', [
                'user_id' => $userId,
                'subscription_id' => $subscriptionId,
                'payment_method_id' => $paymentMethodId,
            ]);

            $this->syncInvoicesImmediately($subscriptionId, $userId);
        });
    }

    /**
     * Sync invoice ngay sau checkout (không đợi invoice.paid webhook).
     * Nếu invoice chưa sẵn sàng, job delayed sẽ retry sau.
     */
    private function syncInvoicesImmediately(string $subscriptionId, int $userId): void
    {
        try {
            $this->billingInvoiceSync->syncInvoicesForSubscription($subscriptionId);
            Log::info('Stripe checkout.session.completed: invoices synced immediately', [
                'subscription_id' => $subscriptionId,
                'user_id' => $userId,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Stripe checkout.session.completed: immediate invoice sync failed', [
                'subscription_id' => $subscriptionId,
                'user_id' => $userId,
                'message' => $e->getMessage(),
            ]);
        }

        // Retry sau 15s và 60s phòng trường hợp invoice chưa finalized lúc checkout.session.completed fires.
        SyncStripeInvoicesJob::dispatch($subscriptionId, $userId)->delay(now()->addSeconds(15));
        SyncStripeInvoicesJob::dispatch($subscriptionId, $userId)->delay(now()->addMinutes(1));
    }

    private function handleSubscriptionUpdated(Event $event): void
    {
        /** @var Subscription $subscription */
        $subscription = $event->data->object;
        $user = $this->findUserForSubscription($subscription);
        if ($user === null) {
            Log::warning('Stripe customer.subscription.updated: user not found', [
                'subscription_id' => $subscription->id,
                'customer' => $subscription->customer,
            ]);

            return;
        }

        $oldPlan = (string) $user->plan;
        $status = (string) $subscription->status;

        if (in_array($status, ['canceled', 'incomplete_expired', 'unpaid'], true)) {
            $this->downgradeToFree($user, keepCustomerId: true);
            $this->cleanupSubscriptionsToPlanLimit($user);
            $this->auditPlanChangeIfNeeded($user->id, $oldPlan, 'free', (string) $event->id);
        } else {
            $priceId = $this->getSubscriptionPriceId($subscription);
            $newPlan = $this->mapPriceIdToPlan($priceId);
            $user->stripe_subscription_id = $subscription->id;
            $user->plan = $newPlan;
            $user->subscription_ends_at = $this->subscriptionPeriodEndFromStripe($subscription);
            $user->save();
            $this->cleanupSubscriptionsToPlanLimit($user);
            $this->auditPlanChangeIfNeeded($user->id, $oldPlan, (string) $user->plan, (string) $event->id);

            // Proration (vd. Pro→Power): kéo invoice ngay và dispatch job delayed 30s để bắt proration invoice
            // có thể chưa được tạo lúc customer.subscription.updated fires.
            if (in_array($status, ['active', 'trialing'], true)) {
                try {
                    Log::info('Stripe customer.subscription.updated: auto-sync invoices (immediate)', [
                        'subscription_id' => $subscription->id,
                        'user_id' => $user->id,
                    ]);
                    $this->billingInvoiceSync->syncInvoicesForSubscription((string) $subscription->id);
                } catch (\Throwable $e) {
                    Log::error('Stripe customer.subscription.updated: invoice auto-sync failed', [
                        'subscription_id' => $subscription->id,
                        'user_id' => $user->id,
                        'message' => $e->getMessage(),
                    ]);
                }
                // Dispatch delayed sync: proration invoice được Stripe tạo bất đồng bộ sau subscription.update.
                SyncStripeInvoicesJob::dispatch((string) $subscription->id, $user->id)->delay(now()->addSeconds(30));
                SyncStripeInvoicesJob::dispatch((string) $subscription->id, $user->id)->delay(now()->addMinutes(2));
            }
        }

        $this->auditWebhookStripe('customer.subscription.updated', $user->id, [
            'event_id' => $event->id,
            'effect' => 'subscription.updated',
            'status' => $status,
        ]);
    }

    private function handleSubscriptionDeleted(Event $event): void
    {
        /** @var Subscription $subscription */
        $subscription = $event->data->object;
        // Chỉ khớp theo stripe_subscription_id — tránh nhầm user khi subscription cũ bị hủy sau upgrade (cùng customer).
        $user = User::query()->where('stripe_subscription_id', $subscription->id)->first();
        if ($user === null) {
            Log::warning('Stripe customer.subscription.deleted: user not found', [
                'subscription_id' => $subscription->id,
            ]);

            return;
        }

        $oldPlan = (string) $user->plan;
        $this->downgradeToFree($user, keepCustomerId: true);
        $this->cleanupSubscriptionsToPlanLimit($user);
        $this->auditPlanChangeIfNeeded($user->id, $oldPlan, 'free', (string) $event->id);
        $this->auditWebhookStripe('customer.subscription.deleted', $user->id, [
            'event_id' => $event->id,
            'effect' => 'subscription.deleted',
        ]);
    }

    private function handleInvoicePaymentFailed(Event $event): void
    {
        /** @var Invoice $invoice */
        $invoice = $event->data->object;
        $this->billingInvoiceSync->upsertFromStripeInvoice($invoice);

        $customerId = is_string($invoice->customer) ? $invoice->customer : ($invoice->customer->id ?? null);
        if ($customerId === null || $customerId === '') {
            return;
        }

        $user = User::query()->where('stripe_customer_id', $customerId)->first();
        if ($user === null) {
            Log::warning('Stripe invoice.payment_failed: user not found for customer', [
                'customer' => $customerId,
            ]);

            return;
        }

        $attemptCount = (int) ($invoice->attempt_count ?? 0);
        if ($attemptCount >= 3) {
            $oldPlan = (string) $user->plan;
            $this->downgradeToFree($user, keepCustomerId: true);
            $this->cleanupSubscriptionsToPlanLimit($user);
            $this->auditPlanChangeIfNeeded($user->id, $oldPlan, 'free', (string) $event->id);
        } else {
            Log::warning('Stripe invoice.payment_failed: attempt_count < 3', [
                'user_id' => $user->id,
                'attempt_count' => $attemptCount,
                'invoice_id' => $invoice->id,
            ]);
        }

        $this->auditWebhookStripe('invoice.payment_failed', $user->id, [
            'event_id' => $event->id,
            'effect' => 'payment.failed',
            'attempt_count' => $attemptCount,
        ]);
    }

    private function findUserForSubscription(Subscription $subscription): ?User
    {
        $customerId = is_string($subscription->customer)
            ? $subscription->customer
            : ($subscription->customer->id ?? null);

        $bySub = User::query()->where('stripe_subscription_id', $subscription->id)->first();
        if ($bySub !== null) {
            return $bySub;
        }

        if ($customerId !== null && $customerId !== '') {
            $byCust = User::query()->where('stripe_customer_id', $customerId)->first();
            if ($byCust !== null) {
                return $byCust;
            }
        }

        $userIdRaw = $this->metadataUserId($subscription->metadata ?? null);
        if ($userIdRaw === null || $userIdRaw === '') {
            return null;
        }

        $user = User::query()->find((int) $userIdRaw);
        if ($user === null) {
            return null;
        }

        $this->ensureUserStripeIdsFromSubscription($user, (string) $subscription->id, $customerId);

        return $user;
    }

    /**
     * @param  StripeObject|array<string, mixed>|object|null  $metadata
     */
    private function metadataUserId(null|array|object $metadata): ?string
    {
        if ($metadata === null) {
            return null;
        }

        if (is_object($metadata) && isset($metadata->user_id)) {
            return (string) $metadata->user_id;
        }

        if (is_array($metadata) && isset($metadata['user_id'])) {
            return (string) $metadata['user_id'];
        }

        return null;
    }

    private function ensureUserStripeIdsFromSubscription(User $user, string $subscriptionId, ?string $customerId): void
    {
        $dirty = false;
        if (($user->stripe_customer_id === null || $user->stripe_customer_id === '')
            && $customerId !== null && $customerId !== '') {
            if (! User::query()->where('stripe_customer_id', $customerId)->where('id', '!=', $user->id)->exists()) {
                $user->stripe_customer_id = $customerId;
                $dirty = true;
            }
        }
        if (($user->stripe_subscription_id === null || $user->stripe_subscription_id === '')
            && $subscriptionId !== '') {
            if (! User::query()->where('stripe_subscription_id', $subscriptionId)->where('id', '!=', $user->id)->exists()) {
                $user->stripe_subscription_id = $subscriptionId;
                $dirty = true;
            }
        }
        if ($dirty) {
            $user->save();
        }
    }

    private function downgradeToFree(User $user, bool $keepCustomerId): void
    {
        $user->plan = 'free';
        $user->stripe_subscription_id = null;
        $user->subscription_ends_at = null;
        if (! $keepCustomerId) {
            $user->stripe_customer_id = null;
        }
        $user->save();
    }

    /**
     * Checkout Session không cho set cancel_at_period_end lúc tạo — cập nhật subscription sau khi đã tạo.
     */
    private function applyCancelAtPeriodEndOnSubscription(string $subscriptionId): void
    {
        try {
            $this->stripe->subscriptions->update($subscriptionId, [
                'cancel_at_period_end' => true,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Stripe checkout.session.completed: could not set cancel_at_period_end', [
                'subscription_id' => $subscriptionId,
                'message' => $e->getMessage(),
            ]);
        }
    }

    private function subscriptionPeriodEndFromStripe(Subscription $subscription): ?Carbon
    {
        // Stripe API mới không còn current_period_end ở top-level subscription.
        // Ưu tiên items[0]->current_period_end, fallback về cancel_at nếu cancel_at_period_end=true.
        $ts = null;

        $items = $subscription->items->data ?? [];
        if (! empty($items[0]) && is_numeric($items[0]->current_period_end ?? null)) {
            $ts = (int) $items[0]->current_period_end;
        } elseif (is_numeric($subscription->current_period_end ?? null)) {
            $ts = (int) $subscription->current_period_end;
        } elseif (! empty($subscription->cancel_at_period_end) && is_numeric($subscription->cancel_at ?? null)) {
            $ts = (int) $subscription->cancel_at;
        }

        return $ts !== null ? Carbon::createFromTimestamp($ts) : null;
    }

    /**
     * @param  array<string, mixed>|StripeObject|null  $metadata
     */
    private function stripeMetadataString(array|StripeObject|null $metadata, string $key): ?string
    {
        if ($metadata === null) {
            return null;
        }
        if ($metadata instanceof StripeObject) {
            $value = $metadata[$key] ?? null;

            return $value !== null && $value !== '' ? (string) $value : null;
        }
        if (is_array($metadata) && array_key_exists($key, $metadata) && $metadata[$key] !== null && $metadata[$key] !== '') {
            return (string) $metadata[$key];
        }

        return null;
    }

    public function cleanupSubscriptionsToPlanLimit(User $user): void
    {
        $limit = match ((string) $user->plan) {
            'pro' => 10,
            'free' => 5,
            default => null,
        };
        if ($limit === null) {
            return;
        }

        $totalSubscriptions = (int) MySourceSubscription::query()
            ->where('user_id', $user->id)
            ->count();

        if ($totalSubscriptions <= $limit) {
            return;
        }

        /** @var array<int, int> $keepSourceIds */
        $keepSourceIds = MySourceSubscription::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->orderByDesc('source_id')
            ->limit($limit)
            ->pluck('source_id')
            ->map(static fn ($sourceId): int => (int) $sourceId)
            ->all();

        $deletedCount = MySourceSubscription::query()
            ->where('user_id', $user->id)
            ->whereNotIn('source_id', $keepSourceIds)
            ->delete();

        if ($deletedCount <= 0) {
            return;
        }

        try {
            DB::table('audit_logs')->insert([
                'event_type' => 'subscription_cleanup',
                'user_id' => $user->id,
                'resource_type' => 'User',
                'resource_id' => $user->id,
                'changes' => json_encode([
                    'deleted_count' => $deletedCount,
                    'reason' => 'downgrade_to_'.$user->plan,
                ]),
                'ip_address' => request()?->ip(),
                'user_agent' => request()?->userAgent(),
                'tenant_id' => 1,
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('audit_logs subscription_cleanup insert failed', [
                'error' => $e->getMessage(),
                'user_id' => $user->id,
            ]);
        }
    }

    private function getSubscriptionPriceId(Subscription $subscription): ?string
    {
        $items = $subscription->items->data ?? [];
        if ($items === [] || ! isset($items[0]->price)) {
            return null;
        }

        return $items[0]->price->id ?? null;
    }

    private function mapPriceIdToPlan(?string $priceId): string
    {
        if ($priceId === null || $priceId === '') {
            return 'free';
        }

        /** @var array<string, string> $map */
        $map = config('services.stripe.price_plan_map', []);
        if (isset($map[$priceId])) {
            return $map[$priceId];
        }

        Log::warning('Stripe webhook: unknown price_id, defaulting to free', ['price_id' => $priceId]);

        return 'free';
    }

    private function auditPlanChangeIfNeeded(int $userId, string $oldPlan, string $newPlan, string $stripeEventId): void
    {
        if ($oldPlan === $newPlan) {
            return;
        }

        try {
            DB::table('audit_logs')->insert([
                'event_type' => 'plan_change',
                'user_id' => $userId,
                'resource_type' => 'User',
                'resource_id' => $userId,
                'changes' => json_encode([
                    'source' => 'stripe_webhook',
                    'event_id' => $stripeEventId,
                    'old_plan' => $oldPlan,
                    'new_plan' => $newPlan,
                ]),
                'ip_address' => request()?->ip(),
                'user_agent' => request()?->userAgent(),
                'tenant_id' => 1,
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('audit_logs plan_change insert failed', [
                'error' => $e->getMessage(),
                'user_id' => $userId,
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $detail
     */
    private function auditWebhookStripe(string $stripeEventType, ?int $userId, array $detail): void
    {
        try {
            DB::table('audit_logs')->insert([
                'event_type' => 'webhook_received',
                'user_id' => $userId,
                'resource_type' => 'User',
                'resource_id' => $userId,
                'changes' => json_encode(array_merge([
                    'provider' => 'stripe',
                    'external_event_type' => $stripeEventType,
                ], $detail)),
                'ip_address' => request()?->ip(),
                'user_agent' => request()?->userAgent(),
                'tenant_id' => 1,
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('audit_logs webhook_received insert failed', [
                'error' => $e->getMessage(),
                'stripe_event_type' => $stripeEventType,
            ]);
        }
    }
}
