<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Source extends Model
{
    use SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'type',
        'status',
        'x_handle',
        'x_user_id',
        'display_name',
        'account_url',
        'last_crawled_at',
        'added_by_user_id',
        'tenant_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_crawled_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    /**
     * M:N categories via source_categories (pivot: created_at only — no updated_at).
     */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'source_categories');
    }
}
