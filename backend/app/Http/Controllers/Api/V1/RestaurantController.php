<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\RestaurantSetting;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RestaurantController extends Controller
{
    use ApiResponse;

    /**
     * Display a listing of restaurants.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Restaurant::withCount(['branches', 'users', 'orders'])
            ->latest();

        // If not Super Admin, scope to permitted restaurants only
        if (!$user->isSuperAdmin()) {
            $permittedIds = $user->restaurants()->pluck('restaurants.id');
            $query->whereIn('id', $permittedIds);
        }

        // Search by name, slug, email, or branch city
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('slug', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhereHas('branches', function ($bq) use ($search) {
                      $bq->where('city', 'like', "%{$search}%");
                  });
            });
        }

        // Active status filter
        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $perPage = min(max((int) $request->input('per_page', 10), 1), 100);
        $restaurants = $query->paginate($perPage);

        return $this->successResponse($restaurants, 'Restaurants retrieved successfully.');
    }

    /**
     * Store a newly created restaurant.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('restaurants.create')) {
            return $this->errorResponse('Unauthorized to create restaurants.', 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:restaurants,slug',
            'logo' => 'nullable|string|max:500',
            'description' => 'nullable|string',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'website' => 'nullable|string|max:255',
            'gst_number' => 'nullable|string|max:50',
            'currency' => 'nullable|string|max:10',
            'currency_symbol' => 'nullable|string|max:10',
            'timezone' => 'nullable|string|max:64',
            'primary_color' => 'nullable|string|max:20',
            'is_active' => 'nullable|boolean',
            'settings' => 'nullable|array',
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']) . '-' . Str::random(4);
        }

        $restaurant = Restaurant::create([
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'logo' => $validated['logo'] ?? null,
            'description' => $validated['description'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,
            'website' => $validated['website'] ?? null,
            'gst_number' => $validated['gst_number'] ?? null,
            'currency' => $validated['currency'] ?? 'INR',
            'currency_symbol' => $validated['currency_symbol'] ?? '₹',
            'timezone' => $validated['timezone'] ?? 'Asia/Kolkata',
            'primary_color' => $validated['primary_color'] ?? '#C76B4A',
            'is_active' => $validated['is_active'] ?? true,
        ]);

        // Save settings if provided
        if (!empty($validated['settings'])) {
            foreach ($validated['settings'] as $key => $val) {
                RestaurantSetting::updateOrCreate(
                    ['restaurant_id' => $restaurant->id, 'key' => $key],
                    ['value' => is_array($val) ? json_encode($val) : $val]
                );
            }
        }

        // Attach creator to user_restaurants if not superadmin
        if (!$user->isSuperAdmin()) {
            $user->restaurants()->syncWithoutDetaching([$restaurant->id]);
        }

        AuditLog::log(
            action: 'restaurant.created',
            auditable: $restaurant,
            newValues: $restaurant->toArray(),
            restaurantId: $restaurant->id,
            userId: $user->id
        );

        return $this->successResponse($restaurant->load(['branches', 'settings']), 'Restaurant created successfully.', 201);
    }

    /**
     * Display the specified restaurant.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->hasRestaurantAccess($id)) {
            return $this->errorResponse('Unauthorized access to this restaurant.', 403);
        }

        $restaurant = Restaurant::with([
            'branches' => function ($q) {
                $q->withCount(['diningTables', 'users']);
            },
            'settings',
            'users:id,name,email,username,phone',
        ])
        ->withCount(['branches', 'orders', 'diningTables'])
        ->find($id);

        if (!$restaurant) {
            return $this->errorResponse('Restaurant not found.', 404);
        }

        return $this->successResponse($restaurant, 'Restaurant details retrieved.');
    }

    /**
     * Update the specified restaurant.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('restaurants.edit')) {
            return $this->errorResponse('Unauthorized to edit this restaurant.', 403);
        }

        $restaurant = Restaurant::find($id);
        if (!$restaurant) {
            return $this->errorResponse('Restaurant not found.', 404);
        }

        if (!$user->hasRestaurantAccess($restaurant->id)) {
            return $this->errorResponse('Unauthorized access to this restaurant.', 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'slug' => 'sometimes|nullable|string|max:255|unique:restaurants,slug,' . $id,
            'logo' => 'nullable|string|max:500',
            'description' => 'nullable|string',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'website' => 'nullable|string|max:255',
            'gst_number' => 'nullable|string|max:50',
            'currency' => 'nullable|string|max:10',
            'currency_symbol' => 'nullable|string|max:10',
            'timezone' => 'nullable|string|max:64',
            'primary_color' => 'nullable|string|max:20',
            'is_active' => 'nullable|boolean',
            'settings' => 'nullable|array',
        ]);

        $oldValues = $restaurant->toArray();

        $restaurant->update($validated);

        if (isset($validated['settings'])) {
            foreach ($validated['settings'] as $key => $val) {
                RestaurantSetting::updateOrCreate(
                    ['restaurant_id' => $restaurant->id, 'key' => $key],
                    ['value' => is_array($val) ? json_encode($val) : $val]
                );
            }
        }

        AuditLog::log(
            action: 'restaurant.updated',
            auditable: $restaurant,
            oldValues: $oldValues,
            newValues: $restaurant->toArray(),
            restaurantId: $restaurant->id,
            userId: $user->id
        );

        return $this->successResponse($restaurant->fresh(['branches', 'settings']), 'Restaurant updated successfully.');
    }

    /**
     * Remove the specified restaurant (Soft delete with safeguards).
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('restaurants.delete')) {
            return $this->errorResponse('Unauthorized to delete restaurants.', 403);
        }

        $restaurant = Restaurant::find($id);
        if (!$restaurant) {
            return $this->errorResponse('Restaurant not found.', 404);
        }

        if (!$user->hasRestaurantAccess($restaurant->id)) {
            return $this->errorResponse('Unauthorized access to this restaurant.', 403);
        }

        // Safeguard: Check if there are active, unpaid orders
        $hasActiveOrders = Order::where('restaurant_id', $id)
            ->whereIn('order_status', ['pending', 'preparing', 'ready'])
            ->exists();

        if ($hasActiveOrders) {
            return $this->errorResponse('Cannot archive restaurant while there are active or preparing kitchen orders.', 422);
        }

        $restaurant->delete();

        AuditLog::log(
            action: 'restaurant.archived',
            auditable: $restaurant,
            restaurantId: $restaurant->id,
            userId: $user->id
        );

        return $this->successResponse(null, 'Restaurant archived successfully.');
    }

    /**
     * Toggle active status.
     */
    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin() && !$user->can('restaurants.edit')) {
            return $this->errorResponse('Unauthorized.', 403);
        }

        $restaurant = Restaurant::find($id);
        if (!$restaurant) {
            return $this->errorResponse('Restaurant not found.', 404);
        }

        if (!$user->hasRestaurantAccess($restaurant->id)) {
            return $this->errorResponse('Unauthorized access to this restaurant.', 403);
        }

        $restaurant->update(['is_active' => !$restaurant->is_active]);

        AuditLog::log(
            action: $restaurant->is_active ? 'restaurant.activated' : 'restaurant.deactivated',
            auditable: $restaurant,
            restaurantId: $restaurant->id,
            userId: $user->id
        );

        return $this->successResponse($restaurant, 'Restaurant status updated.');
    }
}
