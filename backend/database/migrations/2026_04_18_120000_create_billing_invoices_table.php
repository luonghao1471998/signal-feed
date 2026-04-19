<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('billing_invoices')) {
            return;
        }

        Schema::create('billing_invoices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('stripe_invoice_id')->unique();
            $table->string('stripe_customer_id');
            $table->string('stripe_subscription_id')->nullable();
            $table->string('currency', 3);
            $table->unsignedInteger('amount_due')->default(0);
            $table->unsignedInteger('amount_paid')->default(0);
            $table->string('status', 32);
            $table->text('description')->nullable();
            $table->timestampTz('period_start')->nullable();
            $table->timestampTz('period_end')->nullable();
            $table->text('hosted_invoice_url')->nullable();
            $table->timestampTz('paid_at')->nullable();
            $table->timestampTz('stripe_created_at')->nullable();
            $table->integer('tenant_id')->default(1);
            $table->timestampsTz();

            $table->index(['user_id', 'stripe_created_at']);
            $table->index('stripe_customer_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_invoices');
    }
};
