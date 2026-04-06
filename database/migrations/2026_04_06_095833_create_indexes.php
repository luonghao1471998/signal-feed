<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Foreign Key Indexes (for JOIN performance)
        DB::statement("CREATE INDEX idx_sources_added_by_user_id ON sources(added_by_user_id)");
        DB::statement("CREATE INDEX idx_tweets_source_id ON tweets(source_id)");
        DB::statement("CREATE INDEX idx_signals_digest_id ON signals(digest_id)");
        DB::statement("CREATE INDEX idx_source_categories_category_id ON source_categories(category_id)");
        DB::statement("CREATE INDEX idx_signal_sources_source_id ON signal_sources(source_id)");
        DB::statement("CREATE INDEX idx_signal_sources_tweet_id ON signal_sources(tweet_id)");
        DB::statement("CREATE INDEX idx_draft_tweets_signal_id ON draft_tweets(signal_id)");
        DB::statement("CREATE INDEX idx_user_interactions_user_id ON user_interactions(user_id)");
        DB::statement("CREATE INDEX idx_user_interactions_signal_id ON user_interactions(signal_id)");
        DB::statement("CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)");

        // Permission & State Indexes
        DB::statement("CREATE INDEX idx_sources_type_status ON sources(type, status)");
        DB::statement("CREATE INDEX idx_users_plan ON users(plan)");

        // Filter Indexes (digest browsing)
        DB::statement("CREATE INDEX idx_tweets_is_signal_posted_at ON tweets(is_signal, posted_at DESC)");
        DB::statement("CREATE INDEX idx_signals_rank_score ON signals(rank_score DESC)");
        DB::statement("CREATE INDEX idx_digests_date ON digests(date DESC)");
        DB::statement("CREATE INDEX idx_user_interactions_created_at ON user_interactions(created_at DESC)");
    }

    public function down(): void
    {
        DB::statement("DROP INDEX IF EXISTS idx_user_interactions_created_at");
        DB::statement("DROP INDEX IF EXISTS idx_digests_date");
        DB::statement("DROP INDEX IF EXISTS idx_signals_rank_score");
        DB::statement("DROP INDEX IF EXISTS idx_tweets_is_signal_posted_at");
        DB::statement("DROP INDEX IF EXISTS idx_users_plan");
        DB::statement("DROP INDEX IF EXISTS idx_sources_type_status");
        DB::statement("DROP INDEX IF EXISTS idx_audit_logs_user_id");
        DB::statement("DROP INDEX IF EXISTS idx_user_interactions_signal_id");
        DB::statement("DROP INDEX IF EXISTS idx_user_interactions_user_id");
        DB::statement("DROP INDEX IF EXISTS idx_draft_tweets_signal_id");
        DB::statement("DROP INDEX IF EXISTS idx_signal_sources_tweet_id");
        DB::statement("DROP INDEX IF EXISTS idx_signal_sources_source_id");
        DB::statement("DROP INDEX IF EXISTS idx_source_categories_category_id");
        DB::statement("DROP INDEX IF EXISTS idx_signals_digest_id");
        DB::statement("DROP INDEX IF EXISTS idx_tweets_source_id");
        DB::statement("DROP INDEX IF EXISTS idx_sources_added_by_user_id");
    }
};