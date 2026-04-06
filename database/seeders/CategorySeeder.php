<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'AI & ML', 'slug' => 'ai-ml', 'description' => 'Artificial Intelligence, Machine Learning, LLMs'],
            ['name' => 'Crypto & Web3', 'slug' => 'crypto-web3', 'description' => 'Cryptocurrency, Blockchain, DeFi, NFT'],
            ['name' => 'Marketing', 'slug' => 'marketing', 'description' => 'Growth, SEO, Content Marketing, Ads'],
            ['name' => 'Startups', 'slug' => 'startups', 'description' => 'Startup news, Funding, Product launches'],
            ['name' => 'Tech News', 'slug' => 'tech-news', 'description' => 'Technology industry news, Product releases'],
            ['name' => 'Developer Tools', 'slug' => 'dev-tools', 'description' => 'Programming tools, Frameworks, Libraries'],
            ['name' => 'Design', 'slug' => 'design', 'description' => 'UI/UX, Product Design, Design Systems'],
            ['name' => 'SaaS', 'slug' => 'saas', 'description' => 'SaaS products, B2B software'],
            ['name' => 'Indie Hacking', 'slug' => 'indie-hacking', 'description' => 'Solo founders, Bootstrapping, Side projects'],
            ['name' => 'Productivity', 'slug' => 'productivity', 'description' => 'Productivity tools, Time management, Workflows'],
        ];

        foreach ($categories as $category) {
            DB::table('categories')->insert([
                'name' => $category['name'],
                'slug' => $category['slug'],
                'description' => $category['description'],
                'tenant_id' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}