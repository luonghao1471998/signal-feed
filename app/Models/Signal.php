<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Signal extends Model
{
    protected $fillable = [
        'digest_id',
        'cluster_id',
        'title',
        'summary',
        'categories',
        'topic_tags',
        'source_count',
        'rank_score',
        'impact_score',
        'tenant_id',
    ];

    protected $casts = [
        'rank_score' => 'decimal:4',
        'impact_score' => 'decimal:2',
    ];

    // ✅ ONLY these getters
    public function getCategoriesAttribute($value)
    {
        if (is_null($value)) {
            return [];
        }
        $clean = trim($value, '{}');

        return $clean ? array_map('intval', explode(',', $clean)) : [];
    }

    public function getTopicTagsAttribute($value)
    {
        if (is_null($value)) {
            return [];
        }
        $clean = trim($value, '{}');
        if (! $clean) {
            return [];
        }

        return array_map(fn ($v) => trim($v, '"'), explode(',', $clean));
    }

    public function digest(): BelongsTo
    {
        return $this->belongsTo(Digest::class);
    }

    public function tweets(): BelongsToMany
    {
        return $this->belongsToMany(Tweet::class, 'signal_sources')
            ->withPivot('source_id');
    }

    public function sources(): BelongsToMany
    {
        return $this->belongsToMany(Source::class, 'signal_sources')
            ->withPivot('tweet_id');
    }
}
