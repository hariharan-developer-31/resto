<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MenuItem;
use App\Models\RecipeIngredient;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RecipeController extends Controller
{
    use ApiResponse;

    /**
     * Get recipe ingredients (Bill of Materials) for a specific menu item.
     */
    public function getRecipe(Request $request, int $menuItemId): JsonResponse
    {
        $menuItem = MenuItem::with([
            'recipeIngredients.inventoryItem',
            'recipeIngredients.menuVariant',
            'variants',
        ])->findOrFail($menuItemId);

        if (!$request->user()->hasRestaurantAccess($menuItem->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this recipe.', 403);
        }

        return $this->successResponse([
            'menu_item_id' => $menuItem->id,
            'name' => $menuItem->name,
            'recipe_ingredients' => $menuItem->recipeIngredients,
        ], 'Recipe ingredients retrieved.');
    }

    /**
     * Save or replace recipe ingredients for a menu item.
     */
    public function saveRecipe(Request $request, int $menuItemId): JsonResponse
    {
        $user = $request->user();
        $menuItem = MenuItem::findOrFail($menuItemId);

        if (!$user->hasRestaurantAccess($menuItem->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this recipe.', 403);
        }

        $validated = $request->validate([
            'ingredients' => 'required|array',
            'ingredients.*.inventory_item_id' => 'required|exists:inventory_items,id',
            'ingredients.*.menu_variant_id' => 'nullable|exists:menu_variants,id',
            'ingredients.*.quantity_required' => 'required|numeric|gt:0',
            'ingredients.*.unit' => 'required|string|max:20',
        ]);

        DB::transaction(function () use ($menuItem, $validated) {
            // Remove existing ingredients
            RecipeIngredient::where('menu_item_id', $menuItem->id)->delete();

            // Insert new ingredients
            foreach ($validated['ingredients'] as $item) {
                RecipeIngredient::create([
                    'menu_item_id' => $menuItem->id,
                    'menu_variant_id' => $item['menu_variant_id'] ?? null,
                    'inventory_item_id' => $item['inventory_item_id'],
                    'quantity_required' => $item['quantity_required'],
                    'unit' => $item['unit'],
                ]);
            }
        });

        AuditLog::log(
            'recipe.updated',
            $menuItem,
            null,
            ['ingredients_count' => count($validated['ingredients'])],
            $user
        );

        $updatedRecipe = MenuItem::with([
            'recipeIngredients.inventoryItem',
            'recipeIngredients.menuVariant',
        ])->find($menuItem->id);

        return $this->successResponse($updatedRecipe, 'Recipe ingredients saved successfully.');
    }
}
