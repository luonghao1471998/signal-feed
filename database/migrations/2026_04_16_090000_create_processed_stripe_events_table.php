<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('processed_stripe_events')) {
            Schema::create('processed_stripe_events', function (Blueprint $table): void {
                $table->id();
                $table->string('event_id')->unique();
                $table->string('event_type')->nullable();
                $table->timestampTz('processed_at')->useCurrent();
                $table->timestampTz('created_at')->useCurrent();
            });
        }
    }

    public function down(): void
    {
        // Intentionally empty — do not drop table to protect data.
    }
};
