<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SourceResource;
use App\Models\MySourceSubscription;
use App\Models\Source;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class SourceController extends Controller
{
    private const SOURCES_PER_PAGE = 20;

    /**
     * Browse platform source pool (wedge: no pagination / filters).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'search' => 'nullable|string|max:100',
            'category_id' => 'nullable|integer|exists:categories,id',
            'onboarding' => 'nullable|boolean',
            'my_categories_only' => 'nullable|boolean',
            'per_page' => 'nullable|integer|min:1|max:50',
        ]);

        $authUser = Auth::guard('sanctum')->user() ?? $request->user();
        $query = Source::query()
            ->where('status', 'active')
            ->with('categories')
            ->orderBy('id');

        $search = $validated['search'] ?? null;
        if (is_string($search) && trim($search) !== '') {
            $searchTerm = ltrim(trim($search), '@');

            if ($searchTerm !== '') {
                $query->where(static function ($subQuery) use ($searchTerm): void {
                    $pattern = '%'.$searchTerm.'%';
                    $subQuery->where('x_handle', 'ILIKE', $pattern)
                        ->orWhere('display_name', 'ILIKE', $pattern);
                });
            }
        }

        $categoryId = $validated['category_id'] ?? null;
        if (is_int($categoryId)) {
            $query->whereHas('categories', static function ($categoryQuery) use ($categoryId): void {
                $categoryQuery->where('categories.id', $categoryId);
            });
        }

        $onboarding = filter_var($validated['onboarding'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $myCategoriesOnly = filter_var($validated['my_categories_only'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($onboarding && $myCategoriesOnly && $authUser) {
            $userCategoryIds = array_values(array_filter(
                (array) ($authUser->my_categories ?? []),
                static fn ($id): bool => is_int($id) || ctype_digit((string) $id)
            ));

            if ($userCategoryIds === []) {
                $query->whereRaw('1 = 0');
            } else {
                $userCategoryIds = array_map(static fn ($id): int => (int) $id, $userCategoryIds);
                $query->whereHas('categories', static function ($categoryQuery) use ($userCategoryIds): void {
                    $categoryQuery->whereIn('categories.id', $userCategoryIds);
                });
            }
        }

        $perPage = (int) ($validated['per_page'] ?? 0);
        if ($perPage > 0) {
            $query->limit($perPage);
        }

        $sources = $query->get();

        $subscribedIds = [];
        if ($authUser) {
            $subscribedIds = MySourceSubscription::query()
                ->where('user_id', $authUser->id)
                ->pluck('source_id')
                ->all();
        }

        $subscribedSet = array_flip($subscribedIds);
        $sources->each(function (Source $source) use ($subscribedSet): void {
            $source->setAttribute('is_subscribed', isset($subscribedSet[$source->id]));
        });

        return SourceResource::collection($sources);
    }

    /**
     * POST /api/sources — Pro/Power: add user-generated source (Option B: pending admin review).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'handle' => [
                'required',
                'string',
                'regex:/^@[A-Za-z0-9_]{1,15}$/',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $xHandle = ltrim((string) $value, '@');
                    if (Source::query()->where('x_handle', $xHandle)->exists()) {
                        $fail('The handle has already been taken.');
                    }
                },
            ],
            'display_name' => 'nullable|string|max:255',
            'category_ids' => 'required|array|min:1',
            'category_ids.*' => 'integer|exists:categories,id',
        ]);

        $user = $request->user();
        if (! in_array($user->plan, ['pro', 'power'], true)) {
            return response()->json([
                'message' => 'This feature requires Pro or Power plan',
            ], 403);
        }

        $xHandle = ltrim($validated['handle'], '@');
        $displayName = $validated['display_name'] ?? $xHandle;
        $categoryIds = array_values(array_unique($validated['category_ids']));
        $tenantId = (int) ($user->tenant_id ?? 1);

        $source = DB::transaction(function () use ($user, $xHandle, $displayName, $categoryIds, $tenantId) {
            $accountUrl = 'https://x.com/'.$xHandle;

            $source = Source::create([
                'type' => 'user',
                'status' => 'pending_review',
                'x_handle' => $xHandle,
                'x_user_id' => null,
                'display_name' => $displayName,
                'account_url' => $accountUrl,
                'last_crawled_at' => null,
                'added_by_user_id' => $user->id,
                'tenant_id' => $tenantId,
            ]);

            $attach = [];
            foreach ($categoryIds as $categoryId) {
                $attach[$categoryId] = [
                    'tenant_id' => $tenantId,
                    'created_at' => now(),
                ];
            }
            $source->categories()->attach($attach);

            $source->load('categories');

            return $source;
        });

        return response()->json([
            'data' => [
                'id' => $source->id,
                'handle' => '@'.$source->x_handle,
                'display_name' => $source->display_name,
                'account_url' => $source->account_url,
                'type' => $source->type,
                'status' => $source->status,
                'categories' => $source->categories->map(static fn ($cat) => [
                    'id' => $cat->id,
                    'name' => $cat->name,
                ])->values()->all(),
                'is_subscribed' => false,
            ],
        ], 201);
    }

    /**
     * GET /api/sources/my-submissions — list current user's submitted sources (Pro/Power only).
     */
    public function mySubmissions(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! in_array($user->plan, ['pro', 'power'], true)) {
            return response()->json([
                'message' => 'This feature requires Pro or Power plan',
            ], 403);
        }

        $sources = Source::query()
            ->withTrashed()
            ->where('type', 'user')
            ->where('added_by_user_id', $user->id)
            ->with('categories')
            ->orderByDesc('created_at')
            ->paginate(self::SOURCES_PER_PAGE);

        $sourceIds = $sources->getCollection()
            ->pluck('id')
            ->all();

        $subscribedIds = [];
        if ($sourceIds !== []) {
            $subscribedIds = MySourceSubscription::query()
                ->where('user_id', $user->id)
                ->whereIn('source_id', $sourceIds)
                ->pluck('source_id')
                ->all();
        }
        $subscribedSet = array_flip($subscribedIds);

        $data = $sources->getCollection()->map(
            static fn (Source $source): array => [
                'id' => $source->id,
                'handle' => '@'.$source->x_handle,
                'display_name' => $source->display_name,
                'account_url' => $source->account_url,
                'status' => $source->status,
                'categories' => $source->categories->map(static fn ($category): array => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                ])->values()->all(),
                'submitted_at' => optional($source->created_at)?->toISOString(),
                'is_subscribed' => isset($subscribedSet[$source->id]),
            ]
        )->values();

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $sources->currentPage(),
                'total' => $sources->total(),
                'per_page' => $sources->perPage(),
                'last_page' => $sources->lastPage(),
            ],
        ]);
    }
}
