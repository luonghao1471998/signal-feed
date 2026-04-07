<?php

namespace App\Services;

use App\Models\Source;
use Carbon\Carbon;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TwitterCrawlerService
{
    /**
     * Crawl tweets for one source (by handle only; does not populate {@see Source::$x_user_id}).
     *
     * @return array{success: bool, tweets_count: int, message: string}
     */
    public function crawlSource(Source $source, int $maxResults = 10): array
    {
        try {
            $maxResults = max(1, min(100, $maxResults));
            $userName = ltrim(trim($source->x_handle), '@');

            $normalizedTweets = $this->fetchTweetsFromAPI($userName, $maxResults);

            DB::transaction(function () use ($source, $normalizedTweets): void {
                $this->storeTweets($source, $normalizedTweets);
                $source->last_crawled_at = now('UTC');
                $source->save();
            });

            return [
                'success' => true,
                'tweets_count' => count($normalizedTweets),
                'message' => 'OK',
            ];
        } catch (\Throwable $e) {
            Log::error('TwitterCrawlerService::crawlSource failed', [
                'source_id' => $source->id,
                'x_handle' => $source->x_handle,
                'message' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'tweets_count' => 0,
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * @return list<array{tweet_id: string, text: string, posted_at: string, url: string}>
     *
     * @throws \RuntimeException
     */
    private function fetchTweetsFromAPI(string $userName, int $maxResults): array
    {
        $payload = $this->makeLastTweetsRequest($userName, $maxResults);

        $this->assertTwitterApiSuccess($payload);

        $items = $this->extractTweetsList($payload);
        $items = array_slice($items, 0, $maxResults);

        $normalized = [];

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $tweetId = isset($item['id']) ? trim((string) $item['id']) : '';
            $text = isset($item['text']) ? (string) $item['text'] : '';
            $createdRaw = $item['createdAt'] ?? $item['created_at'] ?? '';
            $tweetUrl = isset($item['url']) && is_string($item['url']) ? trim($item['url']) : '';

            if ($tweetId === '' || $text === '' || $createdRaw === '' || $tweetUrl === '') {
                Log::warning('TwitterCrawlerService: skip tweet (missing id, text, createdAt, or url)', [
                    'userName' => $userName,
                ]);

                continue;
            }

            $postedAt = Carbon::parse((string) $createdRaw)->utc();

            $normalized[] = [
                'tweet_id' => $tweetId,
                'text' => $text,
                'posted_at' => $postedAt->format('Y-m-d H:i:s'),
                'url' => $tweetUrl,
            ];
        }

        return $normalized;
    }

    /**
     * @return array<string, mixed>
     *
     * @throws \RuntimeException
     */
    private function makeLastTweetsRequest(string $userName, int $count): array
    {
        $key = config('services.twitterapi.key');
        if ($key === null || $key === '') {
            throw new \RuntimeException('twitterapi.io API key missing (TWITTERAPI_KEY / TWITTER_API_KEY)');
        }

        /** @var string $base */
        $base = config('services.twitterapi.base_url');
        $timeout = (int) config('services.twitterapi.timeout', 30);
        $url = $base.'/twitter/user/last_tweets';

        $attempt = 0;
        $lastException = null;

        while ($attempt < 3) {
            $attempt++;

            try {
                $response = Http::withHeaders([
                    'X-API-Key' => $key,
                    'Accept' => 'application/json',
                ])
                    ->timeout($timeout)
                    ->get($url, [
                        'userName' => $userName,
                        'count' => $count,
                    ]);

                return $this->interpretHttpResponse($response, $url);
            } catch (ConnectionException $e) {
                $lastException = $e;
                Log::warning('twitterapi.io connection failed', [
                    'attempt' => $attempt,
                    'url' => $url,
                    'message' => $e->getMessage(),
                ]);

                if ($attempt >= 3) {
                    throw new \RuntimeException('Network error: '.$e->getMessage(), 0, $e);
                }

                sleep(5);
            }
        }

        throw new \RuntimeException('Network error', 0, $lastException);
    }

    /**
     * Supports wrapped `{ "data": { "tweets": [...] } }` and legacy top-level `tweets`.
     *
     * @param  array<string, mixed>  $payload
     * @return list<array<string, mixed>>
     *
     * @throws \RuntimeException
     */
    private function extractTweetsList(array $payload): array
    {
        $data = $payload['data'] ?? null;
        if (is_array($data) && isset($data['tweets']) && is_array($data['tweets'])) {
            /** @var list<array<string, mixed>> */
            return $data['tweets'];
        }

        if (isset($payload['tweets']) && is_array($payload['tweets'])) {
            /** @var list<array<string, mixed>> */
            return $payload['tweets'];
        }

        throw new \RuntimeException('Invalid API response: missing data.tweets');
    }

    /**
     * @param  array<string, mixed>  $payload
     *
     * @throws \RuntimeException
     */
    private function assertTwitterApiSuccess(array $payload): void
    {
        if (($payload['status'] ?? '') === 'error') {
            $msg = (string) ($payload['msg'] ?? $payload['message'] ?? 'twitterapi.io API error');

            throw new \RuntimeException($msg);
        }

        if (array_key_exists('code', $payload) && (int) $payload['code'] !== 0) {
            $msg = (string) ($payload['msg'] ?? $payload['message'] ?? 'twitterapi.io API error');

            throw new \RuntimeException($msg);
        }
    }

    /**
     * Persist tweets; metrics từ API bị bỏ (không có cột trong schema migration hiện tại).
     *
     * @param  list<array{tweet_id: string, text: string, posted_at: string, url: string}>  $normalizedTweets
     */
    private function storeTweets(Source $source, array $normalizedTweets): void
    {
        if ($normalizedTweets === []) {
            return;
        }

        $tenantId = (int) $source->tenant_id;

        foreach ($normalizedTweets as $row) {
            DB::statement(
                'INSERT INTO tweets (
                    tenant_id, source_id, tweet_id, text, url, posted_at,
                    is_signal, signal_score, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON CONFLICT (tweet_id) DO UPDATE SET
                    text = EXCLUDED.text,
                    url = EXCLUDED.url,
                    posted_at = EXCLUDED.posted_at,
                    updated_at = NOW()',
                [
                    $tenantId,
                    $source->id,
                    $row['tweet_id'],
                    $row['text'],
                    $row['url'],
                    $row['posted_at'],
                    false,
                    0,
                ]
            );
        }
    }

    /**
     * @return array<string, mixed>
     *
     * @throws \RuntimeException
     */
    private function interpretHttpResponse(Response $response, string $url): array
    {
        if ($response->status() === 403) {
            Log::warning('twitterapi.io 403 Account suspended', ['url' => $url]);

            throw new \RuntimeException('Account suspended');
        }

        if ($response->status() === 404) {
            Log::warning('twitterapi.io 404 Account not found', ['url' => $url]);

            throw new \RuntimeException('Account not found');
        }

        if ($response->status() === 429) {
            Log::warning('twitterapi.io 429 Rate limit', ['url' => $url]);

            throw new \RuntimeException('Rate limit exceeded');
        }

        if (! $response->successful()) {
            Log::error('twitterapi.io HTTP error', [
                'status' => $response->status(),
                'url' => $url,
                'body' => $response->body(),
            ]);

            throw new \RuntimeException('API error HTTP '.$response->status());
        }

        $decoded = $response->json();
        if (! is_array($decoded)) {
            throw new \RuntimeException('Invalid API response: not a JSON object');
        }

        return $decoded;
    }
}
