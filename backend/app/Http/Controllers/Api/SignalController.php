<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SignalDetailResource;
use App\Http\Resources\SignalResource;
use App\Models\Category;
use App\Models\Signal;
use App\Models\Tweet;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class SignalController extends Controller
{
    /**
     * GET /api/signals — Digest list (SPEC-api List Signals).
     */
    public function index(Request $request): AnonymousResourceCollection|JsonResponse
    {
        $user = $request->user();
        $plan = (string) $user->plan;

        if ($plan === 'free') {
            $today = Carbon::now()->dayOfWeek;
            $allowedDays = [1, 3, 5];

            if (! in_array($today, $allowedDays, true)) {
                return response()->json([
                    'message' => 'Free tier: digest available Mon/Wed/Fri only. Upgrade to Pro for daily access.',
                ], 403);
            }
        }

        $request->validate([
            'date' => 'nullable|date_format:Y-m-d',
            'category_id' => 'nullable|array',
            'category_id.*' => 'integer|exists:categories,id',
            'my_sources_only' => 'nullable|boolean',
            'topic_tag' => 'nullable|string|max:50',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $date = $request->input('date', Carbon::now()->toDateString());

        $query = Signal::query()
            ->with([
                'digest',
                'draft',
                'sources' => static function ($q): void {
                    $q->withPivot('tweet_id');
                },
            ]);

        if (Schema::hasColumn('signals', 'date')) {
            $query->whereDate('signals.date', $date);
        } else {
            $query->whereHas('digest', static function ($q) use ($date): void {
                $q->whereDate('digests.date', $date);
            });
        }

        $hasTypeColumn = Schema::hasColumn('signals', 'type');

        if ($request->filled('category_id')) {
            /** @var list<int> $categoryIds */
            $categoryIds = array_map('intval', $request->input('category_id', []));
            if ($categoryIds !== []) {
                $literal = '{'.implode(',', $categoryIds).'}';
                $query->whereRaw('signals.categories && ?::integer[]', [$literal]);
            }
        }

        if ($request->filled('topic_tag') && $plan !== 'free') {
            $tag = $request->string('topic_tag')->toString();
            $query->whereRaw('?::text = ANY(signals.topic_tags)', [$tag]);
        }

        $mySourcesOnly = $request->boolean('my_sources_only');
        $personalSignalsHeader = null;

        $applySharedMySourcesFilter = static function ($builder) use ($user): void {
            $builder->where('signals.type', 0)
                ->whereExists(static function ($sub) use ($user): void {
                    $sub->select(DB::raw('1'))
                        ->from('signal_sources as ss')
                        ->whereColumn('ss.signal_id', 'signals.id')
                        ->whereExists(static function ($inner) use ($user): void {
                            $inner->select(DB::raw('1'))
                                ->from('my_source_subscriptions as mss')
                                ->whereColumn('mss.source_id', 'ss.source_id')
                                ->where('mss.user_id', $user->id);
                        });
                });
        };

        if ($hasTypeColumn) {
            if ($mySourcesOnly) {
                if (in_array($plan, ['pro', 'power'], true)) {
                    $personalQuery = (clone $query)
                        ->where('signals.type', 1)
                        ->where('signals.user_id', $user->id);

                    $personalCount = $personalQuery->count();

                    if ($personalCount > 0) {
                        $query->where('signals.type', 1)
                            ->where('signals.user_id', $user->id);
                        $personalSignalsHeader = 'true';
                    } else {
                        $applySharedMySourcesFilter($query);
                        $personalSignalsHeader = 'false';
                        Log::info("Pro user {$user->id} fallback to shared signals - no personal signals yet");
                    }
                } else {
                    $applySharedMySourcesFilter($query);
                }
            } else {
                $query->where('signals.type', 0);
            }
        } elseif ($mySourcesOnly) {
            $applySharedMySourcesFilter($query);
        }

        $query->withExists([
            'archiveRows as is_archived' => static function ($q) use ($user): void {
                $q->where('user_archived_signals.user_id', $user->id);
            },
        ]);

        $query->orderByDesc('signals.rank_score');

        $perPage = min($request->integer('per_page', 20), 100);

        $signals = $query->paginate($perPage);

        $tweetIds = $signals->getCollection()
            ->flatMap(static fn (Signal $s) => $s->sources->pluck('pivot.tweet_id'))
            ->unique()
            ->filter()
            ->values();

        $tweets = Tweet::query()
            ->whereIn('id', $tweetIds)
            ->get()
            ->keyBy('id');

        $categoryIds = $signals->getCollection()
            ->flatMap(static fn (Signal $s) => $s->categories)
            ->unique()
            ->map(static fn ($id): int => (int) $id)
            ->values()
            ->all();

        $categoryLookup = Category::query()
            ->whereIn('id', $categoryIds)
            ->get()
            ->keyBy('id');

        $subscribedSourceIds = collect();
        if (in_array($plan, ['pro', 'power'], true)) {
            $subscribedSourceIds = DB::table('my_source_subscriptions')
                ->where('user_id', $user->id)
                ->pluck('source_id');
        }

        $signals->setCollection(
            $signals->getCollection()->map(function (Signal $signal) use (
                $tweets,
                $categoryLookup,
                $subscribedSourceIds,
                $plan
            ): Signal {
                $signal->setRelation(
                    'categoryModels',
                    collect($signal->categories)
                        ->map(static fn ($id) => $categoryLookup->get((int) $id))
                        ->filter()
                        ->values()
                );

                foreach ($signal->sources as $source) {
                    $tid = $source->pivot->tweet_id ?? null;
                    $tweet = $tid !== null ? $tweets->get((int) $tid) : null;
                    $source->setRelation('attribution_tweet', $tweet);
                    if (in_array($plan, ['pro', 'power'], true)) {
                        $source->is_my_source = $subscribedSourceIds->contains($source->id);
                    } else {
                        $source->is_my_source = null;
                    }
                }

                if ($plan === 'free') {
                    $signal->setRelation('draft', null);
                }

                return $signal;
            })
        );

        $resource = SignalResource::collection($signals);

        if ($personalSignalsHeader !== null) {
            return $resource->response()->header('X-Personal-Signals', $personalSignalsHeader);
        }

        return $resource;
    }

    /**
     * GET /api/signals/{id} — chi tiết một signal (full summary + tweet attribution).
     */
    public function show(Request $request, int $id): SignalDetailResource|JsonResponse
    {
        $user = $request->user();
        $plan = (string) $user->plan;

        if ($plan === 'free') {
            $today = Carbon::now()->dayOfWeek;
            $allowedDays = [1, 3, 5];

            if (! in_array($today, $allowedDays, true)) {
                return response()->json([
                    'message' => 'Free tier: digest available Mon/Wed/Fri only. Upgrade to Pro for daily access.',
                ], 403);
            }
        }

        $signal = Signal::query()
            ->with([
                'digest',
                'draft',
                'sources' => static function ($q): void {
                    $q->withPivot('tweet_id');
                },
            ])
            ->findOrFail($id);

        // Task 2.6.3: Ownership guard — personal signals (type=1) chỉ owner xem được
        if ((int) $signal->type === 1 && (int) $signal->user_id !== (int) auth()->id()) {
            return response()->json([
                'error' => [
                    'code' => 'FORBIDDEN',
                    'message' => 'You do not have access to this signal.',
                ],
            ], 403);
        }

        $tweetIds = $signal->sources
            ->pluck('pivot.tweet_id')
            ->unique()
            ->filter()
            ->values();

        $tweets = Tweet::query()
            ->whereIn('id', $tweetIds)
            ->get()
            ->keyBy('id');

        $subscribedSourceIds = collect();
        if (in_array($plan, ['pro', 'power'], true)) {
            $subscribedSourceIds = DB::table('my_source_subscriptions')
                ->where('user_id', $user->id)
                ->pluck('source_id');
        }

        foreach ($signal->sources as $source) {
            $tid = $source->pivot->tweet_id ?? null;
            $tweet = $tid !== null ? $tweets->get((int) $tid) : null;
            $source->setRelation('attribution_tweet', $tweet);
            if (in_array($plan, ['pro', 'power'], true)) {
                $source->is_my_source = $subscribedSourceIds->contains($source->id);
            } else {
                $source->is_my_source = null;
            }
        }

        $categoryIds = $signal->categories;
        $categoryLookup = Category::query()
            ->whereIn('id', $categoryIds)
            ->get()
            ->keyBy('id');

        $signal->setRelation(
            'categoryModels',
            collect($categoryIds)
                ->map(static fn ($cid) => $categoryLookup->get((int) $cid))
                ->filter()
                ->values()
        );

        if ($plan === 'free') {
            $signal->setRelation('draft', null);
        }

        return new SignalDetailResource($signal);
    }
}
