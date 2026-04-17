<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Digest;
use App\Models\Signal;
use App\Models\Tweet;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SignalManagementController extends Controller
{
    /**
     * GET /admin/api/signals
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'digest_id' => ['nullable', 'integer'],
            'title' => ['nullable', 'string'],
            'category_id' => ['nullable', 'integer'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Signal::query()->with('digest:id,title');

        if (! empty($validated['digest_id'])) {
            $query->where('digest_id', (int) $validated['digest_id']);
        }

        if (! empty($validated['title'])) {
            $query->where('title', 'ILIKE', '%' . $validated['title'] . '%');
        }

        if (! empty($validated['category_id'])) {
            $categoryId = (int) $validated['category_id'];
            $query->whereRaw('? = ANY(categories)', [$categoryId]);
        }

        if (! empty($validated['start_date'])) {
            $query->whereDate('created_at', '>=', $validated['start_date']);
        }

        if (! empty($validated['end_date'])) {
            $query->whereDate('created_at', '<=', $validated['end_date']);
        }

        $perPage = (int) ($validated['per_page'] ?? 20);
        $signals = $query->orderByDesc('created_at')->paginate($perPage);

        $categoryMap = Category::query()->pluck('name', 'id');

        $data = $signals->getCollection()->map(function (Signal $signal) use ($categoryMap): array {
            $categoryNames = collect($signal->categories ?? [])
                ->map(fn (int $id) => $categoryMap->get($id))
                ->filter()
                ->values()
                ->all();

            return [
                'id' => $signal->id,
                'digest_id' => $signal->digest_id,
                'digest_title' => $signal->digest?->title,
                'title' => $signal->title,
                'categories' => $categoryNames,
                'category_ids' => $signal->categories ?? [],
                'source_count' => $signal->source_count,
                'rank_score' => $signal->rank_score,
                'created_at' => $signal->created_at?->format('Y-m-d H:i:s'),
            ];
        });

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $signals->currentPage(),
                'last_page' => $signals->lastPage(),
                'per_page' => $signals->perPage(),
                'total' => $signals->total(),
            ],
            'filters' => [
                'digests' => Digest::query()
                    ->orderByDesc('created_at')
                    ->get(['id', 'title'])
                    ->map(fn (Digest $digest): array => ['id' => $digest->id, 'title' => $digest->title]),
                'categories' => Category::query()
                    ->orderBy('name')
                    ->get(['id', 'name'])
                    ->map(fn (Category $category): array => ['id' => $category->id, 'name' => $category->name]),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $signal = Signal::query()
            ->with([
                'digest:id,title',
                'sources:id,x_handle,display_name',
                'tweets:id,text,url,posted_at',
                'draft:id,signal_id,text',
            ])
            ->findOrFail($id);

        $categories = Category::query()
            ->whereIn('id', $signal->categories ?? [])
            ->orderBy('name')
            ->get(['id', 'name']);

        return response()->json([
            'data' => [
                'id' => $signal->id,
                'digest' => $signal->digest ? [
                    'id' => $signal->digest->id,
                    'title' => $signal->digest->title,
                ] : null,
                'title' => $signal->title,
                'summary' => $signal->summary,
                'categories' => $categories,
                'topic_tags' => $signal->topic_tags,
                'source_count' => $signal->source_count,
                'rank_score' => $signal->rank_score,
                'impact_score' => $signal->impact_score,
                'created_at' => $signal->created_at?->format('Y-m-d H:i:s'),
                'sources' => $signal->sources->map(fn ($source): array => [
                    'id' => $source->id,
                    'x_handle' => $source->x_handle,
                    'display_name' => $source->display_name,
                ])->values(),
                'tweets' => $signal->tweets->map(fn (Tweet $tweet): array => [
                    'id' => $tweet->id,
                    'text' => $tweet->text,
                    'url' => $tweet->url,
                    'posted_at' => $tweet->posted_at?->format('Y-m-d H:i:s'),
                ])->values(),
                'draft' => $signal->draft?->text,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'digest_id' => ['required', 'integer', 'exists:digests,id'],
            'cluster_id' => ['nullable', 'string', 'max:100'],
            'title' => ['required', 'string', 'max:200'],
            'summary' => ['required', 'string'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'topic_tags' => ['nullable', 'array'],
            'topic_tags.*' => ['string', 'max:50'],
            'source_count' => ['nullable', 'integer', 'min:0'],
            'rank_score' => ['nullable', 'numeric'],
        ]);

        $signal = Signal::query()->create([
            'digest_id' => $validated['digest_id'],
            'cluster_id' => $validated['cluster_id'] ?? ('manual-' . now()->timestamp),
            'title' => $validated['title'],
            'summary' => $validated['summary'],
            'categories' => $validated['category_ids'] ?? [],
            'topic_tags' => $validated['topic_tags'] ?? [],
            'source_count' => $validated['source_count'] ?? 0,
            'rank_score' => $validated['rank_score'] ?? 0,
            'tenant_id' => 1,
        ]);

        return response()->json([
            'data' => ['id' => $signal->id],
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $signal = Signal::query()->findOrFail($id);
        $validated = $request->validate([
            'digest_id' => ['sometimes', 'integer', 'exists:digests,id'],
            'title' => ['sometimes', 'string', 'max:200'],
            'summary' => ['sometimes', 'string'],
            'category_ids' => ['sometimes', 'array'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'topic_tags' => ['sometimes', 'array'],
            'topic_tags.*' => ['string', 'max:50'],
            'source_count' => ['sometimes', 'integer', 'min:0'],
            'rank_score' => ['sometimes', 'numeric'],
        ]);

        if (array_key_exists('category_ids', $validated)) {
            $signal->categories = $validated['category_ids'];
            unset($validated['category_ids']);
        }

        $signal->fill($validated);
        $signal->save();

        return response()->json(['message' => 'OK']);
    }

    public function destroy(int $id): JsonResponse
    {
        $signal = Signal::query()->findOrFail($id);
        $signal->delete();

        return response()->json(['message' => 'OK']);
    }

    public function flag(Request $request, int $id): JsonResponse
    {
        $signal = Signal::query()->findOrFail($id);
        $validated = $request->validate([
            'rank_score' => ['nullable', 'numeric'],
        ]);

        $signal->rank_score = $validated['rank_score'] ?? 0;
        $signal->save();

        return response()->json(['message' => 'OK']);
    }
}
