<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Source;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class SourcePoolSeeder extends Seeder
{
    private const CSV_PATH = 'database/seeders/data/source_pool.csv';

    private const TENANT_ID = 1;

    /** @var array<string, int> */
    private array $categoryMap = [];

    private int $successCount = 0;

    private int $skippedCount = 0;

    /** @var list<string> */
    private array $errors = [];

    public function run(): void
    {
        $this->command->info('Starting SourcePoolSeeder...');

        if (! file_exists(base_path(self::CSV_PATH))) {
            $this->command->error('CSV file not found: '.self::CSV_PATH);

            return;
        }

        DB::beginTransaction();

        try {
            $this->truncateSourceRelatedTables();
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

    private function truncateSourceRelatedTables(): void
    {
        $this->command->info('Clearing sources and dependent rows...');

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                'TRUNCATE TABLE signal_sources, tweets, my_source_subscriptions, source_categories, sources RESTART IDENTITY CASCADE'
            );

            $this->command->info('Tables truncated (PostgreSQL).');

            return;
        }

        foreach (['signal_sources', 'tweets', 'my_source_subscriptions', 'source_categories', 'sources'] as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->delete();
            }
        }

        $this->command->info('Source-related tables cleared.');
    }

    private function loadCategoryMapping(): void
    {
        $this->command->info('Loading category name -> id map...');

        $categories = Category::query()
            ->where('tenant_id', self::TENANT_ID)
            ->get(['id', 'name']);

        foreach ($categories as $category) {
            $this->categoryMap[$category->name] = (int) $category->id;
        }

        $this->command->info('Loaded '.$categories->count().' categories.');
    }

    private function importFromCsv(): void
    {
        $this->command->info('Importing sources from CSV...');

        $csvPath = base_path(self::CSV_PATH);
        $handle = fopen($csvPath, 'r');

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
            $now = Carbon::now('UTC');

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

                    $source = Source::create([
                        'type' => 'default',
                        'status' => 'active',
                        'x_handle' => $sourceData['x_handle'],
                        'x_user_id' => null,
                        'display_name' => $sourceData['display_name'],
                        'account_url' => $sourceData['account_url'],
                        'last_crawled_at' => null,
                        'added_by_user_id' => null,
                        'tenant_id' => self::TENANT_ID,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);

                    foreach ($sourceData['category_ids'] as $categoryId) {
                        DB::table('source_categories')->insert([
                            'source_id' => $source->id,
                            'category_id' => $categoryId,
                            'tenant_id' => self::TENANT_ID,
                            'created_at' => $now,
                        ]);
                    }

                    $this->successCount++;

                    if ($this->successCount % 10 === 0) {
                        $this->command->info("Imported {$this->successCount} sources...");
                    }
                } catch (\Throwable $e) {
                    $this->skippedCount++;
                    $error = "Row {$rowNumber}: {$e->getMessage()}";
                    $this->errors[] = $error;
                    $this->command->warn($error);
                    Log::warning('SourcePoolSeeder row error', [
                        'row' => $rowNumber,
                        'data' => $row,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        } finally {
            fclose($handle);
        }
    }

    /**
     * @param  list<string|null>|array<int, string|null>  $header
     */
    private function validateCsvHeader(array $header): void
    {
        $expected = ['handle', 'display_name', 'account_url', 'categories'];
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

        $handle = trim((string) $row[0]);
        $displayName = trim((string) $row[1]);
        $accountUrl = trim((string) $row[2]);
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

        $categoryIds = [];
        $missingCategories = [];

        foreach ($categoryNames as $categoryName) {
            if (isset($this->categoryMap[$categoryName])) {
                $categoryIds[] = $this->categoryMap[$categoryName];
            } else {
                $missingCategories[] = $categoryName;
            }
        }

        $categoryIds = array_values(array_unique($categoryIds));

        if ($missingCategories !== []) {
            $this->command->warn(
                "Row {$rowNumber} ({$handle}): categories not found: "
                .implode(', ', $missingCategories)
            );
            Log::warning('SourcePoolSeeder missing categories', [
                'row' => $rowNumber,
                'handle' => $handle,
                'missing' => $missingCategories,
            ]);
        }

        if ($categoryIds === []) {
            $this->skippedCount++;
            $this->errors[] = "Row {$rowNumber}: No valid categories found";

            return null;
        }

        return [
            'x_handle' => $handle,
            'display_name' => $displayName,
            'account_url' => $accountUrl,
            'category_ids' => $categoryIds,
        ];
    }

    private function displaySummary(): void
    {
        $this->command->newLine();
        $this->command->info('--- SourcePoolSeeder summary ---');
        $this->command->info("Successfully imported: {$this->successCount} sources");

        if ($this->skippedCount > 0) {
            $this->command->warn("Skipped (row-level): {$this->skippedCount}");
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
