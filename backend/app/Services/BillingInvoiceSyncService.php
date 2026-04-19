<?php

namespace App\Services;

use App\Models\BillingInvoice;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\ApiErrorException;
use Stripe\Invoice;
use Stripe\StripeClient;
use Stripe\StripeObject;

class BillingInvoiceSyncService
{
    private ?StripeClient $stripeClient = null;

    /**
     * Sau Pro→Power (API) hoặc mọi subscription.updated, Stripe tạo invoice proration; đôi khi cần đồng bộ chủ động từ API.
     *
     * @throws ApiErrorException
     */
    public function syncInvoicesForSubscription(string $subscriptionId): void
    {
        $stripe = $this->stripe();
        if ($stripe === null) {
            return;
        }

        try {
            $response = $stripe->invoices->all([
                'subscription' => $subscriptionId,
                'limit' => 25,
            ]);
        } catch (ApiErrorException $e) {
            Log::warning('Billing invoice sync: list invoices by subscription failed', [
                'subscription_id' => $subscriptionId,
                'message' => $e->getMessage(),
            ]);

            return;
        }

        foreach ($response->data ?? [] as $row) {
            if (! isset($row->id)) {
                continue;
            }
            try {
                $full = $stripe->invoices->retrieve((string) $row->id, []);
                $this->upsertFromStripeInvoice($full);
            } catch (ApiErrorException $e) {
                Log::warning('Billing invoice sync: retrieve invoice after subscription change failed', [
                    'invoice_id' => $row->id,
                    'message' => $e->getMessage(),
                ]);
            } catch (\Throwable $e) {
                Log::warning('Billing invoice sync: upsert after subscription change failed', [
                    'invoice_id' => $row->id ?? null,
                    'message' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Upsert a row from Stripe Invoice object (webhook payload).
     */
    public function upsertFromStripeInvoice(Invoice $invoice): void
    {
        $customerId = is_string($invoice->customer)
            ? $invoice->customer
            : ($invoice->customer->id ?? null);
        if ($customerId === null || $customerId === '') {
            return;
        }

        $user = User::query()->where('stripe_customer_id', $customerId)->first();
        if ($user === null) {
            $user = $this->resolveUserForStripeInvoice($invoice, (string) $customerId);
        }
        if ($user === null) {
            Log::info('Billing invoice sync: no user for Stripe customer', [
                'stripe_customer_id' => $customerId,
                'stripe_invoice_id' => $invoice->id ?? null,
            ]);

            return;
        }

        $subscriptionId = $this->extractSubscriptionIdFromInvoice($invoice);

        $description = $this->invoiceDescription($invoice);
        $currency = strtolower((string) ($invoice->currency ?? 'usd'));
        $amountDue = (int) ($invoice->amount_due ?? 0);
        $amountPaid = (int) ($invoice->amount_paid ?? 0);
        $status = (string) ($invoice->status ?? 'unknown');

        $periodStart = isset($invoice->period_start) && is_numeric($invoice->period_start)
            ? Carbon::createFromTimestamp((int) $invoice->period_start)->utc()
            : null;
        $periodEnd = isset($invoice->period_end) && is_numeric($invoice->period_end)
            ? Carbon::createFromTimestamp((int) $invoice->period_end)->utc()
            : null;

        $paidAt = null;
        if (isset($invoice->status_transitions->paid_at) && is_numeric($invoice->status_transitions->paid_at)) {
            $paidAt = Carbon::createFromTimestamp((int) $invoice->status_transitions->paid_at)->utc();
        }

        $stripeCreatedAt = isset($invoice->created) && is_numeric($invoice->created)
            ? Carbon::createFromTimestamp((int) $invoice->created)->utc()
            : null;

        $hostedUrl = is_string($invoice->hosted_invoice_url ?? null) ? $invoice->hosted_invoice_url : null;

        BillingInvoice::query()->updateOrCreate(
            ['stripe_invoice_id' => (string) $invoice->id],
            [
                'user_id' => $user->id,
                'stripe_customer_id' => $customerId,
                'stripe_subscription_id' => $subscriptionId !== null && $subscriptionId !== '' ? (string) $subscriptionId : null,
                'currency' => $currency,
                'amount_due' => $amountDue,
                'amount_paid' => $amountPaid,
                'status' => $status,
                'description' => $description,
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
                'hosted_invoice_url' => $hostedUrl,
                'paid_at' => $paidAt,
                'stripe_created_at' => $stripeCreatedAt,
                'tenant_id' => (int) ($user->tenant_id ?? 1),
            ],
        );
    }

    /**
     * When users.stripe_customer_id is still empty (e.g. invoice webhook before checkout.session.completed),
     * resolve the user via subscription metadata (user_id) or Stripe customer email.
     */
    private function resolveUserForStripeInvoice(Invoice $invoice, string $customerId): ?User
    {
        $stripe = $this->stripe();
        if ($stripe === null) {
            return null;
        }

        $subscriptionId = $this->extractSubscriptionIdFromInvoice($invoice);

        if (is_string($subscriptionId) && $subscriptionId !== '') {
            try {
                $subscription = $stripe->subscriptions->retrieve($subscriptionId, []);
            } catch (ApiErrorException $e) {
                Log::warning('Billing invoice sync: subscription retrieve failed', [
                    'subscription_id' => $subscriptionId,
                    'message' => $e->getMessage(),
                ]);
                $subscription = null;
            }
            if ($subscription !== null) {
                $userIdRaw = $this->metadataUserId($subscription->metadata ?? null);
                if ($userIdRaw !== null && $userIdRaw !== '') {
                    $user = User::query()->find((int) $userIdRaw);
                    if ($user !== null) {
                        $this->assignStripeIdsIfEmpty($user, $customerId, $subscriptionId);

                        return $user;
                    }
                }
            }
        }

        try {
            $customer = $stripe->customers->retrieve($customerId, []);
        } catch (ApiErrorException $e) {
            Log::warning('Billing invoice sync: customer retrieve failed', [
                'customer_id' => $customerId,
                'message' => $e->getMessage(),
            ]);

            return null;
        }

        $email = is_string($customer->email ?? null) ? strtolower(trim($customer->email)) : '';
        if ($email === '') {
            return null;
        }

        $user = User::query()->whereRaw('LOWER(TRIM(email)) = ?', [$email])->first();
        if ($user === null) {
            return null;
        }

        $this->assignStripeIdsIfEmpty(
            $user,
            $customerId,
            is_string($subscriptionId) && $subscriptionId !== '' ? $subscriptionId : null
        );

        return $user;
    }

    private function assignStripeIdsIfEmpty(User $user, string $customerId, ?string $subscriptionId): void
    {
        if (User::query()->where('stripe_customer_id', $customerId)->where('id', '!=', $user->id)->exists()) {
            return;
        }

        $dirty = false;
        if ($user->stripe_customer_id === null || $user->stripe_customer_id === '') {
            $user->stripe_customer_id = $customerId;
            $dirty = true;
        }
        if ($subscriptionId !== null && $subscriptionId !== ''
            && ($user->stripe_subscription_id === null || $user->stripe_subscription_id === '')) {
            if (! User::query()->where('stripe_subscription_id', $subscriptionId)->where('id', '!=', $user->id)->exists()) {
                $user->stripe_subscription_id = $subscriptionId;
                $dirty = true;
            }
        }
        if ($dirty) {
            $user->save();
        }
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

    private function stripe(): ?StripeClient
    {
        if ($this->stripeClient !== null) {
            return $this->stripeClient;
        }

        $secret = config('services.stripe.secret');
        if ($secret === null || $secret === '') {
            return null;
        }

        $this->stripeClient = new StripeClient($secret);

        return $this->stripeClient;
    }

    /**
     * Invoice webhook/API đôi khi không có field `subscription` (thin payload) — lấy từ toArray hoặc line items.
     */
    private function extractSubscriptionIdFromInvoice(Invoice $invoice): ?string
    {
        try {
            $arr = $invoice->toArray();
        } catch (\Throwable) {
            return null;
        }

        if (isset($arr['subscription'])) {
            $sub = $arr['subscription'];
            if (is_string($sub) && $sub !== '') {
                return $sub;
            }
            if (is_array($sub) && isset($sub['id']) && is_string($sub['id'])) {
                return $sub['id'];
            }
        }

        $lines = $arr['lines']['data'] ?? [];
        if (! is_array($lines)) {
            return null;
        }

        foreach ($lines as $line) {
            if (! is_array($line)) {
                continue;
            }
            if (isset($line['subscription']) && is_string($line['subscription']) && $line['subscription'] !== '') {
                return $line['subscription'];
            }
            if (isset($line['parent']['subscription_item_details']['subscription']) && is_string($line['parent']['subscription_item_details']['subscription'])) {
                return $line['parent']['subscription_item_details']['subscription'];
            }
        }

        return null;
    }

    private function invoiceDescription(Invoice $invoice): ?string
    {
        $lines = $invoice->lines ?? null;
        if ($lines === null) {
            return null;
        }

        $data = $lines->data ?? null;
        if (! is_array($data)) {
            return null;
        }

        foreach ($data as $item) {
            if (! is_object($item)) {
                continue;
            }
            $desc = $item->description ?? null;
            if (is_string($desc) && $desc !== '') {
                return $desc;
            }
        }

        return null;
    }
}
