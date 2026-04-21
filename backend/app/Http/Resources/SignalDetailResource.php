<?php

namespace App\Http\Resources;

use App\Models\Signal;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * GET /api/signals/{id} — đầy đủ attribution (tweet_text, posted_at).
 *
 * @mixin Signal
 */
class SignalDetailResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Signal $signal */
        $signal = $this->resource;

        $digestDate = $signal->relationLoaded('digest') && $signal->digest
            ? $signal->digest->date?->toDateString()
            : $signal->created_at?->toDateString();

        $type = (int) (data_get($signal->getAttributes(), 'type') ?? 0);

        return [
            'id' => $signal->id,
            'title' => $signal->title,
            'summary' => $signal->summary,
            'source_count' => (int) $signal->source_count,
            'rank_score' => (float) $signal->rank_score,
            'categories' => $signal->relationLoaded('categoryModels')
                ? $signal->categoryModels->map(static fn ($cat) => [
                    'id' => $cat->id,
                    'name' => $cat->name,
                    'slug' => $cat->slug,
                ])->values()->all()
                : [],
            'topic_tags' => $signal->topic_tags ?? [],
            'sources' => $signal->sources->map(function ($source) {
                $handle = (string) $source->x_handle;
                if ($handle !== '' && ! str_starts_with($handle, '@')) {
                    $handle = '@'.$handle;
                }

                $tweet = $source->relationLoaded('attribution_tweet') ? $source->attribution_tweet : null;

                return [
                    'handle' => $handle,
                    'display_name' => $source->display_name,
                    'avatar_url' => $source->avatar_url,
                    'tweet_url' => $tweet?->url,
                    'tweet_text' => $tweet?->text ?? '',
                    'posted_at' => $tweet?->posted_at
                        ? $tweet->posted_at->copy()->toIso8601String()
                        : null,
                    'is_my_source' => $source->is_my_source ?? null,
                ];
            })->values()->all(),
            'draft_tweets' => $signal->draft
                ? [
                    [
                        'id' => $signal->draft->id,
                        'text' => $signal->draft->text,
                    ],
                ]
                : [],
            'date' => $digestDate,
            'published_at' => $signal->created_at
                ? $signal->created_at->copy()->toIso8601String()
                : null,
            'type' => $type,
            'is_personal' => $type === 1,
        ];
    }
}
