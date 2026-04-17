<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Source;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SourceManagementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'display_name' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['pending_review', 'active', 'spam', 'deleted'])],
            'type' => ['nullable', Rule::in(['default', 'user'])],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Source::query()
            ->whereNull('added_by_user_id')
            ->with('categories:id,name');

        if (! empty($validated['display_name'])) {
            $query->where('display_name', 'ILIKE', '%' . $validated['display_name'] . '%');
        }
        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }
        if (! empty($validated['type'])) {
            $query->where('type', $validated['type']);
        }
        if (! empty($validated['start_date'])) {
            $query->whereDate('created_at', '>=', $validated['start_date']);
        }
        if (! empty($validated['end_date'])) {
            $query->whereDate('created_at', '<=', $validated['end_date']);
        }

        $sources = $query->orderByDesc('created_at')->paginate((int) ($validated['per_page'] ?? 20));

        return response()->json([
            'data' => $sources->getCollection()->map(fn (Source $source): array => [
                'id' => $source->id,
                'x_handle' => $source->x_handle,
                'display_name' => $source->display_name,
                'account_url' => $source->account_url,
                'categories' => $source->categories->map(fn (Category $category): array => [
                    'id' => $category->id,
                    'name' => $category->name,
                ])->values(),
                'type' => $source->type,
                'status' => $source->status,
                'created_at' => $source->created_at?->format('Y-m-d H:i:s'),
            ]),
            'meta' => [
                'current_page' => $sources->currentPage(),
                'last_page' => $sources->lastPage(),
                'per_page' => $sources->perPage(),
                'total' => $sources->total(),
            ],
            'filters' => [
                'categories' => Category::query()->orderBy('name')->get(['id', 'name']),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $source = Source::query()
            ->with('categories:id,name')
            ->whereNull('added_by_user_id')
            ->findOrFail($id);

        return response()->json([
            'data' => [
                'id' => $source->id,
                'x_handle' => $source->x_handle,
                'display_name' => $source->display_name,
                'account_url' => $source->account_url,
                'type' => $source->type,
                'status' => $source->status,
                'category_ids' => $source->categories->pluck('id')->values(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'x_handle' => ['required', 'string', 'max:100', 'unique:sources,x_handle'],
            'display_name' => ['nullable', 'string', 'max:200'],
            'account_url' => ['required', 'url'],
            'category_ids' => ['required', 'array', 'min:1'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
        ]);

        $source = Source::query()->create([
            'x_handle' => $validated['x_handle'],
            'display_name' => $validated['display_name'] ?? null,
            'account_url' => $validated['account_url'],
            'type' => 'default',
            'status' => 'active',
            'tenant_id' => 1,
        ]);

        $source->categories()->sync($validated['category_ids']);

        return response()->json(['data' => ['id' => $source->id]], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $source = Source::query()->whereNull('added_by_user_id')->findOrFail($id);
        $validated = $request->validate([
            'x_handle' => ['sometimes', 'string', 'max:100', Rule::unique('sources', 'x_handle')->ignore($source->id)],
            'display_name' => ['sometimes', 'nullable', 'string', 'max:200'],
            'account_url' => ['sometimes', 'url'],
            'status' => ['sometimes', Rule::in(['pending_review', 'active', 'spam', 'deleted'])],
            'type' => ['sometimes', Rule::in(['default', 'user'])],
            'category_ids' => ['sometimes', 'array', 'min:1'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
        ]);

        if (isset($validated['category_ids'])) {
            $source->categories()->sync($validated['category_ids']);
            unset($validated['category_ids']);
        }

        $source->fill($validated);
        $source->save();

        return response()->json(['message' => 'OK']);
    }

    public function destroy(int $id): JsonResponse
    {
        $source = Source::query()->whereNull('added_by_user_id')->findOrFail($id);
        $source->delete();

        return response()->json(['message' => 'OK']);
    }
}

