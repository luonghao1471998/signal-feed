<?php

namespace App\Console\Commands;

use App\Services\SignalGeneratorService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Throwable;

class GenerateSignalsCommand extends Command
{
    protected $signature = 'signals:generate
                            {--date=today : Date to generate signals (YYYY-MM-DD or "today")}
                            {--dry-run : Run without storing to database}';

    protected $description = 'Generate signals from tweets using Claude API';

    public function __construct(
        private readonly SignalGeneratorService $signalGenerator
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $dateInput = (string) $this->option('date');
        $dryRun = (bool) $this->option('dry-run');

        try {
            $date = $dateInput === 'today' ? Carbon::today() : Carbon::parse($dateInput);
        } catch (Throwable) {
            $this->error("Invalid --date value: {$dateInput}");

            return self::FAILURE;
        }

        $this->info('Generating signals for '.$date->toDateString().($dryRun ? ' (DRY RUN)' : ''));
        $this->newLine();

        try {
            $result = $this->signalGenerator->analyzeAndGenerateSignals($date, $dryRun);

            $this->info("✓ Fetched {$result['total_tweets']} tweets");
            $this->info("✓ Processed {$result['batches']} batch(es)");
            $this->info("✓ Generated {$result['total_signals']} signals");

            if ($result['total_signals'] > 0 && isset($result['signals'])) {
                $avgImpact = collect($result['signals'])->avg('impact_score');
                $this->info('✓ Average impact score: '.round((float) $avgImpact, 2));

                $categories = [];
                foreach ($result['signals'] as $signal) {
                    if (! isset($signal['category_ids']) || ! is_array($signal['category_ids'])) {
                        continue;
                    }
                    foreach ($signal['category_ids'] as $catId) {
                        $categories[$catId] = ($categories[$catId] ?? 0) + 1;
                    }
                }

                $this->newLine();
                $this->info('Category Distribution:');
                foreach ($categories as $catId => $count) {
                    $this->line("  Category {$catId}: {$count} signals");
                }
            }

            $this->newLine();
            $this->info('✅ Signal generation completed successfully!');

            return self::SUCCESS;
        } catch (Throwable $e) {
            $this->error('❌ Signal generation failed: '.$e->getMessage());
            $this->error($e->getTraceAsString());

            return self::FAILURE;
        }
    }
}
