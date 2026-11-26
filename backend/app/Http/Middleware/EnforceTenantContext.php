<?php

namespace App\Http\Middleware;

use App\Models\Branch;
use App\Models\Restaurant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnforceTenantContext
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // 1. Validate Restaurant Context (header, route param, or explicit input)
        $headerRestaurantId = $request->header('X-Restaurant-ID');
        $routeRestaurantId = $request->route('restaurant');
        $inputRestaurantId = $request->input('restaurant_id');

        $resolvedHeaderRestaurant = null;
        $restaurantCandidates = array_filter(
            [$headerRestaurantId, $routeRestaurantId, $inputRestaurantId],
            fn($v) => $v !== null && $v !== ''
        );

        foreach ($restaurantCandidates as $idx => $restaurantId) {
            if ($restaurantId instanceof Restaurant) {
                $restaurant = $restaurantId;
            } else {
                $restaurant = is_numeric($restaurantId)
                    ? Restaurant::find($restaurantId)
                    : Restaurant::where('slug', $restaurantId)->first();
            }

            if (!$restaurant) {
                return response()->json([
                    'success' => false,
                    'message' => 'Restaurant not found.',
                ], 404);
            }

            if (!$restaurant->is_active && (!$user || !$user->isSuperAdmin())) {
                return response()->json([
                    'success' => false,
                    'message' => 'This restaurant is currently inactive.',
                ], 403);
            }

            if ($user && !$user->hasRestaurantAccess($restaurant->id)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized access to this restaurant.',
                ], 403);
            }

            if ($idx === 0 && $headerRestaurantId !== null && $headerRestaurantId !== '') {
                $resolvedHeaderRestaurant = $restaurant;
            }

            $request->attributes->set('current_restaurant', $restaurant);
        }

        // 2. Validate Branch Context (header, route param, or explicit input)
        $headerBranchId = $request->header('X-Branch-ID');
        $routeBranchId = $request->route('branch');
        $inputBranchId = $request->input('branch_id');

        $branchCandidates = array_filter(
            [$headerBranchId, $routeBranchId, $inputBranchId],
            fn($v) => $v !== null && $v !== ''
        );

        foreach ($branchCandidates as $idx => $branchId) {
            $branch = $branchId instanceof Branch ? $branchId : Branch::find($branchId);

            if (!$branch) {
                return response()->json([
                    'success' => false,
                    'message' => 'Branch not found.',
                ], 404);
            }

            if (!$branch->is_active && (!$user || !$user->isSuperAdmin())) {
                return response()->json([
                    'success' => false,
                    'message' => 'This branch is currently inactive.',
                ], 403);
            }

            if ($user && !$user->hasBranchAccess($branch->id) && !$user->hasRestaurantAccess($branch->restaurant_id)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized access to this branch.',
                ], 403);
            }

            if ($user && !$user->isSuperAdmin() && !$user->hasBranchAccess($branch->id)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized access to this branch.',
                ], 403);
            }

            // Ensure X-Branch-ID header matches X-Restaurant-ID header when both are sent
            if ($idx === 0 && $headerBranchId !== null && $headerBranchId !== '' && $resolvedHeaderRestaurant) {
                if ((int) $branch->restaurant_id !== (int) $resolvedHeaderRestaurant->id) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Branch does not belong to the active restaurant.',
                    ], 422);
                }
            }

            $request->attributes->set('current_branch', $branch);
            if (!$request->attributes->has('current_restaurant')) {
                $request->attributes->set('current_restaurant', $branch->restaurant);
            }
        }

        return $next($request);
    }
}
