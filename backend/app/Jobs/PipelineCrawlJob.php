<?php

namespace App\Jobs;

use App\Models\Digest;
use App\Models\Signal;
use App\Models\Source;
use App\Models\Tweet;
use App\Services\DraftTweetService;
use App\Services\SignalRankingService;
use App\Services\SignalSummarizerService;
use App\Services\TweetClassifierService;
use App\Services\TweetClusterService;
use App\Services\TwitterCrawlerService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Flow 3: Crawl → Classify → Cluster → Summarize → persist {@see Signal} + `signal_sources`.
 *
 * MOCK_LLM=true hoặc tests bind mock → không tốn Anthropic credits.
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
        TweetClusterService $clusterService,
        SignalSummarizerService $summarizerService,
        SignalRankingService $signalRankingService,
        DraftTweetService $draftTweetService
    ): ?array {
        $start = microtime(true);

        Log::channel('crawler')->info('=== PipelineCrawlJob started ===', [
            'tweets_per_source' => $this->tweetsPerSource,
        ]);

        $sources = Source::query()
            ->forCrawl()
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

        $classifyStats = $classifier->classifyPendingTweets();

        $clusterResult = $clusterService->clusterRecentSignals();

        Log::channel('crawler')->info('PipelineCrawlJob cluster step', [
            'cluster_count' => count($clusterResult['clusters']),
            'unclustered_count' => count($clusterResult['unclustered']),
        ]);

        if (! empty($clusterResult['unclustered'])) {
            Log::channel('crawler')->info('Unclustered tweets skipped (no signal rows)', [
                'count' => count($clusterResult['unclustered']),
                'tweet_ids' => $clusterResult['unclustered'],
                'reason' => 'min_cluster_size=2 — single tweets not summarized',
            ]);
        }

        $lookbackHours = (int) config('signalfeed.cluster_lookback_hours', 24);

        $signalTweetsQuery = Tweet::query()->where('is_signal', true);
        if ($lookbackHours > 0) {
            $signalTweetsQuery->where('created_at', '>=', now()->subHours($lookbackHours));
        }

        /** @var Collection<int, Tweet> $signalTweets */
        $signalTweets = $signalTweetsQuery->get();

        if ($signalTweets->isEmpty()) {
            Log::channel('crawler')->info('PipelineCrawlJob: no signal tweets in lookback — skipping summarize/persist', [
                'lookback_hours' => $lookbackHours,
            ]);
            $this->logFinished($start, $classifyStats, $clusterResult, null, 0, 0);

            return null;
        }

        if (empty($clusterResult['clusters'])) {
            Log::channel('crawler')->info('PipelineCrawlJob: no clusters formed — skipping signal creation');

            $this->logFinished($start, $classifyStats, $clusterResult, null, 0, 0);

            return null;
        }

        $digest = $this->getOrCreateDigest();

        $signalsCreated = 0;
        $signalsFailed = 0;

        foreach ($clusterResult['clusters'] as $cluster) {
            DB::beginTransaction();

            try {
                $summary = $summarizerService->summarizeCluster($cluster, $signalTweets);

                if ($summary === null) {
                    DB::rollBack();
                    Log::channel('crawler')->warning('PipelineCrawlJob: summarize returned null', [
                        'cluster_id' => $cluster['cluster_id'] ?? 'unknown',
                    ]);

                    continue;
                }

                $fromTopicTags = $summary['categories'] ?? [];
                $fromSources = $this->extractCategories($summary['tweet_ids']);
                $categories = array_values(array_unique(array_merge($fromTopicTags, $fromSources)));
                sort($categories);

                $persistClusterId = $this->persistableClusterId((int) $digest->id, $summary['tweet_ids']);

                $signalId = $this->insertSignalRow($digest->id, $persistClusterId, $summary, $categories);

                $this->linkSignalSources($signalId, $summary['tweet_ids']);

                DB::commit();
                $signalsCreated++;

                Log::channel('crawler')->info('Signal created', [
                    'signal_id' => $signalId,
                    'cluster_id' => $persistClusterId,
                    'llm_cluster_id' => $summary['cluster_id'],
                    'title' => $summary['title'],
                    'source_count' => $summary['source_count'],
                ]);
            } catch (QueryException $e) {
                DB::rollBack();

                if ($this->isPostgresUniqueViolation($e)) {
                    Log::channel('crawler')->warning('Duplicate signal skipped (idempotent re-run)', [
                        'cluster_id' => $cluster['cluster_id'] ?? 'unknown',
                        'digest_id' => $digest->id,
                        'message' => $e->getMessage(),
                    ]);

                    continue;
                }

                $signalsFailed++;
                Log::channel('crawler-errors')->error('PipelineCrawlJob: signal DB error', [
                    'cluster_id' => $cluster['cluster_id'] ?? 'unknown',
                    'error' => $e->getMessage(),
                ]);
            } catch (\Throwable $e) {
                DB::rollBack();
                $signalsFailed++;
                Log::channel('crawler-errors')->error('PipelineCrawlJob: signal creation failed', [
                    'cluster_id' => $cluster['cluster_id'] ?? 'unknown',
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $digest->update([
            'total_signals' => Signal::query()->where('digest_id', $digest->id)->count(),
        ]);

        $rankedCount = 0;
        $rankErrors = 0;
        $draftCount = 0;
        $draftErrors = 0;

        /** @var Collection<int, Signal> $digestSignals */
        $digestSignals = Signal::query()
            ->where('digest_id', $digest->id)
            ->orderBy('id')
            ->get();

        Log::channel('crawler')->info('=== Step 5: Ranking signals ===', [
            'digest_id' => $digest->id,
            'signal_count' => $digestSignals->count(),
        ]);

        foreach ($digestSignals as $signal) {
            try {
                $signalRankingService->calculateRankScore($signal);
                $signal->refresh();
                $rankedCount++;
                Log::channel('crawler')->info('Signal ranked', [
                    'signal_id' => $signal->id,
                    'rank_score' => $signal->rank_score,
                ]);
            } catch (\Throwable $e) {
                $rankErrors++;
                Log::channel('crawler-errors')->error('Ranking failed for signal', [
                    'signal_id' => $signal->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        Log::channel('crawler')->info('Ranking complete', [
            'succeeded' => $rankedCount,
            'failed' => $rankErrors,
        ]);

        $digestSignals = Signal::query()
            ->where('digest_id', $digest->id)
            ->orderBy('id')
            ->get();

        Log::channel('crawler')->info('=== Step 6: Generating draft tweets ===', [
            'digest_id' => $digest->id,
            'signal_count' => $digestSignals->count(),
        ]);

        foreach ($digestSignals as $signal) {
            try {
                $draftText = $draftTweetService->generateDraft($signal);
                $draftCount++;
                $preview = mb_substr((string) $draftText, 0, 50);
                Log::channel('crawler')->info('Draft step completed for signal', [
                    'signal_id' => $signal->id,
                    'text_preview' => $preview !== '' ? $preview.'…' : null,
                ]);
            } catch (\Throwable $e) {
                $draftErrors++;
                Log::channel('crawler-errors')->error('Draft generation failed for signal', [
                    'signal_id' => $signal->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        Log::channel('crawler')->info('Draft generation complete', [
            'succeeded' => $draftCount,
            'failed' => $draftErrors,
        ]);

        Log::channel('crawler')->info('=== Pipeline complete ===', [
            'signals_ranked' => $rankedCount,
            'drafts_generated' => $draftCount,
            'rank_errors' => $rankErrors,
            'draft_errors' => $draftErrors,
        ]);

        $this->logFinished(
            $start,
            $classifyStats,
            $clusterResult,
            $digest,
            $signalsCreated,
            $signalsFailed,
            $rankedCount,
            $rankErrors,
            $draftCount,
            $draftErrors
        );

        return [
            'signals_ranked' => $rankedCount,
            'drafts_generated' => $draftCount,
            'rank_errors' => $rankErrors,
            'draft_errors' => $draftErrors,
        ];
    }

    /**
     * @param  array<string, mixed>  $classifyStats
     * @param  array{clusters: list<mixed>, unclustered: list<int>}  $clusterResult
     */
    private function logFinished(
        float $start,
        array $classifyStats,
        array $clusterResult,
        ?Digest $digest,
        int $signalsCreated,
        int $signalsFailed,
        int $signalsRanked = 0,
        int $rankErrors = 0,
        int $draftsGenerated = 0,
        int $draftErrors = 0
    ): void {
        Log::channel('crawler')->info('=== PipelineCrawlJob finished ===', [
            'duration_seconds' => round(microtime(true) - $start, 2),
            'digest_id' => $digest?->id,
            'digest_date' => $digest?->date?->toDateString(),
            'classify_scanned' => $classifyStats['scanned'] ?? 0,
            'classify_ok' => $classifyStats['classified'] ?? 0,
            'classify_failed' => $classifyStats['failed'] ?? 0,
            'signals_classified' => $classifyStats['signals'] ?? 0,
            'cluster_count' => count($clusterResult['clusters']),
            'unclustered_count' => count($clusterResult['unclustered']),
            'signals_persisted' => $signalsCreated,
            'signals_persist_failed' => $signalsFailed,
            'signals_ranked' => $signalsRanked,
            'rank_errors' => $rankErrors,
            'drafts_generated' => $draftsGenerated,
            'draft_errors' => $draftErrors,
        ]);
    }

    private function getOrCreateDigest(): Digest
    {
        $tenantId = 1;

        $digest = Digest::query()->firstOrCreate(
            [
                'date' => now()->toDateString(),
                'tenant_id' => $tenantId,
            ],
            [
                'title' => 'Tech Signals - '.now()->format('M d, Y'),
                'total_signals' => 0,
            ]
        );

        Log::channel('crawler')->info('Digest resolved', [
            'digest_id' => $digest->id,
            'date' => $digest->date?->toDateString(),
            'was_recently_created' => $digest->wasRecentlyCreated,
        ]);

        return $digest;
    }

    /**
     * @param  list<int>  $tweetIds
     * @return list<int>
     */
    private function extractCategories(array $tweetIds): array
    {
        if ($tweetIds === []) {
            return [];
        }

        $sourceIds = Tweet::query()
            ->whereIn('id', $tweetIds)
            ->pluck('source_id')
            ->unique()
            ->values();

        if ($sourceIds->isEmpty()) {
            return [];
        }

        return DB::table('source_categories')
            ->whereIn('source_id', $sourceIds)
            ->pluck('category_id')
            ->unique()
            ->map(fn ($id): int => (int) $id)
            ->values()
            ->all();
    }

    /**
     * Stable id theo digest + tập tweet — tránh trùng khi pipeline chạy lại (cluster_id từ LLM đổi mỗi run).
     *
     * @param  list<int>  $tweetIds
     */
    private function persistableClusterId(int $digestId, array $tweetIds): string
    {
        $ids = array_map('intval', $tweetIds);
        sort($ids);
        $hash = hash('sha256', $digestId.'|'.implode(',', $ids));

        return 'c_'.substr($hash, 0, 60);
    }

    /**
     * @param  array{cluster_id: string, title: string, summary: string, topic_tags: list<string>, categories?: list<int>, source_count: int}  $summary
     */
    private function insertSignalRow(int $digestId, string $persistClusterId, array $summary, array $categories): int
    {
        $topicLiteral = $this->formatPgTextArray($summary['topic_tags']);
        $catLiteral = $this->formatPgIntArray($categories);

        return (int) DB::table('signals')->insertGetId([
            'digest_id' => $digestId,
            'cluster_id' => $persistClusterId,
            'title' => mb_substr($summary['title'], 0, 200),
            'summary' => $summary['summary'],
            'categories' => DB::raw($catLiteral),
            'topic_tags' => DB::raw($topicLiteral),
            'source_count' => $summary['source_count'],
            'rank_score' => 0,
            'impact_score' => 0,
            'tenant_id' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ], 'id');
    }

    /**
     * @param  list<string>  $tags
     */
    private function formatPgTextArray(array $tags): string
    {
        if ($tags === []) {
            return "'{}'::varchar(50)[]";
        }

        $parts = array_map(function (string $t): string {
            $escaped = str_replace(['\\', '"'], ['\\\\', '\"'], $t);

            return '"'.$escaped.'"';
        }, $tags);

        return "'{".implode(',', $parts)."}'::varchar(50)[]";
    }

    /**
     * @param  list<int>  $ids
     */
    private function formatPgIntArray(array $ids): string
    {
        if ($ids === []) {
            return "'{}'::integer[]";
        }

        return "'{".implode(',', array_map('intval', $ids))."}'::integer[]";
    }

    /**
     * @param  list<int>  $tweetIds
     */
    private function linkSignalSources(int $signalId, array $tweetIds): void
    {
        $tweets = Tweet::query()
            ->whereIn('id', $tweetIds)
            ->get(['id', 'source_id']);

        if ($tweets->isEmpty()) {
            return;
        }

        $now = now();
        $rows = [];

        foreach ($tweets as $tweet) {
            $rows[] = [
                'signal_id' => $signalId,
                'source_id' => $tweet->source_id,
                'tweet_id' => $tweet->id,
                'tenant_id' => 1,
                'created_at' => $now,
            ];
        }

        DB::table('signal_sources')->insert($rows);
    }

    private function isPostgresUniqueViolation(QueryException $e): bool
    {
        $sqlState = (string) ($e->errorInfo[0] ?? '');
        if ($sqlState === '23505') {
            return true;
        }

        return str_contains($e->getMessage(), '23505')
            || str_contains($e->getMessage(), 'duplicate key')
            || str_contains($e->getMessage(), 'idx_signals_cluster_digest');
    }

    public function failed(?\Throwable $exception = null): void
    {
        Log::channel('crawler-errors')->error('PipelineCrawlJob failed after max attempts', [
            'error' => $exception?->getMessage(),
        ]);
    }
}
