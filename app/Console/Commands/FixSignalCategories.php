<?php

namespace App\Console\Commands;

use App\Models\Signal;
use App\Services\CategoryAssignerService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FixSignalCategories extends Command
{
    protected $signature = 'signals:fix-categories {--recalculate : Gán lại categories từ topic_tags cho mọi signal (ghi đè)}';

    protected $description = 'Gán categories cho signals đang rỗng dựa trên topic_tags';

    public function handle(CategoryAssignerService $assigner): int
    {
        $signals = $this->option('recalculate')
            ? Signal::query()->orderBy('id')->get()
            : Signal::query()
                ->whereRaw('coalesce(cardinality(categories), 0) = 0')
                ->orderBy('id')
                ->get();

        $this->info("Found {$signals->count()} signals to process");

        $updated = 0;

        foreach ($signals as $signal) {
            /** @var list<string> $tags */
            $tags = $signal->topic_tags ?? [];
            $categories = $assigner->assignCategories($tags);

            if ($categories === []) {
                continue;
            }

            $literal = '{'.implode(',', array_map('intval', $categories)).'}';

            DB::table('signals')
                ->where('id', $signal->id)
                ->update([
                    'categories' => DB::raw("'{$literal}'::integer[]"),
                    'updated_at' => now(),
                ]);

            $updated++;
            $this->line("Signal #{$signal->id}: {$signal->title}");
            $this->line('  Tags: '.implode(', ', $tags));
            $this->line('  Categories: '.implode(', ', $categories));
        }

        $this->info("Updated {$updated} signals");

        return self::SUCCESS;
    }
}
