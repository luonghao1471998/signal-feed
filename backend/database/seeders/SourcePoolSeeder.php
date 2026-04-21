<?php

namespace Database\Seeders;

use App\Models\Source;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SourcePoolSeeder extends Seeder
{
    private const CSV_PATH = 'database/seeders/data/source_pool_v2.csv';

    private const TENANT_ID = 1;

    /** @var array<string, int> category name → id */
    private array $categoryMap = [];

    private int $insertedCount = 0;

    private int $updatedCount = 0;

    private int $skippedCount = 0;

    /** @var list<string> */
    private array $errors = [];

    /**
     * Safe to re-run: no tables are truncated.
     *
     * - Categories in the CSV that do not exist in the DB are auto-created.
     * - Sources are upserted by x_handle (insert new / update existing).
     * - source_categories are synced per-source (old links for the source are replaced
     *   with what the CSV says). Sources not in the CSV are left untouched.
     * - tweets, signal_sources, my_source_subscriptions are never touched.
     */
    public function run(): void
    {
        $this->command->info('Starting SourcePoolSeeder (safe upsert mode)...');

        if (! file_exists(base_path(self::CSV_PATH))) {
            $this->command->error('CSV file not found: '.self::CSV_PATH);

            return;
        }

        DB::beginTransaction();

        try {
            $this->loadCategoryMapping();
            $this->importFromCsv();

            DB::commit();
            $this->displaySummary();
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->command->error('SourcePoolSeeder failed: '.$e->getMessage());
            Log::error('SourcePoolSeeder failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }

    private function loadCategoryMapping(): void
    {
        $this->command->info('Loading category name → id map...');

        $categories = DB::table('categories')
            ->where('tenant_id', self::TENANT_ID)
            ->get(['id', 'name']);

        foreach ($categories as $category) {
            $this->categoryMap[$category->name] = (int) $category->id;
        }

        $this->command->info('Loaded '.count($this->categoryMap).' categories from DB.');
    }

    private function importFromCsv(): void
    {
        $this->command->info('Importing sources from CSV...');

        $csvPath = base_path(self::CSV_PATH);
        $handle  = fopen($csvPath, 'r');

        if ($handle === false) {
            throw new \RuntimeException('Cannot open CSV file');
        }

        try {
            $header = fgetcsv($handle);

            if ($header === false) {
                throw new \RuntimeException('CSV is empty or unreadable');
            }

            $this->validateCsvHeader($header);

            $rowNumber = 1;
            $now       = Carbon::now('UTC');

            while (($row = fgetcsv($handle)) !== false) {
                $rowNumber++;

                if ($row === [] || (count($row) === 1 && $row[0] === null)) {
                    continue;
                }

                if (count(array_filter($row, static fn ($cell) => $cell !== null && trim((string) $cell) !== '')) === 0) {
                    continue;
                }

                try {
                    $sourceData = $this->parseRow($row, $rowNumber);

                    if ($sourceData === null) {
                        continue;
                    }

                    $this->upsertSource($sourceData, $now);
                } catch (\Throwable $e) {
                    $this->skippedCount++;
                    $error          = "Row {$rowNumber}: {$e->getMessage()}";
                    $this->errors[] = $error;
                    $this->command->warn($error);
                    Log::warning('SourcePoolSeeder row error', [
                        'row'   => $rowNumber,
                        'data'  => $row,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        } finally {
            fclose($handle);
        }
    }

    /**
     * @param  array{x_handle: string, display_name: string, account_url: string, category_ids: list<int>}  $sourceData
     */
    private function upsertSource(array $sourceData, Carbon $now): void
    {
        $existing = DB::table('sources')
            ->where('x_handle', $sourceData['x_handle'])
            ->where('tenant_id', self::TENANT_ID)
            ->first(['id']);

        if ($existing !== null) {
            // Update mutable fields only; preserve crawl state, x_user_id, added_by_user_id, etc.
            DB::table('sources')
                ->where('id', $existing->id)
                ->update([
                    'display_name' => $sourceData['display_name'],
                    'account_url'  => $sourceData['account_url'],
                    'updated_at'   => $now,
                ]);

            $sourceId = (int) $existing->id;
            $this->updatedCount++;
        } else {
            $sourceId = (int) DB::table('sources')->insertGetId([
                'type'            => 'default',
                'status'          => 'active',
                'x_handle'        => $sourceData['x_handle'],
                'x_user_id'       => null,
                'display_name'    => $sourceData['display_name'],
                'account_url'     => $sourceData['account_url'],
                'last_crawled_at' => null,
                'added_by_user_id' => null,
                'tenant_id'       => self::TENANT_ID,
                'created_at'      => $now,
                'updated_at'      => $now,
            ]);

            $this->insertedCount++;
        }

        $this->syncSourceCategories($sourceId, $sourceData['category_ids'], $now);
    }

    /**
     * Replace the category links for a single source with the given set.
     * Other sources' links are never touched.
     *
     * @param  list<int>  $categoryIds
     */
    private function syncSourceCategories(int $sourceId, array $categoryIds, Carbon $now): void
    {
        DB::table('source_categories')->where('source_id', $sourceId)->delete();

        $rows = array_map(static fn (int $catId) => [
            'source_id'   => $sourceId,
            'category_id' => $catId,
            'tenant_id'   => self::TENANT_ID,
            'created_at'  => $now,
        ], $categoryIds);

        if ($rows !== []) {
            DB::table('source_categories')->insert($rows);
        }
    }

    /**
     * Resolve category names to IDs. Names not yet in the DB are created on-the-fly.
     *
     * @param  list<string>  $categoryNames
     * @return list<int>
     */
    private function resolveCategoryIds(array $categoryNames, Carbon $now): array
    {
        $ids = [];

        foreach ($categoryNames as $name) {
            if (isset($this->categoryMap[$name])) {
                $ids[] = $this->categoryMap[$name];
                continue;
            }

            // Auto-create the category so CSV is always the source of truth for names.
            $slug = Str::slug($name);
            $id   = (int) DB::table('categories')->insertGetId([
                'name'       => $name,
                'slug'       => $slug,
                'description' => '',
                'tenant_id'  => self::TENANT_ID,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $this->categoryMap[$name] = $id;
            $ids[]                    = $id;

            $this->command->warn("Auto-created category: \"{$name}\" (slug: {$slug}, id: {$id})");
            Log::info('SourcePoolSeeder auto-created category', ['name' => $name, 'slug' => $slug, 'id' => $id]);
        }

        return array_values(array_unique($ids));
    }

    /**
     * @param  list<string|null>|array<int, string|null>  $header
     */
    private function validateCsvHeader(array $header): void
    {
        $expected   = ['handle', 'display_name', 'account_url', 'categories'];
        $normalized = array_map(static fn ($cell) => trim((string) $cell), $header);

        if ($normalized !== $expected) {
            throw new \RuntimeException(
                'Invalid CSV header. Expected: '.implode(',', $expected)
                .' Got: '.implode(',', $normalized)
            );
        }
    }

    /**
     * @param  list<string>|array<int, string|null>  $row
     * @return array{x_handle: string, display_name: string, account_url: string, category_ids: list<int>}|null
     */
    private function parseRow(array $row, int $rowNumber): ?array
    {
        if (count($row) < 4) {
            $this->skippedCount++;
            $this->errors[] = "Row {$rowNumber}: Expected 4 columns, got ".count($row);

            return null;
        }

        $handle       = trim((string) $row[0]);
        $displayName  = trim((string) $row[1]);
        $accountUrl   = trim((string) $row[2]);
        $categoriesStr = trim((string) $row[3]);

        if ($handle === '' || $displayName === '' || $accountUrl === '') {
            $this->skippedCount++;
            $this->errors[] = "Row {$rowNumber}: Missing required fields";

            return null;
        }

        $categoryNames = array_values(array_filter(
            array_map('trim', explode('|', $categoriesStr)),
            static fn (string $name) => $name !== ''
        ));

        if ($categoryNames === []) {
            $this->skippedCount++;
            $this->errors[] = "Row {$rowNumber}: No categories specified";

            return null;
        }

        $now         = Carbon::now('UTC');
        $categoryIds = $this->resolveCategoryIds($categoryNames, $now);

        return [
            'x_handle'     => $handle,
            'display_name' => $displayName,
            'account_url'  => $accountUrl,
            'category_ids' => $categoryIds,
        ];
    }

    private function displaySummary(): void
    {
        $this->command->newLine();
        $this->command->info('--- SourcePoolSeeder summary ---');
        $this->command->info("Inserted (new sources): {$this->insertedCount}");
        $this->command->info("Updated (existing sources): {$this->updatedCount}");

        if ($this->skippedCount > 0) {
            $this->command->warn("Skipped (row-level errors): {$this->skippedCount}");
        }

        if ($this->errors !== []) {
            $slice = array_slice($this->errors, 0, 5);

            foreach ($slice as $error) {
                $this->command->warn("  - {$error}");
            }

            $remaining = count($this->errors) - count($slice);

            if ($remaining > 0) {
                $this->command->warn("  - ... and {$remaining} more");
            }
        }

        $this->command->info('--------------------------------');
        $this->command->newLine();
    }
}
