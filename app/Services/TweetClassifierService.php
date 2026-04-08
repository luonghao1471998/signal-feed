<?php

namespace App\Services;

use App\Integrations\LLMClient;
use App\Models\Tweet;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class TweetClassifierService
{
    private const CLASSIFY_ATTEMPTS = 3;

    public function __construct(
        private readonly LLMClient $llmClient,
        private readonly FakeLLMClient $fakeLlmClient
    ) {}

    /**
     * @return array{signal_score: float, is_signal: bool}
     */
    public function classifyTweet(Tweet $tweet): array
    {
        if ($tweet->signal_score !== null) {
            return [
                'signal_score' => (float) $tweet->signal_score,
                'is_signal' => (bool) $tweet->is_signal,
            ];
        }

        $lastException = null;

        for ($attempt = 1; $attempt <= self::CLASSIFY_ATTEMPTS; $attempt++) {
            try {
                $raw = $this->resolveClassifier()->classify((string) $tweet->text);

                return $this->applyThreshold($raw['signal_score']);
            } catch (\Throwable $e) {
                $lastException = $e;
                Log::channel('crawler-errors')->warning('TweetClassifierService: classify attempt failed', [
                    'tweet_id' => $tweet->id,
                    'attempt' => $attempt,
                    'error' => $e->getMessage(),
                ]);

                if ($attempt < self::CLASSIFY_ATTEMPTS) {
                    usleep((int) (1_000_000 * (2 ** ($attempt - 1))));
                }
            }
        }

        throw $lastException instanceof \Throwable
            ? $lastException
            : new \RuntimeException('Tweet classification failed');
    }

    /**
     * @param  Collection<int, Tweet>  $tweets
     * @return array<int, array{signal_score: float, is_signal: bool}>
     */
    public function classifyBatch(Collection $tweets): array
    {
        $out = [];

        foreach ($tweets as $tweet) {
            $out[(int) $tweet->id] = $this->classifyTweet($tweet);
        }

        return $out;
    }

    /**
     * Classify tweets pending classification (signal_score IS NULL), bounded by config.
     *
     * @return array{classified: int, failed: int, signals: int, scanned: int}
     */
    public function classifyPendingTweets(): array
    {
        $hours = (int) config('signalfeed.classify_lookback_hours', 24);
        $limit = max(1, (int) config('signalfeed.classify_batch_size', 200));

        $query = Tweet::query()
            ->whereNull('signal_score')
            ->orderBy('id');

        if ($hours > 0) {
            $query->where('created_at', '>=', now()->subHours($hours));
        }

        /** @var Collection<int, Tweet> $tweets */
        $tweets = $query->limit($limit)->get();

        Log::channel('crawler')->info('TweetClassifierService: pending batch', [
            'count' => $tweets->count(),
            'lookback_hours' => $hours,
            'limit' => $limit,
        ]);

        $classified = 0;
        $failed = 0;
        $signals = 0;

        foreach ($tweets as $tweet) {
            try {
                $result = $this->classifyTweet($tweet);
                $tweet->update([
                    'signal_score' => $result['signal_score'],
                    'is_signal' => $result['is_signal'],
                ]);
                $classified++;
                if ($result['is_signal']) {
                    $signals++;
                }
            } catch (\Throwable $e) {
                $failed++;
                Log::channel('crawler-errors')->error('TweetClassifierService: tweet classify failed', [
                    'tweet_id' => $tweet->id,
                    'vendor_tweet_id' => $tweet->tweet_id,
                    'error' => $e->getMessage(),
                ]);
            }

            $n = $classified + $failed;
            if ($tweets->count() > 0 && $n % 50 === 0) {
                Log::channel('crawler')->info("TweetClassifierService: progress {$n}/{$tweets->count()}");
            }
        }

        Log::channel('crawler')->info('TweetClassifierService: batch finished', [
            'scanned' => $tweets->count(),
            'classified' => $classified,
            'failed' => $failed,
            'signals' => $signals,
            'signal_rate_pct' => $classified > 0 ? round(100 * $signals / $classified, 2) : 0.0,
        ]);

        return [
            'classified' => $classified,
            'failed' => $failed,
            'signals' => $signals,
            'scanned' => $tweets->count(),
        ];
    }

    /**
     * @param  array{signal_score: float|int|string, is_signal?: bool}  $raw
     * @return array{signal_score: float, is_signal: bool}
     */
    private function applyThreshold(float|int|string $rawScore): array
    {
        $score = (float) $rawScore;
        $score = max(0.0, min(1.0, round($score, 2)));
        $threshold = (float) config('signalfeed.signal_threshold', 0.6);

        return [
            'signal_score' => (string) $score,
            'is_signal' => $score >= $threshold,
        ];
    }

    private function resolveClassifier(): FakeLLMClient|LLMClient
    {
        if (config('app.mock_llm') === true) {
            return $this->fakeLlmClient;
        }

        return $this->llmClient;
    }
}
