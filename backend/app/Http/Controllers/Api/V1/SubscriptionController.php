<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\DiningTable;
use App\Models\Restaurant;
use App\Models\RestaurantSubscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SubscriptionController extends Controller
{
    use ApiResponse;

    /**
     * Get available SaaS subscription plans.
     */
    public function plans(): JsonResponse
    {
        $plans = SubscriptionPlan::where('is_active', true)
            ->orderBy('sort_order', 'asc')
            ->get();

        return $this->successResponse($plans, 'Subscription plans retrieved.');
    }

    /**
     * Get current restaurant subscription tier and quota usage.
     */
    public function current(Request $request): JsonResponse
    {
        $user = $request->user();

        $restaurantId = $request->header('X-Restaurant-ID')
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Branch::first()?->restaurant_id;
        }

        if (!$restaurantId) {
            return $this->errorResponse('Please specify an active restaurant context.', 400);
        }

        if (!$user->hasRestaurantAccess((int) $restaurantId)) {
            return $this->errorResponse('Unauthorized access to this restaurant.', 403);
        }

        $restaurant = Restaurant::with('currentPlan')->findOrFail($restaurantId);
        $plan = $restaurant->getActivePlan();

        // Calculate current resource consumption
        $currentBranches = $restaurant->branches()->count();
        $currentTables = DiningTable::where('restaurant_id', $restaurant->id)->count();
        $currentStaff = $restaurant->users()->count();

        $activeSubscription = RestaurantSubscription::where('restaurant_id', $restaurant->id)
            ->where('status', 'active')
            ->latest('starts_at')
            ->first();

        return $this->successResponse([
            'restaurant_id' => $restaurant->id,
            'restaurant_name' => $restaurant->name,
            'status' => $restaurant->subscription_status ?? 'active',
            'plan' => [
                'id' => $plan->id,
                'name' => $plan->name,
                'slug' => $plan->slug,
                'monthly_price' => $plan->monthly_price,
                'annual_price' => $plan->annual_price,
                'currency' => $plan->currency,
                'features' => $plan->features ?? [],
            ],
            'quotas' => [
                'branches' => [
                    'current' => $currentBranches,
                    'max' => $plan->max_branches,
                    'remaining' => max(0, $plan->max_branches - $currentBranches),
                    'is_limit_reached' => $currentBranches >= $plan->max_branches,
                ],
                'tables' => [
                    'current' => $currentTables,
                    'max' => $plan->max_tables_per_branch * max(1, $currentBranches),
                    'max_per_branch' => $plan->max_tables_per_branch,
                    'is_limit_reached' => $currentTables >= ($plan->max_tables_per_branch * max(1, $currentBranches)),
                ],
                'staff' => [
                    'current' => $currentStaff,
                    'max' => $plan->max_staff_members,
                    'remaining' => max(0, $plan->max_staff_members - $currentStaff),
                    'is_limit_reached' => $currentStaff >= $plan->max_staff_members,
                ],
            ],
            'subscription_details' => [
                'billing_cycle' => $activeSubscription?->billing_cycle ?? 'monthly',
                'starts_at' => $activeSubscription?->starts_at?->toDateString() ?? now()->toDateString(),
                'renews_at' => $activeSubscription?->renews_at?->toDateString() ?? now()->addMonth()->toDateString(),
                'amount_paid' => $activeSubscription?->amount_paid ?? $plan->monthly_price,
            ],
        ], 'Current subscription details retrieved.');
    }

    /**
     * Upgrade or switch restaurant subscription tier.
     */
    public function upgrade(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'restaurant_id' => 'nullable|exists:restaurants,id',
            'plan_id' => 'required|exists:subscription_plans,id',
            'billing_cycle' => 'required|in:monthly,annual',
            'payment_gateway' => 'nullable|string|max:50',
            'payment_reference' => 'nullable|string|max:100',
        ]);

        $restaurantId = $validated['restaurant_id']
            ?? $request->header('X-Restaurant-ID')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Branch::first()?->restaurant_id;
        }

        if (!$restaurantId || (!$user->isSuperAdmin() && (!$user->can('settings.edit') || !$user->hasRestaurantAccess((int) $restaurantId)))) {
            return $this->errorResponse('Unauthorized to manage subscriptions for this restaurant.', 403);
        }

        $restaurant = Restaurant::findOrFail($restaurantId);
        $plan = SubscriptionPlan::findOrFail($validated['plan_id']);

        $amount = $validated['billing_cycle'] === 'annual' ? (float) $plan->annual_price : (float) $plan->monthly_price;
        $renewalDuration = $validated['billing_cycle'] === 'annual' ? 365 : 30;

        // Mark prior active subscriptions as cancelled before creating the new active tier
        RestaurantSubscription::where('restaurant_id', $restaurant->id)
            ->where('status', 'active')
            ->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'cancellation_reason' => 'Replaced by plan change',
            ]);

        $subscription = RestaurantSubscription::create([
            'restaurant_id' => $restaurant->id,
            'plan_id' => $plan->id,
            'billing_cycle' => $validated['billing_cycle'],
            'amount_paid' => $amount,
            'status' => 'active',
            'starts_at' => now(),
            'renews_at' => now()->addDays($renewalDuration),
            'payment_gateway' => $validated['payment_gateway'] ?? 'razorpay',
            'payment_reference' => $validated['payment_reference'] ?? 'SUB-' . strtoupper(Str::random(10)),
        ]);

        $restaurant->forceFill([
            'current_plan_id' => $plan->id,
            'subscription_status' => 'active',
        ])->save();

        AuditLog::log(
            'subscription.upgraded',
            $subscription,
            null,
            ['plan_name' => $plan->name, 'billing_cycle' => $validated['billing_cycle'], 'amount' => $amount],
            $user
        );

        return $this->successResponse([
            'restaurant' => $restaurant->fresh('currentPlan'),
            'subscription' => $subscription,
        ], "Subscription upgraded to {$plan->name} successfully.");
    }

    /**
     * Super Admin create new subscription plan tier.
     */
    public function storePlan(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin()) {
            return $this->errorResponse('Only a Super Admin can create subscription plans.', 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'slug' => 'required|string|max:50|unique:subscription_plans,slug',
            'description' => 'nullable|string|max:500',
            'monthly_price' => 'required|numeric|min:0',
            'annual_price' => 'required|numeric|min:0',
            'max_branches' => 'required|integer|min:1',
            'max_tables_per_branch' => 'required|integer|min:0',
            'max_staff_members' => 'required|integer|min:1',
            'features' => 'nullable|array',
            'sort_order' => 'nullable|integer',
        ]);

        $plan = SubscriptionPlan::create($validated);

        AuditLog::log('plan.created', $plan, null, ['name' => $plan->name], $user);

        return $this->successResponse($plan, 'Subscription plan created.', 201);
    }
}
