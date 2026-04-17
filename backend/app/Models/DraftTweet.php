<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DraftTweet extends Model
{
    protected $fillable = [
        'signal_id',
        'text',
        'tenant_id',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function signal(): BelongsTo
    {
        return $this->belongsTo(Signal::class);
    }

    public static function validateDraftText(string $text): bool
    {
        $len = mb_strlen($text, 'UTF-8');

        return $len > 0 && $len <= 280;
    }
}
