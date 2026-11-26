<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Restaurant extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'logo',
        'description',
        'phone',
        'email',
        'website',
        'gst_number',
        'currency',
        'currency_symbol',
        'timezone',
        'primary_color',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function currentPlan(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'current_plan_id');
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(RestaurantSubscription::class);
    }

    /**
     * Get active plan or default Starter plan
     */
    public function getActivePlan(): SubscriptionPlan
    {
        if ($this->currentPlan) {
            return $this->currentPlan;
        }

        return SubscriptionPlan::where('slug', 'starter')->first()
            ?? new SubscriptionPlan([
                'name' => 'Starter Plan',
                'slug' => 'starter',
                'max_branches' => 1,
                'max_tables_per_branch' => 10,
                'max_staff_members' => 5,
                'features' => ['pos', 'waiter', 'menu'],
            ]);
    }

    /**
     * Check if restaurant can add another branch
     */
    public function canAddBranch(): bool
    {
        $plan = $this->getActivePlan();
        return $this->branches()->count() < $plan->max_branches;
    }

    /**
     * Check if branch can add another table
     */
    public function canAddTable(int $branchId): bool
    {
        $plan = $this->getActivePlan();
        $tableCount = DiningTable::where('branch_id', $branchId)->count();
        return $tableCount < $plan->max_tables_per_branch;
    }

    /**
     * Check if restaurant can add another employee
     */
    public function canAddStaff(): bool
    {
        $plan = $this->getActivePlan();
        return $this->users()->count() < $plan->max_staff_members;
    }

    /**
     * Check if tenant has specific feature enabled
     */
    public function hasFeature(string $featureKey): bool
    {
        return $this->getActivePlan()->hasFeature($featureKey);
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function diningTables(): HasMany
    {
        return $this->hasMany(DiningTable::class);
    }

    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    public function menuItems(): HasMany
    {
        return $this->hasMany(MenuItem::class);
    }

    public function addons(): HasMany
    {
        return $this->hasMany(Addon::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_restaurants')
            ->withTimestamps();
    }

    public function settings(): HasMany
    {
        return $this->hasMany(RestaurantSetting::class);
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }

    public function getSetting(string $key, mixed $default = null): mixed
    {
        $setting = $this->settings()->where('key', $key)->first();
        if (!$setting) {
            return $default;
        }

        $decoded = json_decode($setting->value, true);
        return json_last_error() === JSON_ERROR_NONE ? $decoded : $setting->value;
    }
}
