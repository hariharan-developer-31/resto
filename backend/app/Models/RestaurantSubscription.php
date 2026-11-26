<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RestaurantSubscription extends Model
{
    use HasFactory;

    protected $fillable = [
        'restaurant_id',
        'plan_id',
        'billing_cycle', // monthly, annual
        'amount_paid',
        'status', // trialing, active, past_due, cancelled, expired
        'trial_ends_at',
        'starts_at',
        'renews_at',
        'cancelled_at',
        'cancellation_reason',
        'payment_gateway',
        'payment_reference',
    ];

    protected function casts(): array
    {
        return [
            'amount_paid' => 'decimal:2',
            'trial_ends_at' => 'datetime',
            'starts_at' => 'datetime',
            'renews_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'plan_id');
    }
}
