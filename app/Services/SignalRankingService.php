<?php

namespace App\Services;

use App\Models\Signal;
use App\Models\Tweet;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Task 1.9.1 — rank_score theo SPEC-core §2.2a (multi-factor).
 */
class SignalRankingService
{
    private const WEIGHT_SOURCE = 0.4;

    private const WEIGHT_QUALITY = 0.3;

    private const WEIGHT_RECENCY = 0.3;

    private const RECENCY_HALF_LIFE_HOURS = 24;

    private const SOURCE_LOG_DENOMINATOR = 6;

    private const QUALITY_FALLBACK = 0.5;

    /**
     * Tính rank_score (0–1), ghi DB, trả về giá trị đã làm tròn.
     */
    public function calculateRankScore(Signal $signal): float
    {
        $sourceScore = $this->calculateSourceScore((int) $signal->source_count);
        $qualityScore = $this->calculateQualityScore($signal);
        $createdAt = $signal->created_at instanceof Carbon
            ? $signal->created_at
            : Carbon::parse((string) $signal->created_at);
        $recencyScore = $this->calculateRecencyScore($createdAt);

        $rank = self::WEIGHT_SOURCE * $sourceScore
            + self::WEIGHT_QUALITY * $qualityScore
            + self::WEIGHT_RECENCY * $recencyScore;

        $rank = max(0.0, min(1.0, $rank));
        $rank = round($rank, 4);

        $signal->update(['rank_score' => (string) $rank]);

        Log::channel('crawler')->info('SignalRankingService: rank calculated', [
            'signal_id' => $signal->id,
            'rank_score' => $rank,
            'source_score' => round($sourceScore, 4),
            'quality_score' => round($qualityScore, 4),
            'recency_score' => round($recencyScore, 4),
        ]);

        return $rank;
    }

    /**
     * @param  Collection<int, Signal>  $signals
     */
    public function rankAllSignals(Collection $signals): void
    {
        $signals->load(['tweets' => function ($q): void {
            $q->select(['tweets.id', 'tweets.signal_score']);
        }]);

        foreach ($signals as $signal) {
            try {
                $this->calculateRankScore($signal);
            } catch (\Throwable $e) {
                Log::channel('crawler-errors')->error('SignalRankingService: rank failed', [
                    'signal_id' => $signal->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * log(source_count + 1) / log(6), capped at 1.0 (SPEC Task 1.9.1).
     */
    private function calculateSourceScore(int $sourceCount): float
    {
        $sourceCount = max(0, $sourceCount);
        $numerator = log($sourceCount + 1);
        $denominator = log(self::SOURCE_LOG_DENOMINATOR);

        if ($denominator <= 0.0) {
            return 0.0;
        }

        return min(1.0, $numerator / $denominator);
    }

    /**
     * Trung bình signal_score của tweet gắn qua signal_sources; fallback 0.5.
     */
    private function calculateQualityScore(Signal $signal): float
    {
        if ($signal->relationLoaded('tweets')) {
            $scores = $signal->tweets->pluck('signal_score')->filter(fn ($v) => $v !== null);

            if ($scores->isEmpty()) {
                return self::QUALITY_FALLBACK;
            }

            return max(0.0, min(1.0, (float) $scores->avg()));
        }

        $tweetIds = DB::table('signal_sources')
            ->where('signal_id', $signal->id)
            ->pluck('tweet_id');

        if ($tweetIds->isEmpty()) {
            return self::QUALITY_FALLBACK;
        }

        $avg = Tweet::query()
            ->whereIn('id', $tweetIds)
            ->whereNotNull('signal_score')
            ->avg('signal_score');

        if ($avg === null) {
            return self::QUALITY_FALLBACK;
        }

        return max(0.0, min(1.0, (float) $avg));
    }

    /**
     * exp(-hours / 24), hours ≥ 0 (clock skew → coi như 0h).
     */
    private function calculateRecencyScore(Carbon $createdAt): float
    {
        $hours = $this->hoursSinceCreation($createdAt);

        return exp(-$hours / self::RECENCY_HALF_LIFE_HOURS);
    }

    private function hoursSinceCreation(Carbon $createdAt): float
    {
        $now = now();
        $seconds = $now->getTimestamp() - $createdAt->getTimestamp();

        if ($seconds < 0) {
            Log::channel('crawler')->warning('SignalRankingService: created_at in future, treating as 0h', [
                'created_at' => $createdAt->toIso8601String(),
            ]);

            return 0.0;
        }

        return $seconds / 3600.0;
    }
}
