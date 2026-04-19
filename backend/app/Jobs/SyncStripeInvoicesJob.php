<?php

namespace App\Jobs;

use App\Services\BillingInvoiceSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Đồng bộ hóa đơn Stripe cho một subscription sau khi webhook đã được xử lý.
 * Được dispatch với delay để đảm bảo proration invoice đã được tạo trên Stripe.
 */
class SyncStripeInvoicesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 30;

    public function __construct(
        public readonly string $subscriptionId,
        public readonly int $userId,
    ) {}

    public function handle(BillingInvoiceSyncService $syncService): void
    {
        Log::info('SyncStripeInvoicesJob: syncing invoices', [
            'subscription_id' => $this->subscriptionId,
            'user_id' => $this->userId,
        ]);

        try {
            $syncService->syncInvoicesForSubscription($this->subscriptionId);
        } catch (\Throwable $e) {
            Log::warning('SyncStripeInvoicesJob: sync failed', [
                'subscription_id' => $this->subscriptionId,
                'user_id' => $this->userId,
                'message' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
