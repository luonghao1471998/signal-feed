<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminModerationSourceResource;
use App\Http\Resources\CategoryResource;
use App\Models\Source;
use App\Services\AdminSourceModerationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class AdminSourceController extends Controller
{
    public function __construct(
        private readonly AdminSourceModerationService $moderationService
    ) {
    }

    /**
     * GET /api/admin/sources
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'type' => 'nullable|in:default,user',
            'status' => 'nullable|in:active,spam,deleted,pending_review',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $perPage = (int) ($request->input('per_page', 20));

        $noiseSql = <<<'SQL'
(CASE
    WHEN sources.created_at > NOW() - INTERVAL '7 days' THEN NULL
    ELSE (
        SELECT ROUND(
            (100.0 * COALESCE(SUM(CASE WHEN t.is_signal = false THEN 1 ELSE 0 END), 0))
            / NULLIF(COUNT(*), 0),
            2
        )
        FROM tweets t
        WHERE t.source_id = sources.id
          AND t.signal_score IS NOT NULL
          AND t.deleted_at IS NULL
    )
END)
SQL;

        $query = Source::query()
            ->select('sources.*')
            ->selectRaw(
                '(SELECT COUNT(DISTINCT ss.signal_id) FROM signal_sources ss WHERE ss.source_id = sources.id) as signal_count'
            )
            ->selectRaw($noiseSql . ' as noise_ratio')
            ->with(['categories', 'addedByUser'])
            ->orderByDesc('sources.created_at');

        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return AdminModerationSourceResource::collection($query->paginate($perPage));
    }

    /**
     * PATCH /api/admin/sources/{id}
     */
    public function update(Request $request, Source $source): JsonResponse
    {
        $validated = $request->validate([
            'action' => 'required|in:flag_spam,adjust_categories,soft_delete,restore',
            'category_ids' => 'required_if:action,adjust_categories|array|min:1',
            'category_ids.*' => 'integer|exists:categories,id',
        ]);

        $action = $validated['action'];

        if ($action === 'flag_spam' && $source->status !== 'active') {
            return response()->json([
                'message' => 'flag_spam is only valid when source status is active.',
            ], 400);
        }

        if ($action === 'soft_delete' && $source->status !== 'active') {
            return response()->json([
                'message' => 'soft_delete is only valid when source status is active.',
            ], 400);
        }

        if ($action === 'restore' && !in_array($source->status, ['spam', 'deleted'], true)) {
            return response()->json([
                'message' => 'restore is only valid when source status is spam or deleted.',
            ], 400);
        }

        if ($action === 'adjust_categories' && $source->status !== 'active') {
            return response()->json([
                'message' => 'adjust_categories is only valid when source status is active.',
            ], 400);
        }

        $categoryIds = $validated['category_ids'] ?? [];

        $updated = $this->moderationService->moderate($source, $action, $categoryIds);

        $this->insertAdminSourceAudit($request, $updated, $action, $categoryIds);

        return response()->json([
            'data' => [
                'id' => $updated->id,
                'status' => $updated->status,
                'categories' => CategoryResource::collection($updated->categories)->resolve($request),
                'updated_at' => $updated->updated_at?->utc()->toIso8601String(),
            ],
        ]);
    }

    /**
     * @param  array<int>  $categoryIds
     */
    private function insertAdminSourceAudit(Request $request, Source $source, string $action, array $categoryIds): void
    {
        try {
            DB::table('audit_logs')->insert([
                'event_type' => 'admin_source_action',
                'user_id' => $request->user()?->id,
                'resource_type' => 'Source',
                'resource_id' => $source->id,
                'changes' => json_encode([
                    'action' => $action,
                    'category_ids' => $categoryIds,
                    'status_after' => $source->status,
                ]),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'tenant_id' => $source->tenant_id ?? 1,
                'created_at' => now()->utc(),
            ]);
        } catch (\Throwable) {
            // non-blocking
        }
    }
}