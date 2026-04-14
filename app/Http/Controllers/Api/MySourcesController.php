<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MySourceSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
