<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop enums if they exist (idempotent)
        DB::statement('DROP TYPE IF EXISTS source_type CASCADE');
        DB::statement('DROP TYPE IF EXISTS source_status CASCADE');
        DB::statement('DROP TYPE IF EXISTS user_plan CASCADE');
        DB::statement('DROP TYPE IF EXISTS interaction_action CASCADE');

        // Create enums
        DB::statement("
            CREATE TYPE source_type AS ENUM ('default', 'user')
        ");

        DB::statement("
            CREATE TYPE source_status AS ENUM ('pending_review', 'active', 'spam', 'deleted')
        ");

        DB::statement("
            CREATE TYPE user_plan AS ENUM ('free', 'pro', 'power')
        ");

        DB::statement("
            CREATE TYPE interaction_action AS ENUM ('view', 'click', 'copy_draft', 'skip')
        ");
    }

    public function down(): void
    {
        DB::statement('DROP TYPE IF EXISTS interaction_action CASCADE');
        DB::statement('DROP TYPE IF EXISTS user_plan CASCADE');
        DB::statement('DROP TYPE IF EXISTS source_status CASCADE');
        DB::statement('DROP TYPE IF EXISTS source_type CASCADE');
    }
};
