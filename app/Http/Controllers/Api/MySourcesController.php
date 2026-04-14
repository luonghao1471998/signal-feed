<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MySourceSubscription;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class MySourcesController extends Controller
{
    /**
     * GET /api/my-sources
     *
     * Return sources subscribed by current user with per-source stats.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $user = $request->user();
        $perPage = (int) ($validated['per_page'] ?? 20);

        $subscriptions = MySourceSubscription::query()
            ->where('user_id', $user->id)
            ->with(['source.categories'])
            ->orderByDesc('created_at')
            ->paginate($perPage);

        $sourceIds = $subscriptions->getCollection()
            ->pluck('source_id')
            ->unique()
            ->values()
            ->all();

        $statsBySource = $this->buildSourceStats($sourceIds);

        $data = $subscriptions->getCollection()->map(function (MySourceSubscription $subscription) use ($statsBySource): array {
            $source = $subscription->source;
            $stats = $statsBySource[$subscription->source_id] ?? [
                'signal_count' => 0,
                'last_active_date' => null,
            ];

            return [
                'id' => $source->id,
                'handle' => '@'.$source->x_handle,
                'display_name' => $source->display_name,
                'account_url' => $source->account_url,
                'categories' => $source->categories->map(static function ($category): array {
                    return [
                        'id' => $category->id,
                        'name' => $category->name,
                    ];
                })->values()->all(),
                'subscribed_at' => $subscription->created_at?->toIso8601String(),
                'stats' => $stats,
            ];
        })->values()->all();

        return response()->json([
            'data' => $data,
            'meta' => [
                'total' => $subscriptions->total(),
                'current_page' => $subscriptions->currentPage(),
                'per_page' => $subscriptions->perPage(),
                'last_page' => $subscriptions->lastPage(),
            ],
        ]);
    }

    /**
     * GET /api/my-sources/stats
     *
     * Return aggregate dashboard statistics for user's subscribed sources.
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $sourceIds = $this->subscribedSourceIds($user->id);

        if ($sourceIds === []) {
            return response()->json([
                'data' => [
                    'total_signals_today' => 0,
                    'top_active_sources' => [],
                    'trend_7day' => $this->emptyTrend7Day(),
                    'per_category_breakdown' => [],
                ],
            ]);
        }

        return response()->json([
            'data' => [
                'total_signals_today' => $this->totalSignalsToday($sourceIds),
                'top_active_sources' => $this->topActiveSources($sourceIds),
                'trend_7day' => $this->trend7Day($sourceIds),
                'per_category_breakdown' => $this->categoryBreakdown($sourceIds),
            ],
        ]);
    }

    /**
     * @return array<int, int>
     */
    private function subscribedSourceIds(int $userId): array
    {
        return MySourceSubscription::query()
            ->where('user_id', $userId)
            ->pluck('source_id')
            ->map(static fn ($id): int => (int) $id)
            ->all();
    }

    /**
     * @param  array<int, int>  $sourceIds
     */
    private function totalSignalsToday(array $sourceIds): int
    {
        return (int) DB::table('signals as sig')
            ->join('signal_sources as ss', 'ss.signal_id', '=', 'sig.id')
            ->whereIn('ss.source_id', $sourceIds)
            ->whereDate('sig.created_at', Carbon::today()->toDateString())
            ->distinct('sig.id')
            ->count('sig.id');
    }

    /**
     * @param  array<int, int>  $sourceIds
     * @return array<int, array{source_id:int,handle:string,display_name:?string,signal_count:int}>
     */
    private function topActiveSources(array $sourceIds): array
    {
        $rows = DB::table('signal_sources as ss')
            ->join('signals as sig', 'sig.id', '=', 'ss.signal_id')
            ->join('sources as src', 'src.id', '=', 'ss.source_id')
            ->whereIn('ss.source_id', $sourceIds)
            ->where('sig.created_at', '>=', Carbon::now()->subDays(7))
            ->groupBy('ss.source_id', 'src.x_handle', 'src.display_name')
            ->orderByDesc(DB::raw('COUNT(DISTINCT sig.id)'))
            ->limit(3)
            ->selectRaw('ss.source_id, src.x_handle, src.display_name, COUNT(DISTINCT sig.id) as signal_count')
            ->get();

        return $rows->map(static function ($row): array {
            return [
                'source_id' => (int) $row->source_id,
                'handle' => '@'.$row->x_handle,
                'display_name' => $row->display_name,
                'signal_count' => (int) $row->signal_count,
            ];
        })->values()->all();
    }

    /**
     * @param  array<int, int>  $sourceIds
     * @return array<int, array{date:string,count:int}>
     */
    private function trend7Day(array $sourceIds): array
    {
        $startDate = Carbon::today()->subDays(6);
        $endDate = Carbon::today()->endOfDay();

        /** @var Collection<string, int> $countsByDate */
        $countsByDate = DB::table('signals as sig')
            ->join('signal_sources as ss', 'ss.signal_id', '=', 'sig.id')
            ->whereIn('ss.source_id', $sourceIds)
            ->whereBetween('sig.created_at', [$startDate, $endDate])
            ->groupBy(DB::raw('DATE(sig.created_at)'))
            ->selectRaw('DATE(sig.created_at) as day, COUNT(DISTINCT sig.id) as signal_count')
            ->pluck('signal_count', 'day')
            ->map(static fn ($count): int => (int) $count);

        $trend = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = Carbon::today()->subDays($i)->toDateString();
            $trend[] = [
                'date' => $date,
                'count' => $countsByDate->get($date, 0),
            ];
        }

        return $trend;
    }

    /**
     * @param  array<int, int>  $sourceIds
     * @return array<int, array{category_id:int,name:string,signal_count:int}>
     */
    private function categoryBreakdown(array $sourceIds): array
    {
        $placeholders = implode(',', array_fill(0, count($sourceIds), '?'));
        $bindings = [...$sourceIds, Carbon::now()->subDays(7)->toDateTimeString()];

        $rows = DB::select(
            "SELECT c.id AS category_id, c.name, COUNT(DISTINCT sig.id) AS signal_count
             FROM signals sig
             JOIN signal_sources ss ON ss.signal_id = sig.id
             JOIN LATERAL unnest(sig.categories) AS cat(category_id) ON TRUE
             JOIN categories c ON c.id = cat.category_id
             WHERE ss.source_id IN ($placeholders)
               AND sig.created_at >= ?
             GROUP BY c.id, c.name
             ORDER BY signal_count DESC",
            $bindings
        );

        return collect($rows)->map(static function ($row): array {
            return [
                'category_id' => (int) $row->category_id,
                'name' => (string) $row->name,
                'signal_count' => (int) $row->signal_count,
            ];
        })->values()->all();
    }

    /**
     * @return array<int, array{date:string,count:int}>
     */
    private function emptyTrend7Day(): array
    {
        $trend = [];
        for ($i = 6; $i >= 0; $i--) {
            $trend[] = [
                'date' => Carbon::today()->subDays($i)->toDateString(),
                'count' => 0,
            ];
        }

        return $trend;
    }

    /**
     * @param  array<int, int>  $sourceIds
     * @return array<int, array{signal_count:int,last_active_date:?string}>
     */
    private function buildSourceStats(array $sourceIds): array
    {
        if ($sourceIds === []) {
            return [];
        }

        $since = now()->subDays(7);

        $signalCounts = DB::table('signal_sources as ss')
            ->join('signals as sig', 'sig.id', '=', 'ss.signal_id')
            ->whereIn('ss.source_id', $sourceIds)
            ->where('sig.created_at', '>=', $since)
            ->groupBy('ss.source_id')
            ->selectRaw('ss.source_id, COUNT(DISTINCT sig.id) as signal_count')
            ->pluck('signal_count', 'ss.source_id')
            ->map(static fn ($value): int => (int) $value)
            ->all();

        $lastActive = DB::table('signal_sources as ss')
            ->join('signals as sig', 'sig.id', '=', 'ss.signal_id')
            ->whereIn('ss.source_id', $sourceIds)
            ->groupBy('ss.source_id')
            ->selectRaw('ss.source_id, MAX(sig.created_at) as last_active_at')
            ->pluck('last_active_at', 'ss.source_id')
            ->all();

        $result = [];
        foreach ($sourceIds as $sourceId) {
            $lastActiveRaw = $lastActive[$sourceId] ?? null;
            $lastActiveDate = null;

            if (is_string($lastActiveRaw) && $lastActiveRaw !== '') {
                $lastActiveDate = \Carbon\Carbon::parse($lastActiveRaw)->toDateString();
            }

            $result[$sourceId] = [
                'signal_count' => $signalCounts[$sourceId] ?? 0,
                'last_active_date' => $lastActiveDate,
            ];
        }

        return $result;
    }
}
