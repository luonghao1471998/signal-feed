<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MySourceSubscription extends Model
{
    protected $table = 'my_source_subscriptions';
    
    protected $primaryKey = ['user_id', 'source_id']; // Composite key
    public $incrementing = false; // Không auto-increment
    
    protected $fillable = [
        'user_id',
        'source_id',
        'tenant_id'
    ];
    
    protected $casts = [
        'created_at' => 'datetime'
    ];
    
    public $timestamps = false;
    const UPDATED_AT = null;
}