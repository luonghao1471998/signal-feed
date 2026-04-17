<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('
            ALTER TABLE signals
            ADD COLUMN impact_score NUMERIC(3,2) NOT NULL DEFAULT 0
        ');

        DB::statement('
            ALTER TABLE signals
            ADD CONSTRAINT signals_impact_score_check
            CHECK (impact_score >= 0 AND impact_score <= 1)
        ');

        DB::statement('CREATE INDEX idx_signals_impact_score ON signals (impact_score)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS idx_signals_impact_score');
        DB::statement('ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_impact_score_check');
        DB::statement('ALTER TABLE signals DROP COLUMN IF EXISTS impact_score');
    }
};
