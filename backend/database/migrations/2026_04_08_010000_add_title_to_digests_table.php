<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add title column to digests table
        DB::statement('
            ALTER TABLE digests 
            ADD COLUMN IF NOT EXISTS title TEXT
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('
            ALTER TABLE digests 
            DROP COLUMN IF EXISTS title
        ');
    }
};
