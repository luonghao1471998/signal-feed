<?php

namespace Tests\Unit\Services;

use App\Models\BillingInvoice;
use App\Models\User;
use App\Services\BillingInvoiceSyncService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Stripe\Invoice;
use Tests\TestCase;

class BillingInvoiceSyncServiceTest extends TestCase
{
    use DatabaseTransactions;

    public function test_upsert_links_invoice_when_user_has_stripe_customer_id(): void
    {
        $user = User::factory()->create([
            'stripe_customer_id' => 'cus_unit_test_1',
            'email' => 'billing-sync-test@example.com',
        ]);

        $invoice = Invoice::constructFrom([
            'id' => 'in_unit_test_1',
            'object' => 'invoice',
            'customer' => 'cus_unit_test_1',
            'subscription' => 'sub_unit_test_1',
            'currency' => 'usd',
            'amount_due' => 1000,
            'amount_paid' => 1000,
            'status' => 'paid',
            'period_start' => time(),
            'period_end' => time() + 86400,
            'lines' => [
                'object' => 'list',
                'data' => [],
            ],
        ]);

        $service = new BillingInvoiceSyncService;
        $service->upsertFromStripeInvoice($invoice);

        $row = BillingInvoice::query()->where('stripe_invoice_id', 'in_unit_test_1')->first();
        $this->assertNotNull($row);
        $this->assertSame($user->id, $row->user_id);
        $this->assertSame('cus_unit_test_1', $row->stripe_customer_id);
    }
}
