<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Source Categories (M:N)
        DB::statement('
            CREATE TABLE source_categories (
                source_id BIGINT NOT NULL,
                category_id BIGINT NOT NULL,
                tenant_id BIGINT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                PRIMARY KEY (source_id, category_id),
                CONSTRAINT fk_source_categories_source FOREIGN KEY (source_id) 
                    REFERENCES sources(id) ON DELETE CASCADE,
                CONSTRAINT fk_source_categories_category FOREIGN KEY (category_id) 
                    REFERENCES categories(id) ON DELETE CASCADE
            )
        ');

        // My Source Subscriptions (M:N - User follows Source)
        DB::statement('
            CREATE TABLE my_source_subscriptions (
                user_id BIGINT NOT NULL,
                source_id BIGINT NOT NULL,
                tenant_id BIGINT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                PRIMARY KEY (user_id, source_id),
                CONSTRAINT fk_my_source_subscriptions_user FOREIGN KEY (user_id) 
                    REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_my_source_subscriptions_source FOREIGN KEY (source_id) 
                    REFERENCES sources(id) ON DELETE CASCADE
            )
        ');

        // Signal Sources (M:N - Signal linked to Tweets via Source)
        DB::statement('
            CREATE TABLE signal_sources (
                signal_id BIGINT NOT NULL,
                source_id BIGINT NOT NULL,
                tweet_id BIGINT NOT NULL,
                tenant_id BIGINT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                PRIMARY KEY (signal_id, source_id),
                CONSTRAINT fk_signal_sources_signal FOREIGN KEY (signal_id) 
                    REFERENCES signals(id) ON DELETE CASCADE,
                CONSTRAINT fk_signal_sources_source FOREIGN KEY (source_id) 
                    REFERENCES sources(id) ON DELETE CASCADE,
                CONSTRAINT fk_signal_sources_tweet FOREIGN KEY (tweet_id) 
                    REFERENCES tweets(id) ON DELETE CASCADE
            )
        ');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS signal_sources');
        DB::statement('DROP TABLE IF EXISTS my_source_subscriptions');
        DB::statement('DROP TABLE IF EXISTS source_categories');
    }
};
