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

        // 1. Check Restaurant Context
        $restaurantId = $request->header('X-Restaurant-ID') 
            ?? $request->route('restaurant') 
            ?? $request->input('restaurant_id');

        if ($restaurantId) {
            $restaurant = is_numeric($restaurantId) 
                ? Restaurant::find($restaurantId)
                : Restaurant::where('slug', $restaurantId)->first();

            if (!$restaurant) {
                return response()->json([
                    'success' => false,
                    'message' => 'Restaurant not found.',
                ], 404);
            }

            if (!$restaurant->is_active) {
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

            $request->attributes->set('current_restaurant', $restaurant);
        }

        // 2. Check Branch Context
        $branchId = $request->header('X-Branch-ID') 
            ?? $request->route('branch') 
            ?? $request->input('branch_id');

        if ($branchId) {
            $branch = Branch::find($branchId);

            if (!$branch) {
                return response()->json([
                    'success' => false,
                    'message' => 'Branch not found.',
                ], 404);
            }

            if (!$branch->is_active) {
                return response()->json([
                    'success' => false,
                    'message' => 'This branch is currently inactive.',
                ], 403);
            }

            if ($user && !$user->hasBranchAccess($branch->id)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized access to this branch.',
                ], 403);
            }

            $request->attributes->set('current_branch', $branch);
        }

        return $next($request);
    }
}
