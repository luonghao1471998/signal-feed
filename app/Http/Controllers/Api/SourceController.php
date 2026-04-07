<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SourceResource;
use App\Models\Source;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SourceController extends Controller
{
    /**
     * Browse platform source pool (wedge: no pagination / filters).
     */
    public function index(): AnonymousResourceCollection
    {
        $sources = Source::query()
            ->where('status', 'active')
            ->with('categories')
            ->orderBy('id')
            ->get();

        return SourceResource::collection($sources);
    }
}
