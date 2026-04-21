<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CategorySeeder extends Seeder
{
    /**
     * Seed canonical categories (tenant_id = 1).
     *
     * Safe to re-run: existing categories are updated (by slug), new ones are inserted.
     * No categories or dependent data are ever deleted.
     */
    public function run(): void
    {
        $now = Carbon::now('UTC');

        $rows = [
            [
                'name'        => 'AI & ML',
                'slug'        => 'ai-ml',
                'description' => 'Artificial Intelligence, Machine Learning, LLMs',
                'tenant_id'   => 1,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'name'        => 'Crypto & Web3',
                'slug'        => 'crypto-web3',
                'description' => 'Cryptocurrency, Blockchain, DeFi, NFT',
                'tenant_id'   => 1,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'name'        => 'Marketing',
                'slug'        => 'marketing',
                'description' => 'Growth, SEO, Content Marketing, Ads',
                'tenant_id'   => 1,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'name'        => 'Startups',
                'slug'        => 'startups',
                'description' => 'Startup news, Funding, Product launches',
                'tenant_id'   => 1,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'name'        => 'Tech News',
                'slug'        => 'tech-news',
                'description' => 'Technology industry news, Tech news',
                'tenant_id'   => 1,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'name'        => 'Developer Tools',
                'slug'        => 'dev-tools',
                'description' => 'Programming tools, Frameworks, Libraries',
                'tenant_id'   => 1,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'name'        => 'Design',
                'slug'        => 'design',
                'description' => 'UI/UX, Product Design, Design Systems',
                'tenant_id'   => 1,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'name'        => 'SaaS',
                'slug'        => 'saas',
                'description' => 'SaaS products, B2B software',
                'tenant_id'   => 1,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'name'        => 'Indie Hacking',
                'slug'        => 'indie-hacking',
                'description' => 'Solo founders, Bootstrapping, Side projects',
                'tenant_id'   => 1,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'name'        => 'Productivity',
                'slug'        => 'productivity',
                'description' => 'Productivity tools, Time management, Workflows',
                'tenant_id'   => 1,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
        ];

        // Upsert by slug: update name/description if slug exists, insert if new.
        // created_at is intentionally excluded from the update list.
        DB::table('categories')->upsert(
            $rows,
            ['slug'],
            ['name', 'description', 'updated_at']
        );

        $this->command->info('CategorySeeder: upserted '.count($rows).' categories (no data deleted).');
    }
}
