<?php

namespace App\Console\Commands;

use App\Models\Source;
use App\Services\TwitterCrawlerService;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Log;

class CrawlTweetsCommand extends Command
{
    protected $signature = 'tweets:crawl
                            {--source= : Specific source handle to crawl (e.g. karpathy)}
                            {--limit=10 : Max tweets per source (default 10, max 100)}
                            {--all : Crawl all sources (overrides --source)}';

    protected $description = 'Crawl tweets from Twitter sources using twitterapi.io';

    public function __construct(
        private readonly TwitterCrawlerService $twitterCrawler
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $startTime = microtime(true);

        $limit = (int) $this->option('limit');
        if ($limit < 1 || $limit > 100) {
            $this->error('--limit must be between 1 and 100.');
            Log::channel('crawler-errors')->error('tweets:crawl invalid --limit', ['limit' => $limit]);

            return self::FAILURE;
        }

        $handleFilter = $this->option('source');
        $query = Source::query()->forCrawl();

        if ($handleFilter !== null && $handleFilter !== '') {
            $normalizedHandle = ltrim(trim((string) $handleFilter), '@');
            $query->where('x_handle', $normalizedHandle);
        }

        /** @var Collection<int, Source> $sources */
        $sources = $query->orderBy('id')->get();

        if ($sources->isEmpty()) {
            $this->warn('No matching active sources to crawl.');
            Log::channel('crawler')->warning('tweets:crawl no active sources', [
                'source_filter' => $handleFilter,
            ]);

            return self::FAILURE;
        }

        $totalSources = $sources->count();

        Log::channel('crawler')->info('=== Crawl Session Started ===', [
            'started_at' => now()->toDateTimeString(),
            'total_sources' => $totalSources,
            'limit_per_source' => $limit,
        ]);

        $this->info(sprintf('Crawling %d Twitter source(s)...', $totalSources));

        $stats = [
            'total_sources' => $totalSources,
            'successful' => 0,
            'failed' => 0,
            'total_tweets' => 0,
            'new_tweets' => 0,
            'errors' => [],
        ];

        $progressBar = $this->output->createProgressBar($totalSources);
        $progressBar->start();

        foreach ($sources as $index => $source) {
            $progressBar->clear();
            $this->line(sprintf('Crawling @%s...', $source->x_handle));

            Log::channel('crawler')->debug('Crawling source', [
                'source_id' => $source->id,
                'x_handle' => $source->x_handle,
                'last_crawled_at' => $source->last_crawled_at?->toDateTimeString(),
            ]);

            try {
                $result = $this->twitterCrawler->crawlSource($source, $limit);

                if ($result['success']) {
                    $stats['successful']++;
                    $stats['total_tweets'] += $result['tweets_count'];
                    $newCount = (int) ($result['new_tweets_count'] ?? 0);
                    $stats['new_tweets'] += $newCount;

                    Log::channel('crawler')->info(sprintf('✓ @%s: %d new / %d total', $source->x_handle, $newCount, $result['tweets_count']), [
                        'source_id' => $source->id,
                        'new_tweets' => $newCount,
                        'total_tweets' => $result['tweets_count'],
                    ]);

                    $this->info(sprintf('✓ @%s: %d tweets (%d new)', $source->x_handle, $result['tweets_count'], $newCount));
                } else {
                    $stats['failed']++;
                    $stats['errors'][] = [
                        'source' => $source->x_handle,
                        'error' => $result['message'],
                    ];

                    Log::channel('crawler-errors')->error(sprintf('✗ Failed to crawl @%s', $source->x_handle), [
                        'source_id' => $source->id,
                        'error' => $result['message'],
                    ]);

                    Log::channel('crawler')->warning('tweets:crawl source returned failure', [
                        'handle' => $source->x_handle,
                        'message' => $result['message'],
                    ]);

                    $this->warn(sprintf('✗ @%s: %s', $source->x_handle, $result['message']));
                }
            } catch (\Throwable $e) {
                $stats['failed']++;
                $stats['errors'][] = [
                    'source' => $source->x_handle,
                    'error' => $e->getMessage(),
                ];

                Log::channel('crawler-errors')->error(sprintf('✗ Failed to crawl @%s', $source->x_handle), [
                    'source_id' => $source->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                $this->warn(sprintf('✗ @%s: %s', $source->x_handle, $e->getMessage()));
            }

            $progressBar->advance();
            $progressBar->display();

            $isLast = $index === $sources->count() - 1;
            if (! $isLast) {
                $this->line('Waiting 3s for rate limit...');
                sleep(3);
            }
        }

        $progressBar->finish();
        $this->newLine(2);

        $duration = round(microtime(true) - $startTime, 2);

        Log::channel('crawler')->info('=== Crawl Session Completed ===', [
            'duration_seconds' => $duration,
            'stats' => $stats,
            'completed_at' => now()->toDateTimeString(),
        ]);

        $this->info(sprintf('Crawl completed in %ss', $duration));
        $this->table(
            ['Metric', 'Value'],
            [
                ['Total Sources', $stats['total_sources']],
                ['Successful', $stats['successful']],
                ['Failed', $stats['failed']],
                ['Total Tweets Fetched', $stats['total_tweets']],
                ['New Tweets Saved', $stats['new_tweets']],
                ['Duration', "{$duration}s"],
            ]
        );

        if ($stats['failed'] > 0) {
            $this->warn('Some sources failed. Check storage/logs/crawler-errors.log');
        }

        return $stats['failed'] > 0 && $stats['successful'] === 0 ? self::FAILURE : self::SUCCESS;
    }
}
