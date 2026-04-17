<?php

namespace App\Services;

use App\Models\Signal;
use App\Models\Source;
use App\Models\Tweet;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AdminPipelineMetricsService
{
    /**
     * @return array{
     *     last_run_timestamp: string|null,
     *     tweets_fetched_count: int,
     *     signals_created_count: int,
     *     error_rate: float,
     *     per_category_signal_volume: list<array{category_id: int, category_name: string, signal_count: int}>
     * }
     */
    public function snapshotToday(): array
    {
        $today = Carbon::today();

        $lastCrawl = Source::query()->max('last_crawled_at');
        $lastRun = $lastCrawl !== null ? Carbon::parse($lastCrawl)->utc()->toIso8601String() : null;

        $tweetsToday = Tweet::query()->whereDate('created_at', $today)->count();
        $signalsToday = Signal::query()->whereDate('created_at', $today)->count();

        $perCategory = $this->perCategorySignalVolume($today);

        return [
            'last_run_timestamp' => $lastRun,
            'tweets_fetched_count' => $tweetsToday,
            'signals_created_count' => $signalsToday,
            'error_rate' => 0.0,
            'per_category_signal_volume' => $perCategory,
        ];
    }

    /**
     * @return list<array{category_id: int, category_name: string, signal_count: int}>
     */
    private function perCategorySignalVolume(Carbon $date): array
    {
        $tenantId = 1;

        $rows = DB::select(
            '
            SELECT c.id AS category_id,
                   c.name AS category_name,
                   COUNT(DISTINCT s.id)::int AS signal_count
            FROM signals s
            CROSS JOIN LATERAL unnest(s.categories) AS cid
            INNER JOIN categories c ON c.id = cid
            WHERE (s.created_at AT TIME ZONE \'UTC\')::date = ?::date
              AND s.tenant_id = ?
            GROUP BY c.id, c.name
            ORDER BY c.id
        ',
            [$date->toDateString(), $tenantId]
        );

        $out = [];
        foreach ($rows as $row) {
            $out[] = [
                'category_id' => (int) $row->category_id,
                'category_name' => (string) $row->category_name,
                'signal_count' => (int) $row->signal_count,
            ];
        }

        return $out;
    }
}
