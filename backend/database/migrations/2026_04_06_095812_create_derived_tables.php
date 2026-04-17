<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Draft Tweets
        DB::statement('
            CREATE TABLE draft_tweets (
                id BIGSERIAL PRIMARY KEY,
                signal_id BIGINT NOT NULL,
                text VARCHAR(280) NOT NULL,
                tenant_id BIGINT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                CONSTRAINT fk_draft_tweets_signal FOREIGN KEY (signal_id) 
                    REFERENCES signals(id) ON DELETE CASCADE,
                CONSTRAINT unique_draft_per_signal UNIQUE (signal_id)
            )
        ');

        // User Interactions
        DB::statement("
            CREATE TABLE user_interactions (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                signal_id BIGINT NOT NULL,
                action interaction_action NOT NULL,
                metadata JSONB DEFAULT '{}',
                tenant_id BIGINT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                CONSTRAINT fk_user_interactions_user FOREIGN KEY (user_id) 
                    REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_user_interactions_signal FOREIGN KEY (signal_id) 
                    REFERENCES signals(id) ON DELETE CASCADE
            )
        ");

        // Audit Logs (immutable)
        DB::statement('
            CREATE TABLE audit_logs (
                id BIGSERIAL PRIMARY KEY,
                event_type VARCHAR(100) NOT NULL,
                user_id BIGINT,
                resource_type VARCHAR(100),
                resource_id BIGINT,
                changes JSONB,
                ip_address INET,
                user_agent TEXT,
                tenant_id BIGINT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) 
                    REFERENCES users(id) ON DELETE SET NULL
            )
        ');

        // User Personal Feed Entries (Pro/Power feature - Sprint 2+)
        DB::statement('
            CREATE TABLE user_personal_feed_entries (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                signal_id BIGINT NOT NULL,
                rank_score DECIMAL(5,4) DEFAULT 0,
                tenant_id BIGINT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                CONSTRAINT fk_user_personal_feed_user FOREIGN KEY (user_id) 
                    REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_user_personal_feed_signal FOREIGN KEY (signal_id) 
                    REFERENCES signals(id) ON DELETE CASCADE,
                CONSTRAINT unique_user_signal_feed UNIQUE (user_id, signal_id)
            )
        ');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS user_personal_feed_entries');
        DB::statement('DROP TABLE IF EXISTS audit_logs');
        DB::statement('DROP TABLE IF EXISTS user_interactions');
        DB::statement('DROP TABLE IF EXISTS draft_tweets');
    }
};
