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
    /**
     * Browse platform source pool (wedge: no pagination / filters).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $sources = Source::query()
            ->where('status', 'active')
            ->with('categories')
            ->orderBy('id')
            ->get();

        $subscribedIds = [];
        $authUser = Auth::guard('sanctum')->user() ?? $request->user();
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
        if (!in_array($user->plan, ['pro', 'power'], true)) {
            return response()->json([
                'message' => 'This feature requires Pro or Power plan',
            ], 403);
        }

        $xHandle = ltrim($validated['handle'], '@');
        $displayName = $validated['display_name'] ?? $xHandle;
        $categoryIds = array_values(array_unique($validated['category_ids']));
        $tenantId = (int) ($user->tenant_id ?? 1);

        $source = DB::transaction(function () use ($user, $xHandle, $displayName, $categoryIds, $tenantId) {
            $accountUrl = 'https://x.com/' . $xHandle;

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
                'handle' => '@' . $source->x_handle,
                'display_name' => $source->display_name,
                'account_url' => $source->account_url,
                'type' => $source->type,
                'status' => $source->status,
                'categories' => $source->categories->map(static fn($cat) => [
                    'id' => $cat->id,
                    'name' => $cat->name,
                ])->values()->all(),
                'is_subscribed' => false,
            ],
        ], 201);
    }
}