<?php

namespace App\Services;

use App\Models\Signal;
use App\Models\Source;
use App\Models\Tweet;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class AdminPipelineMetricsService
{
    /**
     * @return array{
     *     last_run_timestamp: string|null,
     *     tweets_fetched_count: int,
     *     signals_created_count: int,
     *     per_category_signal_volume: list<array{category_id: int, category_name: string, signal_count: int}>
     * }
     */
    public function snapshotToday(): array
    {
        $today = CarbonImmutable::today('UTC');

        return $this->snapshotForRange(
            $today->toDateString(),
            $today->toDateString()
        );
    }

    /**
     * @return array{
     *     last_run_timestamp: string|null,
     *     tweets_fetched_count: int,
     *     signals_created_count: int,
     *     per_category_signal_volume: list<array{category_id: int, category_name: string, signal_count: int}>
     * }
     */
    public function snapshotForRange(?string $startDate, ?string $endDate): array
    {
        $start = $startDate !== null
            ? CarbonImmutable::parse($startDate, 'UTC')->startOfDay()
            : CarbonImmutable::today('UTC')->startOfDay();
        $end = $endDate !== null
            ? CarbonImmutable::parse($endDate, 'UTC')->endOfDay()
            : CarbonImmutable::today('UTC')->endOfDay();

        $lastCrawl = Source::query()->max('last_crawled_at');
        $lastRun = $lastCrawl !== null ? Carbon::parse($lastCrawl)->utc()->toIso8601String() : null;

        $tweetsInRange = Tweet::query()
            ->whereBetween('created_at', [$start->toDateTimeString(), $end->toDateTimeString()])
            ->count();
        $signalsInRange = Signal::query()
            ->whereBetween('created_at', [$start->toDateTimeString(), $end->toDateTimeString()])
            ->count();

        $perCategory = $this->perCategorySignalVolume($start, $end);

        return [
            'last_run_timestamp' => $lastRun,
            'tweets_fetched_count' => $tweetsInRange,
            'signals_created_count' => $signalsInRange,
            'per_category_signal_volume' => $perCategory,
        ];
    }

    /**
     * @return list<array{category_id: int, category_name: string, signal_count: int}>
     */
    private function perCategorySignalVolume(CarbonImmutable $start, CarbonImmutable $end): array
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
            WHERE s.created_at >= ?::timestamp
              AND s.created_at <= ?::timestamp
              AND s.tenant_id = ?
            GROUP BY c.id, c.name
            ORDER BY c.id
        ',
            [$start->toDateTimeString(), $end->toDateTimeString(), $tenantId]
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
