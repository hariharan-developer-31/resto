<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SubscriptionPlan extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'monthly_price',
        'annual_price',
        'currency',
        'max_branches',
        'max_tables_per_branch',
        'max_staff_members',
        'features',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'monthly_price' => 'decimal:2',
            'annual_price' => 'decimal:2',
            'max_branches' => 'integer',
            'max_tables_per_branch' => 'integer',
            'max_staff_members' => 'integer',
            'features' => 'array',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function restaurants(): HasMany
    {
        return $this->hasMany(Restaurant::class, 'current_plan_id');
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(RestaurantSubscription::class, 'plan_id');
    }

    public function hasFeature(string $featureKey): bool
    {
        $features = $this->features ?? [];
        return in_array($featureKey, $features, true);
    }
}
