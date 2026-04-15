<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (!Schema::hasColumn('users', 'display_name')) {
                $table->string('display_name', 100)->nullable()->after('x_username');
            }

            if (!Schema::hasColumn('users', 'email')) {
                $table->string('email', 255)->nullable()->after('display_name');
            }

            if (!Schema::hasColumn('users', 'locale')) {
                $table->string('locale', 5)->default('en')->after('email');
            }

            if (!Schema::hasColumn('users', 'telegram_chat_id')) {
                $table->string('telegram_chat_id', 100)->nullable()->after('locale');
            }

            if (!Schema::hasColumn('users', 'telegram_connect_token')) {
                $table->string('telegram_connect_token', 50)->nullable()->unique()->after('telegram_chat_id');
            }

            if (!Schema::hasColumn('users', 'delivery_preferences')) {
                $table->jsonb('delivery_preferences')->default('{}')->after('my_categories');
            }
        });
    }

    public function down(): void
    {
        // Intentionally no-op to avoid destructive schema rollback in this phase.
    }
};
