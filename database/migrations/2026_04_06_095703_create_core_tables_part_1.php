<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Categories table
        DB::statement("
            CREATE TABLE categories (
                id BIGSERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                slug VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                tenant_id BIGINT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        ");

        // Users table
        DB::statement("
            CREATE TABLE users (
                id BIGSERIAL PRIMARY KEY,
                x_user_id VARCHAR(50) NOT NULL UNIQUE,
                x_username VARCHAR(100) NOT NULL,
                x_access_token TEXT,
                x_refresh_token TEXT,
                x_token_expires_at TIMESTAMPTZ,
                plan user_plan NOT NULL DEFAULT 'free',
                my_categories INTEGER[] DEFAULT '{}',
                delivery_preferences JSONB DEFAULT '{}',
                is_admin BOOLEAN NOT NULL DEFAULT FALSE,
                stripe_customer_id VARCHAR(100),
                stripe_subscription_id VARCHAR(100),
                subscription_ends_at TIMESTAMPTZ,
                tenant_id BIGINT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        ");

        // Sources table
        DB::statement("
            CREATE TABLE sources (
                id BIGSERIAL PRIMARY KEY,
                type source_type NOT NULL DEFAULT 'default',
                status source_status NOT NULL DEFAULT 'active',
                x_handle VARCHAR(100) NOT NULL,
                x_user_id VARCHAR(50),
                display_name VARCHAR(200),
                account_url TEXT NOT NULL,
                last_crawled_at TIMESTAMPTZ,
                added_by_user_id BIGINT,
                tenant_id BIGINT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMPTZ,
                
                CONSTRAINT fk_sources_added_by FOREIGN KEY (added_by_user_id) 
                    REFERENCES users(id) ON DELETE SET NULL,
                CONSTRAINT unique_x_handle UNIQUE (x_handle)
            )
        ");

        // Tweets table
        DB::statement("
            CREATE TABLE tweets (
                id BIGSERIAL PRIMARY KEY,
                tweet_id VARCHAR(50) NOT NULL UNIQUE,
                source_id BIGINT NOT NULL,
                text TEXT NOT NULL,
                posted_at TIMESTAMPTZ NOT NULL,
                url TEXT NOT NULL,
                signal_score DECIMAL(3,2) DEFAULT 0,
                is_signal BOOLEAN DEFAULT FALSE,
                tenant_id BIGINT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMPTZ,
                
                CONSTRAINT fk_tweets_source FOREIGN KEY (source_id) 
                    REFERENCES sources(id) ON DELETE CASCADE
            )
        ");

        // Digests table
        DB::statement("
            CREATE TABLE digests (
                id BIGSERIAL PRIMARY KEY,
                date DATE NOT NULL,
                total_signals INT NOT NULL DEFAULT 0,
                tenant_id BIGINT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMPTZ,
                
                CONSTRAINT unique_digest_date UNIQUE (date, tenant_id)
            )
        ");

        // Signals table
        DB::statement("
            CREATE TABLE signals (
                id BIGSERIAL PRIMARY KEY,
                digest_id BIGINT NOT NULL,
                cluster_id VARCHAR(100) NOT NULL,
                title VARCHAR(200) NOT NULL,
                summary TEXT NOT NULL,
                categories INTEGER[] DEFAULT '{}',
                topic_tags VARCHAR(50)[] DEFAULT '{}',
                source_count INT NOT NULL DEFAULT 0,
                rank_score DECIMAL(5,4) DEFAULT 0,
                tenant_id BIGINT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                CONSTRAINT fk_signals_digest FOREIGN KEY (digest_id) 
                    REFERENCES digests(id) ON DELETE CASCADE
            )
        ");
    }

    public function down(): void
    {
        DB::statement("DROP TABLE IF EXISTS signals CASCADE");
        DB::statement("DROP TABLE IF EXISTS digests CASCADE");
        DB::statement("DROP TABLE IF EXISTS tweets CASCADE");
        DB::statement("DROP TABLE IF EXISTS sources CASCADE");
        DB::statement("DROP TABLE IF EXISTS users CASCADE");
        DB::statement("DROP TABLE IF EXISTS categories CASCADE");
    }
};