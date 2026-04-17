<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('admins')->where('role', 'admin')->update(['role' => 'moderator']);

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE admins ALTER COLUMN role SET DEFAULT 'moderator'");
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE admins ALTER COLUMN role SET DEFAULT 'admin'");
        }
    }
};
