<?php

namespace App\Http\Resources;

use App\Models\Source;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Admin list source (GET /api/admin/sources).
 *
 * @mixin Source
 */
class AdminModerationSourceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'handle' => $this->x_handle,
            'display_name' => $this->display_name,
            'account_url' => $this->account_url,
            'type' => $this->type,
            'status' => $this->status,
            'added_by_user' => $this->when(
                $this->relationLoaded('addedByUser'),
                fn () => $this->addedByUser === null
                ? null
                : [
                    'id' => $this->addedByUser->id,
                    'email' => null,
                ]
            ),
            'categories' => CategoryResource::collection($this->whenLoaded('categories')),
            'created_at' => $this->created_at?->utc()->toIso8601String(),
            'signal_count' => (int) ($this->signal_count ?? 0),
            'noise_ratio' => $this->noise_ratio === null ? null : round((float) $this->noise_ratio, 2),
        ];
    }
}
