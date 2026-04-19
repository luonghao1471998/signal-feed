<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BillingInvoice extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'stripe_invoice_id',
        'stripe_customer_id',
        'stripe_subscription_id',
        'currency',
        'amount_due',
        'amount_paid',
        'status',
        'description',
        'period_start',
        'period_end',
        'hosted_invoice_url',
        'paid_at',
        'stripe_created_at',
        'tenant_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'period_start' => 'datetime',
            'period_end' => 'datetime',
            'paid_at' => 'datetime',
            'stripe_created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, BillingInvoice>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
