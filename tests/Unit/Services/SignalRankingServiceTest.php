<?php

namespace Tests\Unit\Services;

use App\Models\Digest;
use App\Models\Signal;
use App\Models\Source;
use App\Models\Tweet;
use App\Services\SignalRankingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SignalRankingServiceTest extends TestCase
{
    use RefreshDatabase;

    private SignalRankingService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(SignalRankingService::class);
    }

    public function test_calculate_rank_score_matches_spec_formula(): void
    {
        $source = Source::query()->create([
            'type' => 'default',
            'status' => 'active',
            'x_handle' => 'ranktest',
            'account_url' => 'https://x.com/ranktest',
            'tenant_id' => 1,
        ]);

        $digest = Digest::query()->create([
            'date' => now()->toDateString(),
            'title' => 'Test',
            'total_signals' => 0,
            'tenant_id' => 1,
        ]);

        $t1 = Tweet::query()->create([
            'tweet_id' => 'rank_t1',
            'source_id' => $source->id,
            'text' => 'A',
            'posted_at' => now(),
            'url' => 'https://x.com/ranktest/status/rank_t1',
            'signal_score' => 0.8,
            'is_signal' => true,
            'tenant_id' => 1,
        ]);
        $t2 = Tweet::query()->create([
            'tweet_id' => 'rank_t2',
            'source_id' => $source->id,
            'text' => 'B',
            'posted_at' => now(),
            'url' => 'https://x.com/ranktest/status/rank_t2',
            'signal_score' => 0.9,
            'is_signal' => true,
            'tenant_id' => 1,
        ]);

        $signal = Signal::query()->create([
            'digest_id' => $digest->id,
            'cluster_id' => 'c_test_rank',
            'title' => 'Test signal',
            'summary' => 'Summary',
            'source_count' => 2,
            'rank_score' => 0,
            'impact_score' => 0,
            'tenant_id' => 1,
        ]);

        DB::table('signal_sources')->insert([
            [
                'signal_id' => $signal->id,
                'source_id' => $source->id,
                'tweet_id' => $t1->id,
                'tenant_id' => 1,
                'created_at' => now(),
            ],
            [
                'signal_id' => $signal->id,
                'source_id' => $source->id,
                'tweet_id' => $t2->id,
                'tenant_id' => 1,
                'created_at' => now(),
            ],
        ]);

        $signal->forceFill(['created_at' => now()->subHours(2)])->save();

        $sourceScore = min(1.0, log(2 + 1) / log(6));
        $qualityScore = 0.85;
        $recencyScore = exp(-2 / 24);
        $expected = round(max(0.0, min(1.0,
            0.4 * $sourceScore + 0.3 * $qualityScore + 0.3 * $recencyScore
        )), 4);

        $rank = $this->service->calculateRankScore($signal->fresh());

        $this->assertEqualsWithDelta($expected, $rank, 0.0001);
        $this->assertGreaterThan(0.0, $rank);
        $this->assertLessThanOrEqual(1.0, $rank);

        $signal->refresh();
        $this->assertEqualsWithDelta($expected, (float) $signal->rank_score, 0.0001);
    }
}
