<?php

namespace App\Services;

use App\Models\Source;
use Illuminate\Support\Facades\DB;

class AdminSourceModerationService
{
    /**
     * @param  array<int>  $categoryIds
     */
    public function moderate(Source $source, string $action, array $categoryIds = []): Source
    {
        return DB::transaction(function () use ($source, $action, $categoryIds) {
            switch ($action) {
                case 'flag_spam':
                    $source->status = 'spam';
                    $source->save();

                    return $source->fresh(['categories']);

                case 'soft_delete':
                    $source->status = 'deleted';
                    $source->save();

                    return $source->fresh(['categories']);

                case 'restore':
                    $source->status = 'active';
                    $source->save();

                    return $source->fresh(['categories']);

                case 'adjust_categories':
                    $source->categories()->sync($categoryIds);

                    return $source->fresh(['categories']);

                default:
                    return $source;
            }
        });
    }
}
