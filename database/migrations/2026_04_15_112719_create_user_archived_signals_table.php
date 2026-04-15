<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('user_archived_signals', function (Blueprint $table) {
            $table->id();
            $table->integer('tenant_id')->default(1);
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('signal_id')->constrained()->cascadeOnDelete();
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['user_id', 'signal_id']);
            $table->index('user_id');
            $table->index('signal_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_archived_signals');
    }
};
