<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminSourceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'x_handle' => $this->x_handle,
            // Backward compatibility for existing AdminSourcesPage UI.
            'handle' => $this->x_handle,
            'display_name' => $this->display_name,
            'account_url' => $this->account_url,
            'type' => $this->type,
            'status' => $this->status,
            'added_by_user' => $this->when(
                $this->relationLoaded('addedBy'),
                fn () => $this->addedBy === null
                    ? null
                    : [
                        'id' => $this->addedBy->id,
                        'email' => $this->addedBy->email,
                    ],
            ),
            'categories' => CategoryResource::collection($this->whenLoaded('categories')),
            'created_at' => $this->created_at?->toIso8601String(),
            'signal_count' => (int) ($this->signal_count ?? 0),
            'noise_ratio' => $this->noise_ratio === null ? null : round((float) $this->noise_ratio, 2),
        ];
    }
}
