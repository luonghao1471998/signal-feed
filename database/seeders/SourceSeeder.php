<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Categories + KOL pool from CSV (SourcePoolSeeder requires categories to exist).
 */
class SourceSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            CategorySeeder::class,
            SourcePoolSeeder::class,
        ]);
    }
}
