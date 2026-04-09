<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('
            CREATE UNIQUE INDEX idx_signals_cluster_digest
            ON signals (cluster_id, digest_id)
        ');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS idx_signals_cluster_digest');
    }
};
