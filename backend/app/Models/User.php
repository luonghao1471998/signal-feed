<?php

namespace App\Models;

use App\Casts\PostgresIntegerArray;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'x_user_id',
        'x_username',
        'display_name',
        'email',
        'avatar_url',
        'x_access_token',
        'x_refresh_token',
        'x_token_expires_at',
        'my_categories',
        'locale',
        'delivery_preferences',
        'telegram_connect_token',
        'telegram_chat_id',
        'is_admin',
        'stripe_customer_id',
        'stripe_subscription_id',
        'subscription_ends_at',
        'tenant_id',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'x_access_token',
        'x_refresh_token',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'my_categories' => PostgresIntegerArray::class,
            'delivery_preferences' => 'array',
            'x_token_expires_at' => 'datetime',
            'subscription_ends_at' => 'datetime',
            'email_verified_at' => 'datetime',
            'is_admin' => 'boolean',
        ];
    }

    /**
     * My KOLs subscriptions (cap enforced in application layer).
     *
     * @return HasMany<MySourceSubscription, User>
     */
    public function sourceSubscriptions(): HasMany
    {
        return $this->hasMany(MySourceSubscription::class);
    }

    public function mySourceSubscriptions()
    {
        return $this->hasMany(MySourceSubscription::class, 'user_id');
    }

    /**
     * @return HasMany<BillingInvoice, User>
     */
    public function billingInvoices(): HasMany
    {
        return $this->hasMany(BillingInvoice::class);
    }
}
