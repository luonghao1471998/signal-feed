<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('signals', function (Blueprint $table) {
            // type: 0 = shared (default), 1 = personal
            $table->smallInteger('type')->default(0)->after('id');

            // user_id: null for shared signals, set for personal signals
            $table->bigInteger('user_id')->nullable()->after('type');

            // Index for performance
            $table->index(['type', 'user_id'], 'idx_signals_type_user');
        });
    }

    public function down(): void
    {
        Schema::table('signals', function (Blueprint $table) {
            $table->dropIndex('idx_signals_type_user');
            $table->dropColumn(['type', 'user_id']);
        });
    }
};
