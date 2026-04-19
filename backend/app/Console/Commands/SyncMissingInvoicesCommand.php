<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\BillingInvoiceSyncService;
use Illuminate\Console\Command;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;

class SyncMissingInvoicesCommand extends Command
{
    protected $signature = 'invoices:sync-missing
                            {--user-id= : Only sync for this user ID}
                            {--customer-id= : Only sync for this Stripe customer ID}
                            {--limit=100 : Max invoices to fetch per customer}';

    protected $description = 'Backfill billing_invoices from Stripe for all customers (or a specific user/customer)';

    public function __construct(
        private readonly BillingInvoiceSyncService $syncService,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $secret = config('services.stripe.secret');
        if ($secret === null || $secret === '') {
            $this->error('STRIPE_SECRET is not configured.');

            return self::FAILURE;
        }

        $stripe = new StripeClient($secret);
        $limit = max(1, min(100, (int) $this->option('limit')));

        $query = User::query()->whereNotNull('stripe_customer_id')->where('stripe_customer_id', '!=', '');

        if ($this->option('user-id')) {
            $query->where('id', (int) $this->option('user-id'));
        }

        if ($this->option('customer-id')) {
            $query->where('stripe_customer_id', (string) $this->option('customer-id'));
        }

        $users = $query->orderBy('id')->get();

        if ($users->isEmpty()) {
            $this->warn('No matching users found.');

            return self::SUCCESS;
        }

        $totalSynced = 0;
        $totalFailed = 0;

        foreach ($users as $user) {
            $customerId = (string) $user->stripe_customer_id;
            $this->info("User {$user->id} ({$customerId})…");

            try {
                $response = $stripe->invoices->all([
                    'customer' => $customerId,
                    'limit' => $limit,
                    'expand' => ['data.lines'],
                ]);
            } catch (ApiErrorException $e) {
                $this->error("  Failed to list invoices: {$e->getMessage()}");
                $totalFailed++;

                continue;
            }

            $invoices = $response->data ?? [];
            $synced = 0;

            foreach ($invoices as $invoice) {
                if (! isset($invoice->id)) {
                    continue;
                }

                try {
                    // Retrieve full invoice (includes status_transitions, lines, etc.)
                    $full = $stripe->invoices->retrieve((string) $invoice->id, []);
                    $this->syncService->upsertFromStripeInvoice($full);
                    $synced++;
                } catch (\Throwable $e) {
                    $this->warn("  Invoice {$invoice->id}: {$e->getMessage()}");
                    $totalFailed++;
                }
            }

            $totalSynced += $synced;
            $this->info("  Synced {$synced} invoice(s).");
        }

        $this->info("Done. Total synced: {$totalSynced}, failed: {$totalFailed}.");

        return $totalFailed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
