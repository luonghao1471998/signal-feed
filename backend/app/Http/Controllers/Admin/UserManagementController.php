<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserManagementController extends Controller
{
    public function show(int $id): JsonResponse
    {
        $user = User::query()->findOrFail($id);

        return response()->json([
            'data' => [
                'id' => $user->id,
                'x_username' => $user->x_username,
                'display_name' => $user->display_name,
                'email' => $user->email,
                'plan' => $user->plan,
                'locale' => $user->locale,
                'my_category_ids' => $user->my_categories ?? [],
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'display_name' => ['nullable', 'string'],
            'plan' => ['nullable', Rule::in(['free', 'pro', 'power'])],
            'category_id' => ['nullable', 'integer'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = User::query();
        if (! empty($validated['display_name'])) {
            $query->where('display_name', 'ILIKE', '%' . $validated['display_name'] . '%');
        }

        if (! empty($validated['plan'])) {
            $query->where('plan', $validated['plan']);
        }

        if (! empty($validated['category_id'])) {
            $query->whereRaw('? = ANY(my_categories)', [(int) $validated['category_id']]);
        }

        $perPage = (int) ($validated['per_page'] ?? 20);
        $users = $query->orderByDesc('created_at')->paginate($perPage);
        $categoryMap = Category::query()->pluck('name', 'id');

        $data = $users->getCollection()->map(function (User $user) use ($categoryMap): array {
            $categoryNames = collect($user->my_categories ?? [])
                ->map(fn (int $id) => $categoryMap->get($id))
                ->filter()
                ->values()
                ->all();

            return [
                'id' => $user->id,
                'x_username' => $user->x_username,
                'display_name' => $user->display_name,
                'email' => $user->email,
                'plan' => $user->plan,
                'locale' => $user->locale,
                'my_categories' => $categoryNames,
                'my_category_ids' => $user->my_categories ?? [],
                'created_at' => $user->created_at?->format('Y-m-d H:i:s'),
            ];
        });

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
            'filters' => [
                'categories' => Category::query()->orderBy('name')->get(['id', 'name']),
            ],
        ]);
    }

    public function suspend(int $id): JsonResponse
    {
        $user = User::query()->findOrFail($id);
        $user->plan = 'free';
        $user->save();

        return response()->json(['message' => 'OK']);
    }

    public function activate(int $id): JsonResponse
    {
        $user = User::query()->findOrFail($id);
        if ($user->plan === 'free') {
            $user->plan = 'pro';
            $user->save();
        }

        return response()->json(['message' => 'OK']);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::query()->findOrFail($id);
        $validated = $request->validate([
            'plan' => ['sometimes', Rule::in(['free', 'pro', 'power'])],
            'locale' => ['sometimes', Rule::in(['en', 'vi'])],
            'my_category_ids' => ['sometimes', 'array'],
            'my_category_ids.*' => ['integer', 'exists:categories,id'],
            'display_name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
        ]);

        if (array_key_exists('my_category_ids', $validated)) {
            $user->my_categories = $validated['my_category_ids'];
            unset($validated['my_category_ids']);
        }

        $user->fill($validated);
        $user->save();

        return response()->json(['message' => 'OK']);
    }
}
