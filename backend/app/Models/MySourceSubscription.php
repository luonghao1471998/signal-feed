<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MySourceSubscription extends Model
{
    protected $table = 'my_source_subscriptions';

    /** @var array<int, string> */
    protected $primaryKey = ['user_id', 'source_id'];

    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'source_id',
        'tenant_id',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public $timestamps = false;

    const UPDATED_AT = null;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }
}
