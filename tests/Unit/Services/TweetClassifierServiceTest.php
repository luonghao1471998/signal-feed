<?php

namespace Tests\Unit\Services;

use App\Models\Source;
use App\Models\Tweet;
use App\Services\TweetClassifierService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TweetClassifierServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_classify_tweet_applies_signal_threshold_from_score(): void
    {
        config([
            'app.mock_llm' => false,
            'anthropic.api_key' => 'test-key',
            'signalfeed.signal_threshold' => 0.6,
        ]);

        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response([
                'id' => 'msg_1',
                'type' => 'message',
                'role' => 'assistant',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => '{"signal_score":0.55,"is_signal":true}',
                    ],
                ],
                'model' => 'claude-test',
                'stop_reason' => 'end_turn',
            ], 200),
        ]);

        $source = Source::query()->create([
            'type' => 'default',
            'status' => 'active',
            'x_handle' => 'svc',
            'account_url' => 'https://twitter.com/svc',
            'tenant_id' => 1,
        ]);

        $tweet = Tweet::query()->create([
            'tweet_id' => '1444444444444444444',
            'source_id' => $source->id,
            'text' => 'Some tweet body.',
            'posted_at' => now(),
            'url' => 'https://twitter.com/svc/status/1444444444444444444',
            'signal_score' => null,
            'is_signal' => false,
            'tenant_id' => 1,
        ]);

        $service = app(TweetClassifierService::class);
        $result = $service->classifyTweet($tweet);

        $this->assertEquals(0.55, $result['signal_score']);
        $this->assertFalse($result['is_signal']);

        Http::assertSentCount(1);
    }

    public function test_classify_pending_updates_rows_with_null_signal_score(): void
    {
        config([
            'app.mock_llm' => false,
            'anthropic.api_key' => 'test-key',
            'signalfeed.signal_threshold' => 0.6,
            'signalfeed.classify_batch_size' => 10,
            'signalfeed.classify_lookback_hours' => 24,
        ]);

        Http::fake([
            'api.anthropic.com/v1/messages' => Http::response([
                'id' => 'msg_2',
                'type' => 'message',
                'role' => 'assistant',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => '{"signal_score":0.9,"is_signal":true}',
                    ],
                ],
                'model' => 'claude-test',
                'stop_reason' => 'end_turn',
            ], 200),
        ]);

        $source = Source::query()->create([
            'type' => 'default',
            'status' => 'active',
            'x_handle' => 'svc2',
            'account_url' => 'https://twitter.com/svc2',
            'tenant_id' => 1,
        ]);

        Tweet::query()->create([
            'tweet_id' => '1333333333333333333',
            'source_id' => $source->id,
            'text' => 'Major acquisition announced.',
            'posted_at' => now(),
            'url' => 'https://twitter.com/svc2/status/1333333333333333333',
            'signal_score' => null,
            'is_signal' => false,
            'tenant_id' => 1,
        ]);

        $stats = app(TweetClassifierService::class)->classifyPendingTweets();

        $this->assertSame(1, $stats['scanned']);
        $this->assertSame(1, $stats['classified']);
        $this->assertSame(0, $stats['failed']);
        $this->assertSame(1, $stats['signals']);
        $this->assertSame(1, Tweet::query()->whereNotNull('signal_score')->count());
    }
}
