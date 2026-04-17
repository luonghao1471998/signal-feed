<?php

namespace Tests\Feature;

use App\Integrations\LLMClient;
use App\Models\Source;
use App\Models\Tweet;
use App\Services\TweetClusterService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class TweetClusterServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function makeSource(): Source
    {
        return Source::query()->create([
            'type' => 'default',
            'status' => 'active',
            'x_handle' => 'clustertest_'.uniqid(),
            'account_url' => 'https://twitter.com/clustertest',
            'tenant_id' => 1,
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function makeSignalTweet(Source $source, array $overrides = []): Tweet
    {
        return Tweet::query()->create(array_merge([
            'tweet_id' => 'tw_'.uniqid(),
            'source_id' => $source->id,
            'text' => 'Signal body '.uniqid(),
            'posted_at' => now(),
            'url' => 'https://twitter.com/x/status/'.uniqid(),
            'signal_score' => 0.9,
            'is_signal' => true,
            'tenant_id' => 1,
        ], $overrides));
    }

    public function test_returns_empty_when_no_signal_tweets(): void
    {
        config(['app.mock_llm' => true]);

        $result = app(TweetClusterService::class)->clusterRecentSignals();

        $this->assertSame(['clusters' => [], 'unclustered' => []], $result);
    }

    public function test_returns_unclustered_for_single_tweet(): void
    {
        config(['app.mock_llm' => true]);

        $source = $this->makeSource();
        $tweet = $this->makeSignalTweet($source);

        $result = app(TweetClusterService::class)->clusterTweets(collect([$tweet]));

        $this->assertSame([], $result['clusters']);
        $this->assertSame([(int) $tweet->id], $result['unclustered']);
    }

    public function test_clusters_multiple_signal_tweets_with_fake_llm(): void
    {
        config(['app.mock_llm' => true]);

        $source = $this->makeSource();
        $tweets = collect();
        for ($i = 0; $i < 5; $i++) {
            $tweets->push($this->makeSignalTweet($source));
        }

        $result = app(TweetClusterService::class)->clusterTweets($tweets);

        $this->assertNotEmpty($result['clusters']);
        foreach ($result['clusters'] as $cluster) {
            $this->assertArrayHasKey('cluster_id', $cluster);
            $this->assertArrayHasKey('tweet_ids', $cluster);
            $this->assertArrayHasKey('topic', $cluster);
            $this->assertGreaterThanOrEqual(2, count($cluster['tweet_ids']));
            $this->assertStringStartsWith('cluster_', $cluster['cluster_id']);
        }
    }

    public function test_only_clusters_recent_signals_by_lookback(): void
    {
        config([
            'app.mock_llm' => true,
            'signalfeed.cluster_lookback_hours' => 24,
        ]);

        $source = $this->makeSource();
        $old = $this->makeSignalTweet($source, ['tweet_id' => 'old_sig']);
        $old->forceFill([
            'created_at' => now()->subHours(25),
            'updated_at' => now()->subHours(25),
        ])->saveQuietly();

        $recent = $this->makeSignalTweet($source, ['tweet_id' => 'recent_sig']);
        $recent->forceFill([
            'created_at' => now()->subHours(2),
            'updated_at' => now()->subHours(2),
        ])->saveQuietly();

        $result = app(TweetClusterService::class)->clusterRecentSignals();

        $this->assertSame([], $result['clusters']);
        $this->assertSame([(int) $recent->id], $result['unclustered']);
    }

    public function test_handles_clustering_errors_gracefully(): void
    {
        config(['app.mock_llm' => false]);

        $mock = Mockery::mock(LLMClient::class);
        $mock->shouldReceive('cluster')
            ->once()
            ->andThrow(new \RuntimeException('API error'));
        $this->instance(LLMClient::class, $mock);

        $source = $this->makeSource();
        $a = $this->makeSignalTweet($source, ['tweet_id' => 'a1']);
        $b = $this->makeSignalTweet($source, ['tweet_id' => 'b1']);

        $result = app(TweetClusterService::class)->clusterTweets(collect([$a, $b]));

        $this->assertSame([], $result['clusters']);
        $this->assertCount(2, $result['unclustered']);
        sort($result['unclustered']);
        $this->assertSame([(int) $a->id, (int) $b->id], $result['unclustered']);
    }
}
