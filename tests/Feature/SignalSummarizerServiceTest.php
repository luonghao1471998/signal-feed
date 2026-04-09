<?php

namespace Tests\Feature;

use App\Models\Source;
use App\Models\Tweet;
use App\Services\SignalSummarizerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SignalSummarizerServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_summarize_cluster_returns_valid_structure(): void
    {
        $source = Source::create([
            'type' => 'default',
            'status' => 'active',
            'x_handle' => 'openai',
            'account_url' => 'https://x.com/openai',
            'tenant_id' => 1,
        ]);

        $t1 = Tweet::create([
            'tweet_id' => 'svc_test_t1',
            'source_id' => $source->id,
            'text' => 'OpenAI launches GPT-5 with API access',
            'posted_at' => now(),
            'url' => 'https://x.com/openai/status/svc_test_t1',
            'signal_score' => 0.9,
            'is_signal' => true,
            'tenant_id' => 1,
        ]);
        $t2 = Tweet::create([
            'tweet_id' => 'svc_test_t2',
            'source_id' => $source->id,
            'text' => 'GPT-5 pricing set at $0.03 per 1K tokens',
            'posted_at' => now(),
            'url' => 'https://x.com/openai/status/svc_test_t2',
            'signal_score' => 0.9,
            'is_signal' => true,
            'tenant_id' => 1,
        ]);

        $cluster = [
            'cluster_id' => 'test_cluster_1',
            'tweet_ids' => [(int) $t1->id, (int) $t2->id],
            'topic' => 'GPT-5 Launch',
        ];

        $tweets = Tweet::whereIn('id', [$t1->id, $t2->id])->get();

        $service = app(SignalSummarizerService::class);
        $result = $service->summarizeCluster($cluster, $tweets);

        $this->assertNotNull($result);
        $this->assertSame('test_cluster_1', $result['cluster_id']);
        $this->assertArrayHasKey('title', $result);
        $this->assertArrayHasKey('summary', $result);
        $this->assertArrayHasKey('topic_tags', $result);
        $this->assertArrayHasKey('source_count', $result);
        $this->assertArrayHasKey('tweet_ids', $result);

        $this->assertLessThanOrEqual(200, strlen($result['title']));
        $this->assertGreaterThan(0, str_word_count($result['summary']));
        $this->assertIsArray($result['topic_tags']);
        $this->assertGreaterThanOrEqual(1, count($result['topic_tags']));
        $this->assertLessThanOrEqual(3, count($result['topic_tags']));
        $this->assertSame(1, $result['source_count']);
    }
}
