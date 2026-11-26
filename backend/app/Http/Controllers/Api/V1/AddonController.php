<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Addon;
use App\Models\AuditLog;
use App\Models\Restaurant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AddonController extends Controller
{
    use ApiResponse;

    /**
     * Display a listing of addons.
     */
    public function index(Request $request): JsonResponse
    {
        $restaurantId = $request->header('X-Restaurant-ID') 
            ?? $request->input('restaurant_id')
            ?? $request->user()->restaurants()->first()?->id;

        if (!$restaurantId && $request->user()->isSuperAdmin()) {
            $restaurantId = Restaurant::first()?->id;
        }

        if (!$restaurantId) {
            return $this->errorResponse('Please specify a valid restaurant context.', 400);
        }

        $addons = Addon::where('restaurant_id', $restaurantId)->latest()->get();

        return $this->successResponse($addons, 'Addons retrieved successfully.');
    }

    /**
     * Store a newly created addon.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('menu.create')) {
            return $this->errorResponse('Unauthorized to create addons.', 403);
        }

        $restaurantId = $request->header('X-Restaurant-ID') 
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Restaurant::first()?->id;
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'price' => 'required|numeric|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $addon = Addon::create([
            'restaurant_id' => $restaurantId,
            'name' => $validated['name'],
            'price' => $validated['price'],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        AuditLog::log(
            action: 'addon.created',
            auditable: $addon,
            restaurantId: $restaurantId,
            userId: $user->id
        );

        return $this->successResponse($addon, 'Addon created successfully.', 201);
    }

    /**
     * Update the specified addon.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('menu.edit')) {
            return $this->errorResponse('Unauthorized to update addons.', 403);
        }

        $addon = Addon::find($id);
        if (!$addon) {
            return $this->errorResponse('Addon not found.', 404);
        }

        if (!$user->hasRestaurantAccess($addon->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this addon.', 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'price' => 'sometimes|required|numeric|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $addon->update($validated);

        AuditLog::log(
            action: 'addon.updated',
            auditable: $addon,
            restaurantId: $addon->restaurant_id,
            userId: $user->id
        );

        return $this->successResponse($addon, 'Addon updated successfully.');
    }

    /**
     * Remove the specified addon.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('menu.delete')) {
            return $this->errorResponse('Unauthorized to delete addons.', 403);
        }

        $addon = Addon::find($id);
        if (!$addon) {
            return $this->errorResponse('Addon not found.', 404);
        }

        if (!$user->hasRestaurantAccess($addon->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this addon.', 403);
        }

        $addon->delete();

        AuditLog::log(
            action: 'addon.deleted',
            auditable: $addon,
            restaurantId: $addon->restaurant_id,
            userId: $user->id
        );

        return $this->successResponse(null, 'Addon deleted successfully.');
    }
}
