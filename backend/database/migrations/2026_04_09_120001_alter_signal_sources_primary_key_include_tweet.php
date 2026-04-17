<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE signal_sources DROP CONSTRAINT IF EXISTS signal_sources_pkey');
        DB::statement('
            ALTER TABLE signal_sources
            ADD PRIMARY KEY (signal_id, source_id, tweet_id)
        ');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE signal_sources DROP CONSTRAINT IF EXISTS signal_sources_pkey');
        DB::statement('
            ALTER TABLE signal_sources
            ADD PRIMARY KEY (signal_id, source_id)
        ');
    }
};
