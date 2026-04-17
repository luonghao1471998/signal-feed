<?php

namespace App\Services;

use App\Integrations\LLMClient;
use App\Models\Tweet;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class TweetClusterService
{
    public function __construct(
        private readonly LLMClient $llmClient,
        private readonly FakeLLMClient $fakeLlmClient
    ) {}

    /**
     * @return array{clusters: list<array{cluster_id: string, tweet_ids: list<int>, topic: string}>, unclustered: list<int>}
     */
    public function clusterRecentSignals(): array
    {
        $lookbackHours = (int) config('signalfeed.cluster_lookback_hours', 24);

        $query = Tweet::query()
            ->where('is_signal', true)
            ->orderByDesc('created_at');

        if ($lookbackHours > 0) {
            $query->where('created_at', '>=', now()->subHours($lookbackHours));
        }

        /** @var Collection<int, Tweet> $signalTweets */
        $signalTweets = $query->get();

        if ($signalTweets->isEmpty()) {
            Log::channel('crawler')->info('TweetClusterService: no signal tweets to cluster', [
                'lookback_hours' => $lookbackHours,
            ]);

            return ['clusters' => [], 'unclustered' => []];
        }

        Log::channel('crawler')->info('TweetClusterService: clustering signal tweets', [
            'count' => $signalTweets->count(),
            'lookback_hours' => $lookbackHours,
        ]);

        return $this->clusterTweets($signalTweets);
    }

    /**
     * @param  Collection<int, Tweet>  $tweets
     * @return array{clusters: list<array{cluster_id: string, tweet_ids: list<int>, topic: string}>, unclustered: list<int>}
     */
    public function clusterTweets(Collection $tweets): array
    {
        if ($tweets->count() < 2) {
            return [
                'clusters' => [],
                'unclustered' => $tweets->pluck('id')->map(fn ($id): int => (int) $id)->values()->all(),
            ];
        }

        try {
            $prompt = $this->buildClusterPrompt($tweets);
            $assistantText = $this->resolveClusterLlm()->cluster($prompt);

            return $this->parseClusterResponse($assistantText, $tweets);
        } catch (\Throwable $e) {
            Log::channel('crawler-errors')->error('TweetClusterService: clustering failed', [
                'error' => $e->getMessage(),
                'tweet_count' => $tweets->count(),
            ]);

            return [
                'clusters' => [],
                'unclustered' => $tweets->pluck('id')->map(fn ($id): int => (int) $id)->values()->all(),
            ];
        }
    }

    /**
     * @param  Collection<int, Tweet>  $tweets
     */
    private function buildClusterPrompt(Collection $tweets): string
    {
        $path = base_path((string) config('anthropic.cluster_prompt_path', 'docs/prompts/v1/cluster.md'));
        if (! File::isFile($path)) {
            throw new \RuntimeException("Cluster prompt file missing: {$path}");
        }

        $template = File::get($path);

        $payload = [
            'tweets' => $tweets->map(fn (Tweet $tweet): array => [
                'id' => (int) $tweet->id,
                'text' => (string) $tweet->text,
                'posted_at' => $tweet->posted_at?->toIso8601String(),
            ])->values()->all(),
        ];

        $tweetsJson = json_encode($payload, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);

        return str_replace('{{TWEETS_JSON}}', $tweetsJson, $template);
    }

    /**
     * @param  Collection<int, Tweet>  $tweets
     * @return array{clusters: list<array{cluster_id: string, tweet_ids: list<int>, topic: string}>, unclustered: list<int>}
     */
    private function parseClusterResponse(string $assistantText, Collection $tweets): array
    {
        $minSize = max(2, (int) config('signalfeed.min_cluster_size', 2));
        $validIds = $tweets->pluck('id')->map(fn ($id): int => (int) $id)->all();
        $validIdSet = array_flip($validIds);

        $text = trim($assistantText);
        if (preg_match('/```json\s*(.*?)\s*```/s', $text, $m)) {
            $text = trim($m[1]);
        }

        /** @var mixed $decoded */
        $decoded = json_decode($text, true);
        if (! is_array($decoded) || ! isset($decoded['clusters']) || ! is_array($decoded['clusters'])) {
            throw new \RuntimeException('Cluster JSON missing clusters array');
        }

        /** @var list<int> $llmUnclustered */
        $llmUnclustered = [];
        if (isset($decoded['unclustered']) && is_array($decoded['unclustered'])) {
            foreach ($decoded['unclustered'] as $id) {
                $llmUnclustered[] = (int) $id;
            }
        }

        $clusters = [];
        $usedInCluster = [];

        foreach ($decoded['clusters'] as $row) {
            if (! is_array($row)) {
                continue;
            }

            $rawIds = $row['tweet_ids'] ?? [];
            if (! is_array($rawIds)) {
                continue;
            }

            $tweetIds = [];
            foreach ($rawIds as $id) {
                $intId = (int) $id;
                if (isset($validIdSet[$intId])) {
                    $tweetIds[] = $intId;
                }
            }

            $tweetIds = array_values(array_unique($tweetIds));

            if (count($tweetIds) < $minSize) {
                foreach ($tweetIds as $id) {
                    $llmUnclustered[] = $id;
                }

                continue;
            }

            $clusterId = 'cluster_'.Str::uuid()->toString();
            $topic = isset($row['topic']) && is_string($row['topic']) && $row['topic'] !== ''
                ? $row['topic']
                : 'Untitled';

            $clusters[] = [
                'cluster_id' => $clusterId,
                'tweet_ids' => $tweetIds,
                'topic' => $topic,
            ];

            foreach ($tweetIds as $id) {
                $usedInCluster[$id] = true;
            }
        }

        $unclusteredSet = [];
        foreach ($llmUnclustered as $id) {
            if (isset($validIdSet[$id]) && ! isset($usedInCluster[$id])) {
                $unclusteredSet[$id] = true;
            }
        }

        foreach ($validIds as $id) {
            if (! isset($usedInCluster[$id])) {
                $unclusteredSet[$id] = true;
            }
        }

        return [
            'clusters' => $clusters,
            'unclustered' => array_values(array_keys($unclusteredSet)),
        ];
    }

    private function resolveClusterLlm(): FakeLLMClient|LLMClient
    {
        if (config('app.mock_llm') === true) {
            return $this->fakeLlmClient;
        }

        return $this->llmClient;
    }
}
