<?php

namespace Tests\Feature;

use App\Jobs\PipelineCrawlJob;
use App\Models\Source;
use App\Models\Tweet;
use App\Services\TwitterCrawlerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Mockery;
use Tests\TestCase;

class PipelineClassifyIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_llm_client_classify_updates_tweet_via_pipeline_job(): void
    {
        config([
            'app.mock_llm' => false,
            'anthropic.api_key' => 'test-key',
        ]);

        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response([
                'id' => 'msg_test',
                'type' => 'message',
                'role' => 'assistant',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => '{"signal_score":0.91,"is_signal":true}',
                    ],
                ],
                'model' => 'claude-test',
                'stop_reason' => 'end_turn',
            ], 200),
        ]);

        $source = Source::query()->create([
            'type' => 'default',
            'status' => 'active',
            'x_handle' => 'inttest',
            'account_url' => 'https://twitter.com/inttest',
            'tenant_id' => 1,
        ]);

        $tweet = Tweet::query()->create([
            'tweet_id' => '1777777777777777777',
            'source_id' => $source->id,
            'text' => 'Series B closed at 40M for our AI infra startup.',
            'posted_at' => now(),
            'url' => 'https://twitter.com/inttest/status/1777777777777777777',
            'signal_score' => 0,
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

        $job = new PipelineCrawlJob(10);
        $job->handle($crawler);

        $tweet->refresh();
        $this->assertEquals(0.91, (float) $tweet->signal_score);
        $this->assertTrue($tweet->is_signal);

        Http::assertSentCount(1);
    }
}
