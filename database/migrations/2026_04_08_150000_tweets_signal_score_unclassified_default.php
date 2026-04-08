<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Unclassified tweets use signal_score NULL (Flow 3 classify step).
     * Legacy rows with default 0 + is_signal false are treated as pending classify.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE tweets ALTER COLUMN signal_score DROP DEFAULT');
        DB::statement('ALTER TABLE tweets ALTER COLUMN signal_score SET DEFAULT NULL');
        DB::statement('
            UPDATE tweets
            SET signal_score = NULL
            WHERE is_signal = false
              AND signal_score = 0
        ');
    }

    public function down(): void
    {
        DB::statement('
            UPDATE tweets
            SET signal_score = 0
            WHERE signal_score IS NULL
        ');
        DB::statement('ALTER TABLE tweets ALTER COLUMN signal_score DROP DEFAULT');
        DB::statement('ALTER TABLE tweets ALTER COLUMN signal_score SET DEFAULT 0');
    }
};
