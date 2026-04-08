<?php

namespace App\Services;

use App\Models\Digest;
use App\Models\Signal;
use App\Models\Tweet;
use Carbon\Carbon;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SignalGeneratorService
{
    private int $batchSize;

    private int $maxRetries;

    private int $timeout;

    private string $apiKey;

    private string $apiVersion;

    private string $baseUrl;

    /** @var array{name: string, max_tokens: int, temperature: float} */
    private array $modelConfig;

    public function __construct()
    {
        $this->batchSize = (int) config('anthropic.batch_size', 100);
        $this->maxRetries = (int) config('anthropic.max_retries', 3);
        $this->timeout = (int) config('anthropic.timeout', 60);
        $this->apiKey = (string) (config('anthropic.api_key') ?? '');
        $this->apiVersion = (string) config('anthropic.api_version', '2023-06-01');
        $this->baseUrl = rtrim((string) config('anthropic.base_url', 'https://api.anthropic.com'), '/');
        /** @var array{name?: string, max_tokens?: int, temperature?: float} $cfg */
        $cfg = config('anthropic.models.signal_generation', []);
        $this->modelConfig = [
            'name' => (string) ($cfg['name'] ?? 'claude-3-5-sonnet-20241022'),
            'max_tokens' => (int) ($cfg['max_tokens'] ?? 2048),
            'temperature' => (float) ($cfg['temperature'] ?? 0.3),
        ];
    }

    /**
     * @return array{
     *     total_tweets: int,
     *     total_signals: int,
     *     batches: int,
     *     signals?: list<array<string, mixed>>
     * }
     */
    public function analyzeAndGenerateSignals(Carbon $date, bool $dryRun = false): array
    {
        $digest = $this->getOrCreateDigest($date);
        $tweets = $this->fetchUnprocessedTweets($date);

        if ($tweets->isEmpty()) {
            Log::info('No tweets to process', ['date' => $date->toDateString()]);

            return ['total_tweets' => 0, 'total_signals' => 0, 'batches' => 0];
        }

        Log::info('Starting signal generation', [
            'date' => $date->toDateString(),
            'total_tweets' => $tweets->count(),
            'batch_size' => $this->batchSize,
        ]);

        /** @var list<array<string, mixed>> $allSignals */
        $allSignals = [];
        $batches = $tweets->chunk($this->batchSize);
        $batchNumber = 1;

        foreach ($batches as $batch) {
            Log::info("Processing batch {$batchNumber}", ['tweets' => $batch->count()]);

            try {
                $signals = $this->callClaudeAPI($batch->all());

                if ($signals !== []) {
                    if (! $dryRun) {
                        $this->storeSignals($signals, $digest, $batch->all());
                    }
                    $allSignals = array_merge($allSignals, $signals);
                    Log::info("Batch {$batchNumber} completed", ['signals_extracted' => count($signals)]);
                } else {
                    Log::warning("Batch {$batchNumber} returned no signals");
                }
            } catch (\Throwable $e) {
                Log::error("Batch {$batchNumber} failed", [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }

            $batchNumber++;
        }

        if (! $dryRun && $allSignals !== []) {
            $digest->update([
                'total_signals' => Signal::query()->where('digest_id', $digest->id)->count(),
            ]);
        }

        return [
            'total_tweets' => $tweets->count(),
            'total_signals' => count($allSignals),
            'batches' => $batches->count(),
            'signals' => $allSignals,
        ];
    }

    /**
     * @param  list<Tweet>  $tweets
     * @return list<array<string, mixed>>
     */
    private function callClaudeAPI(array $tweets): array
    {
        if ($this->apiKey === '') {
            throw new \RuntimeException('ANTHROPIC_API_KEY is not configured.');
        }

        $prompt = $this->buildPrompt($tweets);

        $response = Http::withHeaders([
            'x-api-key' => $this->apiKey,
            'anthropic-version' => $this->apiVersion,
            'content-type' => 'application/json',
        ])
            ->timeout($this->timeout)
            ->retry($this->maxRetries, 1000, function ($exception) {
                return $exception instanceof ConnectionException;
            })
            ->post("{$this->baseUrl}/v1/messages", [
                'model' => $this->modelConfig['name'],
                'max_tokens' => $this->modelConfig['max_tokens'],
                'temperature' => $this->modelConfig['temperature'],
                'messages' => [['role' => 'user', 'content' => $prompt]],
            ]);

        if ($response->failed()) {
            Log::error('Claude API call failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \RuntimeException('Claude API failed: '.$response->body());
        }

        return $this->parseSignals($response->body());
    }

    /**
     * @param  list<Tweet>  $tweets
     */
    private function buildPrompt(array $tweets): string
    {
        $tweetsPayload = '';
        foreach ($tweets as $tweet) {
            $source = $tweet->source;
            $handle = $source !== null ? (string) $source->x_handle : 'unknown';
            $categories = $source !== null
                ? $source->categories->pluck('name')->filter()->implode(', ')
                : '';
            if ($categories === '') {
                $categories = 'none';
            }
            $postedAt = $tweet->posted_at instanceof Carbon
                ? $tweet->posted_at->format('Y-m-d H:i')
                : '';

            $tweetsPayload .= sprintf(
                "Tweet ID: %d\nAuthor: @%s (Categories: %s)\nPosted: %s\nContent: %s\n\n",
                $tweet->id,
                $handle,
                $categories,
                $postedAt,
                $tweet->text
            );
        }

        return <<<PROMPT
You are an expert tech industry analyst tasked with extracting HIGH-QUALITY, ACTIONABLE signals from tweets by tech KOLs.

**YOUR TASK:** Extract ONLY signals meeting ALL criteria:
1. ACTIONABLE 2. NEWSWORTHY 3. FACTUAL 4. IMPACTFUL

**INPUT TWEETS:**
{$tweetsPayload}

**CATEGORIES:** 1.AI/ML 2.Dev Tools 3.Indie/SaaS 4.Marketing 5.Startup/VC 6.Crypto 7.Finance 8.Design 9.Creator 10.Tech Policy

**IMPACT SCORING:**
0.90-1.00 CRITICAL: Major launches, Series C+, paradigm shifts
0.70-0.89 HIGH: Features, Series A/B, partnerships
0.50-0.69 MEDIUM: Updates, seed funding, insights
0.30-0.49 LOW: Minor updates
<0.30 NOISE: Filter out

**OUTPUT:** JSON array:
{"title":"...","summary":"...","impact_score":0.75,"category_ids":[1,2],"topic_tags":["..."],"related_tweet_ids":[123],"reasoning":"..."}

Return ONLY valid JSON, no markdown.
PROMPT;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function parseSignals(string $responseBody): array
    {
        try {
            /** @var array<string, mixed>|null $data */
            $data = json_decode($responseBody, true);
            if (! is_array($data) || ! isset($data['content'][0]['text'])) {
                throw new \RuntimeException('Invalid response structure');
            }

            $text = (string) $data['content'][0]['text'];
            $text = preg_replace('/^```json\s*/m', '', $text) ?? $text;
            $text = preg_replace('/\s*```$/m', '', $text) ?? $text;
            /** @var mixed $decoded */
            $decoded = json_decode(trim($text), true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \RuntimeException('JSON parse error: '.json_last_error_msg());
            }
            if (! is_array($decoded)) {
                throw new \RuntimeException('Expected array of signals');
            }

            foreach ($decoded as $signal) {
                if (! is_array($signal)) {
                    throw new \RuntimeException('Invalid signal entry');
                }
                $this->validateSignal($signal);
            }

            /** @var list<array<string, mixed>> */
            return $decoded;
        } catch (\Throwable $e) {
            Log::error('Parse failed', [
                'error' => $e->getMessage(),
                'response' => substr($responseBody, 0, 500),
            ]);

            return [];
        }
    }

    /**
     * @param  array<string, mixed>  $signal
     */
    private function validateSignal(array $signal): void
    {
        $required = ['title', 'summary', 'impact_score', 'category_ids', 'topic_tags', 'related_tweet_ids'];
        foreach ($required as $field) {
            if (! array_key_exists($field, $signal)) {
                throw new \RuntimeException("Missing: {$field}");
            }
        }
        $score = (float) $signal['impact_score'];
        if ($score < 0 || $score > 1) {
            throw new \RuntimeException('Invalid impact_score');
        }
    }

    /**
     * @param  list<array<string, mixed>>  $signals
     * @param  list<Tweet>  $tweets
     */
    private function storeSignals(array $signals, Digest $digest, array $tweets): void
    {
        DB::transaction(function () use ($signals, $digest, $tweets): void {
            /** @var Collection<int, Tweet> $tweetMap */
            $tweetMap = collect($tweets)->keyBy('id');

            foreach ($signals as $signalData) {
                /** @var list<int>|array<int, int> $relatedTweetIds */
                $relatedTweetIds = array_map('intval', (array) $signalData['related_tweet_ids']);
                $sourceIds = [];

                foreach ($relatedTweetIds as $tweetId) {
                    if ($tweetMap->has($tweetId)) {
                        /** @var Tweet $t */
                        $t = $tweetMap->get($tweetId);
                        $sourceIds[] = (int) $t->source_id;
                    }
                }

                $sourceIds = array_values(array_unique($sourceIds));
                $impact = (float) $signalData['impact_score'];
                $rankScore = min($impact * log(count($sourceIds) + 1), 1.0);

                $signalId = (int) DB::table('signals')->insertGetId([
                    'digest_id' => $digest->id,
                    'cluster_id' => Str::uuid()->toString(),
                    'title' => substr($signalData['title'], 0, 200),
                    'summary' => $signalData['summary'],
                    'categories' => DB::raw("'{".implode(',', $signalData['category_ids'])."}'"),
                    'topic_tags' => DB::raw("'{".implode(',', array_map(fn ($t) => '"'.str_replace('"', '\"', $t).'"', $signalData['topic_tags']))."}'"),
                    'source_count' => count($sourceIds),
                    'rank_score' => round($rankScore, 4),
                    'impact_score' => $impact,
                    'tenant_id' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ], 'id');

                $junctionData = [];
                foreach ($relatedTweetIds as $tweetId) {
                    if ($tweetMap->has($tweetId)) {
                        /** @var Tweet $tweet */
                        $tweet = $tweetMap->get($tweetId);
                        if (! isset($junctionData[$tweet->source_id])) {
                            $junctionData[$tweet->source_id] = [
                                'signal_id' => $signalId,
                                'source_id' => $tweet->source_id,
                                'tweet_id' => $tweet->id,
                                'tenant_id' => 1,
                                'created_at' => now(),
                            ];
                        }
                    }
                }

                if (!empty($junctionData)) {
                    $values = array_map(function($row) {
                        return sprintf("(%d, %d, %d, %d, '%s')", 
                            $row['signal_id'], 
                            $row['source_id'], 
                            $row['tweet_id'], 
                            $row['tenant_id'], 
                            $row['created_at']
                        );
                    }, array_values($junctionData));
                    
                    DB::statement('INSERT INTO signal_sources (signal_id, source_id, tweet_id, tenant_id, created_at) VALUES ' .
                        implode(', ', $values) .
                        ' ON CONFLICT (signal_id, source_id) DO NOTHING'
                    );
                }

                $validTweetIds = array_values(array_intersect($relatedTweetIds, $tweetMap->keys()->all()));
                if ($validTweetIds !== []) {
                    Tweet::query()->whereIn('id', $validTweetIds)->update([
                        'is_signal' => true,
                        'signal_score' => $impact,
                    ]);
                }
            }
        });
    }

    private function getOrCreateDigest(Carbon $date): Digest
    {
        $digest = Digest::firstOrCreate(
            ['date' => $date->toDateString(), 'tenant_id' => 1],
            ['title' => "Daily Digest - {$date->format('M d, Y')}"]
        );

        // Update title nếu null (for existing records)
        if (is_null($digest->title)) {
            $digest->update(['title' => "Daily Digest - {$date->format('M d, Y')}"]);
        }

        return $digest;
    }

    /**
     * @return Collection<int, Tweet>
     */
    private function fetchUnprocessedTweets(Carbon $date): Collection
    {
        $start = $date->copy()->subDay()->startOfDay();
        $end = $date->copy()->endOfDay();

        return Tweet::query()
            ->with(['source.categories'])
            ->where('is_signal', false)
            // ->whereBetween('posted_at', [$start, $end])
            ->orderByDesc('posted_at')
            ->get();
    }
}
