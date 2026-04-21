<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Signal;
use App\Models\UserArchivedSignal;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Schema;

class ArchiveController extends Controller
{
    /**
     * GET /api/archive/signals — list current user's archived signals.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'date_range' => 'nullable|in:today,yesterday,last7,last30',
            'category_id' => 'nullable|array',
            'category_id.*' => 'integer|exists:categories,id',
            'search' => 'nullable|string|max:100',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:50',
        ]);

        $query = Signal::query()
            ->join('user_archived_signals as uas', 'signals.id', '=', 'uas.signal_id')
            ->where('uas.user_id', $user->id)
            ->select('signals.*', 'uas.created_at as archived_at')
            ->with(['digest', 'sources']);

        if ($request->filled('date_range')) {
            $this->applyDateRangeFilter($query, (string) $request->input('date_range'));
        }

        if ($request->filled('category_id')) {
            /** @var list<int> $categoryIds */
            $categoryIds = array_map('intval', $request->input('category_id', []));
            if ($categoryIds !== []) {
                $literal = '{'.implode(',', $categoryIds).'}';
                $query->whereRaw('signals.categories && ?::integer[]', [$literal]);
            }
        }

        if ($request->filled('search')) {
            $term = '%'.$request->string('search')->toString().'%';
            $query->where(static function (Builder $q) use ($term): void {
                $q->where('signals.title', 'ilike', $term)
                    ->orWhere('signals.summary', 'ilike', $term);
            });
        }

        $query->orderByDesc('uas.created_at');

        $perPage = (int) $request->input('per_page', 20);
        $results = $query->paginate($perPage)->withQueryString();

        $data = collect($results->items())->map(function (Signal $signal): array {
            return [
                'id' => $signal->id,
                'title' => $signal->title,
                'summary' => $signal->summary,
                'source_count' => (int) $signal->source_count,
                'categories' => $signal->categories,
                'topic_tags' => $signal->topic_tags,
                'sources' => $signal->sources->map(static function ($source): array {
                    $handle = (string) $source->x_handle;
                    if ($handle !== '' && ! str_starts_with($handle, '@')) {
                        $handle = '@'.$handle;
                    }

                    return [
                        'handle' => $handle,
                        'display_name' => $source->display_name,
                        'avatar_url' => $source->avatar_url,
                    ];
                })->values()->all(),
                'date' => $this->signalDisplayDate($signal),
                'archived_at' => $signal->archived_at !== null
                    ? Carbon::parse($signal->archived_at)->toIso8601String()
                    : null,
            ];
        })->values()->all();

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $results->currentPage(),
                'per_page' => $results->perPage(),
                'total' => $results->total(),
                'last_page' => $results->lastPage(),
            ],
        ]);
    }

    /**
     * POST /api/signals/{id}/archive — save signal to personal archive (idempotent).
     */
    public function store(Request $request, int $id): JsonResponse
    {
        $signal = Signal::query()->find($id);

        if (! $signal) {
            return response()->json([
                'error' => [
                    'code' => 'NOT_FOUND',
                    'message' => 'Signal not found',
                ],
            ], 404);
        }

        $user = $request->user();
        $tenantId = (int) ($user->tenant_id ?? 1);

        $archived = UserArchivedSignal::query()->firstOrCreate(
            [
                'user_id' => $user->id,
                'signal_id' => $id,
            ],
            [
                'tenant_id' => $tenantId,
            ]
        );

        $wasNew = $archived->wasRecentlyCreated;
        if ($wasNew) {
            $archived->refresh();
        }

        $statusCode = $wasNew ? 201 : 200;

        return response()->json([
            'data' => [
                'signal_id' => $archived->signal_id,
                'archived_at' => $archived->created_at?->toIso8601String(),
            ],
        ], $statusCode);
    }

    /**
     * DELETE /api/signals/{id}/archive — remove from archive (idempotent).
     */
    public function destroy(Request $request, int $id): Response
    {
        UserArchivedSignal::query()
            ->where('user_id', $request->user()->id)
            ->where('signal_id', $id)
            ->delete();

        return response()->noContent();
    }

    private function applyDateRangeFilter(Builder $query, string $dateRange): void
    {
        $now = Carbon::now();

        match ($dateRange) {
            'today' => $query->whereBetween('uas.created_at', [
                $now->copy()->startOfDay(),
                $now->copy()->endOfDay(),
            ]),
            'yesterday' => $query->whereBetween('uas.created_at', [
                $now->copy()->subDay()->startOfDay(),
                $now->copy()->subDay()->endOfDay(),
            ]),
            'last7' => $query->where('uas.created_at', '>=', $now->copy()->subDays(7)),
            'last30' => $query->where('uas.created_at', '>=', $now->copy()->subDays(30)),
            default => null,
        };
    }

    private function signalDisplayDate(Signal $signal): ?string
    {
        if (Schema::hasColumn('signals', 'date')) {
            $raw = $signal->getAttributes()['date'] ?? null;
            if ($raw !== null) {
                return Carbon::parse($raw)->toDateString();
            }
        }

        if ($signal->relationLoaded('digest') && $signal->digest) {
            return $signal->digest->date?->toDateString();
        }

        return $signal->created_at?->toDateString();
    }
}
