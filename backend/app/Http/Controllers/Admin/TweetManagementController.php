<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Source;
use App\Models\Tweet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TweetManagementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => ['nullable', 'integer'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Tweet::query()->with('source:id,display_name');
        if (! empty($validated['source_id'])) {
            $query->where('source_id', (int) $validated['source_id']);
        }
        if (! empty($validated['start_date'])) {
            $query->whereDate('created_at', '>=', $validated['start_date']);
        }
        if (! empty($validated['end_date'])) {
            $query->whereDate('created_at', '<=', $validated['end_date']);
        }

        $tweets = $query->orderByDesc('created_at')->paginate((int) ($validated['per_page'] ?? 20));

        return response()->json([
            'data' => $tweets->getCollection()->map(fn (Tweet $tweet): array => [
                'id' => $tweet->id,
                'tweet_id' => $tweet->tweet_id,
                'source_id' => $tweet->source_id,
                'source_display_name' => $tweet->source?->display_name,
                'text' => $tweet->text,
                'posted_at' => $tweet->posted_at?->format('Y-m-d H:i:s'),
                'signal_score' => $tweet->signal_score,
                'created_at' => $tweet->created_at?->format('Y-m-d H:i:s'),
            ]),
            'meta' => [
                'current_page' => $tweets->currentPage(),
                'last_page' => $tweets->lastPage(),
                'per_page' => $tweets->perPage(),
                'total' => $tweets->total(),
            ],
            'filters' => [
                'sources' => Source::query()
                    ->orderBy('display_name')
                    ->get(['id', 'display_name'])
                    ->map(fn (Source $source): array => [
                        'id' => $source->id,
                        'display_name' => $source->display_name,
                    ]),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $tweet = Tweet::query()
            ->with(['source:id,x_handle,display_name,account_url'])
            ->findOrFail($id);

        $source = $tweet->source;

        return response()->json([
            'data' => [
                'id' => $tweet->id,
                'tweet_id' => $tweet->tweet_id,
                'source_id' => $tweet->source_id,
                'source' => $source === null ? null : [
                    'id' => $source->id,
                    'x_handle' => $source->x_handle,
                    'display_name' => $source->display_name,
                    'account_url' => $source->account_url,
                ],
                'text' => $tweet->text,
                'url' => $tweet->url,
                'posted_at' => $tweet->posted_at?->format('Y-m-d H:i:s'),
                'signal_score' => $tweet->signal_score,
                'is_signal' => $tweet->is_signal,
                'created_at' => $tweet->created_at?->format('Y-m-d H:i:s'),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tweet_id' => ['required', 'string', 'max:50', 'unique:tweets,tweet_id'],
            'source_id' => ['required', 'integer', 'exists:sources,id'],
            'text' => ['required', 'string'],
            'posted_at' => ['required', 'date'],
            'url' => ['required', 'url'],
            'signal_score' => ['nullable', 'numeric'],
            'is_signal' => ['nullable', 'boolean'],
        ]);

        $tweet = Tweet::query()->create([
            ...$validated,
            'signal_score' => $validated['signal_score'] ?? 0,
            'is_signal' => $validated['is_signal'] ?? false,
            'tenant_id' => 1,
        ]);

        return response()->json(['data' => ['id' => $tweet->id]], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $tweet = Tweet::query()->findOrFail($id);
        $validated = $request->validate([
            'source_id' => ['sometimes', 'integer', 'exists:sources,id'],
            'text' => ['sometimes', 'string'],
            'posted_at' => ['sometimes', 'date'],
            'url' => ['sometimes', 'url'],
            'signal_score' => ['sometimes', 'numeric'],
            'is_signal' => ['sometimes', 'boolean'],
        ]);

        $tweet->fill($validated);
        $tweet->save();

        return response()->json(['message' => 'OK']);
    }

    public function destroy(int $id): JsonResponse
    {
        $tweet = Tweet::query()->findOrFail($id);
        $tweet->delete();

        return response()->json(['message' => 'OK']);
    }
}

