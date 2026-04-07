<?php

namespace App\Http\Resources;

use App\Models\Source;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Source
 */
class SourceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'x_handle' => $this->x_handle,
            'display_name' => $this->display_name,
            'account_url' => $this->account_url,
            'type' => $this->type,
            'status' => $this->status,
            'categories' => CategoryResource::collection($this->whenLoaded('categories')),
        ];
    }
}
