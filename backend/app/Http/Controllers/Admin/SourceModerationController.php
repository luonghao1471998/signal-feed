<?php

namespace App\Http\Controllers\Admin;

use App\Events\SourceModerated;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminSourceResource;
use App\Models\Source;
use App\Models\User;
use App\Services\AdminSourceModerationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Auth;

class SourceModerationController extends Controller
{
    public function __construct(
        private readonly AdminSourceModerationService $moderationService,
    ) {
    }

    /**
     * GET /admin/api/sources
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'type' => 'nullable|in:default,user',
            'status' => 'nullable|in:active,spam,deleted,pending_review',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $status = $request->input('status', 'pending_review');
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
            ->with(['categories', 'addedBy'])
            ->orderByDesc('sources.created_at');

        $query->where('status', $status);

        if ($request->query('type') === 'user') {
            $query->whereNotNull('added_by_user_id');
        } elseif ($request->query('type') === 'default') {
            $query->whereNull('added_by_user_id');
        }

        return AdminSourceResource::collection($query->paginate($perPage));
    }

    /**
     * PATCH /admin/api/sources/{id}
     */
    public function moderate(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'action' => 'required|in:approve,flag_spam,soft_delete,restore,adjust_categories',
            'category_ids' => 'required_if:action,adjust_categories|array|min:1',
            'category_ids.*' => 'integer|exists:categories,id',
        ]);

        $source = Source::query()->findOrFail($id);
        $action = $validated['action'];
        $oldStatus = $source->status;

        if ($action === 'restore' && ! in_array($source->status, ['deleted', 'spam'], true)) {
            return response()->json([
                'message' => 'restore is only valid when source status is spam or deleted.',
            ], 400);
        }

        $categoryIds = $validated['category_ids'] ?? [];

        $updated = $this->moderationService->moderate($source, $action, $categoryIds);
        $updated->loadMissing('categories');
        $newStatus = $updated->status;

        $admin = Auth::guard('admin')->user();
        if ($admin !== null) {
            $admin->logAction('source.' . $action, 'source', $updated->id, [
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
                'category_ids' => $categoryIds,
            ]);
        }

        if (in_array($action, ['approve', 'flag_spam', 'soft_delete'], true) && $updated->added_by_user_id !== null) {
            $submitter = User::query()->find($updated->added_by_user_id);
            if ($submitter !== null) {
                event(new SourceModerated($updated, $action, $submitter));
            }
        }

        return response()->json([
            'data' => [
                'id' => $updated->id,
                'x_handle' => $updated->x_handle,
                'status' => $updated->status,
                'category_ids' => $updated->categories->pluck('id')->values()->all(),
                'updated_at' => $updated->updated_at?->utc()->toIso8601String(),
            ],
        ]);
    }
}
