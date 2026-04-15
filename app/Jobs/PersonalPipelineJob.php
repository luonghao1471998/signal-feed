<?php

namespace App\Jobs;

use App\Models\Digest;
use App\Models\MySourceSubscription;
use App\Models\Signal;
use App\Models\Tweet;
use App\Models\User;
use App\Services\DraftTweetService;
use App\Services\SignalRankingService;
use App\Services\SignalSummarizerService;
use App\Services\TweetClusterService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PersonalPipelineJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $timeout = 600;

    public int $tries = 1;

    public function __construct(
        private readonly int $userId
    ) {}

    public function handle(
        TweetClusterService $clusterService,
        SignalSummarizerService $summarizerService,
        SignalRankingService $signalRankingService,
        DraftTweetService $draftTweetService
    ): void {
        Log::channel('crawler')->info('PersonalPipelineJob started', [
            'user_id' => $this->userId,
        ]);

        $user = User::query()->find($this->userId);

        if ($user === null || $user->plan === 'free') {
            Log::channel('crawler')->info('PersonalPipelineJob skipped: free or missing user', [
                'user_id' => $this->userId,
                'plan' => $user?->plan ?? 'not_found',
            ]);

            return;
        }

        $sourceIds = MySourceSubscription::query()
            ->where('user_id', $user->id)
            ->pluck('source_id')
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($sourceIds === []) {
            Log::channel('crawler')->info('PersonalPipelineJob skipped: no subscriptions', [
                'user_id' => $user->id,
            ]);

            return;
        }

        /** @var Collection<int, Tweet> $tweets */
        $tweets = Tweet::query()
            ->whereIn('source_id', $sourceIds)
            ->where('is_signal', true)
            ->where('posted_at', '>=', now()->subDay())
            ->orderByDesc('posted_at')
            ->get();

        if ($tweets->isEmpty()) {
            Log::channel('crawler')->info('PersonalPipelineJob skipped: no signal tweets in lookback', [
                'user_id' => $user->id,
                'source_count' => count($sourceIds),
            ]);

            return;
        }

        $digest = $this->getOrCreateTodayDigest((int) ($user->tenant_id ?? 1));

        $clusterResult = $clusterService->clusterTweets($tweets);
        $clusters = $clusterResult['clusters'] ?? [];

        if ($clusters === []) {
            Log::channel('crawler')->info('PersonalPipelineJob: no clusters produced', [
                'user_id' => $user->id,
                'tweet_count' => $tweets->count(),
                'unclustered_count' => count($clusterResult['unclustered'] ?? []),
            ]);

            return;
        }

        $createdCount = 0;
        $clusterIndex = 1;

        foreach ($clusters as $cluster) {
            DB::beginTransaction();

            try {
                $clusterId = sprintf(
                    '%d_%s_cluster_%d',
                    $user->id,
                    now()->toDateString(),
                    $clusterIndex
                );

                $alreadyExists = Signal::query()
                    ->where('type', 1)
                    ->where('user_id', $user->id)
                    ->where('digest_id', $digest->id)
                    ->where('cluster_id', $clusterId)
                    ->exists();

                if ($alreadyExists) {
                    DB::rollBack();
                    Log::channel('crawler')->info('PersonalPipelineJob skip existing cluster (credit-safe)', [
                        'user_id' => $user->id,
                        'cluster_id' => $clusterId,
                    ]);
                    $clusterIndex++;

                    continue;
                }

                $summary = $summarizerService->summarizeCluster($cluster, $tweets);

                if ($summary === null) {
                    DB::rollBack();
                    $clusterIndex++;

                    continue;
                }

                $summary['cluster_id'] = $clusterId; // Override LLM cluster_id with user-specific format

                $signalId = $this->insertSignalRow(
                    userId: (int) $user->id,
                    digestId: (int) $digest->id,
                    tenantId: (int) ($user->tenant_id ?? 1),
                    clusterId: $clusterId,
                    summary: $summary
                );

                $this->linkSignalSources($signalId, $summary['tweet_ids']);

                DB::commit();
                $createdCount++;

                $signal = Signal::query()->find($signalId);
                if ($signal !== null) {
                    try {
                        $signalRankingService->calculateRankScore($signal);
                    } catch (\Throwable $e) {
                        Log::channel('crawler-errors')->error('PersonalPipelineJob rank failed', [
                            'user_id' => $user->id,
                            'signal_id' => $signalId,
                            'error' => $e->getMessage(),
                        ]);
                    }

                    try {
                        $draftTweetService->generateDraft($signal);
                    } catch (\Throwable $e) {
                        Log::channel('crawler-errors')->error('PersonalPipelineJob draft failed', [
                            'user_id' => $user->id,
                            'signal_id' => $signalId,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            } catch (QueryException $e) {
                DB::rollBack();

                if ($this->isPostgresUniqueViolation($e)) {
                    Log::channel('crawler')->warning('PersonalPipelineJob duplicate skipped (idempotent)', [
                        'user_id' => $user->id,
                        'cluster_index' => $clusterIndex,
                    ]);
                    $clusterIndex++;

                    continue;
                }

                Log::channel('crawler-errors')->error('PersonalPipelineJob DB error', [
                    'user_id' => $user->id,
                    'cluster_index' => $clusterIndex,
                    'error' => $e->getMessage(),
                ]);
            } catch (\Throwable $e) {
                DB::rollBack();
                Log::channel('crawler-errors')->error('PersonalPipelineJob cluster processing failed', [
                    'user_id' => $user->id,
                    'cluster_index' => $clusterIndex,
                    'error' => $e->getMessage(),
                ]);
            }

            $clusterIndex++;
        }

        Log::channel('crawler')->info('PersonalPipelineJob completed', [
            'user_id' => $user->id,
            'digest_id' => $digest->id,
            'signals_created' => $createdCount,
            'clusters_processed' => count($clusters),
        ]);
    }

    public function failed(?\Throwable $exception = null): void
    {
        Log::channel('crawler-errors')->error('PersonalPipelineJob failed', [
            'user_id' => $this->userId,
            'error' => $exception?->getMessage(),
        ]);
    }

    private function getOrCreateTodayDigest(int $tenantId): Digest
    {
        return Digest::query()->firstOrCreate(
            [
                'date' => now()->toDateString(),
                'tenant_id' => $tenantId,
            ],
            [
                'title' => 'Tech Signals - '.now()->format('M d, Y'),
                'total_signals' => 0,
            ]
        );
    }

    /**
     * @param  array{cluster_id: string, title: string, summary: string, topic_tags: list<string>, categories?: list<int>, source_count: int}  $summary
     */
    private function insertSignalRow(
        int $userId,
        int $digestId,
        int $tenantId,
        string $clusterId,
        array $summary
    ): int {
        $topicLiteral = $this->formatPgTextArray($summary['topic_tags']);
        $categoryLiteral = $this->formatPgIntArray($summary['categories'] ?? []);

        return (int) DB::table('signals')->insertGetId([
            'type' => 1,
            'user_id' => $userId,
            'digest_id' => $digestId,
            'cluster_id' => $clusterId,
            'title' => mb_substr($summary['title'], 0, 200),
            'summary' => $summary['summary'],
            'categories' => DB::raw($categoryLiteral),
            'topic_tags' => DB::raw($topicLiteral),
            'source_count' => $summary['source_count'],
            'rank_score' => 0,
            'impact_score' => 0,
            'tenant_id' => $tenantId,
            'created_at' => now(),
            'updated_at' => now(),
        ], 'id');
    }

    /**
     * @param  list<int>  $tweetIds
     */
    private function linkSignalSources(int $signalId, array $tweetIds): void
    {
        if ($tweetIds === []) {
            return;
        }

        $tweets = Tweet::query()
            ->whereIn('id', $tweetIds)
            ->get(['id', 'source_id']);

        if ($tweets->isEmpty()) {
            return;
        }

        $rows = [];
        $now = now();

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

    /**
     * @param  list<string>  $tags
     */
    private function formatPgTextArray(array $tags): string
    {
        if ($tags === []) {
            return "'{}'::varchar(50)[]";
        }

        $parts = array_map(function (string $tag): string {
            $escaped = str_replace(['\\', '"'], ['\\\\', '\"'], $tag);

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
}
