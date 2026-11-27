<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\InventoryItem;
use App\Models\Restaurant;
use App\Models\StockMovement;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    use ApiResponse;

    /**
     * Display a listing of inventory items.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $restaurantId = $request->header('X-Restaurant-ID')
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Restaurant::first()?->id;
        }

        if (!$restaurantId) {
            return $this->errorResponse('Please specify an active restaurant context.', 400);
        }

        $query = InventoryItem::where('restaurant_id', $restaurantId)
            ->with(['supplier:id,name,phone,email', 'branch:id,name']);

        // Filter by branch
        if ($branchId = $request->header('X-Branch-ID') ?? $request->input('branch_id')) {
            $query->where('branch_id', $branchId);
        }

        // Filter by category
        if ($category = $request->input('category')) {
            if ($category !== 'all') {
                $query->where('category', $category);
            }
        }

        // Filter by stock status
        if ($status = $request->input('status')) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        // Search by name or SKU
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        $items = $query->orderBy('name', 'asc')->paginate($request->input('per_page', 25));

        return $this->successResponse($items, 'Inventory items retrieved successfully.');
    }

    /**
     * Create a new raw material / inventory item.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'restaurant_id' => 'nullable|exists:restaurants,id',
            'branch_id' => 'required|exists:branches,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'name' => 'required|string|max:150',
            'sku' => 'nullable|string|max:50',
            'category' => 'required|string|max:50',
            'unit' => 'required|string|max:20',
            'current_stock' => 'required|numeric|min:0',
            'minimum_stock' => 'required|numeric|min:0',
            'unit_cost' => 'required|numeric|min:0',
            'storage_location' => 'nullable|string|max:100',
        ]);

        $branch = Branch::findOrFail($validated['branch_id']);
        $restaurantId = $validated['restaurant_id'] ?? $branch->restaurant_id;

        $stock = (float) $validated['current_stock'];
        $minStock = (float) $validated['minimum_stock'];

        $status = 'in_stock';
        if ($stock <= 0.0001) {
            $status = 'out_of_stock';
        } elseif ($stock <= $minStock) {
            $status = 'low_stock';
        }

        $item = InventoryItem::create([
            'restaurant_id' => $restaurantId,
            'branch_id' => $branch->id,
            'supplier_id' => $validated['supplier_id'] ?? null,
            'name' => $validated['name'],
            'sku' => $validated['sku'] ?? null,
            'category' => $validated['category'],
            'unit' => $validated['unit'],
            'current_stock' => $stock,
            'minimum_stock' => $minStock,
            'unit_cost' => $validated['unit_cost'],
            'storage_location' => $validated['storage_location'] ?? null,
            'status' => $status,
        ]);

        // If initial stock was provided, create initial audit stock movement
        if ($stock > 0) {
            StockMovement::create([
                'restaurant_id' => $restaurantId,
                'branch_id' => $branch->id,
                'inventory_item_id' => $item->id,
                'user_id' => $user->id,
                'movement_type' => 'audit_adjustment',
                'quantity' => $stock,
                'balance_after' => $stock,
                'unit_cost' => (float) $validated['unit_cost'],
                'total_cost' => round($stock * (float) $validated['unit_cost'], 2),
                'reference_type' => 'initial_count',
                'reason' => 'Initial inventory setup',
            ]);
        }

        AuditLog::log('inventory.item_created', $item, null, ['name' => $item->name, 'sku' => $item->sku], $user);

        return $this->successResponse($item->load(['supplier', 'branch']), 'Inventory item created successfully.', 201);
    }

    /**
     * Display single inventory item details with recent movements.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $item = InventoryItem::with([
            'supplier',
            'branch',
            'stockMovements' => function ($q) {
                $q->with('user:id,name')->latest()->take(20);
            },
        ])->findOrFail($id);

        if (!$request->user()->hasRestaurantAccess($item->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this inventory item.', 403);
        }

        return $this->successResponse($item, 'Inventory item details retrieved.');
    }

    /**
     * Update an inventory item.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $item = InventoryItem::findOrFail($id);
        if (!$user->hasRestaurantAccess($item->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this inventory item.', 403);
        }

        $validated = $request->validate([
            'supplier_id' => 'nullable|exists:suppliers,id',
            'name' => 'sometimes|string|max:150',
            'sku' => 'nullable|string|max:50',
            'category' => 'sometimes|string|max:50',
            'unit' => 'sometimes|string|max:20',
            'minimum_stock' => 'sometimes|numeric|min:0',
            'unit_cost' => 'sometimes|numeric|min:0',
            'storage_location' => 'nullable|string|max:100',
        ]);

        $old = $item->toArray();
        $item->update($validated);

        // Recalculate status based on new minimum_stock if changed
        $current = (float) $item->current_stock;
        $min = (float) $item->minimum_stock;
        $newStatus = 'in_stock';
        if ($current <= 0.0001) {
            $newStatus = 'out_of_stock';
        } elseif ($current <= $min) {
            $newStatus = 'low_stock';
        }

        if ($newStatus !== $item->status) {
            $item->update(['status' => $newStatus]);
        }

        AuditLog::log('inventory.item_updated', $item, $old, $item->getChanges(), $user);

        return $this->successResponse($item->load(['supplier', 'branch']), 'Inventory item updated successfully.');
    }

    /**
     * Record a manual stock adjustment, wastage, spoilage, or audit correction.
     */
    public function adjustStock(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'inventory_item_id' => 'required|exists:inventory_items,id',
            'movement_type' => ['required', Rule::in(['audit_adjustment', 'wastage', 'spoilage', 'purchase_in', 'return'])],
            'quantity' => 'required|numeric|not_in:0', // Can be positive (addition) or negative (wastage/breakage)
            'reason' => 'required|string|max:255',
            'notes' => 'nullable|string|max:1000',
        ]);

        $item = InventoryItem::findOrFail($validated['inventory_item_id']);
        if (!$user->hasRestaurantAccess($item->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this inventory item.', 403);
        }

        $delta = (float) $validated['quantity'];
        if (in_array($validated['movement_type'], ['wastage', 'spoilage'], true)) {
            $delta = -abs($delta);
        } elseif ($validated['movement_type'] === 'purchase_in') {
            $delta = abs($delta);
        }

        $movement = $item->adjustStock(
            $delta,
            $validated['movement_type'],
            $user->id,
            $validated['reason'],
            'manual_adjustment',
            null,
            $validated['notes'] ?? null
        );

        AuditLog::log(
            'inventory.stock_adjusted',
            $item,
            null,
            [
                'delta' => $validated['quantity'],
                'type' => $validated['movement_type'],
                'new_balance' => $movement->balance_after,
                'reason' => $validated['reason'],
            ],
            $user
        );

        return $this->successResponse([
            'item' => $item->fresh(['supplier', 'branch']),
            'movement' => $movement,
        ], 'Stock adjusted successfully.');
    }

    /**
     * Get all items currently below safety stock thresholds.
     */
    public function alerts(Request $request): JsonResponse
    {
        $user = $request->user();

        $restaurantId = $request->header('X-Restaurant-ID')
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Restaurant::first()?->id;
        }

        $query = InventoryItem::where('restaurant_id', $restaurantId)
            ->whereIn('status', ['low_stock', 'out_of_stock'])
            ->with(['supplier:id,name,phone,email', 'branch:id,name']);

        if ($branchId = $request->header('X-Branch-ID') ?? $request->input('branch_id')) {
            $query->where('branch_id', $branchId);
        }

        $alerts = $query->orderBy('current_stock', 'asc')->get();

        return $this->successResponse($alerts, 'Low stock alerts retrieved.');
    }

    /**
     * Soft delete inventory item.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $item = InventoryItem::findOrFail($id);
        if (!$user->hasRestaurantAccess($item->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this inventory item.', 403);
        }

        AuditLog::log('inventory.item_deleted', $item, $item->toArray(), null, $user);
        $item->delete();

        return $this->successResponse(null, 'Inventory item deleted successfully.');
    }
}
