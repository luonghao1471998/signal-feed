<?php

namespace App\Jobs;

use App\Models\Signal;
use App\Models\Source;
use App\Services\TweetClassifierService;
use App\Services\TweetClusterService;
use App\Services\TwitterCrawlerService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Task 1.6.x crawl + 1.7.2 classify + 1.8.1 cluster (Flow 3 steps 1–3, in-memory clusters).
 *
 * MOCK_LLM=true hoặc tests bind mock → không tốn Anthropic credits.
 * Không tạo {@see Signal} ở bước này (Task 1.8.x).
 */
class PipelineCrawlJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $timeout = 600;

    public function __construct(
        public int $tweetsPerSource = 10
    ) {
        $this->tweetsPerSource = max(1, min(100, $this->tweetsPerSource));
    }

    public function handle(
        TwitterCrawlerService $crawler,
        TweetClassifierService $classifier,
        TweetClusterService $clusterService
    ): void {
        Log::channel('crawler')->info('PipelineCrawlJob started', [
            'tweets_per_source' => $this->tweetsPerSource,
            'classifier' => $classifier::class,
            'cluster' => $clusterService::class,
        ]);

        $sources = Source::query()
            ->where('status', 'active')
            ->orderBy('id')
            ->get();

        foreach ($sources as $index => $source) {
            $result = $crawler->crawlSource($source, $this->tweetsPerSource);

            if (! ($result['success'] ?? false)) {
                Log::channel('crawler')->warning('PipelineCrawlJob crawl source failed', [
                    'source_id' => $source->id,
                    'x_handle' => $source->x_handle,
                    'message' => $result['message'] ?? 'unknown',
                ]);
            }

            $isLast = $index === $sources->count() - 1;
            if (! $isLast) {
                sleep(3);
            }
        }

        $stats = $classifier->classifyPendingTweets();

        $clusterResult = $clusterService->clusterRecentSignals();

        Log::channel('crawler')->info('PipelineCrawlJob finished', [
            'sources' => $sources->count(),
            'classify_scanned' => $stats['scanned'],
            'classify_ok' => $stats['classified'],
            'classify_failed' => $stats['failed'],
            'signals' => $stats['signals'],
            'cluster_count' => count($clusterResult['clusters']),
            'unclustered_count' => count($clusterResult['unclustered']),
        ]);
    }

    public function failed(?\Throwable $exception = null): void
    {
        Log::channel('crawler-errors')->error('PipelineCrawlJob failed after max attempts', [
            'error' => $exception?->getMessage(),
        ]);
    }
}
