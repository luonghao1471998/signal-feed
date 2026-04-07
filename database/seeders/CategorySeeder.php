<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CategorySeeder extends Seeder
{
    /**
     * Seed canonical categories (tenant_id = 1). Safe to re-run: clears categories
     * and dependent source_categories (PostgreSQL TRUNCATE … CASCADE + RESTART IDENTITY).
     */
    public function run(): void
    {
        $now = Carbon::now('UTC');

        if (DB::getDriverName() === 'pgsql') {
            // FK from source_categories → categories; CASCADE empties junction then categories; ids reset 1..n
            DB::statement('TRUNCATE TABLE source_categories, categories RESTART IDENTITY CASCADE');
        } else {
            DB::table('source_categories')->delete();
            DB::table('categories')->delete();
        }

        $rows = [
            [
                'name' => 'AI & ML',
                'slug' => 'ai-ml',
                'description' => 'Artificial Intelligence, Machine Learning, LLMs',
                'tenant_id' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Crypto & Web3',
                'slug' => 'crypto-web3',
                'description' => 'Cryptocurrency, Blockchain, DeFi, NFT',
                'tenant_id' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Marketing',
                'slug' => 'marketing',
                'description' => 'Growth, SEO, Content Marketing, Ads',
                'tenant_id' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Startups',
                'slug' => 'startups',
                'description' => 'Startup news, Funding, Product launches',
                'tenant_id' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Tech News',
                'slug' => 'tech-news',
                'description' => 'Technology industry news, Product releases',
                'tenant_id' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Developer Tools',
                'slug' => 'dev-tools',
                'description' => 'Programming tools, Frameworks, Libraries',
                'tenant_id' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Design',
                'slug' => 'design',
                'description' => 'UI/UX, Product Design, Design Systems',
                'tenant_id' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'SaaS',
                'slug' => 'saas',
                'description' => 'SaaS products, B2B software',
                'tenant_id' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Indie Hacking',
                'slug' => 'indie-hacking',
                'description' => 'Solo founders, Bootstrapping, Side projects',
                'tenant_id' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Productivity',
                'slug' => 'productivity',
                'description' => 'Productivity tools, Time management, Workflows',
                'tenant_id' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        DB::table('categories')->insert($rows);
    }
}
