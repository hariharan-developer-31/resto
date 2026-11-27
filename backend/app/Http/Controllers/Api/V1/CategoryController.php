<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Restaurant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    use ApiResponse;

    /**
     * Display a listing of categories.
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

        $query = Category::where('restaurant_id', $restaurantId)
            ->whereNull('parent_id')
            ->with(['children' => function ($q) {
                $q->withCount('menuItems');
            }])
            ->withCount('menuItems')
            ->orderBy('sort_order');

        if ($search = $request->input('search')) {
            $query->where('name', 'like', "%{$search}%");
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $categories = $query->get();

        return $this->successResponse($categories, 'Categories retrieved successfully.');
    }

    /**
     * Store a newly created category.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('menu.create')) {
            return $this->errorResponse('Unauthorized to create menu categories.', 403);
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
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'parent_id' => 'nullable|exists:categories,id',
            'description' => 'nullable|string',
            'image' => 'nullable|string|max:500',
            'sort_order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        $slug = $validated['slug'] ?? Str::slug($validated['name']);
        // Ensure uniqueness for this restaurant
        $count = Category::where('restaurant_id', $restaurantId)->where('slug', $slug)->count();
        if ($count > 0) {
            $slug .= '-' . Str::random(4);
        }

        $category = Category::create([
            'restaurant_id' => $restaurantId,
            'parent_id' => $validated['parent_id'] ?? null,
            'name' => $validated['name'],
            'slug' => $slug,
            'description' => $validated['description'] ?? null,
            'image' => $validated['image'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        AuditLog::log(
            action: 'category.created',
            auditable: $category,
            newValues: $category->toArray(),
            restaurantId: $restaurantId,
            userId: $user->id
        );

        return $this->successResponse($category, 'Category created successfully.', 201);
    }

    /**
     * Display the specified category.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $category = Category::with(['children', 'menuItems.variants', 'menuItems.addons'])
            ->find($id);

        if (!$category) {
            return $this->errorResponse('Category not found.', 404);
        }

        if (!$request->user()->hasRestaurantAccess($category->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this category.', 403);
        }

        return $this->successResponse($category, 'Category details retrieved.');
    }

    /**
     * Update the specified category.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('menu.edit')) {
            return $this->errorResponse('Unauthorized to update menu categories.', 403);
        }

        $category = Category::find($id);
        if (!$category) {
            return $this->errorResponse('Category not found.', 404);
        }

        if (!$user->hasRestaurantAccess($category->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this category.', 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'parent_id' => 'nullable|exists:categories,id',
            'description' => 'nullable|string',
            'image' => 'nullable|string|max:500',
            'sort_order' => 'nullable|integer',
            'is_active' => 'nullable|boolean',
        ]);

        $oldValues = $category->toArray();
        $category->update($validated);

        AuditLog::log(
            action: 'category.updated',
            auditable: $category,
            oldValues: $oldValues,
            newValues: $category->toArray(),
            restaurantId: $category->restaurant_id,
            userId: $user->id
        );

        return $this->successResponse($category, 'Category updated successfully.');
    }

    /**
     * Remove the specified category.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('menu.delete')) {
            return $this->errorResponse('Unauthorized to delete menu categories.', 403);
        }

        $category = Category::withCount('menuItems')->find($id);
        if (!$category) {
            return $this->errorResponse('Category not found.', 404);
        }

        if (!$user->hasRestaurantAccess($category->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this category.', 403);
        }

        if ($category->menu_items_count > 0) {
            return $this->errorResponse('Cannot delete category containing active menu items. Reassign or remove items first.', 422);
        }

        $category->delete();

        AuditLog::log(
            action: 'category.deleted',
            auditable: $category,
            restaurantId: $category->restaurant_id,
            userId: $user->id
        );

        return $this->successResponse(null, 'Category deleted successfully.');
    }
}
