<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\BranchSetting;
use App\Models\Order;
use App\Models\Restaurant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BranchController extends Controller
{
    use ApiResponse;

    /**
     * Display a listing of branches for a restaurant.
     */
    public function index(Request $request, int $restaurantId): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->hasRestaurantAccess($restaurantId)) {
            return $this->errorResponse('Unauthorized access to this restaurant.', 403);
        }

        $restaurant = Restaurant::find($restaurantId);
        if (!$restaurant) {
            return $this->errorResponse('Restaurant not found.', 404);
        }

        $query = Branch::where('restaurant_id', $restaurantId)
            ->withCount(['diningTables', 'users', 'orders'])
            ->latest();

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhere('city', 'like', "%{$search}%");
            });
        }

        $branches = $query->get();

        return $this->successResponse($branches, 'Branches retrieved successfully.');
    }

    /**
     * Store a newly created branch.
     */
    public function store(Request $request, int $restaurantId): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('branches.create')) {
            return $this->errorResponse('Unauthorized to create branches.', 403);
        }

        if (!$user->hasRestaurantAccess($restaurantId)) {
            return $this->errorResponse('Unauthorized access to this restaurant.', 403);
        }

        $restaurant = Restaurant::find($restaurantId);
        if (!$restaurant) {
            return $this->errorResponse('Restaurant not found.', 404);
        }

        if (!$restaurant->canAddBranch()) {
            $plan = $restaurant->getActivePlan();
            return $this->errorResponse(
                "Branch limit reached for your {$plan->name} plan (max {$plan->max_branches} branches). Upgrade your subscription to add more.",
                422
            );
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:32',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'is_main_branch' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'opening_time' => 'nullable|string|max:20',
            'closing_time' => 'nullable|string|max:20',
            'tax_rate' => 'nullable|numeric|min:0|max:100',
            'settings' => 'nullable|array',
        ]);

        // If marked as main branch, reset other branches' main flag
        if (!empty($validated['is_main_branch'])) {
            Branch::where('restaurant_id', $restaurantId)->update(['is_main_branch' => false]);
        }

        $branch = Branch::create([
            'restaurant_id' => $restaurantId,
            'name' => $validated['name'],
            'code' => $validated['code'] ?? 'BR-' . strtoupper(substr(uniqid(), -4)),
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,
            'address' => $validated['address'] ?? null,
            'city' => $validated['city'] ?? null,
            'state' => $validated['state'] ?? null,
            'postal_code' => $validated['postal_code'] ?? null,
            'is_main_branch' => $validated['is_main_branch'] ?? false,
            'is_active' => $validated['is_active'] ?? true,
            'opening_time' => $validated['opening_time'] ?? '10:00',
            'closing_time' => $validated['closing_time'] ?? '23:00',
            'tax_rate' => $validated['tax_rate'] ?? 5.00,
        ]);

        if (!empty($validated['settings'])) {
            foreach ($validated['settings'] as $key => $val) {
                BranchSetting::updateOrCreate(
                    ['branch_id' => $branch->id, 'key' => $key],
                    ['value' => is_array($val) ? json_encode($val) : $val]
                );
            }
        }

        AuditLog::log(
            action: 'branch.created',
            auditable: $branch,
            newValues: $branch->toArray(),
            restaurantId: $restaurantId,
            branchId: $branch->id,
            userId: $user->id
        );

        return $this->successResponse($branch->load('settings'), 'Branch created successfully.', 201);
    }

    /**
     * Display the specified branch.
     */
    public function show(Request $request, int $restaurantId, int $branchId): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->hasBranchAccess($branchId)) {
            return $this->errorResponse('Unauthorized access to this branch.', 403);
        }

        $branch = Branch::where('restaurant_id', $restaurantId)
            ->with(['settings', 'diningTables', 'users:id,name,email,username,phone'])
            ->withCount(['diningTables', 'users', 'orders'])
            ->find($branchId);

        if (!$branch) {
            return $this->errorResponse('Branch not found.', 404);
        }

        return $this->successResponse($branch, 'Branch details retrieved.');
    }

    /**
     * Update the specified branch.
     */
    public function update(Request $request, int $restaurantId, int $branchId): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('branches.edit')) {
            return $this->errorResponse('Unauthorized to edit this branch.', 403);
        }

        $branch = Branch::where('restaurant_id', $restaurantId)->find($branchId);
        if (!$branch) {
            return $this->errorResponse('Branch not found.', 404);
        }

        if (!$user->hasRestaurantAccess($restaurantId)) {
            return $this->errorResponse('Unauthorized access to this restaurant.', 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'code' => 'nullable|string|max:32',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'is_main_branch' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'opening_time' => 'nullable|string|max:20',
            'closing_time' => 'nullable|string|max:20',
            'tax_rate' => 'nullable|numeric|min:0|max:100',
            'settings' => 'nullable|array',
        ]);

        if (!empty($validated['is_main_branch'])) {
            Branch::where('restaurant_id', $restaurantId)
                ->where('id', '!=', $branchId)
                ->update(['is_main_branch' => false]);
        }

        $oldValues = $branch->toArray();
        $branch->update($validated);

        if (isset($validated['settings'])) {
            foreach ($validated['settings'] as $key => $val) {
                BranchSetting::updateOrCreate(
                    ['branch_id' => $branch->id, 'key' => $key],
                    ['value' => is_array($val) ? json_encode($val) : $val]
                );
            }
        }

        AuditLog::log(
            action: 'branch.updated',
            auditable: $branch,
            oldValues: $oldValues,
            newValues: $branch->toArray(),
            restaurantId: $restaurantId,
            branchId: $branchId,
            userId: $user->id
        );

        return $this->successResponse($branch->fresh('settings'), 'Branch updated successfully.');
    }

    /**
     * Remove the specified branch.
     */
    public function destroy(Request $request, int $restaurantId, int $branchId): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('branches.delete')) {
            return $this->errorResponse('Unauthorized to delete branches.', 403);
        }

        $branch = Branch::where('restaurant_id', $restaurantId)->find($branchId);
        if (!$branch) {
            return $this->errorResponse('Branch not found.', 404);
        }

        if (!$user->hasRestaurantAccess($restaurantId)) {
            return $this->errorResponse('Unauthorized access to this restaurant.', 403);
        }

        // Safeguard: Check active orders
        $hasActiveOrders = Order::where('branch_id', $branchId)
            ->whereIn('order_status', ['pending', 'preparing', 'ready'])
            ->exists();

        if ($hasActiveOrders) {
            return $this->errorResponse('Cannot delete branch with active orders being prepared.', 422);
        }

        $branch->delete();

        AuditLog::log(
            action: 'branch.archived',
            auditable: $branch,
            restaurantId: $restaurantId,
            branchId: $branchId,
            userId: $user->id
        );

        return $this->successResponse(null, 'Branch archived successfully.');
    }

    /**
     * Toggle active status.
     */
    public function toggleStatus(Request $request, int $restaurantId, int $branchId): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('branches.edit')) {
            return $this->errorResponse('Unauthorized.', 403);
        }

        $branch = Branch::where('restaurant_id', $restaurantId)->find($branchId);
        if (!$branch) {
            return $this->errorResponse('Branch not found.', 404);
        }

        if (!$user->hasRestaurantAccess($restaurantId)) {
            return $this->errorResponse('Unauthorized access to this restaurant.', 403);
        }

        $branch->update(['is_active' => !$branch->is_active]);

        AuditLog::log(
            action: $branch->is_active ? 'branch.activated' : 'branch.deactivated',
            auditable: $branch,
            restaurantId: $restaurantId,
            branchId: $branchId,
            userId: $user->id
        );

        return $this->successResponse($branch, 'Branch status updated.');
    }
}
