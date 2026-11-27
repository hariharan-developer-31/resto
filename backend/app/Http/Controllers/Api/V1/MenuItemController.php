<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MenuItem;
use App\Models\MenuVariant;
use App\Models\Restaurant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MenuItemController extends Controller
{
    use ApiResponse;

    /**
     * Display a listing of menu items.
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

        $query = MenuItem::where('restaurant_id', $restaurantId)
            ->with(['category:id,name,slug', 'variants', 'addons'])
            ->orderBy('sort_order');

        // Search by name or description
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Filter by category
        if ($categoryId = $request->input('category_id')) {
            $query->where('category_id', $categoryId);
        }

        // Filter by dietary type (veg, non_veg, egg, vegan)
        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }

        // Filter by availability
        if ($request->has('is_available')) {
            $query->where('is_available', filter_var($request->input('is_available'), FILTER_VALIDATE_BOOLEAN));
        }

        // Filter by kitchen station
        if ($station = $request->input('kitchen_station')) {
            $query->where('kitchen_station', $station);
        }

        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);
        $items = $query->paginate($perPage);

        return $this->successResponse($items, 'Menu items retrieved successfully.');
    }

    /**
     * Store a newly created menu item.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('menu.create')) {
            return $this->errorResponse('Unauthorized to create menu items.', 403);
        }

        $restaurantId = $request->header('X-Restaurant-ID') 
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Restaurant::first()?->id;
        }

        if (!$restaurantId) {
            return $this->errorResponse('Please specify a valid restaurant context.', 400);
        }

        $validated = $request->validate([
            'category_id' => 'required|exists:categories,id',
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'image' => 'nullable|string|max:500',
            'base_price' => 'required|numeric|min:0',
            'type' => 'required|in:veg,non_veg,non-veg,egg,vegan',
            'preparation_time' => 'nullable|integer|min:1',
            'is_available' => 'nullable|boolean',
            'is_featured' => 'nullable|boolean',
            'is_combo' => 'nullable|boolean',
            'kitchen_station' => 'nullable|string|max:50',
            'sort_order' => 'nullable|integer',
            'variants' => 'nullable|array',
            'variants.*.name' => 'required|string|max:100',
            'variants.*.price' => 'required|numeric|min:0',
            'variants.*.is_default' => 'nullable|boolean',
            'addon_ids' => 'nullable|array',
            'addon_ids.*' => 'exists:addons,id',
        ]);

        $slug = $validated['slug'] ?? Str::slug($validated['name']);
        $count = MenuItem::where('restaurant_id', $restaurantId)->where('slug', $slug)->count();
        if ($count > 0) {
            $slug .= '-' . Str::random(4);
        }

        if (isset($validated['type']) && $validated['type'] === 'non-veg') {
            $validated['type'] = 'non_veg';
        }

        $item = MenuItem::create([
            'restaurant_id' => $restaurantId,
            'category_id' => $validated['category_id'],
            'name' => $validated['name'],
            'slug' => $slug,
            'description' => $validated['description'] ?? null,
            'image' => $validated['image'] ?? null,
            'base_price' => $validated['base_price'],
            'type' => $validated['type'],
            'preparation_time' => $validated['preparation_time'] ?? 15,
            'is_available' => $validated['is_available'] ?? true,
            'is_featured' => $validated['is_featured'] ?? false,
            'is_combo' => $validated['is_combo'] ?? false,
            'kitchen_station' => $validated['kitchen_station'] ?? 'main',
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        // Add Variants if provided
        if (!empty($validated['variants'])) {
            foreach ($validated['variants'] as $v) {
                MenuVariant::create([
                    'menu_item_id' => $item->id,
                    'name' => $v['name'],
                    'price' => $v['price'],
                    'is_default' => $v['is_default'] ?? false,
                ]);
            }
        }

        // Attach Addons if provided
        if (!empty($validated['addon_ids'])) {
            $item->addons()->sync($validated['addon_ids']);
        }

        AuditLog::log(
            action: 'menu_item.created',
            auditable: $item,
            newValues: $item->toArray(),
            restaurantId: $restaurantId,
            userId: $user->id
        );

        return $this->successResponse(
            $item->load(['category', 'variants', 'addons']),
            'Menu item created successfully.',
            201
        );
    }

    /**
     * Display the specified menu item.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $item = MenuItem::with(['category', 'variants', 'addons'])->find($id);

        if (!$item) {
            return $this->errorResponse('Menu item not found.', 404);
        }

        if (!$request->user()->hasRestaurantAccess($item->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this menu item.', 403);
        }

        return $this->successResponse($item, 'Menu item details retrieved.');
    }

    /**
     * Update the specified menu item.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('menu.edit')) {
            return $this->errorResponse('Unauthorized to update menu items.', 403);
        }

        $item = MenuItem::find($id);
        if (!$item) {
            return $this->errorResponse('Menu item not found.', 404);
        }

        if (!$user->hasRestaurantAccess($item->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this menu item.', 403);
        }

        $validated = $request->validate([
            'category_id' => 'sometimes|required|exists:categories,id',
            'name' => 'sometimes|required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'image' => 'nullable|string|max:500',
            'base_price' => 'sometimes|required|numeric|min:0',
            'type' => 'sometimes|required|in:veg,non_veg,non-veg,egg,vegan',
            'preparation_time' => 'nullable|integer|min:1',
            'is_available' => 'nullable|boolean',
            'is_featured' => 'nullable|boolean',
            'is_combo' => 'nullable|boolean',
            'kitchen_station' => 'nullable|string|max:50',
            'sort_order' => 'nullable|integer',
            'variants' => 'nullable|array',
            'variants.*.name' => 'required|string|max:100',
            'variants.*.price' => 'required|numeric|min:0',
            'variants.*.is_default' => 'nullable|boolean',
            'addon_ids' => 'nullable|array',
            'addon_ids.*' => 'exists:addons,id',
        ]);

        if (isset($validated['type']) && $validated['type'] === 'non-veg') {
            $validated['type'] = 'non_veg';
        }

        $oldValues = $item->toArray();
        $item->update($validated);

        if (isset($validated['variants'])) {
            $item->variants()->delete();
            foreach ($validated['variants'] as $v) {
                MenuVariant::create([
                    'menu_item_id' => $item->id,
                    'name' => $v['name'],
                    'price' => $v['price'],
                    'is_default' => $v['is_default'] ?? false,
                ]);
            }
        }

        if (isset($validated['addon_ids'])) {
            $item->addons()->sync($validated['addon_ids']);
        }

        AuditLog::log(
            action: 'menu_item.updated',
            auditable: $item,
            oldValues: $oldValues,
            newValues: $item->toArray(),
            restaurantId: $item->restaurant_id,
            userId: $user->id
        );

        return $this->successResponse(
            $item->fresh(['category', 'variants', 'addons']),
            'Menu item updated successfully.'
        );
    }

    /**
     * Remove the specified menu item.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('menu.delete')) {
            return $this->errorResponse('Unauthorized to delete menu items.', 403);
        }

        $item = MenuItem::find($id);
        if (!$item) {
            return $this->errorResponse('Menu item not found.', 404);
        }

        if (!$user->hasRestaurantAccess($item->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this menu item.', 403);
        }

        $item->delete();

        AuditLog::log(
            action: 'menu_item.deleted',
            auditable: $item,
            restaurantId: $item->restaurant_id,
            userId: $user->id
        );

        return $this->successResponse(null, 'Menu item deleted successfully.');
    }

    /**
     * Toggle availability status (In-Stock vs Out-of-Stock).
     */
    public function toggleAvailability(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('menu.edit')) {
            return $this->errorResponse('Unauthorized.', 403);
        }

        $item = MenuItem::find($id);
        if (!$item) {
            return $this->errorResponse('Menu item not found.', 404);
        }

        if (!$user->hasRestaurantAccess($item->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this menu item.', 403);
        }

        $item->update(['is_available' => !$item->is_available]);

        AuditLog::log(
            action: $item->is_available ? 'menu_item.marked_available' : 'menu_item.marked_out_of_stock',
            auditable: $item,
            restaurantId: $item->restaurant_id,
            userId: $user->id
        );

        return $this->successResponse($item, 'Item availability status updated.');
    }
}
