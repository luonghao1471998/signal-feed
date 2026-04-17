<?php

namespace App\Services;

use App\Models\MySourceSubscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Stripe\Checkout\Session;
use Stripe\Event;
use Stripe\Exception\ApiErrorException;
use Stripe\Invoice;
use Stripe\StripeClient;
use Stripe\Subscription;

class StripeWebhookService
{
    private StripeClient $stripe;

    public function __construct()
    {
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
        // 1. Thực hiện xử lý nghiệp vụ
        match ($event->type) {
            'checkout.session.completed' => $this->handleCheckoutSessionCompleted($event),
            'customer.subscription.updated' => $this->handleSubscriptionUpdated($event),
            'customer.subscription.deleted' => $this->handleSubscriptionDeleted($event),
            'invoice.payment_failed' => $this->handleInvoicePaymentFailed($event),
            default => Log::info('Stripe webhook: ignored event type', ['type' => $event->type]),
        };

        // 2. CHỐT HẠ: Ghi log idempotency vào database (SỬ DỤNG event_id)
        try {
            DB::table('processed_stripe_events')->insert([
                'event_id' => $event->id,
                'event_type' => $event->type,
                'processed_at' => now()->utc(),
                'created_at' => now()->utc(),
            ]);
            DB::commit();
        } catch (\Throwable $e) {
            // Nếu lỗi do trùng ID (duplicate key) thì cũng không sao, vì event đã xử lý rồi
            Log::error('Stripe webhook: failed to record idempotency', [
                'event_id' => $event->id,
                'error' => $e->getMessage(),
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
        $metadata = $session->metadata ?? null;
        $userIdRaw = is_object($metadata) && isset($metadata->user_id)
            ? $metadata->user_id
            : (is_array($metadata) ? ($metadata['user_id'] ?? null) : null);

        if ($userIdRaw === null || $userIdRaw === '') {
            Log::warning('Stripe checkout.session.completed: missing metadata.user_id', [
                'session_id' => $session->id ?? null,
            ]);

            return;
        }

        $userId = (int) $userIdRaw;
        $user = User::query()->find($userId);
        if ($user === null) {
            Log::warning('Stripe checkout.session.completed: user not found', ['user_id' => $userId]);

            return;
        }

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

        $subscription = $this->stripe->subscriptions->retrieve($subscriptionId, []);
        $priceId = $this->getSubscriptionPriceId($subscription);
        $newPlan = $this->mapPriceIdToPlan($priceId);

        $oldPlan = (string) $user->plan;
        $user->stripe_customer_id = $customerId;
        $user->stripe_subscription_id = $subscriptionId;
        $user->plan = $newPlan;
        $user->save();

        $this->auditPlanChangeIfNeeded($user->id, $oldPlan, $newPlan, (string) $event->id);
        $this->auditWebhookStripe('checkout.session.completed', $user->id, [
            'event_id' => $event->id,
            'effect' => 'subscription.created',
        ]);
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
            $user->save();
            $this->cleanupSubscriptionsToPlanLimit($user);
            $this->auditPlanChangeIfNeeded($user->id, $oldPlan, (string) $user->plan, (string) $event->id);
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
        $user = $this->findUserForSubscription($subscription);
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
            return User::query()->where('stripe_customer_id', $customerId)->first();
        }

        return null;
    }

    private function downgradeToFree(User $user, bool $keepCustomerId): void
    {
        $user->plan = 'free';
        $user->stripe_subscription_id = null;
        if (! $keepCustomerId) {
            $user->stripe_customer_id = null;
        }
        $user->save();
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
                'created_at' => now()->utc(),
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
                'created_at' => now()->utc(),
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
                'created_at' => now()->utc(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('audit_logs webhook_received insert failed', [
                'error' => $e->getMessage(),
                'stripe_event_type' => $stripeEventType,
            ]);
        }
    }
}
