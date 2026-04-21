<?php

namespace App\Services;

use App\Models\Source;
use App\Models\Tweet;
use App\Models\User;
use Carbon\Carbon;
use DateTimeInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TwitterCrawlerService
{
    public function syncMultipleProfiles($sources): array
    {
        $successCount = 0;
        $failedCount = 0;

        foreach ($sources as $source) {
            try {
                // Tận dụng hàm refreshSourceProfile bạn đã viết cực chuẩn ở dưới
                // Hàm này đã có sẵn logic DB::transaction và xử lý lỗi
                $success = $this->refreshSourceProfile($source);

                if ($success) {
                    $successCount++;
                    // Hiển thị tiến trình ra console nếu đang chạy lệnh artisan
                    Log::channel('crawler')->info("Synced avatar for @{$source->x_handle}");
                } else {
                    $failedCount++;
                }

                // QUAN TRỌNG: Nghỉ 1 chút để tránh bị Rate Limit (429) và khớp với tiến độ API
                usleep(500000); // Nghỉ 0.5 giây

            } catch (\Exception $e) {
                $failedCount++;
                Log::error("Individual sync failed for {$source->x_handle}: ".$e->getMessage());
            }
        }

        return ['success' => $successCount, 'failed' => $failedCount];
    }

    public function refreshSourceProfile(Source $source): bool
    {
        // Bỏ qua API call nếu source đã crawl trong 24h gần đây VÀ đã có avatar mới sync trong 7 ngày.
        // crawlSource() đã sync profile trong response đó nên không cần thêm request riêng.
        $hasRecentCrawl = $source->last_crawled_at !== null
            && Carbon::parse($source->last_crawled_at)->gte(now()->subHours(24));
        $hasRecentAvatar = $source->avatar_synced_at !== null
            && Carbon::parse($source->avatar_synced_at)->gte(now()->subDays(7));
        $hasAvatar = ! empty($source->avatar_url);

        if ($hasRecentCrawl && $hasAvatar && $hasRecentAvatar) {
            Log::channel('crawler')->debug('TwitterCrawlerService::refreshSourceProfile skipped (recently crawled, avatar fresh)', [
                'source_id' => $source->id,
                'x_handle' => $source->x_handle,
                'last_crawled_at' => $source->last_crawled_at?->toIso8601String(),
                'avatar_synced_at' => $source->avatar_synced_at,
            ]);

            return true;
        }

        try {
            $userName = ltrim(trim($source->x_handle), '@');
            $fetchResult = $this->fetchTweetsFromAPI($userName, 1);

            DB::transaction(function () use ($source, $fetchResult): void {
                $this->syncSourceProfile($source, [
                    'avatar_url' => $fetchResult['avatar_url'],
                    'x_user_id' => $fetchResult['x_user_id'],
                    'email' => $fetchResult['email'],
                ], true);
                $this->syncUserEmailFromProfile($source, [
                    'x_user_id' => $fetchResult['x_user_id'],
                    'email' => $fetchResult['email'],
                ]);
                $source->save();
            });

            return true;
        } catch (\Throwable $e) {
            Log::channel('crawler-errors')->warning('TwitterCrawlerService::refreshSourceProfile failed', [
                'source_id' => $source->id,
                'x_handle' => $source->x_handle,
                'message' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Crawl tweets for one source and sync profile metadata (avatar/x_user_id).
     * Callers should load the source via {@see Source::scopeForCrawl} (only `status = active`).
     *
     * @return array{success: bool, tweets_count: int, new_tweets_count: int, message: string, affected_tweet_ids: list<int>}
     */
    public function crawlSource(Source $source, int $maxResults = 10): array
    {
        try {
            $maxResults = max(1, min(100, $maxResults));
            $userName = ltrim(trim($source->x_handle), '@');
            $isIncremental = $source->last_crawled_at !== null;

            Log::channel('crawler')->info('TwitterCrawlerService: crawl started', [
                'source_id' => $source->id,
                'handle' => $source->x_handle,
                'last_crawled_at' => $source->last_crawled_at?->toIso8601String(),
                'mode' => $isIncremental ? 'incremental' : 'initial',
            ]);

            $fetchResult = $this->fetchTweetsFromAPI($userName, $maxResults);
            $allNormalized = $fetchResult['tweets'];
            $profile = [
                'avatar_url' => $fetchResult['avatar_url'],
                'x_user_id' => $fetchResult['x_user_id'],
                'email' => $fetchResult['email'],
            ];

            if ($allNormalized === []) {
                Log::channel('crawler')->info('TwitterCrawlerService: no tweets from API', [
                    'source_id' => $source->id,
                ]);

                DB::transaction(function () use ($source, $profile): void {
                    $this->syncSourceProfile($source, $profile);
                    $source->last_crawled_at = now();
                    $source->save();
                });

                return [
                    'success' => true,
                    'tweets_count' => 0,
                    'new_tweets_count' => 0,
                    'message' => 'OK',
                    'affected_tweet_ids' => [],
                ];
            }

            $toStore = $isIncremental
                ? $this->filterNewTweets($allNormalized, $source->last_crawled_at)
                : $allNormalized;

            Log::channel('crawler')->info('TwitterCrawlerService: tweets filtered', [
                'source_id' => $source->id,
                'total_fetched' => count($allNormalized),
                'to_store' => count($toStore),
                'skipped_old' => count($allNormalized) - count($toStore),
            ]);

            /** @var array{new_ids: list<int>, duplicates: int, errors: int} $storeResult */
            $storeResult = [
                'new_ids' => [],
                'duplicates' => 0,
                'errors' => 0,
            ];

            DB::transaction(function () use ($source, $toStore, $profile, &$storeResult): void {
                $storeResult = $this->storeTweets($source, $toStore);
                $this->syncSourceProfile($source, $profile);
                $this->syncUserEmailFromProfile($source, $profile);
                $source->last_crawled_at = now();
                $source->save();
            });

            Log::channel('crawler')->info('TwitterCrawlerService: crawl completed', [
                'source_id' => $source->id,
                'new_tweet_rows' => count($storeResult['new_ids']),
                'duplicates' => $storeResult['duplicates'],
                'errors' => $storeResult['errors'],
            ]);

            return [
                'success' => true,
                'tweets_count' => count($allNormalized),
                'new_tweets_count' => count($storeResult['new_ids']),
                'message' => 'OK',
                'affected_tweet_ids' => $storeResult['new_ids'],
            ];
        } catch (\Throwable $e) {
            // Track last crawl attempt even when vendor/API call fails.
            // NOTE: this timestamp no longer means "last successful crawl".
            try {
                $source->last_crawled_at = now();
                $source->save();
            } catch (\Throwable $saveError) {
                Log::channel('crawler-errors')->warning('TwitterCrawlerService::crawlSource failed to persist last_crawled_at after error', [
                    'source_id' => $source->id,
                    'x_handle' => $source->x_handle,
                    'message' => $saveError->getMessage(),
                ]);
            }

            Log::channel('crawler-errors')->error('TwitterCrawlerService::crawlSource failed', [
                'source_id' => $source->id,
                'x_handle' => $source->x_handle,
                'message' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'tweets_count' => 0,
                'new_tweets_count' => 0,
                'message' => $e->getMessage(),
                'affected_tweet_ids' => [],
            ];
        }
    }

    /**
     * @return array{
     *   tweets: list<array{tweet_id: string, text: string, posted_at: string, url: string}>,
     *   avatar_url: ?string,
     *   x_user_id: ?string,
     *   email: ?string
     * }
     *
     * @throws \RuntimeException
     */
    private function fetchTweetsFromAPI(string $userName, int $maxResults): array
    {
        $payload = $this->makeLastTweetsRequest($userName, $maxResults);

        $this->assertTwitterApiSuccess($payload);

        $items = $this->extractTweetsList($payload);
        $items = array_slice($items, 0, $maxResults);
        $profile = $this->extractSourceProfile($payload, $items);

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

            $postedAt = Carbon::parse((string) $createdRaw)->setTimezone(config('app.timezone'));

            $normalized[] = [
                'tweet_id' => $tweetId,
                'text' => $text,
                'posted_at' => $postedAt->format('Y-m-d H:i:s'),
                'url' => $tweetUrl,
            ];
        }

        return [
            'tweets' => $normalized,
            'avatar_url' => $profile['avatar_url'],
            'x_user_id' => $profile['x_user_id'],
            'email' => $profile['email'],
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $tweets
     * @return array{avatar_url: ?string, x_user_id: ?string, email: ?string}
     */
    private function extractSourceProfile(array $payload, array $tweets): array
    {
        $candidates = [];
        $xUserCandidates = [];
        $emailCandidates = [];

        $dataUser = $payload['data']['user'] ?? null;
        if (is_array($dataUser)) {
            $candidates[] = $dataUser['profilePicture'] ?? $dataUser['profile_image_url'] ?? $dataUser['avatar'] ?? null;
            $xUserCandidates[] = $dataUser['id'] ?? $dataUser['rest_id'] ?? $dataUser['userId'] ?? null;
            $emailCandidates[] = $dataUser['email'] ?? null;
        }

        foreach ($tweets as $tweet) {
            if (! is_array($tweet)) {
                continue;
            }
            $author = $tweet['author'] ?? $tweet['user'] ?? null;
            if (is_array($author)) {
                $candidates[] = $author['profilePicture'] ?? $author['profile_image_url'] ?? $author['avatar'] ?? null;
                $xUserCandidates[] = $author['id'] ?? $author['rest_id'] ?? $author['userId'] ?? null;
                $emailCandidates[] = $author['email'] ?? null;
            }
        }

        $avatarUrl = null;
        foreach ($candidates as $candidate) {
            $normalized = $this->normalizeAvatarUrl($candidate);
            if ($normalized !== null) {
                $avatarUrl = $normalized;
                break;
            }
        }

        $xUserId = null;
        foreach ($xUserCandidates as $candidate) {
            if ($candidate === null) {
                continue;
            }
            $candidateStr = trim((string) $candidate);
            if ($candidateStr !== '') {
                $xUserId = $candidateStr;
                break;
            }
        }

        $email = null;
        foreach ($emailCandidates as $candidate) {
            $normalized = $this->normalizeEmail($candidate);
            if ($normalized !== null) {
                $email = $normalized;
                break;
            }
        }

        return [
            'avatar_url' => $avatarUrl,
            'x_user_id' => $xUserId,
            'email' => $email,
        ];
    }

    private function normalizeAvatarUrl(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }
        $url = trim($value);
        if ($url === '') {
            return null;
        }
        if (! str_starts_with($url, 'http://') && ! str_starts_with($url, 'https://')) {
            return null;
        }

        return $url;
    }

    /**
     * @param  array{avatar_url: ?string, x_user_id: ?string, email?: ?string}  $profile
     */
    private function syncSourceProfile(Source $source, array $profile, bool $forceRefresh = false): void
    {
        $shouldRefresh = $forceRefresh
            || $source->avatar_synced_at === null
            || Carbon::parse($source->avatar_synced_at)->lte(now()->subDays(7));

        if ($profile['x_user_id'] !== null && (string) $source->x_user_id === '') {
            $source->x_user_id = $profile['x_user_id'];
        }

        if ($shouldRefresh && $profile['avatar_url'] !== null) {
            if ((string) $source->avatar_url !== $profile['avatar_url']) {
                $source->avatar_url = $profile['avatar_url'];
            }
            $source->avatar_synced_at = now();
        }
    }

    /**
     * @param  array{x_user_id: ?string, email: ?string}  $profile
     */
    private function syncUserEmailFromProfile(Source $source, array $profile): void
    {
        if ($profile['email'] === null) {
            return;
        }

        $handle = ltrim(trim((string) $source->x_handle), '@');

        $userQuery = User::query();
        if ($profile['x_user_id'] !== null) {
            $userQuery->where('x_user_id', $profile['x_user_id']);
        } else {
            $userQuery->where('x_username', $handle);
        }

        $user = $userQuery->first();
        if ($user === null) {
            return;
        }

        if ((string) $user->email === $profile['email']) {
            return;
        }

        $user->email = $profile['email'];
        $user->save();
    }

    private function normalizeEmail(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $email = trim(strtolower($value));
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return null;
        }

        return $email;
    }

    /**
     * Giữ tweets có posted_at sau lần crawl trước (theo múi giờ ứng dụng).
     *
     * @param  list<array{tweet_id: string, text: string, posted_at: string, url: string}>  $tweets
     * @return list<array{tweet_id: string, text: string, posted_at: string, url: string}>
     */
    protected function filterNewTweets(array $tweets, ?DateTimeInterface $lastCrawledAt): array
    {
        if ($lastCrawledAt === null) {
            return $tweets;
        }

        $cutoff = Carbon::parse($lastCrawledAt);

        $filtered = array_filter($tweets, function (array $row) use ($cutoff): bool {
            try {
                $postedAt = Carbon::parse($row['posted_at']);

                return $postedAt->greaterThan($cutoff);
            } catch (\Throwable $e) {
                Log::warning('TwitterCrawlerService: failed to parse posted_at for filter', [
                    'tweet_id' => $row['tweet_id'] ?? 'unknown',
                    'posted_at' => $row['posted_at'] ?? null,
                    'error' => $e->getMessage(),
                ]);

                return true;
            }
        });

        return array_values($filtered);
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
        $maxAttempts = 2;

        while ($attempt < $maxAttempts) {
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
                    'max_attempts' => $maxAttempts,
                    'url' => $url,
                    'message' => $e->getMessage(),
                ]);

                if ($attempt >= $maxAttempts) {
                    throw new \RuntimeException('Network error: '.$e->getMessage(), 0, $e);
                }

                sleep(3);
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
     * Persist tweets; trả về ID các bản ghi vừa tạo mới (cho pipeline classify).
     *
     * @param  list<array{tweet_id: string, text: string, posted_at: string, url: string}>  $normalizedTweets
     * @return array{new_ids: list<int>, duplicates: int, errors: int}
     */
    private function storeTweets(Source $source, array $normalizedTweets): array
    {
        $newIds = [];
        $duplicateCount = 0;
        $errorCount = 0;

        if ($normalizedTweets === []) {
            return [
                'new_ids' => [],
                'duplicates' => 0,
                'errors' => 0,
            ];
        }

        $tenantId = (int) $source->tenant_id;

        foreach ($normalizedTweets as $row) {
            try {
                $tweet = Tweet::withTrashed()->firstOrNew(
                    ['tweet_id' => $row['tweet_id']]
                );
                $wasExisting = $tweet->exists;

                $tweet->fill([
                    'tenant_id' => $tenantId,
                    'source_id' => $source->id,
                    'text' => $row['text'],
                    'url' => $row['url'],
                    'posted_at' => $row['posted_at'],
                ]);

                if (! $wasExisting) {
                    $tweet->signal_score = null;
                    $tweet->is_signal = false;
                }

                $tweet->save();

                if ($tweet->trashed()) {
                    $tweet->restore();
                }

                if (! $wasExisting) {
                    $newIds[] = (int) $tweet->id;
                } else {
                    $duplicateCount++;
                    Log::channel('crawler')->debug('TwitterCrawlerService: duplicate tweet upsert', [
                        'tweet_id' => $row['tweet_id'],
                        'source_id' => $source->id,
                    ]);
                }
            } catch (\Throwable $e) {
                $errorCount++;
                Log::channel('crawler-errors')->error('TwitterCrawlerService: failed to save tweet', [
                    'tweet_id' => $row['tweet_id'] ?? 'unknown',
                    'source_id' => $source->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($duplicateCount > 0 || $errorCount > 0) {
            Log::channel('crawler')->info('TwitterCrawlerService: save tweets summary', [
                'source_id' => $source->id,
                'total_processed' => count($normalizedTweets),
                'newly_saved' => count($newIds),
                'duplicates' => $duplicateCount,
                'errors' => $errorCount,
            ]);
        }

        return [
            'new_ids' => $newIds,
            'duplicates' => $duplicateCount,
            'errors' => $errorCount,
        ];
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
