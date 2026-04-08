<?php

namespace Tests\Unit\Jobs;

use App\Integrations\LLMClient;
use App\Jobs\PipelineCrawlJob;
use App\Models\Source;
use App\Models\Tweet;
use App\Services\FakeLLMClient;
use App\Services\TweetClassifierService;
use App\Services\TwitterCrawlerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class PipelineCrawlJobTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_classify_step_uses_mocked_llm_when_mock_llm_disabled(): void
    {
        config(['app.mock_llm' => false]);

        $source = Source::query()->create([
            'type' => 'default',
            'status' => 'active',
            'x_handle' => 'testkol',
            'account_url' => 'https://twitter.com/testkol',
            'tenant_id' => 1,
        ]);

        $tweet = Tweet::query()->create([
            'tweet_id' => '1999999999999999999',
            'source_id' => $source->id,
            'text' => 'Breaking: major API launch today.',
            'posted_at' => now(),
            'url' => 'https://twitter.com/testkol/status/1999999999999999999',
            'signal_score' => null,
            'is_signal' => false,
            'tenant_id' => 1,
        ]);

        $crawler = Mockery::mock(TwitterCrawlerService::class);
        $crawler->shouldReceive('crawlSource')
            ->once()
            ->andReturn([
                'success' => true,
                'tweets_count' => 1,
                'new_tweets_count' => 0,
                'message' => 'OK',
                'affected_tweet_ids' => [(int) $tweet->id],
            ]);

        $llm = Mockery::mock(LLMClient::class);
        $llm->shouldReceive('classify')
            ->once()
            ->with($tweet->text)
            ->andReturn([
                'signal_score' => 0.82,
                'is_signal' => true,
            ]);

        $this->instance(LLMClient::class, $llm);

        $job = new PipelineCrawlJob(10);
        $job->handle($crawler, app(TweetClassifierService::class));

        $tweet->refresh();
        $this->assertEquals(0.82, (float) $tweet->signal_score);
        $this->assertTrue($tweet->is_signal);
    }

    public function test_classify_failure_skips_tweet_and_continues(): void
    {
        config(['app.mock_llm' => false]);

        $source = Source::query()->create([
            'type' => 'default',
            'status' => 'active',
            'x_handle' => 'testkol2',
            'account_url' => 'https://twitter.com/testkol2',
            'tenant_id' => 1,
        ]);

        $tweet = Tweet::query()->create([
            'tweet_id' => '1888888888888888888',
            'source_id' => $source->id,
            'text' => 'Second tweet',
            'posted_at' => now(),
            'url' => 'https://twitter.com/testkol2/status/1888888888888888888',
            'signal_score' => null,
            'is_signal' => false,
            'tenant_id' => 1,
        ]);

        $crawler = Mockery::mock(TwitterCrawlerService::class);
        $crawler->shouldReceive('crawlSource')
            ->once()
            ->andReturn([
                'success' => true,
                'tweets_count' => 1,
                'new_tweets_count' => 0,
                'message' => 'OK',
                'affected_tweet_ids' => [(int) $tweet->id],
            ]);

        $llm = Mockery::mock(LLMClient::class);
        $llm->shouldReceive('classify')
            ->times(3)
            ->with($tweet->text)
            ->andThrow(new \RuntimeException('API down'));

        $this->instance(LLMClient::class, $llm);

        $job = new PipelineCrawlJob(10);
        $job->handle($crawler, app(TweetClassifierService::class));

        $tweet->refresh();
        $this->assertNull($tweet->signal_score);
        $this->assertFalse($tweet->is_signal);
    }

    public function test_classify_uses_fake_llm_when_mock_llm_enabled(): void
    {
        config(['app.mock_llm' => true]);

        $source = Source::query()->create([
            'type' => 'default',
            'status' => 'active',
            'x_handle' => 'fakekol',
            'account_url' => 'https://twitter.com/fakekol',
            'tenant_id' => 1,
        ]);

        $text = 'Breaking: major API launch today.';
        $tweet = Tweet::query()->create([
            'tweet_id' => '1666666666666666666',
            'source_id' => $source->id,
            'text' => $text,
            'posted_at' => now(),
            'url' => 'https://twitter.com/fakekol/status/1666666666666666666',
            'signal_score' => null,
            'is_signal' => false,
            'tenant_id' => 1,
        ]);

        $crawler = Mockery::mock(TwitterCrawlerService::class);
        $crawler->shouldReceive('crawlSource')
            ->once()
            ->andReturn([
                'success' => true,
                'tweets_count' => 1,
                'new_tweets_count' => 0,
                'message' => 'OK',
                'affected_tweet_ids' => [(int) $tweet->id],
            ]);

        $expected = app(FakeLLMClient::class)->classify($text);

        $job = new PipelineCrawlJob(10);
        $job->handle($crawler, app(TweetClassifierService::class));

        $tweet->refresh();
        $this->assertEquals($expected['signal_score'], (float) $tweet->signal_score);
        $this->assertSame($expected['is_signal'], $tweet->is_signal);
    }

    public function test_classifies_pending_tweets_even_when_crawl_returns_no_new_ids(): void
    {
        config(['app.mock_llm' => true]);

        $source = Source::query()->create([
            'type' => 'default',
            'status' => 'active',
            'x_handle' => 'pendingkol',
            'account_url' => 'https://twitter.com/pendingkol',
            'tenant_id' => 1,
        ]);

        $tweet = Tweet::query()->create([
            'tweet_id' => '1555555555555555555',
            'source_id' => $source->id,
            'text' => 'OpenAI announces GPT-5 with 10x performance improvements.',
            'posted_at' => now(),
            'url' => 'https://twitter.com/pendingkol/status/1555555555555555555',
            'signal_score' => null,
            'is_signal' => false,
            'tenant_id' => 1,
        ]);

        $crawler = Mockery::mock(TwitterCrawlerService::class);
        $crawler->shouldReceive('crawlSource')
            ->once()
            ->andReturn([
                'success' => true,
                'tweets_count' => 0,
                'new_tweets_count' => 0,
                'message' => 'OK',
                'affected_tweet_ids' => [],
            ]);

        $job = new PipelineCrawlJob(10);
        $job->handle($crawler, app(TweetClassifierService::class));

        $tweet->refresh();
        $this->assertNotNull($tweet->signal_score);
    }
}
