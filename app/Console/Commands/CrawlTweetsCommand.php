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
        $limit = (int) $this->option('limit');
        if ($limit < 1 || $limit > 100) {
            $this->error('--limit must be between 1 and 100.');

            return self::FAILURE;
        }

        $handleFilter = $this->option('source');
        $query = Source::query()
            ->where('status', 'active');

        if ($handleFilter !== null && $handleFilter !== '') {
            $normalizedHandle = ltrim(trim((string) $handleFilter), '@');
            $query->where('x_handle', $normalizedHandle);
        }

        /** @var Collection<int, Source> $sources */
        $sources = $query->orderBy('id')->get();

        if ($sources->isEmpty()) {
            $this->warn('No matching active sources to crawl.');

            return self::FAILURE;
        }

        $this->info(sprintf('Starting crawl for %d source(s)...', $sources->count()));

        $successCount = 0;
        $failedCount = 0;
        $totalTweets = 0;
        /** @var list<string> $failedSummaries */
        $failedSummaries = [];

        $progressBar = $this->output->createProgressBar($sources->count());
        $progressBar->start();

        foreach ($sources as $index => $source) {
            $progressBar->clear();
            $this->line(sprintf('Crawling @%s...', $source->x_handle));

            try {
                $result = $this->twitterCrawler->crawlSource($source, $limit);

                if ($result['success']) {
                    $successCount++;
                    $totalTweets += $result['tweets_count'];
                    $this->info(sprintf('✓ @%s: %d tweets', $source->x_handle, $result['tweets_count']));
                } else {
                    $failedCount++;
                    $failedSummaries[] = sprintf('@%s: %s', $source->x_handle, $result['message']);
                    $this->warn(sprintf('✗ @%s: %s', $source->x_handle, $result['message']));
                    Log::warning('tweets:crawl source failed', [
                        'handle' => $source->x_handle,
                        'message' => $result['message'],
                    ]);
                }
            } catch (\Throwable $e) {
                $failedCount++;
                $failedSummaries[] = sprintf('@%s: %s', $source->x_handle, $e->getMessage());
                $this->warn(sprintf('✗ @%s: %s', $source->x_handle, $e->getMessage()));
                Log::error('tweets:crawl unexpected exception', [
                    'handle' => $source->x_handle,
                    'message' => $e->getMessage(),
                ]);
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

        $this->info('=== Crawl Summary ===');
        $this->info(sprintf('Total sources: %d', $sources->count()));
        $this->info(sprintf('Successful: %d', $successCount));
        $this->info(sprintf('Failed: %d', $failedCount));
        $this->info(sprintf('Total tweets fetched: %d', $totalTweets));

        if ($failedSummaries !== []) {
            $this->newLine();
            $this->warn('Failed sources:');
            foreach ($failedSummaries as $line) {
                $this->line('  - '.$line);
            }
        }

        return $failedCount > 0 && $successCount === 0 ? self::FAILURE : self::SUCCESS;
    }
}
