<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Digest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DigestManagementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Digest::query();
        if (! empty($validated['title'])) {
            $query->where('title', 'ILIKE', '%' . $validated['title'] . '%');
        }
        if (! empty($validated['start_date'])) {
            $query->whereDate('created_at', '>=', $validated['start_date']);
        }
        if (! empty($validated['end_date'])) {
            $query->whereDate('created_at', '<=', $validated['end_date']);
        }

        $digests = $query->orderByDesc('created_at')->paginate((int) ($validated['per_page'] ?? 20));

        return response()->json([
            'data' => $digests->getCollection()->map(fn (Digest $digest): array => [
                'id' => $digest->id,
                'title' => $digest->title,
                'total_signals' => $digest->total_signals,
                'created_at' => $digest->created_at?->format('Y-m-d H:i:s'),
            ]),
            'meta' => [
                'current_page' => $digests->currentPage(),
                'last_page' => $digests->lastPage(),
                'per_page' => $digests->perPage(),
                'total' => $digests->total(),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $digest = Digest::query()->findOrFail($id);

        return response()->json([
            'data' => [
                'id' => $digest->id,
                'title' => $digest->title,
                'date' => $digest->date?->format('Y-m-d'),
                'total_signals' => $digest->total_signals,
                'created_at' => $digest->created_at?->format('Y-m-d H:i:s'),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'date' => ['required', 'date'],
            'total_signals' => ['nullable', 'integer', 'min:0'],
        ]);

        $digest = Digest::query()->create([
            'title' => $validated['title'],
            'date' => $validated['date'],
            'total_signals' => $validated['total_signals'] ?? 0,
            'tenant_id' => 1,
        ]);

        return response()->json(['data' => ['id' => $digest->id]], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $digest = Digest::query()->findOrFail($id);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'date' => ['sometimes', 'date'],
            'total_signals' => ['sometimes', 'integer', 'min:0'],
        ]);

        $digest->fill($validated);
        $digest->save();

        return response()->json(['message' => 'OK']);
    }

    public function destroy(int $id): JsonResponse
    {
        $digest = Digest::query()->findOrFail($id);
        $digest->delete();

        return response()->json(['message' => 'OK']);
    }
}

