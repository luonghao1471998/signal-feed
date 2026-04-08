<?php

namespace App\Jobs;

use App\Integrations\LLMClient;
use App\Models\Signal;
use App\Models\Source;
use App\Models\Tweet;
use App\Services\FakeLLMClient;
use App\Services\TwitterCrawlerService;
use Illuminate\Bus\Queueable;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Task 1.7.2 — Crawl active sources, then classify tweets touched in this run.
 *
 * MOCK_LLM=true hoặc tests bind mock → không tốn Anthropic credits.
 * Không tạo {@see Signal} ở bước này (SPEC: digest_id, title, summary — Task 1.8.x).
 */
class PipelineCrawlJob
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public int $tweetsPerSource = 10
    ) {
        $this->tweetsPerSource = max(1, min(100, $this->tweetsPerSource));
    }

    public function handle(TwitterCrawlerService $crawler): void
    {
        $llm = $this->resolveClassifier();

        Log::channel('crawler')->info('PipelineCrawlJob started', [
            'tweets_per_source' => $this->tweetsPerSource,
            'classifier' => get_class($llm),
        ]);

        /** @var list<int> $allAffectedIds */
        $allAffectedIds = [];

        $sources = Source::query()
            ->where('status', 'active')
            ->orderBy('id')
            ->get();

        foreach ($sources as $index => $source) {
            $result = $crawler->crawlSource($source, $this->tweetsPerSource);

            if ($result['success'] && ($result['affected_tweet_ids'] ?? []) !== []) {
                /** @var list<int> $ids */
                $ids = $result['affected_tweet_ids'];
                $allAffectedIds = array_merge($allAffectedIds, $ids);
            }

            $isLast = $index === $sources->count() - 1;
            if (! $isLast) {
                sleep(3);
            }
        }

        $allAffectedIds = array_values(array_unique($allAffectedIds));
        $total = count($allAffectedIds);

        $ok = 0;
        $failed = 0;

        foreach ($allAffectedIds as $position => $tweetPk) {
            $tweet = Tweet::query()->find($tweetPk);
            if ($tweet === null) {
                continue;
            }

            try {
                $classify = $llm->classify($tweet->text);
                $tweet->update([
                    'signal_score' => $classify['signal_score'],
                    'is_signal' => $classify['is_signal'],
                ]);
                $ok++;
            } catch (\Throwable $e) {
                $failed++;
                Log::channel('crawler-errors')->error('PipelineCrawlJob classify failed', [
                    'tweet_id' => $tweet->id,
                    'vendor_tweet_id' => $tweet->tweet_id,
                    'error' => $e->getMessage(),
                ]);
            }

            $n = $position + 1;
            if ($total > 0 && $n % 50 === 0) {
                Log::channel('crawler')->info("Classified {$n}/{$total} tweets");
            }
        }

        Log::channel('crawler')->info('PipelineCrawlJob finished', [
            'sources' => $sources->count(),
            'tweets_classified_ok' => $ok,
            'tweets_classify_failed' => $failed,
            'tweets_in_classify_batch' => $total,
        ]);
    }

    /**
     * Ưu tiên LLMClient đã bind (mock trong test); sau đó MOCK_LLM → FakeLLMClient; cuối cùng Anthropic.
     */
    private function resolveClassifier(): FakeLLMClient|LLMClient
    {
        if (config('app.mock_llm') === true) {
            return app(FakeLLMClient::class);
        }

        return app(LLMClient::class);
    }
}
