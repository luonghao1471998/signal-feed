<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sources', function (Blueprint $table): void {
            $table->text('avatar_url')->nullable()->after('account_url');
            $table->timestampTz('avatar_synced_at')->nullable()->after('avatar_url');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->text('avatar_url')->nullable()->after('x_username');
        });
    }

    public function down(): void
    {
        Schema::table('sources', function (Blueprint $table): void {
            $table->dropColumn(['avatar_url', 'avatar_synced_at']);
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['avatar_url']);
        });
    }
};
